import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  Calendar, CreditCard, Activity, CheckCircle2,
  XCircle, Clock, Flame, Trophy, TrendingUp, Zap,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis,
  Tooltip as RechartTooltip, ResponsiveContainer,
} from 'recharts';
import { getDisplayName } from '@/lib/trainer/muscleGroups';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short',
  });
}

function fmtTime(t?: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T12:00:00-05:00').getTime();
  return Math.ceil((target - Date.now()) / 86400000);
}

// ── Racha: sesiones consecutivas completadas ──────────────────────────────────

function computeStreak(recentSessions: any[]): number {
  const sorted = [...recentSessions].sort(
    (a, b) => b.session_date.localeCompare(a.session_date)
  );
  let streak = 0;
  for (const s of sorted) {
    if (s.status === 'completed') {
      streak++;
    } else if (s.status === 'cancelled') {
      break; // racha rota
    }
    // 'assigned' futuro no rompe ni suma
  }
  return streak;
}

// ── Progreso de carga: ejercicio con más registros ────────────────────────────

function getBestExerciseSeries(stats: any[]) {
  const strengthStats = stats.filter(
    s => s.stat_type?.startsWith('fuerza_') && s.unit === 'kg'
  );
  if (strengthStats.length === 0) return null;

  // Encontrar el stat_type con más registros
  const counts = new Map<string, number>();
  for (const s of strengthStats) {
    counts.set(s.stat_type, (counts.get(s.stat_type) ?? 0) + 1);
  }
  const topType = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!topType) return null;

  const series = strengthStats
    .filter(s => s.stat_type === topType)
    .sort((a, b) => a.stat_date.localeCompare(b.stat_date))
    .map(s => ({
      fecha: fmtDate(s.stat_date),
      kg:    s.value,
    }));

  return { name: getDisplayName(topType), series };
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ClientResumenTab({
  data,
  onNewEvaluation,
  onNewSession,
}: {
  data: any;
  onNewEvaluation?: () => void;
  onNewSession?: () => void;
}) {
  const { enrollment, payments, attendance, stats } = data;
  const ptSummary     = data.ptSummary;
  const nextSession   = data.next_session ?? null;
  const recentSessions: any[] = data.recent_sessions ?? [];

  const lastPayment = payments?.[0];

  // Plan Activo
  const planName          = enrollment?.offering_plans?.name ?? 'A demanda';
  const maxSessions       = ptSummary?.max_sessions ?? null;
  const sessionsUsed      = ptSummary?.sessions_used ?? 0;
  const sessionsCompleted = ptSummary?.sessions_completed ?? 0;
  const sessionsAvailable = ptSummary?.sessions_available ?? null;
  const isUnlimited       = ptSummary?.is_unlimited ?? false;
  const progressPct       = maxSessions ? Math.min(100, (sessionsUsed / maxSessions) * 100) : 0;

  // Asistencias — última presente
  const lastAttendance = useMemo(() => {
    const lastRecord = (attendance ?? [])
      .filter((a: any) => a.status === 'present')
      .sort((a: any, b: any) => b.attendance_date.localeCompare(a.attendance_date))[0];

    const lastPT = recentSessions
      .filter((s: any) => s.status === 'completed')
      .sort((a: any, b: any) => b.session_date.localeCompare(a.session_date))[0];

    if (!lastRecord && !lastPT) return null;
    if (!lastRecord) return { attendance_date: lastPT.session_date };
    if (!lastPT)     return lastRecord;

    return lastRecord.attendance_date >= lastPT.session_date
      ? lastRecord
      : { attendance_date: lastPT.session_date };
  }, [attendance, recentSessions]);

  // Racha
  const streak = useMemo(() => computeStreak(recentSessions), [recentSessions]);

  // Progreso de carga
  const exerciseProgress = useMemo(() => getBestExerciseSeries(stats ?? []), [stats]);

  // Vencimiento del plan
  const daysLeft = daysUntil(ptSummary?.expires_at ?? null);

  // Status badge del pago
  const paymentStatusLabel: Record<string, string> = {
    paid:             'Pagado',
    completed:        'Pagado',
    pending:          'Pendiente',
    awaiting_approval:'En aprobación',
    overdue:          'Vencido',
    failed:           'Fallido',
    rejected:         'Rechazado',
    cancelled:        'Cancelado',
  };
  const paymentStatusColor: Record<string, string> = {
    paid:             'bg-green-500/10 text-green-600',
    completed:        'bg-green-500/10 text-green-600',
    pending:          'bg-amber-500/10 text-amber-600',
    awaiting_approval:'bg-orange-500/10 text-orange-600',
    overdue:          'bg-red-500/10 text-red-600',
    failed:           'bg-red-500/10 text-red-600',
    rejected:         'bg-red-500/10 text-red-600',
    cancelled:        'bg-muted text-muted-foreground',
  };

  // Historial de sesiones — solo las que tienen fecha pasada o son futuras asignadas
  const sessionHistory = useMemo(() =>
    [...recentSessions].sort(
      (a, b) => b.session_date.localeCompare(a.session_date)
    )
  , [recentSessions]);

  const sessionStatusConfig: Record<string, { icon: any; color: string; label: string }> = {
    completed: { icon: CheckCircle2, color: 'text-green-500', label: 'Completada' },
    assigned:  { icon: Clock,        color: 'text-blue-500',  label: 'Agendada'   },
    cancelled: { icon: XCircle,      color: 'text-red-400',   label: 'Cancelada'  },
  };

  return (
    <div className="space-y-4 mt-2">

      {/* ── Fila 1: 4 tarjetas ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        {/* Plan Activo */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Plan Activo</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{planName}</div>
            <div className="flex flex-col gap-1 mt-2">
              <p className="text-xs text-muted-foreground flex justify-between">
                <span>Completadas:</span>
                <span className="font-bold text-foreground">
                  {sessionsCompleted} / {isUnlimited ? '∞' : (maxSessions ?? '—')}
                </span>
              </p>
              {!isUnlimited && sessionsAvailable !== null && (
                <p className="text-xs font-medium text-primary flex justify-between border-t border-border/50 pt-1 mt-1">
                  <span>Disponibles:</span>
                  <span>{sessionsAvailable}</span>
                </p>
              )}
              {isUnlimited && (
                <p className="text-xs font-medium text-primary flex justify-between border-t border-border/50 pt-1 mt-1">
                  <span>Plan:</span>
                  <span>Ilimitado ∞</span>
                </p>
              )}
            </div>
            {!isUnlimited && maxSessions && (
              <div className="mt-3 h-2 w-full bg-secondary rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${(sessionsCompleted / maxSessions) * 100}%` }}
                />
                <div
                  className="h-full bg-amber-500/70 transition-all"
                  style={{ width: `${((sessionsAvailable ?? 0) / maxSessions) * 100}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Asistencias */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Asistencias</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Última */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Última
              </p>
              {lastAttendance ? (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  <span className="text-sm font-bold">
                    {fmtDate(lastAttendance.attendance_date)}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin registros</p>
              )}
            </div>

            <div className="w-full h-px bg-border/40" />

            {/* Próxima */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Próxima
              </p>
              {nextSession ? (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-sm font-bold leading-none">
                      {fmtDate(nextSession.session_date)}
                    </p>
                    {nextSession.session_time && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {fmtTime(nextSession.session_time)}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin sesión agendada</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Racha */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Racha</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-4xl font-black text-orange-500 leading-none">
                {streak}
              </span>
              <span className="text-sm text-muted-foreground mb-1">
                sesión{streak !== 1 ? 'es' : ''}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {streak === 0
                ? 'Sin racha activa'
                : streak >= 5
                  ? '🔥 ¡Excelente constancia!'
                  : streak >= 3
                    ? '💪 ¡Sigue así!'
                    : 'Consecutivas completadas'}
            </p>
            {recentSessions.length > 0 && (
              <div className="flex gap-1 mt-3">
                {[...recentSessions]
                  .sort((a, b) => a.session_date.localeCompare(b.session_date))
                  .slice(-6)
                  .map((s, i) => (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded-full ${
                        s.status === 'completed' ? 'bg-orange-500'
                        : s.status === 'cancelled' ? 'bg-red-400/50'
                        : 'bg-blue-400/50'
                      }`}
                    />
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estado del Plan (pago + vencimiento) */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Estado del Plan</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {lastPayment ? (
              <>
                <div className="text-xl font-bold">
                  {formatCurrency(lastPayment.amount)}
                </div>
                <Badge
                  className={`text-[10px] font-bold ${
                    paymentStatusColor[lastPayment.status] ?? 'bg-muted text-muted-foreground'
                  }`}
                >
                  {paymentStatusLabel[lastPayment.status] ?? lastPayment.status}
                </Badge>
                <p className="text-[10px] text-muted-foreground">
                  {lastPayment.payment_date
                    ? `Pago: ${fmtDate(lastPayment.payment_date)}`
                    : lastPayment.due_date
                      ? `Vence: ${fmtDate(lastPayment.due_date)}`
                      : '—'}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Sin pagos registrados</p>
            )}

            {daysLeft !== null && (
              <div className={`mt-2 pt-2 border-t border-border/40 flex items-center gap-1.5 text-xs font-medium ${
                daysLeft <= 7 ? 'text-red-500' : daysLeft <= 15 ? 'text-amber-500' : 'text-muted-foreground'
              }`}>
                <Calendar className="h-3 w-3" />
                {daysLeft > 0
                  ? `Plan vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`
                  : 'Plan vencido'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Fila 2: Progreso de Carga + Historial ── */}
      <div className="grid gap-4 md:grid-cols-5">

        {/* Progreso de Carga */}
        <Card className="md:col-span-3 border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Progreso de Carga</CardTitle>
            </div>
            {exerciseProgress && (() => {
              const series = exerciseProgress.series;
              const first = series[0]?.kg;
              const last  = series[series.length - 1]?.kg;
              const delta = last != null && first != null ? +(last - first).toFixed(1) : null;

              return (
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground truncate">
                    {exerciseProgress.name}
                  </p>
                  {delta !== null && (
                    <span className={`text-xs font-bold flex items-center gap-0.5 shrink-0 whitespace-nowrap ${
                      delta > 0 ? 'text-green-500' : delta < 0 ? 'text-red-400' : 'text-muted-foreground'
                    }`}>
                      {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'}
                      {delta > 0 ? '+' : ''}{delta} kg
                    </span>
                  )}
                </div>
              );
            })()}
          </CardHeader>
          <CardContent>
            {exerciseProgress && exerciseProgress.series.length >= 2 ? (
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={exerciseProgress.series}
                    margin={{ left: -10, right: 8, top: 8, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="fecha"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      width={30}
                      unit=" kg"
                    />
                    <RechartTooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: '8px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--background))',
                      }}
                      formatter={(val: any) => [`${val} kg`, exerciseProgress.name]}
                    />
                    <Line
                      type="monotone"
                      dataKey="kg"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                      animationDuration={800}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[160px] flex flex-col items-center justify-center text-center text-muted-foreground border-2 border-dashed border-border/40 rounded-xl">
                <Trophy className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">Sin suficientes datos de carga</p>
                <p className="text-xs opacity-60 mt-1">
                  Completa sesiones con ejercicios de fuerza para ver el progreso
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Historial de Sesiones Recientes */}
        <Card className="md:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Sesiones Recientes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {sessionHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground px-4">
                <Calendar className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-xs">Sin sesiones registradas</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {sessionHistory.map((s: any) => {
                  const cfg = sessionStatusConfig[s.status] ?? sessionStatusConfig.assigned;
                  const Icon = cfg.icon;
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                      <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {fmtDate(s.session_date)}
                          {s.session_time ? ` · ${fmtTime(s.session_time)}` : ''}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] h-4 px-1.5 shrink-0 ${
                          s.status === 'completed' ? 'border-green-500/30 text-green-600'
                          : s.status === 'cancelled' ? 'border-red-400/30 text-red-400'
                          : 'border-blue-500/30 text-blue-500'
                        }`}
                      >
                        {cfg.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
