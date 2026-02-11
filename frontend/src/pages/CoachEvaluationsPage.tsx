import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, User, GraduationCap, TrendingUp, Calendar } from 'lucide-react';
import { isDemoUser } from '@/lib/demo-check';
import { Badge } from '@/components/ui/badge';

export default function CoachEvaluationsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const isDemo = isDemoUser(user);

    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
    const [skillName, setSkillName] = useState('');
    const [skillLevel, setSkillLevel] = useState([50]);
    const [comments, setComments] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Demo Teams
    const demoTeams = isDemo ? [
        { id: 'demo-team-1', name: 'Firesquad (Senior L3)', age_group: 'Senior' }
    ] : [];

    // Fetch Teams
    const { data: teamsData } = useQuery({
        queryKey: ['coach-teams', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase.from('teams').select('*').eq('coach_id', user?.id);
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id,
    });

    const teams = teamsData && teamsData.length > 0 ? teamsData : demoTeams;

    // Demo Roster
    const demoRoster = isDemo ? [
        { id: 'player-1', player_name: 'Mateo Pérez', player_number: 10 },
        { id: 'player-2', player_name: 'Juan Vargas', player_number: 7 },
        { id: 'player-3', player_name: 'Camila Torres', player_number: 5 },
    ] : [];

    // Fetch Roster
    const { data: rosterData } = useQuery({
        queryKey: ['team-roster', selectedTeamId],
        queryFn: async () => {
            const { data, error } = await supabase.from('team_members').select('*').eq('team_id', selectedTeamId);
            if (error) throw error;
            return data;
        },
        enabled: !!selectedTeamId && !selectedTeamId.startsWith('demo-'),
    });

    const roster = (rosterData && rosterData.length > 0) || !selectedTeamId.startsWith('demo-') ? rosterData : demoRoster;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlayerId || !skillName) {
            toast({ title: "Error", description: "Completa todos los campos requeridos", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);

        try {
            if (isDemo) {
                // Mock save
                await new Promise(resolve => setTimeout(resolve, 1000));
                toast({ title: "Evaluación guardada", description: "El progreso ha sido registrado (Demo Mode)." });
            } else {
                // Real save
                // Note: This assumes team_member.player_id maps to academic_progress.child_id or similar.
                // Adjust logic based on actual schema relation.
                const { error } = await supabase.from('academic_progress').insert({
                    child_id: selectedPlayerId, // Assuming player_contact_id or linked child id
                    skill_name: skillName,
                    skill_level: skillLevel[0],
                    comments: comments,
                    evaluation_date: new Date().toISOString()
                });
                if (error) throw error;
                toast({ title: "Exito", description: "Evaluación guardada correctamente." });
            }

            // Reset form
            setSkillName('');
            setSkillLevel([50]);
            setComments('');
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Evaluaciones</h1>
                <p className="text-muted-foreground mt-1">Registra el progreso académico y deportivo de tus atletas</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Selection Section */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>1. Seleccionar Atleta</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Equipo</Label>
                                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona un equipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {teams?.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Atleta</Label>
                                <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId} disabled={!selectedTeamId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona un atleta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roster?.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.player_name || 'Atleta'}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Tips */}
                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <GraduationCap className="h-5 w-5 text-primary" />
                                <CardTitle className="text-base">Guía de Evaluación</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground space-y-2">
                            <p>• Sé específico en la habilidad evaluada (ej. "Técnica de Salto" vs "Saltos").</p>
                            <p>• Utiliza comentarios constructivos para motivar al atleta.</p>
                            <p>• Evalúa periódicamente para mostrar tendencias de progreso.</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Evaluation Form */}
                <div className="space-y-6">
                    <Card className={!selectedPlayerId ? "opacity-50 pointer-events-none" : ""}>
                        <CardHeader>
                            <CardTitle>2. Detalles de la Evaluación</CardTitle>
                            <CardDescription>Califica el desempeño reciente</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label>Habilidad / Competencia</Label>
                                    <Input
                                        placeholder="Ej. Control de Balón, Resistencia, Disciplina..."
                                        value={skillName}
                                        onChange={e => setSkillName(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between">
                                        <Label>Nivel de Dominio</Label>
                                        <span className="font-bold text-primary">{skillLevel[0]}%</span>
                                    </div>
                                    <Slider
                                        value={skillLevel}
                                        onValueChange={setSkillLevel}
                                        max={100}
                                        step={1}
                                        className="py-4"
                                    />
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Principiante</span>
                                        <span>Intermedio</span>
                                        <span>Avanzado</span>
                                        <span>Experto</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Comentarios / Feedback</Label>
                                    <Textarea
                                        placeholder="Escribe tus observaciones y recomendaciones..."
                                        className="h-32"
                                        value={comments}
                                        onChange={e => setComments(e.target.value)}
                                    />
                                </div>

                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Guardar Evaluación
                                        </>
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
