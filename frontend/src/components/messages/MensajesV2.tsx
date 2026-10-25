/**
 * Mensajes del acudiente V2 (/messages). En SportMaps no se redactan mensajes
 * (la tabla `messages` no tiene historia y no hay pantalla para escribir), así
 * que lo útil es decir la verdad: al club se le escribe por WhatsApp, con el
 * celular que la escuela registró (schools.phone, igual que «Más»). Si algún
 * día llega un mensaje, se lista aquí y se lee completo.
 */
import { useState } from 'react';
import { AlertTriangle, ArrowLeft, MessageCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface MensajeV2 {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  content: string;
  read: boolean;
  created_at: string;
  other_user_name: string;
}

export interface MensajesV2Props {
  userId: string | undefined;
  messages: MensajeV2[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Enlace wa.me del club, o null si la escuela no registró celular. */
  whatsapp: string | null;
  schoolName?: string | null;
}

const otroDe = (m: MensajeV2, yo: string | undefined) => (m.sender_id === yo ? m.recipient_id : m.sender_id);

/** Última conversación por persona, en el orden en que llegaron (más reciente primero). */
export function conversaciones(messages: MensajeV2[], yo: string | undefined): MensajeV2[] {
  const vistos = new Set<string>();
  return messages.filter((m) => {
    const otro = otroDe(m, yo);
    if (vistos.has(otro)) return false;
    vistos.add(otro);
    return true;
  });
}

function fecha(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function EscribirleAlClub({ whatsapp, schoolName }: { whatsapp: string | null; schoolName?: string | null }) {
  if (!whatsapp) {
    return (
      <p className="text-sm text-muted-foreground">
        {schoolName ? `${schoolName} todavía` : 'Tu club todavía'} no registró un WhatsApp en SportMaps. Pídele el número al profe.
      </p>
    );
  }
  return (
    <Button asChild className="min-h-touch w-full gap-2 sm:w-auto">
      <a href={whatsapp} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        Escribirle al club
      </a>
    </Button>
  );
}

export function MensajesV2({ userId, messages, isLoading, isError, onRetry, whatsapp, schoolName }: MensajesV2Props) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const lista = conversaciones(messages, userId);

  if (abierta) {
    const hilo = messages.filter((m) => otroDe(m, userId) === abierta).slice().reverse();
    const nombre = hilo[0]?.other_user_name ?? 'Conversación';
    return (
      <div className="mx-auto w-full max-w-page-narrow space-y-4 pb-6">
        <button
          type="button"
          onClick={() => setAbierta(null)}
          className="inline-flex min-h-touch items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Todos los mensajes
        </button>
        <h1 className="text-2xl font-bold">{nombre}</h1>
        <ul className="space-y-3">
          {hilo.map((m) => (
            <li key={m.id} className={cn('flex', m.sender_id === userId ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-2xl px-4 py-3', m.sender_id === userId ? 'bg-primary text-primary-foreground' : 'border bg-card')}>
                {m.subject && <p className="text-sm font-semibold">{m.subject}</p>}
                <p className="whitespace-pre-line text-base">{m.content}</p>
                <p className={cn('mt-1 text-xs', m.sender_id === userId ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{fecha(m.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
        <EscribirleAlClub whatsapp={whatsapp} schoolName={schoolName} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-page-narrow space-y-4 pb-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Mensajes</h1>
        <p className="text-base text-muted-foreground">Para hablar con el club, escríbele por WhatsApp.</p>
      </header>

      {isLoading && (
        <div className="space-y-3" aria-busy="true" aria-label="Cargando tus mensajes">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      )}

      {isError && !isLoading && (
        <div role="alert" className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            No pudimos cargar tus mensajes
          </p>
          <p className="text-sm text-muted-foreground">Revisa tu conexión e inténtalo de nuevo.</p>
          <Button variant="outline" className="min-h-touch" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Reintentar
          </Button>
        </div>
      )}

      {!isLoading && !isError && lista.length === 0 && (
        <div className="space-y-3 rounded-2xl border bg-card p-6 text-center">
          <p className="font-semibold">No tienes mensajes</p>
          <p className="text-sm text-muted-foreground">
            Los avisos del club te llegan a Notificaciones. Si necesitas preguntar algo, escríbele al club por WhatsApp.
          </p>
          <div className="flex justify-center">
            <EscribirleAlClub whatsapp={whatsapp} schoolName={schoolName} />
          </div>
        </div>
      )}

      {!isLoading && !isError && lista.length > 0 && (
        <>
          <ul className="overflow-hidden rounded-2xl border bg-card" aria-label="Conversaciones">
            {lista.map((m, i) => {
              const nueva = !m.read && m.recipient_id === userId;
              return (
                <li key={m.id} className={cn(i > 0 && 'border-t')}>
                  <button
                    type="button"
                    onClick={() => setAbierta(otroDe(m, userId))}
                    className="flex min-h-touch w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50"
                  >
                    <span className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', nueva ? 'bg-primary' : 'bg-transparent')} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn('truncate text-base', nueva ? 'font-semibold' : 'font-medium')}>{m.other_user_name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{fecha(m.created_at)}</span>
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">{m.content}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <EscribirleAlClub whatsapp={whatsapp} schoolName={schoolName} />
        </>
      )}
    </div>
  );
}
