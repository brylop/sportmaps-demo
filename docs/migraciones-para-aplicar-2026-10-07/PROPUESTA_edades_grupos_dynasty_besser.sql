-- =============================================================================
-- PROPUESTA (NO APLICADA) — Edades, género y nivel de cada grupo
-- DYNASTY VOLLEY CLUB (2d509571-3238-4c04-ac3f-6dfe20539226, voleibol)
-- CLUB DEPORTIVO BESSER (759eee9d-05cb-4958-b84a-2560f77e3683, FÚTBOL — no voleibol)
--
-- Para que la escuela (Milena / Besser) CONFIRME o corrija antes de correrlo.
-- Toca datos de clientes: lo corre el usuario, no un agente.
--
-- QUÉ HACE
--   1. Crea UNA categoría por grupo en `school_categories` (la tabla correcta:
--      `teams` no tiene columna de género; `school_categories` tiene `rama`,
--      años de nacimiento, `level` y `metadata`).
--   2. Vincula cada equipo con `teams.category_id`.
--   NO toca `teams.age_min/age_max` (bloque opcional al final): con años de
--   nacimiento la edad se recalcula sola cada año; un age_min fijo envejece
--   mal en enero.
--
-- CÓMO SE ARMÓ CADA FILA (medido el 2026-10-07, solo SELECT):
--   (a) categorías oficiales por año de nacimiento si el nombre lo indica
--       (Minivoleibol, Infantil, Menores, Juvenil, Mayores, Seniors; Besser
--       usa el año en el nombre: «2011», «2012», «2014»);
--   (b) la DISTRIBUCIÓN REAL de años de nacimiento de los atletas ACTIVOS del
--       grupo (enrollments activos → children / unregistered_athletes /
--       profiles; se descartan fechas de 2023 en adelante = error de carga);
--   (c) el nombre del grupo.
--   El género: el nombre si lo dice; si no, los atletas con género cargado
--   (en Dynasty ~55 % NO tiene género cargado: por eso la confianza).
--
-- Mientras esto NO se aplique, el bot ya usa (b) en vivo
-- (bff/src/services/grupos-por-edad.service.ts, percentiles 5–95, caché 1 h).
-- Aplicado, manda lo de aquí (categoría) sobre lo inferido.
--
-- Distribución por grupo (años de nacimiento: cantidad de atletas activos)
--   DYNASTY
--   MINIVOLLEY BENJAMINES   2011:1 2012:2 2013:11 2014:20 2015:24 2016:14 2017:5 2018:5 2019:1 2020:1 · 37F/4M/49 sin género
--   INFANTIL FEMENINO       2010:3 2011:35 2012:26 2013:10 2014:4                                     · 32F/0M/46 s/g
--   INFANTIL MASCULINO      2010:1 2011:9 2012:10 2013:8 2014:3 2015:1 2016:2                         · 10M/4F/20 s/g
--   INTERMEDIO              2007:1 2008:2 2009:3 2010:4 2011:14 2012:34 2013:26 2014:13 2015:5 2016:1 · 51F/1M/52 s/g
--   NUEVA ERA               2010:1 2012:6 2013:20 2014:11 2015:1 (+1 fecha 2026 = error)             · 17F/0M/23 s/g
--   MENORES FEMENINO        2007:2 2009:13 2010:24 2011:2 (+1 fecha 2026 = error)                     · 14F/0M/28 s/g
--   MENORES MASCULINO       2008:4 2009:13 2010:10 2011:3 2012:1                                      · 8M/2F/21 s/g
--   JUVENIL MAYORES FEM.    2005:1 2006:2 2007:3 2008:3   (no admite nuevos)                          · 4F
--   JUVENIL MAYORES MASC.   1992:1 2005:1 2006:2 2007:9 2008:6 2009:2                                 · 5M
--   SENIORS                 1961–2002 (mediana 34 años) + 1 de 2008 + 1 de 2017 (revisar)            · 2F/3M/33 s/g
--   BESSER (n chico, ~1/3 sin fecha)
--   2011 - ARRAYANES        2010:4 2011:2                    · 5M
--   2012 - LIGA             2012:6 2013:1 (+1 fecha 2026)    · 6M
--   2014 - LIGA             2013:1 2014:5 2015:1 2017:1      · 5M
--   INFANTIL FEMENINO       2012:4 2013:1 2014:4 2015:1 2016:1 2017:1 · 9F
--   INICIACIÓN FEMENINO     2013:1 2014:4 2015:1 2016:2 2017:1 2018:1 · 8F
--   INICIACIÓN MASCULINO    2015:1 2016:3 2017:2             · 3M
--   PRE JUVENIL FEMENINO    2010:2 2011:6                    · 5F
--   JUVENIL FEMENINO        sin fechas (2 atletas)
-- =============================================================================

BEGIN;

WITH propuesta (team_id, school_id, sport, code, nombre, rama, age_rule, age_min, age_max,
                birth_year_min, birth_year_max, level, sort_order, confianza, fuente, nota) AS (
  VALUES
  -- ─── DYNASTY VOLLEY CLUB (voleibol) ───────────────────────────────────────
  -- Minivoleibol: oficial hasta ~12-13 años; real 2013–2018 (8–13). Casi todas niñas, pero el nombre no lo dice → Mixto.
  ('864c9ee7-0e01-4901-8f16-816961688919'::uuid, '2d509571-3238-4c04-ac3f-6dfe20539226'::uuid, 'voleibol', 'MINI', 'Minivoleibol Benjamines', 'Mixto', 'birth_year', NULL::int, NULL::int, 2013, 2019, 'iniciacion', 10, 'media', 'oficial+atletas', 'Real 2013–2018 (8–13 años). ¿Reciben desde 6-7 años?'),
  -- Infantil femenino: oficial sub-15; real 2011–2013 (35/26/10) + 4 de 2014.
  ('1d2b58fe-8103-495b-aee5-6bca231901f9', '2d509571-3238-4c04-ac3f-6dfe20539226', 'voleibol', 'INF', 'Infantil Femenino', 'Femenino', 'birth_year', NULL, NULL, 2011, 2014, 'seleccion', 20, 'alta', 'nombre+oficial+atletas', 'Real 2011–2014 (12–15 años).'),
  -- Infantil masculino: real 2011–2013 + algunos 2014–2016. 4 atletas con género F cargado (revisar).
  ('81263e50-49e4-4826-a8ac-6818aef0e891', '2d509571-3238-4c04-ac3f-6dfe20539226', 'voleibol', 'INF', 'Infantil Masculino', 'Masculino', 'birth_year', NULL, NULL, 2011, 2014, 'seleccion', 21, 'media', 'nombre+oficial+atletas', 'Real 2011–2016; 3 de 2015-2016 fuera del rango.'),
  -- Intermedio: grupo por NIVEL (subgrupos Origen / Evolución), no por año. 51 de 52 con género cargado son F.
  ('7d4219e3-f343-4e99-9527-fa7af7e8285e', '2d509571-3238-4c04-ac3f-6dfe20539226', 'voleibol', 'INTER', 'Intermedio (Origen / Evolución)', 'Femenino', 'age_at_date', 11, 16, NULL, NULL, 'intermedio', 30, 'media', 'atletas', '¿Es solo femenino? ¿Qué separa Origen de Evolución (nivel o edad)?'),
  -- Nueva Era: el nombre no dice nada; real 2012–2014 (10–14), 17 de 17 con género son F.
  ('260a28d8-a84d-4eed-9deb-005098d469e3', '2d509571-3238-4c04-ac3f-6dfe20539226', 'voleibol', 'NE', 'Nueva Era', 'Femenino', 'birth_year', NULL, NULL, 2012, 2014, 'iniciacion', 31, 'baja', 'atletas', 'Nivel por confirmar (¿iniciación o proyección?). ¿Solo femenino?'),
  -- Menores femenino: oficial sub-17; real 2009–2010 (13/24) + 2 de 2011. Subgrupos White y Selección.
  ('751d243e-d2f3-477a-afd9-0532f4011e76', '2d509571-3238-4c04-ac3f-6dfe20539226', 'voleibol', 'MEN', 'Menores Femenino', 'Femenino', 'birth_year', NULL, NULL, 2009, 2011, 'seleccion', 40, 'alta', 'nombre+oficial+atletas', 'Real 2009–2011 (15–17 años). Subgrupos White / Selección.'),
  -- Menores masculino: real 2009–2010 + 4 de 2008 y 3 de 2011.
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6', '2d509571-3238-4c04-ac3f-6dfe20539226', 'voleibol', 'MEN', 'Menores Masculino', 'Masculino', 'birth_year', NULL, NULL, 2008, 2011, 'seleccion', 41, 'media', 'nombre+oficial+atletas', 'Real 2008–2011 (15–18 años).'),
  -- Juvenil + Mayores femenino: sin tope (Mayores). No admite nuevos (no se cambia).
  ('85b4f1ea-b162-4063-a254-c2b7206bad7a', '2d509571-3238-4c04-ac3f-6dfe20539226', 'voleibol', 'JUVMAY', 'Juvenil y Mayores Femenino', 'Femenino', 'birth_year', NULL, NULL, NULL, 2009, 'seleccion', 50, 'media', 'nombre+oficial+atletas', 'Real 2005–2008 (17–21). Nacidas en 2009 o antes.'),
  -- Juvenil + Mayores masculino: real 2005–2009 (+1 de 1992).
  ('8b6cb8c9-92da-4550-9546-50252a3592e1', '2d509571-3238-4c04-ac3f-6dfe20539226', 'voleibol', 'JUVMAY', 'Juvenil y Mayores Masculino', 'Masculino', 'birth_year', NULL, NULL, NULL, 2009, 'seleccion', 51, 'media', 'nombre+oficial+atletas', 'Real 2005–2009 (17–21). Nacidos en 2009 o antes.'),
  -- Seniors: adultos, mixto. Hay 1 atleta de 2008 y 1 de 2017 inscritos aquí (revisar, posible error de carga).
  ('fa438446-4092-404b-8858-0939026a34d3', '2d509571-3238-4c04-ac3f-6dfe20539226', 'voleibol', 'SEN', 'Seniors', 'Mixto', 'age_at_date', 18, NULL, NULL, NULL, 'adultos', 60, 'alta', 'nombre+atletas', 'Real 24–65 años (mediana 34). ¿Edad mínima 18 o 21?'),

  -- ─── CLUB DEPORTIVO BESSER (fútbol) ───────────────────────────────────────
  -- El año del nombre manda; los atletas confirman (n chico).
  ('6c6e656e-7e8e-4a77-a982-89783c7691cc', '759eee9d-05cb-4958-b84a-2560f77e3683', 'futbol', '2011', '2011 - Arrayanes', 'Masculino', 'birth_year', NULL, NULL, 2010, 2011, 'seleccion', 10, 'media', 'nombre+atletas', 'Nombre dice 2011, 4 de 6 con fecha son de 2010. teams.level=Sub-17. ¿Solo masculino?'),
  ('7d9ab3fc-1708-425e-89af-135f6b6e9f1c', '759eee9d-05cb-4958-b84a-2560f77e3683', 'futbol', '2012', '2012 - Liga', 'Masculino', 'birth_year', NULL, NULL, 2012, 2013, 'seleccion', 20, 'media', 'nombre+atletas', 'Real 2012 (6) y 2013 (1). teams.level=Sub-15. ¿Solo masculino?'),
  ('ff0b006e-3856-4042-8496-fff60655c663', '759eee9d-05cb-4958-b84a-2560f77e3683', 'futbol', '2014', '2014 - Liga', 'Masculino', 'birth_year', NULL, NULL, 2013, 2015, 'seleccion', 30, 'media', 'nombre+atletas', 'Real 2014 (5) + 2013, 2015, 2017. ¿Solo masculino?'),
  ('01241f21-0c1a-419a-ab3e-1aab38083fe5', '759eee9d-05cb-4958-b84a-2560f77e3683', 'futbol', 'PREJUV', 'Pre Juvenil Femenino', 'Femenino', 'birth_year', NULL, NULL, 2010, 2011, 'seleccion', 40, 'media', 'nombre+atletas', 'Real 2010 (2), 2011 (6).'),
  ('53162b60-1b3d-4eec-9af8-5e63a88d65cb', '759eee9d-05cb-4958-b84a-2560f77e3683', 'futbol', 'JUV', 'Juvenil Femenino', 'Femenino', 'birth_year', NULL, NULL, 2007, 2009, 'seleccion', 50, 'baja', 'nombre', 'Sin fechas de nacimiento (2 atletas). Solo por el nombre, encima de Pre Juvenil: CONFIRMAR.'),
  ('1375b77e-15f9-4283-ade2-087a74e88afc', '759eee9d-05cb-4958-b84a-2560f77e3683', 'futbol', 'INF', 'Infantil Femenino', 'Femenino', 'birth_year', NULL, NULL, 2012, 2015, 'seleccion', 60, 'media', 'nombre+atletas', 'Real 2012–2017; se solapa con Iniciación Femenino. ¿La diferencia es nivel?'),
  ('8af4e1e3-464e-4cc7-a918-903e3c1ce629', '759eee9d-05cb-4958-b84a-2560f77e3683', 'futbol', 'INI', 'Iniciación Femenino', 'Femenino', 'birth_year', NULL, NULL, 2013, 2018, 'iniciacion', 70, 'baja', 'nombre+atletas', 'Real 2013–2018 (n=10). Iniciación = nivel, no edad.'),
  ('94e41bca-2e6a-4b07-9144-5d5938950e0e', '759eee9d-05cb-4958-b84a-2560f77e3683', 'futbol', 'INI', 'Iniciación Masculino', 'Masculino', 'birth_year', NULL, NULL, 2015, 2018, 'iniciacion', 71, 'baja', 'nombre+atletas', 'Real 2015–2017 (n=6). ¿Desde qué edad reciben?')
),
nuevas AS (
  INSERT INTO public.school_categories
    (school_id, sport, code, name, rama, axis, age_rule, age_min, age_max,
     birth_year_min, birth_year_max, level, sort_order, metadata)
  SELECT school_id, sport, code, nombre, rama, 'age', age_rule, age_min, age_max,
         birth_year_min, birth_year_max, level, sort_order,
         jsonb_build_object('team_id', team_id, 'confianza', confianza, 'fuente', fuente,
                            'nota', nota, 'propuesta', '2026-10-07')
  FROM propuesta
  ON CONFLICT (school_id, lower(sport), upper(code), rama) WHERE is_active DO NOTHING
  RETURNING id, school_id, metadata->>'team_id' AS team_id
)
UPDATE public.teams t
   SET category_id = n.id, updated_at = now()
  FROM nuevas n
 WHERE t.id = n.team_id::uuid
   AND t.school_id = n.school_id
   AND t.category_id IS NULL;      -- no pisa un vínculo que la escuela ya haya hecho

-- ─── Verificación (debe dar 10 filas Dynasty + 8 Besser, todas con categoría) ──
SELECT s.name AS escuela, t.name AS grupo, c.rama, c.level,
       coalesce(c.age_min::text, (extract(year from now())::int - c.birth_year_max - 1)::text) AS edad_desde,
       coalesce(c.age_max::text, (extract(year from now())::int - c.birth_year_min)::text, 'sin tope') AS edad_hasta,
       c.birth_year_min, c.birth_year_max, c.metadata->>'confianza' AS confianza, c.metadata->>'nota' AS nota
  FROM public.teams t
  JOIN public.schools s ON s.id = t.school_id
  LEFT JOIN public.school_categories c ON c.id = t.category_id
 WHERE t.school_id IN ('2d509571-3238-4c04-ac3f-6dfe20539226', '759eee9d-05cb-4958-b84a-2560f77e3683')
   AND t.status <> 'inactive'
 ORDER BY s.name, c.sort_order NULLS LAST, t.name;

-- Si la verificación se ve bien: COMMIT;  si no: ROLLBACK;
-- (El bot cachea 1 h por escuela: el cambio se nota a más tardar en una hora
--  o al reiniciar el BFF.)

-- ─── OPCIONAL: copiar también a teams.age_min/age_max (edad de HOY) ─────────
-- Solo si alguna pantalla necesita teams.age_min. OJO: no se actualiza solo
-- en enero; la categoría por año sí. El bot prioriza teams.age_min si existe.
-- UPDATE public.teams t
--    SET age_min = coalesce(c.age_min, extract(year from now())::int - c.birth_year_max - 1),
--        age_max = coalesce(c.age_max, extract(year from now())::int - c.birth_year_min)
--   FROM public.school_categories c
--  WHERE c.id = t.category_id
--    AND t.school_id IN ('2d509571-3238-4c04-ac3f-6dfe20539226', '759eee9d-05cb-4958-b84a-2560f77e3683');
