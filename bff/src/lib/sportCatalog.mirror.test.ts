/**
 * bff/src/lib/sportCatalog.ts es una COPIA IDÉNTICA de
 * frontend/src/lib/sports/sportCatalog.ts (el catálogo único de deportes, M1
 * de docs/specs/pizarra-multideporte-3d-ia.md). Si alguien cambia una sin la
 * otra, esto falla: se edita la del frontend y se copia aquí.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveSport, schoolBoardSports } from './sportCatalog';

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

describe('catálogo de deportes: espejo frontend ↔ BFF', () => {
  it('las dos copias son idénticas', () => {
    const bff = read(resolve(__dirname, 'sportCatalog.ts'));
    const front = read(resolve(__dirname, '../../../frontend/src/lib/sports/sportCatalog.ts'));
    expect(bff).toBe(front);
  });

  it('la copia del BFF resuelve igual (humo)', () => {
    expect(resolveSport('Fútbol Sala').key).toBe('futsal');
    expect(resolveSport('Cheerleading All-Star').key).toBe('cheerleading');
    expect(schoolBoardSports({ teams: [{ sport: 'Voleibol' }], schoolSports: ['Fútbol'] })).toEqual(['futbol', 'voleibol', 'generico']);
  });
});
