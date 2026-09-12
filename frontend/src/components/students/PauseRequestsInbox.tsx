/**
 * Bandeja de solicitudes de pausa pendientes (lado admin).
 * Spec: docs/specs/pausa-vacaciones-enrollments.md §9.1
 *
 * Solo aparece cuando hay algo que resolver: una tarjeta vacía y permanente
 * sería ruido en una pantalla que ya tiene mucho.
 *
 * Aprobar exime de pagar, o sea otorga un beneficio económico — la RPC lo gatea
 * con `is_school_admin`, nunca con el alcance de staff, así que un coach no
 * puede resolver nada acá aunque llegue a ver la lista.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { PAUSE_REASON_LABEL, mesLegible, type PauseRequest } from '@/hooks/usePauses';

interface Props {
  requests: PauseRequest[];
  /** enrollment_id → nombre del atleta. La solicitud guarda la identidad, no el
   *  nombre, así que lo resuelve la pantalla que ya tiene la lista cargada. */
  nameByEnrollment: Map<string, string>;
  onApprove: (args: { requestId: string; note?: string }) => void;
  onReject: (args: { requestId: string; note?: string }) => void;
  isBusy?: boolean;
}

export default function PauseRequestsInbox({
  requests, nameByEnrollment, onApprove, onReject, isBusy,
}: Props) {
  const [notas, setNotas] = useState<Record<string, string>>({});

  if (!requests.length) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          🏖️ Solicitudes de pausa
          <Badge variant="secondary">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((r) => {
          const rango = r.month_from === r.month_to
            ? mesLegible(r.month_from)
            : `${mesLegible(r.month_from)} a ${mesLegible(r.month_to)}`;
          return (
            <div key={r.id} className="rounded-md border bg-background p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <strong>{nameByEnrollment.get(r.enrollment_id) ?? 'Atleta'}</strong>
                <Badge variant="outline" className="text-[10px]">
                  {PAUSE_REASON_LABEL[r.reason]}
                </Badge>
                <span className="text-muted-foreground">{rango}</span>
                <span className="text-muted-foreground text-xs">
                  · lo pidió {r.source === 'athlete' ? 'el atleta' : 'el acudiente'}
                </span>
              </div>

              {r.reason_note && (
                <p className="text-xs text-muted-foreground italic">"{r.reason_note}"</p>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  className="h-8 text-xs"
                  placeholder="Nota para el acudiente (opcional)"
                  value={notas[r.id] ?? ''}
                  onChange={(e) => setNotas((prev) => ({ ...prev, [r.id]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm" className="h-8" disabled={isBusy}
                    onClick={() => onApprove({ requestId: r.id, note: notas[r.id] })}
                  >
                    {isBusy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Aprobar
                  </Button>
                  <Button
                    size="sm" variant="outline" className="h-8" disabled={isBusy}
                    onClick={() => onReject({ requestId: r.id, note: notas[r.id] })}
                  >
                    Rechazar
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
