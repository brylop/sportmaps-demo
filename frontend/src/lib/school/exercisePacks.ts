/**
 * Paquetes de la Biblioteca de ejercicios — pizarra M2 (D4 de
 * docs/specs/pizarra-multideporte-3d-ia.md). Llamadas al BFF
 * /api/v1/school/exercise-packs (bff/src/routes/school/exercisePacks.ts) y
 * lectura/descarga del archivo .json (formato 'sportmaps-ejercicios' v1).
 *
 * Quién puede activar o importar lo decide el BFF (`can_manage` en el
 * listado), no el frontend: la pantalla solo esconde los botones.
 */
import { bffClient } from '@/lib/api/bffClient';
import type { ExerciseSport } from './exerciseLibrary';

export const PACK_FILE_FORMAT = 'sportmaps-ejercicios';
export const PACK_FILE_VERSION = 1;
/** Igual que MAX_IMPORT_BYTES del BFF. */
export const MAX_PACK_FILE_BYTES = 4 * 1024 * 1024;

export interface ExercisePack {
  id: string;
  name: string;
  description: string | null;
  sport: ExerciseSport;
  version: number;
  is_system: boolean;
  /** Sistema: la escuela lo activó. Propio: no está desactivado. */
  activated: boolean;
  /** ¿Sus ejercicios salen hoy en la biblioteca? */
  visible: boolean;
  exercise_count: number;
  updated_at: string;
}

export interface ExercisePackList {
  /** 'todos': no activó ninguno y ve todos los de sus deportes. 'seleccion': solo los activados + los suyos. */
  mode: 'todos' | 'seleccion';
  can_manage: boolean;
  /** Ejercicios propios que no están en ningún paquete (para «Exportar mis ejercicios»). */
  loose_own_count: number;
  packs: ExercisePack[];
}

export interface PackSummary {
  name: string;
  sport: ExerciseSport | null;
  exercises: number;
  sports: ExerciseSport[];
}

export interface PackPreview {
  valid: boolean;
  errors: string[];
  summary: PackSummary | null;
}

export interface PackImportResult {
  pack_id: string;
  exercises: number;
  summary: PackSummary | null;
}

/** Archivo sportmaps-ejercicios v1 (lo que exporta el BFF). */
export interface PackFile {
  format: string;
  version: number;
  exported_at?: string;
  pack: { name: string; description?: string | null; sport: string; version?: number };
  exercises: Record<string, unknown>[];
}

const BASE = '/api/v1/school/exercise-packs';

export function listExercisePacks(): Promise<ExercisePackList> {
  return bffClient.get<ExercisePackList>(BASE);
}

export function activateExercisePack(id: string): Promise<unknown> {
  return bffClient.post(`${BASE}/${id}/activate`, {});
}

export function deactivateExercisePack(id: string): Promise<unknown> {
  return bffClient.post(`${BASE}/${id}/deactivate`, {});
}

export function exportExercisePack(id: string | 'mine'): Promise<PackFile> {
  return bffClient.get<PackFile>(`${BASE}/${id}/export`);
}

/** Vista previa: el BFF valida el archivo completo SIN escribir nada. */
export function previewPackImport(file: unknown): Promise<PackPreview> {
  return bffClient.post<PackPreview>(`${BASE}/import?dry_run=true`, file);
}

export function importExercisePack(file: unknown): Promise<PackImportResult> {
  return bffClient.post<PackImportResult>(`${BASE}/import`, file);
}

/** Nombre de archivo seguro (mismo criterio que packFileName del BFF). */
export function packFileName(name: string): string {
  const slug = name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `paquete-${slug || 'ejercicios'}.json`;
}

/** Descarga el archivo en el navegador. */
export function downloadPackFile(file: PackFile): string {
  const filename = packFileName(file.pack?.name ?? '');
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

/**
 * Lee el archivo elegido. Solo revisa lo mínimo para no mandar basura al BFF
 * (tamaño y que sea JSON); la validación de verdad es la del BFF.
 */
export async function readPackFile(file: Blob & { name?: string }): Promise<{ data: unknown } | { error: string }> {
  if (file.size > MAX_PACK_FILE_BYTES) return { error: 'El archivo pesa más de 4 MB.' };
  let text: string;
  try {
    text = typeof file.text === 'function'
      ? await file.text()
      : await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result ?? ''));
          r.onerror = () => reject(r.error);
          r.readAsText(file);
        });
  } catch {
    return { error: 'No pudimos leer el archivo.' };
  }
  try {
    return { data: JSON.parse(text) };
  } catch {
    return { error: 'El archivo no es un JSON válido. Elige un paquete exportado desde SportMaps (.json).' };
  }
}
