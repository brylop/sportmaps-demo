/**
 * InvoicingTab — pestaña de Facturación Electrónica dentro de Contabilidad.
 *
 * Parametrizada por dueño (ownerType/ownerId) → sirve igual para school,
 * vendor (coach/tienda/wellness) y organizer. Toda la I/O pasa por el BFF
 * (invoicingApi); las credenciales del PAC nunca se muestran.
 *
 * Debajo de la configuración del facturador van dos pestañas: las facturas ya
 * emitidas y —solo para dueño 'school'— los datos fiscales faltantes, que es la
 * lista de pagadores con pagos cobrados que NO se pueden facturar
 * (MissingBillingDataPanel, que sí lee Supabase directo porque las policies
 * alcanzan y no hay endpoint que agregue eso).
 *
 * TRES COSAS QUE ESTA PANTALLA TIENE QUE DECIR EN VOZ ALTA:
 *
 *  1. POR QUÉ SE VE EL MOTIVO DEL RECHAZO. `error_message` se guarda en
 *     `electronic_invoices` desde siempre, pero no se devolvía ni se pintaba.
 *     La escuela veía "Rechazada" y nada más, así que las rechazadas se
 *     apilaron sin que nadie pudiera saber qué corregir. Ese fue el mecanismo
 *     exacto de la acumulación silenciosa: acá se muestra el motivo tal cual
 *     lo devolvió el PAC, y las rechazadas se cuentan arriba de la tabla para
 *     que no haya que leerla fila por fila.
 *
 *  2. POR QUÉ EXISTE LA EMISIÓN POR RANGO. El barrido automático mira solo los
 *     últimos días (CRON_WINDOW_DAYS); un pago registrado a mano más tarde no
 *     se factura nunca solo. `invoicingApi.emit` (pago por pago) no tenía ni un
 *     llamador en el frontend, así que no había NINGUNA vía de producto para
 *     emitir un mes cerrado. La emisión por rango es esa vía — y como cada
 *     documento quema un número de la resolución DIAN, pasa por una
 *     confirmación que dice cuántos y por cuánto.
 *
 *  3. POR QUÉ LA ANULACIÓN ES UNA ACCIÓN POR FILA Y NO UN BOTÓN GLOBAL. Una
 *     factura emitida solo se deshace con una NOTA CRÉDITO, que es otro
 *     documento electrónico: consume un número de su propio rango y queda ante
 *     la DIAN para siempre. Así que la acción vive en la fila de la factura
 *     concreta —para que la confirmación pueda decir cuál se anula, por cuánto
 *     y con qué concepto— y solo aparece donde tiene sentido: en una validada.
 *     Una rechazada no existe ante la DIAN (no hay nada que anular) y una
 *     'sent' todavía no se sabe. Después, la anulada se ve anulada CON el
 *     número de la nota que la dejó sin efecto: si no, el documento desaparece
 *     del total y nadie sabe por qué.
 */

import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
    invoicingApi, OwnerType, InvoiceProviderRow, InvoiceRow, BackfillInvoicesResult,
    BACKFILL_MAX_LIMIT, BACKFILL_MAX_DAYS, CREDIT_NOTE_RANGE_KEY, creditNoteRangeId,
} from '@/lib/api/invoicing';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    MissingBillingDataPanel, useMissingBillingData, countBlocking, summarizeRange,
    CRON_WINDOW_DAYS,
} from '@/components/accounting/MissingBillingDataPanel';
import type { MissingBillingData, RangeSummary } from '@/components/accounting/MissingBillingDataPanel';
import { CopyButton, CufeLine } from '@/components/accounting/InvoiceIdentifiers';
import { VoidInvoiceDialog } from '@/components/accounting/VoidInvoiceDialog';
import {
    FileText, Loader2, Plus, AlertCircle, RefreshCw, ExternalLink, CheckCircle2, Settings2,
    Clock, Hourglass, XCircle, Ban, Send, ShieldAlert, MapPin, FileMinus2, CornerUpLeft,
} from 'lucide-react';

// ─── Estados ────────────────────────────────────────────────────────────────

/**
 * Los cuatro estados de verdad, que NO son variantes del mismo aviso:
 *
 *   queued   → la fila la creamos nosotros ANTES de llamar al PAC (runEmission
 *              hace el upsert en 'queued' y después emite). Si quedó así, nada
 *              salió: no se consumió número y se puede reintentar sin costo.
 *   sent     → el PAC ya recibió el documento. Factus V2 valida asíncrono y
 *              responde solo con el acuse, así que número y CUFE llegan
 *              minutos después. El número YA se consumió.
 *   accepted → validada por la DIAN. Documento legal vigente.
 *   rejected → la DIAN o el PAC la rechazaron. No es un documento válido y hay
 *              que corregir el dato de fondo y volver a emitir.
 *
 * Antes 'queued' era ámbar y 'rejected' rojo: dos avisos del mismo tono, y
 * "en cola" se leía como un problema menor cuando en realidad es lo único que
 * NO cuesta nada. Ahora lo que espera es neutro y lo roto es lo único rojo.
 */
const STATUS_STYLES: Record<string, {
    label: string;
    cls: string;
    Icon: typeof CheckCircle2;
    hint: string;
}> = {
    accepted: {
        label: 'Validada por la DIAN',
        cls: 'bg-emerald-600 text-white hover:bg-emerald-600',
        Icon: CheckCircle2,
        hint: 'Documento legal vigente.',
    },
    sent: {
        label: 'Emitida · esperando DIAN',
        cls: 'bg-blue-600 text-white hover:bg-blue-600',
        Icon: Clock,
        hint: 'Ya salió al proveedor y consumió número. La DIAN valida en minutos. Todavía no se puede anular: hasta que no esté validada no se sabe qué hay que anular.',
    },
    queued: {
        label: 'En cola (nuestra)',
        cls: 'border border-dashed border-muted-foreground/50 bg-transparent text-muted-foreground hover:bg-transparent',
        Icon: Hourglass,
        hint: 'Todavía no salió al proveedor: no consumió número y se puede reintentar sin costo.',
    },
    rejected: {
        label: 'Rechazada',
        cls: 'bg-red-600 text-white hover:bg-red-600',
        Icon: XCircle,
        hint: 'No es un documento válido. Hay que corregir el dato y volver a emitir. No se anula con nota crédito: no existe ante la DIAN, así que no hay nada que anular.',
    },
    draft: {
        label: 'Borrador',
        cls: 'bg-muted text-foreground hover:bg-muted',
        Icon: FileText,
        hint: 'Se preparó pero no se envió.',
    },
    void: {
        label: 'Anulada',
        cls: 'bg-muted text-muted-foreground hover:bg-muted',
        Icon: Ban,
        // No dice «cancelada» ni «borrada» a propósito: el documento sigue
        // existiendo ante la DIAN con su número consumido. Lo que la deja sin
        // efecto es la nota crédito, y su número está en la sub-fila.
        hint: 'Sin efecto por una nota crédito. El número de la factura sigue consumido ante la DIAN.',
    },
};

function statusMeta(status: string) {
    return STATUS_STYLES[status] ?? {
        label: status,
        cls: 'bg-muted text-foreground hover:bg-muted',
        Icon: AlertCircle,
        hint: 'Estado no reconocido por la app.',
    };
}

// ─── Rango por defecto ──────────────────────────────────────────────────────

/** `YYYY-MM-DD` en hora LOCAL: `toISOString()` corre el día pasadas las 7 p.m. en Colombia. */
function isoDay(d: Date): string {
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * Mes en curso, del 1 al último día.
 *
 * Se calcula y no se escribe fijo: "septiembre 2026" hoy es el mes correcto,
 * pero un literal en el código se vuelve mentira el 1 de octubre y el admin
 * emitiría el mes equivocado sin notarlo.
 */
function mesEnCurso(hoy = new Date()) {
    return {
        from: isoDay(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
        to: isoDay(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)),
    };
}

// ─── Traducción de los códigos de error del motor ───────────────────────────

/**
 * Los códigos que devuelve `emitInvoiceForPayment`. Se traducen acá porque un
 * `customer_missing_fiscal_data` en pantalla no le dice a nadie qué hacer, y el
 * resultado del backfill tiene que ser accionable o no sirve de nada.
 */
const REASON_LABEL: Record<string, string> = {
    customer_missing_fiscal_data: 'Al pagador le falta documento o dirección',
    customer_missing_municipality: 'Al pagador le falta el municipio (código DANE)',
    payment_without_payer: 'El cobro no tiene pagador vinculado',
    payment_without_school: 'El cobro no tiene escuela',
    payment_not_found: 'El cobro ya no existe',
    payment_not_paid: 'El cobro no está cobrado',
    no_invoice_provider: 'No hay facturador activo configurado',
    cannot_resolve_owner: 'No se pudo resolver a nombre de quién factura',
    provider_missing_numbering_range: 'Al facturador le falta el rango de numeración',
    draft_failed: 'No se pudo preparar el documento',
    emit_threw: 'El proveedor falló al recibir el documento',
    pac_transport_error: 'No se pudo confirmar con el proveedor (queda en cola para reintentar)',
    already_invoiced: 'Ya tenía factura viva',
    dry_run: 'Solo simulación: no se emitió',
    date_range_invalid: 'El rango de fechas no es válido',
};

/**
 * Prefijo con el que el motor marca un fallo de TRANSPORTE (red, timeout, 5xx).
 * No es un rechazo: el documento pudo quedar creado en el PAC, así que la fila
 * se queda 'queued' para que la reconciliación la complete. Decirle "rechazada"
 * a esto es lo que quemaba un número y lo dejaba perdido.
 */
const TRANSPORT_PREFIX = 'transporte:';

function reasonLabel(reason: string | null | undefined): string {
    if (!reason) return 'Sin motivo reportado';
    if (REASON_LABEL[reason]) return REASON_LABEL[reason];
    if (reason.startsWith(TRANSPORT_PREFIX)) {
        return `Fallo de comunicación con el proveedor: ${reason.slice(TRANSPORT_PREFIX.length).trim()}`;
    }
    const conPrefijo = Object.keys(REASON_LABEL).find((k) => reason.startsWith(`${k}:`));
    if (conPrefijo) return REASON_LABEL[conPrefijo];
    // Lo que no está en el mapa es el mensaje crudo del PAC: se muestra tal cual.
    return reason;
}

/**
 * Cuántos pagos representa una línea de `details`.
 *
 * El BFF resume los que ya tenían factura en UNA entrada agregada
 * (`already_invoiced:34`, sin paymentId). Contarla como 1 diría "1 saltado" con
 * 34 saltados de verdad, y los números de la pantalla dejarían de cuadrar con
 * los totales que devuelve el mismo endpoint.
 */
function detailWeight(reason: string | null | undefined): number {
    const m = /^[a-z_]+:(\d+)$/.exec(String(reason ?? ''));
    return m ? Number(m[1]) : 1;
}

/**
 * Los rechazos del endpoint de backfill, en español.
 *
 * `invoicing_disabled` es el más importante: significa que el facturador está
 * apagado y que NO se emitió nada. Mostrar el código crudo dejaría al admin
 * pensando que falló algo raro cuando en realidad falta una decisión suya.
 */
function backfillErrorLabel(err: any): string {
    const code = String(err?.body?.error ?? err?.message ?? '');
    if (err?.status === 404) {
        return 'La emisión por rango no está disponible en este ambiente todavía.';
    }
    if (code === 'invoicing_disabled') {
        return 'El facturador está deshabilitado: no se emitió nada. Actívalo antes de emitir.';
    }
    if (code === 'date_range_too_wide') {
        return `El rango no puede pasar de ${err?.body?.maxDays ?? BACKFILL_MAX_DAYS} días. Emite mes por mes.`;
    }
    if (code === 'invalid_body') return 'El rango o el tope que se enviaron no son válidos.';
    if (code === 'forbidden') return 'Tu cuenta no puede emitir facturas de esta entidad.';
    if (code === 'invalid_owner_type') return 'Tipo de entidad no válido para facturar.';
    return err?.message ?? 'Error desconocido';
}

export function InvoicingTab({ ownerType, ownerId }: { ownerType: OwnerType; ownerId: string }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [configOpen, setConfigOpen] = useState(false);

    const providersQuery = useQuery({
        queryKey: ['einv-providers', ownerType, ownerId],
        enabled: !!ownerId,
        queryFn: () => invoicingApi.listProviders(ownerType, ownerId),
    });

    const invoicesQuery = useQuery({
        queryKey: ['einv-invoices', ownerType, ownerId],
        enabled: !!ownerId,
        queryFn: () => invoicingApi.listInvoices(ownerType, ownerId),
    });

    const provider = providersQuery.data?.providers?.[0] ?? null;
    const supported = providersQuery.data?.supported ?? ['factus'];
    // Memoizada, no `?? []` suelto: ese literal es un array nuevo en cada
    // render, así que TODOS los useMemo que dependen de él (los conteos y el
    // índice factura ↔ nota crédito) se recalculaban siempre y la memoización
    // era decorativa.
    const invoices = useMemo(() => invoicesQuery.data?.invoices ?? [], [invoicesQuery.data]);

    // Los datos fiscales faltantes solo aplican al dueño 'school': la lista se
    // arma sobre `payments.school_id` y el formulario del admin pasa por
    // admin_set_payer_billing_details, que valida alcance por escuela.
    const esEscuela = ownerType === 'school';
    const missingQuery = useMissingBillingData(esEscuela ? ownerId : null);
    const pendientesFiscales = countBlocking(missingQuery.data);

    // La emisión por rango vive en la pestaña de emitidas; el panel de datos
    // faltantes (la otra pestaña) tiene que poder mandar al admin acá, porque
    // completar el dato NO emite nada. Por eso las pestañas son controladas.
    const [tab, setTab] = useState<'emitidas' | 'faltantes'>('emitidas');
    const backfillRef = useRef<HTMLDivElement>(null);
    const irABackfill = () => {
        setTab('emitidas');
        // Un frame después: el TabsContent de emitidas todavía no está montado.
        window.requestAnimationFrame(() => {
            backfillRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    };

    const rechazadas = useMemo(() => invoices.filter((i) => i.status === 'rejected'), [invoices]);
    const enCola = useMemo(() => invoices.filter((i) => i.status === 'queued'), [invoices]);
    const anuladas = useMemo(
        () => invoices.filter((i) => i.status === 'void' && i.document_type !== 'credit_note'),
        [invoices],
    );

    /**
     * Índice de las dos direcciones del enlace factura ↔ nota crédito.
     *
     * El dato vive en UN solo lado —`voided_by_invoice_id` en la factura, ver la
     * migración 20260910092915— así que el camino inverso («esta nota crédito a
     * qué factura anuló») se deduce recorriendo la lista una vez. Deducirlo por
     * `payment_id` compartido sería más fácil y estaría MAL: un pago con dos
     * intentos de facturación tiene varias filas, y eso es justamente lo que
     * pasa cuando hay algo que anular.
     */
    const { notaDeFactura, facturaDeNota } = useMemo(() => {
        const porId = new Map(invoices.map((i) => [i.id, i]));
        const notaDeFactura = new Map<string, InvoiceRow>();
        const facturaDeNota = new Map<string, InvoiceRow>();
        for (const inv of invoices) {
            const ncId = inv.voided_by_invoice_id;
            if (!ncId) continue;
            const nc = porId.get(ncId);
            // La nota crédito puede no estar en esta lista (el endpoint todavía
            // no devuelve la columna, o la fila quedó fuera del filtro): eso
            // deja la tabla sin el cruce, no sin pintarse.
            if (!nc) continue;
            notaDeFactura.set(inv.id, nc);
            facturaDeNota.set(nc.id, inv);
        }
        return { notaDeFactura, facturaDeNota };
    }, [invoices]);

    // La factura que el admin pidió anular. Una sola a la vez y en estado del
    // padre: un diálogo por fila multiplicaría por 200 el formulario de una
    // operación que se hace de a una.
    const [aAnular, setAAnular] = useState<InvoiceRow | null>(null);

    // La tabla de facturas emitidas se comparte entre el layout con pestañas
    // (dueño 'school') y el de una sola sección (vendor/organizer).
    const facturasEmitidasCard = (
        <Card>
            <CardHeader>
                <CardTitle>Facturas emitidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-0">
                {invoicesQuery.isError ? (
                    <div className="p-6">
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                            <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" />
                            <span>No se pudieron cargar las facturas.</span>
                            <Button size="sm" variant="outline" onClick={() => invoicesQuery.refetch()}>
                                <RefreshCw className="mr-2 h-3 w-3" /> Reintentar
                            </Button>
                        </div>
                    </div>
                ) : invoicesQuery.isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                        <FileText className="h-10 w-10 opacity-30" />
                        <p className="text-sm">Aún no hay facturas emitidas.</p>
                    </div>
                ) : (
                    <>
                        {/* Resumen de lo que está roto, ARRIBA de la tabla. Una
                            rechazada perdida entre 200 filas no se encuentra:
                            así es como se acumularon sin que nadie se enterara. */}
                        {rechazadas.length > 0 && (
                            <div className="px-6 pt-4">
                                <Alert variant="destructive">
                                    <ShieldAlert className="h-4 w-4" />
                                    <AlertDescription className="text-xs">
                                        {/* «documento(s)» y no «factura(s)»: desde que existen las
                                            notas crédito, la tabla tiene dos tipos de documento y una
                                            nota crédito rechazada significa que la factura que iba a
                                            anular SIGUE vigente. */}
                                        <strong>{rechazadas.length} documento(s) rechazado(s)</strong> por{' '}
                                        {formatCurrency(rechazadas.reduce((a, i) => a + (Number(i.total) || 0), 0))}.
                                        Ninguno se reemite solo: el motivo de cada uno está en su fila, y hay que
                                        corregir ese dato antes de volver a emitir.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}
                        {enCola.length > 0 && (
                            <div className="px-6 pt-2">
                                <Alert>
                                    <Hourglass className="h-4 w-4" />
                                    <AlertDescription className="text-xs">
                                        <strong>{enCola.length} en cola nuestra:</strong> se prepararon pero no
                                        llegaron al proveedor, así que no consumieron número de la resolución.
                                        Se pueden reintentar sin costo.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}
                        {/* Las anuladas se cuentan aparte y en tono neutro: no
                            hay nada roto, pero dejaron de sumar al total
                            facturado y su número sigue consumido. Sin este
                            renglón, un mes que cuadraba deja de cuadrar y no hay
                            dónde ver por qué. */}
                        {anuladas.length > 0 && (
                            <div className="px-6 pt-2">
                                <Alert>
                                    <Ban className="h-4 w-4" />
                                    <AlertDescription className="text-xs">
                                        <strong>{anuladas.length} factura(s) anulada(s)</strong> por{' '}
                                        {formatCurrency(anuladas.reduce((a, i) => a + (Number(i.total) || 0), 0))}.
                                        Ya no tienen efecto, pero <strong>siguen existiendo</strong> ante la DIAN con
                                        su número consumido: la nota crédito que anuló a cada una está en su fila.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Documento</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Acción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoices.map((inv) => (
                                        <InvoiceRows
                                            key={inv.id}
                                            inv={inv}
                                            notaCredito={notaDeFactura.get(inv.id) ?? null}
                                            facturaAnulada={facturaDeNota.get(inv.id) ?? null}
                                            onAnular={() => setAAnular(inv)}
                                        />
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6">
            {/* Configuración del facturador */}
            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Settings2 className="h-5 w-5 text-primary" /> Facturador electrónico
                        </CardTitle>
                        <CardDescription>
                            Conecta tu proveedor (PAC) para emitir factura electrónica ante la DIAN.
                            El documento sale a nombre de tu entidad.
                        </CardDescription>
                    </div>
                    <Button variant={provider ? 'outline' : 'default'} onClick={() => setConfigOpen(true)}>
                        {provider ? <Settings2 className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                        {provider ? 'Editar' : 'Configurar'}
                    </Button>
                </CardHeader>
                <CardContent>
                    {providersQuery.isLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                        </div>
                    ) : provider ? (
                        <div className="flex flex-wrap items-center gap-3">
                            <Badge className="bg-primary text-primary-foreground uppercase">{provider.provider}</Badge>
                            <Badge variant={provider.sandbox ? 'secondary' : 'default'}>
                                {provider.sandbox ? 'Pruebas (sandbox)' : 'Producción'}
                            </Badge>
                            {provider.enabled
                                ? <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Activo</span>
                                : <span className="text-sm text-muted-foreground">Deshabilitado</span>}
                            {provider.config?.numbering_range_id != null && (
                                <span className="text-xs text-muted-foreground">Rango #{String(provider.config.numbering_range_id)}</span>
                            )}
                            {/* El rango de notas crédito se muestra SIEMPRE, y
                                cuando falta se dice que falta. Es la diferencia
                                entre poder anular una factura y no poder, y
                                producción de Dynasty hoy no lo tiene: sin este
                                renglón eso se descubre recién el día que hay una
                                factura mal emitida y ya es urgente. */}
                            {creditNoteRangeId(provider) ? (
                                <span className="text-xs text-muted-foreground">
                                    Notas crédito: rango #{creditNoteRangeId(provider)}
                                </span>
                            ) : (
                                <span
                                    className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"
                                    title="Una nota crédito se numera con su propio rango, con otro prefijo y otra resolución de la DIAN. Hay que crearlo en el portal del proveedor y anotar su id en la configuración del facturador."
                                >
                                    <FileMinus2 className="h-3 w-3" />
                                    Sin rango de notas crédito: no se puede anular
                                </span>
                            )}
                            {/* El municipio por defecto se imprime en TODA factura cuyo
                                pagador no tenga código DANE propio. Verlo acá es lo que
                                permite notar que 147 documentos van a salir con la
                                ciudad equivocada antes de emitirlos. */}
                            {provider.config?.default_municipality_id != null && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    Municipio por defecto {String(provider.config.default_municipality_id)}
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                            <FileText className="h-10 w-10 opacity-30" />
                            <p className="text-sm">Aún no has conectado un facturador. Configúralo para empezar a emitir facturas.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Facturas emitidas + datos fiscales faltantes.
                El segundo solo existe para 'school'; para vendor/organizer no
                hay pagos de escuela que auditar y una pestaña sola sobra. */}
            {esEscuela ? (
                <Tabs
                    value={tab}
                    onValueChange={(v) => setTab(v as 'emitidas' | 'faltantes')}
                    className="space-y-4"
                >
                    <TabsList>
                        <TabsTrigger value="emitidas">Facturas emitidas</TabsTrigger>
                        <TabsTrigger value="faltantes" className="gap-2">
                            Datos fiscales faltantes
                            {pendientesFiscales > 0 && (
                                <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                                    {pendientesFiscales}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="emitidas" className="space-y-4">
                        {/* La emisión por rango solo se ofrece para 'school': el
                            resumen previo (cuántos y por cuánto) se calcula de
                            `payments` de la escuela, y sin ese número no hay
                            confirmación honesta que poner delante de algo
                            irreversible. */}
                        <div ref={backfillRef}>
                            <BackfillCard
                                ownerType={ownerType}
                                ownerId={ownerId}
                                provider={provider}
                                anuladas={anuladas.length}
                                missing={missingQuery.data}
                                missingLoading={missingQuery.isLoading}
                                missingError={missingQuery.isError}
                                onEmitted={() => {
                                    queryClient.invalidateQueries({ queryKey: ['einv-invoices', ownerType, ownerId] });
                                    queryClient.invalidateQueries({ queryKey: ['einv-missing-billing', ownerId] });
                                }}
                            />
                        </div>
                        {facturasEmitidasCard}
                    </TabsContent>
                    <TabsContent value="faltantes">
                        <MissingBillingDataPanel schoolId={ownerId} onIrABackfill={irABackfill} />
                    </TabsContent>
                </Tabs>
            ) : facturasEmitidasCard}

            {/* Anulación por nota crédito. Vive acá, en el padre, para que
                después de emitirla se invaliden las mismas queries que refrescan
                la tabla: si la factura anulada no se repinta como «Anulada», el
                admin no tiene forma de saber si la operación —que no se puede
                repetir— surtió efecto. */}
            <VoidInvoiceDialog
                invoice={aAnular}
                provider={provider}
                onClose={() => setAAnular(null)}
                onCambio={() => {
                    queryClient.invalidateQueries({ queryKey: ['einv-invoices', ownerType, ownerId] });
                    // También el resumen de datos faltantes: cuenta como
                    // «facturado» solo lo que tiene factura en 'accepted' o
                    // 'sent', así que al pasar la factura a 'void' su pago
                    // vuelve a aparecer como pendiente. Refrescarlo no lo
                    // arregla, lo hace visible — y de eso avisa la tarjeta de
                    // emisión por rango.
                    queryClient.invalidateQueries({ queryKey: ['einv-missing-billing', ownerId] });
                }}
                onConfigurarFacturador={() => {
                    // Un diálogo a la vez: se cierra este antes de abrir el de
                    // configuración, o Radix deja dos overlays apilados y el de
                    // abajo se queda sin poder cerrarse.
                    setAAnular(null);
                    setConfigOpen(true);
                }}
            />

            <ProviderConfigDialog
                /* key por facturador: el formulario inicializa su estado con
                   useState(existing?…), que corre UNA vez. El diálogo se monta
                   mientras la query todavía carga (existing = null), así que sin
                   este key los campos se quedaban vacíos aunque el facturador ya
                   estuviera configurado — y guardar desde ahí sobreescribía la
                   config buena con la mitad de los datos. */
                key={provider?.id ?? 'nuevo'}
                open={configOpen}
                onOpenChange={setConfigOpen}
                supported={supported}
                existing={provider}
                onSave={async (body) => {
                    await invoicingApi.saveProvider(ownerType, ownerId, body);
                    toast({ title: 'Facturador guardado', description: 'La configuración se actualizó correctamente.' });
                    setConfigOpen(false);
                    queryClient.invalidateQueries({ queryKey: ['einv-providers', ownerType, ownerId] });
                }}
            />
        </div>
    );
}

// ─── Fila(s) de una factura ─────────────────────────────────────────────────

/**
 * Una factura ocupa una fila, y DOS cuando tiene algo que explicar.
 *
 * El motivo del rechazo va en una sub-fila a todo el ancho (`colSpan`) y no en
 * una columna nueva: un mensaje de la DIAN como "Regla: 90, Rechazo: Documento
 * procesado anteriormente" en una celda obliga a scroll horizontal a la tabla
 * completa, y el scroll horizontal es exactamente donde un aviso se deja de
 * leer. A todo el ancho el texto envuelve y no empuja ninguna columna.
 *
 * La misma sub-fila lleva el cruce con la nota crédito, en las DOS direcciones:
 * en la factura anulada, con qué nota se anuló; en la nota crédito, a qué
 * factura anuló. Son documentos separados con numeración separada y los dos
 * siguen en la lista —ninguno se esconde—, así que sin el cruce quedan dos
 * filas que nadie relaciona.
 */
function InvoiceRows({
    inv, notaCredito, facturaAnulada, onAnular,
}: {
    inv: InvoiceRow;
    /** Si `inv` es una factura anulada: la nota crédito que la anuló. */
    notaCredito: InvoiceRow | null;
    /** Si `inv` es una nota crédito: la factura que anuló. */
    facturaAnulada: InvoiceRow | null;
    onAnular: () => void;
}) {
    const st = statusMeta(inv.status);
    const esRechazada = inv.status === 'rejected';
    const esNotaCredito = inv.document_type === 'credit_note';
    // El motivo se muestra siempre que exista; y si la factura está rechazada
    // sin motivo, se dice ESO, que también es información: significa que el
    // proveedor no devolvió nada y hay que ir a buscarlo al portal.
    const motivo = inv.error_message?.trim() || null;
    const anulada = inv.status === 'void';
    const mostrarDetalle = !!motivo || esRechazada || anulada || esNotaCredito;

    /**
     * Anular se ofrece SOLO sobre una factura validada por la DIAN, y esa
     * restricción no es un detalle de UI:
     *   · 'rejected' no existe ante la DIAN — no hay documento que dejar sin
     *     efecto, y emitir una nota crédito contra él quemaría un número para
     *     anular nada.
     *   · 'sent' todavía no se sabe: Factus V2 valida asíncrono y el número y el
     *     CUFE llegan minutos después. La nota crédito referencia la factura por
     *     su NÚMERO, que en ese momento puede no existir.
     *   · 'queued' nunca salió, y 'void' ya está anulada.
     *   · una nota crédito no se anula con otra nota crédito.
     */
    const puedeAnular = inv.status === 'accepted' && !esNotaCredito;

    return (
        <>
            <TableRow className={esRechazada ? 'bg-destructive/5 border-b-0' : undefined}>
                <TableCell className="align-top">
                    <div className="flex items-center gap-1.5">
                        <span className={`font-mono text-sm ${anulada ? 'line-through text-muted-foreground' : ''}`}>
                            {inv.number ?? '—'}
                        </span>
                        {/* Etiqueta de tipo solo en las notas crédito: la tabla
                            se llama «Facturas emitidas» y una nota crédito con
                            su propio número y su propio CUFE, sin marca, se lee
                            como una factura más. */}
                        {esNotaCredito && (
                            <Badge
                                variant="outline"
                                className="gap-1 whitespace-nowrap px-1.5 py-0 text-[10px]"
                                title="Nota crédito: el documento que deja sin efecto una factura. Tiene su propia numeración."
                            >
                                <FileMinus2 className="h-3 w-3" /> Nota crédito
                            </Badge>
                        )}
                    </div>
                    {inv.cufe ? <CufeLine cufe={inv.cufe} /> : null}
                </TableCell>
                <TableCell className="align-top">
                    <Badge className={`gap-1 whitespace-nowrap ${st.cls}`} title={st.hint}>
                        <st.Icon className="h-3 w-3 shrink-0" /> {st.label}
                    </Badge>
                </TableCell>
                <TableCell className="align-top text-sm whitespace-nowrap">
                    {new Date(inv.validated_at ?? inv.created_at).toLocaleDateString('es-CO')}
                </TableCell>
                <TableCell className="align-top text-right font-semibold whitespace-nowrap">
                    {inv.total != null ? formatCurrency(Number(inv.total)) : '—'}
                </TableCell>
                <TableCell className="align-top text-right">
                    <div className="flex items-center justify-end gap-1">
                        {inv.public_url ? (
                            <Button size="sm" variant="ghost" asChild>
                                <a href={inv.public_url} target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-4 w-4 mr-1" /> Ver
                                </a>
                            </Button>
                        ) : null}
                        {puedeAnular && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={onAnular}
                                title="Emitir la nota crédito que deja esta factura sin efecto"
                            >
                                <Ban className="h-4 w-4 mr-1" /> Anular
                            </Button>
                        )}
                        {!inv.public_url && !puedeAnular && <span className="text-muted-foreground">—</span>}
                    </div>
                </TableCell>
            </TableRow>

            {mostrarDetalle && (
                <TableRow className={esRechazada ? 'bg-destructive/5 hover:bg-destructive/5' : 'hover:bg-transparent'}>
                    <TableCell colSpan={5} className="pt-0 pb-3">
                        <div className="space-y-1.5">
                            {/* El bloque del motivo se pinta solo si hay algo que
                                decir del PAC. Antes se pintaba siempre que la
                                sub-fila existiera, y ahora la sub-fila también
                                aparece por la anulación: sin esta condición, una
                                factura anulada limpiamente mostraría «el
                                proveedor no devolvió motivo» como si algo hubiera
                                fallado. */}
                            {(motivo || esRechazada) && (
                                <div className="flex items-start gap-2">
                                    <AlertCircle
                                        className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${esRechazada ? 'text-destructive' : 'text-muted-foreground'}`}
                                    />
                                    <p className={`text-xs leading-relaxed break-words ${esRechazada ? 'text-destructive' : 'text-muted-foreground'}`}>
                                        <span className="font-semibold">
                                            {esRechazada ? 'Motivo del rechazo: ' : 'Aviso del proveedor: '}
                                        </span>
                                        {motivo ?? 'el proveedor no devolvió motivo. Búscala en el portal del PAC por su código de referencia.'}
                                    </p>
                                </div>
                            )}

                            {/* Factura anulada → CON QUÉ nota crédito.
                                Los cuatro casos se distinguen a propósito, y la
                                diferencia entre «null» y «no vino el campo» no es
                                pedantería: si el endpoint todavía no devuelve la
                                columna, afirmar «no hay nota crédito» convertiría
                                una anulación real en un descarte local a los ojos
                                del contador. Cuando no sabemos, no se afirma. */}
                            {anulada && (
                                <div className="flex items-start gap-2">
                                    <Ban className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                                    <p className="text-xs leading-relaxed break-words text-muted-foreground">
                                        <span className="font-semibold">
                                            Anulada
                                            {inv.voided_at
                                                ? ` el ${new Date(inv.voided_at).toLocaleDateString('es-CO')}`
                                                : ''}
                                            {': '}
                                        </span>
                                        {notaCredito ? (
                                            <>
                                                la deja sin efecto la nota crédito{' '}
                                                <span className="font-mono">{notaCredito.number ?? '(sin número todavía)'}</span>
                                                {notaCredito.public_url ? (
                                                    <>
                                                        {' · '}
                                                        <a
                                                            href={notaCredito.public_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="underline underline-offset-2"
                                                        >
                                                            ver la nota crédito
                                                        </a>
                                                    </>
                                                ) : null}
                                            </>
                                        ) : inv.voided_by_invoice_id ? (
                                            'la nota crédito que la anuló no está en esta lista. Búscala en el portal del proveedor.'
                                        ) : inv.voided_by_invoice_id === null ? (
                                            'sin nota crédito. Es un descarte local: la factura nunca llegó a la DIAN, así que no había documento que anular ante ella.'
                                        ) : (
                                            'la nota crédito que la anuló no viene en esta lista todavía.'
                                        )}
                                        {inv.void_reason?.trim() ? (
                                            <>
                                                <br />
                                                <span className="font-semibold">Motivo: </span>
                                                {inv.void_reason.trim()}
                                            </>
                                        ) : null}
                                    </p>
                                </div>
                            )}

                            {/* Nota crédito → A QUÉ factura anuló. El camino
                                inverso importa igual: una nota crédito suelta en
                                la lista, con su número y su monto, se lee como
                                una factura negativa que nadie sabe de dónde
                                salió. */}
                            {esNotaCredito && (
                                <div className="flex items-start gap-2">
                                    <CornerUpLeft className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                                    <p className="text-xs leading-relaxed break-words text-muted-foreground">
                                        <span className="font-semibold">Nota crédito: </span>
                                        {facturaAnulada ? (
                                            <>
                                                deja sin efecto la factura{' '}
                                                <span className="font-mono">{facturaAnulada.number ?? '(sin número)'}</span>
                                                {facturaAnulada.total != null
                                                    ? ` por ${formatCurrency(Number(facturaAnulada.total))}`
                                                    : ''}
                                                .
                                            </>
                                        ) : (
                                            'no se pudo identificar en esta lista a qué factura corresponde. El documento que anula figura en el portal del proveedor.'
                                        )}
                                        {' '}Consumió un número del rango de notas crédito, que tampoco se recupera.
                                    </p>
                                </div>
                            )}

                            {inv.reference_code ? (
                                <div className="flex items-center gap-1 pl-[1.375rem]">
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                        Ref. {inv.reference_code}
                                    </span>
                                    <CopyButton value={inv.reference_code} label="código de referencia" />
                                </div>
                            ) : null}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}

// ─── Emisión por rango (backfill) ───────────────────────────────────────────

function BackfillCard({
    ownerType, ownerId, provider, anuladas, missing, missingLoading, missingError, onEmitted,
}: {
    ownerType: OwnerType;
    ownerId: string;
    provider: InvoiceProviderRow | null;
    /** Cuántas facturas de esta entidad están anuladas. Ver el aviso del resumen. */
    anuladas: number;
    missing: MissingBillingData | undefined;
    missingLoading: boolean;
    missingError: boolean;
    onEmitted: () => void;
}) {
    const { toast } = useToast();
    const inicial = mesEnCurso();
    const [from, setFrom] = useState(inicial.from);
    const [to, setTo] = useState(inicial.to);
    // Tope opcional. Vacío = todos los del rango. Sirve para emitir 1 primero y
    // ver qué contesta el PAC antes de quemar 107 números de la resolución.
    const [tope, setTope] = useState('');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [entendido, setEntendido] = useState(false);
    const [resultado, setResultado] = useState<BackfillInvoicesResult | null>(null);

    // La política del municipio del facturador cambia el veredicto de un pago
    // sin código DANE: 'fallback' (defecto) lo factura con el municipio de la
    // escuela, 'require' lo rechaza. El resumen tiene que mirarla o prometería
    // 107 documentos que el motor va a saltar.
    const municipalityRequired =
        String(provider?.config?.customer_municipality_policy ?? '').toLowerCase() === 'require';

    const resumen: RangeSummary = useMemo(
        () => summarizeRange(missing, from, to, { municipalityRequired }),
        [missing, from, to, municipalityRequired],
    );

    const rangoValido = !!from && !!to && from <= to;
    // El BFF rechaza rangos de más de un trimestre (`date_range_too_wide`). Se
    // valida acá para decirlo antes del clic y no con un 400 en un toast.
    const diasRango = rangoValido
        ? Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
        : 0;
    const rangoDemasiadoAncho = diasRango > BACKFILL_MAX_DAYS;
    const topeNum = tope.trim() ? Number(tope) : null;
    const topeValido = topeNum === null
        || (Number.isInteger(topeNum) && topeNum > 0 && topeNum <= BACKFILL_MAX_LIMIT);
    // Lo que REALMENTE se va a emitir: el tope del admin recorta, y el tope del
    // BFF (200 por llamada) recorta también. La confirmación tiene que decir
    // ESTE número, no el del rango completo.
    const aEmitir = Math.min(
        topeNum === null ? resumen.ready : Math.min(topeNum, resumen.ready),
        BACKFILL_MAX_LIMIT,
    );
    // Con más pendientes que el tope por llamada hay que correr varias veces.
    const necesitaVariasCorridas = resumen.ready > BACKFILL_MAX_LIMIT;
    // Se prorratea el monto cuando el tope recorta: con 107 emitibles y tope 1
    // no se puede afirmar "por $16,3M". Es un estimado y se dice que lo es.
    const montoAEmitir = resumen.ready > 0
        ? Math.round((resumen.readyAmount * aEmitir) / resumen.ready)
        : 0;

    const facturadorListo = !!provider && provider.enabled;
    const puedeEmitir = facturadorListo && rangoValido && !rangoDemasiadoAncho && topeValido
        && aEmitir > 0 && !missingLoading && !missingError;

    const mutation = useMutation({
        mutationFn: () => invoicingApi.backfill({
            ownerType,
            ownerId,
            from,
            to,
            limit: aEmitir,
        }),
        onSuccess: (r) => {
            setResultado(r);
            setConfirmOpen(false);
            setEntendido(false);
            toast({
                title: r.emitted > 0 ? `${r.emitted} factura(s) emitida(s)` : 'No se emitió ninguna factura',
                description: `Intentados ${r.attempted} · emitidos ${r.emitted} · saltados ${r.skipped} · fallidos ${r.failed}.`,
                variant: r.failed > 0 ? 'destructive' : undefined,
            });
            onEmitted();
        },
        onError: (err: any) => {
            setConfirmOpen(false);
            setEntendido(false);
            toast({
                title: 'No se pudo emitir',
                description: backfillErrorLabel(err),
                variant: 'destructive',
            });
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-primary" /> Emitir facturas de un periodo
                </CardTitle>
                <CardDescription>
                    El proceso automático solo mira los últimos {CRON_WINDOW_DAYS} días. Los pagos más
                    viejos —los que se registran a mano días después— <strong>no se facturan solos</strong>:
                    esta es la vía para emitirlos. Se puede correr dos veces sin miedo: los pagos que ya
                    tienen factura viva se saltan.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                {!provider ? (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                            No hay facturador conectado. Configúralo arriba antes de emitir.
                        </AlertDescription>
                    </Alert>
                ) : !provider.enabled ? (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                            El facturador está <strong>deshabilitado</strong>. Mientras siga así no se emite
                            nada, ni por acá ni automáticamente. Actívalo cuando el periodo esté listo para
                            facturar.
                        </AlertDescription>
                    </Alert>
                ) : !provider.sandbox ? (
                    <Alert variant="destructive">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                            {/* Esta advertencia decía «todavía no hay notas crédito
                                en la app». Ya hay — pero eso NO vuelve la emisión
                                reversible: anular gasta un segundo número, en otro
                                rango. Y si el rango de notas crédito no está
                                configurado, sigue sin haber vuelta atrás. */}
                            Facturador en <strong>producción</strong>: cada documento consume un número de tu
                            resolución DIAN.{' '}
                            {creditNoteRangeId(provider)
                                ? <>Deshacer una factura exige emitir una <strong>nota crédito</strong>, que gasta
                                    otro número de otro rango: corregir cuesta dos documentos, no cero.</>
                                : <><strong>No se puede deshacer:</strong> tu facturador no tiene rango de notas
                                    crédito, así que desde la app no hay forma de anular una factura mal emitida.</>}
                            {' '}Revisa el rango antes de emitir.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                            Facturador en <strong>modo pruebas</strong>: los documentos salen contra el
                            ambiente de pruebas del proveedor, no contra la DIAN.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="grid gap-2">
                        <Label htmlFor="bf-from">Desde (fecha de pago)</Label>
                        <Input id="bf-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="bf-to">Hasta</Label>
                        <Input id="bf-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="bf-tope">Emitir como máximo</Label>
                        <Input
                            id="bf-tope"
                            type="number"
                            min={1}
                            max={BACKFILL_MAX_LIMIT}
                            placeholder={resumen.ready > 0 ? `Todos (${Math.min(resumen.ready, BACKFILL_MAX_LIMIT)})` : 'Todos'}
                            value={tope}
                            onChange={(e) => setTope(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Vacío = todos los del rango. Pon <strong>1</strong> para probar con un documento
                            antes de emitir el resto.
                        </p>
                    </div>
                </div>

                {!rangoValido && (
                    <p className="text-xs text-destructive">La fecha «desde» tiene que ser anterior o igual a «hasta».</p>
                )}
                {rangoDemasiadoAncho && (
                    <p className="text-xs text-destructive">
                        El rango no puede pasar de {BACKFILL_MAX_DAYS} días (son {diasRango}). Emite mes por mes.
                    </p>
                )}
                {!topeValido && (
                    <p className="text-xs text-destructive">
                        El tope tiene que ser un entero entre 1 y {BACKFILL_MAX_LIMIT}.
                    </p>
                )}
                {necesitaVariasCorridas && (
                    <p className="text-xs text-muted-foreground">
                        Hay {resumen.ready} por emitir y el máximo por corrida es {BACKFILL_MAX_LIMIT}: se emiten{' '}
                        {BACKFILL_MAX_LIMIT} y hay que repetir el mismo rango hasta que no queden. Los ya
                        emitidos se saltan solos.
                    </p>
                )}

                {/* Resumen del rango. Sale del mismo cálculo que el panel de datos
                    faltantes (react-query deduplica), así que las dos pantallas no
                    pueden dar números distintos del mismo mes. */}
                {missingError ? (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                            No se pudo calcular qué hay por emitir en este rango. <strong>No emitas a ciegas:</strong>{' '}
                            sin ese número no hay forma de saber cuántos documentos se van a generar.
                        </AlertDescription>
                    </Alert>
                ) : missingLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Calculando qué hay por emitir…
                    </div>
                ) : (
                    <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                            <span className="font-semibold">{resumen.ready}</span>
                            <span>documento(s) por emitir en el rango ·</span>
                            <span className="font-semibold">{formatCurrency(resumen.readyAmount)}</span>
                        </div>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                            {resumen.missingFiscal > 0 && (
                                <li>
                                    Se saltan <strong>{resumen.missingFiscal}</strong> pago(s) por{' '}
                                    {formatCurrency(resumen.missingFiscalAmount)}: al pagador le falta documento o
                                    dirección. Se completan en «Datos fiscales faltantes».
                                </li>
                            )}
                            {resumen.noPayer > 0 && (
                                <li>
                                    Se saltan <strong>{resumen.noPayer}</strong> pago(s) por{' '}
                                    {formatCurrency(resumen.noPayerAmount)}: el cobro no tiene pagador vinculado.
                                    Eso se arregla en la ficha del atleta, no con el formulario fiscal.
                                </li>
                            )}
                            {resumen.missingMunicipality > 0 && (
                                <li>
                                    Se saltan <strong>{resumen.missingMunicipality}</strong> pago(s) por{' '}
                                    {formatCurrency(resumen.missingMunicipalityAmount)}: al pagador le falta el
                                    municipio con código DANE y este facturador está configurado para{' '}
                                    <strong>exigirlo</strong> en vez de sustituirlo.
                                </li>
                            )}
                            {resumen.readyWithMunicipalityFallback > 0 && (
                                <li className="text-amber-700 dark:text-amber-400">
                                    <strong>{resumen.readyWithMunicipalityFallback}</strong> de los que sí salen
                                    llevan el municipio de la <strong>escuela</strong> impreso, no el del pagador:
                                    su perfil no tiene código DANE. Se emiten igual, pero la ciudad queda
                                    equivocada en el documento.
                                </li>
                            )}
                            {resumen.ready === 0 && resumen.missingFiscal === 0 && resumen.noPayer === 0
                                && resumen.missingMunicipality === 0 && (
                                <li>No hay pagos cobrados sin factura en este rango.</li>
                            )}
                            {/* Una factura anulada devuelve su pago a esta cuenta:
                                el resumen considera «facturado» solo lo que tiene
                                factura en 'accepted' o 'sent'. Y volver a emitir
                                ese pago NO es emitirlo por primera vez — nuestro
                                código de referencia es el mismo documento para el
                                proveedor. Sin este renglón, el pago de la factura
                                que se acaba de anular se cuela en la próxima
                                corrida del rango sin que nadie lo haya pedido. */}
                            {anuladas > 0 && (
                                <li>
                                    Ojo: hay <strong>{anuladas}</strong> factura(s) anulada(s). El pago de una
                                    factura anulada vuelve a contarse acá como «por emitir», pero reemitirlo no es
                                    lo mismo que emitirlo por primera vez: para el proveedor es el mismo documento
                                    y puede devolver el que ya existe. Si anulaste para corregir, revisa con tu
                                    contador antes de emitir el rango completo.
                                </li>
                            )}
                        </ul>
                    </div>
                )}

                <Button disabled={!puedeEmitir || mutation.isPending} onClick={() => setConfirmOpen(true)}>
                    {mutation.isPending
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <Send className="mr-2 h-4 w-4" />}
                    Emitir {aEmitir > 0 ? `${aEmitir} documento(s)` : 'facturas del rango'}
                </Button>

                {resultado && <BackfillResultado r={resultado} />}
            </CardContent>

            {/* Confirmación explícita. Emitir sigue siendo irreversible aunque ya
                existan las notas crédito: cada documento quema un número de la
                resolución DIAN, y deshacerlo quema otro en el rango de notas
                crédito. El diálogo dice cuántos, por cuánto y en qué rango, y el
                botón no se habilita hasta que se marque la casilla. */}
            <AlertDialog open={confirmOpen} onOpenChange={(v) => { setConfirmOpen(v); if (!v) setEntendido(false); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            ¿Emitir {aEmitir} factura(s) por {formatCurrency(montoAEmitir)}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Fecha de pago entre {from} y {to}.
                            {topeNum !== null && topeNum < resumen.ready
                                ? ` Son ${aEmitir} de los ${resumen.ready} del rango por el tope que pusiste; el monto es un estimado proporcional.`
                                : ''}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-3 text-sm">
                        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            <li>
                                Cada documento consume un número de tu resolución DIAN y{' '}
                                <strong>ese número no se recupera</strong>.
                            </li>
                            {/* La copia vieja («no hay notas crédito en la app»)
                                dejó de ser cierta, pero la conclusión no cambia
                                tanto: anular no devuelve el número, gasta uno más.
                                Y sin rango de notas crédito configurado —el caso de
                                producción de Dynasty hoy— sigue sin haber ninguna
                                vía de deshacer desde la app. */}
                            {creditNoteRangeId(provider) ? (
                                <li>
                                    Una factura mal emitida <strong>no se borra</strong>: se anula con una nota
                                    crédito desde la lista de abajo, y esa nota consume otro número de tu rango de
                                    notas crédito.
                                </li>
                            ) : (
                                <li>
                                    <strong>Tu facturador no tiene rango de notas crédito:</strong> una factura mal
                                    emitida no se puede anular desde la app; se corrige por fuera, con tu contador.
                                </li>
                            )}
                            {resumen.readyWithMunicipalityFallback > 0 && (
                                <li className="text-amber-700 dark:text-amber-400">
                                    {resumen.readyWithMunicipalityFallback} saldrán con el municipio de la escuela
                                    porque su pagador no tiene código DANE. Si eso importa para tu contabilidad,
                                    cancela y complétalo primero.
                                </li>
                            )}
                            {provider && !provider.sandbox && (
                                <li className="text-destructive">
                                    El facturador está en <strong>producción</strong>: estos documentos son reales.
                                </li>
                            )}
                        </ul>

                        <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer">
                            <Checkbox
                                checked={entendido}
                                onCheckedChange={(v) => setEntendido(v === true)}
                                className="mt-0.5"
                            />
                            <span className="text-xs leading-relaxed">
                                Entiendo que esto emite {aEmitir} documento(s) ante el proveedor y{' '}
                                <strong>no se puede deshacer</strong>.
                            </span>
                        </label>
                    </div>

                    {/* Botones planos y no AlertDialogAction/Cancel a propósito:
                        AlertDialogAction cierra el diálogo en el clic, y acá el
                        diálogo tiene que quedarse abierto con el spinner hasta
                        que el BFF conteste — emitir 107 documentos no es
                        instantáneo, y cerrar antes deja al admin sin saber si
                        la corrida arrancó (y tentado a volver a apretar). */}
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={mutation.isPending}>
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={!entendido || mutation.isPending}
                            onClick={() => mutation.mutate()}
                        >
                            {mutation.isPending
                                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                : <Send className="mr-2 h-4 w-4" />}
                            Sí, emitir {aEmitir}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

/**
 * Resultado desglosado de la corrida.
 *
 * Los saltados y los fallidos se agrupan POR MOTIVO y no se listan pago por
 * pago: con 40 saltados por la misma razón, una lista de 40 líneas iguales
 * esconde el único fallido que sí necesita atención.
 */
function BackfillResultado({ r }: { r: BackfillInvoicesResult }) {
    const porMotivo = (outcome: 'skipped' | 'failed') => {
        const mapa = new Map<string, number>();
        for (const d of r.details) {
            if (d.outcome !== outcome) continue;
            const k = reasonLabel(d.reason);
            mapa.set(k, (mapa.get(k) ?? 0) + detailWeight(d.reason));
        }
        return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
    };

    const saltados = porMotivo('skipped');
    const fallidos = porMotivo('failed');
    // Avisos de las que SÍ se emitieron: típicamente que la factura salió con el
    // municipio del emisor. Se emitió, pero el documento dice otra ciudad.
    const avisos = r.details.flatMap((d) => d.warnings ?? []);

    return (
        <div className="rounded-lg border p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{r.emitted} emitida(s)</Badge>
                <Badge variant="secondary">{r.skipped} saltada(s)</Badge>
                <Badge variant={r.failed > 0 ? 'destructive' : 'outline'}>{r.failed} fallida(s)</Badge>
                <span className="text-xs text-muted-foreground">de {r.attempted} intentado(s)</span>
            </div>

            {/* El tope recortó: quedan pagos del rango sin tocar. Sin decirlo, el
                admin ve "40 emitidas" y da el mes por facturado. */}
            {r.truncated && (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                        El tope recortó la corrida: el rango tenía <strong>{r.scanned}</strong> pago(s) y
                        quedaron sin tocar. <strong>Vuelve a correr el mismo rango</strong> hasta que no
                        queden — los ya emitidos se saltan solos.
                    </AlertDescription>
                </Alert>
            )}

            {avisos.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        Emitidas con aviso ({avisos.length})
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                        Salieron, pero con algo que revisar. El caso típico: el pagador no tenía código
                        DANE y el documento lleva el municipio de la escuela.
                    </p>
                </div>
            )}

            {saltados.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs font-semibold">Por qué se saltaron</p>
                    <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                        {saltados.map(([motivo, n]) => (
                            <li key={motivo}><strong>{n}</strong> — {motivo}</li>
                        ))}
                    </ul>
                </div>
            )}

            {fallidos.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-destructive">Por qué fallaron</p>
                    <ul className="list-disc space-y-0.5 pl-5 text-xs text-destructive">
                        {fallidos.map(([motivo, n]) => (
                            <li key={motivo}><strong>{n}</strong> — {motivo}</li>
                        ))}
                    </ul>
                    <p className="text-[10px] text-muted-foreground">
                        Un fallo puede haber dejado la factura en «Rechazada» abajo, con el motivo que
                        devolvió el proveedor. Corrige el dato antes de reintentar el rango.
                    </p>
                </div>
            )}

            {r.details.length === 0 && r.attempted > 0 && (
                <p className="text-xs text-muted-foreground">
                    El proveedor no devolvió el detalle por documento de esta corrida.
                </p>
            )}
        </div>
    );
}

// ─── Dialog de configuración del facturador ─────────────────────────────────

function ProviderConfigDialog({
    open, onOpenChange, supported, existing, onSave,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    supported: string[];
    existing: InvoiceProviderRow | null;
    onSave: (body: {
        provider: string;
        credentials: Record<string, any>;
        config: Record<string, any>;
        sandbox: boolean;
        isDefault: boolean;
        enabled: boolean;
    }) => Promise<void>;
}) {
    const { toast } = useToast();
    const [provider, setProvider] = useState(existing?.provider ?? supported[0] ?? 'factus');
    const [sandbox, setSandbox] = useState(existing?.sandbox ?? true);
    // Credenciales (write-only: nunca vienen del backend; al editar se re-ingresan)
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    // Config
    const [numberingRangeId, setNumberingRangeId] = useState(
        existing?.config?.numbering_range_id != null ? String(existing.config.numbering_range_id) : '',
    );
    // Rango de NOTA CRÉDITO: otro rango, otro prefijo, otra resolución de la
    // DIAN. Se pide acá porque es el único dato que separa «se puede anular una
    // factura» de «no se puede», y hoy producción de Dynasty no lo tiene: sin
    // un campo donde anotarlo, el id que alguien cree en el portal del PAC no
    // tiene forma de llegar a la app.
    const [creditNoteRange, setCreditNoteRange] = useState(
        existing?.config?.[CREDIT_NOTE_RANGE_KEY] != null
            ? String(existing.config[CREDIT_NOTE_RANGE_KEY])
            : '',
    );
    const [municipalityId, setMunicipalityId] = useState(
        existing?.config?.default_municipality_id != null ? String(existing.config.default_municipality_id) : '',
    );
    const [taxExcluded, setTaxExcluded] = useState(existing?.config?.tax_excluded !== false);

    // El código DANE puede empezar en cero (05001 = Medellín, 08001 =
    // Barranquilla). No es una validación dura porque Factus v1 usa ids
    // internos de municipio (169 = Bogotá) en vez de DANE, y bloquear el
    // guardado dejaría esa configuración sin poder editarse.
    const municipioSospechoso = !!municipalityId && !/^\d{4,5}$/.test(municipalityId.trim());

    const mutation = useMutation({
        mutationFn: async () => {
            if (!clientId || !clientSecret || !username || !password) {
                throw new Error('Ingresa las 4 credenciales del facturador.');
            }
            if (!numberingRangeId) throw new Error('Ingresa el rango de numeración.');
            await onSave({
                provider,
                credentials: {
                    client_id: clientId.trim(),
                    client_secret: clientSecret.trim(),
                    username: username.trim(),
                    password,
                },
                config: {
                    numbering_range_id: Number(numberingRangeId),
                    // Se omite la clave si el campo está vacío en vez de mandar
                    // '' o 0: el BFF descarta lo que no sean dígitos, y un valor
                    // basura ahí sería peor que la ausencia — el PAC caería a su
                    // rango por defecto, que es el de FACTURAS, y gastaría un
                    // número de esa resolución en una nota crédito.
                    ...(creditNoteRange.trim() ? { [CREDIT_NOTE_RANGE_KEY]: Number(creditNoteRange) } : {}),
                    // STRING, no Number: `Number('05001')` da 5001 y al guardarlo
                    // se pierde el cero inicial del código DANE para siempre. Es
                    // el municipio que se imprime en toda factura cuyo pagador no
                    // tenga código propio, así que un dígito de menos manda todas
                    // las facturas del mes a la ciudad equivocada.
                    ...(municipalityId.trim() ? { default_municipality_id: municipalityId.trim() } : {}),
                    tax_excluded: taxExcluded,
                },
                sandbox,
                isDefault: true,
                enabled: true,
            });
        },
        onError: (err: any) => toast({ title: 'No se pudo guardar', description: err.message, variant: 'destructive' }),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Configurar facturador electrónico</DialogTitle>
                    <DialogDescription>
                        Las credenciales se guardan cifradas en el servidor y nunca se muestran. Al editar,
                        vuelve a ingresarlas para conservarlas.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Proveedor (PAC)</Label>
                            <Select value={provider} onValueChange={setProvider}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {supported.map((p) => (
                                        <SelectItem key={p} value={p} className="uppercase">{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border px-3">
                            <Label className="text-sm">Modo pruebas</Label>
                            <Switch checked={sandbox} onCheckedChange={setSandbox} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Client ID</Label>
                            <Input value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Client Secret</Label>
                            <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="off" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Usuario</Label>
                            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Contraseña</Label>
                            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Rango de numeración (facturas)</Label>
                            <Input type="number" value={numberingRangeId} onChange={(e) => setNumberingRangeId(e.target.value)} placeholder="Ej. 8" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Rango de notas crédito</Label>
                            <Input
                                type="number"
                                value={creditNoteRange}
                                onChange={(e) => setCreditNoteRange(e.target.value)}
                                placeholder="Ej. 5225"
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Es un rango <strong>distinto</strong> del de facturas, con su propio prefijo y su
                                propia resolución. Créalo en el portal de tu proveedor y pega su id acá.{' '}
                                <strong>Sin esto no se puede anular ninguna factura.</strong>
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Municipio por defecto</Label>
                            {/* type="text", no "number": el código DANE es una
                                CADENA de dígitos, y un campo numérico invita a
                                tratarlo como número (que es justo lo que borra
                                el cero inicial). */}
                            <Input
                                type="text"
                                inputMode="numeric"
                                maxLength={5}
                                value={municipalityId}
                                onChange={(e) => setMunicipalityId(e.target.value.replace(/\D/g, ''))}
                                placeholder="Ej. 11001 · 05001"
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Código DANE, con su cero inicial si lo tiene (05001 = Medellín). Se imprime en
                                toda factura cuyo pagador no tenga código propio.
                            </p>
                            {municipioSospechoso && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                    Un código DANE tiene 4 o 5 dígitos. Si tu proveedor usa ids internos de
                                    municipio en vez de DANE, déjalo así.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div>
                            <Label className="text-sm">Servicios excluidos de IVA</Label>
                            <p className="text-xs text-muted-foreground">Típico en servicios deportivos/educativos.</p>
                        </div>
                        <Switch checked={taxExcluded} onCheckedChange={setTaxExcluded} />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
                    <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
