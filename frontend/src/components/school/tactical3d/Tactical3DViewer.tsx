/**
 * «Ver en 3D» (fase M4, decisión D5 de docs/specs/pizarra-multideporte-3d-ia.md):
 * VISOR, no editor. Reproduce los MISMOS cuadros de la pizarra con la MISMA
 * interpolación (tacticalAnimation.ts) sobre la cancha del deporte a escala
 * real, con cámara que se gira con el dedo o el mouse y tres cámaras fijas.
 *
 * Se carga en un chunk aparte (React.lazy desde Tactical3DLauncher): three.js
 * no entra al chunk de la pizarra. Cero almacenamiento: todo sale de los
 * cuadros.
 *
 * Caída a 2D: si el contexto WebGL2 no se puede crear (o se pierde), o si los
 * primeros 2 s promedian menos de 20 fps, llama `onFallback` y quien lo abrió
 * vuelve a la pizarra con el aviso.
 */
import { Component, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Pause, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  createPlaybackClock, frameStartMs, PLAYBACK_SPEEDS, totalDurationMs, type PlaybackSpeed,
} from '@/lib/school/tacticalAnimation';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import { sportDef, type TacticalSport } from '@/lib/school/tacticalSports';
import {
  CAMERA_MODES, cameraLabel, collectPlayerKeys, court3D, MIN_FPS, OVERLAY_COLOR, playerVisual,
  prefersReducedMotion, resolveCamera, TEAM_COLOR, type CameraMode, type PlayerVisual,
} from '@/lib/school/tactical3d';
import { Scene3D } from './Scene3D';
import { tactical3dStats } from './resources';

export type Tactical3DFallbackReason = 'webgl' | 'slow' | 'error';

export interface Tactical3DStats {
  fps: number;
  geometries: number;
  textures: number;
  programs: number;
}

export interface Tactical3DViewerProps {
  sport: TacticalSport | null | undefined;
  /** Cuadros de la jugada (al menos uno). */
  frames: TacticalFrame[];
  playerLabels?: Record<string, string>;
  playerJerseys?: Record<string, number | null>;
  /** Camiseta del equipo (el arquero va siempre en amarillo). */
  teamColor?: string;
  /** Segundo juego de cuadros encima, en otro color: el contraataque del rival
   *  que sugiere la IA (M3). Corre con el mismo reloj. */
  overlayFrames?: TacticalFrame[] | null;
  overlayColor?: string;
  overlayLabels?: Record<string, string>;
  overlayJerseys?: Record<string, number | null>;
  /** Leyenda de la superposición. */
  overlayName?: string;
  title?: string | null;
  onClose: () => void;
  onFallback: (reason: Tactical3DFallbackReason) => void;
  /** Piso de fps de los primeros 2 s (0 = no caer por lento; lo usan las pruebas). */
  minFps?: number;
  onStats?: (s: Tactical3DStats) => void;
  initialCamera?: CameraMode;
  initialTimeMs?: number;
  autoPlay?: boolean;
}

export default function Tactical3DViewer({
  sport, frames, playerLabels, playerJerseys, teamColor = TEAM_COLOR,
  overlayFrames = null, overlayColor = OVERLAY_COLOR, overlayLabels, overlayJerseys,
  overlayName = 'Contraataque del rival', title, onClose, onFallback, minFps = MIN_FPS, onStats,
  initialCamera = 'tribuna', initialTimeMs = 0, autoPlay = false,
}: Tactical3DViewerProps) {
  const court = useMemo(() => court3D(sport), [sport]);
  const def = sportDef(court.sport);
  const overlay = overlayFrames && overlayFrames.length > 0 ? overlayFrames : null;
  const totalMs = useMemo(() => Math.max(totalDurationMs(frames), overlay ? totalDurationMs(overlay) : 0), [frames, overlay]);
  const clock = useMemo(() => createPlaybackClock(Math.min(initialTimeMs, totalMs)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [playing, setPlaying] = useState(autoPlay && totalMs > 0);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [cameraMode, setCameraMode] = useState<CameraMode>(initialCamera);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  const keys = useMemo(() => collectPlayerKeys(frames), [frames]);
  const overlayKeys = useMemo(() => collectPlayerKeys(overlay), [overlay]);
  const visuals = useMemo(() => {
    const out: Record<string, PlayerVisual> = {};
    for (const k of keys) out[k] = playerVisual(k, { labels: playerLabels, jerseys: playerJerseys, color: teamColor, sport: court.sport });
    return out;
  }, [keys, playerLabels, playerJerseys, teamColor, court.sport]);
  const overlayVisuals = useMemo(() => {
    const out: Record<string, PlayerVisual> = {};
    // El rival va todo del color de la superposición (sin amarillo de arquero).
    for (const k of overlayKeys) out[k] = { ...playerVisual(k, { labels: overlayLabels, jerseys: overlayJerseys, color: overlayColor, sport: 'generico' }), color: overlayColor };
    return out;
  }, [overlayKeys, overlayLabels, overlayJerseys, overlayColor]);

  const resolved = resolveCamera(cameraMode, selectedKey, keys);

  // ─── Caída a 2D ──
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const fallbackRef = useRef(onFallback);
  fallbackRef.current = onFallback;
  const fallback = useCallback((reason: Tactical3DFallbackReason) => {
    if (mounted.current) fallbackRef.current(reason);
  }, []);
  const statsRef = useRef(onStats);
  statsRef.current = onStats;
  const onFpsVerdict = useCallback((verdict: 'ok' | 'slow', fps: number, info: Omit<Tactical3DStats, 'fps'>) => {
    statsRef.current?.({ fps, ...info });
    if (verdict === 'slow') fallback('slow');
  }, [fallback]);

  const onEnded = useCallback(() => setPlaying(false), []);
  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    if (clock.get() >= totalMs) clock.set(0);
    setPlaying(true);
  };

  const animated = frames.length > 1 || !!overlay;
  const fxLabel = def.label;

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950 text-white" data-testid="tactical-3d-viewer">
      <CanvasBoundary onError={() => fallback('error')}>
        <Canvas
          className="!absolute inset-0"
          dpr={[1, 2]}
          camera={{ fov: 45, near: 0.1, far: 3000, position: [0, court.lengthM, court.lengthM] }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            tactical3dStats.contextsCreated += 1;
            const canvas = gl.domElement;
            canvas.addEventListener('webglcontextlost', () => {
              tactical3dStats.contextsLost += 1;
              fallback('webgl');
            }, { once: true });
            if (!gl.capabilities.isWebGL2) fallback('webgl');
          }}
        >
          <Scene3D
            court={court}
            frames={frames}
            overlayFrames={overlay}
            overlayColor={overlayColor}
            keys={keys}
            overlayKeys={overlayKeys}
            visuals={visuals}
            overlayVisuals={overlayVisuals}
            clock={clock}
            playing={playing}
            speed={speed}
            totalMs={totalMs}
            onEnded={onEnded}
            cameraMode={resolved.mode}
            playerKey={resolved.playerKey}
            onSelectPlayer={(k) => setSelectedKey(k)}
            reducedMotion={reducedMotion}
            minFps={minFps}
            onFpsVerdict={onFpsVerdict}
          />
        </Canvas>
      </CanvasBoundary>

      {/* Arriba: título, cámaras y cerrar. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 break-words text-sm font-bold">{title || 'Jugada en 3D'}</p>
            <p className="text-xs text-white/75">{fxLabel} · gira la cámara arrastrando con el dedo o el mouse</p>
          </div>
          <Button
            type="button"
            onClick={onClose}
            className="pointer-events-auto h-11 min-w-11 gap-1.5 bg-white/15 px-3 text-white hover:bg-white/25"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Volver a 2D
          </Button>
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5" role="group" aria-label="Cámara">
          {CAMERA_MODES.map((m) => (
            <Button
              key={m}
              type="button"
              aria-pressed={cameraMode === m}
              onClick={() => setCameraMode(m)}
              className={cn('h-11 px-3 text-xs', cameraMode === m ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-white/10 text-white hover:bg-white/20')}
            >
              {cameraLabel(m, court.sport)}
            </Button>
          ))}
          {cameraMode === 'jugador' && keys.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs">
              <span className="sr-only sm:not-sr-only">Jugador</span>
              <select
                className="h-11 rounded-md border border-white/20 bg-slate-900 px-2 text-xs text-white"
                value={resolved.playerKey ?? ''}
                onChange={(e) => setSelectedKey(e.target.value)}
                aria-label="Jugador de la vista"
              >
                {keys.map((k) => (
                  <option key={k} value={k}>{playerOptionLabel(visuals[k], keys.indexOf(k))}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {overlay && (
          <p className="flex items-center gap-1.5 text-xs text-white/85">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: overlayColor }} aria-hidden="true" />
            {overlayName}
          </p>
        )}
      </div>

      {/* Abajo: reproducción. */}
      {animated && totalMs > 0 && (
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-gradient-to-t from-black/75 to-transparent p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            onClick={togglePlay}
            className="h-11 min-w-11 gap-1.5 bg-emerald-600 px-4 text-white hover:bg-emerald-500"
          >
            {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            {playing ? 'Pausar' : 'Reproducir'}
          </Button>
          <div className="flex items-center gap-1" role="group" aria-label="Velocidad">
            {PLAYBACK_SPEEDS.map((s) => (
              <Button
                key={s}
                type="button"
                aria-pressed={speed === s}
                aria-label={`Velocidad ${String(s).replace('.', ',')} veces`}
                onClick={() => setSpeed(s)}
                className={cn('h-11 min-w-11 px-2 text-xs', speed === s ? 'bg-white text-slate-900 hover:bg-white/90' : 'bg-white/10 text-white hover:bg-white/20')}
              >
                {String(s).replace('.', ',')}×
              </Button>
            ))}
          </div>
          <Timeline clock={clock} frames={frames} totalMs={totalMs} onSeek={() => setPlaying(false)} />
        </div>
      )}
    </div>
  );
}

function playerOptionLabel(v: PlayerVisual | undefined, i: number) {
  if (!v) return `Jugador ${i + 1}`;
  const parts = [v.number, v.label].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : `Jugador ${i + 1}`;
}

function Timeline({ clock, frames, totalMs, onSeek }: {
  clock: ReturnType<typeof createPlaybackClock>; frames: TacticalFrame[]; totalMs: number; onSeek: () => void;
}) {
  const t = useSyncExternalStore(clock.subscribe, clock.get);
  let index = 0;
  for (let i = 0; i < frames.length; i++) if (t >= frameStartMs(frames, i)) index = i;
  return (
    <div className="flex min-w-44 flex-1 items-center gap-2">
      <input
        type="range"
        min={0}
        max={totalMs}
        step={10}
        value={Math.round(t)}
        onChange={(e) => { onSeek(); clock.set(Number(e.target.value)); }}
        aria-label="Línea de tiempo de la jugada"
        className="h-11 flex-1 accent-emerald-500"
      />
      <span className="whitespace-nowrap text-xs tabular-nums text-white/85">
        Cuadro {index + 1} de {frames.length}
      </span>
    </div>
  );
}

/** Si three revienta (sin WebGL2, driver roto), se cae a 2D en vez de dejar
 *  la pantalla en negro. */
class CanvasBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}
