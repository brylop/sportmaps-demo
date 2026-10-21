# Plan de mitigación de seguridad — 2026-10-21

Origen: avisos de Node.js (21-oct-2026), cadena de suministro npm (ChainDrop/Shai-Hulud, Darkroom, Zod, tensorlake), OWASP LLM Top 10 2026 y los CVSS 10 de GitLab.
Las cifras y CVE salen de prensa y de la página de Node; verificar cada uno en el aviso oficial antes de citarlo hacia afuera.

## Qué NO nos afecta
- **PHP:** no hay código PHP en el repo.
- **GitLab (CVE-2026-110264 y CVE-2026-97229):** el repo está en GitHub. Solo aplica a quien aloja GitLab propio.
- **Next.js / React Server Components:** somos SPA con Vite.

## Qué SÍ nos afecta
| # | Brecha | Estado hoy |
|---|---|---|
| 1 | Node con CVE altos (Brotli RCE, bypass de hostname TLS, `dns.resolve`) | Local 22.15.0; CI en Node 20 (sin soporte); `render.yaml` sin versión fijada |
| 2 | Dependencias del BFF | 15 vulnerabilidades (1 crítica `proxy-addr`, 5 altas incl. `sharp`) |
| 3 | Dependencias del frontend | 27 vulnerabilidades (2 críticas, 13 altas) |
| 4 | Cadena de suministro npm | Rangos `^`, sin Dependabot, `legacy-peer-deps=true`, sin cooldown |
| 5 | `.env` de prod, stg y dev en `bff/` en disco | Ignorados por git, expuestos a un infostealer local |
| 6 | CI sin `permissions` y acciones sin fijar por SHA | `actions/*@v4`, `codecov-action@v4` |
| 7 | Superficies de IA (bot WhatsApp, OCR de comprobantes, Mapi, voz) | Hay PoC y cierre del 10-05; falta vigilancia continua |
| 8 | Configuración viva de GitHub, Supabase, Render, Vercel | **Sin verificar** |

## Fases

### Fase 1 — hoy (config sin tocar lógica)
1. Node 22.23.4 (o 24.22.1) en: Render (`NODE_VERSION` de los 3 BFF), `engines` de los `package.json`, `.nvmrc`, CI.
2. CI: `NODE_VERSION` de 20 a 22; `permissions: contents: read`; `npm ci`.
3. `.github/dependabot.yml` (npm de raíz, bff, frontend y github-actions; semanal, agrupado, con cooldown de 7 días).
4. `.npmrc`: `ignore-scripts=true` donde el build no lo necesite.

### Fase 2 — esta semana
5. `npm audit fix` en BFF y frontend, sin `--force`. Revisar `sharp`, `proxy-addr` (afecta `req.ip` detrás de Cloudflare) y `firebase-admin`. Correr tests y probar imágenes y comprobantes.
6. Lo que no cierre sin `--force`: decidir uno por uno.
7. Pasar los `.env` de `bff/` fuera del repo local (variables del shell o gestor de secretos).
8. Revisar las instalaciones recientes: ¿alguna versión nueva de `dotenv`, `zod`, `keyv` o similares? Si hay duda, rotar secretos.

### Fase 3 — consola (requiere al usuario)
9. GitHub: protección de `main`, 2FA obligatorio, secret scanning y push protection.
10. Supabase: protección de contraseñas filtradas, MFA de admins, `service_role` fuera del frontend. Sin `get_advisors` ni listados (Disk IO).
11. Render/Vercel/npm/Resend/Wompi/Meta: 2FA y rotación de llaves de API.

### Fase 4 — IA
12. Regla: el modelo nunca aprueba ni mueve dinero por sí solo; confirmación humana o regla determinista.
13. Cuota por usuario y por escuela en bot, OCR y voz; registrar llamadas a herramientas.
14. Tratar texto de imágenes, PDF y notas de voz como dato, nunca como instrucción. Repetir los PoC de `seguridad-llm-*.poc.test.ts` en cada cambio de prompt.

## Criterio de cierre
- `npm audit --omit=dev` sin críticas ni altas en BFF y frontend (o excepción documentada).
- Los 3 BFF y el CI corren Node parcheado.
- `.env` de prod fuera del disco de desarrollo.
- Dependabot activo; checklist de consola firmado.
- `npm run seguridad:invariantes` sin violaciones críticas.
