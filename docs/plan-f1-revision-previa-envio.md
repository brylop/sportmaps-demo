# Plan de migraciones — F1: Revisión previa al envío

**Spec:** [`docs/specs/school-onboarding-safety.md`](specs/school-onboarding-safety.md) v0.2 · **Fase:** F1
**Fecha:** 30 de julio de 2026 · **Estado:** 🟡 pendiente de aprobación (no se escribe SQL hasta entonces)

> Convención del repo: plan aprobado antes de código en migraciones. RLS revisado línea por línea.

**Revisión 2 (30-jul):** se corrigió un error que habría roto el gate en el primer intento —el BFF hablaba con la RPC como `service_role`, donde `auth.uid()` es NULL y la autorización rechazaba **todos** los envíos, incluidos los legítimos (§5.0). Además: TTL de la confirmación (§5.1), verificación de drift ampliada a los helpers de RLS (§7), origen del 392 documentado, `desde` de C10 derivado del dato, y semántica de `READINESS_GATE_ENABLED` precisada (§5.3).

---

## 1. Alcance

Una migración nueva, un endpoint nuevo en el BFF y una pantalla. Nada de esto cambia el comportamiento de lo que ya funciona **excepto** el gate del envío masivo, que es el punto del ejercicio.

**Fuera de alcance en F1:** los índices únicos de catálogo y la importación idempotente (F2), y la reconciliación del drift (F3).

---

## 2. Un ajuste al spec antes de empezar

El spec ubica `normalize_name()` en F2 (§3.1), pero **C3 y C4 la necesitan en F1**: sin ella, "Luciana Pérez" vs "LUCIANA PEREZ" bloquearía por falso positivo, que es justo el riesgo del §8.

→ **`normalize_name()` se crea en F1.** F2 sigue siendo dueña de los índices que la usan y de migrar `accept_invitation_pro` / `claim_orphan_children` a ella (D11).

---

## 3. Objetos de base de datos

### 3.1 `public.normalize_name(text) → text`

`IMMUTABLE`, `STRICT`, `LANGUAGE sql`, `SET search_path = pg_catalog, public, pg_temp`.

Transformación: `lower` → quitar acentos → colapsar espacios y guiones → `trim`.

**Decisión técnica: acentos con `translate()`, no con `unaccent()`.** La extensión `unaccent` puede no estar instalada, y su función es `STABLE`, no `IMMUTABLE` — no sirve para un índice sin envolverla, y esa envoltura es una trampa conocida (si cambia el diccionario, el índice queda corrupto en silencio). `translate()` sobre el juego de caracteres del español es determinista y no necesita extensión:

```
translate(lower(x), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc')
```

Cubre español y portugués básico. No cubre alfabetos no latinos — aceptable: hoy no hay escuelas fuera de Colombia.

**Verificación previa:** ¿existe ya una función con ese nombre? El repo tiene drift; hay que mirar antes de crear.

### 3.2 `public.school_readiness_report(p_school_id uuid) → jsonb`

`SECURITY DEFINER`, `SET search_path = pg_catalog, public, pg_temp`, `GRANT EXECUTE … TO authenticated`.

**Autorización dentro de la función** (no basta con `SECURITY DEFINER`):

```
IF NOT (public.is_super_admin() OR public.is_school_admin_of(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
END IF;
```

> El check depende de `auth.uid()`, así que **quien llame debe traer el JWT del usuario**. Ver §5.0: el BFF no puede invocarla con `service_role`.

**Forma del retorno:**

```json
{
  "school_id": "…",
  "evaluated_at": "2026-07-30T16:00:00Z",
  "puede_enviar": false,
  "hallazgos": [
    { "codigo": "C2", "severidad": "bloquea", "cantidad": 3,
      "titulo": "Correos de acudiente inválidos",
      "muestra": [ { "id": "…", "etiqueta": "ANA ISABELLA FORERO GARZON" } ] }
  ]
}
```

**Reglas de construcción:**

- Una sola sentencia con CTEs por chequeo. Diez `SELECT` sueltos sobre 419 atletas es barato, pero conviene un solo plan.
- `muestra` limitada a **5 elementos** por hallazgo. Sin ese límite, Dynasty devolvía 343 filas en un solo campo — la UI necesita el conteo, no la lista completa; para la lista está la pantalla de cada módulo.
- Hallazgos con `cantidad = 0` **no se incluyen**. El arreglo trae solo lo que hay que mirar.
- `puede_enviar` = no hay ningún hallazgo con `severidad = 'bloquea'`.
- Los diez chequeos son los de §2.1 del spec. C1 y C7 → `confirma`; C2–C6 → `bloquea`; C8–C10 → `advierte`.
- C10 se calcula contra `email_sends` y devuelve en su payload el `desde` **derivado del dato**: `min(created_at)` de `email_sends` de esa escuela (o `null` si no hay ninguno). Nada de fecha fija: un entorno nuevo o un reset de staging haría mentir a un `'2026-07-30'` hardcodeado. La UI rotula con lo que venga (D12).

**Riesgo de rendimiento:** C4 (nombres duplicados) agrupa toda la tabla `children` de la escuela; C6 agrupa `enrollments`. Con 419 atletas es instantáneo. Se mide con `EXPLAIN ANALYZE` sobre Dynasty antes de dar por buena la fase; si alguna escuela creciera a decenas de miles, se revisa entonces.

### 3.3 `public.school_send_confirmations`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `school_id` | `uuid` NOT NULL | FK → `schools(id)` ON DELETE CASCADE |
| `confirmed_by` | `uuid` NOT NULL | FK → **`profiles(id)`**, no a `auth.users` (convención) |
| `snapshot` | `jsonb` NOT NULL | `{"C1": 343, "C7": 1}` — solo los 🟠 aceptados |
| `invitations_count` | `integer` NOT NULL | cuántas invitaciones cubría |
| `created_at` | `timestamptz` NOT NULL | `now()` |
| `consumed_at` | `timestamptz` | NULL = aún vigente |

Índice: `(school_id, created_at DESC) WHERE consumed_at IS NULL` — la consulta del gate es "la confirmación viva de esta escuela".

**RLS:** `ENABLE`, política de `SELECT` para `is_super_admin() OR is_school_admin_of(school_id)`. **Sin política de escritura**: escribe el BFF con `service_role`, igual que `email_sends`. Ninguna policy hace `SELECT` sobre la propia tabla (sin auto-recursión).

**Sin `CREATE TYPE`** para nada: severidades y códigos viajan como `text` dentro del jsonb.

---

## 4. Orden de la migración

Archivo único, timestamp posterior al último aplicado (hoy `20260730000003`). Todo dentro de `BEGIN`/`COMMIT`:

1. `normalize_name()` — `CREATE OR REPLACE`.
2. `school_send_confirmations` — `CREATE TABLE IF NOT EXISTS` + índice + RLS + política.
3. `school_readiness_report()` — `CREATE OR REPLACE` + `GRANT EXECUTE`.
4. `NOTIFY pgrst, 'reload schema'`.

**No hay backfill ni limpieza de datos.** F1 solo observa; nada muta filas existentes. Eso la hace segura de aplicar en producción a cualquier hora, a diferencia de F2.

**Reversible:** `DROP FUNCTION` + `DROP TABLE` la deja como estaba. Ninguna tabla existente se altera.

---

## 5. BFF

### 5.0 Cómo llama el BFF a la RPC (bloqueante — resuelto)

El cliente `supabase` del BFF ([`config/supabase.ts`](../bff/src/config/supabase.ts)) usa `service_role`. Con esa clave **`auth.uid()` es NULL**, así que `is_super_admin()` e `is_school_admin_of()` devuelven false y la RPC rechazaría con `42501` **todos** los envíos, incluidos los legítimos. La migración y el BFF se contradecían en silencio.

**Decisión: el BFF llama la RPC con el JWT del usuario del request**, no con `service_role`.

Es el patrón que el repo ya usa —por ejemplo [`admin-payments.routes.ts:42`](../bff/src/routes/admin-payments.routes.ts#L42)— y el middleware ya deja el token disponible en `req.userToken` ([`authMiddleware.ts:144`](../bff/src/middlewares/authMiddleware.ts#L144)):

```ts
const userClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  { global: { headers: { Authorization: `Bearer ${token}` } } }
);
const { data: report } = await userClient.rpc('school_readiness_report', { p_school_id: schoolId });
```

**Por qué esta y no `OR auth.role() = 'service_role'`:** añadir esa cláusula haría que la RPC confíe en cualquier llamada con la clave de servicio **sin validar la escuela**, dejando la autorización real solo en el middleware del BFF. Con el JWT del usuario, la función tiene una sola semántica —la misma se llame desde el frontend o desde el BFF— y el chequeo de escuela ocurre siempre en la base.

Aplica igual a `send-confirmation` (§5.2), que también evalúa el reporte.

**Consecuencia a verificar en el PR:** las escrituras siguen yendo por `service_role` (`school_send_confirmations` no tiene policy de escritura, igual que `email_sends`). Solo la **lectura del reporte** usa el cliente del usuario.

### 5.1 Gate en `POST /api/v1/invitations/bulk-send`

Antes de armar los lotes:

1. Llamar `school_readiness_report(schoolId)`.
2. Si hay 🔴 → **409** con `{ error: 'school_not_ready', evaluated_at, report }` (§2.2 del spec).
3. Si hay 🟠 → exigir `confirmation_id` en el body. Sin él → 409 con el reporte.
4. **Validar vigencia:** `created_at > now() - interval '1 hour'`. Sin TTL, una confirmación de julio con `consumed_at` NULL seguiría viva en agosto si los números bajaron — y D10 del spec dice explícitamente que julio no exime a agosto. No hace falta columna nueva: se deriva de `created_at`. Vencida → 409, y la UI vuelve a pedirla.
5. Validar la confirmación contra el snapshot (§2.4): rechaza si un código creció o si aparece uno nuevo; pasa si bajó o desapareció.
6. Marcarla consumida con `UPDATE … SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL RETURNING id`. **Si no devuelve fila, otro envío la usó** → 409. Esto evita que dos pestañas abiertas reutilicen la misma confirmación.

El gate aplica igual a los envíos con `invitation_ids` explícitos (botón "Invitar"), porque el daño no depende de cuántas se manden.

**Comportamiento esperado — no "arreglar" después:** la confirmación **se consume antes** de armar los lotes. Si Resend está caído y el envío falla entero, la confirmación ya se quemó y el admin tiene que confirmar de nuevo. Es deliberado: mover el consumo al final reabriría la ventana de las dos pestañas, que es un problema peor que re-confirmar.

### 5.2 `POST /api/v1/invitations/send-confirmation`

Crea la confirmación: evalúa el reporte en el servidor, guarda **las cantidades que el servidor ve** (no las que mande el cliente — si no, el cliente podría confirmar cifras inventadas) y devuelve el `confirmation_id`.

### 5.3 Válvula de escape

Variable de entorno `READINESS_GATE_ENABLED` (default `true`).

**En `false` sigue evaluando el reporte y lo registra, pero no rechaza:** los 🔴 pasan a advertencia en la respuesta y el envío procede sin exigir confirmación. Apagar la evaluación completa sería tirar el dato justo cuando más se necesita — con esta semántica, el periodo con el gate apagado deja evidencia de **qué habría bloqueado**, que es lo que permite calibrar los falsos positivos antes de volver a encenderlo.

Cada envío que se salta el gate se loguea con el reporte completo y un marcador explícito.

---

## 6. Frontend

- Pantalla de revisión previa: lista de hallazgos agrupada por severidad, cada uno con enlace al módulo donde se corrige.
- 🟠 → casilla con el texto explícito ("Entiendo que 343 atletas quedarán con cuota $0"), que llama a `send-confirmation` y guarda el `confirmation_id` para el envío.
- El 409 se pinta con el `report` que trae la respuesta, no con una segunda llamada a la RPC.
- Los mensajes de error pasan por [`dbErrorMessage`](../frontend/src/lib/errors/dbErrorMessage.ts).

---

## 7. Verificación

**Antes de aplicar**, sobre producción:

```sql
-- 1. ¿Ya existe algo con esos nombres? (drift)
SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('normalize_name', 'school_readiness_report');
SELECT to_regclass('public.school_send_confirmations');

-- 2. Los helpers de RLS de los que DEPENDE la RPC nueva: que existan y qué hacen
SELECT p.oid::regprocedure AS firma, pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('is_super_admin', 'is_school_admin_of');
```

**Leer la definición de los dos helpers, no solo confirmar que existen.** Dado el historial de drift, hay que responder antes de escribir la RPC: ¿`is_school_admin_of` cubre también al **owner** de la escuela, o solo al rol `school_admin`? Si solo cubre uno, el dueño de una escuela pequeña —que es el caso común— no podría ver su propio reporte y el gate lo dejaría fuera de su propio envío. Si resulta que no cubre al owner, el check pasa a `is_super_admin() OR is_school_admin_of(p_school_id) OR EXISTS (SELECT 1 FROM schools WHERE id = p_school_id AND owner_id = auth.uid())`.

**Después**, contra Dynasty — que es el mejor caso de prueba que existe porque conocemos su estado real:

| Chequeo | Valor esperado hoy |
|---|---|
| C1 cuota $0 | 1 (JEISON, si aún no le asignaron plan) |
| C2 correos inválidos | 0 |
| C3 invitación sin atleta | 0 |
| C4 nombres duplicados | 0 |
| C6 doble inscripción | 0 |
| C10 ya enviadas | 392 |
| `puede_enviar` | `true` |

**De dónde sale el 392:** del reenvío masivo del 2026-07-30 por `bulk-send`, que pobló `email_sends` con 392 filas en `sent` y 0 en `failed` (393 familias con invitación pendiente menos la espuria de `janethgarzo@` que anulamos). Ese número **solo existe porque ese envío ocurrió**; en cualquier otra escuela, o si se valida sobre una base sin ese evento, C10 dará mucho menos y no significa que el chequeo esté mal. Lo que se valida es la cifra contra `SELECT count(*) FROM email_sends WHERE school_id = … AND status = 'sent'`, no contra el 392 literal.

Si algún número no coincide con lo que ya medimos a mano estos dos días, el chequeo está mal escrito. **Esa es la prueba de la fase**, no un test sintético.

Y una escuela de control con datos sucios (MMA BLAIR TEAM tiene invitaciones de prueba) para ver que sí marca cuando hay que marcar.

---

## 8. Riesgos

- **Falso positivo bloqueante.** Un 🔴 mal calculado frena a una escuela que está bien. Mitigación: los cinco bloqueantes se validan contra Dynasty y MMA antes de habilitar el gate, y existe `READINESS_GATE_ENABLED`.
- **El reporte se vuelve lento.** Hoy no, con 419 atletas. Se mide con `EXPLAIN ANALYZE` y se deja anotado el tiempo en el PR.
- **La confirmación se convierte en trámite.** Si siempre hay 🟠, la gente marca la casilla sin leer. Por eso C1 debe desaparecer cuando la escuela asigna sus planes — como acaba de pasar en Dynasty, que pasó de 343 a 1.
- **`normalize_name` cambia de definición después.** Si en F2 se toca, los índices que la usen quedan inválidos. Queda escrito: **una vez que un índice la use, no se modifica**; se crea `normalize_name_v2`.
```
