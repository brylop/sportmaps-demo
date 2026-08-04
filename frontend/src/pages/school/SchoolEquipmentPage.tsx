import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dumbbell, Plus, Settings, ClipboardCheck, Loader2, ChevronLeft, ChevronRight, Pencil, Trash2, Send,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { EntitlementGate } from '@/components/entitlements/EntitlementGate';
import { equipmentApi, type EquipmentItem, type EquipmentSettings } from '@/hooks/useEquipment';
import { EquipmentItemFormModal } from '@/components/equipment/EquipmentItemFormModal';
import { EquipmentAssignModal } from '@/components/equipment/EquipmentAssignModal';
import { EquipmentApprovalQueue } from '@/components/equipment/EquipmentApprovalQueue';
import { EquipmentSettingsDialog } from '@/components/equipment/EquipmentSettingsDialog';

const PAGE_SIZE = 50;
const ALL = '__all__';

function EquipmentInner({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();

  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [settings, setSettings] = useState<EquipmentSettings | null>(null);

  const [branchId, setBranchId] = useState<string>(ALL);
  const [status, setStatus] = useState<string>('active');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const [rows, setRows] = useState<EquipmentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Modales
  const [itemModal, setItemModal] = useState<{ open: boolean; item: EquipmentItem | null }>({ open: false, item: null });
  const [assignModal, setAssignModal] = useState<{ open: boolean; item: EquipmentItem | null }>({ open: false, item: null });
  const [queueOpen, setQueueOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Carga inicial de sedes + ajustes
  useEffect(() => {
    equipmentApi.listBranches(schoolId).then(setBranches).catch(() => setBranches([]));
    equipmentApi.getSettings(schoolId).then(setSettings).catch(() => setSettings(null));
  }, [schoolId, settingsOpen]);

  // Reset de página al cambiar filtros
  useEffect(() => { setPage(0); }, [branchId, status, search]);

  // Contador de pendientes (badge)
  const loadPending = useCallback(() => {
    equipmentApi.pendingApprovals(schoolId)
      .then((d) => setPendingCount((d.deliveries?.length ?? 0) + (d.returns?.length ?? 0)))
      .catch(() => setPendingCount(0));
  }, [schoolId]);
  useEffect(() => { loadPending(); }, [loadPending, refreshKey]);

  // Carga de ítems
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    equipmentApi.listItems({
      p_school_id: schoolId,
      p_branch_id: branchId === ALL ? null : branchId,
      p_status: status,
      p_search: search.trim() || null,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    })
      .then((res) => { if (!cancelled) { setRows(res.rows ?? []); setTotal(res.total ?? 0); } })
      .catch((e) => { if (!cancelled) { toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' }); setRows([]); setTotal(0); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [schoolId, branchId, status, search, page, refreshKey, toast]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  async function handleDeactivate(item: EquipmentItem) {
    if (!window.confirm(`¿Desactivar "${item.name}"? No se borra; queda archivado.`)) return;
    try {
      await equipmentApi.softDeleteItem(item.id);
      toast({ title: 'Ítem desactivado' });
      refresh();
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Dumbbell className="h-7 w-7 text-primary" /> Dotación e inventario
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Entrega indumentaria e implementos a tus entrenadores con acta de responsabilidad.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setQueueOpen(true)}>
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Aprobaciones
            {pendingCount > 0 && <Badge className="ml-2" variant="destructive">{pendingCount}</Badge>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4 mr-2" /> Ajustes
          </Button>
          <Button size="sm" onClick={() => setItemModal({ open: true, item: null })}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo ítem
          </Button>
        </div>
      </header>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Sede</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Archivados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="eq-search">Buscar</Label>
            <Input id="eq-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre del ítem…" />
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Sin ítems. Crea el primero con “Nuevo ítem”.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ítem</TableHead>
                  <TableHead>Talla</TableHead>
                  <TableHead>Disp. / Total</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Condición</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{it.size ?? '—'}</TableCell>
                    <TableCell>
                      <span className={it.quantity_available === 0 ? 'text-destructive font-medium' : ''}>
                        {it.quantity_available}
                      </span>
                      <span className="text-muted-foreground"> / {it.quantity_total}</span>
                    </TableCell>
                    <TableCell className="text-sm">{it.branch_name ?? 'Compartida'}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{it.condition}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" title="Asignar"
                        disabled={it.quantity_available === 0}
                        onClick={() => setAssignModal({ open: true, item: it })}>
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title="Editar"
                        onClick={() => setItemModal({ open: true, item: it })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title="Archivar"
                        onClick={() => handleDeactivate(it)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>{total} ítems</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>{page + 1} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modales */}
      <EquipmentItemFormModal
        open={itemModal.open}
        onOpenChange={(v) => setItemModal((s) => ({ ...s, open: v }))}
        schoolId={schoolId}
        branches={branches}
        item={itemModal.item}
        onSaved={refresh}
      />
      <EquipmentAssignModal
        open={assignModal.open}
        onOpenChange={(v) => setAssignModal((s) => ({ ...s, open: v }))}
        schoolId={schoolId}
        item={assignModal.item}
        branches={branches}
        settings={settings}
        onAssigned={() => { refresh(); loadPending(); }}
      />
      <EquipmentApprovalQueue
        open={queueOpen}
        onOpenChange={setQueueOpen}
        schoolId={schoolId}
        onChanged={refresh}
      />
      <EquipmentSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        schoolId={schoolId}
        onSaved={refresh}
      />
    </div>
  );
}

export default function SchoolEquipmentPage() {
  const { schoolId } = useSchoolContext();

  return (
    <EntitlementGate feature="equipment_module" fallback="inline">
      {schoolId ? (
        <EquipmentInner schoolId={schoolId} />
      ) : (
        <div className="container mx-auto p-6">
          <p className="text-muted-foreground">Selecciona una escuela para gestionar la dotación.</p>
        </div>
      )}
    </EntitlementGate>
  );
}
