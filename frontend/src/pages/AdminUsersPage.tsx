// frontend/src/pages/AdminUsersPage.tsx

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { normalizeText } from '@/lib/normalizeText';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Users, Plus, Mail, Building, Loader2, AlertCircle, CheckCircle, Stethoscope } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { StatFilterBar } from '@/components/common/StatFilterBar';
import { TableRefreshBar } from '@/components/common/TableRefreshBar';
import { useAuth } from '@/contexts/AuthContext';
import UserStateDialog from '@/components/admin/UserStateDialog';

interface SchoolMember {
    id: string;
    profile_id: string;
    role: string;
    branch_id: string | null;
    status: string;
    branch_name?: string;
    full_name?: string;
    email?: string;
    created_at: string;
}

interface Branch {
    id: string;
    name: string;
}

const ROLE_LABELS: Record<string, string> = {
    owner: 'Propietario',
    admin: 'Admin General',
    super_admin: 'Admin General',
    school_admin: 'Admin de Sede',
    coach: 'Entrenador',
    staff: 'Staff',
    parent: 'Padre/Madre',
    athlete: 'Atleta',
    reporter: 'Auditor',
    viewer: 'Visitante',
};

const ROLE_COLORS: Record<string, string> = {
    owner: 'bg-purple-100 text-purple-800',
    admin: 'bg-purple-100 text-purple-800',
    super_admin: 'bg-purple-100 text-purple-800',
    school_admin: 'bg-blue-100 text-blue-800',
    coach: 'bg-green-100 text-green-800',
    staff: 'bg-gray-100 text-gray-800',
    parent: 'bg-orange-100 text-orange-800',
    athlete: 'bg-yellow-100 text-yellow-800',
    reporter: 'bg-teal-100 text-teal-800',
    viewer: 'bg-slate-100 text-slate-600',
};

// FIX 4 — roleGroups ahora incluye staff y viewer (roles válidos en DB)
const roleGroups = [
    'owner', 'admin', 'super_admin', 'school_admin',
    'coach', 'parent', 'athlete', 'reporter', 'staff', 'viewer',
];

export default function AdminUsersPage() {
    const { schoolId } = useSchoolContext();
    const { profile } = useAuth();
    // El endpoint de diagnóstico es exclusivo de super_admin (expone datos de
    // auth de terceros). Esta página también la abren 'admin' y 'school', así
    // que la columna no se muestra para ellos: el BFF igual los rechazaría.
    const canDiagnose = profile?.role === 'super_admin';
    const [diagEmail, setDiagEmail] = useState<string | null>(null);
    const [members, setMembers] = useState<SchoolMember[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [inviteForm, setInviteForm] = useState({
        email: '',
        role: 'school_admin' as string,
        branch_id: '',
        full_name: '',
    });

    useEffect(() => {
        if (!schoolId) return;
        fetchMembers();
        fetchBranches();
    }, [schoolId]);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('school_members')
                .select(`
                    id,
                    profile_id,
                    role,
                    branch_id,
                    status,
                    created_at,
                    school_branches(name),
                    profiles(full_name, email)
                `)
                // FIX 2 — filtrar por status activo para aprovechar el índice parcial
                // que creamos: idx_school_members_profile_school WHERE status = 'active'
                .eq('school_id', schoolId!)
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mapped: SchoolMember[] = (data || []).map((m: any) => ({
                id: m.id,
                profile_id: m.profile_id,
                role: m.role,
                branch_id: m.branch_id,
                status: m.status,
                created_at: m.created_at,
                // FIX 1 — el join correcto es school_branches, no branches
                branch_name: m.school_branches?.name,
                full_name: m.profiles?.full_name || 'Sin nombre',
                email: m.profiles?.email || '',
            }));

            setMembers(mapped);
        } catch (err) {
            console.error('Error fetching members:', err);
            toast({
                title: 'Error al cargar usuarios',
                description: 'No se pudieron obtener los miembros de la escuela.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchBranches = async () => {
        const { data } = await supabase
            .from('school_branches')
            .select('id, name')
            .eq('school_id', schoolId!);
        setBranches(data || []);
    };

    const handleInvite = async () => {
        if (!inviteForm.email || !inviteForm.role) {
            toast({ title: 'Completa todos los campos', variant: 'destructive' });
            return;
        }

        setInviting(true);
        try {
            const { error } = await supabase.rpc('create_invitation', {
                p_email: inviteForm.email.toLowerCase().trim(),
                p_role: inviteForm.role,
                p_branch_id: inviteForm.branch_id || undefined,
            });

            if (error) {
                // FIX 3 — fallback corregido:
                // - tabla correcta: 'invitations' (no 'school_invitations')
                // - columna correcta: 'role_to_assign' (no 'role')
                // - agregar invited_by con el usuario actual
                const { data: { user } } = await supabase.auth.getUser();

                const { error: invErr } = await supabase.from('invitations').insert({
                    school_id: schoolId!,
                    email: inviteForm.email.toLowerCase().trim(),
                    role_to_assign: inviteForm.role,
                    branch_id: inviteForm.branch_id || null,
                    status: 'pending',
                    invited_by: user?.id ?? null,
                });

                if (invErr) throw invErr;
            }

            toast({
                title: '¡Invitación enviada!',
                description: `Se le notificará a ${inviteForm.email} para que complete su registro.`,
            });

            setDialogOpen(false);
            setInviteForm({ email: '', role: 'school_admin', branch_id: '', full_name: '' });
            fetchMembers();
        } catch (err: any) {
            toast({
                title: 'Error al invitar',
                description: err.message || 'Inténtalo de nuevo',
                variant: 'destructive',
            });
        } finally {
            setInviting(false);
        }
    };

    const filtered = members.filter(m => {
        const q = normalizeText(search);
        const matchSearch =
            !q ||
            normalizeText(m.full_name).includes(q) ||
            normalizeText(m.email).includes(q);
        const matchRole = roleFilter === 'all' || m.role === roleFilter;
        return matchSearch && matchRole;
    });

    const roleCounts = roleGroups.reduce((acc, role) => {
        acc[role] = members.filter(m => m.role === role).length;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Users className="h-7 w-7 text-primary" />
                        Gestión de Usuarios
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Administra todos los miembros de tu escuela
                    </p>
                </div>
                <div className="flex gap-2">
                {/* La tabla solo lista miembros de ESTA escuela; el caso de soporte
                    típico llega por correo y puede no estar en ella. Por eso el
                    diagnóstico también se abre en blanco desde el encabezado. */}
                {canDiagnose && (
                    <Button variant="outline" className="gap-2" onClick={() => setDiagEmail('')}>
                        <Stethoscope className="h-4 w-4" />
                        Diagnosticar cuenta
                    </Button>
                )}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Invitar Usuario
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Invitar Nuevo Usuario</DialogTitle>
                            <DialogDescription>
                                Envía una invitación por correo electrónico para que se unan a la plataforma.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre Completo</Label>
                                <Input
                                    id="name"
                                    placeholder="Juan Pérez"
                                    value={inviteForm.full_name}
                                    onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Correo Electrónico</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@escuela.com"
                                    value={inviteForm.email}
                                    onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Rol</Label>
                                <Select
                                    value={inviteForm.role}
                                    onValueChange={v => setInviteForm(f => ({ ...f, role: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="school_admin">Admin de Sede</SelectItem>
                                        <SelectItem value="coach">Entrenador</SelectItem>
                                        <SelectItem value="reporter">Auditor (Solo reportes)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {inviteForm.role === 'school_admin' && branches.length > 0 && (
                                <div className="space-y-2">
                                    <Label>Asignar a Sede</Label>
                                    <Select
                                        value={inviteForm.branch_id}
                                        onValueChange={v => setInviteForm(f => ({ ...f, branch_id: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona una sede..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">Todas las sedes (global)</SelectItem>
                                            {branches.map(b => (
                                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setDialogOpen(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    className="flex-1 gap-2"
                                    onClick={handleInvite}
                                    disabled={inviting}
                                >
                                    {inviting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Mail className="h-4 w-4" />
                                    )}
                                    Enviar Invitación
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
                </div>
            </div>

            {canDiagnose && (
                <UserStateDialog
                    open={diagEmail !== null}
                    onOpenChange={(o) => { if (!o) setDiagEmail(null); }}
                    initialEmail={diagEmail ?? undefined}
                />
            )}

            {/* Stats cards — filtran la tabla por rol al hacer clic */}
            <StatFilterBar
                columns={5}
                value={roleFilter === 'all' ? null : roleFilter}
                onChange={(v) => setRoleFilter(v ?? 'all')}
                items={[
                    { key: null, label: 'Todos', value: members.length, tone: 'neutral' },
                    { key: 'school_admin', label: 'Admins de Sede', value: roleCounts.school_admin || 0, tone: 'blue' },
                    { key: 'coach', label: 'Entrenadores', value: roleCounts.coach || 0, tone: 'emerald' },
                    { key: 'parent', label: 'Padres', value: roleCounts.parent || 0, tone: 'orange' },
                    { key: 'athlete', label: 'Atletas', value: roleCounts.athlete || 0, tone: 'yellow' },
                ]}
            />

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
                <Input
                    placeholder="Buscar por nombre o email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="max-w-xs"
                />
                {/* FIX 4 — filtro de roles ahora incluye staff y viewer */}
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-48">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los roles</SelectItem>
                        <SelectItem value="school_admin">Admin de Sede</SelectItem>
                        <SelectItem value="coach">Entrenadores</SelectItem>
                        <SelectItem value="parent">Padres</SelectItem>
                        <SelectItem value="athlete">Atletas</SelectItem>
                        <SelectItem value="reporter">Auditores</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="viewer">Visitantes</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        {filtered.length} usuario{filtered.length !== 1 ? 's' : ''}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                            <Users className="h-10 w-10 opacity-30" />
                            <p className="text-sm">No hay usuarios que coincidan con la búsqueda</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Sede</TableHead>
                                    <TableHead>Estado</TableHead>
                                    {canDiagnose && <TableHead className="w-12" />}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map(m => (
                                    <TableRow key={m.id}>
                                        <TableCell className="font-medium">{m.full_name}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{m.email}</TableCell>
                                        <TableCell>
                                            <Badge className={`text-xs ${ROLE_COLORS[m.role] || 'bg-gray-100 text-gray-800'}`}>
                                                {ROLE_LABELS[m.role] || m.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {m.branch_name ? (
                                                <span className="flex items-center gap-1 text-sm">
                                                    <Building className="h-3 w-3 text-muted-foreground" />
                                                    {m.branch_name}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">Global</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {m.status === 'active' ? (
                                                <span className="flex items-center gap-1 text-xs text-green-600">
                                                    <CheckCircle className="h-3 w-3" /> Activo
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs text-yellow-600">
                                                    <AlertCircle className="h-3 w-3" /> {m.status}
                                                </span>
                                            )}
                                        </TableCell>
                                        {canDiagnose && (
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Diagnosticar cuenta"
                                                    disabled={!m.email}
                                                    onClick={() => setDiagEmail(m.email!)}
                                                >
                                                    <Stethoscope className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    <TableRefreshBar
                        onRefresh={fetchMembers}
                        loading={loading}
                        summary={
                            filtered.length === members.length
                                ? `${members.length} usuario(s)`
                                : `${filtered.length} de ${members.length} usuario(s)`
                        }
                    />
                </CardContent>
            </Card>
        </div>
    );
}