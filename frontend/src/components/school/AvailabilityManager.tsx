import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, X, Plus, Trash2, Users, User, Check, Loader2 } from 'lucide-react';
import { useCoachAvailability, CoachAvailability, CoachAvailabilityInput } from '@/hooks/useCoachAvailability';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NumberStepper } from '@/components/ui/number-stepper';

interface AvailabilityManagerProps {
  coachId: string;
  schoolId: string;
}

const DAYS_OF_WEEK = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAYS_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const start = String(i).padStart(2, '0');
  const hour24 = i;
  const period = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;

  return {
    value: `${start}:00`,
    label: `${String(hour12).padStart(2, '0')}:00 - ${String((hour12 % 12) + 1).padStart(2, '0')}:00`,
    period: period,
    display: `${String(hour12).padStart(2, '0')}:00 ${period}`,
  };
});

export function AvailabilityManager({
  coachId,
  schoolId,
}: AvailabilityManagerProps) {
  const { availability, isLoading, createAvailability, deleteAvailability, isCreating, isDeleting } =
    useCoachAvailability(coachId, schoolId);

  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedHours, setSelectedHours] = useState<string[]>([]);
  const [groupClasses, setGroupClasses] = useState(false);
  const [groupClassSize, setGroupClassSize] = useState<number>(5);
  const [personalClasses, setPersonalClasses] = useState(false);

  const handleDayToggle = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter(d => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex].sort());
    }
  };

  const handleHourToggle = (hour: string) => {
    setSelectedHours((prev) =>
      prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour].sort()
    );
  };

  const handleAddAvailability = () => {
    if (selectedDays.length === 0 || selectedHours.length === 0) return;
    if (!groupClasses && !personalClasses) return;

    selectedDays.forEach((day) => {
      selectedHours.forEach((hour) => {
        const endHour = String(parseInt(hour.split(':')[0]) + 1).padStart(2, '0');
        const endTime = `${endHour}:00`;

        const input: CoachAvailabilityInput = {
          day_of_week: day,
          start_time: hour,
          end_time: endTime,
          available_for_group_classes: groupClasses,
          available_for_personal_classes: personalClasses,
        };

        createAvailability(input);
      });
    });

    setSelectedDays([]);
    setSelectedHours([]);
    setGroupClasses(false);
    setGroupClassSize(5);
    setPersonalClasses(false);
  };

  const handleDeleteDay = (dayIndex: number) => {
    const daySchedules = availability.filter((a: CoachAvailability) => a.day_of_week === dayIndex);
    daySchedules.forEach((slot: CoachAvailability) => deleteAvailability(slot.id));
  };

  const canAddMore = selectedDays.length > 0 && selectedHours.length > 0 && (groupClasses || personalClasses);

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

          {selectedDays.length > 0 && (
            <Card className="p-3 border-primary/20 bg-card/50">
              <Label className="text-sm font-semibold mb-2 block">
                2. Selecciona horas para {selectedDays.length === 7 ? 'todos los días' : selectedDays.length === 1 ? DAYS_OF_WEEK[selectedDays[0]] : `${selectedDays.length} días`}
              </Label>
              <ScrollArea className="h-32 border rounded-lg p-2 bg-background/50">
                <div className="grid grid-cols-4 gap-1">
                  {HOURS.map((hour) => (
                    <Button
                      key={hour.value}
                      variant={selectedHours.includes(hour.value) ? 'default' : 'outline'}
                      size="sm"
                      className={`h-9 text-[11px] font-medium transition-all py-0 ${selectedHours.includes(hour.value)
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'hover:border-primary/50'
                        }`}
                      onClick={() => handleHourToggle(hour.value)}
                    >
                      {hour.display}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
              {selectedHours.length > 0 && (
                <div className="mt-2 pt-2 border-t flex flex-wrap gap-1">
                  {selectedHours.map((hour) => (
                    <Badge key={hour} variant="outline" className="gap-1 text-xs bg-primary/10 border-primary/30 text-primary">
                      {hour}
                      <button onClick={() => handleHourToggle(hour)} className="hover:opacity-70">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          )}

          {selectedDays.length > 0 && selectedHours.length > 0 && (
            <Card className="p-4 border-l-4 border-l-accent bg-accent/5 dark:bg-accent/10 border-primary/10 shadow-sm">
              <Label className="text-sm font-bold mb-4 block text-accent flex items-center gap-2">
                <Check className="h-4 w-4" />
                3. Tipos de clase disponibles
              </Label>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-card/50 transition-colors border border-transparent hover:border-primary/20">
                  <Checkbox
                    id="group-classes"
                    checked={groupClasses}
                    onCheckedChange={(checked) => setGroupClasses(checked as boolean)}
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
                    {groupClasses && (
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
                    checked={personalClasses}
                    onCheckedChange={(checked) => setPersonalClasses(checked as boolean)}
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

              {!groupClasses && !personalClasses && (
                <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-600 dark:text-yellow-400">
                  ⚠️ Selecciona al menos un tipo de clase
                </div>
              )}
            </Card>
          )}

          <div className="pt-3 border-t mt-4 flex justify-end gap-2">
            <Button
              onClick={handleAddAvailability}
              disabled={!canAddMore || isCreating}
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

                const groupConsecutiveSlots = (slots: CoachAvailability[]) => {
                  if (slots.length === 0) return [];
                  const groups: { start: string; end: string; slots: CoachAvailability[] }[] = [];
                  let currentGroup: { start: string; end: string; slots: CoachAvailability[] } | null = null;

                  slots.forEach((slot, index) => {
                    const startHour = parseInt(slot.start_time.split(':')[0]);
                    if (!currentGroup) {
                      currentGroup = { start: slot.start_time, end: slot.end_time, slots: [slot] };
                    } else {
                      const lastEndHour = parseInt(currentGroup.end.split(':')[0]);
                      if (startHour === lastEndHour) {
                        currentGroup.end = slot.end_time;
                        currentGroup.slots.push(slot);
                      } else {
                        groups.push(currentGroup);
                        currentGroup = { start: slot.start_time, end: slot.end_time, slots: [slot] };
                      }
                    }
                    if (index === slots.length - 1) groups.push(currentGroup);
                  });
                  return groups;
                };

                const groupedRanges = groupConsecutiveSlots(sortedSchedules);

                return (
                  <div key={dayIndex} className="relative pl-6 border-l-2 border-primary/20 space-y-3 pb-2 last:pb-0">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-background shadow-sm" />
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="font-black text-sm uppercase tracking-widest text-foreground">{day}</h3>
                        <div className="h-5 px-2 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center">
                          {daySchedules.length}H TOTAL
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
                    
                    <div className="grid gap-3">
                      {groupedRanges.map((range, rIdx) => (
                        <Card key={rIdx} className="overflow-hidden border-border/60 bg-card/40 backdrop-blur-sm shadow-sm ring-1 ring-black/5">
                          <div className="bg-primary/5 px-4 py-2 border-b border-border/40 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5 text-primary" />
                              <span className="text-xs font-black tracking-tight text-primary">
                                {range.start} — {range.end}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">
                              Bloque continuado
                            </span>
                          </div>
                          <div className="p-3">
                            <div className="flex flex-wrap gap-2">
                              {range.slots.map((slot) => (
                                <div
                                  key={slot.id}
                                  className="group relative flex items-center gap-3 px-3 py-1.5 bg-background border border-border/50 rounded-2xl hover:border-primary/40 hover:shadow-md transition-all duration-300"
                                >
                                  <div className="flex flex-col">
                                    <span className="font-black text-[11px] leading-tight text-foreground">
                                      {slot.start_time.split(':')[0]}
                                    </span>
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none mt-0.5">
                                      {parseInt(slot.start_time.split(':')[0]) < 12 ? 'AM' : 'PM'}
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
                        </Card>
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
