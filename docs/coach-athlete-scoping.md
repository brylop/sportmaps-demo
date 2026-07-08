# Alcance del coach de escuela sobre deportistas

> Estado: **Fase 1 implementada** (fix del bug). Fases 2+ documentadas como backlog.
> Contexto del bug original: un `coach` creaba un atleta y no aparecía en su lista "Mis Deportistas".

## 1. Contexto — dos tipos de "coach"

El sistema ya distingue dos roles distintos (ver [`constants/roles.ts`](../frontend/src/constants/roles.ts)):

| Rol | Qué es | Cómo gestiona atletas |
|-----|--------|-----------------------|
| `personal_trainer` | Entrenador **independiente** (no tiene admin encima). Se identifica por `schools.school_type = 'personal_trainer'` + `trainer_profiles`. | Área propia `/trainer/*` → **"Mis Clientes"** ([`TrainerClients`](../frontend/src/pages/trainer/TrainerClients.tsx)). Endpoints `/api/v1/trainer/*`. **Sin cambios** — su flujo ya es correcto. |
| `coach` | Entrenador **empleado de una escuela** (staff). Se identifica por `profiles.role = 'coach'` + fila en `school_staff`. | Menú "Mis Deportistas" → `/students` ([`StudentsPage`](../frontend/src/pages/StudentsPage.tsx)). Este documento trata **solo este caso.** |

## 2. Causa raíz del bug

- La lista del coach en [`StudentsPage.tsx`](../frontend/src/pages/StudentsPage.tsx) filtra la vista `school_athletes` por `enrolled_team_id IN (equipos del coach)`.
- `enrolled_team_id` en la vista (mig. `20260707000001_fix_school_athletes_view_all_statuses.sql`) sale **solo** de un `enrollments` con `status='active' AND team_id IS NOT NULL`.
- En `CreateChildModal` / `CreateAdultAthleteModal` el campo **Equipo era opcional** (`"Sin equipo"` por defecto) y el dropdown mostraba **todos** los equipos de la escuela.
- Resultado: el coach creaba un atleta **sin equipo** (o con un equipo que no es suyo) → sin `enrolled_team_id` que coincida → invisible en su lista. El atleta **sí** existía en `children`, solo quedaba fuera del filtro.

## 3. Fase 1 — Fix implementado (desbloqueo)

**Regla:** cuando quien crea es un `coach`, el selector de equipo se **restringe a sus propios equipos** y es **obligatorio**. Así el atleta siempre queda inscrito en un equipo del coach y aparece de inmediato en "Mis Deportistas".

Archivos tocados:
- [`StudentsPage.tsx`](../frontend/src/pages/StudentsPage.tsx) — nuevo estado `coachTeamIds` (los equipos del coach, ya calculados para el filtro de la lista); se pasa como prop a los modales. `null` cuando no es coach (admin/owner) → sin restricción.
- [`CreateChildModal.tsx`](../frontend/src/components/students/CreateChildModal.tsx) — prop `coachTeamIds`; dropdown filtrado a `visibleTeams`; sin opción "Sin equipo" para coach; equipo obligatorio en `validate()`; autoselección si hay un único equipo.
- [`CreateAdultAthleteModal.tsx`](../frontend/src/components/students/CreateAdultAthleteModal.tsx) — mismo tratamiento en los dos flujos de inscripción (adulto existente y no registrado).

Se mantiene todo el comportamiento previo para `school` / `school_admin` / `admin` (equipo sigue siendo opcional y ven todos los equipos).

### Reglas de scope aplicadas
- El coach solo puede asignar a **equipos donde él es coach** (`teams.coach_id = coachId` ∪ `team_coaches.coach_id = coachId`, con `coachId = school_staff.id`).
- Si tiene **varios equipos**, solo aparecen esos en el dropdown.
- Si **no tiene equipos** asignados, no puede crear atletas (mensaje: pedir a la escuela que le asigne uno).

## 4. Backlog — otras opciones (pendientes, NO implementadas)

Opciones de diseño evaluadas para decidir más adelante:

- **B — Coach solo lectura + inscribir a sus equipos:** el coach NO crea atletas nuevos; solo puede inscribir atletas **ya existentes** de la escuela a sus equipos (botón "Inscribir en Clase" scopeado). El alta la hace admin/owner.
- **C — Coach solo lectura total:** quitar al coach todos los botones de alta ("Nuevo Atleta", "Importar CSV", "Invitar", "Inscribir en Clase"). El alta es exclusiva de admin/owner. Elimina la ambigüedad de raíz.
- **Endurecer en backend (RLS/route guard):** hoy el scope del coach es **solo a nivel de aplicación** (`StudentsPage` filtra en el cliente) y el endpoint `/api/v1/students/create-one` acepta el rol `coach` sin validar que el `team_id` sea suyo. Falta:
  - Validar en el BFF que, si el creador es coach, el `team_id` enviado pertenezca a sus equipos.
  - Considerar RLS que impida a un coach ver/crear fuera de sus equipos (defensa en profundidad).
- **Otros puntos de alta a alinear** (hoy quedan fuera del fix de Fase 1):
  - **Importar CSV** ([`CSVImportModal`](../frontend/src/components/students/CSVImportModal.tsx) → `/api/v1/students/bulk`): un coach podría importar atletas sin equipo → invisibles. Definir si el coach puede importar y, si sí, forzar/mapear equipo propio.
  - **Invitar por enlace** (`/register?ref=...`): el atleta que se autoinscribe puede quedar sin equipo del coach.
  - **`adult_invite`** (invitación sin cuenta): no crea enrollment; el atleta no aparece hasta que se registra e inscribe. No aplica equipo obligatorio.
  - **`EnrollStudentModal`** ("Inscribir en Clase"): revisar scope de equipos para coach.

## 5. Notas
- El scope del coach depende de que exista su fila en `school_staff` (match por email). Si no existe, hoy cae al modo escuela (ve todo, sin restricción). Edge a revisar si se endurece.
