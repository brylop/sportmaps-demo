/**
 * SupportChatModal — soporte in-app S0+S1 (MOD-21).
 *
 * Un solo hilo persistente (spec `docs/specs/soporte-in-app-chat-y-bot.md` §5):
 * se abre y está la historia completa, nunca un chat en blanco. El primer
 * mensaje del usuario abre el ticket (`POST /support/open`), los siguientes
 * van directo a `POST /support/messages` — el bot responde en la misma
 * request cuando puede, o el humano lo hace después (S0 siempre funciona,
 * el bot es una optimización encima, nunca un bloqueante).
 */
import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, User, Loader2, Headset } from "lucide-react";
import { bffClient } from "@/lib/api/bffClient";

interface SupportMessage {
    id: string;
    author_type: "user" | "bot" | "agent";
    body: string;
    created_at: string;
}

interface SupportTicket {
    id: string;
    status: string;
    subject: string | null;
    category: string | null;
}

interface SupportChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const STATUS_CHIP: Record<string, { label: string; className: string }> = {
    open: { label: "SportBot", className: "bg-primary/10 text-primary" },
    bot_handled: { label: "SportBot", className: "bg-primary/10 text-primary" },
    waiting_human: { label: "Esperando a soporte", className: "bg-amber-500/10 text-amber-600" },
    waiting_user: { label: "Te respondieron", className: "bg-emerald-500/10 text-emerald-600" },
    resolved: { label: "Resuelto", className: "bg-muted text-muted-foreground" },
    closed: { label: "Resuelto", className: "bg-muted text-muted-foreground" },
};

export function SupportChatModal({ isOpen, onClose }: SupportChatModalProps) {
    const [ticket, setTicket] = useState<SupportTicket | null>(null);
    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [input, setInput] = useState("");
    const [loadingThread, setLoadingThread] = useState(false);
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        setLoadingThread(true);
        bffClient
            .get<{ ticket: SupportTicket | null; messages: SupportMessage[] }>("/api/v1/support/thread")
            .then((res) => {
                setTicket(res.ticket);
                setMessages(res.messages);
            })
            .catch(() => {
                // Sin hilo previo o error de red: arranca en blanco, el primer
                // mensaje del usuario lo crea igual (POST /open).
                setTicket(null);
                setMessages([]);
            })
            .finally(() => setLoadingThread(false));
    }, [isOpen]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, sending]);

    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
    }, [isOpen]);

    const send = async () => {
        const body = input.trim();
        if (!body || sending) return;
        setInput("");
        setSending(true);

        // Optimista: el usuario ve su mensaje de inmediato.
        const optimistic: SupportMessage = {
            id: `optimistic-${Date.now()}`,
            author_type: "user",
            body,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);

        try {
            let activeTicketId = ticket?.id;
            if (!activeTicketId) {
                const opened = await bffClient.post<{ ticket: SupportTicket }>("/api/v1/support/open", {});
                activeTicketId = opened.ticket.id;
                setTicket(opened.ticket);
            }

            const res = await bffClient.post<{ messages: SupportMessage[]; ticket: SupportTicket | null }>(
                "/api/v1/support/messages",
                { ticketId: activeTicketId, body },
            );
            setMessages(res.messages);
            if (res.ticket) setTicket(res.ticket);
        } catch (err) {
            // El mensaje optimista queda, pero se marca el error sin perder lo escrito.
            setMessages((prev) => [
                ...prev,
                {
                    id: `error-${Date.now()}`,
                    author_type: "bot",
                    body: "No pude enviar tu mensaje — revisa tu conexión e intenta de nuevo.",
                    created_at: new Date().toISOString(),
                },
            ]);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    const chip = STATUS_CHIP[ticket?.status ?? "open"] ?? STATUS_CHIP.open;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg h-[600px] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-4 py-3 border-b bg-muted/40">
                    <DialogTitle className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                                <Headset className="w-5 h-5 text-primary-foreground" />
                            </div>
                            <div className="text-left">
                                <span className="text-base font-semibold">Soporte SportMaps</span>
                                <p className="text-xs text-muted-foreground font-normal">Un solo chat, siempre la misma conversación</p>
                            </div>
                        </div>
                        <Badge className={`${chip.className} border-0 shrink-0`}>{chip.label}</Badge>
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="flex-1 px-4" ref={scrollRef}>
                    <div className="py-4 space-y-4">
                        {loadingThread && (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        )}

                        {!loadingThread && messages.length === 0 && (
                            <div className="flex gap-3 justify-start">
                                <BotAvatar />
                                <div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm bg-muted">
                                    ¡Hola! 👋 Soy el asistente de soporte de SportMaps. Cuéntame qué necesitas y te ayudo, o te paso con una persona del equipo si hace falta.
                                </div>
                            </div>
                        )}

                        {messages.map((m) => (
                            <div key={m.id} className={`flex gap-3 ${m.author_type === "user" ? "justify-end" : "justify-start"}`}>
                                {m.author_type !== "user" && <BotAvatar isAgent={m.author_type === "agent"} />}
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                                        m.author_type === "user"
                                            ? "bg-primary text-primary-foreground rounded-br-md"
                                            : "bg-muted rounded-bl-md"
                                    }`}
                                >
                                    {m.body}
                                </div>
                                {m.author_type === "user" && (
                                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                                        <User className="w-4 h-4 text-primary" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {sending && (
                            <div className="flex gap-3 justify-start">
                                <BotAvatar />
                                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5">
                                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Escribiendo...
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t bg-muted/30">
                    <div className="flex gap-2">
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe tu mensaje..."
                            disabled={sending}
                            className="flex-1 bg-background"
                        />
                        <Button onClick={send} disabled={!input.trim() || sending} size="icon">
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function BotAvatar({ isAgent = false }: { isAgent?: boolean }) {
    return (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
            {isAgent ? <Headset className="w-4 h-4 text-primary-foreground" /> : <Bot className="w-4 h-4 text-primary-foreground" />}
        </div>
    );
}
