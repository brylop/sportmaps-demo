import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Eye, EyeOff, Users, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useEffect } from 'react';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { user, signIn } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const inviteEmail = searchParams.get('email');
  const inviteId = searchParams.get('invite');

  useEffect(() => {
    if (inviteId) {
      localStorage.setItem('pending_invite_id', inviteId);
    }
  }, [inviteId]);

  const from = location.state?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: {
      email: inviteEmail || '',
    }
  });

  // Redirect if already logged in
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !resetEmail.includes('@')) {
      toast({
        title: 'Correo inválido',
        description: 'Por favor ingresa un correo electrónico válido.',
        variant: 'destructive',
      });
      return;
    }

    setResetSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setResetSent(true);
      toast({
        title: '¡Correo enviado!',
        description: 'Revisa tu bandeja de entrada (y spam) para restablecer tu contraseña.',
      });
    } catch (error: any) {
      console.error('Error sending reset email:', error);
      toast({
        title: 'Error al enviar el correo',
        description: error.message || 'No se pudo enviar el correo de recuperación. Intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setResetSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        <Card className="w-full max-w-md mx-auto border-2 shadow-lg">
          {showForgotPassword ? (
            /* ── Forgot Password View ── */
            <>
              <CardHeader className="space-y-1">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    {resetSent ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    ) : (
                      <Mail className="w-6 h-6 text-primary" />
                    )}
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-center">
                  {resetSent ? '¡Correo Enviado!' : 'Recuperar Contraseña'}
                </CardTitle>
                <CardDescription className="text-center">
                  {resetSent
                    ? 'Revisa tu bandeja de entrada y haz clic en el enlace para restablecer tu contraseña.'
                    : 'Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {resetSent ? (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 text-center">
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Se envió un enlace de recuperación a <strong>{resetEmail}</strong>.
                        Puede tardar unos minutos en llegar. Revisa también tu carpeta de spam.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setResetSent(false);
                        setResetEmail('');
                      }}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Volver al inicio de sesión
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Correo Electrónico</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        placeholder="tu@email.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        disabled={resetSending}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={resetSending}>
                      {resetSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Enviar enlace de recuperación
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setResetEmail('');
                      }}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Volver al inicio de sesión
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          ) : (
            /* ── Login View ── */
            <>
              <CardHeader className="space-y-1">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                </div>
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
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="tu@email.com"
                      {...register('email')}
                      className={errors.email ? 'border-destructive' : ''}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Contraseña</Label>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs text-primary hover:underline"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
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
            </>
          )}
        </Card>
      </div>
    </div>
  );
}