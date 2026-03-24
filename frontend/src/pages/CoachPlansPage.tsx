import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useCoachStaffId } from '@/hooks/useCoachStaffId';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { CalendarIcon, Clock, Users, FileText, Plus, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { AvailabilityManager } from '@/components/school/AvailabilityManager';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const DAYS_OF_WEEK = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function CoachPlansPage() {
  const { user } = useAuth();
  const { schoolId } = useSchoolContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [savingAttendance, setSavingAttendance] = useState<string | null>(null);

  // ── 1. Resolver school_staff.id vía hook ─────────────────────────────────
  const { staffId, isLoading: isStaffLoading } = useCoachStaffId();

  // ── 2. Clases fijas asignadas (attendance_sessions) ───────────────────────
  const { data: appointments, isLoading: isSchoolPlansLoading } = useQuery({
    queryKey: ['coach-school-appointments', staffId, schoolId],
    queryFn: async () => {
      if (!staffId || !schoolId) return [];
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('session_bookings')
        .select(`
          id, status, booked_at, child_id, user_id, session_id, unregistered_athlete_id,
          attendance_sessions!inner (
             id, session_date, start_time, end_time,
             offerings (name), teams (name)
          )
        `)
        .eq('attendance_sessions.coach_id', staffId)
        .eq('attendance_sessions.school_id', schoolId)
        .gte('attendance_sessions.session_date', today);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const sortedData = [...data].sort((a: any, b: any) => {
        const sA = Array.isArray(a.attendance_sessions) ? a.attendance_sessions[0] : a.attendance_sessions;
        const sB = Array.isArray(b.attendance_sessions) ? b.attendance_sessions[0] : b.attendance_sessions;
        if (!sA || !sB) return 0;
        const dateA = new Date(`${sA.session_date}T${sA.start_time}`).getTime();
        const dateB = new Date(`${sB.session_date}T${sB.start_time}`).getTime();
        return dateA - dateB;
      });

      const userIds = [...new Set(sortedData.map((b: any) => b.user_id).filter(Boolean))];
      const childIds = [...new Set(sortedData.map((b: any) => b.child_id).filter(Boolean))];
      const unregIds = [...new Set(sortedData.map((b: any) => b.unregistered_athlete_id).filter(Boolean))];
      const sessionIds = [...new Set(sortedData.map((b: any) => b.session_id).filter(Boolean))];

      const [profilesRes, childrenRes, unregRes, recordsRes] = await Promise.all([
        userIds.length > 0 ? (supabase as any).from('profiles').select('id, full_name, avatar_url').in('id', userIds as string[]) : Promise.resolve({ data: [] }),
        childIds.length > 0 ? (supabase as any).from('children').select('id, full_name, avatar_url').in('id', childIds as string[]) : Promise.resolve({ data: [] }),
        unregIds.length > 0 ? (supabase as any).from('unregistered_athletes').select('id, full_name').in('id', unregIds as string[]) : Promise.resolve({ data: [] }),
        sessionIds.length > 0 ? (supabase as any).from('attendance_records').select('child_id, user_id, unregistered_athlete_id, session_id, status').in('session_id', sessionIds as string[]) : Promise.resolve({ data: [] })
      ]);

      const profileMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));
      const childrenMap = Object.fromEntries((childrenRes.data || []).map((c: any) => [c.id, c]));
      const unregMap = Object.fromEntries((unregRes.data || []).map((u: any) => [u.id, u]));

      const recordsMap = new Map();
      (recordsRes.data || []).forEach((r: any) => {
         const key = `${r.session_id}_${r.child_id ?? r.user_id ?? r.unregistered_athlete_id}`;
         recordsMap.set(key, r.status);
      });

      return sortedData.map((b: any) => {
        const person = b.child_id ? childrenMap[b.child_id]
                     : b.user_id ? profileMap[b.user_id] 
                     : b.unregistered_athlete_id ? unregMap[b.unregistered_athlete_id]
                     : null;

        const session = Array.isArray(b.attendance_sessions) ? b.attendance_sessions[0] : b.attendance_sessions;
        const recordStatus = recordsMap.get(`${b.session_id}_${b.child_id ?? b.user_id ?? b.unregistered_athlete_id}`);

        return {
          id: b.id,
          session_id: b.session_id,
          child_id: b.child_id,
          user_id: b.user_id,
          unregistered_athlete_id: b.unregistered_athlete_id,
          athlete_name: person?.full_name || 'Desconocido',
          avatar_url: person?.avatar_url || null,
          session_date: session?.session_date,
          start_time: session?.start_time,
          end_time: session?.end_time,
          class_name: session?.offerings?.name || session?.teams?.name || 'Clase Especial',
          attendance_status: recordStatus || null
        };
      });
    },
    enabled: !!staffId && !!schoolId,
  });

  const handleAttendance = async (session_id: string, attendee: any, status: 'present' | 'absent') => {
    try {
      setSavingAttendance(`${session_id}_${attendee.id}`);
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token;
      
      const records = [{
        childId: attendee.child_id ?? undefined,
        userId: attendee.user_id ?? undefined,
        unregisteredAthleteId: attendee.unregistered_athlete_id ?? undefined,
        status
      }];

      const res = await fetch(`${import.meta.env.VITE_BFF_URL}/api/v1/attendance/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId: session_id, records })
      });
      
      if (!res.ok) {
         const msg = await res.json();
         throw new Error(msg.error || 'Error al guardar asistencia');
      }
      queryClient.invalidateQueries({ queryKey: ['coach-school-appointments'] });
      toast({ title: '✅ Asistencia guardada verificada' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingAttendance(null);
    }
  };

  // ── 3. Horarios de disponibilidad (coach_availability) ────────────────────
  const { data: availabilitySlots, isLoading: isAvailabilityLoading } = useQuery({
    queryKey: ['coach-availability-slots', staffId, schoolId],
    queryFn: async () => {
      if (!staffId || !schoolId) return [];

      const { data, error } = await supabase
        .from('coach_availability')
        .select(`
          id, day_of_week, start_time, end_time, available_for_group_classes, available_for_personal_classes,
          group_class_athletes(count)
        `)
        .eq('coach_id', staffId)          // ✅ usa school_staff.id
        .eq('school_id', schoolId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!staffId && !!schoolId,
  });

  // ── 4. Eventos privados (calendar_events — usa auth.uid directamente) ──────
  const { data: personalEvents, isLoading: isPersonalEventsLoading } = useQuery({
    queryKey: ['coach-personal-events', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const today = new Date().toISOString();

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', today)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const isLoading = isStaffLoading || isSchoolPlansLoading || isPersonalEventsLoading || isAvailabilityLoading;

  if (isLoading) {
    return <LoadingSpinner text="Cargando tus planes y disponibilidad..." fullScreen />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <FileText className="h-8 w-8 text-primary" />
          Mis Planes y Disponibilidad
        </h1>
        <p className="text-muted-foreground mt-2">
          Gestiona las clases abiertas y planes asignados, tus eventos privados y tu horario de disponibilidad.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* COLUMNA IZQUIERDA: Clases y Planes */}
        <div className="space-y-6">
          
          {/* SECCIÓN 1: Planes Asignados Fijos (attendance_sessions) */}
          <Card className="border-border/50 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Clases Fijas Asignadas
              </CardTitle>
              <CardDescription>
                Sesiones regulares o clases sueltas que la academia ya te agendó.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {appointments && appointments.length > 0 ? (
                <div className="space-y-4">
                  {appointments.map((appt: any) => {
                    const mappedId = appt.child_id ?? appt.user_id ?? appt.unregistered_athlete_id;
                    const isSaving = savingAttendance === `${appt.session_id}_${mappedId}`;
                    const curStatus = appt.attendance_status;
                    
                    return (
                    <div key={appt.id} className={`p-4 xl:p-5 rounded-2xl border transition-all duration-300 ${
                                  curStatus === 'present' ? 'bg-green-500/5 border-green-500/30 shadow-inner' : 
                                  curStatus === 'absent' ? 'bg-red-500/5 border-red-500/30 shadow-inner' : 'bg-card border-border/60 hover:shadow-lg hover:border-primary/30'
                                }`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-4">
                          <Avatar className={`h-14 w-14 border-[3px] shadow-sm ${curStatus === 'present' ? 'border-green-500' : curStatus === 'absent' ? 'border-red-500' : 'border-primary/20'}`}>
                            <AvatarImage src={appt.avatar_url} />
                            <AvatarFallback className="text-base font-bold bg-primary/10 text-primary">{appt.athlete_name?.substring(0,2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-bold text-lg leading-none text-foreground mb-1">{appt.athlete_name}</h4>
                            <div className="flex items-center gap-1.5 opacity-80 mt-1">
                              <Badge variant="secondary" className="bg-primary/5 text-primary border border-primary/10 text-[10px] uppercase font-black tracking-widest px-1.5 py-0">
                                {appt.class_name}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-5 pt-4 border-t border-border/50">
                        <div className="flex flex-col gap-1.5 text-sm text-foreground/80 font-medium">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-primary/70" />
                            {format(new Date(`${appt.session_date}T00:00:00`), "EEEE d 'de' MMMM", { locale: es })}
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground opacity-90">
                            <Clock className="h-4 w-4" />
                            {appt.start_time?.slice(0, 5)} - {appt.end_time?.slice(0, 5)} hrs
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto mt-2 sm:mt-0">
                           <Button 
                             size="sm" variant={curStatus === 'present' ? 'default' : 'outline'}
                             className={`h-10 px-5 text-xs uppercase font-black tracking-widest flex-1 sm:flex-initial transition-all ${curStatus === 'present' ? 'bg-green-500 hover:bg-green-600 border-none text-white shadow-md shadow-green-900/20' : 'hover:border-green-500/50 hover:bg-green-500/10 hover:text-green-600'}`}
                             disabled={isSaving}
                             onClick={() => handleAttendance(appt.session_id, { id: mappedId, child_id: appt.child_id, user_id: appt.user_id, unregistered_athlete_id: appt.unregistered_athlete_id }, 'present')}
                           >
                             {isSaving && curStatus === 'present' ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                             Asistió
                           </Button>
                           <Button 
                             size="sm" variant={curStatus === 'absent' ? 'default' : 'outline'}
                             className={`h-10 px-5 text-xs uppercase font-black tracking-widest flex-1 sm:flex-initial transition-all ${curStatus === 'absent' ? 'bg-red-500 hover:bg-red-600 border-none text-white shadow-md shadow-red-900/20' : 'hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-600'}`}
                             disabled={isSaving}
                             onClick={() => handleAttendance(appt.session_id, { id: mappedId, child_id: appt.child_id, user_id: appt.user_id, unregistered_athlete_id: appt.unregistered_athlete_id }, 'absent')}
                           >
                             {isSaving && curStatus === 'absent' ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <XCircle className="w-4 h-4 mr-2" />}
                             Faltó
                           </Button>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center p-4 py-8 border border-dashed border-border/40 rounded-2xl bg-muted/5 flex flex-col items-center justify-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                    <Users className="h-6 w-6 text-primary/40" />
                  </div>
                  <p className="text-sm text-foreground font-bold">No tienes citas agendadas</p>
                  <p className="text-xs text-muted-foreground font-medium">Tus próximos alumnos agendados aparecerán aquí.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SECCIÓN 2: Slots de Disponibilidad (Lo que reservan los atletas) */}
          <Card className="border-border/50 shadow-sm bg-card/60 backdrop-blur-sm border-l-4 border-l-primary/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Tus Horarios Disponibles (Reservables)
              </CardTitle>
              <CardDescription>
                Esta es la disponibilidad que la escuela deportiva te ha configurado y que los atletas o padres pueden reservar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {availabilitySlots && availabilitySlots.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {availabilitySlots.map((slot: any) => (
                    <div key={slot.id} className="p-3 rounded-lg border border-border/50 bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-primary/30 transition-colors shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary w-12 h-12 rounded-lg flex flex-col items-center justify-center font-bold">
                          <span className="text-sm leading-none">{DAYS_OF_WEEK[slot.day_of_week].substring(0, 3)}</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                          </h4>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {slot.available_for_group_classes && (
                              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 py-0 bg-primary/10 text-primary border-none">
                                Grupal
                              </Badge>
                            )}
                            {slot.available_for_personal_classes && (
                              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 py-0 bg-accent/10 text-accent border-none">
                                Personal
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 sm:ml-auto">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-md border border-border/50">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold text-foreground">
                            {slot.group_class_athletes?.[0]?.count || 0} Reservas
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-6 border border-dashed border-border/40 rounded-xl bg-muted/5">
                  <p className="text-muted-foreground font-medium text-sm">No tienes horarios de disponibilidad configurados.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SECCIÓN 3: Sesiones Privadas / Calendario */}
          <Card className="border-border/50 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-start justify-between pb-4">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-accent" />
                  Tus Eventos Privados
                </CardTitle>
                <CardDescription className="mt-1">
                  Clases o eventos personalizados que tú ofreces.
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" className="gap-2 h-8" onClick={() => navigate('/calendar')}>
                <Plus className="h-3.5 w-3.5" />
                Crear Evento
              </Button>
            </CardHeader>
            <CardContent>
              {personalEvents && personalEvents.length > 0 ? (
                <div className="space-y-4">
                  {personalEvents.map((ev: any) => (
                    <div key={ev.id} className="p-4 rounded-xl border border-accent/20 bg-accent/5 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-accent">{ev.title}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-1">{ev.description || 'Sin descripción'}</p>
                        </div>
                        <Badge variant="secondary" className="bg-accent/10 text-accent border-none">
                          Evento Propio
                        </Badge>
                      </div>
                      <div className="mt-4 flex items-center gap-4 text-sm text-foreground/80">
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon className="h-4 w-4 opacity-70" />
                          {format(new Date(ev.start_time), "EEEE d 'de' MMMM", { locale: es })}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 opacity-70" />
                          {format(new Date(ev.start_time), "HH:mm")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-6 border border-dashed border-border/40 rounded-xl bg-muted/5">
                  <p className="text-muted-foreground font-medium text-sm">No has creado sesiones privadas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA DERECHA: Disponibilidad (Manager UI) */}
        <div className="h-full">
          <Card className="h-full border-border/50 shadow-sm bg-card/60 backdrop-blur-sm flex flex-col">
            <CardHeader className="pb-4 shrink-0 border-b border-border/20">
              <CardTitle className="text-xl flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Configurar Horas Libres
              </CardTitle>
              <CardDescription>
                Agrega o elimina franjas de disponibilidad.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 flex-1 min-h-[500px]">
              {staffId && schoolId ? (
                <AvailabilityManager coachId={staffId} schoolId={schoolId} />  // ✅ usa school_staff.id
              ) : user && schoolId && !isStaffLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 p-6">
                  <p className="text-muted-foreground font-medium text-sm">
                    No encontramos tu perfil de entrenador en esta escuela deportiva.
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Contacta al administrador para que te agregue como entrenador.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Cargando...
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
