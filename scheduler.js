import cron from "node-cron";
import { ejecutarScraper } from "./scraperRunner.js";

let ejecutando = false;

async function correrScraper() {

    if (ejecutando) {
        console.log("Ya hay un scraper ejecutándose.");
        return;
    }

    ejecutando = true;

    console.log("================================");
    console.log("Iniciando scrape programado");
    console.log(new Date().toLocaleString());
    console.log("================================");

    try {

        await ejecutarScraper({
            environment: "prod",
            mode: "full",
        });

    } catch (err) {

        console.error(err);

    } finally {

        ejecutando = false;

    }

}

cron.schedule("52 17  * * *", correrScraper);

console.log("Scheduler iniciado");

