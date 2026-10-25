/**
 * Documentos del hijo que sube la familia (Hijos › Ficha y salud).
 *
 * Los mismos tipos que la escuela carga en `athlete_documents` (catálogo en
 * lib/documentosDeportista): documentos del deportista y del acudiente, foto,
 * EPS, paz y salvo y las firmas del acudiente y del deportista. Ninguno es
 * obligatorio: cada fila tiene su «Subir» y, si ya hay archivo, «Ver» y «Cambiar».
 */
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { comprimirParaSubir, perfilPorBucket } from '@/lib/imageCompression';
import {
  DOCUMENTOS_DEPORTISTA, GRUPOS_DOCUMENTOS, validarArchivo, type DocumentoCatalogo,
} from '@/lib/documentosDeportista';
import { childDocsFolder, useChildDocuments } from './useHijosData';
import { Pill, Row, Section } from './parts';

const BUCKET = 'identity-documents';

export function DocumentosHijo({ childId, idDocumentUrl }: { childId: string; idDocumentUrl: string | null | undefined }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const docs = useChildDocuments(childId, idDocumentUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendiente, setPendiente] = useState<DocumentoCatalogo | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);

  const elegir = (doc: DocumentoCatalogo) => {
    setPendiente(doc);
    if (inputRef.current) {
      inputRef.current.accept = doc.soloImagen ? 'image/*' : 'image/*,application/pdf';
      inputRef.current.click();
    }
  };

  const subir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const doc = pendiente;
    if (!file || !doc || !user?.id) return;
    const error = validarArchivo(file, doc);
    if (error) {
      toast({ title: 'No se pudo subir', description: error, variant: 'destructive' });
      return;
    }
    setSubiendo(doc.tipo);
    try {
      const comprimido = await comprimirParaSubir(file, perfilPorBucket(BUCKET));
      const fecha = new Date().toISOString().replace(/[:.]/g, '-');
      const nombre = `${doc.prefijos[0]}${fecha}-${comprimido.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(`${childDocsFolder(user.id, childId)}/${nombre}`, comprimido, {
          contentType: comprimido.type || undefined,
          cacheControl: '3600',
          upsert: false,
        });
      if (upErr) throw upErr;
      toast({ title: 'Listo', description: `${doc.label}: cargado.` });
      await queryClient.invalidateQueries({ queryKey: ['hijos-v2-docs', user.id, childId] });
    } catch (err) {
      toast({
        title: 'No se pudo subir',
        description: err instanceof Error ? err.message : 'Inténtalo de nuevo en un momento.',
        variant: 'destructive',
      });
    } finally {
      setSubiendo(null);
    }
  };

  const ver = async (ruta: string) => {
    if (!ruta) return;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    else toast({ title: 'No pudimos abrir el archivo', variant: 'destructive' });
  };

  return (
    <Section title="Documentos">
      <p className="px-4 pt-1 text-xs text-muted-foreground">
        Ninguno es obligatorio. Súbelos si la escuela te los pide: los ve solo la escuela.
      </p>
      <input ref={inputRef} type="file" className="hidden" onChange={subir} aria-hidden="true" tabIndex={-1} />
      {docs.isError ? (
        <p className="px-4 pb-4 pt-2 text-sm text-muted-foreground">No pudimos revisar los documentos ahora.</p>
      ) : (
        GRUPOS_DOCUMENTOS.map((g) => (
          <div key={g.id} className="mt-2">
            <h4 className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</h4>
            {DOCUMENTOS_DEPORTISTA.filter((d) => d.grupo === g.id).map((d) => {
              const archivos = docs.data?.[d.tipo] ?? [];
              const ultimo = archivos[archivos.length - 1];
              const cargando = subiendo === d.tipo;
              return (
                <Row key={d.tipo} className="flex-wrap">
                  <span className="min-w-0 flex-1 text-sm">{d.label}</span>
                  {docs.isLoading ? (
                    <span className="h-5 w-16 animate-pulse rounded-full bg-muted motion-reduce:animate-none" aria-hidden="true" />
                  ) : cargando ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Subiendo" />
                  ) : ultimo ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Pill tone="good">Cargado</Pill>
                      {ultimo.ruta && (
                        <Button variant="ghost" size="sm" className="min-h-touch" onClick={() => void ver(ultimo.ruta)}>
                          Ver
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="min-h-touch" onClick={() => elegir(d)} disabled={!!subiendo}>
                        Cambiar
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="min-h-touch shrink-0" onClick={() => elegir(d)} disabled={!!subiendo}>
                      Subir
                    </Button>
                  )}
                </Row>
              );
            })}
          </div>
        ))
      )}
    </Section>
  );
}
