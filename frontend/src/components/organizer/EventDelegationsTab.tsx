import { useState, useEffect } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Building,
  Users,
  Trophy,
  DollarSign,
  Check,
  X,
  Clock,
} from 'lucide-react';

interface Delegation {
  id: string;
  school_id: string;
  school_name: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  team_count: number;
  athlete_count: number;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  draft: { variant: 'outline', label: 'Borrador' },
  pending_payment: { variant: 'outline', label: 'Pendiente Pago' },
  approved: { variant: 'default', label: 'Aprobada' },
  rejected: { variant: 'destructive', label: 'Rechazada' },
  cancelled: { variant: 'secondary', label: 'Cancelada' },
};

export default function EventDelegationsTab({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<{ delegation: Delegation; action: 'approve' | 'reject' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadDelegations();
  }, [eventId]);

  const loadDelegations = async () => {
    setLoading(true);
    try {
      const data = await bffClient.get<Delegation[]>(`/api/v1/events/${eventId}/delegations`);
      setDelegations(data);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!actionDialog) return;
    setActionLoading(true);
    try {
      const newStatus = actionDialog.action === 'approve' ? 'approved' : 'rejected';
      await bffClient.patch(`/api/v1/events/${eventId}/delegations/${actionDialog.delegation.id}`, { status: newStatus });
      setDelegations(prev =>
        prev.map(d => d.id === actionDialog.delegation.id ? { ...d, status: newStatus } : d)
      );
      toast({ title: actionDialog.action === 'approve' ? 'Delegación aprobada' : 'Delegación rechazada' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
      setActionDialog(null);
    }
  };

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const totalTeams = delegations.reduce((s, d) => s + d.team_count, 0);
  const totalAthletes = delegations.reduce((s, d) => s + d.athlete_count, 0);
  const totalRevenue = delegations.reduce((s, d) => s + Number(d.paid_amount || 0), 0);
  const pendingCount = delegations.filter(d => d.status === 'pending_payment' || d.status === 'draft').length;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Building className="h-4 w-4" />
              Escuelas
            </div>
            <p className="text-2xl font-bold">{delegations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Trophy className="h-4 w-4" />
              Equipos
            </div>
            <p className="text-2xl font-bold">{totalTeams}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="h-4 w-4" />
              Atletas
            </div>
            <p className="text-2xl font-bold">{totalAthletes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              Recaudado
            </div>
            <p className="text-2xl font-bold text-green-600">{formatPrice(totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Delegations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Delegaciones ({delegations.length})
          </CardTitle>
          <CardDescription>
            Escuelas inscritas en tu evento{pendingCount > 0 && ` — ${pendingCount} pendiente(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {delegations.length === 0 ? (
            <div className="text-center py-12">
              <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Sin delegaciones aún</h3>
              <p className="text-muted-foreground">Las escuelas podrán inscribirse cuando el evento esté publicado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Escuela</TableHead>
                    <TableHead className="text-center">Equipos</TableHead>
                    <TableHead className="text-center">Atletas</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {delegations.map((del) => {
                    const cfg = STATUS_CONFIG[del.status] || STATUS_CONFIG.draft;
                    const canApprove = del.status === 'pending_payment' || del.status === 'draft';
                    return (
                      <TableRow key={del.id}>
                        <TableCell className="font-medium">{del.school_name}</TableCell>
                        <TableCell className="text-center">{del.team_count}</TableCell>
                        <TableCell className="text-center">{del.athlete_count}</TableCell>
                        <TableCell className="text-right">{formatPrice(del.total_amount)}</TableCell>
                        <TableCell className="text-right">{formatPrice(del.paid_amount)}</TableCell>
                        <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(del.created_at).toLocaleDateString('es-CO')}
                        </TableCell>
                        <TableCell className="text-right">
                          {canApprove && (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-green-600"
                                onClick={() => setActionDialog({ delegation: del, action: 'approve' })}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-red-600"
                                onClick={() => setActionDialog({ delegation: del, action: 'reject' })}
                              >
                                <X className="h-3.5 w-3.5" />
                                Rechazar
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === 'approve' ? 'Aprobar delegación' : 'Rechazar delegación'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.action === 'approve'
                ? `¿Aprobar la delegación de ${actionDialog?.delegation.school_name}?`
                : `¿Rechazar la delegación de ${actionDialog?.delegation.school_name}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button
              variant={actionDialog?.action === 'approve' ? 'default' : 'destructive'}
              onClick={handleStatusChange}
              disabled={actionLoading}
            >
              {actionLoading ? 'Procesando...' : actionDialog?.action === 'approve' ? 'Aprobar' : 'Rechazar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
