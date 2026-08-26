/**
 * AdminSupportInboxPage — bandeja de soporte in-app (MOD-21 S2).
 *
 * Lista + hilo + responder + panel de diagnóstico embebido + notas internas.
 * El panel de diagnóstico (`docs/specs/soporte-in-app-chat-y-bot.md` §3) es
 * lo que cierra la promesa de S2: "el ticket que llega al super_admin debe
 * abrirse con el panel de diagnóstico embebido: el humano ve el estado de la
 * cuenta en la misma pantalla donde lee el reclamo". Solo super_admin (el
 * BFF ya lo exige con requireSuperAdminStrict).
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Headset, Send, Loader2, RefreshCw, Lock } from "lucide-react";
import { bffClient } from "@/lib/api/bffClient";
import { useToast } from "@/hooks/use-toast";
import { TicketDiagnosisPanel } from "@/components/support/TicketDiagnosisPanel";

interface InboxTicket {
    id: string;
    requester_id: string;
    requesterName: string | null;
    status: string;
    subject: string | null;
    category: string | null;
    school_id: string | null;
    created_at: string;
    updated_at: string;
}

interface ThreadMessage {
    id: string;
    author_type: "user" | "bot" | "agent";
    body: string;
    internal_note: boolean;
    created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
    open: "Nuevo",
    bot_handled: "Respondido por bot",
    waiting_human: "Esperando soporte",
    waiting_user: "Esperando al usuario",
};

export default function AdminSupportInboxPage() {
    const { toast } = useToast();
    const [tickets, setTickets] = useState<InboxTicket[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ThreadMessage[]>([]);
    const [loadingThread, setLoadingThread] = useState(false);
    const [reply, setReply] = useState("");
    const [sending, setSending] = useState(false);
    const [internalNote, setInternalNote] = useState(false);

    const selectedTicket = tickets.find((t) => t.id === selectedId) ?? null;

    const loadTickets = useCallback(async () => {
        setLoadingTickets(true);
        try {
            const res = await bffClient.get<{ tickets: InboxTicket[] }>("/api/v1/admin/support/tickets");
            setTickets(res.tickets);
        } catch (err: any) {
            toast({ title: "No se pudo cargar la bandeja", description: err?.message, variant: "destructive" });
        } finally {
            setLoadingTickets(false);
        }
    }, [toast]);

    useEffect(() => {
        loadTickets();
    }, [loadTickets]);

    const openTicket = async (id: string) => {
        setSelectedId(id);
        setLoadingThread(true);
        try {
            const res = await bffClient.get<{ messages: ThreadMessage[] }>(`/api/v1/admin/support/tickets/${id}/messages`);
            setMessages(res.messages);
        } catch (err: any) {
            toast({ title: "No se pudo cargar la conversación", description: err?.message, variant: "destructive" });
        } finally {
            setLoadingThread(false);
        }
    };

    const sendReply = async () => {
        const body = reply.trim();
        if (!body || !selectedId || sending) return;
        setSending(true);
        try {
            const res = await bffClient.post<{ messages: ThreadMessage[] }>("/api/v1/support/messages", {
                ticketId: selectedId,
                body,
                internal: internalNote,
            });
            setMessages(res.messages);
            setReply("");
            setInternalNote(false);
            loadTickets(); // refresca estado/orden de la bandeja
        } catch (err: any) {
            toast({ title: "No se pudo enviar la respuesta", description: err?.message, variant: "destructive" });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Headset className="h-6 w-6" />
                        Bandeja de soporte
                    </h1>
                    <p className="text-sm text-muted-foreground">Tickets abiertos, ordenados por antigüedad — sin asignar primero.</p>
                </div>
                <Button variant="outline" size="sm" onClick={loadTickets} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Actualizar
                </Button>
            </div>

            <div className="grid md:grid-cols-[320px_1fr] gap-4">
                <Card className="h-[70vh] overflow-hidden flex flex-col">
                    <ScrollArea className="flex-1">
                        {loadingTickets ? (
                            <LoadingSpinner text="Cargando..." />
                        ) : tickets.length === 0 ? (
                            <p className="text-sm text-muted-foreground p-4">Sin tickets abiertos. 🎉</p>
                        ) : (
                            <div className="divide-y">
                                {tickets.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => openTicket(t.id)}
                                        className={`w-full text-left p-3 hover:bg-muted/60 transition-colors ${
                                            selectedId === t.id ? "bg-muted" : ""
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium text-sm truncate">{t.requesterName || "Sin nombre"}</span>
                                            <Badge variant="secondary" className="text-[10px] shrink-0">
                                                {STATUS_LABEL[t.status] ?? t.status}
                                            </Badge>
                                        </div>
                                        {t.subject && <p className="text-xs text-muted-foreground truncate mt-0.5">{t.subject}</p>}
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            {new Date(t.updated_at).toLocaleString("es-CO")}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </Card>

                <Card className="h-[70vh] flex flex-col">
                    {!selectedId ? (
                        <CardContent className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                            Selecciona un ticket de la izquierda.
                        </CardContent>
                    ) : (
                        <>
                            {selectedTicket && (
                                <div className="p-3 border-b">
                                    <TicketDiagnosisPanel userId={selectedTicket.requester_id} />
                                </div>
                            )}
                            <ScrollArea className="flex-1 p-4">
                                {loadingThread ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {messages.map((m) => (
                                            <div
                                                key={m.id}
                                                className={`flex ${m.author_type === "agent" ? "justify-end" : "justify-start"}`}
                                            >
                                                <div
                                                    className={`max-w-[75%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                                                        m.internal_note
                                                            ? "bg-amber-500/10 border border-amber-500/30"
                                                            : m.author_type === "agent"
                                                              ? "bg-primary text-primary-foreground"
                                                              : m.author_type === "bot"
                                                                ? "bg-primary/10"
                                                                : "bg-muted"
                                                    }`}
                                                >
                                                    <p className="text-[10px] opacity-70 mb-0.5 uppercase tracking-wide">
                                                        {m.internal_note ? "Nota interna" : m.author_type}
                                                    </p>
                                                    {m.body}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                            <div className="p-3 border-t space-y-2">
                                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none w-fit">
                                    <Checkbox
                                        checked={internalNote}
                                        onCheckedChange={(v) => setInternalNote(v === true)}
                                    />
                                    <Lock className="h-3 w-3" />
                                    Nota interna (el solicitante no la ve)
                                </label>
                                <div className="flex gap-2">
                                    <Input
                                        value={reply}
                                        onChange={(e) => setReply(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                sendReply();
                                            }
                                        }}
                                        placeholder={internalNote ? "Escribe una nota interna..." : "Responder..."}
                                        disabled={sending}
                                        className={internalNote ? "border-amber-500/50" : undefined}
                                    />
                                    <Button onClick={sendReply} disabled={!reply.trim() || sending} size="icon">
                                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </Card>
            </div>
        </div>
    );
}
