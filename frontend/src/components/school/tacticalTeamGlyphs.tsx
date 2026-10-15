/**
 * Fichas y escudos de la «Configuración de los equipos» (M6b de
 * docs/specs/pizarra-m6-paridad-tacticalpad.md). SVG puro y autocontenido
 * (sin clases, sin clipPath en las fichas): se dibuja igual en la pizarra, en
 * TacticalStaticSvg (renderToStaticMarkup → PNG/PDF/video) y en la vista
 * previa del diálogo. Solo exporta componentes (Fast Refresh); el modelo vive
 * en lib/school/tacticalTeams.ts.
 *
 * Solo se usan cuando la jugada TIENE `teams`: sin configuración la pizarra
 * sigue con sus dibujos de siempre (tacticalGlyphs.tsx).
 */
import { useId } from 'react';
import type { ChipLook, CrestDesign, CrestShape, RivalSlot, TacticalTeamsConfig, TeamCrest } from '@/lib/school/tacticalTeams';
import { chipCaption, chipInnerText, chipLook, outlineFor, readableOn } from '@/lib/school/tacticalTeams';
import { SilhouetteGlyph } from './tacticalGlyphs';

const FONT = 'Helvetica, Arial, sans-serif';

/** Franjas de un círculo de radio r SIN clipPath (cada franja es el trozo de
 *  círculo entre dos rectas): así el SVG serializado no depende de ids. */
function stripePaths(r: number, vertical: boolean, bands = 5): string[] {
  const out: string[] = [];
  const w = (2 * r) / bands;
  for (let b = 1; b < bands; b += 2) {
    const a = -r + b * w;
    const c = a + w;
    const ya = Math.sqrt(Math.max(0, r * r - a * a));
    const yc = Math.sqrt(Math.max(0, r * r - c * c));
    const f = (n: number) => Math.round(n * 100) / 100;
    out.push(vertical
      ? `M ${f(a)} ${f(-ya)} A ${r} ${r} 0 0 1 ${f(c)} ${f(-yc)} L ${f(c)} ${f(yc)} A ${r} ${r} 0 0 1 ${f(a)} ${f(ya)} Z`
      : `M ${f(ya)} ${f(a)} A ${r} ${r} 0 0 1 ${f(yc)} ${f(c)} L ${f(-yc)} ${f(c)} A ${r} ${r} 0 0 1 ${f(-ya)} ${f(a)} Z`);
  }
  return out;
}

/** Ficha de un jugador centrada en 0,0. `r` = radio del disco (11 = el pin
 *  de siempre en unidades del viewBox 300×340). */
export function TeamChipGlyph({ look, text, r = 11 }: { look: ChipLook; text: string; r?: number }) {
  const k = r / 11;
  const fs = (text.length > 2 ? 7 : 8.5) * k;
  const label = text ? (
    <text x={0} y={look.style === 'jersey' ? 1.6 * k : 0} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight={900}
      fontFamily={FONT} fill={look.text} stroke={look.outline} strokeWidth={0.55 * k} strokeOpacity={0.7} paintOrder="stroke">
      {text}
    </text>
  ) : null;

  if (look.style === 'silhouette') {
    const s = 0.55 * k;
    return (
      <g data-chip="silhouette">
        <g transform={`translate(${-20 * s} ${-22 * s}) scale(${s})`}>
          <SilhouetteGlyph jersey={look.fill} accent={look.accent} number={text || null} numberColor={look.text} numberOutline={look.outline} />
        </g>
      </g>
    );
  }

  if (look.style === 'jersey') {
    const p = (x: number, y: number) => `${x * k} ${y * k}`;
    const body = `M ${p(-5, -10.5)} L ${p(5, -10.5)} L ${p(11.5, -6)} L ${p(8.8, -1)} L ${p(6.8, -2.4)} L ${p(6.8, 10.5)} L ${p(-6.8, 10.5)} L ${p(-6.8, -2.4)} L ${p(-8.8, -1)} L ${p(-11.5, -6)} Z`;
    return (
      <g data-chip="jersey">
        <path d={body} transform={`translate(0 ${1.2 * k})`} fill="#000" opacity={0.35} />
        <path d={body} fill={look.fill} stroke="#ffffff" strokeOpacity={0.85} strokeWidth={1.2 * k} strokeLinejoin="round" />
        <path d={`M ${p(-5, -10.5)} Q ${p(0, -5.5)} ${p(5, -10.5)}`} fill="none" stroke={look.accent} strokeWidth={1.6 * k} />
        <path d={`M ${p(11.5, -6)} L ${p(8.8, -1)} M ${p(-11.5, -6)} L ${p(-8.8, -1)}`} stroke={look.accent} strokeWidth={1.6 * k} strokeLinecap="round" />
        {label}
      </g>
    );
  }

  const striped = look.style === 'stripes_v' || look.style === 'stripes_h';
  return (
    <g data-chip={look.style}>
      <circle cx={0} cy={1.2 * k} r={r} fill="#000" opacity={0.35} />
      <circle cx={0} cy={0} r={r} fill={look.fill} />
      {striped && stripePaths(r, look.style === 'stripes_v').map((d, i) => <path key={i} d={d} fill={look.accent} />)}
      {/* Rayas: el número va sobre un parche liso del color principal (se lee siempre). */}
      {striped && text ? <circle cx={0} cy={0} r={r * 0.6} fill={look.fill} stroke={look.accent} strokeWidth={0.5 * k} /> : null}
      <circle cx={0} cy={0} r={r} fill="none" stroke="#ffffff" strokeOpacity={0.85} strokeWidth={1.6 * k} />
      {label}
    </g>
  );
}

/** Etiqueta bajo la ficha (misma píldora que TacticalStaticSvg). `top` = y del
 *  borde de arriba de la píldora. */
export function TeamCaptionGlyph({ text, top, scale = 1 }: { text: string; top: number; scale?: number }) {
  if (!text) return null;
  const shown = text.length > 14 ? `${text.slice(0, 13)}…` : text;
  const w = Math.min(44, Math.max(14, shown.length * 3.1 + 6)) * scale;
  const h = 7.5 * scale;
  return (
    <g data-caption="true">
      <rect x={-w / 2} y={top} width={w} height={h} rx={h / 2} fill="#000" fillOpacity={0.55} />
      <text x={0} y={top + h / 2} textAnchor="middle" dominantBaseline="central" fontSize={5.2 * scale} fontWeight={700}
        fontFamily={FONT} fill="#ffffff">
        {shown}
      </text>
    </g>
  );
}

/** Ficha + etiqueta, centrada en (x, y). */
export function TeamPlayerGlyph({ x, y, look, text, caption, r = 11 }: {
  x: number; y: number; look: ChipLook; text: string; caption: string; r?: number;
}) {
  const k = r / 11;
  const bottom = look.style === 'silhouette' ? 12.4 * k : r;
  return (
    <g transform={`translate(${x} ${y})`} data-player="true">
      <TeamChipGlyph look={look} text={text} r={r} />
      <TeamCaptionGlyph text={caption} top={bottom + 1.5 * k} scale={k} />
    </g>
  );
}

// ─── Escudos ────────────────────────────────────────────────────────────────

const SHAPE_PATH: Record<CrestShape, string> = {
  shield: 'M20 2 L37 8 L37 24 Q37 38 20 46 Q3 38 3 24 L3 8 Z',
  circle: 'M20 5 A19 19 0 1 1 19.99 5 Z',
  square: 'M8 5 H32 Q37 5 37 10 V38 Q37 43 32 43 H8 Q3 43 3 38 V10 Q3 5 8 5 Z',
  diamond: 'M20 2 L38 24 L20 46 L2 24 Z',
};

function designShapes(design: CrestDesign, color: string) {
  switch (design) {
    case 'stripes': return [9, 17, 25, 33].filter((_, i) => i % 2 === 0).map((x) => <rect key={x} x={x} y={0} width={6} height={48} fill={color} />);
    case 'band': return <path d="M0 14 L40 34 L40 44 L0 24 Z" fill={color} />;
    case 'chevron': return <path d="M0 18 L20 30 L40 18 L40 27 L20 39 L0 27 Z" fill={color} />;
    case 'halves': return <rect x={20} y={0} width={20} height={48} fill={color} />;
    case 'cross': return <g fill={color}><rect x={16} y={0} width={8} height={48} /><rect x={0} y={18} width={40} height={8} /></g>;
    case 'star': return <polygon points="20,9 23.5,18 33,18 25.5,24 28.5,33.5 20,28 11.5,33.5 14.5,24 7,18 16.5,18" fill={color} />;
    default: return null;
  }
}

/** Escudo en una caja 40×48. Propio: el logo de la escuela (si hay); rival:
 *  escudo GENÉRICO (forma + diseño + iniciales). Nunca una imagen subida. */
export function CrestGlyph({ crest, primary, secondary, numberColor, logoUrl, size = 40, title }: {
  crest: TeamCrest; primary: string; secondary: string; numberColor: string; logoUrl?: string | null; size?: number; title?: string;
}) {
  const clip = `crest-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const h = Math.round(size * 1.2);
  if (crest.kind === 'school_logo' && logoUrl) {
    return (
      <svg width={size} height={h} viewBox="0 0 40 48" role="img" aria-label={title ?? 'Escudo'}>
        <defs><clipPath id={clip}><path d={SHAPE_PATH.shield} /></clipPath></defs>
        <path d={SHAPE_PATH.shield} fill="#ffffff" />
        <image href={logoUrl} x={4} y={4} width={32} height={40} preserveAspectRatio="xMidYMid meet" clipPath={`url(#${clip})`} />
        <path d={SHAPE_PATH.shield} fill="none" stroke={primary} strokeWidth={2} />
      </svg>
    );
  }
  const shape = crest.kind === 'generated' ? crest.shape : 'shield';
  const design = crest.kind === 'generated' ? crest.design : 'plain';
  const initials = crest.kind === 'generated' ? crest.initials : (title ?? '').slice(0, 2).toUpperCase();
  const textBg = design === 'halves' || design === 'cross' ? [primary, secondary] : [primary];
  const fill = readableOn(numberColor, textBg);
  return (
    <svg width={size} height={h} viewBox="0 0 40 48" role="img" aria-label={title ?? 'Escudo'}>
      <defs><clipPath id={clip}><path d={SHAPE_PATH[shape]} /></clipPath></defs>
      <path d={SHAPE_PATH[shape]} fill={primary} />
      <g clipPath={`url(#${clip})`}>{designShapes(design, secondary)}</g>
      <path d={SHAPE_PATH[shape]} fill="none" stroke="#ffffff" strokeOpacity={0.9} strokeWidth={1.6} />
      {initials && (
        <text x={20} y={25} textAnchor="middle" dominantBaseline="central" fontSize={initials.length > 2 ? 11 : 14} fontWeight={900}
          fontFamily={FONT} fill={fill} stroke={outlineFor(fill)} strokeWidth={0.8} strokeOpacity={0.7} paintOrder="stroke">
          {initials}
        </text>
      )}
    </svg>
  );
}

/** Ficha de un rival (figura `opponent`) con la configuración del equipo de
 *  afuera. Se pasa como `override` de ObjectIcon. */
export function RivalChip({ teams, slot }: { teams: TacticalTeamsConfig; slot: RivalSlot | undefined }) {
  const away = teams.away;
  const s = slot ?? { ordinal: 0, isGK: false, number: '', alias: '' };
  const subject = { number: s.number || null, name: s.alias || null, position: null };
  return (
    <TeamPlayerGlyph x={0} y={0} r={10} look={chipLook(away, s.isGK)} text={chipInnerText(away, subject)} caption={chipCaption(away, subject)} />
  );
}
