import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, ArrowUp, ArrowDown, Dumbbell, Timer, Zap, Heart, Wind, Coffee } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { NumberStepper } from '@/components/ui/number-stepper';

export type BlockType = 'warmup' | 'strength' | 'cardio' | 'hiit' | 'flexibility' | 'cooldown';

export interface ExerciseBlock {
  type: BlockType;
  name: string;
  sets?: number | null;
  reps?: string | null;
  weight?: string | null;
  rest_seconds?: number | null;
  duration_minutes?: number | null;
  notes?: string | null;
}

interface BlockBuilderProps {
  blocks: ExerciseBlock[];
  onChange: (blocks: ExerciseBlock[]) => void;
}

const BLOCK_TYPES: Record<BlockType, { label: string; icon: any; color: string; fields: string[] }> = {
  warmup: { 
    label: 'Calentamiento', 
    icon: Wind, 
    color: 'bg-orange-500/10 text-orange-500',
    fields: ['name', 'duration_minutes', 'notes'] 
  },
  strength: { 
    label: 'Fuerza', 
    icon: Dumbbell, 
    color: 'bg-red-500/10 text-red-500',
    fields: ['name', 'sets', 'reps', 'weight', 'rest_seconds', 'notes'] 
  },
  cardio: { 
    label: 'Cardio', 
    icon: Heart, 
    color: 'bg-blue-500/10 text-blue-500',
    fields: ['name', 'duration_minutes', 'notes'] 
  },
  hiit: { 
    label: 'HIIT', 
    icon: Zap, 
    color: 'bg-purple-500/10 text-purple-500',
    fields: ['name', 'sets', 'duration_minutes', 'rest_seconds', 'notes'] 
  },
  flexibility: { 
    label: 'Flexibilidad', 
    icon: Timer, 
    color: 'bg-green-500/10 text-green-500',
    fields: ['name', 'duration_minutes', 'notes'] 
  },
  cooldown: { 
    label: 'Vuelta calma', 
    icon: Coffee, 
    color: 'bg-indigo-500/10 text-indigo-500',
    fields: ['name', 'duration_minutes', 'notes'] 
  },
};

export function BlockBuilder({ blocks, onChange }: BlockBuilderProps) {
  const addBlock = () => {
    const newBlock: ExerciseBlock = {
      type: 'strength',
      name: '',
      sets: 3,
      reps: '12',
      rest_seconds: 60,
    };
    onChange([...blocks, newBlock]);
  };

  const removeBlock = (index: number) => {
    const newBlocks = blocks.filter((_, i) => i !== index);
    onChange(newBlocks);
  };

  const updateBlock = (index: number, updates: Partial<ExerciseBlock>) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], ...updates };
    onChange(newBlocks);
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === blocks.length - 1) return;

    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    onChange(newBlocks);
  };

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const Config = BLOCK_TYPES[block.type];
        const Icon = Config.icon;

        return (
          <Card key={index} className="border-border/50 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className={`h-1.5 ${Config.color.split(' ')[0]}`} />
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${Config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <Select 
                    value={block.type} 
                    onValueChange={(val: BlockType) => updateBlock(index, { type: val })}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs font-semibold bg-transparent border-none focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(BLOCK_TYPES).map(([key, value]) => (
                        <SelectItem key={key} value={key} className="text-xs">
                          {value.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8" 
                    onClick={() => moveBlock(index, 'up')}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8" 
                    onClick={() => moveBlock(index, 'down')}
                    disabled={index === blocks.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" 
                    onClick={() => removeBlock(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Nombre del ejercicio</Label>
                  <Input 
                    placeholder="Ej: Sentadillas con barra" 
                    value={block.name}
                    onChange={(e) => updateBlock(index, { name: e.target.value })}
                    className="h-9"
                  />
                </div>

                {Config.fields.includes('sets') && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Series</Label>
                    <NumberStepper 
                      value={block.sets || 0}
                      onChange={(val) => updateBlock(index, { sets: val === '' ? 0 : val })}
                      min={1}
                      max={20}
                    />
                  </div>
                )}

                {Config.fields.includes('reps') && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Repeticiones</Label>
                    <Input 
                      placeholder="12 o Al fallo" 
                      value={block.reps || ''}
                      onChange={(e) => updateBlock(index, { reps: e.target.value })}
                      className="h-9"
                    />
                  </div>
                )}

                {Config.fields.includes('weight') && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Peso / Carga</Label>
                    <Input 
                      placeholder="60kg o Banda roja" 
                      value={block.weight || ''}
                      onChange={(e) => updateBlock(index, { weight: e.target.value })}
                      className="h-9"
                    />
                  </div>
                )}

                {Config.fields.includes('duration_minutes') && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Duración (min)</Label>
                    <NumberStepper 
                      value={block.duration_minutes || 0}
                      onChange={(val) => updateBlock(index, { duration_minutes: val === '' ? 0 : val })}
                      min={1}
                      max={120}
                    />
                  </div>
                )}

                {Config.fields.includes('rest_seconds') && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Descanso (seg)</Label>
                    <NumberStepper 
                      value={block.rest_seconds || 0}
                      onChange={(val) => updateBlock(index, { rest_seconds: val === '' ? 0 : val })}
                      min={0}
                      max={600}
                      step={15}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Notas / Instrucciones</Label>
                <Textarea 
                  placeholder="Mantener la espalda recta..." 
                  value={block.notes || ''}
                  onChange={(e) => updateBlock(index, { notes: e.target.value })}
                  className="min-h-[60px] text-xs resize-none"
                />
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Button 
        type="button" 
        variant="outline" 
        className="w-full border-dashed border-2 py-8 hover:bg-accent/50 group transition-all"
        onClick={addBlock}
      >
        <Plus className="h-5 w-5 mr-2 text-muted-foreground group-hover:text-primary" />
        <span className="text-muted-foreground group-hover:text-primary font-semibold">Agregar Ejercicio</span>
      </Button>
    </div>
  );
}
