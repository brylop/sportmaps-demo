#!/usr/bin/env python3
"""
import_idrd_schools.py
=======================

ETL para importar las escuelas avaladas por el IDRD (Bogota) al ecosistema
SportMaps. Toma un Excel oficial (formato 2026), normaliza encoding, separa
campos multi-valor (multiples deportes/localidades), geocodifica el escenario
de practica via Nominatim (gratis, rate-limit 1/s) y emite:

  1. supabase/seed/idrd_avaladas_2026.sql
     - INSERT idempotente en `schools`, `school_branches`, `school_settings`.
     - UPSERT por external_ref (aval IDRD) en una tabla auxiliar
       `external_school_imports` para soportar re-imports sin duplicar.

  2. Landing_page/.../mapData.idrd.ts
     - Array TypeScript con todas las escuelas geo-localizadas, en el formato
       que el mapa interactivo de la landing consume.

Uso:
    python scripts/import_idrd_schools.py
    # Variables opcionales:
    #   IDRD_XLSX="C:/path/to/02-escuelas-avaladas-2026-abril.xlsx"
    #   GEOCODE_CACHE="scripts/.geocode_cache.json"

Requiere:
    pip install openpyxl requests

NUNCA inventa coordenadas. Si Nominatim no encuentra una direccion, deja
NULL en SQL y omite la escuela del mapData.ts (no se ve en el mapa pero
si en /explorar de la app).
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

# Windows cp1252 no encodes muchos chars unicode — forzar UTF-8 en stdout
# (sino imprimir warnings con tilde o emoji mata el proceso).
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:
    pass

try:
    import openpyxl  # type: ignore
    import requests  # type: ignore
except ImportError as e:
    print(f"Falta dependencia: {e.name}. Instala con: pip install openpyxl requests")
    sys.exit(1)


# ── Configuracion ─────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_XLSX = Path(os.environ.get(
    "IDRD_XLSX",
    "C:/Users/Usuario/Documents/02-escuelas-avaladas-2026-abril.xlsx",
))
CACHE_FILE = Path(os.environ.get("GEOCODE_CACHE", ROOT / "scripts" / ".geocode_cache.json"))
SQL_OUT = ROOT / "supabase" / "seed" / "idrd_avaladas_2026.sql"
TS_OUT = Path(
    "C:/Users/Usuario/Documents/Landing_page/sportmap-maps-landing-page/frontend/src/data/mapData.idrd.ts"
)

USER_AGENT = "SportMaps-IDRD-Import/1.0 (brayan.lopez@osigu.com)"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
RATE_LIMIT_SECS = 1.1  # politica de Nominatim: max 1 req/s

# Bogota bounding box (lat_min, lat_max, lng_min, lng_max) — descartar geocodings que caigan fuera
BOGOTA_BOUNDS = (4.45, 4.85, -74.25, -73.95)
BOGOTA_CENTER = (4.6486, -74.0628)


# ── Normalizacion de encoding ────────────────────────────────────────────────
# El Excel viene con caracteres mal codificados: la � reemplaza tildes.
# Heuristica: las palabras conocidas las arreglamos por diccionario; el resto
# se queda como esta (mejor mostrar "F�TBOL" que adivinar mal).
ENCODING_FIXES = {
    "F�TBOL": "FÚTBOL",
    "FUTBOL": "FÚTBOL",
    "NATACI�N": "NATACIÓN",
    "NATACION": "NATACIÓN",
    "TEL�FONO": "TELÉFONO",
    "USAQEUN": "USAQUÉN",
    "USAQUEN": "USAQUÉN",
    "BARRIOS UNIDOS": "Barrios Unidos",
    "ENGATIVA": "Engativá",
    "ENGATIV�": "Engativá",
    "PUENTE ARANDA": "Puente Aranda",
    "TUNJUELITO": "Tunjuelito",
    "FONTIBON": "Fontibón",
    "FONTIB�N": "Fontibón",
    "RAFALE URIBE URIBE": "Rafael Uribe Uribe",
    "RAFAEL URIBE URIBE": "Rafael Uribe Uribe",
    "ANTONIO NARI�O": "Antonio Nariño",
    "USME": "Usme",
    "BOSA": "Bosa",
    "KENNEDY": "Kennedy",
    "CHAPINERO": "Chapinero",
    "SAN CRISTOBAL": "San Cristóbal",
    "SUBA": "Suba",
    "CIUDAD BOLIVAR": "Ciudad Bolívar",
    "PI�EROS": "PIÑEROS",
    "MU�EVAR": "MUÑEVAR",
}


def normalize_text(s: object) -> str:
    """Aplica fixes de encoding, trim, dedup espacios."""
    if s is None:
        return ""
    txt = str(s)
    for bad, good in ENCODING_FIXES.items():
        txt = txt.replace(bad, good)
    # Reemplazar U+FFFD sobrantes con cadena vacia (no podemos adivinar la letra real)
    txt = txt.replace("�", "")
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt


SPORT_NORMALIZATION = {
    "FÚTBOL": "Fútbol",
    "FUTBOL": "Fútbol",
    "BALONCESTO": "Baloncesto",
    "NATACIÓN": "Natación",
    "NATACION": "Natación",
    "PATINAJE DE CARRERAS": "Patinaje de carreras",
    "PATINAJE ARTÍSTICO": "Patinaje artístico",
    "PATINAJE ARTISTICO": "Patinaje artístico",
    "PATINAJE": "Patinaje",
    "CICLISMO": "Ciclismo",
    "TENIS DE CAMPO": "Tenis de campo",
    "TENIS DE MESA": "Tenis de mesa",
    "TENIS": "Tenis",
    "VOLEIBOL": "Voleibol",
    "TAEKWONDO": "Taekwondo",
    "KARATE": "Karate",
    "SQUASH": "Squash",
    "BOLOS": "Bolos",
    "BAILE DEPORTIVO": "Baile deportivo",
}


def split_and_normalize_sports(raw: str) -> list[str]:
    """Divide 'F�TBOL Y BALONCESTO' / 'A, B, C' / 'A\\nB' en lista normalizada."""
    if not raw:
        return []
    raw = normalize_text(raw).upper()
    # Reemplazar separadores comunes por coma
    raw = re.sub(r"\s*[,\n]\s*|\s+Y\s+", ",", raw)
    out: list[str] = []
    for tok in raw.split(","):
        tok = tok.strip()
        if not tok:
            continue
        out.append(SPORT_NORMALIZATION.get(tok, tok.capitalize()))
    # Dedup preservando orden
    seen: set[str] = set()
    result: list[str] = []
    for s in out:
        if s not in seen:
            seen.add(s)
            result.append(s)
    return result


def split_localidades(raw: str) -> list[str]:
    if not raw:
        return []
    raw = normalize_text(raw)
    # Eliminar prefijos numericos "1. KENNEDY"
    parts = re.split(r"[\n,]|(?:\d+\.\s*)|(?:\s+Y\s+)", raw)
    out: list[str] = []
    for p in parts:
        p = p.strip()
        if p:
            normalized = ENCODING_FIXES.get(p.upper(), p.title())
            out.append(normalized)
    return out


def split_emails(raw: str) -> Optional[str]:
    if not raw:
        return None
    raw = normalize_text(raw)
    # Tomar el primer email valido
    match = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", raw)
    return match.group(0).lower() if match else None


def split_phones(raw: str) -> Optional[str]:
    if not raw:
        return None
    raw = normalize_text(str(raw))
    # Tomar el primer telefono (7+ digitos consecutivos posiblemente con guiones/espacios)
    match = re.search(r"3\d{9}|\d{7,}", raw.replace("-", "").replace(" ", ""))
    return match.group(0) if match else None


# ── Geocoding (Nominatim) ────────────────────────────────────────────────────

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
    """Devuelve (lat, lng) o None. Cachea por query exacta."""
    key = query.strip().lower()
    if not key:
        return None
    if key in cache:
        v = cache[key]
        if v.get("lat") is not None and v.get("lng") is not None:
            return float(v["lat"]), float(v["lng"])
        return None

    # Reintentar hasta 3 veces con backoff ante timeout/transient errors.
    last_err: Optional[str] = None
    for attempt in range(3):
        try:
            time.sleep(RATE_LIMIT_SECS if attempt == 0 else 3.0 * attempt)
            resp = requests.get(
                NOMINATIM_URL,
                params={
                    "q": query,
                    "format": "json",
                    "limit": 1,
                    "countrycodes": "co",
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
            lat = float(data[0]["lat"])
            lng = float(data[0]["lon"])
            if not in_bogota(lat, lng):
                print(f"  [warn] Geocode fuera de Bogota descartado: {query} -> {lat},{lng}", flush=True)
                cache[key] = {"lat": None, "lng": None}
                save_cache(cache)
                return None
            cache[key] = {"lat": lat, "lng": lng, "display_name": data[0].get("display_name")}
            save_cache(cache)
            return lat, lng
        except Exception as e:
            last_err = str(e)[:200]
            # NO cachear el fallo si fue timeout — re-intentable en siguiente run.
            if attempt < 2:
                print(f"  [warn] timeout/err (intento {attempt+1}/3) en '{query[:60]}': {last_err[:80]}", flush=True)
                continue
    # Tras 3 intentos fallidos: cachear como NOT_FOUND para no re-intentar en este run
    print(f"  [fail] Geocode definitivo en '{query[:60]}': {last_err}", flush=True)
    cache[key] = {"lat": None, "lng": None}
    save_cache(cache)
    return None


def geocode_with_fallbacks(escenario: str, direccion_sede: str, barrio: str, localidad: str, cache: dict[str, dict]) -> tuple[Optional[float], Optional[float], str]:
    """
    Intenta geocodificar en orden:
      1. <escenario>, <barrio>, <localidad>, Bogota, Colombia
      2. <direccion_sede>, <barrio>, <localidad>, Bogota, Colombia
      3. <escenario>, Bogota, Colombia
      4. <barrio>, <localidad>, Bogota, Colombia
      5. <localidad>, Bogota, Colombia (ultimo recurso: centro de localidad)
    Devuelve (lat, lng, fuente_usada).
    """
    candidates: list[tuple[str, str]] = []
    if escenario:
        candidates.append((f"{escenario}, {barrio}, {localidad}, Bogota, Colombia", "escenario+barrio+localidad"))
    if direccion_sede:
        candidates.append((f"{direccion_sede}, {barrio}, {localidad}, Bogota, Colombia", "sede+barrio+localidad"))
    if escenario:
        candidates.append((f"{escenario}, Bogota, Colombia", "escenario+bogota"))
    if barrio:
        candidates.append((f"{barrio}, {localidad}, Bogota, Colombia", "barrio+localidad"))
    if localidad:
        candidates.append((f"{localidad}, Bogota, Colombia", "localidad+bogota"))

    for query, source in candidates:
        coords = geocode(query, cache)
        if coords:
            return coords[0], coords[1], source
    return None, None, "not_found"


# ── SQL escaping ──────────────────────────────────────────────────────────────

def sql_str(s: object) -> str:
    if s is None:
        return "NULL"
    txt = str(s).replace("'", "''")
    return f"'{txt}'"


def sql_array_text(xs: list[str]) -> str:
    if not xs:
        return "ARRAY[]::text[]"
    items = ",".join(sql_str(x) for x in xs)
    return f"ARRAY[{items}]::text[]"


# ── Slug generation ──────────────────────────────────────────────────────────

def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-zA-Z0-9\s-]", "", s).lower()
    s = re.sub(r"\s+", "-", s).strip("-")
    return s[:60] or "escuela"


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    if not DEFAULT_XLSX.exists():
        print(f"ERROR: Excel no encontrado en {DEFAULT_XLSX}")
        sys.exit(1)

    print(f"Leyendo {DEFAULT_XLSX}…")
    wb = openpyxl.load_workbook(DEFAULT_XLSX, data_only=True)
    ws = wb["2026"]
    cache = load_cache()
    print(f"Cache geocode: {len(cache)} entradas previas")

    schools: list[dict] = []
    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        name_raw = row[1]
        if not name_raw:
            continue
        name = normalize_text(name_raw)
        aval = row[5]
        director = normalize_text(row[2])
        profesor = normalize_text(row[3])
        sports = split_and_normalize_sports(str(row[14] or ""))
        localidades = split_localidades(str(row[11] or ""))
        primary_loc = localidades[0] if localidades else ""
        barrio = normalize_text(row[13])
        direccion_sede = normalize_text(row[18])
        phone = split_phones(str(row[19] or ""))
        email = split_emails(str(row[20] or ""))
        escenario = normalize_text(row[21])
        horarios = normalize_text(row[22])
        total_alumnos = row[17]

        print(f"[{row_idx-1:02d}] {name[:50]}")
        lat, lng, geosrc = geocode_with_fallbacks(escenario, direccion_sede, barrio, primary_loc, cache)
        if lat:
            print(f"     -> {lat:.5f}, {lng:.5f}  ({geosrc})")
        else:
            print("     -> SIN GEOCODE")

        schools.append({
            "name": name,
            "external_ref": f"IDRD-AVAL-{aval}" if aval else f"IDRD-ROW-{row_idx}",
            "aval": aval,
            "director": director,
            "profesor": profesor,
            "sports": sports,
            "localidades": localidades,
            "primary_loc": primary_loc,
            "barrio": barrio,
            "address_sede": direccion_sede,
            "phone": phone,
            "email": email,
            "escenario": escenario,
            "horarios": horarios,
            "total_alumnos": int(total_alumnos) if isinstance(total_alumnos, int) else None,
            "lat": lat,
            "lng": lng,
            "geo_source": geosrc,
            "slug": slugify(name),
        })

    geocoded = sum(1 for s in schools if s["lat"])
    print(f"\nTotal: {len(schools)} escuelas, {geocoded} geocodificadas")

    write_sql(schools)
    write_ts(schools)
    print(f"\n✅ SQL:   {SQL_OUT}")
    print(f"✅ TS:    {TS_OUT}")


# ── SQL emission ──────────────────────────────────────────────────────────────

def write_sql(schools: list[dict]) -> None:
    SQL_OUT.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = []
    lines.append("-- ============================================================")
    lines.append("-- SPORTMAPS — Escuelas avaladas IDRD Bogota 2026 (auto-generado)")
    lines.append("--")
    lines.append("-- Origen: 02-escuelas-avaladas-2026-abril.xlsx")
    lines.append("-- Generado por scripts/import_idrd_schools.py")
    lines.append("-- Idempotente: usa external_school_imports(external_ref) UNIQUE")
    lines.append("-- para evitar duplicados en re-runs.")
    lines.append("-- ============================================================")
    lines.append("")
    lines.append("BEGIN;")
    lines.append("")
    lines.append("-- Tabla auxiliar de mapeo external_ref -> school_id")
    lines.append("CREATE TABLE IF NOT EXISTS public.external_school_imports (")
    lines.append("    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),")
    lines.append("    source        text NOT NULL,           -- 'idrd_bogota_2026'")
    lines.append("    external_ref  text NOT NULL UNIQUE,    -- 'IDRD-AVAL-635'")
    lines.append("    school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,")
    lines.append("    raw_payload   jsonb,")
    lines.append("    imported_at   timestamptz NOT NULL DEFAULT now(),")
    lines.append("    updated_at    timestamptz NOT NULL DEFAULT now()")
    lines.append(");")
    lines.append("CREATE INDEX IF NOT EXISTS idx_external_school_imports_source ON public.external_school_imports(source);")
    lines.append("ALTER TABLE public.external_school_imports ENABLE ROW LEVEL SECURITY;")
    lines.append("DROP POLICY IF EXISTS \"esi_super_admin_select\" ON public.external_school_imports;")
    lines.append("CREATE POLICY \"esi_super_admin_select\" ON public.external_school_imports FOR SELECT TO authenticated")
    lines.append("    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')));")
    lines.append("")
    lines.append("-- =====================  INSERTS  ============================")
    lines.append("")

    for sch in schools:
        ref = sch["external_ref"]
        slug_base = sch["slug"]
        # Descripcion combinando director + horarios + escenario
        description_bits = []
        if sch["director"]:
            description_bits.append(f"Director(a): {sch['director']}")
        if sch["profesor"]:
            description_bits.append(f"Profesor(a): {sch['profesor']}")
        if sch["escenario"]:
            description_bits.append(f"Escenario: {sch['escenario']}")
        if sch["horarios"]:
            description_bits.append(f"Horarios: {sch['horarios']}")
        description_bits.append(f"Escuela avalada por IDRD Bogotá (Aval Nº {sch['aval']})")
        description = ". ".join(description_bits)

        raw_payload_json = json.dumps({
            "aval": sch["aval"],
            "director": sch["director"],
            "profesor": sch["profesor"],
            "localidades": sch["localidades"],
            "barrio": sch["barrio"],
            "total_alumnos": sch["total_alumnos"],
            "geo_source": sch["geo_source"],
        }, ensure_ascii=False)

        lat_sql = f"{sch['lat']:.7f}" if sch["lat"] is not None else "NULL"
        lng_sql = f"{sch['lng']:.7f}" if sch["lng"] is not None else "NULL"

        lines.append("-- ─────────────────────────────────────────────────────────")
        lines.append(f"-- {sch['name']}  ({ref})")
        lines.append("DO $$")
        lines.append("DECLARE v_school_id uuid; v_existing uuid;")
        lines.append("BEGIN")
        lines.append(f"  SELECT school_id INTO v_existing FROM public.external_school_imports WHERE external_ref = {sql_str(ref)};")
        lines.append("  IF v_existing IS NULL THEN")
        lines.append("    INSERT INTO public.schools (")
        lines.append("      name, description, school_type, city, address, phone, email,")
        lines.append("      sports, verified, is_demo, slug, onboarding_status")
        lines.append("    ) VALUES (")
        lines.append(f"      {sql_str(sch['name'])},")
        lines.append(f"      {sql_str(description)},")
        lines.append("      'academy',")
        lines.append("      'Bogotá',")
        lines.append(f"      {sql_str(sch['address_sede'] or sch['escenario'] or sch['barrio'])},")
        lines.append(f"      {sql_str(sch['phone'])},")
        lines.append(f"      {sql_str(sch['email'])},")
        lines.append(f"      {sql_array_text(sch['sports'])},")
        lines.append("      true,  -- verified (avalada IDRD)")
        lines.append("      false, -- is_demo")
        lines.append(f"      {sql_str(slug_base + '-' + (str(sch['aval']) if sch['aval'] else 'idrd'))},")
        lines.append("      'completed'")
        lines.append("    ) RETURNING id INTO v_school_id;")
        lines.append("")
        lines.append("    INSERT INTO public.external_school_imports (source, external_ref, school_id, raw_payload)")
        lines.append(f"    VALUES ('idrd_bogota_2026', {sql_str(ref)}, v_school_id, {sql_str(raw_payload_json)}::jsonb);")
        lines.append("  ELSE")
        lines.append("    v_school_id := v_existing;")
        lines.append("    -- Actualizar campos que pueden cambiar entre versiones")
        lines.append("    UPDATE public.schools SET")
        lines.append(f"      description = {sql_str(description)},")
        lines.append(f"      phone       = COALESCE({sql_str(sch['phone'])}, phone),")
        lines.append(f"      email       = COALESCE({sql_str(sch['email'])}, email),")
        lines.append(f"      sports      = {sql_array_text(sch['sports'])},")
        lines.append("      verified    = true,")
        lines.append("      updated_at  = now()")
        lines.append("    WHERE id = v_school_id;")
        lines.append("  END IF;")
        lines.append("")
        lines.append("  -- school_settings: REQUERIDO para que aparezca en /explorar")
        lines.append("  INSERT INTO public.school_settings (school_id) VALUES (v_school_id)")
        lines.append("  ON CONFLICT (school_id) DO NOTHING;")
        lines.append("  -- Activar perfil publico (REQUISITO de search_schools / schools_near_location)")
        lines.append("  UPDATE public.school_settings SET public_profile_enabled = true WHERE school_id = v_school_id;")
        lines.append("")
        if sch["lat"] is not None and sch["lng"] is not None:
            lines.append("  -- Sede principal (lat/lng del escenario de practica)")
            lines.append("  INSERT INTO public.school_branches (school_id, name, address, city, phone, lat, lng, is_main, status)")
            lines.append("  VALUES (")
            lines.append("    v_school_id, 'Sede Principal',")
            lines.append(f"    {sql_str(sch['escenario'] or sch['address_sede'])},")
            lines.append("    'Bogotá',")
            lines.append(f"    {sql_str(sch['phone'])},")
            lines.append(f"    {lat_sql}, {lng_sql},")
            lines.append("    true, 'active'")
            lines.append("  )")
            lines.append("  ON CONFLICT DO NOTHING;")
        else:
            lines.append("  -- Sin lat/lng confiable: NO crear branch (no aparecera en mapa)")
        lines.append("END $$;")
        lines.append("")

    lines.append("COMMIT;")
    lines.append("")
    SQL_OUT.write_text("\n".join(lines), encoding="utf-8")


# ── TS emission for landing map ──────────────────────────────────────────────

def ts_str(s: object) -> str:
    if s is None:
        return "''"
    txt = str(s).replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ")
    return f"'{txt}'"


def write_ts(schools: list[dict]) -> None:
    TS_OUT.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = []
    lines.append("// Auto-generado por scripts/import_idrd_schools.py — NO EDITAR A MANO")
    lines.append("// Fuente: 02-escuelas-avaladas-2026-abril.xlsx (IDRD Bogota)")
    lines.append("// Re-genera con: python scripts/import_idrd_schools.py")
    lines.append("")
    lines.append("import type { MapLocation } from './mapData';")
    lines.append("")
    lines.append("export const idrdAvaladas2026: MapLocation[] = [")
    for sch in schools:
        if sch["lat"] is None or sch["lng"] is None:
            continue
        sport = sch["sports"][0] if sch["sports"] else "Deporte"
        description = f"Avalada IDRD ({sch['aval']})"
        if sch["escenario"]:
            description += f". Escenario: {sch['escenario'][:80]}"
        lines.append("  {")
        lines.append(f"    id: 'idrd-{sch['aval'] or sch['slug']}',")
        lines.append(f"    name: {ts_str(sch['name'])},")
        lines.append("    type: 'academy',")
        lines.append(f"    sport: {ts_str(sport)},")
        lines.append(f"    lat: {sch['lat']:.7f},")
        lines.append(f"    lng: {sch['lng']:.7f},")
        lines.append("    city: 'Bogotá',")
        lines.append(f"    description: {ts_str(description)},")
        lines.append(f"    address: {ts_str(sch['address_sede'])},")
        if sch["phone"]:
            lines.append(f"    phone: {ts_str('+57 ' + sch['phone'])},")
        lines.append("  },")
    lines.append("];")
    lines.append("")
    TS_OUT.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
