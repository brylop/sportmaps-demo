import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Users, CheckCircle2 } from 'lucide-react';
import type { BookableSession } from '@/hooks/useAthleteSessionBookings';

// Compartido entre "Mis Inscripciones" y el link público de agendamiento
// (/agendar-clase/:slug) — antes cada pantalla tenía su propia versión (la
// del link era una lista plana sin nombre de coach, sin badge Personal/
// Grupal, sin duración) y se desalineaban en cada ajuste del piloto de
// banco de horas flexible. Una sola fuente de verdad para la tarjeta.

function fmtTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

function calcDuration(start: string, end: string): string {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const totalMin = (eh * 60 + em) - (sh * 60 + sm);
  if (totalMin <= 0) return '';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function CompactSessionSlot({ sessions, noCredits, isBooking, onBook }: {
  sessions: BookableSession[]; noCredits: boolean; isBooking: boolean; onBook: (s: BookableSession) => void;
}) {
  const [selectedSessionId, setSelectedSessionId] = useState(sessions[0]?.id);
  const selectedSession = sessions.find(s => s.id === selectedSessionId) || sessions[0];

  const isFull = selectedSession.booking_status === 'full';
  const isBooked = selectedSession.already_booked;
  const isDisabled = noCredits || isFull || isBooked || isBooking;

  const alreadyBookedSession = sessions.find(s => s.already_booked);
  useEffect(() => {
    if (alreadyBookedSession && selectedSessionId !== alreadyBookedSession.id) {
      setSelectedSessionId(alreadyBookedSession.id);
    }
  }, [alreadyBookedSession?.id, selectedSessionId]);

  return (
    <Card className={`overflow-hidden border-border/40 transition-all ${isBooked ? 'bg-primary/5 border-primary/20 shadow-none' :
        isFull ? 'opacity-40 grayscale bg-muted/20' :
          noCredits ? 'opacity-60' :
            'hover:border-primary/40 hover:bg-muted/5'
      }`}>
      <CardContent className="p-0">
        <div className="flex items-center gap-4 px-4 py-2.5">
          <div className={`flex flex-col items-center justify-center shrink-0 w-16 h-10 rounded-lg border
            ${isBooked ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 border-border/30 text-foreground'}`}>
            <p className="text-sm font-black italic leading-none">{fmtTime(selectedSession.start_time).split(' ')[0]}</p>
            <p className="text-[8px] font-black uppercase opacity-70">{fmtTime(selectedSession.start_time).split(' ')[1]}</p>
          </div>

          <div className="flex-1 min-w-0">
            {/* Título + badge de tipo: SIEMPRE del coach seleccionado, sin
                importar si la tarjeta agrupa varios (dos coaches con la
                misma disponibilidad, ej. ambos libres 05:00-07:00, caen en
                la misma hora y quedan agrupados acá). Un solo lugar donde
                se ve el nombre — antes se repetía en cada botón Y abajo. */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="min-w-0 max-w-full text-[11px] font-black uppercase tracking-tight truncate">
                  {(selectedSession as any).session_type === 'facility' || (selectedSession as any).facility
                    ? ((selectedSession as any).facility?.name || 'Instalación')
                    : (selectedSession.coach?.full_name || selectedSession.team?.name || 'Entrenador')
                  }
                </p>
                {selectedSession.available_for_personal_classes === true &&
                  !selectedSession.available_for_group_classes && (
                    <Badge variant="outline" className="shrink-0 whitespace-nowrap text-[9px] h-4 px-1.5 border-indigo-400 text-indigo-500 bg-indigo-500/5">
                      👤 Personal
                    </Badge>
                  )}
                {selectedSession.available_for_group_classes === true &&
                  !selectedSession.available_for_personal_classes && (
                    <Badge variant="outline" className="shrink-0 whitespace-nowrap text-[9px] h-4 px-1.5 border-green-400 text-green-600 bg-green-500/5">
                      👥 Grupal · {selectedSession.max_capacity} cupos
                    </Badge>
                  )}
              </div>

              {sessions.length > 1 && (
                <div className="flex flex-wrap gap-1.5 items-center mt-1">
                  {sessions.map(s => (
                    <button key={s.id} onClick={() => setSelectedSessionId(s.id)} disabled={isBooked && !s.already_booked}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border transition-all ${selectedSessionId === s.id
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                        } ${s.already_booked ? 'ring-1 ring-primary ring-offset-1' : ''}`}
                    >
                      {s.coach?.full_name?.split(' ')[0] || 'Clase'}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{calcDuration(selectedSession.start_time, selectedSession.end_time)}</span>
                {selectedSession.max_capacity && (
                  <span className={`flex items-center gap-0.5 ${isFull ? 'text-destructive' : ''}`}>
                    <Users className="h-2.5 w-2.5" />
                    {selectedSession.max_capacity - (selectedSession.current_bookings ?? 0)} libres
                  </span>
                )}
              </div>
            </div>
          </div>

          {isBooked ? (
            <div className="flex items-center gap-1 text-primary animate-in fade-in zoom-in duration-300">
               <CheckCircle2 className="h-4 w-4 stroke-[3]" />
               <span className="text-[9px] font-black uppercase">Listo</span>
            </div>
          ) : (
            <Button size="sm" onClick={() => onBook(selectedSession)} disabled={isDisabled}
              className={`h-8 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all
                ${isFull ? 'bg-muted text-muted-foreground' : 'bg-primary shadow-lg shadow-primary/20 hover:shadow-primary/30'}`}>
              Agendar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
