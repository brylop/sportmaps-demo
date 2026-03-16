/**
 * useFavoritos
 *
 * - Usuario autenticado  → sincroniza con `user_favorites` en BD via BFF
 * - Usuario anónimo      → persiste en localStorage
 * - Al hacer login       → migra automáticamente los favoritos locales a BD
 */

import { useState, useEffect, useCallback, useRef } from "react";

const LS_KEY        = "sportmaps_favoritos";
const BFF_URL       = import.meta.env.VITE_BFF_URL ?? "http://localhost:3001";

// ─── BFF helpers ─────────────────────────────────────────────────────────────

async function apiFetch(path: string, options?: RequestInit) {
  const res  = await fetch(`${BFF_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  return res.json();
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadLocalFavs(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalFavs(favs: string[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(favs));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseFavoritosOptions {
  /** Pasar el userId del contexto de auth de la app */
  userId?: string | null;
}

export function useFavoritos({ userId }: UseFavoritosOptions = {}) {
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [loading, setLoading]     = useState(false);
  const prevUserId = useRef<string | null | undefined>(undefined);

  // ── Cargar favoritos ────────────────────────────────────────────────────────

  useEffect(() => {
    if (userId) {
      // Usuario autenticado: cargar desde BD
      setLoading(true);
      apiFetch("/api/favoritos")
        .then((res) => {
          if (res.ok && Array.isArray(res.data)) {
            setFavoritos(res.data);
          }
        })
        .catch(() => {
          // Fallback a localStorage si falla el BFF
          setFavoritos(loadLocalFavs());
        })
        .finally(() => setLoading(false));
    } else {
      // Anónimo: cargar desde localStorage
      setFavoritos(loadLocalFavs());
    }
  }, [userId]);

  // ── Migrar local → BD al hacer login ───────────────────────────────────────

  useEffect(() => {
    // Solo ejecutar cuando userId cambia de null/undefined a un valor real
    if (userId && prevUserId.current !== userId) {
      const localFavs = loadLocalFavs();
      if (localFavs.length > 0) {
        apiFetch("/api/favoritos/migrate", {
          method: "POST",
          body: JSON.stringify({ school_ids: localFavs }),
        })
          .then((res) => {
            if (res.ok) {
              // Limpiamos los locales ya que ahora están en la BD
              localStorage.removeItem(LS_KEY);
              // Recargar favoritos desde BD después de migrar
              return apiFetch("/api/favoritos");
            }
          })
          .then((res) => {
            if (res?.ok && Array.isArray(res.data)) {
              setFavoritos(res.data);
            }
          })
          .catch(() => {});
      }
    }
    prevUserId.current = userId;
  }, [userId]);

  // ── Toggle ──────────────────────────────────────────────────────────────────

  const toggleFavorito = useCallback(async (schoolId: string) => {
    const isCurrentlyFav = favoritos.includes(schoolId);

    // Optimistic update inmediato
    const next = isCurrentlyFav
      ? favoritos.filter((id) => id !== schoolId)
      : [...favoritos, schoolId];
    setFavoritos(next);

    if (userId) {
      // Autenticado: sincronizar con BD
      try {
        const res = await apiFetch("/api/favoritos/toggle", {
          method: "POST",
          body: JSON.stringify({ school_id: schoolId }),
        });
        if (!res.ok) {
          // Revertir si falla
          setFavoritos(favoritos);
        }
      } catch {
        setFavoritos(favoritos); // revertir
      }
    } else {
      // Anónimo: solo localStorage
      saveLocalFavs(next);
    }
  }, [favoritos, userId]);

  const isFavorito = useCallback(
    (id: string) => favoritos.includes(id),
    [favoritos]
  );

  return { favoritos, isFavorito, toggleFavorito, loading };
}
