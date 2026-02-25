import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Trophy, CheckCircle2, Minus, Plus } from 'lucide-react';

interface ProgramFormData {
  name: string;
  sport: string;
  description?: string;
  schedule: string;
  price_monthly: number;
  age_min?: number;
  age_max?: number;
  max_students?: number;
  coach_id?: string;
  facility_id?: string;
}

interface ProgramFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  onSuccess?: () => void;
  program?: {
    id: string;
    name: string;
    sport: string;
    description?: string | null;
    schedule?: string | null;
    price_monthly: number;
    age_min?: number | null;
    age_max?: number | null;
    max_students?: number | null;
    coach_id?: string | null;
    facility_id?: string | null;
  };
}

const sports = [
  'Fútbol',
  'Baloncesto',
  'Voleibol',
  'Tenis',
  'Natación',
  'Gimnasia',
  'Artes Marciales',
  'Atletismo',
  'Béisbol',
  'Cheerleading',
  'Otro',
];

export function ProgramFormDialog({
  open,
  onOpenChange,
  schoolId,
  onSuccess,
  program,
}: ProgramFormDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);

  const form = useForm<ProgramFormData>({
    defaultValues: {
      name: program?.name || '',
      sport: program?.sport || '',
      description: program?.description || '',
      schedule: program?.schedule || '',
      price_monthly: program?.price_monthly ?? ('' as any),
      age_min: program?.age_min || undefined,
      age_max: program?.age_max || undefined,
      max_students: program?.max_students || undefined,
      coach_id: program?.coach_id || undefined,
      facility_id: program?.facility_id || undefined,
    },
  });

  useEffect(() => {
    if (open && schoolId) {
      fetchSchoolData();
    }
  }, [open, schoolId]);

  const fetchSchoolData = async () => {
    try {
      // Fetch Staff (Coaches)
      const { data: staffData } = await supabase
        .from('school_staff')
        .select('id, full_name, specialty')
        .eq('school_id', schoolId)
        .eq('status', 'active');

      if (staffData) setStaff(staffData);

      // Fetch Facilities
      const { data: facilitiesData } = await supabase
        .from('facilities')
        .select('id, name, type')
        .eq('school_id', schoolId);

      if (facilitiesData) setFacilities(facilitiesData);

    } catch (error) {
      console.error('Error fetching school data:', error);
    }
  };

  const onSubmit = async (data: ProgramFormData) => {
    if (!user || !schoolId) return;

    setLoading(true);
    try {
      if (program?.id) {
        // Update existing program (in teams table)
        const { error } = await supabase
          .from('teams')
          .update({
            name: data.name,
            sport: data.sport,
            description: data.description || null,
            schedule: data.schedule,
            price_monthly: data.price_monthly === '' as any ? 0 : Number(data.price_monthly),
            age_min: data.age_min === '' as any ? null : (data.age_min || null),
            age_max: data.age_max === '' as any ? null : (data.age_max || null),
            max_students: data.max_students === '' as any ? null : (data.max_students || null),
            coach_id: data.coach_id || null,
            facility_id: data.facility_id || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', program.id);

        if (error) throw error;
      } else {
        // Create new program (in teams table)
        const { error } = await supabase.from('teams').insert({
          school_id: schoolId,
          name: data.name,
          sport: data.sport,
          description: data.description || null,
          schedule: data.schedule,
          price_monthly: data.price_monthly === '' as any ? 0 : Number(data.price_monthly),
          age_min: data.age_min === '' as any ? null : (data.age_min || null),
          age_max: data.age_max === '' as any ? null : (data.age_max || null),
          max_students: data.max_students === '' as any ? null : (data.max_students || null),
          coach_id: data.coach_id || null,
          facility_id: data.facility_id || null,
          current_students: 0,
          active: true,
        });

        if (error) throw error;
      }

      setSuccess(true);
      toast({
        title: program?.id ? '¡Programa actualizado!' : '¡Programa creado!',
        description: program?.id
          ? 'El programa ha sido actualizado correctamente'
          : 'El nuevo programa ya está disponible para inscripciones',
      });

      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
        form.reset();
        onSuccess?.();
      }, 1500);
    } catch (error: any) {
      console.error('Error saving program:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo guardar el programa',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetDialog = () => {
    setSuccess(false);
    form.reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) resetDialog();
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {success ? (
          <div className="py-12 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold font-poppins">
                {program?.id ? '¡Programa Actualizado!' : '¡Programa Creado!'}
              </h3>
              <p className="text-muted-foreground">
                {program?.id
                  ? 'Los cambios han sido guardados'
                  : 'Tu nuevo programa está listo para recibir inscripciones'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-poppins">
                <Trophy className="w-5 h-5 text-primary" />
                {program?.id ? 'Editar Programa' : 'Nuevo Programa'}
              </DialogTitle>
              <DialogDescription>
                {program?.id
                  ? 'Actualiza la información del programa'
                  : 'Crea un nuevo programa deportivo para tu escuela'}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del programa</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Fútbol Sub-12" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sport"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deporte</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sports.map((sport) => (
                              <SelectItem key={sport} value={sport}>
                                {sport}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="price_monthly"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio Mensual</FormLabel>
                        <FormControl>
                          <div className="flex items-center border rounded-md h-10 w-full bg-background overflow-hidden relative">
                            <button
                              type="button"
                              onClick={() => field.onChange(Math.max(0, (field.value as number || 0) - 10000))}
                              className="h-full px-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute left-0 z-10 flex items-center justify-center border-r bg-muted/20"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="absolute left-12 text-muted-foreground font-medium z-10 pointer-events-none">$</span>
                            <Input
                              type="text"
                              className="border-0 text-center font-semibold focus-visible:ring-0 pl-16 pr-10"
                              placeholder="0"
                              value={field.value ? Number(field.value).toLocaleString('es-CO') : ''}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                field.onChange(val === '' ? '' : Number(val));
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => field.onChange((field.value as number || 0) + 10000)}
                              className="h-full px-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute right-0 z-10 flex items-center justify-center border-l bg-muted/20"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe la clase, objetivos, etc."
                          className="resize-none h-20"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="coach_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entrenador</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar entrenador" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {staff.map((coach) => (
                              <SelectItem key={coach.id} value={coach.id}>
                                {coach.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="facility_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ubicación</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar ubicación" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {facilities.map((fac) => (
                              <SelectItem key={fac.id} value={fac.id}>
                                {fac.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="schedule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horario</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Lunes y Miércoles 4:00 PM" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="max_students"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capacidad</FormLabel>
                        <FormControl>
                          <div className="flex items-center border rounded-md h-10 bg-background overflow-hidden relative">
                            <button
                              type="button"
                              onClick={() => field.onChange(Math.max(1, (field.value as number || 1) - 1))}
                              className="h-full px-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute left-0 z-10 flex items-center justify-center border-r"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <Input
                              type="number"
                              className="border-0 text-center font-semibold focus-visible:ring-0 px-10 no-spinners"
                              placeholder="20"
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                            <button
                              type="button"
                              onClick={() => field.onChange((field.value as number || 0) + 1)}
                              className="h-full px-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute right-0 z-10 flex items-center justify-center border-l"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="age_min"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Edad Mín</FormLabel>
                        <FormControl>
                          <div className="flex items-center border rounded-md h-10 bg-background overflow-hidden relative">
                            <button
                              type="button"
                              onClick={() => field.onChange(Math.max(3, (field.value as number || 3) - 1))}
                              className="h-full px-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute left-0 z-10 flex items-center justify-center border-r"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <Input
                              type="number"
                              className="border-0 text-center font-semibold focus-visible:ring-0 px-8 text-sm no-spinners"
                              placeholder="6"
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                            <button
                              type="button"
                              onClick={() => field.onChange((field.value as number || 0) + 1)}
                              className="h-full px-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute right-0 z-10 flex items-center justify-center border-l"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="age_max"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Edad Máx</FormLabel>
                        <FormControl>
                          <div className="flex items-center border rounded-md h-10 bg-background overflow-hidden relative">
                            <button
                              type="button"
                              onClick={() => field.onChange(Math.max(4, (field.value as number || 4) - 1))}
                              className="h-full px-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute left-0 z-10 flex items-center justify-center border-r"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <Input
                              type="number"
                              className="border-0 text-center font-semibold focus-visible:ring-0 px-8 text-sm no-spinners"
                              placeholder="12"
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                            <button
                              type="button"
                              onClick={() => field.onChange((field.value as number || 0) + 1)}
                              className="h-full px-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute right-0 z-10 flex items-center justify-center border-l"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1 font-poppins" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : program?.id ? (
                      'Actualizar Clase'
                    ) : (
                      'Crear Clase'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
