-- =============================================================================
-- Dynasty Volley Club — atletas de las planillas de papel de septiembre 2026
-- que NO estan en la app  ->  "Matriculas por revisar" (enrollment_form_intake)
--
-- Pedido: respuesta de Milena a la P9 de preguntas-para-milena.md:
--   "crearlos y dejarlos en matriculas por revisar".
-- Informe: aplicar_matriculas_por_revisar_2026-10-05_informe.md (mismo directorio).
--
-- QUE HACE
--   Inserta 10 fichas en enrollment_form_intake con status 'waiting_review'
--   (el estado que lista GET /api/v1/enrollment-intake y la pantalla
--   /school/enrollment-intake). source = 'app', uploaded_by = Milena (owner),
--   SIN foto (storage_path NULL): los datos salen de la planilla, no de una hoja
--   de matricula.
--
-- QUE NO HACE (a proposito)
--   * NO crea children / unregistered_athletes / enrollments / payments.
--     La escuela completa los datos (documento, acudiente, correo, telefono)
--     y le da "Crear atleta" en la pantalla. Ese boton NO asigna equipo ni plan
--     ni genera cobros: despues hay que inscribirlo y registrar el pago anotado.
--   * El pago de la planilla queda ESCRITO en la ficha (extracted.category, que
--     la pantalla muestra como "Categoria en la hoja", y extracted.planilla /
--     extracted.observaciones como dato estructurado). No se crea ningun payment.
--
-- QUIENES NO ENTRAN (ya existen en la app; detalle en el informe)
--   Fontecha "Maleja"      = MARIA ALEJANDRA FONTECHA GONZALEZ (sep ya pagado 04-sep)
--   Pardo "Malu"           = MARIA LUISA PARDO RODRIGUEZ        (sep ya pagado)
--   Garzon Jaraiba Emanuel = Emmanuel Canon Loaiza              (sep ya pagado 18-sep)
--   Trejos Lizeth          = cuenta propia "Lizeth Natalia Trejos Sanchez" sin escuela
--                            -> se inscribe por "atleta con cuenta" (adult_existing),
--                               no por esta bandeja (crearia una segunda identidad).
--
-- IDEMPOTENTE: no inserta una ficha si ya hay otra de Dynasty con el mismo
-- nombre normalizado (sin acentos, minusculas, espacios colapsados) y el mismo
-- origen 'planilla papel sep-2026', en cualquier estado. Tampoco si el nombre
-- normalizado ya existe tal cual en children / unregistered_athletes de la
-- escuela. Correrlo dos veces inserta 0 filas la segunda vez.
--
-- Para el SQL Editor de Supabase (sin TEMP TABLE ni RAISE).
-- =============================================================================

BEGIN;

WITH params AS (
  SELECT
    '2d509571-3238-4c04-ac3f-6dfe20539226'::uuid AS school_id,   -- DYNASTY VOLLEY CLUB
    '73adf4ca-51f5-4f4a-a6ca-1973c84e8151'::uuid AS milena_id,   -- MILENA BARRERA (owner)
    'planilla papel sep-2026'::text              AS origen
),
-- Una fila por atleta. dup_child = atleta existente PROBABLE (la pantalla lo
-- muestra como "Ya existe: ..." y ofrece "Vincular"; deshabilita "Crear").
src (nombre, grupo_hoja, grupo_probable, imagen, fila, valor, fecha_pago, medio, meses, nota_planilla, observaciones, dup_child) AS (
  VALUES
  ('Mathias Calderón López', 'Infantil Masculino', 'INFANTIL MASCULINO', 6, '7',
     210000, '2026-09-03', 'Datáfono', 1, NULL,
     'También figura en la asistencia de Infantil Masculino (img 13, fila 7). $210.000 es más que la cuota habitual de $150.000: confirmar plan.', NULL::uuid),

  ('Luciana Cucunubá', 'Infantil Femenino', 'INFANTIL FEMENINO', 5, '22',
     150000, '2026-08-30', 'BC', 1, 'Anotado «INCAP.» (incapacidad)',
     'Pago fechado 30-ago anotado en la planilla de septiembre: confirmar a qué mes corresponde.', NULL),

  ('Tanya Díaz', 'Seniors', 'SENIORS', 20, '44',
     130000, '2026-09-16', 'BC', 1, 'Manuscrito poco legible (se lee «Ranyd Draz»); probable «Tanya Díaz»',
     'Nombre dudoso: confirmar. Seniors = probablemente MAYOR DE EDAD: crearla como atleta adulta (ver informe), no con acudiente.', NULL),

  ('Samuel Peña', 'Menores Masculino (impreso: Infantil Masculino)', 'MENORES MASCULINO', 23, '24',
     100000, '2026-09-20', 'BC', 1, 'Manuscrito «Peña Jamuel» -> probable Samuel; valor con trazo raro',
     'Nombre y monto dudosos: confirmar. No hay ningún Samuel Peña en la escuela.', NULL),

  ('Daniel Niño', 'Menores Masculino (impreso: Infantil Masculino)', 'MENORES MASCULINO', 23, '25',
     300000, '2026-09-21', 'BC', 2, 'Manuscrito «Niño Daniel - 2 MESES»; debajo una palabra borrada que empieza «Ret...» (¿Retirado?)',
     'PROBABLE: es JULIAN DAVID NIÑO RAMIREZ (Menores Masculino, cuota $180.000, agosto y septiembre vencidos). Si es él: «Vincular» y registrar los $300.000 contra agosto+septiembre (no cubre los $360.000). Si no es él: descartar esta ficha y crearlo por el alta manual.',
     '640d1ee2-aac2-41fc-8cae-f029b142e6fb'::uuid),

  ('Juan Fernando Gómez', 'MINI', 'MINIVOLLEY BENJAMINES', 27, '19',
     150000, '2026-08-31', 'BC', 1, 'Medio escrito «BC - NP.» (sigla NP sin interpretar)',
     'Pago fechado 31-ago anotado en la planilla de septiembre: confirmar a qué mes corresponde.', NULL),

  ('Juan Andrés Zorro', '(no indicado; probablemente Infantil Masculino)', 'INFANTIL MASCULINO', 30, '41',
     150000, '2026-09-11', 'QR', 1, 'La «Z» está sobrescrita',
     'También en asistencia (img 32, «Zorro Juan», varones). Grupo inferido, no impreso: confirmar.', NULL),

  ('Ana María Sáenz Rojas', '(no indicado; probablemente Minivolley Benjamines)', 'MINIVOLLEY BENJAMINES', 26, '1',
     150000, '2026-09-05', 'Efectivo', 1, NULL,
     'Probable hermana de Sofía Sáenz Rojas (misma fecha y medio). Grupo inferido (8 de 10 atletas de esa hoja son de Minivolley Benjamines).', NULL),

  ('Sofía Sáenz Rojas', '(no indicado; probablemente Minivolley Benjamines)', 'MINIVOLLEY BENJAMINES', 26, '2',
     150000, '2026-09-05', 'Efectivo', 1, NULL,
     'Probable hermana de Ana María Sáenz Rojas (misma fecha y medio). Grupo inferido: confirmar.', NULL),

  ('Antonella Sierra Fuentes', '(no indicado; probablemente Minivolley Benjamines)', 'MINIVOLLEY BENJAMINES', 26, '15',
     90000, '2026-09-23', 'BC', 1, NULL,
     '$90.000 es menos que la cuota habitual: confirmar si es abono o tarifa especial. Grupo inferido: confirmar.', NULL)
),
filas AS (
  SELECT
    s.*,
    -- mismo criterio que normalizeName() de students-create-one.route.ts
    regexp_replace(lower(extensions.unaccent(s.nombre)), '\s+', ' ', 'g') AS nombre_norm,
    s.grupo_probable
      || ' · Planilla papel sep-2026: pagó $' || replace(to_char(s.valor, 'FM999,999,999'), ',', '.') || ' el '
      || to_char(s.fecha_pago::date, 'DD-MM-YYYY') || ' (' || s.medio || ')'
      || CASE WHEN s.meses > 1 THEN ' = ' || s.meses || ' MESES' ELSE '' END
      || '. Al crear: asignar equipo/plan y REGISTRAR ESE PAGO (no pedir comprobante). '
      || s.observaciones AS categoria_visible
  FROM src s
)
INSERT INTO public.enrollment_form_intake
  (school_id, source, uploaded_by, storage_path, status, extracted, duplicate_of_child_id)
SELECT
  p.school_id,
  'app',
  p.milena_id,
  NULL,
  'waiting_review',
  jsonb_build_object(
    -- Campos del EnrollmentFormResult que la pantalla lee
    'athleteFullName',   f.nombre,
    'docType',           NULL,
    'docNumber',         NULL,
    'dateOfBirth',       NULL,
    'dateOfBirthRaw',    NULL,
    'ageOnForm',         NULL,
    'category',          f.categoria_visible,
    'guardianFullName',  NULL,
    'guardianDocType',   NULL,
    'guardianDocNumber', NULL,
    'guardianPhone',     NULL,
    'guardianEmail',     NULL,
    'athleteEmail',      NULL,
    'athletePhone',      NULL,
    'epsName',           NULL,
    'bloodType',         NULL,
    'formDate',          NULL,
    'authorizations',    '[]'::jsonb,
    'isEnrollmentForm',  true,
    -- se resaltan en ámbar en la pantalla: lo que la escuela tiene que llenar
    'missingFields',     jsonb_build_array('doc_type','doc_number','date_of_birth','guardian_full_name',
                                           'guardian_email','guardian_phone','eps_name','blood_type'),
    'provider',          'planilla-papel-manual',
    -- Trazabilidad (no la muestra la pantalla; sirve para idempotencia y auditoría)
    'origen',            p.origen,
    'cargado_el',        '2026-10-05',
    'autorizado_por',    'Milena (respuesta P9: crearlos y dejarlos en matrículas por revisar)',
    'observaciones',     f.observaciones,
    'planilla', jsonb_build_object(
        'imagen',       f.imagen,
        'fila',         f.fila,
        'grupo_hoja',   f.grupo_hoja,
        'grupo_probable', f.grupo_probable,
        'valor',        f.valor,
        'fecha_pago',   f.fecha_pago,
        'medio',        f.medio,
        'meses',        f.meses,
        'nota',         f.nota_planilla
    )
  ),
  f.dup_child
FROM filas f
CROSS JOIN params p
WHERE NOT EXISTS (                    -- idempotencia: misma persona, misma escuela, mismo origen
        SELECT 1 FROM public.enrollment_form_intake e
        WHERE e.school_id = p.school_id
          AND e.extracted->>'origen' = p.origen
          AND regexp_replace(lower(extensions.unaccent(e.extracted->>'athleteFullName')), '\s+', ' ', 'g') = f.nombre_norm
      )
  AND NOT EXISTS (                    -- salvaguarda: si mientras tanto alguien lo creó con ese nombre exacto
        SELECT 1 FROM public.children c
        WHERE c.school_id = p.school_id
          AND regexp_replace(lower(extensions.unaccent(btrim(c.full_name))), '\s+', ' ', 'g') = f.nombre_norm
      )
  AND NOT EXISTS (
        SELECT 1 FROM public.unregistered_athletes ua
        WHERE ua.school_id = p.school_id
          AND regexp_replace(lower(extensions.unaccent(btrim(ua.full_name))), '\s+', ' ', 'g') = f.nombre_norm
      )
RETURNING id, extracted->>'athleteFullName' AS atleta, status, duplicate_of_child_id;

-- Verificación (debe dar 10 filas en waiting_review con origen 'planilla papel sep-2026')
SELECT e.id,
       e.extracted->>'athleteFullName'           AS atleta,
       e.extracted->'planilla'->>'grupo_probable' AS grupo,
       e.extracted->'planilla'->>'valor'          AS valor,
       e.extracted->'planilla'->>'fecha_pago'     AS fecha_pago,
       e.status, e.source, e.duplicate_of_child_id
FROM public.enrollment_form_intake e
WHERE e.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
  AND e.extracted->>'origen' = 'planilla papel sep-2026'
ORDER BY e.created_at, atleta;

COMMIT;

-- -----------------------------------------------------------------------------
-- REVERSA (solo si hiciera falta y SOLO fichas que nadie revisó todavía):
-- DELETE FROM public.enrollment_form_intake
--  WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
--    AND extracted->>'origen' = 'planilla papel sep-2026'
--    AND status = 'waiting_review';
-- -----------------------------------------------------------------------------
