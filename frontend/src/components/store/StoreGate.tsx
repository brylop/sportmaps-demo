import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Store } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useStoreEnabled } from '@/hooks/useStoreEnabled';
import { Button } from '@/components/ui/button';

/**
 * Pantalla para cuando la tienda está apagada a nivel plataforma
 * (`store_enabled() = false`). Reutilizable fuera de StoreGate.
 */
export function StoreUnavailable() {
  const { user } = useAuth();
  const home = user ? '/dashboard' : '/';

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-lg mx-auto text-center rounded-2xl border bg-card p-10 mt-8">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Store className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Tienda no disponible</h1>
        <p className="text-muted-foreground mt-2">La tienda no está disponible por ahora.</p>
        <Button asChild className="mt-6">
          <Link to={home}>Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}

interface StoreGateProps {
  children: ReactNode;
  /**
   * Qué mostrar con la tienda apagada. Default: la pantalla "Tienda no
   * disponible". Para piezas que no son una página (p. ej. el CartDrawer)
   * se pasa `null`.
   */
  fallback?: ReactNode;
}

/**
 * Guard de la tienda (spec blindaje-dinero §1.3). Va DENTRO de ProtectedRoute
 * cuando la ruta lo tiene: auth/rol primero, disponibilidad de la tienda acá.
 * Fail-closed: mientras carga no renderiza los hijos.
 */
export function StoreGate({ children, fallback }: StoreGateProps) {
  const { enabled, isLoading } = useStoreEnabled();

  if (enabled) return <>{children}</>;

  if (fallback !== undefined) return <>{fallback}</>;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <StoreUnavailable />;
}
