import fs from "fs/promises";
import { PlaywrightCrawler, Dataset } from 'crawlee';
import { updateDatasetpayload, obtenerUrls, loadDatasetPayload,flushDataset} from "./crawl.js";
import * as cheerio from 'cheerio';

const freshStart = process.argv[2]; // ej: node main.js --fresh
let processed = 0;

const pathsFuente = [
  "./sourceLinks/pack0.xml",
  "./sourceLinks/pack1.xml",
  "./sourceLinks/pack2.xml",
];

if (freshStart) {
  const urls = await obtenerUrls(pathsFuente);
  await updateDatasetpayload(urls);
  process.env.CRAWLEE_PURGE_ON_START = "0";
}


const datasetPayload = await loadDatasetPayload();
const dataset = await Dataset.open("productos");

console.log(`URLs a crawlear: ${datasetPayload.length}`);
console.log('Primeras 3:', datasetPayload.slice(0, 3));

if (datasetPayload.length === 0) {
  console.warn(
    'ATENCION: dataset.json esta vacio. Revisa que ./sourceLinks/pack*.xml existan y tengan <url><loc>...</loc></url>.'
  );
}

const requestsList = datasetPayload
    .filter(item => !item.scraped)
    .map(item => ({
        url: item.url
    }));


    

/**
 * Convierte un texto de precio con formato argentino ("$ 9.200,00", con
 * &nbsp; y spans anidados para los centavos) a un número JS.
 */
function parsePriceText(text) {
  if (!text) return null;
  const cleaned = text.replace(/[\s\u00a0$]/g, '');
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const value = parseFloat(normalized);
  return Number.isNaN(value) ? null : value;
}

/**
 * Extrae { tiendas, precio } del bloque "Precios por supermercado" (#precios).
 * Cada tienda incluye su propio precio. El "precio" del producto es el
 * mínimo entre todas las tiendas.
 */
function extractTiendasYPrecio($) {
  const tiendas = [];

  $('#precios a').each((_, el) => {
    const $el = $(el);
    const url = $el.attr('href') || '';
    const tienda = $el.find('img').attr('alt') || '';
    // El precio vigente es el primer span.font-number que NO tiene line-through
    // (el segundo, si existe, es el precio de lista tachado).
    const priceSpan = $el.find('span.font-number').not('.line-through').first();
    const precioTienda = priceSpan.length ? parsePriceText(priceSpan.text()) : null;

    tiendas.push({
      tienda,
      url,
      precio: precioTienda !== null ? precioTienda : "",
    });
  });

  const preciosValidos = tiendas
    .map((t) => t.precio)
    .filter((p) => p !== "" && p !== null);

  const precio = preciosValidos.length ? Math.min(...preciosValidos) : "";

  return { tiendas, precio };
}

/**
 * Extrae { categoria, subcategoria } del breadcrumb real de la página
 * (<nav aria-label="Breadcrumb">), excluyendo "Inicio" y el nombre del
 * producto (último ítem, sin link).
 */
function extractCategorias($, titulo) {
  const tituloNormalizado = (titulo || '').trim().toLowerCase();

  const items = [];
  $('nav[aria-label="Breadcrumb"] ol > li').each((_, el) => {
    const text = $(el).find('a, span').first().text().trim();
    items.push(text);
  });

  const filtrados = items.filter((name) => {
    if (!name) return false;
    const normalizado = name.toLowerCase();
    if (normalizado === 'inicio') return false;
    if (tituloNormalizado && normalizado === tituloNormalizado) return false;
    return true;
  });

  return {
    categoria: filtrados[0] || "",
    subcategoria: filtrados[1] || "",
  };
}

const crawler = new PlaywrightCrawler({
  requestHandlerTimeoutSecs: 90,
  

  async requestHandler({ request, page, log, response }) {
    try {
      const status = response?.status();

      if (status === 404) {
        log.warning(`404 - producto no encontrado: ${request.url}`);
        await dataset.pushData({
  url: request.url,
  error: 'not_found'
});
        return;
      }

      // #precios no es HTML estático: Next.js arma esta sección con streaming
      // de React Server Components, y el bloque solo llega al navegador
      // cuando el backend de Pricely termina de chequear el precio vigente
      // contra cada supermercado. Esa consulta puede demorar (varía según el
      // supermercado), así que hay que darle tiempo real de red/servidor, no
      // un "empujón" del lado del cliente (scroll no tiene ningún efecto acá).
      try {
        await page.waitForSelector('#precios a', { timeout: 30000 });
      } catch {
        log.warning(`#precios no llegó en 30s para ${request.url}, recargando e intentando una vez más...`);
        try {
          await page.reload({ waitUntil: 'load', timeout: 30000 });
          await page.waitForSelector('#precios a', { timeout: 30000 });
        } catch {
          log.warning(`#precios no llegó tras recargar en ${request.url} (puede que el producto no tenga tiendas, o el backend de Pricely siga demorado)`);
        }
      }

      const html = await page.content();
      const $ = cheerio.load(html);

      let titulo = "";
      let descripcion = "";
      let codigoEan = "";
      let urlImagen = "";

      const schemaRaw = $('script#schema').html();
      if (schemaRaw) {
        try {
          const product = JSON.parse(schemaRaw);
          titulo = product.name || "";
          descripcion = product.description || "";
          codigoEan = product.gtin13 !== undefined ? String(product.gtin13) : "";
          urlImagen = product.image || "";
        } catch {
          log.warning(`No se pudo parsear script#schema en ${request.url}`);
        }
      } else {
        log.warning(`No se encontro script#schema en ${request.url}`);
      }

      const { tiendas, precio } = extractTiendasYPrecio($);
      const { categoria, subcategoria } = extractCategorias($, titulo);

      await dataset.pushData({
        url: request.url,
        titulo,
        precio,
        descripcion,
        codigoEan,
        urlImagen,
        tiendas,
        categoria,
        subcategoria,
      });
    const item = datasetPayload.find(p => p.url === request.url);

      if (item) {
    item.scraped = true;
      }
      processed++;

      if (processed % 20 === 0) {
          await flushDataset(datasetPayload,processed);
        }



    } catch (err) {
      log.error(`Error procesando ${request.url}: ${err.message}`);
      await dataset.pushData({ url: request.url, error: err.message });
    }
  },

  // maxRequestsPerCrawl: 50,
});

await crawler.run(requestsList);