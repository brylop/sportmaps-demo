/**
 * Diálogo para que el acudiente (o el atleta adulto) SOLICITE una pausa por
 * vacaciones / lesión.
 * Spec: docs/specs/pausa-vacaciones-enrollments.md §9.2
 *
 * Diferencias deliberadas con el del admin (`PauseAthleteDialog`):
 *  · Acá se SOLICITA, no se aplica. El texto no promete nada: la escuela decide.
 *  · No muestra el preview de cobros a anular. Ese número es información de
 *    cartera de la escuela; al acudiente le importa qué meses pide, y prometerle
 *    "no se te cobrará" antes de la aprobación sería mentirle si se la rechazan.
 *  · Comparte `opcionesDeMes()` con el diálogo del admin para que los dos
 *    ofrezcan exactamente el mismo rango (la RPC rechaza meses pasados).
 */
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { PAUSE_REASON_LABEL, opcionesDeMes, type PauseReason } from '@/hooks/usePauses';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  athleteName: string;
  enrollmentId: string | null;
  /** Tope de meses por año de la escuela. 0 = sin tope. Solo informativo: el
   *  que manda es `pause_validar` en la base. */
  maxMonths?: number;
  onSubmit: (args: {
    enrollmentId: string; reason: PauseReason;
    monthFrom: string; monthTo: string; note?: string;
  }) => void;
  isSubmitting?: boolean;
}

export default function RequestPauseDialog({
  open, onOpenChange, athleteName, enrollmentId, maxMonths, onSubmit, isSubmitting,
}: Props) {
  const meses = useMemo(() => opcionesDeMes(), []);
  const [reason, setReason] = useState<PauseReason>('vacation');
  const [monthFrom, setMonthFrom] = useState(meses[0].value);
  const [monthTo, setMonthTo] = useState(meses[0].value);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (monthTo < monthFrom) setMonthTo(monthFrom);
  }, [monthFrom, monthTo]);

  useEffect(() => {
    if (!open) { setNote(''); setReason('vacation'); }
  }, [open]);

  // Cuántos meses pide, para decírselo antes de enviar.
  const mesesPedidos = useMemo(() => {
    const [ay, am] = monthFrom.split('-').map(Number);
    const [by, bm] = monthTo.split('-').map(Number);
    return (by * 12 + bm) - (ay * 12 + am) + 1;
  }, [monthFrom, monthTo]);

  const excedeTope = !!maxMonths && maxMonths > 0 && mesesPedidos > maxMonths;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>🏖️ Solicitar pausa para {athleteName}</DialogTitle>
          <DialogDescription>
            La escuela revisa la solicitud y decide. Si la aprueba, durante esos meses
            no se generan cobros y {athleteName.split(' ')[0]} no aparece en la lista
            de asistencia.
          </DialogDescription>
        </DialogHeader>

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
            <Label className="text-xs text-muted-foreground">
              Cuéntale a la escuela por qué (opcional)
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              placeholder="Ej: viaje familiar, vuelve en agosto"
              rows={2}
            />
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p>
              Vas a pedir <strong>{mesesPedidos} mes(es)</strong> de pausa.
            </p>
            {excedeTope && (
              <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
                ⚠️ Esta escuela permite hasta {maxMonths} mes(es) de pausa por año.
                Si ya usaste parte del cupo, la solicitud puede ser rechazada.
              </p>
            )}
            <p className="text-muted-foreground text-xs mt-1">
              Queda como <strong>pendiente</strong> hasta que la escuela responda. Nada
              cambia en tus cobros mientras tanto.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!enrollmentId || isSubmitting}
            onClick={() => enrollmentId && onSubmit({ enrollmentId, reason, monthFrom, monthTo, note })}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
