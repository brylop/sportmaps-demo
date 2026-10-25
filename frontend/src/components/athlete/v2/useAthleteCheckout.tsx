/**
 * El ÚNICO checkout del deportista adulto (PaymentCheckoutModal), igual que
 * AthletePaymentsPage y Pagos del acudiente: sesión firmada por el BFF o
 * comprobante. Lo usan Hoy («Pagar $X») y Pagos.
 *
 * Varios cobros marcados se pagan en fila, uno por uno (el BFF firma la sesión
 * de UN cobro). «Ya transferí»: un comprobante para UN cobro, nunca en fila.
 * Si cierra el modal con cobros en fila, se le dice cuántos quedan.
 */
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { PaymentCheckoutModal } from '@/components/payment/PaymentCheckoutModal';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { normalizeReceiptUrl } from '@/lib/normalizeReceiptUrl';
import { getAthleteEnrollments, type AthleteEnrollment } from '@/lib/athlete/queries';
import { formatCurrency } from '@/lib/utils';
import { PAYABLE_STATES, rowTitle, type Transaction } from '@/components/parent/v2/pagosModel';
import { athleteCobrosKey } from './useAthleteV2Data';

interface Seleccion {
  key: string;
  paymentId?: string;
  schoolId: string;
  teamId?: string;
  amount: number;
  concept: string;
  paymentCategory?: string | null;
}

const desdeCobro = (t: Transaction): Seleccion => ({
  key: t.id,
  paymentId: t.id,
  schoolId: t.school_id || '',
  amount: Number(t.balance_pending || t.amount || 0),
  concept: rowTitle(t),
  paymentCategory: t.payment_category ?? null,
});

export function useAthleteCheckout(userId: string | undefined, nombre: string) {
  const queryClient = useQueryClient();
  const [sel, setSel] = useState<Seleccion | null>(null);
  const [open, setOpen] = useState(false);
  const [fila, setFila] = useState<Transaction[]>([]);
  const exito = useRef(false);
  const [picker, setPicker] = useState(false);
  const [inscripciones, setInscripciones] = useState<AthleteEnrollment[] | null>(null);
  const [errorInscripciones, setErrorInscripciones] = useState(false);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: athleteCobrosKey(userId) });

  const abrir = (s: Seleccion) => {
    setSel(s);
    setOpen(true);
  };

  const pagar = (rows: Transaction[]) => {
    const payable = rows.filter((t) => PAYABLE_STATES.includes(t.status));
    if (payable.length === 0) return;
    const [first, ...rest] = payable;
    setFila(rest);
    if (rest.length > 0) {
      toast(`Vas a pagar ${payable.length} cobros, uno por uno`, { description: `Empezamos por ${rowTitle(first)}.` });
    }
    abrir(desdeCobro(first));
  };

  const subirComprobante = (rows: Transaction[]) => {
    const payable = rows.filter((t) => PAYABLE_STATES.includes(t.status));
    if (payable.length === 0) return;
    setFila([]);
    if (payable.length > 1) {
      toast('Un comprobante por cobro', {
        description: `Sube aquí el comprobante de ${rowTitle(payable[0])}. Si hiciste una sola transferencia por varios cobros, avísale a la escuela para que la reparta.`,
      });
    }
    abrir(desdeCobro(payable[0]));
  };

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) return;
    if (!exito.current && fila.length > 0) {
      toast(`Quedan ${fila.length} ${fila.length === 1 ? 'cobro' : 'cobros'} por pagar`, {
        description: 'Los puedes pagar cuando quieras desde «Por pagar».',
      });
      setFila([]);
    }
    exito.current = false;
  };

  const onSuccess = () => {
    exito.current = true;
    void refrescar();
    if (fila.length === 0) return;
    const [next, ...rest] = fila;
    setFila(rest);
    setTimeout(() => {
      toast('Listo', { description: `Sigue: ${rowTitle(next)}.` });
      abrir(desdeCobro(next));
    }, 0);
  };

  const verRecibo = async (t: Transaction) => {
    const url = t.receipt_url;
    if (!url) return;
    if (url.startsWith('http')) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    const { data, error } = await supabase.storage.from('payment-receipts').createSignedUrl(normalizeReceiptUrl(url), 300);
    if (error || !data?.signedUrl) {
      toast.error('No pudimos abrir el recibo', { description: 'Inténtalo de nuevo en un momento.' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  /** «Pagar otro concepto»: adelantar una mensualidad sin cobro creado (modo create, como AthletePaymentsPage). */
  const nuevoPago = async () => {
    setPicker(true);
    setInscripciones(null);
    setErrorInscripciones(false);
    try {
      setInscripciones((await getAthleteEnrollments()) ?? []);
    } catch {
      setErrorInscripciones(true);
    }
  };

  const modal = (
    <>
      {sel && (
        <PaymentCheckoutModal
          key={sel.key}
          open={open}
          onOpenChange={onOpenChange}
          studentId={userId || ''}
          schoolId={sel.schoolId}
          paymentId={sel.paymentId}
          teamId={sel.teamId}
          childName={nombre || undefined}
          amount={sel.amount}
          concept={sel.concept}
          paymentCategory={sel.paymentCategory ?? null}
          mode={sel.paymentId ? 'update' : 'create'}
          onSuccess={onSuccess}
        />
      )}
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Qué quieres pagar?</DialogTitle>
            <DialogDescription>Elige una de tus inscripciones para adelantar el pago.</DialogDescription>
          </DialogHeader>
          <div className="max-h-list space-y-2 overflow-y-auto py-2">
            {errorInscripciones ? (
              <p role="alert" className="text-sm text-destructive">No pudimos cargar tus inscripciones. Inténtalo de nuevo.</p>
            ) : inscripciones === null ? (
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" aria-label="Cargando tus inscripciones" />
            ) : inscripciones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tienes inscripciones activas para pagar.</p>
            ) : (
              inscripciones.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="flex min-h-touch w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left hover:bg-muted/50"
                  onClick={() => {
                    setPicker(false);
                    setFila([]);
                    abrir({
                      key: `nuevo-${e.id}`,
                      schoolId: e.school_id,
                      teamId: e.team_id || undefined,
                      amount: e.price_monthly || 0,
                      concept: `Pago mensualidad - ${e.program_name}`,
                    });
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{e.program_name}</span>
                    <span className="block text-xs text-muted-foreground">{e.school_name}</span>
                  </span>
                  <span className="text-sm font-bold">{formatCurrency(e.price_monthly || 0)}</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  return { pagar, subirComprobante, verRecibo, nuevoPago, modal };
}
