/**
 * VoidInvoiceDialog — anular (o corregir) una factura electrónica ya emitida
 * mediante una NOTA CRÉDITO.
 *
 * TRES COSAS QUE ESTA PANTALLA EXISTE PARA DECIR:
 *
 *  1. NO ES UN BORRADO. Una factura con CUFE existe ante la DIAN para siempre;
 *     la nota crédito no la borra, la deja sin efecto. Y la nota crédito es a su
 *     vez un documento electrónico: consume un número de SU PROPIO rango de
 *     numeración —otro rango, otra resolución, otro prefijo— y tampoco se
 *     deshace. Por eso el diálogo dice qué factura se anula, con su número y su
 *     monto, y pide marcar una casilla: un botón «Anular» suelto en la fila
 *     invita a un clic que no se puede devolver.
 *
 *  2. EL CONCEPTO LO ELIGE LA PERSONA. Los seis conceptos del catálogo de la
 *     DIAN no son sinónimos: anular por error de emisión (2) no es lo mismo,
 *     fiscalmente, que una devolución (1) o un ajuste de precio (4). El código
 *     no puede adivinar cuál corresponde, así que se ofrecen los seis en
 *     lenguaje entendible con la redacción oficial a la vista, y el 2 solo viene
 *     preseleccionado por ser el caso común.
 *
 *  3. FALTAR EL RANGO DE NOTAS CRÉDITO ES UN ESTADO NORMAL, NO UN ERROR. Es
 *     exactamente donde está producción de Dynasty hoy: su facturador tiene un
 *     solo rango activo y es el de facturas. Eso no lo arregla el código —
 *     alguien tiene que crear el rango en el portal del PAC—, así que acá se
 *     explica qué falta y quién lo hace, en tono informativo. Un botón
 *     deshabilitado con un tooltip no explica nada, que es justo la forma opaca
 *     de fallar que hay que evitar.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
    invoicingApi, InvoiceProviderRow, InvoiceRow, VoidInvoiceResult,
    CorrectionConceptCode, CORRECTION_CONCEPTS, CORRECTION_CONCEPT_ANULACION,
    CREDIT_NOTE_OBSERVATION_MAX, creditNoteRangeId,
} from '@/lib/api/invoicing';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CufeLine } from '@/components/accounting/InvoiceIdentifiers';
import {
    AlertCircle, Ban, CheckCircle2, ExternalLink, Loader2, Settings2, ShieldAlert,
} from 'lucide-react';

// ─── Los seis conceptos, en lenguaje de escuela ─────────────────────────────

/**
 * Cada concepto con el caso concreto en el que aplica. La redacción oficial de
 * la DIAN (CORRECTION_CONCEPTS) se muestra debajo del seleccionado, no en la
 * lista: «Devolución parcial de los bienes y/o no aceptación parcial del
 * servicio» en un menú de seis no ayuda a elegir, pero es lo que va a quedar
 * escrito en el documento y por eso tiene que verse antes de emitir.
 */
const CONCEPTO_OPCIONES: { code: CorrectionConceptCode; titulo: string; cuando: string }[] = [
    {
        code: '2',
        titulo: 'Anular la factura completa',
        cuando: 'La factura no debió salir: se emitió por error, duplicada, con el valor equivocado o a nombre de otra familia.',
    },
    {
        code: '1',
        titulo: 'Devolución o servicio no aceptado',
        cuando: 'El servicio facturado no se prestó o la familia no lo aceptó (una matrícula que se dio de baja).',
    },
    {
        code: '3',
        titulo: 'Rebaja o descuento posterior',
        cuando: 'Se acordó una rebaja sobre algo ya facturado, por ejemplo una beca aplicada tarde.',
    },
    {
        code: '4',
        titulo: 'Ajuste de precio',
        cuando: 'El valor facturado no era el que correspondía y hay que corregirlo.',
    },
    {
        code: '5',
        titulo: 'Descuento por pronto pago',
        cuando: 'Se reconoció un descuento por pagar anticipado después de haber emitido.',
    },
    {
        code: '6',
        titulo: 'Descuento por volumen',
        cuando: 'Descuento comercial por cantidad, acordado después de emitir.',
    },
];

function conceptoOpcion(code: CorrectionConceptCode) {
    return CONCEPTO_OPCIONES.find((o) => o.code === code) ?? CONCEPTO_OPCIONES[0];
}

// ─── Traducción de los motivos de rechazo del endpoint ──────────────────────

/**
 * Prefijo con el que el motor marca un fallo de TRANSPORTE (red, timeout, 5xx).
 * En una nota crédito esto es lo más delicado que puede pasar: el documento
 * PUDO quedar creado en el PAC con su número consumido, así que reintentar a
 * ciegas quema un segundo número para anular la misma factura. Ver el aviso
 * grande más abajo.
 */
const TRANSPORT_PREFIX = 'transporte:';

function esFalloDeTransporte(code: string): boolean {
    return code.startsWith(TRANSPORT_PREFIX) || code === 'pac_transport_error';
}

/** Se conserva el detalle crudo del PAC: es lo que se le pasa a soporte. */
function transporteLabel(code: string): string {
    const detalle = code.startsWith(TRANSPORT_PREFIX)
        ? code.slice(TRANSPORT_PREFIX.length).trim()
        : '';
    return `No se pudo confirmar la nota crédito con el proveedor${detalle ? ` (${detalle})` : ''}.`;
}

/**
 * Los motivos posibles, en español y accionables.
 *
 * `missing_credit_note_range` está acá además del bloqueo previo porque el
 * frontend mira `provider.config` y el BFF mira la config resuelta del lado del
 * servidor: si alguien cambió la configuración en otra pestaña, el que manda es
 * el del servidor y el mensaje tiene que ser el mismo en los dos caminos.
 */
function creditNoteErrorLabel(code: string, httpStatus?: number): string {
    if (httpStatus === 404) {
        return 'La anulación por nota crédito no está disponible en este ambiente todavía.';
    }
    if (esFalloDeTransporte(code)) return transporteLabel(code);
    const base = code.split(':')[0];
    switch (base) {
        case 'missing_credit_note_range':
            return 'El facturador no tiene rango de numeración de notas crédito. Hay que crearlo en el portal de tu PAC y anotar su id en la configuración del facturador.';
        case 'credit_note_not_supported':
            return 'Este facturador no emite notas crédito desde la app. Tu contador tiene que emitirla en el portal del proveedor.';
        case 'invoicing_disabled':
            return 'El facturador está deshabilitado: no se emitió nada.';
        case 'no_invoice_provider':
            return 'No hay facturador activo configurado.';
        case 'invoice_not_found':
            return 'Esa factura ya no existe.';
        case 'invoice_already_voided':
        case 'already_voided':
            return 'Esa factura ya estaba anulada. Recarga la lista para ver la nota crédito que la anuló.';
        case 'invoice_not_voidable':
        case 'invoice_status_not_voidable':
        case 'invalid_status':
            return 'Solo se puede anular una factura validada por la DIAN. Una rechazada no existe ante la DIAN y no hay nada que anular.';
        case 'invoice_without_number':
        case 'missing_bill_number':
            return 'La factura no tiene número asignado, y la nota crédito se refiere a la factura por su NÚMERO. Espera a que el proveedor lo asigne.';
        case 'invalid_correction_concept':
        case 'invalid_body':
            return 'El concepto de corrección que se envió no es válido.';
        case 'forbidden':
            return 'Tu cuenta no puede anular facturas de esta entidad.';
        default:
            // Lo que no está en el mapa es el mensaje crudo del PAC: se muestra tal cual.
            return code || 'El proveedor no devolvió motivo.';
    }
}

/**
 * La excepción del cliente HTTP, clasificada.
 *
 * Sin `status` no hubo respuesta HTTP: la petición se cortó en el navegador
 * (red caída, BFF reiniciándose en Render, pestaña dormida). Y un 5xx es lo
 * mismo desde acá: el handler pudo caerse DESPUÉS de que el PAC creara la nota
 * crédito. Los dos son el caso «no sabemos», que se trata igual que un fallo de
 * transporte contra el PAC — nunca como un «no pasó nada, reintenta».
 */
function errorDeExcepcion(err: any): { label: string; esTransporte: boolean } {
    const code = String(err?.body?.error ?? err?.message ?? '');
    const status = typeof err?.status === 'number' ? err.status : undefined;
    const esTransporte = esFalloDeTransporte(code) || status === undefined || status >= 500;
    return {
        label: esTransporte ? transporteLabel(code) : creditNoteErrorLabel(code, status),
        esTransporte,
    };
}

// ─── Diálogo ────────────────────────────────────────────────────────────────

export function VoidInvoiceDialog({
    invoice, provider, onClose, onCambio, onConfigurarFacturador,
}: {
    /** null = cerrado. La factura a anular. */
    invoice: InvoiceRow | null;
    provider: InvoiceProviderRow | null;
    onClose: () => void;
    /**
     * «Algo pudo cambiar del lado del servidor, refresca»: el llamador invalida
     * las queries. Se llama con la nota crédito cuando salió bien, y con null
     * cuando el fallo fue de TRANSPORTE — ahí la fila pudo quedar creada aunque
     * no tengamos respuesta, y dejar la tabla vieja es lo que lleva a un
     * segundo intento sobre algo que ya existe.
     */
    onCambio: (r: VoidInvoiceResult | null) => void;
    /** Abre la configuración del facturador (para anotar el rango de notas crédito). */
    onConfigurarFacturador?: () => void;
}) {
    return (
        <AlertDialog open={!!invoice} onOpenChange={(v) => { if (!v) onClose(); }}>
            {/* max-h + overflow: AlertDialogContent no acota el alto ni deja
                scrollear, así que en un portátil el checkbox y los botones
                quedaban por debajo del borde de la pantalla —invisibles y sin
                forma de llegar a ellos. */}
            {invoice && (
                <AlertDialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    {/* key por factura: el formulario (concepto, motivo, casilla,
                        estado de la mutación) arranca limpio para cada documento.
                        Sin esto, abrir la segunda factura después de anular la
                        primera mostraba el motivo escrito para la anterior. */}
                    <VoidInvoiceBody
                        key={invoice.id}
                        invoice={invoice}
                        provider={provider}
                        onClose={onClose}
                        onCambio={onCambio}
                        onConfigurarFacturador={onConfigurarFacturador}
                    />
                </AlertDialogContent>
            )}
        </AlertDialog>
    );
}

function VoidInvoiceBody({
    invoice, provider, onClose, onCambio, onConfigurarFacturador,
}: {
    invoice: InvoiceRow;
    provider: InvoiceProviderRow | null;
    onClose: () => void;
    onCambio: (r: VoidInvoiceResult | null) => void;
    onConfigurarFacturador?: () => void;
}) {
    const [concepto, setConcepto] = useState<CorrectionConceptCode>(CORRECTION_CONCEPT_ANULACION);
    const [motivo, setMotivo] = useState('');
    const [entendido, setEntendido] = useState(false);
    /** Resultado de un 200 con ok:false, o el error de la excepción. Se muestra
        dentro del diálogo y no en un toast: el toast se va solo, y acá el aviso
        es lo que evita el segundo intento a ciegas. */
    const [fallo, setFallo] = useState<{ label: string; esTransporte: boolean } | null>(null);
    const [emitida, setEmitida] = useState<VoidInvoiceResult | null>(null);

    const rangoNC = creditNoteRangeId(provider);
    const numero = invoice.number?.trim() || null;
    const total = invoice.total != null ? Number(invoice.total) : null;
    const opcion = conceptoOpcion(concepto);
    // La nota crédito se emite por el TOTAL de la factura: el endpoint no recibe
    // monto y el motor copia los ítems del documento original. Con el concepto 2
    // (anulación) eso es exactamente lo correcto; con los otros cinco —que son
    // parciales por definición— hay que decirlo, o alguien anula $90.000
    // completos creyendo que devuelve $20.000.
    const conceptoParcial = concepto !== CORRECTION_CONCEPT_ANULACION;

    const motivoLimpio = motivo.trim();
    // Motivo obligatorio aunque el API lo declare opcional: es lo único que
    // queda escrito —en la nota crédito del lado del PAC y en la fila de acá—
    // explicando por qué se anuló. Sin él, en tres meses nadie puede decir si
    // fue un error de digitación o una devolución real.
    const motivoValido = motivoLimpio.length >= 5 && motivoLimpio.length <= CREDIT_NOTE_OBSERVATION_MAX;

    const mutation = useMutation({
        mutationFn: () => invoicingApi.voidInvoice(invoice.id, {
            correctionConceptCode: concepto,
            reason: motivoLimpio,
        }),
        onSuccess: (r) => {
            if (!r.ok) {
                const code = String(r.error ?? '');
                const esTransporte = esFalloDeTransporte(code);
                setFallo({ label: creditNoteErrorLabel(code), esTransporte });
                // Un fallo de transporte pudo dejar la nota crédito creada: la
                // tabla tiene que releerse para que la factura se vea como
                // quedó de verdad y no como estaba antes de intentar.
                if (esTransporte) onCambio(null);
                return;
            }
            setFallo(null);
            setEmitida(r);
            onCambio(r);
        },
        onError: (err: any) => {
            const info = errorDeExcepcion(err);
            setFallo(info);
            if (info.esTransporte) onCambio(null);
        },
    });

    // ── Ya salió: se muestra la nota crédito, no se cierra solo ──────────────
    // El número y el CUFE de la nota crédito son el comprobante de la anulación
    // y la operación no se puede repetir para volver a verlos. Cerrar el diálogo
    // en el éxito dejaba al admin buscándolos en una tabla de 200 filas.
    if (emitida) {
        const nc = emitida.creditNote;
        return (
            <>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        Factura {numero ?? ''} anulada
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Se emitió la nota crédito que la deja sin efecto. La factura queda como
                        «Anulada» en la lista, con el número de esta nota.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-xs text-muted-foreground">Nota crédito</span>
                        <span className="font-mono text-sm font-semibold">{nc?.number ?? '(sin número todavía)'}</span>
                    </div>
                    {nc?.cufe ? <CufeLine cufe={nc.cufe} /> : (
                        <p className="text-xs text-muted-foreground">
                            El proveedor todavía no devolvió el CUFE: valida asíncrono y llega en minutos.
                        </p>
                    )}
                    {nc?.publicUrl && (
                        <Button size="sm" variant="outline" asChild>
                            <a href={nc.publicUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-2 h-3 w-3" /> Ver la nota crédito
                            </a>
                        </Button>
                    )}
                </div>

                <AlertDialogFooter>
                    <Button onClick={onClose}>Listo</Button>
                </AlertDialogFooter>
            </>
        );
    }

    // ── Bloqueos: cada uno explica QUÉ falta y QUIÉN lo resuelve ─────────────
    const bloqueo = (() => {
        if (!provider) {
            return {
                tipo: 'sin-facturador' as const,
                titulo: 'No hay facturador conectado',
                cuerpo: 'Una nota crédito la emite el mismo proveedor (PAC) que emitió la factura. Configúralo antes de anular.',
                config: true,
            };
        }
        if (!provider.enabled) {
            return {
                tipo: 'deshabilitado' as const,
                titulo: 'El facturador está deshabilitado',
                cuerpo: 'Mientras siga así no sale ningún documento, ni facturas ni notas crédito. Actívalo si de verdad vas a anular.',
                config: true,
            };
        }
        if (!rangoNC) {
            return {
                tipo: 'sin-rango' as const,
                titulo: 'Falta el rango de numeración de notas crédito',
                cuerpo: 'Una nota crédito no se numera con el rango de las facturas: usa su PROPIO rango, con otro prefijo y otra resolución de la DIAN. Tu facturador todavía no tiene uno, así que no se puede emitir ninguna.',
                config: true,
            };
        }
        if (!numero) {
            return {
                tipo: 'sin-numero' as const,
                titulo: 'La factura todavía no tiene número',
                cuerpo: 'La nota crédito se refiere a la factura por su NÚMERO, no por un identificador nuestro. Espera a que el proveedor lo asigne (valida asíncrono, tarda minutos) y vuelve a intentar.',
                config: false,
            };
        }
        return null;
    })();

    if (bloqueo) {
        return (
            <>
                <AlertDialogHeader>
                    <AlertDialogTitle>{bloqueo.titulo}</AlertDialogTitle>
                    <AlertDialogDescription>
                        Todavía no se puede anular la factura {numero ?? '(sin número)'}
                        {total != null ? ` por ${formatCurrency(total)}` : ''}. No se emitió nada.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {/* Informativo, no destructivo: no hay nada roto. Falta un paso
                    que se da por fuera de la app, y decirlo en rojo solo asusta. */}
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs leading-relaxed">{bloqueo.cuerpo}</AlertDescription>
                </Alert>

                {bloqueo.tipo === 'sin-rango' && provider && (
                    <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground">Cómo se resuelve</p>
                        <ol className="list-decimal space-y-1 pl-4">
                            <li>
                                En el portal de <strong className="uppercase">{provider.provider}</strong>, crea un
                                rango de numeración de <strong>nota crédito</strong> (es un trámite del portal, no
                                de la app: la resolución la autoriza la DIAN).
                            </li>
                            <li>
                                Copia el <strong>id</strong> de ese rango y anótalo en la configuración del
                                facturador, en «Rango de notas crédito».
                            </li>
                            <li>Vuelve acá: la anulación queda disponible para todas las facturas validadas.</li>
                        </ol>
                    </div>
                )}

                <AlertDialogFooter>
                    <Button variant="outline" onClick={onClose}>Cerrar</Button>
                    {bloqueo.config && onConfigurarFacturador && (
                        <Button onClick={onConfigurarFacturador}>
                            <Settings2 className="mr-2 h-4 w-4" /> Ir a la configuración
                        </Button>
                    )}
                </AlertDialogFooter>
            </>
        );
    }

    // ── Formulario de anulación ──────────────────────────────────────────────
    return (
        <>
            <AlertDialogHeader>
                <AlertDialogTitle>
                    ¿Anular la factura {numero}
                    {total != null ? ` por ${formatCurrency(total)}` : ''}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                    Se emite una <strong>nota crédito</strong> que la deja sin efecto ante la DIAN.
                    La factura no se borra: su número queda consumido para siempre.
                </AlertDialogDescription>
            </AlertDialogHeader>

            {/* Qué se anula, con los datos con los que el contador la identifica. */}
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-xs">
                <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-muted-foreground">Factura</span>
                    <span className="font-mono text-sm font-semibold">{numero}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-semibold">{total != null ? formatCurrency(total) : 'sin monto'}</span>
                    <span className="text-muted-foreground">
                        · {new Date(invoice.validated_at ?? invoice.created_at).toLocaleDateString('es-CO')}
                    </span>
                </div>
                {invoice.cufe ? <CufeLine cufe={invoice.cufe} /> : null}
            </div>

            <div className="space-y-4">
                <div className="grid gap-2">
                    <Label htmlFor="nc-concepto">Concepto de la corrección (DIAN)</Label>
                    <Select value={concepto} onValueChange={(v) => setConcepto(v as CorrectionConceptCode)}>
                        <SelectTrigger id="nc-concepto"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {CONCEPTO_OPCIONES.map((o) => (
                                <SelectItem key={o.code} value={o.code}>{o.titulo}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {opcion.cuando}
                        <br />
                        <span className="text-[10px]">
                            En el documento queda como: «{CORRECTION_CONCEPTS[concepto]}».
                        </span>
                    </p>
                </div>

                {/* Los cinco conceptos que no son «anulación» son parciales por
                    definición, y esta pantalla no emite parciales. */}
                {conceptoParcial && (
                    <Alert variant="warning">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs leading-relaxed">
                            La nota crédito sale por el <strong>total</strong> de la factura
                            {total != null ? ` (${formatCurrency(total)})` : ''}: acá no hay dónde poner un valor
                            distinto. Si lo que necesitas es devolver o ajustar <strong>una parte</strong>, esa
                            nota crédito parcial la emite tu contador en el portal del proveedor.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-2">
                    <Label htmlFor="nc-motivo">Motivo</Label>
                    <Textarea
                        id="nc-motivo"
                        rows={3}
                        maxLength={CREDIT_NOTE_OBSERVATION_MAX}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Ej. Se facturó dos veces la mensualidad de septiembre de Sara Acosta."
                    />
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-[10px] leading-relaxed text-muted-foreground">
                            Queda impreso en la nota crédito y guardado en la factura anulada. Es lo único que
                            le explica a tu contador —o a la DIAN— por qué se anuló.
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                            {motivoLimpio.length}/{CREDIT_NOTE_OBSERVATION_MAX}
                        </span>
                    </div>
                </div>

                <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    <li>
                        La nota crédito consume un número de tu rango de notas crédito (#{rangoNC}) y{' '}
                        <strong>ese número no se recupera</strong>.
                    </li>
                    <li>
                        <strong>No se puede deshacer</strong>, y tampoco emite una factura nueva: anula la que
                        ya salió.
                    </li>
                    {/* La expectativa natural es «anulo y vuelvo a emitirla bien».
                        Hoy eso no pasa: nuestro código de referencia es el mismo
                        para el proveedor, así que una segunda emisión del mismo
                        cobro devuelve el documento anterior. Decirlo acá evita que
                        se anule una factura buena esperando reemitirla corregida. */}
                    <li>
                        <strong>Anular no vuelve a facturar el cobro.</strong> Si la factura tenía un dato mal y
                        hay que emitirla de nuevo, coordínalo con tu contador antes: para el proveedor este cobro
                        ya tiene documento y una segunda emisión le devuelve el mismo.
                    </li>
                    {provider && !provider.sandbox && (
                        <li className="text-destructive">
                            El facturador está en <strong>producción</strong>: este documento es real ante la DIAN.
                        </li>
                    )}
                </ul>

                {/* Rojo SOLO el transporte. Los demás fallos («falta el rango»,
                    «el facturador está apagado») no emitieron nada y se
                    corrigen: pintarlos igual que el caso en el que puede haber
                    un documento vivo en la DIAN nivela dos cosas que no son
                    comparables. */}
                {fallo && (
                    <Alert variant={fallo.esTransporte ? 'destructive' : 'warning'}>
                        {fallo.esTransporte ? <ShieldAlert className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <AlertDescription className="text-xs leading-relaxed">
                            {fallo.label}
                            {/* El caso peor: la petición no volvió, así que la nota
                                crédito PUDO quedar creada con su número consumido.
                                Reintentar a ciegas quema un segundo número para
                                anular la misma factura. */}
                            {fallo.esTransporte && (
                                <>
                                    {' '}
                                    <strong>Puede haberse creado igual.</strong> Antes de reintentar, búscala en el
                                    portal de tu proveedor por el número de la factura ({numero}): si ya está, no
                                    la emitas otra vez.
                                </>
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer">
                    <Checkbox
                        checked={entendido}
                        onCheckedChange={(v) => setEntendido(v === true)}
                        className="mt-0.5"
                    />
                    <span className="text-xs leading-relaxed">
                        Entiendo que esto emite una nota crédito real, consume un número de la resolución y{' '}
                        <strong>no se puede deshacer</strong>.
                    </span>
                </label>
            </div>

            {/* Botones planos y no AlertDialogAction/Cancel a propósito:
                AlertDialogAction cierra el diálogo en el clic, y acá tiene que
                quedarse abierto —con el spinner— hasta que el PAC conteste. Si se
                cerrara antes, un admin sin respuesta vuelve a apretar «Anular» y
                quema un segundo número de nota crédito sobre la misma factura. */}
            <AlertDialogFooter>
                <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
                    Cancelar
                </Button>
                <Button
                    variant="destructive"
                    disabled={!entendido || !motivoValido || mutation.isPending}
                    onClick={() => mutation.mutate()}
                    title={!motivoValido ? 'Escribe el motivo (mínimo 5 caracteres)' : undefined}
                >
                    {mutation.isPending
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <Ban className="mr-2 h-4 w-4" />}
                    Sí, anular {numero}
                </Button>
            </AlertDialogFooter>
        </>
    );
}
