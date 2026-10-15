// Comprobante FICTICIO para la prueba de subida en el gemelo (no es un recibo real).
import { chromium } from './lib.mjs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 640 } });
await p.setContent(`<body style="margin:0;font-family:Arial;background:#fff"><div style="background:#fdda24;padding:18px;font-weight:bold;font-size:20px">Transferencia exitosa</div>
<div style="padding:22px;font-size:15px;line-height:2"><div>Valor: <b>$ 928.200</b></div><div>Para: Dreamers Gymnastics</div><div>Llave Bre-B: 0067173591</div><div>Fecha: 14 oct 2026 · 10:42 a. m.</div><div>Referencia: M123456789</div><div style="color:#888;font-size:12px;margin-top:30px">EJEMPLO PARA MANUAL — NO VÁLIDO</div></div></body>`);
await p.screenshot({ path: 'comprobante-ejemplo.png' }); await b.close();
