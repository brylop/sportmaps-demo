# Contextos de usuario: una persona, varios roles

**Estado:** borrador para aprobar, 2026-10-14. No hay código escrito.
**Origen:** carga de la Sede Norte de Monster's Volley Club. Yuly Castro Pardo juega en Mayores femenino y es acudiente de Juan José Leguizamón; hay además secretarias que juegan y entrenadores con hijos en el club.
**Absorbe:** PT-P2-09 y PT-P1-07 (selector entrenador independiente ↔ coach de club, `docs/specs/ecosistema/backlog/02-plataforma.md:152`, `06-trainer.md:129`), «Menú: persona con dos roles» (`02-plataforma.md:59`, Parcial) y COACH-P1-08/D7 (`05-coach.md:118,178`). Se cruza con UX-8 (`ROADMAP.md:1363`) y UX-13(d) (`:1368`).
**Hueco que cierra:** el roadmap no cubre admin + atleta, admin + acudiente ni coach + acudiente.

## 1. Cómo está hoy

Cada capa lee el rol de un lugar distinto, y aceptar una invitación **pisa** el rol anterior:

| Capa | De dónde saca el rol |
|---|---|
| `AppSidebar.tsx:66-70` | `profiles.role` si es admin, super_admin o personal_trainer; si no, la membresía de la escuela activa |
| `useSchoolContext.ts:223` | Si `profiles.role='parent'`, **fuerza `parent` en todas las escuelas** (aunque sea owner o coach) |
| `DashboardPage.tsx:81-93`, `MobileBottomNav.tsx:86` | Solo `profiles.role` |
| `ProtectedRoute.tsx:60-82` | `profiles.role`; la membresía solo cuenta en rutas de administración |
| BFF `requireAuth` (`authMiddleware.ts:151-199`) | Una fila de `school_members` según `x-school-id` |
| BFF `requireAthleteAuth` (`:600`) | `profiles.role ∈ {athlete, parent, owner, personal_trainer}` |
| BFF `requireTrainerAuth` (`:458`) | Deducido: `schools.owner_id` con `school_type='personal_trainer'` |
| RLS `user_staff_school_ids()` | Deducido de `school_members` (sin parent/athlete) ∪ `school_staff` |
| `accept_invitation_pro` (`20261005135518…sql:182-241`) | Rechaza si el perfil es admin/school/school_admin/organizer. Si no, pisa `profiles.role` y hace `ON CONFLICT (school_id, profile_id) DO UPDATE role = EXCLUDED.role` |

## 2. Las combinaciones

| # | Combinación | Hoy | Qué se rompe |
|---|---|---|---|
| a | Admin/owner + atleta (misma escuela) | Si el perfil es school/school_admin, la invitación de atleta se rechaza. Si el perfil es otro, aceptar **baja owner → athlete** en `school_members` | Pierde la administración, o no puede ser atleta |
| b | Admin + coach | El coach vive en `school_staff`/`team_coaches`; gana el menú de admin | Casi funciona; no ve «Mis equipos» ni «Hoy» del coach |
| c | Entrenador independiente + coach de club | Si el perfil sigue en personal_trainer, ve el menú de trainer; si aceptó la invitación de coach, pierde el de trainer | Se rompe en los dos sentidos (403 de UX-13(d)) |
| d | Acudiente + atleta | Gana el último rol aceptado; la rama atleta busca la ficha solo por correo, `LIMIT 1`, sin nombre (`:462-474`) | Pierde «Mis hijos» o su mensualidad; puede adoptar la ficha del hijo como propia |
| e | Coach + acudiente | Si el perfil es parent, ve el menú de padre aunque la RLS de staff sigue viva; si es coach, `/children` da `/unauthorized` y `requireAthleteAuth` responde 403 | La pantalla no coincide con lo que la base le permite |
| f | Admin + acudiente | Si el perfil es parent y es owner, `:223` lo degrada a padre en su propia escuela. Si el perfil es school, no puede aceptar la invitación | Sin salida |
| g | Wellness / organizer + otro | La tienda ya es aditiva (`vendor_profiles`, `AppSidebar:153`). Wellness y organizer van por `profiles.role`, como (c) | Un coach que además es fisio ve uno solo de los dos |

## 3. Modelo: contexto = (rol, entidad), siempre deducido de los datos

| Grupo | Contexto | Se deduce de |
|---|---|---|
| **Staff** | owner, admin, coach, reporter, accountant de una escuela | `school_members.role` (sin parent/athlete) ∪ `school_staff` activo / `team_coaches`. **Única fuente de permisos de staff** |
| **Familia** | «Acudiente» de una escuela | `children.parent_id = uid` con hijos inscritos |
| **Familia** | «Atleta» de una escuela | `enrollments.user_id = uid` activo |
| **Negocio** | Entrenador independiente, tienda, organizador, profesional de salud | `schools.owner_id` + `school_type='personal_trainer'`, `vendor_profiles`, `event_organizers`, tabla del custodio clínico |
| **Plataforma** | super_admin | `esAdminDePlataforma()`. **Nunca** es un contexto seleccionable |

### Decisiones propuestas

- **D1. Nada nuevo se guarda.** Se mantiene `UNIQUE (school_id, profile_id)` en `school_members`. Quitarlo haría que `requireAuth` (`.limit(1)`) tome una fila arbitraria.
- **D2. `profiles.role` queda como contexto por defecto** al entrar, no como permiso.
- **D3. `accept_invitation_pro` deja de pisar roles:**
  - Una invitación de familia (parent/athlete) **nunca** modifica una fila de staff en `school_members`.
  - Una de staff no borra los datos de familia.
  - Si la persona ya tiene una fila de staff, la de familia no la toca. La familia se deduce de `children` y `enrollments`.
  - Se quita el rechazo a perfiles school/school_admin para invitaciones de familia (caso a, f).
- **D4. La rama atleta de la adopción exige que coincida el nombre**, además del correo (caso d).
- **D5. `activeContext` en `useSchoolContext`** (localStorage por usuario). Lo leen AppSidebar, DashboardPage, MobileBottomNav y ProtectedRoute. Se borra la línea `:223`.
- **D6. Selector «¿Cómo quieres entrar?» después de iniciar sesión** (decidido 2026-10-14):
  - Solo aparece a quien tiene más de un contexto; los demás entran directo.
  - La elección se recuerda al recargar, se borra al cerrar sesión (el siguiente inicio vuelve a preguntar) y se cambia desde «Cambiar de rol» en la barra lateral y en Mi Perfil.
  - Cambiar de rol recarga la app, así cada módulo carga de cero con el rol correcto.

### Hecho en F1 (2026-10-14, solo frontend, sin migración)

- `frontend/src/lib/roleContexts.ts`: deduce los contextos (staff por `school_members`; atleta por `enrollments.user_id`; acudiente por hijos con inscripción activa). Deja fuera los perfiles de plataforma y de negocio (F2). Multirol = 2 roles distintos; tiene 9 pruebas.
- `AuthContext`: resuelve los contextos antes de soltar `loading` y expone `profile` con `role` = rol del contexto activo, más `realRole`, `roleContexts`, `activeRoleContext`, `needsRoleChoice` y `switchRoleContext`. Al cerrar sesión se borra la elección.
- `useSchoolContext`: en la escuela del contexto elegido usa ese rol (familia) o la membresía tal cual (staff), en vez de forzar `parent`.
- `ProtectedRoute` manda a `/elegir-rol` si falta elegir. La pantalla es `ElegirRolPage`, y el acceso para cambiar está en `AppSidebar` y `ProfilePage`.
- **Pendiente de F0 (migración):** que `accept_invitation_pro` no pise roles (D3) y exija el nombre (D4). Sin eso, una cuenta nueva multirol puede quedar con la ficha equivocada al registrarse.
- **D7. El contexto solo elige qué se muestra; nunca suma permisos:**
  - La RLS no lo lee.
  - El BFF recibe `x-active-context` y lo revalida contra `my_contexts()`.
  - Elegir «familia» puede restar permisos, nunca sumarlos.
  - Ninguna RPC de este módulo escribe roles de staff ni de plataforma: si un permiso permite otorgar permisos, no se delega.
- **D8. Gates de familia por relación, no por rol:**
  - `/children` y `requireAthleteAuth` se abren si la persona *tiene* el contexto familia (hijos o inscripción propia), sin importar `profiles.role`.
  - `MyEnrollmentsPage` agrega la opción «Yo».

### Antes de exponer contextos (seguridad)

- Auditar la rama por **email** de `user_staff_school_ids()`, que da staff a quien figure por correo en `school_staff`.
- Verificar si `create_invitation` tiene lista blanca de `p_role`. Si no la tiene, un admin de escuela podría invitar como `school_admin`.

## 4. Fases

| Fase | Qué incluye | Prueba |
|---|---|---|
| **F0 Base** (1 migración; plan aprobado antes de escribirla) | RPC `my_contexts()` (`SECURITY DEFINER`, `search_path` fijo, `GRANT` a authenticated, revocada a anon); `accept_invitation_pro` con D3 y D4; auditoría de los dos puntos de seguridad | Tests de concurrencia e invariantes. Casos: Yuly (d), secretaria que juega (a), coach con hijo (e), trainer + coach (c), adulto con el mismo correo que su hijo |
| **F1 Familia** (lo que pide Monster) | `activeContext` + selector + D8 para d, e, f, a | Cuenta QA atleta + acudiente: paga lo suyo y lo del hijo |
| **F2 Negocio** | Contexto trainer ↔ coach (c) y wellness/organizer (g). Cierra PT-P2-09, PT-P1-07 y UX-13(d) | Cuenta QA trainer + coach |
| **F3 Datos** | Reparar cuentas reales que ya quedaron con el rol pisado (consulta de radio antes) | `seguridad:invariantes` en 0 |

## 5. Abierto

1. ~~¿«Mis pagos» une lo propio y lo de los hijos?~~ **Decidido 2026-10-14: paga quien tiene que pagar.**
   - **Acudiente:** paga lo de sus hijos. Si además es atleta, en esa misma vista ve y paga también lo suyo, rotulado «Tú (como atleta)». Funciona sin cambiar consultas: sus cobros propios ya llegan con él como pagador y `child_id` NULL (217 cobros así en la base).
   - **Atleta:** solo lo suyo (`/athlete-payments`).
   - **Staff** (administración, entrenador, reportes, contabilidad): sin «Mis pagos»; esos contextos no pagan.
2. UX-8 (`school_members.role='admin'` cae en el case del admin de plataforma, 5 usuarios reales): ¿se resuelve dentro de F0? Propuesta: sí, es el mismo resolvedor.
