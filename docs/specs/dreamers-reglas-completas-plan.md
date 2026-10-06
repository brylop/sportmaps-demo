# Dreamers — reglas de cobro, acceso y niveles completas (plan de construcción)

> Estado: **PLAN, pendiente de aprobación** · 2026-10-05 · Escuela piloto: Dreamers Gymnastics.
> Todo va detrás de flags por escuela o columnas nullable (NULL / default = comportamiento de hoy).
> Cero `school_id` en lógica: Dreamers se configura con datos (script con dry-run o panel admin).
> Specs base: `dreamers-niveles-por-horas-y-progresion.md`, `cobranza-vencidos-estados-y-alertas.md`,
> `dreamers-banco-de-horas-torniquete.md`.

## Decisiones ya tomadas (usuario, 2026-10-05)
- Mora de octubre: se aplica (regla día 5, gracia 0).
- Seguro $150.000 se cobra igual que la inscripción $120.000: automático en el alta.
- Bloqueo por mora en torniquete: se re-prende **al final**, tras el fix de comprobante pendiente.
- **Plan aprobado 2026-10-05** (6 fases, construir con agentes en paralelo).
- Dojo Fénix: poner su `registration_fee` en NULL **antes** del deploy de F-B (no cambia nada para ellos hasta hablarlo).
- Comprobante rechazado: bajo `pending_proof_counts_as_paid`, vuelve a contar como deuda (bloqueo + mora si ya pasó el vencimiento).
- Cargo por horas de más: vence 5 días después de confirmado.
- Alcance: cobros + niveles. F6 (horario por entrenador) se **difiere** a spec aparte
  (`school_availability` tiene 0 filas y no tiene `program_id`; no hay nada que migrar).

## Bugs encontrados en la planeación (se arreglan dentro de esto)
| # | Bug | Alcance hoy |
|---|---|---|
| B1 | `chargeRegistrationFeeIfApplicable` nunca funcionó: choca con `uniq_payment_active_period_*` (23505 silenciado), sin `parent_id`, solo corre si hay mensualidad | Todas — Dojo Fénix tiene fee 50.000 y 0 cobros |
| B2 | Índices únicos de adulto/no-registrado sin cláusula `period_uniqueness_exempt` | Todas |
| B3 | Pagar un cobro con `offering_plan_id` que no es mensualidad (inscripción, excedente) extiende `expires_at` como si fuera un mes | Todas (latente; ya pasa en `/facturar-fuera-de-plan`) |
| B4 | `cancelPendingPlanPayments` y `students.ts:1222/1239/1252` anulan/re-precian TODO cobro pendiente del plan (incluiría inscripción/seguro) | Todas (latente) |
| B5 | Formulario de resultados de competencia manda `preparatorio`/`competencia_oficial`, el CHECK vivo no los acepta → 500 | Todas |
| B6 | Alta de atleta: enrollment + cobros como inserts sueltos, sin transacción | Todas |
| B7 | `/facturar-fuera-de-plan`: dedupe SELECT→INSERT con carrera (doble clic = doble cobro) | Todas |

## Fases (una rama por fase, revisión entre cada una)

### F-A · Base de cobros compartida (migración M0) — primero, todo lo demás depende
- Recrear `uniq_payment_active_period_per_adult` / `_per_unreg` con `AND NOT period_uniqueness_exempt` (B2). Solo afloja.
- `payment_category` CHECK += `'seguro'`, `'excedente'`.
- `fn_extend_enrollment_on_payment_paid` y `open_month`: ignorar categorías `inscripcion|seguro|excedente` (B3). Hoy hay 0 filas así → no-op para el resto.
- Filtro de categoría en `cancelPendingPlanPayments` y `students.ts:1222/1239/1252` (B4).

### F-B · Inscripción + Seguro (W2)
- `offering_plans.insurance_fee numeric NULL` (espejo de `registration_fee`).
- RPC `emit_enrollment_fees(...)` SECURITY DEFINER, solo `service_role`: 0–2 filas `one_time`, exentas de unicidad, con `parent_id`; seguro con dedupe 365 días.
- Se llama independiente de la mensualidad en los 4 ramales de `students-create-one` y en `POST enrollments.ts:573`. Cambio de plan **no** cobra (D18). QR signup: fase posterior (Dreamers tiene 0 QR).
- `due_date` de inscripción/seguro = el del alta (nunca el 1 del mes siguiente: haría que `open_month` saltara la mensualidad).
- UI: campo Seguro en el editor de plan, líneas en el resumen del alta, categoría `seguro` en contabilidad/CSV/validador.
- Datos Dreamers (script `--dry-run`): 23 planes PG* → 120.000 / 150.000. Excluye CPP1x1/CPG1x2 (clases sueltas). Desactivar planes sueltos "Inscripcion", "Seguro de accidentes", "Banco de Horas — TEST" (0 inscripciones, 0 pagos verificados).

### F-C · Alta a mitad de mes por clases restantes (W3 / F7) — sobre F-B
- `enrollments.first_payment_mode` text CHECK (`full_month|remaining_classes`), NULL = hoy.
- `school_settings.remaining_classes_billing_enabled` default false.
- RPC transaccional `create_enrollment_with_payments` (enrollment + N cobros, 409 `periodo_ocupado`) → cierra B6. Incluye las filas de F-B.
- Fórmula solo en BFF (`utils/remainingClasses.ts`): `clases × precio ÷ clases_del_periodo`; clases del periodo = minutos ÷ bloque si da entero, si no `max_sessions`, si no no se ofrece.
- Endpoint `POST /students/first-payment-preview`; UI en `CreateChildModal`/`CreateAdultAthleteModal` sin fórmula en frontend.
- Test espejo de `prorationUtils` (BFF vs frontend), documentando la divergencia existente C-06.

### F-D · Cobranza: sin cancelación automática + comprobante pendiente (W1)
- `school_settings.auto_cancel_overdue_enabled` default **true**; `pending_proof_counts_as_paid` default false.
- Helpers `enrollment_has_pending_proof` (status `awaiting_approval|glosado`), solo `service_role`.
- Nueva versión de `fn_expire_overdue_enrollments` (base: `20260910082720`) respetando ambos flags.
- `access-adms.ts:364` (`enrollment_expired`): con el flag, comprobante pendiente = deja pasar.
- Comprobante **rechazado** vuelve a contar como deuda bajo el flag (hueco C) — ver decisión 2.
- Datos Dreamers: `auto_cancel_overdue_enabled=false`, `pending_proof_counts_as_paid=true`.
- **Último paso de todo el plan:** `access_auto_block_overdue_enabled=true` para Dreamers, tras deploy.

### F-E · Cargo por horas de más (W4 / F5)
- `school_settings.hour_bank_overage_charges_enabled` default false.
- Tabla `hour_bank_overage_charges` (UNIQUE `period_id`, status text CHECK `suggested|confirmed|dismissed`), RLS solo lectura para `user_admin_school_ids()`, escrituras por BFF/RPC.
- Cron diario genera sugerencias al cerrar periodo (salta periodos con visitas `open`/`pending_review`). RPC `confirm_hour_bank_overage` con `FOR UPDATE` crea el cobro (`excedente`, sin `offering_plan_id`, exento de unicidad).
- Monto: `precio ÷ horas_incluidas × horas_extra`; `hour_up` aplica solo al total del excedente.
- UI en `HourBankSchoolSection`: confirmar / descartar (solo owner).
- De paso: cerrar B7 con índice único / RPC.

### F-F · Niveles: días permitidos + ascenso (W5)
- B5: CHECK de `result_type` = unión de ambos catálogos (solo amplía).
- `competition_results.points`, `competition_level`; `offering_plans.promotion_threshold_points`, `promotion_min_competition_level`, `allowed_days_of_week int[]`; `school_settings.level_progression_enabled` default false; `access_events.policy_warning`.
- RPC de elegibilidad (solo resultados cargados por staff), aviso al owner, pestaña de elegibilidad, cambio de plan **sugerido, nunca automático** (D4).
- Días: rechazo 422 en las 3 entradas de reserva + días grises en la UI. Torniquete: **solo registra y avisa** (el F22 decide local; no usar `disable_user` por día).

## Orden y ejecución
1. Agentes en paralelo por worktree, cada uno en su rama: **F-A+F-B+F-C** (mismo archivo caliente, un solo agente, en ese orden) · **F-D** · **F-E** · **F-F**.
2. Los agentes **no aplican migraciones** a la base (única base compartida dev/stg/prod). Las aplico yo, una por una, con medición de radio antes y `npm run seguridad:invariantes` después.
3. Merge a `develop` con `--no-ff`, commits solo de lo propio, un solo push agrupado.
4. Datos de Dreamers por script con `--dry-run` primero.
5. Re-prender bloqueo por mora.

## Datos que siguen faltando de Dreamers (no bloquean construir)
- Horas de 8 planes sin minutos + PGR6x2 (720 min / bloque 180 = 4,5 clases vs `max_sessions` 6).
- Días permitidos y puntaje de ascenso por nivel; qué plan es qué nivel USAG.
- ¿PGP4x1 con inscripción 0 es a propósito?
