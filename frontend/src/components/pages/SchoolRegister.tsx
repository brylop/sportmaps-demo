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
import { ArrowLeft, School, Upload, FileCheck } from "lucide-react";

interface SchoolRegisterProps {
  onNavigate: (page: string) => void;
}

// Validation schemas for each step
const legalInfoSchema = z.object({
  legalName: z.string().min(2, "Nombre legal es requerido"),
  taxId: z.string().min(5, "NIT/RUC es requerido"),
  address: z.string().min(10, "Dirección completa es requerida"),
  phone: z.string().min(10, "Teléfono debe tener al menos 10 dígitos"),
  country: z.string().min(2, "Selecciona un país"),
  city: z.string().min(2, "Selecciona una ciudad")
});

const adminContactSchema = z.object({
  adminName: z.string().min(2, "Nombre del administrador es requerido"),
  position: z.string().min(2, "Cargo es requerido"),
  adminEmail: z.string().email("Email inválido")
});

const organizationTypeSchema = z.object({
  orgType: z.string().min(1, "Selecciona el tipo de organización"),
  sports: z.array(z.string()).min(1, "Selecciona al menos un deporte")
});

const documentsSchema = z.object({
  legalDocument: z.any().optional(),
  logoFile: z.any().optional()
});

const SchoolRegister = ({ onNavigate }: SchoolRegisterProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [legalData, setLegalData] = useState<any>({});
  const [adminData, setAdminData] = useState<any>({});
  const [orgData, setOrgData] = useState<any>({});
  const [documentsData, setDocumentsData] = useState<any>({});
  const [selectedSports, setSelectedSports] = useState<string[]>([]);

  const legalForm = useForm({
    resolver: zodResolver(legalInfoSchema),
    defaultValues: {
      legalName: "",
      taxId: "",
      address: "",
      phone: "",
      country: "",
      city: ""
    }
  });

  const adminForm = useForm({
    resolver: zodResolver(adminContactSchema),
    defaultValues: {
      adminName: "",
      position: "",
      adminEmail: ""
    }
  });

  const orgForm = useForm({
    resolver: zodResolver(organizationTypeSchema),
    defaultValues: {
      orgType: "",
      sports: []
    }
  });

  const documentsForm = useForm({
    resolver: zodResolver(documentsSchema)
  });

  const handleLegalSubmit = (data: any) => {
    setLegalData(data);
    setCurrentStep(2);
  };

  const handleAdminSubmit = (data: any) => {
    setAdminData(data);
    setCurrentStep(3);
  };

  const handleOrgSubmit = (data: any) => {
    setOrgData({...data, sports: selectedSports});
    setCurrentStep(4);
  };

  const handleDocumentsSubmit = (data: any) => {
    // Here you would typically send all data to Supabase
    console.log("Complete school registration:", { ...legalData, ...adminData, ...orgData, sports: selectedSports, ...data });
    setCurrentStep(5);
  };

  const handleSportToggle = (sport: string) => {
    setSelectedSports(prev => 
      prev.includes(sport) 
        ? prev.filter(s => s !== sport)
        : [...prev, sport]
    );
  };

  const sportsList = [
    "Fútbol", "Baloncesto", "Voleibol", "Tenis", "Natación", 
    "Atletismo", "Gimnasia", "Balonmano", "Hockey", "CrossFit",
    "Artes Marciales", "Ciclismo", "Padel", "Squash", "Multideporte"
  ];

  const renderStep1 = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Información Legal de la Entidad</CardTitle>
        <p className="text-muted-foreground">Datos oficiales para la verificación</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={legalForm.handleSubmit(handleLegalSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="legalName">Nombre Legal Completo</Label>
            <Input
              id="legalName"
              placeholder="Nombre completo según documentos legales"
              {...legalForm.register("legalName")}
              className="focus:border-primary focus:ring-primary"
            />
            {legalForm.formState.errors.legalName && (
              <p className="text-destructive text-sm">{legalForm.formState.errors.legalName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="taxId">NIT/RUC</Label>
            <Input
              id="taxId"
              placeholder="Número de identificación tributaria"
              {...legalForm.register("taxId")}
              className="focus:border-primary focus:ring-primary"
            />
            {legalForm.formState.errors.taxId && (
              <p className="text-destructive text-sm">{legalForm.formState.errors.taxId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Dirección Física</Label>
            <Input
              id="address"
              placeholder="Dirección completa de las instalaciones"
              {...legalForm.register("address")}
              className="focus:border-primary focus:ring-primary"
            />
            {legalForm.formState.errors.address && (
              <p className="text-destructive text-sm">{legalForm.formState.errors.address.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono Principal</Label>
            <Input
              id="phone"
              placeholder="Teléfono de contacto principal"
              {...legalForm.register("phone")}
              className="focus:border-primary focus:ring-primary"
            />
            {legalForm.formState.errors.phone && (
              <p className="text-destructive text-sm">{legalForm.formState.errors.phone.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">País</Label>
              <Select onValueChange={(value) => legalForm.setValue("country", value)}>
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
                {...legalForm.register("city")}
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
        <CardTitle className="text-2xl font-bold">Administrador de la Cuenta</CardTitle>
        <p className="text-muted-foreground">Persona de contacto principal para la gestión de la escuela</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={adminForm.handleSubmit(handleAdminSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adminName">Nombre y Apellido del Administrador</Label>
            <Input
              id="adminName"
              placeholder="Nombre completo del responsable"
              {...adminForm.register("adminName")}
              className="focus:border-primary focus:ring-primary"
            />
            {adminForm.formState.errors.adminName && (
              <p className="text-destructive text-sm">{adminForm.formState.errors.adminName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Cargo</Label>
            <Input
              id="position"
              placeholder="Ej: Director, Coordinador Deportivo"
              {...adminForm.register("position")}
              className="focus:border-primary focus:ring-primary"
            />
            {adminForm.formState.errors.position && (
              <p className="text-destructive text-sm">{adminForm.formState.errors.position.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminEmail">Email de Contacto Directo</Label>
            <Input
              id="adminEmail"
              type="email"
              placeholder="email@institucion.com"
              {...adminForm.register("adminEmail")}
              className="focus:border-primary focus:ring-primary"
            />
            {adminForm.formState.errors.adminEmail && (
              <p className="text-destructive text-sm">{adminForm.formState.errors.adminEmail.message}</p>
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
        <CardTitle className="text-2xl font-bold">Actividades y Deportes</CardTitle>
        <p className="text-muted-foreground">Define tu tipo de organización y los deportes que ofreces</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={orgForm.handleSubmit(handleOrgSubmit)} className="space-y-6">
          <div className="space-y-3">
            <Label>Tipo de Organización</Label>
            <Select onValueChange={(value) => orgForm.setValue("orgType", value)}>
              <SelectTrigger className="focus:border-primary focus:ring-primary">
                <SelectValue placeholder="Selecciona el tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="escuela">Escuela Deportiva</SelectItem>
                <SelectItem value="club">Club Deportivo</SelectItem>
                <SelectItem value="academia">Academia</SelectItem>
                <SelectItem value="gimnasio">Gimnasio/Centro Fitness</SelectItem>
                <SelectItem value="universidad">Universidad/Colegio</SelectItem>
                <SelectItem value="federacion">Federación/Liga</SelectItem>
              </SelectContent>
            </Select>
            {orgForm.formState.errors.orgType && (
              <p className="text-destructive text-sm">{orgForm.formState.errors.orgType.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Deportes que Ofreces</Label>
            <p className="text-sm text-muted-foreground">Selecciona todos los deportes disponibles en tu institución</p>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {sportsList.map((sport) => (
                <div key={sport} className="flex items-center space-x-2">
                  <Checkbox
                    id={sport}
                    checked={selectedSports.includes(sport)}
                    onCheckedChange={() => handleSportToggle(sport)}
                    className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <Label htmlFor={sport} className="text-sm cursor-pointer">
                    {sport}
                  </Label>
                </div>
              ))}
            </div>
            {selectedSports.length === 0 && (
              <p className="text-destructive text-sm">Selecciona al menos un deporte</p>
            )}
            <p className="text-xs text-muted-foreground">
              Deportes seleccionados: {selectedSports.length}
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
            <Button 
              type="submit" 
              className="flex-1" 
              variant="default"
              disabled={selectedSports.length === 0}
            >
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
        <CardTitle className="text-2xl font-bold">Documentos de la Entidad</CardTitle>
        <p className="text-muted-foreground">Sube el certificado de existencia legal y el logo de tu organización</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={documentsForm.handleSubmit(handleDocumentsSubmit)} className="space-y-6">
          <div className="space-y-3">
            <Label>Certificado de Existencia Legal</Label>
            <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <Upload className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Certificado de existencia y representación legal
              </p>
              <Button type="button" variant="outline" size="sm" className="border-primary text-primary">
                Seleccionar Archivo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Formatos aceptados: PDF, JPG, PNG. Tamaño máximo: 5MB
            </p>
          </div>

          <div className="space-y-3">
            <Label>Logo de la Institución</Label>
            <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <Upload className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Logo oficial de tu organización
              </p>
              <Button type="button" variant="outline" size="sm" className="border-primary text-primary">
                Seleccionar Imagen
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Formatos aceptados: JPG, PNG, SVG. Resolución recomendada: 500x500px
            </p>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Nota:</strong> La aprobación puede tardar hasta 48 horas. Te contactaremos por email una vez revisada tu solicitud.
            </p>
          </div>

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
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">¡Tu Solicitud está en Revisión!</h1>
          <p className="text-muted-foreground">
            Gracias por querer formar parte de SportMaps. Te contactaremos pronto con el estado de tu solicitud.
          </p>
        </div>
        
        <div className="space-y-3 mb-6">
          <div className="bg-muted/50 p-4 rounded-lg text-left">
            <h4 className="font-semibold text-sm mb-2">Próximos pasos:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Revisión de documentos (24-48 horas)</li>
              <li>• Verificación de información legal</li>
              <li>• Activación de tu cuenta institucional</li>
              <li>• Acceso completo al panel administrativo</li>
            </ul>
          </div>
        </div>
        
        <Button 
          variant="default" 
          className="w-full mb-3"
          onClick={() => onNavigate("dashboard")}
        >
          Ir al Panel de Administración
        </Button>
        
        <p className="text-xs text-muted-foreground">
          Panel limitado hasta aprobación completa
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

export default SchoolRegister;