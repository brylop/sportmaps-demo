// Fotos de producto ILUSTRADAS para el catálogo del gemelo (no son capturas de la app:
// son los datos que la escuela cargaría). Se dibujan en SVG, Chromium las pasa a PNG
// 800×800 y se suben al bucket público product-images del GEMELO LOCAL.
//
//   node docs/manuales/_src/manual-tienda/imagenes.mjs
//
// Deja también los PNG en ./img/ (el de uniforme.png lo sube capture.mjs desde el
// asistente de producto, como haría la escuela).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const TWIN = 'http://127.0.0.1:54321';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const OUT = path.join(here, 'img');
fs.mkdirSync(OUT, { recursive: true });

const NAVY = '#1b2a4a', ORANGE = '#f26b1d', WHITE = '#ffffff';
const bg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
<defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#f7f8fa"/><stop offset="1" stop-color="#e3e7ee"/></radialGradient>
<filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-opacity=".18"/></filter></defs>
<rect width="800" height="800" fill="url(#g)"/>${inner}</svg>`;

const crest = (x, y, s = 1) => `<g transform="translate(${x},${y}) scale(${s})">
<path d="M0,-46 L40,-34 L40,6 C40,32 20,48 0,58 C-20,48 -40,32 -40,6 L-40,-34 Z" fill="${NAVY}" stroke="${ORANGE}" stroke-width="5"/>
<path d="M-26,0 C-14,-14 -4,-10 0,-2 C4,-10 14,-14 26,0 C14,-4 6,2 0,14 C-6,2 -14,-4 -26,0 Z" fill="${ORANGE}"/>
<circle cx="0" cy="-18" r="7" fill="${WHITE}"/></g>`;

const shirt = (color, trim, extra = '') => `<g filter="url(#s)">
<path d="M290,170 L350,150 C365,185 435,185 450,150 L510,170 L600,250 L555,320 L515,292 L515,640 L285,640 L285,292 L245,320 L200,250 Z" fill="${color}"/>
<path d="M350,150 C365,185 435,185 450,150" fill="none" stroke="${trim}" stroke-width="10"/>
<path d="M200,250 L245,320" stroke="${trim}" stroke-width="12"/><path d="M600,250 L555,320" stroke="${trim}" stroke-width="12"/>
<rect x="285" y="600" width="230" height="40" fill="${trim}" opacity=".9"/>${extra}</g>`;

const IMGS = {
  'escudo.png': bg(`<g filter="url(#s)">${crest(400, 360, 4.2)}</g>
    <text x="400" y="680" font-family="Arial Black, Arial" font-weight="900" font-size="64" fill="${NAVY}" text-anchor="middle" letter-spacing="6">CÓNDORES</text>`),
  'camiseta.png': bg(shirt(NAVY, ORANGE, crest(450, 270, .9))),
  'uniforme.png': bg(`<g transform="translate(-60,-40) scale(.9)">${shirt(WHITE, NAVY, `${crest(450, 270, .8)}
      <text x="400" y="470" font-family="Arial Black, Arial" font-weight="900" font-size="150" fill="${ORANGE}" text-anchor="middle">7</text>`)}</g>
    <g filter="url(#s)" transform="translate(470,430)">
      <path d="M0,0 L230,0 L250,250 L140,250 L115,110 L90,250 L-20,250 Z" fill="${NAVY}"/>
      <rect x="0" y="0" width="230" height="26" fill="${ORANGE}"/></g>`),
  'rodilleras.png': bg(`<g filter="url(#s)">
      <g transform="translate(270,400)"><rect x="-95" y="-200" width="190" height="400" rx="80" fill="#22262e"/>
        <ellipse cx="0" cy="-10" rx="72" ry="95" fill="#3a404b"/><rect x="-95" y="150" width="190" height="22" fill="${ORANGE}"/></g>
      <g transform="translate(530,400)"><rect x="-95" y="-200" width="190" height="400" rx="80" fill="#22262e"/>
        <ellipse cx="0" cy="-10" rx="72" ry="95" fill="#3a404b"/><rect x="-95" y="150" width="190" height="22" fill="${ORANGE}"/></g></g>`),
  'termo.png': bg(`<g filter="url(#s)">
      <rect x="320" y="110" width="160" height="70" rx="18" fill="#2b2f36"/>
      <rect x="300" y="170" width="200" height="500" rx="60" fill="${NAVY}"/>
      <rect x="300" y="560" width="200" height="22" fill="${ORANGE}"/>${crest(400, 360, 1.3)}</g>`),
};

async function upload(name, buf) {
  const res = await fetch(`${TWIN}/storage/v1/object/product-images/manual-tienda/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE, 'Content-Type': 'image/png', 'x-upsert': 'true' },
    body: buf,
  });
  if (!res.ok) throw new Error(`Subida ${name}: ${res.status} ${await res.text()}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
for (const [name, svg] of Object.entries(IMGS)) {
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: 800, height: 800 } });
  fs.writeFileSync(path.join(OUT, name), buf);
  if (name !== 'uniforme.png') await upload(name, buf);
  console.log('ok', name);
}
await browser.close();
