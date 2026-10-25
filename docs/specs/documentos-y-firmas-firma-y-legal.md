# Documentos y firmas (#30) — firma electrónica, legalidad y seguridad

**Estado:** análisis previo a la spec, 2026-10-23. Parte del ROADMAP #30.
**Alcance:** solo firma, evidencia, consentimiento y seguridad. El catálogo de requisitos, la subida por la familia y la revisión del administrador van en la spec funcional de #30.
**Aviso:** esto **no es concepto jurídico**. Todo lo que dependa de interpretar una norma o de una validación ante la autoridad está marcado **A VALIDAR CON ABOGADO**. No se citan artículos ni sentencias que no se puedan afirmar con certeza.

---

## 0. Lo que ya existe en el repo (verificado el 2026-10-23)

| Pieza | Estado | Dónde |
|---|---|---|
| Firma del acudiente y del deportista | Solo **imagen subida** (foto de la firma en papel). Sin captura en pantalla ni evidencia | `athlete_documents.document_type` = `guardian_signature` / `athlete_signature`; 136 y 142 filas, todas de Monster |
| Enlace público de un solo propósito con vencimiento y estados `vigente` / `vencido` / `revocado` | Existe para cobros | `payment_public_tokens` (`20261004083707_cobro_enlace_publico.sql`) |
| OTP por correo | Existe, para reservas públicas: código de 6 dígitos, guardado con **SHA-256**, vigencia de 10 min, máximo 3 por correo cada 10 min, límite por IP | `bff/src/routes/public-booking.routes.ts` |
| Evidencia de consentimiento | Existe en dos dominios, ambos distintos de este | `payment_consents`, `clinical_consents` y `clinical_consent_texts` (texto versionado) |
| Correo | Función de borde `send-email` (Resend) | `bff/src/routes/invitations.routes.ts` |
| WhatsApp | Cola, plantillas y bandejas; canal por escuela y canal de plataforma | `bff/src/services/whatsapp-*`, `bff/src/jobs/whatsapp-queue.job.ts` |
| PDF | `pdfkit` en el BFF (genera PDF nuevos) y `jspdf` en el frontend. **No hay `pdf-lib`** (no se puede abrir ni sellar un PDF ajeno sin agregarlo) | `bff/package.json`, `frontend/package.json` |
| Captura de firma en pantalla | **No hay** librería de firma (`signature_pad` o similar) | — |
| Política de privacidad | Una sola, canónica | `app.sportmaps.co/politica-de-privacidad` |

**Hallazgo de seguridad menor ya presente:** el generador del OTP de reservas usa `Math.random()` (`generateCode()` en `public-booking.routes.ts`). Para firmas debe usarse `crypto.randomInt`. No se toca aquí, queda como deuda anotada.

---

## 1. Marco normativo (lo que se puede afirmar y lo que no)

### 1.1 Firma electrónica

**Se puede afirmar con razonable certeza:**
- La **Ley 527 de 1999** reconoce los mensajes de datos y las firmas, y su **artículo 7** trata el requisito de firma: cuando la ley exige una firma, se cumple en un mensaje de datos si se usa un método que **identifique a la persona** y que indique que aprueba el contenido, y si el método es **confiable y apropiado** para el fin con que se generó o comunicó el mensaje.
- El **Decreto 2364 de 2012** reglamenta ese artículo 7 y define la **firma electrónica** en sentido amplio (códigos, contraseñas, datos biométricos, claves criptográficas) como método válido si cumple los criterios de confiabilidad y apropiabilidad, y reconoce que las partes pueden acordar el método.
- Esa firma electrónica «simple» es distinta de la **firma digital** (certificado emitido por una entidad de certificación acreditada), que tiene presunciones más fuertes.

**NO se puede afirmar sin concepto legal (A VALIDAR CON ABOGADO):**
1. Que una **firma dibujada en pantalla con evidencia** cumple, por sí sola, el criterio de «confiable y apropiada» para **cada tipo de documento** que pida una escuela (una autorización de imagen no es lo mismo que un consentimiento médico).
2. Si para **documentos de menores** o de **salud** conviene un mecanismo más fuerte (OTP al acudiente, firma digital o sello de tiempo de un tercero acreditado).
3. Qué **artículos y criterios de confiabilidad** del decreto aplican a nuestro diseño y cómo se prueba la **apropiabilidad** (que la firma «pertenezca» al firmante). No se transcriben artículos concretos aquí para no inventarlos.
4. Valor probatorio en un **proceso real** de las evidencias propuestas (huella del documento, IP, dispositivo, hora del servidor).
5. Si la escuela, como contratante de la plataforma, y SportMaps, como proveedor, necesitan un **acuerdo escrito** que fije el método de firma aceptado por las partes.

### 1.2 Datos personales de menores y sensibles

**Se puede afirmar con razonable certeza:**
- La **Ley 1581 de 2012** exige **autorización previa, expresa e informada** del titular para tratar sus datos, y trata de forma especial los **datos sensibles** (los de salud están entre ellos) y los **datos de niños, niñas y adolescentes**.
- El **Decreto 1377 de 2013** reglamenta la ley (autorización, aviso de privacidad, políticas, autorización de menores); hoy está compilado en el decreto único del sector comercio. **A VALIDAR CON ABOGADO** el número y los artículos vigentes de la compilación.
- Para menores prevalece el **interés superior** y, en general, la autorización la da el **representante legal**, atendiendo la opinión del menor según su madurez.

**NO se puede afirmar sin concepto legal (A VALIDAR CON ABOGADO):**
1. Si el **certificado de EPS**, la **foto con camiseta** y el **documento de identidad** de un menor se consideran datos sensibles o solo semiprivados en cada caso, y qué consecuencias tiene para la autorización.
2. Si hay que **registrar la base de datos** ante la autoridad (Registro Nacional de Bases de Datos) por el volumen de la escuela o de la plataforma, y quién responde: **SportMaps como encargado y la escuela como responsable** (hipótesis de trabajo) u otro reparto.
3. Qué debe decir el **aviso de privacidad** en el momento de la subida y cuánto tiempo se conservan los documentos.
4. Si se puede **condicionar** la afiliación a entregar un dato sensible que no es indispensable (la ley restringe condicionar actividades a datos sensibles).
5. El tratamiento de **transferencia o transmisión internacional** si el almacenamiento o el correo están fuera del país (Supabase, Resend, Meta).

---

## 2. Opciones técnicas

Se separan **tres capas** que pueden combinarse: (a) cómo se captura la firma, (b) cómo se verifica quién firma, (c) cómo se sella lo firmado.

### 2.1 Cómo se captura

| Opción | Cómo funciona | Pros | Contras | Costo |
|---|---|---|---|---|
| **A. Firma dibujada en canvas** | La persona firma con el dedo o el mouse; se guarda la imagen y los trazos | Familiar para la gente; funciona en celular | Por sí sola prueba poco (cualquiera puede dibujar) | Una librería pequeña (por ejemplo `signature_pad`) o código propio; sin costo recurrente |
| **B. Aceptación con clic («Acepto y firmo»)** | Casilla con el texto exacto + botón | Simple, sin fricción | Evidencia más débil para documentos sensibles | Ninguno |
| **C. Firma física escaneada** (lo que hay hoy) | Foto del papel firmado | Cubre lo ya cargado de Monster | No se puede verificar ni auditar | Ninguno |

### 2.2 Cómo se verifica quién firma

| Opción | Pros | Contras | Costo |
|---|---|---|---|
| **Enlace de un solo uso al contacto de la ficha** (patrón `payment_public_tokens`) | Ya existe el patrón; no pide cuenta | Si reenvían el enlace, firma otra persona | Ninguno adicional |
| **OTP por correo** (patrón de `public-booking.routes.ts`) | Ya existe, Resend ya está pagado (Pro, 50.000 al mes) | El correo puede ser compartido o estar mal escrito | Casi cero |
| **OTP por WhatsApp** | Casi todos los acudientes lo usan; el teléfono suele ser personal | Requiere **plantilla de autenticación aprobada por Meta** y tiene costo por mensaje; **verificar la tarifa vigente de Meta** antes de comprometer | Por mensaje; sin cifra aquí porque cambia |
| **Cuenta autenticada de SportMaps** | Identidad ya establecida | Hoy el 99 % de los acudientes de Monster no tiene cuenta | — |

**Recomendación técnica:** OTP al **mismo canal por el que llegó el enlace**, con el patrón de reservas pero con `crypto.randomInt`, vigencia de 10 minutos y máximo 3 intentos por código.

### 2.3 Cómo se sella lo firmado

| Opción | Cómo | Pros | Contras | Costo |
|---|---|---|---|---|
| **Constancia aparte (recomendada para empezar)** | El documento original **no se modifica**. Se genera con `pdfkit` (ya instalado) un PDF de **constancia de firma** con: hash del original, firma, nombre, fecha y hora del servidor, canal de verificación y datos de evidencia | Sin dependencias nuevas; el original queda intacto y su hash sirve de prueba | La firma no aparece «sobre» el documento | Cero |
| **Estampar sobre el PDF** | Se agrega `pdf-lib` y se dibuja la firma sobre la plantilla | Se ve como un documento firmado | Dependencia nueva a revisar (licencia y mantenimiento); riesgo de PDF malformado | Una dependencia |
| **SHA-256 del documento y de la firma** | `crypto.createHash('sha256')` en el BFF (ya usado en el repo) | Detecta cualquier alteración posterior | Prueba integridad, no identidad | Cero |
| **Sello de tiempo de un tercero acreditado** | Una entidad externa certifica la hora | Mayor fuerza probatoria sobre el «cuándo» | Costo por sello y por contrato; **cotizar y A VALIDAR CON ABOGADO** si se necesita | Por sello, sin cifra aquí |
| **Firma digital con certificado** | La entidad emite un certificado a cada firmante | Presunciones legales más fuertes | Inviable para miles de acudientes | Alto; no recomendado |

**Hora de referencia:** la hora del **servidor** (`now()` de la base), nunca la del dispositivo.

---

## 3. Evidencia mínima y cómo hacerla inalterable

### 3.1 Qué se guarda por cada firma

- **Qué se firmó:** identificador del documento o plantilla, **versión** del texto, texto exacto mostrado y su **SHA-256**.
- **Quién firmó:** nombre ingresado, tipo y número de documento si lo da, calidad en la que firma (acudiente, deportista adulto, menor con acudiente), y el sujeto al que corresponde (hijo, usuario o ficha sin cuenta, siguiendo el esquema XOR de `athlete_documents`).
- **Cómo se verificó:** canal (correo, WhatsApp, cuenta), destino enmascarado y resultado del OTP.
- **Cuándo y desde dónde:** hora del servidor, dirección IP (leída de la forma correcta tras Cloudflare, ver lección de `req.ip`), agente de usuario.
- **La firma:** imagen o trazos y su SHA-256.
- **Aceptación del tratamiento de datos:** referencia a la versión del aviso aceptado (ver sección 5).
- **Encadenamiento (opcional):** `hash_anterior` y `hash` = SHA-256 del contenido canónico del evento, para detectar borrados o cambios intermedios.

### 3.2 Cómo hacerla inalterable

1. Tabla de eventos de firma **solo de inserción** (append-only): **sin política de UPDATE ni DELETE**, y un disparador que rechace cualquier modificación o borrado, también para el rol de servicio.
2. Escritura **solo por función SECURITY DEFINER** con `search_path` fijo; ningún `INSERT` directo desde el cliente (misma regla que ya aplicamos a `match_reports`).
3. Lectura: la familia ve **sus** firmas; el personal ve las de su escuela; nadie más.
4. Los archivos (firma, constancia) en un **bucket privado** con ruta que incluya la escuela, y URLs firmadas de corta duración para leerlos.
5. Hash encadenado: útil para auditoría interna; **no sustituye** al sello de tiempo de un tercero.
6. Anular una firma = **nuevo evento** de revocación, nunca borrar el anterior.

---

## 4. Modelo de amenazas

| # | Amenaza | Qué podría pasar | Mitigación propuesta |
|---|---|---|---|
| 1 | **Enlace reenviado** a otra persona | Firma alguien que no es el acudiente | Enlace de un solo uso con vencimiento corto + OTP al contacto de la ficha; mostrar el destino enmascarado; avisar al contacto de la ficha cuando se firma |
| 2 | **Firma por un menor** | Un hijo firma por su acudiente | OTP al teléfono o correo del acudiente; el menor solo ve «pídele a tu acudiente»; texto que exige declarar mayoría de edad; **A VALIDAR CON ABOGADO** la edad y el rol del menor |
| 3 | **Suplantación del acudiente** | Alguien con el teléfono equivocado recibe el enlace | La escuela confirma el contacto en la ficha; aviso a todos los acudientes registrados del hijo (ver #28 padres separados) |
| 4 | **Reutilizar o adivinar el enlace** | Acceso a documentos ajenos | Token aleatorio de 256 bits, guardado como **hash**; estados vigente, usado, vencido y revocado; no revelar si un token existe |
| 5 | **Fuerza bruta del OTP** | Adivinar los 6 dígitos | Máximo 3 intentos por código, bloqueo temporal, límite por IP y por destino, código de un solo uso, `crypto.randomInt` |
| 6 | **XSS en el canvas o en el nombre** | Script inyectado en la vista del administrador | La firma se guarda como imagen PNG validada, nunca como HTML; escapar todo texto; Política de Seguridad de Contenido; no renderizar SVG subido |
| 7 | **Archivo malicioso** | PDF o imagen con carga dañina, o un archivo enorme | Lista cerrada de tipos (PDF, JPG, PNG, WebP) verificada por **contenido** y no solo por extensión; tope de tamaño; reprocesar imágenes con `sharp` (ya instalado); antivirus o análisis **A EVALUAR** (costo y proveedor por definir) |
| 8 | **Lectura de documentos de menores** | URL filtrada o reenviada | Bucket privado; URL firmada de 5 minutos por lectura y por usuario con permiso; registro de cada apertura por parte del personal |
| 9 | **Personal que ve de más** | Un coach abre cédulas de todo el club | Permiso explícito de ver documentos distinto de ver la lista de deportistas; los coaches no lo tienen por defecto; registro de accesos |
| 10 | **Alterar la evidencia** | Un administrador edita o borra una firma | Tabla append-only sin UPDATE ni DELETE; revocación como evento nuevo; hash del documento fijado al firmar |
| 11 | **Texto cambiado después de firmar** | La escuela cambia la plantilla | Versionar la plantilla y firmar sobre una **versión inmutable** con su hash |
| 12 | **Escuela equivocada** | Documento de una escuela visible en otra | Todo con `school_id` y RLS por escuela; probar con sesiones simuladas de dos escuelas |
| 13 | **Gestión de la llave del correo y de WhatsApp** | Mensajes falsos con enlaces | Dominio y remitente verificados; enlaces solo a `app.sportmaps.co` (ver la lección de `FRONTEND_URL` local: nunca armar enlaces con variables de entorno de desarrollo) |
| 14 | **Retención y borrado** | Guardar documentos para siempre | Política de retención por tipo y derecho de supresión; la **constancia de firma** se conserva aunque se borre el documento adjunto, **A VALIDAR CON ABOGADO** el plazo |

**Pruebas obligatorias antes de dar por cerrado:** sesiones simuladas con padre, otro padre, coach, administrador y personas de otra escuela; intentos de OTP; enlaces vencidos y reutilizados; subida de un archivo con extensión falsa; intento de UPDATE y DELETE sobre la evidencia; e invariantes de seguridad del repo (`npm run seguridad:invariantes`) en verde.

---

## 5. Consentimiento de tratamiento de datos antes de la primera subida

**Cuándo se pide:** una vez por persona y por escuela, **antes** de subir el primer documento, y de nuevo si cambia la versión del aviso. Sin esa aceptación, la subida queda bloqueada.

**Texto base propuesto — A VALIDAR CON ABOGADO antes de publicarse:**

> **Autorización para el tratamiento de datos personales**
> Yo, [nombre], como [titular / representante legal de [nombre del menor]], autorizo a **[Nombre de la escuela]** (responsable) y a **SportMaps** (encargado de la plataforma) para recopilar, almacenar y usar los documentos y datos que cargo —incluidos documento de identidad, foto, certificado de salud (EPS) y firma— con el fin de gestionar la afiliación, la participación deportiva y la seguridad del deportista.
> Entiendo que algunos de estos datos pueden ser **sensibles**, que **no estoy obligado a entregarlos** salvo los indispensables para la afiliación que la escuela indique, y que los datos de menores se tratan atendiendo su interés superior.
> Puedo consultar, corregir o pedir la supresión de mis datos escribiendo a **[canal de la escuela]** o a **[canal de SportMaps]**. La política completa está en **app.sportmaps.co/politica-de-privacidad**.
> ☐ Acepto la autorización.   ☐ Soy el representante legal del menor.

**Dónde se guarda la aceptación:** en una tabla propia de **solo inserción**, con persona, escuela, sujeto (hijo, usuario o ficha), **versión del texto y su hash**, hora del servidor, canal, IP y agente de usuario. Reutiliza el patrón de versionado de `clinical_consent_texts`.

**Puntos abiertos (A VALIDAR CON ABOGADO):** quién figura como responsable y quién como encargado; si se necesita **opinión del menor** a partir de cierta edad; plazo de conservación; si debe haber una autorización **separada** para datos de salud; y qué hacer con las 1.009 fichas de Monster ya cargadas **sin** aceptación registrada.

---

## 6. Recomendación

### Para Monster

1. **No tocar lo ya cargado.** Los 1.009 documentos y las firmas escaneadas se conservan y se rotulan como «firma física escaneada» (evidencia de nivel bajo).
2. **Fase 1, firma electrónica simple reforzada:** enlace de un solo uso al contacto de la ficha + **OTP por WhatsApp o correo** + firma dibujada + **constancia de firma en PDF** con hash del documento + registro append-only. Sin dependencias nuevas salvo una librería de captura de firma.
3. **Quién firma:** el **acudiente** por el menor; el deportista adulto por sí mismo. Si el menor debe cofirmar queda **A VALIDAR CON ABOGADO**.
4. **Consentimiento de datos** antes de que cada familia suba por primera vez; para las fichas ya cargadas, pedir la aceptación **en el primer ingreso** (no bloquear la operación actual).
5. **No usar sello de tiempo de tercero ni firma digital todavía**; reevaluar solo si el abogado lo pide para algún documento.

### Para una escuela nueva

1. **Catálogo por defecto** igual al de Monster, configurable por el dueño (qué documentos pide, cuáles son obligatorios, cuáles llevan firma).
2. **Modo de firma por documento:** «aceptar con clic» para avisos informativos, y «firma + OTP + constancia» para autorizaciones y consentimientos.
3. **Plantillas de la plataforma** (autorización de imagen, de traslado, de salud, de responsabilidad) **redactadas y revisadas por un abogado una sola vez** y reutilizables por todas las escuelas, para que cada escuela no escriba el suyo sin revisión.
4. La escuela acepta un **acuerdo de uso** donde se fija el método de firma y el reparto de responsabilidades (**A VALIDAR CON ABOGADO**).

### Resumen de lo que debe validar un abogado

1. Que la firma electrónica simple con evidencia basta para cada tipo de documento, en especial menores y salud.
2. Reparto responsable y encargado entre la escuela y SportMaps, y si hay que registrar bases de datos.
3. Texto de la autorización, opinión del menor, datos sensibles y no condicionar la afiliación.
4. Plazos de conservación, supresión y tratamiento de las fichas ya cargadas sin aceptación registrada.
5. Si algún documento requiere sello de tiempo de tercero o un mecanismo más fuerte que el OTP.
