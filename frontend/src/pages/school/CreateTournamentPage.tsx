import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { useEntitlements } from '@/hooks/useEntitlements';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Trophy, Lock } from 'lucide-react';

type Scope = 'internal' | 'external';
type Visibility = 'public' | 'invited_only' | 'school_only';
type PayerMode = 'school' | 'parent' | 'flexible';

interface FormState {
  title: string;
  sport: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
  address: string;
  city: string;
  capacity: string;
  tournament_scope: Scope;
  visibility: Visibility;
  payer_mode: PayerMode;
  registration_deadline: string;
}

const INITIAL: FormState = {
  title: '',
  sport: '',
  description: '',
  event_date: '',
  start_time: '08:00',
  end_time: '',
  address: '',
  city: '',
  capacity: '',
  tournament_scope: 'external',
  visibility: 'public',
  payer_mode: 'school',
  registration_deadline: '',
};

const selectCls =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export default function CreateTournamentPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasAddon, isLoading: entLoading } = useEntitlements();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Al cambiar el alcance, sugerir visibilidad coherente.
  const onScopeChange = (scope: Scope) => {
    setForm((f) => ({
      ...f,
      tournament_scope: scope,
      visibility: scope === 'internal' ? 'school_only' : 'public',
    }));
  };

  const hasTournaments = hasAddon('tournaments');

  // ── Gate del addon ────────────────────────────────────────────────────────
  if (!entLoading && !hasTournaments) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Módulo de Torneos no activo</CardTitle>
            <CardDescription>
              Activa el módulo de Torneos para crear y gestionar tus propios torneos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Volver</Button>
            <Button onClick={() => navigate('/mi-plan')}>Ir a Mi Plan</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const validate = (): string | null => {
    if (!form.title.trim()) return 'El título es requerido.';
    if (!form.sport.trim()) return 'El deporte es requerido.';
    if (!form.event_date) return 'La fecha es requerida.';
    if (!form.start_time) return 'La hora de inicio es requerida.';
    if (!form.address.trim()) return 'La dirección es requerida.';
    if (!form.city.trim()) return 'La ciudad es requerida.';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast({ title: 'Faltan datos', description: err, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        sport: form.sport.trim(),
        description: form.description.trim() || null,
        event_date: form.event_date,
        start_time: form.start_time,
        end_time: form.end_time || null,
        address: form.address.trim(),
        city: form.city.trim(),
        capacity: form.capacity ? Number(form.capacity) : undefined,
        tournament_scope: form.tournament_scope,
        visibility: form.visibility,
        payer_mode: form.payer_mode,
        registration_deadline: form.registration_deadline || null,
      };
      const created = await bffClient.post<{ id: string }>(
        '/api/v1/events/school-tournament',
        payload,
      );
      toast({ title: '¡Torneo creado!', description: 'Se creó como borrador.' });
      navigate(`/school/tournaments`);
      return created;
    } catch (e: any) {
      toast({ title: 'Error al crear el torneo', description: e?.message ?? 'Intenta de nuevo.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Trophy className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Crear Torneo</h1>
          <p className="text-sm text-muted-foreground">
            Tu escuela como organizadora. Podrás agregar categorías y precios después.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Tipo de torneo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tipo de torneo</CardTitle>
            <CardDescription>Define contra quién y quién ve el torneo.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Alcance</Label>
              <select
                className={selectCls}
                value={form.tournament_scope}
                onChange={(e) => onScopeChange(e.target.value as Scope)}
              >
                <option value="internal">Interno (mis propios equipos)</option>
                <option value="external">Externo (contra otras academias)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Visibilidad</Label>
              <select
                className={selectCls}
                value={form.visibility}
                disabled={form.tournament_scope === 'internal'}
                onChange={(e) => set('visibility', e.target.value as Visibility)}
              >
                {form.tournament_scope === 'internal' ? (
                  <option value="school_only">Solo mi escuela</option>
                ) : (
                  <>
                    <option value="public">Público (descubrible)</option>
                    <option value="invited_only">Privado (solo invitadas)</option>
                  </>
                )}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>¿Quién paga?</Label>
              <select
                className={selectCls}
                value={form.payer_mode}
                onChange={(e) => set('payer_mode', e.target.value as PayerMode)}
              >
                <option value="school">La escuela recauda</option>
                <option value="parent">Cada familia paga directo</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Datos básicos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="title">Título *</Label>
              <Input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Copa Interacademias 2026" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sport">Deporte *</Label>
              <Input id="sport" value={form.sport} onChange={(e) => set('sport', e.target.value)} placeholder="Cheerleading" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="capacity">Cupo (opcional)</Label>
              <Input id="capacity" type="number" min={1} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} placeholder="50" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Fecha y lugar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fecha y lugar</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="event_date">Fecha *</Label>
              <Input id="event_date" type="date" value={form.event_date} onChange={(e) => set('event_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="registration_deadline">Cierre de inscripciones</Label>
              <Input id="registration_deadline" type="date" value={form.registration_deadline} onChange={(e) => set('registration_deadline', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start_time">Hora inicio *</Label>
              <Input id="start_time" type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_time">Hora fin</Label>
              <Input id="end_time" type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Dirección *</Label>
              <Input id="address" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Coliseo, Cra 1 #1-1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">Ciudad *</Label>
              <Input id="city" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Bogotá" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate(-1)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creando…' : 'Crear torneo'}
          </Button>
        </div>
      </div>
    </div>
  );
}
