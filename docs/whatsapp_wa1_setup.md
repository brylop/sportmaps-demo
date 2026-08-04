# WhatsApp AI Channel — WA1 (fundación) · Runbook

Integración **oficial** con la WhatsApp Cloud API de Meta, modelo Tech Provider
multi-tenant. Este documento conecta los pasos de Meta con el código ya
implementado en el BFF.

## Qué quedó implementado (WA1)

| Capa | Archivo |
|---|---|
| Migración (6 tablas + 3 RPCs, RLS) | `supabase/migrations/20260618100000_whatsapp_ai_channel_wa1.sql` |
| Servicio (HMAC, Graph API, tenant cache, cifrado token) | `bff/src/services/whatsapp.service.ts` |
| Webhook (GET verify + POST receiver) | `bff/src/routes/whatsapp.ts` |
| Wiring + raw body para HMAC | `bff/src/index.ts` |
| Variables de entorno | `bff/.env` |

Endpoints:
- `GET  /api/v1/webhooks/whatsapp` — verificación (challenge de Meta)
- `POST /api/v1/webhooks/whatsapp` — recepción de mensajes (todas las escuelas)

## Variables de entorno requeridas

```bash
WHATSAPP_APP_SECRET=        # Meta App → Settings → Basic → App Secret
WHATSAPP_VERIFY_TOKEN=sportmaps_wa_verify_dev_2026   # lo inventas tú
WHATSAPP_GRAPH_VERSION=v21.0
WHATSAPP_TOKEN_ENC_KEY=     # 32 bytes: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Pasos en Meta (Fase 2 — se puede hacer YA, sin verificación de negocio)

1. **developers.facebook.com → My Apps → Create App → Business.**
2. **Add Product → WhatsApp → Set up.** Esto crea número de prueba + WABA de prueba.
3. Copia a `bff/.env`:
   - **App Secret** (Settings → Basic) → `WHATSAPP_APP_SECRET`
   - Genera y pega `WHATSAPP_TOKEN_ENC_KEY` (comando arriba)
4. **WhatsApp → Configuration → Webhook:**
   - **Callback URL:** `https://<tu-ngrok>/api/v1/webhooks/whatsapp`
   - **Verify Token:** el mismo valor de `WHATSAPP_VERIFY_TOKEN`
   - Click **Verify and Save** → debe pasar (lo maneja el GET).
   - **Webhook fields:** suscribe `messages`.

## Probar local (con ngrok)

```bash
# 1. Levanta el BFF
cd bff && npm run dev

# 2. Expón el puerto 3000 (ya tienes ngrok configurado en el repo)
ngrok http 3000
#    usa la URL https en el Callback URL del paso 4 de arriba

# 3. En el panel de Meta (WhatsApp → API Setup) envía un mensaje de prueba
#    desde tu número agregado como recipient. Debe verse en los logs:
#    "WhatsApp: inbound stored. Bot turn pending (WA2...)"
```

## Conectar el número de prueba como integración (tenant)

El webhook **solo procesa números con integración `active`**. Para el número de
prueba, inserta una fila (vía SQL editor de Supabase, con una escuela real):

```sql
-- El access token de prueba dura 24h; para WA1 sirve. Cífralo con el helper:
--   node -e "const s=require('./bff/dist/services/whatsapp.service'); \
--            console.log(s.encryptToken('EAAG...token...'))"
INSERT INTO public.school_whatsapp_integrations
  (school_id, phone_number_id, waba_id, display_phone_number,
   access_token_encrypted, verify_token, status, connected_at)
VALUES
  ('<SCHOOL_UUID>', '<PHONE_NUMBER_ID>', '<WABA_ID>', '+1 555 ...',
   '<TOKEN_CIFRADO>', 'sportmaps_wa_verify_dev_2026', 'active', now());
```

## Lo que sigue (NO está en WA1)

- **WA2 (bot):** identificación OTP por email, DeepSeek V3 con function-calling
  sobre los 5 intents, modo asistido (drafts) vs auto. Punto de entrada:
  `handleBotTurn()` en `bff/src/routes/whatsapp.ts`.
- **Embedded Signup:** que cada escuela conecte su propio número (requiere App
  Review + Business Verification con el RUT — en curso).
- **Inbox admin (frontend):** estilo Intercom con Realtime de Supabase.

## Decisiones de arquitectura honradas en WA1

- Multi-tenant por `phone_number_id` (UNIQUE) + cache LRU 5 min.
- HMAC-SHA256 obligatorio sobre raw body; rechaza no firmados (401).
- Token Meta cifrado en reposo (AES-256-GCM, clave en env, rotación soportada).
- Idempotencia por `wa_message_id` (UNIQUE en BD).
- Kill-switch por número (`whatsapp_blocked_numbers`, riesgo R14).
- RLS estricta: escritura solo service_role/RPC; SELECT acotado al dueño de la escuela.
- Modo asistido por defecto (`whatsapp_settings.mode`, decisión #3).
```
