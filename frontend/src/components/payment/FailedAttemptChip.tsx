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
  /**
   * Escribir el motivo del banco debajo del chip, además del tooltip. Para la
   * cartera, donde la escuela está decidiendo qué decirle a la familia y no
   * puede ir pasando el mouse fila por fila.
   */
  showReason?: boolean;
  /**
   * `payments.requires_review`. Fuerza el trato de ambiguo aunque no haya
   * motivo parseable: un cobro marcado sin `last_failure_reason` (los hay,
   * de antes de que el webhook guardara el motivo) igual tiene que avisar
   * que no se cobre hasta verificar.
   */
  requiresReview?: boolean;
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
export function FailedAttemptChip({ reason, at, showReason, requiresReview, className }: FailedAttemptChipProps) {
  const parsed = parsePaymentFailure(reason);
  const failure = requiresReview
    ? { ...(parsed ?? { label: '', bankMessage: null }), ambiguous: true, label: 'Verificar en la pasarela' }
    : parsed;
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
      // `whitespace-nowrap`: en la columna Estado de la cartera el rótulo se
      // partía en dos líneas y quedaba «Pago / rechazado» pisando la fecha.
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${tone} ${className ?? ''}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {failure.label}
      {cuando && <span className="font-normal opacity-80">· {cuando}</span>}
    </span>
  );

  const detalle = showReason && (failure.bankMessage || failure.ambiguous) ? (
    <span className="mt-0.5 block max-w-[220px] text-[10px] leading-snug text-muted-foreground">
      {failure.bankMessage
        ?? 'La pasarela no confirmó el resultado. Verificá antes de volver a cobrar.'}
    </span>
  ) : null;

  // Sin nada que ampliar, el tooltip solo estorba.
  if (!failure.bankMessage && !failure.ambiguous) return chip;

  const conTooltip = (
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

  if (!detalle) return conTooltip;

  return (
    <span className="block">
      {conTooltip}
      {detalle}
    </span>
  );
}
