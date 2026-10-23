# Documentos y firmas (ROADMAP #30) — diseño de datos y auditoría técnica

**Estado:** borrador para revisión · **Fecha:** 2026-10-23 · **Alcance:** solo datos, seguridad y pruebas. No hay migraciones escritas ni nada aplicado (regla del repo: plan antes de código).
**Fuentes medidas en la base viva el 2026-10-23** (consultas puntuales, sin barridos de catálogo, para respetar la regla de Disk IO).

> Corrección a un supuesto del encargo: `is_school_admin()` **sí** incluye `school_admin` en la base viva (`owner`, `admin`, `school_admin`, estado `active`). La nota vieja de `project_coach_permissions_audit` ya no aplica a esta función. Lo que sí es cierto: **no incluye a `coach` ni a `staff`**, y `is_super_admin()` va aparte.

---

## 1. Estado vivo (hechos medidos)

| Pieza | Estado |
|---|---|
| `athlete_documents` | 1.009 filas, **1 sola escuela** (Monster), **0 verificadas**. RLS activa, no forzada. `anon` sin privilegios; `authenticated` con SELECT/INSERT/DELETE a nivel de tabla (lo frena la policy). |
| Columnas | `id, school_id, child_id, user_id, unregistered_athlete_id, document_type, storage_path, uploaded_by, uploaded_at, verified, verified_by, verified_at, notes`. Sin estado, sin motivo de rechazo, sin vencimiento, sin mime/tamaño/hash. |
| CHECK de tipo | Cerrado a 10 llaves: `athlete_photo, eps_certificate, guardian_id_front/back, athlete_id_front/back, guardian_signature, athlete_signature, good_standing_certificate, other`. |
| CHECK de sujeto | XOR exacto entre `child_id`, `user_id`, `unregistered_athlete_id`. |
| Policy | Una sola: `school_staff_manage_athlete_documents`, `FOR ALL`, rol `{public}`, `USING = WITH CHECK = is_school_admin(school_id) OR is_super_admin()`. Escritura directa del administrador, sin rastro. |
| Índices | `school_id`, parciales por sujeto y `UNIQUE(storage_path)`. **No hay único por (sujeto, tipo)**: se puede subir el mismo tipo muchas veces. |
| FKs | `child_id`, `user_id`, `unregistered_athlete_id` y `school_id` con **`ON DELETE CASCADE`**. `uploaded_by` y `verified_by` → `profiles` sin acción. |
| Triggers | Ninguno. No hay historial. |
| Bucket `identity-documents` | Privado, **`file_size_limit = NULL` y `allowed_mime_types = NULL`**. Archivos medidos en `unregistered_athletes/`: máximo 5 MB, 9 tipos MIME incluyendo `text/plain` y `application/octet-stream`. |
| Objetos en el bucket | 1.080: `unregistered_athletes/` 1.010 (**1 sin fila** en `athlete_documents`) y `children/` 70 (**70 sin fila**, son los que suben las familias con el diálogo de 2 tipos). |
| Vinculación | `migrate_unregistered_athlete_to_profile` **sí** mueve `athlete_documents` (cambia `unregistered_athlete_id` por `child_id` o `user_id`). `accept_invitation_pro` y `claim_orphan_children` **no** tocan documentos, y no lo necesitan: los documentos cuelgan del `unregistered_athlete_id`, no del menor. |
| Plantilla de referencia | `payment_public_tokens` guarda el token **en claro** (`token text`); `payment_consents` guarda `ip_address inet` y `user_agent`. Sirven de patrón de evidencia, no de patrón de token. |

---

## 2. Auditoría de lo existente

Severidad: 🔴 alta · 🟠 media · 🟡 baja.

### A1 🔴 Las policies de escritura del bucket solo atan el segmento 2 al `auth.uid()`
`identity_docs_authenticated_insert/update/delete` y `identity_docs_owner_read` validan únicamente `(storage.foldername(name))[2] = auth.uid()`. Cualquier usuario autenticado puede escribir, **reemplazar y borrar** archivos en `<cualquier-carpeta>/<su-uid>/...`, de cualquier tipo y tamaño, porque el bucket no tiene límites. Consecuencias: (a) un archivo ya revisado por la escuela puede ser borrado por la familia que lo subió (no hay inmutabilidad); (b) se puede llenar el almacenamiento (Disk IO y costo) con archivos grandes; (c) se pueden guardar ejecutables o texto en un bucket que se presume de identidad.

### A2 🔴 Lo que sube la familia no existe para la base
Las 70 cargas de familias (`children/<uid>/<child>/docs/identity-… | eps-…`) no tienen fila: no hay estado, ni revisión, ni lista de pendientes, y el tipo se infiere por el **prefijo del nombre del archivo**. La escuela no puede verificar lo que no está en una tabla. Además la ruta mezcla el `uid` del acudiente: si el acudiente cambia (padres separados, ver #28), el anterior sigue leyendo por `identity_docs_owner_read` aunque ya no sea responsable del menor.

### A3 🔴 La familia no puede ver los documentos que la escuela cargó por ella
Tras vincular, la fila pasa a `child_id`/`user_id`, pero el archivo sigue en `unregistered_athletes/<id-de-la-ficha>/…`. No existe ninguna policy de lectura de storage para la familia en esa ruta, y `athlete_documents` solo se lee por administrador. Hoy una «Mis documentos» de la familia saldría vacía para los 1.009 documentos de Monster.

### A4 🟠 Verificación sin auditoría y sin estados
`verified boolean` más `verified_by/at` los puede reescribir el administrador con la policy `ALL`, junto con `storage_path`, `document_type` y el sujeto. No hay «rechazado», «vencido» ni motivo. No queda quién verificó **qué versión** del archivo. Un `UPDATE` directo cambia el archivo apuntado y deja `verified = true`.

### A5 🟠 Borrado en cascada sin retención y sin limpieza de archivos
Borrar un menor, un usuario, una ficha o una escuela borra las filas, pero **no los objetos** de storage (queda archivo huérfano con datos personales: ya hay 1). Tampoco hay `deleted_at`, ni retención, ni quién borró. El `DELETE` de storage para administradores (`identity_docs_unregistered_admin_delete`) es duro e irreversible.

### A6 🟠 Funciones auxiliares ejecutables por `anon` y con `search_path` incompleto
Medido: `is_school_admin` (`SECURITY DEFINER`, **VOLATILE**, `search_path=public`), `user_school_ids` (`search_path=public`), `is_parent_of_child`, `user_staff_school_ids`, `is_super_admin` tienen `EXECUTE` para `anon`. `is_school_admin` y `user_school_ids` no fijan `pg_catalog, pg_temp`. Al ser VOLATILE y llamarse sin `(SELECT …)`, la policy se evalúa **por fila** (ver `project_rls_helpers_not_wrapped`). Tener `anon` con EXECUTE es ruido de linter y, en `is_school_admin`, una huella innecesaria.

### A7 🟠 Tipos fijos en un CHECK
Cambiar o agregar un tipo exige una migración. No hay catálogo por escuela, ni obligatoriedad, ni a quién aplica (deportista o acudiente), ni vencimiento (el EPS vence). Es el bloqueo funcional del #30.

### A8 🟡 Nombres de archivo con datos personales
Las rutas existentes miden 113–168 caracteres y arrastran el nombre original de Drive (nombre de la persona). El diálogo de familia usa `identity-<timestamp>-<file.name>`: nombre elegido por el usuario. Los identificadores en la ruta son UUID (no adivinables), pero los **nombres** terminan en logs, URLs firmadas y correos.

### A9 🟡 Policies de lectura con conversión a `uuid` sobre texto de la ruta
`identity_docs_children_staff_read` y `identity_docs_unregistered_staff_read` hacen `::uuid` sobre segmentos de la ruta dentro de un `EXISTS`. PostgreSQL no garantiza el orden de evaluación de los `AND`: un objeto con un segmento que no es UUID puede lanzar `22P02` en una consulta de listado del administrador en vez de devolver 0 filas. Hoy no ha pasado porque las rutas son del sistema; con rutas nuevas elegidas por el usuario sí puede pasar.

### A10 🟡 Datos sensibles sin consentimiento versionado
Documento de identidad y certificado de salud de menores son datos sensibles (Ley 1581). Hoy no se guarda qué texto de tratamiento aceptó la familia ni cuándo (decisión 4 del #30).

**Lo que sí está bien (para no regresar):** el bucket es privado; el lector administrador exige fila en `athlete_documents` (`School can view athlete documents via DB`); `anon` no tiene SELECT/INSERT; la policy de la tabla tiene `WITH CHECK` (no es I3); el coach **no** lee documentos (correcto: el coach no necesita la cédula de nadie).

---

## 3. Diseño propuesto

### 3.1 Principios
1. **La tabla es la fuente de verdad; el almacenamiento es contenido.** Todo archivo tiene fila, estado y dueño de negocio.
2. **Nada se escribe directo.** Escritura solo por RPC `SECURITY DEFINER` transaccional (regla: creación multi-fila = RPC).
3. **Auditoría append-only** por trigger, no por buena voluntad del cliente.
4. **Bucket nuevo `school-documents`** con límites desde el día uno. El bucket `identity-documents` queda de **solo lectura legada** para los 1.080 objetos existentes (no se mueve nada).
5. **El único helper de «a quién cuido» es una función** (`user_guardian_child_ids()`), para que #28 (acudientes múltiples) cambie un solo lugar.
6. **Estados y tipos con `text + CHECK`**, nunca `CREATE TYPE`. FKs de negocio a `public.profiles(id)`.

### 3.2 Tablas

#### `school_document_requirements` (catálogo por escuela)
```
id uuid PK default gen_random_uuid()
school_id uuid NOT NULL → schools(id) ON DELETE CASCADE
doc_key text NOT NULL CHECK (doc_key ~ '^[a-z][a-z0-9_]{1,39}$')
label text NOT NULL
applies_to text NOT NULL CHECK (applies_to IN ('athlete','guardian'))
subject_scope text NOT NULL DEFAULT 'any' CHECK (subject_scope IN ('minor','adult','any'))
required boolean NOT NULL DEFAULT true
requires_signature boolean NOT NULL DEFAULT false
accepted_mime text[] NOT NULL DEFAULT '{application/pdf,image/jpeg,image/png,image/webp,image/heic}'
max_mb int NOT NULL DEFAULT 10 CHECK (max_mb BETWEEN 1 AND 25)
valid_months int NULL CHECK (valid_months BETWEEN 1 AND 60)   -- EPS: 12
sort_order int NOT NULL DEFAULT 100
active boolean NOT NULL DEFAULT true
created_by uuid → profiles(id), created_at, updated_at
UNIQUE (school_id, doc_key)
```
- **Defaults:** función `seed_school_document_requirements(p_school)` idempotente (mismo patrón que `seed_school_match_criteria`) que siembra las 10 llaves actuales. Monster queda con las 7 obligatorias de su formulario y `other` opcional. Las llaves siembran con el mismo texto de `DOCUMENT_TYPE_LABELS`.
- **No hay llaves globales en tabla aparte.** Evita un join y permite que cada escuela renombre.

#### `athlete_documents` (ampliación aditiva, sin tocar filas)
Columnas nuevas, todas nullable o con `DEFAULT` para que el `ALTER` sea instantáneo y no reescriba la tabla:
```
requirement_id uuid NULL → school_document_requirements(id)
status text NOT NULL DEFAULT 'uploaded'
   CHECK (status IN ('uploaded','verified','rejected','expired','replaced','deleted'))
rejected_reason text NULL
expires_at date NULL
replaced_by uuid NULL → athlete_documents(id)
mime text NULL, size_bytes bigint NULL, sha256 text NULL
source text NOT NULL DEFAULT 'admin' CHECK (source IN ('admin','family','import','whatsapp','signature'))
deleted_at timestamptz NULL, deleted_by uuid NULL → profiles(id)
retention_until date NULL
```
- **El CHECK de `document_type` se reemplaza** por formato (`^[a-z][a-z0-9_]{1,39}$`) y la validez la da el catálogo: la RPC exige que exista un requisito activo de esa escuela con esa llave. Migración en dos pasos para no bloquear: añadir el CHECK de formato `NOT VALID`, `VALIDATE`, y luego `DROP` del viejo.
- **«Pendiente» no es una fila.** Es un requisito sin documento vigente; se calcula (3.4). Así no se siembran filas vacías por deportista.
- **Único vigente por sujeto y tipo** (tres índices parciales, uno por sujeto):
  `UNIQUE (child_id, document_type) WHERE child_id IS NOT NULL AND status IN ('uploaded','verified') AND document_type <> 'other'` y gemelos para `user_id` y `unregistered_athlete_id`. Un reemplazo marca el anterior `replaced` en la misma transacción.
- El XOR de sujeto se mantiene.

#### `athlete_document_events` (auditoría, append-only)
```
id bigint identity PK
document_id uuid NOT NULL           -- sin FK: sobrevive al borrado
school_id uuid NOT NULL
event text NOT NULL CHECK (event IN ('uploaded','replaced','verified','rejected','expired','soft_deleted','restored','viewed'))
actor_id uuid NULL → profiles(id)
at timestamptz NOT NULL DEFAULT now()
detail jsonb NOT NULL DEFAULT '{}'   -- estado anterior/nuevo, motivo, sha256 del archivo verificado
```
- Lo escribe un **trigger `AFTER INSERT OR UPDATE OR DELETE` en `athlete_documents`** (`SECURITY DEFINER`, `search_path` fijo), de modo que hasta un `UPDATE` hecho por el administrador deja huella.
- `REVOKE INSERT, UPDATE, DELETE` a todos los roles de la API; solo el trigger escribe. Trigger `BEFORE UPDATE OR DELETE` que lanza error como defensa en profundidad.
- `viewed` se registra solo cuando la **escuela** abre un documento sensible (no cuando la familia ve el suyo), en lotes desde el BFF, no una escritura por vista desde el navegador.

#### Bloqueo de columnas de contenido
`BEFORE UPDATE` en `athlete_documents`: si cambian `storage_path`, `document_type`, `school_id` o el sujeto con `status IN ('verified')`, error. Un cambio de contenido es un **documento nuevo** que reemplaza al anterior.

#### `document_templates` (versiones inmutables)
```
id uuid PK, school_id uuid NOT NULL, doc_key text NOT NULL,
version int NOT NULL, title text NOT NULL,
body_text text NOT NULL           -- texto exacto que se acepta y se hashea
storage_path text NULL            -- PDF base opcional en school-documents
body_sha256 text NOT NULL,
requires_signer text NOT NULL CHECK (requires_signer IN ('guardian','athlete','both')),
active boolean NOT NULL DEFAULT true, created_by, created_at
UNIQUE (school_id, doc_key, version)
```
- Editar una plantilla **crea una versión nueva**. Las solicitudes firmadas apuntan a la versión y guardan su hash: lo firmado no cambia nunca.

#### `signature_requests`
```
id uuid PK, school_id uuid NOT NULL, template_id uuid NOT NULL → document_templates(id),
template_sha256 text NOT NULL,
child_id / user_id / unregistered_athlete_id (XOR, mismo CHECK que athlete_documents),
signer_role text NOT NULL CHECK (signer_role IN ('guardian','athlete')),
signer_profile_id uuid NULL → profiles(id),
signer_label text NOT NULL,                -- nombre de pila o iniciales para mostrar
contact_channel text CHECK (contact_channel IN ('whatsapp','email','in_app')),
token_hash text NOT NULL UNIQUE,           -- SHA-256 del token; el token NO se guarda
status text NOT NULL DEFAULT 'pending'
   CHECK (status IN ('pending','viewed','signed','declined','expired','revoked')),
expires_at timestamptz NOT NULL,
otp_required boolean NOT NULL DEFAULT false,
otp_hash text NULL, otp_attempts int NOT NULL DEFAULT 0, otp_expires_at timestamptz NULL,
signed_at timestamptz NULL, signed_document_id uuid NULL → athlete_documents(id),
evidence jsonb NULL,                        -- ver 3.3
created_by uuid → profiles(id), created_at
```
- **El token nunca se persiste en claro** (a diferencia de `payment_public_tokens.token`, que queda como deuda de seguridad aparte). Se entrega **una sola vez** al crear. Token de 32 bytes aleatorios (256 bits), formato base64url.
- Consulta por `token_hash` con índice único: tiempo constante frente al token; no hace falta comparación segura adicional.

#### `signature_events` (append-only)
```
id bigint identity PK, request_id uuid NOT NULL, school_id uuid NOT NULL,
event text NOT NULL CHECK (event IN ('created','sent','opened','otp_sent','otp_ok','otp_fail','signed','declined','expired','revoked')),
at timestamptz NOT NULL DEFAULT now(),
ip inet NULL, user_agent text NULL, detail jsonb NOT NULL DEFAULT '{}'
```
Mismas reglas que `athlete_document_events`. El `ip` lo pone el **BFF** (ver nota de Cloudflare abajo), no el cliente.

> Nota de IP: detrás de Cloudflare, `req.ip` ya costó 20 h de caída (`project_render_cloudflare_req_ip`). Para la evidencia, el BFF debe tomar `CF-Connecting-IP`, guardar también `X-Forwarded-For` en `detail`, y nunca confiar en una IP enviada por el navegador.

### 3.3 Dos formas de firmar, mismo modelo de evidencia
- **Firma aparte** (el requisito tiene `requires_signature`, p. ej. `guardian_signature`): la persona dibuja en pantalla; el BFF recibe el PNG, lo sube al bucket nuevo, crea la fila en `athlete_documents` (`source='signature'`) y guarda la evidencia en el evento.
- **Firmar el documento** (plantilla): enlace de un solo uso; la persona lee `body_text`, acepta y firma. El BFF sella un PDF (`pdf-lib`/`pdfkit`, ya disponibles) con la firma y los datos de evidencia, lo guarda como documento de la ficha y marca la solicitud `signed`.

`evidence` (jsonb) guarda: `accepted_text_sha256`, `template_sha256`, `template_version`, `signature_image_sha256`, `signed_at`, `ip`, `user_agent`, `signer_role`, `signer_profile_id` (si hay sesión), `otp_verified` (booleano), `consent_version` (decisión 4).

### 3.4 Estados y lectura set-based
```
(sin fila)  →  uploaded  →  verified  →  expired
                  │  ↘ rejected → (nueva carga) → uploaded
                  └─ replaced   (por una carga nueva del mismo tipo)
cualquier estado → deleted (borrado lógico, con motivo)
```
- **Lista de pendientes de un deportista:** una RPC `list_subject_document_checklist(p_subject_kind, p_subject_id)` que une requisitos activos de la escuela del sujeto con el documento vigente (`status IN ('uploaded','verified','rejected','expired')`). Una consulta, sin N+1.
- **Hueco por escuela:** `list_school_document_gaps(p_school, p_limit, p_after)` con paginación por llave (keyset), agregada en SQL (`count(*) FILTER`). Nunca se pide «todos los deportistas y luego sus documentos» desde el cliente.
- **Vista para coaches** `v_document_checklist_staff`: solo `doc_key`, `status` y booleano «vigente», **sin ruta ni nombre de archivo**, con `security_invoker`. RLS filtra filas, no columnas (trampa 4 del CLAUDE.md), por eso es una vista.

### 3.5 RPC (todas `SECURITY DEFINER`, `SET search_path = pg_catalog, public, pg_temp`, `REVOKE ALL … FROM PUBLIC, anon`, `GRANT EXECUTE` explícito a `authenticated` salvo las marcadas `service_role`)

| RPC | Quién | Qué hace, en una transacción |
|---|---|---|
| `seed_school_document_requirements(p_school)` | administración (`user_admin_school_ids`) | Siembra las 10 llaves si faltan. Idempotente. |
| `upsert_document_requirement(p_school, p jsonb)` | administración | Crea/edita un requisito. Valida mime y `max_mb`. No permite borrar uno con documentos vigentes: lo desactiva. |
| `get_document_upload_target(p_subject_kind, p_subject_id, p_requirement)` | staff de la escuela o familia del sujeto | Valida pertenencia, reserva un `doc_id` y devuelve la **ruta generada por el servidor**. El cliente no inventa la ruta. |
| `register_athlete_document(p_doc_id, p_sha256, p_mime, p_size)` | quien reservó | Toma `pg_advisory_xact_lock(hashtextextended(sujeto||doc_key,0))`, verifica que el objeto exista con ese tamaño, marca el anterior `replaced`, inserta el nuevo `uploaded`, escribe evento. |
| `review_athlete_document(p_doc, p_decision, p_reason)` | administración | `UPDATE … WHERE status='uploaded' RETURNING`: un solo ganador. `verified` guarda `sha256` en el evento; `rejected` exige motivo. |
| `soft_delete_athlete_document(p_doc, p_reason)` | administración; la familia solo si es suyo y está `uploaded` o `rejected` | Pone `deleted_at`; la limpieza de archivo la hace un job por lote. |
| `create_signature_request(p jsonb)` | staff/administración | Crea la solicitud y devuelve el token **una vez**. |
| `revoke_signature_request(p_id)` | administración | `UPDATE … WHERE status IN ('pending','viewed')`. |
| `signature_open__interno(p_token_hash, …)` | `service_role` (BFF) | Devuelve texto y etiqueta del firmante; registra `opened`. |
| `signature_complete__interno(p_token_hash, p jsonb)` | `service_role` (BFF) | `UPDATE signature_requests SET status='signed' WHERE token_hash=… AND status IN ('pending','viewed') AND expires_at>now() RETURNING`: un solo ganador; crea el documento sellado y el evento. |

- **`anon` no ejecuta ninguna RPC del módulo.** El enlace público pasa por el BFF, que usa las variantes `__interno` con `service_role` (mismo patrón que `create_school_join_qr__interno`). Así el límite de tasa y la IP viven en un solo sitio.
- **Límite de intentos:** `otp_attempts` y un tope por token; el BFF suma un límite por IP. Tras 5 fallos la solicitud pasa a `revoked`.

### 3.6 Policies línea por línea

Helper nuevo: **`user_guardian_child_ids()`** — `SECURITY DEFINER`, `STABLE`, `search_path` fijo, devuelve los `children.id` cuyo `parent_id = auth.uid()`. Se usa envuelto `(SELECT …)` para que Postgres lo evalúe una vez por consulta. Cuando #28 agregue `child_guardians`, solo cambia el cuerpo.

**`athlete_documents`** (RLS ya activa; se agrega `FORCE ROW LEVEL SECURITY`)
```
SELECT  (SELECT is_platform_admin())
     OR school_id = ANY ((SELECT user_admin_school_ids())::uuid[])
     OR child_id  = ANY ((SELECT user_guardian_child_ids())::uuid[])
     OR user_id   = (SELECT auth.uid())
INSERT/UPDATE/DELETE: sin policy  +  REVOKE INSERT,UPDATE,DELETE FROM authenticated
```
- Se **elimina** `school_staff_manage_athlete_documents` en una migración posterior, cuando el front use las RPC (la transición evita romper la pantalla actual de administración).
- Los coaches y `staff` **no** leen la tabla; usan la vista booleana.
- No hay `USING (true)` ni «by_token» (trampa 5): los tokens viven en `signature_requests` y solo los resuelve una RPC.

**`school_document_requirements`**
```
SELECT: school_id = ANY(user_school_ids) OR plataforma     -- la familia ve qué se le pide
INSERT/UPDATE/DELETE: sin policy (solo RPC de administración)
```

**`athlete_document_events`, `signature_events`**
```
SELECT: plataforma OR school_id = ANY(user_admin_school_ids)
INSERT/UPDATE/DELETE: sin policy; solo trigger o RPC
```

**`document_templates`**
```
SELECT: plataforma OR school_id = ANY(user_school_ids) AND active   -- la familia lee el texto que va a firmar
INSERT/UPDATE: sin policy (RPC de administración que crea versión nueva)
```

**`signature_requests`**
```
SELECT: plataforma OR school_id = ANY(user_admin_school_ids)
        OR signer_profile_id = auth.uid()
INSERT/UPDATE/DELETE: sin policy
```
El campo `token_hash` no se expone a la familia por vista (`v_signature_requests_familia` sin esa columna).

### 3.7 Storage

**Bucket nuevo `school-documents`** (privado, `file_size_limit = 10485760`, `allowed_mime_types = {application/pdf,image/jpeg,image/png,image/webp,image/heic}`).

Ruta **generada por el servidor y sin datos personales:**
`<school_id>/docs/<child|user|unregistered>/<subject_id>/<doc_id>.<ext>`

Función `storage_doc_path_ok(name text)` — `SECURITY DEFINER`, `STABLE`, que valida la forma con una expresión regular **antes** de cualquier conversión a `uuid` (cierra A9) y devuelve el sujeto. Policies sobre `storage.objects` para ese bucket:
```
SELECT : bucket_id='school-documents' AND storage_doc_can_read(name)   -- admin de la escuela del primer segmento
                                                                       -- o familia del sujeto
INSERT : bucket_id='school-documents' AND storage_doc_can_write(name)  -- solo la ruta que get_document_upload_target reservó
UPDATE : ninguna      (los objetos son inmutables)
DELETE : ninguna para API; la limpieza la hace un job con service_role
```
El nombre original se conserva solo en una columna `original_filename` saneada (sin ruta), no en la ruta.

**Bucket legado `identity-documents` — endurecimiento F0 (no necesita decisiones):**
1. `file_size_limit = 10485760` y lista blanca de MIME. Los 1.010 objetos medidos caben (máximo 5 MB); hay 2 tipos fuera de la lista (`text/plain` y `octet-stream`, los `.bin` de DOCX): se migran con su tipo real o se dejan en una lista de excepciones, **sin tocar los archivos**.
2. Las policies `identity_docs_authenticated_insert/update/delete` y `identity_docs_owner_read` se restringen a `(storage.foldername(name))[1] = 'children'` y a profundidad exacta. Se quita `UPDATE` y `DELETE` a la familia.
3. Lectura de la familia sobre `unregistered_athletes/…` no se abre: las URL firmadas las emite el BFF con `service_role` **después** de validar la RPC. Esto cierra A3 sin crear más policies sobre un bucket que no queremos ampliar.

### 3.8 Índices y costo de Disk IO
- `athlete_documents (school_id, status) WHERE status = 'uploaded'` — cola de revisión.
- `athlete_documents (school_id, document_type)` — cobertura por tipo.
- Únicos parciales por sujeto y tipo (3.2).
- `school_document_requirements (school_id) WHERE active`.
- `signature_requests (school_id, status, expires_at) WHERE status IN ('pending','viewed')` — job de vencimiento. `UNIQUE(token_hash)`.
- `*_events (document_id, at)` y `(request_id, at)`.
- **Reglas de costo** (el plan Pro no las relaja, ver CLAUDE.md): ningún endpoint arma la lista de pendientes con una consulta por deportista; todas las listas son una consulta con `LIMIT` y llave; los jobs son idempotentes y por lote (`.in('id', ids)`); el vencimiento es **un** `UPDATE … WHERE status='verified' AND expires_at < current_date` en lotes de 500; los avisos usan el despachador de notificaciones existente; no se lee `storage.objects` como índice (el índice es `athlete_documents`); no se llama a `list_tables`, `get_advisors` ni se lista el catálogo de funciones.
- Las 1.009 filas de Monster son poco volumen: el riesgo de IO está en los **jobs**, no en la tabla.

### 3.9 Migración de los 1.009 documentos de Monster (sin tocarlos)
1. **Aditiva.** Las columnas nuevas son nullable o con `DEFAULT`; `ALTER TABLE` instantáneo. Cero movimiento de archivos.
2. **Sembrado.** `seed_school_document_requirements(Monster)` crea el catálogo; luego un solo `UPDATE` por lotes de 500 asigna `requirement_id` por coincidencia exacta de `document_type`, `source='import'`, `status='uploaded'`. Nada se marca `verified`.
3. **Rutas.** Se quedan en `identity-documents/unregistered_athletes/…`. La lectura de la escuela sigue por `School can view athlete documents via DB`; la de la familia, por URL firmada del BFF.
4. **70 archivos de `children/`.** Un script de **inventario de solo lectura** lista los archivos sin fila con el tipo inferido del prefijo (`identity-` → `athlete_id_front` o `guardian_id_front`, `eps-` → `eps_certificate`). Se muestran a la administración para confirmar antes de crear filas `source='family'`, `status='uploaded'`. No se autoverifica.
5. **1 objeto huérfano** en `unregistered_athletes/`: se reporta, no se borra (las eliminaciones las maneja el usuario).
6. **Reversa:** las columnas se pueden `DROP` sin tocar datos; el CHECK viejo se restaura con el mismo texto (queda en el comentario de la migración).
7. `types.ts` se regenera **una sola vez**, al terminar el lote de migraciones. Una sola sesión aplica.

### 3.10 Concurrencia y carreras
- **Dos cargas simultáneas del mismo tipo:** `pg_advisory_xact_lock` por (sujeto, llave) + índice único parcial. La segunda espera, ve el vigente y lo reemplaza; no quedan dos vigentes.
- **Dos administradores revisan a la vez:** `UPDATE … WHERE status='uploaded' RETURNING`; el segundo recibe 0 filas y un error claro, sin pisar el motivo del primero.
- **Doble firma / doble clic:** `UPDATE … SET status='signed' … WHERE status IN ('pending','viewed') RETURNING`; un solo ganador, el otro recibe «ya firmada» (mismo patrón que el cerrojo anti doble clic de cobros).
- **Vencimiento mientras alguien firma:** la comprobación de `expires_at > now()` va **dentro del mismo `UPDATE`**, no en una lectura previa.
- **Reemplazo y borrado a la vez:** el borrado exige `status` actual; un reemplazo concurrente lo deja en `replaced` y el borrado falla limpio.
- **Subida a storage sin fila:** si el cliente sube el archivo pero no llama `register_athlete_document`, el objeto queda sin fila. Un job por lote (diario) lista objetos del bucket nuevo con más de 24 h sin fila **y los reporta**; el borrado queda a decisión del usuario.

### 3.11 Invariantes nuevos para `invariantes_seguridad()`
Se suman a I1–I4 de la migración `20260814195349`:

| | Qué prohíbe | Crit. |
|---|---|---|
| **I8** | Tabla del módulo (`athlete_documents`, `athlete_document_events`, `document_templates`, `school_document_requirements`, `signature_requests`, `signature_events`) con cualquier GRANT a `anon` | CRÍTICA |
| **I9** | Bucket de documentos (`identity-documents`, `school-documents`) público, o **sin** `file_size_limit` o **sin** `allowed_mime_types` | ALTA |
| **I10** | Policy sobre `storage.objects` de esos buckets que condicione solo por `auth.uid()` sin atar un segmento de la ruta a escuela o sujeto | ALTA |
| **I11** | Tabla `*_events` con `UPDATE` o `DELETE` para `authenticated` o `anon` (append-only roto) | ALTA |
| **I12** | `signature_requests` con una columna que pueda guardar el token en claro (`token` en vez de `token_hash`) | CRÍTICA |
| **I13** | RPC del módulo `SECURITY DEFINER` con `EXECUTE` para `anon` | ALTA |
| **I14** | Documento `verified` sin `verified_by`, sin `verified_at` o sin evento `verified` | MEDIA |
| **I15** | `athlete_documents` con policy de escritura directa para `authenticated` después del corte a RPC | ALTA |

Cada uno se afirma contra la base viva con `npm run seguridad:invariantes` (sale con código 1 si hay CRÍTICAS) después de aplicar cada migración.

### 3.12 Pruebas negativas obligatorias (sesiones simuladas)
Patrón ya usado en el repo: `set_config('request.jwt.claims', …)` + `set local role authenticated` dentro de una transacción que termina en `RAISE EXCEPTION` para revertir. Cada caso debe **fallar** como se indica; usuarios reales de Besser/Dynasty/Monster, nunca producción de otra escuela.

| # | Caso | Esperado |
|---|---|---|
| N1 | Padre de **otra escuela** hace `SELECT` en `athlete_documents` | 0 filas |
| N2 | Padre intenta `register_athlete_document` sobre un hijo ajeno | `42501` |
| N3 | Padre intenta `review_athlete_document` sobre su propio documento | `42501` |
| N4 | Padre intenta `INSERT`, `UPDATE` y `DELETE` directos en `athlete_documents` | permiso denegado |
| N5 | `anon` hace `SELECT` y llama cualquier RPC del módulo | denegado |
| N6 | **Coach** lee `athlete_documents` | 0 filas; solo ve la vista booleana, sin `storage_path` |
| N7 | **Staff** (no administración) llama `review_athlete_document` | `42501` |
| N8 | Administrador de **otra** escuela llama `review`/`soft_delete`/`create_signature_request` | `42501` |
| N9 | Subir a `school-documents` con la ruta de **otra escuela** | rechazado por policy |
| N10 | Subir un `.exe`, un `text/plain` y un archivo de 11 MB | rechazado por el bucket |
| N11 | `UPDATE` directo de `storage_path` por administración sobre un documento `verified` | bloqueado por trigger |
| N12 | Reusar un token ya firmado; token vencido; token revocado; token de otra solicitud | segunda firma rechazada en todos |
| N13 | Firmar como acudiente una solicitud de `athlete` y al revés | rechazado |
| N14 | `UPDATE` y `DELETE` sobre `athlete_document_events` y `signature_events` por cualquier rol | denegado |
| N15 | `requirement_id` de otra escuela en `register_athlete_document` | `22023` |
| N16 | Dos cargas del mismo (sujeto, tipo) en paralelo | queda **un** vigente y el otro `replaced` |
| N17 | Dos `review` simultáneos | un ganador, el otro 0 filas con error claro |
| N18 | Borrar un menor | filas borradas por cascada; **se reporta** el archivo huérfano (A5); el job nunca borra solo |
| N19 | Ruta con un segmento que no es UUID en una consulta de listado de administración | 0 filas, sin `22P02` (cierra A9) |
| N20 | Padre antiguo tras cambiar el acudiente del hijo | ya no lee (depende de #28; hoy queda registrado como riesgo A2) |

Además: pruebas de **regresión positiva** (administración de Monster ve y descarga sus 1.009; el acudiente ve lo suyo por URL firmada; el flujo `UploadChildDocumentsDialog` actual sigue funcionando hasta el corte) y la corrida de `npm run seguridad:invariantes`.

### 3.13 Fases (cada una se cierra con su número «antes y después»)

| Fase | Contenido | Necesita decisión | Medida |
|---|---|---|---|
| **F0 · Endurecer lo vivo** | Límites y lista blanca del bucket `identity-documents`, policies de storage acotadas, inventario de los 70 y del huérfano, invariantes I9–I10 | No | Hoy: bucket sin límites, 3 policies de escritura sueltas. Después: 0 |
| **F1 · Datos** | `school_document_requirements`, columnas nuevas, `athlete_document_events`, bucket `school-documents`, RPC de carga, revisión y borrado, helper de acudientes, vista para coaches | Decisión 3 (quién configura) | Documentos con fila: 1.009 → 1.079 |
| **F2 · Pantallas** | La familia sube todo desde la app; checklist y bandeja «Por revisar» de la administración; corte de la policy `ALL` | No | % de deportistas con checklist completo por escuela |
| **F3 · Firmas** | `document_templates`, `signature_requests/events`, BFF público, sellado de PDF | **Decisiones 1, 2 y 4** | Firmas con evidencia / firmas sin evidencia |
| **F4 · Aviso y vencimiento** | Recordatorios por WhatsApp/correo con el despachador, vencimiento del EPS, informe de pendientes | No | Días promedio hasta tener el expediente completo |

F0 y F1 pueden empezar sin esperar las cuatro decisiones del #30.

### 3.14 Decisiones abiertas que cambian columnas
1. **Validez de la firma** (simple con evidencia, o con OTP): decide si `otp_*` se usa o se queda apagado. Las columnas ya están previstas, no cuesta nada dejarlas.
2. **Quién firma por un menor:** fija `signer_role` válidos y si una plantilla pide `both`.
3. **Quién configura los requisitos:** el diseño ya es configurable por la administración; si se decide «fijo», solo se oculta la pantalla.
4. **Consentimiento de datos sensibles:** exige una tabla `data_processing_consents(profile_id, school_id, version, text_sha256, accepted_at, ip, user_agent)` y que `register_athlete_document` falle sin consentimiento vigente. No está en este borrador de columnas; se agrega con la decisión.
5. **Retención:** `retention_until` está previsto; falta saber cuántos años guarda cada escuela y quién borra.

### 3.15 Riesgos y límites de esta auditoría
- **No se verificó** el contenido de los archivos (ni antivirus), ni los límites efectivos del plan de Supabase para URLs firmadas, ni cómo se comporta `storage.foldername` con rutas no UUID bajo carga. Todo esto se prueba en F0.
- **Código del front y del BFF no se auditó** en esta pasada (solo los dos componentes citados). El BFF de firma pública es nuevo y es la superficie de mayor riesgo del módulo: necesita su propia revisión de límites de tasa, CSRF y subida de imágenes.
- `payment_public_tokens.token` en claro es una deuda de seguridad **separada** que este diseño no arregla; conviene abrirla como ítem aparte.
- #28 (acudientes múltiples) y este módulo comparten `user_guardian_child_ids()`; se construyen en el mismo orden que el helper, o el segundo hereda el modelo de un acudiente por hijo.
- Una sola sesión aplica migraciones y se regenera `types.ts` una sola vez al final, como pide el CLAUDE.md.
