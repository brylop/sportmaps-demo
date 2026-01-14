import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import {
    Target,
    Trophy,
    TrendingUp,
    Calendar,
    CheckCircle2,
    Circle,
    Plus,
    Star,
    Zap,
    Medal
} from 'lucide-react';

interface Goal {
    id: string;
    title: string;
    description: string;
    category: 'performance' | 'fitness' | 'skill' | 'team';
    progress: number;
    target: number;
    unit: string;
    deadline: string;
    status: 'active' | 'completed' | 'pending';
}

export default function GoalsPage() {
    const { profile } = useAuth();

    const goals: Goal[] = [
        {
            id: '1',
            title: 'Mejorar velocidad de sprint',
            description: 'Reducir tiempo de 100m a menos de 12 segundos',
            category: 'fitness',
            progress: 75,
            target: 100,
            unit: '%',
            deadline: '2026-03-01',
            status: 'active'
        },
        {
            id: '2',
            title: 'Marcar 20 goles esta temporada',
            description: 'Aumentar promedio de goles por partido',
            category: 'performance',
            progress: 12,
            target: 20,
            unit: 'goles',
            deadline: '2026-06-30',
            status: 'active'
        },
        {
            id: '3',
            title: 'Dominar tiro libre',
            description: 'Mejorar precisión en tiros libres al 80%',
            category: 'skill',
            progress: 65,
            target: 80,
            unit: '%',
            deadline: '2026-04-15',
            status: 'active'
        },
        {
            id: '4',
            title: 'Asistir a todos los entrenamientos',
            description: 'Mantener 100% de asistencia mensual',
            category: 'team',
            progress: 100,
            target: 100,
            unit: '%',
            deadline: '2026-01-31',
            status: 'completed'
        }
    ];

    const achievements = [
        { icon: Trophy, title: 'MVP del Mes', date: 'Diciembre 2025', color: 'text-yellow-500' },
        { icon: Medal, title: '10 Partidos Invicto', date: 'Noviembre 2025', color: 'text-blue-500' },
        { icon: Star, title: 'Mejor Anotador', date: 'Octubre 2025', color: 'text-orange-500' }
    ];

    const getCategoryColor = (category: Goal['category']) => {
        switch (category) {
            case 'performance': return 'bg-orange-500/10 text-orange-600';
            case 'fitness': return 'bg-green-500/10 text-green-600';
            case 'skill': return 'bg-blue-500/10 text-blue-600';
            case 'team': return 'bg-purple-500/10 text-purple-600';
        }
    };

    const getCategoryLabel = (category: Goal['category']) => {
        switch (category) {
            case 'performance': return 'Rendimiento';
            case 'fitness': return 'Físico';
            case 'skill': return 'Técnica';
            case 'team': return 'Equipo';
        }
    };

    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g => g.status === 'completed');
    const overallProgress = Math.round(
        goals.reduce((acc, g) => acc + (g.progress / g.target) * 100, 0) / goals.length
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Target className="h-8 w-8 text-primary" />
                        Objetivos
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Define y alcanza tus metas deportivas
                    </p>
                </div>
                <Button className="bg-gradient-hero text-white hover:opacity-90">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Objetivo
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <Target className="h-8 w-8 text-primary" />
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                                Activos
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Objetivos Activos</p>
                        <p className="text-3xl font-bold">{activeGoals.length}</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                            <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                                +2 este mes
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Completados</p>
                        <p className="text-3xl font-bold">{completedGoals.length}</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <TrendingUp className="h-8 w-8 text-blue-500" />
                            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                                En camino
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Progreso General</p>
                        <p className="text-3xl font-bold">{overallProgress}%</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <Trophy className="h-8 w-8 text-yellow-500" />
                            <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
                                Récord
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Logros Desbloqueados</p>
                        <p className="text-3xl font-bold">{achievements.length}</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="active" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="active">Activos</TabsTrigger>
                    <TabsTrigger value="completed">Completados</TabsTrigger>
                    <TabsTrigger value="achievements">Logros</TabsTrigger>
                </TabsList>

                {/* Active Goals Tab */}
                <TabsContent value="active" className="space-y-4">
                    <div className="grid gap-4">
                        {activeGoals.map((goal, index) => (
                            <Card
                                key={goal.id}
                                className="animate-in slide-in-from-bottom"
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                <CardContent className="p-6">
                                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge className={getCategoryColor(goal.category)}>
                                                    {getCategoryLabel(goal.category)}
                                                </Badge>
                                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(goal.deadline).toLocaleDateString('es-ES', {
                                                        day: 'numeric',
                                                        month: 'short'
                                                    })}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-semibold">{goal.title}</h3>
                                            <p className="text-sm text-muted-foreground">{goal.description}</p>
                                        </div>

                                        <div className="w-full md:w-48 space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span>{goal.progress} / {goal.target} {goal.unit}</span>
                                                <span className="font-medium">
                                                    {Math.round((goal.progress / goal.target) * 100)}%
                                                </span>
                                            </div>
                                            <Progress
                                                value={(goal.progress / goal.target) * 100}
                                                className="h-2"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* Completed Goals Tab */}
                <TabsContent value="completed" className="space-y-4">
                    <div className="grid gap-4">
                        {completedGoals.map((goal, index) => (
                            <Card
                                key={goal.id}
                                className="border-green-500/20 bg-green-500/5 animate-in slide-in-from-bottom"
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-4">
                                        <CheckCircle2 className="h-8 w-8 text-green-500 flex-shrink-0" />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge className={getCategoryColor(goal.category)}>
                                                    {getCategoryLabel(goal.category)}
                                                </Badge>
                                            </div>
                                            <h3 className="text-lg font-semibold">{goal.title}</h3>
                                            <p className="text-sm text-muted-foreground">{goal.description}</p>
                                        </div>
                                        <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                                            Completado
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* Achievements Tab */}
                <TabsContent value="achievements" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        {achievements.map((achievement, index) => (
                            <Card
                                key={achievement.title}
                                className="animate-in zoom-in"
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                <CardContent className="p-6 text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-full flex items-center justify-center">
                                        <achievement.icon className={`h-8 w-8 ${achievement.color}`} />
                                    </div>
                                    <h3 className="font-semibold">{achievement.title}</h3>
                                    <p className="text-sm text-muted-foreground">{achievement.date}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
