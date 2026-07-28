# Spec — Despachador Unificado de Notificaciones

**Estado:** Plan aprobado para arrancar (F0). Fuente de verdad de este módulo.
**Fecha:** 2026-07-22
**Autor:** brylop
**Rama de trabajo:** `develop` (una rama por fase: `feat/notif-f0-datos`, `feat/notif-f1-dispatcher`, …)

---

## 1. Objetivo

Que **cualquier evento de negocio** que hoy genera una notificación llegue al usuario por **todos sus canales activos** (in-app, Web Push PWA, push nativo iOS/Android) respetando sus **preferencias**, con un **único emisor en el backend**, entregas durables (outbox + reintentos) y limpieza de tokens muertos.

Hoy: el canal in-app funciona y es en vivo; **los dos canales push están muertos en producción** (nativo solo se dispara desde un botón de prueba; web push falla en sus 2 únicos callers) y las preferencias no se respetan. Detalle en §2.

## 2. Estado actual (hallazgos que motivan el módulo)

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| 1 | 🔴 | Web push a la escuela filtra por `push_subscriptions.school_id` — **columna inexistente** | `InstallmentCheckoutModal.tsx:157-160` vs migración `20260227000059` |
| 2 | 🔴 | Web push al padre bloqueado por RLS (`auth.uid()=user_id`); el admin ≠ padre → 0 filas | `ReviewInstallmentModal.tsx:74-77` |
| 3 | 🔴 | Push nativo (`sendToUser`) solo se invoca desde `POST /devices/test-push` | `devices.routes.ts:140` |
| 4 | 🟠 | Dos sistemas de push desconectados; BFF ignora `web_push` a propósito | `push.service.ts:7-8` |
| 5 | 🟠 | iOS nativo guarda token APNS pero se envía por FCM admin → falla + auto-revoca | `useDeviceContext.ts:125` vs `push.service.ts:53,66` |
| 6 | 🟠 | Preferencias de notificación son decorativas; ningún emisor las consulta | `settings/NotificationsSection.tsx` |
| 7 | 🟠 | iOS Safari: la pista de "Agregar a inicio" vive en un banner gateado por `prompt`, estado que iOS-sin-instalar nunca alcanza | `PushPermissionBanner.tsx:33,77` |
| 8 | 🟡 | No hay puente `notifications` → push (todo push es ad-hoc client-side) | — |
| 9 | 🟡 | Dos manifests divergentes (`public/manifest.json` #0ea5e9 vs VitePWA #248223) | `vite.config.ts:58` |
| 10 | 🟢 | `subscribeToPush` duplicado en `pwa/notifications.ts` y `usePushSubscription.ts` | — |
| 11 | 🟢 | Drift de esquema: `database_schema.sql` raíz ≠ migración viva de `notifications` | — |

**Lo que SÍ funciona (no romper):** campana in-app en vivo (`RealtimeNotificationsProvider` + `useRealtimeNotifications`), limpieza de tokens FCM muertos, push como no-op seguro sin credencial, guard nativo con import dinámico en `useDeviceContext`.

## 3. Decisiones firmes

- **D1 — Un solo emisor en el BFF.** El `notification.service` del BFF envía web push (lib `web-push`, VAPID) **y** nativo (`firebase-admin`/FCM). Se **deprecia** la Edge Function `send-push-notification`. VAPID private key pasa a ser env del BFF (Render).
- **D2 — iOS + Android unificados en FCM** vía `@capacitor-firebase/messaging`. Ambos emiten token FCM real; `push_provider='fcm'` en nativo. Se elimina la ruta APNS-crudo. Requiere subir **APNs Auth Key** al proyecto Firebase `sportmaps-b865b` (paso manual documentado).
- **D3 — Cubrir TODOS los eventos** vía **trigger AFTER INSERT en `notifications`** (choke point único). Ningún productor cambia su forma de escribir; el fan-out a push es automático.
- **D4 — Entregas durables (CONFIRMADO: pg_net + worker, híbrido).** Tabla outbox `notification_deliveries` + worker BFF con reintentos y backoff. `pg_net` dispara el POST al BFF tras el commit (<2 s en el camino feliz — crítico para "tu pago fue aprobado" llegando al celular del padre); el worker es la red de seguridad si pg_net falla o el BFF está caído. Misma filosofía optimista-rápido + durable del modelo de conciliación. **Fallback:** si `pg_net` no se puede habilitar en el proyecto, F1 arranca worker-only sin cambiar la arquitectura y pg_net se añade después como pura mejora de latencia.
- **D7 — Secreto del endpoint interno vía Vault (innegociable).** El header secreto que valida el POST de pg_net NO se hardcodea en el SQL. La migración solo lo LEE por nombre desde `vault.decrypted_secrets` (`notif_dispatch_secret`); el valor se provisiona fuera del repo (como la mig `20260721000001`). Antecedente que no se repite: service role key expuesto en repo público.
- **D5 — Preferencias se respetan.** El dispatcher consulta las preferencias antes de enviar por cada canal. Fase 1 lee el JSONB `profile.preferences` existente; se normaliza a categorías.
- **D6 — Sin `CREATE TYPE`.** Columnas de estado/categoría con `text + CHECK` (convención del repo).

## 4. Arquitectura objetivo

```
Productor (RPC notify_user / send_notification / INSERT directo service_role / cron SQL)
        │  (sin cambios de forma)
        ▼
  INSERT INTO public.notifications  ──►  Realtime (in-app, ya funciona)
        │
        │ TRIGGER AFTER INSERT  fn: enqueue_notification_delivery()
        ▼
  public.notification_deliveries (outbox: 1 fila/notificación, status=pending)
        │                                   │
        │ pg_net POST (best-effort,        │ BFF worker (drena cada 60s:
        │ baja latencia)                    │ pending + failed<max_attempts,
        ▼                                   ▼ FOR UPDATE SKIP LOCKED)
  BFF  POST /internal/notifications/dispatch  ◄──────────────┘
        │  (auth: shared secret header; idempotente por delivery_id)
        ▼
  notification.service.dispatch(notificationId)
        ├─ carga notification + preferencias del user (D5)
        ├─ Web Push  → push_subscriptions (web-push/VAPID); 404/410 → borrar fila
        └─ Nativo    → user_devices (firebase-admin/FCM multicast); UNREGISTERED → revocar
        ▼
  actualiza notification_deliveries (sent/failed, contadores por canal, attempts++)
```

**Por qué trigger sobre `notifications` y no tocar cada productor:** los ~20 call sites (§8) ya escriben en la tabla. Un solo trigger cubre pagos, abonos, glosas, matrículas, marketplace, accesos, QR, equipment, certificates, plan-upgrade, etc. — presente y futuro.

## 5. Modelo de datos

**Cambios en `public.notifications`** (migración nueva, aditiva):
- `category text` — normalización de canal/tema (`payment`, `installment`, `glosa`, `enrollment`, `marketplace`, `access`, `qr`, `system`, …). Default derivado de `type` si NULL.
- `data jsonb DEFAULT '{}'::jsonb` — deep-link ids/metadata para el payload push. **Los productores de dinero DEBEN poblarlo** (mín. `payer_name`, `athlete_name`, `amount`, `concept`, `sede_id`) porque el Modo Recepción (Anexo §11) arma frases/toasts desde `data`, nunca parseando `message`.
- Índice `notifications(user_id, read, created_at DESC)` para la campana.

**Tabla nueva `public.notification_deliveries` (outbox):**
| col | tipo | nota |
|---|---|---|
| `id` | uuid pk | |
| `notification_id` | uuid FK → notifications(id) ON DELETE CASCADE | **UNIQUE** (idempotencia: 1 delivery por notificación) |
| `user_id` | uuid | denormalizado para el worker |
| `status` | text CHECK in (`pending`,`sent`,`failed`,`skipped`) | |
| `attempts` | int default 0 | |
| `max_attempts` | int default 5 | |
| `next_attempt_at` | timestamptz | backoff |
| `web_sent`/`web_failed`/`native_sent`/`native_failed`/`revoked` | int | métricas por canal |
| `last_error` | text | |
| `created_at`/`updated_at` | timestamptz | |

RLS: **deny all** a `authenticated`/`anon`; solo `service_role` (BFF) opera. Se revisa policy por policy (convención).

**Config no-secreta `public.notification_settings` (singleton):** `dispatch_enabled boolean default false`, `bff_dispatch_url text`. Permite desplegar F0 inerte (`dispatch_enabled=false` → el trigger solo encola en el outbox, NO llama pg_net) y activar el fan-out en F1 flipeando el flag. La URL del BFF va aquí (no es secreta). **Secreto** (`notif_dispatch_secret`) va en **Vault** (D7), nunca en esta tabla ni en el SQL.

**`push_subscriptions`:** sin `school_id` (correcto). Se añade índice `(user_id)`. La lectura para enviar pasa a ser **solo del BFF con service_role** — se elimina la query client-side de suscripciones ajenas (cierra hallazgos #1, #2 y la fuga de endpoints).

**Preferencias:** F1 usa el JSONB `profile.preferences` (`email_notifications`, `push_notifications`, `activity_alerts`, `marketing_emails`, `order_updates`). Helper `get_notification_prefs(user_id)` SECURITY DEFINER que mapea `category → canal permitido`. (Tabla dedicada `notification_preferences` por categoría = mejora opcional post-F3, no bloqueante.)

## 6. Fases (una rama por fase, revisión entre cada una)

### F0 — Datos + RLS + trigger + outbox `[DB]`
- Migración: columnas en `notifications`, tabla `notification_deliveries`, trigger `enqueue_notification_delivery()` (con `SET search_path = pg_catalog, public, pg_temp`), índices, GRANTs explícitos, RLS deny-all en el outbox.
- Habilitar `pg_net` (confirmar disponible en el proyecto Supabase) — si no, F1 arranca worker-only.
- **Adelanto del caso escuela (desde F5, prerequisito de F-R):** al tocar el RPC de auto-approve (`20260721000001`) en este mismo commit, agregar `notify_user(owner/admins de la escuela)` con `category='payment'` y `data` poblado. Sin esto la tablet de recepción (logueada como admin) no ve nada por RLS.
- Poblar `data` en los productores de dinero (ver §5).
- **Plan de migración antes de escribir SQL** (este doc) → aprobar → escribir → revisar RLS línea por línea.
- **Aceptación:** insertar una fila en `notifications` (por cualquier vía) crea exactamente 1 fila `pending` en el outbox; la campana in-app sigue en vivo sin regresión; el auto-approve genera notificación al owner/admins con `data` completo.

### F1 — Dispatcher unificado en BFF `[BFF/API]` · IMPLEMENTADO (sin migraciones; falta suite de concurrencia)
Decisiones de implementación (ajustes del user): **claim por LEASE** (no marca `sent` al reclamar; empuja `next_attempt_at +2min` y `attempts++` con guard optimista por `attempts`; estado final solo tras el intento real → crash entre claim y envío ⇒ el lease expira y el worker retoma). **Retry por canal:** salta canales con `_sent > 0` (no duplica en fallos parciales). **Endpoint fail-closed:** sin `NOTIF_DISPATCH_SECRET` en env ⇒ 401 siempre. **Payload web push truncado ~4KB** (dropea `data` si excede) y **try/catch por fila** en el worker. **Prefs:** `system`/seguridad ignoran todo; el toggle global `push_notifications` se respeta salvo esas; `marketing` respeta además su toggle. **Edge Function** se retira post-validación en prod (no en este deploy). Archivos: `config/webpush.ts`, `services/webpush.service.ts`, `services/notification.service.ts`, `routes/internal-notifications.routes.ts`, `jobs/notifications-dispatch.job.ts`; cron cada minuto en `maintenance.job.ts`; montaje `/internal/notifications` en `index.ts`.

### F1 (plan original) — Dispatcher unificado en BFF `[BFF/API]`
- `bff/src/services/notification.service.ts`: `dispatch(notificationId)` → carga + preferencias (D5) → Web Push (`web-push`) + Nativo (`firebase-admin`, ya existe `push.service`) → actualiza outbox, revoca/borra tokens muertos (FCM `UNREGISTERED`; Web Push `404/410 Gone`).
- Endpoint `POST /internal/notifications/dispatch` protegido por header secreto (lo llama `pg_net`) — idempotente por `delivery_id` con claim `FOR UPDATE SKIP LOCKED`.
- Worker `bff/src/jobs/notifications-dispatch.job.ts`: drena `pending` + `failed` con backoff cada 60s.
- VAPID env en BFF (Render); `web-push` a dependencias BFF.
- **Deprecar** Edge Function `send-push-notification`.
- **Tests de concurrencia** (obligatorio en fase backend): N notificaciones simultáneas → 0 doble-envíos (claim atómico), idempotencia bajo reintentos, tokens muertos revocados una sola vez.
- **Aceptación:** una notificación real dispara push a un dispositivo suscrito; caída del BFF → el worker reintenta y entrega al recuperar.

### F2 — FCM unificado iOS/Android `[Mobile/Native]`
- Swap `@capacitor/push-notifications` → `@capacitor-firebase/messaging` en `useDeviceContext.ts`; `push_provider='fcm'` siempre.
- `capacitor.config.ts` plugins; Android `google-services.json` (ya existe).
- **Paso manual documentado:** subir APNs Auth Key a Firebase `sportmaps-b865b` + capabilities Push en Xcode.
- **Aceptación:** token FCM válido en `user_devices` desde iOS y Android; `test-push` llega a ambos.

### F3 — Preferencias reales `[Front + DB]`
- Dispatcher honra `get_notification_prefs`; `NotificationsSection` deja de ser decorativo (ya guarda; ahora se aplica).
- Categoría por evento (mapa en §8) para filtrado fino.
- **Aceptación:** apagar "push" en ajustes → no llega push (sí in-app); apagar "marketing" → no llega esa categoría.

### F4 — iOS PWA install + web push UX `[Front]`
- Detección `standalone` + iOS; banner de instrucciones "Compartir → Agregar a inicio" **visible en iOS aunque el estado sea `unsupported`** (arregla hallazgo #7).
- Metas `apple-mobile-web-app-capable` / `-status-bar-style` en `index.html`.
- Ofrecer `subscribe` solo tras instalación (iOS 16.4+ standalone).
- **Aceptación:** en iPhone Safari no instalado se ve la guía; instalado + activar → suscripción en `push_subscriptions`.

### F5 — Sweep de productores + limpieza `[Full-stack]`
- Verificar que **todo** productor escribe en `notifications` (los inserts directos del BFF pasan por un helper compartido `notify()` para forma/categoría consistentes).
- **Eliminar** los 2 `functions.invoke('send-push-notification')` de los modales de abono (el trigger ya lo hace).
- Arreglar el caso escuela: notificar al **owner/admins** de la escuela vía `notify_user` (no `school_id` en subs).
- Unificar los dos manifests (#9); dedupe `subscribeToPush` (#10); nota de drift de esquema (#11).
- **Aceptación:** matriz de eventos (§8) entrega por los canales esperados; 0 llamadas push client-side.

### F-R — Modo Recepción (notificaciones visuales animadas + voz) `[Front]` · paralela a F1
Capa de presentación del canal in-app (toast animado por categoría + sonido + voz) para el dispositivo de recepción. **Transporte: Realtime (ya funciona); cero push, cero outbox.** Depende solo de F0 (columnas `category`+`data`) y del adelanto del caso escuela. Especificación completa en **Anexo §11**.

### F6 — Auditoría + QA + observabilidad `[QA]`
- Métricas por canal (sent/failed/revoked) desde `notification_deliveries`; audit trail.
- **Matriz de QA por plataforma** (§7). Retener `test-push` como healthcheck.
- **Aceptación:** todas las celdas de la matriz verdes o con gap documentado.

## 7. Matriz de QA por plataforma

| Plataforma | Canal esperado | Precondición | Nota |
|---|---|---|---|
| Chrome Android (navegador) | Web Push | permiso concedido | |
| Chrome Android (PWA instalada) | Web Push | instalada + permiso | |
| Chrome/Edge Desktop | Web Push | permiso | |
| Safari iOS (navegador) | ninguno | — | mostrar guía instalación (F4) |
| Safari iOS (PWA instalada, ≥16.4) | Web Push | instalada + permiso | |
| Chrome iOS | ninguno/limitado | WebKit | documentar limitación |
| App nativa Android | FCM | token registrado | |
| App nativa iOS | FCM (APNs vía Firebase) | APNs Auth Key + permiso | F2 |
| In-app (todas) | campana Realtime | sesión activa | ya funciona |

## 8. Inventario de productores (para F3/F5)

**Frontend (RPC `notify_user`):** `lib/api/transactions.ts` (×3), `lib/api/checkout.ts`, `PaymentsAutomationPage.tsx` (×2), `ParentCheckoutPage.tsx`, `RegisterCashPaymentModal.tsx`, `ApprovePaymentMethodSheet.tsx`, `PaymentCheckoutModal.tsx`.
**BFF (INSERT directo service_role):** `jobs/glosa-notifications.job.ts`, `routes/access-adms.ts`, `routes/athlete/training.ts` (×6), `routes/marketplace-admin.routes.ts`, `routes/vendor.routes.ts`, `routes/trainer/availability.ts`.
**SQL (crons/RPCs/triggers):** series QR (`20260620/22/24/25*`), glosas (`20260717000003`), payment reminders (`20260713000004`), equipment (`20260715000002`), certificates (`20260424000004`), plan-upgrade (`20260514000001`), logistics/marketplace/inventory (`20260417*`, `20260418*`), receipt auto-approve (`20260721000001`).
**A eliminar (push ad-hoc roto):** `functions.invoke('send-push-notification')` en `InstallmentCheckoutModal.tsx` y `ReviewInstallmentModal.tsx`.

## 9. Riesgos / gotchas

- **pg_net latencia/errores:** el POST desde trigger es best-effort; el outbox+worker es la garantía. Nunca bloquear el INSERT del productor si el dispatch falla.
- **Idempotencia:** `UNIQUE(notification_id)` en outbox + claim `FOR UPDATE SKIP LOCKED` evitan doble-envío bajo pg_net + worker concurrentes.
- **FCM multicast:** límite 500 tokens/lote (hoy irrelevante, prever para broadcast).
- **Secreto endpoint interno (D7):** `/internal/notifications/dispatch` NO accesible con JWT de usuario; header secreto leído de `vault.decrypted_secrets` en el trigger, **jamás hardcodeado en migraciones** ni en `notification_settings`. El valor se crea fuera del repo con `vault.create_secret(...)`.
- **Revocación web push:** `410 Gone`/`404` ⇒ borrar fila de `push_subscriptions` (hoy no se limpia).
- **iOS:** sin APNs Auth Key en Firebase, el push nativo iOS falla silencioso — gate de F2.
- **Preferencias vs transaccional:** definir qué categorías son "siempre" (p.ej. seguridad/acceso) e ignoran el toggle marketing.

## 10. Rollout / backout

- Feature flag `NOTIF_DISPATCH_ENABLED` en BFF: si off, el endpoint responde 204 y el worker no drena (solo in-app sigue). Permite desplegar F0 sin activar envíos.
- Backout: desactivar el trigger (o el flag) revierte al estado actual sin pérdida de notificaciones in-app.
- La Edge Function se retira **después** de validar F1 en producción.

---

## 11. Anexo F-R — Modo Recepción (notificaciones visuales animadas + voz)

**Estado:** incorporado al spec.
**Dependencias:** F0 (columnas `category` + `data`) y el prerequisito del caso escuela (§11.2, adelantado a F0/F1). NO depende de F1–F4 (cero push, cero outbox: su transporte es Realtime, que ya funciona).
**Rama sugerida:** `feat/notif-fr-recepcion` (paralela a F1).

### 11.1 Objetivo

Capa de **presentación espectacular** del canal in-app para el dispositivo de recepción (tablet/PC/celular): cada evento se anuncia con **toast animado diferenciado por categoría + sonido + voz** (speechSynthesis por el parlante/bafle conectado). Cubre TODAS las categorías, con intensidad visual proporcional al tipo de evento (un pago se celebra; una glosa se informa con discreción).

La voz es efímera y local: **no entra al outbox** (`notification_deliveries`), no se reintenta, no suma métricas. La persistencia es la campana/dashboard existente.

### 11.2 Prerequisito — caso escuela (ADELANTADO desde F5)

Hoy la notificación de pago va al **padre** (`user_id` = acudiente). La tablet de recepción está logueada como **admin de la escuela** y por RLS solo ve sus propias notificaciones → sin este fix el modo recepción no tiene qué anunciar.

- Al tocar el RPC de auto-approve (`20260721000001`) en F0/F1, agregar en el mismo commit: `notify_user(owner/admins de la escuela)` con `category='payment'` y `data` poblado.
- Regla general para F5: todo evento relevante para la operación de la sede notifica **también** al owner/admins (pagos, glosas, matrículas, accesos, vencimientos).

**Requisito de `data` (F0):** los productores de dinero pueblan `data` jsonb con al menos `payer_name`, `athlete_name`, `amount`, `concept`, `sede_id`. El modo recepción arma frases y toasts desde `data`, nunca parseando `message`.

### 11.3 Arquitectura

```
INSERT notifications ─► Realtime (canal in-app existente)
                              │
                              ▼
              Ruta /recepcion (modo kiosko, sesión admin)
              suscripción filtrada: user_id = admin AND
              (data->>'sede_id' = sede activa OR sin sede)
                              │
              ┌───────────────┼──────────────────┐
              ▼               ▼                  ▼
        Toast animado    Sonido corto      speechSynthesis
        por categoría    por categoría     (cola FIFO, 1 a la vez)
```

- **Cola FIFO de anuncios:** un solo utterance a la vez; los toasts pueden apilarse (máx. 3 visibles, resto colapsa en "+N").
- **Catch-up al reconectar:** al recuperar Realtime, consultar `notifications` desde el último `created_at` visto y mostrar resumen ("Mientras estabas sin conexión: 4 pagos, 1 glosa") — sin leer cada una por voz.
- **Wake lock** (`navigator.wakeLock`) + re-adquirir en `visibilitychange`.

### 11.4 Presentación por categoría

Principio: **la intensidad de la animación comunica el tipo de evento**. Celebrar dinero que entra; informar con sobriedad lo que requiere gestión; nunca hacer show de un problema.

| category | Color/acento | Animación del toast | Sonido | Voz (plantilla) |
|---|---|---|---|---|
| `payment` (aprobado) | Verde marca | Slide-up + **confetti breve** (canvas-confetti, 1.5s) + contador de recaudo del día animado | Chime ascendente alegre | "Pago recibido: {payer_name}, {amount}, {concept}" |
| `installment` (abono) | Verde suave | Slide-up + barra de progreso del plan animada | Chime corto | "Abono recibido de {payer_name}: {amount}. Va {progress}% del plan" |
| `payment` (recordatorio/vencimiento) | Naranja marca | Slide-in lateral, pulso suave del borde | Tono neutro único | (sin voz por defecto) |
| `glosa` (abierta) | Ámbar | Fade-in discreto, ícono de lupa, SIN animación llamativa | Tono suave grave | Discreto siempre: "Hay un pago en revisión" (sin nombres) |
| `glosa` (resuelta) | Verde/ámbar | Check animado (stroke SVG) | Chime doble | "Se resolvió una revisión de pago" |
| `enrollment` (matrícula nueva) | Naranja + verde | Slide-up + **mascota saludando** (2D) | Fanfarria corta | "¡Bienvenido {athlete_name} a la academia!" |
| `access` (ingreso torniquete/huella) | Gris/verde | Mini-toast compacto, avatar del atleta | Tick sutil | (sin voz; opcional "modo bienvenida": "Hola, {athlete_name}") |
| `qr` / `marketplace` / `equipment` | Neutro | Slide-in estándar | Tick | (sin voz por defecto) |
| `system` / seguridad | Rojo/gris | Toast persistente hasta descartar | Tono de atención | Solo si es crítico |
| Cierre de mes conciliado (futuro) | Verde intenso | **Pantalla completa 5s:** resumen animado + confetti | Fanfarria | "Cierre de {mes}: {n} pagos conciliados, {m} en revisión" |

- Toasts: CSS transforms + Web Animations API; confetti: `canvas-confetti` (~5KB).
- Mascota: 3–4 poses 2D (saludo, check, lupa, celebración) SVG/Lottie ligero; placeholder hasta definir nombre.
- Todo texto del toast viene de `data`; plantilla de voz configurable por sede (permite el nombre de la mascota).
- Accesibilidad: `prefers-reduced-motion` → sin confetti/animaciones grandes, toasts simples.

### 11.5 Configuración por sede

| Ajuste | Valores | Default |
|---|---|---|
| `announcements_enabled` | on/off | on |
| `modo_voz` | completo / discreto (sin montos ni apellidos) / solo_chime | discreto |
| `quiet_hours` | rango horario | 20:00–07:00 |
| `debounce_rafaga` | >N anuncios en 10 min → resumen | N=5 |
| `voz` | `speechSynthesis.getVoices()` es-* con fallback (es-CO raro; probar es-MX/es-US) | auto |
| `volumen` / `rate` | del utterance | 1.0 / 0.95 |
| `modo_bienvenida_acceso` | anunciar ingresos por nombre | off |

**Privacidad (coherente con no exponer a los padres):** `discreto` es el default — en voz alta solo nombre de pila y concepto, sin montos; las glosas jamás se vocalizan con nombre. `completo` es opt-in de la escuela.

### 11.6 Gotchas técnicos (obligatorios)

1. **Autoplay policy:** navegadores bloquean audio/speechSynthesis sin gesto de usuario. El kiosko abre con pantalla "🔊 Activar recepción" — un tap arma el audio para toda la sesión (utterance vacío + audio silencioso en ese gesto). Sin esto el bafle nunca suena.
2. **speechSynthesis en Chrome:** utterances >200 chars pueden cortarse → frases cortas. `getVoices()` es asíncrono (evento `voiceschanged`).
3. **Bluetooth del bafle:** si se desconecta, el audio cae al parlante interno — mostrar indicador de salida activa (`setSinkId` en Chrome para elegir salida).
4. **Tablet Android kiosko:** screen pinning / app fija + wake lock + brillo; documentar en la guía del "kit de recepción".
5. **Realtime:** heartbeat + reconexión con backoff; badge de estado de conexión (verde/amarillo/rojo) en la esquina.

### 11.7 Matriz de QA (dispositivos × presentación)

TODAS las categorías en TODOS los dispositivos objetivo. Evidencia: MP4 + screenshots E2E por celda.

| # | Dispositivo | Salida audio | Toast | Voz | Catch-up | Ráfaga→resumen | Quiet hours |
|---|---|---|---|---|---|---|---|
| 1 | Tablet Android (Chrome, kiosko) | Bafle Bluetooth | ☐ | ☐ | ☐ | ☐ | ☐ |
| 2 | Tablet Android (PWA) | Parlante interno | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3 | PC Windows (Chrome/Edge) | Bafle aux/USB | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4 | PC Windows (Chrome) | `setSinkId` salida secundaria | ☐ | ☐ | — | — | — |
| 5 | Celular Android (Chrome) | Parlante del cel | ☐ | ☐ | ☐ | ☐ | ☐ |
| 6 | iPhone Safari (PWA) | Parlante/BT | ☐ | ☐ (voces es-* iOS) | ☐ | ☐ | ☐ |
| 7 | iPad Safari (PWA) | Bafle BT | ☐ | ☐ | ☐ | ☐ | ☐ |

**Por categoría (mín. dispositivos 1, 3 y 5):** payment aprobado (confetti+contador), installment (barra), glosa abierta (discreto sin nombres), glosa resuelta, enrollment (mascota), access (mini-toast), recordatorio (sin voz), system crítico (persistente), ráfaga 6 pagos/10 min (resumen), reconexión tras 2 min offline (catch-up sin voz por evento).

**Casos negativos:** admin de OTRA escuela no ve/oye nada (RLS); notificación sin `data` completo → toast genérico sin crash; `prefers-reduced-motion` → sin confetti; audio no armado → toasts sí, voz en cola con aviso "🔇 toca para activar audio".

### 11.8 Aceptación

1. Auto-approve real → la tablet muestra toast de pago con confetti y lo anuncia por el bafle en <2 s, sin refresh.
2. Cada categoría de §11.4 tiene presentación diferenciada verificable (video por categoría).
3. Modo discreto: ningún monto ni apellido por el parlante; glosas nunca con nombre.
4. Caída de red de 2 min → al volver, resumen de catch-up correcto sin lectura por voz de cada evento.
5. Matriz §11.7 completa: celdas verdes o gap documentado (ej. limitación iOS).
6. Cero llamadas al outbox / `notification_deliveries` desde este módulo.

### 11.9 Fuera de alcance (a propósito)

Push (F1–F4) · Alexa/Voice Monkey (add-on futuro solo por demanda de cliente) · animaciones en la app del padre (esto es solo el modo recepción del admin) · persistencia/reintento de anuncios de voz.
