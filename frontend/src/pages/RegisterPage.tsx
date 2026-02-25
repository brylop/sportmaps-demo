import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Eye, EyeOff, MailCheck, Mail, School } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { USER_ROLES } from '@/constants/roles';
import { Controller } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';

// Relaxed schema to allow dynamic roles
const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string(),
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z.string().regex(/^\+?[0-9\s-]*$/, 'Formato de teléfono inválido').optional().or(z.literal('')),
  dateOfBirth: z.string().min(1, 'La fecha de nacimiento es requerida'),
  code: z.string().optional(),
  role: z.string().min(1, 'Selecciona un rol'),
  schoolName: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
}).refine((data) => {
  // Soporta tanto 'school' como 'school_admin' para mayor robustez
  if ((data.role === 'school' || data.role === 'school_admin') && (!data.schoolName || data.schoolName.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'El nombre de la academia es requerido para este perfil',
  path: ['schoolName'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface RoleOption {
  id: string;
  name: string;
  display_name: string;
}

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [emailForDisplay, setEmailForDisplay] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Invitation data from URL
  const inviteId = searchParams.get('invite');
  const inviteEmail = searchParams.get('email');
  const inviteRole = searchParams.get('role');
  const [invitationInfo, setInvitationInfo] = useState<{
    school_name: string; role_to_assign: string; child_name?: string;
  } | null>(null);

  const { signUp, user } = useAuth();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      code: searchParams.get('code') || '',
      role: searchParams.get('role') || '',
    }
  });

  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam) {
      setValue('role', roleParam);
    }
    // Pre-fill email from invitation link
    if (inviteEmail) {
      setValue('email', inviteEmail);
    }
  }, [searchParams, setValue, inviteEmail]);

  // Fetch invitation details when invite param is present
  useEffect(() => {
    if (!inviteId) return;
    const fetchInvite = async () => {
      try {
        const { data } = await (supabase.rpc as any)('get_invitation_details', {
          p_invite_id: inviteId
        });

        if (data && data.length > 0) {
          const invite = data[0];
          setInvitationInfo({
            school_name: invite.school_name || 'Tu Academia',
            role_to_assign: invite.role_to_assign,
            child_name: invite.child_name,
          });
        }
      } catch {
        // RLS may block - non-critical
      }
    };
    fetchInvite();
  }, [inviteId]);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from('roles')
          .select('id, name, display_name')
          .eq('is_visible', true)
          .order('display_name');

        if (data) {
          setRoles(data);
        }
      } catch {
        console.error("Error fetching roles");
      }
    };
    fetchRoles();
  }, []);

  // Redirect if already logged in and not just submitted
  if (user && !isSubmitted) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setEmailForDisplay(data.email);
    try {
      // 1. Attempt Registration
      await signUp(data.email, data.password, {
        full_name: data.fullName,
        phone: data.phone,
        date_of_birth: data.dateOfBirth,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: data.role as any,
        invitation_code: data.code,
        school_name: data.schoolName,
      });

      // 2. Set submitted state to show success message
      setIsSubmitted(true);

      // 3. Save invite ID for auto-accept after email verification + login
      if (inviteId) {
        localStorage.setItem('pending_invite_id', inviteId);
      }

    } catch (error: any) {
      console.error("Registration error:", error);

      let errorMessage = "Ha ocurrido un error inesperado. Inténtalo de nuevo.";

      // Mapeo de errores de Supabase Auth
      if (error?.status === 429 || error?.message?.includes('rate limit exceeded')) {
        errorMessage = "Has realizado demasiados intentos. Por favor, espera unos minutos o intenta con otro correo.";
      } else if (error?.message?.includes('User already registered')) {
        errorMessage = "Este correo electrónico ya está registrado.";
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        variant: "destructive",
        title: "Error de registro",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // VISTA PARA USUARIOS YA REGISTRADOS
  if (user && inviteId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#248223]/10 via-background to-[#FB9F1E]/10 p-4">
        <Card className="w-full max-w-md shadow-2xl border-t-8 border-blue-600 animate-in fade-in zoom-in duration-300">
          <CardContent className="pt-10 flex flex-col items-center text-center">
            <div className="bg-blue-100 p-4 rounded-full mb-6">
              <School className="w-12 h-12 text-blue-600" />
            </div>

            <h2 className="text-2xl font-bold font-poppins text-blue-900 mb-2">Invitación Pendiente</h2>

            {invitationInfo ? (
              <>
                <p className="text-muted-foreground font-poppins mb-6">
                  Ya tienes una sesión activa como <strong>{user.email}</strong>.<br />
                  ¿Deseas aceptar la invitación de <strong>{invitationInfo.school_name}</strong> para el perfil de <strong>{
                    invitationInfo.role_to_assign === 'parent' ? 'Padre' :
                      invitationInfo.role_to_assign === 'coach' ? 'Entrenador' :
                        invitationInfo.role_to_assign === 'athlete' ? 'Atleta' :
                          invitationInfo.role_to_assign === 'school_admin' ? 'Administrador de Sede' :
                            invitationInfo.role_to_assign === 'reporter' ? 'Súper Usuario' : 'Invitado'
                  }</strong>?
                </p>

                <div className="flex flex-col gap-3 w-full">
                  <Button
                    onClick={() => navigate('/dashboard')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Ver en mi Panel de Control
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    className="w-full"
                  >
                    <Link to="/dashboard">Ir al Dashboard</Link>
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm text-muted-foreground">Cargando detalles de la invitación...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // REDIRECCIÓN SI YA ESTÁ LOGUEADO (Y NO HAY INVITACIÓN)
  if (user && !inviteId) {
    return <Navigate to="/dashboard" />;
  }

  // VISTA DE ÉXITO (POST-REGISTRO)
  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#248223]/10 via-background to-[#FB9F1E]/10 p-4">
        <Card className="w-full max-w-md shadow-2xl border-t-8 border-[#248223] animate-in fade-in zoom-in duration-300">
          <CardContent className="pt-10 flex flex-col items-center text-center">
            <div className="bg-[#248223]/10 p-4 rounded-full mb-6">
              <MailCheck className="w-12 h-12 text-[#248223]" />
            </div>

            <img
              src="https://luebjarufsiadojhvxgi.supabase.co/storage/v1/object/public/avatars/LOGO.jpg"
              alt="SportMaps"
              className="w-32 mb-6 rounded-lg"
            />

            <h2 className="text-2xl font-bold font-poppins text-[#248223] mb-4">¡Casi listo!</h2>

            <p className="text-muted-foreground font-poppins mb-6">
              Hemos enviado un enlace de verificación a:<br />
              <span className="text-foreground font-semibold">{emailForDisplay}</span>
            </p>

            <div className="bg-[#FB9F1E]/10 border border-[#FB9F1E]/20 p-4 rounded-xl mb-8 text-sm text-[#8a5710]">
              <p className="font-medium">¿No ves el correo?</p>
              <p>Revisa tu carpeta de <strong>Spam</strong> o Promociones. El enlace es necesario para activar tu perfil de {watch('role')}.</p>
            </div>

            <Button asChild variant="outline" className="w-full border-[#248223] text-[#248223] hover:bg-[#248223] hover:text-white transition-colors">
              <Link to="/login">Volver al Inicio de Sesión</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#248223]/5 via-background to-[#FB9F1E]/5 p-4 font-poppins">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-[#248223]">Crear Cuenta</CardTitle>
          <CardDescription className="text-center">
            Únete a la comunidad SportMaps
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Invitation Banner */}
          {invitationInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <School className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-blue-900 text-sm">
                    Invitación de <strong>{invitationInfo.school_name}</strong>
                  </p>
                  <p className="text-xs text-blue-700">
                    Te invitan como <strong>{
                      invitationInfo.role_to_assign === 'parent' ? 'Padre/Madre' :
                        invitationInfo.role_to_assign === 'coach' ? 'Entrenador' :
                          invitationInfo.role_to_assign === 'athlete' ? 'Atleta' :
                            invitationInfo.role_to_assign === 'school_admin' ? 'Administrador de Sede' :
                              invitationInfo.role_to_assign === 'reporter' ? 'Súper Usuario' : 'Invitado'
                    }</strong>
                    {invitationInfo.child_name && <> para <strong>{invitationInfo.child_name}</strong></>}
                  </p>
                </div>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre Completo</Label>
              <Input
                id="fullName"
                autoComplete="name"
                placeholder="Tu nombre completo"
                {...register('fullName')}
                className={errors.fullName ? 'border-destructive' : ''}
              />
              {errors.fullName && (
                <p className="text-sm text-destructive">{errors.fullName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                {...register('email')}
                className={errors.email ? 'border-destructive' : ''}
                readOnly={!!inviteEmail}
                disabled={!!inviteEmail}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono (Opcional)</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+57 300 123 4567"
                {...register('phone')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Fecha de Nacimiento</Label>
              <Input
                id="dateOfBirth"
                type="date"
                autoComplete="bday"
                {...register('dateOfBirth')}
                className={errors.dateOfBirth ? 'border-destructive' : ''}
              />
              {errors.dateOfBirth && (
                <p className="text-sm text-destructive">{errors.dateOfBirth.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Tipo de Usuario</Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="role" className={errors.role ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Selecciona tu rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.length > 0 ? (
                        roles.map((role) => (
                          <SelectItem key={role.id} value={role.name}>
                            {role.display_name}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value={USER_ROLES.ATHLETE}>🏃 Deportista/Atleta</SelectItem>
                          <SelectItem value={USER_ROLES.PARENT}>👨‍👩‍👧 Padre/Madre</SelectItem>
                          <SelectItem value={USER_ROLES.COACH}>🎓 Entrenador/Coach</SelectItem>
                          <SelectItem value={USER_ROLES.SCHOOL_ADMIN}>🏫 Escuela/Centro Deportivo</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && (
                <p className="text-sm text-destructive">{errors.role.message}</p>
              )}
            </div>

            {(watch('role') === USER_ROLES.SCHOOL || watch('role') === USER_ROLES.SCHOOL_ADMIN || watch('role') === 'school') && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label htmlFor="schoolName">Nombre de la Academia</Label>
                <Input
                  id="schoolName"
                  placeholder="Ej: Academia de Tenis Tigres"
                  {...register('schoolName')}
                  className={errors.schoolName ? 'border-destructive' : ''}
                />
                {errors.schoolName && (
                  <p className="text-sm text-destructive">{errors.schoolName.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Crearemos automáticamente tu espacio de trabajo con este nombre.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...register('password')}
                  className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...register('confirmPassword')}
                  className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full bg-[#248223] hover:bg-[#1a5d19] transition-all" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Cuenta
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-[#248223] font-semibold hover:underline">
              Inicia sesión aquí
            </Link>
          </div>

          <div className="mt-2 text-center">
            <Link to="/" className="text-sm text-muted-foreground hover:underline">
              ← Volver al inicio
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}