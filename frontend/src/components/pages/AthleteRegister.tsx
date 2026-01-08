import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, User, Mail, Phone, Calendar, Users } from "lucide-react";

interface AthleteRegisterProps {
  onNavigate: (page: string) => void;
}

// Validation schemas for each step
const parentInfoSchema = z.object({
  parentName: z.string().min(2, "Nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(10, "Teléfono debe tener al menos 10 dígitos"),
  country: z.string().min(2, "Selecciona un país"),
  city: z.string().min(2, "Selecciona una ciudad"),
  language: z.string().min(2, "Selecciona un idioma")
});

const athleteInfoSchema = z.object({
  athleteName: z.string().min(2, "Nombre del atleta es requerido"),
  birthDate: z.string().min(1, "Fecha de nacimiento es requerida"),
  gender: z.string().min(1, "Selecciona el género"),
  sport: z.string().min(1, "Selecciona un deporte")
});

const termsSchema = z.object({
  acceptTerms: z.boolean().refine(val => val === true, "Debes aceptar los términos"),
  acceptPrivacy: z.boolean().refine(val => val === true, "Debes aceptar la política de privacidad"),
  subscribeNews: z.boolean().optional()
});

const AthleteRegister = ({ onNavigate }: AthleteRegisterProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [parentData, setParentData] = useState<any>({});
  const [athleteData, setAthleteData] = useState<any>({});

  const parentForm = useForm({
    resolver: zodResolver(parentInfoSchema),
    defaultValues: {
      parentName: "",
      email: "",
      phone: "",
      country: "",
      city: "",
      language: "es"
    }
  });

  const athleteForm = useForm({
    resolver: zodResolver(athleteInfoSchema),
    defaultValues: {
      athleteName: "",
      birthDate: "",
      gender: "",
      sport: ""
    }
  });

  const termsForm = useForm({
    resolver: zodResolver(termsSchema),
    defaultValues: {
      acceptTerms: false,
      acceptPrivacy: false,
      subscribeNews: false
    }
  });

  const handleParentSubmit = (data: any) => {
    setParentData(data);
    setCurrentStep(2);
  };

  const handleAthleteSubmit = (data: any) => {
    setAthleteData(data);
    setCurrentStep(3);
  };

  const handleTermsSubmit = (data: any) => {
    // Here you would typically send all data to Supabase
    console.log("Complete registration data:", { ...parentData, ...athleteData, ...data });
    setCurrentStep(4);
  };

  const renderStep1 = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Tus Datos de Contacto</CardTitle>
        <p className="text-muted-foreground">Ayúdanos a conocerte mejor</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={parentForm.handleSubmit(handleParentSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="parentName">Nombre Completo</Label>
            <Input
              id="parentName"
              {...parentForm.register("parentName")}
              className="focus:border-primary focus:ring-primary"
            />
            {parentForm.formState.errors.parentName && (
              <p className="text-destructive text-sm">{parentForm.formState.errors.parentName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...parentForm.register("email")}
              className="focus:border-primary focus:ring-primary"
            />
            {parentForm.formState.errors.email && (
              <p className="text-destructive text-sm">{parentForm.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              {...parentForm.register("phone")}
              className="focus:border-primary focus:ring-primary"
            />
            {parentForm.formState.errors.phone && (
              <p className="text-destructive text-sm">{parentForm.formState.errors.phone.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">País</Label>
              <Select onValueChange={(value) => parentForm.setValue("country", value)}>
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
                {...parentForm.register("city")}
                className="focus:border-primary focus:ring-primary"
              />
            </div>
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
        <CardTitle className="text-2xl font-bold">Datos de tu Atleta</CardTitle>
        <p className="text-muted-foreground">Registra a tu hijo(a) para comenzar su viaje deportivo</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={athleteForm.handleSubmit(handleAthleteSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="athleteName">Nombre y Apellido del Atleta</Label>
            <Input
              id="athleteName"
              {...athleteForm.register("athleteName")}
              className="focus:border-primary focus:ring-primary"
            />
            {athleteForm.formState.errors.athleteName && (
              <p className="text-destructive text-sm">{athleteForm.formState.errors.athleteName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthDate">Fecha de Nacimiento</Label>
            <Input
              id="birthDate"
              type="date"
              {...athleteForm.register("birthDate")}
              className="focus:border-primary focus:ring-primary"
            />
            {athleteForm.formState.errors.birthDate && (
              <p className="text-destructive text-sm">{athleteForm.formState.errors.birthDate.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Género</Label>
            <RadioGroup
              value={athleteForm.watch("gender")}
              onValueChange={(value) => athleteForm.setValue("gender", value)}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="masculino" id="masculino" className="border-primary text-primary" />
                <Label htmlFor="masculino">Masculino</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="femenino" id="femenino" className="border-primary text-primary" />
                <Label htmlFor="femenino">Femenino</Label>
              </div>
            </RadioGroup>
            {athleteForm.formState.errors.gender && (
              <p className="text-destructive text-sm">{athleteForm.formState.errors.gender.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Deporte Principal</Label>
            <Select onValueChange={(value) => athleteForm.setValue("sport", value)}>
              <SelectTrigger className="focus:border-primary focus:ring-primary">
                <SelectValue placeholder="Selecciona un deporte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="futbol">Fútbol</SelectItem>
                <SelectItem value="baloncesto">Baloncesto</SelectItem>
                <SelectItem value="tenis">Tenis</SelectItem>
                <SelectItem value="natacion">Natación</SelectItem>
                <SelectItem value="voleibol">Voleibol</SelectItem>
                <SelectItem value="atletismo">Atletismo</SelectItem>
              </SelectContent>
            </Select>
            {athleteForm.formState.errors.sport && (
              <p className="text-destructive text-sm">{athleteForm.formState.errors.sport.message}</p>
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
        <CardTitle className="text-2xl font-bold">Términos y Condiciones</CardTitle>
        <p className="text-muted-foreground">Por favor, revisa y acepta nuestros términos de servicio</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={termsForm.handleSubmit(handleTermsSubmit)} className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="acceptTerms"
                checked={termsForm.watch("acceptTerms")}
                onCheckedChange={(checked) => termsForm.setValue("acceptTerms", !!checked)}
                className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <div className="text-sm">
                <Label htmlFor="acceptTerms" className="font-normal cursor-pointer">
                  Acepto los{" "}
                  <button type="button" className="text-primary font-medium hover:underline">
                    Términos de Servicio
                  </button>
                </Label>
              </div>
            </div>
            {termsForm.formState.errors.acceptTerms && (
              <p className="text-destructive text-sm">{termsForm.formState.errors.acceptTerms.message}</p>
            )}

            <div className="flex items-start space-x-2">
              <Checkbox
                id="acceptPrivacy"
                checked={termsForm.watch("acceptPrivacy")}
                onCheckedChange={(checked) => termsForm.setValue("acceptPrivacy", !!checked)}
                className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <div className="text-sm">
                <Label htmlFor="acceptPrivacy" className="font-normal cursor-pointer">
                  Acepto la{" "}
                  <button type="button" className="text-primary font-medium hover:underline">
                    Política de Privacidad
                  </button>
                </Label>
              </div>
            </div>
            {termsForm.formState.errors.acceptPrivacy && (
              <p className="text-destructive text-sm">{termsForm.formState.errors.acceptPrivacy.message}</p>
            )}

            <div className="flex items-start space-x-2">
              <Checkbox
                id="subscribeNews"
                checked={termsForm.watch("subscribeNews")}
                onCheckedChange={(checked) => termsForm.setValue("subscribeNews", !!checked)}
                className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label htmlFor="subscribeNews" className="text-sm font-normal cursor-pointer">
                Suscribirme a noticias y actualizaciones de SportMaps
              </Label>
            </div>
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
            <Button type="submit" variant="orange" className="flex-1">
              Finalizar Registro
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  const renderStep4 = () => (
    <Card className="w-full max-w-md mx-auto text-center">
      <CardContent className="pt-8 pb-8">
        <div className="mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">¡Registro Exitoso!</h1>
          <p className="text-muted-foreground">
            Bienvenido a SportMaps. Ahora puedes explorar las actividades para tu atleta.
          </p>
        </div>
        
        <Button 
          variant="orange" 
          className="w-full"
          onClick={() => onNavigate("dashboard")}
        >
          Ir al Dashboard
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-muted/30 py-8" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="container mx-auto px-4 max-w-md">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-center items-center space-x-2 mb-4">
            {[1, 2, 3, 4].map((step) => (
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
                {step < 4 && (
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
            Paso {currentStep} de 4
          </p>
        </div>

        {/* Render current step */}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}

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

export default AthleteRegister;