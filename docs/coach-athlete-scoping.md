# Alcance del coach de escuela sobre deportistas

> **Decisión de negocio (firme, con excepción por escuela desde 2026-08-28):** el `coach` que
> pertenece a una escuela **NO da de alta atletas**. El alta es exclusiva de **admin/owner** de
> la escuela. El coach queda **solo lectura** sobre deportistas (ve/gestiona los atletas de sus
> equipos, pero no los crea ni importa) — **salvo que la escuela active
> `school_settings.coach_can_create_athletes`** (ver sección 6), que hoy solo está activo para
> **Carmel Club**.

## 1. Contexto — dos tipos de "coach"

El sistema distingue dos roles (ver [`constants/roles.ts`](../frontend/src/constants/roles.ts)):

| Rol | Qué es | Alta de atletas |
|-----|--------|-----------------|
| `personal_trainer` | Entrenador **independiente** (`schools.school_type='personal_trainer'` + `trainer_profiles`). No tiene admin encima. | Área propia `/trainer/*` → **"Mis Clientes"** ([`TrainerClients`](../frontend/src/pages/trainer/TrainerClients.tsx)). **Sí** crea sus propios clientes. Sin cambios. |
| `coach` | Entrenador **empleado de una escuela** (`profiles.role='coach'` + fila en `school_staff`). | **NO crea atletas.** Solo lectura sobre `/students`. |

## 2. Página real

⚠️ La ruta `/students` en [`App.tsx`](../frontend/src/App.tsx) renderiza **[`SchoolStudentsManagementPage`](../frontend/src/pages/SchoolStudentsManagementPage.tsx)**, no `StudentsPage`.
`frontend/src/pages/StudentsPage.tsx` **es código muerto** (no está importado en ninguna ruta) — candidato a eliminar.

## 3. Causa raíz del bug original

- La lista del coach filtra la vista `school_athletes` por `enrolled_team_id IN (equipos del coach)`.
- `enrolled_team_id` sale solo de un `enrollments` con `status='active' AND team_id IS NOT NULL`.
- El alta permitía equipo opcional → el coach creaba un atleta sin equipo (o con equipo ajeno) → invisible en su lista. El atleta existía en `children`, pero quedaba fuera del filtro.

## 4. Implementado (decisión: coach solo lectura)

### Frontend — [`SchoolStudentsManagementPage.tsx`](../frontend/src/pages/SchoolStudentsManagementPage.tsx)
- Flag `canManageStudents = profile?.role !== 'coach'`.
- Se ocultan para el coach: **"Importar CSV"**, **"Agregar Atleta"** (header) y la acción **"+ Agregar Atleta"** del `EmptyState`.
- El coach conserva: ver perfil, editar, activar/inactivar e invitar acudientes de los atletas de sus equipos (gestión, no alta).

### Backend — defensa en profundidad
- [`students-create-one.route.ts`](../bff/src/routes/students-create-one.route.ts): `requireRole` sin `coach`/`staff` → `('owner','admin','super_admin','school_admin','school')`.
- [`students.ts`](../bff/src/routes/students.ts) `POST /bulk`: mismo cambio.
- Se dejan intactos `GET /` (lista) y `PUT /:id` (editar) — el coach sigue viendo y gestionando sus atletas.

### Revertido
- Se descartó el enfoque previo (restringir el selector de equipo del coach en los modales `CreateChildModal`/`CreateAdultAthleteModal`), ya que el coach dejó de crear atletas. Esos modales y `StudentsPage` volvieron a su versión original.

## 5. Backlog / pendientes
- **Eliminar** `StudentsPage.tsx` (dead code) — verificar que no haya import dinámico antes.
- **`personal_trainer`**: su rol no está en `requireRole` de `create-one`/`bulk`; usa `/api/v1/trainer/*`. Confirmar que ningún flujo de trainer dependa de `create-one`.
- **RLS**: el scope del coach hoy es a nivel de app + guard de ruta/route role. Evaluar RLS que impida a un coach ver/mutar fuera de sus equipos (defensa en profundidad en DB). La RLS de `children` (`20260802224625_children_rls_solo_staff.sql`) ya quedó permisiva para cualquier staff (incluye coach) desde agosto — inconsistente con `enrollments`, que sigue admin-only a nivel RLS.
- **Ruta `/students`**: sigue permitiendo `coach` en [`App.tsx`](../frontend/src/App.tsx) (lectura). No se cambió.

## 6. Excepción por escuela — `coach_can_create_athletes` (2026-08-28, Carmel Club)

Carmel Club pidió que sus entrenadores sí puedan dar de alta y editar atletas. En vez de tocar
la regla general, se agregó un toggle por escuela — mismo patrón que
`coach_can_enroll_paid_teams` (`20260731152955_coach_enroll_paid_teams_toggle.sql`): lo decide
la escuela, no el código.

- **Columna:** `school_settings.coach_can_create_athletes boolean NOT NULL DEFAULT false`
  (migración `20260828174117_coach_can_create_athletes.sql`). Default `false` = comportamiento
  descrito en las secciones 1-4, sin cambios, para toda escuela que no lo active.
- **Alcance de la excepción — SOLO dos rutas:**
  - `POST /api/v1/students/create-one` (alta 1x1: menor, adulto existente/invitado, atleta
    sin cuenta) — `coach` entra en `requireRole`, pero se rechaza con 403 si el flag no está en
    `true` para esa escuela.
  - `PUT /api/v1/students/:id` (editar perfil/enrollment) — mismo patrón.
  - **`POST /api/v1/students/bulk` (carga masiva CSV) NUNCA se habilita bajo este flag** — sigue
    siendo admin-only sin excepción, y el frontend nunca muestra "Importar CSV" a un coach.
  - Inactivar/reactivar tampoco se habilita: ese RPC exige `is_school_admin` sin mirar el flag.
- **Frontend:** [`SchoolStudentsManagementPage.tsx`](../frontend/src/pages/SchoolStudentsManagementPage.tsx)
  agrega `canCreateOrEditStudents = canManageStudents || coachCanCreateAthletes` (desde
  2026-09-03 el término `|| coachCanEditCategories` se suma — ver §7), leído de
  `useEntitlements()` → `GET /api/v1/me/entitlements` → vista `v_school_entitlements` → columna
  `coach_can_create_athletes`. Gatea solo "Agregar Atleta" y "Editar"; CSV, inactivar/reactivar
  y carga de documentos siguen atados al `canManageStudents` original (estricto).
- **Auditoría:** cada alta o edición hecha por un coach bajo este flag deja fila en
  `audit_logs` (`action = 'COACH_CREATE_ATHLETE'` / `'COACH_EDIT_ATHLETE'`), visible en
  [`AdminActivityLogsPage.tsx`](../frontend/src/pages/AdminActivityLogsPage.tsx).
- **Quién lo tiene activo:** solo Carmel Club (`374a6716-af42-4745-afe1-8d089153e01b`),
  activado con un `UPDATE` directo tras aplicar la migración (no hay panel de UI para
  este toggle específico — a diferencia de `coach_can_enroll_paid_teams`, que tampoco
  tiene panel, este tampoco lo necesitaba para un caso puntual).
- **RLS:** sin cambios — el gate es 100% BFF, igual que `coach_can_enroll_paid_teams`.

## 7. Segunda excepción por escuela — `coach_can_edit_categories` (2026-09-03, Besser)

Club Deportivo Besser (`759eee9d-05cb-4958-b84a-2560f77e3683`) se importó con
`scripts/besser-import/01_cargar_atletas.mjs` y **todos sus atletas quedaron en el equipo
placeholder "Sin categoría asignada"**. Sus entrenadores necesitaban repartirlos por categoría,
pero no debían ver dinero. Migración `20260828174117` → no: eso habilita el *alta*. Se agregaron
dos toggles propios en `20260903144504_coach_besser_financial_categoria.sql`:

- `coach_can_edit_categories` — el BFF (`PUT /api/v1/students/:id`) acepta `enrollment.team_id`
  de un coach y **sanea el resto del payload**: descarta `profile` entero y rechaza todo campo de
  dinero (`monthly_fee`, `fee_is_manual`, `fee_reason`, `offering_plan_id`), tenga el flag o no.
- `coach_hide_financial_info` — enmascara a NULL las columnas de dinero de la vista
  `school_athletes` para coach. Va en el `SELECT` de la vista, no en una policy: RLS filtra
  FILAS, no COLUMNAS, y esa pantalla lee directo contra Supabase sin pasar por el BFF.

Ambos se exponen al frontend por `v_school_entitlements` → `useEntitlements()`. En
`SchoolStudentsManagementPage.tsx` el término `|| coachCanEditCategories` entra en
`canCreateOrEditStudents` (abre "Editar") pero **no** en `canCreateStudents` (el alta sigue
cerrada), y `isCategoryOnlyCoach` apaga los bloques de perfil y de dinero del modal.

### Los dos caminos para poner un atleta en una categoría — no confundirlos

| | Camino | Gate |
|---|---|---|
| **(a)** | Mis Deportistas → Editar → selector de categoría → `PUT /api/v1/students/:id` | `coach_can_edit_categories` |
| **(b)** | Mis Equipos → "Gestionar Deportistas" → `POST /api/v1/enrollments` | **ninguno** — `coach` ya está en el `requireRole` de `enrollments.ts`. Solo `coach_can_enroll_paid_teams` si el equipo tiene precio |

El camino (b) funciona para **cualquier** coach de **cualquier** escuela desde antes de estos
toggles. Un reporte de "no puedo añadir deportistas a la categoría" casi nunca es de permisos.

### La trampa: el camino (a) depende de una lista que el coach quizá no ve

`SchoolStudentsManagementPage.tsx` no usa `getSchoolView` cuando quien mira es coach: filtra por
`enrolled_team_id IN (equipos del coach)`, resueltos desde `team_coaches.coach_id` y
`teams.coach_id` (ambos apuntan a `school_staff.id`, buscado **por email**). Consecuencias:

- Si el coach no está asignado al equipo placeholder, **su lista sale vacía** y no tiene a quién
  reasignar, aunque `coach_can_edit_categories` esté activo. Esto es una falla de visibilidad,
  no de permisos, y se ve idéntica al usuario.
- Si el coach no tiene fila en `school_staff` con ese email, `coachId` queda `undefined` y cae al
  branch `else`: ve **toda** la escuela.

### Pendientes conocidos

- **El coach puede inscribir pero no remover.** En `EnrollTeamStudentModal.tsx` "Inscribir" va por
  el BFF y "Remover" va directo a Supabase, donde la RLS de `enrollments` lo rechaza. El propio
  código lo comenta. Mover el remove al BFF exige decidir antes si el coach entra en el
  `requireRole` de `DELETE/PATCH /api/v1/enrollments/:id` (hoy admin-only) — decisión de producto.
- **Alcance sin candado servidor.** Ni el BFF ni la RLS limitan al coach a *sus* equipos: el filtro
  por equipos del coach es de cliente. `POST /enrollments` valida `teams.school_id = req.schoolId`;
  `PUT /students/:id` lee el equipo con `.eq('id', …)` **sin** `.eq('school_id', …)`.
- **Los dos toggles son ortogonales y se cruzan mal.** `POST /enrollments` consulta
  `coach_can_enroll_paid_teams` antes de inscribir a un equipo con precio; `PUT /students/:id`
  **no**. Un coach de Besser que reasigne a una categoría con precio dispara `createPendingPayment`
  sin pasar por ese toggle, y además no ve el monto que acaba de generar.
- **Verificar contra la base** (el registro de migraciones no dice qué está vivo): la migración
  `20260903144504` menciona una policy `"Staff can manage enrollments"` que usa `is_school_coach()`
  y que **no existe en ningún `.sql` del repo**. `is_school_coach()` devuelve true para
  owner/admin/coach. Si esa policy es de escritura y está viva, el coach tiene escritura directa a
  `enrollments` por RLS y el razonamiento "el gate está en el BFF" es falso:
  `select cmd, policyname, permissive, roles, qual, with_check from pg_policies where tablename = 'enrollments';`
