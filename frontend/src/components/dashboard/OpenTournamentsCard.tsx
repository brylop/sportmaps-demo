import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowRight } from 'lucide-react';
import { getMyOpenTournaments, OpenTournament } from '@/lib/api/tournaments';

/**
 * Tarjeta del Dashboard: torneos/ligas internas ABIERTAS en las escuelas del
 * padre/atleta. Self-contained (no renderiza nada si no aplica), mismo patrón
 * que ActivateStoreCTA. Ver
 * docs/specs/torneos-internos-inscripcion-pago-2026-09-01.md Fase 3.
 */
export function OpenTournamentsCard() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [tournaments, setTournaments] = useState<OpenTournament[]>([]);
    const [loading, setLoading] = useState(true);

    const eligible = profile?.role === 'parent' || profile?.role === 'athlete';

    useEffect(() => {
        if (!eligible) { setLoading(false); return; }
        getMyOpenTournaments()
            .then(setTournaments)
            .catch(() => setTournaments([]))
            .finally(() => setLoading(false));
    }, [eligible]);

    if (!eligible || loading || tournaments.length === 0) return null;

    return (
        <Card className="border-amber-200 dark:border-amber-900/30 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 dark:from-amber-950/30 dark:via-card dark:to-amber-950/15">
            <CardContent className="p-5">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                        <Trophy className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                        <h3 className="font-semibold text-foreground">
                            {tournaments.length === 1 ? 'Torneo/liga abierto' : 'Torneos/ligas abiertos'}
                        </h3>
                        {tournaments.map((t) => (
                            <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border bg-background/60 px-3 py-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{t.title}</p>
                                    <p className="text-xs text-muted-foreground truncate">{t.sport} · {t.city} · {t.event_date}</p>
                                </div>
                                <Button
                                    size="sm"
                                    className="shrink-0 bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white"
                                    onClick={() => navigate(`/tournaments/${t.id}/register`)}
                                >
                                    Inscribirme
                                    <ArrowRight className="ml-1.5 h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
