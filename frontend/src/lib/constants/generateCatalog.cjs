// Generator script for sportsCatalog.ts
// Run: node generateCatalog.cjs
const fs = require('fs');
const path = require('path');

const TYPES = `// ═══════════════════════════════════════════════════════════════════════════════
// CATÁLOGO GLOBAL DE DEPORTES — Filtrado LATAM
// Fuente: IOC, ASOIF, ARISF, AIMS, IPC, Federaciones Internacionales
// Generado: 2026-03-10
// ═══════════════════════════════════════════════════════════════════════════════

export type CategoriaGlobal =
  | 'olimpicos_verano'
  | 'olimpicos_invierno'
  | 'paralimpicos'
  | 'reconocidos_COI_no_olimpicos'
  | 'no_olimpicos_federacion_internacional'
  | 'deportes_mentales_y_estrategia'
  | 'deportes_motorizados'
  | 'artes_marciales_y_combate'
  | 'deportes_de_naturaleza';

export interface SportCatalogEntry {
  id: number;
  nombre: string;
  nombreIngles: string;
  slug: string;
  federacion: string;
  acronimo: string;
  estadoOlimpico: string;
  categoriaGlobal: CategoriaGlobal;
  categoriasCompetencia: Record<string, string[] | Record<string, unknown>>;
}

`;

function makeSlug(nombre) {
    return nombre
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}

function categoriaGlobal(sport) {
    const e = sport.estado_olimpico || '';
    if (e.includes('Paralímpico')) return 'paralimpicos';
    if (e.includes('Olímpico de Verano') || e.includes('Olímpico LA2028') || e.includes('Paris 2024')) return 'olimpicos_verano';
    if (e.includes('Reconocido COI')) return 'reconocidos_COI_no_olimpicos';
    if (['MMA', 'Muay Thai', 'Kickboxing', 'Wushu', 'Ju-Jitsu', 'Grappling', 'Karate'].some(x => sport.nombre.includes(x)))
        return 'artes_marciales_y_combate';
    if (['Automovilismo', 'Motociclismo'].some(x => sport.nombre.includes(x))) return 'deportes_motorizados';
    if (['Ajedrez', 'Esports'].some(x => sport.nombre.includes(x))) return 'deportes_mentales_y_estrategia';
    return 'no_olimpicos_federacion_internacional';
}

function serializeCategories(cats, indent) {
    const lines = [];
    for (const [key, val] of Object.entries(cats)) {
        if (Array.isArray(val)) {
            const singleLine = JSON.stringify(val);
            if (singleLine.length < 120) {
                lines.push(indent + key + ': ' + singleLine + ',');
            } else {
                lines.push(indent + key + ': [');
                val.forEach(v => lines.push(indent + '  ' + JSON.stringify(v) + ','));
                lines.push(indent + '],');
            }
        } else if (typeof val === 'object' && val !== null) {
            lines.push(indent + key + ': {');
            lines.push(...serializeNestedObject(val, indent + '  '));
            lines.push(indent + '},');
        } else {
            lines.push(indent + key + ': ' + JSON.stringify(val) + ',');
        }
    }
    return lines;
}

function serializeNestedObject(obj, indent) {
    const lines = [];
    for (const [key, val] of Object.entries(obj)) {
        if (Array.isArray(val)) {
            if (val.length > 0 && typeof val[0] === 'object') {
                lines.push(indent + JSON.stringify(key) + ': [');
                val.forEach(item => lines.push(indent + '  ' + JSON.stringify(item) + ','));
                lines.push(indent + '],');
            } else {
                const singleLine = JSON.stringify(val);
                if (singleLine.length < 120) {
                    lines.push(indent + JSON.stringify(key) + ': ' + singleLine + ',');
                } else {
                    lines.push(indent + JSON.stringify(key) + ': [');
                    val.forEach(v => lines.push(indent + '  ' + JSON.stringify(v) + ','));
                    lines.push(indent + '],');
                }
            }
        } else if (typeof val === 'object' && val !== null) {
            lines.push(indent + JSON.stringify(key) + ': {');
            lines.push(...serializeNestedObject(val, indent + '  '));
            lines.push(indent + '},');
        } else {
            lines.push(indent + JSON.stringify(key) + ': ' + JSON.stringify(val) + ',');
        }
    }
    return lines;
}

// IDs to INCLUDE (LATAM-relevant)
const LATAM_IDS = new Set([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
    41, 42, 43, 44, 45,
    61, 63, 65, 66, 67, 68, 69, 71, 72,
    75, 76, 77, 79, 80, 82, 83,
    87, 88, 89, 94, 97, 101, 103, 106,
    107, 108, 109, 110, 111, 112,
    113, 114, 115, 121
]);

// Read the JSON data — uses the actual filename
const jsonPath = path.join(__dirname, 'deportes_globales_categorias.json');
const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
const sports = rawData.deportes.filter(s => LATAM_IDS.has(s.id));

let output = TYPES;
output += 'export const SPORTS_CATALOG: SportCatalogEntry[] = [\n';

for (const sport of sports) {
    const slug = makeSlug(sport.nombre);
    const cats = sport.categorias_competencia;
    output += '  {\n';
    output += '    id: ' + sport.id + ',\n';
    output += '    nombre: ' + JSON.stringify(sport.nombre) + ',\n';
    output += '    nombreIngles: ' + JSON.stringify(sport.nombre_ingles) + ',\n';
    output += '    slug: ' + JSON.stringify(slug) + ',\n';
    output += '    federacion: ' + JSON.stringify(sport.federacion_internacional) + ',\n';
    output += '    acronimo: ' + JSON.stringify(sport.acronimo_fi) + ',\n';
    output += '    estadoOlimpico: ' + JSON.stringify(sport.estado_olimpico) + ',\n';
    output += '    categoriaGlobal: ' + JSON.stringify(categoriaGlobal(sport)) + ',\n';
    output += '    categoriasCompetencia: {\n';
    const catLines = serializeCategories(cats, '      ');
    output += catLines.join('\n') + '\n';
    output += '    },\n';
    output += '  },\n';
}

output += '];\n\n';

// Helper functions
output += '// ═══════════════════════════════════════════════════════════════════════════════\n';
output += '// Helper Functions\n';
output += '// ═══════════════════════════════════════════════════════════════════════════════\n\n';
output += 'export const TOTAL_SPORTS = SPORTS_CATALOG.length;\n\n';
output += 'export const SPORTS_LIST = SPORTS_CATALOG.map(s => s.nombre);\n\n';
output += 'export const SPORTS_SLUGS = SPORTS_CATALOG.map(s => s.slug);\n\n';
output += 'export function getSportBySlug(slug: string): SportCatalogEntry | undefined {\n';
output += '  return SPORTS_CATALOG.find(s => s.slug === slug || s.nombreIngles.toLowerCase().replace(/\\s+/g, \'_\') === slug);\n';
output += '}\n\n';
output += 'export function getSportById(id: number): SportCatalogEntry | undefined {\n';
output += '  return SPORTS_CATALOG.find(s => s.id === id);\n';
output += '}\n\n';
output += 'export function getSportsByCategory(cat: CategoriaGlobal): SportCatalogEntry[] {\n';
output += '  return SPORTS_CATALOG.filter(s => s.categoriaGlobal === cat);\n';
output += '}\n\n';
output += 'export function searchSports(query: string): SportCatalogEntry[] {\n';
output += '  const q = query.toLowerCase().normalize(\'NFD\').replace(/[\\u0300-\\u036f]/g, \'\');\n';
output += '  return SPORTS_CATALOG.filter(s => {\n';
output += '    const name = s.nombre.toLowerCase().normalize(\'NFD\').replace(/[\\u0300-\\u036f]/g, \'\');\n';
output += '    const nameEn = s.nombreIngles.toLowerCase();\n';
output += '    return name.includes(q) || nameEn.includes(q) || s.slug.includes(q);\n';
output += '  });\n';
output += '}\n\n';
output += 'export function getAgeCategories(slug: string): string[] {\n';
output += '  const sport = getSportBySlug(slug);\n';
output += '  if (!sport) return [];\n';
output += '  return (sport.categoriasCompetencia.categorias_edad as string[]) || [];\n';
output += '}\n\n';
output += 'export function getGenderCategories(slug: string): string[] {\n';
output += '  const sport = getSportBySlug(slug);\n';
output += '  if (!sport) return [];\n';
output += '  return (sport.categoriasCompetencia.genero as string[]) || [];\n';
output += '}\n';

const outPath = path.join(__dirname, 'sportsCatalog.ts');
fs.writeFileSync(outPath, output, 'utf-8');
console.log('Generated sportsCatalog.ts with ' + sports.length + ' sports (' + output.length + ' bytes)');
