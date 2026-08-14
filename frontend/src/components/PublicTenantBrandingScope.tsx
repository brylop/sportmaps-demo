// frontend/src/components/PublicTenantBrandingScope.tsx
//
// Pinta el login (y demas pantallas publicas de acceso) con la marca de la
// escuela cuando el visitante viene de la app instalada de esa escuela.
//
// ── Por que NO se hizo dentro de BrandingScope ───────────────────────────────
// BrandingScope tiene /login, /register y /reset-password en su BLOCKLIST a
// proposito, y exige schoolId + rol de escuela — cosas que antes del login no
// existen. Meter el caso publico ahi habria obligado a aflojar esas reglas, que
// son las que impiden que los colores se filtren entre escuelas y roles. Se
// prefiere un componente aparte, mas chico y con su propia condicion.
//
// ── Aislacion (requisito explicito) ──────────────────────────────────────────
//   · Solo pinta si hay un tenant EXPLICITO: ?t=<slug> en la URL, el slug
//     guardado por la app instalada, o un subdominio de escuela. Sin eso, no
//     hace nada y se ve SportMaps.
//   · El slug lo valida el servidor: get_school_by_slug solo devuelve datos si
//     la escuela tiene el addon de marca. Un slug inventado no pinta nada.
//   · Los CSS vars van en un contenedor local, NUNCA en :root, asi que no se
//     escapan al resto de la app ni sobreviven a la navegacion.
//   · No mira roles ni sesion: es previo al login por definicion.

import { ReactNode } from 'react';
import { usePublicTenant } from '@/hooks/usePublicTenant';
import { hexToHsl, getContrastColorHsl } from '@/contexts/ThemeContext';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

interface Props {
    children: ReactNode;
}

export function PublicTenantBrandingScope({ children }: Props) {
    const { tenant } = usePublicTenant();

    const primario = tenant?.branding_settings?.primary_color;
    const secundario = tenant?.branding_settings?.secondary_color;

    // Sin tenant resuelto no se envuelve en nada: los children usan los CSS
    // vars del :root (SportMaps). Tampoco se agrega un div, para no alterar el
    // layout de las pantallas de acceso.
    if (!tenant || !primario || !HEX_RE.test(primario)) {
        return <>{children}</>;
    }

    const vars: Record<string, string> = {
        '--primary': hexToHsl(primario),
        '--primary-foreground': getContrastColorHsl(primario),
    };

    if (secundario && HEX_RE.test(secundario)) {
        vars['--secondary'] = hexToHsl(secundario);
        vars['--secondary-foreground'] = getContrastColorHsl(secundario);
    }

    return (
        <div data-branding-tenant={tenant.slug} style={vars as any} className="contents">
            {children}
        </div>
    );
}

export default PublicTenantBrandingScope;
