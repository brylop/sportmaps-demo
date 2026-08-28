import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { formatDayCO } from '@/lib/dateUtils';

interface NextMonthCloseCardProps {
  schoolId: string | null | undefined;
  activeBranchId: string | null | undefined;
}

/**
 * Próximo cierre de mes — vista previa del mismo `preview_open_month` que ya
 * usa el botón manual de Gestión de Pagos (Config). No se duplica la lógica
 * de generación acá, solo se reutiliza la RPC de solo lectura para que se
 * vea, junto a la cartera vieja, lo que se generaría del mes que sigue.
 */
export function NextMonthCloseCard({ schoolId, activeBranchId }: NextMonthCloseCardProps) {
  const { data: nextMonthPreview, isLoading: nextMonthLoading } = useQuery({
    queryKey: ['next-month-preview', schoolId, activeBranchId],
    queryFn: async () => {
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const { data, error } = await (supabase as any).rpc('preview_open_month', {
        p_school_id: schoolId,
        p_year: nextMonth.getFullYear(),
        p_month: nextMonth.getMonth() + 1,
        p_branch_id: activeBranchId || null,
      });
      if (error) throw error;
      return data as { count: number; due_date: string; items: Array<{ amount: number }> };
    },
    enabled: !!schoolId,
  });

  const nextMonthTotal = (nextMonthPreview?.items ?? []).reduce((s, i) => s + Number(i.amount), 0);

  return (
    <>
      {/* Vista previa de solo lectura: reutiliza preview_open_month, la misma
          RPC que ya usa el botón "Generar" de Gestión de Pagos → Config. No
          se genera nada desde acá — es para ver antes de ir a disparar el
          cambio de mes manual. */}
      {nextMonthLoading ? (
        <p className="text-sm text-muted-foreground">Calculando...</p>
      ) : nextMonthPreview ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Si se abre el mes ahora, se generarían:
            </p>
            <p className="text-2xl font-bold">
              {nextMonthPreview.count} cobros · {formatCurrency(nextMonthTotal)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Vencen el {formatDayCO(nextMonthPreview.due_date)}
            </p>
          </div>
          <Button asChild variant="outline">
            {/* ?tab=config: sin esto caía en el tab "Cobros" por defecto y el
                botón de abrir el mes (en "Config") quedaba invisible. El
                cierre de mes (F1) vive en su propio tab "Cierre", no acá. */}
            <Link to="/payments-automation?tab=config">
              Abrir el mes en Gestión de Pagos
            </Link>
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No se pudo calcular la vista previa.</p>
      )}
    </>
  );
}
