# Concurrencia, reservas y consumo de inventario

**Producto:** SportMaps · **Fecha:** 2026-08-01 · **Estado:** 🔵 doctrina adoptada · diseño de reservas sin construir
**Roadmap:** [`CONC-1..6`](../ROADMAP.md#conc--concurrencia-e-integridad) · [`BLQ-1`](../ROADMAP.md#blq--bloques-largos)

---

## 1. El problema tiene nombre: race condition

«Se cayó internet y se vendió dos veces el mismo cupo» describe el síntoma, no la causa. La causa
es que **dos procesos pudieron consumir el mismo inventario a la vez**. La conexión es solo una de
las formas de provocarlo; el doble clic, dos recepcionistas, el cron y el botón manual el mismo día,
o dos pestañas abiertas producen exactamente el mismo defecto.

**La solución no vive en el frontend ni en el POS.** Deshabilitar un botón, poner un `debounce` o un
spinner reduce la probabilidad; no elimina la ventana. Un cliente que no controlamos —una app vieja,
un reintento automático, `curl`— vuelve a abrirla. La garantía tiene que estar donde hay un solo
árbitro: **el motor de base de datos.**

Es el mismo problema de e-commerce, ticketing, banca y POS. Depende de la arquitectura, no de la
tecnología.

---

## 2. Los seis mecanismos, y dónde ya los usa SportMaps

Buena parte de esta doctrina **ya está aplicada** en el código, en sitios distintos y con criterios
que conviene nombrar para poder reusarlos.

| Mecanismo | Estado | Dónde |
|---|---|---|
| **Fuente única de verdad en la DB** — índice único parcial | ✅ aplicado en 3 dominios | `session_bookings`: un índice por rama de atleta, `(session_id, <atleta>) WHERE status <> 'cancelled'` ([hoy se limpiaron los duplicados exactos](../../supabase/migrations/20260801103846_drop_duplicate_session_booking_indexes.sql)) · `payments`: tres índices de periodo ([`20260724000001:61-79`](../../supabase/migrations/20260724000001_payment_period_dedup_indexes.sql#L61-L79)) · `enrollments`: 4 índices activos |
| **Lock pesimista** (`SELECT … FOR UPDATE`) | ✅ aplicado y bien hecho | `enforce_session_capacity` bloquea la fila de `attendance_sessions` **antes** de contar, así dos inserts concurrentes sobre la misma sesión se serializan ([`20260424000000:87-108`](../../supabase/migrations/20260424000000_polls_anti_dup_capacity.sql#L87-L108)). Y es política del repo para stock: *«mutar solo dentro de RPCs `SECURITY DEFINER` con `SELECT … FOR UPDATE`»* (CLAUDE.md) |
| **Advisory lock** por clave de negocio | ✅ aplicado | `open_month` toma `pg_advisory_xact_lock` por `(school_id, year, month)` → mata el doble clic y el cron+botón el mismo día ([`20260724000002:56`](../../supabase/migrations/20260724000002_open_month_rpc.sql#L56)) |
| **Transacción atómica** | ✅ por defecto | Toda RPC `SECURITY DEFINER` corre en una transacción; el patrón del repo es que la escritura de dinero vive dentro de una RPC, no en el cliente |
| **Idempotencia** | 🟡 **parcial** | Solo en cobros recurrentes: `recurring-charges.service.ts`, `mercadopago.service.ts`, [`record_recurring_attempt`](../../supabase/migrations/20260701000001_fix_recurring_attempt_idempotent_advance.sql). **No hay `Idempotency-Key` general en las mutaciones del BFF** |
| **Reserva temporal con expiración** (soft lock) | ❌ **no existe** | No hay ningún `expires_at` de reserva. Hoy una reserva se confirma o no existe: no hay estado intermedio que sostenga el cupo mientras el usuario paga |
| **Control optimista** (`version` / compare-and-set) | ❌ no existe | No se encontró ningún patrón de este tipo |
| **Degradación offline** | ❌ no existe | Modo Recepción es kiosko **online**. La cola offline de asistencia (N4) está diseñada y sin construir |

### 2.1 Exclusividad y capacidad no son el mismo problema

Conviene no mezclarlos, porque el mecanismo correcto es distinto:

| | Exclusividad | Capacidad |
|---|---|---|
| **Regla** | Un recurso, un titular | Un recurso, N titulares hasta el cupo |
| **Ejemplos** | Cancha en una franja horaria · un carnet por atleta | Clase con 20 lugares · cupo de evento · stock de producto |
| **Mecanismo** | **Índice único parcial** sobre el recurso. El motor rechaza el segundo insert al instante | **Lock de la fila padre + contar.** El índice único no sirve: no hay una fila por «cupo» |
| **En SportMaps** | Falta — es lo que necesitan las canchas (`BLQ-1`) | ✅ `enforce_session_capacity` |

**El error clásico es contar sin bloquear.** Un trigger que hace `SELECT count(*)` sin `FOR UPDATE`
sobre la fila padre deja pasar dos inserts que ambos leyeron `N-1`. SportMaps lo hace bien en
`session_bookings`; cualquier control de cupo nuevo debe copiar ese patrón, no reinventarlo.

### 2.2 El séptimo caso, que ninguno de los seis cubre

Hay una carrera que **no es entre transacciones**: la ventana **intra-sentencia**. Las subconsultas
de un `INSERT … SELECT` ven el snapshot *anterior* a la sentencia, así que las filas que el propio
`INSERT` va produciendo son invisibles para su `NOT EXISTS`. Dos filas de la misma sentencia pasan
el filtro y ambas insertan.

**Ni el advisory lock ni el `FOR UPDATE` protegen de esto** — serializan llamadas, no filas dentro
de una llamada. Es exactamente el bug abierto en
[`DIN-1`](../plan-f0-generacion-de-mes-y-cobros-duplicados.md) (§3.1): hoy lo frena el índice único
reventando con `23505`, lo que aborta la apertura de mes de toda la escuela. Se resuelve
deduplicando **dentro** de la sentencia (`DISTINCT ON` con desempate determinista), no con más locks.

Vale la pena tenerlo escrito porque es el caso que la lista canónica de mecanismos no menciona y el
que ya nos costó un incidente.

---

## 3. Diseño: reserva = soft lock con expiración

Reservas y pagos se tratan como **un solo flujo transaccional**. Una reserva sin pago confirmado es
un *hold*, no una venta.

### 3.1 Modelo

```sql
CREATE TABLE public.reservations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid NOT NULL REFERENCES public.schools(id),
  branch_id       uuid REFERENCES public.school_branches(id),   -- sedes = school_branches
  resource_type   text NOT NULL CHECK (resource_type IN ('cancha','clase','cupo_evento')),
  resource_id     uuid NOT NULL,        -- sin FK: eje polimórfico (ver §3.4)
  slot_start      timestamptz NOT NULL, -- la franja es parte de la identidad del hold
  slot_end        timestamptz NOT NULL,
  -- Sujeto: mismas tres ramas que el resto del sistema
  user_id                  uuid REFERENCES public.profiles(id),
  child_id                 uuid REFERENCES public.children(id),
  unregistered_athlete_id  uuid REFERENCES public.unregistered_athletes(id),
  guest_contact            jsonb,       -- invitados sin cuenta (BLQ-1 F3)
  status          text NOT NULL DEFAULT 'pendiente_pago'
                    CHECK (status IN ('pendiente_pago','confirmada','expirada',
                                      'cancelada','pendiente_reconciliacion')),
  held_at         timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,          -- held_at + hold_minutes de la escuela
  payment_id      uuid REFERENCES public.payments(id),
  idempotency_key text NOT NULL,                 -- lo genera el cliente al iniciar
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

**Estados y enums con `text + CHECK`, no `CREATE TYPE`** — convención del repo, y la historia de
`payments.status` explica por qué.

### 3.2 La garantía: dos índices, no uno

```sql
-- EXCLUSIVIDAD — un solo hold activo por recurso y franja.
-- Esta es la fuente única de verdad: si dos personas dan clic a la vez, el segundo
-- INSERT choca contra el índice y falla al instante. No hay ventana, porque la
-- garantía la da el motor, no el código de aplicación.
CREATE UNIQUE INDEX one_active_reservation
  ON public.reservations (resource_id, slot_start)
  WHERE status IN ('pendiente_pago','confirmada','pendiente_reconciliacion');

-- IDEMPOTENCIA — un reintento o un doble clic no abre dos holds ni dos cargos.
CREATE UNIQUE INDEX uq_reservation_idempotency
  ON public.reservations (school_id, idempotency_key);
```

> ⚠️ **`slot_start` entra en la clave a propósito.** Con `(resource_id)` solo, una cancha admitiría
> **una** reserva viva en toda su historia. El recurso reservable es la **franja**, no la cancha.
>
> Si más adelante las franjas dejan de ser fijas y hay que impedir **solapamientos** arbitrarios, el
> índice único ya no alcanza: eso pide una `EXCLUDE USING gist (resource_id WITH =, tstzrange(slot_start, slot_end) WITH &&)`
> con la extensión `btree_gist`. Decidir en el plan de `BLQ-1` si las franjas son fijas (índice
> único, más simple) o libres (constraint de exclusión).

**Para `clase` y `cupo_evento` el índice de exclusividad no aplica** — son capacidad. Ahí se reusa el
patrón de `enforce_session_capacity`: lock de la fila del recurso y contar los holds activos
(`pendiente_pago` **cuenta**, que es justamente el punto del soft lock).

### 3.3 El flujo

```
1. Intento de reserva
   INSERT status='pendiente_pago', expires_at = now() + hold_minutes
   → si choca con one_active_reservation: 409 "ese horario acaba de ocuparse"
   → si choca con uq_reservation_idempotency: se devuelve la reserva YA creada (200, no 409)

2. Con el cupo bloqueado, se dispara el pago (Wompi / MP / manual en recepción)
   El idempotency_key viaja al proveedor → un retry no genera dos cargos

3. Pago confirmado (webhook)  → status='confirmada', payment_id colgado
4. expires_at vencido sin pago → job pg_cron pasa a 'expirada' y libera el slot
   (el índice único deja de contarla como activa, sin borrar nada)
```

**Nada de esto borra filas.** La reserva expirada queda como registro: es la única forma de
responder «¿por qué perdí el cupo?» y de medir cuánto se abandona en el paso de pago.

**El job de expiración es la pieza frágil.** Si no corre, los slots quedan bloqueados por holds
muertos. Dos defensas: (a) el `WHERE` de las consultas de disponibilidad ignora
`pendiente_pago AND expires_at < now()` aunque el job no haya pasado —la verdad no depende del
cron—, y (b) el `INSERT` de una reserva nueva puede expirar de paso los holds vencidos del mismo
recurso. Con eso el cron es limpieza, no correctitud.

⚠️ Ojo con los **dos mecanismos de cron que ya coexisten** en el BFF
([`INF-2`](../ROADMAP.md#inf--infraestructura-y-deuda-de-esquema)): este job va donde vayan los
demás, no en un tercer mecanismo.

### 3.4 `resource_id` sin FK — decisión, no descuido

`resource_id` apunta a tablas distintas según `resource_type`. **Postgres no admite FK
polimórficas**, y el repo ya tomó esta decisión dos veces: `performance_entries` resuelve
`subject_type + subject_id` con un `CHECK` sobre el tipo y **ninguna FK** sobre el id, y
`athlete_reports` copió esa convención validando el sujeto dentro de su única RPC escritora.
`reservations` hace lo mismo: `CHECK` sobre `resource_type` y validación del `resource_id` dentro de
la RPC que crea la reserva, que es su único escritor.

### 3.5 Degradación offline (recepción sin señal)

Solo si el negocio lo pide y **con margen configurado por escuela** (p. ej. overbooking del 10 %):

- La reserva provisional nace `pendiente_reconciliacion`, marcada como offline.
- Al reconectar, un job la valida contra el índice único.
- **Conflicto real → gana el `held_at` más antiguo.** Al resto se le notifica y se reagenda o se
  reembolsa. La regla se escribe una vez y no se decide caso por caso.
- Si el margen es 0, la recepción offline **no vende**: muestra «sin conexión, no puedo confirmar».
  Es la opción por defecto, y para casi toda escuela es la correcta.

El costo real del modo offline no es técnico: es que alguien tiene que llamar al cliente al que se
le cayó la reserva. No se activa por defecto.

---

## 4. Enganche con `payments`

La reserva **no duplica** el modelo de cobro: cuelga de él.

- `reservations.payment_id` → `payments(id)`. Un hold sin pago tiene `payment_id NULL`.
- El webhook de la pasarela ya sabe encontrar su fila: la reconciliación de Wompi se hace por
  `payment_links.wompi_reference`. La reserva se confirma **desde** el mismo handler que marca el
  pago, en la misma transacción — no con un segundo job que «revise si ya pagó».
- **`payments` hoy es obligación y movimiento en la misma fila.** Cuando se separen (ver el
  [módulo Pendientes](../specs/pendientes-cxc-cxp-nomina.md)), `reservations.payment_id` pasa a
  apuntar a la obligación, y el cruce con el movimiento queda en la tabla de cruces. Es una
  migración de una columna, no un rediseño — pero conviene saberlo antes de escribir el modelo.

---

## 5. Lo que hay que cerrar

| # | Pendiente | Prioridad |
|---|---|---|
| CONC-1 | `Idempotency-Key` general en las mutaciones del BFF (hoy solo en cobros recurrentes) | Alta — es la defensa más barata contra el doble cargo |
| CONC-2 | Auditar todo `count(*)` de control de cupo o stock que **no** bloquee la fila padre | Alta — es el error clásico y ya sabemos cómo se ve bien hecho |
| CONC-3 | Deduplicar dentro de la sentencia en `open_month` (la ventana intra-sentencia de §2.2) | Es `DIN-1`, P0 |
| CONC-4 | Modelo de reservas con soft lock (§3) | Es `BLQ-1` F0/F1 |
| CONC-5 | Decidir franjas fijas vs solapamiento libre (índice único vs `EXCLUDE USING gist`) | Antes de escribir el modelo |
| CONC-6 | Cola offline y política de degradación | `BLQ-3` N4 · opt-in por escuela |
