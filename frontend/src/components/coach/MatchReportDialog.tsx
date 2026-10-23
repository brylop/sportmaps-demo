import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import {
  type MatchReport,
  useMatchReportReplies,
  usePublishMatchReport,
  useSaveMatchAdminComment,
  useSaveMatchReport,
} from '@/hooks/useMatchReports';

const ADMIN_ROLES = ['owner', 'admin', 'school_admin', 'super_admin'];
const MAX = 4000;

interface MatchReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: { id: string; opponent: string; match_date: string } | null;
  report?: MatchReport | null;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

export function MatchReportDialog({ open, onOpenChange, match, report }: MatchReportDialogProps) {
  const { toast } = useToast();
  const { currentUserRole } = useSchoolContext();
  const isAdmin = ADMIN_ROLES.includes(currentUserRole || '');

  const [summary, setSummary] = useState('');
  const [development, setDevelopment] = useState('');
  const [improvements, setImprovements] = useState('');
  const [adminComment, setAdminComment] = useState('');
  const [published, setPublished] = useState(false);

  const saveReport = useSaveMatchReport();
  const saveAdmin = useSaveMatchAdminComment();
  const publish = usePublishMatchReport();
  const { data: replies } = useMatchReportReplies(match?.id, open && !!report?.published_at);

  useEffect(() => {
    if (!open) return;
    setSummary(report?.summary ?? '');
    setDevelopment(report?.development ?? '');
    setImprovements(report?.improvements ?? '');
    setAdminComment(report?.admin_comment ?? '');
    setPublished(!!report?.published_at);
  }, [open, report?.match_id, report?.updated_at, report?.published_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const saving = saveReport.isPending || saveAdmin.isPending || publish.isPending;
  const tooLong = [summary, development, improvements, adminComment].some((t) => t.length > MAX);

  const handleSave = async () => {
    if (!match) return;
    try {
      await saveReport.mutateAsync({
        matchId: match.id,
        report: { summary, development, improvements },
      });
      if (isAdmin && adminComment.trim() !== (report?.admin_comment ?? '').trim()) {
        await saveAdmin.mutateAsync({ matchId: match.id, comment: adminComment });
      }
      const wasPublished = !!report?.published_at;
      if (published !== wasPublished || published) {
        // Al volver a publicar se renueva la fecha para que las familias vean que cambió.
        await publish.mutateAsync({ matchId: match.id, publish: published });
      }
      toast({ title: published ? '✅ Reporte guardado y publicado' : '✅ Reporte guardado' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'No se pudo guardar el reporte', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Reporte del partido
          </DialogTitle>
          <DialogDescription>
            {match ? `vs ${match.opponent} · ${fmtDate(match.match_date)}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mr-summary">Resumen</Label>
            <Textarea
              id="mr-summary"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="¿Cómo fue el partido en pocas palabras?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mr-development">Desarrollo del partido</Label>
            <Textarea
              id="mr-development"
              rows={5}
              value={development}
              onChange={(e) => setDevelopment(e.target.value)}
              placeholder="Cómo se fue dando el juego, momentos clave, cambios…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mr-improvements">Aspectos a mejorar</Label>
            <Textarea
              id="mr-improvements"
              rows={4}
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              placeholder="Qué vamos a trabajar en los próximos entrenamientos"
            />
          </div>

          {isAdmin && (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
              <Label htmlFor="mr-admin">Comentario de la administración</Label>
              <Textarea
                id="mr-admin"
                rows={3}
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                placeholder="Tu retroalimentación para el grupo. Se publica junto al reporte del entrenador."
              />
            </div>
          )}

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-1">
              <Label htmlFor="mr-publish" className="font-medium">Publicar a las familias</Label>
              <p className="text-xs text-muted-foreground">
                Se publican juntos el reporte del entrenador y el comentario de la administración.
                Las familias verán esto solo si la escuela tiene activado el reporte.
              </p>
            </div>
            <Switch id="mr-publish" checked={published} onCheckedChange={setPublished} />
          </div>

          {tooLong && (
            <p className="text-sm text-destructive">Cada campo admite hasta {MAX} caracteres.</p>
          )}

          {report?.published_at && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MessageCircle className="w-4 h-4" />
                Respuestas de las familias
                <Badge variant="secondary">{replies?.length ?? 0}</Badge>
              </div>
              {replies && replies.length > 0 ? (
                <div className="space-y-2">
                  {replies.map((r) => (
                    <div key={r.id} className="rounded-lg border p-3 text-sm">
                      <p className="whitespace-pre-wrap">{r.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {r.author_name ? `${r.author_name} · ` : ''}
                        {fmtDate(r.updated_at)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Todavía no hay respuestas.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || tooLong || !match}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
