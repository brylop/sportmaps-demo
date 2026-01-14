import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Plus, User, Activity, Calendar, FileText, Loader2, AlertCircle } from 'lucide-react';
import { mockPatients } from '@/lib/mock-data';
import { useHealthRecords, useWellnessEvaluations } from '@/hooks/useWellnessData';
import { EvaluationFormDialog } from '@/components/wellness/EvaluationFormDialog';

export default function WellnessPatientsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);
  
  const { records, isLoading: recordsLoading } = useHealthRecords();
  const { evaluations, createEvaluation, isLoading: evalLoading } = useWellnessEvaluations();

  // Use real data if available, fallback to mock
  const isUsingMockData = records.length === 0;
  const displayPatients = isUsingMockData ? mockPatients : records.map(r => ({
    id: r.id,
    name: r.athlete_id.substring(0, 8),
    age: 25,
    sport: r.record_type,
    last_visit: new Date(r.created_at).toLocaleDateString('es-CO'),
    status: 'active' as const,
    conditions: r.diagnosis ? [r.diagnosis] : []
  }));

  const filteredPatients = displayPatients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.sport.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleNewEvaluation = (data: any) => {
    createEvaluation.mutate({
      athlete_id: data.athlete_id || crypto.randomUUID(),
      evaluation_type: data.evaluation_type,
      score: data.score,
      recommendations: data.recommendations,
      follow_up_date: data.follow_up_date || null,
      metrics: data.metrics,
      status: 'pending'
    }, {
      onSuccess: () => setIsEvaluationOpen(false)
    });
  };

  const isLoading = recordsLoading || evalLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Mis Atletas</h1>
          <p className="text-muted-foreground">Gestiona a tus pacientes y atletas</p>
          {isUsingMockData && (
            <Badge variant="secondary" className="mt-2 gap-1">
              <AlertCircle className="h-3 w-3" />
              Mostrando datos de demostración
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Paciente
          </Button>
          <Button className="gap-2" onClick={() => setIsEvaluationOpen(true)}>
            <FileText className="h-4 w-4" />
            Nueva Evaluación
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar pacientes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Atletas</p>
                <p className="text-2xl font-bold">{displayPatients.length}</p>
              </div>
              <User className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Activos</p>
                <p className="text-2xl font-bold text-green-600">
                  {displayPatients.filter(p => p.status === 'active').length}
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Evaluaciones</p>
                <p className="text-2xl font-bold">{evaluations.length || mockPatients.length}</p>
              </div>
              <FileText className="h-8 w-8 text-orange" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Seguimientos Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {evaluations.filter(e => e.status === 'pending').length || 2}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredPatients.map((patient) => (
          <Card key={patient.id} className="hover:shadow-lg transition-shadow hover:border-primary/50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {patient.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{patient.name}</h3>
                    <Badge variant={patient.status === 'active' ? 'default' : 'secondary'}>
                      {patient.status === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {patient.age} años
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {patient.sport}
                    </span>
                  </div>
                </div>
              </div>

              {patient.conditions && patient.conditions.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-2">Condiciones:</p>
                  <div className="flex flex-wrap gap-1">
                    {patient.conditions.map((condition, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {condition}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Última visita: {patient.last_visit}
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm">
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    Ver Ficha
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPatients.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No se encontraron pacientes</h3>
            <p className="text-muted-foreground">
              Intenta con otro término de búsqueda
            </p>
          </CardContent>
        </Card>
      )}

      {/* Evaluation Form Dialog */}
      <EvaluationFormDialog
        open={isEvaluationOpen}
        onOpenChange={setIsEvaluationOpen}
        onSubmit={handleNewEvaluation}
        isLoading={createEvaluation.isPending}
      />
    </div>
  );
}