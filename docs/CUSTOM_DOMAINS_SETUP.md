# Dominios propios `app.escuela.com` — Setup operacional

Fase 5 del roadmap white-label. Permite que escuelas **Enterprise** usen su propio dominio (en lugar de `<slug>.sportmaps.co`).

## Pre-requisitos

- Migración `20260529000002_custom_domains_elite.sql` aplicada.
- BFF routes registradas en `index.ts` (ya hecho).
- Cuenta del cliente en escuela tier `enterprise`.
- **Vercel Project token** con permisos para Domains API (env var `VERCEL_API_TOKEN`).

## Flujo end-to-end (admin de la escuela)

### 1. Agregar dominio en la UI (a construir en frontend)

UI llama `POST /api/v1/schools/<id>/domains` con body `{ "domain": "app.acruxgym.com" }`. Respuesta:

```json
{
  "ok": true,
  "id": "uuid",
  "domain": "app.acruxgym.com",
  "verification": {
    "type": "TXT",
    "host": "_sportmaps-verify.app.acruxgym.com",
    "value": "a3f81b...token...",
    "note": "Agrega este TXT en tu DNS. Despues, configura un CNAME del dominio principal apuntando a cname.vercel-dns.com"
  }
}
```

### 2. Cliente configura DNS

En el panel DNS del cliente (Cloudflare, GoDaddy, Route53, etc.):

```
# Paso A — Verificacion de propiedad
Type:  TXT
Host:  _sportmaps-verify.app
Value: a3f81b...token...
TTL:   3600

# Paso B — Apuntar el dominio a Vercel
Type:  CNAME
Host:  app
Value: cname.vercel-dns.com
TTL:   3600
```

### 3. Admin click "Verificar" en la UI

UI llama `POST /api/v1/schools/<id>/domains/<did>/verify`. El BFF:
1. Resuelve TXT `_sportmaps-verify.app.acruxgym.com` via `dns.resolveTxt()`.
2. Compara el valor con el `verification_token` en DB.
3. Si match → llama RPC `mark_custom_domain_verified` (marca `verified_at = now()`).
4. Devuelve `{ ok: true, verified: true, next_step: "Configura CNAME..." }`.

Respuestas posibles:
- `200 ok: true` — verificado.
- `400 txt_record_not_found` — DNS aún no propagado. Esperar (5min–24h).
- `400 txt_record_mismatch` — el TXT existe pero no contiene el token. Verificar copy/paste.

### 4. Vercel emite SSL (paso aparte)

Hoy NO tenemos automación. Hay 2 opciones:

**Opción A — Manual (MVP)**:
- Owner SportMaps va a Vercel Project > Domains.
- "Add Domain": `app.acruxgym.com`.
- Vercel detecta el CNAME y emite SSL Let's Encrypt en 5-15 min.

**Opción B — Automatizado via Vercel Domains API** (recomendado a futuro):
- En el BFF, después del `mark_custom_domain_verified`, hacer POST a `https://api.vercel.com/v10/projects/<projectId>/domains` con `{ name: domain }` y `Authorization: Bearer ${VERCEL_API_TOKEN}`.
- Cron job que poll SSL status y actualiza `ssl_status` + `ssl_issued_at`.

### 5. El subdomain queda activo

Una vez `verified_at IS NOT NULL` y SSL emitido, el frontend (via `useTenantFromHostname` adaptado) puede detectar el custom domain y resolver el branding. Hay que extender el hook para llamar a `get_school_id_by_custom_domain` si el hostname NO termina en `.sportmaps.co`.

## Extensión pendiente del frontend

Hoy `useTenantFromHostname` solo detecta `<slug>.sportmaps.co`. Para soportar custom domains, agregar:

```ts
// dentro de useTenantFromHostname, antes del fallback "no es tenant":
if (!clean.endsWith('.sportmaps.co')) {
    // Puede ser custom domain — intentar resolver via RPC
    const { data } = await supabase.rpc('get_school_id_by_custom_domain', { p_domain: clean });
    if (data) {
        // ... resolver branding completo
    }
}
```

Esto se agrega cuando se priorice tener custom domains funcionando end-to-end.

## Feature gate

`add_custom_domain` y `get_school_id_by_custom_domain` ya validan tier `enterprise` con `school_has_custom_domain_feature()`. Si una escuela downgrade de Enterprise a Pro, los custom domains siguen en DB pero **el resolver deja de devolverlos** → el dominio cae a 404 en SportMaps.

## Pruebas SQL

```sql
-- Listar dominios verificados activos
SELECT cd.domain, s.name AS school
  FROM public.school_custom_domains cd
  JOIN public.schools s ON s.id = cd.school_id
 WHERE cd.verified_at IS NOT NULL
   AND cd.removed_at IS NULL;

-- Resolver dominio
SELECT public.get_school_id_by_custom_domain('app.acruxgym.com');
```

## Limitaciones conocidas

- **Cron de SSL renewal**: hoy no monitoreamos `ssl_expires_at`. Vercel renueva Let's Encrypt automáticamente cada 60 días, pero si falla no nos enteramos sin un job. **TODO**: cron diario que llama Vercel API y actualiza `ssl_status`.
- **Multi-domain por escuela**: el schema permite múltiples (varios `school_id` rows). Cada admin puede agregar varios para A/B o redirects. Por ahora la UI debería limitar a 1 activo por escuela.
- **No hay UI todavía**: los endpoints están listos pero la página `SchoolCustomDomainsPage.tsx` queda pendiente de construir (similar a `BrandingSettingsForm.tsx`).
