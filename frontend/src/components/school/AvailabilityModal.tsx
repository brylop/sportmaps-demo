import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, X, Plus, Trash2, Users, User, Check } from 'lucide-react';
import { useCoachAvailability, CoachAvailability, CoachAvailabilityInput } from '@/hooks/useCoachAvailability';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NumberStepper } from '@/components/ui/number-stepper';

interface AvailabilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coachId: string;
  coachName: string;
  schoolId: string;
}

const DAYS_OF_WEEK = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAYS_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

// Generar horas en formato 12h (00:00-01:00, 01:00-02:00, etc.)
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const start = String(i).padStart(2, '0');
  const end = String(i + 1).padStart(2, '0');
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

export function AvailabilityModal({
  open,
  onOpenChange,
  coachId,
  coachName,
  schoolId,
}: AvailabilityModalProps) {
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

    // Reset
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

  const dayAvailability = availability.filter((a: CoachAvailability) =>
    selectedDays.includes(a.day_of_week)
  );

  const canAddMore = selectedDays.length > 0 && selectedHours.length > 0 && (groupClasses || personalClasses);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-5">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Clock className="h-6 w-6 text-primary" />
            Disponibilidad - {coachName}
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">
            Configura los días, horas y tipos de clase
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span>Cargando disponibilidad...</span>
          </div>
        ) : (
          <Tabs defaultValue="config" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-3 h-9">
              <TabsTrigger value="config" className="text-xs">Configurar</TabsTrigger>
              <TabsTrigger value="scheduled" className="text-xs">Registrados ({availability.length})</TabsTrigger>
            </TabsList>

            {/* TAB 1: CONFIGURAR DISPONIBILIDAD */}
            <TabsContent value="config" className="space-y-4 mt-4">

              {/* 1️⃣ SELECTOR DE DÍAS */}
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

              {/* 2️⃣ SELECTOR DE HORAS - Solo muestra si hay días seleccionados */}
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

              {/* 3️⃣ TIPOS DE CLASE - Solo muestra si hay días Y horas */}
              {selectedDays.length > 0 && selectedHours.length > 0 && (
                <Card className="p-4 border-l-4 border-l-accent bg-accent/5 dark:bg-accent/10 border-primary/10 shadow-sm">
                  <Label className="text-sm font-bold mb-4 block text-accent flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    3. Tipos de clase disponibles
                  </Label>
                  <div className="space-y-2">
                    {/* Clases Grupales */}
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

                    {/* Clases Personalizadas */}
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

            </TabsContent>

            {/* TAB 2: HORARIOS REGISTRADOS */}
            <TabsContent value="scheduled" className="space-y-3 mt-4">
              {availability.length === 0 ? (
                <Card className="p-6 text-center border-dashed">
                  <Clock className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-muted-foreground text-sm">No hay horarios registrados</p>
                </Card>
              ) : (
                <div className="grid gap-2">
                  {DAYS_OF_WEEK.map((day, dayIndex) => {
                    const daySchedules = availability.filter(
                      (a: CoachAvailability) => a.day_of_week === dayIndex
                    );

                    if (daySchedules.length === 0) return null;
                    
                    // Ordenar por hora de inicio
                    const sortedSchedules = [...daySchedules].sort((a, b) => a.start_time.localeCompare(b.start_time));

                    return (
                      <Card key={dayIndex} className="p-2 border-l-4 border-l-primary bg-card/30 group">
                        <div className="flex items-center justify-between mb-1.5 px-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-primary text-xs uppercase tracking-wider">{day}</h3>
                            <Badge variant="secondary" className="text-[9px] h-4 px-1 opacity-70">
                              {daySchedules.length}
                            </Badge>
                          </div>
                          <button
                            onClick={() => handleDeleteDay(dayIndex)}
                            disabled={isDeleting}
                            className="text-destructive/50 hover:text-destructive hover:bg-destructive/10 p-1 rounded transition-all opacity-0 group-hover:opacity-100"
                            title={`Eliminar todos los horarios del ${day}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                          {sortedSchedules.map((slot: CoachAvailability) => (
                            <div
                              key={slot.id}
                              className="group relative flex flex-col p-1.5 bg-background border border-border/40 rounded-md hover:border-primary/30 transition-all hover:shadow-sm"
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-[10px]">
                                  {slot.start_time}
                                </span>
                                <button 
                                  onClick={() => deleteAvailability(slot.id)}
                                  disabled={isDeleting}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/10 rounded text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                              <div className="flex gap-1 flex-wrap">
                                {slot.available_for_group_classes && (
                                  <div className="h-1.5 w-1.5 rounded-full bg-primary" title="Grupal" />
                                )}
                                {slot.available_for_personal_classes && (
                                  <div className="h-1.5 w-1.5 rounded-full bg-accent" title="Personal" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="pt-3 border-t mt-4 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs h-9"
          >
            Cerrar
          </Button>
          <Button
            onClick={handleAddAvailability}
            disabled={!canAddMore || isCreating}
            className="gap-2 bg-primary hover:bg-primary-dark text-xs h-9"
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}