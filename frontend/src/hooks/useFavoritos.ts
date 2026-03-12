import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "sportmaps_favoritos";

function loadFavs(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useFavoritos() {
  const [favoritos, setFavoritos] = useState<string[]>(loadFavs);

  // Persistir cada vez que cambia
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favoritos));
  }, [favoritos]);

  const isFavorito = useCallback((id: string) => favoritos.includes(id), [favoritos]);

  const toggleFavorito = useCallback((id: string) => {
    setFavoritos(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  }, []);

  return { favoritos, isFavorito, toggleFavorito };
}
