#!/usr/bin/env python3
"""
split_osm_sql.py — divide osm_colombia_2026.sql en N chunks balanceados.

Cada chunk:
  - Es un archivo SQL independiente (BEGIN; ... COMMIT;)
  - Contiene ~N/9 entidades (DO blocks completos, sin cortar)
  - Idempotente: re-correr es seguro

Output:
  supabase/seed/osm_chunks/osm_colombia_chunk_01.sql
  supabase/seed/osm_chunks/osm_colombia_chunk_02.sql
  ...
  supabase/seed/osm_chunks/osm_colombia_chunk_09.sql
"""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "supabase" / "seed" / "osm_colombia_2026.sql"
OUT_DIR = ROOT / "supabase" / "seed" / "osm_chunks"
N_CHUNKS = 9

CHUNK_HEADER = """-- ============================================================
-- SPORTMAPS — OSM Colombia 2026 — Chunk {idx}/{total}
-- {count} entidades. Aplicar en orden (01, 02, ..., 09).
-- Idempotente: cada DO block usa external_ref UNIQUE.
-- ============================================================

BEGIN;

"""

CHUNK_FOOTER = "\nCOMMIT;\n"


def main():
    if not SRC.exists():
        print(f"Source not found: {SRC}")
        sys.exit(1)

    text = SRC.read_text(encoding="utf-8")

    # Split por entidades: cada DO $$ ... END $$; es una unidad.
    # Usamos regex para capturar bloques completos.
    pattern = re.compile(
        r"(-- [^\n]+\n"          # comment line con name + external_ref
        r"DO \$\$.*?END \$\$;)", # DO block completo
        re.DOTALL,
    )

    entities = pattern.findall(text)
    total = len(entities)
    print(f"Found {total} entities in source")

    if total == 0:
        print("No entities matched. Check regex against source format.")
        sys.exit(1)

    chunk_size = -(-total // N_CHUNKS)  # ceiling division
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for i in range(N_CHUNKS):
        start = i * chunk_size
        end = min(start + chunk_size, total)
        if start >= total:
            break

        chunk_entities = entities[start:end]
        chunk_path = OUT_DIR / f"osm_colombia_chunk_{i+1:02d}.sql"
        with open(chunk_path, "w", encoding="utf-8") as f:
            f.write(CHUNK_HEADER.format(idx=i+1, total=N_CHUNKS, count=len(chunk_entities)))
            f.write("\n\n".join(chunk_entities))
            f.write(CHUNK_FOOTER)
        size_mb = chunk_path.stat().st_size / (1024 * 1024)
        print(f"  chunk_{i+1:02d}.sql  {len(chunk_entities)} entities  {size_mb:.1f} MB")

    print(f"\n[done] {N_CHUNKS} chunks written to {OUT_DIR}")


if __name__ == "__main__":
    main()
