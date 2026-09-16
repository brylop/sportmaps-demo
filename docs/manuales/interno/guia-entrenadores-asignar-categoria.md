# Asignar Deportistas a tus Categorías

**SportMaps — Guía para Entrenadores**

> **Uso interno — no enviar a escuelas.**
> Esta versión incluye nombres de flags, rutas de la app, endpoints, limitaciones conocidas y guion de soporte.
> La versión enviable a clientes es `docs/manuales/academias/guia-entrenadores-asignar-categoria.md` (mismo how-to, sin estas notas).

---

## ¿Qué puedes hacer desde tu cuenta de entrenador?

En SportMaps, cada categoría (o grupo, o equipo) tiene su propia lista de deportistas. Como entrenador puedes:

- **Inscribir** en tus categorías a deportistas que ya están registrados en la escuela
- **Ver** quiénes están inscritos en cada una de tus categorías
- **Buscar** un deportista por nombre, correo o grado

Lo que **no** hace el entrenador:

| Acción | Quién la hace |
|---|---|
| Registrar un deportista nuevo (que aún no existe en la escuela) | El administrador de la escuela |
| Sacar a un deportista de una categoría | El administrador de la escuela |
| Ampliar el cupo máximo de una categoría | El administrador de la escuela |
| Asignarte como entrenador de una categoría | El administrador de la escuela |

> En tus pantallas solo aparecen **tus** categorías: las que la escuela te asignó.

> **[INTERNO]** El filtro de categorías del entrenador está en `TeamsPage.tsx`: acepta tanto `teams.coach_id` como la tabla puente `team_coaches`, y compara contra **dos** identidades (el `school_staff.id` del coach y su `profiles.id`), porque hay coaches invitados cuyo `coach_id` quedó apuntando al perfil. Si un coach jura que está asignado y no ve la categoría, casi siempre es que el `coach_id` apunta a un tercer id (staff de otra sede, o staff duplicado).

---

## Camino 1 — Inscribir desde Mis Equipos (el recomendado)

Este es el camino principal y funciona para cualquier entrenador, sin configuración especial.

**Menú:** Mis Equipos

> **[INTERNO]** Ruta `/teams` → `frontend/src/pages/TeamsPage.tsx`. La ventana es `frontend/src/components/teams/EnrollTeamStudentModal.tsx`. **No** depende de ningún flag de escuela: es el único camino garantizado para todo entrenador, y por eso es el que enseña el manual.

### Paso 1 — Ubicar tu categoría

La página **Mis Equipos** lista las categorías a tu cargo. Puedes verlas como tarjetas o como tabla, y usar el buscador **"Buscar por nombre, deporte o programa..."** si tienes muchas.

Cada categoría muestra su deporte, su sede y un contador de ocupación. Si el administrador le
puso un cupo máximo, verás los dos números (por ejemplo **12/20**: doce inscritos de veinte
cupos). Si la categoría no tiene cupo configurado, verás solo cuántos hay inscritos.

### Paso 2 — Abrir "Gestionar Deportistas"

En la tarjeta (o en la fila de la tabla) de la categoría, haz clic en el botón verde con el **ícono de persona con un signo +**. Al pasar el cursor sobre él aparece el texto **"Gestionar Deportistas"**.

Se abre la ventana **"Inscribir Deportistas"**, con la leyenda **"Gestiona los integrantes de este equipo."** y tres etiquetas: el nombre de la categoría, el deporte y la ocupación actual (**verde** si hay cupo, **roja** si está llena).

> **[INTERNO]** El botón de **"Gestionar Deportistas"** NO está envuelto en `PermissionGate` (a diferencia de **"Editar Equipo"**, que sí exige `teams:edit`). Por eso el coach lo ve siempre, en vista tarjeta y en vista tabla.

### Paso 3 — Encontrar al deportista

La ventana muestra dos bloques, uno detrás del otro:

| Bloque | Qué contiene |
|---|---|
| **Arriba** | Los deportistas **ya inscritos** en esta categoría. Tienen la etiqueta **"Inscrito"** con un chulito |
| **Abajo** | Los deportistas de la escuela que **todavía no** están en esta categoría |

Si la lista es larga, escribe en el campo **"Buscar deportista por nombre, email o grado..."**. La búsqueda filtra los dos bloques a la vez.

> **[INTERNO]** El listado sale de `studentsAPI.getSchoolView(school_id)` → vista `school_athletes` (SECURITY INVOKER desde la migración `20260511000012`, la RLS de las tablas base manda). Cubre los tres ejes de sujeto: `child_id`, `user_id` y `unregistered_athlete_id`. Si un atleta sin cuenta (`athlete_type = 'unregistered'`) no aparece marcado como inscrito, revisar que el roster se esté leyendo con los tres ejes — ese fue un bug histórico que dejaba el contador en 0 con roster real.

### Paso 4 — Inscribir

Al lado del deportista que quieres sumar, haz clic en el botón verde **"Inscribir"**.

En pocos segundos verás el aviso **"¡Deportista inscrito!"** con el nombre del deportista y el de la categoría. El deportista sube al bloque de arriba con la etiqueta **"Inscrito"** y el contador de ocupación aumenta.

Repite el paso con cada deportista que vayas a sumar. No hay que guardar nada al final: cada clic en **"Inscribir"** queda registrado de inmediato.

> **[INTERNO]** **"Inscribir"** pasa por el BFF: `POST /api/v1/enrollments` (`bff/src/routes/enrollments.ts`), que acepta el rol `coach`. Ahí vive el corte por `coach_can_enroll_paid_teams` (ver abajo). Es el único write del modal que va por el BFF.

### Paso 5 — Cerrar

Haz clic en **"Cerrar"**. Abajo a la izquierda te queda el conteo final (**"X inscritos en este grupo"**).

> **Si la categoría tiene mensualidad,** la ventana muestra un aviso en color ámbar con el valor. Inscribir a un deportista en una categoría con mensualidad genera su cobro cuando la escuela abre el mes. Si no estás seguro de que ese deportista deba pagar esa categoría, confirma con tu administrador antes de inscribirlo.

> **[INTERNO]** El aviso ámbar lee `teams.price_monthly`. El cobro real lo emite `open_month`, que resuelve el monto con `COALESCE(enrollments.monthly_fee, offering_plans.price, teams.price_monthly, children.monthly_fee)` sobre cualquier inscripción activa con monto > 0. O sea: el efecto económico del clic es **diferido**, no instantáneo — por eso se avisa antes, y para todos los roles, no solo para el coach.

---

## Camino 2 — Cambiar la categoría desde Mis Deportistas

**Este camino solo está disponible si tu escuela lo tiene habilitado.** Si al abrir la ficha de un deportista no ves la opción **Editar**, usa el Camino 1.

**Menú:** Mis Deportistas

> **[INTERNO]** Ruta `/students` → `frontend/src/pages/SchoolStudentsManagementPage.tsx` (el `<h1>` de la pantalla dice **"Atletas"**, el ítem de menú dice **"Mis Deportistas"** — `frontend/src/config/navigation.ts`).
>
> El flag es **`school_settings.coach_can_edit_categories`** (expuesto como `coachCanEditCategories` en `useEntitlements.ts`). Con el flag en `true` y sin `coach_can_create_athletes`, el coach entra en el modo `isCategoryOnlyCoach`: el formulario **solo** renderiza la sección **Inscripción** (equipo + fecha), sin datos personales, sin cuota, sin plan y sin descuentos.
>
> El guardado es `PUT /api/v1/students/:id` (`bff/src/routes/students.ts`), que admite `coach` únicamente si la escuela tiene `coach_can_create_athletes` (permiso amplio) o `coach_can_edit_categories` (permiso acotado: el payload se recorta a `{ team_id, team_start_date }`).

### Paso 1 — Buscar al deportista

Usa el campo **"Buscar por nombre o acudiente..."** o los filtros de **Equipo** y **Plan**.

Recuerda: aquí solo aparecen los deportistas **ya inscritos en tus categorías**. Si el que buscas todavía no está en ninguna, no lo vas a encontrar en esta pantalla — ve al Camino 1.

### Paso 2 — Abrir la edición

Haz clic en el botón de los **tres puntos** (⋮) al final de la fila del deportista y elige **"Editar"**. También puedes entrar por **"Ver Perfil"** y usar el botón **"Editar"** del pie de la ficha.

### Paso 3 — Cambiar el equipo

En la sección **Inscripción**, abre el desplegable **"Equipo"** y elige la categoría que corresponde.

| Campo | Qué poner |
|---|---|
| **Equipo** | La categoría a la que debe quedar asignado el deportista. La opción **"Sin equipo"** lo deja sin categoría |
| **Fecha de inscripción** | El día desde el que entra a esa categoría. Déjala como está si no tienes un motivo para cambiarla |

### Paso 4 — Guardar

Haz clic en **"Guardar Cambios"**.

> Según la configuración de tu escuela, es posible que en esta ventana solo veas la sección **Inscripción** y no los datos personales del deportista ni la mensualidad. Es normal y es a propósito: tu permiso es sobre la categoría, no sobre el resto de la ficha.

---

## Limitaciones conocidas (interno)

| Limitación | Estado | Detalle |
|---|---|---|
| **El coach no puede remover de la categoría** | **Bug conocido, no cerrado** | El botón **"Remover"** de `EnrollTeamStudentModal.tsx` escribe `enrollments.status = 'cancelled'` **directo contra Supabase**, sin pasar por el BFF. La RLS de `enrollments` solo deja escribir a owner/admin, así que al coach le falla con toast **"Error al remover"**. El error sí se propaga (antes se tragaba y mostraba éxito falso: la UI decía "removido" y el atleta seguía en el equipo). Fix real = mover el unenroll a un endpoint del BFF, como ya está el enroll |
| **El coach no da de alta deportistas** | Por diseño, con excepción por escuela | `canManageStudents = role !== 'coach'`. Se abre solo con `school_settings.coach_can_create_athletes` (migración `20260828174117`). `coach_can_edit_categories` **no** habilita crear: solo reasignar categoría |
| **Import CSV de atletas** | Nunca para coach | `POST /students/bulk` no acepta el rol, ni con flags |
| **Cupo máximo** | Silencioso | El botón **"Inscribir"** se deshabilita cuando `inscritos >= max_students`, **solo si la categoría tiene cupo configurado**. **No hay mensaje**: solo el botón gris y la etiqueta de ocupación en rojo. Es la causa #2 de tickets de "no me deja" |
| **Mis Deportistas vacío** | Comportamiento correcto, pésimamente comunicado | La query del coach filtra `school_athletes` por `enrolled_team_id IN (sus teams)`. Sin nadie inscrito → lista vacía, sin estado vacío que explique que debe ir a Mis Equipos. **Causa #1 de tickets** |
| **Info financiera oculta** | Intencional, por escuela | `school_settings.coach_hide_financial_info` → `hideFinancials` oculta mensualidad, estado de pago y el `StatFilterBar` de pagos |

### Flags de escuela que tocan este flujo

| Flag (`school_settings`) | Default | Efecto |
|---|---|---|
| `coach_can_enroll_paid_teams` | `true` | En `false`, el BFF responde **403** al inscribir en una categoría con mensualidad > 0 |
| `coach_can_edit_categories` | `false` | Habilita el Camino 2, recortado a equipo + fecha de inscripción |
| `coach_can_create_athletes` | `false` | Permiso amplio: el coach crea y edita atletas completos (migración `20260828174117`) |
| `coach_hide_financial_info` | `false` | Oculta al coach mensualidad y estado de pago en todas las pantallas |

Sin fila en `school_settings` aplica el default de la columna. Ojo con `coach_can_enroll_paid_teams`: el BFF solo bloquea con el valor **explícito** `false`, para no dejar sin inscribir a escuelas que nunca abrieron la configuración de pagos.

---

## Soporte: qué revisar cuando un entrenador reporta que "no puede"

Recorrer en este orden. Los cuatro puntos cubren prácticamente todos los tickets.

### 1. ¿Está asignado como coach de la categoría?

Si no lo está, no ve la categoría en **Mis Equipos** y por lo tanto no tiene por dónde inscribir. Hay dos vías de asignación vigentes (`teams.coach_id` legacy y la tabla puente `team_coaches`) y dos identidades posibles (`school_staff.id` y `profiles.id`).

```sql
-- Identidades del coach
select p.id as profile_id, ss.id as staff_id, p.email, p.role
from public.profiles p
left join public.school_staff ss on ss.email = p.email and ss.school_id = '<school_id>'
where p.email = '<email_del_coach>';

-- Categorías donde figura, por cualquiera de las dos vías
select t.id, t.name, t.status, t.coach_id, tc.coach_id as coach_por_junction
from public.teams t
left join public.team_coaches tc on tc.team_id = t.id
where t.school_id = '<school_id>'
  and (t.coach_id in ('<profile_id>', '<staff_id>')
       or tc.coach_id in ('<profile_id>', '<staff_id>'));
```

Cero filas → el admin debe asignarlo (**Editar Equipo** → entrenadores). Filas con la categoría `archived`/`inactive` → está asignado, pero la pantalla lista activos por defecto.

### 2. ¿La categoría está llena?

```sql
select t.id, t.name,
       t.max_students,
       (select count(*) from public.enrollments e
         where e.team_id = t.id and e.status = 'active') as inscritos_activos
from public.teams t
where t.id = '<team_id>';
```

Con `max_students` puesto, `inscritos_activos >= max_students` → **"Inscribir"** sale gris, sin
mensaje. La solución es que el admin suba el cupo.

> **Historia:** hasta el fix de 2026-09-16, `isFull` resolvía el cupo con `max_students || 20`.
> Una categoría **sin** cupo configurado heredaba un techo inventado de 20 y, al pasarlo,
> deshabilitaba todos los botones sin forma de recuperarse desde la UI del entrenador. Fue el
> reporte original de Besser. Hoy, sin `max_students`, no hay tope.

### 3. ¿La escuela bloquea inscripciones en categorías con cobro?

Aplica solo si la categoría tiene precio. Síntoma: toast **"Error al inscribir"** con el texto *"Esta escuela no permite que un entrenador inscriba en equipos con cobro. Pídelo a la escuela."* (HTTP 403).

```sql
select s.school_id,
       s.coach_can_enroll_paid_teams,
       t.id as team_id, t.name, t.price_monthly
from public.teams t
left join public.school_settings s on s.school_id = t.school_id
where t.id = '<team_id>';
```

Bloquea solo si `coach_can_enroll_paid_teams = false` **y** el monto efectivo es > 0. El monto efectivo es `teams.price_monthly` o, si la categoría no cobra, la cuota propia del atleta (`children.monthly_fee`). En ese caso el flujo correcto es que la administración haga la inscripción.

### 4. ¿Está mirando la pantalla equivocada?

El reporte típico es *"no me aparece ningún deportista"* estando en **Mis Deportistas**. Esa pantalla solo lista atletas **ya inscritos en sus categorías**; el listado completo de la escuela está en la ventana **"Inscribir Deportistas"** de **Mis Equipos**.

```sql
-- Qué debería estar viendo en Mis Deportistas
select t.name as categoria, count(e.id) as inscritos_activos
from public.teams t
left join public.enrollments e on e.team_id = t.id and e.status = 'active'
where t.id in ('<team_ids_del_coach>')
group by t.name;
```

Todo en cero → la pantalla está bien y el coach necesita el Camino 1. Con filas > 0 y pantalla vacía → sí es un bug: revisar que `enrolled_team_id` de `school_athletes` esté sincronizado con `enrollments.team_id` (se desincroniza cuando un atleta se movió de equipo por fuera del flujo normal).

### Y si reporta "removí a alguien y sigue ahí"

Es el bug de la tabla de limitaciones: el unenroll del modal va directo a Supabase y la RLS lo rechaza para coach. Debe pedirlo a la administración. No prometer que "ya quedó" sin verificar:

```sql
select id, status, team_id, updated_at
from public.enrollments
where team_id = '<team_id>'
  and coalesce(child_id::text, user_id::text, unregistered_athlete_id::text) = '<athlete_id>';
```

---

## Preguntas frecuentes

### Mi lista de deportistas aparece vacía, ¿por qué?

Porque **Mis Deportistas** solo muestra a quienes **ya están inscritos en tus categorías**. Si nadie ha sido asignado todavía, la lista sale en cero aunque la escuela tenga cientos de deportistas registrados.

No es un error. Para llenarla:

1. Ve a **Mis Equipos**
2. Abre **"Gestionar Deportistas"** en tu categoría
3. Inscribe a los deportistas desde ahí

Cuando termines, vuelve a **Mis Deportistas** y ya aparecerán.

Si en **Mis Equipos** tampoco ves categorías, pídele a tu administrador que te asigne como entrenador de las que te corresponden.

### No encuentro al deportista en el listado para inscribirlo

Primero usa el buscador de la ventana (**"Buscar deportista por nombre, email o grado..."**): el listado es largo y el deportista puede estar más abajo. Prueba con el nombre incompleto o con el apellido.

Si aun así no aparece, es porque **ese deportista todavía no está registrado en la escuela**. Dar de alta un deportista nuevo no es una acción del entrenador: pídeselo a tu administrador con el nombre completo y los datos del acudiente. Apenas quede registrado, aparecerá en tu listado y podrás inscribirlo.

> **[INTERNO]** Si el deportista **sí** existe y aun así no aparece: la ventana muestra **"No hay deportistas registrados o vinculados a esta escuela aún."** cuando `school_athletes` devuelve vacío para ese `school_id`. Verificar el `school_id` del atleta (casos multi-escuela: el complemento por `enrollments` solo trae `child_id`, no atletas adultos ni sin cuenta de otra escuela).

### El botón "Inscribir" se ve apagado o gris y no puedo hacer clic

La categoría **llegó a su cupo máximo**. Lo notas porque la etiqueta de ocupación de la ventana está en **rojo** y los dos números son iguales (por ejemplo **20/20**).

Pídele a tu administrador que amplíe el cupo máximo de esa categoría. Cuando lo haga, vuelve a entrar y el botón quedará habilitado.

> **[INTERNO]** `isFull = team?.max_students ? enrolledStudentIds.length >= team.max_students : false`. Sin `max_students` no hay tope (antes del fix de 2026-09-16 el `|| 20` inventaba uno).

### Me equivoqué de categoría, ¿cómo saco al deportista?

Pídeselo a tu administrador. Sacar a un deportista de una categoría es una acción reservada a la administración de la escuela, y esa parte no está disponible para el perfil de entrenador.

Al escribirle, dile **el nombre del deportista**, **la categoría equivocada** y **la categoría correcta**, para que lo resuelva de una sola vez.

> **[INTERNO]** El botón **"Remover"** existe y es visible para el coach, pero falla con **"Error al remover"**: RLS de `enrollments` (ver limitaciones). Si la escuela tiene `coach_can_edit_categories`, el coach sí puede **mover** al atleta a otra categoría desde el Camino 2 — eso reasigna `team_id`, que en la práctica resuelve el "me equivoqué" sin pasar por el unenroll roto.

### No veo la mensualidad ni el estado de pago de mis deportistas

Es la configuración de tu escuela y es completamente normal. Algunas escuelas prefieren que la información de dinero (mensualidad, pagos al día, mora) la maneje solo la administración, y en ese caso esas columnas y filtros no se muestran al entrenador.

Tu trabajo con las categorías, la asistencia y el entrenamiento funciona igual.

> **[INTERNO]** `school_settings.coach_hide_financial_info`. Si el coach dice que "antes sí veía", confirmar cuándo se activó el flag antes de buscar una regresión.

### No veo mis categorías en Mis Equipos

La pantalla te muestra únicamente las categorías en las que estás asignado como entrenador. Si aparece el mensaje **"Aún no estás asignado a ningún equipo"**, pídele a tu administrador que te asigne a las categorías que vas a dirigir.

> **[INTERNO]** El texto completo del estado vacío para coach es: *"Aún no estás asignado a ningún equipo. Pídele al administrador que te asigne a un equipo desde «Editar Equipo»."* Si el coach ve ese mensaje pero el admin insiste en que ya lo asignó → punto 1 de la checklist de soporte (staff_id vs profile_id).

---

## Resumen del flujo completo

```
¿EL DEPORTISTA YA ESTÁ REGISTRADO EN LA ESCUELA?
  │
  ├── NO ──► Pídele el alta a tu administrador
  │            └── Cuando lo registre, continúa abajo
  │
  └── SÍ ──► MIS EQUIPOS                                    [/teams]
               └── Tu categoría → "Gestionar Deportistas"
                     └── Ventana "Inscribir Deportistas"
                           ├── Buscar al deportista
                           └── Botón "Inscribir"            [POST /api/v1/enrollments]
                                 ├── Aviso "¡Deportista inscrito!"
                                 ├── Sube al bloque de "Inscrito"
                                 └── Sube el contador de ocupación

DESPUÉS DE INSCRIBIR:
  └── MIS DEPORTISTAS ya lista a ese deportista             [/students]
        └── (flag coach_can_edit_categories) ⋮ → "Editar"
              └── Inscripción → "Equipo" → "Guardar Cambios" [PUT /api/v1/students/:id]

CASOS QUE RESUELVE EL ADMINISTRADOR:
  ├── Registrar un deportista nuevo        (salvo coach_can_create_athletes)
  ├── Sacar a un deportista de una categoría  (RLS enrollments — bug del botón "Remover")
  ├── Ampliar el cupo de una categoría llena  (teams.max_students; sin valor = sin tope)
  └── Asignarte como entrenador de una categoría (teams.coach_id / team_coaches)
```

---

> **Uso interno — no enviar a escuelas.**

*SportMaps &copy; 2026*
