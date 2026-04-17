import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, Loader2, Trophy, Clock, Dumbbell, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Checkbox } from '@/components/ui/checkbox';

interface CompleteSessionModalProps {
  open: boolean;
  onClose: () => void;
  plan: any;
  onCompleted: (results: any) => Promise<void>;
  isLoading?: boolean;
}

export function CompleteSessionModal({ open, onClose, plan, onCompleted, isLoading }: CompleteSessionModalProps) {
  const [results, setResults] = useState<any>({
    completed: true,
    actual_duration_minutes: 60,
    performance_note: '',
    blocks_results: [],
  });

  useEffect(() => {
    if (plan && open) {
      setResults({
        completed: true,
        actual_duration_minutes: plan.results?.actual_duration_minutes || 60,
        performance_note: plan.results?.performance_note || '',
        blocks_results: (plan.blocks || []).map((block: any, index: number) => ({
          block_index: index,
          actual_reps: block.reps || '',
          actual_weight: block.weight || '',
          completed: true,
        })),
      });
    }
  }, [plan, open]);

  const updateBlockResult = (index: number, updates: any) => {
    const newBlockResults = [...results.blocks_results];
    newBlockResults[index] = { ...newBlockResults[index], ...updates };
    setResults({ ...results, blocks_results: newBlockResults });
  };

  const handleSubmit = async () => {
    await onCompleted(results);
    onClose();
  };

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl border-primary/20">
        <DialogHeader className="p-6 border-b bg-primary/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-xl">
              <Trophy className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Finalizar Sesión</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Registrar resultados para: {plan.name}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Clock className="h-3 w-3" /> Duración Real (minutos)
                </Label>
                <NumberStepper 
                  value={results.actual_duration_minutes}
                  onChange={(val) => setResults({ ...results, actual_duration_minutes: val === '' ? 0 : val })}
                  min={1}
                  max={480}
                  step={5}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                  <History className="h-3 w-3" /> Fecha de Sesión: {new Date(plan.session_date).toLocaleDateString()}
                </Label>
                <div className="h-11 flex items-center px-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-bold shadow-sm shadow-primary/5">
                  Sesión Confirmada
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-xs font-bold uppercase tracking-wider text-primary">Resultados por Ejercicio</Label>
              <div className="space-y-3">
                {plan.blocks.map((block: any, index: number) => {
                  const result = results.blocks_results[index] || {};
                  return (
                    <div key={index} className="p-4 rounded-xl border bg-muted/20 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="h-6 w-6 p-0 flex items-center justify-center rounded-full bg-background">
                            {index + 1}
                          </Badge>
                          <div>
                            <p className="font-bold text-sm tracking-tight">{block.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                              {block.type} • {block.sets ? `${block.sets} sets × ` : ''} {block.reps || block.duration_minutes + ' min'} 
                              {block.weight ? ` • ${block.weight}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 bg-background/40 px-3 py-1.5 rounded-lg border border-border/30">
                          <Label className="text-[10px] font-bold uppercase cursor-pointer" htmlFor={`complete-${index}`}>Completado</Label>
                          <Checkbox 
                            id={`complete-${index}`}
                            checked={result.completed}
                            onCheckedChange={(checked) => updateBlockResult(index, { completed: !!checked })}
                          />
                        </div>
                      </div>

                      {block.type === 'strength' && result.completed && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Reps Reales</Label>
                            <Input 
                              placeholder={block.reps}
                              value={result.actual_reps || ''}
                              onChange={(e) => updateBlockResult(index, { actual_reps: e.target.value })}
                              className="h-9 text-xs bg-background/50 border-border/40 rounded-lg focus-visible:ring-primary/20 transition-all font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Peso Real</Label>
                            <Input 
                              placeholder={block.weight}
                              value={result.actual_weight || ''}
                              onChange={(e) => updateBlockResult(index, { actual_weight: e.target.value })}
                              className="h-9 text-xs bg-background/50 border-border/40 rounded-lg focus-visible:ring-primary/20 transition-all font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider">Nota de Rendimiento / Feedback</Label>
              <Textarea 
                placeholder="¿Cómo se sintió el cliente? ¿Hubo mejoras? Ej: Logró completar todas las series con mejor técnica." 
                className="min-h-[100px] resize-none"
                value={results.performance_note}
                onChange={(e) => setResults({ ...results, performance_note: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3 w-3" /> Las estadísticas de rendimiento se generarán automáticamente al guardar.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 border-t bg-muted/20 shrink-0">
          <div className="flex justify-between w-full">
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancelar</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading}
              className="px-8 bg-green-600 hover:bg-green-700 font-bold gap-2 text-white"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Guardar Resultados
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
