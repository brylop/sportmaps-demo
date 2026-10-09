import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { comprimirParaSubir } from '@/lib/imageCompression';
import { FileText, FileImage, FileSpreadsheet, Loader2, Paperclip, Trash2, Upload } from 'lucide-react';
import {
  MESOCYCLE_DOCUMENTS_BUCKET,
  MAX_MESOCYCLE_DOCUMENT_BYTES,
  ACCEPT_ATTR,
  buildMesocycleDocumentPath,
  formatBytes,
  resolveMimeType,
} from '@/lib/school/mesocycleDocuments';

/**
 * Documentos adjuntos a un mesociclo (spec rediseno-seguimiento-deportivo §F6).
 * Solo staff de la escuela (RLS por user_staff_school_ids(), migración
 * 20261008154654): padres y atletas nunca llegan a esta pantalla ni al bucket.
 *
 * Subir: comprime imágenes (Supabase Free al ~49 %), sube al bucket privado y
 * después registra la fila; si la fila falla, borra el objeto recién subido.
 * Abrir: URL firmada de corta vida. Borrar: fila primero (es la que decide si
 * se ve), objeto después.
 */

interface MesocycleDocumentRow {
  id: string;
  mesocycle_id: string;
  school_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
  uploader?: { full_name: string | null } | null;
}

interface MesocycleDocumentsProps {
  mesocycleId: string;
  schoolId: string;
  /** Administración de la escuela: puede borrar documentos de cualquiera. */
  canDeleteAny?: boolean;
}

function DocIcon({ mime }: { mime: string | null }) {
  if (mime?.startsWith('image/')) return <FileImage className="w-4 h-4 text-sky-600 shrink-0" />;
  if (mime?.includes('spreadsheet')) return <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />;
  return <FileText className="w-4 h-4 text-primary shrink-0" />;
}

export function MesocycleDocuments({ mesocycleId, schoolId, canDeleteAny = false }: MesocycleDocumentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [toDelete, setToDelete] = useState<MesocycleDocumentRow | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const queryKey = ['mesocycle-documents', mesocycleId];

  const { data: docs, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('training_mesocycle_documents')
        .select('*, uploader:profiles!training_mesocycle_documents_uploaded_by_fkey(full_name)')
        .eq('mesocycle_id', mesocycleId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as MesocycleDocumentRow[];
    },
    enabled: !!mesocycleId,
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      if (!user?.id) throw new Error('Tu sesión expiró. Vuelve a entrar.');
      let ok = 0;
      const failures: string[] = [];
      for (const original of files) {
        const mime = resolveMimeType(original);
        if (!mime) {
          failures.push(`${original.name}: tipo no permitido (PDF, imagen, Word, Excel o PowerPoint)`);
          continue;
        }
        // Solo se comprimen las imágenes; PDF/Office se suben tal cual.
        const file = mime.startsWith('image/') ? await comprimirParaSubir(original, 'documento') : original;
        if (file.size > MAX_MESOCYCLE_DOCUMENT_BYTES) {
          failures.push(`${original.name}: pesa ${formatBytes(file.size)}, el tope es 10 MB`);
          continue;
        }
        const finalMime = file === original ? mime : file.type || mime;
        const path = buildMesocycleDocumentPath(schoolId, mesocycleId, file.name);
        const { error: upErr } = await supabase.storage
          .from(MESOCYCLE_DOCUMENTS_BUCKET)
          .upload(path, file, { contentType: finalMime, upsert: false, cacheControl: '3600' });
        if (upErr) {
          failures.push(`${original.name}: ${upErr.message}`);
          continue;
        }
        const { error: rowErr } = await (supabase as any).from('training_mesocycle_documents').insert({
          mesocycle_id: mesocycleId,
          school_id: schoolId,
          storage_path: path,
          file_name: original.name,
          mime_type: finalMime,
          size_bytes: file.size,
          uploaded_by: user.id,
        });
        if (rowErr) {
          // Sin fila el archivo es invisible: no dejarlo ocupando cupo.
          await supabase.storage.from(MESOCYCLE_DOCUMENTS_BUCKET).remove([path]);
          failures.push(`${original.name}: ${rowErr.message}`);
          continue;
        }
        ok += 1;
      }
      return { ok, failures };
    },
    onSuccess: ({ ok, failures }) => {
      queryClient.invalidateQueries({ queryKey });
      if (ok > 0) toast({ title: ok === 1 ? '✅ Documento subido' : `✅ ${ok} documentos subidos` });
      if (failures.length > 0) {
        toast({ title: 'Algunos archivos no se subieron', description: failures.join(' · '), variant: 'destructive' });
      }
    },
    onError: (error: any) => toast({ title: 'No se pudo subir', description: error.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (doc: MesocycleDocumentRow) => {
      const { data, error } = await (supabase as any)
        .from('training_mesocycle_documents')
        .delete()
        .eq('id', doc.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No tienes permiso para borrar este documento.');
      // La fila ya no existe; si el objeto no se puede borrar queda huérfano
      // pero invisible (no rompe la lista).
      await supabase.storage.from(MESOCYCLE_DOCUMENTS_BUCKET).remove([doc.storage_path]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Documento eliminado' });
      setToDelete(null);
    },
    onError: (error: any) => toast({ title: 'No se pudo eliminar', description: error.message, variant: 'destructive' }),
  });

  const openDoc = async (doc: MesocycleDocumentRow, download = false) => {
    setOpeningId(doc.id);
    try {
      const { data, error } = await supabase.storage
        .from(MESOCYCLE_DOCUMENTS_BUCKET)
        .createSignedUrl(doc.storage_path, 120, download ? { download: doc.file_name } : undefined);
      if (error || !data?.signedUrl) throw error || new Error('Sin enlace');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast({ title: 'No se pudo abrir el documento', description: e?.message, variant: 'destructive' });
    } finally {
      setOpeningId(null);
    }
  };

  const handleFiles = (list: FileList | null) => {
    const files = Array.from(list || []);
    if (files.length > 0) upload.mutate(files);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Subir documentos al mesociclo"
        onClick={() => !upload.isPending && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !upload.isPending) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!upload.isPending) handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/30'
        }`}
      >
        {upload.isPending ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        ) : (
          <Upload className="w-6 h-6 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">{upload.isPending ? 'Subiendo…' : 'Arrastra archivos aquí o haz clic para elegir'}</p>
        <p className="text-xs text-muted-foreground">PDF, Word, Excel, PowerPoint o imágenes · máximo 10 MB por archivo</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : !docs || docs.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-5 text-center">
          <Paperclip className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            Sube aquí el plan en Word/PDF, fotos de la pizarra o lo que quieras guardar con este mesociclo.
          </p>
          <p className="text-xs text-muted-foreground mt-1">Solo los ve el equipo de trabajo de la escuela, nunca las familias.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {docs.map((doc) => {
            const canDelete = canDeleteAny || (!!user?.id && doc.uploaded_by === user.id);
            const who = doc.uploader?.full_name || 'Alguien del equipo';
            const when = new Date(doc.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
            return (
              <li key={doc.id} className="flex items-center gap-3 px-3 py-2">
                <DocIcon mime={doc.mime_type} />
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => openDoc(doc)}
                  disabled={openingId === doc.id}
                  title="Abrir"
                >
                  <span className="block truncate text-sm font-medium hover:underline">{doc.file_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {doc.size_bytes != null ? `${formatBytes(doc.size_bytes)} · ` : ''}
                    {who} · {when}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0"
                  disabled={openingId === doc.id}
                  onClick={() => openDoc(doc, true)}
                >
                  Descargar
                </Button>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    aria-label={`Eliminar ${doc.file_name}`}
                    onClick={() => setToDelete(doc)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(open) => { if (!open) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este documento?</AlertDialogTitle>
            <AlertDialogDescription>
              «{toDelete?.file_name}» se borra para todo el equipo. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (toDelete) remove.mutate(toDelete);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
