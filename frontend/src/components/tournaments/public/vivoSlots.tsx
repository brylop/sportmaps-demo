/**
 * PUNTOS DE ENCHUFE de «vivo» en la experiencia pública. Este archivo es de «vivo»: reemplaza el cuerpo de
 * cada slot; la firma de props es el contrato con «publico». Mientras no estén conectados no muestran nada,
 * para no dejar botones que no hacen nada.
 *
 * 1. `FollowSlot` — botón «Seguir» del torneo (encabezado).
 * 2. `CommentComposerSlot` — caja para escribir un comentario en la página del partido.
 * 3. El transporte en tiempo real se enchufa en `hooks/usePublicLive.ts` (ver «PUNTO DE ENCHUFE» allí).
 * 4. Comentarios y fotos: `useMatchSocial` (hooks/useMatchSocial.ts) lee
 *    `GET /api/v1/tournament-live/public/:slug/matches/:id/social` → `{ comments[], media[] }` (tipos en publicModel.ts).
 * 5. Ranking: si el payload público trae `player_stats[]`, aparece la pestaña Ranking.
 */
export interface FollowSlotProps {
  slug: string;
  title: string;
  /** Color de marca ya validado (#RRGGBB) o null. */
  brandColor: string | null;
}

export function FollowSlot(_props: FollowSlotProps) {
  return null;
}

export interface CommentComposerSlotProps {
  slug: string;
  matchId: string;
  /** Llamar después de publicar para recargar la lista. */
  onPosted: () => void;
}

export function CommentComposerSlot(_props: CommentComposerSlotProps) {
  return null;
}
