-- =============================================================================
-- 20260817222932_blindar_alta_duplicada_de_atleta.sql
-- Autor: brylop   Fecha: 2026-08-17   Versión anterior: 20260817142331
-- Objetivo: que no se pueda crear dos veces al mismo atleta, entre por donde
--           entre. Club Carmel arranca el 19/08 con ~800 deportistas.
--
-- ── Por qué un trigger y no el guard de la ruta ─────────────────────────────
-- El guard existe y es bueno, pero vive en `students-create-one.route.ts` y
-- solo cubre el alta manual del staff. `children` se escribe además desde:
--
--   · submit_qr_signup       (auto-registro por QR)   → adopta bien desde 12-ago
--   · accept_invitation_pro  (aceptar la invitación)  → NO adopta bien
--   · la carga masiva
--
-- `accept_invitation_pro` busca la ficha con `LOWER(TRIM(full_name))` — sin
-- quitar acentos — y solo entre las del propio acudiente o su correo exacto.
-- Por eso «ANAISABEL MONDRAGON MEJIA» no encontró a «Anaisabel Mondragón
-- Mejía»: la ó y la í rompen el match. Y Gabriela Buitrago tampoco, porque el
-- correo precargado (lforero52@) era de otra persona que el de la invitación.
--
-- El trigger cubre las cuatro puertas de una sola vez, y las que vengan.
--
-- ── Por qué no un índice único ──────────────────────────────────────────────
-- Se midió: con (school_id, nombre normalizado, fecha de nacimiento) hay 4
-- grupos en colisión hoy, y los cuatro son de ACADEMIA SUPERIOR BOGOTA, que es
-- `account_type = 'test'` — «Fulanita Tal», «Killian Mbappe», acudiente «Erling
-- Halland». Un índice no puede mirar `schools.account_type`; un trigger sí.
-- Las cuentas de prueba quedan exentas y las reales protegidas, sin tener que
-- borrarle datos a nadie.
--
-- ── Qué se considera "la misma persona" ─────────────────────────────────────
--   (a) mismo DOCUMENTO normalizado (sin puntos, espacios ni guiones), o
--   (b) mismo NOMBRE normalizado Y misma FECHA DE NACIMIENTO.
--
-- (b) es la que atrapa lo que pasó: en los seis duplicados de Dynasty el
-- documento estaba mal tecleado en TODOS (1122651373 vs 1122651393, 141717990
-- sin el 1 inicial, o NULL) pero la fecha de nacimiento era idéntica en los
-- seis. Es el campo que nadie escribe distinto dos veces.
--
-- Exige las DOS cosas juntas a propósito. Solo por nombre fusionaría a las
-- hermanas homónimas; solo por fecha, a media escuela.
--
-- ── La válvula de escape ────────────────────────────────────────────────────
-- Dos personas distintas PUEDEN llamarse igual y nacer el mismo día. Para eso:
--
--     SET LOCAL app.permitir_atleta_duplicado = 'on';
--
-- Es por transacción, así que no se queda prendida. La ruta del BFF ya expone
-- `allow_duplicate` y puede setearla cuando el staff confirma que son dos.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Documento normalizado
--
-- `1.122.651.373`, `1122651373 ` y `1122651373` son el mismo documento. Sin
-- esto, el formato con puntos que sale de un Excel nunca matchea con el que se
-- teclea a mano.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_doc_number(p_doc text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT NULLIF(regexp_replace(coalesce(p_doc, ''), '[^0-9A-Za-z]', '', 'g'), '');
$fn$;

COMMENT ON FUNCTION public.normalize_doc_number(text) IS
    'Documento sin puntos, espacios ni guiones. IMMUTABLE para poder sostener un '
    'indice funcional el dia que la unicidad por documento se pueda encender.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. El guard
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bloquear_atleta_duplicado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_account_type text;
    v_existente    record;
    v_doc          text;
    v_nombre       text;
BEGIN
    -- La válvula. Se mira primero para que la confirmación del staff no pague
    -- el costo de las consultas de abajo.
    IF coalesce(current_setting('app.permitir_atleta_duplicado', true), 'off') = 'on' THEN
        RETURN NEW;
    END IF;

    IF NEW.school_id IS NULL THEN
        RETURN NEW;   -- ficha sin escuela: no hay padrón contra el cual comparar
    END IF;

    -- Las cuentas de prueba y demo se dejan en paz: su data está sembrada a
    -- propósito con homónimos y bloquearlas rompería los seeds.
    SELECT account_type INTO v_account_type FROM public.schools WHERE id = NEW.school_id;
    IF coalesce(v_account_type, 'real') <> 'real' THEN
        RETURN NEW;
    END IF;

    v_doc    := public.normalize_doc_number(NEW.doc_number);
    v_nombre := public.normalize_athlete_name(NEW.full_name);

    SELECT c.id, c.full_name, c.doc_number, c.date_of_birth
      INTO v_existente
      FROM public.children c
     WHERE c.school_id = NEW.school_id
       AND c.id IS DISTINCT FROM NEW.id
       AND c.is_active = true
       AND (
             (v_doc IS NOT NULL AND public.normalize_doc_number(c.doc_number) = v_doc)
             OR (v_nombre IS NOT NULL
                 AND NEW.date_of_birth IS NOT NULL
                 AND public.normalize_athlete_name(c.full_name) = v_nombre
                 AND c.date_of_birth = NEW.date_of_birth)
           )
     ORDER BY (public.normalize_doc_number(c.doc_number) = v_doc) DESC NULLS LAST,
              c.created_at ASC
     LIMIT 1;

    IF v_existente.id IS NOT NULL THEN
        RAISE EXCEPTION
            'Ya existe % en esta escuela (documento %, nacido %). Si es la misma persona, edita esa ficha en vez de crear otra.',
            v_existente.full_name,
            coalesce(v_existente.doc_number, 'sin documento'),
            coalesce(v_existente.date_of_birth::text, 'sin fecha')
            USING ERRCODE = 'unique_violation',
                  DETAIL  = 'atleta_existente_id=' || v_existente.id,
                  HINT    = 'SET LOCAL app.permitir_atleta_duplicado = ''on'' para forzar el alta cuando de verdad son dos personas.';
    END IF;

    RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.bloquear_atleta_duplicado() IS
    'Impide crear dos veces al mismo atleta en una escuela real, entre por donde '
    'entre: alta manual, QR, invitacion o carga masiva. Compara por documento '
    'normalizado, o por nombre normalizado + fecha de nacimiento — que es la '
    'combinacion que atrapo los seis duplicados de Dynasty, donde el documento '
    'estaba mal tecleado en todos y la fecha era identica en todos.';

DROP TRIGGER IF EXISTS trg_bloquear_atleta_duplicado ON public.children;

CREATE TRIGGER trg_bloquear_atleta_duplicado
    BEFORE INSERT OR UPDATE OF full_name, doc_number, date_of_birth, school_id
    ON public.children
    FOR EACH ROW
    EXECUTE FUNCTION public.bloquear_atleta_duplicado();

COMMIT;
