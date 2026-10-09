/**
 * BulkApproveGreensDialog — «Aprobar todos los verdes», con confirmación.
 *
 * Aprueba UNO POR UNO con el mismo camino que la hoja de aprobación
 * (lib/approvePayment): approved_by de quien confirma, payment_date de hoy,
 * inscripción activa y aviso a la familia. No es aprobación automática: una
 * persona ve cuántos son y cuánto suman, y confirma.
 *
 * Entran solo los que se aprobarían sin dudar (ver greenExclusion): verde,
 * monto leído igual al saldo, sin abonos, sin mes ya pagado. Los verdes que no
 * entran se listan con el motivo, para revisarlos de a uno.
 */
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { approvePayment, type ApprovablePayment } from '@/lib/approvePayment';
import { bulkGreenSelection, remainingOf, type QueueItem } from '@/lib/receiptReview';

type Item = QueueItem & ApprovablePayment & { athlete_name?: string | null };

interface Props {
  items: readonly Item[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  userId: string | null | undefined;
  schoolId: string | null | undefined;
  schoolName?: string | null;
}

export function BulkApproveGreensDialog({ items, open, onOpenChange, onDone, userId, schoolId, schoolName }: Props) {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  // Se congela la selección al abrir: si la lista se refresca por detrás, lo
  // que se aprueba es lo que la persona vio y confirmó.
  const [frozen, setFrozen] = useState<Item[] | null>(null);

  useEffect(() => {
    if (open) { setFrozen([...items]); setProgress(0); }
    else if (!running) setFrozen(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { eligible, excludedGreens, total } = useMemo(() => bulkGreenSelection(frozen ?? []), [frozen]);

  const handleConfirm = async () => {
    if (!userId || !schoolId || eligible.length === 0) return;
    setRunning(true);
    let ok = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const p of eligible) {
      const r = await approvePayment(p, { userId, schoolId, schoolName });
      if (!('reason' in r)) ok++;
      else if (r.reason === 'already_handled') skipped++;
      else errors.push(`${p.athlete_name || p.concept || p.id}: ${r.message}`);
      setProgress((n) => n + 1);
    }
    setRunning(false);
    toast({
      title: `${ok} cobro(s) aprobado(s)`,
      description: [
        skipped > 0 ? `${skipped} ya estaban resueltos.` : null,
        errors.length > 0 ? `${errors.length} con error: ${errors.slice(0, 2).join(' · ')}` : null,
      ].filter(Boolean).join(' ') || 'Las familias recibieron la confirmación.',
      variant: errors.length > 0 ? 'destructive' : undefined,
    });
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!running) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aprobar todos los verdes</DialogTitle>
          <DialogDescription>
            Se aprueban uno por uno, a tu nombre, igual que con el botón «Aprobar». Cada familia recibe la confirmación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              {eligible.length} comprobante(s) en verde
            </span>
            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(total)}</span>
          </div>

          {eligible.length > 0 && (
            <ul className="max-h-40 overflow-y-auto text-xs space-y-1">
              {eligible.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="truncate">{p.athlete_name || p.concept || 'Cobro'}</span>
                  <span className="font-mono shrink-0">{formatCurrency(remainingOf(p))}</span>
                </li>
              ))}
            </ul>
          )}

          {excludedGreens.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200 space-y-1">
              <p className="font-semibold">{excludedGreens.length} verde(s) quedan para revisar de a uno:</p>
              {excludedGreens.slice(0, 5).map(({ item, reason }) => (
                <p key={item.id} className="truncate">· {item.athlete_name || item.concept || 'Cobro'}: {reason}</p>
              ))}
            </div>
          )}

          {running && (
            <p className="text-xs text-muted-foreground">Aprobando {progress} de {eligible.length}…</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleConfirm}
              disabled={running || eligible.length === 0 || !userId || !schoolId}
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Aprobar {eligible.length} · {formatCurrency(total)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
