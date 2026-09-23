import { test, expect, Page, ConsoleMessage } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// QA exploratorio — rol OWNER / GERENCIA de escuela (Club Campestre Demo).
// Objetivo: descubrir bugs, NO arreglarlos. No se ejecutan acciones irreversibles
// (bajas reales, cierres de mes, invitaciones reales) — se navega hasta el punto
// de confirmación y se cancela / no se envía.

const SHOT_DIR = path.join(__dirname, 'screenshots', 'owner');
const LOG_PATH = path.join(__dirname, 'screenshots', 'owner', '_findings-log.json');

const EMAIL = 'gerencia@demo.sportmaps.co';
const PASSWORD = 'Demo2026!';

type NetErr = { url: string; status: number; route: string };
type ConsErr = { text: string; route: string };

const netErrors: NetErr[] = [];
const consErrors: ConsErr[] = [];
let currentRoute = '(pre-nav)';

async function shot(page: Page, name: string) {
    const safe = name.replace(/[^a-z0-9-_]/gi, '_');
    await page.screenshot({ path: path.join(SHOT_DIR, `${safe}.png`), fullPage: true }).catch(() => {});
}

async function visit(page: Page, route: string, label: string) {
    currentRoute = route;
    try {
        await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1800); // deja asentar queries async / loaders
        await shot(page, label);
        return true;
    } catch (e) {
        console.log(`[VISIT-FAIL] ${route}: ${(e as Error).message}`);
        await shot(page, `${label}__FAIL`);
        return false;
    }
}

test.setTimeout(20 * 60 * 1000);

test('QA exploratorio — owner/gerencia recorre todos los módulos', async ({ page }) => {
    page.on('console', (msg: ConsoleMessage) => {
        if (msg.type() === 'error') {
            consErrors.push({ text: msg.text().slice(0, 500), route: currentRoute });
        }
    });
    page.on('response', (res) => {
        const status = res.status();
        if (status >= 400) {
            netErrors.push({ url: res.url(), status, route: currentRoute });
        }
    });
    page.on('pageerror', (err) => {
        consErrors.push({ text: `[pageerror] ${err.message}`.slice(0, 500), route: currentRoute });
    });

    // ---------- LOGIN ----------
    await page.goto('/login');
    await page.getByPlaceholder(/tu@correo\.com|tu@email\.com/i).fill(EMAIL);
    await page.getByPlaceholder('••••••••').fill(PASSWORD);
    await page.getByRole('button', { name: /entrar ahora|iniciar sesión/i }).click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await shot(page, '00_post_login');

    // ---------- DASHBOARD (KPIs de ingreso) ----------
    await visit(page, '/dashboard', '01_dashboard');
    const dashboardText = await page.locator('body').innerText().catch(() => '');
    fs.writeFileSync(path.join(SHOT_DIR, '01_dashboard_text.txt'), dashboardText);

    // ---------- ATLETAS / ESTUDIANTES ----------
    await visit(page, '/students', '02_students_list');
    // filtro vacío / búsqueda que no matchea nada
    const searchBox = page.getByPlaceholder(/buscar/i).first();
    if (await searchBox.isVisible().catch(() => false)) {
        await searchBox.fill('QA-TEST-NO-EXISTE-XYZ123');
        await page.waitForTimeout(1000);
        await shot(page, '02b_students_search_empty');
        await searchBox.fill('');
        await page.waitForTimeout(500);
    }
    // abrir un atleta (primera fila) para ver detalle
    const firstRow = page.locator('table tbody tr, [data-testid="student-row"], .cursor-pointer').first();
    if (await firstRow.isVisible().catch(() => false)) {
        await firstRow.click().catch(() => {});
        await page.waitForTimeout(1500);
        await shot(page, '02c_student_detail');
        // buscar boton de baja/eliminar SIN confirmar
        const bajaBtn = page.getByRole('button', { name: /dar de baja|inactivar|eliminar|desactivar/i }).first();
        if (await bajaBtn.isVisible().catch(() => false)) {
            await bajaBtn.click().catch(() => {});
            await page.waitForTimeout(800);
            await shot(page, '02d_baja_dialogo_confirmacion_NO_EJECUTADO');
            // cancelar explícitamente
            const cancelBtn = page.getByRole('button', { name: /cancelar/i }).first();
            if (await cancelBtn.isVisible().catch(() => false)) {
                await cancelBtn.click().catch(() => {});
            } else {
                await page.keyboard.press('Escape').catch(() => {});
            }
        }
    }

    // ---------- MATRICULAS POR REVISAR ----------
    await visit(page, '/school/enrollment-intake', '03_enrollment_intake');

    // ---------- STAFF / ENTRENADORES ----------
    await visit(page, '/staff', '04_staff_list');
    const inviteBtn = page.getByRole('button', { name: /invitar/i }).first();
    if (await inviteBtn.isVisible().catch(() => false)) {
        await inviteBtn.click().catch(() => {});
        await page.waitForTimeout(800);
        await shot(page, '04b_invite_dialog_open');
        // Intentar seleccionar rol admin para ver qué permisos ofrece el selector (sin enviar)
        const roleSelect = page.locator('select, [role="combobox"]').first();
        if (await roleSelect.isVisible().catch(() => false)) {
            await roleSelect.click().catch(() => {});
            await page.waitForTimeout(500);
            await shot(page, '04c_invite_role_options');
            await page.keyboard.press('Escape').catch(() => {});
        }
        // NO se envía la invitación (crearía fila real en staging compartido) — se cierra el dialogo
        await page.keyboard.press('Escape').catch(() => {});
    }

    await visit(page, '/invitations', '05_invitations');

    // ---------- EQUIPOS / CATEGORIAS / SEDES DEPORTIVAS ----------
    await visit(page, '/teams', '06_teams');
    await visit(page, '/school-sports', '07_school_sports_categorias');
    await visit(page, '/memberships', '08_memberships');
    await visit(page, '/offerings', '09_offerings_planes_tarifas');
    // intentar editar una tarifa: abrir el primer plan
    const firstPlan = page.locator('table tbody tr, .cursor-pointer').first();
    if (await firstPlan.isVisible().catch(() => false)) {
        await firstPlan.click().catch(() => {});
        await page.waitForTimeout(1000);
        await shot(page, '09b_offering_detail_edit');
    }

    await visit(page, '/calendar', '10_calendar');
    await visit(page, '/branches', '11_branches_sedes');
    await visit(page, '/facilities', '12_facilities');

    // ---------- ENTRENAMIENTO ----------
    await visit(page, '/training-plans', '13_training_plans');
    await visit(page, '/school/routines', '14_routines');
    await visit(page, '/informe-mensual', '15_informe_mensual');

    // ---------- ASISTENCIAS ----------
    await visit(page, '/attendance-supervision', '16_attendance_supervision');
    await visit(page, '/attendance-history', '17_attendance_history');

    // ---------- TORNEOS ----------
    await visit(page, '/school/tournaments', '18_tournaments');
    await visit(page, '/results-overview', '19_results_overview');

    // ---------- DOTACION ----------
    await visit(page, '/school/equipment', '20_equipment_dotacion');

    // ---------- PAGOS ----------
    await visit(page, '/payments-automation', '21_payments_automation');
    const paymentsText = await page.locator('body').innerText().catch(() => '');
    fs.writeFileSync(path.join(SHOT_DIR, '21_payments_text.txt'), paymentsText);

    // buscar botones de ciclo de mes / cierre — SOLO mirar, no ejecutar cierre
    const cierreBtn = page.getByRole('button', { name: /cerrar mes|cierre de mes/i }).first();
    if (await cierreBtn.isVisible().catch(() => false)) {
        await shot(page, '21b_boton_cierre_mes_visible_NO_EJECUTADO');
    }
    // tab de mora / atrasados si existe
    const moraTab = page.getByRole('tab', { name: /mora|atrasad/i }).first();
    if (await moraTab.isVisible().catch(() => false)) {
        await moraTab.click().catch(() => {});
        await page.waitForTimeout(1000);
        await shot(page, '21c_mora');
    }
    // ver un pago / comprobante para aprobar-rechazar (solo abrir dialogo, no confirmar)
    const pagoRow = page.locator('table tbody tr').first();
    if (await pagoRow.isVisible().catch(() => false)) {
        await pagoRow.click().catch(() => {});
        await page.waitForTimeout(1000);
        await shot(page, '21d_payment_detail_dialog');
        await page.keyboard.press('Escape').catch(() => {});
    }

    await visit(page, '/recepcion', '22_modo_recepcion');

    // ---------- CONTABILIDAD ----------
    await visit(page, '/accounting', '23_accounting');
    await visit(page, '/accounting/suppliers', '24_accounting_suppliers');
    await visit(page, '/accounting/payroll', '25_accounting_payroll');
    await visit(page, '/accounting/reports', '26_accounting_reports_estado_resultados');
    await visit(page, '/accounting/budget', '27_accounting_budget');

    // ---------- FACTURACION ELECTRONICA (DIAN) ----------
    await visit(page, '/facturacion-electronica', '28_facturacion_electronica_dian');

    // ---------- REPORTES ----------
    await visit(page, '/finances', '29_finances');
    const financesText = await page.locator('body').innerText().catch(() => '');
    fs.writeFileSync(path.join(SHOT_DIR, '29_finances_text.txt'), financesText);

    await visit(page, '/school-reports', '30_school_reports');
    await visit(page, '/reporter-dashboard', '31_reporter_dashboard');
    const reporterText = await page.locator('body').innerText().catch(() => '');
    fs.writeFileSync(path.join(SHOT_DIR, '31_reporter_dashboard_text.txt'), reporterText);

    // ---------- DOCUMENTOS / IDENTIDAD ----------
    await visit(page, '/cards', '32_cards_carnets');
    await visit(page, '/cards/templates/certificates', '33_cards_templates');
    await visit(page, '/certificates', '34_certificates_constancias');
    await visit(page, '/qr-signup', '35_qr_signup');

    // ---------- COMUNICACION ----------
    await visit(page, '/whatsapp', '36_whatsapp');
    await visit(page, '/payment-reminders', '37_payment_reminders');
    await visit(page, '/message-templates', '38_message_templates');

    // ---------- CONTROL DE ACCESO ----------
    await visit(page, '/school/access-control', '39_access_control');

    // ---------- PROSPECTOS / LEADS / CLASE DE PRUEBA ----------
    // ruta no confirmada en config de navegación visible para owner: probar variantes conocidas
    for (const r of ['/leads', '/school/leads', '/prospectos']) {
        const ok = await visit(page, r, `40_leads_${r.replace(/\W/g, '_')}`);
        if (ok) {
            const bodyTxt = await page.locator('body').innerText().catch(() => '');
            if (!/404|no encontrada|not found/i.test(bodyTxt)) break;
        }
    }

    // ---------- CONFIGURACION DE LA ESCUELA ----------
    await visit(page, '/settings', '41_settings');
    await visit(page, '/school/public-profile', '42_public_profile');
    await visit(page, '/mi-plan', '43_mi_plan_facturacion_tier');

    // ---------- resumen final ----------
    fs.writeFileSync(
        LOG_PATH,
        JSON.stringify({ netErrors, consErrors }, null, 2),
    );
    console.log(`\n===== RED (4xx/5xx): ${netErrors.length} =====`);
    for (const e of netErrors) console.log(`${e.status} ${e.url} @ ${e.route}`);
    console.log(`\n===== CONSOLE ERRORS: ${consErrors.length} =====`);
    for (const e of consErrors) console.log(`@ ${e.route}: ${e.text}`);
});
