/**
 * Enganche de Notas + Videos en la pizarra (M6c). La pizarra monta:
 *   · <PlayMediaButtons> en el toolbar (desktop con palabras; celular en modo
 *     ver, íconos),
 *   · <PlayMediaMenuItems> dentro de «Más» (celular editando),
 *   · <PlayMediaDialogs> una vez.
 * Todo el estado vive en usePlayMedia(); los cuadros, en la pizarra.
 */
import { FileText, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { PlayMedia } from './usePlayMedia';
import { PlayNotesDialog } from './PlayNotesDialog';
import { PlayVideosDialog } from './PlayVideosDialog';

export type MediaDialog = 'notes' | 'videos' | null;

export function PlayMediaButtons({ media, onOpen, isMobile, viewing, className }: {
  media: PlayMedia;
  onOpen: (d: Exclude<MediaDialog, null>) => void;
  isMobile: boolean;
  viewing: boolean;
  className: string;
}) {
  // Celular editando: van en «Más» (el toolbar ya ocupa dos filas).
  if (isMobile && !viewing) return null;
  // Celular viendo: solo si hay algo que ver.
  if (isMobile && viewing && !media.count.notes && !media.count.videos) return null;
  const iconOnly = isMobile;
  return (
    <>
      <Button size="sm" variant="ghost" className={className} onClick={() => onOpen('notes')} aria-label="Notas" title="Notas de la jugada y de cada cuadro">
        <FileText className="h-3.5 w-3.5" />
        {!iconOnly && <>Notas{media.count.notes ? ' •' : ''}</>}
      </Button>
      <Button size="sm" variant="ghost" className={className} onClick={() => onOpen('videos')} aria-label={`Videos${media.count.videos ? ` (${media.count.videos})` : ''}`} title="Videos de la jugada (YouTube, Vimeo, Veo, Hudl…)">
        <PlayCircle className="h-3.5 w-3.5" />
        {!iconOnly && <>Videos{media.count.videos ? ` (${media.count.videos})` : ''}</>}
      </Button>
    </>
  );
}

export function PlayMediaMenuItems({ media, onOpen }: { media: PlayMedia; onOpen: (d: Exclude<MediaDialog, null>) => void }) {
  return (
    <>
      <DropdownMenuItem onSelect={() => window.setTimeout(() => onOpen('notes'), 0)}>
        <FileText className="h-4 w-4 mr-2" /> Notas{media.count.notes ? ' •' : ''}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => window.setTimeout(() => onOpen('videos'), 0)}>
        <PlayCircle className="h-4 w-4 mr-2" /> Videos{media.count.videos ? ` (${media.count.videos})` : ''}
      </DropdownMenuItem>
    </>
  );
}

export function PlayMediaDialogs({ media, open, onOpenChange, readOnly, frameIndex, frameCount, frameNote, onFrameNoteSave }: {
  media: PlayMedia;
  open: MediaDialog;
  onOpenChange: (d: MediaDialog) => void;
  readOnly: boolean;
  frameIndex: number;
  frameCount: number;
  frameNote: string;
  onFrameNoteSave: (text: string) => void;
}) {
  return (
    <>
      <PlayNotesDialog
        open={open === 'notes'}
        onOpenChange={(v) => onOpenChange(v ? 'notes' : null)}
        readOnly={readOnly}
        notes={media.notes}
        onSave={media.setNotes}
        frameIndex={frameIndex}
        frameCount={frameCount}
        frameNote={frameNote}
        onFrameNoteSave={onFrameNoteSave}
        onOpenVideos={() => onOpenChange('videos')}
        videoCount={media.count.videos}
      />
      {/* Montado solo abierto: así «Videos guardados» se pide al abrir y la
          pizarra no necesita un QueryClient si nunca se abre. */}
      {open === 'videos' && (
        <PlayVideosDialog
          open
          onOpenChange={(v) => onOpenChange(v ? 'videos' : null)}
          readOnly={readOnly}
          videos={media.videos}
          onSave={media.setVideos}
        />
      )}
    </>
  );
}
