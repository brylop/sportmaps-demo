/**
 * geocoding.util.ts
 * Convierte dirección → lat/lng usando Nominatim (OpenStreetMap).
 * 100% gratuito, sin API key requerida.
 *
 * Límite de uso: 1 req/segundo (uso razonable).
 * Resultados se persisten en BD para no repetir llamadas.
 */

interface Coords {
  lat: number;
  lng: number;
}

// ─── Nominatim (OpenStreetMap) ────────────────────────────────────────────────

export async function geocodeAddress(
  address: string,
  city?: string | null
): Promise<Coords | null> {
  const query = [address, city, "Colombia"].filter(Boolean).join(", ");

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "co");

    const res = await fetch(url.toString(), {
      headers: {
        // Nominatim requiere un User-Agent identificable
        "User-Agent": "SportMaps/1.0 (contacto@sportmaps.co)",
      },
    });

    if (!res.ok) return null;

    const results = await res.json();

    if (results?.[0]) {
      return {
        lat: parseFloat(results[0].lat),
        lng: parseFloat(results[0].lon),
      };
    }

    return null;
  } catch (err) {
    console.error("[geocoding] Nominatim error:", err);
    return null;
  }
}

// ─── Enriquecer branches con coords ──────────────────────────────────────────

type Branch = {
  id: string;
  address?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  [key: string]: any;
};

/**
 * Recorre el array de branches y geocodifica las que no tienen lat/lng.
 * Llama a saveFn para persistir en BD (en background, sin bloquear respuesta).
 *
 * Nota: procesa de forma secuencial para respetar el rate limit de Nominatim.
 */
export async function enrichBranchesWithCoords(
  branches: Branch[],
  saveFn: (id: string, lat: number, lng: number) => Promise<void>
): Promise<Branch[]> {
  const result: Branch[] = [];

  for (const b of branches) {
    // Ya tiene coords → no tocar
    if (b.lat && b.lng) {
      result.push(b);
      continue;
    }

    // Sin dirección → no se puede geocodificar
    if (!b.address) {
      result.push(b);
      continue;
    }

    const coords = await geocodeAddress(b.address, b.city);

    if (coords) {
      // Guardar en BD en background (no bloquea la respuesta al cliente)
      saveFn(b.id, coords.lat, coords.lng).catch((e) =>
        console.error("[geocoding] Error guardando coords en BD:", e)
      );
      result.push({ ...b, lat: coords.lat, lng: coords.lng });
    } else {
      result.push(b);
    }
  }

  return result;
}
