# Spec — Documentos y firmas para todas las escuelas (ROADMAP #30)

**Versión:** 0.1 · **Fecha:** 2026-10-23 · **Estado:** borrador para revisión del usuario · **Dueño:** producto
**Origen:** pedido del 2026-10-23: «cargar todos los soportes que tiene Monster desde la app, para todas las escuelas, y después firmarlos o una firma aparte».
**Relacionado:** ROADMAP v2.38 #30 · memorias `project_multirol_multisede_f1_2026_10_15` (diseño preliminar de firma) y `project_monster_volley_categorias_roles` · `docs/specs/alta-atleta-por-foto-hoja-matricula.md` · patrón de enlace público `payment_public_tokens`.

> Los supuestos marcados **A CONFIRMAR** son valores por defecto que se usan para diseñar. No se construye nada que dependa de ellos sin que el usuario los confirme (§12).

---

## 1. Problema

Hoy hay **dos caminos de documentos que no se parecen y ninguno sirve para todas las escuelas**:

| | Familia | Escuela |
|---|---|---|
| Pantalla | «Mis hijos» → `UploadChildDocumentsDialog` | Ficha del deportista (`SchoolStudentsManagementPage`) |
| Tipos | **2**: documento de identidad y EPS | **10** (los de Monster) |
| Dónde queda | Solo en el almacenamiento (`identity-documents`, ruta `children/<padre>/<hijo>/docs/`, el tipo se deduce del prefijo del nombre del archivo). **No hay fila en la base** | Tabla `athlete_documents` |
| Quién escribe | El acudiente de ese hijo | Solo `is_school_admin()` (owner, admin, super_admin) |

**Línea base medida el 2026-10-23 (consultas puntuales):**
- `athlete_documents`: **1.009 documentos, 144 deportistas, 1 escuela de 371** (Monster). El 100 % cuelga de **fichas sin cuenta** (`unregistered_athlete_id`): 0 en hijos con cuenta, 0 en adultos con cuenta.
- **0 verificados** y **0 con autor** (`uploaded_by` nulo en todos: se cargaron por script, no desde la app).
- Completitud sobre los 7 tipos que pide el formulario real de Monster: **124 de 144 completos**, 19 con 4 a 6 y 1 con 3 o menos.
- **Ninguna de las 144 fichas de Monster está vinculada a una cuenta de familia** (0 de 144): las familias todavía no pueden ver ni completar nada.
- Lado familia: **70 archivos de 42 padres** en el almacenamiento, sin ninguna fila que los relacione con un tipo, una escuela o una verificación; la escuela no los ve.
- **Las firmas no son firmas.** `guardian_signature` y `athlete_signature` son una imagen subida (foto de una firma en papel). No guardan fecha, texto aceptado, dispositivo ni nada que sirva como evidencia. No existe `document_templates`, `signature_requests` ni `signature_events`.
- Los tipos están fijos en un `CHECK` de la base: ninguna otra escuela puede pedir otros documentos ni marcar cuáles son obligatorios.
- No hay vencimientos (el EPS se vence cada año), ni lista de faltantes, ni aviso a la familia.

## 2. Objetivo

Que **cualquier escuela** defina qué documentos pide, que **la familia (o el atleta adulto) los suba y firme desde la app**, y que **la escuela los revise** con una lista clara de lo que falta, **con evidencia suficiente** para sostener una firma electrónica simple.

Resultado esperado: una familia sin cuenta de contador ni de abogado completa su carpeta desde el celular en menos de 5 minutos y la escuela sabe, sin preguntar, quién está completo.

## 3. Alcance

**Dentro:**
- Catálogo de requisitos configurable por escuela (§5).
- Subida desde la app por familia y por la escuela, unificada en `athlete_documents` (§6, §7).
- Estados, verificación, rechazo con motivo, reemplazo y vencimientos (§8).
- Firma aparte en pantalla y firma de un documento por enlace de un solo uso, con evidencia y PDF sellado (§9).
- Avisos por WhatsApp y correo (§10).
- Migración de los 1.009 documentos de Monster y de los 70 archivos de familias sin pérdida (§13).
- Auditoría de seguridad y pruebas (§14).

**Fuera de alcance (por ahora):**
- Firma electrónica avanzada o certificada (firma digital con entidad de certificación, Ley 527 con certificado). Se deja la puerta abierta con OTP opcional (§9.3).
- Lectura automática (OCR) del contenido de los documentos. Hoy solo se archivan y se verifican a ojo.
- Validación contra registros oficiales (Registraduría, ADRES).
- Plantillas legales redactadas por SportMaps: la escuela sube su propio texto. SportMaps solo ofrece un ejemplo editable.
- Documentos de entrenadores y de torneos (`coach-certificates`, `EventDocumentsTab`): siguen como están. Se revisa después si conviene unificar.
- Cobro por almacenamiento.

## 4. Roles y qué hace cada uno

| Rol | Puede |
|---|---|
| **Acudiente** | Ver los requisitos de la escuela de cada hijo. Subir, reemplazar y borrar **sus propios** documentos pendientes o rechazados. Firmar como acudiente. Ver el estado. No ve documentos de otras familias. |
| **Atleta adulto** | Lo mismo, sobre sí mismo. Firma por sí mismo. |
| **Atleta menor** | **A CONFIRMAR:** no sube ni firma por sí mismo; lo hace su acudiente. Si la escuela lo exige (por ejemplo Monster pide «firma del deportista»), el acudiente carga o firma esa casilla y queda registrado quién lo hizo. |
| **Coach** | Ver el estado de **sus** equipos («faltan documentos» sí, el contenido no). **No** descarga documentos de identidad ni de salud. Solo si la escuela lo habilita por equipo (decisión de la escuela, apagado por defecto). |
| **Admin / owner de la escuela** | Configurar el catálogo, subir por la familia, verificar o rechazar, descargar, ver evidencias de firma, generar solicitudes de firma, exportar. `owner` y `admin`; la regla de «otorgar permisos no se delega» no aplica aquí porque no se otorgan permisos. |
| **Staff** (rol `staff`) | Ver el estado y subir por la familia; no verifica ni descarga identidad. |
| **Plataforma (super_admin)** | Soporte con auditoría; no usa documentos en su operación normal. |

Reglas transversales: cada acceso a un archivo pasa por una URL firmada de corta duración y deja registro (§14). La familia **nunca** lista el almacenamiento: se lee por filas de base.

## 5. Catálogo de requisitos por escuela

Cada escuela tiene una lista de **requisitos**. Un requisito es: *qué se pide, a quién aplica, si es obligatorio y si lleva firma*.

**Campos de un requisito (diseño de datos propuesto, ver §11):**
- `clave` (texto estable, por ejemplo `eps_certificate`) y `etiqueta` visible (editable).
- `aplica_a`: `deportista` o `acudiente`. Esto decide de quién es el documento y quién lo firma.
- `obligatorio`: sí o no.
- `requiere_firma`: ninguna, `firma_aparte` o `firma_en_documento` (§9).
- `vence_en_meses` (opcional; EPS = 12) y `aviso_antes_dias`.
- `solo_menores` / `solo_adultos` (por ejemplo la cédula del acudiente solo aplica a menores).
- `formatos` permitidos (imagen o PDF) y tamaño máximo.
- `orden` y `activo`.

**Catálogo por defecto (los 10 tipos de hoy, copiados a cada escuela al activarse):**

| Clave | Etiqueta | Aplica a | Obligatorio por defecto | Vence |
|---|---|---|---|---|
| `athlete_photo` | Foto del deportista | deportista | Sí | — |
| `eps_certificate` | Certificado EPS | deportista | Sí | 12 meses |
| `athlete_id_front` | Documento del deportista (frente) | deportista | Sí | — |
| `athlete_id_back` | Documento del deportista (reverso) | deportista | No | — |
| `guardian_id_front` | Documento del acudiente (frente) | acudiente | Sí, solo menores | — |
| `guardian_id_back` | Documento del acudiente (reverso) | acudiente | No | — |
| `guardian_signature` | Firma del acudiente | acudiente | Sí, solo menores | — |
| `athlete_signature` | Firma del deportista | deportista | Según la escuela | — |
| `good_standing_certificate` | Paz y salvo | deportista | Según la escuela | — |
| `other` | Otro documento | deportista | No | — |

**Escuelas existentes:** Monster queda con **exactamente los 7 obligatorios que pide hoy** (foto, EPS, documento del deportista, documento del acudiente, firma del acudiente, firma del deportista, paz y salvo) y los otros 3 como opcionales. El resto de escuelas arranca con foto, EPS y documento del deportista como obligatorios; cada una cambia lo que quiera. **A CONFIRMAR:** configurable por escuela desde el primer día (recomendado; el costo ahora es bajo y después es alto).

Un requisito **personalizado** (por ejemplo «Autorización de viaje», «Contrato de matrícula») se crea con una clave generada y no necesita tocar el `CHECK` de la base: el `CHECK` fijo se reemplaza por una referencia al catálogo de la escuela.

## 6. Flujo de la familia

Principios V2 que aplican: **una frase y un botón**, lo normal ya viene marcado, deshacer en vez de «¿Seguro?», celular primero, palabras de la cancha.

1. **Entrada.** «Mis hijos» muestra por cada hijo una barra: «**Faltan 3 de 7 documentos**». Un botón: «Completar ahora». Si todo está al día: «Documentos al día» y el botón desaparece.
2. **Consentimiento de datos (una sola vez por persona y escuela).** Antes de la **primera** subida se muestra el texto de tratamiento de datos de la escuela y SportMaps (A CONFIRMAR, §12.4). Se guarda quién aceptó, cuándo y qué versión del texto.
3. **Lista de pendientes.** Una tarjeta por requisito: nombre, ejemplo corto («foto del carnet de la EPS, vigente»), estado (§8). Un solo botón por tarjeta: «Subir» (cámara o archivo). Las tarjetas se ordenan: rechazados, faltantes, por vencer, hechos.
4. **Subir.** Cámara del celular o archivo. La imagen se comprime en el dispositivo (ya existe `comprimirParaSubir`). Vista previa y «Usar esta foto» / «Tomar otra». Sube y queda **«En revisión»**.
5. **Reemplazar.** Mientras el documento esté en revisión, rechazado o vencido, «Reemplazar» sube otro y guarda el anterior como versión anterior. **Un documento verificado no lo reemplaza la familia**: la escuela lo devuelve a «Rechazado» o la familia pide cambio (A CONFIRMAR).
6. **Rechazo.** Si la escuela rechaza, la tarjeta pasa a «Hay que volver a subirlo» con el motivo escrito por la escuela («la foto sale borrosa»).
7. **Firmar.** Las tarjetas con firma muestran «Firmar» (§9). La familia nunca ve ni firma documentos de otra persona.
8. **Sin cuenta todavía.** Mientras la ficha no esté vinculada a una familia (hoy las 144 de Monster), la escuela puede **enviar un enlace de un solo uso** para completar la carpeta sin registrarse, con el mismo patrón de `payment_public_tokens`. Eso evita depender de que la familia cree cuenta (§9.2).
9. **Deshacer.** Cualquier subida o borrado tiene «Deshacer» durante 8 segundos (patrón V2-0c compartido).

## 7. Flujo de la escuela

1. **Configuración.** «Configuración → Documentos»: lista de requisitos con interruptores (obligatorio, requiere firma, vence en N meses) y botón «Agregar documento». Los cambios solo afectan hacia adelante; quitar un requisito obligatorio no borra lo subido.
2. **Bandeja «Documentos».** Filtros: por equipo, por estado, «faltan documentos», «por vencer en 30 días». Una fila por deportista: foto, nombre, «5 de 7», semáforo. Acción en lote: «Avisar a quienes faltan» (§10).
3. **Revisar.** Vista del documento con zoom. Dos botones: «Verificar» y «Rechazar». Rechazar pide el motivo (lista de motivos rápidos más texto libre). Todo queda con quién, cuándo y desde dónde.
4. **Subir por la familia.** El admin puede subir en nombre de la familia (hoy es lo único que puede hacer); queda marcado «subido por la escuela».
5. **Descargar.** Un documento o toda la carpeta del deportista en un solo PDF o ZIP. Cada descarga queda registrada.
6. **Vencimientos.** El EPS vence a los 12 meses desde la fecha de emisión o de subida (A CONFIRMAR cuál). Al vencer pasa a «Vencido» y la familia recibe aviso. Se ven en un tablero «Por vencer».
7. **Evidencia de firma.** En cada firma, un panel: quién firmó, fecha y hora (Colombia), texto aceptado, dispositivo, dirección de red y huella (hash) del documento firmado.
8. **Exportar.** Reporte para auditorías (qué tiene cada deportista y desde cuándo). **No** exporta los archivos de identidad de menores sin un permiso explícito y registro.

## 8. Estados de un documento

```
(sin subir) → en_revision → verificado
                  │              │
                  ├→ rechazado ──┘ (la familia vuelve a subir → en_revision)
                  └→ vencido     (verificado o en_revision cuyo vencimiento ya pasó)
```

| Estado | Significado | Quién lo cambia |
|---|---|---|
| `faltante` | El requisito aplica y no hay archivo | calculado |
| `en_revision` | Subido, la escuela aún no lo mira | familia o escuela al subir |
| `verificado` | La escuela lo revisó y está bien | admin, con fecha y autor |
| `rechazado` | La escuela pide otro, con motivo | admin |
| `vencido` | Pasó su vigencia | calculado (tarea diaria) |
| `no_aplica` | El requisito no aplica a esta persona (por ejemplo cédula del acudiente a un adulto) | calculado |

Reglas: un documento rechazado o vencido **no cuenta** para «completo». «Completo» = todos los requisitos obligatorios aplicables en `en_revision` o `verificado` (A CONFIRMAR si «completo» exige `verificado`; recomendado: `en_revision` cuenta como entregado y `verificado` como cerrado, y se muestran las dos cifras).

## 9. Firmas

Hay dos formas de firmar, porque la escuela y la familia las necesitan en situaciones distintas.

### 9.1 Firma aparte (en pantalla)

Para requisitos como «Firma del acudiente» o «Firma del deportista» que hoy son una foto.

- Lienzo táctil (dedo o ratón) con «Borrar» y «Firmar». Por debajo, el texto que la persona **acepta** al firmar (lo define la escuela; por defecto: «Acepto el reglamento y autorizo el tratamiento de datos de [nombre del deportista]»).
- Se guarda la imagen de la firma **y** un registro de evidencia: persona, rol (acudiente o deportista), escuela, deportista, fecha y hora, texto exacto aceptado y su versión, dirección de red, agente de navegador y huella (hash) de la imagen.
- Una firma queda **inmutable**. Cambiarla crea una nueva y conserva la anterior.
- Si la escuela ya tiene la firma en papel escaneada (como Monster hoy), el admin puede subirla como «firma escaneada» y queda marcada así: **no** equivale a una firma en pantalla con evidencia.

### 9.2 Firma del documento (enlace de un solo uso)

Para contratos, autorizaciones y consentimientos que la escuela redacta.

1. La escuela sube una **plantilla** (PDF o texto con campos) y la asocia a un requisito con `firma_en_documento`.
2. Para una familia concreta, genera una **solicitud de firma**. El sistema crea un enlace público de **un solo uso** con ficha (token) guardada solo como huella (hash), con vencimiento (por defecto 7 días; A CONFIRMAR) y límite de intentos. Mismo patrón que `payment_public_tokens`.
3. La familia abre `/firma/<token>` **sin iniciar sesión** (por eso sirve a las fichas que aún no tienen cuenta): ve el documento, lee, marca «Leí y acepto», firma en el lienzo y pulsa «Firmar».
4. El sistema **sella** un PDF: documento original + firma + bloque de evidencia (nombre, fecha, red, huella del original) y guarda la huella del PDF sellado. El PDF sellado queda en la carpeta del deportista como documento verificado automáticamente.
5. El enlace se consume y no sirve más. Si vence o falla, la escuela genera otro.
6. **Quién firma:** el acudiente por el menor; el atleta adulto por sí mismo (A CONFIRMAR, §12.2).

### 9.3 Validez y OTP opcional

- **Por defecto (A CONFIRMAR):** firma electrónica simple con evidencia. Es suficiente para reglamentos, autorizaciones y consentimientos usuales.
- **Opcional por escuela:** pedir un **código de un solo uso (OTP)** al celular o al correo antes de firmar, para aumentar el valor probatorio. Se configura por requisito.
- **No cubre:** firma digital certificada. Si una escuela necesita validez frente a terceros (por ejemplo contratos con costo alto), se evalúa un proveedor externo; queda fuera de este alcance.
- La evidencia se conserva mientras exista la relación con la escuela **más** el plazo legal que defina el consentimiento de datos (A CONFIRMAR con el contador y el abogado).

## 10. Avisos

Principio V2: **una frase y un botón**.

| Evento | Canal | Mensaje | Botón |
|---|---|---|---|
| Faltan documentos | WhatsApp (si hay canal) o correo | «A [deportista] le faltan 3 documentos en [escuela].» | «Subirlos» (enlace a la lista) |
| Documento rechazado | WhatsApp o correo | «[Escuela] no pudo aceptar [documento]: [motivo].» | «Volver a subirlo» |
| Por vencer (30 días) | Correo | «El certificado EPS de [deportista] vence el [fecha].» | «Subir el nuevo» |
| Pedir firma | WhatsApp o correo | «[Escuela] te envió [documento] para firmar.» | «Firmar» (enlace de un solo uso) |
| Todo al día | In-app | «Documentos al día» | — |

Reglas: máximo un recordatorio por semana por deportista; **no se escribe a la familia de un deportista dado de baja** (misma regla que `invitaciones-atleta-inactivo`); la escuela puede apagar los avisos automáticos; todo mensaje por WhatsApp respeta las plantillas aprobadas y la ventana de conversación. **Los enlaces de correo y WhatsApp se arman siempre con el origen de producción**, nunca con una variable local (lección del 2026-10-23, `feedback_scripts_correo_frontend_url_localhost`).

## 11. Diseño de datos propuesto (sin código)

Nada de esto se aplica sin plan aprobado. Todo con RLS, funciones `SECURITY DEFINER` con `search_path` fijo y `GRANT EXECUTE` explícito (CLAUDE.md). Los estados y tipos son `text + CHECK`, no `CREATE TYPE`.

- `school_document_requirements`: el catálogo por escuela (campos de §5). Reemplaza el `CHECK` fijo de `athlete_documents.document_type` por una referencia (clave) a este catálogo, validada por trigger y no por un `CHECK`.
- `athlete_documents` (existente): se amplía con `status`, `version`, `reemplaza_a`, `verified_by/at` (ya existen), `rejected_reason`, `expires_at`, `subido_por_rol` (familia, escuela, enlace) y `requirement_id`. Se conservan las tres columnas de sujeto con su `XOR`.
- `document_consents`: consentimiento de datos (persona, escuela, versión del texto, fecha, red).
- `document_templates`: plantillas de firma de la escuela (archivo, versión, requisito).
- `signature_requests`: solicitudes (token **solo como hash**, vencimiento, estado, intentos, quién la creó, para qué deportista y qué plantilla).
- `signature_events`: evidencia inmutable (persona, rol, texto aceptado y su versión, fecha, red, agente, hash del original y del sellado). Sin `UPDATE` ni `DELETE`.
- `document_access_log`: quién abrió o descargó qué y cuándo.

**RLS en palabras:**
- Lectura/escritura de la familia: solo filas cuyo sujeto sea su hijo (`is_parent_of_child`) o ella misma, y solo en estados donde le corresponde escribir. Nunca por `user_school_ids()` (incluye a todos los padres).
- Staff de la escuela: `user_staff_school_ids()` para ver el estado; **descargar identidad y salud** solo `user_admin_school_ids()`.
- Verificar o rechazar: solo administración de la escuela (no delega permisos).
- Todo acceso a un archivo por URL firmada de corta duración desde una RPC que valida el vínculo.
- **No** se usa una policy «por token»: las rutas de enlace público van por RPC `SECURITY DEFINER` que recibe el token, lo compara por hash y consume (trampa 5 del CLAUDE.md).
- `FOR ALL` nunca sin `WITH CHECK`.

**Almacenamiento:** se mantiene el bucket privado `identity-documents`. Las rutas nuevas se organizan por escuela y deportista (`<escuela>/<sujeto>/...`), y las policies de `storage.objects` dejan de depender del `auth.uid()` en un segmento de la ruta del padre, que hoy es lo que obliga a tener esa estructura frágil.

## 12. Decisiones abiertas (A CONFIRMAR)

1. **Validez de la firma:** firma electrónica simple con evidencia por defecto, OTP opcional por escuela (recomendado). ¿Alguna escuela necesita más, por ejemplo con firma certificada?
2. **Quién firma por el menor:** el acudiente (recomendado). ¿Se exige también la firma del deportista menor, como hoy pide Monster?
3. **Quién configura los requisitos:** el dueño de la escuela desde el primer día (recomendado) o fijo con los de Monster hasta que otra escuela lo pida.
4. **Datos sensibles de menores:** ¿se exige que cada familia acepte un texto de tratamiento de datos antes de la primera subida? Recomendado: sí, con versión y fecha. Requiere el texto legal (contador/abogado).
5. **«Completo» cuenta `en_revision` o exige `verificado`:** recomendado, dos cifras visibles (entregado y verificado).
6. **Vencimiento del EPS:** desde la fecha de emisión del documento o desde la subida.
7. **Coach:** ¿ve el estado de documentos de sus equipos? Recomendado sí, sin descargar identidad ni salud.
8. **Retención:** cuánto se conservan evidencias y documentos de un deportista dado de baja.
9. **Enlace sin cuenta:** vencimiento por defecto de 7 días y número máximo de intentos.

## 13. Migración y compatibilidad

- **Monster (1.009 documentos, 144 fichas sin cuenta):** se conservan intactos. Se les asigna `requirement_id` por tipo, `status = verificado` solo si la escuela lo decide (hoy 0 verificados) y `subido_por_rol = escuela`. Ningún archivo se mueve ni se borra.
- **Al vincular una ficha a una cuenta:** los documentos acompañan la ficha (ya lo resuelve `migrate_unregistered_athlete_to_profile`, migración `20261020111530`). Se prueba de nuevo con documentos reales antes de dar por cerrada la fase.
- **Los 70 archivos de familias en el almacenamiento (42 padres):** un script de una sola vez crea la fila en `athlete_documents` con el tipo deducido del prefijo (`identity-` → documento del deportista, `eps-` → EPS), en `en_revision`, sin mover el archivo; los que no se puedan clasificar se dejan como `other`. **Antes de ejecutar:** simulacro con conteo.
- **`UploadChildDocumentsDialog`:** se reemplaza por la nueva pantalla; el diálogo viejo queda como alias hasta que se confirme que nadie lo usa.
- **Las firmas escaneadas existentes** se marcan «firma escaneada», no «firma en pantalla».

## 14. Auditoría y pruebas (obligatorias antes de cerrar cada fase)

**Auditoría de seguridad (al terminar F0, F2 y F3):**
- `npm run seguridad:invariantes` sin violaciones críticas; I1 a I4 revisados sobre las tablas nuevas.
- Lista de **todas** las policies de cada tabla nueva con `pg_policies` (las policies son permisivas y se suman).
- Ninguna tabla nueva legible por `anon`; ninguna RPC nueva ejecutable por `anon`, salvo las dos de la ruta pública de firma, que **no** devuelven datos de identidad.
- `GRANT EXECUTE` explícito por RPC y revocado a `PUBLIC` y `anon` donde corresponda.
- Archivos: bucket privado, URLs firmadas de corta duración, sin listado desde el cliente.
- Tokens: guardados como hash, de un solo uso, con vencimiento y límite de intentos; no aparecen en registros.
- Ley 1581: texto de consentimiento, finalidad, retención y derecho de supresión revisados.

**Pruebas:**
- **Base, con sesiones simuladas dentro de una transacción que se revierte** (`set_config('request.jwt.claims', …)` + `set local role authenticated`): acudiente ve y escribe solo lo suyo; otro acudiente no ve nada; coach sin descarga de identidad; staff sin verificar; admin sí; `anon` nada. Pruebas negativas explícitas (el padre no verifica, no ve el hijo ajeno, no inserta directo).
- **Concurrencia:** dos subidas del mismo requisito a la vez no dejan dos versiones vigentes; un enlace de firma usado dos veces a la vez firma una sola.
- **Firma:** evidencia completa y inmutable; el PDF sellado trae la huella del original; un enlace consumido, vencido o con demasiados intentos responde igual (sin revelar cuál).
- **BFF:** pruebas unitarias de las rutas nuevas y de límites de tasa.
- **Frontend:** `tsc`, eslint y pruebas de los componentes; **e2e en celular** (subir con cámara, reemplazar, firmar) a 360, 768 y 1440 px (`scripts/qa-responsive`).
- **QA real:** con una escuela de prueba y dos cuentas reales (acudiente y admin); lo que toque WhatsApp se prueba con mensajes reales.
- **Migración de datos:** simulacro con conteo antes y después (1.009 y 70).

## 15. Métricas de éxito (con línea base del 2026-10-23)

| Métrica | Línea base | Meta |
|---|---|---|
| Escuelas que pueden pedir documentos desde la app | 1 de 371 (solo Monster, por script) | Todas |
| Documentos subidos desde la app por la familia | **0** (0 de 1.009 con autor) | > 70 % de las fichas con cuenta |
| Tipos que la familia puede subir | 2 | Todos los del catálogo de su escuela |
| Archivos de familias con fila en la base | 0 de 70 | 70 de 70 |
| Carpetas completas en Monster (7 de 7) | 124 de 144 | 144 de 144 en 30 días |
| Documentos verificados | 0 de 1.009 | Los de las carpetas completas |
| Firmas con evidencia | 0 | 100 % de las firmas nuevas |
| Fichas de Monster vinculadas a una familia | 0 de 144 | Medir con la ola de invitaciones |
| Tiempo para completar la carpeta desde el celular | no medido | < 5 min mediana |

Cada fase se cierra con su número «antes y después» tomado de la base viva con consultas puntuales (sin barridos de catálogo: regla de Disk IO).

## 16. Fases

La regla vigente del usuario es **todo de corrido** (base, BFF, frontend y pruebas en una pasada, sin ramas por fase). Las fases ordenan el trabajo y los puntos de auditoría; **se crea una rama por fase solo si el usuario lo pide**. Una sola sesión aplica migraciones; los tipos generados se regeneran una vez al final del lote.

| Fase | Contenido | Se cierra con |
|---|---|---|
| **F0 · Base** | Catálogo por escuela, ampliación de `athlete_documents`, RLS, RPC de lectura y subida, `document_consents`, `document_access_log`. Migración de Monster y de los 70 archivos (simulacro primero) | Auditoría de seguridad F0 + pruebas de sesión simulada |
| **F1 · Subida y revisión** | Pantalla de la familia (lista de pendientes, subir, reemplazar, rechazo), bandeja y revisión de la escuela, configuración de requisitos | e2e en celular + QR real con Monster |
| **F2 · Firma aparte** | Lienzo, `signature_events`, evidencia, firma escaneada marcada, panel de evidencia | Auditoría F2 + pruebas de inmutabilidad |
| **F3 · Firma del documento** | Plantillas, solicitudes, ruta pública `/firma/<token>`, PDF sellado, OTP opcional | Auditoría F3 + prueba de enlace de un solo uso concurrente |
| **F4 · Avisos y tableros** | Avisos por WhatsApp y correo, «por vencer», lote «Avisar a quienes faltan», reporte de auditoría, métricas | Medición contra la línea base |

**Dependencias:** el código de escuela (#29) ayuda a que haya familias con cuenta a quienes pedirles documentos, pero **no bloquea** F0 a F3 porque el enlace de un solo uso sirve a las fichas sin cuenta.

## 17. Criterios de aceptación

- Una escuela nueva, sin intervención de SportMaps, define sus requisitos y los ve reflejados en la pantalla de la familia.
- Una familia con celular sube todos los documentos de su catálogo, ve «faltan N de M» y recibe el motivo de un rechazo.
- Un acudiente **nunca** ve ni descarga documentos de otra familia (prueba negativa verde).
- El coach no descarga identidad ni salud (prueba negativa verde).
- Toda firma nueva guarda su evidencia completa, inmutable, y el PDF sellado trae la huella del original.
- Un enlace de firma sirve **una sola vez**, incluso con dos intentos simultáneos.
- Los 1.009 documentos de Monster y los 70 archivos de familias siguen accesibles tras la migración, con conteo antes y después igual.
- `npm run seguridad:invariantes` sin violaciones críticas y todas las policies de las tablas nuevas listadas y revisadas.
- Ningún mensaje o correo sale con un enlace a `localhost`.
