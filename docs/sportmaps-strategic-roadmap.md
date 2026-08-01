# SportMaps — Roadmap Estratégico Consolidado

> ⚠️ **Alcance vigente (revisado 2026-08-01).** Este documento sigue siendo la referencia de
> **tesis, mapa competitivo, hedges arquitectónicos y track disruptivo D1–D4**. Su §7 «Plan de
> ejecución consolidado» y su §4 «Pendiente en roadmap» **quedan superseded por
> [`docs/ROADMAP.md`](ROADMAP.md) v2.0**, que es el único documento que ordena trabajo.
> El §3 «Estado actual» está congelado en mayo de 2026 y no refleja lo entregado después.

**Fecha:** 2026-05-19
**Versión:** 1.1
**Status:** Borrador para revisión
**Changelog:**
- v1.1 (2026-05-19) — Añadidas funciones disruptivas D1-D4 (Torneos Relámpago, IoT, Pasaporte Deportivo Global, Scouting IA) + ruta de validación rápida internacional. Re-framing tesis: de "Mapa de Ubicaciones" a "Red de Infraestructura Conectada".
- v1.0 (2026-05-19) — Consolidación inicial: visión + mapa competitivo + estado actual + plan F0-F8 + N1-N4 + M1.
**Anexos:**
- `docs/athlete-modules-remediation-plan.md` — detalle técnico F0-F3
- `docs/saas-vendor-subscriptions-plan.md` — plan vendor subscriptions
- `docs/ROADMAP.md` — **roadmap maestro vigente** (v2.0, 2026-08-01): estado y prioridades
- `docs/archived/ROADMAP-v1.3-2026-05-12.md` — maestro anterior; conserva los anexos A–F (DDL, RLS, endpoints, RPCs, tests)
- `docs/PROMPT_MAESTRO_PAYMENTS.md` — diseño pagos

**Referencias en memoria personal de Claude:**
`project_saas_roadmap`, `project_reservations_module`, `project_payments_roadmap`, `project_mobile_strategy`, `project_whatsapp_ai_channel`, `project_marketplace_architecture`, `project_recurring_charges_status`, `project_landing_pricing_v3`, `project_plans_tables_distinction`, `project_school_store_addon`, `project_deploy_pipeline`.

---

## 1. Tesis y visión

**SportMaps es una infraestructura digital para monetizar tiempo libre, salud y pasión deportiva en LATAM.** No es una app de asistencia — es un ecosistema que une 3 frentes que la competencia atiende por separado.

**Evolución del producto (v1.1):** de **"Mapa de Ubicaciones"** a **"Red de Infraestructura Conectada"**. La diferencia está en que SportMaps no solo *muestra* dónde está la oferta deportiva, sino que *opera* la infraestructura (canchas IoT, torneos auto-gestionados, pasaporte universal del atleta, scouting con IA). Esto convierte a la plataforma en activo indispensable, no en directorio reemplazable.

1. **Gestión interna** de academias/clubes (vs SportEasy, GOATALENT, software local)
2. **Marketplace** de productos, servicios de salud y experiencias (vs Doctoralia, e-commerce deportivo)
3. **Mapa vivo** de oferta deportiva geolocalizada (sin competidor directo en LATAM con esta integración)

**Tesis de inversión (unicornio LATAM SportTech a 5-7 años):**
- Modelo SaaS escalable (costo marginal por usuario ≈ 0)
- Network effects en 3 lados (escuelas ↔ familias ↔ pros de salud y comercio)
- Monetización diversificada: SaaS MRR + take-rate marketplace + comisiones pasarela + data product B2B
- Expansión regional viable: Colombia → México → Brasil → resto LATAM con misma base tecnológica

**El enemigo real no es otra app — es WhatsApp + Excel.** La cultura informal latinoamericana es el competidor que más fácilmente recupera a un usuario que abandona. Cada bug de UX en la app de padres es una excusa para volver al grupo de chat.

---

## 2. Mapa competitivo

| Frente | Ejemplos | Fortaleza | Debilidad |
|---|---|---|---|
| SaaS puros gestión | SportEasy, GOATALENT, software local | Herramientas maduras de admin | Sistemas cerrados — no atraen clientes nuevos a la escuela |
| Marketplaces verticales | Doctoralia (salud), Linio/Falabella (e-comm deportivo) | Marca + tráfico | No entienden nicho deportivo ni dan herramientas a clubs |
| Informal | WhatsApp + Excel | Gratis + cultural | Caos, sin trazabilidad, sin pagos, sin compliance |

**Ventaja competitiva única de SportMaps:** unir los 3 frentes en un solo ecosistema con un mapa geográfico vivo.

---

## 3. Estado actual — Qué está desarrollado

Auditoría 2026-05-19 sobre la rama `develop`. Esta sección es **descriptiva** (lo que existe), no prescriptiva.

### 3.1 Infraestructura SaaS

| Capacidad | Estado | Notas |
|---|---|---|
| Roles del sistema | ✅ 13 roles | athlete, parent, coach, school, school_admin, wellness_professional, store_owner, admin, super_admin, organizer, reporter, personal_trainer, facility_manager (pendiente) |
| `school_subscriptions` + tiers | ✅ Tablas listas | `free/pro/enterprise` interno, Starter/Crecimiento/Profesional/Elite/Enterprise comercial |
| `subscription_plans` (catálogo escuela→familia) | ✅ Tabla creada defensivamente | Distinto de `school_subscriptions` — ver `project_plans_tables_distinction` |
| Trial 30d auto-create | ✅ Trigger en signup escuela | Commit `d26152f` |
| `has_entitlement(school_id, key)` | ✅ Pre-F0 cerrado | Commit `6332ed4` |
| Upgrade flow super_admin manual | ✅ Fase A | Commit `6ceff4b` |
| Vendor subscriptions plan | ✅ Plan aprobado | `docs/saas-vendor-subscriptions-plan.md` |
| Dual pricing Academia + Reservas | 🟡 Diseñado, no implementado en checkout | Memoria `project_saas_roadmap` |
| `schools.kind ∈ {academy,venue,hybrid}` | ❌ Solo en memoria | Crítico para hedge demográfico |
| Rol `facility_manager` | ❌ Solo en memoria | Para venues puros (pádel, gym, crossfit) |

### 3.2 Onboarding

| Capacidad | Estado |
|---|---|
| Wizard unificado todos los roles | ✅ Commit `247d8a5` |
| Botón Siguiente con validación | ✅ Commits `89fb6d3`, `10065d0` |
| Auto-advance modelo organizativo | ✅ |
| `DashboardChecklist` post-onboarding | ✅ Commit `708f2bf` |
| Selector banco + ciudad CO | ✅ |
| Bre-B + billetera digital | ✅ Commit `f67e677` |
| Sanitización inputs | ✅ |
| Migración 1-click desde Excel | ❌ |
| Onboarding `facility_manager` (`/signup/venue`) | ❌ |

### 3.3 Identidad y documentos

| Capacidad | Estado |
|---|---|
| Carnets digitales (athlete + parent) | ✅ Páginas `MyAthleteCardsPage`, `SchoolCardsAdminPage`, `AthleteCardPublicPage` |
| Plantillas de carnets | ✅ `cards/templates` |
| Verificación pública con QR | ✅ `CertificateVerifyPublicPage`, `verify_athlete_id_card_public` RPC |
| Constancias (certificados) | ✅ Schools-side completo |
| Constancias para atleta (sin parent) | ❌ Página solo soporta parent — ver remediación plan F2.2 |
| QR de inscripción a escuela | ✅ `JoinSchoolPublicPage`, `qr-signup` |
| Join QR a equipo / plan | ✅ `JoinTeamPage`, `JoinPlanPage` |

### 3.4 Pagos

| Capacidad | Estado |
|---|---|
| Wompi (sign + webhook + payment-tokens) | ✅ Edge functions + routes |
| MercadoPago | ✅ |
| Recurring charges (run-recurring-charges) | ✅ Edge function + ver `project_recurring_charges_status` — solo MP funcional |
| Payment reminders cron | ✅ |
| OCR de comprobantes (analyze-receipt) | ✅ Edge function |
| Vendor bank accounts | ✅ |
| Vendor payouts | ✅ |
| Athlete payments page | ✅ |
| Pagos manuales registrados | ✅ `docs/guia-registro-pagos-manual.md` |
| Recordatorios con plantillas | ✅ `docs/guia-recordatorios-plantillas.md` |
| Cobros recurrentes Wompi | ❌ Bloqueado por API `payment_sources` |
| Pago SaaS automático de subscripciones (no manual super_admin) | ❌ Fase posterior |

### 3.5 Marketplace

| Capacidad | Estado |
|---|---|
| Catálogo productos | ✅ `marketplace-catalog.routes.ts`, `MarketplacePage` |
| Detalle producto | ✅ `ProductDetailPage` |
| Carrito | ✅ `CartPage` |
| Checkout | ✅ `marketplace-checkout.routes.ts` |
| Órdenes | ✅ `marketplace-orders.routes.ts`, `StoreOrdersPage` |
| Inventario | ✅ `StoreInventoryPage` |
| Productos vendor | ✅ `vendor-products.routes.ts` |
| Servicios vendor | ✅ `vendor-services.routes.ts`, `VendorServicesPage` |
| Citas vendor (appointments) | ✅ `VendorAppointmentsPage`, `session-bookings.ts` |
| Reviews | ✅ `reviews.routes.ts` |
| Shipping | ✅ `shipping.routes.ts` |
| Favoritos | ✅ `favoritos.routes.ts` |
| Perfil público vendor | ✅ `VendorPublicProfilePage` |
| Tienda escolar como addon | ✅ Commit `b7ae94e` — opt-in `store` pago |
| Moderación marketplace | ✅ `marketplace-admin.routes.ts` |
| Roles `external_vendor + capabilities` (consolidación R1) | ❌ Memoria `project_marketplace_architecture` |
| Envíos vía Mox aggregator | ❌ R3-R4 |
| Medios 3D/AR (model-viewer) | ❌ R5 |
| Liquidity engine primeras 100 ventas/categoría | ❌ |

### 3.6 Wellness / Salud

| Capacidad | Estado |
|---|---|
| Wellness professional role | ✅ |
| Mis pacientes | ✅ `WellnessPatientsPage` |
| Schedule | ✅ `WellnessSchedulePage` |
| Citas reservadas | ✅ |
| Mis citas (paciente) | ✅ `MyAppointmentsPage` |
| Evaluaciones nuevas | ✅ `CoachEvaluationsPage` |
| Historial médico | ✅ `MedicalHistoryPage` |
| Nutrición | ✅ `NutritionPage` |
| Reportes wellness | ✅ |
| Biomech (SportMaps Body) | ✅ Commit `287e44d` — captura biomecánica para atletas |
| Integración fisio↔coach (historia clínica visible para entrenador con consentimiento) | ❌ Killer feature competitivo no implementado |

### 3.7 Eventos y Polls

| Capacidad | Estado |
|---|---|
| Crear evento (organizer) | ✅ `CreateEventPage` |
| Página pública evento | ✅ `EventPublicPage` |
| Inscripción individual atleta | ✅ `EventIndividualRegisterPage` |
| Inscripción de escuela completa | ✅ `EventEnrollmentPage`, `SchoolDelegationsPage` |
| Mapa de eventos | ✅ `EventsMapPage` |
| Mis inscripciones a eventos | ✅ `MyEventRegistrationsPage` (con guard de `null` reciente) |
| Mis eventos como organizer | ✅ `OrganizerEventsPage` |
| Finanzas organizer | ✅ |
| Reportes organizer | ✅ |
| Polls / encuestas | ✅ `PollsPage`, `CreatePollDialog`, `PollResultsPage`, `PublicPollPage` |
| Confirmación asistencia con poll | ✅ `AddConfirmationDialog` |
| Adult amateur leagues recurrentes (no one-shot events) | ❌ |
| Rankings persistentes intra-temporada | ❌ |

### 3.8 Trainer (personal trainer)

| Capacidad | Estado |
|---|---|
| Dashboard | ✅ |
| Clientes | ✅ |
| Disponibilidad | ✅ |
| Mis planes | ✅ |
| Mis rutinas | ✅ + detalle |
| Mis pagos | ✅ |
| Perfil público | ✅ |
| Editor de perfil | ✅ |
| Onboarding unificado | ✅ |

### 3.9 Atleta

| Capacidad | Estado |
|---|---|
| Dashboard | ✅ |
| Mi calendario | ✅ `CalendarPage` |
| Estadísticas | ✅ `StatsPage` |
| Objetivos | ✅ `GoalsPage` |
| Entrenamientos | ✅ `TrainingPage` |
| Mis inscripciones | ✅ `MyEnrollmentsPage` |
| Mis pagos | ✅ `AthletePaymentsPage` |
| Sidebar reorganizado en 7 grupos | ✅ Sesión 2026-05-19 |
| Bienestar | ✅ `AthleteWellnessPage` |
| Intereses deportivos (UI) | ✅ `ProfileSection.tsx` |
| Intereses deportivos consumidos en lógica | ❌ Dead feature |
| Perfil público de atleta | ❌ |
| Gamificación / medallas / colección | ❌ |
| Ranking PWR personal | ❌ |
| Mi billetera | ❌ Depende de F3 Reservas |

### 3.10 Mensajes y notificaciones

| Capacidad | Estado |
|---|---|
| Inbox lectura | ✅ `MessagesPage` |
| Compose desde inbox | ❌ |
| Detalle conversación + responder | ✅ `MessagesDetailPage` |
| Hilo agrupado por usuario | 🟡 Reconstruido en frontend, frágil |
| Triggers automáticos al inscribirse/pagar/registrarse | ❌ |
| Real-time (Supabase Realtime) | ❌ |
| Helper `can_message(a,b)` con relaciones reales | ❌ — anti-spoofing pendiente |
| Push subscriptions infra | ✅ `usePushSubscription` + edge function + tabla |
| Push subscriptions enchufada al toggle Settings | ❌ |
| Email infra | ✅ Edge function + BFF emailClient |
| Edge functions respetan `preferences.*_notifications` | ❌ |
| Privacy toggles funcionales | ❌ 100% cosméticos |
| In-app notifications page | ✅ `NotificationsPage` |

### 3.11 Admin y operaciones

| Capacidad | Estado |
|---|---|
| Admin analytics | ✅ |
| Activity logs | ✅ |
| Users admin | ✅ |
| Reports admin | ✅ |
| Marketplace moderation | ✅ |
| Pagos a vendors (payouts) | ✅ |
| OG preview (SEO link previews) | ✅ `og-preview.routes.ts` |
| Sport configs | ✅ |
| School staff management | ✅ |
| School delegations (inscripción colectiva eventos) | ✅ |

### 3.12 Deploy

| Capacidad | Estado |
|---|---|
| Frontend Vercel | ✅ |
| BFF Render | ✅ |
| DB Supabase (migrations manuales) | ✅ |
| CI/CD básico | ✅ |
| Sin Amplify | ✅ (clarificado en memoria `project_deploy_pipeline`) |

**Estimación de completitud:** ~55-65% de las features descritas en la visión están al menos parcialmente implementadas. La base es **fuerte** — esto no es green-field.

---

## 4. Pendiente en roadmap (consolidado de memorias)

### 4.1 Pre-F0 — Subscripciones y entitlements
Estado: **✅ Cerrado.** Tablas + helper + middleware + hook + endpoint.

### 4.2 F0 Reservas — Foundation
- Rol `facility_manager`
- `schools.kind`
- `<DashboardRouter/>` según kind
- Estimación memoria: 1 semana

### 4.3 F1-F7 Reservas (`project_reservations_module`)
- F1 Cierre core + RPCs atómicos cross-overlap — 2 sem
- F2 Recursos + blackouts + waitlist + onboarding venue — 3 sem
- F3 Billetera + QR check-in + guests — 3 sem
- F4 Membresías recurrentes — 3 sem
- F5 Ranking PWR + Americanos — 3 sem
- F6 Reportes + dashboard real-time — 2 sem
- F7 Mobile Capacitor — 3 sem
- **Total: ~17 semanas**

### 4.4 Pagos (`project_payments_roadmap`)
6 fases mes 1-6. Sincronizar:
- F3 Reservas (billetera) ← Fase 4 Pagos (cron payouts)
- F4 Reservas (membresías) ← Fase 6 Pagos (suscripciones SaaS)

### 4.5 Mobile (`project_mobile_strategy`)
Capacitor, split de cobros (no IAP), features nativas. N1+ depende de Reservas F7.

### 4.6 WhatsApp AI Channel (`project_whatsapp_ai_channel`)
Bloque 6: multi-tenant via Meta Tech Provider, DeepSeek V3, OTP, pagos via WA, modo asistido default.

### 4.7 Marketplace R2-R6 (`project_marketplace_architecture`)
- R2 — consolidación roles `external_vendor + capabilities`
- R3 — envíos Mox aggregator
- R4 — pagos a vendor mejorados
- R5 — 3D/AR con model-viewer
- R6 — reviews con contexto deportivo

### 4.8 Tienda escolar
✅ Decisión firme — addon `store` opt-in, no auto en signup (`project_school_store_addon`).

---

## 5. Hedges arquitectónicos ya presentes

Estos elementos **ya están** en el diseño y protegen contra escenarios futuros:

| Riesgo / pivote | Hedge presente |
|---|---|
| Mercado infantil se reduce (demográfico DINK) | `schools.kind ∈ {academy,venue,hybrid}` + rol `facility_manager` permiten que la misma plataforma sirva venues adultos (pádel, crossfit, gym boutique) sin re-arquitectura |
| Cliente quiere modelo distinto (equipos vs planes vs ambos) | Onboarding `feat(onboarding): elegir modelo organizativo` ya bifurcado (commit `465c4fe`) |
| Una escuela quiere desactivar tienda | Tienda es addon `store` pago opt-in (no auto) |
| Cliente paga manual o automático | Pagos manuales + Wompi + MP + recurring coexisten |
| Pasarela falla | `payment-providers.routes.ts` abstracción multi-provider |
| Vendors quieren su propio bank | `vendor-bank-accounts.routes.ts` listo |
| Necesidad de personalizar tier | Entitlements helper `has_entitlement` + addons opt-in |
| Onboarding distinto por país | Wizard ya bifurcado por rol — extender a `country` es trivial |

---

## 6. Hallazgos sesión 2026-05-19 (athlete audit)

Auditoría en vivo navegando como atleta. **9 hallazgos**, todos detallados en `docs/athlete-modules-remediation-plan.md`. Resumen:

| # | Módulo | Severidad | Estado |
|---|---|---|---|
| 1 | Sidebar athlete (9 items en un grupo) | UX | ✅ Parcheado — reorg 7 grupos |
| 2 | `/my-event-registrations` runtime error (`null.filter`) | Bug | ✅ Frontend guard; BFF pendiente normalizar |
| 3 | `/my-certificates` solo parent | Feature gap | 🟡 Escondido del athlete; RPC sí soporta |
| 4 | `/my-cards` copy parent | UX | ✅ Bifurcado por rol |
| 5 | `sports_interests` no consumido | Dead feature | ❌ Falta wire-up Explorar/recomendaciones |
| 6 | Settings → Notificaciones cosméticas + push no se dispara | Feature falsa | ❌ |
| 7 | Settings → Privacidad 100% cosmético | Feature falsa | ❌ |
| 8 | `/messages` sin compose, sin triggers, "Contactar" fake | Feature rota | ❌ |
| 9 | `/calendar` botón "Crear Evento" sin gateo | UX confuso (NO security) | ❌ |

**Conclusión:** ninguno es exotismo. Todos son los pequeños bugs de UX que cumulativamente provocan que un padre vuelva al grupo de WhatsApp. **Estos hallazgos son la trinchera vs el enemigo real.**

---

## 7. Plan de ejecución consolidado

Orden defensible. Cada fase tiene **bloqueante** explícito.

### F0 — Cerrar fuga vs WhatsApp/Excel
**Bloqueante para:** demo limpia + cualquier campaña de adquisición.
**Esfuerzo:** 1-2 días.
**Detalle:** `docs/athlete-modules-remediation-plan.md` §F0.

Quick wins:
- Renombrar "Crear Evento" en `/calendar` athlete → "Nueva actividad"
- Esconder PrivacySection del settings hasta F3.1
- Banner Beta en NotificationsSection
- Esconder "Mensajes" del sidebar parent/coach (o Beta badge)
- Apagar botón "Contactar" toast-demo en `PublicSchoolPage`
- Normalizar response BFF `/api/v1/events/my-registrations/list` → `[]`

### F1 — Hardening de seguridad
**Bloqueante para:** F3 (no meter features con RLS débil).
**Esfuerzo:** 3-5 días.
**Detalle:** `docs/athlete-modules-remediation-plan.md` §F1.

- RLS audit completo (`messages`, `events`, `calendar_events`, `push_subscriptions`, certs/cards)
- Cleanup RPCs SECURITY DEFINER (`save_profile_settings` revoke anon, `request_athlete_certificate` ownership check)
- Helper SQL `can_message(a, b)` con relaciones reales
- Anti-spoofing: nunca aceptar `user_id/sender_id` desde payload cliente
- Rate limit endpoints sensibles

### F2 — Wire-up de infra existente
**Bloqueante para:** F3.3.g (dispatch real depende de F2.1).
**Esfuerzo:** 1-2 semanas.
**Detalle:** `docs/athlete-modules-remediation-plan.md` §F2.

- Push permission real (NotificationsSection enchufa `usePushSubscription`)
- Edge functions respetan `preferences.*_notifications` + taxonomía types
- Constancias para atleta (bifurcar UI con `p_profile_id`)
- BFF response normalization global

### N1 — Migración 1-click desde Excel
**Paralelo a F2.** Acelera adquisición.
**Esfuerzo:** 2-3 semanas.

- Endpoint `/api/v1/onboarding/import-excel` con plantilla canónica (alumnos, planes, asistencias, pagos)
- Parser de columnas comunes (nombres, identificaciones, contactos, fechas)
- Validación + preview antes de commit
- Rollback transaccional si falla
- UI wizard "Sube tu Excel" en onboarding escuela

### N4 — SEO técnico local
**Paralelo a F2.** Tráfico orgánico gratuito.
**Esfuerzo:** 1-2 semanas iniciales + iteración.

- Sitemap dinámico por escuela / pro / ciudad
- `<title>`, `<meta description>`, OG tags por página dinámica
- Schema.org `SportsActivityLocation`, `SportsTeam`, `LocalBusiness`
- Rutas SEO: `/escuelas/futbol/bogota/suba`, `/fisioterapeuta/medellin/el-poblado`
- SSR / SSG para páginas públicas críticas (hoy SPA cliente puro)
- Indexación condicional por `allow_search` cuando F3.1 esté

### F3 — Athlete features faltantes
**Bloqueante para:** F4 (no medir engagement sin features para engagear).
**Esfuerzo:** 3-4 semanas.
**Detalle:** `docs/athlete-modules-remediation-plan.md` §F3.

- F3.1 Perfil público de atleta/usuario (vista + RLS condicional + PrivacySection re-activado)
- F3.2 Intereses deportivos enchufados (Explorar default filter, dashboard widget "Para ti")
- F3.3 Mensajes funcional: schema `conversations`, compose UI, botones Contactar reales, triggers automáticos al inscribirse/pagar, real-time

### F4 — Activation Engine
**Bloqueante para:** detectar y reducir churn de F5 en adelante.
**Esfuerzo:** 2-3 semanas.

- Funnel events: `school_signup → invite_sent → invite_accepted → first_login → first_payment → repeat_action_7d`
- Cohort dashboard para internal team
- Email/push nurture sequence automáticos por etapa (respetan prefs F2.1)
- Alertas internas: si una escuela onboarded tiene <30% padres activados en 7 días → CSM ping

### F5 — Network Density
**Bloqueante para:** marketplace liquidity (M1).
**Esfuerzo:** 4-6 semanas.

- Reviews + ratings de escuelas y pros (extender `reviews.routes.ts`)
- Perfiles públicos verificados con badge "Verified"
- Mapa con filtros sociales (rating min, deportes, certificaciones)
- Mejoras Explorar: relevance ranking, social proof, search refinado
- Páginas SEO categoría/ciudad alimentadas por contenido real

### N2 — Gamificación
**Después de F3-F5.** Killer feature de retention.
**Esfuerzo:** 3-4 semanas.

- Sistema de logros (`achievements` tabla + helpers)
- Medallas por asistencia, rendimiento, hitos
- Tarjetas digitales coleccionables (atletas las completan)
- Notificaciones celebratorias (respetan F2.1)
- Vista padre: "Mira los logros de tu hijo esta semana" — fidelización emocional

### N3 — Integración Fisio↔Coach
**Diferenciador único.** Después de F3.
**Esfuerzo:** 4-6 semanas.
**Sensibilidad:** alta — datos médicos, consentimiento explícito requerido.

- Schema `clinical_summaries` con campos limitados visibles para coach
- Consentimiento del atleta/padre obligatorio (no opt-out silencioso)
- Flow: fisio crea evaluación → genera resumen para coach con campos curados (no notas privadas, no diagnósticos completos) → coach lo ve en panel del atleta
- Audit log de todos los accesos a `clinical_summaries`
- Compliance: revisar habeas data Colombia + futuro LGPD Brasil

### F6 — Comunidad + Adult Amateur Leagues
**Hedge demográfico DINK + voz a voz.** Después de F5.
**Esfuerzo:** 6-8 semanas.

- F6.1 Adult leagues recurrentes:
  - Schema `leagues` (distinto de `events` one-shot)
  - Fixture generator
  - Tablas de posiciones persistentes
  - Rankings intra-temporada
  - Importable formato CSV de federaciones/cajas
- F6.2 Comunidad:
  - Posts (text + foto + ruta GPS)
  - Rutas verificadas Strava-like
  - Retos / desafíos por deporte / ciudad
  - Grupos por deporte + zona
- F6.3 Micro-influencers tooling:
  - Programa de líderes de comunidad
  - Herramientas premium gratuitas para creators verificados
  - Tracking de attribution: "X usuarios entraron por la ruta de Y"

### M1 — Marketplace Liquidity Engine
**Resuelve el cuello #3 (transacciones reales).** Después de F5.
**Esfuerzo:** 3-4 semanas.

- Ofertas curadas primera semana del mes
- Garantía SportMaps de devolución
- Primer pedido sin comisión vendor (acelera oferta)
- Reviews verificadas (solo quienes compraron)
- Notificaciones de descuento basadas en `sports_interests` (de F3.2)
- Bundle escuela + tienda (uniforme oficial + 10% descuento atletas inscritos)

### F7 — Data Product
**Activo de valuación a futuro.** Después de F6.
**Esfuerzo:** 2-3 meses.

- Warehouse separado (BigQuery / Snowflake) con ETL desde Supabase
- Anonimización + agregación por geografía y deporte
- Dashboards B2B:
  - Scouts de talento
  - Marcas (proyecciones de demanda por categoría/región)
  - Gobierno / Secretarías de Deporte (densidad de oferta)
- API B2B con docs y rate limiting
- Pricing data product separado del SaaS

### F8 — Regional Expansion
**Tesis unicornio depende de esto.** En paralelo a F7.
**Esfuerzo:** 2-3 meses para primer país nuevo, replicable.

- i18n completo (español-CO → MX, → PE, → EC; portugués → BR)
- Multi-currency con conversión y storage en `numeric` + `currency_code`
- Abstracción payment providers por país:
  - CO: Wompi + MP (presente)
  - MX: Stripe LATAM + Conekta (nuevo)
  - PE: Culqi (nuevo)
  - BR: Mercado Pago BR + EBANX (nuevo)
- Multi-tenant by country en data isolation
- Legal/tax: facturación electrónica DIAN (CO) ↔ CFDI (MX) ↔ NFe (BR)
- Time zones, formatos fecha/número, traducciones

---

## 7.bis — Track Disruptivo Internacional (D1-D4)

**Tema:** funciones que aceleran la **expansión internacional** a una fracción del costo tradicional. Convierten a SportMaps de **directorio** a **infraestructura operativa**. Pueden ejecutarse en paralelo a F4-F8 cuando la fundación esté lista, o adelantar D1 como piloto para validar mercado nuevo antes de F8 completo.

**Relación con tracks existentes:**

| Track | Items |
|---|---|
| Foundation (cierra fuga) | F0, F1, F2, F3 |
| Growth (adquisición barata) | N1, N4, F4, F5, M1 |
| Moat (retention competitivo) | N2, N3, F6 |
| Unicornio (escala + valuación) | F7, F8 |
| **Disruptivo internacional (NUEVO)** | **D1, D2, D3, D4** |

---

### D1 — "Software en un Clic" para Torneos Relámpago

**Propósito estratégico:** validación express de mercados nuevos sin oficina local. El torneo se viraliza solo — cada jugador descarga la app para ver resultados de SU torneo.
**Esfuerzo:** 3-4 semanas.
**Pre-requisitos:** F3 (mensajes con triggers) + N4 (SEO local para que el torneo público sea indexable) + onboarding mínimo CO si país nuevo.
**Conecta con lo desarrollado:** rol `organizer`, `CreateEventPage`, `EventManagementPage`, `OrganizerCalendarPage` ya están listos para eventos one-shot. **D1 es un wizard simplificado encima.**

| Componente | Detalle |
|---|---|
| Wizard "Crear torneo en 5 min" | Pasos: deporte, fecha, sede, formato (single/double elimination, round-robin, suizo), inscripción ($ + cupo), reglas |
| Fixture auto-generator | Algoritmo por formato — single elim genera bracket; round-robin genera matriz; suizo genera pairing por ronda |
| Inscripción económica | Reusa Wompi/MP existente. Cupo limitado, lista de espera |
| Tabla de posiciones live | Actualización en tiempo real (Supabase Realtime). Cada partido cargado → re-cálculo automático |
| Tarjetas amonestación tiempo real | Capitán/árbitro carga sanciones desde app → notificación push (cuando F2.1 esté) al sancionado y a su equipo |
| Página pública del torneo | `/torneo/:slug` indexable. Comparte fixture, posiciones, próximos partidos. Aprovecha N4 SEO |
| Onboarding de jugador | Single-tap signup desde el QR del torneo. Sin wizard de escuela — minimum viable profile |

**Por qué acelera la expansión:**
1. **Costo de adquisición ≈ $0** por jugador — el organizador del torneo (un amigo, una empresa) carga al juego a sus contactos
2. **Validación de demanda en días no meses** — si el torneo se llena en una ciudad nueva, hay mercado
3. **Inventario para D2** — los venues que hostean torneos son leads naturales para integración IoT
4. **Datos demográficos puros** — quién juega, dónde, cuánto paga, qué deporte: data para vender D4 a futuro

**Diferencia con F6.1 Adult Amateur Leagues:** F6.1 es liga recurrente (temporada con calendario y standings). D1 es torneo one-shot de fin de semana. Comparten primitivos (fixture, posiciones) pero el flujo es distinto.

---

### D2 — Integración IoT para Escenarios ("Airbnb Deportivo")

**Propósito estratégico:** asegurar inventario exclusivo en marketplace + resolver dolor operativo de dueños de canchas. Convierte a SportMaps en **infraestructura operativa real**, no solo software de reserva.
**Esfuerzo:** 6-10 semanas + costo hardware por venue.
**Pre-requisitos:** Reservas F1-F3 (billetera + QR check-in) — sin la base de reservas no hay sentido. D2 es la capa hardware encima.
**Conecta con lo desarrollado:** módulo de reservas pendiente, pero `vendor-services.routes.ts`, `session-bookings.ts`, `vendor-products.routes.ts` ya tienen patrones de booking + payment que reusamos.

| Componente | Detalle |
|---|---|
| Hardware soportado | Cerraduras IoT (Yale Linus, August, Igloohome, Kisi); controles iluminación (Shelly, Sonoff, smart relays) |
| Provider abstraction | `iot_providers` tabla con tipos `lock`, `lighting`, `camera`. Cada uno con API key + endpoint + capabilities |
| Pairing venue → hardware | UI venue admin asocia recurso (`court_id`) con dispositivo IoT (`device_id`) |
| QR de acceso | Generado al pagar reserva. Encripta `booking_id + user_id + valid_window`. Validado server-side antes de comando al device |
| Comando time-boxed | Reserva 19:00-20:00 → puerta desbloquea 18:55, bloquea 20:05. Luces idem |
| Fallback humano | Si IoT falla, código manual visible para venue manager + escalation telefónica |
| Logs auditables | Cada apertura logged con `device_id, user_id, booking_id, timestamp, success`. Cumple compliance |
| Pricing | Take rate marketplace + opcional fee mensual al venue por usar IoT integration (modelo SaaS adicional) |

**Riesgos específicos:**
- **Hardware failure SLA** — necesita venue manager local de respaldo
- **Compliance puerta abierta** — emergency egress requirements según país
- **Costo capex** — quien paga el hardware: ¿venue, SportMaps, financiación?

**Por qué acelera la expansión:**
1. **Lockin del venue** — una vez integrado IoT, cambiar de plataforma es reinstalar hardware. Switching cost alto
2. **Diferenciador único** vs SportEasy/GOATALENT que son puro software
3. **Inventario premium** — venues no-staff (24/7 self-service) son atractivos para amateurs urbanos sin tiempo de horarios atendidos
4. **Data operacional valiosa** — uso real de canchas, picos demanda, ROI por sede

---

### D3 — Pasaporte Deportivo Global

**Propósito estratégico:** lealtad de marca trans-fronteriza. Convierte la actividad física en algo *adictivo* (lenguaje de videojuegos). Cuando un usuario viaja Bogotá→Santiago→CDMX, su perfil deportivo viaja con él. Razón para no usar app local del país.
**Esfuerzo:** 4-6 semanas para v1, evoluciona continuo.
**Pre-requisitos:** N2 (Gamificación base) cerrado. D3 es la versión **global y portátil** de N2.
**Conecta con lo desarrollado:** Biomech (`SportMaps Body`), `MyAthleteCardsPage` (visualización tipo carnet), `StatsPage`, `GoalsPage`, `MyAchievements` (a crear en N2).

| Componente | Detalle |
|---|---|
| Sistema de puntos universal | `xp` por: partido jugado + verificado, asistencia entrenamiento, ruta certificada GPS, evento completado, reto cumplido |
| Rangos | Bronce → Plata → Oro → Platino → Élite. Por deporte (ranking pádel ≠ ranking running) |
| Medallas digitales | Estilo logros Xbox/PlayStation. NFT opcional futuro (sin promesas hoy) |
| Verificación de actividad | GPS + check-in QR de venue (D2 lo facilita) + confirmación cruzada (oponente confirma resultado) |
| Ranking local | Top jugadores por ciudad por deporte. Liga ascendente |
| Perfil portable | API JSON-LD del atleta exportable. Si el usuario abre app en Lima, el perfil de Bogotá ya está |
| Cross-deporte | Métricas universales (consistencia, frecuencia, mejora) además de las por-deporte |
| Privacy controls | El atleta decide qué ver (público / amigos / scouts / nadie) — conecta con F3.1 perfil público |

**Por qué acelera la expansión:**
1. **Retention 10× sobre features funcionales** — la gamificación bien hecha es la diferencia entre apps que se borran del teléfono y las que están en el dock
2. **Portabilidad = anti-competitor local** — un competidor mexicano sin el pasaporte global pierde al usuario en cuanto este viaja
3. **Activo de valuación** — base de datos de habilidades verificadas alimenta D4 Scouting + F7 Data Product
4. **Voz a voz natural** — "subí a rango Oro en pádel, vení a competir"

---

### D4 — Herramientas de Scouting con IA

**Propósito estratégico:** convertir data cotidiana en activo B2B premium. Atrae scouts de talento + marcas deportivas + clubes profesionales. Genera otra línea de ingresos de margen alto.
**Esfuerzo:** 8-12 semanas (v1 con IA básica); evoluciona continuo con más datos.
**Pre-requisitos:** F7 Data Product (warehouse) base + Biomech infrastructure + D3 (pasaporte como contenedor de portfolio).
**Conecta con lo desarrollado:** **SportMaps Body / Biomech ya está implementado** (commit `287e44d`) — es el cimiento. D4 extiende a video tagging + portfolio digital + acceso scout.

| Componente | Detalle |
|---|---|
| Upload de video corto | Coach o padre sube clip de jugada/entrenamiento (max 60s inicialmente). Storage Supabase + CDN |
| AI tagging | Modelo de visión (open-source inicial: YOLOv8 + sport-specific fine-tune; commercial: Google Vertex AI / AWS Rekognition). Etiqueta: "tiro libre", "ataque banda", "defensa", "sprint", etc. |
| Portafolio digital atleta | Compilación auto-generada por temporada con highlights, métricas biomech, asistencias, logros pasaporte |
| Acceso scout | Rol nuevo `talent_scout` con tier pago de acceso. Búsqueda filtrada: edad, deporte, posición, ciudad, nivel pasaporte, métricas biomech |
| Consentimiento explícito | Atleta (o padre si menor) opt-in para aparecer en búsqueda de scouts. Privacy by default OFF |
| Pricing | Suscripción scout / club profesional: $200-500 USD/mes. O API B2B per-query para marcas |
| Compliance | Habeas data CO + LGPD BR + posible LFPDPPP MX. Edad mínima + consentimiento parental |

**Por qué acelera la expansión:**
1. **Margen alto** — software puro, sin take rate marketplace
2. **Atrae al mercado profesional** — clubes profesionales hablan a sus academias amateurs (caballo de Troya invertido)
3. **Patrocinios** — marcas pagan por exposure a atletas verificados
4. **Diferenciador defendible** — entrenar IA con data propietaria de SportMaps crea moat tecnológico

---

## 7.ter — Ruta de Validación Rápida en Nuevos Países

Estrategia recomendada para abrir mercado nuevo (MX, PE, EC, BR) sin oficina local. Combina D1-D4 + N4 + F8 mínimo viable.

```
┌─────────────────────────────────────────────────┐
│ STEP 1: Lanzar D1 Torneos Relámpago en ciudad   │
│         (Pádel/Fútbol/Básquet — el deporte      │
│          dominante de esa ciudad)               │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│ STEP 2: Capturar masa crítica de jugadores      │
│         (target: 500-1.000 usuarios en 60 días) │
│         Tracking: WAU/MAU por torneo            │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│ STEP 3: Mostrar datos de tráfico a tiendas/fisios│
│         locales → sales pitch: "tienes 800      │
│         deportistas activos cerca, súmate"      │
│         → marketplace local empieza a poblarse  │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│ STEP 4: Vender SaaS a grandes clubes/escuelas   │
│         de la ciudad. Pitch: "tus jugadores ya  │
│         están en SportMaps, integrate"          │
│         → ingreso recurrente MRR estable        │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│ STEP 5 (opcional): Ofrecer D2 IoT a venues      │
│         premium → lockin físico → liquidez      │
│         marketplace de reservas                 │
└─────────────────────────────────────────────────┘
```

**Pre-requisitos técnicos por país:**
- F8 mínimo viable: i18n + moneda local + 1 payment provider local funcional
- N4 SEO local: rutas de búsqueda en idioma/jerga local
- D1 wizard completamente self-service
- BFF endpoints abiertos a `Origin` del país nuevo

**KPI go/no-go para ese país:**
- Si en 90 días desde D1 lanzado: `< 200 usuarios activos` → no continuar, no escalar a STEP 3-4
- Si `200-1.000 usuarios` → continuar pero sin invertir en sales local todavía
- Si `> 1.000 usuarios` → STEP 3 + STEP 4 con CSM/sales remoto

**Costo estimado por país** (sin oficina):
- Tech: $0 incremental sobre F8 (paga la inversión inicial F8)
- Marketing torneos: $2-5k USD seed (Facebook ads geo-targeted + 2-3 micro-influencers locales)
- Legal + payments: $3-10k USD setup (varía por país)
- CSM remoto / sales: 1 persona part-time hasta superar STEP 3

---

## 8. Métricas de éxito por fase

No solo features. Cada fase tiene métricas que prueban que sí movió la aguja.

| Fase | Métrica clave | Target |
|---|---|---|
| F0 | Bugs UX de athlete audit cerrados | 9/9 hallazgos resueltos |
| F1 | Holes de seguridad cerrados | 0 warnings críticos en Supabase linter; tests de spoofing pasan |
| F2 | Push permission real activable | `>= 50%` de toggles ON terminan con `granted` browser perm |
| N1 | Tiempo onboarding escuela 100 atletas | `< 15 min` (vs horas hoy) |
| N4 | Sessions orgánicas Google | `+30%` MoM tras lanzamiento |
| F3 | Mensajes enviados/usuario activo/semana | `>= 3` (proxy de adopción real) |
| F4 | Activación padre dentro de 7d post-invitación | `>= 60%` |
| F5 | Reviews por escuela activa | `>= 5` median en 90 días |
| N2 | DAU/MAU atletas (engagement) | `>= 30%` post-gamificación |
| N3 | Resúmenes clínicos compartidos coach con consentimiento | `>= 100/mes` a 90 días |
| F6 | Adult leagues activas | `>= 50` ligas en 6 meses |
| M1 | Transacciones marketplace/escuela/mes | `>= 10` median |
| F7 | Clientes B2B data product | `>= 3` paying en 12 meses |
| F8 | MRR no-Colombia | `>= 20%` del MRR total en 18 meses |
| D1 | Torneos creados/mes a 90 días post-launch | `>= 50` por ciudad piloto |
| D1 | Users adquiridos por torneo (avg) | `>= 15` jugadores/torneo |
| D2 | Venues con IoT integrado | `>= 20` en 6 meses piloto |
| D2 | Reservas IoT-enabled vs manual | `>= 60%` de reservas en venues con IoT |
| D3 | % atletas activos con rango `>= Plata` | `>= 40%` a 6 meses |
| D3 | DAU/MAU post-pasaporte | `+15 puntos` vs baseline N2 |
| D4 | Scouts/clubes paying suscripción | `>= 10` a 12 meses |
| D4 | Videos taggeados con IA | `>= 1.000/mes` a 6 meses |

---

## 9. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| WhatsApp/Excel recupera usuarios | Alta | Crítico | F0-F3 antes que cualquier growth |
| Competidor copia idea con más capital y toma MX/SP | Media | Crítico | Velocidad de F8 + alianzas institucionales locales |
| Marketplace no liquidiza | Alta | Alto | M1 engine + bundles con SaaS escuelas |
| Demográfico DINK reduce mercado escuelas | Media | Medio | `schools.kind=venue/hybrid` + F6 adult leagues |
| Regulación habeas data / datos médicos | Media | Alto | N3 con consentimiento explícito; audit logs DB-level |
| Wompi nunca habilita API recurring | Confirmada | Medio | Solo MP autopay; alternativas multi-provider F8 |
| Equipo pequeño no puede F0-F8 en tiempo | Alta | Alto | Priorizar F0-F2 + N1 + F4 antes que F6-F8; contratar growth/infra cuando MRR lo permita |
| Costos infra escalan mal en F7 | Baja | Medio | Warehouse separado, no mezclar OLTP con OLAP |
| RLS performance se degrada con N usuarios | Media | Medio | Audit con `EXPLAIN ANALYZE` + indices funcionales en cada migración |
| D2 IoT — falla hardware en sede sin staff → usuario llega y no puede entrar | Media | Alto | SLA con venue manager local de respaldo; código manual; soporte 24/7 telefónico; geo-fence + 10min antes notif "tu acceso está listo" |
| D2 IoT — vulnerabilidad cerradura comprometida | Baja | Crítico | Auditoría de seguridad por hardware provider; firmware updates obligatorios; cripto en QR válido en ventana corta |
| D4 IA — modelos taggean mal → datos sucios en portfolio del atleta | Alta inicial | Medio | Revisión humana sample obligatoria primeros 6 meses; feedback loop con coach que corrige; modelos por deporte (no genérico) |
| D4 — habeas data + menores de edad → sanción regulatoria | Media | Crítico | Consentimiento parental obligatorio; audit logs DB; revisión legal antes de cada país nuevo; opt-in OFF default |
| D1 Torneos — spammers crean torneos falsos para extraer pagos | Media | Medio | Verificación organizer (telefónica/email/doc) antes de cobrar inscripciones; reputation system; refund automático si torneo cancelado |
| D3 Pasaporte — atleta hace trampa (check-ins falsos para subir rango) | Alta | Bajo | Verificación cruzada (oponente confirma); GPS + venue presence; rate limit de XP/día por deporte |

---

## 10. Cybersecurity transversal

Checklist aplicable a TODAS las fases. No se cierra — se verifica cada vez.

### 10.1 RLS
- Toda tabla con datos por-usuario tiene RLS habilitado
- Policies INSERT verifican `sender/owner = auth.uid()`
- Helpers RLS son SECURITY DEFINER con `SET search_path = pg_catalog, public, pg_temp` (`feedback_search_path_in_functions`)
- No self-recursion en policies (`feedback_rls_no_self_recursion`)
- GRANT EXECUTE preservado a `authenticated` en helpers (`feedback_security_definer_grants`)

### 10.2 SECURITY DEFINER cleanup
- Lista de todas las RPCs SECURITY DEFINER y revisar
- REVOKE EXECUTE FROM anon cuando no aplique (`save_profile_settings` flagueado por linter)
- Considerar SECURITY INVOKER si no requiere bypass RLS

### 10.3 XSS / sanitization
- React escape default verificado en `messages.content`, `profile.bio`, `posts`
- Si hay markdown render → DOMPurify
- Avatares y URLs externas validadas

### 10.4 Anti-spoofing / IDOR
- Cliente NUNCA envía `user_id/sender_id/owner_id` — server los setea desde `auth.uid()`
- Tests: athlete-A intenta operación como athlete-B → 403
- `push_subscriptions.user_id` solo server

### 10.5 Rate limiting
- Mutaciones messages: 30/min/user
- Mutaciones profile: 10/min/user
- Lecturas pesadas: 60/min/user
- Endpoints anon `/public/*`: 100/min/IP

### 10.6 Logging y audit
- Tabla `audit_logs` con acciones sensibles
- Triggers DB-level (defensa en profundidad, no solo BFF)
- Retención 90 días mínimo
- Hash PII donde aplique

### 10.7 Datos médicos (N3)
- Consentimiento explícito grabado (`consents` tabla con timestamp + ip + user_agent)
- Acceso a `clinical_summaries` siempre auditado
- Revocación de consentimiento → bloqueo inmediato + retention según habeas data

### 10.8 IoT (D2)
- QR de acceso firmado server-side con expiración corta (`< 2h`)
- API keys de providers IoT en secrets manager, nunca en código
- Comandos a devices auditados (`device_commands_log`)
- Rate limit por device (anti-DoS)
- Firmware update mandatorio en venues — versión vieja bloquea reservas nuevas
- Plan de respuesta a incidente: comprometido un device → revocar y rotar credenciales en TODA la flota

### 10.9 Datos de menores y biometría (D4)
- Consentimiento parental verificado (no checkbox simple) — flow tipo COPPA: documento + email parental + delay 24h
- Video stored cifrado at-rest; thumbnails sin datos identificables
- Modelos IA entrenados sin PII en logs
- Opt-out remueve videos + portafolio en `< 30 días`
- Scouts ven solo `aggregated_metrics`, no raw video, hasta que atleta concede acceso explícito

### 10.10 Pagos en torneos (D1)
- Inscripciones a torneos: refund automático si torneo cancelado en `< 48h` antes
- Escrow opcional: fondos liberados al organizer solo después del torneo (no antes)
- Verificación organizer obligatoria antes de cobrar (anti-fraude)

---

## 11. Dependencias y orden recomendado

```
F0 ──> F1 ──> F2 ──> F3 ──> F4 ──> F5 ──> M1
            ↓                ↑       ↓
           N1                +─── N2 ─┐
            ↓                        ├──> D3 (pasaporte global)
           N4                        ↓
            ↓                       F6 ──> D1 (torneos relámpago)
            └─────────────────────────────┘     ↓
                                              F8 ──> validación país
                            N3 ─────┐         ↑
                                    └──> F7 ──┴──> D4 (scouting IA)
                                                ↑
                            Reservas F3 ────────┴──> D2 (IoT venues)
```

### Timeline agregado (1 equipo full-time)

| Mes | Foco principal |
|---|---|
| 1 | F0 + F1 (cierre fuga + hardening) |
| 2 | F2 + N1 + N4 (wire-up + adquisición) |
| 3 | F3 athlete features |
| 4 | F4 activation + iniciar F5 |
| 5 | F5 network density |
| 6 | N2 gamificación + iniciar N3 |
| 7-8 | N3 fisio + F6 comunidad/leagues + **D1 torneos relámpago piloto CO** |
| 9 | M1 marketplace liquidity + **D3 pasaporte (extensión de N2 a global)** |
| 10-11 | F7 data product + **D4 scouting IA v1** |
| 12+ | F8 regional expansion (con D1 como punta de lanza por país) |
| 13+ | **D2 IoT piloto** (depende de Reservas F3 cerrado en su roadmap propio) |

**Con 2-3 equipos en paralelo:** comprimible a 6-9 meses con riesgo controlado.

**Alternativa "Validar internacional antes de moat":** adelantar **D1 (Torneos Relámpago)** al mes 5 si hay urgencia por validar MX/PE antes de tener N2/N3 completos. D1 técnicamente puede correr con F0-F4 cerrados + onboarding mínimo. Trade-off: usuarios nuevos llegan a un producto sin moat (riesgo churn alto). Recomendado solo si hay presión inversionista por números trans-frontera.

---

## 12. Lo que NO entra (de momento)

Estos están en el horizonte pero no se planifican en este doc:

- **Reservas F1-F7** completo (`project_reservations_module`) — vive en su propio plan. Se enchufa con M1 (billetera = pre-req membresías recurrentes)
- **Pagos 6 fases completo** (`project_payments_roadmap`) — vive en su propio plan. Se enchufa con F2 (recurring → billetera Reservas)
- **Mobile Capacitor N1+** (`project_mobile_strategy`) — depende de Reservas F7
- **WhatsApp AI Channel Bloque 6** (`project_whatsapp_ai_channel`) — vive aparte. Se enchufa con F3.3 mensajes (transport adicional)
- **Marketplace R2-R6** completo (`project_marketplace_architecture`) — se sincroniza con M1 + F5

Cuando estos lleguen a tocar el resto, **deben respetar los contratos establecidos en F1-F3** (RLS, prefs, can_message, audit logs).

---

## 13. Decisiones pendientes (necesitan input de producto/negocio)

| # | Decisión | Quién decide | Bloqueante para |
|---|---|---|---|
| 1 | ¿`schools.kind=venue` se onboard en `/signup/venue` desde día 1 o esperar Reservas F0? | Producto | Hedge DINK |
| 2 | ¿`PrivacySection` se oculta o se marca Beta? | Producto + UX | F0 |
| 3 | ¿Quién hosting + costo Warehouse F7? | CTO + Finance | F7 |
| 4 | ¿Primer país de expansión post-CO? MX vs BR | CEO + sales | F8 |
| 5 | ¿N3 fisio-coach requiere abogado externo para revisar flow? | Legal | N3 |
| 6 | ¿N1 migración Excel incluye coaches/staff/pagos históricos o solo atletas? | Producto + CSM | N1 |
| 7 | ¿Gamificación N2 incluye recompensas reales (descuentos marketplace) o solo virtuales? | Producto + finanzas | N2 |
| 8 | ¿D1 Torneos Relámpago se adelanta como piloto MX/PE antes de moat completo (F6/N2)? | CEO + producto | D1 timeline |
| 9 | ¿D2 IoT: SportMaps financia hardware al venue, venue lo paga, o tercero (leasing)? | Finanzas + ops | D2 modelo |
| 10 | ¿D3 Pasaporte con NFT/blockchain o solo digital tradicional? | Producto | D3 alcance |
| 11 | ¿D4 Scouting acepta menores de edad con consentimiento parental o solo +18? | Legal + producto | D4 compliance |
| 12 | ¿Modelo monetización scouts D4: SaaS suscripción, per-query, o ambos? | Finanzas + sales | D4 pricing |
| 13 | ¿Primer país piloto D1 — CDMX, Monterrey, Lima, Guayaquil o São Paulo? | CEO + datos demográficos | F8 priorización |

---

## 14. Glosario

- **B2B2C** — vendemos a la escuela (B2B) que trae a sus usuarios finales (C)
- **MRR** — Monthly Recurring Revenue
- **Take rate** — % que SportMaps cobra sobre cada transacción del marketplace
- **DINK** — Double Income, No Kids (segmento demográfico adulto sin hijos)
- **kind** — campo `schools.kind ∈ {academy, venue, hybrid}` que define el tipo de organización
- **Pre-F0** — fase ya cerrada de tablas subscriptions + entitlements
- **F0-F8** — fases del roadmap consolidado en este doc
- **N1-N4** — items competitivos/growth no contemplados originalmente
- **M1** — marketplace liquidity engine
- **D1-D4** — funciones disruptivas para expansión internacional (Torneos Relámpago, IoT venues, Pasaporte Global, Scouting IA)
- **`can_message(a,b)`** — helper SQL pendiente que valida relación real antes de permitir mensaje
- **Red de Infraestructura Conectada** — re-framing del producto (v1.1) — de directorio a operador de infraestructura deportiva
- **Validación Express** — estrategia D1+N4+F8 mínimo viable para abrir país en 90 días sin oficina local

---

**Fin documento.** Versionar este archivo y revisar tras cada cierre de fase.
