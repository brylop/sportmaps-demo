import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Mail, FileUp } from 'lucide-react';
import { CSVImportModal } from '@/components/students/CSVImportModal';
import { useToast } from '@/hooks/use-toast';

export default function StudentsPage() {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const { toast } = useToast();

  // Demo data - now using state so we can add imported students
  const [students, setStudents] = useState([
    {
      id: '1',
      name: 'Mateo Pérez',
      age: 11,
      program: 'Fútbol Sub-12',
      parent: 'María González',
      phone: '+57 300 123 4567',
      paymentStatus: 'paid',
    },
    {
      id: '2',
      name: 'Sofía Pérez',
      age: 9,
      program: 'Tenis Infantil',
      parent: 'María González',
      phone: '+57 300 123 4567',
      paymentStatus: 'paid',
    },
    {
      id: '3',
      name: 'Juan Vargas',
      age: 11,
      program: 'Fútbol Sub-12',
      parent: 'Carlos Vargas',
      phone: '+57 310 234 5678',
      paymentStatus: 'overdue',
    },
    {
      id: '4',
      name: 'Camila Torres',
      age: 12,
      program: 'Voleibol Juvenil',
      parent: 'Elena Torres',
      phone: '+57 320 345 6789',
      paymentStatus: 'pending',
    },
  ]);

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.program.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.parent.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500">🟢 Al día</Badge>;
      case 'overdue':
        return <Badge variant="destructive">🔴 Vencido</Badge>;
      case 'pending':
        return <Badge variant="secondary">🟡 Pendiente</Badge>;
      default:
        return null;
    }
  };

  const handleCSVImport = (importedStudents: { name: string; parent: string; phone: string; monthlyFee: string }[]) => {
    const newStudents = importedStudents.map((s, index) => ({
      id: `imported-${Date.now()}-${index}`,
      name: s.name,
      age: 10, // Default age
      program: 'Por asignar',
      parent: s.parent,
      phone: s.phone,
      paymentStatus: 'pending' as const,
    }));

    setStudents(prev => [...prev, ...newStudents]);
    toast({
      title: 'Estudiantes importados',
      description: `Se agregaron ${newStudents.length} estudiantes a la lista`,
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Estudiantes</h1>
          <p className="text-muted-foreground">Base de datos completa de alumnos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <FileUp className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <Button variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            Invitar Padre
          </Button>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Añadir Estudiante
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por nombre, programa o acudiente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Edad</TableHead>
                <TableHead>Programa</TableHead>
                <TableHead>Acudiente</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado de Pago</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow key={student.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>{student.age}</TableCell>
                  <TableCell>{student.program}</TableCell>
                  <TableCell>{student.parent}</TableCell>
                  <TableCell>{student.phone}</TableCell>
                  <TableCell>{getPaymentBadge(student.paymentStatus)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">Ver Perfil</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CSVImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImport={handleCSVImport}
      />
    </div>
  );
}
