// ============================================================================
// Monster's Volley Club (Sede Suba) — extracción del Excel a JSON intermedio.
//
// No toca la base. Corrige dos bugs reales del export (Google Forms → Excel):
//   1. 7 de las 13 hojas perdieron la fila de encabezado (la fila 1 ya es un
//      atleta real, no las preguntas). Se detecta por hoja: si la celda A1 no
//      dice literalmente "Marca temporal", esa fila es DATO, no encabezado.
//   2. Los 7 links de documento son hipervínculos incrustados
//      (`cell.hyperlink`), no texto plano — `cell.value` a veces da un objeto
//      que se imprime como "[object Object]" si se lo trata como string.
//
// El orden de columnas es el mismo formulario de Google en las 13 hojas
// (verificado): por eso el mapeo es por posición, no por nombre de encabezado.
//
// Uso (necesita exceljs, que vive en frontend/node_modules):
//   cd frontend && node ../scripts/monster-volley-suba-import/01_extraer.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, 'data');
const XLSX_PATH = 'C:/Users/Usuario/Downloads/Datos Plataforma Sede Suba.xlsx';

// exceljs solo vive en frontend/node_modules — se toma prestada su resolución
// CJS en vez de exigir "cd frontend" para que el import ESM encuentre el paquete.
const requireFromFrontend = createRequire(path.join(HERE, '../../frontend/package.json'));
const ExcelJS = requireFromFrontend('exceljs');

const slug = (s) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const DOC_TYPE_TIRAS = {
  'tarjeta de identidad': 'TI',
  'cédula de ciudadanía': 'CC',
  'cedula de ciudadania': 'CC',
  'registro civil': 'RC',
  'cédula de extranjería': 'CE',
  'cedula de extranjeria': 'CE',
};
const normalizeDocType = (raw) => {
  if (!raw) return null;
  const k = String(raw).trim().toLowerCase();
  return DOC_TYPE_TIRAS[k] || raw;
};

// Columna (1-indexed) → tipo de documento (CHECK de athlete_documents).
// Nota: el formulario pide UNA sola foto "por ambas caras" para cada cédula
// (no front/back separados) — se mapean a *_front; *_back queda reservado
// para si algún día el formulario separa las dos caras.
const DOC_COLUMNS = [
  { col: 18, document_type: 'athlete_photo' },
  { col: 19, document_type: 'eps_certificate' },
  { col: 20, document_type: 'guardian_id_front' },
  { col: 21, document_type: 'athlete_id_front' },
  { col: 22, document_type: 'guardian_signature' },
  { col: 23, document_type: 'athlete_signature' },
  { col: 24, document_type: 'good_standing_certificate' },
];

function cellDriveLink(cell) {
  // El hipervínculo real vive en cell.hyperlink; cell.value puede ser
  // {text, hyperlink} (rich value) o un string plano si Excel no lo formateó
  // como link. Se prueban las tres fuentes, en ese orden de confianza.
  const v = cell.value;
  const raw = cell.hyperlink || (v && typeof v === 'object' && (v.hyperlink || v.text)) || (typeof v === 'string' ? v : null);
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.match(/[-\w]{20,}/); // el id de Drive es la parte larga alfanumérica
  if (raw.startsWith('file:///')) return { broken: true, raw }; // ruta local de alguien, no recuperable
  return m ? { fileId: m[0], raw } : { broken: true, raw };
}

function cellDateISO(cell) {
  const v = cell.value;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return null;
}

function cellText(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && v.text) return String(v.text).trim() || null;
  if (typeof v === 'object' && v.richText) return v.richText.map((r) => r.text).join('').trim() || null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const resumen = [];

  for (const ws of wb.worksheets) {
    const headerRow1 = String(ws.getRow(1).getCell(1).value ?? '').trim().toLowerCase();
    const hojaTieneEncabezado = headerRow1 === 'marca temporal';
    const primeraFilaDato = hojaTieneEncabezado ? 2 : 1;

    const atletas = [];
    for (let r = primeraFilaDato; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const fullName = cellText(row.getCell(3));
      if (!fullName) continue; // fila vacía al final de la hoja

      const documentos = DOC_COLUMNS.map(({ col, document_type }) => {
        const link = cellDriveLink(row.getCell(col));
        return { document_type, ...(link || { broken: true, raw: null }) };
      });

      atletas.push({
        fila_excel: r,
        full_name: fullName,
        date_of_birth: cellDateISO(row.getCell(4)),
        doc_type: normalizeDocType(cellText(row.getCell(5))),
        doc_number: cellText(row.getCell(6)),
        athlete_email: cellText(row.getCell(8)),
        blood_type: cellText(row.getCell(9)),
        eps_name: cellText(row.getCell(10)),
        address: cellText(row.getCell(11)),
        locality: cellText(row.getCell(12)),
        neighborhood: cellText(row.getCell(13)),
        landline: cellText(row.getCell(14)),
        guardian_phone: cellText(row.getCell(15)),
        athlete_phone: cellText(row.getCell(16)),
        guardian_email: cellText(row.getCell(17)),
        documentos,
        categoria_formulario: cellText(row.getCell(25)),
        guardian_occupation: cellText(row.getCell(26)),
        athlete_occupation: cellText(row.getCell(27)),
        social_instagram: cellText(row.getCell(28)),
        social_facebook: cellText(row.getCell(29)),
        social_tiktok: cellText(row.getCell(30)),
        health_screening: {
          problema_cardiaco: cellText(row.getCell(31)),
          dolor_pecho_reposo: cellText(row.getCell(32)),
          mareo_vertigo_perdida_conciencia: cellText(row.getCell(33)),
          problema_oseo_articular: cellText(row.getCell(34)),
          medicamento_tension_corazon: cellText(row.getCell(35)),
          otra_razon_no_actividad_fisica: cellText(row.getCell(36)),
          cual_otra_razon: cellText(row.getCell(37)),
          medicamento_en_entrenamiento: cellText(row.getCell(38)),
          alergia_alimento: cellText(row.getCell(39)),
          cual_alimento: cellText(row.getCell(40)),
        },
      });
    }

    const s = slug(ws.name);
    fs.writeFileSync(path.join(OUT_DIR, `${s}.json`), JSON.stringify({ hoja: ws.name, encabezado_detectado: hojaTieneEncabezado, total: atletas.length, atletas }, null, 2));
    resumen.push({ hoja: ws.name, slug: s, filas: ws.rowCount, atletas: atletas.length, encabezado_detectado: hojaTieneEncabezado });
  }

  console.log('Resumen de extracción (sin tocar la base):\n');
  for (const r of resumen) {
    console.log(`  ${r.slug.padEnd(32)} atletas=${String(r.atletas).padStart(3)}  encabezado_ok=${r.encabezado_detectado}`);
  }
  console.log(`\nJSON escritos en ${OUT_DIR}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
