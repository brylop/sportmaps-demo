import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Eye, EyeOff, Users, GraduationCap, School, UserCircle, Heart, Store } from 'lucide-react';
import { getDemoUser } from '@/lib/demo-credentials';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const demoRoles = [
  {
    id: 'parent',
    title: 'Padre/Madre',
    description: 'Gestión familiar',
    email: 'maria.garcia@demo.sportmaps.com',
    icon: Users,
    color: 'bg-blue-500',
    border: 'border-blue-500',
  },
  {
    id: 'coach',
    title: 'Entrenador',
    description: 'Clases y agenda',
    email: 'luis.rodriguez@demo.sportmaps.com',
    icon: GraduationCap,
    color: 'bg-emerald-500',
    border: 'border-emerald-500',
  },
  {
    id: 'school',
    title: 'Escuela',
    description: 'Gestión completa',
    email: 'academia.elite@demo.sportmaps.com',
    icon: School,
    color: 'bg-purple-500',
    border: 'border-purple-500',
  },
  {
    id: 'athlete',
    title: 'Deportista',
    description: 'Perfil atlético',
    email: 'carlos.martinez@demo.sportmaps.com',
    icon: UserCircle,
    color: 'bg-orange-500',
    border: 'border-orange-500',
  },
  {
    id: 'wellness_professional',
    title: 'Profesional Bienestar',
    description: 'Salud y rendimiento',
    email: 'sofia.rivera@demo.sportmaps.com',
    icon: Heart,
    color: 'bg-pink-500',
    border: 'border-pink-500',
  },
  {
    id: 'store_owner',
    title: 'Tienda/Vendedor',
    description: 'Productos deportivos',
    email: 'info.equipatemas@demo.sportmaps.com',
    icon: Store,
    color: 'bg-cyan-500',
    border: 'border-cyan-500',
  },
];

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState<string | null>(null);
  const { user, signIn, signUp } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const from = location.state?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  if (user) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
    } catch (error) {
      // Error is handled in the context
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoAccess = async (roleId: string) => {
    const demoUser = getDemoUser(roleId);
    if (!demoUser) return;

    setIsDemoLoading(roleId);
    
    try {
      try {
        await signIn(demoUser.email, demoUser.password);
        toast({
          title: "Acceso demo exitoso",
          description: `Bienvenido al perfil demo de ${demoUser.fullName}`,
        });
        navigate('/dashboard');
      } catch (signInError: any) {
        if (signInError.message.includes('Invalid') || signInError.message.includes('not found')) {
          await signUp(demoUser.email, demoUser.password, {
            full_name: demoUser.fullName,
            role: demoUser.role as any,
          });
          
          await signIn(demoUser.email, demoUser.password);
          
          toast({
            title: "Demo creado y activado",
            description: `Bienvenido al perfil demo de ${demoUser.fullName}`,
          });
          navigate('/dashboard');
        } else {
          throw signInError;
        }
      }
    } catch (error: any) {
      console.error('Error accessing demo:', error);
      toast({
        title: "Error al acceder al demo",
        description: error.message || "Por favor intenta de nuevo",
        variant: "destructive",
      });
    } finally {
      setIsDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Demo Section - Top */}
        <Card className="w-full border-2 border-primary/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold text-center">Explorar Perfiles Demo</CardTitle>
            <CardDescription className="text-center">
              Selecciona un rol para probar sus funcionalidades
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {demoRoles.map((role) => {
                const Icon = role.icon;
                
                return (
                  <div
                    key={role.id}
                    className={`relative overflow-hidden rounded-lg p-3 text-center transition-all duration-200 border-2 hover:border-primary hover:shadow-lg bg-card group ${
                      isDemoLoading === role.id ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-12 h-12 ${role.color} rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                        {isDemoLoading === role.id ? (
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        ) : (
                          <Icon className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-xs">{role.title}</p>
                        <p className="text-[10px] text-muted-foreground">{role.description}</p>
                      </div>
                      <p className="text-[9px] text-muted-foreground break-all leading-tight">
                        {role.email}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs h-7 border-primary/50 hover:bg-primary hover:text-primary-foreground"
                        onClick={() => handleDemoAccess(role.id)}
                        disabled={isDemoLoading === role.id}
                      >
                        {isDemoLoading === role.id ? 'Cargando...' : 'Probar Perfil'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Login Section - Bottom */}
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Iniciar Sesión</CardTitle>
            <CardDescription className="text-center">
              Accede con tus credenciales
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  {...register('email')}
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...register('password')}
                    className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Iniciar Sesión
              </Button>
            </form>

            <div className="mt-6 text-center text-sm space-y-2">
              <div>
                ¿No tienes cuenta?{' '}
                <Link to="/register" className="text-primary hover:underline">
                  Regístrate aquí
                </Link>
              </div>
              <div>
                <Link to="/" className="text-muted-foreground hover:underline">
                  ← Volver al inicio
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}