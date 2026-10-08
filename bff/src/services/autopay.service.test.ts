/**
 * Motor del débito automático (F2) — docs/specs/debito-automatico.md §14 F2.
 *
 * Wompi, la base y los avisos van simulados (AutopayDeps): se fija la DECISIÓN del
 * motor, no el SQL (eso lo prueban supabase/tests/autopay A01-A05). Casos:
 *   · aviso: se marca noticed solo si el aviso salió (D4); skips avisados;
 *   · cobro APPROVED síncrono → se concilia por el handler del webhook;
 *   · PENDING → pending_provider; el barrido lo reconsulta con backoff o lo concilia;
 *   · DECLINED desde el webhook → aviso con la fecha del reintento, o «agotado»;
 *   · sin respuesta de Wompi → queda processing; el barrido decide por referencia;
 *   · D11 comercio distinto → release + incidente + aviso, sin cobrar;
 *   · §7.3 checkout manual viejo: PENDING/APPROVED → se libera; sin tx → se expira y se cobra;
 *   · carrera con un checkout nuevo (23505) → se libera;
 *   · cobro doble (webhook y red diaria) → incidente + avisos;
 *   · latido y cron perdido; tokens de aceptación solo con el flag.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: {} }));
vi.mock('@sentry/node', () => ({ captureMessage: vi.fn() }));

import {
    runDaily, runSweep, procesarIntento, autopayAlResultado, autopayCobroDoble,
    proximaReconsulta, fechaLarga, pesos, type AutopayDeps, type ClaimRow, type WompiTx,
} from './autopay.service';
import type { WompiCreds } from './wompi.service';

const CREDS: WompiCreds = { publicKey: 'pub_test_x', privateKey: 'prv_test_x', integritySecret: 'i', eventsSecret: 'e', sandbox: true };
const NOW = new Date('2026-10-08T12:00:00Z');

function claim(over: Partial<ClaimRow> = {}): ClaimRow {
    return {
        attempt_id: 'att-1', cycle_id: 'cyc-1', payment_id: 'pay-1', subscription_id: 'sub-1',
        school_id: 'sch-1', payer_user_id: 'usr-1', amount: 157500, attempt_no: 1,
        payment_token_id: 'tok-1', provider_payment_source_id: 4321, payment_method_type: 'NEQUI',
        provider_merchant_id: 'M1', manual_link_id: null, manual_link_reference: null, ...over,
    };
}

function tx(id: string, status: string): WompiTx {
    return { id, status, reference: 'SCH-X-1', amount_in_cents: 15750000, currency: 'COP', payment_method_type: 'NEQUI', created_at: NOW.toISOString() };
}

type Llamada = { fn: string; args: any };

function crearDeps(over: Partial<AutopayDeps> & { rpcData?: Record<string, any> } = {}) {
    const llamadas: Llamada[] = [];
    const avisos: any[] = [];
    const alertas: { kind: string; detail: any }[] = [];
    const links: any[] = [];
    const linkStatus: Record<string, string> = {};
    const rpcData: Record<string, any> = {
        autopay_plan_cycles: [], autopay_claim_due: [], autopay_sweep_due: [],
        autopay_finish_attempt: { ok: true }, autopay_record_incident: { ok: true, incident_id: 'inc-1' },
        ...over.rpcData,
    };
    let claimCalls = 0;
    const deps: AutopayDeps = {
        rpc: async (fn, args) => {
            llamadas.push({ fn, args });
            if (fn === 'autopay_claim_due') {
                // Un lote y después vacío (como la base: lo reclamado ya no vuelve).
                return { data: claimCalls++ === 0 ? rpcData.autopay_claim_due : [], error: null };
            }
            return { data: typeof rpcData[fn] === 'function' ? rpcData[fn](args) : rpcData[fn] ?? { ok: true }, error: null };
        },
        store: {
            paymentForLink: async () => ({ amount: 150000, feePct: 5 }),
            payerEmail: async () => 'papa@example.com',
            insertAutopayLink: async (row) => { links.push(row); return { ok: true, id: 'lnk-1' }; },
            setLinkStatus: async (id, st) => { linkStatus[id] = st; },
            contexto: async () => ({
                payerUserId: 'usr-1', schoolId: 'sch-1', schoolOwnerId: 'own-1', athleteName: 'Sofía',
                periodLabel: 'octubre', methodLabel: 'Nequi •••• 5678', maxAmount: 180000, subscriptionStatus: 'active',
            }),
            cycleState: async () => ({ state: 'noticed', next_attempt_on: '2026-10-09' }),
            cycleForPayment: async () => ({ cycle_id: 'cyc-1', subscription_id: 'sub-1', school_id: 'sch-1' }),
            duplicatesLast72h: async () => [],
            heartbeat: async () => ({ sweep: { at: new Date(NOW.getTime() - 5 * 60000).toISOString() }, daily: { at: NOW.toISOString() } }),
            openIncidentSince: async () => false,
            ...(over.store ?? {}),
        },
        credsForSchool: async () => CREDS,
        wompi: {
            merchantId: async () => 'M1',
            findByReference: async () => ({ ok: true, transactions: [] }),
            fetchTransaction: async (id) => tx(id, 'APPROVED'),
            charge: vi.fn(async () => ({ ok: true as const, transactionId: 'tx-1', status: 'APPROVED' })),
            acceptanceTokens: vi.fn(async () => ({ ok: true as const, tokens: { acceptanceToken: 'acc', personalDataAuthToken: 'pda', acceptancePermalink: '', personalDataPermalink: '', fetchedAt: 0 } })),
            ...(over.wompi ?? {}),
        },
        route: vi.fn(async () => ({ status: 200, body: {}, handled: true })),
        notify: async (a) => { avisos.push(a); return true; },
        alert: (kind, detail) => { alertas.push({ kind, detail }); },
        log: () => {},
        now: () => NOW,
        sleep: async () => {},
        sendAcceptanceToken: false,
        ...Object.fromEntries(Object.entries(over).filter(([k]) => !['store', 'wompi', 'rpcData'].includes(k))),
    } as AutopayDeps;
    const de = (fn: string) => llamadas.filter(l => l.fn === fn).map(l => l.args);
    return { deps, llamadas, avisos, alertas, links, linkStatus, de };
}

describe('formato', () => {
    it('fecha de calendario, pesos y backoff', () => {
        expect(fechaLarga('2026-10-08')).toBe('jueves, 8 de octubre');
        expect(pesos(157500)).toBe('$157.500');
        const creado = new Date(NOW.getTime() - 60000).toISOString();
        expect(proximaReconsulta(creado, NOW).getTime() - NOW.getTime()).toBe(2 * 60000);
        expect(proximaReconsulta(new Date(NOW.getTime() - 20 * 60000).toISOString(), NOW).getTime() - NOW.getTime()).toBe(10 * 60000);
        expect(proximaReconsulta(new Date(NOW.getTime() - 3 * 3600000).toISOString(), NOW).getTime() - NOW.getTime()).toBe(60 * 60000);
    });
});

describe('aviso previo (D4/D6)', () => {
    const plan = (action: string) => [{ cycle_id: 'cyc-1', subscription_id: 'sub-1', payment_id: 'pay-1', payer_user_id: 'usr-1', school_id: 'sch-1', action, total: 157500, first_attempt_on: action === 'notice' ? '2026-10-10' : null }];

    it('avisa y recién entonces marca noticed con el total anunciado', async () => {
        const t = crearDeps({ rpcData: { autopay_plan_cycles: plan('notice') } });
        const r = await runDaily(t.deps);
        expect(r.avisos).toBe(1);
        expect(t.avisos[0].message).toContain('$157.500');
        expect(t.avisos[0].message).toContain('Nequi •••• 5678');
        expect(t.avisos[0].message).toContain('sábado, 10 de octubre');
        expect(t.de('autopay_mark_noticed')).toEqual([{ p_cycle_id: 'cyc-1', p_announced_total: 157500 }]);
    });

    it('si el aviso no sale, NO se marca noticed (sin aviso no hay débito)', async () => {
        const t = crearDeps({ rpcData: { autopay_plan_cycles: plan('notice') }, notify: async () => false });
        const r = await runDaily(t.deps);
        expect(r.avisos_fallidos).toBe(1);
        expect(t.de('autopay_mark_noticed')).toHaveLength(0);
    });

    it('supera el tope → avisa con el tope y no marca nada', async () => {
        const t = crearDeps({ rpcData: { autopay_plan_cycles: plan('over_max_amount') } });
        await runDaily(t.deps);
        expect(t.avisos[0].message).toContain('supera el tope que autorizaste ($180.000)');
        expect(t.de('autopay_mark_noticed')).toHaveLength(0);
    });
});

describe('intento (§7.2)', () => {
    it('APPROVED síncrono: enlace autopay con el monto, cobro con la fuente y conciliación por el handler', async () => {
        const t = crearDeps();
        const r = await procesarIntento(t.deps, claim(), new Map());
        expect(r).toBe('approved');
        expect(t.links[0]).toMatchObject({
            payment_id: 'pay-1', origin: 'autopay', recurring_attempt_id: 'att-1', status: 'pending',
            gross_amount: 157500, base_amount: 150000, sportmaps_fee: 7500, fee_pct: 5,
        });
        expect(t.links[0].wompi_reference).toMatch(/^SCH-/);
        const cobro = (t.deps.wompi.charge as any).mock.calls[0][0];
        expect(cobro).toMatchObject({ paymentSourceId: 4321, amountInCents: 15750000, paymentMethodType: 'NEQUI', customerEmail: 'papa@example.com' });
        expect(cobro.acceptanceToken).toBeUndefined();
        expect(t.de('autopay_finish_attempt')[0]).toMatchObject({ p_status: 'pending_provider', p_provider_tx_id: 'tx-1', p_payment_link_id: 'lnk-1' });
        expect(t.deps.route).toHaveBeenCalledTimes(1);
    });

    it('con AUTOPAY_SEND_ACCEPTANCE_TOKEN manda tokens nuevos de /merchants/info', async () => {
        const t = crearDeps({ sendAcceptanceToken: true });
        await procesarIntento(t.deps, claim(), new Map());
        expect((t.deps.wompi.charge as any).mock.calls[0][0]).toMatchObject({ acceptanceToken: 'acc', personalDataAuthToken: 'pda' });
    });

    it('PENDING que se resuelve en segundos (lo normal, medido en sandbox) → se concilia en la misma corrida', async () => {
        let lecturas = 0;
        const t = crearDeps({ wompi: {
            charge: vi.fn(async () => ({ ok: true as const, transactionId: 'tx-9', status: 'PENDING' })),
            fetchTransaction: async (id: string) => tx(id, ++lecturas < 2 ? 'PENDING' : 'DECLINED'),
        } as any });
        expect(await procesarIntento(t.deps, claim(), new Map())).toBe('declined');
        expect(t.deps.route).toHaveBeenCalledTimes(1);
        expect(lecturas).toBe(2);
    });

    it('PENDING que no se resuelve en la espera → pending_provider, sin conciliar (barrido/webhook)', async () => {
        const t = crearDeps({ wompi: {
            charge: vi.fn(async () => ({ ok: true as const, transactionId: 'tx-9', status: 'PENDING' })),
            fetchTransaction: async (id: string) => tx(id, 'PENDING'),
        } as any });
        expect(await procesarIntento(t.deps, claim(), new Map())).toBe('pending');
        expect(t.deps.route).not.toHaveBeenCalled();
        expect(t.de('autopay_finish_attempt')).toEqual([expect.objectContaining({ p_status: 'pending_provider', p_provider_tx_id: 'tx-9' })]);
    });

    it('sin respuesta de Wompi: NO cierra el intento (lo decide el barrido por referencia)', async () => {
        const t = crearDeps({ wompi: { charge: vi.fn(async () => ({ ok: false as const, error: 'timeout' })) } as any });
        expect(await procesarIntento(t.deps, claim(), new Map())).toBe('unknown');
        expect(t.de('autopay_finish_attempt')).toHaveLength(0);
    });

    it('4xx de Wompi: error, enlace failed y aviso con la fecha del reintento', async () => {
        const t = crearDeps({ wompi: { charge: vi.fn(async () => ({ ok: false as const, statusCode: 422, error: 'validation' })) } as any });
        expect(await procesarIntento(t.deps, claim(), new Map())).toBe('declined');
        expect(t.de('autopay_finish_attempt')[0]).toMatchObject({ p_status: 'error', p_error_code: 'provider_422' });
        expect(t.linkStatus['lnk-1']).toBe('failed');
        expect(t.avisos[0].message).toContain('viernes, 9 de octubre');
    });

    it('D11: comercio distinto → release merchant_mismatch, incidente, aviso y NINGÚN cobro', async () => {
        const t = crearDeps({ wompi: { merchantId: async () => 'OTRO' } as any });
        expect(await procesarIntento(t.deps, claim(), new Map())).toBe('released_merchant_mismatch');
        expect(t.de('autopay_release_attempt')).toEqual([{ p_attempt_id: 'att-1', p_reason: 'merchant_mismatch' }]);
        expect(t.de('autopay_record_incident')[0]).toMatchObject({ p_kind: 'merchant_mismatch' });
        expect(t.deps.wompi.charge).not.toHaveBeenCalled();
        expect(t.alertas.map(a => a.kind)).toContain('merchant_mismatch');
    });

    it('sin credenciales: fail-closed, alerta y ningún cobro', async () => {
        const t = crearDeps({ credsForSchool: async () => null });
        expect(await procesarIntento(t.deps, claim(), new Map())).toBe('error');
        expect(t.deps.wompi.charge).not.toHaveBeenCalled();
        expect(t.alertas[0].kind).toBe('no_credentials');
    });

    describe('§7.3 checkout manual de más de 2 h', () => {
        const conManual = claim({ manual_link_id: 'man-1', manual_link_reference: 'SCH-MAN-1' });

        it('con transacción PENDING → se libera sin cobrar', async () => {
            const t = crearDeps({ wompi: { findByReference: async () => ({ ok: true, transactions: [{ id: 'm1', status: 'PENDING' }] }) } as any });
            expect(await procesarIntento(t.deps, conManual, new Map())).toBe('released_manual_checkout');
            expect(t.de('autopay_release_attempt')[0].p_reason).toBe('manual_checkout_open');
            expect(t.deps.wompi.charge).not.toHaveBeenCalled();
        });

        it('con APPROVED (webhook perdido) → se concilia y se libera', async () => {
            const t = crearDeps({ wompi: { findByReference: async () => ({ ok: true, transactions: [{ id: 'm1', status: 'APPROVED' }] }) } as any });
            expect(await procesarIntento(t.deps, conManual, new Map())).toBe('released_manual_checkout');
            expect(t.deps.route).toHaveBeenCalledTimes(1);
            expect(t.deps.wompi.charge).not.toHaveBeenCalled();
        });

        it('sin transacción (o solo DECLINED) → se expira el manual y se cobra', async () => {
            const t = crearDeps({ wompi: { findByReference: async () => ({ ok: true, transactions: [{ id: 'm1', status: 'DECLINED' }] }) } as any });
            expect(await procesarIntento(t.deps, conManual, new Map())).toBe('approved');
            expect(t.linkStatus['man-1']).toBe('expired');
            expect(t.deps.wompi.charge).toHaveBeenCalledTimes(1);
        });

        it('si Wompi no responde la consulta → se libera (sin saber, no se debita)', async () => {
            const t = crearDeps({ wompi: { findByReference: async () => ({ ok: false, error: 'x' }) } as any });
            expect(await procesarIntento(t.deps, conManual, new Map())).toBe('released_manual_checkout');
            expect(t.deps.wompi.charge).not.toHaveBeenCalled();
        });
    });

    it('carrera con un checkout recién abierto (23505) → se libera, gana el manual', async () => {
        const t = crearDeps({ store: { insertAutopayLink: async () => ({ ok: false, conflict: true }) } as any });
        expect(await procesarIntento(t.deps, claim(), new Map())).toBe('released_manual_checkout');
        expect(t.deps.wompi.charge).not.toHaveBeenCalled();
    });
});

describe('webhook (§8.1)', () => {
    const base = { attemptId: 'att-1', paymentId: 'pay-1', txId: 'tx-1', reference: 'SCH-1', linkId: 'lnk-1' };

    it('APPROVED cierra el intento como aprobado', async () => {
        const t = crearDeps();
        await autopayAlResultado({ ...base, internalStatus: 'paid' }, t.deps);
        expect(t.de('autopay_finish_attempt')).toEqual([expect.objectContaining({ p_status: 'approved', p_provider_tx_id: 'tx-1' })]);
        expect(t.avisos).toHaveLength(0);
    });

    it('DECLINED en el tercer intento → aviso de agotado a la familia y a la escuela', async () => {
        const t = crearDeps({ store: { cycleState: async () => ({ state: 'exhausted', next_attempt_on: null }) } as any });
        await autopayAlResultado({ ...base, internalStatus: 'rejected' }, t.deps);
        expect(t.de('autopay_finish_attempt')[0]).toMatchObject({ p_status: 'declined', p_error_code: 'wompi_rejected' });
        expect(t.avisos.map(a => a.userId)).toEqual(['usr-1', 'own-1']);
        expect(t.avisos[0].message).toContain('quedó pendiente');
    });

    it('un evento repetido (intento ya cerrado) no vuelve a avisar', async () => {
        const t = crearDeps({ rpcData: { autopay_finish_attempt: { ok: true, unchanged: true } } });
        await autopayAlResultado({ ...base, internalStatus: 'rejected' }, t.deps);
        expect(t.avisos).toHaveLength(0);
    });
});

describe('cobro doble (§8.3)', () => {
    it('webhook: incidente con la tx sobrante, alerta y avisos', async () => {
        const t = crearDeps();
        await autopayCobroDoble({ paymentId: 'pay-1', schoolId: 'sch-1', txId: 'tx-2', amount: 157500, attemptId: 'att-1', reference: 'SCH-1', linkId: 'lnk-1' }, t.deps);
        expect(t.de('autopay_finish_attempt')[0]).toMatchObject({ p_status: 'approved' });
        expect(t.de('autopay_record_incident')[0]).toMatchObject({ p_kind: 'duplicate_charge', p_provider_transaction_id: 'tx-2', p_subscription_id: 'sub-1' });
        expect(t.alertas[0].kind).toBe('duplicate_charge');
        expect(t.avisos.map(a => a.userId)).toEqual(['usr-1', 'own-1']);
    });

    it('incidente ya registrado (unchanged) → no repite avisos', async () => {
        const t = crearDeps({ rpcData: { autopay_record_incident: { ok: true, unchanged: true } } });
        await autopayCobroDoble({ paymentId: 'pay-1', schoolId: 'sch-1', txId: 'tx-2', amount: 1, attemptId: null, reference: 'SCH-1', linkId: 'lnk-1' }, t.deps);
        expect(t.avisos).toHaveLength(0);
    });

    it('red diaria: registra las tx que no son la ganadora', async () => {
        const t = crearDeps({ store: { duplicatesLast72h: async () => [{ payment_id: 'pay-1', school_id: 'sch-1', winner_tx: 'tx-1', tx: [{ id: 'tx-1', amount: 1 }, { id: 'tx-2', amount: 1 }] }] } as any });
        const r = await runDaily(t.deps);
        expect(r.cobros_dobles).toBe(1);
        expect(t.de('autopay_record_incident')).toEqual([expect.objectContaining({ p_provider_transaction_id: 'tx-2' })]);
    });
});

describe('barrido (§7.5)', () => {
    const fila = (over: any = {}) => ({
        attempt_id: 'att-1', cycle_id: 'cyc-1', payment_id: 'pay-1', school_id: 'sch-1', subscription_id: 'sub-1',
        status: 'pending_provider', provider_transaction_id: 'tx-1', provider_reference: 'SCH-1', payment_link_id: 'lnk-1',
        created_at: new Date(NOW.getTime() - 60000).toISOString(), lease_expired: false, ...over,
    });

    it('PENDING que se resolvió → se concilia por el handler', async () => {
        const t = crearDeps({ rpcData: { autopay_sweep_due: [fila()] } });
        const r = await runSweep(t.deps);
        expect(r.conciliados).toBe(1);
        expect(t.deps.route).toHaveBeenCalledTimes(1);
    });

    it('PENDING que sigue PENDING → backoff', async () => {
        const t = crearDeps({ rpcData: { autopay_sweep_due: [fila()] }, wompi: { fetchTransaction: async (id: string) => tx(id, 'PENDING') } as any });
        const r = await runSweep(t.deps);
        expect(r.reprogramados).toBe(1);
        expect(t.de('autopay_reschedule_check')[0].p_next_check_at).toBe(new Date(NOW.getTime() + 2 * 60000).toISOString());
    });

    it('PENDING de más de 24 h → incidente stale_pending y alerta', async () => {
        const viejo = new Date(NOW.getTime() - 25 * 3600000).toISOString();
        const t = crearDeps({ rpcData: { autopay_sweep_due: [fila({ created_at: viejo })] }, wompi: { fetchTransaction: async (id: string) => tx(id, 'PENDING') } as any });
        await runSweep(t.deps);
        expect(t.de('autopay_record_incident')[0].p_kind).toBe('stale_pending');
        expect(t.alertas.map(a => a.kind)).toContain('stale_pending');
    });

    it('lease vencido y Wompi tiene la transacción → se adopta y se concilia', async () => {
        const t = crearDeps({
            rpcData: { autopay_sweep_due: [fila({ status: 'processing', provider_transaction_id: null, lease_expired: true })] },
            wompi: { findByReference: async () => ({ ok: true, transactions: [{ id: 'tx-7', status: 'APPROVED' }] }) } as any,
        });
        await runSweep(t.deps);
        expect(t.de('autopay_finish_attempt')[0]).toMatchObject({ p_status: 'pending_provider', p_provider_tx_id: 'tx-7' });
        expect(t.deps.route).toHaveBeenCalledTimes(1);
        expect(t.de('autopay_record_incident')[0].p_kind).toBe('stale_lease');
    });

    it('lease vencido sin transacción en Wompi → error lease_expired y aviso', async () => {
        const t = crearDeps({ rpcData: { autopay_sweep_due: [fila({ status: 'processing', provider_transaction_id: null, lease_expired: true })] } });
        const r = await runSweep(t.deps);
        expect(r.vencidos).toBe(1);
        expect(t.de('autopay_finish_attempt')[0]).toMatchObject({ p_status: 'error', p_error_code: 'lease_expired' });
        expect(t.linkStatus['lnk-1']).toBe('failed');
    });

    it('lease vencido y Wompi no responde → no decide nada', async () => {
        const t = crearDeps({
            rpcData: { autopay_sweep_due: [fila({ status: 'processing', provider_transaction_id: null, lease_expired: true })] },
            wompi: { findByReference: async () => ({ ok: false, error: 'x' }) } as any,
        });
        await runSweep(t.deps);
        expect(t.de('autopay_finish_attempt')).toHaveLength(0);
    });
});

describe('latido y cron perdido (§10.2)', () => {
    it('cada corrida escribe su latido', async () => {
        const t = crearDeps();
        await runDaily(t.deps);
        await runSweep(t.deps);
        expect(t.de('autopay_heartbeat').map(a => a.p_run)).toEqual(['daily', 'sweep']);
    });

    it('a las 12:30 UTC sin latido diario de hoy → incidente cron_missed una vez', async () => {
        const tarde = new Date('2026-10-08T13:00:00Z');
        const t = crearDeps({ now: () => tarde, store: { heartbeat: async () => ({ daily: { at: '2026-10-07T12:00:05Z' } }) } as any });
        await runSweep(t.deps);
        expect(t.de('autopay_record_incident')).toEqual([{ p_kind: 'cron_missed' }]);
        expect(t.alertas[0]).toMatchObject({ kind: 'cron_missed', detail: { run: 'daily' } });
    });

    it('la diaria detecta un barrido parado (> 45 min)', async () => {
        const t = crearDeps({ store: { heartbeat: async () => ({ sweep: { at: new Date(NOW.getTime() - 2 * 3600000).toISOString() } }) } as any });
        await runDaily(t.deps);
        expect(t.alertas[0]).toMatchObject({ kind: 'cron_missed', detail: { run: 'sweep' } });
    });
});
