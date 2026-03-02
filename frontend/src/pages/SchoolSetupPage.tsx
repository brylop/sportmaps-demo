import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function SchoolSetupPage() {
    const { user, profile } = useAuth();
    // Note: useSchoolContext is a plain hook (not a shared Context provider),
    // so we force-reload after creation to re-resolve the context.
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [schoolName, setSchoolName] = useState('');
    const [schoolType, setSchoolType] = useState('');

    const handleCreateSchool = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !schoolName.trim()) return;

        setIsLoading(true);
        try {
            // 1. Crear Escuela
            const { data: school, error: schoolError } = await supabase
                .from('schools')
                .insert({
                    name: schoolName,
                    owner_id: user.id,
                    school_type: schoolType,
                    onboarding_status: 'in_progress',
                    onboarding_step: 2
                })
                .select()
                .single();

            if (schoolError) throw schoolError;

            // 2. Vincular como dueño (FIRST — needed for branch RLS)
            const { error: memberError } = await supabase
                .from('school_members')
                .insert({
                    profile_id: user.id,
                    school_id: school.id,
                    role: 'owner',
                    status: 'active'
                });

            if (memberError) throw memberError;

            // 3. Crear Sede Principal (AFTER membership exists)
            const { error: branchError } = await supabase
                .from('school_branches')
                .insert({
                    school_id: school.id,
                    name: 'Sede Principal',
                    is_main: true,
                    status: 'active'
                });

            if (branchError) throw branchError;

            toast({
                title: "¡Academia registrada!",
                description: "Ahora puedes comenzar a configurar tu academia.",
            });

            // Force full reload to re-resolve school context with new membership
            window.location.href = '/dashboard';
        } catch (error: any) {
            console.error('Error creating school:', error);
            toast({
                title: "Error al crear la academia",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (profile?.role !== 'school') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p>No tienes permisos para acceder a esta página.</p>
                <Button onClick={() => window.location.href = '/dashboard'}>Ir al Dashboard</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 font-poppins">
            <Card className="w-full max-w-md shadow-xl border-t-8 border-[#248223]">
                <CardHeader className="text-center">
                    <div className="bg-[#248223]/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Building2 className="w-8 h-8 text-[#248223]" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Registra tu Academia</CardTitle>
                    <CardDescription>
                        Parece que aún no tienes una academia vinculada. Vamos a crear la primera.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCreateSchool} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="schoolName">Nombre de la Academia</Label>
                            <Input
                                id="schoolName"
                                placeholder="Ej: Spirit All Stars Bogotá"
                                value={schoolName}
                                onChange={(e) => setSchoolName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="schoolType">Tipo de organización</Label>
                            <Select onValueChange={setSchoolType} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona el tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="escuela">Escuela Deportiva</SelectItem>
                                    <SelectItem value="club">Club Deportivo</SelectItem>
                                    <SelectItem value="academia">Academia</SelectItem>
                                    <SelectItem value="gimnasio">Gimnasio/Fitness</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button type="submit" className="w-full bg-[#248223] hover:bg-[#1a5d19]" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creando academia...
                                </>
                            ) : (
                                <>
                                    Continuar al Dashboard
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
