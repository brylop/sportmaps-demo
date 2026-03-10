import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Package } from 'lucide-react';
import { useOfferings, Offering } from '@/hooks/useOfferings';
import { useToast } from '@/hooks/use-toast';

const OFFERING_TYPE_LABELS: Record<string, string> = {
    membership: 'Membresía',
    session_pack: 'Pack de Sesiones',
    court_booking: 'Reserva de Cancha',
    tournament: 'Torneo',
    single_session: 'Clase Suelta',
};

/**
 * Panel de gestión de Offerings para el Owner/Admin.
 * CRUD completo de offerings y sus planes.
 */
export function OfferingsManagement() {
    const { toast } = useToast();
    const { offerings, isLoading, createOffering, createPlan } = useOfferings();
    const [showCreate, setShowCreate] = useState(false);
    const [showCreatePlan, setShowCreatePlan] = useState<string | null>(null);

    // ── Create Offering form state
    const [newOffering, setNewOffering] = useState({
        name: '', description: '', offering_type: 'membership' as string, sport: '',
    });

    // ── Create Plan form state
    const [newPlan, setNewPlan] = useState({
        name: '', max_sessions: '', max_secondary_sessions: '0',
        duration_days: '30', price: '', auto_renew: false,
    });

    const handleCreateOffering = () => {
        createOffering.mutate(
            {
                name: newOffering.name,
                offering_type: newOffering.offering_type as Offering['offering_type'],
                description: newOffering.description || undefined,
                sport: newOffering.sport || undefined,
            },
            {
                onSuccess: () => {
                    toast({ title: 'Offering creado' });
                    setShowCreate(false);
                    setNewOffering({ name: '', description: '', offering_type: 'membership', sport: '' });
                },
                onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
            }
        );
    };

    const handleCreatePlan = (offeringId: string) => {
        createPlan.mutate(
            {
                offeringId,
                name: newPlan.name,
                max_sessions: newPlan.max_sessions ? parseInt(newPlan.max_sessions) : null,
                max_secondary_sessions: parseInt(newPlan.max_secondary_sessions) || 0,
                duration_days: parseInt(newPlan.duration_days) || 30,
                price: parseFloat(newPlan.price) || 0,
                auto_renew: newPlan.auto_renew,
            },
            {
                onSuccess: () => {
                    toast({ title: 'Plan creado' });
                    setShowCreatePlan(null);
                    setNewPlan({ name: '', max_sessions: '', max_secondary_sessions: '0', duration_days: '30', price: '', auto_renew: false });
                },
                onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
            }
        );
    };

    if (isLoading) {
        return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Offerings</h3>
                <Button onClick={() => setShowCreate(true)} size="sm">
                    <Plus className="h-4 w-4 mr-1" /> Nuevo Offering
                </Button>
            </div>

            {offerings.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Package className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground">No hay offerings configurados.</p>
                        <Button onClick={() => setShowCreate(true)} variant="outline" className="mt-4" size="sm">
                            Crear primer offering
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                offerings.map((offering) => (
                    <OfferingCard
                        key={offering.id}
                        offering={offering}
                        onAddPlan={() => setShowCreatePlan(offering.id)}
                    />
                ))
            )}

            {/* Create Offering Modal */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nuevo Offering</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <Input placeholder="Nombre" value={newOffering.name} onChange={(e) => setNewOffering((p) => ({ ...p, name: e.target.value }))} />
                        <Select value={newOffering.offering_type} onValueChange={(v) => setNewOffering((p) => ({ ...p, offering_type: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(OFFERING_TYPE_LABELS).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input placeholder="Deporte (opcional)" value={newOffering.sport} onChange={(e) => setNewOffering((p) => ({ ...p, sport: e.target.value }))} />
                        <Textarea placeholder="Descripción (opcional)" value={newOffering.description} onChange={(e) => setNewOffering((p) => ({ ...p, description: e.target.value }))} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
                        <Button onClick={handleCreateOffering} disabled={!newOffering.name || createOffering.isPending}>
                            {createOffering.isPending ? 'Creando...' : 'Crear'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Plan Modal */}
            <Dialog open={!!showCreatePlan} onOpenChange={(o) => !o && setShowCreatePlan(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nuevo Plan</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <Input placeholder="Nombre del plan" value={newPlan.name} onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))} />
                        <Input placeholder="Máx. sesiones (vacío = ilimitado)" type="number" value={newPlan.max_sessions} onChange={(e) => setNewPlan((p) => ({ ...p, max_sessions: e.target.value }))} />
                        <Input placeholder="Máx. sesiones secundarias" type="number" value={newPlan.max_secondary_sessions} onChange={(e) => setNewPlan((p) => ({ ...p, max_secondary_sessions: e.target.value }))} />
                        <Input placeholder="Duración (días)" type="number" value={newPlan.duration_days} onChange={(e) => setNewPlan((p) => ({ ...p, duration_days: e.target.value }))} />
                        <Input placeholder="Precio" type="number" value={newPlan.price} onChange={(e) => setNewPlan((p) => ({ ...p, price: e.target.value }))} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreatePlan(null)}>Cancelar</Button>
                        <Button onClick={() => showCreatePlan && handleCreatePlan(showCreatePlan)} disabled={!newPlan.name || !newPlan.price || createPlan.isPending}>
                            {createPlan.isPending ? 'Creando...' : 'Crear Plan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function OfferingCard({ offering, onAddPlan }: { offering: Offering; onAddPlan: () => void }) {
    const plans = offering.offering_plans ?? [];

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-sm">{offering.name}</CardTitle>
                        <Badge variant="outline" className="text-[10px]">
                            {OFFERING_TYPE_LABELS[offering.offering_type] ?? offering.offering_type}
                        </Badge>
                        {offering.sport && (
                            <Badge variant="secondary" className="text-[10px]">{offering.sport}</Badge>
                        )}
                    </div>
                    <Badge variant={offering.is_active ? 'default' : 'secondary'}>
                        {offering.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                {offering.description && (
                    <p className="text-xs text-muted-foreground mb-3">{offering.description}</p>
                )}
                {plans.length > 0 && (
                    <div className="space-y-2 mb-3">
                        <p className="text-xs font-medium text-muted-foreground">Planes:</p>
                        {plans.map((plan) => (
                            <div key={plan.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/50">
                                <span className="font-medium">{plan.name}</span>
                                <div className="flex items-center gap-3">
                                    <span>{plan.max_sessions ? `${plan.max_sessions} sesiones` : 'Ilimitado'}</span>
                                    <span className="font-semibold">
                                        ${plan.price.toLocaleString()} {plan.currency}
                                    </span>
                                    <span className="text-muted-foreground">{plan.duration_days}d</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <Button variant="outline" size="sm" onClick={onAddPlan}>
                    <Plus className="h-3 w-3 mr-1" /> Agregar Plan
                </Button>
            </CardContent>
        </Card>
    );
}
