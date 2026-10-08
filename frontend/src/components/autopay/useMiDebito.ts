import { useCallback, useEffect, useState } from 'react';
import { getMiDebito, type MiDebito } from '@/lib/api/autopay';

/**
 * Estado de débito automático de la familia. Si el BFF falla (404/410 mientras
 * no está desplegado, red, etc.) queda en `null` y la UI no muestra nada:
 * nunca debe romper Mis Pagos.
 */
export function useMiDebito(enabled: boolean) {
  const [data, setData] = useState<MiDebito | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await getMiDebito();
      setData(res && Array.isArray(res.schools) && Array.isArray(res.athletes) ? {
        schools: res.schools,
        athletes: res.athletes,
        methods: Array.isArray(res.methods) ? res.methods : [],
      } : null);
    } catch {
      setData(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  return { data, loaded, reload };
}
