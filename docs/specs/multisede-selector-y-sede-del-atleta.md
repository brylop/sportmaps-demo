# Multisede: selector de sede y una sola sede por atleta

**Estado:** borrador para aprobar, 2026-10-14. No hay código escrito.
**Origen:** Monster's Volley Club con dos sedes: Suba (principal, 125 atletas) y Norte (19 atletas, cargados el 2026-10-14).

## 1. Cómo está hoy

El dato de la sede existe, pero **el dueño no tiene cómo usarlo**:

- `activeBranchId` solo se llena desde `school_members.branch_id` (`useSchoolContext.ts:204-226`). Para owner y super_admin se fuerza `null`, así que el dueño siempre ve «todas las sedes».
- El `SchoolSwitcher` está apagado a propósito (`SchoolSwitcher.tsx:5-25`) porque `enrollments` no tiene `branch_id`.

| Módulo | ¿Muestra sede? | ¿Filtra? | Fuente | Hueco |
|---|---|---|---|---|
| Deportistas (`SchoolStudentsManagementPage.tsx`) | Sí: columna y ficha (`:1645,1689,2409`) | Solo por `activeBranchId` (`students.ts:227`); no hay filtro en la página | Vista `school_athletes`: niño con cuenta → `c.branch_id`; adulto → `team.branch_id`, luego `sm.branch_id`; ficha → `ua.branch_id` | Tres reglas distintas; niños y fichas ignoran la sede del equipo |
| Cobros (`PaymentsAutomationPage.tsx`, `FinancesPage.tsx`) | No | Por `activeBranchId`, con `branch_id IS NULL OR =` | `payments.branch_id` = `COALESCE(c.branch_id, t.branch_id)` en `open_month` y `cobros_f1` | **Nunca usa `ua.branch_id`**; un cobro sin sede aparece en todas |
| Contabilidad, KPIs, cierre de mes | Agrupa por sede (`finance_income_summary`) | Por `p_branch_id` | `payments` / `expenses.branch_id` | Solo lo usa quien tiene sede en su membresía |
| Reporte «Sedes» (`bff/src/routes/reports.ts:566-596`) | Sí | `getBranchFilter` | Alumnos **solo de `children.branch_id`** | En Monster los alumnos por sede salen ≈0 (son fichas); NULL se etiqueta «Principal» |
| Equipos (`TeamsPage.tsx`) | Sí; NULL dice «Sede Principal» | Por `activeBranchId` | `teams.branch_id` (+ `team_branches`, que nadie filtra) | Etiqueta engañosa |
| Categorías, asistencia, calendario | No | No | — | Sin sede |
| Permisos por sede | — | Solo en pantalla | `school_members.branch_id`, `school_staff.branch_id` | **Ninguna policy RLS usa `branch_id`**: un admin o coach «de sede» puede leer todo por API |

**Datos de Monster hoy:**
- Las 144 fichas tienen sede, y en todas la sede de la ficha coincide con la de su equipo.
- Las 13 categorías de Suba tienen `branch_id` NULL; las 9 de Norte sí lo tienen.
- Hay 5 pagos, todos cancelados, y 2 de ellos sin sede.
- Miembros: owner (todas las sedes), un coach de Suba y un atleta de Suba.

## 2. Propuesta

| Fase | Qué | Esfuerzo |
|---|---|---|
| **S1 Selector de sede para el dueño** | Selector «Todas / Suba / Norte» en la barra lateral, solo si la escuela tiene más de una sede activa. Llama a `switchSchool(schoolId, branchId)`, que ya lo admite (`useSchoolContext.ts:375-389`). Todo el filtrado de cobros, contabilidad, dashboard y equipos ya está programado | S |
| **S2 Una sola sede por atleta** | Regla única: `COALESCE(enrollment → team.branch_id, ficha/child.branch_id)`. Se aplica en `school_athletes`, `open_month` y `cobros_f1`. Filtro de sede visible en Deportistas y en Cobros | M (migración) |
| **S3 Reporte Sedes y etiquetas** | Contar fichas y adultos; fila «Sin sede» en lugar de «Principal». Backfill de las categorías de Suba a la sede Suba | S |
| **S4 Asistencia, calendario, categorías** | Filtro por sede | M |
| **S5 Permisos por sede en RLS** | Un admin o coach limitado a una sede solo lee esa sede. Mide el radio antes: quién tiene `branch_id` en la membresía hoy | L, aparte |

## 3. Abierto

1. ¿Un atleta puede estar en equipos de dos sedes a la vez (doble categoría Suba + Norte)? Si sí, su sede es la del **equipo**, no la de la ficha, y el cobro lleva la sede de cada inscripción.
2. ¿El dueño quiere ver «Todas» por defecto o la última sede elegida? Propuesta: la última elegida, con «Todas» siempre a un clic.
