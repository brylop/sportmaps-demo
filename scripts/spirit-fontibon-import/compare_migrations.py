"""
Compara migraciones locales (carpeta supabase/migrations/) vs
las que retorno Supabase en 99_compare_migrations.sql.

Uso:
    1. Corre 99_compare_migrations.sql en Supabase SQL Editor
    2. Copia las versiones (columna version) a la lista SUPABASE_APPLIED abajo
    3. python compare_migrations.py
"""

import os
import re

LOCAL_DIR = 'c:/Users/Usuario/Documents/demo/sportmaps-demo/supabase/migrations'

# Pega aqui las versiones que te retorno el SQL de Supabase.
# Ejemplo: ['20260217000001', '20260218000002', ...]
SUPABASE_APPLIED = [
    '20250930204148', '20250930204228', '20250930214502', '20250930221044',
    '20250930221143', '20250930221404', '20250930222056', '20251030153755',
    '20251030154415', '20251030165333', '20251030171508', '20251030172020',
    '20251031163034', '20251031164900', '20251031165001', '20251104161649',
    '20251111143428', '20251121215146', '20251226161133', '20251226175929',
    '20251226181642', '20251226183527', '20251226193934', '20251226195042',
    '20260114120000', '20260209170000', '20260209200000', '20260210183000',
    '20260210184500', '20260210200000', '20260210203000', '20260210210000',
    '20260210213000', '20260210220000', '20260210223000', '20260210230000',
    '20260210232000', '20260210233000', '20260211180000', '20260211183000',
    '20260211190000', '20260216160000', '20260216170000', '20260216180000',
    '20260216190000', '20260216190100', '20260216200000', '20260216200100',
    '20260216210000', '20260216220000', '20260217120000', '20260217123000',
    '20260218120000', '20260222020609', '20260222020858', '20260222020913',
    '20260222020930', '20260222021428', '20260222022407', '20260222022416',
    '20260222022435', '20260222022633', '20260222022735', '20260222022822',
    '20260222022844', '20260222022934', '20260222022956', '20260222023042',
    '20260222023452', '20260222025534', '20260222025756', '20260222030024',
    '20260222030555', '20260222035540', '20260222035558', '20260222040328',
    '20260222040443', '20260222041628', '20260222042055', '20260223234952',
    '20260224001959', '20260224002001', '20260224003254', '20260224003720',
    '20260224004911', '20260224010813', '20260224011419', '20260224011834',
    '20260224014130', '20260224014248', '20260224030406', '20260224030811',
    '20260224033322', '20260224034332', '20260224035336', '20260224042723',
    '20260224043714', '20260224044115', '20260224045006', '20260224045847',
]


def get_local_versions():
    """Extrae la version de cada archivo en supabase/migrations/."""
    versions = {}
    for fname in os.listdir(LOCAL_DIR):
        if not fname.endswith('.sql'):
            continue
        m = re.match(r'^(\d+)_(.+)\.sql$', fname)
        if m:
            version = m.group(1)
            name = m.group(2)
            versions[version] = name
    return versions


def main():
    local = get_local_versions()
    supabase = set(SUPABASE_APPLIED)

    local_versions = set(local.keys())
    only_local = sorted(local_versions - supabase)
    only_supabase = sorted(supabase - local_versions)
    in_both = sorted(local_versions & supabase)

    print(f"{'='*75}")
    print(f"COMPARACION: Local ({len(local_versions)}) vs Supabase ({len(supabase)})")
    print(f"{'='*75}\n")

    print(f"[+] Aplicadas en ambos: {len(in_both)}")
    print()
    print(f"[!] SOLO EN LOCAL ({len(only_local)}) - no aplicadas en Supabase:")
    for v in only_local:
        print(f"    {v}_{local[v]}")
    print()
    print(f"[?] SOLO EN SUPABASE ({len(only_supabase)}) - no estan en local:")
    for v in only_supabase:
        print(f"    {v}")
    print()

    if not SUPABASE_APPLIED:
        print("!!! La lista SUPABASE_APPLIED esta vacia.")
        print("    Corre 99_compare_migrations.sql en Supabase SQL Editor,")
        print("    copia las versiones y pegalas en este script.")


if __name__ == '__main__':
    main()
