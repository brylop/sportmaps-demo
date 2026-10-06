// Progresión por puntaje en la página de Resultados (F-F,
// docs/specs/dreamers-niveles-por-horas-y-progresion.md D4/D5/D6).
//
//   · Owner: interruptor de school_settings.level_progression_enabled.
//   · Staff (con el flag): "Registrar puntaje individual".
//   · Owner/admin (con el flag): pestaña "Ascensos" — quién cumple el umbral
//     de una tarifa superior esta temporada. "Cambiar plan" lleva a la ficha
//     del atleta en Estudiantes, que es el flujo de cambio de plan que ya
//     existe: nada se cambia solo (D4, sugerido nunca automático).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Medal, Plus, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import {
  useLevelEligibility,
  useLevelProgressionEnabled,
  useSetLevelProgressionEnabled,
} from '@/hooks/useLevelProgression';
import { COMPETITION_LEVEL_LABEL } from '@/lib/school/levelProgression';
import { CompetitionResultFormDialog } from '@/components/coach/CompetitionResultFormDialog';

const TOGGLE_ROLES = ['owner', 'admin', 'super_admin'];
const ADMIN_ROLES = ['owner', 'admin', 'school_admin', 'super_admin'];
const STAFF_ROLES = ['owner', 'admin', 'school_admin', 'super_admin', 'coach', 'staff'];

function formatCop(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  return `$${Math.round(Number(n)).toLocaleString('es-CO')}`;
}

export function LevelProgressionPanel() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { currentUserRole } = useSchoolContext();
  const role = currentUserRole || '';
  const { enabled, isLoading } = useLevelProgressionEnabled();
  const setEnabled = useSetLevelProgressionEnabled();

  const currentYear = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 4));
  const [season, setSeason] = useState(currentYear);
  const [dialogOpen, setDialogOpen] = useState(false);

  const canToggle = TOGGLE_ROLES.includes(role);
  const isAdmin = ADMIN_ROLES.includes(role);
  const isStaff = STAFF_ROLES.includes(role);
  const { data: eligibility, isLoading: loadingEligibility } = useLevelEligibility(season, enabled && isAdmin);

  if (isLoading || !isStaff) return null;
  if (!enabled && !canToggle) return null;

  const onToggle = (v: boolean) => {
    setEnabled.mutate(v, {
      onSuccess: () => toast({ title: v ? 'Progresión por puntaje activada' : 'Progresión por puntaje desactivada' }),
      onError: (err: any) => toast({ title: 'Error', description: err?.message, variant: 'destructive' }),
    });
  };

  const rows = eligibility?.rows ?? [];
  const eligible = rows.filter((r) => r.suggested_plan_id);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-emerald-500" /> Ascensos por puntaje
          </CardTitle>
          <div className="flex items-center gap-3">
            {enabled && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Registrar puntaje individual
              </Button>
            )}
            {canToggle && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={enabled} onCheckedChange={onToggle} disabled={setEnabled.isPending} />
                {enabled ? 'Activa' : 'Inactiva'}
              </label>
            )}
          </div>
        </div>
        {!enabled && (
          <p className="text-xs text-muted-foreground">
            Al activarla, te avisamos cuando un atleta logre el puntaje de ascenso de una tarifa superior
            (se configura en cada tarifa, en “Ascenso y días”). El cambio de tarifa siempre lo confirmas tú.
          </p>
        )}
      </CardHeader>

      {enabled && isAdmin && (
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Temporada</span>
            <Select value={String(season)} onValueChange={(v) => setSeason(Number(v))}>
              <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary">{eligible.length} elegible(s)</Badge>
          </div>

          {loadingEligibility ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aún no hay puntajes cargados por el equipo de la escuela en {season}.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {rows.map((r) => (
                <div key={r.enrollment_id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{r.athlete_name ?? 'Atleta'}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.current_plan_name ?? 'Sin tarifa'} · mejor puntaje <strong>{r.best_points}</strong>
                      {r.best_level ? ` (${COMPETITION_LEVEL_LABEL[r.best_level]})` : ''}
                    </p>
                  </div>
                  {r.suggested_plan_id ? (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 gap-1">
                        <Medal className="h-3 w-3" /> {r.suggested_plan_name} · {formatCop(r.suggested_fee)}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/students?q=${encodeURIComponent(r.athlete_name ?? '')}`)}
                      >
                        Cambiar plan
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Aún no cumple un umbral superior</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Solo cuentan los puntajes cargados por el equipo de la escuela. La tarifa sugerida es la de menor umbral que ya cumple.
          </p>
        </CardContent>
      )}

      {enabled && (
        <CompetitionResultFormDialog open={dialogOpen} onOpenChange={setDialogOpen} initialMode="individual" />
      )}
    </Card>
  );
}
