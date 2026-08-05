import { CheerioCrawler, Sitemap, log, Dataset, RequestQueue } from "crawlee";
import { obtenerProducto, guardarProducto } from "./scraper.js";
import connectDB from "./database/mongoConection.js";

log.setLevel(log.LEVELS.DEBUG);

// node index.js --full
// node index.js -f
const args = process.argv.slice(2);
const FULL_SCRAPE = args.includes("--full") || args.includes("-f");

try {
    await connectDB();
} catch (error) {
    console.error(error);
    process.exit(1);
}

const requestQueue = await RequestQueue.open("pricely-queue");

if (FULL_SCRAPE) {
    log.info("Flag --full recibido -> vaciando la cola y arrancando de cero");
    await requestQueue.drop();
}

const finalQueue = await RequestQueue.open("pricely-queue");
const productDataset = await Dataset.open("products");

const crawler = new CheerioCrawler({
    requestQueue: finalQueue,
    minConcurrency: 1,
    maxConcurrency: 4,
    maxRequestsPerMinute: 120,
    requestHandlerTimeoutSecs: 30,
    maxRequestRetries: 10,

    autoscaledPoolOptions: {
        systemStatusOptions: {
            maxUsedCpuRatio: 0.75,
        },
    },

    async requestHandler({ request, $ }) {
        const producto = obtenerProducto($, request);
        await guardarProducto(producto);
        await productDataset.pushData(producto);
    },

    failedRequestHandler({ request }) {
        log.debug(`Request ${request.url} falló definitivamente.`);
    },
});

const info = await finalQueue.getInfo();
if (!info || info.totalRequestCount === 0) {
    const { urls } = await Sitemap.load([
        "https://pricely.ar/sitemap-products/0",
        "https://pricely.ar/sitemap-products/1",
    ]);
    log.info(`Encolando ${urls.length} productos`);
    await finalQueue.addRequests(urls.map((url) => ({ url })));
} else {
    log.info(`Retomando cola existente: ${info.pendingRequestCount} pendientes de ${info.totalRequestCount}`);
}

await crawler.run();