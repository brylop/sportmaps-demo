import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type LandingData = {
  found: boolean;
  school?: {
    id: string; name: string; slug: string;
    logo_url: string | null;
    branding_settings: { primary_color?: string; secondary_color?: string } | null;
  };
};

type TrialSlot = {
  id: string;
  label: string;
  slot_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  spots_left: number;
};

const HOW_HEARD_OPTIONS = [
  { value: 'redes_sociales', label: 'Redes sociales' },
  { value: 'recomendado', label: 'Recomendado por alguien' },
  { value: 'busqueda_web', label: 'Búsqueda en internet' },
  { value: 'evento', label: 'Evento o feria' },
  { value: 'otro', label: 'Otro' },
];

export default function SchoolLeadFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();

  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [howHeard, setHowHeard] = useState('');
  const [notes, setNotes] = useState('');
  // Honeypot: campo oculto que un humano nunca llena. Un bot que autocompleta
  // todo el formulario sí lo hace, y el backend descarta el envío en silencio.
  const [website, setWebsite] = useState('');

  const [slots, setSlots] = useState<TrialSlot[]>([]);
  const [trialSlotId, setTrialSlotId] = useState<string>('');

  function loadSlots() {
    if (!slug) return;
    supabase.rpc('list_open_trial_slots_public' as any, { p_slug: slug }).then(({ data: r }) => {
      setSlots(Array.isArray(r) ? (r as TrialSlot[]) : []);
    });
  }

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    supabase.rpc('get_school_lead_landing_public' as any, { p_slug: slug }).then(({ data: r, error }) => {
      setLoading(false);
      setData(error || !r ? { found: false } : (r as LandingData));
    });
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function fmtSlotDateTime(s: TrialSlot) {
    const date = new Date(`${s.slot_date}T00:00:00`).toLocaleDateString('es-CO', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
    return `${date} · ${s.start_time.slice(0, 5)} · ${s.label}`;
  }

  function fmtSlotOption(s: TrialSlot) {
    return `${fmtSlotDateTime(s)} · ${s.spots_left} cupo${s.spots_left === 1 ? '' : 's'}`;
  }

  const branding = data?.school?.branding_settings || {};
  const accent = branding.primary_color || '#248223';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!data?.found) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-3" />
        <h1 className="text-xl font-bold">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          Verifica el link con la escuela.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) {
      toast({ title: 'Completa nombre y teléfono', variant: 'destructive' });
      return;
    }

    // "Edad" es lo que pide el formulario original; se traduce a una fecha de
    // nacimiento aproximada (1 de enero) solo para que el backend sugiera
    // categoría. No es la fecha real — eso lo confirma la escuela al inscribir.
    const ageNum = parseInt(age, 10);
    const birthDate = Number.isFinite(ageNum) && ageNum > 0
      ? `${new Date().getFullYear() - ageNum}-01-01`
      : null;

    setSubmitting(true);
    const { data: r, error } = await supabase.rpc('submit_school_lead' as any, {
      p_slug: slug,
      p_full_name: fullName.trim(),
      p_phone: phone.trim(),
      p_email: email.trim() || null,
      p_gender: gender || null,
      p_birth_date: birthDate,
      p_how_heard: howHeard || null,
      p_notes: notes.trim() || null,
      p_website: website,
      p_trial_slot_id: trialSlotId || null,
    });
    setSubmitting(false);

    if (error || !(r as any)?.ok) {
      // Cupo lleno / cerrado: alguien más se lo llevó mientras llenaba el form.
      // Refrescamos la lista para que elija otro en vez de reintentar a ciegas.
      if (trialSlotId) { setTrialSlotId(''); loadSlots(); }
      toast({ title: 'No pudimos enviar tu registro', description: error?.message, variant: 'destructive' });
      return;
    }
    setDone(true);
  }

  if (done) {
    const reservedSlot = slots.find((s) => s.id === trialSlotId);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-6 text-center">
        <CheckCircle2 className="h-14 w-14 mb-3" style={{ color: accent }} />
        <h1 className="text-xl font-bold">¡Gracias, {fullName.split(' ')[0]}!</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          {reservedSlot
            ? `Tu clase de prueba en ${data.school?.name} quedó reservada: ${fmtSlotDateTime(reservedSlot)}.`
            : `${data.school?.name} recibió tus datos y te va a contactar pronto.`}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          {data.school?.logo_url && (
            <img src={data.school.logo_url} alt={data.school.name} className="h-16 w-16 rounded-full object-cover mb-3" />
          )}
          <h1 className="text-2xl font-bold text-center">{data.school?.name}</h1>
          <p className="text-sm text-muted-foreground text-center">Déjanos tus datos y te contactamos</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="full_name">Nombre completo *</Label>
                <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="phone">Teléfono *</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="gender">Género</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger id="gender"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Femenino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="age">Edad</Label>
                  <Input id="age" type="number" min={1} max={99} value={age} onChange={(e) => setAge(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Correo</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="how_heard">¿Cómo nos conociste?</Label>
                <Select value={howHeard} onValueChange={setHowHeard}>
                  <SelectTrigger id="how_heard"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {HOW_HEARD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Comentario</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>

              {slots.length > 0 && (
                <div className="rounded-lg border p-3 space-y-2">
                  <Label>¿Quieres una clase de prueba gratis? (opcional)</Label>
                  <RadioGroup value={trialSlotId} onValueChange={setTrialSlotId}>
                    {slots.map((s) => (
                      <div key={s.id} className="flex items-center gap-2">
                        <RadioGroupItem value={s.id} id={`slot_${s.id}`} />
                        <label htmlFor={`slot_${s.id}`} className="text-sm cursor-pointer">{fmtSlotOption(s)}</label>
                      </div>
                    ))}
                  </RadioGroup>
                  {trialSlotId && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline"
                      onClick={() => setTrialSlotId('')}
                    >
                      Quitar selección
                    </button>
                  )}
                </div>
              )}

              {/* Honeypot: oculto por CSS, no por `type="hidden"` (algunos bots lo respetan). */}
              <div className="absolute -left-[9999px]" aria-hidden="true">
                <label htmlFor="website">No llenar</label>
                <input
                  id="website" name="website" type="text" tabIndex={-1} autoComplete="off"
                  value={website} onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" style={{ backgroundColor: accent }} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enviar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
