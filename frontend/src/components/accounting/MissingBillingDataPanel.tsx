/**
 * MissingBillingDataPanel — "Datos fiscales faltantes".
 *
 * Responde la pregunta que hoy no tiene pantalla: ¿a quién le falta el dato
 * fiscal y cuánto dinero tengo sin facturar por eso? Lista los PAGADORES con
 * pagos cobrados y sin factura viva, agrupando por pagador el número de pagos y
 * el monto acumulado, con su contacto para perseguir el dato y un diálogo para
 * llenarlo ahí mismo (reutiliza BillingDetailsForm, que por dentro pasa por la
 * RPC admin_set_payer_billing_details).
 *
 * POR QUÉ se lee directo con el cliente de Supabase y no por el BFF: las
 * policies ya alcanzan. `payments` es legible por staff de la escuela
 * (`school_id = ANY(staff_school_ids())`), `electronic_invoices` por quien
 * maneja finanzas del dueño (`can_manage_finances`), y `profiles` /
 * `children` / `unregistered_athletes` por miembros de la misma escuela.
 * Verificado simulando la sesión del dueño de Dynasty: los 441 pagos y los 279
 * pagadores salen completos. No hace falta RPC nueva.
 *
 * EL CRITERIO de "falta el dato" es el del motor de facturación
 * (bff/src/services/invoicing.service.ts), no uno inventado acá:
 *
 *   · pagador  = `payment.parent_id || payment.user_id` — idéntico a
 *     emitInvoiceForPayment. Sin ninguno de los dos, el motor devuelve
 *     `payment_without_payer` y el formulario NO lo arregla.
 *   · documento = `loadCustomer` devuelve null si no hay `document_number`, y
 *     emitInvoiceForPayment corta con `customer_missing_fiscal_data`. Es el
 *     único bloqueo duro del lado del perfil.
 *   · dirección = el adaptador manda `address: ''` cuando falta, y el PAC la
 *     rechaza o la emite vacía. Bloquea en la práctica.
 *   · municipio = `billing_city_dane` sirve solo si es CÓDIGO DANE (4-5
 *     dígitos); con texto libre el adaptador cae al municipio de la ESCUELA y
 *     la factura sale con la ciudad equivocada. No bloquea la emisión, así que
 *     va aparte detrás de un interruptor: en bases con perfiles viejos es la
 *     mayoría de la lista y taparía lo que sí bloquea.
 */

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { BillingDetailsForm } from '@/components/billing/BillingDetailsForm';
import {
    AlertCircle, CheckCircle2, Loader2, Mail, Phone, RefreshCw, UserX, Pencil, MapPin,
} from 'lucide-react';

// ─── Tipos ──────────────────────────────────────────────────────────────────

/** Qué le falta al perfil. `document`/`address` bloquean; `municipality` deforma la factura. */
type MissingField = 'document' | 'address' | 'municipality';

interface PayerRow {
    kind: 'payer';
    key: string;
    payerId: string;
    name: string;
    email: string | null;
    phone: string | null;
    /** Cómo llega ese perfil al pago: acudiente (parent_id) o atleta adulto (user_id). */
    relation: 'parent' | 'athlete' | 'mixed';
    missing: MissingField[];
    /** true si falta documento y/o dirección → la factura no sale. */
    blocking: boolean;
    payments: number;
    amount: number;
    lastDate: string | null;
}

interface OrphanRow {
    kind: 'orphan';
    key: string;
    /** Atleta al que pertenece el cobro; no hay perfil pagador que llenar. */
    athleteName: string;
    payments: number;
    amount: number;
    lastDate: string | null;
}

type Row = PayerRow | OrphanRow;

interface MissingBillingData {
    rows: Row[];
    /** Pagos 'paid' sin factura viva cuyo pagador YA tiene documento y dirección: el motor los puede emitir. */
    invoiceablePayments: number;
    /** Total de pagos 'paid' sin factura viva que se revisaron. */
    scannedPayments: number;
}

// ─── Carga ──────────────────────────────────────────────────────────────────

const PAGE = 1000;
const DANE_CODE = /^\d{4,5}$/;

/** Trae TODOS los pagos cobrados de la escuela paginando: el tope de PostgREST
 *  (1000 filas) truncaría en silencio a una escuela grande, y una lista corta
 *  de más se lee como "no hay nada pendiente". */
async function fetchPaidPayments(schoolId: string) {
    const rows: Array<{
        id: string;
        amount: number;
        payment_date: string | null;
        parent_id: string | null;
        user_id: string | null;
        child_id: string | null;
        unregistered_athlete_id: string | null;
    }> = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
            .from('payments')
            .select('id, amount, payment_date, parent_id, user_id, child_id, unregistered_athlete_id')
            .eq('school_id', schoolId)
            .eq('status', 'paid')
            .range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...((data ?? []) as typeof rows));
        if (!data || data.length < PAGE) break;
    }
    return rows;
}

/** `.in()` con cientos de ids revienta la URL: se pide por tandas. */
async function fetchInChunks<T>(ids: string[], run: (chunk: string[]) => Promise<T[]>) {
    const out: T[] = [];
    for (let i = 0; i < ids.length; i += 200) {
        out.push(...(await run(ids.slice(i, i + 200))));
    }
    return out;
}

async function loadMissingBillingData(schoolId: string): Promise<MissingBillingData> {
    const pagos = await fetchPaidPayments(schoolId);

    // Facturas vivas: 'accepted' y 'sent' son las que emitInvoiceForPayment
    // considera ya emitidas y por las que devuelve temprano. 'queued' y
    // 'rejected' NO cuentan — ese pago sigue sin factura y se puede reintentar.
    const { data: invoices, error: invErr } = await supabase
        .from('electronic_invoices')
        .select('payment_id, status')
        .eq('owner_type', 'school')
        .eq('owner_id', schoolId)
        .not('payment_id', 'is', null)
        .in('status', ['accepted', 'sent']);
    if (invErr) throw invErr;
    const facturados = new Set((invoices ?? []).map((i) => i.payment_id as string));

    const pendientes = pagos.filter((p) => !facturados.has(p.id));

    const payerIds = [...new Set(
        pendientes.map((p) => p.parent_id || p.user_id).filter((v): v is string => !!v),
    )];
    const perfiles = await fetchInChunks(payerIds, async (chunk) => {
        const { data, error } = await supabase
            .from('profiles')
            // `document_type` no se pide: loadCustomer lo asume 'CC' cuando falta,
            // así que su ausencia no bloquea ni deforma la emisión.
            .select('id, full_name, email, phone, document_number, billing_address, billing_city_dane')
            .in('id', chunk);
        if (error) throw error;
        return data ?? [];
    });
    const perfilPorId = new Map(perfiles.map((p) => [p.id as string, p]));

    // Nombre del atleta para los pagos huérfanos: sin pagador no hay a quién
    // pedirle el dato, pero sí hay una ficha que arreglar.
    const huerfanos = pendientes.filter((p) => !p.parent_id && !p.user_id);
    const childIds = [...new Set(huerfanos.map((p) => p.child_id).filter((v): v is string => !!v))];
    const unregIds = [...new Set(huerfanos.map((p) => p.unregistered_athlete_id).filter((v): v is string => !!v))];
    const nombres = new Map<string, string>();
    if (childIds.length) {
        const hijos = await fetchInChunks(childIds, async (chunk) => {
            const { data, error } = await supabase.from('children').select('id, full_name').in('id', chunk);
            if (error) throw error;
            return data ?? [];
        });
        hijos.forEach((h) => nombres.set(h.id as string, (h.full_name as string) || 'Atleta sin nombre'));
    }
    if (unregIds.length) {
        const fichas = await fetchInChunks(unregIds, async (chunk) => {
            const { data, error } = await supabase.from('unregistered_athletes').select('id, full_name').in('id', chunk);
            if (error) throw error;
            return data ?? [];
        });
        fichas.forEach((f) => nombres.set(f.id as string, (f.full_name as string) || 'Atleta sin nombre'));
    }

    const porPagador = new Map<string, PayerRow>();
    const porAtleta = new Map<string, OrphanRow>();
    let invoiceablePayments = 0;

    for (const p of pendientes) {
        const monto = Number(p.amount) || 0;
        const payerId = p.parent_id || p.user_id;

        if (!payerId) {
            const refId = p.child_id || p.unregistered_athlete_id || p.id;
            const prev = porAtleta.get(refId);
            porAtleta.set(refId, {
                kind: 'orphan',
                key: `orphan:${refId}`,
                athleteName: nombres.get(refId) ?? 'Atleta sin identificar',
                payments: (prev?.payments ?? 0) + 1,
                amount: (prev?.amount ?? 0) + monto,
                lastDate: maxDate(prev?.lastDate ?? null, p.payment_date),
            });
            continue;
        }

        const perfil = perfilPorId.get(payerId);
        const missing: MissingField[] = [];
        // Un perfil que no aparece se trata como documento faltante: es lo que
        // el motor verá (loadCustomer no encuentra document_number) y así la
        // fila ofrece la acción que sí puede arreglarlo.
        if (!perfil || !String(perfil.document_number ?? '').trim()) missing.push('document');
        if (!perfil || !String(perfil.billing_address ?? '').trim()) missing.push('address');
        if (!perfil || !DANE_CODE.test(String(perfil.billing_city_dane ?? '').trim())) missing.push('municipality');

        const blocking = missing.includes('document') || missing.includes('address');
        // "Facturable" = el motor emitiría. El municipio sin código DANE no lo
        // impide (cae al de la escuela), así que ese pago cuenta como facturable
        // aunque su pagador aparezca en la lista con el aviso del municipio.
        if (!blocking) invoiceablePayments += 1;
        if (missing.length === 0) continue;

        const prev = porPagador.get(payerId);
        const relation: PayerRow['relation'] = p.parent_id ? 'parent' : 'athlete';
        porPagador.set(payerId, {
            kind: 'payer',
            key: `payer:${payerId}`,
            payerId,
            name: (perfil?.full_name as string) || 'Pagador sin nombre',
            email: (perfil?.email as string) ?? null,
            phone: (perfil?.phone as string) ?? null,
            relation: prev && prev.relation !== relation ? 'mixed' : relation,
            missing,
            blocking,
            payments: (prev?.payments ?? 0) + 1,
            amount: (prev?.amount ?? 0) + monto,
            lastDate: maxDate(prev?.lastDate ?? null, p.payment_date),
        });
    }

    // Primero lo que bloquea, y dentro de cada grupo lo más caro arriba: es la
    // lista de trabajo del admin, no un listado alfabético.
    const rows: Row[] = [...porPagador.values(), ...porAtleta.values()].sort((a, b) => {
        const sev = (r: Row) => (r.kind === 'orphan' ? 1 : r.blocking ? 0 : 2);
        return sev(a) - sev(b) || b.amount - a.amount;
    });

    return { rows, invoiceablePayments, scannedPayments: pendientes.length };
}

function maxDate(a: string | null, b: string | null) {
    if (!a) return b;
    if (!b) return a;
    return a > b ? a : b;
}

/** Compartido por el panel y el contador de la pestaña: react-query deduplica por queryKey. */
export function useMissingBillingData(schoolId: string | null | undefined) {
    return useQuery({
        queryKey: ['einv-missing-billing', schoolId],
        enabled: !!schoolId,
        queryFn: () => loadMissingBillingData(schoolId as string),
    });
}

/** Cuántas filas bloquean de verdad la facturación (lo que se muestra en la pestaña). */
export function countBlocking(data: MissingBillingData | undefined) {
    if (!data) return 0;
    return data.rows.filter((r) => r.kind === 'orphan' || r.blocking).length;
}

// ─── Etiquetas ──────────────────────────────────────────────────────────────

const MISSING_LABEL: Record<MissingField, string> = {
    document: 'Documento',
    address: 'Dirección',
    municipality: 'Municipio (sin código DANE)',
};

const RELATION_LABEL: Record<PayerRow['relation'], string> = {
    parent: 'Acudiente',
    athlete: 'Atleta adulto',
    mixed: 'Acudiente y atleta adulto',
};

// ─── Panel ──────────────────────────────────────────────────────────────────

export function MissingBillingDataPanel({ schoolId }: { schoolId: string }) {
    const queryClient = useQueryClient();
    const query = useMissingBillingData(schoolId);
    const [incluirMunicipio, setIncluirMunicipio] = useState(false);
    const [editing, setEditing] = useState<PayerRow | null>(null);

    const { visibles, soloMunicipio } = useMemo(() => {
        const todas = query.data?.rows ?? [];
        const soft = todas.filter((r) => r.kind === 'payer' && !r.blocking) as PayerRow[];
        return {
            visibles: incluirMunicipio ? todas : todas.filter((r) => r.kind === 'orphan' || r.blocking),
            soloMunicipio: soft,
        };
    }, [query.data, incluirMunicipio]);

    const totalPagos = visibles.reduce((acc, r) => acc + r.payments, 0);
    const totalMonto = visibles.reduce((acc, r) => acc + r.amount, 0);

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle>Datos fiscales faltantes</CardTitle>
                    <CardDescription>
                        Pagos ya cobrados que no se pueden facturar porque al pagador le falta un dato
                        obligatorio para la DIAN. Los pagos hechos por la app traen los datos completos;
                        los que se registran a mano (efectivo/transferencia) son los que suelen quedar así.
                    </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
                    {query.isFetching
                        ? <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        : <RefreshCw className="mr-2 h-3 w-3" />}
                    Actualizar
                </Button>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* El error se muestra: es dinero, y una tabla vacía por fallo de
                    consulta se lee como "no hay nada pendiente". */}
                {query.isError ? (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="flex flex-wrap items-center gap-2">
                            <span>
                                No se pudo calcular la lista: {(query.error as { message?: string })?.message ?? 'error desconocido'}.
                                <strong> No asumas que está todo en orden.</strong>
                            </span>
                            <Button size="sm" variant="outline" onClick={() => query.refetch()}>
                                <RefreshCw className="mr-2 h-3 w-3" /> Reintentar
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : query.isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/40 px-4 py-3">
                            <div className="text-sm">
                                <span className="font-semibold">{visibles.length}</span> caso(s) por resolver ·{' '}
                                <span className="font-semibold">{totalPagos}</span> pago(s) sin facturar ·{' '}
                                <span className="font-semibold text-destructive">{formatCurrency(totalMonto)}</span>
                                <span className="text-muted-foreground">
                                    {' '}(de {query.data?.scannedPayments ?? 0} pago(s) cobrados sin factura)
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="incluir-municipio"
                                    checked={incluirMunicipio}
                                    onCheckedChange={setIncluirMunicipio}
                                />
                                <Label htmlFor="incluir-municipio" className="text-xs cursor-pointer">
                                    Incluir municipio sin código DANE ({soloMunicipio.length})
                                </Label>
                            </div>
                        </div>

                        {/* El municipio en texto libre no impide emitir: el adaptador cae
                            al municipio de la escuela. Se avisa porque la factura sale
                            con la ciudad equivocada, pero no se mezcla con lo que bloquea. */}
                        {!incluirMunicipio && soloMunicipio.length > 0 && (
                            <Alert>
                                <MapPin className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                    Otros <strong>{soloMunicipio.length}</strong> pagadores tienen documento y dirección
                                    pero su municipio no está guardado como código DANE. La factura se emite igual, con
                                    el municipio de la escuela. Enciende el interruptor para verlos.
                                </AlertDescription>
                            </Alert>
                        )}

                        {visibles.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                                {/* Con el interruptor apagado puede haber pagadores sin código
                                    DANE: eso no bloquea, pero decir "todo el mundo tiene sus
                                    datos" con 200 municipios en texto libre sería mentir. */}
                                <p className="text-sm font-semibold">
                                    {soloMunicipio.length > 0
                                        ? 'Nada bloquea la facturación.'
                                        : 'Todo el mundo tiene sus datos fiscales.'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Los {query.data?.invoiceablePayments ?? 0} pago(s) cobrados y sin factura tienen un pagador
                                    con documento y dirección: se pueden facturar.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Pagador</TableHead>
                                            <TableHead>Qué falta</TableHead>
                                            <TableHead className="text-right">Pagos</TableHead>
                                            <TableHead className="text-right">Sin facturar</TableHead>
                                            <TableHead>Contacto</TableHead>
                                            <TableHead className="text-right">Acción</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {visibles.map((row) => row.kind === 'orphan' ? (
                                            <TableRow key={row.key} className="bg-amber-50/50 dark:bg-amber-900/10">
                                                <TableCell>
                                                    <div className="font-medium flex items-center gap-2">
                                                        <UserX className="h-4 w-4 text-amber-600 shrink-0" />
                                                        {row.athleteName}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">Cobro sin pagador vinculado</span>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                                                        No hay a quién facturarle
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">{row.payments}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="font-semibold">{formatCurrency(row.amount)}</div>
                                                    {row.lastDate && (
                                                        <span className="text-xs text-muted-foreground">
                                                            último {new Date(`${row.lastDate}T00:00:00`).toLocaleDateString('es-CO')}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">—</TableCell>
                                                <TableCell className="text-right text-xs text-muted-foreground max-w-[15rem]">
                                                    Esto no se arregla con el formulario: primero hay que vincular un
                                                    acudiente al atleta (o marcarlo como atleta adulto) en su ficha.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            <TableRow key={row.key}>
                                                <TableCell>
                                                    <div className="font-medium">{row.name}</div>
                                                    <span className="text-xs text-muted-foreground">{RELATION_LABEL[row.relation]}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {row.missing.map((m) => (
                                                            <Badge
                                                                key={m}
                                                                variant={m === 'municipality' ? 'secondary' : 'destructive'}
                                                            >
                                                                {MISSING_LABEL[m]}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">{row.payments}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="font-semibold">{formatCurrency(row.amount)}</div>
                                                    {row.lastDate && (
                                                        <span className="text-xs text-muted-foreground">
                                                            último {new Date(`${row.lastDate}T00:00:00`).toLocaleDateString('es-CO')}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-0.5 text-xs">
                                                        {row.phone ? (
                                                            <a href={`tel:${row.phone}`} className="flex items-center gap-1 hover:underline">
                                                                <Phone className="h-3 w-3 shrink-0" /> {row.phone}
                                                            </a>
                                                        ) : null}
                                                        {row.email ? (
                                                            <a href={`mailto:${row.email}`} className="flex items-center gap-1 hover:underline">
                                                                <Mail className="h-3 w-3 shrink-0" /> {row.email}
                                                            </a>
                                                        ) : null}
                                                        {!row.phone && !row.email && (
                                                            <span className="text-muted-foreground">Sin contacto registrado</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                                                        <Pencil className="mr-2 h-3 w-3" /> Completar datos
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </>
                )}
            </CardContent>

            <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Datos de facturación de {editing?.name}</DialogTitle>
                        <DialogDescription>
                            {editing
                                ? `${editing.payments} pago(s) por ${formatCurrency(editing.amount)} quedan facturables al guardar.`
                                : null}
                        </DialogDescription>
                    </DialogHeader>
                    {editing && (
                        <BillingDetailsForm
                            userId={editing.payerId}
                            schoolId={schoolId}
                            payerName={editing.name}
                            onComplete={() => {
                                setEditing(null);
                                queryClient.invalidateQueries({ queryKey: ['einv-missing-billing', schoolId] });
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
}
