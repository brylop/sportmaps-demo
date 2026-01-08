import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Calendar } from 'lucide-react';

export default function ResultsOverviewPage() {
  const results = [
    {
      id: '1',
      date: '2024-10-25',
      program: 'Fútbol Sub-12',
      sport: 'Fútbol',
      homeTeam: 'SportMaps Sub-12',
      awayTeam: 'Tigres FC',
      homeScore: 2,
      awayScore: 2,
      coach: 'Luis F. Rodríguez',
      matchType: 'Amistoso',
    },
    {
      id: '2',
      date: '2024-10-24',
      program: 'Tenis Infantil',
      sport: 'Tenis',
      homeTeam: 'Torneo Inter-clubes',
      awayTeam: '',
      homeScore: 3,
      awayScore: 0,
      coach: 'Diana Silva',
      matchType: 'Torneo',
    },
    {
      id: '3',
      date: '2024-10-18',
      program: 'Fútbol Sub-12',
      sport: 'Fútbol',
      homeTeam: 'SportMaps Sub-12',
      awayTeam: 'Leones',
      homeScore: 3,
      awayScore: 1,
      coach: 'Luis F. Rodríguez',
      matchType: 'Liga',
    },
  ];

  const monthStats = {
    wins: 2,
    draws: 1,
    losses: 0,
  };

  const getResultBadge = (homeScore: number, awayScore: number, isHome: boolean = true) => {
    if (homeScore > awayScore) {
      return <Badge className="bg-green-500">Victoria</Badge>;
    } else if (homeScore === awayScore) {
      return <Badge variant="secondary">Empate</Badge>;
    } else {
      return <Badge variant="destructive">Derrota</Badge>;
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
            <CardTitle className="text-sm font-medium">Victorias del Mes</CardTitle>
            <Trophy className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{monthStats.wins}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empates</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{monthStats.draws}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Derrotas</CardTitle>
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
                        {result.homeScore} - {result.awayScore}
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
