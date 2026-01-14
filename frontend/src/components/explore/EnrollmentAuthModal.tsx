import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Lock, Mail, User, Users, UserCircle } from 'lucide-react';
import { savePendingEnrollment } from '@/lib/pending-enrollment';

interface EnrollmentAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program?: {
    id: string;
    name: string;
    price: number;
  };
  school?: {
    id: string;
    name: string;
  };
}

export function EnrollmentAuthModal({ open, onOpenChange, program, school }: EnrollmentAuthModalProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('register');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'parent' | 'athlete'>('parent');
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');

  const handleSuccess = () => {
    // Guardar inscripción pendiente en localStorage
    if (program && school) {
      savePendingEnrollment({
        programId: program.id,
        programName: program.name,
        schoolId: school.id,
        schoolName: school.name,
        amount: program.price,
      });
    }

    onOpenChange(false);
    
    // Redirigir al dashboard donde se detectará la inscripción pendiente
    navigate('/dashboard');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(loginEmail, loginPassword);
      toast({
        title: '¡Bienvenido!',
        description: 'Has iniciado sesión correctamente',
      });
      handleSuccess();
    } catch (error: any) {
      toast({
        title: 'Error al iniciar sesión',
        description: error.message || 'Ocurrió un error al iniciar sesión',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (registerPassword !== registerConfirmPassword) {
      toast({
        title: 'Error',
        description: 'Las contraseñas no coinciden',
        variant: 'destructive',
      });
      return;
    }

    if (registerPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'La contraseña debe tener al menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      await signUp(registerEmail, registerPassword, {
        full_name: registerName,
        role: selectedRole
      });

      toast({
        title: '¡Registro exitoso!',
        description: 'Tu cuenta ha sido creada correctamente',
      });

      handleSuccess();
    } catch (error: any) {
      toast({
        title: 'Error al registrarse',
        description: error.message || 'Ocurrió un error al registrarse',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md font-poppins">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {program ? 'Continuar con tu inscripción' : 'Inicia sesión para continuar'}
          </DialogTitle>
          <DialogDescription>
            {program 
              ? `Para inscribirte en "${program.name}", necesitas crear una cuenta o iniciar sesión`
              : 'Para reservar en esta academia, necesitas crear una cuenta o iniciar sesión'
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'register')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="register" className="font-semibold">Registrarse</TabsTrigger>
            <TabsTrigger value="login" className="font-semibold">Iniciar Sesión</TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="space-y-4 mt-6">
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Role Selection */}
              <div className="space-y-3">
                <Label className="font-semibold">¿Cómo te registras?</Label>
                <RadioGroup 
                  value={selectedRole} 
                  onValueChange={(v) => setSelectedRole(v as 'parent' | 'athlete')}
                  className="grid grid-cols-2 gap-3"
                >
                  <div
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedRole === 'parent'
                        ? 'border-[#248223] bg-[#248223]/5'
                        : 'border-border hover:border-[#248223]/50'
                    }`}
                    onClick={() => setSelectedRole('parent')}
                  >
                    <RadioGroupItem value="parent" id="parent" className="sr-only" />
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      selectedRole === 'parent' ? 'bg-[#248223]' : 'bg-muted'
                    }`}>
                      <Users className={`w-6 h-6 ${selectedRole === 'parent' ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm">Padre/Madre</p>
                      <p className="text-xs text-muted-foreground">Gestiono la actividad de mis hijos</p>
                    </div>
                  </div>
                  
                  <div
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedRole === 'athlete'
                        ? 'border-[#FB9F1E] bg-[#FB9F1E]/5'
                        : 'border-border hover:border-[#FB9F1E]/50'
                    }`}
                    onClick={() => setSelectedRole('athlete')}
                  >
                    <RadioGroupItem value="athlete" id="athlete" className="sr-only" />
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      selectedRole === 'athlete' ? 'bg-[#FB9F1E]' : 'bg-muted'
                    }`}>
                      <UserCircle className={`w-6 h-6 ${selectedRole === 'athlete' ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm">Deportista</p>
                      <p className="text-xs text-muted-foreground">Soy el atleta que entrena</p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-name">Nombre completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="register-name"
                    type="text"
                    placeholder="Tu nombre completo"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="pl-9 pr-9"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-confirm-password">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="register-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-bold"
                style={{ backgroundColor: selectedRole === 'parent' ? '#248223' : '#FB9F1E' }}
                disabled={loading}
              >
                {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="login" className="space-y-4 mt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="pl-9 pr-9"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-bold bg-[#248223] hover:bg-[#248223]/90" 
                disabled={loading}
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
