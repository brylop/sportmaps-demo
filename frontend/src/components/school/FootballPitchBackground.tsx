/**
 * Fondo decorativo de cancha (SVG puro, sin interacción). El LineupModal
 * dibuja las bandas de jugadores encima, en un contenedor `relative`.
 */
export function FootballPitchBackground() {
  return (
    <svg
      viewBox="0 0 300 340"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full rounded-xl"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="300" height="340" fill="#1e7d32" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x="0" y={i * 68} width="300" height="34" fill="#22883a" opacity="0.4" />
      ))}
      <rect x="6" y="6" width="288" height="328" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="2" />
      <line x1="6" y1="170" x2="294" y2="170" stroke="white" strokeOpacity="0.55" strokeWidth="2" />
      <circle cx="150" cy="170" r="32" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="2" />
      <circle cx="150" cy="170" r="2.5" fill="white" fillOpacity="0.55" />
      {/* Área grande arriba (arco rival, referencia visual de orientación) */}
      <rect x="70" y="6" width="160" height="45" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="2" />
      <rect x="115" y="6" width="70" height="18" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="2" />
      {/* Área grande abajo (nuestro arco) */}
      <rect x="70" y="289" width="160" height="45" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="2" />
      <rect x="115" y="316" width="70" height="18" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="2" />
    </svg>
  );
}
