import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, Eye, EyeOff, MailCheck, Mail, School, Check, ChevronsUpDown, Search, User, Phone, Lock, Calendar as CalendarIcon, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { USER_ROLES } from '@/constants/roles';
import { Controller } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useInvitationBranding } from '@/hooks/useInvitationBranding';
import { getUserFriendlyError } from '@/lib/error-translator';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import sportsData from '@/lib/constants/deportes_globales_categorias.json';

// Roles que representan instituciones/negocios (no personas físicas)
const INSTITUTION_ROLES = ['school', 'school_admin', 'store_owner', 'organizer'];

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
  sportId: z.number().optional(),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'Debes aceptar los términos y condiciones para continuar',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
}).refine((data) => {
  if (!INSTITUTION_ROLES.includes(data.role) && (!data.dateOfBirth || data.dateOfBirth.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'La fecha de nacimiento es requerida',
  path: ['dateOfBirth'],
}).refine((data) => {
  if (data.role === 'school' && (!data.schoolName || data.schoolName.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'El nombre de la academia es requerido',
  path: ['schoolName'],
}).refine((data) => {
  if (data.role === 'school' && !data.sportId) {
    return false;
  }
  return true;
}, {
  message: 'El deporte es requerido para academias',
  path: ['sportId'],
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
  
  const [pwStrength, setPwStrength] = useState(0);
  const checkPw = (val: string) => {
    let strength = 0;
    if (val.length >= 8) strength++;
    if (val.length >= 12) strength++;
    if (/[A-Z]/.test(val) && /[0-9]/.test(val)) strength++;
    if (/[^A-Za-z0-9]/.test(val)) strength++;
    setPwStrength(strength);
  };

  const [sportOpen, setSportOpen] = useState(false);
  const allSports = useMemo(() => sportsData.deportes || [], []);
  
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

  const inviteBranding = useInvitationBranding(inviteId);

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
      sportId: undefined,
    }
  });

  const selectedSportId = watch('sportId');
  const selectedSport = useMemo(() => 
    allSports.find(s => s.id === selectedSportId), 
    [selectedSportId, allSports]
  );

  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam) {
      setValue('role', roleParam);
    }
    if (inviteEmail) {
      setValue('email', inviteEmail);
    }
  }, [searchParams, setValue, inviteEmail]);

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
          if (invite.school_name) {
            setValue('schoolName', invite.school_name);
          }
        }
      } catch (err) {
        console.warn('Invitation validation failed or ID is invalid.', err);
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
        if (data) setRoles(data);
      } catch {
        console.error("Error fetching roles");
      }
    };
    fetchRoles();
  }, []);

  useEffect(() => {
    if (user && inviteEmail && user.email !== inviteEmail && !isSubmitted) {
      supabase.auth.signOut().then(() => { window.location.reload(); });
    }
  }, [user, inviteEmail, isSubmitted]);

  if (user && !isSubmitted && (!inviteEmail || user.email === inviteEmail)) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setEmailForDisplay(data.email);
    try {
      const metadata: any = {
        full_name: data.fullName,
        phone: data.phone,
        date_of_birth: data.dateOfBirth,
        role: data.role as any,
        invitation_code: data.code,
        school_name: data.schoolName,
      };

      if (data.role === 'school' && selectedSport) {
        metadata.sport_id = selectedSport.id;
        metadata.sport_name = selectedSport.nombre;
        const defaultCategories = [];
        if (selectedSport.categorias_competencia) {
          for (const key in selectedSport.categorias_competencia) {
            if (Array.isArray(selectedSport.categorias_competencia[key])) {
              defaultCategories.push(...selectedSport.categorias_competencia[key]);
            }
          }
        }
        metadata.suggested_categories = defaultCategories.slice(0, 10);
      }

      await signUp(data.email, data.password, metadata);
      setIsSubmitted(true);

      if (inviteId) {
        localStorage.setItem('pending_invite_id', inviteId);
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      if (error?.message?.includes('User already registered') || error?.message?.includes('already exist')) {
        setUserExistsError(true);
        if (inviteId) localStorage.setItem('pending_invite_id', inviteId);
      }
      toast({
        variant: "destructive",
        title: "Error de registro",
        description: getUserFriendlyError(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptLoggedIn = async () => {
    if (!inviteId) return;
    setIsLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('accept_invitation_pro', { p_invite_id: inviteId });
      if (error) throw error;
      toast({ title: "¡Configuración lista!", description: "Se ha vinculado tu perfil. Redirigiendo..." });
      localStorage.removeItem('pending_invite_id');
      window.location.href = '/dashboard';
    } catch (err: any) {
      toast({ title: "Error al aceptar", description: getUserFriendlyError(err), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (user && inviteId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1a0d] p-4 font-poppins">
        <Card className="w-full max-w-md shadow-2xl border-t-8 border-[#248223] bg-[#0f2614] text-[#f5f7f2] animate-in fade-in zoom-in duration-300">
          <CardContent className="pt-10 flex flex-col items-center text-center">
            <div className="flex justify-center mb-6">
              {inviteBranding?.logo_url ? (
                <img src={inviteBranding.logo_url} alt="Logo de la Academia" className="h-16 w-auto object-contain" />
              ) : (
                <div className="bg-[#248223]/20 p-4 rounded-full">
                  <School className="w-12 h-12 text-[#2ea82d]" />
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold mb-2">Invitación Pendiente</h2>
            {invitationInfo ? (
              <>
                <p className="text-[#8a9186] mb-6">
                  Ya tienes una sesión activa como <strong className="text-[#2ea82d]">{user.email}</strong>.<br />
                  ¿Deseas aceptar la invitación de <strong className="text-[#2ea82d]">{invitationInfo.school_name}</strong>?
                </p>
                <div className="flex flex-col gap-3 w-full">
                  <Button onClick={handleAcceptLoggedIn} disabled={isLoading} className="w-full bg-[#248223] hover:bg-[#2ea82d] text-white h-12 text-lg font-bold">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                    Aceptar Invitación Ahora
                  </Button>
                  <Button asChild variant="ghost" className="w-full text-[#8a9186] hover:text-[#2ea82d] hover:bg-white/5">
                    <Link to="/dashboard">Ir al Dashboard directamente</Link>
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4">
                <Loader2 className="w-8 h-8 animate-spin text-[#2ea82d]" />
                <p className="text-sm text-[#8a9186]">Validando invitación...</p>
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

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1a0d] p-4 font-poppins">
        <Card className="w-full max-w-md shadow-2xl border-t-8 border-[#248223] bg-[#0f2614] text-[#f5f7f2] animate-in fade-in zoom-in duration-300">
          <CardContent className="pt-10 flex flex-col items-center text-center">
            <div className="bg-[#248223]/20 p-4 rounded-full mb-6">
              <MailCheck className="w-12 h-12 text-[#2ea82d]" />
            </div>
            <h2 className="text-2xl font-bold text-[#2ea82d] mb-4">¡Casi listo!</h2>
            <p className="text-[#8a9186] mb-6 text-center">
              Hemos enviado un enlace de verificación a:<br />
              <span className="text-[#f5f7f2] font-semibold">{emailForDisplay}</span>
            </p>
            <div className="bg-[#FB9F1E]/10 border border-[#FB9F1E]/20 p-4 rounded-xl mb-8 text-sm text-[#FB9F1E]">
              <p className="font-medium">¿No ves el correo?</p>
              <p>Revisa tu carpeta de <strong>Spam</strong> o Promociones.</p>
            </div>
            <Button asChild variant="outline" className="w-full border-[#248223] text-[#248223] hover:bg-[#248223] hover:text-white transition-colors bg-transparent h-12">
              <Link to="/login">Volver al Inicio de Sesión</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleValue = watch('role');
  const showDateOfBirth = roleValue && !INSTITUTION_ROLES.includes(roleValue);

  return (
    <div className="min-h-screen flex bg-[#0a1a0d] text-[#f5f7f2] font-['DM_Sans'] overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        .sportmaps-grid {
          background-image:
            linear-gradient(rgba(36,130,35,.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(36,130,35,.06) 1px, transparent 1px);
          background-size: 52px 52px;
        }
        .hero-title { font-family: 'Syne', sans-serif; }
        .logo-name { font-family: 'Syne', sans-serif; }
        .syne { font-family: 'Syne', sans-serif; }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .5; transform: scale(.7); }
        }
        .animate-pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
        .role-card-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        @media (min-width: 400px) {
          .role-card-grid { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex w-[42%] min-h-screen bg-[#0f2614] relative flex-col justify-between p-12 overflow-hidden border-r border-white/5">
        <div className="absolute inset-0 sportmaps-grid"></div>
        <div className="absolute -top-[120px] -right-[120px] w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,rgba(36,130,35,.35)_0%,transparent_70%)] pointer-events-none"></div>
        <div className="absolute -bottom-[80px] -left-[80px] w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(36,130,35,.2)_0%,transparent_70%)] pointer-events-none"></div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-[38px] h-[38px] bg-[#248223] rounded-[10px] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-[22px] h-[22px] fill-white"><path d="M12 2C8.5 2 6 5 6 8c0 4 6 12 6 12s6-8 6-12c0-3-2.5-6-6-6zm0 8a2 2 0 110-4 2 2 0 010 4z"/></svg>
          </div>
          <span className="logo-name font-extrabold text-xl tracking-tight">SportMaps</span>
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-[#248223]/10 border border-[#248223]/30 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 bg-[#2ea82d] rounded-full animate-pulse-dot"></span>
            <p className="text-[10px] text-[#4dcc4c] font-bold uppercase tracking-widest">Plataforma deportiva</p>
          </div>
          <h1 className="hero-title font-extrabold text-6xl leading-[1.05] tracking-tighter mb-6">
            El deporte,<br />
            <span className="text-[#2ea82d]">mejor</span><br />
            organizado.
          </h1>
          <p className="text-sm text-[#8a9186] leading-relaxed max-w-[320px] font-light">
            Conectamos academias, entrenadores, atletas y familias en un solo ecosistema diseñado para el deporte latinoamericano.
          </p>
        </div>
        <div className="relative z-10 flex border border-white/5 rounded-2xl overflow-hidden bg-white/5 backdrop-blur-sm">
          <div className="flex-1 p-5 border-r border-white/5">
            <div className="hero-title font-bold text-2xl">+120<span className="text-[#2ea82d]">k</span></div>
            <div className="text-[10px] text-[#8a9186] uppercase tracking-wider font-medium">Atletas</div>
          </div>
          <div className="flex-1 p-5 border-r border-white/5">
            <div className="hero-title font-bold text-2xl">+800</div>
            <div className="text-[10px] text-[#8a9186] uppercase tracking-wider font-medium">Escuelas</div>
          </div>
          <div className="flex-1 p-5">
            <div className="hero-title font-bold text-2xl">32<span className="text-[#2ea82d]">+</span></div>
            <div className="text-[10px] text-[#8a9186] uppercase tracking-wider font-medium">Ciudades</div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-[480px] animate-in slide-in-from-bottom-6 duration-500 ease-out">
          
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-8 h-8 bg-[#248223] rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M12 2C8.5 2 6 5 6 8c0 4 6 12 6 12s6-8 6-12c0-3-2.5-6-6-6zm0 8a2 2 0 110-4 2 2 0 010 4z"/></svg>
            </div>
            <span className="logo-name font-bold text-lg">SportMaps</span>
          </div>

          <div className="mb-10">
            <h2 className="hero-title font-bold text-3xl tracking-tight mb-2">Crear cuenta</h2>
            <p className="text-sm text-[#8a9186] font-light">Únete a la comunidad líder en gestión deportiva.</p>
          </div>

          {invitationInfo && (
            <div className="bg-[#248223]/10 border border-[#248223]/20 rounded-2xl p-4 mb-8 flex items-center gap-4">
              <div className="w-10 h-10 bg-[#248223]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <School className="w-5 h-5 text-[#2ea82d]" />
              </div>
              <div>
                <p className="text-sm font-semibold">Invitación de <span className="text-[#2ea82d]">{invitationInfo.school_name}</span></p>
                <p className="text-xs text-[#8a9186]">{invitationInfo.program_name || 'Nuevo Ingreso'}</p>
              </div>
            </div>
          )}

          {userExistsError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 mb-8 animate-in zoom-in duration-300">
              <div className="flex items-center gap-2 text-red-500 font-bold text-sm mb-2">
                <AlertCircle className="w-4 h-4" /> Cuenta registrada
              </div>
              <p className="text-xs text-[#8a9186] mb-4">Este correo ya tiene un perfil. Por favor inicia sesión.</p>
              <Button asChild className="w-full bg-red-500 hover:bg-red-600 text-white border-none py-6 rounded-xl font-bold">
                <Link to={`/login?email=${encodeURIComponent(watch('email'))}${inviteId ? `&invite=${inviteId}` : ''}`}>
                  Ir al inicio de sesión
                </Link>
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className={cn("space-y-6", (userExistsError || isLoading) && "opacity-50 pointer-events-none")}>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#d4d8d0]">Correo electrónico</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Mail className="w-4 h-4 text-[#4a5246] group-focus-within:text-[#2ea82d] transition-colors" />
                  </div>
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="tu@correo.com"
                    readOnly={!!inviteEmail}
                    className="w-full bg-[#0f2614] border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:border-[#248223] focus:ring-4 focus:ring-[#248223]/10 transition-all placeholder:text-[#4a5246]"
                  />
                </div>
                {errors.email && <p className="text-[10px] text-red-500 font-medium px-1 mt-1">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#d4d8d0]">Contraseña</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Lock className="w-4 h-4 text-[#4a5246] group-focus-within:text-[#2ea82d] transition-colors" />
                  </div>
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 caracteres"
                    onInput={(e) => checkPw(e.currentTarget.value)}
                    className="w-full bg-[#0f2614] border border-white/5 rounded-xl py-3.5 pl-11 pr-12 text-sm focus:outline-none focus:border-[#248223] focus:ring-4 focus:ring-[#248223]/10 transition-all placeholder:text-[#4a5246]"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4a5246] hover:text-[#f5f7f2]">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex gap-1 px-1 mt-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={cn("h-1 flex-1 rounded-full bg-[#163a1c] transition-all", 
                      i <= pwStrength && (pwStrength <= 1 ? "bg-red-500" : pwStrength <= 2 ? "bg-orange-400" : "bg-[#2ea82d]"))} 
                    />
                  ))}
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#d4d8d0]">Confirmar</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Check className="w-4 h-4 text-[#4a5246] group-focus-within:text-[#2ea82d] transition-colors" />
                  </div>
                  <input
                    {...register('confirmPassword')}
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Repetir"
                    className="w-full bg-[#0f2614] border border-white/5 rounded-xl py-3.5 pl-11 pr-12 text-sm focus:outline-none focus:border-[#248223] focus:ring-4 focus:ring-[#248223]/10 transition-all placeholder:text-[#4a5246]"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4a5246] hover:text-[#f5f7f2]">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-[10px] text-red-500 font-medium px-1 mt-1">{errors.confirmPassword.message}</p>}
              </div>

              <div className="h-4 md:col-span-2"></div>

              {/* Name */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#d4d8d0]">Nombre Completo</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <User className="w-4 h-4 text-[#4a5246] group-focus-within:text-[#2ea82d] transition-colors" />
                  </div>
                  <input
                    {...register('fullName')}
                    type="text"
                    placeholder="Ej: Carlos Ortiz"
                    className="w-full bg-[#0f2614] border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:border-[#248223] focus:ring-4 focus:ring-[#248223]/10 transition-all placeholder:text-[#4a5246]"
                  />
                </div>
                {errors.fullName && <p className="text-[10px] text-red-500 font-medium px-1 mt-1">{errors.fullName.message}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#d4d8d0]">Teléfono</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Phone className="w-4 h-4 text-[#4a5246] group-focus-within:text-[#2ea82d] transition-colors" />
                  </div>
                  <input
                    {...register('phone')}
                    type="tel"
                    placeholder="+57..."
                    className="w-full bg-[#0f2614] border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:border-[#248223] focus:ring-4 focus:ring-[#248223]/10 transition-all placeholder:text-[#4a5246]"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-3 md:col-span-2 mt-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#4a5246]">Soy...</label>
                <div className="role-card-grid">
                  {[
                    { id: 'athlete', icon: '⚽', label: 'Atleta' },
                    { id: 'parent', icon: '👨‍👩‍👧', label: 'Padre' },
                    { id: 'coach', icon: '📋', label: 'Coach' },
                    { id: 'school', icon: '🏫', label: 'Escuela' }
                  ].map((role) => (
                    <div 
                      key={role.id}
                      onClick={() => !inviteRole && setValue('role', role.id)}
                      className={cn(
                        "relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer group",
                        inviteRole && inviteRole !== role.id && "hidden",
                        roleValue === role.id 
                          ? "bg-[#248223]/15 border-[#248223] ring-2 ring-[#248223]/20" 
                          : "bg-[#0f2614] border-white/5 hover:border-[#248223]/50"
                      )}
                    >
                      <span className="text-xl mb-1">{role.icon}</span>
                      <span className="text-[9px] font-bold uppercase tracking-tight text-[#d4d8d0]">{role.label}</span>
                      {roleValue === role.id && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#2ea82d] rounded-full"></div>}
                    </div>
                  ))}
                </div>
                {errors.role && <p className="text-[10px] text-red-500 font-medium px-1 mt-1">{errors.role.message}</p>}
              </div>

              {/* ── FECHA DE NACIMIENTO — solo para usuarios individuales ── */}
              {showDateOfBirth && (
                <div className="space-y-2 md:col-span-2 animate-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#d4d8d0]">
                    Fecha de Nacimiento
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <CalendarIcon className="w-4 h-4 text-[#4a5246] group-focus-within:text-[#2ea82d] transition-colors" />
                    </div>
                    <input
                      {...register('dateOfBirth')}
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full bg-[#0f2614] border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:border-[#248223] focus:ring-4 focus:ring-[#248223]/10 transition-all text-[#f5f7f2] [color-scheme:dark]"
                    />
                  </div>
                  {errors.dateOfBirth && <p className="text-[10px] text-red-500 font-medium px-1 mt-1">{errors.dateOfBirth.message}</p>}
                </div>
              )}

              {/* School Specific Fields */}
              {roleValue === 'school' && !inviteId && (
                <div className="md:col-span-2 space-y-6 pt-4 animate-in slide-in-from-top-4 duration-300">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#d4d8d0]">Nombre de la Academia</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <School className="w-4 h-4 text-[#4a5246] group-focus-within:text-[#2ea82d] transition-colors" />
                      </div>
                      <input
                        {...register('schoolName')}
                        type="text"
                        placeholder="Ej: Academy Los Tigres"
                        className="w-full bg-[#0f2614] border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:border-[#248223] focus:ring-4 focus:ring-[#248223]/10 transition-all placeholder:text-[#4a5246]"
                      />
                    </div>
                    {errors.schoolName && <p className="text-[10px] text-red-500 font-medium px-1 mt-1">{errors.schoolName.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#d4d8d0]">Deporte Principal</label>
                    <Controller
                      name="sportId"
                      control={control}
                      render={({ field }) => (
                        <Popover open={sportOpen} onOpenChange={setSportOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={sportOpen}
                              className={cn(
                                "w-full justify-between bg-[#0f2614] border-white/5 hover:bg-[#0f2614] hover:border-[#248223]/50 text-sm font-normal py-6 rounded-xl",
                                !field.value && "text-[#4a5246]",
                                errors.sportId && "border-red-500"
                              )}
                            >
                              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                              {field.value ? allSports.find((s) => s.id === field.value)?.nombre : "Buscar Deporte..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0 bg-[#0f2614] border-white/10" align="start">
                            <Command className="bg-transparent">
                              <CommandInput placeholder="Filtrar por nombre..." className="text-sm h-11" />
                              <CommandEmpty>No se encontró el deporte.</CommandEmpty>
                              <CommandGroup className="max-h-[300px] overflow-y-auto">
                                {allSports.map((sport) => (
                                  <CommandItem
                                    key={sport.id}
                                    value={sport.nombre}
                                    onSelect={() => { setValue('sportId', sport.id); setSportOpen(false); }}
                                    className="text-[#f5f7f2]/80 data-[selected=true]:bg-[#248223]/20 data-[selected=true]:text-[#f5f7f2]"
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", field.value === sport.id ? "opacity-100" : "opacity-0")} />
                                    {sport.nombre}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      )}
                    />
                    {errors.sportId && <p className="text-[10px] text-red-500 font-medium px-1 mt-1">{errors.sportId.message}</p>}
                    <p className="text-[9px] text-[#8a9186] px-1 italic">Este deporte autogenerará categorías sugeridas para tu academia.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-start gap-4 pt-4">
              <div 
                className={cn("w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all flex-shrink-0 mt-0.5", 
                  watch('acceptTerms') ? "bg-[#248223] border-[#248223]" : "bg-[#0f2614] border-white/10")}
                onClick={() => setValue('acceptTerms', !watch('acceptTerms'))}
              >
                {watch('acceptTerms') && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              <p className="text-xs text-[#8a9186] leading-relaxed select-none">
                Acepto los <a href="/terms" className="text-[#4dcc4c] hover:underline font-bold">Términos y Condiciones</a> y la <a href="/privacy" className="text-[#4dcc4c] hover:underline font-bold">Política de Privacidad</a> de SportMaps.
              </p>
            </div>
            {errors.acceptTerms && <p className="text-[10px] text-red-500 font-medium px-1 -mt-4">{errors.acceptTerms.message}</p>}

            <Button 
              type="submit" 
              className="w-full bg-[#248223] hover:bg-[#2ea82d] text-white py-8 rounded-2xl text-base font-bold syne tracking-wide shadow-xl shadow-[#248223]/15 transition-all group"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowRight className="w-5 h-5 mr-1 group-hover:translate-x-1 transition-transform" />}
              Crear mi cuenta
            </Button>

            <div className="text-center pt-2">
              <p className="text-sm text-[#8a9186]">
                ¿Ya tienes cuenta? <Link to="/login" className="text-[#4dcc4c] font-bold hover:underline">Inicia sesión</Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}