import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CheckCircle2, Clock, Copy, FileSignature, Loader2, Printer, Send, ShieldCheck, ShieldOff, Smartphone, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  createInvite, inviteUrl, listConsents, listCurrentConsentTexts, recordPresencialConsent, revokeConsent,
  uploadClinicalFile,
} from '@/lib/clinical/api';
import { ageFrom, clinicalErrorMessage, CONSENT_LABEL } from '@/lib/clinical/labels';
import { activeConsents } from '@/lib/clinical/record-extra';
import type { ClinicalConsent, ClinicalPatient, ConsentText, ConsentType } from '@/lib/clinical/types';

const ALL_TYPES: ConsentType[] = ['datos_sensibles', 'tratamiento', 'compartir_disponibilidad'];
const RELATIONSHIPS: { value: ClinicalConsent['relationship']; label: string }[] = [
  { value: 'titular', label: 'El paciente (titular)' },
  { value: 'madre', label: 'Madre' },
  { value: 'padre', label: 'Padre' },
  { value: 'acudiente', label: 'Acudiente' },
  { value: 'representante_legal', label: 'Representante legal' },
];
const RELATIONSHIP_LABEL = Object.fromEntries(RELATIONSHIPS.map((r) => [r.value, r.label])) as Record<string, string>;
const MAX_FILE = 15 * 1024 * 1024;
const NO_TEXTS: ConsentText[] = [];

const fmt = (iso: string, p = "d 'de' MMM yyyy, h:mm a") => format(parseISO(iso), p, { locale: es });

function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Abre una ventana con el formato de consentimiento listo para imprimir y firmar. */
function printConsentForm(patient: ClinicalPatient, texts: ConsentText[]) {
  const w = window.open('', '_blank');
  if (!w) { toast.error('Tu navegador bloqueó la ventana. Permite ventanas emergentes e intenta de nuevo.'); return; }
  const age = ageFrom(patient.birth_date);
  const doc = [patient.document_type, patient.document_number].filter(Boolean).join(' ');
  const blocks = texts.map((t) => `
    <section>
      <h2>${esc(t.title)} <small>(versión ${esc(t.version)}${t.required ? '' : ', opcional'})</small></h2>
      ${esc(t.body).split(/\n\s*\n/).map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('')}
      <p class="check">☐ Acepto &nbsp;&nbsp; ☐ No acepto</p>
    </section>`).join('');
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"/>
    <title>Consentimientos — ${esc(patient.full_name)}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;max-width:760px;margin:24px auto;padding:0 16px;font-size:13px;line-height:1.5}
      h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:18px 0 6px} small{font-weight:normal;color:#555}
      .meta{border:1px solid #ccc;padding:8px 12px;margin:12px 0} .meta div{margin:2px 0}
      .check{margin-top:4px} .sign{display:flex;gap:32px;margin-top:48px}
      .sign div{flex:1;border-top:1px solid #111;padding-top:4px;font-size:12px}
      @media print{body{margin:0}}
    </style></head><body>
    <h1>Autorizaciones y consentimiento informado</h1>
    <div class="meta">
      <div><b>Paciente:</b> ${esc(patient.full_name)}</div>
      <div><b>Documento:</b> ${esc(doc) || '________________'}</div>
      ${age !== null ? `<div><b>Edad:</b> ${age} años</div>` : ''}
      ${patient.guardian_name ? `<div><b>Acudiente:</b> ${esc(patient.guardian_name)} ${patient.guardian_relationship ? '(' + esc(patient.guardian_relationship) + ')' : ''}</div>` : ''}
      <div><b>Fecha:</b> ____ / ____ / ________</div>
    </div>
    ${blocks}
    <div class="sign">
      <div>Firma del paciente (titular)<br/>Nombre:<br/>Documento:</div>
      <div>Firma del acudiente o representante legal<br/>Nombre:<br/>Documento y parentesco:</div>
    </div>
    <script>window.onload=function(){window.print()}</script>
    </body></html>`);
  w.document.close();
}

interface Props {
  patient: ClinicalPatient;
  onChange?: () => void;
  /** 'actions' muestra solo los botones (para el aviso de consentimiento pendiente). */
  variant?: 'full' | 'actions';
}

export function ConsentPanel({ patient, onChange, variant = 'full' }: Props) {
  const qc = useQueryClient();
  const [presencialOpen, setPresencialOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revoking, setRevoking] = useState<ClinicalConsent | null>(null);

  const consentsQ = useQuery({
    queryKey: ['clinical', 'consents', patient.id],
    queryFn: () => listConsents(patient.id),
  });
  const textsQ = useQuery({ queryKey: ['clinical', 'consent-texts'], queryFn: listCurrentConsentTexts, staleTime: 60 * 60_000 });

  const changed = () => {
    qc.invalidateQueries({ queryKey: ['clinical', 'consents', patient.id] });
    qc.invalidateQueries({ queryKey: ['clinical', 'consent-summary'] });
    onChange?.();
  };

  const active = useMemo(() => activeConsents(consentsQ.data ?? []), [consentsQ.data]);
  const byType = useMemo(() => new Map(active.map((c) => [c.consent_type, c])), [active]);
  const history = useMemo(() => (consentsQ.data ?? []).filter((c) => c.revoked_at), [consentsQ.data]);
  const hasAccount = !!(patient.profile_id || patient.child_id);

  const actions = (
    <div className="flex flex-col sm:flex-row gap-2">
      <Button onClick={() => setPresencialOpen(true)} className="gap-2">
        <FileSignature className="h-4 w-4" /> Registrar firma presencial
      </Button>
      {!hasAccount && (
        <Button variant="outline" onClick={() => setInviteOpen(true)} className="gap-2">
          <Smartphone className="h-4 w-4" /> Invitar a la app
        </Button>
      )}
    </div>
  );

  const dialogs = (
    <>
      <PresencialDialog open={presencialOpen} onOpenChange={setPresencialOpen} patient={patient}
        texts={textsQ.data ?? NO_TEXTS} textsLoading={textsQ.isLoading} already={byType} onDone={changed} />
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} patient={patient} />
      <RevokeDialog consent={revoking} onClose={() => setRevoking(null)} onDone={changed} />
    </>
  );

  if (variant === 'actions') {
    return (
      <div className="space-y-2">
        {actions}
        {hasAccount && (
          <p className="text-xs text-muted-foreground">
            El paciente ya tiene cuenta vinculada: también puede aceptar los consentimientos desde su app, en «Mi salud».
          </p>
        )}
        {dialogs}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {consentsQ.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando consentimientos…
        </div>
      ) : consentsQ.isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm flex items-center justify-between gap-2">
          <span>{clinicalErrorMessage(consentsQ.error)}</span>
          <Button size="sm" variant="outline" onClick={() => consentsQ.refetch()}>Reintentar</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {ALL_TYPES.map((t) => {
            const c = byType.get(t);
            const required = t !== 'compartir_disponibilidad';
            return (
              <div key={t} className="rounded-lg border p-3 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{CONSENT_LABEL[t]}</span>
                    {required ? <Badge variant="outline" className="text-[10px]">Obligatorio</Badge>
                      : <Badge variant="outline" className="text-[10px]">Opcional</Badge>}
                  </div>
                  {c ? (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Vigente desde {fmt(c.granted_at)}
                      </p>
                      <p>
                        Firmó: {c.granted_by_name} · {RELATIONSHIP_LABEL[c.relationship] ?? c.relationship} ·{' '}
                        {c.channel === 'app' ? 'desde la app' : 'firma presencial'} · versión {c.version}
                        {c.evidence_path ? ' · con soporte escaneado' : ''}
                      </p>
                    </div>
                  ) : (
                    <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 font-medium">
                      <Clock className="h-3.5 w-3.5" /> Pendiente
                    </p>
                  )}
                </div>
                {c && (
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive gap-1 self-start"
                    onClick={() => setRevoking(c)}>
                    <ShieldOff className="h-4 w-4" /> Revocar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {actions}
      {hasAccount && (
        <p className="text-xs text-muted-foreground">
          El paciente tiene cuenta vinculada: también puede aceptar o revocar los consentimientos desde su app, en «Mi salud».
        </p>
      )}

      {history.length > 0 && (
        <details className="rounded-lg border p-3 text-xs">
          <summary className="cursor-pointer font-medium text-sm">Consentimientos revocados ({history.length})</summary>
          <ul className="mt-2 space-y-1.5 text-muted-foreground">
            {history.map((c) => (
              <li key={c.id}>
                {CONSENT_LABEL[c.consent_type]} (v{c.version}) — firmado {fmt(c.granted_at, 'd MMM yyyy')} por {c.granted_by_name};
                revocado {c.revoked_at ? fmt(c.revoked_at, 'd MMM yyyy') : ''}{c.revoked_reason ? `: ${c.revoked_reason}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
      {dialogs}
    </div>
  );
}

// ── Firma presencial ─────────────────────────────────────────────────────────
function PresencialDialog({ open, onOpenChange, patient, texts, textsLoading, already, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; patient: ClinicalPatient; texts: ConsentText[];
  textsLoading: boolean; already: Map<ConsentType, ClinicalConsent>; onDone: () => void;
}) {
  const age = ageFrom(patient.birth_date);
  const isMinor = age !== null && age < 18;
  const [types, setTypes] = useState<Set<ConsentType>>(new Set());
  const [signer, setSigner] = useState('');
  const [relationship, setRelationship] = useState<ClinicalConsent['relationship']>('titular');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    const pre = new Set<ConsentType>();
    texts.forEach((t) => { if (t.required && !already.has(t.consent_type)) pre.add(t.consent_type); });
    setTypes(pre);
    setSigner(isMinor ? patient.guardian_name ?? '' : patient.full_name);
    setRelationship(isMinor ? 'acudiente' : 'titular');
    setFile(null);
  }, [open, texts, already, isMinor, patient.guardian_name, patient.full_name]);

  const save = useMutation({
    mutationFn: async () => {
      const evidencePath = file ? await uploadClinicalFile(patient.id, file) : null;
      return recordPresencialConsent({
        patientId: patient.id, types: [...types], signedByName: signer.trim(), relationship, evidencePath,
      });
    },
    onSuccess: () => {
      toast.success('Consentimiento registrado');
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  const submit = () => {
    if (types.size === 0) { toast.error('Marca al menos un documento firmado.'); return; }
    if (signer.trim().length < 3) { toast.error('Escribe el nombre de quien firmó.'); return; }
    if (isMinor && relationship === 'titular') {
      toast.error('El paciente es menor de edad: debe firmar su acudiente o representante legal.');
      return;
    }
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!save.isPending) onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar firma presencial</DialogTitle>
          <DialogDescription>
            Imprime el formato, haz que {isMinor ? 'el acudiente' : 'el paciente'} lo lea y lo firme, y registra aquí lo que firmó.
          </DialogDescription>
        </DialogHeader>

        <Button variant="outline" className="gap-2 w-full sm:w-auto" disabled={texts.length === 0}
          onClick={() => printConsentForm(patient, texts)}>
          <Printer className="h-4 w-4" /> Imprimir formato
        </Button>

        {textsLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : texts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay textos de consentimiento vigentes. Contacta a soporte.</p>
        ) : (
          <div className="space-y-3">
            {texts.map((t) => {
              const signed = already.has(t.consent_type);
              return (
                <div key={t.consent_type} className="rounded-lg border p-3 space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox
                      checked={signed || types.has(t.consent_type)}
                      disabled={signed}
                      onCheckedChange={(v) => setTypes((s) => {
                        const n = new Set(s);
                        if (v) n.add(t.consent_type); else n.delete(t.consent_type);
                        return n;
                      })}
                      className="mt-0.5"
                    />
                    <span className="text-sm font-medium">
                      {t.title}{' '}
                      <span className="text-xs font-normal text-muted-foreground">
                        (v{t.version}{t.required ? ', obligatorio' : ', opcional'}){signed ? ' · ya vigente' : ''}
                      </span>
                    </span>
                  </label>
                  <details>
                    <summary className="text-xs text-primary cursor-pointer">Leer texto</summary>
                    <p className="mt-2 text-xs text-muted-foreground whitespace-pre-line">{t.body}</p>
                  </details>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre de quien firmó *</Label>
            <Input value={signer} onChange={(e) => setSigner(e.target.value)} maxLength={160} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Relación con el paciente</Label>
            <Select value={relationship} onValueChange={(v) => setRelationship(v as ClinicalConsent['relationship'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Documento firmado escaneado (opcional, imagen o PDF, máx. 15 MB)</Label>
            <Input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > MAX_FILE) { toast.error('El archivo pesa más de 15 MB.'); e.target.value = ''; return; }
                setFile(f);
              }} />
            {file && <p className="text-xs text-muted-foreground flex items-center gap-1"><Upload className="h-3 w-3" /> {file.name}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancelar</Button>
          <Button onClick={submit} disabled={save.isPending || texts.length === 0} className="gap-2">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Registrar consentimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Invitación a la app ──────────────────────────────────────────────────────
function InviteDialog({ open, onOpenChange, patient }: {
  open: boolean; onOpenChange: (o: boolean) => void; patient: ClinicalPatient;
}) {
  const [invite, setInvite] = useState<{ token: string; expires_at: string } | null>(null);
  useEffect(() => { if (!open) setInvite(null); }, [open]);

  const create = useMutation({
    mutationFn: () => createInvite(patient.id),
    onSuccess: (r) => setInvite(r),
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  const link = invite ? inviteUrl(invite.token) : '';
  const firstName = patient.full_name.split(' ')[0];
  const message = `Hola${patient.guardian_name ? ' ' + patient.guardian_name.split(' ')[0] : ''}. Te comparto el enlace para ` +
    `vincular a ${firstName} con mi consulta en SportMaps y aceptar las autorizaciones de datos de salud y tratamiento: ${link}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast.success('Enlace copiado'); }
    catch { toast.error('No se pudo copiar. Selecciona el enlace y cópialo a mano.'); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invitar a la app</DialogTitle>
          <DialogDescription>
            El paciente (o su acudiente, si es menor) abre el enlace, entra o crea su cuenta y acepta ahí los consentimientos.
            Así queda vinculado y puede ver su plan, sus ejercicios y sus citas.
          </DialogDescription>
        </DialogHeader>
        {!invite ? (
          <Button onClick={() => create.mutate()} disabled={create.isPending} className="gap-2">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Generar enlace de invitación
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={link} onFocus={(e) => e.target.select()} className="text-xs" />
              <Button variant="outline" size="icon" onClick={copy} aria-label="Copiar enlace"><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Vence el {fmt(invite.expires_at)}. Sirve una sola vez.
            </p>
            <Button asChild className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
                Enviar por WhatsApp
              </a>
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Revocar ──────────────────────────────────────────────────────────────────
function RevokeDialog({ consent, onClose, onDone }: {
  consent: ClinicalConsent | null; onClose: () => void; onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (consent) setReason(''); }, [consent]);

  const revoke = useMutation({
    mutationFn: () => revokeConsent(consent!.id, reason.trim()),
    onSuccess: () => { toast.success('Consentimiento revocado'); onClose(); onDone(); },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  const required = consent && consent.consent_type !== 'compartir_disponibilidad';

  return (
    <Dialog open={!!consent} onOpenChange={(o) => { if (!o && !revoke.isPending) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Revocar consentimiento</DialogTitle>
          <DialogDescription>
            {consent ? CONSENT_LABEL[consent.consent_type] : ''}. Queda constancia de la revocación; lo ya registrado en la historia se conserva.
          </DialogDescription>
        </DialogHeader>
        {required && (
          <p className="rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs p-2">
            Sin este consentimiento no podrás escribir nuevas notas, diagnósticos ni abrir episodios hasta que se vuelva a firmar.
          </p>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Motivo *</Label>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Ej.: el paciente pidió revocarlo en consulta" />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={revoke.isPending}>Cancelar</Button>
          <Button variant="destructive" disabled={revoke.isPending || reason.trim().length < 5}
            onClick={() => revoke.mutate()}>
            {revoke.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Revocar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConsentPanel;
