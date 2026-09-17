# Plan — Monster´s Volley Club: equipo de prueba, atleta inactivo y planes por sede

**Fecha:** 2026-09-16 · **Escuela:** Monster´s Volley Club (`eb3ebc77-4ea4-4992-96c8-3c8ec574578c`)
**Estado:** 🟡 plan. Sin código de migraciones todavía (convención del repo: plan aprobado antes de escribir).

Lo que pidió Monster, textual:

1. Eliminar el equipo **MAYORES FEMENINO** que se creó de prueba en la visita presencial.
2. Quitar **el deportista inactivo**.
3. Poner **los planes**: en **Sede Suba** todos pagan **$145.000**, y los de **doble categoría $165.000**.
   En **Sede Norte** son **$165.000** mensuales. Y los de doble categoría *"podrían estar en las dos listas"*.

---

## 0. Verificado contra la base viva — 2026-09-16

Este plan se escribió primero contra el repo y **después se verificó contra la base**. La verificación cambió
tres cosas de fondo, así que lo que sigue ya no es hipótesis:

| Hallazgo | Detalle |
|---|---|
| **Hay DOS equipos "Mayores Femenino"** | El de prueba y el real del roster. No son el mismo (§1.2) |
| **El deportista inactivo es la misma persona del equipo de prueba** | Alejandra Losada Mejía, sin ningún historial (§2.1) |
| **Y tiene identidad duplicada: su cuenta adulta sigue activa y facturando** | Los 4 pagos de Monster son suyos; 3 están vencidos (§2.2) |
| **Sede Norte ya existe** | `e2918c8d-b510-4f7f-9b05-e73a5e8edb68`, creada el 2026-07-06, con **0 equipos** y 0 ofertas |
| **`auto_generate_payments` está en `true`** | El cron puede facturar mañana (§3.5) |

Cifras de Monster´s Volley Club (`eb3ebc77-4ea4-4992-96c8-3c8ec574578c`) al 2026-09-16:

| | |
|---|---|
| Inscripciones activas | **126** |
| Equipos | **14** (13 en Sede Suba + 1 de prueba sin sede) |
| Categorías en el catálogo | 13 |
| Planes activos | **1** ("Tarifa plena", 145.000, **0 inscritos**) |
| Sedes | 2 — Suba (13 equipos) y **Norte (0 equipos)** |
| Pagos históricos | **4 — todos de la misma atleta de prueba** |
| Cartera viva | **3 cobros vencidos · 456.750** |
| Inscripciones que generarían cobro si el cron corre mañana | **1 de 126** |
| Atletas con cuota manual (`fee_is_manual`) | **0** |

Las consultas que produjeron esto quedan en §5, para poder repetirlas.

---

## 1. Punto 1 — el equipo "Mayores Femenino" de prueba

### 1.1 Hay DOS equipos con ese nombre, y solo uno es el de la demo

| | Equipo de prueba | Equipo real |
|---|---|---|
| `id` | `1906b9e5-bcab-45f9-a101-f890af865a6b` | `a9edafee-616f-42f6-94d9-392ef78016a4` |
| Nombre | "Mayores Femenino" (minúsculas) | "MAYORES FEMENINO" (mayúsculas, como todo el roster) |
| Creado | **2026-07-06** — el día de la visita presencial | 2026-08-26 — la carga del roster de Suba |
| Sede | **ninguna** (`branch_id` NULL) | Sede Suba |
| Categoría | **ninguna** (`category_id` NULL) | `MAYFEM` del catálogo |
| `price_monthly` | **145.000** (alguien lo escribió en la demo) | 0 |
| Inscripciones | 1, **cancelada** | **7 activas** |
| Asistencias | 0 | 0 |

**El de la demo es el de minúsculas**, sin sede y sin categoría. El otro es el real y no se toca.

Y ojo con una tercera cosa que se llama igual: la **categoría** `MAYFEM` del catálogo
([`20260826105957`](../supabase/migrations/20260826105957_mod3_school_categories_f1_f2.sql#L121)). Esa no se
borra nunca (D10: soft delete) y no la afecta borrar ningún equipo.

### 1.2 Se puede eliminar, pero la UI lo va a bloquear tal como está

El menú **⋯** de `Equipos` ofrece *Archivar* y *Eliminar permanente*
([`TeamsPage.tsx:282-360`](../frontend/src/pages/TeamsPage.tsx#L282-L360)), y el borrado se bloquea solo si el
equipo tiene inscripciones o `children` apuntándole. El de prueba tiene **las dos cosas**:

- 1 inscripción `cancelled` (de Alejandra Losada Mejía, §2), y
- 1 fila de `children` con `team_id` apuntando al equipo.

El conteo de la UI suma ambas sin mirar el estado, así que da 2 y **bloquea**. Tres salidas, en orden de menos
a más invasivo:

| | Qué | Resultado |
|---|---|---|
| **A** | **Archivar** el equipo | Un clic, reversible, desaparece de todos los selectores. **El historial de la demo queda**, que es lo honesto |
| **B** | Limpiar primero las dos referencias (la inscripción cancelada y `children.team_id`) y después *Eliminar permanente* | El equipo desaparece. Son dos escrituras a mano sobre datos de prueba |
| **C** | Borrar en bloque el artefacto completo de la demo (equipo + ficha + cobros) | §2.3. Es lo que de verdad pidió Monster, y hay que hacerlo en orden |

**Recomendación: C**, porque el equipo de prueba no es el único residuo de esa demo — la misma ficha está
generando cartera (§2.2). Archivar el equipo y dejar lo demás resuelve lo que se ve y no lo que cobra.

## 2. Punto 2 — "quitar el deportista inactivo"

### 2.1 Es uno solo, y es la misma persona del equipo de prueba

En toda la escuela hay **un** atleta inactivo: **Alejandra Losada Mejía** (ficha `children`), con
**0 pagos conciliados, 0 asistencias y 0 documentos**. Su inscripción al equipo de prueba se canceló el
2026-07-30. Es exactamente el perfil de una ficha de demo: sin ningún rastro que conservar.

O sea que los dos primeros pedidos de Monster **son el mismo artefacto**: el equipo que crearon en la visita y
la atleta que metieron para probarlo.

### 2.2 🔴 Pero hay una segunda Alejandra, activa, y es la que factura

La misma persona existe **dos veces** en la escuela:

| | Ficha `children` | Cuenta de atleta (adulto) |
|---|---|---|
| Nombre | Alejandra Losada Mejía (con tilde) | Alejandra Losada Mejia (sin tilde) |
| `id` | ficha sin cuenta | `d15ddcca-16eb-43b6-99ee-7ae56cb70708` · alejandralosada1599@gmail.com |
| Estado | **inactiva** | **activa** (`school_members.status = active`) |
| Inscripción | `8263a900-…` al equipo de **prueba** — `cancelled` | `cbd17124-…` al equipo **real** MAYORES FEMENINO — **`active`** |
| Cuota | 145.000 (congelada en la fila cancelada) | **145.000 escritos a mano en `monthly_fee`** |
| Asistencias | 0 | 0 |

**Los 4 pagos que tiene Monster en toda su historia son de ella**, y salen de la inscripción adulta:

| Cobro | Estado | Monto | Creado |
|---|---|---|---|
| "Equipo Mayores Femenino — Mensualidad completa (Desc. 5%)" | `cancelled` | 137.750 | 2026-07-06 |
| Mensualidad 07/2026 | **`overdue`** | 152.250 | 2026-07-14 |
| Mensualidad 08/2026 | **`overdue`** | 152.250 | 2026-08-25 |
| Mensualidad 09/2026 | **`overdue`** | 152.250 | 2026-09-01 |

Son **456.750 de mora fantasma**, de la única persona que la escuela cree que ya dio de baja. Y se siguen
generando: el de septiembre nació el 1.º de ese mes, solo. La causa es la de siempre
([identidades duplicadas](specs/sport-categories-and-multi-category.md)): inactivar la **ficha** no toca la
**cuenta**, porque para el sistema son dos atletas distintos. `set_school_athlete_status` hizo bien su trabajo
sobre la ficha; nadie le dijo nada a la otra identidad.

De las 126 inscripciones activas de Monster, **esta es la única que genera cobro**. El resto está en 0 porque
nunca se les asignó plan ni precio de equipo.

### 2.3 El orden para dejarlo limpio

Nada de esto lo ejecuta este plan: son datos de producción y **las eliminaciones las hace el usuario**
([[feedback_user_handles_deletions]]). El orden importa, porque borrar de atrás para adelante choca con las FK:

1. **Apagar `auto_generate_payments`** (§3.5). Si no, mañana nace la mensualidad de 10/2026 y esto se repite.
2. **Anular los 3 cobros vencidos** de la inscripción adulta. Con eso la cartera de Monster queda en **0**, que
   es literalmente lo que pidieron.
3. **Decidir qué pasa con la inscripción adulta activa** (`cbd17124-…`). Está en el equipo **real**, así que la
   pregunta no es "borrar o no" sino **si Alejandra es una atleta de verdad de MAYORES FEMENINO**:
   - si lo es → se le quita el `monthly_fee = 145.000` escrito a mano en la demo y queda como sus 6 compañeras, en 0;
   - si no lo es → se cancela la inscripción y se le da de baja la cuenta, igual que a la ficha.
   **Esto lo tiene que responder Monster**, no se deduce de la base: la cuenta tiene correo y teléfono reales.
4. **Borrar la ficha `children` inactiva y el equipo de prueba**, en ese orden (primero la inscripción
   cancelada y `children.team_id`, después el equipo), o simplemente archivar el equipo (§1.2, opción A).

## 3. Punto 3 — los planes

### 3.1 Lo que pidieron, en tabla

| Sede | 1 categoría | 2 categorías |
|---|---|---|
| **Suba** | $145.000 | $165.000 |
| **Norte** | $165.000 | $165.000 |

Confirmado por Monster (2026-09-16): en Norte la doble categoría **también** son $165.000 — o sea, en Norte el
precio no depende de la cantidad. Y **la doble categoría solo existe dentro de la misma sede**: no hay atleta
con una categoría en Suba y otra en Norte.

### 3.2 Hoy, sin escribir una línea de código

Se puede dejar operando ya, en `Ofertas y planes`
([`OfferingsPage`](../frontend/src/pages/OfferingsPage.tsx) → [`OfferingsManagement`](../frontend/src/components/universal/OfferingsManagement.tsx)),
creando **tres planes** y asignándolos por atleta desde el editor de `Deportistas`:

| Plan | Precio | Nota |
|---|---|---|
| Mensualidad Sede Suba | 145.000 | Ya existe algo muy parecido: la oferta "Entrenamientos Martes, Jueves y Domingos" con el plan **"Tarifa plena" a 145.000** — activo y con **0 inscritos**. Conviene renombrarlo y reusarlo antes que crear un duplicado |
| Mensualidad Sede Suba — doble categoría | 165.000 | Se configura **después**, cuando Monster diga quiénes son (§4) |
| Mensualidad Sede Norte | 165.000 | La sede **ya existe** en la plataforma (0 equipos): el plan se puede crear desde hoy, aunque el roster llegue después |

> La oferta actual tiene `branch_id` NULL — no está atada a ninguna sede. Al crear las de Suba y Norte conviene
> atarlas a su sede: es lo que después deja colgar los tramos por oferta sin columna nueva (§3.3).

El motor de cobros ya resuelve el monto con la cascada
`COALESCE(NULLIF(enrollments.monthly_fee,0), offering_plans.price, teams.price_monthly, children.monthly_fee, 0)`,
y `fee_is_manual` ([`20260827175215`](../supabase/migrations/20260827175215_fee_is_manual_becas_cuota_exenta.sql))
protege becas y cuotas pactadas de cualquier recálculo. Es decir: **el cobro por $165.000 sale bien desde el
primer mes.**

Lo que esta vía **no** da, y hay que decirlo antes de venderla como solución:

1. **Es mantenimiento manual.** Si un atleta deja una categoría, alguien tiene que acordarse de bajarle el plan.
2. **No queda registrado cuáles** son las dos categorías. El plan se llama "doble categoría" y ahí muere el dato.
3. **El atleta sigue apareciendo en una sola lista** — que es justo la otra mitad de lo que pidieron (§3.4).
4. **Monster tiene 0 cuentas de pago configuradas.** Los cobros se generan, pero hoy nadie puede pagarlos en
   línea, y de 125 fichas cargadas **no se envió ninguna invitación** (§1.2 del doc de inscripciones). Poner
   los planes sin resolver eso deja la cartera creciendo contra un buzón vacío. **Esto es más urgente que los tramos.**
5. **Y asignar el plan a los 126 dispara la facturación**, que es justo lo que Monster no quiere todavía. Hoy
   **1 sola** de las 126 inscripciones genera cobro (§2.2); con el plan asignado a todas, serían **126**. Por eso
   §3.5 va antes que este paso, no después.

### 3.3 La forma correcta: F4 del spec, adaptada a dos sedes

El modelo ya está diseñado en
[`docs/specs/sport-categories-and-multi-category.md §5`](specs/sport-categories-and-multi-category.md):
`school_category_pricing` con tramos por cantidad de categorías, `resolve_athlete_fee` escribiendo en
`enrollments.monthly_fee`, y **un solo cobro** — el tramo **reemplaza** al plan, no se suma (D18). Los $145.000
/ $165.000 del spec salieron literalmente de esta conversación con Monster (D17: son la única escuela que va a
usar esto).

**Lo que el spec no previó: dos sedes con precio base distinto.** D8 cerró los tramos como *globales por
escuela* pensando en un único precio base. Con Suba a $145.000 y Norte a $165.000, el mismo `n=1` vale distinto
según dónde entrena. El modelo **ya lo soporta sin columna nueva**: `school_category_pricing.offering_id`
(NULL = todas) existe desde el diseño, y `offerings` tiene `branch_id`. Basta con **una oferta por sede**:

| Oferta | `categories_count` | `price` |
|---|---|---|
| Sede Suba | 1 | 145.000 |
| Sede Suba | 2 | 165.000 |
| Sede Norte | 1 | 165.000 |
| Sede Norte | 2 | 165.000 |

**La pregunta cross-sede quedó cerrada, y cierra barato:** Monster confirmó que un atleta **solo puede tener
sus dos categorías en la misma sede**. Eso elimina el único caso que el modelo no resolvía solo — ya no hay que
decidir "qué tramo manda" cuando las categorías cruzan sedes, porque no cruzan.

A cambio aparece una **regla dura nueva**, que hay que construir (no se cumple sola):

> **R8 — las categorías activas de una inscripción tienen que ser todas de la misma sede.**
> Se valida en `set_enrollment_categories` y en el `POST /enrollments` que hoy agrega la segunda categoría
> ([`enrollments.ts:396-470`](../bff/src/routes/enrollments.ts#L396-L470)), que **hoy no mira la sede**. Sin
> R8, el día que Norte esté cargada, un admin puede armar un atleta Suba+Norte y el tramo vuelve a ser
> ambiguo. La sede sale de `teams.branch_id` (o de `school_categories.branch_id` si se adopta por categoría).

Nota para cuando se cargue Norte: las 13 categorías sembradas hoy son **de Suba** y tienen `branch_id = NULL`.
Al cargar Norte hay que decidir si las categorías se duplican por sede (`school_categories.branch_id`) o si la
sede vive solo en el equipo. **Para R8 y para los tramos basta con la sede del equipo**; duplicar el catálogo
por sede es más ordenado pero no es requisito.

### 3.4 "Estar en las dos listas" — esto es lo que de verdad falta

Media obra está hecha. `enrollment_categories` existe
([`20260826110135`](../supabase/migrations/20260826110135_mod3_enrollment_categories_f3.sql)) y el BFF ya deja
de duplicar la inscripción: si llega un `team_id` de otra categoría, **agrega una fila de categoría** en vez de
una segunda inscripción ([`enrollments.ts:396-470`](../bff/src/routes/enrollments.ts#L396-L470)).

Pero el dato **no se lee en ninguna parte**:

| Dónde | Qué pasa hoy | Qué falta |
|---|---|---|
| `Deportistas` (vista `school_athletes`) | Muestra **un** equipo y **un** plan (`LEFT JOIN LATERAL … LIMIT 1`). Las columnas `categories_count` / `categories` del spec §7.7 **no se aplicaron** | Agregar las dos columnas al final de la vista, con `EXPLAIN (ANALYZE, BUFFERS)` como `authenticated` antes/después — es el query #1 de la app |
| Roster de un equipo | Filtra `enrollments.team_id` ([`EnrollTeamStudentModal.tsx:113`](../frontend/src/components/teams/EnrollTeamStudentModal.tsx#L113)) | Leer también `enrollment_categories.team_id` |
| Asistencia | Igual: `eq('team_id', …)` ([`attendance.ts:44`](../bff/src/routes/attendance.ts#L44), [`:1095`](../bff/src/routes/attendance.ts#L1095)) | Igual — si no, el coach de la segunda categoría no puede pasar lista |
| Editar categorías de un atleta | **No hay UI.** `set_enrollment_categories` no existe; la única vía es re-inscribir al atleta a un equipo de otra categoría | RPC + multi-select en el editor de `Deportistas` |

Traducción para Monster: **"estar en las dos listas" no es configuración, es desarrollo.** Hoy el que tiene dos
categorías entrena en las dos, pero el sistema lo muestra en una.

---

### 3.5 🔴 Cargar los planes sin que se emita un solo cobro

Monster fue explícito: **no pueden emitir pagos todavía**, los planes nuevos son para *todos* los atletas, los
de doble categoría se configuran después, y **todo lo que hay hoy queda en $0**.

Eso choca de frente con algo que está vivo en producción:

> El cron **`generate-monthly-charges-daily`** corre **todos los días 6:30** y llama a `open_month()` por cada
> escuela con `school_settings.auto_generate_payments = true`
> ([`20260724000003`](../supabase/migrations/20260724000003_generate_monthly_charges_delegates.sql),
> re-agendado en [`20260824140944`](../supabase/migrations/20260824140944_restaurar_cron_generacion_mensual.sql)).
> El default de la columna es **`TRUE`** ([`20260226000057`](../supabase/migrations/20260226000057_sync_school_settings.sql)).

Traducción: **asignarles el plan de $145.000 a los 126 atletas con ese toggle encendido genera 126 cobros a la
mañana siguiente, solos.** Nadie tiene que oprimir nada. Y como Monster no tiene cuenta de pago, esa cartera
nace impagable.

#### Cómo se evita

`open_month` ya filtra `fee.amount > 0` ([`20260827175215:133`](../supabase/migrations/20260827175215_fee_is_manual_becas_cuota_exenta.sql#L133)):
**cuota 0 = no se genera cobro**, no se genera un cobro de $0. Hay entonces dos palancas, y se prefiere la primera:

| | Palanca | Efecto | Costo de revertir |
|---|---|---|---|
| **A (recomendada)** | Apagar **`auto_generate_payments`** — switch *Generar cobros automáticos* en `Pagos → Config` ([`PaymentsAutomationPage.tsx:2293`](../frontend/src/pages/PaymentsAutomationPage.tsx#L2293)) | El cron salta la escuela entera. Los planes quedan configurados y visibles, sin facturar | Un clic |
| **B** | `monthly_fee = 0` + `fee_is_manual = true` por atleta | El atleta queda fuera de la cascada: su cuota es 0 aunque tenga plan de $145.000 | **126 filas que hay que desmarcar una por una** el día que arranquen a cobrar |

**A hace lo que Monster pidió con una sola palanca reversible.** B existe para becas individuales, no para
parar una escuela: dejar 126 atletas con `fee_is_manual` es sembrar el bug del año que viene ("configuramos los
planes y no cobra a nadie"). Si además quieren que la ficha muestre **$0 explícito**, se usa B *encima* de A,
sabiendo el costo.

`billing_enabled = false` (super admin) es la versión pesada de A: apaga los tres toggles y además **esconde
Pagos, Finanzas y Recordatorios** de la escuela ([`20260815141039`](../supabase/migrations/20260815141039_billing_enabled_por_escuela.sql)).
Sirve si Monster no debe ni ver el módulo; no sirve si van a configurar planes ahí mismo.

#### Orden obligatorio

1. **Apagar `auto_generate_payments`** de Monster. **Antes** de tocar planes, no después.
2. Verificar que quedó apagado (§5.7) y que no hay cobros pendientes vivos (§5.8).
3. Crear los planes y asignarlos.
4. Volver a mirar §5.8 al día siguiente: si aparecieron cobros, el toggle no quedó apagado.

#### Lo que ya está generado

Verificado: Monster tiene **4 pagos en toda su historia y los 4 son de la atleta de prueba** — 1 anulado y
**3 vencidos por 456.750** (§2.2). No hay más cartera. De las 126 inscripciones activas, **solo 1 genera
cobro**, y es esa misma.

Dicho de otro modo: **apagar el toggle y anular esos 3 cobros deja la escuela exactamente en 0**, que es lo
que Monster pidió. No hay un trabajo masivo escondido.

Para anular esos 3 no hay acción en la UI (lo único que anula pendientes en lote es inactivar al atleta con
`set_school_athlete_status`, y su ficha ya está inactiva — los cobros cuelgan de la **otra** identidad). Son
3 filas: se resuelve puntualmente, con criterio de a quién pertenecen, **nunca con un UPDATE masivo a ciegas**.
Y si se hace desde el SQL editor, queda sin rastro en `schema_migrations`
([[project_supabase_sql_editor_gotchas]]).

---

## 4. Alcance por fases

| Fase | Qué | Código | Rama |
|---|---|---|---|
| **0 — hoy** | **1)** apagar `auto_generate_payments` (§3.5) · **2)** anular los 3 cobros vencidos y resolver la inscripción adulta duplicada (§2.3) · **3)** limpiar el equipo de prueba y la ficha inactiva · **4)** crear los planes de §3.2 y asignarlos | Ninguno | — |
| **0.5 — cuando Monster quiera cobrar** | Cuenta de pago + invitar a las 125 fichas + volver a prender la generación | Ninguno | — |
| **1 — las dos listas** | Cierre de F3: columnas en `school_athletes`, rosters y asistencia leyendo `enrollment_categories`, `set_enrollment_categories` + UI | DB + BFF + Front | una rama |
| **2 — los tramos** | F4: `school_category_pricing` con alcance por oferta/sede, `resolve_athlete_fee`, `recalc_*`, trigger, UI de tramos con preview | DB + BFF + Front | una rama |

Fase 1 antes que Fase 2 **a propósito**: cobrar $165.000 por dos categorías que el sistema no sabe listar es
cobrar por un dato que nadie puede auditar. Y con la facturación apagada (§3.5) no hay prisa por los tramos:
mientras Monster no emita, el plan de doble categoría asignado a mano alcanza — que es justo lo que pidieron
("los de doble ya los configuramos después").

**Carga de Sede Norte:** es requisito de la Fase 2 (sin sus equipos no hay a qué colgarle el tramo de Norte) y
no depende de nada de acá. Puede ir en paralelo, con el mismo camino que se usó para Suba
([`scripts/monster-volley-suba-import`](../scripts/monster-volley-suba-import/README.md)).

---

## 5. Las consultas de verificación (ya corridas el 2026-09-16)

Quedan acá para repetirlas después de cada paso — y porque la de §5.7 hay que volver a correrla al día
siguiente de apagar el toggle, para confirmar que no nació ningún cobro nuevo.

```sql
-- 5.1 ¿El equipo de prueba está vacío? (reemplazar el id tras identificarlo)
select t.id, t.name, t.status, t.category_id,
       (select count(*) from public.enrollments e where e.team_id = t.id)          as inscripciones,
       (select count(*) from public.enrollments e where e.team_id = t.id
                                                    and e.status = 'active')        as activas,
       (select count(*) from public.children c   where c.team_id = t.id)            as children,
       (select count(*) from public.attendance_sessions a where a.team_id = t.id)   as sesiones
  from public.teams t
 where t.school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
 order by t.name;

-- 5.2 Las 13 categorías del catálogo (MAYFEM debe seguir viva, no se borra)
select code, name, rama, is_active
  from public.school_categories
 where school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
 order by sort_order, code;

-- 5.3 ¿Existe la sede Norte en la plataforma?
select id, name, is_active from public.school_branches
 where school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c';

-- 5.4 Ofertas y planes que ya tiene (el doc de septiembre decía: 1 plan para 14 equipos)
select o.id as offering_id, o.name as oferta, o.branch_id,
       p.id as plan_id, p.name as plan, p.price, p.is_active
  from public.offerings o
  left join public.offering_plans p on p.offering_id = o.id
 where o.school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
 order by o.name, p.price;

-- 5.5 Atletas inactivos de la escuela (para identificar "el deportista inactivo")
-- Triage completo: quiénes son los inactivos y qué historial tiene cada uno.
-- La columna `veredicto` dice sola qué hacer con cada fila (ver §2.3).
-- Ojo: la vista expone `is_active`, no `status` (la UI deriva el rótulo en
-- SchoolStudentsManagementPage.tsx:982).
with inactivos as (
    select sa.id, sa.athlete_type, sa.full_name, sa.team_name, sa.enrollment_id
      from public.school_athletes sa
     where sa.school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
       and sa.is_active is not true
)
select i.full_name, i.athlete_type, i.team_name,
       coalesce(pg.n, 0)  as pagos_conciliados,   -- paid / partial → NO se borra
       coalesce(pp.n, 0)  as cobros_vivos,        -- pending / overdue → se anulan al inactivar
       coalesce(a.n, 0)   as asistencias,
       coalesce(d.n, 0)   as documentos,
       case when coalesce(pg.n,0) > 0 or coalesce(a.n,0) > 0
                 then 'CONSERVAR — tiene historial, solo inactivo'
            when coalesce(d.n,0) > 0
                 then 'REVISAR — sin historial pero con documentos cargados'
            else 'CANDIDATO A BORRAR — ficha sin rastro'
       end as veredicto
  from inactivos i
  left join lateral (select count(*) n from public.payments p
                      where p.status in ('paid','partial')
                        and (p.child_id = i.id or p.user_id = i.id or p.unregistered_athlete_id = i.id)) pg on true
  left join lateral (select count(*) n from public.payments p
                      where p.status in ('pending','overdue','awaiting_approval')
                        and (p.child_id = i.id or p.user_id = i.id or p.unregistered_athlete_id = i.id)) pp on true
  left join lateral (select count(*) n from public.attendance_records r
                      where r.child_id = i.id or r.user_id = i.id or r.unregistered_athlete_id = i.id) a on true
  left join lateral (select count(*) n from public.athlete_documents ad
                      where ad.child_id = i.id or ad.user_id = i.id or ad.unregistered_athlete_id = i.id) d on true
 order by i.full_name;

-- 5.6 ¿Alguien ya quedó con dos categorías por la vía del BFF?
select ec.enrollment_id, count(*) as categorias
  from public.enrollment_categories ec
 where ec.school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
   and ec.status = 'active'
 group by 1 having count(*) > 1;

-- 5.7 EL TOGGLE QUE DECIDE SI SE FACTURA (§3.5). Correr ANTES de crear planes.
select s.name, ss.billing_enabled, ss.auto_generate_payments,
       ss.late_fee_enabled, ss.reminder_enabled
  from public.school_settings ss
  join public.schools s on s.id = ss.school_id
 where ss.school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c';

-- 5.8 ¿Qué cartera existe hoy? (lo que hay que "dejar en 0")
select status, count(*) as cobros, sum(amount) as monto,
       min(period_year || '-' || period_month) as desde,
       max(period_year || '-' || period_month) as hasta
  from public.payments
 where school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
 group by status
 order by status;

-- 5.9 ¿Cuántos atletas generarían cobro si el cron corriera mañana?
--     (misma cadena que open_month; > 0 = se factura)
select count(*) filter (where fee > 0) as generarian_cobro,
       count(*)                         as inscripciones_activas
  from (
    select case when e.fee_is_manual then coalesce(e.monthly_fee, 0)
                else coalesce(nullif(e.monthly_fee, 0), op.price, t.price_monthly, 0)
           end as fee
      from public.enrollments e
      left join public.offering_plans op on op.id = e.offering_plan_id
      left join public.teams t          on t.id  = e.team_id
     where e.school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
       and e.status = 'active'
  ) x;
```

---

## 6. Decisiones

### 6.1 Cerradas (Monster, 2026-09-16)

| # | Pregunta | Respuesta | Consecuencia |
|---|---|---|---|
| **1** | ¿Doble categoría en Norte? | **$165.000**, igual que una sola | En Norte el precio no depende de la cantidad: un solo tramo |
| **2** | ¿Suba y Norte son dos sedes o dos escuelas? | **Dos sedes de la misma escuela.** Norte **falta por cargar** | Verificado: la sede Norte **ya existe** desde el 2026-07-06 con **0 equipos**. Lo que falta no es crearla, es cargarle equipos y roster |
| **3** | ¿Doble categoría cruzando sedes? | **No.** Solo dentro de la misma sede | Cierra la ambigüedad del tramo cross-sede, y obliga a construir **R8** (§3.3) |
| **4** | ¿Se emiten cobros ya? | **No.** Los planes son para todos los atletas; los de doble se configuran después; **todo lo actual queda en 0** | §3.5: apagar `auto_generate_payments` **antes** de asignar planes, o el cron factura solo |

### 6.2 Todavía abiertas

| # | Pregunta | Por qué importa |
|---|---|---|
| **5** | **¿Alejandra Losada Mejía es una atleta real de MAYORES FEMENINO, o era solo la prueba?** | §2.3. Es la única pregunta que bloquea la limpieza: su cuenta adulta está activa en el equipo real y es la que generó los 3 cobros vencidos. La base no lo puede responder — tiene correo y teléfono reales |
| **9** | ¿Se anulan los 3 cobros vencidos (456.750) o se dejan como historia? | Monster dijo "todo en 0", así que la lectura por defecto es anularlos; conviene confirmarlo porque es cartera, no basura |
| **6** | ¿Desde qué mes empiezan a cobrar de verdad? | Define cuándo se vuelve a prender la generación (Fase 0.5) y desde qué `open_month` aplica el precio |
| **7** | ¿Hay matrícula/inscripción anual aparte de la mensualidad? | Cambia si va como `registration_fee` del plan o como cobro suelto |
| **8** | Al cargar Norte, ¿el catálogo de categorías se duplica por sede? | §3.3. Para R8 y los tramos basta la sede del equipo; duplicar es más ordenado, no obligatorio |

---

## 7. Qué NO hacer (trampas ya conocidas)

- **No borrar la categoría** `MAYFEM` del catálogo para "eliminar mayores femenino": son cosas distintas (§1.1). D10: las categorías nunca se borran duro.
- **No crear una segunda inscripción** para la doble categoría. Rompe `school_athletes`, `open_month` y los índices únicos (D3). La multi-categoría vive en `enrollment_categories`.
- **No partir el cobro en dos** ($145.000 + $20.000). Obligaría a relajar `uniq_payment_active_period_per_child`, el índice que sostiene toda la protección anti-duplicado (D18).
- **No "repartir" los $165.000 por categoría** en el desglose: dos categorías juntas valen 165.000, la segunda no "vale 20.000" (§5.3 del spec).
- **No asignar los planes con `auto_generate_payments` encendido.** El cron de las 6:30 genera la cartera solo, al día siguiente, y Monster no tiene cuenta de pago para recibirla (§3.5).
- **No dejar 126 atletas con `fee_is_manual = true`** como forma de "no cobrar": es la palanca de becas individuales, y el día que arranquen a cobrar hay que desmarcarlos uno por uno.
- **No editar migraciones existentes.** Todo fix va en una nueva, creada con `npm run migrations:new -- <slug>`.
- **No aplicar SQL desde el editor de Supabase**: deja la base cambiada sin rastro en `schema_migrations`.

---

## 8. Referencias

- [`docs/specs/sport-categories-and-multi-category.md`](specs/sport-categories-and-multi-category.md) — spec madre (F0–F6, decisiones D1–D19)
- [`docs/plan-f1-catalogo-de-categorias.md`](plan-f1-catalogo-de-categorias.md) — F1, y qué quedó fuera
- [`docs/inscripciones-sin-monto-y-candados.md §1.2`](inscripciones-sin-monto-y-candados.md) — estado real de la cuenta de Monster
- [`scripts/monster-volley-suba-import/README.md`](../scripts/monster-volley-suba-import/README.md) — cómo se cargó Sede Suba
- [`20260826105957`](../supabase/migrations/20260826105957_mod3_school_categories_f1_f2.sql) · [`20260826110135`](../supabase/migrations/20260826110135_mod3_enrollment_categories_f3.sql) · [`20260827175215`](../supabase/migrations/20260827175215_fee_is_manual_becas_cuota_exenta.sql)
