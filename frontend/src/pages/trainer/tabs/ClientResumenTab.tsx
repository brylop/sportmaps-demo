import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Calendar, Target, CreditCard, Activity, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip, YAxis } from 'recharts';

export function ClientResumenTab({ 
  data, 
  onNewEvaluation,
  onNewSession 
}: { 
  data: any,
  onNewEvaluation?: () => void,
  onNewSession?: () => void
}) {
  const { enrollment, payments, attendance, goals } = data;

  const lastPayment = payments?.[0];
  const lastAttendance = attendance?.[0];
  const activeGoals = goals?.filter((g: any) => g.status !== 'completed') || [];
  const nextGoal = activeGoals.sort((a: any, b: any) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime())[0];

  const planName = enrollment?.offering_plans?.name || 'A demanda';
  
  // Usar ptSummary si existe (vía RPC get_pt_client_summary)
  const sessionsMax = data.ptSummary ? data.ptSummary.max_sessions : (enrollment?.offering_plans?.max_sessions ?? null);
  const sessionsCompleted = data.ptSummary ? data.ptSummary.sessions_completed : (attendance?.filter((a: any) => a.status === 'present').length || 0);
  const sessionsBooked = data.ptSummary ? data.ptSummary.sessions_scheduled : 0;
  const sessionsAvailable = data.ptSummary ? data.ptSummary.sessions_available : (sessionsMax ? sessionsMax - sessionsCompleted : null);

  // Small chart for attendance last 4 weeks
  const attendanceData = [
    { name: 'Sem 1', val: 2 },
    { name: 'Sem 2', val: 3 },
    { name: 'Sem 3', val: 1 },
    { name: 'Sem 4', val: sessionsCompleted > 6 ? 3 : sessionsCompleted }, // Mocked trend
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-2">
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Plan Activo</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold truncate">{planName}</div>
          <div className="flex flex-col gap-1 mt-2">
            <p className="text-xs text-muted-foreground flex justify-between">
              <span>Completadas:</span>
              <span className="font-bold text-foreground">{sessionsCompleted} / {sessionsMax ?? '∞'}</span>
            </p>
            <p className="text-xs text-muted-foreground flex justify-between">
              <span>Agendadas:</span>
              <span className="font-bold text-indigo-400">{sessionsBooked}</span>
            </p>
            {sessionsAvailable !== null && (
              <p className="text-xs font-medium text-primary flex justify-between border-t border-border/50 pt-1 mt-1">
                <span>Disponibles:</span>
                <span>{sessionsAvailable}</span>
              </p>
            )}
          </div>
          <div className="mt-3 h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${sessionsMax ? Math.min(100, (sessionsCompleted / sessionsMax) * 100) : 0}%` }}></div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Última Asistencia</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {lastAttendance ? (
            <>
              <div className="text-xl font-bold">
                {new Date(lastAttendance.attendance_date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                {lastAttendance.status === 'present' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : null}
                {lastAttendance.status === 'present' ? 'Asistió' : lastAttendance.status === 'absent' ? 'Ausente' : 'Otro'}
              </p>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Sin registros recientes</div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Próximo Objetivo</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {nextGoal ? (
            <>
              <div className="text-sm font-bold truncate">{nextGoal.title}</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${nextGoal.progress}%` }}></div>
                </div>
                <span className="text-xs font-medium">{nextGoal.progress}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">Meta: {new Date(nextGoal.target_date).toLocaleDateString('es', { month: 'short', day: 'numeric' })}</p>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">No hay objetivos activos</div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Último Pago</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {lastPayment ? (
            <>
              <div className="text-xl font-bold">{formatCurrency(lastPayment.amount)}</div>
              <Badge variant={lastPayment.status === 'completed' ? 'default' : 'secondary'} className="mt-1">
                {lastPayment.status}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                {lastPayment.payment_date || lastPayment.due_date
                  ? new Date(lastPayment.payment_date ?? lastPayment.due_date).toLocaleDateString('es-CO')
                  : '—'}
              </p>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Sin pagos registrados</div>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2 border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Tendencia de Asistencia</CardTitle>
          <CardDescription>Sesiones por semana (último mes)</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={attendanceData}>
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={30} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ borderRadius: '8px', border: '1px solid #333', backgroundColor: '#111' }} />
              <Bar dataKey="val" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      <Card className="md:col-span-2 border-border/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div 
            className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={onNewEvaluation}
          >
            <span className="text-sm font-medium">Nueva Evaluación</span>
          </div>
          <div 
            className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={onNewSession}
          >
            <span className="text-sm font-medium">Agendar Sesión</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
