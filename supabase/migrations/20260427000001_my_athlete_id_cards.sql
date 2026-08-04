-- Migration: 20260427000001_my_athlete_id_cards.sql
-- Description: RPC publica para que un padre o atleta vea TODOS sus carnets
--   activos (multi-hijo, multi-escuela) en una sola llamada. Cada fila trae
--   datos del atleta + escuela + branding para renderizar el carnet correcto.

CREATE OR REPLACE FUNCTION public.my_athlete_id_cards()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows jsonb;
BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.school_name, t.athlete_name), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT
            aic.id                            AS card_id,
            aic.qr_token,
            aic.status,
            aic.issued_at,
            aic.valid_until,
            aic.version,
            aic.school_id,
            s.name                            AS school_name,
            s.slug                            AS school_slug,
            s.logo_url                        AS school_logo,
            s.branding_settings               AS school_branding,
            -- Atleta
            CASE WHEN aic.child_id IS NOT NULL THEN 'child'::text ELSE 'profile'::text END AS athlete_kind,
            COALESCE(aic.child_id, aic.profile_id) AS athlete_id,
            COALESCE(c.full_name, p.full_name)     AS athlete_name,
            COALESCE(aic.photo_url, c.avatar_url, p.avatar_url) AS athlete_photo,
            t2.name                          AS team_name,
            sb.name                          AS branch_name,
            -- Vigencia
            (aic.valid_until < CURRENT_DATE) AS is_expired,
            -- Quien soy yo respecto a este carnet (para tooltip)
            CASE
                WHEN aic.profile_id = auth.uid() THEN 'self'
                WHEN aic.child_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.children cc
                    WHERE cc.id = aic.child_id AND cc.parent_id = auth.uid()
                ) THEN 'parent'
                ELSE 'unknown'
            END AS relation
        FROM public.athlete_id_cards aic
        LEFT JOIN public.children       c   ON c.id  = aic.child_id
        LEFT JOIN public.profiles       p   ON p.id  = aic.profile_id
        LEFT JOIN public.schools        s   ON s.id  = aic.school_id
        LEFT JOIN public.teams          t2  ON t2.id = c.team_id
        LEFT JOIN public.school_branches sb ON sb.id = c.branch_id
        WHERE
            -- Mi propio carnet (atleta adulto con profile_id)
            aic.profile_id = auth.uid()
            -- O carnet de un hijo mio
            OR (
                aic.child_id IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM public.children cc
                    WHERE cc.id = aic.child_id AND cc.parent_id = auth.uid()
                )
            )
        ORDER BY s.name, COALESCE(c.full_name, p.full_name)
    ) t;

    RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_athlete_id_cards() TO authenticated;

COMMENT ON FUNCTION public.my_athlete_id_cards() IS
    'Retorna todos los carnets activos/revocados/expirados de los atletas que el caller tiene a cargo (su propio profile + hijos). Multi-escuela soportado: cada carnet trae branding propio.';
