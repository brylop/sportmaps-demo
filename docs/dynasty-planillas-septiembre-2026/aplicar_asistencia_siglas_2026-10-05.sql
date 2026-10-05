-- Dynasty: asistencia sep-2026, marcas con siglas (X, x, R, VR, ✓R) + hoja sin titulo 25 por grupo actual del atleta
-- Generado 2026-10-05 desde docs/dynasty-planillas-septiembre-2026/cruce_asistencia.json + respuestas de Milena (2026-10-05).
-- Milena 2026-10-05: toda marca (✓, X, R, VR, ✓R) = asistio; en Infantil Masculino la X es asistencia;
-- hojas sin titulo: grupo = inscripcion activa actual del atleta (enrollments.status = active).
-- Excluidas a proposito: R(tachada), X/✓ tachados, garabatos, "/", numeros, VA, C, Y, borrones, anotaciones
-- (Repetida/Incapacidad/Retirada), filas sin atleta identificado, y la hoja 32 (sin encabezado de dias:
-- va aparte en aplicar_asistencia_hoja32_OPCIONAL_2026-10-05.sql).
-- Correr en el SQL Editor de Supabase completo (BEGIN ... COMMIT).
-- Idempotente: re-correrlo no duplica (NOT EXISTS por equipo+fecha en sesiones; por atleta+fecha y por sesion+atleta en registros).
-- No toca registros existentes (ni los 1.358 del 2026-10-03 ni los "absent" previos de la app).
-- Sesiones se insertan YA finalized=true: deduccion y aviso post-entrenamiento solo disparan en UPDATE false->true.

BEGIN;

-- 1) Sesiones (equipo, fecha) que necesitan los registros: 51 pares; solo se crean las que no existen.
--    Esperado al 2026-10-05: 14 nuevas (13 INFANTIL MASCULINO dias 8,9,13,15,16,18,20,22,23,25,27,29,30 + 1 INFANTIL FEMENINO 28-sep); las otras 37 ya existen.
INSERT INTO public.attendance_sessions
  (school_id, team_id, session_date, title, finalized, finalized_at, finalized_by, created_by, coach_notes)
SELECT '2d509571-3238-4c04-ac3f-6dfe20539226'::uuid, v.team_id, v.session_date, 'Entrenamiento', true, now(),
       '73adf4ca-51f5-4f4a-a6ca-1973c84e8151'::uuid, '73adf4ca-51f5-4f4a-a6ca-1973c84e8151'::uuid,
       'Cargada desde planilla de papel sep-2026 (2026-10-05)'
FROM (VALUES
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02'),  -- INFANTIL FEMENINO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05'),  -- INFANTIL FEMENINO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06'),  -- INFANTIL FEMENINO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07'),  -- INFANTIL FEMENINO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14'),  -- INFANTIL FEMENINO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16'),  -- INFANTIL FEMENINO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-20'),  -- INFANTIL FEMENINO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-21'),  -- INFANTIL FEMENINO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23'),  -- INFANTIL FEMENINO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-26'),  -- INFANTIL FEMENINO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-28'),  -- INFANTIL FEMENINO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30'),  -- INFANTIL FEMENINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-08'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-09'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-15'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-16'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-18'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-22'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-23'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-29'),  -- INFANTIL MASCULINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-30'),  -- INFANTIL MASCULINO
  ('7d4219e3-f343-4e99-9527-fa7af7e8285e'::uuid, date '2026-09-30'),  -- INTERMEDIO
  ('8b6cb8c9-92da-4550-9546-50252a3592e1'::uuid, date '2026-09-10'),  -- JUVENIL MAYORES MASCULINO
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-01'),  -- MENORES FEMENINO
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-03'),  -- MENORES FEMENINO
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-04'),  -- MENORES FEMENINO
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-10'),  -- MENORES FEMENINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-01'),  -- MENORES MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-03'),  -- MENORES MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-05'),  -- MENORES MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-06'),  -- MENORES MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-08'),  -- MENORES MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-10'),  -- MENORES MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-12'),  -- MENORES MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-13'),  -- MENORES MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-15'),  -- MENORES MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-17'),  -- MENORES MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-19'),  -- MENORES MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-20'),  -- MENORES MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-22'),  -- MENORES MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-24'),  -- MENORES MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-26'),  -- MENORES MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-27'),  -- MENORES MASCULINO
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-29'),  -- MENORES MASCULINO
  ('260a28d8-a84d-4eed-9deb-005098d469e3'::uuid, date '2026-09-13'),  -- NUEVA ERA
  ('260a28d8-a84d-4eed-9deb-005098d469e3'::uuid, date '2026-09-18'),  -- NUEVA ERA
  ('260a28d8-a84d-4eed-9deb-005098d469e3'::uuid, date '2026-09-20')  -- NUEVA ERA
) AS v(team_id, session_date)
WHERE NOT EXISTS (
  SELECT 1 FROM public.attendance_sessions s
  WHERE s.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226' AND s.team_id = v.team_id AND s.session_date = v.session_date);

-- 2) Registros present: 320 filas (equipo, fecha, child_id, hoja, marca del papel).
INSERT INTO public.attendance_records
  (school_id, child_id, attendance_date, status, marked_by, notes, team_id, session_id, check_in_method)
SELECT '2d509571-3238-4c04-ac3f-6dfe20539226'::uuid, v.child_id, v.fecha, 'present', '73adf4ca-51f5-4f4a-a6ca-1973c84e8151'::uuid,
       'Planilla papel sep-2026 / siglas / hoja ' || v.hoja || ' marca ' || v.marca || ' (2026-10-05)',
       s.team_id, s.id, 'manual'
FROM (VALUES
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', 'd92a40f5-1a2e-4c38-bb31-74cf1d19d23c'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | ANA MARIA MARTINEZ JIMENEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '134bb246-df68-4ec1-aa91-1228ec3db94d'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | Anaisabel Mondragón Mejía
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', 'bdc13fd7-884f-45e4-95a1-7e712ecab097'::uuid, 24, 'X'),  -- INFANTIL FEMENINO | CHRISTIE ESCALLON SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', 'a44eb443-2f72-41fc-9479-99ae47d7b402'::uuid, 7, 'X'),  -- INFANTIL FEMENINO | GABRIELA MALDONADO ROZO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '6c2c982d-e83f-47c9-a779-af1aa4326ae9'::uuid, 7, 'X'),  -- INFANTIL FEMENINO | GABRIELA PELAYO CARO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '6eb1535d-5262-4a68-a5fe-93d1eec4aa84'::uuid, 18, 'X'),  -- INFANTIL FEMENINO | ISABELLA BARRETO CARDENAS
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '522110dc-30e0-45ba-aff1-77d017b1ac43'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | ISABELLA CALERO GONZALEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', 'e41c0688-2fab-4f9a-8b29-1a24c9a75dbf'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | ISABELLA RODRIGUEZ CRISTANCHO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '397d03f8-4df7-4ab0-98ea-462e05eb67cd'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | ISABELLA VANEGAS PAREJA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', 'bd4ed337-9a8f-4190-8c63-9ebb24e206af'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | Isabela Martínez Castillo
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', 'c0d54cfe-a910-4180-b6b9-9105e6c7893f'::uuid, 24, 'X'),  -- INFANTIL FEMENINO | JULIANA LEON JAIME
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', 'a115ffca-226d-41e4-9000-a2d6261c3df4'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | JULIANA RODRIGUEZ AMORTEGUI
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '36277afd-f8c8-4dd8-8f27-898cd65eda28'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | KAMILA STEPHANNY ORTIZ TOVAR
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '3798750d-708c-4222-8c4d-60209ef98957'::uuid, 24, 'X'),  -- INFANTIL FEMENINO | LAURA SOFIA FAJARDO RINCON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', 'd596b8a8-3e7c-4e90-8870-10bf0cb9bc3e'::uuid, 24, 'X'),  -- INFANTIL FEMENINO | LINA MARIA HERNANDEZ GOMEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '4f2e6cb6-a144-4e87-a5cd-5ccce7ab980c'::uuid, 3, 'X'),  -- INFANTIL FEMENINO | LINDA ARIANA SANCHEZ HERREÑO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '4c504299-7761-4e10-975f-647b58347e8e'::uuid, 3, 'X'),  -- INFANTIL FEMENINO | LINDA NICOLLE VELANDIA MANRIQUE
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '41abfc9f-cac1-4e7e-b8c7-5038be15fb80'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | LUCIA CACERES RODRIGUEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '108857c1-c933-4336-8a03-3a0463409442'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | LUNA ISABELLA CUERVO BELTRAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '58b1c5a6-97f7-4dec-b23e-ec3341d4120a'::uuid, 3, 'X'),  -- INFANTIL FEMENINO | MARIA CAMILA RAMIREZ MEDINA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', 'c1b90f6b-1baf-4af1-9494-8669cc626fb7'::uuid, 18, 'X'),  -- INFANTIL FEMENINO | MARIA ISABELLA CHAVES AGUILAR
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', 'f60b7bdc-8139-4b86-93de-09d7aba00646'::uuid, 18, 'X'),  -- INFANTIL FEMENINO | MARIA JOSE CARRION REINA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '24e208b6-2bfa-4216-98c6-046e8798921b'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | MARIA PAULA GOMEZ GAITAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', 'c6b046c5-a061-4967-8a89-9b62152ac811'::uuid, 24, 'X'),  -- INFANTIL FEMENINO | MARIA SUSANA GUTIERREZ GUEVARA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '7fef6ff1-9ae8-487e-bf69-6f661adefd19'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | MARIANA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '79d6a0db-4d0d-4ba0-be3d-2309e655cf45'::uuid, 24, 'X'),  -- INFANTIL FEMENINO | María Paula Gutiérrez Rodriguez
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', 'aac87aa3-ad74-4091-b9f0-26e6ca5a7b25'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | SALOME OLARTE GARZON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '816b64d9-cf4f-4a47-8242-9f39d31f009e'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | SAMANTHA GONZANLEZ MATEUS
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '4c408a66-2563-4410-8f56-4782cb7fe904'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | SARA ISABELLA HERNANDEZ BAQUERO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '932a7686-feb5-4b77-9432-05c7a90f0034'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SARA SOFIA CADENA RICAURTE
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', 'e09ac6ea-c203-49e0-ba26-f482fd551ab9'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SARA VICTORIA AGUILAR LEON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', 'abeeda49-bbb8-4925-b10f-83a15d2b90e1'::uuid, 18, 'X'),  -- INFANTIL FEMENINO | SARAY CARVAJAL ACOSTA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', 'eb84eadf-00d5-4e8a-be4b-9f613affba26'::uuid, 7, 'X'),  -- INFANTIL FEMENINO | SHADDAI ALEXANDRA MONROY DIAZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '5b53f670-30c8-45e3-ab84-4c47995a4c34'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | SILVANA SIERRA PINZON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', 'e68fd3cd-4624-48b3-b85d-8adc64dc2a7f'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SOFIA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-02', '00640907-f28e-421b-bee0-013e5023af6e'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | VALERIA ROJAS LOPEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', 'd92a40f5-1a2e-4c38-bb31-74cf1d19d23c'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | ANA MARIA MARTINEZ JIMENEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', '134bb246-df68-4ec1-aa91-1228ec3db94d'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | Anaisabel Mondragón Mejía
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', '522110dc-30e0-45ba-aff1-77d017b1ac43'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | ISABELLA CALERO GONZALEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', 'e41c0688-2fab-4f9a-8b29-1a24c9a75dbf'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | ISABELLA RODRIGUEZ CRISTANCHO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', '397d03f8-4df7-4ab0-98ea-462e05eb67cd'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | ISABELLA VANEGAS PAREJA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', 'bd4ed337-9a8f-4190-8c63-9ebb24e206af'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | Isabela Martínez Castillo
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', 'c0d54cfe-a910-4180-b6b9-9105e6c7893f'::uuid, 24, 'X(sobre ✓)'),  -- INFANTIL FEMENINO | JULIANA LEON JAIME
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', 'a115ffca-226d-41e4-9000-a2d6261c3df4'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | JULIANA RODRIGUEZ AMORTEGUI
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', '41abfc9f-cac1-4e7e-b8c7-5038be15fb80'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | LUCIA CACERES RODRIGUEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', '108857c1-c933-4336-8a03-3a0463409442'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | LUNA ISABELLA CUERVO BELTRAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', '237f26ac-05e3-4ded-b76f-7b554cb6a034'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | MARIA JOSE MORA RIGUEROS
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', '24e208b6-2bfa-4216-98c6-046e8798921b'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | MARIA PAULA GOMEZ GAITAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', '7fef6ff1-9ae8-487e-bf69-6f661adefd19'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | MARIANA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', 'aac87aa3-ad74-4091-b9f0-26e6ca5a7b25'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | SALOME OLARTE GARZON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', '4c408a66-2563-4410-8f56-4782cb7fe904'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | SARA ISABELLA HERNANDEZ BAQUERO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', '932a7686-feb5-4b77-9432-05c7a90f0034'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SARA SOFIA CADENA RICAURTE
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', 'e09ac6ea-c203-49e0-ba26-f482fd551ab9'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SARA VICTORIA AGUILAR LEON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', '5b53f670-30c8-45e3-ab84-4c47995a4c34'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | SILVANA SIERRA PINZON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', 'e68fd3cd-4624-48b3-b85d-8adc64dc2a7f'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SOFIA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', '7c792959-fcb2-49ec-b81d-4f9ab8564d0a'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | SOFIA SANTACRUZ SILVA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-05', '00640907-f28e-421b-bee0-013e5023af6e'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | VALERIA ROJAS LOPEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', 'd92a40f5-1a2e-4c38-bb31-74cf1d19d23c'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | ANA MARIA MARTINEZ JIMENEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', '134bb246-df68-4ec1-aa91-1228ec3db94d'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | Anaisabel Mondragón Mejía
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', 'e41c0688-2fab-4f9a-8b29-1a24c9a75dbf'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | ISABELLA RODRIGUEZ CRISTANCHO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', '397d03f8-4df7-4ab0-98ea-462e05eb67cd'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | ISABELLA VANEGAS PAREJA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', 'bd4ed337-9a8f-4190-8c63-9ebb24e206af'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | Isabela Martínez Castillo
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', '108857c1-c933-4336-8a03-3a0463409442'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | LUNA ISABELLA CUERVO BELTRAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', '237f26ac-05e3-4ded-b76f-7b554cb6a034'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | MARIA JOSE MORA RIGUEROS
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', '4dd5ac0a-3270-4d28-9900-cf35227e3473'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | MARIA PAULA ESCOBAR BENITEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', '24e208b6-2bfa-4216-98c6-046e8798921b'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | MARIA PAULA GOMEZ GAITAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', 'aac87aa3-ad74-4091-b9f0-26e6ca5a7b25'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | SALOME OLARTE GARZON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', 'f57a0383-1d14-419b-901d-d037aa34c0a0'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | SALOME RINCON GOMEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', '816b64d9-cf4f-4a47-8242-9f39d31f009e'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | SAMANTHA GONZANLEZ MATEUS
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', '932a7686-feb5-4b77-9432-05c7a90f0034'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SARA SOFIA CADENA RICAURTE
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', 'e09ac6ea-c203-49e0-ba26-f482fd551ab9'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SARA VICTORIA AGUILAR LEON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', '5b53f670-30c8-45e3-ab84-4c47995a4c34'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | SILVANA SIERRA PINZON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', '7c792959-fcb2-49ec-b81d-4f9ab8564d0a'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | SOFIA SANTACRUZ SILVA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-06', '00640907-f28e-421b-bee0-013e5023af6e'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | VALERIA ROJAS LOPEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', 'd92a40f5-1a2e-4c38-bb31-74cf1d19d23c'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | ANA MARIA MARTINEZ JIMENEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', '522110dc-30e0-45ba-aff1-77d017b1ac43'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | ISABELLA CALERO GONZALEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', 'e41c0688-2fab-4f9a-8b29-1a24c9a75dbf'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | ISABELLA RODRIGUEZ CRISTANCHO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', '397d03f8-4df7-4ab0-98ea-462e05eb67cd'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | ISABELLA VANEGAS PAREJA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', 'a115ffca-226d-41e4-9000-a2d6261c3df4'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | JULIANA RODRIGUEZ AMORTEGUI
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', '36277afd-f8c8-4dd8-8f27-898cd65eda28'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | KAMILA STEPHANNY ORTIZ TOVAR
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', '41abfc9f-cac1-4e7e-b8c7-5038be15fb80'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | LUCIA CACERES RODRIGUEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', '108857c1-c933-4336-8a03-3a0463409442'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | LUNA ISABELLA CUERVO BELTRAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', '4dd5ac0a-3270-4d28-9900-cf35227e3473'::uuid, 24, 'R✓'),  -- INFANTIL FEMENINO | MARIA PAULA ESCOBAR BENITEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', '24e208b6-2bfa-4216-98c6-046e8798921b'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | MARIA PAULA GOMEZ GAITAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', '7fef6ff1-9ae8-487e-bf69-6f661adefd19'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | MARIANA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', 'aac87aa3-ad74-4091-b9f0-26e6ca5a7b25'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | SALOME OLARTE GARZON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', 'f57a0383-1d14-419b-901d-d037aa34c0a0'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | SALOME RINCON GOMEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', '816b64d9-cf4f-4a47-8242-9f39d31f009e'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | SAMANTHA GONZANLEZ MATEUS
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', '4c408a66-2563-4410-8f56-4782cb7fe904'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | SARA ISABELLA HERNANDEZ BAQUERO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', '932a7686-feb5-4b77-9432-05c7a90f0034'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SARA SOFIA CADENA RICAURTE
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', 'e09ac6ea-c203-49e0-ba26-f482fd551ab9'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SARA VICTORIA AGUILAR LEON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', '5b53f670-30c8-45e3-ab84-4c47995a4c34'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | SILVANA SIERRA PINZON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', 'e68fd3cd-4624-48b3-b85d-8adc64dc2a7f'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SOFIA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', '7c792959-fcb2-49ec-b81d-4f9ab8564d0a'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | SOFIA SANTACRUZ SILVA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', 'c6378217-0857-4ef0-ad32-b7071acca4bb'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | STEPHANIA RODRIGUEZ BARON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-07', '00640907-f28e-421b-bee0-013e5023af6e'::uuid, 7, 'X'),  -- INFANTIL FEMENINO | VALERIA ROJAS LOPEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', 'd92a40f5-1a2e-4c38-bb31-74cf1d19d23c'::uuid, 7, 'R'),  -- INFANTIL FEMENINO | ANA MARIA MARTINEZ JIMENEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', '522110dc-30e0-45ba-aff1-77d017b1ac43'::uuid, 18, 'R'),  -- INFANTIL FEMENINO | ISABELLA CALERO GONZALEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', '397d03f8-4df7-4ab0-98ea-462e05eb67cd'::uuid, 3, 'R'),  -- INFANTIL FEMENINO | ISABELLA VANEGAS PAREJA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', '36277afd-f8c8-4dd8-8f27-898cd65eda28'::uuid, 7, 'R'),  -- INFANTIL FEMENINO | KAMILA STEPHANNY ORTIZ TOVAR
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', '4c504299-7761-4e10-975f-647b58347e8e'::uuid, 3, 'R'),  -- INFANTIL FEMENINO | LINDA NICOLLE VELANDIA MANRIQUE
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', '41abfc9f-cac1-4e7e-b8c7-5038be15fb80'::uuid, 18, 'R'),  -- INFANTIL FEMENINO | LUCIA CACERES RODRIGUEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', '108857c1-c933-4336-8a03-3a0463409442'::uuid, 24, 'R'),  -- INFANTIL FEMENINO | LUNA ISABELLA CUERVO BELTRAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', '4dd5ac0a-3270-4d28-9900-cf35227e3473'::uuid, 24, 'R'),  -- INFANTIL FEMENINO | MARIA PAULA ESCOBAR BENITEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', '24e208b6-2bfa-4216-98c6-046e8798921b'::uuid, 24, 'R'),  -- INFANTIL FEMENINO | MARIA PAULA GOMEZ GAITAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', '7fef6ff1-9ae8-487e-bf69-6f661adefd19'::uuid, 18, 'R'),  -- INFANTIL FEMENINO | MARIANA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', 'aac87aa3-ad74-4091-b9f0-26e6ca5a7b25'::uuid, 7, 'R'),  -- INFANTIL FEMENINO | SALOME OLARTE GARZON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', 'f57a0383-1d14-419b-901d-d037aa34c0a0'::uuid, 7, 'R'),  -- INFANTIL FEMENINO | SALOME RINCON GOMEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', '816b64d9-cf4f-4a47-8242-9f39d31f009e'::uuid, 24, 'R'),  -- INFANTIL FEMENINO | SAMANTHA GONZANLEZ MATEUS
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', '4c408a66-2563-4410-8f56-4782cb7fe904'::uuid, 24, 'R'),  -- INFANTIL FEMENINO | SARA ISABELLA HERNANDEZ BAQUERO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', '932a7686-feb5-4b77-9432-05c7a90f0034'::uuid, 18, 'R'),  -- INFANTIL FEMENINO | SARA SOFIA CADENA RICAURTE
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', 'e09ac6ea-c203-49e0-ba26-f482fd551ab9'::uuid, 18, 'R'),  -- INFANTIL FEMENINO | SARA VICTORIA AGUILAR LEON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', '5b53f670-30c8-45e3-ab84-4c47995a4c34'::uuid, 3, 'R'),  -- INFANTIL FEMENINO | SILVANA SIERRA PINZON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', 'e68fd3cd-4624-48b3-b85d-8adc64dc2a7f'::uuid, 18, 'R'),  -- INFANTIL FEMENINO | SOFIA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', '7c792959-fcb2-49ec-b81d-4f9ab8564d0a'::uuid, 3, 'R'),  -- INFANTIL FEMENINO | SOFIA SANTACRUZ SILVA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', 'c6378217-0857-4ef0-ad32-b7071acca4bb'::uuid, 7, 'R'),  -- INFANTIL FEMENINO | STEPHANIA RODRIGUEZ BARON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-14', '00640907-f28e-421b-bee0-013e5023af6e'::uuid, 7, 'R'),  -- INFANTIL FEMENINO | VALERIA ROJAS LOPEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', 'd92a40f5-1a2e-4c38-bb31-74cf1d19d23c'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | ANA MARIA MARTINEZ JIMENEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', '9591dfa6-4777-411d-ac05-b54ee270a37a'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | INES MARIANA GOMEZ CARVAJAL
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', '522110dc-30e0-45ba-aff1-77d017b1ac43'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | ISABELLA CALERO GONZALEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', 'e41c0688-2fab-4f9a-8b29-1a24c9a75dbf'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | ISABELLA RODRIGUEZ CRISTANCHO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', '397d03f8-4df7-4ab0-98ea-462e05eb67cd'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | ISABELLA VANEGAS PAREJA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', '36277afd-f8c8-4dd8-8f27-898cd65eda28'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | KAMILA STEPHANNY ORTIZ TOVAR
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', '4c504299-7761-4e10-975f-647b58347e8e'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | LINDA NICOLLE VELANDIA MANRIQUE
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', '41abfc9f-cac1-4e7e-b8c7-5038be15fb80'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | LUCIA CACERES RODRIGUEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', '108857c1-c933-4336-8a03-3a0463409442'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | LUNA ISABELLA CUERVO BELTRAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', '4dd5ac0a-3270-4d28-9900-cf35227e3473'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | MARIA PAULA ESCOBAR BENITEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', '24e208b6-2bfa-4216-98c6-046e8798921b'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | MARIA PAULA GOMEZ GAITAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', '7fef6ff1-9ae8-487e-bf69-6f661adefd19'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | MARIANA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', 'aac87aa3-ad74-4091-b9f0-26e6ca5a7b25'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | SALOME OLARTE GARZON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', 'f57a0383-1d14-419b-901d-d037aa34c0a0'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | SALOME RINCON GOMEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', '4c408a66-2563-4410-8f56-4782cb7fe904'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | SARA ISABELLA HERNANDEZ BAQUERO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', '932a7686-feb5-4b77-9432-05c7a90f0034'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SARA SOFIA CADENA RICAURTE
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', 'e09ac6ea-c203-49e0-ba26-f482fd551ab9'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SARA VICTORIA AGUILAR LEON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', '5b53f670-30c8-45e3-ab84-4c47995a4c34'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | SILVANA SIERRA PINZON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', 'e68fd3cd-4624-48b3-b85d-8adc64dc2a7f'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SOFIA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', '7c792959-fcb2-49ec-b81d-4f9ab8564d0a'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | SOFIA SANTACRUZ SILVA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', 'c6378217-0857-4ef0-ad32-b7071acca4bb'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | STEPHANIA RODRIGUEZ BARON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-16', '00640907-f28e-421b-bee0-013e5023af6e'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | VALERIA ROJAS LOPEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-20', 'd92a40f5-1a2e-4c38-bb31-74cf1d19d23c'::uuid, 7, 'VR'),  -- INFANTIL FEMENINO | ANA MARIA MARTINEZ JIMENEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-20', '522110dc-30e0-45ba-aff1-77d017b1ac43'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | ISABELLA CALERO GONZALEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-20', '397d03f8-4df7-4ab0-98ea-462e05eb67cd'::uuid, 3, 'VR'),  -- INFANTIL FEMENINO | ISABELLA VANEGAS PAREJA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-20', 'bd4ed337-9a8f-4190-8c63-9ebb24e206af'::uuid, 7, 'VR'),  -- INFANTIL FEMENINO | Isabela Martínez Castillo
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-21', 'e41c0688-2fab-4f9a-8b29-1a24c9a75dbf'::uuid, 7, 'VR'),  -- INFANTIL FEMENINO | ISABELLA RODRIGUEZ CRISTANCHO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-21', 'a115ffca-226d-41e4-9000-a2d6261c3df4'::uuid, 7, 'VR'),  -- INFANTIL FEMENINO | JULIANA RODRIGUEZ AMORTEGUI
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-21', 'c6378217-0857-4ef0-ad32-b7071acca4bb'::uuid, 7, 'VR'),  -- INFANTIL FEMENINO | STEPHANIA RODRIGUEZ BARON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-21', '00640907-f28e-421b-bee0-013e5023af6e'::uuid, 7, 'VR'),  -- INFANTIL FEMENINO | VALERIA ROJAS LOPEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', 'd92a40f5-1a2e-4c38-bb31-74cf1d19d23c'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | ANA MARIA MARTINEZ JIMENEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', '9591dfa6-4777-411d-ac05-b54ee270a37a'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | INES MARIANA GOMEZ CARVAJAL
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', '522110dc-30e0-45ba-aff1-77d017b1ac43'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | ISABELLA CALERO GONZALEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', '397d03f8-4df7-4ab0-98ea-462e05eb67cd'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | ISABELLA VANEGAS PAREJA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', '36277afd-f8c8-4dd8-8f27-898cd65eda28'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | KAMILA STEPHANNY ORTIZ TOVAR
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', '4c504299-7761-4e10-975f-647b58347e8e'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | LINDA NICOLLE VELANDIA MANRIQUE
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', '108857c1-c933-4336-8a03-3a0463409442'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | LUNA ISABELLA CUERVO BELTRAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', '24e208b6-2bfa-4216-98c6-046e8798921b'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | MARIA PAULA GOMEZ GAITAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', '7fef6ff1-9ae8-487e-bf69-6f661adefd19'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | MARIANA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', 'aac87aa3-ad74-4091-b9f0-26e6ca5a7b25'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | SALOME OLARTE GARZON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', '816b64d9-cf4f-4a47-8242-9f39d31f009e'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | SAMANTHA GONZANLEZ MATEUS
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', '4c408a66-2563-4410-8f56-4782cb7fe904'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | SARA ISABELLA HERNANDEZ BAQUERO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', '932a7686-feb5-4b77-9432-05c7a90f0034'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SARA SOFIA CADENA RICAURTE
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', 'e09ac6ea-c203-49e0-ba26-f482fd551ab9'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SARA VICTORIA AGUILAR LEON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', '5b53f670-30c8-45e3-ab84-4c47995a4c34'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | SILVANA SIERRA PINZON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', 'e68fd3cd-4624-48b3-b85d-8adc64dc2a7f'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SOFIA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-23', '7c792959-fcb2-49ec-b81d-4f9ab8564d0a'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | SOFIA SANTACRUZ SILVA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-26', 'a115ffca-226d-41e4-9000-a2d6261c3df4'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | JULIANA RODRIGUEZ AMORTEGUI
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-26', 'f57a0383-1d14-419b-901d-d037aa34c0a0'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | SALOME RINCON GOMEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-26', 'c6378217-0857-4ef0-ad32-b7071acca4bb'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | STEPHANIA RODRIGUEZ BARON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-26', '00640907-f28e-421b-bee0-013e5023af6e'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | VALERIA ROJAS LOPEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-28', 'd92a40f5-1a2e-4c38-bb31-74cf1d19d23c'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | ANA MARIA MARTINEZ JIMENEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-28', '9591dfa6-4777-411d-ac05-b54ee270a37a'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | INES MARIANA GOMEZ CARVAJAL
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-28', '397d03f8-4df7-4ab0-98ea-462e05eb67cd'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | ISABELLA VANEGAS PAREJA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-28', '108857c1-c933-4336-8a03-3a0463409442'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | LUNA ISABELLA CUERVO BELTRAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-28', '4dd5ac0a-3270-4d28-9900-cf35227e3473'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | MARIA PAULA ESCOBAR BENITEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-28', '24e208b6-2bfa-4216-98c6-046e8798921b'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | MARIA PAULA GOMEZ GAITAN
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-28', '4c408a66-2563-4410-8f56-4782cb7fe904'::uuid, 24, 'VR'),  -- INFANTIL FEMENINO | SARA ISABELLA HERNANDEZ BAQUERO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-28', '5b53f670-30c8-45e3-ab84-4c47995a4c34'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | SILVANA SIERRA PINZON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-28', '7c792959-fcb2-49ec-b81d-4f9ab8564d0a'::uuid, 3, '✓R'),  -- INFANTIL FEMENINO | SOFIA SANTACRUZ SILVA
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', '522110dc-30e0-45ba-aff1-77d017b1ac43'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | ISABELLA CALERO GONZALEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', 'e41c0688-2fab-4f9a-8b29-1a24c9a75dbf'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | ISABELLA RODRIGUEZ CRISTANCHO
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', 'a115ffca-226d-41e4-9000-a2d6261c3df4'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | JULIANA RODRIGUEZ AMORTEGUI
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', '36277afd-f8c8-4dd8-8f27-898cd65eda28'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | KAMILA STEPHANNY ORTIZ TOVAR
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', '41abfc9f-cac1-4e7e-b8c7-5038be15fb80'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | LUCIA CACERES RODRIGUEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', '7fef6ff1-9ae8-487e-bf69-6f661adefd19'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | MARIANA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', 'aac87aa3-ad74-4091-b9f0-26e6ca5a7b25'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | SALOME OLARTE GARZON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', 'f57a0383-1d14-419b-901d-d037aa34c0a0'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | SALOME RINCON GOMEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', 'e09ac6ea-c203-49e0-ba26-f482fd551ab9'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SARA VICTORIA AGUILAR LEON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', 'e68fd3cd-4624-48b3-b85d-8adc64dc2a7f'::uuid, 18, 'VR'),  -- INFANTIL FEMENINO | SOFIA ARIZA SANCHEZ
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', 'c6378217-0857-4ef0-ad32-b7071acca4bb'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | STEPHANIA RODRIGUEZ BARON
  ('1d2b58fe-8103-495b-aee5-6bca231901f9'::uuid, date '2026-09-30', '00640907-f28e-421b-bee0-013e5023af6e'::uuid, 7, '✓R'),  -- INFANTIL FEMENINO | VALERIA ROJAS LOPEZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-08', '92c9ec70-7221-480a-8877-50f93046ff24'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | Edward Samuel Becerra Perez
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-08', '570177f2-d0a2-456f-9957-4037be602ca1'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN MANUEL TORRES BAREÑO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-08', '3a23bd14-e890-40ab-8b0f-12b99eef6c7e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | LUIS FELIPE AYCARDY OSPINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-08', '78dcf4b7-c51d-447b-ad51-cfbc3f7feb4a'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SAMUEL HERRERA RODRIGUEZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-08', '792027eb-89b4-40fe-9985-908b67998c1d'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SIMON LEMUS FORERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-09', '88f0f00f-0df7-4153-b3ed-23a50a8ff969'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JOSEPH SEBASTIAN MOSQUERA SANCHEZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-09', '570177f2-d0a2-456f-9957-4037be602ca1'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN MANUEL TORRES BAREÑO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-09', '20eb7212-277e-4fd6-b5d6-5869b4734ff4'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JULIAN COBALEDA ANGULO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-09', '3a23bd14-e890-40ab-8b0f-12b99eef6c7e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | LUIS FELIPE AYCARDY OSPINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-09', 'e2dcc3cb-38ae-46d6-b8ed-b95e7252ecc3'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SANTIAGO MUÑOZ ALVAREZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-09', '792027eb-89b4-40fe-9985-908b67998c1d'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SIMON LEMUS FORERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', '5e16307b-9c1d-4d18-a17d-6655122b292a'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | ANDRES ESTEBAN MORA DUARTE
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', 'dbedd85d-5003-4cb0-8a19-2b8d3efb59cc'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | DILAN GUERRA MENDOZA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', '92c9ec70-7221-480a-8877-50f93046ff24'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | Edward Samuel Becerra Perez
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', 'fc95786d-117b-4cdc-9f26-55c2762da455'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JOSE GABRIEL MORA DUARTE
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', '5822c5ce-2c0e-4b14-af0a-4e469ea9f588'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN MARTIN FORERO PINZON
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', '20eb7212-277e-4fd6-b5d6-5869b4734ff4'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JULIAN COBALEDA ANGULO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', '3a23bd14-e890-40ab-8b0f-12b99eef6c7e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | LUIS FELIPE AYCARDY OSPINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', '78dcf4b7-c51d-447b-ad51-cfbc3f7feb4a'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SAMUEL HERRERA RODRIGUEZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', 'e2dcc3cb-38ae-46d6-b8ed-b95e7252ecc3'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SANTIAGO MUÑOZ ALVAREZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-13', '792027eb-89b4-40fe-9985-908b67998c1d'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SIMON LEMUS FORERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-15', '7784c2b6-302b-4b4c-ba36-b521769230ea'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | ANDRES FELIPE GOMEZ QUINTERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-15', '92c9ec70-7221-480a-8877-50f93046ff24'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | Edward Samuel Becerra Perez
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-15', 'ad310f3d-beac-4b4d-85e2-877a060ce78e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JOSHUA NICOLAS BALAGUERA VALBUENA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-15', '5abb74f4-78e1-4827-bb7a-eef73bc38c6f'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN ANDRES APARICIO ROMERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-15', '570177f2-d0a2-456f-9957-4037be602ca1'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN MANUEL TORRES BAREÑO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-15', '3a23bd14-e890-40ab-8b0f-12b99eef6c7e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | LUIS FELIPE AYCARDY OSPINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-15', '792027eb-89b4-40fe-9985-908b67998c1d'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SIMON LEMUS FORERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-16', '5abb74f4-78e1-4827-bb7a-eef73bc38c6f'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN ANDRES APARICIO ROMERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-18', '5e16307b-9c1d-4d18-a17d-6655122b292a'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | ANDRES ESTEBAN MORA DUARTE
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-18', 'fc95786d-117b-4cdc-9f26-55c2762da455'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JOSE GABRIEL MORA DUARTE
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-18', 'ad310f3d-beac-4b4d-85e2-877a060ce78e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JOSHUA NICOLAS BALAGUERA VALBUENA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-18', '5822c5ce-2c0e-4b14-af0a-4e469ea9f588'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN MARTIN FORERO PINZON
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-18', '20eb7212-277e-4fd6-b5d6-5869b4734ff4'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JULIAN COBALEDA ANGULO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-18', '3a23bd14-e890-40ab-8b0f-12b99eef6c7e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | LUIS FELIPE AYCARDY OSPINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-18', '78dcf4b7-c51d-447b-ad51-cfbc3f7feb4a'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SAMUEL HERRERA RODRIGUEZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-18', 'e2dcc3cb-38ae-46d6-b8ed-b95e7252ecc3'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SANTIAGO MUÑOZ ALVAREZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-18', '792027eb-89b4-40fe-9985-908b67998c1d'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SIMON LEMUS FORERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', '5e16307b-9c1d-4d18-a17d-6655122b292a'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | ANDRES ESTEBAN MORA DUARTE
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', '7784c2b6-302b-4b4c-ba36-b521769230ea'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | ANDRES FELIPE GOMEZ QUINTERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', 'dbedd85d-5003-4cb0-8a19-2b8d3efb59cc'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | DILAN GUERRA MENDOZA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', '92c9ec70-7221-480a-8877-50f93046ff24'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | Edward Samuel Becerra Perez
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', 'fc95786d-117b-4cdc-9f26-55c2762da455'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JOSE GABRIEL MORA DUARTE
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', 'ad310f3d-beac-4b4d-85e2-877a060ce78e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JOSHUA NICOLAS BALAGUERA VALBUENA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', '5822c5ce-2c0e-4b14-af0a-4e469ea9f588'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN MARTIN FORERO PINZON
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', '20eb7212-277e-4fd6-b5d6-5869b4734ff4'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JULIAN COBALEDA ANGULO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', '3a23bd14-e890-40ab-8b0f-12b99eef6c7e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | LUIS FELIPE AYCARDY OSPINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', '78dcf4b7-c51d-447b-ad51-cfbc3f7feb4a'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SAMUEL HERRERA RODRIGUEZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-20', 'e2dcc3cb-38ae-46d6-b8ed-b95e7252ecc3'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SANTIAGO MUÑOZ ALVAREZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-22', '7784c2b6-302b-4b4c-ba36-b521769230ea'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | ANDRES FELIPE GOMEZ QUINTERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-22', 'dbedd85d-5003-4cb0-8a19-2b8d3efb59cc'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | DILAN GUERRA MENDOZA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-22', '92c9ec70-7221-480a-8877-50f93046ff24'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | Edward Samuel Becerra Perez
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-22', '5abb74f4-78e1-4827-bb7a-eef73bc38c6f'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN ANDRES APARICIO ROMERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-22', '570177f2-d0a2-456f-9957-4037be602ca1'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN MANUEL TORRES BAREÑO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-22', '20eb7212-277e-4fd6-b5d6-5869b4734ff4'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JULIAN COBALEDA ANGULO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-22', '3a23bd14-e890-40ab-8b0f-12b99eef6c7e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | LUIS FELIPE AYCARDY OSPINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-22', 'e2dcc3cb-38ae-46d6-b8ed-b95e7252ecc3'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SANTIAGO MUÑOZ ALVAREZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-22', '792027eb-89b4-40fe-9985-908b67998c1d'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SIMON LEMUS FORERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-23', '92c9ec70-7221-480a-8877-50f93046ff24'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | Edward Samuel Becerra Perez
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-23', '5abb74f4-78e1-4827-bb7a-eef73bc38c6f'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN ANDRES APARICIO ROMERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-23', '20eb7212-277e-4fd6-b5d6-5869b4734ff4'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JULIAN COBALEDA ANGULO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-23', '3a23bd14-e890-40ab-8b0f-12b99eef6c7e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | LUIS FELIPE AYCARDY OSPINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-23', '792027eb-89b4-40fe-9985-908b67998c1d'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SIMON LEMUS FORERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', '5e16307b-9c1d-4d18-a17d-6655122b292a'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | ANDRES ESTEBAN MORA DUARTE
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', '7784c2b6-302b-4b4c-ba36-b521769230ea'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | ANDRES FELIPE GOMEZ QUINTERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', 'dbedd85d-5003-4cb0-8a19-2b8d3efb59cc'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | DILAN GUERRA MENDOZA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', '92c9ec70-7221-480a-8877-50f93046ff24'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | Edward Samuel Becerra Perez
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', 'fc95786d-117b-4cdc-9f26-55c2762da455'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JOSE GABRIEL MORA DUARTE
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', 'ad310f3d-beac-4b4d-85e2-877a060ce78e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JOSHUA NICOLAS BALAGUERA VALBUENA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', '570177f2-d0a2-456f-9957-4037be602ca1'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN MANUEL TORRES BAREÑO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', '5822c5ce-2c0e-4b14-af0a-4e469ea9f588'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN MARTIN FORERO PINZON
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-25', '3a23bd14-e890-40ab-8b0f-12b99eef6c7e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | LUIS FELIPE AYCARDY OSPINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27', '5e16307b-9c1d-4d18-a17d-6655122b292a'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | ANDRES ESTEBAN MORA DUARTE
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27', '92c9ec70-7221-480a-8877-50f93046ff24'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | Edward Samuel Becerra Perez
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27', 'fc95786d-117b-4cdc-9f26-55c2762da455'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JOSE GABRIEL MORA DUARTE
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27', 'ad310f3d-beac-4b4d-85e2-877a060ce78e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JOSHUA NICOLAS BALAGUERA VALBUENA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27', '5822c5ce-2c0e-4b14-af0a-4e469ea9f588'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN MARTIN FORERO PINZON
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27', '20eb7212-277e-4fd6-b5d6-5869b4734ff4'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JULIAN COBALEDA ANGULO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27', '3a23bd14-e890-40ab-8b0f-12b99eef6c7e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | LUIS FELIPE AYCARDY OSPINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27', '78dcf4b7-c51d-447b-ad51-cfbc3f7feb4a'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SAMUEL HERRERA RODRIGUEZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-27', 'e2dcc3cb-38ae-46d6-b8ed-b95e7252ecc3'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SANTIAGO MUÑOZ ALVAREZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-29', '92c9ec70-7221-480a-8877-50f93046ff24'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | Edward Samuel Becerra Perez
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-29', 'ad310f3d-beac-4b4d-85e2-877a060ce78e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JOSHUA NICOLAS BALAGUERA VALBUENA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-29', '5abb74f4-78e1-4827-bb7a-eef73bc38c6f'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN ANDRES APARICIO ROMERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-29', '20eb7212-277e-4fd6-b5d6-5869b4734ff4'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JULIAN COBALEDA ANGULO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-29', '78dcf4b7-c51d-447b-ad51-cfbc3f7feb4a'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SAMUEL HERRERA RODRIGUEZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-29', '792027eb-89b4-40fe-9985-908b67998c1d'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SIMON LEMUS FORERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-30', '92c9ec70-7221-480a-8877-50f93046ff24'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | Edward Samuel Becerra Perez
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-30', '88f0f00f-0df7-4153-b3ed-23a50a8ff969'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JOSEPH SEBASTIAN MOSQUERA SANCHEZ
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-30', 'ad310f3d-beac-4b4d-85e2-877a060ce78e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JOSHUA NICOLAS BALAGUERA VALBUENA
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-30', '5abb74f4-78e1-4827-bb7a-eef73bc38c6f'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN ANDRES APARICIO ROMERO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-30', '570177f2-d0a2-456f-9957-4037be602ca1'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | JUAN MANUEL TORRES BAREÑO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-30', '3a23bd14-e890-40ab-8b0f-12b99eef6c7e'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | LUIS FELIPE AYCARDY OSPINO
  ('81263e50-49e4-4826-a8ac-6818aef0e891'::uuid, date '2026-09-30', 'e2dcc3cb-38ae-46d6-b8ed-b95e7252ecc3'::uuid, 13, 'X'),  -- INFANTIL MASCULINO | SANTIAGO MUÑOZ ALVAREZ
  ('7d4219e3-f343-4e99-9527-fa7af7e8285e'::uuid, date '2026-09-30', '3a37d8dd-ecfd-4e69-81bf-2732b3c15aab'::uuid, 29, 'x (azul)'),  -- INTERMEDIO | DANNA SOFIA LOPEZ ROMERO
  ('8b6cb8c9-92da-4550-9546-50252a3592e1'::uuid, date '2026-09-10', '9e619d97-0fbb-489e-8a9b-8a21bc20482f'::uuid, 25, 'checkR10'),  -- JUVENIL MAYORES MASCULINO | Juan Esteban Gallo Bello
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-01', '8ff11949-7437-443b-a310-e216d2b68df4'::uuid, 17, '✓R'),  -- MENORES FEMENINO | DAHIANA PEÑA VILLALBA
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-01', '809f623f-12bf-4bc8-bd4e-6414e3f02ef5'::uuid, 17, '✓R'),  -- MENORES FEMENINO | LUCIANA NIEVES RAQUIRA
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-01', '680497a7-cd7c-4e10-8a6c-919897e2f007'::uuid, 17, '✓R'),  -- MENORES FEMENINO | LUNA SOFIA ORTIZ VILLALOBOS
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-03', '8ff11949-7437-443b-a310-e216d2b68df4'::uuid, 17, '✓R'),  -- MENORES FEMENINO | DAHIANA PEÑA VILLALBA
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-03', '809f623f-12bf-4bc8-bd4e-6414e3f02ef5'::uuid, 17, '✓R'),  -- MENORES FEMENINO | LUCIANA NIEVES RAQUIRA
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-03', 'df44f904-5c43-474e-83d7-2213f93f44b7'::uuid, 17, '✓R'),  -- MENORES FEMENINO | MARIANA SEVILLA REY
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-03', 'fd19060c-0cc7-454d-abe1-540b83b10517'::uuid, 17, '✓R'),  -- MENORES FEMENINO | MARIANA VARGAS BENAVIDES
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-04', '8ff11949-7437-443b-a310-e216d2b68df4'::uuid, 17, '✓R'),  -- MENORES FEMENINO | DAHIANA PEÑA VILLALBA
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-04', 'b1acf00f-67d1-4289-89cd-65fd43a5ed48'::uuid, 22, '✓R'),  -- MENORES FEMENINO | DANIELA SOFIA ZAMBRANO HENAO
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-04', '6645598e-01d9-47dd-a04d-0290ab691319'::uuid, 17, '✓R'),  -- MENORES FEMENINO | GABRIELA RODRIGUEZ LOPEZ
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-04', '809f623f-12bf-4bc8-bd4e-6414e3f02ef5'::uuid, 17, '✓R'),  -- MENORES FEMENINO | LUCIANA NIEVES RAQUIRA
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-04', 'df44f904-5c43-474e-83d7-2213f93f44b7'::uuid, 17, '✓R'),  -- MENORES FEMENINO | MARIANA SEVILLA REY
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-04', 'd33e1e71-f9e4-4a0a-b3b3-4d2952d6db67'::uuid, 17, '✓R'),  -- MENORES FEMENINO | PAULA ANDREA PEREZ VALDES
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-04', '620b6f41-ef16-4fb4-b698-82235e5dec2e'::uuid, 17, '✓R'),  -- MENORES FEMENINO | VALERIA RANGEL RUIZ
  ('751d243e-d2f3-477a-afd9-0532f4011e76'::uuid, date '2026-09-10', '2d6c989f-4625-47f9-9164-abbc8a35c28f'::uuid, 17, 'X'),  -- MENORES FEMENINO | KATHALINA VASQUEZ VELASQUEZ
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-01', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, '✓'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-03', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, '✓'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-05', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, '✓'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-06', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, '✓'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-08', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, '✓'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-10', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, 'U'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-12', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, '✓'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-13', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, '✓'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-15', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, '✓'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-17', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, '✓'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-19', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, '✓'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-20', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, '✓'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-22', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, '✓'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-24', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, '✓'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-26', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, '✓'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-27', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, '✓'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('1bbdfadf-f60a-45cd-8751-d112bfc057a6'::uuid, date '2026-09-29', '193e7f19-ecf1-45bb-853c-c07c5d0d875e'::uuid, 25, '✓'),  -- MENORES MASCULINO | MATIAS QUINTERO CASALLAS
  ('260a28d8-a84d-4eed-9deb-005098d469e3'::uuid, date '2026-09-13', '197d8239-af1f-4410-bc44-d0c6fde1915b'::uuid, 15, 'X/✓'),  -- NUEVA ERA | ISABELLA GOMEZ RENTERIA
  ('260a28d8-a84d-4eed-9deb-005098d469e3'::uuid, date '2026-09-18', '10e5676b-ca6c-4e6a-8dc7-3917836ef4b9'::uuid, 15, 'X'),  -- NUEVA ERA | VICTORIA EUGENIA MANCERA LONDOÑO
  ('260a28d8-a84d-4eed-9deb-005098d469e3'::uuid, date '2026-09-20', '0bba21b6-84f6-4048-9f0c-3f24fd5675e7'::uuid, 4, 'X')  -- NUEVA ERA | MARIA FERNANDA ARENAS QUIROGA
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
  ('INFANTIL FEMENINO', 189),
  ('INFANTIL MASCULINO', 94),
  ('INTERMEDIO', 1),
  ('JUVENIL MAYORES MASCULINO', 1),
  ('MENORES FEMENINO', 15),
  ('MENORES MASCULINO', 17),
  ('NUEVA ERA', 3)
  , ('TOTAL', 320)
) AS x(grupo, registros_esperados)
LEFT JOIN (SELECT coalesce(t.name, 'TOTAL') AS name, count(*) n FROM public.attendance_records ar JOIN public.teams t ON t.id = ar.team_id
           WHERE ar.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226' AND ar.notes LIKE 'Planilla papel sep-2026 / siglas /%'
           GROUP BY ROLLUP (t.name)) r ON r.name = x.grupo
LEFT JOIN (SELECT coalesce(t.name, 'TOTAL') AS name, count(*) n FROM public.attendance_sessions s JOIN public.teams t ON t.id = s.team_id
           WHERE s.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226' AND s.coach_notes = 'Cargada desde planilla de papel sep-2026 (2026-10-05)'
           GROUP BY ROLLUP (t.name)) sn ON sn.name = x.grupo
ORDER BY (x.grupo = 'TOTAL'), x.grupo;

COMMIT;
