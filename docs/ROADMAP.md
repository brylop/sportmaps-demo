# SportMaps — Roadmap Maestro Unificado

**Alcance:** Web + Mobile (iOS/Android) + SaaS multi-cuenta + Rediseño UX
**Versión:** 1.0
**Fecha:** 2026-04-24
**Duración estimada:** ~18 semanas calendario · ~55 días-dev

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

---

## Secuencia macro

```
BLOQUE 1: FUNDAMENTOS (Sem 1-3)
  A. Red de seguridad
  B. Onboarding unificado
  C. DB multi-cuenta + SaaS
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
| C3 | Backfill `user_accounts` REENTRANTE — `ON CONFLICT DO NOTHING` por clave natural `(user_id, account_type, linked_school_id)`, columna `migrated_at` para resumir tras fallo. Dry-run obligatorio antes de prod. |
| C4 | Seed `saas_subscriptions` — service roles -> pro trial 30d, athlete/parent -> free sin trial |
| C5 | Trigger `AFTER INSERT ON user_accounts` auto-subscribe service roles |
| C6 | RLS (user solo ve sus cuentas) |
| C7 | Regenerar `types.ts` |

**Rama:** `feat/etapa-c-multi-account-db`
**Riesgo:** Bajo (aditivo puro)
**Rollback:** `DROP TABLE user_accounts, saas_subscriptions CASCADE`

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

## Resumen de esfuerzo total

| Bloque | Etapas | Dias-dev | Calendario |
|---|---|---|---|
| 1 — Fundamentos | A, B, C, D, O | 10 | Sem 1-3 |
| 2 — Cuentas + Billing | E, F, J | 10 | Sem 4-6 |
| 3 — Payments robustos | G, H, I | 9 | Sem 7-9 |
| 4 — Mobile | N1, N2, N3, (N4) | 20 + esperas | Sem 10-15 |
| 5 — Cierre | K, L, M | 8 | Sem 16-18 |
| **TOTAL optimista** (1 dev pleno, sin retrabajo) | | **~56.5 dias-dev** | **~18 semanas** |
| **TOTAL realista** (1-2 devs, con QA + retrabajo PR) | | **72-82 dias-dev** | **22-24 semanas** |

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
| R11 | Escuelas hibridas mal clasificadas (academy + atletas adultos) en backfill de Etapa O | O | Query de deteccion (parents+adults_athletes>0) — corrida 2026-04-27, las 3 detectadas son data de prueba. Re-correr antes del merge para confirmar que no aparecieron nuevos casos. |

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
11. **Modelo de capacidades de escuela:** dos booleans (`manages_minors`, `manages_adults`) en `schools`, no enum. Permite hibridas desde dia uno. `school_type` queda como categoria de marketplace, no condiciona UI.

---

## Decisiones pendientes (a cerrar antes de cada bloque)

### Antes de Bloque 4 (Mobile)

- [ ] Nombre comercial app movil ("SportMaps" o "Controla" u otro)
- [ ] Un solo `appId` unificado `co.sportmaps.app` vs apps separadas por rol
- [ ] Self-host macOS runner vs Codemagic/Appflow
- [ ] Push notifications: Supabase Edge Functions o BFF Express
- [ ] N4 offline es must-have o nice-to-have

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

---

## Ramas propuestas

| Rama | Contenido |
|------|-----------|
| `feat/etapa-a-quick-wins` | A1-A6, A15 — PR rapido |
| `feat/etapa-a-bff-hardening` | A7, A9, A10 — PR separado |
| `feat/etapa-c-multi-account-db` | C1-C5 — migraciones y backfills |
| `feat/etapa-d-entitlements-audit` | D1-D4 — catalogo + hook + gate audit |
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

---

## Feature flags consolidados

| Flag | Etapa | Default | Propósito |
|---|---|---|---|
| `VITE_AUDIT_MODE` | A | `false` | Console log de context en dev |
| `VITE_FLAG_ENTITLEMENTS` | D | `false` | Habilita `useEntitlements` y `<ModuleGate auditOnly>` |
| `VITE_FLAG_MULTI_ACCOUNT` | E | `false` | Activa `AccountContext` y `<AccountSwitcher>` |
| `VITE_FLAG_UNIFIED_ONBOARDING` | B | `false` | Redirige roles de servicio al wizard unificado |
| `VITE_FLAG_BULK_CHARGES` | J1 | `false` | Habilita wizard de cargos masivos |
| `VITE_FLAG_PAYMENTS_BFF` | G | `false` | Usa BFF para mutaciones de payments (vs Supabase directo) |
| `VITE_GATING_MODE` | H | `audit` | `audit` / `soft` / `enforce` |
| `VITE_FLAG_SCHOOL_CAPABILITIES` | O | `true` post-merge | Activa labels dinamicos segun `manages_minors`/`manages_adults` (academia/PT/hibrida) |
