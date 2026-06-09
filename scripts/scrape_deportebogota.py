#!/usr/bin/env python3
"""
scrape_deportebogota.py
========================

Scrapes the deportebogota.com Directorist (WP plugin) directory: 82 sports
clubs across Bogota. For each:
  1. List via WP REST: /wp-json/wp/v2/at_biz_dir?per_page=100&page=N
  2. Detail via HTML: /perfil/<slug>/  (BeautifulSoup parser)
  3. Geocode address via Nominatim (cached, rate-limited 1.1s/req)

Outputs:
  supabase/seed/deportebogota_directorio_2026.sql   (idempotent UPSERT)
  Landing_page/.../mapData.deportebogota.ts          (TS for map)

Re-runnable. Cache: scripts/.geocode_cache.json (shared with IDRD importer).
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
    from bs4 import BeautifulSoup  # type: ignore
except ImportError as e:
    print(f"Missing dep: {e.name}. Run: pip install requests beautifulsoup4 lxml")
    sys.exit(1)


ROOT = Path(__file__).resolve().parents[1]
CACHE_FILE = ROOT / "scripts" / ".geocode_cache.json"
SQL_OUT = ROOT / "supabase" / "seed" / "deportebogota_directorio_2026.sql"
TS_OUT = Path(
    "C:/Users/Usuario/Documents/Landing_page/sportmap-maps-landing-page/frontend/src/data/mapData.deportebogota.ts"
)

API_BASE = "https://deportebogota.com/wp-json/wp/v2/at_biz_dir"
PROFILE_BASE = "https://deportebogota.com/perfil/"
USER_AGENT = "SportMaps-Importer/1.0 (brayan.lopez@osigu.com)"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
RATE_LIMIT = 1.1
BOGOTA_BOUNDS = (4.40, 4.85, -74.30, -73.90)


# ── Geocode cache (shared) ────────────────────────────────────────────────────

def load_cache() -> dict[str, dict]:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_cache(cache: dict[str, dict]) -> None:
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def in_bogota(lat: float, lng: float) -> bool:
    lo_lat, hi_lat, lo_lng, hi_lng = BOGOTA_BOUNDS
    return lo_lat <= lat <= hi_lat and lo_lng <= lng <= hi_lng


def geocode(query: str, cache: dict[str, dict]) -> Optional[tuple[float, float]]:
    key = query.strip().lower()
    if not key:
        return None
    if key in cache:
        v = cache[key]
        return (float(v["lat"]), float(v["lng"])) if v.get("lat") is not None else None

    for attempt in range(3):
        try:
            time.sleep(RATE_LIMIT if attempt == 0 else 3.0 * attempt)
            resp = requests.get(
                NOMINATIM_URL,
                params={
                    "q": query, "format": "json", "limit": 1, "countrycodes": "co",
                    "viewbox": f"{BOGOTA_BOUNDS[2]},{BOGOTA_BOUNDS[1]},{BOGOTA_BOUNDS[3]},{BOGOTA_BOUNDS[0]}",
                    "bounded": 1,
                },
                headers={"User-Agent": USER_AGENT},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            if not data:
                cache[key] = {"lat": None, "lng": None}
                save_cache(cache)
                return None
            lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
            if not in_bogota(lat, lng):
                cache[key] = {"lat": None, "lng": None}
                save_cache(cache)
                return None
            cache[key] = {"lat": lat, "lng": lng}
            save_cache(cache)
            return lat, lng
        except Exception as e:
            if attempt < 2:
                print(f"  [warn] geocode retry {attempt+1}: {str(e)[:80]}", flush=True)
                continue
    cache[key] = {"lat": None, "lng": None}
    save_cache(cache)
    return None


# ── Listings via WP REST ──────────────────────────────────────────────────────

def fetch_all_listings() -> list[dict]:
    out: list[dict] = []
    page = 1
    while True:
        try:
            resp = requests.get(
                API_BASE,
                params={"per_page": 100, "page": page, "_fields": "id,slug,title,link,date"},
                headers={"User-Agent": USER_AGENT},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            if not data:
                break
            out.extend(data)
            total_pages = int(resp.headers.get("X-WP-TotalPages", page))
            print(f"  Listings page {page}/{total_pages}: +{len(data)} (total {len(out)})", flush=True)
            if page >= total_pages:
                break
            page += 1
            time.sleep(0.5)
        except Exception as e:
            print(f"  [error] listings page {page}: {e}", flush=True)
            break
    return out


# ── Profile HTML scraper ──────────────────────────────────────────────────────

PHONE_RE = re.compile(r"3\d{9}|\d{7}")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")

# Deportes conocidos del directorio deportebogota.com (lowercase, sin tildes)
KNOWN_SPORTS = {
    "baloncesto", "futbol", "futbol sala", "natacion", "tenis", "voleibol",
    "karate", "taekwondo", "ciclismo", "judo", "patinaje", "skateboarding",
    "bmx race", "rollerblading", "rugby subacuatico", "tiro deportivo",
    "hockey", "atletismo", "gimnasia", "rugby", "boxeo",
}


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def html_unescape(s: str) -> str:
    if not s:
        return s
    return (s
        .replace("&#8211;", "–")
        .replace("&#8212;", "—")
        .replace("&#8217;", "'")
        .replace("&#8220;", '"')
        .replace("&#8221;", '"')
        .replace("&amp;", "&")
        .replace("&nbsp;", " ")
        .replace("&aacute;", "á").replace("&eacute;", "é").replace("&iacute;", "í")
        .replace("&oacute;", "ó").replace("&uacute;", "ú").replace("&ntilde;", "ñ"))


def parse_listing_title(title: str) -> tuple[Optional[str], Optional[str], str]:
    """
    Parsea titulos como:
      'Voleibol – Parque Roma – Club Enzona' -> ('Voleibol', 'Parque Roma', 'Club Enzona')
      'Barrio Álamos Norte – Club de Taekwondo Koryo' -> (None, 'Barrio Álamos Norte', 'Club de Taekwondo Koryo')
      'AC Mundo Deportes' -> (None, None, 'AC Mundo Deportes')
    Devuelve (sport, place, club_name).
    """
    title = html_unescape(title).strip()
    # Splitear por em-dash, en-dash o guion largo. NO usar guion simple porque
    # nombres tipo "Pre-Olimpico" se rompen.
    parts = [p.strip() for p in re.split(r"\s+[–—]\s+", title) if p.strip()]
    if not parts:
        return None, None, title

    sport = None
    place = None
    club = None

    first_norm = _strip_accents(parts[0]).lower()
    if first_norm in KNOWN_SPORTS:
        sport = parts[0]
        if len(parts) >= 3:
            place = parts[1]
            club = " – ".join(parts[2:])
        elif len(parts) == 2:
            club = parts[1]
    else:
        if len(parts) >= 2:
            place = parts[0]
            club = " – ".join(parts[1:])
        else:
            club = parts[0]

    return sport, place, club


def scrape_profile(slug: str) -> Optional[dict]:
    url = f"{PROFILE_BASE}{slug}/"
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
    except Exception as e:
        print(f"  [warn] profile fetch failed {slug}: {e}", flush=True)
        return None

    soup = BeautifulSoup(resp.text, "lxml")
    out: dict = {"slug": slug, "url": url}

    # Title
    title_el = soup.find("h1")
    out["name"] = title_el.get_text(strip=True) if title_el else slug

    # Logo / featured image — busca og:image meta (siempre presente)
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        out["logo_url"] = og["content"]
    else:
        out["logo_url"] = None

    # Texto completo del HTML para regex extracciones
    text = soup.get_text(" ", strip=True)

    # Email
    m = EMAIL_RE.search(text)
    out["email"] = m.group(0).lower() if m else None

    # Phone (tomar primer match que parezca celular colombiano)
    phones = PHONE_RE.findall(text)
    out["phone"] = phones[0] if phones else None

    # Address: Directorist suele renderizarlo bajo etiqueta "Dirección" o "Address"
    # Buscamos heuristicamente despues de esas palabras
    addr_match = None
    for pat in [
        r"Direcci[oó]n[:\s]+([^\n]{10,200})",
        r"Address[:\s]+([^\n]{10,200})",
    ]:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            addr_match = m.group(1).strip()
            break
    out["address"] = addr_match

    # Sport / Category — Directorist usa "Categoría" o muestra los terms del at_biz_dir-category
    sport = None
    # Buscar terms-list o links a /single-category/clubes_*
    cat_links = soup.find_all("a", href=re.compile(r"single-category/clubes_"))
    if cat_links:
        sport = cat_links[0].get_text(strip=True)
    else:
        # fallback: buscar "Categoría: <X>"
        m = re.search(r"Categor[ií]a[:\s]+([^\n]{2,40})", text, re.IGNORECASE)
        if m:
            sport = m.group(1).strip()
    out["sport"] = sport

    # Localidad
    locality = None
    m = re.search(r"Localidad[:\s]+([^\n]{2,40})", text, re.IGNORECASE)
    if m:
        locality = m.group(1).strip()
    out["locality"] = locality

    # Description: busca primer parrafo significativo
    descriptions = []
    for p in soup.find_all("p"):
        t = p.get_text(" ", strip=True)
        if 30 < len(t) < 500 and "Direcci" not in t and "@" not in t:
            descriptions.append(t)
            if len(descriptions) >= 2:
                break
    out["description"] = " ".join(descriptions) if descriptions else None

    # Social links
    socials = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if any(d in href for d in ["instagram.com", "facebook.com", "twitter.com", "x.com", "youtube.com", "tiktok.com"]):
            socials.append(href)
    out["socials"] = list(dict.fromkeys(socials))[:5]

    return out


# ── SQL emission ──────────────────────────────────────────────────────────────

def sql_str(s) -> str:
    if s is None or s == "":
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def sql_array(xs: list[str]) -> str:
    if not xs:
        return "ARRAY[]::text[]"
    return "ARRAY[" + ",".join(sql_str(x) for x in xs) + "]::text[]"


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-zA-Z0-9\s-]", "", s).lower()
    s = re.sub(r"\s+", "-", s).strip("-")
    return s[:60] or "club"


def write_sql(records: list[dict]) -> None:
    SQL_OUT.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "-- ============================================================",
        "-- SPORTMAPS — Escuelas/clubes deportebogota.com (auto-generado)",
        "-- ============================================================",
        "-- Origen: WP REST + scrape de perfiles /perfil/<slug>/",
        "-- Generado por scripts/scrape_deportebogota.py",
        "-- Idempotente: UPSERT por external_school_imports(external_ref) UNIQUE",
        "-- ============================================================",
        "",
        "BEGIN;",
        "",
    ]

    for rec in records:
        ext_ref = f"DPB-{rec['id']}"
        name = rec["name"]
        slug = slugify(name) + f"-dpb{rec['id']}"
        sport = rec.get("sport") or "Multideporte"
        sports_arr = [sport] if sport else ["Multideporte"]
        description = rec.get("description") or f"Club deportivo en Bogotá. Categoría: {sport}."
        if rec.get("locality"):
            description += f" Localidad: {rec['locality']}."

        lat_sql = f"{rec['lat']:.7f}" if rec.get("lat") else "NULL"
        lng_sql = f"{rec['lng']:.7f}" if rec.get("lng") else "NULL"

        raw_payload = json.dumps({
            "wp_id": rec["id"],
            "wp_slug": rec.get("slug"),
            "wp_url": rec.get("url"),
            "address_raw": rec.get("address"),
            "locality": rec.get("locality"),
            "socials": rec.get("socials", []),
        }, ensure_ascii=False)

        lines.append(f"-- {name} ({ext_ref})")
        lines.append("DO $$")
        lines.append("DECLARE v_school_id uuid; v_existing uuid;")
        lines.append("BEGIN")
        lines.append(f"  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = {sql_str(ext_ref)};")
        lines.append("  IF v_existing IS NULL THEN")
        lines.append("    INSERT INTO public.schools (")
        lines.append("      name, description, school_type, city, address, phone, email, sports,")
        lines.append("      logo_url, verified, is_demo, slug, onboarding_status")
        lines.append("    ) VALUES (")
        lines.append(f"      {sql_str(name)},")
        lines.append(f"      {sql_str(description)},")
        lines.append("      'academy', 'Bogotá',")
        lines.append(f"      {sql_str(rec.get('address'))},")
        lines.append(f"      {sql_str(rec.get('phone'))},")
        lines.append(f"      {sql_str(rec.get('email'))},")
        lines.append(f"      {sql_array(sports_arr)},")
        lines.append(f"      {sql_str(rec.get('logo_url'))},")
        lines.append("      true, false,")
        lines.append(f"      {sql_str(slug)},")
        lines.append("      'completed'")
        lines.append("    ) RETURNING id INTO v_school_id;")
        lines.append("")
        lines.append("    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)")
        lines.append(f"    VALUES ('deportebogota_2026', {sql_str(ext_ref)}, v_school_id, {sql_str(raw_payload)}::jsonb);")
        lines.append("  ELSE")
        lines.append("    v_school_id := v_existing;")
        lines.append("    UPDATE public.schools SET")
        lines.append(f"      description = COALESCE({sql_str(description)}, description),")
        lines.append(f"      phone       = COALESCE({sql_str(rec.get('phone'))}, phone),")
        lines.append(f"      email       = COALESCE({sql_str(rec.get('email'))}, email),")
        lines.append(f"      logo_url    = COALESCE(logo_url, {sql_str(rec.get('logo_url'))}),")
        lines.append(f"      sports      = {sql_array(sports_arr)},")
        lines.append("      updated_at  = now()")
        lines.append("    WHERE id = v_school_id;")
        lines.append("  END IF;")
        lines.append("")
        lines.append("  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;")
        lines.append("  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;")
        lines.append("")
        if rec.get("lat") is not None:
            lines.append("  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)")
            lines.append("  SELECT v_school_id, 'Sede Principal',")
            lines.append(f"         {sql_str(rec.get('address'))}, 'Bogotá',")
            lines.append(f"         {sql_str(rec.get('phone'))}, {lat_sql}, {lng_sql}, true, 'active'")
            lines.append("  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);")
        lines.append("END $$;")
        lines.append("")

    lines.append("COMMIT;")
    SQL_OUT.write_text("\n".join(lines), encoding="utf-8")


def write_ts(records: list[dict]) -> None:
    TS_OUT.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "// Auto-generado por scripts/scrape_deportebogota.py — NO EDITAR A MANO",
        "// Fuente: deportebogota.com WP REST + perfiles HTML",
        "",
        "import type { MapLocation } from './mapData';",
        "",
        "export const deportebogotaClubs: MapLocation[] = [",
    ]
    for rec in records:
        if not rec.get("lat") or not rec.get("lng"):
            continue
        sport = rec.get("sport") or "Multideporte"
        name = (rec["name"] or "").replace("'", "\\'")
        desc = (rec.get("description") or f"Club deportivo en Bogotá. {sport}").replace("'", "\\'")[:180]
        addr = (rec.get("address") or "").replace("'", "\\'")
        lines.append("  {")
        lines.append(f"    id: 'dpb-{rec['id']}',")
        lines.append(f"    name: '{name}',")
        lines.append("    type: 'academy',")
        lines.append(f"    sport: '{sport}',")
        lines.append(f"    lat: {rec['lat']:.7f},")
        lines.append(f"    lng: {rec['lng']:.7f},")
        lines.append("    city: 'Bogotá',")
        lines.append(f"    description: '{desc}',")
        if addr:
            lines.append(f"    address: '{addr}',")
        if rec.get("phone"):
            lines.append(f"    phone: '+57 {rec['phone']}',")
        if rec.get("logo_url"):
            lines.append(f"    image: '{rec['logo_url']}',")
        lines.append("  },")
    lines.append("];")
    TS_OUT.write_text("\n".join(lines), encoding="utf-8")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    cache = load_cache()
    print(f"Cache: {len(cache)} entradas")
    print("Fetching listings via WP REST...", flush=True)
    listings = fetch_all_listings()
    print(f"Total listings: {len(listings)}", flush=True)

    records: list[dict] = []
    for idx, item in enumerate(listings, 1):
        slug = item.get("slug")
        title = (item.get("title") or {}).get("rendered", slug)
        print(f"[{idx:02d}/{len(listings)}] {title[:60]}", flush=True)

        prof = scrape_profile(slug)
        if not prof:
            print("  [skip] no profile", flush=True)
            continue
        prof["id"] = item["id"]
        prof["wp_link"] = item.get("link")

        # ── Parsear el titulo: 'Voleibol – Parque Roma – Club X' ──
        # Esta es la fuente PRINCIPAL de lugar/deporte (el HTML del perfil suele
        # no traer direccion estructurada parseable).
        parsed_sport, parsed_place, parsed_club = parse_listing_title(title)
        if parsed_sport and not prof.get("sport"):
            prof["sport"] = parsed_sport
        if parsed_place and not prof.get("address"):
            prof["address"] = parsed_place
        # Usar el club name como display name (mejor que el titulo completo con dashes)
        if parsed_club and len(parsed_club) > 3:
            prof["name"] = parsed_club
        elif not prof.get("name") or len(prof["name"]) < 3:
            prof["name"] = html_unescape(title)

        # Geocode con cascada de candidatos
        lat = lng = None
        candidates = []
        if parsed_place:
            # El "place" del titulo es lo MAS especifico (parque, coliseo, barrio)
            candidates.append(f"{parsed_place}, Bogotá, Colombia")
        if prof.get("address") and prof["address"] != parsed_place:
            candidates.append(f"{prof['address']}, Bogotá, Colombia")
        if prof.get("locality"):
            candidates.append(f"{prof['locality']}, Bogotá, Colombia")

        for q in candidates:
            coords = geocode(q, cache)
            if coords:
                lat, lng = coords
                break
        prof["lat"] = lat
        prof["lng"] = lng
        if lat:
            print(f"  -> {lat:.5f}, {lng:.5f}", flush=True)
        else:
            print("  -> NO GEOCODE", flush=True)

        records.append(prof)
        time.sleep(0.3)  # gentle delay between profile fetches

    print(f"\nTotal records: {len(records)}, geocoded: {sum(1 for r in records if r.get('lat'))}")

    write_sql(records)
    write_ts(records)
    print(f"\n[ok] SQL: {SQL_OUT}")
    print(f"[ok] TS:  {TS_OUT}")


if __name__ == "__main__":
    main()
