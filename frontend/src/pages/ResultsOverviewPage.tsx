import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Calendar } from 'lucide-react';

export default function ResultsOverviewPage() {
  const isDemoMode = sessionStorage.getItem('demo_mode') === 'true';

  const demoResults = [
    {
      id: '1',
      date: '2025-01-28',
      program: 'Firesquad (Senior L3)',
      sport: 'Cheerleading',
      homeTeam: 'Spirit All Stars - Firesquad',
      awayTeam: 'Campeonato Nacional Zona Centro',
      homeScore: 92,
      awayScore: 0,
      coach: 'María García',
      matchType: 'Campeonato',
    },
    {
      id: '2',
      date: '2025-01-21',
      program: 'Bombsquad (Coed L5)',
      sport: 'Cheerleading',
      homeTeam: 'Spirit All Stars - Bombsquad',
      awayTeam: 'Copa CheerMania',
      homeScore: 96,
      awayScore: 0,
      coach: 'Carlos Rodríguez',
      matchType: 'Copa Regional',
    },
    {
      id: '3',
      date: '2025-01-14',
      program: 'Butterfly (Junior Prep)',
      sport: 'Cheerleading',
      homeTeam: 'Spirit All Stars - Butterfly',
      awayTeam: 'Exhibición Interna',
      homeScore: 88,
      awayScore: 0,
      coach: 'Laura Méndez',
      matchType: 'Exhibición',
    },
  ];

  const results = isDemoMode ? demoResults : [];

  const demoMonthStats = {
    wins: 3,
    draws: 0,
    losses: 0,
  };

  const monthStats = isDemoMode ? demoMonthStats : {
    wins: 0,
    draws: 0,
    losses: 0
  };

  const getResultBadge = (homeScore: number, awayScore: number, isHome: boolean = true) => {
    // For cheerleading, homeScore is the routine score. We display it differently:
    if (homeScore >= 90) {
      return <Badge className="bg-yellow-400 text-black">Oro</Badge>;
    } else if (homeScore >= 85) {
      return <Badge className="bg-gray-300 text-black">Plata</Badge>;
    } else {
      return <Badge className="bg-amber-700 text-white">Bronce</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Resultados</h1>
        <p className="text-muted-foreground">Feed global de competencias y torneos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oros del Mes</CardTitle>
            <Trophy className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{monthStats.wins}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platas</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{monthStats.draws}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bronces</CardTitle>
            <Calendar className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{monthStats.losses}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Resultados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {results.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{result.sport}</Badge>
                    <Badge variant="secondary">{result.matchType}</Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right flex-1">
                      <p className="font-semibold">{result.homeTeam}</p>
                    </div>
                    <div className="text-center px-4">
                      <p className="text-2xl font-bold">
                        {result.homeScore} pts
                      </p>
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold">{result.awayTeam || '-'}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {new Date(result.date).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })} • Registrado por {result.coach}
                  </p>
                </div>
                <div className="ml-4">
                  {getResultBadge(result.homeScore, result.awayScore)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
