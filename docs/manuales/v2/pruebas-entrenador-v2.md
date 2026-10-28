# Pruebas del Entrenador V2 — 2026-10-26

- **Ambiente:** `https://dev.sportmaps.co` (frontend de develop) + BFF de dev (`sportmaps-bff-dev.onrender.com`), base compartida.
- **Despliegue verificado:** dev ya tiene el commit `7aeb8c7c` (pantalla única de partidos y código de escuela): `/partidos/nuevo` carga la pantalla nueva («Falta el equipo… Abre «+ Partido» desde el equipo») y `/unirse?codigo=BES-TA8H` carga «Únete a tu escuela». El código se leyó del worktree `wt-partidos-simple` (en `7aeb8c7c`); el `develop` local de la sesión va 3 commits atrás.
- **Tenant:** Club Campestre Demo (`25a123f0-6d57-48a4-9800-7b1531d61cd2`, `is_demo=true`). Nada se escribió en escuelas reales.
- **Cuenta:** entrenador demo de fútbol nuevo, **Andrés Ríos** (`entrenador.futbol@demo.sportmaps.co` / `Demo2026!`), creado con `scripts/demo-club-campestre/add-coach.mjs`, a cargo de Fútbol — Sub-15 (4 deportistas) y Fútbol — Sub-12 (3).
- **Cómo:** Playwright con el Chromium cacheado, celular 390×844 @3x (escritorio 1600×1000 @2x para la planificación completa y la vista de la escuela), login plantando la sesión de supabase-js. Script: `docs/manuales/_src/manual-entrenador-v2/capture.mjs <sección>`. Cada captura deja su texto visible en `shots/_texto/` (no versionado). Los resultados de escritura se verificaron leyendo la base.

## Resultado por función

| # | Función | Resultado | Evidencia |
|---|---|---|---|
| 1 | Primer ingreso: Perfil profesional (datos básicos + certificados → Guardar Perfil) | ✅ PASA | `01`–`04`; fila en `coach_profiles` |
| 2 | Hoy: próximo entreno, pendientes («Falta evaluar», «Convocar al partido»), resumen semanal | ✅ PASA (ver B3: «Falta evaluar» no se quita porque la evaluación falla en este tenant) | `05-hoy` |
| 3 | Equipos: lista, Deportistas (estado de pago sin valores), buscador | ✅ PASA | `10`, `11` |
| 4 | Deportista: Escribir al acudiente / Felicitar (hoja con frases) / Ver ficha / Ver todo en Mis deportistas | ✅ PASA (felicitar abierto, no enviado; WhatsApp no se abrió) | `12`–`14`, `134` |
| 5 | Equipo → Evaluar (informe del mes, entrenos recientes) | ✅ PASA | `15` |
| 6 | Partidos: «+ Partido» → Programar con fecha futura → «Programar y convocar» | ✅ PASA — `create_match` creó el partido **y** el evento de calendario ligado | `20`, `21`; partido `64c3d204…`, evento `2e54586e…` |
| 7 | Convocar (quitar a una, Convocar a N, Deshacer) | ✅ PASA — 3 en `match_lineup_players` | `21`, `22`, `31`, `32` |
| 8 | Próximo partido en la pestaña, «Abrir partido», pizarra/alineación | ✅ PASA | `23`, `23b`, `24` |
| 9 | Partido de hoy: «Guardar y registrar el resultado» | ✅ PASA | `30-programar` |
| 10 | Resultado: marcador + Gol (Tomás H.), Asistencia (Renata C.), Amarilla (Tomás D.) | ✅ PASA los eventos (3 filas en `football_match_events`) / ❌ **FALLA en el celular** el botón «Guardar resultado»: queda debajo de la barra de pestañas (B1). Con el clic forzado por código guardó 1–0 y `status=played`. En escritorio se ve bien. | `33`–`35`, `35b`, `47-escritorio` |
| 11 | Evaluar (coach sin criterios → «Pídele a la administración»; admin → «Usar los criterios sugeridos») | ✅ PASA (los criterios los sembró otra sesión antes que yo) | `36`, `37` |
| 12 | Evaluar a una convocada (6 criterios 1–5 + comentario) | ✅ PASA los datos (6 filas en `performance_entries`, contexto `competition`) / ❌ **FALLA en el celular** el botón «Guardar evaluación» (B1) | `40`–`42` |
| 13 | Reporte del partido (resumen, desarrollo, a mejorar, publicar a familias) | ✅ PASA — `match_reports` con `published_at` | `43`–`45` |
| 14 | Partido ya jugado sin marcador → lista «Falta el resultado» | ✅ PASA | `50`–`52`; partido `bd6f73fc…` |
| 15 | Resultados del equipo / Ver todos los partidos | ✅ PASA | `53`, `135` |
| 16 | Calendario: Nuevo Evento tipo **Partido Oficial** para Sub-12 (pide rival y local/visita) | ✅ PASA — toast «Partido creado. Quedó en el calendario y en Resultados» | `61`–`63`; evento `e78e85df…` + partido `bc8d1c85…` |
| 17 | «Abrir partido» en el evento y el partido en Equipos → Partidos | ✅ PASA (solo en el detalle del día seleccionado, no en «Próximos Eventos») | `65`, `66` |
| 18 | Cambiar la fecha del partido en «Programar» mueve el evento del calendario | ✅ PASA (30-sep → 30-oct; el 30-sep fue un error de mi script con el selector de día) | lectura de `calendar_events` |
| 19 | Sesiones: Hoy / Semana / Plan del mes | ✅ PASA (Hoy tarda ~8 s en dev en frío) | `70`–`72`, `81` |
| 20 | Planificación completa: Nuevo mesociclo + Agregar sesión con 3 bloques | ✅ PASA — mesociclo `7032dfab…` (4 semanas), sesión `2652a506…` | `73`–`77` |
| 21 | Semana → día con sesión → Ver sesión / Abrir en la cancha (modo cancha) | ✅ PASA | `78b`, `79`, `80` |
| 22 | «Planear» / «Crear el plan» llevan al equipo y día correctos | ❌ FALLA leve (B6): abren la planificación sin equipo ni fecha | — |
| 23 | Asistencia: elegir equipo, Hoy/Ayer, Vino→Faltó→Excusa→Tarde, Más opciones (clase secundaria) | ✅ PASA | `90`–`93` |
| 24 | Guardar lista (Deshacer → Subiendo → Lista guardada) | ✅ PASA — 4 `attendance_records` con `absent/excused/late/present` (el BFF de dev tardó ~12 s) | `94`, `94b` |
| 25 | Cerrar la lista | ✅ PASA — `finalized=true`; aparece además el modal viejo «Califica el entreno de hoy» (B10) | `94c`, `94d` |
| 26 | Evaluar al equipo (Bien/Normal/Le costó + nota) | ❌ **FALLA** (B3): la pantalla dice «Guardado» y la RPC responde 500 «La escuela no tiene configurada la métrica de rating del coach» | `95`–`97`; 0 filas en `performance_entries` para la sesión |
| 27 | Historial (% del mes, faltan mucho, corregir hoy/ayer) | ✅ PASA (copy B9) | `98` |
| 28 | Escanear carnets (`/coach-attendance/scan`) | ⚪ NO PROBADO con cámara (el navegador de prueba no tiene). La pantalla carga. | `99` |
| 29 | Sin señal / offline | ⚪ NO PROBADO (la cola local existe: `colaAsistencia.ts`; tiene pruebas unitarias) | — |
| 30 | Planillas por revisar: subir foto de planilla (generada con los nombres reales de Sub-15) | ❌ **FALLA** (B2): 422 «No tienes equipos asignados para pasar lista» | `100`, `101` |
| 31 | Entrar a «Subir planilla» desde la V2 sin pendientes | ❌ FALLA (B4): no hay enlace | — |
| 32 | Permiso «Coaches pueden subir planillas de asistencia» | ❌ FALLA (B5): el BFF no lo mira | código |
| 33 | Hojas de matrícula: sin permiso → aviso; la escuela lo activa (Pagos → Config → Permisos); el coach sube la foto; la escuela la ve en «Matrículas por revisar» | ✅ PASA — OCR leyó todos los campos; `enrollment_form_intake 7f1e4c2d…` en `waiting_review`. El permiso se volvió a apagar. | `110`–`114` |
| 34 | Más: Agenda y citas, Calendario, Informe mensual, Informes del entreno, Rutinas, Mi dotación, Salud del equipo, Mensajes, Anuncios, Encuestas, Notificaciones, Configuración, Mi perfil, Centro de ayuda, Mapi | ✅ PASA (todas cargan; Mi perfil tarda ~10 s en frío). El 403 de `/trainer/availability/schedule` es esperado (el coach no es entrenador personal) y está manejado. | `120`–`136` |

**Resumen (34 funciones):** 25 PASA, 7 FALLA (3 de gravedad alta: B1, B2, B3), 2 NO PROBADO.

## Bugs

| # | Gravedad | Qué pasa | Causa (archivo:línea, en `7aeb8c7c`) | Propuesta |
|---|---|---|---|---|
| **B1** | **Alta** | En el celular no se puede tocar «Guardar resultado» ni «Guardar evaluación» del partido: la barra fija queda debajo de la barra de pestañas (solo asoma una franja verde). | `frontend/src/components/partidos/PartidoFlujo.tsx:622` y `:850`: `fixed inset-x-0 bottom-0 z-20`; `MobileBottomNav` es `fixed bottom-0 z-30`. Confirmado con `elementFromPoint`: en el centro del botón está el `nav[data-testid=mobile-bottom-nav]`. | Subir la barra por encima de la navegación: `bottom-nav-safe` (la clase que ya usa `PushPermissionBanner`) en vez de `bottom-0`, o `sticky bottom-0` dentro del contenido como hace `CoachAttendanceV2` (`barra-lista`, con `pr-[5.5rem]` para el botón de Mapi). Agregar una prueba con viewport móvil. |
| **B2** | **Alta** | Las planillas de asistencia por foto (app **y** WhatsApp) fallan siempre con «No tienes equipos asignados para pasar lista», para coach y admin. El OCR se paga antes del error. | `bff/src/services/whatsapp-asistencia-staff.service.ts:112-118`: `cargarEquipos()` hace `select('id, name, schedule, is_active')`, pero `teams` no tiene `is_active` (es `active`): PostgREST responde 42703, el error se ignora y vuelve `[]`. El chequeo de equipos (`:326`) va después del OCR (`:302`). Lo mismo en el camino de «lista» (`:431`). | `select('id, name, schedule, active, status')` y filtrar `active !== false`; loguear el `error` de la consulta; mover `equiposPermitidos` antes de `extractAttendanceSheet`. |
| **B3** | **Alta** (escuelas multideporte o de otro deporte) | «Evaluar al equipo» (y el modal «Califica el entreno de hoy») responden «Guardado» pero no guardan: la RPC devuelve 55000. Hoy sigue mostrando «Falta evaluar». | RPC `submit_post_training_coach_rating` (mig. `20260911123141`, ~282-316): toma el deporte de `schools.category_id` (Club Campestre = Golf) y busca `coach_effort_rating` en `sport_metric_definitions`, que solo existe para Fútbol, Voleibol y Fútbol Sala. En la UI, `CoachEvaluateV2.tsx:117-135` muestra el toast de éxito al programar, antes de la RPC; el error llega 8 s después, a veces fuera de la pantalla. | Tomar el deporte del **equipo** de la sesión (con fallback al de la escuela) o sembrar el catálogo post-entreno para todos los deportes; migración nueva con el ledger. Cambiar el toast a «Se guarda en 8 s» y dejar el error visible en Hoy. Besser es Fútbol: allá debería funcionar (probarlo con la checklist). |
| B4 | Media | En la V2 no hay cómo llegar a «Subir planilla» si no hay planillas pendientes. | `coachMasModel.ts:37` manda `/school/attendance-sheets` a la pestaña Asistencia (por eso no sale en Más), pero `CoachAttendanceV2.tsx:765` solo muestra el enlace cuando `planillasQ.data.total > 0`. | Botón fijo «Subir planilla en papel» en Asistencia (o sacarlo de `RUTAS_EN_BARRA_COACH` para que salga en Más). |
| B5 | Media | El permiso «Coaches pueden subir planillas de asistencia» no se aplica; el texto de la config dice que está «en construcción». | `bff/src/routes/attendance-sheet-intake.routes.ts:143` acepta `coach` sin leer `coach_can_upload_attendance_sheets` (la de matrícula sí lo hace en `enrollment-intake.routes.ts:98-101`). | Decidir: aplicar el gate como en matrícula o quitar el interruptor y actualizar el texto en `PaymentsAutomationPage.tsx:2880-2884`. |
| B6 | Baja | «Planear» y «Crear el plan» abren la planificación completa sin equipo ni fecha. | `CoachSessionsV2.tsx:458`, `:466`, `:543` (`<Link to={rutaPlanificacion}>` sin query). | Pasar `?equipo=<id>&fecha=<día>` y que `TrainingPlansPage` los lea. |
| B7 | Baja | Un mesociclo ya terminado marca su última semana «Esta semana». | `MesocycleSection.tsx:307-314` (si hoy no cae en ninguna semana, toma la última) y `:655-656` (insignia). | Insignia solo cuando la semana contiene hoy. |
| B8 | Baja | Ventana de «Deshacer» (8 s): si la app se cierra o se recarga en ese lapso, la acción se pierde (convocatoria, evaluación del entreno, felicitación). Al navegar dentro de la app sí se ejecuta. Me pasó en la prueba con la convocatoria de Suba al recargar. | `useAccionConDeshacer.ts` (solo ejecuta en `unmount`). | Ejecutar también en `pagehide`/`visibilitychange` o persistir en una cola como `colaAsistencia`. |
| B9 | Baja | El historial dice «Se puede corregir hasta el día siguiente» y la V2 solo ofrece Hoy/Ayer, aunque la escuela tiene `coach_attendance_retro_days = 7` (el BFF valida 7). | `asistenciaModel.ts:151-161`. | Alinear con el ajuste de la escuela o documentarlo como decisión de producto. |
| B10 | Baja | Al cerrar la lista aparece el modal viejo «Califica el entreno de hoy» (porcentajes) además de «Evaluar al equipo» (Bien/Normal/Le costó). | `CoachAttendanceV2.tsx:671`. | Quitar el modal en la V2 o llevar directo a «Evaluar al equipo». |
| B11 | Copy | «Lista guardada: vinieron 2, faltaron 2» suma las excusas como faltas. | `CoachAttendanceV2.tsx` (`aviso-deshacer`: `r.faltaron + r.excusas`). | «faltaron 1, con excusa 1». |
| B12 | Cosmético | El botón flotante de Mapi tapa parte de botones y textos en la pantalla del partido y en evaluar. | FAB de soporte | Reservar margen derecho como en `barra-lista`. |

**Observaciones (no son bugs del producto):** el BFF de dev responde lento en frío (guardar lista ~12 s; Hoy de Sesiones y Mi perfil ~8-10 s). En el demo, `school_settings` tiene `auto_generate_payments`, `reminder_enabled` y `late_fee_enabled` en `true` (el README del demo dice apagados; cambiado el 2026-10-14), por eso todos los deportistas salen «Vencido». `teams.location` del demo trae el horario pegado, por eso Hoy dice «en Mar/Jue 16:00-18:00 · Cancha fútbol 11».

## Datos creados en el tenant demo

Todo en Club Campestre Demo. No se borró nada; el usuario decide.

| Qué | Id | Nota |
|---|---|---|
| Usuario Andrés Ríos (auth + `profiles` + `coach_profiles`) | `16d36eb1-776f-4324-a0ea-fdf1fe5b4519` | `entrenador.futbol@demo.sportmaps.co` / `Demo2026!` |
| `school_members` (coach, sede Fútbol) | `882bbc3e-4dfd-4cfc-8c92-a5ecfd6d9056` | |
| `school_staff` | `b4f41215-cfa4-4203-ae65-a8df9131d559` | |
| `team_coaches` Sub-15 / Sub-12 | `2b838681-0b3f-4db8-bf4e-1111c4144295` / `5ddf1b49-25c5-478f-8586-fc62ddd84d40` | Camilo Herrera y Felipe Torres siguen en `team_coaches` |
| `offering_coaches` (Fútbol) | `6476c4b2-70ff-44bd-a6dd-5f02a55c8b73` | |
| `teams.coach_id` de Sub-15 (`658d014e…`) y Sub-12 (`92ee5e2a…`) | ahora `b4f41215…` | **Antes** `f0000000-0000-4000-8000-000000000001` (Camilo Herrera, ficha sin cuenta) |
| Partido Atlético Sabana (Sub-15, 26-oct, 1–0, `played`) | `0707b28e-fd47-465f-9562-084f2d37de2a` | convocatoria `match_lineups 0c3ad5dc…` (3); eventos `a85986a5…` (gol), `55f23c37…` (asistencia), `e7dd3453…` (amarilla); 6 `performance_entries` (Tomás H.); `match_reports` publicado (avisó a las familias demo) |
| Partido Deportivo Chía (Sub-15, 23-oct, sin resultado) | `bd6f73fc-5b6f-47de-9a30-2063854eeff4` | queda en «Falta el resultado» a propósito |
| Partido Club Los Andes (Sub-12, 30-oct) + evento | `bc8d1c85-bdf9-4869-bfea-7a1c5f2bfb3f` + `e78e85df-7ac0-421a-86b7-6af9692c5862` | creado desde el calendario |
| Partido Deportivo Suba (Sub-12, 7-nov) + evento | `64c3d204-c886-48ed-9afb-40908111e235` + `2e54586e-a5fa-472d-a299-ead09064973a` | convocatoria `ee848cfd…` (3) |
| Mesociclo Sub-15 26-oct → 22-nov | `7032dfab-d941-4d85-aab4-45e91de7336e` | semanas `56a8f843…`, `1f0e85a3…`, `898875bf…`, `ab64927c…` |
| Sesión de entrenamiento Sub-15 27-oct (3 bloques) | `2652a506-4e1d-4b67-a9bb-2f9022705f66` | |
| Lista de asistencia Sub-15 26-oct (cerrada) | `cc4d1173-aca6-4445-9891-dcb089241148` | 4 `attendance_records` (faltó/excusa/tarde/vino) |
| Hoja de matrícula de prueba «Samuel Ortiz Ríos» (ficticio) | `enrollment_form_intake 7f1e4c2d-e6c1-405e-8b02-39065954ace1` | `waiting_review`, foto en Storage `enrollment_intake/25a123f0…/ec086439….jpeg` |
| `school_settings.coach_can_upload_enrollment_forms` | — | se prendió para la prueba y se **volvió a apagar** |

**No son de esta prueba:** otra sesión, como Ricardo (owner), creó el mismo día los partidos *Halcones FC* (`09674a04…`, con su evento `5569a4a2…`) y *Deportivo Arrayanes* (`03f916e1…`), los 7 criterios de partido (`school_metric_definitions`, 16:32) y prendió `share_match_evaluations`.

## Checklist para probar en tu celular (cuenta real)

Con la cuenta de **Duván en Besser** (entrenador). Tiempo: ~20 min. Marca ✔/✘ y anota lo que veas.

**Antes:** abre `app.sportmaps.co` (o dev si así lo prefieres) en el celular, entra con tu cuenta y confirma que abajo salen **Hoy · Equipos · Sesiones · Asistencia · Más**.

1. **Hoy** — ¿dice qué entrenas hoy o mañana? ¿Salen pendientes en amarillo? Toca «Más tarde» en uno: debe esconderse.
2. **Equipos** → toca un equipo → **Deportistas**: ¿salen todos con su acudiente y «al día / vencido» (sin valores)? Toca uno: ¿salen *Escribir al acudiente · Felicitar · Ver ficha*? Toca *Escribir al acudiente*: debe abrir WhatsApp con el número.
3. **Partidos** (equipo → *Partidos y convocatorias*) → **+ Partido** → rival «Prueba», fecha **de hoy**, tipo Amistoso → *Guardar y registrar el resultado*.
   - Toca a un jugador y súmale **un gol**. Debe salir la «G» al lado del nombre.
   - Baja hasta el final: **¿puedes tocar «Guardar resultado»?** Esperado hoy: **NO** (bug B1, el botón queda debajo de la barra). Si no puedes, gira el teléfono o entra desde el computador y guarda desde ahí.
   - Paso **Evaluar**: ¿dice «No hay criterios» o salen criterios? Si salen, califica a uno y prueba «Guardar evaluación» (mismo bug B1).
   - Paso **Reporte**: escribe una línea, deja *Publicar a las familias* **apagado** y guarda. Luego borra o cancela el partido de prueba (*Programar → Cancelar este partido*).
4. **Calendario** (Más → Calendario → *Nuevo Evento*): para tu equipo, tipo *Partido Oficial*: ¿pide el rival? No lo crees si no quieres que les llegue a las familias; si lo creas, toca el día y verifica **Abrir partido**.
5. **Sesiones** → *Semana*: ¿salen tus días de entreno? Toca uno con sesión: *Abrir en la cancha* → ¿letra grande, Anterior/Siguiente, la pantalla no se apaga?
6. **Asistencia** → tu equipo → **Hoy**: toca a uno hasta «Tarde» (Vino → Faltó → Excusa → Tarde). *Guardar lista* → espera a que diga **Lista guardada** (puede tardar). Luego *Corregir* y déjala como era.
   - *Evaluar al equipo* → toca «Bien» a uno → *Guardar evaluación* → **espera 10 s sin cerrar la app** → vuelve a **Hoy**: ¿desapareció «Falta evaluar el entreno»? (En el demo falló por el deporte de la escuela, B3; Besser es Fútbol y **debería** funcionar. Si no, avísame.)
7. **Escanear carnet** (Asistencia → *Escanear carnets en la entrada*): acepta la cámara y escanea el carnet digital de un deportista desde otro teléfono: ¿queda presente?
8. **Sin señal:** pon modo avión, toma una lista y guárdala: debe decir «Guardada en el teléfono». Quita el modo avión: debe subir sola.
9. **Más**: abre *Informe mensual*, *Mi dotación*, *Salud del equipo* y *Preguntarle a Mapi*: ¿cargan todas?

**Código de escuela (Besser `BES-TA8H`)**

10. Con una cuenta **sin escuela** (crea una de prueba con un correo tuyo + `+prueba`): abre `https://app.sportmaps.co/unirse?codigo=BES-TA8H` (o el dominio donde esté desplegado el commit `7aeb8c7c`). Debe decir «Tienes el código BES-TA8H. Primero entra o crea tu cuenta». Entra/crea la cuenta → debe confirmar «¿Es Club Deportivo Besser?» → elige *Para mi hijo(a)*, nombre y fecha de nacimiento ficticios → **Solicitud enviada**.
11. Como **administración de Besser**: *Estudiantes* → **Por asignar (N)**: debe aparecer la solicitud. Prueba **Asignar a un equipo** (el entrenador queda el del equipo) o **Rechazar** si es de prueba. Verifica que llegó el aviso a la administración (campana).
12. De vuelta en la cuenta de prueba: al asignarla, ¿el inicio ya muestra Besser? Después borra la cuenta de prueba (tú manejas las eliminaciones).

## Qué quedó pendiente

- Corregir B1, B2 y B3 antes de enviar los capítulos 5, 7 y 9 del manual a escuelas.
- Probar con cámara real el escaneo de carnet y el modo sin señal (checklist 7 y 8).
- Repetir «Evaluar al equipo» en una escuela de Fútbol (Besser) para confirmar que B3 es solo de escuelas de otro deporte.
- Pegar los artículos de `sportbot/manual-entrenador-v2.help-articles.ts` en `bff/src/data/help-articles.ts` cuando se apruebe.
