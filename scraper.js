import ProductoModel from "./database/models/productModel.js"
import ProductoXTiendaModel from "./database/models/pxtModel.js";
import TiendaModel from "./database/models/tiendaModel.js";


// Convierte "3.640,00" -> 3640.00
function parsePrecioAr(str) {
    if (!str) return null;

    const limpio = str.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(limpio);

    return Number.isNaN(num) ? null : num;
}


// Extrae el origin (https://host) de una URL, o "" si no es válida
function obtenerBaseURL(url) {
    try {
        return new URL(url).origin;
    } catch (_) {
        return "";
    }
}


export function obtenerProducto($, request) {

    const nombreProducto = $("h1").first().text().trim();


    // --- Descripción real del producto (no la meta genérica) ---
    // La meta "description" trae "Compará precios de X en supermercados..."
    // La descripción real está en el JSON-LD (schema.org Product) y también
    // se replica en el <p> justo debajo del <h1>. Priorizamos el JSON-LD
    // porque es más estable ante cambios de clases CSS.
    let Descripcion = "";

    try {
        const rawSchema = $("script#schema").first().html();
        if (rawSchema) {
            const schemaJson = JSON.parse(rawSchema);
            if (schemaJson?.description) {
                Descripcion = schemaJson.description.trim();
            }
        }
    } catch (_) {
        // si falla el parseo, seguimos con el fallback de abajo
    }

    if (!Descripcion) {
        // Fallback: el <p> inmediatamente después del <h1>
        Descripcion = $("h1").first().next("p").text().trim();
    }


    const CodigoEan =
        $("dt")
            .filter((_, el) => $(el).text().includes("EAN"))
            .next("dd")
            .text()
            .trim();


    let Categoria = $("p")
        .filter((_, el) => $(el).text().includes("Rubro"))
        .text()
        .replace(/^Rubro\s*·\s*/i, "")
        .trim();


    // Lista completa de tags/categorías secundarias (sección "También en")
    const categorias = $("section")
        .has('p:contains("También en")')
        .find("a")
        .map((_, el) => $(el).text().trim())
        .get();


    let SubCategoria =
        categorias.length > 1
            ? categorias[1]
            : Categoria;


    // Si Categoria viene vacía pero SubCategoria tiene valor,
    // Categoria toma ese valor y SubCategoria queda vacía.
    if (!Categoria && SubCategoria) {
        Categoria = SubCategoria;
        SubCategoria = "";
    }


    // Tags: todas las etiquetas de la sección "También en"
    const tags = categorias;


    const imagenURL =
        $('meta[property="og:image"]').attr("content") ||
        $("img.image").attr("src") ||
        "";


    // Origen del sitio de Pricely (para resolver logos relativos, ej. "/images/markets/x.webp")
    const pricelyBaseURL = obtenerBaseURL(request.url);


    const Tiendas = [];


    $("#precios a").each((_, el) => {

        const $el = $(el);


        const $img = $el.find("img").first();


        const tienda =
            $img.attr("alt")?.trim() || "";


        const url =
            $el.attr("href") || "";


        let logoURL = $img.attr("src") || "";

        // Si el logo viene con ruta relativa, la resolvemos contra el
        // dominio de Pricely (de donde vino el HTML scrapeado).
        if (logoURL && !/^https?:\/\//i.test(logoURL) && pricelyBaseURL) {
            logoURL = new URL(logoURL, pricelyBaseURL).href;
        }

        const baseURL = obtenerBaseURL(url);


        const precio =
            $el
                .find(".font-number")
                .not(".line-through")
                .first()
                .text()
                .replace(/[^\d,]/g, "")
                .trim();


        const precioSinDescuento =
            $el
                .find(".font-number.line-through")
                .first()
                .text()
                .replace(/[^\d,]/g, "")
                .trim();


        let descuentoPorcentaje = "";


        $el.find("div,span").each((_, badge) => {

            const texto = $(badge).text().trim();


            if (/^-?\d+(?:[.,]\d+)?%$/.test(texto)) {

                descuentoPorcentaje = texto
                    .replace("%", "")
                    .replace(".", ",");
            }

        });


        if (!descuentoPorcentaje && precio && precioSinDescuento) {

            const actual = parsePrecioAr(precio);
            const lista = parsePrecioAr(precioSinDescuento);


            if (
                actual !== null &&
                lista !== null &&
                lista > actual
            ) {

                descuentoPorcentaje = (
                    ((lista - actual) / lista) * 100
                )
                    .toFixed(1)
                    .replace(".", ",");
            }
        }


        Tiendas.push({
            tienda,
            logoURL,
            baseURL,
            url,
            precio,
            precioSinDescuento,
            descuentoPorcentaje,
        });

    });


    return {
        Producto: nombreProducto,
        Descripcion,
        CodigoEan,
        Categoria,
        SubCategoria,
        tags,
        imagenURL,
        URL: request.url,
        Tiendas,
    };
}


// Busca la tienda por nombre; si no existe la crea con su logo y baseURL.
// Si ya existe pero descubrimos un logo/baseURL nuevo (o distinto), lo actualiza.
// Normaliza el nombre de una tienda para evitar duplicados
function normalizarNombreTienda(nombre = "") {
    return nombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // elimina acentos
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}


// Busca la tienda por nombre normalizado; si no existe la crea.
// Si existe, actualiza logo/baseURL si cambiaron.
async function obtenerOCrearTienda({ tienda, logoURL, baseURL }) {

    const nombre = (tienda || "")
        .trim()
        .replace(/\s+/g, " ");

    const nombreNormalizado = normalizarNombreTienda(nombre);

    return await TiendaModel.findOneAndUpdate(
        {
            nombreNormalizado,
        },
        {
            $setOnInsert: {
                nombre,
                nombreNormalizado,
            },
            $set: {
                LogoURL: logoURL || "",
                baseURL: baseURL || "",
            },
        },
        {
            returnDocument: "after",
            upsert: true,
            setDefaultsOnInsert: true,
        }
    );
}



export async function guardarProducto(productoScrapeado) {

    const {
        Producto,
        Descripcion,
        CodigoEan,
        Categoria,
        SubCategoria,
        tags,
        imagenURL,
        URL,
        Tiendas
    } = productoScrapeado;



    // Buscar producto existente
    let producto = await ProductoModel.findOne({
        CodigoEan
    });



    // Crear producto si no existe
    if (!producto) {

        producto = await ProductoModel.create({

            Producto,

            Descripcion,

            CodigoEan,

            Categoria,

            SubCategoria,

            tags,

            imagenURL,

            URL,

            ProductosXTienda: []

        });

    } else {

        // Actualizamos campos que pueden cambiar entre scrapeos
        producto.Descripcion = Descripcion;
        producto.Categoria = Categoria;
        producto.SubCategoria = SubCategoria;
        producto.tags = tags;

    }



    const productosXTiendaIds = [];



    // Crear / actualizar productos por tienda
    for (const tiendaData of Tiendas) {


        const {
            tienda,
            logoURL,
            baseURL,
            url,
            precio,
            precioSinDescuento,
            descuentoPorcentaje
        } = tiendaData;


        // Resuelve (o crea) el documento Tienda y nos quedamos con su _id
        const tiendaDoc = await obtenerOCrearTienda({
            tienda,
            logoURL,
            baseURL,
        });



        const precioNumero =
            parsePrecioAr(precio);



        const precioListaNumero =
            parsePrecioAr(precioSinDescuento);



        let productoXTienda =
            await ProductoXTiendaModel.findOne({

                producto: producto._id,

                tienda: tiendaDoc._id

            });



        if (productoXTienda) {


            // Si cambió el precio, guardar histórico
            if (
                productoXTienda.precio !== precioNumero
            ) {

                productoXTienda.historicos.push({

                    fecha: new Date(),

                    precio: precioNumero

                });


                productoXTienda.precio = precioNumero;

                productoXTienda.ultimaActualizacion =
                    new Date();


                await productoXTienda.save();

            }



        } else {


            productoXTienda =
                await ProductoXTiendaModel.create({

                    producto: producto._id,

                    tienda: tiendaDoc._id,

                    url,

                    precio: precioNumero,


                    precioSinDescuento:
                        precioListaNumero,


                    descuentoPorcentaje:
                        descuentoPorcentaje
                            ? Number(
                                descuentoPorcentaje.replace(",", ".")
                            )
                            : null,


                    historicos: [

                        {

                            fecha: new Date(),

                            precio: precioNumero

                        }

                    ]

                });

        }



        productosXTiendaIds.push(
            productoXTienda._id
        );

    }




    // Actualizar referencias
    producto.ProductosXTienda = [

        ...new Set([

            ...producto.ProductosXTienda,

            ...productosXTiendaIds

        ])

    ];



    await producto.save();



    return producto;

}