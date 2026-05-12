import { useEffect, useState } from 'react';
import { useShippingQuote, type QuoteOption, type ShippingAddress, CARRIER_LABEL } from '@/hooks/useShipping';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Truck, Zap, Store, MapPin } from 'lucide-react';

interface Props {
    origin:        ShippingAddress;
    destination:   ShippingAddress;
    weightGrams:   number;
    declaredValue: number;
    vendorProfileId?: string;
    cartId?:       string;
    /** Llamado cuando el usuario selecciona una opción */
    onSelect:      (option: QuoteOption | null, quoteId: string | null) => void;
}

function formatCOP(n: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

const CARRIER_ICON: Record<string, typeof Truck> = {
    mensajeros_urbanos: Zap,
    picap:              Zap,
    rappi_cargo:        Zap,
    pickup_in_store:    Store,
    vendor_delivers:    MapPin,
};

export function ShippingSelector({ origin, destination, weightGrams, declaredValue, vendorProfileId, cartId, onSelect }: Props) {
    const quote = useShippingQuote();
    const [options, setOptions]   = useState<QuoteOption[]>([]);
    const [quoteId, setQuoteId]   = useState<string | null>(null);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

    useEffect(() => {
        if (!origin.city || !destination.city || weightGrams <= 0) return;
        let cancelled = false;

        (async () => {
            try {
                const r = await quote.mutateAsync({
                    origin, destination, weight_grams: weightGrams, declared_value: declaredValue,
                    vendor_profile_id: vendorProfileId, cart_id: cartId,
                });
                if (cancelled) return;
                setOptions(r.quotes);
                setQuoteId(r.quote_id);

                // Auto-select la más barata
                if (r.quotes.length > 0) {
                    const cheapest = r.quotes.reduce((a, b) => a.cost <= b.cost ? a : b);
                    const idx = r.quotes.indexOf(cheapest);
                    setSelectedIdx(idx);
                    onSelect(cheapest, r.quote_id);
                }
            } catch (e) {
                if (!cancelled) {
                    setOptions([]);
                    onSelect(null, null);
                }
            }
        })();

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [origin.city, destination.city, weightGrams, declaredValue, vendorProfileId]);

    const handleSelect = (idx: number) => {
        setSelectedIdx(idx);
        onSelect(options[idx], quoteId);
    };

    if (quote.isPending && options.length === 0) {
        return (
            <Card>
                <CardContent className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cotizando envío...
                </CardContent>
            </Card>
        );
    }

    if (!options.length) {
        return (
            <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                    Ingresa una dirección de envío para ver opciones.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                Opciones de envío
            </h3>
            {options.map((opt, idx) => {
                const active = selectedIdx === idx;
                const Icon = CARRIER_ICON[opt.carrier_code] || Truck;
                const carrierName = CARRIER_LABEL[opt.carrier_code] || opt.carrier_code;
                const isFree = opt.free_above != null && declaredValue >= opt.free_above;

                return (
                    <button
                        key={`${opt.carrier_code}-${opt.service}-${idx}`}
                        type="button"
                        onClick={() => handleSelect(idx)}
                        className={`w-full text-left rounded-lg border p-3 transition-colors ${
                            active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`h-9 w-9 shrink-0 rounded-md flex items-center justify-center ${
                                    active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                                }`}>
                                    <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{carrierName}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {opt.service} · {opt.days_min === opt.days_max ? `${opt.days_min} día` : `${opt.days_min}-${opt.days_max} días`} hábiles
                                    </p>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                {isFree ? (
                                    <span className="text-sm font-semibold text-emerald-600">GRATIS</span>
                                ) : (
                                    <span className="text-sm font-semibold">{formatCOP(opt.cost)}</span>
                                )}
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
