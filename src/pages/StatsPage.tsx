import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import {
  BarChart3,
  TrendingUp,
  Trophy,
  Target,
  Calendar,
  Activity,
  Clock,
  Flame
} from 'lucide-react';

export default function StatsPage() {
  const { profile } = useAuth();

  const performanceData = [
    { month: 'Ene', value: 65 },
    { month: 'Feb', value: 72 },
    { month: 'Mar', value: 68 },
    { month: 'Abr', value: 78 },
    { month: 'May', value: 85 },
    { month: 'Jun', value: 82 }
  ];

  const stats = {
    overall: {
      matches: 45,
      wins: 32,
      draws: 8,
      losses: 5,
      goals: 87,
      assists: 34,
      minutesPlayed: 3420
    },
    recent: {
      last5: ['W', 'W', 'D', 'W', 'L'],
      streak: 3,
      form: 85
    },
    personal: {
      topSpeed: 32.5,
      distance: 245.3,
      stamina: 92,
      technique: 88
    }
  };

  const winRate = Math.round((stats.overall.wins / stats.overall.matches) * 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          Estadísticas
        </h1>
        <p className="text-muted-foreground mt-1">
          Tu rendimiento y progreso deportivo
        </p>
      </div>

      {/* Key Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Trophy className="h-8 w-8 text-primary" />
              <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                +12%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Tasa de Victoria</p>
            <p className="text-3xl font-bold">{winRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.overall.wins} victorias en {stats.overall.matches} partidos
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Target className="h-8 w-8 text-orange-500" />
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
                Top 5%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Goles</p>
            <p className="text-3xl font-bold">{stats.overall.goals}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.overall.assists} asistencias
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Flame className="h-8 w-8 text-blue-500" />
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                {stats.recent.streak} partidos
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Racha Actual</p>
            <p className="text-3xl font-bold">{stats.recent.streak}W</p>
            <p className="text-xs text-muted-foreground mt-1">
              Sin perder
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Clock className="h-8 w-8 text-purple-500" />
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">
                57h
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Minutos Jugados</p>
            <p className="text-3xl font-bold">
              {Math.round(stats.overall.minutesPlayed / 60)}h
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Este mes
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          <TabsTrigger value="physical">Físico</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Evolución Mensual
                </CardTitle>
                <CardDescription>
                  Tu rendimiento en los últimos 6 meses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-end justify-between gap-2">
                  {performanceData.map((data, index) => (
                    <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-gradient-to-t from-primary to-primary/50 rounded-t-lg transition-all hover:scale-105 animate-in slide-in-from-bottom"
                        style={{
                          height: `${data.value}%`,
                          animationDelay: `${index * 100}ms`
                        }}
                      />
                      <span className="text-xs text-muted-foreground">{data.month}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Forma Reciente
                </CardTitle>
                <CardDescription>
                  Últimos 5 partidos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 justify-center">
                  {stats.recent.last5.map((result, index) => (
                    <div
                      key={index}
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white animate-in zoom-in ${
                        result === 'W' ? 'bg-green-500' :
                        result === 'D' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {result}
                    </div>
                  ))}
                </div>
                
                <div className="pt-4 border-t">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Forma</span>
                    <span className="text-sm font-medium">{stats.recent.form}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-1000 animate-in slide-in-from-left"
                      style={{ width: `${stats.recent.form}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Estadísticas Detalladas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Partidos Jugados</p>
                  <p className="text-2xl font-bold">{stats.overall.matches}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Victorias / Empates / Derrotas</p>
                  <p className="text-2xl font-bold">
                    {stats.overall.wins} / {stats.overall.draws} / {stats.overall.losses}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Goles + Asistencias</p>
                  <p className="text-2xl font-bold">
                    {stats.overall.goals + stats.overall.assists}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Physical Tab */}
        <TabsContent value="physical" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Capacidades Físicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Resistencia</span>
                    <span className="text-sm font-medium">{stats.personal.stamina}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-600"
                      style={{ width: `${stats.personal.stamina}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Técnica</span>
                    <span className="text-sm font-medium">{stats.personal.technique}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                      style={{ width: `${stats.personal.technique}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Velocidad</span>
                    <span className="text-sm font-medium">{stats.personal.topSpeed} km/h</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-orange-600"
                      style={{ width: '88%' }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métricas de Rendimiento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">Distancia Recorrida</span>
                    <span className="font-bold">{stats.personal.distance} km</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">Velocidad Máxima</span>
                    <span className="font-bold">{stats.personal.topSpeed} km/h</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">Promedio por Partido</span>
                    <span className="font-bold">
                      {(stats.personal.distance / stats.overall.matches).toFixed(1)} km
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Próximamente</CardTitle>
              <CardDescription>
                Historial completo de partidos y eventos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Esta sección estará disponible próximamente
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
