# Plan de pruebas y auditoría — ROADMAP #29 (código de escuela) y #30 (documentos y firmas)

**Versión:** 0.1 · **Fecha:** 2026-10-23 · **Estado:** plan, sin código · **Rama:** `develop`

Este plan se escribe **antes** de las specs de #29 y #30 para que cada fase nazca con su criterio de aceptación. Manda sobre cualquier «lo probamos después». Reglas del repo que lo condicionan:

- **La base es una sola, compartida con producción** (dev, staging y prod). Ninguna prueba puede dejar filas, usuarios ni archivos. Lo destructivo y lo concurrente se corre en el **gemelo local** (`npm run qa:twin:up` / `qa:twin:seed`, ver `docs/manuales/_src/docker-gemelo/`), no contra la base viva.
- **Una sola sesión aplica migraciones**; los tipos se regeneran una vez, al final del lote (reglas de Disk IO).
- **Plan antes de código en migraciones**, tests de concurrencia en la fase de backend, revisión línea por línea de cada policy.

---

## 0. Cómo se prueba en este repo (y qué se reutiliza)

| Herramienta | Qué prueba | Cómo se usa aquí |
|---|---|---|
| `npm run seguridad:invariantes` (`invariantes_seguridad()`) | Forma de policies y RPC: I1 lectura sin sesión, I2 escritura con alcance de miembro, I3 `FOR ALL` sin `WITH CHECK`, I4 `SECURITY DEFINER` sin `search_path`, I6, I7 | Antes y después de cada migración. **Criterio de salida: 0 CRÍTICAS** y no subir ninguna ALTA/MEDIA |
| `scripts/rls-pruebas-negativas.mjs` | Comportamiento actuando como cada rol; crea usuarios desechables vía Admin API y limpia en `finally` | Molde para la suite del #29/#30 con usuarios **desechables** (el JWT no se puede auto-firmar: no hay `SUPABASE_JWT_SECRET`) |
| `scripts/rls-pruebas-pizarra.mjs` | Igual, pero con usuarios **reales** validados con los helpers `user_staff_school_ids()`, `user_admin_school_ids()` y sesión simulada (`request.jwt.claims` + `role`) dentro de una transacción que no persiste | Molde para pruebas de solo lectura y de rechazo |
| **Bloque `DO $$` con sesiones simuladas que termina en `RAISE EXCEPTION`** | Flujo completo (guardar, publicar, responder) y deja la base intacta | Patrón usado el 23-oct con el reporte del partido (7 comprobaciones, 0 residuos). Es el estándar para RPC nuevas |
| `bff` con **vitest** (`npm --prefix bff test`) | Servicios y rutas con mocks | Pruebas unitarias del generador y validador de códigos, límites de intentos, validación de archivos |
| **Playwright** en `frontend/e2e/` + `helpers/auth.ts` (login programático) | Flujos completos en navegador | Exige `PLAYWRIGHT_SUPABASE_URL` y `PLAYWRIGHT_SUPABASE_ANON_KEY` (el valor por defecto apunta a un proyecto muerto) |
| `scripts/qa-responsive/` | 360 / 768 / 1024 / 1440 px × zoom 80–200 % × escala de Windows 125/150 % | Toda pantalla nueva entra a la auditoría D3 |
| Gemelo local (`qa:twin:*`) | Réplica Docker de la base | Fuerza bruta, concurrencia y carga sin tocar producción |

**Regla de oro (lección del 23-oct):** *correr lo ejecutable*. Una fase no se da por probada leyendo código; se da por probada con la salida de la prueba pegada en el informe de la fase.

---

## 1. Actores de prueba

Todas las matrices usan los mismos nueve actores, creados con datos sintéticos (escuelas A y B de prueba; en la base viva, escuelas `is_demo`):

| Clave | Actor | Alcance esperado |
|---|---|---|
| `anon` | Sin sesión | Nada, salvo lo público explícito |
| `padre_B` | Padre de la escuela B | Cero acceso a lo de A |
| `padre_A` | Padre de A, hijo inscrito | Lo suyo y lo de sus hijos |
| `atleta_A` | Atleta adulto de A | Lo suyo |
| `coach_A` | Coach de A (`user_staff_school_ids()` incluye A) | Lo de sus equipos; no otorga permisos |
| `staff_A` | Personal sin rol de coach ni admin (`reporter`, `staff`) | Lectura limitada |
| `admin_A` | `admin` / `school_admin` de A | Gestión operativa de A |
| `owner_A` | Dueño de A | Todo en A |
| `super_admin` | Plataforma | Soporte; todo auditado |

Más dos actores específicos: `huérfano` (perfil sin escuela, el «limbo») y `nuevo_google` (registro con Google, sin pasar por el formulario).

---

## 2. Frente #29 — Código único de escuela («por clasificar»)

### 2.1 Matriz de casos por rol

| # | Caso | anon | padre_B | huérfano | padre_A | atleta_A | coach_A | staff_A | admin_A | owner_A | super_admin |
|---|---|---|---|---|---|---|---|---|---|---|---|
| C1 | Ver el código de su escuela | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ (a definir) | ✗ | ✓ | ✓ | ✓ |
| C2 | Ver el código de **otra** escuela | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| C3 | Regenerar el código | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| C4 | Canjear un código válido | ✗ (exige sesión) | ✓ | ✓ | ✓ (ya miembro: idempotente) | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| C5 | Canjear un código regenerado (el viejo) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| C6 | Tras canjear: rol asignado | — | por clasificar | por clasificar | por clasificar | por clasificar | **por clasificar, nunca `coach`** | **por clasificar** | n/a | n/a | n/a |
| C7 | Ver datos de la escuela estando «por clasificar» | — | ✗ | ✗ | ✗ (ni deportistas ni cobros ni contactos) | ✗ | ✗ | ✗ | — | — | — |
| C8 | Aprobar el rol y asignar categoría, equipo y valor | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| C9 | Aprobar un rol de staff (coach, admin) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ (otorgar permisos = solo administración; ver §5 de CLAUDE.md) | ✓ | ✓ |
| C10 | Vincular a una ficha existente (`unregistered_athletes`/`children`) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| C11 | Ver la bandeja «Por clasificar» | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| C12 | Un cobro se genera antes de que el admin asigne valor | no debe ocurrir en ningún caso |

Casos adicionales (todos negativos salvo indicación):

- **C13** Código con mayúsculas, minúsculas, espacios, guiones, caracteres Unicode parecidos (`0`/`O`, `1`/`l`): se normaliza sin permitir colisiones entre escuelas.
- **C14** Código vacío, de longitud errónea, con SQL o `%`/`_` (comodines de `LIKE`): rechazo sin error 500.
- **C15** Persona que ya es miembro activo de la escuela canjea otra vez: sin duplicar membresía, sin bajarla de rol.
- **C16** Persona que es **staff** de A y canjea el código de A: **no** pierde ni cambia su rol (el hueco ya cerrado en `staff_no_se_reactiva_ni_cambia_de_escuela`).
- **C17** Persona miembro de A y B canjea el código de A: queda sólo en A, B intacta.
- **C18** Atleta/hijo con ficha existente por correo: el canje **no adopta** por nombre; debe pasar por la vinculación del admin (evita duplicados de identidad, ver memoria `project_duplicate_athlete_identities`).
- **C19** Entrada por Google (`nuevo_google`): la pantalla de código aparece tras iniciar sesión y la persona no queda con acceso a nada hasta canjear.
- **C20** Persona con membresía `inactive`/rechazada canjea de nuevo: comportamiento definido y documentado (reactiva a «por clasificar», nunca a rol activo).
- **C21** Rechazar a quien entró por código: queda sin acceso, sin borrar su perfil; no puede reintentar sin límite.

### 2.2 Concurrencia (en el gemelo)

| # | Escenario | Resultado esperado |
|---|---|---|
| K1 | El admin regenera el código mientras 20 personas canjean el anterior en paralelo | Cada canje o bien entra (el código era vigente en su transacción) o bien falla limpio; **cero** canjes con un código ya invalidado después de confirmada la regeneración; el código nuevo es único |
| K2 | Dos admins regeneran a la vez | Un solo código final; el otro queda invalidado; sin violar el `UNIQUE` ni dejar la escuela sin código |
| K3 | La misma persona canjea dos veces a la vez (doble clic, dos pestañas) | **Una** membresía (`UNIQUE(school_id, profile_id)`), segunda llamada idempotente |
| K4 | Dos escuelas se regeneran a la vez y el generador propone el mismo valor | El `UNIQUE` global rechaza; el generador reintenta; cero colisiones |
| K5 | El admin aprueba y asigna valor mientras el usuario canjea otra vez | Un solo estado final coherente; el cobro se crea **una vez** (`uniq_payment_active_period_per_child`) |
| K6 | 500 canjes en 60 s de usuarios distintos | Sin deadlocks, sin errores 5xx, tiempo de respuesta registrado |

### 2.3 Seguridad

| # | Prueba | Criterio |
|---|---|---|
| S1 | **Enumeración por fuerza bruta** del código (en el gemelo): 10.000 intentos desde una cuenta y desde varias | Límite de intentos por usuario y por red; bloqueo temporal creciente; respuesta uniforme («código no válido») que **no distingue** «no existe» de «está vencido»; tiempo de respuesta constante |
| S2 | Espacio del código | Longitud y alfabeto tales que adivinar uno válido por azar sea inviable con el límite de S1; se calcula y se documenta la probabilidad |
| S3 | Código **filtrado** (publicado en un grupo abierto) | Quien lo canje queda «por clasificar» sin acceso a datos (C7); el admin puede ver la fecha y la persona de cada canje y regenerar; auditoría de quién canjeó con cuál versión |
| S4 | Escalada de privilegios: canjear el código de A con un perfil `role='admin'` global o con un `invitation_code` en los metadatos | Ningún cambio de rol; el rol sale **solo** de la aprobación del admin |
| S5 | IDOR: llamar la RPC de canje o de aprobación con `school_id`/`profile_id` de otra escuela | 42501 |
| S6 | RPC `SECURITY DEFINER`: `search_path` fijo, `GRANT EXECUTE` solo a `authenticated`, nada a `anon` | Invariante I4 en verde; consulta de `has_function_privilege` |
| S7 | Registro de los intentos fallidos | Tabla de auditoría sin datos sensibles; no legible por padres |
| S8 | Mensajes de error y encabezados | No filtran UUID, rol ni nombre de escuela a quien no tiene acceso (SEG-11) |
| S9 | Inyección en el campo del código (SQL, `%`, `_`, unicode, 10 KB) | Rechazo uniforme, sin 500 |
| S10 | Lectura masiva: un `huérfano` consulta `schools`/`school_members`/`invitations` | Solo lo que ya veía antes del #29 (sin regresión) |

### 2.4 Datos (antes y después)

Línea base en la base viva (consultas puntuales, solo lectura), guardada en el informe de la fase:

- Perfiles `parent`/`athlete` sin escuela en 60 días: **39** de 184 (hoy). Debe bajar a **0 nuevos por semana** tras el despliegue (los que ya estaban, los resuelve el canje).
- Conteo de `school_members` por escuela y por rol **antes** y **después** de la migración: iguales (la migración no crea ni cambia membresías por sí sola).
- Conteo de `enrollments`, `payments`, `children`, `unregistered_athletes` por escuela antes y después: **idénticos**.
- Ninguna escuela queda sin código tras la migración de relleno; unicidad verificada con `select code, count(*) ... having count(*)>1` = 0 filas.

### 2.5 UI, celular y accesibilidad

- **Pantalla «Código de tu escuela»** (post-login, y en «Mi cuenta»): 360 px, 768, 1024; zoom 200 %; teclado numérico/alfabético correcto en iOS y Android; el campo no se corta con el teclado abierto; pegar desde WhatsApp funciona; mensajes de error leíbles (contraste ≥ 4,5:1), foco al error, `aria-live`, etiquetas asociadas, navegable solo con teclado, lector de pantalla anuncia el resultado.
- **Bandeja «Por clasificar»** del admin: tabla que degrada a tarjetas en 360 px; acciones con área táctil ≥ 44 px; confirmación con **Deshacer** (regla V2) en vez de «¿Seguro?».
- Textos en español colombiano; sin «che»/«vos».

### 2.6 E2E (Playwright)

| # | Flujo | Pasos |
|---|---|---|
| E1 | Padre sin escuela canjea el código | Registro por correo → pantalla de código → canje → ve «Tu solicitud está en revisión» → el admin lo ve en la bandeja |
| E2 | Registro con Google | Login Google (cuenta de prueba) → pantalla de código → canje |
| E3 | Admin clasifica | Bandeja → vincula a ficha existente / crea nuevo → asigna categoría, equipo y valor → el padre ve a su hijo y el cobro correcto |
| E4 | Regeneración | Admin regenera → código viejo falla con mensaje uniforme → código nuevo funciona |
| E5 | Intento de coach por código | Persona canjea con la intención de ser coach → queda «por clasificar»; solo el dueño puede darle rol de staff |
| E6 | Móvil | E1 completo con viewport 360×800 y zoom 200 % |

---

## 3. Frente #30 — Documentos y firmas

### 3.1 Matriz de casos por rol

`D` = documento de un deportista de A. Tipos: los 10 del catálogo por defecto (`athlete_photo`, `eps_certificate`, `guardian_id_front/back`, `athlete_id_front/back`, `guardian_signature`, `athlete_signature`, `good_standing_certificate`, `other`) más los configurados por la escuela.

| # | Caso | anon | padre_B | padre_A (de ese hijo) | padre_A (de otro hijo) | atleta_A (suyo) | coach_A | staff_A | admin_A | owner_A | super_admin |
|---|---|---|---|---|---|---|---|---|---|---|---|
| D1 | Ver el listado de requisitos de la escuela | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| D2 | Subir un documento a su hijo/a | ✗ | ✗ | ✓ | ✗ | ✓ (suyo) | ✗ | ✗ | ✓ | ✓ | ✓ |
| D3 | Ver/descargar el documento | ✗ | ✗ | ✓ | ✗ | ✓ (suyo) | **según flag** (ver D12) | ✗ | ✓ | ✓ | ✓ |
| D4 | Reemplazar un documento ya **verificado** | ✗ | ✗ | ✗ (queda «reemplazo pendiente») | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| D5 | Borrar un documento | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ (con registro) | ✓ | ✓ |
| D6 | Verificar o rechazar con motivo | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| D7 | Configurar los requisitos de la escuela | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| D8 | Ver la lista de «qué falta» por deportista | ✗ | ✗ | ✓ (suyo) | ✗ | ✓ (suyo) | solo sus equipos | ✗ | ✓ | ✓ | ✓ |
| D9 | Firmar en pantalla como acudiente | ✗ | ✗ | ✓ (de su hijo) | ✗ | n/a | ✗ | ✗ | ✗ (nadie firma por otro) | ✗ | ✗ |
| D10 | Firmar como atleta adulto | ✗ | ✗ | n/a | n/a | ✓ (suya) | ✗ | ✗ | ✗ | ✗ | ✗ |
| D11 | Ver la evidencia de una firma (fecha, texto, red, dispositivo) | ✗ | ✗ | ✓ (suya) | ✗ | ✓ (suya) | ✗ | ✗ | ✓ | ✓ | ✓ |
| D12 | Ver documentos de **salud** o de **identidad** | ✗ | ✗ | ✓ | ✗ | ✓ | **✗ por defecto** (dato sensible; solo con decisión explícita de la escuela) | ✗ | ✓ | ✓ | ✓ |

Casos adicionales:

- **D13** Documento subido por un **padre** a un hijo que luego se vincula a otro acudiente (padres separados, #28): el segundo acudiente solo lo ve si quedó marcado «ve».
- **D14** El deportista pasa a otra escuela o se da de baja: los documentos de A siguen siendo de A; B no los ve.
- **D15** Ficha sin cuenta (`unregistered_athletes`) → la persona se registra y se vincula: **los documentos viajan** y no quedan huérfanos (migración `20261020111530`; antes se perdían, ver memoria). Se prueba con una ficha de prueba con 3 documentos.
- **D16** Cuenta eliminada: política de retención definida (qué se borra, qué se conserva por obligación de la escuela) y comprobada con borrado total de usuario.
- **D17** Tipo de documento no catalogado o de una escuela ajena: rechazo.
- **D18** Tipo `other`: múltiples permitidos, sin unicidad.
- **D19** Un tipo obligatorio con firma pide el flujo de firma; un tipo sin firma no lo pide.
- **D20** Escuela sin requisitos configurados: usa los 10 por defecto; ninguno obligatorio hasta que el dueño lo marque.

### 3.2 Concurrencia (en el gemelo)

| # | Escenario | Resultado esperado |
|---|---|---|
| K1 | **Dos subidas del mismo tipo** del mismo deportista a la vez (dos pestañas, o padre y admin) | Un solo documento «vigente» por tipo (salvo `other`); el otro queda como versión anterior o se rechaza con mensaje claro; **ningún archivo huérfano** en el almacenamiento sin fila |
| K2 | Subida mientras el admin verifica el documento anterior | La verificación aplica al documento que vio; la subida nueva queda «pendiente» |
| K3 | **Dos firmas con el mismo enlace** a la vez | Una sola firma válida; la segunda recibe «este enlace ya se usó»; un solo evento de firma, un solo PDF sellado |
| K4 | El enlace de firma expira mientras la persona está firmando | Se rechaza en el servidor; no se guarda una firma sin enlace vigente |
| K5 | La escuela cambia los requisitos mientras la familia sube | La subida es válida contra el catálogo vigente **en su transacción**; la lista de pendientes se recalcula, sin errores |
| K6 | Vinculación de ficha (D15) mientras se sube un documento a esa ficha | El documento queda en la ficha o en el perfil, **nunca en ambos ni en ninguno** (`athlete_documents_subject_xor`) |
| K7 | 200 subidas de 5 MB en paralelo | Sin errores 5xx, sin agotar conexiones, tiempos registrados |

### 3.3 Seguridad

| # | Prueba | Criterio |
|---|---|---|
| S1 | **Enlace de firma reutilizado** | Un enlace de un solo uso: el token se guarda **solo como hash** (`token_hash`), se invalida al firmar, y reutilizarlo no revela el documento |
| S2 | **Enlace de firma vencido** | Rechazo uniforme; no confirma si existió |
| S3 | **Fuerza bruta de tokens de firma** (en el gemelo) | Entropía ≥ 128 bits, límite de intentos por red; sin diferencia de respuesta entre «no existe» y «vencido» |
| S4 | **URL firmada de un documento de un menor** | Vida corta (≤ 5 min, como hoy), creada solo tras verificar acceso; no se puede listar el bucket `identity-documents`; una URL no sirve para obtener otras; un padre no puede pedir la de otro hijo |
| S5 | **Archivo malicioso**: ejecutable renombrado `.jpg`, SVG con script, PDF con JavaScript, HTML | Validación por **contenido** (firma de archivo), no por extensión ni `Content-Type`; lista cerrada de tipos (JPG, PNG, WebP, PDF, y HEIC si se admite); SVG no permitido; se sirve con `Content-Disposition` y `X-Content-Type-Options: nosniff` |
| S6 | **Archivo enorme** (50 MB, 2 GB, imagen de 30.000×30.000 px «bomba de descompresión») | Límite de bytes y de píxeles en el servidor, no solo en el navegador; la compresión del cliente (`imageCompression.ts`) es comodidad, no control |
| S7 | **XSS en la firma y en los campos**: nombre del archivo, motivo de rechazo, texto aceptado, notas, firma dibujada como SVG o con metadatos | Todo se muestra escapado; la firma se guarda como imagen raster (PNG) generada en el servidor a partir de trazos, no como SVG del cliente; el motivo de rechazo y las notas no ejecutan nada |
| S8 | **Evidencia de firma inmutable** | Una firma registrada no se puede editar ni borrar desde el cliente; el texto aceptado queda con su versión y su hash; los eventos son solo-insertar |
| S9 | **IDOR**: subir/leer con `child_id`, `school_id` o `storage_path` de otra escuela; path traversal (`../`) en el nombre | 42501 / rechazo; la ruta de almacenamiento la construye el servidor |
| S10 | Políticas de almacenamiento (`storage.objects`) para `identity-documents` | Subir solo bajo el prefijo permitido; leer solo con acceso verificado; sin `anon`; `identity-documents` sigue siendo **privado** (verificado: anon lee 0) |
| S11 | Invariantes | `npm run seguridad:invariantes`: **0 CRÍTICAS**; I1, I2, I3, I4 sin hallazgos nuevos; `athlete_documents` con `WITH CHECK` en cada policy de escritura |
| S12 | Policy actual `school_staff_manage_athlete_documents` (`FOR ALL`, rol `public`, solo admin) | Se reemplaza por policies explícitas por comando; se verifica con `pg_policies` que no quede ninguna policy permisiva abierta sobre la tabla (las policies se suman con `OR`) |
| S13 | Fuga por enumeración: contar documentos o nombres de archivo de otra escuela | Imposible; los mensajes no filtran la existencia |
| S14 | Consentimiento de datos sensibles | Sin aceptación del texto vigente, no se permite subir documentos de salud o identidad; la aceptación queda registrada con versión, fecha y persona |

### 3.4 Datos (antes y después)

Estas cifras se miden **antes de aplicar** y se repiten **después**, y deben coincidir:

- `athlete_documents`: **1.009** filas (todas de Monster, 1 escuela); desglose por `document_type`: `eps_certificate` 148, `athlete_photo` 147, `athlete_id_front` 144, `athlete_signature` 142, `good_standing_certificate` 139, `guardian_id_front` 137, `guardian_signature` 136, `other` 15, `athlete_id_back` 1. **La migración no toca ni una fila ni un archivo.**
- `verified = true`: 0 antes y 0 después.
- Para cada fila: `storage_path` resuelve a un objeto existente en `identity-documents` (consulta de integridad; se registran los huérfanos existentes como línea base, sin arreglarlos dentro de la migración).
- Cada policy y `CHECK` nuevos aceptan los 10 tipos actuales: `select count(*) from athlete_documents where document_type <> all(<catálogo>)` = 0.
- Conteos de objetos en el bucket por escuela antes y después.
- Rollback ensayado en el gemelo: volver al estado anterior sin pérdida.

### 3.5 UI, celular y accesibilidad

- **Subida de la familia:** 360 px; cámara del celular directa y galería; recorte y compresión previos; barra de progreso; reintento sin perder lo ya subido; funciona con conexión lenta (simulada con 3G en Playwright); mensajes por tipo de error (tamaño, formato, red).
- **Lista de pendientes** «faltan 3 de 7»: texto claro, no solo color; orden por obligatoriedad.
- **Firma en pantalla:** lienzo táctil a 360 px sin que el scroll de la página interfiera; botón «Borrar y volver a firmar»; firma con el dedo y con ratón; alternativa accesible (escribir el nombre completo y aceptar) para quien no pueda dibujar; previsualización del texto que se acepta antes de firmar.
- **Revisión del admin:** vista del documento a tamaño legible; aprobar/rechazar con motivo y **Deshacer**.
- **Accesibilidad:** etiquetas, foco, `aria-live` para el estado de la subida, contraste ≥ 4,5:1, teclado completo, lector de pantalla; zoom 200 %; escala de Windows 125/150 % (`scripts/qa-responsive/`).

### 3.6 E2E (Playwright)

| # | Flujo |
|---|---|
| E1 | Padre sube los 7 documentos de Monster desde la app (con archivos de prueba sintéticos) → ve «completo» → el admin los ve y verifica → el padre ve «verificado» |
| E2 | Admin rechaza un documento con motivo → la familia recibe el aviso → sube el reemplazo → queda pendiente → se verifica |
| E3 | Firma aparte: el acudiente firma en pantalla → se guarda con evidencia → el admin la ve con fecha, texto y red |
| E4 | Firmar el documento: la escuela sube una plantilla → genera el enlace → la familia lo abre en el celular → firma → PDF sellado descargable |
| E5 | Enlace reutilizado y enlace vencido → mensajes correctos |
| E6 | Escuela B configura requisitos distintos (solo 3) → su familia ve 3, no los 10 de Monster |
| E7 | Ficha sin cuenta con documentos → el padre se registra y vincula → los documentos aparecen sin duplicar |
| E8 | Móvil 360×800, zoom 200 %, red lenta |

---

## 4. Orden sugerido y esfuerzo

Cada paso se cierra con su informe (cifras de antes y después) y sin avanzar si falla el anterior. Cada fase: spec → migración → pruebas con sesión simulada en transacción revertida → invariantes → pantallas → e2e → auditoría.

| Orden | Fase | Esfuerzo | Se prueba con |
|---|---|---|---|
| 1 | **#29-F0 spec** y línea base de datos (§2.4) | 0,5 día | Consultas de solo lectura |
| 2 | **#29-F1 base**: código único, regenerar, canje, «por clasificar», aprobación; sin pantalla | 1,5 días | Sesión simulada + invariantes + gemelo (K1–K6, S1–S3) |
| 3 | **#29-F2 pantallas**: código tras iniciar sesión, «Mi cuenta», bandeja del admin | 1,5 días | e2e E1–E6, `qa-responsive`, accesibilidad |
| 4 | **#30-F0 spec** (catálogo, firma, privacidad) con las 4 decisiones del usuario resueltas | 1 día | Revisión línea por línea de cada policy antes de aplicar |
| 5 | **#30-F1 base**: catálogo por escuela, policies por comando, subida de la familia, verificación; sin tocar los 1.009 | 2 días | Sesión simulada + invariantes + conteos antes/después (§3.4) |
| 6 | **#30-F2 firma**: evidencia, enlace de un solo uso, PDF sellado | 2 días | S1–S8, K3–K4 en gemelo |
| 7 | **#30-F3 pantallas** y lista de pendientes con aviso | 2 días | e2e E1–E8, celular, accesibilidad |
| 8 | **Auditoría de los 7 días** (§6) y cierre | 0,5 día | Consultas puntuales |

Total aproximado: **11 días de trabajo**, con #29 y #30-F0 en paralelo. Una sola sesión aplica migraciones, y los tipos se regeneran una vez al final de cada lote.

---

## 5. Criterios de salida (compuerta de cada fase)

Una fase **no se cierra** si falla alguno:

1. **Antes y después:** el informe trae el número de antes y el de después para cada conteo del §2.4 / §3.4, y coinciden donde dicen «iguales».
2. `npm run seguridad:invariantes` → **0 CRÍTICAS**, sin ALTA ni MEDIA nuevas.
3. Pruebas de comportamiento (§2.1, §3.1) con **todos los casos negativos rebotando** y la salida pegada en el informe; cero residuos en la base (conteos de `profiles`, `school_members`, `athlete_documents` y objetos de almacenamiento idénticos tras la prueba).
4. Concurrencia (§2.2, §3.2) y fuerza bruta (S1, S3) corridas en el gemelo con resultados registrados.
5. `tsc` de frontend y BFF en 0 errores, eslint en 0 errores, `vitest` del BFF en verde, e2e del frente en verde.
6. `scripts/qa-responsive/` sin hallazgos nuevos en las pantallas del frente, a 360 px y con zoom 200 %.
7. Rollback ensayado en el gemelo.
8. Revisión línea por línea de cada policy y RPC nuevas (`SECURITY DEFINER` con `search_path`, `GRANT` explícito, `WITH CHECK` en cada escritura).
9. Un solo `apply_migration` por lote y tipos regenerados una vez.

---

## 6. Auditoría posterior al despliegue (a los 7 días)

Consultas **puntuales** (nada de `list_tables` ni barridos de catálogo, por Disk IO). Se guardan con su fecha y resultado en `docs/cierre-…/`.

### 6.1 Código de escuela (#29)

```sql
-- Perfiles padre/atleta sin escuela creados en los últimos 7 días (meta: 0)
select count(*) from profiles p
 where p.role in ('parent','athlete') and p.created_at > now() - interval '7 days'
   and not exists (select 1 from school_members sm where sm.profile_id = p.id)
   and not exists (select 1 from children c where c.parent_id = p.id)
   and not exists (select 1 from enrollments e where e.user_id = p.id);

-- Códigos duplicados (meta: 0 filas)
select code, count(*) from <tabla_de_codigos> group by 1 having count(*) > 1;

-- Canjes por escuela, por estado y por versión de código; canjes con una versión ya regenerada (meta: 0)
-- Personas «por clasificar» con más de 7 días sin atender, por escuela (meta: acción del admin)
-- Membresías activas con rol de staff cuyo origen fue el canje del código, sin aprobación del dueño (meta: 0)
-- Intentos fallidos por usuario y por red en 24 h; picos > N (revisar bloqueo)
```

### 6.2 Documentos y firmas (#30)

```sql
-- Conteo total y por tipo de athlete_documents: debe ser >= línea base (1.009) y las filas de la línea base intactas
-- Duplicados «vigentes» por (sujeto, tipo) excluyendo 'other' (meta: 0)
-- Documentos con storage_path sin objeto en el bucket (meta: no más que la línea base)
-- Objetos del bucket sin fila en la base (huérfanos de subida) (meta: 0 nuevos)
-- Firmas con evidencia incompleta (sin hash, fecha, texto aceptado o versión) (meta: 0)
-- Enlaces de firma usados más de una vez, y enlaces vencidos que produjeron una firma (meta: 0)
-- Policies de athlete_documents y de storage.objects (identity-documents): comparar con lo aprobado; ninguna permisiva nueva
-- has_table_privilege('anon', 'athlete_documents', 'SELECT') = false
-- Documentos legibles por padres de otra escuela, simulando sesión (meta: 0)
```

### 6.3 Invariantes y métricas

- `npm run seguridad:invariantes`: 0 CRÍTICAS; comparar ALTA/MEDIA con el día del despliegue.
- Embudo de documentos por escuela: % de deportistas con los obligatorios completos, tiempo medio entre alta y documentos completos, % verificados, % rechazados y sus motivos.
- Embudo del código: canjes por día, tiempo hasta la clasificación del admin, % que quedan sin clasificar a los 7 días, regeneraciones por escuela.
- Rendimiento: p95 de subida y de canje; errores 5xx; tamaño medio de archivo y uso del bucket (el plan tuvo problemas de archivos y de Disk IO).
- **Disk IO:** comparar la tasa de temporales antes y después con una ventana larga (la ventana de 2,4 min no basta); los jobs nuevos no hacen N+1 (`.in('id', ids)`).
- Soporte: tickets o mensajes de familias sobre «no me deja subir», «no encuentro mi código» o «ya firmé y sigue pendiente».

Si algo falla: apagar el flag de la escuela, regenerar códigos, y abrir el hallazgo con su cifra; no «corregir sobre la marcha» en la base compartida.
