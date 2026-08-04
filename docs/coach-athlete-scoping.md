# Alcance del coach de escuela sobre deportistas

> **Decisión de negocio (firme):** el `coach` que pertenece a una escuela **NO da de alta atletas**.
> El alta es exclusiva de **admin/owner** de la escuela. El coach queda **solo lectura**
> sobre deportistas (ve/gestiona los atletas de sus equipos, pero no los crea ni importa).

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
- **RLS**: el scope del coach hoy es a nivel de app + guard de ruta/route role. Evaluar RLS que impida a un coach ver/mutar fuera de sus equipos (defensa en profundidad en DB).
- **Ruta `/students`**: sigue permitiendo `coach` en [`App.tsx`](../frontend/src/App.tsx) (lectura). No se cambió.
