import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Building2, MapPin, Trash2, Users, Calendar, Clock,
  CheckCircle2, XCircle, Eye, Pencil, Ban, MoreHorizontal, CalendarCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSchoolFacilities } from '@/hooks/useSchoolData';
import { useFacilityReservations } from '@/hooks/useFacilityReservations';
import type { FacilityReservation } from '@/hooks/useFacilityReservations';
import { FacilityFormDialog } from '@/components/school/FacilityFormDialog';
import { OwnerReservationModal } from '@/components/school/OwnerReservationModal';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Status helpers (Improved for Dark Mode) ──────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Completada',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/20',
  confirmed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20',
  cancelled: 'bg-rose-500/10 text-rose-600 dark:text-rose-500 border-rose-500/20',
  completed: 'bg-blue-500/10 text-blue-600 dark:text-blue-500 border-blue-500/20',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5 mr-1.5" />,
  confirmed: <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />,
  cancelled: <XCircle className="h-3.5 w-3.5 mr-1.5" />,
  completed: <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />,
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`text-[11px] font-bold py-0.5 flex items-center w-fit shadow-sm backdrop-blur-[2px] ${STATUS_COLORS[status] ?? ''}`}>
      {STATUS_ICONS[status]}
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

// ─── Reservation detail modal ─────────────────────────────────────────────────

function ReservationDetailModal({
  reservation,
  onClose,
  onApprove,
  onCancel,
}: {
  reservation: FacilityReservation;
  onClose: () => void;
  onApprove: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card text-card-foreground border-border/40 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Detalle de Reserva</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-lg">
                {reservation.requester?.full_name ?? reservation.requester?.email ?? 'Usuario'}
              </p>
              <StatusBadge status={reservation.status} />
            </div>
            {reservation.facility && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                <Building2 className="h-4 w-4 text-primary" />
                <span>{reservation.facility.name}</span>
                <span className="text-xs opacity-40">|</span>
                <span className="text-xs uppercase tracking-wider">{reservation.facility.type}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6 text-sm">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Fecha</p>
              <p className="font-bold">
                {format(parseISO(reservation.reservation_date), 'PPP', { locale: es })}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Horario</p>
              <p className="font-bold flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                {reservation.start_time.slice(0, 5)} — {reservation.end_time.slice(0, 5)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Precio</p>
              <p className="font-bold text-emerald-600 dark:text-emerald-500">
                {reservation.price > 0
                  ? `$${reservation.price.toLocaleString('es-CO')} COP`
                  : 'Sin costo'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Participantes</p>
              <p className="font-bold">{reservation.participants || '—'}</p>
            </div>
          </div>

          {reservation.notes && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Notas</p>
              <p className="text-sm bg-muted/40 rounded-lg p-4 italic text-muted-foreground border border-border/30">
                "{reservation.notes}"
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {reservation.status === 'pending' && (
              <>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
                  onClick={() => { onApprove(reservation.id); onClose(); }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Aprobar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-rose-600 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold h-11"
                  onClick={() => { onCancel(reservation.id); onClose(); }}
                >
                  <XCircle className="h-4 w-4 mr-2" /> Rechazar
                </Button>
              </>
            )}
            {reservation.status !== 'pending' && (
              <Button variant="outline" className="w-full h-11 font-bold border-border/50" onClick={onClose}>Cerrar</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SchoolFacilitiesPage() {
  const {
    facilities: supaFacilities,
    isLoading: facilitiesLoading,
    createFacility,
    deleteFacility,
    updateFacility,
    isCreating,
    isUpdating: facilitiesUpdating,
  } = useSchoolFacilities();

  const {
    reservations,
    isLoading: reservationsLoading,
    stats,
    createReservation,
    isCreating: isCreatingRes,
    updateReservation,
    isUpdating,
    deleteReservation,
    approveReservation,
    cancelReservation,
    getBookedSlots,
  } = useFacilityReservations();

  const facilities = supaFacilities ?? [];

  // UI state
  const [facilityDialogOpen, setFacilityDialogOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<any | null>(null);
  const [deleteFacilityId, setDeleteFacilityId] = useState<string | null>(null);

  // Reservation CRUD state
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<FacilityReservation | null>(null);
  const [viewingReservation, setViewingReservation] = useState<FacilityReservation | null>(null);
  const [deleteReservationId, setDeleteReservationId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Derived filtered reservations
  const filteredReservations = statusFilter 
    ? (reservations ?? []).filter(r => r.status === statusFilter)
    : (reservations ?? []);

  // Stable callback for getBookedSlots
  const stableGetBookedSlots = useCallback(getBookedSlots, []);

  // Handlers
  const handleFacilitySubmit = (data: any) => {
    if (editingFacility) {
      updateFacility({ id: editingFacility.id, ...data });
    } else {
      createFacility(data);
    }
    setFacilityDialogOpen(false);
    setEditingFacility(null);
  };

  const handleOpenNewFacility = () => {
    setEditingFacility(null);
    setFacilityDialogOpen(true);
  };

  const handleEditFacility = (facility: any) => {
    setEditingFacility(facility);
    setFacilityDialogOpen(true);
  };

  const handleDeleteFacility = () => {
    if (deleteFacilityId) { deleteFacility(deleteFacilityId); setDeleteFacilityId(null); }
  };

  const handleDeleteReservation = async () => {
    if (deleteReservationId) {
      await deleteReservation(deleteReservationId);
      setDeleteReservationId(null);
    }
  };

  const handleOpenNew = () => {
    setEditingReservation(null);
    setReservationModalOpen(true);
  };

  const handleOpenEdit = (r: FacilityReservation) => {
    setEditingReservation(r);
    setReservationModalOpen(true);
  };

  const handleReservationSubmit = async (
    payload: any
  ) => {
    if ('id' in payload) {
      await updateReservation(payload);
    } else {
      await createReservation(payload);
    }
  };

  if (facilitiesLoading) return <LoadingSpinner text="Cargando instalaciones..." />;

  // ── Empty state ──
  if (facilities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-6 min-h-[60vh]">
        <div className="bg-primary/10 p-5 rounded-full ring-8 ring-primary/5">
          <Building2 className="w-14 h-14 text-primary" />
        </div>
        <div className="max-w-md space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Configura tus Instalaciones</h1>
          <p className="text-muted-foreground text-lg italic">
            Aún no has registrado ninguna sede, cancha o gimnasio. Comienza ahora para habilitar reservas.
          </p>
        </div>
        <Button size="lg" className="h-12 px-8 font-bold text-base shadow-xl shadow-primary/20" onClick={() => setFacilityDialogOpen(true)}>
          <Building2 className="w-5 h-5 mr-3" /> Agregar Primera Instalación
        </Button>
        <FacilityFormDialog
          open={facilityDialogOpen}
          onOpenChange={setFacilityDialogOpen}
          onSubmit={createFacility}
          isLoading={isCreating}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Tabs defaultValue="facilities" className="space-y-8">
        <div className="flex items-center justify-between border-b pb-1">
          <TabsList className="bg-muted/50 p-1 border border-border/50">
            <TabsTrigger value="facilities" className="px-6 py-2.5 font-bold data-[state=active]:shadow-md">Instalaciones</TabsTrigger>
            <TabsTrigger value="reservations" className="px-6 py-2.5 font-bold data-[state=active]:shadow-md">
              Reservas
              {stats.pending > 0 && (
                <Badge className="ml-2 bg-yellow-500 text-white text-[10px] px-1.5 py-0 min-w-[18px] flex items-center justify-center font-black">
                  {stats.pending}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ═══════════════ INSTALACIONES ═══════════════ */}
        <TabsContent value="facilities" className="space-y-8 animate-in slide-in-from-left-4 duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight">Instalaciones</h1>
              <p className="text-muted-foreground mt-1.5 flex items-center gap-2 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {facilities.length} espacio{facilities.length !== 1 ? 's' : ''} deportivo{facilities.length !== 1 ? 's' : ''} gestionado{facilities.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button className="font-bold h-11 shadow-lg shadow-primary/20" onClick={handleOpenNewFacility}>
              <Building2 className="w-4 h-4 mr-2" /> Agregar Instalación
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {facilities.map((facility) => (
              <Card key={facility.id} className="group relative overflow-hidden border-border/40 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 transform hover:-translate-y-1">
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-lg leading-tight">{facility.name}</h3>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-primary hover:bg-primary/10" onClick={() => handleEditFacility(facility)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteFacilityId(facility.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="bg-muted/80 font-bold uppercase tracking-widest text-[9px] px-2">{facility.type}</Badge>
                    <Badge
                      variant={facility.status === 'available' ? 'default' : 'outline'}
                      className={facility.status === 'available' ? 'bg-primary/90' : 'border-primary/20 text-primary/60'}
                    >
                      {facility.status === 'available' ? 'Disponible' : 'Ocupado'}
                    </Badge>
                  </div>
                  
                  <div className="pt-2 flex items-center gap-2 text-sm text-muted-foreground/80 font-medium whitespace-nowrap overflow-hidden">
                    <Users className="w-4 h-4 text-primary/60" />
                    <span>Capacidad: <span className="text-foreground font-bold">{facility.capacity}</span> personas</span>
                  </div>
                  
                  {facility.description && (
                    <p className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-2 italic">"{facility.description}"</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ═══════════════ RESERVAS ═══════════════ */}
        <TabsContent value="reservations" className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-black tracking-tight">Gestión de Reservas</h1>
              <p className="text-muted-foreground font-medium mt-1.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                {stats.total} reservas en historial · <span className="text-foreground font-bold">{stats.pending}</span> por confirmar
              </p>
            </div>
            <Button className="font-bold h-11 shadow-lg shadow-primary/20" onClick={handleOpenNew}>
              <Users className="mr-2 h-4 w-4" /> Nueva Reserva
            </Button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Historial', value: stats.total, color: 'text-foreground', bg: 'bg-muted/20', filter: null },
              { label: 'Confirmadas', value: stats.confirmed, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/5', filter: 'confirmed' },
              { label: 'Pendientes', value: stats.pending, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/5', filter: 'pending' },
              { label: 'Canceladas', value: stats.cancelled, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/5', filter: 'cancelled' },
              { label: 'Completadas', value: stats.completed, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/5', filter: 'completed' },
            ].map((s) => (
              <Card 
                key={s.label} 
                className={`p-4 text-center border-2 transition-all cursor-pointer select-none active:scale-95 shadow-sm 
                  ${statusFilter === s.filter 
                    ? 'border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/10' 
                    : 'border-transparent opacity-70 hover:opacity-100 hover:border-border'} 
                  ${s.bg}`}
                onClick={() => setStatusFilter(s.filter)}
              >
                <p className={`text-3xl font-black tracking-tight ${s.color}`}>{s.value}</p>
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-1">{s.label}</p>
              </Card>
            ))}
          </div>

          {/* Table Container */}
          <Card className="border-border/40 overflow-hidden shadow-xl shadow-foreground/5 mb-10">
            <div className="p-0">
              {reservationsLoading ? (
                <div className="p-12 text-center space-y-4">
                  <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto" />
                  <p className="text-muted-foreground font-medium animate-pulse">Sincronizando con Supabase…</p>
                </div>
              ) : filteredReservations.length === 0 ? (
                <div className="p-20 text-center space-y-6">
                  <div className="bg-muted/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto ring-4 ring-muted/10">
                    <CalendarCheck className="h-8 w-8 text-muted-foreground/60" />
                  </div>
                  <div className="max-w-xs mx-auto space-y-2">
                    <p className="text-foreground font-bold text-lg">No hay reservas {statusFilter ? `en estado '${STATUS_LABELS[statusFilter]}'` : 'registradas'}</p>
                    <p className="text-muted-foreground text-sm">
                      {statusFilter 
                        ? 'Prueba seleccionando otro filtro o agrega una nueva reserva.'
                        : 'Tus registros de alquiler y bloqueos aparecerán aquí una vez que los crees.'}
                    </p>
                  </div>
                  {!statusFilter && (
                    <Button variant="outline" className="font-bold border-2 hover:bg-primary hover:text-primary-foreground transition-all" onClick={handleOpenNew}>
                      Crear primera reserva
                    </Button>
                  )}
                  {statusFilter && (
                    <Button variant="ghost" className="font-bold border bg-muted/20" onClick={() => setStatusFilter(null)}>
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="py-4 font-black text-xs uppercase tracking-widest">Instalación {statusFilter && <Badge variant="secondary" className="ml-2 text-[8px] bg-primary/20 text-primary">{STATUS_LABELS[statusFilter]}</Badge>}</TableHead>
                        <TableHead className="py-4 font-black text-xs uppercase tracking-widest">Solicitante</TableHead>
                        <TableHead className="py-4 font-black text-xs uppercase tracking-widest">Fecha</TableHead>
                        <TableHead className="py-4 font-black text-xs uppercase tracking-widest">Horario</TableHead>
                        <TableHead className="py-4 font-black text-xs uppercase tracking-widest">Estado</TableHead>
                        <TableHead className="py-4 font-black text-xs uppercase tracking-widest text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReservations.map((res) => (
                        <TableRow key={res.id} className="group hover:bg-muted/5 transition-colors">
                          <TableCell className="font-bold py-5">
                            <span className="text-sm">{res.facility?.name ?? '—'}</span>
                            <span className="block text-[10px] text-muted-foreground font-black uppercase tracking-tighter mt-0.5 opacity-60">
                              {res.facility?.type}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-semibold">
                              {res.requester?.full_name ?? res.requester?.email ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Calendar className="h-3.5 w-3.5 text-primary opacity-60" />
                              {format(parseISO(res.reservation_date), 'dd MMM yyyy', { locale: es })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Clock className="h-3.5 w-3.5 text-primary opacity-60" />
                              <span className="font-bold">{res.start_time.slice(0, 5)}</span>
                              <span className="opacity-40">—</span>
                              <span className="font-bold">{res.end_time.slice(0, 5)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={res.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-muted font-black">
                                  <MoreHorizontal className="h-5 w-5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52 p-1.5 bg-card border-border/40 backdrop-blur-md shadow-2xl">
                                {/* View */}
                                <DropdownMenuItem className="py-2.5 font-bold cursor-pointer" onClick={() => setViewingReservation(res)}>
                                  <Eye className="h-4 w-4 mr-3 text-primary" /> Ver detalle
                                </DropdownMenuItem>

                                {/* Edit — only pending/confirmed */}
                                {(res.status === 'pending' || res.status === 'confirmed') && (
                                  <DropdownMenuItem className="py-2.5 font-bold cursor-pointer" onClick={() => handleOpenEdit(res)}>
                                    <Pencil className="h-4 w-4 mr-3 text-primary" /> Editar
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator className="my-1.5 opacity-40" />

                                {/* Approve */}
                                {res.status === 'pending' && (
                                  <DropdownMenuItem
                                    className="py-2.5 font-bold cursor-pointer text-emerald-600 focus:text-emerald-700 focus:bg-emerald-500/10"
                                    onClick={() => approveReservation(res.id)}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-3" /> Aprobar
                                  </DropdownMenuItem>
                                )}

                                {/* Cancel */}
                                {(res.status === 'pending' || res.status === 'confirmed') && (
                                  <DropdownMenuItem
                                    className="py-2.5 font-bold cursor-pointer text-amber-600 focus:text-amber-700 focus:bg-amber-500/10"
                                    onClick={() => cancelReservation(res.id)}
                                  >
                                    <Ban className="h-4 w-4 mr-3" /> Cancelar
                                  </DropdownMenuItem>
                                )}

                                {/* Delete */}
                                <DropdownMenuItem
                                  className="py-2.5 font-bold cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-500/10"
                                  onClick={() => setDeleteReservationId(res.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-3" /> Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Reservation detail ── */}
      {viewingReservation && (
        <ReservationDetailModal
          reservation={viewingReservation}
          onClose={() => setViewingReservation(null)}
          onApprove={approveReservation}
          onCancel={cancelReservation}
        />
      )}

      {/* ── Create / Edit reservation ── */}
      <OwnerReservationModal
        open={reservationModalOpen}
        onOpenChange={(v) => {
          setReservationModalOpen(v);
          if (!v) setEditingReservation(null);
        }}
        facilities={facilities}
        editReservation={editingReservation}
        onSubmit={handleReservationSubmit}
        isLoading={isCreatingRes || isUpdating}
        getBookedSlots={stableGetBookedSlots}
      />

      {/* ── Facility form ── */}
      <FacilityFormDialog
        open={facilityDialogOpen}
        onOpenChange={(open) => {
          setFacilityDialogOpen(open);
          if (!open) setEditingFacility(null);
        }}
        onSubmit={handleFacilitySubmit}
        isLoading={isCreating || facilitiesUpdating}
        facility={editingFacility}
      />

      {/* ── Delete reservation confirm ── */}
      <AlertDialog open={!!deleteReservationId} onOpenChange={() => setDeleteReservationId(null)}>
        <AlertDialogContent className="bg-card text-card-foreground border-border/40 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-destructive" />
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black">¿Eliminar reserva?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground/80 font-medium">
              Esta acción no se puede deshacer. El registro del solicitante y la asignación del espacio serán removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4">
            <AlertDialogCancel className="font-bold border-border/60">No, conservar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteReservation}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-black shadow-lg shadow-destructive/20 active:scale-95 transition-all"
            >
              Sí, eliminar registro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete facility confirm ── */}
      <AlertDialog open={!!deleteFacilityId} onOpenChange={() => setDeleteFacilityId(null)}>
        <AlertDialogContent className="bg-card text-card-foreground border-border/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black">¿Eliminar instalación?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground/80 font-medium">
              ¿Estás seguro de que deseas eliminar <span className="text-foreground font-bold">"{facilities.find(f => f.id === deleteFacilityId)?.name}"</span>? 
              Se perderá el registro del espacio, pero las reservas pasadas se mantendrán como histórico sin vinculación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4">
            <AlertDialogCancel className="font-bold border-border/60">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFacility}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-black shadow-lg shadow-destructive/20"
            >
              Eliminar espacio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Add Loader2 to imports if not present
import { Loader2 } from 'lucide-react';
