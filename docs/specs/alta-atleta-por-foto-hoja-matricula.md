# Alta de atleta por foto de la hoja de matrícula (OCR + WhatsApp)

**Estado:** propuesta, sin aprobar. Nada de esto está implementado.
**Fecha:** 2026-09-16. **Autor:** brylop.

Plan antes de código, según la convención del repo: esta fase toca una tabla
nueva (o una existente) y RLS, así que no se escribe SQL hasta que el plan
esté aprobado.

## 0. El problema

Dynasty (y probablemente otras escuelas) sigue diligenciando la matrícula de
cada atleta nuevo en una **hoja física en papel** (ver foto de referencia,
"Hoja de Matrícula 2026" del Club y Escuela de Voleibol Dynasty D.C.) y
después alguien la transcribe a mano en la app. Se pide automatizar esa
transcripción: la escuela manda **la foto de la hoja** por WhatsApp, el
sistema **extrae los datos por OCR**, y — tras revisión humana — se crea el
atleta con su acudiente e invitación, igual que si se hubiera dado de alta
desde la app.

Campos que trae la hoja real (foto adjunta a esta conversación):

| Sección | Campo | Mapea a |
|---|---|---|
| Deportista | Nombre completo | `children.full_name` |
| Deportista | Tipo y número de documento (CC) | `children.doc_type` / `children.doc_number` |
| Deportista | Fecha de nacimiento | `children.date_of_birth` |
| Deportista | Categoría (ej. SENIORS) | texto libre → asignación manual de equipo/programa, **no** se auto-asigna |
| Acudiente | Nombre completo | `children.parent_name_temp` |
| Acudiente | Documento de identidad | nuevo campo, ver §3 |
| Acudiente | Teléfono de contacto | `children.parent_phone_temp` |
| Acudiente | Correo electrónico (obligatorio para factura) | `children.parent_email_temp` |
| Salud | EPS | `children.eps_name` (ya existe) |
| Salud | Grupo sanguíneo y RH | `children.blood_type` (ya existe) |
| Autorizaciones | 3 checkboxes + compromiso económico | NO se digitalizan en esta fase (§7) |

## 1. Qué se reutiliza (y por qué no se construye desde cero)

Este flujo es, en la forma, el mismo problema que "comprobante de pago por
WhatsApp" (`whatsapp-cola-de-comprobantes-plan.md`) con otro schema de
salida. Se reutiliza la misma arquitectura, no solo la inspiración:

| Pieza | De dónde sale | Qué cambia |
|---|---|---|
| Recepción de imagen por WhatsApp | `downloadMedia()` en `whatsapp.service.ts` | nada — ya baja imagen/PDF, valida mime y tamaño |
| Cola con lease + `SKIP LOCKED` | patrón de `whatsapp_inbound_queue` (§3 de ese plan) | mismo diseño, tabla o `result_type` distinto (§3 de este doc) |
| Extractor OCR | `ocr.service.ts` (Gemini → OpenAI → Groq fallback) | **nuevo `SYSTEM_PROMPT` y schema** (`EnrollmentFormResult`, no `OcrResult` de comprobantes) — es la misma cadena de proveedores, otro prompt |
| Principio "el LLM solo extrae, nunca decide" | `ocr.service.ts:36-37` | se mantiene tal cual: el OCR llena el formulario, un humano de la escuela confirma o corrige antes de crear el atleta |
| Alta con acudiente sin cuenta | `POST /api/v1/students/bulk` (`students.ts:105`, campos `parent_*_temp`) | se reutiliza el mismo insert; no se inventa un segundo camino de alta |
| Columnas de salud | `children.blood_type`, `children.eps_name` | **ya existen**, no hace falta migración para esto |
| Inbox de revisión pendiente de construir | explícitamente pendiente en `whatsapp-cola-de-comprobantes-plan.md §"Lo que sigue pendiente"` | esta feature **sí** necesita ese inbox — no se puede seguir posponiendo si esta feature lo requiere primero (§5) |

## 2. Por qué NO se auto-crea el atleta (decisión ya tomada con el usuario)

El OCR de comprobantes con doble lector auto-aprueba solo cuando dos
proveedores coinciden en campos financieros acotados (monto, fecha,
referencia). Una hoja de matrícula tiene:

- Letra manuscrita, mucho más variable que un comprobante de banco impreso.
- Datos de identidad (documento, fecha de nacimiento) donde un error de OCR
  no rechaza un pago — **crea una persona equivocada** en el sistema, con
  riesgo de duplicados que `identidad-de-atleta-propuesta.md` ya documenta
  como problema activo (130 atletas sin documento, colisiones por nombre).

Por eso: el OCR llena un **formulario prellenado y editable**; un admin de la
escuela lo confirma o corrige campo por campo antes de que exista el
`POST /students/bulk`. Nunca hay creación automática en esta fase.

## 3. La cola: tabla nueva, mismo patrón que `whatsapp_inbound_queue`

Dos opciones evaluadas:

**A. Extender `whatsapp_inbound_queue`** con un `result_type` nuevo
(`'enrollment_form'` junto al `'payment_receipt'` existente) y un
`result_ref_id` que apunte a la fila borrador.

**B. Tabla propia `enrollment_form_intake`**, análoga en forma pero
independiente, porque el shape del resultado (nombre/documento/fecha
nacimiento/acudiente) no tiene nada en común con el de un comprobante y
forzarlo en el mismo JSON de resultado generaría un campo `jsonb` polimórfico
que nadie va a tipar bien.

**Se propone B.** La cola de ingesta cruda (imagen recibida, quién la mandó,
estado de procesamiento) es idéntica en las dos, así que si `A` ya existiera
con migración aplicada convendría compartir la tabla de *ingesta*; hoy
`whatsapp_inbound_queue` **sigue sin migración** (`whatsapp-cola-de-comprobantes-plan.md §1`),
así que no hay nada estable de qué colgarse. Construir B no duplica una
migración que no existe.

```sql
CREATE TABLE public.enrollment_form_intake (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    integration_id    uuid NOT NULL,   -- FK compuesta a school_whatsapp_integrations, igual que §3.B del plan de comprobantes
    wa_message_id     text NOT NULL,
    wa_phone_number   text NOT NULL,   -- quién mandó la foto (para responder)
    media_id          text NOT NULL,
    storage_path      text,            -- se estampa ANTES del OCR (la URL de Meta expira, misma lección del plan de comprobantes §4.3)
    status            text NOT NULL DEFAULT 'pending',
    extracted         jsonb,           -- EnrollmentFormResult crudo, tal como salió del OCR
    reviewed_by       uuid REFERENCES public.profiles(id),
    reviewed_at       timestamptz,
    child_id          uuid REFERENCES public.children(id),  -- se llena al confirmar
    duplicate_of_child_id   uuid REFERENCES public.children(id),           -- ver §6.1
    duplicate_of_intake_id  uuid REFERENCES public.enrollment_form_intake(id),
    locked_until      timestamptz,
    next_retry_at     timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (wa_message_id)
);

ALTER TABLE public.enrollment_form_intake
  ADD CONSTRAINT chk_enrollment_intake_status CHECK (status IN
    ('pending','processing','waiting_review','approved','rejected','failed'));
```

Permisos: mismo patrón que §2.2-2.3 de `whatsapp-cola-de-comprobantes-plan.md`
— `REVOKE ALL FROM PUBLIC, anon, authenticated`; `service_role` con todo;
`authenticated` con `SELECT` vía policy `is_school_admin(school_id)` (para el
inbox de revisión, §5); escritura desde la app siempre `false` (solo
`service_role`, es decir, el worker o el endpoint de aprobación que usa la
service key del BFF).

**La foto es dato sensible por sí misma**, no solo el `children` que termina
creando: en un mismo archivo hay documento de identidad de dos personas,
correo, teléfono, EPS y grupo sanguíneo — dato de salud, no financiero como
en el flujo de comprobantes. El bucket donde se guarda `storage_path` necesita
policies de Storage por `school_id` (mismo criterio que ya aplica el bucket
`identity-documents` usado por `athlete_documents`, §1 de este documento).

**Retención, definida ahora, no en la fase de migración:**

| Estado final | Regla |
|---|---|
| `approved` | se conserva sin fecha de borrado — es el respaldo de las autorizaciones firmadas en papel (§7), y borrar la foto dejaría esos consentimientos sin evidencia |
| `rejected` / `failed` | se borra del bucket (fila y `storage_path`) a los 7 días |
| `waiting_review` sin tocar 30 días | no se borra sola: se le avisa al admin de la escuela (mismo canal que el inbox) para que la revise o la descarte; el borrado automático de algo que nadie llegó a ver es el riesgo mayor, no el menor |

**Estados:**

| Estado | Significado |
|---|---|
| `pending` | encolada, sin procesar |
| `processing` | tomada por el worker (con lease, igual que comprobantes §4.2) |
| `waiting_review` | OCR corrió, hay un formulario prellenado esperando que un admin lo confirme |
| `approved` | el admin confirmó → se creó el `children` |
| `rejected` | el admin descartó la foto (no es una hoja de matrícula, ilegible, duplicada) |
| `failed` | error permanente (mime no soportado, > tamaño) |

## 4. El extractor OCR nuevo

Nuevo módulo `enrollment-ocr.service.ts` (o una función exportada adicional
en `ocr.service.ts`, a decidir en la fase de código), con su propio
`SYSTEM_PROMPT` y schema — **reusa la cadena de proveedores** (`extractReceipt`
ya separa provider de schema en su diseño; se necesita el equivalente
`extractEnrollmentForm` con el mismo fallback Gemini→OpenAI→Groq):

```ts
interface EnrollmentFormResult {
    athleteFullName: string | null;
    docType: string | null;        // "CC" | "TI" | "RC" | "CE" | null
    docNumber: string | null;
    dateOfBirth: string | null;    // ISO yyyy-mm-dd
    category: string | null;       // texto libre tal como aparece en la hoja
    guardianFullName: string | null;
    guardianDocNumber: string | null;
    guardianPhone: string | null;
    guardianEmail: string | null;
    epsName: string | null;
    bloodType: string | null;      // "O+" | "O-" | "A+" | ... | null
    isEnrollmentForm: boolean;     // false si la imagen no es una hoja de matrícula
    missingFields: string[];
    provider: string;
}
```

Mismas reglas que el extractor de comprobantes (`ocr.service.ts:36-37,
55-67`): **el modelo solo extrae, nunca valida ni decide**; campo no legible
= `null` + entrada en `missingFields`, nunca inventado. La plantilla puede
variar entre escuelas (Dynasty tiene un formato, otra escuela puede tener
otro) — el prompt debe pedir explícitamente "extrae lo que veas, sea cual sea
el formato de la hoja", no asumir el layout exacto de la foto de Dynasty.

`dateOfBirth` se acompaña de `dateOfBirthRaw` (el texto tal como aparece en la
hoja, ej. "23 ENERO 1996" o "23/01/96") para que el revisor vea de dónde salió
el ISO — en fechas numéricas `dd/mm` vs `mm/dd` es ambiguo y el LLM lo
resuelve en silencio si solo se devuelve el ISO. `age` también se extrae tal
cual aparece (la hoja de Dynasty la trae) como cruce contra `dateOfBirth`: si
no coinciden, es señal de que el OCR se equivocó en algún lado, no algo que
el sistema deba decidir por su cuenta.

```ts
interface EnrollmentFormResult {
    // ...campos de arriba...
    dateOfBirthRaw: string | null;
    ageOnForm: number | null;   // tal como aparece en la hoja, para cruce visual
    athleteEmail: string | null;   // solo si la hoja trae un correo propio del deportista, distinto del acudiente
    athletePhone: string | null;
}
```

Se agregan por si otra escuela sí trae un correo/teléfono propio del
deportista en su formato de hoja — no porque la de Dynasty los traiga: ahí
solo está el contacto del acudiente (§6 documenta que ese caso queda sin
invitación automática).

### 4.1 Cuál extractor corre — clasificación antes del prompt

Las fotos de comprobantes de pago y las de hojas de matrícula llegan al mismo
número de WhatsApp, por el mismo `downloadMedia()`. El worker necesita
decidir **cuál** de los dos extractores correr antes de poder construir el
prompt — sin esto la fase 3 no se puede escribir.

Se descarta pedirle al remitente que lo indique por caption (frágil, nadie
sigue esa convención de forma consistente). Se propone: **correr primero el
extractor de comprobantes** (ya existe, ya está en producción) y usar su
propio `isReceipt` como señal de enrutamiento — no se construye un
clasificador nuevo. El chequeo de quién manda (§4.2) va **antes** del segundo
extractor, no después, porque es una consulta a `school_staff` que no cuesta
nada — no tiene sentido gastar una segunda llamada a LLM en una foto que se
va a rechazar de todas formas por venir de un número que no es staff:

```
imagen entrante
  → extractReceipt(imagen)
  → isReceipt === true  → sigue el flujo de comprobantes (whatsapp-cola-de-comprobantes-plan.md), sin tocar nada de este plan
  → isReceipt === false → ¿wa_phone_number es school_staff owner/admin/school_admin de esta escuela? (§4.2)
       → no  → rechazar aquí, sin correr extractEnrollmentForm. No se encola nada.
       → sí  → correr extractEnrollmentForm(imagen)
            → isEnrollmentForm === true  → encolar en waiting_review (este flujo)
            → isEnrollmentForm === false → ninguno de los dos formatos reconocidos;
              status='rejected' con motivo "no reconocida", sin crear nada
```

Costo: dos llamadas a LLM solo para una foto que (a) no es comprobante y (b)
viene de staff — el caso que de verdad puede ser una matrícula. Es aceptable
porque el volumen es bajo hoy y el costo medido de una lectura es ~$0,01
(`whatsapp-cola-de-comprobantes-plan.md §1.2`). Si el volumen de matrículas
crece y el costo doble empieza a pesar, la alternativa es un clasificador
barato de una sola llamada que devuelva `receipt | enrollment_form | other`,
pero no se construye por adelantado sin medir que hace falta.

**Verificar antes de la fase 3:** qué hace hoy `whatsapp.service.ts` cuando
`extractReceipt` devuelve `isReceipt:false` — si el flujo de comprobantes ya
dispara una respuesta al remitente (tipo "no pudimos leer tu comprobante") o
marca la fila como `ignored` en `whatsapp_inbound_queue`, un admin de escuela
que manda una matrícula recibiría primero un mensaje de error de pago antes
de que este flujo tome el control. Si es así, hay que interceptar el
`isReceipt:false` antes de que dispare esa respuesta, no después.

### 4.2 Quién puede mandar la foto

`wa_phone_number` identifica a quien mandó el mensaje, pero cualquier persona
que tenga el número de WhatsApp de la escuela —incluido un padre— puede
mandar una imagen. Con comprobantes de pago eso es el caso normal (el padre
manda su propio comprobante). Con hojas de matrícula, una foto mandada por
alguien que no es staff de la escuela es ruido: no debería poder dar de alta
un atleta a nombre de la escuela.

Apenas `extractReceipt` devuelve `isReceipt:false` (§4.1), antes de correr
`extractEnrollmentForm`, verificar que `wa_phone_number` pertenezca a un
`school_staff` con rol `owner/admin/school_admin` de esa escuela. Si no, se
responde indicando que solo el staff de la escuela puede registrar
matrículas por esta vía y la fila queda `rejected` con ese motivo — no se
descarta en silencio, para que quien escribió sepa qué hacer.

## 5. El inbox de revisión (pieza nueva, no reusable)

A diferencia del flujo de comprobantes —que puede auto-aprobar y solo
necesita el inbox para los casos `failed`/`ignored`— **este flujo depende del
inbox desde el día uno**, porque el 100% de los casos requiere confirmación
humana (§2). No se puede lanzar esta feature sin construir primero la
pantalla mínima de revisión, así que el orden de fases (§8) la pone antes que
cualquier otra cosa después del extractor.

Pantalla nueva (`frontend`, dentro del panel de admin de escuela):

- Lista de `enrollment_form_intake` en `waiting_review` para la escuela.
- Por cada una: la foto original (desde `storage_path`) al lado de un
  formulario prellenado con `extracted`, cada campo editable, resaltando en
  amarillo los que vinieron en `missingFields`.
- Botón **Crear atleta**: valida que estén los campos obligatorios (ver §6),
  llama a `students/bulk` con un solo registro, guarda `child_id` y pasa a
  `approved`.
- Botón **Descartar**: pasa a `rejected` con motivo (foto ilegible, no es una
  hoja de matrícula, duplicada), sin crear nada.
- Botón **Vincular a existente** (solo visible cuando `duplicate_of_child_id`
  está estampado, §6.1): actualiza únicamente los campos vacíos del
  `children` destino (ej. `eps_name`/`blood_type` si hoy son `NULL`, nunca
  sobrescribe uno ya cargado) y pasa la fila a `approved` con `child_id` =
  el existente. No crea ninguna fila nueva en `children`.

Endpoint BFF nuevo: `GET /api/v1/enrollment-intake` (lista por escuela),
`POST /api/v1/enrollment-intake/:id/approve` (recibe el formulario ya
corregido, llama internamente a la misma lógica que `students/bulk`),
`POST /api/v1/enrollment-intake/:id/link` (recibe el `child_id` destino,
aplica la actualización de campos vacíos descrita arriba — ver §6.1(c) para
la misma protección transaccional) y `POST /api/v1/enrollment-intake/:id/reject`.
Autorización: `owner/admin/school_admin`, igual que `students/bulk` hoy.

## 6. Reglas de negocio al confirmar

- **Documento del atleta es obligatorio en este flujo**, aunque hoy sea
  opcional en `children` a nivel de esquema. `identidad-de-atleta-propuesta.md`
  documenta el costo de no exigirlo (9,2% de atletas sin documento, 7
  colisiones); no hay razón para que un alta nueva por OCR repita ese error.
  Si el OCR no pudo leerlo, el campo queda vacío en el formulario y el botón
  "Crear atleta" se bloquea hasta que el admin lo escriba a mano.
- Verificación de duplicados: ver §6.1, obligatoria en tres momentos, no solo
  al confirmar.
- **Atleta mayor de edad sin cuenta propia.** La hoja de Dynasty muestra el
  caso real: un deportista de 30 años que igual trae un "acudiente"
  diligenciado (nombre, documento, teléfono, correo). Para un adulto ese
  contacto es un **contacto de emergencia**, no quien debe recibir la
  invitación y terminar siendo el dueño de la cuenta — invitar al "acudiente"
  de un adulto repetiría el problema que `identidad-de-atleta-propuesta.md`
  ya describe desde otro ángulo (la cuenta queda a nombre de la persona
  equivocada). Regla: si `dateOfBirth` (o `ageOnForm`, §4) indica 18 años o
  más, el formulario del inbox muestra el bloque de "acudiente" etiquetado
  como **"Contacto de emergencia"**, NO se llena `parent_*_temp`, y la
  invitación —si el correo del propio atleta está disponible— se manda al
  atleta. Si no hay correo del atleta en la hoja, el alta queda sin invitación
  automática y el admin la gestiona a mano, igual que hoy para un adulto sin
  correo.
- **Categoría** no auto-asigna equipo/programa: queda como texto de
  referencia para que el admin la asigne manualmente desde la pantalla de
  siempre. Mapear "SENIORS" (texto libre de la hoja) a un `team_id`/
  `program_id` concreto es una decisión de producto que varía por escuela y
  queda fuera de esta fase.
- Correo del acudiente: la hoja lo marca "obligatorio para factura
  electrónica" — si el OCR no lo extrae, el formulario lo debe pedir antes de
  permitir crear (igual de obligatorio que hoy es para `Factus`, ver
  `project_electronic_invoicing`).
- Al confirmar se dispara la invitación al acudiente por el mismo camino que
  ya usa `students/bulk` — no se reinventa.

## 6.1 Verificación de existencia y duplicados (obligatoria, en tres momentos)

Un atleta que ya existe **nunca** se vuelve a crear desde este flujo. La
verificación corre en tres puntos, no solo al aprobar, porque cada uno
detecta un tipo distinto de duplicado:

**a) Al encolar (antes del OCR)** — duplicado de *mensaje*
- `UNIQUE (wa_message_id)` ya cubre el reenvío exacto del mismo mensaje.
- No cubre una segunda foto de la misma hoja (otro `wa_message_id`). Eso se
  detecta en (b).

**b) Al salir del OCR (`waiting_review`)** — duplicado de *persona*
El worker, con `extracted.docNumber` normalizado (sin puntos, espacios ni
guiones, mismo criterio que `students.ts:137-144`), busca en la misma
`school_id`:
1. `children.doc_number` → si existe, la fila entra a `waiting_review` con
   `duplicate_of_child_id` estampado. El inbox la muestra con aviso "Ya
   existe: [nombre]" y el botón **Crear atleta** queda deshabilitado; solo se
   ofrece **Vincular a existente** (actualiza campos vacíos del `children`
   actual, ej. `eps_name`/`blood_type`, sin crear fila) o **Descartar**.
2. Otros `enrollment_form_intake` en `pending`/`processing`/`waiting_review`
   con el mismo documento → se marca `duplicate_of_intake_id`; el inbox
   agrupa las dos y el admin aprueba una sola.
3. Si `docNumber` es `null` (OCR no lo leyó), se hace búsqueda secundaria por
   `full_name` normalizado + `date_of_birth` exactos. Coincidencia = solo
   **aviso**, no bloqueo, porque nombre+fecha no es identidad confiable (ver
   colisiones en `identidad-de-atleta-propuesta.md`).

**c) Al aprobar (`POST /enrollment-intake/:id/approve`)** — carrera entre
revisores
El endpoint repite la búsqueda por documento **dentro de la misma
transacción** que el insert, con el documento ya corregido por el admin
(puede diferir del que leyó el OCR). Si en ese instante ya existe → responde
`409` con el `child_id` existente y la fila pasa a `waiting_review` con
`duplicate_of_child_id`; no se crea nada. Cubre el caso de dos admins
aprobando en paralelo o de un alta manual hecha mientras la foto esperaba
revisión.

**`/link` tiene la misma exigencia**: antes de aplicar la actualización de
campos vacíos, verifica dentro de la transacción que el `child_id` destino
siga existiendo (no se borró entre que el inbox lo mostró y el admin dio
clic) — si no existe, responde `404` y la fila vuelve a `waiting_review` sin
tocar nada, para que el admin la revise de nuevo con la lista de candidatos
actualizada.

Columnas ya incluidas en la migración de §3: `duplicate_of_child_id`,
`duplicate_of_intake_id`.

**Regla de negocio:** la búsqueda es siempre por escuela. El mismo documento
en otra escuela **no** es duplicado en esta fase (un deportista puede estar
en dos clubes); cruzar escuelas es tema del pasaporte deportivo, fuera de
alcance.

**Vincular a existente** es lo que le da valor real a la revisión más allá de
evitar el duplicado: la hoja 2026 de un atleta que ya está en el sistema
desde 2025 trae EPS y RH que probablemente hoy están vacíos en `children` —
mejor completar el registro existente que rechazar la foto sin más.

## 7. Fuera de alcance de esta fase

- **Las autorizaciones firmadas** (participación, primeros auxilios,
  tratamiento de datos, uso de imagen) que trae la hoja física — son consentimientos
  legales con checkbox marcado a mano; digitalizarlos como campos booleanos
  sin la firma real no tiene valor legal. Se archiva la foto completa
  (`storage_path`) como respaldo, pero no se modela cada checkbox en
  columnas.
- Auto-creación sin revisión humana (§2) — explícitamente descartada para
  esta fase, podría reconsiderarse más adelante si se mide una tasa de
  acierto muy alta con datos reales.
- Asignación automática de equipo/categoría.
- Doble lector / cross-check entre providers (como sí tiene el flujo de
  comprobantes financieros) — el costo de un error aquí lo absorbe la
  revisión humana obligatoria, no hace falta ese refuerzo.
- Cobro/mensualidad: la hoja trae un compromiso económico, pero fijar
  `monthly_fee` sigue el flujo normal de matrícula (`inscripcion-vs-periodo-de-plan.md`),
  no se deriva de la foto.

**Nota para una fase futura, no de este plan:** en vez de que la escuela llene
la hoja a mano y el OCR la lea, se podría generar el PDF YA LLENO desde
`children` + acudiente (mismo motor HTML→PDF que ya existe para facturación),
con el formato propio de cada escuela (logo, NIT, resolución IDRD, bloques y
autorizaciones tal como los tiene Dynasty). El admin lo imprime, el padre lo
firma, y la foto firmada vuelve por WhatsApp solo para archivar contra el
atleta — ahí no hace falta que el OCR extraiga nada, solo emparejar contra el
`child_id` que ya generó el PDF. Esto resolvería de raíz el problema de la
letra manuscrita (§8, fase 5) porque ya no habría nada que transcribir, y
conservaría la firma. Se deja anotado, no se implementa en este plan.

## 8. Fases propuestas (una rama por fase, revisión entre cada una)

1. **Migración**: `enrollment_form_intake` + RLS + permisos (§3). Se verifica
   con el mismo checklist de invariantes que usa el plan de comprobantes
   (`seguridad:invariantes`, `set local role anon/authenticated` → `permission
   denied`).
2. **Extractor OCR** (`enrollment-ocr.service.ts`) con su prompt y schema,
   probado en aislado contra la foto real de Dynasty y 2-3 fotos de otras
   escuelas si están disponibles, antes de conectarlo al webhook.
3. **Webhook + worker**: encolar la imagen cuando llega por WhatsApp, bajar,
   subir a bucket, correr el extractor, dejar en `waiting_review`. Mismo
   patrón de lease/rescate que `whatsapp-cola-de-comprobantes-plan.md §4.2`.
4. **Inbox de revisión** (frontend + 3 endpoints BFF, §5). Sin esto no hay
   forma de probar la fase 3 con una escuela real.
5. **Piloto con Dynasty**: una hoja real de las que ya tienen en papel,
   medir cuántos campos exige corrección manual antes de decidir si esto
   ahorra tiempo real o solo lo traslada. **La foto de referencia de este
   plan está diligenciada a máquina** — buena para probar el flujo, pero no
   representativa: la tasa de acierto en letra manuscrita puede ser muy
   distinta. Antes de medir el "ahorra tiempo real", conseguir al menos una
   hoja manuscrita real (Dynasty u otra escuela) y medirla por separado.

## 9. Cómo se verifica

- [ ] `npm run migrations:new -- enrollment_form_intake` y `migrations:check` en verde
- [ ] `npm run seguridad:invariantes` sin críticos
- [ ] `set local role anon; select * from public.enrollment_form_intake;` → `permission denied`
- [ ] Ídem `authenticated` sin admin
- [ ] Mandar la foto real de Dynasty adjunta a esta conversación (atleta
      mayor de edad) → aparece en `waiting_review` con los 11 campos de §0
      poblados o en `missingFields`
- [ ] Confirmar esa misma fila desde el inbox → aparece en `children` con
      `doc_number` correcto, **sin** `parent_*_temp` llenado (es mayor de
      edad, §6) y sin invitación automática porque la hoja no trae correo
      propio del atleta
- [ ] Mandar la hoja de un atleta **menor de edad** con datos de acudiente
      completos → al confirmar, el acudiente queda invitado por el camino de
      `students/bulk`, igual que un alta manual
- [ ] Mandar una foto que no es una hoja de matrícula → `isEnrollmentForm:false`,
      la fila se puede descartar sin crear nada
- [ ] Mandar la misma foto dos veces → no crea dos atletas (mismo `wa_message_id`
      + verificación de documento duplicado en §6.1)
- [ ] Documento vacío en el formulario → botón "Crear atleta" bloqueado
- [ ] Mandar un comprobante de pago normal → sigue el flujo de comprobantes
      sin tocar `enrollment_form_intake` (§4.1)
- [ ] Mandar la foto desde el número de un padre (no staff) → se rechaza con
      el motivo correspondiente, no se encola (§4.2)
- [ ] Mandar la hoja de un atleta que ya existe → `waiting_review` con
      `duplicate_of_child_id`, botón Crear deshabilitado, opción Vincular
      disponible
- [ ] Mandar dos fotos distintas de la misma hoja → la segunda queda con
      `duplicate_of_intake_id`, el inbox las agrupa
- [ ] Aprobar en paralelo dos intakes del mismo documento → una crea, la otra
      recibe `409` y no hay dos `children`
- [ ] Crear el atleta a mano en la app mientras la foto espera revisión → al
      aprobar responde `409`
- [ ] Borrar el `children` destino mientras el admin tiene el inbox abierto,
      antes de dar clic en Vincular → `/link` responde `404`, la fila vuelve
      a `waiting_review` sin tocar nada
- [ ] Mismo documento en otra escuela → se crea normal, sin aviso
- [ ] Hoja de un atleta mayor de edad → en el inbox el bloque de acudiente se
      etiqueta "Contacto de emergencia" (verificación de UI, distinta del
      chequeo de datos ya cubierto arriba)
- [ ] Vincular una fila con `duplicate_of_child_id` → solo actualiza los
      campos vacíos del `children` existente, no sobrescribe uno ya cargado,
      no crea fila nueva

## 10. Fuentes

- Foto real de la "Hoja de Matrícula 2026" de Dynasty D.C., adjunta a esta conversación (2026-09-16).
- `bff/src/services/ocr.service.ts` — cadena de proveedores y principio "el LLM solo extrae".
- `bff/src/routes/students.ts:105-390` — `POST /students/bulk`, patrón `parent_*_temp`.
- `docs/specs/whatsapp-cola-de-comprobantes-plan.md` — arquitectura de cola a clonar (lease, permisos, retención, inbox pendiente).
- `docs/specs/identidad-de-atleta-propuesta.md` — riesgo de duplicados por falta de documento, ya medido en la base.
- `supabase/migrations/20260318000000_prd_iam_alignment.sql`, `20260825125806_monster_volley_athlete_intake.sql` — `children.blood_type`/`eps_name` ya existen, mismo vocabulario a reusar.
