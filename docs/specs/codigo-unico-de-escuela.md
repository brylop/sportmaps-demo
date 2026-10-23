# Código único de escuela, regenerable, para todos los roles

**Estado:** spec F0 · **Fecha:** 2026-10-23 · **ROADMAP:** #29 (v2.38) · **Rama de trabajo:** `develop`

> Decisiones ya tomadas por el usuario (no se reabren): un código corto **único por escuela y único entre escuelas**; el **administrador lo regenera** y el anterior deja de servir; sirve para **todos los roles**, pero **todos entran «por clasificar»** (sin equipo, categoría ni cobro) y el administrador aprueba el rol y asigna categoría y valor; **ningún rol de staff recibe permisos solo por el código**; el código se pide **después de iniciar sesión** (cubre a quien entra con Google) y desde **«Mi cuenta»**; hay que **vincular con la ficha existente** para no duplicar.

---

## 1. Problema

Una persona se registra por su cuenta, sin invitación ni QR, y queda **sin escuela**: puede entrar a la app pero no ve nada de nadie y la escuela no sabe que existe.

Medido el 2026-10-23 contra la base viva (padres y atletas creados en los últimos 60 días):

| Dato | Valor |
|---|---|
| Registrados (padre/atleta) | 184 |
| Sin membresía, sin hijo y sin inscripción | **39 (21 %)** |
| Con pista de escuela (invitación, ficha por correo o teléfono, WhatsApp, prospecto) | 12: Dynasty 8, Dreamers 3, Besser 1 |
| **Sin ninguna pista** | **27** |
| Entraron con Google | 13 de los 39 |
| Dejaron teléfono | 23 de los 39 |
| Usaron algún código al registrarse | **0** |

Por qué pasa hoy:
1. `RegisterPage.tsx` lee `?code=` y lo manda como `invitation_code` en los metadatos del usuario, pero **nada lo convierte en una escuela**. No hay campo visible.
2. El registro con Google salta cualquier campo adicional del formulario.
3. Lo único que asocia sin intervención humana es el **correo** (`claim_orphan_children`, `get_my_invitations`). Si el correo no coincide con el que cargó la escuela, no pasa nada.
4. El QR de inscripción (`school_join_qr_codes`, `/join/:slug`, `submit_qr_signup`) crea hijo, inscripción `pending` y cobro, pero **no crea `school_members`** (deuda de raíz ya anotada en `project_qr_inscripcion_flow`).

## 2. Alcance

**Entra:**
- Código de escuela, su regeneración y su historial.
- Pantalla para ingresarlo (tras iniciar sesión y en «Mi cuenta»).
- Solicitud «por clasificar» y bandeja del administrador para resolverla.
- Vincular la solicitud a una ficha existente.
- Límites de intentos, auditoría y pruebas.

**No entra** (queda en otros frentes):
- Cobros y facturación: el código **nunca** crea un cobro. Al aprobar, el administrador usa los flujos de inscripción que ya existen.
- Documentos y firmas (ROADMAP #30).
- Un tier de permisos reducido de staff.
- Reemplazar el QR o las invitaciones por correo: conviven (ver §9).

## 3. Formato del código

- **Longitud:** 8 caracteres, mostrados en dos grupos de 4 (`K7Q2-M9XA`). Se guarda sin guion y en mayúsculas. Entrada tolerante: se quitan guiones, espacios y se pasa a mayúsculas.
- **Alfabeto sin ambiguos:** `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (31 símbolos; fuera `0 O 1 I L`). Espacio de 31⁸ ≈ 8,5 × 10¹¹.
- **Generación:** aleatorio criptográfico en la base (`gen_random_bytes`), reintentando si choca con cualquier código **histórico** (ver unicidad).
- **Unicidad:** `UNIQUE(code)` sobre **todo** el historial, no solo los activos: un código viejo no se reasigna a otra escuela. Un solo código **activo** por escuela (índice único parcial).
- **Rotación:** el administrador lo regenera cuando quiera (botón con confirmación). Al regenerar, el anterior pasa a `revoked` y **deja de servir de inmediato**. Las solicitudes ya hechas con el código anterior **se conservan**.
- **Sin vencimiento automático** en la primera versión (ver A CONFIRMAR 3).

## 4. Modelo de datos

Todo con `text + CHECK` (no `CREATE TYPE`), FK a `public.profiles(id)` y RLS desde el primer día. Migración nueva con `npm run migrations:new`, nunca editar una existente.

### 4.1 `school_join_codes`
| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `school_id` | uuid FK `schools` | |
| `code` | text NOT NULL | normalizado, `UNIQUE` global, `CHECK (code ~ '^[2-9A-HJKMNP-Z]{8}$')` |
| `status` | text | `active` \| `revoked` |
| `created_by` | uuid FK `profiles` | quién lo generó o regeneró |
| `created_at` | timestamptz | |
| `revoked_by` / `revoked_at` | uuid / timestamptz | quién y cuándo lo reemplazó |
| `revoke_reason` | text | `regenerated` \| `leaked` \| `manual` |

Índice único parcial: `(school_id) WHERE status='active'`. Esa tabla es el **historial de regeneraciones** (quién y cuándo).
RLS: lectura solo para `user_admin_school_ids()` y plataforma; **sin policies de escritura** (solo RPC).

### 4.2 `school_join_requests` (la solicitud «por clasificar»)
| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `school_id` | uuid FK | |
| `profile_id` | uuid FK `profiles` | quién pide entrar |
| `code_id` | uuid FK `school_join_codes` | con qué código entró |
| `requested_role` | text | `parent` \| `athlete` \| `coach` \| `staff` \| `other` (lo que **dice** ser; no otorga nada) |
| `declared_athletes` | jsonb | lista corta `{nombre, fecha_nacimiento?, parentesco?}`; máximo 10 |
| `contact_note` | text | máximo 300 caracteres |
| `status` | text | `pending_classification` \| `approved` \| `linked` \| `rejected` \| `withdrawn` |
| `resolved_role` | text | rol que el administrador aprobó |
| `linked_child_id` / `linked_unregistered_athlete_id` / `linked_user_id` | uuid | ficha vinculada (exactamente una o ninguna) |
| `decided_by` / `decided_at` / `decision_note` | | |
| `created_at` / `updated_at` | timestamptz | |

Restricciones: `UNIQUE (profile_id, school_id) WHERE status='pending_classification'` (una solicitud abierta por persona y escuela); `CHECK` de vinculación exclusiva (a lo sumo una de las tres).

**Decisión de diseño:** la solicitud vive **aparte de `school_members`**. No se crea membresía hasta que el administrador aprueba. Así, un rol de staff pedido por código nunca pasa por una tabla que las policies leen como permiso. (`school_members.status` ya admite `pending`, pero **no se usa** en la primera versión; ver A CONFIRMAR 5.) Al aprobar, se inserta `school_members` con el rol aprobado y `status='active'`; `UNIQUE (profile_id, school_id)` ya impide dos filas.

### 4.3 `school_join_attempts` (límites y auditoría)
`id`, `profile_id`, `ip_hash` (hash con sal, nunca la IP en claro), `success` bool, `code_tail` (últimos 2 caracteres del código probado, para diagnóstico sin guardarlo entero), `created_at`.

Retención: 90 días. RLS: solo plataforma.

### 4.4 Qué NO cambia
`children.parent_id`, `unregistered_athletes`, `enrollments` y `payments` no se tocan en la solicitud. El código **no** crea hijos, inscripciones ni cobros.

## 5. RPCs y su gate

Todas `SECURITY DEFINER`, con `SET search_path = pg_catalog, public, pg_temp`, `REVOKE ... FROM PUBLIC, anon` y `GRANT EXECUTE ... TO authenticated` explícito. Cada una valida identidad y escuela **adentro** (lección de `project_rpc_gate_interno_silencioso`: si el gate interno devuelve vacío, no devolver ceros mudos sino error `42501`).

| RPC | Quién | Qué hace |
|---|---|---|
| `redeem_school_join_code(p_code, p_requested_role, p_declared jsonb, p_note)` | cualquier autenticado | Normaliza el código, aplica los límites, busca el código `active`, crea la solicitud `pending_classification` y devuelve `{school_id, school_name, request_id}`. Mismo mensaje de error para «no existe», «revocado» y «bloqueado» (no filtra cuál). Si la persona ya es miembro activo: devuelve `already_member`. |
| `my_school_join_requests()` | el propio usuario | Sus solicitudes y su estado. |
| `withdraw_my_school_join_request(p_request)` | el dueño de la solicitud | Pasa a `withdrawn`. |
| `get_school_join_code(p_school)` | `user_admin_school_ids()` | Código activo y su historial. |
| `regenerate_school_join_code(p_school, p_reason)` | `user_admin_school_ids()` | Revoca el activo y crea uno nuevo en la misma transacción, con `SELECT ... FOR UPDATE` sobre la fila activa. |
| `list_school_join_requests(p_school, p_status)` | `user_admin_school_ids()` | Bandeja, con candidatos de ficha para vincular. |
| `resolve_school_join_request(p_request, p_decision, p jsonb)` | `user_admin_school_ids()` | `approve` / `link` / `reject`; ver §7. |

**Por qué `user_admin_school_ids()` y no `user_staff_school_ids()`:** resolver una solicitud puede **otorgar un rol**. Regla del repo: si un permiso otorga permisos, no se delega al staff. Un entrenador no aprueba solicitudes.

**Límites de intentos** (la RPC no ve la IP, así que el endpoint de entrada va por el **BFF**: `POST /api/v1/school-join/redeem`, que usa `clientIp()` y no `X-Forwarded-For[0]`; ver `project_render_cloudflare_req_ip`):
- **Por usuario:** 5 intentos fallidos por hora; al sexto, bloqueo de 1 hora.
- **Por IP:** 20 intentos fallidos por hora.
- **Global por escuela:** si un mismo código recibe más de 50 intentos fallidos en un día, aviso al administrador.
- El éxito no cuenta contra el límite. Todo intento queda en `school_join_attempts`.

## 6. Pantalla de ingreso del código

Una sola pantalla, dos puertas de entrada.

**Puerta 1 — tras iniciar sesión (cubre Google).** Si la persona está autenticada, es `parent` o `athlete`, **no tiene ninguna membresía, hijo ni inscripción** y no tiene una solicitud abierta, se le muestra «Ingresa el código de tu escuela» antes del tablero. Se puede **omitir** («Ahora no»), pero vuelve a aparecer como banner persistente hasta que ingrese el código o confirme que es una cuenta de otra clase (marketplace, organizador, etc.).

**Puerta 2 — «Mi cuenta» → «Mi escuela».** Para quien ya tiene una escuela y quiere sumar otra (multiescuela) o quien omitió la puerta 1.

Campos: código (campo grande, mayúsculas, acepta pegado con o sin guion), «¿Quién eres para la escuela?» (acudiente, deportista, entrenador, otro) y, si es acudiente, «¿A quiénes inscribes?» con nombre y fecha de nacimiento de cada deportista (opcional pero recomendado). Nunca se muestra nada de la escuela hasta que el código se valida; al validar se muestra el **nombre y el logo** de la escuela y se pide confirmar «¿Es esta tu escuela?» antes de enviar.

Registro por formulario: se mantiene el parámetro `?code=` (de enlaces compartidos) y ahora **sí se usa**: precarga el campo y, tras registrarse, cae directo en la confirmación.

Accesibilidad y celular primero: sin píxeles fijos, solo tokens (`docs/design-tokens.md`), una frase y un botón (regla V2).

## 7. Bandeja «Por clasificar» del administrador

Ubicación: Deportistas → pestaña «Por clasificar» (o tarjeta en «Hoy» cuando hay pendientes). Solo `owner`, `admin` y `school_admin`.

Por solicitud: nombre, correo, teléfono, cómo entró (proveedor), rol que dijo ser, a quiénes declaró, fecha, y **candidatos de ficha** (coincidencia por correo, teléfono, documento y nombre aproximado, sin adoptar nada automáticamente).

Acciones, todas dentro de una transacción (RPC `resolve_school_join_request`):
1. **Aprobar como acudiente/deportista:** crea `school_members` activo con el rol aprobado y, si se pide, la inscripción con equipo, categoría y valor usando el flujo existente (`create_enrollment_with_payments`). Sin valor, queda sin cobro y sin plan.
2. **Vincular a ficha existente:** si hay `children`, `unregistered_athletes` o perfil adulto, se vincula (`parent_id` o `migrate_unregistered_athlete_to_profile`, que ya mueve los documentos). **Nunca se crea una ficha duplicada** si se eligió vincular.
3. **Aprobar como staff** (entrenador u otro): solo si el administrador lo elige explícitamente; crea `school_staff` + `school_members` con ese rol. Es la única vía.
4. **Rechazar** con motivo (obligatorio) y aviso a la persona.

Reglas:
- Una solicitud resuelta no se reabre; se crea otra.
- Aprobar un rol de staff exige confirmación aparte y queda en la auditoría.
- El administrador puede **ordenar** y filtrar por antigüedad; sin SLA automático en la primera versión.

## 8. Qué ve la persona mientras espera

- Pantalla «Tu solicitud a *<escuela>* está en revisión», con la fecha y quién la revisa («la administración de la escuela»).
- **Ve:** el nombre y logo de la escuela, su solicitud, y puede **editar** lo que declaró o **retirarla**.
- **No ve:** equipos, deportistas, cobros ni calendario de la escuela (no hay membresía).
- Aviso al aprobarse o rechazarse (campana de la app; WhatsApp si el canal existe y la persona dejó teléfono; ver A CONFIRMAR 4).
- Si pasa más de 7 días sin respuesta, un recordatorio **al administrador**, no a la persona.

## 9. Relación con el QR y con las invitaciones por correo

Orden de precedencia, de mayor a menor confianza:

1. **Invitación por correo** (`invitations`): la escuela ya identificó a la persona. Si el correo coincide con una invitación pendiente de esa escuela, **gana la invitación**: se acepta por el flujo actual y el código se ignora para esa escuela.
2. **Reclamo por correo de fichas precargadas** (`claim_orphan_children`): sigue corriendo al entrar, antes de pedir el código.
3. **Código de escuela** (esta spec): asociación declarada por la persona, sujeta a aprobación.
4. **QR de inscripción:** sigue igual (crea hijo, inscripción y cobro). Si la misma persona ya tiene una solicitud abierta en esa escuela, **crear el hijo por QR la cierra como `linked`** y no genera un segundo registro.

El código **no** reemplaza al QR ni a las invitaciones: cubre a quien no tiene ninguno de los dos.

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Código filtrado** (lo reenvía alguien ajeno) | El código **solo** abre una solicitud sin acceso a datos; nadie ve nada hasta que el administrador aprueba. El administrador regenera con un clic y puede ver quién entró con cada código. |
| **Fuerza bruta** | 8 símbolos (≈ 8,5 × 10¹¹), límites por usuario y por IP, mensaje de error único, auditoría y alerta por escuela. |
| **Escalada de permisos** (alguien pide «entrenador» y entra) | `requested_role` es solo una declaración; los permisos nacen únicamente de `resolve_school_join_request`, gateado a administración, con confirmación aparte para staff. |
| **Suplantación** (se hace pasar por el acudiente de un menor) | El administrador compara con la ficha precargada; el vínculo a un menor existente exige confirmación explícita y queda auditado. Sin vínculo automático por nombre. |
| **Menores** | Quien declara un menor es el acudiente; no se crea cuenta ni acceso para el menor. Datos mínimos (nombre, fecha de nacimiento opcional). |
| **Duplicados de identidad** (ya hay antecedentes en Dynasty) | Candidatos de ficha en la bandeja, «vincular» como acción principal, y bloqueo de crear ficha nueva si hay coincidencia fuerte sin confirmación del administrador. |
| **Spam** (miles de solicitudes) | Una solicitud abierta por persona y escuela; límite de solicitudes nuevas por escuela y día; rechazo masivo. |
| **Enumeración de escuelas** | Mismo error para código inexistente, revocado o bloqueado; el nombre de la escuela solo aparece tras un código válido. |
| **Costo de IO de la base** | Sin consultas por fila; los límites se leen con un índice `(profile_id, created_at)`; sin barridos de catálogo; migración aplicada por una sola sesión. |

## 11. Seguridad y auditoría (obligatorio antes de cerrar)

- `npm run seguridad:invariantes` sin violaciones críticas **nuevas**: I1 (nada legible por `anon`), I2 (ninguna policy de escritura con `user_school_ids()`), I3 (ningún `FOR ALL` sin `WITH CHECK`), I4 (todo `SECURITY DEFINER` con `search_path` fijo).
- Revisión **línea por línea** de las policies de las tres tablas nuevas y de cada RPC, y listado de **todas** las policies de cada tabla antes de darla por cerrada (las policies permisivas se suman con `OR`).
- Verificar que `user_school_ids()` y los helpers que usan las policies de lectura **no cuentan** a quien no tiene `school_members` activo (la solicitud no debe darle lectura de nada). Ver A CONFIRMAR 5.
- Pruebas con sesiones simuladas (`set_config('request.jwt.claims', …)` + `set local role authenticated`) en transacción revertida, para: padre, atleta, entrenador, administrador, usuario sin escuela y `anon`.
- Concurrencia: dos `regenerate` simultáneos (queda un solo activo), dos `redeem` del mismo usuario (queda una solicitud), dos `resolve` de la misma solicitud (una gana).
- Registro de auditoría de: generar, regenerar, resolver, rechazar y aprobar staff.

## 12. Pruebas (matriz mínima)

| Caso | Esperado |
|---|---|
| Código válido, usuario sin escuela | Solicitud `pending_classification`, sin membresía |
| Código revocado tras regenerar | Mismo error que inexistente |
| 6.º intento fallido en una hora | Bloqueo y registro |
| Usuario ya miembro activo | `already_member`, sin segunda solicitud |
| Pedir `coach` con código | Solicitud sin permisos; sin acceso a nada del staff |
| Entrenador intenta `resolve_school_join_request` | `42501` |
| Administrador de otra escuela intenta resolver | `42501` |
| Aprobar y vincular a ficha de menor existente | Una sola ficha, `parent_id` asignado, documentos intactos |
| Entrada con Google sin escuela | Puerta 1 aparece y funciona |
| Invitación pendiente + código | Gana la invitación |
| QR de la misma escuela con solicitud abierta | Solicitud pasa a `linked`, sin duplicados |
| Responsive 360/768/1024/1440 × zoom 80–200 % | Sin desbordes (auditoría `scripts/qa-responsive/`) |
| E2E real de punta a punta en dev con una escuela de prueba | Registro → código → bandeja → aprobación → ve su escuela |

## 13. Métricas con línea base (2026-10-23)

| Métrica | Línea base | Meta |
|---|---|---|
| Registrados que quedan sin escuela a los 7 días | 39 de 184 en 60 días (**21 %**) | < 5 % |
| Registros con Google sin escuela | 13 de 39 | < 5 % de los de Google |
| Tiempo de la solicitud a la decisión (mediana) | — (no existe) | < 48 h |
| Solicitudes sin resolver a los 7 días | — | < 10 % |
| Fichas duplicadas creadas al aprobar | antecedente en Dynasty | **0** |
| Intentos fallidos por código válido | — | seguimiento; alerta > 50/día |

Se mide de nuevo a los 14 y 30 días del despliegue, con la misma consulta de hoy.

## 14. Fases (full-stack por fase, sin ramas por fases: todo de corrido)

**F0 — Spec y decisiones** (este documento) y cierre de los puntos A CONFIRMAR.

**F1 — Base.** Las tres tablas, las siete RPC, índices, RLS y el log de intentos. Pruebas con sesiones simuladas y de concurrencia. **Una sola sesión aplica la migración** (regla de Disk IO) y regenera `types.ts` una sola vez al final.

**F2 — BFF.** `POST /api/v1/school-join/redeem` con límites por IP y por usuario, y los endpoints de bandeja si se requiere BFF para correo o WhatsApp.

**F3 — Frontend.** Pantalla de ingreso (puertas 1 y 2), tarjeta de código del administrador con «Regenerar», bandeja «Por clasificar» y estados de espera.

**F4 — Cierre.** Auditoría de seguridad, matriz de §12 en dev con datos reales, QA responsive, manual de dos versiones (interno y academias), artículo del Centro de Ayuda y línea base medida de nuevo. **Ninguna fase se da por cerrada sin el número de antes y de después.**

## 15. Criterios de aceptación

1. Una persona sin escuela, con o sin Google, ingresa un código válido y queda en «por clasificar» **sin acceso a datos de la escuela**.
2. Regenerar el código **invalida el anterior en el acto** y conserva el historial con quién y cuándo.
3. Un código es **único entre todas las escuelas**, incluidos los revocados.
4. Ningún rol de staff se otorga por el código; solo `owner`, `admin` y `school_admin` resuelven solicitudes.
5. Aprobar y vincular **no crea fichas duplicadas** y conserva los documentos.
6. Los límites de intentos funcionan por usuario y por IP, con mensaje de error único.
7. Los invariantes de seguridad quedan sin violaciones críticas nuevas y las pruebas de concurrencia pasan.
8. Las 12 personas con pista de hoy aparecen para su administrador (por la vía que se decida en A CONFIRMAR 6) y las 27 sin pista pueden resolverse con el código.
9. La línea base de §13 está medida antes y después.

## A CONFIRMAR

1. **Prefijo legible:** ¿el código lleva 3 letras de la escuela (`MON-K7Q29M`) para que la gente lo reconozca, o es 100 % aleatorio? El prefijo ayuda a que no lo confundan, pero revela el nombre de la escuela.
2. **Quién ve el código:** ¿solo `owner`/`admin`/`school_admin`, o también el entrenador para compartirlo? Recomendado: solo administración.
3. **Vencimiento:** ¿el código es permanente hasta que se regenere, o caduca (por ejemplo cada 90 días) con recordatorio?
4. **Aviso al administrador y a la persona:** ¿campana y correo, o también WhatsApp? Hoy ninguna escuela tiene un canal de WhatsApp conectado salvo Dynasty.
5. **Membresía `pending`:** `school_members.status` ya acepta `pending`. ¿Preferimos crear la membresía `pending` desde el principio (más simple en pantalla) o mantener la solicitud aparte hasta aprobar (más seguro, es lo que propone esta spec)? Antes de decidir hay que **verificar que `user_school_ids()` y las policies de lectura filtran por `status='active'`**.
6. **Las 12 personas con pista de hoy:** ¿se avisa a cada administrador (Dynasty 8, Dreamers 3, Besser 1) para que las confirme, o esperamos a que ingresen el código? Esta spec **no** asocia a nadie por coincidencia de correo o teléfono.
7. **Rol «otro»:** ¿se admite como solicitud (por ejemplo, voluntario, fotógrafo), o solo padre, atleta y entrenador?
8. **Cuentas que no son de escuela** (marketplace, organizador): ¿cómo se marca que «no tengo escuela» para que la pantalla de la puerta 1 no insista?
9. **Multiescuela:** ¿una misma persona puede tener solicitudes abiertas en varias escuelas a la vez? Esta spec lo permite, una por escuela.
10. **Retención** de `school_join_attempts`: 90 días propuestos; ¿está bien frente a la política de datos personales?

---

Relacionado: [[project_qr_inscripcion_flow]], [[project_multirol_multisede_f1_2026_10_15]], [[project_duplicate_athlete_identities]], [[project_invitacion_acudiente_ficha_precargada]], `docs/specs/` (resto de specs), ROADMAP v2.38 #29.
