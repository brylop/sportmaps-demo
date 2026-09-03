-- =============================================================================
-- 20260831172237_f4_corregir_enlace_informe_adopcion.sql
-- Autor: judegor99   Fecha: 2026-08-31   Versión anterior: 20260831163530
-- Objetivo: F4 del Informe Mensual del Atleta ya existe
--   (frontend/src/pages/Child{Reports,ReportDetail}Page.tsx, rutas
--   /children/:id/reports y /children/:id/reports/:reportId) — pero
--   adopt_reports_on_child_link() (20260801093452) seguía notificando con el
--   enlace de rodeo `/children/:id/progress`, escrito cuando F4 todavía no
--   existía. Mismo fix que se aplicó en report-delivery.service.ts (TS, sin
--   necesidad de migración) para el correo/notificación del emisor diario.
--
-- CREATE OR REPLACE del mismo cuerpo de 20260801093452, un solo cambio: el
-- `link` de la notificación. Nada más se toca — ni el trigger, ni el resto
-- de la función.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.adopt_reports_on_child_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_report record;
BEGIN
    SELECT ar.id, ar.school_id, ar.period_year, ar.period_month
      INTO v_report
      FROM public.athlete_reports ar
     WHERE ar.subject_type  = 'child'
       AND ar.subject_id    = NEW.id
       AND ar.status        = 'publicado'
       AND ar.recipient_id IS NULL
     ORDER BY ar.period_year DESC, ar.period_month DESC
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    UPDATE public.athlete_reports
       SET recipient_id = NEW.parent_id,
           updated_at   = now()
     WHERE id = v_report.id;

    BEGIN
        INSERT INTO public.notifications (user_id, school_id, title, message, type, link)
        VALUES (
            NEW.parent_id,
            v_report.school_id,
            'Tienes un informe esperándote',
            format('Ya puedes ver el informe de %s.',
                   to_char(make_date(v_report.period_year, v_report.period_month, 1), 'TMMonth YYYY')),
            'report',
            -- F4 ya existe: la vista dedicada del informe, no la evolución general.
            format('/children/%s/reports/%s', NEW.id, v_report.id)
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'adopt_reports_on_child_link: no se pudo notificar (%): %',
            SQLSTATE, SQLERRM;
    END;

    RETURN NULL;  -- AFTER trigger: el valor de retorno se ignora.
END;
$$;

COMMENT ON FUNCTION public.adopt_reports_on_child_link() IS
    'Trigger AFTER UPDATE en children: al vincular acudiente, asigna '
    'recipient_id al informe publicado MÁS RECIENTE que quedó sin destinatario '
    '(D16) y notifica solo ese, con enlace a F4 (/children/:id/reports/:reportId). '
    'El resto del histórico ya es visible por RLS.';

-- El trigger en sí no cambia (mismo nombre, mismo WHEN) — CREATE OR REPLACE de
-- la función alcanza, no hace falta recrearlo.

COMMIT;

NOTIFY pgrst, 'reload schema';
