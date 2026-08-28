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
  agrega `canCreateOrEditStudents = canManageStudents || coachCanCreateAthletes`, leído de
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
