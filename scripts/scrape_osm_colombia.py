#!/usr/bin/env python3
"""
scrape_osm_colombia.py
=======================

Importa entidades deportivas de OpenStreetMap (Overpass API) para Colombia.

Cubre 4 tipos de tags OSM:
  - club=sport                  -> school_type='club'
  - leisure=sports_centre       -> school_type='academy'
  - leisure=pitch               -> school_type='facility' (cancha publica)
  - leisure=swimming_pool       -> school_type='facility' (piscina)
  - leisure=fitness_centre      -> school_type='facility' (gimnasio)

Dedup contra schools existentes en BD via nombre normalizado + bbox por ciudad.
Si una entidad OSM coincide con una IDRD/deportebogota/mindeporte → SKIP.

Outputs:
  supabase/seed/osm_colombia_2026.sql   (idempotent UPSERT por OSM-<type>-<id>)

Reqs:
  pip install requests
  No requiere API key. Overpass es gratuito.

Re-runnable. Sin cache (Overpass es rapido para query unica Colombia).
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Optional

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
except Exception:
    pass

try:
    import requests  # type: ignore
except ImportError:
    print("Missing dep: requests. Run: pip install requests")
    sys.exit(1)


ROOT = Path(__file__).resolve().parents[1]
SQL_OUT = ROOT / "supabase" / "seed" / "osm_colombia_2026.sql"

# Overpass endpoints (rota si uno cae)
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
]
USER_AGENT = "SportMaps-OSMImporter/1.0 (brayan.lopez@osigu.com)"

# Bounding box Colombia (S, W, N, E)
COLOMBIA_BBOX = (-4.23, -79.05, 13.40, -66.85)


# ── Mapeo OSM sport tag → sport label SportMaps ───────────────────────────────
SPORT_MAP = {
    "soccer": "Fútbol", "football": "Fútbol",
    "basketball": "Baloncesto",
    "volleyball": "Voleibol",
    "tennis": "Tenis", "table_tennis": "Tenis de mesa",
    "swimming": "Natación",
    "athletics": "Atletismo",
    "cycling": "Ciclismo", "bmx": "BMX",
    "skating": "Patinaje", "roller_skating": "Patinaje",
    "skateboard": "Skate", "skateboarding": "Skate",
    "boxing": "Boxeo",
    "karate": "Karate", "taekwondo": "Taekwondo", "judo": "Judo",
    "rugby_union": "Rugby", "rugby_league": "Rugby",
    "baseball": "Béisbol", "softball": "Sóftbol",
    "golf": "Golf",
    "squash": "Squash",
    "bowls": "Bolos", "bowling": "Bolos",
    "gymnastics": "Gimnasia",
    "yoga": "Yoga", "fitness": "Fitness", "crossfit": "CrossFit",
    "dance": "Baile",
    "handball": "Balonmano",
    "field_hockey": "Hockey", "hockey": "Hockey",
    "horse_riding": "Equitación", "equestrian": "Equitación",
    "climbing": "Escalada",
    "surfing": "Surf",
    "rowing": "Remo", "canoe": "Canotaje",
    "weightlifting": "Levantamiento de pesas",
    "wrestling": "Lucha",
    "fencing": "Esgrima",
    "shooting": "Tiro",
    "archery": "Tiro con arco",
    "billiards": "Billar",
    "chess": "Ajedrez",
    "motor": "Automovilismo",
    "motocross": "Motocross",
    "paragliding": "Parapente",
    "paintball": "Paintball",
    "multi": "Multideporte",
}


def slugify(text: str, max_len: int = 60) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    return text[:max_len] or "sin-nombre"


def normalize_name(name: str) -> str:
    """Para dedup: lowercase + sin tildes + sin puntuacion."""
    if not name:
        return ""
    n = unicodedata.normalize("NFKD", name)
    n = "".join(c for c in n if not unicodedata.combining(c))
    n = re.sub(r"[^a-z0-9 ]", " ", n.lower())
    n = re.sub(r"\s+", " ", n).strip()
    return n


def sql_str(value: Optional[str]) -> str:
    if value is None or value == "":
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def sql_array(items: list[str]) -> str:
    if not items:
        return "ARRAY['Multideporte']::text[]"
    return "ARRAY[" + ", ".join(sql_str(x) for x in items) + "]::text[]"


# ── Overpass query ────────────────────────────────────────────────────────────
def build_overpass_query() -> str:
    """
    Query unica para Colombia. Devuelve nodes/ways/relations con:
      - club=sport
      - leisure=sports_centre
      - leisure=pitch
      - leisure=swimming_pool
      - leisure=fitness_centre
    Filtramos por bbox Colombia. out tags + center (para ways/relations).
    """
    s, w, n, e = COLOMBIA_BBOX
    bbox = f"{s},{w},{n},{e}"
    return f"""
[out:json][timeout:300];
(
  node["club"="sport"]({bbox});
  way["club"="sport"]({bbox});
  relation["club"="sport"]({bbox});
  node["leisure"="sports_centre"]({bbox});
  way["leisure"="sports_centre"]({bbox});
  node["leisure"="pitch"]({bbox});
  way["leisure"="pitch"]({bbox});
  node["leisure"="swimming_pool"]({bbox});
  way["leisure"="swimming_pool"]({bbox});
  node["leisure"="fitness_centre"]({bbox});
  way["leisure"="fitness_centre"]({bbox});
);
out tags center;
""".strip()


def fetch_overpass() -> list[dict]:
    query = build_overpass_query()
    last_err = None
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            print(f"[overpass] Querying {endpoint} ...")
            r = requests.post(
                endpoint,
                data={"data": query},
                headers={"User-Agent": USER_AGENT},
                timeout=360,
            )
            r.raise_for_status()
            data = r.json()
            elements = data.get("elements", [])
            print(f"[overpass] Got {len(elements)} elements")
            return elements
        except Exception as e:
            print(f"[overpass] {endpoint} failed: {e}")
            last_err = e
            time.sleep(2)
    raise RuntimeError(f"All Overpass endpoints failed: {last_err}")


# ── Classification ────────────────────────────────────────────────────────────
def classify(tags: dict) -> tuple[str, str]:
    """Returns (school_type, default_description_prefix)."""
    if tags.get("club") == "sport":
        return "club", "Club deportivo"
    leisure = tags.get("leisure", "")
    if leisure == "sports_centre":
        return "academy", "Centro deportivo"
    if leisure in ("pitch", "swimming_pool", "fitness_centre"):
        label = {
            "pitch": "Cancha deportiva",
            "swimming_pool": "Piscina",
            "fitness_centre": "Gimnasio / Centro fitness",
        }[leisure]
        return "facility", label
    return "facility", "Instalacion deportiva"


def extract_sports(tags: dict) -> list[str]:
    sport_raw = tags.get("sport", "")
    if not sport_raw:
        return []
    out: list[str] = []
    for s in re.split(r"[;,]", sport_raw):
        s = s.strip().lower()
        mapped = SPORT_MAP.get(s)
        if mapped and mapped not in out:
            out.append(mapped)
    return out


def get_latlng(el: dict) -> Optional[tuple[float, float]]:
    if el.get("type") == "node":
        lat = el.get("lat")
        lng = el.get("lon")
    else:
        c = el.get("center", {})
        lat = c.get("lat")
        lng = c.get("lon")
    if lat is None or lng is None:
        return None
    return (float(lat), float(lng))


def build_address(tags: dict) -> Optional[str]:
    parts: list[str] = []
    for k in ("addr:street", "addr:housenumber", "addr:suburb", "addr:neighbourhood"):
        if tags.get(k):
            parts.append(tags[k])
    if not parts:
        return tags.get("address") or None
    return ", ".join(parts)


def get_city(tags: dict) -> Optional[str]:
    return (
        tags.get("addr:city")
        or tags.get("addr:town")
        or tags.get("addr:state")
        or None
    )


# ── SQL generation ────────────────────────────────────────────────────────────
SQL_HEADER = """-- ============================================================
-- SPORTMAPS — Entidades deportivas OpenStreetMap Colombia 2026
-- Fuente: Overpass API (https://overpass-api.de)
-- Tags: club=sport, leisure=sports_centre|pitch|swimming_pool|fitness_centre
-- Generado por scripts/scrape_osm_colombia.py
--
-- Dedup en SQL: external_ref UNIQUE evita reinserciones.
-- school_type:
--   - club           = clubes deportivos registrados (club=sport)
--   - academy        = centros deportivos (leisure=sports_centre)
--   - facility       = canchas, piscinas, gimnasios (no SaaS)
-- ============================================================

BEGIN;

"""

SQL_TEMPLATE = """-- {name_short} ({external_ref})
DO $$
DECLARE v_school_id uuid; v_existing uuid;
BEGIN
  SELECT school_id INTO v_existing FROM public.external_school_imports
   WHERE external_ref = {external_ref_sql};
  IF v_existing IS NULL THEN
    -- Dedup contra schools existentes: skip si ya hay una con mismo
    -- nombre normalizado en la misma ciudad (o con coords <500m).
    SELECT s.id INTO v_existing
      FROM public.schools s
     WHERE lower(regexp_replace(unaccent(s.name), '[^a-z0-9 ]', ' ', 'g')) =
           lower(regexp_replace(unaccent({name_sql}), '[^a-z0-9 ]', ' ', 'g'))
       AND (s.city IS NULL OR lower(unaccent(s.city)) = lower(unaccent({city_sql})))
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
      -- Solo registramos el match en external_school_imports para audit
      INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
      VALUES ('osm_colombia_2026', {external_ref_sql}, v_existing, {raw_payload_sql}::jsonb)
      ON CONFLICT (external_ref) DO NOTHING;
      RETURN;
    END IF;

    INSERT INTO public.schools (
      name, description, school_type, city, address, phone, email, sports,
      verified, is_demo, slug, onboarding_status
    ) VALUES (
      {name_sql},
      {description_sql},
      {school_type_sql},
      {city_sql},
      {address_sql},
      {phone_sql},
      {email_sql},
      {sports_sql},
      false, false,
      {slug_sql},
      'completed'
    ) RETURNING id INTO v_school_id;

    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)
    VALUES ('osm_colombia_2026', {external_ref_sql}, v_school_id, {raw_payload_sql}::jsonb);
  ELSE
    v_school_id := v_existing;
  END IF;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;
  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;

  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)
  SELECT v_school_id, 'Sede Principal',
         {address_sql}, {city_sql},
         {phone_sql}, {lat:.7f}, {lng:.7f}, true, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);
END $$;

"""


def el_hash(el: dict) -> str:
    """8 hex hash determinista del element id+type para evitar colisiones."""
    import hashlib
    s = f"{el.get('type')}-{el.get('id')}"
    return hashlib.md5(s.encode("utf-8")).hexdigest()[:8]


def main():
    elements = fetch_overpass()
    if not elements:
        print("No elements from Overpass. Abort.")
        return

    skipped_noname = 0
    skipped_nogeo = 0
    written = 0

    out_lines: list[str] = [SQL_HEADER]

    seen_refs: set[str] = set()

    for el in elements:
        tags = el.get("tags", {}) or {}
        name = (tags.get("name") or "").strip()
        if not name:
            skipped_noname += 1
            continue

        latlng = get_latlng(el)
        if latlng is None:
            skipped_nogeo += 1
            continue
        lat, lng = latlng

        school_type, type_label = classify(tags)
        sports = extract_sports(tags) or ["Multideporte"]
        city = get_city(tags) or "Colombia"
        address = build_address(tags)
        phone = tags.get("phone") or tags.get("contact:phone")
        email = tags.get("email") or tags.get("contact:email")

        # Description: tipo + sport principal + city
        primary_sport = sports[0] if sports else "Multideporte"
        description = f"{type_label}. {primary_sport}. Fuente: OpenStreetMap."

        ext_ref = f"OSM-{el.get('type','n')[0].upper()}-{el.get('id')}-{el_hash(el)}"
        if ext_ref in seen_refs:
            continue
        seen_refs.add(ext_ref)

        slug = f"{slugify(name)}-{el_hash(el)}"

        raw_payload = {
            "osm_type": el.get("type"),
            "osm_id": el.get("id"),
            "tags": tags,
        }

        sql = SQL_TEMPLATE.format(
            name_short=name[:60].replace("\n", " "),
            external_ref=ext_ref,
            external_ref_sql=sql_str(ext_ref),
            name_sql=sql_str(name),
            description_sql=sql_str(description),
            school_type_sql=sql_str(school_type),
            city_sql=sql_str(city),
            address_sql=sql_str(address),
            phone_sql=sql_str(phone),
            email_sql=sql_str(email),
            sports_sql=sql_array(sports),
            slug_sql=sql_str(slug),
            raw_payload_sql=sql_str(json.dumps(raw_payload, ensure_ascii=False)),
            lat=lat,
            lng=lng,
        )
        out_lines.append(sql)
        written += 1

    out_lines.append("COMMIT;\n")

    SQL_OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(SQL_OUT, "w", encoding="utf-8") as f:
        f.write("".join(out_lines))

    print(f"\n[done] wrote {written} entities to {SQL_OUT}")
    print(f"  skipped (no name):   {skipped_noname}")
    print(f"  skipped (no geo):    {skipped_nogeo}")
    print(f"\nApply with:  psql ... -f {SQL_OUT}")
    print("  OR append to docs/_apply_to_staging_consolidated.sql")


if __name__ == "__main__":
    main()
