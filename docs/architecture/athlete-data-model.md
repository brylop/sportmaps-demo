# Modelo de Datos de Atletas — SportMaps

**Fecha:** 2026-04-27
**Estado:** decisiones consolidadas tras diagnostico de staging
**Ambito:** define las fuentes de verdad para el concepto "atleta" y como se mapean a `user_accounts` en la Etapa C del roadmap maestro.

---

## TL;DR

- **`children`** es la **unica BASE TABLE** para atletas. 334 registros, todos menores con padre vinculado.
- **`students`** y **`school_athletes`** son **VIEWS** que enriquecen y unifican datos. NO son fuentes — son consumidores.
- Hay **3 fuentes reales** para "atleta visible en la app": `children`, `profiles+school_members`, `unregistered_athletes`.
- **Los menores NO tienen `user_account`** — viven bajo la cuenta del padre.
- **Los `unregistered_athletes` NO se migran** — no tienen `user_id`.
- El backfill de Etapa C lee 3 fuentes (sin contar `unregistered`).

---

## Las 3 fuentes reales

### 1. `children` — atletas menores con padre

**Tipo:** BASE TABLE
**Conteo (2026-04-27):** 334
**Constraints relevantes:**
- `id` NOT NULL (PRIMARY KEY)
- `full_name` NOT NULL
- `is_active` NOT NULL
- `parent_id` nullable (puede haber huerfanos sin padre)
- `school_id` nullable
- `team_id` nullable

**Caracteristica clave:** representa a un menor cuya cuenta legal vive bajo el padre. No tiene `user_id` propio.

### 2. `profiles + school_members` — atletas adultos auto-registrados

**Tipo:** join entre dos BASE TABLES
**Conteo (2026-04-27):** ~10 atletas adultos con membership activa en alguna escuela. (84 profiles con `role='athlete'` en total, pero solo ~10 vinculados a escuela activa.)

**Caracteristica clave:** son adultos con `auth.users` propio, registrados ellos mismos.

**Subcategoria — cuentas zombie:** los ~74 `profiles WHERE role='athlete' AND sin school_membership` activa son atletas registrados pero sin escuela aun. Se importan en C3 como `account_type='athlete'` con `linked_school_id=NULL` (atletas personales en transicion).

### 3. `unregistered_athletes` — atletas registrados manualmente por admin

**Tipo:** BASE TABLE
**Conteo (2026-04-27):** 89, todos con `linked_profile_id IS NULL`
**Caracteristica clave:** entrada manual por admin (planilla, telefono, presencia fisica) sin que el atleta tenga cuenta en la app.

**Decision para Etapa C:** **NO migrar a `user_accounts`**. Sin `user_id`, no hay cuenta posible. Cuando el admin obtiene email/telefono y vincula via `linked_profile_id`, entra al modelo unificado por el trigger normal (C5).

---

## Las 2 views (consumidores)

### `students` view

**Definicion (resumida):**
```sql
SELECT c.*, p.parent_*, e.enrollment_*, t.team_*, b.branch_*
FROM children c
LEFT JOIN profiles p          ON p.id = c.parent_id
LEFT JOIN enrollments e       ON e.child_id = c.id AND e.status = 'active'
LEFT JOIN teams t             ON t.id = COALESCE(e.team_id, c.team_id)
LEFT JOIN school_branches b   ON b.id = c.branch_id
```

**Conteo:** 378 (>334 porque LEFT JOINs explotan a children con multiples enrollments activos).

**Uso:** UI de listado de estudiantes en escuelas que manejan menores.

### `school_athletes` view

**Definicion (resumida):**
```sql
-- Bloque 1: menores
SELECT ... FROM children c LEFT JOIN profiles p ON p.id = c.parent_id ...
UNION ALL
-- Bloque 2: adultos
SELECT ... FROM profiles pr JOIN school_members sm ON sm.profile_id = pr.id
                                                  AND sm.role = 'athlete'
                                                  AND sm.status = 'active'
UNION ALL
-- Bloque 3: unregistered
SELECT ... FROM unregistered_athletes ua WHERE ua.linked_profile_id IS NULL
```

**Conteo:** 433 = 334 (children) + ~10 (adultos con sm activo) + 89 (unregistered).

**Uso:** UI unificada para escuelas hibridas (ver capability `manages_adults` de Etapa O).

---

## Mapeo a `user_accounts` (Etapa C)

| Fuente | account_type | linked_school_id | linked_membership_id | user_id |
|---|---|---|---|---|
| `profiles+school_members` (rol school admin/coach/etc) | rol correspondiente | si | si | profile.id |
| `profiles WHERE role='athlete' AND sm activo` | `athlete` | si | si | profile.id |
| `profiles WHERE role='athlete' AND sm inactivo/null` | `athlete` | NULL | NULL | profile.id |
| `profiles WHERE role='parent'` | `parent` | si (de los hijos) | NULL | profile.id |
| `children` | **NO migrar** | — | — | — |
| `unregistered_athletes` | **NO migrar** | — | — | — |

---

## Decisiones de diseño

### ¿Por que los menores no tienen cuenta?

1. **Realidad legal:** un menor no firma contratos ni paga suscripciones.
2. **Modelo simplificado:** una sola cuenta `'parent'` ve N hijos. La RLS de pagos/asistencia/reportes deriva de `children.parent_id = current_user.id`.
3. **Si el menor cumple 18:** se crea un `profile` con `role='athlete'`, se inserta `school_member`, y se le crea `user_account`. El registro original en `children` puede mantenerse historicamente (`is_active=false`) o migrarse al nuevo profile.

### ¿Por que las views existen?

Refactorizacion incremental — antes de tener `account_type` y `school_capabilities`, las views permitian que la UI mostrara una vision unificada de "atleta" sin importar la fuente. Despues del Bloque 1, las views pueden:

- Permanecer como compat layer hasta que toda la UI lea `user_accounts` directamente.
- O reescribirse para joinar contra `user_accounts` en lugar de las 3 fuentes.

### ¿Que pasa con multi-team?

Es **feature**, no bug. 30 children tienen 2-3 enrollments activos en teams distintos del mismo club (multi-disciplina). El modelo `user_accounts` no impone unicidad por team — la unicidad esta en `(user_id, account_type, linked_school_id)`.

Solo 3 children tienen enrollments duplicados al mismo team (bug de creacion de enrollment). Se limpian en A16 antes de C3.

---

## Riesgo: cualquier ALTER en tablas base

Las 2 views materializan columnas de `children`, `profiles`, `school_members`, `enrollments`, `teams`, `school_branches`, `payments`, `offering_plans`, `unregistered_athletes`.

**Cualquier `ALTER TABLE` en estas requiere:**
1. `DROP VIEW students CASCADE`
2. `DROP VIEW school_athletes CASCADE`
3. Aplicar el ALTER
4. Recrear ambas views desde el SQL guardado

**Mitigacion:** mantener la definicion canonica de las views en `supabase/migrations/<ts>_views_athletes.sql` para reaplicar facil.

---

## Glosario

- **Athlete:** cualquier persona que recibe servicio deportivo en una escuela. Puede ser menor (children) o adulto (profile+sm) o unregistered.
- **Atleta personal / cuenta zombie:** profile con `role='athlete'` sin school_membership. Atleta individual sin escuela.
- **Multi-disciplina:** child con multiples enrollments activos en distintos teams del mismo club (ej. natacion + atletismo). Valido.
- **Duplicado al mismo team:** child con 2+ enrollments activos en el MISMO team. Bug. 3 casos detectados.
- **Cross-school:** child con enrollments activos en 2+ escuelas distintas. Raro pero posible (1 caso detectado: `f4402afa`).

---

## Referencias

- Diagnostico ejecutado: `docs/diagnostics/team_id_audit.sql` + queries ad-hoc del 2026-04-27
- Roadmap maestro: `docs/ROADMAP.md` (Etapas A16-A18, C3a-d, decisiones 19-23)
- Etapa O — School Capabilities: `docs/ROADMAP.md` seccion O
