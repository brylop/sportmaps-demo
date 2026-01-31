
// Schools API Service
// Phase: Adapter for V4 Migration
import { supabase } from '@/integrations/supabase/client';

export interface SchoolProfile {
    id: string;
    name: string;
    slug: string;
    description?: string;
    logo_url?: string;
    banner_url?: string;
    address?: string;
    phone?: string;
    email?: string;
    branding?: any;
    city?: string;
    services?: any[];
    programs?: any[];
    staff?: any[];
}

class SchoolsAPI {

    /**
     * Get public school profile by slug
     */
    async getSchoolBySlug(slug: string): Promise<SchoolProfile | null> {
        try {
            const { data, error } = await supabase
                .from('schools')
                .select('*')
                .eq('slug', slug)
                .single();

            if (error) throw error;

            return data;
        } catch (error) {
            console.warn('Error fetching school, using demo data:', error);
            // Demo Fallback
            if (slug === 'academiadepor-tigres' || slug === 'demo') {
                return {
                    id: 'demo-school',
                    name: 'Academia Deportiva Los Tigres',
                    slug: slug,
                    description: 'Formando campeones desde 2010. Somos la academia líder en formación integral deportiva, con instalaciones de primera clase y un equipo de entrenadores certificados.',
                    banner_url: "https://images.unsplash.com/photo-1526304640152-d4619684e484?auto=format&fit=crop&q=80&w=2000",
                    branding: {
                        primaryColor: "#E11D48",
                        secondaryColor: "#1e293b"
                    },
                    address: "Av. Principal #123-45",
                    city: "Bogotá",
                    email: "contacto@lostigres.com",
                    phone: "+57 300 123 4567",
                    services: [
                        { title: "Entrenamiento Personalizado", description: "Clases 1 a 1 para mejorar técnica", price: "$50.000/hora" },
                        { title: "Torneos Mensuales", description: "Competencia interna y externa", price: "Incluido" },
                        { title: "Evaluación Nutricional", description: "Seguimiento trimestral", price: "$80.000" },
                        { title: "Tienda Deportiva", description: "Venta de uniformes y equipos", price: "Varios" }
                    ],
                    programs: [
                        { name: "Fútbol Base", age: "5-10 años", schedule: "Lun-Mie-Vie" },
                        { name: "Fútbol Juvenil", age: "11-15 años", schedule: "Mar-Jue-Sab" },
                        { name: "Alto Rendimiento", age: "16+ años", schedule: "Todos los días" }
                    ],
                    staff: [
                        { name: "Carlos Ruiz", role: "Director Técnico", exp: "15 años" },
                        { name: "Ana María Polo", role: "Preparadora Física", exp: "8 años" }
                    ]
                };
            }
            return null;
        }
    }
}

export const schoolsAPI = new SchoolsAPI();
