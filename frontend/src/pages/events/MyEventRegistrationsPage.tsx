/**
 * «Eventos y torneos» — /my-event-registrations. Inscripciones individuales a
 * eventos (acudiente por sus hijos, deportista adulto por sí mismo).
 *
 * Rediseño V2 (2026-10-24): una frase arriba, lista de una columna
 * (max-w-page-narrow), y carga / vacío / error como tres estados distintos:
 * un error del BFF nunca puede verse como «No tienes inscripciones».
 *
 * La ruta vive FUERA de AuthLayout (App.tsx), así que el «Volver» del acudiente
 * no lo pone el layout: lo pone esta página con el mismo VolverAcudiente. Los
 * demás roles conservan su flecha a /dashboard. «Explorar eventos» solo sale
 * con SHOW_EXPLORE.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bffClient } from '@/lib/api/bffClient';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertTriangle, Calendar, ExternalLink, MapPin, RefreshCw, Ticket } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { VolverAcudiente } from '@/components/parent/v2/VolverAcudiente';
import { ACUDIENTE_V2, SHOW_EXPLORE } from '@/lib/feature-flags';
import { cn } from '@/lib/utils';
import {
  CLASE_TONO, estadoInscripcionEvento, estadoPagoEvento, fechaEvento, fraseEventos,
} from '@/components/inscripciones/inscripcionesTextos';

interface MyRegistration {
  id: string;
  event_id: string;
  participant_name: string;
  participant_role: string;
  participant_age?: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  payment_status: string;
  package_choice?: string;
  category_id?: string;
  child_id?: string;
  created_at: string;
  events: {
    id: string;
    title: string;
    sport: string;
    event_date: string;
    city: string;
    slug: string;
    status: string;
    image_url?: string;
    start_time?: string;
  };
}

const PKG_LABELS: Record<string, string> = {
  pkg_solo: 'Solo competencia',
  pkg_3: '2 noches de hotel',
  pkg_2: '3 noches de hotel',
  pkg_1: '4 noches de hotel',
};

type LoadState = 'loading' | 'error' | 'ready';

export default function MyEventRegistrationsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { currentUserRole } = useSchoolContext();
  const esAcudienteV2 = ACUDIENTE_V2 && (currentUserRole ?? profile?.role) === 'parent';
  const [registrations, setRegistrations] = useState<MyRegistration[]>([]);
  const [state, setState] = useState<LoadState>('loading');

  const loadRegistrations = useCallback(async () => {
    setState('loading');
    try {
      const data = await bffClient.get<MyRegistration[] | null>('/api/v1/events/my-registrations/list');
      setRegistrations(Array.isArray(data) ? data : []);
      setState('ready');
    } catch {
      // Sin toast: el error se muestra en la pantalla, con su «Reintentar».
      setState('error');
    }
  }, []);

  useEffect(() => {
    void loadRegistrations();
  }, [loadRegistrations]);

  return (
    <div className="mx-auto w-full max-w-page-narrow space-y-4 px-gutter pb-nav-safe pt-4 md:pb-8 md:pt-6">
      {esAcudienteV2 ? (
        <VolverAcudiente />
      ) : (
        <Button variant="ghost" className="min-h-touch -ml-2 gap-2 px-2 text-muted-foreground" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver
        </Button>
      )}

      <header className="space-y-2">
        <h1 className="text-2xl font-bold md:text-3xl">{esAcudienteV2 ? 'Eventos y torneos' : 'Mis inscripciones a eventos'}</h1>
        {state === 'ready' && <p className="text-base text-muted-foreground">{fraseEventos(registrations)}</p>}
        {SHOW_EXPLORE && (
          <Button className="min-h-touch w-full gap-2 sm:w-auto" onClick={() => navigate('/events')}>
            <Ticket className="h-4 w-4" aria-hidden="true" />
            Explorar eventos
          </Button>
        )}
      </header>

      {state === 'loading' && (
        <div className="space-y-3" aria-busy="true" aria-label="Cargando inscripciones a eventos">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      )}

      {state === 'error' && (
        <div role="alert" className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            No pudimos cargar tus inscripciones a eventos
          </p>
          <p className="text-sm text-muted-foreground">
            Esto no quiere decir que no tengas inscripciones. Inténtalo de nuevo en un momento.
          </p>
          <Button variant="outline" className="min-h-touch" onClick={() => void loadRegistrations()}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Reintentar
          </Button>
        </div>
      )}

      {state === 'ready' && registrations.length === 0 && (
        <div className="rounded-2xl border bg-card p-6 text-center">
          <p className="font-semibold">Aún no hay inscripciones</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {esAcudienteV2
              ? 'Cuando inscribas a tus hijos en un evento o torneo, aparece aquí.'
              : 'Cuando te inscribas en un evento o torneo, aparece aquí.'}
          </p>
        </div>
      )}

      {state === 'ready' && registrations.length > 0 && (
        <ul className="space-y-3" aria-label="Inscripciones a eventos">
          {registrations.map((reg) => <RegistrationCard key={reg.id} reg={reg} />)}
        </ul>
      )}
    </div>
  );
}

function RegistrationCard({ reg }: { reg: MyRegistration }) {
  const ev = reg.events;
  const estado = estadoInscripcionEvento(reg.status);
  const pago = estadoPagoEvento(reg.payment_status);
  const datos = [
    ev?.event_date ? { icon: Calendar, text: fechaEvento(ev.event_date) } : null,
    ev?.city ? { icon: MapPin, text: ev.city } : null,
  ].filter(Boolean) as { icon: typeof Calendar; text: string }[];

  return (
    <li className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex gap-3 p-4">
        {ev?.image_url && (
          <img src={ev.image_url} alt="" className="h-touch w-touch shrink-0 rounded-xl object-cover sm:h-20 sm:w-20" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="min-w-0 text-base font-semibold leading-snug">{ev?.title || 'Evento'}</h2>
            <span className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', CLASE_TONO[estado.tono])}>
              {estado.label}
            </span>
          </div>
          {(datos.length > 0 || ev?.sport) && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {datos.map(({ icon: Icon, text }) => (
                <span key={text} className="inline-flex items-center gap-1">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {text}
                </span>
              ))}
              {ev?.sport && <span className="capitalize">{ev.sport}</span>}
            </p>
          )}
          <p className="text-sm">
            <span className="text-muted-foreground">Participante: </span>
            <span className="font-medium">{reg.participant_name}</span>
            {reg.child_id && <span className="text-muted-foreground"> · hijo/a</span>}
          </p>
          {reg.package_choice && (
            <p className="text-sm">
              <span className="text-muted-foreground">Paquete: </span>
              <span className="font-medium">{PKG_LABELS[reg.package_choice] || reg.package_choice}</span>
            </p>
          )}
          {pago && (
            <span className={cn('inline-block rounded-full px-2.5 py-1 text-xs font-semibold', CLASE_TONO[pago.tono])}>
              {pago.label}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-1">
        <span className="flex-1 text-xs text-muted-foreground">Inscrito el {fechaEvento(reg.created_at)}</span>
        {ev?.slug && (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-touch gap-1.5 px-2 text-primary"
            onClick={() => window.open(`/event/${ev.slug}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Ver evento
          </Button>
        )}
      </div>
    </li>
  );
}
