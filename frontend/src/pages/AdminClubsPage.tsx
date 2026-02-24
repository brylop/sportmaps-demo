import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Building,
    Plus,
    Users,
    DollarSign,
    MapPin,
    Loader2,
    Activity,
    ChevronRight,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface BranchMetrics {
    id: string;
    name: string;
    address?: string;
    city?: string;
    students: number;
    coaches: number;
    monthly_income: number;
    active_programs: number;
    admin_name?: string;
}

export default function AdminClubsPage() {
    const { schoolId, schoolName } = useSchoolContext();
    const navigate = useNavigate();
    const [branches, setBranches] = useState<BranchMetrics[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newBranch, setNewBranch] = useState({
        name: '',
        address: '',
        city: '',
        phone: '',
    });

    useEffect(() => {
        if (!schoolId) return;
        fetchBranches();
    }, [schoolId]);

    const fetchBranches = async () => {
        setLoading(true);
        try {
            const { data: branchData } = await supabase
                .from('school_branches' as any)
                .select('id, name, address, city, phone')
                .eq('school_id', schoolId!)
                .order('is_main', { ascending: false })
                .order('name');

            if (!branchData) { setLoading(false); return; }

            // Fetch metrics for each branch
            const metricsPromises = (branchData as any[]).map(async (branch) => {
                const [studentsRes, coachesRes, incomeRes, programsRes] = await Promise.all([
                    supabase.from('children').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id),
                    supabase.from('school_members').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id).eq('role', 'coach'),
                    supabase.from('payments').select('amount').eq('branch_id', branch.id).eq('status', 'paid')
                        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
                    supabase.from('teams').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id),
                ]);

                const monthlyIncome = (incomeRes.data || []).reduce((sum, p) => sum + (p.amount || 0), 0);

                return {
                    id: branch.id,
                    name: branch.name,
                    address: branch.address,
                    city: branch.city,
                    students: studentsRes.count || 0,
                    coaches: coachesRes.count || 0,
                    monthly_income: monthlyIncome,
                    active_programs: programsRes.count || 0,
                };
            });

            const metrics = await Promise.all(metricsPromises);
            setBranches(metrics);
        } catch (err) {
            console.error('Error fetching branches:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBranch = async () => {
        if (!newBranch.name.trim()) {
            toast({ title: 'El nombre es requerido', variant: 'destructive' });
            return;
        }

        setCreating(true);
        try {
            const { error } = await (supabase as any).from('school_branches').insert({
                school_id: schoolId!,
                name: newBranch.name.trim(),
                address: newBranch.address || null,
                city: newBranch.city || null,
                phone: newBranch.phone || null,
                is_main: false,
            });

            if (error) throw error;

            toast({ title: '¡Sede creada!', description: `"${newBranch.name}" ha sido registrada.` });
            setDialogOpen(false);
            setNewBranch({ name: '', address: '', city: '', phone: '' });
            fetchBranches();
        } catch (err: any) {
            toast({ title: 'Error al crear sede', description: err.message, variant: 'destructive' });
        } finally {
            setCreating(false);
        }
    };

    const totals = branches.reduce(
        (acc, b) => ({
            students: acc.students + b.students,
            coaches: acc.coaches + b.coaches,
            income: acc.income + b.monthly_income,
            programs: acc.programs + b.active_programs,
        }),
        { students: 0, coaches: 0, income: 0, programs: 0 }
    );

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Building className="h-7 w-7 text-primary" />
                        Sedes — {schoolName}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Vista global de todas las sedes deportivas
                    </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Nueva Sede
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Nueva Sede</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label>Nombre de la Sede *</Label>
                                <Input
                                    placeholder="ej. Sede Norte"
                                    value={newBranch.name}
                                    onChange={e => setNewBranch(f => ({ ...f, name: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Dirección</Label>
                                <Input
                                    placeholder="Calle 123 # 45-67"
                                    value={newBranch.address}
                                    onChange={e => setNewBranch(f => ({ ...f, address: e.target.value }))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Ciudad</Label>
                                    <Input
                                        placeholder="Bogotá"
                                        value={newBranch.city}
                                        onChange={e => setNewBranch(f => ({ ...f, city: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Teléfono</Label>
                                    <Input
                                        placeholder="3001234567"
                                        value={newBranch.phone}
                                        onChange={e => setNewBranch(f => ({ ...f, phone: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button className="flex-1" onClick={handleCreateBranch} disabled={creating}>
                                    {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                    Crear Sede
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Global summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Estudiantes', value: totals.students, icon: Users, color: 'text-blue-600' },
                    { label: 'Total Entrenadores', value: totals.coaches, icon: Activity, color: 'text-green-600' },
                    { label: 'Ingresos del Mes', value: `$${totals.income.toLocaleString('es-CO')}`, icon: DollarSign, color: 'text-emerald-600' },
                    { label: 'Sedes Activas', value: branches.length, icon: Building, color: 'text-purple-600' },
                ].map(stat => (
                    <Card key={stat.label}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                                </div>
                                <stat.icon className={`h-8 w-8 opacity-20 ${stat.color}`} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Branch cards */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : branches.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                        <Building className="h-12 w-12 text-muted-foreground opacity-30" />
                        <p className="text-muted-foreground">No hay sedes registradas aún</p>
                        <Button onClick={() => setDialogOpen(true)} variant="outline" className="gap-2">
                            <Plus className="h-4 w-4" /> Crear primera sede
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {branches.map(branch => (
                        <Card
                            key={branch.id}
                            className="hover:shadow-md transition-shadow cursor-pointer group"
                            onClick={() => navigate(`/branches`)}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Building className="h-4 w-4 text-primary" />
                                            {branch.name}
                                        </CardTitle>
                                        {(branch.city || branch.address) && (
                                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {branch.city || branch.address}
                                            </p>
                                        )}
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center">
                                        <p className="text-xl font-bold text-blue-600">{branch.students}</p>
                                        <p className="text-xs text-muted-foreground">Estudiantes</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xl font-bold text-green-600">{branch.coaches}</p>
                                        <p className="text-xs text-muted-foreground">Entrenadores</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xl font-bold text-emerald-600 text-sm">
                                            ${(branch.monthly_income / 1000).toFixed(0)}K
                                        </p>
                                        <p className="text-xs text-muted-foreground">Ingresos/mes</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
