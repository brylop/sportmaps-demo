# Playbook: conectar una escuela nueva al bot (Mapi) y a su web

**Qué es:** el orden, las preguntas y las trampas para repetir lo que se hizo con Dynasty (conectada) y Besser (en proceso). Sale de la revisión del 2026-10-21. **Cuándo usarlo:** antes de hablar con una escuela nueva y de nuevo una semana después de conectarla.

---

## 0. Diagnóstico en 30 segundos (antes de llamar a nadie)

```bash
cd bff
npx tsx scripts/wa-alistamiento-escuela.ts "<parte del nombre>"
```
Solo lee. Da 11 secciones y un veredicto: **bloqueantes** (resolver antes de conectar) y **avisos** (primera semana).

| Sección | Qué mide | Si falla |
|---|---|---|
| 1 Teléfonos | % de atletas con celular usable | < 95 %: el bot no los reconoce y pide un correo que muchos no tienen |
| 2 Pagador | cobros abiertos sin pagador | El bot puede decir «estás al día» debiendo. Ojo: parte son fichas sin cuenta, que el bot resuelve por la ficha; revisar caso a caso |
| 3 Cuentas | cuentas de pago cargadas | Sin ellas marca en rojo comprobantes legítimos |
| 4 Facturación | pagos sin documento/dirección | No se facturan nunca |
| 5 Hermanos | teléfonos con 3+ atletas | El bot se pasa del tope de opciones |
| 6 Horarios | equipos sin horario / sin categorías | Dice «no lo tengo» (correcto) y la escuela recibe la pregunta |
| 8 Inscripción | QR vivos, cuál manda el bot, conversión, plan de $0 en QR que cobra | Ver §3 |
| 9 Políticas | abonos, modo de cortesía, cortesía única | Ver §2 |
| 10 Cuentas nuevas | acudientes de 60 días sin WhatsApp | El registro con Google no lo pide (42 % sin WhatsApp vs 15 % con correo) |
| 11 Bandeja | contactos sin clasificar, motivos de los casos (solo conectada) | Ver §6 |

Referencia (2026-10-21): Dynasty 246 cobros sin pagador, 2/56 cuentas nuevas sin WhatsApp, 59 conversaciones sin tipo, 50 casos pendientes. Besser: 25 cobros sin pagador, conversión 5 %.

## 1. Datos que el bot lee (cargarlos antes de conectar)

| Dato | Dónde | Lo usa para |
|---|---|---|
| Teléfono del acudiente | `profiles.phone` o ficha (`parent_phone_temp`, `guardian_phone`) | reconocer quién escribe |
| Planes y precios | `offering_plans` (activos, precio > 0) | «¿cuánto cuesta?» |
| Grupos y horarios | `teams.schedule` (día 0=dom … 6=sáb), sede en `place` | horarios, «hay entreno hoy», franjas de cortesía |
| Categorías / edades | `school_categories` y `teams.category_id` | «¿qué grupo le corresponde a mi hija de 12?» |
| Cuentas de pago | `school_settings.payment_accounts` (con `only_for` y `fuera_de_sportmaps`) | cómo pagar y validar el destino del comprobante |
| QR de inscripción | `school_join_qr_codes` | el enlace que manda el bot |
| Horario de atención | `whatsapp_settings.business_hours` | «te responden hoy a las 16:00» |

Sin categorías el bot calcula el grupo con el año del nombre y la edad real de los atletas (confianza media o baja). Sin horarios no contesta. Los rangos de edad dudosos se proponen en SQL y **los confirma la escuela** (ejemplo: `docs/migraciones-para-aplicar-2026-10-07/PROPUESTA_edades_grupos_dynasty_besser.sql`).

## 2. Decisiones que solo la escuela puede tomar (preguntarlas el primer día)

1. **¿Recibe abonos?** (`allow_installments`, mínimo, máximo de pagos). Hoy el bot **no entiende abonos**: con `true` trata todo monto menor como «no cuadra». Dynasty (no recibe) tuvo 10 familias pagando en partes en 3 semanas; Besser (sí recibe, mínimo $105.000, 2 pagos) va a chocar con esto.
2. **¿A qué cuentas les pagan realmente?** Incluidas las personales del entrenador o del fundador para torneos. Cada cuenta no registrada genera «cuenta que no es de la escuela» a una familia que pagó bien.
3. **Cortesía:** ¿clases de prueba por franjas (`clase`) o una semana por la app (`semana_app`)? ¿Una sola vez por deportista (`cortesia_unica`)?
4. **Edades de cada grupo** (y si Seniors es 18+ o 35+: Dynasty tiene la web en 35+ y el bot en 18+).
5. **Calendario de torneos:** ¿dónde vive? Hoy ninguna escuela lo tiene estructurado y `web-torneos` siempre termina en una persona.
6. **Quién atiende y en qué horario** (y que el bot se calla 15 minutos cuando ella escribe, 3 horas si lo siguiente es un saludo).
7. **¿Qué contactos son personales o de negocio?** Se marcan con «Tipo de contacto»; sin marcar ensucian métricas y bandeja.

## 3. Inscripción y web

- **Un solo QR abierto por escuela, o fijar cuál manda:** el bot elige el QR `open` activo con más altas. Con dos, el segundo puede pasar al primero y el bot cambia de enlace solo (Dynasty: 128 contra 68).
- **Un QR que cobra no debe ofrecer el plan de $0** (Besser: alguien se inscribía gratis). Con `cortesia_unica = true` ya se filtra.
- **Cortesía única:** hoy solo cubre el QR sin cobro. No cubre el formulario `/inscripcion/<slug>`, la clase de prueba web (`/agendar-clase/<slug>`) ni WhatsApp. Verificar que las tres escriban en la misma tabla de prospectos.
- **Slug:** la escuela es `<slug>` y el QR tiene su propio slug. Nunca enlazar `/join/<slug-de-escuela>` si no existe un QR con ese slug.
- **Registro del acudiente:** pide nombre, WhatsApp, correo y contraseña (o Google). **Google no pide WhatsApp**: hay que pedirlo después del login, porque es la identidad del bot. Los campos no declaran `autoComplete`; Chrome rellena a ciegas.
- **Los mensajes de WhatsApp precargados de la web** terminan en `(ref: web)` o `(ref: web-<tema>)`, con la etiqueta **al final**. Hoy el bot entiende `web`, `web-agendar`, `web-inscripcion`, `web-torneos` (y `web-pagos` por las palabras). Un tema nuevo hay que enseñárselo en `PROSPECTO_FUERTE` (`whatsapp-atencion.service.ts`).
- **Traspaso a quien arma la web:** copiar y adaptar `docs/integracion-bot-web-dynasty-2026-10-21.md`.

## 4. Conectar el número

1. El dueño abre SportMaps → **WhatsApp → «Conectar WhatsApp»**, con su Facebook, desde el celular con **WhatsApp Business** (Coexistence: «conectar la cuenta existente», no crear una nueva). Tarda unos 10 minutos.
2. Activar el bot (ajustar el id de integración): `update whatsapp_settings set ai_enabled = true, mode = 'assisted', business_hours = '{"tz":"America/Bogota","dias":{"1":["09:00","15:00"],…}}' where integration_id = …`. Pasar a `auto` solo después de revisar la primera semana.
3. Copiar las plantillas aprobadas: `npx tsx scripts/wa-copiar-plantillas.ts --desde <escuela> --hacia <escuela> --aplicar`.
4. Prueba con un número propio: saludo, precio, horario de hoy, clase de cortesía, un comprobante.
5. Ajustes por escuela (apagados por defecto): `wa_modo_cortesia`, `wa_cortesia_qr_id`, `wa_cortesia_dias`, `wa_ayuda_app`, `wa_reclamos_de_valor`, `wa_responder_precios` (en `school_settings`) y `responder_desconocidos` / `responder_prospectos` (en `whatsapp_settings`). Spec: `docs/specs/whatsapp-ajustes-por-escuela.md`.

**Qué NO prometer:** abonos automáticos, calendario de torneos, que el bot apruebe pagos, que vea imágenes que no sean comprobantes.

## 5. Lo que hace el bot solo y lo que pasa a una persona

**Solo:** precios, grupo por edad, horarios y «¿hay entreno hoy?», clase de cortesía, enlace de inscripción, cobros de una familia identificada, lectura de comprobantes, avisos de ausencia con día explícito.
**A una persona (buzón):** comprobante con monto distinto o cuenta desconocida, reclamos de valor, torneos, uniformes, certificaciones, otros clubes y proveedores (en silencio).

## 6. Primera semana: qué mirar y cómo leerlo

**Bandeja (casos que piden acción).** El motivo dice de quién es el arreglo:

| Motivo | Quién lo resuelve |
|---|---|
| `monto_no_cuadra` | la escuela (abonos o pagos en partes) |
| `destino_ajeno` | la escuela: registrar la cuenta si es válida |
| `sin_familia` / `familia_sin_cuenta` | el teléfono no está en la ficha: vincularlo (hoy a mano) |
| `otro_concepto` | la escuela aplica a torneo, uniforme o clase extra |
| `contacto_no_atendido` | número que no es familia: su archivo **no se guarda**; marcar el tipo |
| `token_decrypt_failed` / `archivo_no_disponible` | pedir a la familia que reenvíe |

**Consultas de revisión** (reemplazar `<integracion>` por el id de `school_whatsapp_integrations`):
```sql
-- Mensajes por día y por tipo de respuesta del bot
select (created_at at time zone 'America/Bogota')::date d,
  count(*) filter (where direction='inbound') entrantes,
  count(*) filter (where direction='outbound' and ai_generated) mapi,
  count(*) filter (where direction='outbound' and not ai_generated) persona
from whatsapp_messages where integration_id='<integracion>' and created_at>=now()-interval '14 days' group by 1 order by 1;

-- Respuestas del bot por paso (qué hace de verdad)
select payload->>'step' paso, count(*) from whatsapp_messages
where integration_id='<integracion>' and direction='outbound' and ai_generated and created_at>=now()-interval '7 days' group by 1 order by 2 desc;

-- Cuentas a las que dijo «cuenta ajena»
select substring(text_body from 'cuenta \*([^*]+)\*') cuenta, count(*) from whatsapp_messages
where integration_id='<integracion>' and payload->>'step'='destino_ajeno' group by 1 order by 2 desc;
```
Cada respuesta del bot sale con su `payload->>'step'`: leer las de los pasos `ausencia_registrada`, `destino_ajeno`, `otro_concepto` y `llm_text` revela casi todos los errores.

**Cómo leer la caída del bot.** El volumen del bot sube el primer día (atraso) y baja a un 20 % de lo que entra. Es normal: se calla ante otros clubes, proveedores, cierres («quedo atenta», «gracias»), contactos personales y cuando la escuela escribe. Una baja fuerte sin cambio de reglas es la señal para investigar.

## 7. Trampas conocidas (cada una costó una respuesta equivocada a una familia)

1. Seis dígitos dentro de una frase (cédula, monto) **no** son un código de verificación.
2. «Los sábados», «este mes», «durante dos meses», «el torneo del 7 de noviembre» **no** son «no va hoy».
3. El OCR lee `O` por `0` en las cuentas numéricas y la llave Bre-B trae un `@` delante: ambas se normalizan.
4. Un saludo suelto («Hola amor») tras un mensaje de la escuela no debe recibir la presentación del bot.
5. «¿Hay entreno hoy?» debe contestarse también a familias identificadas, no solo a desconocidos.
6. Una invitación de otro club («jugar un amistoso», «los esperamos en nuestra sede», «Amistoso X» a secas) va al buzón en silencio.
7. Con una sola hija inscrita el bot asume que cualquier ausencia es de ella; con segundo nombre («Paula» por «María Paula») hay que comparar todos los nombres de pila.
8. Un comprobante a una cuenta ajena **no** se contesta si la escuela está escribiendo en ese chat.
9. Un número en dos cuentas recibe «no quiero mostrarte información que no sea tuya» incluso cuando solo pide información pública.
10. **Migraciones:** una sola sesión aplica DDL (cada una recarga el esquema de PostgREST y la base es una sola para todos los ambientes); generar tipos una vez al final; parchear con guarda de md5 y de ancla, nunca reemplazar a ciegas.

## 8. Rollout

Se trabaja solo en `develop`. `staging` y `main` los sube el usuario; el bot de producción corre desde `main`, así que **nada de lo hecho en `develop` protege a una familia hasta que `main` se actualice**. Una migración se aplica una vez y se commitea con `supabase/migrations_ledger.json`.

## 9. Pendientes que benefician a todas las escuelas (por valor)

1. Que el bot entienda abonos cuando `allow_installments = true`.
2. Pedir el WhatsApp después de entrar con Google.
3. Vincular el teléfono a la ficha al aplicar el comprobante de un número desconocido (causa de ~30 de los 51 casos de Dynasty).
4. Calendario de torneos estructurado que lean el bot y la web.
5. Guardar el `ref` y el origen del prospecto (`how_heard = 'web'`).
6. Cortesía única en todos los canales (hoy solo el QR).
7. Guardar los archivos de números desconocidos que traen pie de pago o no traen texto.
8. Un endpoint público con planes, grupos, horarios y sedes para que la web deje de copiarlos a mano.
