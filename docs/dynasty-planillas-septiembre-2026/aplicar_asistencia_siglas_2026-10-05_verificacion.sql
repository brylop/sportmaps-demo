-- Verificacion (SOLO LECTURA) de los tres lotes de asistencia del 2026-10-05 (Dynasty, sep-2026):
--   lote 'hoja32 dias inferidos' -> aplicar_asistencia_hoja32_OPCIONAL_2026-10-05.sql  (YA APLICADO 12:23)
--   lote 'siglas'                -> aplicar_asistencia_siglas_2026-10-05.sql
--   lote 'siglas extra'          -> aplicar_asistencia_siglas_extra_2026-10-05.sql
-- ORDEN: hoja32 (ya hecho) -> siglas -> siglas extra -> este archivo.
-- Cada bloque dice lo esperado con los TRES lotes aplicados.

-- V1. Sesiones creadas el 10-05: todas finalized=true con finalized_at.
--     Esperado: 14 = INFANTIL MASCULINO 13 (12 de hoja32 + 15-sep del principal) + INFANTIL FEMENINO 1 (28-sep).
--     (Hoy, con solo hoja32: 12 de INFANTIL MASCULINO.)
SELECT t.name AS grupo, count(*) AS sesiones,
       count(*) FILTER (WHERE s.finalized IS TRUE AND s.finalized_at IS NOT NULL) AS finalizadas_ok,
       min(s.session_date) AS desde, max(s.session_date) AS hasta
FROM public.attendance_sessions s JOIN public.teams t ON t.id = s.team_id
WHERE s.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
  AND s.coach_notes = 'Cargada desde planilla de papel sep-2026 (2026-10-05)'
GROUP BY ROLLUP (t.name) ORDER BY t.name NULLS LAST;

-- V2. Registros por lote y grupo, contra lo esperado. Columna "ok" debe ser true en todas las filas.
SELECT e.lote, e.grupo, e.esperado, coalesce(r.n, 0) AS en_base, coalesce(r.n, 0) = e.esperado AS ok
FROM (VALUES
  ('hoja32 dias inferidos', 'INFANTIL MASCULINO', 56),
  ('hoja32 dias inferidos', 'MENORES MASCULINO', 1),
  ('siglas', 'INFANTIL FEMENINO', 189),
  ('siglas', 'INFANTIL MASCULINO', 94),
  ('siglas', 'INTERMEDIO', 1),
  ('siglas', 'JUVENIL MAYORES MASCULINO', 1),
  ('siglas', 'MENORES FEMENINO', 15),
  ('siglas', 'MENORES MASCULINO', 16),
  ('siglas', 'NUEVA ERA', 3),
  ('siglas extra', 'INFANTIL FEMENINO', 26),
  ('siglas extra', 'INTERMEDIO', 5),
  ('siglas extra', 'MENORES FEMENINO', 5)
) AS e(lote, grupo, esperado)
LEFT JOIN (
  SELECT split_part(ar.notes, ' / ', 2) AS lote, t.name AS grupo, count(*) AS n
  FROM public.attendance_records ar JOIN public.teams t ON t.id = ar.team_id
  WHERE ar.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
    AND ar.notes LIKE 'Planilla papel sep-2026 / %(2026-10-05)' AND ar.status = 'present'
  GROUP BY 1, 2) r ON r.lote = e.lote AND r.grupo = e.grupo
ORDER BY 1, 2;
-- Totales esperados: hoja32 57 + siglas 319 + siglas extra 36 = 412.
SELECT split_part(notes, ' / ', 2) AS lote, count(*)
FROM public.attendance_records
WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226' AND notes LIKE 'Planilla papel sep-2026 / %(2026-10-05)'
GROUP BY ROLLUP (1) ORDER BY 1 NULLS LAST;

-- V3. Por marca del papel.
--     siglas: X 114, ✓R 89, VR 74, R 21, ✓ 15 (Quintero, hoja 25), y 1 c/u de X/✓, R✓, X(sobre ✓), checkR10, U, x (azul).
--     siglas extra: R(tachada) 22, / 9, VA 4, / (tenue) 1.
--     hoja32: x 34, X 21, x (tenue) 1, x (con tachon) 1.
SELECT split_part(r.notes, ' / ', 2) AS lote,
       substring(r.notes FROM ' marca (.*) \(2026-10-05\)$') AS marca, count(*)
FROM public.attendance_records r
WHERE r.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
  AND r.notes LIKE 'Planilla papel sep-2026 / %(2026-10-05)'
GROUP BY 1, 2 ORDER BY 1, 3 DESC;

-- V4. Integridad: registro coherente con su sesion (mismo equipo y fecha). Esperado: 0 filas.
SELECT r.id, r.attendance_date, s.session_date, r.team_id, s.team_id
FROM public.attendance_records r JOIN public.attendance_sessions s ON s.id = r.session_id
WHERE r.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
  AND r.notes LIKE 'Planilla papel sep-2026%'
  AND (r.attendance_date <> s.session_date OR r.team_id IS DISTINCT FROM s.team_id);

-- V5. Duplicados: un atleta con mas de un registro el mismo dia en septiembre. Esperado: 0 filas.
SELECT coalesce(child_id, user_id, unregistered_athlete_id) AS atleta, attendance_date, count(*)
FROM public.attendance_records
WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
  AND attendance_date BETWEEN '2026-09-01' AND '2026-09-30'
GROUP BY 1, 2 HAVING count(*) > 1;

-- V6. Sin sesiones duplicadas por equipo+dia en septiembre. Esperado: 0 filas.
SELECT team_id, session_date, count(*)
FROM public.attendance_sessions
WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
  AND session_date BETWEEN '2026-09-01' AND '2026-09-30'
GROUP BY 1, 2 HAVING count(*) > 1;

-- V7. La carga del 2026-10-03 sigue intacta. Esperado: 102 sesiones y 1358 registros.
SELECT (SELECT count(*) FROM public.attendance_sessions
        WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
          AND coach_notes = 'Cargada desde planilla de papel sep-2026 (2026-10-03)') AS sesiones_10_03,
       (SELECT count(*) FROM public.attendance_records
        WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
          AND notes = 'Planilla papel sep-2026') AS registros_10_03;

-- V8. Sin efectos colaterales: ninguna reserva en las sesiones de papel. Esperado: 0.
SELECT count(*) AS bookings_en_sesiones_papel
FROM public.session_bookings b JOIN public.attendance_sessions s ON s.id = b.session_id
WHERE s.coach_notes LIKE 'Cargada desde planilla de papel sep-2026%';

-- V9. Foto final de septiembre por grupo (todas las fuentes).
SELECT t.name AS grupo, count(DISTINCT s.id) AS sesiones,
       count(r.id) FILTER (WHERE r.status = 'present') AS presentes,
       count(r.id) FILTER (WHERE r.status <> 'present') AS otros_estados
FROM public.attendance_sessions s
JOIN public.teams t ON t.id = s.team_id
LEFT JOIN public.attendance_records r ON r.session_id = s.id
WHERE s.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
  AND s.session_date BETWEEN '2026-09-01' AND '2026-09-30'
GROUP BY t.name ORDER BY t.name;
