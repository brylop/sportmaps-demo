import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Calendar, ClipboardList, FileText, Heart, PlusCircle, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function WellnessPage() {
  const { toast } = useToast();
  const [evaluationDialogOpen, setEvaluationDialogOpen] = useState(false);
  const [evaluations, setEvaluations] = useState<any[]>([
    {
      id: '1',
      athlete: 'Carlos Martínez',
      date: '2024-10-25',
      type: 'Fisioterapia',
      status: 'completed',
      notes: 'Recuperación satisfactoria de lesión de rodilla',
    },
    {
      id: '2',
      athlete: 'María González',
      date: '2024-10-20',
      type: 'Nutrición',
      status: 'completed',
      notes: 'Plan nutricional para aumento de masa muscular',
    },
  ]);

  const athletes = [
    { id: '1', name: 'Carlos Martínez', sport: 'Fútbol' },
    { id: '2', name: 'María González', sport: 'Tenis' },
    { id: '3', name: 'Juan Pérez', sport: 'Natación' },
  ];

  const handleCreateEvaluation = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newEvaluation = {
      id: Date.now().toString(),
      athlete: formData.get('athlete') as string,
      date: formData.get('date') as string,
      type: formData.get('type') as string,
      status: 'pending',
      notes: formData.get('notes') as string,
    };
    setEvaluations([newEvaluation, ...evaluations]);
    toast({
      title: '✅ Evaluación creada',
      description: 'La evaluación ha sido registrada exitosamente',
    });
    setEvaluationDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Panel de Bienestar</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona evaluaciones y seguimiento de atletas
          </p>
        </div>
        <Button onClick={() => setEvaluationDialogOpen(true)}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Nueva Evaluación
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atletas Activos</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{athletes.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evaluaciones</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{evaluations.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Citas Hoy</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seguimientos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Button variant="outline" className="h-auto flex-col gap-2 p-4">
            <ClipboardList className="w-6 h-6" />
            <span>Nueva Evaluación</span>
          </Button>
          <Button variant="outline" className="h-auto flex-col gap-2 p-4">
            <Heart className="w-6 h-6" />
            <span>Plan Nutricional</span>
          </Button>
          <Button variant="outline" className="h-auto flex-col gap-2 p-4">
            <Activity className="w-6 h-6" />
            <span>Seguimiento</span>
          </Button>
          <Button variant="outline" className="h-auto flex-col gap-2 p-4">
            <FileText className="w-6 h-6" />
            <span>Historial Médico</span>
          </Button>
        </CardContent>
      </Card>

      {/* Evaluations List */}
      <Card>
        <CardHeader>
          <CardTitle>Evaluaciones Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {evaluations.map((evaluation) => (
              <div key={evaluation.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Heart className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{evaluation.athlete}</p>
                    <p className="text-sm text-muted-foreground">{evaluation.type}</p>
                    <p className="text-xs text-muted-foreground mt-1">{evaluation.notes}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">{new Date(evaluation.date).toLocaleDateString('es-ES')}</p>
                    <Badge variant={evaluation.status === 'completed' ? 'default' : 'secondary'}>
                      {evaluation.status === 'completed' ? 'Completada' : 'Pendiente'}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm">Ver Detalles</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Evaluation Dialog */}
      <Dialog open={evaluationDialogOpen} onOpenChange={setEvaluationDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva Evaluación</DialogTitle>
            <DialogDescription>
              Registra una nueva evaluación médica o nutricional
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateEvaluation} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="athlete">Atleta *</Label>
                <Select name="athlete" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un atleta" />
                  </SelectTrigger>
                  <SelectContent>
                    {athletes.map((athlete) => (
                      <SelectItem key={athlete.id} value={athlete.name}>
                        {athlete.name} - {athlete.sport}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Evaluación *</Label>
                <Select name="type" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fisioterapia">Fisioterapia</SelectItem>
                    <SelectItem value="Nutrición">Nutrición</SelectItem>
                    <SelectItem value="Psicología">Psicología Deportiva</SelectItem>
                    <SelectItem value="Medicina Deportiva">Medicina Deportiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Fecha *</Label>
                <Input type="date" name="date" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas y Observaciones *</Label>
              <Textarea 
                name="notes" 
                placeholder="Descripción de la evaluación, hallazgos, recomendaciones..."
                rows={6}
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEvaluationDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Crear Evaluación
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
