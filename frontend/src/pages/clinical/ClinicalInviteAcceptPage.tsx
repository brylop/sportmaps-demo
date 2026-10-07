import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, HeartPulse, Loader2, Stethoscope } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { acceptInvite, getInvite } from '@/lib/clinical/api';
import { listMyChildren } from '@/lib/clinical/family-extra';
import { CONSENT_LABEL, SPECIALTY_LABEL, clinicalErrorMessage } from '@/lib/clinical/labels';
import type { ConsentType, Specialty } from '@/lib/clinical/types';

const INVITE_ERRORS: Record<string, { title: string; body: string }> = {
  INVITACION_NO_ENCONTRADA: { title: 'No encontramos la invitación', body: 'Revisa que el enlace esté completo o pídele al profesional que te lo envíe de nuevo.' },
  INVITACION_USADA: { title: 'Esta invitación ya se usó', body: 'Si ya la aceptaste, encontrarás todo en "Mi salud". Si no fuiste tú, pídele al profesional una nueva.' },
  INVITACION_VENCIDA: { title: 'La invitación venció', body: 'Por seguridad las invitaciones duran pocos días. Pídele al profesional que te envíe una nueva.' },
};

export default function ClinicalInviteAcceptPage() {
  const { token = '' } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const inviteQ = useQuery({
    queryKey: ['clinical', 'invite', token],
    queryFn: () => getInvite(token),
    enabled: !!token,
    retry: false,
  });

  const childrenQ = useQuery({
    queryKey: ['clinical', 'my-children', user?.id],
    queryFn: () => listMyChildren(user!.id),
    enabled: !!user?.id,
  });

  const [forWhom, setForWhom] = useState<string>('self');
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const invite = inviteQ.data;
  const consents = useMemo(() => {
    const list = invite?.consents ?? [];
    return [...list].sort((a, b) => Number(b.required) - Number(a.required));
  }, [invite]);

  // Si el paciente tiene el mismo nombre de pila que uno de mis hijos, se preselecciona.
  useEffect(() => {
    const first = invite?.patient_first_name?.trim().toLowerCase();
    if (!first || !childrenQ.data?.length) return;
    const match = childrenQ.data.find((c) => c.full_name.trim().toLowerCase().split(/\s+/)[0] === first);
    if (match) setForWhom(match.id);
  }, [invite?.patient_first_name, childrenQ.data]);

  const missingRequired = consents.filter((c) => c.required && !checked[c.type]);

  const acceptM = useMutation({
    mutationFn: () => {
      const types = consents.filter((c) => checked[c.type]).map((c) => c.type as ConsentType);
      return acceptInvite(token, forWhom === 'self' ? null : forWhom, types);
    },
    onSuccess: () => {
      toast.success('Listo. Quedaste vinculado con tu profesional de la salud.');
      qc.invalidateQueries({ queryKey: ['clinical'] });
      navigate('/salud');
    },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  if (inviteQ.isLoading) {
    return (
      <div className="container max-w-xl mx-auto px-4 py-6 space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (inviteQ.error || !invite || !invite.ok) {
    const err = invite?.error ? INVITE_ERRORS[invite.error] : null;
    return (
      <div className="container max-w-xl mx-auto px-4 py-10">
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
            <p className="font-semibold text-lg">{err?.title ?? 'No pudimos abrir la invitación'}</p>
            <p className="text-sm text-muted-foreground">{err?.body ?? clinicalErrorMessage(inviteQ.error)}</p>
            <Button variant="outline" onClick={() => navigate('/salud')}>Ir a Mi salud</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const specialty = invite.specialty ? (SPECIALTY_LABEL[invite.specialty as Specialty] ?? invite.specialty) : null;
  const children = childrenQ.data ?? [];

  return (
    <div className="container max-w-xl mx-auto px-4 py-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg leading-tight">{invite.professional_name}</CardTitle>
              <CardDescription>
                {[invite.practice_name, specialty].filter(Boolean).join(' · ') || 'Profesional de la salud'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>
            Te invitó a ver en SportMaps el plan de {invite.patient_first_name ? <strong>{invite.patient_first_name}</strong> : 'tratamiento'}:
            ejercicios, citas y la evolución de la recuperación.
          </p>
          {invite.expires_at && (
            <p className="text-xs text-muted-foreground">La invitación vence el {new Date(invite.expires_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">¿Para quién es?</CardTitle>
          <CardDescription>Elige la persona que está en tratamiento.</CardDescription>
        </CardHeader>
        <CardContent>
          {childrenQ.isLoading ? <Skeleton className="h-10 w-full" /> : (
            <RadioGroup value={forWhom} onValueChange={setForWhom} className="space-y-2">
              <Label htmlFor="fw-self" className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer has-[:checked]:border-primary">
                <RadioGroupItem value="self" id="fw-self" />
                <span>Para mí</span>
              </Label>
              {children.map((c) => (
                <Label key={c.id} htmlFor={`fw-${c.id}`} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer has-[:checked]:border-primary">
                  <RadioGroupItem value={c.id} id={`fw-${c.id}`} />
                  <span>{c.full_name} <span className="text-muted-foreground font-normal">(mi hijo/a)</span></span>
                </Label>
              ))}
            </RadioGroup>
          )}
          {childrenQ.error && (
            <p className="text-xs text-destructive mt-2">No pudimos cargar tus hijos: {clinicalErrorMessage(childrenQ.error)}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><HeartPulse className="w-4 h-4 text-primary" />Autorizaciones</CardTitle>
          <CardDescription>Lee cada texto. Las dos primeras son necesarias para que el profesional pueda atenderte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {consents.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay textos de autorización disponibles en este momento.</p>
          )}
          {consents.map((c) => (
            <div key={c.type} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm">{c.title || CONSENT_LABEL[c.type]}</p>
                <span className={c.required ? 'text-[11px] text-rose-600 dark:text-rose-400 font-medium' : 'text-[11px] text-muted-foreground'}>
                  {c.required ? 'Obligatoria' : 'Opcional'}
                </span>
              </div>
              <ScrollArea className="h-32 rounded-md bg-muted/50 p-2">
                <p className="text-xs whitespace-pre-line leading-relaxed">{c.body}</p>
              </ScrollArea>
              {c.type === 'compartir_disponibilidad' && (
                <p className="text-xs text-muted-foreground">
                  Si la aceptas, el entrenador y la escuela verán solo si puede entrenar, las restricciones y la fecha estimada de regreso.
                  Nunca el diagnóstico ni las notas. Puedes retirarla cuando quieras.
                </p>
              )}
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={!!checked[c.type]}
                  onCheckedChange={(v) => setChecked((s) => ({ ...s, [c.type]: v === true }))}
                  className="mt-0.5"
                />
                <span>Leí y autorizo</span>
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      {missingRequired.length > 0 && (
        <Alert>
          <AlertDescription className="text-sm">
            Para continuar debes autorizar: {missingRequired.map((c) => c.title || CONSENT_LABEL[c.type]).join(' y ')}.
          </AlertDescription>
        </Alert>
      )}

      <Button
        className="w-full h-12 text-base"
        disabled={missingRequired.length > 0 || consents.length === 0 || acceptM.isPending}
        onClick={() => acceptM.mutate()}
      >
        {acceptM.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Aceptar y vincular
      </Button>
    </div>
  );
}
