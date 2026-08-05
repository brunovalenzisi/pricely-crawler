import { CheerioCrawler, Sitemap, log, Dataset } from "crawlee";
import { obtenerProducto, guardarProducto } from "./scraper.js";
import { connectDB } from "./database/mongoConection.js";

log.setLevel(log.LEVELS.DEBUG);

const args = process.argv.slice(2);
const IS_DEV = args.includes("-dev") || args.includes("--dev");

const mongoUri = IS_DEV
    ? process.env.MONGODB_URI_DEV
    : process.env.MONGODB_URI;

if (!mongoUri) {
    console.error(
        IS_DEV
            ? "❌ Falta MONGODB_URI_DEV en el .env"
            : "❌ Falta MONGODB_URI en el .env"
    );
    process.exit(1);
}

log.info(IS_DEV ? "🔧 Conectando a base de datos DEV" : "🚀 Conectando a base de datos PRODUCCIÓN");

try {
    await connectDB(mongoUri);
} catch (error) {
    console.error(error);
    process.exit(1);
}

const productDataset = await Dataset.open("products");

const crawler = new CheerioCrawler({
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

const requestQueue = await crawler.getRequestQueue();
const info = await requestQueue.getInfo();

if (!info || info.totalRequestCount === 0) {
    const { urls } = await Sitemap.load([
        "https://pricely.ar/sitemap-products/0",
        "https://pricely.ar/sitemap-products/1",
    ]);
    log.info(`Encolando ${urls.length} productos`);
    await crawler.addRequests(urls);
} else {
    log.info(`Retomando: ${info.pendingRequestCount} pendientes de ${info.totalRequestCount}`);
}

await crawler.run();