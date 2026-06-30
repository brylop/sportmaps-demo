#!/usr/bin/env python3
"""
scrape_idrd_clubes.py
=====================

Importa el registro oficial de CLUBES DEPORTIVOS VIGENTES del IDRD Bogota
(distinto de las "escuelas avaladas" del xlsx que ya importamos via
import_idrd_schools.py). La pagina sirve una tabla HTML unica (#tabla) con
~1.419 clubes:

  Consulta_General_Clubes_Web.php  ->  <table id="tabla"> 10 columnas:
    [0] Nombre Club          [5] Nombre del Presidente
    [1] # Resolucion R-D     [6] Telefono
    [2] # Resolucion Actual. [7] Correo
    [3] Fecha Inicio R-D     [8] Localidad
    [4] Fecha Terminacion    [9] Deporte(s) (tags <font>, repetidos)

OJO encoding: la pagina declara UTF-8 pero sirve bytes Latin-1.

Geocodificacion: el registro SOLO trae Localidad (no direccion ni escenario),
asi que geocodificamos al centroide de la localidad (~20 queries unicas,
cacheadas). Es coarse pero suficiente para /explorar. NUNCA inventa coords:
"No registra" / localidad desconocida -> sin branch.

Salida:
  supabase/seed/idrd_clubes_2026.sql   (idempotente, UPSERT por external_ref)

external_ref = IDRD-CLUB-<slug(nombre)>-<resolucion>  (unico; colisiones raras
se resuelven con sufijo -2, -3...). source = 'idrd_clubes_2026'.

Uso:
    python scripts/scrape_idrd_clubes.py
    # Variables opcionales:
    #   IDRD_CLUBES_HTML="C:/tmp/idrd_clubes.html"  (usa archivo local en vez de bajar)
    #   GEOCODE_CACHE="scripts/.geocode_cache.json"

Requiere: pip install requests beautifulsoup4 lxml
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
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:
    pass

try:
    import requests  # type: ignore
    from bs4 import BeautifulSoup  # type: ignore
except ImportError as e:
    print(f"Falta dependencia: {e.name}. Instala con: pip install requests beautifulsoup4 lxml")
    sys.exit(1)


# ── Configuracion ─────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://sim1.idrd.gov.co/SIM/CS_RendimientoDeportivo/Presentacion/Consulta_General_Clubes_Web.php"
LOCAL_HTML = os.environ.get("IDRD_CLUBES_HTML", "")  # si esta seteado, lee de disco
CACHE_FILE = Path(os.environ.get("GEOCODE_CACHE", ROOT / "scripts" / ".geocode_cache.json"))
SQL_OUT = ROOT / "supabase" / "seed" / "idrd_clubes_2026.sql"

USER_AGENT = "SportMaps-IDRD-Clubes-Import/1.0 (brayan.lopez@osigu.com)"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
RATE_LIMIT_SECS = 1.1

# Bogota bounding box (lat_min, lat_max, lng_min, lng_max)
BOGOTA_BOUNDS = (4.45, 4.85, -74.25, -73.95)

# Localidades del IDRD -> nombre con tildes correctas (para mostrar y geocodificar).
LOCALIDAD_FIX = {
    "antonio narino": "Antonio Nariño",
    "barrios unidos": "Barrios Unidos",
    "bosa": "Bosa",
    "chapinero": "Chapinero",
    "ciudad bolivar": "Ciudad Bolívar",
    "engativa": "Engativá",
    "fontibon": "Fontibón",
    "kennedy": "Kennedy",
    "la candelaria": "La Candelaria",
    "martires": "Los Mártires",
    "los martires": "Los Mártires",
    "puente aranda": "Puente Aranda",
    "rafael uribe": "Rafael Uribe Uribe",
    "san cristobal": "San Cristóbal",
    "santa fe": "Santa Fe",
    "suba": "Suba",
    "teusaquillo": "Teusaquillo",
    "tunjuelito": "Tunjuelito",
    "usaquen": "Usaquén",
    "usme": "Usme",
}

# Normalizacion de nombres de deporte mas comunes del registro.
SPORT_FIX = {
    "futbol": "Fútbol",
    "futbol de salon": "Fútbol de salón",
    "futbol sala": "Fútbol de salón",
    "futbol tejo": "Tejo",
    "baloncesto": "Baloncesto",
    "voleibol": "Voleibol",
    "natacion": "Natación",
    "patinaje": "Patinaje",
    "ciclismo": "Ciclismo",
    "atletismo": "Atletismo",
    "taekwondo": "Taekwondo",
    "karate": "Karate",
    "karate do": "Karate",
    "judo": "Judo",
    "lucha": "Lucha",
    "boxeo": "Boxeo",
    "tenis": "Tenis",
    "tenis de campo": "Tenis de campo",
    "tenis de mesa": "Tenis de mesa",
    "ajedrez": "Ajedrez",
    "tejo": "Tejo",
    "esgrima": "Esgrima",
    "gimnasia": "Gimnasia",
    "rugby": "Rugby",
    "hockey": "Hockey",
    "softbol": "Softbol",
    "beisbol": "Béisbol",
    "tiro deportivo": "Tiro deportivo",
    "tiro con arco": "Tiro con arco",
    "porras": "Porras (cheerleading)",
}


# ── Geocoding (Nominatim) — solo por localidad ─────────────────────────────────

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
        if v.get("lat") is not None and v.get("lng") is not None:
            return float(v["lat"]), float(v["lng"])
        return None

    last_err: Optional[str] = None
    for attempt in range(3):
        try:
            time.sleep(RATE_LIMIT_SECS if attempt == 0 else 3.0 * attempt)
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
                print(f"  [warn] geocode fuera de Bogota descartado: {query} -> {lat},{lng}", flush=True)
                cache[key] = {"lat": None, "lng": None}
                save_cache(cache)
                return None
            cache[key] = {"lat": lat, "lng": lng, "display_name": data[0].get("display_name")}
            save_cache(cache)
            return lat, lng
        except Exception as e:
            last_err = str(e)[:200]
            if attempt < 2:
                print(f"  [warn] geocode retry {attempt+1}/3 '{query[:50]}': {last_err[:70]}", flush=True)
                continue
    print(f"  [fail] geocode definitivo '{query[:50]}': {last_err}", flush=True)
    cache[key] = {"lat": None, "lng": None}
    save_cache(cache)
    return None


# ── Parsing helpers ────────────────────────────────────────────────────────────

def clean(s: object) -> str:
    if s is None:
        return ""
    return re.sub(r"\s+", " ", str(s)).strip()


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-zA-Z0-9\s-]", "", s).lower()
    s = re.sub(r"\s+", "-", s).strip("-")
    return s[:40] or "club"


def norm_localidad(raw: str) -> Optional[str]:
    raw = clean(raw)
    if not raw or raw.lower() in ("no registra", "no aplica", "n/a", "-"):
        return None
    key = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode("ascii").lower()
    return LOCALIDAD_FIX.get(key, raw.title())


def norm_sport(raw: str) -> str:
    key = unicodedata.normalize("NFKD", clean(raw)).encode("ascii", "ignore").decode("ascii").lower()
    return SPORT_FIX.get(key, clean(raw).title())


def extract_sports(td) -> list[str]:
    """La celda Deporte trae N tags <font><strong>X</strong></font> repetidos."""
    fonts = td.find_all("font")
    raw_list = [clean(f.get_text(" ", strip=True)) for f in fonts] if fonts else [clean(td.get_text(" ", strip=True))]
    out: list[str] = []
    seen: set[str] = set()
    for r in raw_list:
        if not r:
            continue
        s = norm_sport(r)
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    return out


def clean_phone(raw: str) -> Optional[str]:
    raw = clean(raw).replace("-", "").replace(" ", "")
    m = re.search(r"3\d{9}|\d{7,}", raw)
    return m.group(0) if m else None


def clean_email(raw: str) -> Optional[str]:
    m = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", clean(raw))
    return m.group(0).lower() if m else None


# ── Load source HTML ───────────────────────────────────────────────────────────

def load_html() -> str:
    if LOCAL_HTML and Path(LOCAL_HTML).exists():
        print(f"Leyendo HTML local: {LOCAL_HTML}", flush=True)
        return Path(LOCAL_HTML).read_bytes().decode("latin-1")
    print(f"Descargando {SOURCE_URL} ...", flush=True)
    resp = requests.get(SOURCE_URL, headers={"User-Agent": USER_AGENT}, timeout=120)
    resp.raise_for_status()
    # La pagina declara UTF-8 pero los bytes son Latin-1.
    return resp.content.decode("latin-1")


def parse_rows(html: str) -> list[dict]:
    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", id="tabla")
    if not table:
        print("ERROR: no se encontro <table id='tabla'> en el HTML.")
        sys.exit(1)
    rows = table.find_all("tr")[1:]  # saltar header

    records: list[dict] = []
    seen_refs: dict[str, int] = {}
    for r in rows:
        td = r.find_all("td")
        if len(td) < 10:
            continue
        name = clean(td[0].get_text(" ", strip=True))
        if not name:
            continue
        res_rd = clean(td[1].get_text(" ", strip=True))
        res_act = clean(td[2].get_text(" ", strip=True))
        fecha_ini = clean(td[3].get_text(" ", strip=True))
        fecha_fin = clean(td[4].get_text(" ", strip=True))
        presidente = clean(td[5].get_text(" ", strip=True))
        phone = clean_phone(td[6].get_text(" ", strip=True))
        email = clean_email(td[7].get_text(" ", strip=True))
        localidad = norm_localidad(td[8].get_text(" ", strip=True))
        sports = extract_sports(td[9])

        base_ref = f"IDRD-CLUB-{slugify(name)}-{res_rd or 'NA'}"
        seen_refs[base_ref] = seen_refs.get(base_ref, 0) + 1
        ext_ref = base_ref if seen_refs[base_ref] == 1 else f"{base_ref}-{seen_refs[base_ref]}"

        records.append({
            "name": name,
            "external_ref": ext_ref,
            "res_rd": res_rd or None,
            "res_act": res_act if res_act and res_act != "0" else None,
            "fecha_inicio": fecha_ini or None,
            "fecha_fin": fecha_fin or None,
            "presidente": presidente or None,
            "phone": phone,
            "email": email,
            "localidad": localidad,
            "sports": sports,
        })
    return records


# ── SQL emission ───────────────────────────────────────────────────────────────

def sql_str(s: object) -> str:
    if s is None or s == "":
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def sql_array(xs: list[str]) -> str:
    if not xs:
        return "ARRAY[]::text[]"
    return "ARRAY[" + ",".join(sql_str(x) for x in xs) + "]::text[]"


def build_description(rec: dict) -> str:
    bits: list[str] = []
    if rec["presidente"]:
        bits.append(f"Presidente: {rec['presidente']}")
    if rec["sports"]:
        bits.append("Deporte(s): " + ", ".join(rec["sports"]))
    if rec["localidad"]:
        bits.append(f"Localidad: {rec['localidad']}")
    res_bits = []
    if rec["res_rd"]:
        res_bits.append(f"R-D Nº {rec['res_rd']}")
    if rec["res_act"]:
        res_bits.append(f"actualización Nº {rec['res_act']}")
    if res_bits:
        bits.append("Resolución " + " / ".join(res_bits))
    if rec["fecha_fin"]:
        bits.append(f"Vigente hasta {rec['fecha_fin']}")
    bits.append("Club deportivo registrado ante el IDRD Bogotá")
    return ". ".join(bits)


def write_sql(records: list[dict]) -> None:
    SQL_OUT.parent.mkdir(parents=True, exist_ok=True)
    L: list[str] = []
    L.append("-- ============================================================")
    L.append("-- SPORTMAPS — Clubes deportivos vigentes IDRD Bogota (auto-generado)")
    L.append("--")
    L.append("-- Origen: Consulta_General_Clubes_Web.php (registro oficial IDRD)")
    L.append("-- Generado por scripts/scrape_idrd_clubes.py")
    L.append("-- Idempotente: UPSERT por external_school_imports(external_ref) UNIQUE")
    L.append("-- school_type='club'. Geocode coarse por centroide de localidad.")
    L.append("-- ============================================================")
    L.append("")
    L.append("BEGIN;")
    L.append("")
    L.append("-- Tabla auxiliar (ya creada por idrd_avaladas_2026.sql; defensivo)")
    L.append("CREATE TABLE IF NOT EXISTS public.external_school_imports (")
    L.append("    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),")
    L.append("    source        text NOT NULL,")
    L.append("    external_ref  text NOT NULL UNIQUE,")
    L.append("    school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,")
    L.append("    raw_payload   jsonb,")
    L.append("    imported_at   timestamptz NOT NULL DEFAULT now(),")
    L.append("    updated_at    timestamptz NOT NULL DEFAULT now()")
    L.append(");")
    L.append("")
    L.append("-- =====================  INSERTS  ============================")
    L.append("")

    for rec in records:
        ref = rec["external_ref"]
        slug = slugify(rec["name"]) + "-" + (rec["res_rd"] or "club")
        description = build_description(rec)
        loc_query = f"{rec['localidad']}, Bogotá, Colombia" if rec["localidad"] else None
        lat_sql = f"{rec['lat']:.7f}" if rec.get("lat") is not None else "NULL"
        lng_sql = f"{rec['lng']:.7f}" if rec.get("lng") is not None else "NULL"

        raw_payload = json.dumps({
            "resolucion_rd": rec["res_rd"],
            "resolucion_actualizacion": rec["res_act"],
            "fecha_inicio": rec["fecha_inicio"],
            "fecha_fin": rec["fecha_fin"],
            "presidente": rec["presidente"],
            "localidad": rec["localidad"],
            "sports": rec["sports"],
            "geo_source": "localidad_centroid" if rec.get("lat") is not None else "not_found",
        }, ensure_ascii=False)

        L.append("-- ─────────────────────────────────────────────────────────")
        L.append(f"-- {rec['name']}  ({ref})")
        L.append("DO $$")
        L.append("DECLARE v_school_id uuid; v_existing uuid;")
        L.append("BEGIN")
        L.append(f"  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = {sql_str(ref)};")
        L.append("  IF v_existing IS NULL THEN")
        L.append("    INSERT INTO public.schools (")
        L.append("      name, description, school_type, city, address, phone, email,")
        L.append("      sports, verified, is_demo, slug, onboarding_status")
        L.append("    ) VALUES (")
        L.append(f"      {sql_str(rec['name'])},")
        L.append(f"      {sql_str(description)},")
        L.append("      'club',")
        L.append("      'Bogotá',")
        L.append(f"      {sql_str(rec['localidad'])},")
        L.append(f"      {sql_str(rec['phone'])},")
        L.append(f"      {sql_str(rec['email'])},")
        L.append(f"      {sql_array(rec['sports'])},")
        L.append("      true,  -- verified (registro oficial IDRD)")
        L.append("      false, -- is_demo")
        L.append(f"      {sql_str(slug)},")
        L.append("      'completed'")
        L.append("    ) RETURNING id INTO v_school_id;")
        L.append("")
        L.append("    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)")
        L.append(f"    VALUES ('idrd_clubes_2026', {sql_str(ref)}, v_school_id, {sql_str(raw_payload)}::jsonb);")
        L.append("  ELSE")
        L.append("    v_school_id := v_existing;")
        L.append("    UPDATE public.schools SET")
        L.append(f"      description = {sql_str(description)},")
        L.append(f"      phone       = COALESCE({sql_str(rec['phone'])}, phone),")
        L.append(f"      email       = COALESCE({sql_str(rec['email'])}, email),")
        L.append(f"      sports      = {sql_array(rec['sports'])},")
        L.append("      verified    = true,")
        L.append("      updated_at  = now()")
        L.append("    WHERE id = v_school_id;")
        L.append(f"    UPDATE public.external_school_imports SET raw_payload = {sql_str(raw_payload)}::jsonb, updated_at = now() WHERE external_ref = {sql_str(ref)};")
        L.append("  END IF;")
        L.append("")
        L.append("  -- school_settings: REQUERIDO para aparecer en /explorar")
        L.append("  INSERT INTO public.school_settings (school_id) VALUES (v_school_id) ON CONFLICT (school_id) DO NOTHING;")
        L.append("  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;")
        L.append("")
        if rec.get("lat") is not None and rec.get("lng") is not None:
            L.append("  -- Sede principal (centroide de localidad — coarse, sin direccion exacta en el registro)")
            L.append("  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)")
            L.append("  SELECT v_school_id, 'Sede Principal',")
            L.append(f"         {sql_str(rec['localidad'])}, 'Bogotá', {sql_str(rec['phone'])}, {lat_sql}, {lng_sql}, true, 'active'")
            L.append("  WHERE NOT EXISTS (SELECT 1 FROM public.school_branches WHERE school_id = v_school_id AND is_main = true);")
        else:
            L.append("  -- Sin localidad geocodificable: no se crea branch (no aparece en mapa, si en listado)")
        L.append("END $$;")
        L.append("")

    L.append("COMMIT;")
    L.append("")
    SQL_OUT.write_text("\n".join(L), encoding="utf-8")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    html = load_html()
    records = parse_rows(html)
    print(f"Parseados {len(records)} clubes.", flush=True)

    cache = load_cache()
    print(f"Cache geocode: {len(cache)} entradas previas", flush=True)

    # Geocodificar SOLO localidades unicas (cacheado -> ~20 queries reales)
    localidades = sorted({r["localidad"] for r in records if r["localidad"]})
    loc_coords: dict[str, tuple[float, float]] = {}
    for loc in localidades:
        coords = geocode(f"{loc}, Bogotá, Colombia", cache)
        if coords:
            loc_coords[loc] = coords
            print(f"  {loc:20} -> {coords[0]:.5f}, {coords[1]:.5f}", flush=True)
        else:
            print(f"  {loc:20} -> SIN GEOCODE", flush=True)

    geocoded = 0
    for r in records:
        c = loc_coords.get(r["localidad"]) if r["localidad"] else None
        if c:
            r["lat"], r["lng"] = c
            geocoded += 1
        else:
            r["lat"], r["lng"] = None, None

    print(f"\nClubes: {len(records)} | con coords (centroide localidad): {geocoded}", flush=True)

    write_sql(records)
    print(f"\n[ok] SQL: {SQL_OUT}", flush=True)
    print(f"[i] Aplicar en Supabase SQL Editor (o split si supera el limite del editor).", flush=True)


if __name__ == "__main__":
    main()
