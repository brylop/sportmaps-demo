// Genera el PDF de la adaptación de Dreamers (Letter 816x1056 @96dpi).
// Uso: node docs/manuales/_src/dreamers-adaptacion/build.mjs
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright');

const SRC = path.join(HERE, 'dreamers-adaptacion.html');
const OUT_DIR = path.join(ROOT, 'docs/manuales/academias');
const OUT_PDF = path.join(OUT_DIR, 'dreamers-adaptacion-completa.pdf');
const OUT_HTML = path.join(OUT_DIR, 'dreamers-adaptacion-completa.html');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
await page.goto(pathToFileURL(SRC).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

// overflow:hidden recorta en silencio: avisar qué página desborda.
const res = await page.evaluate(() =>
  [...document.querySelectorAll('.page')].map((p, i) => {
    const foot = p.querySelector('.foot');
    const lastBottom = Math.max(...[...p.children].filter((c) => c !== foot).map((c) => c.getBoundingClientRect().bottom - p.getBoundingClientRect().top));
    return { pagina: i + 1, contenido_hasta: Math.round(lastBottom), tope: 986 };
  }),
);
let desborda = false;
for (const r of res) {
  const mal = r.pagina > 1 && r.contenido_hasta > r.tope;
  if (mal) desborda = true;
  console.log(`p${r.pagina}: contenido hasta ${r.contenido_hasta}px (tope ${r.tope})${mal ? '  <-- DESBORDA' : ''}`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
await page.pdf({ path: OUT_PDF, width: '816px', height: '1056px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
fs.copyFileSync(SRC, OUT_HTML);
await browser.close();

const pdf = fs.readFileSync(OUT_PDF, 'latin1');
const paginas = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
console.log(`PDF: ${OUT_PDF}\nPáginas: ${paginas} (esperadas 7) · ${(fs.statSync(OUT_PDF).size / 1024).toFixed(0)} KB${desborda ? ' · HAY DESBORDE' : ''}`);
