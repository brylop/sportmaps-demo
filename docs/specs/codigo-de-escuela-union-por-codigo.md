# Código de escuela — unirse después de registrarse

**Estado:** F0 (spec) · 2026-10-26 · pendiente de aprobación antes de escribir migraciones.
**Origen:** caso Besser / Isabella Millán (2026-10-26).

## 1. El problema

Hoy una persona puede crear su cuenta en SportMaps sin quedar unida a ninguna escuela, y desde ahí **no tiene forma de llegar a su escuela**. La escuela tampoco se entera de que existe.

Las entradas que existen hoy no cubren a quien **ya tiene cuenta**:

| Entrada | Qué hace | Por qué no sirve aquí |
|---|---|---|
| Invitación de la escuela | La escuela invita un correo | La escuela tiene que saber antes que esa persona existe |
| QR de inscripción (`/join/:slug`, `school_join_qr_codes`) | Registro nuevo + ficha + inscripción `pending` + **cobro** | Es para entrar desde cero; además cobra antes de que la escuela asigne categoría |
| Prospectos (`/inscripcion/:slug`, `school_signup_leads`) | Formulario público sin login | No liga la cuenta; la pantalla de la escuela (F1) nunca se construyó |

**Medido en vivo el 2026-10-26:** 164 cuentas reales (`is_demo = false`) de rol `parent` o `athlete` no tienen membresía, ni hijos, ni inscripción, ni invitación pendiente: 115 deportistas y 49 acudientes. **34 se crearon en los últimos 60 días.**

Caso testigo: `elika2013s@gmail.com`. La mamá creó la cuenta como acudiente el 30-sep. Un minuto después el perfil se renombró a la deportista (16 años). La cuenta quedó sin hijos y sin escuela, entró una sola vez y Besser no sabe que existe.

## 2. La propuesta en una línea

Cada escuela tiene un **código corto** (`BES-4K7Q`). Quien ya tiene cuenta lo ingresa y queda de inmediato en la bandeja **«Por asignar»** de esa escuela. Ahí la escuela elige la **categoría (equipo)**, y con eso queda también el entrenador. Hasta ese momento **no se crea inscripción ni cobro**.

## 3. Flujo

### Escuela
1. **Estudiantes → «Código de la escuela»**: tarjeta con el código, botón copiar, compartir por WhatsApp, QR imprimible (que abre `/unirse?codigo=BES-4K7Q`) y «Cambiar código» (el anterior deja de servir).
2. **Estudiantes → «Por asignar (N)»**: lista de solicitudes con nombre, edad, categoría sugerida por la familia y fecha. Por cada una:
   - **Asignar a un equipo.** El entrenador es el del equipo (`team_coaches`), así que no hace falta un paso aparte.
   - **«Ya tiene ficha»**: si existe una ficha del mismo nombre en la escuela (por ejemplo, cargada por la escuela sin acudiente), se ofrece **vincular** la cuenta a esa ficha en vez de crear otra. Esto evita las identidades duplicadas que ya nos costaron (ver `project_duplicate_athlete_identities`).
   - **Rechazar**, con motivo opcional.
3. Aviso a los administradores de la escuela cuando entra una solicitud, por el despachador de notificaciones.

### Familia o deportista
1. Al terminar el onboarding de `parent` o `athlete` aparece el paso opcional **«¿Ya tienes escuela? Ingresa su código»**. Si la cuenta no tiene ninguna escuela, también aparece un aviso en el inicio y en «Mis hijos».
2. Al escribir el código se muestra **nombre y logo de la escuela** para confirmar («¿Es Club Deportivo Besser?»).
3. **¿Para quién es?** Hay dos opciones: «Para mí» o «Para mi hijo(a)». En los dos casos se pide nombre, fecha de nacimiento y una categoría sugerida (texto libre, opcional). Así se corrige el caso Isabella: la cuenta de la mamá queda como acudiente y la deportista como hija.
4. Pantalla de «Solicitud enviada — Besser te asignará la categoría». Cuando la escuela asigna, llega un aviso y el inicio pasa a mostrar la escuela.

## 4. Modelo de datos (propuesta F1)

Todas las tablas son nuevas, con estados `text + CHECK` y FKs a `profiles(id)`.

**`school_join_codes`**
- `id`, `school_id` → `schools`, `branch_id` (opcional, ver D2), `code text UNIQUE`, `active boolean`, `uses_count int`, `created_by` → `profiles`, `created_at`, `revoked_at`.
- Formato: prefijo de 3 letras + 4 caracteres de un alfabeto sin ambiguos (sin `0/O/1/I/L`). Se normaliza a mayúsculas y sin guiones al validar.
- Un solo código activo por escuela (índice único parcial `WHERE active`).

**`school_join_requests`**
- `id`, `school_id`, `join_code_id`, `requester_profile_id` → `profiles`.
- `for_whom text CHECK (for_whom IN ('self','child'))`, `athlete_name`, `birth_date`, `suggested_category`.
- `status text CHECK (status IN ('pending','assigned','linked','rejected','cancelled'))`.
- `assigned_team_id`, `child_id`, `enrollment_id`, `resolved_by`, `resolved_at`, `reject_reason`, `created_at`.
- Índice único parcial: una sola `pending` por `(school_id, requester_profile_id, lower(unaccent(athlete_name)))`.

**¿Por qué no reusar `school_signup_leads`?** Un prospecto es anónimo y sin cuenta, y una solicitud ya trae cuenta y debe terminar ligada a ella. Se ven en la misma bandeja de la escuela, pero el dato es distinto (ver D1).

## 5. RPCs (todas `SECURITY DEFINER`, `SET search_path = pg_catalog, public, pg_temp`)

| RPC | Quién | Qué hace |
|---|---|---|
| `preview_school_join_code(p_code)` | `authenticated` | Devuelve solo nombre, logo y ciudad. Tiene límite de intentos por usuario para que no se puedan adivinar códigos. |
| `submit_school_join_request(p_code, p_for_whom, p_name, p_birth_date, p_category)` | `authenticated` | Crea la solicitud `pending`, suma `uses_count` y avisa a los admins. |
| `cancel_school_join_request(p_id)` | quien la creó | Solo si sigue `pending`. |
| `list_school_join_requests(p_school)` | staff de la escuela | Bandeja «Por asignar», con las fichas candidatas a vincular. |
| `resolve_school_join_request(p_id, p_action, p_team_id, p_child_id, p_reason)` | admin de la escuela | **Transaccional:** asignar crea la ficha (si es `child`, con `parent_id` = quien pidió) y la inscripción en el equipo; vincular pone `parent_id` en la ficha existente; rechazar solo cambia el estado. Bloquea la solicitud con `FOR UPDATE` para que dos admins no la resuelvan dos veces. |
| `rotate_school_join_code(p_school)` | admin de la escuela | Revoca el código activo y crea uno nuevo. |

- `GRANT EXECUTE … TO authenticated` explícito, y `REVOKE` explícito de `anon` y `authenticated` donde no aplica (los default privileges otorgan `EXECUTE` solos).
- **La inscripción NO se crea con un INSERT propio.** `resolve_school_join_request` llama al mismo camino que usa hoy «Agregar estudiante», para no sumar un camino 14 que cree cobros (ver el censo de 13 caminos). Cuál es exactamente se confirma en el plan de F1.
- El monto y el primer cobro siguen la regla normal de la escuela: la escuela decide el precio.

## 6. RLS

- Escritura en las dos tablas: **ninguna policy** desde el cliente; todo pasa por las RPCs.
- Lectura de `school_join_requests`: quien la creó ve las suyas; la escuela ve las suyas con `user_staff_school_ids()`. Nunca `user_school_ids()`, que incluye padres y atletas.
- Lectura de `school_join_codes`: solo `user_admin_school_ids()`. El público solo conoce el código por la RPC de vista previa.
- Al cerrar F1 se corre `npm run seguridad:invariantes` y se listan **todas** las policies de las dos tablas.

## 7. Fases

| Fase | Contenido | Entregable |
|---|---|---|
| F0 | Este spec + decisiones | Aprobación |
| F1 | DB + RLS + RPCs + pruebas (incluida la de concurrencia de `resolve`) | Plan de migración aprobado → migración por `npm run migrations:new` |
| F2 | UI de la familia: paso en el onboarding, aviso en el inicio y en «Mis hijos», `/unirse?codigo=` | Probado con una cuenta real sin escuela |
| F3 | UI de la escuela: tarjeta del código, bandeja «Por asignar», avisos | Probado con Besser |
| F4 | Recuperar las 164 cuentas: aviso único en el inicio de las cuentas sin escuela + manual de una página para que las escuelas compartan su código | — |

## 8. Decisiones abiertas

- **D1.** ¿Una sola bandeja «Por asignar» para solicitudes por código **y** prospectos del formulario público? *Recomendado: sí en la pantalla, separadas en datos.* Así se cierra de paso la F1 pendiente de Prospectos.
- **D2.** ¿Un código por escuela o uno por sede? *Recomendado: por escuela, y que la escuela elija la sede al asignar.*
- **D3.** ¿Puede asignar el entrenador o solo la administración? *Recomendado: solo administración.* Asignar crea inscripción y cobro, y eso es dinero.
- **D4.** Al asignar, ¿empieza a cobrar de inmediato o espera el siguiente periodo? *Se sigue la regla actual de la escuela; no se inventa una nueva.*
- **D5.** ¿El código vence? *Recomendado: no, pero se puede cambiar en cualquier momento.*
