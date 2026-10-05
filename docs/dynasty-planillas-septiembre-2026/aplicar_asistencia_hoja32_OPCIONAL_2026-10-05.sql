-- OPCIONAL - Dynasty hoja 32 (Infantil Masculino pag. 2, filas 21-35): DIAS INFERIDOS
-- Generado 2026-10-05 desde docs/dynasty-planillas-septiembre-2026/cruce_asistencia.json + respuestas de Milena (2026-10-05).
-- La foto no muestra el encabezado de dias: c1..c16 se asumieron = los 16 dias de la hoja 13 (pag. 1 de la
-- misma planilla: 4,6,8,9,11,13,15,16,18,20,22,23,25,27,29,30). Indicio: c1, c2 y c5 vacias en ambas hojas.
-- NO confirmado por Milena. Correr solo si se acepta la inferencia, y DESPUES del archivo principal.
-- Idempotente: re-correrlo no duplica (NOT EXISTS por equipo+fecha en sesiones; por atleta+fecha y por sesion+atleta en registros).
-- No toca registros existentes (ni los 1.358 del 2026-10-03 ni los "absent" previos de la app).
-- Sesiones se insertan YA finalized=true: deduccion y aviso post-entrenamiento solo disparan en UPDATE false->true.

BEGIN;

-- 1) Sesiones (equipo, fecha) que necesitan los registros: 13 pares; solo se crean las que no existen.
--    Si el archivo principal ya se corrio: 0 nuevas (las 13 ya existen). Si no: 12 nuevas.
INSERT INTO public.attendance_sessions
  (school_id, team_id, session_date, title, finalized, finalized_at, finalized_by, created_by, coach_notes)
SELECT '2d509571-3238-4c04-ac3f-6dfe20539226'::uuid, v.team_id, v.session_date, 'Entrenamiento', true, now(),
       '73adf4ca-51f5-4f4a-a6ca-1973c84e8151'::uuid, '73adf4ca-51f5-4f4a-a6ca-1973c84e8151'::uuid,
       'Cargada desde planilla de papel sep-2026 (2026-10-05)'
FROM (VALUES
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-08'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-09'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-16'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-18'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-22'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-23'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-29'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-30'),  -- INFANTIL MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-20')  -- MENORES MASCULINO
) AS v(team_id, session_date)
WHERE NOT EXISTS (
  SELECT 1 FROM public.attendance_sessions s
  WHERE s.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226' AND s.team_id = v.team_id AND s.session_date = v.session_date);

-- 2) Registros present: 57 filas (equipo, fecha, child_id, hoja, marca del papel).
INSERT INTO public.attendance_records
  (school_id, child_id, attendance_date, status, marked_by, notes, team_id, session_id, check_in_method)
SELECT '2d509571-3238-4c04-ac3f-6dfe20539226'::uuid, v.child_id, v.fecha, 'present', '73adf4ca-51f5-4f4a-a6ca-1973c84e8151'::uuid,
       'Planilla papel sep-2026 / hoja32 dias inferidos / hoja ' || v.hoja || ' marca ' || v.marca || ' (2026-10-05)',
       s.team_id, s.id, 'manual'
FROM (VALUES
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-08', '9d17e0a3-cf38-439b-b15d-a96793a8aae4'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | DYLAN TORRES DIAZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-08', '9b6f6ae3-160e-4935-a9eb-c8038fb9ffdd'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | JACOBO SUAREZ ALARCON
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-08', '2cd5dbb3-eed2-4cfa-97ff-1d9075d322d1'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | JULIAN SANTIAGO PASTOR ALDANA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-09', '9d17e0a3-cf38-439b-b15d-a96793a8aae4'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | DYLAN TORRES DIAZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-09', '2cd5dbb3-eed2-4cfa-97ff-1d9075d322d1'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | JULIAN SANTIAGO PASTOR ALDANA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-09', 'fbaa91ae-f09c-48d4-b0e8-c127435bc549'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | SANTIAGO NIGRINIS GARCIA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', '9d17e0a3-cf38-439b-b15d-a96793a8aae4'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | DYLAN TORRES DIAZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', '9e85f9ba-5ebd-4719-b767-59ec5c15db17'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | IAN UBIN GOMEZ GONZALEZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', '06c63d32-61de-4aeb-ad9d-4a766257251b'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | JUAN DANIEL SILVA SOSA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', '2cd5dbb3-eed2-4cfa-97ff-1d9075d322d1'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | JULIAN SANTIAGO PASTOR ALDANA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', 'c301af62-7d35-4ec5-ba4e-ef4b1651fbce'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | SAMUEL PARDO LLANOS
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', 'fbaa91ae-f09c-48d4-b0e8-c127435bc549'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | SANTIAGO NIGRINIS GARCIA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', '64c2548f-d146-4816-98f2-86df228e98b8'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | SEBASTIAN PEREZ PEÑA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', '599284c9-0b90-40c1-83da-f555256b7f86'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | Samuel Puentes Barrera
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-16', '9d17e0a3-cf38-439b-b15d-a96793a8aae4'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | DYLAN TORRES DIAZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-16', '9e85f9ba-5ebd-4719-b767-59ec5c15db17'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | IAN UBIN GOMEZ GONZALEZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-16', '9b6f6ae3-160e-4935-a9eb-c8038fb9ffdd'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | JACOBO SUAREZ ALARCON
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-16', '2cd5dbb3-eed2-4cfa-97ff-1d9075d322d1'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | JULIAN SANTIAGO PASTOR ALDANA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-16', '64c2548f-d146-4816-98f2-86df228e98b8'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | SEBASTIAN PEREZ PEÑA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-18', 'be063a5e-fec2-4dd1-8df6-231a69740ef9'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | Juan Angel Gonzalez Daza
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', '9d17e0a3-cf38-439b-b15d-a96793a8aae4'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | DYLAN TORRES DIAZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', '9e85f9ba-5ebd-4719-b767-59ec5c15db17'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | IAN UBIN GOMEZ GONZALEZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', '9b6f6ae3-160e-4935-a9eb-c8038fb9ffdd'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | JACOBO SUAREZ ALARCON
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', 'be063a5e-fec2-4dd1-8df6-231a69740ef9'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | Juan Angel Gonzalez Daza
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', 'fbaa91ae-f09c-48d4-b0e8-c127435bc549'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | SANTIAGO NIGRINIS GARCIA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', '64c2548f-d146-4816-98f2-86df228e98b8'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | SEBASTIAN PEREZ PEÑA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', '599284c9-0b90-40c1-83da-f555256b7f86'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | Samuel Puentes Barrera
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-22', '9d17e0a3-cf38-439b-b15d-a96793a8aae4'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | DYLAN TORRES DIAZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-22', '2cd5dbb3-eed2-4cfa-97ff-1d9075d322d1'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | JULIAN SANTIAGO PASTOR ALDANA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-22', '64c2548f-d146-4816-98f2-86df228e98b8'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | SEBASTIAN PEREZ PEÑA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-23', '9d17e0a3-cf38-439b-b15d-a96793a8aae4'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | DYLAN TORRES DIAZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-23', '2cd5dbb3-eed2-4cfa-97ff-1d9075d322d1'::uuid, 32, 'x (con tachon)'),  -- INFANTIL MASCULINO | JULIAN SANTIAGO PASTOR ALDANA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-23', 'fbaa91ae-f09c-48d4-b0e8-c127435bc549'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | SANTIAGO NIGRINIS GARCIA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', '9d17e0a3-cf38-439b-b15d-a96793a8aae4'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | DYLAN TORRES DIAZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', '9e85f9ba-5ebd-4719-b767-59ec5c15db17'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | IAN UBIN GOMEZ GONZALEZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', '9b6f6ae3-160e-4935-a9eb-c8038fb9ffdd'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | JACOBO SUAREZ ALARCON
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', '06c63d32-61de-4aeb-ad9d-4a766257251b'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | JUAN DANIEL SILVA SOSA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', '2cd5dbb3-eed2-4cfa-97ff-1d9075d322d1'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | JULIAN SANTIAGO PASTOR ALDANA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', 'be063a5e-fec2-4dd1-8df6-231a69740ef9'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | Juan Angel Gonzalez Daza
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', 'c301af62-7d35-4ec5-ba4e-ef4b1651fbce'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | SAMUEL PARDO LLANOS
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', '64c2548f-d146-4816-98f2-86df228e98b8'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | SEBASTIAN PEREZ PEÑA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', '599284c9-0b90-40c1-83da-f555256b7f86'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | Samuel Puentes Barrera
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27', '9d17e0a3-cf38-439b-b15d-a96793a8aae4'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | DYLAN TORRES DIAZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27', '9e85f9ba-5ebd-4719-b767-59ec5c15db17'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | IAN UBIN GOMEZ GONZALEZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27', '9b6f6ae3-160e-4935-a9eb-c8038fb9ffdd'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | JACOBO SUAREZ ALARCON
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27', '2cd5dbb3-eed2-4cfa-97ff-1d9075d322d1'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | JULIAN SANTIAGO PASTOR ALDANA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27', 'be063a5e-fec2-4dd1-8df6-231a69740ef9'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | Juan Angel Gonzalez Daza
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27', 'c301af62-7d35-4ec5-ba4e-ef4b1651fbce'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | SAMUEL PARDO LLANOS
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-29', '9d17e0a3-cf38-439b-b15d-a96793a8aae4'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | DYLAN TORRES DIAZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-29', '9b6f6ae3-160e-4935-a9eb-c8038fb9ffdd'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | JACOBO SUAREZ ALARCON
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-29', '2cd5dbb3-eed2-4cfa-97ff-1d9075d322d1'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | JULIAN SANTIAGO PASTOR ALDANA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-29', 'fbaa91ae-f09c-48d4-b0e8-c127435bc549'::uuid, 32, 'x (tenue)'),  -- INFANTIL MASCULINO | SANTIAGO NIGRINIS GARCIA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-29', '64c2548f-d146-4816-98f2-86df228e98b8'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | SEBASTIAN PEREZ PEÑA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-29', '599284c9-0b90-40c1-83da-f555256b7f86'::uuid, 32, 'X'),  -- INFANTIL MASCULINO | Samuel Puentes Barrera
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-30', '9d17e0a3-cf38-439b-b15d-a96793a8aae4'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | DYLAN TORRES DIAZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-30', 'fbaa91ae-f09c-48d4-b0e8-c127435bc549'::uuid, 32, 'x'),  -- INFANTIL MASCULINO | SANTIAGO NIGRINIS GARCIA
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-20', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 32, 'X')  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
) AS v(team_id, fecha, child_id, hoja, marca)
CROSS JOIN LATERAL (
  SELECT s.id, s.team_id FROM public.attendance_sessions s
  WHERE s.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226' AND s.team_id = v.team_id AND s.session_date = v.fecha
  ORDER BY s.created_at, s.id LIMIT 1) s
WHERE NOT EXISTS (  -- el atleta ya tiene asistencia ese dia (cualquier sesion/estado): no pisar ni duplicar
  SELECT 1 FROM public.attendance_records r
  WHERE r.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226' AND r.child_id = v.child_id AND r.attendance_date = v.fecha)
AND NOT EXISTS (  -- y por (sesion, atleta), el UNIQUE de la tabla
  SELECT 1 FROM public.attendance_records r WHERE r.session_id = s.id AND r.child_id = v.child_id);

-- 3) Conteos. registros_lote debe ser = registros_esperados (en la 1a corrida y en cualquier re-corrida).
--    sesiones_10_05 = sesiones creadas con la nota de hoy (por todos los lotes del 10-05).
SELECT x.grupo, x.registros_esperados, coalesce(r.n, 0) AS registros_lote, coalesce(sn.n, 0) AS sesiones_10_05
FROM (VALUES
  ('INFANTIL MASCULINO', 56),
  ('MENORES MASCULINO', 1)
  , ('TOTAL', 57)
) AS x(grupo, registros_esperados)
LEFT JOIN (SELECT coalesce(t.name, 'TOTAL') AS name, count(*) n FROM public.attendance_records ar JOIN public.teams t ON t.id = ar.team_id
           WHERE ar.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226' AND ar.notes LIKE 'Planilla papel sep-2026 / hoja32 dias inferidos /%'
           GROUP BY ROLLUP (t.name)) r ON r.name = x.grupo
LEFT JOIN (SELECT coalesce(t.name, 'TOTAL') AS name, count(*) n FROM public.attendance_sessions s JOIN public.teams t ON t.id = s.team_id
           WHERE s.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226' AND s.coach_notes = 'Cargada desde planilla de papel sep-2026 (2026-10-05)'
           GROUP BY ROLLUP (t.name)) sn ON sn.name = x.grupo
ORDER BY (x.grupo = 'TOTAL'), x.grupo;

COMMIT;
