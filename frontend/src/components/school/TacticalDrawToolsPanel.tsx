/**
 * M6d — panel de las herramientas nuevas en la pestaña «Líneas»: tipo de línea
 * con la convención de la leyenda, zonas (rectángulo / elipse / polígono),
 * resaltar jugador (foco) y numeración de movimientos. La pizarra lo monta con
 * una línea; el estado vive en useTacticalDrawTools.
 */
import { Hash, Sparkle } from 'lucide-react';
import type { TacticalArrow, TacticalShapeType } from '@/lib/school/footballQueries';
import {
  LINE_STYLE_HINT, LINE_STYLE_LABEL, LINE_STYLES, ZONE_FILL_DEFAULT, ZONE_FILL_MAX, ZONE_FILL_MIN, ZONE_FORM_LABEL, ZONE_FORMS,
  type LineStyle, type ZoneForm,
} from '@/lib/school/tacticalDrawing';
import type { TacticalDrawTools } from '@/lib/school/useTacticalDrawTools';
import { LineSample } from './tacticalM6dShapes';

const CHIP = 'rounded text-[10px] font-semibold border';
const ON = 'bg-emerald-600 border-emerald-500 text-white';
const OFF = 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10';

export function TacticalDrawToolsPanel({
  tools, drawMode, drawShapeType, pickTool, selected, selectedIndex, onUpdateShape, onRenumber, polygonPoints, onClosePolygon, onCancelPolygon, className = '',
}: {
  tools: TacticalDrawTools;
  drawMode: boolean;
  drawShapeType: TacticalShapeType | 'eraser';
  pickTool: (type: TacticalShapeType) => void;
  selected?: TacticalArrow;
  selectedIndex: number | null;
  onUpdateShape: (index: number, patch: Partial<TacticalArrow>) => void;
  onRenumber: () => void;
  polygonPoints: number;
  onClosePolygon: () => void;
  onCancelPolygon: () => void;
  className?: string;
}) {
  const lineTool = drawMode && (drawShapeType === 'arrow' || drawShapeType === 'curve');
  function chooseStyle(s: LineStyle | null) {
    tools.setLineStyle(s);
    pickTool(drawShapeType === 'curve' ? 'curve' : 'arrow');
  }
  function chooseZone(f: ZoneForm) {
    tools.setZoneForm(f);
    pickTool('zone');
  }
  const zoneSelected = selected?.type === 'zone' && selectedIndex !== null;
  return (
    <div className={className} data-testid="tb-m6d-tools">
      <p className="text-[10px] font-bold text-white/60 mb-1.5 uppercase tracking-widest">Tipo de línea</p>
      <div className="grid grid-cols-3 md:grid-cols-2 gap-1.5">
        <button type="button" onClick={() => chooseStyle(null)} aria-pressed={lineTool && tools.lineStyle === null}
          className={`h-8 px-1.5 ${CHIP} ${lineTool && tools.lineStyle === null ? ON : OFF}`}>
          Clásica
        </button>
        {LINE_STYLES.map((s) => (
          <button key={s} type="button" onClick={() => chooseStyle(s)} title={LINE_STYLE_HINT[s]} aria-pressed={lineTool && tools.lineStyle === s}
            data-line-style={s}
            className={`h-8 px-1.5 ${CHIP} flex items-center gap-1 min-w-0 ${lineTool && tools.lineStyle === s ? ON : OFF}`}>
            <svg viewBox="0 -5 30 10" className="h-2.5 w-6 shrink-0 overflow-visible" aria-hidden="true">
              <LineSample style={s} x={1} y={0} w={26} />
            </svg>
            <span className="truncate">{LINE_STYLE_LABEL[s]}</span>
          </button>
        ))}
      </div>
      <p className="hidden md:block text-[10px] text-white/70 mt-1 leading-snug">
        Vale para Flecha y Curva. La leyenda aparece sola en la cancha y en lo que exportes.
      </p>

      <p className="text-[10px] font-bold text-white/60 mt-3 mb-1.5 uppercase tracking-widest">Zonas</p>
      <div className="flex gap-1.5">
        {ZONE_FORMS.map((f) => (
          <button key={f} type="button" onClick={() => chooseZone(f)} data-zone-form={f}
            aria-pressed={drawMode && drawShapeType === 'zone' && tools.zoneForm === f}
            className={`flex-1 h-7 ${CHIP} ${drawMode && drawShapeType === 'zone' && tools.zoneForm === f ? ON : OFF}`}>
            {ZONE_FORM_LABEL[f]}
          </button>
        ))}
      </div>
      {drawMode && drawShapeType === 'zone' && tools.zoneForm === 'polygon' && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[10px] text-white/70 flex-1 leading-snug">
            {polygonPoints === 0 ? 'Toca la cancha para poner cada vértice; toca el primero para cerrar.' : `${polygonPoints} vértice${polygonPoints === 1 ? '' : 's'}`}
          </span>
          {polygonPoints >= 3 && (
            <button type="button" onClick={onClosePolygon} className={`h-7 px-2 ${CHIP} ${ON}`}>Cerrar zona</button>
          )}
          {polygonPoints > 0 && (
            <button type="button" onClick={onCancelPolygon} className={`h-7 px-2 ${CHIP} ${OFF}`}>Cancelar</button>
          )}
        </div>
      )}
      {zoneSelected && (
        <label className="mt-1.5 flex items-center gap-2 text-[10px] text-white/60">
          <span className="w-12 shrink-0">Relleno</span>
          <input type="range" min={ZONE_FILL_MIN} max={ZONE_FILL_MAX} step={0.01} aria-label="Relleno de la zona"
            value={selected!.fill ?? ZONE_FILL_DEFAULT}
            onChange={(e) => onUpdateShape(selectedIndex!, { fill: Number(e.target.value) })}
            className="flex-1 min-w-0 accent-emerald-500" />
        </label>
      )}

      <p className="text-[10px] font-bold text-white/60 mt-3 mb-1.5 uppercase tracking-widest">Resaltar y ordenar</p>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => pickTool('spotlight')} aria-pressed={drawMode && drawShapeType === 'spotlight'}
          className={`flex-1 h-8 ${CHIP} flex items-center justify-center gap-1 ${drawMode && drawShapeType === 'spotlight' ? ON : OFF}`}>
          <Sparkle className="h-3.5 w-3.5" /> Resaltar jugador
        </button>
        <button type="button" onClick={() => tools.setAutoNumber((v) => !v)} aria-pressed={tools.autoNumber}
          className={`flex-1 h-8 ${CHIP} flex items-center justify-center gap-1 ${tools.autoNumber ? ON : OFF}`}>
          <Hash className="h-3.5 w-3.5" /> Numerar
        </button>
      </div>
      {tools.autoNumber && (
        <button type="button" onClick={onRenumber} className="mt-1 text-[10px] text-emerald-300 underline underline-offset-2">
          Renumerar 1, 2, 3… en el orden en que se dibujaron
        </button>
      )}
      <p className="hidden md:block text-[10px] text-white/70 mt-1 leading-snug">
        El foco se pega al jugador que toques. Con «Numerar», cada flecha nueva lleva el número del movimiento.
      </p>
    </div>
  );
}
