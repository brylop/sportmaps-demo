import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, ArrowUp, ArrowDown, Dumbbell, Timer, Zap, Heart, Wind, Coffee, Flame, ChevronDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { NumberStepper } from '@/components/ui/number-stepper';
import { calculateExerciseCalories } from '@/lib/trainer/calorieUtils';
import { ExerciseSearchInput, categoryToBlockType } from './ExerciseSearchInput';
import type { WgerBlockData } from '@/lib/trainer/wgerTypes';

export type BlockType = 'warmup' | 'strength' | 'cardio' | 'hiit' | 'flexibility' | 'cooldown';
export interface DropEntry {
  reps?:   string | null;
  weight?: string | null;
}

export interface SetConfig {
  reps?:         string | null;
  weight?:       string | null;
  rest_seconds?: number | null;
  is_drop_set?:  boolean;
  drops?:        DropEntry[];
}

export interface ExerciseBlock {
  type:             BlockType;
  name:             string;
  sets?:            number | null;
  reps?:            string | null;
  weight?:          string | null;
  weight_unit?:     'kg' | 'lb' | null;
  calories?:        number | null;
  rest_seconds?:    number | null;
  duration_minutes?: number | null;
  notes?:           string | null;
  // ── Series avanzadas ──────────────────────────────────
  set_config?:      SetConfig[] | null;      // null = flat values (retrocompat)
  // ── wger — opcionales, no rompen rutinas existentes ──
  wger_id?:          number | null;
  wger_name_es?:     string | null;
  wger_name_en?:     string | null;
  wger_description?: string | null;
  wger_images?:      string[];
  muscle_ids?:       number[];
  muscle_names?:     string[];
  equipment_id?:     number | null;
  equipment_name?:   string | null;
  is_compound?:      boolean;
}

interface BlockBuilderProps {
  blocks: ExerciseBlock[];
  onChange: (blocks: ExerciseBlock[]) => void;
  difficulty?: string;
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

/** Genera set_config inicial a partir de los valores planos del bloque */
function buildInitialSetConfig(block: ExerciseBlock, count: number): SetConfig[] {
  return Array.from({ length: count }, () => ({
    reps:         block.reps         ?? null,
    weight:       block.weight       ?? null,
    rest_seconds: block.rest_seconds ?? null,
  }));
}

/** Redimensiona set_config al nuevo número de series */
function resizeSetConfig(current: SetConfig[], newCount: number): SetConfig[] {
  if (newCount <= current.length) return current.slice(0, newCount);
  const last = current[current.length - 1] ?? {};
  return [
    ...current,
    ...Array.from({ length: newCount - current.length }, () => ({ ...last })),
  ];
}

export function BlockBuilder({ blocks, onChange, difficulty }: BlockBuilderProps) {
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
    onChange(blocks.filter((_, i) => i !== index));
  };

  const updateBlock = (index: number, updates: Partial<ExerciseBlock>) => {
    const newBlocks    = [...blocks];
    const updatedBlock   = { ...newBlocks[index], ...updates };

    // ── Activar/desactivar set_config ──────────────────────────────────────
    // Se activa externamente pasando set_config: [] o null

    // ── Cambio de número de series → redimensionar set_config ───────────────
    if (updates.sets !== undefined && updatedBlock.set_config?.length) {
      updatedBlock.set_config = resizeSetConfig(
        updatedBlock.set_config,
        updates.sets ?? 1
      );
    }

    // ── Recalcular calorías ──────────────────────────────────────────────────
    const needsRecalc =
      updates.type              !== undefined ||
      updates.sets              !== undefined ||
      updates.reps              !== undefined ||
      updates.duration_minutes  !== undefined ||
      updates.calories          === 0         ||
      updates.muscle_ids        !== undefined ||
      updates.equipment_id      !== undefined;

    if (needsRecalc) {
      updatedBlock.calories = calculateExerciseCalories({
        type:             updatedBlock.type,
        sets:             updatedBlock.sets             || 0,
        reps:             updatedBlock.reps             || 0,
        duration_minutes: updatedBlock.duration_minutes || 0,
        difficulty:       difficulty                    || 'Intermedio',
        muscle_count:     updatedBlock.muscle_ids?.length ?? 1,
        is_compound:      updatedBlock.is_compound      ?? false,
        equipment_id:     updatedBlock.equipment_id     ?? undefined,
      });
    }

    newBlocks[index] = updatedBlock;
    onChange(newBlocks);
  };

  /** Activa o desactiva el modo de configuración por serie */
  const toggleSetConfig = (blockIndex: number, enable: boolean) => {
    const block = blocks[blockIndex];
    if (enable) {
      updateBlock(blockIndex, {
        set_config: buildInitialSetConfig(block, block.sets ?? 3),
      });
    } else {
      // Recuperar valores del primer set como global
      const first = block.set_config?.[0];
      updateBlock(blockIndex, {
        set_config: null,
        ...(first?.reps   ? { reps: first.reps }           : {}),
        ...(first?.weight ? { weight: first.weight }       : {}),
        ...(first?.rest_seconds ? { rest_seconds: first.rest_seconds } : {}),
      });
    }
  };

  /** Actualiza un campo de una fila específica del set_config */
  const updateSetConfig = (
    blockIndex: number,
    setIndex:   number,
    field:      keyof SetConfig,
    value:      string | number | boolean | null
  ) => {
    const newBlocks = [...blocks];
    const block     = { ...newBlocks[blockIndex] };
    const config    = [...(block.set_config ?? [])];
    config[setIndex] = { ...config[setIndex], [field]: value };
    block.set_config = config;
    newBlocks[blockIndex] = block;
    onChange(newBlocks);
  };

  /** Agrega un drop a una serie que es drop set */
  const addDrop = (blockIndex: number, setIndex: number) => {
    const newBlocks = [...blocks];
    const block     = { ...newBlocks[blockIndex] };
    const config    = [...(block.set_config ?? [])];
    const row       = { ...config[setIndex] };
    const lastDrop  = row.drops?.[row.drops.length - 1] ?? {};
    row.drops       = [...(row.drops ?? []), { reps: lastDrop.reps ?? '', weight: lastDrop.weight ?? '' }];
    config[setIndex] = row;
    block.set_config = config;
    newBlocks[blockIndex] = block;
    onChange(newBlocks);
  };

  /** Elimina un drop de una serie */
  const removeDrop = (blockIndex: number, setIndex: number, dropIndex: number) => {
    const newBlocks = [...blocks];
    const block     = { ...newBlocks[blockIndex] };
    const config    = [...(block.set_config ?? [])];
    const row       = { ...config[setIndex] };
    row.drops       = (row.drops ?? []).filter((_, i) => i !== dropIndex);
    config[setIndex] = row;
    block.set_config = config;
    newBlocks[blockIndex] = block;
    onChange(newBlocks);
  };

  /** Actualiza un campo de un drop específico */
  const updateDrop = (
    blockIndex: number,
    setIndex:   number,
    dropIndex:  number,
    field:      keyof DropEntry,
    value:      string | null
  ) => {
    const newBlocks = [...blocks];
    const block     = { ...newBlocks[blockIndex] };
    const config    = [...(block.set_config ?? [])];
    const row       = { ...config[setIndex] };
    const drops     = [...(row.drops ?? [])];
    drops[dropIndex] = { ...drops[dropIndex], [field]: value };
    row.drops        = drops;
    config[setIndex] = row;
    block.set_config = config;
    newBlocks[blockIndex] = block;
    onChange(newBlocks);
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === blocks.length - 1) return;
    const newBlocks = [...blocks];
    const target = direction === 'up' ? index - 1 : index + 1;
    [newBlocks[index], newBlocks[target]] = [newBlocks[target], newBlocks[index]];
    onChange(newBlocks);
  };

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const Config      = BLOCK_TYPES[block.type];
        const Icon        = Config.icon;
        const isAdvanced  = !!(block.set_config && block.set_config.length > 0);
        // Solo strength tiene set_type avanzado (tiene reps + weight)
        const supportsAdvancedSets = Config.fields.includes('reps') && Config.fields.includes('weight');

        return (
          <Card key={index} className="border-border/50 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className={`h-1.5 ${Config.color.split(' ')[0]}`} />
            <CardContent className="p-4 space-y-4">

              {/* ── Fila superior: tipo de bloque + acciones ── */}
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
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveBlock(index, 'up')}  disabled={index === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveBlock(index, 'down')} disabled={index === blocks.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeBlock(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* ── Grid de campos ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* Nombre / búsqueda */}
                <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Nombre del ejercicio
                  </Label>
                  <ExerciseSearchInput
                    value={block.name}
                    wgerData={block.wger_id ? {
                      wger_id:          block.wger_id,
                      wger_name_es:     block.wger_name_es ?? null,
                      wger_name_en:     block.wger_name_en ?? '',
                      wger_description: block.wger_description ?? null,
                      wger_images:      block.wger_images ?? [],
                      muscle_ids:       block.muscle_ids ?? [],
                      muscle_names:     block.muscle_names ?? [],
                      equipment_id:     block.equipment_id ?? null,
                      equipment_name:   block.equipment_name ?? null,
                      is_compound:      block.is_compound ?? false,
                    } : null}
                    onChange={(name, wgerData?: WgerBlockData | null) => {
                      const wgerFields: Partial<ExerciseBlock> = wgerData ? {
                        wger_id:          wgerData.wger_id,
                        wger_name_es:     wgerData.wger_name_es,
                        wger_name_en:     wgerData.wger_name_en,
                        wger_description: wgerData.wger_description,
                        wger_images:      wgerData.wger_images,
                        muscle_ids:       wgerData.muscle_ids,
                        muscle_names:     wgerData.muscle_names,
                        equipment_id:     wgerData.equipment_id,
                        equipment_name:   wgerData.equipment_name,
                        is_compound:      wgerData.is_compound,
                        type: categoryToBlockType(
                          blocks[index].type === 'strength' || !blocks[index].wger_id
                            ? (wgerData.muscle_ids.length > 0 ? 'strength' : blocks[index].type)
                            : blocks[index].type
                        ) as BlockType,
                      } : {
                        wger_id:          null,
                        wger_name_es:     null,
                        wger_name_en:     null,
                        wger_description: null,
                        wger_images:      [],
                        muscle_ids:       [],
                        muscle_names:     [],
                        equipment_id:     null,
                        equipment_name:   null,
                        is_compound:      false,
                      };
                      updateBlock(index, { name, ...wgerFields });
                    }}
                  />
                </div>

                {/* Series */}
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

                {/* Reps — solo modo plano */}
                {Config.fields.includes('reps') && !isAdvanced && (
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

                {/* Peso — solo modo plano */}
                {Config.fields.includes('weight') && !isAdvanced && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Peso / Carga</Label>
                    <div className="flex gap-1">
                      <NumberStepper 
                        value={parseFloat(block.weight || '0')}
                        onChange={(val) => updateBlock(index, { weight: val.toString() })}
                        min={0}
                        max={1000}
                        step={1}
                        className="h-9 flex-1"
                      />
                      <Select 
                        value={block.weight_unit || 'kg'} 
                        onValueChange={(val: 'kg' | 'lb') => updateBlock(index, { weight_unit: val })}
                      >
                        <SelectTrigger className="w-[65px] h-9 text-[10px] font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg" className="text-[10px]">KG</SelectItem>
                          <SelectItem value="lb" className="text-[10px]">LB</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Calorías */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <Flame className="h-3 w-3 text-orange-500" /> Calorías Est.
                    </div>
                    <span className="text-[8px] font-bold text-orange-500/60">(0 = Auto)</span>
                  </Label>
                  <NumberStepper 
                    value={block.calories || 0}
                    onChange={(val) => updateBlock(index, { calories: val === '' ? 0 : val })}
                    min={0}
                    max={1000}
                    step={1}
                    className="h-9 font-bold text-orange-600 bg-orange-500/5 border-orange-500/20"
                    unit="kcal"
                  />
                </div>

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

                {/* Descanso global — solo modo plano */}
                {Config.fields.includes('rest_seconds') && !isAdvanced && (
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

              {/* ── Toggle "Personalizar por serie" — solo para bloques con reps+peso ── */}
              {supportsAdvancedSets && (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20 border border-border/30">
                  <div>
                    <p className="text-xs font-bold">Personalizar por serie</p>
                    <p className="text-[10px] text-muted-foreground">Permite configurar reps, peso y drop sets individualmente</p>
                  </div>
                  <Switch
                    checked={isAdvanced}
                    onCheckedChange={(val) => toggleSetConfig(index, val)}
                  />
                </div>
              )}

              {/* ── Tabla por serie — modo avanzado ─────────────────────────── */}
              {isAdvanced && block.set_config && (
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Configuración por serie
                  </Label>

                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-[2rem_1fr_1fr_1fr_auto] gap-2 px-3 py-2 bg-muted/30 border-b border-border/30">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">#</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Reps</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Peso ({block.weight_unit ?? 'kg'})</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Desc. (s)</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Drop</span>
                    </div>

                    {/* Filas */}
                    {block.set_config.map((setRow, setIdx) => (
                      <div key={setIdx} className="border-b last:border-b-0 border-border/20">

                        {/* Fila principal de la serie */}
                        <div className="grid grid-cols-[2rem_1fr_1fr_1fr_auto] gap-2 px-3 py-2 items-center hover:bg-accent/20 transition-colors">
                          <span className="text-sm font-black text-primary">{setIdx + 1}</span>

                          {/* Reps — solo si NO es drop set */}
                          {!setRow.is_drop_set ? (
                            <Input
                              placeholder="12"
                              value={setRow.reps ?? ''}
                              onChange={(e) => updateSetConfig(index, setIdx, 'reps', e.target.value || null)}
                              className="h-8 text-xs px-2"
                            />
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic px-1">ver drops ↓</span>
                          )}

                          {/* Peso — solo si NO es drop set */}
                          {!setRow.is_drop_set ? (
                            <Input
                              type="number"
                              placeholder="0"
                              min={0}
                              value={setRow.weight ?? ''}
                              onChange={(e) => updateSetConfig(index, setIdx, 'weight', e.target.value || null)}
                              className="h-8 text-xs px-2"
                            />
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic px-1">ver drops ↓</span>
                          )}

                          {/* Descanso */}
                          <Input
                            type="number"
                            placeholder="60"
                            min={0}
                            value={setRow.rest_seconds ?? ''}
                            onChange={(e) =>
                              updateSetConfig(index, setIdx, 'rest_seconds',
                                e.target.value ? parseInt(e.target.value, 10) : null
                              )
                            }
                            className="h-8 text-xs px-2"
                          />

                          {/* Toggle Drop Set */}
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={!!setRow.is_drop_set}
                              onCheckedChange={(checked) => {
                                updateSetConfig(index, setIdx, 'is_drop_set', !!checked);
                                if (checked && !setRow.drops?.length) {
                                  // Auto-agregar 2 drops iniciales
                                  const newBlocks = [...blocks];
                                  const block     = { ...newBlocks[index] };
                                  const config    = [...(block.set_config ?? [])];
                                  config[setIdx]  = {
                                    ...config[setIdx],
                                    is_drop_set: true,
                                    drops: [
                                      { reps: setRow.reps ?? '', weight: '' },
                                      { reps: '',               weight: '' },
                                    ],
                                  };
                                  block.set_config = config;
                                  newBlocks[index] = block;
                                  onChange(newBlocks);
                                }
                              }}
                              className="h-4 w-4 rounded border-primary/30 data-[state=checked]:bg-primary"
                            />
                          </div>
                        </div>

                        {/* Sub-filas de drops — solo cuando is_drop_set */}
                        {setRow.is_drop_set && (
                          <div className="px-3 pb-2 space-y-1 bg-primary/3">
                            {/* Header drops */}
                            <div className="grid grid-cols-[1.5rem_1fr_1fr_auto] gap-2 px-1 pt-1">
                              <span />
                              <span className="text-[8px] font-black uppercase tracking-widest text-primary/60">Reps</span>
                              <span className="text-[8px] font-black uppercase tracking-widest text-primary/60">Peso</span>
                              <span />
                            </div>

                            {(setRow.drops ?? []).map((drop, dropIdx) => (
                              <div key={dropIdx} className="grid grid-cols-[1.5rem_1fr_1fr_auto] gap-2 items-center">
                                <span className="text-[9px] text-primary/50 font-black text-center">↳</span>
                                <Input
                                  placeholder="10"
                                  value={drop.reps ?? ''}
                                  onChange={(e) => updateDrop(index, setIdx, dropIdx, 'reps', e.target.value || null)}
                                  className="h-7 text-xs px-2 bg-primary/5 border-primary/20"
                                />
                                <Input
                                  type="number"
                                  placeholder="0"
                                  min={0}
                                  value={drop.weight ?? ''}
                                  onChange={(e) => updateDrop(index, setIdx, dropIdx, 'weight', e.target.value || null)}
                                  className="h-7 text-xs px-2 bg-primary/5 border-primary/20"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeDrop(index, setIdx, dropIdx)}
                                >
                                  ×
                                </Button>
                              </div>
                            ))}

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] font-bold text-primary/60 hover:text-primary px-1"
                              onClick={() => addDrop(index, setIdx)}
                            >
                              + drop
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Notas ── */}
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
