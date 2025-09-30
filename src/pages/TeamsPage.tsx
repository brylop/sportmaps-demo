import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PermissionGate } from '@/components/PermissionGate';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Users,
  Trophy,
  Search,
  Plus,
  Calendar,
  MapPin,
  TrendingUp,
  Star,
  Filter
} from 'lucide-react';

interface Team {
  id: string;
  name: string;
  sport: string;
  category: string;
  players: number;
  coach: string;
  wins: number;
  losses: number;
  image?: string;
  nextMatch?: {
    opponent: string;
    date: string;
    location: string;
  };
}

const mockTeams: Team[] = [
  {
    id: '1',
    name: 'Fútbol Sub-17',
    sport: 'Fútbol',
    category: 'Sub-17',
    players: 22,
    coach: 'Carlos Rodríguez',
    wins: 12,
    losses: 3,
    nextMatch: {
      opponent: 'Academia Norte',
      date: '2025-10-05',
      location: 'Estadio Municipal'
    }
  },
  {
    id: '2',
    name: 'Baloncesto U-15',
    sport: 'Baloncesto',
    category: 'Sub-15',
    players: 15,
    coach: 'Ana Martínez',
    wins: 8,
    losses: 5,
    nextMatch: {
      opponent: 'Club Deportivo',
      date: '2025-10-06',
      location: 'Coliseo Central'
    }
  },
  {
    id: '3',
    name: 'Voleibol Femenino',
    sport: 'Voleibol',
    category: 'Juvenil',
    players: 12,
    coach: 'Laura Sánchez',
    wins: 10,
    losses: 2
  },
  {
    id: '4',
    name: 'Atletismo',
    sport: 'Atletismo',
    category: 'General',
    players: 18,
    coach: 'Miguel Torres',
    wins: 15,
    losses: 1
  }
];

export default function TeamsPage() {
  const { can } = usePermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState<string>('all');

  const filteredTeams = mockTeams.filter(team => {
    const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         team.sport.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSport = selectedSport === 'all' || team.sport === selectedSport;
    return matchesSearch && matchesSport;
  });

  const sports = ['all', ...new Set(mockTeams.map(t => t.sport))];

  const getWinRate = (team: Team) => {
    const total = team.wins + team.losses;
    return total > 0 ? Math.round((team.wins / total) * 100) : 0;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Mis Equipos
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus equipos y deportistas
          </p>
        </div>
        
        <PermissionGate permission="teams:create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Equipo
          </Button>
        </PermissionGate>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Equipos</p>
                <p className="text-2xl font-bold">{mockTeams.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Deportistas</p>
                <p className="text-2xl font-bold">
                  {mockTeams.reduce((sum, t) => sum + t.players, 0)}
                </p>
              </div>
              <Star className="h-8 w-8 text-orange-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Victorias</p>
                <p className="text-2xl font-bold">
                  {mockTeams.reduce((sum, t) => sum + t.wins, 0)}
                </p>
              </div>
              <Trophy className="h-8 w-8 text-green-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">% Victoria</p>
                <p className="text-2xl font-bold">
                  {Math.round(
                    mockTeams.reduce((sum, t) => sum + getWinRate(t), 0) / mockTeams.length
                  )}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar equipos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          {sports.map(sport => (
            <Button
              key={sport}
              variant={selectedSport === sport ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedSport(sport)}
              className="capitalize"
            >
              {sport === 'all' ? 'Todos' : sport}
            </Button>
          ))}
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {filteredTeams.map((team, index) => (
          <Card
            key={team.id}
            className="hover:shadow-lg transition-all duration-300 animate-in slide-in-from-bottom"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={team.image} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {team.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    <CardDescription>{team.category}</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary">{team.sport}</Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{team.wins}</p>
                  <p className="text-xs text-muted-foreground">Victorias</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{team.losses}</p>
                  <p className="text-xs text-muted-foreground">Derrotas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{getWinRate(team)}%</p>
                  <p className="text-xs text-muted-foreground">Efectividad</p>
                </div>
              </div>

              {/* Team Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{team.players} jugadores</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <span>Entrenador: {team.coach}</span>
                </div>
              </div>

              {/* Next Match */}
              {team.nextMatch && (
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Próximo Partido
                  </p>
                  <div className="space-y-1">
                    <p className="font-medium text-sm">vs {team.nextMatch.opponent}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(team.nextMatch.date).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long'
                      })}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {team.nextMatch.location}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="default" className="flex-1" size="sm">
                  Ver Detalles
                </Button>
                <PermissionGate permission="teams:edit">
                  <Button variant="outline" size="sm">
                    Editar
                  </Button>
                </PermissionGate>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredTeams.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No se encontraron equipos</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? 'Intenta con otros términos de búsqueda'
                : 'Crea tu primer equipo para comenzar'}
            </p>
            <PermissionGate permission="teams:create">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Crear Equipo
              </Button>
            </PermissionGate>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
