/**
 * Pantalla completa del visor 3D. Vive en el MISMO chunk lazy que el visor
 * (Tactical3DLauncher la carga con import()), así ni el diálogo ni sus textos
 * suman al chunk de la pizarra.
 */
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useMemo } from 'react';
import type { Viewer3DSource } from '@/lib/school/tactical3dLaunch';
import { viewerFrames } from '@/lib/school/tactical3d';
import { resolveViewerSource } from '@/lib/school/tactical3dSuggestion';
import Tactical3DViewer from './Tactical3DViewer';

export default function Tactical3DModal({ source: raw, onClose, onFallback, minFps }: {
  /** Foto de la jugada tomada al tocar el botón. */
  source: Viewer3DSource;
  onClose: () => void;
  onFallback: () => void;
  minFps?: number;
}) {
  const source = useMemo(() => resolveViewerSource(raw), [raw]);
  const input = useMemo(() => viewerFrames(source), [source]);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none border-0 bg-slate-950 p-0 sm:rounded-none [&>button.absolute]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Jugada en 3D</DialogTitle>
        <DialogDescription className="sr-only">Visor 3D de la jugada: gira la cámara, cambia de vista y reprodúcela.</DialogDescription>
        <Tactical3DViewer
          sport={source.sport}
          frames={input.frames}
          playerLabels={input.labels}
          playerJerseys={input.jerseys}
          title={source.title}
          overlayFrames={source.overlayFrames ?? null}
          overlayLabels={source.overlayLabels}
          overlayName={source.overlayName}
          onClose={onClose}
          onFallback={onFallback}
          minFps={minFps}
        />
      </DialogContent>
    </Dialog>
  );
}
