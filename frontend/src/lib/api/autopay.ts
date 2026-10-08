/**
 * Débito automático (F3) — cliente del BFF. Spec: docs/specs/debito-automatico.md §11.
 *
 * Familia: /api/v1/autopay/*   ·   Escuela: /api/v1/autopay/school/:schoolId/*
 * Las rutas que cambian estado exigen el header anti-CSRF (mismo patrón que
 * payment-tokens): se manda en cada POST/PATCH desde aquí.
 *
 * La tarjeta se tokeniza en el navegador directo contra Wompi con la llave
 * PÚBLICA del comercio de la escuela (`tokenizarTarjeta`): el número nunca pasa por
 * el BFF ni por SportMaps.
 */

import { bffClient } from './bffClient';

const BASE = '/api/v1/autopay';
const CSRF = { 'X-Requested-With': 'SportMaps' };

// ── Tipos: familia ─────────────────────────────────────────────────────────

export type MetodoTipo = 'CARD' | 'NEQUI';
export type SuscripcionEstado = 'active' | 'suspended' | 'cancelled';
export type SuspensionMotivo = 'provider_declined' | 'over_max_amount' | 'token_not_available' | 'duplicate_charge';
export type CicloEstado = 'scheduled' | 'noticed' | 'in_progress' | 'paid' | 'skipped' | 'exhausted' | 'cancelled';

export interface EscuelaDebito {
    schoolId: string;
    schoolName: string;
    /** La escuela ofrece el débito (autopay_enabled). */
    offered: boolean;
    /** Recargo que se suma al débito (0 si la escuela lo absorbe). */
    surchargePct: number;
    daysBeforeDue: number;
}

export interface MedioGuardado {
    tokenId: string;
    schoolId: string;
    type: MetodoTipo;
    /** "Visa •••• 4242", "Nequi •••• 5678" */
    label: string;
}

export interface ProximoDebito {
    cycleId: string;
    paymentId: string;
    periodMonth: number;
    periodYear: number;
    state: CicloEstado;
    /** Fecha del débito (YYYY-MM-DD) si ya se avisó. */
    date: string | null;
    total: number | null;
    /** El pagador puede tocar «Ya pagué este mes» (scheduled/noticed). */
    skippable: boolean;
}

export interface SuscripcionFamilia {
    id: string;
    status: SuscripcionEstado;
    suspendReason: SuspensionMotivo | null;
    maxAmount: number;
    method: MedioGuardado;
    nextDebit: ProximoDebito | null;
}

export interface DeportistaDebito {
    /** child:<id> o user:<id> */
    key: string;
    childId: string | null;
    athleteUserId: string | null;
    name: string;
    schoolId: string;
    /** Mensualidad vigente + recargo (lo que se debitaría hoy). null si aún no hay cobro. */
    currentTotal: number | null;
    /** Tope sugerido: total vigente + 20 %, redondeado a miles. */
    suggestedMax: number | null;
    /** Mensualidad del mes en curso pending y NO vencida (para «Debitar también <mes>»). */
    currentPeriod: { paymentId: string; periodMonth: number; periodYear: number; dueDate: string; total: number } | null;
    /** Mensualidades vencidas: el débito no las cobra (D14). */
    overdueCount: number;
    subscription: SuscripcionFamilia | null;
}

export interface MiDebito {
    schools: EscuelaDebito[];
    athletes: DeportistaDebito[];
    methods: MedioGuardado[];
}

export interface SetupDebito {
    publicKey: string;
    sandbox: boolean;
    acceptance: {
        acceptanceToken: string;
        personalDataAuthToken: string;
        acceptancePermalink: string;
        personalDataPermalink: string;
    };
}

export interface MedioCreado {
    tokenId: string;
    consentId: string;
    label: string;
    status: 'pending_authorization' | 'available';
}

export interface AltaResultado {
    key: string;
    ok: boolean;
    subscriptionId?: string;
    /** Código de autopay_create_subscription: already_subscribed, max_amount_below_current, … */
    error?: string;
}

// ── Endpoints: familia ─────────────────────────────────────────────────────

export const getMiDebito = () => bffClient.get<MiDebito>(`${BASE}/mine`);

/** Llave pública del comercio de la escuela + tokens de aceptación (un solo uso, 1 h). */
export const getSetup = (schoolId: string) =>
    bffClient.get<SetupDebito>(`${BASE}/setup?schoolId=${encodeURIComponent(schoolId)}`);

export const registrarTarjeta = (body: {
    schoolId: string; cardToken: string;
    acceptanceToken: string; personalDataAuthToken: string;
    acceptancePermalink?: string; personalDataPermalink?: string;
    brand?: string; lastFour?: string; expMonth?: string; expYear?: string;
}) => bffClient.post<MedioCreado>(`${BASE}/cards`, body, CSRF);

/** Pide la autorización en la app de Nequi. Queda pending_authorization: hacer polling con getEstadoMedio. */
export const iniciarNequi = (body: {
    schoolId: string; phone: string;
    acceptanceToken: string; personalDataAuthToken: string;
    acceptancePermalink?: string; personalDataPermalink?: string;
}) => bffClient.post<MedioCreado>(`${BASE}/nequi`, body, CSRF);

export const getEstadoMedio = (tokenId: string) =>
    bffClient.get<{ status: 'pending_authorization' | 'available' | 'declined' | 'error' | 'voided'; label: string }>(
        `${BASE}/tokens/${tokenId}`);

export const activarDebito = (body: {
    schoolId: string; tokenId: string; consentId: string;
    athletes: { childId?: string; athleteUserId?: string; maxAmount: number }[];
    includeCurrentPeriod: boolean;
}) => bffClient.post<{ results: AltaResultado[] }>(`${BASE}/subscriptions`, body, CSRF);

export const actualizarDebito = (subscriptionId: string, body: { maxAmount?: number; tokenId?: string }) =>
    bffClient.patch<{ ok: true; reactivated: boolean }>(`${BASE}/subscriptions/${subscriptionId}`, body, CSRF);

export const cancelarDebito = (subscriptionId: string) =>
    bffClient.post<{ ok: true }>(`${BASE}/subscriptions/${subscriptionId}/cancel`, {}, CSRF);

/** «Ya pagué este mes»: no debitar este ciclo. */
export const yaPague = (cycleId: string) =>
    bffClient.post<{ ok: true }>(`${BASE}/cycles/${cycleId}/skip`, {}, CSRF);

// ── Tipos y endpoints: escuela ─────────────────────────────────────────────

export interface AjustesDebito {
    offered: boolean;
    paused: boolean;
    surchargeMode: 'same_as_online' | 'none';
    daysBeforeDue: number;
}

export interface FilaPanel {
    subscriptionId: string;
    athleteName: string;
    payerName: string;
    method: string;
    status: SuscripcionEstado;
    suspendReason: SuspensionMotivo | null;
    maxAmount: number;
    cycle: {
        cycleId: string; paymentId: string; state: CicloEstado;
        skipReason: string | null; holdReason: string | null;
        nextAttemptOn: string | null; announcedTotal: number | null; attemptsUsed: number;
    } | null;
}

export interface IncidentePanel {
    id: string;
    kind: 'duplicate_charge' | 'cron_missed' | 'stale_lease' | 'stale_pending' | 'merchant_mismatch';
    state: 'open' | 'refund_requested' | 'refunded' | 'credited' | 'dismissed';
    athleteName: string | null;
    paymentId: string | null;
    amount: number | null;
    providerTransactionId: string | null;
    createdAt: string;
}

export interface PanelDebito {
    settings: AjustesDebito;
    /** La escuela tiene cuenta Wompi conectada (sin ella no se puede ofrecer). */
    gatewayReady: boolean;
    kpis: {
        active: number; suspended: number;
        /** Ciclos del mes en curso por estado. */
        cycles: { paid: number; noticed: number; inProgress: number; paidElsewhere: number; noDebit: number; scheduled: number };
        debitedThisMonth: number;
        /** % de mensualidades del mes pagadas por débito. */
        pctByDebit: number;
    };
    rows: FilaPanel[];
    incidents: IncidentePanel[];
    /** «Ya pagué» reportados por familias con el cobro aún pendiente. */
    parentSkips: { cycleId: string; paymentId: string; athleteName: string; periodMonth: number; reportedAt: string }[];
}

export const getPanelDebito = (schoolId: string) =>
    bffClient.get<PanelDebito>(`${BASE}/school/${schoolId}/panel`);

/** Guarda los ajustes. Pausar avisa a las familias activas. */
export const guardarAjustesDebito = (schoolId: string, body: AjustesDebito) =>
    bffClient.post<{ ok: true; notified?: number }>(`${BASE}/school/${schoolId}/settings`, body, CSRF);

export const cancelarDebitoEscuela = (schoolId: string, subscriptionId: string) =>
    bffClient.post<{ ok: true }>(`${BASE}/school/${schoolId}/subscriptions/${subscriptionId}/cancel`, {}, CSRF);

export const resolverIncidente = (
    schoolId: string, incidentId: string,
    body: { state: 'refund_requested' | 'refunded' | 'credited' | 'dismissed'; note?: string },
) => bffClient.post<{ ok: true }>(`${BASE}/school/${schoolId}/incidents/${incidentId}/resolve`, body, CSRF);

// ── Tokenización de tarjeta (navegador → Wompi) ────────────────────────────

/**
 * POST /v1/tokens/cards con la llave pública del comercio. Devuelve el token
 * efímero (tok_…) que el BFF convierte en fuente de pago.
 */
export async function tokenizarTarjeta(
    setup: Pick<SetupDebito, 'publicKey' | 'sandbox'>,
    card: { number: string; cvc: string; expMonth: string; expYear: string; holder: string },
): Promise<{ ok: true; token: string; brand: string | null; lastFour: string } | { ok: false; error: string }> {
    const base = setup.sandbox ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1';
    try {
        const res = await fetch(`${base}/tokens/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${setup.publicKey}` },
            body: JSON.stringify({
                number: card.number.replace(/\s+/g, ''),
                cvc: card.cvc,
                exp_month: card.expMonth.padStart(2, '0'),
                exp_year: card.expYear.slice(-2),
                card_holder: card.holder,
            }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.data?.id) {
            return { ok: false, error: 'Revisa los datos de la tarjeta e intenta de nuevo.' };
        }
        return { ok: true, token: json.data.id, brand: json.data.brand ?? null, lastFour: json.data.last_four ?? card.number.slice(-4) };
    } catch {
        return { ok: false, error: 'No pudimos conectar con la pasarela. Intenta de nuevo.' };
    }
}
