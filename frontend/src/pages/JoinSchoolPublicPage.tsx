import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, AlertCircle, MapPin, ArrowRight, ShieldCheck, LogIn, UserPlus, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type LandingData = {
  found: boolean;
  reason?: 'not_found' | 'expired';
  qr_id?: string;
  slug?: string;
  name?: string;
  intro_text?: string | null;
  cta_text?: string;
  accept_payments?: boolean;
  require_first_payment?: boolean;
  target_type?: 'open' | 'team' | 'branch' | 'plan';
  target?: any;
  options?: Array<{ id: string; name: string; sport: string; branch_id: string | null; price_monthly?: number | null }>;
  plans?: Array<{ id: string; name: string; description?: string | null; price_monthly?: number | null; billing_period?: string; sessions_included?: number | null }>;
  business_model?: 'teams' | 'plans' | 'both';
  fixed_amount?: number | null;
  school?: {
    id: string; name: string; slug: string | null;
    logo_url: string | null; cover_image_url: string | null; branding_settings: any;
  };
  payment_info?: any;
};

type Step = 'menu' | 'choose' | 'auth' | 'child' | 'done';

export default function JoinSchoolPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<Step>('menu');
  const [intent, setIntent] = useState<'inscribir' | 'pagar'>('inscribir');
  const [chosenTeamId, setChosenTeamId] = useState<string>('');
  const [chosenPlanId, setChosenPlanId] = useState<string>('');

  // Auth
  const [authTab, setAuthTab] = useState<'login' | 'register'>('register');
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  // Child data
  const [childName, setChildName] = useState('');
  const [childDob, setChildDob] = useState('');
  const [childDocType, setChildDocType] = useState('TI');
  const [childDocNumber, setChildDocNumber] = useState('');
  const [childGender, setChildGender] = useState('');
  const [monthlyFee, setMonthlyFee] = useState<string>('0');
  const [submitting, setSubmitting] = useState(false);

  // Hijos existentes del padre (para ELEGIR en vez de crear uno nuevo).
  const [existingChildren, setExistingChildren] = useState<{ id: string; full_name: string; date_of_birth: string | null }[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('new');

  useEffect(() => {
    if (!user) { setExistingChildren([]); return; }
    supabase.from('children').select('id, full_name, date_of_birth').eq('parent_id', user.id)
      .then(({ data }) => setExistingChildren((data as any) || []));
  }, [user]);

  useEffect(() => {
    if (!slug) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function load() {
    setLoading(true);
    const { data: r, error } = await supabase.rpc('get_join_qr_public' as any, { p_slug: slug });
    setLoading(false);
    if (error || !r) {
      setData({ found: false });
      return;
    }
    setData(r as LandingData);
    if ((r as any).target_type === 'team' && (r as any).target?.id) {
      setChosenTeamId((r as any).target.id);
    }
    if ((r as any).target_type === 'plan' && (r as any).target?.id) {
      setChosenPlanId((r as any).target.id);
    }
  }

  const branding = useMemo(() => data?.school?.branding_settings || {}, [data]);
  const accent: string = branding.primary_color || '#248223';
  const secondary: string = branding.secondary_color || '#FB9F1E';

  // Precio del primer pago: del EQUIPO o PLAN (no lo teclea el padre), y si el QR
  // tiene monto fijo/promo, ese manda. El servidor re-valida en submit_qr_signup.
  // Prioridad: promo (fixed_amount) > plan > equipo.
  const selectedTeamPrice = useMemo(() => {
    const fixed = Number((data as any)?.fixed_amount) || 0;
    if (fixed > 0) return fixed;
    // Plan: target directo o elegido de la lista
    if ((data as any)?.target?.kind === 'plan') return Number((data as any).target.monthly_fee) || 0;
    if (chosenPlanId) {
      const p = data?.plans?.find((o) => o.id === chosenPlanId);
      if (p) return Number((p as any).price_monthly) || 0;
    }
    // Equipo: target directo o elegido de la lista
    if ((data as any)?.target?.kind === 'team') return Number((data as any).target.monthly_fee) || 0;
    const t = data?.options?.find((o) => o.id === chosenTeamId);
    return Number((t as any)?.price_monthly) || 0;
  }, [data, chosenTeamId, chosenPlanId]);

  useEffect(() => { setMonthlyFee(String(selectedTeamPrice)); }, [selectedTeamPrice]);

  const fmtCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

  // Saneo de inputs: nombres solo letras/espacios/acentos; documento dígitos
  // (alfanumérico solo para pasaporte). Evita "151541" en el nombre o "thdfhfg"
  // en el número de documento.
  const sanitizeName = (s: string) => s.replace(/[^\p{L}\p{M}\s.'’-]/gu, '');
  const sanitizeDoc = (s: string, type: string) =>
    type === 'PAS' ? s.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : s.replace(/\D/g, '');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (!data || !data.found) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-3" />
        <h1 className="text-xl font-bold">{data?.reason === 'expired' ? 'Este código expiró' : 'Código no encontrado'}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          Pide a la escuela un código de inscripción vigente.
        </p>
      </div>
    );
  }

  // Avanzar tras "choose": si user logueado → directo a child; si no → auth
  function continueAfterChoose() {
    if (user) setStep('child');
    else      setStep('auth');
  }

  async function handleLogin() {
    if (!email || !password) {
      return toast({ title: 'Completa email y contraseña', variant: 'destructive' });
    }
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);
    if (error) {
      return toast({ title: 'No pudimos iniciar sesión', description: error.message, variant: 'destructive' });
    }
    toast({ title: 'Bienvenido de vuelta' });
    if (intent === 'pagar') { navigate('/my-payments'); return; }
    setStep('child');
  }

  async function handleRegister() {
    if (!email || !password || !parentName) {
      return toast({ title: 'Completa todos los datos', variant: 'destructive' });
    }
    setAuthLoading(true);
    try {
      const { data: signUp, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: parentName, role: 'parent', phone: parentPhone || null } },
      });
      if (error) throw error;
      // Si la confirmación de email es opcional, ya hay session. Si no, intentamos signIn.
      if (!signUp.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) {
          toast({
            title: 'Cuenta creada',
            description: 'Confirma tu email y vuelve a abrir el enlace para completar la inscripción.',
          });
          return;
        }
      }
      toast({ title: 'Cuenta creada' });
      if (intent === 'pagar') { navigate('/my-payments'); return; }
      setStep('child');
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No se pudo registrar', variant: 'destructive' });
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSubmitChild() {
    if (!user) return toast({ title: 'Debes iniciar sesión', variant: 'destructive' });
    const useExisting = selectedChildId !== 'new';
    if (!useExisting && (!childName || !childDob)) {
      return toast({ title: 'Completa nombre y fecha de nacimiento', variant: 'destructive' });
    }

    setSubmitting(true);
    const { data: res, error } = await supabase.rpc('submit_qr_signup' as any, {
      p_slug:           slug,
      p_team_id:        chosenTeamId || null,
      p_branch_id:      null,
      p_child_full_name: useExisting ? null : childName,
      p_child_dob:      useExisting ? null : childDob,
      p_child_doc_type: useExisting ? null : childDocType,
      p_child_doc_number: useExisting ? null : (childDocNumber || null),
      p_child_gender:   useExisting ? null : (childGender || null),
      p_phone:          parentPhone || null,
      p_monthly_fee:    Number(monthlyFee) || 0,
      p_existing_child_id: useExisting ? selectedChildId : null,
      p_plan_id:        chosenPlanId || null,
    });
    setSubmitting(false);
    if (error) {
      return toast({ title: 'No se pudo completar', description: error.message, variant: 'destructive' });
    }
    const r = res as any;
    toast({ title: '¡Inscripción registrada!' });

    if (r?.requires_payment && r?.payment_id) {
      navigate(`/parent-checkout?payment_id=${r.payment_id}&school_id=${r.school_id}&child_id=${r.child_id}&qr_id=${r.qr_id}`);
    } else {
      setStep('done');
    }
  }

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(160deg, ${accent}11 0%, ${secondary}11 100%)` }}>
      <div
        className="relative text-white px-6 py-8 bg-cover bg-center"
        style={
          data.school?.cover_image_url
            // Portada de la escuela con overlay del gradiente de marca para legibilidad del texto blanco.
            ? { backgroundImage: `linear-gradient(120deg, ${accent}cc, ${secondary}cc), url(${data.school.cover_image_url})` }
            : { background: `linear-gradient(120deg, ${accent}, ${secondary})` }
        }
      >
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          {data.school?.logo_url ? (
            <img src={data.school.logo_url} alt="" className="h-16 w-16 rounded-xl bg-white/95 object-contain p-1" />
          ) : (
            <div className="h-16 w-16 rounded-xl bg-white/95 flex items-center justify-center text-2xl font-bold" style={{ color: accent }}>
              {data.school?.name?.[0] || '?'}
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wider opacity-80">Inscripciones</p>
            <h1 className="text-2xl font-bold">{data.school?.name}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardContent className="pt-6 space-y-6">
            {data.intro_text && (step === 'menu' || step === 'choose') && (
              <p className="text-base text-muted-foreground">{data.intro_text}</p>
            )}

            {/* PASO 0 — Menú universal: ¿qué quieres hacer? */}
            {step === 'menu' && (
              <div className="space-y-3">
                <p className="text-base font-semibold">¿Qué quieres hacer?</p>

                <button
                  type="button"
                  onClick={() => { setIntent('inscribir'); setStep('choose'); }}
                  className="w-full text-left border rounded-xl p-4 transition-all hover:border-primary/50 flex items-center gap-3"
                >
                  <UserPlus className="h-5 w-5 shrink-0" style={{ color: accent }} />
                  <div>
                    <p className="font-bold text-sm">Inscribir un atleta</p>
                    <p className="text-xs text-muted-foreground">Registrar a alguien nuevo y pagar el primer mes</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setIntent('pagar'); if (user) navigate('/my-payments'); else setStep('auth'); }}
                  className="w-full text-left border rounded-xl p-4 transition-all hover:border-primary/50 flex items-center gap-3"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: accent }} />
                  <div>
                    <p className="font-bold text-sm">Pagar mensualidad</p>
                    <p className="text-xs text-muted-foreground">Ya soy parte de la escuela</p>
                  </div>
                </button>
              </div>
            )}

            {/* PASO 1 — Elegir equipo (si aplica) */}
            {step === 'choose' && (
              <>
                {(data.target_type === 'team' || data.target_type === 'plan') && data.target ? (
                  <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">{data.target_type === 'plan' ? 'Plan asignado' : 'Equipo asignado'}</p>
                      <p className="font-bold text-slate-900">{data.target.name}</p>
                      {data.target_type === 'plan'
                        ? <p className="text-xs text-slate-600">{data.target.sessions_included == null ? 'Ilimitado' : `${data.target.sessions_included} sesiones`}</p>
                        : data.target.sport && <p className="text-xs text-slate-600">{data.target.sport}</p>}
                      {selectedTeamPrice > 0 && (
                        <p className="text-xs font-semibold mt-1" style={{ color: accent }}>{fmtCOP(selectedTeamPrice)}{data.fixed_amount ? ' (promo)' : ''}</p>
                      )}
                    </div>
                    <ShieldCheck className="h-6 w-6 text-green-600" />
                  </div>
                ) : (
                  <>
                    {data.options && data.options.length > 0 && (
                      <div>
                        <Label>Selecciona el equipo</Label>
                        <Select value={chosenTeamId} onValueChange={(v) => { setChosenTeamId(v); setChosenPlanId(''); }}>
                          <SelectTrigger><SelectValue placeholder="Elige un equipo" /></SelectTrigger>
                          <SelectContent>
                            {data.options.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}{t.sport ? ` · ${t.sport}` : ''}{t.price_monthly ? ` · ${fmtCOP(Number(t.price_monthly))}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {data.plans && data.plans.length > 0 && (
                      <div>
                        <Label>Selecciona el plan</Label>
                        <Select value={chosenPlanId} onValueChange={(v) => { setChosenPlanId(v); setChosenTeamId(''); }}>
                          <SelectTrigger><SelectValue placeholder="Elige un plan" /></SelectTrigger>
                          <SelectContent>
                            {data.plans.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}{p.price_monthly ? ` · ${fmtCOP(Number(p.price_monthly))}` : ''}{p.sessions_included == null ? ' · ilimitado' : ` · ${p.sessions_included} ses.`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {data.fixed_amount != null && data.fixed_amount > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                        Precio promocional: <strong style={{ color: accent }}>{fmtCOP(Number(data.fixed_amount))}</strong>
                      </div>
                    )}
                  </>
                )}

                {user && profile && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm flex items-center gap-2 text-green-900">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <span>Sesión activa: <strong>{profile.full_name || user.email}</strong></span>
                  </div>
                )}

                <Button
                  onClick={continueAfterChoose}
                  disabled={
                    data.target_type !== 'team' && data.target_type !== 'plan' &&
                    !chosenTeamId && !chosenPlanId &&
                    ((data.options?.length ?? 0) > 0 || (data.plans?.length ?? 0) > 0)
                  }
                  className="w-full gap-2"
                  style={{ backgroundColor: accent }}
                >
                  {user ? 'Continuar' : (data.cta_text || 'Inscribirme')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={() => setStep('menu')} className="w-full">Volver</Button>
              </>
            )}

            {/* PASO 2 — Auth (login o register) */}
            {step === 'auth' && !user && (
              <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as any)}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="register"><UserPlus className="h-4 w-4 mr-1" />Soy nuevo</TabsTrigger>
                  <TabsTrigger value="login"><LogIn className="h-4 w-4 mr-1" />Tengo cuenta</TabsTrigger>
                </TabsList>

                <TabsContent value="register" className="space-y-3 pt-3">
                  <div>
                    <Label>Nombre completo *</Label>
                    <Input value={parentName} onChange={(e) => setParentName(sanitizeName(e.target.value))} autoCapitalize="words" />
                  </div>
                  <div>
                    <Label>Teléfono</Label>
                    <Input value={parentPhone} inputMode="tel" onChange={(e) => setParentPhone(e.target.value.replace(/[^\d+\s-]/g, ''))} />
                  </div>
                  <div>
                    <Label>Email *</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label>Contraseña *</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button onClick={handleRegister} disabled={authLoading} className="w-full gap-2" style={{ backgroundColor: accent }}>
                    {authLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Crear cuenta y continuar
                  </Button>
                  <button type="button" onClick={() => setAuthTab('login')} className="text-xs text-muted-foreground hover:underline w-full text-center">
                    ¿Ya tienes cuenta? Inicia sesión
                  </button>
                </TabsContent>

                <TabsContent value="login" className="space-y-3 pt-3">
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label>Contraseña</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button onClick={handleLogin} disabled={authLoading} className="w-full gap-2" style={{ backgroundColor: accent }}>
                    {authLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Iniciar sesión y continuar
                  </Button>
                  <button type="button" onClick={() => setAuthTab('register')} className="text-xs text-muted-foreground hover:underline w-full text-center">
                    ¿Eres nuevo? Crea tu cuenta
                  </button>
                </TabsContent>

                <Button variant="ghost" onClick={() => setStep('choose')} className="w-full mt-2">
                  Volver
                </Button>
              </Tabs>
            )}

            {/* PASO 3 — Datos del atleta (siempre, ya logueado) */}
            {step === 'child' && (
              <div className="space-y-4">
                <h2 className="font-bold text-lg">¿A quién inscribes?</h2>

                {existingChildren.length > 0 && (
                  <div className="space-y-2">
                    {existingChildren.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedChildId(c.id)}
                        className={`w-full text-left border rounded-lg p-3 transition-all ${selectedChildId === c.id ? 'border-2' : 'border-muted hover:border-muted-foreground/40'}`}
                        style={selectedChildId === c.id ? { borderColor: accent, boxShadow: `0 0 0 2px ${accent}33` } : undefined}
                      >
                        <span className="font-semibold text-sm">{c.full_name}</span>
                        {c.date_of_birth && (
                          <span className="block text-xs text-muted-foreground">
                            {new Date(c.date_of_birth + 'T12:00:00').toLocaleDateString('es-CO')}
                          </span>
                        )}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedChildId('new')}
                      className={`w-full text-left border rounded-lg p-3 transition-all ${selectedChildId === 'new' ? 'border-2' : 'border-dashed border-muted hover:border-muted-foreground/40'}`}
                      style={selectedChildId === 'new' ? { borderColor: accent, boxShadow: `0 0 0 2px ${accent}33` } : undefined}
                    >
                      <span className="font-semibold text-sm">+ Agregar nuevo atleta</span>
                    </button>
                  </div>
                )}

                {selectedChildId === 'new' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <Label>Nombre completo *</Label>
                    <Input value={childName} onChange={(e) => setChildName(sanitizeName(e.target.value))} autoCapitalize="words" />
                  </div>
                  <div>
                    <Label>Fecha de nacimiento *</Label>
                    <Input type="date" value={childDob} onChange={(e) => setChildDob(e.target.value)} />
                  </div>
                  <div>
                    <Label>Género</Label>
                    <Select value={childGender} onValueChange={setChildGender}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Femenino</SelectItem>
                        <SelectItem value="X">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo de doc</Label>
                    <Select value={childDocType} onValueChange={setChildDocType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TI">TI</SelectItem>
                        <SelectItem value="CC">CC</SelectItem>
                        <SelectItem value="RC">RC</SelectItem>
                        <SelectItem value="CE">CE</SelectItem>
                        <SelectItem value="PAS">PAS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Número de documento</Label>
                    <Input
                      value={childDocNumber}
                      inputMode={childDocType === 'PAS' ? 'text' : 'numeric'}
                      onChange={(e) => setChildDocNumber(sanitizeDoc(e.target.value, childDocType))}
                    />
                  </div>
                </div>
                )}

                {data.require_first_payment && (
                  <div className="pt-4 border-t">
                    <Label>Cuota a pagar</Label>
                    <div className="mt-1 text-2xl font-bold" style={{ color: accent }}>
                      {selectedTeamPrice > 0 ? fmtCOP(selectedTeamPrice) : 'La definirá la escuela'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Definida por el equipo. Luego serás redirigido al checkout para el primer pago.
                    </p>
                  </div>
                )}

                <Button onClick={handleSubmitChild} disabled={submitting} className="w-full gap-2" style={{ backgroundColor: accent }}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {data.require_first_payment ? 'Inscribirme y continuar al pago' : 'Completar inscripción'}
                </Button>
                <Button variant="ghost" onClick={() => setStep(user ? 'choose' : 'auth')} className="w-full">
                  Volver
                </Button>
              </div>
            )}

            {/* PASO 4 — Listo (sin pago requerido) */}
            {step === 'done' && (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto" />
                <h2 className="text-xl font-bold">¡Inscripción completada!</h2>
                <p className="text-sm text-muted-foreground">Tu inscripción ya está registrada en {data.school?.name}.</p>
                <Button onClick={() => navigate('/dashboard')} style={{ backgroundColor: accent }}>
                  Ir a mi panel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {data.school?.name && (
          <p className="text-center mt-4 text-xs text-muted-foreground flex items-center justify-center gap-1">
            <MapPin className="h-3 w-3" />
            {data.school.name}
          </p>
        )}
      </div>
    </div>
  );
}
