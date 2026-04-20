import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, X, Plus, Trash2, Users, User, Check, Loader2, Info } from 'lucide-react';
import { useCoachAvailability, CoachAvailability, CoachAvailabilityInput } from '@/hooks/useCoachAvailability';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generateTimeOptions, DURATION_OPTIONS, generateSlots, type DurationMinutes } from '@/lib/utils/timeOptions';
import { useToast } from '@/hooks/use-toast';

interface AvailabilityManagerProps {
  coachId: string;
  schoolId: string;
}

const DAYS_OF_WEEK = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAYS_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const TIME_OPTIONS = generateTimeOptions(30);

/** Formats a HH:MM string to 12h AM/PM label */
function formatTime(time: string): string {
  return TIME_OPTIONS.find(o => o.value === time)?.label ?? time;
}

export function AvailabilityManager({
  coachId,
  schoolId,
}: AvailabilityManagerProps) {
  const { availability, isLoading, createAvailability, deleteAvailability, isCreating, isDeleting } =
    useCoachAvailability(coachId, schoolId);
  const { toast } = useToast();

  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // Each pending window: a start, end, and class block duration
  const [pendingWindows, setPendingWindows] = useState<{
    start: string;
    end: string;
    duration: number;
  }[]>([]);

  const [currentWindow, setCurrentWindow] = useState({
    start: '',
    end: '',
    duration: 60 as DurationMinutes,
  });

  const [config, setConfig] = useState({
    group_classes: false,
    personal_classes: false,
  });

  const [groupClassSize, setGroupClassSize] = useState<number>(5);

  const handleDayToggle = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter(d => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex].sort());
    }
  };

  // Preview of how many slots the current window & duration generates
  const previewSlots = generateSlots(currentWindow.start, currentWindow.end, currentWindow.duration);

  const handleAddWindow = () => {
    if (!currentWindow.start || !currentWindow.end || currentWindow.start >= currentWindow.end) {
      toast({ title: 'Selecciona un rango válido (inicio < fin)', variant: 'destructive' });
      return;
    }
    if (previewSlots.length === 0) {
      toast({ title: 'La duración no cabe en el rango seleccionado', variant: 'destructive' });
      return;
    }
    setPendingWindows(prev => [...prev, currentWindow].sort((a, b) => a.start.localeCompare(b.start)));
    setCurrentWindow({ start: '', end: '', duration: 60 as DurationMinutes });
  };

  const handleRemovePendingWindow = (index: number) => {
    setPendingWindows(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddAvailability = () => {
    if (selectedDays.length === 0 || pendingWindows.length === 0) {
      toast({ title: 'Selecciona días y añade al menos un rango horario', variant: 'destructive' });
      return;
    }
    if (!config.group_classes && !config.personal_classes) {
      toast({ title: 'Selecciona al menos un tipo de clase', variant: 'destructive' });
      return;
    }

    selectedDays.forEach((day) => {
      pendingWindows.forEach((window) => {
        const slots = generateSlots(window.start, window.end, window.duration);
        slots.forEach((slot) => {
          const input: CoachAvailabilityInput = {
            day_of_week: day,
            start_time: slot.start_time,
            end_time: slot.end_time,
            available_for_group_classes: config.group_classes,
            available_for_personal_classes: config.personal_classes,
            max_group_capacity: config.group_classes ? groupClassSize : null,
          };
          createAvailability(input);
        });
      });
    });

    setSelectedDays([]);
    setPendingWindows([]);
    setCurrentWindow({ start: '', end: '', duration: 60 as DurationMinutes });
    setConfig({ group_classes: false, personal_classes: false });
    setGroupClassSize(5);
  };

  const handleDeleteDay = (dayIndex: number) => {
    const daySchedules = availability.filter((a: CoachAvailability) => a.day_of_week === dayIndex);
    daySchedules.forEach((slot: CoachAvailability) => deleteAvailability(slot.id));
  };

  const canSave = selectedDays.length > 0 && pendingWindows.length > 0 && (config.group_classes || config.personal_classes);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span>Cargando disponibilidad...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="config" className="w-full flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mb-3 h-9 shrink-0">
          <TabsTrigger value="config" className="text-xs">Configurar</TabsTrigger>
          <TabsTrigger value="scheduled" className="text-xs">Registrados ({availability.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4 mt-4 flex-1">
          {/* Step 1: Days */}
          <Card className="p-3 bg-primary/5 dark:bg-primary/10 border-primary/20">
            <Label className="text-sm font-semibold mb-2 block">1. Selecciona los días</Label>
            <div className="grid grid-cols-7 gap-2">
              {DAYS_OF_WEEK.map((day, index) => (
                <Button
                  key={index}
                  variant={selectedDays.includes(index) ? 'default' : 'outline'}
                  className={`h-11 font-semibold text-xs transition-all ${selectedDays.includes(index)
                    ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20'
                    : 'bg-background hover:border-primary hover:bg-primary/5'
                    }`}
                  onClick={() => handleDayToggle(index)}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] opacity-70 mb-0.5">{DAYS_SHORT[index]}</span>
                    <span className="leading-none">{day.substring(0, 3)}</span>
                  </div>
                </Button>
              ))}
            </div>
            {selectedDays.length > 0 && (
              <div className="mt-2 pt-2 border-t flex flex-wrap gap-1">
                {selectedDays.map((d) => (
                  <Badge key={d} variant="secondary" className="gap-1 text-xs">
                    {DAYS_OF_WEEK[d]}
                    <button onClick={() => handleDayToggle(d)} className="hover:opacity-70">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          {/* Step 2: Configure time window + class duration */}
          {selectedDays.length > 0 && (
            <Card className="p-4 border-none bg-card/60 backdrop-blur-md shadow-xl ring-1 ring-black/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary via-primary/50 to-primary/20" />

              <div className="mb-4">
                <Label className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  2. Rango de disponibilidad
                </Label>
                <p className="text-[10px] text-muted-foreground mt-1 ml-6">Define el horario en el que el coach puede dar clases.</p>
              </div>

              {/* Start / End time row */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Hora Inicio</Label>
                  <Select
                    value={currentWindow.start}
                    onValueChange={(val) => setCurrentWindow(prev => ({
                      ...prev,
                      start: val,
                      end: (prev.end && prev.end <= val) ? '' : prev.end,
                    }))}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-background/50 border-border/40">
                      <SelectValue placeholder="Inicio" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <ScrollArea className="h-64">
                        {TIME_OPTIONS.slice(0, -1).map(opt => (
                          <SelectItem key={`ws-${opt.value}`} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Hora Fin</Label>
                  <Select
                    value={currentWindow.end}
                    onValueChange={(val) => setCurrentWindow(prev => ({ ...prev, end: val }))}
                    disabled={!currentWindow.start}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-background/50 border-border/40 disabled:opacity-40">
                      <SelectValue placeholder="Fin" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <ScrollArea className="h-64">
                        {TIME_OPTIONS
                          .filter(opt => !currentWindow.start || opt.value > currentWindow.start)
                          .map(opt => (
                            <SelectItem key={`we-${opt.value}`} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                          ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Duration selection */}
              <div className="space-y-2 mb-4">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                  Duración de cada clase
                </Label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCurrentWindow(prev => ({ ...prev, duration: opt.value }))}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
                        currentWindow.duration === opt.value
                          ? 'bg-primary border-primary text-primary-foreground shadow-md scale-105'
                          : 'bg-background/50 border-border/40 text-muted-foreground hover:border-primary/50 hover:text-primary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview of generated slots */}
              {currentWindow.start && currentWindow.end && currentWindow.start < currentWindow.end && (
                <div className={`p-3 rounded-xl border text-xs ${
                  previewSlots.length > 0
                    ? 'bg-primary/5 border-primary/20 text-primary'
                    : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400'
                }`}>
                  <div className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    {previewSlots.length > 0
                      ? <span><strong>{previewSlots.length} bloque{previewSlots.length !== 1 ? 's' : ''}</strong> de {DURATION_OPTIONS.find(d => d.value === currentWindow.duration)?.label} disponibles entre {formatTime(currentWindow.start)} y {formatTime(currentWindow.end)}</span>
                      : <span>La duración seleccionada no cabe en el rango. Prueba un rango más amplio o una clase más corta.</span>
                    }
                  </div>
                </div>
              )}

              <Button
                onClick={handleAddWindow}
                disabled={!currentWindow.start || !currentWindow.end || currentWindow.start >= currentWindow.end || previewSlots.length === 0}
                className="w-full mt-4 h-9 rounded-xl gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all border-dashed border-2 border-primary/30"
                variant="outline"
              >
                <Plus className="h-4 w-4" />
                Añadir a la Lista
              </Button>

              {/* Pending windows list */}
              {pendingWindows.length > 0 && (
                <div className="mt-5 space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Rangos por guardar:</Label>
                  <div className="space-y-2">
                    {pendingWindows.map((w, idx) => {
                      const slots = generateSlots(w.start, w.end, w.duration);
                      const durationLabel = DURATION_OPTIONS.find(d => d.value === w.duration)?.label ?? `${w.duration}m`;
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/15 rounded-xl animate-in zoom-in-95 duration-200"
                        >
                          <div>
                            <span className="text-xs font-bold text-foreground">
                              {formatTime(w.start)} — {formatTime(w.end)}
                            </span>
                            <span className="ml-2 text-[10px] text-muted-foreground">
                              {slots.length} bloque{slots.length !== 1 ? 's' : ''} × {durationLabel}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemovePendingWindow(idx)}
                            className="h-6 w-6 flex items-center justify-center rounded-full bg-muted hover:bg-destructive hover:text-white text-muted-foreground transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Step 3: Class types */}
          {selectedDays.length > 0 && pendingWindows.length > 0 && (
            <Card className="p-4 border-l-4 border-l-accent bg-accent/5 dark:bg-accent/10 border-primary/10 shadow-sm">
              <Label className="text-sm font-bold mb-4 block text-accent flex items-center gap-2">
                <Check className="h-4 w-4" />
                3. Tipos de clase disponibles
              </Label>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-card/50 transition-colors border border-transparent hover:border-primary/20">
                  <Checkbox
                    id="group-classes"
                    checked={config.group_classes}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, group_classes: checked as boolean }))}
                    className="h-4 w-4 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-primary/10 rounded">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <Label htmlFor="group-classes" className="cursor-pointer font-medium text-sm mb-0">
                        Clases Grupales
                      </Label>
                    </div>
                    {config.group_classes && (
                      <div className="ml-6 mt-3 flex items-center gap-4">
                        <Label htmlFor="group-size" className="text-xs text-muted-foreground font-medium">
                          Máximo de personas:
                        </Label>
                        <NumberStepper
                          value={groupClassSize}
                          onChange={(val) => setGroupClassSize(val === "" ? 1 : val)}
                          min={1}
                          max={99}
                          className="h-9 w-28"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-card/50 transition-colors border border-transparent hover:border-primary/20">
                  <Checkbox
                    id="personal-classes"
                    checked={config.personal_classes}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, personal_classes: checked as boolean }))}
                    className="h-4 w-4 mt-0.5"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="p-1 bg-accent/10 rounded">
                      <User className="h-4 w-4 text-accent" />
                    </div>
                    <Label htmlFor="personal-classes" className="cursor-pointer font-medium text-sm mb-0">
                      Clases Personalizadas
                    </Label>
                  </div>
                </div>
              </div>

              {!config.group_classes && !config.personal_classes && (
                <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-600 dark:text-yellow-400">
                  ⚠️ Selecciona al menos un tipo de clase
                </div>
              )}
            </Card>
          )}

          <div className="pt-3 border-t mt-4 flex justify-end gap-2">
            <Button
              onClick={handleAddAvailability}
              disabled={!canSave || isCreating}
              className="gap-2 bg-primary hover:bg-primary-dark text-xs h-9 w-full sm:w-auto"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Agregar Horarios
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4 mt-6 flex-1">
          {availability.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-border/40 rounded-3xl bg-muted/5">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Sin horarios configurados</h3>
              <p className="text-sm text-muted-foreground max-w-[240px] text-center mt-1">
                Comienza agregando disponibilidad en la pestaña de configuración.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {DAYS_OF_WEEK.map((day, dayIndex) => {
                const daySchedules = availability.filter(
                  (a: CoachAvailability) => a.day_of_week === dayIndex
                );

                if (daySchedules.length === 0) return null;

                const sortedSchedules = [...daySchedules].sort((a, b) => a.start_time.localeCompare(b.start_time));

                return (
                  <div key={dayIndex} className="relative pl-6 border-l-2 border-primary/20 space-y-3 pb-2 last:pb-0">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-background shadow-sm" />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="font-black text-sm uppercase tracking-widest text-foreground">{day}</h3>
                        <div className="h-5 px-2 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center">
                          {daySchedules.length} bloque{daySchedules.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDay(dayIndex)}
                        disabled={isDeleting}
                        className="h-8 w-8 p-0 text-destructive/40 hover:text-destructive hover:bg-destructive/10 rounded-xl"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {sortedSchedules.map((slot) => (
                        <div
                          key={slot.id}
                          className="group relative flex items-center gap-2 px-3 py-1.5 bg-background border border-border/50 rounded-2xl hover:border-primary/40 hover:shadow-md transition-all duration-300"
                        >
                          <div className="flex flex-col">
                            <span className="font-black text-[11px] leading-tight text-foreground">
                              {formatTime(slot.start_time)} — {formatTime(slot.end_time)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded-xl">
                            {slot.available_for_group_classes && (
                              <Users className="h-3 w-3 text-primary" />
                            )}
                            {slot.available_for_personal_classes && (
                              <User className="h-3 w-3 text-accent" />
                            )}
                          </div>

                          <button
                            onClick={() => deleteAvailability(slot.id)}
                            disabled={isDeleting}
                            className="h-5 w-5 flex items-center justify-center bg-destructive/10 text-destructive rounded-full opacity-0 lg:group-hover:opacity-100 transition-all hover:bg-destructive hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
