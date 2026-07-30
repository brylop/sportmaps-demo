import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  Building2, Calendar, Clock, Users, ArrowLeft, ArrowRight, Loader2,
  Phone, Mail, User, CheckCircle2, AlertCircle, ShieldCheck, Sparkles,
} from 'lucide-react';

const BFF_URL = import.meta.env.VITE_BFF_URL ?? '';

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Facility {
  id: string;
  name: string;
  type: string;
  capacity: number;
}

interface SchoolInfo {
  school: { id: string; name: string };
  facilities: Facility[];
  courtesy_available: boolean;
}

interface Slot {
  facility_availability_id: string;
  date: string;
  start_time: string;
  end_time: string;
  available_spots: number;
  is_full: boolean;
}

// 'welcome' es solo copy/bienvenida — NUNCA decide el escenario real.
// El teléfono, verificado en el backend, sigue siendo la única fuente de verdad.
type Step =
  | 'welcome' | 'facility' | 'slots' | 'phone'
  | 'email_needed' | 'new_details' | 'code' | 'success' | 'pending';

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
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'short',
  });
}

// ── Componente principal ────────────────────────────────────────────────────────

export default function PublicFacilityBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();

  const [loadingSchool, setLoadingSchool] = useState(true);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [step, setStep] = useState<Step>('welcome');
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);

  // Solo bienvenida/copy — no se manda al backend, no decide nada por sí sola.
  const [returningHint, setReturningHint] = useState<'returning' | 'new' | null>(null);

  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [bookingToken, setBookingToken] = useState<string | null>(null);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pendingSlot, setPendingSlot] = useState<Slot | null>(null); // elegido ANTES de identificarse
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingApprovalMsg, setPendingApprovalMsg] = useState<string | null>(null);

  // ── Cargar escuela ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const data = await api(`/schools/${slug}`);
        setSchoolInfo(data);
        if (!data.facilities.length) setNotFound(true);
      } catch {
        setNotFound(true);
      } finally {
        setLoadingSchool(false);
      }
    })();
  }, [slug]);

  const handleWelcomeChoice = (hint: 'returning' | 'new') => {
    setReturningHint(hint);
    if (schoolInfo && schoolInfo.facilities.length === 1) {
      setSelectedFacility(schoolInfo.facilities[0]);
      setStep('slots');
    } else {
      setStep('facility');
    }
  };

  const handlePickFacility = (f: Facility) => {
    setSelectedFacility(f);
    setStep('slots');
  };

  // ── Cargar slots — SIN identificarse todavía, solo con school_id ───────────
  useEffect(() => {
    if (step !== 'slots' || !schoolInfo || !selectedFacility) return;
    (async () => {
      setLoadingSlots(true);
      setErrorMsg(null);
      try {
        const data = await api(`/slots?school_id=${schoolInfo.school.id}&facility_id=${selectedFacility.id}`);
        setSlots(data.slots || []);
      } catch (err: any) {
        setErrorMsg(err.body?.error || 'No se pudieron cargar los horarios.');
      } finally {
        setLoadingSlots(false);
      }
    })();
  }, [step, schoolInfo, selectedFacility]);

  const availableDates = useMemo(() => {
    return [...new Set(slots.filter(s => !s.is_full).map(s => s.date))].sort();
  }, [slots]);

  const slotsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return slots.filter(s => s.date === selectedDate).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [slots, selectedDate]);

  const handlePickSlot = (s: Slot) => {
    setPendingSlot(s);
    setStep('phone');
  };

  // ── Paso teléfono ─────────────────────────────────────────────────────────────
  async function handleStartVerification(extra?: { full_name?: string; email?: string }) {
    if (!schoolInfo) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const data = await api('/start-verification', {
        method: 'POST',
        body: JSON.stringify({ school_id: schoolInfo.school.id, phone, ...(extra || {}) }),
      });

      if (data.scenario === 'enrolled_needs_email') {
        setStep('email_needed');
        return;
      }
      if (data.scenario === 'new_needs_details') {
        setStep('new_details');
        return;
      }

      setVerificationId(data.verification_id);
      setMaskedEmail(data.masked_email);

      // Si hay un debug_code (modo desarrollo), verificamos automáticamente de una vez
      if (data.debug_code) {
        console.log('🔑 DEBUG — código OTP auto-verificado:', data.debug_code);
        const verifyData = await api('/verify-otp', {
          method: 'POST',
          body: JSON.stringify({ verification_id: data.verification_id, code: data.debug_code }),
        });

        if (verifyData.scenario === 'registered') {
          toast({ title: '✅ Verificado', description: 'Redirigiendo a tu cuenta...' });
          window.location.href = verifyData.magic_link;
          return;
        }

        setBookingToken(verifyData.booking_token);
        await handleConfirm(verifyData.booking_token);
        return;
      }

      // Si no, mostramos el paso de ingresar código tradicionalmente
      setStep('code');
      toast({ title: '📩 Código enviado', description: `Revisa ${data.masked_email}` });
    } catch (err: any) {
      if (err.body?.reason === 'no_courtesy') {
        setErrorMsg('No encontramos tu número en nuestros registros y esta escuela no tiene clases de cortesía activas en este momento.');
      } else {
        setErrorMsg(err.body?.error || 'No se pudo procesar tu solicitud.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitEmailForEnrolled() {
    await handleStartVerification({ email });
  }

  async function handleSubmitNewDetails() {
    if (!fullName.trim() || !email.trim()) {
      setErrorMsg('Nombre y correo son requeridos.');
      return;
    }
    await handleStartVerification({ full_name: fullName, email });
  }

  // ── Paso código ───────────────────────────────────────────────────────────────
  async function handleVerifyCode() {
    if (!verificationId || code.length !== 6) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const data = await api('/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ verification_id: verificationId, code }),
      });

      if (data.scenario === 'registered') {
        toast({ title: '✅ Verificado', description: 'Redirigiendo a tu cuenta...' });
        window.location.href = data.magic_link;
        return;
      }

      setBookingToken(data.booking_token);
      // Ya identificado y con el slot elegido antes → confirmar directo
      await handleConfirm(data.booking_token);
    } catch (err: any) {
      const reason = err.body?.reason;
      if (reason === 'wrong_code') {
        setErrorMsg(`Código incorrecto. Te quedan ${err.body?.attempts_left ?? 0} intentos.`);
      } else if (reason === 'expired') {
        setErrorMsg('El código expiró. Vuelve a empezar para pedir uno nuevo.');
      } else {
        setErrorMsg(err.body?.error || 'No se pudo verificar el código.');
      }
    } finally {
      setBusy(false);
    }
  }

  // ── Confirmar reserva (se dispara automático justo tras verificar el código) ──
  async function handleConfirm(tokenOverride?: string) {
    const tokenToUse = tokenOverride ?? bookingToken;
    if (!pendingSlot || !tokenToUse) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const data = await api('/confirm', {
        method: 'POST',
        body: JSON.stringify({
          token: tokenToUse,
          facility_availability_id: pendingSlot.facility_availability_id,
          date: pendingSlot.date,
        }),
      });

      if (data.pending_approval) {
        setPendingApprovalMsg(data.message);
        setStep('pending');
      } else {
        setStep('success');
      }
    } catch (err: any) {
      setErrorMsg(err.body?.error || 'No se pudo confirmar la reserva.');
      if (err.body?.reason === 'capacity_full') {
        setPendingSlot(null);
        setStep('slots');
      }
    } finally {
      setBusy(false);
    }
  }


  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadingSchool) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-2/3 mx-auto" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (notFound || !schoolInfo) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <Card className="max-w-md text-center shadow-xl">
          <CardContent className="pt-8 pb-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Link no disponible</h2>
            <p className="text-muted-foreground">
              Este link de agendamiento no existe o la escuela aún no tiene instalaciones habilitadas.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4">
      <div className="container max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{schoolInfo.school.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Agenda tu clase en nuestras instalaciones</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardContent className="p-6">

            {/* ── Paso: bienvenida (solo copy, no decide el escenario real) ── */}
            {step === 'welcome' && (
              <div className="space-y-5 text-center">
                <Sparkles className="h-9 w-9 text-primary mx-auto" />
                <div>
                  <h2 className="font-bold text-xl">¡Bienvenido!</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Para darte la mejor experiencia, cuéntanos un poco de ti
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 pt-2">
                  <button
                    onClick={() => handleWelcomeChoice('returning')}
                    className="p-4 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left flex items-center gap-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">Ya soy parte de {schoolInfo.school.name}</p>
                      <p className="text-xs text-muted-foreground">Tengo un plan o ya me conocen aquí</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleWelcomeChoice('new')}
                    className="p-4 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left flex items-center gap-3"
                  >
                    <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">Es mi primera vez aquí</p>
                      <p className="text-xs text-muted-foreground">Quiero conocer la escuela</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* ── Paso: elegir instalación ── */}
            {step === 'facility' && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground mb-3">Elige la instalación</p>
                {schoolInfo.facilities.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handlePickFacility(f)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
                  >
                    <div>
                      <p className="font-semibold">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.type}</p>
                    </div>
                    <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />{f.capacity}</Badge>
                  </button>
                ))}
              </div>
            )}

            {/* ── Paso: elegir horario (SIN identificarse todavía) ── */}
            {step === 'slots' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <h2 className="font-bold text-lg">{selectedFacility?.name}</h2>
                  </div>
                  {schoolInfo.facilities.length > 1 && (
                    <button onClick={() => setStep('facility')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                      <ArrowLeft className="h-3 w-3" /> Cambiar
                    </button>
                  )}
                </div>

                {loadingSlots ? (
                  <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
                ) : errorMsg ? (
                  <p className="text-sm text-red-600 text-center py-6">{errorMsg}</p>
                ) : availableDates.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No hay horarios disponibles en este momento.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {availableDates.map((d) => (
                        <button
                          key={d}
                          onClick={() => setSelectedDate(d)}
                          className={`shrink-0 flex flex-col items-center px-4 py-2.5 rounded-xl border transition-all ${
                            selectedDate === d ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/40'
                          }`}
                        >
                          <span className="text-[10px] uppercase font-bold opacity-70">{fmtDate(d).split(' ')[0]}</span>
                          <span className="text-sm font-bold">{fmtDate(d).split(' ')[1]}</span>
                        </button>
                      ))}
                    </div>

                    {selectedDate && (
                      <div className="space-y-2 pt-2">
                        {slotsForSelectedDate.map((s) => (
                          <button
                            key={s.facility_availability_id + s.date}
                            disabled={s.is_full}
                            onClick={() => handlePickSlot(s)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                              s.is_full ? 'opacity-40 border-border cursor-not-allowed' : 'border-border hover:border-primary/40 hover:bg-primary/5'
                            }`}
                          >
                            <span className="flex items-center gap-2 font-semibold text-sm">
                              <Clock className="h-4 w-4 text-primary" />
                              {fmtTime(s.start_time)} — {fmtTime(s.end_time)}
                            </span>
                            <Badge variant={s.is_full ? 'secondary' : 'outline'} className="text-[10px]">
                              {s.is_full ? 'Lleno' : `${s.available_spots} cupos`}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Paso: teléfono (ya con el horario elegido, copy según la bienvenida) ── */}
            {step === 'phone' && (
              <div className="space-y-5">
                <button onClick={() => { setStep('slots'); setPendingSlot(null); }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                  <ArrowLeft className="h-3 w-3" /> Cambiar horario
                </button>

                {pendingSlot && (
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-center">
                    <p className="text-xs font-semibold capitalize">{fmtDate(pendingSlot.date)}</p>
                    <p className="text-xs text-muted-foreground">{fmtTime(pendingSlot.start_time)} — {fmtTime(pendingSlot.end_time)}</p>
                  </div>
                )}

                <div className="text-center">
                  <Phone className="h-8 w-8 text-primary mx-auto mb-2" />
                  <h2 className="font-bold text-lg">Ingresa tu celular</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {returningHint === 'new'
                      ? 'Verifiquemos tu número — si es tu primera vez, puede que tengas una clase de cortesía 🎉'
                      : 'Así identificamos tu plan o inscripción con nosotros'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Número de celular</Label>
                  <Input
                    type="tel"
                    placeholder="300 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12 text-center text-lg tracking-wide"
                  />
                </div>
                {errorMsg && <p className="text-sm text-red-600 text-center">{errorMsg}</p>}
                <Button
                  onClick={() => handleStartVerification()}
                  disabled={busy || phone.replace(/\D/g, '').length < 7}
                  className="w-full h-12 gap-2"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Continuar
                </Button>
              </div>
            )}

            {/* ── Paso: email para inscrito sin cuenta (Escenario 2) ── */}
            {step === 'email_needed' && (
              <div className="space-y-5">
                <div className="text-center">
                  <Mail className="h-8 w-8 text-primary mx-auto mb-2" />
                  <h2 className="font-bold text-lg">¡Ya tienes una inscripción!</h2>
                  <p className="text-xs text-muted-foreground mt-1">Necesitamos un correo para enviarte el código de verificación</p>
                </div>
                <div className="space-y-2">
                  <Label>Correo electrónico</Label>
                  <Input type="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
                </div>
                {errorMsg && <p className="text-sm text-red-600 text-center">{errorMsg}</p>}
                <Button onClick={handleSubmitEmailForEnrolled} disabled={busy || !email.includes('@')} className="w-full h-12 gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Enviar código
                </Button>
              </div>
            )}

            {/* ── Paso: datos de persona nueva (Escenario 1 — cortesía) ── */}
            {step === 'new_details' && (
              <div className="space-y-5">
                <div className="text-center">
                  <Sparkles className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                  <h2 className="font-bold text-lg">¡Tienes una clase de cortesía!</h2>
                  <p className="text-xs text-muted-foreground mt-1">Cuéntanos quién eres para poder registrarte</p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Nombre completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Tu nombre" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-12 pl-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Correo electrónico</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 pl-10" />
                    </div>
                  </div>
                </div>
                {errorMsg && <p className="text-sm text-red-600 text-center">{errorMsg}</p>}
                <Button onClick={handleSubmitNewDetails} disabled={busy} className="w-full h-12 gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Enviar código de verificación
                </Button>
              </div>
            )}

            {/* ── Paso: código OTP ── */}
            {step === 'code' && (
              <div className="space-y-5">
                <div className="text-center">
                  <ShieldCheck className="h-8 w-8 text-primary mx-auto mb-2" />
                  <h2 className="font-bold text-lg">Ingresa el código</h2>
                  <p className="text-xs text-muted-foreground mt-1">Lo enviamos a {maskedEmail}</p>
                </div>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="h-14 text-center text-2xl tracking-[0.5em] font-bold"
                />
                {errorMsg && <p className="text-sm text-red-600 text-center">{errorMsg}</p>}
                <Button onClick={handleVerifyCode} disabled={busy || code.length !== 6} className="w-full h-12 gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Verificar y confirmar reserva
                </Button>
                <button onClick={() => { setStep('phone'); setCode(''); setErrorMsg(null); }} className="w-full text-xs text-muted-foreground hover:text-primary">
                  ¿No te llegó? Volver a empezar
                </button>
              </div>
            )}

            {/* ── Éxito ── */}
            {step === 'success' && (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-500" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">¡Reserva confirmada!</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Te esperamos en {selectedFacility?.name} el {pendingSlot && fmtDate(pendingSlot.date)}.
                  </p>
                </div>
              </div>
            )}

            {/* ── Pendiente de aprobación ── */}
            {step === 'pending' && (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-500" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Solicitud enviada</h2>
                  <p className="text-sm text-muted-foreground mt-1">{pendingApprovalMsg}</p>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
