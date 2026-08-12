import {
    CheerioCrawler,
    Sitemap,
    log,
    Dataset,
    RequestQueue,
    Configuration,
} from "crawlee";

import { obtenerProducto, guardarProducto } from "./scraper.js";
import { connectDB } from "./database/mongoConection.js";

Configuration.getGlobalConfig().set("maxUsedCpuRatio", 0.75);
log.setLevel(log.LEVELS.DEBUG);

export async function ejecutarScraper({
    environment = "prod",
    mode = "resume",
} = {}) {

    const IS_DEV = environment === "dev";
    const IS_FULL = mode === "full";
    const IS_RESUME = mode === "resume";

    if (!IS_FULL && !IS_RESUME) {
        throw new Error(`Modo inválido: ${mode}`);
    }

    const nombreCola = `pricely-queue-${environment}`;

    const mongoUri = IS_DEV
        ? process.env.MONGODB_URI_DEV
        : process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error(
            IS_DEV
                ? "Falta MONGODB_URI_DEV"
                : "Falta MONGODB_URI"
        );
    }

    log.info(`🔧 Entorno: ${environment.toUpperCase()}`);
    log.info(`🔧 Modo: ${mode.toUpperCase()}`);

    await connectDB(mongoUri);

    let requestQueue = await RequestQueue.open(nombreCola);

    if (IS_FULL) {
        log.info(`🗑️ Vaciando cola "${nombreCola}"`);
        await requestQueue.drop();
        requestQueue = await RequestQueue.open(nombreCola);
    }

    const productDataset = await Dataset.open(`products-${environment}`);

    const crawler = new CheerioCrawler({
        requestQueue,
        minConcurrency: 1,
        maxConcurrency: 4,
        maxRequestsPerMinute: 240,
        requestHandlerTimeoutSecs: 30,
        maxRequestRetries: 5,

        async requestHandler({ request, $ }) {
            const producto = obtenerProducto($, request);

            await guardarProducto(producto);

            await productDataset.pushData(producto);
        },

        failedRequestHandler({ request }) {
            log.warning(`Falló definitivamente ${request.url}`);
        },
    });

    const info = await requestQueue.getInfo();

    if (!info || info.totalRequestCount === 0) {

        const { urls } = await Sitemap.load([
            "https://pricely.ar/sitemap-products/0",
            "https://pricely.ar/sitemap-products/1",
            "https://pricely.ar/sitemap-products/2",
            "https://pricely.ar/sitemap-products/3",
        ]);

        log.info(`Encolando ${urls.length} productos`);

        await crawler.addRequests(urls);

    } else {

        log.info(
            `Retomando ${info.pendingRequestCount} pendientes de ${info.totalRequestCount}`
        );

    }

    await crawler.run();

    log.info("✅ Scraper finalizado");
}