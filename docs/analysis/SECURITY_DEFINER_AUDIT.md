# SportMaps — Auditoría de funciones SECURITY DEFINER expuestas a `anon`

**Fecha:** 2026-05-11
**Fase:** 3 del [plan de remediación del linter](SUPABASE_LINTER_REMEDIATION_PLAN.md)
**Estado:** documento de análisis. No ataca nada todavía — agrupa por categoría con recomendación caso por caso.

---

## Resumen ejecutivo

El linter reportó decenas de funciones `SECURITY DEFINER` callable por `anon`. La query directa contra `pg_proc` confirmó **~180 funciones** en `public` con `prosecdef = true` y `EXECUTE` para `anon`.

La gran mayoría **no debería estar expuesta a `anon`**: o son helpers internos (RLS/triggers), o son RPCs que ya validan internamente que `auth.uid()` exista. El permiso para `anon` es heredado del default `GRANT EXECUTE ... TO PUBLIC` que Postgres aplica a todas las funciones nuevas — nadie lo revocó.

**Métricas:**
- ~180 funciones a tratar.
- Categorizadas en **6 grupos** según el tratamiento que requieren.
- 1 PR por grupo (excepto Grupo A y E, que se pueden combinar).
- **Cero cambios de lógica** — solo `REVOKE EXECUTE`.

---

## Cómo decidir caso por caso

Para cada función, el principio es:

1. **¿Hay flujo `anon` legítimo que la llame?** (página pública sin login, página con token)
   - Si **sí** → mantener `EXECUTE TO anon`, documentar con `COMMENT`.
   - Si **no** → revocar `anon` siempre.
2. **¿Hay flujo `authenticated` real desde el cliente (frontend)?**
   - Si **sí** → mantener `EXECUTE TO authenticated`.
   - Si **no** (solo BFF con service_role, o sólo invocada por otra función/trigger) → revocar también `authenticated`.

`service_role` **nunca** se revoca: el BFF la usa para todo lo administrativo.

---

## Grupo A — Helpers internos / Triggers (REVOKE total)

**Características:** funciones que solo se invocan desde otras funciones o triggers. **Nadie en frontend/BFF las llama directamente.** No tienen razón de estar en `/rest/v1/rpc/*`.

| Función | Tipo | Por qué REVOKE |
|---|---|---|
| `is_school_admin`, `is_school_coach`, `is_school_owner`, `is_school_member`, `is_school_general_admin` | Helper de RLS | Se usan en `USING` clauses de policies. No deben exponerse vía RPC. |
| `is_branch_admin`, `is_personal_trainer`, `is_platform_admin`, `is_admin`, `is_super_admin`, `is_parent_of_child`, `is_demo_user` | Helper de RLS | idem |
| `check_is_branch_admin`, `check_is_school_admin*`, `check_is_school_member*` | Helper de RLS | idem (versiones `_safe` son las que evitan recursion) |
| `coach_school_ids`, `coach_team_ids`, `school_member_profile_ids` | Helper de RLS | Devuelven arrays de IDs usados en policies |
| `get_user_admin_school_ids`, `get_user_school_ids`, `get_my_administered_school_ids` | Helper de RLS | idem |
| `fn_is_admin_of_school`, `get_single_branch_id`, `get_personal_trainer_school_id`, `get_trainer_athlete_ids` | Helper interno | Llamado desde otras funciones |
| `has_role`, `has_school_role` | Helper de auth | Lo llama código, pero vía service_role/internal |
| `handle_new_user`, `handle_new_school`, `handle_updated_at`, `handle_school_referral_on_create` | Trigger fn | Triggers `AFTER INSERT` en auth.users / schools |
| `audit_trigger_func`, `audit_health_data_access`, `audit_school_settings_changes` | Trigger fn | Auditoría — se disparan internamente |
| `auto_add_parent_to_school`, `auto_create_vendor_balance`, `auto_create_vendor_profile` | Trigger fn | idem |
| `fn_auto_create_main_branch`, `fn_auto_generate_sessions_on_availability` | Trigger fn | idem |
| `fn_log_payment_status_change`, `fn_notify_on_payment_created` | Trigger fn | idem |
| `fn_decrement_bookings_on_cancel`, `fn_deduct_sessions_on_finalize`, `fn_sync_*` | Trigger fn | idem |
| `set_review_verified_purchase`, `enforce_product_publish_gate` | Trigger fn | idem |
| `expire_school_referrals`, `fix_invitation_school_id` | Cron/utility | Lo llama service_role |
| `get_distance_km` | Helper SQL puro | Cálculo geo, no es RPC |
| `is_school_open_now` | Helper SQL | Lo llama search_schools, no es RPC directo |

**Migración propuesta:**
```sql
REVOKE EXECUTE ON FUNCTION public.is_school_admin(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_school_member(uuid, uuid) FROM anon, authenticated, public;
-- ... (uno por cada función del grupo)
```

**Riesgo:** bajo. Si alguna función de este grupo resulta ser llamada por el frontend (que no detecté), va a fallar con `42501`. Mitigación: aplicar primero en QA, monitorear logs por errores de permiso, y devolver `EXECUTE TO authenticated` para la función puntual si aparece el error.

---

## Grupo B — Endpoints públicos legítimos (mantener `anon`, documentar)

**Características:** páginas públicas o flujos por token donde `anon` realmente debe poder ejecutar.

| Función | Por qué `anon` es OK |
|---|---|
| `access_demo_link(p_token text)` | Demo link público con token aleatorio |
| `accept_invitation(uuid)`, `accept_invitation_pro(uuid)` | Aceptar invitación vía email — el invite_id es el token |
| `get_invitation_details(uuid)` | `RegisterPage` lo llama antes del login |
| `get_school_branding_by_invitation(text)` | `useInvitationBranding` para landing de invitación |
| `claim_child_for_parent(uuid, ...)`, `claim_member_for_plan(uuid, uuid, ...)` | Onboarding por link |
| `get_join_qr_public(text)`, `submit_qr_signup(...)` | `JoinSchoolPublicPage` (QR de escuela) |
| `get_team_join_info(uuid)`, `get_plan_join_info(uuid)` | Páginas públicas de team/plan |
| `get_public_program_slots(...)` | Página pública de programas |
| `search_schools(...)`, `schools_near_location(...)`, `search_marketplace(...)`, `search_explore_map(...)` | Buscadores públicos (frontend usa sin login) |
| `get_school_payment_info(uuid)` | Tiene comment: "solo si public_profile_enabled=true". Diseñado para anon |
| `verify_athlete_certificate_public(...)`, `verify_athlete_id_card_public(...)` | Verificación de certificados/carnets desde URL pública |

**Acción:** **mantener** `EXECUTE TO anon`, pero agregar `COMMENT ON FUNCTION ... IS '...'` explicando por qué. Eso silencia el linter en el sentido informativo (sigue siendo WARN, pero documentado).

> **Decisión separada:** estos casos **siguen siendo WARN del linter**. El linter no distingue "intentional anon" de "accidental anon". Hay 2 opciones:
> - **A:** aceptar los WARN para estas funciones específicas como "false positives documentados".
> - **B:** moverlas a un schema separado (`public_api`) y exponerlas solo desde ahí. Mucho más trabajo (requiere actualizar PostgREST config + cambiar todas las llamadas en el frontend).
>
> Recomendación: **A**. Los WARN restantes serán solo este grupo y se aceptan con doc.

---

## Grupo C — RPCs admin (REVOKE anon, mantener authenticated)

**Características:** lo llama solo el panel admin del frontend, autenticado. La función internamente verifica `is_platform_admin()` o equivalente.

| Función | Caller |
|---|---|
| `admin_activity_summary(...)` | `AdminActivityLogsPage` |
| `admin_list_schools_for_filter()` | `AdminActivityLogsPage` |
| `admin_list_users(...)` | `AdminPanelPage` |
| `admin_list_schools_global(...)` | `AdminPanelPage` |
| `admin_global_counts()` | `AdminPanelPage` |
| `admin_list_audit_logs(...)`, `admin_list_billing_events(...)`, `admin_list_event_telemetry(...)`, `admin_list_payments(...)`, `admin_list_analytics_events(...)` | Páginas admin (probablemente) |
| `admin_create_staff_direct(...)` | Admin tooling |
| `admin_generate_pending_payouts()` | `vendor-payouts.routes.ts` (BFF, service_role) — pero también está expuesta a authenticated. REVOKE de anon ok, debate authenticated. |
| `add_platform_admin(...)`, `revoke_platform_admin(...)` | Admin de plataforma — debería ser **service_role only** |
| `create_demo_link(...)` | Admin tooling |

**Migración propuesta:**
```sql
REVOKE EXECUTE ON FUNCTION public.admin_activity_summary(timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_users(text, text, integer, integer) FROM anon;
-- ...

-- Las super-sensibles a service_role only:
REVOKE EXECUTE ON FUNCTION public.add_platform_admin(text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.revoke_platform_admin(text) FROM anon, authenticated, public;
```

**Riesgo:** bajo. La función ya valida `is_platform_admin()` internamente — anon que la llame recibía error de autorización igual. Sólo se evita la llamada inútil.

---

## Grupo D — RPCs de usuario autenticado (REVOKE anon)

**Características:** lo llama el frontend autenticado con `auth.uid()`. La función internamente verifica ownership/role.

Categorizado por dominio:

### D.1 Settings / Profile
- `get_my_settings()`, `save_profile_settings(...)` (2 sobrecargas)
- `save_school_branding(...)`, `save_school_info(...)` (2 sobrecargas)
- `get_school_services(uuid)`
- `save_notification_preferences(jsonb)`, `save_privacy_preferences(jsonb)`

### D.2 Athlete dashboard
- `get_athlete_dashboard_stats()`, `get_athlete_enrollments()`
- `get_athlete_exercise_stats(...)` (2 sobrecargas), `get_child_exercise_stats(...)` (2)
- `get_athlete_stats(...)`, `get_athlete_payments(...)`, `get_athlete_payments_v2(...)`
- `submit_athlete_installment(...)`
- `my_athlete_certificates()`, `my_athlete_id_cards()`

### D.3 School admin / coach
- `get_school_dashboard_stats(...)`
- `get_school_athletes(...)` (2 sobrecargas), `list_school_athletes_for_card_issue(...)`
- `list_athlete_certificates(...)`, `list_athlete_id_cards(...)`
- `issue_athlete_certificate(...)`, `revoke_athlete_certificate(...)`
- `issue_athlete_id_card(...)`, `revoke_athlete_id_card(...)`
- `request_athlete_certificate(...)`, `set_certificate_pdf_url(...)`
- `list_school_join_qrs(...)`, `create_school_join_qr(...)`
- `create_invitation(...)` (2 sobrecargas), `invite_parent_to_school(...)`, `get_my_invitations()`
- `get_my_schools()`
- `mark_overdue_payments(uuid)`, `send_payment_reminders(uuid)`
- `get_athletes_without_payment(uuid)`
- `get_school_referrals()`, `create_school_referral(...)`, `process_referral_registration(...)`
- `next_unpaid_period(uuid)`, `period_payment_status(...)`, `register_qr_paid_conversion(uuid)`

### D.4 Enrollment / Booking
- `enroll_student(...)`, `process_enrollment_checkout(...)` (2 sobrecargas)
- `submit_enrollment(...)`, `submit_enrollment_v2(...)`
- `submit_facility_booking(...)`, `submit_facility_booking_v2(...)`
- `get_facility_availability(...)`, `get_available_slots(...)`
- `lock_delegation_price_phase(uuid)`, `calculate_delegation_balance(uuid)`, `prorate_delegation_payment(uuid)`

### D.5 Personal Trainer / sessions
- `fn_book_pt_session(...)`, `fn_cancel_pt_session(...)`, `fn_complete_session_plan(...)` (2)
- `fn_create_plan_from_routine(...)` (2)
- `fn_generate_pt_sessions(...)`, `fn_generate_sessions_for_offering(...)`, `fn_generate_sessions_from_offering_schedule(...)`
- `fn_sync_all_offering_sessions(...)`
- `increment_session_bookings(uuid)`, `decrement_session_bookings(uuid)`
- `get_pt_client_summary(uuid)`
- `provision_personal_trainer_workspace(...)`
- `close_cash_session(...)`, `get_cash_session_summary(uuid)`

### D.6 Vendor / Marketplace
- `enable_vendor_profile(...)`, `disable_vendor_profile()`
- `request_payout(numeric)`, `vendor_payout_summary()`
- `release_settlements_for_vendor(uuid)`, `release_settlements_all()`
- `validate_product_quality(uuid)`, `can_review_product(uuid)`
- `get_payment_providers_for_school(uuid)`, `get_payment_providers_for_vendor(uuid)`

### D.7 Favoritos / Onboarding
- `get_my_favorites()`, `toggle_favorite(uuid)` (no apareció en query pero sí en grep)
- `migrate_local_favorites(uuid[])`, `migrate_device_favorites(text)`
- `get_onboarding_status(...)` (2 sobrecargas)

### D.8 Notifications
- `notify_user(...)`, `send_notification(...)` — **revisar**: lo llama frontend Y BFF. Si solo BFF debería ser service_role. Si frontend, mantener authenticated.

**Migración propuesta (mismo patrón para todas):**
```sql
REVOKE EXECUTE ON FUNCTION public.<nombre>(<args>) FROM anon;
```

**Riesgo:** bajo. La función ya hace su propio check de `auth.uid()`. Anon llamando recibía error de autorización igual o resultado vacío.

---

## Grupo E — RPCs internas (REVOKE anon + authenticated, solo service_role)

**Características:** solo el BFF las llama (con service_role). Frontend nunca. Anon nunca. Authenticated nunca.

| Función | Caller único |
|---|---|
| `save_payment_token(...)` | BFF webhook MP/Wompi |
| `flag_payment_for_review(text, uuid, text)` | BFF webhook |
| `confirm_marketplace_payment(...)`, `confirm_order_payment(...)` (2), `confirm_session_booking_payment(...)` | BFF webhook |
| `split_order_payment(...)` | BFF webhook |
| `approve_refund(uuid)`, `complete_refund(...)`, `request_refund(...)` | BFF refund flow |
| `auto_finalize_stale_sessions()`, `refresh_session_health()`, `refresh_school_price_range()` | BFF cron jobs |
| `add_reservation_payment(...)` | BFF reservations |
| `is_user_payment_blocked(uuid)` | BFF wompi.service / admin-payments.routes |
| `recalc_product_review_aggregates(uuid)`, `recalc_vendor_review_aggregates(uuid)` | Triggers internas |
| `link_unregistered_to_profile(...)` | BFF attendance |
| `migrate_unregistered_athlete_to_profile(...)` | Llamada interna de `accept_invitation_pro` |
| `compute_settlements_for_order(uuid)` | BFF tras pago aprobado |
| `seed_abierto26_price_phases(uuid)`, `seed_cheer_allstar_categories(uuid)` | Seeds manuales de admin |
| `has_vendor_capability(uuid, text)` | BFF middleware (con service_role) |

**Migración propuesta:**
```sql
REVOKE EXECUTE ON FUNCTION public.save_payment_token(...) FROM anon, authenticated, public;
-- ...
```

**Riesgo:** medio. Si alguna de estas resulta ser llamada por el frontend autenticado (cosa que no debería pasar), la pantalla se rompe. Mitigación: revisar 1 por 1 antes de revocar a `authenticated`. Las que tengan dudas → quedan como Grupo D.

---

## Grupo F — Sin uso encontrado (DROP candidatos)

Funciones que no aparecen ni en frontend ni en BFF. Pueden ser legacy. **No DROPear sin confirmar** — pueden ser llamadas desde otras funciones de la BD.

| Función | Hipótesis |
|---|---|
| `fix_invitation_school_id()` | Migración one-off ya ejecutada |
| `enroll_student(...)` | Reemplazada por `submit_enrollment*`? |

**Acción:** dejar para una pasada posterior. Buscar referencias dentro de pg_proc con:
```sql
SELECT proname FROM pg_proc
 WHERE prosrc ILIKE '%fix_invitation_school_id%'
    OR prosrc ILIKE '%enroll_student(%';
```

---

## Plan de ejecución sugerido

| PR | Grupo | Funciones | Riesgo |
|---|---|---|---|
| **3a** | Grupo A | ~50 helpers/triggers — REVOKE total | Bajo |
| **3b** | Grupo C | ~10 admin_* — REVOKE anon | Bajo |
| **3c** | Grupo E | ~20 BFF-only — REVOKE anon + authenticated | Medio |
| **3d** | Grupo D.1+D.2 | Settings + Athlete dashboard — REVOKE anon | Bajo |
| **3e** | Grupo D.3 | School admin — REVOKE anon | Bajo |
| **3f** | Grupo D.4+D.5 | Enrollment + sessions — REVOKE anon | Bajo |
| **3g** | Grupo D.6+D.7 | Vendor + favoritos — REVOKE anon | Bajo |
| **3h** | Grupo B | ~15 públicas — agregar COMMENT, no REVOKE | Cero |

Total: 8 PRs. Cada uno chico, fácil de testear.

**Aceptación:** después de 3a–3h, el linter debe quedar solo con ~15 warnings (Grupo B documentados). El usuario decide si los acepta como false positives o invierte en mover esas 15 a otro schema.

---

## Template de migración

Para cualquier PR (3a en adelante):

```sql
-- ============================================================
-- SPORTMAPS — Linter Fase 3<X> (<grupo>)
-- REVOKE EXECUTE de funciones que no deben estar expuestas a <anon|public>.
--
-- Justificacion por funcion en docs/analysis/SECURITY_DEFINER_AUDIT.md
-- ============================================================

DO $$
DECLARE
    r record;
    v_targets text[] := ARRAY[
        'is_school_admin',
        'is_school_member',
        -- ...
    ];
    v_roles text := '<anon|anon, authenticated|anon, authenticated, public>';
BEGIN
    FOR r IN
        SELECT n.nspname AS schema_name,
               p.proname AS fn_name,
               pg_get_function_identity_arguments(p.oid) AS args
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = ANY (v_targets)
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM %s',
            r.schema_name, r.fn_name, r.args, v_roles
        );
        RAISE NOTICE 'REVOKE en %.%(%) de %', r.schema_name, r.fn_name, r.args, v_roles;
    END LOOP;
END $$;
```

Cubre sobrecargas automáticamente (igual que las migraciones de `search_path`).

---

## Limitaciones de esta auditoría

1. **El output de la query SQL llegó truncado** (~50k chars). Quedaron funciones sin clasificar fuera del rango. Para una pasada completa, correr la query con `LIMIT/OFFSET` o filtrar por inicial.
2. **No se inspeccionó el cuerpo de las funciones.** La clasificación se basó en nombre + caller en el código. Algunas podrían tener lógica que las clasifique distinto.
3. **No se chequeó si la función valida `auth.uid()` internamente.** Para las del Grupo D, asumimos que sí. Si alguna no, el REVOKE de anon es necesario por seguridad real, no solo cosmético.

Antes de cada PR concreto, recomiendo:
- Re-correr la query filtrada por las funciones del grupo.
- Leer el cuerpo de las funciones más sensibles.
- Aplicar primero en QA y monitorear logs por 24h antes de prod.
