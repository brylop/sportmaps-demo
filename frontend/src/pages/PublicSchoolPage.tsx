
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { schoolsAPI } from '@/lib/api/schools';
import { supabase } from '@/integrations/supabase/client';
import { PublicSchoolClassicLayout } from '@/pages/school/layouts/PublicSchoolClassicLayout';
import { PublicSchoolModernLayout } from '@/pages/school/layouts/PublicSchoolModernLayout';
import { PublicSchoolMinimalLayout } from '@/pages/school/layouts/PublicSchoolMinimalLayout';
import { PublicSchoolMagazineLayout } from '@/pages/school/layouts/PublicSchoolMagazineLayout';

// Helper to convert hex to HSL for Tailwind variables
function hexToHSL(hex: string) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt("0x" + hex[1] + hex[1]);
        g = parseInt("0x" + hex[2] + hex[2]);
        b = parseInt("0x" + hex[3] + hex[3]);
    } else if (hex.length === 7) {
        r = parseInt("0x" + hex[1] + hex[2]);
        g = parseInt("0x" + hex[3] + hex[4]);
        b = parseInt("0x" + hex[5] + hex[6]);
    }
    r /= 255;
    g /= 255;
    b /= 255;
    const cmin = Math.min(r, g, b),
        cmax = Math.max(r, g, b),
        delta = cmax - cmin;
    let h = 0, s = 0, l = 0;

    if (delta === 0) h = 0;
    else if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;

    h = Math.round(h * 60);
    if (h < 0) h += 360;

    l = (cmax + cmin) / 2;
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return `${h} ${s}% ${l}%`;
}

/**
 * Data-fetching + dispatcher del perfil público de la escuela (/s/:slug).
 * El JSX de cada layout vive en frontend/src/pages/school/layouts/ — ver
 * docs/specs/perfil-publico-plantillas.md. Solo "classic" existe hoy;
 * modern/minimal/magazine se agregan en fases siguientes del mismo spec,
 * y mientras tanto caen acá al default.
 */
export default function PublicSchoolPage() {
    const { slug } = useParams();
    const { toast } = useToast();

    // Fetch school main info (public access)
    const { data: school, isLoading: isLoadingSchool } = useQuery({
        queryKey: ['public-school', slug],
        queryFn: async () => {
            const data = await schoolsAPI.getSchoolBySlug(slug || '');
            if (!data) throw new Error('School not found');
            return data;
        }
    });

    // Fetch facilities publicly by school_id (no auth required)
    const { data: facilities = [], isLoading: isLoadingFacilities } = useQuery({
        queryKey: ['public-facilities', school?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('facilities')
                .select('*')
                .eq('school_id', school!.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('Public facilities fetch error:', error);
                return [];
            }
            return data || [];
        },
        // Respeta school_settings.show_facilities: si la escuela apagó el listado
        // de instalaciones, su perfil público no lo consulta.
        enabled: !!school?.id && school?.show_facilities !== false,
    });

    const handleAction = (action: string) => {
        toast({
            title: "Acción Demo",
            description: `La acción "${action}" enviaría al usuario al proceso de registro o contacto.`
        });
    };

    if (isLoadingSchool || isLoadingFacilities) {
        return <LoadingSpinner fullScreen text="Cargando perfil de la academia..." />;
    }

    if (!school) return <div>Escuela no encontrada</div>;

    // Calculate dynamic styles based on school branding
    const customStyles = school.branding ? {
        '--primary': hexToHSL(school.branding.primaryColor),
        '--primary-foreground': '0 0% 100%', // Assume white text on primary for now
    } as React.CSSProperties : {};

    const layoutProps = { school, facilities, slug, onAction: handleAction };

    return (
        <div style={customStyles}>
            {school.public_page_layout === 'modern' ? <PublicSchoolModernLayout {...layoutProps} />
                : school.public_page_layout === 'minimal' ? <PublicSchoolMinimalLayout {...layoutProps} />
                : school.public_page_layout === 'magazine' ? <PublicSchoolMagazineLayout {...layoutProps} />
                : <PublicSchoolClassicLayout {...layoutProps} />}
        </div>
    );
}
