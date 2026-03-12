-- Migration: 20260312000001_user_favorites.sql
-- Description: Añade persistencia de favoritos para usuarios autenticados

CREATE TABLE IF NOT EXISTS public.user_favorites (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, school_id)
);

-- RLS
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own favorites"
    ON public.user_favorites
    FOR ALL
    USING (auth.uid() = user_id);

-- RPC 1: toggle_favorite
DROP FUNCTION IF EXISTS toggle_favorite(uuid);
CREATE OR REPLACE FUNCTION toggle_favorite(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_exists boolean;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM user_favorites 
        WHERE user_id = v_user_id AND school_id = p_school_id
    ) INTO v_exists;

    IF v_exists THEN
        DELETE FROM user_favorites WHERE user_id = v_user_id AND school_id = p_school_id;
        RETURN '{"saved": false}'::jsonb;
    ELSE
        INSERT INTO user_favorites (user_id, school_id) VALUES (v_user_id, p_school_id);
        RETURN '{"saved": true}'::jsonb;
    END IF;
END;
$$;

-- RPC 2: get_my_favorites
DROP FUNCTION IF EXISTS get_my_favorites();
CREATE OR REPLACE FUNCTION get_my_favorites()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_result jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT COALESCE(jsonb_agg(school_id), '[]'::jsonb) INTO v_result
    FROM user_favorites
    WHERE user_id = v_user_id;

    RETURN v_result;
END;
$$;

-- RPC 3: migrate_local_favorites
DROP FUNCTION IF EXISTS migrate_local_favorites(uuid[]);
CREATE OR REPLACE FUNCTION migrate_local_favorites(p_school_ids uuid[])
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_inserted_count int := 0;
    v_school_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    IF p_school_ids IS NULL OR array_length(p_school_ids, 1) IS NULL THEN
        RETURN 0;
    END IF;

    FOREACH v_school_id IN ARRAY p_school_ids
    LOOP
        BEGIN
            INSERT INTO user_favorites (user_id, school_id)
            VALUES (v_user_id, v_school_id)
            ON CONFLICT (user_id, school_id) DO NOTHING;
            
            IF FOUND THEN
                v_inserted_count := v_inserted_count + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Ignorar ids inválidos o escuelas que no existen
            CONTINUE;
        END;
    END LOOP;

    RETURN v_inserted_count;
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION toggle_favorite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_favorites() TO authenticated;
GRANT EXECUTE ON FUNCTION migrate_local_favorites(uuid[]) TO authenticated;
