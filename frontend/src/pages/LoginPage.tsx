import { useState, useEffect } from 'react';
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
import { Loader2, Eye, EyeOff, Users, Mail, ArrowLeft, CheckCircle2, Lock, ArrowRight, School } from 'lucide-react';
import { useInvitationBranding } from '@/hooks/useInvitationBranding';
import { getUserFriendlyError } from '@/lib/error-translator';
import { cn } from '@/lib/utils';

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

  // Load branding if we have an invite id
  const inviteBranding = useInvitationBranding(inviteId);

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
    resolver: zodResolver(loginSchema),
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
      // Error is handled in the context OR show toast here if preferred
      console.error("Login component error:", error);
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
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
    } finally {
      setResetSending(false);
    }
  };

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

        .animate-pulse-dot {
          animation: pulse-dot 2s ease-in-out infinite;
        }
      `}</style>

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex w-[42%] min-h-screen bg-[#0f2614] relative flex-col justify-between p-12 overflow-hidden border-r border-white/5">
        <div className="absolute inset-0 sportmaps-grid"></div>
        
        {/* Decorative Gradients */}
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
            Tu mundo,<br />
            <span className="text-[#2ea82d]">deportivamente</span><br />
            conectado.
          </h1>
          <p className="text-sm text-[#8a9186] leading-relaxed max-w-[320px] font-light">
            Inicia sesión para gestionar tus entrenamientos, equipos y progresos en la red deportiva más grande.
          </p>
        </div>

        <div className="relative z-10 flex gap-4">
           {/* Decorative avatars or indicators could go here */}
           <div className="flex -space-x-3">
             <div className="w-10 h-10 rounded-full border-2 border-[#0f2614] bg-[#248223] flex items-center justify-center text-[10px] font-bold">SM</div>
             <div className="w-10 h-10 rounded-full border-2 border-[#0f2614] bg-[#FB9F1E] flex items-center justify-center text-[10px] font-bold text-black">GO</div>
             <div className="w-10 h-10 rounded-full border-2 border-[#0f2614] bg-[#f5f7f2] flex items-center justify-center text-[10px] font-bold text-black">+2k</div>
           </div>
           <p className="text-[10px] text-[#8a9186] self-center">Más de 2,000 usuarios activos hoy</p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-[420px] animate-in slide-in-from-bottom-6 duration-500 ease-out">
          
          {/* Logo Mobile */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-8 h-8 bg-[#248223] rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M12 2C8.5 2 6 5 6 8c0 4 6 12 6 12s6-8 6-12c0-3-2.5-6-6-6zm0 8a2 2 0 110-4 2 2 0 010 4z"/></svg>
            </div>
            <span className="logo-name font-bold text-lg">SportMaps</span>
          </div>

          {!showForgotPassword ? (
            /* ── LOGIN VIEW ── */
            <>
              <div className="mb-10">
                <h2 className="hero-title font-bold text-3xl tracking-tight mb-2">Bienvenido</h2>
                <p className="text-sm text-[#8a9186] font-light">Ingresa tus credenciales para acceder a tu perfil.</p>
              </div>

              {/* Invitation Banner if exists */}
              {inviteBranding && (
                <div className="bg-[#248223]/10 border border-[#248223]/20 rounded-2xl p-4 mb-8 flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#248223]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <School className="w-5 h-5 text-[#2ea82d]" />
                  </div>
                  <div>
                      <p className="text-sm font-semibold">Invitación de <span className="text-[#2ea82d]">{inviteBranding.school_name}</span></p>
                      <p className="text-xs text-[#8a9186]">Inicia sesión para aceptar</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                
                <div className="space-y-4">
                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#d4d8d0]">Correo electrónico</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Mail className="w-4 h-4 text-[#4a5246] group-focus-within:text-[#2ea82d] transition-colors" />
                      </div>
                      <input
                        {...register('email')}
                        type="email"
                        placeholder="tu@correo.com"
                        className="w-full bg-[#0f2614] border border-white/5 rounded-xl py-4 pl-11 pr-4 text-sm focus:outline-none focus:border-[#248223] focus:ring-4 focus:ring-[#248223]/10 transition-all placeholder:text-[#4a5246]"
                      />
                    </div>
                    {errors.email && <p className="text-[10px] text-red-500 font-medium px-1 mt-1">{errors.email.message}</p>}
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#d4d8d0]">Contraseña</label>
                      <button 
                        type="button" 
                        onClick={() => setShowForgotPassword(true)}
                        className="text-[10px] font-bold text-[#4dcc4c] hover:text-[#2ea82d] transition-colors"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Lock className="w-4 h-4 text-[#4a5246] group-focus-within:text-[#2ea82d] transition-colors" />
                      </div>
                      <input
                        {...register('password')}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="w-full bg-[#0f2614] border border-white/5 rounded-xl py-4 pl-11 pr-12 text-sm focus:outline-none focus:border-[#248223] focus:ring-4 focus:ring-[#248223]/10 transition-all placeholder:text-[#4a5246]"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4a5246] hover:text-[#f5f7f2]">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-[10px] text-red-500 font-medium px-1 mt-1">{errors.password.message}</p>}
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-[#248223] hover:bg-[#2ea82d] text-white py-8 rounded-2xl text-base font-bold syne tracking-wide shadow-xl shadow-[#248223]/15 transition-all group"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowRight className="w-5 h-5 mr-1 group-hover:translate-x-1 transition-transform" />}
                  Entrar ahora
                </Button>

                <div className="text-center pt-4">
                  <p className="text-sm text-[#8a9186]">
                    ¿No tienes cuenta? <Link to="/register" className="text-[#4dcc4c] font-bold hover:underline">Regístrate</Link>
                  </p>
                </div>
                
              </form>
            </>
          ) : (
            /* ── FORGOT PASSWORD VIEW ── */
            <div className="animate-in fade-in slide-in-from-right-4 duration-400">
              <button 
                onClick={() => { setShowForgotPassword(false); setResetSent(false); }}
                className="flex items-center gap-2 text-xs text-[#8a9186] hover:text-[#2ea82d] mb-8 transition-colors group"
              >
                <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Volver al inicio
              </button>

              <div className="mb-10">
                <h2 className="hero-title font-bold text-3xl tracking-tight mb-2">Restablecer</h2>
                <p className="text-sm text-[#8a9186] font-light">
                  {resetSent 
                    ? `Hemos enviado un enlace a ${resetEmail}.` 
                    : "Ingresa tu correo y te enviaremos instrucciones."}
                </p>
              </div>

              {resetSent ? (
                <div className="space-y-8">
                  <div className="bg-[#248223]/10 border border-[#248223]/20 rounded-2xl p-6 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-[#248223]/20 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-8 h-8 text-[#2ea82d]" />
                    </div>
                    <p className="text-sm leading-relaxed text-[#f5f7f2]">
                      ¡Listo! Revisa tu bandeja de entrada y haz clic en el botón para cambiar tu contraseña.
                    </p>
                  </div>
                  <Button 
                    onClick={() => { setShowForgotPassword(false); setResetSent(false); }}
                    className="w-full bg-[#0f2614] hover:bg-white/5 border border-white/5 text-white py-8 rounded-2xl text-base font-bold"
                  >
                    Entendido
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#d4d8d0]">Correo electrónico</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Mail className="w-4 h-4 text-[#4a5246] group-focus-within:text-[#2ea82d] transition-colors" />
                      </div>
                      <input
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        type="email"
                        placeholder="tu@correo.com"
                        className="w-full bg-[#0f2614] border border-white/5 rounded-xl py-4 pl-11 pr-4 text-sm focus:outline-none focus:border-[#FB9F1E] focus:ring-4 focus:ring-[#FB9F1E]/10 transition-all placeholder:text-[#4a5246]"
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-[#FB9F1E] hover:bg-[#e8911b] text-black py-8 rounded-2xl text-base font-bold syne tracking-wide shadow-xl shadow-[#FB9F1E]/15 transition-all"
                    disabled={resetSending}
                  >
                    {resetSending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enviar instrucciones"}
                  </Button>
                </form>
              )}
            </div>
          )}

          <div className="mt-12 text-center">
            <Link to="/" className="text-[10px] font-bold uppercase tracking-widest text-[#4a5246] hover:text-[#2ea82d] transition-colors">
              ← Sitio Principal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}