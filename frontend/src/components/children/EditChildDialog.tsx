import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { parentsAPI } from '@/lib/api/parents';
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
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useStorage } from '@/hooks/useStorage';
import { Camera, Loader2, X, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon } from 'lucide-react';

const editChildSchema = z.object({
    full_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
    date_of_birth: z.string().min(1, 'La fecha de nacimiento es requerida'),
    grade: z.string().min(1, 'El grado escolar es requerido'),
    doc_type: z.string().min(1, 'El tipo de documento es requerido'),
    doc_number: z.string().min(5, 'El número de documento debe tener al menos 5 caracteres'),
    emergency_contact_name: z.string().min(2, 'El nombre del contacto es requerido'),
    emergency_contact_phone: z.string().min(7, 'El teléfono del contacto es requerido'),
    has_allergies: z.boolean().optional(),
    allergy_type: z.string().optional(),
    allergy_severity: z.string().optional(),
    allergy_treatment: z.string().optional(),
    medical_info: z.string().optional(),
    avatar_url: z.string().optional(),
});

type EditChildFormValues = z.infer<typeof editChildSchema>;

interface ChildData {
    id: string;
    full_name: string;
    date_of_birth: string;
    grade?: string;
    doc_type?: string;
    doc_number?: string;
    emergency_contact?: string;
    medical_info?: string;
    avatar_url?: string;
}

interface EditChildDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    child: ChildData;
}

function parseMedicalInfo(medicalInfoStr?: string) {
    if (!medicalInfoStr) return { has_allergies: false };
    try {
        return JSON.parse(medicalInfoStr);
    } catch {
        return { has_allergies: false };
    }
}

function parseEmergencyContact(contactStr?: string) {
    if (!contactStr) return { name: '', phone: '' };
    const parts = contactStr.split(' - ');
    return { name: parts[0] || '', phone: parts[1] || '' };
}

export function EditChildDialog({ open, onOpenChange, onSuccess, child }: EditChildDialogProps) {
    const { uploadFile, uploading: isUploading } = useStorage();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [hasAllergies, setHasAllergies] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const medicalInfo = parseMedicalInfo(child.medical_info);
    const emergencyContact = parseEmergencyContact(child.emergency_contact);

    const form = useForm<EditChildFormValues>({
        resolver: zodResolver(editChildSchema),
        defaultValues: {
            full_name: child.full_name || '',
            date_of_birth: child.date_of_birth || '',
            grade: child.grade || '',
            doc_type: child.doc_type || 'TI',
            doc_number: child.doc_number || '',
            emergency_contact_name: emergencyContact.name,
            emergency_contact_phone: emergencyContact.phone,
            has_allergies: medicalInfo.has_allergies || false,
            allergy_type: medicalInfo.allergy_type || '',
            allergy_severity: medicalInfo.allergy_severity || '',
            allergy_treatment: medicalInfo.allergy_treatment || '',
            medical_info: medicalInfo.additional_notes || '',
            avatar_url: child.avatar_url || '',
        },
    });

    // Reset form when child changes or dialog opens
    useEffect(() => {
        if (open) {
            const medInfo = parseMedicalInfo(child.medical_info);
            const emContact = parseEmergencyContact(child.emergency_contact);
            setHasAllergies(medInfo.has_allergies || false);
            setAvatarPreview(null);
            setAvatarFile(null);
            form.reset({
                full_name: child.full_name || '',
                date_of_birth: child.date_of_birth || '',
                grade: child.grade || '',
                doc_type: child.doc_type || 'TI',
                doc_number: child.doc_number || '',
                emergency_contact_name: emContact.name,
                emergency_contact_phone: emContact.phone,
                has_allergies: medInfo.has_allergies || false,
                allergy_type: medInfo.allergy_type || '',
                allergy_severity: medInfo.allergy_severity || '',
                allergy_treatment: medInfo.allergy_treatment || '',
                medical_info: medInfo.additional_notes || '',
                avatar_url: child.avatar_url || '',
            });
        }
    }, [open, child]);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const onSubmit = async (values: EditChildFormValues) => {
        setIsSubmitting(true);
        try {
            let finalAvatarUrl = child.avatar_url || '';
            if (avatarFile) {
                const uploadedUrl = await uploadFile(avatarFile, 'avatars', `children/${child.id}`);
                if (uploadedUrl) {
                    finalAvatarUrl = uploadedUrl;
                }
            }

            const medicalDetails = values.has_allergies
                ? JSON.stringify({
                    has_allergies: true,
                    allergy_type: values.allergy_type || '',
                    allergy_severity: values.allergy_severity || '',
                    allergy_treatment: values.allergy_treatment || '',
                    additional_notes: values.medical_info || '',
                })
                : JSON.stringify({ has_allergies: false });

            await parentsAPI.updateChild(child.id, {
                full_name: values.full_name,
                date_of_birth: values.date_of_birth,
                grade: values.grade,
                doc_type: values.doc_type,
                doc_number: values.doc_number,
                emergency_contact: `${values.emergency_contact_name} - ${values.emergency_contact_phone}`,
                avatar_url: finalAvatarUrl,
                medical_info: medicalDetails,
            });

            toast.success('Información del hijo actualizada exitosamente');
            onOpenChange(false);
            onSuccess();
        } catch (error) {
            console.error('Error updating child:', error);
            toast.error('Error al actualizar la información del hijo');
        } finally {
            setIsSubmitting(false);
        }
    };

    const currentAvatarSrc = avatarPreview || child.avatar_url || '';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Editar Información del Hijo</DialogTitle>
                    <DialogDescription>
                        Actualiza los datos de {child.full_name}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="max-h-[60vh] overflow-y-auto px-1 custom-scrollbar space-y-5">

                            {/* Avatar Upload */}
                            <div className="flex flex-col items-center justify-center py-2 space-y-2">
                                <div className="relative group">
                                    <Avatar className="w-24 h-24 border-2 border-primary/20">
                                        <AvatarImage src={currentAvatarSrc} className="object-cover" />
                                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-white font-semibold text-2xl">
                                            {form.watch('full_name')?.charAt(0) || child.full_name?.charAt(0) || <Camera className="w-8 h-8 opacity-20" />}
                                        </AvatarFallback>
                                    </Avatar>
                                    <label className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full cursor-pointer hover:bg-primary/90 transition-colors shadow-lg">
                                        <Camera className="w-4 h-4" />
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleAvatarChange}
                                            ref={fileInputRef}
                                        />
                                    </label>
                                    {avatarPreview && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAvatarPreview(null);
                                                setAvatarFile(null);
                                                if (fileInputRef.current) fileInputRef.current.value = '';
                                            }}
                                            className="absolute -top-1 -right-1 bg-destructive text-white p-1 rounded-full shadow-md"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                                <span className="text-xs text-muted-foreground">Foto de Perfil (Opcional)</span>
                            </div>

                            {/* Información Básica */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Información Básica</h3>

                                <FormField
                                    control={form.control}
                                    name="full_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nombre Completo *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: Juan Pérez" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="date_of_birth"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>Fecha de Nacimiento *</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button
                                                                variant={"outline"}
                                                                className={cn(
                                                                    "w-full pl-3 text-left font-normal",
                                                                    !field.value && "text-muted-foreground"
                                                                )}
                                                            >
                                                                {field.value ? (
                                                                    format(new Date(field.value + 'T00:00:00'), "PPP", { locale: es })
                                                                ) : (
                                                                    <span>Selecciona una fecha</span>
                                                                )}
                                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar
                                                            mode="single"
                                                            selected={field.value ? new Date(field.value + 'T00:00:00') : undefined}
                                                            onSelect={(date) => {
                                                                if (date) {
                                                                    const year = date.getFullYear();
                                                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                                                    const day = String(date.getDate()).padStart(2, '0');
                                                                    field.onChange(`${year}-${month}-${day}`);
                                                                }
                                                            }}
                                                            captionLayout="dropdown-buttons"
                                                            fromYear={1920}
                                                            toYear={new Date().getFullYear()}
                                                            disabled={(date) =>
                                                                date > new Date() || date < new Date("1900-01-01")
                                                            }
                                                            initialFocus
                                                            locale={es}
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="grade"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Grado / Nivel *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Ej: 5° Primaria" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="doc_type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Tipo de Documento *</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccionar" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="RC">Registro Civil</SelectItem>
                                                        <SelectItem value="TI">Tarjeta de Identidad</SelectItem>
                                                        <SelectItem value="CC">Cédula</SelectItem>
                                                        <SelectItem value="CE">Cédula Extranjería</SelectItem>
                                                        <SelectItem value="PPT">PPT / Otros</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="doc_number"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Número de Documento *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="123456789" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Contacto de Emergencia */}
                            <div className="space-y-4 pt-2 border-t border-muted">
                                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Contacto de Emergencia</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="emergency_contact_name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nombre *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Ej: Maria Pérez" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="emergency_contact_phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Teléfono *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Ej: 3101234567" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Información Médica */}
                            <div className="space-y-4 pt-2 border-t border-muted">
                                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Información Médica</h3>

                                <FormField
                                    control={form.control}
                                    name="has_allergies"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel>¿El menor tiene alguna alergia o condición médica?</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                    onValueChange={(val) => {
                                                        const boolVal = val === 'true';
                                                        field.onChange(boolVal);
                                                        setHasAllergies(boolVal);
                                                    }}
                                                    value={field.value ? 'true' : 'false'}
                                                    className="flex gap-4"
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="true" id="edit-r1" />
                                                        <Label htmlFor="edit-r1">Sí</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="false" id="edit-r2" />
                                                        <Label htmlFor="edit-r2">No</Label>
                                                    </div>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {hasAllergies && (
                                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg animate-in fade-in zoom-in-95 duration-200">
                                        <FormField
                                            control={form.control}
                                            name="allergy_type"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Tipo de alergia / condición</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ej: Rinitis, Alergia al maní..." {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="allergy_severity"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Severidad</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Seleccionar" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="Leve">Leve</SelectItem>
                                                                <SelectItem value="Moderada">Moderada</SelectItem>
                                                                <SelectItem value="Severa">Severa</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="allergy_treatment"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Tratamiento</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Ej: Uso de inhalador" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                )}

                                <FormField
                                    control={form.control}
                                    name="medical_info"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Observaciones Médicas Adicionales</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Cualquier otra información importante..."
                                                    className="min-h-[80px]"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-muted">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting || isUploading}
                                className="bg-primary hover:bg-primary/90 min-w-[140px]"
                            >
                                {isSubmitting || isUploading ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {isUploading ? 'Subiendo...' : 'Guardando...'}
                                    </div>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4 mr-2" />
                                        Guardar Cambios
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
