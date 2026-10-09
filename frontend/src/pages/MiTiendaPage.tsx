/**
 * MiTiendaPage — entrada del padre/atleta a la tienda de SU escuela.
 *
 * Resuelve la tienda de la escuela activa (useMySchoolStore → BFF
 * /marketplace/school-store/:schoolId) y redirige a la vitrina pública
 * /tienda/:slug SOLO si esa tienda vende hoy (`selling` =
 * store_seller_allowed: flag + allowlist + adicional + escuela operativa).
 * Si no vende (o la escuela no tiene tienda), un aviso claro — nunca una
 * vitrina vacía. Llega acá quien tenga el enlace /mi-tienda aunque el menú
 * no se lo muestre.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMySchoolStore } from '@/hooks/useMySchoolStore';
import { Button } from '@/components/ui/button';
import { Loader2, Store } from 'lucide-react';

export default function MiTiendaPage() {
  const navigate = useNavigate();
  const { store, isLoading } = useMySchoolStore();
  const target = store?.selling && store.published && store.slug ? `/tienda/${store.slug}` : null;

  useEffect(() => {
    if (target) navigate(target, { replace: true });
  }, [target, navigate]);

  if (isLoading || target) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const schoolName = store?.display_name || 'Tu escuela';
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-6 text-center" data-testid="mi-tienda-unavailable">
      <Store className="h-12 w-12 text-muted-foreground/40" />
      <h1 className="text-xl font-bold">La tienda aún no está disponible</h1>
      <p className="text-muted-foreground max-w-sm">
        {schoolName} todavía no tiene su tienda abierta. Cuando esté lista, la verás en el menú.
      </p>
      <Button variant="outline" onClick={() => navigate('/dashboard')}>Volver al inicio</Button>
    </div>
  );
}
