# Plan — Club Carmel, pedidos de septiembre 2026

**Fecha:** 2026-09-24 · **Estado:** borrador para revisar con el usuario · **Fuente:** notas de la reunión del viernes 2026-09-18 (WhatsApp) + pedido del entrenador de arqueros + entrenador con dos categorías.
**Escuela:** Carmel Club (`school_id 374a6716-af42-4745-afe1-8d089153e01b`, slug `carmel-club`). No factura. Uso real, exenta del bloqueo de prueba.

Todo lo que dice "hoy" abajo está verificado contra la base viva y el código en `develop` el 2026-09-24, no supuesto.

---

## 0. Cómo está Carmel hoy (medido)

| Dato | Valor |
|---|---|
| Atletas activos | 72, todos con equipo, todos menores (`children`) |
| Equipos | 6, todos fútbol, todos sin categoría del catálogo (`category_id NULL`) |
| Entrenadores | 7 en `school_staff`, los 7 con cuenta vinculada; 3 sin equipo (Victor Melo, Yohan Casas, Michael Suárez) |
| Owner | Mauricio Rodríguez Samacá |
| Acudientes vinculados | **0 de 72** |
| Uso del módulo deportivo | 6 sesiones de asistencia, 1 mesociclo, 4 sesiones de entrenamiento, 0 evaluaciones, 0 informes |
| Flags | `coach_can_create_teams` y `coach_can_create_athletes` en `true`; `billing_enabled`, `auto_generate_payments` y `reports_enabled` en `false` |
| Módulos ocultos (super admin, 2026-09-19) | finanzas (recepción, pagos, contabilidad, facturación electrónica, reportes de finanzas), QR de inscripción, control de acceso, perfil público |
| Suscripción | `starter` / `free`, `trial_expired`, `blocking_exempt = true` ("en uso real, exenta por decisión comercial") |

Equipos y a quién pertenecen:

| Equipo | Entrenador (`teams.coach_id` = `school_staff.id`) | Activos | Años de nacimiento |
|---|---|---|---|
| ` carmel club cat 2016-17` (con espacio inicial) | Sergio Polanco | 17 | 2016, 2017 |
| `Carmel Club Campestre ` | Gerardo García | 15 | 2014, 2015 |
| `CARMEL CLUB CATEGORIA JUVENIL` | Carlos Ruiz (también en `team_coaches`) | 20 | 2011-2013 |
| `Categoria 2018-19` | Robert Herrera | 19 | 2018 ×11, 2019 ×4, **2020 ×1, "2026" ×3** |
| `Categoria 2020-21` (creado 2026-09-18) | Robert Herrera | **0** | — |
| `Carmel Club` (creado 2026-08-19, sin entrenador) | nadie | 1 | 2009 |

---

## 1. Resumen de los pedidos

| # | Pedido (como llegó) | Qué hay hoy | Qué falta | Tamaño | Tanda |
|---|---|---|---|---|---|
| 1 | Entrenador con dos categorías de pequeños, "no deja abrir la otra" | El equipo 2020-21 existe con 0 atletas. "Inscribir" desde Mis Equipos responde 409 si el niño ya está en otro equipo | Que el modal ofrezca **mover** al atleta en vez del 409 | S | 1 |
| 2 | Equipo de arqueros transversal | 409 por la regla de una inscripción activa. La multi-categoría (MOD-3 F3) escribe pero nadie la lee | Paliativo: coach adicional en las 5 categorías. Real: "grupo de trabajo" (spec) | XS + L | 1 + 3 |
| 3 | "Patinar asistencia por atleta" (leído como *pintar*: verla por atleta) | Owner: Histórico mensual por atleta (`/attendance-history`). Coach: pestaña Asistencia en Reportes por equipo | Confirmar qué vista pidieron; propuesta: % por atleta en la ficha y en el roster del coach | S | 2 |
| 4 | Filtro plan consumo vs pago | Listado de atletas filtra por equipo, plan y estado de pago. No muestra ni filtra sesiones consumidas | No es de Carmel (no usa planes). Queda como ítem de plataforma | S | fuera |
| 5 | Informes personalizados en los reportes de Carmel | Informe Mensual: BD + RPCs + tablero del admin + vista del padre construidos; sin pestaña del coach; fútbol tiene 31 métricas y solo 5 rótulos para padres; `reports_enabled=false`; 0 evaluaciones; 0 acudientes | Formato de evaluación de Carmel → criterios; rótulos de fútbol; prender el módulo | M | 3 |
| 6 | Planes / servicios no van en Carmel | Finanzas ya ocultas. Siguen visibles "Mis Planes" y "Membresías" porque comparten `moduleKey` con "Mis Equipos"; el menú del coach no se filtra por módulos | `moduleKey` propio para Mis Planes y Membresías; filtrar también el menú del coach | S | 1 |
| 7 | Sesiones de entrenamiento | Existen (`training_sessions` + mesociclos) por equipo en "Métricas y Rendimiento" | El nombre del menú no dice "sesiones"; entrada "Sesiones de entrenamiento" | XS | 1 |
| 8 | Ver en el owner las sesiones creadas por los entrenadores | El owner ya entra a `/training-plans`, elige equipo y las ve. No hay vista consolidada por entrenador/semana | Vista "Sesiones de la semana" para el owner: equipo, entrenador, fecha, objetivo, mesociclo. Solo lectura | M | 2 |
| 9 | Informe de asistencias dentro del reporte global de desempeño | `/school-reports` → Resumen: Ocupación global, Ingresos, Crecimiento. Nada de asistencia, y dos tarjetas de dinero que a Carmel le sobran | Bloque de asistencia (% por equipo del mes, atletas con más faltas, tendencia) reusando `GET /attendance/history`; ocultar tarjetas de dinero cuando `has_billing=false` | M | 2 |
| 10 | Manual de funciones del entrenador, personalizado | Hay manuales de tomar asistencia, asignar categoría (Besser) y evaluación post-entrenamiento | Manual del entrenador **de Carmel** (crea categorías, crea/mueve atletas, sin dinero), dos versiones + artículo del Sportbot, capturas reales | Doc | 2 |
| 11 | "Solo para visualizar el informe" | Dos lecturas posibles (familia / directivo). Rol `reporter` existe pero es de cartera, no deportivo | Confirmar con Carmel antes de construir | ? | pregunta |
| 12 | Limpieza de datos (no lo pidieron, pero bloquea) | 3 niños nacidos en "2026", equipo `Carmel Club` suelto con 1 atleta y sin entrenador, nombres con espacios y mayúsculas | Que Carmel corrija desde la app; nosotros solo señalamos | XS | 1 |

Tamaños: XS = configuración o datos, sin código · S = un archivo o dos, horas · M = varios archivos, días · L = spec + migración + lectores.

---

## 2. Detalle por pedido

### 2.1 Entrenador con dos categorías: no puede pasar niños a la nueva (#1)

**Lectura del pedido.** "Entrenador con 2008" no cuadra con ningún equipo de Carmel; el caso que aparece en la base es Robert Herrera: tiene `Categoria 2018-19` con 19 niños y creó `Categoria 2020-21` el 18-sep, que sigue en 0. En 2018-19 hay un niño de 2020 y tres con fecha imposible ("2026"), o sea los que él quería pasar. **Asumo que "2008" es "2018".** Si es otro entrenador, el diagnóstico y el arreglo son los mismos.

**Por qué falla.** El botón "Inscribir" del modal de Mis Equipos llama `POST /enrollments` solo con `team_id`. Como el niño ya tiene otro equipo, el BFF responde 409 "El atleta ya tiene una inscripción activa en esta escuela" ([enrollments.ts:398-480](../bff/src/routes/enrollments.ts#L398-L480)). La excepción de multi-categoría exige `teams.category_id` en los dos equipos, y Carmel no tiene catálogo. El botón "Remover" del mismo modal cancela la inscripción entera (el niño queda sin equipo), no es un "mover".

**Lo que sí funciona hoy.** Deportistas → editar → categoría: `PUT /students/:id` deja al coach cambiar `team_id` porque Carmel tiene `coach_can_create_athletes=true` ([students.ts:664-690](../bff/src/routes/students.ts#L664-L690)). Es el mismo camino documentado para Besser en `docs/manuales/academias/guia-entrenadores-asignar-categoria.pdf`. Sirve como salida inmediata mientras se arregla el modal.

**Arreglo propuesto (S).** En `EnrollTeamStudentModal.tsx`, cuando el atleta ya tiene otro equipo activo, en vez de dejar pasar el 409 mostrar "Ya está en *Categoria 2018-19*. ¿Moverlo a *Categoria 2020-21*?" y, al confirmar, llamar `PUT /students/:id` con `enrollment.team_id` (el camino que ya existe y ya respeta la cuota manual). El 409 queda solo para el caso sin confirmación. Sin tocar BFF ni base.

**Datos.** Los tres niños con nacimiento "2026" (Jackson Haime, Lucca Gerard, Jerónimo Carvajal) tienen que corregirse desde la ficha; hasta entonces cualquier categoría por edad los va a clasificar mal.

### 2.2 Grupo de arqueros (#2)

Diagnóstico completo en la memoria del proyecto (`project_carmel_arqueros_grupo_transversal`). Resumen:

- **Hoy no se puede.** Una inscripción activa por atleta es regla deliberada (incidente Dynasty) y de ella cuelga el cobro.
- **La multi-categoría está a medias.** El POST escribe `enrollment_categories`, pero ni `school_athletes`, ni asistencia, ni mesociclos, ni informes la leen. Monster's tiene 12 atletas en un segundo equipo que en ese equipo aparecen en cero.
- **"Arquero" no es una categoría.** Pasarlo por ese carril lo cuenta como segunda categoría (precio por tramos).
- **El catálogo de posiciones** (`team_members.position_code = 'arquero'`) vive en una tabla legacy sin pantalla para asignarlo: 0 filas en Carmel, 0 usos en toda la base.

**Paliativo (XS, hoy).** El owner agrega al entrenador de arqueros como coach adicional de las 5 categorías desde Mis Equipos (`team_coaches`). Ve todos los equipos, toma asistencia y evalúa a cualquier arquero. No tiene grupo propio.

**Construcción (L, tanda 3, requiere decisión).** "Grupo de trabajo": equipo marcado `workgroup` que no cuenta para cobros ni cupo, pertenencia secundaria por atleta sin tocar `enrollments`, y las ~15 lecturas de roster por `team_id` (asistencia, mesociclos, sesiones, informes, modal de inscribir, contadores) hacen UNION con la secundaria. Sirve también para preparación física, selecciones y porteros de otras escuelas. Va con spec en `docs/specs/` y plan de migraciones aprobado antes de escribir SQL.

### 2.3 Asistencia por atleta (#3)

Leo "patinar" como "pintar": mostrar la asistencia por atleta. Lo que existe:

- **Owner:** `/attendance-history` (menú Asistencias → Histórico) responde "quién viene y quién no, por atleta" mes a mes, con CSV. Sale de `GET /api/v1/attendance/history?month=YYYY-MM`.
- **Coach:** `/coach-reports` tiene pestaña "Asistencia" por equipo. No tiene el histórico por atleta del owner.
- **Ficha del atleta (escuela):** no muestra asistencia.

**Propuesta (S).** (a) Exponer el histórico al coach filtrado a sus equipos (mismo endpoint, `team_id` de sus `team_coaches`). (b) % de asistencia del mes en el roster del equipo y en la ficha del atleta. Confirmar con Carmel cuál de los dos pidieron antes de hacerlo.

### 2.4 Filtro consumo del plan vs pago (#4)

No aplica a Carmel: no usa planes ni cobra. El listado de atletas ya filtra por equipo, plan y estado de pago (`SchoolStudentsManagementPage.tsx:268-273`), pero no muestra ni filtra `sessions_used` contra `max_sessions`. Queda como ítem de plataforma ("Consumo: agotado / por agotarse / con saldo") para cuando una escuela con planes por sesiones lo pida. Fuera de este plan.

### 2.5 Informes personalizados (#5)

**Qué hay.** Módulo "Informe Mensual del Atleta" (`docs/specs/athlete-reports-module.md`): F0 rótulos, F1 backend (tablas, RLS, RPCs), tablero del admin (`/informe-mensual`, `MonthlyReportsPage`), vista del padre (`/children/:id/reports`), endpoints de preview, publicación, envío y PDF por equipo. **No hay pestaña "Informes del mes" para el coach** (F2): la nota de equipo hoy se escribe desde el tablero del admin.

**Qué le falta a Carmel para usarlo.**
1. `reports_enabled=false` en `school_settings` (prenderlo es un update).
2. 0 evaluaciones cargadas. El informe se arma con `performance_entries`; sin datos es un PDF con logo.
3. Fútbol tiene 31 métricas activas y solo 5 con `parent_label`. Sin rótulo el padre ve vocabulario de entrenador.
4. 0 acudientes vinculados y el consentimiento de los padres no está resuelto (ver memoria `project_club_carmel_reports_consent`). Sin eso no hay a quién publicar.

**"Personalizado" = los criterios de Carmel.** Dos caminos: (a) elegir de las 31 métricas de fútbol las que Carmel evalúa y completar sus rótulos (M, sin migración); (b) criterios propios por escuela (`school_metric_definitions`, propuesto en el spec de Partidos, sin construir). Empezar por (a); (b) solo si el formato de Carmel no cabe en el catálogo.

**Primer paso, sin código:** pedirle a Carmel su formato de evaluación actual (papel o Excel). Sin eso no hay qué personalizar.

### 2.6 Planes y servicios ocultos (#6)

El 19-sep se apagaron los 8 módulos de finanzas y afines. Lo que Carmel sigue viendo y no usa:

- **"Mis Planes"** (`/offerings`) y **"Membresías"** (`/memberships`): están dentro del grupo "Equipos y Planes", cuyo `moduleKey` (`gestion_deportiva_equipos_planes`) cubre el grupo entero ([navigation.ts:123-134](../frontend/src/config/navigation.ts#L123-L134)). Apagarlo esconde también "Mis Equipos".
- **El menú del coach no se filtra por módulos:** `ModuleGate` solo actúa sobre `school`/`school_admin`. El coach ve "Planes del coach" (`/coach-plans`) aunque la escuela no use planes.
- El modal de inscribir y el editor de atleta muestran cuota y plan. Con `has_billing=false` deberían esconderse; es un cambio aparte y más amplio.

**Propuesta (S).** `moduleKey` propio para "Mis Planes" y "Membresías" en el catálogo de módulos, aplicar el filtro de módulos también al árbol del coach, y apagar los dos para Carmel desde el panel de super admin.

### 2.7 y 2.8 Sesiones de entrenamiento y lo que crean los entrenadores (#7, #8)

**Qué hay.** `/training-plans` ("Métricas y Rendimiento" en el menú del owner) lista, por equipo, el mesociclo vigente y las sesiones (`training_sessions`). El owner ve todos los equipos; el coach solo los suyos. Carmel tiene 1 mesociclo y 4 sesiones cargadas.

**Por qué no lo encuentran.** El ítem se llama "Métricas y Rendimiento" y está dentro de "Entrenamiento". Y hay dos cosas llamadas "sesión": la de contenido (`training_sessions`) y la de pasar lista (`attendance_sessions`).

**Propuesta.** (XS) Entrada "Sesiones de entrenamiento" en el menú del owner que abra la misma pantalla. (M) Vista "Sesiones de la semana" para el owner: todas las sesiones de todos los equipos, con entrenador, fecha, objetivo y si están dentro de un mesociclo, solo lectura, con salto al detalle. Reusa las mismas queries de `TrainingPlansPage`.

### 2.9 Asistencia en el reporte global (#9)

`/school-reports` → pestaña Resumen tiene Ocupación Global, Ingresos Confirmados, Crecimiento Neto, ocupación por programa, ingresos por programa y crecimiento. No hay asistencia. Para Carmel, las tarjetas de ingresos son ruido.

**Propuesta (M).** Bloque "Asistencia del mes": % por equipo, atletas con más faltas, tendencia de los últimos meses, CSV. Fuente: el mismo `GET /attendance/history` del Histórico. Y ocultar las tarjetas de dinero cuando `v_school_entitlements.has_billing = false`.

### 2.10 Manual del entrenador de Carmel (#10)

Se arma con el patrón único de PDFs (capturas reales, dos versiones interna/academias, artículo para el Sportbot). Capítulos, según lo que Carmel tiene prendido:

1. Mis Equipos: ver mis categorías, crear una nueva (Carmel lo permite), agregar un entrenador adicional (solo admin).
2. Deportistas: registrar uno nuevo (Carmel lo permite), mover de categoría (camino de la ficha hasta que salga el fix de 2.1).
3. Tomar asistencia (reusar `tomar-asistencia.pdf`).
4. Sesiones y mesociclo.
5. Evaluación post-entrenamiento (reusar `evaluacion-post-entrenamiento.pdf`).
6. Informe mensual: solo cuando 2.5 esté prendido; si no, un callout "próximamente".
7. Lo que NO ve un entrenador en Carmel: nada de dinero.

Depende de 2.1 y 2.6 para no documentar pantallas que van a cambiar la semana siguiente.

### 2.11 "Solo para visualizar el informe" (#11)

Dos lecturas y llevan a cosas distintas:

- **La familia entra solo a ver el informe.** Ya existe `/children/:id/reports` para el rol `parent`, pero el menú del padre trae calendario, asistencia, pagos. Se podría dejar un modo "solo informes" por escuela. Antes de eso: 0 acudientes vinculados y consentimiento pendiente.
- **Un directivo del club con acceso de solo lectura.** El rol `reporter` existe pero su panel es cartera y listados, no lo deportivo. Lo más cercano es un `school_admin` con módulos apagados.

**Pregunta para Carmel antes de mover nada.**

### 2.12 Limpieza de datos (#12)

Para que Carmel lo haga desde la app; nosotros no borramos ni corregimos datos de clientes:

- Tres fichas con nacimiento en 2026 (2.1).
- Equipo `Carmel Club` (1 niño de 2009, sin entrenador): moverlo a Juvenil o darle entrenador.
- Nombres de equipo con espacio inicial/final y mayúsculas mezcladas (` carmel club cat 2016-17`, `Carmel Club Campestre `). Sugerir "Categoría 2014-15", "Categoría 2016-17", etc.

---

## 3. Orden de ejecución

> **Avance 2026-09-24 (mismo día):** #1 y #2 quedaron construidos en `develop` en un solo cambio, a pedido del usuario ("prioridad 1, que Carmel lo arme desde la app"):
> - Migración `20260924101138_secondary_team_enrollment_carmel.sql`: flag `school_settings.allow_secondary_team_enrollment` (default false, Carmel true) expuesto en `v_school_entitlements`. Aplicada en la base compartida.
> - BFF `POST /enrollments` acepta `secondary: true`: si la escuela tiene el flag y el atleta ya tiene equipo activo, inserta la segunda inscripción con `monthly_fee = 0` y `fee_is_manual = true` (nunca cobra). Sin flag → 403 `SECONDARY_TEAM_NOT_ENABLED`.
> - `EnrollTeamStudentModal`: si el atleta ya está en otro equipo, pregunta "Agregarlo también" (solo con flag) o "Moverlo" (vía `PUT /students/:id`, el camino del editor; solo sin plan). Ya no llega el 409 crudo.
> - Promovido a `staging` y `main` el mismo día (main `94bb7a70`); prod ya sirve el diálogo. Rediseño del diálogo en `2b54a471` (tarjetas por opción, overlay propio).
>
> **Avance 2026-09-24, segunda tanda (`9649a7b6`):**
> - **#9 hecho:** bloque "Asistencia del mes" en `/school-reports` (porcentaje, presentes/registros, días con lista, deportistas, % por equipo, más faltas, navegación por mes) sobre `GET /attendance/history`, que ahora devuelve también `contexts[]` (agregado por equipo). Las tarjetas de dinero se esconden cuando `has_billing = false` y la ocupación ocupa el ancho completo.
> - **#8 hecho:** panel "Sesiones de la semana" para owner/admin en Métricas y Rendimiento: todas las `training_sessions` de todos los equipos, con entrenador, objetivo, bloques y marca de mesociclo; un clic selecciona el equipo.
> - **#3 no necesita código:** el coach ya tiene asistencia por atleta (por equipo y mes) en Reportes → Asistencia. Queda solo la pregunta a Carmel de si quieren el % en la ficha.
> - **#6 y #7 (menú del owner):** pendientes a propósito. Otra sesión del usuario tiene `navigation.ts`, `module-catalog.ts`, `App.tsx` y `ModuleGate.tsx` modificados sin commitear (hizo la parte del coach: "Sesiones de Entrenamiento" al frente y `moduleKey` para "Mis Planes" del coach). Tocar esos archivos en paralelo era pisarle el trabajo; van cuando ese cambio esté commiteado.
> - **#10 hecho:** `docs/manuales/academias/entrenador-carmel.pdf` (13 páginas, para Carmel) y `docs/manuales/interno/entrenador-carmel.pdf` (14, con notas internas), más `entrenador-carmel-help-article.ts` para el Sportbot. Capturas reales en stg con el tenant demo y los flags de Carmel prendidos temporalmente (apagados al terminar). Fuentes en `docs/manuales/_src/entrenador-carmel/`.

**Tanda 1 — esta semana, sin migraciones**
1. Paliativo arqueros: coach adicional en las 5 categorías (Carmel, desde la app).
2. Fix del modal de inscribir: ofrecer "mover" (2.1).
3. `moduleKey` para Mis Planes / Membresías + filtro de módulos en el menú del coach + apagarlos para Carmel (2.6).
4. Entrada "Sesiones de entrenamiento" en el menú del owner (2.7).
5. Mandar a Carmel la lista de limpieza de datos (2.12) y las preguntas de §4.

**Tanda 2 — siguiente, con las respuestas de Carmel**
6. Vista "Sesiones de la semana" para el owner (2.8).
7. Bloque de asistencia en el reporte global + ocultar dinero sin billing (2.9).
8. Asistencia por atleta para el coach / en la ficha, según respuesta (2.3).
9. Manual del entrenador de Carmel (2.10), después de 2 y 3.

**Tanda 3 — con decisión y spec**
10. Grupo de trabajo (arqueros): spec, plan de migraciones, RLS línea por línea (2.2).
11. Informes personalizados: formato de Carmel → métricas y rótulos de fútbol → prender `reports_enabled` → consentimiento y vinculación de acudientes (2.5).
12. "Solo visualizar" según la lectura que confirme Carmel (2.11).

**Fuera de este plan:** filtro de consumo del plan (2.4), ocultar cuota/plan en el editor y el modal cuando no hay billing (nota en 2.6).

---

## 4. Preguntas para Carmel (próxima reunión)

1. ¿El entrenador "con 2008" es Robert Herrera con 2018-19 y 2020-21? Si es otro, ¿cuál?
2. Asistencia por atleta: ¿la quiere ver el entrenador, el owner, o va dentro del informe al padre?
3. ¿Qué formato de evaluación usan hoy (papel, Excel)? Sin eso no hay "informe personalizado".
4. "Solo para visualizar el informe": ¿la familia o un directivo del club?
5. ¿Los padres firmaron algún consentimiento que cubra informes de rendimiento? Hoy hay 0 acudientes vinculados.
6. ¿Quién es el entrenador de arqueros de los 3 sin equipo?

---

## 5. Notas al margen (no son del plan, quedan registradas)

- `pg_policies` muestra `"Staff can manage enrollments"` como `FOR ALL` sin `WITH CHECK` (invariante I3). Correr `npm run seguridad:invariantes` y ver si ya está en la lista conocida.
- Las 12 filas secundarias de `enrollment_categories` de Monster's no se ven en ningún roster (2.2): mismo hueco, otra escuela.
