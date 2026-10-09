/**
 * «Recibir avisos de SportMaps en mi WhatsApp» — Configuración del canal.
 *
 * Spec docs/specs/canal-whatsapp-plataforma.md. La dueña/admin escribe SU
 * número; la app deja la suscripción pendiente y le da un botón que abre
 * WhatsApp con «… ACTIVAR <código>» hacia el número de SportMaps. Solo cuando
 * ese mensaje sale desde ese número queda activa: así se prueba que el número
 * es suyo (Meta autentica quién escribe).
 *
 * Los avisos solo traen enlaces a la app: aprobar pagos y responder a las
 * familias sigue siendo aquí.
 */
import { useCallback, useEffect, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { BellRing, ExternalLink, Loader2 } from 'lucide-react';

type Preferencia =
    | 'avisar_comprobantes' | 'avisar_escalaciones' | 'avisar_retiros'
    | 'avisar_cortesias' | 'avisar_resumen_diario' | 'avisar_informe_cartera';

interface Suscripcion {
    id: string;
    estado: 'pendiente' | 'activa';
    telefono: string;
    activada_at: string | null;
    codigo_expira_at: string | null;
    enlace_confirmar: string | null;
    preferencias: Record<Preferencia, boolean>;
    silencio: { desde: number; hasta: number; urgentes: boolean };
}

interface Estado {
    disponible: boolean;
    escuela_habilitada: boolean;
    numero_canal: string;
    suscripcion: Suscripcion | null;
}

const ETIQUETAS: { clave: Preferencia; texto: string; detalle: string }[] = [
    { clave: 'avisar_comprobantes', texto: 'Comprobantes por revisar', detalle: 'Agrupados, con cuánto llevan esperando.' },
    { clave: 'avisar_escalaciones', texto: 'Casos que piden a una persona', detalle: 'Incluye los urgentes (clase, lesión, seguridad).' },
    { clave: 'avisar_retiros', texto: 'Solicitudes de retiro', detalle: 'Para registrarlas antes del próximo cobro.' },
    { clave: 'avisar_cortesias', texto: 'Clases de cortesía', detalle: 'Agendadas, por confirmar y llegadas a la sede.' },
    { clave: 'avisar_resumen_diario', texto: 'Resumen de las 7:00 a. m.', detalle: 'Lo que quedó esperando y las cortesías del día.' },
    { clave: 'avisar_informe_cartera', texto: 'Informe de cartera de los lunes', detalle: 'Solo cifras; el detalle está en Finanzas.' },
];

const hora = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'a. m.' : 'p. m.'}`;

export function AvisosSportMaps({ schoolId }: { schoolId: string }) {
    const { toast } = useToast();
    const [estado, setEstado] = useState<Estado | null>(null);
    const [error, setError] = useState(false);
    const [telefono, setTelefono] = useState('');
    const [guardando, setGuardando] = useState(false);

    const base = `/api/v1/whatsapp/${schoolId}/avisos-sportmaps`;

    const cargar = useCallback(async () => {
        try {
            setEstado(await bffClient.get<Estado>(base));
            setError(false);
        } catch {
            setError(true);
        }
    }, [base]);

    useEffect(() => { void cargar(); }, [cargar]);

    // Nada que mostrar si el canal no está prendido o la llamada falló (p. ej. un coach: 403).
    if (error || !estado || !estado.disponible) return null;

    const s = estado.suscripcion;

    const pedir = async () => {
        setGuardando(true);
        try {
            const r = await bffClient.post<{ suscripcion: Suscripcion }>(base, { telefono });
            setEstado({ ...estado, suscripcion: r.suscripcion });
            if (r.suscripcion?.estado === 'pendiente') {
                toast({ title: 'Falta un paso', description: 'Toca «Confirmar desde mi WhatsApp» y envía el mensaje desde ese celular.' });
            }
        } catch (e: any) {
            toast({ title: 'No se pudo guardar', description: e?.message, variant: 'destructive' });
        } finally {
            setGuardando(false);
        }
    };

    const cambiar = async (clave: Preferencia | 'urgentes_en_silencio', valor: boolean) => {
        setGuardando(true);
        try {
            const r = await bffClient.patch<{ suscripcion: Suscripcion }>(base, { [clave]: valor });
            setEstado({ ...estado, suscripcion: r.suscripcion });
        } catch (e: any) {
            toast({ title: 'No se pudo guardar', description: e?.message, variant: 'destructive' });
        } finally {
            setGuardando(false);
        }
    };

    const dejar = async () => {
        setGuardando(true);
        try {
            await bffClient.delete(base);
            setEstado({ ...estado, suscripcion: null });
            toast({ title: 'Listo', description: 'Ya no recibirás avisos de SportMaps en tu WhatsApp.' });
        } catch (e: any) {
            toast({ title: 'No se pudo guardar', description: e?.message, variant: 'destructive' });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <BellRing className="h-4 w-4" /> Recibir avisos de SportMaps en mi WhatsApp
                    {s?.estado === 'activa' && <Badge variant="secondary">Activo</Badge>}
                    {s?.estado === 'pendiente' && <Badge variant="outline">Falta confirmar</Badge>}
                </CardTitle>
                <CardDescription>
                    Te escribimos desde el número de SportMaps ({estado.numero_canal}) a tu WhatsApp personal cuando algo
                    necesita a una persona. Solo traen un enlace a la app: aprobar pagos y responder a las familias
                    sigue siendo aquí. No te escribimos de {hora(s?.silencio.desde ?? 22)} a {hora(s?.silencio.hasta ?? 7)}.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!estado.escuela_habilitada && !s && (
                    <p className="text-sm text-muted-foreground">
                        Tu escuela todavía no tiene este servicio. Escríbenos a {estado.numero_canal} para activarlo.
                    </p>
                )}

                {estado.escuela_habilitada && !s && (
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                        <div className="flex-1">
                            <Label htmlFor="avisos-sm-telefono">Tu celular</Label>
                            <Input
                                id="avisos-sm-telefono"
                                inputMode="tel"
                                placeholder="320 123 4567"
                                value={telefono}
                                onChange={(e) => setTelefono(e.target.value)}
                            />
                        </div>
                        <Button onClick={() => void pedir()} disabled={guardando || telefono.replace(/\D/g, '').length < 10}>
                            {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Activar
                        </Button>
                    </div>
                )}

                {s?.estado === 'pendiente' && (
                    <div className="space-y-2">
                        <p className="text-sm">
                            Para terminar, envía el mensaje de confirmación <strong>desde el celular {s.telefono}</strong>.
                            El código vence en 7 días.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {s.enlace_confirmar && (
                                <Button asChild>
                                    <a href={s.enlace_confirmar} target="_blank" rel="noreferrer">
                                        Confirmar desde mi WhatsApp <ExternalLink className="h-4 w-4 ml-2" />
                                    </a>
                                </Button>
                            )}
                            <Button variant="outline" onClick={() => void cargar()}>Ya lo envié</Button>
                            <Button variant="ghost" onClick={() => void dejar()} disabled={guardando}>Cancelar</Button>
                        </div>
                    </div>
                )}

                {s?.estado === 'activa' && (
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">Llegan a {s.telefono}.</p>
                        {ETIQUETAS.map((e) => (
                            <div key={e.clave} className="flex items-start justify-between gap-4">
                                <div>
                                    <Label htmlFor={`avisos-sm-${e.clave}`}>{e.texto}</Label>
                                    <p className="text-xs text-muted-foreground">{e.detalle}</p>
                                </div>
                                <Switch
                                    id={`avisos-sm-${e.clave}`}
                                    className="shrink-0"
                                    checked={s.preferencias[e.clave] === true}
                                    disabled={guardando}
                                    onCheckedChange={(v) => void cambiar(e.clave, v)}
                                />
                            </div>
                        ))}
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <Label htmlFor="avisos-sm-urgentes">Casos urgentes también de noche</Label>
                                <p className="text-xs text-muted-foreground">Solo lesiones, seguridad o una clase que no se está dando.</p>
                            </div>
                            <Switch
                                id="avisos-sm-urgentes"
                                className="shrink-0"
                                checked={s.silencio.urgentes}
                                disabled={guardando}
                                onCheckedChange={(v) => void cambiar('urgentes_en_silencio', v)}
                            />
                        </div>
                        <Button variant="outline" onClick={() => void dejar()} disabled={guardando}>Dejar de recibir</Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
