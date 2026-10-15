// Genera docs/manuales/interno/guia-gemelo-docker-pruebas.pdf desde guia.html.
// Uso (desde la raíz del repo): node docs/manuales/_src/docker-gemelo/build.mjs
import { chromium } from 'playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = resolve(AQUI, '../../interno/guia-gemelo-docker-pruebas.pdf');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve(AQUI, 'guia.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({
    path: SALIDA,
    format: 'Letter',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;font:9px Inter,sans-serif;color:#8a968c;padding:0 60px;display:flex;justify-content:space-between">
        <span>SportMaps · Guía para desarrollo · Gemelo local en Docker</span>
        <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
    preferCSSPageSize: true,
});
await browser.close();
console.log(SALIDA);
