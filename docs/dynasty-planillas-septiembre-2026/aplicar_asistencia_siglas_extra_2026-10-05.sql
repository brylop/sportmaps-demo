-- Dynasty: asistencia sep-2026, lote extra: R tachada, "/" y VA (Milena 2026-10-05: tambien = asistio)
-- Generado 2026-10-05 desde docs/dynasty-planillas-septiembre-2026/cruce_asistencia.json + respuestas de Milena (2026-10-05).
-- Solo filas con atleta identificado (se excluye 1 "/" de "Guam Salome", sin match).
-- ORDEN DE EJECUCION: 0) aplicar_asistencia_hoja32_OPCIONAL_2026-10-05.sql (YA APLICADO 2026-10-05 12:23, no re-correr)
-- 1) aplicar_asistencia_siglas_2026-10-05.sql  2) aplicar_asistencia_siglas_extra_2026-10-05.sql
-- 3) aplicar_asistencia_siglas_2026-10-05_verificacion.sql (solo lectura).
-- Cualquier re-corrida es inocua: sesiones por NOT EXISTS equipo+fecha; registros por NOT EXISTS atleta+dia y sesion+atleta.
-- Idempotente: re-correrlo no duplica (NOT EXISTS por equipo+fecha en sesiones; por atleta+fecha y por sesion+atleta en registros).
-- No toca registros existentes (ni los 1.358 del 2026-10-03 ni los "absent" previos de la app).
-- Sesiones se insertan YA finalized=true: deduccion y aviso post-entrenamiento solo disparan en UPDATE false->true.

BEGIN;

-- 1) Sesiones (equipo, fecha) que necesitan los registros: 10 pares; solo se crean las que no existen.
--    Esperado: 0 nuevas si se corre DESPUES del principal (que crea INFANTIL FEMENINO 28-sep); 1 si se corre antes.
INSERT INTO public.attendance_sessions
  (school_id, team_id, session_date, title, finalized, finalized_at, finalized_by, created_by, coach_notes)
SELECT '2d509571-3238-4c04-ac3f-6dfe20539226'::uuid, v.team_id, v.session_date, 'Entrenamiento', true, now(),
       '73adf4ca-51f5-4f4a-a6ca-1973c84e8151'::uuid, '73adf4ca-51f5-4f4a-a6ca-1973c84e8151'::uuid,
       'Cargada desde planilla de papel sep-2026 (2026-10-05)'
FROM (VALUES
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06'),  -- INFANTIL FEMENINO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-13'),  -- INFANTIL FEMENINO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-20'),  -- INFANTIL FEMENINO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-27'),  -- INFANTIL FEMENINO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-28'),  -- INFANTIL FEMENINO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30'),  -- INFANTIL FEMENINO
  ('7d4219e3-f343-4e99-9527-fa7af7e8285e'::uuid, date '2026-09-19'),  -- INTERMEDIO
  ('7d4219e3-f343-4e99-9527-fa7af7e8285e'::uuid, date '2026-09-20'),  -- INTERMEDIO
  ('7d4219e3-f343-4e99-9527-fa7af7e8285e'::uuid, date '2026-09-22'),  -- INTERMEDIO
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-29')  -- MENORES FEMENINO
) AS v(team_id, session_date)
WHERE NOT EXISTS (
  SELECT 1 FROM public.attendance_sessions s
  WHERE s.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226' AND s.team_id = v.team_id AND s.session_date = v.session_date);

-- 2) Registros present: 36 filas (equipo, fecha, child_id, hoja, marca del papel).
INSERT INTO public.attendance_records
  (school_id, child_id, attendance_date, status, marked_by, notes, team_id, session_id, check_in_method)
SELECT '2d509571-3238-4c04-ac3f-6dfe20539226'::uuid, v.child_id, v.fecha, 'present', '73adf4ca-51f5-4f4a-a6ca-1973c84e8151'::uuid,
       'Planilla papel sep-2026 / siglas extra / hoja ' || v.hoja || ' marca ' || v.marca || ' (2026-10-05)',
       s.team_id, s.id, 'manual'
FROM (VALUES
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', '522110dc-30e0-45ba-aff1-77d017b1ac43'::uuid, 18, 'VA'),  -- INFANTIL FEMENINO | ISABELLA CALERO GONZALEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-13', '522110dc-30e0-45ba-aff1-77d017b1ac43'::uuid, 18, 'R(tachada)'),  -- INFANTIL FEMENINO | ISABELLA CALERO GONZALEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-13', '41abfc9f-cac1-4e7e-b8c7-5038be15fb80'::uuid, 18, 'R(tachada)'),  -- INFANTIL FEMENINO | LUCIA CACERES RODRIGUEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-13', '108857c1-c933-4336-8a03-3a0463409442'::uuid, 24, 'R(tachada)'),  -- INFANTIL FEMENINO | LUNA ISABELLA CUERVO BELTRAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-13', '24e208b6-2bfa-4216-98c6-046e8798921b'::uuid, 24, 'R(tachada)'),  -- INFANTIL FEMENINO | MARIA PAULA GOMEZ GAITAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-13', '7fef6ff1-9ae8-487e-bf69-6f661adefd19'::uuid, 18, 'R(tachada)'),  -- INFANTIL FEMENINO | MARIANA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-13', '816b64d9-cf4f-4a47-8242-9f39d31f009e'::uuid, 24, 'R(tachada)'),  -- INFANTIL FEMENINO | SAMANTHA GONZANLEZ MATEUS
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-13', '4c408a66-2563-4410-8f56-4782cb7fe904'::uuid, 24, 'R(tachada)'),  -- INFANTIL FEMENINO | SARA ISABELLA HERNANDEZ BAQUERO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-13', '932a7686-feb5-4b77-9432-05c7a90f0034'::uuid, 18, 'R(tachada)'),  -- INFANTIL FEMENINO | SARA SOFIA CADENA RICAURTE
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-13', 'e09ac6ea-c203-49e0-ba26-f482fd551ab9'::uuid, 18, 'R(tachada)'),  -- INFANTIL FEMENINO | SARA VICTORIA AGUILAR LEON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-13', 'e68fd3cd-4624-48b3-b85d-8adc64dc2a7f'::uuid, 18, 'R(tachada)'),  -- INFANTIL FEMENINO | SOFIA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-20', '4c408a66-2563-4410-8f56-4782cb7fe904'::uuid, 24, 'VA'),  -- INFANTIL FEMENINO | SARA ISABELLA HERNANDEZ BAQUERO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-20', '932a7686-feb5-4b77-9432-05c7a90f0034'::uuid, 18, 'VA'),  -- INFANTIL FEMENINO | SARA SOFIA CADENA RICAURTE
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-20', 'e09ac6ea-c203-49e0-ba26-f482fd551ab9'::uuid, 18, 'VA'),  -- INFANTIL FEMENINO | SARA VICTORIA AGUILAR LEON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-27', '522110dc-30e0-45ba-aff1-77d017b1ac43'::uuid, 18, 'R(tachada)'),  -- INFANTIL FEMENINO | ISABELLA CALERO GONZALEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-27', '4c408a66-2563-4410-8f56-4782cb7fe904'::uuid, 24, 'R(tachada)'),  -- INFANTIL FEMENINO | SARA ISABELLA HERNANDEZ BAQUERO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-28', '522110dc-30e0-45ba-aff1-77d017b1ac43'::uuid, 18, 'R(tachada)'),  -- INFANTIL FEMENINO | ISABELLA CALERO GONZALEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-28', '41abfc9f-cac1-4e7e-b8c7-5038be15fb80'::uuid, 18, 'R(tachada)'),  -- INFANTIL FEMENINO | LUCIA CACERES RODRIGUEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-28', '7fef6ff1-9ae8-487e-bf69-6f661adefd19'::uuid, 18, 'R(tachada)'),  -- INFANTIL FEMENINO | MARIANA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-28', 'e09ac6ea-c203-49e0-ba26-f482fd551ab9'::uuid, 18, 'R(tachada)'),  -- INFANTIL FEMENINO | SARA VICTORIA AGUILAR LEON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-28', 'e68fd3cd-4624-48b3-b85d-8adc64dc2a7f'::uuid, 18, 'R(tachada)'),  -- INFANTIL FEMENINO | SOFIA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', '9591dfa6-4777-411d-ac05-b54ee270a37a'::uuid, 24, 'R(tachada)'),  -- INFANTIL FEMENINO | INES MARIANA GOMEZ CARVAJAL
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', '108857c1-c933-4336-8a03-3a0463409442'::uuid, 24, 'R(tachada)'),  -- INFANTIL FEMENINO | LUNA ISABELLA CUERVO BELTRAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', '4dd5ac0a-3270-4d28-9900-cf35227e3473'::uuid, 24, 'R(tachada)'),  -- INFANTIL FEMENINO | MARIA PAULA ESCOBAR BENITEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', '24e208b6-2bfa-4216-98c6-046e8798921b'::uuid, 24, 'R(tachada)'),  -- INFANTIL FEMENINO | MARIA PAULA GOMEZ GAITAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', '4c408a66-2563-4410-8f56-4782cb7fe904'::uuid, 24, 'R(tachada)'),  -- INFANTIL FEMENINO | SARA ISABELLA HERNANDEZ BAQUERO
  ('7d4219e3-f343-4e99-9527-fa7af7e8285e'::uuid, date '2026-09-19', '2d3a367e-fb30-4305-bbd9-2ddece8764d0'::uuid, 10, '/'),  -- INTERMEDIO | SARAH LUCIANA SEQUEDA TORO
  ('7d4219e3-f343-4e99-9527-fa7af7e8285e'::uuid, date '2026-09-20', 'bf17b98c-7e44-48be-bc26-d629ff051348'::uuid, 10, '/'),  -- INTERMEDIO | Isabella Romero González
  ('7d4219e3-f343-4e99-9527-fa7af7e8285e'::uuid, date '2026-09-20', '31869b05-324e-4a79-b9f3-6e6b56f1d527'::uuid, 10, '/'),  -- INTERMEDIO | Kristen Salomé Rojas Pineda
  ('7d4219e3-f343-4e99-9527-fa7af7e8285e'::uuid, date '2026-09-20', '2d3a367e-fb30-4305-bbd9-2ddece8764d0'::uuid, 10, '/'),  -- INTERMEDIO | SARAH LUCIANA SEQUEDA TORO
  ('7d4219e3-f343-4e99-9527-fa7af7e8285e'::uuid, date '2026-09-22', '81ec4bb5-13ce-41a5-bf6c-c6f652ff3cab'::uuid, 29, '/ (tenue)'),  -- INTERMEDIO | SAMANTHA PEÑA SANCHEZ
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-29', 'f528d56a-70b2-445e-a666-39ffc63161d9'::uuid, 17, '/'),  -- MENORES FEMENINO | ANA SOFIA SIERRA GARCIA
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-29', '809f623f-12bf-4bc8-bd4e-6414e3f02ef5'::uuid, 17, '/'),  -- MENORES FEMENINO | LUCIANA NIEVES RAQUIRA
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-29', '60c60845-227f-4a78-bac5-bec6268069d1'::uuid, 22, '/'),  -- MENORES FEMENINO | MARIA JOSE ESPITIA SOTO
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-29', 'ca1a6549-15e7-4e7e-89df-182439bb45ee'::uuid, 17, '/'),  -- MENORES FEMENINO | MARIA VICTORIA TORRES POLO
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-29', '620b6f41-ef16-4fb4-b698-82235e5dec2e'::uuid, 17, '/')  -- MENORES FEMENINO | VALERIA RANGEL RUIZ
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
  ('INFANTIL FEMENINO', 26),
  ('INTERMEDIO', 5),
  ('MENORES FEMENINO', 5)
  , ('TOTAL', 36)
) AS x(grupo, registros_esperados)
LEFT JOIN (SELECT coalesce(t.name, 'TOTAL') AS name, count(*) n FROM public.attendance_records ar JOIN public.teams t ON t.id = ar.team_id
           WHERE ar.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226' AND ar.notes LIKE 'Planilla papel sep-2026 / siglas extra /%'
           GROUP BY ROLLUP (t.name)) r ON r.name = x.grupo
LEFT JOIN (SELECT coalesce(t.name, 'TOTAL') AS name, count(*) n FROM public.attendance_sessions s JOIN public.teams t ON t.id = s.team_id
           WHERE s.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226' AND s.coach_notes = 'Cargada desde planilla de papel sep-2026 (2026-10-05)'
           GROUP BY ROLLUP (t.name)) sn ON sn.name = x.grupo
ORDER BY (x.grupo = 'TOTAL'), x.grupo;

COMMIT;
