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
import { Separator } from '@/components/ui/separator';
import { Loader2, Eye, EyeOff, Users, GraduationCap, School, User } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user, signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const from = location.state?.from?.pathname || '/dashboard';

  const demoRoles = [
    {
      id: 'parent',
      title: 'Padre',
      description: 'Gestión familiar',
      icon: Users,
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      id: 'coach',
      title: 'Entrenador',
      description: 'Clases y agenda',
      icon: GraduationCap,
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      id: 'school',
      title: 'Escuela',
      description: 'Gestión completa',
      icon: School,
      gradient: 'from-purple-500 to-purple-600',
    },
    {
      id: 'athlete',
      title: 'Deportista',
      description: 'Perfil atlético',
      icon: User,
      gradient: 'from-orange-500 to-orange-600',
    },
  ];

  // Redirect if already logged in
  if (user) {
    return <Navigate to={from} replace />;
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

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

  const handleDemoAccess = (roleId: string) => {
    // Navigate to dashboard with demo mode
    navigate('/dashboard', { state: { demoMode: true, demoRole: roleId } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4 py-12">
      <div className="w-full max-w-5xl space-y-6">
        {/* Demo Section - Top */}
        <Card className="w-full bg-gradient-to-br from-primary/5 to-secondary/5">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold mb-2">Explorar Perfiles Demo</h3>
              <p className="text-muted-foreground">
                Selecciona un rol para ver su perfil y funcionalidades específicas
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {demoRoles.map((role) => {
                const Icon = role.icon;
                
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleDemoAccess(role.id)}
                    className="relative overflow-hidden rounded-xl p-6 text-center transition-all duration-300 border-2 border-border hover:border-primary hover:shadow-performance hover:scale-105 bg-background"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${role.gradient} opacity-10 transition-opacity hover:opacity-20`} />
                    <div className="relative z-10 flex flex-col items-center gap-3">
                      <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${role.gradient} flex items-center justify-center shadow-lg`}>
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-base mb-1">{role.title}</p>
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Login Section - Bottom */}
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Iniciar Sesión</CardTitle>
            <CardDescription className="text-center">
              ¿Ya tienes cuenta? Accede con tus credenciales
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