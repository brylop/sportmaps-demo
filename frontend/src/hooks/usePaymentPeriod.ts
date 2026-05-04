import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PeriodStatus =
  | 'unpaid'
  | 'pending'
  | 'awaiting_approval'
  | 'partial'
  | 'paid'
  | 'approved';

export interface ActivePeriod {
  year: number;
  month: number;
  status: PeriodStatus;
  label: string;
}

export interface NextPeriod {
  year: number;
  month: number;
  label: string;
  current_status: PeriodStatus;
  last_active_period: ActivePeriod | null;
}

const ACTIVE_STATUSES: ReadonlySet<PeriodStatus> = new Set([
  'pending',
  'awaiting_approval',
  'partial',
  'paid',
  'approved',
]);

export function isPeriodActive(status: PeriodStatus | undefined | null): boolean {
  return !!status && ACTIVE_STATUSES.has(status);
}

/**
 * Carga el siguiente periodo a pagar para un hijo.
 * Llama a la RPC `next_unpaid_period(child_id)` (ver migracion 20260503000004).
 */
export function useNextUnpaidPeriod(childId: string | null | undefined) {
  const [period, setPeriod] = useState<NextPeriod | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!childId) {
      setPeriod(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Cast: las RPCs nuevas (migracion 20260503000004) aun no estan en los
      // tipos generados de supabase. Llamamos via `as any` y validamos shape.
      const { data, error: rpcErr } = await (supabase.rpc as any)('next_unpaid_period', {
        p_child_id: childId,
      });
      if (rpcErr) throw rpcErr;
      setPeriod((data as unknown as NextPeriod) ?? null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown_error';
      setError(msg);
      setPeriod(null);
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { period, loading, error, reload };
}

export interface PeriodStatusResult {
  status: PeriodStatus;
  payment_id?: string;
  paid_at?: string | null;
  amount?: number;
  concept?: string;
  label?: string;
}

/**
 * Consulta puntual del estado de un periodo concreto para un hijo.
 * Util cuando el padre confirma "adelantar siguiente mes" y queremos
 * verificar que el siguiente tampoco este ya pagado.
 */
export async function fetchPeriodStatus(
  childId: string,
  year: number,
  month: number,
): Promise<PeriodStatusResult> {
  const { data, error } = await (supabase.rpc as any)('period_payment_status', {
    p_child_id: childId,
    p_period_year: year,
    p_period_month: month,
  });
  if (error) throw error;
  return (data as unknown as PeriodStatusResult) ?? { status: 'unpaid' };
}
