# SportMaps BFF — OpenAPI / Postman

`openapi.yaml` = especificación OpenAPI 3.0.3 del BFF (Express). **358 rutas, 429 operaciones**, agrupadas por `tags` (dominios).

## Importar en Postman
1. Postman → **Import** → **File** → elige `openapi.yaml`.
2. Postman genera una **colección** con carpetas por tag (payments, glosas, marketplace, vendor, trainer, athlete, access, events, etc.).
3. Crea un **Environment** con estas variables:
   - `baseUrl` = `https://sportmaps-bff.onrender.com` (prod) o `https://sportmaps-bff-dev.onrender.com` (dev).
   - `bearerToken` = JWT de Supabase de un usuario logueado (de la app: DevTools → Application → Local Storage → token de Supabase, o `supabase.auth.getSession()`).
4. En la colección → **Authorization** → tipo **Bearer Token** → `{{bearerToken}}`. Casi todos los endpoints lo heredan.

## Notas de autenticación (van en el spec)
- **Bearer JWT** (`Authorization: Bearer <token>`) — la mayoría de endpoints.
- **CSRF**: los endpoints sensibles de mutación exigen además el header `X-Requested-With: SportMaps` (ya marcado en el spec vía el parámetro `CsrfHeader`). Ej: `payment-tokens`, `recurring`, `devices` (write), `schools` branding/dominios, `me/data-deletion-request`.
- **Webhooks** (`/webhooks/wompi`, `/webhooks/mercadopago`, `/webhooks/whatsapp`, `/webhooks/shipping`): NO usan JWT, validan firma/secreto propio (`security: []`).
- **Endpoint interno** `POST /internal/notifications/dispatch`: header `x-notif-secret` (esquema `internalSecret`), lo llama pg_net desde la base.
- **ADMS** (`/iclock/*`): tráfico de dispositivos de torniquete, sin JWT (auth por serial + IP allowlist).

## Cómo se generó
Extraído directamente de `bff/src/routes/**` (métodos, paths, params, y bodies desde los `zod` schemas / `req.body`). Los `requestBody` reflejan los campos reales validados; donde el handler delega a un controller sin schema visible, el body queda como `object` genérico.

## Regenerar
Si cambian las rutas, re-extraer del código y re-ensamblar. El spec es un snapshot al 2026-07-22.
