// ============================================================================
// SportMaps — ¿estas dos filas son la MISMA persona? (heurística compartida)
//
// Extraído de `audit-duplicate-athletes.mjs` para que el barrido de identidades
// y el de cobros duplicados usen el MISMO criterio. Acá vive el conocimiento
// caro de este dominio, que no se puede reinventar en cada script:
//
//   · Coincidir por nombre NO alcanza: "VICTORIA GOMEZ" son tres niñas distintas
//     en la misma escuela.
//   · Documentos consecutivos + misma fecha de nacimiento = GEMELAS, no
//     duplicado (Gabriela y Juliana Simbaqueva, Dynasty). Nunca fusionar.
//   · Mismo documento con nombres distintos = documento mal digitado, tampoco
//     se fusiona sin que un humano lo mire.
//
// Las tres superficies donde nace una identidad de atleta (las tres ramas de la
// vista `school_athletes`):
//   · children                    → menor a cargo de un acudiente
//   · profiles + school_members   → atleta adulto con cuenta propia
//   · unregistered_athletes       → precargado por la escuela (sin cuenta)
// ============================================================================

// ── normalización ───────────────────────────────────────────────────────────
export const noAccents = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
export const normName = (s) => noAccents(s).toUpperCase().replace(/[^A-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
export const nameKey = (s) => {
  const t = normName(s).split(' ').filter((x) => x.length >= 3);
  return t.length >= 2 ? `name:${[...t].sort().join('|')}` : null;
};
export const docKey = (d) => {
  const n = String(d || '').replace(/\D/g, '');
  return n.length >= 6 ? `doc:${n}` : null;
};
export const dobKey = (dob, name) => {
  if (!dob) return null;
  const t = normName(name).split(' ').filter((x) => x.length >= 3).sort();
  return t.length >= 2 ? `dob:${String(dob).slice(0, 10)}+${t.slice(0, 2).join('|')}` : null;
};
export const toks = (s) => new Set(normName(s).split(' ').filter((t) => t.length >= 3));
export const digits = (d) => String(d || '').replace(/\D/g, '');
export const localPart = (e) => String(e || '').split('@')[0].toLowerCase();

export const lev = (a, b) => {
  a = String(a || ''); b = String(b || '');
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
};

export const RANK = { CONFIRMADO: 3, PROBABLE: 2, DOC_REPETIDO: 1, HOMONIMO: 0 };
export const identityKey = (r) => `${r.school_id}|${r.kind}|${r.id}`;

// ── evidencia por pareja ────────────────────────────────────────────────────
// Se pesa cada pareja y solo las CONFIRMADAS o PROBABLES se unen en un grupo;
// el resto se reporta aparte como homónimos.
export function evaluar(a, b) {
  const ta = toks(a.name), tb = toks(b.name);
  const inter = [...ta].filter((t) => tb.has(t));
  const nameSame = ta.size === tb.size && inter.length === ta.size;
  const nameSub = !nameSame && inter.length >= 2 && (inter.length === ta.size || inter.length === tb.size);
  const nameStrong = (nameSame || nameSub) && Math.max(ta.size, tb.size) >= 3; // 3 tokens = mucho más específico
  const da = digits(a.doc), db = digits(b.doc);
  const bothDoc = da.length >= 5 && db.length >= 5;
  const docSame = bothDoc && da === db;
  const docNear = bothDoc && !docSame && lev(da, db) <= 2;
  const docDiff = bothDoc && !docSame && !docNear;
  const bothDob = !!a.dob && !!b.dob;
  const dobSame = bothDob && String(a.dob).slice(0, 10) === String(b.dob).slice(0, 10);
  const dobDiff = bothDob && !dobSame;
  const ea = localPart(a.owner), eb = localPart(b.owner);
  const mailSame = ea && eb && ea === eb;
  const mailNear = ea && eb && !mailSame && ea.length > 4 && lev(ea, eb) <= 2;
  const razones = [];
  let veredicto;

  if (docSame && (nameSame || nameSub)) { veredicto = 'CONFIRMADO'; razones.push('mismo documento + mismo nombre'); }
  else if (docSame) { veredicto = 'DOC_REPETIDO'; razones.push(`mismo documento (${da}) con nombres distintos → documento mal digitado, no fusionar sin revisar`); }
  else if ((nameSame || nameSub) && dobSame) { veredicto = 'CONFIRMADO'; razones.push('mismo nombre + misma fecha de nacimiento'); }
  else if ((nameSame || nameSub) && docNear) { veredicto = 'CONFIRMADO'; razones.push(`documento con dígito de más/menos (${da} vs ${db})`); }
  else if ((nameSame || nameSub) && (mailSame || mailNear)) { veredicto = 'CONFIRMADO'; razones.push(mailSame ? 'mismo nombre + mismo acudiente' : `mismo nombre + correo del acudiente casi igual (${ea} vs ${eb})`); }
  else if (nameStrong) { veredicto = 'PROBABLE'; razones.push('nombre completo idéntico (3+ tokens) pero documento y/o fecha no cuadran → cada acudiente lo cargó a su manera'); }
  else if ((nameSame || nameSub) && !dobDiff && !docDiff) { veredicto = 'PROBABLE'; razones.push('mismo nombre y sin documento/fecha que lo desmienta'); }
  else { veredicto = 'HOMONIMO'; razones.push('mismo nombre pero documento y fecha de nacimiento distintos → personas distintas'); }

  if (docNear && veredicto === 'CONFIRMADO') razones.push('ojo: uno de los dos documentos está mal');
  if (dobDiff) razones.push(`fechas de nacimiento distintas (${String(a.dob).slice(0, 10)} vs ${String(b.dob).slice(0, 10)})`);
  return { veredicto, razones, nameSame, nameSub, docSame, dobSame };
}

// ── agrupación ──────────────────────────────────────────────────────────────
// Union-find sobre señales (documento / nombre ordenado / fecha+nombre / token
// suelto), siempre dentro de la MISMA escuela: la misma persona en dos escuelas
// es legítimo.
//
// Devuelve solo los grupos con 2+ identidades sostenidos por al menos una
// pareja CONFIRMADA o PROBABLE, más las parejas descartadas para revisión.
export function agruparIdentidades(ids) {
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const r of ids) parent.set(identityKey(r), identityKey(r));

  const bySignal = new Map();
  for (const r of ids) {
    const sigs = [docKey(r.doc), nameKey(r.name), dobKey(r.dob, r.name)].filter(Boolean);
    // token individual también, para pescar "Sergio Herrera" vs "Sergio Herrera Torres"
    for (const t of toks(r.name)) sigs.push(`tok:${t}`);
    r._sigs = sigs;
    for (const s of sigs) {
      const gk = `${r.school_id}::${s}`;
      if (!bySignal.has(gk)) bySignal.set(gk, []);
      bySignal.get(gk).push(r);
    }
  }

  const pares = new Map();
  for (const [, rows] of bySignal) {
    if (rows.length < 2) continue;
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i], b = rows[j];
        if (a.id === b.id) continue;
        const pk = [identityKey(a), identityKey(b)].sort().join('##');
        if (pares.has(pk)) continue;
        const ev = evaluar(a, b);
        pares.set(pk, { a, b, ...ev });
        if (RANK[ev.veredicto] >= 2) union(identityKey(a), identityKey(b));
      }
    }
  }
  const descartados = [...pares.values()].filter((p) => RANK[p.veredicto] < 2);

  const byRoot = new Map();
  for (const r of ids) {
    const root = find(identityKey(r));
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(r);
  }

  const grupos = [];
  for (const [root, rows] of byRoot) {
    if (rows.length < 2) continue;
    const misPares = [...pares.values()].filter((p) => find(identityKey(p.a)) === root && RANK[p.veredicto] >= 2);
    if (!misPares.length) continue;
    grupos.push({
      root,
      rows,
      pares: misPares,
      veredicto: misPares.some((p) => p.veredicto === 'CONFIRMADO') ? 'CONFIRMADO' : 'PROBABLE',
      razones: [...new Set(misPares.flatMap((p) => p.razones))],
    });
  }
  return { grupos, descartados, find, pares };
}

// ── candidatos desde las tres superficies ───────────────────────────────────
// `profById` mapea profiles.id → fila, para resolver el correo del acudiente.
export function construirIdentidades({ kids, uas, members, profById }) {
  const ids = [];
  for (const c of kids) {
    ids.push({
      kind: 'child', id: c.id, school_id: c.school_id, name: c.full_name,
      doc: c.doc_number, dob: c.date_of_birth, is_active: c.is_active !== false,
      is_demo: !!c.is_demo, created_at: c.created_at,
      owner: c.parent_id ? (profById.get(c.parent_id)?.email || c.parent_id.slice(0, 8)) : (c.parent_email_temp || '❌ sin acudiente'),
    });
  }
  for (const u of uas) {
    ids.push({
      kind: 'unregistered', id: u.id, school_id: u.school_id, name: u.full_name,
      doc: u.doc_number, dob: u.date_of_birth, is_active: u.is_active !== false,
      linked: u.linked_profile_id, created_at: u.created_at,
      owner: u.email || u.phone || '-',
      // la vista solo lo muestra si NO está vinculado
      visible: !u.linked_profile_id,
    });
  }
  for (const m of members) {
    if (m.role !== 'athlete') continue;
    const p = profById.get(m.profile_id);
    if (!p) continue;
    ids.push({
      kind: 'adult', id: m.profile_id, school_id: m.school_id, name: p.full_name,
      doc: null, dob: p.date_of_birth, is_active: m.status !== 'inactive' && m.status !== 'removed',
      created_at: m.created_at, owner: p.email || p.phone || '-',
    });
  }
  return ids;
}
