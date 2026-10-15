/**
 * sportFromTeam después de M1 (delega en el catálogo único) contra una copia
 * CONGELADA de la versión anterior (tacticalSports.ts hasta pizarra-tp/integracion,
 * dd2578cb). Para fútbol el resultado tiene que ser idéntico: cero regresión.
 */
import { describe, expect, it } from 'vitest';
import { sportFromTeam } from '@/lib/school/tacticalSports';
import { REAL_SPORT_TEXTS } from './fixtures/deportesReales';

// ─── Copia congelada (no tocar) ─────────────────────────────────────────────
type TacticalSport = 'futbol' | 'futbol7' | 'futbol5' | 'futsal' | 'voleibol' | 'baloncesto' | 'balonmano' | 'generico';
const DEFAULT_SPORT: TacticalSport = 'futbol';
/** Minúsculas, sin tildes y con `_` como espacio ("Fútbol Sala" y el slug
 *  "futbol_sala" → "futbol sala"). */
const norm = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/_/g, ' ').trim();

type Family = 'futbol' | 'futsal' | 'voleibol' | 'baloncesto' | 'balonmano';

function familyOf(text: string): Family | null {
  if (!text) return null;
  // Futsal ANTES que fútbol: "fútbol sala" contiene "fútbol".
  if (/\bfutsal\b|futbol\s*(de\s*)?sala|futbol\s*de\s*salon|micro\s*-?\s*futbol|\bmicro\b/.test(text)) return 'futsal';
  if (/volei|voley|volley|\bvolei?bol\b|voleibol/.test(text)) return 'voleibol';
  if (/balonce|basket|basquet|\bbasquetbol|\bbaloncesto/.test(text)) return 'baloncesto';
  if (/balonmano|handball|hand\s*ball/.test(text)) return 'balonmano';
  if (/futbol|soccer|\bfut\b/.test(text)) return 'futbol';
  return null;
}

/** Modalidad 7 / 5 / 11 escrita explícitamente ("F7", "Fútbol 7", "7 vs 7",
 *  "7x7"). OJO: "Sub 7" o "Sub-5" son categorías de EDAD, no modalidad. */
function footballSize(text: string): 7 | 5 | 11 | null {
  for (const n of [7, 5, 11] as const) {
    const re = new RegExp(
      `(^|[^a-z0-9])(f|fut|futbol|soccer)\\s*-?\\s*${n}(?![0-9])|(^|[^0-9])${n}\\s*(vs|v|x|contra)\\s*${n}(?![0-9])`,
    );
    if (re.test(text)) return n;
  }
  return null;
}

/**
 * Deporte de la pizarra para un equipo. Lee el NOMBRE VISIBLE del deporte
 * (`teams.sport` guarda "Fútbol", "Voleibol", "Baloncesto"…, no el slug) y,
 * si no alcanza, el nombre del equipo y de la categoría. "Fútbol Sala" y
 * "Microfútbol" = futsal. Fútbol 7/5 solo si está escrito ("F7", "Fútbol 5",
 * "7 vs 7"); "Sub 7" es edad y no cuenta. Lo que no tiene cancha propia
 * (natación, tenis, porrismo…) cae a 'generico'.
 */
function legacySportFromTeam(team: { sport?: string | null; name?: string | null; category_name?: string | null } | null | undefined): TacticalSport {
  if (!team) return DEFAULT_SPORT;
  const sport = norm(team.sport);
  const extra = `${norm(team.name)} ${norm(team.category_name)}`.trim();
  const family = familyOf(sport) ?? (sport ? null : familyOf(extra));
  if (!family) return sport ? 'generico' : DEFAULT_SPORT;
  if (family !== 'futbol') {
    return family;
  }
  // Fútbol: ¿el equipo/categoría dice futsal (deporte "Fútbol", equipo "Futsal Sub 12")?
  if (familyOf(extra) === 'futsal') return 'futsal';
  const size = footballSize(sport) ?? footballSize(extra);
  if (size === 7) return 'futbol7';
  if (size === 5) return 'futbol5';
  return 'futbol';
}
// ─── Fin de la copia ────────────────────────────────────────────────────────

type Team = { sport?: string | null; name?: string | null; category_name?: string | null } | null | undefined;

const FOOTBALL_SPORTS = ['Fútbol', 'Futbol', 'fútbol', 'FUTBOL', 'futbol', 'Soccer', 'Fútbol 11', 'Fútbol 7', 'Fútbol 5', 'Futbol 7'];
const TEAM_NAMES = [
  null, '', 'Sub 7', 'Sub-5', 'Sub 11 A', 'Categoría 2017', 'Fútbol 7 Sub 10', 'Pre-infantil F7', 'F5 mixto',
  'Fútbol 5 mixto', 'Fútbol 11 Juvenil', 'Futsal Sub 12', 'Microfútbol femenino', 'Fútbol de salón', '7 vs 7',
  '5x5 recreativo', 'Selección F-7', 'Escuela 2015', 'Arqueros', 'Mayores',
];
const CATEGORIES = [null, '7 vs 7', 'Sub-5', 'Infantil', 'Fútbol sala'];

const footballCases: Team[] = [];
for (const sport of FOOTBALL_SPORTS) {
  for (const name of TEAM_NAMES) {
    for (const category_name of CATEGORIES) footballCases.push({ sport, name, category_name });
  }
}
// Sin deporte: se mira el nombre (histórico).
for (const name of TEAM_NAMES) footballCases.push({ sport: null, name }, { sport: '', name });
footballCases.push({}, null, undefined);

describe('sportFromTeam: fútbol idéntico a antes de M1', () => {
  it(`${footballCases.length} combinaciones de deporte/equipo/categoría de fútbol`, () => {
    const diffs = footballCases
      .map((t) => ({ t, before: legacySportFromTeam(t), after: sportFromTeam(t) }))
      .filter((d) => d.before !== d.after);
    expect(diffs).toEqual([]);
  });

  it('casos clave (instantánea de la versión anterior)', () => {
    const snap: [Team, TacticalSport][] = [
      [{ sport: 'Fútbol' }, 'futbol'],
      [{ sport: 'Fútbol', name: 'Fútbol 7 Sub 10' }, 'futbol7'],
      [{ sport: 'Fútbol', name: 'Pre-infantil F7' }, 'futbol7'],
      [{ sport: 'Fútbol', category_name: '7 vs 7' }, 'futbol7'],
      [{ sport: 'Fútbol', name: 'Fútbol 5 mixto' }, 'futbol5'],
      [{ sport: 'Fútbol 7' }, 'futbol7'],
      [{ sport: 'Fútbol', name: 'Futsal Sub 12' }, 'futsal'],
      [{ sport: 'Fútbol', name: 'Fútbol 11 Juvenil' }, 'futbol'],
      [{ sport: 'Fútbol', name: 'Sub 7' }, 'futbol'],
      [{ sport: 'Fútbol', category_name: 'Sub-5' }, 'futbol'],
      [{ sport: '', name: 'Equipo A' }, 'futbol'],
      [null, 'futbol'],
    ];
    for (const [t, expected] of snap) {
      expect(legacySportFromTeam(t), JSON.stringify(t)).toBe(expected);
      expect(sportFromTeam(t), JSON.stringify(t)).toBe(expected);
    }
  });

  it('todos los textos reales de la base dan la misma cancha que antes', () => {
    const diffs = REAL_SPORT_TEXTS
      .map((r) => ({ text: r.text, before: legacySportFromTeam({ sport: r.text }), after: sportFromTeam({ sport: r.text }) }))
      .filter((d) => d.before !== d.after);
    expect(diffs).toEqual(EXPECTED_REAL_DIFFS);
  });

  it('mejoras a propósito (no son de un equipo de fútbol existente)', () => {
    // "F7" / "F5" escritos como deporte: antes no se reconocían (genérico).
    expect(legacySportFromTeam({ sport: 'F7' })).toBe('generico');
    expect(sportFromTeam({ sport: 'F7' })).toBe('futbol7');
    expect(sportFromTeam({ sport: 'F5' })).toBe('futbol5');
  });
});

/** Diferencias sobre los textos reales, a propósito:
 *  · «Minifutbol» (1 escuela en schools.sports, ningún equipo) es fútbol de
 *    cancha chica → Fútbol 5.
 *  · M6f: los de nivel «cancha» (Tenis, Pádel, Waterpolo, Rugby, Bádminton,
 *    Hockey sobre césped, Disco volador…) dejan el lienzo genérico y abren SU
 *    cancha. Ningún equipo de fútbol ni de pizarra completa cambia. */
const EXPECTED_REAL_DIFFS: { text: string; before: string; after: string }[] = REAL_SPORT_TEXTS
  .filter((r) => r.text === 'Minifutbol' || r.boardLevel === 'cancha')
  .map((r) => (r.text === 'Minifutbol'
    ? { text: r.text, before: 'futbol', after: 'futbol5' }
    : { text: r.text, before: 'generico', after: r.tacticalSport as string }));
