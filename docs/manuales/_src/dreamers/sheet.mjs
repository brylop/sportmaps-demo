// Hoja de contacto para revisar capturas rápido (no va al manual).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, here } from './lib.mjs';

const ids = process.argv.slice(2);
const cell = (id) => `<div style="background:#fff"><div style="font:bold 20px Arial">${id}</div><img src="${pathToFileURL(path.join(here, 'shots', id + '.png')).href}" style="width:100%"></div>`;
const html = '<body style="margin:0;display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#999">' + ids.map(cell).join('') + '</body>';
const file = path.join(here, 'sheet.html');
fs.writeFileSync(file, html);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto(pathToFileURL(file).href);
await p.waitForTimeout(800);
await p.screenshot({ path: path.join(here, 'sheet.png'), fullPage: true });
await b.close();
