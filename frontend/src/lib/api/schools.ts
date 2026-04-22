
// Schools API Service
// Phase: Adapter for V4 Migration
import { supabase } from '@/integrations/supabase/client';

export interface SchoolProfile {
    id: string;
    name: string;
    slug?: string;
    description?: string;
    logo_url?: string;
    banner_url?: string;
    address?: string;
    phone?: string;
    email?: string;
    branding?: any;
    city?: string;
    services?: any[];
    teams?: any[];
    staff?: any[];
}

class SchoolsAPI {

    /**
     * Get public school profile by slug (real DB column).
     * Para los slugs especiales de demo hardcodeado, mantenemos el enriquecimiento
     * con servicios/teams de ejemplo si la escuela de la DB no tiene datos completos.
     */
    async getSchoolBySlug(slug: string): Promise<SchoolProfile | null> {
        try {
            const { data, error } = await (supabase
                .from('schools') as any)
                .select('*')
                .eq('slug', slug)
                .maybeSingle();

            if (error) throw error;
            if (data) return { ...data, slug: (data as any).slug ?? slug } as SchoolProfile;

            // No match por slug: para slugs demo conocidos, devolver la escuela demo hardcodeada.
            if (slug === 'academia-demo' || slug === 'spirit-all-stars' || slug === 'demo') {
                return await this.getDemoSchoolProfile(slug);
            }

            return null;
        } catch (error) {
            console.warn('Error fetching school, using demo fallback:', error);
            return this.getDemoFallback(slug);
        }
    }

    /**
     * Fetch real school data from DB for the demo school
     */
    private async getDemoSchoolProfile(slug: string): Promise<SchoolProfile | null> {
        try {
            // Prefer the configured demo school via env; fall back to the
            // oldest school in the system. Never grab an arbitrary tenant.
            const demoEmail = import.meta.env.VITE_DEMO_SCHOOL_EMAIL as string | undefined;
            let schoolQuery = supabase
                .from('schools')
                .select('*')
                .order('created_at', { ascending: true })
                .limit(1);

            if (demoEmail) {
                schoolQuery = schoolQuery.eq('email', demoEmail);
            }

            const { data: school, error: schoolError } = await schoolQuery.maybeSingle();

            if (schoolError || !school) throw new Error('No school found');

            // Fetch programs for this school
            const { data: programs } = await supabase
                .from('teams')
                .select('*')
                .eq('school_id', school.id)
                .eq('active', true);

            // Fetch staff/coaches for this school
            const { data: staff } = await supabase
                .from('school_staff')
                .select('*')
                .eq('school_id', school.id)
                .eq('status', 'active');

            return {
                id: school.id,
                name: school.name || 'Spirit All Stars',
                slug: slug,
                description: school.description || 'Formación integral en cheerleading y gimnasia de alto rendimiento.',
                banner_url: school.cover_image_url || "https://images.unsplash.com/photo-1510531704581-5b2870972060?auto=format&fit=crop&q=80&w=2000",
                logo_url: school.logo_url,
                branding: {
                    primaryColor: "#003366",
                    secondaryColor: "#4D9EE0"
                },
                address: school.address || "Carrera 45 # 127-10",
                city: school.city || "Bogotá",
                email: school.email || "info@spiritallstars.co",
                phone: school.phone || "+57 321 987 6543",
                services: [
                    { title: "Clínicas de Stunts", description: "Perfeccionamiento de elevaciones y técnica", price: "$60.000/sesión" },
                    { title: "Tumbling Personalizado", description: "Técnica individual de acrobacia", price: "$80.000/hora" },
                    { title: "Condicionamiento Core", description: "Preparación física específica para cheerleading", price: "Incluido" },
                    { title: "Pro-Shop Spirit", description: "Venta de moños, uniformes y accesorios", price: "Varios" }
                ],
                teams: (programs || []).map((p: any) => ({
                    name: p.name,
                    age: p.age_min && p.age_max ? `${p.age_min}-${p.age_max} años` : (p.sport || 'Todos'),
                    schedule: p.schedule || 'Horario por definir'
                })),
                staff: (staff || []).map((s: any) => ({
                    name: s.full_name,
                    role: s.specialty || 'Entrenador',
                    exp: (s.certifications || []).join(', ') || 'Certificado'
                }))
            };
        } catch (error) {
            console.warn('Error fetching real demo data, using fallback:', error);
            return this.getDemoFallback(slug);
        }
    }

    /**
     * Hardcoded fallback for demo purposes
     */
    private getDemoFallback(slug: string): SchoolProfile | null {
        if (slug === 'academia-demo' || slug === 'academiadepor-tigres' || slug === 'demo' || slug === 'spirit-all-stars') {
            return {
                id: 'demo-school',
                name: 'Spirit All Stars',
                slug: slug,
                description: 'Liderando el cheerleading de alto rendimiento. Formamos atletas integrales con disciplina, pasión y técnica de nivel mundial en acrobatics y stunts.',
                banner_url: "https://images.unsplash.com/photo-1510531704581-5b2870972060?auto=format&fit=crop&q=80&w=2000",
                branding: {
                    primaryColor: "#003366",
                    secondaryColor: "#4D9EE0"
                },
                address: "Carrera 45 # 127-10",
                city: "Bogotá",
                email: "info@spiritallstars.co",
                phone: "+57 321 987 6543",
                services: [
                    { title: "Clínicas de Stunts", description: "Perfeccionamiento de elevaciones", price: "$60.000/sesión" },
                    { title: "Tumbling Personalizado", description: "Técnica individual de acrobacia", price: "$80.000/hora" },
                    { title: "Condicionamiento Core", description: "Preparación física específica", price: "Incluido" },
                    { title: "Pro-Shop Spirit", description: "Venta de moños y uniformes", price: "Varios" }
                ],
                teams: [
                    { name: "Butterfly (Junior Prep)", age: "6-12 años", schedule: "Mar-Jue 4:00 PM" },
                    { name: "Firesquad (Senior L3)", age: "12-18 años", schedule: "Lun-Mié-Vie 5:30 PM" },
                    { name: "Bombsquad (Coed L5)", age: "16+ años", schedule: "Lun a Sáb 7:00 PM" },
                    { name: "Legends (Open L6)", age: "18+ años", schedule: "Fines de semana" }
                ],
                staff: [
                    { name: "Andrés 'Cheer' Martínez", role: "Head Coach", exp: "20 años" },
                    { name: "Lucía Fernández", role: "Especialista en Tumbling", exp: "12 años" }
                ]
            };
        }
        return null;
    }
}

export const schoolsAPI = new SchoolsAPI();
