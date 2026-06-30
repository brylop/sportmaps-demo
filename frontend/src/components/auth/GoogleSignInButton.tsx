import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getUserFriendlyError } from '@/lib/error-translator';

interface GoogleSignInButtonProps {
  /** Ruta a la que volver tras el OAuth (default: /dashboard). */
  redirectTo?: string;
  label?: string;
}

/**
 * Botón "Continuar con Google". Inicia el flujo OAuth de Supabase.
 * Tras la redirección, AuthContext detecta la sesión y, si el perfil
 * fue creado sin rol (needs_role_selection), ProtectedRoute lleva al
 * usuario a /onboarding/role.
 */
export function GoogleSignInButton({ redirectTo = '/dashboard', label = 'Continuar con Google' }: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle } = useAuth();
  const { toast } = useToast();

  const handleClick = async () => {
    setLoading(true);
    try {
      await signInWithGoogle(redirectTo);
      // En éxito, el navegador redirige a Google; no se ejecuta más código aquí.
    } catch (error) {
      console.error('Google sign-in error:', error);
      toast({
        title: 'No pudimos conectar con Google',
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 bg-[#0f2614] border border-white/10 hover:border-white/20 hover:bg-white/5 text-[#f5f7f2] py-4 rounded-2xl text-sm font-bold transition-all disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
        </svg>
      )}
      {label}
    </button>
  );
}

/** Separador "o continúa con" reutilizable. */
export function AuthDivider({ text = 'o continúa con' }: { text?: string }) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-[10px] uppercase tracking-widest text-[#8a9186] font-bold">{text}</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}
