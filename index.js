import { CheerioCrawler, Sitemap, log ,Dataset} from "crawlee";
import {obtenerProducto,guardarProducto} from "./scraper.js";
import  connectDB  from "./database/mongoConection.js";

const crawler = new CheerioCrawler({
    minConcurrency: 10,
    maxConcurrency: 50,
    maxRequestRetries: 5,
    requestHandlerTimeoutSecs: 30,
   

    async requestHandler({ pushData, request, $ }) {
        const producto = obtenerProducto($, request);
        await guardarProducto(producto);
        await productDataset.pushData(producto);
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