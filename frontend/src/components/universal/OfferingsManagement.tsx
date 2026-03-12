import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useOfferings, Offering } from '@/hooks/useOfferings';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { EnrollPlanStudentModal } from '@/components/enrollment/EnrollPlanStudentModal';
import { SPORTS_CATALOG, searchSports } from '@/lib/constants/sportsCatalog';
import { getSportVisual } from '@/lib/sportVisuals';
import { Plus, Package, Search, X, ChevronDown, Edit, Minus, DollarSign, Clock, Zap, UserPlus } from 'lucide-react';

const MIN_SEARCH_CHARS = 1;

const OFFERING_TYPE_LABELS: Record<string, string> = {
    membership: 'Membresía',
    session_pack: 'Pack de Clases',
    court_booking: 'Reserva de Cancha',
    tournament: 'Torneo',
    single_session: 'Clase Suelta',
};

const PLAN_DURATION_OPTIONS = [
    { label: 'Mensual', value: '30' },
    { label: '3 meses', value: '90' },
    { label: '6 meses', value: '180' },
    { label: '12 meses', value: '365' },
];

const formatCurrency = (val: string | number) => {
    if (val === undefined || val === null || val === '') return '';
    const num = typeof val === 'string' ? parseFloat(val.replace(/\./g, '').replace(/,/g, '')) : val;
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('de-DE').format(num); // de-DE uses dots for thousands
};

const parseCurrency = (val: string) => {
    return val.replace(/\./g, '').replace(/,/g, '');
};

// ═══════════════════════════════════════════════════════════════════
// CSS to hide number spinners
// ═══════════════════════════════════════════════════════════════════
const hideSpinnersCSS = `
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type="number"] {
    -moz-appearance: textfield;
  }
`;

// ═══════════════════════════════════════════════════════════════════
// Number Stepper — Input numérico con botones +/-
// ═══════════════════════════════════════════════════════════════════

function NumberStepper({
    id, value, onChange, placeholder, min = 0, step = 1, prefix, label, isCurrency = false,
}: {
    id: string; value: string; onChange: (v: string) => void;
    placeholder?: string; min?: number; step?: number; prefix?: string; label?: string;
    isCurrency?: boolean;
}) {
    const rawVal = isCurrency ? parseCurrency(value) : value;
    const numVal = rawVal ? parseFloat(rawVal) : 0;

    const decrease = () => onChange(String(Math.max(min, numVal - step)));
    const increase = () => onChange(String(numVal + step));

    return (
        <div className="space-y-1.5">
            <style>{hideSpinnersCSS}</style>
            {label && <Label htmlFor={id} className="text-sm font-medium">{label}</Label>}
            <div className="flex items-center gap-0">
                <button
                    type="button"
                    onClick={decrease}
                    disabled={numVal <= min}
                    className="h-9 w-9 flex items-center justify-center rounded-l-md border border-r-0 bg-muted/60 hover:bg-muted text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                    <Minus className="h-3.5 w-3.5" />
                </button>
                <div className="relative flex-1">
                    {prefix && (
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">{prefix}</span>
                    )}
                    <Input
                        id={id}
                        placeholder={placeholder}
                        type={isCurrency ? "text" : "number"}
                        className={`rounded-none border-x-0 h-9 text-center ${prefix ? 'pl-6' : ''}`}
                        value={isCurrency ? formatCurrency(value) : value}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (isCurrency) {
                                const clean = parseCurrency(val);
                                if (/^\d*$/.test(clean)) {
                                    onChange(clean);
                                }
                            } else {
                                onChange(val);
                            }
                        }}
                    />
                </div>
                <button
                    type="button"
                    onClick={increase}
                    className="h-9 w-9 flex items-center justify-center rounded-r-md border border-l-0 bg-muted/60 hover:bg-muted text-foreground transition-colors shrink-0"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// Sport Search Combobox
// ═══════════════════════════════════════════════════════════════════

function SportSearchCombobox({
    values,
    onChange,
}: {
    values: string[];
    onChange: (sports: string[]) => void;
}) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const results = useMemo(() => {
        if (query.trim().length < MIN_SEARCH_CHARS) return [];
        return searchSports(query).slice(0, 15).filter(s => !values.includes(s.nombre));
    }, [query, values]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleAdd = (sportName: string) => {
        if (!values.includes(sportName)) {
            onChange([...values, sportName]);
        }
        // ✅ Limpiar búsqueda después de seleccionar
        setQuery('');
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleRemove = (sportName: string) => {
        onChange(values.filter(v => v !== sportName));
    };

    const shouldShowDropdown = isOpen && query.trim().length >= MIN_SEARCH_CHARS;

    return (
        <div ref={containerRef} className="space-y-2">
            {values.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {values.map((name) => {
                        const entry = SPORTS_CATALOG.find(s => s.nombre === name);
                        const visual = getSportVisual(entry?.slug ?? name);
                        return (
                            <div key={name} className="group flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border border-primary/20 bg-primary/5 text-sm animate-in fade-in-0 zoom-in-95 hover:border-primary/40 transition-colors">
                                <span className="text-sm">{visual.icon}</span>
                                <span className="font-medium max-w-[130px] truncate text-xs">{name}</span>
                                <button
                                    type="button"
                                    onClick={() => handleRemove(name)}
                                    className="ml-0.5 p-0.5 rounded-full hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    ref={inputRef}
                    placeholder={values.length > 0 ? 'Agregar otro deporte...' : 'Buscar deporte...'}
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setIsOpen(e.target.value.trim().length >= MIN_SEARCH_CHARS); }}
                    onFocus={() => { if (query.trim().length >= MIN_SEARCH_CHARS) setIsOpen(true); }}
                    className="pl-9 pr-8 w-full h-9"
                />
                <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none transition-transform duration-200 ${shouldShowDropdown ? 'rotate-180' : ''}`} />
            </div>

            {shouldShowDropdown && (
                <div className="max-h-52 overflow-y-auto rounded-lg border bg-popover shadow-md animate-in fade-in-0 slide-in-from-top-1 z-50">
                    {results.length === 0 ? (
                        <div className="p-4 text-sm text-center text-muted-foreground">No se encontraron deportes</div>
                    ) : (
                        results.map((sport) => {
                            const visual = getSportVisual(sport.slug);
                            return (
                                <button
                                    type="button"
                                    key={sport.id}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent/80 hover:text-accent-foreground transition-colors text-left border-b border-border/20 last:border-0"
                                    onClick={() => handleAdd(sport.nombre)}
                                >
                                    <span className="text-base shrink-0">{visual.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate text-xs">{sport.nombre}</div>
                                        <div className="text-[10px] text-muted-foreground truncate">{sport.nombreIngles} · {sport.federacion}</div>
                                    </div>
                                    <Badge variant="outline" className="text-[8px] shrink-0 whitespace-nowrap hidden sm:inline-flex opacity-60">
                                        {sport.categoriaGlobal === 'olimpicos_verano' ? 'Olímpico' : sport.categoriaGlobal === 'paralimpicos' ? 'Paralímpico' : sport.categoriaGlobal === 'artes_marciales_y_combate' ? 'Combate' : 'Otro'}
                                    </Badge>
                                </button>
                            );
                        })
                    )}
                </div>
            )}

            {/* Search helper removed as threshold is 1 */}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

export function OfferingsManagement() {
    const { toast } = useToast();
    const { schoolId } = useSchoolContext();
    const { offerings, isLoading, createOffering, updateOffering, deleteOffering, createPlan, updatePlan } = useOfferings();

    const [showCreate, setShowCreate] = useState(false);
    const [showCreatePlan, setShowCreatePlan] = useState<string | null>(null);
    const [editingOfferingId, setEditingOfferingId] = useState<string | null>(null);
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

    // Enroll state
    const [enrollModal, setEnrollModal] = useState<{
        open: boolean;
        plan: any | null;
        offering: Offering | null;
    }>({
        open: false,
        plan: null,
        offering: null,
    });

    const [newOffering, setNewOffering] = useState({
        name: '', description: '', offering_type: 'membership' as string, sport: '' as string,
    });

    const [newPlan, setNewPlan] = useState({
        name: '', max_sessions: '', max_secondary_sessions: '0',
        secondary_session_label: '', duration_days: '30', price: '', auto_renew: false,
    });

    const resetOfferingForm = () => {
        setNewOffering({ name: '', description: '', offering_type: 'membership', sport: '' });
        setEditingOfferingId(null);
    };

    const resetPlanForm = () => {
        setNewPlan({ name: '', max_sessions: '', max_secondary_sessions: '0', secondary_session_label: '', duration_days: '30', price: '', auto_renew: false });
        setEditingPlanId(null);
    };

    const handleSaveOffering = () => {
        const payload = {
            name: newOffering.name,
            offering_type: newOffering.offering_type as Offering['offering_type'],
            description: newOffering.description || undefined,
            sport: newOffering.sport || undefined,
            metadata: {}, // Assuming metadata for multiple sports is no longer needed with single `sport` field
        };

        if (editingOfferingId) {
            updateOffering.mutate({ id: editingOfferingId, ...payload }, {
                onSuccess: () => { toast({ title: 'Plan actualizado ✓' }); setShowCreate(false); resetOfferingForm(); },
                onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
            });
        } else {
            createOffering.mutate(payload, {
                onSuccess: () => { toast({ title: 'Plan creado exitosamente ✓' }); setShowCreate(false); resetOfferingForm(); },
                onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
            });
        }
    };

    const handleSavePlan = (offeringId: string) => {
        const payload = {
            name: newPlan.name,
            max_sessions: newPlan.max_sessions ? parseInt(newPlan.max_sessions) : null,
            max_secondary_sessions: parseInt(newPlan.max_secondary_sessions) || 0,
            duration_days: parseInt(newPlan.duration_days) || 30,
            price: parseFloat(newPlan.price) || 0,
            auto_renew: newPlan.auto_renew,
            metadata: {
                secondary_session_label: newPlan.secondary_session_label || undefined
            }
        };

        if (editingPlanId) {
            updatePlan.mutate({ offeringId, planId: editingPlanId, ...payload }, {
                onSuccess: () => { toast({ title: 'Tarifa actualizada ✓' }); setShowCreatePlan(null); resetPlanForm(); },
                onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
            });
        } else {
            createPlan.mutate({ offeringId, ...payload }, {
                onSuccess: () => { toast({ title: 'Tarifa creada ✓' }); setShowCreatePlan(null); resetPlanForm(); },
                onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
            });
        }
    };

    const handleEditOffering = (offering: Offering) => {
        setNewOffering({
            name: offering.name,
            description: offering.description || '',
            offering_type: offering.offering_type,
            sport: offering.sport || '',
        });
        setEditingOfferingId(offering.id);
        setShowCreate(true);
    };

    const handleEditPlan = (offeringId: string, planId: string) => {
        const offering = offerings.find((o) => o.id === offeringId);
        const plan = offering?.offering_plans?.find((p) => p.id === planId);
        if (plan) {
            setEditingPlanId(planId);
            setNewPlan({
                name: plan.name,
                max_sessions: plan.max_sessions?.toString() || '',
                max_secondary_sessions: plan.max_secondary_sessions?.toString() || '0',
                secondary_session_label: (plan.metadata?.secondary_session_label as string) || '',
                duration_days: plan.duration_days?.toString() || '30',
                price: plan.price?.toString() || '',
                auto_renew: plan.auto_renew || false,
            });
            setShowCreatePlan(offeringId);
        }
    };

    const handleOpenEnroll = (offering: Offering, plan: any) => {
        setEnrollModal({
            open: true,
            offering,
            plan,
        });
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-28 bg-muted/40 animate-pulse rounded-xl border border-border/30" />
                ))}
            </div>
        );
    }

    const isSavingOffering = createOffering.isPending || updateOffering.isPending;
    const isSavingPlan = createPlan.isPending || updatePlan.isPending;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold tracking-tight">Planes y Membresías</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {offerings.length > 0 ? `${offerings.length} plan${offerings.length !== 1 ? 'es' : ''} configurado${offerings.length !== 1 ? 's' : ''}` : 'Configura los planes para tus estudiantes'}
                    </p>
                </div>
                <Button onClick={() => { resetOfferingForm(); setShowCreate(true); }} size="sm" className="gap-1.5 shadow-sm">
                    <Plus className="h-4 w-4" /> Nuevo Plan
                </Button>
            </div>

            {/* Empty state */}
            {offerings.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="rounded-full bg-muted/60 p-4 mb-4">
                            <Package className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium mb-1">Sin planes configurados</p>
                        <p className="text-xs text-muted-foreground mb-5">Crea tu primer plan o membresía para comenzar</p>
                        <Button onClick={() => { resetOfferingForm(); setShowCreate(true); }} size="sm" className="gap-1.5">
                            <Plus className="h-3.5 w-3.5" /> Crear primer plan
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {offerings.map((offering) => (
                        <OfferingCard
                            key={offering.id}
                            offering={offering}
                            onEditOffering={() => handleEditOffering(offering)}
                            onAddPlan={() => { resetPlanForm(); setShowCreatePlan(offering.id); }}
                            onEditPlan={(planId) => handleEditPlan(offering.id, planId)}
                            onEnroll={handleOpenEnroll}
                        />
                    ))}
                </div>
            )}

            {/* ══════ Create / Edit Offering Modal ══════ */}
            <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); resetOfferingForm(); } }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">
                            {editingOfferingId ? '✏️ Editar Plan' : '✨ Nuevo Plan'}
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            {editingOfferingId ? 'Modifica los detalles de este plan.' : 'Crea un plan o membresía para ofrecer a tus estudiantes.'}
                        </p>
                    </DialogHeader>

                    <div className="space-y-5 py-2 max-h-[70vh] overflow-y-auto pr-1">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Nombre del Plan</Label>
                            <Input
                                placeholder="Ej: Membresía Elite, Pack 10 Clases"
                                value={newOffering.name}
                                onChange={(e) => setNewOffering((o) => ({ ...o, name: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Tipo de Oferta</Label>
                                <Select
                                    value={newOffering.offering_type}
                                    onValueChange={(v: any) => setNewOffering((o) => ({ ...o, offering_type: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(OFFERING_TYPE_LABELS).map(([val, label]) => (
                                            <SelectItem key={val} value={val}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Deporte</Label>
                                <SportSearchCombobox
                                    values={newOffering.sport ? [newOffering.sport] : []}
                                    onChange={(sports) => setNewOffering((o) => ({ ...o, sport: sports[0] || '' }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center justify-between">
                                Descripción (Opcional)
                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Atractivo para el cliente</span>
                            </Label>
                            <Textarea
                                placeholder="Describe qué beneficios incluye esta membresía o paquete..."
                                value={newOffering.description}
                                onChange={(e) => setNewOffering((o) => ({ ...o, description: e.target.value }))}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 pt-2">
                        <Button variant="outline" onClick={() => { setShowCreate(false); resetOfferingForm(); }} size="sm">Cancelar</Button>
                        <Button onClick={handleSaveOffering} disabled={!newOffering.name || isSavingOffering} size="sm" className="gap-1.5">
                            {isSavingOffering
                                ? (editingOfferingId ? 'Actualizando...' : 'Creando...')
                                : (editingOfferingId ? '💾 Guardar Cambios' : '🚀 Crear Plan')
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ══════ Create / Edit Plan (Tarifa) Modal ══════ */}
            <Dialog open={!!showCreatePlan} onOpenChange={(o) => { if (!o) { setShowCreatePlan(null); resetPlanForm(); } }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">
                            {editingPlanId ? '✏️ Editar Tarifa' : '💰 Nueva Tarifa'}
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            {editingPlanId ? 'Modifica los detalles de esta tarifa.' : 'Agrega una tarifa o nivel de precios.'}
                        </p>
                    </DialogHeader>

                    <div className="space-y-5 py-2 max-h-[70vh] overflow-y-auto pr-1">
                        <div className="space-y-2">
                            <Label htmlFor="plan-name" className="text-sm font-medium">
                                Nombre de la tarifa <span className="text-destructive">*</span>
                            </Label>
                            <Input id="plan-name" placeholder="Ej: Básico, Premium, 2 veces/semana" value={newPlan.name} onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))} className="h-9" />
                        </div>

                        {/* Price + Duration row */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-1.5">
                                    <DollarSign className="h-3.5 w-3.5 text-green-500" /> Precio <span className="text-destructive">*</span>
                                </Label>
                                <NumberStepper
                                    id="plan-price"
                                    value={newPlan.price}
                                    onChange={(v) => setNewPlan((p) => ({ ...p, price: v }))}
                                    placeholder="0"
                                    prefix="$"
                                    step={5000}
                                    isCurrency={true}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5 text-blue-500" /> Duración
                                </Label>
                                <Select
                                    value={newPlan.duration_days}
                                    onValueChange={(v) => setNewPlan((p) => ({ ...p, duration_days: v }))}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Seleccionar duración" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PLAN_DURATION_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Sessions row */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-1.5">
                                    <Zap className="h-3.5 w-3.5 text-amber-500" /> Máx. sesiones
                                </Label>
                                <NumberStepper
                                    id="plan-sessions"
                                    value={newPlan.max_sessions}
                                    onChange={(v) => setNewPlan((p) => ({ ...p, max_sessions: v }))}
                                    placeholder="∞"
                                    step={1}
                                />
                                <p className="text-[10px] text-muted-foreground">Vacío = ilimitado</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Nombre de clase secundaria</Label>
                                <Input
                                    placeholder="Ej: Cortesía, Bono, etc."
                                    value={newPlan.secondary_session_label}
                                    onChange={(e) => setNewPlan((p) => ({ ...p, secondary_session_label: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Sesiones secundarias</Label>
                            <NumberStepper
                                id="plan-secondary"
                                value={newPlan.max_secondary_sessions}
                                onChange={(v) => setNewPlan((p) => ({ ...p, max_secondary_sessions: v }))}
                                placeholder="0"
                                step={1}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 pt-2">
                        <Button variant="outline" onClick={() => { setShowCreatePlan(null); resetPlanForm(); }} size="sm">Cancelar</Button>
                        <Button
                            onClick={() => showCreatePlan && handleSavePlan(showCreatePlan)}
                            disabled={!newPlan.name || !newPlan.price || isSavingPlan}
                            size="sm"
                            className="gap-1.5"
                        >
                            {isSavingPlan
                                ? (editingPlanId ? 'Actualizando...' : 'Creando...')
                                : (editingPlanId ? '💾 Guardar Cambios' : '🚀 Crear Tarifa')
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Inscripción */}
            <EnrollPlanStudentModal
                open={enrollModal.open}
                onClose={() => setEnrollModal({ ...enrollModal, open: false })}
                onSuccess={() => { }}
                schoolId={schoolId || ''}
                plan={enrollModal.plan}
                offeringName={enrollModal.offering?.name || ''}
            />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// Offering Card — Diseño mejorado
// ═══════════════════════════════════════════════════════════════════

function OfferingCard({
    offering,
    onEditOffering,
    onAddPlan,
    onEditPlan,
    onEnroll,
}: {
    offering: Offering;
    onEditOffering: () => void;
    onAddPlan: () => void;
    onEditPlan?: (planId: string) => void;
    onEnroll?: (offering: Offering, plan: any) => void;
}) {
    const plans = offering.offering_plans ?? [];
    const sportVisual = offering.sport ? getSportVisual(
        SPORTS_CATALOG.find(s => s.nombre === offering.sport)?.slug ?? offering.sport
    ) : null;

    return (
        <Card className="overflow-hidden border-border/60 hover:border-border transition-colors">
            {/* Card Header */}
            <CardHeader className="pb-2 pt-4 px-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
                            {sportVisual ? (
                                <span className="text-xl">{sportVisual.icon}</span>
                            ) : (
                                <Zap className="h-5 w-5 text-primary" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <CardTitle className="text-sm font-bold truncate leading-tight">{offering.name}</CardTitle>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 py-0 bg-primary/5 text-primary border-primary/10 font-medium">
                                    {OFFERING_TYPE_LABELS[offering.offering_type] ?? offering.offering_type}
                                </Badge>
                                {offering.sport && (
                                    <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 py-0 font-normal border-border/50 whitespace-normal break-words">
                                        {offering.sport}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onEditOffering}
                            className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary rounded-md"
                            title="Editar configuración"
                        >
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Badge
                            variant={offering.is_active ? 'default' : 'secondary'}
                            className={`text-[9px] h-5 uppercase tracking-wider font-bold ${offering.is_active ? 'bg-green-600/90' : ''}`}
                        >
                            {offering.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-4 pb-3 space-y-3">
                {offering.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{offering.description}</p>
                )}

                {/* Tarifas list */}
                {plans.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Tarifas ({plans.length})
                        </p>
                        <div className="rounded-lg border border-border/50 divide-y divide-border/30 overflow-hidden">
                            {plans.map((plan) => (
                                <div key={plan.id} className="flex items-center justify-between text-xs px-3 py-3 hover:bg-muted/30 transition-colors gap-2 group/row">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <div className="font-semibold text-xs text-foreground/90">{plan.name}</div>
                                            {plan.enrollments && plan.enrollments.length > 0 && (
                                                <Badge variant="secondary" className="text-[9px] h-4 px-1 py-0 bg-green-50 text-green-700 border-green-200">
                                                    {plan.enrollments.length} {plan.enrollments.length === 1 ? 'inscrito' : 'inscritos'}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap text-muted-foreground mt-0.5 font-medium">
                                            <span className="flex items-center gap-0.5">
                                                <Zap className="h-3 w-3 text-amber-500" />
                                                {plan.max_sessions ? `${plan.max_sessions} ses.` : '∞ ses.'}
                                            </span>
                                            {plan.max_secondary_sessions > 0 && (
                                                <Badge variant="secondary" className="text-[9px] h-4 px-1 py-0 bg-blue-50 text-blue-700 border-blue-200">
                                                    +{plan.max_secondary_sessions} {(plan.metadata?.secondary_session_label as string) || 'Sec.'}
                                                </Badge>
                                            )}
                                            <span className="text-foreground/80 flex items-center gap-0.5">
                                                <Clock className="h-3 w-3" />
                                                {PLAN_DURATION_OPTIONS.find(opt => opt.value === plan.duration_days.toString())?.label || `${plan.duration_days}d`}
                                            </span>
                                            <span className="font-bold text-primary ml-1">
                                                ${formatCurrency(plan.price)}
                                            </span>
                                        </div>

                                    </div>
                                    <div className="flex items-center gap-1">
                                        {onEnroll && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onEnroll(offering, plan)}
                                                className="shrink-0 h-8 px-2 hover:bg-green-50 hover:text-green-600 border border-transparent hover:border-green-100 transition-all gap-1.5"
                                                title="Inscribir deportista"
                                            >
                                                <UserPlus className="h-3.5 w-3.5" />
                                                <span className="hidden sm:inline text-[10px]">Inscribir</span>
                                            </Button>
                                        )}
                                        {onEditPlan && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onEditPlan(plan.id)}
                                                className="shrink-0 h-8 w-8 p-0 hover:bg-primary/5 hover:text-primary"
                                                title="Editar tarifa"
                                            >
                                                <Edit className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Add tarifa button */}
                <Button variant="outline" size="sm" onClick={onAddPlan} className="w-full h-8 text-xs gap-1.5 border-dashed hover:border-solid hover:border-primary/40 hover:text-primary transition-all">
                    <Plus className="h-3 w-3" /> Agregar Tarifa
                </Button>
            </CardContent>
        </Card>
    );
}