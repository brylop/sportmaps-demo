# Subdominios `<slug>.sportmaps.co` — Setup operacional

Fase 4 del roadmap white-label. Permite que cada escuela Pro+ tenga su propio subdominio (`acruxgym.sportmaps.co`) que sirve la misma app SportMaps pintada con la marca de esa escuela.

## Pre-requisitos

- ✅ Migración `20260529000001_subdomain_tenant_resolver.sql` aplicada en staging/prod.
- ✅ BFF: middleware `tenantBySubdomain` montado en `index.ts` (ver paso 3 abajo).
- ✅ Frontend: hook `useTenantFromHostname` disponible para componentes que quieren pintar pre-login.
- ⏳ DNS wildcard `*.sportmaps.co → Vercel`.
- ⏳ Vercel Project: agregar wildcard domain.

## Paso 1 — Configurar DNS wildcard

En tu proveedor de DNS (Cloudflare, GoDaddy, etc.), agregar registro:

```
Type:  CNAME
Name:  *
Value: cname.vercel-dns.com
TTL:   3600 (1h)
```

O si usás `A` record (algunos providers no permiten CNAME en root):

```
Type:  A
Name:  *
Value: 76.76.21.21    (IP de Vercel)
```

**Verificar**: `dig acruxgym.sportmaps.co` debe resolver a la IP de Vercel.

## Paso 2 — Vercel: agregar wildcard domain

Vercel Dashboard > Project (sportmaps-frontend) > Settings > Domains:

1. Add Domain: `*.sportmaps.co`.
2. Vercel detecta el wildcard CNAME automáticamente.
3. Esperar a que el SSL cert se emita (1-5 min via Let's Encrypt).

Con esto, **cualquier hostname `<algo>.sportmaps.co`** sirve la misma app SPA. La diferenciación de tenant se hace en runtime via `useTenantFromHostname`.

## Paso 3 — Montar middleware en BFF

Editá [`bff/src/index.ts`](../bff/src/index.ts):

```ts
import { tenantBySubdomain } from './middlewares/tenantBySubdomain';

// Después de helmet + cors, ANTES de los routers:
app.use(tenantBySubdomain);
```

Esto setea `req.subdomainSchoolId` cuando aplica, sin afectar requests del root domain.

## Paso 4 — Usar el hook en el frontend (opcional, para pintar pre-login)

En `App.tsx` o un componente top-level (ej. layout público):

```tsx
import { useTenantFromHostname } from '@/hooks/useTenantFromHostname';

function PublicHeader() {
    const { tenant, isLoading } = useTenantFromHostname();
    if (isLoading) return <Skeleton />;
    if (!tenant) return <DefaultSportMapsHeader />;
    return (
        <div style={{ '--primary': hexToHsl(tenant.branding_settings.primary_color) } as any}>
            {tenant.logo_url && <img src={tenant.logo_url} alt={tenant.name} />}
            <h1>{tenant.name}</h1>
        </div>
    );
}
```

## Feature gate

`get_school_id_by_slug` y `get_school_by_slug` ya validan internamente que la escuela tiene `tier IN ('pro', 'enterprise')` con `school_has_branding_feature()`. Si una escuela Free tiene `slug = "foo"`, el subdominio `foo.sportmaps.co` carga la SPA pero `useTenantFromHostname` devuelve `null` → fallback a branding SportMaps.

Cuando una escuela **upgradea a Pro**, su subdominio empieza a funcionar automáticamente (no requiere acción manual). Cuando **downgradea a Free**, el subdominio sigue resolviendo DNS pero la app cae a default SportMaps.

## Pruebas

```bash
# 1. Resolver DNS
dig +short acruxgym.sportmaps.co
# Esperado: IP de Vercel

# 2. Probar SPA carga
curl -I https://acruxgym.sportmaps.co/
# Esperado: 200 OK con cert válido

# 3. RPC desde el browser (DevTools console en cualquier URL del proyecto)
const { data } = await supabase.rpc('get_school_by_slug', { p_slug: 'acruxgym' });
console.log(data);
// Esperado si Pro+: { ok: true, school: { id, name, slug, logo_url, branding_settings } }
// Si Free o no existe: { ok: false, error: 'not_found' }
```

## Limitaciones conocidas

- **SEO**: Vercel sirve el mismo `index.html` para todos los subdominios. Si querés meta tags por escuela (Open Graph), hay que pre-renderizar con SSR — no incluido en esta fase.
- **Cookies**: cookies del root domain (`.sportmaps.co`) se comparten con subdominios. Sessions Supabase funcionan en ambos sentidos (login en `app.sportmaps.co` → válido en `acruxgym.sportmaps.co`).
- **CORS BFF**: el BFF ya tiene `*.sportmaps.co` en su whitelist (`bff/src/index.ts:180`), así que no requiere cambio.
- **Slugs reservados**: `www`, `app`, `api`, `blog`, `docs`, `admin`, `dev`, `staging`, `preview` están bloqueados (no se intentan resolver como tenant).
