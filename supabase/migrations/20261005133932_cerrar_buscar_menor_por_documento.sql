-- =============================================================================
-- 20261005133932_cerrar_buscar_menor_por_documento.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-05   Versión anterior: 20261005133733
-- Objetivo: cerrar el residual de H-12 (docs/qa/monster-prelanzamiento-2026-10-05.md)
--   en `buscar_menor_por_documento_publico`, la RPC pública (anon) del paso
--   "busca si tu hijo/a ya está cargado" del registro del acudiente.
-- =============================================================================
-- Estado en la viva antes de esta migración (leído 2026-10-05, solo lectura):
--   · 20261005131057 (registrada como 20261005132337) ya filtra por
--     p_school_id y enmascara el contacto del acudiente.
--   · Lo que queda: anon + school_id (público: va en las URL de inscripción y
--     del QR) + documento del menor → "Ma*** · ma***@gmail.com · *** *** 1490"
--     del acudiente que la escuela precargó. Las TI son enumerables y no hay
--     ningún freno de frecuencia: se puede barrer una escuela entera.
--
-- Qué cambia (mismas columnas y tipos: el contrato con el frontend no cambia):
--   1. El contacto del acudiente (parent_name_temp / parent_email_temp /
--      parent_phone_temp) sale SIEMPRE NULL. Las columnas se conservan para no
--      romper a los clientes ya desplegados (JoinSchoolPublicPage los lee como
--      pista opcional; con NULL simplemente no la muestra). Ni siquiera
--      enmascarado: un correo "ma***@gmail.com" + un teléfono "*** 1490"
--      alcanzan para confirmar la identidad de un acudiente que ya se conoce.
--   2. Freno de frecuencia en la base (sin depender del BFF, que no está en
--      este camino: el frontend llama la RPC directo con la llave anon):
--        · por IP (hash) + escuela: 20 búsquedas / 10 min. Un acudiente que
--          teclea el documento dispara ~1 búsqueda por tecla después del 5º
--          dígito (debounce de 500 ms): 2-3 hijos caben de sobra.
--        · por escuela (todas las IP): 1.000 búsquedas / hora. Frena el barrido
--          distribuido sin tumbar una jornada de inscripción masiva.
--      Al pasarse: error P0001 "Demasiadas búsquedas…" (la pantalla ya muestra
--      error.message en un toast). La IP no se guarda: solo md5(ip).
--      Las llamadas de servidor (service_role / sin JWT) no cuentan.
--   3. Un school_id que no existe en schools devuelve 0 filas antes de tocar
--      la bitácora (no crea filas basura con uuids inventados).
--
-- Qué NO cambia (flujo legítimo intacto):
--   · Sigue devolviendo child_id, nombre enmascarado («Carlos S. D.»), escuela,
--     equipo, sede, already_linked y source: es lo que JoinSchoolPublicPage y
--     JoinTeamPage necesitan para que el acudiente reconozca y adopte la ficha
--     (submit_qr_signup / claim_children_by_document re-validan en el servidor).
--   · Mínimo 5 dígitos, filtro por escuela, solo fichas activas.
--
-- Segundo factor: se evaluó pedir además el correo o teléfono que la escuela
-- tiene del acudiente. Se descartó en esta fase: H-16 muestra que esos datos
-- están sucios ("no aplica", teléfonos de 1 dígito) y bloquearía a familias
-- reales. Queda anotado como mejora si el freno resulta insuficiente.
--
-- Usuarios de la RPC (frontend/src, bff/src): JoinSchoolPublicPage.tsx (QR de
-- inscripción, /unirse/:slug) y JoinTeamPage.tsx (/join-team/:teamId). El BFF
-- no la usa.
-- =============================================================================

BEGIN;

-- ─── 1) Bitácora del freno (sin datos personales: hash de IP) ────────────────
CREATE TABLE IF NOT EXISTS public.public_doc_lookup_attempts (
    id          bigserial PRIMARY KEY,
    school_id   uuid        NOT NULL,
    ip_hash     text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_public_doc_lookup_school_time
    ON public.public_doc_lookup_attempts (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_doc_lookup_ip_time
    ON public.public_doc_lookup_attempts (ip_hash, school_id, created_at DESC);

-- Solo la escribe la RPC DEFINER. Nadie la lee por PostgREST (RLS sin policies).
ALTER TABLE public.public_doc_lookup_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_doc_lookup_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.public_doc_lookup_attempts_id_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.public_doc_lookup_attempts TO service_role;

COMMENT ON TABLE public.public_doc_lookup_attempts IS
    'Freno de frecuencia de buscar_menor_por_documento_publico (H-12, 20261005133932). '
    'Guarda md5 de la IP, nunca la IP ni el documento buscado. Se purga sola (>1 día).';

-- ─── 2) La RPC: mismas columnas, sin contacto, con freno ─────────────────────
-- STABLE → VOLATILE (escribe la bitácora). CREATE OR REPLACE lo permite porque
-- el tipo de salida no cambia, y conserva los GRANT; se re-afirman abajo.
CREATE OR REPLACE FUNCTION public.buscar_menor_por_documento_publico(p_doc_number text, p_school_id uuid)
RETURNS TABLE(child_id uuid, nombre text, school_id uuid, school_name text, team_name text,
              branch_name text, already_linked boolean, parent_name_temp text,
              parent_email_temp text, parent_phone_temp text, source text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_doc      text := regexp_replace(COALESCE(p_doc_number, ''), '[^0-9]', '', 'g');
    v_headers  jsonb;
    v_ip       text;
    v_ip_hash  text;
    v_n_ip     integer;
    v_n_school integer;
    v_servidor boolean := COALESCE(auth.role(), '') IN ('service_role', '');
BEGIN
    IF v_doc = '' OR length(v_doc) < 5 OR p_school_id IS NULL THEN
        RETURN;
    END IF;
    -- school_id inventado: 0 filas, sin gastar cupo.
    IF NOT EXISTS (SELECT 1 FROM public.schools s WHERE s.id = p_school_id) THEN
        RETURN;
    END IF;

    IF NOT v_servidor THEN
        BEGIN
            v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
        EXCEPTION WHEN others THEN
            v_headers := NULL;
        END;
        v_ip := COALESCE(
            NULLIF(btrim(v_headers ->> 'cf-connecting-ip'), ''),
            NULLIF(btrim(split_part(COALESCE(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
            NULLIF(btrim(v_headers ->> 'x-real-ip'), ''),
            'sin-ip');
        v_ip_hash := md5(v_ip);

        -- Serializa por escuela: el conteo y la inserción no se cruzan.
        PERFORM pg_advisory_xact_lock(hashtext('buscar_menor:' || p_school_id::text));

        DELETE FROM public.public_doc_lookup_attempts a
         WHERE a.school_id = p_school_id AND a.created_at < now() - interval '1 day';

        SELECT count(*) INTO v_n_ip
          FROM public.public_doc_lookup_attempts a
         WHERE a.ip_hash = v_ip_hash AND a.school_id = p_school_id
           AND a.created_at > now() - interval '10 minutes';
        SELECT count(*) INTO v_n_school
          FROM public.public_doc_lookup_attempts a
         WHERE a.school_id = p_school_id
           AND a.created_at > now() - interval '1 hour';

        IF v_n_ip >= 20 OR v_n_school >= 1000 THEN
            RAISE EXCEPTION 'Demasiadas búsquedas seguidas. Espera unos minutos e inténtalo de nuevo.'
                USING ERRCODE = 'P0001', HINT = 'RATE_LIMITED';
        END IF;

        INSERT INTO public.public_doc_lookup_attempts (school_id, ip_hash)
        VALUES (p_school_id, v_ip_hash);
    END IF;

    RETURN QUERY
    SELECT c.id,
           -- «Carlos Sánchez Díaz» → «Carlos S. D.»
           (split_part(btrim(c.full_name), ' ', 1)
            || COALESCE((SELECT string_agg(' ' || left(w, 1) || '.', '')
                           FROM unnest(string_to_array(btrim(c.full_name), ' ')) WITH ORDINALITY AS t(w, i)
                          WHERE i > 1 AND w <> ''), '')),
           c.school_id, s.name, t.name, b.name,
           (c.parent_id IS NOT NULL),
           NULL::text, NULL::text, NULL::text,
           'children'::text
      FROM public.children c
      LEFT JOIN public.schools s ON s.id = c.school_id
      LEFT JOIN public.teams t ON t.id = c.team_id
      LEFT JOIN public.school_branches b ON b.id = c.branch_id
     WHERE c.school_id = p_school_id
       AND regexp_replace(COALESCE(c.doc_number, ''), '[^0-9]', '', 'g') = v_doc
       AND COALESCE(c.is_active, true)
    UNION ALL
    SELECT ua.id,
           (split_part(btrim(ua.full_name), ' ', 1)
            || COALESCE((SELECT string_agg(' ' || left(w, 1) || '.', '')
                           FROM unnest(string_to_array(btrim(ua.full_name), ' ')) WITH ORDINALITY AS t(w, i)
                          WHERE i > 1 AND w <> ''), '')),
           ua.school_id, s.name, t.name, b.name,
           (ua.linked_profile_id IS NOT NULL),
           NULL::text, NULL::text, NULL::text,
           'unregistered_athlete'::text
      FROM public.unregistered_athletes ua
      LEFT JOIN public.schools s ON s.id = ua.school_id
      LEFT JOIN public.enrollments e ON e.unregistered_athlete_id = ua.id AND e.status IN ('active', 'pending')
      LEFT JOIN public.teams t ON t.id = e.team_id
      LEFT JOIN public.school_branches b ON b.id = ua.branch_id
     WHERE ua.school_id = p_school_id
       AND regexp_replace(COALESCE(ua.doc_number, ''), '[^0-9]', '', 'g') = v_doc
       AND COALESCE(ua.is_active, true);
END;
$fn$;

-- Flujo público: anon la necesita (registro sin sesión). Explícito por RPC.
REVOKE ALL ON FUNCTION public.buscar_menor_por_documento_publico(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_menor_por_documento_publico(text, uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.buscar_menor_por_documento_publico(text, uuid) IS
    'Búsqueda pública (anon) de la ficha de un menor por documento, ACOTADA a p_school_id, para el '
    'registro del acudiente (JoinSchoolPublicPage / JoinTeamPage). Devuelve nombre enmascarado, '
    'escuela/equipo/sede y si ya tiene acudiente. Desde 20261005133932: parent_*_temp salen siempre '
    'NULL (columnas conservadas por compatibilidad) y hay freno de frecuencia por IP (20/10 min) y '
    'por escuela (1.000/h) en public_doc_lookup_attempts.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificación después de aplicar (solo lectura salvo la última) ─────────
-- 1) Contacto nunca sale:
--    SELECT count(*) FILTER (WHERE parent_email_temp IS NOT NULL OR parent_phone_temp IS NOT NULL
--                              OR parent_name_temp IS NOT NULL)
--      FROM public.buscar_menor_por_documento_publico('<doc de una ficha libre>', '<su escuela>');  -- 0
-- 2) Otra escuela → 0 filas.
-- 3) set local role anon; select * from public.public_doc_lookup_attempts;  -- 42501
