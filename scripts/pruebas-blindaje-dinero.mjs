// scripts/pruebas-blindaje-dinero.mjs
//
// Prueba de COMPORTAMIENTO de la Fase 1 del spec
// docs/specs/blindaje-dinero-pagos-tienda-nomina.md (§1.1–1.4 y §6 QA),
// contra la base viva — no de forma.
//
// ── Qué prueba ──────────────────────────────────────────────────────────────
//   M1 20261002125955 vendor_profiles_columnas_publicas_anon   (T1)
//   M2 20261002125957 guard_payments_escritura_cliente         (A1)
//   M3 20261002125959 tienda_apagada_y_guard_vendor_profiles   (tienda off + T2)
//   M4 20261002130001 nomina_egreso_bruto_e_intereses_cesantias (C1 + C2)
//
// ── Cómo simula usuarios ────────────────────────────────────────────────────
// Igual que scripts/rls-pruebas-negativas.mjs: no hay SUPABASE_JWT_SECRET, así
// que se crean usuarios de auth REALES y DESECHABLES vía Admin API
// (service_role), se hace login real con password y se prueba contra PostgREST
// con ese token. Escuelas desechables (is_demo, account_type 'test' para que
// school_is_operational() no las bloquee). Todo lo creado se inventaría y se
// borra en el `finally`, pase lo que pase (salvo SIGKILL).
//
// ── Precondición: las 4 migraciones aplicadas ───────────────────────────────
// Antes de crear nada se verifica M1 (anon no puede pedir bank_data) y M3
// (existe store_enabled()). M2 y M4 no son observables con service_role por
// PostgREST (no hay acceso a pg_trigger/pg_proc), así que se detectan
// actuando: si el padre logra insertar un pago 'paid', se aborta con
// "M2 no aplicada"; si los intereses de cesantías salen con la fórmula vieja
// (/12), el caso lo dice explícitamente ("M4 no aplicada").
//
// ⚠️ Escribe en la base (hay UNA sola Supabase para todos los ambientes). Solo
// filas desechables propias, borradas al final. NO cambia platform_config:
// si la tienda está prendida, los casos de "tienda apagada" fallan con aviso.
//
// Uso:
//   npm run seguridad:blindaje-dinero
//
// Sale con código 1 si falta una migración o si algún caso no se comportó
// como se esperaba.

import { createClient } from '../bff/node_modules/@supabase/supabase-js/dist/index.mjs';
import { config } from '../bff/node_modules/dotenv/lib/main.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(RAIZ, 'bff/.env') });

const URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON_KEY || !SERVICE_KEY) {
    console.error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en bff/.env');
    process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
const anon = createClient(URL, ANON_KEY, { auth: { persistSession: false } });
const marca = Date.now();
const hoy = new Date().toISOString().slice(0, 10);

class MigracionNoAplicada extends Error {}

// ── 0. Precondiciones (no crean nada) ───────────────────────────────────────
{
    const faltan = [];

    // M3: store_enabled() existe y la ve anon.
    const { error: errFlag } = await anon.rpc('store_enabled');
    if (errFlag) faltan.push(`M3 20261002125959 (store_enabled() no responde: ${errFlag.code ?? ''} ${errFlag.message})`);

    // M1: anon pidiendo bank_data. Sin la migración NO hay error (tiene SELECT
    // sobre las 28 columnas), haya o no filas verificadas.
    const { error: errBank } = await anon.from('vendor_profiles').select('id, bank_data').limit(1);
    if (!errBank) faltan.push('M1 20261002125955 (anon todavía puede pedir vendor_profiles.bank_data)');

    if (faltan.length) {
        console.error('');
        console.error('✋ Migración no aplicada — no se corre ninguna prueba:');
        for (const f of faltan) console.error(`   · ${f}`);
        console.error('');
        console.error('Aplicarlas por una vía con rastro (apply_migration / CLI) y volver a correr.');
        process.exit(1);
    }
}

// ── Inventario de todo lo desechable, para poder borrarlo en el finally ────
const inventario = {
    authUserIds: [], schoolIds: [], schoolMemberIds: [],
    paymentIds: [], vendorProfileIds: [], productIds: [], orderIds: [],
    payrollEmployeeIds: [], payrollRunIds: [], expenseIds: [],
};

async function crearUsuario(etiqueta) {
    const email = `blindaje-${etiqueta}-${marca}-${randomUUID()}@pruebas-blindaje-dinero.invalid`;
    const password = `Prueba-${randomUUID()}!A1`;
    const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'parent' }, // solo para que el trigger de signup no aborte; el rol real vive en school_members
    });
    if (error) throw new Error(`No se pudo crear usuario desechable "${etiqueta}": ${error.message}`);
    inventario.authUserIds.push(data.user.id);

    const cliente = createClient(URL, ANON_KEY, { auth: { persistSession: false } });
    const { error: loginError } = await cliente.auth.signInWithPassword({ email, password });
    if (loginError) throw new Error(`No se pudo iniciar sesión con "${etiqueta}": ${loginError.message}`);

    return { id: data.user.id, cliente };
}

async function crearEscuela(nombre, ownerId) {
    const { data, error } = await admin
        .from('schools')
        .insert({ name: nombre, is_demo: true, account_type: 'test', owner_id: ownerId ?? null })
        .select('id')
        .single();
    if (error) throw new Error(`No se pudo crear escuela desechable: ${error.message}`);
    inventario.schoolIds.push(data.id);
    return data.id;
}

async function agregarMiembro(profileId, schoolId, role) {
    const { data, error } = await admin
        .from('school_members')
        .insert({ profile_id: profileId, school_id: schoolId, role, status: 'active' })
        .select('id')
        .single();
    if (error) throw new Error(`No se pudo agregar miembro (role=${role}): ${error.message}`);
    inventario.schoolMemberIds.push(data.id);
}

// Cobro creado por service_role (el BFF / una RPC): no pasa por el guard.
async function crearCobroServicio(schoolId, parentId, extra = {}) {
    const { data, error } = await admin
        .from('payments')
        .insert({
            school_id: schoolId, parent_id: parentId, amount: 150000,
            concept: `__BLINDAJE_TEST_${marca}__`, due_date: hoy, status: 'pending',
            ...extra,
        })
        .select('id')
        .single();
    if (error) throw new Error(`No se pudo crear cobro desechable (service_role): ${error.message}`);
    inventario.paymentIds.push(data.id);
    return data.id;
}

// ── Runner de casos ─────────────────────────────────────────────────────────
const resultados = [];

// Igual que en rls-pruebas-negativas: un UPDATE que la policy USING no deja ver
// no lanza error, devuelve 0 filas. `fn` nunca usa `.single()`.
//
// opciones:
//   error:     { code, incluye }  → en RECHAZAR exige ESE error (no vale 0 filas
//              ni otra constraint): así se prueba que rebotó el guard y no algo
//              que golpea a cualquiera por igual.
//   verificar: (filas) => string|null → en ACEPTAR, chequeo extra del resultado
//              (null = ok, string = por qué falló).
//   leer:      true → ACEPTAR de lectura: basta con que no haya error (0 filas ok).
async function caso(nombre, esperado, fn, opciones = {}) {
    let paso = false;
    let detalle = '';
    let filas = [];
    try {
        const { data, error } = await fn();
        const huboError = !!error;
        filas = Array.isArray(data) ? data : (data ? [data] : []);
        const seAplico = !huboError && filas.length > 0;
        if (esperado === 'RECHAZAR') {
            if (opciones.error) {
                const { code, incluye } = opciones.error;
                const codigoOk = !code || error?.code === code;
                const textoOk = !incluye || `${error?.message ?? ''} ${error?.details ?? ''}`.includes(incluye);
                paso = huboError && codigoOk && textoOk;
                detalle = huboError
                    ? `${error.code ?? '?'} ${error.message}${paso ? '' : `  (se esperaba ${code ?? ''} ${incluye ?? ''})`}`
                    : (seAplico ? 'no rebotó — la escritura pasó cuando debía rechazarse' : `0 filas sin error (se esperaba ${code ?? ''} ${incluye ?? ''} explícito)`);
            } else {
                paso = !seAplico;
                detalle = huboError
                    ? `${error.code ?? '?'} ${error.message}`
                    : (seAplico ? 'no rebotó — la escritura pasó cuando debía rechazarse' : '0 filas afectadas (bloqueado por RLS en silencio, sin error)');
            }
        } else if (opciones.leer) {
            paso = !huboError;
            detalle = huboError ? `${error.code ?? '?'} ${error.message}` : `ok (${filas.length} fila/s)`;
            if (paso && opciones.verificar) {
                const problema = opciones.verificar(filas);
                if (problema) { paso = false; detalle = problema; }
            }
        } else {
            paso = seAplico;
            detalle = huboError ? `${error.code ?? '?'} ${error.message}` : (seAplico ? 'ok' : '0 filas afectadas cuando debía aceptarse');
            if (paso && opciones.verificar) {
                const problema = opciones.verificar(filas);
                if (problema) { paso = false; detalle = problema; }
            }
        }
    } catch (e) {
        paso = false;
        detalle = `excepción: ${e.message}`;
    }
    resultados.push({ nombre, esperado, paso, detalle });
    return { paso, filas };
}

// Para comprobaciones que no son una sola llamada a PostgREST.
async function comprobar(nombre, fn) {
    let paso = false;
    let detalle = '';
    try {
        const problema = await fn();
        paso = !problema;
        detalle = problema || 'ok';
    } catch (e) {
        detalle = `excepción: ${e.message}`;
    }
    resultados.push({ nombre, esperado: 'VERIFICAR', paso, detalle });
    return paso;
}

const BLOQUEO_PAGO = { code: '42501', incluye: 'PAYMENT_FIELD_LOCKED' };
const BLOQUEO_VENDOR = { code: '42501', incluye: 'VENDOR_FIELD_LOCKED' };

// ── Pruebas ────────────────────────────────────────────────────────────────
let fatal = null;

try {
    const [uPadre, uOwner, uPadreOtra, uVendedor, uComprador] = await Promise.all([
        crearUsuario('padre-a'),
        crearUsuario('owner-a'),
        crearUsuario('padre-b'),
        crearUsuario('vendedor'),
        crearUsuario('comprador'),
    ]);

    const escuelaA = await crearEscuela(`__BLINDAJE_TEST_A_${marca}__`, uOwner.id);
    const escuelaB = await crearEscuela(`__BLINDAJE_TEST_B_${marca}__`, null);

    await agregarMiembro(uOwner.id, escuelaA, 'owner');
    await agregarMiembro(uPadre.id, escuelaA, 'parent');
    await agregarMiembro(uPadreOtra.id, escuelaB, 'parent');

    const basePago = (parentId, extra = {}) => ({
        school_id: escuelaA, parent_id: parentId, amount: 150000,
        concept: `__BLINDAJE_TEST_${marca}__`, due_date: hoy, ...extra,
    });

    // ═══ A1 · pagos (M2) ═══════════════════════════════════════════════════
    // Primer caso = sonda de M2: si el padre inserta 'paid', el guard no existe.
    const sonda = await caso(
        "A1 · padre inserta un pago ya 'paid' → 42501 PAYMENT_FIELD_LOCKED: status",
        'RECHAZAR',
        () => uPadre.cliente.from('payments').insert(basePago(uPadre.id, { status: 'paid', amount_paid: 150000 })).select('id'),
        { error: BLOQUEO_PAGO },
    );
    if (sonda.filas[0]?.id) {
        inventario.paymentIds.push(sonda.filas[0].id);
        throw new MigracionNoAplicada("M2 20261002125957 no aplicada: el padre insertó un pago 'paid' (trg_zz_guard_payments_client no existe).");
    }

    const conComprobante = await caso(
        "A1 · padre inserta 'awaiting_approval' con receipt_url → ok",
        'ACEPTAR',
        () => uPadre.cliente.from('payments').insert(basePago(uPadre.id, {
            status: 'awaiting_approval', receipt_url: `https://example.invalid/comprobante-${marca}.jpg`, payment_method: 'transfer',
        })).select('id, status'),
        { verificar: (f) => (f[0]?.status === 'awaiting_approval' ? null : `quedó en status=${f[0]?.status}`) },
    );
    const pagoComprobanteId = conComprobante.filas[0]?.id ?? null;
    if (pagoComprobanteId) inventario.paymentIds.push(pagoComprobanteId);

    const pagoPendienteId = await crearCobroServicio(escuelaA, uPadre.id);

    await caso(
        'A1 · padre sube comprobante: pending → awaiting_approval con receipt_url y payment_date → ok',
        'ACEPTAR',
        () => uPadre.cliente.from('payments').update({
            status: 'awaiting_approval',
            receipt_url: `https://example.invalid/comprobante-${marca}-2.jpg`,
            payment_date: hoy,
            payment_method: 'transfer',
        }).eq('id', pagoPendienteId).select('id, status'),
        { verificar: (f) => (f[0]?.status === 'awaiting_approval' ? null : `quedó en status=${f[0]?.status}`) },
    );

    await caso(
        'A1 · padre cambia amount de su cobro → 42501 PAYMENT_FIELD_LOCKED: amount',
        'RECHAZAR',
        () => uPadre.cliente.from('payments').update({ amount: 1000 }).eq('id', pagoPendienteId).select('id'),
        { error: { code: '42501', incluye: 'PAYMENT_FIELD_LOCKED: amount' } },
    );

    await caso(
        "A1 · padre pasa su cobro a 'paid' → 42501 PAYMENT_FIELD_LOCKED: status",
        'RECHAZAR',
        () => uPadre.cliente.from('payments').update({ status: 'paid' }).eq('id', pagoPendienteId).select('id'),
        { error: { code: '42501', incluye: 'PAYMENT_FIELD_LOCKED: status' } },
    );

    // Reescritura idéntica sobre un cobro ABIERTO: se compara por columna con
    // IS DISTINCT FROM, así que reescribir el mismo amount no debe fallar.
    await caso(
        'A1 · padre reescribe el mismo amount (reescritura idéntica, cobro abierto) → ok',
        'ACEPTAR',
        () => uPadre.cliente.from('payments').update({ amount: 150000 }).eq('id', pagoPendienteId).select('id'),
    );

    const pagoPagadoId = await crearCobroServicio(escuelaA, uPadre.id, {
        status: 'paid', amount_paid: 150000, payment_date: hoy, payment_method: 'cash',
    });

    await caso(
        "A1 · padre toca un cobro ya 'paid' (lo reabre a awaiting_approval) → 42501",
        'RECHAZAR',
        () => uPadre.cliente.from('payments').update({
            status: 'awaiting_approval', receipt_url: `https://example.invalid/reabre-${marca}.jpg`,
        }).eq('id', pagoPagadoId).select('id'),
        { error: BLOQUEO_PAGO },
    );

    await caso(
        "A1 · padre cambia solo el comprobante de un cobro ya 'paid' → 42501",
        'RECHAZAR',
        () => uPadre.cliente.from('payments').update({ receipt_url: `https://example.invalid/otro-${marca}.jpg` }).eq('id', pagoPagadoId).select('id'),
        { error: BLOQUEO_PAGO },
    );

    // Spec §1.2: "OLD.status IN ('paid','glosado','cancelled') → no se puede
    // tocar nada (salvo una reescritura idéntica)". OJO: trg_updated_at
    // (set_updated_at) corre ANTES que trg_zz_… (orden alfabético) y cambia
    // NEW.updated_at, así que `NEW IS DISTINCT FROM OLD` es true en cualquier
    // UPDATE. Si este caso falla, el guard no cumple esa excepción del spec.
    await caso(
        "A1 · padre reescribe idéntico un cobro 'paid' (status='paid', mismo valor) → ok según spec",
        'ACEPTAR',
        () => uPadre.cliente.from('payments').update({ status: 'paid' }).eq('id', pagoPagadoId).select('id'),
    );

    await caso(
        "A1 · owner (staff) aprueba el comprobante: awaiting_approval → 'paid' con amount_paid → ok",
        'ACEPTAR',
        () => uOwner.cliente.from('payments').update({
            status: 'paid', amount_paid: 150000, approved_at: new Date().toISOString(), approved_by: uOwner.id,
        }).eq('id', pagoPendienteId).select('id, status'),
        { verificar: (f) => (f[0]?.status === 'paid' ? null : `quedó en status=${f[0]?.status}`) },
    );

    if (pagoComprobanteId) {
        await caso(
            "A1 · service_role (webhook Wompi / BFF) marca 'paid' → ok",
            'ACEPTAR',
            () => admin.from('payments').update({ status: 'paid', amount_paid: 150000, payment_date: hoy }).eq('id', pagoComprobanteId).select('id, status'),
            { verificar: (f) => (f[0]?.status === 'paid' ? null : `quedó en status=${f[0]?.status}`) },
        );
    }

    await caso(
        "A1 · padre de OTRA escuela inserta 'paid' en esta escuela → 42501 PAYMENT_FIELD_LOCKED",
        'RECHAZAR',
        () => uPadreOtra.cliente.from('payments').insert(basePago(uPadreOtra.id, { status: 'paid', amount_paid: 150000 })).select('id'),
        { error: BLOQUEO_PAGO },
    ).then((r) => { if (r.filas[0]?.id) inventario.paymentIds.push(r.filas[0].id); });

    // Ni `Payments: insert parent` (solo parent_id = auth.uid()) ni el guard
    // (solo mira status y columnas de dinero) exigen membresía. Si este caso
    // falla, es el residual: un no-miembro puede crear cobros 'pending' en
    // cualquier escuela operativa.
    await caso(
        "A1 · padre de OTRA escuela inserta 'pending' en esta escuela → rechazo (RLS o guard)",
        'RECHAZAR',
        () => uPadreOtra.cliente.from('payments').insert(basePago(uPadreOtra.id, { status: 'pending' })).select('id'),
    ).then((r) => { if (r.filas[0]?.id) inventario.paymentIds.push(r.filas[0].id); });

    // ═══ T1 · columnas de vendor_profiles para anon (M1) ═══════════════════
    await caso(
        'T1 · anon pide vendor_profiles?select=bank_data → 42501 permission denied',
        'RECHAZAR',
        () => anon.from('vendor_profiles').select('id, bank_data').limit(5),
        { error: { code: '42501' } },
    );

    await caso(
        'T1 · anon pide solo columnas publicables (id, slug, display_name, …) → ok',
        'ACEPTAR',
        () => anon.from('vendor_profiles')
            .select('id, user_id, vendor_type, display_name, slug, description, logo_url, city, verification_status, is_active, avg_rating, reviews_count')
            .limit(5),
        { leer: true },
    );

    // ═══ T2 · el vendedor no se autoverifica (M3, trigger) ═════════════════
    const alta = await caso(
        "T2 · usuario crea su vendor_profile pidiendo 'verified' y comisión 0 → queda 'pending' y 0.10",
        'ACEPTAR',
        () => uVendedor.cliente.from('vendor_profiles').insert({
            user_id: uVendedor.id, vendor_type: 'wellness',
            display_name: `Blindaje Test ${marca}`,
            verification_status: 'verified', commission_rate: 0,
            capabilities: { can_sell_products: true, can_sell_services: true },
        }).select('id, verification_status, commission_rate, capabilities, vendor_type'),
        {
            verificar: (f) => {
                const v = f[0];
                if (v?.verification_status !== 'pending' || Number(v?.commission_rate) !== 0.1) {
                    return `quedó verification_status=${v?.verification_status}, commission_rate=${v?.commission_rate} — M3 (trg_guard_vendor_profiles) no aplicada`;
                }
                return null;
            },
        },
    );
    const vendorProfileId = alta.filas[0]?.id ?? null;
    if (vendorProfileId) inventario.vendorProfileIds.push(vendorProfileId);
    const capacidadesActuales = alta.filas[0]?.capabilities ?? null;

    if (vendorProfileId) {
        await caso(
            "T2 · vendedor se pone verification_status='verified' → 42501 VENDOR_FIELD_LOCKED",
            'RECHAZAR',
            () => uVendedor.cliente.from('vendor_profiles').update({ verification_status: 'verified' }).eq('id', vendorProfileId).select('id'),
            { error: BLOQUEO_VENDOR },
        );

        await caso(
            'T2 · vendedor se pone commission_rate=0 → 42501 VENDOR_FIELD_LOCKED',
            'RECHAZAR',
            () => uVendedor.cliente.from('vendor_profiles').update({ commission_rate: 0 }).eq('id', vendorProfileId).select('id'),
            { error: BLOQUEO_VENDOR },
        );

        await caso(
            'T2 · vendedor se da capabilities.can_sell_products → 42501 VENDOR_FIELD_LOCKED',
            'RECHAZAR',
            () => uVendedor.cliente.from('vendor_profiles').update({
                capabilities: { ...(capacidadesActuales ?? {}), can_sell_products: true, can_sell_premium: true },
            }).eq('id', vendorProfileId).select('id'),
            { error: BLOQUEO_VENDOR },
        );

        await caso(
            'T2 · vendedor cambia su display_name → ok',
            'ACEPTAR',
            () => uVendedor.cliente.from('vendor_profiles').update({ display_name: `Blindaje Test ${marca} editado` }).eq('id', vendorProfileId).select('id'),
        );

        // El upsert de WellnessOnboarding reescribe vendor_type y capabilities
        // con el mismo valor: no debe romperse.
        if (capacidadesActuales) {
            await caso(
                'T2 · wellness reescribe vendor_type y capabilities idénticos → ok',
                'ACEPTAR',
                () => uVendedor.cliente.from('vendor_profiles').update({
                    vendor_type: 'wellness', capabilities: capacidadesActuales, description: 'reescritura idéntica',
                }).eq('id', vendorProfileId).select('id'),
            );
        }
    }

    // ═══ Tienda apagada (M3, policies RESTRICTIVE store_off_*) ═════════════
    const { data: tiendaPrendida, error: errTienda } = await anon.rpc('store_enabled');
    const tiendaApagada = !errTienda && tiendaPrendida === false;
    if (!tiendaApagada) {
        resultados.push({
            nombre: 'Tienda · store_enabled() debe ser false para probar el apagado',
            esperado: 'VERIFICAR', paso: false,
            detalle: errTienda ? errTienda.message : `store_enabled() = ${tiendaPrendida} — la tienda está prendida; este script NO toca platform_config`,
        });
    } else {
        await comprobar('Tienda · store_enabled() = false (anon)', async () => null);

        await caso(
            'Tienda · comprador inserta una orden con la tienda apagada → rechazo (42501 RLS)',
            'RECHAZAR',
            () => uComprador.cliente.from('orders').insert({ user_id: uComprador.id, total_amount: 1000 }).select('id'),
            { error: { code: '42501' } },
        ).then((r) => { if (r.filas[0]?.id) inventario.orderIds.push(r.filas[0].id); });

        // Orden propia preexistente (creada por service_role) → el comprador
        // no puede reescribirle el total (T3/T4 cerradas con la tienda apagada).
        const { data: orden, error: errOrden } = await admin
            .from('orders').insert({ user_id: uComprador.id, total_amount: 50000 }).select('id').single();
        if (errOrden) throw new Error(`No se pudo crear orden desechable (service_role): ${errOrden.message}`);
        inventario.orderIds.push(orden.id);

        await caso(
            'Tienda · comprador edita orders.total_amount de su orden con la tienda apagada → rechazo',
            'RECHAZAR',
            () => uComprador.cliente.from('orders').update({ total_amount: 1 }).eq('id', orden.id).select('id'),
        );

        await caso(
            'Tienda · anon SELECT products → 0 filas (vitrina vacía)',
            'ACEPTAR',
            () => anon.from('products').select('id').limit(50),
            { leer: true, verificar: (f) => (f.length === 0 ? null : `anon ve ${f.length} producto/s con la tienda apagada`) },
        );

        await caso(
            'Tienda · anon SELECT product_variants → 0 filas',
            'ACEPTAR',
            () => anon.from('product_variants').select('id').limit(50),
            { leer: true, verificar: (f) => (f.length === 0 ? null : `anon ve ${f.length} variante/s con la tienda apagada`) },
        );

        // Producto del vendedor (service_role, status draft para no pasar por
        // el gate de calidad de publicación, sin vendor_profile_id para no
        // pasar por la validación de capacidades).
        const { data: producto, error: errProd } = await admin
            .from('products')
            .insert({ vendor_id: uVendedor.id, name: `__BLINDAJE_TEST_PROD_${marca}__`, price: 10000, status: 'draft' })
            .select('id')
            .single();
        if (errProd) throw new Error(`No se pudo crear producto desechable (service_role): ${errProd.message}`);
        inventario.productIds.push(producto.id);

        await caso(
            'Tienda · el dueño sigue viendo su producto con la tienda apagada → 1 fila',
            'ACEPTAR',
            () => uVendedor.cliente.from('products').select('id').eq('id', producto.id),
        );

        await caso(
            'Tienda · el dueño edita su producto con la tienda apagada → rechazo',
            'RECHAZAR',
            () => uVendedor.cliente.from('products').update({ price: 1 }).eq('id', producto.id).select('id'),
        );
    }

    // ═══ C1 + C2 · nómina (M4) ═════════════════════════════════════════════
    // can_manage_finances('school', id) = is_school_admin(id) = school_members
    // owner/admin/school_admin activo → uOwner lo cumple.
    const anioActual = new Date().getUTCFullYear();
    const { data: configs, error: errCfg } = await admin
        .from('payroll_config').select('*').order('year', { ascending: false });
    if (errCfg) throw new Error(`No se pudo leer payroll_config: ${errCfg.message}`);
    const cfg = configs.find((c) => c.year === anioActual) ?? configs[0];
    if (!cfg) throw new Error('payroll_config está vacía: no hay año con qué calcular la nómina.');
    const mes = new Date().getUTCMonth() + 1;

    const { data: empleado, error: errEmp } = await admin
        .from('payroll_employees')
        .insert({
            owner_type: 'school', owner_id: escuelaA,
            full_name: `__BLINDAJE_TEST_EMP_${marca}__`, document_id: `T${marca}`,
            base_salary: 2200000, transport_aid_eligible: true, arl_class: 1, active: true,
        })
        .select('id')
        .single();
    if (errEmp) throw new Error(`No se pudo crear empleado desechable: ${errEmp.message}`);
    inventario.payrollEmployeeIds.push(empleado.id);

    const { data: corrida, error: errRun } = await uOwner.cliente.rpc('run_payroll', {
        p_owner_type: 'school', p_owner_id: escuelaA, p_year: cfg.year, p_month: mes,
    });
    if (corrida?.run_id) inventario.payrollRunIds.push(corrida.run_id);

    const corridaOk = await comprobar(`C · owner corre run_payroll(${cfg.year}-${String(mes).padStart(2, '0')}) → ok`, async () => {
        if (errRun) return `${errRun.code ?? '?'} ${errRun.message}`;
        if (!corrida?.ok) return `run_payroll devolvió ${JSON.stringify(corrida)}`;
        return null;
    });

    if (corridaOk) {
        const { data: items, error: errItems } = await admin
            .from('payroll_items').select('*').eq('run_id', corrida.run_id);
        const { data: run, error: errRunRow } = await admin
            .from('payroll_runs').select('*').eq('id', corrida.run_id).single();

        await comprobar('C2 · intereses_cesantias = round(cesantias × 12 %) (sin el /12)', async () => {
            if (errItems) return errItems.message;
            if (!items?.length) return 'run_payroll no generó payroll_items';
            const it = items[0];
            const base = 2200000;
            const aux = base <= Number(cfg.transport_aid_threshold_smmlv) * Number(cfg.smmlv) ? Number(cfg.transport_aid) : 0;
            const cesEsperada = Math.round((base + aux) * Number(cfg.cesantias_pct));
            const intEsperado = Math.round(Number(it.cesantias) * Number(cfg.intereses_cesantias_pct));
            const intViejo = Math.round(Number(it.cesantias) * Number(cfg.intereses_cesantias_pct) / 12);
            if (Number(it.transport_aid) !== aux) return `auxilio=${it.transport_aid}, se esperaba ${aux}`;
            if (Number(it.cesantias) !== cesEsperada) return `cesantias=${it.cesantias}, se esperaba ${cesEsperada}`;
            if (Number(it.intereses_cesantias) === intEsperado) return null;
            if (Number(it.intereses_cesantias) === intViejo) return `intereses_cesantias=${it.intereses_cesantias} = fórmula vieja (/12) — M4 20261002130001 no aplicada (esperado ${intEsperado})`;
            return `intereses_cesantias=${it.intereses_cesantias}, se esperaba ${intEsperado}`;
        });

        await comprobar('C1 · run_payroll.cash_cost = total_gross + total_employer', async () => {
            if (errRunRow) return errRunRow.message;
            const esperado = Number(run.total_gross) + Number(run.total_employer);
            const viejo = Number(run.total_net) + Number(run.total_employer);
            const real = Number(corrida.cash_cost);
            if (corrida.cash_cost === undefined || corrida.cash_cost === null) return 'run_payroll no devolvió cash_cost';
            if (real === esperado) return null;
            if (real === viejo) return `cash_cost=${real} = neto + patronal (fórmula vieja) — M4 no aplicada (esperado ${esperado})`;
            return `cash_cost=${real}, se esperaba ${esperado}`;
        });

        const { data: posteo, error: errPost } = await uOwner.cliente.rpc('post_payroll_run', {
            p_run_id: corrida.run_id, p_paid_date: hoy,
        });
        if (posteo?.expense_id) inventario.expenseIds.push(posteo.expense_id);

        await comprobar('C1 · post_payroll_run → expenses.amount = total_gross + total_employer', async () => {
            if (errPost) return `${errPost.code ?? '?'} ${errPost.message}`;
            if (!posteo?.ok || !posteo.expense_id) return `post_payroll_run devolvió ${JSON.stringify(posteo)}`;
            const { data: egreso, error: errEg } = await admin
                .from('expenses').select('id, amount, kind, status').eq('id', posteo.expense_id).single();
            if (errEg) return errEg.message;
            const esperado = Number(run.total_gross) + Number(run.total_employer);
            const viejo = Number(run.total_net) + Number(run.total_employer);
            if (Number(egreso.amount) === esperado) return null;
            if (Number(egreso.amount) === viejo) return `expenses.amount=${egreso.amount} = neto + patronal (fórmula vieja) — M4 no aplicada (esperado ${esperado})`;
            return `expenses.amount=${egreso.amount}, se esperaba ${esperado}`;
        });
    }
} catch (e) {
    fatal = e;
} finally {
    // ── Limpieza: en orden inverso de dependencias, ignorando errores individuales ──
    const borrar = async (tabla, columna, ids) => {
        if (!ids.length) return;
        const { error } = await admin.from(tabla).delete().in(columna, ids);
        if (error) console.error(`  (limpieza) ${tabla}.${columna}: ${error.message}`);
    };
    const { schoolIds, authUserIds } = inventario;

    // Nómina: egresos → ítems → corridas (created_by → auth.users) → empleados.
    await borrar('expenses', 'id', inventario.expenseIds);
    await borrar('expenses', 'school_id', schoolIds);
    const { data: runsEscuela } = schoolIds.length
        ? await admin.from('payroll_runs').select('id').in('owner_id', schoolIds)
        : { data: [] };
    const runIds = [...new Set([...inventario.payrollRunIds, ...(runsEscuela ?? []).map((r) => r.id)])];
    await borrar('payroll_items', 'run_id', runIds);
    await borrar('payroll_runs', 'id', runIds);
    await borrar('payroll_employees', 'id', inventario.payrollEmployeeIds);
    await borrar('payroll_employees', 'owner_id', schoolIds);

    // Tienda: órdenes, productos, perfiles de vendedor (vendor_balances cae en cascada).
    await borrar('orders', 'id', inventario.orderIds);
    await borrar('orders', 'user_id', authUserIds);
    await borrar('products', 'id', inventario.productIds);
    await borrar('products', 'vendor_id', authUserIds);
    await borrar('vendor_profiles', 'id', inventario.vendorProfileIds);
    await borrar('vendor_profiles', 'user_id', authUserIds);

    // Pagos (payments.school_id no tiene cascada): los inventariados y
    // cualquier otro que haya quedado en las escuelas desechables.
    await borrar('payments', 'id', inventario.paymentIds);
    await borrar('payments', 'school_id', schoolIds);

    await borrar('school_members', 'id', inventario.schoolMemberIds);
    await borrar('schools', 'id', schoolIds);
    for (const id of authUserIds) {
        await admin.from('profiles').delete().eq('id', id);
        await admin.auth.admin.deleteUser(id);
    }
}

// ── Reporte ──────────────────────────────────────────────────────────────
console.log('');
let fallas = 0;
for (const r of resultados) {
    const icono = r.paso ? '✅' : '❌';
    if (!r.paso) fallas++;
    // El detalle de un RECHAZAR exitoso se muestra siempre: es la prueba de
    // que rebotó el guard/RLS correcto y no otra constraint.
    const mostrarDetalle = !r.paso || r.esperado === 'RECHAZAR';
    console.log(`${icono} [${r.esperado}] ${r.nombre}${mostrarDetalle ? `  →  ${r.detalle}` : ''}`);
}

console.log('');
console.log('─'.repeat(77));
if (fatal instanceof MigracionNoAplicada) {
    console.log(`✋ ${fatal.message}`);
    console.log('Se abortó el resto de las pruebas; lo creado ya se borró.');
    process.exit(1);
}
if (fatal) {
    console.log(`💥 Error de preparación (no es un veredicto de seguridad): ${fatal.message}`);
    console.log('Lo creado ya se borró.');
    process.exit(1);
}
if (fallas > 0) {
    console.log(`${fallas} de ${resultados.length} caso(s) NO se comportaron como se esperaba.`);
    process.exit(1);
}
console.log(`Los ${resultados.length} casos se comportaron como se esperaba.`);
process.exit(0);
