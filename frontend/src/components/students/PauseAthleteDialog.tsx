/**
 * Diálogo de pausa por vacaciones / lesión (lado admin).
 * Spec: docs/specs/pausa-vacaciones-enrollments.md §9.1
 *
 * Se elige MES desde / MES hasta, no fechas: la ventana de cobro es mensual
 * (decisión D5, sin prorrateo), así que ofrecer un date picker de días mentiría
 * sobre lo que va a pasar con la plata.
 *
 * Antes de confirmar muestra el preview que devuelve `preview_enrollment_pause`
 * — qué meses no se cobran y cuántos cobros se anulan. El número NO se calcula
 * acá: docs/censo-calculos-monetarios.md tiene 11 divergencias por hacer cuentas
 * de dinero en el navegador.
 */
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
// opcionesDeMes vive en el hook para que este diálogo y el del acudiente
// (RequestPauseDialog) ofrezcan exactamente el mismo rango de meses.
import { PAUSE_REASON_LABEL, opcionesDeMes, type PauseReason, type PausePreview } from '@/hooks/usePauses';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  athleteName: string;
  enrollmentId: string | null;
  onPreview: (enrollmentId: string, monthFrom: string, monthTo: string) => Promise<PausePreview>;
  onConfirm: (args: { enrollmentId: string; reason: PauseReason; monthFrom: string; monthTo: string; note?: string }) => void;
  isSubmitting?: boolean;
}

export default function PauseAthleteDialog({
  open, onOpenChange, athleteName, enrollmentId, onPreview, onConfirm, isSubmitting,
}: Props) {
  const meses = useMemo(() => opcionesDeMes(), []);
  const [reason, setReason] = useState<PauseReason>('vacation');
  const [monthFrom, setMonthFrom] = useState(meses[0].value);
  const [monthTo, setMonthTo] = useState(meses[0].value);
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<PausePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Rango invertido: se corrige solo en vez de dejar al usuario con un error.
  useEffect(() => {
    if (monthTo < monthFrom) setMonthTo(monthFrom);
  }, [monthFrom, monthTo]);

  useEffect(() => {
    if (!open) {
      setPreview(null); setPreviewError(null); setNote('');
      return;
    }
    if (!enrollmentId) return;
    let cancelado = false;
    setLoadingPreview(true);
    setPreviewError(null);
    onPreview(enrollmentId, monthFrom, monthTo)
      .then((p) => { if (!cancelado) setPreview(p); })
      .catch((e: any) => { if (!cancelado) setPreviewError(e?.message || 'No se pudo calcular el efecto de la pausa.'); })
      .finally(() => { if (!cancelado) setLoadingPreview(false); });
    return () => { cancelado = true; };
  }, [open, enrollmentId, monthFrom, monthTo, onPreview]);

  // Sin inscripción activa no hay nada que pausar: la pausa cuelga de la
  // inscripción, no del atleta.
  const sinInscripcion = !enrollmentId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>🏖️ Poner en pausa a {athleteName}</DialogTitle>
          <DialogDescription>
            Durante la pausa no se le generan cobros y no aparece en la lista de asistencia.
            Vuelve a aparecer el día que se lo reactive.
          </DialogDescription>
        </DialogHeader>

        {sinInscripcion ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Este atleta no tiene una inscripción activa. Asígnele un equipo o un plan antes de pausarlo.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Motivo</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as PauseReason)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAUSE_REASON_LABEL) as PauseReason[]).map((r) => (
                    <SelectItem key={r} value={r}>{PAUSE_REASON_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Desde el mes</Label>
                <Select value={monthFrom} onValueChange={setMonthFrom}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {meses.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Hasta el mes</Label>
                <Select value={monthTo} onValueChange={setMonthTo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {meses.filter((m) => m.value >= monthFrom).map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nota (opcional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                placeholder="Ej: viaje familiar, se reincorpora en agosto"
                rows={2}
              />
            </div>

            {/* Qué va a pasar, en palabras y con los números de la base. */}
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              {loadingPreview ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando…
                </span>
              ) : previewError ? (
                <span className="text-destructive">{previewError}</span>
              ) : preview ? (
                <div className="space-y-1">
                  <p>
                    <strong>No se cobrará:</strong>{' '}
                    {preview.meses.length ? preview.meses.join(', ') : '—'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {preview.payments_a_anular > 0
                      ? `Se anularán ${preview.payments_a_anular} cobro(s) pendiente(s) de esos meses.`
                      : 'No hay cobros pendientes de esos meses para anular.'}
                  </p>
                  {preview.payments_ambiguos > 0 && (
                    <p className="text-amber-600 dark:text-amber-500 text-xs">
                      ⚠️ Hay {preview.payments_ambiguos} cobro(s) del periodo cuya categoría no es
                      clara (registrados a mano, torneos, artículos). Esos <strong>no</strong> se
                      anulan solos — hay que revisarlos aparte.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={sinInscripcion || isSubmitting || loadingPreview || !!previewError}
            onClick={() => enrollmentId && onConfirm({ enrollmentId, reason, monthFrom, monthTo, note })}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar pausa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
