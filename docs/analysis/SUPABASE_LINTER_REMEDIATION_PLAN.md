# SportMaps — Plan de remediación del Supabase Linter

**Fecha:** 2026-05-11
**Última revisión:** 2026-05-11 (post-verificación contra BD remota)
**Owner sugerido:** plataforma / DBA
**Estado actual:** 1 ERROR · ~80+ WARN entre 6 reglas distintas
**Entorno verificado:** proyecto Supabase `luebjarufsiadojhvxgi`

---

## 0. Resumen ejecutivo

El linter de Supabase reporta hallazgos de seguridad que se pueden agrupar en 6 categorías. La mayoría son higiénicos (search_path, listing de buckets), pero hay **1 ERROR real**. Además, durante el análisis se confirmaron dos problemas de proceso adicionales:

> **Hallazgo 1 — Archivo de migración corrupto (decisión: dejarlo).**
> `supabase/migrations/20260503000007_security_invoker_views.sql` contiene únicamente JSON pegado del propio linter, no SQL. **Confirmado contra BD remota:** nunca se aplicó (no figura en `supabase_migrations.schema_migrations`). Aunque técnicamente es seguro borrarlo, **el equipo definió política firme: las migraciones nunca se borran ni editan, aunque estén corruptas**. Por lo tanto el archivo se queda como está y cualquier fix va en migración nueva. Ver Fase -1.

> **Hallazgo 2 — Drift entre BD remota y repo.**
> En la BD remota existe la migración aplicada `20260318124512_fix_security_invoker_views`, pero **el archivo no existe en `supabase/migrations/`**. Alguien la corrió manualmente desde el Dashboard y nunca la commiteó. Esa migración aplicó SECURITY INVOKER a varias vistas, **pero no a `school_athletes`** — por eso esa vista sigue como ERROR. Ver Fase -0.5.

> **Consumidores de `school_athletes` identificados** (relevante para Fase 2):
> Frontend la lee directo vía PostgREST en `frontend/src/lib/api/students.ts` (líneas 208, 270, 285, 659, 684), `frontend/src/lib/api/classes.ts:313`, y la usan `StudentsPage`, `SchoolStudentsManagementPage`, `SchoolCardsAdminPage`, `RegisterCashPaymentModal`, `AddDropInModal`. Convertir a SECURITY INVOKER **requiere validar previamente** que las RLS de las tablas base permiten lo que estos consumidores necesitan.

Distribución de hallazgos:

| Regla | Nivel | Conteo aprox. | Riesgo real | Esfuerzo |
|---|---|---|---|---|
| `security_definer_view` (`school_athletes`) | ERROR | 1 | Alto — bypass de RLS | Medio |
| `anon_security_definer_function_executable` | WARN | ~50+ | Variable — caso por caso | Alto |
| `function_search_path_mutable` | WARN | ~35 | Bajo/Medio | Bajo (mecánico) |
| `materialized_view_in_api` | WARN | 2 | Medio | Bajo |
| `public_bucket_allows_listing` | WARN | 4 | Bajo | Bajo |
| `extension_in_public` (`pg_trgm`, `unaccent`) | WARN | 2 | Bajo | Medio (rompe deps) |

---

## Fase -1 — Documentar el archivo fantasma (NO se borra)

**Objetivo:** dejar registro del archivo corrupto sin removerlo, según política del equipo de no tocar el histórico de migraciones.

**Política aplicable:** las migraciones existentes nunca se borran ni se editan, aunque estén corruptas o nunca se hayan aplicado. Cualquier fix va en migración nueva.

**Verificación previa ya hecha (2026-05-11):**
```sql
SELECT version, name FROM supabase_migrations.schema_migrations
 WHERE version = '20260503000007';
-- → 0 filas. La migración nunca se aplicó en remoto.
```

**Scope:**
- Crear un archivo `supabase/migrations/README.md` (o sección en un README existente) que documente el archivo fantasma:
  - Qué es (`20260503000007_security_invoker_views.sql`).
  - Por qué está corrupto (JSON pegado, no SQL).
  - Estado: nunca aplicado en remoto (verificado contra `schema_migrations`).
  - Por qué no se borra (política de inmutabilidad del histórico).
  - Quién hace el trabajo real: la migración nueva de Fase 2.
- **Riesgo si `supabase db reset` local:** si la CLI intenta aplicar este archivo en orden, va a fallar con sintax error. Hay dos mitigaciones posibles, a decidir:
  - **Opción A:** dejar el archivo como está y aceptar que `supabase db reset` local está roto hasta resolver Fase -0.5 (drift). En la práctica, en remoto la migración nunca se ejecutará porque su version ya está registrada con otro timestamp distinto si Supabase la detecta — pero hay que verificar este punto en local.
  - **Opción B:** envolver el contenido JSON en un comentario SQL multiline (`/* ... */`) para que el archivo sea SQL válido (y vacío en términos de ejecución). Esto es **editar** el archivo — chocar con la política. Solo si el equipo lo aprueba como excepción.

**Validación:**
- README con el contexto del archivo fantasma commiteado.
- Decisión documentada sobre `supabase db reset` local.

**Rollback:** revertir commit del README.

---

## Fase -0.5 — Resolver drift de la migración aplicada manualmente (BLOQUEANTE)

**Objetivo:** que el repo refleje la realidad de la BD. Sin esto, cualquier `supabase db reset` local diverge de producción.

**Problema:** la migración `20260318124512_fix_security_invoker_views` figura aplicada en `schema_migrations` pero no existe en `supabase/migrations/`.

**Scope:**
1. Recuperar el SQL real desde la BD remota:
   ```sql
   SELECT version, name, statements
     FROM supabase_migrations.schema_migrations
    WHERE version = '20260318124512';
   ```
   La columna `statements` es un array `text[]` con cada sentencia ejecutada.
2. Crear el archivo `supabase/migrations/20260318124512_fix_security_invoker_views.sql` con el contenido reconstruido.
3. Verificar con `supabase migration list` que el archivo y el registro remoto coinciden.
4. Auditar qué vistas cubrió esa migración y por qué `school_athletes` quedó afuera — eso alimenta Fase 2.

**Alternativa con CLI:**
```powershell
supabase link --project-ref luebjarufsiadojhvxgi
supabase db pull
```
`db pull` puede traer las migraciones faltantes automáticamente, pero también puede generar una nueva con timestamp distinto. Validar antes de commitear.

**Validación:**
- `supabase db reset` local + `supabase db push --dry-run` muestra "no pending migrations".

**Rollback:** revertir commit. Cero impacto en BD remota porque solo agregamos un archivo de espejo.

---

## Fase 1 — Quick wins de bajo riesgo (1 PR)

**Objetivo:** eliminar todos los WARN que se pueden cerrar mecánicamente sin tocar lógica.

**Scope:**

### 1.1 — `function_search_path_mutable` (~35 funciones)
- Una migración nueva `2026MMDDHHMMSS_function_search_path_fixes.sql`.
- Para cada función listada, aplicar:
  ```sql
  ALTER FUNCTION public.<nombre>(<args>) SET search_path = pg_catalog, public, pg_temp;
  ```
- **NO usar `SET search_path = ''`** sin auditar el cuerpo — varias funciones referencian `public.<tabla>` sin schema. Usar `pg_catalog, public, pg_temp` es seguro y suficiente para el linter.
- Lista completa de funciones a tratar (extraída del linter):
  - `update_body_metrics_updated_at`, `is_parent_of`, `is_parent_of_child`, `get_single_branch_id`, `update_athlete_training_plans_updated_at`, `sync_session_capacity`, `mark_overdue_payments`, `fn_sync_enrollment_offering_id`, `accept_invitation_pro`, `on_availability_deleted`, `on_availability_schedule_changed`, `sync_capacity_from_availability`, `sync_enrollment_participant_count`, `fn_generate_bookable_sessions`, `fn_extend_session_horizon`, `set_updated_at`, `get_athlete_stats`, `provision_personal_trainer_workspace`, `fn_cancel_pt_session`, `get_pt_client_summary`, `fn_book_pt_session`, `fn_generate_offering_sessions`, `generate_school_slug`, `migrate_unregistered_athlete_to_profile`, `process_enrollment_checkout`, `tg_athlete_id_cards_touch`, `fn_complete_session_plan` (x2 sobrecargas), `create_invitation`, `fn_create_plan_from_routine`, `format_period_label`, `vendor_payment_providers_enforce_single_default`, `school_payment_providers_enforce_single_default`, `resolve_payment_provider`, `get_school_athletes`.

### 1.2 — `materialized_view_in_api` (2 MVs)
- En la misma migración:
  ```sql
  REVOKE SELECT ON public.school_price_range FROM anon, authenticated;
  REVOKE SELECT ON public.mv_session_health FROM anon, authenticated;
  ```
- Si el frontend/BFF consulta directamente alguna de estas MVs, hay que cambiar el acceso a vía RPC o BFF con `service_role`. Antes de revocar, **grep en `frontend/` y `bff/`** por `school_price_range` y `mv_session_health` y migrar consumidores.

### 1.3 — `public_bucket_allows_listing` (4 buckets)
- Migración `2026MMDDHHMMSS_storage_listing_policies.sql`.
- Para cada bucket (`avatars`, `coach-certificates`, `facility-photos`, `school-assets`):
  - DROP de la policy actual con SELECT amplio.
  - CREATE policy nueva que sólo permita `SELECT` cuando la operación es `download` (no `list`). Patrón Supabase: usar `storage.objects` con `bucket_id = '<bucket>' AND name IS NOT NULL`, evitando consultas tipo `LIST`. En la práctica, los buckets públicos devuelven el objeto vía URL firmada/pública sin necesidad de listar.
- **Caso especial `coach-certificates`:** dice "Coach can view own certificates" — debería ser **bucket privado**, no público con SELECT. Considerar mover a privado en otra fase.

**Validación:**
- Smoke test del frontend: subir/ver avatar, ver foto de instalación, descargar QR de escuela.
- Re-correr linter: las 3 reglas (1.1, 1.2, 1.3) deben quedar en 0.

**Rollback:** revertir migración. Las `ALTER FUNCTION ... SET search_path` son reversibles con `RESET`. Los `REVOKE` con `GRANT`.

---

## Fase 2 — Fix del ERROR `security_definer_view` en `school_athletes` (1 PR)

**Objetivo:** convertir `public.school_athletes` a `SECURITY INVOKER`.

**Prerequisitos:** Fase -0.5 completada (sabemos qué hizo la migración del 18-mar y por qué `school_athletes` quedó afuera).

**Consumidores actuales identificados** (esto guía los tests obligatorios):
- `frontend/src/lib/api/students.ts` líneas **208, 270, 285, 659, 684** — múltiples queries vía `supabase.from('school_athletes')`.
- `frontend/src/lib/api/classes.ts:313` — lookup por ID al cargar clases.
- Pantallas consumidoras: `StudentsPage`, `SchoolStudentsManagementPage`, `SchoolCardsAdminPage`, `RegisterCashPaymentModal`, `AddDropInModal`.

**Scope:**
1. Localizar la definición actual de la vista. Como no aparece en el repo (`grep` sólo encuentra la corrupta), **hay que extraerla de la BD remota** vía:
   ```sql
   SELECT pg_get_viewdef('public.school_athletes', true);
   ```
2. Crear migración nueva (`2026MMDDHHMMSS_school_athletes_security_invoker.sql`) con:
   ```sql
   CREATE OR REPLACE VIEW public.school_athletes
       WITH (security_invoker = true)
       AS <misma definición que la actual>;
   ```
3. Auditar que las RLS de las tablas base (`children`, `profiles`, `enrollments`, etc.) permiten lo que cada consumidor necesita:
   - Una escuela debe poder ver a sus atletas (vía `enrollments.school_id`).
   - Un padre debe poder ver a sus hijos (vía `is_parent_of_child`).
   - Anon → 0 filas.
4. Si alguna RLS falta, **agregarla en la misma migración** antes de cambiar la vista.

**Validación:**
- Tests automatizados (mismo PR, sin merge sin esto):
  - Login como escuela A → consulta vista → solo atletas de escuela A, no de escuela B.
  - Login como padre → solo sus hijos.
  - Anon → 0 filas (vs. comportamiento actual que podría leer todo).
- Smoke manual en las 5 pantallas listadas arriba.
- Re-correr linter: ERROR debe desaparecer.

**Rollback:** revertir migración. Riesgo medio porque puede romper consultas si las RLS no están listas — por eso los tests no son opcionales.

---

## Fase 3 — Auditoría de `SECURITY DEFINER` expuestos a anon (N PRs por dominio)

**Objetivo:** cada función `SECURITY DEFINER` callable por `anon` debe estar justificada o cerrarse.

Esta es la fase de **mayor riesgo y esfuerzo** porque requiere decisión caso por caso. No es PR único — se divide por dominio.

**Clasificación propuesta:**

| Categoría | Acción | Ejemplos |
|---|---|---|
| **Anon intencional (token-based)** | Mantener, pero documentar y considerar rate-limit | `accept_invitation(p_invite_id)`, `access_demo_link(p_token)` |
| **Solo authenticated** | `REVOKE EXECUTE FROM anon` | La mayoría de los RPC de admin (`admin_*`, `admin_create_staff_direct`, `admin_global_counts`, `admin_list_*`) |
| **Solo service_role / admin** | `REVOKE EXECUTE FROM anon, authenticated` | `add_platform_admin`, funciones de provisioning interno |
| **Sin uso real** | `DROP FUNCTION` | Funciones huérfanas que ningún cliente llama |

**Procedimiento por función:**
1. `grep` en `frontend/` y `bff/` el nombre del RPC.
2. Si **nadie llama** → DROP.
3. Si **llama el BFF con `service_role`** → `REVOKE EXECUTE FROM anon, authenticated`.
4. Si **llama el frontend autenticado** → `REVOKE EXECUTE FROM anon`, mantener para `authenticated`.
5. Si **llama anon vía token** → mantener, pero validar que el cuerpo de la función verifique el token antes de cualquier lectura sensible.

**PRs sugeridos (uno por dominio):**
- PR 3a — Funciones de **admin/platform** (`admin_*`, `add_platform_admin`, `admin_global_counts`, etc.).
- PR 3b — Funciones de **certificados** (`_build_certificate_snapshot`, `_next_certificate_folio`).
- PR 3c — Funciones de **invitaciones / onboarding** (`accept_invitation`, `accept_invitation_pro`, `create_invitation`, `access_demo_link`).
- PR 3d — Funciones de **pagos** (`add_reservation_payment`, `resolve_payment_provider`, etc.).
- PR 3e — Funciones de **scheduling / sesiones** (`fn_book_pt_session`, `fn_cancel_pt_session`, `fn_generate_*`).

**Validación por PR:**
- Smoke test del flujo correspondiente con un usuario `authenticated` y, donde aplique, anon (debe fallar).
- Re-correr linter después de cada PR para confirmar reducción del conteo.

**Rollback:** `GRANT EXECUTE ... TO anon`. Sin pérdida de datos.

---

## Fase 4 — Mover extensiones fuera de `public` (1 PR — frágil)

**Objetivo:** mover `pg_trgm` y `unaccent` al schema `extensions`.

**Scope:**
```sql
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
ALTER EXTENSION unaccent SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
```

**Riesgos:**
- Cualquier código (RPC, vista, índice) que use operadores/funciones de `pg_trgm` (`%`, `similarity()`, índices `gin_trgm_ops`) o `unaccent()` sin schema-qualifier va a romper.
- Hay que **auditar previamente** todas las migraciones y RPCs por `unaccent(`, `similarity(`, `% `, `gin_trgm_ops`, y schema-qualificar (o agregar `extensions` a `search_path` de las funciones afectadas).

**Validación:**
- Búsqueda full-text en frontend (escuelas, atletas, productos) debe seguir funcionando.
- Tests de RPCs que usan trigramas.

**Rollback:** `ALTER EXTENSION ... SET SCHEMA public`.

**Por qué al final:** este es el cambio con mayor blast-radius del lote — puede romper búsqueda en producción si alguna función no se actualizó. Hacerlo cuando el resto ya esté limpio para que sea trivial bisectar regresiones.

---

## Cronograma sugerido

| Sprint / Semana | Fases | PRs estimados |
|---|---|---|
| Semana 1 | Fase -1 + Fase -0.5 + Fase 1 | 3 PRs |
| Semana 2 | Fase 2 + Fase 3a (admin) | 2 PRs |
| Semana 3 | Fase 3b/3c/3d | 3 PRs |
| Semana 4 | Fase 3e + Fase 4 | 2 PRs |

Total: ~10 PRs distribuidos en 4 semanas. Ningún PR debe mezclar fases.

---

## Convenciones

- **Naming de migraciones:** `YYYYMMDDHHMMSS_<short_slug>.sql` siguiendo lo que ya hay en `supabase/migrations/`.
- **Cada migración debe ser idempotente:** usar `IF EXISTS`, `IF NOT EXISTS`, `CREATE OR REPLACE` donde aplique.
- **Linter como gate:** correr el linter después de cada PR. Si el conteo sube, bloquear merge.
- **Comentario en cada `ALTER FUNCTION ... SET search_path`:** opcional — el `WHY` es obvio si referenciás el linter, no agregar ruido.

---

## Próximo paso

Las decisiones bloqueantes están resueltas. Para arrancar:

1. **Fase -1:** borrar `supabase/migrations/20260503000007_security_invoker_views.sql` (confirmado: nunca corrió en remoto). 1 PR de ~1 línea.
2. **Fase -0.5:** decidir cómo recuperar la migración del drift (`20260318124512_fix_security_invoker_views`):
   - **Opción recomendada:** correr `supabase db pull` y dejar que la CLI sincronice.
   - **Alternativa:** copiar `statements` desde el Dashboard y reconstruir el archivo a mano.
3. **Fase 1:** primer PR "real" de seguridad (search_path + MVs + buckets).

Solo después de -1 y -0.5 tiene sentido encarar Fase 2 (school_athletes) — sin el contexto del drift, no sabemos qué arregló la migración del 18-mar y podríamos reintroducir bugs.
