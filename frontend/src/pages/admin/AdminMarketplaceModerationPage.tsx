import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, X, Eye, CheckCircle2, Clock, AlertTriangle, Loader2, FileText, ExternalLink, Package, Store } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ModerationProduct {
    id:                string;
    name:              string;
    description:       string;
    price:             number;
    image_url:         string | null;
    attributes:        Record<string, unknown>;
    status:            'pending_review' | 'active' | 'rejected' | 'draft' | 'archived';
    created_at:        string;
    vendor_profiles:   {
        id:                  string;
        display_name:        string;
        verification_status: 'pending' | 'verified' | 'rejected';
        city:                string | null;
    } | null;
    product_categories: { slug: string; name: string } | null;
}

export default function AdminMarketplaceModerationPage() {
    const { session } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    const [statusFilter, setStatusFilter] = useState<'pending_review' | 'rejected' | 'active'>('pending_review');
    const [selected, setSelected]         = useState<ModerationProduct | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejecting, setRejecting]       = useState(false);
    const [approving, setApproving]       = useState<string | null>(null);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['admin', 'moderation', statusFilter],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/api/v1/admin/marketplace/moderation-queue?status=${statusFilter}`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` },
            });
            if (!res.ok) throw new Error('Error cargando cola.');
            const json = await res.json();
            return { items: (json.data as ModerationProduct[]) || [], total: json.total };
        },
    });

    const approve = async (id: string) => {
        setApproving(id);
        try {
            const res = await fetch(`${API_URL}/api/v1/admin/products/${id}/approve`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session?.access_token}` },
            });
            const json = await res.json();
            if (!res.ok) {
                toast({ title: 'No se pudo aprobar', description: json.error, variant: 'destructive' });
                return;
            }
            toast({ title: 'Aprobado', description: 'Producto publicado al marketplace.' });
            qc.invalidateQueries({ queryKey: ['admin', 'moderation'] });
        } finally {
            setApproving(null);
        }
    };

    const submitReject = async () => {
        if (!selected) return;
        if (rejectReason.trim().length < 5) {
            toast({ title: 'Motivo muy corto', variant: 'destructive' });
            return;
        }
        setRejecting(true);
        try {
            const res = await fetch(`${API_URL}/api/v1/admin/products/${selected.id}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ reason: rejectReason }),
            });
            if (!res.ok) {
                const json = await res.json();
                toast({ title: 'Error rechazando', description: json.error, variant: 'destructive' });
                return;
            }
            toast({ title: 'Rechazado', description: 'Vendor notificado.' });
            setSelected(null);
            setRejectReason('');
            qc.invalidateQueries({ queryKey: ['admin', 'moderation'] });
        } finally {
            setRejecting(false);
        }
    };

    return (
        <div className="container mx-auto p-4 space-y-6">
            <header>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                    Moderación Marketplace
                </h1>
                <p className="text-sm text-muted-foreground">Revisa productos enviados y verifica identidad de vendors.</p>
            </header>

            <Tabs defaultValue="products" className="w-full">
                <TabsList>
                    <TabsTrigger value="products" className="flex items-center gap-2">
                        <Package className="h-4 w-4" /> Productos
                    </TabsTrigger>
                    <TabsTrigger value="vendors" className="flex items-center gap-2">
                        <Store className="h-4 w-4" /> Vendors pendientes
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="products" className="space-y-4 mt-4">
                    <div className="flex justify-end">
                        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pending_review">Pendientes</SelectItem>
                                <SelectItem value="rejected">Rechazados</SelectItem>
                                <SelectItem value="active">Activos (revisados)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : !data?.items?.length ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
                        <h3 className="font-semibold">No hay {statusFilter === 'pending_review' ? 'productos pendientes' : 'productos en este estado'}</h3>
                        <p className="text-sm text-muted-foreground">La cola está limpia.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {data.items.map(p => (
                        <Card key={p.id}>
                            <CardContent className="p-4">
                                <div className="flex gap-4">
                                    {p.image_url && (
                                        <img src={p.image_url} alt={p.name} className="h-24 w-24 rounded-lg object-cover bg-muted shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h3 className="font-semibold truncate">{p.name}</h3>
                                                <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    {p.product_categories && <Badge variant="outline" className="text-[10px]">{p.product_categories.name}</Badge>}
                                                    {p.vendor_profiles && (
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            {p.vendor_profiles.display_name}
                                                            {p.vendor_profiles.verification_status === 'verified' && ' ✓'}
                                                        </Badge>
                                                    )}
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {new Date(p.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-sm font-semibold shrink-0">${Number(p.price).toLocaleString('es-CO')}</span>
                                        </div>
                                        <div className="flex gap-2 mt-3">
                                            <Button size="sm" variant="outline" onClick={() => setSelected(p)}>
                                                <Eye className="h-4 w-4 mr-1" /> Ver
                                            </Button>
                                            {statusFilter === 'pending_review' && (
                                                <>
                                                    <Button size="sm" onClick={() => approve(p.id)} disabled={approving === p.id}>
                                                        {approving === p.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                                                        Aprobar
                                                    </Button>
                                                    <Button size="sm" variant="destructive" onClick={() => { setSelected(p); setRejectReason(''); }}>
                                                        <X className="h-4 w-4 mr-1" /> Rechazar
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Dialog de detalle / rechazo */}
            <Dialog open={!!selected} onOpenChange={o => { if (!o) { setSelected(null); setRejectReason(''); } }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            {statusFilter === 'pending_review' ? 'Revisar producto' : 'Detalle'}
                        </DialogTitle>
                    </DialogHeader>

                    {selected && (
                        <div className="space-y-3">
                            <div className="flex gap-3">
                                {selected.image_url && <img src={selected.image_url} alt={selected.name} className="h-32 w-32 rounded-lg object-cover" />}
                                <div className="flex-1">
                                    <h3 className="font-semibold">{selected.name}</h3>
                                    <p className="text-sm text-muted-foreground">{selected.description}</p>
                                    <p className="text-sm font-medium mt-2">${Number(selected.price).toLocaleString('es-CO')} COP</p>
                                </div>
                            </div>

                            {selected.attributes && Object.keys(selected.attributes).length > 0 && (
                                <div>
                                    <Label className="text-xs">Atributos</Label>
                                    <pre className="text-[10px] bg-muted/50 rounded p-2 overflow-x-auto">
                                        {JSON.stringify(selected.attributes, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {statusFilter === 'pending_review' && (
                                <div>
                                    <Label>Motivo de rechazo (si aplica)</Label>
                                    <Textarea
                                        rows={3}
                                        value={rejectReason}
                                        onChange={e => setRejectReason(e.target.value)}
                                        placeholder="Imagen de baja calidad, descripción incompleta, contenido no relacionado a deporte..."
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {statusFilter === 'pending_review' && (
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
                            <Button variant="destructive" onClick={submitReject} disabled={rejecting || rejectReason.length < 5}>
                                {rejecting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                                Rechazar
                            </Button>
                            <Button onClick={() => selected && approve(selected.id)} disabled={!selected || approving === selected?.id}>
                                {approving === selected?.id && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                                Aprobar y publicar
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
                </TabsContent>

                <TabsContent value="vendors" className="mt-4">
                    <VendorVerificationQueue />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor verification queue — admin revisa docs de identidad cargados.
// ─────────────────────────────────────────────────────────────────────────────

interface VendorVerificationItem {
    id:                  string;
    user_id:             string;
    display_name:        string;
    vendor_type:         string;
    capabilities:        { can_sell_products?: boolean; can_sell_services?: boolean };
    description:         string | null;
    city:                string | null;
    phone:               string | null;
    verification_status: 'pending' | 'verified' | 'rejected';
    verification_doc_url: string | null;
    is_active:           boolean;
    created_at:          string;
    profiles:            { id: string; full_name: string | null; email: string | null; role: string } | null;
}

type VendorFilter = 'pending_with_doc' | 'pending_no_doc' | 'verified' | 'rejected' | 'all';

function VendorVerificationQueue() {
    const { session } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    const [vendorFilter, setVendorFilter] = useState<VendorFilter>('pending_with_doc');
    const [selectedVendor, setSelectedVendor] = useState<VendorVerificationItem | null>(null);
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [loadingUrl, setLoadingUrl] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [processing, setProcessing] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['admin', 'vendors', 'verification', vendorFilter],
        queryFn: async () => {
            // Lectura directa via Supabase client. Requiere RLS
            // vendor_profiles_admin_read (migracion 20260512000006).
            // Hacemos dos queries simples en vez de un join — mas robusto
            // ante cambios en el nombre del FK constraint.
            let q = supabase
                .from('vendor_profiles')
                .select(`
                    id, user_id, display_name, vendor_type, capabilities, description,
                    city, phone, verification_status, verification_doc_url,
                    is_active, created_at
                `, { count: 'exact' })
                .order('created_at', { ascending: true });

            if (vendorFilter === 'pending_with_doc') {
                q = q.eq('verification_status', 'pending').not('verification_doc_url', 'is', null);
            } else if (vendorFilter === 'pending_no_doc') {
                q = q.eq('verification_status', 'pending').is('verification_doc_url', null);
            } else if (vendorFilter === 'verified') {
                q = q.eq('verification_status', 'verified');
            } else if (vendorFilter === 'rejected') {
                q = q.eq('verification_status', 'rejected');
            }

            const { data: rows, error, count } = await q;
            if (error) {
                console.error('verification-queue error:', error);
                return { items: [] as VendorVerificationItem[], total: 0 };
            }

            // Enriquecer con datos del profile (full_name, email, role) en una
            // segunda query — para no depender del nombre exacto del FK.
            const userIds = ((rows || []) as any[]).map(r => r.user_id).filter(Boolean);
            const profilesById = new Map<string, { id: string; full_name: string | null; email: string | null; role: string }>();
            if (userIds.length > 0) {
                const { data: profs } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, role')
                    .in('id', userIds);
                for (const p of (profs || []) as any[]) {
                    profilesById.set(p.id, p);
                }
            }

            const items: VendorVerificationItem[] = ((rows || []) as any[]).map(r => ({
                ...r,
                profiles: profilesById.get(r.user_id) || null,
            }));

            return { items, total: count || 0 };
        },
    });

    const openVendor = async (v: VendorVerificationItem) => {
        setSelectedVendor(v);
        setRejectReason('');
        setSignedUrl(null);
        if (v.verification_doc_url) {
            setLoadingUrl(true);
            try {
                // Extraer path desde la URL guardada (puede ser public URL legacy o solo path).
                const match = v.verification_doc_url.match(/vendor-docs\/(.+?)(?:\?|$)/);
                const filePath = match ? decodeURIComponent(match[1]) : v.verification_doc_url.split('/').pop();

                if (filePath) {
                    // El bucket es privado y la policy vendor_docs_admin_read deja
                    // que admins firmen URLs temporales directo desde el client.
                    const { data: signed, error } = await supabase.storage
                        .from('vendor-docs')
                        .createSignedUrl(filePath, 300); // 5 min
                    if (!error && signed) setSignedUrl(signed.signedUrl);
                }
            } finally {
                setLoadingUrl(false);
            }
        }
    };

    const verify = async (id: string, verified: boolean) => {
        setProcessing(true);
        try {
            const res = await fetch(`${API_URL}/api/v1/admin/vendors/${id}/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ verified, reason: !verified ? rejectReason : undefined }),
            });
            const json = await res.json();
            if (!res.ok) {
                toast({ title: 'Error', description: json.error, variant: 'destructive' });
                return;
            }
            toast({
                title: verified ? 'Vendor verificado' : 'Vendor rechazado',
                description: verified
                    ? 'El vendor aparecerá destacado en el marketplace.'
                    : 'Se notificó al vendor con el motivo.',
            });
            setSelectedVendor(null);
            setRejectReason('');
            qc.invalidateQueries({ queryKey: ['admin', 'vendors', 'verification'] });
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Select value={vendorFilter} onValueChange={(v: any) => setVendorFilter(v)}>
                    <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pending_with_doc">Pendientes con doc cargado</SelectItem>
                        <SelectItem value="pending_no_doc">Pendientes sin doc cargado</SelectItem>
                        <SelectItem value="verified">Verificados</SelectItem>
                        <SelectItem value="rejected">Rechazados</SelectItem>
                        <SelectItem value="all">Todos</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : !data?.items?.length ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
                        <h3 className="font-semibold">No hay vendors en este estado</h3>
                        <p className="text-sm text-muted-foreground">
                            {vendorFilter === 'pending_with_doc'
                                ? 'No hay vendors con documentos pendientes de revisar.'
                                : vendorFilter === 'pending_no_doc'
                                ? 'No hay vendors esperando subir documento.'
                                : 'La lista está vacía.'}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {data.items.map((v: VendorVerificationItem) => (
                        <Card key={v.id}>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold truncate">{v.display_name || '(sin nombre)'}</h3>
                                            <Badge
                                                variant={
                                                    v.verification_status === 'verified' ? 'default'
                                                    : v.verification_status === 'rejected' ? 'destructive'
                                                    : 'secondary'
                                                }
                                                className="text-[10px]"
                                            >
                                                {v.verification_status === 'verified' ? 'Verificado'
                                                    : v.verification_status === 'rejected' ? 'Rechazado'
                                                    : 'Pendiente'}
                                            </Badge>
                                            {v.verification_doc_url && (
                                                <Badge variant="outline" className="text-[10px]">
                                                    <FileText className="h-3 w-3 mr-1" /> Doc cargado
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {v.profiles?.email || '(sin email)'} · {v.profiles?.role} · {v.vendor_type}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-muted-foreground">
                                            {v.city && <span>{v.city}</span>}
                                            {v.phone && <span>· {v.phone}</span>}
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {new Date(v.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <Button size="sm" variant="outline" onClick={() => openVendor(v)}>
                                            <Eye className="h-4 w-4 mr-1" /> Revisar
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={!!selectedVendor} onOpenChange={o => { if (!o) { setSelectedVendor(null); setSignedUrl(null); setRejectReason(''); } }}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Store className="h-5 w-5 text-primary" />
                            Verificar vendor
                        </DialogTitle>
                    </DialogHeader>

                    {selectedVendor && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 text-sm">
                                <div>
                                    <Label className="text-xs">Negocio</Label>
                                    <p className="font-semibold">{selectedVendor.display_name}</p>
                                </div>
                                <div>
                                    <Label className="text-xs">Titular</Label>
                                    <p>{selectedVendor.profiles?.full_name || '—'}</p>
                                    <p className="text-xs text-muted-foreground">{selectedVendor.profiles?.email}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label className="text-xs">Rol</Label>
                                        <p>{selectedVendor.profiles?.role}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs">Tipo</Label>
                                        <p>{selectedVendor.vendor_type}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label className="text-xs">Ciudad</Label>
                                        <p>{selectedVendor.city || '—'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs">Teléfono</Label>
                                        <p>{selectedVendor.phone || '—'}</p>
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs">Capabilities</Label>
                                    <div className="flex gap-1 flex-wrap mt-1">
                                        {selectedVendor.capabilities?.can_sell_products && <Badge variant="outline">Productos</Badge>}
                                        {selectedVendor.capabilities?.can_sell_services && <Badge variant="outline">Servicios</Badge>}
                                    </div>
                                </div>
                                {selectedVendor.description && (
                                    <div>
                                        <Label className="text-xs">Descripción</Label>
                                        <p className="text-xs">{selectedVendor.description}</p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <Label className="text-xs">Documento de verificación</Label>
                                {loadingUrl ? (
                                    <div className="border rounded p-6 flex items-center justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : signedUrl ? (
                                    /\.(jpe?g|png)(\?|$)/i.test(signedUrl) ? (
                                        <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="block">
                                            <img src={signedUrl} alt="Doc" className="w-full max-h-80 object-contain border rounded" />
                                        </a>
                                    ) : (
                                        <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="border rounded p-6 flex items-center gap-2 hover:bg-muted">
                                            <FileText className="h-6 w-6 text-primary" />
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">Ver documento (PDF)</p>
                                                <p className="text-xs text-muted-foreground">Link temporal (5 min)</p>
                                            </div>
                                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                        </a>
                                    )
                                ) : (
                                    <div className="border border-dashed rounded p-6 text-center text-sm text-muted-foreground">
                                        Sin documento cargado
                                    </div>
                                )}
                                {selectedVendor.verification_status === 'pending' && (
                                    <div className="mt-3">
                                        <Label>Motivo de rechazo (si aplica)</Label>
                                        <Textarea
                                            rows={2}
                                            value={rejectReason}
                                            onChange={e => setRejectReason(e.target.value)}
                                            placeholder="Doc ilegible, no corresponde al titular, falsificado..."
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {selectedVendor?.verification_status === 'pending' && (
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSelectedVendor(null)}>Cancelar</Button>
                            <Button
                                variant="destructive"
                                onClick={() => verify(selectedVendor.id, false)}
                                disabled={processing || rejectReason.length < 5}
                            >
                                {processing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                                <X className="h-4 w-4 mr-1" />
                                Rechazar
                            </Button>
                            <Button onClick={() => verify(selectedVendor.id, true)} disabled={processing}>
                                {processing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Verificar
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
