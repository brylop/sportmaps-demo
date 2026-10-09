import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useStoreEnabled } from '@/hooks/useStoreEnabled';
import { bffClient } from '@/lib/api/bffClient';
import { buyerStoreVisibility, type BuyerStoreVisibility } from '@/lib/store/buyerStoreVisibility';

/**
 * useMySchoolStore — la tienda de la ESCUELA ACTIVA vista por el COMPRADOR
 * (padre / atleta). Distinto de `useSchoolStore`, que es para quien la
 * administra (owner / school_admin) y lee la RPC `my_school_store`.
 *
 * Multi-escuela: usa `schoolId` del contexto (la escuela activa); al cambiar de
 * escuela cambia la query key y se vuelve a preguntar.
 *
 * Solo pregunta con el flag prendido: con el flag apagado el endpoint responde
 * 503 y el resultado sería «no» igual. Fail-closed: cargando o con error, no se
 * muestra nada.
 */
export interface MySchoolStore {
  slug: string | null;
  published: boolean;
  display_name: string | null;
  selling: boolean;
  has_orders: boolean;
}

export function mySchoolStoreQueryKey(schoolId: string | null | undefined, userId: string | null | undefined) {
  return ['my-school-store', schoolId ?? null, userId ?? null] as const;
}

export async function fetchMySchoolStore(schoolId: string): Promise<MySchoolStore | null> {
  try {
    const r = await bffClient.get<{ ok: boolean; data?: Partial<MySchoolStore> }>(
      `/api/v1/marketplace/school-store/${schoolId}`,
    );
    if (!r?.ok || !r.data) return null;
    return {
      slug: r.data.slug ?? null,
      published: r.data.published === true,
      display_name: r.data.display_name ?? null,
      selling: r.data.selling === true,
      has_orders: r.data.has_orders === true,
    };
  } catch {
    return null;
  }
}

export function useMySchoolStore(opts: { enabled?: boolean } = {}): BuyerStoreVisibility & {
  store: MySchoolStore | null;
  isLoading: boolean;
} {
  const { user } = useAuth();
  const { schoolId } = useSchoolContext();
  const { enabled: storeEnabled, isLoading: flagLoading } = useStoreEnabled();
  const active = (opts.enabled ?? true) && !!user?.id && !!schoolId && storeEnabled;

  const query = useQuery({
    queryKey: mySchoolStoreQueryKey(schoolId, user?.id),
    enabled: active,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: () => fetchMySchoolStore(schoolId as string),
  });

  const store = active ? (query.data ?? null) : null;
  return {
    store,
    ...buyerStoreVisibility({
      storeEnabled,
      schoolSells: store?.selling === true,
      hasOrders: store?.has_orders === true,
    }),
    isLoading: flagLoading || (active && query.isLoading),
  };
}
