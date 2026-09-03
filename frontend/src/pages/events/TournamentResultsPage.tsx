import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ShareButton } from '@/components/marketplace/ShareButton';
import { getPublicResults, PublicResults } from '@/lib/api/tournaments';

/**
 * Resultados públicos de un torneo/liga interna — SIN LOGIN, pensado para
 * compartir por correo/WhatsApp. Ver
 * docs/specs/torneos-internos-inscripcion-pago-2026-09-01.md Fase 3.
 */
export default function TournamentResultsPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const [data, setData] = useState<PublicResults | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!eventId) return;
        getPublicResults(eventId)
            .then(setData)
            .finally(() => setLoading(false));
    }, [eventId]);

    if (loading) return <div className="p-6 text-sm text-muted-foreground">Cargando resultados…</div>;
    if (!data) return <div className="p-6 text-sm text-muted-foreground">No encontramos este torneo.</div>;

    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <CardTitle>🏆 {data.title}</CardTitle>
                            <CardDescription>
                                {data.school_name ? `${data.school_name} · ` : ''}{data.sport} · {data.city} · {data.event_date}
                            </CardDescription>
                        </div>
                        <ShareButton title={`Resultados: ${data.title}`} url={shareUrl} />
                    </div>
                </CardHeader>
                <CardContent>
                    {data.standings.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Todavía no hay partidos jugados.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Equipo</TableHead>
                                        <TableHead className="text-center">PJ</TableHead>
                                        <TableHead className="text-center">G</TableHead>
                                        <TableHead className="text-center">E</TableHead>
                                        <TableHead className="text-center">P</TableHead>
                                        <TableHead className="text-center">GF</TableHead>
                                        <TableHead className="text-center">GC</TableHead>
                                        <TableHead className="text-center">DG</TableHead>
                                        <TableHead className="text-center">Pts</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.standings.map((row) => (
                                        <TableRow key={row.team_id}>
                                            <TableCell className="font-medium">{row.team_name}</TableCell>
                                            <TableCell className="text-center">{row.P}</TableCell>
                                            <TableCell className="text-center">{row.W}</TableCell>
                                            <TableCell className="text-center">{row.D}</TableCell>
                                            <TableCell className="text-center">{row.L}</TableCell>
                                            <TableCell className="text-center">{row.GF}</TableCell>
                                            <TableCell className="text-center">{row.GA}</TableCell>
                                            <TableCell className="text-center">{row.GD}</TableCell>
                                            <TableCell className="text-center font-semibold">{row.Pts}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
