# Torneos — Decisiones Cerradas + Modelo de Datos

> Estado: **decisiones cerradas** (diseño). 2026-07-13.
> Fundamento: benchmark de Smoothcomp (inscripción/pagos/reembolsos/waitlist), Elevien + ScoreKing + Gym Art (jueces/scoring), LiveMeet (pricing).
> Docs relacionados: `docs/tournaments-enrollment-flow.md` (Fase 1), `docs/tournaments-scoring-engine.md` (Fase 2).
> Convención de columnas nuevas: se versionan en migración nueva sobre el esquema real reconciliado en Fase 0. 🟢=tabla ya existe · 🔵=tabla nueva.

---

## D1 — Inscripción individual: **SÍ, con flag por evento**
Referencia: Smoothcomp — el atleta se registra solo pero **siempre asociado a una academia** (o "independiente" explícito); las escuelas hacen bulk.

- 🟢 `events` **+ `allow_individual_registration boolean DEFAULT false`** — el organizador lo decide por evento.
- 🟢 `event_registrations` **+ `club_school_id uuid NULL`** (FK schools) **+ `is_independent boolean DEFAULT false`** — regla: `club_school_id IS NOT NULL OR is_independent = true`.
- Convivencia: `event_registrations` (individual) y `event_delegations` (escuela) coexisten sin duplicar lógica; la aprobación y el pago son los mismos gates (D2).

## D2 — Quién paga: **`payer_mode` por torneo + pago como gate de aprobación**
Referencia: Gym Art (coach paga la delegación, payout Stripe al club) vs Smoothcomp (cada familia paga, y **un registro sin pagar no se aprueba ni entra al bracket/lista pública**).

- 🟢 `events` **+ `payer_mode text CHECK (payer_mode IN ('school','parent','flexible'))`** (override en `event_delegations.payer_mode`).
- 🟢 `events` **+ `payment_gates_approval boolean DEFAULT true`** — si true, `status=approved` requiere pago cubierto; sin pago → no bracket, no lista pública.
- `school_pays` → un pago nivel delegación (🟢 `event_delegation_payments`).
- `parent_pays` → pago por familia: 🟢 `event_delegation_payments` **+ `team_member_id uuid NULL` + `payer_profile_id uuid NULL`**; la delegación se marca pagada cuando todos completan.
- Detalle en `tournaments-enrollment-flow.md §7`.

## D3 — Depósito + abonos: **precio por período + depósito reserva cupo**
Referencia: Smoothcomp usa **precios por período** (early/regular/late), no depósitos; Gym Art automatiza late fees. Para delegaciones escolares (montos grandes) el depósito SÍ aplica.

- 🟢 `event_price_phases` ya cubre early/regular/late (`phase_name`, `valid_until`) y `deposit_percent`.
- 🟢 `event_delegations` **+ `balance_due_at date NULL`** — depósito reserva cupos → saldo con fecha límite → si no paga, cupos se liberan (o pasan a waitlist D6).
- Saldo en 1..N abonos: reusa la config de installments de `school_settings` (`allow_installments`, `max_installments_per_payment`, `min_installment_amount`).

## D4 — Reembolsos/retiro: **ventanas de reembolso + crédito**
Referencia: Smoothcomp — % de reembolso configurable por fecha, **múltiples ventanas**, "Athlete Correction Deadline" (100% hasta esa fecha, luego nada), reembolso en **cupón/crédito** en vez de dinero, y botón "cancelar evento y reembolsar a todos".

- 🔵 `event_refund_policies` — `id, event_id, refund_before date, refund_percent int, payout_mode text CHECK ('cash','credit'), sort_order`. Varias ventanas por evento (100%→50%→0%).
- 🟢 `events` **+ `correction_deadline date NULL`** — reembolso completo sin preguntas hasta esa fecha.
- 🔵 `event_credits` — `id, issuer_type ('organizer','school'), issuer_id, beneficiary_profile_id, amount, currency, source_event_id, expires_at, status ('active','used','expired')`. Crédito reutilizable en futuros eventos del mismo emisor. **Preferir crédito sobre devolución de dinero** (contabilidad más simple, retiene fondos en plataforma).
- Cancelación total del evento: acción del anfitrión que reembolsa a todos según `payout_mode` y cierra inscripciones.

## D5 — Rol Juez: **asignación por evento (no rol global) + captura PWA + publicación validada**
Referencia: Elevien (juez ingresa nota en pantalla enfocada, maneja jueces faltantes/tardíos, jueces remotos por video), Gym Art ("Judge's Companion" en su propio dispositivo), ScoreKing (tablets baratas + TV marcador).

- 🔵 `event_judges` — `id, event_id, profile_id NULL, invite_email, invite_token, role text CHECK ('judge','head_judge','supervisor'), assignment jsonb (aparato/categoría/panel), status ('invited','accepted','active'), created_at`. Invitación por email/link → no toca el modelo global de usuarios.
- 🔵 `tournament_judge_scores` (ya en scoring doc) — captura por juez/componente desde el celular (PWA, sin app nativa).
- 🔵 `tournament_standings` **+ `status text CHECK ('draft','published')` + `published_at`** — el `head_judge`/`supervisor` valida antes de publicar; nada público hasta `published`.

## D6 — Lista de espera: **FIFO con notificación**
Referencia: Smoothcomp — botón "Join Waitlist" cuando está sold-out; el organizador cierra registro al llegar a `capacity`.

- 🔵 `event_waitlist` — `id, event_id, category_id NULL, registrant_ref (delegation/registration), position int, status ('waiting','offered','expired','converted'), offered_at, expires_at, created_at`. Orden FIFO; al liberarse cupo se ofrece al siguiente y se notifica.

## D7 — Categoría sin mínimo: **decisión MANUAL del organizador**
Referencia: práctica común — garantizar ≥1 combate; 1 solo competidor → exhibición sin puntos; 2 → mejor de 3; atleta solo puede pedir reembolso.

- 🟢 `event_categories_config` **+ `min_not_met_action text NULL CHECK ('merge','exhibition','refund','proceed')`** — el organizador la fija a mano (no automática); `team_min`/`min_athletes` ya existen para detectar el caso.

## D8 — Estados de resultado: **DNS/DNF/DQ explícitos, nunca puntaje 0**
Referencia: Smoothcomp marca "no show" en resultados oficiales.

- 🔵 en la unidad de participación/resultado: **`result_status text CHECK ('scored','DNS','DNF','DQ','exhibition') DEFAULT 'scored'`** (en `tournament_standings` y/o registro de participación por competidor). "exhibition" no puntúa para ranking.

## D9 — Menores y documentos: **checklist configurable por evento + tipo de participante**
Referencia: organizadores en Smoothcomp exigen permiso de padres descargable, seguro que mencione el deporte, certificado médico — como checklist.

- 🔵 `event_document_requirements` — `id, event_id, participant_type text ('athlete','coach','minor','companion'), doc_key, label, is_required boolean, created_at`. El wizard de inscripción (Fase 1 §5.3) arma el checklist dinámico desde aquí; documentos suben a Storage con refs en `event_team_members`.

---

## Resumen de cambios al modelo

**Columnas nuevas en tablas existentes (🟢):**
- `events`: `allow_individual_registration`, `payer_mode`, `payment_gates_approval`, `correction_deadline`
- `event_registrations`: `club_school_id`, `is_independent`
- `event_delegations`: `payer_mode` (override), `balance_due_at`
- `event_delegation_payments`: `team_member_id`, `payer_profile_id`
- `event_categories_config`: `min_not_met_action`, `scoring_format_id` (de scoring doc)
- `tournament_standings`: `status`, `published_at`, `result_status`

**Tablas nuevas (🔵):**
- `event_invitations` (embudo de invitación — Fase 1)
- `event_refund_policies`, `event_credits`
- `event_judges`
- `event_waitlist`
- `event_document_requirements`
- `scoring_rulesets`, `scoring_formats`, `tournament_judge_scores`, `tournament_standings` (de scoring doc)

**Dato de mercado (LiveMeet/Sportzsoft):** pricing $75/meet + 2.5% de inscripciones — referencia por si algún día se cobra por torneo en vez de (o además de) el addon `tournaments`.
