/**
 * Resultado del pago en línea (Wompi vuelve aquí: `/payment-result?id=<tx>`).
 * Rediseño V2 «Pago recibido»: una frase, un botón. Es pública (puede llegar
 * sin sesión), así que el botón lleva a Pagos solo si hay con qué.
 *
 * El valor que se muestra es el que Wompi reporta para esa transacción: aquí
 * no se calcula nada.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, Clock, Download, RefreshCw, HelpCircle } from 'lucide-react';
import { checkTransactionStatus, type WompiTransactionResult } from '@/lib/api/wompi';
import { downloadReceipt } from '@/lib/receipt-generator';
import { usePdfBranding } from '@/hooks/usePdfBranding';
import { useAuth } from '@/contexts/AuthContext';
import { cn, formatCurrency } from '@/lib/utils';
import { resultadoPago, metodoEnPalabras, destinoResultado } from '@/components/payment/paymentResultModel';

const ICONO = {
  ok: { Icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  espera: { Icon: Clock, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  error: { Icon: XCircle, cls: 'bg-destructive/10 text-destructive' },
  neutro: { Icon: XCircle, cls: 'bg-muted text-muted-foreground' },
} as const;

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="screen-safe flex items-center justify-center bg-background">
      <div className="w-full max-w-page-narrow space-y-6">{children}</div>
    </main>
  );
}

export default function PaymentResultPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const pdfBranding = usePdfBranding();
  const transactionId = searchParams.get('id');

  const [transaction, setTransaction] = useState<WompiTransactionResult | null>(null);
  const [loading, setLoading] = useState(true);

  const consultar = useCallback(() => {
    if (!transactionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    checkTransactionStatus(transactionId).then((result) => {
      setTransaction(result);
      setLoading(false);
    });
  }, [transactionId]);

  useEffect(() => { consultar(); }, [consultar]);

  const destino = destinoResultado({ logueado: !!user, rol: profile?.role });

  const handleDownloadReceipt = async () => {
    if (!transaction) return;
    await downloadReceipt({
      receiptNumber: transaction.reference,
      date: new Date(transaction.createdAt).toLocaleDateString('es-CO'),
      customerName: user?.user_metadata?.full_name || 'Cliente',
      customerEmail: user?.email,
      concept: 'Pago en línea',
      amount: transaction.amountInCents / 100,
      paymentMethod: metodoEnPalabras(transaction.paymentMethodType) ?? 'En línea',
      paymentType: 'one_time',
      schoolName: pdfBranding.schoolName ?? undefined,
      logoUrl: pdfBranding.logoUrl,
      brandingSettings: pdfBranding.brandingSettings,
    });
  };

  if (loading) {
    return (
      <Marco>
        <div className="flex flex-col items-center gap-4" aria-busy="true" aria-label="Confirmando tu pago">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-8 w-3/4 rounded-lg" />
          <Skeleton className="h-5 w-2/3 rounded-lg" />
          <p className="text-sm text-muted-foreground">Estamos confirmando tu pago con el banco…</p>
        </div>
      </Marco>
    );
  }

  if (!transaction) {
    return (
      <Marco>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <HelpCircle className="h-10 w-10" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">No pudimos confirmar este pago</h1>
          <p className="text-base text-muted-foreground">
            Puede ser la conexión. Antes de volver a pagar, revisa en Pagos si ya quedó registrado.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button className="h-14 w-full rounded-2xl text-lg font-semibold" onClick={() => navigate(destino)}>
            {user ? 'Ver mis pagos' : 'Ir al inicio'}
          </Button>
          {transactionId && (
            <Button variant="ghost" className="min-h-touch w-full" onClick={consultar}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Volver a revisar
            </Button>
          )}
        </div>
      </Marco>
    );
  }

  const r = resultadoPago(transaction.status);
  const { Icon, cls } = ICONO[r.tono];
  const metodo = metodoEnPalabras(transaction.paymentMethodType);
  const fecha = transaction.createdAt
    ? new Date(transaction.createdAt).toLocaleString('es-CO', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
    : null;
  const filas: Array<[string, string]> = [
    ['Valor', formatCurrency(transaction.amountInCents / 100)],
    ...(metodo ? [['Medio', metodo] as [string, string]] : []),
    ...(fecha ? [['Fecha', fecha] as [string, string]] : []),
    ['Referencia', transaction.reference],
  ];

  return (
    <Marco>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className={cn('flex h-20 w-20 items-center justify-center rounded-full', cls)}>
          <Icon className="h-10 w-10" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold leading-tight tracking-tight">{r.titulo}</h1>
        <p className="text-base text-muted-foreground">{r.frase}</p>
      </div>

      <dl className="overflow-hidden rounded-2xl border bg-card">
        {filas.map(([k, v], i) => (
          <div key={k} className={cn('flex min-h-touch items-center justify-between gap-4 px-4 py-2', i > 0 && 'border-t')}>
            <dt className="text-sm text-muted-foreground">{k}</dt>
            <dd className={cn('text-right', k === 'Valor' ? 'text-lg font-bold' : 'break-all text-sm font-medium')}>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2">
        <Button className="h-14 w-full rounded-2xl text-lg font-semibold" onClick={() => navigate(destino)}>
          {user ? r.accion : 'Ir al inicio'}
        </Button>
        {transaction.status === 'APPROVED' && (
          <Button variant="ghost" className="min-h-touch w-full" onClick={handleDownloadReceipt}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Descargar el recibo
          </Button>
        )}
        {transaction.status === 'PENDING' && (
          <Button variant="ghost" className="min-h-touch w-full" onClick={consultar}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Volver a revisar
          </Button>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">Powered by SportMaps</p>
    </Marco>
  );
}
