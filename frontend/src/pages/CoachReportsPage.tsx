import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { bffClient } from '@/lib/api/bffClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import {
  BarChart3, Download, TrendingUp, Users, Trophy,
  Calendar, AlertCircle, CheckCircle, Shirt, Swords,
  ChevronUp, ChevronDown, Minus
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Tipos internos ────────────────────────────────────────────────────────────
interface TeamOption {
  id: string;
  name: string;
  age_group?: string;
  coach_id?: string;
  team_coaches?: { coach_id: string }[];
}

interface TeamInfo {
  id: string;
  name: string;
  age_group?: string;
  sport?: string;
}

interface RosterPlayer {
  id: string;
  player_name?: string;
  name?: string;
  player_number?: number | string;
  position?: string;
  profile_id?: string;
}

interface MatchResult {
  id?: string;
  match_date?: string;
  opponent?: string;
  rival?: string;
  result?: string;
  outcome?: string;
  score?: string;
  home_score?: number;
  away_score?: number;
  location?: string;
  venue?: string;
  notes?: string;
}

interface AttendanceRow {
  name: string;
  percentage: number;
}

interface ScorerRow {
  name: string;
  goals: number;
}

interface CoachReport {
  team: TeamInfo;
  roster: RosterPlayer[];
  results: MatchResult[];
  attendance: AttendanceRow[];
  scorers: ScorerRow[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Normaliza el campo resultado de un partido a 'win' | 'loss' | 'draw' | 'unknown' */
function normalizeOutcome(r: MatchResult): 'win' | 'loss' | 'draw' | 'unknown' {
  const raw = (r.result || r.outcome || '').toLowerCase();
  if (['win', 'victoria', 'ganado', 'w'].includes(raw)) return 'win';
  if (['loss', 'derrota', 'perdido', 'l'].includes(raw)) return 'loss';
  if (['draw', 'empate', 'd', 'tie'].includes(raw)) return 'draw';
  return 'unknown';
}

/** Formatea el marcador de un partido */
function formatScore(r: MatchResult): string {
  if (r.score) return r.score;
  if (r.home_score != null && r.away_score != null) return `${r.home_score} - ${r.away_score}`;
  return '—';
}

/** Obtiene el nombre normalizado del jugador desde el roster */
function playerName(p: RosterPlayer): string {
  return p.player_name || p.name || '—';
}

// ─── Sub-componente: Tarjeta KPI ──────────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, sub, iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  iconColor?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-muted/50 ${iconColor || 'text-primary'}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold leading-tight">{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sub-componente: Fila de resultado ────────────────────────────────────────
function ResultRow({ r, index }: { r: MatchResult; index: number }) {
  const outcome = normalizeOutcome(r);
  const config = {
    win: { label: 'Victoria', icon: ChevronUp, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800' },
    loss: { label: 'Derrota', icon: ChevronDown, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
    draw: { label: 'Empate', icon: Minus, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800' },
    unknown: { label: '—', icon: Minus, color: 'text-muted-foreground', bg: 'bg-muted/30', border: 'border-border' },
  }[outcome];

  const OutcomeIcon = config.icon;

  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${config.bg} ${config.border}`}>
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-muted-foreground w-5 text-center">{index + 1}</span>
        <div>
          <p className="text-sm font-semibold">{r.opponent || r.rival || 'Rival desconocido'}</p>
          <p className="text-[11px] text-muted-foreground">
            {r.match_date ? format(new Date(r.match_date), "dd 'de' MMMM yyyy", { locale: es }) : 'Fecha no registrada'}
            {(r.location || r.venue) ? ` · ${r.location || r.venue}` : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-base font-mono font-bold">{formatScore(r)}</span>
        <div className={`flex items-center gap-1 text-xs font-semibold ${config.color}`}>
          <OutcomeIcon className="w-3.5 h-3.5" />
          {config.label}
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CoachReportsPage() {
  const { user } = useAuth();
  const { schoolId } = useSchoolContext();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  // ── 1. Equipos del coach ──────────────────────────────────────────────────
  const {
    data: teams = [],
    isLoading: teamsLoading,
    isError: teamsError,
  } = useQuery<TeamOption[]>({
    queryKey: ['coach-teams', user?.id, schoolId],
    queryFn: async () => {
      if (!user?.id) return [];

      // Buscar staffId vinculado al coach_auth_id (vínculo directo Supabase)
      let staffId: string | null = null;
      if (user.id && schoolId) {
        const { data: staffData } = await supabase
          .from('school_staff')
          .select('id')
          .eq('coach_auth_id', user.id)
          .eq('school_id', schoolId)
          .maybeSingle();
        if (staffData) staffId = staffData.id;
      }

      // Obtener equipos con tabla de relación team_coaches incluida
      const { data: teamsData, error } = await (supabase
        .from('teams')
        .select('id, name, coach_id, age_group, team_coaches(coach_id)')
        .eq('school_id', schoolId) as any);

      if (error) throw error;

      // Filtrar solo los equipos donde el usuario tiene rol de coach
      return ((teamsData || []) as TeamOption[])
        .filter((team) => {
          const isDirectCoach =
            team.coach_id === user.id || (staffId && team.coach_id === staffId);
          const isAssignedInTable = team.team_coaches?.some(
            (tc) => tc.coach_id === user.id || (staffId && tc.coach_id === staffId)
          );
          return isDirectCoach || isAssignedInTable;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 min — los equipos no cambian frecuentemente
  });

  // Auto-seleccionar si el coach solo tiene un equipo asignado
  useEffect(() => {
    if (teams.length === 1 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  // ── 2. Reporte del equipo seleccionado ───────────────────────────────────
  const {
    data: report,
    isLoading: reportLoading,
    isError: reportError,
    error: reportErrorObj,
  } = useQuery<CoachReport>({
    queryKey: ['team-report', selectedTeamId],
    queryFn: () =>
      bffClient.get<CoachReport>(`/api/v1/reports/coach/${selectedTeamId}`),
    enabled: !!selectedTeamId && !selectedTeamId.startsWith('demo-'),
    staleTime: 1000 * 60 * 2, // 2 min
    retry: 2,
  });

  // ── 3. Datos derivados ───────────────────────────────────────────────────
  const teamInfo = report?.team;
  const roster = report?.roster || [];
  const results = report?.results || [];
  const attendanceData = report?.attendance || [];
  const scorerData = report?.scorers || [];

  // KPIs de partidos
  const wins = results.filter((r) => normalizeOutcome(r) === 'win').length;
  const losses = results.filter((r) => normalizeOutcome(r) === 'loss').length;
  const draws = results.filter((r) => normalizeOutcome(r) === 'draw').length;

  // Asistencia promedio real calculada desde los datos del backend
  const avgAttendance =
    attendanceData.length > 0
      ? Math.round(
        attendanceData.reduce((sum, p) => sum + (p.percentage || 0), 0) /
        attendanceData.length
      )
      : 0;

  // Total de jugadores: roster (team_members) puede estar vacío si no se ha poblado esa tabla.
  // En ese caso se usa attendanceData que viene de `children` vinculados al equipo — fuente siempre confiable.
  const totalPlayers = roster.length > 0 ? roster.length : attendanceData.length;

  // Jugadores con asistencia crítica (< 70%)
  const lowAttendanceCount = attendanceData.filter((p) => p.percentage < 70).length;

  // Mes/año actuales dinámicos — reemplaza los textos hardcodeados "Octubre" / "Temporada 2025"
  const currentMonthYear = format(new Date(), "MMMM yyyy", { locale: es });
  const currentYear = format(new Date(), 'yyyy');

  // Nombre visible del equipo
  const selectedTeamName =
    teamInfo?.name ||
    teams.find((t) => t.id === selectedTeamId)?.name ||
    'Equipo';

  // ── 4. Exportar PDF ──────────────────────────────────────────────────────
  function handlePrint() {
    const win = window.open('', '_blank');
    if (!win) return;

    const teamName = teamInfo?.name || selectedTeamName;
    const ageGroup = teamInfo?.age_group || teams.find((t) => t.id === selectedTeamId)?.age_group || '';
    const sport = teamInfo?.sport || '';
    const generated = format(new Date(), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });
    const dateShort = format(new Date(), 'dd/MM/yyyy');

    const kpis = [
      { label: 'Jugadores en Nómina', value: totalPlayers },
      { label: 'Partidos Jugados', value: results.length },
      { label: 'Asistencia Promedio', value: `${avgAttendance}%` },
      { label: 'Victorias', value: wins },
      { label: 'Empates', value: draws },
      { label: 'Derrotas', value: losses },
    ];

    win.document.write(`
<!DOCTYPE html><html lang="es">
<head>
  <meta charset="utf-8">
  <title>Reporte Coach — ${teamName} – ${dateShort}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 28px; }

    .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 6px; }
    .header h1 { font-size: 20px; color: #1a6118; }
    .header .badge { background: #e8f5e9; color: #2e7d32; font-size: 10px; font-weight: 700;
                     padding: 3px 10px; border-radius: 20px; border: 1px solid #a5d6a7; white-space: nowrap; }
    .meta { font-size: 11px; color: #666; margin-bottom: 22px; line-height: 1.6; }
    .meta strong { color: #333; }

    h2 { font-size: 12px; font-weight: 700; margin: 20px 0 8px; color: #1a6118;
         border-bottom: 2px solid #e8f5e9; padding-bottom: 4px;
         text-transform: uppercase; letter-spacing: 0.5px; }

    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 24px; }
    .kpi  { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
    .kpi-label { font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-value { font-size: 24px; font-weight: 700; color: #1a1a1a; margin-top: 2px; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 11px; }
    th { background: #f3f4f6; text-align: left; padding: 6px 8px;
         font-size: 9px; font-weight: 700; color: #666;
         text-transform: uppercase; letter-spacing: 0.4px; }
    td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #fafafa; }

    .bar-wrap { background: #e5e7eb; border-radius: 4px; height: 7px; width: 110px;
                display: inline-block; vertical-align: middle; overflow: hidden; }
    .bar-fill { height: 7px; border-radius: 4px; }
    .bar-ok  { background: #22c55e; }
    .bar-mid { background: #f59e0b; }
    .bar-low { background: #ef4444; }
    .warn { color: #dc2626; font-weight: 700; }
    .win  { color: #15803d; font-weight: 700; }
    .loss { color: #dc2626; font-weight: 700; }
    .draw { color: #b45309; font-weight: 700; }
    .empty { color: #aaa; font-size: 11px; font-style: italic; padding: 8px 0; }

    .footer { text-align: center; font-size: 10px; color: #aaa;
              margin-top: 36px; border-top: 1px solid #e5e7eb; padding-top: 14px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 Reporte de Entrenador — ${teamName}</h1>
    <span class="badge">ROL: COACH</span>
  </div>
  <p class="meta">
    Generado el <strong>${generated}</strong>
    ${ageGroup ? ` · Categoría: <strong>${ageGroup}</strong>` : ''}
    ${sport ? ` · Deporte: <strong>${sport}</strong>` : ''}
  </p>

  <h2>Indicadores del Equipo</h2>
  <div class="kpis">
    ${kpis.map(k => `
      <div class="kpi">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
      </div>`).join('')}
  </div>

  <h2>Asistencia — ${currentMonthYear} (${attendanceData.length} jugadores)</h2>
  ${attendanceData.length === 0
        ? '<p class="empty">Sin registros de asistencia para este equipo.</p>'
        : `<table>
        <thead><tr><th>#</th><th>Jugador</th><th>Asistencia Visual</th><th>% Asistencia</th></tr></thead>
        <tbody>
          ${attendanceData
          .slice()
          .sort((a, b) => b.percentage - a.percentage)
          .map((p, i) => {
            const pct = p.percentage ?? 0;
            const barClass = pct < 70 ? 'bar-low' : pct < 85 ? 'bar-mid' : 'bar-ok';
            const pctClass = pct < 70 ? 'warn' : '';
            return `<tr>
                <td>${i + 1}</td>
                <td>${p.name || '—'}</td>
                <td><span class="bar-wrap"><span class="bar-fill ${barClass}" style="width:${pct}%"></span></span></td>
                <td class="${pctClass}">${pct}%${pct < 70 ? ' ⚠️' : ''}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`}

  <h2>Nómina del Equipo (${totalPlayers} jugadores)</h2>
  ${roster.length === 0
        ? '<p class="empty">Sin jugadores registrados en la nómina.</p>'
        : `<table>
        <thead><tr><th>#</th><th>Nombre</th><th>Número</th><th>Posición</th></tr></thead>
        <tbody>
          ${roster.map((p, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${playerName(p)}</td>
              <td>${p.player_number != null ? `#${p.player_number}` : '—'}</td>
              <td>${p.position || '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`}

  <h2>Resultados de Partidos (${results.length} partidos)</h2>
  ${results.length === 0
        ? '<p class="empty">Sin partidos registrados.</p>'
        : `<table>
        <thead><tr><th>Fecha</th><th>Rival</th><th>Marcador</th><th>Resultado</th><th>Sede / Lugar</th></tr></thead>
        <tbody>
          ${results.map(r => {
          const outcome = normalizeOutcome(r);
          const cls = outcome === 'win' ? 'win' : outcome === 'loss' ? 'loss' : outcome === 'draw' ? 'draw' : '';
          const label = outcome === 'win' ? 'Victoria' : outcome === 'loss' ? 'Derrota' : outcome === 'draw' ? 'Empate' : '—';
          return `<tr>
              <td>${r.match_date ? format(new Date(r.match_date), 'dd/MM/yyyy') : '—'}</td>
              <td>${r.opponent || r.rival || '—'}</td>
              <td>${formatScore(r)}</td>
              <td class="${cls}">${label}</td>
              <td>${r.location || r.venue || '—'}</td>
            </tr>`;
        }).join('')}
        </tbody>
      </table>`}

  <h2>Tabla de Goleadores — Temporada ${currentYear} (${scorerData.length} jugadores)</h2>
  ${scorerData.length === 0
        ? '<p class="empty">Sin datos de goleadores registrados para esta temporada.</p>'
        : `<table>
        <thead><tr><th>Puesto</th><th>Jugador</th><th>Goles</th></tr></thead>
        <tbody>
          ${scorerData.map((p, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${p.name || '—'}</td>
              <td style="font-weight:700">${p.goals ?? 0}</td>
            </tr>`).join('')}
        </tbody>
      </table>`}

  <div class="footer">
    Reporte de solo lectura · SportMaps © ${new Date().getFullYear()} · Generado el ${dateShort}
  </div>
</body></html>`);

    win.document.close();
    setTimeout(() => { win.print(); }, 400);
  }

  // ── 5. Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Encabezado */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Reportes del Equipo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analiza el rendimiento y asistencia de tu equipo
          </p>
        </div>
        <Button
          onClick={handlePrint}
          variant="outline"
          className="gap-2 h-9"
          disabled={!selectedTeamId || reportLoading || !report}
        >
          <Download className="w-3.5 h-3.5" />
          Exportar PDF
        </Button>
      </div>

      {/* Banner: error al cargar equipos */}
      {teamsError && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-300">
            No se pudieron cargar tus equipos. Verifica tu conexión e intenta de nuevo.
          </p>
        </div>
      )}

      {/* Selector de equipo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Seleccionar Equipo</CardTitle>
          {!teamsLoading && teams.length === 0 && !teamsError && (
            <CardDescription className="text-xs text-amber-600">
              No tienes equipos asignados. Contacta al administrador de la escuela.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {teamsLoading ? (
            <div className="h-10 bg-muted/40 rounded animate-pulse" />
          ) : (
            <Select
              value={selectedTeamId}
              onValueChange={setSelectedTeamId}
              disabled={teams.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona tu equipo" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}{team.age_group ? ` — ${team.age_group}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Badges de info del equipo seleccionado */}
      {selectedTeamId && teamInfo && (
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="secondary" className="gap-1.5">
            <Shirt className="w-3 h-3" /> {teamInfo.name}
          </Badge>
          {teamInfo.age_group && (
            <Badge variant="outline" className="gap-1.5">
              <Users className="w-3 h-3" /> {teamInfo.age_group}
            </Badge>
          )}
          {teamInfo.sport && (
            <Badge variant="outline" className="gap-1.5">
              <Trophy className="w-3 h-3" /> {teamInfo.sport}
            </Badge>
          )}
          {lowAttendanceCount > 0 && (
            <Badge variant="destructive" className="gap-1.5">
              <AlertCircle className="w-3 h-3" />
              {lowAttendanceCount} jugador{lowAttendanceCount > 1 ? 'es' : ''} con asistencia crítica
            </Badge>
          )}
        </div>
      )}

      {/* Spinner de carga del reporte */}
      {reportLoading && selectedTeamId && (
        <LoadingSpinner text="Cargando reporte del equipo..." />
      )}

      {/* Banner: error al cargar el reporte */}
      {reportError && selectedTeamId && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-300">
            Error al cargar el reporte:{' '}
            {(reportErrorObj as any)?.message || 'intenta de nuevo en unos momentos.'}
          </p>
        </div>
      )}

      {/* Contenido principal — solo visible si hay equipo, datos y sin errores */}
      {selectedTeamId && !reportLoading && !reportError && report && (
        <>
          {/* ── KPIs ─────────────────────────────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard
              icon={Shirt}
              label="Jugadores"
              value={totalPlayers}
              iconColor="text-blue-600"
            />
            <KpiCard
              icon={Swords}
              label="Partidos"
              value={results.length}
              iconColor="text-purple-600"
            />
            <KpiCard
              icon={CheckCircle}
              label="Asist. Promedio"
              value={`${avgAttendance}%`}
              sub={lowAttendanceCount > 0 ? `${lowAttendanceCount} en alerta` : 'Todos al día'}
              iconColor={avgAttendance < 70 ? 'text-red-500' : 'text-green-600'}
            />
            <KpiCard icon={ChevronUp} label="Victorias" value={wins} iconColor="text-green-600" />
            <KpiCard icon={Minus} label="Empates" value={draws} iconColor="text-yellow-600" />
            <KpiCard icon={ChevronDown} label="Derrotas" value={losses} iconColor="text-red-500" />
          </div>

          {/* ── Tabs ─────────────────────────────────────────────────────── */}
          <Tabs defaultValue="attendance" className="space-y-4">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="attendance" className="gap-1.5 text-xs">
                <CheckCircle className="w-3.5 h-3.5" />
                Asistencia
                {lowAttendanceCount > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {lowAttendanceCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="roster" className="gap-1.5 text-xs">
                <Shirt className="w-3.5 h-3.5" /> Nómina
              </TabsTrigger>
              <TabsTrigger value="results" className="gap-1.5 text-xs">
                <Swords className="w-3.5 h-3.5" /> Resultados
              </TabsTrigger>
              <TabsTrigger value="scorers" className="gap-1.5 text-xs">
                <Trophy className="w-3.5 h-3.5" /> Goleadores
              </TabsTrigger>
            </TabsList>

            {/* ── Tab: Asistencia ────────────────────────────────────────── */}
            <TabsContent value="attendance">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    Asistencia General
                  </CardTitle>
                  <CardDescription>
                    {currentMonthYear} · {attendanceData.length} jugadores
                    {lowAttendanceCount > 0 && (
                      <span className="ml-2 text-red-600 font-medium">
                        · {lowAttendanceCount} por debajo del 70%
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {attendanceData.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Sin registros de asistencia para este equipo.</p>
                    </div>
                  ) : (
                    attendanceData
                      .slice()
                      .sort((a, b) => b.percentage - a.percentage)
                      .map((player) => {
                        const isCritical = player.percentage < 70;
                        const isMid = player.percentage >= 70 && player.percentage < 85;
                        return (
                          <div key={player.name} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{player.name}</p>
                                {isCritical && (
                                  <Badge variant="destructive" className="text-[9px] h-4 px-1.5">
                                    Requiere atención
                                  </Badge>
                                )}
                              </div>
                              <span className={`text-sm font-bold ${isCritical ? 'text-red-600' :
                                isMid ? 'text-yellow-600' :
                                  'text-green-600'}`}>
                                {player.percentage}%
                                {isCritical && ' ⚠️'}
                              </span>
                            </div>
                            <Progress
                              value={player.percentage}
                              className={
                                isCritical ? '[&>div]:bg-red-500 bg-red-100' :
                                  isMid ? '[&>div]:bg-yellow-500 bg-yellow-100' :
                                    '[&>div]:bg-green-500'
                              }
                            />
                          </div>
                        );
                      })
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab: Nómina ────────────────────────────────────────────── */}
            <TabsContent value="roster">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shirt className="w-4 h-4 text-primary" />
                    Nómina del Equipo
                  </CardTitle>
                  <CardDescription>{totalPlayers} jugadores registrados</CardDescription>
                </CardHeader>
                <CardContent>
                  {roster.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Shirt className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Sin jugadores registrados en la nómina.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            {['#', 'Nombre', 'Número', 'Posición'].map((h) => (
                              <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {roster.map((p, i) => (
                            <tr key={p.id || i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                              <td className="px-3 py-2 text-xs font-medium">{playerName(p)}</td>
                              <td className="px-3 py-2 text-xs">
                                {p.player_number != null
                                  ? <span className="font-mono font-bold text-primary">#{p.player_number}</span>
                                  : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {p.position || <span className="text-muted-foreground">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab: Resultados ────────────────────────────────────────── */}
            <TabsContent value="results">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Swords className="w-4 h-4 text-primary" />
                    Resultados de Partidos
                  </CardTitle>
                  <CardDescription>
                    {results.length} partidos · {wins}V {draws}E {losses}D
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {results.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Sin partidos registrados.</p>
                    </div>
                  ) : (
                    results.map((r, i) => <ResultRow key={r.id || i} r={r} index={i} />)
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab: Goleadores ────────────────────────────────────────── */}
            <TabsContent value="scorers">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-primary" />
                    Tabla de Goleadores
                  </CardTitle>
                  <CardDescription>Temporada {currentYear}</CardDescription>
                </CardHeader>
                <CardContent>
                  {scorerData.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-medium">Sin datos de goleadores aún</p>
                      <p className="text-xs mt-1 max-w-xs mx-auto opacity-75">
                        Los goleadores se registrarán en futuras fases del sistema.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {scorerData.map((player, index) => (
                        <div
                          key={player.name}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                              index === 1 ? 'bg-gray-100 text-gray-600' :
                                index === 2 ? 'bg-orange-100 text-orange-600' :
                                  'bg-primary/10 text-primary'}`}>
                              {index + 1}
                            </div>
                            <p className="font-medium text-sm">{player.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold">{player.goals}</p>
                            <p className="text-[10px] text-muted-foreground">goles</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Estado vacío: sin equipo seleccionado */}
      {!selectedTeamId && !teamsLoading && teams.length > 0 && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
            <h3 className="text-base font-semibold mb-1">Selecciona un equipo</h3>
            <p className="text-sm text-muted-foreground">
              Elige un equipo del selector para ver reportes de asistencia, nómina y resultados.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Estado vacío: coach sin equipos asignados */}
      {!teamsLoading && teams.length === 0 && !teamsError && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-400 opacity-60" />
            <h3 className="text-base font-semibold mb-1">Sin equipos asignados</h3>
            <p className="text-sm text-muted-foreground">
              No tienes equipos asignados a tu cuenta. Contacta al administrador de la escuela.
            </p>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
