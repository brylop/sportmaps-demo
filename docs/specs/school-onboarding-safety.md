# Spec — Onboarding seguro de escuelas: revisión previa, anti-duplicados y fin del drift

**Producto:** SportMaps · **Versión:** v0.2 (precisión de contratos y bordes — listo para plan de migraciones de F1)
**Fecha:** 30 de julio de 2026
**Estado:** 🟢 decisiones resueltas (§6). Pendiente: plan de migraciones aprobado antes de escribir código (convención del repo).

> Se construye **por fases con revisión entre cada una** (una rama por fase). Plan aprobado antes de código en migraciones. RLS revisado línea por línea.

**Origen:** auditoría de DYNASTY VOLLEY CLUB del 29–30 de julio de 2026. Ver [[project_dynasty_onboarding_audit]] y [[project_email_sending_resend]].

**Cambios v0.1 → v0.2 (revisión crítica):**
- **El verificador no puede ser más laxo que el motor.** Si C3 normaliza con `normalize_name` pero `accept_invitation_pro` matchea con `LOWER(TRIM())`, el chequeo da verde en un caso que en runtime crea el hijo fantasma igual. F2 unifica **ambos** sobre la misma función (§3.1, D11).
- **C10 se rotula por fecha.** `email_sends` existe desde el 2026-07-30 y el log de Resend **no guarda el destinatario**, así que las ~100 invitaciones que sí salieron el 6-jul son irrecuperables. Backfill descartado: inventaría datos en la tabla que es la fuente de verdad (D12).
- **Contrato del gate definido.** El 409 devuelve el mismo `jsonb` del reporte que el servidor evaluó (§2.2), para que el cliente no muestre un estado distinto del que se bloqueó.
- **Race reporte↔envío resuelto por snapshot** (§2.4): la confirmación guarda `{código: cantidad}`, el gate rechaza si algún hallazgo creció **o si aparece uno 🟠 nuevo**, y la confirmación se consume en el envío (D13).
- **§3.3 regla 2 afinada:** nombre+fecha auto-actualiza salvo que el correo del acudiente difiera; la actualización es no destructiva (D14).
- **F3 con lista cerrada de objetos** (§4), nombrando los 7 índices únicos de `enrollments`.
- **F4 no bloquea a escuelas existentes** (§5, D15).

---

## 0. Contexto — qué pasó con Dynasty

La escuela pre-cargó **419 atletas** y envió **396 invitaciones** el 6 de julio. Cuando se auditó, tres semanas después, el estado era:

| Hecho | Número |
|---|---|
| Invitaciones enviadas | 396 (394 pendientes, 393 familias reales) |
| Correos que efectivamente salieron | ~100 (el resto murió en `429` de Resend) |
| Atletas pre-cargados sin acudiente vinculado | 415 de 419 |
| **Atletas cuya cuota resolvía a $0** | **343 de 419** |
| Atletas duplicados | 1 (importado dos veces: 13-jun y 6-jul) |
| Inscripciones activas partidas (equipo-solo + plan-solo) | 5, creciendo en vivo |
| Invitaciones que iban a crear una 2ª inscripción al aceptarse | 63 |
| Equipos duplicados en el catálogo | 1 ("MINIVOLLEY BENJAMINES" vs "MINIVOLLEY -BENJAMINES") |
| Invitaciones con correo inexistente (typo) | 1 |

Lo más grave no fue ninguno de los duplicados: fue que **el sistema dejó que una escuela invitara a 393 familias a pagar $0**, y que el contador de la UI reportara "Enviadas: 71" cuando Resend había rechazado las 71. Nada avisó, ni antes ni después.

### 0.1 Qué ya se cerró (F0, entregado el 2026-07-30)

| Falla | Arreglo | Dónde |
|---|---|---|
| Asignar plan creaba una 2ª inscripción activa | El POST completa la fila existente en vez de insertar | `bff/src/routes/enrollments.ts` |
| Aceptar invitación creaba una 2ª inscripción | Mismo criterio dentro de la RPC | `20260730000000_enrollment_no_split_rows.sql` |
| Hijo pre-cargado inadoptable si el correo traía espacios | `TRIM()` en el match | idem |
| Invitación pendiente duplicada por doble clic | Índice único parcial en `invitations` | idem |
| Envío masivo en ráfaga → `429` silencioso | Lotes de 100 vía `POST /emails/batch` + reintentos | `send-email` + `bff/src/routes/invitations.routes.ts` |
| Cero trazabilidad de correos | Tabla `email_sends` (una fila por destinatario) | `20260730000001_email_sends_log.sql` |
| El contador de envío mentía | Reporta envíos reales del BFF | `SchoolStudentsManagementPage.tsx` |

**Este spec cubre lo que quedó abierto.**

---

## 1. Objetivos

1. Que ninguna escuela pueda lanzar un envío masivo de invitaciones estando mal configurada, sin haberlo visto y aceptado explícitamente.
2. Que importar dos veces el mismo listado no duplique atletas.
3. Que el catálogo (equipos, planes) no admita gemelos.
4. Que lo que corre en producción esté en el repo.

### 1.1 No-objetivos

- No se cambia el modelo de cobro (plan manda, equipo = roster). Ya está definido.
- No se automatiza la asignación de planes: qué plan corresponde a cada equipo es decisión de cada escuela.
- No se construye un importador nuevo; se endurece el que existe.
- No se toca la entregabilidad de correo (SPF/DKIM/DMARC es configuración de infraestructura, no de producto).

---

## 2. F1 — Revisión previa al envío (el corazón del spec)

Un reporte de "listo para invitar" que corre **antes** de cualquier envío masivo y que la escuela tiene que mirar. Es la misma batería de chequeos que se ejecutó a mano en la auditoría, convertida en producto.

### 2.1 Chequeos y severidad

| # | Chequeo | Severidad | Por qué |
|---|---|---|---|
| C1 | Atletas cuya cuota resuelve a $0 | 🟠 **Confirmación explícita** | El caso Dynasty: 343 de 419. Puede ser legítimo (becados, escuela gratuita), por eso no es bloqueo duro. |
| C2 | Correo de acudiente vacío, inválido o con espacios | 🔴 **Bloquea** | Sin correo válido la invitación no llega y el hijo queda inadoptable para siempre. |
| C3 | Invitación cuyo `child_name` no corresponde a ningún atleta pre-cargado | 🔴 **Bloquea** | Al aceptarse crea un **hijo fantasma** (caso `janethgarzo@`). Compara con `normalize_name` (§3.1) — **la misma que usa `accept_invitation_pro` tras F2**, ver D11. |
| C4 | Dos atletas activos con el mismo nombre normalizado en la escuela | 🔴 **Bloquea** | El claim por correo adopta los dos y el papá ve el hijo duplicado (caso LUCIANA). Misma normalización que C3. |
| C5 | Dos atletas activos con el mismo documento | 🔴 **Bloquea** | Duplicado duro. |
| C6 | Atleta con 2+ inscripciones activas | 🔴 **Bloquea** | Roster inflado y riesgo de doble cobro. |
| C7 | Equipos o planes con nombre duplicado (normalizado) | 🟠 **Confirmación explícita** | Parte el roster; puede ser intencional en casos raros (dos sedes). |
| C8 | Atleta activo sin equipo ni plan | 🟡 **Advierte** | Entra pero no aparece en ninguna lista. |
| C9 | Acudiente sin teléfono | 🟡 **Advierte** | Sin canal alterno si el correo no llega. |
| C10 | Invitaciones pendientes ya enviadas con éxito **según registro desde el 2026-07-30** | 🟡 **Advierte** | Evita reenviar de más; informa cuántas son nuevas. El rótulo con fecha es obligatorio en la UI: antes de F0 no había registro y los envíos anteriores son irrecuperables (D12). |

**Semántica:**
- 🔴 **Bloquea** — el botón de envío masivo queda deshabilitado hasta resolverlo. Cada fila enlaza al atleta o invitación para corregirlo.
- 🟠 **Confirmación explícita** — se puede enviar, pero hay que marcar una casilla que dice qué se está aceptando ("Entiendo que 343 atletas quedarán con cuota $0"). La confirmación se registra.
- 🟡 **Advierte** — se muestra, no frena.

### 2.2 Dónde vive

RPC `public.school_readiness_report(p_school_id uuid)` → `jsonb` con un arreglo de hallazgos `{codigo, severidad, cantidad, muestra[]}`. `SECURITY DEFINER`, `search_path` fijado, `GRANT EXECUTE` explícito, y valida que quien llama sea admin de esa escuela.

Una sola fuente de verdad, consumida por:
- la pantalla de revisión previa (frontend),
- el gate del BFF en `POST /api/v1/invitations/bulk-send`, que la vuelve a evaluar server-side y **rechaza con 409 si hay rojos** — el bloqueo no puede vivir solo en el cliente,
- el botón "Invitar" de la pantalla de atletas, que entra por el mismo gate.

**Contrato del 409.** El rechazo devuelve el reporte **que el servidor acaba de evaluar**, no solo un código:

```json
{
  "error": "school_not_ready",
  "evaluated_at": "2026-07-30T15:04:05Z",
  "report": { "hallazgos": [ { "codigo": "C2", "severidad": "bloquea", "cantidad": 3, "muestra": [] } ] }
}
```

El cliente pinta **ese** jsonb. Si tuviera que volver a llamar la RPC para saber qué pasó, podría mostrar un estado distinto del que se bloqueó.

### 2.3 Registro de la confirmación

Tabla `school_send_confirmations`: escuela, usuario, timestamp, **snapshot de hallazgos aceptados** (`{código: cantidad}`), cantidad de invitaciones del envío y `consumed_at`. Sirve para responder "¿quién autorizó mandar 393 invitaciones con cuota en cero?" — y para §2.4.

### 2.4 Race entre el reporte y el envío

La escuela ve el reporte, alguien edita un atleta, y el envío corre contra un estado distinto. Que el BFF re-evalúe (D2) resuelve los 🔴, pero no los 🟠: se confirmó "343 en $0" y al momento del envío son 350 — la confirmación registrada no cubre a esos 7.

**Regla del gate**, evaluada contra el snapshot de la confirmación:

| Situación al momento del envío | Resultado |
|---|---|
| Un hallazgo 🟠 confirmado **creció** (343 → 350) | ❌ Rechaza, pide re-confirmar con las cifras nuevas |
| Aparece un 🟠 que **no estaba** en el snapshot | ❌ Rechaza |
| Un hallazgo 🟠 confirmado **bajó o desapareció** | ✅ Pasa (menos riesgo del aceptado) |
| Cualquier 🔴 | ❌ Rechaza siempre, haya o no confirmación |

La confirmación **se consume** en el envío (`consumed_at`): no queda vigente para el siguiente.

---

## 3. F2 — Anti-duplicados: catálogo e importación

### 3.1 Nombre normalizado

Función inmutable `public.normalize_name(text)`: `lower` → `trim` → colapsar espacios internos → quitar tildes y guiones. Se usa en los índices y en los chequeos C3, C4 y C7 para que "MINIVOLLEY BENJAMINES" y "MINIVOLLEY -BENJAMINES" colisionen.

**Y también en el runtime.** `accept_invitation_pro` y `claim_orphan_children` matchean hoy con `LOWER(TRIM())` a secas, sin quitar tildes. Si el verificador normaliza más que el motor, C3 daría **verde** en un caso donde el accept no encuentra al atleta y crea el hijo fantasma igual: el chequeo tranquilizaría sin proteger. F2 migra ambas RPCs a `normalize_name` para que verificador y motor no puedan divergir (D11).

> Ojo con el alcance: `normalize_name` es para **comparar**, nunca para mostrar ni para guardar. Los nombres se siguen almacenando como los escribió la escuela.

### 3.2 Índices propuestos

| Tabla | Índice | Alcance |
|---|---|---|
| `teams` | único parcial `(school_id, normalize_name(name))` | equipos activos |
| `offering_plans` | único parcial `(school_id, normalize_name(name))` | planes activos |
| `children` | único parcial `(school_id, doc_number)` | `doc_number` no vacío |

Los tres exigen **pre-limpieza dentro de la misma migración**, con reporte de qué se fusionó (lección de `uq_enrollment_child_plan`: un índice sobre datos sucios revienta el despliegue).

> **Nota:** deliberadamente **no** se pone un índice único por nombre de atleta. Los homónimos existen; eso se resuelve con el chequeo C4, que avisa y deja decidir.

### 3.3 Importación idempotente

La carga masiva debe poder correrse dos veces sin duplicar:

1. Si el atleta trae documento y ya existe uno con ese documento en la escuela → **actualiza**, no inserta.
2. Sin documento, si coincide nombre normalizado **y** fecha de nacimiento → actualiza, **salvo que el correo del acudiente entrante difiera del registrado**: correo distinto = otra familia = otro atleta, va a "posible duplicado".
3. Si coincide solo el nombre → **no inserta en silencio**: lo devuelve en el reporte previo de la importación como "posible duplicado", y el usuario decide.

**Toda actualización es no destructiva:** solo rellena campos vacíos, nunca pisa datos existentes. Un reimport no puede borrar lo que la escuela corrigió a mano.

> **Por qué la regla 2 no exige documento** (D14): los CSV de menores en Colombia casi nunca lo traen — ninguno de los 419 de Dynasty lo tenía. Exigirlo convertiría cada reimportación en cientos de "posibles duplicados" para revisar a mano; nadie revisa cientos, y la salida fácil es aceptar todo y duplicar la escuela entera. El discriminador por correo del acudiente cubre el caso de homónimos reales sin romper el flujo normal.

**Vista previa obligatoria antes de escribir:** cuántos se crean, cuántos se actualizan, cuántos son posibles duplicados, cuántas filas traen correo inválido. Nada se escribe hasta confirmar.

---

## 4. F3 — Cerrar el drift

Durante la auditoría, tres arreglos se escribieron contra código que resultó no ser el que corría. Objetos que hoy viven **solo en la base de datos**:

**Lista cerrada de objetos a declarar** (el plan de migraciones no admite "y otros"):

| # | Objeto | Cómo se descubrió |
|---|---|---|
| 1 | Función `accept_invitation_pro(uuid)` | La versión real usa `invitations.team_id` / `offering_plan_id`, que no existían en ninguna migración |
| 2 | Función `get_my_invitations()` | No está en el repo; había que saber si filtraba `expires_at` (no lo hace) |
| 3 | Función `migrate_unregistered_athlete_to_profile(...)` | La invoca `accept_invitation_pro`; nunca se verificó su origen |
| 4 | Columnas `invitations.team_id`, `invitations.offering_plan_id` | Declaradas en `20260730000000` con `IF NOT EXISTS`; falta el resto del esquema real de `invitations` |
| 5 | Columna `teams.price_monthly` | Usada por vistas y RPCs, ausente del esquema versionado |
| 6 | Índices únicos de `enrollments`: `uq_enrollment_child_plan`, `uq_enrollment_child_team`, `uq_enrollment_user_plan`, `uq_enrollment_user_team`, `uq_enrollment_unregistered_plan`, `uq_enrollment_unregistered_team`, `idx_enrollments_user_offering_plan_active` | El primero hizo fallar la migración con `23505` |
| 7 | Vista `school_athletes` | Vive en `20260729000002_school_athletes_fee_plan_wins.sql`, aún sin commitear |
| 8 | Edge function `send-invitation-email` | Desplegada, sin código en el repo |

**Hallazgo de limpieza:** `idx_enrollments_user_offering_plan_active` es **redundante** con `uq_enrollment_user_plan` — mismas columnas `(user_id, offering_plan_id)`, mismo predicado `status='active'`. Uno de los dos sobra; se decide cuál al escribir el plan.

**Entregable:** una migración de reconciliación que declare los objetos 1–7 con `CREATE OR REPLACE` / `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`, de modo que un entorno nuevo levante igual a producción. El objeto 8 se retira (ya no lo usa nadie tras F0).

**Método obligatorio:** cada función se extrae con `pg_get_functiondef()` de producción y se versiona **tal cual está corriendo**, sin "mejorarla de paso". Cualquier cambio de comportamiento va en una migración aparte y posterior.

**Regla de trabajo, no solo entregable:** antes de modificar cualquier RPC, leerla con `pg_get_functiondef()` en vez de asumir el repo.

---

## 5. F4 — Puesta en marcha de escuela nueva

Checklist guiado que la escuela ve al crearse, con estado por paso: sedes → equipos → planes con precio → atletas → asignación de plan → revisión previa → invitaciones.

Es la capa que convierte todo lo anterior en un camino, en vez de en una serie de alarmas que aparecen tarde.

### 5.1 Escuelas que ya existen (Dynasty, RMGYM…)

**El checklist nunca bloquea una función que la escuela ya usa** (D15). Al desplegar, toda escuela existente recibe estado `migrated`: ve su checklist con el estado real —Dynasty aparecería con "planes asignados" en rojo por los 343 en $0— pero como **lista de tareas pendientes**, no como candado. Bloquear a una escuela en producción por no haber pasado por un onboarding que no existía cuando se creó es inaceptable.

El único gate real sigue siendo el de F1, y ese **sí aplica a todas por igual**, nuevas y existentes: frena una acción nueva (el envío masivo), no una que ya venían usando. Dynasty tendrá que confirmar explícitamente sus cuotas en $0 antes del próximo envío — que es justamente lo que queremos.

Estado en `schools`: `onboarding_state` ∈ `pending` | `in_progress` | `completed` | `migrated`.

---

## 6. Decisiones de producto (resueltas)

- **D1 — Cuota $0 no bloquea, exige confirmación.** Hay escuelas gratuitas y atletas becados; un bloqueo duro sería falso positivo constante. Pero la confirmación es explícita y queda registrada.
- **D2 — El gate es server-side.** El BFF re-evalúa el reporte antes de enviar y rechaza con 409. La pantalla es conveniencia, no seguridad.
- **D3 — Las escuelas de prueba no están exentas.** `is_demo` no salta ningún chequeo: una escuela de pruebas que se vuelve real es exactamente el escenario que queremos cubrir.
- **D4 — Duplicado de atleta = documento; el nombre solo advierte.** Los homónimos son legítimos.
- **D5 — La importación nunca escribe sin vista previa confirmada.**
- **D6 — No se crea un índice único por nombre de atleta.** Ver §3.2.
- **D7 — Los duplicados preexistentes se limpian dentro de la migración que crea cada índice**, con reporte de lo fusionado. Ningún índice se crea sobre datos sucios.
- **D8 — Un solo camino de envío.** Todo envío masivo pasa por `bulk-send` con registro en `email_sends`. No se admiten envíos desde el cliente.
- **D9 — `email_sends` no se purga en v1.** Es el registro que hoy no existe; el volumen es despreciable.
- **D10 — La confirmación de riesgos se guarda por envío, no por escuela.** Que una escuela haya aceptado cuotas en $0 en julio no la exime de volver a verlo en agosto.
- **D11 — Verificador y motor comparten normalización.** `accept_invitation_pro` y `claim_orphan_children` migran a `normalize_name` en F2. Un chequeo más laxo que el runtime es peor que no tenerlo: da falsa tranquilidad.
- **D12 — No se hace backfill de `email_sends`.** El log de Resend no guarda el destinatario, así que los envíos anteriores al 2026-07-30 son irrecuperables. Se rotula la fecha en la UI en vez de inventar filas en la tabla que es la fuente de verdad.
- **D13 — La confirmación es un snapshot que se consume.** El gate compara `{código: cantidad}` y rechaza si algo creció o apareció; la confirmación no sobrevive al envío.
- **D14 — La importación auto-actualiza por nombre+fecha, discriminando por correo del acudiente**, y toda actualización es no destructiva. Exigir documento sería más "seguro" en el papel y peor en la práctica (§3.3).
- **D15 — F4 no bloquea a escuelas existentes.** Estado `migrated`; el checklist es tarea pendiente, no candado. El gate de F1 sí aplica a todas.

---

## 7. Fases y entregables

| Fase | Entregable | Depende de |
|---|---|---|
| **F0** ✅ | Inscripciones no partidas, invitaciones sin duplicar, envío por lotes con log | — |
| **F1** | `school_readiness_report` + pantalla de revisión previa + gate 409 con payload (§2.2) + `school_send_confirmations` con snapshot (§2.4) | F0 |
| **F2** | `normalize_name`, **migración de `accept_invitation_pro` y `claim_orphan_children` a esa normalización** (D11), índices de catálogo y documento (con pre-limpieza), importación idempotente con vista previa | F1 (los chequeos alimentan el reporte) |
| **F3** | Migración de reconciliación de los 7 objetos en drift (§4) + retiro de `send-invitation-email` | — (paralela) |
| **F4** | Checklist de puesta en marcha + `onboarding_state` con `migrated` para escuelas existentes | F1, F2 |

**Orden sugerido:** F3 primero o en paralelo. Versionar el drift antes de tocar `accept_invitation_pro` en F2 evita escribir otra vez contra una función que no es la que corre — que es exactamente el error que costó tres iteraciones en la auditoría.

Cada fase entra por su propia rama y se revisa antes de la siguiente. F1 y F2 llevan plan de migraciones aprobado antes de escribir SQL.

---

## 8. Riesgos

- **Falsos positivos que entrenan a ignorar.** Si el reporte marca rojo por cosas legítimas, la escuela aprende a saltárselo y el gate pierde valor. Por eso solo 5 chequeos bloquean, y son los que producen daño irreversible (hijo fantasma, hijo duplicado, cobro doble).
- **Pre-limpieza de índices sobre datos reales.** Fusionar duplicados preexistentes toca datos de clientes en producción. Cada migración de F2 va con su `SELECT` de verificación previo y su reporte, y se aplica escuela por escuela si hace falta.
- **El gate frena a una escuela con prisa.** Un admin que necesita invitar hoy y tiene un rojo se va a frustrar. Mitigación: cada hallazgo enlaza directo a la pantalla donde se corrige, y los rojos son pocos y accionables.
- **F3 sin disciplina se vuelve a llenar de drift.** La migración de reconciliación es un punto de partida, no una garantía; lo que sostiene es la regla de leer la función viva antes de modificarla.
- **Cambiar la normalización del runtime altera a quién matchea el accept.** D11 no es cosmético: al pasar `accept_invitation_pro` a `normalize_name`, invitaciones que hoy **no** encuentran a su atleta (y crearían un hijo nuevo) pasarán a encontrarlo. Es la corrección buscada, pero cambia comportamiento en producción. El plan de F2 debe incluir el conteo previo de cuántas invitaciones pendientes cambian de resultado — en Dynasty, medirlo antes y después sobre las 393 pendientes.
