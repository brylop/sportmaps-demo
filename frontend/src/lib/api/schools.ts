
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
            if (slug === 'academiadepor-tigres' || slug === 'demo' || slug === 'spirit-all-stars') {
                return {
                    id: 'demo-school',
                    name: 'Spirit All Stars',
                    slug: slug,
                    description: 'Liderando el cheerleading de alto rendimiento. Formamos atletas integrales con disciplina, pasión y técnica de nivel mundial en acrobatics y stunts.',
                    banner_url: "https://images.unsplash.com/photo-1510531704581-5b2870972060?auto=format&fit=crop&q=80&w=2000",
                    branding: {
                        primaryColor: "#003366", // Navy
                        secondaryColor: "#4D9EE0" // Sky Blue
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
                    programs: [
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
}

export const schoolsAPI = new SchoolsAPI();
