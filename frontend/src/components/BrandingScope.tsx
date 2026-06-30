// frontend/src/components/BrandingScope.tsx
//
// Componente que envuelve un subarbol y aplica el branding de la escuela
// activa como CSS variables EN UN CONTAINER local, no en :root.
//
// Reemplaza el flujo anterior (que pintaba :root global y leakeaba colores
// entre escuelas, roles y rutas no-escuela como /admin o /marketplace).
//
// Reglas para aplicar branding:
//   1. La ruta actual debe estar en la allowlist (rutas internas de escuela).
//   2. La ruta NO debe estar en la blocklist (admin, marketplace, billing,
//      onboarding, rutas publicas). Blocklist gana ante allowlist.
//   3. El rol del usuario debe ser uno "de escuela" (no super_admin viendo
//      diagnostics, ni external_vendor, etc.).
//   4. El tier de la escuela debe incluir el feature whitelabel
//      (has_whitelabel === true). Free/Start NUNCA recibe branding.
//
// Si alguna condicion falla, el componente renderiza los children sin envolver
// → los CSS vars del :root toman su default (SportMaps green/orange).

import React, { ReactNode, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useBrandingCssVars } from '@/contexts/ThemeContext';

// Rutas donde TIENE sentido pintar branding de escuela.
// Importante: usamos startsWith para que /escuela/:id/* matchee. Si agregas
// rutas nuevas para escuelas, agrega aqui o seras invisible al branding.
const ALLOWED_ROUTE_PREFIXES = [
  '/escuela',
  '/parent-dashboard',
  '/coach-dashboard',
  '/dashboard',           // dashboard generico tras login (depende del rol)
  '/asistencia',
  '/finanzas',
  '/estudiantes',
  '/equipos',
  '/calendario',
  '/eventos',
  '/perfil',              // perfil del usuario dentro de la escuela
  // ── Carnets y certificados (Fase 3b) ──
  // El branding se aplica al DOM y html2canvas lo captura al exportar PDF.
  '/my-cards',
  '/my-certificates',
  '/cards',
  '/certificates',
  // ── Settings de la escuela activa ──
  '/settings/school',
];

// Rutas que NUNCA aplican branding aunque matcheen un allowed prefix.
// La blocklist gana ante la allowlist (mas restrictivo).
const BLOCKED_ROUTE_PREFIXES = [
  '/admin',
  '/super-admin',
  '/marketplace',
  '/billing',
  '/mi-plan',
  '/onboarding',
  '/login',
  '/register',
  '/auth',
  '/reset-password',
  '/verify',
  '/payment-callback',
  '/checkout',
  '/diagnostics',
  '/system',
  // Modulos cross-school (vendor, trainer marketplace, etc.)
  '/vendor',
  '/trainer',
  '/athlete',
  '/store',
];

// Roles que ven branding cuando la ruta lo permite.
// Super-admins, external vendors, etc. NUNCA — siempre SportMaps.
const BRANDING_ROLES = new Set([
  'owner',
  'admin',
  'school_admin',
  'school',
  'coach',
  'staff',
  'parent',
  'athlete',
  'reporter',
]);

interface BrandingScopeProps {
  children: ReactNode;
  /**
   * Si true, fuerza no aplicar branding (util para sub-rutas que estan
   * dentro de allowlist pero deben mostrar SportMaps neutral, ej. wizards).
   */
  disable?: boolean;
}

export function BrandingScope({ children, disable = false }: BrandingScopeProps) {
  const location = useLocation();
  const { currentUserRole, schoolId } = useSchoolContext();
  const entitlements = useEntitlements();
  const cssVars = useBrandingCssVars();

  const shouldApply = useMemo(() => {
    if (disable) return false;
    if (!schoolId) return false;

    // 1. Route filter
    const path = location.pathname || '/';
    const isBlocked = BLOCKED_ROUTE_PREFIXES.some((p) => path.startsWith(p));
    if (isBlocked) return false;

    const isAllowed = ALLOWED_ROUTE_PREFIXES.some((p) => path.startsWith(p));
    if (!isAllowed) return false;

    // 2. Role filter
    if (!currentUserRole || !BRANDING_ROLES.has(currentUserRole)) return false;
    // Defense in depth: super_admin nunca ve branding aunque este en BRANDING_ROLES
    if (currentUserRole === ('super_admin' as any)) return false;

    // 3. Tier / addon feature gate
    // has_whitelabel es el flag canonical del entitlement.
    if (!entitlements.addons.whitelabel) return false;

    return true;
  }, [disable, schoolId, location.pathname, currentUserRole, entitlements.addons.whitelabel]);

  if (!shouldApply) {
    // Sin scope: los children usan los CSS vars del :root (SportMaps default).
    // No envolvemos en div para no afectar layout.
    return <>{children}</>;
  }

  return (
    <div
      data-branding-school-id={schoolId ?? ''}
      style={cssVars}
      className="contents"
    >
      {children}
    </div>
  );
}

export default BrandingScope;
