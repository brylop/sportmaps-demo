# Torneos — Flujo de Invitación e Inscripción de Delegaciones (Fase 1)

> Estado: **diseño** (Fase 1 de [Torneos por Escuela]). Sin implementar aún.
> Última actualización: 2026-07-13.
> Complemento: el motor de calificación está en `docs/tournaments-scoring-engine.md` (Fase 2).
> Aplica **igual a organizadores y a escuelas anfitrionas** (mismo flujo; solo cambia `owner_type`).

## 1. Objetivo

Que el anfitrión (organizador o escuela) **invite y gestione** delegaciones, y que el participante tenga **clarísimo qué datos cargar**, cubriendo los dos escenarios reales:

- **Escenario 1 — la academia NO está en SportMaps.** El organizador la invita; ella se registra y queda dentro de la plataforma para inscribirse.
- **Escenario 2 — la academia SÍ está en SportMaps.** Se le guía paso a paso; reutiliza su propia base de atletas/equipos.

Realidad a soportar: muchas veces la delegación llega como un **Excel** (equipos, cantidad de atletas, documentos de atletas) + los **pagos** correspondientes.

## 2. El link de invitación

- Base: `events.slug` + página pública `/event/:slug` (ya existe) + token dirigido opcional.
- Modelo `event_invitations`: `event_id, token, invited_email/school (opcional), status, created_by, expires_at`.
  Estados (embudo): **enviada → abierta → registrada → inscrita → pagada → aprobada**.
- Se comparte por link, email, WhatsApp o **QR** (reusa `qr_code_url`/`qr_smart_enabled` de `event_organizers`).

## 3. Escenario 1 — Academia NUEVA (no está en SportMaps)

1. Organizador crea el torneo y **genera la invitación** (a un correo/contacto o link abierto).
2. La academia abre el link → ve la **página pública del torneo** (deporte, categorías, fechas, requisitos, costos) + CTA "Inscribir mi delegación → Crear cuenta".
3. **Registro ligero de participante**: crea perfil de escuela mínimo (nombre, ciudad, contacto, deporte). *No* requiere el setup completo del SaaS — solo lo necesario para participar. (Reusa onboarding de rol; ver memoria `project_person_role_onboarding` y `project_google_oauth_login`.)
4. Redirige **sin perder el contexto del evento** (deep-link return-to) al **wizard de inscripción** (§5).
5. Como no tiene datos previos, la vía natural es **carga por Excel** (§6) o entrada manual.

## 4. Escenario 2 — Academia YA en SportMaps

1. Abre el link (o descubre el torneo en `/events`) estando logueada → cae directo en el **wizard de inscripción** de ese evento, con delegación pre-asociada.
2. **Ventaja de estar conectada:** puede **elegir atletas/equipos de su propio roster** (los `event_team_members` enlazan `profile_id`/`child_id` existentes) en vez de re-digitar. Sus documentos pueden ya estar en archivo.
3. Igual puede usar Excel o manual para lo que falte.

## 5. Wizard de inscripción (paso a paso, guiado por el propio torneo)

El wizard muestra un **checklist derivado de `event_categories_config` y `event_price_phases`**, así el participante sabe exactamente qué se requiere:

1. **Categorías / divisiones** — elige en cuáles compite (rama, división, nivel, edades `age_min/max` / `birth_year_min/max`, atletas `team_min/max`, crossover).
2. **Armar equipos y roster** — tres modos:
   - **Desde mi roster** (solo Escenario 2): seleccionar atletas ya en SportMaps.
   - **Excel masivo** (§6): descargar plantilla → llenar → subir → validar → confirmar.
   - **Manual**: agregar atleta por atleta.
3. **Documentos de atletas** — subir lo requerido (documento de identidad, registro civil para prueba de edad, foto, consentimiento de menores). Por atleta o en lote.
4. **Validación automática** — edad dentro de la categoría, cantidad de atletas dentro de `team_min/max`, crossover permitido, documentos y campos obligatorios, duplicados. Errores señalados por fila (patrón `dry_run`).
5. **Resumen de costo** — según la **fase de precio vigente** por fecha (`event_price_phases`: paquetes, kits, alojamiento, crossover). Calcula `total_owed`.
6. **Pago** — §7.
7. **Envío** — la delegación pasa a `status = submitted`; el anfitrión revisa (§8).

## 6. Carga por Excel (el caso "a veces es un Excel")

- **Plantilla descargable** con columnas: `equipo`, `categoria/division`, `atleta`, `doc_type` (CC/TI/RC/CE/PASAPORTE/PPT), `doc_number`, `fecha_nacimiento`, `talla_camiseta`, `es_crossover`, etc.
- Subida → parseo → **`dry_run` (validar sin insertar)**: reporta por número de fila edades fuera de categoría, tamaños de equipo inválidos, documentos faltantes, duplicados.
- **Previsualización** de lo que se va a crear → confirmar → inserta `event_teams` + `event_team_members`.
- Reusa el patrón de [`bulkUpload.ts`](../bff/src/routes/athletes/bulkUpload.ts) (trazabilidad por fila, tipos de doc, `dry_run`, service-role para batch con `school_id` tomado del JWT, nunca del body).
- **Nota:** el Excel de torneo carga **roster + documentos** (nivel atleta). Los **pagos** se manejan a nivel de **delegación** (§7), no fila por fila como en el bulk de matrícula.

## 7. Pagos de la delegación

### 7.1 Modo de pago (`payer_mode`) — configurable por torneo
Conviven dos realidades; el anfitrión lo elige al crear el torneo (y puede ser override por delegación):

- **`school_pays` — la escuela recauda/paga.** La escuela paga la inscripción de toda la delegación al anfitrión (un pago a nivel delegación). Cómo recupera de las familias es asunto interno de la escuela (su propio cobro escuela→familia). Un solo pagador.
- **`parent_pays` — cada padre paga directo.** La escuela solo **envía el roster + la data**; cada familia recibe **su propio link** y paga su parte directamente al anfitrión. Pagos a **nivel atleta/familia**. La escuela **no es parte financiera**.
- **`flexible`** (opcional): el anfitrión habilita ambos y cada delegación decide.

**Torneos internos de la escuela:** por defecto `parent_pays` **hacia la propia escuela** → reusa el cobro escuela→familia existente (`payments`/recurring), no marketplace.

### 7.2 Mecánica
- Multi-método en ambos modos — **pasarela** (SportMaps Pay), **efectivo**, **transferencia** (con `proof_url` + validación manual, patrón "Validación de Cobros" de `project_qr_inscripcion_flow`).
- `school_pays` → `event_delegation_payments` (nivel delegación).
- `parent_pays` → pago **por integrante/familia**: `event_delegation_payments` + `team_member_id` + `payer_profile_id`; se genera un link por familia y el anfitrión ve el estado de pago atleta por atleta.
- Soporta **depósito parcial** (`event_price_phases.deposit_percent`) y abonos sucesivos hasta cubrir `total_owed` (usa la config de installments de `school_settings`).

### 7.3 Contabilidad (`project_accounting_module`, multi-owner)
- `school_pays` externo: **egreso** para la escuela participante + **ingreso** para el anfitrión.
- `parent_pays` externo: **ingreso** para el anfitrión desde cada familia; la escuela participante no registra movimiento.
- Interno con `parent_pays`: **ingreso** para la escuela anfitriona (es también su propia escuela).

## 8. Gestión del anfitrión (organizador o escuela)

Panel del torneo con:
- **Estado por invitado** siguiendo el embudo (`event_invitations.status`): quién abrió, se registró, cargó datos, pagó, falta aprobar.
- **Aprobar / rechazar** delegaciones (pipeline `event_delegations` ya existe) con motivo.
- **Reenviar / revocar** link de invitación.
- Todo cuelga del mismo `event_id` (delegación + roster + documentos + pagos + resultados) → **una sola vista conectada**.

## 9. Enganche con tablas existentes

| Pieza | Tabla / recurso |
|---|---|
| Torneo | `events` (owner por `creator_role`+`school_id`/`organizer_id`) |
| Invitación | `event_invitations` (nueva) + `events.invited_schools[]` |
| Categorías/requisitos | `event_categories_config` |
| Precios/fases | `event_price_phases` |
| Delegación | `event_delegations` |
| Equipos | `event_teams` |
| Atletas del roster | `event_team_members` (`profile_id`/`child_id` a existentes) |
| Documentos | Storage + refs en `event_team_members` |
| Modo de pago | `events.payer_mode` (`school`/`parent`/`flexible`), override en `event_delegations` |
| Pagos | `event_delegation_payments` (multi-método; `+team_member_id`+`payer_profile_id` cuando `parent_pays`) |
| Cobro interno a familias | `payments` / recurring escuela→familia existente |
| Carga masiva | patrón `bff/src/routes/athletes/bulkUpload.ts` |
| Contabilidad | Módulo Contable multi-owner (ingreso/egreso) |
| Resultados | motor de scoring (`docs/tournaments-scoring-engine.md`) |
