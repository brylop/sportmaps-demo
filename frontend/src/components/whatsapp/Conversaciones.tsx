/**
 * El buzón de conversaciones (F3).
 *
 * Hasta ahora la escuela no tenía dónde leer ni responder: la pestaña "Bandeja"
 * lista comprobantes que fallaron, no chats. El bot atendía y lo que no sabía
 * manejar quedaba escalado sin que nadie pudiera verlo.
 *
 * Dos cosas mandan sobre el diseño de acá:
 *
 *  - **La ventana de 24 horas.** WhatsApp solo deja responder en texto libre
 *    mientras el titular haya escrito en las últimas 24 h. Con la ventana
 *    cerrada NO se pinta el cuadro de texto: si se pintara, la escuela
 *    escribiría, le daría enviar, y recibiría un error que no sabe leer. Vale
 *    más un cuadro que no está que uno que falla.
 *
 *  - **Quién escribió cada mensaje.** El bot y una persona de la escuela salen
 *    por el mismo número. Si el hilo no los distingue, nadie sabe qué se
 *    prometió ni quién lo prometió.
 *
 *  - **El número también es el WhatsApp personal de la dueña** (Coexistence).
 *    Por eso el buzón abre por defecto en "Familias": los mensajes de amigos,
 *    proveedores o desconocidos van a "Otros", y una conversación se puede
 *    marcar como personal para que salga de la vista y el asistente nunca le
 *    conteste.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import {
    MessageSquare, Send, Bot, User, Clock, Loader2, ChevronLeft, Sparkles, X,
    EyeOff, Eye, CheckCircle2, Hand, Unlock,
} from 'lucide-react';

interface UltimoMensaje {
    direction: string; text_body: string | null; type: string;
    created_at: string; ai_generated: boolean | null;
}
export interface Conversacion {
    id: string;
    contact_wa_id: string;
    contact_name: string | null;
    identified: boolean;
    status: string;
    unread_count: number | null;
    last_message_at: string | null;
    last_inbound_at: string | null;
    ventana_abierta: boolean;
    ventana_vence: string | null;
    ultimo_mensaje: UltimoMensaje | null;
    borradores_pendientes: number;
    /** Quién es el contacto. null/ausente si el backend todavía no lo calcula. */
    contact_kind?: TipoDeContacto | null;
    /** El último mensaje entrante no tiene respuesta. Ausente en backends viejos. */
    pendiente?: boolean;
    /** Mejora 9: tomada por una persona (solo si está vigente). Mientras tanto el asistente calla. */
    toma?: Toma | null;
}

interface Toma { tomada_por: string; tomada_por_nombre: string | null; tomada_hasta: string }

/** «Atendida por Milena · hasta 9:30 p. m.» */
function textoDeToma(t: Toma): string {
    const hasta = new Date(t.tomada_hasta).toLocaleString('es-CO', { hour: 'numeric', minute: '2-digit' });
    return `Atendida por ${t.tomada_por_nombre || 'alguien de la escuela'} · hasta ${hasta}`;
}

export type TipoDeContacto =
    | 'familia' | 'familia_sin_cuenta' | 'ambiguo' | 'staff' | 'desconocido' | 'personal';

type Vista = 'familias' | 'otros' | 'todas';
interface Conteos { familias: number; otros: number; todas: number }

/** Etiqueta corta por tipo de contacto. */
const ETIQUETA_TIPO: Record<TipoDeContacto, { texto: string; clase: string }> = {
    familia:            { texto: 'Familia',     clase: 'border-green-300 text-green-700 dark:text-green-400' },
    familia_sin_cuenta: { texto: 'Sin cuenta',  clase: 'border-sky-300 text-sky-700 dark:text-sky-400' },
    ambiguo:            { texto: 'Revisar',     clase: 'border-amber-300 text-amber-700 dark:text-amber-400' },
    staff:              { texto: 'Equipo',      clase: 'border-violet-300 text-violet-700 dark:text-violet-400' },
    desconocido:        { texto: 'Desconocido', clase: 'text-muted-foreground' },
    personal:           { texto: 'Personal',    clase: 'border-slate-400 text-slate-600 dark:text-slate-300' },
};

function EtiquetaTipo({ tipo }: { tipo?: TipoDeContacto | null }) {
    if (!tipo || !ETIQUETA_TIPO[tipo]) return null;
    const e = ETIQUETA_TIPO[tipo];
    return (
        <Badge variant="outline" className={`text-[10px] ${e.clase}`}
               title={tipo === 'ambiguo' ? 'El número coincide con más de una persona: revísalo' : undefined}>
            {e.texto}
        </Badge>
    );
}

/**
 * ¿Está esperando respuesta? Si el backend manda `pendiente`, manda eso. Si no
 * (versión vieja), se cae al `status === 'open'` de antes.
 */
const sinResponder = (c: Conversacion) =>
    typeof c.pendiente === 'boolean' ? c.pendiente : c.status === 'open';
interface Mensaje {
    id: string; direction: string; type: string; text_body: string | null;
    status: string | null; ai_generated: boolean | null; created_at: string;
    error_detail: string | null;
}
interface Borrador {
    id: string; proposed_text: string; edited_text: string | null;
    llm_provider: string | null; created_at: string;
}

const hora = (s: string | null) =>
    s ? new Date(s).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

/** Cuánto le queda a la ventana, en palabras. */
function restante(vence: string | null): string {
    if (!vence) return '';
    const ms = new Date(vence).getTime() - Date.now();
    if (ms <= 0) return 'cerrada';
    const h = Math.floor(ms / 3_600_000);
    return h >= 1 ? `${h} h` : `${Math.max(1, Math.floor(ms / 60_000))} min`;
}

function quien(m: Mensaje, tipo?: TipoDeContacto | null): { texto: string; icono: JSX.Element } {
    if (m.direction === 'inbound') {
        // Sin tipo (backend viejo) se conserva el rótulo de siempre.
        const familia = !tipo || tipo === 'familia' || tipo === 'familia_sin_cuenta';
        return { texto: familia ? 'Familia' : 'Contacto', icono: <User className="h-3 w-3" /> };
    }
    return m.ai_generated
        ? { texto: 'Asistente', icono: <Bot className="h-3 w-3" /> }
        : { texto: 'Escuela', icono: <User className="h-3 w-3" /> };
}

export function Conversaciones({ schoolId, conversacionInicial }: { schoolId: string; conversacionInicial?: string | null }) {
    const { toast } = useToast();
    const [lista, setLista] = useState<Conversacion[]>([]);
    const [cargandoLista, setCargandoLista] = useState(true);
    const [abierta, setAbierta] = useState<Conversacion | null>(null);
    const [mensajes, setMensajes] = useState<Mensaje[]>([]);
    const [borradores, setBorradores] = useState<Borrador[]>([]);
    const [cargandoHilo, setCargandoHilo] = useState(false);
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [vista, setVista] = useState<Vista>('familias');
    const [conteos, setConteos] = useState<Conteos | null>(null);
    // Sin la migración de Fase A el BFF devuelve todo junto: las pestañas mentirían.
    const [clasificacion, setClasificacion] = useState(true);
    const [sinResponderPrimero, setSinResponderPrimero] = useState(true);
    const [confirmarPersonal, setConfirmarPersonal] = useState(false);
    const [accionando, setAccionando] = useState(false);
    // Sin la migración de «tomar» el BFF manda toma_disponible=false: el botón se deshabilita.
    const [tomaDisponible, setTomaDisponible] = useState(true);

    const cargarLista = useCallback(async () => {
        setCargandoLista(true);
        try {
            const r = await bffClient.get<{
                conversaciones: Conversacion[]; conteos?: Conteos | null;
                clasificacion_disponible?: boolean; toma_disponible?: boolean;
            }>(`/api/v1/whatsapp/${schoolId}/conversaciones?vista=${vista}`);
            setLista(r.conversaciones ?? []);
            // Backend viejo (sin el campo) = no disponible: no hay endpoint que llamar.
            setTomaDisponible(r.toma_disponible === true);
            // Sin la migración aplicada no llegan conteos: no se pintan números.
            setConteos(r.conteos ?? null);
            setClasificacion(r.clasificacion_disponible !== false);
        } catch (e: any) {
            toast({ title: 'No se pudieron cargar las conversaciones', description: e?.message, variant: 'destructive' });
        } finally {
            setCargandoLista(false);
        }
    }, [schoolId, vista, toast]);

    // Lo que espera respuesta, arriba. El orden por fecha se conserva dentro
    // de cada grupo porque el sort es estable.
    const visibles = useMemo(() => {
        if (!sinResponderPrimero) return lista;
        return [...lista].sort((a, b) => Number(sinResponder(b)) - Number(sinResponder(a)));
    }, [lista, sinResponderPrimero]);
    const cuantosSinResponder = useMemo(() => lista.filter(sinResponder).length, [lista]);

    // El detalle no trae `contact_kind` ni `pendiente`: los toma de la lista
    // cada vez que se recarga, para que el encabezado no quede viejo.
    useEffect(() => {
        setAbierta((a) => {
            if (!a) return a;
            const fresca = lista.find((c) => c.id === a.id);
            if (!fresca) return a;
            return { ...a, contact_kind: fresca.contact_kind, pendiente: fresca.pendiente, status: fresca.status, toma: fresca.toma ?? null };
        });
    }, [lista]);

    useEffect(() => { void cargarLista(); }, [cargarLista]);

    const abrir = useCallback(async (c: Conversacion) => {
        setAbierta(c);
        setTexto('');
        setCargandoHilo(true);
        try {
            const r = await bffClient.get<{
                conversacion: Conversacion; mensajes: Mensaje[]; borradores: Borrador[]; toma_disponible?: boolean;
            }>(`/api/v1/whatsapp/${schoolId}/conversaciones/${c.id}`);
            if (typeof r.toma_disponible === 'boolean') setTomaDisponible(r.toma_disponible);
            setMensajes(r.mensajes ?? []);
            setBorradores(r.borradores ?? []);
            // El servidor recalcula la ventana: la de la lista pudo quedar
            // vieja si la pestaña lleva rato abierta.
            setAbierta({ ...c, ...r.conversacion });
        } catch (e: any) {
            toast({ title: 'No se pudo abrir la conversación', description: e?.message, variant: 'destructive' });
        } finally {
            setCargandoHilo(false);
        }
    }, [schoolId, toast]);

    // Llegada desde el correo de escalamiento: abrir esa conversación una sola
    // vez. Si no está en la vista actual (p. ej. es de «Otros»), se abre igual
    // por id: el detalle lo trae el servidor.
    const [inicialAbierta, setInicialAbierta] = useState(false);
    useEffect(() => {
        if (!conversacionInicial || inicialAbierta || cargandoLista) return;
        setInicialAbierta(true);
        const c = lista.find((x) => x.id === conversacionInicial) ?? ({ id: conversacionInicial } as Conversacion);
        void abrir(c);
    }, [conversacionInicial, inicialAbierta, cargandoLista, lista, abrir]);

    const responder = async () => {
        if (!abierta || !texto.trim()) return;
        setEnviando(true);
        try {
            await bffClient.post(`/api/v1/whatsapp/${schoolId}/conversaciones/${abierta.id}/responder`, { texto });
            setTexto('');
            await abrir(abierta);
            await cargarLista();
        } catch (e: any) {
            toast({ title: 'No se pudo enviar', description: e?.message, variant: 'destructive' });
        } finally {
            setEnviando(false);
        }
    };

    const resolverBorrador = async (id: string, accion: 'aprobar' | 'descartar', textoEditado?: string) => {
        if (!abierta) return;
        setEnviando(true);
        try {
            await bffClient.post(`/api/v1/whatsapp/${schoolId}/borradores/${id}/${accion}`,
                accion === 'aprobar' && textoEditado ? { texto: textoEditado } : {});
            await abrir(abierta);
            await cargarLista();
        } catch (e: any) {
            toast({ title: 'No se pudo resolver el borrador', description: e?.message, variant: 'destructive' });
        } finally {
            setEnviando(false);
        }
    };

    const esPersonal = abierta?.contact_kind === 'personal';

    /** Marca o desmarca la conversación abierta como personal. */
    const cambiarPersonal = async (personal: boolean) => {
        if (!abierta) return;
        setAccionando(true);
        try {
            await bffClient.patch(`/api/v1/whatsapp/${schoolId}/conversaciones/${abierta.id}/tipo`, { personal });
            toast({
                title: personal ? 'Marcada como personal' : 'Se quitó la marca de personal',
                description: personal
                    ? 'Ya no aparece en Familias y el asistente no le va a responder.'
                    : 'Vuelve a clasificarse según el número.',
            });
            setConfirmarPersonal(false);
            // Al marcarla sale de la vista en la que estaba: se cierra el hilo.
            if (personal && vista !== 'todas') setAbierta(null);
            // El tipo real al desmarcar lo recalcula el servidor; llega con la
            // recarga de la lista (ver el efecto que sincroniza `abierta`).
            else setAbierta({ ...abierta, contact_kind: personal ? 'personal' : null });
            await cargarLista();
        } catch (e: any) {
            toast({ title: 'No se pudo cambiar', description: e?.message, variant: 'destructive' });
        } finally {
            setAccionando(false);
        }
    };

    /** Mejora 9: tomar (el asistente calla) o soltar (vuelve a atender). */
    const cambiarToma = async (tomar: boolean) => {
        if (!abierta) return;
        setAccionando(true);
        try {
            const r = await bffClient.post<{ tomada_por?: string; tomada_hasta?: string }>(
                `/api/v1/whatsapp/${schoolId}/conversaciones/${abierta.id}/${tomar ? 'tomar' : 'soltar'}`, {});
            toast({
                title: tomar ? 'Tomaste la conversación' : 'Soltaste la conversación',
                description: tomar
                    ? 'El asistente no le va a escribir nada automático hasta que la sueltes o pasen 12 horas.'
                    : 'El asistente vuelve a atenderla.',
            });
            setAbierta({
                ...abierta,
                toma: tomar && r?.tomada_hasta
                    ? { tomada_por: r.tomada_por ?? '', tomada_por_nombre: 'ti', tomada_hasta: r.tomada_hasta }
                    : null,
            });
            await cargarLista();
        } catch (e: any) {
            toast({ title: tomar ? 'No se pudo tomar' : 'No se pudo soltar', description: e?.message, variant: 'destructive' });
        } finally {
            setAccionando(false);
        }
    };

    const cerrar = async () => {
        if (!abierta) return;
        setAccionando(true);
        try {
            await bffClient.post(`/api/v1/whatsapp/${schoolId}/conversaciones/${abierta.id}/cerrar`, {});
            toast({ title: 'Conversación cerrada', description: 'Si la persona vuelve a escribir, se abre de nuevo.' });
            setAbierta({ ...abierta, status: 'closed', pendiente: false });
            await cargarLista();
        } catch (e: any) {
            toast({ title: 'No se pudo cerrar', description: e?.message, variant: 'destructive' });
        } finally {
            setAccionando(false);
        }
    };

    const conteo = (v: Vista) =>
        conteos && typeof conteos[v] === 'number'
            ? <span className="ml-1.5 text-[11px] text-muted-foreground tabular-nums">{conteos[v]}</span>
            : null;

    const vacio = vista === 'familias'
        ? 'No hay conversaciones con familias.'
        : vista === 'otros'
            ? 'No hay mensajes de números que no son familias.'
            : 'Todavía no hay conversaciones.';

    return (
        <div className="grid md:grid-cols-[340px_1fr] gap-4">
            {/* ── Lista ── */}
            <div className={`space-y-2 min-w-0 ${abierta ? 'hidden md:block' : ''}`}>
                {clasificacion && (<Tabs value={vista} onValueChange={(v) => { setVista(v as Vista); setAbierta(null); }}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="familias">Familias{conteo('familias')}</TabsTrigger>
                        <TabsTrigger value="otros">Otros{conteo('otros')}</TabsTrigger>
                        <TabsTrigger value="todas">Todas{conteo('todas')}</TabsTrigger>
                    </TabsList>
                </Tabs>)}
                {clasificacion && vista === 'otros' && (
                    <p className="text-xs text-muted-foreground px-1">
                        Números que no son de acudientes: personas del equipo, desconocidos y lo que
                        marcaste como personal. El asistente no les responde salvo que lo actives en
                        Configuración.
                    </p>
                )}
                <label className="flex items-center justify-between gap-2 px-1 py-1 text-xs text-muted-foreground">
                    <span>
                        Sin responder primero
                        {cuantosSinResponder > 0 && !cargandoLista && (
                            <span className="ml-1 font-medium text-destructive">({cuantosSinResponder})</span>
                        )}
                    </span>
                    <Switch checked={sinResponderPrimero} onCheckedChange={setSinResponderPrimero} />
                </label>

                {cargandoLista && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando conversaciones…
                    </div>
                )}
                {!cargandoLista && !visibles.length && (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-40" />
                        {vacio}
                    </div>
                )}
                {!cargandoLista && visibles.map((c) => (
                    <button
                        key={c.id}
                        onClick={() => void abrir(c)}
                        className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/50
                                    ${abierta?.id === c.id ? 'bg-muted border-primary/40' : ''}`}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-sm truncate">
                                {c.contact_name || c.contact_wa_id}
                            </span>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                                {hora(c.last_message_at)}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {c.ultimo_mensaje?.text_body ?? `(${c.ultimo_mensaje?.type ?? 'sin mensajes'})`}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {sinResponder(c) && (
                                <Badge variant="destructive" className="text-[10px]">Sin responder</Badge>
                            )}
                            <EtiquetaTipo tipo={c.contact_kind} />
                            {c.toma && (
                                <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 dark:text-blue-400"
                                       title={textoDeToma(c.toma)}>
                                    <Hand className="h-2.5 w-2.5 mr-1" />
                                    Atendida por {c.toma.tomada_por_nombre || 'la escuela'}
                                </Badge>
                            )}
                            {c.borradores_pendientes > 0 && (
                                <Badge variant="secondary" className="text-[10px]">
                                    <Sparkles className="h-2.5 w-2.5 mr-1" />
                                    {c.borradores_pendientes} por aprobar
                                </Badge>
                            )}
                            {/* Con contact_kind ya se sabe quién es; "Sin identificar" sobra. */}
                            {!c.identified && !c.contact_kind && (
                                <Badge variant="outline" className="text-[10px]">Sin identificar</Badge>
                            )}
                            {c.ventana_abierta
                                ? <span className="text-[10px] text-muted-foreground">
                                      <Clock className="h-2.5 w-2.5 inline mr-0.5" />quedan {restante(c.ventana_vence)}
                                  </span>
                                : <span className="text-[10px] text-amber-600 dark:text-amber-500">ventana cerrada</span>}
                        </div>
                    </button>
                ))}
            </div>

            {/* ── Hilo ── */}
            {abierta ? (
                <div className="border rounded-lg flex flex-col min-h-[420px]">
                    <div className="border-b p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setAbierta(null)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">
                                    {abierta.contact_name || abierta.contact_wa_id}
                                </p>
                                <p className="text-xs text-muted-foreground">{abierta.contact_wa_id}</p>
                            </div>
                            <EtiquetaTipo tipo={abierta.contact_kind} />
                        </div>
                        {/* Acciones: botones anchos en el celular, que se tocan con el dedo. */}
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                            {abierta.toma ? (
                                <Button variant="outline" size="sm" disabled={accionando || !tomaDisponible}
                                        onClick={() => void cambiarToma(false)}>
                                    <Unlock className="h-3.5 w-3.5 mr-1" /> Soltar
                                </Button>
                            ) : (
                                <Button variant="outline" size="sm" disabled={accionando || !tomaDisponible}
                                        title={tomaDisponible ? 'El asistente deja de responder en esta conversación'
                                            : 'Todavía no disponible'}
                                        onClick={() => void cambiarToma(true)}>
                                    <Hand className="h-3.5 w-3.5 mr-1" /> Tomar la conversación
                                </Button>
                            )}
                            <Button
                                variant="outline" size="sm" disabled={accionando}
                                onClick={() => esPersonal ? void cambiarPersonal(false) : setConfirmarPersonal(true)}
                            >
                                {esPersonal
                                    ? <><Eye className="h-3.5 w-3.5 mr-1" /> Quitar marca de personal</>
                                    : <><EyeOff className="h-3.5 w-3.5 mr-1" /> Marcar como personal</>}
                            </Button>
                            <Button
                                variant="outline" size="sm"
                                disabled={accionando || abierta.status === 'closed'}
                                onClick={() => void cerrar()}
                            >
                                {accionando
                                    ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                    : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                                {abierta.status === 'closed' ? 'Cerrada' : 'Cerrar conversación'}
                            </Button>
                        </div>
                        {esPersonal && (
                            <p className="text-xs text-muted-foreground">
                                Conversación personal: el asistente no le responde. Contéstala desde tu celular.
                            </p>
                        )}
                        {abierta.toma && (
                            <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1">
                                <Hand className="h-3 w-3 shrink-0" />
                                {textoDeToma(abierta.toma)}. El asistente no le escribe nada automático
                                (los comprobantes se aplican igual, sin avisarle).
                            </p>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[52vh]">
                        {cargandoHilo && (
                            <p className="text-sm text-muted-foreground text-center py-6">
                                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Cargando…
                            </p>
                        )}
                        {mensajes.map((m) => {
                            const q = quien(m, abierta.contact_kind);
                            const mio = m.direction === 'outbound';
                            return (
                                <div key={m.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-lg px-3 py-2 ${mio ? 'bg-primary/10' : 'bg-muted'}`}>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                                            {q.icono} {q.texto} · {hora(m.created_at)}
                                        </div>
                                        <p className="text-sm whitespace-pre-wrap break-words">
                                            {m.text_body ?? <span className="italic opacity-70">({m.type})</span>}
                                        </p>
                                        {m.error_detail && (
                                            <p className="text-[11px] text-destructive mt-1">{m.error_detail}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Borradores del modo asistido */}
                    {borradores.map((b) => (
                        <div key={b.id} className="border-t bg-muted/30 p-3 space-y-2">
                            <p className="text-xs font-medium text-foreground flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> El asistente propone responder
                                {b.llm_provider && <span className="text-muted-foreground">· {b.llm_provider}</span>}
                            </p>
                            <Textarea
                                defaultValue={b.edited_text ?? b.proposed_text}
                                rows={3}
                                id={`draft-${b.id}`}
                                className="text-sm"
                            />
                            <div className="flex gap-2">
                                <Button size="sm" disabled={enviando} onClick={() => {
                                    const el = document.getElementById(`draft-${b.id}`) as HTMLTextAreaElement | null;
                                    const v = el?.value?.trim();
                                    void resolverBorrador(b.id, 'aprobar', v !== b.proposed_text ? v : undefined);
                                }}>
                                    <Send className="h-3.5 w-3.5 mr-1" /> Aprobar y enviar
                                </Button>
                                <Button size="sm" variant="outline" disabled={enviando}
                                        onClick={() => void resolverBorrador(b.id, 'descartar')}>
                                    <X className="h-3.5 w-3.5 mr-1" /> Descartar
                                </Button>
                            </div>
                        </div>
                    ))}

                    {/* Responder — solo si la ventana está abierta */}
                    <div className="border-t p-3">
                        {abierta.ventana_abierta ? (
                            <div className="flex gap-2">
                                <Textarea
                                    value={texto}
                                    onChange={(e) => setTexto(e.target.value)}
                                    placeholder="Escribe tu respuesta…"
                                    rows={2}
                                    className="text-sm"
                                />
                                <Button onClick={() => void responder()} disabled={enviando || !texto.trim()}>
                                    {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                            </div>
                        ) : (
                            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm">
                                <p className="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                    <Clock className="h-4 w-4" /> Ventana de 24 horas cerrada
                                </p>
                                <p className="text-muted-foreground mt-1">
                                    Pasaron más de 24 horas desde el último mensaje de esta persona. WhatsApp
                                    no permite responder con texto libre: hay que enviarle una plantilla
                                    aprobada. Si te escribe de nuevo, la ventana se reabre.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="hidden md:flex items-center justify-center border rounded-lg text-sm text-muted-foreground min-h-[420px]">
                    Elige una conversación
                </div>
            )}

            <AlertDialog open={confirmarPersonal} onOpenChange={(v) => { if (!accionando) setConfirmarPersonal(v); }}>
                <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Marcar como personal?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta conversación sale de Familias y el asistente <strong>no le va a responder
                            nunca</strong>. Los mensajes los sigues viendo y respondiendo desde tu celular, y
                            puedes quitar la marca cuando quieras desde la pestaña Otros.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={accionando}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={accionando}
                            onClick={(e) => { e.preventDefault(); void cambiarPersonal(true); }}
                        >
                            {accionando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Marcar como personal
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
