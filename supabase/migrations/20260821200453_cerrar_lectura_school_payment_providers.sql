-- Cierra la lectura de school_payment_providers al alcance correcto.
--
-- QUÉ ESTABA MAL
--
-- La policy de SELECT era:
--
--   USING (EXISTS (SELECT 1 FROM schools s
--                   WHERE s.id = school_payment_providers.school_id
--                     AND (s.owner_id = auth.uid()
--                          OR EXISTS (SELECT 1 FROM profiles p
--                                      WHERE p.id = auth.uid()
--                                        AND p.role::text = ANY (ARRAY['admin','school_admin','owner'])))))
--
-- Tres problemas:
--
--   1. La segunda rama NO está correlacionada con la escuela: quien la satisface
--      lee las filas de TODAS. Se creyó inofensiva porque en el enum user_role no
--      existen 'school_admin' ni 'owner' (el rol de escuela es 'school'), así que
--      solo matchea 'admin'. Pero una de las cuentas con role='admin' resultó ser
--      DUEÑA de una escuela, no staff de plataforma: una cuenta de cliente leyendo
--      la configuración de cobro de las demás.
--   2. Dos de los tres strings son letra muerta y no lo dice ningún comentario.
--   3. 'super_admin' NO estaba incluido, así que el super admin de verdad no leía,
--      mientras que 'admin' sí. Al revés de la intención.
--
-- QUÉ QUEDA
--
--   lectura = administración DE ESA escuela  OR  staff de plataforma
--
-- `user_admin_school_ids()` ya hace UNION con schools.owner_id, así que el dueño
-- sigue incluido sin ramas extra. Se envuelve en (SELECT …) para que el planner la
-- evalúe UNA vez por query y no una por fila.
--
-- OJO — POR QUÉ ESTA MIGRACIÓN NO SE PODÍA APLICAR ANTES
--
-- `is_super_admin()` → `is_platform_admin()` no mira profiles.role: mira la tabla
-- platform_admins y el claim JWT app_metadata.platform_admin. Esa tabla estaba
-- VACÍA y ningún usuario tenía el claim, así que el helper devolvía false para
-- todos. Aplicar esto en ese estado le habría QUITADO la lectura global a las
-- cuentas de plataforma en vez de ordenarla. Se registró la cuenta super_admin en
-- platform_admins (2026-08-21) y recién entonces esto es seguro.
--
-- Verificar antes de aplicar, porque si vuelve a estar vacía esto deja sin lectura
-- global a todo el mundo:
--
--   select count(*) from public.platform_admins where is_active;   -- debe ser >= 1
--
-- RADIO MEDIDO (2026-08-21, contra la base viva)
--
--   · La tabla tiene 1 fila (Escuela Demo SportMaps). Nada de producción depende
--     de esta lectura: la pantalla que la usa va por el BFF con service_role, que
--     no pasa por RLS.
--   · PIERDEN lectura global: la cuenta dueña de escuela con role='admin' (retiene
--     la de SU escuela) y una cuenta demo sin escuelas. Ninguna la necesita: el
--     formulario de pasarelas pasa por el BFF.
--   · GANAN lectura de su propia escuela: los 5 school_members activos con
--     role='admin' que no son el owner. Antes no veían su propia configuración.
--
-- La policy de ESCRITURA no se toca: ya está bien acotada (dueño de esa escuela o
-- role='admin' global) y tiene WITH CHECK, así que cumple el invariante I3. Quién
-- decide a qué cuenta cae el dinero sigue siendo territorio del dueño, no de un
-- admin delegado.

BEGIN;

DROP POLICY IF EXISTS school_payment_providers_owner_read
    ON public.school_payment_providers;

CREATE POLICY school_payment_providers_admin_read
    ON public.school_payment_providers
    FOR SELECT
    USING (
        school_id IN (SELECT unnest((SELECT public.user_admin_school_ids())))
        OR (SELECT public.is_super_admin())
    );

COMMIT;
