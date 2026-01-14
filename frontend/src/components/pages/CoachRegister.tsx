import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, GraduationCap, Upload, Clock } from "lucide-react";

interface CoachRegisterProps {
  onNavigate: (page: string) => void;
}

// Validation schemas for each step
const professionalInfoSchema = z.object({
  fullName: z.string().min(2, "Nombre debe tener al menos 2 caracteres"),
  phone: z.string().min(10, "Teléfono debe tener al menos 10 dígitos"),
  country: z.string().min(2, "Selecciona un país"),
  city: z.string().min(2, "Selecciona una ciudad"),
  specialty: z.string().min(1, "Selecciona una especialidad"),
  certification: z.string().optional()
});

const experienceSchema = z.object({
  yearsExperience: z.number().min(0, "Años de experiencia debe ser mayor o igual a 0"),
  currentClub: z.string().optional(),
  biography: z.string().min(50, "La biografía debe tener al menos 50 caracteres").max(500, "Máximo 500 caracteres")
});

const documentsSchema = z.object({
  idDocument: z.any().optional(),
  certificates: z.any().optional()
});

const codeOfConductSchema = z.object({
  acceptCode: z.boolean().refine(val => val === true, "Debes aceptar el Código de Conducta")
});

const CoachRegister = ({ onNavigate }: CoachRegisterProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [professionalData, setProfessionalData] = useState<any>({});
  const [experienceData, setExperienceData] = useState<any>({});
  const [documentsData, setDocumentsData] = useState<any>({});

  const professionalForm = useForm({
    resolver: zodResolver(professionalInfoSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      country: "",
      city: "",
      specialty: "",
      certification: ""
    }
  });

  const experienceForm = useForm({
    resolver: zodResolver(experienceSchema),
    defaultValues: {
      yearsExperience: 0,
      currentClub: "",
      biography: ""
    }
  });

  const documentsForm = useForm({
    resolver: zodResolver(documentsSchema)
  });

  const codeForm = useForm({
    resolver: zodResolver(codeOfConductSchema),
    defaultValues: {
      acceptCode: false
    }
  });

  const handleProfessionalSubmit = (data: any) => {
    setProfessionalData(data);
    setCurrentStep(2);
  };

  const handleExperienceSubmit = (data: any) => {
    setExperienceData(data);
    setCurrentStep(3);
  };

  const handleDocumentsSubmit = (data: any) => {
    setDocumentsData(data);
    setCurrentStep(4);
  };

  const handleCodeSubmit = (data: any) => {
    // Here you would typically send all data to Supabase
    console.log("Complete coach registration:", { ...professionalData, ...experienceData, ...documentsData, ...data });
    setCurrentStep(5);
  };

  const renderStep1 = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Tu Perfil de Entrenador</CardTitle>
        <p className="text-muted-foreground">Detalla tu experiencia y especialidades</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={professionalForm.handleSubmit(handleProfessionalSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nombre Completo</Label>
            <Input
              id="fullName"
              {...professionalForm.register("fullName")}
              className="focus:border-primary focus:ring-primary"
            />
            {professionalForm.formState.errors.fullName && (
              <p className="text-destructive text-sm">{professionalForm.formState.errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              {...professionalForm.register("phone")}
              className="focus:border-primary focus:ring-primary"
            />
            {professionalForm.formState.errors.phone && (
              <p className="text-destructive text-sm">{professionalForm.formState.errors.phone.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">País</Label>
              <Select onValueChange={(value) => professionalForm.setValue("country", value)}>
                <SelectTrigger className="focus:border-primary focus:ring-primary">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="co">Colombia</SelectItem>
                  <SelectItem value="mx">México</SelectItem>
                  <SelectItem value="ar">Argentina</SelectItem>
                  <SelectItem value="es">España</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                {...professionalForm.register("city")}
                className="focus:border-primary focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Especialidad Deportiva</Label>
            <Select onValueChange={(value) => professionalForm.setValue("specialty", value)}>
              <SelectTrigger className="focus:border-primary focus:ring-primary">
                <SelectValue placeholder="Selecciona tu especialidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="futbol">Fútbol</SelectItem>
                <SelectItem value="baloncesto">Baloncesto</SelectItem>
                <SelectItem value="tenis">Tenis</SelectItem>
                <SelectItem value="natacion">Natación</SelectItem>
                <SelectItem value="voleibol">Voleibol</SelectItem>
                <SelectItem value="atletismo">Atletismo</SelectItem>
                <SelectItem value="gimnasia">Gimnasia</SelectItem>
                <SelectItem value="crossfit">CrossFit</SelectItem>
                <SelectItem value="multideporte">Multideporte</SelectItem>
              </SelectContent>
            </Select>
            {professionalForm.formState.errors.specialty && (
              <p className="text-destructive text-sm">{professionalForm.formState.errors.specialty.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="certification">Nivel de Certificación (Opcional)</Label>
            <Input
              id="certification"
              placeholder="Ej: Nivel 1 UEFA, Certificado Nacional"
              {...professionalForm.register("certification")}
              className="focus:border-primary focus:ring-primary"
            />
          </div>

          <Button type="submit" className="w-full" variant="default">
            Siguiente
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Cuéntanos sobre ti</CardTitle>
        <p className="text-muted-foreground">Años de experiencia, clubs, y una breve descripción personal</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={experienceForm.handleSubmit(handleExperienceSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="yearsExperience">Años de Experiencia</Label>
            <Input
              id="yearsExperience"
              type="number"
              min="0"
              {...experienceForm.register("yearsExperience", { valueAsNumber: true })}
              className="focus:border-primary focus:ring-primary"
            />
            {experienceForm.formState.errors.yearsExperience && (
              <p className="text-destructive text-sm">{experienceForm.formState.errors.yearsExperience.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="currentClub">Club/Equipo Actual (Opcional)</Label>
            <Input
              id="currentClub"
              placeholder="Nombre del club o equipo donde trabajas"
              {...experienceForm.register("currentClub")}
              className="focus:border-primary focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="biography">Breve Biografía</Label>
            <Textarea
              id="biography"
              placeholder="Describe tu experiencia, logros, y metodología de entrenamiento..."
              {...experienceForm.register("biography")}
              className="focus:border-primary focus:ring-primary min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              {experienceForm.watch("biography")?.length || 0}/500 caracteres
            </p>
            {experienceForm.formState.errors.biography && (
              <p className="text-destructive text-sm">{experienceForm.formState.errors.biography.message}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setCurrentStep(1)}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <Button type="submit" className="flex-1" variant="default">
              Siguiente
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Documentos de Verificación</CardTitle>
        <p className="text-muted-foreground">Sube tu ID y certificados para validar tu perfil</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={documentsForm.handleSubmit(handleDocumentsSubmit)} className="space-y-6">
          <div className="space-y-3">
            <Label>Subir ID/Cédula</Label>
            <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <Upload className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Haz clic aquí o arrastra tu documento de identidad
              </p>
              <Button type="button" variant="outline" size="sm" className="border-primary text-primary">
                Seleccionar Archivo
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Subir Certificados</Label>
            <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <Upload className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Certificaciones deportivas, títulos académicos, etc.
              </p>
              <Button type="button" variant="outline" size="sm" className="border-primary text-primary">
                Seleccionar Archivos
              </Button>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Nota:</strong> Revisaremos tus documentos para aprobación. Este proceso puede tardar hasta 24 horas.
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setCurrentStep(2)}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <Button type="submit" className="flex-1" variant="default">
              Siguiente
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  const renderStep4 = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Código de Conducta del Entrenador</CardTitle>
        <p className="text-muted-foreground">Compromiso con la ética y seguridad deportiva</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={codeForm.handleSubmit(handleCodeSubmit)} className="space-y-4">
          <div className="max-h-48 overflow-y-auto border rounded-lg p-4 bg-muted/30">
            <div className="text-sm space-y-3">
              <h4 className="font-semibold text-primary">Código de Conducta SportMaps</h4>
              <p>Como entrenador en SportMaps, me comprometo a:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Priorizar la seguridad y bienestar de todos los atletas</li>
                <li>Mantener un ambiente de respeto y profesionalismo</li>
                <li>Respetar las diferencias individuales y promover la inclusión</li>
                <li>Comunicarme de manera clara y constructiva con atletas y padres</li>
                <li>Mantener la confidencialidad de la información personal</li>
                <li>Cumplir con horarios y compromisos acordados</li>
                <li>Reportar cualquier comportamiento inapropiado</li>
                <li>Promover el juego limpio y los valores deportivos</li>
              </ul>
              <p className="text-xs">
                El incumplimiento de este código puede resultar en la suspensión o cancelación de mi cuenta.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="acceptCode"
              checked={codeForm.watch("acceptCode")}
              onCheckedChange={(checked) => codeForm.setValue("acceptCode", !!checked)}
              className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <Label htmlFor="acceptCode" className="text-sm font-normal cursor-pointer">
              Acepto el Código de Conducta del Entrenador y me comprometo a cumplir con todas las normas establecidas
            </Label>
          </div>
          {codeForm.formState.errors.acceptCode && (
            <p className="text-destructive text-sm">{codeForm.formState.errors.acceptCode.message}</p>
          )}

          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setCurrentStep(3)}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <Button type="submit" variant="orange" className="flex-1">
              Enviar Solicitud
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  const renderStep5 = () => (
    <Card className="w-full max-w-md mx-auto text-center">
      <CardContent className="pt-8 pb-8">
        <div className="mb-6">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">¡Solicitud Recibida!</h1>
          <p className="text-muted-foreground">
            Tu perfil está pendiente de revisión. Te notificaremos por email una vez que tu cuenta sea aprobada.
          </p>
        </div>
        
        <Button 
          variant="default" 
          className="w-full"
          onClick={() => onNavigate("dashboard")}
        >
          Ir a mi Panel de Control
        </Button>
        
        <p className="text-xs text-muted-foreground mt-4">
          Panel limitado hasta completar la aprobación
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-muted/30 py-8" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="container mx-auto px-4 max-w-md">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-center items-center space-x-2 mb-4">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step <= currentStep 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step}
                </div>
                {step < 5 && (
                  <div 
                    className={`w-8 h-1 mx-1 ${
                      step < currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Paso {currentStep} de 5
          </p>
        </div>

        {/* Render current step */}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}

        {/* Back to role selection */}
        {currentStep === 1 && (
          <div className="text-center mt-6">
            <p className="text-sm text-muted-foreground">
              ¿Quieres cambiar tu rol?{" "}
              <button 
                className="text-primary font-medium hover:underline"
                onClick={() => onNavigate("role-selection")}
              >
                Volver a selección de rol
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachRegister;