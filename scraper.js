import ProductoModel from "./database/models/productModel.js"
import ProductoXTiendaModel from "./database/models/pxtModel.js";


// Convierte "3.640,00" -> 3640.00
function parsePrecioAr(str) {
    if (!str) return null;

    const limpio = str.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(limpio);

    return Number.isNaN(num) ? null : num;
}


export function obtenerProducto($, request) {

    const nombreProducto = $("h1").first().text().trim();

    const Descripcion =
        $('meta[name="description"]').attr("content")?.trim() || "";


    const CodigoEan =
        $("dt")
            .filter((_, el) => $(el).text().includes("EAN"))
            .next("dd")
            .text()
            .trim();


    const Categoria = $("p")
        .filter((_, el) => $(el).text().includes("Rubro"))
        .text()
        .replace(/^Rubro\s*·\s*/i, "")
        .trim();


    const categorias = $("section")
        .has('p:contains("También en")')
        .find("a")
        .map((_, el) => $(el).text().trim())
        .get();


    const SubCategoria =
        categorias.length > 1
            ? categorias[1]
            : Categoria;


    const imagenURL =
        $('meta[property="og:image"]').attr("content") ||
        $("img.image").attr("src") ||
        "";


    const Tiendas = [];


    $("#precios a").each((_, el) => {

        const $el = $(el);


        const tienda =
            $el.find("img").attr("alt")?.trim() || "";


        const url =
            $el.attr("href") || "";


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
        imagenURL,
        URL: request.url,
        Tiendas,
    };
}



export async function guardarProducto(productoScrapeado) {

    const {
        Producto,
        Descripcion,
        CodigoEan,
        Categoria,
        SubCategoria,
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

            imagenURL,

            URL,

            ProductosXTienda: []

        });

    }



    const productosXTiendaIds = [];



    // Crear / actualizar productos por tienda
    for (const tiendaData of Tiendas) {


        const {
            tienda,
            url,
            precio,
            precioSinDescuento,
            descuentoPorcentaje
        } = tiendaData;



        const precioNumero =
            parsePrecioAr(precio);



        const precioListaNumero =
            parsePrecioAr(precioSinDescuento);



        let productoXTienda =
            await ProductoXTiendaModel.findOne({

                producto: producto._id,

                tienda

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

                    tienda,

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
