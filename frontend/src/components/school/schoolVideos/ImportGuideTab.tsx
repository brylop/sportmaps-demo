/**
 * «Importar de Veo / Hudl / …» (M6h): ninguna de estas plataformas tiene una
 * API pública para traer el video solo (spec §4). Fase 1 = guía «descarga el
 * MP4 y súbelo acá», o pegar el ENLACE en «Videos» de la jugada (M6c: no ocupa
 * cupo). La importación automática de Veo queda para la fase 5 si Veo abre API.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Link2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IMPORT_SOURCES, type VideoSource } from '@/lib/school/schoolVideos';

export interface ImportGuideTabProps {
  /** Lleva a «Subir video» con el origen ya marcado. null = subida apagada. */
  onUpload?: ((source: VideoSource) => void) | null;
}

export function ImportGuideTab({ onUpload }: ImportGuideTabProps) {
  const [openId, setOpenId] = useState<string | null>('veo');
  return (
    <div className="space-y-3" data-testid="import-guide-tab">
      <p className="text-xs text-muted-foreground">
        Veo, Hudl y las demás cámaras no dejan traer el video solo. Hay dos caminos:
        <strong className="text-foreground"> descargarlo y subirlo aquí</strong> (para recortar clips y ligarlos a la jugada) o
        <strong className="text-foreground"> pegar su enlace</strong> en la pestaña «Enlaces» de este mismo diálogo (no ocupa cupo).
      </p>
      <ul className="divide-y rounded-md border">
        {IMPORT_SOURCES.map((s) => {
          const open = openId === s.id;
          return (
            <li key={s.id}>
              <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/50"
                aria-expanded={open} onClick={() => setOpenId(open ? null : s.id)}>
                <span>{s.name}</span>
                <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                  {s.link && <span className="hidden items-center gap-1 sm:flex"><Link2 className="h-3 w-3" /> enlace</span>}
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
              </button>
              {open && (
                <div className="space-y-2 px-3 pb-3">
                  <ol className="list-decimal space-y-1 pl-5 text-sm">
                    {s.steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                  {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
                  {onUpload && (
                    <Button type="button" size="sm" variant="outline" onClick={() => onUpload(s.source)}>
                      <UploadCloud className="mr-1 h-4 w-4" /> Ya lo descargué: subirlo
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
