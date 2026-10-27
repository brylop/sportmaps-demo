import { useCallback, useEffect, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { matchSocialUrl, type MatchComment, type MatchMedia, type MatchSocialDto } from '@/components/tournaments/public/publicModel';

/**
 * Comentarios y fotos de un partido (endpoint de «vivo»). Si el endpoint aún no existe (404) o falla,
 * devuelve listas vacías y la página muestra su estado vacío: nunca rompe la página del partido.
 */
export function useMatchSocial(slug: string | undefined, matchId: string | undefined) {
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [media, setMedia] = useState<MatchMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);

  const load = useCallback(async () => {
    if (!slug || !matchId) return;
    try {
      const r = await bffClient.get<MatchSocialDto>(matchSocialUrl(slug, matchId), undefined, 'public');
      setComments(Array.isArray(r?.comments) ? r.comments : []);
      setMedia(Array.isArray(r?.media) ? r.media : []);
      setAvailable(true);
    } catch {
      setAvailable(false);
    } finally { setLoading(false); }
  }, [slug, matchId]);

  useEffect(() => { void load(); }, [load]);
  return { comments, media, loading, available, reload: load };
}
