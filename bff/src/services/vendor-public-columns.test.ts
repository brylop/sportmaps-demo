/**
 * Columnas públicas de vendor_profiles (tienda v2 F0, QA tienda-baseline-padre).
 *
 * GET /api/v1/marketplace/vendor/:slug es público. Si alguien vuelve a poner
 * select('*') o agrega bank_data / commission_rate / nit… a la lista, este test
 * se pone rojo. También barre las rutas públicas que leen vendor_profiles
 * (marketplace, og-preview, marketplace-catalog) buscando un select('*') o una
 * columna sensible, directa o embebida.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { VENDOR_PUBLIC_COLUMNS, VENDOR_SENSITIVE_COLUMNS } from './vendor-public-columns';

const columns = VENDOR_PUBLIC_COLUMNS.split(',').map((c) => c.trim());

describe('VENDOR_PUBLIC_COLUMNS', () => {
    it('no tiene comodín', () => {
        expect(VENDOR_PUBLIC_COLUMNS).not.toContain('*');
    });

    it.each([...VENDOR_SENSITIVE_COLUMNS])('no incluye %s', (col) => {
        expect(columns).not.toContain(col);
    });

    it('trae lo que la página pública necesita', () => {
        for (const c of ['id', 'display_name', 'slug', 'logo_url', 'verification_status']) {
            expect(columns).toContain(c);
        }
    });
});

const PUBLIC_ROUTE_FILES = [
    'marketplace.routes.ts',
    'og-preview.routes.ts',
    'marketplace-catalog.routes.ts',
];

/** Argumento de cada .select(...) que sigue a .from('vendor_profiles'). */
function directSelects(src: string): string[] {
    const out: string[] = [];
    const re = /\.from\(\s*['"]vendor_profiles['"]\s*\)\s*\.select\(\s*([^)]*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) out.push(m[1].trim());
    return out;
}

/** Columnas de cada embed vendor_profiles(...) / vendor_profiles!fk (...). */
function embeddedSelects(src: string): string[] {
    const out: string[] = [];
    const re = /vendor_profiles(?:!\w+)?\s*\(([^)]*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
        // Saltar el .from('vendor_profiles') (lo cubre directSelects).
        const before = src.slice(Math.max(0, m.index - 7), m.index);
        if (before.includes('from(')) continue;
        out.push(m[1]);
    }
    return out;
}

function sensitiveIn(selectArg: string): string[] {
    const cols = selectArg.replace(/['"`]/g, '').split(',').map((c) => c.trim().split(/\s|:/)[0]);
    return VENDOR_SENSITIVE_COLUMNS.filter((s) => cols.includes(s));
}

describe('rutas públicas que leen vendor_profiles', () => {
    for (const file of PUBLIC_ROUTE_FILES) {
        const src = readFileSync(join(__dirname, '..', 'routes', file), 'utf8');

        it(`${file}: ningún select('*') ni columna sensible`, () => {
            // El escáner tiene que ver cada .from('vendor_profiles') del archivo.
            const fromCount = (src.match(/\.from\(\s*['"]vendor_profiles['"]\s*\)/g) ?? []).length;
            expect(directSelects(src)).toHaveLength(fromCount);
            for (const arg of directSelects(src)) {
                expect(arg, `${file}: select(${arg})`).not.toMatch(/['"`]\s*\*\s*['"`]/);
                expect(sensitiveIn(arg), `${file}: select(${arg})`).toEqual([]);
            }
            for (const arg of embeddedSelects(src)) {
                expect(arg.trim(), `${file}: embed vendor_profiles(${arg})`).not.toBe('*');
                expect(sensitiveIn(arg), `${file}: embed vendor_profiles(${arg})`).toEqual([]);
            }
        });
    }

    it('GET /vendor/:slug usa VENDOR_PUBLIC_COLUMNS', () => {
        const src = readFileSync(join(__dirname, '..', 'routes', 'marketplace.routes.ts'), 'utf8');
        expect(src).toMatch(/\.from\('vendor_profiles'\)\s*\.select\(VENDOR_PUBLIC_COLUMNS\)/);
    });
});
