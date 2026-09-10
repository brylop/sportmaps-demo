/**
 * invoicing.routes — facturación electrónica DIAN (multi-PAC).
 *
 * Endpoints:
 *  - GET    /api/v1/invoicing/providers/:ownerType/:ownerId  → lista (sin secretos)
 *  - POST   /api/v1/invoicing/providers/:ownerType/:ownerId  → upsert facturador
 *  - DELETE /api/v1/invoicing/providers/:id
 *  - POST   /api/v1/invoicing/emit/:paymentId                → emite factura del pago
 *  - POST   /api/v1/invoicing/backfill/:ownerType/:ownerId   → barrido de un rango cerrado
 *  - POST   /api/v1/invoicing/credit-note/:invoiceId         → anula con nota crédito
 *  - GET    /api/v1/invoicing/invoices/:ownerType/:ownerId   → lista facturas del dueño
 *  - GET    /api/v1/invoicing/by-payment/:paymentId          → factura de un pago
 *
 * Seguridad:
 *  - credentials del PAC NUNCA se devuelven; solo se reciben.
 *  - escribir facturador / emitir / anular → solo quien administra las finanzas
 *    del dueño, y el dueño se lee de la FILA, nunca de la URL.
 *  - ver factura de un pago → el dueño (emisor) o el pagador (padre).
 *
 * Este router es el ÚNICO control de acceso real del facturador: el BFF entra
 * con service_role, así que RLS no filtra nada acá. Cada handler correlaciona
 * al usuario con el DUEÑO de la factura antes de tocar la base — un chequeo de
 * rol sin escuela no sirve, ver canManageFinances().
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { emitInvoiceForPayment, backfillInvoices, voidInvoice } from '../services/invoicing.service';
import { listSupportedProviders } from '../services/invoicing';
import {
    CorrectionConceptCode,
    isCorrectionConceptCode,
    CREDIT_NOTE_OBSERVATION_MAX,
} from '../services/invoicing/types';

const router = Router();

type OwnerType = 'school' | 'vendor' | 'organizer';
const OWNER_TYPES: OwnerType[] = ['school', 'vendor', 'organizer'];

const ProviderUpsertSchema = z.object({
    provider: z.string().min(2),                       // text libre: cualquier PAC soportado
    credentials: z.record(z.string(), z.any()).default({}),   // {client_id, client_secret, username, password, base_url?}
    config: z.record(z.string(), z.any()).default({}),        // {numbering_range_id, default_municipality_id?, ...}
    sandbox: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    enabled: z.boolean().optional(),
});

// ─── Permisos ────────────────────────────────────────────────────────────────

/**
 * Roles de membresía que administran la escuela. Es la MISMA lista que usa
 * user_admin_school_ids() en la base (la función de alcance de administración,
 * no la de staff): lo que otorga permisos no se delega a coaches.
 */
const ADMIN_MEMBER_ROLES: string[] = ['owner', 'admin', 'school_admin', 'super_admin'];

/**
 * ¿Es admin de plataforma? Se pregunta a platform_admins, la misma fuente que
 * is_platform_admin()/is_super_admin() en la base.
 *
 * Antes esto miraba profiles.role === 'admin', y eso estaba mal por los dos
 * lados: ningún usuario tiene ese rol (el único admin real de plataforma es
 * super_admin y quedaba FUERA), y profiles.role lo puede escribir el propio
 * usuario — la policy UPDATE de profiles es USING (auth.uid() = id) y RLS no
 * distingue columnas, así que un rol autoasignado no es una credencial.
 */
async function isPlatformAdmin(userId: string): Promise<boolean> {
    const { data } = await supabase
        .from('platform_admins')
        .select('profile_id')
        .eq('profile_id', userId)
        .eq('is_active', true)
        .limit(1);
    return (data ?? []).length > 0;
}

/** ¿El usuario puede gestionar las finanzas del dueño? (espejo de can_manage_finances) */
async function canManageFinances(userId: string, ownerType: OwnerType, ownerId: string): Promise<boolean> {
    if (await isPlatformAdmin(userId)) return true;

    if (ownerType === 'school') {
        // Correlacionar SIEMPRE con la escuela. La versión anterior caía a
        // `profile?.role === 'school_admin' || 'owner'` IGNORANDO ownerId: con
        // un rol autoasignado se llegaba al facturador de CUALQUIER escuela.
        // (Y 'owner' ni existe en el enum user_role — esa mitad era código
        // muerto.) Los dos caminos de abajo son los mismos que
        // user_admin_school_ids(): membresía administrativa activa, o ser el
        // owner_id de la escuela. Sin el segundo, los 64 dueños que hoy operan
        // el facturador y no tienen fila de membresía se quedaban afuera.
        const { data: school } = await supabase
            .from('schools').select('owner_id').eq('id', ownerId).maybeSingle();
        if (school?.owner_id === userId) return true;

        // limit(1) y no maybeSingle(): school_members no garantiza una sola
        // fila por (escuela, perfil) y un duplicado no debe volverse un 500.
        const { data: members } = await supabase
            .from('school_members')
            .select('role')
            .eq('school_id', ownerId)
            .eq('profile_id', userId)
            .eq('status', 'active')
            .in('role', ADMIN_MEMBER_ROLES)
            .limit(1);
        return (members ?? []).length > 0;
    }
    if (ownerType === 'vendor') {
        const { data: vp } = await supabase
            .from('vendor_profiles').select('user_id').eq('id', ownerId).maybeSingle();
        return vp?.user_id === userId;
    }
    // organizer
    return ownerId === userId;
}

/**
 * ¿El dueño tiene facturador ENCENDIDO? Mismo criterio que el barrido
 * automático (enabled = true) y que resolveInvoiceProvider().
 *
 * Se pregunta antes del barrido para fallar rápido y con motivo, en vez de
 * iterar cientos de pagos que van a rebotar uno por uno con
 * 'no_invoice_provider'. Apagar el facturador es la única palanca que detiene
 * la emisión de una escuela (hoy Dynasty está apagada a propósito), así que
 * esta ruta la respeta explícitamente.
 */
async function hasEnabledProvider(ownerType: OwnerType, ownerId: string): Promise<boolean> {
    const { data } = await supabase
        .from('electronic_invoice_providers')
        .select('id')
        .eq('owner_type', ownerType)
        .eq('owner_id', ownerId)
        .eq('enabled', true)
        .limit(1);
    return (data ?? []).length > 0;
}

function parseOwnerType(v: string): OwnerType | null {
    return OWNER_TYPES.includes(v as OwnerType) ? (v as OwnerType) : null;
}

// ─── Providers ───────────────────────────────────────────────────────────────

router.get('/providers/:ownerType/:ownerId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { ownerType: ownerTypeRaw, ownerId } = req.params as { ownerType: string; ownerId: string };
    const ownerType = parseOwnerType(ownerTypeRaw);
    if (!ownerType) return res.status(400).json({ error: 'invalid_owner_type' });
    if (!(await canManageFinances(req.user.id, ownerType, ownerId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const { data, error } = await supabase
        .from('electronic_invoice_providers')
        .select('id, provider, config, sandbox, is_default, enabled, created_at, updated_at')
        .eq('owner_type', ownerType)
        .eq('owner_id', ownerId)
        .order('is_default', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    // config se devuelve (no tiene secretos); credentials NO.
    return res.status(200).json({ providers: data ?? [], supported: listSupportedProviders() });
});

router.post('/providers/:ownerType/:ownerId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { ownerType: ownerTypeRaw, ownerId } = req.params as { ownerType: string; ownerId: string };
    const ownerType = parseOwnerType(ownerTypeRaw);
    if (!ownerType) return res.status(400).json({ error: 'invalid_owner_type' });

    const parsed = ProviderUpsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });
    if (!(await canManageFinances(req.user.id, ownerType, ownerId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const p = parsed.data;
    const { data, error } = await supabase
        .from('electronic_invoice_providers')
        .upsert(
            {
                owner_type: ownerType,
                owner_id: ownerId,
                provider: p.provider,
                credentials: p.credentials,
                config: p.config,
                sandbox: p.sandbox ?? true,
                is_default: p.isDefault ?? false,
                enabled: p.enabled ?? true,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'owner_type,owner_id,provider' },
        )
        .select('id, provider, config, sandbox, is_default, enabled')
        .single();
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ provider: data });
});

router.delete('/providers/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params as { id: string };
    const { data: target } = await supabase
        .from('electronic_invoice_providers')
        .select('owner_type, owner_id')
        .eq('id', id)
        .maybeSingle();
    if (!target) return res.status(404).json({ error: 'not_found' });
    if (!(await canManageFinances(req.user.id, target.owner_type as OwnerType, target.owner_id))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const { error } = await supabase.from('electronic_invoice_providers').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
});

// ─── Emisión ─────────────────────────────────────────────────────────────────

router.post('/emit/:paymentId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { paymentId } = req.params as { paymentId: string };

    // Solo quien administra la escuela del pago puede emitir manualmente.
    const { data: payment } = await supabase
        .from('payments').select('school_id, status').eq('id', paymentId).maybeSingle();
    if (!payment) return res.status(404).json({ error: 'payment_not_found' });
    if (!payment.school_id) return res.status(400).json({ error: 'payment_without_school' });
    if (!(await canManageFinances(req.user.id, 'school', payment.school_id))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    // Una factura electrónica es un documento fiscal: solo se emite por plata
    // que ENTRÓ. Los otros dos orígenes ya lo validan ('tx_not_paid' /
    // 'order_not_paid'); el de pagos era el único sin el chequeo, y por acá
    // pasa el grueso de la cartera pendiente. Un número de la resolución DIAN
    // gastado en un cobro que nunca se cobró no se recupera.
    if (payment.status !== 'paid') {
        return res.status(422).json({ ok: false, error: 'payment_not_paid', status: payment.status });
    }

    const result = await emitInvoiceForPayment(paymentId);
    return res.status(result.ok ? 200 : 422).json(result);
});

// ─── Backfill ────────────────────────────────────────────────────────────────

/**
 * Tope de pagos por llamada. El barrido automático ve solo los últimos 3 días,
 * así que todo lo anterior se factura por acá: el tope tiene que dar para un
 * mes entero de una escuela grande (septiembre 2026 de Dynasty son 147 pagos)
 * sin dejar que una sola llamada barra el histórico completo.
 */
const BACKFILL_MAX_LIMIT = 200;
const BACKFILL_DEFAULT_LIMIT = 50;
/** Ventana máxima: un trimestre. Evita un `from` de 2020 por dedo torpe. */
const BACKFILL_MAX_DAYS = 92;

const BackfillSchema = z.object({
    // Rango OBLIGATORIO y cerrado: sin él, "backfill" es "factura todo lo que
    // encuentres", que es exactamente lo que no queremos poder pedir.
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from debe ser YYYY-MM-DD'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to debe ser YYYY-MM-DD'),
    limit: z.number().int().positive().max(BACKFILL_MAX_LIMIT).optional(),
});

/**
 * POST /backfill/:ownerType/:ownerId — emite las facturas que el cron no
 * alcanzó, en un rango cerrado de fechas.
 *
 * Seguro de llamar dos veces: la emisión es idempotente por
 * (owner, reference_code) y por payment_id, así que un pago ya facturado
 * vuelve como `skipped`, no como una segunda factura.
 */
router.post('/backfill/:ownerType/:ownerId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { ownerType: ownerTypeRaw, ownerId } = req.params as { ownerType: string; ownerId: string };
    const ownerType = parseOwnerType(ownerTypeRaw);
    if (!ownerType) return res.status(400).json({ error: 'invalid_owner_type' });

    const parsed = BackfillSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });
    if (!(await canManageFinances(req.user.id, ownerType, ownerId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const { from, to } = parsed.data;
    const limit = parsed.data.limit ?? BACKFILL_DEFAULT_LIMIT;

    const desde = new Date(`${from}T00:00:00Z`);
    const hasta = new Date(`${to}T00:00:00Z`);
    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
        return res.status(400).json({ error: 'invalid_date_range' });
    }
    if (desde > hasta) return res.status(400).json({ error: 'from_after_to' });
    const dias = Math.round((hasta.getTime() - desde.getTime()) / 86_400_000) + 1;
    if (dias > BACKFILL_MAX_DAYS) {
        return res.status(400).json({ error: 'date_range_too_wide', maxDays: BACKFILL_MAX_DAYS, days: dias });
    }

    // Facturador apagado = no se emite, ni por acá ni por el cron. Se responde
    // 409 y no se llama al servicio: el barrido no debe ser la puerta trasera
    // que reactive una escuela que alguien apagó a mano.
    if (!(await hasEnabledProvider(ownerType, ownerId))) {
        return res.status(409).json({ error: 'invoicing_disabled', ownerType, ownerId });
    }

    const result = await backfillInvoices({ ownerType, ownerId, from, to, limit });

    // 200 siempre que el barrido haya corrido: los rechazos individuales son
    // parte del resultado esperado y van en el desglose, no en el status HTTP.
    return res.status(200).json({ ok: true, ownerType, ownerId, from, to, limit, ...result });
});

// ─── Anulación con nota crédito ──────────────────────────────────────────────

const CreditNoteSchema = z.object({
    // El concepto es OBLIGATORIO y no tiene default: determina el significado
    // fiscal del documento que se va a emitir (anulación total, devolución
    // parcial, ajuste de precio…) y adivinarlo por omisión es justo lo que no
    // se debe poder pedir.
    //
    // Se valida con el guard del catálogo compartido y no con una lista de
    // literales escrita acá: el catálogo oficial de la DIAN ya vive en
    // services/invoicing/types (CORRECTION_CONCEPTS) y una segunda copia en
    // esta ruta sería un sitio más donde quedar desactualizado.
    correctionConceptCode: z.string().refine(isCorrectionConceptCode, {
        message: 'concepto de corrección desconocido (catálogo DIAN 1-6)',
    }),
    // Viaja al `observation` de la nota crédito (el tope es del API del PAC) y
    // se guarda en void_reason: es la única explicación que queda de por qué se
    // anuló, y del lado del PAC es la que sobrevive.
    reason: z.string().trim().max(CREDIT_NOTE_OBSERVATION_MAX).optional(),
});

const ParamInvoiceId = z.object({ invoiceId: z.string().uuid() });

/**
 * HTTP para cada motivo de rechazo. Importa más de lo que parece: el cliente
 * lanza excepción con TODO lo que no sea 2xx y usa el campo `error` como
 * mensaje, así que el código HTTP es lo que decide si la pantalla muestra
 * «no se pudo» o abre el diálogo de reintento.
 *
 *   404 → no existe.
 *   409 → conflicto de ESTADO: el documento está en una situación en la que la
 *         anulación no aplica (ya anulada, sin número, sin confirmar). Se
 *         arregla cambiando el estado, no la petición.
 *   422 → la petición está bien pero NO se puede cumplir: falta el rango de
 *         notas crédito, el PAC no las soporta, o el PAC la rechazó.
 */
function voidHttpStatus(error?: string): number {
    if (error === 'invoice_not_found') return 404;
    if (
        error === 'invoice_already_void'
        || error === 'not_an_invoice'
        || error === 'invoice_pending_reconciliation'
        || error === 'invoice_without_number'
    ) return 409;
    return 422;
}

/**
 * POST /credit-note/:invoiceId — anula una factura emitiendo la nota crédito.
 *
 * NO HAY VUELTA ATRÁS: consume un número del rango de notas crédito y el
 * documento queda ante la DIAN para siempre. Por eso es la operación más
 * sensible de este router, y por eso el dueño se lee de la FILA y no de la URL:
 * un invoiceId no implica de quién es la factura, y confiar en que sí lo implica
 * es exactamente cómo se llega al facturador de otra escuela.
 *
 * Responde `mode` además de `ok`: 'credit_note' cuando salió una nota crédito
 * real, 'discarded' cuando la factura nunca llegó a la DIAN y solo se cerró el
 * intento de nuestro lado. Decirle «anulada ante la DIAN» a alguien en el
 * segundo caso sería falso.
 */
router.post('/credit-note/:invoiceId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const parsedParams = ParamInvoiceId.safeParse(req.params);
    // Sin esto, un id que no es uuid llega a PostgREST y vuelve como un 500 con
    // un error de casteo de Postgres en vez de un 400.
    if (!parsedParams.success) return res.status(400).json({ error: 'invalid_invoice_id' });
    const { invoiceId } = parsedParams.data;

    const parsed = CreditNoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });

    // El dueño sale de la factura. Se consulta ANTES de autorizar y ANTES de
    // llamar al servicio, y solo para eso: quién manda es la fila.
    const { data: invoice } = await supabase
        .from('electronic_invoices')
        .select('id, owner_type, owner_id')
        .eq('id', invoiceId)
        .maybeSingle();
    if (!invoice) return res.status(404).json({ error: 'invoice_not_found' });

    const ownerType = parseOwnerType(invoice.owner_type as string);
    // La columna tiene CHECK, así que esto no debería pasar; el guard existe
    // porque un owner_type inesperado caería en la rama 'organizer' de
    // canManageFinances, que compara ownerId con el usuario — un fail-OPEN.
    if (!ownerType) return res.status(500).json({ error: 'invalid_owner_type_in_row' });

    if (!(await canManageFinances(req.user.id, ownerType, invoice.owner_id))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const result = await voidInvoice({
        invoiceId,
        correctionConceptCode: parsed.data.correctionConceptCode as CorrectionConceptCode,
        reason: parsed.data.reason,
        // Queda en voided_by: quién anuló es parte del rastro fiscal.
        actorId: req.user.id,
    });

    if (!result.ok) {
        return res.status(voidHttpStatus(result.error)).json({
            ok: false,
            error: result.error ?? 'void_failed',
            message: result.message ?? null,
            invoiceStatus: result.invoiceStatus ?? null,
            creditNote: result.creditNote ?? null,
        });
    }

    return res.status(200).json({
        ok: true,
        mode: result.mode,
        creditNote: result.creditNote ?? null,
        invoiceStatus: result.invoiceStatus ?? 'void',
        message: result.message ?? null,
    });
});

// ─── Consulta ────────────────────────────────────────────────────────────────

router.get('/invoices/:ownerType/:ownerId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { ownerType: ownerTypeRaw, ownerId } = req.params as { ownerType: string; ownerId: string };
    const ownerType = parseOwnerType(ownerTypeRaw);
    if (!ownerType) return res.status(400).json({ error: 'invalid_owner_type' });
    if (!(await canManageFinances(req.user.id, ownerType, ownerId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    // error_message, cufe y reference_code van en el select a propósito: la
    // tabla los guarda desde siempre, pero al no devolverlos la pantalla del
    // dueño mostraba un rechazo idéntico a una factura en trámite. Así se
    // acumularon rechazos sin que nadie se enterara. reference_code además es
    // la única forma de casar la fila con el documento en el PAC cuando la
    // emisión falló antes de que hubiera número.
    // Las tres últimas columnas son el rastro de la anulación:
    // `voided_by_invoice_id` apunta a OTRA fila de esta misma lista (la nota
    // crédito), y es lo que permite mostrar con qué documento se anuló una
    // factura.
    const conAnulacion = await supabase
        .from('electronic_invoices')
        .select('id, payment_id, provider, document_type, number, cufe, reference_code, status, error_message, public_url, total, taxable_amount, tax_amount, validated_at, created_at, voided_at, void_reason, voided_by_invoice_id')
        .eq('owner_type', ownerType)
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(200);

    let filas: any[] | null = conAnulacion.data as any[] | null;
    let error = conAnulacion.error;

    // Esas tres columnas llegan con la migración 20260910092915, y en este repo
    // las migraciones se aplican A MANO (el registro no dice qué está
    // aplicado). Si todavía no están, esta pantalla —la ÚNICA vista que la
    // escuela tiene de sus facturas reales— no puede quedarse en blanco por
    // pedir tres columnas de más: se repite la consulta sin ellas y el cliente,
    // que ya las trata como opcionales, pinta la tabla igual. Este bloque se
    // puede borrar en cuanto la migración esté aplicada en los tres ambientes.
    if (error && (error as any).code === '42703') {
        console.warn('[invoicing] listado sin columnas de anulación: falta la migración 20260910092915');
        const sinAnulacion = await supabase
            .from('electronic_invoices')
            .select('id, payment_id, provider, document_type, number, cufe, reference_code, status, error_message, public_url, total, taxable_amount, tax_amount, validated_at, created_at')
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .order('created_at', { ascending: false })
            .limit(200);
        filas = sinAnulacion.data as any[] | null;
        error = sinAnulacion.error;
    }

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ invoices: filas ?? [] });
});

router.get('/by-payment/:paymentId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { paymentId } = req.params as { paymentId: string };

    // Un pago puede tener VARIAS filas desde que se pueden anular facturas: la
    // anulada queda (un documento con CUFE no se borra) y la reemisión crea
    // otra. Sin `limit(1)`, `maybeSingle()` sobre dos filas no devuelve la
    // primera: revienta con «multiple rows returned», y esta ruta es la que el
    // PADRE consulta para ver su factura. Se devuelve la más reciente, que es
    // el documento vigente; si es la anulada, el estado 'void' lo dice.
    const { data: invoice, error } = await supabase
        .from('electronic_invoices')
        .select('id, owner_type, owner_id, payment_id, provider, number, cufe, qr_url, qr_image, public_url, status, total, taxable_amount, tax_amount, validated_at, created_at')
        .eq('payment_id', paymentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!invoice) return res.status(404).json({ error: 'not_found' });

    // Autorizado si administra el dueño, o si es el pagador del pago.
    const owns = await canManageFinances(req.user.id, invoice.owner_type as OwnerType, invoice.owner_id);
    let isPayer = false;
    if (!owns) {
        const { data: pay } = await supabase
            .from('payments').select('parent_id').eq('id', paymentId).maybeSingle();
        isPayer = pay?.parent_id === req.user.id;
    }
    if (!owns && !isPayer) return res.status(403).json({ error: 'forbidden' });

    return res.status(200).json({ invoice });
});

export default router;
