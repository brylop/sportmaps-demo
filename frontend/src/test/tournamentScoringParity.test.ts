import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// El motor de marcador vive en el BFF y se copia al frontend (cola offline del anotador).
// Si esta prueba falla: copiar bff/src/services/tournament/scoring.shared.ts a frontend/src/lib/tournamentScoring.ts.
describe('motor de marcador: BFF y frontend idénticos', () => {
  it('los dos archivos son iguales', () => {
    const norm = (p: string) => readFileSync(resolve(__dirname, p), 'utf8').replace(/\r\n/g, '\n');
    expect(norm('../lib/tournamentScoring.ts')).toBe(norm('../../../bff/src/services/tournament/scoring.shared.ts'));
  });
});
