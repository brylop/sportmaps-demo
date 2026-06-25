# Plan Maestro — Auth, Inscripciones/QR, Branding y Hardening
_Consolidado sesión junio 2026. Estado: ✅ hecho · 🔵 diseñado (sin construir) · ⏳ pendiente_

Este documento reúne todo lo trabajado: lo ya entregado, lo auditado y lo diseñado,
con el orden recomendado de ejecución.

---

## 0. Resumen ejecutivo

| Bloque | Estado |
|---|---|
| A. Login Google + selección de rol | ✅ código + migraciones aplicadas en dev |
| B. Hardening (trigger, secretos, npm) | ✅ hecho |
| C. Móvil (Capacitor) | ✅ base instalada |
| D. Fuga RLS `profiles` | 🔵 plan listo, ⏳ sin ejecutar |
| E. Simplificación Invitaciones/Join | 🔵 diseñado |
| F. QR de inscripción (alta + cobro + asignación + reportes) | 🔵 diseñado |
| G. Branding completo (QR/landing/poster + panel) | 🔵 diseñado |

---

## A. Login con Google + selección de rol  ✅

**Qué se hizo (commits `9e7f253`, `9b70c3e`):**
- `signInWithGoogle` en AuthContext + botón en Login/Registro (`GoogleSignInButton`).
- Usuario OAuth nuevo sin rol → `/onboarding/role` (`OnboardingRolePage`), con gate en `ProtectedRoute`.
- Migración **`20260617000001`** (aplicada en dev): columna `profiles.needs_role_selection` + RPC `complete_role_selection`.
- Migración **`20260617000002`** (aplicada en dev): `handle_new_user` resiliente — cast seguro de `date_of_birth` + `EXCEPTION` con fallback (un dato OAuth malformado ya no rompe el signup) + re-bind del trigger.

**Pendiente de config manual (no es código):**
- Google Cloud OAuth client + redirect URI; Supabase → Providers → Google. (Reportado como ya hecho por el usuario.)

---

## B. Hardening de seguridad y build  ✅

- **Fix build BFF** (`9e7f253`): `schools/:id` coaccionado a `string` (rompía `tsc` en Render).
- **Secretos** (`d85fc90`): service_role keys hardcodeadas → `process.env`. Key **rotada** en Supabase por el usuario.
  - Barrido completo posterior: **sin secretos críticos** en el repo (solo higiene menor: anon key en `.env.example`, integrity de Wompi test en un doc).
- **npm audit fix** (`9b70c3e`): BFF **8→0** vulnerabilidades; frontend **31→9** (resto requiere breaking en dev-tooling).
- **Hotfixes sueltos archivados** (`9b70c3e`): `fix_trigger_*.sql` → `supabase/archive/` + README (tenían modelo de roles divergente, riesgo de pisar el trigger vigente).

---

## C. Móvil — Capacitor (Bloque 4 N1)  ✅

Commit `51abb5c`: `capacitor.config.ts`, plugins `@capacitor/*` (core, app, browser, camera, device, push, scanner, biometric), scripts `cap:sync/android/ios`, `useDeviceContext` con import dinámico para no bundlear nativo en web.

---

## D. Fuga RLS en `profiles`  🔵 plan listo / ⏳ sin ejecutar

**Hallazgo crítico (auditoría):** la policy `Profiles SELECT USING (true)` (mig `20260225000043`) sigue vigente → cualquier usuario **autenticado** puede leer email/teléfono/fecha de nacimiento/documento de TODOS (incl. menores). `anon` NO puede (no hay grant) → fuga acotada a autenticados.

**Plan (3 pasos, NO ejecutado — rompe pantallas si se hace a ciegas):**
1. Migración: vista `profiles_public (id, full_name, avatar_url, role, bio)` + restringir policy a `auth.uid() = id` (+ admin).
2. Repuntar **7 lecturas simples** (nombre/avatar de terceros) a `profiles_public`: GlobalSearch, Mensajes ×2, CoachPlans, AttendanceSupervision, Teams, PaymentsAutomation:1585.
3. Mover **4 lecturas con PII** a BFF con chequeo de rol: AdminMarketplaceModeration, payment-reminders, InvitationsManagement, PaymentsAutomation:392.
4. Orden: desplegar 2+3 → **luego** flip de la policy (paso 1) = cierre de la fuga.

**Hallazgo extra (independiente):** `trainer/profile.ts` busca PII de cualquiera por email/phone sin scoping; `trainer/clients.ts` devuelve `date_of_birth`/`gender`. Acotar a clientes con relación activa.

---

## E. Simplificación de Invitaciones / "Unirse"  🔵 diseñado

**Diagnóstico:** 8 caminos para unirse, pero solo **2 conceptos reales**. 3 motores paralelos de vínculo que dejan al usuario en estados distintos (QR no crea `school_members` → reportes inconsistentes). Código muerto: `profiles.invitation_code` y `referral` sin redención; wrappers `accept_invitation`, `invite_parent_to_school`.

**Diseño objetivo:**
- **Primitiva A — Invitación dirigida**: motor único `accept_invitation_pro`. Borrar wrappers. Mover el invite de `localStorage` a `user_metadata` (sobrevive incógnito/confirmación). Auto-accept idempotente (no descartar por error transitorio). Email mismatch → "cambiar de cuenta" en vez de `signOut()+reload()`.
- **Primitiva B — Auto-unión por token**: tabla **`join_tokens`** polimórfica (reemplaza `school_join_qr_codes` + rutas `/join-team` + `/join-plan`) + RPC único **`join_via_token(token, payload)`** + página única **`/j/:token`**.
- **Regla de oro:** ambas primitivas llaman a **`link_member`** (rutina canónica) que SIEMPRE escribe en `school_members` + enrollment/child/payment → un solo modelo, reportes consistentes.

**Antes → Después:** 8 caminos→2 · 3 motores→1 · ~12 RPCs→~5 · 4 páginas→2 · localStorage→token/metadata.

**Fases:** F1 `link_member` (no rompe nada) → F2 `join_tokens`+`/j/:token` → F3 invite a metadata + auto-accept robusto → F4 borrar deuda muerta.

---

## F. QR de inscripción  🔵 diseñado

### F.1 Creación (lado escuela/gym/entrenador)
Asistente de **3 pasos** (¿para qué? → plan/pago → personalizar → generar). `join_token` guarda `owner_type` (school/venue/trainer) + `target` + `billing_model`. Mismo flujo para los 3; difieren las opciones del catálogo.
- Genera `slug` → URL `app.sportmaps.co/j/<slug>` → descarga PNG/SVG/PDF + compartir.
- Gestión con métricas (escaneos/registros/pagados) ya en `school_join_qr_codes`.

### F.2 Flujo del padre/cliente (página `/j/:token`)
5 pantallas: **landing branded → identificación (registro/login/Google, sin preguntar rol) → datos del hijo/miembro → pago → confirmación.** El token define rol y contexto → se salta selección de rol y onboarding genérico.

### F.3 Orden pago ↔ asociación (decisión firme)
**Se asocia PRIMERO en `pending_payment`; el pago la ACTIVA vía WEBHOOK** (idempotente, server-side, nunca el redirect del navegador). El registro de pago siempre apunta a un `enrollment_id` que ya existe → nunca hay pago huérfano.
- `require_first_payment=true` → membresía `pending` hasta webhook.
- `require_first_payment=false` → `active` directo + cargo pendiente con recordatorio.

### F.4 Modelos de cobro (gym vs escuela)
El QR apunta a una **oferta** con un **billing_model**; el flujo es el mismo:
| Modelo | Escuela | Gym | Estado |
|---|---|---|---|
| Recurrente (mensualidad) | ✅ | ✅ ilimitada | active al día |
| Paquete de N sesiones | ⚠️ | ✅ | hasta agotar |
| Saldo/monedero | — | ✅ | mientras haya saldo |
| Pase diario | — | ✅ | 1 día |
| Reserva de espacio | ✅ | ✅ | por reserva |
| Gratis/solo registro | ✅ | ✅ | active inmediato |

### F.5 Mensualidad (recurrente)
Al unirse se crea enrollment **+ `recurring_subscription`** (sobre `subscription_plans`, NO `school_subscriptions`).
- **Autopay real:** solo **MercadoPago** hoy. **Wompi bloqueado** (falta API `payment_sources`/contrato Pagos a Terceros).
- **Wompi / sin autopay:** manual + recordatorio mensual (reusa PaymentRemindersPage).
- Ciclo: active → cargo del mes → (autopay cobra | recordatorio) → pagado/active | no paga → en_mora → suspendido.

### F.6 Cierre y asignación
- **Gym / QR específico:** queda directo con su plan/equipo. Sin asignación.
- **Escuela / QR abierto:** cae en bandeja **"Nuevos ingresos por asignar"** → admin asigna equipo + categoría + plan → completa enrollment (+ enciende recurring si aplica).

### F.7 Conexión a reportes
Todo (QR / invitación / asignación manual) pasa por `link_member` y se **etiqueta con `join_token_id`** → reportes consistentes:
conversión por QR · ingresos por equipo/categoría/plan · miembros por estado · mora · rendimiento por QR. (Funciona **solo** si todo escribe en las tablas canónicas — refuerza F1.)

---

## G. Branding completo  🔵 diseñado

### G.1 Estado actual
- **Se configura en** `/school-config` → "Perfil de la Escuela" → sección "Identidad Visual" (`BrandingSettingsForm`). Gateado a **Pro+** (`whitelabel`). Permite logo + color principal + secundario + watermark. Preview solo de botones.
- **Llega concretamente a:** landing `/join/:slug` (logo + colores vía `get_join_qr_public`) y **poster PDF** del BFF (banda de color + logo).
- Tamaño QR: preview 240px · PNG 1024 · SVG vectorial · poster A4 (QR 600px, nivel M).

### G.2 Gaps detectados
1. El **QR descargable (PNG/SVG) NO lleva branding** (sin logo al centro, B/N). `qrcode.react` soporta `imageSettings` (con nivel H que ya usas).
2. El **poster ignora `secondary_color`** y **siempre imprime "Powered by SportMaps"** ignorando el toggle `show_watermark`.
3. Default de color inconsistente (`#0ea5e9` azul vs marca real verde `#248223`).
4. Poster QR a 600px/nivel M → subir a ~1000px/nivel H.

### G.3 Propuesta de panel (benchmark Stripe/Kajabi/Shopify)
Promover branding a **panel propio "Marca"** (sacarlo del perfil) con **preview multi-superficie en vivo**: pestañas *App · Página de inscripción · Email · Poster QR*. Mostrar qué desbloquea cada plan (Pro: logo+colores; Elite: dominio propio vía `custom_domains_elite`) y el toggle de watermark con efecto real.

---

## Orden recomendado de ejecución

1. **D — Fuga RLS `profiles`** (seguridad, ya con plan) — lo más urgente pendiente.
2. **E.F1 — `link_member`** (base que habilita reportes consistentes; no rompe nada).
3. **F — `join_tokens` + `/j/:token` + asistente de creación** (el QR unificado).
4. **F.6/F.7 — asignación + etiqueta de reportes.**
5. **G — mejoras de branding del QR** (bajo esfuerzo, alto impacto visual) → luego panel "Marca".
6. **E.F3/F4 — invite a metadata + limpieza de deuda muerta.**

---

## Adyacente / en curso (fuera de esta consolidación)
- Onboarding de roles persona (athlete/parent/coach/wellness) — `20260617000003`.
- Fix catálogo de roles `school_admin` — `20260618000001`.
- Canal **WhatsApp IA** (Bloque 6) — `20260618100000_whatsapp_ai_channel_wa1` (en curso).
- Gaps de producto vs Controla: i18n, gamificación, centro de guías/tours.
