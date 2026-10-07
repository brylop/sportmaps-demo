# Conciliación por correo del banco verificado con DKIM

**Estado:** backend listo detrás de un flag por escuela **apagado** (2026-10-07). Falta la configuración externa (§6) y la pantalla de la escuela (§7).
**Origen:** plan maestro de cobros §4.6 y Fase 1.3 (`docs/specs/plan-maestro-cobros-2026-10.md`). Memoria: *notificaciones del banco por correo (DKIM)* y *conciliación bancaria pendiente*.
**Migración:** `supabase/migrations/20261007163138_conciliacion_correo_banco_dkim.sql` (sin aplicar).

---

## 1. Por qué

Un comprobante es una imagen; ninguna heurística sobre una imagen prueba que hubo una transferencia (el 2026-09-16 un PNG fabricado pasó los nueve controles de `receipt-verdict`). La notificación que el banco le manda a la escuela **sí** mira el dinero, y se puede verificar criptográficamente: Nequi firma con DKIM (`d=notificaciones.nequi.com.co`, `s=smtp1`, `relaxed/relaxed`, `To` dentro de `h=`) y publica DMARC `p=REJECT`.

Orden de confianza del plan maestro (principio 6): webhook de pasarela > **correo del banco con DKIM** > extracto > OCR > registro manual.

## 2. Flujo

```
Banco ──correo firmado──▶ buzón de la escuela (Gmail)
                             │ filtro de reenvío automático
                             ▼
          banco+<token>@<BANK_INBOUND_DOMAIN>   (Resend Inbound)
                             │ webhook email.received (firma Svix)
                             ▼
  POST /api/v1/webhooks/resend-inbound
    1. verifica Svix sobre el cuerpo crudo ──────────── 401 si no
    2. <token> → escuela (bank_email_inboxes) ────────── 200 «ignorado» si no existe
    3. flag school_settings.bank_email_reconciliation_enabled ── 200 «ignorado» si está apagado
    4. ¿ya se procesó esta entrega? (resend_email_id) ── 200 «duplicado» / retoma cruce
    5. GET /emails/receiving/{id} → raw.download_url → MIME crudo
    6. verifica DKIM sobre el MIME (o el original adjunto)
    7. guarda el aviso (idempotente por message-id + sha256 del cuerpo)
    8. parser (banco-correo-parser) → monto, fecha, hora, remitente, destino
    9. cruce determinístico → RPC bank_email_notice_apply (atómica)
```

Código:

| Pieza | Archivo |
|---|---|
| Ruta | `bff/src/routes/resend-inbound.routes.ts` |
| Svix + DKIM | `bff/src/services/banco-correo-dkim.service.ts` |
| Cruce + orquestación | `bff/src/services/banco-correo-cruce.service.ts` |
| Supabase + API de Resend | `bff/src/services/banco-correo-repo.service.ts` |
| Parser (ya existía) | `bff/src/services/banco-correo-parser.service.ts` |
| Tests | `banco-correo-dkim.test.ts`, `banco-correo-cruce.test.ts`, `resend-inbound.routes.test.ts`, helper `bff/test/correo-firmado.ts` |

## 3. Verificación DKIM — qué se exige

Librería: **`mailauth`** (postalsys, autor de Nodemailer; MIT; publicada el 2026-10-04). Se eligió porque es la implementación de DKIM/SPF/DMARC/ARC más usada en Node, verifica sobre el MIME crudo, admite un **resolver de DNS inyectable** (los tests firman y verifican de verdad con llaves de prueba, sin red) e informa la alineación DMARC y los encabezados firmados. El texto del correo se lee con `mailparser` (mismo autor).

Se rechaza (estado `rechazado`, con `motivo`) si falta cualquiera de estas:

1. Un solo `From:`, de un dominio de banco en lista blanca (`DOMINIOS_BANCO`: `nequi.com.co`; `notificacionesbancolombia.com`, `bancolombia.com.co`, `bancolombia.com`; subdominios incluidos). → `remitente_no_es_banco`, `from_multiple`
2. Una firma `pass` de un dominio de **ese** banco, alineada con el `From:`. → `dkim_invalido`
3. Sin `l=` (firma de cuerpo parcial) y sin `rsa-sha1`. → `dkim_cuerpo_parcial`, `dkim_algoritmo_debil`
4. `To:` dentro de los encabezados firmados, uno solo, y que sea uno de los **buzones registrados** por la escuela. → `to_no_firmado`, `to_multiple`, `buzon_no_registrado`, `buzon_no_configurado`

El punto 4 es el que cierra el ataque obvio: cualquiera puede mandarse plata a sí mismo, recibir un aviso **real** de Nequi y reenviarlo a la dirección de la escuela. La firma es válida, pero el `To:` firmado es el buzón del atacante.

### Reenvíos de Gmail

| Cómo reenvía la escuela | Resultado |
|---|---|
| **Filtro de reenvío automático** (lo que se configura) | Gmail reenvía el original sin tocar cuerpo ni encabezados firmados → **pasa** |
| «Reenviar como archivo adjunto» | Se verifica el `message/rfc822` adjunto → **pasa** (`via_adjunto = true`) |
| Botón «Reenviar» en línea | El original queda citado y la firma desaparece → **rechazado**. No se verifica una cita |

El texto que se lee (monto, fecha, nombre) sale siempre del mensaje cuya firma se verificó.

Al crear el filtro, Gmail manda un **código de confirmación** a la dirección de reenvío. Llega por el mismo webhook (firmado por `google.com`, dirigido a nuestra dirección) y se guarda como aviso en estado `confirmacion_reenvio` con `detalle.codigo` y `detalle.enlace`, para que la escuela lo vea. Por eso el flag tiene que estar encendido **antes** de configurar el filtro.

## 4. Datos

### Dirección de recepción (decisión)

Una por escuela: **`banco+<token>@<BANK_INBOUND_DOMAIN>`**, `token` = 20 hex (80 bits) en `bank_email_inboxes`. Se buscan en `to`, `cc`, `bcc` y `received_for` del evento: con el reenvío automático el `To:` sigue siendo el buzón de la escuela y nuestra dirección solo aparece como destinatario del sobre. El token no es el control de seguridad (lo es DKIM + `To:` firmado); solo evita adivinar direcciones de otras escuelas.

Dominio propuesto: arrancar con el subdominio de Resend (`<id>.resend.app`, sin tocar DNS) y pasar a `entrada.sportmaps.co` (MX en un **subdominio**: el MX raíz de `sportmaps.co` es de Google Workspace y no se toca).

### Tablas (una sola migración)

- `school_settings.bank_email_reconciliation_enabled boolean default false` — el flag. Lo puede cambiar el admin de la escuela con las policies existentes de `school_settings`.
- `bank_email_inboxes(school_id pk, token unique, mailboxes text[] ≤5)` — lectura: `user_admin_school_ids()`. Escritura: solo la RPC `bank_email_inbox_configure(school_id, mailboxes)` (admin de esa escuela).
- `bank_email_notices` — un aviso por fila. `estado` text + CHECK: `verificado`, `rechazado`, `no_es_aviso`, `confirmacion_reenvio`, `sin_cruce`, `candidato`, `ambiguo`, `conciliado`, `descartado`. Idempotencia: `resend_email_id UNIQUE` (entrega) y `UNIQUE (coalesce(message_id,''), body_sha256)` (contenido). Un pago solo puede quedar `conciliado` con **un** aviso (índice único parcial). Lectura: `user_staff_school_ids()`; sin policies de escritura (solo `service_role` y RPCs). `anon` sin grants.

Por qué no `bank_statement_lines`: un correo no es un extracto. `reconcile_statement()` glosa como `NO_APARECE_EN_BANCO` todo pago del rango que no aparezca; con correos sueltos eso abriría glosas falsas a familias que sí pagaron. Y el aviso guarda evidencia que una línea no tiene (dominio DKIM, `To:` firmado, message-id, hash).

### RPCs

| RPC | Quién | Qué |
|---|---|---|
| `bank_email_inbox_configure(p_school_id, p_mailboxes)` | admin de la escuela | Crea la dirección (token) o actualiza buzones. Devuelve `out_token`, `out_mailboxes` |
| `bank_email_notice_apply(p_notice_id, p_estado, p_payment_id, p_detalle)` | solo `service_role` | Aplica el cruce bajo `FOR UPDATE`; solo actúa si el aviso está `verificado` (idempotente). Para `conciliado` re-verifica que el pago sea de la escuela, esté `paid`, con conciliación `NULL`/`pendiente` y sin otro aviso; si no, lo deja `ambiguo` |
| `bank_email_notice_resolve(p_notice_id, 'confirmar'\|'descartar', p_payment_id?)` | admin de la escuela | `confirmar` **exige que el pago ya esté `paid`** (la escuela lo aprobó por el flujo normal) y lo concilia; `descartar` cierra el aviso |

## 5. Cruce (determinístico, sin IA)

- **Monto exacto** en pesos (pago pagado: `amount_paid ?? amount`).
- **Fecha:** contra `ocr_date` ±1 día; sin `ocr_date`, un pago pagado contra `payment_date` entre −1 y +3 días (`payment_date` es el día que la escuela aprobó, no el de la transferencia); un pendiente, `due_date` a ±45 días.
- **Cuenta/llave destino:** si el aviso y el comprobante la traen, los últimos 4 dígitos coinciden.
- **Nombre:** `mismoNombre()` contra `ocr_origin_name` o el acudiente; desempata.
- **Referencia:** no se usa; el correo del banco no la trae.

Decisión: con un único candidato (o único con nombre coincidente) → pagado ⇒ `conciliado` (`reconciliation_status = 'confirmado'`), pendiente ⇒ `candidato`. Varios ⇒ `ambiguo`. Ninguno ⇒ `sin_cruce`. Si el único candidato pagado se eligió solo por monto+fecha y el comprobante dice que pagó **otra** persona ⇒ `candidato` (puede ser justo el comprobante falso que el aviso no respalda). **Nunca se aprueba un pago.**

Medido 2026-10-07: `reconciliation_status` está en `NULL` en 1.149 pagos `paid`, `confirmado` en 151 y `pendiente` en 2; el cruce trata `NULL` igual que `pendiente`.

## 6. Configuración externa (checklist)

**Resend (cuenta de SportMaps)**
- [ ] Activar *Receiving* y anotar la dirección `<id>.resend.app` (arranque sin DNS).
- [ ] Opcional, después: dominio de recepción `entrada.sportmaps.co` — en Namecheap, registro **MX del subdominio** con el host/valor/prioridad que muestra Resend. **No** tocar el MX raíz (Google Workspace). Resend descarta correo de dominios cuyo MX no esté verificado.
- [ ] Crear el webhook `email.received` → `https://<bff-prod>/api/v1/webhooks/resend-inbound`. Copiar el *signing secret* (`whsec_…`).
- [ ] Crear una API key con permiso para leer correos recibidos.

**Render (solo el BFF que recibe el webhook — los tres comparten la base)**
- [ ] `RESEND_INBOUND_WEBHOOK_SECRET` = `whsec_…`
- [ ] `RESEND_INBOUND_API_KEY` = `re_…`
- [ ] `BANK_INBOUND_DOMAIN` = `<id>.resend.app` o `entrada.sportmaps.co`
- [ ] Node ≥ 22.19 (`mailauth@7` lo declara en `engines`; se probó en 22.15 y funciona, pero conviene fijar `NODE_VERSION`).

**Base**
- [ ] Aplicar `20261007163138_conciliacion_correo_banco_dkim.sql` por una vía con rastro y correr `npm run seguridad:invariantes`.

**Piloto (una escuela, p. ej. Dynasty)**
- [ ] Encender `bank_email_reconciliation_enabled` en esa escuela.
- [ ] Crear la dirección: `bank_email_inbox_configure('<school>', array['<buzón donde llegan los avisos>'])` desde una sesión del admin de la escuela (en el SQL editor `auth.uid()` es NULL y la RPC responde Forbidden; mientras no haya pantalla, un INSERT con service_role en `bank_email_inboxes` con `token = substr(replace(gen_random_uuid()::text,'-',''),1,20)`).
- [ ] En Gmail de la escuela: *Reenvío* → agregar `banco+<token>@…` → leer el código en `bank_email_notices` (`estado = 'confirmacion_reenvio'`) → confirmarlo.
- [ ] Filtro: `from:(notificaciones@nequi.com.co OR an.notificacionesbancolombia.com)` → reenviar a esa dirección.
- [ ] **Verificar en vivo** con un aviso real que el reenvío automático preserva la firma (`estado` ≠ `rechazado`), y que Bancolombia firma el `To:` (si no, todos sus avisos quedarán `to_no_firmado`).

## 7. Pendiente

- Pantalla de la escuela: activar, registrar buzones, ver la dirección y el código de confirmación, bandeja de `candidato`/`ambiguo` con «confirmar»/«descartar» (las RPC ya existen).
- Al aprobar un pago que tiene un aviso `candidato`, ofrecer conciliarlo en el mismo paso.
- Nequi no dice a cuál llave entró: si la escuela tiene varias, el destino no ayuda al cruce.
- El nombre del aviso es del dueño de la cuenta que pagó (mamá paga desde el Nequi del papá): por eso el nombre solo desempata y no es requisito.
