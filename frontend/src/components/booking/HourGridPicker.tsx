import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import type { BookableSession, FlexibleHourGridGroup } from '@/hooks/useAthleteSessionBookings';

// Piloto "agendamiento flexible de banco de horas" — modo "Personalizada":
// en vez de elegir entre bloques ya armados, el usuario ve las horas SUELTAS
// reales del coach y toca las que quiere, consecutivas, para armar su
// propio bloque (ej. toca 05, 06, 07 y arma 3h). Comparte esto entre "Mis
// Inscripciones" y el link público de agendamiento.

function fmtHour(hhmm: string) {
  const [h] = hhmm.substring(0, 5).split(':').map(Number);
  return `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.substring(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function durationLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function HourGridGroup({ group, noCredits, isBooking, onBook }: {
  group: FlexibleHourGridGroup; noCredits: boolean; isBooking: boolean; onBook: (s: BookableSession) => void;
}) {
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);

  const tapHour = (idx: number) => {
    if (group.hours[idx].busy) return;
    if (!range) { setRange({ start: idx, end: idx }); return; }
    if (idx === range.end + 1 && !group.hours[idx].busy) { setRange({ ...range, end: idx }); return; }
    if (idx === range.start - 1 && !group.hours[idx].busy) { setRange({ ...range, start: idx }); return; }
    if (idx >= range.start && idx <= range.end) {
      // Tocar una hora ya seleccionada la vuelve el nuevo extremo — deja
      // achicar el rango sin tener que empezar de cero.
      if (idx === range.start) { setRange(null); return; }
      setRange({ start: range.start, end: idx });
      return;
    }
    // No es contiguo con el rango actual — arranca uno nuevo desde acá.
    setRange({ start: idx, end: idx });
  };

  const totalMinutes = range
    ? toMinutes(group.hours[range.end].end_time) - toMinutes(group.hours[range.start].start_time)
    : 0;
  const meetsMinimum = totalMinutes >= group.default_minutes;

  const handleConfirm = () => {
    if (!range || !meetsMinimum) return;
    const startHour = group.hours[range.start];
    const endHour = group.hours[range.end];
    const synthetic: BookableSession = {
      id: `avail_${group.kind === 'personal' ? 'p' : 'g'}_${startHour.avail_id}_${group.session_date}`,
      session_date: group.session_date,
      start_time: startHour.start_time,
      end_time: endHour.end_time,
      max_capacity: group.kind === 'personal' ? 1 : 99,
      current_bookings: 0,
      available_spots: 1,
      team: null as any,
      coach: group.coach as any,
      enrollment_id: group.enrollment_id,
      offering_id: null,
      sessions_left: null,
      booking_status: 'open',
      already_booked: false,
      available_for_personal_classes: group.kind === 'personal',
      available_for_group_classes: group.kind === 'group',
      // Reusa default_minutes para precargar la duración exacta que el
      // usuario armó tocando horas — max_bookable_minutes queda sin definir
      // a propósito para que el diálogo de confirmación no vuelva a mostrar
      // el selector de duración (ya lo armó acá).
      default_minutes: totalMinutes,
    };
    onBook(synthetic);
    setRange(null);
  };

  return (
    <Card className="border-border/40">
      <CardContent className="p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-black uppercase tracking-tight truncate">
            {group.coach?.full_name || 'Entrenador'}
          </p>
          <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${group.kind === 'personal'
              ? 'border-indigo-400 text-indigo-500 bg-indigo-500/5'
              : 'border-green-400 text-green-600 bg-green-500/5'
            }`}>
            {group.kind === 'personal' ? '👤 Personal' : '👥 Grupal'}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {group.hours.map((h, idx) => {
            const selected = !!range && idx >= range.start && idx <= range.end;
            return (
              <button
                key={h.avail_id}
                type="button"
                disabled={h.busy}
                onClick={() => tapHour(idx)}
                className={`w-12 h-8 rounded-md text-[10px] font-black uppercase border transition-all ${
                  h.busy
                    ? 'bg-muted/40 text-muted-foreground/40 border-border/20 cursor-not-allowed line-through'
                    : selected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                }`}
              >
                {fmtHour(h.start_time)}
              </button>
            );
          })}
        </div>

        {range && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className={`text-[11px] font-bold flex items-center gap-1 ${meetsMinimum ? 'text-foreground' : 'text-amber-600'}`}>
              <Clock className="h-3 w-3" />
              {durationLabel(totalMinutes)} seleccionadas
              {!meetsMinimum && ` (mínimo ${durationLabel(group.default_minutes)})`}
            </p>
            <Button
              size="sm"
              disabled={!meetsMinimum || noCredits || isBooking}
              onClick={handleConfirm}
              className="h-7 px-3 text-[10px] font-black uppercase tracking-wider rounded-lg"
            >
              Agendar bloque
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function HourGridPicker({ groups, noCredits, isBooking, onBook }: {
  groups: FlexibleHourGridGroup[]; noCredits: boolean; isBooking: boolean; onBook: (s: BookableSession) => void;
}) {
  if (groups.length === 0) {
    return <p className="text-xs text-center text-muted-foreground py-6">No hay horarios disponibles para agendar en este día.</p>;
  }
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] text-muted-foreground font-semibold px-0.5">
        Toca las horas seguidas que quieres agendar — mínimo {durationLabel(groups[0].default_minutes)}.
      </p>
      {groups.map((g) => (
        <HourGridGroup key={`${g.coach_id}_${g.kind}`} group={g} noCredits={noCredits} isBooking={isBooking} onBook={onBook} />
      ))}
    </div>
  );
}
