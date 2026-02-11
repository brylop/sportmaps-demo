import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, MapPin, Trash2, Users, Calendar, Clock, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSchoolFacilities } from '@/hooks/useSchoolData';
import { FacilityFormDialog } from '@/components/school/FacilityFormDialog';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Demo facilities for Spirit All Stars
const DEMO_FACILITIES = [
  {
    id: 'fac-1',
    school_id: 'demo-school',
    name: 'Gimnasio de Acrobatics — Sede Norte',
    type: 'Gimnasio de Porras',
    capacity: 30,
    description: 'Spring floor profesional de 12x12m con paneles de seguridad perimetrales. Ideal para rutinas de stunts y tumbling.',
    status: 'available' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'fac-2',
    school_id: 'demo-school',
    name: 'Pista de Spring Floor — Fontibón',
    type: 'Pista de Tumbling',
    capacity: 15,
    description: 'Pista de tumbling profesional de 25m con camas elásticas dobles y foso de espuma para aterrizajes seguros.',
    status: 'available' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'fac-3',
    school_id: 'demo-school',
    name: 'Sala de Estiramientos — La Granja',
    type: 'Sala de Preparación Física',
    capacity: 20,
    description: 'Espacio amplio con espejos, colchonetas y equipos de flexibilidad. Se usa para calentamiento y enfriamiento.',
    status: 'occupied' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'fac-4',
    school_id: 'demo-school',
    name: 'Área de Camas Elásticas — Sede Norte',
    type: 'Zona de Trampolines',
    capacity: 10,
    description: 'Dos camas elásticas de competencia y una mini-tramp para desarrollo de habilidades aéreas.',
    status: 'available' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Helper to get dates relative to today
const getRelativeDate = (daysOffset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
};

// Demo reservations
const DEMO_RESERVATIONS = [
  { id: 'res-1', facility: 'Gimnasio de Acrobatics — Sede Norte', user: 'Equipo Firesquad', coach: 'Carlos Mendoza', date: getRelativeDate(0), time: '16:00 — 18:00', status: 'confirmed', players: 14, notes: 'Ensayo general para competencia Nationals. Requiere sonido.' },
  { id: 'res-2', facility: 'Pista de Spring Floor — Fontibón', user: 'Equipo Bombsquad', coach: 'Ana María López', date: getRelativeDate(1), time: '09:00 — 11:00', status: 'pending', players: 12, notes: 'Entrenamiento de tumbling. Solicitan colchonetas extra.' },
  { id: 'res-3', facility: 'Sala de Estiramientos — La Granja', user: 'Equipo Butterfly', coach: 'Paola Ríos', date: getRelativeDate(2), time: '14:00 — 15:30', status: 'confirmed', players: 16, notes: 'Sesión de flexibilidad y calentamiento pre-competencia.' },
  { id: 'res-4', facility: 'Área de Camas Elásticas — Sede Norte', user: 'Equipo Legends', coach: 'Diego Vargas', date: getRelativeDate(0), time: '10:00 — 12:00', status: 'confirmed', players: 8, notes: 'Práctica de saltos dobles y triples. Solo atletas avanzados.' },
  { id: 'res-5', facility: 'Gimnasio de Acrobatics — Sede Norte', user: 'Equipo Butterfly', coach: 'Paola Ríos', date: getRelativeDate(3), time: '08:00 — 10:00', status: 'pending', players: 16, notes: 'Rutina grupal completa. Necesitan usar equipo de sonido.' },
  { id: 'res-6', facility: 'Pista de Spring Floor — Fontibón', user: 'Equipo Firesquad', coach: 'Carlos Mendoza', date: getRelativeDate(4), time: '15:00 — 17:00', status: 'confirmed', players: 14, notes: 'Entrenamiento libre de tumbling y stunts.' },
  { id: 'res-7', facility: 'Sala de Estiramientos — La Granja', user: 'Equipo Bombsquad', coach: 'Ana María López', date: getRelativeDate(1), time: '16:00 — 17:00', status: 'confirmed', players: 12, notes: 'Recuperación post-entrenamiento.' },
  { id: 'res-8', facility: 'Área de Camas Elásticas — Sede Norte', user: 'Equipo Firesquad', coach: 'Carlos Mendoza', date: getRelativeDate(5), time: '11:00 — 13:00', status: 'pending', players: 6, notes: 'Práctica individual de gimnasia aérea.' },
];

// Schedule slots for the calendar view
const SCHEDULE_SLOTS = [
  { time: '08:00 AM', occupancy: ['Butterfly', '', '', 'Libre'] },
  { time: '09:00 AM', occupancy: ['Libre', 'Bombsquad', 'Libre', 'Libre'] },
  { time: '10:00 AM', occupancy: ['Libre', 'Bombsquad', 'Libre', 'Legends'] },
  { time: '02:00 PM', occupancy: ['Libre', 'Libre', 'Butterfly', 'Libre'] },
  { time: '03:00 PM', occupancy: ['Libre', 'Libre', 'Butterfly', 'Libre'] },
  { time: '04:00 PM', occupancy: ['Firesquad', 'Libre', 'Bombsquad', 'Libre'] },
  { time: '05:00 PM', occupancy: ['Firesquad', 'Libre', 'Libre', 'Libre'] },
  { time: '06:00 PM', occupancy: ['Libre', 'Libre', 'Libre', 'Libre'] },
];

export default function SchoolFacilitiesPage() {
  const { facilities: supaFacilities, isLoading, createFacility, deleteFacility, isCreating } = useSchoolFacilities();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedRes, setSelectedRes] = useState<typeof DEMO_RESERVATIONS[0] | null>(null);

  // Use Supabase facilities if available, otherwise demo
  const facilities = supaFacilities && supaFacilities.length > 0 ? supaFacilities : DEMO_FACILITIES;

  const handleDelete = () => {
    if (deleteId) {
      deleteFacility(deleteId);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Cargando instalaciones..." />;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="facilities" className="space-y-6">
        <TabsList>
          <TabsTrigger value="facilities">Instalaciones</TabsTrigger>
          <TabsTrigger value="reservations">Reservas</TabsTrigger>
        </TabsList>

        {/* ========== INSTALACIONES TAB ========== */}
        <TabsContent value="facilities" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Instalaciones</h1>
              <p className="text-muted-foreground mt-1">
                {facilities.length} instalación{facilities.length !== 1 ? 'es' : ''} registrada{facilities.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Building2 className="w-4 h-4 mr-2" />
              Agregar Instalación
            </Button>
          </div>

          {/* Facilities Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {facilities.map((facility) => (
              <Card key={facility.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold">{facility.name}</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(facility.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <Badge variant="secondary">{facility.type}</Badge>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>Capacidad: {facility.capacity} personas</span>
                  </div>

                  {facility.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {facility.description}
                    </p>
                  )}

                  <Badge
                    variant={facility.status === 'available' ? 'default' : 'secondary'}
                    className={facility.status === 'available' ? 'bg-primary' : ''}
                  >
                    {facility.status === 'available' ? 'Disponible' : 'Ocupado'}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>

          {/* Calendar View */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">📅 Calendario de Reservas — Hoy ({new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })})</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="p-3 text-left font-medium">Hora</th>
                      {facilities.map((facility) => (
                        <th key={facility.id} className="p-3 text-left font-medium text-xs">
                          {facility.name.split('—')[0].trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SCHEDULE_SLOTS.map((slot, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="p-3 font-medium text-sm">{slot.time}</td>
                        {slot.occupancy.map((team, fIdx) => (
                          <td key={fIdx} className="p-3">
                            {team === 'Libre' ? (
                              <Badge variant="outline" className="text-xs">
                                Libre
                              </Badge>
                            ) : (
                              <Badge className="text-xs bg-primary">
                                {team}
                              </Badge>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ========== RESERVAS TAB ========== */}
        <TabsContent value="reservations" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Gestión de Reservas</h1>
              <p className="text-muted-foreground">
                {DEMO_RESERVATIONS.length} reservas activas — {DEMO_RESERVATIONS.filter(r => r.status === 'pending').length} pendientes de aprobación
              </p>
            </div>
            <Button>
              <Users className="mr-2 h-4 w-4" />
              Nueva Reserva
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{DEMO_RESERVATIONS.length}</p>
              <p className="text-sm text-muted-foreground">Total Reservas</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{DEMO_RESERVATIONS.filter(r => r.status === 'confirmed').length}</p>
              <p className="text-sm text-muted-foreground">Confirmadas</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{DEMO_RESERVATIONS.filter(r => r.status === 'pending').length}</p>
              <p className="text-sm text-muted-foreground">Pendientes</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold">{facilities.length}</p>
              <p className="text-sm text-muted-foreground">Instalaciones</p>
            </Card>
          </div>

          <Card>
            <div className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instalación</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Coach</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Atletas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DEMO_RESERVATIONS.map((res) => (
                    <TableRow key={res.id}>
                      <TableCell className="font-medium max-w-[180px]">{res.facility}</TableCell>
                      <TableCell>{res.user}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{res.coach}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {new Date(res.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {res.time}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{res.players}</TableCell>
                      <TableCell>
                        <Badge variant={res.status === 'confirmed' ? 'default' : 'secondary'}
                          className={res.status === 'confirmed' ? 'bg-green-600' : ''}
                        >
                          {res.status === 'confirmed' ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1" />Confirmada</>
                          ) : (
                            <><Clock className="h-3 w-3 mr-1" />Pendiente</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedRes(res)}>
                          <Eye className="h-3 w-3 mr-1" /> Detalles
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reservation Detail Dialog */}
      <Dialog open={!!selectedRes} onOpenChange={() => setSelectedRes(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle de Reserva</DialogTitle>
          </DialogHeader>
          {selectedRes && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-lg">{selectedRes.user}</p>
                  <Badge variant={selectedRes.status === 'confirmed' ? 'default' : 'secondary'}
                    className={selectedRes.status === 'confirmed' ? 'bg-green-600' : ''}
                  >
                    {selectedRes.status === 'confirmed' ? 'Confirmada' : 'Pendiente'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Coach: {selectedRes.coach}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Instalación</p>
                  <p className="font-medium text-sm">{selectedRes.facility}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Atletas</p>
                  <p className="font-medium">{selectedRes.players} personas</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-medium">{new Date(selectedRes.date).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Horario</p>
                  <p className="font-medium">{selectedRes.time}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Notas</p>
                <p className="text-sm bg-muted/30 rounded p-3">{selectedRes.notes}</p>
              </div>

              <div className="flex gap-2 pt-2">
                {selectedRes.status === 'pending' && (
                  <>
                    <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => setSelectedRes(null)}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Aprobar
                    </Button>
                    <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setSelectedRes(null)}>
                      <XCircle className="h-4 w-4 mr-1" /> Rechazar
                    </Button>
                  </>
                )}
                {selectedRes.status === 'confirmed' && (
                  <Button variant="outline" className="w-full" onClick={() => setSelectedRes(null)}>
                    Cerrar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <FacilityFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={createFacility}
        isLoading={isCreating}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar instalación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La instalación será removida del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
