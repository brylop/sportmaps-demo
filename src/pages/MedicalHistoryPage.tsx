import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
