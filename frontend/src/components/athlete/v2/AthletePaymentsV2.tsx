/**
 * Pagos del deportista ADULTO (V2, lienzo DepPagos): Por pagar · Pagados.
 *
 * Reutiliza la vista del acudiente (AcuPagosV2 + pagosModel) con SUS cobros
 * (`user_id` = él sin otro pagador, o `parent_id` = él) y el único checkout
 * (useAthleteCheckout → PaymentCheckoutModal), como AthletePaymentsPage.
 *
 * El menor con cuenta NO paga (decisión 6): esta pantalla le dice que su
 * acudiente lo hace y no consulta ni muestra ningún cobro.
 *
 * No se pierde nada de la clásica (/athlete-payments): estado de cuenta,
 * exportar el historial, factura y recibo, pagar otro concepto.
 */
import { Link } from 'react-router-dom';
import { Download, FileText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AcuPagosV2 } from '@/components/parent/v2/AcuPagosV2';
import { MiFacturaElectronicaCard } from '@/components/billing/MiFacturaElectronicaCard';
import type { Transaction } from '@/components/parent/v2/pagosModel';
import { rowTitle, methodLabel } from '@/components/parent/v2/pagosModel';
import { useDeportista } from './useDeportista';
import { useAthleteCheckout } from './useAthleteCheckout';
import { ESPACIO_BOTON_FLOTANTE } from './athleteV2Model';

function exportarCsv(txs: Transaction[]) {
  const celda = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const filas = txs.map((t) => [t.due_date ?? '', t.transaction_date?.slice(0, 10) ?? '', rowTitle(t), t.amount, t.status, methodLabel(t) ?? '']);
  const csv = [['Vence', 'Fecha', 'Concepto', 'Valor', 'Estado', 'Medio'], ...filas].map((r) => r.map(celda).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `mis-pagos-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function AthletePaymentsV2() {
  const d = useDeportista();
  const checkout = useAthleteCheckout(d.userId, d.nombre);

  if (!d.paga) {
    // Mientras se averigua si un deportista sin fecha de nacimiento paga, se espera.
    if (d.edad === 'desconocida' && d.cobros.isLoading) {
      return <div className="mx-auto w-full max-w-page-narrow" aria-busy="true" aria-label="Cargando tus pagos" />;
    }
    return (
      <div className="mx-auto w-full max-w-page-narrow space-y-4 pb-nav-safe">
        <h1 className="text-2xl font-bold">Pagos</h1>
        <div className="flex gap-3 rounded-2xl border bg-card p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold">Tus pagos los maneja tu acudiente</p>
            <p className="mt-1 text-sm text-muted-foreground">Él o ella paga desde su app. Aquí no tienes nada pendiente.</p>
          </div>
        </div>
      </div>
    );
  }

  const state = d.cobros.isLoading || (!d.cobros.data && !d.cobros.isError) ? 'loading' : d.cobros.isError ? 'error' : 'ready';
  const txs = d.cobros.data?.transacciones ?? [];

  // La barra «Pagar / Ya transferí» oculta sola la burbuja de soporte mientras
  // está a la vista (AcuPagosV2 → useOcultarFabSoporte).
  return (
    <div className="relative pb-nav-safe">
      <AcuPagosV2
        state={state}
        transactions={txs}
        invoiceMap={d.cobros.data?.facturas ?? {}}
        onRetry={() => { void d.cobros.refetch(); }}
        onPay={checkout.pagar}
        onUploadProof={checkout.subirComprobante}
        onShowReceipt={(t) => { void checkout.verRecibo(t); }}
        porPagarFooter={
          <div className="text-center">
            <Button variant="link" className="h-auto min-h-touch max-w-full whitespace-normal py-2 text-left text-sm" onClick={() => { void checkout.nuevoPago(); }}>
              ¿Quieres adelantar un pago? Pagar otro concepto
            </Button>
          </div>
        }
        pagadosFooter={
          <>
            <div className="flex flex-wrap justify-center gap-2">
              {d.userId && (
                <Button asChild variant="outline" size="sm" className="min-h-touch">
                  <Link to={`/estado-cuenta?user_id=${d.userId}`}>
                    <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                    Mi estado de cuenta
                  </Link>
                </Button>
              )}
              {txs.length > 0 && (
                <Button variant="outline" size="sm" className="min-h-touch" onClick={() => exportarCsv(txs)}>
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  Descargar mi historial
                </Button>
              )}
            </div>
            <MiFacturaElectronicaCard />
          </>
        }
      />
      {/* Aire al final: el botón flotante de Mapi/soporte no tapa «Ya transferí: subir el comprobante». */}
      <div aria-hidden data-testid="espacio-boton-flotante" className={ESPACIO_BOTON_FLOTANTE} />
      {checkout.modal}
    </div>
  );
}

export default AthletePaymentsV2;
