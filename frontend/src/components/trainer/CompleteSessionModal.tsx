import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, Loader2, Trophy, Clock, Dumbbell, History, Flame } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBodyMetrics } from '@/hooks/useAthleteData';
import { calculateExerciseCalories } from '@/lib/trainer/calorieUtils';

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

  const { data: metrics } = useBodyMetrics(1, plan?.client_id);
  const athleteWeight = metrics?.[0]?.weight_kg || 75;
  const isEstimatedWeight = !metrics?.[0]?.weight_kg;

  useEffect(() => {
    if (plan && open) {
      setResults({
        completed: true,
        actual_duration_minutes: plan.results?.actual_duration_minutes || 60,
        performance_note: plan.results?.performance_note || '',
        blocks_results: (plan.blocks || []).map((block: any, index: number) => {
          const setsCount = parseInt(block.sets) || (block.type === 'strength' ? 3 : 1);
          const sets = Array.from({ length: setsCount }).map((_, i) => {
            const configRow = block.set_config?.[i];
            return {
              set_number:   i + 1,
              reps:         configRow?.reps    || block.reps    || '',
              weight:       configRow?.weight  || block.weight  || '',
              completed:    true,
              is_drop_set:  configRow?.is_drop_set || false,
              drops:        configRow?.drops        || [],
            };
          });

          return {
            block_index: index,
            completed: true,
            sets: sets,
            actual_reps: block.reps || '',
            actual_weight: block.weight || '',
            weight_unit: block.weight_unit || 'kg',
            calories: block.calories || calculateExerciseCalories({
              type: block.type,
              sets: setsCount,
              reps: block.reps || 0,
              duration_minutes: block.duration_minutes || 0,
              difficulty: plan.difficulty || 'intermedio',
              weight_kg: athleteWeight
            })
          };
        }),
      });
    }
  }, [plan, open, athleteWeight]);

  const totalSessionCalories = results.blocks_results.reduce((sum: number, b: any) => 
    sum + (b.completed ? (b.calories || 0) : 0), 0
  );

  const updateBlockResult = (index: number, updates: any) => {
    const newBlockResults = [...results.blocks_results];
    newBlockResults[index] = { ...newBlockResults[index], ...updates };
    setResults({ ...results, blocks_results: newBlockResults });
  };

  const updateDropResult = (blockIndex: number, setIndex: number, dropIndex: number, updates: any) => {
    const newBlockResults = [...results.blocks_results];
    const blockResult = { ...newBlockResults[blockIndex] };
    const newSets = [...(blockResult.sets || [])];
    const newDrops = [...(newSets[setIndex]?.drops || [])];
    newDrops[dropIndex] = { ...newDrops[dropIndex], ...updates };
    newSets[setIndex] = { ...newSets[setIndex], drops: newDrops };
    blockResult.sets = newSets;
    newBlockResults[blockIndex] = blockResult;
    setResults({ ...results, blocks_results: newBlockResults });
  };

  const updateSetResult = (blockIndex: number, setIndex: number, updates: any) => {
    const newBlockResults = [...results.blocks_results];
    const blockResult = { ...newBlockResults[blockIndex] };
    const newSets = [...(blockResult.sets || [])];
    newSets[setIndex] = { ...newSets[setIndex], ...updates };
    blockResult.sets = newSets;
    newBlockResults[blockIndex] = blockResult;
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
              <div className="flex items-center gap-3 mt-0.5">
                <p className="text-xs text-muted-foreground">Registro para: {plan.name}</p>
                <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 rounded-full border border-orange-500/20">
                  <Flame className="h-3 w-3 text-orange-500" />
                  <span className="text-[10px] font-black text-orange-600">{totalSessionCalories} Kcal</span>
                </div>
              </div>
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
                  <div className="h-11 flex items-center justify-between px-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-bold shadow-sm shadow-primary/5">
                    <span>Sesión Confirmada</span>
                    <Badge variant="outline" className={`text-[9px] font-black tracking-tighter ${isEstimatedWeight ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' : 'bg-green-500/10 text-green-600 border-green-500/20'}`}>
                      {isEstimatedWeight ? 'PESO ESTIMADO (75KG)' : `PESO REAL (${athleteWeight}KG)`}
                    </Badge>
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
                        <div className="space-y-3 animate-in fade-in duration-300">
                          <div className="grid grid-cols-12 gap-2 mb-1 px-1">
                            <div className="col-span-1 text-[9px] uppercase font-black text-muted-foreground">Set</div>
                            <div className="col-span-4 text-[9px] uppercase font-black text-muted-foreground">Reps Reales</div>
                            <div className="col-span-5 text-[9px] uppercase font-black text-muted-foreground">Peso Real</div>
                            <div className="col-span-2 text-[9px] uppercase font-black text-muted-foreground text-center">OK</div>
                          </div>
                                              {(result.sets || []).map((set: any, sIdx: number) => (
                            <div key={sIdx} className={`rounded-lg border border-border/20 overflow-hidden ${set.is_drop_set ? 'bg-primary/5 border-primary/20' : 'bg-background/40'}`}>
                              {/* Fila principal de la serie */}
                              <div className="grid grid-cols-12 gap-2 items-center p-1.5">
                                <div className="col-span-1 flex justify-center">
                                  <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-md bg-primary/10 text-primary border-none">
                                    {sIdx + 1}
                                  </Badge>
                                </div>
                                {set.is_drop_set ? (
                                  <div className="col-span-10 flex items-center gap-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">Drop Set</span>
                                    <span className="text-[10px] text-muted-foreground">— ver drops ↓</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="col-span-4">
                                      <Input placeholder={block.reps} value={set.reps} onChange={(e) => updateSetResult(index, sIdx, { reps: e.target.value })} className="h-8 text-xs bg-background/50 border-none focus-visible:ring-1 focus-visible:ring-primary/30 font-bold" />
                                    </div>
                                    <div className="col-span-5 flex gap-1">
                                      <Input placeholder={block.weight} value={set.weight} onChange={(e) => updateSetResult(index, sIdx, { weight: e.target.value })} className="h-8 text-xs bg-background/50 border-none focus-visible:ring-1 focus-visible:ring-primary/30 font-bold flex-1" />
                                      <Select value={set.weight_unit || result.weight_unit || 'kg'} onValueChange={(val) => updateSetResult(index, sIdx, { weight_unit: val })}>
                                        <SelectTrigger className="w-[50px] h-8 text-[9px] font-black px-1 border-none bg-background/30"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="kg" className="text-[9px]">KG</SelectItem>
                                          <SelectItem value="lb" className="text-[9px]">LB</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </>
                                )}
                                <div className="col-span-2 flex justify-center">
                                  <Checkbox checked={set.completed} onCheckedChange={(checked) => updateSetResult(index, sIdx, { completed: !!checked })} className="h-4 w-4 rounded-md border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" />
                                </div>
                              </div>

                              {/* Sub-filas de drops */}
                              {set.is_drop_set && (set.drops || []).map((drop: any, dIdx: number) => (
                                <div key={dIdx} className="grid grid-cols-12 gap-2 items-center px-1.5 pb-1">
                                  <div className="col-span-1 flex justify-center">
                                    <span className="text-[10px] text-primary/50 font-black">↳{dIdx + 1}</span>
                                  </div>
                                  <div className="col-span-4">
                                    <Input placeholder={drop.reps || block.reps} value={drop.reps || ''} onChange={(e) => updateDropResult(index, sIdx, dIdx, { reps: e.target.value })} className="h-7 text-xs bg-background/50 border-primary/20 focus-visible:ring-1 focus-visible:ring-primary/30 font-bold" />
                                  </div>
                                  <div className="col-span-5 flex gap-1">
                                    <Input type="number" placeholder={drop.weight || block.weight} value={drop.weight || ''} onChange={(e) => updateDropResult(index, sIdx, dIdx, { weight: e.target.value })} className="h-7 text-xs bg-background/50 border-primary/20 focus-visible:ring-1 focus-visible:ring-primary/30 font-bold flex-1" />
                                    <span className="text-[9px] text-muted-foreground self-center px-1">{result.weight_unit || 'kg'}</span>
                                  </div>
                                  <div className="col-span-2" />
                                </div>
                              ))}
                            </div>
                          ))}
                          
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full h-7 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary hover:bg-primary/5 border-dashed border mt-2"
                            onClick={() => {
                              const newSets = [...(result.sets || [])];
                              const lastSet = newSets[newSets.length - 1] || { reps: block.reps, weight: block.weight };
                              newSets.push({ 
                                set_number: newSets.length + 1, 
                                reps: lastSet.reps, 
                                weight: lastSet.weight, 
                                completed: true 
                              });
                              updateBlockResult(index, { sets: newSets });
                            }}
                          >
                            + Agregar Serie Extra
                          </Button>
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
