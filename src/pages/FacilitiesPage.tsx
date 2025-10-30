import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, MapPin } from 'lucide-react';

export default function FacilitiesPage() {
  const facilities = [
    { id: '1', name: 'Cancha 1', type: 'Fútbol', status: 'active' },
    { id: '2', name: 'Cancha 2', type: 'Fútbol', status: 'active' },
    { id: '3', name: 'Cancha Tenis 1', type: 'Tenis', status: 'active' },
    { id: '4', name: 'Cancha Cubierta', type: 'Voleibol', status: 'maintenance' },
  ];

  const schedule = [
    { time: '2:00 PM', cancha1: null, cancha2: null, tenis1: null },
    { time: '3:00 PM', cancha1: null, cancha2: null, tenis1: 'Tenis Infantil (D. Silva)' },
    { time: '4:00 PM', cancha1: 'Fútbol Sub-12 (L.F.R.)', cancha2: 'Fútbol Sub-10 (L.F.R.)', tenis1: 'Tenis Infantil (D. Silva)' },
    { time: '5:00 PM', cancha1: 'Fútbol Sub-12 (L.F.R.)', cancha2: 'Fútbol Sub-10 (L.F.R.)', tenis1: null },
    { time: '6:00 PM', cancha1: null, cancha2: null, tenis1: null },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Instalaciones</h1>
          <p className="text-muted-foreground">Gestión de canchas y recursos</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Crear Reserva
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {facilities.map((facility) => (
          <Card key={facility.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-4 w-4" />
                {facility.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge variant="secondary">{facility.type}</Badge>
                {facility.status === 'active' ? (
                  <Badge className="bg-green-500">Disponible</Badge>
                ) : (
                  <Badge variant="destructive">Mantenimiento</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calendario de Recursos - Jueves</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left font-medium">Hora</th>
                  <th className="p-3 text-left font-medium">Cancha 1 (Fútbol)</th>
                  <th className="p-3 text-left font-medium">Cancha 2 (Fútbol)</th>
                  <th className="p-3 text-left font-medium">Cancha Tenis 1</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((slot, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-medium">{slot.time}</td>
                    <td className="p-3">
                      {slot.cancha1 ? (
                        <div className="bg-primary/20 p-2 rounded text-sm">{slot.cancha1}</div>
                      ) : (
                        <div className="text-muted-foreground text-sm">(Libre)</div>
                      )}
                    </td>
                    <td className="p-3">
                      {slot.cancha2 ? (
                        <div className="bg-primary/20 p-2 rounded text-sm">{slot.cancha2}</div>
                      ) : (
                        <div className="text-muted-foreground text-sm">(Libre)</div>
                      )}
                    </td>
                    <td className="p-3">
                      {slot.tenis1 ? (
                        <div className="bg-primary/20 p-2 rounded text-sm">{slot.tenis1}</div>
                      ) : (
                        <div className="text-muted-foreground text-sm">(Libre)</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
