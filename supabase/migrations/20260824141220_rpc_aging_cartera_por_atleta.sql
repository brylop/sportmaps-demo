-- =============================================================================
-- 20260824141220_rpc_aging_cartera_por_atleta.sql
-- Autor: brylop   Fecha: 2026-08-24   Versión anterior: 20260824140944
-- Objetivo: reporte de antigüedad de cartera AGRUPADO POR ATLETA. Hoy
-- `FinancesPage.tsx` lista la cartera por COBRO: un atleta que debe 3 meses
-- aparece como 3 filas sueltas, sin bucket de "1 mes / 2 meses / 3+ meses".
--
-- Decisiones de diseño (no inventadas, alineadas con código ya viviendo):
--   · Set de estados que cuentan como DEUDA A COBRAR: pending, overdue,
--     partial — quien ya subió comprobante (awaiting_approval) o está en una
--     glosa (glosado) YA ACTUÓ; perseguirlo en un reporte de cobranza como si
--     debiera es un error de mensaje, no solo de dato. Se corrige la primera
--     versión de esta RPC, que copiaba el set más ancho de `school_athletes`
--     (mig. 20260804125913) — correcto para "¿está al día?" en el roster, mal
--     para "¿a quién le cobro?". awaiting_approval/glosado se cuentan aparte
--     (en_revision/en_disputa) para no desaparecerlos en silencio.
--   · Identidad del atleta: igual que `open_month`/`preview_open_month`
--     (mig. 20260803114540) — child_id si es menor; si no, COALESCE(user_id,
--     parent_id) para adultos (cubre el pagador adulto legacy guardado en
--     parent_id, que `school_athletes` documenta como limitación conocida y
--     NO cubre); si no, unregistered_athlete_id.
--   · Período futuro no cuenta como vencido: mismo criterio que el
--     `isFuturePeriod` de FinancesPage.tsx — evita que el bug de generación
--     anticipada por QR (2 atletas de Dynasty hoy) infle el bucket de "2+
--     meses" con un mes que ni empezó.
--   · Bucket por CONTEO de períodos debidos, no por días — es el lenguaje de
--     negocio del pedido ("debe el mes activo" vs "debe más de dos meses").
--   · Sede: mismo filtro que el resto de FinancesPage — un cobro sin sede
--     asignada no se excluye al filtrar por sede (branch_id IS NULL cuenta
--     para todas).
--   · REVOKE explícito de authenticated+anon (no solo PUBLIC) porque toca
--     `payments`: PUBLIC no alcanza, los default privileges del esquema dan
--     EXECUTE a authenticated en cada función nueva (CLAUDE.md, trampa #3).
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

CREATE OR REPLACE FUNCTION public.get_payment_aging_report(
    p_school_id uuid,
    p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_caller  uuid := auth.uid();
    v_today   date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_cy      int  := extract(year  from v_today)::int;
    v_cm      int  := extract(month from v_today)::int;
    v_items   jsonb;
    v_sin_atleta int;
    v_en_revision jsonb;
    v_en_disputa  jsonb;
    v_sin_canal   jsonb;
BEGIN
    IF v_caller IS NOT NULL
       AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'No autorizado para ver la cartera de esta escuela.';
    END IF;

    WITH deuda AS (
        SELECT
            p.*,
            CASE
                WHEN p.child_id IS NOT NULL THEN 'child:' || p.child_id::text
                WHEN p.unregistered_athlete_id IS NOT NULL THEN 'unreg:' || p.unregistered_athlete_id::text
                WHEN COALESCE(p.user_id, p.parent_id) IS NOT NULL THEN 'adult:' || COALESCE(p.user_id, p.parent_id)::text
                ELSE NULL
            END AS akey
        FROM public.payments p
        WHERE p.school_id = p_school_id
          AND p.status IN ('pending', 'overdue', 'partial')
          AND (p_branch_id IS NULL OR p.branch_id IS NULL OR p.branch_id = p_branch_id)
          -- Período futuro no vence todavía, aunque su due_date ya haya pasado.
          AND NOT (
                p.period_year IS NOT NULL AND p.period_month IS NOT NULL
                AND (p.period_year::int * 12 + p.period_month::int) > (v_cy * 12 + v_cm)
              )
    ),
    por_atleta AS (
        SELECT
            akey,
            -- uuid no tiene agregado MIN/MAX nativo en Postgres; todas las filas de
            -- un mismo akey comparten el mismo atleta, así que cualquiera sirve.
            max(child_id::text)::uuid                    AS child_id,
            max(unregistered_athlete_id::text)::uuid     AS unregistered_athlete_id,
            max(COALESCE(user_id, parent_id)::text)::uuid AS adult_id,
            max(branch_id::text)::uuid                    AS branch_id,
            count(*)                          AS cuotas_debidas,
            min(make_date(
                COALESCE(period_year::int,  extract(year  from due_date)::int),
                COALESCE(period_month::int, extract(month from due_date)::int),
                1
            ))                                 AS periodo_mas_antiguo,
            -- Lista explícita, no solo el conteo: "2 meses" sin decir CUÁLES es
            -- justo lo que se reportó como poco claro. Se ordena cronológico.
            jsonb_agg(to_char(make_date(
                COALESCE(period_year::int,  extract(year  from due_date)::int),
                COALESCE(period_month::int, extract(month from due_date)::int),
                1
            ), 'MM/YYYY') ORDER BY make_date(
                COALESCE(period_year::int,  extract(year  from due_date)::int),
                COALESCE(period_month::int, extract(month from due_date)::int),
                1
            ))                                 AS periodos_debidos,
            sum(amount - COALESCE(amount_paid, 0)) AS monto_pendiente,
            -- Vencimiento real más antiguo (no el inicio del mes): para contar
            -- asistencia "mientras debía" desde el día exacto en que se venció,
            -- no desde el 1 del mes (que sobrecontaría los días de gracia).
            min(due_date)                      AS vencimiento_mas_antiguo
        FROM deuda
        WHERE akey IS NOT NULL
        GROUP BY akey
    )
    SELECT
        COALESCE(jsonb_agg(jsonb_build_object(
            'athlete',            COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta'),
            'tipo',                CASE
                                       WHEN pa.child_id IS NOT NULL THEN 'menor'
                                       WHEN pa.unregistered_athlete_id IS NOT NULL THEN 'no_registrado'
                                       ELSE 'adulto'
                                   END,
            'branch_id',           pa.branch_id,
            'cuotas_debidas',      pa.cuotas_debidas,
            'periodo_mas_antiguo', to_char(pa.periodo_mas_antiguo, 'MM/YYYY'),
            'periodos_debidos',    pa.periodos_debidos,
            'monto_pendiente',     pa.monto_pendiente,
            'bucket',              CASE
                                       WHEN pa.cuotas_debidas = 1 THEN '1 mes'
                                       WHEN pa.cuotas_debidas = 2 THEN '2 meses'
                                       ELSE '3+ meses'
                                   END,
            -- El cron de recordatorios (send_payment_reminders) exige parent_id
            -- IS NOT NULL: un menor sin acudiente vinculado (carga masiva sin
            -- registrar) NUNCA recibe el recordatorio automático, aunque la
            -- escuela sí tenga su teléfono/correo. Se marca para saber a quién
            -- hay que escribirle a mano (WhatsApp manual) en vez de asumir que
            -- "ya se le avisó".
            'canal_automatico',    CASE
                                       WHEN pa.child_id IS NOT NULL THEN c.parent_id IS NOT NULL
                                       WHEN pa.unregistered_athlete_id IS NOT NULL THEN false
                                       ELSE true
                                   END,
            'contacto_manual',     CASE
                                       WHEN pa.child_id IS NOT NULL AND c.parent_id IS NULL THEN
                                           jsonb_build_object(
                                               'nombre',   c.parent_name_temp,
                                               'telefono', c.parent_phone_temp,
                                               'email',    c.parent_email_temp
                                           )
                                       WHEN pa.unregistered_athlete_id IS NOT NULL THEN
                                           jsonb_build_object('nombre', NULL, 'telefono', ua.phone, 'email', ua.email)
                                       ELSE NULL
                                   END,
            -- Solo informativo — la escuela decide qué hacer con el dato (cobrar,
            -- hablar con la familia, o nada). No bloquea ni impide marcar
            -- asistencia en ningún lado.
            'clases_desde_vencimiento', (
                SELECT count(*)
                FROM public.attendance_records ar
                WHERE ar.school_id = p_school_id
                  AND ar.status IN ('present', 'late')
                  AND ar.attendance_date > pa.vencimiento_mas_antiguo
                  AND (
                        (pa.child_id IS NOT NULL AND ar.child_id = pa.child_id)
                     OR (pa.unregistered_athlete_id IS NOT NULL AND ar.unregistered_athlete_id = pa.unregistered_athlete_id)
                     OR (pa.child_id IS NULL AND pa.unregistered_athlete_id IS NULL AND ar.user_id = pa.adult_id)
                  )
            )
        ) ORDER BY pa.cuotas_debidas DESC, pa.monto_pendiente DESC), '[]'::jsonb)
    INTO v_items
    FROM por_atleta pa
    LEFT JOIN public.children              c  ON c.id  = pa.child_id
    LEFT JOIN public.profiles              pr ON pr.id = pa.adult_id
    LEFT JOIN public.unregistered_athletes ua ON ua.id = pa.unregistered_athlete_id;

    -- Diagnóstico, no silencioso: cobros vivos (deuda real) sin ninguna referencia
    -- de atleta (child_id/user_id/parent_id/unregistered_athlete_id todos NULL).
    -- No deberían existir, pero si existen no se descartan en silencio.
    SELECT count(*) INTO v_sin_atleta
    FROM public.payments p
    WHERE p.school_id = p_school_id
      AND p.status IN ('pending', 'overdue', 'partial')
      AND p.child_id IS NULL AND p.user_id IS NULL
      AND p.parent_id IS NULL AND p.unregistered_athlete_id IS NULL;

    -- No es cartera pero tampoco "pagado": comprobante subido, pendiente de
    -- aprobación de la escuela. Se cuenta aparte para no perseguir a quien
    -- ya actuó, pero tampoco desaparecerlo del reporte.
    SELECT jsonb_build_object('count', count(*), 'monto', COALESCE(sum(p.amount - COALESCE(p.amount_paid, 0)), 0))
      INTO v_en_revision
    FROM public.payments p
    WHERE p.school_id = p_school_id
      AND p.status = 'awaiting_approval'
      AND (p_branch_id IS NULL OR p.branch_id IS NULL OR p.branch_id = p_branch_id);

    -- Glosa = disputa/objeción del cobro, workflow aparte (ver módulo de Glosas).
    SELECT jsonb_build_object('count', count(*), 'monto', COALESCE(sum(p.amount - COALESCE(p.amount_paid, 0)), 0))
      INTO v_en_disputa
    FROM public.payments p
    WHERE p.school_id = p_school_id
      AND p.status = 'glosado'
      AND (p_branch_id IS NULL OR p.branch_id IS NULL OR p.branch_id = p_branch_id);

    -- Resumen rápido de a cuántos NO les llega nada automático (solo alcanzables
    -- por WhatsApp manual, con el contacto de `contacto_manual` en cada item).
    SELECT jsonb_build_object(
               'atletas', count(*) FILTER (WHERE NOT (i->>'canal_automatico')::boolean),
               'monto',   COALESCE(sum((i->>'monto_pendiente')::numeric)
                                    FILTER (WHERE NOT (i->>'canal_automatico')::boolean), 0)
           )
      INTO v_sin_canal
    FROM jsonb_array_elements(v_items) i;

    RETURN jsonb_build_object(
        'school_id',           p_school_id,
        'branch_id',           p_branch_id,
        'generated_at',        v_today,
        'count',               jsonb_array_length(v_items),
        'items',               v_items,
        'sin_atleta_identificable', v_sin_atleta,
        'en_revision',         v_en_revision,
        'en_disputa',          v_en_disputa,
        'sin_canal_automatico', v_sin_canal
    );
END;
$$;

COMMENT ON FUNCTION public.get_payment_aging_report(uuid, uuid) IS
    'Cartera vencida/pendiente agrupada por atleta con bucket de antigüedad (1 mes / 2 meses / 3+ meses), contado por PERÍODOS debidos. Deuda = pending/overdue/partial únicamente. awaiting_approval y glosado se reportan aparte (en_revision/en_disputa), no se persiguen como deuda. Cada item marca canal_automatico (false = solo alcanzable por WhatsApp manual, con contacto_manual) y clases_desde_vencimiento (informativo, asistencia desde que se venció el cobro más antiguo — no bloquea nada, la escuela decide). Excluye período futuro.';

REVOKE ALL ON FUNCTION public.get_payment_aging_report(uuid, uuid) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_payment_aging_report(uuid, uuid) TO authenticated;

COMMIT;

-- ── Verificación después de aplicar ────────────────────────────────────────
--   select get_payment_aging_report('2d509571-3238-4c04-ac3f-6dfe20539226', NULL);
--   Esperado hoy (2026-08-24): 204 atletas, $30.610.000, todos bucket "1 mes"
--   (Dynasty no tiene awaiting_approval/glosado vivos en agosto hoy, así que
--   en_revision/en_disputa deberían dar count=0 — el ajuste de set de estados
--   no cambia el total de Dynasty, pero sí lo hará en escuelas con glosas o
--   comprobantes en revisión).
