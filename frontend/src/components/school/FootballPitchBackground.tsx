/**
 * Fondo decorativo de cancha (SVG puro, sin interacción). El LineupModal y el
 * TacticalBoard dibujan encima, en un contenedor `relative` -- el viewBox y
 * las posiciones de las líneas NO cambian entre versiones, solo el estilo
 * visual, para no romper a ninguno de los dos consumidores.
 */
export function FootballPitchBackground() {
  return (
    <svg
      viewBox="0 0 300 340"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full rounded-xl"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="pitch-glow" cx="50%" cy="38%" r="75%">
          <stop offset="0%" stopColor="#2fa84f" />
          <stop offset="55%" stopColor="#1f8a3f" />
          <stop offset="100%" stopColor="#0e5c28" />
        </radialGradient>
        <linearGradient id="pitch-vignette" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.28" />
          <stop offset="14%" stopColor="#000" stopOpacity="0" />
          <stop offset="86%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="300" height="340" fill="url(#pitch-glow)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x="0" y={i * 68} width="300" height="34" fill="#ffffff" opacity={i % 2 === 0 ? 0.05 : 0} />
      ))}
      <rect x="0" y="0" width="300" height="340" fill="url(#pitch-vignette)" />

      <rect x="6" y="6" width="288" height="328" fill="none" stroke="white" strokeOpacity="0.65" strokeWidth="1.75" />
      <line x1="6" y1="170" x2="294" y2="170" stroke="white" strokeOpacity="0.65" strokeWidth="1.75" />
      <circle cx="150" cy="170" r="32" fill="none" stroke="white" strokeOpacity="0.65" strokeWidth="1.75" />
      <circle cx="150" cy="170" r="2.5" fill="white" fillOpacity="0.65" />
      {/* Área grande arriba (arco rival, referencia visual de orientación) */}
      <rect x="70" y="6" width="160" height="45" fill="none" stroke="white" strokeOpacity="0.65" strokeWidth="1.75" />
      <rect x="115" y="6" width="70" height="18" fill="none" stroke="white" strokeOpacity="0.65" strokeWidth="1.75" />
      <path d="M 125 51 A 25 25 0 0 0 175 51" fill="none" stroke="white" strokeOpacity="0.65" strokeWidth="1.75" />
      {/* Área grande abajo (nuestro arco) */}
      <rect x="70" y="289" width="160" height="45" fill="none" stroke="white" strokeOpacity="0.65" strokeWidth="1.75" />
      <rect x="115" y="316" width="70" height="18" fill="none" stroke="white" strokeOpacity="0.65" strokeWidth="1.75" />
      <path d="M 125 289 A 25 25 0 0 1 175 289" fill="none" stroke="white" strokeOpacity="0.65" strokeWidth="1.75" />
      {/* Esquinas */}
      <path d="M 6 14 A 8 8 0 0 1 14 6" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" />
      <path d="M 286 6 A 8 8 0 0 1 294 14" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" />
      <path d="M 294 326 A 8 8 0 0 1 286 334" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" />
      <path d="M 14 334 A 8 8 0 0 1 6 326" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" />
    </svg>
  );
}
