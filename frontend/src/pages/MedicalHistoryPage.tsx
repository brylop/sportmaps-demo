import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
<<<<<<< HEAD
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    FileText,
    Plus,
    Search,
    Calendar,
    AlertTriangle,
    Activity,
    Pill,
    Stethoscope,
    Download
} from 'lucide-react';

interface MedicalRecord {
    id: string;
    athleteName: string;
    date: string;
    type: 'evaluation' | 'injury' | 'treatment' | 'followup';
    title: string;
    description: string;
    professional: string;
    status: 'active' | 'resolved' | 'monitoring';
}

export default function MedicalHistoryPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);

    const athletes = [
        { id: '1', name: 'Carlos Martínez', sport: 'Fútbol', recordsCount: 12 },
        { id: '2', name: 'María González', sport: 'Tenis', recordsCount: 8 },
        { id: '3', name: 'Juan Pérez', sport: 'Natación', recordsCount: 5 },
    ];

    const medicalRecords: MedicalRecord[] = [
        {
            id: '1',
            athleteName: 'Carlos Martínez',
            date: '2026-01-10',
            type: 'injury',
            title: 'Lesión de rodilla - LCA',
            description: 'Esguince de grado 2 del ligamento cruzado anterior',
            professional: 'Dr. García',
            status: 'monitoring'
        },
        {
            id: '2',
            athleteName: 'Carlos Martínez',
            date: '2025-12-15',
            type: 'evaluation',
            title: 'Evaluación física completa',
            description: 'Evaluación de rendimiento pre-temporada',
            professional: 'Dr. López',
            status: 'resolved'
        },
        {
            id: '3',
            athleteName: 'María González',
            date: '2026-01-05',
            type: 'treatment',
            title: 'Tratamiento fisioterapéutico',
            description: 'Rehabilitación de hombro derecho',
            professional: 'Lic. Martín',
            status: 'active'
        },
        {
            id: '4',
            athleteName: 'Juan Pérez',
            date: '2026-01-12',
            type: 'followup',
            title: 'Seguimiento nutricional',
            description: 'Control mensual de peso y composición corporal',
            professional: 'Nut. Rodríguez',
            status: 'resolved'
        }
    ];

    const getTypeBadge = (type: MedicalRecord['type']) => {
        switch (type) {
            case 'injury':
                return <Badge className="bg-red-500/10 text-red-600">Lesión</Badge>;
            case 'evaluation':
                return <Badge className="bg-blue-500/10 text-blue-600">Evaluación</Badge>;
            case 'treatment':
                return <Badge className="bg-purple-500/10 text-purple-600">Tratamiento</Badge>;
            case 'followup':
                return <Badge className="bg-green-500/10 text-green-600">Seguimiento</Badge>;
        }
    };

    const getStatusBadge = (status: MedicalRecord['status']) => {
        switch (status) {
            case 'active':
                return <Badge variant="outline" className="text-orange-600 border-orange-500/30">Activo</Badge>;
            case 'resolved':
                return <Badge variant="outline" className="text-green-600 border-green-500/30">Resuelto</Badge>;
            case 'monitoring':
                return <Badge variant="outline" className="text-blue-600 border-blue-500/30">En seguimiento</Badge>;
        }
    };

    const getTypeIcon = (type: MedicalRecord['type']) => {
        switch (type) {
            case 'injury':
                return <AlertTriangle className="h-5 w-5 text-red-500" />;
            case 'evaluation':
                return <Stethoscope className="h-5 w-5 text-blue-500" />;
            case 'treatment':
                return <Pill className="h-5 w-5 text-purple-500" />;
            case 'followup':
                return <Activity className="h-5 w-5 text-green-500" />;
        }
    };

    const filteredRecords = medicalRecords.filter(record =>
        record.athleteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <FileText className="h-8 w-8 text-primary" />
                        Historial Médico
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Consulta y gestiona expedientes médicos de atletas
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                    </Button>
                    <Button className="bg-gradient-hero text-white hover:opacity-90">
                        <Plus className="h-4 w-4 mr-2" />
                        Nuevo Registro
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-4">
                {/* Athletes Sidebar */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-lg">Atletas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {athletes.map(athlete => (
                            <Button
                                key={athlete.id}
                                variant={selectedAthlete === athlete.id ? 'secondary' : 'ghost'}
                                className="w-full justify-start"
                                onClick={() => setSelectedAthlete(athlete.id)}
                            >
                                <Avatar className="h-8 w-8 mr-2">
                                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                        {athlete.name.split(' ').map(n => n[0]).join('')}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="text-left">
                                    <p className="font-medium">{athlete.name}</p>
                                    <p className="text-xs text-muted-foreground">{athlete.recordsCount} registros</p>
                                </div>
                            </Button>
                        ))}
                    </CardContent>
                </Card>

                {/* Records */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between gap-4">
                            <CardTitle>Registros Médicos</CardTitle>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar registros..."
                                    className="pl-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="all">
                            <TabsList className="mb-4">
                                <TabsTrigger value="all">Todos</TabsTrigger>
                                <TabsTrigger value="injuries">Lesiones</TabsTrigger>
                                <TabsTrigger value="evaluations">Evaluaciones</TabsTrigger>
                                <TabsTrigger value="treatments">Tratamientos</TabsTrigger>
                            </TabsList>

                            <TabsContent value="all" className="space-y-3">
                                {filteredRecords.map((record, index) => (
                                    <div
                                        key={record.id}
                                        className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors animate-in slide-in-from-bottom"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <div className="p-2 bg-muted rounded-lg">
                                            {getTypeIcon(record.type)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-semibold">{record.title}</h4>
                                                {getTypeBadge(record.type)}
                                                {getStatusBadge(record.status)}
                                            </div>
                                            <p className="text-sm text-muted-foreground mb-2">{record.description}</p>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(record.date).toLocaleDateString('es-ES')}
                                                </span>
                                                <span>{record.professional}</span>
                                                <span>{record.athleteName}</span>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm">Ver Detalles</Button>
                                    </div>
                                ))}
                            </TabsContent>

                            <TabsContent value="injuries">
                                <p className="text-muted-foreground text-center py-8">
                                    Filtro de lesiones activo
                                </p>
                            </TabsContent>

                            <TabsContent value="evaluations">
                                <p className="text-muted-foreground text-center py-8">
                                    Filtro de evaluaciones activo
                                </p>
                            </TabsContent>

                            <TabsContent value="treatments">
                                <p className="text-muted-foreground text-center py-8">
                                    Filtro de tratamientos activo
                                </p>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
=======
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, FileText, Calendar, User, AlertCircle, Loader2, Download } from 'lucide-react';
import { useHealthRecords } from '@/hooks/useWellnessData';

const mockMedicalHistory = [
  { id: '1', athlete: 'Miguel Torres', type: 'Consulta', diagnosis: 'Esguince tobillo grado II', date: '2025-12-20', status: 'active' },
  { id: '2', athlete: 'Sofía Ramírez', type: 'Fisioterapia', diagnosis: 'Tendinitis hombro', date: '2025-12-18', status: 'in_treatment' },
  { id: '3', athlete: 'Diego Fernández', type: 'Evaluación', diagnosis: 'Control rutinario', date: '2025-12-15', status: 'completed' },
  { id: '4', athlete: 'Valentina Castro', type: 'Rehabilitación', diagnosis: 'Rotura LCA - Post operatorio', date: '2025-12-10', status: 'in_treatment' },
];

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  active: { label: 'Activo', variant: 'default' },
  in_treatment: { label: 'En Tratamiento', variant: 'secondary' },
  completed: { label: 'Completado', variant: 'outline' },
  archived: { label: 'Archivado', variant: 'outline' },
};

export default function MedicalHistoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { records, isLoading } = useHealthRecords();

  const displayRecords = records.length > 0 ? records.map(r => ({
    id: r.id,
    athlete: r.athlete_id.substring(0, 8),
    type: r.record_type,
    diagnosis: r.diagnosis || 'Sin diagnóstico',
    date: new Date(r.created_at).toLocaleDateString('es-CO'),
    status: 'active'
  })) : mockMedicalHistory;

  const isUsingMockData = records.length === 0;

  const filteredRecords = displayRecords.filter(record =>
    record.athlete.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-3xl font-bold">Historial Médico</h1>
          <p className="text-muted-foreground">Registros médicos de tus atletas</p>
          {isUsingMockData && (
            <Badge variant="secondary" className="mt-2 gap-1">
              <AlertCircle className="h-3 w-3" />
              Mostrando datos de demostración
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva Ficha
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Fichas</p>
                <p className="text-2xl font-bold">{displayRecords.length}</p>
              </div>
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Tratamiento</p>
                <p className="text-2xl font-bold text-orange">
                  {displayRecords.filter(r => r.status === 'in_treatment').length}
                </p>
              </div>
              <User className="h-8 w-8 text-orange" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completados</p>
                <p className="text-2xl font-bold text-green-600">
                  {displayRecords.filter(r => r.status === 'completed').length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Este Mes</p>
                <p className="text-2xl font-bold">{displayRecords.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Registros Médicos
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar registros..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atleta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Diagnóstico</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record) => {
                const status = statusConfig[record.status] || statusConfig.active;
                return (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.athlete}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{record.diagnosis}</TableCell>
                    <TableCell>{record.date}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Ver Ficha
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredRecords.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No hay registros</h3>
              <p className="text-muted-foreground">
                Los registros médicos aparecerán aquí
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
