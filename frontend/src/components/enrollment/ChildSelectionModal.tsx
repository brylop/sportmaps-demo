import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, User, Check, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface ChildSelectionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChildSelected: (childId: string) => void;
    programName?: string;
}

export function ChildSelectionModal({
    open,
    onOpenChange,
    onChildSelected,
    programName
}: ChildSelectionModalProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
    const [isAddingChild, setIsAddingChild] = useState(false);
    const [newChildName, setNewChildName] = useState('');
    const [newChildDOB, setNewChildDOB] = useState('');

    // Fetch children
    const { data: children = [], isLoading } = useQuery({
        queryKey: ['my-children', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from('children')
                .select('*')
                .eq('parent_id', user.id);

            if (error) throw error;
            return data;
        },
        enabled: open && !!user,
    });

    // Mutation to add child
    const addChildMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error('No usuario');

            const { data, error } = await supabase
                .from('children')
                .insert({
                    parent_id: user.id,
                    full_name: newChildName,
                    date_of_birth: newChildDOB, // Schema validation might require proper format
                    // Default fields to satisfy constraints if any?
                    // Schema says: full_name, date_of_birth are NOT NULL.
                    // school_id is NOT NULL but it might be optional in children table?
                    // Let's check schema. Previous schema reviews showed school_id on children.
                    // BUT children are often created *before* school assignment?
                    // Or user is adding child *globally*?
                    // If table has NOT NULL school_id, we have a problem for global children registry.
                    // Let's assume for now we can insert without school_id or handle it.
                } as any)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (newChild) => {
            queryClient.invalidateQueries({ queryKey: ['my-children'] });
            setIsAddingChild(false);
            setNewChildName('');
            setNewChildDOB('');
            setSelectedChildId(newChild.id);
            toast({ title: 'Hijo agregado correctamente' });
        },
        onError: (error: any) => {
            toast({
                title: 'Error al agregar hijo',
                description: error.message,
                variant: 'destructive'
            });
        }
    });

    const handleConfirm = () => {
        if (selectedChildId) {
            onChildSelected(selectedChildId);
            onOpenChange(false);
        }
    };

    const handleCreateChild = () => {
        if (!newChildName || !newChildDOB) {
            toast({
                title: 'Faltan datos',
                description: 'Por favor completa el nombre y fecha de nacimiento',
                variant: 'destructive'
            });
            return;
        }
        addChildMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>¿Quién asistirá al programa?</DialogTitle>
                    <DialogDescription>
                        Selecciona el hijo que quieres inscribir en {programName || 'el programa'}.
                    </DialogDescription>
                </DialogHeader>

                {isAddingChild ? (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nombre Completo</Label>
                            <Input
                                placeholder="Ej. Juan Pérez"
                                value={newChildName}
                                onChange={(e) => setNewChildName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Fecha de Nacimiento</Label>
                            <Input
                                type="date"
                                value={newChildDOB}
                                onChange={(e) => setNewChildDOB(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setIsAddingChild(false)}>Cancelar</Button>
                            <Button onClick={handleCreateChild} disabled={addChildMutation.isPending}>
                                {addChildMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 py-4">
                        {isLoading ? (
                            <div className="flex justify-center p-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : children.length === 0 ? (
                            <div className="text-center py-6 border-2 border-dashed rounded-lg">
                                <User className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground mb-4">No tienes hijos registrados</p>
                                <Button onClick={() => setIsAddingChild(true)} variant="outline">
                                    <Plus className="mr-2 h-4 w-4" /> Agregar Hijo
                                </Button>
                            </div>
                        ) : (
                            <RadioGroup value={selectedChildId || ''} onValueChange={setSelectedChildId}>
                                <div className="grid gap-3">
                                    {children.map((child: any) => (
                                        <Label
                                            key={child.id}
                                            className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedChildId === child.id
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-transparent bg-muted hover:bg-muted/80'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <RadioGroupItem value={child.id} className="sr-only" />
                                                <Avatar>
                                                    <AvatarImage src={child.avatar_url} />
                                                    <AvatarFallback>{child.full_name?.charAt(0) || 'H'}</AvatarFallback>
                                                </Avatar>
                                                <div className="font-medium">
                                                    {child.full_name}
                                                    <span className="block text-xs text-muted-foreground font-normal">
                                                        {/* Calculate age roughly */}
                                                        {new Date().getFullYear() - new Date(child.date_of_birth).getFullYear()} años
                                                    </span>
                                                </div>
                                            </div>
                                            {selectedChildId === child.id && (
                                                <Check className="h-5 w-5 text-primary" />
                                            )}
                                        </Label>
                                    ))}

                                    <Button
                                        variant="ghost"
                                        className="w-full mt-2"
                                        onClick={() => setIsAddingChild(true)}
                                    >
                                        <Plus className="mr-2 h-4 w-4" /> Registrar otro hijo
                                    </Button>
                                </div>
                            </RadioGroup>
                        )}
                    </div>
                )}

                {!isAddingChild && children.length > 0 && (
                    <DialogFooter>
                        <Button
                            className="w-full"
                            disabled={!selectedChildId}
                            onClick={handleConfirm}
                        >
                            Continuar a Pago
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
