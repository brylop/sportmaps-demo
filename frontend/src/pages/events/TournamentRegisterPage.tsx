import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import { BFFError } from '@/lib/api/bffClient';
import {
    getForParticipant, register as registerForTournament,
    TournamentForParticipant, MyRegistration,
} from '@/lib/api/tournaments';
import { PaymentCheckoutModal } from '@/components/payment/PaymentCheckoutModal';

interface ChildOption { id: string; full_name: string; }

/**
 * Inscripción + pago a un torneo/liga INTERNA de la propia escuela.
 * Ver docs/specs/torneos-internos-inscripcion-pago-2026-09-01.md Fase 3.
 */
export default function TournamentRegisterPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [tournament, setTournament] = useState<TournamentForParticipant | null>(null);
    const [loading, setLoading] = useState(true);
    const [children, setChildren] = useState<ChildOption[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string>('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [checkoutReg, setCheckoutReg] = useState<MyRegistration | null>(null);

    const isParent = profile?.role === 'parent';
    const isAthlete = profile?.role === 'athlete';

    useEffect(() => {
        if (!eventId) return;
        (async () => {
            try {
                const data = await getForParticipant(eventId);
                setTournament(data);
                if (isParent && data.school_id && user?.id) {
                    const { data: kids } = await supabase
                        .from('children')
                        .select('id, full_name')
                        .eq('parent_id', user.id)
                        .eq('school_id', data.school_id)
                        .eq('is_active', true);
                    setChildren(kids || []);
                    if ((kids || []).length === 1) setSelectedChildId(kids![0].id);
                }
            } catch (err: any) {
                const message = err instanceof BFFError ? err.message : 'No se pudo cargar el torneo.';
                toast({ title: 'Error', description: message, variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId]);

    const activeCategories = (tournament?.categories || []).filter((c) => c.active);
    const currentPhase = (tournament?.phases || [])
        .filter((p) => new Date(p.valid_until) >= new Date(new Date().toDateString()))
        .sort((a, b) => a.valid_until.localeCompare(b.valid_until))[0];

    // Registro existente para el hijo/atleta seleccionado (evita re-inscribir).
    const subjectId = isParent ? selectedChildId : user?.id;
    const existingReg = (tournament?.my_registrations || []).find((r) =>
        isParent ? r.child_id === subjectId : !r.child_id,
    );

    const handleRegister = async () => {
        if (!eventId || !selectedCategoryId) return;
        if (isParent && !selectedChildId) {
            toast({ title: 'Elegí un hijo', description: 'Seleccioná para quién es la inscripción.', variant: 'destructive' });
            return;
        }
        setSubmitting(true);
        try {
            await registerForTournament(eventId, {
                category_id: selectedCategoryId,
                child_id: isParent ? selectedChildId : undefined,
            });
            toast({ title: 'Inscripción registrada', description: 'Ya podés pagar la inscripción.' });
            const refreshed = await getForParticipant(eventId);
            setTournament(refreshed);
        } catch (err: any) {
            const message = err instanceof BFFError ? err.message : 'No se pudo completar la inscripción.';
            toast({ title: 'No se pudo inscribir', description: message, variant: 'destructive' });
        } finally {
            setSubmitting(false);
        }
    };

    const openCheckout = (reg: MyRegistration) => {
        setCheckoutReg(reg);
        setCheckoutOpen(true);
    };

    if (loading) return <div className="p-6 text-sm text-muted-foreground">Cargando torneo…</div>;
    if (!tournament) return <div className="p-6 text-sm text-muted-foreground">Torneo no encontrado.</div>;

    if (!tournament.registrations_open) {
        return (
            <div className="p-6 max-w-lg mx-auto">
                <Card><CardContent className="pt-6 text-sm text-muted-foreground">
                    Las inscripciones a "{tournament.title}" no están abiertas todavía.
                </CardContent></Card>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>🏆 {tournament.title}</CardTitle>
                    <CardDescription>{tournament.sport} · {tournament.city} · {tournament.event_date}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isParent && (
                        <div className="space-y-1">
                            <Label>¿Para quién es la inscripción?</Label>
                            <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                                <SelectTrigger><SelectValue placeholder="Elegí a tu hijo/a" /></SelectTrigger>
                                <SelectContent>
                                    {children.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {children.length === 0 && (
                                <p className="text-xs text-muted-foreground">No encontramos hijos tuyos matriculados en esta escuela.</p>
                            )}
                        </div>
                    )}

                    <div className="space-y-1">
                        <Label>Categoría</Label>
                        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                            <SelectTrigger><SelectValue placeholder="Elegí la categoría" /></SelectTrigger>
                            <SelectContent>
                                {activeCategories.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.division} {c.category} {c.rama}{c.age_min ? ` (${c.age_min}-${c.age_max ?? ''} años)` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {currentPhase && (
                        <p className="text-sm font-semibold text-primary">
                            Cuota de inscripción: {formatCurrency(currentPhase.price_solo)}
                        </p>
                    )}

                    {existingReg ? (
                        <div className="rounded-md border p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Ya estás inscrito/a</span>
                                <Badge variant="outline">{existingReg.status}</Badge>
                            </div>
                            {existingReg.payment && existingReg.payment.status !== 'paid' ? (
                                <Button className="w-full" onClick={() => openCheckout(existingReg)}>
                                    Pagar {formatCurrency(existingReg.payment.amount)}
                                </Button>
                            ) : (
                                <p className="text-xs text-emerald-600">Pago al día.</p>
                            )}
                        </div>
                    ) : (
                        <Button
                            className="w-full"
                            disabled={submitting || !selectedCategoryId || (isParent && !selectedChildId)}
                            onClick={handleRegister}
                        >
                            {submitting ? 'Inscribiendo…' : 'Inscribirme'}
                        </Button>
                    )}

                    <Button variant="outline" className="w-full" onClick={() => navigate(`/tournaments/${eventId}/results`)}>
                        Ver resultados
                    </Button>
                </CardContent>
            </Card>

            {checkoutReg && (
                <PaymentCheckoutModal
                    open={checkoutOpen}
                    onOpenChange={setCheckoutOpen}
                    studentId={checkoutReg.child_id || user?.id || ''}
                    childId={checkoutReg.child_id || undefined}
                    schoolId={tournament.school_id}
                    paymentId={checkoutReg.payment_id || undefined}
                    amount={checkoutReg.payment?.amount || 0}
                    concept={`Inscripción torneo — ${tournament.title}`}
                    mode="update"
                    onSuccess={async () => {
                        setCheckoutOpen(false);
                        if (eventId) setTournament(await getForParticipant(eventId));
                    }}
                />
            )}
        </div>
    );
}
