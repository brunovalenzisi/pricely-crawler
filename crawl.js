import fs from "fs/promises";
import * as cheerio from "cheerio";


async function obtenerUrls(paths) {

    const urls = [];

    for (const path of paths) {

        const xml = await fs.readFile(path, "utf8");

        const $ = cheerio.load(xml, {
            xmlMode: true
        });

        $("url > loc").each((i, el) => {
            urls.push({url:$(el).text().trim(),scraped:false});
        });

    }

    return urls;
}

async function updateDatasetpayload(urls){
    await fs.writeFile("./dataset/dataset.json",JSON.stringify(urls,null,2),"utf8");
}

async function loadDatasetPayload(){
    const datasetPayload = await fs.readFile("./dataset/dataset.json", "utf8");
    return JSON.parse(datasetPayload);
}

async function flushDataset(data,n) {
  await updateDatasetpayload(data);
  console.log(`Progreso guardado (${n} productos procesados).`);
}








export {
    obtenerUrls,
    updateDatasetpayload,
    loadDatasetPayload,
    flushDataset

};