/**
 * M6d — diálogo «Campo» (docs/specs/pizarra-m6-paridad-tacticalpad.md §4):
 * galería de plantillas de líneas con miniatura, «Incluyendo porterías», cámara
 * (completa / media cancha con el arco abajo o arriba / 3/4 / área) con la
 * orientación, piso y colores de césped, líneas y contorno. Cada cambio se
 * aplica en vivo (onChange); lo guarda «Guardar jugada» como siempre, porque
 * viaja en las figuras (tacticalCourt.ts).
 */
import { RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { viewBoxOf } from '@/lib/school/tacticalGeometry';
import type { TacticalSport } from '@/lib/school/tacticalSports';
import {
  CAMERA_LABEL, CAMERA_VIEW, camerasFor, GRASS_COLORS, LINE_COLORS, normalizeCourt, OUTLINE_COLORS, SURFACE_DEF, SURFACE_LABEL,
  SURFACES, templateOf, templatesFor, type CourtCamera, type CourtConfig,
} from '@/lib/school/tacticalCourt';
import { CourtBackground } from './courts/CourtBackground';

function Thumb({ sport, court, label, active, onClick, testId }: {
  sport: TacticalSport; court: CourtConfig; label: string; active: boolean; onClick: () => void; testId: string;
}) {
  const view = CAMERA_VIEW[court.cam ?? 'full'];
  return (
    <button type="button" onClick={onClick} data-testid={testId} aria-pressed={active}
      className={`shrink-0 w-[92px] rounded-lg border p-1.5 text-left transition-colors ${active ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30' : 'border-zinc-200 hover:bg-zinc-50'}`}>
      {/* Miniatura isométrica: la misma cancha de la pizarra, inclinada. */}
      <div className="h-[86px] flex items-center justify-center [perspective:260px]">
        <div className="relative w-[66px] rounded-md overflow-hidden shadow-md [transform:rotateX(32deg)]"
          style={{ aspectRatio: `300 / ${(view.y1 - view.y0) * 3.4}` }}>
          <CourtBackground sport={sport} court={{ ...court, cam: undefined }} viewBox={viewBoxOf(view)} />
        </div>
      </div>
      <span className="block mt-1 text-[10px] font-semibold leading-tight text-zinc-700 line-clamp-2">{label}</span>
    </button>
  );
}

function Swatches({ colors, value, onPick, label }: { colors: string[]; value?: string; onPick: (c: string | undefined) => void; label: string }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="w-20 text-xs text-zinc-600">{label}</span>
      <button type="button" onClick={() => onPick(undefined)} aria-pressed={!value}
        className={`h-6 px-2 rounded-full border text-[10px] ${!value ? 'border-emerald-500 text-emerald-700' : 'border-zinc-300 text-zinc-600'}`}>
        Auto
      </button>
      {colors.map((c) => (
        <button key={c} type="button" onClick={() => onPick(c)} aria-label={`${label} ${c}`} aria-pressed={value === c}
          className={`h-6 w-6 rounded-full border-2 ${value === c ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-zinc-300'}`}
          style={{ backgroundColor: c }} />
      ))}
    </div>
  );
}

export function TacticalCourtDialog({ open, onOpenChange, sport, court, onChange, allowArea }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sport: TacticalSport;
  court: CourtConfig;
  onChange: (next: CourtConfig) => void;
  /** Deportes con arco: se ofrece la cámara del área (arqueros). */
  allowArea: boolean;
}) {
  const set = (patch: Partial<CourtConfig>) => onChange(normalizeCourt({ ...court, ...patch }));
  const tpl = templateOf(court.tpl);
  const goalsApply = tpl?.family === 'replace';
  const base = { surface: court.surface, grass: court.grass, lines: court.lines, outline: court.outline, goals: court.goals };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0" data-testid="tb-court-dialog">
        <DialogHeader>
          <DialogTitle>Campo</DialogTitle>
          <DialogDescription>
            Líneas de ayuda, cámara y colores de la cancha. Se guarda con la jugada y sale igual en el PDF, la imagen y el video.
            Las posiciones no cambian: siempre se guardan sobre la cancha completa.
          </DialogDescription>
        </DialogHeader>

        <section>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h3 className="text-sm font-semibold">Plantillas de líneas</h3>
            <label className="flex items-center gap-2 text-xs text-zinc-600" title={goalsApply ? '' : 'Aplica a los lienzos de ejercicio (sin líneas, cuadrículas, rondos)'}>
              Incluyendo porterías
              <Switch checked={court.goals !== false} onCheckedChange={(v) => set({ goals: v ? undefined : false })} aria-label="Incluyendo porterías" />
            </label>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" data-testid="tb-court-templates">
            <Thumb sport={sport} court={base} label="Cancha completa" active={!court.tpl && (court.cam ?? 'full') === 'full'}
              onClick={() => set({ tpl: undefined, cam: undefined })} testId="tb-tpl-full" />
            <Thumb sport={sport} court={{ ...base, cam: 'half_bottom' }} label="Media cancha" active={!court.tpl && court.cam === 'half_bottom'}
              onClick={() => set({ tpl: undefined, cam: 'half_bottom' })} testId="tb-tpl-half" />
            {templatesFor(sport).map((t) => (
              <Thumb key={t.id} sport={sport} court={{ ...base, tpl: t.id }} label={t.label} active={court.tpl === t.id}
                onClick={() => set({ tpl: t.id })} testId={`tb-tpl-${t.id}`} />
            ))}
          </div>
          {!goalsApply && (
            <p className="text-[11px] text-zinc-500">«Incluyendo porterías» agrega un arco en cada fondo de los lienzos de ejercicio; las canchas reglamentarias ya traen los suyos.</p>
          )}
        </section>

        <section className="mt-3">
          <h3 className="text-sm font-semibold mb-1.5">Cámara</h3>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cámara">
            {camerasFor(allowArea).map((c: CourtCamera) => (
              <button key={c} type="button" role="radio" aria-checked={(court.cam ?? 'full') === c} data-testid={`tb-cam-${c}`}
                onClick={() => set({ cam: c === 'full' ? undefined : c })}
                className={`h-8 px-3 rounded-full border text-xs ${(court.cam ?? 'full') === c ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold' : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'}`}>
                {CAMERA_LABEL[c]}
              </button>
            ))}
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-zinc-700">
            <Switch checked={court.orient === 'h'} onCheckedChange={(v) => set({ orient: v ? 'h' : undefined })} aria-label="Orientación horizontal" data-testid="tb-orient-h" />
            Horizontal (el arco rival a la derecha)
          </label>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            La orientación horizontal se aplica a la imagen, el PDF, el GIF, el video y las miniaturas. Para editar, la pizarra queda vertical.
          </p>
        </section>

        <section className="mt-3 space-y-2">
          <h3 className="text-sm font-semibold">Piso y colores</h3>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => set({ surface: undefined })} aria-pressed={!court.surface} data-testid="tb-surface-native"
              className={`h-8 px-3 rounded-full border text-xs ${!court.surface ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold' : 'border-zinc-300 text-zinc-700'}`}>
              El del deporte
            </button>
            {SURFACES.map((s) => (
              <button key={s} type="button" onClick={() => set({ surface: s })} aria-pressed={court.surface === s} data-testid={`tb-surface-${s}`}
                className={`h-8 pl-1.5 pr-3 rounded-full border text-xs flex items-center gap-1.5 ${court.surface === s ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold' : 'border-zinc-300 text-zinc-700'}`}>
                <span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: SURFACE_DEF[s].court }} />
                {SURFACE_LABEL[s]}
              </button>
            ))}
          </div>
          <Swatches label="Césped / piso" colors={GRASS_COLORS} value={court.grass} onPick={(c) => set({ grass: c })} />
          <Swatches label="Líneas" colors={LINE_COLORS} value={court.lines} onPick={(c) => set({ lines: c })} />
          <Swatches label="Contorno" colors={OUTLINE_COLORS} value={court.outline} onPick={(c) => set({ outline: c })} />
        </section>

        <div className="mt-3 flex justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({})} data-testid="tb-court-reset">
            <RotateCcw className="h-4 w-4 mr-1" /> Cancha de siempre
          </Button>
          <Button type="button" size="sm" onClick={() => onOpenChange(false)}>Listo</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
