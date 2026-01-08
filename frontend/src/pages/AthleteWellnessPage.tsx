import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { HeartPulse, Activity, Calendar, FileText, TrendingUp } from 'lucide-react';
import { useState } from 'react';

interface WellnessRecord {
  id: string;
  type: string;
  date: string;
  professional: string;
  status: 'completed' | 'scheduled';
  notes?: string;
}

export default function AthleteWellnessPage() {
  const { user } = useAuth();
  const isDemoUser = user?.email?.endsWith('@demo.sportmaps.com');

  const [records] = useState<WellnessRecord[]>(isDemoUser ? [
    {
      id: '1',
      type: 'Evaluación física',
      date: '2024-10-15',
      professional: 'Dr. María López',
      status: 'completed',
      notes: 'Excelente condición cardiovascular',
    },
    {
      id: '2',
      type: 'Control nutricional',
      date: '2024-11-01',
      professional: 'Lic. Carlos Ruiz',
      status: 'scheduled',
    },
    {
      id: '3',
      type: 'Fisioterapia preventiva',
      date: '2024-10-20',
      professional: 'Ft. Ana Martínez',
      status: 'completed',
      notes: 'Sin lesiones, continuar con ejercicios de estiramiento',
    },
  ] : []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-poppins">Mi Bienestar</h1>
        <p className="text-muted-foreground mt-1 font-poppins">
          Tu salud deportiva en un solo lugar
        </p>
      </div>

      {/* Health Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/20">
                <HeartPulse className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estado General</p>
                <p className="text-xl font-bold font-poppins text-primary">Óptimo</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-accent/20">
                <Activity className="h-6 w-6 text-[hsl(35,97%,55%)]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Evaluaciones</p>
                <p className="text-2xl font-bold font-poppins">
                  {records.filter(r => r.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-secondary">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Próxima cita</p>
                <p className="text-lg font-bold font-poppins">
                  {records.find(r => r.status === 'scheduled')?.date 
                    ? new Date(records.find(r => r.status === 'scheduled')!.date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })
                    : 'Sin citas'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Records */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-poppins">
              <FileText className="h-5 w-5 text-primary" />
              Historial de Salud
            </CardTitle>
            <Button variant="outline" size="sm">
              Ver todo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {records.map((record) => (
            <div
              key={record.id}
              className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold font-poppins">{record.type}</h3>
                  <p className="text-sm text-muted-foreground">{record.professional}</p>
                  {record.notes && (
                    <p className="text-sm text-muted-foreground mt-1 italic">"{record.notes}"</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <Badge 
                  className={record.status === 'completed' 
                    ? 'bg-[hsl(119,60%,32%)] text-white' 
                    : 'bg-[hsl(35,97%,55%)] text-white'}
                >
                  {record.status === 'completed' ? 'Completado' : 'Programado'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(record.date).toLocaleDateString('es-CO')}
                </p>
              </div>
            </div>
          ))}

          {records.length === 0 && (
            <div className="text-center py-8">
              <HeartPulse className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-poppins">
                No hay registros de bienestar
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
