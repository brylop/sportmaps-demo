import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SPORTS_CATALOG, type SportCatalogEntry } from '@/lib/constants/sportsCatalog';

// ============================================================================
// Catálogo de deportes — leído de la BASE, no de la constante
//
// Por qué existe: el catálogo bueno (86 deportes con categorías de competencia
// según IOC/ASOIF/ARISF/AIMS/IPC) vivía SOLO como constante del frontend. Ahí
// no lo podía usar nadie más —ni el BFF, ni las RPC, ni ningún módulo de la
// base— y actualizar una categoría exigía desplegar frontend.
//
// Las migraciones 20260816195545 y 20260816200007 lo subieron a
// `public.sports_categories` (84 de 99 deportes con `categorias_oficiales`).
// Este hook lo lee de ahí.
//
// ── El respaldo no es paranoia ──────────────────────────────────────────────
// Si la consulta falla o todavía no respondió, se devuelve la constante. El
// catálogo alimenta pantallas de registro y de creación de equipos: quedarse
// sin lista de deportes por un problema de red rompe el alta de una escuela.
// La constante es una copia buena y sirve mientras tanto — lo que ya no puede
// pasar es que sea la ÚNICA fuente.
//
// Ojo con `id`: la constante usa enteros (1, 2, 3…) y la base usa uuid. Quien
// guarde el id en algún lado tiene que usar el de la base, que es el que sirve
// como FK contra `sport_metric_definitions.sport_category_id`.
// ============================================================================

export interface SportEntry extends Omit<SportCatalogEntry, 'id'> {
    /** uuid en la BD; number cuando viene del respaldo. */
    id: string | number;
    /** true cuando salió de la constante porque la BD no respondió. */
    esRespaldo?: boolean;
}

interface FilaBD {
    id: string;
    name: string;
    slug: string | null;
    categorias_oficiales: Record<string, unknown> | null;
    federacion_internacional: string | null;
    acronimo_fi: string | null;
    estado_olimpico: string | null;
    is_active: boolean | null;
}

const RESPALDO: SportEntry[] = SPORTS_CATALOG.map((s) => ({ ...s, esRespaldo: true }));

export function useSportsCatalog() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['sports-catalog'],
        queryFn: async (): Promise<SportEntry[]> => {
            const { data, error } = await supabase
                .from('sports_categories')
                .select('id,name,slug,categorias_oficiales,federacion_internacional,acronimo_fi,estado_olimpico,is_active')
                .eq('is_active', true)
                .order('name');
            if (error) throw error;

            return (data as FilaBD[]).map((f) => ({
                id: f.id,
                nombre: f.name,
                nombreIngles: f.name,
                slug: f.slug ?? '',
                federacion: f.federacion_internacional ?? '',
                acronimo: f.acronimo_fi ?? '',
                estadoOlimpico: f.estado_olimpico ?? '',
                // La constante lo usa para agrupar en el combobox. La BD no lo
                // guarda, así que se deja vacío: agrupar es cosa de la UI.
                categoriaGlobal: '' as SportCatalogEntry['categoriaGlobal'],
                categoriasCompetencia: (f.categorias_oficiales ?? {}) as SportCatalogEntry['categoriasCompetencia'],
            }));
        },
        // El catálogo cambia por migración, no por uso: no hace falta refrescarlo.
        staleTime: 60 * 60 * 1000,
        gcTime: 2 * 60 * 60 * 1000,
        retry: 1,
    });

    const sports = data && data.length > 0 ? data : RESPALDO;

    return {
        sports,
        /** Solo los nombres, para los selectores que no necesitan más. */
        nombres: sports.map((s) => s.nombre),
        /** true si se está usando la copia del frontend. */
        usandoRespaldo: !data || data.length === 0,
        isLoading,
        error: error as Error | null,
    };
}

/** Busca por nombre exacto, sin distinguir mayúsculas ni tildes. */
export function buscarDeporte(sports: SportEntry[], nombre: string | null | undefined) {
    if (!nombre) return undefined;
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const objetivo = norm(nombre);
    return sports.find((s) => norm(s.nombre) === objetivo);
}
