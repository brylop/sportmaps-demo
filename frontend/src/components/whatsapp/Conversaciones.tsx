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
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import {
    MessageSquare, Send, Bot, User, Clock, Loader2, ChevronLeft, Sparkles, X,
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
}
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

function quien(m: Mensaje): { texto: string; icono: JSX.Element } {
    if (m.direction === 'inbound') return { texto: 'Familia', icono: <User className="h-3 w-3" /> };
    return m.ai_generated
        ? { texto: 'Asistente', icono: <Bot className="h-3 w-3" /> }
        : { texto: 'Escuela', icono: <User className="h-3 w-3" /> };
}

export function Conversaciones({ schoolId }: { schoolId: string }) {
    const { toast } = useToast();
    const [lista, setLista] = useState<Conversacion[]>([]);
    const [cargandoLista, setCargandoLista] = useState(true);
    const [abierta, setAbierta] = useState<Conversacion | null>(null);
    const [mensajes, setMensajes] = useState<Mensaje[]>([]);
    const [borradores, setBorradores] = useState<Borrador[]>([]);
    const [cargandoHilo, setCargandoHilo] = useState(false);
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);

    const cargarLista = useCallback(async () => {
        setCargandoLista(true);
        try {
            const r = await bffClient.get<{ conversaciones: Conversacion[] }>(
                `/api/v1/whatsapp/${schoolId}/conversaciones`);
            setLista(r.conversaciones ?? []);
        } catch (e: any) {
            toast({ title: 'No se pudieron cargar las conversaciones', description: e?.message, variant: 'destructive' });
        } finally {
            setCargandoLista(false);
        }
    }, [schoolId, toast]);

    useEffect(() => { void cargarLista(); }, [cargarLista]);

    const abrir = useCallback(async (c: Conversacion) => {
        setAbierta(c);
        setTexto('');
        setCargandoHilo(true);
        try {
            const r = await bffClient.get<{ conversacion: Conversacion; mensajes: Mensaje[]; borradores: Borrador[] }>(
                `/api/v1/whatsapp/${schoolId}/conversaciones/${c.id}`);
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

    if (cargandoLista) {
        return <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando conversaciones…
        </div>;
    }

    if (!lista.length) {
        return <div className="text-center py-12 text-sm text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-40" />
            Todavía no hay conversaciones.
        </div>;
    }

    return (
        <div className="grid md:grid-cols-[320px_1fr] gap-4">
            {/* ── Lista ── */}
            <div className={`space-y-1 ${abierta ? 'hidden md:block' : ''}`}>
                {lista.map((c) => (
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
                            {c.borradores_pendientes > 0 && (
                                <Badge variant="secondary" className="text-[10px]">
                                    <Sparkles className="h-2.5 w-2.5 mr-1" />
                                    {c.borradores_pendientes} por aprobar
                                </Badge>
                            )}
                            {c.status === 'open' && (
                                <Badge variant="destructive" className="text-[10px]">Esperando respuesta</Badge>
                            )}
                            {!c.identified && (
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
                    <div className="border-b p-3 flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setAbierta(null)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                                {abierta.contact_name || abierta.contact_wa_id}
                            </p>
                            <p className="text-xs text-muted-foreground">{abierta.contact_wa_id}</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[52vh]">
                        {cargandoHilo && (
                            <p className="text-sm text-muted-foreground text-center py-6">
                                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Cargando…
                            </p>
                        )}
                        {mensajes.map((m) => {
                            const q = quien(m);
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
        </div>
    );
}
