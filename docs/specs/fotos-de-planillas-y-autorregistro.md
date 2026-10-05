# Planillas por foto y autorregistro del acudiente

**Estado:** v0.1 — propuesta, sin código. Plan antes de código (regla del repo).
**Origen:** Dynasty, 2026-10-03. Lleva pagos y asistencia en papel; la dueña pidió que entrenadores o ella puedan **tomar asistencia a mano, fotografiarla y subirla**, leer la **hoja de matrícula**, y que los **papás creen su usuario mandando todo desde la app**.
**Evidencia:** `docs/dynasty-planillas-septiembre-2026/` — 32 fotos reales transcritas y cruzadas contra la base. Es el banco de prueba de este spec.

---

## 0. Lo que ya existe (no se reconstruye)

| Pieza | Estado | Dónde |
|---|---|---|
| OCR de comprobantes (visión, Gemini→OpenAI→Groq) | vivo | `bff/src/services/ocr.service.ts` |
| OCR de hoja de matrícula + bandeja de revisión | vivo, **solo por WhatsApp desde un admin** | `enrollment-ocr.service.ts`, `enrollment-intake.routes.ts`, `/school/enrollment-intake` |
| Registro de asistencia con descuento de clases | vivo | `POST /attendance/session` (`attendance.ts`) |
| Autorregistro por QR (`/join/:slug`) | vivo; Dynasty: 974 escaneos | `submit_qr_signup` (13 args) |
| Ficha con RH, EPS, foto de documento, info médica | columnas en `children` / `unregistered_athletes` | `blood_type`, `eps_name`, `id_document_url`, `medical_info`, `emergency_contact` |

## 1. Lo que enseñaron las planillas reales (no se deduce del código)

1. **Las fotos vienen rotadas 90°, con perspectiva y hojas dobladas.** El OCR tiene que enderezar y leer la grilla; un 10–15 % de celdas queda corrido ±1 fila o columna. → **Revisión humana obligatoria**, nunca guardar el OCR crudo.
2. **Cada escuela tiene su propia leyenda.** Dynasty usa ✓, X, R, VR, ✓R; un grupo marca todo con X (que por el patrón parece *asistió*). → La leyenda se configura **una vez por escuela**, no se adivina.
3. **Los encabezados de día se corrigen a mano** (23→22, 28→29). → El día se confirma en la revisión, no se toma del impreso.
4. **Los nombres van en apellidos primero, abreviados o con otra ortografía**, y aparecen alumnos manuscritos al final que no están en la app. → Coincidencia aproximada contra el **roster del equipo**; lo que no coincide se ofrece como "atleta nuevo" (alimenta F2/F3), nunca se crea solo.
5. **Las planillas de pago traen pagos de otros meses y abonos.** En el cruce, 136 de 227 filas ya estaban pagadas en la app. → La planilla de pagos **no es una pieza de este spec**; el canal de comprobantes de WhatsApp es el camino. Si se pide, va como F4 aparte.

## 2. F1 — Asistencia por foto

**Quién:** coach (sus equipos), owner/admin/school_admin (todos). Alcance de escritura por `user_staff_school_ids()` + asignación del coach al equipo. Nunca `user_school_ids()` (incluye padres).

**Flujo:**
1. En Asistencia → **"Subir planilla"**: elige equipo y mes, toma o sube 1..N fotos (las hojas de 2 páginas son comunes).
2. BFF `POST /api/v1/attendance/sheet-imports` guarda las fotos en Storage (`attendance-sheets/<school>/<import>/`) **antes** del OCR (misma regla que la cola de comprobantes).
3. `attendance-sheet-ocr.service.ts`: prompt + schema propio `{ dias[], filas[{nombre, marcas{dia: sigla}}], confianza }`, con el mismo encadenamiento de proveedores.
4. Coincidencia contra el roster activo del equipo: normalizar (sin tildes, minúsculas), tokens, puntaje; estados `exacto | probable | ambiguo | nuevo`.
5. **Pantalla de revisión:** grilla atleta × día ya llena, celdas dudosas resaltadas, días editables, foto al lado con zoom. La leyenda de la escuela traduce siglas a `present | absent | late | excused`. Las siglas sin traducción **bloquean el guardado** hasta que se elijan.
6. **Aplicar** → RPC transaccional `apply_attendance_sheet_import(p_import_id, p_rows jsonb)` (`SECURITY DEFINER`, `SET search_path = pg_catalog, public, pg_temp`, `GRANT EXECUTE … TO authenticated`, revocar de `anon`): crea las sesiones que falten y los registros en una sola transacción, `check_in_method = 'manual'` y nota con el id del import.

**Esquema nuevo:**
- `attendance_sheet_imports` (`school_id`, `team_id`, `period_year/month`, `status text CHECK (uploaded|extracted|in_review|applied|rejected)`, `photos text[]`, `extracted jsonb`, `applied_rows jsonb`, `created_by`, `applied_by` → `profiles`). RLS lectura/escritura por staff; sin `FOR ALL` sin `WITH CHECK`.
- `school_settings.attendance_sheet_legend jsonb` — `{ "✓": "present", "X": "present", "R": "excused", … }`.

**Decisión de producto pendiente (D1):** ¿una planilla subida **descuenta clases** del plan?
- Propuesta: **sesiones de semanas pasadas se crean ya finalizadas y no descuentan ni avisan** (son historia). Hoy los descuentos y el aviso post-entrenamiento se disparan al pasar `finalized` de false a true (`trg_deduct_sessions_on_finalize`, `trg_post_training_notify`), así que una sesión vieja cargada sin finalizar sería finalizada por el cierre diario y mandaría avisos de hace un mes.
- **Semana en curso:** pasa por la misma lógica de `POST /session` (extraída a un servicio, ver `asistencia-rapida-checkin.md` v1.3), para heredar créditos, reservas y `avisarHitoDePlan`.

**Fase 2 de F1:** entrada por WhatsApp. El coach manda la foto al número de la escuela; `wa_identify_staff_admin_by_phone` hoy excluye a los coaches, así que hay que ampliarlo con rol `coach`, solo para asistencia. La foto cae en el mismo `attendance_sheet_imports` y se revisa en la app.

## 3. F2 — Matrícula por foto desde la app

Hoy solo entra por WhatsApp y solo desde el número de un admin. La dueña de Dynasty **no puede** mandársela al número de la escuela, porque ese número es ella misma, y los coaches no están habilitados.

1. Botón **"Subir hoja de matrícula"** en `/school/enrollment-intake` (cámara o archivo).
2. BFF `POST /api/v1/enrollment-intake/upload` → Storage `identity-documents/enrollment_intake/` (path y policies ya existen) → `extractEnrollmentForm` → mismo `encolarMatricula`. Esto obliga a **extraer `encolarMatricula` del worker de WhatsApp a un servicio compartido**; hoy vive dentro de `whatsapp-queue.job.ts`.
3. Verificar que `enrollment_form_intake.integration_id` / `wa_message_id` / `media_id` admitan NULL; si no, migración nueva.
4. La aprobación sigue llamando a `POST /students/create-one` y hereda duplicados y la guardia de mayor de edad.

**D2:** ¿pueden subir matrículas los coaches, o solo admin? Propuesta: coach **sube**, admin **aprueba**.

## 4. F3 — El acudiente registra todo desde la app

El QR ya crea cuenta + atleta + inscripción. Le falta lo que hoy va en la hoja de papel:

| Campo de la hoja | Columna | Hoy en el QR |
|---|---|---|
| Nombre, documento, fecha de nacimiento, género | `children.*` | sí |
| RH | `children.blood_type` | **no** |
| EPS | `children.eps_name` | **no** |
| Foto del documento | `children.id_document_url` | **no** |
| Información médica / alergias | `children.medical_info` | **no** |
| Contacto de emergencia | `children.emergency_contact` | **no** |
| Documento del acudiente | — (falta) | **no** |
| Aceptación de reglamento + tratamiento de datos de menores | — (falta) | **no** |

**Diseño:**
- **No** agrandar `submit_qr_signup` (13 args, dos sobrecargas vivas, una con `EXECUTE` a PUBLIC). Se agrega un **paso 2** "Completa la ficha" con su propia RPC `complete_athlete_profile(p_child_id, p_data jsonb)`, `SECURITY DEFINER`, que valida `children.parent_id = auth.uid()`.
- Consentimiento: tabla `athlete_consents` (`child_id`, `school_id`, `consent_type text CHECK`, `version`, `accepted_by`, `accepted_at`, `ip`, `user_agent`). Texto versionado por escuela. Es requisito de habeas data para menores, no adorno.
- El mismo paso 2 se ofrece a quien entra por **invitación** (148 de 157 familias sin cuenta de Dynasty ya tienen una) y desde "Mis hijos" para fichas incompletas.
- Salida: **PDF de la ficha ya llena** con el motor de documentos existente (idea §7 de `alta-atleta-por-foto-hoja-matricula.md`). La escuela imprime y archiva sin transcribir nada.

**D3:** ¿qué campos son obligatorios para Dynasty? Pedir la hoja de matrícula en blanco.

## 5. Orden propuesto

1. **F2** (chica: reutiliza todo, desbloquea a la dueña hoy).
2. **F1** backend + revisión (la usan cada semana; las fotos de septiembre son el test de aceptación: el cruce manual sacó 1.374 presentes).
3. **F3** paso 2 + consentimientos.
4. F1 por WhatsApp para coaches.

Cada fase en su rama, con revisión entre fases. Antes de cerrar cualquier fase que toque RLS: `npm run seguridad:invariantes`.

## 6. Preguntas para la escuela (bloquean F1 y F3)

1. ¿Qué significan X, R, VR, ✓R en la asistencia? ¿El grupo Infantil Masculino marca con X a quien **vino**?
2. ¿Los coaches deben poder subir planillas y matrículas, o solo la dueña?
3. Hoja de matrícula en blanco, para fijar los campos obligatorios y el texto del consentimiento.
