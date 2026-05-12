import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, X, Eye, CheckCircle2, Clock, AlertTriangle, Loader2 } from 'lucide-react';

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
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                        Moderación Marketplace
                    </h1>
                    <p className="text-sm text-muted-foreground">Revisa productos enviados por vendors no verificados.</p>
                </div>
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pending_review">Pendientes</SelectItem>
                        <SelectItem value="rejected">Rechazados</SelectItem>
                        <SelectItem value="active">Activos (revisados)</SelectItem>
                    </SelectContent>
                </Select>
            </header>

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
        </div>
    );
}
