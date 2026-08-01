import mongoose from "mongoose";
 
const { Schema } = mongoose;
 
const tiendaSchema = new Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
  },

  nombreNormalizado: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true,
  },
 
  LogoURL: {
    type: String,
    default: "",
  },
 
  baseURL: {
    type: String,
    default: "",
  },
});
 
export default mongoose.model("Tienda", tiendaSchema, "tiendas");