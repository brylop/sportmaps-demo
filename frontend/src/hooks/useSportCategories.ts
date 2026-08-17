import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { toast } from '@/hooks/use-toast';

// ============================================================================
// Categorías de un deporte, para UNA escuela.
//
// Devuelve la unión de dos cosas que no son lo mismo:
//   · las OFICIALES del catálogo (FIFA, IOC, IASF…) — `sports_categories`
//   · las PROPIAS que agregó la escuela            — `sport_configs.rules`
//
// El caso que lo justifica: fútbol oficial trae Sub-11, 13, 15, 17, 20, 23 y
// Senior. Sub-19 no está, y media Colombia juega Sub-19. La escuela la agrega y
// queda mapeada, en vez de vivir escrita a mano en el nombre del equipo.
//
// `adoptada` distingue lo que la escuela ya usa de lo que el catálogo le
// ofrece; `grupo` permite separar «categorias_edad» de «modalidades», que
// mezclados hacen un selector ilegible.
// ============================================================================

export interface CategoriaDeporte {
    nombre: string;
    origen: 'oficial' | 'propia';
    adoptada: boolean;
    detalle: {
        name?: string;
        origen?: string;
        grupo?: string;
        min?: number;
        max?: number;
        min_rating?: number;
        max_rating?: number;
        min_kg?: number;
        max_kg?: number;
        order?: number;
    } | null;
}

export function useSportCategories(sport: string | null | undefined) {
    const { schoolId } = useSchoolContext();
    const qc = useQueryClient();
    const key = ['sport-categories', schoolId, sport];

    const query = useQuery({
        queryKey: key,
        queryFn: async (): Promise<CategoriaDeporte[]> => {
            const { data, error } = await supabase.rpc('school_sport_categories' as any, {
                p_school_id: schoolId,
                p_sport: sport,
            });
            if (error) throw error;
            return (data ?? []) as CategoriaDeporte[];
        },
        enabled: !!schoolId && !!sport,
        staleTime: 5 * 60 * 1000,
    });

    const agregar = useMutation({
        mutationFn: async (v: { nombre: string; min?: number | null; max?: number | null }) => {
            const { data, error } = await supabase.rpc('school_add_sport_category' as any, {
                p_school_id: schoolId,
                p_sport: sport,
                p_nombre: v.nombre,
                p_min: v.min ?? null,
                p_max: v.max ?? null,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            // Se relee en vez de asumir: el RPC arma la regla según el eje del
            // deporte, así que lo que quedó guardado no es exactamente lo que
            // se mandó.
            qc.invalidateQueries({ queryKey: key });
            toast({ title: 'Categoría agregada' });
        },
        onError: (e: any) => {
            toast({
                title: 'No se pudo agregar',
                // El mensaje del RPC es específico y útil ("falta el rango",
                // "ya existe", "el deporte no está configurado"): se muestra tal
                // cual en vez de un genérico.
                description: e?.message ?? 'Error desconocido',
                variant: 'destructive',
            });
        },
    });

    const cats = query.data ?? [];
    return {
        categorias: cats,
        adoptadas: cats.filter((c) => c.adoptada),
        sugeridas: cats.filter((c) => !c.adoptada),
        propias: cats.filter((c) => c.origen === 'propia'),
        agregar,
        isLoading: query.isLoading,
        error: query.error as Error | null,
    };
}
