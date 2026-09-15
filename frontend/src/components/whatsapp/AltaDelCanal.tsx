/**
 * La pantalla de alta (F4 del spec).
 *
 * No es un botón con un título: es lo que la escuela lee **antes** de tomar una
 * decisión que le cambia el WhatsApp con el que habla con las familias.
 *
 * La decisión D5 del spec dice que lo que Coexistence le quita se avisa antes
 * de conectar, no después. Pesa sobre todo lo de las listas de difusión: varias
 * escuelas le escriben a los papás por ahí, y enterarse de que quedaron en solo
 * lectura *después* de conectar es enterarse cuando ya no se puede deshacer.
 *
 * Y los tres requisitos van arriba porque los tres detienen el proceso a mitad:
 * sin cuenta de Facebook no se puede autorizar, sin el celular a mano no se
 * puede verificar, y sin tarjeta Meta no deja enviar un solo mensaje.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, MessageSquare, Smartphone, CreditCard, Facebook, AlertTriangle } from 'lucide-react';
import { ConectarNumero, ALTA_CONFIGURADA, type ResultadoDelAlta } from './ConectarNumero';

export function AltaDelCanal({
    onListo, conectando, avisoSinCoexistence,
}: {
    onListo: (r: ResultadoDelAlta) => void;
    conectando: boolean;
    avisoSinCoexistence: boolean;
}) {
    return (
        <div className="p-6 max-w-2xl space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" /> Conecta el WhatsApp de tu escuela
                    </CardTitle>
                    <CardDescription>
                        Las familias te escriben al número de siempre y el asistente responde lo
                        repetitivo: qué debe cada quien, los comprobantes de pago, las
                        confirmaciones. Tú sigues viendo todo y respondes cuando quieras.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                    {/* Lo que detiene el proceso a mitad si falta */}
                    <div>
                        <p className="text-sm font-medium text-foreground mb-2">Ten esto a mano</p>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex gap-2.5">
                                <Facebook className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>
                                    <strong className="text-foreground">Tu cuenta de Facebook.</strong>{' '}
                                    Meta la usa para autorizar la conexión. Si no recuerdas la
                                    contraseña, recupérala antes de empezar.
                                </span>
                            </li>
                            <li className="flex gap-2.5">
                                <Smartphone className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>
                                    <strong className="text-foreground">El celular del número.</strong>{' '}
                                    Vas a recibir un código de verificación.
                                </span>
                            </li>
                            <li className="flex gap-2.5">
                                <CreditCard className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>
                                    <strong className="text-foreground">Una tarjeta.</strong> Meta la
                                    exige como respaldo. Tienes 1.000 mensajes de servicio gratis al
                                    mes; si te pasas, el excedente cuesta alrededor de $3 por mensaje.
                                    Vas a poder ver tu consumo acá mismo.
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* D5: lo que Coexistence apaga, ANTES del botón */}
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                            <AlertTriangle className="h-4 w-4" /> Qué cambia en ese número
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                            Vas a poder seguir usándolo en tu celular como siempre, y se sincronizan
                            tus últimos 6 meses de conversaciones. Pero WhatsApp desactiva algunas
                            funciones en un número conectado:
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                            <li>
                                <strong className="text-foreground">Las listas de difusión quedan
                                de solo lectura.</strong> Si hoy le escribes a los papás por ahí,
                                tendrás que hacerlo con los recordatorios de SportMaps.
                            </li>
                            <li>Los chats de grupo no entran al sistema.</li>
                            <li>Se desactivan los mensajes temporales y «ver una vez».</li>
                            <li>WhatsApp Web se desvincula y hay que volver a vincularlo.</li>
                        </ul>
                    </div>

                    {ALTA_CONFIGURADA ? (
                        <div className="space-y-3">
                            <ConectarNumero onListo={onListo} />

                            {conectando && (
                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Conectando con Meta…
                                </p>
                            )}

                            {/* Si Meta no dio Coexistence, la escuela pierde el número de su
                                celular. Se avisa cuando todavía se puede deshacer. */}
                            {avisoSinCoexistence && !conectando && (
                                <p className="text-sm text-amber-600 dark:text-amber-500">
                                    Meta no ofreció conectar una cuenta existente, así que este
                                    número dejará de funcionar en el celular.
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            La conexión todavía no está habilitada en este ambiente. Escríbenos y
                            lo dejamos andando.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
