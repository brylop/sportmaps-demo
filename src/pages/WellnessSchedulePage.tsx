import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Calendar,
    Clock,
    Plus,
    ChevronLeft,
    ChevronRight,
    User,
    MapPin
} from 'lucide-react';

interface Appointment {
    id: string;
    athleteName: string;
    type: string;
    date: string;
    time: string;
    duration: string;
    location: string;
    status: 'confirmed' | 'pending' | 'completed';
}

export default function WellnessSchedulePage() {
    const [currentDate, setCurrentDate] = useState(new Date());

    const appointments: Appointment[] = [
        {
            id: '1',
            athleteName: 'Carlos Martínez',
            type: 'Fisioterapia',
            date: '2026-01-14',
            time: '09:00',
            duration: '60 min',
            location: 'Consultorio 1',
            status: 'confirmed'
        },
        {
            id: '2',
            athleteName: 'María González',
            type: 'Nutrición',
            date: '2026-01-14',
            time: '10:30',
            duration: '45 min',
            location: 'Consultorio 2',
            status: 'confirmed'
        },
        {
            id: '3',
            athleteName: 'Juan Pérez',
            type: 'Evaluación Inicial',
            date: '2026-01-14',
            time: '14:00',
            duration: '90 min',
            location: 'Sala de Evaluación',
            status: 'pending'
        },
        {
            id: '4',
            athleteName: 'Ana López',
            type: 'Seguimiento',
            date: '2026-01-15',
            time: '11:00',
            duration: '30 min',
            location: 'Consultorio 1',
            status: 'confirmed'
        }
    ];

    const todayAppointments = appointments.filter(a => a.date === '2026-01-14');

    const getStatusBadge = (status: Appointment['status']) => {
        switch (status) {
            case 'confirmed':
                return <Badge className="bg-green-500/10 text-green-600">Confirmada</Badge>;
            case 'pending':
                return <Badge className="bg-yellow-500/10 text-yellow-600">Pendiente</Badge>;
            case 'completed':
                return <Badge className="bg-blue-500/10 text-blue-600">Completada</Badge>;
        }
    };

    const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Calendar className="h-8 w-8 text-primary" />
                        Agenda
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Gestiona tus citas y horarios
                    </p>
                </div>
                <Button className="bg-gradient-hero text-white hover:opacity-90">
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Cita
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Calendar Mini */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Enero 2026</CardTitle>
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-7 gap-1 text-center text-sm">
                            {weekDays.map(day => (
                                <div key={day} className="p-2 text-muted-foreground font-medium">
                                    {day}
                                </div>
                            ))}
                            {/* Simplified calendar grid */}
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                <Button
                                    key={day}
                                    variant={day === 14 ? 'default' : 'ghost'}
                                    className={`h-8 w-8 p-0 ${day === 14 ? 'bg-primary text-white' : ''}`}
                                >
                                    {day}
                                </Button>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t">
                            <h4 className="font-medium mb-2">Próximas Citas</h4>
                            <div className="space-y-2">
                                {appointments.slice(0, 3).map(apt => (
                                    <div key={apt.id} className="text-sm flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                        <span className="flex-1 truncate">{apt.athleteName}</span>
                                        <span className="text-muted-foreground">{apt.time}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Today's Schedule */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary" />
                            Hoy - 14 de Enero
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {todayAppointments.length > 0 ? (
                                todayAppointments.map((appointment, index) => (
                                    <div
                                        key={appointment.id}
                                        className="flex gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors animate-in slide-in-from-right"
                                        style={{ animationDelay: `${index * 100}ms` }}
                                    >
                                        <div className="text-center">
                                            <p className="text-lg font-bold">{appointment.time}</p>
                                            <p className="text-xs text-muted-foreground">{appointment.duration}</p>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-semibold">{appointment.athleteName}</h4>
                                                {getStatusBadge(appointment.status)}
                                            </div>
                                            <Badge variant="secondary" className="mb-2">{appointment.type}</Badge>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {appointment.location}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm">Reprogramar</Button>
                                            <Button size="sm">Iniciar</Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No hay citas programadas para hoy</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Weekly Overview */}
            <Card>
                <CardHeader>
                    <CardTitle>Resumen Semanal</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-7 gap-2">
                        {weekDays.map((day, index) => (
                            <div key={day} className="text-center">
                                <p className="text-sm font-medium mb-2">{day}</p>
                                <p className="text-xs text-muted-foreground mb-2">{13 + index}</p>
                                <div className={`h-20 rounded-lg border ${index === 1 ? 'bg-primary/5 border-primary' : 'bg-muted/30'} flex items-center justify-center`}>
                                    <span className="text-sm font-medium">
                                        {index === 1 ? '3 citas' : index < 5 ? `${Math.floor(Math.random() * 3)} citas` : '-'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
