# Plan — Fusión de identidades de atleta duplicadas (F3)

**Estado:** propuesta, pendiente de aprobación. **No se ha escrito ninguna migración.**
Spec madre: [`docs/specs/consola-de-soporte-super-admin.md`](specs/consola-de-soporte-super-admin.md) § F3.
Detector (F4, ya implementado como script): [`scripts/audit-duplicate-athletes.mjs`](../scripts/audit-duplicate-athletes.mjs).

---

## 1. Qué se arregla

Barrido del 2026-08-05 sobre la base de producción, 361 escuelas:

| | |
|---|---|
| Personas que existen 2+ veces dentro de su propia escuela | **48** en 16 escuelas |
| De esas, con documento / fecha de nacimiento / acudiente que confirman la identidad | **29** |
| Con dos inscripciones **activas** (dos veces facturables) | **28** |
| Cobro doble ya generado | 7 → **2** (5 anulados con aprobación el 2026-08-05) |

Las dos que quedan son de GYM RM y **no son cobros de más: es plata cobrada dos veces** (Humberto Acuña pagó $70.000 el 13 y el 14 de julio sobre dos identidades distintas). Eso es devolución o crédito, no anulación, y sale del alcance de este plan.

Hoy no existe forma de unir dos identidades. La anulación manual del cobro compra un mes: las dos identidades siguen activas y la siguiente apertura de mes vuelve a generar los dos cobros.

### Cómo nacen (medido, no supuesto)

1. **Dos acudientes cargan al mismo menor.** El papá y la mamá crean cada uno su fila en `children`, con documento y fecha de nacimiento distintos porque cada uno los teclea de memoria. Julieta Mayorga Veloza: doc `10112109601` / nac 2011-05-13 (papá) vs doc `1011210629` / nac 2011-09-23 (mamá). El guard por documento nunca dispara.
2. **La misma persona cargada dos veces por la escuela**, con un dígito distinto en el documento. Anaisabel Mondragón (`1122651393` vs `1122651373`, correo del acudiente `ggilnavarro` vs `gglnavarro`), María Camila Ramírez, Humberto Acuña (`10324944504` vs `1032494504`).
3. **Carga masiva que mete dos filas en el mismo lote.** Sofia Anaya: las dos inscripciones tienen `created_at` idéntico al microsegundo (`2026-07-06T14:26:29.352374-05:00`), mismo equipo y mismo plan.
4. **Auto-registro por fuera de la invitación** (el caso ya documentado): la persona se registra sola y no adopta el `unregistered_athletes` que la escuela había creado. Cuando sí pasa por `accept_invitation_pro`, la RPC fusiona sola.

## 2. Qué NO entra

- **Multi-acudiente.** `children.parent_id` es una sola columna y no existe tabla de acudientes (`child_guardians`, `athlete_guardians`, `parent_children`: ninguna existe). Decisión tomada: **sobrevive la identidad del acudiente que ya pagó y al otro se le avisa**. El acudiente absorbido deja de ver al menor en su app. Si más adelante se construye multi-acudiente, la tabla de fusiones que propone este plan permite reengancharlo.
- **Homónimos.** El detector ya descarta los que comparten nombre pero tienen documento y fecha de nacimiento distintos (tres "VICTORIA GOMEZ" distintas en la misma escuela). La fusión nunca se dispara sola: siempre la confirma un humano.
- **Prevención.** El guard de alta individual ya existe en [`bff/src/routes/students-create-one.route.ts:123`](../bff/src/routes/students-create-one.route.ts#L123) (bloquea y sugiere, cruza por documento **y** por nombre normalizado). Falta llevarlo a la carga masiva y al auto-registro; va en un plan aparte.
- **Devoluciones.** Los dos casos de GYM RM con plata cobrada dos veces se reportan al gym, no se resuelven acá.

## 3. Modelo: qué es una identidad

Tres tablas, que son las tres ramas de la vista `school_athletes`:

| `kind` | tabla | clave | visible en el listado cuando |
|---|---|---|---|
| `child` | `children` | `children.id` | `is_active = true` |
| `unregistered` | `unregistered_athletes` | `unregistered_athletes.id` | `linked_profile_id IS NULL` |
| `adult` | `profiles` + `school_members` | `profiles.id` | `school_members.status` activo |

Combinaciones a soportar, con la observada en producción:

| sobrevive → absorbe | caso medido |
|---|---|
| `child` ← `child` | mayoría de Dynasty (Julieta, Anaisabel, Sergio, María Camila, Sofia) |
| `unregistered` ← `unregistered` | GYM RM (Aníbal Rojas, Humberto Acuña) |
| `adult` ← `unregistered` | Miguel Ángel Runza (hoy lo resuelve `accept_invitation_pro`) |
| `adult` ← `child` | menor que creció y se autoregistró con cuenta propia |
| `child` ← `unregistered` | escuela precarga + acudiente crea al menor |

**Regla dura:** cuando una de las dos es `adult`, **la adulta sobrevive siempre** — es la única que puede entrar, pagar y recibir avisos. Entre dos del mismo tipo, el sobreviviente lo elige el humano en el preview; el detector propone uno (el que ya pagó, tiene acudiente real, equipo y cuota).

## 4. Paso 0 — inventario que hay que cerrar antes de escribir SQL

El barrido del esquema vivo (OpenAPI de PostgREST) encontró **38 objetos** con `child_id`, `unregistered_athlete_id` o `athlete_id`. Fusionar sin recorrerlos todos deja huérfanos apuntando a una identidad desactivada.

Clasificación preliminar (grep contra `supabase/migrations`):

**Hay que mover el puntero (tabla, versionada):**
`enrollments`, `payments`, `attendance_records`, `session_bookings`, `academic_progress`, `athlete_certificates`, `athlete_id_cards`, `event_registrations`, `access_events`, `zk_user_mappings`

**Hay que mover el puntero (tabla, NO versionada — deriva de esquema):**
`attendance`, `event_team_members`, `identity_documents`, `payment_reminder_logs`, `group_class_athletes`, `payment_installments`

**Vistas — no se tocan, se recalculan solas:**
`pending_payments`, `payments_with_installments`, `v_payment_contacts`, `v_payment_abonos_summary`, `v_document_compliance_report`, `children_stats`

**Copias de respaldo — no se tocan:**
`_backup_paola_checkout_20260729`, `_backup_payments_fantasma_20260728`, `bkp_f0_enrollments_20260731`, `bkp_f0_payments_20260731`

**`athlete_id` que apunta a `profiles`, no a `children`** — solo importan cuando la fusión involucra una identidad `adult`:
`athlete_goals`, `athlete_stats`, `athlete_payments`, `bookings`, `health_records`, `training_logs`, `wellness_appointments`, `wellness_evaluations`, `biomech_baselines`, `biomech_captures`, `biomech_access_grants`

**Primera tarea, en el SQL editor, antes de una sola línea de migración** — cerrar la clasificación con la base como fuente de verdad (el repo no la reproduce: ~336 objetos de deriva):

```sql
SELECT c.relname,
       c.relkind,                      -- 'r' tabla, 'v' vista, 'm' matview
       a.attname,
       pg_get_constraintdef(k.oid) AS fk
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_constraint k ON k.conrelid = c.oid AND a.attnum = ANY (k.conkey) AND k.contype = 'f'
 WHERE a.attname IN ('child_id','unregistered_athlete_id','athlete_id','athlete_profile_id','student_id')
 ORDER BY c.relkind, c.relname, a.attname;
```

El resultado de esa consulta **es** la lista de `UPDATE`s de la RPC. Si aparece un objeto nuevo que este plan no menciona, se agrega antes de escribir la migración; no después.

## 5. La RPC

```sql
merge_athlete_identities(
  p_school_id       uuid,
  p_survivor_kind   text,      -- 'child' | 'unregistered' | 'adult'   (CHECK, no enum)
  p_survivor_id     uuid,
  p_absorbed_kind   text,
  p_absorbed_id     uuid,
  p_reason          text,      -- obligatorio, va a audit_logs
  p_dry_run         boolean DEFAULT true
) RETURNS jsonb
```

`SECURITY DEFINER`, `SET search_path = pg_catalog, public, pg_temp`, `GRANT EXECUTE … TO authenticated` explícito (el `SECURITY DEFINER` no exime al caller de tener `EXECUTE`).

**Contrato:**

- `p_dry_run = true` (default) recorre todo, no escribe nada y devuelve el plan: qué inscripción se completa y con qué, qué pagos se re-apuntan, qué pagos se anulan, cuántas filas se mueven por tabla, qué acudiente pierde acceso. Es lo que pinta el preview.
- `p_dry_run = false` ejecuta. Función = una transacción: o todo o nada.
- Falla con excepción, nunca en silencio, si: las dos identidades son la misma; no pertenecen a `p_school_id`; alguna ya fue fusionada (`athlete_identity_merges`); el caller no es `super_admin`; `p_reason` viene vacío.
- **Nunca fusiona por su cuenta.** No hay job, no hay trigger. Solo se invoca desde el endpoint con confirmación humana.

### Orden de los pasos (el orden es parte del contrato)

1. **Bloqueo.** `SELECT … FOR UPDATE` sobre las dos filas de identidad y sobre sus `enrollments`. Sin esto, dos operadores fusionando en paralelo dejan la mitad de los punteros en cada lado.
2. **Completar la inscripción que sobrevive.** Rellenar `team_id`, `offering_plan_id`, `monthly_fee` **solo donde el sobreviviente tiene `NULL` o `0`** y la absorbida tiene valor. Nunca sobrescribir un valor bueno: la inscripción de Julieta que sobrevive tiene cuota 150.000 y equipo; la absorbida tiene cuota 0. Al revés se perdería la cuota.
3. **Re-apuntar los pagos con plata.** `paid`, `approved`, `partial` de la absorbida pasan al sujeto sobreviviente **conservando su `parent_id` original** — la plata la puso ese acudiente y el recibo tiene que seguir siendo suyo. Es también lo que le deja ver su histórico al acudiente que pierde el acceso al menor.
4. **Resolver la deuda.** Por cada pago en deuda (`pending`, `overdue`, `awaiting_approval`, `partial`, `glosado`) de la absorbida:
   - si el sobreviviente ya tiene uno del mismo periodo (`period_year`/`period_month`, con `due_date` truncado a mes como respaldo — GYM RM tiene los periodos en `NULL`) → **anular** el de la absorbida;
   - si no lo tiene → **re-apuntarlo**. Anular deuda sin gemelo le borra plata real al club.
5. **Cancelar las inscripciones de la absorbida** (`status = 'cancelled'`), después de los pasos 2–4. Antes, se pierde el equipo y la cuota que solo ella tenía.
6. **Mover el resto de los punteros**, tabla por tabla según el paso 0. Asistencia, reservas, carnets, documentos, eventos, mapeos ZKTeco. En las que tengan índice único por `(atleta, fecha)` — `attendance`, `attendance_records` — la colisión se resuelve conservando la fila del sobreviviente y descartando la de la absorbida, no reventando la transacción.
7. **Marcar la identidad absorbida.**
   - `unregistered`: `linked_profile_id = <perfil sobreviviente>` + `is_active = false`. El paso 5 de la spec: es lo que la saca del listado, porque la rama de la vista filtra `WHERE ua.linked_profile_id IS NULL`.
   - `child`: `is_active = false` + `merged_into_kind` / `merged_into_id`.
   - `adult`: `school_members.status = 'merged'` para esa escuela. **El `profiles` no se toca jamás** — la persona sigue teniendo su cuenta.
8. **Registrar.** Una fila en `athlete_identity_merges` con el snapshot completo de lo que cambió, más `audit_logs` (`school_id`, `profile_id` del actor, `table_name`, `record_id`, `action = 'merge_athlete_identities'`, `old_data`, `new_data`).
9. **Avisar al acudiente absorbido**, si lo hay y es distinto del sobreviviente. Por el despachador unificado de notificaciones: "el registro duplicado de \<atleta\> se unificó; los pagos que hiciste siguen en tu historial; para volver a ver a \<atleta\> pídele acceso a la escuela". Fuera de la transacción: un fallo de push no debe revertir la fusión.

## 6. Migración: qué se crea

Con `npm run migrations:new -- fusion-identidades-atleta` (reserva versión y actualiza `migrations_ledger.json`).

```
athlete_identity_merges
  id              uuid pk default gen_random_uuid()
  school_id       uuid not null references schools(id)
  survivor_kind   text not null check (survivor_kind in ('child','unregistered','adult'))
  survivor_id     uuid not null
  absorbed_kind   text not null check (absorbed_kind in ('child','unregistered','adult'))
  absorbed_id     uuid not null
  reason          text not null
  snapshot        jsonb not null      -- todo lo que cambió, para poder revertir
  merged_by       uuid not null references profiles(id)
  merged_at       timestamptz not null default now()
  reverted_at     timestamptz
  reverted_by     uuid references profiles(id)
  unique (absorbed_kind, absorbed_id) where reverted_at is null
```

Sin `CREATE TYPE`: `text + CHECK`, como manda el repo. FK a `public.profiles`, no a `auth.users`.

Columnas nuevas: `children.merged_into_kind text`, `children.merged_into_id uuid`, y las mismas en `unregistered_athletes` (esta ya tiene `linked_profile_id`, que cubre el caso `adult`; las columnas nuevas cubren `child` y `unregistered`).

RLS de `athlete_identity_merges`: lectura para staff de la escuela vía `is_school_admin(school_id)`, escritura solo desde la RPC. La policy **no hace `SELECT` sobre `athlete_identity_merges`** en su `USING`.

`revert_athlete_merge(p_merge_id uuid, p_reason text)` — misma firma de seguridad, revierte desde `snapshot`. Es la red para el falso positivo: fusionar a dos personas distintas es mucho más caro de deshacer a mano que un duplicado.

## 7. BFF y frontend

Los dos endpoints van dentro de [`bff/src/routes/admin-support.routes.ts`](../bff/src/routes/admin-support.routes.ts), que ya existe con el F0 de diagnóstico (sin commitear al 2026-08-05).

- `GET /api/v1/admin/support/duplicate-athletes` — el barrido del script, ahora dentro del producto (F4). Devuelve grupos con veredicto (`CONFIRMADO` / `PROBABLE`), señales compartidas, sobreviviente sugerido, riesgo mensual y cobros dobles ya generados. Filtro por escuela.
- `POST /api/v1/admin/support/merge-athletes` con `{ schoolId, survivor, absorbed, reason, dryRun }` → pasa a la RPC. **La service key jamás toca el frontend.**
- **El gate es `requireSuperAdminStrict`, no `requireRole('super_admin')`.** `requireRole` tiene un escape hatch (`PRIVILEGED_ROLES`) que deja pasar a cualquier `admin`, y hay cuentas `admin` en la base que no deben poder fusionar identidades de terceros. El router ya monta el gate estricto; basta colgarse de él.
- Pantalla en la consola de soporte: lista de candidatos, y por caso las dos identidades lado a lado con documento, fecha de nacimiento, acudiente, equipo, cuota, cobros pagados y deuda. Botones: *Ver plan* (dry run), *Fusionar* (motivo obligatorio), *No son la misma persona* (marca el par como descartado para que no vuelva a salir).
- El veredicto `PROBABLE` se pinta distinto y exige que el operador tilde "confirmé con la escuela". Sofia Anaya y Julieta Mayorga habrían caído acá.

## 8. Concurrencia y pruebas

Tests de concurrencia en la fase de backend, como cualquier módulo del repo:

1. Dos fusiones en paralelo sobre la misma pareja → una gana, la otra falla con "ya fusionada". Verifica el `FOR UPDATE` y el índice único.
2. Fusión mientras corre `open_month` para esa escuela → no puede quedar un cobro nuevo colgado de la identidad absorbida.
3. Fusión con un pago del absorbido en checkout (webhook de Wompi/MP entrando) → el webhook tiene que caer en el pago re-apuntado, no perderse.
4. `dry_run` seguido de `apply` sobre datos que cambiaron en el medio → el plan se recalcula, no se aplica el viejo.
5. Reversa: fusionar y revertir devuelve el estado exacto, incluidos los cobros anulados en el paso 4.
6. Regresión de la vista: después de fusionar, `school_athletes` trae **una** fila y `payment_status` sale del cobro más antiguo con deuda, sin `NULL` intermedios.

Casos de datos reales para los tests (todos en Dynasty, ya medidos): Anaisabel Mondragón (`child`←`child`, un acudiente con typo), Julieta Mayorga (`child`←`child`, dos acudientes distintos), Miguel Ángel Runza (`adult`←`unregistered`, ya vinculado).

## 9. Orden de entrega

| Fase | Alcance | Riesgo |
|---|---|---|
| **P0** | Cerrar el inventario del §4 con la consulta en el SQL editor. Sin esto no se escribe migración. | Nulo |
| **P1** | Migración: `athlete_identity_merges`, columnas de marca, RLS, `merge_athlete_identities` con `p_dry_run` **forzado a true** (no escribe todavía) | Bajo |
| **P2** | Habilitar la escritura en la RPC + `revert_athlete_merge` + tests de concurrencia | Alto |
| **P3** | BFF: los dos endpoints con `requireRole('super_admin')` + auditoría | Medio |
| **P4** | Frontend: pantalla de candidatos con preview y motivo obligatorio | Bajo |
| **P5** | Aviso al acudiente absorbido por el despachador de notificaciones | Bajo |
| **P6** | Correr las 29 confirmadas, una por una, revisando el plan de cada una | Medio |

P1 se puede desplegar sin miedo: una RPC que solo sabe explicar lo que haría es un diagnóstico, no una acción.

## 10. Decisiones abiertas

1. **Las 19 `PROBABLE`** (nombre completo idéntico, documento y fecha distintos): ¿el super_admin las fusiona bajo su criterio, o se le pregunta primero a la escuela? Julieta salió `PROBABLE` y era real; Sofia Anaya salió `PROBABLE` y lo confirmó el `created_at` idéntico del import, no los datos de la persona.
2. **Escuelas de prueba.** ACADEMIA SUPERIOR BOGOTA (9 casos, "Killian Mbappe", "Pepita Perez", "Fulanita Tal") y "Felipe Rincon" (con una cuota de $5.000.000 que infla el riesgo agregado) son datos de prueba en la base compartida. ¿Se marcan con `account_type` para que el detector las excluya, o se dejan?
3. **`unregistered` ← `unregistered`** (GYM RM): no hay perfil al que apuntar `linked_profile_id`. Con `merged_into_id` alcanza, pero conviene confirmar que ninguna otra rama del producto asume que un `unregistered` inactivo es "se fue del gym" en vez de "se fusionó".
4. **Documentos con longitud inválida.** Aparecieron documentos de 11, 12 y 15 dígitos (`894383130901909`). ¿Entra en este plan un `CHECK` de longitud sobre `doc_number`, o va con el plan de prevención?
