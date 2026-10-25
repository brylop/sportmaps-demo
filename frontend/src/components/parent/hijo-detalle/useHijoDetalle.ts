/** Lecturas compartidas de las pantallas internas de un hijo (acudiente V2). */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface HijoBasico {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

/** Los hijos del acudiente con sesión (para el selector y la cabecera). */
export function useHijosDelAcudiente() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['hijo-detalle-hijos', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('id, full_name, avatar_url')
        .eq('parent_id', user!.id)
        .order('full_name');
      if (error) throw error;
      return (data ?? []) as HijoBasico[];
    },
    enabled: !!user?.id,
  });
}

/** Un hijo por id (para las pantallas que no tienen selector). */
export function useHijoBasico(id: string | undefined) {
  return useQuery({
    queryKey: ['child-basic', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('children').select('id, full_name').eq('id', id!).single();
      if (error) throw error;
      return data as HijoBasico;
    },
    enabled: !!id,
  });
}
