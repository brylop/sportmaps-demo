import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Trophy, Plus, Trash2, Users } from 'lucide-react';

interface Category { id: string; division: string; category: string; rama: string; age_min: number | null; age_max: number | null; }
interface Phase { id: string; phase_name: string; valid_until: string; price_solo: number; price_pkg1: number; price_pkg2: number; price_pkg3: number; }
interface EnrollInfo {
  id: string; title: string; sport: string; city: string; event_date: string;
  status: string; tournament_scope: string | null; registrations_open: boolean;
  categories: Category[]; phases: Phase[];
}
interface Member { full_name: string; document_number: string; birth_year: string; shirt_size: string; }
interface TeamForm { category_id: string; team_name: string; package_type: 'solo' | 'pkg1' | 'pkg2' | 'pkg3'; accommodation: string; members: Member[]; }

const selectCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const money = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
const emptyMember = (): Member => ({ full_name: '', document_number: '', birth_year: '', shirt_size: '' });
const emptyTeam = (): TeamForm => ({ category_id: '', team_name: '', package_type: 'solo', accommodation: 'cuadruple', members: [emptyMember()] });
const priceFor = (ph: Phase | undefined, pkg: string) => !ph ? 0 : pkg === 'pkg1' ? ph.price_pkg1 : pkg === 'pkg2' ? ph.price_pkg2 : pkg === 'pkg3' ? ph.price_pkg3 : ph.price_solo;

export default function EventEnrollmentPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [info, setInfo] = useState<EnrollInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [contact, setContact] = useState({ contact_name: '', contact_email: '', contact_phone: '', whatsapp: '' });
  const [phaseId, setPhaseId] = useState<string>('');
  const [teams, setTeams] = useState<TeamForm[]>([emptyTeam()]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const d = await bffClient.get<EnrollInfo>(`/api/v1/events/${eventId}/enroll-info`);
        setInfo(d);
        if (d.phases?.length) setPhaseId(d.phases[0].id);
      } catch (err: any) {
        toast({ title: 'Error', description: err?.message ?? 'No se pudo cargar el torneo.', variant: 'destructive' });
      } finally { setLoading(false); }
    })();
  }, [eventId, toast]);

  const phase = useMemo(() => info?.phases.find((p) => p.id === phaseId), [info, phaseId]);
  const total = useMemo(() => teams.reduce((s, t) => s + priceFor(phase, t.package_type), 0), [teams, phase]);

  const updTeam = (i: number, patch: Partial<TeamForm>) => setTeams((prev) => prev.map((t, j) => j === i ? { ...t, ...patch } : t));
  const updMember = (ti: number, mi: number, patch: Partial<Member>) =>
    setTeams((prev) => prev.map((t, j) => j === ti ? { ...t, members: t.members.map((m, k) => k === mi ? { ...m, ...patch } : m) } : t));

  const submit = async () => {
    if (teams.some((t) => !t.team_name.trim())) { toast({ title: 'Falta el nombre de un equipo', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      await bffClient.post(`/api/v1/events/${eventId}/enroll`, {
        price_phase_id: phaseId || null,
        ...contact,
        teams: teams.map((t) => ({
          category_id: t.category_id || null,
          team_name: t.team_name.trim(),
          package_type: t.package_type,
          accommodation: t.accommodation,
          members: t.members.filter((m) => m.full_name.trim()).map((m) => ({
            full_name: m.full_name.trim(),
            document_number: m.document_number || null,
            birth_year: m.birth_year ? Number(m.birth_year) : null,
            shirt_size: m.shirt_size || null,
          })),
        })),
      });
      toast({ title: '¡Delegación inscrita!', description: 'Queda pendiente de pago y aprobación.' });
      navigate('/school/delegations');
    } catch (err: any) {
      toast({ title: 'Error al inscribir', description: err?.message ?? 'Intenta de nuevo.', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-6 space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-40 w-full" /></div>;
  if (!info) return (
    <div className="mx-auto max-w-2xl px-4 py-10"><Card><CardContent className="py-12 text-center">
      <p className="mb-4 font-medium">Torneo no disponible</p>
      <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="mr-1 h-4 w-4" /> Volver</Button>
    </CardContent></Card></div>
  );

  const notOpen = info.status !== 'active' || info.registrations_open === false;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Trophy className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">Inscribir delegación</h1>
          <p className="text-sm text-muted-foreground">{info.title} · {info.sport} · {info.city}</p>
        </div>
      </div>

      {notOpen && (
        <Card className="mb-6 border-destructive/40"><CardContent className="py-4 text-sm text-destructive">Las inscripciones de este torneo no están abiertas.</CardContent></Card>
      )}

      <div className="space-y-6">
        {/* Contacto */}
        <Card>
          <CardHeader><CardTitle className="text-base">Contacto de la delegación</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={contact.contact_name} onChange={(e) => setContact({ ...contact, contact_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={contact.contact_email} onChange={(e) => setContact({ ...contact, contact_email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Teléfono</Label><Input value={contact.contact_phone} onChange={(e) => setContact({ ...contact, contact_phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={contact.whatsapp} onChange={(e) => setContact({ ...contact, whatsapp: e.target.value })} /></div>
            {info.phases.length > 1 && (
              <div className="space-y-1.5 sm:col-span-2"><Label>Fase de precio</Label>
                <select className={selectCls} value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
                  {info.phases.map((p) => <option key={p.id} value={p.id}>{p.phase_name} — {money(p.price_solo)}</option>)}
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Equipos */}
        {teams.map((t, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Equipo {i + 1}</CardTitle>
              {teams.length > 1 && <Button size="icon" variant="ghost" onClick={() => setTeams(teams.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Nombre del equipo *</Label><Input value={t.team_name} onChange={(e) => updTeam(i, { team_name: e.target.value })} placeholder="Tigres Sub-15" /></div>
                <div className="space-y-1.5"><Label>Categoría</Label>
                  <select className={selectCls} value={t.category_id} onChange={(e) => updTeam(i, { category_id: e.target.value })}>
                    <option value="">— Selecciona —</option>
                    {info.categories.map((c) => <option key={c.id} value={c.id}>{c.division} · {c.category} ({c.rama})</option>)}
                  </select>
                </div>
                <div className="space-y-1.5"><Label>Paquete</Label>
                  <select className={selectCls} value={t.package_type} onChange={(e) => updTeam(i, { package_type: e.target.value as any })}>
                    <option value="solo">Solo competencia — {money(priceFor(phase, 'solo'))}</option>
                    {(phase?.price_pkg3 ?? 0) > 0 && <option value="pkg3">Paquete 2 noches — {money(priceFor(phase, 'pkg3'))}</option>}
                    {(phase?.price_pkg2 ?? 0) > 0 && <option value="pkg2">Paquete 3 noches — {money(priceFor(phase, 'pkg2'))}</option>}
                    {(phase?.price_pkg1 ?? 0) > 0 && <option value="pkg1">Paquete 4 noches — {money(priceFor(phase, 'pkg1'))}</option>}
                  </select>
                </div>
                <div className="space-y-1.5"><Label>Acomodación</Label>
                  <select className={selectCls} value={t.accommodation} onChange={(e) => updTeam(i, { accommodation: e.target.value })}>
                    <option value="cuadruple">Cuádruple</option><option value="triple">Triple</option><option value="doble">Doble</option><option value="sencilla">Sencilla</option>
                  </select>
                </div>
              </div>

              {/* Atletas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1"><Users className="h-4 w-4" /> Atletas</Label>
                  <Button size="sm" variant="outline" onClick={() => updTeam(i, { members: [...t.members, emptyMember()] })}><Plus className="mr-1 h-4 w-4" /> Agregar atleta</Button>
                </div>
                {t.members.map((m, mi) => (
                  <div key={mi} className="grid gap-2 rounded-md border p-2 sm:grid-cols-5">
                    <Input className="sm:col-span-2" placeholder="Nombre completo" value={m.full_name} onChange={(e) => updMember(i, mi, { full_name: e.target.value })} />
                    <Input placeholder="Documento" value={m.document_number} onChange={(e) => updMember(i, mi, { document_number: e.target.value })} />
                    <Input type="number" placeholder="Año nac." value={m.birth_year} onChange={(e) => updMember(i, mi, { birth_year: e.target.value })} />
                    <div className="flex gap-1">
                      <Input placeholder="Talla" value={m.shirt_size} onChange={(e) => updMember(i, mi, { shirt_size: e.target.value })} />
                      {t.members.length > 1 && <Button size="icon" variant="ghost" onClick={() => updTeam(i, { members: t.members.filter((_, k) => k !== mi) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        <Button variant="outline" className="w-full" onClick={() => setTeams([...teams, emptyTeam()])}><Plus className="mr-1 h-4 w-4" /> Agregar otro equipo</Button>

        {/* Resumen */}
        <Card className="border-primary/30">
          <CardContent className="flex items-center justify-between py-5">
            <div>
              <p className="text-sm text-muted-foreground">Total estimado ({teams.length} equipo{teams.length !== 1 ? 's' : ''})</p>
              <p className="text-2xl font-bold">{money(total)}</p>
              <p className="text-xs text-muted-foreground">El pago se gestiona luego de enviar la inscripción.</p>
            </div>
            <Button size="lg" onClick={submit} disabled={submitting || notOpen}>{submitting ? 'Enviando…' : 'Enviar inscripción'}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
