import { useEffect, useState } from 'react';
import { listAvailableProviders } from '@/lib/api/mercadopago';
import { openWompiCheckout, type WompiTransactionResult } from '@/lib/api/wompi';
import MercadoPagoBrick from './MercadoPagoBrick';
import type { PaymentProvider, ProviderInfo } from '@/types/payments';

interface CommonContext {
    schoolId?: string | null;
    vendorId?: string | null;
    /** referencia de la transaccion ya creada por el BFF */
    reference: string;
    /** monto en COP decimal (no cents) */
    transactionAmount: number;
    /** customer info para el checkout */
    customerEmail: string;
    customerName: string;
    customerPhone?: string;
    customerFirstName?: string;
    customerLastName?: string;
    /** Datos opcionales para el Widget Wompi */
    redirectUrl?: string;
    schoolName?: string;
    studentName?: string;
    teamName?: string;
    description?: string;
    authToken?: string;
}

export interface ProviderResult {
    provider: PaymentProvider;
    /** Wompi: payload del Widget. MP: payload del create-payment. */
    payload: WompiTransactionResult | { paymentId: number; status: string };
}

interface Props extends CommonContext {
    /** Si el BFF ya retorno provider+publicKey en la sesion, evita el GET providers. */
    initialProvider?: ProviderInfo | null;
    onSuccess: (result: ProviderResult) => void;
    onError?: (err: Error) => void;
    onCancel?: () => void;
}

/**
 * Componente "puerta de entrada" para checkouts multi-provider.
 *
 * Comportamiento:
 *  - Si initialProvider viene definido (caso ideal: el BFF ya resolvio en
 *    create-session/checkout/cart), usa ese directamente.
 *  - Sino, consulta listAvailableProviders y:
 *      * 0 providers → onError('no_providers_configured')
 *      * 1 provider  → renderiza el UI de ese provider
 *      * 2 providers → muestra selector visual primero
 */
export function PaymentProviderGate(props: Props) {
    const {
        initialProvider,
        schoolId,
        vendorId,
        reference,
        transactionAmount,
        customerEmail,
        customerName,
        customerPhone,
        customerFirstName,
        customerLastName,
        redirectUrl,
        schoolName,
        studentName,
        teamName,
        description,
        authToken,
        onSuccess,
        onError,
        onCancel,
    } = props;

    const [available, setAvailable] = useState<ProviderInfo[] | null>(
        initialProvider ? [initialProvider] : null,
    );
    const [chosen, setChosen] = useState<ProviderInfo | null>(initialProvider ?? null);

    useEffect(() => {
        if (initialProvider) return;
        let cancelled = false;
        (async () => {
            try {
                const { providers } = await listAvailableProviders({ schoolId, vendorId, authToken });
                if (cancelled) return;
                setAvailable(providers);
                if (providers.length === 1) {
                    setChosen(providers[0]);
                }
                if (providers.length === 0) {
                    onError?.(new Error('No hay providers de pago configurados.'));
                }
            } catch (err: any) {
                onError?.(err instanceof Error ? err : new Error(String(err)));
            }
        })();
        return () => { cancelled = true; };
    }, [schoolId, vendorId, authToken, initialProvider, onError]);

    if (!available) {
        return <div className="text-sm text-muted-foreground">Cargando metodos de pago...</div>;
    }

    if (available.length === 0) {
        return <div className="text-sm text-red-600">No hay metodos de pago disponibles.</div>;
    }

    // Selector cuando hay 2 providers y aun no se escogio
    if (available.length > 1 && !chosen) {
        return (
            <div className="space-y-3">
                <p className="text-sm font-medium">Selecciona el medio de pago</p>
                <div className="grid grid-cols-2 gap-3">
                    {available.map(p => (
                        <button
                            key={p.provider}
                            type="button"
                            onClick={() => setChosen(p)}
                            className="rounded border-2 p-4 text-center hover:border-primary transition-colors"
                            data-default={p.isDefault}
                        >
                            <div className="text-base font-semibold">
                                {p.provider === 'wompi' ? 'Wompi' : 'MercadoPago'}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {p.provider === 'wompi'
                                    ? 'Tarjetas, PSE, Nequi, Bancolombia'
                                    : 'Tarjetas, PSE, Efecty, Wallet MP'}
                            </div>
                            {p.sandbox && (
                                <div className="mt-1 text-[10px] uppercase tracking-wide text-yellow-600">
                                    sandbox
                                </div>
                            )}
                        </button>
                    ))}
                </div>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        Cancelar
                    </button>
                )}
            </div>
        );
    }

    if (!chosen) return null;

    if (chosen.provider === 'mercadopago') {
        return (
            <MercadoPagoBrick
                publicKey={chosen.publicKey}
                sandbox={chosen.sandbox}
                transactionAmount={transactionAmount}
                externalReference={reference}
                payerEmail={customerEmail}
                payerFirstName={customerFirstName ?? customerName.split(' ')[0]}
                payerLastName={customerLastName ?? customerName.split(' ').slice(1).join(' ')}
                description={description}
                schoolId={schoolId}
                vendorId={vendorId}
                authToken={authToken}
                onSuccess={(result) => onSuccess({
                    provider: 'mercadopago',
                    payload: { paymentId: result.paymentId, status: result.status },
                })}
                onPending={(result) => onSuccess({
                    provider: 'mercadopago',
                    payload: { paymentId: result.paymentId, status: result.status },
                })}
                onError={(err) => onError?.(err)}
            />
        );
    }

    // Wompi — abrir Widget. La firma se pide internamente al Edge Function.
    return (
        <button
            type="button"
            className="w-full rounded bg-primary px-4 py-3 text-white font-medium hover:bg-primary/90"
            onClick={async () => {
                const result = await openWompiCheckout({
                    reference,
                    amountInCents: Math.round(transactionAmount * 100),
                    customerEmail,
                    customerName,
                    customerPhone,
                    redirectUrl,
                    schoolId: schoolId ?? undefined,
                    schoolName,
                    studentName,
                    teamName,
                });
                if (!result) {
                    onError?.(new Error('Wompi widget no inicio'));
                    return;
                }
                onSuccess({ provider: 'wompi', payload: result });
            }}
        >
            Pagar con Wompi
        </button>
    );
}

export default PaymentProviderGate;
