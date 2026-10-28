// Inicio de la familia del código DESPUÉS de que la escuela asignó la categoría.
import * as lib from '../lib.mjs';
const OUT = process.argv[2];
const browser = await lib.launch();
const { page, errors } = await lib.newSession(browser, 'familia.sincodigo@demo.sportmaps.co');
const t0 = Date.now();
await page.goto(lib.BASE_URL + '/dashboard');
await page.getByText(/Club Campestre Demo|Todo al día|cobro/).first().waitFor({ timeout: 45000 }).catch(() => {});
console.log('carga ms', Date.now() - t0);
await lib.settle(page, 2000);
await page.screenshot({ path: `${OUT}/38d-inicio-con-escuela.png` });
console.log((await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ').slice(0, 700));
console.log(errors.join(' ## '));
await browser.close();
