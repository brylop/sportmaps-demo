# SportMaps — Roadmap Maestro Unificado

**Alcance:** Web + Mobile (iOS/Android) + SaaS multi-cuenta + Rediseño UX + WhatsApp AI Channel + White-label schools + **Marketplace & Vendor SaaS**
**Versión:** 1.3
**Fecha:** 2026-05-12
**Duración estimada:** ~30 semanas calendario · ~95 días-dev (con Marketplace + WhatsApp AI Channel)

> **Changelog v1.3 (2026-05-12)**
> - Añadido **BLOQUE M — Marketplace & Vendor SaaS** (no contemplado en v1.2). Cubre venta de productos y servicios por coaches/schools/external_vendors con catálogo rico, reviews, payouts, shipping y moderación admin.
> - Estado: M1-M7 ✓ entregados entre abril-mayo 2026. M8 (planes vendor) es el siguiente foco.
> - Etapa G (Payments BFF fase 1) marcada como entregada en gran parte (Wompi + MP + refunds + idempotencia ya en producción).

---

## Principios rectores (no negociables)

1. **Colores no se tocan** — paleta actual se preserva en todo el proyecto.
2. **Aditivo** — código viejo vive hasta el cutover final; nada se rompe.
3. **Feature flags en cada capa nueva** — rollback instantáneo disponible.
4. **Nadie pierde acceso al desplegar** — trial 30 dias para todos al arrancar SaaS.
5. **Athletes y parents siempre gratis** — son consumidores puros, no pagan.
6. **Trial 30 dias solo para roles de servicio** — school, coach_personal, vendor, organizer, wellness_professional, store_owner.
7. **Tiers internos** `free | pro | enterprise` (inamovible en codigo/DB). Display comercial en `saas-plans.ts`.
8. **Split de cobros** — matriculas/clases/productos -> Wompi/Epayco. Suscripcion SaaS -> solo desde web. Cero IAP.
9. **Un PR por etapa** con plan de rollback documentado.
10. **Modo audit antes de enforce** en todo gating nuevo.
11. **Entrega full-stack por feature** — cada feature se entrega DB+RLS+RPCs+BFF+API+Frontend+Auditoria+QA en un solo bloque, no migraciones sueltas.
12. **Privacidad de menores en bot AI** — toda respuesta automatica solo accede a datos del padre identificado via RLS por `parent_id` verificado por OTP. Sin verificacion -> solo info publica. El bot nunca ejecuta queries con service role en datos sensibles, y rechaza responder si no obtuvo datos de tool call exitoso (cero alucinaciones tolerables).
13. **Datos clinicos auditables e inmutables** — toda lectura/escritura de `health_records_v2`, `clinical_attachments`, `consent_documents`, `telehealth_sessions`, `appointment_soap_notes` queda registrada en `audit_log_clinical` con RULE NO UPDATE/DELETE (inmutable). Retencion 5 anos por Ley 23/1981 historia clinica Colombia. RLS column-level en `private_notes` + view `security_barrier` para vista paciente. Encriptacion `pgsodium` opcional tier enterprise.

---

## Secuencia macro

```
BLOQUE 1: FUNDAMENTOS (Sem 1-3)
  A. Red de seguridad
  B. Onboarding unificado
  C. DB multi-cuenta + SaaS
  C5. White-label schools (cierre de deuda)
  D. Entitlements (audit)
  O. School Capabilities (padres/atletas)

BLOQUE 2: CUENTAS + BILLING WEB (Sem 4-6)
  E. AccountContext + Switcher
  F. Billing Hub
  J. Quick wins UX (paralelo)

BLOQUE 3: PAYMENTS ROBUSTOS (Sem 7-9)
  G. Payments BFF fase 1 (mutaciones)
  H. Gating audit -> soft
  I. Navigation dinamico

BLOQUE 4: MOBILE (Sem 10-15)
  N1. Capacitor wrapper
  N2. Features nativas
  N3. Tiendas (TestFlight + Play)
  N4. Offline asistencia (opcional)

BLOQUE 5: CIERRE (Sem 16-18)
  K. Rediseno layouts
  L. Payments BFF fase 2 (lecturas)
  M. Cutover SaaS enforce

BLOQUE 6: WHATSAPP AI CHANNEL (Sem 19-28)
  WA1. Tech Provider Meta + Onboarding embedded
  WA2. Bot Core (DeepSeek + 5 intents + identificacion OTP)
  WA3. Pagos via WhatsApp (link + recordatorios proactivos)
  WA4. Modo Auto + Inbox completo + Analytics
  WA5. V2 features (voz, multi-idioma, multi-sede)  [opcional]

BLOQUE M: MARKETPLACE & VENDOR SAAS (Sem 4-12, paralelo a Bloques 2-4)
  M1. ✓ Roles + capabilities (external_vendor, coach/school/personal_trainer venden)
  M2. ✓ Producto rico (categorias jerarquicas, brands, ProductWizard 4 pasos)
  M3. ✓ Reviews + Q&A (contexto deportivo, verified purchase)
  M4. ✓ Pagos vendor minimal (settlements + payouts + balance)
  M5. ✓ Logistica (10 carriers CO, Mock provider, ShippingSelector)
  M6. ✓ Cierre del ciclo de compra (auto-shipment + settlements en webhook)
  M7. ✓ Admin verification queue (vendor docs + signed URLs + notifs)
  M8. ◯ Planes vendor (Free / Pro / Elite) con gating  ← SIGUIENTE
  M9. ◯ Multi-vendor split en carrito
  M10. ◯ R6 Medios 3D/AR (model-viewer, 360, captura camara)
  M11. ◯ Mox shipping provider real (reemplazar Mock)
  M12. ◯ Email transaccional para vendors
```

---

## BLOQUE 1 — Fundamentos

### Etapa A — Red de seguridad y quick wins (Semana 1)

| # | Cambio | Archivo | Tiempo |
|---|---|---|---|
| A1 | `MessagesPage` sin `.limit()` | `frontend/src/pages/MessagesPage.tsx:44-48` | 5m |
| A2 | `security_audit_log` `WITH CHECK (user_id = auth.uid())` | migration nueva | 10m |
| A3 | **DIA 1 BLOQUEADOR** — Diagnostico `team_id` (script `docs/diagnostics/team_id_audit.sql`) + fix antes de cualquier otro cambio. Sin esto, el backfill de C3 produce datos basura. PRECEDE incluso a A11. | varios | 4h |
| A4 | Reemplazar `.select('*')` en payments/notifications/profiles | varios | 30m |
| A5 | Indice `messages(sender_id, recipient_id, created_at)` | migration | 15m |
| A6 | Indice `payments(school_id, status)` | migration | 15m |
| A7 | Rate-limit BFF mutaciones (100 req/min/IP) | `bff/src/app.ts` | 2h |
| A8 | Column-level RLS en `medical_info`, `phone` | migration | 1h |
| A9 | DTOs en BFF (dejar de filtrar en cliente) | rutas BFF | 1h |
| A10 | Realtime `payments`/`enrollments` | channels | 4h |
| A11 | `pg_dump` staging + baseline | `scripts/dump-baseline.sh` | 30m |
| A12 | Smoke tests manuales por rol | `docs/smoke-tests.md` | 1h |
| A13 | Matriz de rutas x rol | `docs/roles-matrix.md` | 1h |
| A14 | Inventario consumidores `profile.role` | `docs/role-readers.md` | 1h |
| A15 | `console.log` audit detras de `VITE_AUDIT_MODE` | `frontend/src/hooks/useSchoolContext.ts` | 30m |
| A16 | Limpieza de 3 enrollments duplicados activos al mismo team (`da64854c`, `8db1a28b`, `e19bfbe1`) — soft-cancel los mas antiguos, conservar el mas reciente. **Hallazgo del diagnostico 2026-04-27.** | migration | 20m |
| A17 | Revision manual del caso `f4402afa` — 3 enrollments cross-school con `team_id NULL` activo. Decidir si es legit (offering plan suelto en escuela B) o se cancela el huerfano. | analisis | 30m |
| A18 | Auditar 74 profiles `role='athlete'` sin `school_membership` activa — decidir si entran a C3 como cuentas zombie (`account_type='athlete'`, `linked_school_id=NULL`) o se marcan `status='inactive'`. **Diagnostico mostro que hay 84 profiles atletas pero solo ~10 tienen school_membership activa.** | criterio + migration | 1h |

**Ramas:** `feat/etapa-a-quick-wins`, `feat/etapa-a-bff-hardening`
**Riesgo:** Bajo

---

### Etapa B — Onboarding unificado (Semana 3)

| # | Cambio | Archivo |
|---|---|---|
| B1 | `<OnboardingWizard>` base full-screen | `components/onboarding/OnboardingWizard.tsx` |
| B2 | Catalogo steps atomicos (Basic, Service, Venue, Payments, PublicProfile, LinkChildren) | `components/onboarding/steps/*` |
| B3 | Ensambladores por rol | `components/onboarding/role-plans.ts` |
| B4 | Ruta `/onboarding/:role` + gate `ProtectedRoute` | `App.tsx`, `AuthContext.tsx` |
| B5 | Deprecar wizards viejos con flag | coexistencia |
| B6 | Step `PublicProfileOptIn` compartido | `steps/PublicProfileOptIn.tsx` |
| B7 | Migracion `public_profile_enabled` -> coach/vendor/wellness/organizer profiles | migration |
| B8 | RPC `get_public_profile_info(role, entity_id)` | migration |
| B9 | Re-prompt en Dashboard si perfil publico apagado | `DashboardPage.tsx` |
| B10 | `<OnboardingFab>` — progreso persistente | `components/onboarding/OnboardingFab.tsx` |

**Rama:** `feat/etapa-b-onboarding-unificado`
**Flag:** `VITE_FLAG_UNIFIED_ONBOARDING`
**Riesgo:** Medio (toca gate de auth)

---

### Etapa C — Modelo multi-cuenta + Tiers SaaS DB (Semana 2)

| # | Cambio |
|---|---|
| C1 | Tabla `user_accounts` (user_id, account_type, linked_school_id, linked_membership_id, role, status, metadata) |
| C2 | Tabla `saas_subscriptions` (account_id, tier, status, trial_ends_at, period, provider, wompi_subscription_id) |
| C3a | Backfill `user_accounts` MULTI-FUENTE: lee 3 fuentes — (1) `profiles + school_members` activos (cuentas reales con escuela), (2) `profiles WHERE role='athlete' AND sin school_membership` (~74 cuentas zombie, entran como `account_type='athlete'` con `linked_school_id=NULL`), (3) `profiles WHERE role='parent'` (35 padres). **NO crea cuenta para menores en `children` (334 registros)** — viven bajo la cuenta del padre via `parent_id`. |
| C3b | EXCLUIR `unregistered_athletes` (89 registros, 100% sin vincular) del backfill. Sin `user_id` no pueden tener `user_account`. Cuando un admin los vincule (`linked_profile_id IS NOT NULL`), entran via trigger normal de C5. |
| C3c | Reentrancia: `ON CONFLICT DO NOTHING` por clave natural `(user_id, account_type, linked_school_id)`, columna `migrated_at` para resumir tras fallo. Tabla auxiliar `migration_decisions(source_table, source_id, decision, reason, ts)` para auditoria del backfill. |
| C3d | Dry-run obligatorio en staging clonado antes de prod. Validacion esperada: `total user_accounts = count(profiles+sm activos) + 74 zombies + 35 parents`. Reporte de discrepancias en `docs/diagnostics/c3_backfill_dryrun.md`. |
| C4 | Seed `saas_subscriptions` — service roles -> pro trial 30d, athlete/parent -> free sin trial |
| C5 | Trigger `AFTER INSERT ON user_accounts` auto-subscribe service roles |
| C6 | RLS (user solo ve sus cuentas) |
| C7 | Regenerar `types.ts` |

**Rama:** `feat/etapa-c-multi-account-db`
**Riesgo:** Bajo (aditivo puro)
**Rollback:** `DROP TABLE user_accounts, saas_subscriptions CASCADE`

---

### Etapa C.5 — White-label de schools (cierre de deuda, Semana 2-3)

**Problema:** La migracion `20260307000001_branding_settings.sql` (marzo 2026) ya implemento `schools.branding_settings` JSONB + bucket `school-assets` + RPC `get_school_branding_by_invitation` + `<BrandingSettingsForm>` + `useBranding()`. Pero el branding **nunca se aplica** porque [ThemeContext.tsx:79-80](frontend/src/contexts/ThemeContext.tsx#L79) tiene un override hardcoded a la paleta SportMaps marcado "Temporarily overridden". El flag `show_sportmaps_watermark` se guarda pero el componente que lo respete no existe. RLS deja al admin de escuela tocar `bank_account_number` al actualizar branding. Permiso `white_label.manage` no existe formalmente.

**Decision de modelo:** white-label se ancla a `schools` como tenant canonico (ya tiene infra). `wellness_professional_profiles` (W4.16) reusa el mismo `branding_settings` pattern cuando llegue Bloque 7. Custom domains queda como sub-fase opcional gateada por `enterprise` post-Etapa D.

**Tier matrix** (ratifica [linea 973](docs/ROADMAP.md#L973)): `free`=watermark forzado, sin edicion · `pro`=colors+logo+watermark on · `enterprise`=+favicon+fonts+watermark off+custom domain+email templates.

| # | Cambio | Archivo | Tiempo |
|---|---|---|---|
| C5.1 | **BUG CRITICO** — quitar override `DEFAULT_BRANDING` y aplicar `schoolBranding` real. Validar con escuelas con `branding_settings` poblado en staging antes de mergear. | `frontend/src/contexts/ThemeContext.tsx:79-80` | 1h |
| C5.2 | Migracion `<ts>_white_label_extension.sql` — `ALTER schools ADD favicon_url TEXT, white_label_enabled_at TIMESTAMPTZ`. Extender JSONB default con `accent_color`, `font_family`, `email_templates`. CHECK constraint regex hex `^#[0-9A-Fa-f]{6}$` en colores. | migration | 1h |
| C5.3 | Migracion `branding_audit_log(id, school_id, changed_by, changes jsonb, created_at)` + trigger `AFTER UPDATE ON schools` cuando cambia `branding_settings` o `logo_url`. Cumple principio rector #11 (full-stack incluye auditoria). | misma migracion | 1h |
| C5.4 | RPC `update_school_branding(p_school_id uuid, p_payload jsonb)` SECURITY DEFINER — restringe UPDATE a columnas branding-only para tapar el escape RLS que hoy permite tocar `bank_account_number` desde el cliente. | misma migracion | 1h |
| C5.5 | Drop policy `school_admin_update_branding` permisiva; reemplazar por policy que solo permita UPDATE via la RPC C5.4 (revoke directo desde authenticated). | misma migracion | 30m |
| C5.6 | Cambiar convencion path bucket `school-assets` de `logos/{school_id}/{filename}` a `logos/{school_id}/{random_token}/{filename}` para evitar enumeracion por UUID. Migrar paths existentes con script idempotente. | migration + script | 2h |
| C5.7 | Permiso `white_label.manage` en BFF: agregar a [authMiddleware.ts:54-128](bff/src/middlewares/authMiddleware.ts#L54) matriz `rolePermissions` para `owner`, `admin`, `school_admin`. Acciones atomicas: `colors.update`, `logo.update`, `favicon.update`, `fonts.update`, `watermark.toggle`, `domain.configure`, `email_templates.update`, `preview`. | `bff/src/middlewares/authMiddleware.ts` | 1h |
| C5.8 | Middleware `requireWhiteLabel(action)` con stub de tier (devuelve 'enterprise' siempre hasta D3 reemplace por `useEntitlements`/`entitlementsRepo`). Compone `requireRole + requirePermission + tier-gate`. | `bff/src/middlewares/requireWhiteLabel.ts` | 2h |
| C5.9 | Endpoints granulares — `PATCH /api/v1/schools/:id/branding/colors`, `/logo`, `/favicon`, `/fonts`, `/watermark`. Cada uno usa `requireWhiteLabel('<action>')`. Validador Zod con regex hex y whitelist de fonts. | `bff/src/routes/schools.ts`, `bff/src/controllers/schools.ts` | 4h |
| C5.10 | Componente `<SportMapsWatermark/>` — respeta flag `show_sportmaps_watermark`. Montar en footer global, login, signup, PDFs (athlete-id-card, certificates), emails transaccionales. Hoy el flag se guarda pero nunca se renderiza. | `frontend/src/components/SportMapsWatermark.tsx` + 5 callsites | 3h |
| C5.11 | Hook `useWhiteLabel()` con stub — `{ canManage, canRemoveWatermark, canCustomDomain, canCustomFonts }`. Lee tier desde stub `useEntitlements()` (devuelve 'enterprise' hasta D3). | `frontend/src/hooks/useWhiteLabel.ts` | 1h |
| C5.12 | Wrap `<BrandingSettingsForm>` con `<TierGate>` placeholder + banner "Upgrade to enable" para campos enterprise. Memoizar `hexToHsl()` en `ThemeContext` por `JSON.stringify(branding_settings)` para evitar recomputo en cada render. | `frontend/src/components/settings/BrandingSettingsForm.tsx`, `frontend/src/contexts/ThemeContext.tsx` | 2h |
| C5.13 | Manifest PWA dinamico — endpoint BFF `GET /api/v1/manifest.webmanifest?school=<slug>` que genera manifest con `theme_color` + `icons` per-tenant. Reemplazar manifest estatico de [vite.config.ts:49-76](frontend/vite.config.ts#L49). | `bff/src/routes/manifest.ts`, `frontend/index.html` | 3h |
| C5.14 | Reconciliar drift TS↔DB enum — el Request type de [authMiddleware.ts:18-20](bff/src/middlewares/authMiddleware.ts#L18) acepta valores que no estan en `member_role` enum. Regenerar tipos via `supabase gen types typescript` y bloquear PRs si TS y DB difieren (lint check). | `bff/src/types/`, CI | 1h |
| C5.15 | Tests integration matriz `rol x tier x accion` (11 casos en `docs/c5-test-matrix.md`): `pro+colors=200`, `free+colors=402`, `coach+colors=403`, `cross-tenant=403`, `hex-invalido=400`, `logo-3MB=413`, `mime-pdf=415`, `watermark-off-pro=402`, `watermark-off-enterprise=200`, `super_admin=200 bypass`, `anon-via-invitation-token=200`. | `bff/src/routes/__tests__/branding.spec.ts` | 4h |
| C5.16 | (Opcional, sub-fase enterprise post-D) tabla `school_custom_domains(school_id, domain UNIQUE, verified_at, ssl_status)` + verificacion DNS TXT + wildcard CNAME en Vercel. Aprovecha `schools.slug` ya existente para subdominio gratis `<slug>.sportmaps.app`. | migration + middleware host | 1d |

**Rama:** `feat/etapa-c5-white-label-schools`
**Flag:** `VITE_FLAG_WHITE_LABEL_SCHOOLS` (default `false`; activa C5.1 + C5.10 + C5.12 — el resto es backend y va siempre)
**Riesgo:** Medio — C5.1 puede provocar regresion visual en escuelas con `branding_settings` mal poblado; C5.5/C5.6 cambian RLS y storage paths, requieren rollback plan claro.
**Rollback:** revertir override en ThemeContext (1 commit), drop columnas nuevas, restaurar policy permisiva. C5.6 requiere migrar paths de vuelta — guardar mapeo `old_path -> new_path` en `migration_decisions` para reversibilidad.
**Dependencias:** ninguna estricta. Etapa D reemplaza el stub de tier en C5.8/C5.11. C5.16 espera a que `saas_subscriptions` (C2) este poblado.
**Cross-link:** [W4.16](docs/ROADMAP.md#L851) (branding wellness pros) reusa este modelo — cuando llegue Bloque 7, extender con `branding_settings` en `wellness_professional_profiles` aplicando el mismo patron RPC + audit log + tier gate.

---

### Etapa D — Entitlements catalog (modo audit, Semana 2)

| # | Cambio |
|---|---|
| D1 | `config/saas-plans.ts` — 7 roles x 3 tiers con display names por rol |
| D2 | `config/feature-modules.ts` — mapa ruta -> feature_key |
| D3 | Hook `useEntitlements()` — tier, canAccess, requiresUpgrade, isInTrial, trialEndsAt |
| D4 | `<ModuleGate feature="..." auditOnly>` — logea solo, no bloquea |
| D5 | Tabla `gating_events(id, user_id, account_id, feature_key, would_block, source, ts, metadata jsonb)` — sink concreto para los logs de audit. Sin esto, M1 ("revisar logs 2 semanas para calibrar") es imposible. |

**Rama:** `feat/etapa-d-entitlements-audit`
**Flag:** `VITE_FLAG_ENTITLEMENTS`
**Riesgo:** Cero (nada bloquea)

---

### Etapa O — School Capabilities: padres/atletas (Semana 2-3, paralelizable)

**Problema:** Hoy `schools.school_type` (default `'academy'`) condiciona poco la UI. El sidebar siempre dice "Estudiantes", `FinancesPage.tsx:227,289` hardcodea columna "Padre", y no hay forma de modelar escuelas hibridas (academia + atletas adultos). El caso hibrido se va a dar en MMA, crossfit, natacion, gym.

**Datos validados (2026-04-27):** En staging hoy hay 0 escuelas hibridas reales. Las 3 detectadas (`1b5492d1` ACADEMIA BOGOTA MMA, `90b2cc2e` MMA BLAIR TEAM, `773a4c06` ACADEMIA SUPERIOR BOGOTA) son data de prueba. **Cero clientes reales se enteran del cambio si el backfill clasifica bien.**

**Decision de modelo:** dos booleans en `schools` (`manages_minors`, `manages_adults`) en vez de enum con `'hybrid'`. Razon: el caso hibrido es totalmente esperable y un boolean por capacidad es mas expresivo que un enum cerrado. Tradeoff aceptado: onboarding pregunta explicitamente por capacidades en vez de elegir un tipo.

| # | Cambio | Archivo | Tiempo |
|---|---|---|---|
| O1 | Migracion `ALTER TABLE schools ADD COLUMN manages_minors boolean NOT NULL DEFAULT true, ADD COLUMN manages_adults boolean NOT NULL DEFAULT false` | `supabase/migrations/<ts>_school_capabilities.sql` | 15m |
| O2 | Backfill en misma migracion: `UPDATE schools SET manages_minors=false, manages_adults=true WHERE school_type='personal_trainer'`. Resto queda con default (academia tradicional). | misma migracion | 5m |
| O3 | Hook `useSchoolCapabilities()` lee `schools(manages_minors, manages_adults)` de la escuela activa y devuelve `{ managesMinors, managesAdults, athleteLabel, payerLabel, showsPayerColumn }`. Cachea en `AccountContext`/`SchoolContext`. | `frontend/src/hooks/useSchoolCapabilities.ts` | 1h |
| O4 | Sidebar: reemplazar literal "Estudiantes" en `getNavigationByRole()` por funcion que toma capabilities (`Estudiantes` / `Atletas` / `Estudiantes y Atletas`) | `frontend/src/config/navigation.ts` | 30m |
| O5 | `FinancesPage` (lineas 227, 289) y Cuentas por Cobrar: oculta col "Padre" si `!managesMinors`, renderiza atleta como deudor cuando `payments.parent_id IS NULL` | `frontend/src/pages/FinancesPage.tsx`, componentes asociados | 2h |
| O6 | Auditar literales "Estudiante"/"Estudiantes"/"Padre" en frontend — reemplazar por hook (~15 paginas: `StudentsPage`, `TeamsPage`, `ReportsPage`, `ProgramsManagementPage`, `PaymentsAutomationPage`, `ParentCheckoutPage`, etc.) | varios | 3h |
| O7 | Componentes que asumen `payments.parent_id NOT NULL` — auditar y manejar `parent_id IS NULL` para atletas adultos (`RegisterCashPaymentModal`, listados, exports CSV) | varios | 2h |
| O8 | Onboarding: paso `<CapabilitiesStep>` con 2 checkboxes ("Manejas menores con padres responsables" / "Manejas atletas adultos directos"). Encaja en catalogo de steps de Etapa B (B2). | `components/onboarding/steps/CapabilitiesStep.tsx` | 2h |
| O9 | Templates email/WhatsApp con literal "tu estudiante" — auditar para escuelas adult-only (mostrar "tu atleta" o tono neutral). | `email/templates/*`, `payment_message_templates` | 1h |
| O10 | (Opcional, post-adopcion) deprecar `school_type` o restringirlo a categoria de marketplace. NO en este PR. | migration futura | 30m |

**Limpieza previa:** marcar las 3 escuelas de prueba (`1b5492d1`, `90b2cc2e`, `773a4c06`) como `is_demo=true` o eliminarlas para que no contaminen reportes — fuera del alcance de la migracion pero conviene hacerlo en el mismo PR.

**Rama:** `feat/etapa-o-school-capabilities`
**Flag:** `VITE_FLAG_SCHOOL_CAPABILITIES` (default `true` post-merge — backfill cubre toda la base)
**Riesgo:** Bajo (aditivo, default = comportamiento actual de academy)
**Rollback:** drop columnas + revertir hook a labels fijos. Sin perdida de datos.
**Dependencias:** ninguna. Paralelizable con C/D. Cuando llega Etapa B, el step `<CapabilitiesStep>` (O8) se ensambla ahi.

---

## BLOQUE 2 — Cuentas + Billing Web

### Etapa E — AccountContext + Switcher (Semana 4)

| # | Cambio |
|---|---|
| E1 | `AccountContext` (currentAccount, availableAccounts, switchAccount, createPersonalAccount) |
| E2 | Refactor interno `useSchoolContext` como wrapper compat |
| E3 | Storage `localStorage.sportmaps_active_account_id` |
| E4 | `<AccountSwitcher>` en header (avatar + nombre + tier badge) |
| E5 | `SchoolSelector` visible solo si `account_type='school'` |
| E6 | Badge dias-restantes trial en sidebar |

**Rama:** `feat/etapa-e-account-context`
**Flag:** `VITE_FLAG_MULTI_ACCOUNT`
**Riesgo:** Medio (afecta contexto global)

---

### Etapa F — Billing Hub web (Semana 5)

| # | Cambio |
|---|---|
| F1 | Ruta `/billing` con cards por cuenta |
| F2 | `<PlanCard>`, `<TierComparisonModal>`, `<AddAccountModal>` |
| F3 | Endpoints BFF: cambiar/cancelar/downgrade + webhook Wompi subscription |
| F4 | Reutilizar `InstallmentCheckoutModal` para upgrades |
| F5 | Link "Planes" en nav por rol |
| F6 | **Politica de downgrade** — soft-downgrade: tier baja inmediatamente, banner critico en UI ("Tienes 200 estudiantes activos, plan Pro permite 20 — actualiza o exporta"), bloqueo de creacion nueva en BFF, lectura disponible. **Grace period 14 dias** antes de degradar features de lectura (evita loophole de quedarse en pro consumiendo features). |

**Rama:** `feat/etapa-f-billing-hub`
**Riesgo:** Medio (toca pagos)

---

### Etapa J — Quick wins UX (paralelizable, Semana 4-6)

Ideas tomadas de capturas controla.club, adaptadas a SportMaps.

| # | Cambio |
|---|---|
| J1 | Wizard 3 pasos Cargos Masivos + `create_bulk_charges` RPC + `charge_templates` |
| J3 | `<EmptyState>` compartido con CTA |
| J5 | Toggles WhatsApp por evento con gating en `SchoolSettingsPage.tsx` |
| J6 | Auditoria forms largos (tooltip vs inline) |
| J7 | Verificar items `MobileBottomNav` por rol |
| J8 | Jerarquia CTAs (variant `default`/`outline`/`ghost`, sin colores) |
| J9 | `<FormSubmitButton reasons={[...]}>` con validacion inline |
| J11 | Productos con opciones dinamicas (chips) |
| J12 | **Command Palette global (`Ctrl/Cmd+K`)** — `<CommandDialog>` shadcn que indexa todos los `NavItem` de `getNavigationByRole()` + acciones rapidas (crear estudiante, registrar pago, etc.). Atajo visible en sidebar header. Reduce dependencia de la sidebar larga (school role tiene ~18 items). Archivo: `frontend/src/components/common/CommandPalette.tsx` + provider en `App.tsx`. |

**Rama:** `feat/j1-bulk-charges` (y otras segun feature; `feat/j12-command-palette` independiente)
**Riesgo:** Bajo

---

## BLOQUE 3 — Payments robustos

### Etapa G — Payments BFF fase 1: mutaciones (Semana 7-8)

**Prerequisito critico para mobile.**

| # | Cambio |
|---|---|
| G0 | **Verificacion HMAC obligatoria en webhooks Wompi/Epayco** — sin esto, el endpoint `/webhook` es publico y cualquiera puede marcar pagos como aprobados con un POST falso. Rotar secret cada 90 dias. |
| G1 | `bff/src/routes/payments.ts` — POST `/checkout` (crea fila `pending` ANTES de redirigir a gateway), `/register-cash`, `/approve`, PATCH `/:id/status`. Cliente envia `Idempotency-Key` en header. |
| G2 | Middleware auth Supabase (JWT + rol + escuela) |
| G3 | Idempotencia server-side (hash request + TTL 24h) |
| G4a | Webhook hace `UPSERT` por `provider_transaction_id` (idempotente, resuelve race condition fila-pending vs webhook-temprano) — `ON CONFLICT (provider_transaction_id) DO UPDATE` |
| G4b | **Cron de reconciliacion cada 5 min** — rescata pagos `pending > 15min` consultando endpoint de estado del gateway. Cubre webhooks perdidos. Archivo: `bff/src/jobs/payments-reconciler.ts` |
| G5 | Refactor 5 callsites: `PaymentCheckoutModal`, `ParentCheckoutPage`, `PaymentsAutomationPage`, `RegisterCashPaymentModal`, `ApprovePaymentMethodSheet` |
| G6 | RLS: revocar INSERT/UPDATE/DELETE a `authenticated` en `payments` |
| G7 | Tests integracion `bff/test/payments.spec.ts` (incluye prueba de race condition + webhook firmado/sin firmar) |

**Rama:** `feat/etapa-g-payments-bff-mutations`
**Flag:** `VITE_FLAG_PAYMENTS_BFF`
**Riesgo:** Alto (flujo financiero)

---

### Etapa H — Gating (audit -> soft, Semana 9)

3 sub-etapas: `audit` (1 sem) -> `soft` (2 sem) -> `enforce` (Etapa M).

**Paginas envueltas (~20):**

- **Athlete (3):** `/stats`, `/wellness`, `/explore/trainers`
- **Coach (5):** `/coach-plans`, `/coach-reports`, `/trainer/availability`, `/trainer/payments`, limite clientes>5
- **School (10):** `/branches`, `/payments-automation`, `/payment-reminders`, `/finances`, `/school-reports`, `/analytics-dashboard`, `/message-templates`, `/calendar-advanced`, `/announcements`, limite estudiantes>20
- **Organizer (2):** `/organizer/finances`, `/organizer/reports`
- **Vendor/Wellness/Federation:** TBD por feature

**Flag:** `VITE_GATING_MODE=audit | soft | enforce`
**Riesgo:** Medio

---

### Etapa I — Navigation dinamico (Semana 9)

| # | Cambio |
|---|---|
| I1 | `getNavigationByAccount(account, tier)` reemplaza `getNavigationByRole` (alias compat) |
| I2 | `NavItem.requiresFeature?: string` + render con candado |
| I3 | Click bloqueado -> `/billing?feature=X` |
| I4 | Unificar set iconos |
| I5 | **Secciones colapsables con persistencia** — extender `openSubmenus` de `AppSidebar.tsx` al nivel `SidebarGroup`. Estado guardado en `localStorage` por rol (`sportmaps_sidebar_collapsed_groups_<role>`). Default: `Principal` siempre abierto, resto colapsa si no hay ruta activa adentro. |
| I6 | **Reagrupar items planos en submenus (rol school/school_admin)** — `ADMINISTRACION` (7 items) se parte en: `Pagos & Finanzas` ▸ Pagos/Recordatorios/Finanzas/Reportes; `Comunicacion` ▸ Plantillas; `Infraestructura` ▸ Sedes/Instalaciones. Reduce items visibles de 18 a ~10. Archivo: `frontend/src/config/navigation.ts` (sin tocar componente, ya soporta submenu). |

**Riesgo:** Bajo

---

## BLOQUE 4 — Mobile (Capacitor)

### Estrategia de cobros en la app (critico)

**Regla:** matriculas, clases, productos fisicos -> Wompi/Epayco. Suscripciones SaaS -> solo desde web (cero IAP).

**Implementacion del split:**

```ts
// frontend/src/pages/BillingPage.tsx
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const isNativeApp = Capacitor.isNativePlatform();

function handleUpgrade(tier: Tier) {
  if (isNativeApp) {
    // Apple/Google: SaaS digital NO se cobra desde app
    Browser.open({
      url: 'https://sportmaps.co/billing?action=upgrade&tier=' + tier,
      presentationStyle: 'popover'
    });
  } else {
    // Web: checkout inline con Wompi
    openInstallmentCheckoutModal(tier);
  }
}
```

**Reglas Apple a respetar en el UI movil:**

1. No mostrar precios de SaaS (Pro $29/mes) en la app nativa.
2. Boton "Gestionar plan" en lugar de "Comprar Pro".
3. Antes de abrir el browser, mostrar disclaimer: "Estas saliendo de la app para gestionar tu plan. Los pagos ocurren fuera de esta aplicacion."
4. Matriculas del padre al club SI muestran precio y cobran con Wompi dentro del webview (servicio fisico -> permitido).

---

### Sesion Supabase en Capacitor (decision)

Storage adapter custom con `@capacitor/preferences` + `persistSession: true`. Supabase maneja refresh-flow nativo, persiste en Keychain (iOS) / EncryptedSharedPreferences (Android), sobrevive a kills de la app.

```ts
// frontend/src/integrations/supabase/client.ts
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const capacitorStorage = {
  getItem: async (k: string) => (await Preferences.get({ key: k })).value,
  setItem: async (k: string, v: string) => Preferences.set({ key: k, value: v }),
  removeItem: async (k: string) => Preferences.remove({ key: k }),
};

export const supabase = createClient(url, key, {
  auth: {
    storage: Capacitor.isNativePlatform() ? capacitorStorage : window.localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

**Por que NO `persistSession: false` + manejo manual:** te obliga a reimplementar refresh-flow + retries de red. El adapter delega al cliente Supabase y no toca el codigo de auth existente.

---

### Preparacion previa (durante Bloques 2-3)

Lo que DEBE estar listo antes de arrancar N1:

| # | Cambio | En que etapa encaja |
|---|---|---|
| PRE1 | Hook `useDeviceContext()` — detecta web/ios/android + capabilities | Fase J / E |
| PRE2 | Endpoint `bff/src/routes/devices.ts` — POST `/register` (push token), POST `/unregister` | Fase G |
| PRE3 | Tabla `user_devices` (user_id, platform, push_token, last_seen_at) | Fase G |
| PRE4 | Alojar `apple-app-site-association` en `https://sportmaps.co/.well-known/` | Fase F |
| PRE5 | Alojar `assetlinks.json` en `https://sportmaps.co/.well-known/` | Fase F |
| PRE6 | `BillingPage` con deteccion de plataforma (oculta precios si `isNativeApp`) | Fase F |
| PRE7 | Todas las rutas de reset password / confirmacion pago / invitaciones funcionan via deep link | Fase G |
| PRE8 | Payments BFF robusto con idempotencia | Fase G |

---

### Etapa N1 — Capacitor wrapper (Semana 10-11)

| # | Cambio | Archivo |
|---|---|---|
| N1.1 | `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android` | `frontend/package.json` |
| N1.2 | `capacitor.config.ts` con `appId=co.sportmaps.app`, `webDir=dist`, scheme `sportmaps://` | `frontend/capacitor.config.ts` |
| N1.3 | `npx cap add ios && npx cap add android` genera proyectos nativos | `frontend/ios/`, `frontend/android/` |
| N1.4 | Scripts: `build:mobile`, `cap:sync`, `cap:open:ios`, `cap:open:android` | `package.json` |
| N1.5 | Iconos y splash via `@capacitor/assets` con master 1024x1024 | `resources/` |
| N1.6 | Plugins base: `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/preferences`, `@capacitor/browser` | `package.json` |
| N1.7 | Configurar Universal Links iOS y App Links Android (entitlements + intent-filters) | `ios/App/App.entitlements`, `android/app/src/main/AndroidManifest.xml` |
| N1.8 | Handler deep links -> router (`sportmaps://payment/123` -> `/payment/123`) | `frontend/src/lib/deeplinks.ts` |
| N1.9 | `BillingPage` usa `@capacitor/browser` `Browser.open({ url })` si `isNativeApp`. La pagina de exito (`sportmaps.co/billing-success`) dispara `window.location.href = 'sportmaps://billing-success?subscription_id=xxx'` para reentrar a la app y refrescar `AccountContext`. | `frontend/src/pages/BillingPage.tsx`, `frontend/src/lib/deeplinks.ts` |
| N1.9b | **Fallback de retorno** — al evento `@capacitor/app appStateChange` -> `active`, si la ultima accion fue "abrir billing externo" en los ultimos 10 min, refrescar `AccountContext` + `useEntitlements`. Cubre cuando el deep link no se dispara. | `frontend/src/contexts/AccountContext.tsx` |
| N1.10 | Wompi checkout: verificar que `window.location` redirect flow funciona dentro del WebView (backup: `@capacitor/browser`) | `PaymentCheckoutModal.tsx` |
| N1.11 | CI: GitHub Actions / Bitbucket con runner macOS para build iOS, Linux para Android | `.github/workflows/mobile.yml` |
| N1.12 | Firmas: Apple Developer account activo, certificados en Keychain, Android keystore en secret manager | infra |
| N1.13 | Build primera version y subir a TestFlight + Play Internal | manual |

---

### Etapa N2 — Features nativas (Semana 12-13)

Necesarias para pasar Apple Guideline 4.2.

| # | Plugin | Uso | Archivo |
|---|---|---|---|
| N2.1 | `@capacitor/push-notifications` — tokens registrados por `user_id` (no `account_id`). Pushes incluyen `metadata.target_account_id` para que el cliente haga deep-link con switch implicito de cuenta. Tabla `user_devices(user_id, platform, push_token, last_seen_at)` con cleanup job para tokens expirados. | Recordatorios pago, clase, asistencia | `frontend/src/lib/push.ts` |
| N2.2 | Supabase Edge Function `send-push` -> FCM/APNS | Dispara pushes desde eventos | `supabase/functions/send-push/index.ts` |
| N2.3 | `@capacitor-community/fingerprint-aes` o `@capacitor/biometric` | FaceID/fingerprint al abrir app | `frontend/src/hooks/useBiometric.ts` |
| N2.4 | `@capacitor-mlkit/barcode-scanning` | Escanear QR asistencia/evento | `frontend/src/components/scanner/QRScanner.tsx` |
| N2.5 | `@capacitor/camera` | Foto comprobante pago (reemplaza input file) | `PaymentProofUpload.tsx` |
| N2.6 | `@capacitor/haptics` | Feedback tactil en check-in, pago exitoso | inline |
| N2.7 | `@capacitor/share` | Compartir link invitacion de escuela | `InvitationShareButton.tsx` |
| N2.8 | `@capacitor/geolocation` (opcional) | Ubicacion de sede mas cercana en `FacilitiesPage` | futuro |
| N2.9 | Pull-to-refresh nativo en listas clave | wrapper `<RefreshableList>` | `components/common/RefreshableList.tsx` |

---

### Etapa N3 — Tiendas (Semana 14, mucho tiempo muerto)

| # | Tarea |
|---|---|
| N3.1 | Screenshots por dispositivo (iPhone 6.7", 6.5", 5.5", iPad 12.9", Android phone, tablet) |
| N3.2 | Descripcion corta + larga en espanol e ingles |
| N3.3 | Politica de privacidad publica en `sportmaps.co/privacy` |
| N3.4 | Terminos y condiciones publica |
| N3.5 | Responder cuestionario de privacidad Apple (que datos recolectas, con quien compartes) |
| N3.6 | Cuestionario Google Data Safety |
| N3.7 | Ratings (apps que usan: minimo 4+) |
| N3.8 | Categoria: "Health & Fitness" o "Sports" |
| N3.9 | Submit iOS — review 24-72h, tipico 1-3 ciclos |
| N3.10 | Submit Android — review 1-5 dias |
| N3.11 | Plan de respuesta a rechazo (la mayoria son por 4.2, 4.3 "minimal value", 5.1 "privacy") |

---

### Etapa N4 — Offline asistencia (Semana 15, opcional)

Solo si coaches lo piden tras N3.

| # | Cambio |
|---|---|
| N4.1 | `@capacitor-community/sqlite` o `capacitor-data-storage-sqlite` |
| N4.2 | Tabla local `pending_attendance` (team_id, student_id, status, logged_at) |
| N4.3 | Hook `useOfflineQueue()` — detecta online/offline, encola mutaciones |
| N4.4 | Sync job al reconectar con BFF `POST /api/v1/attendance/bulk-sync` |
| N4.5 | UI: badge "N cambios pendientes" en `CoachAttendancePage` |

---

### Stack mobile consolidado

```
Capacitor 6.x
├── @capacitor/core
├── @capacitor/ios
├── @capacitor/android
├── @capacitor/app              # deep links
├── @capacitor/browser          # SFSafariViewController para billing externo
├── @capacitor/preferences      # storage nativo
├── @capacitor/splash-screen
├── @capacitor/status-bar
├── @capacitor/push-notifications
├── @capacitor/camera
├── @capacitor/haptics
├── @capacitor/share
├── @capacitor/geolocation      # opcional
├── @capacitor-mlkit/barcode-scanning
├── @capacitor-community/fingerprint-aes  # o @capacitor/biometric
└── @capacitor-community/sqlite # solo si N4
```

---

### Costos operativos mobile

| Item | Costo | Frecuencia |
|---|---|---|
| Apple Developer Program | $99 USD | anual |
| Google Play Console | $25 USD | unico |
| FCM (push Android) | $0 | siempre |
| APNS (push iOS) | $0 | incluido en dev account |
| macOS runner CI (opcion A: self-host Mac mini) | $0-700 | unico |
| macOS runner CI (opcion B: Ionic Appflow / Codemagic) | $99/mes | recurrente |
| Supabase Edge Functions push dispatcher | $0-10 | segun volumen |

---

## BLOQUE 5 — Cierre

### Etapa K — Rediseno layouts (Semana 16)

Solo estructura/tipografia/spacing. **Colores se conservan.**

| # | Pagina | Patron |
|---|---|---|
| K0 | **Design tokens** — `frontend/src/styles/design-tokens.css` con spacing, border-radius, typography (NO colores). Auditar valores actuales + extraer + reemplazar callsites principales. **Realista: 1 dia, no 2 horas**. Bloquea K1-K8 para que primitivos UI nazcan sin deuda. | nuevo |
| K1 | `AthleteWellnessPage` | Perfil gamificado (arco + retos + stats) |
| K2 | `CalendarPage` | Calendario + leyenda tipos + panel lateral |
| K3 | `ExplorarGlobalPage` | Home con categorias + entrenadores + eventos + programas |
| K4 | `FacilitiesPage` | Mapa + sidebar sedes con ratings |
| K5 | `ParentPaymentsHubPage` (NUEVA) | Hub 4 cards |
| K6 | `SettingsPage` | Hub con cards |
| K7 | `BillingPage` | Refinamiento post-F |
| K8 | Primitivos UI compartidos | `level-arc`, `challenge-card`, `stats-selector`, `hub-card`, etc. |

---

### Etapa L — Payments BFF fase 2: lecturas (Semana 17)

| # | Cambio |
|---|---|
| L1 | GET `/api/v1/payments/list`, `/aggregate`, `/status-check` en BFF |
| L2 | Refactor: `AdminClubsPage`, `AnalyticsDashboardPage`, `InvitationsManagementPage` |
| L3 | Cache BFF (Redis o in-memory TTL 60s) para aggregates |

---

### Etapa M — Cutover SaaS enforce (Semana 18)

| # | Accion |
|---|---|
| M1 | Revisar logs `audit` 2 semanas, calibrar features |
| M2 | Email + banner "Trial termina en X dias" 7 dias antes |
| M3 | Descuento anual pre-cutover (20%?) |
| M4 | Congelar nuevas features 1 semana antes |
| M5 | Flip `VITE_GATING_MODE=enforce` |
| M6 | Trials vencidos -> downgrade automatico a free |
| M7 | Notificacion in-app + push (en mobile) + email |
| M8 | Monitoreo 7 dias: errores, tickets, churn |
| M9 | Rollback: `VITE_GATING_MODE=audit` — todo vuelve |

---

## BLOQUE 6 — WhatsApp AI Channel

**Vision:** WhatsApp como primer canal de soporte y pagos para padres/atletas. Cada escuela conecta su propio numero (Tech Provider Meta), bot DeepSeek con function-calling sobre BD real, panel de control en SportMaps tipo Intercom. Add-on premium con margen ~93%.

**Dependencias:** Etapa A (rate-limit, auditoria), Etapa C (multi-cuenta + RLS), Etapa G (Payments BFF) — bloqueante para WA3.

**Diferencial vs competidores:**
1. WhatsApp con numero propio de la escuela (branding intacto).
2. Pagos completados desde WA (recordatorio + link en 1 mensaje).
3. Control granular: modo auto / asistido (admin aprueba) / copilot manual.
4. Cero alucinaciones — todo el contexto sale de BD via function-calling.
5. Multi-tenant nativo: una sola plataforma SportMaps, miles de escuelas.

---

### Etapa WA1 — Tech Provider Meta + Onboarding embedded (Sem 19-20)

| # | Cambio | Archivo / referencia | Tiempo |
|---|---|---|---|
| WA1.0 | **Solicitud Meta Tech Provider** — verificar Meta Business + responder cuestionario uso. Iniciar en Sem 1 (paralelo Bloque 1) por espera ~2 sem. | externo | 1d trabajo |
| WA1.1 | Migraciones BD — 10 tablas: `school_whatsapp_integrations`, `whatsapp_settings`, `whatsapp_conversations`, `whatsapp_messages`, `whatsapp_message_drafts`, `whatsapp_payment_links`, `whatsapp_quotas`, `whatsapp_templates`, `whatsapp_identifications`, `whatsapp_blocked_numbers` | migration nueva | 1d |
| WA1.2 | RLS estricta por `school_id` + RPCs `SECURITY DEFINER` que devuelven tokens descifrados solo a backend | migration | 4h |
| WA1.3 | `pgcrypto` para `access_token_encrypted` + clave en env + cron rotacion 60d | migration + bff | 4h |
| WA1.4 | `parents.whatsapp_phone` + `whatsapp_opted_in_at` + `whatsapp_opted_out_at` + indice parcial | migration | 30m |
| WA1.5 | BFF `/api/v1/webhooks/whatsapp` con verificacion HMAC-SHA256 (`app_secret` Meta) | `bff/src/routes/whatsapp-webhook.ts` | 4h |
| WA1.6 | Multi-tenant routing por `phone_number_id` -> `school_id` con cache LRU | `bff/src/services/whatsapp-router.ts` | 3h |
| WA1.7 | Frontend "Conectar WhatsApp" con Embedded Signup (Meta JS SDK) | `frontend/src/pages/SchoolWhatsAppSetupPage.tsx` | 1d |
| WA1.8 | Auto-registro de webhook al WABA tras conexion exitosa | bff service | 3h |
| WA1.9 | Wizard configuracion inicial: modo, idioma, tono, horario laboral, mensaje bienvenida | `components/whatsapp/SetupWizard.tsx` | 1d |
| WA1.10 | Tabla `whatsapp_quotas` poblada por trigger desde `saas_subscriptions` (binding plan -> conversaciones incluidas) | migration | 2h |

**Rama:** `feat/wa1-tech-provider-onboarding`
**Flag:** `VITE_FLAG_WHATSAPP_AI`
**Riesgo:** Medio (manejo credenciales Meta + onboarding usuario externo + cifrado)
**Rollback:** desactivar flag, `DROP TABLE whatsapp_*` en orden inverso

---

### Etapa WA2 — Bot Core con DeepSeek (Sem 21-22)

**Objetivo:** padre escribe -> bot responde con datos reales en modo asistido. 1 escuela piloto.

| # | Cambio | Archivo |
|---|---|---|
| WA2.1 | Cliente DeepSeek con function-calling, retry exponencial, response_format JSON | `bff/src/services/deepseek-client.ts` |
| WA2.2 | Tool `get_athlete_schedule(athlete_id, date_range)` | `bff/src/services/whatsapp-tools/schedule.ts` |
| WA2.3 | Tool `get_payment_status(parent_id)` | `bff/src/services/whatsapp-tools/payments.ts` |
| WA2.4 | Tool `report_absence(athlete_id, date, reason)` integra con tabla `attendance` | `bff/src/services/whatsapp-tools/attendance.ts` |
| WA2.5 | Tool `get_certificate_status(athlete_id)` integra con `athlete_certificates` | `bff/src/services/whatsapp-tools/certificates.ts` |
| WA2.6 | Tool `get_athlete_info(athlete_id)` (grupo, entrenador, membresia) | `bff/src/services/whatsapp-tools/info.ts` |
| WA2.7 | Tool `escalate_to_human()` (cambia status conversacion + notifica admin) | inline |
| WA2.8 | Identificacion padres por OTP via email — flujo completo con `whatsapp_identifications` | `bff/src/services/whatsapp-identification.ts` |
| WA2.9 | Sender service Cloud API con retry + tracking status (sent/delivered/read/failed) | `bff/src/services/whatsapp-sender.ts` |
| WA2.10 | Queue `pg-boss` para procesamiento async de mensajes entrantes (sin Redis) | `bff/src/jobs/whatsapp-processor.ts` |
| WA2.11 | Modo asistido — crea drafts en `whatsapp_message_drafts`, notifica admin via Realtime | `bff/src/services/whatsapp-drafts.ts` |
| WA2.12 | Inbox basico admin: lista conversaciones + hilo + acciones rapidas | `frontend/src/pages/SchoolWhatsAppInboxPage.tsx` |
| WA2.13 | Aprobar/editar/rechazar draft desde inbox (1 click "Enviar") | `components/whatsapp/DraftReviewer.tsx` |
| WA2.14 | Rate limiting: 10 msg/min/padre, 1000 msg/min/escuela (middleware bff) | `bff/src/middleware/whatsapp-rate-limit.ts` |
| WA2.15 | Auditoria completa en `admin_activity_logs` con `actor_type` (`bot` o `admin_uid`) | inline |
| WA2.16 | QA con 1 escuela piloto + checklist de validacion en `docs/whatsapp-pilot.md` | manual |

**Rama:** `feat/wa2-bot-core-intents`
**Flag:** `VITE_FLAG_WHATSAPP_AI`
**Riesgo:** Alto (LLM con datos de menores, RLS estricta obligatoria)
**Mitigacion clave:** rechazar respuesta del bot si tool call falla. Cero respuestas "creativas".

---

### Etapa WA3 — Pagos via WhatsApp (Sem 23-24)

**Prerequisito:** Etapa G completa (Payments BFF con idempotencia y webhook firmado).

| # | Cambio | Archivo |
|---|---|---|
| WA3.1 | Tool `generate_payment_link(parent_id, invoice_id)` integrado con SportMaps Pay/Wompi | `bff/src/services/whatsapp-tools/payments.ts` |
| WA3.2 | Tracking estado `whatsapp_payment_links`: sent -> clicked -> paid -> expired | tabla + triggers |
| WA3.3 | Submit 5 plantillas Meta para aprobacion (`recordatorio_pago`, `confirmacion_pago`, `ausencia_confirmada`, `certificado_vencido`, `bienvenida`) | `bff/src/services/whatsapp-templates.ts` |
| WA3.4 | UI admin: ver estado plantillas + sincronizar con Meta + preview | `components/whatsapp/TemplatesPage.tsx` |
| WA3.5 | Cron `pg-boss` recordatorios proactivos (-3d, dia vencimiento, +7d) | `bff/src/jobs/whatsapp-payment-reminders.ts` |
| WA3.6 | Webhook Wompi extendido: si pago vino de WA, notificar al padre con confirmacion automatica | `bff/src/routes/wompi-webhook.ts` |
| WA3.7 | Anti-spam: max 3 recordatorios/pago, respeta horario laboral, opt-out individual de pagos (no afecta soporte) | servicio |
| WA3.8 | Dashboard escuela: pagos cobrados via WA (monto, conversion link->pago, ROI) | `components/whatsapp/PaymentsDashboard.tsx` |
| WA3.9 | Configuracion agresividad recordatorios (suave / normal / agresivo) en settings | settings |

**Rama:** `feat/wa3-payments-via-whatsapp`
**Flag:** `VITE_FLAG_WHATSAPP_PAYMENTS`
**Riesgo:** Alto (toca cobros reales + plantillas Meta + comunicaciones masivas)

---

### Etapa WA4 — Modo Auto + Inbox completo + Analytics (Sem 25-26)

**Objetivo:** escuelas pueden pasar a 100% automatico con confianza. Inbox tipo Intercom completo.

| # | Cambio | Archivo |
|---|---|---|
| WA4.1 | Modo auto con umbral confianza configurable (default 0.85) | servicio |
| WA4.2 | Fallback a humano si: confianza baja, intent no soportado, padre escribe "humano", N reintentos sin resolver | servicio |
| WA4.3 | Inbox completo: filtros (pendiente/escalado/resuelto/sin leer), busqueda full-text, asignacion a admin especifico | `pages/SchoolWhatsAppInboxPage.tsx` |
| WA4.4 | Toggle bot ON/OFF por conversacion individual (escala manual) | inline |
| WA4.5 | Editor de plantillas custom + submit a Meta + sync de status | `components/whatsapp/TemplateEditor.tsx` |
| WA4.6 | Analytics: # conversaciones, tasa resolucion auto, tiempo respuesta, top 10 intents, costo mes vs cuota | `pages/SchoolWhatsAppAnalyticsPage.tsx` |
| WA4.7 | Lista negra (`whatsapp_blocked_numbers`) + opt-out con keywords ("stop", "baja", "cancelar") | tabla + servicio |
| WA4.8 | Reportes mensuales exportables (PDF/CSV) con ROI estimado (horas ahorradas + cobranza recuperada) | `bff/src/services/whatsapp-reports.ts` |
| WA4.9 | Configuracion personalidad/tono del bot (formal/cercano/neutral) | settings |
| WA4.10 | Kill-switch global super admin para suspender bot de una escuela en 1 click | RPC `SECURITY DEFINER` |

**Rama:** `feat/wa4-auto-mode-inbox`
**Flag:** `VITE_FLAG_WHATSAPP_AUTO_MODE`
**Riesgo:** Medio

---

### Etapa WA5 — V2 features (opcional, Sem 27-28)

| # | Cambio | Archivo |
|---|---|---|
| WA5.1 | Tool `confirm_event_attendance(event_id, response)` integra con tabla `polls` existente | tools |
| WA5.2 | Tool `enroll_extra_activity(activity_id)` | tools |
| WA5.3 | Subir documentos via WA (foto certificado medico) -> Supabase Storage + flujo aprobacion | servicio |
| WA5.4 | Multi-sede Enterprise (varios numeros WA por escuela, 1 por sede) | migration + servicio |
| WA5.5 | Voz: transcripcion audios via Deepgram/Whisper -> mismo flujo de intents | `bff/src/services/whatsapp-voice.ts` |
| WA5.6 | Multi-idioma con deteccion automatica (es/pt/en) | servicio |
| WA5.7 | Notificaciones inteligentes: deteccion patron de ausencias o pagos atrasados con sugerencia proactiva | cron |

**Rama:** `feat/wa5-v2-features`
**Flag:** `VITE_FLAG_WHATSAPP_AI`
**Riesgo:** Bajo

---

### Pricing del add-on

| | **Starter** | **Pro** | **Enterprise** |
|---|---|---|---|
| Precio extra/mes | $39 USD | $79 USD | $149 USD |
| Conversaciones IA incluidas | 1,000 | 4,000 | 15,000 |
| Conversacion adicional | $0.04 | $0.03 | $0.02 |
| Pagos via WA | si | si | si |
| Modo asistido | si | si | si |
| Modo auto | no | si | si |
| Plantillas custom | 5 | 20 | ilimitado |
| Multi-sede | no | no | si |
| Voz / multi-idioma | no | si | si |
| Onboarding | self-serve | asistido (1h) | white-glove (4h) |

**Margen objetivo:** 90-95%. Costo SportMaps por escuela activa promedio: ~$4-5 USD/mes (DeepSeek + infra).

---

### Costos operativos del canal

| Item | Costo SportMaps | Costo escuela |
|---|---|---|
| WhatsApp Business API | $0 (escuela paga directo Meta) | ~$15-30/mes segun pais y volumen |
| DeepSeek V3 (~3M tokens/escuela/mes promedio) | ~$3 | $0 |
| Infra (pg-boss + webhook + storage) | ~$1-2 | $0 |
| Add-on SportMaps | (revenue) | $39-149/mes |

---

### Stack consolidado WhatsApp

```
Meta WhatsApp Cloud API (multi-tenant via Tech Provider con Embedded Signup)
DeepSeek V3 con function-calling (response_format json_object)
pg-boss (queue sobre Postgres existente, sin Redis)
pgcrypto (cifrado tokens Meta)
Supabase Realtime (sync inbox admin tipo Intercom)
Wompi / SportMaps Pay (pagos via WA, sin pasarela paralela)
```

---

### Metricas de exito

| KPI | Target mes 3 | Target mes 6 |
|---|---|---|
| Adopcion padres opt-in / escuela | 60% | 85% |
| Tasa resolucion automatica | 50% | 75% |
| Tiempo medio de respuesta | <30s | <10s |
| % cobranza atribuida a WA | 20% | 40% |
| Reduccion tickets admin escuela | 30% | 60% |
| Churn add-on WhatsApp | <8% | <4% |
| Margen bruto add-on | 88% | 93% |
| MRR add-on / MRR total | 5% | 20% |

---

## BLOQUE 7 — Wellness Pro (fisioterapia + medicina deportiva)

**Vision:** convertir SportMaps en plataforma completa para fisioterapeutas, medicos deportivos y profesionales wellness. Equipara y supera Fibbel/Feexio/Hexfit en feature-parity, integrado nativamente con marketplace, atletas, padres, escuelas y WhatsApp AI Channel.

**Dependencias:** Etapa A (audit + rate-limit), Etapa C (multi-cuenta + RLS), Etapa D (entitlements + gating), Etapa G (Payments BFF) — bloqueante para W3 (bonos). Bloque 4 (Capacitor) — bloqueante para W4.1 (wearables nativos). Bloque 6 — opcional, mejora W4.2 (IA) si esta disponible.

**Diferencial vs Fibbel/Feexio/Hexfit:**
1. Integrado al marketplace SportMaps (vendor + wellness pro unificados).
2. Ecosistema padre/escuela/coach — visibilidad cruzada de la lesion del atleta.
3. WhatsApp AI Channel reutilizable para recordatorios de ejercicios y citas.
4. open-wearables (MIT, self-host) — sin lock-in de Garmin/Polar/Fitbit/Apple/Google.
5. IA Coach Recovery con guardrails clinicos (cero alucinaciones, aprobacion humana siempre).
6. Cumplimiento Habeas Data Colombia + retencion historia clinica Ley 23/1981.

---

### Etapa W1 — Nucleo clinico (Sem 19-20, paralelo Bloque 6 si hay 2 devs)

**Objetivo:** equiparar Feexio MVP — biblioteca de ejercicios + planes de tratamiento + adherencia + dashboard fisio.

| # | Cambio | Archivo / referencia | Tiempo |
|---|---|---|---|
| W1.1 | Migracion `20260501000001_wellness_pro_core.sql` — 8 tablas: `wellness_professional_profiles`, `therapy_exercises`, `pathologies`, `pathology_exercises`, `treatment_plans`, `treatment_plan_exercises`, `exercise_completions`, `adherence_scores` | migration | 1d |
| W1.2 | Seed inicial 200 ejercicios curados (cervical, lumbar, rodilla, hombro, tobillo, propiocepcion, core) + 30 patologias con vinculo a ejercicios por fase | `supabase/seed/wellness_exercises.sql`, `supabase/seed/wellness_pathologies.sql` | 1d |
| W1.3 | RLS por tabla — `therapy_exercises` (publica + privada owner), `treatment_plans` (pro + paciente + padre via `is_parent_of`), `exercise_completions` (paciente + padre + pro tratante via `is_treating_pro`), helpers SQL `is_parent_of()`, `is_treating_pro()` | misma migracion | 4h |
| W1.4 | RPCs `wellness_assign_plan_from_template`, `wellness_mark_exercise_done` (idempotente por dia con UPSERT), `wellness_compute_adherence`, `wellness_today`, `wellness_pro_dashboard` con `SECURITY DEFINER` | misma migracion | 6h |
| W1.5 | BFF `bff/src/routes/wellness/index.ts` — mount + middleware `requireFeature('wellness_treatment_plans')` + `checkPatientLimit` + zod validation | `bff/src/routes/wellness/*` | 4h |
| W1.6 | BFF endpoints fase 1 — `GET/POST /api/v1/wellness/exercises`, `POST /plans`, `GET /plans/:id`, `GET /plans/by-patient/:id`, `POST /plans/from-template/:id`, `POST /exercises/:planExId/complete`, `GET /today`, `GET /adherence/:planId` | `bff/src/routes/wellness/{exercises,plans,completions}.ts` | 1d |
| W1.7 | Frontend atleta — `pages/wellness/MyTreatmentPlanPage.tsx` (sesion del dia + marcar hecho con slider dolor/esfuerzo VAS + Borg), `pages/wellness/ExerciseDetailPage.tsx`, `hooks/useTreatmentPlan.ts`, `hooks/useExerciseCompletions.ts` | `frontend/src/pages/wellness/*` | 1.5d |
| W1.8 | Frontend padre — `components/wellness/ChildSelector.tsx` para alternar entre hijos, adapter en hooks que pasa `for_child_id` al RPC `wellness_today` | `frontend/src/components/wellness/*` | 4h |
| W1.9 | Frontend pro — `pages/trainer/TrainerTreatmentPlanEditor.tsx` (drag&drop ejercicios + biblioteca buscable), `pages/wellness/WellnessProDashboard.tsx` (alertas adherencia <50%) | `frontend/src/pages/{trainer,wellness}/*` | 2d |
| W1.10 | Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE exercise_completions, treatment_plans` + hook `useWellnessRealtime(patientId)` invalida `wellness-today` y `adherence` | `frontend/src/hooks/useWellnessRealtime.ts` | 3h |
| W1.11 | Cron diario push recordatorio ejercicios 8 AM TZ usuario, reusa `push_subscriptions` + Edge Function `send-push` (de Bloque 4 N2.2) | `bff/src/jobs/wellness-daily-reminder.ts` | 4h |
| W1.12 | Trigger `inc_usage` que actualiza `therapy_exercises.usage_count` en INSERT/DELETE de `treatment_plan_exercises` | misma migracion | 30m |
| W1.13 | Tests integracion RLS cross-tenant (paciente A no ve plan de paciente B mismo fisio) + idempotencia `mark_exercise_done` | `bff/test/wellness/integration/rls.plans.test.ts` | 4h |

**Rama:** `feat/wellness-w1-core`
**Flag:** `VITE_FLAG_WELLNESS_V2`, `VITE_FLAG_WELLNESS_TREATMENT_PLANS`
**Riesgo:** Medio (datos clinicos sensibles, RLS estricta obligatoria desde dia 1)
**Rollback:** disable flag + `DROP TABLE` en orden inverso (sin perdida de data v1, `wellness_appointments` actual no se toca)

---

### Etapa W2 — Ficha clinica + tests funcionales + consentimientos (Sem 21-22)

**Objetivo:** equiparar Fibbel — historia clinica completa, +30 tests funcionales, consentimientos digitales firmados con audit inmutable.

| # | Cambio | Archivo / referencia | Tiempo |
|---|---|---|---|
| W2.1 | Migracion `20260514000001_wellness_clinical_v2.sql` — 5 tablas: `health_records_v2`, `clinical_attachments`, `consent_documents`, `functional_tests`, `test_applications` | migration | 1d |
| W2.2 | RLS column-level en `health_records_v2.private_notes` (Postgres ≥15) + view `health_records_patient_safe` con `security_barrier` para vista limitada del paciente | misma migracion | 3h |
| W2.3 | Audit log clinico inmutable — tabla `audit_log_clinical` + RULE NO UPDATE/DELETE + trigger `trg_clinical_audit` en `health_records_v2`, `consent_documents`, `clinical_attachments`, `telehealth_sessions` (de W3) | migration nueva | 4h |
| W2.4 | Seed 30 tests funcionales con `fields_schema` JSON Schema y `scoring_formula` (Y-Balance, FMS, VAS, SLR, Oswestry, NDI, DASH, KOOS, Lysholm, Tampa Scale, etc.) | `supabase/seed/wellness_functional_tests.sql` | 1d |
| W2.5 | RPC `wellness_apply_test` con helpers `wellness_eval_score` (formulas hardcoded, NUNCA eval arbitrario) y `wellness_resolve_band` | misma migracion | 4h |
| W2.6 | Storage bucket `clinical-attachments` (privado, 50MB max, `image/jpeg,image/png,application/pdf,application/dicom`) + RLS estricta por path `{patient_id}/{record_id}/...` | migration storage | 2h |
| W2.7 | Storage bucket `consent-pdfs` (privado, 5MB max, solo PDF) + RLS por relacion en `consent_documents` | migration storage | 1h |
| W2.8 | BFF endpoints — `POST/PATCH /api/v1/wellness/records`, `POST /records/:id/attachments` (devuelve signed URL), `GET /tests`, `POST /tests/:testId/apply`, `GET /tests/applications/:patientId`, `POST /consents/generate`, `POST /consents/:id/sign`, `GET /consents/:id/pdf` | `bff/src/routes/wellness/{records,attachments,tests,consents}.ts` | 1.5d |
| W2.9 | RPC `wellness_sign_consent` idempotente con audit log + lock fila + validacion firmante (paciente adulto o representante legal del menor via `is_parent_of`) + NOTIFY `consent_render_pdf` | misma migracion | 4h |
| W2.10 | Worker render PDF — escucha NOTIFY `consent_render_pdf`, renderiza Handlebars + Puppeteer, sube a `consent-pdfs` bucket, actualiza `consent_documents.pdf_path` | `bff/src/jobs/consent-pdf-renderer.ts` | 1d |
| W2.11 | Frontend pro — `pages/wellness/PatientClinicalRecord.tsx` (anamnesis + exam fisico + diagnostico CIE-10 + plan), `pages/wellness/PatientTests.tsx` (aplicar test + grafico evolucion), `components/wellness/ClinicalAttachmentsUploader.tsx` | `frontend/src/pages/wellness/*` | 2d |
| W2.12 | Frontend atleta/padre — `pages/wellness/MyClinicalRecordPage.tsx` (vista limitada via `health_records_patient_safe`), `pages/wellness/MyTestsPage.tsx` (historico personal), `components/wellness/ConsentSignatureDialog.tsx` (canvas firma + checkbox + IP/UA capture) | `frontend/src/pages/wellness/*` | 1.5d |
| W2.13 | Templates PDF Handlebars — `consent.hbs`, `clinical-summary.hbs` con CSS print + assets logo SportMaps | `bff/src/templates/pdf/*` | 1d |
| W2.14 | Tests integracion RLS — `health_records_v2.private_notes` invisible al paciente; padre firma por menor pero no por adulto; attachment solo accesible a pro tratante o paciente con `visible_to_athlete=true` | `bff/test/wellness/integration/rls.records.test.ts` | 4h |
| W2.15 | Migracion datos v1 -> v2 — `health_records` -> `health_records_v2` (best-effort), `wellness_evaluations` -> `test_applications`. Renombrar v1 a `*_v1_deprecated` con COMMENT, no borrar | `20260514999000_wellness_data_migration.sql` | 4h |

**Rama:** `feat/wellness-w2-clinical`
**Flag:** `VITE_FLAG_WELLNESS_CLINICAL_V2`
**Riesgo:** Alto (datos clinicos sensibles, audit inmutable, Habeas Data, retencion 5 anos Ley 23/1981)
**Rollback:** disable flag, v1 sigue accesible

---

### Etapa W3 — Mensajeria contextual + bonos + telesalud (Sem 23)

**Objetivo:** comunicacion fisio↔paciente integrada con planes, paquetes prepago tipo Fibbel, videoconsulta tipo Hexfit/Daily.co.

**Prerequisito:** Etapa G completa (Payments BFF idempotente para checkout de bonos).

| # | Cambio | Archivo / referencia | Tiempo |
|---|---|---|---|
| W3.1 | Migracion `20260521000001_wellness_comms_bundles.sql` — 5 tablas: `wellness_messages`, `session_bundles`, `bundle_redemptions`, `appointment_intake_forms`, `appointment_soap_notes`, `telehealth_sessions`. Extiende `wellness_appointments` con `is_telehealth`, `telehealth_room_url`, `telehealth_token`, `bundle_id`, `intake_form_id`, `soap_note_id`, `reminder_24h_sent_at`, `reminder_2h_sent_at` | migration | 1d |
| W3.2 | RLS por tabla — `wellness_messages` (sender/recipient/padre via child_id), `session_bundles` (pro/paciente/padre/comprador), `bundle_redemptions` (lectura via bundle), `appointment_intake_forms` (filled_by + pro + paciente), `appointment_soap_notes` (solo pro, NO paciente), `telehealth_sessions` (participantes via appointment) | misma migracion | 3h |
| W3.3 | RPC `wellness_create_bundle` (post-pago confirmado, idempotente por `payment_id`), `wellness_redeem_bundle_session` (lock fila FOR UPDATE, anti-oversell) | misma migracion | 4h |
| W3.4 | BFF endpoints mensajeria — `GET /api/v1/wellness/messages/threads`, `GET /messages/threads/:id`, `POST /messages` (con `context_type` y `context_id` para vincular a plan_exercise/appointment/test) | `bff/src/routes/wellness/messages.ts` | 1d |
| W3.5 | BFF endpoints bonos — `GET /api/v1/wellness/bundles`, `POST /bundles/checkout` (Wompi/Epayco via Payments BFF G1, devuelve `Idempotency-Key` y URL de pago), webhook reutiliza Wompi G4a con extension para crear bono al confirmar | `bff/src/routes/wellness/bundles.ts` | 1d |
| W3.6 | BFF endpoints telesalud — `POST /api/v1/wellness/appointments/:id/telehealth/start` (genera sala Daily.co + tokens pro/paciente/guardian), `POST /telehealth/end`, webhook Daily.co `/webhooks/daily` para grabacion | `bff/src/routes/wellness/{telehealth,webhooks/daily}.ts`, `bff/src/lib/daily.ts` | 1.5d |
| W3.7 | BFF endpoint intake/SOAP — `POST /appointments/:id/intake` (paciente llena), `POST /appointments/:id/soap` (pro escribe, IA opcional via W4.2) | `bff/src/routes/wellness/{intake,soap}.ts` | 4h |
| W3.8 | Frontend atleta — `components/wellness/ChatThread.tsx` (chat con cards contextuales tipo "sobre Bird-Dog del 28-abr"), `pages/wellness/MyBundlesPage.tsx`, `components/wellness/TelehealthRoom.tsx` (embed Daily.co full-screen), `components/wellness/IntakeForm.tsx` | `frontend/src/{pages,components}/wellness/*` | 2d |
| W3.9 | Frontend pro — `pages/wellness/WellnessInbox.tsx` (mensajes por paciente), `pages/wellness/WellnessBundlesAdmin.tsx`, `components/wellness/SoapNoteEditor.tsx` con toggle "borrador IA" (W4.2), tab telehealth en agenda | `frontend/src/pages/wellness/*` | 1.5d |
| W3.10 | Cron recordatorios cita — 24h antes y 2h antes (push + email + WhatsApp via WA3 si flag activa). Marca `reminder_24h_sent_at` / `reminder_2h_sent_at` para idempotencia | `bff/src/jobs/wellness-appointment-reminders.ts` | 4h |
| W3.11 | Cron expiracion bonos — diario marca `status='expired'` en `session_bundles WHERE expires_at < CURRENT_DATE AND status='active'` + push a comprador si quedan sesiones | `bff/src/jobs/wellness-bundle-expirer.ts` | 2h |
| W3.12 | Realtime — `ALTER PUBLICATION ... ADD TABLE wellness_messages, wellness_appointments`. Hook `useWellnessRealtime` agrega channel para mensajes | `frontend/src/hooks/useWellnessRealtime.ts` | 1h |
| W3.13 | Variables env — `DAILY_API_KEY`, `DAILY_DOMAIN`, `DAILY_DEFAULT_ROOM_TTL_SECONDS`, agregar a `bff/.env.example` y validar en startup | `bff/src/config/env.ts` | 1h |

**Rama:** `feat/wellness-w3-comms-bundles`
**Flag:** `VITE_FLAG_WELLNESS_BUNDLES`, `VITE_FLAG_WELLNESS_TELEHEALTH`
**Riesgo:** Alto (toca cobros reales en bonos + comunicaciones masivas + datos sensibles en sala video)
**Rollback:** flags off; bonos comprados quedan pero no se canjean; mensajes no se rompen al desactivar flag

---

### Etapa W4 — Wearables + IA Coach + Branding (Sem 24-25)

**Objetivo:** diferenciadores premium tier `pro`/`enterprise`. Wearables nativos via open-wearables MIT self-host. IA clinica con guardrails.

**Prerequisito:** Bloque 4 N1+N2 (Capacitor + plugins) para SDKs nativos. Si Bloque 4 no esta listo, W4.1 entrega solo OAuth providers (Garmin/Polar/Suunto), sin HealthKit/Health Connect.

| # | Cambio | Archivo / referencia | Tiempo |
|---|---|---|---|
| W4.1 | Migracion `20260528000001_wellness_wearables_ai.sql` — 5 tablas: `wearable_connections`, `wearable_data_points`, `recovery_scores`, `ai_clinical_interactions`, `ai_prompts` | migration | 4h |
| W4.2 | RLS — `wearable_data_points` lectura via `wearable_connections` (paciente/padre/pro tratante), writes SOLO service role (webhook). `recovery_scores` lectura via paciente/padre/pro. `ai_clinical_interactions` solo profesional autor | misma migracion | 2h |
| W4.3 | Deploy open-wearables self-host — `infra/open-wearables/docker-compose.yml` (FastAPI + Postgres + Redis + Celery + beat + Caddy), `.env`, `Caddyfile` con `wearables.sportmaps.app`. VPS Hetzner CX22 ~5 EUR/mes | `infra/open-wearables/*` | 1d |
| W4.4 | Configurar OAuth providers en open-wearables — Garmin Connect Developer, Polar Accesslink, Suunto Partner. Webhook target `https://bff.sportmaps.app/api/v1/wellness/webhooks/open-wearables` con HMAC compartido | dashboards externos | 4h |
| W4.5 | BFF endpoints wearables — `POST /api/v1/wellness/wearables/connect/:provider` (proxy a open-wearables OAuth init), `GET /wearables/connections`, `DELETE /wearables/connections/:id`, `GET /wearables/data?metric=&from=&to=`, `POST /wearables/sync` | `bff/src/routes/wellness/wearables.ts`, `bff/src/lib/openWearables.ts` | 1d |
| W4.6 | Webhook handler `POST /api/v1/wellness/webhooks/open-wearables` con verificacion HMAC-SHA256 + idempotencia Redis 24h + switch por tipo (`connection.created`, `data.points`, `connection.revoked`). Devuelve 5xx para que open-wearables reintente. Nunca devuelve `connection_id` o PII al frontend | `bff/src/routes/wellness/webhooks/open-wearables.ts` | 1d |
| W4.7 | Capacitor SDK movil — wrapper `@momentum/open-wearables-capacitor` (HealthKit iOS, Google Health Connect Android, Samsung Health). Plugin custom si no existe oficial. Solicita permisos con copy claro de privacidad | `frontend/src/lib/wearables/*` (solo Capacitor builds) | 1.5d |
| W4.8 | RPC `wellness_compute_recovery_score` — combina adherencia 7d (peso 25%) + dolor invertido 7d (25%) + sleep_minutes wearable 7d (20%) + HRV 7d (20%) + mood intake 7d (10%) | misma migracion | 4h |
| W4.9 | Cron diario recompute recovery scores 4 AM — itera atletas con plan activo o wearable conectado | `bff/src/jobs/wellness-recovery-score.ts` | 2h |
| W4.10 | Frontend atleta — `pages/wellness/MyHealthDashboard.tsx` (tabs Cuerpo + Wearable + Dolor + Sueno), `components/wellness/WearableConnect.tsx` (lista providers + estado + permisos), `pages/wellness/MyRecoveryScorePage.tsx` (gauge 0-100 + componentes desglosados + tendencia 7d) | `frontend/src/pages/wellness/*` | 2d |
| W4.11 | IA Coach Recovery — cliente DeepSeek con guardrails (`bff/src/lib/deepseek.ts`): tool-call obligatorio, cero PII en prompt, response schema-checked, fallback "insufficient_data" si tools fallan, costo log en `ai_clinical_interactions` | `bff/src/lib/deepseek.ts`, `bff/src/services/wellness-ai/*` | 1.5d |
| W4.12 | 4 use cases IA — `POST /api/v1/wellness/ai/suggest-plan` (patologia → ejercicios catalogo), `POST /ai/draft-soap` (intake + adherencia + tests → S/O/A/P draft), `POST /ai/recovery-insight` (datos 7d → texto explicativo), cron `red-flag-detector` (NLP simple sobre intake/messages → alerta a pro) | `bff/src/routes/wellness/ai.ts`, `bff/src/jobs/wellness-red-flag-detector.ts` | 1.5d |
| W4.13 | Tabla `ai_prompts` versionada (use_case + version + locale + system + user_tpl + guardrails + active) + seed inicial 4 prompts en `es-CO` | `supabase/seed/wellness_ai_prompts.sql` | 4h |
| W4.14 | Cap por tier — middleware `requireFeature('wellness_ai_coach')` + cuota mensual (`wellness_ai_quota_used`/`wellness_ai_quota_limit` por account_id, reset 1ro de mes). Pro 50 sugerencias/mes, Enterprise ilimitado | `bff/src/middleware/wellnessAIQuota.ts` | 4h |
| W4.15 | Frontend pro — `components/wellness/AIPlanSuggester.tsx` (boton "Sugerir con IA" en editor de plan W1.9), `components/wellness/AISoapDraft.tsx` (boton "Generar borrador" en SOAP editor W3.9), badge cuota mensual restante | `frontend/src/components/wellness/*` | 1d |
| W4.16 | Branding white-label tier enterprise — extender `wellness_professional_profiles` con `branding_color`, `branding_logo_url`, `signature_url`, `daily_room_prefix`. Reusa `branding_settings` table. Aplica en PDFs (consent, SOAP, weekly report), email transaccional, embed Daily.co | `frontend/src/pages/wellness/WellnessProBrandingPage.tsx` | 1d |
| W4.17 | Variables env — `OPEN_WEARABLES_BASE_URL`, `OPEN_WEARABLES_API_KEY`, `OPEN_WEARABLES_HMAC_SECRET`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `WELLNESS_AI_DAILY_QUOTA_PRO` | `bff/.env.example`, `frontend/.env.example` | 1h |

**Rama:** `feat/wellness-w4-premium`
**Flag:** `VITE_FLAG_WELLNESS_WEARABLES`, `VITE_FLAG_WELLNESS_AI_COACH`
**Riesgo:** Alto (IA clinica con guardrails obligatorios + datos PII via webhook + costo DeepSeek)
**Mitigacion clave:** rechazar respuesta IA si tool call falla. Cero respuestas creativas. Aprobacion humana antes de aplicar.

---

### Etapa W5 — Hardening + reportes + compliance (Sem 26)

**Objetivo:** cierre del bloque — reportes automaticos, marketplace de plantillas, audit completo, Habeas Data export/delete, plantillas legales.

| # | Cambio | Archivo / referencia | Tiempo |
|---|---|---|---|
| W5.1 | Cron semanal reporte PDF — domingos 18:00 TZ usuario, render Handlebars + Puppeteer, email Resend con adjunto. Pacientes ven adherencia personal, fisio ve dashboard agregado | `bff/src/jobs/wellness-weekly-report.ts`, `bff/src/templates/pdf/weekly-report.hbs` | 1d |
| W5.2 | Marketplace plantillas — `treatment_plans WHERE is_template=true AND is_public=true` + endpoints `GET /api/v1/wellness/templates` (search + filtros), `POST /templates` (publicar plantilla propia con `is_public=true`), `POST /templates/:id/clone` | `bff/src/routes/wellness/templates.ts`, `frontend/src/pages/wellness/TemplatesMarketplacePage.tsx` | 1d |
| W5.3 | Habeas Data export — `GET /api/v1/wellness/me/export` devuelve ZIP con JSON de todos los datos del paciente + PDFs de consentimientos firmados + adjuntos clinicos. Async via job (puede tardar minutos) | `bff/src/jobs/habeas-data-export.ts` | 1d |
| W5.4 | Habeas Data borrado — `POST /me/delete-request` crea solicitud, RPC `wellness_anonymize_patient` ejecuta tras 15 dias (anonimiza `profiles`, `children`, deja `audit_log_clinical` por ley + scrub PII en `wellness_messages`, `appointment_intake_forms`, `appointment_soap_notes`). Email confirma cada paso | `bff/src/jobs/habeas-data-delete.ts` | 1d |
| W5.5 | Plantillas email transaccionales — `appointment-confirmed`, `appointment-reminder-24h`, `appointment-reminder-2h`, `plan-assigned`, `consent-pending`, `consent-signed-receipt`, `bundle-purchased`, `bundle-expiring`, `weekly-report`, `adherence-alert-pro` (10 templates JSX/MJML) | `bff/src/templates/email/*` | 1d |
| W5.6 | i18n base 3 locales — `frontend/src/i18n/locales/wellness/{es-CO,es-ES,pt-BR}.json` con ~80 keys principales | `frontend/src/i18n/locales/wellness/*` | 4h |
| W5.7 | Eventos PostHog catalogados — `wellness_plan_created`, `wellness_exercise_completed`, `wellness_pain_high`, `wellness_test_applied`, `wellness_consent_signed`, `wellness_telehealth_started`, `wellness_bundle_purchased`, `wellness_wearable_connected`, `wellness_ai_suggest`, `wellness_ai_approved`, `wellness_ai_rejected`, `wellness_recovery_score_viewed` | `frontend/src/lib/analytics/wellnessEvents.ts` | 2h |
| W5.8 | Index optimizacion — review pg_stat_statements en staging, agregar indices faltantes detectados, materializar `adherence_scores` si query lenta | migration ad-hoc | 4h |
| W5.9 | Plantillas legales consentimiento — abogado revisa 4 templates HTML (tratamiento, datos, imagen, telesalud). Versionados en `consent_templates` table | `supabase/seed/consent_templates.sql` | externo + 4h integracion |
| W5.10 | Tests E2E Playwright — fisio crea plan, atleta marca hecho, padre firma consentimiento, fisio inicia telehealth, comprar bono, conectar wearable, IA sugiere plan | `bff/test/wellness/e2e/*` | 1.5d |
| W5.11 | Smoke tests por rol — actualizar `docs/smoke-tests.md` con flujos wellness completos (atleta, padre, pro) | `docs/smoke-tests.md` | 2h |
| W5.12 | Doc operacion — `docs/wellness-operations.md` (deploy open-wearables, rotar HMAC, rotar Daily API key, recompute manual recovery_scores, restore from backup) | `docs/wellness-operations.md` | 4h |

**Rama:** `feat/wellness-w5-hardening`
**Flag:** ninguno nuevo, consolida los anteriores
**Riesgo:** Bajo
**Cutover:** flags `WELLNESS_*` ON al 100% rollout, deprecar v1 schema en 30d post-cutover

---

### Mapeo BFF endpoints (Bloque 7)

```
bff/src/routes/wellness/
├── index.ts                    mount + middleware
├── exercises.ts                GET/POST/PATCH /exercises
├── pathologies.ts              GET /pathologies, GET /pathologies/:slug
├── plans.ts                    POST/GET/PATCH /plans, /plans/from-template, /plans/:id/clone
├── completions.ts              POST /exercises/:planExId/complete, GET /today
├── adherence.ts                GET /adherence/:planId
├── tests.ts                    GET /tests, POST /tests/:testId/apply, GET /tests/applications/:patientId
├── records.ts                  POST/PATCH /records, GET /records/:id
├── attachments.ts              POST /records/:id/attachments (signed URL)
├── consents.ts                 POST /consents/generate, /consents/:id/sign, GET /consents/:id/pdf
├── appointments.ts             GET /appointments/calendar, POST /appointments, /reschedule
├── intake.ts                   POST /appointments/:id/intake
├── soap.ts                     POST /appointments/:id/soap
├── telehealth.ts               POST /appointments/:id/telehealth/{start,end}
├── bundles.ts                  GET /bundles, POST /bundles/checkout
├── messages.ts                 GET /messages/threads, GET /messages/threads/:id, POST /messages
├── wearables.ts                POST /wearables/connect/:provider, GET/DELETE /wearables/connections, /wearables/data, /wearables/sync
├── ai.ts                       POST /ai/{suggest-plan,draft-soap,recovery-insight}, GET /ai/usage
├── recovery.ts                 GET /recovery-score
├── templates.ts                GET/POST /templates, POST /templates/:id/clone
└── webhooks/
    ├── open-wearables.ts       POST /webhooks/open-wearables (HMAC verify)
    └── daily.ts                POST /webhooks/daily (recordings)
```

### Mapeo RLS (23 tablas)

| Tabla | INSERT | SELECT | UPDATE | DELETE |
|---|---|---|---|---|
| `wellness_professional_profiles` | self | self + verified public | self | — |
| `therapy_exercises` | owner | publica + owner | owner | owner si `usage_count=0` |
| `pathologies` | service_role | all | service_role | service_role |
| `pathology_exercises` | service_role | all | service_role | service_role |
| `treatment_plans` | pro | pro + paciente + padre | pro | pro si `status='draft'` |
| `treatment_plan_exercises` | pro del plan | participantes plan | pro del plan | pro del plan |
| `exercise_completions` | paciente/padre | paciente/padre/pro | self <24h | — |
| `adherence_scores` | service_role (RPC) | participantes plan | service_role | — |
| `health_records_v2` | pro | pro full + paciente safe | pro | — |
| `clinical_attachments` | uploader | participantes record | — | uploader |
| `consent_documents` | pro | participantes | firmante (estado pending) | — |
| `functional_tests` | service_role | publica | service_role | service_role |
| `test_applications` | pro | pro + paciente + padre | — | — |
| `appointment_intake_forms` | filled_by | pro + paciente del appt | — | — |
| `appointment_soap_notes` | pro | solo pro (NO paciente) | pro | — |
| `telehealth_sessions` | service_role | participantes appt | service_role | — |
| `session_bundles` | comprador/pro | participantes | service_role | — |
| `bundle_redemptions` | service_role (RPC lock) | participantes bundle | — | — |
| `wellness_messages` | sender | sender/recipient/padre | recipient (read_at) | — |
| `wearable_connections` | self/padre | self/padre/pro tratante | self/padre | self/padre |
| `wearable_data_points` | service_role (webhook) | via connection | — | service_role TTL |
| `recovery_scores` | service_role (RPC) | self/padre/pro | service_role | — |
| `ai_clinical_interactions` | pro | pro autor | pro autor (approve) | — |
| `audit_log_clinical` | trigger | service_role only | RULE NO UPDATE | RULE NO DELETE |

### Mapeo storage buckets

| Bucket | Public | Path pattern | RLS resumida |
|---|---|---|---|
| `clinical-attachments` | no | `{patient}/{record}/file` | uploader + pro tratante + paciente con `visible_to_athlete` |
| `consent-pdfs` | no | `{patient}/{consent_id}.pdf` | participantes consent_documents |
| `exercise-photos` | no | `{patient}/{completion_id}.jpg` | paciente/padre/pro del plan |
| `pro-signatures` | no | `{pro}/signature.png` | self |
| `pro-branding` | si | `{pro}/logo.{ext}` | lectura publica |
| `exercise-thumbs` | si | `{exercise_id}.jpg` | lectura publica |
| `telehealth-recordings` | no | `{appointment}.mp4` | participantes, TTL 30d auto-delete |

### Pricing del bloque Wellness Pro

| | **Free** | **Pro $39 USD/mes** | **Enterprise $129 USD/mes** |
|---|---|---|---|
| Pacientes activos | 10 | ilimitado | ilimitado |
| Citas/mes | 50 | ilimitado | ilimitado |
| Biblioteca publica | 200 ej. | 1.500+ ej. | 1.500+ ej. |
| Ejercicios propios | 20 | ilimitado | ilimitado |
| Planes activos | 5 | ilimitado | ilimitado |
| Plantillas marketplace | leer | leer + publicar | leer + publicar |
| Tests funcionales | 5 (VAS, FMS, SLR, Y-Balance, Sit&Reach) | +30 tests | +30 tests |
| Adherencia + reportes | no | si | si |
| Bonos sesiones | no | si | si |
| Telesalud Daily.co | no | 600 min/mes | ilimitado |
| Wearables (open-wearables) | no | si | si |
| IA Coach Recovery | no | 50 sugerencias/mes | ilimitado |
| Branding / white-label | no | logo+color | + dominio + email |
| Multi-sede | no | no | si |
| Equipo (sub-cuentas) | no | no | hasta 10 |
| Compliance HIPAA-like BAA | no | no | si |

**Atletas y padres siempre gratis** — alineado a principio rector 5.

### Costos operativos del bloque

| Item | Costo SportMaps | Costo profesional |
|---|---|---|
| open-wearables self-host (Hetzner CX22) | ~5 EUR/mes | $0 |
| Daily.co (telesalud) | $0.004/min activos | $0 |
| DeepSeek V3 (~50 sugerencias + 100 SOAP/pro/mes) | ~$0.50/pro/mes | $0 |
| Resend email transaccional | $0 hasta 3k/mes | $0 |
| Supabase Storage (clinical-attachments, ~500MB/pro) | ~$0.01/pro/mes | $0 |
| Add-on Wellness Pro | (revenue) | $39-129/mes |

**Margen objetivo:** 92-96%.

### Metricas de exito

| KPI | Target mes 3 | Target mes 6 |
|---|---|---|
| Adherencia promedio (atletas activos) | ≥60% | ≥70% |
| Activacion atleta (1ra completion <72h) | ≥65% | ≥80% |
| Retencion fisio D30 | ≥75% | ≥85% |
| NPS pacientes | ≥40 | ≥50 |
| Conversion free→pro fisio | ≥6% | ≥10% |
| Tiempo creacion plan (con IA) | <3 min | <2 min |
| % citas teleconsulta | ≥20% | ≥35% |
| Bonos vendidos/mes | crecimiento 10% MoM | crecimiento 15% MoM |
| Margen bruto add-on | 92% | 95% |

---

## BLOQUE M — Marketplace & Vendor SaaS

**Origen:** No estaba en v1.2 del roadmap. Surgió como necesidad de monetizar coaches/schools/external_vendors vendiendo productos y servicios deportivos. Se ejecutó en paralelo a Bloques 2-4 entre abril-mayo 2026.

**Estado global:** 7 de 12 etapas entregadas (M1-M7 ✓). M8 (planes) es el siguiente foco.

**Principios específicos:**
- Cualquier rol activo (coach, school, personal_trainer, store_owner, external_vendor) puede activar Mi Tienda sin perder su rol primario — vía `vendor_profile.capabilities`.
- Todo producto pasa por `pending_review` antes de publicarse — gate de calidad mínimo.
- Doc de verificación (RUT/CC/cédula) es **opcional**: sin doc el vendor vende pero no aparece verificado.
- Stock atómico via RPC `confirm_order_payment` — no se confirma pago sin haber descontado inventario.
- Settlements idempotentes — `compute_settlements_for_order` puede llamarse N veces.

### Etapa M1 ✓ — Roles + capabilities (R1) [entregado abril 2026]

- Nuevo rol `external_vendor` + auto-promoción a `personal_trainer` para coaches que activan tienda.
- `vendor_profiles.capabilities` desacoplado de `profiles.role` → un coach puede vender servicios + productos sin dejar de ser coach.
- Middleware `requireVendorProfile(capability)` reemplaza `requireRole` en endpoints de vendor.
- Sidebar contextual + onboarding "Activar Mi Tienda" + CTA en dashboards.

**Migraciones:** `20260418000003_school_vendor_integration.sql`, `20260511000002_marketplace_role_capabilities_logic.sql`

### Etapa M2 ✓ — Producto rico (R2) [entregado abril-mayo 2026]

- `product_categories` jerárquica con `attribute_schema` JSON dinámico (ropa, calzado, suplementos, equipamiento, accesorios, servicios).
- 17 marcas oficiales en `product_brands`.
- `ProductWizard` 4 pasos: categoría → info + atributos dinámicos → variantes (matriz talla×color) → publicación.
- `ProductGalleryUploader` multi-imagen vía Supabase Storage.
- Estado `pending_review` + trigger `enforce_product_publish_gate` + `AdminMarketplaceModerationPage` (tab Productos).

**Migraciones:** `20260511000003_product_taxonomy_and_quality.sql`

### Etapa M3 ✓ — Reviews + Q&A (R3) [entregado mayo 2026]

- `product_reviews` con contexto deportivo (`sport_used_for`, `level`, `usage_duration`, `fit_feedback`).
- Verified purchase gate via RLS — solo quien compró puede reseñar.
- `product_questions` (Q&A público), `vendor_reviews`, sistema de votos `helpful`.
- Vendor inbox `/vendor/inbox` para responder preguntas.
- Agregados materializados en `products.avg_rating` y `vendor_profiles.avg_rating`.

**Migraciones:** `20260511000004_reviews_and_qa.sql`

### Etapa M4 ✓ — Pagos minimal (R5) [entregado mayo 2026]

- `vendor_bank_accounts` (cuentas + Nequi/Daviplata/Bre-B) — actualizado mayo 12 con neobancos colombianos.
- `settlements` (por order × vendor) + `vendor_balances` (running totals pending + available).
- `platform_config` (comisiones, gateway fees por provider).
- RPCs:
  - `compute_settlements_for_order` — crea settlements al confirmar pago, idempotente.
  - `release_settlements_for_vendor` — vendor solicita liquidación.
  - `request_payout` — crea entrada en `vendor_payouts`.
  - `admin_generate_pending_payouts` + `vendor_payout_summary`.
- `VendorPayoutsPage` (balance + cuentas + solicitar liquidación) + `AdminPayoutsPage` (confirmar pagos masivos).
- Constraint `one_origin <= 1` (relajada de `= 1`) para soportar payouts agregados.

**Migraciones:** `20260511000005_vendor_payouts_pipeline.sql`, `20260511000007_financial_engine_minimal.sql`, `20260511000008_payouts_functions_unconditional.sql`

### Etapa M5 ✓ — Logística (R4) [entregado mayo 2026]

- Namespace separado `marketplace_shipping_zones` + `marketplace_shipping_rates` para no chocar con tabla `shipping_zones` legacy.
- `shipping_carriers` con 10 transportadoras CO: Servientrega, Coordinadora, Interrapidísimo, Envía Colvanes, TCC, Mensajeros Urbanos, Picap, Rappi Cargo, pickup_in_store, vendor_delivers.
- `vendor_shipping_settings` (origen, dimensiones default, free shipping mínimo, carriers aceptados, política de devolución).
- `shipping_rate_quotes` con `quote_id` y `expires_at` anti-tampering.
- BFF con adapter pattern: `ShippingProvider` interface + `MockProvider` listo + slots para Mox/Drenvio.
- Endpoints: `POST /shipping/quote`, `GET /shipping/carriers`, `GET /shipping/tracking/:nro`, `POST /vendor/shipments/:id/{label,pickup,cancel}`, `POST /webhooks/shipping`.
- Frontend: `useShipping`, `<ShippingSelector>`, `VendorShippingSettingsPage`.

**Migraciones:** `20260511000020_shipping_provider_pipeline.sql` → `20260511000023_marketplace_shipping_namespace.sql`

### Etapa M6 ✓ — Cierre del ciclo de compra [entregado mayo 11 2026]

- `<ShippingSelector>` integrado en `CheckoutPage` (solo cuando hay productos en el carrito).
- Formulario de dirección + auto-cotización + bloqueo del botón Pagar hasta que se elija opción.
- `createProductOrder` agrupa todos los productos en una sola order, persiste `shipping_address` completa, `carrier`, `contact_phone`, `customer_name`.
- Insert automático en `shipments` con `status='pending'`, `carrier_code`, `estimated_delivery`.
- Webhooks Wompi y MercadoPago llaman `compute_settlements_for_order` después de `confirm_order_payment` + `split_order_payment` (idempotente).

**Commits:** `ab9bd62` (feat checkout)

### Etapa M7 ✓ — Admin verification queue [entregado mayo 12 2026]

- Tab nuevo "Vendors pendientes" en `AdminMarketplaceModerationPage` con preview de doc + datos del titular + capabilities.
- BFF endpoints:
  - `GET /admin/vendors/verification-queue?status=` (pending/verified/rejected/all).
  - `GET /admin/vendors/:id/doc-url` → `createSignedUrl` 5 min sobre bucket privado.
  - `POST /admin/vendors/:id/verify` con notificación al vendor.
- Bucket `vendor-docs` privado, 5 MB, mime restringido (PDF/JPG/PNG), policies path-based (owner CRUD + admin read).
- `notify_user` a todos los admins/super_admins cuando vendor sube doc.
- Sidebar super_admin: nueva sección "Moderación" con link a `/admin/marketplace/moderation`.

**Migraciones:** `20260512000004_vendor_docs_bucket.sql`
**Commits:** `421a8f3`, `4aa1e46`

### Etapa M8 ◯ — Planes vendor (Free / Pro / Elite) [próximo, ~6-8 h]

**Objetivo:** Monetizar vendors con tiers que combinen límites + comisión + verificación + visibilidad.

**Modelo propuesto (sujeto a decisión final del usuario):**

| Plan | Precio | Productos | Comisión | Verificación | Beneficios |
|---|---|---|---|---|---|
| Free | $0 | 10 max | 12 % | opcional | publica, sin badge, payouts cada 14 días |
| Pro | $49.000/mes | ilimitado | 8 % | requerida (cédula/RUT) | badge verificado, destacado, promociones, payouts semanales |
| Elite | $149.000/mes | ilimitado | 5 % | requerida (RUT + Cámara Comercio) | subdomain, analytics, API, soporte prioritario, payouts a demanda |

**Decisiones que faltan antes de implementar:**
1. Confirmar precios.
2. ¿Free permanente o trial 30 días? (conflicto con principio rector #6 del roadmap original).
3. Confirmar comisiones.
4. ¿Verificación es prerrequisito del plan o badge aparte?

**Tareas:**
- Migración `vendor_plans` + asignar `'free'` por default a todos vía trigger.
- RLS y trigger `enforce_vendor_product_limit` que limita productos según `vendor_plans.max_products`.
- Pantalla `/vendor/plans` con comparativa + CTA "Mejorar".
- Flujo de pago usando `recurring_subscriptions` (ya implementado en mayo 2026).
- Webhook que activa el plan tras pago aprobado + auto-renueva mensualmente.
- Email transaccional (depende de M12).

**Tablas:**
```sql
CREATE TABLE public.vendor_plans (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            text UNIQUE NOT NULL,
    name            text NOT NULL,
    price_monthly   numeric NOT NULL DEFAULT 0,
    max_products    integer,  -- NULL = unlimited
    commission_rate numeric NOT NULL,
    requires_verification boolean NOT NULL DEFAULT false,
    features        jsonb NOT NULL DEFAULT '[]',
    is_active       boolean NOT NULL DEFAULT true,
    sort_order      integer NOT NULL DEFAULT 0
);

ALTER TABLE public.vendor_profiles
    ADD COLUMN current_plan_id uuid REFERENCES public.vendor_plans(id),
    ADD COLUMN plan_started_at timestamptz,
    ADD COLUMN plan_renews_at  timestamptz;
```

### Etapa M9 ◯ — Multi-vendor split en carrito [~1 día]

- Particionar carrito por vendor → 1 order por vendor en vez de 1 order para todo.
- 1 shipment por vendor (cada uno cotiza por su origen y peso).
- UX: mostrar items separados por tienda en `CartContext` y `CheckoutPage`.
- Settlement se ejecuta naturalmente por vendor porque ya hoy `compute_settlements_for_order` agrupa por `vendor_id`.

### Etapa M10 ◯ — R6 Medios 3D / AR [~3 sem]

- Tabla `product_media` con `media_type IN ('image', 'video', '360', '3d_model', 'ar')`.
- `<model-viewer>` para `.glb`/`.gltf`.
- Captura cámara nativa (vía Capacitor, depende de N1 mobile).
- Visor 360° con foto-rotación.
- Storage bucket `product-media` con quota por plan.
- Solo Plan Elite (M8) puede subir 3D/AR — gating natural.

### Etapa M11 ◯ — Mox shipping provider real [~1 sem]

- Reemplazar `MockProvider` por `MoxShippingProvider`.
- Conseguir credenciales sandbox + entrevista comercial con Mox.
- Implementar `getQuotes`, `createLabel`, `trackShipment`, `schedulePickup`, `cancelShipment`.
- Webhook real para tracking updates.
- Backfill: tarifas reales en `marketplace_shipping_rates` (fallback global cuando Mox falla).

### Etapa M12 ◯ — Email transaccional para vendors [~3 h]

- Hook en `notify_user` RPC → trigger `emailClient.send` con template.
- Templates nuevos:
  - `vendor_new_order`
  - `vendor_payout_released`
  - `vendor_verification_approved`
  - `vendor_verification_rejected`
  - `vendor_plan_renewed`
  - `vendor_plan_expiring`
- Resend o SES como provider (decisión pendiente).

### Lecciones técnicas que costaron tiempo (M1-M7)

1. **Colisión de timestamps en migraciones** — dos archivos `20260511000006_*` causaron migración fantasma. Fix: timestamps únicos con segundos.
2. **Tablas preexistentes con shape distinto** — `shipping_zones` ya existía con `departamento NOT NULL` para otro dominio. Fix: namespace `marketplace_*`.
3. **Migraciones que skipean silenciosamente** — `DO $$ IF EXISTS table THEN CREATE FUNCTION $$` no marcaba error pero dejaba funciones inexistentes. Fix: definir funciones siempre con `to_regclass` guards adentro.
4. **`CREATE OR REPLACE` no cambia return type** — fix: `DROP FUNCTION IF EXISTS ... CASCADE` antes.
5. **Constraint `one_origin = 1`** en `vendor_payouts` bloqueaba payouts agregados. Fix: relajar a `<= 1`.
6. **Colisión de routes Express** — `marketplace.routes.ts` y `marketplace-catalog.routes.ts` ambos definían `/categories`; el primero ganaba y devolvía objeto en vez de array → `O.map is not a function` en ProductWizard. Fix: renombrar legacy + defensive `Array.isArray()` en hooks.

### Métricas de éxito Marketplace

| Métrica | Sem 1 | Sem 4 | Sem 12 |
|---|---|---|---|
| Vendors activos | 5 | 20 | 100 |
| Productos publicados | 50 | 200 | 1000 |
| Conversion checkout | ≥40% | ≥45% | ≥50% |
| % vendors verificados | 10% | 30% | 60% |
| MRR planes vendor | $0 | $300k COP | $5M COP |
| Vendors Pro/Elite | 0% | 15% | 30% |

---

## Resumen de esfuerzo total

| Bloque | Etapas | Dias-dev | Calendario |
|---|---|---|---|
| 1 — Fundamentos | A, B, C, D, O | 10 | Sem 1-3 |
| 2 — Cuentas + Billing | E, F, J | 10 | Sem 4-6 |
| 3 — Payments robustos | G, H, I | 9 | Sem 7-9 |
| 4 — Mobile | N1, N2, N3, (N4) | 20 + esperas | Sem 10-15 |
| 5 — Cierre | K, L, M | 8 | Sem 16-18 |
| 6 — WhatsApp AI Channel | WA1, WA2, WA3, WA4, (WA5 opcional) | 30 + esperas Meta | Sem 19-28 |
| 7 — Wellness Pro | W1, W2, W3, W4, W5 | 45 | Sem 19-26 paralelo Bloque 6 (otro dev) **o** Sem 29-36 secuencial |
| **M — Marketplace & Vendor SaaS** | M1-M7 ✓ entregados · M8-M12 pendiente | **~15 dias-dev** invertidos · ~10 dias-dev pendientes | **abril-mayo 2026 · pendiente jun-jul 2026** |
| **TOTAL optimista** (1 dev pleno, sin retrabajo, sin WA5, sin W) | | **~86.5 dias-dev** | **~28 semanas** |
| **TOTAL realista** (1-2 devs, con QA + retrabajo PR + WA5, sin W) | | **108-118 dias-dev** | **32-34 semanas** |
| **TOTAL realista CON Bloque 7** (2 devs paralelos Bloque 6+7) | | **~155 dias-dev** | **~32 semanas** |
| **TOTAL realista CON Bloque 7 secuencial** (1 dev) | | **~165 dias-dev** | **~38 semanas** |
| **TOTAL realista CON Bloque M completo** | añade Marketplace SaaS | **+10 dias-dev sobre cualquier total** | añade ~2 semanas |

Razones del delta: ciclos de QA por etapa, ida-y-vuelta de PRs grandes (C, G, N1) con bugs encontrados en staging, esperas de Apple Review (5-7 dias por ciclo, tipico 1-3 ciclos), preparacion de assets de tienda (N3.1-N3.6 en paralelo desde Sem 2 ahorra ~5 dias en Sem 14).

---

## Riesgos consolidados

| # | Riesgo | Bloque | Mitigacion |
|---|---|---|---|
| R1 | Apple rechaza por Guideline 4.2 (webview-only) | N3 | N2 mete push + biometria + QR (valor nativo real) |
| R2 | Apple rechaza por 3.1.1 (zona gris matricula vs feature digital) | N3 | Matriculas Wompi solo desbloquean **acceso a clases presenciales**, no features digitales (stats, reportes, gating). Si una matricula tambien desbloquea un modulo digital de la app, Apple puede exigir IAP. Auditar cada vez que se introduzca una nueva feature gateada por pago. |
| R3 | Wompi checkout no redirecciona en WebView | N1 | Usar `@capacitor/browser` como fallback |
| R4 | Deep links no funcionan sin config hostname | N1 | Alojar AASA/assetlinks en N1.7 + N1.8 |
| R5 | Push tokens expiran y dejan de llegar | N2 | `user_devices.last_seen_at` + cleanup job |
| R6 | IAP forzado por revisor humano pese a ser servicio fisico | N3 | Preparar defensa: "cobro por servicio presencial de entrenamiento", screenshots de clases reales |
| R7 | Certificados/keystores perdidos | N1 | Documentar en `docs/mobile-credentials.md` + guardar en 1Password team |
| R8 | BFF payments bug rompe cobros | G | Tests integracion obligatorios antes de merge |
| R9 | Gating bloquea por error a trial vigente | H | Modo `audit` 2 semanas antes de `soft` |
| R10 | Migraciones multi-cuenta corrompen data | C | Dry-run backfill + pg_dump previo |
| R11 | Verificacion Meta Tech Provider tarda 1-2 sem | WA1 | Iniciar tramite en Sem 1 (paralelo Bloque 1), no bloquea desarrollo previo |
| R12 | Bot alucina con datos sensibles de menores | WA2 | RLS estricta por `parent_id` verificado por OTP; rechazar respuesta del bot si tool call falla; auditoria completa en `admin_activity_logs` |
| R13 | Tokens Meta vencen sin renovar -> escuela offline | WA1 | Cron diario chequea -7d + auto-refresh + alerta admin; rotacion programada cada 60d |
| R14 | Una escuela spammea y suspenden Tech Provider de SportMaps | WA3 | Rate limit por escuela (1000 msg/min) + analisis automatico patrones + kill-switch super admin para suspension preventiva |
| R15 | Costos DeepSeek se disparan por mal uso o abuso | WA2 | Cache respuestas frecuentes (saludos, info estatica) + cuotas por plan + alertas a 80%/100% de cuota + monitoreo por escuela |
| R16 | Plantillas Meta rechazadas en aprobacion | WA3 | Probar primero en cuenta interna; tener 3 variantes por intent; documentar palabras prohibidas Meta en `docs/whatsapp-templates-guide.md` |
| R17 | Padre da numero/nombre erroneo y bot le da datos de otro atleta | WA2 | OTP obligatorio + flujo "no soy yo, contactar escuela" + RLS por `parent_id` post-verificacion (nunca por `phone` solo) |
| R18 | Escuelas hibridas mal clasificadas (academy + atletas adultos) en backfill de Etapa O | O | Query de deteccion (parents+adults_athletes>0) — corrida 2026-04-27, las 3 detectadas son data de prueba. Re-correr antes del merge para confirmar que no aparecieron nuevos casos. |
| R19 | RLS column-level Postgres <15 — `health_records_v2.private_notes` puede filtrarse al paciente si no soporta `GRANT SELECT (col)` granular | W2 | Validar version Postgres staging+prod antes de W2.2. Si <15, usar view `security_barrier` `health_records_patient_safe` como fuente unica para frontend paciente |
| R20 | Costo storage adjuntos clinicos crece sin control (RM/CT/DICOM = 5-50MB cada uno) | W2 | Cap por tier (Free 100MB, Pro 5GB, Enterprise 50GB), compresion server-side al subir, auto-archive >2 anos a cold storage |
| R21 | open-wearables abandono OSS o breaking changes en upgrade | W4 | Pinear version 0.4.x en docker-compose, fork interno como backup, monitorear releases manual cada 90d |
| R22 | IA Coach alucina diagnostico/sugerencia clinica | W4 | Tool-call obligatorio (sin tool result -> "insufficient_data"), aprobacion humana siempre antes de aplicar, schema-checked response, audit en `ai_clinical_interactions`, disclaimer permanente en UI |
| R23 | Daily.co minutos exceden tier (overage cobrado a SportMaps) | W3 | Alerta a 80% uso por pro, force upgrade tier al hit cuota, kill-switch pro-level si abuso |
| R24 | Padres no firman consentimiento del menor antes de la 1ra cita | W2 | Gating obligatorio: cita no se confirma sin consentimiento firmado, recordatorio push 24h y email 7d |
| R25 | Wearables PII leak del open-wearables al BFF | W4 | open-wearables retiene PII (nombre, email, OAuth tokens). BFF solo recibe `external_user_id` opaco + datapoints normalizados. HMAC en webhook + IP allowlist VPS |
| R26 | Adherencia baja por mala UX push (atletas mutean notificaciones) | W1 | A/B test horarios, copy variants, opt-out granular por tipo (ejercicios/citas/marketing), dashboard pro alerta a paciente sin completar 7d |
| R27 | Habeas Data borrado complejo (FKs en cascada vs retencion legal historia clinica 5 anos) | W5 | RPC `wellness_anonymize_patient` scrub PII pero conserva audit_log_clinical por ley + estructura datos. Email confirma cada paso al solicitante |
| R28 | Carga seed 200 ejercicios + 30 patologias + 30 tests es trabajo de curador especializado | W1, W2 | Curador externo (fisio Colombia/Espana) en sprint 0 antes de W1.2. Crowdsource desde fisios verificados via marketplace plantillas (W5.2) post-launch |
| R29 | Daily.co rooms persisten tras fin de cita (privacy) | W3 | TTL config 1h post `appointment_time + duration`, cron diario elimina rooms inactivas, audit en `audit_log_clinical` |
| R30 | DeepSeek API down en momento de sugerir plan | W4 | Fallback automatico a `pathology_exercises` table (sugerencia estatica del catalogo), UI muestra warning "modo offline" |

---

## Decisiones firmes (ya confirmadas)

1. **Tiers en codigo:** `free | pro | enterprise` (inamovible).
2. **Nombres comerciales:** placeholder "Start/Pro/Enterprise" por rol en `saas-plans.ts` (definitivos por validar).
3. **Athletes y parents:** siempre `free`, sin trial. Jamas.
4. **Trial para existentes al deploy:** `GREATEST(deploy_date + 30d, user.created_at + 30d)` — en practica, `deploy_date + 30d` para todos.
5. **Trial para nuevas cuentas de servicio:** trigger automatico en `AFTER INSERT ON user_accounts`.
6. **Soft limits (`>20 students` / `>5 clients`):** solo bloquean creacion nueva. Existentes no pierden acceso.
7. **`create_bulk_charges`:** solo genera filas pendientes. Cobro real via webhook gateway existente.
8. **Wizard unificado:** coexiste con flag. Quienes ya completaron onboarding viejo NO se re-preguntan.
9. **Tours (react-joyride):** post-cutover M.
10. **Rate-limit BFF:** 100 req/min/IP en mutaciones como arranque.
11. **WhatsApp Tech Provider:** SportMaps se registra una vez con Meta. Cada escuela conecta SU numero via Embedded Signup. La escuela paga WhatsApp directamente a Meta — fuera de la facturacion SportMaps.
12. **LLM:** DeepSeek V3 con function-calling (sin GPT/Claude). R1 solo como fallback en errores de V3. Razon: 5x mas barato y latencia adecuada para el caso de uso.
13. **Modo asistido por defecto el primer mes** de cada escuela. Pasar a auto requiere confirmacion explicita del admin tras revisar drafts.
14. **Identificacion obligatoria por OTP** la primera vez que un numero escribe. Sin verificacion, el bot solo da info publica (horarios generales, direccion).
15. **RLS estricta por `parent_id` verificado** — el bot nunca usa service role en datos sensibles. Cada tool function recibe el `parent_id` ya identificado.
16. **Pagos via WA usan SportMaps Pay/Wompi existente** — sin pasarela paralela. Comision 0% adicional sobre la existente.
17. **Cero alucinaciones tolerables** — si tool call falla, bot responde con mensaje neutro y escala a humano. Jamas inventa datos.
18. **Modelo de capacidades de escuela:** dos booleans (`manages_minors`, `manages_adults`) en `schools`, no enum. Permite hibridas desde dia uno. `school_type` queda como categoria de marketplace, no condiciona UI.
19. **Menores no tienen `user_account`** — los 334 registros en `children` viven bajo la cuenta `'parent'` del padre via `children.parent_id`. Solo el padre tiene cuenta + suscripcion. Refleja realidad legal (menores no contratan) y simplifica el modelo. Confirmado por diagnostico 2026-04-27.
20. **Multi-team es feature, no bug** — 30 children con enrollments activos en multiples teams del mismo club es valido (multi-disciplina). RLS y `user_accounts` deben permitirlo. Solo se limpian los 3 casos confirmados de duplicados al mismo team (A16).
21. **Backfill C3 ignora `unregistered_athletes`** — los 89 registros sin `linked_profile_id` no tienen `user_id`, no pueden tener `user_account`. Cuando un admin los vincule, entran al modelo unificado por la via normal del trigger en C5.
22. **Cuentas zombie de athlete se migran como personales** — los ~74 `profiles WHERE role='athlete' AND sin school_membership` entran a `user_accounts` con `account_type='athlete'` y `linked_school_id=NULL`. Son atletas individuales que aun no se afiliaron a una escuela. (Sujeto a A18 — revisar inactivos antes de migrar).
23. **Las views `students` y `school_athletes` son consumidores, no fuentes** — `children` es la unica BASE TABLE para atletas menores. Cualquier ALTER en `children` o `profiles` requiere `DROP VIEW ... CASCADE` y recrear las vistas.
24. **Datos clinicos sensibles** — `health_records_v2`, `clinical_attachments`, `consent_documents`, `telehealth_sessions` requieren RLS column-level + audit_log_clinical inmutable (RULE NO UPDATE/DELETE) + retencion 5 anos por Ley 23/1981 historia clinica Colombia.
25. **Wearables via open-wearables MIT self-host** — sin SDK propio. Garmin/Polar/Suunto via OAuth, HealthKit/Health Connect/Samsung via SDKs nativos del proyecto open-source. open-wearables retiene PII; BFF SportMaps solo recibe `external_user_id` opaco + datapoints normalizados.
26. **IA Coach Recovery con guardrails obligatorios** — DeepSeek V3 (mismo del Bloque 6), tool-call obligatorio para datos clinicos, cero PII en prompt, schema-checked response, aprobacion humana antes de aplicar cualquier sugerencia. Cero alucinaciones tolerables — alineado a decision firme 17.
27. **Telehealth con Daily.co** — sin SDK propio. Embed iframe, tokens efimeros, grabacion opcional con consentimiento explicito firmado tier enterprise. TTL de room 1h post-cita.
28. **Menor sin login propio si <13** — cuenta wellness vinculada al padre via `children`. 13-17 cuenta vinculada con padre en CC. ≥18 independiente, padre solo si autoriza. Alineado a decision firme 19.
29. **Consentimiento informado obligatorio** antes de la 1ra cita y antes de aplicar plan. Padre firma por menor. PDF guardado en `consent-pdfs` bucket con audit log inmutable.
30. **Atletas y padres siempre gratis en wellness** — solo el profesional paga (free 10 pacientes / pro $39 / enterprise $129). Alineado a principio rector 5.

---

## Decisiones pendientes (a cerrar antes de cada bloque)

### Antes de Etapa C.5 (White-label schools)

- [ ] Confirmar que white-label se ancla a `schools` (lo que ya existe) y W4.16 (wellness pros) reusa el modelo, vs. mantener W4.16 como rama paralela. Recomendacion: unificar.
- [ ] Tier gating final: ¿colores+logo desde `pro` o tambien `free` con watermark forzado? El roadmap [linea 973](docs/ROADMAP.md#L973) dice free=no — confirmar.
- [ ] Watermark: definir donde aparece (login, footer, emails, PDFs de pagos, certificados, ID cards) — afecta callsites de C5.10.
- [ ] Custom domains (C5.16): ¿add-on pagado aparte o incluido en `enterprise`? ¿Vercel Pro/Enterprise plan disponible para wildcard CNAME?
- [ ] Email templates: nivel de customizacion (header/footer/logo solo, o cuerpo completo con WYSIWYG + sandbox de variables)
- [ ] Onboarding white-label: self-service vs ticket de soporte (afecta SLA y UX en C5.16)
- [ ] Migracion de existentes: hay escuelas con `branding_settings` poblado pero anulado por el override — ¿auditar como cohorte beta antes del switch global, o flip masivo con feature flag?

### Antes de Bloque 4 (Mobile)

- [ ] Nombre comercial app movil ("SportMaps" o "Controla" u otro)
- [ ] Un solo `appId` unificado `co.sportmaps.app` vs apps separadas por rol
- [ ] Self-host macOS runner vs Codemagic/Appflow
- [ ] Push notifications: Supabase Edge Functions o BFF Express
- [ ] N4 offline es must-have o nice-to-have

### Antes de Bloque 6 (WhatsApp AI)

- [ ] Pricing exacto del add-on por mercado (Colombia, Mexico, otros LATAM) — validar elasticidad
- [ ] Idiomas soportados en MVP (es solo? + pt? + en?)
- [ ] Politica exacta de recordatorios proactivos por mercado (cantidad, horario, frecuencia)
- [ ] Escuela piloto seleccionada (volumen, perfil de padres, disposicion a iterar)
- [ ] Cuenta Meta Business de SportMaps verificada
- [ ] Decision sobre R1 fallback (incluir desde MVP o esperar a V2)
- [ ] Plan de soporte L1 ante fallas Meta (quien responde, SLA, escalamiento)
- [ ] Cuotas por plan: ¿conversaciones o mensajes? ¿como contar overage?
- [ ] Politica de privacidad y T&C actualizados con clausula AI sobre WhatsApp

### Antes de Bloque 7 (Wellness Pro)

- [ ] VPS/cloud para self-host open-wearables (Hetzner CX22 ~5 EUR/mes vs DigitalOcean vs AWS Lightsail)
- [ ] Plan Daily.co (start gratis hasta 10k min, scale $0.004/min, enterprise volumen)
- [ ] Cuenta DeepSeek con cap mensual de gasto + alertas a 80%/100%
- [ ] Curador de biblioteca inicial — fisio Colombia/Espana para 200 ejercicios + 30 patologias + 30 tests (sprint 0 antes de W1.2)
- [ ] Plantillas legales de consentimiento (4 docs) — abogado revisa antes de W2.9
- [ ] Pricing Pro $39 vs $49 vs $59 USD — validar elasticidad con 5 fisios beta
- [ ] Sub-rol `nutritionist` separado o uso `wellness_professional` con `specialties=['nutrition']`
- [ ] HIPAA-like BAA: ofrecer en MVP enterprise o post-MVP
- [ ] Provider OAuth wearables prioridad (Garmin tiene mas users LATAM, Polar es Europa)
- [ ] Politica retencion grabaciones telesalud (default 30d auto-delete)
- [ ] Verificacion licencia profesional — manual admin o integracion con organismo regulador (ColPro, Min Salud)

### Antes de Cutover M

- [ ] Nombres comerciales definitivos de tiers por rol
- [ ] Precio de cada tier por rol
- [ ] Descuento anual pre-cutover (20%?)
- [ ] Lista de stakeholders a notificar
- [ ] Fecha exacta del flip

---

## Arranque inmediato

**Semana 1, Dia 1 (orden estricto):**

1. **Diagnostico `team_id`** — ejecutar `docs/diagnostics/team_id_audit.sql` en staging. Decidir Escenario A (fix superficial `UPDATE` masivo) vs Escenario B (recuperacion historica cruzando pagos/asistencias).
2. **`pg_dump` baseline (A11)** — commit aislado con `docs/schema-baseline.md`.
3. **Si team_id roto:** PR fix aislado en `feat/fix-team-id-orphans` ANTES de cualquier otro quick win.
4. **Despues:** PR `fix/quick-wins` con A1, A2, A5, A6, A15 (los sub-10min). A7/A8/A10 separados por riesgo.

**Bloqueadores a resolver antes:**

- [ ] `DATABASE_URL` de staging accesible
- [ ] Cuenta Apple Developer activa (trámite toma 1-2 dias si no esta)
- [ ] Cuenta Google Play Console activa (1 dia)
- [ ] **Cuenta Meta Business verificada + solicitud Tech Provider iniciada** (tramite 1-2 sem) — necesaria para Bloque 6, iniciar en Sem 1 paralelo a Bloque 1

---

## ANEXO A — DDL canonico de tablas mencionadas en el roadmap

DDL canonico de tablas referenciadas pero no escritas explicitamente en las etapas. Sirve como contrato — la migracion de cada etapa debe respetarlo o documentar la divergencia.

### A.1 — Etapa C: multi-cuenta + tiers

```sql
-- C1: user_accounts
CREATE TABLE public.user_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_type          TEXT NOT NULL
                        CHECK (account_type IN ('athlete','parent','school','coach_personal',
                                                'vendor','organizer','wellness_professional','store_owner')),
  linked_school_id      UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  linked_membership_id  UUID REFERENCES public.school_members(id) ON DELETE SET NULL,
  role                  TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','migrated','archived')),
  metadata              JSONB DEFAULT '{}',
  migrated_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, account_type, linked_school_id)
);
CREATE INDEX idx_ua_user ON public.user_accounts(user_id);
CREATE INDEX idx_ua_school ON public.user_accounts(linked_school_id) WHERE linked_school_id IS NOT NULL;
CREATE INDEX idx_ua_type_status ON public.user_accounts(account_type, status);

-- C2: saas_subscriptions
CREATE TABLE public.saas_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  tier                  TEXT NOT NULL DEFAULT 'free'
                        CHECK (tier IN ('free','pro','enterprise')),
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('trialing','active','past_due','cancelled','expired')),
  trial_ends_at         TIMESTAMPTZ,
  period                TEXT NOT NULL DEFAULT 'monthly'
                        CHECK (period IN ('monthly','yearly')),
  provider              TEXT,
  wompi_subscription_id TEXT,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN DEFAULT false,
  cancelled_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id)
);
CREATE INDEX idx_ss_account ON public.saas_subscriptions(account_id);
CREATE INDEX idx_ss_trial_ending ON public.saas_subscriptions(trial_ends_at)
  WHERE status = 'trialing';

-- C3c: migration_decisions (auditoria backfill)
CREATE TABLE public.migration_decisions (
  id              BIGSERIAL PRIMARY KEY,
  source_table    TEXT NOT NULL,
  source_id       UUID NOT NULL,
  decision        TEXT NOT NULL,
  reason          TEXT,
  resulting_id    UUID,
  ts              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_md_source ON public.migration_decisions(source_table, source_id);
```

### A.2 — Etapa D: entitlements + gating

```sql
-- D5: gating_events (sink de logs en modo audit)
CREATE TABLE public.gating_events (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  account_id   UUID REFERENCES public.user_accounts(id) ON DELETE SET NULL,
  feature_key  TEXT NOT NULL,
  would_block  BOOLEAN NOT NULL,
  source       TEXT NOT NULL,           -- 'route_gate','module_gate','bff','rpc'
  ts           TIMESTAMPTZ DEFAULT NOW(),
  metadata     JSONB DEFAULT '{}'
);
CREATE INDEX idx_ge_account_feat ON public.gating_events(account_id, feature_key, ts DESC);
CREATE INDEX idx_ge_would_block ON public.gating_events(would_block, ts DESC) WHERE would_block;

-- (Nuevo, falta en roadmap actual) entitlements catalog
CREATE TABLE public.entitlements (
  account_id     UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  product        TEXT NOT NULL,           -- 'core','wellness','rcm','whatsapp'
  tier           TEXT NOT NULL DEFAULT 'free',
  audit_mode     BOOLEAN DEFAULT true,
  trial_ends_at  TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  features_json  JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (account_id, product)
);

-- (Nuevo) feature_flags globales con rollout %
CREATE TABLE public.feature_flags (
  flag         TEXT PRIMARY KEY,
  enabled      BOOLEAN DEFAULT false,
  rollout_pct  INT DEFAULT 0,
  allowlist    UUID[] DEFAULT '{}',
  blocklist    UUID[] DEFAULT '{}',
  payload      JSONB DEFAULT '{}',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### A.3 — Etapa G: payments idempotency

```sql
-- G3: idempotency_keys (Postgres-backed para sobrevivir reinicios)
CREATE TABLE public.idempotency_keys (
  key            TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_hash   TEXT NOT NULL,
  response_status INT,
  response_body  JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);
CREATE INDEX idx_idem_expires ON public.idempotency_keys(expires_at);

-- Cron diario para purga
-- DELETE FROM idempotency_keys WHERE expires_at < NOW();
```

### A.4 — Etapa J1: cargos masivos

```sql
-- J1: charge_templates (plantillas reutilizables)
CREATE TABLE public.charge_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  amount          NUMERIC(10,2) NOT NULL,
  currency        TEXT DEFAULT 'COP',
  due_day_of_month INT CHECK (due_day_of_month BETWEEN 1 AND 31),
  default_targets TEXT,                    -- 'all_active','team:{id}','program:{id}'
  category        TEXT,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ct_school ON public.charge_templates(school_id);
```

### A.5 — Etapa N2/PRE3: dispositivos

```sql
-- PRE3 / N2.1: user_devices
CREATE TABLE public.user_devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL CHECK (platform IN ('ios','android','web')),
  push_token    TEXT NOT NULL,
  device_model  TEXT,
  app_version   TEXT,
  os_version    TEXT,
  last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, push_token)
);
CREATE INDEX idx_ud_user ON public.user_devices(user_id);
CREATE INDEX idx_ud_stale ON public.user_devices(last_seen_at)
  WHERE last_seen_at < NOW() - INTERVAL '30 days';
```

### A.6 — Etapa N4: cola offline

```sql
-- Local SQLite (Capacitor) — schema replicable en cliente
-- pending_attendance
CREATE TABLE pending_attendance (
  id           TEXT PRIMARY KEY,           -- uuid client-generated
  team_id      TEXT NOT NULL,
  student_id   TEXT NOT NULL,
  status       TEXT NOT NULL,
  logged_at    TEXT NOT NULL,              -- ISO8601
  retry_count  INTEGER DEFAULT 0,
  last_error   TEXT,
  synced_at    TEXT
);

-- BFF recibe en bulk-sync
CREATE TABLE public.attendance_sync_log (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES public.profiles(id),
  device_id    TEXT,
  client_event_id TEXT,                    -- id del SQLite local
  attendance_id UUID,                       -- fk al insert real
  status       TEXT NOT NULL,               -- 'accepted','duplicate','rejected'
  reason       TEXT,
  ts           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, client_event_id)        -- idempotencia
);
```

### A.7 — Etapa WA1: 10 tablas WhatsApp

```sql
-- WA1.1: 10 tablas. DDL resumido (firma + indices clave + check de roles).

CREATE TABLE public.school_whatsapp_integrations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                UUID NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  waba_id                  TEXT NOT NULL,
  phone_number_id          TEXT NOT NULL UNIQUE,
  display_phone_number     TEXT NOT NULL,
  business_account_id      TEXT,
  access_token_encrypted   BYTEA NOT NULL,                 -- pgcrypto
  access_token_expires_at  TIMESTAMPTZ,
  webhook_verified_at      TIMESTAMPTZ,
  status                   TEXT DEFAULT 'active'
                           CHECK (status IN ('active','suspended','disconnected','error')),
  connected_at             TIMESTAMPTZ DEFAULT NOW(),
  disconnected_at          TIMESTAMPTZ,
  metadata                 JSONB DEFAULT '{}'
);

CREATE TABLE public.whatsapp_settings (
  school_id              UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  mode                   TEXT DEFAULT 'assisted' CHECK (mode IN ('manual','assisted','auto')),
  language               TEXT DEFAULT 'es',
  tone                   TEXT DEFAULT 'cercano' CHECK (tone IN ('formal','cercano','neutral')),
  business_hours         JSONB DEFAULT '{}',
  welcome_message        TEXT,
  confidence_threshold   NUMERIC(3,2) DEFAULT 0.85,
  reminder_aggressiveness TEXT DEFAULT 'normal'
                         CHECK (reminder_aggressiveness IN ('soft','normal','aggressive')),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.whatsapp_conversations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  parent_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  whatsapp_phone      TEXT NOT NULL,
  status              TEXT DEFAULT 'open'
                      CHECK (status IN ('open','escalated','resolved','blocked')),
  last_message_at     TIMESTAMPTZ DEFAULT NOW(),
  last_intent         TEXT,
  identified_at       TIMESTAMPTZ,
  assigned_admin_id   UUID REFERENCES public.profiles(id),
  bot_enabled         BOOLEAN DEFAULT true,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (school_id, whatsapp_phone)
);
CREATE INDEX idx_wac_school_status ON public.whatsapp_conversations(school_id, status, last_message_at DESC);

CREATE TABLE public.whatsapp_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  direction           TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  whatsapp_message_id TEXT UNIQUE,                          -- idempotencia con Meta
  content             TEXT,
  media_url           TEXT,
  media_type          TEXT,
  template_name       TEXT,
  intent              TEXT,
  confidence          NUMERIC(3,2),
  actor_type          TEXT CHECK (actor_type IN ('parent','bot','admin')),
  actor_id            UUID,
  status              TEXT DEFAULT 'sent'
                      CHECK (status IN ('sent','delivered','read','failed','queued')),
  failed_reason       TEXT,
  ts                  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_wam_conv_ts ON public.whatsapp_messages(conversation_id, ts DESC);

CREATE TABLE public.whatsapp_message_drafts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  proposed_content TEXT NOT NULL,
  intent          TEXT,
  confidence      NUMERIC(3,2),
  tool_calls      JSONB DEFAULT '[]',
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','sent')),
  reviewed_by     UUID REFERENCES public.profiles(id),
  reviewed_at     TIMESTAMPTZ,
  edited_content  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.whatsapp_payment_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id),
  payment_id      UUID REFERENCES public.payments(id),
  invoice_id      UUID,
  link_url        TEXT NOT NULL,
  amount          NUMERIC(10,2) NOT NULL,
  status          TEXT DEFAULT 'sent'
                  CHECK (status IN ('sent','clicked','paid','expired','cancelled')),
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  clicked_at      TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE public.whatsapp_quotas (
  account_id            UUID PRIMARY KEY REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  tier_addon            TEXT NOT NULL CHECK (tier_addon IN ('starter','pro','enterprise')),
  conversations_included INT NOT NULL,
  conversations_used    INT DEFAULT 0,
  overage_per_unit      NUMERIC(6,4) NOT NULL,
  period_start          DATE NOT NULL,
  period_end            DATE NOT NULL,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.whatsapp_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID REFERENCES public.schools(id) ON DELETE CASCADE,  -- NULL = template global SportMaps
  meta_template_id TEXT,
  name            TEXT NOT NULL,
  category        TEXT,                    -- 'utility','marketing','authentication'
  language        TEXT DEFAULT 'es',
  body            TEXT NOT NULL,
  variables       JSONB DEFAULT '[]',
  status          TEXT DEFAULT 'draft'
                  CHECK (status IN ('draft','submitted','approved','rejected','disabled')),
  rejection_reason TEXT,
  submitted_at    TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.whatsapp_identifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  email_to_verify TEXT NOT NULL,
  otp_hash        TEXT NOT NULL,
  attempts        INT DEFAULT 0,
  expires_at      TIMESTAMPTZ NOT NULL,
  verified_at     TIMESTAMPTZ,
  parent_id       UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.whatsapp_blocked_numbers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  whatsapp_phone TEXT NOT NULL,
  reason       TEXT,
  blocked_by   UUID REFERENCES public.profiles(id),
  blocked_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (school_id, whatsapp_phone)
);
```

### A.8 — Etapa F: subscriptions Wompi (faltaba en roadmap)

```sql
-- F3 (faltante): tracking de suscripciones de pago SaaS
CREATE TABLE public.wompi_subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saas_subscription_id    UUID NOT NULL REFERENCES public.saas_subscriptions(id) ON DELETE CASCADE,
  provider                TEXT NOT NULL CHECK (provider IN ('wompi','epayco')),
  provider_subscription_id TEXT NOT NULL UNIQUE,
  customer_id             TEXT,
  payment_method_token    TEXT,
  next_billing_at         TIMESTAMPTZ,
  last_event_id           TEXT,
  last_event_at           TIMESTAMPTZ,
  status                  TEXT NOT NULL,
  metadata                JSONB DEFAULT '{}',
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ws_sub ON public.wompi_subscriptions(saas_subscription_id);

-- Idempotencia webhook gateway (separado de pagos one-shot G3)
CREATE TABLE public.gateway_webhook_events (
  id            BIGSERIAL PRIMARY KEY,
  provider      TEXT NOT NULL,
  event_id      TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL,
  signature     TEXT,
  signature_ok  BOOLEAN,
  processed_at  TIMESTAMPTZ,
  error         TEXT,
  received_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, event_id)
);
```

---

## ANEXO B — RLS canonica de tablas mencionadas en el roadmap

Policies SQL que el migration de cada etapa debe materializar.

### B.1 — user_accounts / saas_subscriptions / migration_decisions

```sql
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

-- C6: usuario solo ve sus propias cuentas
CREATE POLICY ua_select ON public.user_accounts FOR SELECT
  USING (user_id = auth.uid());
-- Inserts via service role (trigger C5) o admin
CREATE POLICY ua_insert_admin ON public.user_accounts FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY ua_update_self ON public.user_accounts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND status != 'archived');

ALTER TABLE public.saas_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ss_select ON public.saas_subscriptions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_accounts ua
            WHERE ua.id = account_id AND ua.user_id = auth.uid())
  );
-- Writes solo via RPC SECURITY DEFINER (cambio de tier por billing flow)

ALTER TABLE public.migration_decisions ENABLE ROW LEVEL SECURITY;
-- Solo admin (auditoria de backfill)
CREATE POLICY md_admin ON public.migration_decisions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
```

### B.2 — entitlements / feature_flags / gating_events

```sql
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY ent_select ON public.entitlements FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_accounts ua
            WHERE ua.id = account_id AND ua.user_id = auth.uid())
  );

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY ff_select_all ON public.feature_flags FOR SELECT USING (true);
-- Writes solo service role (panel super-admin)

ALTER TABLE public.gating_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ge_insert_self ON public.gating_events FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY ge_select_admin ON public.gating_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
```

### B.3 — payments hardening (G6)

```sql
-- G6: revocar mutacion directa a payments para forzar BFF
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM authenticated;
-- SELECT se conserva con su policy actual

-- L (lecturas via BFF tambien)
-- En vez de revocar SELECT (rompe muchas paginas), se mantiene RLS estricta y BFF
-- aplica filtros adicionales como cache.

-- idempotency_keys: solo el dueno
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY ik_self ON public.idempotency_keys FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- gateway_webhook_events: solo admin
ALTER TABLE public.gateway_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY gwe_admin ON public.gateway_webhook_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
```

### B.4 — charge_templates (J1)

```sql
ALTER TABLE public.charge_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY ct_select ON public.charge_templates FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.school_members sm
            WHERE sm.school_id = charge_templates.school_id
              AND sm.profile_id = auth.uid()
              AND sm.role IN ('school','school_admin','admin')
              AND sm.status = 'active')
  );

CREATE POLICY ct_modify ON public.charge_templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.school_members sm
            WHERE sm.school_id = charge_templates.school_id
              AND sm.profile_id = auth.uid()
              AND sm.role IN ('school','school_admin','admin')
              AND sm.status = 'active')
  )
  WITH CHECK (created_by = auth.uid());
```

### B.5 — user_devices

```sql
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY ud_self ON public.user_devices FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### B.6 — attendance_sync_log (N4)

```sql
ALTER TABLE public.attendance_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY asl_self ON public.attendance_sync_log FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY asl_insert_self ON public.attendance_sync_log FOR INSERT
  WITH CHECK (user_id = auth.uid());
```

### B.7 — WhatsApp tablas

```sql
-- WA1.2 detallado: RLS estricta por school_id

ALTER TABLE public.school_whatsapp_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY swi_select ON public.school_whatsapp_integrations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.school_members sm
          WHERE sm.school_id = school_whatsapp_integrations.school_id
            AND sm.profile_id = auth.uid()
            AND sm.role IN ('school','school_admin','admin')
            AND sm.status = 'active')
);
-- Tokens nunca expuestos al cliente: SELECT explicitamente excluye access_token_encrypted
-- Frontend usa view o RPC que omite la columna
CREATE OR REPLACE VIEW public.school_whatsapp_integrations_safe AS
  SELECT id, school_id, waba_id, phone_number_id, display_phone_number,
         business_account_id, webhook_verified_at, status, connected_at,
         disconnected_at, metadata
    FROM public.school_whatsapp_integrations;

ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_school ON public.whatsapp_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.school_members sm
          WHERE sm.school_id = whatsapp_settings.school_id
            AND sm.profile_id = auth.uid()
            AND sm.role IN ('school','school_admin','admin')
            AND sm.status = 'active')
);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY wac_school ON public.whatsapp_conversations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.school_members sm
          WHERE sm.school_id = whatsapp_conversations.school_id
            AND sm.profile_id = auth.uid()
            AND sm.role IN ('school','school_admin','admin','coach')
            AND sm.status = 'active')
  OR parent_id = auth.uid()    -- el padre ve su propia conversacion
);
-- Inserts/updates SOLO desde service role (bot/webhook). No exponer al cliente.

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY wam_via_conv ON public.whatsapp_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.whatsapp_conversations c
          WHERE c.id = whatsapp_messages.conversation_id
            AND (c.parent_id = auth.uid()
                 OR EXISTS (SELECT 1 FROM public.school_members sm
                            WHERE sm.school_id = c.school_id
                              AND sm.profile_id = auth.uid()
                              AND sm.status = 'active')))
);

ALTER TABLE public.whatsapp_message_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY wamd_admin ON public.whatsapp_message_drafts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.whatsapp_conversations c
          JOIN public.school_members sm ON sm.school_id = c.school_id
          WHERE c.id = whatsapp_message_drafts.conversation_id
            AND sm.profile_id = auth.uid()
            AND sm.role IN ('school','school_admin','admin')
            AND sm.status = 'active')
);

ALTER TABLE public.whatsapp_payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY wpl_select ON public.whatsapp_payment_links FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.whatsapp_conversations c
          WHERE c.id = whatsapp_payment_links.conversation_id
            AND (c.parent_id = auth.uid()
                 OR EXISTS (SELECT 1 FROM public.school_members sm
                            WHERE sm.school_id = c.school_id
                              AND sm.profile_id = auth.uid()
                              AND sm.role IN ('school','school_admin','admin'))))
);

ALTER TABLE public.whatsapp_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY wq_select ON public.whatsapp_quotas FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_accounts ua
          WHERE ua.id = whatsapp_quotas.account_id
            AND ua.user_id = auth.uid())
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY wt_select ON public.whatsapp_templates FOR SELECT USING (
  school_id IS NULL                                                  -- globales
  OR EXISTS (SELECT 1 FROM public.school_members sm
             WHERE sm.school_id = whatsapp_templates.school_id
               AND sm.profile_id = auth.uid()
               AND sm.status = 'active')
);

ALTER TABLE public.whatsapp_identifications ENABLE ROW LEVEL SECURITY;
-- Solo service role escribe; nadie lee directamente (otp en hash)

ALTER TABLE public.whatsapp_blocked_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY wbn_admin ON public.whatsapp_blocked_numbers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.school_members sm
          WHERE sm.school_id = whatsapp_blocked_numbers.school_id
            AND sm.profile_id = auth.uid()
            AND sm.role IN ('school','school_admin','admin')
            AND sm.status = 'active')
);
```

### B.8 — Column-level RLS A8 (medical_info / phone)

```sql
-- A8: column-level revoke
REVOKE SELECT ON public.children FROM authenticated;
GRANT SELECT (id, parent_id, school_id, branch_id, full_name, dob, sex,
              status, created_at, updated_at)
  ON public.children TO authenticated;
-- Padre ve TODAS las columnas de su hijo via policy + grant adicional
GRANT SELECT (medical_info, phone) ON public.children TO authenticated;
-- (En Postgres, GRANT con WHERE no existe; se enforce en policy)
CREATE POLICY children_sensitive_self ON public.children FOR SELECT
  USING (
    parent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.school_members sm
               WHERE sm.school_id = children.school_id
                 AND sm.profile_id = auth.uid()
                 AND sm.role IN ('school','school_admin','admin','coach','wellness_professional')
                 AND sm.status = 'active')
  );
```

---

## ANEXO C — Catalogo BFF endpoints

Catalogo maestro de endpoints planeados con: ruta · metodo · auth · validacion · idempotency · etapa.

### C.1 — Accounts (Etapa E)

| Metodo | Ruta | Auth | Body | Response | Idempotent | Etapa |
|---|---|---|---|---|---|---|
| GET | `/api/v1/accounts/me` | jwt | — | `{ accounts: UserAccount[] }` | ✓ | E |
| POST | `/api/v1/accounts/switch` | jwt | `{ account_id }` | `{ active_account_id, jwt_refreshed: bool }` | ✓ | E |
| POST | `/api/v1/accounts` | jwt | `{ account_type, linked_school_id? }` | `UserAccount` | `Idempotency-Key` | E |
| PATCH | `/api/v1/accounts/:id` | jwt + owner | `{ status?, metadata? }` | `UserAccount` | — | E |

### C.2 — Billing (Etapa F)

| Metodo | Ruta | Auth | Body | Response | Idempotent | Etapa |
|---|---|---|---|---|---|---|
| GET | `/api/v1/billing/me` | jwt | — | `{ subscriptions: SaasSubscription[] }` | ✓ | F |
| POST | `/api/v1/billing/upgrade` | jwt | `{ account_id, target_tier, period }` | `{ checkout_url }` | `Idempotency-Key` | F |
| POST | `/api/v1/billing/cancel` | jwt | `{ account_id, at_period_end: bool }` | `SaasSubscription` | `Idempotency-Key` | F |
| POST | `/api/v1/billing/downgrade` | jwt | `{ account_id, target_tier }` | `{ effective_at }` | `Idempotency-Key` | F |
| POST | `/api/v1/billing/webhooks/wompi-subscription` | HMAC | gateway payload | `{ ok: true }` | event_id dedupe | F |
| POST | `/api/v1/billing/webhooks/epayco-subscription` | HMAC | gateway payload | `{ ok: true }` | event_id dedupe | F |

### C.3 — Entitlements (Etapa D)

| Metodo | Ruta | Auth | Response | Etapa |
|---|---|---|---|---|
| GET | `/api/v1/entitlements/me` | jwt | `{ tiers: { core, wellness, whatsapp, rcm }, audit_mode }` | D |
| GET | `/api/v1/entitlements/feature/:key` | jwt | `{ enabled, would_block, reason }` | D |
| POST | `/api/v1/entitlements/audit-event` | jwt | logged in `gating_events` | D |

### C.4 — Payments (Etapas G, L)

| Metodo | Ruta | Auth | Body | Response | Idempotent | Etapa |
|---|---|---|---|---|---|---|
| POST | `/api/v1/payments/checkout` | jwt | `{ amount, currency, payer_id, target_id, target_type, ... }` | `{ payment_id, checkout_url }` | `Idempotency-Key` | G1 |
| POST | `/api/v1/payments/register-cash` | jwt + admin | `{ payment_id, received_at, notes? }` | `Payment` | `Idempotency-Key` | G1 |
| POST | `/api/v1/payments/approve` | jwt + admin | `{ payment_id, method? }` | `Payment` | `Idempotency-Key` | G1 |
| PATCH | `/api/v1/payments/:id/status` | jwt + admin | `{ status, reason? }` | `Payment` | — | G1 |
| GET | `/api/v1/payments/list` | jwt | qs: `school_id, from, to, status` | `{ items: Payment[], total }` | cache 60s | L1 |
| GET | `/api/v1/payments/aggregate` | jwt | qs: `school_id, group_by, period` | `{ buckets: ... }` | cache 60s | L1 |
| GET | `/api/v1/payments/:id/status-check` | jwt | — | `{ status, gateway_status }` | — | L1 |
| POST | `/api/v1/payments/webhooks/wompi` | HMAC | gateway payload | `{ ok: true }` | event_id dedupe | G0/G4a |
| POST | `/api/v1/payments/webhooks/epayco` | HMAC | gateway payload | `{ ok: true }` | event_id dedupe | G0/G4a |

### C.5 — Devices y push (Etapa N2)

| Metodo | Ruta | Auth | Body | Response | Etapa |
|---|---|---|---|---|---|
| POST | `/api/v1/devices/register` | jwt | `{ platform, push_token, device_model?, app_version?, os_version? }` | `Device` | PRE2 |
| POST | `/api/v1/devices/unregister` | jwt | `{ push_token }` | `{ ok }` | PRE2 |
| POST | `/api/v1/devices/heartbeat` | jwt | `{ push_token }` | `{ ok }` | PRE2 |

### C.6 — Attendance bulk-sync (N4)

| Metodo | Ruta | Auth | Body | Response | Idempotent | Etapa |
|---|---|---|---|---|---|---|
| POST | `/api/v1/attendance/bulk-sync` | jwt + coach | `{ events: [{ client_event_id, team_id, student_id, status, logged_at }] }` | `{ accepted: [], duplicates: [], rejected: [] }` | per `client_event_id` | N4.4 |

### C.7 — WhatsApp (Bloque 6)

| Metodo | Ruta | Auth | Body | Response | Idempotent | Etapa |
|---|---|---|---|---|---|---|
| POST | `/api/v1/whatsapp/integrations/connect` | jwt + school_admin | `{ embedded_signup_token }` | `{ school_whatsapp_integration_id, status }` | — | WA1.7 |
| POST | `/api/v1/whatsapp/integrations/refresh` | jwt + school_admin | — | `{ access_token_expires_at }` | — | WA1 |
| DELETE | `/api/v1/whatsapp/integrations/:id` | jwt + school_admin | — | `{ ok }` | — | WA1 |
| GET | `/api/v1/whatsapp/conversations` | jwt + school | qs filtros | `{ items: Conversation[] }` | — | WA2.12 |
| GET | `/api/v1/whatsapp/conversations/:id/messages` | jwt + school/parent | qs paginacion | `{ items: Message[] }` | — | WA2 |
| POST | `/api/v1/whatsapp/conversations/:id/send` | jwt + school | `{ content, template_name? }` | `Message` | `Idempotency-Key` | WA2 |
| POST | `/api/v1/whatsapp/drafts/:id/approve` | jwt + school | `{ edited_content? }` | `Message` | — | WA2.13 |
| POST | `/api/v1/whatsapp/drafts/:id/reject` | jwt + school | `{ reason }` | `{ ok }` | — | WA2.13 |
| POST | `/api/v1/whatsapp/conversations/:id/escalate` | jwt + school | — | `Conversation` | — | WA2 |
| POST | `/api/v1/whatsapp/conversations/:id/resolve` | jwt + school | — | `Conversation` | — | WA4 |
| POST | `/api/v1/whatsapp/templates` | jwt + school | `{ name, category, body, variables, language }` | `Template` | — | WA4.5 |
| POST | `/api/v1/whatsapp/templates/:id/submit` | jwt + school | — | `{ meta_template_id, status }` | — | WA3.3 |
| GET | `/api/v1/whatsapp/analytics` | jwt + school | qs `period` | `{ kpis }` | cache 5m | WA4.6 |
| POST | `/api/v1/whatsapp/blocked-numbers` | jwt + school | `{ phone, reason }` | `BlockedNumber` | — | WA4.7 |
| POST | `/api/v1/whatsapp/identification/verify-otp` | anon | `{ conversation_id, otp }` | `{ identified: bool, parent_id? }` | rate-limited | WA2.8 |
| POST | `/api/v1/webhooks/whatsapp` | HMAC Meta | Meta webhook payload | `{ ok }` | whatsapp_message_id dedupe | WA1.5 |

### C.8 — Wellness (Bloque 7) — referencia

(Ver seccion "Mapeo BFF endpoints (Bloque 7)" arriba — 50+ rutas.)

---

## ANEXO D — RPCs Postgres con firma completa

RPCs `SECURITY DEFINER` mencionadas en el roadmap pero sin firma escrita.

### D.1 — Etapa B8: get_public_profile_info

```sql
CREATE OR REPLACE FUNCTION public.get_public_profile_info(
  _role        TEXT,
  _entity_id   UUID
)
RETURNS TABLE (
  id              UUID,
  full_name       TEXT,
  avatar_url      TEXT,
  cover_url       TEXT,
  bio             TEXT,
  city            TEXT,
  rating_avg      NUMERIC(3,2),
  rating_count    INT,
  is_verified     BOOLEAN,
  public_data     JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Solo devuelve datos si public_profile_enabled=true en la fila correspondiente
  IF _role = 'coach_personal' THEN
    RETURN QUERY
      SELECT cp.id, p.full_name, p.avatar_url, cp.cover_url, cp.bio, p.city,
             cp.rating_avg, cp.rating_count, cp.is_verified, cp.public_data
        FROM public.coach_profiles cp
        JOIN public.profiles p ON p.id = cp.user_id
       WHERE cp.id = _entity_id AND cp.public_profile_enabled = true;
  ELSIF _role = 'vendor' THEN
    RETURN QUERY
      SELECT vp.id, vp.business_name, vp.logo_url, vp.cover_url, vp.bio, vp.city,
             vp.rating_avg, vp.rating_count, vp.is_verified, vp.public_data
        FROM public.vendor_profiles vp
       WHERE vp.id = _entity_id AND vp.public_profile_enabled = true;
  ELSIF _role = 'wellness_professional' THEN
    RETURN QUERY
      SELECT wpp.id, p.full_name, p.avatar_url, NULL::text, wpp.bio, NULL::text,
             NULL::numeric, 0, wpp.is_verified, jsonb_build_object('specialties', wpp.specialties)
        FROM public.wellness_professional_profiles wpp
        JOIN public.profiles p ON p.id = wpp.user_id
       WHERE wpp.id = _entity_id;
  ELSIF _role = 'organizer' THEN
    RETURN QUERY
      SELECT op.id, op.organization_name, op.logo_url, op.cover_url, op.bio, op.city,
             NULL::numeric, 0, op.is_verified, op.public_data
        FROM public.organizer_profiles op
       WHERE op.id = _entity_id AND op.public_profile_enabled = true;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_info(TEXT, UUID) TO anon, authenticated;
```

### D.2 — Etapa C5: trigger auto-subscribe

```sql
CREATE OR REPLACE FUNCTION public.trg_auto_subscribe_on_account_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_is_service_role BOOLEAN := NEW.account_type IN (
    'school','coach_personal','vendor','organizer','wellness_professional','store_owner'
  );
BEGIN
  IF v_is_service_role THEN
    INSERT INTO public.saas_subscriptions (
      account_id, tier, status, trial_ends_at, period
    )
    VALUES (
      NEW.id, 'pro', 'trialing', NOW() + INTERVAL '30 days', 'monthly'
    )
    ON CONFLICT (account_id) DO NOTHING;
  ELSE
    INSERT INTO public.saas_subscriptions (account_id, tier, status, period)
    VALUES (NEW.id, 'free', 'active', 'monthly')
    ON CONFLICT (account_id) DO NOTHING;
  END IF;

  -- Crear entitlement por producto core
  INSERT INTO public.entitlements (account_id, product, tier, audit_mode, trial_ends_at)
  VALUES (NEW.id,
          'core',
          CASE WHEN v_is_service_role THEN 'pro' ELSE 'free' END,
          true,
          CASE WHEN v_is_service_role THEN NOW() + INTERVAL '30 days' ELSE NULL END)
  ON CONFLICT (account_id, product) DO NOTHING;

  RETURN NEW;
END $$;

CREATE TRIGGER auto_subscribe_account
  AFTER INSERT ON public.user_accounts
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_subscribe_on_account_insert();
```

### D.3 — Etapa J1: create_bulk_charges

```sql
CREATE OR REPLACE FUNCTION public.create_bulk_charges(
  _school_id   UUID,
  _template_id UUID,
  _targets     JSONB,                 -- { type: 'team'|'program'|'all_active'|'list', ids: [...] }
  _due_date    DATE,
  _override_amount NUMERIC DEFAULT NULL,
  _override_description TEXT DEFAULT NULL
)
RETURNS TABLE (
  created_count INT,
  skipped_count INT,
  charge_ids    UUID[]
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_template charge_templates%ROWTYPE;
  v_charge_ids UUID[] := '{}';
  v_skipped INT := 0;
  v_target_ids UUID[];
BEGIN
  -- Auth: solo school_admin/admin del schoolId
  IF NOT EXISTS (
    SELECT 1 FROM public.school_members sm
    WHERE sm.school_id = _school_id
      AND sm.profile_id = auth.uid()
      AND sm.role IN ('school','school_admin','admin')
      AND sm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_template FROM public.charge_templates
   WHERE id = _template_id AND school_id = _school_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Template not found'; END IF;

  -- Resolver targets en una lista de profile_id
  IF _targets->>'type' = 'all_active' THEN
    SELECT array_agg(sm.profile_id) INTO v_target_ids
      FROM public.school_members sm
     WHERE sm.school_id = _school_id AND sm.status = 'active'
       AND sm.role IN ('parent','athlete');
  ELSIF _targets->>'type' = 'team' THEN
    SELECT array_agg(DISTINCT e.payer_id) INTO v_target_ids
      FROM public.enrollments e
     WHERE e.team_id = ANY(SELECT (jsonb_array_elements_text(_targets->'ids'))::uuid)
       AND e.status = 'active';
  ELSIF _targets->>'type' = 'list' THEN
    SELECT array_agg(x::uuid) INTO v_target_ids
      FROM jsonb_array_elements_text(_targets->'ids') x;
  END IF;

  -- Crear filas pendientes
  WITH inserted AS (
    INSERT INTO public.payments (
      school_id, payer_id, amount, currency, due_date,
      description, status, source, charge_template_id, created_by
    )
    SELECT _school_id, t,
           COALESCE(_override_amount, v_template.amount),
           v_template.currency, _due_date,
           COALESCE(_override_description, v_template.name),
           'pending', 'bulk_template', _template_id, auth.uid()
      FROM unnest(v_target_ids) t
    ON CONFLICT (school_id, payer_id, due_date, charge_template_id) DO NOTHING
    RETURNING id
  )
  SELECT array_agg(id) INTO v_charge_ids FROM inserted;

  v_skipped := array_length(v_target_ids, 1) - COALESCE(array_length(v_charge_ids, 1), 0);

  RETURN QUERY SELECT
    COALESCE(array_length(v_charge_ids, 1), 0),
    COALESCE(v_skipped, 0),
    COALESCE(v_charge_ids, '{}');
END $$;

GRANT EXECUTE ON FUNCTION public.create_bulk_charges(UUID, UUID, JSONB, DATE, NUMERIC, TEXT) TO authenticated;
```

### D.4 — Etapa WA1: RPCs SECURITY DEFINER para tokens

```sql
-- Devuelve token descifrado SOLO al backend (con role 'service_role')
CREATE OR REPLACE FUNCTION public.get_whatsapp_access_token(_school_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Bloquear cualquier llamada desde authenticated o anon
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT pgp_sym_decrypt(access_token_encrypted,
                         current_setting('app.whatsapp_token_key'))
    INTO v_token
    FROM public.school_whatsapp_integrations
   WHERE school_id = _school_id AND status = 'active';

  RETURN v_token;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_whatsapp_access_token(UUID) FROM PUBLIC, anon, authenticated;

-- Almacena token cifrado
CREATE OR REPLACE FUNCTION public.set_whatsapp_access_token(
  _school_id UUID, _token TEXT, _expires_at TIMESTAMPTZ
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.school_whatsapp_integrations
     SET access_token_encrypted = pgp_sym_encrypt(_token,
                                                  current_setting('app.whatsapp_token_key')),
         access_token_expires_at = _expires_at,
         status = 'active'
   WHERE school_id = _school_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_whatsapp_access_token(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
```

---

## ANEXO E — Tiempos individuales por etapa (P5)

Tiempos individuales que faltaban en las tablas de las etapas existentes. Estimaciones de 1 dev senior con familiaridad del codebase.

### Etapa B (Onboarding unificado)

| # | Tiempo |
|---|---|
| B1 | 4h |
| B2 | 1d |
| B3 | 4h |
| B4 | 2h |
| B5 | 1h |
| B6 | 2h |
| B7 | 4h |
| B8 | 4h |
| B9 | 2h |
| B10 | 4h |
| **Total** | **~3.5d** |

### Etapa C (Multi-cuenta DB)

| # | Tiempo |
|---|---|
| C1 | 4h (DDL + indices) |
| C2 | 2h |
| C3a | 1d (backfill + validacion) |
| C3b | 1h |
| C3c | 2h |
| C3d | 1d (dry-run + reporte) |
| C4 | 2h |
| C5 | 2h (trigger D.2) |
| C6 | 4h (RLS B.1) |
| C7 | 1h |
| **Total** | **~3.5d** |

### Etapa D (Entitlements audit)

| # | Tiempo |
|---|---|
| D1 | 4h |
| D2 | 2h |
| D3 | 4h |
| D4 | 2h |
| D5 | 2h (DDL + RLS) |
| **Total** | **~1.5d** |

### Etapa E (AccountContext)

| # | Tiempo |
|---|---|
| E1 | 1d |
| E2 | 4h |
| E3 | 1h |
| E4 | 4h |
| E5 | 2h |
| E6 | 2h |
| **Total** | **~2.5d** |

### Etapa F (Billing Hub)

| # | Tiempo |
|---|---|
| F1 | 4h |
| F2 | 1d |
| F3 | 2d (endpoints + webhook + idempotency) |
| F4 | 4h |
| F5 | 1h |
| F6 | 1d |
| **Total** | **~5d** |

### Etapa I (Navigation)

| # | Tiempo |
|---|---|
| I1 | 4h |
| I2 | 2h |
| I3 | 1h |
| I4 | 2h |
| I5 | 4h |
| I6 | 2h |
| **Total** | **~2d** |

### Etapa N1 / N2 (Mobile)

(Detallar en ramas; estimacion total ya en bloque 4 = 20 dias).

---

## ANEXO F — Tests por etapa (P6)

Estructura de tests esperada por bloque. Cada PR debe agregar los archivos antes de pasar review.

### Bloque 1

```
bff/test/
├── auth-rate-limit.spec.ts          # A7
├── audit-log-self.spec.ts           # A2
└── dto-payments.spec.ts             # A9

supabase/test/
├── rls-medical-info.test.sql        # A8 column-level
├── rls-user-accounts.test.sql       # C6
├── rls-saas-subscriptions.test.sql  # C6
└── trigger-auto-subscribe.test.sql  # C5

frontend/test/
├── onboarding-wizard.test.tsx       # B
├── public-profile-prompt.test.tsx   # B9
└── module-gate-audit.test.tsx       # D4
```

### Bloque 2

```
bff/test/
├── accounts-switch.spec.ts          # E
├── billing-upgrade.spec.ts          # F
├── billing-cancel.spec.ts           # F
├── billing-webhook-wompi.spec.ts    # F (HMAC + idempotency)
└── bulk-charges-rpc.spec.ts         # J1

supabase/test/
├── rls-charge-templates.test.sql    # J1
└── rls-entitlements.test.sql        # D / F

frontend/test/
├── account-switcher.test.tsx        # E4
├── billing-page-mobile.test.tsx     # F + N1.9
└── command-palette.test.tsx         # J12
```

### Bloque 3

```
bff/test/
├── payments-checkout.spec.ts        # G1 (incluye race condition)
├── payments-idempotency.spec.ts     # G3
├── payments-webhook-hmac.spec.ts    # G0 / G4a
├── payments-reconciler.spec.ts      # G4b cron
└── gating-modes.spec.ts             # H

frontend/test/
└── nav-dynamic-with-features.test.tsx  # I
```

### Bloque 4

```
bff/test/
├── devices-register.spec.ts         # PRE2 / N2
├── attendance-bulk-sync.spec.ts     # N4 idempotency
└── send-push-edge.spec.ts           # N2.2

frontend/test/
├── deep-link-router.test.tsx        # N1.8
├── biometric-gate.test.tsx          # N2.3
└── offline-queue.test.tsx           # N4
```

### Bloque 5

```
bff/test/
├── payments-list.spec.ts            # L1
├── payments-aggregate-cache.spec.ts # L3
└── cutover-downgrade.spec.ts        # M6
```

### Bloque 6

```
bff/test/
├── whatsapp-webhook-hmac.spec.ts    # WA1.5
├── whatsapp-router-multitenant.spec.ts  # WA1.6
├── whatsapp-tools-payments.spec.ts  # WA2.3 + WA3
├── whatsapp-tools-schedule.spec.ts  # WA2.2
├── whatsapp-identification-otp.spec.ts # WA2.8
├── whatsapp-rate-limit.spec.ts      # WA2.14
├── whatsapp-payment-link-generate.spec.ts # WA3.1
└── whatsapp-templates-meta.spec.ts  # WA3.3 / WA4.5

supabase/test/
├── rls-whatsapp-conversations.test.sql # WA1.2
├── rls-whatsapp-tokens.test.sql        # WA1.3
└── trigger-whatsapp-quotas.test.sql    # WA1.10

frontend/test/
├── whatsapp-setup-wizard.test.tsx   # WA1.9
├── whatsapp-inbox.test.tsx          # WA2.12
├── whatsapp-draft-reviewer.test.tsx # WA2.13
└── whatsapp-analytics.test.tsx      # WA4.6
```

### Bloque 7

```
bff/test/wellness/
├── unit/                            # plans, completions, adherence, bundles, ai.guardrails
├── integration/                     # rls.plans, rls.records, rls.attachments, webhooks.open-wearables, idempotency
└── e2e/                              # fisio-creates-plan, athlete-marks-done, parent-signs-consent, telehealth-flow, bundle-redemption

supabase/test/wellness/
├── rls-treatment-plans.test.sql
├── rls-health-records-v2.test.sql
├── rls-clinical-attachments.test.sql
├── rls-consent-documents.test.sql
└── trigger-clinical-audit.test.sql

frontend/test/wellness/
├── treatment-plan-page.test.tsx
├── exercise-completion-dialog.test.tsx
├── child-selector.test.tsx
└── consent-signature-dialog.test.tsx
```

---

## Ramas propuestas

| Rama | Contenido |
|------|-----------|
| `feat/etapa-a-quick-wins` | A1-A6, A15 — PR rapido |
| `feat/etapa-a-bff-hardening` | A7, A9, A10 — PR separado |
| `feat/etapa-c-multi-account-db` | C1-C5 — migraciones y backfills |
| `feat/etapa-d-entitlements-audit` | D1-D4 — catalogo + hook + gate audit |
| `feat/etapa-c5-white-label-schools` | C5.1-C5.15 — habilitar branding existente + permiso + audit log + watermark + manifest dinamico |
| `feat/etapa-o-school-capabilities` | O1-O9 — `manages_minors` / `manages_adults` + hook + relabeling |
| `feat/j1-bulk-charges` | J1 — cargos masivos |
| `feat/etapa-e-account-context` | E1-E6 — contexto + switcher |
| `feat/etapa-b-onboarding-unificado` | B1-B10 — wizard + steps + gate |
| `feat/etapa-f-billing-hub` | F1-F5 — billing web |
| `feat/etapa-g-payments-bff-mutations` | G1-G7 — payments al BFF |
| `feat/etapa-h-gating-audit` | H audit mode |
| `feat/j12-command-palette` | J12 — Cmd+K global |
| `feat/etapa-i-navigation-dynamic` | I1-I6 — nav dinamico + colapsables + reagrupacion |
| `feat/etapa-n1-capacitor-wrapper` | N1 — setup Capacitor |
| `feat/etapa-n2-native-features` | N2 — push, biometria, QR, camara |
| `feat/etapa-k-redesign` | K1-K8 — rediseno layouts |
| `feat/wa1-tech-provider-onboarding` | WA1 — Tech Provider Meta + onboarding embedded + cifrado tokens |
| `feat/wa2-bot-core-intents` | WA2 — DeepSeek + 5 tools + identificacion OTP + inbox basico + modo asistido |
| `feat/wa3-payments-via-whatsapp` | WA3 — pagos via WA + plantillas Meta + recordatorios proactivos |
| `feat/wa4-auto-mode-inbox` | WA4 — modo auto + inbox completo + analytics + reportes |
| `feat/wa5-v2-features` | WA5 — voz, multi-idioma, multi-sede, polls/inscripciones (opcional) |
| `feat/wellness-w1-core` | W1 — DB ejercicios + planes + adherencia + dashboard fisio + push diario |
| `feat/wellness-w2-clinical` | W2 — ficha v2 + tests funcionales + consentimientos + audit clinico |
| `feat/wellness-w3-comms-bundles` | W3 — chat contextual + bonos + telesalud Daily.co + intake/SOAP |
| `feat/wellness-w4-premium` | W4 — open-wearables self-host + recovery score + IA Coach + branding |
| `feat/wellness-w5-hardening` | W5 — reportes PDF semanales + marketplace plantillas + Habeas Data export/delete + i18n |

---

## Feature flags consolidados

| Flag | Etapa | Default | Propósito |
|---|---|---|---|
| `VITE_AUDIT_MODE` | A | `false` | Console log de context en dev |
| `VITE_FLAG_ENTITLEMENTS` | D | `false` | Habilita `useEntitlements` y `<ModuleGate auditOnly>` |
| `VITE_FLAG_WHITE_LABEL_SCHOOLS` | C5 | `false` | Activa branding dinamico per-school (quita override de `ThemeContext`) + render de `<SportMapsWatermark>` segun tier |
| `VITE_FLAG_MULTI_ACCOUNT` | E | `false` | Activa `AccountContext` y `<AccountSwitcher>` |
| `VITE_FLAG_UNIFIED_ONBOARDING` | B | `false` | Redirige roles de servicio al wizard unificado |
| `VITE_FLAG_BULK_CHARGES` | J1 | `false` | Habilita wizard de cargos masivos |
| `VITE_FLAG_PAYMENTS_BFF` | G | `false` | Usa BFF para mutaciones de payments (vs Supabase directo) |
| `VITE_GATING_MODE` | H | `audit` | `audit` / `soft` / `enforce` |
| `VITE_FLAG_SCHOOL_CAPABILITIES` | O | `true` post-merge | Activa labels dinamicos segun `manages_minors`/`manages_adults` (academia/PT/hibrida) |
| `VITE_FLAG_WHATSAPP_AI` | WA1-WA5 | `false` | Habilita modulo WhatsApp en admin (setup, inbox, settings, analytics, plantillas) |
| `VITE_FLAG_WHATSAPP_PAYMENTS` | WA3 | `false` | Habilita generacion de payment links via WA + cron de recordatorios proactivos |
| `VITE_FLAG_WHATSAPP_AUTO_MODE` | WA4 | `false` | Permite a la escuela activar modo 100% automatico (default es asistido) |
| `VITE_FLAG_WELLNESS_V2` | W1 | `false` | Activa modulo Wellness Pro v2 (deprecated v1 wellness pages) |
| `VITE_FLAG_WELLNESS_TREATMENT_PLANS` | W1 | `false` | Habilita planes de tratamiento + adherencia + dashboard pro |
| `VITE_FLAG_WELLNESS_CLINICAL_V2` | W2 | `false` | Habilita ficha clinica v2 + tests funcionales + consentimientos digitales |
| `VITE_FLAG_WELLNESS_BUNDLES` | W3 | `false` | Habilita compra/canje de bonos de sesiones |
| `VITE_FLAG_WELLNESS_TELEHEALTH` | W3 | `false` | Habilita videoconsulta integrada (Daily.co) |
| `VITE_FLAG_WELLNESS_WEARABLES` | W4 | `false` | Habilita conexion wearables via open-wearables (Garmin/Polar/HealthKit/Health Connect) |
| `VITE_FLAG_WELLNESS_AI_COACH` | W4 | `false` | Habilita IA Coach Recovery (sugerir plan, draft SOAP, recovery insight) |
