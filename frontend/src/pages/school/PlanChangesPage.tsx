/**
 * PlanChangesPage — «Cambios de plan» (reporte para dueño/admin/contador).
 * Spec: docs/specs/whatsapp-conversacion-v2-dynasty.md §3.7-3.8. Contrato: bff/src/routes/plan-changes.routes.ts.
 *
 * Modo SOMBRA = solo registra lo que cambiaría, no toca planes. «Simular un mes» corre en dry_run
 * (no escribe); escribir filas de sombra exige confirmación explícita.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { bffClient, BFFError } from '@/lib/api/bffClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, Download, FlaskConical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    aCsv, armarQuery, ETIQUETA_DIRECCION, formatoCOP, nombreMes, razonLegible, rotuloModo,
    type CambioPlan, type FiltrosCambios, type Propuesta, type ResultadoSombra, type ResumenCambios,
} from '@/lib/planChanges';

const BASE = '/api/v1/plan-changes';
const SIN_PERMISO = 'No tienes permiso para ver los cambios de plan. Pídele acceso al dueño o al administrador de la escuela.';

interface ListaRes { disponible: boolean; motivo?: string; items: CambioPlan[]; total: number }

function Tarjeta({ titulo, valor, detalle, tono }: { titulo: string; valor: string | number; detalle?: string; tono?: string }) {
    return (
        <Card>
            <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{titulo}</p>
                <p className={`text-3xl font-semibold ${tono ?? ''}`}>{valor}</p>
                {detalle && <p className="text-xs text-muted-foreground mt-1">{detalle}</p>}
            </CardContent>
        </Card>
    );
}

function mesAnterior(): { year: number; month: number } {
    const hoy = new Date();
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function TablaPropuestas({ filas }: { filas: Propuesta[] }) {
    return (
        <div className="overflow-x-auto rounded border">
            <table className="min-w-full text-sm">
                <thead className="bg-muted/50 text-left">
                    <tr>
                        <th className="p-2">Deportista</th><th className="p-2">Plan</th><th className="p-2">Clases</th><th className="p-2">Deuda</th><th className="p-2">Razón</th>
                    </tr>
                </thead>
                <tbody>
                    {filas.map((p) => (
                        <tr key={p.enrollment_id} className="border-t align-top">
                            <td className="p-2 whitespace-nowrap">{p.atleta}</td>
                            <td className="p-2 whitespace-nowrap">{p.from_plan ?? '—'} → <strong>{p.to_plan ?? '—'}</strong> <span className="text-xs text-muted-foreground">({formatoCOP(p.from_amount)} → {formatoCOP(p.to_amount)})</span></td>
                            <td className="p-2">{p.clases_mes ?? '—'}</td>
                            <td className="p-2 whitespace-nowrap">{formatoCOP(p.debt_at_change)}</td>
                            <td className="p-2 min-w-[14rem]">{razonLegible(p.razon, p.direction, p.clases_mes)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Simulador({ onEscribio }: { onEscribio: () => void }) {
    const { toast } = useToast();
    const ant = mesAnterior();
    const [year, setYear] = useState(String(ant.year));
    const [month, setMonth] = useState(String(ant.month));
    const [corriendo, setCorriendo] = useState(false);
    const [res, setRes] = useState<ResultadoSombra | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [confirmando, setConfirmando] = useState(false);

    const y = Number(year);
    const m = Number(month);
    const valido = Number.isInteger(y) && y >= 2024 && y <= 2100 && Number.isInteger(m) && m >= 1 && m <= 12;

    async function correr(dryRun: boolean) {
        setCorriendo(true);
        setErrorMsg(null);
        try {
            const r = await bffClient.post<ResultadoSombra>(`${BASE}/correr-sombra`, { year: y, month: m, dry_run: dryRun });
            setRes(r);
            if (!dryRun) {
                toast({ title: 'Filas de sombra registradas', description: `${r.escritas} nuevas, ${r.ya_registradas} ya estaban. No se cambió ningún plan.` });
                onEscribio();
            }
        } catch (err) {
            setErrorMsg(err instanceof BFFError && err.status === 403
                ? 'Solo el dueño o el administrador pueden simular o registrar cambios.'
                : err instanceof BFFError ? err.message : 'No se pudo correr la simulación.');
        } finally {
            setCorriendo(false);
            setConfirmando(false);
        }
    }

    return (
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Simular un mes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                    Calcula qué plan le correspondería a cada deportista según las clases que tomó ese mes. La simulación <strong>no escribe nada</strong>.
                </p>
                <div className="flex gap-2 items-end flex-wrap">
                    <div className="w-24">
                        <Label htmlFor="sim-year">Año</Label>
                        <Input id="sim-year" type="number" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
                    </div>
                    <div className="w-20">
                        <Label htmlFor="sim-month">Mes</Label>
                        <Input id="sim-month" type="number" inputMode="numeric" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} />
                    </div>
                    <Button className="h-10" onClick={() => correr(true)} disabled={corriendo || !valido}>
                        {corriendo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FlaskConical className="h-4 w-4 mr-2" />}
                        Simular un mes
                    </Button>
                </div>

                {errorMsg && (
                    <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{errorMsg}</AlertDescription></Alert>
                )}

                {res && !res.disponible && (
                    <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>{res.motivo_no_disponible ?? 'Esta función todavía no está habilitada en esta base de datos.'}</AlertDescription></Alert>
                )}

                {res?.disponible && (
                    <div className="space-y-3">
                        <div className="flex gap-2 flex-wrap items-center text-sm">
                            <Badge variant="secondary">{res.dry_run ? 'Simulación — no se escribió nada' : 'Registrado en modo sombra'}</Badge>
                            <span>{nombreMes(res.year, res.month)}: {res.inscripciones_evaluadas} inscripciones evaluadas · suben {res.resumen.up} · bajan {res.resumen.down} · mismo precio {res.resumen.same_price} · bajan debiendo {res.resumen.down_con_deuda}</span>
                        </div>
                        {Object.keys(res.descartes).length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                Sin cambio: {Object.entries(res.descartes).map(([k, v]) => `${k.replace(/_/g, ' ')} (${v})`).join(', ')}.
                            </p>
                        )}
                        {res.propuestas.length > 0 ? <TablaPropuestas filas={res.propuestas} /> : <p className="text-sm text-muted-foreground">Nadie cambiaría de plan ese mes.</p>}

                        {res.dry_run && res.propuestas.length > 0 && (
                            <div className="rounded border p-3 space-y-2">
                                {!confirmando ? (
                                    <Button variant="outline" className="h-10" onClick={() => setConfirmando(true)} disabled={corriendo}>
                                        Registrar estas filas en modo sombra…
                                    </Button>
                                ) : (
                                    <>
                                        <p className="text-sm">
                                            Se guardarán <strong>{res.propuestas.length}</strong> filas de sombra de {nombreMes(res.year, res.month)} para que las revise Milena.
                                            <strong> No se cambia ningún plan ni ningún cobro.</strong> ¿Confirmas?
                                        </p>
                                        <div className="flex gap-2">
                                            <Button className="h-10" onClick={() => correr(false)} disabled={corriendo}>
                                                {corriendo && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Sí, registrar
                                            </Button>
                                            <Button className="h-10" variant="outline" onClick={() => setConfirmando(false)} disabled={corriendo}>Cancelar</Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {!res.dry_run && (
                            <p className="text-xs text-muted-foreground">Escritas: {res.escritas} · ya registradas: {res.ya_registradas} · errores: {res.errores}</p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function PlanChangesPage() {
    const { schoolId } = useSchoolContext();
    const [filtros, setFiltros] = useState<FiltrosCambios>({ mode: '', desde: '', hasta: '', soloConDeuda: false });
    const [lista, setLista] = useState<ListaRes | null>(null);
    const [resumen, setResumen] = useState<ResumenCambios | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!schoolId) { setLoading(false); return; }
        setLoading(true);
        setError(null);
        try {
            const [l, r] = await Promise.all([
                bffClient.get<ListaRes>(`${BASE}${armarQuery(filtros)}`),
                bffClient.get<ResumenCambios>(`${BASE}/resumen${armarQuery(filtros, { resumen: true })}`),
            ]);
            setLista(l);
            setResumen(r);
        } catch (err) {
            setError(err instanceof BFFError && err.status === 403 ? SIN_PERMISO
                : err instanceof BFFError ? err.message : 'No se pudieron cargar los cambios de plan.');
        } finally {
            setLoading(false);
        }
    }, [schoolId, filtros]);

    useEffect(() => { void load(); }, [load]);

    const rotulo = useMemo(() => rotuloModo(resumen?.por_modo, resumen?.aplicados, resumen?.modo_escuela), [resumen]);
    const noDisponible = lista?.disponible === false || resumen?.disponible === false;

    function exportar() {
        if (!lista?.items.length) return;
        // BOM para que Excel abra bien las tildes.
        const blob = new Blob(['﻿', aCsv(lista.items)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cambios-de-plan-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
            <div>
                <h1 className="text-xl font-semibold">Cambios de plan</h1>
                <p className="text-sm text-muted-foreground">
                    Qué plan le correspondería a cada deportista según las clases que tomó en el mes, y quién bajaría debiendo.
                </p>
            </div>

            {loading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}

            {!loading && error && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
                        {error}
                        {error !== SIN_PERMISO && <Button size="sm" variant="outline" onClick={() => void load()}>Reintentar</Button>}
                    </AlertDescription>
                </Alert>
            )}

            {!loading && !error && noDisponible && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        {lista?.motivo ?? 'Los cambios de plan por asistencia todavía no están habilitados en esta base de datos (falta aplicar la migración).'} Avisa al equipo de SportMaps.
                    </AlertDescription>
                </Alert>
            )}

            {!loading && !error && !noDisponible && resumen && (
                <>
                    <div className={`rounded-lg border-2 p-4 ${rotulo.modo === 'auto' ? 'border-red-400 bg-red-50' : rotulo.modo === 'sombra' ? 'border-blue-300 bg-blue-50' : 'border-border'}`}>
                        <p className="text-xs text-muted-foreground">Modo actual</p>
                        <p className="text-3xl font-bold tracking-wide">{rotulo.titulo}</p>
                        <p className="text-sm">{rotulo.detalle}</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Tarjeta titulo="Suben de plan" valor={resumen.up} />
                        <Tarjeta titulo="Bajan de plan" valor={resumen.down} />
                        <Tarjeta titulo="Bajaron debiendo más" valor={resumen.down_con_deuda} tono={resumen.down_con_deuda ? 'text-red-600' : ''} detalle="Bajan de plan y tienen deuda" />
                        <Tarjeta titulo="Total" valor={resumen.total} detalle={`${resumen.por_modo.sombra} sombra · ${resumen.por_modo.auto} auto · ${resumen.aplicados} aplicados`} />
                    </div>
                </>
            )}

            {!error && !noDisponible && <Simulador onEscribio={() => void load()} />}

            {!loading && !error && !noDisponible && (
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Cambios registrados</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex gap-3 items-end flex-wrap">
                            <div>
                                <Label htmlFor="f-modo">Modo</Label>
                                <select id="f-modo" className="h-10 rounded border bg-background px-2 text-sm block" value={filtros.mode}
                                    onChange={(e) => setFiltros((f) => ({ ...f, mode: e.target.value as FiltrosCambios['mode'] }))}>
                                    <option value="">Todos</option>
                                    <option value="sombra">Sombra</option>
                                    <option value="auto">Aplicado / auto</option>
                                </select>
                            </div>
                            <div>
                                <Label htmlFor="f-desde">Desde</Label>
                                <Input id="f-desde" type="date" value={filtros.desde} onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))} />
                            </div>
                            <div>
                                <Label htmlFor="f-hasta">Hasta</Label>
                                <Input id="f-hasta" type="date" value={filtros.hasta} onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value }))} />
                            </div>
                            <label className="flex items-center gap-2 text-sm h-10">
                                <input type="checkbox" className="h-4 w-4" checked={filtros.soloConDeuda}
                                    onChange={(e) => setFiltros((f) => ({ ...f, soloConDeuda: e.target.checked }))} />
                                Solo con deuda
                            </label>
                            <Button variant="outline" className="h-10 ml-auto" onClick={exportar} disabled={!lista?.items.length}>
                                <Download className="h-4 w-4 mr-2" /> Exportar CSV
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">El total de las tarjetas no aplica «solo con deuda». {lista ? `Mostrando ${lista.items.length}.` : ''}</p>

                        {lista && lista.items.length === 0 ? (
                            <Alert><AlertDescription>No hay cambios registrados con estos filtros.</AlertDescription></Alert>
                        ) : (
                            <div className="overflow-x-auto rounded border">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-muted/50 text-left">
                                        <tr>
                                            <th className="p-2">Deportista</th><th className="p-2">Plan actual → propuesto</th><th className="p-2">Clases del mes</th>
                                            <th className="p-2">Deuda</th><th className="p-2">Razón</th><th className="p-2">Fecha</th><th className="p-2">Modo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(lista?.items ?? []).map((c) => (
                                            <tr key={c.id} className="border-t align-top">
                                                <td className="p-2 whitespace-nowrap">{c.atleta}</td>
                                                <td className="p-2 whitespace-nowrap">
                                                    {c.from_plan ?? '—'} → <strong>{c.to_plan ?? '—'}</strong>{' '}
                                                    <Badge variant={c.direction === 'down' ? 'destructive' : 'outline'}>{ETIQUETA_DIRECCION[c.direction]}</Badge>
                                                    <div className="text-xs text-muted-foreground">{formatoCOP(c.from_amount)} → {formatoCOP(c.to_amount)}</div>
                                                </td>
                                                <td className="p-2">{c.clases_mes ?? '—'}<div className="text-xs text-muted-foreground">{nombreMes(c.period_year, c.period_month)}</div></td>
                                                <td className={`p-2 whitespace-nowrap ${(c.debt_at_change ?? 0) > 0 ? 'text-red-600 font-medium' : ''}`}>{formatoCOP(c.debt_at_change)}</td>
                                                <td className="p-2 min-w-[14rem]">{razonLegible(c.razon, c.direction, c.clases_mes)}</td>
                                                <td className="p-2 whitespace-nowrap">{(c.created_at ?? '').slice(0, 10)}</td>
                                                <td className="p-2"><Badge variant={c.applied ? 'destructive' : 'secondary'}>{c.mode === 'sombra' ? 'Sombra' : c.applied ? 'Aplicado' : 'Auto'}</Badge></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
