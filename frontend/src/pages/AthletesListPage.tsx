import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Users,
    Search,
    Filter,
    Plus,
    Activity,
    Calendar,
    MoreVertical,
    TrendingUp,
    Heart
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Athlete {
    id: string;
    name: string;
    email: string;
    sport: string;
    status: 'active' | 'recovering' | 'inactive';
    lastEvaluation: string;
    nextAppointment: string;
    risk: 'low' | 'medium' | 'high';
}

export default function AthletesListPage() {
    const [searchQuery, setSearchQuery] = useState('');

    const athletes: Athlete[] = [
        {
            id: '1',
            name: 'Carlos Martínez',
            email: 'carlos@email.com',
            sport: 'Fútbol',
            status: 'active',
            lastEvaluation: '2026-01-10',
            nextAppointment: '2026-01-20',
            risk: 'low'
        },
        {
            id: '2',
            name: 'María González',
            email: 'maria@email.com',
            sport: 'Tenis',
            status: 'recovering',
            lastEvaluation: '2026-01-05',
            nextAppointment: '2026-01-15',
            risk: 'medium'
        },
        {
            id: '3',
            name: 'Juan Pérez',
            email: 'juan@email.com',
            sport: 'Natación',
            status: 'active',
            lastEvaluation: '2026-01-12',
            nextAppointment: '2026-01-25',
            risk: 'low'
        },
        {
            id: '4',
            name: 'Ana López',
            email: 'ana@email.com',
            sport: 'Atletismo',
            status: 'inactive',
            lastEvaluation: '2025-12-20',
            nextAppointment: '-',
            risk: 'high'
        }
    ];

    const getStatusBadge = (status: Athlete['status']) => {
        switch (status) {
            case 'active':
                return <Badge className="bg-green-500/10 text-green-600">Activo</Badge>;
            case 'recovering':
                return <Badge className="bg-yellow-500/10 text-yellow-600">En recuperación</Badge>;
            case 'inactive':
                return <Badge className="bg-gray-500/10 text-gray-600">Inactivo</Badge>;
        }
    };

    const getRiskBadge = (risk: Athlete['risk']) => {
        switch (risk) {
            case 'low':
                return <Badge variant="outline" className="text-green-600 border-green-500/30">Bajo</Badge>;
            case 'medium':
                return <Badge variant="outline" className="text-yellow-600 border-yellow-500/30">Medio</Badge>;
            case 'high':
                return <Badge variant="outline" className="text-red-600 border-red-500/30">Alto</Badge>;
        }
    };

    const filteredAthletes = athletes.filter(athlete =>
        athlete.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        athlete.sport.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Users className="h-8 w-8 text-primary" />
                        Atletas
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Gestiona y monitorea el bienestar de tus atletas
                    </p>
                </div>
                <Button className="bg-gradient-hero text-white hover:opacity-90">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Atleta
                </Button>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Atletas</p>
                            <p className="text-2xl font-bold">{athletes.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                            <Activity className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Activos</p>
                            <p className="text-2xl font-bold">{athletes.filter(a => a.status === 'active').length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/10 rounded-lg">
                            <Heart className="h-5 w-5 text-yellow-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">En Recuperación</p>
                            <p className="text-2xl font-bold">{athletes.filter(a => a.status === 'recovering').length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                            <TrendingUp className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Alto Riesgo</p>
                            <p className="text-2xl font-bold">{athletes.filter(a => a.risk === 'high').length}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search & Filter */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar atletas..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button variant="outline">
                    <Filter className="h-4 w-4 mr-2" />
                    Filtros
                </Button>
            </div>

            {/* Athletes List */}
            <Card>
                <CardHeader>
                    <CardTitle>Lista de Atletas ({filteredAthletes.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {filteredAthletes.map((athlete, index) => (
                            <div
                                key={athlete.id}
                                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors animate-in slide-in-from-bottom"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="flex items-center gap-4">
                                    <Avatar>
                                        <AvatarFallback className="bg-primary/10 text-primary">
                                            {athlete.name.split(' ').map(n => n[0]).join('')}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold">{athlete.name}</p>
                                        <p className="text-sm text-muted-foreground">{athlete.email}</p>
                                        <Badge variant="secondary" className="mt-1">{athlete.sport}</Badge>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right hidden md:block">
                                        <p className="text-xs text-muted-foreground">Última Evaluación</p>
                                        <p className="text-sm">{new Date(athlete.lastEvaluation).toLocaleDateString('es-ES')}</p>
                                    </div>
                                    <div className="text-right hidden lg:block">
                                        <p className="text-xs text-muted-foreground">Próxima Cita</p>
                                        <p className="text-sm">{athlete.nextAppointment !== '-' ? new Date(athlete.nextAppointment).toLocaleDateString('es-ES') : '-'}</p>
                                    </div>
                                    <div className="flex flex-col gap-1 items-end">
                                        {getStatusBadge(athlete.status)}
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            Riesgo: {getRiskBadge(athlete.risk)}
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem>Ver Perfil</DropdownMenuItem>
                                            <DropdownMenuItem>Nueva Evaluación</DropdownMenuItem>
                                            <DropdownMenuItem>Historial Médico</DropdownMenuItem>
                                            <DropdownMenuItem>Agendar Cita</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
