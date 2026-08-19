import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ClipboardList, Goal, Trophy, Calendar as CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { todayColombia } from '@/lib/dateUtils';
import {
  useTeamMatches,
  useFootballLineup,
  useFootballLineups,
  useCreateTeamMatch,
  useDeleteTeamMatch,
  useTournamentMatches,
} from '@/hooks/useFootballData';
import { LineupModal } from './LineupModal';
import { MatchEventsModal } from './MatchEventsModal';
import { FootballSeasonStats } from './FootballSeasonStats';
import { useTeamPerformanceRoster } from '@/hooks/usePerformanceData';

interface FootballDashboardModalProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
}

const MATCH_TYPES = ['Liga', 'Copa', 'Amistoso', 'Torneo', 'Clasificatorio', 'Final'];

export function FootballDashboardModal({ open, onClose, teamId, teamName }: FootballDashboardModalProps) {
  const { toast } = useToast();
  const { data: matches, isLoading: loadingMatches } = useTeamMatches(teamId);
  const { data: tournamentMatches, isLoading: loadingTournamentMatches } = useTournamentMatches(teamId);
  const createMatch = useCreateTeamMatch();
  const deleteMatch = useDeleteTeamMatch();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [lineupMatch, setLineupMatch] = useState<{ id: string; label: string; sourceType: 'team_match' | 'tournament_match' } | null>(null);
  const [eventsMatch, setEventsMatch] = useState<{ id: string; label: string; sourceType: 'team_match' | 'tournament_match' } | null>(null);

  const eventsLineupList = useFootballLineups({
    source_type: eventsMatch?.sourceType ?? 'team_match',
    source_id: eventsMatch?.id,
  });
  const eventsLineupDetail = useFootballLineup(eventsLineupList.data?.[0]?.id);
  const { data: roster } = useTeamPerformanceRoster({ team_id: teamId });

  const lineupPlayersForEvents = (eventsLineupDetail.data?.players ?? []).map((p) => ({
    subject_type: p.subject_type,
    subject_id: p.subject_id,
    full_name: roster?.subjects.find(
      (s) => s.subject_type === p.subject_type && s.subject_id === p.subject_id
    )?.full_name ?? 'Jugador',
  }));

  const matchLabel = (m: { opponent: string; match_date: string }) =>
    `vs ${m.opponent} · ${format(new Date(m.match_date + 'T12:00:00'), 'PPP', { locale: es })}`;

  const tournamentMatchLabel = (m: any) =>
    `vs ${m.opponent} (Torneo: ${m.event_title}) · ${m.scheduled_at ? format(new Date(m.scheduled_at), 'PPP', { locale: es }) : 'Por definir'}`;

  const handleDeleteMatch = async (matchId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este partido? También se borrarán sus alineaciones y eventos asociados.')) {
      return;
    }
    try {
      await deleteMatch.mutateAsync({ id: matchId, team_id: teamId });
      toast({ title: 'Partido eliminado' });
    } catch (err: any) {
      toast({ title: 'Error al eliminar el partido', description: err.message, variant: 'destructive' });
    }
  };

  const handleCreateMatchSubmit = async (formData: any) => {
    try {
      await createMatch.mutateAsync({
        team_id: teamId,
        opponent: formData.opponent,
        match_date: formData.match_date,
        is_home: formData.is_home,
        match_type: formData.match_type,
        home_score: formData.home_score === '' ? null : Number(formData.home_score),
        away_score: formData.away_score === '' ? null : Number(formData.away_score),
        notes: formData.notes || undefined,
      });
      toast({ title: '✅ Partido programado/creado con éxito' });
      setShowCreateDialog(false);
    } catch (err: any) {
      toast({ title: 'Error al crear el partido', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Panorama de fútbol</DialogTitle>
            <DialogDescription>{teamName}</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="matches" className="flex-1 overflow-hidden flex flex-col">
            <TabsList>
              <TabsTrigger value="matches" className="gap-1.5 text-xs">
                <CalendarIcon className="w-3.5 h-3.5" /> Partidos de Club
              </TabsTrigger>
              <TabsTrigger value="tournaments" className="gap-1.5 text-xs">
                <Trophy className="w-3.5 h-3.5" /> Torneos Oficiales
              </TabsTrigger>
              <TabsTrigger value="stats" className="gap-1.5 text-xs">
                <Trophy className="w-3.5 h-3.5" /> Temporada
              </TabsTrigger>
            </TabsList>

            <TabsContent value="matches" className="flex-1 overflow-y-auto mt-3 space-y-2">
              <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Historial y próximos partidos</span>
                <Button
                  size="sm"
                  className="h-7 gap-1 text-[11px] bg-primary text-primary-foreground"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="w-3.5 h-3.5" /> Programar Partido
                </Button>
              </div>

              {loadingMatches ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                  <span className="text-sm text-muted-foreground">Cargando partidos...</span>
                </div>
              ) : !matches || matches.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <CalendarIcon className="h-8 w-8 text-muted-foreground opacity-40" />
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Este equipo todavía no tiene partidos registrados. Haz clic en "Programar Partido" para crear uno.
                  </p>
                </div>
              ) : (
                matches.map((m) => (
                  <Card key={m.id} className="border">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {m.is_home === false ? 'Visitante' : 'Local'} vs {m.opponent}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span>{format(new Date(m.match_date + 'T12:00:00'), 'PPP', { locale: es })}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-accent/20">
                            {m.match_type}
                          </Badge>
                          {(m.home_score !== null && m.away_score !== null) && (
                            <Badge variant="default" className="text-[10px] h-4 px-1.5 font-bold">
                              {m.home_score}-{m.away_score}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0 items-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => setLineupMatch({ id: m.id, label: matchLabel(m), sourceType: 'team_match' })}
                        >
                          <ClipboardList className="w-3 h-3" /> Alineación
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => setEventsMatch({ id: m.id, label: matchLabel(m), sourceType: 'team_match' })}
                        >
                          <Goal className="w-3 h-3" /> Eventos
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                          onClick={() => handleDeleteMatch(m.id)}
                          disabled={deleteMatch.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="tournaments" className="flex-1 overflow-y-auto mt-3 space-y-2">
              <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Partidos de Torneo Oficial</span>
              </div>

              {loadingTournamentMatches ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                  <span className="text-sm text-muted-foreground">Cargando partidos...</span>
                </div>
              ) : !tournamentMatches || tournamentMatches.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <Trophy className="h-8 w-8 text-muted-foreground opacity-40" />
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Este equipo todavía no tiene partidos de torneo oficial registrados.
                  </p>
                </div>
              ) : (
                tournamentMatches.map((m) => (
                  <Card key={m.id} className="border">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {m.is_home === false ? 'Visitante' : 'Local'} vs {m.opponent}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span>
                            {m.scheduled_at ? format(new Date(m.scheduled_at), 'PPP', { locale: es }) : 'Por definir'}
                          </span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-accent/20">
                            {m.event_title} · Ronda {m.round}
                          </Badge>
                          {(m.home_score !== null && m.away_score !== null) && (
                            <Badge variant="default" className="text-[10px] h-4 px-1.5 font-bold">
                              {m.home_score}-{m.away_score}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0 items-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => setLineupMatch({ id: m.id, label: tournamentMatchLabel(m), sourceType: 'tournament_match' })}
                        >
                          <ClipboardList className="w-3 h-3" /> Alineación
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => setEventsMatch({ id: m.id, label: tournamentMatchLabel(m), sourceType: 'tournament_match' })}
                        >
                          <Goal className="w-3 h-3" /> Eventos
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="stats" className="flex-1 overflow-y-auto mt-3">
              <FootballSeasonStats teamId={teamId} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {showCreateDialog && (
        <CreateMatchDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onSubmit={handleCreateMatchSubmit}
          isPending={createMatch.isPending}
        />
      )}

      {lineupMatch && (
        <LineupModal
          open={!!lineupMatch}
          onClose={() => setLineupMatch(null)}
          teamId={teamId}
          teamName={teamName}
          sourceType={lineupMatch.sourceType}
          sourceId={lineupMatch.id}
          matchLabel={lineupMatch.label}
        />
      )}

      {eventsMatch && (
        <MatchEventsModal
          open={!!eventsMatch}
          onClose={() => setEventsMatch(null)}
          teamId={teamId}
          teamName={teamName}
          sourceType={eventsMatch.sourceType}
          sourceId={eventsMatch.id}
          matchLabel={eventsMatch.label}
          players={lineupPlayersForEvents}
        />
      )}
    </>
  );
}

interface CreateMatchDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (formData: any) => Promise<void>;
  isPending: boolean;
}

function CreateMatchDialog({ open, onClose, onSubmit, isPending }: CreateMatchDialogProps) {
  const [opponent, setOpponent] = useState('');
  const [matchDate, setMatchDate] = useState(todayColombia());
  const [isHome, setIsHome] = useState('true');
  const [matchType, setMatchType] = useState('Amistoso');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!opponent.trim()) return;
    onSubmit({
      opponent: opponent.trim(),
      match_date: matchDate,
      is_home: isHome === 'true',
      match_type: matchType,
      home_score: homeScore,
      away_score: awayScore,
      notes: notes.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle>Programar Partido</DialogTitle>
          <DialogDescription>Registra un nuevo partido para gestionar su alineación y eventos.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="opponent">Nombre del Oponente *</Label>
            <Input
              id="opponent"
              placeholder="Ej: Deportivo Cali Sub-12"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="match_date">Fecha del Partido *</Label>
              <Input
                id="match_date"
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="match_type">Tipo de Partido *</Label>
              <Select value={matchType} onValueChange={setMatchType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATCH_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="condition">Condición</Label>
              <Select value={isHome} onValueChange={setIsHome}>
                <SelectTrigger id="condition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Local</SelectItem>
                  <SelectItem value="false">Visitante</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-3">
            <span className="text-xs text-muted-foreground font-semibold">Marcador (Opcional — dejar en blanco si aún no se ha jugado)</span>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="home_score">Goles Local</Label>
                <Input
                  id="home_score"
                  type="number"
                  placeholder="Sin jugar"
                  min={0}
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="away_score">Goles Visitante</Label>
                <Input
                  id="away_score"
                  type="number"
                  placeholder="Sin jugar"
                  min={0}
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas / Observaciones</Label>
            <Textarea
              id="notes"
              placeholder="Detalles sobre el partido, campo, uniforme..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !opponent.trim()}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Partido'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
