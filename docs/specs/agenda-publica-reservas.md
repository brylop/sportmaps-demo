# Spec — Agenda Pública de Instalaciones + Gestión de Reservas

**Producto:** SportMaps · **Versión:** v1.1 (hardening de seguridad + gestión de reservas)
**Fecha:** Agosto 2026
**Estado:** en producción desde antes de esta spec (v1.0 sin documentar); v1.1 commiteada (`a550d40f`), **migraciones aplicadas y verificadas en vivo, código sin desplegar** en `sportmaps-bff-dev`/`sportmaps-bff-stg`/`sportmaps-bff-prod`.

> Esta spec se escribió **retroactivamente** — el flujo (`/agendar/:slug`) ya estaba en producción sin documentación propia (solo mencionado de pasada en la spec de Clases de Prueba, §1, como «mecánica hermana»). Se documenta ahora junto con la auditoría de seguridad y la ampliación de gestión de reservas, ver ROADMAP `SEG-20` y `MOD-29`.

---

## 0. Objetivo

Dar a cada escuela un **link público** (`/agendar/:slug`, botón «Copiar Link Público» en la pestaña Instalaciones) donde un prospecto, **sin login**, puede:

1. Elegir una instalación con `booking_enabled = true`.
2. Elegir un horario disponible (por `facility_availability`, sin necesidad de identificarse todavía).
3. Identificarse con su **correo** y verificar un código de un solo uso.
4. Quedar agendado — como socio con plan activo (si ya está inscrito) o como **clase de cortesía** (si la escuela la tiene habilitada, `school_courtesy_settings`).

Es la mecánica **hermana pero separada** de la Agenda de Clases de Prueba (`docs/specs/clases-de-prueba-agenda-owner.md`): esta es pública e iniciada por el prospecto, sin coach asignado; aquella la agenda el owner y sí liga un entrenador.

---

## 1. Los tres escenarios de identificación

| Escenario | Cómo se detecta | Qué pasa |
|---|---|---|
| **`already_registered`** | El correo coincide con `profiles.email` (cuenta ya existe, en cualquier escuela) | Se le pide iniciar sesión con correo y contraseña — **no** se manda OTP, no hace falta: el usuario escribió su propio dato, no se le revela nada nuevo |
| **`enrolled_unregistered`** | El correo coincide con `unregistered_athletes.email` de **esa escuela**, con un `enrollment` `active` | Se manda OTP a ese correo; al verificar, la reserva se liga al `enrollment` existente (revalida plan activo, no vencido, con crédito) |
| **`new`** | No coincide con nada | Requiere nombre completo; si la escuela tiene cortesía habilitada (`school_courtesy_settings.enabled`), se manda OTP y al confirmar se crea `unregistered_athletes` + `enrollment` de cortesía (lazy-init del plan $0/1-sesión, igual patrón que Clases de Prueba) |

**Anti-abuso:** máx. 3 códigos por correo cada 10 min (`public_booking_verifications`, antes era por teléfono) + rate-limit de 5/10min por IP en `/start-verification` + tope de 5 intentos por código antes de exigir uno nuevo + TTL de 10 min.

---

## 2. El hallazgo crítico (`SEG-20`) — por qué el identificador es correo, no teléfono

**v1.0 identificaba por teléfono.** `POST /start-verification` buscaba el teléfono ingresado contra `public.profiles.phone` **sin filtrar por escuela**, y si había match devolvía el **correo completo sin enmascarar** — sin OTP, sin que el teléfono tuviera que pertenecer a esa escuela ni a esa persona.

**Escenario de explotación:** cualquiera, desde el link público de *cualquier* escuela, escribía un teléfono ajeno (adivinado, comprado en una lista, o simplemente el de alguien que conoce) y recibía de vuelta el correo real de la cuenta dueña de ese teléfono en **toda la plataforma**. El segundo vector teórico (`children.parent_phone`) resultó estar ya roto — esa columna no existe en `children` (es `parent_phone_temp`, un campo de onboarding), así que ese `SELECT` fallaba en silencio y nunca matcheaba nada.

**Fix estructural, no un parche puntual:** identificar por **correo** en vez de teléfono elimina la clase entera de vulnerabilidad. El usuario ahora provee su propio identificador — confirmar «ya existe una cuenta con este correo» no revela nada que no supiera de antemano, a diferencia de teléfono, que permitía escribir un dato ajeno para extraer uno distinto y sensible.

Migración: `20260828230514_public_booking_email_en_vez_de_telefono.sql` (hace `public_booking_verifications.phone` nullable — se deja de recolectar, no se borra la columna por las filas históricas).

### 2.1 El segundo hallazgo, sin relación — el bypass de depuración en producción

Al probar el fix de arriba se detectó que el flujo **nunca pedía el código**: `debug_code` se devolvía en la respuesta cuando `NODE_ENV !== 'production'`, y el frontend lo auto-consumía. `render.yaml` despliega `sportmaps-bff-dev` y `sportmaps-bff-stg` como servicios **públicos en internet** con `NODE_ENV=development`/`staging` — y los tres ambientes (dev/stg/prod) apuntan a **la misma Supabase real**. El bypass de OTP completo quedaba vivo contra datos reales en dos de los tres BFFs desplegados, sin relación con quién probaba el link.

**Fix:** `PUBLIC_BOOKING_DEBUG_OTP=true` (antes `NODE_ENV`-based) — no se declara en `render.yaml` para ningún servicio, así que por ausencia queda apagado en todo lo desplegado. Solo se prende a mano en un `.env` local.

### 2.2 Hallazgos menores, mismo barrido

- **Carrera de capacidad en `POST /confirm`:** lectura-luego-escritura desde Node (contar `session_bookings`, comparar contra `max_capacity`, recién ahí insertar) sin `FOR UPDATE` ni advisory lock — dos requests concurrentes para el mismo bloque podían sobrevender el cupo. Viola la doctrina propia del repo (`architecture/concurrencia-y-reservas.md`: «nada que consuma cupo se protege con una validación previa en el BFF»). **Fix:** todo el tramo (resolver/crear sesión + chequear cupo + reservar + mover el crédito) se movió a la RPC `public_booking_confirm_reservation`, con `pg_advisory_xact_lock` por cancha+fecha y upsert atómico de `attendance_sessions` (`ON CONFLICT` sobre el índice parcial `idx_attendance_sessions_unique_facility_slot`).
- **`move_session_credit` sin revisar error:** antes era un `supabase.rpc()` suelto desde JS sin chequear `.error` — un fallo ahí se reportaba como éxito al público. Resuelto solo: ahora es un `PERFORM` dentro de la misma RPC atómica, así que un fallo revierte toda la transacción.
- **`GRANT` inerte en `public_booking_verifications`:** tenía INSERT/SELECT/UPDATE/DELETE para `anon`/`authenticated` a nivel de tabla. Verificado en vivo que **hoy no era explotable** (RLS activo con cero policies deniega todo — `set local role anon; select count(*)` → 0 filas), pero es un grant inerte y peligroso si alguien agrega una policy permisiva a futuro sin revisarlo. Revocado explícito.

Migración: `20260828230515_public_booking_confirmar_atomico_y_grants.sql`.

---

## 3. Gestión de reservas (`MOD-29`) — cancelar / reprogramar / eliminar

La pestaña **Reservas** de `SchoolFacilitiesPage.tsx` mezcla en una sola tabla (`useFacilityReservations.ts`) dos orígenes distintos:

| | `facility_reservations` | `session_bookings` (de este flujo) |
|---|---|---|
| Quién la crea | El owner, manual (`OwnerReservationModal`) | El prospecto, público, vía `/agendar/:slug` |
| Protección de choque de horario | Trigger `trg_check_facility_overlap` (ya existía) | Índice único parcial `idx_attendance_sessions_unique_facility_slot` |
| Reprogramar (cambio de fecha/hora) | Ya existía (edita los campos y el trigger valida) | **No existía** — solo se podía cambiar el `status` |
| DELETE directo por RLS | Solo el propio autor, con `status='pending'` | **Nunca** — `session_bookings_delete_none` es `USING (false)` para cualquier `authenticated` |

### 3.1 El bug que disparó esto: «Eliminar» no eliminaba

`deleteReservation` escribía `DELETE` **directo desde el navegador** (Supabase JS, sujeto a RLS). Para `session_bookings`, la policy `session_bookings_delete_none` deniega el `DELETE` sin excepción — y un `DELETE` que no afecta ninguna fila por RLS **no es un error** en Postgres/PostgREST. El resultado: el toast decía «Reserva eliminada» sin haber borrado nada. Se encontró porque dos registros de prueba reales (`unregistered_athletes` con datos de un owner probando el flujo) no desaparecían pese a intentarlo varias veces, ni con «Eliminar» ni con «Cancelar» (esto último sí funcionaba — cambiaba el `status` — pero la fila sigue visible en la lista con el badge de cancelada, que es el comportamiento esperado en todo el resto de la app, no un bug).

### 3.2 Fix: todo pasa por el BFF, con `service_role`

Nuevo `bff/src/routes/reservations-admin.routes.ts`, montado en `/api/v1/reservations-admin`, solo `owner`/`admin`:

- `PATCH /facility/:id/cancel` · `/reschedule` · `DELETE /facility/:id`
- `PATCH /courtesy/:id/cancel` · `/reschedule` · `DELETE /courtesy/:id`
- `GET /courtesy/slots?facility_id=&from=&to=` — slots libres **solo por cancha** (sin coach, a diferencia de Clases de Prueba) para el picker de reprogramar

Cancelar y reprogramar **mandan correo** (`reservationCancelled`/`reservationRescheduled`, `bff/src/utils/emailTemplates.ts`) al requester resuelto (`profiles`, `unregistered_athletes`, o el padre vía `children.parent_id`). Eliminar usa `service_role` para saltar la restricción de RLS **a propósito** — es una acción de owner/admin, no de autoservicio, así que el borrado físico sí es apropiado ahí.

**Reprogramar clases de cortesía** necesitó una RPC nueva, `session_booking_reschedule` — mismo patrón que `public_booking_confirm_reservation` (advisory lock + upsert atómico + chequeo de cupo), pero sin coach y sin poder cambiar de cancha (eso es «otra reserva», no una edición).

Migración: `20260828232516_session_booking_reschedule_y_notificaciones.sql`.

### 3.3 Correo de confirmación al agendar

`POST /confirm` (crear la reserva) **no mandaba ningún correo** — el prospecto solo veía la pantalla de éxito en el navegador. Se agregó `publicBookingConfirmation`, enviado después de que la RPC atómica confirma la reserva (un fallo de correo no revierte la reserva ya creada).

---

## 4. Modelo de datos relevante

```
public_booking_verifications   -- OTP: school_id, resolved_email, otp_hash, resolved_kind,
                                --   resolved_unregistered_id, resolved_enrollment_id, full_name,
                                --   attempts, expires_at, booking_token (uso único)
                                --   ⚠️ SIN migración propia en el historial — drift total, no solo
                                --   "sin registro". Esta spec y las migraciones de v1.1 son lo
                                --   primero que la toca de forma versionada.
```

Sin tabla de configuración propia — reusa `facilities.booking_enabled`/`min_booking_advance_hours` y `school_courtesy_settings` (que tampoco se toca ni se documenta acá, ver su propio origen).

---

## 5. Checklist de convenciones del repo (no romper)

- [x] Migraciones nuevas, nunca editar/borrar existentes
- [x] `SET search_path = pg_catalog, public, pg_temp` en toda función nueva
- [x] `GRANT EXECUTE … TO service_role` explícito, nunca `anon`/`authenticated` para las RPCs de este flujo (todas las llama el BFF sin JWT de usuario)
- [x] RLS sin self-recursion
- [x] `text + CHECK`, no `CREATE TYPE`
- [x] Capacidad protegida por el motor (advisory lock + upsert atómico), no por una validación previa en el BFF
- [x] `npm run seguridad:invariantes` sin violaciones críticas después de cada migración
- [ ] **Deploy pendiente** — el código está commiteado pero `sportmaps-bff-dev`/`stg` siguen corriendo la versión vulnerable hasta el próximo deploy (ver `SEG-20`)

## 6. Deuda conocida, sin resolver a propósito

- `completeReservation` (`useFacilityReservations.ts`) manda `status: 'completed'` para `session_bookings`, pero el enum real `booking_status` es `confirmed | cancelled | attended | no_show` — ese botón falla contra la base hoy para reservas de cortesía. No se tocó porque requiere decidir el mapeo correcto («completada» → ¿`attended`?), no es parte de esta spec.
- `school_courtesy_settings` (habilitación, `requires_approval`, plan lazy-init) no tiene spec propia — se documentó solo lo que este flujo consume de ella.
