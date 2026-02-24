import React, { useState, useEffect, useCallback } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { branchesAPI, SchoolBranch } from '@/lib/api/branches';
import { Plus, Edit2, Trash2, MapPin, Phone, Building2, Users, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

export default function SchoolBranchesManagementPage() {
    const { schoolId } = useSchoolContext();
    const [branches, setBranches] = useState<SchoolBranch[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<SchoolBranch | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        city: '',
        phone: '',
        capacity: 50,
        is_main: false,
    });

    const loadBranches = useCallback(async () => {
        if (!schoolId) return;
        try {
            setLoading(true);
            const data = await branchesAPI.getBranches(schoolId);
            setBranches(data);
        } catch (error) {
            console.error('Error loading branches:', error);
            toast.error('Error al cargar las sedes');
        } finally {
            setLoading(false);
        }
    }, [schoolId]);

    useEffect(() => {
        if (schoolId) {
            loadBranches();
        }
    }, [schoolId, loadBranches]);

    const resetForm = () => {
        setFormData({ name: '', address: '', city: '', phone: '', capacity: 50, is_main: false });
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!schoolId) return;

        try {
            await branchesAPI.createBranch({
                name: formData.name,
                address: formData.address || undefined,
                city: formData.city || undefined,
                phone: formData.phone || undefined,
                capacity: formData.capacity,
                is_main: formData.is_main,
                school_id: schoolId,
            });
            toast.success('✅ Sede creada exitosamente');
            setIsCreateModalOpen(false);
            resetForm();
            loadBranches();
        } catch (error: any) {
            toast.error(error.message || 'Error al crear la sede');
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBranch) return;

        try {
            await branchesAPI.updateBranch(editingBranch.id, {
                name: formData.name,
                address: formData.address || undefined,
                city: formData.city || undefined,
                phone: formData.phone || undefined,
                capacity: formData.capacity,
                is_main: formData.is_main,
            });
            toast.success('✅ Sede actualizada');
            setEditingBranch(null);
            resetForm();
            loadBranches();
        } catch (error: any) {
            toast.error(error.message || 'Error al actualizar la sede');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`¿Eliminar la sede "${name}"? Los programas y estudiantes asociados quedarán sin sede asignada.`)) return;

        try {
            await branchesAPI.deleteBranch(id);
            toast.success('Sede eliminada');
            loadBranches();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error(message || 'Error al eliminar la sede');
        }
    };

    const openEditModal = (branch: SchoolBranch) => {
        setEditingBranch(branch);
        setFormData({
            name: branch.name,
            address: branch.address || '',
            city: branch.city || '',
            phone: branch.phone || '',
            capacity: branch.capacity || 50,
            is_main: branch.is_main,
        });
    };

    const renderBranchForm = (onSubmit: (e: React.FormEvent) => void, submitLabel: string) => (
        <form onSubmit={onSubmit}>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nombre de la Sede *</Label>
                    <Input
                        id="name"
                        required
                        placeholder="Ej. Sede Norte, Campus Principal"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="address">Dirección</Label>
                        <Input
                            id="address"
                            placeholder="Calle 123 # 45-67"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="city">Ciudad</Label>
                        <Input
                            id="city"
                            placeholder="Bogotá"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono de contacto</Label>
                        <Input
                            id="phone"
                            placeholder="300 123 4567"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="capacity">Capacidad máxima</Label>
                        <Input
                            id="capacity"
                            type="number"
                            min={1}
                            placeholder="50"
                            value={formData.capacity}
                            onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 50 })}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <Switch
                        id="is_main"
                        checked={formData.is_main}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_main: checked })}
                    />
                    <Label htmlFor="is_main" className="cursor-pointer">
                        <span className="font-medium">Sede Principal</span>
                        <p className="text-xs text-muted-foreground">Marcada como la sede principal de la academia</p>
                    </Label>
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setEditingBranch(null); setIsCreateModalOpen(false); resetForm(); }}>
                    Cancelar
                </Button>
                <Button type="submit">{submitLabel}</Button>
            </DialogFooter>
        </form>
    );

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Building2 className="h-8 w-8 text-primary" />
                        Gestión de Sedes
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Administra las ubicaciones físicas de tu academia deportiva.
                    </p>
                </div>

                <Dialog open={isCreateModalOpen} onOpenChange={(open) => { setIsCreateModalOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button className="w-full md:w-auto shadow-sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva Sede
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Crear Nueva Sede</DialogTitle>
                            <DialogDescription>
                                Define una nueva ubicación física para tu academia.
                            </DialogDescription>
                        </DialogHeader>
                        {renderBranchForm(handleCreate, 'Crear Sede')}
                    </DialogContent>
                </Dialog>
            </div>

            {/* Summary Stats */}
            {!loading && branches.length > 0 && (
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                    <Card className="p-4">
                        <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            <span className="text-sm text-muted-foreground">Total Sedes</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{branches.length}</p>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-amber-500" />
                            <span className="text-sm text-muted-foreground">Sede Principal</span>
                        </div>
                        <p className="text-lg font-semibold mt-1 truncate">
                            {branches.find(b => b.is_main)?.name || 'Sin definir'}
                        </p>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-blue-500" />
                            <span className="text-sm text-muted-foreground">Capacidad Total</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{branches.reduce((a, b) => a + (b.capacity || 0), 0)}</p>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm text-muted-foreground">Ciudades</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">
                            {new Set(branches.map(b => b.city).filter(Boolean)).size || 1}
                        </p>
                    </Card>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />
                    ))}
                </div>
            ) : branches.length === 0 ? (
                <Card className="border-dashed flex flex-col items-center justify-center py-16 text-center">
                    <Building2 className="h-14 w-14 text-muted-foreground mb-4 opacity-20" />
                    <CardTitle className="text-xl">Sin sedes registradas</CardTitle>
                    <CardDescription className="max-w-sm mt-2 mb-6">
                        Tu academia opera como sede única. Agrega sedes si tienes múltiples ubicaciones físicas.
                    </CardDescription>
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Crear primera sede
                    </Button>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {branches.map(branch => (
                        <Card key={branch.id} className="overflow-hidden border hover:border-primary/40 transition-all duration-300 group hover:shadow-md">
                            <CardHeader className="bg-gradient-to-r from-muted/60 to-muted/30 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-lg">{branch.name}</CardTitle>
                                        {branch.is_main && (
                                            <Badge variant="default" className="bg-amber-500/90 hover:bg-amber-500 text-white text-[10px] px-1.5 py-0">
                                                <Star className="h-2.5 w-2.5 mr-0.5" />
                                                PRINCIPAL
                                            </Badge>
                                        )}
                                    </div>
                                    <Badge variant={branch.status === 'active' ? 'secondary' : 'outline'} className="text-[10px]">
                                        {branch.status === 'active' ? 'Activa' : branch.status === 'maintenance' ? 'Mantenimiento' : 'Inactiva'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-2.5">
                                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-primary/70" />
                                    <span>
                                        {branch.address || 'Sin dirección'}
                                        {branch.city && <span className="text-xs ml-1">· {branch.city}</span>}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Phone className="h-4 w-4 shrink-0 text-primary/70" />
                                    <span>{branch.phone || 'Sin teléfono'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Users className="h-4 w-4 shrink-0 text-primary/70" />
                                    <span>Capacidad: <span className="font-medium text-foreground">{branch.capacity || '—'}</span> atletas</span>
                                </div>
                            </CardContent>
                            <CardFooter className="border-t bg-background pt-3 pb-3 flex justify-end gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="sm" onClick={() => openEditModal(branch)}>
                                    <Edit2 className="h-3 w-3 mr-1.5" />
                                    Editar
                                </Button>
                                {!branch.is_main && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDelete(branch.id, branch.name)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            <Dialog open={!!editingBranch} onOpenChange={(open) => { if (!open) { setEditingBranch(null); resetForm(); } }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Editar Sede</DialogTitle>
                        <DialogDescription>
                            Actualiza los datos de "{editingBranch?.name}".
                        </DialogDescription>
                    </DialogHeader>
                    {renderBranchForm(handleUpdate, 'Guardar Cambios')}
                </DialogContent>
            </Dialog>
        </div>
    );
}
