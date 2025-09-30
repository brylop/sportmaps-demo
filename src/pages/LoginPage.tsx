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
  const [selectedDemoRole, setSelectedDemoRole] = useState<string | null>(null);
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
      gradient: 'from-green-500 to-green-600',
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
      // If a demo role was selected, navigate with that context
      if (selectedDemoRole) {
        navigate('/dashboard', { state: { demoRole: selectedDemoRole } });
      }
    } catch (error) {
      // Error is handled in the context
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoRoleSelect = (roleId: string) => {
    setSelectedDemoRole(roleId);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Iniciar Sesión</CardTitle>
          <CardDescription className="text-center">
            Accede a tu cuenta de SportMaps
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

          <Separator className="my-6" />

          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-1">Explorar Perfiles Demo</h3>
              <p className="text-sm text-muted-foreground">
                Selecciona un rol para ver su perfil y funcionalidades específicas
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {demoRoles.map((role) => {
                const Icon = role.icon;
                const isSelected = selectedDemoRole === role.id;
                
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleDemoRoleSelect(role.id)}
                    className={`relative overflow-hidden rounded-lg p-4 text-left transition-all duration-300 border-2 ${
                      isSelected
                        ? 'border-primary shadow-performance scale-105'
                        : 'border-border hover:border-primary/50 hover:shadow-card'
                    }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${role.gradient} opacity-10 transition-opacity ${
                      isSelected ? 'opacity-20' : ''
                    }`} />
                    <div className="relative z-10 flex flex-col items-center text-center gap-2">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${role.gradient} flex items-center justify-center`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{role.title}</p>
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedDemoRole && (
              <div className="text-center text-sm text-primary animate-in fade-in duration-300">
                ✓ Rol seleccionado. Inicia sesión para acceder al demo completo
              </div>
            )}
          </div>

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
  );
}