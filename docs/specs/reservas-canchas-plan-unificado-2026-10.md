# Spec — Reservas de canchas y escenarios: plan unificado

**Producto:** SportMaps · **Versión:** v0.3 (benchmark §10 + quejas del mercado §10.5) · **Fecha:** 2026-10-14
**Estado:** plan, **sin código**. Reemplaza como guía de ejecución a `BLQ-1` del ROADMAP y a la memoria
`project_reservations_module` (mayo 2026). Los rescata: lo que sigue valiendo de ellos está citado acá.
**Doctrina que manda:** [`architecture/concurrencia-y-reservas.md`](../architecture/concurrencia-y-reservas.md) (CONC-4/5).

> Fuente de los hallazgos: lectura del repo (`frontend`, `bff`, `supabase/migrations`), del gemelo
> `supabase/qa-twin/dump/01_public.sql` y del repo de la landing. **Nada se consultó contra la base viva**:
> antes de F0 se verifica cada objeto citado con `pg_proc` / `pg_policies` filtrando por nombre (regla de Disk IO).

---

## 0. Objetivo

Que un club de pádel, una cancha sintética, un coliseo o una escuela con instalaciones pueda **alquilar
por horas** y que **cualquier canal** venda la misma hora sin choques:

| Canal | Quién reserva |
|---|---|
| App (admin / staff) | El club agenda a mano: walk-in, llamada, cancha fija semanal |
| App (usuario con cuenta) | Atleta, acudiente, cliente externo registrado |
| Página pública del club | Cualquiera, sin cuenta (verificación por correo) |
| **Bot de WhatsApp del club** | Cualquiera que escriba al número del club |
| **Landing** (mapa + página por club) | Descubre el club y entra al flujo público con un enlace directo |
| Eventos / torneos / clases | No "reservan": **ocupan** la cancha y la bloquean para los demás |

Tres reglas que no se negocian:

1. **Una sola verdad de disponibilidad.** Todos los canales preguntan a la misma función y reservan por la
   misma RPC. Nadie inserta en tablas de reserva directamente.
2. **Dos reservas no pueden ocupar la misma cancha a la misma hora.** Lo garantiza la base (restricción de
   exclusión), no el BFF ni el botón deshabilitado.
3. **Repetir una petición no duplica nada.** Cada intento lleva una llave de idempotencia; reintentar devuelve
   la misma reserva y el mismo enlace de pago.

---

## 1. Lo que ya existe (y hay que reusar, no duplicar)

### 1.1 Más alquiler del que se creía

`facilities` y `facility_reservations` ya tienen piezas de alquiler a medio construir:

- `facilities`: `hourly_rate`, `available_hours`, `booking_enabled`, **`rental_enabled`, `rental_rate`,
  `min_deposit_pct` (30)**, `min_booking_advance_hours`, `min_cancellation_hours`, `branch_id`.
- `facility_reservations`: `booker_type` (parent/athlete/school/**external**), `resv_type`
  (internal/**rental**/secondary_class), `payment_status` (unpaid/partial/paid/waived), `amount_paid`,
  `external_org_name`, `hour_bank_reservation_id`.
- RPC `submit_facility_booking_v2` ya calcula precio por `rental_rate` y abono mínimo.
- `facility_availability`: franjas semanales fijas con `max_group_capacity`.

### 1.2 Huecos de concurrencia en lo que existe

| # | Hueco | Efecto |
|---|---|---|
| H1 | Índice `facility_reservations_unique_active_slot` compara solo `start_time` | 8:00–10:00 y 9:00–10:00 pasan las dos |
| H2 | Trigger `fn_check_facility_reservation_overlap` hace *revisar y luego insertar* sin lock | Dos peticiones simultáneas pasan ambas el `EXISTS` |
| H3 | El trigger no ve `attendance_sessions` | Una clase y un alquiler pueden caer en la misma cancha |
| H4 | `session-bookings.ts:2427` (`book-secondary`) inserta en `facility_reservations` directo, sin RPC | Viola la regla 1 |
| H5 | Fecha y hora como `date` + `time` sin zona | Sin rango continuo no hay `EXCLUDE`; reservas que cruzan medianoche no se pueden expresar |
| H6 | No hay middleware `Idempotency-Key`; la idempotencia vive por dominio (`orders`, `wa_cobros_sueltos`) | Doble tap o reintento del bot = reserva doble |

### 1.3 Piezas reutilizables por frente

| Frente | Pieza | Archivo / objeto |
|---|---|---|
| Lock por cancha | `pg_advisory_xact_lock` + upsert atómico | `public_booking_confirm_reservation` (`20260828230515`) |
| Exclusión por rango | `btree_gist` ya instalado (se usa en mesociclos) | `20260921115743` |
| Pasarela por escuela | Resolver de credenciales, secretos cifrados, fail-closed | `payment-provider.resolver.ts`, `school_payment_providers`, `payment_provider_secrets` |
| Wompi | Referencia por prefijo + webhook enrutado por prefijo | `wompi.service.ts:117`, `routes/wompi.ts:278` |
| Link con monto y expiración | El que usa la venta por chat | `wompi-link-con-monto.service.ts` |
| Mercado Pago | `X-Idempotency-Key` ya enviado | `mercadopago.service.ts:380` |
| Webhooks sin duplicar | `webhook_events` UNIQUE `(provider, event_id)` + reproceso | `webhook-events.service.ts` |
| Pago por enlace | `/p/:token` sobre `payment_links` | `cobro-enlace-publico.service.ts` |
| Transferencia + comprobante | OCR y veredicto | `ocr.service.ts`, `receipt-verdict.ts` |
| Checkout UI | Tarjeta, PSE, Nequi, MP, transferencia | `PaymentCheckoutModal.tsx` |
| Verificación sin cuenta | OTP por correo con anti-abuso | `public-booking.routes.ts` (`/start-verification`) |
| Bot: elegir franja | Lista interactiva de hasta 10 franjas + confirmar/cancelar | `whatsapp-clase-cortesia.service.ts` |
| Bot: flujo con cobro | Flujo paso a paso + link Wompi | `whatsapp_conversation_flows` (CHECK: `factura_electronica`, `venta`), `whatsapp-venta-servicios.service.ts` |
| Tipo de organización | `schools.school_type`, `v_school_entitlements`, `has_entitlement()`, `useEntitlements` | dump l.47861 / 52155 / 25536 |
| Público | `/agendar/:slug`, `/s/:slug`, `/explorar` + `search_schools` / `schools_near_location` | `App.tsx`, `explorar.controller.ts` |

### 1.4 Inconsistencias que hay que cerrar antes de construir

- `has_entitlement('reservations')` acepta `venue|hybrid`, pero `v_school_entitlements.has_reservations`
  acepta además `gimnasio`. `admin_set_school_type` admite 7 valores (academy, hybrid, venue, club, escuela,
  gimnasio, personal_trainer) y la columna no tiene CHECK. `useEntitlements.ts:23` solo tipa tres.
- Rol `facility_manager`: aparece en **una** migración (contable). No está en registro, menú, rutas ni BFF.
- `payments.payment_category` no tiene categoría de reserva. El prefijo `BKG` ya es de `session_bookings`.
- **Landing:**
  - No hay plan ni addon de Reservas. Solo `calendar_resources` desde Crecimiento.
  - El addon Torneos dice $49k, pero la decisión de mayo era $79k.
  - El botón «Reservar / Inscribirse» del mapa abre un **formulario de lead**, no la app.
  - El mapa usa datos estáticos inventados (`mapData.ts:304-325`: "Canchas Sintéticas Norte $120.000/hora").
  - No hay páginas por club ni deep-link de reserva.

---

## 2. Modelo de datos propuesto

### 2.1 La pieza central: ocupación única por cancha

La forma de que **nada** choque (alquiler, clase, torneo, mantenimiento) es que todo lo que ocupa una cancha
escriba una fila en **una sola tabla** con restricción de exclusión. Las demás tablas siguen siendo dueñas
de su negocio; esta solo responde «¿está libre?».

```sql
-- text + CHECK, no CREATE TYPE (convención del repo)
CREATE TABLE public.facility_occupancy (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id),
  facility_id   uuid NOT NULL REFERENCES public.facilities(id),
  slot          tstzrange NOT NULL,                -- '[)' : 8:00–9:00 y 9:00–10:00 no chocan
  source_kind   text NOT NULL CHECK (source_kind IN
                  ('rental','class','event','blackout','hour_bank')),
  source_id     uuid NOT NULL,                     -- id en la tabla dueña
  status        text NOT NULL CHECK (status IN ('hold','active','released')),
  hold_expires_at timestamptz,                     -- solo para 'hold'
  created_at    timestamptz NOT NULL DEFAULT now(),
  EXCLUDE USING gist (facility_id WITH =, slot WITH &&)
    WHERE (status IN ('hold','active'))
);
```

- **Un hold vencido no bloquea.** La disponibilidad ignora `hold` con `hold_expires_at < now()`, aunque el
  job no haya pasado (CONC-4). El EXCLUDE sí lo vería, así que la RPC de reserva primero **libera holds
  vencidos de esa cancha** dentro de la misma transacción (`UPDATE … SET status='released'` bajo el advisory
  lock) y luego inserta.
- **Canchas combinables** (una cancha de fútbol 11 = dos de fútbol 7): `facility_links (parent_id, child_id)`.
  La RPC escribe una fila de ocupación **por cada cancha física afectada**, y el EXCLUDE hace el resto.
  Depende de la decisión D3.
- Hueco H3 cerrado: la clase que usa la cancha escribe `source_kind='class'`. Backfill desde
  `attendance_sessions` futuras con `facility_availability_id`.

### 2.2 La reserva: evolucionar `facility_reservations`, no crear otra tabla

Se descarta la tabla polimórfica `reservations` de CONC-4 §3: ya hay datos, UI admin y RPCs sobre
`facility_reservations`. Se agrega lo que falta:

| Columna nueva | Para qué |
|---|---|
| `starts_at`, `ends_at timestamptz` | Rango real en `America/Bogota`, lo llena la RPC. Mantiene `reservation_date/start_time/end_time` para lo existente (H5) |
| `hold_expires_at timestamptz` | Apartado mientras paga |
| `idempotency_key text` + UNIQUE `(school_id, idempotency_key)` | Reintentos = misma fila (H6) |
| `channel text CHECK (app, public, whatsapp, admin, landing)` | Saber por dónde entra cada venta |
| `guest_booker_id uuid` → `guest_bookers` | Reserva sin cuenta (correo verificado) |
| `payment_id uuid` → `payments` | CONC-4 §4 |
| `price_snapshot jsonb` | Tarifa aplicada (franja, socio/público, abono). El precio no cambia si después cambia la tarifa |
| `recurrence_id uuid` → `facility_recurrences` | Cancha fija semanal |
| `cancelled_by`, `cancel_reason`, `refund_status` | Cancelación con política |

`status` pasa a: `hold`, `pending_payment`, `confirmed`, `pending_reconciliation`, `cancelled`, `expired`,
`completed`, `no_show`. Se migran los actuales `pending` y `confirmed`. Se reemplaza el CHECK; el enum
`resv_status`, que ya está huérfano, no se toca.

### 2.3 Tablas de soporte nuevas

- `facility_rates (facility_id, weekday[], from_time, to_time, audience CHECK (public, member), price_per_hour, valid_from, valid_to)`:
  precio pico/valle, fin de semana, socio vs público, **festivos de Colombia** (por defecto se cobran como domingo,
  igual que Controla Cancha). Si no hay fila, se usa `rental_rate`.
- `facility_recurrences (facility_id, weekday, start_time, end_time, from_date, until_date, booker, price_snapshot)`:
  el clásico «los martes 8 p. m. la cancha es de los del trabajo». Genera reservas por mes y
  **reporta los choques**, no los pisa.
- `facility_blackouts`: mantenimiento y cierre. Escribe ocupación `blackout`.
- `cancellation_policies (school_id, hours_full_refund, hours_partial_refund, partial_pct, no_show_penalty)`.
- `guest_bookers (email UNIQUE, phone, full_name, document, verified_email_at, linked_user_id)`: se adopta
  la cuenta si después se registra.

### 2.3.1 Motor de reglas por segmento (v0.2, tomado de CourtReserve, Skedda y Playtomic)

`facility_booking_rules (school_id, facility_id?, segment CHECK (public, member, family, staff), …)`:

| Regla | Ejemplo real |
|---|---|
| `advance_days` | Socio 14 días, público 7 (Playtomic, club de Cali) |
| `max_active_future` | Socio 4 reservas simultáneas, público 2 |
| `max_minutes_per_day` / `per_week`, `max_prime_per_week` | Topes de horario pico (CourtReserve) |
| `min_gap_hours` | Horas mínimas entre una reserva y otra |
| `buffer_min` | Minutos de limpieza o cambio entre turnos; no aplica al staff (Skedda) |
| `allowed_durations int[]` | 60/90/120. El pádel se juega en 90 |
| `no_orphan_gaps bool` | No dejar huecos sueltos de 30 min entre reservas (anti-sandwich de CourtReserve) |
| `last_minute_bypass_hours` | X horas antes del turno se levantan los topes para llenar la cancha |

- Si dos reglas chocan, **gana la más estricta**. El staff puede saltarlas, y queda registro de que lo hizo.
- Los topes se cuentan **por familia** (acudiente + hijos), algo que la competencia no puede hacer porque no
  tiene el modelo de familia.
- `reservar_cancha` evalúa las reglas dentro de la transacción. `disponibilidad_canchas` las aplica para no
  mostrar franjas que el usuario no puede tomar.

### 2.3.2 Pago dividido entre jugadores (v0.2, modelo Playtomic adaptado a Colombia)

`facility_reservation_shares (reservation_id, player_name, phone/email, amount, status, payment_link_id, paid_at)`.

Playtomic se apoya en la tarjeta guardada del organizador. En Colombia casi todo es PSE, Nequi o
transferencia, así que no se puede hacer igual:

1. El organizador **paga su parte + el abono mínimo**, que sirve de garantía, y con eso **confirma** la cancha.
2. Cada jugador recibe su link (por WhatsApp, con un clic desde el chat del organizador).
3. Hay un plazo, por defecto **2 h antes del turno**. Lo que no se pagó queda como **saldo del organizador a
   pagar en sede**, visible en recepción y en su perfil.
4. Si el organizador debe saldo de un partido anterior, no puede volver a reservar hasta pagarlo
   (bloqueo tipo ATC).

### 2.3.3 Asistencia y no-show (v0.2)

- **v0.3:** el jugador puede **disputar** un no-show desde `/r/:token` o por WhatsApp; el club resuelve y queda
  registro. (En Playtomic hay quejas de jugadores marcados como no-show y cobrados.)
- **v0.3:** si el club bloquea una hora ya vendida (lluvia, mantenimiento), la RPC avisa al jugador **al
  instante** por WhatsApp y push y le ofrece otra hora o saldo a favor. Nunca se entera al llegar a la cancha.
- Estado `no_show` + contador por cliente (`booker_strikes`). Con N faltas en 60 días: pago anticipado
  obligatorio o bloqueo temporal. N lo configura el club. **Es un diferencial:** CourtReserve no lo tiene
  nativo, es un pedido de sus usuarios.
- Check-in con QR de la reserva (o marca «Llegó» en recepción). Opción **auto-liberar**: si no hay check-in
  15 min después del inicio, la franja se libera y se avisa a la lista de espera (Skedda).

### 2.3.4 Lista de espera y alertas (v0.2)

`facility_waitlist (facility_id?, sport, date, from_time, to_time, contact, channel, cutoff_hours)`: un rango
flexible («cualquier cancha de 7 a 9 p. m.»), no una franja exacta.

- Cuando se libera algo dentro del rango, se avisa a todos por WhatsApp o push y **gana el primero que paga**,
  igual que CourtReserve y Controla Cancha.
- No se usa promoción automática con cobro: nadie la documenta, y cobrar sin confirmación es frágil con PSE.

### 2.3.5 Adicionales y caja (v0.2, Controla Cancha)

- **Adicionales en la reserva:** luz extra, balones, petos, bebidas. Se toman del catálogo de la tienda
  (tienda v2) y se cobran en el mismo pago.
- **Tiqueteras de N horas:** se reusa el **banco de horas**, que ya existe para Dreamers, en vez de construir otro.
- **Caja por sede:** cierre diario por cancha, sobre el módulo contable (`owner_type`/`owner_id`).
- **Roles:** recepción (agenda del día, check-in, cobro en efectivo) y contador (solo lectura + exportación).

### 2.4 Pagos

- `payments.payment_category` += `'reserva'` (CHECK nuevo).
- Prefijo de referencia nuevo **`RSV`** en `generateReference`, con su rama en el webhook de Wompi y en el de MP.
- `payment_links` se reusa tal cual para «paga esta reserva» (`/p/:token`).

---

## 3. RPCs (único punto de escritura)

Todas son `SECURITY DEFINER`, con `SET search_path = pg_catalog, public, pg_temp` y `GRANT EXECUTE`
explícito por rol. Todas validan `has_entitlement(school_id,'reservations')`.

| RPC | Qué hace |
|---|---|
| `disponibilidad_canchas(school, fecha_desde, fecha_hasta, deporte?, facility?)` | **La** función de disponibilidad. Devuelve franjas libres con su precio según `facility_rates`, cruzando horario de apertura, ocupación activa, holds vigentes, anticipación mínima y blackouts. La usan app, página pública, bot y landing. Solo lectura, accesible por anon a través del BFF |
| `reservar_cancha(facility, starts_at, ends_at, booker, channel, idempotency_key, metodo_pago)` | Advisory lock `(facility, día)` → si existe la key devuelve la fila → libera holds vencidos → valida reglas → inserta reserva + ocupación `hold` (o `active` si es sin pago o la hace el admin) → devuelve `{reserva, monto, abono_minimo, expira}`. Conflicto = `23P01` → BFF responde **409 `SLOT_TAKEN`** con 3 franjas alternativas |
| `confirmar_pago_reserva(referencia, provider_event)` | La llama el webhook. Hold vigente → `confirmed`. Hold vencido y franja libre → re-ocupa y confirma. Hold vencido y franja tomada → `pending_reconciliation` + alerta al admin (devolución o saldo a favor). Nunca se pierde un pago |
| `cancelar_reserva(id, actor, motivo)` | Aplica la política, libera la ocupación y calcula la devolución |
| `reprogramar_reserva(id, nuevo_rango)` | Atómico: ocupa lo nuevo antes de soltar lo viejo |
| `expirar_holds()` | pg_cron cada minuto, en lote, sin N+1 (regla de Disk IO). Es higiene: la correctitud no depende de que corra |
| `generar_recurrencia(recurrence_id, mes)` | Crea las reservas del mes y devuelve los choques |

**Hueco H4:** `book-secondary` pasa a llamar `reservar_cancha`. El INSERT/UPDATE directo a
`facility_reservations` se revoca a `authenticated` y `anon`; solo escriben las RPCs.

---

## 4. Idempotencia de punta a punta

| Capa | Mecanismo |
|---|---|
| Frontend / página pública | Genera un UUID **al abrir el resumen de la reserva**, no al hacer clic. Doble tap = misma key |
| Bot de WhatsApp | La key es **el id del mensaje de Meta (`wamid`)** del «Confirmo». Meta reentrega webhooks y la key absorbe la repetición |
| BFF | Middleware `requireIdempotencyKey` en todo POST que reserve o cobre. Sin header → 400 |
| Base | UNIQUE `(school_id, idempotency_key)`. Repetir = 200 con la misma reserva y el mismo link |
| Pasarela | La referencia `RSV-…` es estable por reserva. MP recibe `X-Idempotency-Key` |
| Webhooks | `webhook_events` UNIQUE `(provider, event_id)` ya existe. `confirmar_pago_reserva` es idempotente: confirmar dos veces no hace nada |

---

## 5. Métodos de pago

Siempre con la **pasarela de la escuela** (`payment_mode='direct'`, fail-closed). SportMaps nunca recibe
la plata ([connected accounts](../payments-connected-accounts-plan.md)).

| Método | Cómo confirma | Hold | Notas |
|---|---|---|---|
| Wompi: tarjeta, PSE, Nequi, Bancolombia | Webhook `RSV-` | 10 min (D5) | Link con monto exacto y expiración, reusando `wompi-link-con-monto` |
| Mercado Pago: tarjeta, PSE, Efecty | Webhook MP | 10 min; **Efecty** necesita horas, así que queda `pending_payment` con hold largo o no se ofrece (D6) | |
| Transferencia / Nequi / Daviplata / llave Bre-B + comprobante | **El comprobante llega en 15 min o la hora se libera** (Controla Cancha usa 15). El OCR de comprobantes v2 valida monto, banco, referencia, destino y duplicados. Si el veredicto es claro, confirma solo; si es dudoso, va al admin con la cancha apartada | 15 min hasta recibir el comprobante (D6) | Es como paga el 97 % en Dynasty. Sin esto el módulo no sirve en Colombia |
| Efectivo en sede | El admin marca pagado | Sin hold: `confirmed` con `payment_status='unpaid'` | **Solo para quien el club habilite** (socios o reserva hecha por el admin). Nunca para un invitado anónimo |
| Abono (`min_deposit_pct`) | Igual que el método elegido | Confirma con abono; el saldo se paga en sede | Ya existe en `submit_facility_booking_v2` |
| Billetera / saldo a favor | Débito atómico | — | Fase posterior (§8, F6) |

**Recargo por pago en línea:** lo decide la escuela (el recargo es suyo, como en el resto de
cobros); el plan solo lo soporta. Factus Pay QR queda fuera hasta que Factus tenga fecha de producción.

---

## 6. Canales

### 6.1 App: admin y staff

- **Agenda tipo grilla** (canchas en columnas, horas en filas) que pinta `facility_occupancy`: alquileres,
  clases, torneos y bloqueos con colores distintos. Clic en un hueco = reserva rápida (walk-in o llamada).
- Pestañas Cancha fija, Tarifas y Políticas.
- Bandeja de «por conciliar» (`pending_reconciliation`) y de comprobantes.
- Rol **`facility_manager`**: dueño o administrador de un club que solo alquila, sin equipos ni atletas.
  Rol **staff de portería** (opcional): ve la agenda del día y marca llegada o no-show.

### 6.2 Página pública del club

- Evoluciona `/agendar/:slug`, que hoy es para clases. **`/reservar/:slug`** queda para alquiler.
- Flujo: deporte → día (14 días, con festivos marcados) → **grilla de horas libres por cancha** con precio →
  nombre + WhatsApp → código de 6 dígitos **por WhatsApp** (plantilla de autenticación de Meta; el correo
  queda de respaldo) → resumen con la política en una línea → método de pago → confirmación con enlace de
  estado `/r/:token`, que permite **cancelar o reprogramar** según la política.
- **v0.3: identidad = teléfono verificado.**
  - Igualamos la poca fricción de Controla Cancha (solo nombre y WhatsApp), pero sin su hueco: ellos no
    verifican el número y cualquiera puede apartar a nombre de otro.
  - Si la reserva entra por el bot, el número ya viene verificado por Meta y no se pide código.
  - Si después la persona crea una cuenta, `guest_bookers` se liga a ella.
- Anti-abuso: 3 códigos cada 10 min por número, rate limit por IP, tope de holds activos por número y por IP,
  y captcha invisible si hay ráfagas.
- **v0.3: lo que el jugador ve siempre** (las quejas más repetidas del mercado son por esto, §10.5):
  - Precio final desde el primer paso, sin cargos que aparezcan al final.
  - La política en una línea, con hora exacta: «Gratis hasta el mar 14, 6:00 p. m.; después pierdes el abono».
  - Antes de cancelar: «Te devolvemos $X como saldo a favor» (o a la pasarela, con plazo).
  - El estado del comprobante en vivo:
    - `validated`
    - `needs_review` (la cancha sigue apartada)
    - `not_receipt`
    - `duplicate`
    - `rejected` con el motivo
    - `expired`
  - Recibo con el desglose: cancha, adicionales, abono y saldo.

### 6.3 Bot de WhatsApp del club

Va en el número de cada escuela, que ya existe con `school_whatsapp_integrations`.

- Nuevo flujo `'reserva'`: hay que **ampliar el CHECK** de `whatsapp_conversation_flows`.
- **Determinista, sin LLM**, igual que el dinero hoy. El LLM solo detecta la intención («¿tienen cancha
  mañana a las 7?») con una tool nueva, `get_court_availability`. El resto es lista interactiva:
  1. deporte o cancha
  2. día
  3. franja con precio
  4. «Confirmo»
  5. link de pago con monto y expiración
  6. confirmación automática al pagar
- Identidad: si el teléfono ya está vinculado, reserva a su nombre. Si no, pide nombre y correo con OTP,
  o permite reservar sin cuenta con **pago obligatorio** (D7).
- Si el hold vence sin pago: «Se liberó la cancha. ¿La intentamos de nuevo?».
- Cancelar o cambiar desde el chat («cancelar mi reserva»), siempre por `cancelar_reserva` y `reprogramar_reserva`.
- El horario del club y `ai_enabled` se respetan. En modo asistido, el admin aprueba los textos, pero **la
  reserva no espera aprobación** porque el cupo ya se apartó con el hold.

**Número de plataforma (SportMaps)**, fase posterior: «¿Dónde juego pádel hoy en Chapinero?» → busca en
varios clubes con `disponibilidad_canchas` y entrega el link `/reservar/:slug` del club elegido. No cobra:
el cobro siempre es del club.

### 6.4 Landing

| Hoy | Cambio |
|---|---|
| Mapa con datos estáticos inventados | Endpoint público `GET /api/v1/public/venues?lat&lng&deporte` (sobre `schools_near_location`) **+ caché** (CDN / prerender). Las canchas de ejemplo se eliminan |
| «Reservar» abre un formulario de lead | Si el club tiene reservas activas → `https://app.sportmaps.co/reservar/:slug?utm_source=landing`. Si no → lead, como hoy |
| Sin páginas por club | `/clubes/:slug` prerenderizada en el build (sitemap dinámico) con JSON-LD `SportsActivityLocation`, horarios, deportes y rango de precios. **No** muestra disponibilidad en vivo (sería IO por cada visita): botón al flujo de la app |
| Sin plan de Reservas; Torneos a $49k | Decisión de precios D9, que se refleja en `saas-plans.ts` y en `school_addons` el mismo día |
| WhatsApp de ventas | Se mantiene. En la página del club, el botón de WhatsApp va al **número del club** si tiene uno conectado |

### 6.5 Eventos, torneos y clases

- Un torneo con canchas asignadas escribe ocupación `event` por cancha y franja (fase F5). Si hay choque,
  el organizador ve contra qué reserva choca, en vez de un error genérico.
- Las clases recurrentes de la academia escriben ocupación `class`. Una escuela `hybrid` alquila solo las
  horas que no usan sus equipos.

### 6.6 Notificaciones

No hay un despachador único de tres canales: push va por el outbox `notification_deliveries`, el correo
va aparte y WhatsApp tiene su propio servicio. Para reservas:

- **Confirmación:** por el canal de origen (WhatsApp si vino de WhatsApp) + correo.
- **Recordatorios:** 24 h y 2 h antes, en un job en lote que escribe en el outbox.
- **Avisos al admin:** nueva reserva, cancelación y pago por conciliar.

Unificar el despachador queda fuera de este plan. Aquí solo se agrega el tipo de notificación.

---

## 7. Rol, tipo de organización y gating

- `school_type` **se normaliza** a `academy | venue | hybrid | personal_trainer`:
  - `club`, `escuela` y `gimnasio` se mapean (D2).
  - CHECK en la columna.
  - `has_entitlement` y `v_school_entitlements` dan el mismo resultado.
  - `useEntitlements` se tipa igual.
- **`facility_manager`:** migración del enum **sola y desplegada primero** (`ALTER TYPE … ADD VALUE`, gate
  G-ENUM). Registro «Club / Canchas» en `RegisterPage` → crea `schools` con `school_type='venue'`, con
  onboarding sin equipos ni atletas: canchas → horarios → tarifas → pasarela.
- **Toggle «Activar alquiler de canchas»** en la configuración de una academia → `hybrid`.
- Permisos de escritura de reservas: `user_staff_school_ids()`. Tarifas, políticas y pasarela:
  `user_admin_school_ids()`. **Nunca** `user_school_ids()` para escribir (I2).
- Middleware `requireEntitlement(key)` en el BFF. Hoy cada ruta consulta la vista a mano.

---

## 8. Fases

Una rama por fase, con revisión entre fases. **Plan de migraciones aprobado antes de escribir SQL.** Una sola
sesión aplica migraciones y los tipos se regeneran una vez al final de cada lote (regla de Disk IO).

| Fase | Qué entrega | Visible al cliente | Est. |
|---|---|---|---|
| **F0 — Alinear la base** | Verificación en vivo de §1. `school_type` normalizado + CHECK + entitlements coherentes. Enum `facility_manager` (sola). `payment_category 'reserva'`. Middleware `requireIdempotencyKey` y `requireEntitlement`. `facility_occupancy` + backfill (rentals y clases futuras). Cerrar H1–H4: `book-secondary` pasa a RPC y se revoca el INSERT directo | No | 1–1,5 sem |
| **F1 — Motor de reservas** | Columnas de §2.2, tarifas, blackouts, políticas, `guest_bookers`. RPCs de §3. Endpoints BFF. **Tests de concurrencia**: 50 reservas simultáneas a la misma franja → 1 gana, 49 reciben 409. Misma key ×10 → 1 fila. Hold vencido + pago tardío | No (API) | 2 sem |
| **F2 — Cobro** | Prefijo `RSV` en Wompi/MP + webhooks, link con monto, abono, transferencia con comprobante, efectivo habilitado por club, conciliación de pagos tardíos, devoluciones según política | No | 1,5–2 sem |
| **F3 — Canales app** | Agenda grilla admin, reserva rápida, cancha fija con precio especial, motor de reglas (§2.3.1), rol `facility_manager` + recepción + contador, onboarding venue + toggle hybrid, página pública `/reservar/:slug` + `/r/:token` con la política de cancelación **visible antes de pagar**, marca «No llegó», notificaciones | **Sí** — primer club piloto | 3–3,5 sem |
| **F4 — WhatsApp + pago dividido** | Flujo `'reserva'` en el bot del club, tool `get_court_availability`, comprobante por chat → OCR → confirmación, cancelar/cambiar por chat, recordatorios, **pago dividido** con links por WhatsApp (§2.3.2) | Sí | 2–2,5 sem |
| **F5 — Landing, eventos, retención** | Endpoint público de venues + mapa real, `/clubes/:slug` con SEO + **directorio por ciudad con «precio desde»**, deep-link, precios publicados. Torneos y eventos ocupan cancha. Lista de espera y alertas (§2.3.4). Adicionales y tiqueteras (§2.3.5). Reporte de ocupación por cancha y franja (sin contar canceladas), ingreso por cancha-hora y tasa de no-show | Sí | 2,5–3 sem |
| **F6 — Crecimiento** | Saldo a favor / monedero por club, membresías con horas incluidas, check-in QR con auto-liberación, **luces o acceso disparados por la reserva** (ZKTeco, `BLQ-2`), partidos abiertos con nivel, americanos y ranking PWR, número de plataforma que busca entre clubes, Reserve with Google (si hay vía para Colombia), app nativa | Sí | por fase |

**Total hasta un club cobrando por WhatsApp (F0–F4): unas 10–11 semanas** (v0.2 suma el motor de reglas y
el pago dividido). El plan de mayo pedía 17 para
F0–F7. La diferencia: ya existen la pasarela por escuela, los webhooks, el bot y el OTP público, y la
billetera, las membresías y el PWR pasan a F6.

### Criterios de aceptación transversales

- `npm run seguridad:invariantes` sin violaciones nuevas al cerrar cada fase con RLS.
- `set local role anon; select count(*) from facility_occupancy;` → 0. La disponibilidad pública sale por
  la RPC con solo las columnas publicables, nunca por la tabla.
- Prueba negativa: el `facility_manager` del club A no lee ni escribe reservas del club B.
- Cada fase se prueba **corriendo**, con una sesión real, no solo con typecheck.

---

## 9. Decisiones abiertas (bloquean lo indicado)

| # | Pregunta | Recomendación | Bloquea |
|---|---|---|---|
| D1 | ¿Se aprueba evolucionar `facility_reservations` + tabla de ocupación, en vez de la tabla polimórfica de CONC-4? | Sí (§2.1–2.2) | F0 |
| D2 | Mapeo de `school_type`: `club`→? `gimnasio`→`venue`? `escuela`→`academy`? | club→hybrid si tiene equipos, si no venue; gimnasio→venue; escuela→academy | F0 |
| D3 | ¿Canchas combinables (F11 = 2×F7, coliseo dividido) desde el inicio? | Sí. Controla Cancha ya lo tiene como algo básico («Cancha 3 = 1 + 2») | F1 |
| D16 | Código de verificación: ¿por WhatsApp o por correo? | WhatsApp (plantilla de autenticación), con correo de respaldo; necesita la plantilla aprobada por Meta en la cuenta del club o en la de plataforma | F1 |
| D17 | Lista de espera: ¿avisar a todos o por turnos de 15 min? | Por turnos por WhatsApp (como Controla Cancha: es más justo y no hay carrera); si es por push, a todos | F5 |
| D4 | Franjas: ¿fijas (cada hora en punto) o libres con duración mínima? (CONC-5) | Libres con `slot_step_min` (30) y duración mínima por cancha. El EXCLUDE soporta las dos | F1 |
| D5 | Duración del hold mientras paga | 10 min en línea; Wompi/PSE puede tardar | F1 |
| D6 | Transferencia y Efecty: ¿apartan cupo? ¿Cuánto tiempo? | Transferencia: 15 min para mandar el comprobante (igual que Controla Cancha), luego OCR. Efecty: no se ofrece para reservas | F2 |
| D7 | ¿Invitado sin cuenta puede reservar? ¿Con qué pago? | Sí, solo con pago en línea o abono; nunca «pago en sede» | F1 |
| D8 | ¿El atleta o socio inscrito tiene precio especial? | Tarifa `member` opcional por cancha; la decide la escuela | F1 |
| D9 | Precios del módulo | **CERRADA 14-oct:** Gratis (≤2 canchas) / Canchas Pro $99k (≤5, bot sin tope) / Canchas Club $199k (ilimitadas); ver `docs/plan-agresivo-canchas-2026-10.md` §4 | F3 / F5 |
| D10 | Política de cancelación por defecto | 100 % hasta 24 h antes, 50 % hasta 6 h, 0 % después; editable por club | F2 |
| D11 | ¿Devolución a la tarjeta o saldo a favor? | Saldo a favor por defecto (no hay billetera hasta F6 → devolución manual registrada) | F2 |
| D12 | ¿Club piloto? | **CERRADA 14-oct:** una cancha sintética nueva, conseguida por ventas directas | F3 |
| D13 | Pago dividido: ¿plazo y qué pasa con lo no pagado? | 2 h antes del turno; lo que falte queda como saldo del organizador en sede, y no puede volver a reservar hasta pagarlo | F4 |
| D14 | No-show: ¿cuántas faltas y qué sanción? | 2 faltas en 60 días → solo con pago anticipado por 30 días; lo configura el club | F3 |
| D15 | ¿Comisión o cuota de servicio al jugador? | **No.** Es el argumento contra Playtomic y Easycancha. El recargo por pago en línea, si lo hay, lo decide el club | F2 |

---

## 10. Benchmark de competencia (2026-10-14)

Investigación web contra fuentes primarias (páginas de producto, centros de ayuda, prensa). Lo no
verificado está marcado. Nadie publica precios que no se citen acá.

### 10.1 Quién es quién

| Competidor | Qué es | En Colombia | Modelo |
|---|---|---|---|
| **Controla Cancha** (`cancha.controla.club`) — **competencia directa** | Producto aparte de Controla.Club, solo canchas. Reserva sin cuenta por **WhatsApp con IA en el número de la sede** o página pública indexada; directorio por ciudad | Sí | Sin comisión. Partido $149k (≤2 canchas, aprobación humana), Torneo $249k (3–5, IA, 400 reservas IA/mes), Estadio $399k (6+, multisede, 1.000 IA) |
| **Easycancha** | Marketplace de canchas (Chile) | **Segundo mercado**; dice estar en ~90 % de los clubes de pádel (Forbes, nov-2025) | Mensualidad fija al club + cuota de servicio al jugador (gratis con Prime) |
| **Playtomic** | Marketplace global de pádel + Manager para clubes | Clubes en Cali y otras ciudades (cuántos: no confirmado) | Tarifa de servicio al jugador, no reembolsable; planes del club sin precio publicado |
| **ATC / AlquilaTuCancha** | Marketplace + software (Argentina) | Lista Colombia | SaaS + comisión por transacción |
| **CourtReserve, Skedda, MATCHi** | SaaS maduros (EE. UU. / Europa) | No | Referencia de reglas avanzadas. CourtReserve: US$99–549 |
| Padel Mundial | Startup colombiana, web + bot de WhatsApp | Sí (64 canchas en oct-2024; si sigue activa: no confirmado) | No publicado |

### 10.2 Qué tomamos (y dónde quedó en este spec)

| Idea | De quién | Dónde |
|---|---|---|
| Hora apartada 15 min mientras llega el comprobante; si no llega, se libera y se avisa a la lista de espera | Controla Cancha | §5, D6, §2.3.4 |
| Comprobante leído por IA (monto, banco, referencia, destino, duplicados) | Controla Cancha | §5 (ya lo tenemos: comprobantes v2) |
| Abono % por sede, turnos fijos con precio especial, tiqueteras, bloqueo por lluvia | Controla Cancha, ATC | §2.3, §2.3.5 |
| Adicionales ligados a la reserva, caja por sede, roles recepción y contador | Controla Cancha | §2.3.5 |
| Ventana de reserva y topes distintos para socio y público | Playtomic, CourtReserve, Skedda | §2.3.1 |
| Anti-huecos, buffers, liberación de último minuto | CourtReserve, Skedda | §2.3.1 |
| Pago dividido con un responsable que respalda | Playtomic | §2.3.2 (adaptado: sin tarjeta guardada) |
| Bloqueo por no pagar o no llegar | ATC | §2.3.2, §2.3.3 |
| Check-in con auto-liberación | Skedda, CourtReserve (kiosco) | §2.3.3, F6 |
| Directorio por ciudad con «precio desde» | Controla Cancha | F5 |
| Partidos abiertos con nivel y cancelación automática si faltan jugadores | Playtomic, Easycancha | F6 |
| Luces atadas a la reserva | Hello Club, Rezerv | F6 |

### 10.3 Dónde ganamos

1. **Escuela + canchas en una sola cuenta.** Controla separa academia y canchas en dos productos; Playtomic y
   Easycancha no tienen escuela. Solo nosotros podemos dar precio de socio al alumno y a su familia, y bloquear
   la cancha con las clases de la academia (§2.1).
2. **Pasarela integrada + transferencia con IA.** Controla Cancha solo tiene transferencia + foto, sin Wompi,
   PSE ni tarjeta. Nosotros tenemos las dos cosas, con la plata directo al club.
3. **Sin cuota al jugador** (D15) y con la marca del club adelante, no la del marketplace.
4. **Garantía de cero doble reserva entre canales.** Ninguno documenta cómo lo evita; nosotros lo tenemos
   en la base (§2.1). Se puede vender así.
5. **Pago dividido y reglas por segmento**, que Controla Cancha no tiene.
6. **Precio:** Controla cobra por número de canchas y limita las reservas con IA. Un plan sin tope de
   reservas por WhatsApp es un argumento directo (entra en D9).

**Dónde no pelear de entrada:** el pádel, donde Easycancha dice tener ~90 % de los clubes. Conviene entrar
por **fútbol sintético, coliseos, clubes que ya usan SportMaps (hybrid) y eventos**, y llegar al pádel con
diferenciales ya probados.

### 10.4 Controla Cancha por dentro (lectura de sus páginas públicas, sin reservar nada)

- **Tracción visible:** el directorio `/sedes` tiene **una sola sede publicada** («el bar», Medellín). El
  producto es nuevo; los términos son del 11-oct-2026.
- **Página de la sede:** deportes, «desde $100.000/h», tabla de precios por franja, **festivos cobrados como
  domingo**, 14 días hacia adelante, lista por hora con un botón por cancha libre y filtro por deporte.
  Duración fija de 60 min. Página indexable con JSON-LD `SportsActivityLocation` + `ReserveAction`.
- **Identidad:** solo nombre + WhatsApp, **sin código de verificación ni cuenta**. Se puede apartar a nombre
  de un número ajeno, y no hay captcha visible.
- **Pago:** solo transferencia o efectivo. Muestra las cuentas de la sede, se sube la foto (o se manda por
  WhatsApp) y la pantalla consulta el estado cada 3 s. Si el comprobante llegó a tiempo, la cancha se
  sostiene hasta 24 h mientras se revisa (nunca después de la hora del juego), y el staff tiene
  «Dar más tiempo».
- **Bot:** **sesión no oficial tipo WhatsApp Web** sobre el número de la sede, no la API de Meta.
  - Riesgo de que bloqueen el número, y sin plantillas oficiales.
  - Las horas libres las calcula el código; la IA (OpenRouter) conversa.
  - Pasa a una persona si el cliente lo pide o si se agota la cuota de IA.
  - No interrumpe si el staff escribió en las últimas 12 h.
- **Huecos:**
  - Sin política de cancelación en el sistema (es texto libre).
  - No-show solo manual, sin strikes.
  - Sin reglas socio/público.
  - Sin pasarela.
  - Sin pago dividido.
  - Sin garantía pública contra la doble reserva simultánea.
  - Los términos no regulan reembolsos ni la relación sede–jugador.
  - Datos en EE. UU.
- **Ellos lo hacen mejor (y lo tomamos):** muy poca fricción, estados del comprobante visibles al jugador,
  canchas combinadas, festivos, «Dar más tiempo», lista de espera por turnos.

### 10.5 Quejas reales del mercado → requisito

Fuentes: App Store, Trustpilot y OCU (España). Google Play y Reddit no se pudieron leer.
- **Notas:** en las tiendas son altas (Easycancha 4,9, Playtomic 4,8–4,9), pero Playtomic tiene **1,3 en
  Trustpilot** (133 reseñas, 89 % de una estrella).
- **De qué se quejan:** casi todo es plata y soporte.

| Queja | Quién | Requisito en este spec |
|---|---|---|
| Reembolso negado, «pídaselo al club» o hasta 10 días | Playtomic (6 de 21 reseñas; OCU) | Saldo a favor inmediato + reembolso a la pasarela con plazo visible; **un solo responsable de cara al jugador** (§6.2) |
| Política incomprensible; no deja cancelar a menos de 24 h | Playtomic | Política en una línea con hora exacta, y antes de cancelar se muestra cuánto se devuelve (§6.2) |
| No se puede cambiar la reserva, solo cancelar | Playtomic | `reprogramar_reserva` sin cobro nuevo dentro de la ventana (§3) |
| Cobros dobles y triples | Playtomic | Idempotencia de punta a punta (§4) + recibo con desglose |
| Marcado no-show y cobrado | Playtomic | Disputa de no-show (§2.3.3) |
| Cancha cerrada al llegar | Playtomic (3) | Aviso inmediato cuando el club bloquea una hora vendida (§2.3.3) |
| Cuota de servicio al jugador que aparece de golpe | Easycancha, Playtomic | Sin cuota al jugador (D15); precio final desde el primer paso |
| Soporte solo con chatbot o sin canal | Easycancha, Playtomic | Todo caso de **plata** pasa a una persona por WhatsApp (el bot ya escala) |
| Identidad atada a un correo viejo | Easycancha | Identidad por teléfono verificado (D16) |
| Buscador y filtros rotos; probar hora por hora | Easycancha | Grilla del día con horas libres, filtros de deporte y ubicación |
| Una reserva que no aparecía | ATC | Una sola fuente de disponibilidad + EXCLUDE (§2.1) |

### 10.6 Pendiente

Leer Google Play (no se pudo con fetch). Volver a revisar el directorio de Controla Cancha en un mes para
medir cuánto crece. Ver si Reserve with Google tiene vía para Colombia.


## 11. Fuera de este plan

- Despachador único de notificaciones.
- Factus Pay / Bre-B como método (bloqueado por Factus).
- Control de acceso físico (`BLQ-2`): se conecta en F6 a través de la reserva confirmada.
- App nativa: la PWA cubre F3–F5.
