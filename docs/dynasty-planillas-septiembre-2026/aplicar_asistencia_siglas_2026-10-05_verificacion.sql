-- Verificacion (SOLO LECTURA) de aplicar_asistencia_siglas_2026-10-05.sql
-- (y del opcional aplicar_asistencia_hoja32_OPCIONAL_2026-10-05.sql si se corrio).
-- Correr despues del COMMIT. Cada bloque dice lo esperado.

-- V1. Sesiones creadas hoy: todas finalized=true con finalized_at.
--     Esperado: 14 (13 INFANTIL MASCULINO + 1 INFANTIL FEMENINO) si solo se corrio el principal.
--     El opcional de la hoja 32 no agrega sesiones si se corre despues del principal (sus 13 pares ya existen).
SELECT t.name AS grupo, count(*) AS sesiones,
       count(*) FILTER (WHERE s.finalized IS TRUE AND s.finalized_at IS NOT NULL) AS finalizadas_ok,
       min(s.session_date) AS desde, max(s.session_date) AS hasta
FROM public.attendance_sessions s JOIN public.teams t ON t.id = s.team_id
WHERE s.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
  AND s.coach_notes = 'Cargada desde planilla de papel sep-2026 (2026-10-05)'
GROUP BY ROLLUP (t.name) ORDER BY t.name NULLS LAST;

-- V2. Registros nuevos por lote y grupo.
--     Esperado lote 'siglas': 320 = INF FEM 189, INF MASC 94, MEN MASC 17, MEN FEM 15, NUEVA ERA 3, INTERMEDIO 1, JUV MAY MASC 1.
--     Esperado lote 'hoja32 dias inferidos' (solo si se corrio): 57 = INF MASC 56, MEN MASC 1.
SELECT split_part(r.notes, ' / ', 2) AS lote, t.name AS grupo, count(*) AS registros,
       count(*) FILTER (WHERE r.status = 'present') AS present
FROM public.attendance_records r JOIN public.teams t ON t.id = r.team_id
WHERE r.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
  AND r.notes LIKE 'Planilla papel sep-2026 / %(2026-10-05)'
GROUP BY ROLLUP (split_part(r.notes, ' / ', 2), t.name) ORDER BY 1 NULLS LAST, 2 NULLS LAST;

-- V3. Por marca del papel (lote siglas): X 114, ✓R 89, VR 74, R 21, ✓ 16 (Quintero, hoja 25), otros 6.
SELECT substring(r.notes FROM ' marca (.*) \(2026-10-05\)$') AS marca, count(*)
FROM public.attendance_records r
WHERE r.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
  AND r.notes LIKE 'Planilla papel sep-2026 / %(2026-10-05)'
GROUP BY 1 ORDER BY 2 DESC;

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

-- V6. La carga del 2026-10-03 sigue intacta. Esperado: 102 sesiones y 1358 registros.
SELECT (SELECT count(*) FROM public.attendance_sessions
        WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
          AND coach_notes = 'Cargada desde planilla de papel sep-2026 (2026-10-03)') AS sesiones_10_03,
       (SELECT count(*) FROM public.attendance_records
        WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
          AND notes = 'Planilla papel sep-2026') AS registros_10_03;

-- V7. Sin efectos colaterales: ninguna reserva tocada en las sesiones de papel. Esperado: 0.
SELECT count(*) AS bookings_en_sesiones_papel
FROM public.session_bookings b JOIN public.attendance_sessions s ON s.id = b.session_id
WHERE s.coach_notes LIKE 'Cargada desde planilla de papel sep-2026%';

-- V8. Foto final de septiembre por grupo (todas las fuentes).
SELECT t.name AS grupo, count(DISTINCT s.id) AS sesiones,
       count(r.id) FILTER (WHERE r.status = 'present') AS presentes,
       count(r.id) FILTER (WHERE r.status <> 'present') AS otros_estados
FROM public.attendance_sessions s
JOIN public.teams t ON t.id = s.team_id
LEFT JOIN public.attendance_records r ON r.session_id = s.id
WHERE s.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
  AND s.session_date BETWEEN '2026-09-01' AND '2026-09-30'
GROUP BY t.name ORDER BY t.name;
