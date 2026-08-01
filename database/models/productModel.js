import mongoose from "mongoose";

const { Schema } = mongoose;

const productSchema = new Schema({
  Producto: {
    type: String,
    required: true,
  },

  Descripcion: {
    type: String,
    default: "",
  },

  CodigoEan: {
    type: String,
    default: "",
  },

  Categoria: {
    type: String,
    default: "",
  },

  SubCategoria: {
    type: String,
    default: "",
  },

tags:{ type: [String], default: [] },


  Marca: {
    type: String,
    default: "",
  },

  URL: {
    type: String,
    default: "",
  },

  imagenURL: {
    type: String,
    default: "",
  },

  ProductosXTienda: [
    {
      type: Schema.Types.ObjectId,
      ref: "ProductoXTienda",
    },
  ],
});

export default mongoose.model("Producto", productSchema, "productos");