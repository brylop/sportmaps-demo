import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// ── Constantes ────────────────────────────────────────────────────────────────

const WGER_BASE_URL    = 'https://wger.de/api/v2';
const FREE_DB_URL      = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const FREE_DB_IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const CACHE_TTL_MS     = 24 * 60 * 60 * 1000;
const PAGE_SIZE        = 100;
const FETCH_TIMEOUT    = 10_000; // free-db y DeepL
const WGER_TIMEOUT     = 30_000; // wger.de es más lento
const DEEPL_URL     = 'https://api-free.deepl.com/v2/translate';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface WgerMuscle {
  id:       number;
  name_en:  string;
  name_es:  string | null;
  is_front: boolean;
}

export interface WgerEquipment {
  id:   number;
  name: string;
}

export interface WgerExercise {
  wger_id:            number | null;
  free_db_id:         string | null;
  name_es:            string | null;
  name_en:            string;
  description:        string | null;
  muscles:            WgerMuscle[];
  muscles_secondary:  WgerMuscle[];
  equipment:          WgerEquipment[];
  images:             string[];
  category:           string;
  level:              string | null;
  mechanic:           string | null;
  is_compound:        boolean;
}

interface FreeDbExercise {
  id:               string;
  name:             string;
  category:         string;
  level:            string;
  mechanic:         string | null;
  equipment:        string | null;
  primaryMuscles:   string[];
  secondaryMuscles: string[];
  instructions:     string[];
  images:           string[];
}

// ── Caché ─────────────────────────────────────────────────────────────────────

interface MergedCache {
  exercises: WgerExercise[];
  loadedAt:  number;
}

let mergedCache: MergedCache | null = null;
let loadingPromise: Promise<WgerExercise[]> | null = null;
const infoCache = new Map<number, { data: WgerExercise; expires: number }>();

// ── Carga de Traducciones Locales ─────────────────────────────────────────────

interface LocalTranslation {
  id:          number | string;
  name_en:     string;
  name_es:     string | null;
  description: string | null;
}

let localTranslationsCache: Map<string, LocalTranslation> | null = null;
let localTranslationsMtime: number = 0;

function loadLocalTranslations(): Map<string, LocalTranslation> {
  const filePath = path.join(__dirname, '../../data/exercises.json');
  
  if (!fs.existsSync(filePath)) {
    console.warn(`[exercises] Archivo de traducciones no encontrado: ${filePath}`);
    return new Map();
  }

  try {
    const stats = fs.statSync(filePath);
    if (localTranslationsCache && stats.mtimeMs === localTranslationsMtime) {
      return localTranslationsCache;
    }

    const translations = new Map<string, LocalTranslation>();
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
    const data = JSON.parse(content);
    const list: LocalTranslation[] = data.value ?? [];
    
    for (const item of list) {
      translations.set(String(item.id), item);
      translations.set(normalizeText(item.name_en), item);
    }
    console.log(`[exercises] ${translations.size} traducciones locales cargadas en memoria`);
    
    localTranslationsCache = translations;
    localTranslationsMtime = stats.mtimeMs;
    return translations;
  } catch (err: any) {
    console.error('[exercises] Error cargando traducciones locales:', err.message);
    return localTranslationsCache || new Map();
  }
}

export function hydrateBlocksWithLocalTranslations(blocks: any[]): any[] {
  if (!blocks || !Array.isArray(blocks)) return blocks;
  const localMap = loadLocalTranslations();
  
  return blocks.map(block => {
    if (!block.wger_id && !block.free_db_id) return block;
    const idKey = String(block.wger_id ?? block.free_db_id ?? '');
    const nameKey = (block.wger_name_en ?? '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();

    const local = localMap.get(idKey) ?? localMap.get(nameKey);
    if (local) {
      return {
        ...block,
        wger_name_es: local.name_es ?? block.wger_name_es,
        wger_description: local.description ?? block.wger_description
      };
    }
    return block;
  });
}

function applyLocalTranslations(exercises: WgerExercise[]): WgerExercise[] {
  const localMap = loadLocalTranslations();
  let appliedCount = 0;
  const matchedIds = new Set<string>();

  const result = exercises.map(ex => {
    // Buscar por ID (Wger o FreeDB)
    const idKey = String(ex.wger_id ?? ex.free_db_id ?? '');
    const nameKey = normalizeText(ex.name_en);
    
    const local = localMap.get(idKey) ?? localMap.get(nameKey);
    
    if (local && local.name_es) {
      appliedCount++;
      matchedIds.add(String(local.id));
      return {
        ...ex,
        name_es: local.name_es,
        description: local.description ?? ex.description,
      };
    }
    return ex;
  });

  console.log(`[exercises] Se aplicaron ${appliedCount} traducciones locales`);

  // Agregar ejercicios locales personalizados que no coincidan con la API remota
  const addedCustom: WgerExercise[] = [];
  const processedIds = new Set<string>();

  localMap.forEach((local) => {
    const localIdStr = String(local.id);
    if (processedIds.has(localIdStr)) return;
    processedIds.add(localIdStr);

    if (!matchedIds.has(localIdStr)) {
      const isNumeric = /^\d+$/.test(localIdStr);
      const wger_id = isNumeric ? parseInt(localIdStr, 10) : null;
      const free_db_id = isNumeric ? null : localIdStr;

      // Servir imagen desde frontend public assets
      const images = localIdStr === '9001' ? ['/exercises/9001.gif'] : [`/exercises/${localIdStr}.gif`];

      addedCustom.push({
        wger_id,
        free_db_id,
        name_en: local.name_en,
        name_es: local.name_es,
        description: local.description,
        muscles: [],
        muscles_secondary: [],
        equipment: [],
        images,
        category: 'Custom',
        level: null,
        mechanic: null,
        is_compound: false,
      });
    }
  });

  if (addedCustom.length > 0) {
    console.log(`[exercises] Se agregaron ${addedCustom.length} ejercicios personalizados locales`);
    return [...result, ...addedCustom];
  }

  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  return html
    .replace(/<li>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ').trim() || null;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function wordOverlapScore(a: string, b: string): number {
  const wa = new Set(normalizeText(a).split(' ').filter((w: string) => w.length > 1));
  const wb = new Set(normalizeText(b).split(' ').filter((w: string) => w.length > 1));
  if (!wa.size || !wb.size) return 0;
  let common = 0;
  wa.forEach((w: string) => { if (wb.has(w)) common++; });
  return common / Math.min(wa.size, wb.size);
}

function buildInstructions(steps: string[]): string | null {
  if (!steps || steps.length === 0) return null;
  return steps
    .map((step: string, i: number) => {
      const clean = step.replace(/^Step\s*:\s*\d+\s*/i, '').trim();
      return `${i + 1}. ${clean}`;
    })
    .join('\n');
}

function buildImageUrls(images: string[]): string[] {
  return images.map((img: string) => `${FREE_DB_IMG_BASE}${img}`);
}

// Convierte "JALON EN BANCO INCLINADO" → "Jalón en banco inclinado"
function toSentenceCase(str: string): string {
  if (!str) return str;
  const lower = str.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// Mapa de ID de músculo → nombre en español
let muscleNamesEs: Map<number, string> = new Map();

async function loadMuscleNames(): Promise<void> {
  try {
    const res = await fetch(`${WGER_BASE_URL}/muscle/?format=json`, {
      signal:  AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return;
    const data: any = await res.json();

    for (const m of (data.results ?? [])) {
      if (!m?.id) continue;
      // wger devuelve name_es directo en el objeto muscle
      const nameEs: string | null = m.name_es ?? m.name ?? null;
      if (nameEs) muscleNamesEs.set(m.id, nameEs);
    }
    console.log(`[wger] ${muscleNamesEs.size} nombres de músculos en español cargados`);
  } catch (err: any) {
    console.warn('[wger] No se pudieron cargar nombres de músculos en español:', err.message);
  }
}

// ── Carga de datasets ─────────────────────────────────────────────────────────

async function loadWgerExercises(): Promise<WgerExercise[]> {
  const exercises: WgerExercise[] = [];
  let offset = 0;
  let total  = Infinity;

  while (offset < total) {
    const url = `${WGER_BASE_URL}/exerciseinfo/?format=json&language=2&limit=${PAGE_SIZE}&offset=${offset}`;
    const response = await fetch(url, {
      signal:  AbortSignal.timeout(WGER_TIMEOUT),
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) throw new Error(`wger respondió ${response.status}`);

    const page: any = await response.json();
    total = page.count ?? 0;

    for (const raw of (page.results ?? [])) {
      if (!raw?.id) continue;
      const translations: any[] = raw.translations ?? [];
      const esTrans = translations.find((t: any) => t.language === 4);
      const enTrans = translations.find((t: any) => t.language === 2);
      const name_en = enTrans?.name ?? esTrans?.name ?? '';
      if (!name_en) continue;

      exercises.push({
        wger_id:           raw.id,
        free_db_id:        null,
        name_es:           esTrans?.name ?? null,
        name_en,
        description:       stripHtml(esTrans?.description ?? enTrans?.description),
        muscles:           (raw.muscles ?? []).filter((m: any) => m?.id && m?.name_en)
                             .map((m: any) => ({
                               id:       m.id,
                               name_en:  m.name_en,
                               name_es:  muscleNamesEs.get(m.id) ?? null,
                               is_front: !!m.is_front,
                             })),
        muscles_secondary: (raw.muscles_secondary ?? []).filter((m: any) => m?.id && m?.name_en)
                             .map((m: any) => ({
                               id:       m.id,
                               name_en:  m.name_en,
                               name_es:  muscleNamesEs.get(m.id) ?? null,
                               is_front: !!m.is_front,
                             })),
        equipment:         (raw.equipment ?? []).filter((e: any) => e?.id && e?.name)
                             .map((e: any) => ({ id: e.id, name: e.name })),
        images:            (raw.images ?? []).filter((i: any) => i?.image)
                             .map((i: any) => String(i.image)),
        category:          raw.category?.name ?? '',
        level:             null,
        mechanic:          null,
        is_compound:       (raw.muscles ?? []).length >= 3,
      });
    }
    offset += PAGE_SIZE;
  }

  console.log(`[wger] ${exercises.length} ejercicios cargados`);
  return exercises;
}

async function loadFreeDbExercises(): Promise<FreeDbExercise[]> {
  const response = await fetch(FREE_DB_URL, {
    signal:  AbortSignal.timeout(FETCH_TIMEOUT),
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) throw new Error(`free-db respondió ${response.status}`);
  const data: FreeDbExercise[] = await response.json();
  console.log(`[free-db] ${data.length} ejercicios cargados`);
  return data;
}

// ── Fusión de datasets ────────────────────────────────────────────────────────

function mergeDatasets(wgerList: WgerExercise[], freeList: FreeDbExercise[]): WgerExercise[] {
  const MATCH_THRESHOLD = 0.7;
  const merged: WgerExercise[] = [];
  const usedFreeIds = new Set<string>();

  for (const wgerEx of wgerList) {
    let bestScore = 0;
    let bestFree: FreeDbExercise | null = null;

    for (const freeEx of freeList) {
      const score = wordOverlapScore(wgerEx.name_en, freeEx.name);
      if (score > bestScore) { bestScore = score; bestFree = freeEx; }
    }

    if (bestFree && bestScore >= MATCH_THRESHOLD) {
      usedFreeIds.add(bestFree.id);
      const freeImages       = buildImageUrls(bestFree.images);
      const freeInstructions = buildInstructions(bestFree.instructions);
      const isCompound       = bestFree.mechanic === 'compound' || wgerEx.muscles.length >= 3;

      merged.push({
        ...wgerEx,
        free_db_id:  bestFree.id,
        description: wgerEx.description ?? freeInstructions,
        images:      freeImages.length > 0 ? freeImages : wgerEx.images,
        level:       bestFree.level ?? null,
        mechanic:    bestFree.mechanic ?? null,
        is_compound: isCompound,
      });
    } else {
      merged.push(wgerEx);
    }
  }

  // Agregar ejercicios de free-db sin equivalente en wger
  for (const freeEx of freeList) {
    if (usedFreeIds.has(freeEx.id)) continue;
    merged.push({
      wger_id:           null,
      free_db_id:        freeEx.id,
      name_es:           null,
      name_en:           freeEx.name,
      description:       buildInstructions(freeEx.instructions),
      muscles:           [],
      muscles_secondary: [],
      equipment:         freeEx.equipment ? [{ id: 0, name: freeEx.equipment }] : [],
      images:            buildImageUrls(freeEx.images),
      category:          freeEx.category,
      level:             freeEx.level ?? null,
      mechanic:          freeEx.mechanic ?? null,
      is_compound:       freeEx.mechanic === 'compound',
    });
  }

  console.log(`[merge] Total: ${merged.length} | con wger: ${merged.filter(e => e.wger_id).length} | con free-db: ${merged.filter(e => e.free_db_id).length} | con imágenes: ${merged.filter(e => e.images.length > 0).length}`);
  return merged;
}

// ── Carga combinada ───────────────────────────────────────────────────────────

async function translateNames(exercises: WgerExercise[]): Promise<WgerExercise[]> {
  const DEEPL_API_KEY = process.env.DEEPL_API_KEY ?? '';
  if (!DEEPL_API_KEY) {
    console.warn('[deepl] DEEPL_API_KEY no configurada — nombres sin traducir');
    return exercises;
  }

  const needsTranslation = exercises.filter(ex => !ex.name_es && ex.name_en);
  if (needsTranslation.length === 0) return exercises;

  console.log(`[deepl] Traduciendo ${needsTranslation.length} nombres sin español...`);

  const BATCH = 50;
  const translated      = new Map<string, string>();
  const translatedDescs = new Map<string, string>();

  for (let i = 0; i < needsTranslation.length; i += BATCH) {
    const batch = needsTranslation.slice(i, i + BATCH);
    try {
      const namesSlice = batch.map(ex => ex.name_en);
      const descsSlice = batch.map(ex =>
        ex.description ? ex.description.slice(0, 300) : ''
      );

      const body = new URLSearchParams();
      body.append('target_lang', 'ES');
      body.append('source_lang', 'EN');
      [...namesSlice, ...descsSlice].forEach(text => body.append('text', text));

      const res = await fetch(DEEPL_URL, {
        method: 'POST',
        body,
        headers: {
          'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        console.error(`[deepl] Error ${res.status} en batch ${i / BATCH + 1}`);
        break;
      }

      const data: any = await res.json();
      const translations = data.translations ?? [];

      // Las primeras batch.length son nombres, las siguientes son descripciones
      translations.slice(0, batch.length).forEach((t: any, idx: number) => {
        translated.set(batch[idx].name_en, toSentenceCase(t.text));
      });
      translations.slice(batch.length).forEach((t: any, idx: number) => {
        if (batch[idx].description && t.text) {
          translatedDescs.set(batch[idx].name_en, t.text);
        }
      });
    } catch (err: any) {
      console.error(`[deepl] Timeout/error en batch ${i / BATCH + 1}:`, err.message);
      break;
    }
  }

  const result = exercises.map(ex => ({
    ...ex,
    name_es: ex.name_es ?? translated.get(ex.name_en) ?? null,
    description: ex.description
      ? (translatedDescs.get(ex.name_en) ?? ex.description)
      : null,
  }));

  console.log(`[deepl] ${translated.size} nombres y descripciones traducidas`);
  return result;
}

async function loadAllExercises(): Promise<WgerExercise[]> {
  console.log('[exercises] Cargando catálogos en paralelo...');

  // Cargar nombres de músculos en español primero
  await loadMuscleNames();

  const [wgerList, freeList] = await Promise.all([
    loadWgerExercises().catch((err: any) => {
      console.error('[wger] Error:', err.message);
      return [] as WgerExercise[];
    }),
    loadFreeDbExercises().catch((err: any) => {
      console.error('[free-db] Error:', err.message);
      return [] as FreeDbExercise[];
    }),
  ]);

  if (wgerList.length === 0 && freeList.length === 0) {
    throw new Error('Ambos catálogos fallaron');
  }

  if (wgerList.length === 0) {
    console.warn('[exercises] wger no disponible — usando solo free-db + traducciones locales');
    const freeOnly = freeList.map((freeEx: FreeDbExercise) => ({
      wger_id: null, free_db_id: freeEx.id,
      name_es: null, name_en: freeEx.name,
      description: buildInstructions(freeEx.instructions),
      muscles: [], muscles_secondary: [],
      equipment: freeEx.equipment ? [{ id: 0, name: freeEx.equipment }] : [],
      images: buildImageUrls(freeEx.images),
      category: freeEx.category, level: freeEx.level,
      mechanic: freeEx.mechanic ?? null,
      is_compound: freeEx.mechanic === 'compound',
    }));
    
    const withLocal = applyLocalTranslations(freeOnly);
    // Solo llamar a DeepL para lo que falte
    return translateNames(withLocal);
  }

  if (freeList.length === 0) {
    console.warn('[exercises] Solo wger disponible — imágenes de wger.de');
    return applyLocalTranslations(wgerList);
  }

  const merged = mergeDatasets(wgerList, freeList);
  const withLocal = applyLocalTranslations(merged);
  return translateNames(withLocal);
}

async function getExercises(): Promise<WgerExercise[]> {
  const now = Date.now();
  if (mergedCache && now - mergedCache.loadedAt < CACHE_TTL_MS) {
    return mergedCache.exercises;
  }
  if (loadingPromise) return loadingPromise;

  loadingPromise = loadAllExercises()
    .then(exercises => {
      mergedCache    = { exercises, loadedAt: Date.now() };
      loadingPromise = null;
      return exercises;
    })
    .catch(err => {
      loadingPromise = null;
      throw err;
    });

  return loadingPromise;
}

// ── Búsqueda ──────────────────────────────────────────────────────────────────

function scoreExercise(ex: WgerExercise, q: string): number {
  const q_norm  = normalizeText(q);
  const es_norm = ex.name_es ? normalizeText(ex.name_es) : '';
  const en_norm = normalizeText(ex.name_en);

  if (es_norm === q_norm || en_norm === q_norm) return 3.0;
  if (es_norm.startsWith(q_norm)) return 2.0;
  if (en_norm.startsWith(q_norm)) return 1.8;
  if (es_norm.includes(q_norm))   return 1.5;
  if (en_norm.includes(q_norm))   return 1.2;

  const overlap = Math.max(
    es_norm ? wordOverlapScore(q, ex.name_es ?? '') : 0,
    wordOverlapScore(q, ex.name_en),
  );
  return overlap >= 0.5 ? overlap : 0;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

router.get('/exercises/search', async (req: Request, res: Response) => {
  try {
    const q     = ((req.query.q as string) ?? '').trim();
    const limit = Math.min(parseInt((req.query.limit as string) ?? '10', 10), 20);

    if (q.length < 2) {
      return res.status(400).json({ error: 'El término debe tener al menos 2 caracteres.' });
    }

    const allExercises = await getExercises();

    const results = allExercises
      .map(ex => ({ ex, score: scoreExercise(ex, q) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        
        // Priorizar ejercicios locales personalizados (ID >= 9000)
        const aIsCustom = (a.ex.wger_id && a.ex.wger_id >= 9000) ? 1 : 0;
        const bIsCustom = (b.ex.wger_id && b.ex.wger_id >= 9000) ? 1 : 0;
        if (bIsCustom !== aIsCustom) return bIsCustom - aIsCustom;

        // Desempate: imágenes disponibles → nombre en español
        const imgDiff = (b.ex.images.length > 0 ? 1 : 0) - (a.ex.images.length > 0 ? 1 : 0);
        if (imgDiff !== 0) return imgDiff;
        return (b.ex.name_es ? 1 : 0) - (a.ex.name_es ? 1 : 0);
      })
      .slice(0, limit)
      .map(({ ex }) => ex);

    res.json({ query: q, results, cached: !!mergedCache });
  } catch (err: any) {
    (req as any).log?.error({ err }, 'Error en búsqueda de ejercicios');
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.json({ query: req.query.q, results: [], cached: false, error: 'timeout' });
    }
    res.status(502).json({ error: 'No se pudo conectar con el catálogo.' });
  }
});

router.get('/exercises/:wgerId/info', async (req: Request, res: Response) => {
  try {
    const wgerId = parseInt(String(req.params.wgerId), 10);
    if (isNaN(wgerId) || wgerId <= 0) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const cached = infoCache.get(wgerId);
    if (cached && Date.now() < cached.expires) return res.json(cached.data);

    const all   = await getExercises();
    const found = all.find(ex => ex.wger_id === wgerId);
    if (!found) return res.status(404).json({ error: 'Ejercicio no encontrado.' });

    infoCache.set(wgerId, { data: found, expires: Date.now() + CACHE_TTL_MS });
    res.json(found);
  } catch (err: any) {
    (req as any).log?.error({ err }, 'Error obteniendo info de ejercicio');
    res.status(502).json({ error: 'No se pudo obtener la información.' });
  }
});

router.get('/exercises/cache/export', (_req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).end();
  const exercises = mergedCache?.exercises ?? [];
  res.json(exercises.map(e => ({
    id:          e.wger_id ?? e.free_db_id,
    name_en:     e.name_en,
    name_es:     e.name_es,
    description: e.description,
  })));
});

router.get('/exercises/cache/status', (_req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'No disponible.' });
  }
  const exercises = mergedCache?.exercises ?? [];
  res.json({
    loaded:            !!mergedCache,
    total:             exercises.length,
    with_wger_id:      exercises.filter(e => e.wger_id).length,
    with_free_db_id:   exercises.filter(e => e.free_db_id).length,
    with_images:       exercises.filter(e => e.images.length > 0).length,
    with_both_sources: exercises.filter(e => e.wger_id && e.free_db_id).length,
    with_name_es:      exercises.filter(e => e.name_es).length,
    with_instructions: exercises.filter(e => e.description).length,
    loaded_at:         mergedCache ? new Date(mergedCache.loadedAt).toISOString() : null,
  });
});

export default router;
