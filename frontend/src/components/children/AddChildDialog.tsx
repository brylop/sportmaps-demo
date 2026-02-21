import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { parentsAPI } from '@/lib/api/parents';
import { useAuth } from '@/contexts/AuthContext';
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
import { Camera, FileText, Loader2, X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const childSchema = z.object({
  // Step 1: Información Básica
  full_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  date_of_birth: z.string().min(1, 'La fecha de nacimiento es requerida'),
  grade: z.string().min(1, 'El grado escolar es requerido'),
  doc_type: z.string().min(1, 'El tipo de documento es requerido'),
  doc_number: z.string().min(5, 'El número de documento debe tener al menos 5 caracteres'),

  id_document_url: z.string().min(1, 'El documento de identidad es obligatorio (formato PDF)'),
  avatar_url: z.string().optional(),

  // Step 2: Información Médica y Contacto
  emergency_contact_name: z.string().min(2, 'El nombre del contacto es requerido'),
  emergency_contact_phone: z.string().min(7, 'El teléfono del contacto es requerido'),
  has_allergies: z.boolean().optional(),
  allergy_type: z.string().optional(),
  allergy_severity: z.string().optional(),
  allergy_treatment: z.string().optional(),
  medical_info: z.string().optional(),

  // Legales
  accept_general_data: z.boolean().refine(val => val === true, {
    message: "Debe aceptar el tratamiento de datos generales"
  }),
  accept_sensitive_data: z.boolean().refine(val => val === true, {
    message: "Debe aceptar el tratamiento de datos sensibles"
  }),
});

type ChildFormValues = z.infer<typeof childSchema>;

interface AddChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddChildDialog({ open, onOpenChange, onSuccess }: AddChildDialogProps) {
  const { user } = useAuth();
  const { uploadFile, uploading: isUploading } = useStorage();
  const [currentStep, setCurrentStep] = useState(1);
  const [hasAllergies, setHasAllergies] = useState(false);

  const form = useForm<ChildFormValues>({
    resolver: zodResolver(childSchema),
    defaultValues: {
      full_name: '',
      date_of_birth: '',
      grade: '',
      doc_type: 'TI',
      doc_number: '',

      id_document_url: '',
      avatar_url: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      has_allergies: false,
      allergy_type: '',
      allergy_severity: '',
      allergy_treatment: '',
      medical_info: '',
      accept_general_data: false,
      accept_sensitive_data: false,
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const nextStep = async () => {
    const fieldsToValidate = currentStep === 1
      ? ['full_name', 'date_of_birth', 'grade', 'doc_type', 'doc_number', 'id_document_url']
      : ['emergency_contact_name', 'emergency_contact_phone', 'accept_general_data', 'accept_sensitive_data'];

    const isValid = await form.trigger(fieldsToValidate as any);
    if (isValid) {
      setCurrentStep(prev => prev + 1);
    } else {
      toast.error('Por favor completa todos los campos obligatorios del paso actual');
    }
  };

  const prevStep = () => setCurrentStep(prev => prev - 1);

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

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('El documento debe ser un archivo PDF');
        if (pdfInputRef.current) pdfInputRef.current.value = '';
        return;
      }
      setPdfFile(file);
      form.setValue('id_document_url', 'file_selected'); // Satisfy zod temporarily
      form.clearErrors('id_document_url');
    }
  };

  const onSubmit = async (values: ChildFormValues) => {
    if (!user?.id) {
      toast.error('Debes iniciar sesión para añadir un hijo');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalAvatarUrl = '';
      if (avatarFile) {
        const uploadedUrl = await uploadFile(avatarFile, 'avatars', `children/${user.id}`);
        if (uploadedUrl) {
          finalAvatarUrl = uploadedUrl;
        }
      }

      let finalPdfUrl = '';
      if (pdfFile) {
        const uploadedPdfUrl = await uploadFile(pdfFile, 'identity-documents', `children/${user.id}/docs`);
        if (uploadedPdfUrl) {
          finalPdfUrl = uploadedPdfUrl;
        }
      }

      if (!finalPdfUrl) {
        toast.error('Error al subir el documento de identidad');
        setIsSubmitting(false);
        return;
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

      await parentsAPI.addChild({
        parent_id: user.id,
        full_name: values.full_name,
        date_of_birth: values.date_of_birth,

        medical_info: medicalDetails,
        doc_type: values.doc_type,
        doc_number: values.doc_number,
        grade: values.grade,
        emergency_contact: `${values.emergency_contact_name} - ${values.emergency_contact_phone}`,
        avatar_url: finalAvatarUrl,
        id_document_url: finalPdfUrl,
      });

      toast.success('Hijo añadido exitosamente');
      form.reset();
      setCurrentStep(1);
      setAvatarPreview(null);
      setAvatarFile(null);
      setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (pdfInputRef.current) pdfInputRef.current.value = '';
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error adding child:', error);
      toast.error('Error al añadir el hijo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Añadir Hijo</DialogTitle>
          <DialogDescription>
            Completa la información de tu hijo para gestionar sus actividades deportivas
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <div className="mb-8 mt-2 px-4">
            <div className="relative flex justify-between items-center">
              {/* Stepper Line */}
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -translate-y-1/2 z-0"></div>
              <div
                className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 z-0 transition-all duration-300"
                style={{ width: currentStep === 1 ? '0%' : '100%' }}
              ></div>

              {/* Step 1 */}
              <div className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${currentStep >= 1 ? 'bg-primary border-primary text-white' : 'bg-background border-muted text-muted-foreground'
                    }`}
                >
                  {currentStep > 1 ? <Check className="w-5 h-5" /> : 1}
                </div>
                <span className={`text-[10px] mt-2 font-medium uppercase tracking-wider ${currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                  Básica
                </span>
              </div>

              {/* Step 2 */}
              <div className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${currentStep >= 2 ? 'bg-primary border-primary text-white' : 'bg-background border-muted text-muted-foreground'
                    }`}
                >
                  2
                </div>
                <span className={`text-[10px] mt-2 font-medium uppercase tracking-wider ${currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
                  Médica
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="max-h-[55vh] overflow-y-auto px-1 custom-scrollbar">
              {currentStep === 1 ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* Avatar Upload */}
                  <div className="flex flex-col items-center justify-center py-2 space-y-2">
                    <div className="relative group">
                      <Avatar className="w-24 h-24 border-2 border-primary/20">
                        <AvatarImage src={avatarPreview || ''} className="object-cover" />
                        <AvatarFallback className="bg-muted text-2xl font-bold">
                          {form.watch('full_name')?.charAt(0) || <Camera className="w-8 h-8 opacity-20" />}
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
                        <FormItem>
                          <FormLabel>Fecha de Nacimiento *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
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


                  <FormField
                    control={form.control}
                    name="id_document_url"
                    render={() => (
                      <FormItem>
                        <FormLabel>Documento de Identidad (PDF) *</FormLabel>
                        <FormControl>
                          <div
                            className={`flex items-center justify-between p-3 border-2 border-dashed rounded-lg transition-colors ${pdfFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/20'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-muted rounded-md text-muted-foreground">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium truncate max-w-[150px]">
                                  {pdfFile ? pdfFile.name : 'Seleccionar PDF'}
                                </span>
                                {!pdfFile && (
                                  <span className="text-xs text-muted-foreground">
                                    El documento es requerido
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {pdfFile && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPdfFile(null);
                                    form.setValue('id_document_url', '');
                                    if (pdfInputRef.current) pdfInputRef.current.value = '';
                                  }}
                                  className="p-1 hover:bg-destructive/10 text-destructive rounded-full"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => pdfInputRef.current?.click()}
                              >
                                {pdfFile ? 'Cambiar' : 'Adjuntar'}
                              </Button>
                              <input
                                type="file"
                                accept=".pdf"
                                className="hidden"
                                ref={pdfInputRef}
                                onChange={handlePdfChange}
                              />
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Contacto de Emergencia</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="emergency_contact_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre Contacto *</FormLabel>
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

                  <div className="space-y-4 pt-2 border-t border-muted">
                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Información Médica</h3>

                    <FormField
                      control={form.control}
                      name="has_allergies"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>¿El menor tiene alguna alergia o condición médica? *</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={(val) => {
                                const boolVal = val === 'true';
                                field.onChange(boolVal);
                                setHasAllergies(boolVal);
                              }}
                              defaultValue={field.value ? 'true' : 'false'}
                              className="flex gap-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="true" id="r1" />
                                <Label htmlFor="r1">Sí</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="false" id="r2" />
                                <Label htmlFor="r2">No</Label>
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
                              <FormLabel>Tipo de alergia / condición *</FormLabel>
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
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                <FormLabel>Tratamiento / Instrucciones</FormLabel>
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

                  <div className="space-y-4 pt-4 border-t border-muted">
                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider text-center">Términos y Condiciones</h3>

                    <div className="space-y-3 bg-primary/5 p-4 rounded-lg">
                      <FormField
                        control={form.control}
                        name="accept_general_data"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-xs">
                                Acepto el tratamiento de datos personales generales. *
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="accept_sensitive_data"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-xs">
                                Acepto el tratamiento de datos sensibles y médicos del menor de edad según la normativa vigente. *
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-muted">
              {currentStep === 1 ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="bg-primary hover:bg-primary/90 min-w-[120px]"
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    disabled={isSubmitting}
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Atrás
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || isUploading}
                    className="bg-primary hover:bg-primary/90 min-w-[120px]"
                  >
                    {isSubmitting || isUploading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isUploading ? 'Subiendo...' : 'Guardando...'}
                      </div>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Añadir Hijo
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
