import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles, ArrowRight, ArrowLeft, Loader2, Mail, User,
  CheckCircle2, AlertCircle, Baby, Building2, Calendar, Lock, Zap,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { startOfMonth, endOfMonth, eachDayOfInterval, isBefore, isToday, startOfDay, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';
import { useAvailableSessions, useBookSession, type BookableSession } from '@/hooks/useAthleteSessionBookings';

/**
 * Link público NUEVO y separado de /agendar/:slug (facilities + cortesía,
 * SEG-20) — este es para clases de prueba Y para que un usuario YA
 * REGISTRADO se autentique y agende su clase de plan, sin salir de esta
 * página (decisión de producto: "el mismo link resuelve los dos casos").
 * Ver docs/specs/mis-inscripciones-agenda-clases-prueba.md.
 *
 * Primero se identifica (correo) — recién ahí se decide el camino:
 * ya tiene cuenta → login inline + sus clases de plan (useAthleteSessionBookings,
 * el MISMO hook que usa Mis Inscripciones); si no, clases de prueba (OTP,
 * igual que ya estaba).
 */

const BFF_URL = import.meta.env.VITE_BFF_URL ?? '';

interface TrialCategory {
  id: string;
  name: string;
  description: string | null;
  price: number;
}

interface SchoolInfo {
  school: { id: string; name: string };
  trial_classes_available: boolean;
  trial_categories: TrialCategory[];
}

interface Slot {
  slot_date: string;
  slot_start_time: string;
  slot_end_time: string;
  facility_availability_id: string;
  coach_availability_id: string;
  facility_id: string;
  facility_name: string;
}

interface ChildOption {
  id: string;
  full_name: string;
}

type Step =
  | 'welcome' | 'identify' | 'new_details' | 'password' | 'plan_pick_child' | 'plan_sessions' | 'plan_success'
  | 'code' | 'category' | 'slots' | 'contact_details' | 'trial_success' | 'not_available';

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BFF_URL}/api/v1/public/booking${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || 'Error'), { body, status: res.status });
  return body;
}

function fmtTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' });
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-left flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
      <p className="text-xs text-red-700 dark:text-red-300">{message}</p>
    </div>
  );
}

export default function PublicTrialClassBookingPage() {
  const { slug } = useParams<{ slug: string }>();

  const [loadingSchool, setLoadingSchool] = useState(true);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [step, setStepRaw] = useState<Step>('welcome');
  const [stepHistory, setStepHistory] = useState<Step[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TrialCategory | null>(null);
  // Solo bienvenida/copy — no se manda al backend, no decide nada por sí sola
  // (mismo patrón que PublicFacilityBookingPage.tsx).
  const [returningHint, setReturningHint] = useState<'returning' | 'new' | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [bookingToken, setBookingToken] = useState<string | null>(null);
  const [resolvedKind, setResolvedKind] = useState<'new' | 'enrolled_unregistered' | null>(null);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [whatsapp, setWhatsapp] = useState('+57 ');
  const [isMinor, setIsMinor] = useState(false);
  const [childName, setChildName] = useState('');

  // ── Camino "ya tiene cuenta" — login inline + sus clases de PLAN ─────────
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [planChildren, setPlanChildren] = useState<ChildOption[]>([]);
  const [planChildId, setPlanChildId] = useState<string | undefined>(undefined);
  const [planIsAthleteSelf, setPlanIsAthleteSelf] = useState(false);
  const { data: planSessions, isLoading: loadingPlanSessions } = useAvailableSessions(
    step === 'plan_sessions' ? planChildId : undefined,
  );
  const { mutateAsync: bookPlanSession, isPending: bookingPlan } = useBookSession(planChildId);
  const [bookedPlanSession, setBookedPlanSession] = useState<BookableSession | null>(null);
  // Calendario tipo mes (mismo patrón que "Mis Inscripciones" / PT booking)
  // para elegir día antes de ver los horarios de ese día.
  const [planCalendarDate, setPlanCalendarDate] = useState(new Date());
  const [selectedPlanDate, setSelectedPlanDate] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ price: number; is_first: boolean } | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const data = await api(`/schools/${slug}`);
        setSchoolInfo(data);
        bffClient.setSchoolId(data.school.id);
      } catch {
        setNotFound(true);
      } finally {
        setLoadingSchool(false);
      }
    })();
  }, [slug]);

  const slotsByDate = useMemo(() => {
    const groups: Record<string, Slot[]> = {};
    for (const s of slots) {
      groups[s.slot_date] = groups[s.slot_date] ?? [];
      groups[s.slot_date].push(s);
    }
    return groups;
  }, [slots]);

  const planSessionsByDate = useMemo(() => {
    const groups: Record<string, BookableSession[]> = {};
    for (const s of planSessions?.sessions ?? []) {
      groups[s.session_date] = groups[s.session_date] ?? [];
      groups[s.session_date].push(s);
    }
    return groups;
  }, [planSessions]);

  const availablePlanDates = useMemo(
    () => new Set(Object.keys(planSessionsByDate)),
    [planSessionsByDate],
  );

  // ── Navegación: pila de pasos, para poder "Volver" en cualquier punto ───
  const goTo = (next: Step) => {
    setStepHistory((h) => [...h, step]);
    setErrorMsg(null);
    setStepRaw(next);
  };

  const goBack = () => {
    setStepHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setErrorMsg(null);
      // Limpiar campos que quedarían "adelante" y podrían quedar obsoletos.
      if (prev === 'identify' || prev === 'new_details') {
        setPassword('');
        setCode('');
      }
      if (prev === 'category' || prev === 'code') {
        setSelectedSlot(null);
      }
      setStepRaw(prev);
      return h.slice(0, -1);
    });
  };

  const canGoBack = stepHistory.length > 0 && step !== 'trial_success' && step !== 'plan_success';

  // ── Paso 0: bienvenida — nuevo o antiguo (mismo filtro que /agendar/:slug) ──
  const handleWelcomeChoice = (hint: 'returning' | 'new') => {
    setReturningHint(hint);
    goTo('identify');
  };

  // ── Paso 1: identificarse (correo, siempre primero) ─────────────────────
  const handleStartVerification = async () => {
    if (!schoolInfo || !email.trim()) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const data = await api('/trial-start-verification', {
        method: 'POST',
        body: JSON.stringify({ school_id: schoolInfo.school.id, email: email.trim(), full_name: fullName.trim() || undefined }),
      });

      if (data.scenario === 'already_registered') {
        goTo('password');
      } else if (data.scenario === 'new_needs_name') {
        goTo('new_details');
      } else {
        setVerificationId(data.verification_id);
        setMaskedEmail(data.masked_email);
        setResolvedKind(data.scenario);
        if (data.debug_code) {
          // Modo debug local (PUBLIC_BOOKING_DEBUG_OTP=true, solo dev) — nos
          // saltamos el paso de código y verificamos de una vez, igual que
          // PublicFacilityBookingPage.tsx.
          console.log('🔑 DEBUG — código OTP auto-verificado:', data.debug_code);
          await verifyCode(data.verification_id, data.debug_code);
        } else {
          goTo('code');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.body?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (verifId: string, codeValue: string) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const data = await api('/verify-otp', { method: 'POST', body: JSON.stringify({ verification_id: verifId, code: codeValue }) });
      setBookingToken(data.booking_token);
      setResolvedKind(data.scenario);
      if (!schoolInfo?.trial_categories.length) {
        setErrorMsg('Esta escuela no tiene categorías de prueba disponibles.');
        return;
      }
      goTo('category');
    } catch (err: any) {
      setErrorMsg(err.body?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationId || !code.trim()) return;
    await verifyCode(verificationId, code.trim());
  };

  // ── Camino "ya registrado": login inline + sus clases de plan ───────────
  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.session) {
        setErrorMsg('Correo o contraseña incorrectos.');
        return;
      }

      setLoadingChildren(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { data: children } = await supabase
        .from('children')
        .select('id, full_name')
        .eq('parent_id', user?.id ?? '');
      setLoadingChildren(false);

      if (children && children.length > 0) {
        setPlanChildren(children);
        goTo('plan_pick_child');
      } else {
        setPlanIsAthleteSelf(true);
        setPlanChildId(undefined);
        setSelectedPlanDate(null);
        setPlanCalendarDate(new Date());
        goTo('plan_sessions');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  const handlePickPlanChild = (c: ChildOption) => {
    setPlanChildId(c.id);
    setPlanIsAthleteSelf(false);
    setSelectedPlanDate(null);
    setPlanCalendarDate(new Date());
    goTo('plan_sessions');
  };

  const handleBookPlanSession = async (s: BookableSession) => {
    if (!s.enrollment_id) {
      setErrorMsg('No encontramos una inscripción activa para esta clase.');
      return;
    }
    try {
      await bookPlanSession({ session_id: s.id, enrollment_id: s.enrollment_id });
      setBookedPlanSession(s);
      goTo('plan_success');
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo agendar la clase.');
    }
  };

  // ── Camino "clase de prueba" (OTP) ───────────────────────────────────────
  const handlePickCategory = async (c: TrialCategory) => {
    setSelectedCategory(c);
    setSelectedSlot(null);
    setLoadingSlots(true);
    setErrorMsg(null);
    try {
      const from = new Date().toISOString().split('T')[0];
      const toDate = new Date();
      toDate.setDate(toDate.getDate() + 14);
      const to = toDate.toISOString().split('T')[0];
      const params = new URLSearchParams({ token: bookingToken || '', category_id: c.id, from, to });
      const data = await api(`/trial-slots?${params.toString()}`);
      setSlots(data);
      goTo('slots');
    } catch (err: any) {
      setErrorMsg(err.body?.error || err.message);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSlotContinue = () => {
    if (!selectedSlot) return;
    if (resolvedKind === 'new') {
      goTo('contact_details');
    } else {
      handleConfirmTrial();
    }
  };

  const handleConfirmTrial = async () => {
    if (!selectedSlot || !bookingToken || !selectedCategory) return;
    if (resolvedKind === 'new' && (!whatsapp.trim() || (isMinor && !childName.trim()))) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const data = await api('/trial-confirm', {
        method: 'POST',
        body: JSON.stringify({
          token: bookingToken,
          category_id: selectedCategory.id,
          facility_availability_id: selectedSlot.facility_availability_id,
          coach_availability_id: selectedSlot.coach_availability_id,
          date: selectedSlot.slot_date,
          start_time: selectedSlot.slot_start_time,
          end_time: selectedSlot.slot_end_time,
          ...(resolvedKind === 'new' ? { prospect_whatsapp: whatsapp.trim(), is_minor: isMinor, child_name: isMinor ? childName.trim() : undefined } : {}),
        }),
      });
      setSuccessInfo({ price: data.price, is_first: data.is_first });
      goTo('trial_success');
    } catch (err: any) {
      setErrorMsg(err.body?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loadingSchool) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Skeleton className="h-64 w-full max-w-md rounded-2xl" />
      </div>
    );
  }

  if (notFound || !schoolInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <div>
          <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">No encontramos esta escuela.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 flex items-start justify-center p-4 py-10">
      <Card className="w-full max-w-md border-border/40 shadow-lg">
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-1">
            <div className="flex justify-center">
              <div className="bg-primary/10 p-3 rounded-full"><Sparkles className="h-6 w-6 text-primary" /></div>
            </div>
            <h1 className="text-lg font-bold">{schoolInfo.school.name}</h1>
            <p className="text-xs text-muted-foreground">Agenda tu clase</p>
          </div>

          {canGoBack && (
            <button
              type="button"
              onClick={goBack}
              disabled={busy}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Volver
            </button>
          )}

          {errorMsg && <ErrorBanner message={errorMsg} />}

          {/* ── Paso 0: bienvenida — nuevo o antiguo (solo copy, no decide nada) ── */}
          {step === 'welcome' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <p className="text-xs text-center text-muted-foreground">
                Para darte la mejor experiencia, contanos un poco de vos
              </p>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => handleWelcomeChoice('returning')}
                  className="p-4 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left flex items-center gap-3"
                >
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Ya soy parte de {schoolInfo.school.name}</p>
                    <p className="text-xs text-muted-foreground">Tengo un plan o ya me conocen acá</p>
                  </div>
                </button>
                <button
                  onClick={() => handleWelcomeChoice('new')}
                  className="p-4 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left flex items-center gap-3"
                >
                  <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Es mi primera vez acá</p>
                    <p className="text-xs text-muted-foreground">Quiero conocer la escuela</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── Paso 1: identificarse ── */}
          {step === 'identify' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Tu correo</Label>
                <div className="relative">
                  <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className="pl-9 h-11" />
                </div>
              </div>
              <Button onClick={handleStartVerification} disabled={!email.trim() || busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continuar <ArrowRight className="h-4 w-4 ml-1" /></>}
              </Button>
              <p className="text-[11px] text-center text-muted-foreground">
                {returningHint === 'new'
                  ? 'Verifiquemos tu correo — si es tu primera vez, agendás una clase de prueba 🎉'
                  : 'Si ya tenés cuenta, te pedimos tu contraseña acá mismo. Si no, agendás una clase de prueba.'}
              </p>
            </div>
          )}

          {step === 'new_details' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">No te tenemos registrado — ¿cuál es tu nombre completo?</Label>
                <div className="relative">
                  <User className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre completo" className="pl-9 h-11" />
                </div>
              </div>
              <Button onClick={handleStartVerification} disabled={!fullName.trim() || busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar código de verificación'}
              </Button>
            </div>
          )}

          {/* ── Ya registrado: login inline, sin salir de la página ── */}
          {step === 'password' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <p className="text-xs text-muted-foreground">Ya tenés cuenta con <strong>{email}</strong> — iniciá sesión para agendar tu clase.</p>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Contraseña</Label>
                <div className="relative">
                  <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-9 h-11" onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
                </div>
              </div>
              <Button onClick={handleLogin} disabled={!password || busy || loadingChildren} className="w-full">
                {busy || loadingChildren ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Iniciar sesión y agendar'}
              </Button>
            </div>
          )}

          {step === 'plan_pick_child' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">¿Para quién agendás?</Label>
              {planChildren.map((c) => (
                <button key={c.id} onClick={() => handlePickPlanChild(c)} className="w-full text-left rounded-xl border-2 border-border/50 hover:border-primary/40 p-4 transition-all flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> <span className="font-semibold text-sm">{c.full_name}</span>
                </button>
              ))}
            </div>
          )}

          {step === 'plan_sessions' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                {planIsAthleteSelf ? 'Tus clases disponibles' : `Clases de ${planChildren.find((c) => c.id === planChildId)?.full_name ?? 'tu hijo/a'}`}
              </p>
              {loadingPlanSessions ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              ) : Object.keys(planSessionsByDate).length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-6">No hay clases disponibles para agendar en este momento.</p>
              ) : (
                <>
                  {/* Calendario tipo mes: primero se elige el día, después se
                      despliegan los horarios de ese día. */}
                  <div className="rounded-xl border border-border/40 overflow-hidden bg-muted/10">
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
                      <button
                        type="button"
                        onClick={() => setPlanCalendarDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))}
                        className="p-1 rounded-md hover:bg-muted/60 transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <p className="text-xs font-black uppercase tracking-wider capitalize">
                        {format(planCalendarDate, 'MMMM yyyy', { locale: es })}
                      </p>
                      <button
                        type="button"
                        onClick={() => setPlanCalendarDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))}
                        className="p-1 rounded-md hover:bg-muted/60 transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 text-center border-b border-border/20">
                      {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
                        <div key={d} className="py-1.5 text-[9px] font-black text-muted-foreground uppercase">{d}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 p-1">
                      {(() => {
                        const monthStart = startOfMonth(planCalendarDate);
                        const monthEnd = endOfMonth(planCalendarDate);
                        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
                        const startPad = (monthStart.getDay() + 6) % 7;
                        const todayDate = startOfDay(new Date());

                        return (
                          <>
                            {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
                            {days.map((day) => {
                              const dateStr = format(day, 'yyyy-MM-dd');
                              const isPast = isBefore(day, todayDate);
                              const isToday_ = isToday(day);
                              const isSelected = selectedPlanDate === dateStr;
                              const isAvailable = availablePlanDates.has(dateStr);

                              return (
                                <button
                                  key={dateStr}
                                  type="button"
                                  disabled={isPast || !isAvailable}
                                  onClick={() => setSelectedPlanDate(isSelected ? null : dateStr)}
                                  className={`relative flex flex-col items-center justify-center py-1.5 mx-0.5 my-0.5 text-[11px] font-semibold rounded-lg transition-all
                                    ${isSelected ? 'bg-primary text-primary-foreground shadow-md'
                                      : (isAvailable && !isPast) ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer'
                                        : 'text-muted-foreground/30 cursor-default'}
                                    ${isToday_ && !isSelected ? 'ring-1 ring-primary/50' : ''}`}
                                >
                                  {format(day, 'd')}
                                  {isAvailable && !isPast && !isSelected && (
                                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary/40" />
                                  )}
                                </button>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {!selectedPlanDate ? (
                    <div className="py-6 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/40">
                      <Calendar className="h-6 w-6 mx-auto mb-2 opacity-20" />
                      <p className="text-xs font-medium">Selecciona un día con horarios disponibles</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      <p className="text-[11px] font-bold uppercase text-primary capitalize">{fmtDate(selectedPlanDate)}</p>
                      {(planSessionsByDate[selectedPlanDate] ?? []).map((s) => (
                        <button
                          key={s.id}
                          disabled={s.already_booked || s.booking_status !== 'open' || bookingPlan}
                          onClick={() => handleBookPlanSession(s)}
                          className="w-full text-left text-xs rounded-lg border-2 border-border/50 p-3 flex items-center justify-between gap-2 disabled:opacity-50"
                        >
                          <span>
                            <span className="font-bold">{fmtTime(s.start_time)}</span>
                            <span className="text-muted-foreground ml-2">{s.team?.name}</span>
                          </span>
                          {s.already_booked ? <span className="text-muted-foreground">Ya agendada</span> : <ArrowRight className="h-3.5 w-3.5" />}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {step === 'plan_success' && bookedPlanSession && (
            <div className="text-center space-y-4 animate-in fade-in duration-300">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
              <div>
                <p className="font-bold">¡Clase agendada!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fmtDate(bookedPlanSession.session_date)} · {fmtTime(bookedPlanSession.start_time)}
                </p>
              </div>
            </div>
          )}

          {/* ── Clase de prueba: OTP ── */}
          {step === 'code' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <p className="text-xs text-muted-foreground">Te enviamos un código a {maskedEmail}.</p>
              <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" maxLength={6} className="h-12 text-center text-2xl tracking-[0.5em]" />
              <Button onClick={handleVerifyCode} disabled={code.length !== 6 || busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verificar'}
              </Button>
            </div>
          )}

          {step === 'category' && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">¿Qué querés probar?</Label>
              {schoolInfo.trial_categories.map((c) => (
                <button
                  key={c.id}
                  disabled={loadingSlots}
                  onClick={() => handlePickCategory(c)}
                  className="w-full text-left rounded-xl border-2 border-border/50 hover:border-primary/40 p-4 transition-all disabled:opacity-50"
                >
                  <p className="font-bold text-sm">{c.name}</p>
                  {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                  <p className="text-xs font-bold text-emerald-600 mt-1">{c.price > 0 ? `$${c.price.toLocaleString('es-CO')} COP` : 'Sin costo'}</p>
                </button>
              ))}
            </div>
          )}

          {step === 'slots' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Elegí un horario
              </p>
              {loadingSlots ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              ) : Object.keys(slotsByDate).length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-6">No hay horarios disponibles en los próximos días.</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {Object.entries(slotsByDate).map(([date, daySlots]) => (
                    <div key={date} className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase text-primary capitalize">{fmtDate(date)}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {daySlots.map((s) => {
                          const isSel = selectedSlot === s;
                          return (
                            <button
                              key={`${s.facility_availability_id}-${s.coach_availability_id}-${s.slot_start_time}`}
                              onClick={() => setSelectedSlot(s)}
                              className={`text-xs rounded-lg border-2 p-2 text-left transition-all ${isSel ? 'border-primary bg-primary/5' : 'border-border/50'}`}
                            >
                              <p className="font-bold">{fmtTime(s.slot_start_time)}</p>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Building2 className="h-2.5 w-2.5" />{s.facility_name}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={handleSlotContinue} disabled={!selectedSlot || busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continuar'}
              </Button>
            </div>
          )}

          {step === 'contact_details' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Tu WhatsApp</Label>
                <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+57 300 000 0000" className="h-11" />
              </div>
              <button type="button" onClick={() => setIsMinor(!isMinor)} className="flex items-center gap-2 text-xs">
                <Baby className="h-4 w-4" /> Es para un hijo/a menor de edad
                <span className={`ml-auto w-9 h-5 rounded-full transition-colors ${isMinor ? 'bg-primary' : 'bg-muted'}`}>
                  <span className={`block w-4 h-4 rounded-full bg-white transition-transform mt-0.5 ${isMinor ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </span>
              </button>
              {isMinor && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Nombre del hijo/a</Label>
                  <Input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="Nombre completo" className="h-11" />
                </div>
              )}
              <Button onClick={handleConfirmTrial} disabled={!whatsapp.trim() || (isMinor && !childName.trim()) || busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar clase de prueba'}
              </Button>
            </div>
          )}

          {step === 'trial_success' && successInfo && (
            <div className="text-center space-y-4 animate-in fade-in duration-300">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
              <div>
                <p className="font-bold">¡Clase de prueba agendada!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {successInfo.price > 0 ? `Costo: $${successInfo.price.toLocaleString('es-CO')} COP` : 'Sin costo'} · Te llegó un correo de confirmación.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
