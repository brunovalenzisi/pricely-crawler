import mongoose from "mongoose";
 
const { Schema } = mongoose;
 
const tiendaSchema = new Schema({
  nombre: {
    type: String,
    required: true,
    unique: true,
    trim: true,
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