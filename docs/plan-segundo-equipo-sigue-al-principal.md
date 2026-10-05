# Plan — el segundo equipo sigue a la inscripción principal

**Estado:** 🟡 pendiente de aprobación (no hay SQL escrito) · **Fecha:** 2026-10-01 · **Origen:** Besser pidió
deportistas en varios equipos (flag `allow_secondary_team_enrollment` activado el 2026-10-01).

## Regla de negocio

Una deportista puede pertenecer a varios equipos de la misma escuela y paga **una sola mensualidad**: la de su
inscripción principal. El segundo equipo nunca cobra (cuota 0 fijada a mano, como hoy).

Lo que cambia:

1. **Se puede agregar el segundo equipo aunque la principal esté `pending`** (alta por QR sin pagar). El segundo
   nace también en `pending`.
2. **El segundo sigue a la principal:** cuando la principal pasa a `active`, sus segundos `pending` pasan a `active`;
   cuando la principal pasa a `cancelled` o `completed`, sus segundos abiertos pasan al mismo estado.
3. Si una principal cancelada se reactiva, los segundos **no** reviven solos: volver a agregarlos es una decisión
   explícita.

## Por qué

- Hoy el BFF exige principal `active` (`bff/src/routes/enrollments.ts`, bloque `data.secondary === true`), así que la
  deportista que se inscribe por QR no puede estar en dos equipos hasta que alguien apruebe su pago.
- **Hueco que existe hoy:** cancelar la principal (baja del atleta, `set_school_athlete_status`, cancelación
  manual) **no cancela el segundo equipo**, que queda activo con cuota 0 en la lista de ese equipo. Hoy hay 0
  huérfanos (10 segundos, todos de Carmel, todos con principal activa), pero no hay nada que lo impida.

## Cambios

### F1 — Base (una migración, `npm run migrations:new -- segundo-equipo-sigue-al-principal`)

1. **Columna** `enrollments.primary_enrollment_id uuid NULL REFERENCES public.enrollments(id) ON DELETE SET NULL`
   + índice parcial `WHERE primary_enrollment_id IS NOT NULL`. Deja de depender del texto de `fee_reason` para
   saber qué fila es un segundo equipo.
2. **Backfill** de las filas con `fee_reason LIKE 'Equipo secundario%'`: se enlazan a la inscripción no secundaria
   del mismo sujeto (`child_id`/`user_id`/`unregistered_athlete_id`) y escuela, preferiendo la `active`. Se
   reporta cuántas quedan sin enlazar (esperado: 0 para las activas; las canceladas pueden quedar NULL).
3. **CHECK** `primary_enrollment_id <> id` (no se apunta a sí misma).
4. **Trigger** `AFTER UPDATE OF status ON enrollments`, función `SECURITY DEFINER` con
   `SET search_path = pg_catalog, public, pg_temp`, sin `EXECUTE` a `anon`/`authenticated` (solo la invoca el
   trigger):
   - `pending → active` en una principal → `UPDATE enrollments SET status='active' WHERE primary_enrollment_id = NEW.id AND status='pending'`.
   - `* → cancelled|completed` en una principal → mismo estado a sus segundos `active`/`pending`.
   - Solo actúa sobre filas que **son** principales (`NEW.primary_enrollment_id IS NULL`), así no hay cascada en
     cadena. Los cobros de los segundos no existen (cuota 0), así que `trg_cancel_payments_on_enrollment_cancel`
     no tiene nada que anular; `trg_sync_school_member_on_enrollment_status` sigue funcionando igual.
   - Choque con índice único: si al activar el segundo ya hay otra fila `active` del mismo sujeto en ese equipo,
     esa fila se salta (se deja `pending` y se reporta con `RAISE WARNING`) en vez de abortar la aprobación del
     pago de la principal.
5. **Vista `school_athletes`:** exponer el equipo de la inscripción principal aunque esté `pending`, en una
   columna **nueva al final** (`pending_team_id`) para no romper el `CREATE OR REPLACE VIEW` (no se pueden
   reordenar columnas; partir de `pg_get_viewdef` de la base viva, no del repo — ver la deriva de 2026-09-03).

### F2 — BFF (`bff/src/routes/enrollments.ts`)

- El bloque `secondary` acepta `current.status IN ('active','pending')`, inserta el segundo con
  `status = current.status` y `primary_enrollment_id = current.id`.
- `current` = la inscripción abierta **no secundaria** (`primary_enrollment_id IS NULL`), no la primera por fecha.
- Al **mover** la principal a un equipo donde ya está como secundaria (`PUT /students/:id`): se cancela ese
  segundo antes, o choca con `uq_enrollment_*_team`.

### F3 — Frontend (`EnrollTeamStudentModal.tsx`)

- La detección de "ya está en otro equipo" usa `enrolled_team_id ?? pending_team_id`, así el diálogo
  mover/agregar aparece también para una deportista pendiente.
- La deportista pendiente aparece en "Esperando pago" en los dos equipos (ya funciona: el modal carga `pending`).
- El toast de "Agregado al segundo equipo" dice, si aplica: "Entra a los dos equipos cuando se apruebe su pago".

## Pruebas

- **Base (SQL, dentro de transacción con `ROLLBACK`):** principal `pending` + segundo `pending` → aprobar → ambos
  `active`; cancelar principal → segundo `cancelled`; reactivar principal → segundo sigue `cancelled`; choque de
  índice → la aprobación de la principal no falla.
- **BFF:** agregar segundo con principal `pending` → 201 y fila `pending` enlazada; con flag apagado → 403 de
  siempre; coach sin plan → permitido.
- **e2e:** `team-roster-pending.spec.ts` extendido: la pendiente aparece en "Esperando pago" en los dos equipos.
- `npm run seguridad:invariantes` tras aplicar (I4: la función nueva lleva `search_path`).

## Radio

Afecta solo a escuelas con `allow_secondary_team_enrollment = true` (hoy Carmel y Besser). El trigger no hace nada
sobre filas sin `primary_enrollment_id`, que son todas las demás inscripciones de las 368 escuelas.

## Esfuerzo

F1 ~2 h · F2 ~1 h · F3 ~1 h · pruebas ~1 h.
