/**
 * /pizarra — la pizarra táctica sin sesión ni partido: se abre y se dibuja de
 * una, sin llenar ningún formulario. Lo dibujado se guarda después con
 * «Guardar ▾» → «Guardar en mis jugadas» o «Agregar a una sesión».
 *
 * La pizarra necesita un equipo (sus jugadores, su deporte y Mis jugadas): se
 * abre con el último equipo usado o, si solo hay uno, con ese. Con varios y
 * sin recuerdo, primero se elige (un toque). Cerrar la pizarra deja elegir otro.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, PenLine, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { fetchCoachTeams, isSchoolAdminRole } from '@/lib/coachTeamScope';
import { teamBoardAccess } from '@/lib/sports/sportCatalog';
import { TacticalBoard } from '@/components/school/TacticalBoard';

interface EquipoP { id: string; name: string; sport: string | null; sport_modality: string | null; age_group: string | null }

const LAST_TEAM_KEY = 'sportmaps_pizarra_libre_team';

function leerUltimo(schoolId: string | null): string | null {
  try {
    const raw = localStorage.getItem(LAST_TEAM_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { schoolId?: string; teamId?: string };
    return v.schoolId === schoolId ? v.teamId ?? null : null;
  } catch {
    return null;
  }
}
function guardarUltimo(schoolId: string | null, teamId: string) {
  try { localStorage.setItem(LAST_TEAM_KEY, JSON.stringify({ schoolId, teamId })); } catch { /* sin almacenamiento: no pasa nada */ }
}

export default function PizarraLibrePage() {
  const { user } = useAuth();
  const { schoolId, currentUserRole } = useSchoolContext();
  const admin = isSchoolAdminRole(currentUserRole);

  const equiposQ = useQuery<EquipoP[]>({
    queryKey: ['pizarra-libre-equipos', schoolId, user?.id, admin],
    enabled: !!schoolId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams').select('id, name, sport, sport_modality, age_group').eq('school_id', schoolId!);
      if (error) throw error;
      let lista = (data ?? []) as EquipoP[];
      if (!admin) {
        const { teamIds } = await fetchCoachTeams(schoolId!);
        const mios = new Set(teamIds);
        lista = lista.filter((t) => mios.has(t.id));
      }
      return lista
        .filter((t) => teamBoardAccess(t).hasTacticalBoard)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
  const equipos = useMemo(() => equiposQ.data ?? [], [equiposQ.data]);

  const [teamId, setTeamId] = useState<string | null>(null);
  const [abierta, setAbierta] = useState(false);
  // Al cargar: el último equipo usado o el único → se abre de una.
  const [autoAbierta, setAutoAbierta] = useState(false);
  useEffect(() => {
    if (autoAbierta || equipos.length === 0) return;
    setAutoAbierta(true);
    const ultimo = leerUltimo(schoolId);
    const elegido = equipos.find((t) => t.id === ultimo) ?? (equipos.length === 1 ? equipos[0] : null);
    if (elegido) { setTeamId(elegido.id); setAbierta(true); }
  }, [equipos, autoAbierta, schoolId]);

  const equipo = equipos.find((t) => t.id === teamId) ?? null;
  const abrir = (id: string) => { setTeamId(id); guardarUltimo(schoolId, id); setAbierta(true); };

  return (
    <div className="mx-auto w-full max-w-page-narrow space-y-4 px-gutter pb-nav-safe pt-4 md:max-w-page md:pb-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <PenLine className="h-6 w-6 text-primary" aria-hidden="true" /> Pizarra
        </h1>
        <p className="text-sm text-muted-foreground">
          Dibuja una jugada sin abrir una sesión. Después la guardas en tus jugadas o la agregas a una sesión.
        </p>
      </header>

      {equiposQ.isPending ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : equiposQ.isError ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm" role="alert">
          <p className="font-semibold">No se pudieron cargar tus equipos.</p>
          <Button variant="outline" className="mt-3 min-h-touch" onClick={() => void equiposQ.refetch()}>Reintentar</Button>
        </div>
      ) : equipos.length === 0 ? (
        <div className="rounded-2xl border bg-card p-5 text-center">
          <p className="font-semibold">Todavía no tienes equipos con pizarra</p>
          <p className="text-sm text-muted-foreground">La pizarra se abre con los jugadores de un equipo.</p>
          <Button asChild variant="outline" className="mt-3 min-h-touch"><Link to="/teams">Ver equipos</Link></Button>
        </div>
      ) : (
        <section aria-label="Equipo de la pizarra" className="space-y-2">
          <p className="text-sm font-semibold">¿Con qué equipo?</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {equipos.map((t) => (
              <li key={t.id}>
                <Button variant={t.id === teamId ? 'default' : 'outline'} className="min-h-12 w-full justify-start gap-2" onClick={() => abrir(t.id)}>
                  <Users className="h-4 w-4" aria-hidden="true" />
                  <span className="truncate">{t.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {equipo && abierta && (
        <TacticalBoard
          open
          scratch
          onClose={() => setAbierta(false)}
          teamId={equipo.id}
          teamName={equipo.name}
          sourceType="training_session"
          sourceId=""
          contextLabel="Pizarra libre"
        />
      )}
    </div>
  );
}
