# Carga Fontibon -> Spirit All Stars

Scripts para cargar 6 equipos y 102 atletas desde `FONTIBON 2026.xlsx` a Supabase.

## Flujo completo

```
[1] Cargar a escuela test       [2] Validar en la app       [3] Migrar a real
────────────────────────────    ───────────────────────     ─────────────────────
jreyes@gmail.com                Previsualizar, editar        SPIRIT ALL STARS
(escuela + sede ya existen)     atletas, monthly_fee, etc.   mancipechirivi28@gmail.com
      ↓                                  ↓                          ↑
  01_create...sql                Login con jreyes             04_migrate...sql
```

## Archivos

| Archivo | Proposito |
|---------|-----------|
| `01_create_test_school_fontibon.sql` | Carga 6 equipos + 102 atletas en la escuela de `jreyes@gmail.com` (su escuela + sede ya creadas). Idempotente. |
| `02_verify_import.sql` | Verifica que todo quedo bien cargado |
| `03_rollback.sql` | Borra los equipos/atletas demo (la escuela y sede de jreyes NO se tocan) |
| `04_migrate_to_real_spirit.sql` | Mueve todo de `jreyes@gmail.com` a `mancipechirivi28@gmail.com` (SPIRIT ALL STARS real) |
| `00_check_tables.sql` | Verifica que tablas existen en tu Supabase |
| `99_compare_migrations.sql` | Ve las migraciones aplicadas en Supabase |
| `extract_and_generate_sql.py` | Regenera el SQL desde el Excel si cambia |
| `compare_migrations.py` | Compara migraciones locales vs Supabase |

## Pre-requisitos

- `jreyes@gmail.com` existe en `auth.users` y tiene:
  - 1 escuela asociada (como owner o como school_member)
  - Al menos 1 sede en esa escuela
- `mancipechirivi28@gmail.com` existe en `auth.users` y tiene:
  - La escuela SPIRIT ALL STARS con su sede

## Paso a paso

### Paso 1 - Cargar data en test

1. Abre Supabase Dashboard > SQL Editor
2. Copia `01_create_test_school_fontibon.sql` y ejecuta
3. El script auto-resuelve la escuela y sede de jreyes. En el log veras:
   ```
   NOTICE: Usando escuela <uuid>, sede <uuid>
   NOTICE: OK: Carga completada...
   NOTICE: Equipos: 6, Atletas: 102, Pendientes: 2
   ```

### Paso 2 - Verificar

Corre `02_verify_import.sql`. Deberia mostrar:
- 1 escuela (la de jreyes)
- 6 equipos demo (SPRINKLES, BUTTERFLY, BOMBSQUAD, LEGENDS, FIRESQUAD, BOMBSHELLS)
- 102 atletas
- 2 pendientes listados

### Paso 3 - Revisar en la app

- Login con `jreyes@gmail.com`
- Panel de escuela > veras los 6 equipos y sus atletas
- Puedes editar: `monthly_fee`, `emergency_contact` (acudiente), `medical_info` (EPS), fechas, etc.
- Los 2 pendientes (`Guadalupe Carvajal Moreno`, `maria camila reyes villay`) tienen fecha placeholder `2020-01-01` — editarlos cuando tengas la info

### Paso 4 - Migrar a SPIRIT ALL STARS real (cuando estes 100% listo)

1. Corre `04_migrate_to_real_spirit.sql`
2. El script:
   - Auto-resuelve escuela origen (jreyes) y destino (mancipechirivi28)
   - Mueve los 6 equipos y 102 atletas al destino
   - Cambia `is_demo = false`
   - La sede destino se asigna automaticamente (la principal de SPIRIT ALL STARS)

## Rollback

Si necesitas re-cargar desde cero:
```
03_rollback.sql   -> borra equipos/atletas demo
01_create...sql   -> recarga
```

## Regenerar SQL

Si cambia el Excel:
```bash
cd scripts/spirit-fontibon-import
python extract_and_generate_sql.py
```

## Atletas pendientes de completar

En el Excel vinieron solo con nombre. Estan cargados con `date_of_birth = 2020-01-01` (placeholder) y flag en `medical_info`:

| Equipo | Nombre | Falta |
|--------|--------|-------|
| BUTTERFLY | Guadalupe Carvajal Moreno | fecha, doc, acudiente, eps |
| FIRESQUAD | maria camila reyes villay | fecha, doc, acudiente, eps |

## Que tienes que editar manualmente en la UI

- `monthly_fee` — por atleta o por equipo
- Info de los 2 pendientes
- `parent_id` — se vincula cuando el papa se registre
- Fotos de atletas
