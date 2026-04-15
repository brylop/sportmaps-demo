import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Loader2, Users, Receipt, Flag } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

const API_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

export default function EventEnrollmentPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeSchool, setActiveSchool] = useState<any>(null);

  // Data loaded from DB
  const [eventData, setEventData] = useState<any>(null);
  const [schoolTeams, setSchoolTeams] = useState<any[]>([]);
  const [schoolCoaches, setSchoolCoaches] = useState<any[]>([]);

  // Wizard state
  const [selectedTeams, setSelectedTeams] = useState<{ teamId: string; categoryId: string; }[]>([]);
  const [athletePkgChoices, setAthletePkgChoices] = useState<Record<string, string>>({}); // athleteId -> 'pkg_1' | 'pkg_solo'
  const [coachPkgChoices, setCoachPkgChoices] = useState<Record<string, { phaseId: string, choice: string }>>({}); // eslint-disable-line @typescript-eslint/no-unused-vars

  // Resolve the school for the logged-in user
  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('school_members')
      .select('school_id, schools(id, name, logo_url)')
      .eq('profile_id', profile.id)
      .eq('status', 'active')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.schools) setActiveSchool(data.schools);
      });
  }, [profile?.id]);

  useEffect(() => {
    if (!eventId || !activeSchool) return;
    loadInitialData();
  }, [eventId, activeSchool]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch event with categories and phases
      const { data: ev, error: evError } = await supabase
        .from('events')
        .select('*, categories:event_categories_config(*), phases:event_price_phases(*)')
        .eq('id', eventId)
        .single();
      
      if (evError) throw evError;
      setEventData(ev);

      // 2. Fetch school teams with their athletes
      // Note: Assumes athletes are linked via a pivot or just fetching all school athletes
      // Since sportmaps has `school_students`, we can group them by team if team exists, 
      // or just list them. Let's fetch `school_programs` as "teams" for simplicity, or just `school_students`.
      const { data: students } = await supabase
        .from('school_students')
        .select('*, athlete:profiles!student_id(id, full_name, document_type, document_number)')
        .eq('school_id', activeSchool?.id);

      // We'll mock "Teams" by grouping students by their current program or creating ad-hoc teams
      // For this demo UI, let's treat specific selected students as a "Team"
      setSchoolTeams([{ id: 'mock-team-1', name: 'Equipo Elite', students: students || [] }]);
      
      // 3. Fetch Coaches
      const { data: staff } = await supabase
        .from('school_staff')
        .select('*, user:profiles(id, full_name)')
        .eq('school_id', activeSchool?.id)
        .eq('role', 'coach');
      setSchoolCoaches(staff || []);

    } catch (e: any) {
      toast({ title: 'Error cargando datos', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTeamCategory = (teamId: string, categoryId: string | 'none') => {
    if (categoryId === 'none') {
      setSelectedTeams(prev => prev.filter(t => t.teamId !== teamId));
    } else {
      setSelectedTeams(prev => {
        const filtered = prev.filter(t => t.teamId !== teamId);
        return [...filtered, { teamId, categoryId }];
      });
    }
  };

  const handleAthletePackage = (athleteId: string, choice: string) => {
    // Phase is automatically the first one valid, or hardcoded for demo
    const activePhase = eventData?.phases[0]; 
    if (!activePhase) return;

    setAthletePkgChoices(prev => {
      const copy = { ...prev };
      if (copy[athleteId] === choice) delete copy[athleteId];
      else copy[athleteId] = choice;
      return copy;
    });
  };

  const calculateTotal = () => {
    if (!eventData?.phases?.[0]) return 0;
    const phase = eventData.phases[0];
    let total = 0;
    Object.values(athletePkgChoices).forEach(choice => {
      if (choice === 'pkg_1') total += phase.pkg_1_price || 0;
      if (choice === 'pkg_solo') total += phase.pkg_solo_price || 0;
    });
    return total;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const activePhase = eventData.phases[0];
      const payload = {
        teams: selectedTeams.map(t => {
          const team = schoolTeams.find(st => st.id === t.teamId);
          return {
            id: t.teamId,
            name: team.name,
            category_id: t.categoryId,
            athletes: team.students.filter((s: any) => athletePkgChoices[s.id]).map((s: any) => ({
              id: s.student_id,
              package_id: activePhase.id // in REAL app we'd map the specific package choice
            }))
          };
        }),
        coaches: [] // Add if configured
      };

      const res = await fetch(`${API_URL}/api/v1/events/${eventId}/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Error guardando inscripción');

      toast({ title: 'Inscripción Guardada', description: 'La delegación ha sido registrada. Puedes ver el detalle en Mis Delegaciones.' });
      navigate('/school/delegations');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!eventData) return <div className="p-8 text-center">Evento no encontrado</div>;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5"/></Button>
        <div>
          <h1 className="text-2xl font-bold">Inscribir Delegación</h1>
          <p className="text-muted-foreground">{eventData.title}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-slate-200'}`} />
        <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-slate-200'}`} />
        <div className={`flex-1 h-2 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-slate-200'}`} />
      </div>

      <Card>
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/> Seleccionar Equipos y Categorías</CardTitle>
              <CardDescription>Asigna tus equipos de la academia a las categorías permitidas por el evento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {schoolTeams.map(team => (
                <div key={team.id} className="p-4 border rounded-xl flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">{team.name}</h3>
                    <p className="text-sm text-slate-500">{team.students.length} atletas</p>
                  </div>
                  <Select 
                    value={selectedTeams.find(t => t.teamId === team.id)?.categoryId || 'none'}
                    onValueChange={(v) => handleSelectTeamCategory(team.id, v)}
                  >
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="No Participa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Participa</SelectItem>
                      {eventData.categories.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.division} {c.category} {c.rama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="flex justify-end pt-4">
                <Button onClick={() => setStep(2)} disabled={selectedTeams.length === 0}>
                  Continuar: Paquetes
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5"/> Asignar Paquetes</CardTitle>
              <CardDescription>Elige qué paquete tomará cada atleta (Hospedaje o Solo Competencia).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* For demo, we just show athletes from selected teams */}
              {selectedTeams.map(st => {
                const team = schoolTeams.find(t => t.id === st.teamId);
                const category = eventData.categories.find((c:any) => c.id === st.categoryId);
                
                return (
                  <div key={st.teamId} className="space-y-3">
                    <h3 className="font-bold border-b pb-2">{team.name} <span className="font-normal text-muted-foreground mr-1">en</span> {category?.category}</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {team.students.map((s: any) => (
                        <div key={s.id} className="p-3 border rounded-lg flex items-center justify-between hover:bg-slate-50">
                          <span className="font-medium">{s.athlete?.full_name || 'Desconocido'}</span>
                          <div className="flex gap-2 text-sm">
                            <label className="flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded border">
                              <Checkbox 
                                checked={athletePkgChoices[s.id] === 'pkg_solo'}
                                onCheckedChange={() => handleAthletePackage(s.id, 'pkg_solo')}
                              />
                              Solo Compe (${eventData.phases[0]?.pkg_solo_price?.toLocaleString()})
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded border">
                              <Checkbox 
                                checked={athletePkgChoices[s.id] === 'pkg_1'}
                                onCheckedChange={() => handleAthletePackage(s.id, 'pkg_1')}
                              />
                              Paquete Hotel (${eventData.phases[0]?.pkg_1_price?.toLocaleString()})
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>Atrás</Button>
                <Button onClick={() => setStep(3)}>Revisar Resumen</Button>
              </div>
            </CardContent>
          </>
        )}

        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Flag className="h-5 w-5"/> Resumen Final</CardTitle>
              <CardDescription>Revisa el balance total de tu delegación.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-6 bg-slate-50 border rounded-xl space-y-4">
                <div className="flex justify-between pb-4 border-b">
                  <span className="text-slate-600">Equipos Inscritos</span>
                  <span className="font-bold">{selectedTeams.length}</span>
                </div>
                <div className="flex justify-between pb-4 border-b">
                  <span className="text-slate-600">Atletas con Paquete</span>
                  <span className="font-bold">{Object.keys(athletePkgChoices).length}</span>
                </div>
                <div className="flex justify-between text-xl font-bold pt-2 text-primary">
                  <span>Balance Total (Estimado)</span>
                  <span>${calculateTotal().toLocaleString()} COP</span>
                </div>
              </div>

              <div className="p-4 bg-amber-50 text-amber-800 rounded-lg text-sm">
                Al confirmar, se guardará el borrador de inscripción y se aplicarán los beneficios si existieran. Podrás gestionar los pagos desde tu Panel de Academia.
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>Atrás</Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                  Confirmar e Inscribir Delegación
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
