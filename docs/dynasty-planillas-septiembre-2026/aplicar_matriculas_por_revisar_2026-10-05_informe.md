# Planillas sep-2026: atletas que no estaban en la app, a "Matrículas por revisar"

Fecha: 2026-10-05. Escuela: DYNASTY VOLLEY CLUB (`2d509571-3238-4c04-ac3f-6dfe20539226`).
Origen: pregunta 9 de `preguntas-para-milena.md`. Milena respondió: **"crearlos y dejarlos en matrículas por revisar"**.
SQL: `aplicar_matriculas_por_revisar_2026-10-05.sql`. **No está aplicado.** Hay que correrlo en el SQL Editor.

## Resumen

| | Cuántos |
|---|---|
| Nombres de la P9 | 13 (14 personas, porque "Sáenz Rojas" son dos: Ana María y Sofía) |
| **Ya estaban en la app** (no se crean) | 3: Fontecha "Maleja", Pardo "Malu" y Garzón Jaraiba Emanuel |
| **Ya tiene cuenta propia** (no va por la bandeja) | 1: Trejos Lizeth |
| **Fichas que se crean** en la bandeja | 10 (9 nuevas + 1 marcada como probable duplicado: Niño Daniel) |
| Extra que no estaba en la P9 | Garzón Jaraiba **María Sofía** = María Sofía Cañón Loaiza (ya existe y septiembre ya está pagado) |

## 1. Búsqueda antes de crear

Se buscó de nuevo cada nombre en la base viva, solo con SELECT, por cuatro vías:

- **Búsqueda difusa** con `unaccent` + regex por apellido, nombre y apodo (`maleja` → María Alejandra, `malu` → María Luisa, `tanya|tania`, `trejo`, `jaraib|jaraiz`, etc.).
- **Similitud por trigramas** (`word_similarity`), los 4 mejores por nombre.
- **Fuentes revisadas:** `children` (con `school_id` de Dynasty o con alguna inscripción en Dynasty), `unregistered_athletes`, `profiles` (miembros y atletas de Dynasty), inactivos e inscripciones canceladas incluidos. También `invitations.child_name`, `school_signup_leads`, `enrollment_form_intake` y, para los apellidos raros, **toda la plataforma**.
- **Cruce de cobros** de ago/sep/oct de cada candidato contra fecha y monto de la planilla.

### Coincidencias encontradas

| Planilla | En la app | Evidencia | Decisión |
|---|---|---|---|
| Fontecha "Maleja" (Infantil Fem., $150.000, 04-sep, Llave) | **MARIA ALEJANDRA FONTECHA GONZALEZ** (`0d6048f5…`), INFANTIL FEMENINO, activa | Maleja = María Alejandra. Su cobro de septiembre ya está **pagado el 04-sep, $150.000**: misma fecha y mismo monto. | **No se crea.** No hay nada pendiente. (Agosto sí sigue `overdue`, pero no viene de esta planilla.) |
| Pardo "Malu" (Seniors, $130.000, 03-sep, QR) | **MARIA LUISA PARDO RODRIGUEZ** (`0c0e6c1e…`), SENIORS, activa | Malu = María Luisa. En la misma hoja, la fila 25 tiene su nombre completo tachado. Septiembre ya está **pagado ($130.000, 10-sep)**. | **No se crea.** |
| Garzón Jaraiba Emanuel (img 26, $150.000, 18-sep, BC) | **Emmanuel Cañón Loaiza** (`3c4eb323…`), MINIVOLLEY BENJAMINES, activo | En el manuscrito se leyó "Caron/Garzon Jodiba/Jaraiba", que es **Cañón Loaiza**. Septiembre ya está **pagado el 18-sep, $150.000**: misma fecha y mismo monto. La hermana (fila 11, "Garzón Jaraiba María Sofía") es **MARIA SOFIA CAÑON LOAIZA** (`930853a5…`), también pagada el 18-sep. | **No se crea ninguno.** Ojo: la img 30, fila 46, trae "Emmanuel Garzon Jaraiza" con $150.000 el 20-sep. Puede ser una anotación duplicada o el pago de octubre; octubre sigue `pending`. Hay que preguntarle a Milena. |
| Trejos Lizeth (Seniors, $150.000, 15-sep, BC) | **Perfil propio "Lizeth Natalia Trejos Sánchez"** (`fe8abb08…`, rol athlete, `lizethtrejos@hotmail.com`, +573002656343, nacida 2000-10-03), creado el 21-sep **sin ninguna escuela**: no tiene membresía, inscripción ni cobros | Se autorregistró después de pagar. También aparece en la asistencia de Seniors (img 2, "Jiced Trejos Lizeth"). | **No va por la bandeja.** El botón "Crear atleta" haría un `unregistered_athletes` nuevo, o sea, una **segunda identidad** de la misma persona (el patrón de DAIMARIS). Hay que inscribirla desde el alta manual como **"atleta que ya tiene cuenta"** (`adult_existing` de `students/create-one`) con su correo y después registrar los $150.000 de septiembre. |
| Niño Daniel (Menores Masc., $300.000 = "2 MESES", 21-sep, BC) | **Probable: JULIAN DAVID NIÑO RAMIREZ** (`640d1ee2…`), MENORES MASCULINO, activo | Es el único Niño de la escuela y está en el mismo grupo de la hoja. Tiene **agosto y septiembre vencidos**, justo los "2 meses". Pero la cuota es de $180.000 (2 × 180.000 = $360.000, no $300.000) y la planilla dice "Daniel", no "David". Debajo del nombre hay una palabra borrada que empieza con "Ret…". | **Ficha creada con `duplicate_of_child_id` = Julián David.** La pantalla muestra "Ya existe: JULIAN DAVID NIÑO RAMIREZ" y ofrece **Vincular** o **Descartar**. Milena decide. |

### Candidatos débiles descartados (no son la misma persona)

- **Zorro Juan Andrés** frente a JUAN ANDRES APARICIO ROMERO (Infantil Masc.): solo coincide el nombre de pila. Aparicio pagó septiembre el 01-oct y la planilla dice 11-sep por QR. No hay ningún "Zorro" en Dynasty; el único Zorro de la plataforma está en otra escuela. Se crea.
- **Peña Samuel**: en la escuela no hay ningún Samuel Peña. Los Peña de Menores Masculino son Juan José Peña (cuota $210.000, septiembre vencido) y Pablo Andrés Peña Villalba ($150.000, vencido), y ninguno se llama Samuel. El "Samuel Peña" de `unregistered_athletes` es de *Academia Fútbol Demo*. Se crea con el nombre marcado como dudoso.
- **Tanya Díaz**: Tania Isabella Navarro Farfán es de Menores Femenino, no de Seniors, y el apellido no coincide. Se crea con el nombre marcado como dudoso.
- **Calderón López Mathias, Cucunubá Luciana, Gómez Juan Fernando, Sáenz Rojas (×2), Sierra Fuentes Antonella**: sin coincidencias de apellido en Dynasty ni en el resto de la plataforma. Se crean.

## 2. Cómo es la cola "Matrículas por revisar"

- **Tabla:** `public.enrollment_form_intake`. **Estado:** `waiting_review`. El CHECK admite `pending|processing|waiting_review|approved|rejected|failed`. `pending` y `processing` son estados del OCR de WhatsApp; la bandeja lista solo `waiting_review`.
- **Backend:** `GET /api/v1/enrollment-intake`, en `bff/src/routes/enrollment-intake.routes.ts`, filtra por `school_id` y `status='waiting_review'`. Firma la foto solo si hay `storage_path`; sin foto devuelve `photoUrl: null` y la tarjeta se ve sin imagen, sin error.
- **Pantalla:** `/school/enrollment-intake`, en `frontend/src/pages/school/EnrollmentIntakeInboxPage.tsx`, menú "Matrículas por revisar".
- **CHECK de origen** (`chk_enrollment_intake_origen_coherente`): con `source='app'` exige `uploaded_by IS NOT NULL`. Se usa **Milena** (`73adf4ca-51f5-4f4a-a6ca-1973c84e8151`, owner, verificado en `profiles`). Las columnas de WhatsApp quedan NULL; con `source='app'` está permitido.
- **NOT NULL:** `id`, `school_id`, `status`, `source`, `created_at` y `updated_at`, todas con default salvo `school_id`. Documento, acudiente y foto **son opcionales en la tabla**, así que no hace falta inventar nada.
- **Triggers:** solo `set_updated_at` en UPDATE. El INSERT no dispara nada y el worker de WhatsApp no toca filas en `waiting_review`.
- **Estado actual:** Dynasty no tenía ninguna ficha. En toda la base hay 4, todas de WhatsApp.

### Qué va en cada ficha

- `extracted.athleteFullName`: el nombre en orden natural (nombre y apellidos), porque es lo que "Crear atleta" guarda como `full_name`.
- `extracted.category`: es **el único texto libre que la pantalla muestra** ("Categoría en la hoja: …"). Ahí va el grupo, el pago anotado y la instrucción. Ejemplo:
  `MENORES MASCULINO · Planilla papel sep-2026: pagó $300.000 el 21-09-2026 (BC) = 2 MESES. Al crear: asignar equipo/plan y REGISTRAR ESE PAGO (no pedir comprobante). PROBABLE: es JULIAN DAVID NIÑO RAMIREZ…`
- `extracted.missingFields`: documento, tipo de documento, fecha de nacimiento, acudiente (nombre, correo y teléfono), EPS y RH. La pantalla los resalta en ámbar.
- Trazabilidad que no se muestra: `origen = 'planilla papel sep-2026'`, `planilla{imagen, fila, grupo_hoja, grupo_probable, valor, fecha_pago, medio, meses, nota}`, `observaciones`, `autorizado_por` y `provider = 'planilla-papel-manual'`.
- **Sin** child, inscripción ni cobro.

## 3. Las 10 fichas que se crean

| # | Atleta (ficha) | Grupo probable | Pago en planilla | Observación |
|---|---|---|---|---|
| 1 | Mathias Calderón López | INFANTIL MASCULINO | $210.000 · 03-sep · Datáfono | Está en la asistencia de Infantil Masc. $210.000 es más que la cuota habitual; hay que confirmar el plan. |
| 2 | Luciana Cucunubá | INFANTIL FEMENINO | $150.000 · 30-ago · BC | Anotado "INCAP." (incapacidad). Falta confirmar si el pago de agosto es de septiembre. |
| 3 | Tanya Díaz | SENIORS | $130.000 · 16-sep · BC | Nombre dudoso (se lee "Ranyd Draz"). **Probablemente mayor de edad** (ver §5). |
| 4 | Samuel Peña | MENORES MASCULINO | $100.000 · 20-sep · BC | Nombre ("Peña Jamuel") y monto dudosos. |
| 5 | Daniel Niño | MENORES MASCULINO | **$300.000 · 21-sep · BC = 2 meses** | **Probable Julián David Niño Ramírez.** Ficha con `duplicate_of_child_id`. |
| 6 | Juan Fernando Gómez | MINIVOLLEY BENJAMINES | $150.000 · 31-ago · BC | Sigla "NP" sin interpretar. |
| 7 | Juan Andrés Zorro | INFANTIL MASCULINO (inferido) | $150.000 · 11-sep · QR | También en asistencia (img 32). |
| 8 | Ana María Sáenz Rojas | MINIVOLLEY BENJAMINES (inferido) | $150.000 · 05-sep · Efectivo | Probable hermana de #9. |
| 9 | Sofía Sáenz Rojas | MINIVOLLEY BENJAMINES (inferido) | $150.000 · 05-sep · Efectivo | Probable hermana de #8. |
| 10 | Antonella Sierra Fuentes | MINIVOLLEY BENJAMINES (inferido) | $90.000 · 23-sep · BC | Monto menor a la cuota: ¿abono o tarifa especial? |

El grupo de la img 26 está inferido: 8 de los 10 atletas de esa hoja que sí se encontraron son de MINIVOLLEY BENJAMINES.

Total anotado en las fichas: **$1.580.000**. No se escribió ningún `payments`. Al confirmar cada ficha, la escuela registra el pago por el camino normal. Regla de Dynasty: si está en la planilla, está pagado; no se pide comprobante.

## 4. Verificación hecha (solo lectura)

- Columnas, NOT NULL, CHECKs, FKs y triggers de `enrollment_form_intake` consultados en la base viva (detalle en §2).
- Corrí el SELECT del script sin el INSERT. Salen las 10 filas; el CHECK de origen y el de estado se cumplen; existe el `uploaded_by` en `profiles`; existe el `duplicate_of_child_id` en `children` de Dynasty; y ninguna de las tres guardas NOT EXISTS bloquea (no hay fichas previas ni un nombre normalizado idéntico en `children` o `unregistered_athletes`).
- `EXPLAIN` del INSERT completo: compila y planifica sin errores. `extensions.unaccent` resuelve.
- Idempotencia: el script no inserta si ya hay una ficha de Dynasty con `extracted->>'origen' = 'planilla papel sep-2026'` y el mismo nombre normalizado, en cualquier estado. Así que **re-ejecutarlo no duplica**, aunque la ficha ya se haya aprobado o descartado. Además no inserta si el nombre exacto ya existe en `children` o `unregistered_athletes` de la escuela.
- El script trae al final una reversa comentada: borra solo las fichas de este origen que sigan en `waiting_review`.

## 5. Límites de la pantalla que hay que conocer antes de confirmar

1. **"Crear atleta" no inscribe ni cobra.** Llama a `students/create-one` sin `team_id` ni plan, así que crea el atleta **sin inscripción y sin cobro**. Después hay que asignarle equipo y plan y **registrar el pago de la planilla** como pago de septiembre (o de los meses que correspondan). Ojo con el alta: si al inscribirlo se genera el cobro de septiembre más la inscripción, marcar como pagado el de septiembre con el monto del papel y no sumar la inscripción, que es un cobro distinto.
2. **Para un menor, el botón exige** documento y el correo y teléfono del acudiente. Sin eso queda deshabilitado. Es lo esperado: la escuela completa esos datos.
3. **Mayor de edad (Tanya Díaz, Seniors).** La tarjeta decide si es adulto con la fecha de nacimiento **que vino en la ficha**, no con la que se escribe en el formulario. Como la ficha no trae fecha, la tarjeta la trata como menor. Si Milena escribe una fecha adulta, `create-one` responde 409 "es mayor de edad", y si la deja vacía la crea como menor con un acudiente ficticio (justo lo que el código intenta evitar). Para Tanya: **Descartar** la ficha y darla de alta desde el alta manual como atleta adulta. Arreglo sugerido en el frontend (fuera de este entregable): que `esMayorDeEdad` use `form.dateOfBirth`.
4. **Niño Daniel:** con `duplicate_of_child_id` puesto, "Crear atleta" queda deshabilitado y la tarjeta ofrece **Vincular** a Julián David. Vincular solo completa campos vacíos y cierra la ficha; **no registra el pago**, eso se hace aparte. Si no es él, se descarta y se crea por el alta manual.
5. Las fichas no tienen foto (`photoUrl` nulo). La tarjeta se ve sin imagen y con la etiqueta "Subida en la app".

## 6. Pendiente para Milena

- **Niño Daniel:** ¿es Julián David Niño Ramírez? Si sí, ¿los $300.000 cubren agosto y septiembre (la cuota es de $180.000)? ¿Y la palabra "Ret…"?
- **Emmanuel Cañón Loaiza:** ¿la segunda anotación, del 20-sep en la img 30, es el pago de octubre o la misma de septiembre repetida?
- **Lizeth Trejos:** inscribirla con su cuenta (`lizethtrejos@hotmail.com`) y registrar septiembre ($150.000, 15-sep).
- Confirmar nombre o monto dudosos de: Tanya Díaz, Samuel Peña, Antonella Sierra Fuentes ($90.000), Mathias Calderón ($210.000), y los pagos con fecha de agosto (Cucunubá 30-ago, Gómez 31-ago).
