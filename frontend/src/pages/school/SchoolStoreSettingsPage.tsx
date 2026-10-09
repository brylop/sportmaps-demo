/**
 * Tu tienda → Ajustes → Cobros (/tienda-escuela/ajustes)
 *
 * Donde la escuela (o el gimnasio) decide cómo le pagan y cómo entrega:
 *  - Transferencia: qué cuentas de la escuela se muestran. Las «Solo para
 *    inscripciones», apagadas o links de pago no son elegibles (la base las
 *    excluye: _store_school_accounts).
 *  - Efectivo al retirar (con el código de retiro).
 *  - Wompi / Mercado Pago de la escuela, solo si están conectados.
 *  - Entrega: solo retiro en sede o también envío; y en qué sedes se retira.
 *  - Compartir: enlace y QR descargable de la tienda.
 *
 * Lo administra el dueño o un administrador de la escuela, sea o no el dueño
 * del perfil (bug N0: se resuelve por escuela con useSchoolStore). La base
 * decide (store_admin_settings / set_store_payment_settings → can_manage_store).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Store, Loader2, Share2, Landmark, Banknote, CreditCard, Truck, MapPin, CheckCircle2, Clock, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useSchoolStore } from '@/hooks/useSchoolStore';
import { useStoreEnabled } from '@/hooks/useStoreEnabled';
import { supabase } from '@/integrations/supabase/client';
import { SchoolStoreActivationCard } from '@/components/vendor/SchoolStoreActivationCard';
import { ShareStoreDialog } from '@/components/vendor/ShareStoreDialog';
import {
    SCHOOL_PAYMENTS_CONFIG_PATH,
    accountReasonLabel,
    formFromAdminSettings,
    settingsPayload,
    storePublicUrl,
    storeSettingsErrorMessage,
    storeStatusMessage,
    validateStoreSettings,
    type StoreAdminSettings,
    type StoreSettingsForm,
} from '@/lib/store/schoolStore';

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
    breb: 'Bre-B', nequi: 'Nequi', daviplata: 'Daviplata', transfer_key: 'Llave', bank: 'Cuenta bancaria', payment_link: 'Link de pago',
};

function toggle(list: string[], id: string, on: boolean): string[] {
    return on ? Array.from(new Set([...list, id])) : list.filter(x => x !== id);
}

export default function SchoolStoreSettingsPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { enabled: storeEnabled, isLoading: flagLoading } = useStoreEnabled();
    const { store, isSchoolAdmin, isOpen, isLoading: storeLoading } = useSchoolStore();
    const [shareOpen, setShareOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<StoreSettingsForm | null>(null);

    const adminQuery = useQuery({
        queryKey: ['school-store-admin', store?.id],
        enabled: !!store?.id && isOpen,
        queryFn: async (): Promise<StoreAdminSettings> => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase.rpc as any)('store_admin_settings', { p_vendor_profile_id: store!.id });
            if (error) throw error;
            return data as StoreAdminSettings;
        },
    });
    const admin = adminQuery.data ?? null;

    useEffect(() => {
        if (admin) setForm(formFromAdminSettings(admin));
    }, [admin]);

    const publicUrl = useMemo(
        () => (admin?.store.slug ? storePublicUrl(window.location.origin, admin.store.slug) : null),
        [admin?.store.slug],
    );

    const patch = (p: Partial<StoreSettingsForm>) => setForm(f => (f ? { ...f, ...p } : f));

    const save = async () => {
        if (!form || !admin || !store) return;
        const invalid = validateStoreSettings(form, admin);
        if (invalid) {
            toast({ title: 'Revisa los cobros', description: invalid, variant: 'destructive' });
            return;
        }
        setSaving(true);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase.rpc as any)('set_store_payment_settings', {
                p_vendor_profile_id: store.id,
                p_settings: settingsPayload(form, admin),
            });
            if (error) {
                toast({ title: 'No se guardó', description: storeSettingsErrorMessage(error), variant: 'destructive' });
                return;
            }
            await queryClient.invalidateQueries({ queryKey: ['school-store-admin', store.id] });
            toast({ title: 'Cobros guardados', description: 'Tus compradores verán estos medios y esta forma de entrega.' });
        } finally {
            setSaving(false);
        }
    };

    // ── Estados previos ────────────────────────────────────────────────────
    if (flagLoading) return <Shell><Skeleton className="h-40 w-full" /></Shell>;
    if (!storeEnabled) {
        return (
            <Shell>
                <Card><CardContent className="p-6 text-sm text-muted-foreground">
                    La tienda todavía no está disponible en SportMaps. Te avisaremos cuando puedas abrir la tuya.
                </CardContent></Card>
            </Shell>
        );
    }
    if (storeLoading) return <Shell><Skeleton className="h-40 w-full" /></Shell>;
    if (!isSchoolAdmin) {
        return (
            <Shell>
                <Card><CardContent className="p-6 text-sm text-muted-foreground">
                    Los ajustes de la tienda los maneja el dueño o un administrador de la escuela.
                </CardContent></Card>
            </Shell>
        );
    }
    if (!isOpen) {
        return <Shell><SchoolStoreActivationCard /></Shell>;
    }
    if (adminQuery.isLoading || !form) {
        if (adminQuery.isError) {
            return (
                <Shell>
                    <Card><CardContent className="p-6 space-y-3 text-sm">
                        <p>No pudimos cargar los ajustes de tu tienda.</p>
                        <Button variant="outline" onClick={() => adminQuery.refetch()}>Reintentar</Button>
                    </CardContent></Card>
                </Shell>
            );
        }
        return <Shell><Skeleton className="h-64 w-full" /></Shell>;
    }

    const status = storeStatusMessage(admin!.status);
    const eligibleAccounts = admin!.accounts.filter(a => a.eligible);
    const otherAccounts = admin!.accounts.filter(a => !a.eligible);

    return (
        <Shell
            name={admin!.store.display_name}
            action={publicUrl ? (
                <Button variant="outline" className="gap-2" onClick={() => setShareOpen(true)}>
                    <Share2 className="h-4 w-4" /> Compartir tienda
                </Button>
            ) : null}
        >
            {/* Habilitación */}
            <div
                data-testid="store-status"
                className={`flex items-start gap-3 rounded-lg border p-4 ${status.tone === 'ok' ? 'border-primary/30 bg-primary/5' : 'bg-muted/40'}`}
            >
                {status.tone === 'ok'
                    ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                    : status.tone === 'wait'
                        ? <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
                        : <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />}
                <div className="min-w-0">
                    <p className="font-medium text-sm">{status.title}</p>
                    <p className="text-sm text-muted-foreground">{status.description}</p>
                    {status.tone === 'action' && admin!.status.addon === false && (
                        <Link to="/mi-plan?upsell=store" className="text-sm text-primary underline">Ir a Mi plan</Link>
                    )}
                </div>
            </div>

            {/* Cobros */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Cobros</CardTitle>
                    <CardDescription>Cómo te pagan los pedidos de la tienda. El dinero llega directo a las cuentas de tu escuela.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Transferencia */}
                    <section className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <Landmark className="mt-0.5 h-5 w-5 text-muted-foreground" />
                                <div>
                                    <Label htmlFor="acc-transfer" className="font-medium">Transferencia</Label>
                                    <p className="text-xs text-muted-foreground">El comprador transfiere y sube el comprobante; tú lo apruebas en Pedidos.</p>
                                </div>
                            </div>
                            <Switch
                                id="acc-transfer"
                                checked={form.acceptTransfer}
                                disabled={eligibleAccounts.length === 0}
                                onCheckedChange={v => patch({ acceptTransfer: v })}
                            />
                        </div>

                        {eligibleAccounts.length === 0 ? (
                            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                                Tu escuela no tiene cuentas que se puedan mostrar en la tienda.{' '}
                                <Link to={SCHOOL_PAYMENTS_CONFIG_PATH} className="text-primary underline">Agregar una cuenta</Link>
                            </p>
                        ) : form.acceptTransfer && (
                            <div className="space-y-3 pl-8">
                                <RadioGroup
                                    value={form.allAccounts ? 'all' : 'some'}
                                    onValueChange={v => patch({ allAccounts: v === 'all', accountIds: v === 'all' ? form.accountIds : (form.accountIds.length ? form.accountIds : eligibleAccounts.map(a => a.id)) })}
                                    className="gap-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem value="all" id="acc-all" />
                                        <Label htmlFor="acc-all" className="font-normal">Mostrar todas las cuentas disponibles (también las que agregues después)</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem value="some" id="acc-some" />
                                        <Label htmlFor="acc-some" className="font-normal">Elegir cuáles mostrar</Label>
                                    </div>
                                </RadioGroup>

                                <ul className="space-y-2" data-testid="store-accounts">
                                    {eligibleAccounts.map(a => {
                                        const checked = form.allAccounts || form.accountIds.includes(a.id);
                                        return (
                                            <li key={a.id} className="flex items-center gap-3 rounded-md border p-2.5">
                                                <Checkbox
                                                    id={`acc-${a.id}`}
                                                    checked={checked}
                                                    disabled={form.allAccounts}
                                                    onCheckedChange={v => patch({ accountIds: toggle(form.accountIds, a.id, v === true) })}
                                                    aria-label={`Mostrar ${a.label || ACCOUNT_TYPE_LABEL[a.type] || a.type}`}
                                                />
                                                <label htmlFor={`acc-${a.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-sm">
                                                    <span className="font-medium">{a.label || ACCOUNT_TYPE_LABEL[a.type] || a.type}</span>
                                                    <span className="text-muted-foreground">{ACCOUNT_TYPE_LABEL[a.type] ?? a.type} · {a.value_masked}</span>
                                                </label>
                                            </li>
                                        );
                                    })}
                                    {otherAccounts.map(a => (
                                        <li key={a.id} className="flex items-center gap-3 rounded-md border border-dashed p-2.5 opacity-70" data-testid="store-account-excluded">
                                            <Checkbox checked={false} disabled aria-label={`${a.label || a.type} no disponible`} />
                                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-sm">
                                                <span className="font-medium">{a.label || ACCOUNT_TYPE_LABEL[a.type] || a.type}</span>
                                                <Badge variant="outline" className="font-normal">{accountReasonLabel(a.reason)}</Badge>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-xs text-muted-foreground">
                                    Las cuentas se editan en <Link to={SCHOOL_PAYMENTS_CONFIG_PATH} className="text-primary underline">Pagos → Configuración</Link>.
                                    Una cuenta marcada «Solo para inscripciones» nunca aparece en la tienda.
                                </p>
                                <div className="space-y-1.5">
                                    <Label htmlFor="transfer-instructions" className="text-sm">Indicaciones para el comprador</Label>
                                    <Textarea
                                        id="transfer-instructions"
                                        maxLength={1000}
                                        rows={2}
                                        value={form.transferInstructions}
                                        onChange={e => patch({ transferInstructions: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Efectivo */}
                    <section className="flex items-start justify-between gap-4 border-t pt-5">
                        <div className="flex items-start gap-3">
                            <Banknote className="mt-0.5 h-5 w-5 text-muted-foreground" />
                            <div>
                                <Label htmlFor="acc-cash" className="font-medium">Efectivo al retirar</Label>
                                <p className="text-xs text-muted-foreground">El comprador paga en tu sede al recoger, con su código de retiro.</p>
                            </div>
                        </div>
                        <Switch id="acc-cash" checked={form.acceptCash} onCheckedChange={v => patch({ acceptCash: v })} />
                    </section>

                    {/* Pasarelas */}
                    <section className="space-y-3 border-t pt-5">
                        <div className="flex items-start gap-3">
                            <CreditCard className="mt-0.5 h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium text-sm">Tarjeta, PSE o Nequi en línea</p>
                                <p className="text-xs text-muted-foreground">Con la pasarela de tu escuela. El pago se confirma solo.</p>
                            </div>
                        </div>
                        {([
                            ['wompi', 'Wompi', admin!.gateways.wompi, form.acceptWompi, (v: boolean) => patch({ acceptWompi: v })],
                            ['mercadopago', 'Mercado Pago', admin!.gateways.mercadopago, form.acceptMercadoPago, (v: boolean) => patch({ acceptMercadoPago: v })],
                        ] as const).map(([key, name, connected, value, set]) => (
                            <div key={key} className="flex items-center justify-between gap-4 pl-8">
                                <div className="text-sm">
                                    <Label htmlFor={`acc-${key}`} className="font-normal">{name}</Label>
                                    {!connected && (
                                        <p className="text-xs text-muted-foreground">
                                            No está conectada. <Link to={SCHOOL_PAYMENTS_CONFIG_PATH} className="text-primary underline">Conectarla</Link>
                                        </p>
                                    )}
                                </div>
                                <Switch id={`acc-${key}`} checked={connected && value} disabled={!connected} onCheckedChange={set} />
                            </div>
                        ))}
                    </section>
                </CardContent>
            </Card>

            {/* Entrega */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Entrega</CardTitle>
                    <CardDescription>Cómo reciben los compradores lo que piden.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <RadioGroup
                        value={form.allowShipping ? 'shipping' : 'pickup'}
                        onValueChange={v => patch({ allowShipping: v === 'shipping' })}
                        className="gap-3"
                    >
                        <div className="flex items-start gap-3">
                            <RadioGroupItem value="pickup" id="ful-pickup" className="mt-0.5" />
                            <Label htmlFor="ful-pickup" className="font-normal">
                                <span className="font-medium">Solo retiro en sede</span>
                                <span className="block text-xs text-muted-foreground">El comprador recoge en tu sede con su código.</span>
                            </Label>
                        </div>
                        <div className="flex items-start gap-3">
                            <RadioGroupItem value="shipping" id="ful-shipping" className="mt-0.5" />
                            <Label htmlFor="ful-shipping" className="font-normal">
                                <span className="font-medium inline-flex items-center gap-1.5"><Truck className="h-4 w-4" /> Retiro en sede y envío a domicilio</span>
                                <span className="block text-xs text-muted-foreground">El envío se cobra según el departamento. El pago en efectivo sigue siendo solo al retirar.</span>
                            </Label>
                        </div>
                    </RadioGroup>

                    {admin!.branches.length > 1 && (
                        <div className="space-y-2 border-t pt-4">
                            <p className="flex items-center gap-2 text-sm font-medium"><MapPin className="h-4 w-4" /> Sedes de retiro</p>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="br-all"
                                    checked={form.allBranches}
                                    onCheckedChange={v => patch({ allBranches: v === true, branchIds: v === true ? admin!.branches.map(b => b.id) : form.branchIds })}
                                />
                                <Label htmlFor="br-all" className="font-normal">Todas las sedes</Label>
                            </div>
                            {!form.allBranches && (
                                <ul className="space-y-2 pl-6">
                                    {admin!.branches.map(b => (
                                        <li key={b.id} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`br-${b.id}`}
                                                checked={form.branchIds.includes(b.id)}
                                                onCheckedChange={v => patch({ branchIds: toggle(form.branchIds, b.id, v === true) })}
                                            />
                                            <Label htmlFor={`br-${b.id}`} className="font-normal">
                                                {b.name}{b.is_main ? ' (principal)' : ''}
                                                {b.address && <span className="block text-xs text-muted-foreground">{b.address}</span>}
                                            </Label>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                    {admin!.branches.length === 1 && (
                        <p className="flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" /> Se retira en {admin!.branches[0].name}{admin!.branches[0].address ? ` · ${admin!.branches[0].address}` : ''}
                        </p>
                    )}
                </CardContent>
            </Card>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {publicUrl && (
                    <Button asChild variant="ghost" className="gap-2">
                        <a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Ver mi tienda</a>
                    </Button>
                )}
                <Button onClick={save} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar cambios
                </Button>
            </div>

            {publicUrl && (
                <ShareStoreDialog
                    open={shareOpen}
                    onOpenChange={setShareOpen}
                    publicUrl={publicUrl}
                    displayName={admin!.store.display_name || 'Tu tienda'}
                />
            )}
        </Shell>
    );
}

function Shell({ children, name, action }: { children: ReactNode; name?: string | null; action?: ReactNode }) {
    return (
        <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Store className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Tu tienda{name ? ` · ${name}` : ''}</p>
                        <h1 className="text-2xl font-bold">Ajustes de cobros y entrega</h1>
                    </div>
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}
