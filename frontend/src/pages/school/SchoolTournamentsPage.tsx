import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Plus, Users, Calendar, MapPin } from 'lucide-react';

interface SchoolTournament {
  id: string;
  title: string;
  sport: string;
  event_date: string;
  city: string;
  slug: string;
  status: string;
  visibility: 'public' | 'invited_only' | 'school_only';
  tournament_scope: 'internal' | 'external' | null;
  payer_mode: 'school' | 'parent' | 'flexible' | null;
  image_url?: string | null;
  created_at: string;
  delegations?: { count: number }[];
}

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Borrador', variant: 'outline' },
  active: { label: 'Activo', variant: 'default' },
  closed: { label: 'Cerrado', variant: 'secondary' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
  completed: { label: 'Finalizado', variant: 'secondary' },
};

const SCOPE_LABEL: Record<string, string> = { internal: 'Interno', external: 'Externo' };
const VISIBILITY_LABEL: Record<string, string> = {
  public: 'Público',
  invited_only: 'Por invitación',
  school_only: 'Solo mi escuela',
};

export default function SchoolTournamentsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<SchoolTournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await bffClient.get<SchoolTournament[]>('/api/v1/events/school-tournaments');
        setItems(data);
      } catch (err: any) {
        toast({ title: 'Error', description: err?.message ?? 'No se pudieron cargar los torneos.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mis Torneos</h1>
            <p className="text-sm text-muted-foreground">Torneos organizados por tu escuela.</p>
          </div>
        </div>
        <Button onClick={() => navigate('/school/tournaments/new')}>
          <Plus className="mr-1 h-4 w-4" /> Crear torneo
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Aún no has creado torneos</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Crea un torneo interno con tus propios equipos o uno externo para competir contra otras academias.
            </p>
            <Button onClick={() => navigate('/school/tournaments/new')}>
              <Plus className="mr-1 h-4 w-4" /> Crear mi primer torneo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((t) => {
            const st = STATUS_LABEL[t.status] ?? { label: t.status, variant: 'outline' as const };
            const delegCount = t.delegations?.[0]?.count ?? 0;
            return (
              <Card key={t.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(`/school/tournaments/${t.id}`)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{t.title}</CardTitle>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{t.sport}</Badge>
                    {t.tournament_scope && <Badge variant="outline">{SCOPE_LABEL[t.tournament_scope]}</Badge>}
                    <Badge variant="outline">{VISIBILITY_LABEL[t.visibility]}</Badge>
                  </div>
                  <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(t.event_date)}</div>
                  <div className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {t.city}</div>
                  {/* Interno no tiene "delegaciones" reales — event_delegations solo
                      guarda ahí un ancla técnica para poder armar equipos (ver RPC
                      assign_registrants_to_teams). Mostrar ese conteo confunde a la
                      escuela ("¿qué delegación, si esto es solo mi escuela?"). */}
                  {t.tournament_scope !== 'internal' && (
                    <div className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {delegCount} delegación(es)</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
