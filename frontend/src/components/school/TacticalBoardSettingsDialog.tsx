/**
 * Botón «Ajustes» (engranaje) del toolbar de la pizarra y su diálogo «Ajustes
 * de la pizarra» (M6g, docs/specs/pizarra-m6-paridad-tacticalpad.md §4). Como
 * el de TacticalPad, adaptado: filas grandes (≥ 44 px) para el dedo.
 *
 * La marca de agua de TacticalPad NO va: nuestras exportaciones llevan
 * «Powered by SportMaps» salvo marca blanca, y esa lógica no se toca acá.
 */
import { useId, useState, type ReactNode } from 'react';
import { Maximize2, Minimize2, Moon, Settings2, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { ANIMATION_CURVES, applyCurve, type AnimationCurve } from '@/lib/school/tacticalBoardSettings';
import type { TacticalBoardPrefs } from './tacticalBoardPrefs';

/** Miniatura de la curva (posición vs. tiempo). */
function CurveGlyph({ curve }: { curve: AnimationCurve }) {
  const pts = Array.from({ length: 21 }, (_, i) => {
    const t = i / 20;
    return `${(2 + t * 28).toFixed(1)},${(30 - applyCurve(curve, t) * 28).toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
      <path d="M2 30 H30 M2 30 V2" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1" fill="none" />
      <polyline points={pts} stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Row({ label, hint, checked, onChange, disabled }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={`flex min-h-11 items-center justify-between gap-3 py-1.5 ${disabled ? 'opacity-50' : ''}`}>
      <label htmlFor={id} className="flex-1 cursor-pointer text-sm leading-tight">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="divide-y divide-border/60">{children}</div>
    </section>
  );
}

export function TacticalBoardSettingsButton({ prefs, className, disabled, open: openProp, onOpenChange, hideTrigger = false }: {
  prefs: TacticalBoardPrefs;
  className?: string;
  disabled?: boolean;
  /** Controlado desde afuera (en el celular se abre desde «Más»). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Sin el botón del toolbar (en el celular el toolbar no da más). */
  hideTrigger?: boolean;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => { if (openProp === undefined) setOpenState(v); onOpenChange?.(v); };
  const { settings: s, update } = prefs;
  return (
    <>
      {!hideTrigger && <Button
        type="button"
        size="sm"
        variant="ghost"
        className={className}
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label="Ajustes de la pizarra"
        title="Ajustes de la pizarra"
      >
        <Settings2 className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">Ajustes</span>
      </Button>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajustes de la pizarra</DialogTitle>
            <DialogDescription>
              Son tuyos: valen para todas tus jugadas en este dispositivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <Section title="Animación">
              <div role="radiogroup" aria-label="Curva de velocidad" className="grid grid-cols-2 gap-2 py-2">
                {ANIMATION_CURVES.map((c) => {
                  const on = s.curve === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      title={c.hint}
                      onClick={() => update({ curve: c.id })}
                      className={`flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors ${
                        on ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100' : 'border-border hover:bg-muted'
                      }`}
                    >
                      <CurveGlyph curve={c.id} />
                      <span className="font-medium leading-tight">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="Rastros en la animación">
              <Row label="Ruta del jugador · equipo local" hint="El camino que ya recorrió, mientras se reproduce"
                checked={s.routeHome} onChange={(v) => update({ routeHome: v })} />
              <Row label="Ruta del jugador · equipo visitante"
                checked={s.routeAway} onChange={(v) => update({ routeAway: v })} />
              <Row label="Trayectoria del balón"
                checked={s.ballTrail} onChange={(v) => update({ ballTrail: v })} />
              <Row label="Trayectoria del balón discontinua" hint="Línea punteada en vez de continua"
                checked={s.ballTrailDashed} onChange={(v) => update({ ballTrailDashed: v })} disabled={!s.ballTrail} />
            </Section>

            <Section title="Balón y jugadores">
              <Row label="Definir la posesión del balón"
                hint="En cada cuadro eliges quién lo tiene: se mueve con él y se dibuja el pase"
                checked={s.possession} onChange={(v) => update({ possession: v })} />
              <Row label="Nombre del jugador siempre visible"
                checked={s.labelsAlways} onChange={(v) => update({ labelsAlways: v })} />
            </Section>

            <Section title="Vista">
              <div className="flex min-h-11 items-center justify-between gap-3 py-1.5">
                <span className="text-sm font-medium">Tema</span>
                <div role="radiogroup" aria-label="Tema de la pizarra" className="inline-flex rounded-lg border p-0.5">
                  {([['oscuro', 'Oscuro', Moon], ['claro', 'Claro', Sun]] as const).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={s.theme === id}
                      onClick={() => update({ theme: id })}
                      className={`flex min-h-10 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-md px-3 text-sm ${
                        s.theme === id ? 'bg-emerald-600 text-white' : 'hover:bg-muted'
                      }`}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex min-h-11 items-center justify-between gap-3 py-1.5">
                <span className="text-sm font-medium">
                  {prefs.fullscreen ? 'Pantalla completa' : 'Ventana'}
                </span>
                <Button type="button" variant="outline" className="min-h-11" onClick={() => { prefs.toggleFullscreen(); setOpen(false); }}>
                  {prefs.fullscreen
                    ? <><Minimize2 className="h-4 w-4" /> Volver a ventana</>
                    : <><Maximize2 className="h-4 w-4" /> Pantalla completa</>}
                </Button>
              </div>
            </Section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
