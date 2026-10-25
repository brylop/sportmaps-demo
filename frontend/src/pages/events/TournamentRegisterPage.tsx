import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Calendar, Check, MapPin, RefreshCw, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatCurrency } from '@/lib/utils';
import { BFFError } from '@/lib/api/bffClient';
import {
    getForParticipant, register as registerForTournament,
    TournamentForParticipant, MyRegistration, TournamentCategory,
} from '@/lib/api/tournaments';
import { PaymentCheckoutModal } from '@/components/payment/PaymentCheckoutModal';
import { etiquetaDelMedio, soloEfectivo } from '@/lib/tournaments/mediosDeCobro';
import { CLASE_TONO, estadoInscripcionEvento, fechaEvento } from '@/components/inscripciones/inscripcionesTextos';

interface ChildOption { id: string; full_name: string; }

type LoadState = 'loading' | 'error' | 'not-found' | 'ready';

/** Con más categorías que esto, la lista de opciones se vuelve un selector. */
const MAX_OPCIONES_VISIBLES = 6;

function nombreCategoria(c: TournamentCategory): string {
    const base = [c.division, c.category, c.rama].filter(Boolean).join(' ');
    return c.age_min ? `${base} (${c.age_min}-${c.age_max ?? ''} años)` : base;
}

/**
 * Inscripción + pago a un torneo/liga INTERNA de la propia escuela.
 * Ver docs/specs/torneos-internos-inscripcion-pago-2026-09-01.md Fase 3.
 *
 * Rediseño V2 (2026-10-24): una frase y un botón; lo normal ya marcado (un solo
 * hijo o una sola categoría quedan elegidos); opciones grandes en vez de
 * selectores cuando son pocas; carga / no encontrado / error distintos. El
 * «Volver» del acudiente lo pone el layout.
 */
export default function TournamentRegisterPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [tournament, setTournament] = useState<TournamentForParticipant | null>(null);
    const [state, setState] = useState<LoadState>('loading');
    const [children, setChildren] = useState<ChildOption[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string>('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [checkoutReg, setCheckoutReg] = useState<MyRegistration | null>(null);

    const isParent = profile?.role === 'parent';

    const load = useCallback(async () => {
        if (!eventId) return;
        setState('loading');
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
            // Lo normal ya marcado: si hay una sola categoría activa, queda elegida.
            const activas = (data.categories || []).filter((c) => c.active);
            if (activas.length === 1) setSelectedCategoryId(activas[0].id);
            setState('ready');
        } catch (err: unknown) {
            setState(err instanceof BFFError && err.status === 404 ? 'not-found' : 'error');
        }
    }, [eventId, isParent, user?.id]);

    useEffect(() => {
        void load();
    }, [load]);

    const activeCategories = (tournament?.categories || []).filter((c) => c.active);
    const currentPhase = (tournament?.phases || [])
        .filter((p) => new Date(p.valid_until) >= new Date(new Date().toDateString()))
        .sort((a, b) => a.valid_until.localeCompare(b.valid_until))[0];

    // Torneo gratis: sin cobro. Solo efectivo: se paga en la escuela, no en la app.
    const esGratis = tournament?.is_paid === false;
    const pagaEnEfectivo = soloEfectivo(tournament?.payment_methods);

    // Registro existente para el hijo/atleta seleccionado (evita re-inscribir).
    const subjectId = isParent ? selectedChildId : user?.id;
    const existingReg = (tournament?.my_registrations || []).find((r) =>
        isParent ? r.child_id === subjectId : !r.child_id,
    );

    const handleRegister = async () => {
        if (!eventId || !selectedCategoryId) return;
        if (isParent && !selectedChildId) {
            toast({ title: 'Elige un hijo', description: 'Selecciona para quién es la inscripción.', variant: 'destructive' });
            return;
        }
        setSubmitting(true);
        try {
            await registerForTournament(eventId, {
                category_id: selectedCategoryId,
                child_id: isParent ? selectedChildId : undefined,
            });
            toast({
                title: 'Inscripción registrada',
                description: esGratis ? 'Quedaste inscrito. El torneo es gratis.' : 'Ya puedes pagar la inscripción.',
            });
            const refreshed = await getForParticipant(eventId);
            setTournament(refreshed);
        } catch (err: unknown) {
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

    const contenedor = 'mx-auto w-full max-w-page-narrow space-y-5 pb-6';

    if (state === 'loading') {
        return (
            <div className={contenedor} aria-busy="true" aria-label="Cargando torneo">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-touch w-full rounded-xl" />
                <Skeleton className="h-touch w-full rounded-xl" />
            </div>
        );
    }

    if (state === 'not-found' || (state === 'ready' && !tournament)) {
        return (
            <div className={contenedor}>
                <div className="rounded-2xl border bg-card p-6 text-center">
                    <p className="font-semibold">No encontramos este torneo</p>
                    <p className="mt-1 text-sm text-muted-foreground">Puede que la escuela lo haya quitado o que el enlace esté incompleto.</p>
                </div>
            </div>
        );
    }

    if (state === 'error' || !tournament) {
        return (
            <div className={contenedor}>
                <div role="alert" className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                    <p className="flex items-center gap-2 font-semibold text-destructive">
                        <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
                        No pudimos cargar el torneo
                    </p>
                    <p className="text-sm text-muted-foreground">Revisa tu conexión e inténtalo de nuevo.</p>
                    <Button variant="outline" className="min-h-touch" onClick={() => void load()}>
                        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                        Reintentar
                    </Button>
                </div>
            </div>
        );
    }

    const verResultados = (
        <Button variant="outline" className="min-h-touch w-full" onClick={() => navigate(`/tournaments/${eventId}/results`)}>
            Ver resultados
        </Button>
    );

    const encabezado = (
        <header className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Trophy className="h-4 w-4" aria-hidden="true" />
                Torneo{tournament.sport ? ` · ${tournament.sport}` : ''}
            </p>
            <h1 className="text-2xl font-bold leading-tight md:text-3xl">{tournament.title}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {tournament.event_date && (
                    <span className="inline-flex items-center gap-1 first-letter:uppercase">
                        <Calendar className="h-4 w-4" aria-hidden="true" />
                        {fechaEvento(tournament.event_date)}
                    </span>
                )}
                {tournament.city && (
                    <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                        {tournament.city}
                    </span>
                )}
            </p>
        </header>
    );

    if (!tournament.registrations_open) {
        return (
            <div className={contenedor}>
                {encabezado}
                <div className="rounded-2xl border bg-card p-6 text-center">
                    <p className="font-semibold">Las inscripciones no están abiertas todavía</p>
                    <p className="mt-1 text-sm text-muted-foreground">Cuando la escuela las abra, podrás inscribirte aquí.</p>
                </div>
                {verResultados}
            </div>
        );
    }

    const precio = esGratis
        ? 'La inscripción es gratis.'
        : currentPhase
            ? `La inscripción cuesta ${formatCurrency(currentPhase.price_solo)}${pagaEnEfectivo ? ' y se paga en efectivo en la escuela' : ''}.`
            : null;
    const medios = !esGratis && !pagaEnEfectivo && (tournament.payment_methods?.length ?? 0) > 0
        ? `Medios de pago: ${tournament.payment_methods!.map(etiquetaDelMedio).join(', ')}.`
        : null;
    const estadoReg = existingReg ? estadoInscripcionEvento(existingReg.status) : null;
    const childName = children.find((c) => c.id === selectedChildId)?.full_name;

    return (
        <div className={contenedor}>
            {encabezado}

            {(precio || medios) && (
                <div className="space-y-1">
                    {precio && <p className="text-base font-medium">{precio}</p>}
                    {medios && <p className="text-sm text-muted-foreground">{medios}</p>}
                </div>
            )}

            {isParent && (
                <section className="space-y-2" aria-label="Para quién es la inscripción">
                    <h2 className="text-sm font-semibold">¿Para quién es la inscripción?</h2>
                    {children.length === 0 ? (
                        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                            No encontramos hijos tuyos matriculados en esta escuela.
                        </p>
                    ) : (
                        <Opciones
                            name="Deportista"
                            value={selectedChildId}
                            onChange={setSelectedChildId}
                            options={children.map((c) => ({ value: c.id, label: c.full_name }))}
                        />
                    )}
                </section>
            )}

            {existingReg && estadoReg ? (
                <section className="space-y-3 rounded-2xl border bg-card p-4" aria-label="Inscripción">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-base font-semibold">
                            {isParent ? `${childName ?? 'Tu hijo/a'} ya está inscrito/a` : 'Ya estás inscrito/a'}
                        </p>
                        <span className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', CLASE_TONO[estadoReg.tono])}>
                            {estadoReg.label}
                        </span>
                    </div>
                    {existingReg.payment && existingReg.payment.status !== 'paid' ? (
                        pagaEnEfectivo ? (
                            <p className="text-sm text-muted-foreground">
                                Paga {formatCurrency(existingReg.payment.amount)} en efectivo en la escuela.
                            </p>
                        ) : (
                            <Button size="lg" className="min-h-touch w-full" onClick={() => openCheckout(existingReg)}>
                                Pagar {formatCurrency(existingReg.payment.amount)}
                            </Button>
                        )
                    ) : (
                        <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                            <Check className="h-4 w-4" aria-hidden="true" />
                            {!existingReg.payment && esGratis ? 'Inscripción gratis: no hay nada que pagar.' : 'Pago al día.'}
                        </p>
                    )}
                </section>
            ) : (
                <>
                    <section className="space-y-2" aria-label="Categoría">
                        <h2 className="text-sm font-semibold">Categoría</h2>
                        {activeCategories.length === 0 ? (
                            <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                                El torneo todavía no tiene categorías abiertas.
                            </p>
                        ) : activeCategories.length > MAX_OPCIONES_VISIBLES ? (
                            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                                <SelectTrigger className="min-h-touch text-input md:text-sm"><SelectValue placeholder="Elige la categoría" /></SelectTrigger>
                                <SelectContent>
                                    {activeCategories.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>{nombreCategoria(c)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Opciones
                                name="Categoría"
                                value={selectedCategoryId}
                                onChange={setSelectedCategoryId}
                                options={activeCategories.map((c) => ({ value: c.id, label: nombreCategoria(c) }))}
                            />
                        )}
                    </section>

                    <Button
                        size="lg"
                        className="min-h-touch w-full"
                        disabled={submitting || !selectedCategoryId || (isParent && !selectedChildId)}
                        onClick={handleRegister}
                    >
                        {submitting ? 'Inscribiendo…' : isParent ? (childName ? `Inscribir a ${childName.split(' ')[0]}` : 'Inscribir') : 'Inscribirme'}
                    </Button>
                </>
            )}

            {verResultados}

            {checkoutReg && (
                <PaymentCheckoutModal
                    open={checkoutOpen}
                    onOpenChange={setCheckoutOpen}
                    studentId={checkoutReg.child_id || user?.id || ''}
                    childId={checkoutReg.child_id || undefined}
                    schoolId={tournament.school_id}
                    paymentId={checkoutReg.payment_id || undefined}
                    allowedMethods={tournament.payment_methods}
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

/** Opciones grandes (radio) para listas cortas: se ve todo y se toca fácil. */
function Opciones({ name, value, onChange, options }: {
    name: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <div role="radiogroup" aria-label={name} className="grid gap-2 sm:grid-cols-2">
            {options.map((o) => {
                const on = value === o.value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => onChange(o.value)}
                        className={cn(
                            'flex min-h-touch w-full items-center gap-3 rounded-xl bg-card px-4 py-2 text-left text-sm transition-colors',
                            on ? 'border-2 border-primary font-semibold' : 'border border-border font-medium hover:bg-muted/50',
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                                on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                            )}
                        >
                            {on && <Check className="size-3" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">{o.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
