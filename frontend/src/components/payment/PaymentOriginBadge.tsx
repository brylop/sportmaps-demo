/**
 * Badge de origen del pago. Una sola pinta en toda la app para que "entró por
 * Wompi" se vea igual en Finanzas y en Gestión de Pagos.
 */

import { Badge } from '@/components/ui/badge';
import { QrCode } from 'lucide-react';
import {
    resolvePaymentOrigin,
    ORIGIN_BADGE_CLASS,
    type PaymentOriginInput,
} from '@/lib/paymentOrigin';

export function PaymentOriginBadge({ payment, className = '' }: { payment: PaymentOriginInput; className?: string }) {
    const origin = resolvePaymentOrigin(payment);
    return (
        <span className="inline-flex items-center gap-1 flex-wrap">
            <Badge
                variant="outline"
                title={origin.detail}
                className={`text-[10px] py-0 h-5 font-semibold ${ORIGIN_BADGE_CLASS[origin.kind]} ${className}`}
            >
                {origin.label}
            </Badge>
            {origin.viaQr && (
                <Badge
                    variant="outline"
                    title="El cobro nació de una inscripción por QR."
                    className="text-[10px] py-0 h-5 bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200"
                >
                    <QrCode className="h-2.5 w-2.5 mr-0.5" /> QR
                </Badge>
            )}
        </span>
    );
}
