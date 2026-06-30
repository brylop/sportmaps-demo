-- ============================================================
-- SPORTMAPS — Dominios propios (Fase 5)
--
-- Permite que una escuela Elite/Enterprise tenga su propio dominio
-- (ej. app.acruxgym.com) apuntando a SportMaps. Modelo similar al de
-- Shopify, Vercel y Webflow:
--   1. Admin agrega su dominio en /settings/school/domains
--   2. SportMaps emite un verification_token (TXT record en DNS del cliente)
--   3. Cliente configura DNS:
--        TXT _sportmaps-verify.<domain> = <verification_token>
--        CNAME <domain> = cname.vercel-dns.com
--   4. BFF verifica TXT y marca verified_at
--   5. Vercel emite cert SSL automaticamente via Domains API (paso aparte)
--
-- Feature gate: solo escuelas tier='enterprise' o con addon especifico.
-- Pro normales no acceden — usan su subdominio sportmaps.co directamente.
--
-- Politica de la casa: search_path en TODA funcion, RLS en tablas nuevas.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Tabla school_custom_domains
-- ============================================================

CREATE TABLE IF NOT EXISTS public.school_custom_domains (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    domain              text NOT NULL,

    verification_token  text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
    verified_at         timestamptz,
    verified_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    -- ssl_status: pendiente | issued | failed | expired (lo actualiza un job)
    ssl_status          text NOT NULL DEFAULT 'pending'
                          CHECK (ssl_status IN ('pending','issued','failed','expired')),
    ssl_issued_at       timestamptz,
    ssl_expires_at      timestamptz,

    -- Soft delete (un admin puede "remover" un dominio sin perder historial)
    removed_at          timestamptz,
    removed_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    -- Un dominio fisico solo puede pertenecer a una escuela activa a la vez
    CONSTRAINT uq_school_custom_domains_active
        UNIQUE (domain)
);

CREATE INDEX IF NOT EXISTS idx_school_custom_domains_school
    ON public.school_custom_domains(school_id) WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_school_custom_domains_verified
    ON public.school_custom_domains(domain) WHERE verified_at IS NOT NULL AND removed_at IS NULL;

ALTER TABLE public.school_custom_domains ENABLE ROW LEVEL SECURITY;

-- SELECT: admin de la escuela ve sus dominios
DROP POLICY IF EXISTS "custom_domains_school_admin_select" ON public.school_custom_domains;
CREATE POLICY "custom_domains_school_admin_select" ON public.school_custom_domains
    FOR SELECT TO authenticated
    USING (
        school_id IN (
            SELECT sm.school_id FROM public.school_members sm
             WHERE sm.profile_id = auth.uid()
               AND sm.role IN ('owner','super_admin','admin','school_admin')
               AND sm.status = 'active'
        )
    );

-- INSERT/UPDATE/DELETE solo via RPC (SECURITY DEFINER). Cerrado al cliente.
DROP POLICY IF EXISTS "custom_domains_no_direct_write" ON public.school_custom_domains;
CREATE POLICY "custom_domains_no_direct_write" ON public.school_custom_domains
    FOR INSERT TO authenticated WITH CHECK (false);


-- ============================================================
-- 2. Helper: school_has_custom_domain_feature
-- ============================================================
--
-- Solo enterprise. Pro normales tienen subdominio sportmaps.co.
-- Si en el futuro se vende como addon a Pro, ajustar aqui.

CREATE OR REPLACE FUNCTION public.school_has_custom_domain_feature(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS(
        SELECT 1 FROM public.school_subscriptions ss
         WHERE ss.school_id = p_school_id
           AND ss.tier = 'enterprise'
           AND ss.status IN ('active','trialing','grandfathered')
    );
$$;

REVOKE ALL ON FUNCTION public.school_has_custom_domain_feature(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_has_custom_domain_feature(uuid) TO authenticated, service_role;


-- ============================================================
-- 3. RPC add_custom_domain
-- ============================================================

CREATE OR REPLACE FUNCTION public.add_custom_domain(
    p_school_id uuid,
    p_domain    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id   uuid := auth.uid();
    v_has_perm  boolean;
    v_has_feat  boolean;
    v_norm      text;
    v_id        uuid;
    v_token     text;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;

    -- Permiso: admin de la escuela
    SELECT EXISTS(
        SELECT 1 FROM public.school_members
         WHERE school_id = p_school_id AND profile_id = v_user_id
           AND role IN ('owner','super_admin','admin','school_admin')
           AND status = 'active'
    ) INTO v_has_perm;
    IF NOT v_has_perm THEN
        RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;

    -- Feature gate
    SELECT public.school_has_custom_domain_feature(p_school_id) INTO v_has_feat;
    IF NOT v_has_feat THEN
        RETURN jsonb_build_object(
            'ok', false, 'error', 'feature_not_available',
            'message', 'Dominios propios disponibles solo en plan Enterprise.'
        );
    END IF;

    -- Normalizar dominio: lowercase + sin http(s):// + sin trailing slash
    v_norm := lower(trim(both '/' from regexp_replace(p_domain, '^https?://', '', 'i')));

    -- Validacion basica de dominio (no exhaustiva, defense-in-depth en BFF)
    IF v_norm !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_domain');
    END IF;

    -- Bloquear dominios reservados de SportMaps
    IF v_norm = 'sportmaps.co' OR v_norm LIKE '%.sportmaps.co' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'reserved_domain');
    END IF;

    -- Insert (UNIQUE en domain previene duplicados)
    INSERT INTO public.school_custom_domains (school_id, domain)
    VALUES (p_school_id, v_norm)
    RETURNING id, verification_token INTO v_id, v_token;

    RETURN jsonb_build_object(
        'ok', true,
        'id', v_id,
        'domain', v_norm,
        'verification', jsonb_build_object(
            'type', 'TXT',
            'host', '_sportmaps-verify.' || v_norm,
            'value', v_token,
            'note', 'Agrega este registro TXT en tu DNS. Despues, configura un CNAME del dominio principal apuntando a cname.vercel-dns.com'
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.add_custom_domain(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_custom_domain(uuid, text) TO authenticated, service_role;


-- ============================================================
-- 4. RPC mark_custom_domain_verified (la llama el BFF tras checkear DNS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_custom_domain_verified(
    p_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;

    UPDATE public.school_custom_domains
       SET verified_at = COALESCE(verified_at, now()),
           verified_by = v_user_id,
           updated_at  = now()
     WHERE id = p_id
       AND removed_at IS NULL
       AND school_id IN (
           SELECT school_id FROM public.school_members
            WHERE profile_id = v_user_id
              AND role IN ('owner','super_admin','admin','school_admin')
              AND status = 'active'
       );

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_found_or_forbidden');
    END IF;

    RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_custom_domain_verified(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_custom_domain_verified(uuid) TO authenticated, service_role;


-- ============================================================
-- 5. RPC resolver: get_school_id_by_custom_domain
-- ============================================================
--
-- Usada por el BFF middleware (similar a get_school_id_by_slug pero para
-- dominios propios). Solo devuelve si verificado y no removido.

CREATE OR REPLACE FUNCTION public.get_school_id_by_custom_domain(p_domain text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT cd.school_id
      FROM public.school_custom_domains cd
     WHERE cd.domain = lower(p_domain)
       AND cd.verified_at IS NOT NULL
       AND cd.removed_at IS NULL
       AND public.school_has_custom_domain_feature(cd.school_id)
     LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_school_id_by_custom_domain(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_school_id_by_custom_domain(text) TO anon, authenticated, service_role;


COMMENT ON TABLE public.school_custom_domains IS
    'Dominios propios de escuelas Enterprise (Fase 5). Soporta verificacion '
    'TXT + tracking de SSL status. Soft delete via removed_at.';


COMMIT;
