# Plan de remediación — Módulos del Atleta, Settings y Mensajes

**Fecha:** 2026-05-19
**Scope:** sidebar athlete, `/settings`, `/my-cards`, `/my-certificates`, `/my-event-registrations`, `/messages`, `/calendar`, intereses deportivos.
**Origen:** auditoría conversacional 2026-05-19 navegando la app como atleta.

---

## 1. Resumen ejecutivo

Se identificaron **9 hallazgos** a través de los módulos del atleta. La mayoría son **features cosméticas** (UI sin backend) o **gateo de rol faltante**. Hay 1-2 puntos de seguridad reales (spoofing en `messages`, `save_profile_settings` callable por anon) que se priorizan en F1.

| # | Módulo | Severidad | Estado |
|---|--------|-----------|--------|
| 1 | Sidebar athlete (9 items en un grupo) | UX | ✅ Parcheado — reorg en 7 grupos |
| 2 | `/my-event-registrations` runtime error (`null.filter`) | Bug | ✅ Frontend guard. BFF queda con response inconsistente |
| 3 | `/my-certificates` solo funciona para parent | Feature gap | 🟡 Escondido del athlete; RPC sí soporta, falta wire-up |
| 4 | `/my-cards` copy hardcoded a parent | UX | ✅ Copy bifurcado por rol |
| 5 | Intereses deportivos no consumidos en ningún lado | Dead feature | ❌ Pendiente |
| 6 | Settings → Notificaciones (toggles cosméticos, push permission no se dispara) | Feature falsa | ❌ Pendiente |
| 7 | Settings → Privacidad del Perfil (100% cosmético) | Feature falsa | ❌ Pendiente |
| 8 | `/messages` sin compose, sin triggers, botón "Contactar" fake | Feature rota | ❌ Pendiente |
| 9 | `/calendar` botón "Crear Evento" sin gateo | UX confuso (no security) | ❌ Pendiente |

---

## 2. Fases

### F0 — Limpieza urgente (1-2 días)

**Objetivo:** que ningún rol vea botones/secciones rotas. Cero código nuevo, solo gating y hide.

#### F0.1 Frontend

| Tarea | Archivo | Cambio |
|---|---|---|
| Renombrar "Crear Evento" en calendar | `CalendarPage.tsx:602` | "Agregar a mi calendario" o "Nueva actividad" — match con la realidad de `calendar_events` (personal) |
| Esconder PrivacySection del menú Settings | `pages/SettingsPage.tsx` (verificar tabs) | Quitar tab "Privacidad" hasta F3.1 |
| Banner "Beta" en NotificationsSection | `components/settings/NotificationsSection.tsx` | Avisar al usuario que aún no controla envíos reales, mientras F2.1 |
| Esconder "Mensajes" del sidebar parent + coach | `config/navigation.ts:168, 209` | Mismo criterio que aplicamos a Constancias del athlete |
| Apagar botón "Contactar" en perfil público de escuela | `pages/PublicSchoolPage.tsx:137-140` | Hide o redirect a `mailto:` real de la escuela (no toast demo) |

#### F0.2 BFF

| Tarea | Archivo | Cambio |
|---|---|---|
| Normalizar response de listados | `bff/src/routes/events/my-registrations.*` (a verificar) | Devolver siempre `[]` no `null` cuando vacío |
| Audit similar en otros listados | Grep `res.json(null)` en BFF | Mismo fix |

#### F0.3 Verificación rápida (sin código)

- [ ] Confirmar que RLS de `calendar_events` enforces `user_id = auth.uid()` en INSERT (debería estar; verificar)
- [ ] Verificar route `/messages` no expone más data al atleta que parent/coach (hoy mismo render para todos)

---

### F1 — Hardening de seguridad (3-5 días)

**Objetivo:** cerrar puntos de spoofing y de exposición pública antes de meter features nuevas.

#### F1.1 RLS audit

| Tabla | Acción requerida |
|---|---|
| `messages` | Policy INSERT debe enforce `sender_id = auth.uid()`. Recipient debe pasar helper `can_message(auth.uid(), recipient_id)` que valide relación (mismo school, parent-coach del child, vendor-buyer, etc.) |
| `events` (plataforma) | INSERT solo para `organizer`, `coach`, `school`. Athlete NUNCA. Verificar policy actual |
| `calendar_events` | INSERT/UPDATE/DELETE solo si `user_id = auth.uid()` |
| `certificate_requests` (o equivalente) | SELECT solo si caller es dueño del child o el profile_id |
| `push_subscriptions` | INSERT/DELETE solo si `user_id = auth.uid()` |

#### F1.2 RPCs SECURITY DEFINER

| RPC | Riesgo actual | Acción |
|---|---|---|
| `save_profile_settings` | Linter flagueó `anon` puede invocar | `REVOKE EXECUTE ... FROM anon`. Verificar `search_path` explícito |
| `request_athlete_certificate` | Acepta `p_profile_id` y `p_child_id` | Validar adentro de la función que `p_profile_id = auth.uid()` OR caller es parent del `p_child_id` |
| `my_athlete_id_cards` | Devuelve `relation='self'\|'parent'` | Verificar que filtra por `auth.uid()` adentro (no leak otros atletas) |
| `my_athlete_certificates` | Idem | Idem |

#### F1.3 BFF input validation

| Endpoint | Validación |
|---|---|
| Todos los `/api/v1/*` con body | Zod schemas obligatorios |
| Rate limit en mutaciones de messages | 30/min por user |
| Rate limit en mutaciones de profile | 10/min por user |

#### F1.4 Anti-spoofing en frontend

- En cliente nunca pasar `sender_id`, `user_id`, `owner_id` — derivar siempre de `auth.uid()` en RLS/RPC
- Borrar de payloads de inserts cualquier campo que el server debería setear

---

### F2 — Wire-up de infra existente (1-2 semanas)

**Objetivo:** activar features que ya tienen 80% del código pero no están conectadas end-to-end.

#### F2.1 Push notifications funcionales

| Tarea | Archivo |
|---|---|
| Wire `Notification.requestPermission()` al toggle push | `NotificationsSection.tsx` — invocar `usePushSubscription.subscribe()` en `onCheckedChange` cuando se prende. Llamar `unsubscribeFromPush()` cuando se apaga |
| Mostrar estado real del permiso | `NotificationsSection.tsx` — usar `usePushSubscription.checkStatus()` para reflejar `granted/denied/unsupported` |
| Definir taxonomía de notification types | Nueva tabla `notification_types` o constante: `enrollment`, `payment`, `event`, `marketing`, `system` |
| Map de pref → type | `email_notifications` gate-todo, `marketing_emails` solo type='marketing', `order_updates` solo type='payment' o 'order' |
| Edge function `send-push-notification` respeta prefs | Leer `profiles.preferences.push_notifications` y el type específico antes de invocar webpush |
| BFF `emailClient.send` respeta prefs | Recibir `notification_type` como argumento, leer pref correspondiente del recipient |

#### F2.2 Constancias para atleta

| Tarea | Archivo |
|---|---|
| Bifurcar UI por rol | `MyCertificatesPage.tsx` — si `isAthlete`, esconder dropdown de hijos, mostrar dropdown de escuelas del atleta |
| Helper `loadSchoolsForAthlete` | Nuevo. Lee `school_athletes` (verificar nombre exacto en DB) por `user_id` |
| Submit con profile_id | Línea 100-105: si athlete, `p_profile_id: user.id, p_child_id: null` |
| Re-incluir en sidebar athlete | `config/navigation.ts` grupo "Documentos" |
| Validar RPC `request_athlete_certificate` acepta caso athlete | Si no, agregar migración con CASE WHEN |

#### F2.3 BFF response normalization global

- Tipos compartidos `bff/src/types/api.ts` ↔ `frontend/src/lib/api/types.ts`
- Patrón obligatorio: arrays nunca `null`, objetos opcionales explícitos con `| null`
- Test snapshot por endpoint

---

### F3 — Features faltantes (3-4 semanas)

**Objetivo:** lo que el roadmap pide y hoy no existe.

#### F3.1 Perfil público de atleta/usuario

| Componente | Detalle |
|---|---|
| Tabla / vista | `user_public_profile` con SECURITY INVOKER. Campos visibles condicionados por `profiles.preferences.public_profile`, `show_stats`, `allow_search` |
| Ruta pública | `/u/:slug` o `/athlete/:id` |
| RLS | `SELECT WHERE preferences->>'public_profile' = 'true' OR auth.uid() = id` |
| Re-activar PrivacySection | Con toggles funcionales. Quitar banner Beta |
| Indexación | Si `allow_search`=false → excluir de RPC `search_users` |

#### F3.2 Intereses deportivos integrados

| Punto de integración | Esfuerzo |
|---|---|
| `/explorar` filtro inicial — pre-cargar con `profile.sports_interests`, dejar override | Bajo (1 día) |
| Dashboard athlete — widget "Eventos para ti" filtrado por sports + city | Medio (2-3 días) |
| `user_search_preferences.preferred_sports` — decidir: consolidar con `profiles.sports_interests` o usar las dos con sync | Decisión de producto |
| Onboarding flag estricto: requerir `array_length >= 1` (no aceptar bio como sustituto) | Bajo (1 línea en RPC) |

#### F3.3 Módulo Mensajes funcional

Esto es el más grande. Sub-fases recomendadas:

##### F3.3.a Schema correcto
- Tabla `conversations` (id, type='direct'\|'group', created_at)
- Tabla `conversation_participants` (conversation_id, user_id, joined_at, last_read_at)
- Migrar `messages` a tener `conversation_id` (default a generar uno por par sender/recipient legacy)
- Triggers para `last_message_at` denormalizado

##### F3.3.b RLS y helper `can_message`
- Helper SQL: `can_message(p_user_a, p_user_b)` returns bool — valida que existe relación (mismo school_member, parent-coach del child, vendor-buyer activo, etc.)
- INSERT en `messages` chequea helper
- INSERT en `conversation_participants` solo si helper allow

##### F3.3.c Compose UI
- Botón "Nuevo mensaje" en `MessagesPage.tsx`
- Modal con buscador de destinatarios filtrado por `search_messageable_users(query)` que respeta `can_message`
- Eliminar copy mentiroso "se generan automáticamente"

##### F3.3.d Botones "Contactar" funcionales
- `PublicSchoolPage.tsx` — abrir compose con school owner
- `TrainerPublicProfile.tsx` — idem
- Vendor pages, wellness professional profile
- `MyAthleteCardsPage.tsx` — link al chat con coach principal de la escuela

##### F3.3.e Triggers automáticos (los que el copy promete)
- `AFTER INSERT enrollments` → conversation bienvenida con coach
- `AFTER UPDATE payments SET status='paid'` → mensaje confirmación al pagador
- `AFTER INSERT event_registrations` → confirmación inscripción + recordatorio cercano a fecha
- `AFTER INSERT certificate_requests` → notif a la escuela

##### F3.3.f Real-time
- Supabase Realtime channel por `conversation_id`
- Indicador "escribiendo..." opcional
- Marcar mensaje como leído al ver

##### F3.3.g Notification dispatch
- Mover de inserts inline a Edge Function `dispatch-message-notification` que respete prefs de F2.1
- Push + email + in-app inbox

---

## 3. Cybersecurity transversal

Checklist que aplica a TODAS las fases, no se cierra hasta verificarse cada vez.

### 3.1 RLS
- [ ] Toda tabla con datos por-usuario tiene RLS ENABLED
- [ ] Policies de INSERT verifican `sender/owner = auth.uid()`
- [ ] Policies de SELECT no leakean cross-tenant (validar con un test athlete-A intentando leer athlete-B)
- [ ] Helpers de RLS son `SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp` (memoria [[feedback_search_path_in_functions]])
- [ ] No hay self-recursion en policies (memoria [[feedback_rls_no_self_recursion]])
- [ ] GRANTs a `authenticated` mantienen EXECUTE en helpers (memoria [[feedback_security_definer_grants]])

### 3.2 SECURITY DEFINER cleanup
- [ ] Lista de todas las RPCs SECURITY DEFINER
- [ ] Para cada una: ¿anon necesita invocarla? Si no, `REVOKE EXECUTE ... FROM anon, public`
- [ ] `search_path` explícito en cada CREATE FUNCTION nueva
- [ ] Considerar `SECURITY INVOKER` si la lógica no requiere bypass de RLS

### 3.3 XSS / sanitization
- [ ] `messages.content`, `profile.bio`, `posts` — render con escape automático de React (default) verificado
- [ ] Si se renderiza markdown → DOMPurify
- [ ] Avatares y URLs externas validadas

### 3.4 Spoofing / IDOR
- [ ] No aceptar `user_id`, `sender_id`, `owner_id` desde payload del cliente — siempre desde `auth.uid()`
- [ ] Tests automatizados: athlete-A intenta hacer X como athlete-B → debe fallar 403
- [ ] Audit del flow de subscriptions push: `push_subscriptions.user_id` solo lo setea el server

### 3.5 Rate limiting
- [ ] BFF: mutaciones `/api/v1/messages` máx 30/min/user
- [ ] BFF: mutaciones `/api/v1/profile` máx 10/min/user
- [ ] BFF: lecturas pesadas (search, explorar) máx 60/min/user
- [ ] Endpoint anon (`/api/v1/public/*`) máx 100/min/IP

### 3.6 Logging
- [ ] Tabla `audit_logs` con acciones sensibles: compose mensaje, request constancia, change pref crítico (privacidad)
- [ ] Trigger DB (no solo BFF) para defensa en profundidad
- [ ] Retention 90 días mínimo, hash de PII donde aplique

---

## 4. Migraciones SQL nuevas (estimación)

Respetar [[feedback_migrations_immutable]] — todas como archivos nuevos con timestamp posterior.

| Archivo (sugerido) | Contenido |
|---|---|
| `20260520000001_messages_rls_strict.sql` | Helper `can_message`, RLS INSERT/SELECT estrictas, REVOKE EXECUTE de RPCs sensibles a anon |
| `20260520000002_save_profile_settings_secure.sql` | REVOKE FROM anon, verificar search_path |
| `20260521000001_calendar_events_rls.sql` | Audit y reforzar policies si faltan |
| `20260525000001_conversations_schema.sql` (F3) | Tablas conversations + conversation_participants |
| `20260526000001_messages_triggers.sql` (F3) | Triggers automáticos (enrollment, payment, registration) |
| `20260527000001_user_public_profile_view.sql` (F3) | Vista pública del perfil con SECURITY INVOKER |
| `20260530000001_notification_dispatch.sql` (F2) | Helper para resolver pref + tipo |

---

## 5. Criterios de aceptación por fase

### F0
- [ ] Atleta NO ve "Crear Evento" como label confuso en `/calendar`
- [ ] Atleta NO ve botón "Contactar" fake en escuela pública
- [ ] Settings → Privacidad oculto, Notificaciones con banner Beta
- [ ] Mensajes oculto del sidebar parent/coach o con badge Beta

### F1
- [ ] Athlete-A inserta `messages(sender_id=athleteB.id)` → 403
- [ ] anon llama `save_profile_settings` via REST → 403
- [ ] Athlete intenta INSERT en `events` → 403
- [ ] Audit RLS supabase linter sin warnings críticos

### F2
- [ ] Toggle Push ON → navegador pide permiso, `push_subscriptions` se crea
- [ ] Toggle Push OFF → suscripción se borra, edge function ya no envía
- [ ] Atleta solicita constancia desde `/my-certificates` → flow completo OK
- [ ] `/my-event-registrations` con array vacío → empty state limpio
- [ ] `email_notifications=false` → BFF no envía email; `marketing_emails=false` solo bloquea type='marketing'

### F3
- [ ] `/u/:slug` accesible solo si `public_profile=true`; oculta stats si `show_stats=false`
- [ ] `/explorar` filtra por sports_interests por default; usuario puede expandir
- [ ] Inscripción → mensaje automático llega al athlete dentro de 30s
- [ ] Mensaje nuevo aparece en chat del receptor sin recargar página (realtime <2s)
- [ ] Compose desde inbox bloquea destinatarios sin relación

---

## 6. Estimación total

| Fase | Esfuerzo | Bloqueante para |
|---|---|---|
| F0 | 1-2 días | Demo limpia |
| F1 | 3-5 días | F3 (no meter features con RLS débil) |
| F2 | 1-2 semanas | F3.3.g (dispatch real depende de F2.1) |
| F3 | 3-4 semanas | Roadmap features Reservas/Marketplace que dependen de mensajes |
| **Total** | **~6-8 semanas** | |

---

## 7. Roles afectados (vista por rol)

| Rol | F0 | F1 | F2 | F3 |
|---|---|---|---|---|
| athlete | "Crear Evento" → "Nueva actividad" | RLS messages, certs | Push real, Constancias funcional | Perfil público, Intereses enchufados, Mensajes |
| parent | Mensajes Beta | Idem messages | Push real, prefs respetadas | Mensajes funcional |
| coach | Mensajes Beta | RLS events INSERT scope | Push real | Mensajes funcional + triggers |
| school | — | Audit RLS | Push real | Botón Contactar real desde su perfil |
| organizer | — | RLS events | Push real | — |
| wellness_professional | — | — | Push real | Botón Contactar real, mensajes con clientes |
| store_owner | — | — | Push real | Idem |
| admin / super_admin | — | Audit logs visibles | Notif sistema | Moderación mensajes |

---

## 8. Cosas que NO entran en este plan

- Reservas (F1-F7 roadmap separado en [[project_reservations_module]])
- Marketplace R2-R6
- Mobile Capacitor N1+
- WhatsApp AI Channel (Bloque 6)
- Pagos recurrentes (proyecto separado)

Cuando esos lleguen a tocar mensajes/notificaciones/perfil público, **deben respetar los contratos definidos en F1-F3**.
 +
 