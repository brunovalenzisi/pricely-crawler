// mongoConection.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export async function connectDB(uri) {
    try {
        await mongoose.connect(uri);
        console.log(`✅ Conectado a MongoDB (${uri})`);
    } catch (error) {
        console.error("❌ Error al conectar a MongoDB");
        console.error(error);
        process.exit(1);
    }
}