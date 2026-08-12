import cron from "node-cron";
import fs from "fs/promises";
import { ejecutarScraper } from "./scraperRunner.js";

let ejecutando = false;

const LOG_FILE = "./scraper.log";

async function escribirLog(mensaje) {
    const fecha = new Date().toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
    });

    await fs.appendFile(
        LOG_FILE,
        `[${fecha}] ${mensaje}\n`,
        "utf8"
    );
}

async function correrScraper() {

    if (ejecutando) {
        console.log("Ya hay un scraper ejecutándose.");
        await escribirLog("SCRAPER NO INICIADO: ya hay una ejecución en curso.");
        return;
    }

    ejecutando = true;

    const inicio = Date.now();

    console.log("================================");
    console.log("Iniciando scrape programado");
    console.log(new Date().toLocaleString());
    console.log("================================");

    await escribirLog("================================");
    await escribirLog("INICIO SCRAPE PROGRAMADO");

    try {

        await ejecutarScraper({
            environment: "prod",
            mode: "full",
        });

        const duracion = Date.now() - inicio;
        const segundos = Math.round(duracion / 1000);

        console.log(`Scrape finalizado correctamente. Duración: ${segundos}s`);

        await escribirLog(
            `FIN SCRAPE - OK - Duración: ${segundos}s`
        );

    } catch (err) {

        const duracion = Date.now() - inicio;
        const segundos = Math.round(duracion / 1000);

        console.error("Error durante el scrape:", err);

        await escribirLog(
            `FIN SCRAPE - ERROR - Duración: ${segundos}s - ${err.message}`
        );

    } finally {

        ejecutando = false;

    }
}

cron.schedule("33 17 * * *", correrScraper);

console.log("Scheduler iniciado");
escribirLog("SCHEDULER INICIADO");
