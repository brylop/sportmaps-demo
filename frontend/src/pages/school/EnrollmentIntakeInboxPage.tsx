/**
 * EnrollmentIntakeInboxPage — inbox de revisión de hojas de matrícula
 * (fase 4 de docs/specs/alta-atleta-por-foto-hoja-matricula.md).
 *
 * NO reimplementa el alta de atleta: crea el atleta llamando a
 * POST /api/v1/students/create-one (mismo endpoint que el alta manual, con su
 * detección de duplicados y su guardia de mayor-de-edad ya construidas), y
 * solo después confirma acá con /mark-approved. Si create-one devuelve 409
 * (duplicado o mayor de edad mal tipado), se muestra el motivo y no se
 * reintenta solo.
 */
import { useEffect, useState, useCallback } from 'react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { bffClient, BFFError } from '@/lib/api/bffClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Link2, XCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { todayColombia } from '@/lib/dateUtils';

interface EnrollmentFormResult {
    athleteFullName: string | null;
    docType: string | null;
    docNumber: string | null;
    dateOfBirth: string | null;
    dateOfBirthRaw: string | null;
    ageOnForm: number | null;
    category: string | null;
    guardianFullName: string | null;
    guardianDocNumber: string | null;
    guardianPhone: string | null;
    guardianEmail: string | null;
    athleteEmail: string | null;
    athletePhone: string | null;
    epsName: string | null;
    bloodType: string | null;
    isEnrollmentForm: boolean;
    missingFields: string[];
    provider: string;
}

interface IntakeItem {
    id: string;
    status: string;
    extracted: EnrollmentFormResult | null;
    photoUrl: string | null;
    duplicateOfChildId: string | null;
    duplicateOfChildName: string | null;
    duplicateOfIntakeId: string | null;
    rejectionReason: string | null;
    createdAt: string;
}

type FormState = Partial<Record<
    'athleteFullName' | 'docType' | 'docNumber' | 'dateOfBirth' | 'guardianFullName' |
    'guardianPhone' | 'guardianEmail' | 'athleteEmail' | 'athletePhone' | 'epsName' | 'bloodType',
    string
>>;

function esMayorDeEdad(item: IntakeItem): boolean {
    const e = item.extracted;
    if (!e) return false;
    if (e.ageOnForm != null) return e.ageOnForm >= 18;
    if (e.dateOfBirth) {
        const nacimiento = new Date(e.dateOfBirth);
        const hoy = new Date();
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        if (hoy.getMonth() < nacimiento.getMonth() ||
            (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())) edad--;
        return edad >= 18;
    }
    return false;
}

function IntakeCard({ item, onDone }: { item: IntakeItem; onDone: () => void }) {
    const { toast } = useToast();
    const [form, setForm] = useState<FormState>({
        athleteFullName: item.extracted?.athleteFullName ?? '',
        docType: item.extracted?.docType ?? 'CC',
        docNumber: item.extracted?.docNumber ?? '',
        dateOfBirth: item.extracted?.dateOfBirth ?? '',
        guardianFullName: item.extracted?.guardianFullName ?? '',
        guardianPhone: item.extracted?.guardianPhone ?? '',
        guardianEmail: item.extracted?.guardianEmail ?? '',
        athleteEmail: item.extracted?.athleteEmail ?? '',
        athletePhone: item.extracted?.athletePhone ?? '',
        epsName: item.extracted?.epsName ?? '',
        bloodType: item.extracted?.bloodType ?? '',
    });
    const [working, setWorking] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const mayorDeEdad = esMayorDeEdad(item);
    const missing = new Set(item.extracted?.missingFields ?? []);

    const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [k]: e.target.value }));

    const camposObligatoriosFaltan = !form.athleteFullName?.trim()
        || !form.docNumber?.trim()
        || (!mayorDeEdad && !form.guardianEmail?.trim())
        || (!mayorDeEdad && !form.guardianPhone?.trim());

    async function crearAtleta() {
        setWorking(true);
        setErrorMsg(null);
        try {
            const startDate = todayColombia();
            let created: { child_id?: string; unregistered_athlete_id?: string };

            if (mayorDeEdad) {
                created = await bffClient.post('/api/v1/students/create-one', {
                    type: 'unregistered_adult',
                    doc_type: form.docType || undefined,
                    doc_number: form.docNumber || null,
                    full_name: form.athleteFullName,
                    email: form.athleteEmail || null,
                    phone: form.athletePhone || null,
                    date_of_birth: form.dateOfBirth || null,
                    start_date: startDate,
                    send_invite: Boolean(form.athleteEmail),
                });
                await bffClient.post(`/api/v1/enrollment-intake/${item.id}/mark-approved`, {
                    unregisteredAthleteId: created.unregistered_athlete_id,
                    epsName: form.epsName || undefined,
                    bloodType: form.bloodType || undefined,
                });
            } else {
                created = await bffClient.post('/api/v1/students/create-one', {
                    type: 'child',
                    doc_type: form.docType || 'TI',
                    doc_number: form.docNumber || null,
                    full_name: form.athleteFullName,
                    date_of_birth: form.dateOfBirth || null,
                    parent_name: form.guardianFullName || form.athleteFullName,
                    parent_email: form.guardianEmail || null,
                    parent_phone: (form.guardianPhone || '').replace(/\D/g, ''),
                    start_date: startDate,
                    send_invite: true,
                });
                await bffClient.post(`/api/v1/enrollment-intake/${item.id}/mark-approved`, {
                    childId: created.child_id,
                    epsName: form.epsName || undefined,
                    bloodType: form.bloodType || undefined,
                });
            }

            toast({ title: 'Atleta creado', description: `${form.athleteFullName} quedó registrado.` });
            onDone();
        } catch (err) {
            if (err instanceof BFFError) {
                setErrorMsg(err.message);
            } else {
                setErrorMsg('No se pudo crear el atleta.');
            }
        } finally {
            setWorking(false);
        }
    }

    async function vincular() {
        if (!item.duplicateOfChildId) return;
        setWorking(true);
        setErrorMsg(null);
        try {
            await bffClient.post(`/api/v1/enrollment-intake/${item.id}/link`, {
                childId: item.duplicateOfChildId,
            });
            toast({ title: 'Vinculado', description: `Se completaron los datos de ${item.duplicateOfChildName ?? 'el atleta existente'}.` });
            onDone();
        } catch (err) {
            setErrorMsg(err instanceof BFFError ? err.message : 'No se pudo vincular.');
        } finally {
            setWorking(false);
        }
    }

    async function descartar() {
        const reason = window.prompt('¿Por qué se descarta esta foto? (opcional)') ?? undefined;
        setWorking(true);
        setErrorMsg(null);
        try {
            await bffClient.post(`/api/v1/enrollment-intake/${item.id}/reject`, { reason });
            toast({ title: 'Descartada' });
            onDone();
        } catch (err) {
            setErrorMsg(err instanceof BFFError ? err.message : 'No se pudo descartar.');
        } finally {
            setWorking(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base">{item.extracted?.athleteFullName || 'Sin nombre legible'}</CardTitle>
                    <div className="flex gap-2">
                        {mayorDeEdad && <Badge variant="secondary">Mayor de edad</Badge>}
                        {item.duplicateOfChildId && <Badge variant="destructive">Ya existe: {item.duplicateOfChildName}</Badge>}
                        {item.duplicateOfIntakeId && <Badge variant="outline">Duplicada con otra foto pendiente</Badge>}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {item.photoUrl && (
                    <a href={item.photoUrl} target="_blank" rel="noreferrer">
                        <img src={item.photoUrl} alt="Hoja de matrícula" className="rounded border max-h-96 object-contain w-full" />
                    </a>
                )}
                <div className="space-y-3">
                    <div>
                        <Label>Nombre del deportista</Label>
                        <Input value={form.athleteFullName ?? ''} onChange={set('athleteFullName')}
                            className={missing.has('athlete_full_name') ? 'border-amber-400' : ''} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label>Tipo doc.</Label>
                            <Input value={form.docType ?? ''} onChange={set('docType')} />
                        </div>
                        <div>
                            <Label>Documento *</Label>
                            <Input value={form.docNumber ?? ''} onChange={set('docNumber')}
                                className={missing.has('doc_number') ? 'border-amber-400' : ''} />
                        </div>
                    </div>
                    <div>
                        <Label>Fecha de nacimiento {item.extracted?.dateOfBirthRaw ? `(hoja dice: "${item.extracted.dateOfBirthRaw}")` : ''}</Label>
                        <Input type="date" value={form.dateOfBirth ?? ''} onChange={set('dateOfBirth')}
                            className={missing.has('date_of_birth') ? 'border-amber-400' : ''} />
                    </div>
                    {item.extracted?.category && (
                        <p className="text-sm text-muted-foreground">Categoría en la hoja: <strong>{item.extracted.category}</strong> — se asigna a equipo aparte, esto no lo hace.</p>
                    )}

                    {mayorDeEdad ? (
                        <>
                            <p className="text-sm font-medium mt-2">Contacto de emergencia (no se invita, es mayor de edad)</p>
                            <div>
                                <Label>Nombre</Label>
                                <Input value={form.guardianFullName ?? ''} onChange={set('guardianFullName')} disabled />
                            </div>
                            <div>
                                <Label>Correo del deportista (opcional, para invitarlo)</Label>
                                <Input value={form.athleteEmail ?? ''} onChange={set('athleteEmail')}
                                    className={missing.has('athlete_email') ? 'border-amber-400' : ''} />
                            </div>
                            <div>
                                <Label>Teléfono del deportista</Label>
                                <Input value={form.athletePhone ?? ''} onChange={set('athletePhone')}
                                    className={missing.has('athlete_phone') ? 'border-amber-400' : ''} />
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-sm font-medium mt-2">Acudiente</p>
                            <div>
                                <Label>Nombre</Label>
                                <Input value={form.guardianFullName ?? ''} onChange={set('guardianFullName')}
                                    className={missing.has('guardian_full_name') ? 'border-amber-400' : ''} />
                            </div>
                            <div>
                                <Label>Correo *</Label>
                                <Input value={form.guardianEmail ?? ''} onChange={set('guardianEmail')}
                                    className={missing.has('guardian_email') ? 'border-amber-400' : ''} />
                            </div>
                            <div>
                                <Label>Teléfono *</Label>
                                <Input value={form.guardianPhone ?? ''} onChange={set('guardianPhone')}
                                    className={missing.has('guardian_phone') ? 'border-amber-400' : ''} />
                            </div>
                        </>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label>EPS</Label>
                            <Input value={form.epsName ?? ''} onChange={set('epsName')} />
                        </div>
                        <div>
                            <Label>Grupo sanguíneo / RH</Label>
                            <Input value={form.bloodType ?? ''} onChange={set('bloodType')} />
                        </div>
                    </div>

                    {errorMsg && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>{errorMsg}</AlertDescription>
                        </Alert>
                    )}

                    <div className="flex gap-2 flex-wrap pt-2">
                        <Button onClick={crearAtleta} disabled={working || camposObligatoriosFaltan || Boolean(item.duplicateOfChildId)}>
                            {working ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            Crear atleta
                        </Button>
                        {item.duplicateOfChildId && (
                            <Button variant="secondary" onClick={vincular} disabled={working}>
                                <Link2 className="h-4 w-4 mr-2" /> Vincular a {item.duplicateOfChildName}
                            </Button>
                        )}
                        <Button variant="outline" onClick={descartar} disabled={working}>
                            <XCircle className="h-4 w-4 mr-2" /> Descartar
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function EnrollmentIntakeInboxPage() {
    const { schoolId } = useSchoolContext();
    const [items, setItems] = useState<IntakeItem[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!schoolId) return;
        setLoading(true);
        try {
            const res = await bffClient.get<{ items: IntakeItem[] }>('/api/v1/enrollment-intake');
            setItems(res.items);
        } finally {
            setLoading(false);
        }
    }, [schoolId]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
            <div>
                <h1 className="text-xl font-semibold">Matrículas por revisar</h1>
                <p className="text-sm text-muted-foreground">
                    Fotos de hojas de matrícula recibidas por WhatsApp. El OCR llenó el formulario;
                    revisá y confirmá antes de crear el atleta — nunca se crea solo.
                </p>
            </div>

            {loading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}

            {!loading && items.length === 0 && (
                <Alert>
                    <AlertDescription>No hay fichas pendientes de revisión.</AlertDescription>
                </Alert>
            )}

            {items.map((item) => (
                <IntakeCard key={item.id} item={item} onDone={load} />
            ))}
        </div>
    );
}
