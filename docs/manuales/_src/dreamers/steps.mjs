const openBooking = async ({ page, go, sleep }) => { await go(page, '/enrollments', 'Banco de horas');
  await page.getByText('TOCA PARA GESTIONAR CLASES').first().click(); await sleep(2500); };
export default {
  parent: [
    ['p01', async ({ page, go, shot }) => { await go(page, '/dashboard', 'Acciones Rápidas'); await shot(); }],
    ['p02', async ({ page, go, shot }) => { await go(page, '/enrollments', 'Banco de horas'); await shot(); }],
    ['p02b', async ({ page, go, shot, sleep }) => { await go(page, '/enrollments', 'Banco de horas');
      const card = page.getByText('Banco de horas').first().locator('xpath=ancestor::div[contains(@class,"border")][1]'); await card.scrollIntoViewIfNeeded(); await sleep(800); await shot(card); }],
    ['p03', async (c) => { await openBooking(c); await c.shot(c.dialog()); }],
    ['p04', async (c) => { await openBooking(c); await c.page.getByText('POR BLOQUE', { exact: false }).first().click(); await c.sleep(3000); await c.shot(c.dialog()); }],
    ['p05', async (c) => { await openBooking(c); const { page, sleep } = c; await page.getByText('POR BLOQUE', { exact: false }).first().click(); await sleep(3000);
      await c.dialog().getByRole('button', { name: /^16/ }).first().click().catch(async () => { await c.dialog().locator('button:has-text("16")').first().click(); }); await sleep(3000); await c.shot(c.dialog()); }],
    ['p07', async ({ page, go, shot }) => { await go(page, '/my-payments', 'Mis Pagos'); await shot(); }],
    ['p08', async ({ page, go, shot, dialog, sleep }) => { await go(page, '/my-payments', 'Mis Pagos');
      await page.getByRole('button', { name: /pagar/i }).first().click(); await sleep(3000); await shot(dialog()); }],
    ['p06', async (c) => { await openBooking(c); const { page, sleep } = c; await page.getByText('POR BLOQUE', { exact: false }).first().click(); await sleep(3000);
      await c.dialog().locator('button:has-text("16")').first().click(); await sleep(3000);
      await c.dialog().getByRole('button', { name: /agendar/i }).first().click(); await sleep(3500); await c.shot(c.dialog().count().then(n => n) && page.locator('[role="dialog"]').last()).catch(async () => c.shot()); }],
    ['p06b', async ({ page, go, shot, sleep }) => { await go(page, '/enrollments', 'Banco de horas'); await page.getByText('Mis Reservas').first().click(); await sleep(3000); await shot(); }],
    ['p06c', async (c) => { await openBooking(c); const { page, sleep } = c; await page.getByText('POR BLOQUE', { exact: false }).first().click(); await sleep(3000);
      await c.dialog().locator('button:has-text("16")').first().click(); await sleep(3000);
      await c.dialog().getByRole('button', { name: /agendar/i }).first().click(); await sleep(2500);
      await page.getByRole('button', { name: /^Confirmar$/ }).last().click(); await sleep(4000); await c.shot(); }],
    ['p09', async ({ page, go, shot, dialog, sleep }) => { await page.setViewportSize({ width: 1600, height: 2100 }); await go(page, '/my-payments', 'Mis Pagos');
      await page.getByRole('button', { name: /pagar/i }).first().click(); await sleep(3000);
      await dialog().locator('input[type=file]').setInputFiles('comprobante-ejemplo.png'); await sleep(2500); await shot(dialog()); }],
    ['p10', async ({ page, go, shot, dialog, sleep }) => { await page.setViewportSize({ width: 1600, height: 1000 }); await go(page, '/my-payments', 'Mis Pagos');
      await page.getByRole('button', { name: /pagar/i }).first().click(); await sleep(3000);
      await dialog().locator('input[type=file]').setInputFiles('comprobante-ejemplo.png'); await sleep(2000);
      await dialog().getByRole('button', { name: /^Pagar/ }).click(); await sleep(5000); await shot(); }],
    ['p06d', async ({ page, go, shot, sleep }) => { await go(page, '/enrollments', 'Banco de horas'); await sleep(1500);
      const c = page.getByText('CLASES PROGRAMADAS', { exact: false }).first().locator('xpath=ancestor::div[contains(@class,"rounded")][1]'); await shot(c); }],
    ['p11', async ({ page, go, shot, sleep }) => { await go(page, '/my-payments', 'Mis Pagos'); await shot(); }],
    ['p12', async ({ page, go, shot, dialog, sleep }) => { await page.setViewportSize({ width: 1600, height: 1400 }); await go(page, '/my-payments', 'Mis Pagos');
      await page.getByRole('button', { name: /Nuevo Pago/i }).click(); await sleep(3000); await shot(dialog()); await page.setViewportSize({ width: 1600, height: 1000 }); }],
    ['p13', async ({ page, go, shot, sleep }) => { await go(page, '/my-payments', 'Mis Pagos');
      await page.getByText('Estado de cuenta — Sara').click(); await sleep(4000); await shot(); }],
    ['p14', async ({ page, go, shot }) => { await go(page, '/children', 'Gómez'); await shot(); }],
    ['p15', async ({ page, go, shot }) => { await go(page, '/calendar', 'Calendario'); await shot(); }],
    ['p16', async ({ page, go, shot, sleep }) => { await go(page, '/parent-attendance', 'Asistencia');
      await page.getByText('Elegir deportista').click(); await sleep(800); await page.getByRole('option').filter({ hasText: 'Valentina' }).first().click().catch(() => page.getByText('Valentina Gómez').last().click()); await sleep(3500); await shot(); }],
    ['p18', async ({ page, go, shot, sleep }) => { await go(page, '/children', 'Gómez'); await page.getByText('Valentina Gómez').first().click(); await sleep(4000); await shot(); }],
    ['p17', async ({ page, go, shot }) => { await go(page, '/my-cards', 'Carnet'); await shot(); }],
  ],
  owner: [
    ['o01', async ({ page, go, shot }) => { await go(page, '/dashboard', 'Dreamers'); await page.waitForTimeout(4000); await shot(); }],
    ['o02', async ({ page, go, shot }) => { await go(page, '/students', 'Atletas'); await shot(); }],
    ['o03', async ({ page, go, shot, dialog, sleep }) => { await page.setViewportSize({ width: 1600, height: 1500 }); await go(page, '/students', 'Atletas');
      await page.getByRole('button', { name: /Agregar Atleta/i }).click(); await sleep(2500); await shot(dialog()); }],
    ['o04', async ({ page, go, shot }) => { await page.setViewportSize({ width: 1600, height: 1000 }); await go(page, '/offerings', 'Mis Planes'); await shot(); }],
    ['o05', async ({ page, go, shot, dialog, sleep }) => { await go(page, '/offerings', 'Mis Planes'); await page.getByRole('button', { name: /Inscripción y seguro/i }).click(); await sleep(2500); await shot(dialog()); }],
    ['o06', async ({ page, go, shot }) => { await go(page, '/payments-automation', 'Cobros por Aprobar'); await page.waitForTimeout(3000); await shot(); }],
    ['o08', async ({ page, go, shot, dialog, sleep }) => { await go(page, '/payments-automation', 'Cobros por Aprobar'); await page.getByRole('button', { name: /Registrar pago/i }).click(); await sleep(2500); await shot(dialog()); }],
    ['o09', async ({ page, go, shot, sleep }) => { await go(page, '/payments-automation', 'Cobros por Aprobar'); await page.getByRole('tab', { name: 'Equipos y Planes' }).click(); await sleep(3500); await shot(); }],
    ['o10', async ({ page, go, shot, sleep }) => { await go(page, '/payments-automation', 'Cobros por Aprobar'); await page.getByRole('tab', { name: 'Cierre' }).click(); await sleep(3500); await shot(); }],
    ['o11', async ({ page, go, shot, sleep }) => { await page.setViewportSize({ width: 1600, height: 2600 }); await go(page, '/payments-automation', 'Cobros por Aprobar'); await page.getByRole('tab', { name: 'Config' }).click(); await sleep(3500); await shot('full'); }],
    ['o12', async ({ page, go, shot, sleep }) => { await go(page, '/payments-automation', 'Cobros por Aprobar'); await page.getByRole('tab', { name: 'Glosas' }).click(); await sleep(3500); await shot(); }],
    ['o13', async ({ page, go, shot }) => { await go(page, '/school/access-control', 'Control de Acceso'); await shot(); }],
    ['o14', async ({ page, go, shot, dialog, sleep }) => { await go(page, '/school/access-control', 'Control de Acceso'); await page.getByRole('button', { name: /Vencidos/ }).click(); await sleep(2500); await shot(dialog()); }],
    ['o15', async ({ page, go, shot, dialog, sleep }) => { await page.setViewportSize({ width: 1600, height: 1600 }); await go(page, '/school/access-control', 'Control de Acceso'); await page.getByRole('button', { name: /Configurar/ }).click(); await sleep(2500); await shot(dialog()); await page.setViewportSize({ width: 1600, height: 1000 }); }],
    ['o16', async ({ page, go, shot, sleep }) => { await go(page, '/recepcion', 'Modo Recepción'); await page.getByRole('button', { name: /Activar recepción/ }).click(); await sleep(3000); await shot(); }],
    ['o17', async ({ page, go, shot }) => { await go(page, '/attendance-supervision', 'Supervisi'); await shot(); }],
    ['o18', async ({ page, go, shot }) => { await go(page, '/informe-mensual', 'Informe'); await shot(); }],
    ['o03b', async ({ page, go, shot, dialog, sleep }) => { await page.setViewportSize({ width: 1600, height: 2200 }); await go(page, '/students', 'Atletas');
      await page.getByRole('button', { name: /Agregar Atleta/i }).click(); await sleep(2000); await page.getByText('Menor de Edad').click(); await sleep(2500); await shot(dialog()); await page.setViewportSize({ width: 1600, height: 1000 }); }],
    ['o07', async ({ page, go, shot, sleep }) => { await go(page, '/payments-automation', 'Cobros por Aprobar'); await sleep(2000);
      const row = page.locator('tr', { hasText: 'Isabella' }).first(); await shot(row); }],
    ['o07b', async ({ page, go, shot, dialog, sleep }) => { await page.setViewportSize({ width: 1600, height: 1500 }); await go(page, '/payments-automation', 'Cobros por Aprobar'); await sleep(2000);
      const row = page.locator('tr', { hasText: 'Isabella' }).first(); await row.getByRole('button', { name: /Aprobar/i }).click(); await sleep(2500); await shot(dialog()); await page.setViewportSize({ width: 1600, height: 1000 }); }],
    ['o19', async ({ page, go, shot, sleep }) => { await page.setViewportSize({ width: 1600, height: 2400 }); await go(page, '/students', 'Atletas'); await page.locator('tr', { hasText: 'Sara Gómez' }).getByText('Ver', { exact: true }).click(); await sleep(4000); await shot(page.locator('[role="dialog"]').last()); await page.setViewportSize({ width: 1600, height: 1000 }); }],
    ['o07c', async ({ page, go, shot, dialog, sleep }) => { await go(page, '/payments-automation', 'Cobros por Aprobar'); await sleep(2000);
      const row = page.locator('tr', { hasText: 'Isabella' }).first(); await row.getByRole('button', { name: /Aprobar/i }).click(); await sleep(2500);
      await dialog().getByRole('checkbox').first().click().catch(() => {}); await sleep(500); await dialog().getByRole('button', { name: /928/ }).click(); await sleep(4000); await shot(); }],
    ['o11a', async ({ page, go, shot, sleep }) => { await page.setViewportSize({ width: 1600, height: 2600 }); await go(page, '/payments-automation', 'Cobros por Aprobar'); await page.getByRole('tab', { name: 'Config' }).click(); await sleep(3500);
      const c = page.getByText('Reglas de Cobro', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"rounded")][1]'); await shot(c); await page.setViewportSize({ width: 1600, height: 1000 }); }],
    ['o11b', async ({ page, go, shot, sleep }) => { await page.setViewportSize({ width: 1600, height: 2600 }); await go(page, '/payments-automation', 'Cobros por Aprobar'); await page.getByRole('tab', { name: 'Config' }).click(); await sleep(3500);
      const c = page.getByText('Mora y Penalización', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"rounded")][1]'); await shot(c); await page.setViewportSize({ width: 1600, height: 1000 }); }],
    ['o11c', async ({ page, go, shot, sleep }) => { await page.setViewportSize({ width: 1600, height: 2600 }); await go(page, '/payments-automation', 'Cobros por Aprobar'); await page.getByRole('tab', { name: 'Config' }).click(); await sleep(3500);
      const c = page.getByText('Recordatorios', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"rounded")][1]'); await shot(c); await page.setViewportSize({ width: 1600, height: 1000 }); }],
  ],
};
