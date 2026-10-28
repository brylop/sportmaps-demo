const lib = await import('../lib.mjs');
const OUT = process.argv[2]; const M = '03f916e1-5950-4da2-a5b5-c368ddb94407';
const browser = await lib.launch();
const { page, errors } = await lib.newSession(browser, 'gerencia@demo.sportmaps.co', { desktop: true });
const main = () => page.evaluate(() => document.querySelector('main').innerText.replace(/\n+/g,' | ').slice(0,1500));
await lib.go(page, `/partidos/${M}?paso=evaluar`, 6000);
await page.getByRole('button', { name: /^Tomás H/ }).click();
await lib.settle(page, 800);
const notas = { 'Actitud y compromiso': '5', 'Técnica': '4', 'Toma de decisiones': '4', 'Físico': '4', 'Comunicación': '3', 'Cumplimiento del rol': '5' };
for (const [m, v] of Object.entries(notas)) {
  await page.getByRole('radiogroup', { name: m, exact: true }).getByRole('radio', { name: v, exact: true }).click();
  await lib.settle(page, 200);
}
await page.getByPlaceholder('Escribe un comentario corto').fill('Dos goles y mucha entrega. Seguir trabajando la comunicación con la defensa.');
await lib.settle(page, 300);
// Compartir con las familias (ajuste de la escuela demo)
const sw = page.locator('label:has-text("Compartir con las familias") [role="switch"]');
if (await sw.count()) { await sw.click(); await lib.settle(page, 3000); }
await page.getByRole('button', { name: 'Guardar evaluación' }).click();
await lib.settle(page, 4000);
console.log('A>', await main());
const pub = page.getByRole('button', { name: 'Publicar a las familias' });
if (await pub.count()) { await pub.click(); await lib.settle(page, 4000); }
await page.screenshot({ path: `${OUT}/A6-evaluado.png`, fullPage: true });
console.log('B>', await main());
// Reporte
await lib.go(page, `/partidos/${M}?paso=reporte`, 4000);
await page.getByRole('button', { name: /Escribir el reporte|Ver o editar/ }).click();
await lib.settle(page, 1000);
await page.fill('#mr-summary', 'Ganamos 2-1 un partido muy disputado. Buen trabajo colectivo y gran segundo tiempo.');
await page.fill('#mr-development', 'Empezamos perdiendo por un error en salida. Ajustamos la presión, Tomás empató antes del descanso y marcó el 2-1 a los 60 minutos tras una buena jugada colectiva.');
await page.fill('#mr-improvements', 'Salida con balón bajo presión y comunicación en defensa. Lo trabajamos martes y jueves.');
await page.locator('#mr-publish').click();
await lib.settle(page, 300);
await page.screenshot({ path: `${OUT}/A7-reporte-dialogo.png` });
await page.getByRole('dialog').getByRole('button', { name: 'Guardar', exact: true }).click();
await lib.settle(page, 4000);
console.log('C>', await main());
console.log(errors.join('\n'));
await browser.close();
