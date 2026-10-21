import { useEffect } from 'react';
import { Minus, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    conceptoHorasAdicionales, formatHoras, formatPesos, montoDeHoras, pasoDeHoras, type NewLineDraft,
} from '@/lib/cobrosYPagos';
import type { ChargeSuggestions, EnrollmentOption } from '@/lib/api/chargeBatches';

interface Props {
    line: NewLineDraft;
    suggestions?: ChargeSuggestions | null;
    onPatch: (patch: Partial<NewLineDraft>) => void;
}

/** Inscripciones del atleta con banco de horas (las únicas a las que se pueden sumar horas). */
export function inscripcionesConHoras(s?: ChargeSuggestions | null): EnrollmentOption[] {
    return (s?.enrollments ?? []).filter((e) => e.hours_plan && e.active !== false);
}

/** Borrador inicial de una venta de horas: 1 hora, su tarifa y la inscripción principal con banco. */
export function borradorDeVentaDeHoras(s?: ChargeSuggestions | null, horas = 1): Partial<NewLineDraft> {
    const lista = inscripcionesConHoras(s);
    const enr = lista.find((e) => e.is_primary) ?? lista[0] ?? null;
    return {
        extra_hours: horas,
        overage_charge_id: null,
        enrollment_id: enr?.enrollment_id ?? null,
        concept: conceptoHorasAdicionales(horas),
        amount: montoDeHoras(horas, enr?.hourly_rate) ?? null,
    };
}

/**
 * «Horas adicionales»: o se factura el excedente que el sistema ya calculó al cerrar
 * un período, o se VENDEN horas por adelantado (la familia las pagó antes de usarlas).
 * Sin excedentes pendientes —el caso de Dreamers hasta hoy— solo existe la venta.
 */
export function HorasAdicionalesLine({ line: l, suggestions, onPatch }: Props) {
    const excedentes = suggestions?.overages ?? [];
    const conHoras = inscripcionesConHoras(suggestions);
    const vendiendo = l.extra_hours != null;
    const enr = conHoras.find((e) => e.enrollment_id === l.enrollment_id) ?? null;
    const tarifa = enr?.hourly_rate ?? null;

    // La inscripción del borrador tiene que ser de ESTE atleta y llevar banco de horas. Si el atleta
    // cambió con la línea abierta, o las sugerencias llegaron después de crear el borrador, se corrige
    // sola (sin esto quedaba la inscripción del atleta anterior y el servidor respondía «no es de este atleta»).
    useEffect(() => {
        if (!vendiendo) return;
        if (conHoras.length === 0) {
            if (l.enrollment_id) onPatch({ enrollment_id: null });
            return;
        }
        if (l.enrollment_id && conHoras.some((e) => e.enrollment_id === l.enrollment_id)) return;
        const nuevo = borradorDeVentaDeHoras(suggestions, l.extra_hours ?? 1);
        onPatch({ enrollment_id: nuevo.enrollment_id ?? null, ...(nuevo.amount != null ? { amount: nuevo.amount } : {}) });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vendiendo, l.enrollment_id, suggestions]);

    const cambiarHoras = (h: number) => {
        const sugerido = montoDeHoras(h, tarifa);
        onPatch({ extra_hours: h, concept: conceptoHorasAdicionales(h), ...(sugerido != null ? { amount: sugerido } : {}) });
    };

    return (
        <div className="space-y-2" data-testid="cyp-horas-adicionales">
            {excedentes.length > 0 && (
                <div className="inline-flex rounded-lg border p-0.5 text-xs" role="group" aria-label="Qué se cobra">
                    <Button
                        type="button" size="sm" variant={vendiendo ? 'ghost' : 'secondary'} className="h-7 text-xs"
                        onClick={() => onPatch({ extra_hours: null, concept: 'Horas adicionales', enrollment_id: null })}
                    >
                        Excedente del período
                    </Button>
                    <Button
                        type="button" size="sm" variant={vendiendo ? 'secondary' : 'ghost'} className="h-7 text-xs"
                        onClick={() => onPatch(borradorDeVentaDeHoras(suggestions))}
                    >
                        Horas vendidas
                    </Button>
                </div>
            )}

            {!vendiendo && (
                <Select
                    value={l.overage_charge_id ?? undefined}
                    onValueChange={(v) => {
                        const o = excedentes.find((x) => x.id === v);
                        onPatch({ overage_charge_id: v, amount: o?.amount ?? l.amount, concept: o ? `Horas adicionales ${o.period_label}` : l.concept });
                    }}
                >
                    <SelectTrigger className="h-9 text-sm" aria-label="Período de horas adicionales">
                        <SelectValue placeholder={excedentes.length > 0 ? 'Elige el período' : 'No hay excedentes por facturar'} />
                    </SelectTrigger>
                    <SelectContent>
                        {excedentes.map((o) => <SelectItem key={o.id} value={o.id}>{o.period_label} — {formatPesos(o.amount)}</SelectItem>)}
                    </SelectContent>
                </Select>
            )}

            {vendiendo && conHoras.length === 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1" role="alert" data-testid="cyp-horas-sin-banco">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    Este atleta no tiene un plan con banco de horas, así que no se le pueden sumar horas. Cobra esto como «Otro cobro» o configura las horas de su plan.
                </p>
            )}

            {vendiendo && conHoras.length > 0 && (
                <>
                    {conHoras.length > 1 && (
                        <Select
                            value={l.enrollment_id ?? undefined}
                            onValueChange={(v) => {
                                const e = conHoras.find((x) => x.enrollment_id === v);
                                const sugerido = montoDeHoras(l.extra_hours ?? 1, e?.hourly_rate);
                                onPatch({ enrollment_id: v, ...(sugerido != null ? { amount: sugerido } : {}) });
                            }}
                        >
                            <SelectTrigger className="h-9 text-sm" aria-label="Inscripción a la que se suman las horas"><SelectValue placeholder="¿A cuál plan?" /></SelectTrigger>
                            <SelectContent>
                                {conHoras.map((e) => (
                                    <SelectItem key={e.enrollment_id} value={e.enrollment_id}>
                                        {[e.plan_name, e.team_name].filter(Boolean).join(' · ') || 'Inscripción'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">Horas vendidas</span>
                        <Button
                            type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="Una hora menos"
                            onClick={() => cambiarHoras(pasoDeHoras(l.extra_hours ?? 1, -1))}
                        >
                            <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                            aria-label="Horas vendidas"
                            type="number" inputMode="decimal" step={0.25} min={0.25} max={24}
                            className="h-9 w-24 text-sm tabular-nums text-center"
                            value={l.extra_hours ?? ''}
                            onChange={(e) => {
                                const v = e.target.value === '' ? null : Number(e.target.value);
                                if (v == null || Number.isNaN(v)) { onPatch({ extra_hours: 0 }); return; }
                                cambiarHoras(v);
                            }}
                        />
                        <Button
                            type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="Una hora más"
                            onClick={() => cambiarHoras(pasoDeHoras(l.extra_hours ?? 0, 1))}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-muted-foreground tabular-nums" data-testid="cyp-horas-resumen">
                            {l.extra_hours && l.extra_hours > 0 ? `= ${formatHoras(l.extra_hours)} h` : ''}
                        </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground" data-testid="cyp-horas-tarifa">
                        {tarifa != null
                            ? <>Tarifa {formatPesos(tarifa)} por hora{enr?.plan_name ? ` (plan ${enr.plan_name} ÷ sus horas)` : ''}. Puedes cambiar el valor.</>
                            : 'El plan no tiene tarifa por hora calculada: escribe el valor.'}
                        {' '}Las horas se suman al banco solo cuando el cobro queda <b>pagado</b> (deja marcado «Pagar»).
                    </p>
                </>
            )}
        </div>
    );
}
