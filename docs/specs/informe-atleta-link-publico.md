# Spec — Portal de Informes por Link Público (sin login)

**Producto:** SportMaps · **Versión:** v0.1
**Fecha:** Agosto 2026
**Estado:** 🟡 diseño resuelto, sin implementar. Asignado a Julian.

> Se construye **por fases con revisión entre cada una** (una rama por fase): (1) migración DB — tabla + RLS + grants, (2) RPCs, (3) BFF, (4) frontend página pública, (5) frontend toggle admin. **Plan aprobado antes de código en migraciones** (convención del repo, `CLAUDE.md`). RLS revisado línea por línea antes de aplicar.

---

## 0. Contexto — por qué existe este módulo

**Club Carmel** (`school_id = 374a6716-af42-4745-afe1-8d089153e01b`, slug `carmel-club`) es cliente que **no paga** — solo quiere usar el módulo de Informe Mensual del Atleta (`docs/specs/athlete-reports-module.md`, ya construido y en develop). Los padres se niegan a crear cuenta / loguearse en la app porque consideran los datos de rendimiento de sus hijos muy sensibles.

**Diagnóstico importante, ya validado con el dueño de producto:** el bloqueo real es de **consentimiento**, no de fricción de UX. Un link sin login no convence a un padre que no quiere que el dato exista compartido — pero si el padre SÍ da su autorización (por WhatsApp o verbal, fuera de la app) y lo único que rechaza es crear una cuenta, entonces un link único sin sesión sí resuelve el problema. Por eso:

- **El consentimiento se registra fuera del sistema.** El admin de la escuela lo obtiene por WhatsApp/verbal y lo refleja con un switch en su panel — no hay pantalla de aceptación para el padre dentro del flujo del link.
- **El link es un portal persistente por atleta**, no uno nuevo cada mes: una sola URL que siempre muestra el histórico completo de informes publicados (pasados y futuros) de ese atleta.
- **El contenido es únicamente informes / rendimiento / métricas.** Nada de pagos, asistencia, mensajería ni ningún otro módulo — ni navegación hacia ellos.

Hoy el informe se despacha (push + correo) con un link a `/children/:id/progress`, que exige sesión de Supabase y está gateado por la policy `athlete_reports_select_family` (`auth.uid()` + `is_parent_of_child()`, en `supabase/migrations/20260731161243_athlete_reports_rls.sql`). El objetivo de este módulo es una vía alterna, opt-in por escuela y por atleta, que no dependa de esa sesión.

### Patrones existentes que se reutilizan (no se inventa un mecanismo nuevo)

| Patrón | Dónde | Por qué aplica |
|---|---|---|
| RPC pública keyed por token opaco, filtra campos | `verify_athlete_id_card_public(p_qr_token uuid)` — `supabase/migrations/20260819113555_carnets_listado_adultos_y_diseno.sql` | Molde exacto para `get_athlete_report_portal`: `SECURITY DEFINER`, `GRANT EXECUTE TO anon, authenticated`, sin pasar por RLS de la tabla real. |
| Página pública que llama Supabase directo, sin BFF | `frontend/src/pages/AthleteCardPublicPage.tsx` (ruta `/c/:qrToken`), fuera de `ProtectedRoute` | Molde para la página nueva: `supabase.rpc(...)` desde el cliente con la anon key, cero hop por el BFF. |
| Tabla sensible con RLS activa y CERO policies (deny-all real) | `whatsapp_identifications`, `payment_consents` | Molde de seguridad: la tabla de tokens nunca es legible directo por `authenticated`/`anon`, todo el acceso pasa por RPC `SECURITY DEFINER`. Evita repetir el error de `payment_links`, que sí exponía sus tokens a `anon` por una policy. |
| El snapshot congelado es "la ÚNICA fuente de la vista del padre" | Decisión D-G del módulo de informes (`athlete_reports.snapshot`) | El portal público lee ESTE snapshot, nunca `performance_entries` en vivo — mantiene la superficie expuesta mínima y coherente con la razón de ser del módulo. |

---

## 1. Migración — tabla + RLS + grants (fase 1, a aprobar sola)

Nueva tabla `public.athlete_report_share_links`:

```sql
CREATE TABLE public.athlete_report_share_links (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    subject_type  text        NOT NULL CHECK (subject_type IN ('profile','child','unregistered')),
    subject_id    uuid        NOT NULL,
    -- 64 hex chars. Se arma con dos gen_random_uuid() para no depender de
    -- pgcrypto/gen_random_bytes (que puede no estar habilitado en esta base).
    token         text        NOT NULL UNIQUE,
    enabled_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
    enabled_at    timestamptz NOT NULL DEFAULT now(),
    revoked_at    timestamptz,   -- NULL = activo
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT athlete_report_share_links_unique_subject
        UNIQUE (school_id, subject_type, subject_id)
);
```

- RLS `ENABLE`, **cero policies** para `authenticated`/`anon` (mismo patrón que `whatsapp_identifications`): la fila nunca es legible directo, solo a través de las RPCs de la fase 2.
- `REVOKE ALL ON public.athlete_report_share_links FROM anon, authenticated` explícito — no confiar en que "no hay policy" alcance (default privileges de Supabase ya mordieron antes, ver `payment_links`).
- Toda `CREATE FUNCTION` de la fase 2 lleva `SET search_path = pg_catalog, public, pg_temp`.
- Columna nueva en `school_settings`: `reports_share_via_token_enabled boolean NOT NULL DEFAULT false` — apagado por default, se prende por escuela (mismo criterio que las columnas hermanas `reports_enabled`/`reports_release_by` ya existentes ahí). Se activa para Carmel con un `UPDATE` puntual después de aplicar la migración, no con un default global.

## 2. RPCs (fase 2)

- **`set_athlete_report_share_link(p_school_id, p_subject_type, p_subject_id, p_enabled boolean)`** — `SECURITY DEFINER`. Exige `can_manage_reports(p_school_id)` Y `school_settings.reports_share_via_token_enabled`. Si `p_enabled = true`: crea la fila si no existe (o le quita `revoked_at`) y devuelve `{token, url}`. Si `false`: `revoked_at = now()`. Solo el admin la llama.
- **`get_athlete_report_share_link(p_school_id, p_subject_type, p_subject_id)`** — para que el admin recupere la URL ya generada sin regenerarla. Mismo gate que la anterior.
- **`get_athlete_report_portal(p_token text)`** — `SECURITY DEFINER`, `GRANT EXECUTE TO anon, authenticated`. Busca la fila por token, exige `revoked_at IS NULL`. Si no existe o está revocado, el mismo error genérico (no distinguir los dos casos, para no dar pistas). Devuelve el nombre del atleta + la lista de informes `status = 'publicado'` de ese `(school_id, subject_type, subject_id)`: `id, period_year, period_month, published_at, snapshot, coach_note`. **Nada más** — sin `hold_reason`, sin ids de staff, sin ninguna otra tabla.
- **`mark_report_viewed_by_token(p_token text, p_report_id uuid)`** — espejo de `mark_report_viewed` (`supabase/migrations/20260801093452_athlete_reports_rpcs_read.sql`) pero valida por token (que el `report_id` pertenezca al `subject` del token) en vez de `auth.uid()` / `is_parent_of_child`.

## 3. BFF — `report-delivery.service.ts` (fase 3)

Donde hoy arma el `link` del correo/push (líneas ~229-231):

```ts
const link = informe.subject_type === 'child'
    ? `${FRONTEND_URL}/children/${informe.subject_id}/progress`
    : `${FRONTEND_URL}/stats`;
```

Antes de esto: si existe una fila activa en `athlete_report_share_links` para ese `(school_id, subject_type, subject_id)`, el link pasa a ser `${FRONTEND_URL}/informes/${token}` (persistente, no cambia mes a mes). Si no hay fila activa, sigue exactamente igual que hoy — ninguna otra escuela se ve afectada.

> Nota aparte para Julian, NO incluida en el alcance de este spec salvo que se decida lo contrario: el link actual ya apunta a `/progress` (dashboard general) y no a `/children/:id/reports/:reportId` (el detalle real del informe) — parece un desfase de cuando la vista dedicada (F4 del módulo de informes) no existía todavía. No mezclar ese fix con esta feature salvo decisión explícita.

## 4. Frontend — página pública (fase 4)

- Ruta nueva en `frontend/src/App.tsx`, **fuera** de `ProtectedRoute` (junto a `/c/:qrToken`, `/cert/:folio`): `informes/:token` → `PublicAthleteReportPortalPage.tsx`.
- Llama `supabase.rpc('get_athlete_report_portal', { p_token: token })` directo desde el cliente (sin BFF), igual que `AthleteCardPublicPage.tsx`. Lista los periodos publicados; al abrir uno, llama `mark_report_viewed_by_token`.
- El render del contenido del snapshot (highlights / en qué trabajar / métricas / nota del coach) se **extrae** de `ChildReportDetailPage.tsx` a un componente compartido (p. ej. `ReportSnapshotView.tsx`) que usan ambas páginas — evita duplicar el JSX sin inventar una abstracción de más.
- Shell mínimo: sin menú, sin links a pagos/asistencia/otro módulo.

## 5. Frontend — toggle del admin (fase 5)

- En el dashboard de informes de la escuela (`MonthlyReportsPage.tsx` / donde ya se lista `report_coverage` por atleta), un control por atleta "Compartir por enlace (sin login)" que llama `set_athlete_report_share_link`. Al activarlo muestra la URL para copiar y mandar por WhatsApp — coherente con que el consentimiento se maneja fuera del sistema.
- Solo visible si `school_settings.reports_share_via_token_enabled = true`.

## 6. Verificación

- `set local role anon; select * from athlete_report_share_links;` → 0 filas por falta de policy, no por RLS silenciosa devolviendo vacío por otra razón.
- `get_athlete_report_portal` con un token inventado → error genérico, no un 500.
- Flujo completo en Carmel: activar el toggle para un atleta con al menos un informe publicado, abrir `/informes/:token` en incógnito (sin sesión), confirmar que se ve el histórico y que `mark_report_viewed_by_token` marca la vista.
- Un atleta SIN fila activa sigue recibiendo el link viejo (`/children/:id/progress`) sin cambios.
- Repaso línea por línea: ninguna policy nueva quedó abierta a `anon`/`authenticated` sobre `athlete_report_share_links` (la lección de `payment_links`).

## Referencia cruzada

Ver [[project_club_carmel_reports_consent]] (memoria) para el contexto de por qué Carmel específicamente necesita esto y qué NO resuelve un link sin sesión (el consentimiento, no la fricción de UX). Ver `docs/specs/athlete-reports-module.md` para el módulo base que este spec extiende.
