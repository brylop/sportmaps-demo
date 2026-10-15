import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { safeInternalPath, type ContextViewRole } from '@/lib/roleContexts';

// Selector de rol para personas multirol (spec cambio-de-rol-atleta-acudiente.md).
// Aparece después de iniciar sesión si la persona tiene 2+ roles y aún no eligió;
// la elección se recuerda hasta cerrar sesión y se cambia desde el menú de la
// cuenta. Elegir un rol solo cambia lo que se muestra: los permisos los decide la
// base de datos.

const ICONO: Record<ContextViewRole, string> = {
  parent: '👨‍👩‍👧',
  athlete: '⚽',
  school: '🏫',
  school_admin: '🏫',
  coach: '📋',
  reporter: '📊',
  accountant: '🧾',
};

const DESCRIPCION: Record<ContextViewRole, string> = {
  parent: 'Mis hijos, sus pagos y asistencia',
  athlete: 'Mis entrenamientos, mi plan y mis pagos',
  school: 'Administro la escuela',
  school_admin: 'Administro la escuela',
  coach: 'Mis equipos, asistencia y evaluaciones',
  reporter: 'Reportes de la escuela',
  accountant: 'Contabilidad de la escuela',
};

/** Solo rutas internas: evita que ?redirectTo= lleve a otro sitio. */
function destinoSeguro(raw: string | null): string {
  return safeInternalPath(raw, '/dashboard');
}

export default function ElegirRolPage() {
  const { user, profile, loading, roleContexts, activeRoleContext, switchRoleContext } = useAuth();
  const [searchParams] = useSearchParams();
  const [elegido, setElegido] = useState<string | null>(activeRoleContext?.key ?? null);
  const [entrando, setEntrando] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // Una sola forma de usar la app: no hay nada que elegir.
  if (roleContexts.length === 0) return <Navigate to="/dashboard" replace />;

  // Mostrar el nombre de la escuela solo si los roles están en escuelas distintas.
  const variasEscuelas = new Set(roleContexts.map((c) => c.schoolId)).size > 1;

  const continuar = () => {
    if (!elegido) return;
    setEntrando(true);
    switchRoleContext(elegido, destinoSeguro(searchParams.get('redirectTo')));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-bold text-2xl tracking-tight mb-2">¿Cómo quieres entrar?</h1>
          <p className="text-sm text-muted-foreground">
            {profile?.full_name ? `Hola ${profile.full_name.split(' ')[0]}. ` : ''}
            Tienes más de un rol en SportMaps. Puedes cambiarlo cuando quieras desde tu cuenta.
          </p>
        </div>

        <div className="flex flex-col gap-3 mb-6" role="radiogroup" aria-label="Rol con el que quieres entrar">
          {roleContexts.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={elegido === c.key}
              onClick={() => setElegido(c.key)}
              className={cn(
                'flex items-center gap-4 p-4 rounded-2xl border text-left transition-all',
                elegido === c.key
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                  : 'border-border bg-card hover:border-primary/50',
              )}
            >
              <span className="text-2xl" aria-hidden>{ICONO[c.viewRole]}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold">{c.label}</span>
                <span className="block text-xs text-muted-foreground truncate">
                  {DESCRIPCION[c.viewRole]}{variasEscuelas ? ` · ${c.schoolName}` : ''}
                </span>
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={continuar}
          disabled={!elegido || entrando}
          className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {entrando ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Entrar <ArrowRight className="w-5 h-5" /></>}
        </button>
      </div>
    </div>
  );
}
