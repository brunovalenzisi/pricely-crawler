import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export  async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("✅ Conectado a MongoDB");
    } catch (error) {
        console.error("❌ Error al conectar a MongoDB");
        console.error(error);
        process.exit(1);
    }
}

export async function connectDBNueva() {
    try {
        await mongoose.connect("mongodb://192.168.0.142:27017/GDHTEST");

        console.log("✅ Conectado a MongoDB");
    } catch (error) {
        console.error("❌ Error al conectar a MongoDB");
        console.error(error);
        process.exit(1);
    }
}