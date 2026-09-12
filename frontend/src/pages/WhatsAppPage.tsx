/**
 * WhatsAppPage — el canal de WhatsApp de la escuela.
 *
 * Cuatro cosas que hasta ahora solo se veían consultando la base a mano:
 *
 *  · Estado y consumo del mes, con el aviso al 80% de lo incluido.
 *  · Plantillas de Meta con su estado y categoría. Importa porque si Meta
 *    desactiva o recategoriza una plantilla de cobranza, los envíos dejan de
 *    salir y el primer síntoma sería que nadie paga.
 *  · Bandeja: los comprobantes que llegaron y quedaron sin resolver.
 *  · Configuración: modo, IA y horario de atención.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    MessageSquare, RefreshCw, AlertTriangle, Clock, FileText, Inbox, Settings, Plus, Loader2,
} from 'lucide-react';

// ─── Tipos que devuelve el BFF ──────────────────────────────────────────────

interface Consumo {
    facturables: number; gratis: number; sin_estado: number;
    por_categoria: Record<string, number>;
    incluidos: number; restantes: number; excedente: number; avisar: boolean;
}
interface Ajustes {
    mode: 'auto' | 'assisted';
    ai_enabled: boolean;
    business_hours: { tz: string; dias: Record<string, [string, string]> } | null;
    welcome_message: string | null;
}
interface Estado {
    conectado: boolean;
    integracion: { display_phone_number: string | null; waba_id: string | null; status: string } | null;
    ajustes: Ajustes | null;
    consumo: Consumo | null;
}
interface Plantilla {
    name: string; status: string; category: string; language: string;
}
interface FilaBandeja {
    id: string; status: string; wa_phone_number: string; message_type: string;
    error_message: string | null; created_at: string;
}
interface EventoMeta {
    id: string; field: string; template_name: string | null;
    estado_previo: string | null; nuevo_estado: string | null; motivo: string | null; created_at: string;
}

const DIAS = [
    ['1', 'Lunes'], ['2', 'Martes'], ['3', 'Miércoles'], ['4', 'Jueves'],
    ['5', 'Viernes'], ['6', 'Sábado'], ['0', 'Domingo'],
] as const;

/** Verde solo lo aprobado: el estado de una plantilla decide si la cobranza sale. */
function tonoDeEstado(estado: string): string {
    if (estado === 'APPROVED') return 'bg-green-100 text-green-700 border-green-200';
    if (estado === 'PENDING') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-red-100 text-red-700 border-red-200';
}

export default function WhatsAppPage() {
    const { schoolId } = useSchoolContext();
    const { toast } = useToast();

    const [estado, setEstado] = useState<Estado | null>(null);
    const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
    const [bandeja, setBandeja] = useState<FilaBandeja[]>([]);
    const [eventos, setEventos] = useState<EventoMeta[]>([]);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);

    const cargar = useCallback(async () => {
        if (!schoolId) return;
        setCargando(true);
        try {
            const e = await bffClient.get<Estado>(`/api/v1/whatsapp/${schoolId}`);
            setEstado(e);
            if (e.conectado) {
                // En paralelo: ninguna depende de la otra y la pantalla se siente
                // instantánea aunque Meta tarde en responder el listado.
                const [p, b, ev] = await Promise.allSettled([
                    bffClient.get<{ plantillas: Plantilla[] }>(`/api/v1/whatsapp/${schoolId}/plantillas`),
                    bffClient.get<{ filas: FilaBandeja[] }>(`/api/v1/whatsapp/${schoolId}/bandeja`),
                    bffClient.get<{ eventos: EventoMeta[] }>(`/api/v1/whatsapp/${schoolId}/eventos`),
                ]);
                if (p.status === 'fulfilled') setPlantillas(p.value.plantillas ?? []);
                if (b.status === 'fulfilled') setBandeja(b.value.filas ?? []);
                if (ev.status === 'fulfilled') setEventos(ev.value.eventos ?? []);
            }
        } catch (err: any) {
            toast({ title: 'No se pudo cargar', description: err?.message ?? 'Error', variant: 'destructive' });
        } finally {
            setCargando(false);
        }
    }, [schoolId, toast]);

    useEffect(() => { void cargar(); }, [cargar]);

    const guardarAjustes = async (cambios: Partial<Ajustes>) => {
        if (!schoolId) return;
        setGuardando(true);
        try {
            const r = await bffClient.patch<Ajustes>(`/api/v1/whatsapp/${schoolId}/settings`, cambios);
            setEstado((e) => (e ? { ...e, ajustes: r } : e));
            toast({ title: 'Guardado' });
        } catch (err: any) {
            toast({ title: 'No se pudo guardar', description: err?.message ?? 'Error', variant: 'destructive' });
        } finally {
            setGuardando(false);
        }
    };

    const consumo = estado?.consumo;
    const porcentaje = useMemo(() => {
        if (!consumo?.incluidos) return 0;
        return Math.min(Math.round((consumo.facturables / consumo.incluidos) * 100), 100);
    }, [consumo]);

    if (cargando && !estado) {
        return <div className="p-8 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando el canal…
        </div>;
    }

    if (estado && !estado.conectado) {
        return (
            <div className="p-6 max-w-2xl">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" /> WhatsApp no está conectado
                        </CardTitle>
                        <CardDescription>
                            Esta escuela todavía no tiene un número de WhatsApp conectado a SportMaps.
                            Cuando se conecte, acá vas a poder ver las conversaciones, configurar el
                            horario de atención y revisar el consumo del mes.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <MessageSquare className="h-6 w-6" /> WhatsApp
                    </h1>
                    <p className="text-muted-foreground">
                        {estado?.integracion?.display_phone_number ?? 'Sin número'} · canal de atención y cobranza
                    </p>
                </div>
                <Button variant="outline" onClick={() => void cargar()} disabled={cargando}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
                </Button>
            </div>

            {/* El modo asistido se avisa arriba: con el bot en asistido responde
                pero NADA sale hasta que alguien aprueba cada mensaje. Es la
                confusión más cara de este módulo. */}
            {estado?.ajustes?.mode === 'assisted' && (
                <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                    <CardContent className="pt-6 flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                        <div className="text-sm">
                            <p className="font-medium">El bot está en modo asistido</p>
                            <p className="text-muted-foreground">
                                Prepara las respuestas pero <strong>no las envía</strong>: alguien de la escuela
                                tiene que aprobar cada una. Si esperas que responda solo, cámbialo a automático
                                en Configuración.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {consumo?.avisar && (
                <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
                    <CardContent className="pt-6 flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />
                        <div className="text-sm">
                            <p className="font-medium">Vas por {consumo.facturables} de {consumo.incluidos} mensajes incluidos</p>
                            <p className="text-muted-foreground">
                                No se corta nada: si te pasas, el excedente se cobra como paquete adicional.
                                Te avisamos para que no te tome por sorpresa.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Tabs defaultValue="resumen">
                <TabsList>
                    <TabsTrigger value="resumen">Resumen</TabsTrigger>
                    <TabsTrigger value="plantillas">
                        <FileText className="h-4 w-4 mr-1" /> Plantillas
                    </TabsTrigger>
                    <TabsTrigger value="bandeja">
                        <Inbox className="h-4 w-4 mr-1" /> Bandeja
                        {bandeja.length > 0 && <Badge variant="secondary" className="ml-2">{bandeja.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="config">
                        <Settings className="h-4 w-4 mr-1" /> Configuración
                    </TabsTrigger>
                </TabsList>

                {/* ── Resumen ── */}
                <TabsContent value="resumen" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2"><CardDescription>Mensajes facturables</CardDescription></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{consumo?.facturables ?? 0}</div>
                                <p className="text-xs text-muted-foreground">de {consumo?.incluidos ?? 0} incluidos · {porcentaje}%</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2"><CardDescription>Sin costo</CardDescription></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{consumo?.gratis ?? 0}</div>
                                <p className="text-xs text-muted-foreground">respuestas dentro de las 24 h</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2"><CardDescription>Excedente</CardDescription></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{consumo?.excedente ?? 0}</div>
                                <p className="text-xs text-muted-foreground">se cobra como paquete</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2"><CardDescription>Sin resolver</CardDescription></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{bandeja.length}</div>
                                <p className="text-xs text-muted-foreground">comprobantes en la bandeja</p>
                            </CardContent>
                        </Card>
                    </div>

                    {eventos.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Avisos de Meta</CardTitle>
                                <CardDescription>Cambios en tus plantillas, en la calidad del número o en los límites de envío.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {eventos.slice(0, 8).map((e) => (
                                    <div key={e.id} className="text-sm flex items-start gap-2 border-b pb-2 last:border-0">
                                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-medium">{e.template_name ?? e.field}</span>
                                            {e.estado_previo && e.nuevo_estado && (
                                                <span className="text-muted-foreground"> — de {e.estado_previo} a {e.nuevo_estado}</span>
                                            )}
                                            {!e.estado_previo && e.nuevo_estado && (
                                                <span className="text-muted-foreground"> — {e.nuevo_estado}</span>
                                            )}
                                            {e.motivo && <span className="text-muted-foreground"> ({e.motivo})</span>}
                                            <div className="text-xs text-muted-foreground">
                                                {new Date(e.created_at).toLocaleString('es-CO')}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ── Plantillas ── */}
                <TabsContent value="plantillas">
                    <PanelPlantillas
                        schoolId={schoolId!}
                        plantillas={plantillas}
                        onCreada={() => void cargar()}
                    />
                </TabsContent>

                {/* ── Bandeja ── */}
                <TabsContent value="bandeja">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Comprobantes sin resolver</CardTitle>
                            <CardDescription>
                                Los que llegaron por el chat y necesitan que alguien los mire: archivos que no
                                eran comprobantes, acudientes sin cobros pendientes, o fallos al procesarlos.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {bandeja.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-8 text-center">
                                    No hay nada pendiente. Todo lo que llegó se resolvió solo.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {bandeja.map((f) => (
                                        <div key={f.id} className="flex items-center justify-between border-b pb-2 last:border-0 text-sm">
                                            <div>
                                                <span className="font-mono text-xs">{f.wa_phone_number}</span>
                                                <span className="text-muted-foreground"> · {f.message_type}</span>
                                                {f.error_message && <div className="text-muted-foreground">{f.error_message}</div>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">{f.status}</Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(f.created_at).toLocaleString('es-CO')}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Configuración ── */}
                <TabsContent value="config">
                    <PanelConfig
                        ajustes={estado?.ajustes ?? null}
                        guardando={guardando}
                        onGuardar={guardarAjustes}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ─── Plantillas ─────────────────────────────────────────────────────────────

function PanelPlantillas({ schoolId, plantillas, onCreada }: {
    schoolId: string; plantillas: Plantilla[]; onCreada: () => void;
}) {
    const { toast } = useToast();
    const [abriendo, setAbriendo] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [nombre, setNombre] = useState('');
    const [texto, setTexto] = useState('');
    const [ejemplos, setEjemplos] = useState('');

    // Las variables se detectan en vivo: así el usuario sabe cuántos ejemplos
    // debe dar antes de que Meta lo rechace.
    const variables = useMemo(
        () => [...new Set(Array.from(texto.matchAll(/\{\{(\d+)\}\}/g)).map((m) => m[1]))].length,
        [texto],
    );
    const listaEjemplos = ejemplos.split('|').map((s) => s.trim()).filter(Boolean);

    const crear = async () => {
        setEnviando(true);
        try {
            const r = await bffClient.post<{ name: string; status: string; category: string }>(
                `/api/v1/whatsapp/${schoolId}/plantillas`,
                { name: nombre, body: texto, ejemplos: listaEjemplos, category: 'UTILITY', language: 'es_CO' },
            );
            toast({
                title: 'Plantilla enviada a Meta',
                description: `${r.name} — ${r.status} · ${r.category}`,
            });
            setAbriendo(false); setNombre(''); setTexto(''); setEjemplos('');
            onCreada();
        } catch (err: any) {
            toast({ title: 'Meta no la aceptó', description: err?.message ?? 'Error', variant: 'destructive' });
        } finally {
            setEnviando(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                    <CardTitle className="text-base">Plantillas aprobadas por Meta</CardTitle>
                    <CardDescription>
                        Son los mensajes que la escuela puede enviar <strong>fuera</strong> de la ventana de 24 horas
                        — la cobranza, sobre todo. Si Meta desactiva o recategoriza una, deja de enviarse.
                    </CardDescription>
                </div>
                <Button onClick={() => setAbriendo((v) => !v)}>
                    <Plus className="h-4 w-4 mr-1" /> Nueva plantilla
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                {abriendo && (
                    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                        <div>
                            <Label>Nombre</Label>
                            <Input value={nombre} onChange={(e) => setNombre(e.target.value)}
                                placeholder="clase_cancelada" />
                            <p className="text-xs text-muted-foreground mt-1">
                                Solo minúsculas, números y guion bajo.
                            </p>
                        </div>
                        <div>
                            <Label>Texto del mensaje</Label>
                            <Textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)}
                                placeholder="Hola {{1}}, la clase de {{2}} del {{3}} fue cancelada." />
                            <p className="text-xs text-muted-foreground mt-1">
                                Usa {'{{1}}'}, {'{{2}}'}… para los datos variables. No puede empezar ni terminar
                                con una variable — Meta lo rechaza.
                            </p>
                        </div>
                        {variables > 0 && (
                            <div>
                                <Label>Ejemplos para las {variables} variable(s), separados por |</Label>
                                <Input value={ejemplos} onChange={(e) => setEjemplos(e.target.value)}
                                    placeholder="Carolina | Samuel | 13 de septiembre" />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Van {listaEjemplos.length} de {variables}. Meta los exige para revisar la plantilla.
                                </p>
                            </div>
                        )}
                        <Button onClick={() => void crear()}
                            disabled={enviando || !nombre || texto.length < 10 || listaEjemplos.length !== variables}>
                            {enviando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Enviar a Meta para aprobación
                        </Button>
                    </div>
                )}

                {plantillas.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">Todavía no hay plantillas.</p>
                ) : (
                    <div className="space-y-1">
                        {plantillas.map((p) => (
                            <div key={`${p.name}-${p.language}`}
                                className="flex items-center justify-between border-b py-2 last:border-0 text-sm">
                                <span className="font-mono">{p.name}</span>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">{p.category}</Badge>
                                    <Badge className={tonoDeEstado(p.status)}>{p.status}</Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Configuración ──────────────────────────────────────────────────────────

function PanelConfig({ ajustes, guardando, onGuardar }: {
    ajustes: Ajustes | null; guardando: boolean; onGuardar: (c: Partial<Ajustes>) => void;
}) {
    const [dias, setDias] = useState<Record<string, [string, string]>>(ajustes?.business_hours?.dias ?? {});

    useEffect(() => { setDias(ajustes?.business_hours?.dias ?? {}); }, [ajustes]);

    const alternarDia = (d: string) => {
        setDias((prev) => {
            const copia = { ...prev };
            if (copia[d]) delete copia[d];
            else copia[d] = ['08:00', '17:00'];
            return copia;
        });
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Cómo responde el bot</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Responder automáticamente</Label>
                            <p className="text-sm text-muted-foreground">
                                Si lo apagas, el bot prepara las respuestas pero alguien de la escuela
                                tiene que aprobarlas antes de que salgan.
                            </p>
                        </div>
                        <Switch
                            checked={ajustes?.mode === 'auto'}
                            disabled={guardando}
                            onCheckedChange={(v) => onGuardar({ mode: v ? 'auto' : 'assisted' })}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Asistente con IA</Label>
                            <p className="text-sm text-muted-foreground">
                                Apagarlo deja el canal solo para los avisos automáticos de pagos.
                            </p>
                        </div>
                        <Switch
                            checked={ajustes?.ai_enabled !== false}
                            disabled={guardando}
                            onCheckedChange={(v) => onGuardar({ ai_enabled: v })}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" /> Horario de atención
                    </CardTitle>
                    <CardDescription>
                        El bot responde siempre, a cualquier hora. Esto cambia lo que <strong>promete</strong>:
                        fuera del horario, cuando pasa un caso a una persona, le dice al acudiente cuándo
                        le responden de verdad en vez de «en breve te contactan».
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {DIAS.map(([num, nombre]) => (
                        <div key={num} className="flex items-center gap-3">
                            <Switch checked={!!dias[num]} onCheckedChange={() => alternarDia(num)} />
                            <span className="w-24 text-sm">{nombre}</span>
                            {dias[num] && (
                                <>
                                    <Input type="time" className="w-28" value={dias[num][0]}
                                        onChange={(e) => setDias((p) => ({ ...p, [num]: [e.target.value, p[num][1]] }))} />
                                    <span className="text-muted-foreground text-sm">a</span>
                                    <Input type="time" className="w-28" value={dias[num][1]}
                                        onChange={(e) => setDias((p) => ({ ...p, [num]: [p[num][0], e.target.value] }))} />
                                </>
                            )}
                        </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                        <Button disabled={guardando}
                            onClick={() => onGuardar({
                                business_hours: Object.keys(dias).length
                                    ? { tz: 'America/Bogota', dias }
                                    : null,
                            })}>
                            {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Guardar horario
                        </Button>
                        {Object.keys(dias).length === 0 && (
                            <p className="text-sm text-muted-foreground self-center">
                                Sin horario configurado no se promete una hora concreta.
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
