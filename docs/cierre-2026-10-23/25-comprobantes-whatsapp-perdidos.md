# #25 · Comprobantes de WhatsApp perdidos (`token_decrypt_failed`)

Informe de solo lectura · 2026-10-23 · ROADMAP v2.38, ítem 5 de v2.36. No se escribió nada en la base ni en el código.

## Veredicto

La causa **ya está cerrada en código y no se ha repetido**; lo que queda es **recuperar 4 comprobantes** que se quedaron en `failed` y el rastro del incidente.

- **Causa:** un BFF levantado en un computador (código viejo y otra `WHATSAPP_TOKEN_ENC_KEY`) tomó la cola de producción, porque todos los ambientes comparten una sola base. No pudo descifrar el token de la integración, falló antes de llamar a Meta y cerró la fila en `failed`.
- **Cómo se sabe que fue un consumidor viejo:** las 4 filas tienen `retries = 0` y se cerraron entre 10 y 60 segundos después de crearse. El código actual (`esTransitorio`, `bff/src/jobs/whatsapp-queue.job.ts:336`) reintenta ese error en vez de cerrarlo, así que no pudo ser el BFF de Render con el código vigente.
- **Qué lo identifica:** nada en la cola. `whatsapp_inbound_queue` no tiene columna de host o instancia (solo `locked_until`), por eso el consumidor se infiere por el patrón de arriba, no se lee.
- **Arreglo ya aplicado:** commit `e63b36d6` (2026-10-13 19:26), `bff/src/jobs/crons-solo-en-render.ts`. Los crons, la cola incluida, solo arrancan si `RENDER=true`, si `RENDER_SERVICE_ID` empieza por `srv-` o si se pide `CRONS_LOCALES=true`. Está conectado en `bff/src/index.ts:562` y tiene prueba (`crons-solo-en-render.test.ts`). El último `token_decrypt_failed` es del 13-oct 18:36, antes de ese commit, y **no hay ninguno después** (10 días).

## Cifras (base viva, 23-oct)

Filas de `whatsapp_inbound_queue` creadas desde el 10-oct, en `failed`:

| Causa | Filas | Fechas | Estado |
|---|---|---|---|
| `token_decrypt_failed` | 4 | 10-oct, 11-oct (2), 13-oct | Recuperables, ver abajo |
| `archivo_muy_grande:12850071` (PDF de 12,8 MB) | 1 | 20-oct | Permanente: pasa el tope; la escuela lo revisa a mano |
| `no se entendió la elección; va al inbox` | 1 | 9-oct | Ya está en el buzón de una persona |

Además, 4 filas del 3 al 5-oct `failed` con «archivo_no_disponible». Se intentó recuperarlas el 15-oct y Meta ya no tenía el archivo: **perdidas**, hay que pedirle a la familia que reenvíe.

Nada queda en `pending` ni `processing`: la cola está al día.

**Mensajes perdidos (regla del roadmap, `wa_timestamp` contra `created_at`):**
- `whatsapp_inbound_queue`: 176 filas desde el 10-oct, retraso máximo 10 s, 0 con más de 10 min.
- `whatsapp_messages` entrantes: 3.417 desde el 10-oct, retraso máximo 3 min 18 s, 0 con más de 10 min.
- Único hueco de más de 10 h entre mensajes entrantes desde el 12-oct, en la integración de Dynasty: del 13-oct 20:47 al 14-oct 10:31 (13,7 h). Coincide con la caída por Disk IO, no con este fallo.

## Los 4 a recuperar

Todos son de DYNASTY VOLLEY CLUB (`2d509571-…`), imagen JPEG con `media_id`, sin padre identificado y sin archivo guardado.

| id | Llegó | Teléfono (últimos 4) | Reenvíos en 3 días |
|---|---|---|---|
| `465c6bfd-d0da-4006-8700-544afeb61628` | 10-oct 18:19 | 1883 | 0 |
| `5e0ee73f-7c19-4155-9339-a00f0fe3b0c6` | 11-oct 11:05 | 0001 | 1 (quedó `ignored`, sin resultado) |
| `8d40ae4e-5408-4b7d-a1a0-1f985ef44794` | 11-oct 12:08 | 7295 | 0 |
| `e4870092-2697-4ea2-b3d4-c70643fd36c7` | 13-oct 18:36 | 8923 | 0 |

**Plazo:** Meta conserva el archivo unos 30 días, y las de 3 a 5 de octubre ya no estaban a los 10 días. Conviene hacerlo **ya**; como límite duro, antes del 9-nov (el más viejo cumple 30 días el 10-nov).

## Cómo reprocesarlos sin duplicar cobros (preparado, NO ejecutado)

`wa_queue_claim` solo toma filas en `pending` y en `processing` con el lease vencido, así que una fila `failed` nunca vuelve sola. Y `scripts/wa-recuperar-comprobantes.ts` tampoco toma `failed`: solo `ignored` con ciertos motivos y `pending`. Por eso se devuelven a `pending` y los procesa el worker normal de Render, que ya tiene el reintento y la protección contra duplicados (huella del archivo y chequeo de cobro ya registrado).

1. **Revisar antes de tocar nada** (lectura): que ninguna de las 4 familias haya pagado por otro canal. Ya hecho para reenvíos por WhatsApp: solo la fila `5e0ee73f` tuvo un reenvío y no dejó cobro. Falta cruzar con `payments` por familia cuando el worker las identifique.
2. **Una sola vez**, con el BFF de Render vivo y sin que ningún BFF local esté corriendo:

```sql
-- Solo las 4 filas; el guard repite la causa por si alguien ya las tocó.
update public.whatsapp_inbound_queue
   set status = 'pending', retries = 0, error_message = null,
       processed_at = null, locked_until = null, next_retry_at = null, updated_at = now()
 where id in ('465c6bfd-d0da-4006-8700-544afeb61628',
              '5e0ee73f-7c19-4155-9339-a00f0fe3b0c6',
              '8d40ae4e-5408-4b7d-a1a0-1f985ef44794',
              'e4870092-2697-4ea2-b3d4-c70643fd36c7')
   and status = 'failed' and error_message like 'token_decrypt_failed%';
```

3. **Verificar** a los 2 minutos: las 4 deben quedar `done` o `ignored` con motivo (`en_revision`, `sin_familia`…), nunca `failed`. Lo que quede en revisión lo aprueba la escuela a mano: el worker no aprueba nada solo.
4. Si alguna vuelve a `failed` con otra causa, no insistir: pedir a la familia que reenvíe.

## Qué más se puede endurecer (no urgente, no implementado)

- **Rastro del consumidor:** columna `locked_by` (host o `RENDER_SERVICE_ID`) estampada por `wa_queue_claim`. Hoy el responsable de un fallo se adivina; con la columna se lee. Requiere migración, así que va por el flujo de una sola sesión.
- **Cerrar sin reintento ya no existe en el código vigente**; si aparece otro `failed` con `retries = 0` y cierre en menos de un minuto, es la huella de un BFF con código viejo y se busca por ahí.
- **Compuerta de la llave:** que el BFF falle al arrancar si la integración activa no descifra con su llave, en vez de tomar la cola y fallar fila por fila.

No se tocó código: el cambio mínimo que se pensaba proponer (tomar solo filas del propio entorno) ya está hecho con `e63b36d6`.
