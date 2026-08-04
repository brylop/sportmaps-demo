/**
 * Badge de origen del pago. Una sola pinta en toda la app para que "entró por
 * Wompi" se vea igual en Finanzas y en Gestión de Pagos.
 *
 * Sobre el layout: la etiqueta va en la pastilla y el matiz ("sin soporte",
 * "Tarjeta") DEBAJO, en texto tenue. La primera versión metía todo dentro del
 * badge con alto fijo `h-5`: el texto se partía en dos líneas, la pastilla seguía
 * midiendo 20px y su borde inferior cruzaba las letras — se leía como tachado.
 * De ahí `whitespace-nowrap` (la pastilla nunca parte) y alto automático.
 */

import { Badge } from '@/components/ui/badge';
import { QrCode } from 'lucide-react';
import {
    resolvePaymentOrigin,
    ORIGIN_BADGE_CLASS,
    type PaymentOriginInput,
} from '@/lib/paymentOrigin';

export function PaymentOriginBadge({
    payment,
    className = '',
    /** Oculta el matiz. Útil en tarjetas mobile muy apretadas. */
    compact = false,
}: {
    payment: PaymentOriginInput;
    className?: string;
    compact?: boolean;
}) {
    const origin = resolvePaymentOrigin(payment);
    return (
        <span className="inline-flex flex-col items-start gap-0.5 align-middle" title={origin.detail}>
            <span className="inline-flex items-center gap-1">
                <Badge
                    variant="outline"
                    className={`text-[10px] leading-tight py-0.5 whitespace-nowrap font-semibold ${ORIGIN_BADGE_CLASS[origin.kind]} ${className}`}
                >
                    {origin.label}
                </Badge>
                {origin.viaQr && (
                    <Badge
                        variant="outline"
                        title="El cobro nació de una inscripción por QR."
                        className="text-[10px] leading-tight py-0.5 whitespace-nowrap bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200"
                    >
                        <QrCode className="h-2.5 w-2.5 mr-0.5 shrink-0" /> QR
                    </Badge>
                )}
            </span>
            {!compact && origin.qualifier && (
                <span className="text-[10px] leading-tight text-muted-foreground whitespace-nowrap">
                    {origin.qualifier}
                </span>
            )}
        </span>
    );
}
