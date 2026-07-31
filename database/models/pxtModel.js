import mongoose from "mongoose";

const { Schema } = mongoose;

const productoXTiendaSchema = new Schema({
  producto: {
    type: Schema.Types.ObjectId,
    ref: "Producto",
    required: true,
  },

  tienda: {
    type: String,
    required: true,
  },

  url: {
    type: String,
    default: "",
  },

  precio: {
    type: Number,
    required: true,
  },

  precioSinDescuento: {
    type: Number,
    default: null,
  },

  descuentoPorcentaje: {
    type: Number,
    default: null,
  },

  ultimaActualizacion: {
    type: Date,
    default: Date.now,
  },

  historicos: [
    {
      fecha: {
        type: Date,
        default: Date.now,
      },
      precio: {
        type: Number,
        required: true,
      }
    }
  ],
});

export default mongoose.model(
  "ProductoXTienda",
  productoXTiendaSchema,
  "productosXTienda"
);