/**
 * AttendanceSheetIntakePage — bandeja «Planillas por revisar» (asistencia en papel por foto).
 * Spec: docs/specs/whatsapp-conversacion-v2-dynasty.md §3.8 y docs/specs/fotos-de-planillas-y-autorregistro.md.
 * Contrato: bff/src/routes/attendance-sheet-intake.routes.ts.
 *
 * Revisión obligatoria: NADA se guarda sin tocar «Guardar», y se guarda SOLO lo que el staff dejó
 * marcado en la grilla. «Sin marca» no es falta. El coach ve solo lo suyo (el BFF filtra).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { bffClient, BFFError } from '@/lib/api/bffClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Camera, Check, HelpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { prepararPlanilla } from '@/lib/prepararPlanilla';
import {
    armarCorrecciones, claveCelda, contarGrilla, edicionVacia, estaPresente, fechaCorta, fechasDeEquipo,
    filasSinResolver, marcaOriginal, necesitaElegirEquipo, puedeGuardar,
    type EdicionEquipo, type EquipoCruce, type PlanillaDetalle, type PlanillaItem, type RosterEquipo,
} from '@/lib/attendanceSheetIntake';

const BASE = '/api/v1/attendance-sheet-intake';

const msgError = (err: unknown, porDefecto: string) => (err instanceof BFFError ? err.message : porDefecto);

function fechaHora(iso: string): string {
    try {
        return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Detalle: foto + grilla de cruce
// ─────────────────────────────────────────────────────────────────────────────
function GrillaEquipo({ equipo, roster, edicion, onChange }: {
    equipo: EquipoCruce; roster: RosterEquipo | undefined; edicion: EdicionEquipo; onChange: (e: EdicionEquipo) => void;
}) {
    const fechas = fechasDeEquipo(equipo);
    const sinResolver = filasSinResolver(equipo);
    const duplicados = equipo.cruce.duplicados ?? [];

    // Filas: el roster completo (si llegó) o, si no, los deportistas que el cruce reconoció.
    const atletas = useMemo(() => {
        if (roster?.atletas.length) return roster.atletas;
        const vistos = new Map<string, string>();
        for (const f of equipo.cruce.filas ?? []) if (f.atletaId) vistos.set(f.atletaId, f.atletaNombre ?? f.nombreHoja);
        return [...vistos].map(([id, nombre]) => ({ id, nombre }));
    }, [roster, equipo]);

    const toggle = (fecha: string, atletaId: string) => {
        const actual = estaPresente(equipo, edicion, atletaId, fecha);
        onChange({ ...edicion, toques: { ...edicion.toques, [claveCelda(fecha, atletaId)]: !actual } });
    };
    const asignar = (nombreHoja: string, atletaId: string) => {
        const asignaciones = { ...edicion.asignaciones };
        if (atletaId) asignaciones[nombreHoja] = atletaId; else delete asignaciones[nombreHoja];
        onChange({ ...edicion, asignaciones });
    };
    const totales = contarGrilla(equipo, roster, edicion);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-medium">{equipo.team_name}</h3>
                <div className="flex gap-2 flex-wrap text-xs">
                    {totales.map((t) => (
                        <Badge key={t.fecha} variant="outline">{fechaCorta(t.fecha)}: {t.presentes} presentes</Badge>
                    ))}
                </div>
            </div>

            {duplicados.length > 0 && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        Dos filas de la hoja apuntan al mismo deportista: {duplicados.map((d) => `${d.atletaNombre} (${d.nombresHoja.join(' / ')})`).join('; ')}. Revisa que no esté repetido.
                    </AlertDescription>
                </Alert>
            )}

            <p className="text-xs text-muted-foreground">
                <Check className="inline h-3 w-3" /> presente · <span className="text-amber-600">«sin marca»</span> la hoja no tenía marca (no cuenta como falta) · <span className="text-orange-600">«dudosa»</span> el OCR no distinguió la marca: confírmala con la foto.
            </p>

            <div className="overflow-x-auto rounded border">
                <table className="min-w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="sticky left-0 bg-muted text-left p-2 font-medium min-w-[9rem]">Deportista</th>
                            {fechas.map((f) => <th key={f} className="p-2 font-medium whitespace-nowrap">{fechaCorta(f)}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {atletas.map((a) => (
                            <tr key={a.id} className="border-t">
                                <td className="sticky left-0 bg-background p-2 min-w-[9rem]">{a.nombre}</td>
                                {fechas.map((f) => {
                                    const marcado = estaPresente(equipo, edicion, a.id, f);
                                    const orig = marcaOriginal(equipo, a.id, f);
                                    const nota = orig === 'sin_marca' ? 'sin marca' : orig === 'dudosa' ? 'dudosa' : '';
                                    return (
                                        <td key={f} className="p-1 text-center">
                                            <button
                                                type="button"
                                                role="checkbox"
                                                aria-checked={marcado}
                                                aria-label={`${a.nombre}, ${fechaCorta(f)}: ${marcado ? 'presente' : 'sin marcar'}${nota ? ` (${nota})` : ''}`}
                                                onClick={() => toggle(f, a.id)}
                                                className={`h-11 min-w-[3.25rem] w-full rounded border flex flex-col items-center justify-center text-[10px] leading-tight touch-manipulation
                                                    ${marcado ? 'bg-green-100 border-green-500 text-green-800' : orig === 'dudosa' ? 'border-orange-400 bg-orange-50' : orig === 'sin_marca' ? 'border-amber-300 bg-amber-50' : 'border-border'}`}
                                            >
                                                {marcado ? <Check className="h-5 w-5" /> : orig === 'dudosa' ? <HelpCircle className="h-5 w-5 text-orange-500" /> : <span className="h-5" />}
                                                {!marcado && nota && <span className={orig === 'dudosa' ? 'text-orange-700' : 'text-amber-700'}>{nota}</span>}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {atletas.length === 0 && (
                            <tr><td className="p-3 text-muted-foreground" colSpan={fechas.length + 1}>Este grupo no tiene deportistas activos.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {sinResolver.length > 0 && (
                <div className="rounded border border-amber-300 bg-amber-50/50 p-3 space-y-3">
                    <p className="text-sm font-medium">Nombres de la hoja que no pude emparejar ({sinResolver.length})</p>
                    <p className="text-xs text-muted-foreground">Mientras no elijas a quién corresponden, sus marcas no se guardan.</p>
                    {sinResolver.map((f) => {
                        const asistio = Object.entries(f.marcasPorFecha).filter(([, m]) => m === 'asistio').map(([d]) => fechaCorta(d));
                        const elegido = edicion.asignaciones[f.nombreHoja] ?? '';
                        return (
                            <div key={f.nombreHoja} className="space-y-1">
                                <p className="text-sm">
                                    «<strong>{f.nombreHoja}</strong>»{' '}
                                    <span className="text-muted-foreground">{f.estado === 'ambiguo' ? '(ambiguo)' : '(no encontrada)'}{asistio.length ? ` · marcó ${asistio.join(', ')}` : ''}</span>
                                </p>
                                <div className="flex gap-2 flex-wrap items-center">
                                    <select
                                        aria-label={`Deportista para ${f.nombreHoja}`}
                                        className="h-11 rounded border bg-background px-2 text-sm flex-1 min-w-[12rem]"
                                        value={elegido}
                                        onChange={(e) => asignar(f.nombreHoja, e.target.value)}
                                    >
                                        <option value="">— No es de este grupo / ignorar —</option>
                                        {atletas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                                    </select>
                                    {f.sugerencia && elegido !== f.sugerencia.id && (
                                        <Button type="button" size="sm" variant="secondary" className="h-11" onClick={() => asignar(f.nombreHoja, f.sugerencia!.id)}>
                                            ¿Es {f.sugerencia.nombre}?
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function Detalle({ item, onDone }: { item: PlanillaItem; onDone: () => void }) {
    const { toast } = useToast();
    const [detalle, setDetalle] = useState<PlanillaDetalle | null>(null);
    const [cargando, setCargando] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState(false);
    const [ediciones, setEdiciones] = useState<Record<string, EdicionEquipo>>({});
    const [teamElegido, setTeamElegido] = useState('');

    const cargar = useCallback(async () => {
        setCargando(true);
        setErrorMsg(null);
        try {
            setDetalle(await bffClient.get<PlanillaDetalle>(`${BASE}/${item.id}`));
        } catch (err) {
            setErrorMsg(msgError(err, 'No se pudo abrir la planilla.'));
        } finally {
            setCargando(false);
        }
    }, [item.id]);
    useEffect(() => { void cargar(); }, [cargar]);

    const equipos: EquipoCruce[] = detalle?.matches?.modo === 'foto' ? detalle.matches.equipos : [];
    const rosters = detalle?.rosters ?? [];
    const pregunta = detalle ? necesitaElegirEquipo(detalle) : false;

    async function elegirEquipo() {
        if (!teamElegido) return;
        setTrabajando(true);
        setErrorMsg(null);
        try {
            await bffClient.post(`${BASE}/${item.id}/equipo`, { teamId: teamElegido });
            setEdiciones({});
            setTeamElegido('');
            await cargar();
        } catch (err) {
            setErrorMsg(msgError(err, 'No se pudo cambiar el grupo.'));
        } finally {
            setTrabajando(false);
        }
    }

    async function guardar() {
        setTrabajando(true);
        setErrorMsg(null);
        try {
            const res = await bffClient.post<{ texto?: string }>(`${BASE}/${item.id}/confirmar`, {
                correcciones: armarCorrecciones(equipos, rosters, ediciones),
            });
            toast({ title: 'Asistencia guardada', description: res.texto });
            onDone();
        } catch (err) {
            // 422 trae el motivo (p. ej. «la lista del 22-sep ya estaba cerrada»); 409 = ya procesada.
            setErrorMsg(msgError(err, 'No se pudo guardar la asistencia.'));
        } finally {
            setTrabajando(false);
        }
    }

    async function descartar() {
        if (!window.confirm('¿Descartar esta planilla? No se guardará ninguna asistencia.')) return;
        setTrabajando(true);
        setErrorMsg(null);
        try {
            await bffClient.post(`${BASE}/${item.id}/descartar`, {});
            toast({ title: 'Planilla descartada' });
            onDone();
        } catch (err) {
            setErrorMsg(msgError(err, 'No se pudo descartar.'));
        } finally {
            setTrabajando(false);
        }
    }

    if (cargando) return <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>;

    const esLista = detalle?.matches?.modo === 'lista';

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {item.photoUrl ? (
                    <a href={item.photoUrl} target="_blank" rel="noreferrer" className="block">
                        <img src={item.photoUrl} alt="Foto de la planilla" className="rounded border max-h-[28rem] object-contain w-full bg-muted/30" />
                        <span className="text-xs text-muted-foreground">Toca la foto para verla completa.</span>
                    </a>
                ) : (
                    <div className="rounded border p-4 text-sm text-muted-foreground">Esta planilla no tiene foto{esLista ? ' (es una lista pasada por WhatsApp)' : ''}.</div>
                )}

                <div className="space-y-4 min-w-0">
                    {esLista && detalle?.matches?.modo === 'lista' && (
                        <Alert>
                            <AlertDescription>
                                Lista de <strong>{detalle.matches.team_name}</strong> del {fechaCorta(detalle.matches.fecha)} ({detalle.matches.roster.length} deportistas).
                                Se cierra por WhatsApp respondiendo «faltaron 3 y 7», «todos» o «ninguno». Desde aquí solo se puede descartar.
                            </AlertDescription>
                        </Alert>
                    )}

                    {pregunta && (
                        <div className="rounded border border-amber-300 bg-amber-50/50 p-3 space-y-2">
                            <p className="text-sm font-medium">
                                {equipos.length ? '¿Es de este grupo?' : '¿De qué grupo es esta planilla?'}
                                {detalle?.motivo ? <span className="font-normal text-muted-foreground"> {detalle.motivo}</span> : null}
                            </p>
                            {(detalle?.candidatos.length ?? 0) > 0 ? (
                                <div className="flex gap-2 flex-wrap">
                                    <select
                                        aria-label="Grupo de la planilla"
                                        className="h-11 rounded border bg-background px-2 text-sm flex-1 min-w-[12rem]"
                                        value={teamElegido}
                                        onChange={(e) => setTeamElegido(e.target.value)}
                                    >
                                        <option value="">Elige el grupo…</option>
                                        {detalle!.candidatos.map((c) => (
                                            <option key={c.teamId} value={c.teamId}>{c.teamName} ({Math.round(c.fraccion * 100)}% de los nombres)</option>
                                        ))}
                                    </select>
                                    <Button className="h-11" onClick={elegirEquipo} disabled={!teamElegido || trabajando}>
                                        {trabajando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Usar este grupo
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No hay grupos sugeridos. Descarta la planilla y vuelve a subirla con la hoja completa.</p>
                            )}
                        </div>
                    )}

                    {equipos.map((e) => (
                        <GrillaEquipo
                            key={e.team_id}
                            equipo={e}
                            roster={rosters.find((r) => r.teamId === e.team_id)}
                            edicion={ediciones[e.team_id] ?? edicionVacia()}
                            onChange={(ed) => setEdiciones((prev) => ({ ...prev, [e.team_id]: ed }))}
                        />
                    ))}
                </div>
            </div>

            {errorMsg && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
            )}

            <div className="flex gap-2 flex-wrap">
                {!esLista && (
                    <Button className="h-12 flex-1 sm:flex-none sm:min-w-[10rem]" onClick={guardar}
                        disabled={trabajando || pregunta || !puedeGuardar(equipos, rosters, ediciones)}>
                        {trabajando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Guardar
                    </Button>
                )}
                <Button className="h-12 flex-1 sm:flex-none" variant="outline" onClick={descartar} disabled={trabajando}>
                    <XCircle className="h-4 w-4 mr-2" /> Descartar
                </Button>
            </div>
            {!esLista && !pregunta && !puedeGuardar(equipos, rosters, ediciones) && (
                <p className="text-xs text-muted-foreground">Marca al menos un presente para poder guardar. Solo se guarda lo que dejes marcado.</p>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lista
// ─────────────────────────────────────────────────────────────────────────────
function resumenLinea(item: PlanillaItem): string {
    if (item.modo === 'lista') return 'Lista pasada por WhatsApp, pendiente de cierre';
    if (!item.equipos.length) return 'Falta elegir el grupo';
    return item.equipos.map((e) => {
        const pres = e.fechas.reduce((s, f) => s + f.presentes, 0);
        const sin = e.fechas.reduce((s, f) => s + f.sinMarca, 0);
        const dud = e.fechas.reduce((s, f) => s + f.dudosas, 0);
        const extra = [sin ? `${sin} sin marca` : '', dud ? `${dud} dudosas` : '', e.noEncontradas ? `${e.noEncontradas} no encontradas` : '', e.ambiguas ? `${e.ambiguas} ambiguas` : '']
            .filter(Boolean).join(', ');
        return `${e.teamName}: ${pres} presentes en ${e.fechas.length} fecha${e.fechas.length === 1 ? '' : 's'}${extra ? ` (${extra})` : ''}`;
    }).join(' · ');
}

function PlanillaCard({ item, abierta, onToggle, onDone }: { item: PlanillaItem; abierta: boolean; onToggle: () => void; onDone: () => void }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base">{item.teamName ?? item.equipos[0]?.teamName ?? 'Planilla sin grupo'}</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline">{item.source === 'app' ? 'App' : 'WhatsApp'}</Badge>
                        <Badge variant="secondary">{item.modo === 'lista' ? 'Lista' : 'Foto'}</Badge>
                        {item.confianza && item.confianza !== 'alta' && <Badge variant="destructive">Confianza {item.confianza}</Badge>}
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">
                    {item.submittedBy.name ? `${item.submittedBy.name} · ` : ''}{fechaHora(item.createdAt)}
                </p>
                <p className="text-sm">{resumenLinea(item)}</p>
            </CardHeader>
            <CardContent className="space-y-3">
                <Button variant={abierta ? 'outline' : 'default'} className="h-11" onClick={onToggle}>
                    {abierta ? 'Cerrar' : 'Revisar'}
                </Button>
                {abierta && <Detalle item={item} onDone={onDone} />}
            </CardContent>
        </Card>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subir planilla
// ─────────────────────────────────────────────────────────────────────────────
function SubirPlanilla({ onSubida }: { onSubida: (id: string | null) => void }) {
    const { toast } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [subiendo, setSubiendo] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setSubiendo(true);
        setErrorMsg(null);
        try {
            const body = await prepararPlanilla(file);
            const res = await bffClient.post<{ id: string | null }>(`${BASE}/upload`, body);
            toast({ title: 'Planilla leída', description: 'Quedó en la lista para que la revises. No se guardó nada todavía.' });
            onSubida(res.id ?? null);
        } catch (err) {
            if (err instanceof BFFError && err.status === 503 && (err.body as { reason?: string } | undefined)?.reason === 'no_disponible') {
                setErrorMsg('La bandeja de planillas aún no está habilitada en esta base. Avisa al equipo de SportMaps.');
            } else {
                setErrorMsg(err instanceof Error ? err.message : 'No se pudo subir la planilla.');
            }
        } finally {
            setSubiendo(false);
        }
    }

    return (
        <div className="space-y-2">
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="hidden" onChange={onArchivo} />
            <Button className="h-12 w-full sm:w-auto" onClick={() => inputRef.current?.click()} disabled={subiendo}>
                {subiendo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Camera className="h-4 w-4 mr-2" />}
                {subiendo ? 'Leyendo la planilla…' : 'Subir planilla'}
            </Button>
            {errorMsg && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}

export default function AttendanceSheetIntakePage() {
    const { schoolId } = useSchoolContext();
    const [items, setItems] = useState<PlanillaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [noDisponible, setNoDisponible] = useState(false);
    const [abierta, setAbierta] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!schoolId) { setLoading(false); return; }
        setLoading(true);
        setError(null);
        try {
            const res = await bffClient.get<{ items: PlanillaItem[]; disponible?: boolean }>(`${BASE}?status=por_revisar`);
            setNoDisponible(res.disponible === false);
            setItems(res.items ?? []);
        } catch (err) {
            setError(err instanceof BFFError && err.status === 403
                ? 'No tienes permiso para ver las planillas.'
                : msgError(err, 'No se pudo cargar la bandeja de planillas.'));
        } finally {
            setLoading(false);
        }
    }, [schoolId]);

    useEffect(() => { void load(); }, [load]);

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
            <div>
                <h1 className="text-xl font-semibold">Planillas por revisar</h1>
                <p className="text-sm text-muted-foreground">
                    Toma la foto de la planilla de asistencia aquí o mándala por WhatsApp. El sistema cruza los nombres con la lista del grupo;
                    revisa y toca Guardar — nunca se guarda solo.
                </p>
            </div>

            <SubirPlanilla onSubida={(id) => { void load().then(() => id && setAbierta(id)); }} />

            {loading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}

            {!loading && error && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
                        {error}
                        <Button size="sm" variant="outline" onClick={() => void load()}>Reintentar</Button>
                    </AlertDescription>
                </Alert>
            )}

            {!loading && !error && noDisponible && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        Las planillas por foto todavía no están habilitadas en esta base de datos (falta aplicar la migración). No es un error tuyo: avisa al equipo de SportMaps.
                    </AlertDescription>
                </Alert>
            )}

            {!loading && !error && !noDisponible && items.length === 0 && (
                <Alert>
                    <AlertDescription>No hay planillas pendientes de revisión.</AlertDescription>
                </Alert>
            )}

            {!loading && items.map((item) => (
                <PlanillaCard
                    key={item.id}
                    item={item}
                    abierta={abierta === item.id}
                    onToggle={() => setAbierta((a) => (a === item.id ? null : item.id))}
                    onDone={() => { setAbierta(null); void load(); }}
                />
            ))}
        </div>
    );
}
