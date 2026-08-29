import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Clock, Building2, CalendarCheck, CheckCircle2, Loader2,
  UserCircle2, Mail, MessageCircle, Copy, Check, Baby, User,
} from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTrialClasses, type JointSlot, type CreateTrialBookingResponse } from '@/hooks/useTrialClasses';
import { useSchoolStaff } from '@/hooks/useSchoolData';

interface Facility {
  id: string;
  name: string;
  type: string;
}

type Step = 'select' | 'slots' | 'prospect' | 'success';

export interface TrialClassBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilities: Facility[];
}

const SLOTS_HORIZON_DAYS = 14;

const DEFAULT_WHATSAPP_PREFIX = '+57 ';

export function TrialClassBookingModal({ open, onOpenChange, facilities }: TrialClassBookingModalProps) {
  const { categories, getJointSlots, createBooking, isCreating } = useTrialClasses();
  const activeCategories = useMemo(() => categories.filter((c) => c.is_active), [categories]);
  const { staff } = useSchoolStaff();
  const activeCoaches = useMemo(() => (staff ?? []).filter((s: any) => s.status === 'active'), [staff]);

  const [step, setStep] = useState<Step>('select');
  const [categoryId, setCategoryId] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [coachId, setCoachId] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slots, setSlots] = useState<JointSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<JointSlot | null>(null);

  const [isMinor, setIsMinor] = useState<boolean | null>(null);
  const [childName, setChildName] = useState('');
  const [prospectName, setProspectName] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectWhatsapp, setProspectWhatsapp] = useState(DEFAULT_WHATSAPP_PREFIX);

  const [result, setResult] = useState<CreateTrialBookingResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedCategory = activeCategories.find((c) => c.id === categoryId);

  const resetState = () => {
    setStep('select');
    setCategoryId('');
    setFacilityId('');
    setCoachId('');
    setSlots([]);
    setSelectedSlot(null);
    setIsMinor(null);
    setChildName('');
    setProspectName('');
    setProspectEmail('');
    setProspectWhatsapp(DEFAULT_WHATSAPP_PREFIX);
    setResult(null);
    setCopied(false);
  };

  useEffect(() => {
    if (!open) resetState();
  }, [open]);

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
    const groups: Record<string, JointSlot[]> = {};
    for (const s of slots) {
      groups[s.slot_date] = groups[s.slot_date] ?? [];
      groups[s.slot_date].push(s);
    }
    return groups;
  }, [slots]);

  const handleSubmit = async () => {
    if (!selectedSlot || !prospectName || !prospectEmail || !prospectWhatsapp) return;
    if (isMinor === null) return;
    if (isMinor && !childName) return;
    if (!categoryId) return;
    const res = await createBooking({
      category_id: categoryId,
      facility_availability_id: selectedSlot.facility_availability_id,
      coach_availability_id: selectedSlot.coach_availability_id,
      scheduled_date: selectedSlot.slot_date,
      start_time: selectedSlot.slot_start_time,
      end_time: selectedSlot.slot_end_time,
      prospect_name: prospectName,
      prospect_email: prospectEmail,
      prospect_whatsapp: prospectWhatsapp,
      is_minor: isMinor,
      child_name: isMinor ? childName : undefined,
    });
    setResult(res);
    setStep('success');
  };

  const handleCopyMessage = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.whatsapp_message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedFacility = facilities.find((f) => f.id === facilityId);
  const selectedCoach = activeCoaches.find((c: any) => c.id === coachId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-card text-card-foreground border-border/40 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <CalendarCheck className="h-6 w-6 text-primary" /> Agendar Clase de Prueba
          </DialogTitle>
          <DialogDescription className="text-muted-foreground/80">
            Solo se muestran horarios donde la cancha y el entrenador coinciden.
          </DialogDescription>
        </DialogHeader>

        {/* ── Paso 1: cancha + coach ── */}
        {step === 'select' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-3">
              <Label className="text-sm font-semibold tracking-tight">Categoría</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="bg-muted/30 border-border/50 h-11">
                  <SelectValue placeholder="Selecciona una categoría…" />
                </SelectTrigger>
                <SelectContent>
                  {activeCategories.map((c) => (
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
              {activeCategories.length === 0 && (
                <p className="text-xs text-muted-foreground">No hay categorías activas — créalas desde "Configurar".</p>
              )}
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
                    <SelectItem key={f.id} value={f.id}>
                      <div className="flex flex-col">
                        <span className="font-semibold">{f.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{f.type}</span>
                      </div>
                    </SelectItem>
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
              {activeCoaches.length === 0 && (
                <p className="text-xs text-muted-foreground">No hay entrenadores activos registrados.</p>
              )}
            </div>

            <Button
              className="w-full h-11 text-base font-semibold"
              onClick={handleFetchSlots}
              disabled={!categoryId || !facilityId || !coachId || loadingSlots}
            >
              {loadingSlots ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              Ver horarios disponibles
            </Button>
          </div>
        )}

        {/* ── Paso 2: horarios conjuntos ── */}
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
              <Button onClick={() => setStep('prospect')} disabled={!selectedSlot} className="flex-1 h-11 font-bold">
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* ── Paso 3: datos del prospecto ── */}
        {step === 'prospect' && selectedSlot && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 text-sm space-y-1.5">
                {selectedCategory && (
                  <p className="font-bold flex items-center gap-2 text-primary">
                    {selectedCategory.name}
                    <span className="text-xs font-semibold text-muted-foreground">
                      {selectedCategory.price > 0 ? `$${selectedCategory.price.toLocaleString('es-CO')} COP` : 'Sin costo'}
                    </span>
                  </p>
                )}
                <p className="font-bold flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-primary" />{selectedFacility?.name}</p>
                <p className="font-medium text-muted-foreground flex items-center gap-2"><UserCircle2 className="h-3.5 w-3.5 text-primary" />{selectedCoach?.full_name}</p>
                <p className="font-medium text-muted-foreground flex items-center gap-2 capitalize">
                  <CalendarCheck className="h-3.5 w-3.5 text-primary" />
                  {format(parseISO(selectedSlot.slot_date), 'EEEE d MMM', { locale: es })} · {selectedSlot.slot_start_time.slice(0, 5)}
                </p>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Label className="text-sm font-semibold tracking-tight">¿El prospecto es menor o mayor de edad?</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsMinor(true)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 py-5 transition-all duration-200 ${
                    isMinor === true
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/10 shadow-md'
                      : 'border-border/50 bg-muted/30 hover:border-blue-500/40 hover:bg-blue-50/50 dark:hover:bg-blue-950/10'
                  }`}
                >
                  <Baby className="h-8 w-8" />
                  <span className="text-sm font-bold">Menor de Edad</span>
                  <span className="text-[11px] text-muted-foreground">Requiere acudiente</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMinor(false)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 py-5 transition-all duration-200 ${
                    isMinor === false
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/10 shadow-md'
                      : 'border-border/50 bg-muted/30 hover:border-emerald-500/40 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10'
                  }`}
                >
                  <User className="h-8 w-8" />
                  <span className="text-sm font-bold">Mayor de Edad</span>
                  <span className="text-[11px] text-muted-foreground">Más de 18 años</span>
                </button>
              </div>
            </div>

            {isMinor !== null && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {isMinor && (
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold tracking-tight">Nombre del hijo/a</Label>
                    <Input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="Nombre completo del menor" className="bg-muted/30 border-border/50 h-11" />
                  </div>
                )}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold tracking-tight">{isMinor ? 'Nombre del acudiente' : 'Nombre del prospecto'}</Label>
                  <Input value={prospectName} onChange={(e) => setProspectName(e.target.value)} placeholder="Nombre completo" className="bg-muted/30 border-border/50 h-11" />
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-semibold tracking-tight">{isMinor ? 'Correo del acudiente' : 'Correo'}</Label>
                  <Input type="email" value={prospectEmail} onChange={(e) => setProspectEmail(e.target.value)} placeholder="correo@ejemplo.com" className="bg-muted/30 border-border/50 h-11" />
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-semibold tracking-tight">{isMinor ? 'WhatsApp del acudiente' : 'WhatsApp'}</Label>
                  <Input value={prospectWhatsapp} onChange={(e) => setProspectWhatsapp(e.target.value)} placeholder="+57 300 000 0000" className="bg-muted/30 border-border/50 h-11" />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('slots')} className="flex-1 h-11 font-medium border-border/50">Atrás</Button>
              <Button
                onClick={handleSubmit}
                disabled={isMinor === null || !prospectName || !prospectEmail || !prospectWhatsapp || (isMinor && !childName) || isCreating}
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {isCreating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                Agendar
              </Button>
            </div>
          </div>
        )}

        {/* ── Paso 4: éxito ── */}
        {step === 'success' && result && (
          <div className="space-y-5 animate-in fade-in duration-300 text-center">
            <div className="flex justify-center">
              <div className="bg-emerald-500/10 p-4 rounded-full ring-8 ring-emerald-500/5">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg">¡Clase de prueba agendada!</h3>
              <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {result.email_sent ? 'Correo de confirmación enviado.' : 'No se pudo enviar el correo — reenvíalo desde la agenda.'}
              </p>
            </div>

            <Card className="border-border/40 bg-muted/20 text-left">
              <CardContent className="p-4 text-sm italic text-muted-foreground">
                "{result.whatsapp_message}"
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleCopyMessage} className="flex-1 h-11 font-medium border-border/50">
                {copied ? <Check className="h-4 w-4 mr-2 text-emerald-600" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? 'Copiado' : 'Copiar mensaje'}
              </Button>
              <Button
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={() => window.open(result.whatsapp_link, '_blank')}
              >
                <MessageCircle className="h-4 w-4 mr-2" /> Abrir WhatsApp
              </Button>
            </div>

            <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
