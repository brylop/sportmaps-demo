/**
 * BandejaComprobantes — los comprobantes que llegaron por WhatsApp y el bot no
 * pudo aplicar solo.
 *
 * Hasta el 2026-10-07 era una lista plana (teléfono · tipo · código interno)
 * con un contador que sumaba de todo: fotos personales, capturas de correos y
 * pagos que la escuela ya había registrado. En Dynasty marcaba «100» (el tope
 * del listado) cuando lo que pedía una decisión eran ~25. Ahora:
 *
 *  · Tres secciones: «Requiere tu acción», «Para revisar» e «Informativo»
 *    (cerrada por defecto). El grupo lo decide el BFF (whatsapp-bandeja.service).
 *  · Miniatura del comprobante y «Ver chat», para decidir sin ir al celular.
 *  · «Marcar resuelto» y «Descartar», con motivo. No tocan pagos: si había que
 *    aplicar el comprobante, se aplica en Pagos y aquí se marca resuelto.
 *  · Lo que ya estaba registrado se cierra solo al abrir la bandeja.
 */

import { useCallback, useEffect, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, ChevronDown, FileText, Loader2, MessageSquare, RefreshCw, XCircle } from 'lucide-react';

type Grupo = 'accion' | 'revisar' | 'informativo';

export interface FilaDeBandeja {
    id: string;
    status: string;
    wa_phone_number: string;
    message_type: string;
    media_mime_type: string | null;
    media_caption: string | null;
    error_message: string | null;
    created_at: string;
    grupo: Grupo;
    motivo: string;
    etiqueta: string;
    detalle: string | null;
    conversacion_id: string | null;
    contacto: string | null;
    archivo_url: string | null;
}
export interface ResumenBandeja { accion: number; revisar: number; informativo: number; total: number }

const SECCIONES: { grupo: Grupo; titulo: string; ayuda: string }[] = [
    { grupo: 'accion', titulo: 'Requiere tu acción',
      ayuda: 'Hay plata de por medio y el asistente no supo a qué cobro va. Aplícalo en Pagos y márcalo resuelto.' },
    { grupo: 'revisar', titulo: 'Para revisar',
      ayuda: 'Puede ser un pago, pero lo normal es que no: números que no son familias, familias sin cobros pendientes.' },
    { grupo: 'informativo', titulo: 'Informativo (no requiere nada)',
      ayuda: 'No eran comprobantes, ya estaban registrados o llegaron de contactos personales.' },
];

const MOTIVOS_RAPIDOS: Record<'resuelto' | 'descartado', string[]> = {
    resuelto: ['Lo registré en Pagos', 'Ya estaba pagado', 'Lo resolví con la familia'],
    descartado: ['No es un pago de la escuela', 'Contacto personal', 'No es un comprobante', 'Duplicado'],
};

function enmascarar(tel: string): string {
    return tel ? `···${tel.slice(-4)}` : '';
}

export function BandejaComprobantes({ schoolId, onVerChat, onCambio }: {
    schoolId: string;
    /** Abre la conversación en la pestaña Conversaciones. */
    onVerChat: (conversacionId: string) => void;
    /** Avisa que cambió el contador (para refrescar la pestaña). */
    onCambio?: (resumen: ResumenBandeja) => void;
}) {
    const { toast } = useToast();
    const [filas, setFilas] = useState<FilaDeBandeja[]>([]);
    const [resumen, setResumen] = useState<ResumenBandeja | null>(null);
    const [cargando, setCargando] = useState(true);
    const [cierre, setCierre] = useState<{ fila: FilaDeBandeja; accion: 'resuelto' | 'descartado' } | null>(null);
    const [motivo, setMotivo] = useState('');
    const [guardando, setGuardando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const r = await bffClient.get<{ filas: FilaDeBandeja[]; resumen: ResumenBandeja; cerradas_solas: number }>(
                `/api/v1/whatsapp/${schoolId}/bandeja`);
            setFilas(r.filas ?? []);
            setResumen(r.resumen ?? null);
            if (r.resumen) onCambio?.(r.resumen);
            if ((r.cerradas_solas ?? 0) > 0) {
                toast({ title: `${r.cerradas_solas} se cerraron solas`, description: 'Ya estaban registradas en Pagos.' });
            }
        } catch (e: any) {
            toast({ title: 'No se pudo cargar la bandeja', description: e?.message, variant: 'destructive' });
        } finally {
            setCargando(false);
        }
    // onCambio cambia en cada render del padre: no debe disparar recargas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schoolId, toast]);

    useEffect(() => { void cargar(); }, [cargar]);

    const abrirCierre = (fila: FilaDeBandeja, accion: 'resuelto' | 'descartado') => {
        setCierre({ fila, accion });
        setMotivo('');
    };

    const confirmarCierre = async () => {
        if (!cierre || motivo.trim().length < 3) return;
        setGuardando(true);
        try {
            await bffClient.post(`/api/v1/whatsapp/${schoolId}/bandeja/${cierre.fila.id}/cerrar`,
                { accion: cierre.accion, motivo: motivo.trim() });
            const restantes = filas.filter((f) => f.id !== cierre.fila.id);
            setFilas(restantes);
            const nuevo: ResumenBandeja = {
                accion: restantes.filter((f) => f.grupo === 'accion').length,
                revisar: restantes.filter((f) => f.grupo === 'revisar').length,
                informativo: restantes.filter((f) => f.grupo === 'informativo').length,
                total: restantes.length,
            };
            setResumen(nuevo);
            onCambio?.(nuevo);
            toast({ title: cierre.accion === 'resuelto' ? 'Marcado como resuelto' : 'Descartado' });
            setCierre(null);
        } catch (e: any) {
            toast({ title: 'No se pudo guardar', description: e?.message, variant: 'destructive' });
        } finally {
            setGuardando(false);
        }
    };

    const fila = (f: FilaDeBandeja) => {
        const esImagen = (f.media_mime_type ?? '').startsWith('image/') || f.message_type === 'image';
        return (
            <div key={f.id} className="flex gap-3 border-b py-3 last:border-0 text-sm">
                <div className="shrink-0 w-16 h-16 rounded-md border bg-muted/40 overflow-hidden flex items-center justify-center">
                    {f.archivo_url && esImagen ? (
                        <a href={f.archivo_url} target="_blank" rel="noreferrer" title="Abrir el comprobante">
                            <img src={f.archivo_url} alt="Comprobante" loading="lazy" className="w-16 h-16 object-cover" />
                        </a>
                    ) : f.archivo_url ? (
                        <a href={f.archivo_url} target="_blank" rel="noreferrer" className="flex flex-col items-center text-xs text-primary">
                            <FileText className="h-5 w-5" /> PDF
                        </a>
                    ) : (
                        <span className="text-[10px] text-muted-foreground text-center px-1">Sin archivo</span>
                    )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium truncate">{f.contacto || enmascarar(f.wa_phone_number)}</span>
                        {f.contacto && <span className="text-xs text-muted-foreground">{enmascarar(f.wa_phone_number)}</span>}
                        <span className="text-xs text-muted-foreground">
                            {new Date(f.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                    </div>
                    <Badge variant="outline" className="font-normal">{f.etiqueta}</Badge>
                    {f.detalle && <p className="text-xs text-muted-foreground line-clamp-2">{f.detalle}</p>}
                    {f.media_caption && <p className="text-xs italic line-clamp-2">«{f.media_caption}»</p>}
                    {!f.archivo_url && f.grupo !== 'informativo' && (
                        <p className="text-xs text-muted-foreground">El archivo no se guardó: míralo en el chat.</p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                        {f.conversacion_id && (
                            <Button size="sm" variant="outline" onClick={() => onVerChat(f.conversacion_id!)}>
                                <MessageSquare className="h-3.5 w-3.5 mr-1" /> Ver chat
                            </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => abrirCierre(f, 'resuelto')}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marcar resuelto
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => abrirCierre(f, 'descartado')}>
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Descartar
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">Comprobantes sin resolver</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => void cargar()} disabled={cargando}>
                        <RefreshCw className={`h-4 w-4 mr-1 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
                    </Button>
                </div>
                <CardDescription>
                    Lo que llegó por el chat y el asistente no pudo aplicar solo. Marcar resuelto o descartar no
                    cambia ningún pago: si hay que registrarlo, hazlo en Pagos.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {cargando && !resumen ? (
                    <p className="text-sm text-muted-foreground py-8 flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                    </p>
                ) : filas.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                        No hay nada pendiente. Todo lo que llegó se resolvió.
                    </p>
                ) : (
                    SECCIONES.map((s) => {
                        const deEsta = filas.filter((f) => f.grupo === s.grupo);
                        if (!deEsta.length) return null;
                        const encabezado = (
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-sm">{s.titulo}</h3>
                                <Badge variant={s.grupo === 'accion' ? 'default' : 'secondary'}>{deEsta.length}</Badge>
                            </div>
                        );
                        if (s.grupo === 'informativo') {
                            return (
                                <Collapsible key={s.grupo}>
                                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
                                        {encabezado}
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    </CollapsibleTrigger>
                                    <p className="text-xs text-muted-foreground mt-1">{s.ayuda}</p>
                                    <CollapsibleContent>{deEsta.map(fila)}</CollapsibleContent>
                                </Collapsible>
                            );
                        }
                        return (
                            <section key={s.grupo}>
                                {encabezado}
                                <p className="text-xs text-muted-foreground mt-1">{s.ayuda}</p>
                                <div>{deEsta.map(fila)}</div>
                            </section>
                        );
                    })
                )}
            </CardContent>

            <Dialog open={!!cierre} onOpenChange={(v) => { if (!v) setCierre(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{cierre?.accion === 'resuelto' ? 'Marcar resuelto' : 'Descartar'}</DialogTitle>
                        <DialogDescription>
                            Sale de la bandeja. No cambia ningún pago.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                            {cierre && MOTIVOS_RAPIDOS[cierre.accion].map((m) => (
                                <Button key={m} size="sm" type="button" variant={motivo === m ? 'default' : 'outline'}
                                    onClick={() => setMotivo(m)}>{m}</Button>
                            ))}
                        </div>
                        <Label htmlFor="bandeja-motivo">Motivo</Label>
                        <Textarea id="bandeja-motivo" rows={2} maxLength={200} value={motivo}
                            onChange={(e) => setMotivo(e.target.value)} placeholder="Por qué sale de la bandeja" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCierre(null)} disabled={guardando}>Cancelar</Button>
                        <Button onClick={() => void confirmarCierre()} disabled={guardando || motivo.trim().length < 3}>
                            {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
