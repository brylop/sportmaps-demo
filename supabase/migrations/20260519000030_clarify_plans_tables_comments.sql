-- ============================================================
-- SPORTMAPS — Comentarios para evitar confundir las 2 tablas de "planes"
--
-- Existen DOS tablas que suenan parecido pero son cosas distintas:
--
--   1. school_subscriptions  → SaaS de SportMaps. Lo que la escuela
--                              le paga A SportMaps por usar la plataforma.
--                              starter | crecimiento | profesional | elite |
--                              enterprise. UNA fila por escuela.
--
--   2. subscription_plans    → Catalogo que la escuela/vendor vende A SUS
--                              FAMILIAS/ATLETAS. Mensualidad gym, paquete
--                              10 clases, pase de temporada. N filas por
--                              vendor_profile.
--
-- Este comentario queda fijo en la BD para que cualquiera viendo el
-- schema vea de inmediato que son cosas diferentes y no las mezcle.
-- ============================================================

BEGIN;


COMMENT ON TABLE public.school_subscriptions IS
    'SaaS DE SPORTMAPS. Plan que la escuela paga a SportMaps para usar la plataforma. '
    'Tiers: starter / crecimiento / profesional / elite / enterprise. UNA fila por escuela. '
    'NO confundir con subscription_plans (que es el catalogo que la escuela ofrece a sus '
    'atletas, mensualidades, paquetes, etc).';


COMMENT ON TABLE public.subscription_plans IS
    'CATALOGO QUE LA ESCUELA/VENDOR VENDE A FAMILIAS. Mensualidad gym, paquete 10 clases, '
    'pase de temporada, etc. N filas por vendor_profile. plan_type controla el tipo: '
    'school_monthly | service_package | event_season_pass. '
    'NO confundir con school_subscriptions (que es lo que la escuela paga A SportMaps por '
    'usar la plataforma).';


COMMENT ON COLUMN public.subscription_plans.plan_type IS
    'school_monthly: mensualidad o paquete que vende una escuela. '
    'service_package: paquete de sesiones de un servicio (fisio, nutricion, etc). '
    'event_season_pass: pase de temporada para un evento. '
    'NUNCA contiene los tiers SaaS de SportMaps (starter/crecimiento/etc) — eso esta en school_subscriptions.';


COMMIT;
