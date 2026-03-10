import { useState } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBookingMutations } from '@/hooks/useSessionBookings';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { Loader2 } from 'lucide-react';

interface AddDropInModalProps {
    open: boolean;
    onClose: () => void;
    sessionId: string;
}

interface SearchResult {
    childId: string;
    fullName: string;
    enrollmentId: string;
}

/**
 * Modal para agregar un drop-in a la sesión (usado por Coach).
 * Busca atletas de la escuela y crea un booking tipo drop_in.
 */
export function AddDropInModal({ open, onClose, sessionId }: AddDropInModalProps) {
    const { toast } = useToast();
    const { schoolId } = useSchoolContext();
    const { bookSession } = useBookingMutations();
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);

    const handleSearch = async () => {
        if (!search.trim() || !schoolId) return;
        setSearching(true);

        const { data } = await supabase
            .from('children')
            .select('id, full_name')
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .ilike('full_name', `%${search.trim()}%`)
            .limit(10);

        if (data) {
            const enriched: SearchResult[] = [];
            for (const child of data) {
                const { data: enrollment } = await supabase
                    .from('enrollments')
                    .select('id')
                    .eq('child_id', child.id)
                    .eq('school_id', schoolId)
                    .eq('status', 'active')
                    .limit(1)
                    .maybeSingle();

                if (enrollment) {
                    enriched.push({
                        childId: child.id,
                        fullName: child.full_name,
                        enrollmentId: enrollment.id,
                    });
                }
            }
            setResults(enriched);
        }
        setSearching(false);
    };

    const handleSelect = (result: SearchResult) => {
        bookSession.mutate(
            {
                sessionId,
                enrollment_id: result.enrollmentId,
                child_id: result.childId,
                booking_type: 'drop_in',
            },
            {
                onSuccess: () => {
                    toast({ title: `${result.fullName} agregado como drop-in` });
                    onClose();
                    setSearch('');
                    setResults([]);
                },
                onError: (err: Error) => {
                    toast({ title: 'Error', description: err.message, variant: 'destructive' });
                },
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Agregar Drop-in</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Buscar estudiante..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button onClick={handleSearch} disabled={searching} size="sm">
                            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
                        </Button>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-1">
                        {results.length === 0 && !searching && search && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No se encontraron estudiantes.
                            </p>
                        )}
                        {results.map((r) => (
                            <Button
                                key={r.childId}
                                variant="ghost"
                                className="w-full justify-start text-sm"
                                onClick={() => handleSelect(r)}
                                disabled={bookSession.isPending}
                            >
                                {r.fullName}
                            </Button>
                        ))}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
