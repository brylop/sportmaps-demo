# Importar comprobantes desde un chat exportado de WhatsApp

Estado: **construido en develop (2026-10-05), sin desplegar ni probar con un chat real.**

## 1. Problema

Dynasty conectó su WhatsApp por Coexistence el 2026-10-02. Los comprobantes que
las familias mandaron ANTES solo existen en el celular de la dueña ("tengo muchos
comprobantes de padres sin subir"). Subirlos uno por uno desde el panel son
cientos de clics, y la API de Meta no da acceso al historial previo a la conexión.

## 2. Solución

WhatsApp permite **Exportar chat → Incluir archivos**: genera un `.zip` con el
texto (`_chat.txt` en iOS, `Chat de WhatsApp con X.txt` en Android) y las fotos.
La escuela sube ese zip en **WhatsApp → Bandeja → Importar chat exportado**:

1. `POST /api/v1/whatsapp/:schoolId/importar-chat/analizar` (cuerpo: el zip). El
   BFF lee el texto, ubica cada adjunto (remitente + fecha) y responde quién mandó
   fotos. Si el remitente aparece como número (contacto no guardado) se identifica
   por teléfono en modo lectura; si está guardado con nombre, la UI pide elegir el
   acudiente **una vez por chat** (lista de acudientes con cuenta y atleta activo,
   con buscador por acudiente, atleta o últimos 4 dígitos).
2. `POST /api/v1/whatsapp/:schoolId/importar-chat?remitente=…&parentId=…` (el
   mismo zip). Procesa hasta 15 fotos por llamada (OCR de 5-20 s cada una); la UI
   repite hasta `quedan = 0`.

Cada foto sigue **el mismo camino que la recuperación de la cola**
(`services/whatsapp-recuperacion.service.ts`, Tarea A): OCR → destino de la
escuela → referencia/imagen ya usadas → pago ya registrado por ese monto/fecha →
`resolverPago` del worker. Resultado: el cobro queda `awaiting_approval` con el
comprobante (visible en Gestión de pagos → Por validar), **nunca aprobado** y
**sin mensaje a la familia**. Lo demás (ya registrado, varios cobros posibles,
sin pendientes, otra cuenta destino) queda como fila `ignored/escalated` en la
bandeja con su motivo.

## 3. Decisiones

- **Fila en `whatsapp_inbound_queue` por foto**, con `wa_message_id =
  'import:<sha256>'`. El UNIQUE hace idempotente reimportar el mismo chat (o la
  misma foto en dos chats): se salta antes de pagar OCR. La fila se inserta **ya
  cerrada**; nunca pasa por `pending`, que es lo que toma el cron del worker.
- `outcome_notified_at` se marca al cerrar: el job de desenlace no le escribe a
  la familia cuando la escuela apruebe.
- El archivo va al mismo bucket que el worker:
  `payment-receipts/{school}/whatsapp/import-<sha>.{ext}`.
- Fecha: la del nombre del archivo si la trae (`IMG-YYYYMMDD-WA…`,
  `…-PHOTO-YYYY-MM-DD-HH-MM-SS`), si no la de la línea (día/mes, español). La que
  manda para buscar duplicados es la del comprobante leído por el OCR.
- Sin dependencias nuevas: `utils/zip-lector.ts` lee el zip con `zlib` (métodos
  guardado y deflate; zip64 y cifrado se rechazan).
- Topes: zip ≤ 40 MB, archivo ≤ 8 MB (el mismo que se acepta de Meta), solo
  jpg/png/webp/pdf, ≤ 5000 entradas, inflado cortado por `maxOutputLength`.
- Solo admin/owner de la escuela (`administraEstaEscuela`, igual que el resto del
  buzón).

## 4. Lo que NO hace

- **Familias sin cuenta.** Sus cobros no tienen `parent_id` y el motor del worker
  (`pagosPendientesDe`) busca por acudiente. Esas fotos hay que registrarlas a
  mano ("Registrar pago → adjuntar comprobante"). Ampliar el motor a
  `child_id`/`unregistered_athlete_id` es un cambio aparte.
- **Chats de grupo**: funciona, pero cada remitente se importa por separado.
- No intenta reconocer el formato de fecha mes/día salvo que el propio chat lo
  delate (algún "día" > 12).

## 5. Verificación pendiente

- Probar con un zip real de iOS y uno de Android exportados desde el celular de
  la escuela (los formatos de prueba en `whatsapp-chat-exportado.test.ts` salen
  de la documentación pública y de exportaciones conocidas, no de Dynasty).
- Verificar en Render que un zip de 30-40 MB pasa el proxy (`express.raw` acepta 40 MB).
