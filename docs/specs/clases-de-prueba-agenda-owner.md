# Spec — Agenda de Clases de Prueba (Owner)

**Producto:** SportMaps · **Versión:** v1.0
**Fecha:** Agosto 2026
**Estado:** decisiones de producto **resueltas** (§11) · pendiente de aprobación de plan antes de escribir migraciones (Fase 1).

> Documento base para la construcción. Se construye **por fases con revisión entre cada una**
> (no "todo el módulo de una"). La Fase 1 (backend) va primero con este plan aprobado antes de
> escribir migraciones.

---

## 0. Objetivo

Permitir que el owner/admin de una escuela agende, desde el módulo de instalaciones, una **clase de prueba** para un prospecto (persona que aún no es cliente): elige cancha, fecha/hora y **entrenador**, captura los datos básicos del prospecto (nombre, correo, WhatsApp), y el sistema:

1. Valida que la instalación **y** el entrenador estén disponibles en ese horario.
2. Registra la reserva.
3. Envía un correo de confirmación automático.
4. Genera un mensaje de WhatsApp pre-armado para que el owner lo comparta manualmente (`wa.me`).

**Problema que resuelve:** hoy el owner no tiene forma de agendar una prueba atada a un entrenador específico — `coach_availability` solo la ve/usa el propio coach, y `facility_availability` no tiene ningún concepto de entrenador. El pariente más cercano, la "clase de cortesía" (`school_courtesy_settings`), es pública vía OTP y tampoco asigna coach.

---

## 1. Relación con "clase de cortesía" — dominios distintos, mecánica hermana

| | **Cortesía** (`school_courtesy_settings`, ya existe) | **Clase de prueba** (este módulo) |
|---|---|---|
| Quién la inicia | El prospecto, público, vía OTP (`public-booking.routes.ts`) | El **owner/admin**, desde el panel |
| Atada a coach | No (`coach_id` siempre `null`) | **Sí** — valida `coach_availability` |
| Precio | Siempre gratis | **Configurable por escuela** (puede ser $0 o un valor fijo) |
| Cobro | N/A | Solo se **registra** el precio acordado; el cobro se coordina fuera del sistema (v1) |
| Tabla de agenda propia | No (vive dentro de `session_bookings`) | **Sí** — `trial_class_bookings`, con datos de contacto del prospecto |

Ambas comparten el mismo patrón mecánico de fondo (plan de 1 sesión, `unregistered_athletes` + `enrollments`), pero **no comparten configuración ni tabla** — así el owner puede reportar "cuántas pruebas agendé este mes" sin mezclarlo con cortesías que la gente toma por su cuenta. `school_courtesy_settings` no se toca.

---

## 2. Roles y permisos

| Rol | Puede |
|---|---|
| **Owner/Admin** (`school_members.role IN ('owner','admin')`, vía `is_school_admin(school_id)`) | Configurar precio/habilitar el módulo, agendar pruebas, ver todas las de su escuela, cancelar/marcar completada/no-show, reenviar confirmación |
| **Entrenador** (`role='coach'`, activo) | Ver **sus propias** pruebas agendadas (solo lectura) |
| **Padres/deportistas** | Sin acceso (v1) |

## 3. Máquina de estados (`trial_class_bookings.status`, `text + CHECK`)

```
agendada → (fecha pasa) → realizada | no_show
agendada → cancelada (owner cancela antes de la fecha)
realizada → convertida (owner la marca manualmente cuando el prospecto se inscribe — no automático)
```
Estados: `agendada · realizada · no_show · cancelada · convertida`

> La conversión a cliente real **no es automática**: el owner marca `convertida` cuando decide inscribir al prospecto por el alta normal de estudiante. `trial_class_bookings` no se acopla al flujo de alta.

---

## 4. Modelo de datos

`text + CHECK` (no `CREATE TYPE`), FKs de negocio a `public.profiles(id)`, `SET search_path = pg_catalog, public, pg_temp` en toda función nueva.

```sql
-- 1. Config por escuela
CREATE TABLE public.school_trial_class_settings (
  school_id             uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  enabled               boolean NOT NULL DEFAULT true,
  price                 numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  requires_approval     boolean NOT NULL DEFAULT false,
  trial_offering_plan_id uuid REFERENCES public.offering_plans(id),  -- lazy init, mismo patrón que courtesy_offering_plan_id
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Agenda de pruebas
CREATE TABLE public.trial_class_bookings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  facility_id           uuid NOT NULL REFERENCES public.facilities(id) ON DELETE RESTRICT,
  coach_id              uuid NOT NULL REFERENCES public.school_staff(id) ON DELETE RESTRICT,
  attendance_session_id uuid REFERENCES public.attendance_sessions(id),
  enrollment_id         uuid REFERENCES public.enrollments(id),
  unregistered_athlete_id uuid REFERENCES public.unregistered_athletes(id),
  prospect_name         text NOT NULL,
  prospect_email        text NOT NULL,
  prospect_whatsapp     text NOT NULL,
  scheduled_date        date NOT NULL,
  start_time            time NOT NULL,
  end_time              time NOT NULL,
  price_charged         numeric(10,2) NOT NULL DEFAULT 0 CHECK (price_charged >= 0),
  status                text NOT NULL DEFAULT 'agendada'
                          CHECK (status IN ('agendada','realizada','no_show','cancelada','convertida')),
  cancel_reason         text,
  confirmation_email_sent_at timestamptz,
  whatsapp_message      text,           -- texto pre-armado generado al confirmar
  created_by            uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trial_bookings_school_date  ON public.trial_class_bookings(school_id, scheduled_date);
CREATE INDEX idx_trial_bookings_coach_date   ON public.trial_class_bookings(coach_id, scheduled_date);
CREATE INDEX idx_trial_bookings_school_status ON public.trial_class_bookings(school_id, status);
```

**Triggers:** `updated_at` + `audit_trigger_func()` en ambas tablas.

**Nota de diseño — `offering_plan` de prueba siempre a precio $0:** el `trial_offering_plan_id` (lazy-creado, igual que el de cortesía) se crea con `price:0, max_sessions:1`. El precio real que el owner cobra en persona se guarda **solo** en `trial_class_bookings.price_charged`, desacoplado del motor de facturación — evita que esta feature dispare lógica de cobros/invoicing sin haberla diseñado (fuera de alcance v1, ver §9).

---

## 5. RLS

Reusa `is_school_admin(school_id)` (no revocarla al caller). Ninguna policy hace `SELECT` sobre su propia tabla.

| Tabla | SELECT | Escritura directa |
|---|---|---|
| `school_trial_class_settings` | `is_school_admin(school_id)` | solo vía RPC |
| `trial_class_bookings` | admin **o** coach dueño (`coach_id` resuelve a `auth.uid()` vía `school_staff.coach_auth_id`) | **ninguna** — solo vía RPCs `SECURITY DEFINER` |

"Coach dueño": `EXISTS (SELECT 1 FROM school_staff ss WHERE ss.id = trial_class_bookings.coach_id AND ss.coach_auth_id = auth.uid())`.

---

## 6. Backend — RPCs (transaccional, `FOR UPDATE`)

Todas `SECURITY DEFINER`, `SET search_path = pg_catalog, public, pg_temp`, `GRANT EXECUTE … TO authenticated` explícito.

- **`trial_class_save_settings(school_id, enabled, price, requires_approval)`** — solo `is_school_admin`.
- **`trial_class_get_joint_slots(school_id, facility_id, coach_id, from_date, to_date)`** — intersecta `facility_availability` (día/hora de la cancha) con `coach_availability` (día/hora del coach), resta bloques ya ocupados por `attendance_sessions` (de esa instalación **o** de ese coach, lo que se cruce primero) → devuelve slots libres conjuntos.
- **`trial_class_create_booking(school_id, facility_id, coach_id, scheduled_date, start_time, end_time, prospect_name, prospect_email, prospect_whatsapp)`** (`is_school_admin`; `FOR UPDATE` sobre la ventana de `facility_availability` y `coach_availability` involucradas para evitar doble-booking en creación concurrente):
  1. Revalida que el slot sigue libre (mismo criterio de `trial_class_get_joint_slots`).
  2. Crea o reutiliza `unregistered_athletes` (dedupe por `school_id + prospect_whatsapp`, mismo criterio que `public-booking.routes.ts`).
  3. Lazy-init de `trial_offering_plan_id` si no existe (`price:0, max_sessions:1`).
  4. Crea `enrollments` sobre ese plan (`status: requires_approval ? 'pending' : 'active'`).
  5. Crea `attendance_sessions` con `facility_id`, `coach_id` **poblado** (a diferencia del flujo de cortesía/walk-in actual), `session_date/start_time/end_time`.
  6. Crea `session_bookings` ligado a la sesión y al enrollment.
  7. Inserta la fila en `trial_class_bookings` con `price_charged = school_trial_class_settings.price` vigente, arma `whatsapp_message` con la plantilla (§7), y retorna el `id` + el mensaje para que el BFF dispare el correo.
- **`trial_class_update_status(id, new_status, cancel_reason?)`** — transiciones válidas de §3, solo `is_school_admin` o el coach dueño (para `no_show`/`realizada`, no para `cancelada`/`convertida`, que quedan solo admin).
- **`trial_class_list(school_id, status?, from?, to?)`** — agenda para la UI del owner.

---

## 7. BFF y notificaciones

`bff/src/routes/trial-classes.ts` (montado bajo `/api/v1/trial-classes`, `requireAuth`, filtra por `req.schoolId`):

- `GET /settings` · `PUT /settings` → wrap de `trial_class_save_settings`
- `GET /slots?facilityId&coachId&from&to` → wrap de `trial_class_get_joint_slots`
- `POST /` → llama `trial_class_create_booking`; si éxito, dispara el correo (`BrandedEmailTemplates`, nuevo template "Confirmación de clase de prueba" con fecha/hora/cancha/entrenador/precio si aplica) vía `emailClient.ts` → `send-email` edge function; marca `confirmation_email_sent_at`. Devuelve al frontend el `whatsapp_message` ya armado.
- `GET /` → wrap de `trial_class_list`
- `PATCH /:id/status` → wrap de `trial_class_update_status`
- `POST /:id/resend-confirmation` → reenvía el correo

**Plantilla WhatsApp** (texto plano, se arma en la RPC y se muestra en la UI con botón "Abrir WhatsApp" → `salesWhatsappLink()` de `frontend/src/lib/salesContact.ts`, reusado tal cual):
```
Hola {prospect_name}, confirmamos tu clase de prueba en {school_name} el {fecha} a las {hora} en {facility_name} con el entrenador {coach_name}.{precio_line} ¡Te esperamos!
```

**Email vs WhatsApp:** email sale automático al confirmar (BFF); WhatsApp queda **manual** — el owner hace clic para abrirlo y enviarlo, sin integración Cloud API (`whatsapp.service.ts` no se toca).

---

## 8. Flujo de UI (Owner)

**8.1 Nueva pestaña "Clases de Prueba"** en `SchoolFacilitiesPage.tsx` (junto a "Instalaciones"/"Reservas"), gateada igual que hoy (`ModuleGate moduleKey="sedes_instalaciones"`, roles `['school','admin','school_admin','super_admin']`).

- Lista/agenda de `trial_class_bookings` (fecha, prospecto, cancha, coach, estado), filtros por estado/rango de fecha.
- Botón **"Agendar clase de prueba"** → `TrialClassBookingModal.tsx`:
  1. Selecciona instalación (`facilities` de la escuela).
  2. Selecciona entrenador (`school_staff` activos con `coach_availability` configurada).
  3. El sistema muestra los slots conjuntos libres (`GET /slots`) — solo horarios donde cancha **y** coach coinciden.
  4. Elige slot → datos del prospecto (nombre, correo, WhatsApp) → confirma.
  5. Al confirmar: toast de éxito + modal con el mensaje de WhatsApp listo para copiar/abrir (`salesWhatsappLink`).
- Acciones por fila: marcar realizada/no-show, cancelar (con motivo), marcar convertida, reenviar confirmación.

**8.2 Configuración** (Ajustes → Instalaciones o sección nueva "Clases de prueba"): toggle habilitar, campo de precio, toggle "requiere aprobación".

---

## 9. Fuera de alcance (v1)

Cobro/pago integrado (payments) para la clase de prueba · conversión automática a enrollment de pago · WhatsApp vía Cloud API · recordatorios automáticos (día antes) · clases de prueba grupales (siempre 1:1 en v1) · vista de calendario tipo grid (se entrega como lista/agenda, igual que el resto de `SchoolFacilitiesPage`) · que el coach agende sus propias pruebas (solo lectura en v1) · `booking_holds` (no aplica: flujo interno del owner, no público concurrente — el `FOR UPDATE` en la RPC basta).

---

## 10. Validaciones y reglas

- Slot debe caer dentro de un bloque activo de `facility_availability` **y** de `coach_availability` simultáneamente.
- No se permite crear si ya existe un `attendance_sessions` que se solape para esa instalación **o** para ese coach en ese rango horario (revalidado con `FOR UPDATE` dentro de la RPC, no solo en el cálculo de slots).
- `prospect_email` y `prospect_whatsapp` obligatorios (se necesitan para poder confirmar).
- Dedupe de prospecto por `school_id + prospect_whatsapp` contra `unregistered_athletes`, igual criterio que el flujo de cortesía.
- Transiciones de estado solo las de §3; `cancelada`/`convertida` solo admin.

---

## 11. Decisiones de producto (RESUELTAS)

1. **Módulo base:** se agenda a través de `facility_availability` + `attendance_sessions` (no `facility_reservations`, que es alquiler de cancha sin coach ni plan).
2. **Vínculo con el coach:** validado cruzando `coach_availability` contra el slot de instalación elegido — no es un campo informativo suelto.
3. **Capacidad:** siempre 1:1 en v1 (sin preferencia explícita del usuario; se deja como el default más simple y orientado a conversión — revisable a futuro).
4. **Notificación:** email automático al confirmar; WhatsApp con mensaje pre-armado, envío manual por el owner (`wa.me`, sin Cloud API).
5. **Cortesía vs prueba:** mecanismos hermanos pero separados — `school_trial_class_settings`/`trial_class_bookings` propios, sin tocar `school_courtesy_settings`.
6. **Precio:** configurable **a nivel escuela** (un valor por defecto, editable), no por booking individual.
7. **Cobro:** fuera del sistema en v1 — solo se registra `price_charged`, sin generar pago/factura.
8. **Conversión a cliente:** manual — el owner marca `convertida`; no crea automáticamente un enrollment de pago.
9. **Quién agenda:** solo owner/admin en v1; el coach solo ve (lectura) sus propias pruebas.

---

## 12. Criterios de aceptación

1. Owner configura precio de clase de prueba en Ajustes ✓
2. Owner agenda una prueba: solo ve slots donde cancha y coach coinciden ✓
3. Al confirmar, el prospecto recibe el correo automático y el owner puede abrir el WhatsApp pre-armado ✓
4. Dos owners (o el mismo dos veces) no pueden agendar el mismo slot cancha+coach dos veces — el segundo intento falla con "slot no disponible" ✓
5. Coach ve sus propias pruebas agendadas, no las de otros coaches ✓
6. Owner marca una prueba como `no_show`/`realizada`/`convertida`/`cancelada` y el estado se refleja en la agenda ✓
7. Ninguna escritura ocurre fuera de las RPCs `SECURITY DEFINER` (RLS sin policies de escritura en ambas tablas) ✓

---

## 13. Fases de construcción (una fase por sesión/rama, con revisión entre cada una)

Migraciones nuevas e inmutables, `YYYYMMDDHHMMSS`, creadas con `npm run migrations:new -- <slug>`.

| Fase | Rama | Entregable | Archivos |
|---|---|---|---|
| **1 · Backend** | `feature/trial-classes-backend` | Tablas + RLS + RPCs (settings, slots, create, update_status, list) + tests de concurrencia (doble booking del mismo slot) | `supabase/migrations/<ts>_trial_class_bookings.sql`, `..._trial_class_rpcs.sql` |
| **2 · BFF** | `feature/trial-classes-bff` | `bff/src/routes/trial-classes.ts` + template de email + integración `salesWhatsappLink` | `bff/src/routes/trial-classes.ts`, `bff/src/utils/emailTemplates.ts` (nuevo template) |
| **3 · Frontend Owner** | `feature/trial-classes-ui` | Pestaña "Clases de Prueba" + modal de agendamiento + ajustes de precio | `SchoolFacilitiesPage.tsx`, `TrialClassBookingModal.tsx`, `useTrialClasses.ts` (hook) |
| **4 · QA piloto** | — | 1 escuela → validar flujo completo, luego más | tests + validación en `develop` |

**Entrega recomendada:** Fases 1–2 primero (backend + confirmación funcionando, aunque sea probado por Postman/BFF), Fase 3 después con revisión de UI.

---

## 14. Checklist de convenciones del repo (no romper)

- [ ] Migraciones nuevas, nunca editar/borrar existentes; usar `npm run migrations:new -- <slug>`
- [ ] `SET search_path = pg_catalog, public, pg_temp` en toda función nueva
- [ ] `GRANT EXECUTE … TO authenticated` explícito por RPC
- [ ] No revocar `is_school_admin()` al caller
- [ ] RLS sin self-recursion (no `SELECT` sobre la propia tabla en `USING`)
- [ ] FKs de negocio a `public.profiles(id)`
- [ ] `text + CHECK`, no `CREATE TYPE`, para estados
- [ ] Escritura solo por RPC `SECURITY DEFINER` con `FOR UPDATE` en la validación de slot — nunca `INSERT`/`UPDATE` directo desde el cliente
- [ ] Entrega full-stack (DB + RLS + RPCs + BFF + Frontend + QA)
- [ ] `npm run seguridad:invariantes` después de aplicar la migración de RLS
- [ ] Cero acoplamiento con `school_courtesy_settings` / motor de facturación (`payments`, `invoices`)
