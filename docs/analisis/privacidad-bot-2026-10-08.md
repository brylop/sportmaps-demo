# Privacidad del bot de WhatsApp — ¿puede una persona ver datos de otra familia?

Auditoría defensiva, 2026-10-08. Base de producción: solo SELECT. Sin mensajes reales.
Sin nombres: conteos e ids recortados (8 caracteres).

## Resumen

| # | Sev. | Hallazgo | Estado |
|---|---|---|---|
| 1 | **P0 (latente)** | Un número **extranjero** cuyos últimos 10 dígitos coinciden con el celular de una familia colombiana queda identificado como esa familia (y como dueña si es su número) | Arreglado en código + migración **sin aplicar** |
| 2 | **P1 (vivo)** | El celular de alguien del **equipo** (dueña, entrenador) está en el perfil de OTRO acudiente: ese miembro del equipo ve los pagos de esa familia | Arreglado en la misma migración (**sin aplicar**) |
| 3 | P1 | El vínculo hecho por teléfono no se deshace cuando el número se vuelve ambiguo; un turno seguía con el `parent_id` viejo | Arreglado (migración + `revisarVinculoPorTelefono`) |
| 4 | P2 | El vínculo verificado por OTP desde el celular de un tercero no caduca nunca | Pendiente (decisión de producto) |
| 5 | P2 | «No encuentro ese correo» es un oráculo de existencia de correos **de toda la plataforma** | Pendiente (decisión de producto) |
| 6 | P2 | OTP: `Math.random`, SHA-256 sin sal de 6 dígitos, sin tope de reenvíos | `Math.random` → `crypto.randomInt` arreglado; lo demás pendiente |
| 7 | P2 | Contactos `personal`: 1 mensaje con texto guardado HOY en una conversación ya marcada; 246 textos históricos siguen guardados | Pendiente |
| 8 | P2 | Ficha sin cuenta con el celular de la dueña en `parent_phone_temp`: al escribir, recibe el enlace de invitación con el correo de esa familia | Pendiente |

Lo que **está bien** (verificado): herramientas sin parámetros, todo filtrado por `parent_id` + `school_id`; RPC `wa_*` solo para `service_role`; `/p/:token` es una credencial de 144 bits con datos mínimos; la «ref.» del texto de `/p/:token` solo elige entre los cobros del propio pagador; teléfonos compartidos dentro de una escuela → `ambiguo` (escala, no elige).

---

## 1. P0 latente — número extranjero suplanta a una familia colombiana

**Escenario.** Un número de EE. UU. `+1 310 123 4567` llega de Meta como `13101234567`. Todas las RPC de identificación hacen `right(digitos, 10)` y exigen `^3[0-9]{9}$`: queda `3101234567`, que es un celular colombiano. Las áreas 301-324 y 350 de EE. UU./Canadá se solapan con los prefijos móviles de Colombia (300-324, 350-351), y México `+52 33…` también cae. Quien consiga ese número virtual (cuesta poco) queda:

- identificado como la familia (`wa_identify_by_phone`) → `get_payment_status`, enlaces de pago, estado de comprobantes, ausencias, factura electrónica;
- si es el número de la dueña, como **staff_admin** (`wa_identify_staff_admin_by_phone`) → alta de atletas por foto, etc.;
- familia sin cuenta → recibe la invitación con el **correo precargado** (`wa_invitacion_pendiente_por_telefono`);
- prospecto → ve y **cancela** la clase de prueba de otro (`wa_cancelar_clase_de_prueba`, `reservaVigenteDeSupabase`).

**Evidencia.** `wa_identify_by_phone`, `wa_es_familia_sin_registrar`, `wa_invitacion_pendiente_por_telefono`, `wa_cancelar_clase_de_prueba`, `wa_normalize_phone10_co` (vía `wa_identify_staff_admin_by_phone`) en la base viva; en el BFF `celular10` (factura-pagador.service.ts), `telefonoDeLeadWa`/`variantesTelefonoLead` (whatsapp-prospecto-lead.service.ts), `telefonoDelLead`/`reservaVigenteDeSupabase` (whatsapp-clase-cortesia.service.ts).

**Medido hoy:** 238 conversaciones, todas con número colombiano (`57` + 10). **Ninguna explotación.** Perfiles: todos los celulares guardados tienen 10 dígitos o `57`+10.

**Arreglo.**
- Migración `20261008164914_wa_telefono_solo_colombia_y_numero_de_personal.sql`: función nueva `wa_celular_remitente_co` (10 dígitos o `57`+10, si no NULL) aplicada al **remitente** en las 5 RPC. Lo **guardado** sigue con la regla de siempre: hay 8 fichas con dos números pegados (20 dígitos) que se reconocen por los últimos 10 y no se quieren perder.
- BFF: `celular10` estricto; los teléfonos de prospecto usan `celular10` (un extranjero se guarda y se busca con todos sus dígitos).

## 2. P1 vivo — número del equipo en el perfil de otro acudiente

**Escenario.** El celular de la dueña está cargado en el perfil de otra persona con hijos activos. La dueña escribe al número de la escuela → la identifica como esa familia. Mismo caso con un entrenador: el entrenador NO tiene acceso a dinero, pero por WhatsApp ve los pagos de esa familia.

**Medido hoy (SELECT):**
- 5 perfiles de acudiente con el celular de una dueña (5 escuelas), 1 con el de un entrenador; 2 de esas escuelas tienen WhatsApp.
- Escuela `ec26397b…`: conversación de la dueña vinculada al acudiente `3cf2aedd…` (2 hijos). Se verificó por OTP con un correo que **no** es el de ese acudiente, y luego el teléfono pisó el vínculo. 38 respuestas del bot, entre ellas `get_payment_status`.
- Escuela `2d509571…`: conversación del entrenador `fe607d5e…` vinculada al acudiente `1a9a3189…` (3 hijos, nombre distinto). Recibió `get_payment_status` y `get_payment_methods`.
- Teléfono compartido entre dos acudientes con hijos en la misma escuela: 3 números / 7 perfiles → `ambiguo` (bien).

**Evidencia.** `wa_identify_by_phone` solo busca `profiles.phone` de quien tiene hijos activos; `clasificarContacto` (whatsapp-atencion.service.ts) pregunta por familia ANTES que por staff, y en el bot (`handleIdentification`) no se pregunta por staff.

**Arreglo (misma migración).** Si el número también es de un miembro activo del equipo (rol ≠ parent/athlete) que NO es el acudiente encontrado → `{"estado":"ambiguo","motivo":"numero_de_personal"}` (el bot y la cola ya escalan `ambiguo` a una persona) y se deshace el vínculo hecho solo por teléfono. Radio medido: **2 conversaciones** pasan a ambiguas (las dos de arriba); ninguna otra cambia. El vínculo con OTP **del correo de ese mismo acudiente** se respeta.

Además, a mano: corregir el teléfono de esos 6 perfiles (lo decide la escuela).

## 3. P1 — vínculo viejo cuando el número se vuelve ambiguo

`revisarVinculoPorTelefono` (whatsapp-bot.service.ts) devolvía `sin_cambio` con `ambiguo`, y la RPC tampoco deshacía nada: la conversación seguía con el acudiente de antes. Arreglo: la RPC deshace el vínculo (sin OTP del correo de ese acudiente) y el bot relee la conversación; si quedó sin identificar, corta el turno con el mensaje de número ambiguo y escala.

Probado en la base local `sportmaps-qa-twin` (transacción con ROLLBACK, datos sintéticos): extranjero → `desconocido/no_es_celular`; colombiano normal → `identificado`; mismo número que un coach → `ambiguo/numero_de_personal` y la conversación queda `identified=false`.

## 4. P2 — el OTP desde el celular de otro no caduca

Medido: 2 conversaciones verificadas por OTP; en 1 el número no es el del acudiente. El código lo deja así a propósito («no quitarle el canal a quien lo tenía bien»), pero el vecino o la persona del celular prestado conserva acceso a los pagos para siempre. Propuesta: `verified_at` por OTP vence a los 30-60 días si el número no resuelve a ese acudiente.

También: 2 conversaciones siguen vinculadas a un acudiente sin hijos activos en esa escuela (`get_payment_status` igual le muestra sus cobros; es la misma familia, riesgo bajo).

## 5. P2 — enumeración de correos

`arrancarOtp` → `correoNoEncontrado` dice «No encuentro el correo …». Pero `wa_start_identification` busca en **todos** los perfiles de la plataforma (`LIMIT 1`, sin escuela): desde cualquier WhatsApp se puede preguntar sin límite si un correo tiene cuenta en SportMaps. (Antes del 10-07 respondía igual en ambos casos.) Además, un correo de otra escuela «coincide» y verifica, aunque después no vea datos. Propuesta: que `email_matches_parent` exija hijos activos o cobros en ESA escuela, y un tope por contacto (p. ej. 3 correos por hora).

## 6. P2 — OTP

- `Math.random()` para el código → **arreglado** a `crypto.randomInt`.
- Hash SHA-256 sin sal de 6 dígitos: quien lea la tabla lo invierte al instante (requiere acceso a la base; riesgo bajo). Propuesta: HMAC con secreto del BFF.
- 5 intentos por código, pero `wa_start_identification` reinicia `attempts=0` en cada correo. Cada ronda manda un correo nuevo al dueño de la cuenta, así que la fuerza bruta (~1/200.000 por ronda) es ruidosa e impráctica; aun así conviene un tope de reenvíos por contacto/día. Medido: 4 OTP enviados en total, máx. 3 en una conversación, 0 con 3+ intentos fallidos.
- Reutilización: el hash se consume al verificar (bien).

## 7. P2 — contactos `personal`

El webhook guarda solo metadatos cuando la conversación ya está marcada (`esContactoPersonal`, routes/whatsapp.ts) y la cola/transcripción no corren. Pero:
- 7 conversaciones personales; **246 mensajes con texto** guardados (de antes de marcarlas; 142 de las últimas 48 h, en 2 conversaciones marcadas hoy). No se borran al marcar (decisión pendiente, ver docs/migraciones-para-aplicar-2026-10-07/).
- Conversación `a04e9af6…`: 1 mensaje entrante con texto guardado **hoy 16:28** entre mensajes ya sin contenido. Causa probable: `esContactoPersonal` falla abierto ante un error de lectura (`return false`). Propuesta: hacer la verificación dentro de `wa_ingest_inbound_message` (atómica) y fallar cerrado.
- Stickers previos a la marca conservan el id del medio en el payload (menor).

## 8. P2 — ficha sin cuenta con el celular de la dueña

1 ficha activa sin cuenta (`parent_phone_temp`) tiene el celular de la dueña de su escuela. Si la dueña escribe, el bot la trata como «familia sin cuenta» y le manda el enlace de la invitación **con el correo de esa familia en la URL**. Propuesta: aplicar la misma regla del punto 2 en la rama `debe_registrarse` y no precargar el correo cuando el número es del equipo.

## Herramientas revisadas (punto 2 del encargo)

| Herramienta / flujo | Filtro | Veredicto |
|---|---|---|
| `get_payment_status` → `wa_get_payment_status(parent_id, school_id)` | `payments.parent_id` + `school_id` | OK |
| enlaces de pago (`conEnlacesDePago`) | `parent_id` + `school_id` | OK |
| `get_payment_methods`, `get_school_info` | datos públicos de la escuela | OK |
| cortesía (`get_trial_class_info`) | por teléfono → ver punto 1 | arreglado |
| ausencias (`candidatosDeLaFamilia`) | hijos del `parent_id` + inscripciones de esa escuela | OK |
| ventas (`wa_crear_cobro_suelto`) | valida hijo ∈ familia ∈ escuela | OK |
| reclamo de valor / estado de comprobantes | `parent_id` + `school_id` | OK |
| `/p/:token` | token 144 bits, nombre corto + monto + otros pendientes del mismo pagador | OK por diseño; quien tenga el enlace ve los pendientes del pagador (incluidos los de hermanos) |
| inyección por chat | 5 herramientas **sin parámetros**; el modelo nunca recibe ids ni nombres de otra familia; `filtrarSalidaDelModelo` corta filtraciones del prompt | OK: pedir «el saldo de Juan Pérez» o «cámbiame de familia» no tiene por dónde salir |

## Lo que falta hacer (no lo hace este informe)

1. **Aplicar** la migración `20261008164914` (CLI de Supabase o `apply_migration`) y correr las verificaciones del final del archivo. Sin aplicarla, los puntos 1-3 siguen vivos en producción (el BFF solo cubre factura y prospectos).
2. Corregir los 6 perfiles de acudiente con número del equipo.
3. Decidir los P2 (4, 5, 7, 8).
