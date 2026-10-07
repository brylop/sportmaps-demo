import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExternalLink, FileImage, FileText, Info, Loader2, Paperclip, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { listAttachments, logClinicalAccess, signedAttachmentUrl, uploadAttachment } from '@/lib/clinical/api';
import { clinicalErrorMessage } from '@/lib/clinical/labels';
import type { ClinicalAttachment, ClinicalEpisode, ClinicalPatient } from '@/lib/clinical/types';

const MAX_SIZE = 15 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,application/pdf';
const ALLOWED = ACCEPT.split(',');

function sizeLabel(b: number | null) {
  if (!b) return '';
  return b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentsTab({ patient, episodes }: { patient: ClinicalPatient; episodes: ClinicalEpisode[] }) {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const q = useQuery({ queryKey: ['clinical', 'attachments', patient.id], queryFn: () => listAttachments(patient.id) });
  const episodeName = (id: string | null) => episodes.find((e) => e.id === id)?.reason;

  const openFile = async (a: ClinicalAttachment) => {
    // La ventana se abre antes del await para que el navegador no la bloquee.
    const w = window.open('', '_blank');
    setOpening(a.id);
    try {
      const url = await signedAttachmentUrl(a.storage_path);
      void logClinicalAccess(patient.id, 'ver_adjunto').catch(() => undefined);
      if (w) { w.opener = null; w.location.href = url; } else window.location.assign(url);
    } catch (e) {
      w?.close();
      toast.error(clinicalErrorMessage(e));
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <p className="text-xs text-muted-foreground flex items-start gap-1.5 max-w-lg">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Los anexos (exámenes, imágenes, remisiones) forman parte de la historia clínica: no se pueden borrar.
        </p>
        <Button onClick={() => setUploadOpen(true)} className="gap-2"><Upload className="h-4 w-4" /> Subir anexo</Button>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-10 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Cargando anexos…</div>
      ) : q.isError ? (
        <Card><CardContent className="py-6 text-center text-sm space-y-2">
          <p>{clinicalErrorMessage(q.error)}</p>
          <Button size="sm" variant="outline" onClick={() => q.refetch()}>Reintentar</Button>
        </CardContent></Card>
      ) : (q.data ?? []).length === 0 ? (
        <Card><CardContent className="py-10 text-center space-y-1">
          <Paperclip className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">Sin anexos</p>
          <p className="text-sm text-muted-foreground">Sube resonancias, radiografías, exámenes o remisiones (imagen o PDF).</p>
        </CardContent></Card>
      ) : (
        <ul className="space-y-2">
          {q.data!.map((a) => {
            const Icon = a.mime_type === 'application/pdf' ? FileText : FileImage;
            return (
              <li key={a.id}>
                <button type="button" onClick={() => openFile(a)} disabled={opening === a.id}
                  className="w-full text-left rounded-lg border bg-card hover:bg-accent/50 p-3 flex items-center gap-3">
                  <Icon className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.file_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[format(parseISO(a.created_at), "d MMM yyyy, h:mm a", { locale: es }), sizeLabel(a.size_bytes),
                        episodeName(a.episode_id)].filter(Boolean).join(' · ')}
                    </p>
                    {a.description && <p className="text-xs mt-0.5">{a.description}</p>}
                  </div>
                  {opening === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4 text-muted-foreground" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} patient={patient} episodes={episodes}
        onDone={() => qc.invalidateQueries({ queryKey: ['clinical', 'attachments', patient.id] })} />
    </div>
  );
}

function UploadDialog({ open, onOpenChange, patient, episodes, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; patient: ClinicalPatient; episodes: ClinicalEpisode[]; onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [episodeId, setEpisodeId] = useState<string>('__none__');
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setFile(null); setDescription(''); setEpisodeId('__none__'); if (inputRef.current) inputRef.current.value = ''; };

  const upload = useMutation({
    mutationFn: () => uploadAttachment({
      patientId: patient.id, file: file!, description: description.trim() || undefined,
      episodeId: episodeId === '__none__' ? null : episodeId,
    }),
    onSuccess: () => { toast.success('Anexo subido'); reset(); onOpenChange(false); onDone(); },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  const pick = (f: File | null) => {
    if (!f) { setFile(null); return; }
    if (!ALLOWED.includes(f.type)) { toast.error('Solo imágenes (JPG, PNG, WEBP, HEIC) o PDF.'); if (inputRef.current) inputRef.current.value = ''; return; }
    if (f.size > MAX_SIZE) { toast.error('El archivo pesa más de 15 MB.'); if (inputRef.current) inputRef.current.value = ''; return; }
    setFile(f);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!upload.isPending) { if (!o) reset(); onOpenChange(o); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Subir anexo</DialogTitle>
          <DialogDescription>Imagen o PDF de máximo 15 MB. Queda en almacenamiento privado; solo tú lo ves.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Archivo *</Label>
            <Input ref={inputRef} type="file" accept={ACCEPT} onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            {file && <p className="text-xs text-muted-foreground">{file.name} · {sizeLabel(file.size)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200}
              placeholder="Ej.: Resonancia de rodilla derecha" />
          </div>
          {episodes.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Episodio</Label>
              <Select value={episodeId} onValueChange={setEpisodeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">General (sin episodio)</SelectItem>
                  {episodes.map((e) => <SelectItem key={e.id} value={e.id}>{e.reason}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={upload.isPending}>Cancelar</Button>
          <Button onClick={() => upload.mutate()} disabled={!file || upload.isPending}>
            {upload.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Subir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AttachmentsTab;
