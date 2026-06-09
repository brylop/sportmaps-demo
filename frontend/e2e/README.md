# Tests E2E — Playwright

Tests end-to-end con Playwright. Lo más importante hoy es la suite de **aislamiento de branding** (`branding-isolation.spec.ts`) que valida el fix de Fase 1 del roadmap white-label.

## Pre-requisitos para correr los tests de branding

### 1. Seed de users de prueba (1 vez)

Pegar el contenido de [`supabase/seed/branding_test_users.sql`](../../supabase/seed/branding_test_users.sql) en el SQL Editor de Supabase staging y ejecutar.

El script:
- Crea 4 users (`qa-super-admin`, `qa-pro-admin`, `qa-free-admin`, `qa-parent-multi`).
- Los asocia a `school_members` con roles correctos.
- Busca automáticamente una escuela `tier='free'` para los tests de upsell.
- Imprime los UUIDs como `RAISE NOTICE` — copiarlos para el siguiente paso.

Password de todos los users: **`TestPass123!`** (override via env vars si querés).

### 2. Variables de entorno

```bash
# Apuntar a staging por default — sobreescribir para local
export PLAYWRIGHT_SUPABASE_URL=https://kbgwjkbqsabnsajdmgxn.supabase.co
export PLAYWRIGHT_SUPABASE_ANON_KEY=eyJ...  # anon key de staging (Settings > API)

# UUIDs que imprimió el seed
export PLAYWRIGHT_SCHOOL_PRO_ID=0242cf27-b8ae-4921-8a3a-69d27178ca34
export PLAYWRIGHT_SCHOOL_FREE_ID=<uuid de la free>

# Override opcional de credenciales (si cambiaste el seed)
# export PLAYWRIGHT_SUPER_ADMIN_EMAIL=...
# export PLAYWRIGHT_SUPER_ADMIN_PASSWORD=...
```

### 3. Frontend corriendo

Playwright config arranca `npm run dev` automáticamente (puerto 5173). Verificá que:
- `frontend/.env.local` apunta al BFF correcto (`VITE_BFF_URL=...`).
- El BFF tiene aplicadas las migraciones `20260528000001` + `20260528000002`.

### 4. Correr

```bash
cd frontend
npx playwright test branding-isolation
# o
npx playwright test branding-isolation --headed   # ver el browser
npx playwright test branding-isolation --debug    # debugger interactivo
```

El reporte HTML se genera en `playwright-report/`.

## Qué validan los 5 tests

| Test | Qué valida |
|---|---|
| **1. Aislamiento entre rutas** | Admin Pro ve `data-branding-school-id` en `/dashboard`. **NO** lo ve en `/admin` ni `/marketplace` (rutas en blocklist). |
| **2. Super-admin sin branding** | Super-admin viendo `/dashboard` de escuela Pro NO recibe `BrandingScope` (rol fuera de allowlist). |
| **3. Parent multi-escuela** | Al cambiar `activeSchool` de Pro → Free, el container `data-branding-school-id` cambia o desaparece. No queda colgado el anterior. |
| **4. Free tier ve upsell** | Admin de escuela Free en `/settings/school` ve la upsell card en lugar del color picker. |
| **5. Bypass cerrado** | `supabase.from('schools').update({ branding_settings: ... })` desde el cliente devuelve error `42501` por el trigger `enforce_branding_via_rpc`. |

## Troubleshooting

| Síntoma | Causa probable |
|---|---|
| `Login failed: 400` | password incorrecta o user no creado — re-correr el seed SQL |
| `Login failed: 401` | `PLAYWRIGHT_SUPABASE_ANON_KEY` mal seteada |
| Test 4 falla con "color picker no debería estar" | tier de la escuela "free" no es realmente free — verificar `school_subscriptions.tier` |
| Test 5 falla — no devuelve `42501` | Migración `20260528000002` no aplicada (trigger no existe) |
| Timeout esperando `sidebar-trigger` | Frontend no arrancó / BFF caído — chequear `npm run dev` y BFF en `:3000` |

## Limpieza (rollback de seed)

```sql
DELETE FROM auth.users WHERE email LIKE 'qa-%@sportmaps.test';
-- ON DELETE CASCADE limpia profiles + school_members
```
