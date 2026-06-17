import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getUserFriendlyError } from '@/lib/error-translator';
import { cn } from '@/lib/utils';

// Roles auto-asignables por el usuario. Deben coincidir con el set permitido
// en el RPC complete_role_selection (migración 20260617000001).
const ROLE_OPTIONS = [
  { id: 'athlete', icon: '⚽', label: 'Atleta', desc: 'Entreno, reservo y compro' },
  { id: 'parent', icon: '👨‍👩‍👧', label: 'Padre / Madre', desc: 'Gestiono a mis hijos y pagos' },
  { id: 'coach', icon: '📋', label: 'Entrenador', desc: 'Clases, agenda y reportes' },
  { id: 'school', icon: '🏫', label: 'Escuela / Centro', desc: 'Administro mi academia' },
  { id: 'personal_trainer', icon: '🏋️', label: 'Entrenador Personal', desc: 'Sesiones y planes 1-a-1' },
  { id: 'wellness_professional', icon: '💚', label: 'Profesional Bienestar', desc: 'Fisio, nutrición, psicología' },
  { id: 'store_owner', icon: '🏪', label: 'Tienda', desc: 'Vendo productos deportivos' },
  { id: 'organizer', icon: '📅', label: 'Organizador', desc: 'Torneos y eventos' },
] as const;

/** Destino tras fijar el rol — alinea con RoleSelection.handleContinue. */
function routeForRole(role: string): string {
  if (role === 'school') return '/onboarding/school';
  if (role === 'personal_trainer') return '/trainer/onboarding';
  if (role === 'store_owner') return '/vendor/onboarding';
  if (role === 'organizer') return '/organizer/onboarding';
  return '/dashboard';
}

export default function OnboardingRolePage() {
  const { user, profile, loading: authLoading, updateProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>('athlete');
  const [saving, setSaving] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1a0d]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2ea82d]" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Si el usuario ya tiene rol definido, no debería estar aquí.
  if (profile && profile.needs_role_selection === false) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleContinue = async () => {
    setSaving(true);
    try {
      // RPC nuevo (migración 20260617000001): aún no está en los tipos generados.
      const { error } = await (supabase.rpc as any)('complete_role_selection', { p_role: selected });
      if (error) throw error;

      // Refrescar el perfil en contexto (silencioso) para limpiar la bandera.
      await updateProfile({}, { silent: true });

      toast({ title: '¡Listo!', description: 'Tu perfil quedó configurado.' });
      navigate(routeForRole(selected), { replace: true });
    } catch (error) {
      console.error('complete_role_selection failed:', error);
      toast({
        title: 'No pudimos guardar tu rol',
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a1a0d] text-[#f5f7f2] font-['DM_Sans'] p-6">
      <div className="w-full max-w-2xl animate-in slide-in-from-bottom-6 duration-500">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-6 justify-center">
            <div className="w-9 h-9 bg-[#248223] rounded-[10px] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M12 2C8.5 2 6 5 6 8c0 4 6 12 6 12s6-8 6-12c0-3-2.5-6-6-6zm0 8a2 2 0 110-4 2 2 0 010 4z" /></svg>
            </div>
            <span className="font-extrabold text-xl tracking-tight">SportMaps</span>
          </div>
          <h1 className="font-bold text-3xl tracking-tight mb-2">¿Cómo usarás SportMaps?</h1>
          <p className="text-sm text-[#8a9186] font-light">
            {profile?.full_name ? `Hola ${profile.full_name.split(' ')[0]}, ` : ''}
            elige tu rol para personalizar tu experiencia.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {ROLE_OPTIONS.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelected(role.id)}
              className={cn(
                'relative flex flex-col items-center text-center justify-start p-4 rounded-2xl border transition-all',
                selected === role.id
                  ? 'bg-[#248223]/15 border-[#248223] ring-2 ring-[#248223]/20'
                  : 'bg-[#0f2614] border-white/5 hover:border-[#248223]/50'
              )}
            >
              <span className="text-2xl mb-2">{role.icon}</span>
              <span className="text-xs font-bold uppercase tracking-tight text-[#d4d8d0]">{role.label}</span>
              <span className="text-[10px] text-[#8a9186] mt-1 leading-snug">{role.desc}</span>
              {selected === role.id && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#2ea82d] rounded-full" />}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={saving}
          className="w-full bg-[#248223] hover:bg-[#2ea82d] text-white py-5 rounded-2xl text-base font-bold tracking-wide shadow-xl shadow-[#248223]/15 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continuar <ArrowRight className="w-5 h-5" /></>}
        </button>
      </div>
    </div>
  );
}
