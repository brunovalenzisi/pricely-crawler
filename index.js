import { CheerioCrawler, Sitemap, log ,Dataset} from "crawlee";
import {obtenerProducto,guardarProducto} from "./scraper.js";
import  connectDB  from "./database/mongoConection.js";

const crawler = new CheerioCrawler({
    minConcurrency: 1,
    maxConcurrency: 4,          // bajalo, probá con 2-4 primero
    maxRequestsPerMinute: 120,  // limita el ritmo real de requests
    requestHandlerTimeoutSecs: 30,
    maxRequestRetries: 10,

    autoscaledPoolOptions: {
        systemStatusOptions: {
            maxUsedCpuRatio: 0.75,   // más conservador que el default (0.95)
        },
        snapshotterOptions: {
            eventLoopSnapshotIntervalSecs: 0.5,
            osSnapshotIntervalSecs: 0.5,
        },
    },

    async requestHandler({ request, $ }) {
        try {
            const producto = obtenerProducto($, request);
            await guardarProducto(producto);
            await productDataset.pushData(producto);
        } catch (err) {
            log.error(`Error procesando ${request.url}: ${err.message}`);
            throw err; // dejá que Crawlee maneje el retry, pero logueado
        }
    },

    failedRequestHandler({ request }) {
        log.debug(`Request ${request.url} failed twice.`);
    },
});

log.setLevel(log.LEVELS.DEBUG);

const { urls } = await Sitemap.load([
    "https://pricely.ar/sitemap-products/0",
    "https://pricely.ar/sitemap-products/1",
]);

log.info(`Productos a scrapear: ${urls.length}`);

await crawler.addRequests(urls);
try {
  await connectDB();
  
} catch (error) {
  console.log(error)
}
const productDataset = await Dataset.open("products");
await crawler.run();