# OSM Overpass Scraper — Importar entidades deportivas de OpenStreetMap

Importa clubes, centros deportivos, canchas, piscinas y gimnasios de OpenStreetMap (vía Overpass API gratuita) a `public.schools` con dedup contra los datasets existentes (IDRD, deportebogota, mindeporte).

## ¿Qué importa?

| Tag OSM                       | `school_type` SportMaps | Visible en mapa |
|-------------------------------|-------------------------|-----------------|
| `club=sport`                  | `club`                  | Sí (azul)       |
| `leisure=sports_centre`       | `academy`               | Sí (verde)      |
| `leisure=pitch`               | `facility`              | Sí (gris)       |
| `leisure=swimming_pool`       | `facility`              | Sí (gris)       |
| `leisure=fitness_centre`      | `facility`              | Sí (gris)       |

`facility` es el nuevo tipo (introducido en `fix_v8`): infraestructura sin operador SaaS, no recibe trial, no acepta familias, solo aparece como info en el mapa público.

## Pre-requisitos

```bash
pip install requests
```

Sin API key. Sin auth. Overpass es completamente gratuito (rate limit ~10k queries/día por IP).

## Cómo correr

```bash
cd c:/Users/Usuario/Documents/demo/sportmaps-demo
python scripts/scrape_osm_colombia.py
```

Tarda **~30-90 segundos** según carga del endpoint Overpass. El script rota entre 3 endpoints si uno cae.

Output: `supabase/seed/osm_colombia_2026.sql`

Estimación esperada (Colombia completa): **1500-3500 entidades** después de dedup.

## Aplicar en staging

```bash
# Opción A: aplicar directo
psql "$DATABASE_URL" -f supabase/seed/osm_colombia_2026.sql

# Opción B: appendar al consolidated (recomendado para staging)
cat supabase/seed/osm_colombia_2026.sql >> docs/_apply_to_staging_consolidated.sql
# Luego pegar en Supabase SQL Editor
```

**IMPORTANTE:** Aplicar `fix_v8_facility_type_osm_support.sql` ANTES del seed OSM. Sin el fix_v8, las `facility` insertadas dispararán el trigger `create_default_school_subscription` y se les creará un trial (mal).

Orden correcto:
1. `fix_v8_facility_type_osm_support.sql`
2. `osm_colombia_2026.sql`

## Dedup

El SQL generado incluye dedup automático por:
1. **external_ref UNIQUE**: `OSM-<type>-<id>-<hash>` evita reinserciones del mismo nodo OSM.
2. **Nombre + ciudad**: si ya existe una school con nombre similar (normalizado lowercase sin tildes) en la misma ciudad, registra el match en `external_school_imports` pero NO duplica la fila en `schools`.

Para ver cuántas coincidieron con datasets previos:

```sql
SELECT COUNT(*) AS matches_existing
FROM public.external_school_imports
WHERE source = 'osm_colombia_2026'
  AND school_id IN (
    SELECT school_id FROM public.external_school_imports
     WHERE source IN ('idrd_bogota_2026', 'deportebogota_2026', 'mindeporte_entidades_2025_2026')
  );
```

## Verificación post-import

```sql
-- Conteo por tipo (esperar facility >> 0 después de OSM)
SELECT school_type, COUNT(*)
  FROM public.schools
 GROUP BY school_type
 ORDER BY 2 DESC;

-- Breakdown OSM
SELECT s.school_type, COUNT(*) AS total,
       COUNT(*) FILTER (WHERE b.lat IS NOT NULL) AS con_lat
  FROM public.external_school_imports e
  JOIN public.schools s ON s.id = e.school_id
  LEFT JOIN public.school_branches b ON b.school_id = s.id AND b.is_main
 WHERE e.source = 'osm_colombia_2026'
 GROUP BY s.school_type
 ORDER BY 2 DESC;
```

## Limitaciones conocidas

- **Cobertura desigual**: OSM tiene buena densidad en Bogotá, Medellín, Cali; menos en pueblos pequeños.
- **Phone/website**: solo ~30% de los nodos tienen tags `phone`/`website`.
- **Sport tag**: ~70% de los nodos tienen `sport=*`; el resto entran como `Multideporte`.
- **Nombres**: nodos sin `name=*` se descartan (no aparecen en el SQL output).

## Próximo paso opcional: Google Places enrichment

Para llenar gaps de phone/website en las top 5 ciudades, ver `docs/GOOGLE_PLACES_ENRICHMENT.md` (no implementado aún).
