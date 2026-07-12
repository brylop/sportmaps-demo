/**
 * InvoicingTab — pestaña de Facturación Electrónica dentro de Contabilidad.
 *
 * Parametrizada por dueño (ownerType/ownerId) → sirve igual para school,
 * vendor (coach/tienda/wellness) y organizer. Toda la I/O pasa por el BFF
 * (invoicingApi); las credenciales del PAC nunca se muestran.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { invoicingApi, OwnerType, InvoiceProviderRow } from '@/lib/api/invoicing';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
    FileText, Loader2, Plus, AlertCircle, RefreshCw, ExternalLink, CheckCircle2, Settings2,
} from 'lucide-react';

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
    accepted: { label: 'Aceptada', cls: 'bg-emerald-500 text-white' },
    sent:     { label: 'Enviada', cls: 'bg-blue-500 text-white' },
    queued:   { label: 'En cola', cls: 'bg-amber-500 text-white' },
    draft:    { label: 'Borrador', cls: 'bg-muted text-foreground' },
    rejected: { label: 'Rechazada', cls: 'bg-red-500 text-white' },
    void:     { label: 'Anulada', cls: 'bg-muted text-muted-foreground' },
};

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
    const invoices = invoicesQuery.data?.invoices ?? [];

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
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                            <FileText className="h-10 w-10 opacity-30" />
                            <p className="text-sm">Aún no has conectado un facturador. Configúralo para empezar a emitir facturas.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Facturas emitidas */}
            <Card>
                <CardHeader>
                    <CardTitle>Facturas emitidas</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
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
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Número</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.map((inv) => {
                                    const st = STATUS_STYLES[inv.status] ?? { label: inv.status, cls: 'bg-muted' };
                                    return (
                                        <TableRow key={inv.id}>
                                            <TableCell className="font-mono text-sm">{inv.number ?? '—'}</TableCell>
                                            <TableCell><Badge className={st.cls}>{st.label}</Badge></TableCell>
                                            <TableCell className="text-sm">
                                                {new Date(inv.validated_at ?? inv.created_at).toLocaleDateString('es-CO')}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {inv.total != null ? formatCurrency(Number(inv.total)) : '—'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {inv.public_url ? (
                                                    <Button size="sm" variant="ghost" asChild>
                                                        <a href={inv.public_url} target="_blank" rel="noreferrer">
                                                            <ExternalLink className="h-4 w-4 mr-1" /> Ver
                                                        </a>
                                                    </Button>
                                                ) : '—'}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <ProviderConfigDialog
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
    const [municipalityId, setMunicipalityId] = useState(
        existing?.config?.default_municipality_id != null ? String(existing.config.default_municipality_id) : '',
    );
    const [taxExcluded, setTaxExcluded] = useState(existing?.config?.tax_excluded !== false);

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
                    ...(municipalityId ? { default_municipality_id: Number(municipalityId) } : {}),
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
                            <Label>Rango de numeración</Label>
                            <Input type="number" value={numberingRangeId} onChange={(e) => setNumberingRangeId(e.target.value)} placeholder="Ej. 8" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Municipio por defecto (id)</Label>
                            <Input type="number" value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)} placeholder="Ej. 169 (Bogotá)" />
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
