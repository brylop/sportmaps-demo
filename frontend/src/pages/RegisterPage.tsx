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
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye, EyeOff, MailCheck, Mail, School } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { USER_ROLES } from '@/constants/roles';
import { Controller } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Roles que representan instituciones/negocios (no personas físicas)
const INSTITUTION_ROLES = ['school', 'school_admin', 'store_owner', 'organizer'];

// Relaxed schema to allow dynamic roles
const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string(),
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z.string().regex(/^\+?[0-9\s-]*$/, 'Formato de teléfono inválido').optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  code: z.string().optional(),
  role: z.string().min(1, 'Selecciona un rol'),
  schoolName: z.string().optional(),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'Debes aceptar los términos y condiciones para continuar',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
}).refine((data) => {
  // Fecha de nacimiento requerida solo para usuarios individuales
  if (!INSTITUTION_ROLES.includes(data.role) && (!data.dateOfBirth || data.dateOfBirth.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'La fecha de nacimiento es requerida',
  path: ['dateOfBirth'],
}).refine((data) => {
  // Nombre de academia solo requerido al crear una escuela nueva (role=school)
  if (data.role === 'school' && (!data.schoolName || data.schoolName.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'El nombre de la academia es requerido',
  path: ['schoolName'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface RoleOption {
  id: string;
  name: string;
  display_name: string;
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  athlete: '🏃 Deportista/Atleta',
  parent: '👨‍👩‍👧 Padre/Madre',
  coach: '🎓 Entrenador/Coach',
  school: '🏫 Escuela/Centro Deportivo',
  school_admin: '🏢 Administrador de Sede',
  reporter: '📊 Súper Usuario (Reporter)',
  guest: '👤 Invitado',
  admin: '🛡️ Administrador',
  super_admin: '🛡️ Super Administrador',
  wellness_professional: '💚 Profesional Bienestar',
  store_owner: '🏪 Dueño de Tienda',
  organizer: '📋 Organizador',
};

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [emailForDisplay, setEmailForDisplay] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userExistsError, setUserExistsError] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Invitation data from URL
  const inviteId = searchParams.get('invite');
  const inviteEmail = searchParams.get('email');
  const inviteRole = searchParams.get('role');
  const [invitationInfo, setInvitationInfo] = useState<{
    school_name: string;
    role_to_assign: string;
    child_name?: string;
    program_name?: string;
    monthly_fee?: number;
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
        const { data } = await supabase.rpc('get_invitation_details', {
          p_invite_id: inviteId
        });

        if (data && (data as any).length > 0) {
          const invite = (data as any)[0];
          setInvitationInfo({
            school_name: invite.school_name || 'Tu Academia',
            role_to_assign: invite.role_to_assign,
            child_name: invite.child_name,
            program_name: invite.program_name,
            monthly_fee: invite.monthly_fee,
          });
          // Pre-fill schoolName so la validación pase y el backend tenga contexto
          if (invite.school_name) {
            setValue('schoolName', invite.school_name);
          }
        }
      } catch (err) {
        console.warn('Invitation validation failed or ID is invalid. This is expected if the link is malformed or unauthorized.', err);
      }
    };
    fetchInvite();
  }, [inviteId]);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const { data } = await supabase
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

  // Conflict resolution: If user is logged in but the invite is for a different email, log them out.
  useEffect(() => {
    if (user && inviteEmail && user.email !== inviteEmail && !isSubmitted) {
      supabase.auth.signOut().then(() => {
        window.location.reload();
      });
    }
  }, [user, inviteEmail, isSubmitted]);

  // Redirect if already logged in (and email matches or no invite), and not just submitted
  if (user && !isSubmitted && (!inviteEmail || user.email === inviteEmail)) {
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
        role: data.role as any, // Auth metadata is often dynamic, keeping as any or casting to a wider type
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
      } else if (error?.message?.includes('User already registered') || error?.message?.includes('already exist')) {
        errorMessage = "Este correo electrónico ya está registrado.";
        setUserExistsError(true);
        if (inviteId) {
          localStorage.setItem('pending_invite_id', inviteId);
        }
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

  const handleAcceptLoggedIn = async () => {
    if (!inviteId) return;
    setIsLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('accept_invitation_pro', {
        p_invite_id: inviteId
      });

      if (error) throw error;

      toast({
        title: "¡Configuración lista!",
        description: "Se ha vinculado tu perfil y sincronizado tu nuevo rol. Redirigiendo...",
      });

      // Clear pending invite from storage
      localStorage.removeItem('pending_invite_id');

      // Force a full reload to ensure the AuthContext picks up the new role from DB
      window.location.href = '/dashboard';
    } catch (err: any) {
      toast({
        title: "Error al aceptar",
        description: err.message || "No se pudo procesar la invitación.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // VISTA PARA USUARIOS YA REGISTRADOS
  if (user && inviteId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#248223]/10 via-background to-[#FB9F1E]/10 p-4">
        <Card className="w-full max-w-md shadow-2xl border-t-8 border-primary animate-in fade-in zoom-in duration-300">
          <CardContent className="pt-10 flex flex-col items-center text-center">
            <div className="bg-primary/10 p-4 rounded-full mb-6">
              <School className="w-12 h-12 text-primary" />
            </div>

            <h2 className="text-2xl font-bold font-poppins text-foreground mb-2">Invitación Pendiente</h2>

            {invitationInfo ? (
              <>
                <p className="text-muted-foreground font-poppins mb-6">
                  Ya tienes una sesión activa como <strong className="text-primary">{user.email}</strong>.<br />
                  ¿Deseas aceptar la invitación de <strong className="text-primary">{invitationInfo.school_name}</strong> para el perfil de <strong>{
                    invitationInfo.role_to_assign === 'parent' ? 'Padre' :
                      invitationInfo.role_to_assign === 'coach' ? 'Entrenador' :
                        invitationInfo.role_to_assign === 'athlete' ? 'Atleta' :
                          invitationInfo.role_to_assign === 'school_admin' ? 'Administrador de Sede' :
                            invitationInfo.role_to_assign === 'reporter' ? 'Súper Usuario' : 'Invitado'
                  }</strong>?
                </p>

                <div className="flex flex-col gap-3 w-full">
                  <Button
                    onClick={handleAcceptLoggedIn}
                    disabled={isLoading}
                    className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 h-12 text-lg font-bold"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                    Aceptar Invitación Ahora
                  </Button>

                  <Button
                    asChild
                    variant="ghost"
                    className="w-full text-muted-foreground hover:text-primary"
                  >
                    <Link to="/dashboard">Ir al Dashboard directamente</Link>
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Validando invitación...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
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
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <School className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    Invitación de <strong className="text-primary">{invitationInfo.school_name}</strong>
                  </p>
                  <p className="text-xs text-primary/80">
                    Te invitan como <strong>{
                      invitationInfo.role_to_assign === 'parent' ? 'Padre/Madre' :
                        invitationInfo.role_to_assign === 'coach' ? 'Entrenador' :
                          invitationInfo.role_to_assign === 'athlete' ? 'Atleta' :
                            invitationInfo.role_to_assign === 'school_admin' ? 'Administrador de Sede' :
                              invitationInfo.role_to_assign === 'reporter' ? 'Súper Usuario' : 'Invitado'
                    }</strong>
                    {invitationInfo.child_name && <> para <strong className="text-primary">{invitationInfo.child_name}</strong></>}
                  </p>
                  {invitationInfo.program_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Equipo asignado: <strong>{invitationInfo.program_name}</strong>
                    </p>
                  )}
                  {invitationInfo.monthly_fee != null && invitationInfo.monthly_fee > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Mensualidad: <strong>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(invitationInfo.monthly_fee)}/mes</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {userExistsError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-4 animate-in fade-in zoom-in duration-300">
              <div className="flex items-center gap-2 text-destructive mb-2">
                <AlertCircle className="w-5 h-5" />
                <p className="font-semibold">Cuenta ya registrada</p>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Este correo electrónico ya existe en SportMaps. Por favor, inicia sesión para continuar y aceptar la invitación.
              </p>
              <Button asChild className="w-full bg-primary text-white hover:bg-primary/90 shadow-md">
                <Link to={`/login?email=${encodeURIComponent(watch('email'))}${inviteId ? `&invite=${inviteId}` : ''}`}>
                  Inicia sesión para continuar
                </Link>
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className={cn("space-y-4", userExistsError ? "opacity-50 pointer-events-none" : "")}>
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

            {!INSTITUTION_ROLES.includes(watch('role')) && (
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Fecha de Nacimiento</Label>
                <Controller
                  name="dateOfBirth"
                  control={control}
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground",
                            errors.dateOfBirth && "border-destructive"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(new Date(field.value + 'T00:00:00'), "PPP", { locale: es })
                          ) : (
                            <span>Selecciona tu fecha</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value + 'T00:00:00') : undefined}
                          onSelect={(date) => {
                            if (date) {
                              // Save as YYYY-MM-DD
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              field.onChange(`${year}-${month}-${day}`);
                            }
                          }}
                          captionLayout="dropdown-buttons"
                          fromYear={1920}
                          toYear={new Date().getFullYear()}
                          locale={es}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1920-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
                {errors.dateOfBirth && (
                  <p className="text-sm text-destructive">{errors.dateOfBirth.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="role">Tipo de Usuario</Label>
              {inviteRole ? (
                /* When coming from an invitation, lock the role */
                <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/50">
                  <span className="text-sm font-medium">
                    {ROLE_DISPLAY_NAMES[inviteRole] || inviteRole}
                  </span>
                  <Badge variant="outline" className="ml-auto text-xs">Asignado por invitación</Badge>
                </div>
              ) : (
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
                          roles
                            .filter(r => !['admin', 'super_admin', 'reporter', 'school_admin'].includes(r.name))
                            .map((role) => (
                              <SelectItem key={role.id} value={role.name}>
                                {role.display_name}
                              </SelectItem>
                            ))
                        ) : (
                          <>
                            <SelectItem value={USER_ROLES.ATHLETE}>🏃 Deportista/Atleta</SelectItem>
                            <SelectItem value={USER_ROLES.PARENT}>👨‍👩‍👧 Padre/Madre</SelectItem>
                            <SelectItem value={USER_ROLES.COACH}>🎓 Entrenador/Coach</SelectItem>
                            <SelectItem value="school">🏫 Escuela/Centro Deportivo</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
              {errors.role && (
                <p className="text-sm text-destructive">{errors.role.message}</p>
              )}
            </div>

            {(watch('role') === USER_ROLES.SCHOOL || watch('role') === 'school') && !inviteId && (
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

            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <input
                  id="acceptTerms"
                  type="checkbox"
                  {...register('acceptTerms')}
                  className="mt-1 h-4 w-4 rounded border-gray-300 accent-[#248223] cursor-pointer"
                />
                <label htmlFor="acceptTerms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                  Acepto los{' '}
                  <a href="/terminos-y-condiciones" target="_blank" className="text-[#248223] font-semibold hover:underline">
                    Términos y Condiciones
                  </a>{' '}
                  y la{' '}
                  <a href="/politica-de-privacidad" target="_blank" className="text-[#248223] font-semibold hover:underline">
                    Política de Privacidad
                  </a>{' '}
                  de SportMaps.
                </label>
              </div>
              {errors.acceptTerms && (
                <p className="text-sm text-destructive">{errors.acceptTerms.message}</p>
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