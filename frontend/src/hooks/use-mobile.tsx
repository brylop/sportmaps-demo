import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/**
 * Celular girado (horizontal): táctil y de poco alto. El ancho pasa de 768 px
 * (iPhone Pro Max horizontal = 926 px) y `useIsMobile` dice "escritorio", pero
 * el alto sigue siendo ~400 px: los paneles y menús pensados para un monitor no
 * caben. Se exige puntero táctil para no tocar una ventana de escritorio baja.
 */
const COMPACT_LANDSCAPE_QUERY = "(orientation: landscape) and (max-height: 500px) and (pointer: coarse)";

export function useCompactLandscape() {
  const get = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(COMPACT_LANDSCAPE_QUERY).matches
      : false;
  const [match, setMatch] = React.useState<boolean>(get);

  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(COMPACT_LANDSCAPE_QUERY);
    const onChange = () => setMatch(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return match;
}
