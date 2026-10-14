/**
 * Qué paquetes ve una escuela en su biblioteca (pizarra M2, D4 de
 * docs/specs/pizarra-multideporte-3d-ia.md; migración 20261014121142).
 *
 * Decisión de compatibilidad:
 *   · modo 'todos'     → la escuela no activó ningún paquete: ve TODAS las
 *                        plantillas SportMaps de sus deportes (lo de siempre).
 *                        Sin esto, al desplegar se vaciaba la biblioteca de todos.
 *   · modo 'seleccion' → activó al menos uno: ve solo las plantillas de los
 *                        paquetes activados (siempre ∩ sus deportes).
 * Los ejercicios propios se ven siempre, salvo los de un paquete propio
 * desactivado.
 *
 * Si la migración todavía no está aplicada (tablas o columna inexistentes)
 * devuelve null y la biblioteca funciona exactamente como antes de M2: el BFF
 * se puede desplegar antes que la migración sin romper nada.
 */
import { supabase } from '../../config/supabase';

export interface PackVisibility {
  mode: 'todos' | 'seleccion';
  /** Paquetes del sistema activados por la escuela. */
  activatedSystemPackIds: string[];
  /** Paquetes PROPIOS desactivados: sus ejercicios no salen en la biblioteca. */
  hiddenOwnPackIds: string[];
}

/** Error de PostgREST/Postgres por tabla o columna de M2 que todavía no existe. */
export function isMissingPacksSchema(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === '42P01' || e.code === 'PGRST205' || e.code === '42703' || e.code === 'PGRST204') return true;
  const msg = String(e.message ?? '');
  return /(exercise_packs|school_exercise_packs|pack_id)/.test(msg)
    && /(does not exist|schema cache|could not find)/i.test(msg);
}

export async function loadPackVisibility(schoolId: string): Promise<PackVisibility | null> {
  const [act, own] = await Promise.all([
    supabase.from('school_exercise_packs').select('pack_id').eq('school_id', schoolId),
    supabase.from('exercise_packs').select('id').eq('school_id', schoolId).eq('is_active', false),
  ]);
  for (const r of [act, own]) {
    if (r.error) {
      if (isMissingPacksSchema(r.error)) return null;
      throw r.error;
    }
  }
  const activatedSystemPackIds = ((act.data ?? []) as { pack_id: string }[]).map((r) => r.pack_id);
  const hiddenOwnPackIds = ((own.data ?? []) as { id: string }[]).map((r) => r.id);
  return {
    mode: activatedSystemPackIds.length > 0 ? 'seleccion' : 'todos',
    activatedSystemPackIds,
    hiddenOwnPackIds,
  };
}
