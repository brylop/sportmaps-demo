import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { bffClient } from '@/lib/api/bffClient';
import type { PaymentProvider } from '@/types/payments';

interface ProviderRow {
    id: string;
    provider: PaymentProvider;
    public_key: string;
    sandbox: boolean;
    is_default: boolean;
    enabled: boolean;
    created_at: string;
    updated_at: string;
}

interface Props {
    /** Configurar providers de una escuela. Mutuamente excluyente con vendorId. */
    schoolId?: string;
    /** Configurar providers de un vendor. Mutuamente excluyente con schoolId. */
    vendorId?: string;
    /**
     * Se llama tras crear/editar/borrar o cambiar un toggle. Sirve para que el
     * gate de SportMaps Pay se entere de que ya hay cuenta conectada, sin que
     * la escuela tenga que recargar la página para poder prender el cobro.
     */
    onChange?: () => void;
}

/**
 * Admin UI para configurar providers de pago (Wompi / MercadoPago) por
 * escuela o vendor. El access_token y webhook_secret se envian al BFF
 * (que los persiste con service_role) y NUNCA se devuelven en GET.
 */
export function PaymentProvidersAdmin({ schoolId, vendorId, onChange }: Props) {
    const { toast } = useToast();
    const [rows, setRows] = useState<ProviderRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [openForm, setOpenForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const baseUrl = schoolId
        ? `/api/v1/payment-providers/school/${schoolId}`
        : `/api/v1/payment-providers/vendor/${vendorId}`;

    const loadRows = async () => {
        setLoading(true);
        try {
            const res = await bffClient.get<{ providers: ProviderRow[] }>(baseUrl);
            setRows(res.providers ?? []);
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (schoolId || vendorId) loadRows();
    }, [schoolId, vendorId]);

    /** Recarga y avisa hacia arriba. Solo tras mutaciones, no al montar. */
    const recargar = async () => {
        await loadRows();
        onChange?.();
    };

    const handleToggle = async (row: ProviderRow, field: 'enabled' | 'is_default') => {
        try {
            await bffClient.patch(`/api/v1/payment-providers/${row.id}`, {
                [field === 'is_default' ? 'isDefault' : 'enabled']: !row[field],
            });
            toast({ title: 'Actualizado', description: `${row.provider} ${field}` });
            await recargar();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    const handleDelete = async (row: ProviderRow) => {
        if (!confirm(`¿Eliminar la configuración de ${row.provider}?`)) return;
        try {
            await bffClient.delete(`/api/v1/payment-providers/${row.id}`);
            toast({ title: 'Eliminado' });
            await recargar();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Pasarelas de pago</h2>
                    <p className="text-sm text-muted-foreground">
                        Configura las cuentas de Wompi y/o MercadoPago. El dinero llega directo a tu cuenta merchant.
                    </p>
                </div>
                <Button onClick={() => { setEditingId(null); setOpenForm(true); }}>
                    Agregar pasarela
                </Button>
            </div>

            {loading && <p className="text-sm text-muted-foreground">Cargando...</p>}

            {!loading && rows.length === 0 && (
                <p className="text-sm text-muted-foreground border rounded p-4">
                    No hay pasarelas configuradas. Tus pagos online están desactivados.
                </p>
            )}

            <div className="space-y-2">
                {rows.map(row => (
                    <div key={row.id} className="flex items-center justify-between rounded border p-3">
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">
                                    {row.provider === 'wompi' ? 'Wompi' : 'MercadoPago'}
                                </span>
                                {row.is_default && <Badge variant="default">default</Badge>}
                                {row.sandbox && <Badge variant="secondary">sandbox</Badge>}
                                {!row.enabled && <Badge variant="destructive">deshabilitado</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 font-mono break-all">
                                {row.public_key.slice(0, 24)}...
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-xs">
                                <Label htmlFor={`enabled-${row.id}`} className="text-xs">Activo</Label>
                                <Switch
                                    id={`enabled-${row.id}`}
                                    checked={row.enabled}
                                    onCheckedChange={() => handleToggle(row, 'enabled')}
                                />
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                                <Label htmlFor={`default-${row.id}`} className="text-xs">Default</Label>
                                <Switch
                                    id={`default-${row.id}`}
                                    checked={row.is_default}
                                    onCheckedChange={() => handleToggle(row, 'is_default')}
                                />
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setEditingId(row.id); setOpenForm(true); }}
                            >
                                Editar
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600"
                                onClick={() => handleDelete(row)}
                            >
                                Eliminar
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            <ProviderForm
                open={openForm}
                onClose={() => setOpenForm(false)}
                onSaved={async () => { setOpenForm(false); await recargar(); }}
                baseUrl={baseUrl}
                editing={editingId ? rows.find(r => r.id === editingId) ?? null : null}
            />
        </div>
    );
}

// ─── Form modal ────────────────────────────────────────────────────────────

interface FormProps {
    open: boolean;
    onClose: () => void;
    onSaved: () => Promise<void>;
    baseUrl: string;
    editing: ProviderRow | null;
}

function ProviderForm({ open, onClose, onSaved, baseUrl, editing }: FormProps) {
    const { toast } = useToast();
    const [provider, setProvider] = useState<PaymentProvider>('mercadopago');
    const [publicKey, setPublicKey] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [webhookSecret, setWebhookSecret] = useState('');
    const [integritySecret, setIntegritySecret] = useState('');
    // Wompi pide cuatro llaves, no dos: la privada y el events_secret son
    // obligatorias para el BFF (SchoolProviderSchema, rama 'wompi').
    const [privateKey, setPrivateKey] = useState('');
    const [eventsSecret, setEventsSecret] = useState('');
    const [sandbox, setSandbox] = useState(true);
    const [isDefault, setIsDefault] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    /** Los secretos de ESCUELA solo se pueden guardar cifrados, vía POST. */
    const esEscuela = baseUrl.includes('/school/');

    useEffect(() => {
        if (editing) {
            setProvider(editing.provider);
            setPublicKey(editing.public_key);
            setAccessToken('');                          // nunca devolvemos el actual
            setWebhookSecret('');
            setIntegritySecret('');
            setPrivateKey('');
            setEventsSecret('');
            setSandbox(editing.sandbox);
            setIsDefault(editing.is_default);
        } else {
            setProvider('mercadopago');
            setPublicKey('');
            setAccessToken('');
            setWebhookSecret('');
            setIntegritySecret('');
            setPrivateKey('');
            setEventsSecret('');
            setSandbox(true);
            setIsDefault(false);
        }
    }, [editing, open]);

    const handleSubmit = async () => {
        // Wompi exige las cuatro llaves; MercadoPago, public + access token.
        const faltantes = provider === 'wompi'
            ? [
                !publicKey && 'llave pública',
                !privateKey && 'llave privada',
                !integritySecret && 'secreto de integridad',
                !eventsSecret && 'secreto de eventos',
            ].filter(Boolean)
            : [
                !publicKey && 'llave pública',
                !accessToken && 'access token',
            ].filter(Boolean);

        if (faltantes.length) {
            toast({
                title: 'Faltan datos',
                description: `Wompi no acepta credenciales parciales. Falta: ${faltantes.join(', ')}.`,
                variant: 'destructive',
            });
            return;
        }

        setSubmitting(true);
        try {
            const body = provider === 'wompi'
                ? {
                    provider,
                    publicKey,
                    privateKey,
                    integritySecret,
                    eventsSecret,
                    sandbox,
                    isDefault,
                    enabled: true,
                }
                : {
                    provider,
                    publicKey,
                    accessToken,
                    webhookSecret: webhookSecret || undefined,
                    sandbox,
                    isDefault,
                    enabled: true,
                };

            // Reemplazar las llaves de una escuela va por POST, que las cifra y
            // usa la RPC transaccional. El PATCH rechaza secretos de escuela
            // (code 'use_encrypted_upsert') porque irían en claro a columnas
            // legacy que el resolver ya no lee → checkout bloqueado.
            if (editing && !esEscuela) {
                await bffClient.patch(`/api/v1/payment-providers/${editing.id}`, body);
            } else {
                await bffClient.post(baseUrl, body);
            }
            toast({ title: 'Guardado' });
            await onSaved();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{editing ? 'Editar' : 'Agregar'} pasarela</DialogTitle>
                    <DialogDescription>
                        Las credenciales se almacenan en el servidor. Solo el public_key se devuelve.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div>
                        <Label>Pasarela</Label>
                        <select
                            disabled={!!editing}
                            value={provider}
                            onChange={e => setProvider(e.target.value as PaymentProvider)}
                            className="w-full rounded border px-3 py-2"
                        >
                            <option value="mercadopago">MercadoPago</option>
                            <option value="wompi">Wompi</option>
                        </select>
                    </div>

                    <div>
                        <Label>Llave pública</Label>
                        <Input
                            value={publicKey}
                            onChange={e => setPublicKey(e.target.value)}
                            placeholder={provider === 'mercadopago' ? 'APP_USR-... o TEST-...' : 'pub_test_... o pub_prod_...'}
                        />
                    </div>

                    {provider === 'wompi' ? (
                        <>
                            {/* Las cuatro llaves de Wompi van juntas: el BFF no
                                acepta credenciales parciales, y guardar la mitad
                                dejaría el checkout bloqueado por fail-closed. */}
                            <div>
                                <Label>Llave privada</Label>
                                <Input
                                    type="password"
                                    value={privateKey}
                                    onChange={e => setPrivateKey(e.target.value)}
                                    placeholder="prv_test_... o prv_prod_..."
                                />
                            </div>

                            <div>
                                <Label>Secreto de integridad</Label>
                                <Input
                                    type="password"
                                    value={integritySecret}
                                    onChange={e => setIntegritySecret(e.target.value)}
                                    placeholder="test_integrity_... o prod_integrity_..."
                                />
                            </div>

                            <div>
                                <Label>Secreto de eventos</Label>
                                <Input
                                    type="password"
                                    value={eventsSecret}
                                    onChange={e => setEventsSecret(e.target.value)}
                                    placeholder="test_events_... o prod_events_..."
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <Label>Access Token</Label>
                                <Input
                                    type="password"
                                    value={accessToken}
                                    onChange={e => setAccessToken(e.target.value)}
                                    placeholder="APP_USR-... o TEST-..."
                                />
                            </div>

                            <div>
                                <Label>Webhook Secret</Label>
                                <Input
                                    type="password"
                                    value={webhookSecret}
                                    onChange={e => setWebhookSecret(e.target.value)}
                                    placeholder="Opcional pero recomendado en producción"
                                />
                            </div>
                        </>
                    )}

                    {editing && esEscuela && (
                        <p className="text-xs text-muted-foreground">
                            Las llaves no se pueden ver, solo reemplazar: escríbelas
                            completas para actualizarlas.
                        </p>
                    )}

                    <div className="flex items-center justify-between">
                        <Label htmlFor="sandbox-toggle">Sandbox</Label>
                        <Switch id="sandbox-toggle" checked={sandbox} onCheckedChange={setSandbox} />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="default-toggle">Marcar como default</Label>
                        <Switch id="default-toggle" checked={isDefault} onCheckedChange={setIsDefault} />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Guardando...' : 'Guardar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default PaymentProvidersAdmin;
