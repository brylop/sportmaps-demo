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
  target_type?: 'open' | 'team' | 'program' | 'branch';
  target?: any;
  options?: Array<{ id: string; name: string; sport: string; branch_id: string | null }>;
  school?: {
    id: string; name: string; slug: string | null;
    logo_url: string | null; branding_settings: any;
  };
  payment_info?: any;
};

type Step = 'choose' | 'auth' | 'child' | 'done';

export default function JoinSchoolPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<Step>('choose');
  const [chosenTeamId, setChosenTeamId] = useState<string>('');

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
  }

  const branding = useMemo(() => data?.school?.branding_settings || {}, [data]);
  const accent: string = branding.primary_color || '#248223';
  const secondary: string = branding.secondary_color || '#FB9F1E';

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
      <div className="text-white px-6 py-8" style={{ background: `linear-gradient(120deg, ${accent}, ${secondary})` }}>
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
            {data.intro_text && step === 'choose' && (
              <p className="text-base text-muted-foreground">{data.intro_text}</p>
            )}

            {/* PASO 1 — Elegir equipo (si aplica) */}
            {step === 'choose' && (
              <>
                {data.target_type === 'team' && data.target ? (
                  <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Equipo asignado</p>
                      <p className="font-bold">{data.target.name}</p>
                      {data.target.sport && <p className="text-xs">{data.target.sport}</p>}
                    </div>
                    <ShieldCheck className="h-6 w-6 text-green-600" />
                  </div>
                ) : data.options && data.options.length > 0 ? (
                  <div>
                    <Label>Selecciona el equipo</Label>
                    <Select value={chosenTeamId} onValueChange={setChosenTeamId}>
                      <SelectTrigger><SelectValue placeholder="Elige un equipo" /></SelectTrigger>
                      <SelectContent>
                        {data.options.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} {t.sport ? `· ${t.sport}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {user && profile && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Sesión activa: <strong>{profile.full_name || user.email}</strong></span>
                  </div>
                )}

                <Button
                  onClick={continueAfterChoose}
                  disabled={data.target_type !== 'team' && !chosenTeamId && (data.options?.length ?? 0) > 0}
                  className="w-full gap-2"
                  style={{ backgroundColor: accent }}
                >
                  {user ? 'Continuar' : (data.cta_text || 'Inscribirme')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
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
                    <Input value={parentName} onChange={(e) => setParentName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Teléfono</Label>
                    <Input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
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
                    <Input value={childName} onChange={(e) => setChildName(e.target.value)} />
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
                    <Input value={childDocNumber} onChange={(e) => setChildDocNumber(e.target.value)} />
                  </div>
                </div>
                )}

                {data.require_first_payment && (
                  <div className="pt-4 border-t">
                    <Label>Cuota mensual del plan</Label>
                    <Input
                      type="number"
                      value={monthlyFee}
                      onChange={(e) => setMonthlyFee(e.target.value)}
                      placeholder="120000"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Después serás redirigido al checkout para realizar el primer pago.
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
