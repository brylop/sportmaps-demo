# Reservas de canchas — F0: plan de migraciones (para aprobar)

**Fecha:** 2026-10-14 · **Spec:** [`reservas-canchas-plan-unificado-2026-10.md`](reservas-canchas-plan-unificado-2026-10.md)
**Estado:** plan. **No hay SQL escrito ni aplicado.** Se escribe con `npm run migrations:new` cuando se apruebe.

Verificado contra la **base viva** el 2026-10-14 con una sola consulta filtrada por nombre
(`npx supabase db query --linked`), sin listar el catálogo (la base acababa de volver de la caída por Disk IO).

---

## 1. Lo que dijo la base viva (y cómo cambia el plan)

| Objeto | Estado vivo | Consecuencia |
|---|---|---|
| `schools.school_type` | **9 valores, sin CHECK:** academy 121, **club 83, federation 79, institute 62**, personal_trainer 12, **association 10**, hybrid 2, gimnasio 1, escuela 1. **Ningún `venue`** | El tipo mezcla tipo de negocio con la clasificación del directorio OSM (federación, instituto, asociación). **Normalizarlo en F0 es riesgoso** (toca 290+ filas y el ruteo de dashboards). **Cambio de plan → §2, M3** |
| `has_entitlement('reservations')` | `venue`/`hybrid` | Hoy **2 escuelas** tienen reservas habilitadas; ninguna está pensada así |
| `v_school_entitlements.has_reservations` | `venue`/`hybrid`/**`gimnasio`** | No coincide con la función (confirmado) |
| `user_role` | **sin** `facility_manager` | M1 |
| `facilities` | 30 canchas, 12 con `rental_enabled`; ya tienen `rental_rate`, `min_deposit_pct`, `min_booking_advance_hours`, `min_cancellation_hours` | Se reusa |
| `facility_reservations` | 61 filas históricas; **0 con fecha futura**; **0 solapadas** entre activas | Migrar `status` y agregar columnas no rompe datos vivos |
| `attendance_sessions` futuras con cancha | **0** | El backfill de la ocupación de clases es trivial hoy |
| `btree_gist` / `pg_cron` | 1.7 / 1.6.4 | EXCLUDE y job de expiración disponibles |
| `payments.payment_category` | sin `'reserva'` | M5 |
| `whatsapp_conversation_flows` | CHECK `flow` = factura_electronica, venta | Se amplía en F4, no en F0 |
| Tablas nuevas del spec | ninguna existe | Sin choques de nombre |
| `submit_facility_booking(_v2)` | `SECURITY DEFINER` con `search_path=public` (no el fijo de la convención) | Se reemplazan en F1; no se tocan en F0 |

### 1.1 Hueco de seguridad encontrado (prioridad 0, independiente de reservas)

En `facility_reservations`:

1. **`anon` tiene GRANT de INSERT/SELECT/UPDATE/DELETE.** Hoy las policies lo frenan porque todas piden
   `auth.uid()`, pero es el patrón de grant inerte y peligroso del I1.
2. **Quien pidió la reserva puede cambiarse el precio y el pago.**
   - Ninguna de las dos policies de UPDATE limita columnas:
     - `reservations_update`: `USING (user_id = auth.uid() AND status = 'pending') OR is_school_admin(...)`, sin `WITH CHECK`.
     - `facility_resv_athlete_cancel`: `USING (user_id = auth.uid() AND booker_type = 'athlete')`, `WITH CHECK (user_id = auth.uid())`.
   - Por eso un usuario puede hacer `UPDATE … SET amount_paid = <total>, payment_status = 'paid', price = 0` sobre su propia reserva.
   - **El atleta, además, puede pasar su reserva a `confirmed`**, porque su `WITH CHECK` no mira el estado.
3. **El precio lo manda el cliente.** `FacilityReservationModal.tsx:98` inserta
   `price: facility.hourly_rate`, y `facility_resv_insert_own` acepta cualquier fila con `user_id = auth.uid()`.
   Se puede insertar con `price: 0` o con `status: 'confirmed'`. La única policy que fuerza
   `status = 'pending'` es `reservations_insert_request`, y las policies se suman con OR.
4. **`facility_resv_school_manage` es `FOR ALL` sin `WITH CHECK`** (invariante **I3**).

**Radio:** son 61 filas, sin reservas futuras y casi sin dinero en juego. Pero es la misma tabla sobre la
que se va a vender alquiler con plata real, así que **se cierra antes que cualquier otra cosa** (M0).

### 1.2 Quién escribe hoy directo en la tabla

| Dónde | Qué hace | Rol |
|---|---|---|
| `frontend/src/hooks/useFacilityReservations.ts:215` | INSERT (crear reserva desde el panel) | staff de la escuela |
| `frontend/src/hooks/useFacilityReservations.ts:264` | UPDATE del payload completo | staff de la escuela |
| `frontend/src/components/school/FacilityReservationModal.tsx:98` | INSERT de solicitud desde `SchoolDetailPage` | cualquier usuario autenticado |
| `bff/src/routes/reservations-admin.routes.ts:89,140,406` | cancelar, reprogramar, borrar | service role (BFF) |
| `bff/src/routes/session-bookings.ts:2427,2562` | `book-secondary` inserta / cancela | service role (BFF) |

Revocar la escritura directa de una vez **rompe las tres primeras filas**. Por eso M0 cierra el hueco con un
trigger de guarda, sin quitar permisos, y la revocación total (M7) va cuando el código ya use las RPCs (F1).

---

## 2. Migraciones de F0, en orden

Una sola sesión las aplica, en este orden, con la CLI (deja rastro), no pegando SQL en el editor. Los tipos
se regeneran **una vez**, al final del lote. Cada una se prueba antes en `BEGIN … ROLLBACK` con asserts.

### M0 — Guarda de seguridad en `facility_reservations` (hotfix)

- `REVOKE ALL ON public.facility_reservations FROM anon;`
- Trigger `BEFORE INSERT OR UPDATE`, función `SECURITY DEFINER` con `search_path` fijo. **Si quien escribe
  no es staff** de la escuela de la cancha (`school_id = ANY (user_staff_school_ids())`) y no es `service_role`:
  - **INSERT:** fuerza `status = 'pending'`, `amount_paid = 0`, `payment_status = 'unpaid'`, `approved_*`
    nulos, y **recalcula `price`** desde `facilities` (`rental_rate` si `resv_type = 'rental'`, si no
    `hourly_rate`) × horas. Ignora lo que mande el cliente.
  - **UPDATE:** solo permite cambiar `status` de `pending`/`confirmed` → `cancelled` (más `cancellation_reason`,
    `cancelled_at`, `notes`, `updated_at`). Cualquier otra columna distinta de `OLD` → excepción `forbidden_column`.
- `facility_resv_school_manage`: agregar `WITH CHECK` idéntico a su `USING` (cierra I3).

**Por qué un trigger y no solo policies:** las policies no limitan columnas y se suman con OR; arreglar
cuatro y dejar una abierta no sirve (trampa 1 de `CLAUDE.md`). El trigger vale para todas.

**Radio:** el staff sigue igual. El usuario que pide una reserva ya no elige su precio ni su estado. El flujo
legítimo (pedir → el admin aprueba) no cambia.

**Verificación:**
- Sesión simulada de atleta (`request.jwt.claims`): `UPDATE … SET payment_status = 'paid'` falla;
  `UPDATE … SET status = 'cancelled'` pasa.
- INSERT con `price = 0` queda con el precio real.
- `set local role anon; select count(*) from facility_reservations` → error de permiso.
- `npm run seguridad:invariantes` sin violaciones nuevas.

### M1 — Enum `facility_manager` (sola, primero)

```sql
-- DEPLOY FIRST, standalone
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'facility_manager';
```

No puede ir en la misma transacción que algo que la use (gate G-ENUM).

### M2 — Tabla de ocupación

`facility_occupancy` como en el spec §2.1:
- `slot tstzrange`.
- `EXCLUDE USING gist (facility_id WITH =, slot WITH &&) WHERE (status IN ('hold','active'))`.
- `source_kind` / `status` como `text + CHECK`.
- RLS activo **sin policies de cliente**: se lee por RPC.
- `REVOKE ALL` explícito a `anon` y `authenticated`.

Backfill:
- Hoy hay **0** reservas futuras y **0** clases futuras con cancha, así que el backfill queda vacío.
- Se deja la función `occupancy_backfill()` para correrla de nuevo justo antes de activar F1.

**Verificación:** dos INSERT con rangos solapados en la misma cancha → el segundo da `23P01`. 8:00–9:00 y
9:00–10:00 pasan las dos.

### M3 — Gating de reservas por addon (cambio respecto al spec)

En vez de normalizar `school_type` (§1), **reservas se habilita como capacidad**, igual que torneos o tienda:

- `school_addons.addon_key` CHECK += `'reservations'`.
- `has_entitlement('reservations')` y `v_school_entitlements.has_reservations` pasan a valer lo mismo:
  ```
  school_type = 'venue' OR EXISTS (addon 'reservations' enabled)
  ```
  `gimnasio` sale de la lista: es 1 escuela, que se revisa a mano.
- `school_type`: CHECK con **los 9 valores actuales + `venue`**. Así deja de entrar basura sin mover a nadie.
  La separación tipo de negocio vs. clase OSM (`entity_class`) queda como deuda aparte; no bloquea Canchas.

**Por qué:** una escuela que activa «Alquilar mis canchas» no necesita cambiar de tipo (y de dashboard). Un
club nuevo que solo alquila nace con `school_type = 'venue'`.

**Radio:** las 2 escuelas `hybrid` y la de `gimnasio` hoy ven reservas. Antes de aplicar se revisa si alguna
las usa; si sí, se les inserta la fila de addon en la misma migración para que no pierdan nada.

### M4 — Columnas nuevas en `facility_reservations`

Columnas: `starts_at`, `ends_at`, `hold_expires_at`, `idempotency_key`, `channel`, `guest_booker_id`,
`payment_id`, `price_snapshot`, `recurrence_id`, `cancelled_by`, `refund_status`.

- Todas nullable.
- `starts_at`/`ends_at` se rellenan para las 61 filas históricas con
  `(reservation_date + start_time) AT TIME ZONE 'America/Bogota'`.
- `status` CHECK += `hold`, `pending_payment`, `pending_reconciliation`, `expired`, `no_show`. Los 4
  actuales siguen válidos.
- UNIQUE `(school_id, idempotency_key) WHERE idempotency_key IS NOT NULL`.
- **Se mantiene** el índice `facility_reservations_unique_active_slot` y el trigger de solapamiento hasta
  F1. Ya no son la garantía (lo es M2), pero quitarlos antes de que las RPCs escriban la ocupación
  dejaría un hueco.

`guest_bookers` se crea acá, sin policies de cliente.

### M5 — Pagos

- `payments.payment_category` CHECK += `'reserva'`.
- (BFF, no SQL) prefijo `RSV` en `generateReference`. Va en F2.

### M6 — `pg_cron` para holds

`expirar_holds()` en lote, cada minuto, sin N+1 (regla de Disk IO). En F0 queda creada pero **sin
programar**. Se programa en F1, cuando haya holds.

### M7 — (F1, no F0) Revocar escritura directa

Cuando `useFacilityReservations`, `FacilityReservationModal`, `reservations-admin` y `book-secondary` llamen
a las RPCs, se hace `REVOKE INSERT, UPDATE, DELETE ON facility_reservations FROM authenticated` y se borran
las policies de escritura. Queda anotado aquí para que no se olvide.

---

## 3. Lo que F0 NO hace

- No escribe las RPCs de reserva (F1).
- No toca el frontend salvo lo necesario para M0. Probablemente nada: el staff sigue igual, y el modal
  público ya manda `status: 'pending'`. El precio ahora lo pone la base.
- No normaliza `school_type`.
- No toca `submit_facility_booking(_v2)`; se reemplazan en F1.

## 4. Para aprobar

| # | Pregunta | Recomendación |
|---|---|---|
| A1 | ¿Se aplica **M0 ya**, como hotfix de seguridad, antes del resto? | **Sí**, hoy o mañana: no depende de nada |
| A2 | ¿Se acepta el cambio de gating (M3: addon `reservations` en vez de normalizar `school_type`)? | Sí |
| A3 | ¿Se escriben M1–M6 y se aplican en un solo lote, con tipos regenerados al final? | Sí, después de A1 |
