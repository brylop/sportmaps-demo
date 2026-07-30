import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Barra al pie de las tablas: refresca los datos sin recargar la página con F5
 * y muestra la hora del último refresco. Mismo comportamiento que el botón
 * "Actualizar" del módulo de Pagos.
 */

interface TableRefreshBarProps {
  onRefresh: () => void | Promise<unknown>;
  loading?: boolean;
  /** Texto a la izquierda, normalmente el conteo de filas mostradas. */
  summary?: React.ReactNode;
  /** Si se pasa, se usa en lugar del control interno de "última actualización". */
  lastUpdated?: Date | null;
  /** Acciones extra a la derecha (exportar, paginación, etc.). */
  children?: React.ReactNode;
  className?: string;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function TableRefreshBar({
  onRefresh,
  loading = false,
  summary,
  lastUpdated,
  children,
  className,
}: TableRefreshBarProps) {
  // Cuando la página no lleva la cuenta, la deducimos del flanco de bajada de `loading`.
  const [internalUpdated, setInternalUpdated] = useState<Date | null>(null);
  const prevLoading = useRef(loading);

  useEffect(() => {
    if (prevLoading.current && !loading) setInternalUpdated(new Date());
    prevLoading.current = loading;
  }, [loading]);

  const stamp = lastUpdated ?? internalUpdated;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-border/40 bg-muted/10 px-4 py-3',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-medium">
        {summary && <span>{summary}</span>}
        {stamp && (
          <span className="opacity-70">
            Actualizado {formatTime(stamp)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {children}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void onRefresh()}
          disabled={loading}
          className="font-bold"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Actualizar
        </Button>
      </div>
    </div>
  );
}
