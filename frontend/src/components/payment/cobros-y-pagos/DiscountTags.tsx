import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { LineTag } from '@/lib/cobrosYPagos';

const KIND_CLASS: Record<LineTag['kind'], string> = {
    auto: 'border-violet-300 text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/30',
    linea: 'border-violet-400 text-violet-800 dark:text-violet-200 bg-violet-100 dark:bg-violet-900/40',
    general: 'border-violet-400 text-violet-800 dark:text-violet-200 bg-violet-100 dark:bg-violet-900/40',
    cierre: 'border-violet-400 text-violet-800 dark:text-violet-200 bg-violet-100 dark:bg-violet-900/40',
    condonacion: 'border-orange-300 text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/30',
    exoneracion: 'border-violet-500 text-violet-900 dark:text-violet-100 bg-violet-200 dark:bg-violet-800/40',
};

/**
 * Descuentos de un cobro EN ORDEN (D16, §15.6): los que ya trae (militar,
 * hermanos, solo este mes, pronto pago congelado) y luego los del modal. Si el
 * total pasa del 50 % del valor de lista: aviso amarillo, no bloqueo.
 */
export function DiscountTags({ tags, ratio, over50 }: { tags: LineTag[]; ratio?: number; over50?: boolean }) {
    if (tags.length === 0 && !over50) return null;
    return (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="discount-tags">
            {tags.map((t, i) => (
                <Badge key={`${t.label}-${i}`} variant="outline" className={`text-[11px] font-medium ${KIND_CLASS[t.kind]}`}>
                    {t.label}
                </Badge>
            ))}
            {over50 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300" role="status">
                    <AlertTriangle className="h-3 w-3" />
                    Descuento total {Math.round((ratio ?? 0) * 100)} %: revisa
                </span>
            )}
        </div>
    );
}
