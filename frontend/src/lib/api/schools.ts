
// Schools API Service
// Phase: Adapter for V4 Migration
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_BANNER, sportImage } from '@/lib/sportImages';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * `teams.schedule` es jsonb y en la base conviven varias formas: array de
 * `{day,time,end}`, objeto por día, o texto libre. El perfil público lo pinta
 * directo, así que hay que devolver SIEMPRE string — un objeto o array reventaría
 * el render de React ("Objects are not valid as a React child").
 */
function formatSchedule(schedule: any, fallback?: string | null): string {
    if (!schedule) return fallback || 'Horario por definir';
    if (typeof schedule === 'string') return schedule || fallback || 'Horario por definir';
    if (Array.isArray(schedule)) {
        if (!schedule.length) return fallback || 'Horario por definir';
        // Agrupa por hora: [{day:2,time:'16:00',end:'18:00'}] → "Mar/Jue 16:00-18:00"
        const porHora = new Map<string, number[]>();
        for (const s of schedule) {
            if (typeof s !== 'object' || s === null) continue;
            const hora = [s.time, s.end].filter(Boolean).join('-') || 'Por definir';
            porHora.set(hora, [...(porHora.get(hora) || []), Number(s.day)]);
        }
        const partes = [...porHora.entries()].map(([hora, dias]) => {
            const nombres = dias
                .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
                .sort((a, b) => a - b)
                .map((d) => DAYS[d]);
            return nombres.length ? `${nombres.join('/')} ${hora}` : hora;
        });
        return partes.join(' · ') || fallback || 'Horario por definir';
    }
    if (typeof schedule === 'object') {
        const partes = Object.entries(schedule)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
        if (partes.length) return partes.join(' · ');
    }
    return fallback || 'Horario por definir';
}

const money = (n: number, currency = 'COP') =>
    `$${Number(n || 0).toLocaleString('es-CO')}${currency && currency !== 'COP' ? ` ${currency}` : ''}`;

/** school_settings.business_hours — ver migración 20260914184316. */
export interface BusinessHourRow {
    /** 0=domingo .. 6=sábado, igual que DAYS de arriba. */
    day: number;
    closed: boolean;
    open?: string | null;
    close?: string | null;
}

const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
/** Orden de exhibición: Lunes...Domingo (el que ya usaba el horario hardcodeado). */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function formatTime12h(hhmm?: string | null): string {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    if (!Number.isInteger(h)) return hhmm;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m || 0).padStart(2, '0')} ${period}`;
}

/**
 * Agrupa el horario configurado por la escuela en filas "Lunes - Viernes
 * 8:00 AM - 8:00 PM" (mismo aspecto que el bloque hardcodeado que
 * reemplaza). `null` cuando la escuela no configuró nada todavía — el
 * perfil público entonces usa el horario fijo de respaldo.
 */
export function formatBusinessHours(rows: BusinessHourRow[] | null | undefined): { label: string; value: string }[] | null {
    if (!rows || !Array.isArray(rows) || rows.length === 0) return null;

    const byDay = new Map<number, BusinessHourRow>();
    for (const r of rows) {
        if (r && Number.isInteger(r.day) && r.day >= 0 && r.day <= 6) byDay.set(r.day, r);
    }
    if (byDay.size === 0) return null;

    const valueOf = (d: number): string => {
        const r = byDay.get(d);
        if (!r || r.closed) return 'Cerrado';
        if (!r.open || !r.close) return 'Horario por definir';
        return `${formatTime12h(r.open)} - ${formatTime12h(r.close)}`;
    };

    const groups: { days: number[]; value: string }[] = [];
    for (const d of DISPLAY_ORDER) {
        const value = valueOf(d);
        const last = groups[groups.length - 1];
        if (last && last.value === value) last.days.push(d);
        else groups.push({ days: [d], value });
    }

    return groups.map(g => {
        const label = g.days.length > 1
            ? `${DAY_NAMES_FULL[g.days[0]]} - ${DAY_NAMES_FULL[g.days[g.days.length - 1]]}`
            : DAY_NAMES_FULL[g.days[0]];
        return { label, value: g.value };
    });
}

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
    /** school_settings.show_facilities — la página consulta facilities aparte. */
    show_facilities?: boolean;
    /** Layout del perfil público, ver docs/specs/perfil-publico-plantillas.md. */
    public_page_layout?: 'classic' | 'modern' | 'minimal' | 'magazine';
    /** null = la escuela no configuró horarios; el layout usa su respaldo fijo. */
    business_hours?: { label: string; value: string }[] | null;
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
            // Antes esto devolvía la fila cruda de `schools`, que NO trae
            // banner_url/teams/services/staff: el perfil público de cualquier
            // escuela real salía con el banner roto y las tres pestañas vacías.
            if (data) return await this.mapPublicProfile(data, slug);

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
     * Arma el perfil público de una escuela real: equipos, servicios (oferta +
     * tarifas) y entrenadores. Todo lo que consulta acá es legible por `anon`
     * (verificado con la anon key), así que funciona sin iniciar sesión.
     */
    private async mapPublicProfile(school: any, slug: string): Promise<SchoolProfile> {
        // Toggles de visibilidad pública de la escuela. Hoy las 361 escuelas los
        // tienen en true, así que esto no cambia nada para nadie — pero si una
        // apaga "mostrar tarifas", su perfil público deja de publicarlas en vez
        // de que este mapeo las saque igual.
        // Vista y no school_settings: este perfil lo ve cualquiera sin sesión, y
        // la tabla base tiene número de cuenta, cédula del titular, llaves de
        // transferencia y payment_accounts. Ver migración 20260814190601.
        const { data: settings } = await supabase
            .from('v_school_settings_publico')
            .select('show_programs, show_plans, show_facilities, business_hours')
            .eq('school_id', school.id)
            .maybeSingle();
        const showTeams = settings?.show_programs !== false;
        const showPlans = settings?.show_plans !== false;

        const [teamsRes, staffRes, offeringsRes] = await Promise.all([
            supabase
                .from('teams')
                .select('id, name, sport, level, age_min, age_max, age_group, schedule, location, description, image_url, price_monthly')
                .eq('school_id', school.id)
                .eq('active', true)
                .order('name'),
            supabase
                .from('public_staff')
                .select('full_name, specialty')
                .eq('school_id', school.id)
                .eq('status', 'active'),
            supabase
                .from('offerings')
                .select('id, name, description, sport, sort_order, offering_plans(name, price, currency, duration_days, is_active)')
                .eq('school_id', school.id)
                .eq('is_active', true)
                .order('sort_order'),
        ]);

        const brand = school.branding_settings || {};

        const teams = (teamsRes.data || []).map((t: any) => ({
            name: t.name,
            sport: t.sport,
            age: t.age_min && t.age_max
                ? `${t.age_min}-${t.age_max} años`
                : (t.age_group || t.level || t.sport || 'Todas las edades'),
            schedule: formatSchedule(t.schedule, t.location),
            description: t.description,
            price: t.price_monthly > 0 ? `${money(t.price_monthly)}/mes` : null,
            image_url: t.image_url || sportImage(t.sport, t.name),
        }));

        // Una tarjeta de "servicio" por oferta, con el rango de sus tarifas activas.
        const services = (offeringsRes.data || []).map((o: any) => {
            const planes = (o.offering_plans || []).filter((p: any) => p.is_active !== false);
            const precios = planes.map((p: any) => Number(p.price)).filter((n: number) => n > 0);
            const currency = planes[0]?.currency || 'COP';
            return {
                title: o.name,
                description: o.description
                    || (planes.length ? planes.map((p: any) => p.name).join(' · ') : 'Consultar disponibilidad'),
                price: precios.length
                    ? (Math.min(...precios) === Math.max(...precios)
                        ? money(Math.min(...precios), currency)
                        : `Desde ${money(Math.min(...precios), currency)}`)
                    : 'Consultar',
            };
        });

        return {
            ...school,
            slug: school.slug ?? slug,
            banner_url: school.cover_image_url || DEFAULT_BANNER,
            logo_url: school.logo_url || undefined,
            show_facilities: settings?.show_facilities !== false,
            business_hours: formatBusinessHours(settings?.business_hours as unknown as BusinessHourRow[] | null | undefined),
            branding: {
                primaryColor: brand.primary_color || '#248223',
                secondaryColor: brand.secondary_color || '#64748b',
            },
            teams: showTeams ? teams : [],
            services: showPlans ? services : [],
            staff: (staffRes.data || []).map((s: any) => ({
                name: s.full_name,
                role: s.specialty || 'Entrenador',
                exp: s.specialty ? '' : 'Parte del equipo técnico',
            })),
        } as SchoolProfile;
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

            // Cuerpo tecnico del perfil PUBLICO de la escuela.
            //
            // Se lee de la vista y no de school_staff porque esta pantalla la ve
            // cualquiera, sin sesion. La tabla base tiene email, phone y
            // coach_auth_id, y el `select('*')` que habia aca los arrastraba a
            // una pagina publica: 70 fichas de staff de todas las escuelas
            // quedaban legibles con la llave anonima, que viaja en el bundle.
            //
            // La vista expone solo nombre, especialidad y certificaciones, que
            // es lo que la escuela quiere mostrar. Ver migracion 20260814185532.
            const { data: staff } = await supabase
                .from('v_school_staff_publico')
                .select('id, school_id, branch_id, full_name, specialty, certifications')
                .eq('school_id', school.id);

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
