import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url'; import { chromium, here } from './lib.mjs';
const [prefix, from, to, out] = process.argv.slice(2);
const files = fs.readdirSync(path.join(here, 'review')).filter(f => f.startsWith(prefix + '-')).sort().slice(+from, +to);
const html = '<body style="margin:0;background:#666;display:grid;grid-template-columns:repeat(4,1fr);gap:4px">' + files.map(f => `<div><div style="color:#fff;font:12px Arial">${f}</div><img style="width:100%" src="${pathToFileURL(path.join(here,'review',f)).href}"></div>`).join('') + '</body>';
fs.writeFileSync(path.join(here, 'm.html'), html);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
await p.goto(pathToFileURL(path.join(here, 'm.html')).href); await p.waitForTimeout(500);
await p.screenshot({ path: path.join(here, out), fullPage: true }); await b.close();
