/**
 * El buzón de conversaciones (F3).
 *
 * Hasta ahora la escuela no tenía dónde leer ni responder: la pestaña "Bandeja"
 * lista comprobantes que fallaron, no chats. El bot atendía y lo que no sabía
 * manejar quedaba escalado sin que nadie pudiera verlo.
 *
 * Lo que manda sobre el diseño de acá:
 *
 *  - **Primero lo que hay que hacer.** La dueña de Dynasty (2026-10-06): «se ve
 *    todo en una sola pantalla». Eran 169 filas mezclando familias, prospectos,
 *    contactos personales, staff, hilos sin mensajes y ventanas cerradas hace
 *    días. Ahora el buzón abre en la bandeja «Por responder» (sin respuesta y
 *    con la ventana abierta), ordenada por la ventana que vence primero, y el
 *    resto queda en bandejas aparte. Lo que no pide nada (hilos sin mensajes o
 *    con solo salientes viejos) se oculta.
 *
 *  - **La ventana de 24 horas.** WhatsApp solo deja responder en texto libre
 *    mientras el titular haya escrito en las últimas 24 h. Con la ventana
 *    cerrada NO se pinta el cuadro de texto: si se pintara, la escuela
 *    escribiría, le daría enviar, y recibiría un error que no sabe leer. Vale
 *    más un cuadro que no está que uno que falla. En la lista, las de ventana
 *    cerrada van a un grupo aparte, colapsado.
 *
 *  - **Quién escribió cada mensaje.** El bot y una persona de la escuela salen
 *    por el mismo número. Si el hilo no los distingue, nadie sabe qué se
 *    prometió ni quién lo prometió.
 *
 *  - **El número también es el WhatsApp personal de la dueña** (Coexistence).
 *    Una conversación se puede marcar como personal (desde la fila o desde el
 *    hilo) para que salga a «Personal y otros» y el asistente nunca le conteste.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import {
    MessageSquare, Send, Bot, User, Clock, Loader2, ChevronLeft, ChevronDown, ChevronRight, Sparkles, X,
    EyeOff, Eye, CheckCircle2, Hand, Unlock, Search, MoreVertical, RefreshCw, MessageCircle,
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
    /** Pendiente y lo último NO es un cierre («gracias», «ok», 👍). Ausente en backends viejos. */
    requiere_respuesta?: boolean;
    /** Mejora 9: tomada por una persona (solo si está vigente). Mientras tanto el asistente calla. */
    toma?: Toma | null;
    /** El asistente lo atendió como prospecto (pidió info de clases/inscripción). Ausente en backends viejos. */
    es_prospecto?: boolean;
    /**
     * Detección de prospectos del backend (otro frente, en curso). Forma
     * tentativa: si llega un objeto, la conversación es prospecto.
     */
    prospecto?: { estado?: string | null; interes?: string | null } | null;
}

interface Toma { tomada_por: string; tomada_por_nombre: string | null; tomada_hasta: string }

/** «Atendida por Milena · hasta 9:30 p. m.» */
function textoDeToma(t: Toma): string {
    const hasta = new Date(t.tomada_hasta).toLocaleString('es-CO', { hour: 'numeric', minute: '2-digit' });
    return `Atendida por ${t.tomada_por_nombre || 'alguien de la escuela'} · hasta ${hasta}`;
}

export type TipoDeContacto =
    | 'familia' | 'familia_sin_cuenta' | 'ambiguo' | 'staff' | 'desconocido' | 'personal'
    // Reservado: si el backend llega a guardar la detección de prospectos como tipo.
    | 'prospecto';

/** Etiqueta corta por tipo de contacto. */
const ETIQUETA_TIPO: Record<TipoDeContacto, { texto: string; clase: string }> = {
    familia:            { texto: 'Familia',     clase: 'border-green-300 text-green-700 dark:text-green-400' },
    familia_sin_cuenta: { texto: 'Sin cuenta',  clase: 'border-sky-300 text-sky-700 dark:text-sky-400' },
    ambiguo:            { texto: 'Revisar',     clase: 'border-amber-300 text-amber-700 dark:text-amber-400' },
    staff:              { texto: 'Equipo',      clase: 'border-violet-300 text-violet-700 dark:text-violet-400' },
    desconocido:        { texto: 'Desconocido', clase: 'text-muted-foreground' },
    personal:           { texto: 'Personal',    clase: 'border-slate-400 text-slate-600 dark:text-slate-300' },
    prospecto:          { texto: 'Prospecto',   clase: 'border-fuchsia-300 text-fuchsia-700 dark:text-fuchsia-400' },
};

function EtiquetaTipo({ c }: { c: Pick<Conversacion, 'contact_kind' | 'es_prospecto' | 'prospecto' | 'last_inbound_at'> }) {
    const tipo: TipoDeContacto | null | undefined = esProspectoMarcado(c) ? 'prospecto' : c.contact_kind;
    if (!tipo || !ETIQUETA_TIPO[tipo]) return null;
    const e = ETIQUETA_TIPO[tipo];
    return (
        <Badge variant="outline" className={`text-[10px] ${e.clase}`}
               title={tipo === 'ambiguo' ? 'El número coincide con más de una persona: revísalo'
                   : tipo === 'prospecto' ? 'Número nuevo que pidió información de clases o inscripción' : undefined}>
            {e.texto}
        </Badge>
    );
}

/**
 * ¿Está esperando respuesta? Si el backend manda `pendiente`, manda eso. Si no
 * (versión vieja), se cae al `status === 'open'` de antes.
 */
const sinResponder = (c: Conversacion) =>
    typeof c.requiere_respuesta === 'boolean' ? c.requiere_respuesta
        : typeof c.pendiente === 'boolean' ? c.pendiente : c.status === 'open';

const TIPOS_FAMILIA: readonly string[] = ['familia', 'familia_sin_cuenta', 'ambiguo'];
const esFamilia = (c: Conversacion) => !!c.contact_kind && TIPOS_FAMILIA.includes(c.contact_kind);

/**
 * ¿Va a la bandeja de prospectos? Lo que el backend marcó como prospecto, y
 * además cualquier número desconocido que escribió.
 * TODO: los desconocidos entran mientras el backend no detecte prospectos para
 * todas las escuelas (con `responder_desconocidos` apagado el asistente nunca
 * les contesta, así que `es_prospecto` no se entera). Un contacto personal que
 * cae acá se saca con «Marcar como personal» desde la fila. Cuando el backend
 * clasifique prospectos por su cuenta, dejar solo `es_prospecto`.
 */
function esProspectoMarcado(c: Pick<Conversacion, 'contact_kind' | 'es_prospecto' | 'prospecto'>): boolean {
    if (c.contact_kind === 'personal' || c.contact_kind === 'staff') return false;
    return c.es_prospecto === true || !!c.prospecto || c.contact_kind === 'prospecto';
}
const esProspecto = (c: Conversacion) =>
    esProspectoMarcado(c) || (c.contact_kind === 'desconocido' && !!c.last_inbound_at);

const DIA_MS = 24 * 3_600_000;

/**
 * Filas que no piden nada y solo estorban: hilos sin ningún mensaje, o en los
 * que la persona nunca escribió y lo único que hay son salientes (bot, plantilla
 * o echo del celular) de hace más de una semana.
 */
function esRuido(c: Conversacion): boolean {
    if (sinResponder(c) || c.borradores_pendientes > 0 || c.toma) return false;
    if (!c.ultimo_mensaje && !c.last_inbound_at) return true;
    if (!c.last_inbound_at) {
        const t = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
        return Date.now() - t > 7 * DIA_MS;
    }
    return false;
}

type Bandeja = 'responder' | 'aprobar' | 'prospectos' | 'familias' | 'otros' | 'todas';
const BANDEJAS: { id: Bandeja; texto: string; urgente?: boolean; soloClasificado?: boolean }[] = [
    { id: 'responder',  texto: 'Por responder', urgente: true },
    // Junto a «Por responder»: los leads sin respuesta se estaban quedando (2026-10-06).
    { id: 'prospectos', texto: 'Prospectos',    soloClasificado: true },
    { id: 'aprobar',    texto: 'Por aprobar',   urgente: true },
    { id: 'familias',   texto: 'Familias',      soloClasificado: true },
    { id: 'otros',      texto: 'Personal y otros', soloClasificado: true },
    { id: 'todas',      texto: 'Todas' },
];
const CLAVE_BANDEJA = 'sm.wa.buzon.bandeja';
const POR_PAGINA = 25;

function leerBandeja(): Bandeja {
    try {
        const v = localStorage.getItem(CLAVE_BANDEJA);
        if (v && BANDEJAS.some((b) => b.id === v)) return v as Bandeja;
    } catch { /* almacenamiento bloqueado: se usa el default */ }
    return 'responder';
}
function guardarBandeja(b: Bandeja) {
    try { localStorage.setItem(CLAVE_BANDEJA, b); } catch { /* sin almacenamiento: no pasa nada */ }
}

/** Minúsculas y sin tildes, para buscar «maria» y encontrar «María». */
const normalizar = (s: string | null | undefined) =>
    (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

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

/** Fecha corta para la lista: la hora si es de hoy, el día si no. */
function cuando(s: string | null): string {
    if (!s) return '';
    const d = new Date(s);
    const hoy = new Date();
    return d.toDateString() === hoy.toDateString()
        ? d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
        : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

const msRestantes = (vence: string | null) => (vence ? new Date(vence).getTime() - Date.now() : -1);

/** Cuánto le queda a la ventana, en palabras. */
function restante(vence: string | null): string {
    const ms = msRestantes(vence);
    if (!vence) return '';
    if (ms <= 0) return 'cerrada';
    const h = Math.floor(ms / 3_600_000);
    return h >= 1 ? `${h} h` : `${Math.max(1, Math.floor(ms / 60_000))} min`;
}

/** Ventana de la fila: roja si quedan menos de 3 h para contestar en texto libre. */
function ChipVentana({ c, destacar = false }: { c: Conversacion; destacar?: boolean }) {
    if (!c.ventana_abierta) {
        return destacar ? (
            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-400"
                   title="Pasaron más de 24 h: WhatsApp solo deja escribirle con una plantilla aprobada">
                ventana cerrada · solo plantilla
            </Badge>
        ) : <span className="text-[10px] text-amber-600 dark:text-amber-500">ventana cerrada</span>;
    }
    const urgente = msRestantes(c.ventana_vence) < 3 * 3_600_000;
    if (destacar && !urgente) {
        return (
            <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-400">
                <Clock className="h-2.5 w-2.5 mr-1" />quedan {restante(c.ventana_vence)} para responder
            </Badge>
        );
    }
    return urgente ? (
        <Badge variant="outline" className="text-[10px] border-red-300 text-red-700 dark:border-red-800 dark:text-red-400">
            <Clock className="h-2.5 w-2.5 mr-1" />vence en {restante(c.ventana_vence)}
        </Badge>
    ) : (
        <span className="text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5 inline mr-0.5" />quedan {restante(c.ventana_vence)}
        </span>
    );
}

/**
 * Urgencia: lo que espera respuesta primero, y entre eso la ventana que vence
 * antes. Después, lo más reciente.
 */
function porUrgencia(a: Conversacion, b: Conversacion): number {
    const pa = sinResponder(a) && a.ventana_abierta;
    const pb = sinResponder(b) && b.ventana_abierta;
    if (pa !== pb) return pa ? -1 : 1;
    if (pa && pb) return msRestantes(a.ventana_vence) - msRestantes(b.ventana_vence);
    const da = a.borradores_pendientes > 0, db = b.borradores_pendientes > 0;
    if (da !== db) return da ? -1 : 1;
    return (b.last_message_at ?? '').localeCompare(a.last_message_at ?? '');
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

/** «Asistente: …» / «Tú: …» delante del último mensaje si salió de la escuela. */
function resumenUltimo(c: Conversacion): string {
    const u = c.ultimo_mensaje;
    if (!u) return '(sin mensajes)';
    const cuerpo = u.text_body ?? `(${u.type})`;
    if (u.direction !== 'outbound') return cuerpo;
    return `${u.ai_generated ? 'Asistente' : 'Escuela'}: ${cuerpo}`;
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
    const [bandeja, setBandejaState] = useState<Bandeja>(leerBandeja);
    const [busqueda, setBusqueda] = useState('');
    const [verOcultas, setVerOcultas] = useState(false);
    const [verCerradas, setVerCerradas] = useState(() => leerBandeja() === 'prospectos');
    const [limite, setLimite] = useState(POR_PAGINA);
    const [limiteCerradas, setLimiteCerradas] = useState(POR_PAGINA);
    const [total, setTotal] = useState<number | null>(null);
    // Sin la migración de Fase A el BFF devuelve todo sin tipo: las bandejas por tipo mentirían.
    const [clasificacion, setClasificacion] = useState(true);
    /** Conversación que espera confirmación para marcarse como personal. */
    const [confirmarPersonal, setConfirmarPersonal] = useState<Conversacion | null>(null);
    const [accionando, setAccionando] = useState(false);
    // Sin la migración de «tomar» el BFF manda toma_disponible=false: el botón se deshabilita.
    const [tomaDisponible, setTomaDisponible] = useState(true);
    const finDelHilo = useRef<HTMLDivElement>(null);

    const setBandeja = (b: Bandeja) => {
        setBandejaState(b);
        guardarBandeja(b);
        setLimite(POR_PAGINA);
        setLimiteCerradas(POR_PAGINA);
        // En Prospectos el lead con ventana cerrada sigue importando: se ve de una.
        setVerCerradas(b === 'prospectos');
    };

    // Se pide todo de una vez (el BFF entrega las 200 más recientes) y las
    // bandejas se arman acá: así cambiar de bandeja no es otro viaje.
    const cargarLista = useCallback(async () => {
        setCargandoLista(true);
        try {
            const r = await bffClient.get<{
                conversaciones: Conversacion[]; conteos?: { todas?: number } | null;
                clasificacion_disponible?: boolean; toma_disponible?: boolean;
            }>(`/api/v1/whatsapp/${schoolId}/conversaciones?vista=todas`);
            setLista(r.conversaciones ?? []);
            // Backend viejo (sin el campo) = no disponible: no hay endpoint que llamar.
            setTomaDisponible(r.toma_disponible === true);
            setTotal(typeof r.conteos?.todas === 'number' ? r.conteos.todas : null);
            setClasificacion(r.clasificacion_disponible !== false);
        } catch (e: any) {
            toast({ title: 'No se pudieron cargar las conversaciones', description: e?.message, variant: 'destructive' });
        } finally {
            setCargandoLista(false);
        }
    }, [schoolId, toast]);

    useEffect(() => { void cargarLista(); }, [cargarLista]);

    // Sin clasificación todo llega sin tipo: se atiende todo.
    const atendible = useCallback(
        (c: Conversacion) => !clasificacion || esFamilia(c) || esProspecto(c), [clasificacion]);

    const enBandeja = useCallback((c: Conversacion, b: Bandeja): boolean => {
        switch (b) {
            case 'responder':  return atendible(c) && sinResponder(c) && c.ventana_abierta;
            case 'aprobar':    return c.borradores_pendientes > 0;
            case 'prospectos': return esProspecto(c);
            case 'familias':   return esFamilia(c);
            case 'otros':      return !esFamilia(c) && !esProspecto(c);
            default:           return true;
        }
    }, [atendible]);

    const visiblesBase = useMemo(() => lista.filter((c) => verOcultas || !esRuido(c)), [lista, verOcultas]);
    const ocultas = useMemo(() => lista.filter(esRuido).length, [lista]);

    const conteos = useMemo(() => {
        const r = {} as Record<Bandeja, number>;
        for (const b of BANDEJAS) r[b.id] = visiblesBase.filter((c) => enBandeja(c, b.id)).length;
        return r;
    }, [visiblesBase, enBandeja]);
    /** Prospectos que escribieron y nadie les contestó (con o sin ventana). */
    const prospectosSinResponder = useMemo(
        () => visiblesBase.filter((c) => esProspecto(c) && sinResponder(c)).length, [visiblesBase]);

    // La búsqueda mira TODO (incluidas las ocultas), sin importar la bandeja:
    // quien busca un nombre no sabe en qué bandeja quedó.
    const q = normalizar(busqueda.trim());
    const qDigitos = busqueda.replace(/\D/g, '');
    const filtradas = useMemo(() => {
        const base = q
            ? lista.filter((c) =>
                normalizar(c.contact_name).includes(q)
                || (qDigitos.length >= 3 && c.contact_wa_id.includes(qDigitos))
                || normalizar(c.ultimo_mensaje?.text_body).includes(q))
            : visiblesBase.filter((c) => enBandeja(c, bandeja));
        return [...base].sort(porUrgencia);
    }, [q, qDigitos, lista, visiblesBase, enBandeja, bandeja]);

    // Ventana cerrada = solo se puede escribir con plantilla: grupo aparte.
    const abiertas = useMemo(() => filtradas.filter((c) => c.ventana_abierta), [filtradas]);
    const cerradas = useMemo(() => filtradas.filter((c) => !c.ventana_abierta), [filtradas]);

    useEffect(() => { setLimite(POR_PAGINA); setLimiteCerradas(POR_PAGINA); }, [q]);

    // El detalle no trae `contact_kind` ni `pendiente`: los toma de la lista
    // cada vez que se recarga, para que el encabezado no quede viejo.
    useEffect(() => {
        setAbierta((a) => {
            if (!a) return a;
            const fresca = lista.find((c) => c.id === a.id);
            if (!fresca) return a;
            return { ...a, contact_kind: fresca.contact_kind, es_prospecto: fresca.es_prospecto,
                     pendiente: fresca.pendiente, requiere_respuesta: fresca.requiere_respuesta, status: fresca.status, toma: fresca.toma ?? null };
        });
    }, [lista]);

    // Al abrir o recibir mensajes, el hilo baja al último.
    useEffect(() => {
        if (!cargandoHilo) finDelHilo.current?.scrollIntoView({ block: 'end' });
    }, [mensajes, cargandoHilo]);

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
    // vez. Si no está en la bandeja actual, se abre igual por id: el detalle lo
    // trae el servidor.
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

    /** Cambia una conversación en la lista y, si es la abierta, también en el hilo. */
    const parchar = (id: string, cambio: Partial<Conversacion>) => {
        setLista((l) => l.map((c) => (c.id === id ? { ...c, ...cambio } : c)));
        setAbierta((a) => (a && a.id === id ? { ...a, ...cambio } : a));
    };

    /** Marca o desmarca una conversación como personal (desde la fila o desde el hilo). */
    const cambiarPersonal = async (c: Conversacion, personal: boolean) => {
        setAccionando(true);
        try {
            await bffClient.patch(`/api/v1/whatsapp/${schoolId}/conversaciones/${c.id}/tipo`, { personal });
            toast({
                title: personal ? 'Marcada como personal' : 'Se quitó la marca de personal',
                description: personal
                    ? 'Pasa a «Personal y otros» y el asistente no le va a responder.'
                    : 'Vuelve a clasificarse según el número.',
            });
            setConfirmarPersonal(null);
            // El tipo real al desmarcar lo recalcula el servidor; llega con la
            // recarga de la lista (ver el efecto que sincroniza `abierta`).
            parchar(c.id, { contact_kind: personal ? 'personal' : null, es_prospecto: personal ? false : c.es_prospecto });
            await cargarLista();
        } catch (e: any) {
            toast({ title: 'No se pudo cambiar', description: e?.message, variant: 'destructive' });
        } finally {
            setAccionando(false);
        }
    };

    /** Mejora 9: tomar (el asistente calla) o soltar (vuelve a atender). */
    const cambiarToma = async (c: Conversacion, tomar: boolean) => {
        setAccionando(true);
        try {
            const r = await bffClient.post<{ tomada_por?: string; tomada_hasta?: string }>(
                `/api/v1/whatsapp/${schoolId}/conversaciones/${c.id}/${tomar ? 'tomar' : 'soltar'}`, {});
            toast({
                title: tomar ? 'Tomaste la conversación' : 'Soltaste la conversación',
                description: tomar
                    ? 'El asistente no le va a escribir nada automático hasta que la sueltes o pasen 12 horas.'
                    : 'El asistente vuelve a atenderla.',
            });
            parchar(c.id, {
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
            parchar(abierta.id, { status: 'closed', pendiente: false, requiere_respuesta: false });
            await cargarLista();
        } catch (e: any) {
            toast({ title: 'No se pudo cerrar', description: e?.message, variant: 'destructive' });
        } finally {
            setAccionando(false);
        }
    };

    const vacio: Record<Bandeja, string> = {
        responder: 'Nada por responder: estás al día.',
        aprobar: 'No hay respuestas del asistente esperando tu aprobación.',
        prospectos: 'No hay números nuevos pidiendo información.',
        familias: 'No hay conversaciones con familias.',
        otros: 'No hay conversaciones personales ni de otros números.',
        todas: 'Todavía no hay conversaciones.',
    };

    const bandejasVisibles = BANDEJAS.filter((b) => clasificacion || !b.soloClasificado);

    const fila = (c: Conversacion) => {
        const atenuada = !atendible(c) || !c.ventana_abierta;
        return (
            <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => void abrir(c)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void abrir(c); } }}
                className={`group relative w-full text-left rounded-lg border p-3 pr-10 transition-colors cursor-pointer
                            hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                            ${abierta?.id === c.id ? 'bg-muted border-primary/40' : ''}
                            ${atenuada && abierta?.id !== c.id ? 'opacity-75' : ''}`}
            >
                <div className="flex items-start justify-between gap-2 min-w-0">
                    <span className={`text-sm truncate ${sinResponder(c) ? 'font-semibold' : 'font-medium'}`}>
                        {c.contact_name || c.contact_wa_id}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{cuando(c.last_message_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{resumenUltimo(c)}</p>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {sinResponder(c) && (
                        <Badge variant="destructive" className="text-[10px]">Sin responder</Badge>
                    )}
                    {c.borradores_pendientes > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                            <Sparkles className="h-2.5 w-2.5 mr-1" />
                            {c.borradores_pendientes} por aprobar
                        </Badge>
                    )}
                    <EtiquetaTipo c={c} />
                    {c.toma && (
                        <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 dark:text-blue-400"
                               title={textoDeToma(c.toma)}>
                            <Hand className="h-2.5 w-2.5 mr-1" />
                            Atendida por {c.toma.tomada_por_nombre || 'la escuela'}
                        </Badge>
                    )}
                    {/* Con contact_kind ya se sabe quién es; "Sin identificar" sobra. */}
                    {!c.identified && !c.contact_kind && !c.es_prospecto && (
                        <Badge variant="outline" className="text-[10px]">Sin identificar</Badge>
                    )}
                    {/* Un prospecto sin respuesta es un lead que se enfría: su ventana se ve siempre. */}
                    <ChipVentana c={c} destacar={esProspecto(c) && sinResponder(c)} />
                    {c.prospecto?.interes && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[10rem]" title={c.prospecto.interes}>
                            {c.prospecto.interes}
                        </span>
                    )}
                </div>

                {/* Acciones rápidas: siempre visibles en el celular, al pasar el mouse en escritorio. */}
                <div className="absolute right-1.5 top-1.5" onClick={(e) => e.stopPropagation()}
                     onKeyDown={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Acciones de la conversación"
                                    className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100
                                               data-[state=open]:opacity-100">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onSelect={() => void abrir(c)}>
                                <MessageCircle className="h-4 w-4 mr-2" /> Abrir
                            </DropdownMenuItem>
                            {tomaDisponible && (
                                c.toma ? (
                                    <DropdownMenuItem disabled={accionando} onSelect={() => void cambiarToma(c, false)}>
                                        <Unlock className="h-4 w-4 mr-2" /> Soltar la conversación
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem disabled={accionando} onSelect={() => void cambiarToma(c, true)}>
                                        <Hand className="h-4 w-4 mr-2" /> Tomar la conversación
                                    </DropdownMenuItem>
                                )
                            )}
                            {clasificacion && (<>
                                <DropdownMenuSeparator />
                                {c.contact_kind === 'personal' ? (
                                    <DropdownMenuItem disabled={accionando} onSelect={() => void cambiarPersonal(c, false)}>
                                        <Eye className="h-4 w-4 mr-2" /> Quitar marca de personal
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem disabled={accionando} onSelect={() => setConfirmarPersonal(c)}>
                                        <EyeOff className="h-4 w-4 mr-2" /> Marcar como personal
                                    </DropdownMenuItem>
                                )}
                            </>)}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        );
    };

    const cargarMas = (restan: number, onClick: () => void) => restan > 0 && (
        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onClick}>
            Cargar más ({restan} restantes)
        </Button>
    );

    return (
        <div className="grid md:grid-cols-[minmax(300px,380px)_1fr] gap-4 md:h-[calc(100dvh-12rem)] md:min-h-[540px]">
            {/* ── Lista ── */}
            <div className={`min-w-0 flex-col md:flex md:min-h-0 ${abierta ? 'hidden' : 'flex'}`}>
                <div className="space-y-2 pb-2">
                    <div className="flex gap-2">
                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder="Buscar nombre, teléfono o mensaje"
                                className="pl-8 pr-8 h-9 text-sm"
                                aria-label="Buscar conversaciones"
                            />
                            {busqueda && (
                                <button type="button" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="Actualizar"
                                disabled={cargandoLista} onClick={() => void cargarLista()}>
                            <RefreshCw className={`h-4 w-4 ${cargandoLista ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>

                    {!q && (
                        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Bandejas">
                            {bandejasVisibles.map((b) => {
                                const activa = bandeja === b.id;
                                const n = conteos[b.id];
                                return (
                                    <button
                                        key={b.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={activa}
                                        onClick={() => { setBandeja(b.id); }}
                                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors
                                                    ${activa
                                                        ? 'bg-primary text-primary-foreground border-primary'
                                                        : 'bg-background hover:bg-muted text-foreground'}
                                                    ${b.id === 'otros' && !activa ? 'text-muted-foreground' : ''}`}
                                    >
                                        {b.texto}
                                        {!cargandoLista && b.id === 'prospectos' && prospectosSinResponder > 0 && (
                                            <span className={`tabular-nums rounded-full px-1.5 text-[10px] leading-4 font-semibold
                                                ${activa ? 'bg-primary-foreground text-primary' : 'bg-destructive text-destructive-foreground'}`}
                                                  title={`${prospectosSinResponder} sin responder`}
                                                  aria-label={`${prospectosSinResponder} sin responder`}>
                                                {prospectosSinResponder} sin resp.
                                            </span>
                                        )}
                                        {!cargandoLista && (
                                            <span className={`tabular-nums rounded-full px-1.5 text-[10px] leading-4
                                                ${activa ? 'bg-primary-foreground/20'
                                                    : b.urgente && n > 0 ? 'bg-destructive text-destructive-foreground'
                                                    : 'bg-muted text-muted-foreground'}`}>
                                                {n}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {q ? (
                        <p className="text-xs text-muted-foreground px-1">
                            {filtradas.length} resultado{filtradas.length === 1 ? '' : 's'} en todas las conversaciones.
                        </p>
                    ) : bandeja === 'responder' ? (
                        <p className="text-xs text-muted-foreground px-1">
                            Familias y prospectos que escribieron y nadie les ha respondido. Primero las que
                            se quedan sin ventana de 24 h.
                        </p>
                    ) : bandeja === 'prospectos' ? (
                        <p className="text-xs text-muted-foreground px-1">
                            Números nuevos que piden información: posibles inscripciones. Respóndeles antes de
                            que se cierre la ventana de 24 h; después solo se les puede escribir con plantilla.
                            Si alguno es un contacto tuyo, márcalo como personal desde los tres puntos.
                        </p>
                    ) : bandeja === 'otros' ? (
                        <p className="text-xs text-muted-foreground px-1">
                            Personas del equipo, lo que marcaste como personal y números sin clasificar. El
                            asistente no les responde.
                        </p>
                    ) : null}
                </div>

                <div className="space-y-2 md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-1">
                    {cargandoLista && !lista.length && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" /> Cargando conversaciones…
                        </div>
                    )}
                    {!(cargandoLista && !lista.length) && !filtradas.length && (
                        <div className="text-center py-12 text-sm text-muted-foreground">
                            {bandeja === 'responder' && !q
                                ? <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-green-600 opacity-70" />
                                : <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-40" />}
                            {q ? 'Nada coincide con la búsqueda.' : vacio[bandeja]}
                            {!q && bandeja !== 'todas' && (
                                <div>
                                    <Button variant="link" size="sm" onClick={() => setBandeja('todas')}>
                                        Ver todas las conversaciones
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {abiertas.slice(0, limite).map(fila)}
                    {cargarMas(abiertas.length - limite, () => setLimite((n) => n + POR_PAGINA))}

                    {cerradas.length > 0 && (
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setVerCerradas((v) => !v)}
                                aria-expanded={verCerradas || (!!q && cerradas.length > 0)}
                                className="flex w-full items-center gap-1.5 px-1 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                                {(verCerradas || q) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                Ventana cerrada · solo plantilla ({cerradas.length})
                            </button>
                            {(verCerradas || !!q) && (
                                <div className="space-y-2 mt-1">
                                    {cerradas.slice(0, limiteCerradas).map(fila)}
                                    {cargarMas(cerradas.length - limiteCerradas, () => setLimiteCerradas((n) => n + POR_PAGINA))}
                                </div>
                            )}
                        </div>
                    )}

                    {!q && !cargandoLista && (ocultas > 0 || (total !== null && total > lista.length)) && (
                        <div className="pt-2 pb-1 px-1 text-[11px] text-muted-foreground space-y-1">
                            {ocultas > 0 && (
                                <button type="button" className="underline-offset-2 hover:underline"
                                        onClick={() => setVerOcultas((v) => !v)}>
                                    {verOcultas
                                        ? 'Ocultar las conversaciones sin mensajes de la persona'
                                        : `Mostrar ${ocultas} conversación${ocultas === 1 ? '' : 'es'} sin mensajes de la persona`}
                                </button>
                            )}
                            {total !== null && total > lista.length && (
                                <p>Se muestran las {lista.length} más recientes de {total}. Usa la búsqueda para el resto.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Hilo ── */}
            {abierta ? (
                <div className="border rounded-lg flex flex-col min-h-[420px] md:min-h-0 min-w-0">
                    <div className="border-b p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="md:hidden -ml-2" onClick={() => setAbierta(null)}
                                    aria-label="Volver a la lista">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">
                                    {abierta.contact_name || abierta.contact_wa_id}
                                </p>
                                <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                    <span>{abierta.contact_wa_id}</span>
                                    {abierta.ventana_vence !== undefined && <ChipVentana c={abierta} />}
                                </p>
                            </div>
                            <EtiquetaTipo c={abierta} />
                        </div>
                        {/* Acciones: botones anchos en el celular, que se tocan con el dedo. */}
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                            {abierta.toma ? (
                                <Button variant="outline" size="sm" disabled={accionando || !tomaDisponible}
                                        onClick={() => void cambiarToma(abierta, false)}>
                                    <Unlock className="h-3.5 w-3.5 mr-1" /> Soltar
                                </Button>
                            ) : (
                                <Button variant="outline" size="sm" disabled={accionando || !tomaDisponible}
                                        title={tomaDisponible ? 'El asistente deja de responder en esta conversación'
                                            : 'Todavía no disponible'}
                                        onClick={() => void cambiarToma(abierta, true)}>
                                    <Hand className="h-3.5 w-3.5 mr-1" /> Tomar
                                </Button>
                            )}
                            <Button
                                variant="outline" size="sm" disabled={accionando}
                                onClick={() => esPersonal ? void cambiarPersonal(abierta, false) : setConfirmarPersonal(abierta)}
                            >
                                {esPersonal
                                    ? <><Eye className="h-3.5 w-3.5 mr-1" /> Quitar personal</>
                                    : <><EyeOff className="h-3.5 w-3.5 mr-1" /> Es personal</>}
                            </Button>
                            <Button
                                variant="outline" size="sm" className="col-span-2 sm:col-span-1"
                                disabled={accionando || abierta.status === 'closed'}
                                onClick={() => void cerrar()}
                            >
                                {accionando
                                    ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                    : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                                {abierta.status === 'closed' ? 'Cerrada' : 'Dar por atendida'}
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

                    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 max-h-[55vh] md:max-h-none">
                        {cargandoHilo && (
                            <p className="text-sm text-muted-foreground text-center py-6">
                                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Cargando…
                            </p>
                        )}
                        {!cargandoHilo && !mensajes.length && (
                            <p className="text-sm text-muted-foreground text-center py-6">Sin mensajes todavía.</p>
                        )}
                        {mensajes.map((m) => {
                            const qn = quien(m, abierta.contact_kind);
                            const mio = m.direction === 'outbound';
                            return (
                                <div key={m.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-lg px-3 py-2 ${mio ? 'bg-primary/10' : 'bg-muted'}`}>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                                            {qn.icono} {qn.texto} · {hora(m.created_at)}
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
                        <div ref={finDelHilo} />
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
                            <div className="flex gap-2 flex-wrap">
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
                                <Button onClick={() => void responder()} disabled={enviando || !texto.trim()}
                                        aria-label="Enviar">
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
                <div className="hidden md:flex flex-col items-center justify-center gap-2 border rounded-lg text-sm text-muted-foreground">
                    <MessageSquare className="h-8 w-8 opacity-40" />
                    {conteos.responder > 0
                        ? `Tienes ${conteos.responder} conversación${conteos.responder === 1 ? '' : 'es'} por responder. Elige una de la lista.`
                        : 'Elige una conversación'}
                </div>
            )}

            <AlertDialog open={!!confirmarPersonal} onOpenChange={(v) => { if (!accionando && !v) setConfirmarPersonal(null); }}>
                <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Marcar como personal?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmarPersonal?.contact_name || confirmarPersonal?.contact_wa_id} pasa a «Personal y
                            otros» y el asistente <strong>no le va a responder nunca</strong>. Los mensajes los
                            sigues viendo y respondiendo desde tu celular, y puedes quitar la marca cuando quieras.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={accionando}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={accionando}
                            onClick={(e) => { e.preventDefault(); if (confirmarPersonal) void cambiarPersonal(confirmarPersonal, true); }}
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
