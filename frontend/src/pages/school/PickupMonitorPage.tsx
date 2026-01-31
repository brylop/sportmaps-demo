import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
    Car,
    MapPin,
    CheckCircle2,
    Clock,
    AlertCircle,
    Play,
    Radio,
    Search,
    UserCheck,
    ShieldCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Mock Data Types
type PickupStatus = 'in_class' | 'approaching' | 'at_gate' | 'picked_up';

interface StudentPickup {
    id: string;
    name: string;
    grade: string;
    parent_name: string;
    car_plate?: string;
    status: PickupStatus;
    eta_mins?: number; // Estimated time of arrival
    photo_url?: string;
}

// Initial Mock Data
const MOCK_STUDENTS: StudentPickup[] = [
    { id: '1', name: 'Mateo Pérez', grade: '5A', parent_name: 'María González', car_plate: 'ABC-123', status: 'in_class' },
    { id: '2', name: 'Sofía Pérez', grade: '3B', parent_name: 'María González', car_plate: 'ABC-123', status: 'in_class' },
    { id: '3', name: 'Juan Vargas', grade: '6A', parent_name: 'Carlos Vargas', car_plate: 'XYZ-789', status: 'in_class' },
    { id: '4', name: 'Camila Torres', grade: '7A', parent_name: 'Elena Torres', car_plate: 'LOL-456', status: 'in_class' },
    { id: '5', name: 'Lucas Díaz', grade: '4C', parent_name: 'Pedro Díaz', car_plate: 'MNO-901', status: 'in_class' },
    { id: '6', name: 'Ana Silva', grade: '5A', parent_name: 'Luisa Silva', car_plate: 'QWE-345', status: 'in_class' },
];

export default function PickupMonitorPage() {
    const [students, setStudents] = useState<StudentPickup[]>(MOCK_STUDENTS);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSimulating, setIsSimulating] = useState(false);
    const { toast } = useToast();

    // Filter students based on search
    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.parent_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.car_plate?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Stats
    const stats = {
        in_class: students.filter(s => s.status === 'in_class').length,
        approaching: students.filter(s => s.status === 'approaching').length,
        at_gate: students.filter(s => s.status === 'at_gate').length,
        picked_up: students.filter(s => s.status === 'picked_up').length,
    };

    // Simulation Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (isSimulating) {
            interval = setInterval(() => {
                setStudents(prev => {
                    // Randomly pick a student to move forward in the flow
                    const candidates = prev.filter(s => s.status !== 'picked_up');
                    if (candidates.length === 0) {
                        setIsSimulating(false);
                        return prev;
                    }

                    const randomIndex = Math.floor(Math.random() * candidates.length);
                    const studentToUpdate = candidates[randomIndex];

                    let newStatus: PickupStatus = studentToUpdate.status;
                    let newEta = studentToUpdate.eta_mins;

                    if (studentToUpdate.status === 'in_class') {
                        newStatus = 'approaching';
                        newEta = Math.floor(Math.random() * 10) + 1; // 1-10 mins away

                        toast({
                            title: "🚗 Alerta de Proximidad",
                            description: `El padre de ${studentToUpdate.name} está a ${newEta} min (Placa: ${studentToUpdate.car_plate})`,
                            variant: "default",
                        });
                    } else if (studentToUpdate.status === 'approaching') {
                        newStatus = 'at_gate';
                        newEta = 0;
                        toast({
                            title: "👋 Padre en Puerta",
                            description: `El acudiente de ${studentToUpdate.name} ha llegado a la zona de recogida.`,
                            className: "bg-orange-500 text-white border-none",
                        });
                    }

                    return prev.map(s => s.id === studentToUpdate.id ? { ...s, status: newStatus, eta_mins: newEta } : s);
                });
            }, 3000); // Update every 3 seconds for demo speed
        }

        return () => clearInterval(interval);
    }, [isSimulating, toast]);

    const handleManualStatusChange = (id: string, newStatus: PickupStatus) => {
        setStudents(prev => prev.map(s => s.id === id ? { ...s, status: newStatus, eta_mins: newStatus === 'at_gate' ? 0 : s.eta_mins } : s));
    };

    const getStatusColor = (status: PickupStatus) => {
        switch (status) {
            case 'in_class': return 'bg-slate-100 text-slate-600';
            case 'approaching': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'at_gate': return 'bg-orange-100 text-orange-700 border-orange-200 animate-pulse';
            case 'picked_up': return 'bg-green-100 text-green-700';
            default: return '';
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <ShieldCheck className="h-8 w-8 text-primary" />
                        Centro de Salida Segura
                    </h1>
                    <p className="text-muted-foreground">
                        Monitorización en tiempo real de la logística de salida.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={isSimulating ? "destructive" : "default"}
                        onClick={() => setIsSimulating(!isSimulating)}
                        className="gap-2 shadow-lg"
                    >
                        {isSimulating ? <Radio className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
                        {isSimulating ? "Detener Simulación" : "Simular Llegada Masiva"}
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">En Clases</p>
                            <h2 className="text-3xl font-bold">{stats.in_class}</h2>
                        </div>
                        <UserCheck className="h-8 w-8 text-slate-200" />
                    </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-100">
                    <CardContent className="pt-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-blue-600">En Camino (Geofence)</p>
                            <h2 className="text-3xl font-bold text-blue-700">{stats.approaching}</h2>
                        </div>
                        <Car className="h-8 w-8 text-blue-200" />
                    </CardContent>
                </Card>
                <Card className="bg-orange-50 border-orange-100">
                    <CardContent className="pt-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-orange-600">En Puerta (Listos)</p>
                            <h2 className="text-3xl font-bold text-orange-700">{stats.at_gate}</h2>
                        </div>
                        <MapPin className="h-8 w-8 text-orange-200" />
                    </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-100">
                    <CardContent className="pt-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-green-600">Entregados</p>
                            <h2 className="text-3xl font-bold text-green-700">{stats.picked_up}</h2>
                        </div>
                        <CheckCircle2 className="h-8 w-8 text-green-200" />
                    </CardContent>
                </Card>
            </div>

            {/* Search Filter */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por estudiante, acudiente o placa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Kanban Board Layout */}
            <div className="flex-1 overflow-x-auto pb-4">
                <div className="flex gap-6 min-w-[1000px] h-[600px]">

                    {/* Column 1: Approaching */}
                    <div className="flex-1 bg-blue-50/50 rounded-xl p-4 border border-blue-100 flex flex-col">
                        <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
                            <Car className="h-5 w-5" />
                            Llegando ({stats.approaching})
                        </h3>
                        <ScrollArea className="flex-1">
                            <div className="space-y-3">
                                {filteredStudents.filter(s => s.status === 'approaching').map(student => (
                                    <Card key={student.id} className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                                        <CardContent className="p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-lg">{student.name}</h4>
                                                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-0">
                                                    {student.eta_mins} min
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-muted-foreground space-y-1">
                                                <p className="flex items-center gap-1">
                                                    <UserCheck className="h-3 w-3" /> Grado: {student.grade}
                                                </p>
                                                <p className="flex items-center gap-1">
                                                    <Car className="h-3 w-3" /> Placa: <span className="font-mono font-bold text-foreground">{student.car_plate}</span>
                                                </p>
                                                <p className="text-xs mt-2">Acudiente: {student.parent_name}</p>
                                            </div>
                                            <div className="mt-4 flex gap-2">
                                                <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => handleManualStatusChange(student.id, 'at_gate')}>
                                                    Marcar en Puerta
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {stats.approaching === 0 && (
                                    <div className="text-center py-12 text-muted-foreground opacity-50 border-2 border-dashed rounded-lg">
                                        Sin vehículos cerca
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Column 2: At Gate (Ready) */}
                    <div className="flex-1 bg-orange-50/50 rounded-xl p-4 border border-orange-100 flex flex-col">
                        <h3 className="font-semibold text-orange-800 mb-4 flex items-center gap-2">
                            <MapPin className="h-5 w-5" />
                            En Puerta / Listos ({stats.at_gate})
                        </h3>
                        <ScrollArea className="flex-1">
                            <div className="space-y-3">
                                {filteredStudents.filter(s => s.status === 'at_gate').map(student => (
                                    <Card key={student.id} className="border-l-4 border-l-orange-500 shadow-md bg-white">
                                        <CardContent className="p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-xl">{student.name}</h4>
                                                <Badge className="bg-orange-500 animate-pulse">
                                                    ¡Listo!
                                                </Badge>
                                            </div>
                                            <div className="bg-orange-100/50 p-2 rounded-lg mb-3">
                                                <p className="text-sm font-semibold text-orange-900 flex items-center gap-2">
                                                    🚗 Vehículo Esperando
                                                </p>
                                                <p className="text-2xl font-mono font-bold text-center tracking-widest my-1">{student.car_plate}</p>
                                            </div>
                                            <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg" onClick={() => handleManualStatusChange(student.id, 'picked_up')}>
                                                <CheckCircle2 className="mr-2 h-5 w-5" />
                                                Confirmar Entrega
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                                {stats.at_gate === 0 && (
                                    <div className="text-center py-12 text-muted-foreground opacity-50 border-2 border-dashed rounded-lg">
                                        Zona de recogida libre
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Column 3: Picked Up (History) */}
                    <div className="flex-1 bg-gray-50/50 rounded-xl p-4 border border-gray-100 flex flex-col">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <HistoryList className="h-5 w-5" />
                            Entregados Recientemente
                        </h3>
                        <ScrollArea className="flex-1">
                            <div className="space-y-2">
                                {filteredStudents.filter(s => s.status === 'picked_up').reverse().slice(0, 10).map(student => (
                                    <div key={student.id} className="flex items-center justify-between p-3 bg-white border rounded-lg opacity-75 hover:opacity-100 transition-opacity">
                                        <div>
                                            <p className="font-medium">{student.name}</p>
                                            <p className="text-xs text-muted-foreground">{student.parent_name}</p>
                                        </div>
                                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                            Entregado
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </div>
        </div>
    );
}

function HistoryList({ className }: { className?: string }) {
    return <Clock className={className} />;
}
