import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, FileText, ShieldCheck, Trash2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * Dialog para que el padre suba documento de identidad (TI/RC/CC) + certificado EPS
 * de su hijo/a ya vinculado.
 *
 * Storage:
 *   bucket: identity-documents
 *   path:   children/{childId}/docs/identity-{timestamp}-{file.name}
 *           children/{childId}/docs/eps-{timestamp}-{file.name}
 *
 * El prefijo del nombre (identity- / eps-) diferencia el tipo.
 */

type DocType = 'identity' | 'eps';

interface FileEntry {
  name: string;
  url: string;
  type: DocType | 'other';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  child: { id: string; full_name: string };
}

export function UploadChildDocumentsDialog({ open, onOpenChange, child }: Props) {
  const { toast } = useToast();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<DocType | null>(null);

  const bucket = 'identity-documents';
  const folder = `children/${child.id}/docs`;

  const classifyFile = (name: string): DocType | 'other' => {
    if (name.startsWith('identity-') || name.startsWith('id-')) return 'identity';
    if (name.startsWith('eps-')) return 'eps';
    return 'other';
  };

  const loadFiles = async () => {
    if (!child.id) return;
    setLoading(true);
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 50 });
    if (error || !data) {
      setFiles([]);
      setLoading(false);
      return;
    }
    const resolved = await Promise.all(
      data.map(async (f) => {
        const { data: url } = await supabase.storage
          .from(bucket)
          .createSignedUrl(`${folder}/${f.name}`, 300);
        return {
          name: f.name,
          url: url?.signedUrl || '',
          type: classifyFile(f.name),
        };
      })
    );
    setFiles(resolved.filter((f) => f.url));
    setLoading(false);
  };

  useEffect(() => {
    if (open) loadFiles();
  }, [open, child.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: DocType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'Maximo 10 MB', variant: 'destructive' });
      return;
    }
    if (!/\.(pdf|jpg|jpeg|png)$/i.test(file.name)) {
      toast({ title: 'Formato no permitido', description: 'Sube un PDF o imagen (JPG/PNG)', variant: 'destructive' });
      return;
    }

    setUploading(type);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const newName = `${type}-${timestamp}-${safeName}`;
    const path = `${folder}/${newName}`;

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    setUploading(null);
    e.target.value = '';

    if (error) {
      toast({ title: 'Error al subir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: '✅ Subido', description: `${type === 'identity' ? 'Documento de identidad' : 'Certificado EPS'} cargado` });
    loadFiles();
  };

  const handleDelete = async (fileName: string) => {
    if (!confirm('¿Eliminar este archivo?')) return;
    const { error } = await supabase.storage.from(bucket).remove([`${folder}/${fileName}`]);
    if (error) {
      toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Eliminado' });
    loadFiles();
  };

  const identityFiles = files.filter((f) => f.type === 'identity');
  const epsFiles = files.filter((f) => f.type === 'eps');
  const otherFiles = files.filter((f) => f.type === 'other');

  const FileRow = ({ f }: { f: FileEntry }) => (
    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs truncate flex-1" title={f.name}>{f.name}</span>
      <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="h-3.5 w-3.5" /></Button>
      </a>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(f.name)}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Documentos de {child.full_name}</DialogTitle>
          <DialogDescription>
            Sube el documento de identidad del hijo/a (TI, RC o CC) y el certificado de EPS.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* ── Identidad ────────────────────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <Label className="font-semibold">Documento de identidad del hijo/a</Label>
                {identityFiles.length > 0 && <Badge variant="secondary">{identityFiles.length}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">Tarjeta de Identidad (TI), Registro Civil (RC) o Cedula de Ciudadania (CC) segun edad.</p>

              {identityFiles.map((f) => <FileRow key={f.name} f={f} />)}

              <label className="block">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => handleUpload(e, 'identity')}
                  disabled={uploading === 'identity'}
                />
                <Button asChild variant="outline" size="sm" className="w-full cursor-pointer" disabled={uploading === 'identity'}>
                  <span>
                    {uploading === 'identity' ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Subiendo...</>
                    ) : (
                      <><Upload className="h-3.5 w-3.5 mr-2" /> Subir documento de identidad</>
                    )}
                  </span>
                </Button>
              </label>
            </div>

            {/* ── EPS ─────────────────────────────────────────── */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                <Label className="font-semibold">Certificado EPS</Label>
                {epsFiles.length > 0 && <Badge variant="secondary">{epsFiles.length}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">Certificado de afiliacion a la EPS, emitido en el ultimo mes idealmente.</p>

              {epsFiles.map((f) => <FileRow key={f.name} f={f} />)}

              <label className="block">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => handleUpload(e, 'eps')}
                  disabled={uploading === 'eps'}
                />
                <Button asChild variant="outline" size="sm" className="w-full cursor-pointer" disabled={uploading === 'eps'}>
                  <span>
                    {uploading === 'eps' ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Subiendo...</>
                    ) : (
                      <><Upload className="h-3.5 w-3.5 mr-2" /> Subir certificado EPS</>
                    )}
                  </span>
                </Button>
              </label>
            </div>

            {/* ── Otros (legacy) ──────────────────────────────── */}
            {otherFiles.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs text-muted-foreground">Otros archivos subidos antes</Label>
                {otherFiles.map((f) => <FileRow key={f.name} f={f} />)}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
