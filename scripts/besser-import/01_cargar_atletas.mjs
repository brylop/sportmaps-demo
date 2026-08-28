// ============================================================================
// CLUB DEPORTIVO BESSER — carga masiva de atletas desde el Excel de respuestas
// del formulario de inscripción ("INFORMACION BESSER _ APP.xlsx").
//
//   · POR DEFECTO NO ESCRIBE NADA. Sin --confirmar hace dry-run.
//   · Besser no tiene todavía la estructura de equipos/categorías que cubra
//     el archivo (30 varones + 25 mujeres, 5 a 18 años, un solo equipo
//     "INFANTIL FEMENINO" existe hoy) — decisión: NO se inventa esa
//     estructura acá. Se carga cada atleta con SU cuota individual
//     (enrollments.monthly_fee manda sobre cualquier plan) usando un equipo
//     GENÉRICO ("Sin categoría asignada") solo para satisfacer la constraint
//     `enrollments_active_needs_target` (una fila activa necesita team_id U
//     offering_plan_id) y para que open_month() la tome como facturable
//     (filtra por status='active', no por 'pending'). Se intentó primero con
//     un offering_plan genérico, pero offering_plans.offering_id es NOT NULL
//     (depende de un offering completo) — un team suelto no tiene esa cadena.
//     Besser puede reasignar cada atleta a su equipo real desde la UI luego.
//   · Becados (MENSUALIDAD=0 en el archivo): fee_is_manual=true +
//     monthly_fee=0. open_month calcula amount=0 y el filtro `amount > 0`
//     no genera cobro — sin esto habría quedado con la cascada
//     monthly_fee->plan->team->0 igual, pero fee_is_manual dice EXPLÍCITO
//     que es una decisión (beca), no un dato faltante.
//   · Excluidos de esta carga (confirmado con el usuario, no se adivina):
//       - fila 11: duplicado exacto de fila 23 (Antonia Duque Ochoa, mismo
//         documento, mismo nombre, misma fecha de nacimiento, misma cuota).
//       - fila 10: fecha de nacimiento 1985 (40 años) con "acudientes"
//         cargados como si fuera menor — pendiente de aclarar con la familia.
//       - fila 19: el teléfono del acudiente #1 quedó vacío en el formulario
//         y las columnas de después se corrieron; los datos de contacto no
//         son confiables.
//   · doc_type se infiere por edad (regla legal colombiana): <7 RC, 7-17 TI,
//     18+ CC. No viene en el archivo.
//
// Uso:
//   node scripts/besser-import/01_cargar_atletas.mjs                # dry-run
//   node scripts/besser-import/01_cargar_atletas.mjs --confirmar
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const XLSX_PATH = 'C:/Users/Usuario/Downloads/INFORMACION BESSER _ APP.xlsx';

// exceljs solo vive en frontend/node_modules.
const requireFromFrontend = createRequire(path.join(ROOT, 'frontend/package.json'));
const ExcelJS = requireFromFrontend('exceljs');

const CONFIRMAR = process.argv.includes('--confirmar');

const SCHOOL_ID = '759eee9d-05cb-4958-b84a-2560f77e3683';
const BRANCH_ID = '71a6be7e-a83d-4d27-bcc2-a3c2919de6c0';

// Filas del Excel (1-indexed, coincide con el número de fila real) a excluir.
const EXCLUIR_FILAS = new Set([10, 11, 19]);
const MOTIVO_EXCLUSION = {
  10: 'fecha de nacimiento 1985 (40 años) con acudientes cargados como menor — pendiente aclarar',
  11: 'duplicado exacto de la fila 23 (Antonia Duque Ochoa, mismo documento)',
  19: 'columnas de acudientes corridas en el formulario, datos de contacto no confiables',
};

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, 'bff/.env'), 'utf8')
    .split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const BASE = (env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const get = async (q) => {
  const r = await fetch(`${BASE}/rest/v1/${q}`, { headers: HEADERS });
  const t = await r.text();
  if (!r.ok) throw new Error(`GET ${q} -> ${t.slice(0, 300)}`);
  return JSON.parse(t);
};
const post = async (tabla, fila) => {
  const r = await fetch(`${BASE}/rest/v1/${tabla}`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(fila),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`POST ${tabla} -> ${t.slice(0, 500)}`);
  return JSON.parse(t)[0];
};

function soloDigitos(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\D/g, '');
  return s || null;
}

function inferirDocType(dob) {
  const hoy = new Date();
  let edad = hoy.getFullYear() - dob.getFullYear();
  const m = hoy.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < dob.getDate())) edad--;
  if (edad < 7) return 'RC';
  if (edad < 18) return 'TI';
  return 'CC';
}

async function leerExcel() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const sheet = wb.worksheets[0];

  const filas = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const v = row.values.slice(1);
    filas.push({
      rowNumber,
      fee: Number(v[0]) || 0,
      formEmail: v[1] ?? null,
      name: String(v[2] ?? '').trim(),
      doc: soloDigitos(v[3]),
      dob: v[4] instanceof Date ? v[4] : new Date(v[4]),
      gender: String(v[5] ?? '').trim().toUpperCase(),
      g1Name: v[6] ? String(v[6]).trim() : null,
      g1Phone: soloDigitos(v[7]),
      g1Email: v[8] ? String(v[8]).trim().toLowerCase() : null,
      g2Name: v[9] ? String(v[9]).trim() : null,
      g2Phone: soloDigitos(v[10]),
      g2Email: v[11] ? String(v[11]).trim().toLowerCase() : null,
    });
  });
  return filas;
}

async function resolverTeamGenerico() {
  const NOMBRE = 'Sin categoría asignada';
  const existentes = await get(
    `teams?school_id=eq.${SCHOOL_ID}&name=eq.${encodeURIComponent(NOMBRE)}&select=id,name`,
  );
  if (existentes.length > 0) return existentes[0];

  if (!CONFIRMAR) return { id: '(se crearía)', name: NOMBRE };

  return post('teams', {
    school_id: SCHOOL_ID,
    branch_id: BRANCH_ID,
    name: NOMBRE,
    sport: 'Fútbol',
    price_monthly: 0,
    active: true,
  });
}

async function main() {
  console.log(`Modo: ${CONFIRMAR ? 'ESCRITURA' : 'DRY-RUN (nada se escribe)'}\n`);

  const filas = await leerExcel();
  console.log(`Filas leídas del Excel: ${filas.length}`);

  const aCargar = filas.filter((f) => !EXCLUIR_FILAS.has(f.rowNumber));
  console.log(`Excluidas: ${filas.length - aCargar.length}`);
  for (const rn of EXCLUIR_FILAS) console.log(`  fila ${rn}: ${MOTIVO_EXCLUSION[rn]}`);

  const team = await resolverTeamGenerico();
  console.log(`\nEquipo genérico: ${team.id} (${team.name})\n`);

  const resumen = { insertados: 0, becados: 0, saltados_duplicado: 0, errores: 0 };

  for (const f of aCargar) {
    if (!f.doc || !f.name) {
      console.log(`  fila ${f.rowNumber}: SIN documento o nombre, se salta —`, JSON.stringify(f));
      resumen.errores++;
      continue;
    }

    const dup = await get(
      `unregistered_athletes?school_id=eq.${SCHOOL_ID}&doc_number=eq.${f.doc}&select=id`,
    );
    if (dup.length > 0) {
      console.log(`  fila ${f.rowNumber} (${f.name}, doc ${f.doc}): ya existe, se salta`);
      resumen.saltados_duplicado++;
      continue;
    }

    const esBecado = f.fee === 0;
    const payloadAtleta = {
      school_id: SCHOOL_ID,
      branch_id: BRANCH_ID,
      full_name: f.name,
      doc_type: inferirDocType(f.dob),
      doc_number: f.doc,
      date_of_birth: f.dob.toISOString().slice(0, 10),
      gender: f.gender === 'FEMENINO' ? 'female' : f.gender === 'MASCULINO' ? 'male' : null,
      guardian_full_name: f.g1Name,
      guardian_phone: f.g1Phone,
      guardian_email: f.g1Email,
      is_active: true,
      intake_form_data: {
        origen: 'Excel INFORMACION BESSER _ APP.xlsx',
        fila_excel: f.rowNumber,
        form_email: f.formEmail,
        acudiente_2_nombre: f.g2Name,
        acudiente_2_telefono: f.g2Phone,
        acudiente_2_correo: f.g2Email,
      },
    };

    if (!CONFIRMAR) {
      console.log(`  fila ${f.rowNumber}: se cargaría ${f.name} (doc ${f.doc}, cuota ${f.fee}${esBecado ? ' BECADO' : ''})`);
      resumen.insertados++;
      if (esBecado) resumen.becados++;
      continue;
    }

    try {
      const ua = await post('unregistered_athletes', payloadAtleta);
      await post('enrollments', {
        school_id: SCHOOL_ID,
        unregistered_athlete_id: ua.id,
        team_id: team.id,
        status: 'active',
        start_date: new Date().toISOString().slice(0, 10),
        monthly_fee: f.fee,
        fee_is_manual: esBecado,
        fee_reason: esBecado ? 'Beca / cuota exenta — carga inicial Excel Besser' : null,
      });
      console.log(`  fila ${f.rowNumber}: OK ${f.name} (doc ${f.doc}, cuota ${f.fee}${esBecado ? ' BECADO' : ''})`);
      resumen.insertados++;
      if (esBecado) resumen.becados++;
    } catch (err) {
      console.error(`  fila ${f.rowNumber}: ERROR con ${f.name} (${f.doc}): ${err.message}`);
      resumen.errores++;
    }
  }

  console.log('\nResumen:', resumen);
}

main().catch((err) => { console.error(err); process.exit(1); });
