import { CheerioCrawler, Sitemap, log, Dataset, RequestQueue, Configuration } from "crawlee";
import { obtenerProducto, guardarProducto } from "./scraper.js";
import { connectDB } from "./database/mongoConection.js";

log.setLevel(log.LEVELS.DEBUG);
Configuration.getGlobalConfig().set("maxUsedCpuRatio", 0.75);

// --- Parseo de argumentos ---
const args = process.argv.slice(2);

const IS_DEV = args.includes("-dev");
const IS_FULL = args.includes("--full");
const IS_RESUME = args.includes("--resume");

if (IS_FULL && IS_RESUME) {
    console.error("❌ No podés pasar --full y --resume juntos. Elegí uno.");
    process.exit(1);
}

if (!IS_FULL && !IS_RESUME) {
    console.error("❌ Tenés que indicar el modo: --full o --resume");
    process.exit(1);
}

const entorno = IS_DEV ? "dev" : "prod";
const nombreCola = `pricely-queue-${entorno}`;

// --- Conexión a la base de datos correspondiente ---
const mongoUri = IS_DEV
    ? process.env.MONGODB_URI_DEV
    : process.env.MONGODB_URI;

if (!mongoUri) {
    console.error(
        IS_DEV ? "❌ Falta MONGODB_URI_DEV en el .env" : "❌ Falta MONGODB_URI en el .env"
    );
    process.exit(1);
}

log.info(`🔧 Entorno: ${entorno.toUpperCase()}`);
log.info(`🔧 Modo: ${IS_FULL ? "FULL SCRAPE" : "RESUME"}`);

try {
    await connectDB(mongoUri);
} catch (error) {
    console.error(error);
    process.exit(1);
}

// --- Manejo de la cola según el modo ---
let requestQueue = await RequestQueue.open(nombreCola);

if (IS_FULL) {
    log.info(`🗑️  Vaciando cola "${nombreCola}" (full scrape)`);
    await requestQueue.drop();
    requestQueue = await RequestQueue.open(nombreCola);
}

const productDataset = await Dataset.open(`products-${entorno}`);

const crawler = new CheerioCrawler({
    requestQueue,
    minConcurrency: 1,
    maxConcurrency: 6,
    maxRequestsPerMinute: 120,
    requestHandlerTimeoutSecs: 30,
    maxRequestRetries: 5,
    // ya no va autoscaledPoolOptions.systemStatusOptions.maxUsedCpuRatio
    async requestHandler({ request, $ }) {
        const producto = obtenerProducto($, request);
        await guardarProducto(producto);
        await productDataset.pushData(producto);
    },
    failedRequestHandler({ request }) {
        log.debug(`Request ${request.url} falló definitivamente.`);
    },
});

// Solo cargamos el sitemap si la cola está vacía
// (sea porque es full scrape recién limpiada, o porque nunca se corrió)
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