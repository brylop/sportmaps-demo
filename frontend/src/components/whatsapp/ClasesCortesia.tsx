/**
 * ClasesCortesia — dónde quedó agendada cada clase de cortesía (prueba gratis).
 *
 * Reúne lo que agenda el asistente de WhatsApp y lo que llega por el
 * formulario /inscripcion/<slug>: próximas, pasadas (para marcar «asistió /
 * no vino») y prospectos que dejaron datos pero no eligieron horario.
 * Lo que se acuerda a mano en el chat desde el celular NO aparece acá.
 *
 * BFF: GET /api/v1/whatsapp/:schoolId/cortesias
 *      PATCH /api/v1/whatsapp/:schoolId/cortesias/:leadId/asistencia
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarCheck, Check, MessageSquare, Phone, RefreshCw, X } from 'lucide-react';

type Asistencia = 'asistio' | 'no_vino' | null;

interface Reserva {
    leadId: string;
    nombre: string;
    acudiente: string | null;
    telefono: string | null;
    waMe: string | null;
    edad: number | null;
    paraQuien: string;
    grupo: string;
    fecha: string;
    horaInicio: string;
    horaFin: string | null;
    sede: string | null;
    estado: string;
    origen: 'whatsapp' | 'web';
    conversationId: string | null;
    asistencia: Asistencia;
    creadaEn: string;
}

interface LeadSinAgendar {
    leadId: string;
    nombre: string;
    telefono: string | null;
    waMe: string | null;
    paraQuien: string;
    estado: string;
    origen: 'whatsapp' | 'web';
    conversationId: string | null;
    creadoEn: string;
    cancelada: boolean;
}

interface Listado { reservas: Reserva[]; sinAgendar: LeadSinAgendar[] }

/** YYYY-MM-DD en Colombia (UTC-5 fijo). */
function hoyColombia(): string {
    return new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
}

function fechaLegible(fecha: string): string {
    const [y, m, d] = fecha.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es-CO', {
        weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
    });
}

function hora12(h: string): string {
    const [hh, mm] = h.split(':').map(Number);
    return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm || 0).padStart(2, '0')} ${hh >= 12 ? 'p. m.' : 'a. m.'}`;
}

function enlaceChat(conversationId: string): string {
    return `/whatsapp?tab=conversaciones&conversacion=${encodeURIComponent(conversationId)}`;
}

function Contacto({ waMe, telefono, conversationId }: { waMe: string | null; telefono: string | null; conversationId: string | null }) {
    return (
        <div className="flex flex-wrap items-center gap-2 text-xs">
            {waMe && (
                <a href={waMe} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Phone className="h-3 w-3" /> {telefono}
                </a>
            )}
            {conversationId && (
                <a href={enlaceChat(conversationId)} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <MessageSquare className="h-3 w-3" /> Ver chat
                </a>
            )}
        </div>
    );
}

export function ClasesCortesia({ schoolId }: { schoolId: string }) {
    const { toast } = useToast();
    const [datos, setDatos] = useState<Listado | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dia, setDia] = useState('');
    const [guardando, setGuardando] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            setDatos(await bffClient.get<Listado>(`/api/v1/whatsapp/${schoolId}/cortesias`));
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setCargando(false);
        }
    }, [schoolId]);

    useEffect(() => { void cargar(); }, [cargar]);

    const hoy = hoyColombia();
    const { proximas, pasadas } = useMemo(() => {
        const todas = (datos?.reservas ?? []).filter((r) => !dia || r.fecha === dia);
        return {
            proximas: todas.filter((r) => r.fecha >= hoy),
            pasadas: todas.filter((r) => r.fecha < hoy).reverse(),
        };
    }, [datos, dia, hoy]);

    async function marcar(r: Reserva, asistencia: Asistencia) {
        setGuardando(r.leadId);
        try {
            await bffClient.patch(`/api/v1/whatsapp/${schoolId}/cortesias/${r.leadId}/asistencia`, { asistencia });
            setDatos((d) => d && ({
                ...d,
                reservas: d.reservas.map((x) => (x.leadId === r.leadId ? { ...x, asistencia } : x)),
            }));
        } catch (e: unknown) {
            toast({ title: 'No se pudo guardar', description: e instanceof Error ? e.message : '', variant: 'destructive' });
        } finally {
            setGuardando(null);
        }
    }

    function fila(r: Reserva, pasada: boolean) {
        return (
            <div key={r.leadId} className="flex flex-col gap-2 border-b py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{r.nombre}</span>
                        <Badge variant="outline" className="text-xs">{r.origen === 'whatsapp' ? 'WhatsApp' : 'Formulario web'}</Badge>
                        {r.fecha === hoy && <Badge className="text-xs">Hoy</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">{r.paraQuien}</div>
                    <div className="text-sm">
                        <span className="font-medium">{r.grupo}</span>
                        {' · '}<span className="capitalize">{fechaLegible(r.fecha)}</span>, {hora12(r.horaInicio)}
                        {r.horaFin && ` a ${hora12(r.horaFin)}`}
                        {r.sede && ` · ${r.sede}`}
                    </div>
                    <Contacto waMe={r.waMe} telefono={r.telefono} conversationId={r.conversationId} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {(pasada || r.fecha === hoy) ? (
                        <>
                            <Button size="sm" variant={r.asistencia === 'asistio' ? 'default' : 'outline'}
                                disabled={guardando === r.leadId}
                                onClick={() => void marcar(r, r.asistencia === 'asistio' ? null : 'asistio')}>
                                <Check className="mr-1 h-3.5 w-3.5" /> Asistió
                            </Button>
                            <Button size="sm" variant={r.asistencia === 'no_vino' ? 'destructive' : 'outline'}
                                disabled={guardando === r.leadId}
                                onClick={() => void marcar(r, r.asistencia === 'no_vino' ? null : 'no_vino')}>
                                <X className="mr-1 h-3.5 w-3.5" /> No vino
                            </Button>
                        </>
                    ) : (
                        <Badge variant="secondary">Agendada</Badge>
                    )}
                </div>
            </div>
        );
    }

    if (cargando && !datos) {
        return <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex items-end gap-2">
                    <div>
                        <label className="text-xs text-muted-foreground" htmlFor="cortesia-dia">Día</label>
                        <Input id="cortesia-dia" type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="w-44" />
                    </div>
                    {dia && <Button variant="ghost" size="sm" onClick={() => setDia('')}>Todos los días</Button>}
                </div>
                <Button variant="outline" size="sm" onClick={() => void cargar()} disabled={cargando}>
                    <RefreshCw className={`mr-1 h-4 w-4 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
                </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <CalendarCheck className="h-4 w-4" /> Próximas clases de cortesía
                        <Badge variant="secondary">{proximas.length}</Badge>
                    </CardTitle>
                    <CardDescription>
                        Las que agendó el asistente de WhatsApp y las del formulario de inscripción. Te avisamos
                        por notificación y correo cada vez que entra o se cancela una.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {proximas.length === 0
                        ? <p className="py-6 text-center text-sm text-muted-foreground">No hay clases de cortesía agendadas{dia ? ' ese día' : ''}.</p>
                        : proximas.map((r) => fila(r, false))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Pendientes de agendar <Badge variant="secondary">{datos?.sinAgendar.length ?? 0}</Badge></CardTitle>
                    <CardDescription>
                        Dejaron sus datos (o cancelaron) en los últimos 14 días y no tienen horario. Escríbeles para agendar.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {(datos?.sinAgendar.length ?? 0) === 0
                        ? <p className="py-6 text-center text-sm text-muted-foreground">Nadie pendiente.</p>
                        : datos!.sinAgendar.map((l) => (
                            <div key={l.leadId} className="space-y-1 border-b py-3 last:border-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">{l.nombre}</span>
                                    <Badge variant="outline" className="text-xs">{l.origen === 'whatsapp' ? 'WhatsApp' : 'Formulario web'}</Badge>
                                    {l.cancelada && <Badge variant="destructive" className="text-xs">Canceló</Badge>}
                                    <span className="text-xs text-muted-foreground">{new Date(l.creadoEn).toLocaleString('es-CO')}</span>
                                </div>
                                <div className="text-sm text-muted-foreground">{l.paraQuien}</div>
                                <Contacto waMe={l.waMe} telefono={l.telefono} conversationId={l.conversationId} />
                            </div>
                        ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Pasadas <Badge variant="secondary">{pasadas.length}</Badge></CardTitle>
                    <CardDescription>Marca si vinieron: así se sabe cuántas clases de cortesía terminan en inscripción.</CardDescription>
                </CardHeader>
                <CardContent>
                    {pasadas.length === 0
                        ? <p className="py-6 text-center text-sm text-muted-foreground">Sin clases pasadas{dia ? ' ese día' : ''}.</p>
                        : pasadas.map((r) => fila(r, true))}
                </CardContent>
            </Card>
        </div>
    );
}
