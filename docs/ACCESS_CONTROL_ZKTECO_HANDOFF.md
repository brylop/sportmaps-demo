# Control de Acceso ZKTeco (ADMS) — Mejoras / Fixes pendientes

**Fecha:** 2026-06-26 · **Actualizado:** 2026-06-27
**Estado:** pipeline funcionando end-to-end (PIN 2 → valida membresía+pago → concede → registra). Lo de abajo es lo que falta corregir/mejorar.

> ## ✅ Actualización 2026-06-27 — fases aplicadas (rama `develop`, falta deploy + migración en Supabase)
>
> Migración nueva: `supabase/migrations/20260627000001_access_control_versioned_schema.sql`.
> Cambios BFF en `access-adms.ts` y `access-api.ts`; UI en `AccessControlPage.tsx`.
>
> | # | Tema | Estado |
> |---|------|--------|
> | 1 | `device_commands.metadata` | ✅ ya estaba en prod; **versionado** en la migración (idempotente) |
> | 2 | ACK `OK:<n>` + dedup | ✅ ATTLOG responde `OK: <n>` + índice único `access_events_dedup_idx` + upsert `ignoreDuplicates` |
> | 3 | Notificación `body`/`metadata` | ✅ ahora usa `message` + `link` + `school_id` (columnas reales) |
> | 4 | Acceso a STAFF | ✅ `validateAccess` concede a `schools.owner_id` y a `school_members` activos (owner/admin/coach/staff) sin enrollment |
> | 5 | Mapeo PIN↔miembro + UI | ✅ tabla `zk_user_mappings` ya en uso; **UI "Asignar"** en eventos `ZK#<pin>` + endpoints `GET /members` y `POST /assign-user`; `/enroll` ahora puebla el mapeo |
> | 6 | Perf cache | ✅ cache en memoria del mapeo PIN→identidad (TTL 5 min) en `validateAccess` |
> | 7 | Migración versionada | ✅ las 4 tablas + RLS en `zk_user_mappings` (corrige linter ERROR `rls_disabled_in_public`) |
> | 8 | Seguridad `/iclock` | ✅ allowlist de IP **opt-in** vía env `ACCESS_DEVICE_IP_ALLOWLIST` (setear a `181.63.24.103` en prod) |
> | 🔴 NUEVO | Loop infinito de comando | ✅ el F22 truncaba el UUID en `/iclock/devicecmd` → comando quedaba `pending` reenviándose. Ahora se envía `cmd_seq` (entero corto) en `C:<seq>:` y se confirma por esa columna; la migración expira comandos pending atascados |
>
> **Pendiente de operación:** (a) aplicar la migración en Supabase, (b) deploy del BFF en Render, (c) setear `ACCESS_DEVICE_IP_ALLOWLIST=181.63.24.103`, (d) verificar que el `-1002` del F22 desaparece (si persiste, es formato de comando del firmware, ya no causa loop).

**Archivos:**
- `bff/src/routes/access-adms.ts` — protocolo PUSH del lector (`/iclock/*`)
- `bff/src/routes/access-api.ts` — API admin (`/api/v1/access/*`)
- `frontend/src/pages/school/AccessControlPage.tsx` — UI ("Acceso", `/school/access-control`)
- Tablas: `turnstile_devices`, `access_events`, `device_commands`

---

## 🔴 1. BLOQUEANTE — `device_commands.metadata` no existe

**Síntoma (logs Supabase):**
```
42703  column device_commands.metadata does not exist
GET /rest/v1/device_commands?select=id,command_type,metadata... → 400
```
**Dónde se usa:** `access-adms.ts` (`getrequest`, ~L211) y al encolar en `access-api.ts` (`/enroll` ~L186, `/revoke` ~L230, `/manual-open` ~L130).
**Qué rompe:** la cola de comandos `device_commands` (enrolamiento bidireccional SportMaps → F22). Mientras falle, **no se pueden entregar comandos al dispositivo** → enrolar/revocar remoto caído.

**Fix (migración, idempotente — no choca con el esquema actual):**
```sql
ALTER TABLE public.device_commands
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
NOTIFY pgrst, 'reload schema';
```
**Verificación:** encolar un comando de prueba (`/api/v1/access/enroll`) y confirmar que el F22 lo recoge en su `getrequest`.

---

## 🔴 2. ATTLOG sin ACK `OK:<n>` → el lector reenvía el backlog (duplicados)

**Síntoma:** ráfagas de 128 eventos repetidos en cada polling; `access_events` se infla.
**Causa:** `POST /iclock/cdata` responde `'OK'` plano (`access-adms.ts` ~L194). ZKTeco espera **`OK: <cantidad>`** para marcar los registros como subidos y avanzar su puntero.
**Fix:**
- Responder `res.send('OK: ' + lines.length)` en la rama ATTLOG.
- Agregar dedup: índice único `access_events (device_id, zk_user_id, occurred_at)` + insertar con `ON CONFLICT DO NOTHING`.

---

## 🔴 3. Notificación de "acceso denegado" falla silenciosa

`access-adms.ts` ~L176–182 inserta en `notifications` con `body` y `metadata`, columnas que **no existen** (la tabla es `user_id, school_id, title, message, type, read, link`). El insert falla y no se chequea.
**Fix:** usar `message` (no `body`); mover contexto al `link` o agregar columna `metadata` a `notifications`.

---

## 🟠 4. `validateAccess` no concede a STAFF (owner/coach/admin)

Hoy solo valida `enrollments.user_id = userId AND status='active'` (`access-adms.ts` ~L62–70). El **owner/coach** no tiene enrollment → `no_enrollment` aunque esté mapeado (caso real: Robinson, owner, es quien prueba).
**Fix:** conceder a `school_members` activos (owner/admin/coach); atletas siguen validando enrollment + pago al día.
*(Definir aparte si aplica a menores: van por `child_id` con `user_id NULL`, hoy no se contemplan.)*

---

## 🟠 5. Mapeo PIN ↔ miembro: mover a tabla dedicada + UI

Hoy `validateAccess` resuelve `zk_user_id → user_id` leyendo de `access_events` (funciona solo si ya hay una fila con `user_id`, como el PIN 2 sembrado a mano). Frágil y no escala.
**Fix:**
- Tabla `access_user_map (school_id, zk_user_id, user_id, PK(school_id, zk_user_id))` + RLS.
- `validateAccess` y `/enroll` usan/pueblan esa tabla.
- UI: botón **"Asignar usuario"** en los eventos `ZK#<pin>` desconocidos de `AccessControlPage` (hoy el `/enroll` no está conectado a ningún botón).

---

## 🟡 6. Rendimiento — cachear `zk_user_id → user_id`

Cada evento dispara varias queries (user_id, profile, enrollment, payment). Con volcados de 128+ eventos es una ráfaga grande. Cachear el mapeo en memoria (o batch) en vez de consultar evento por evento. **No bloqueante.**

---

## 🟡 7. Migración versionada de las tablas de acceso

`turnstile_devices`, `access_events`, `device_commands` parecen creadas a mano → no reproducibles en otros ambientes. Crear migración versionada (+ `access_user_map`, + RLS) siguiendo el patrón del repo.

---

## 🟡 8. Seguridad — `/iclock/*` sin autenticación

El dispositivo se identifica solo por `SN` en la URL → cualquiera con el SN puede inyectar eventos (`Encrypt=None`).
**Fix:** IP allowlist (firewall a la IP del gym `181.63.24.103`) y/o clave de comunicación por dispositivo. *(Antes de producción.)*

---

## Orden recomendado
1. **Fix #1** (`ALTER device_commands.metadata`) — desbloquea enrolamiento.
2. **Fix #2** (ACK `OK:<n>` + dedup) — frena el flood de duplicados.
3. **#5** (tabla de mapeo + UI) + **#4** (staff) — para reconocer al resto de usuarios.
4. **#3, #6, #7, #8** — pulido, perf, reproducibilidad, seguridad.

## Datos del entorno (RMGYM)
- `school_id = 2137182d-a695-4695-8e5a-61151fc59196`
- Lectores: `JJA1254900898` (entry), `JJA1254900899` (exit) — IP `181.63.24.103`
- Usuario para probar: **Robinson Mendoza** (owner) `3a699ea7-099a-4c5f-b3ee-640421b01b9b`
- 95 PINs en el lector vs. usuarios reales en SportMaps → pendiente el mapeo masivo (#5).
