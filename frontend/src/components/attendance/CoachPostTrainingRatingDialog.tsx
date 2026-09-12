import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Mic } from 'lucide-react';

/**
 * Rating del coach por atleta, tras cerrar la sesión — spec
 * docs/specs/evaluacion-post-entrenamiento.md §5.2. Se abre automáticamente al
 * finalizar asistencia (ver CoachAttendancePage.finalizeMutation.onSuccess).
 */

const RATING_STEPS = [
  { value: 50, label: 'Menos de la mitad' },
  { value: 60, label: 'A la mitad' },
  { value: 70, label: 'Moderado' },
  { value: 80, label: 'Buena manera' },
  { value: 90, label: 'Muy buena manera' },
  { value: 100, label: 'Todo su esfuerzo' },
];

interface Props {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CoachPostTrainingRatingDialog({ sessionId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');

  const { data: athletes, isLoading } = useQuery({
    queryKey: ['post-training-coach-roster', sessionId],
    enabled: open && !!sessionId,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance_records')
        .select('child_id, user_id, children(id, full_name, avatar_url), profiles(id, full_name, avatar_url)')
        .eq('session_id', sessionId as string)
        .in('status', ['present', 'late']);

      return ((data ?? []) as any[]).map((r) => ({
        key: r.child_id ?? r.user_id,
        childId: r.child_id as string | null,
        userId: r.user_id as string | null,
        name: r.children?.full_name ?? r.profiles?.full_name ?? 'Deportista',
        avatarUrl: r.children?.avatar_url ?? r.profiles?.avatar_url ?? null,
      }));
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error('Sin sesión.');
      const p_ratings = (athletes ?? [])
        .filter((a) => ratings[a.key] !== undefined)
        .map((a) => ({
          child_id: a.childId ?? undefined,
          user_id: a.userId ?? undefined,
          effort_pct: ratings[a.key],
        }));

      const { data, error } = await supabase.rpc('submit_post_training_coach_rating', {
        p_session_id: sessionId,
        p_ratings,
        p_coach_notes: notes.trim() || null,
      });
      if (error) throw error;
      return data as { saved: number; pending: number };
    },
    onSuccess: (data) => {
      toast({
        title: 'Rating guardado',
        description: data.pending > 0
          ? `Faltan ${data.pending} por calificar — puedes volver más tarde.`
          : 'Las familias recibirán el resumen en el informe del mes.',
      });
      onOpenChange(false);
      setRatings({});
      setNotes('');
    },
    onError: (err: any) => {
      toast({ title: 'No se pudo guardar', description: err?.message, variant: 'destructive' });
    },
  });

  const total = athletes?.length ?? 0;
  const done = Object.keys(ratings).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Califica el entreno de hoy</DialogTitle>
          <p className="text-xs text-muted-foreground">{done} de {total} calificados</p>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground py-4">Cargando roster…</p>}

        <div className="flex flex-col gap-4 py-2">
          {(athletes ?? []).map((a) => (
            <div key={a.key} className="border rounded-2xl p-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm overflow-hidden shrink-0">
                  {a.avatarUrl ? <img src={a.avatarUrl} className="w-full h-full object-cover" /> : a.name.charAt(0)}
                </div>
                <p className="font-semibold text-sm">{a.name}</p>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {RATING_STEPS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setRatings((r) => ({ ...r, [a.key]: s.value }))}
                    className={`rounded-lg px-2 py-1.5 text-[11px] font-bold border-2 ${ratings[a.key] === s.value ? 'border-orange bg-orange text-white' : 'border-border text-muted-foreground'}`}
                  >
                    {s.value}%
                  </button>
                ))}
              </div>
              {ratings[a.key] && (
                <p className="text-[11px] text-orange-dark font-semibold mt-1">
                  {ratings[a.key]}% · {RATING_STEPS.find((s) => s.value === ratings[a.key])?.label}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
            <Mic className="w-3.5 h-3.5" /> Nota de la sesión (opcional)
          </label>
          <Textarea
            placeholder="¿Cómo estuvo el grupo hoy?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-xl"
            rows={3}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Después</Button>
          <Button
            disabled={submit.isPending || done === 0}
            onClick={() => submit.mutate()}
            className="bg-orange hover:bg-orange-dark"
          >
            {submit.isPending ? 'Guardando…' : 'Guardar rating'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
