/**
 * Ajustes de la pizarra (M6g) del lado de React: el hook que usa el tablero,
 * el contexto que leen las fichas y la etiqueta de nombre siempre visible.
 *
 * El tablero solo tiene que:
 *   const prefs = useTacticalBoardPrefs();
 *   <TacticalBoardPrefsProvider value={prefs}> … </TacticalBoardPrefsProvider>
 *   <DialogContent data-board-theme={prefs.settings.theme} style={{ …, ...prefs.contentStyle }}>
 *   <TacticalBoardSettingsButton prefs={prefs} />
 *   <PinNameTag name={subject.full_name} />   (en PitchPin / PlaybackPin)
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTacticalBoardSettings } from '@/hooks/useTacticalBoardSettings';
import { playbackOptionsOf, type TacticalBoardSettings, type TacticalPlaybackOptions } from '@/lib/school/tacticalBoardSettings';
import {
  FALLBACK_FULLSCREEN_STYLE, enterBoardFullscreen, exitBoardFullscreen, isNativeFullscreen, type FullscreenMode,
} from '@/lib/school/boardFullscreen';
import './tacticalBoardTheme.css';

export interface TacticalBoardPrefs {
  settings: TacticalBoardSettings;
  update: (patch: Partial<TacticalBoardSettings>) => void;
  /** Para la capa de reproducción, el GIF/video y el 3D. */
  playback: TacticalPlaybackOptions;
  /** null = ventana normal. */
  fullscreen: FullscreenMode | null;
  toggleFullscreen: () => void;
  /** Estilo extra del DialogContent (la ventana fija de iOS). */
  contentStyle: CSSProperties | undefined;
}

/** Pantalla completa: nativa si se puede, ventana fija si no. Sale al cerrar
 *  la pizarra (`open` en false) y se entera del Esc del navegador. */
export function useBoardFullscreen(open = true): { mode: FullscreenMode | null; toggle: () => void } {
  const [mode, setMode] = useState<FullscreenMode | null>(null);

  useEffect(() => {
    const onChange = () => {
      setMode((m) => (m === 'native' && !isNativeFullscreen() ? null : m));
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => {
    if (open || !modeRef.current) return;
    if (modeRef.current === 'native') void exitBoardFullscreen();
    setMode(null);
  }, [open]);

  const toggle = useCallback(() => {
    if (mode) {
      if (mode === 'native') void exitBoardFullscreen();
      setMode(null);
      return;
    }
    void enterBoardFullscreen().then(setMode);
  }, [mode]);

  return { mode, toggle };
}

export function useTacticalBoardPrefs(open = true): TacticalBoardPrefs {
  const { settings, update } = useTacticalBoardSettings();
  const fs = useBoardFullscreen(open);
  const playback = useMemo(() => playbackOptionsOf(settings), [settings]);
  return {
    settings,
    update,
    playback,
    fullscreen: fs.mode,
    toggleFullscreen: fs.toggle,
    contentStyle: fs.mode === 'fallback' ? (FALLBACK_FULLSCREEN_STYLE as CSSProperties) : undefined,
  };
}

const PrefsContext = createContext<TacticalBoardPrefs | null>(null);
export const TacticalBoardPrefsProvider = PrefsContext.Provider;

/** Ajustes de la pizarra que envuelve al componente (null fuera de una). */
export function useBoardPrefsContext(): TacticalBoardPrefs | null {
  return useContext(PrefsContext);
}

/** «Juan Pérez» → «Juan P.»: cabe bajo la ficha sin tapar a los vecinos. */
export function shortPlayerName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** Nombre del jugador bajo la ficha, solo con «Etiqueta de nombre siempre
 *  visible» prendido. Fuera del proveedor no pinta nada. */
export function PinNameTag({ name }: { name: string | null | undefined }) {
  const prefs = useBoardPrefsContext();
  if (!prefs?.settings.labelsAlways || !name) return null;
  return (
    <span
      data-testid="pin-name-tag"
      className="pointer-events-none text-[10px] font-semibold text-white bg-sky-700/85 rounded px-1.5 py-px leading-tight max-w-[96px] truncate shadow"
    >
      {shortPlayerName(name)}
    </span>
  );
}
