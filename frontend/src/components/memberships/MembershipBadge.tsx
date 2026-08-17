import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle } from 'lucide-react';
import type { Membresia } from '@/hooks/useMemberships';

// ============================================================================
// Estado de la membresía del club (CAR-4)
//
// Muestra lo DECLARADO por la escuela, no una conclusión nuestra. La distinción
// importa: `valid_until` no vence solo a propósito, porque el dato viene del
// sistema del club y puede llegar rezagado. Si esta insignia dijera «vencida»
// por su cuenta, estaría inventando suspendidos.
//
// Cuando la fecha ya pasó pero la escuela la tiene como activa, se muestra
// «activa» con un triángulo: es un aviso de que hay que revisar el dato, no un
// cambio de estado.
// ============================================================================

const ESTILO: Record<Membresia['status'], { texto: string; clase: string }> = {
    active:    { texto: 'Membresía activa',    clase: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
    expired:   { texto: 'Membresía vencida',   clase: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30' },
    suspended: { texto: 'Membresía suspendida', clase: 'bg-destructive/10 text-destructive border-destructive/30' },
};

const ORIGEN: Record<Membresia['source'], string> = {
    manual: 'cargada a mano',
    import: 'cargada por archivo',
    api: 'sincronizada con el club',
};

function fecha(iso: string | null) {
    if (!iso) return null;
    return new Date(`${iso}T00:00:00`).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

interface Props {
    membresia?: Membresia;
    /** Compacto para tablas: solo el punto y el texto corto. */
    compacto?: boolean;
}

export function MembershipBadge({ membresia, compacto = false }: Props) {
    if (!membresia) {
        return (
            <Badge variant="outline" className="text-muted-foreground font-normal">
                {compacto ? 'Sin membresía' : 'Sin membresía registrada'}
            </Badge>
        );
    }

    const estilo = ESTILO[membresia.status];
    const revisar = membresia.status === 'active' && membresia.fecha_vencida;
    const hasta = fecha(membresia.valid_until);

    const insignia = (
        <Badge variant="outline" className={`font-normal gap-1 ${estilo.clase}`}>
            {revisar && <AlertTriangle className="h-3 w-3 shrink-0" />}
            {compacto ? estilo.texto.replace('Membresía ', '') : estilo.texto}
            {!compacto && hasta && <span className="opacity-70">· hasta {hasta}</span>}
        </Badge>
    );

    const detalle: string[] = [];
    if (hasta) detalle.push(membresia.fecha_vencida ? `Venció el ${hasta}` : `Vigente hasta el ${hasta}`);
    detalle.push(ORIGEN[membresia.source]);
    if (membresia.external_ref) detalle.push(`ref. del club: ${membresia.external_ref}`);

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild><span className="inline-flex">{insignia}</span></TooltipTrigger>
                <TooltipContent className="max-w-[260px]">
                    <p className="text-xs">{detalle.join(' · ')}</p>
                    {revisar && (
                        <p className="text-xs mt-1 text-amber-500">
                            La escuela la tiene como activa pero la fecha ya pasó. El estado no se cambia
                            solo: hay que revisar el dato con el club.
                        </p>
                    )}
                    {membresia.notes && <p className="text-xs mt-1 opacity-80">{membresia.notes}</p>}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
