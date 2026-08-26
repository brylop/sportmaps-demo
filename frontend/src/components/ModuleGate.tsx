import { Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { MODULE_CATALOG, type ModuleKey } from '@/config/module-catalog';

/**
 * Roles a los que se les aplica el gate. Varias rutas del catálogo son
 * compartidas por otros roles (/calendar, /informe-mensual, /teams,
 * /training-plans, /reporter-dashboard, /recepcion) — apagar un módulo para
 * la ESCUELA no debe ocultarle el calendario a sus propios atletas/padres ni
 * el panel a un reporter. Cualquier rol fuera de esta lista atraviesa sin
 * restricción.
 */
const GATED_ROLES = ['school', 'school_admin'];

interface ModuleGateProps {
  moduleKey: ModuleKey;
  children: React.ReactNode;
}

/**
 * Guard de página para los módulos del menú activables por escuela desde el
 * Super Admin (`school_module_overrides`). Generaliza el único precedente
 * real que existía (chequeo inline en AccountingPage.tsx). Va DENTRO de
 * `ProtectedRoute` en App.tsx: auth/rol primero, visibilidad de producto acá.
 *
 * La visibilidad efectiva combina dos preguntas independientes, nunca
 * mezcladas (ver docs/specs/capacidades-de-la-escuela-2026-08-18.md §14.3):
 *   - ¿Tiene derecho? → el addon comercial del catálogo, si el módulo tiene uno.
 *   - ¿Está prendido? → el override operativo del Super Admin.
 */
export function ModuleGate({ moduleKey, children }: ModuleGateProps) {
  const { profile } = useAuth();
  const { currentUserRole } = useSchoolContext();
  const { isLoading: entLoading, hasAddon, isModuleEnabled } = useEntitlements();

  const effectiveRole = currentUserRole || profile?.role;
  if (!effectiveRole || !GATED_ROLES.includes(effectiveRole)) {
    return <>{children}</>;
  }

  // Evita el flash de pantalla bloqueada mientras entitlements todavía carga.
  if (entLoading) return null;

  const def = MODULE_CATALOG[moduleKey];
  const hasRight = !def.addon || hasAddon(def.addon);
  const isOn = isModuleEnabled(moduleKey);

  if (hasRight && isOn) {
    return <>{children}</>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-lg mx-auto text-center rounded-2xl border bg-card p-10 mt-8">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">{def.label}</h1>
        {!hasRight ? (
          <>
            <p className="text-muted-foreground mt-2">
              Este módulo no está activo en tu plan.
            </p>
            <a
              href="/mi-plan"
              className="inline-flex mt-6 items-center justify-center rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90"
            >
              Ver planes y activar
            </a>
          </>
        ) : (
          <p className="text-muted-foreground mt-2">
            Este módulo no está disponible para tu escuela. Si crees que es un error, contacta a soporte.
          </p>
        )}
      </div>
    </div>
  );
}
