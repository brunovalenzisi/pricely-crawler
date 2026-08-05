import fs from "fs/promises";


const JSON_VIEJO = "./GDH.productostest.json";
const JSON_NUEVO = "./GDH-TEST.productosNueva.json";

const JSON_SALIDA = "./GDH.productosMigrados.json";



async function migrar() {

  console.log("📂 Leyendo archivos...");


  const productosViejos = JSON.parse(
    await fs.readFile(JSON_VIEJO, "utf-8")
  );


  const productosNuevos = JSON.parse(
    await fs.readFile(JSON_NUEVO, "utf-8")
  );


  console.log(
    "Productos viejos:",
    productosViejos.length
  );

  console.log(
    "Productos nuevos:",
    productosNuevos.length
  );



  // Índice por EAN de la colección nueva

  console.log("🗂️ Creando índice...");

  const mapaNuevos = new Map();


  for (const producto of productosNuevos) {

    if (producto.CodigoEan) {

      mapaNuevos.set(
        producto.CodigoEan,
        producto
      );

    }

  }



  let actualizados = 0;
  let agregados = 0;
  let sinEan = 0;



  // Usamos un Set para saber qué EANes ya existen
  const eansProcesados = new Set();



  const productosFinales = productosViejos.map(
    productoViejo => {


      const productoNuevo =
        mapaNuevos.get(
          productoViejo.CodigoEan
        );


      if (!productoNuevo) {

        return quitarTienda(productoViejo);

      }


      eansProcesados.add(
        productoNuevo.CodigoEan
      );


      actualizados++;


      return quitarTienda({

        ...productoViejo,

        Producto:
          productoNuevo.Producto,

        Descripcion:
          productoNuevo.Descripcion,

        Categoria:
          productoNuevo.Categoria,

        SubCategoria:
          productoNuevo.SubCategoria,

        tags:
          productoNuevo.tags,

        Marca:
          productoNuevo.Marca,

        URL:
          productoNuevo.URL,

        imagenURL:
          productoNuevo.imagenURL,

        ProductosXTienda:
          productoNuevo.ProductosXTienda

      });


    }
  );



  // Agregar productos nuevos que no estaban en producción

  for (const productoNuevo of productosNuevos) {


    if (!productoNuevo.CodigoEan) {

      sinEan++;

      continue;

    }


    if (!eansProcesados.has(productoNuevo.CodigoEan)) {


      productosFinales.push(
        quitarTienda(productoNuevo)
      );


      agregados++;

    }

  }



  console.log("\n------ RESULTADO ------");

  console.log(
    "Actualizados:",
    actualizados
  );

  console.log(
    "Agregados:",
    agregados
  );

  console.log(
    "Sin EAN:",
    sinEan
  );



  await fs.writeFile(
    JSON_SALIDA,
    JSON.stringify(
      productosFinales,
      null,
      2
    )
  );


  console.log(
    "✅ Archivo generado:",
    JSON_SALIDA
  );

}



// elimina Tienda de cualquier documento
function quitarTienda(producto) {

  const {
    Tienda,
    ...resto
  } = producto;


  return resto;

}



migrar();