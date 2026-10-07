import { HeartPulse } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatDayCO } from '@/lib/dateUtils';
import { AVAILABILITY_LABEL, AVAILABILITY_TONE, BODY_REGION_LABEL, RTP_STAGE_LABEL } from '@/lib/clinical/labels';
import type { AvailabilityStatus, BodyRegion, RtpStage } from '@/lib/clinical/types';

interface Props {
  status: AvailabilityStatus;
  stage?: RtpStage | null;
  restrictions?: string | null;
  expectedReturn?: string | null;
  bodyRegion?: BodyRegion | null;
  professionalName?: string | null;
  className?: string;
}

/**
 * Badge pequeño de disponibilidad médica. Al tocarlo (sirve en celular, donde
 * un tooltip de hover no existe) muestra etapa, restricciones y regreso.
 */
export function AvailabilityBadge({ status, stage, restrictions, expectedReturn, bodyRegion, professionalName, className }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-1.5 h-5 text-[10px] font-semibold leading-none whitespace-nowrap',
            AVAILABILITY_TONE[status],
            className,
          )}
          aria-label={`Disponibilidad médica: ${AVAILABILITY_LABEL[status]}`}
        >
          <HeartPulse className="w-3 h-3" />
          {AVAILABILITY_LABEL[status]}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-sm space-y-1.5" onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold">{AVAILABILITY_LABEL[status]}</p>
        {bodyRegion && <p className="text-muted-foreground">Zona: {BODY_REGION_LABEL[bodyRegion] ?? bodyRegion}</p>}
        {stage && <p><span className="text-muted-foreground">Etapa:</span> {RTP_STAGE_LABEL[stage] ?? stage}</p>}
        {restrictions && <p><span className="text-muted-foreground">Restricciones:</span> {restrictions}</p>}
        {expectedReturn && <p><span className="text-muted-foreground">Regreso estimado:</span> {formatDayCO(expectedReturn)}</p>}
        {professionalName && <p className="text-xs text-muted-foreground">Reportado por {professionalName}</p>}
      </PopoverContent>
    </Popover>
  );
}

export default AvailabilityBadge;
