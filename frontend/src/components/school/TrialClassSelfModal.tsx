import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Clock, Building2, CalendarCheck, CheckCircle2, Loader2,
  UserCircle2, Sparkles, UserPlus, User,
} from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  useTrialClassesSelf, type TrialSelfJointSlot, type TrialSelfSubject,
} from '@/hooks/useTrialClassesSelf';
import { useSchoolStaff } from '@/hooks/useSchoolData';

/**
 * Agendar una clase de prueba desde Mis Inscripciones — hermano de
 * TrialClassBookingModal.tsx (owner), pero para un padre/atleta ya logueado.
 * Ver docs/specs/mis-inscripciones-agenda-clases-prueba.md.
 *
 * Diferencia clave con el modal del owner: acá el primer paso es "¿para
 * quién?" (child_id / self / hermano nuevo) — el owner no lo necesita porque
 * siempre agenda para un prospecto externo.
 */

interface Facility {
  id: string;
  name: string;
  type: string;
}

interface ChildOption {
  id: string;
  full_name: string;
}

type Step = 'subject' | 'select' | 'slots' | 'confirm' | 'success';

export interface TrialClassSelfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilities: Facility[];
  /** Hijos del padre logueado — [] si quien agenda es un atleta adulto. */
  children: ChildOption[];
  isParent: boolean;
}

const SLOTS_HORIZON_DAYS = 14;
const DEFAULT_WHATSAPP_PREFIX = '+57 ';

export function TrialClassSelfModal({ open, onOpenChange, facilities, children, isParent }: TrialClassSelfModalProps) {
  const { categories, getJointSlots, getEligibility, createBooking, isCreating } = useTrialClassesSelf();
  const { staff } = useSchoolStaff();
  const activeCoaches = useMemo(() => (staff ?? []).filter((s: any) => s.status === 'active'), [staff]);

  const [step, setStep] = useState<Step>('subject');

  // Paso 1: sujeto
  const [subjectKind, setSubjectKind] = useState<'child' | 'self' | 'new_sibling' | null>(null);
  const [subjectChildId, setSubjectChildId] = useState('');
  const [siblingName, setSiblingName] = useState('');
  const [siblingEmail, setSiblingEmail] = useState('');
  const [siblingWhatsapp, setSiblingWhatsapp] = useState(DEFAULT_WHATSAPP_PREFIX);
  const [siblingDob, setSiblingDob] = useState('');

  // Paso 2/3: categoría + cancha + coach + horario
  const [categoryId, setCategoryId] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [coachId, setCoachId] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slots, setSlots] = useState<TrialSelfJointSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TrialSelfJointSlot | null>(null);

  // Paso 4: preview de precio antes de confirmar
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isFirst, setIsFirst] = useState(true);

  const [successInfo, setSuccessInfo] = useState<{ price: number; isFirst: boolean } | null>(null);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedFacility = facilities.find((f) => f.id === facilityId);
  const selectedCoach = activeCoaches.find((c: any) => c.id === coachId);

  const resetState = () => {
    setStep('subject');
    setSubjectKind(isParent ? null : 'self');
    setSubjectChildId('');
    setSiblingName(''); setSiblingEmail(''); setSiblingWhatsapp(DEFAULT_WHATSAPP_PREFIX); setSiblingDob('');
    setCategoryId(''); setFacilityId(''); setCoachId('');
    setSlots([]); setSelectedSlot(null);
    setIsFirst(true);
    setSuccessInfo(null);
  };

  useEffect(() => {
    if (!open) resetState();
    // Un atleta adulto sin hijos no tiene nada que elegir en el paso 1.
    else if (!isParent) setSubjectKind('self');
  }, [open, isParent]);

  const subject: TrialSelfSubject | null = useMemo(() => {
    if (subjectKind === 'child' && subjectChildId) return { kind: 'child', child_id: subjectChildId };
    if (subjectKind === 'self') return { kind: 'self' };
    if (subjectKind === 'new_sibling' && siblingName && siblingEmail && siblingWhatsapp) {
      return { kind: 'new_sibling', prospect_name: siblingName, prospect_email: siblingEmail, prospect_whatsapp: siblingWhatsapp, prospect_dob: siblingDob || undefined };
    }
    return null;
  }, [subjectKind, subjectChildId, siblingName, siblingEmail, siblingWhatsapp, siblingDob]);

  // ¿Este sujeto (hijo o self) ya tiene un plan real en la escuela? Un
  // hermano/a nuevo nunca puede tenerlo — no hace falta chequear. Se corre
  // apenas se elige el sujeto (Paso 1), no al final: no tiene sentido dejar
  // elegir categoría/horario para recién ahí decir que no se puede.
  const [checkingPlan, setCheckingPlan] = useState(false);
  const [hasActivePlan, setHasActivePlan] = useState(false);

  useEffect(() => {
    if (!subject || subject.kind === 'new_sibling') { setHasActivePlan(false); return; }
    let cancelled = false;
    setCheckingPlan(true);
    getEligibility(subject.kind === 'child' ? { child_id: subject.child_id } : { self: true })
      .then(({ hasActivePlan: blocked }) => { if (!cancelled) setHasActivePlan(blocked); })
      .finally(() => { if (!cancelled) setCheckingPlan(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectKind, subjectChildId]);

  const subjectValid = subject !== null && !hasActivePlan && !checkingPlan;

  const handleFetchSlots = async () => {
    if (!categoryId || !facilityId || !coachId) return;
    setLoadingSlots(true);
    try {
      const from = format(new Date(), 'yyyy-MM-dd');
      const to = format(addDays(new Date(), SLOTS_HORIZON_DAYS), 'yyyy-MM-dd');
      const data = await getJointSlots(facilityId, coachId, from, to);
      setSlots(data);
      setStep('slots');
    } finally {
      setLoadingSlots(false);
    }
  };

  const slotsByDate = useMemo(() => {
    const groups: Record<string, TrialSelfJointSlot[]> = {};
    for (const s of slots) {
      groups[s.slot_date] = groups[s.slot_date] ?? [];
      groups[s.slot_date].push(s);
    }
    return groups;
  }, [slots]);

  const handleGoToConfirm = async () => {
    if (!subject) return;
    setStep('confirm');
    // Un hermano nuevo siempre es su primera prueba — todavía no existe
    // ningún unregistered_athlete para él con el que comparar.
    if (subject.kind === 'new_sibling') { setIsFirst(true); return; }
    setLoadingPreview(true);
    try {
      const { isFirst: first } = await getEligibility(subject.kind === 'child' ? { child_id: subject.child_id } : { self: true });
      setIsFirst(first);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSlot || !subject || !categoryId) return;
    const res = await createBooking({
      category_id: categoryId,
      facility_availability_id: selectedSlot.facility_availability_id,
      coach_availability_id: selectedSlot.coach_availability_id,
      scheduled_date: selectedSlot.slot_date,
      start_time: selectedSlot.slot_start_time,
      end_time: selectedSlot.slot_end_time,
      subject,
    });
    setSuccessInfo({ price: res.price, isFirst: res.is_first });
    setStep('success');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-card text-card-foreground border-border/40 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="h-6 w-6 text-primary" /> Agendar Clase de Prueba
          </DialogTitle>
          <DialogDescription className="text-muted-foreground/80">
            Rápido y sin pasar por la escuela — solo se muestran horarios ya confirmados.
          </DialogDescription>
        </DialogHeader>

        {/* ── Paso 1: ¿para quién? ── */}
        {step === 'subject' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            {isParent && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold tracking-tight">¿Para quién es la prueba?</Label>
                <div className="grid grid-cols-1 gap-2">
                  {children.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSubjectKind('child'); setSubjectChildId(c.id); }}
                      className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                        subjectKind === 'child' && subjectChildId === c.id
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/10'
                          : 'border-border/50 bg-muted/30 hover:border-primary/30'
                      }`}
                    >
                      <UserCircle2 className="h-5 w-5 text-primary shrink-0" />
                      <span className="font-semibold text-sm">{c.full_name}</span>
                      <span className="text-[11px] text-muted-foreground ml-auto">otra disciplina</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setSubjectKind('new_sibling'); setSubjectChildId(''); }}
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                      subjectKind === 'new_sibling'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/10'
                        : 'border-border/50 bg-muted/30 hover:border-primary/30'
                    }`}
                  >
                    <UserPlus className="h-5 w-5 text-primary shrink-0" />
                    <span className="font-semibold text-sm">Un hermano/a nuevo</span>
                  </button>
                </div>
              </div>
            )}

            {subjectKind === 'new_sibling' && (
              <div className="space-y-4 animate-in fade-in duration-200 border-t border-border/40 pt-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold tracking-tight">Nombre completo</Label>
                  <Input value={siblingName} onChange={(e) => setSiblingName(e.target.value)} placeholder="Nombre del hermano/a" className="bg-muted/30 border-border/50 h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold tracking-tight">Fecha de nacimiento</Label>
                  <Input type="date" value={siblingDob} onChange={(e) => setSiblingDob(e.target.value)} className="bg-muted/30 border-border/50 h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold tracking-tight">Correo de contacto</Label>
                  <Input type="email" value={siblingEmail} onChange={(e) => setSiblingEmail(e.target.value)} placeholder="correo@ejemplo.com" className="bg-muted/30 border-border/50 h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold tracking-tight">WhatsApp de contacto</Label>
                  <Input value={siblingWhatsapp} onChange={(e) => setSiblingWhatsapp(e.target.value)} placeholder="+57 300 000 0000" className="bg-muted/30 border-border/50 h-10" />
                </div>
              </div>
            )}

            {!isParent && (
              <div className="flex items-center gap-3 rounded-xl border-2 border-primary bg-primary/5 px-4 py-3">
                <User className="h-5 w-5 text-primary shrink-0" />
                <span className="font-semibold text-sm">Para vos — otra disciplina de la escuela</span>
              </div>
            )}

            {subject && subject.kind !== 'new_sibling' && hasActivePlan && !checkingPlan && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
                {subject.kind === 'self'
                  ? 'Ya tenés un plan activo en esta escuela — agendá tus clases desde tu plan, en "Gestión de Clases", no como prueba.'
                  : 'Ya tiene un plan activo en esta escuela — agendá sus clases desde su plan, en "Gestión de Clases", no como prueba.'}
              </div>
            )}

            <Button className="w-full h-11 text-base font-semibold" onClick={() => setStep('select')} disabled={!subjectValid}>
              {checkingPlan ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              Continuar
            </Button>
          </div>
        )}

        {/* ── Paso 2: categoría + cancha + coach ── */}
        {step === 'select' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-3">
              <Label className="text-sm font-semibold tracking-tight">¿Qué querés probar?</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="bg-muted/30 border-border/50 h-11">
                  <SelectValue placeholder="Selecciona una opción…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex flex-col">
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {c.price > 0 ? `$${c.price.toLocaleString('es-CO')} COP` : 'Sin costo'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCategory?.description && (
                <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">{selectedCategory.description}</p>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold tracking-tight">Instalación</Label>
              <Select value={facilityId} onValueChange={setFacilityId}>
                <SelectTrigger className="bg-muted/30 border-border/50 h-11">
                  <SelectValue placeholder="Selecciona una instalación…" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold tracking-tight">Entrenador</Label>
              <Select value={coachId} onValueChange={setCoachId}>
                <SelectTrigger className="bg-muted/30 border-border/50 h-11">
                  <SelectValue placeholder="Selecciona un entrenador…" />
                </SelectTrigger>
                <SelectContent>
                  {activeCoaches.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('subject')} className="flex-1 h-11 font-medium border-border/50">Atrás</Button>
              <Button className="flex-1 h-11 font-semibold" onClick={handleFetchSlots} disabled={!categoryId || !facilityId || !coachId || loadingSlots}>
                {loadingSlots ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                Ver horarios
              </Button>
            </div>
          </div>
        )}

        {/* ── Paso 3: horarios conjuntos ── */}
        {step === 'slots' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between border-b border-border/30 pb-2">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Horarios disponibles
              </h3>
              <p className="text-xs text-muted-foreground">Próximos {SLOTS_HORIZON_DAYS} días</p>
            </div>

            {Object.keys(slotsByDate).length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                No hay horarios donde coincidan la instalación y el entrenador elegidos.
              </div>
            ) : (
              <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                {Object.entries(slotsByDate).map(([date, daySlots]) => (
                  <div key={date} className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary capitalize">
                      {format(parseISO(date), 'EEEE d MMM', { locale: es })}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {daySlots.map((s) => {
                        const isSelected = selectedSlot?.facility_availability_id === s.facility_availability_id
                          && selectedSlot?.coach_availability_id === s.coach_availability_id
                          && selectedSlot?.slot_date === s.slot_date
                          && selectedSlot?.slot_start_time === s.slot_start_time;
                        return (
                          <Button
                            key={`${s.slot_date}-${s.slot_start_time}-${s.facility_availability_id}-${s.coach_availability_id}`}
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedSlot(s)}
                            className="text-xs h-10"
                          >
                            {s.slot_start_time.slice(0, 5)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('select')} className="flex-1 h-11 font-medium border-border/50">Atrás</Button>
              <Button onClick={handleGoToConfirm} disabled={!selectedSlot} className="flex-1 h-11 font-bold">
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* ── Paso 4: confirmar (con precio real) ── */}
        {step === 'confirm' && selectedSlot && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 text-sm space-y-1.5">
                {selectedCategory && <p className="font-bold text-primary">{selectedCategory.name}</p>}
                <p className="font-bold flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-primary" />{selectedFacility?.name}</p>
                <p className="font-medium text-muted-foreground flex items-center gap-2"><UserCircle2 className="h-3.5 w-3.5 text-primary" />{selectedCoach?.full_name}</p>
                <p className="font-medium text-muted-foreground flex items-center gap-2 capitalize">
                  <CalendarCheck className="h-3.5 w-3.5 text-primary" />
                  {format(parseISO(selectedSlot.slot_date), 'EEEE d MMM', { locale: es })} · {selectedSlot.slot_start_time.slice(0, 5)}
                </p>
              </CardContent>
            </Card>

            <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-center">
              {loadingPreview ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              ) : (
                <>
                  <p className="text-2xl font-black">
                    {(() => {
                      const shown = isFirst ? selectedCategory?.price : selectedCategory?.repeat_price;
                      return shown ? `$${shown.toLocaleString('es-CO')}` : 'Sin costo';
                    })()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isFirst ? 'Tu primera clase de prueba en esta escuela' : 'Ya usaste tu primera prueba — precio de repetición'}
                  </p>
                </>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('slots')} className="flex-1 h-11 font-medium border-border/50">Atrás</Button>
              <Button
                onClick={handleSubmit}
                disabled={isCreating || loadingPreview}
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {isCreating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                Confirmar
              </Button>
            </div>
          </div>
        )}

        {/* ── Paso 5: éxito ── */}
        {step === 'success' && successInfo && (
          <div className="space-y-5 animate-in fade-in duration-300 text-center">
            <div className="flex justify-center">
              <div className="bg-emerald-500/10 p-4 rounded-full ring-8 ring-emerald-500/5">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg">¡Clase de prueba agendada!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {successInfo.price > 0 ? `Costo: $${successInfo.price.toLocaleString('es-CO')} COP` : 'Sin costo'} · Te llegó un correo de confirmación.
              </p>
            </div>
            <Button className="w-full h-11 font-bold" onClick={() => onOpenChange(false)}>Listo</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
