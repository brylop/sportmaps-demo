import { useState, useEffect } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Users, UserPlus, Baby, Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface ChildSelectorModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    programId: string;
    programName: string;
    schoolId: string;
    schoolName: string;
    onChildSelected: (childId: string, childName: string) => void;
}

interface Child {
    id: string;
    full_name: string;
    date_of_birth: string;
    grade: string | null;
}

function computeAge(dob: string): number {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

export function ChildSelectorModal({
    open, onOpenChange, programId, programName, schoolId, schoolName, onChildSelected
}: ChildSelectorModalProps) {
    const { user } = useAuth();
    const [children, setChildren] = useState<Child[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
    const [showNewChildForm, setShowNewChildForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // New child form
    const [newChildName, setNewChildName] = useState('');
    const [newChildDob, setNewChildDob] = useState('');


    useEffect(() => {
        if (open && user) {
            loadChildren();
        }
    }, [open, user]);

    async function loadChildren() {
        if (!user) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('children')
                .select('id, full_name, date_of_birth, grade')
                .eq('parent_id', user.id)
                .order('full_name');

            if (error) throw error;
            setChildren(data || []);

            // Auto-select if only one child
            if (data && data.length === 1) {
                setSelectedChildId(data[0].id);
            }

            // Show form if no children
            if (!data || data.length === 0) {
                setShowNewChildForm(true);
            }
        } catch (error) {
            console.error('Error loading children:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateChild(e: React.FormEvent) {
        e.preventDefault();
        if (!user || !newChildName.trim()) return;

        try {
            setSubmitting(true);
            const dobValue = newChildDob || new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('children')
                .insert({
                    full_name: newChildName.trim(),
                    date_of_birth: dobValue,
                    parent_id: user.id,
                    school_id: schoolId,
                })
                .select('id, full_name, date_of_birth, grade')
                .single();

            if (error) throw error;

            setChildren(prev => [...prev, data]);
            setSelectedChildId(data.id);
            setShowNewChildForm(false);
            setNewChildName('');
            setNewChildDob('');
            toast.success(`${data.full_name} agregado correctamente`);
        } catch (error: any) {
            toast.error(error.message || 'Error al agregar hijo/a');
        } finally {
            setSubmitting(false);
        }
    }

    function handleConfirm() {
        if (!selectedChildId) return;
        const child = children.find(c => c.id === selectedChildId);
        if (child) {
            onChildSelected(child.id, child.full_name);
        }
    }

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Users className="h-5 w-5 text-primary" />
                        ¿Quién se inscribe?
                    </DialogTitle>
                    <DialogDescription>
                        Selecciona al niño/a que participará en <span className="font-medium text-foreground">"{programName}"</span> en {schoolName}.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-4 py-2">
                        {/* Existing children */}
                        {children.length > 0 && !showNewChildForm && (
                            <RadioGroup
                                value={selectedChildId || ''}
                                onValueChange={setSelectedChildId}
                                className="space-y-2"
                            >
                                {children.map(child => (
                                    <label
                                        key={child.id}
                                        htmlFor={`child-${child.id}`}
                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedChildId === child.id
                                            ? 'border-primary bg-primary/5 shadow-sm'
                                            : 'border-border hover:border-primary/40'
                                            }`}
                                    >
                                        <RadioGroupItem value={child.id} id={`child-${child.id}`} className="sr-only" />
                                        <Avatar className="h-10 w-10 bg-primary/10">
                                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                                                {getInitials(child.full_name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm">{child.full_name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {child.date_of_birth ? `${computeAge(child.date_of_birth)} años` : ''}
                                                {child.date_of_birth && child.grade ? ' · ' : ''}
                                                {child.grade || ''}
                                            </p>
                                        </div>
                                        {selectedChildId === child.id && (
                                            <ChevronRight className="h-5 w-5 text-primary animate-in fade-in" />
                                        )}
                                    </label>
                                ))}
                            </RadioGroup>
                        )}

                        {/* New child form */}
                        {showNewChildForm ? (
                            <form onSubmit={handleCreateChild} className="space-y-3 p-4 rounded-xl border-2 border-dashed bg-muted/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <Baby className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-semibold">Agregar hijo/a</span>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="child-name" className="text-xs">Nombre completo</Label>
                                    <Input
                                        id="child-name"
                                        required
                                        placeholder="Ej. Sofía García"
                                        value={newChildName}
                                        onChange={e => setNewChildName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="child-dob" className="text-xs">Fecha de nacimiento</Label>
                                    <Input
                                        id="child-dob"
                                        type="date"
                                        value={newChildDob}
                                        onChange={e => setNewChildDob(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2 pt-1">
                                    {children.length > 0 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowNewChildForm(false)}
                                        >
                                            Cancelar
                                        </Button>
                                    )}
                                    <Button type="submit" size="sm" disabled={submitting} className="flex-1">
                                        {submitting ? (
                                            <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Guardando...</>
                                        ) : 'Agregar'}
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-dashed"
                                onClick={() => setShowNewChildForm(true)}
                            >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Agregar otro hijo/a
                            </Button>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedChildId || showNewChildForm}
                        className="w-full"
                    >
                        Continuar inscripción
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
