import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AvailabilityManager } from '@/components/school/AvailabilityManager';
import CoachAttendancePage from '@/pages/CoachAttendancePage';
import { useTrainerContext } from '@/hooks/useTrainerContext';
import { useCoachStaffId } from '@/hooks/useCoachStaffId';
import { supabase } from '@/integrations/supabase/client';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Loader2, Clock, CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const BFF_URL = import.meta.env.VITE_BFF_URL ?? '';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtCO = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d);

interface PTSession {
  id: string;
  session_date: string;
  session_time: string | null;
  status: string;
  client_type: string;
  client_id: string;
  client_name: string;
}

export default function TrainerAvailability() {
  const { trainerSchoolId } = useTrainerContext();
  const { staffId, isLoading } = useCoachStaffId();

  // ── Calendario ────────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [ptSessions, setPtSessions]     = useState<PTSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    if (!trainerSchoolId) return;
    const fetchSessions = async () => {
      setLoadingSessions(true);
      try {
        const dateStr = fmtCO(selectedDate);
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) { setLoadingSessions(false); return; }

        const res = await fetch(
          `${BFF_URL}/api/v1/trainer/availability/schedule?date=${dateStr}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) { setPtSessions([]); return; }

        const data = await res.json();
        // ✅ El BFF ya resuelve nombres con service role — sin problema de RLS
        const sessions: PTSession[] = (data.sessions ?? []).map((s: any) => ({
          id:          s.id,
          session_date: s.session_date,
          session_time: s.session_time,
          status:       s.status,
          client_type:  s.client_type,
          client_id:    s.client_id,
          client_name:  s.client?.full_name ?? 'Cliente',
        }));
        setPtSessions(sessions);
      } catch {
        setPtSessions([]);
      } finally {
        setLoadingSessions(false);
      }
    };
    fetchSessions();
  }, [selectedDate, trainerSchoolId]);

  if (!trainerSchoolId || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Cargando...</span>
      </div>
    );
  }

  const isToday = fmtCO(selectedDate) === fmtCO(new Date());

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Disponibilidad</h1>
        <p className="text-muted-foreground text-sm">
          Gestiona tus sesiones del día y configura tus horarios disponibles.
        </p>
      </div>

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-xs">
          <TabsTrigger value="sessions">Mis Sesiones</TabsTrigger>
          <TabsTrigger value="config">Configurar Horarios</TabsTrigger>
        </TabsList>

        {/* ── Tab: Mis Sesiones ── */}
        <TabsContent value="sessions" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Columna izquierda — Calendario + lista de sesiones */}
            <div className="flex flex-col gap-4">

              {/* Calendario */}
              <Card className="overflow-hidden border-border/50 shadow-sm bg-card/40">
                <CardHeader className="pb-2 bg-muted/20 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                      Calendario
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10"
                      onClick={() => setSelectedDate(new Date())}
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      Hoy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-2">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                    className="rounded-none w-full flex justify-center py-2"
                    classNames={{
                      months:      'w-full space-y-4',
                      month:       'w-full space-y-4',
                      table:       'w-full border-collapse space-y-1',
                      head_row:    'flex justify-between px-2',
                      row:         'flex w-full mt-2 justify-between px-2',
                      day_selected:'bg-primary text-primary-foreground hover:bg-primary shadow-lg shadow-primary/30 rounded-xl font-black',
                      day_today:   'bg-primary/10 text-primary font-black border-2 border-primary/20',
                      day:          cn(buttonVariants({ variant: 'ghost' }), 'h-10 w-10 p-0 font-bold hover:bg-primary/10 hover:text-primary rounded-xl text-sm'),
                      head_cell:   'text-muted-foreground/60 rounded-md w-10 font-black text-[11px] uppercase tracking-tighter text-center',
                      nav_button:   cn(buttonVariants({ variant: 'outline' }), 'h-8 w-8 bg-muted/50 p-0 opacity-80 hover:opacity-100 hover:bg-primary/10 rounded-lg'),
                    }}
                  />
                </CardContent>
              </Card>

              {/* Sesiones de la fecha seleccionada */}
              <Card className="flex-1 shadow-sm border-muted/40 overflow-hidden">
                <CardHeader className="pb-3 bg-muted/30 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.15em] flex items-center gap-2 text-muted-foreground">
                      <CalendarCheck className="w-3.5 h-3.5 text-primary" />
                      {isToday ? 'Sesiones de hoy' : 'Sesiones del día'}
                    </CardTitle>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold">
                      {ptSessions.length}
                    </Badge>
                  </div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground/70 mt-1">
                    {selectedDate.toLocaleDateString('es-CO', {
                      weekday: 'long', day: 'numeric', month: 'long',
                    })}
                  </p>
                </CardHeader>
                <CardContent className="p-3">
                  {loadingSessions ? (
                    <div className="py-10 flex justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : ptSessions.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                      <CalendarCheck className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-xs font-medium">Sin sesiones este día</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                      {ptSessions.map((s) => {
                        const initials = s.client_name
                          .split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                        const isCompleted = s.status === 'completed';
                        return (
                          <div
                            key={s.id}
                            className={`p-3 rounded-xl border transition-all ${
                              isCompleted
                                ? 'border-green-500/30 bg-green-500/[0.03]'
                                : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border ${
                                isCompleted
                                  ? 'bg-green-500 text-white border-green-400'
                                  : 'bg-primary/5 text-primary border-primary/10'
                              }`}>
                                {initials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate">{s.client_name}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {s.session_time && (
                                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {s.session_time.substring(0, 5)}
                                    </span>
                                  )}
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                    s.client_type === 'child'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-purple-100 text-purple-700'
                                  }`}>
                                    {s.client_type === 'child' ? '👶 Menor' : '👤 Adulto'}
                                  </span>
                                </div>
                              </div>
                              {isCompleted && (
                                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] shrink-0">
                                  ✓ Hecha
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Columna derecha — Gestión de asistencia del día */}
            <div className="lg:col-span-2">
              <CoachAttendancePage showPlanSessions={false} />
            </div>
          </div>
        </TabsContent>

        {/* ── Tab: Configurar Horarios ── */}
        <TabsContent value="config" className="mt-4">
          {staffId ? (
            <AvailabilityManager
              coachId={staffId}
              schoolId={trainerSchoolId}
            />
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-xl text-muted-foreground text-sm">
              No se encontró tu perfil de entrenador. Contacta soporte.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
