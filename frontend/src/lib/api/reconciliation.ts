/**
 * reconciliation — cliente del módulo de conciliación bancaria (Fase 6).
 */
import { bffClient } from './bffClient';
import type { StatementLine } from '@/lib/reconciliation/parseStatement';

export interface ReconcileSummary {
    pending_in_range: number;
    matched: number;
    matched_weak: number;
    glosas_opened: number;
    already_reconciled?: boolean;
}

export interface GlosaReasonCount {
    reason: string;
    status: string;
    cnt: number;
}

export async function uploadStatement(params: {
    schoolId: string;
    bank: 'nequi' | 'bancolombia' | 'generic';
    filename?: string;
    periodYear?: number;
    periodMonth?: number;
    lines: StatementLine[];
}): Promise<{ statementId: string; summary: ReconcileSummary }> {
    const { schoolId, ...body } = params;
    return bffClient.post(`/api/v1/payments/reconciliation/upload/${schoolId}`, body);
}

export async function getGlosaDashboard(
    schoolId: string,
    from?: string,
    to?: string,
): Promise<{ reasons: GlosaReasonCount[] }> {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return bffClient.get(`/api/v1/payments/reconciliation/dashboard/${schoolId}${suffix}`);
}
