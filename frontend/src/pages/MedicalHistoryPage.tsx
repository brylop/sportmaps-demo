import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, FileText, Calendar, User, Loader2, Download } from 'lucide-react';
import { useHealthRecords } from '@/hooks/useWellnessData';


const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  active: { label: 'Activo', variant: 'default' },
  in_treatment: { label: 'En Tratamiento', variant: 'secondary' },
  completed: { label: 'Completado', variant: 'outline' },
  archived: { label: 'Archivado', variant: 'outline' },
};

export default function MedicalHistoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { records, isLoading } = useHealthRecords();

  const displayRecords = records.map(r => ({
    id: r.id,
    athlete: r.athlete_id.substring(0, 8),
    type: r.record_type,
    diagnosis: r.diagnosis || 'Sin diagnóstico',
    date: new Date(r.created_at).toLocaleDateString('es-CO'),
    status: 'active'
  }));

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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Historial Médico</h1>
          <p className="text-muted-foreground">Registros médicos de tus atletas</p>
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
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Fichas</p>
                <p className="text-2xl font-bold">{displayRecords.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                <User className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">En Tratamiento</p>
                <p className="text-2xl font-bold">
                  {displayRecords.filter(r => r.status === 'in_treatment').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completados</p>
                <p className="text-2xl font-bold">
                  {displayRecords.filter(r => r.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Este Mes</p>
                <p className="text-2xl font-bold">{displayRecords.length}</p>
              </div>
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
