/**
 * «Exportar ▾» de la pizarra táctica (spec docs/specs/pizarra-nivel-tacticalpad.md, T2 y §5):
 * Imagen (PNG) · Ficha del ejercicio (PDF) · Video de la jugada · Compartir por WhatsApp.
 *
 * El trabajo pesado (jsPDF, react-dom/server, MediaRecorder) se carga recién
 * al exportar con import(): la pizarra no paga ese peso al abrir.
 */
import { useState } from 'react';
import { saveAs } from 'file-saver';
import { ChevronDown, Download, FileText, Film, Image as ImageIcon, Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/hooks/use-toast';
import type { TacticalExportInput } from '@/lib/export/tacticalExport';

export type TacticalExportEvent = 'export_png' | 'export_pdf' | 'export_video' | 'share';

export interface TacticalExportMenuProps {
  /** Se llama al elegir una opción: devuelve el estado actual de la pizarra. */
  getInput: () => TacticalExportInput | Promise<TacticalExportInput>;
  /** Cuántos cuadros tiene la jugada (habilita el video con 2 o más). */
  frameCount: number;
  /** Métrica de uso (T0): log_tactical_board_event. */
  onEvent?: (event: TacticalExportEvent) => void;
  disabled?: boolean;
  className?: string;
}

type Busy = null | 'png' | 'pdf' | 'video' | 'share';

const loadExport = () => import('@/lib/export/tacticalExport');

function errorMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'Inténtalo de nuevo.';
}

export function TacticalExportMenu({ getInput, frameCount, onEvent, disabled, className }: TacticalExportMenuProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const videoReady = frameCount >= 2;

  const downloadPng = async (input?: TacticalExportInput) => {
    const mod = await loadExport();
    const data = input ?? (await getInput());
    const blob = await mod.exportPng({ players: data.players, arrows: data.arrows, title: data.title, teamName: data.teamName });
    saveAs(blob, mod.exportFileName(data.title, 'png'));
  };

  /** `work` devuelve el título final del toast, o null si ya dejó el toast como debe quedar. */
  const run = async (kind: Exclude<Busy, null>, work: (t: ReturnType<typeof toast>) => Promise<string | null>) => {
    if (busy) return;
    setBusy(kind);
    // Sin cierre automático mientras trabaja (el video dura lo que dura la jugada).
    const t = toast({ title: 'Preparando…', description: 'Esto toma unos segundos.', duration: 120_000 });
    try {
      const done = await work(t);
      if (done !== null) t.update({ id: t.id, title: done, description: undefined, duration: 4000 });
    } catch (e) {
      const mod = await loadExport().catch(() => null);
      if (mod?.isTacticalVideoUnsupported(e)) {
        t.update({
          id: t.id,
          duration: 10_000,
          title: 'No se pudo hacer el video',
          description: e instanceof Error ? e.message : undefined,
          action: (
            <ToastAction altText="Descargar imagen" onClick={() => void downloadPng().catch(() => undefined)}>
              Descargar imagen
            </ToastAction>
          ),
        });
      } else {
        t.update({ id: t.id, title: 'No se pudo exportar', description: errorMessage(e), variant: 'destructive', duration: 6000 });
      }
    } finally {
      setBusy(null);
    }
  };

  const onPng = () =>
    run('png', async (t) => {
      t.update({ id: t.id, title: 'Generando imagen…' });
      await downloadPng();
      onEvent?.('export_png');
      return 'Imagen descargada';
    });

  const onPdf = () =>
    run('pdf', async (t) => {
      t.update({ id: t.id, title: 'Armando la ficha del ejercicio…' });
      const mod = await loadExport();
      const data = await getInput();
      const blob = await mod.exportExercisePdf({ ...data, title: data.title || 'Ejercicio' });
      saveAs(blob, mod.exportFileName(data.title, 'pdf', 'ficha'));
      onEvent?.('export_pdf');
      return 'Ficha descargada';
    });

  const onVideo = () =>
    run('video', async (t) => {
      const mod = await loadExport();
      const data = await getInput();
      t.update({ id: t.id, title: 'Grabando el video…', description: 'Se reproduce la jugada mientras se graba.' });
      let last = -1;
      const res = await mod.exportVideo({
        frames: data.frames ?? [],
        playerLabels: data.playerLabels,
        playerJerseys: data.playerJerseys,
        onProgress: (p) => {
          const pct = Math.round(p * 10) * 10;
          if (pct !== last) {
            last = pct;
            t.update({ id: t.id, title: `Grabando el video… ${pct} %` });
          }
        },
      });
      saveAs(res.blob, mod.exportFileName(data.title, res.ext));
      onEvent?.('export_video');
      return 'Video descargado';
    });

  const onShare = () =>
    run('share', async (t) => {
      t.update({ id: t.id, title: 'Preparando para compartir…' });
      const mod = await loadExport();
      const data = await getInput();
      const blob = await mod.exportPng({ players: data.players, arrows: data.arrows, title: data.title, teamName: data.teamName });
      const text = data.title ? `Jugada: ${data.title}` : 'Te comparto la jugada';
      const res = await mod.shareFile(blob, mod.exportFileName(data.title, 'png'), text);
      if (res.method === 'cancelled') return 'Compartir cancelado';
      onEvent?.('share');
      if (res.method === 'download') {
        t.update({
          id: t.id,
          duration: 10_000,
          title: 'Imagen descargada',
          description: 'Ábrela en WhatsApp y adjúntala al chat.',
          action: (
            <ToastAction altText="Abrir WhatsApp" onClick={() => window.open(res.whatsappUrl, '_blank', 'noopener,noreferrer')}>
              Abrir WhatsApp
            </ToastAction>
          ),
        });
        return null;
      }
      return 'Compartido';
    });

  const itemClass = 'min-h-[44px] gap-3 cursor-pointer';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={`min-h-[44px] gap-2 ${className ?? ''}`}
          disabled={disabled || !!busy}
          aria-label="Exportar la jugada"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exportar
          <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem className={itemClass} onSelect={() => void onPng()}>
          <ImageIcon className="h-4 w-4" /> Imagen (PNG)
        </DropdownMenuItem>
        <DropdownMenuItem className={itemClass} onSelect={() => void onPdf()}>
          <FileText className="h-4 w-4" /> Ficha del ejercicio (PDF)
        </DropdownMenuItem>
        {videoReady ? (
          <DropdownMenuItem className={itemClass} onSelect={() => void onVideo()}>
            <Film className="h-4 w-4" /> Video de la jugada
          </DropdownMenuItem>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* El ítem deshabilitado no recibe el puntero: el tooltip va en el envoltorio. */}
              <div>
                <DropdownMenuItem className={itemClass} disabled>
                  <Film className="h-4 w-4" />
                  <span className="flex flex-col">
                    <span>Video de la jugada</span>
                    <span className="text-xs text-muted-foreground">Necesita 2 cuadros o más</span>
                  </span>
                </DropdownMenuItem>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left">Agrega un segundo cuadro para animar la jugada.</TooltipContent>
          </Tooltip>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className={itemClass} onSelect={() => void onShare()}>
          <Share2 className="h-4 w-4" /> Compartir por WhatsApp
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
