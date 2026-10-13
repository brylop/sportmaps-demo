/**
 * El adjunto de un mensaje del hilo: foto (miniatura que se abre en grande),
 * nota de voz (reproductor), video y documento (descarga).
 *
 * Hasta el 2026-10-13 el hilo mostraba «(image)», «(audio)»: el archivo está
 * en Meta y su URL es privada. Ahora se pide al BFF
 * (GET …/conversaciones/:id/mensajes/:id/media), que verifica que la
 * conversación sea de la escuela y no sea personal, y lo baja con el token.
 *
 * Cuidado con el cupo del BFF (200 peticiones / 15 min por IP en /whatsapp):
 * las fotos se piden solo cuando entran en pantalla, y el audio, el video y los
 * documentos solo cuando la persona toca el botón.
 */
import { useEffect, useRef, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, FileText, ImageOff, Loader2, Mic, Paperclip, Play, Video } from 'lucide-react';

export interface MedioDelMensaje {
    tipo: 'image' | 'audio' | 'video' | 'document' | 'sticker';
    mime: string | null;
    nombre: string | null;
    caption: string | null;
    voz: boolean;
    disponible: boolean;
}

const ETIQUETA: Record<MedioDelMensaje['tipo'], string> = {
    image: 'Foto', sticker: 'Sticker', audio: 'Audio', video: 'Video', document: 'Documento',
};

type Estado = { fase: 'idle' } | { fase: 'cargando' } | { fase: 'listo'; url: string } | { fase: 'error'; texto: string };

/** Pide el archivo al BFF y lo deja como object URL (que se libera al desmontar). */
function useArchivo(ruta: string) {
    const [estado, setEstado] = useState<Estado>({ fase: 'idle' });
    const url = useRef<string | null>(null);
    useEffect(() => () => { if (url.current) URL.revokeObjectURL(url.current); }, []);
    const pedir = async () => {
        if (estado.fase === 'cargando' || estado.fase === 'listo') return;
        setEstado({ fase: 'cargando' });
        try {
            const blob = await bffClient.getBlob(ruta);
            url.current = URL.createObjectURL(blob);
            setEstado({ fase: 'listo', url: url.current });
        } catch (e: any) {
            setEstado({ fase: 'error', texto: e?.status === 410 ? 'WhatsApp ya no tiene este archivo.' : (e?.message || 'No se pudo abrir.') });
        }
    };
    return { estado, pedir };
}

export function AdjuntoDelMensaje({ schoolId, conversacionId, mensajeId, medio }: {
    schoolId: string; conversacionId: string; mensajeId: string; medio: MedioDelMensaje;
}) {
    const ruta = `/api/v1/whatsapp/${schoolId}/conversaciones/${conversacionId}/mensajes/${mensajeId}/media`;
    const { estado, pedir } = useArchivo(ruta);
    const [grande, setGrande] = useState(false);
    const caja = useRef<HTMLDivElement>(null);
    const esImagen = medio.tipo === 'image' || medio.tipo === 'sticker';

    // Fotos: se piden al entrar en pantalla (no todas de golpe al abrir el hilo).
    useEffect(() => {
        if (!esImagen || !medio.disponible || estado.fase !== 'idle') return;
        const el = caja.current;
        if (!el || typeof IntersectionObserver === 'undefined') { void pedir(); return; }
        const io = new IntersectionObserver((entradas) => {
            if (entradas.some((e) => e.isIntersecting)) { io.disconnect(); void pedir(); }
        }, { rootMargin: '200px' });
        io.observe(el);
        return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [esImagen, medio.disponible, estado.fase]);

    if (!medio.disponible) {
        return (
            <p className="flex items-center gap-1.5 text-xs italic text-muted-foreground" data-testid="adjunto-no-disponible">
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                {ETIQUETA[medio.tipo]} · no disponible (contenido personal o ya borrado)
            </p>
        );
    }

    if (estado.fase === 'error') {
        return (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                <ImageOff className="h-3.5 w-3.5 shrink-0" /> {ETIQUETA[medio.tipo]}: {estado.texto}
            </p>
        );
    }

    if (esImagen) {
        return (
            <div ref={caja}>
                {estado.fase === 'listo' ? (
                    <>
                        <button type="button" onClick={() => setGrande(true)} aria-label={`Ver ${ETIQUETA[medio.tipo].toLowerCase()} en grande`}
                                className="block overflow-hidden rounded-md border bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <img src={estado.url} alt={medio.caption ?? ETIQUETA[medio.tipo]}
                                 className={medio.tipo === 'sticker' ? 'h-24 w-24 object-contain' : 'max-h-media w-full max-w-xs object-cover'} />
                        </button>
                        <Dialog open={grande} onOpenChange={setGrande}>
                            <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-modal-lg">
                                <DialogHeader>
                                    <DialogTitle>{ETIQUETA[medio.tipo]}</DialogTitle>
                                    {medio.caption && <DialogDescription>{medio.caption}</DialogDescription>}
                                </DialogHeader>
                                <img src={estado.url} alt={medio.caption ?? ETIQUETA[medio.tipo]} className="max-h-list w-full object-contain" />
                                <a href={estado.url} download className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline">
                                    <Download className="h-4 w-4" /> Descargar
                                </a>
                            </DialogContent>
                        </Dialog>
                    </>
                ) : (
                    <div className="flex h-24 w-40 items-center justify-center rounded-md border bg-muted/40 text-xs text-muted-foreground"
                         aria-busy="true">
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Cargando foto…
                    </div>
                )}
            </div>
        );
    }

    if (medio.tipo === 'audio' || medio.tipo === 'video') {
        if (estado.fase === 'listo') {
            return medio.tipo === 'audio'
                ? <audio controls autoPlay src={estado.url} className="w-full max-w-xs" aria-label="Nota de voz" />
                : <video controls autoPlay src={estado.url} className="max-h-media w-full max-w-xs rounded-md" />;
        }
        return (
            <Button type="button" variant="outline" size="sm" className="min-h-touch md:min-h-0" onClick={() => void pedir()}
                    disabled={estado.fase === 'cargando'}>
                {estado.fase === 'cargando'
                    ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    : medio.tipo === 'audio' ? <Mic className="mr-1.5 h-4 w-4" /> : <Video className="mr-1.5 h-4 w-4" />}
                <Play className="mr-1 h-3 w-3" />
                {medio.tipo === 'audio' ? (medio.voz ? 'Escuchar nota de voz' : 'Escuchar audio') : 'Ver video'}
            </Button>
        );
    }

    // Documento: se baja a pedido y se ofrece el enlace de descarga.
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-sm">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{medio.nombre ?? (medio.mime === 'application/pdf' ? 'Documento PDF' : 'Documento')}</span>
            </span>
            {estado.fase === 'listo' ? (
                <a href={estado.url} download={medio.nombre ?? undefined} target="_blank" rel="noreferrer"
                   className="inline-flex min-h-touch items-center gap-1 text-sm text-primary underline-offset-2 hover:underline md:min-h-0">
                    <Download className="h-4 w-4" /> Abrir
                </a>
            ) : (
                <Button type="button" variant="outline" size="sm" className="min-h-touch md:min-h-0" onClick={() => void pedir()}
                        disabled={estado.fase === 'cargando'}>
                    {estado.fase === 'cargando' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                    Descargar
                </Button>
            )}
        </div>
    );
}
