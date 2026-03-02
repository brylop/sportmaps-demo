import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Loader2 } from 'lucide-react';
import { NumberStepper } from '../ui/number-stepper';
import { useToast } from '@/hooks/use-toast';
import { createStudentWithPendingPayment, useSchoolContext } from '@/hooks/useSchoolContext';

interface CreateStudentModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    schoolId: string;
}

export function CreateStudentModal({ open, onClose, onSuccess, schoolId }: CreateStudentModalProps) {
    const { schoolName, programs, activeBranchId, defaultMonthlyFee } = useSchoolContext();
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        fullName: '',
        dateOfBirth: '',
        parentName: '',
        parentEmail: '',
        parentPhone: '',
        programId: '',
        monthlyFee: defaultMonthlyFee,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.fullName || !formData.parentEmail) {
            toast({
                title: 'Campos requeridos',
                description: 'Nombre del estudiante y email del padre son necesarios',
                variant: 'destructive'
            });
            return;
        }

        setLoading(true);
        try {
            const selectedProgram = programs.find(p => p.id === formData.programId);

            await createStudentWithPendingPayment({
                fullName: formData.fullName,
                dateOfBirth: formData.dateOfBirth || undefined,
                parentName: formData.parentName || undefined,
                parentEmail: formData.parentEmail,
                parentPhone: formData.parentPhone || undefined,
                schoolId,
                schoolName: schoolName || 'Tu Escuela',
                branchId: selectedProgram?.branch_id || activeBranchId || undefined,
                programId: formData.programId || undefined,
                programName: selectedProgram?.name || 'Programa General',
                monthlyFee: formData.monthlyFee,
            });

            toast({
                title: '¡Estudiante creado!',
                description: `Se ha enviado la invitación a ${formData.parentEmail}`,
            });

            onSuccess();
            handleClose();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'No se pudo crear el estudiante',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({
            fullName: '',
            dateOfBirth: '',
            parentName: '',
            parentEmail: '',
            parentPhone: '',
            programId: '',
            monthlyFee: defaultMonthlyFee,
        });
        onClose();
    };

    const handleProgramChange = (val: string) => {
        const prog = programs.find(p => p.id === val);
        setFormData(prev => ({
            ...prev,
            programId: val,
            monthlyFee: prog?.monthly_fee || defaultMonthlyFee
        }));
    };

    return (
        <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Nuevo Alumno e Invitación
                    </DialogTitle>
                    <DialogDescription>
                        Registra al estudiante y envía una invitación al padre para que complete el vínculo.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="stdName">Nombre completo del Estudiante *</Label>
                        <Input
                            id="stdName"
                            placeholder="Ej: Mateo Pérez"
                            value={formData.fullName}
                            onChange={(e) => setFormData(p => ({ ...p, fullName: e.target.value }))}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="stdDob">Fecha de Nacimiento</Label>
                            <Input
                                id="stdDob"
                                type="date"
                                value={formData.dateOfBirth}
                                onChange={(e) => setFormData(p => ({ ...p, dateOfBirth: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="progId">Programa / Clase</Label>
                            <Select value={formData.programId} onValueChange={handleProgramChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent>
                                    {programs.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="parentEmail">Email del Padre/Madre *</Label>
                        <Input
                            id="parentEmail"
                            type="email"
                            placeholder="padre@ejemplo.com"
                            value={formData.parentEmail}
                            onChange={(e) => setFormData(p => ({ ...p, parentEmail: e.target.value }))}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="parentName">Nombre del Acudiente</Label>
                            <Input
                                id="parentName"
                                placeholder="Ej: María García"
                                value={formData.parentName}
                                onChange={(e) => setFormData(p => ({ ...p, parentName: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="parentPhone">Teléfono</Label>
                            <Input
                                id="parentPhone"
                                placeholder="300..."
                                value={formData.parentPhone}
                                onChange={(e) => setFormData(p => ({ ...p, parentPhone: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="fee">Mensualidad Pactada (COP)</Label>
                        <NumberStepper
                            value={formData.monthlyFee}
                            onChange={(val) => setFormData(p => ({ ...p, monthlyFee: val === '' ? 0 : val }))}
                            min={0}
                            step={10000}
                            unit="$"
                        />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button variant="outline" type="button" onClick={handleClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                            Crear Estudiante e Invitar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
