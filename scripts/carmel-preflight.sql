-- ════════════════════════════════════════════════════════════════════
-- PRE-VUELO CARMEL — no modifica nada. Todo debe decir LISTO.
-- ════════════════════════════════════════════════════════════════════
SELECT paso, estado FROM (
  SELECT 1 AS n, 'RPC cambiar tipo de escuela' AS paso,
         CASE WHEN to_regprocedure('public.admin_set_school_type(uuid,text)') IS NOT NULL
              THEN 'LISTO' ELSE 'FALTA — aplicar 20260816193602' END AS estado
  UNION ALL SELECT 2, 'RPC apagar cobros',
         CASE WHEN to_regprocedure('public.admin_set_billing_enabled(uuid,boolean)') IS NOT NULL
              THEN 'LISTO' ELSE 'FALTA' END
  UNION ALL SELECT 3, 'Tabla de membresias',
         CASE WHEN to_regclass('public.memberships') IS NOT NULL
              THEN 'LISTO' ELSE 'FALTA — aplicar 20260817142331' END
  UNION ALL SELECT 4, 'RPC listado de membresias',
         CASE WHEN to_regprocedure('public.school_memberships_listado(uuid)') IS NOT NULL
              THEN 'LISTO' ELSE 'FALTA' END
  UNION ALL SELECT 5, 'RPC registrar membresia',
         CASE WHEN to_regprocedure('public.school_set_membership(uuid,text,uuid,uuid,uuid,date,date,text,text,text)') IS NOT NULL
              THEN 'LISTO' ELSE 'FALTA' END
  UNION ALL SELECT 6, 'Las 7 disciplinas con categorias oficiales',
         CASE WHEN (SELECT count(*) FROM public.sports_categories
                     WHERE slug IN ('golf','tenis','futbol','voleibol','baloncesto','padel','natacion')
                       AND public.is_category_group('categorias_edad')) = 7
              THEN 'LISTO' ELSE 'REVISAR el catalogo' END
  UNION ALL SELECT 7, 'Filtro de grupos que son categorias',
         CASE WHEN to_regprocedure('public.is_category_group(text)') IS NOT NULL
              THEN 'LISTO' ELSE 'FALTA — aplicar 20260817112153' END
) t ORDER BY n;

-- Estado de Club Campestre Demo, por si ensayas ahi primero
SELECT s.name, s.school_type, s.account_type,
       e.has_academy, e.has_reservations, e.has_billing,
       (SELECT count(*) FROM public.sport_configs c WHERE c.school_id = s.id) AS deportes
  FROM public.schools s
  JOIN public.v_school_entitlements e ON e.school_id = s.id
 WHERE s.name ILIKE '%campestre%';
