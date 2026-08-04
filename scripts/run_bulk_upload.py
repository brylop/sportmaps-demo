#!/usr/bin/env python3
"""
run_bulk_upload.py
──────────────────
Lee bulk_athletes.json y lo postea al BFF de SportMaps.

Uso:
  python3 run_bulk_upload.py               # ejecución real
  python3 run_bulk_upload.py --dry-run     # solo valida, sin insertar
  python3 run_bulk_upload.py --dry-run --env prod

Requiere:
  pip install requests python-dotenv
"""

import argparse
import json
import sys
import requests
from pathlib import Path

if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

# ── Config ────────────────────────────────────────────────────────────────────
BFF_BASE_URL = "http://localhost:3001"   # cambiar a la URL de staging/prod
BULK_ENDPOINT = "/api/v1/athletes/bulk-upload"
JSON_FILE = Path(__file__).parent / "bulk_athletes.json"

# ── CLI args ──────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Bulk upload de atletas a SportMaps")
parser.add_argument("--dry-run", action="store_true", help="Solo valida, no inserta")
parser.add_argument("--env",     default="local",     help="local | staging | prod")
parser.add_argument("--url",     default=None,        help="Override BFF URL base")
args = parser.parse_args()

ENV_URLS = {
    "local":   "http://localhost:3001",
    "staging": "https://bff-staging.sportmaps.co",
    "prod":    "https://bff.sportmaps.co",
}

base_url = args.url or ENV_URLS.get(args.env, BFF_BASE_URL)
endpoint = f"{base_url}{BULK_ENDPOINT}"

# ── Cargar datos ──────────────────────────────────────────────────────────────
if not JSON_FILE.exists():
    print(f"❌ No se encontró {JSON_FILE}")
    sys.exit(1)

with open(JSON_FILE) as f:
    payload = json.load(f)

if args.dry_run:
    payload["dry_run"] = True

total = len(payload.get("athletes", []))
mode = "DRY RUN" if args.dry_run else "REAL"

print(f"{'='*60}")
print(f"  SportMaps — Bulk Upload [{mode}]")
print(f"  Endpoint : {endpoint}")
print(f"  Atletas  : {total}")
print(f"  Escuela  : {payload.get('school_id', '?')}")
print(f"{'='*60}\n")

if not args.dry_run:
    pass
    # confirm = input(f"⚠️  Vas a insertar {total} atletas en PRODUCCIÓN. ¿Continuar? (escribe 'SI'): ")
    # if confirm.strip().upper() != "SI":
    #     print("Abortado.")
    #     sys.exit(0)

# ── Llamada al BFF ────────────────────────────────────────────────────────────
print(f"Enviando request a {endpoint}...")
try:
    resp = requests.post(
        endpoint,
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=120,
    )
    resp.raise_for_status()
except requests.exceptions.ConnectionError:
    print(f"❌ No se pudo conectar al BFF en {endpoint}")
    print("   Verifica que el BFF esté corriendo y la URL sea correcta.")
    sys.exit(1)
except requests.exceptions.HTTPError as e:
    print(f"❌ HTTP {resp.status_code}: {resp.text}")
    sys.exit(1)

data = resp.json()

# ── Mostrar resultado ─────────────────────────────────────────────────────────
if args.dry_run:
    print("\n📋 DRY RUN — Vista previa:\n")
    preview = data.get("preview", [])
    skip_count = sum(1 for p in preview if p.get("would_skip"))
    invalid_count = sum(1 for p in preview if not p.get("doc_valid"))
    print(f"  Total    : {data.get('total')}")
    print(f"  Duplicados (ya en BD) : {skip_count}")
    print(f"  Doc inválido          : {invalid_count}")
    if skip_count > 0:
        print("\n  Duplicados detectados:")
        for p in preview:
            if p.get("would_skip"):
                print(f"    [{p.get('fila')}] {p.get('full_name')}")
    if invalid_count > 0:
        print("\n  Documentos inválidos:")
        for p in preview:
            if not p.get("doc_valid"):
                print(f"    [{p.get('fila')}] {p.get('full_name')}")
    print("\n✅ Dry run completado — ningún dato fue modificado.")
else:
    summary = data.get("summary", {})
    results = data.get("results", [])
    print(f"\n{'='*60}")
    print(f"  RESULTADO FINAL")
    print(f"{'='*60}")
    print(f"  ✅ Insertados  : {summary.get('inserted', 0)}")
    print(f"  ⏭️  Duplicados : {summary.get('skipped', 0)}")
    print(f"  ❌ Errores     : {summary.get('errors', 0)}")
    print(f"{'='*60}\n")

    errors = [r for r in results if r["status"] == "error"]
    skipped = [r for r in results if r["status"] == "skipped_duplicate"]

    if skipped:
        print("⏭️  Saltados (ya existían en BD):")
        for r in skipped:
            print(f"    [{r.get('fila','?')}] {r['full_name']}")

    if errors:
        print("\n❌ Errores detallados:")
        for r in errors:
            print(f"    [{r.get('fila','?')}] {r['full_name']}")
            print(f"         → {r.get('error')}")

    if summary.get("errors", 0) == 0:
        print("🎉 Bulk upload completado sin errores.")
    else:
        print(f"\n⚠️  {summary.get('errors')} atletas fallaron. Revisar los errores arriba.")

    # Guardar resultado completo en archivo
    out = Path(__file__).parent / "bulk_upload_result.json"
    with open(out, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n📄 Resultado completo guardado en: {out}")
