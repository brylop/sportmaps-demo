import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { CalendarIcon, Clock, Users, FileText, Plus, User } from 'lucide-react';
import { AvailabilityManager } from '@/components/school/AvailabilityManager';
import { useNavigate } from 'react-router-dom';

const DAYS_OF_WEEK = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function CoachPlansPage() {
  const { user } = useAuth();
  const { schoolId } = useSchoolContext();
  const navigate = useNavigate();

  // Fetch Session/Plans assigned to this coach
  const { data: schoolPlans, isLoading: isSchoolPlansLoading } = useQuery({
    queryKey: ['coach-school-plans', user?.id, schoolId],
    queryFn: async () => {
      if (!user || !schoolId) return [];
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('attendance_sessions')
        .select(`
          id, session_date, start_time, end_time,
          offerings (name),
          offering_plans (name)
        `)
        .eq('coach_id', user.id)
        .eq('school_id', schoolId)
        .not('offering_id', 'is', null)
        .gte('session_date', today)
        .order('session_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!schoolId,
  });

  // Fetch Coach Availability (The slots the school gave them)
  const { data: availabilitySlots, isLoading: isAvailabilityLoading } = useQuery({
    queryKey: ['coach-availability-slots', user?.id, schoolId],
    queryFn: async () => {
      if (!user || !schoolId) return [];

      const { data, error } = await supabase
        .from('coach_availability')
        .select(`
          id, day_of_week, start_time, end_time, available_for_group_classes, available_for_personal_classes,
          group_class_athletes(count)
        `)
        .eq('coach_id', user.id)
        .eq('school_id', schoolId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!schoolId,
  });

  // Fetch Personal Classes (Calendar Events)
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

  const isLoading = isSchoolPlansLoading || isPersonalEventsLoading || isAvailabilityLoading;

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
              {schoolPlans && schoolPlans.length > 0 ? (
                <div className="space-y-4">
                  {schoolPlans.map((plan: any) => (
                    <div key={plan.id} className="p-4 rounded-xl border border-border/40 bg-card hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-primary">{plan.offerings?.name || 'Clase Especial'}</h4>
                          <p className="text-sm text-muted-foreground">{plan.offering_plans?.name || 'Plan General'}</p>
                        </div>
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                          Reserva / Plan
                        </Badge>
                      </div>
                      <div className="mt-4 flex items-center gap-4 text-sm text-foreground/80">
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon className="h-4 w-4 opacity-70" />
                          {format(new Date(`${plan.session_date}T00:00:00`), "EEEE d 'de' MMMM", { locale: es })}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 opacity-70" />
                          {plan.start_time.slice(0, 5)} - {plan.end_time.slice(0, 5)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-4 py-6 border border-dashed border-border/40 rounded-xl bg-muted/5">
                  <p className="text-sm text-muted-foreground font-medium">No tienes clases fijas asignadas próximas</p>
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
                Esta es la disponibilidad que el colegio te ha configurado y que los atletas o padres pueden reservar.
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
              {user && schoolId ? (
                <AvailabilityManager coachId={user.id} schoolId={schoolId} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No se pudo cargar la información del usuario.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
