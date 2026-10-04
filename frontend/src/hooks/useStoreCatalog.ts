import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchStoreCatalog, type StoreCatalog } from '@/lib/api/storeApi';

/**
 * Catálogo de una tienda (vitrina y ficha). La clave lleva el usuario porque
 * la respuesta cambia: un miembro de la escuela ve también `school_only`.
 */
export function useStoreCatalog(slug: string | undefined) {
  const { user, loading } = useAuth();
  return useQuery<StoreCatalog>({
    queryKey: ['store', 'catalog', slug, user?.id ?? 'anon'],
    queryFn: () => fetchStoreCatalog(slug!, !!user),
    // Esperar a saber si hay sesión: si no, un miembro vería el catálogo
    // anónimo (sin school_only) y quedaría en caché.
    enabled: !!slug && !loading,
    staleTime: 30_000,
    retry: false,
  });
}
