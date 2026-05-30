import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Star, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const BFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

interface TrainerFeedbackModalProps {
  open:       boolean;
  onClose:    () => void;
  planId:     string;
  planName:   string;
  clientName: string;
  existing?:  { note?: string; rating?: number } | null;
  onSaved:    () => void;
}

export function TrainerFeedbackModal({
  open, onClose, planId, planName, clientName, existing, onSaved,
}: TrainerFeedbackModalProps) {
  const { session } = useAuth();
  const { toast }   = useToast();

  const [note,      setNote]      = useState(existing?.note    ?? '');
  const [rating,    setRating]    = useState(existing?.rating  ?? 0);
  const [hovered,   setHovered]   = useState(0);
  const [isSaving,  setIsSaving]  = useState(false);

  const handleSave = async () => {
    if (!note.trim() && rating === 0) return;
    setIsSaving(true);
    try {
      const res = await fetch(
        `${BFF_URL}/api/v1/trainer/session-plans/${planId}/feedback`,
        {
          method:  'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            note:   note.trim() || null,
            rating: rating || null,
          }),
        },
      );
      if (!res.ok) throw new Error();
      toast({ title: '✅ Feedback guardado' });
      onSaved();
      onClose();
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar el feedback.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-primary/20">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">Feedback del entrenador</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {clientName} · <span className="font-medium">{planName}</span>
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Rating de estrellas */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest">
              Desempeño general
            </Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  className="p-1 transition-transform hover:scale-110"
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(star === rating ? 0 : star)}
                >
                  <Star
                    className={`h-7 w-7 transition-colors ${
                      star <= (hovered || rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/30'
                    }`}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 text-xs text-muted-foreground self-center font-medium">
                  {['', 'Necesita mejorar', 'Regular', 'Bien', 'Muy bien', 'Excelente'][rating]}
                </span>
              )}
            </div>
          </div>

          {/* Nota */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest">
              Nota para el cliente
            </Label>
            <Textarea
              placeholder="Ej: Buena ejecución en sentadilla, trabajar en la postura durante el press..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            <p className="text-[10px] text-muted-foreground">
              El cliente verá este mensaje en su historial de sesiones.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || (!note.trim() && rating === 0)}
            className="gap-2"
          >
            {isSaving
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <MessageSquare className="h-4 w-4" />
            }
            Guardar feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
