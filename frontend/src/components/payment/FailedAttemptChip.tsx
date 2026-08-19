import { AlertTriangle, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { parsePaymentFailure } from '@/lib/paymentFailure';

interface FailedAttemptChipProps {
  /** `payments.last_failure_reason` tal como viene de la base. */
  reason: string | null | undefined;
  /** `payments.last_failure_at`. */
  at: string | null | undefined;
  className?: string;
}

/**
 * Marca en la fila del cobro que la familia SÍ intentó pagar y se cayó.
 *
 * Va pegado a la deuda, no en una cola aparte: la pregunta que se hace la
 * escuela es «¿por qué esta familia no ha pagado?», y la respuesta sirve para
 * la conversación de cobro — «tu banco rechazó el débito el 8 de agosto,
 * probá con otro medio» cobra plata; «estás en mora» no.
 *
 * No reemplaza al estado del cobro: el cobro sigue vencido, que es la verdad.
 * Por eso es un chip secundario y no un `status`.
 */
export function FailedAttemptChip({ reason, at, className }: FailedAttemptChipProps) {
  const failure = parsePaymentFailure(reason);
  if (!failure) return null;

  const cuando = at ? format(new Date(at), "d 'de' MMM", { locale: es }) : null;

  // Lo ambiguo (ERROR/VOIDED) se pinta distinto: ahí no sabemos si el dinero se
  // movió, y confundirlo con un rechazo llevaría a cobrar dos veces.
  const tone = failure.ambiguous
    ? 'border-orange-300 bg-orange-50 text-orange-700'
    : 'border-amber-300 bg-amber-50 text-amber-700';

  const Icon = failure.ambiguous ? HelpCircle : AlertTriangle;

  const chip = (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${tone} ${className ?? ''}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {failure.label}
      {cuando && <span className="font-normal opacity-80">· {cuando}</span>}
    </span>
  );

  if (!failure.bankMessage && !failure.ambiguous) return chip;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs">
        {failure.bankMessage && <p>{failure.bankMessage}</p>}
        {failure.ambiguous && (
          <p className="mt-1 font-semibold">
            No sabemos si el dinero se movió. Verificá en la pasarela antes de volver a cobrar.
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
