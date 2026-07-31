-- ============================================================================
-- Rótulos de padre para el catálogo de VOLEIBOL (51 métricas)
--
-- Traduce los nombres técnicos del catálogo al idioma de una familia.
-- Los nombres técnicos los puso alguien que sabe voleibol; estos rótulos son
-- la traducción, y el coach es quien debe validar que no digan imprecisiones.
--
-- REQUISITO: migración 20260731123145_parent_labels_for_metrics.sql aplicada
--            (columnas parent_label y parent_hint).
--
-- ESTRUCTURA — dos bloques, a propósito:
--   BLOQUE A (38): se aplican YA. Traducción directa, sin interpretación.
--   BLOQUE B (13): COMENTADO. Depende de confirmación del coach (ver abajo).
--
-- Por qué separados: el diseño de F0 cae a display_name cuando parent_label es
-- NULL, así que las 38 mejoran la vista del padre hoy sin esperar a nadie, y
-- las 13 dudosas siguen mostrando el nombre técnico —como hoy— hasta que se
-- confirmen. Nadie ve un rótulo inventado.
--
-- Idempotente. Convención del SQL editor de Supabase: reporte en el SELECT final.
-- ============================================================================


-- ############################################################################
-- BLOQUE A — 38 rótulos confiables. Se aplican ya.
-- ############################################################################

WITH vol AS (
    SELECT id FROM public.sports_categories WHERE name ILIKE 'voleibol' LIMIT 1
),
labels(metric_key, parent_label, parent_hint) AS (
    VALUES
    -- ── ASISTENCIA ──────────────────────────────────────────────────────────
    ('asistencia_entrenamiento',
     'Asistencia a los entrenamientos',
     'Porcentaje de sesiones a las que asistió en el mes. Es la base de todo lo demás: sin constancia no hay progreso.'),

    -- ── FÍSICO · capacidades condicionales ──────────────────────────────────
    ('fis_abdominal',
     'Fuerza abdominal',
     'Repeticiones de abdominales en el tiempo de prueba. Es lo que le sostiene la postura al saltar y al caer.'),
    ('fis_alcance',
     'Alcance con el brazo extendido',
     'Altura que alcanza de pie con el brazo estirado. Es la referencia para saber cuánto le suma el salto.'),
    ('fis_empuje_pecho_medicinal',
     'Fuerza de empuje del tren superior',
     'Distancia a la que lanza un balón de 2 kg empujando desde el pecho. Se traduce en potencia de remate y bloqueo.'),
    ('fis_flexibilidad',
     'Flexibilidad',
     'Cuánto alcanza al estirarse. Protege hombros y espalda, y le amplía el rango del remate. Puede dar valores negativos cuando todavía no llega a la punta de los pies.'),
    ('fis_flexion_pecho',
     'Fuerza de brazos y pecho',
     'Flexiones de pecho en el tiempo de prueba. Aporta a la potencia del golpe.'),
    ('fis_lanzamiento_medicinal',
     'Potencia de lanzamiento sobre la cabeza',
     'Distancia a la que lanza un balón de 2 kg por encima de la cabeza. Mide la fuerza que aplica al rematar.'),
    ('fis_salto_bloqueo',
     'Altura de salto en el bloqueo',
     'Cuánto sube al saltar para bloquear en la red. Es una de las medidas que más cambia con el entrenamiento.'),
    ('fis_salto_remate',
     'Altura de salto en el remate',
     'Cuánto sube al saltar para atacar. Junto con el alcance define hasta dónde llega su golpe.'),
    ('fis_sentadilla',
     'Fuerza de piernas',
     'Sentadillas en el tiempo de prueba. Es el motor del salto.'),
    ('fis_legger',
     'Resistencia física (test de ida y vuelta)',
     'Nivel alcanzado en el test de Léger, la prueba de ida y vuelta que va subiendo de ritmo. Indica cuánto aguanta sin bajar el rendimiento al final del partido.'),
    ('fis_velocidad_t',
     'Velocidad de desplazamiento',
     'Segundos en completar un recorrido en forma de T. Aquí MENOS es mejor: bajar el tiempo es haber mejorado.'),

    -- ── FÍSICO · capacidades coordinativas (escala 0-10) ────────────────────
    ('fis_coord_visomanual',
     'Coordinación ojo-mano',
     'Qué tan bien conecta lo que ve con lo que hace la mano. Es clave para recibir y golpear el balón donde quiere.'),
    ('fis_coord_visopedal',
     'Coordinación ojo-pie',
     'Qué tan bien ajusta los pies a lo que ve. Es lo que le permite llegar a tiempo al balón.'),
    ('fis_lateralidad',
     'Dominio de ambos lados del cuerpo',
     'Qué tan bien se maneja hacia los dos lados. Evita quedar en desventaja cuando el balón va a su lado débil.'),
    ('fis_ubicacion_tiempo_espacio',
     'Orientación en el espacio y el tiempo',
     'Qué tan bien calcula dónde va a caer el balón y cuándo. Es la capacidad de anticipar la trayectoria y llegar a tiempo.'),

    -- ── TÁCTICO ─────────────────────────────────────────────────────────────
    ('tac_comunicacion',
     'Comunicación con el equipo',
     'Si avisa, pide el balón y habla dentro de la cancha. En voleibol el silencio cuesta puntos.'),
    ('tac_estrategia',
     'Lectura del juego',
     'Si entiende el plan del partido y lo aplica mientras juega.'),
    ('tac_sistema_4_2',
     'Sistema de juego 4-2',
     'Formación con dos puestos de armado y cuatro de ataque. Suele ser el primer sistema de cancha completa que se enseña.'),
    ('tac_sistema_4_2_infiltrando',
     'Sistema 4-2 con armado infiltrado',
     'Variante del 4-2 en la que quien arma entra desde la zona de atrás, lo que libera tres atacantes adelante. Es el puente hacia el 5-1.'),
    ('tac_sistema_5_1',
     'Sistema de juego 5-1',
     'Formación con un solo puesto de armado y cinco de ataque. Es el sistema de los equipos avanzados.'),
    ('tac_sistema_6_0',
     'Sistema de juego 6-0',
     'Formación en la que todo el equipo rota por el armado. Enseña a que cada integrante conozca todos los roles.'),
    ('tac_sistema_ataque',
     'Organización en el ataque',
     'Qué tan bien se ubica y se coordina con el resto del equipo cuando atacan.'),
    ('tac_sistema_defensa',
     'Organización en la defensa',
     'Qué tan bien se ubica y se coordina con el resto del equipo cuando defienden.'),
    ('tac_trabajo_equipo',
     'Trabajo en equipo',
     'Cómo se integra y coopera con el resto del equipo, dentro y fuera de la cancha.'),

    -- ── TÉCNICO · resultados de partido ─────────────────────────────────────
    ('ataques_efectivos',
     'Ataques que terminaron en punto',
     'Cuántos remates ganaron el punto. Es resultado de partido, no de entrenamiento.'),
    ('bloqueos',
     'Bloqueos conseguidos',
     'Cuántos bloqueos frenaron efectivamente el ataque rival. Es resultado de partido; la técnica del gesto se mide aparte.'),
    ('saques_efectivos',
     'Saques acertados',
     'Porcentaje de saques que entraron y le complicaron la recepción al equipo rival.'),

    -- ── TÉCNICO · remate y bloqueo ──────────────────────────────────────────
    ('tec_remate',
     'Técnica del remate',
     'Cómo ejecuta el golpe de ataque: la carrera de aproximación, el salto y el golpe.'),
    ('tec_bloqueo',
     'Técnica del bloqueo',
     'Cómo se para en la red y coloca las manos para frenar el ataque rival. Es distinto de «Bloqueos conseguidos», que cuenta cuántos logró en partido.'),

    -- ── TÉCNICO · armado ────────────────────────────────────────────────────
    ('tec_levantadas',
     'Armado del balón (levantada)',
     'El pase alto y preciso para que otro integrante del equipo remate. Es el gesto propio del puesto de armado.'),

    -- ── TÉCNICO · saque ─────────────────────────────────────────────────────
    ('tec_saque_abajo_abierta',
     'Saque por abajo con mano abierta',
     'El primer saque que se aprende: golpe bajo con la palma abierta.'),
    ('tec_saque_abajo_cerrada',
     'Saque por abajo con puño',
     'Variante del saque de iniciación, golpeando con el puño cerrado.'),
    ('tec_saque_tenis',
     'Saque tipo tenis',
     'Saque por encima del hombro, parecido a un servicio de tenis. Es el paso intermedio hacia el saque con salto.'),
    ('tec_saque_flotado',
     'Saque flotado',
     'Saque sin rotación: el balón se mueve en el aire y es difícil de leer para quien recibe.'),
    ('tec_saque_flotado_salto',
     'Saque flotado con salto',
     'El mismo saque flotado pero ejecutado saltando. Más difícil y más agresivo.'),
    ('tec_saque_rotado',
     'Saque con rotación',
     'Saque que gira y cae rápido. Exige más control que el flotado.'),
    ('tec_saque_rotado_salto',
     'Saque con rotación y salto',
     'El saque potente del voleibol competitivo: rotación y salto juntos.')
)
UPDATE public.sport_metric_definitions d
SET parent_label = l.parent_label,
    parent_hint  = l.parent_hint
FROM labels l, vol
WHERE d.metric_key = l.metric_key
  AND d.sport_category_id = vol.id;


-- ############################################################################
-- BLOQUE A.2 — Limpieza de los 13 pendientes. NO ES OPCIONAL.
--
-- Por qué existe: una versión anterior de este script aplicaba los 51 de una
-- sola vez, con una lectura EQUIVOCADA del eje GMB/GMA (los rotulaba como
-- «· técnica básica / avanzada», como si fuera calidad de ejecución, cuando
-- clasifica la complejidad del gesto). Si ese script ya corrió, esas 13
-- métricas tienen un rótulo incorrecto guardado — y comentar el bloque B NO
-- lo borra: lo deja intacto y visible para las familias.
--
-- Así que se limpian explícitamente. Con parent_label en NULL vuelven a
-- mostrar su nombre técnico, que es el comportamiento correcto mientras el
-- coach no confirme. Es idempotente y no hace daño si nunca se aplicaron.
--
-- Cuando el bloque B se descomente, corre después de esta limpieza y gana.
-- ############################################################################

WITH vol AS (
    SELECT id FROM public.sports_categories WHERE name ILIKE 'voleibol' LIMIT 1
),
pendientes(metric_key) AS (
    VALUES
    -- Los 11 del eje GMB/GMA: depende de confirmar qué significa el eje.
    ('tec_gmb'), ('tec_gma'),
    ('tec_gmb_saque_flotado'), ('tec_gma_saque_flotado'),
    ('tec_gmb_saque_lados'),   ('tec_gmb_saque_lejano'),
    ('tec_gma_saque_cuerpo'),
    ('tec_gmb_remate_cuerpo'), ('tec_gma_remate_cuerpo'),
    ('tec_gmb_remate_cambio_ritmo'),
    ('tec_gmb_con_caida'),
    -- Los 2 que dependen de sus propias preguntas.
    ('tac_sistema_4_0'), ('tac_tactica_servicio')
)
UPDATE public.sport_metric_definitions d
SET parent_label = NULL,
    parent_hint  = NULL
FROM pendientes p, vol
WHERE d.metric_key = p.metric_key
  AND d.sport_category_id = vol.id
  AND (d.parent_label IS NOT NULL OR d.parent_hint IS NOT NULL);


-- ############################################################################
-- BLOQUE B — 13 rótulos PENDIENTES DE CONFIRMACIÓN DEL COACH
--
-- Están redactados y listos. NO se aplican todavía porque el texto va a la
-- cara de una familia y una imprecisión ahí no es un bug cosmético.
-- Mientras sigan comentados, esas métricas muestran su nombre técnico —el
-- mismo comportamiento de hoy—, así que no se pierde nada esperando.
--
-- LO QUE HAY QUE CONFIRMAR:
--
-- 1) GMB / GMA (11 métricas). Se asume «Gesto Motor Básico / Avanzado»,
--    nomenclatura de pedagogía deportiva que clasifica las destrezas por
--    COMPLEJIDAD DEL GESTO, no por calidad de ejecución. Es decir: hay gestos
--    que SON básicos y otros que SON avanzados; el puntaje 0-6 es lo que
--    califica qué tan bien lo hace.
--    Evidencia: de 9 gestos, solo 2 aparecen en ambos niveles (remate al
--    cuerpo y saque flotado) — justo lo esperable de un currículo que lista
--    destrezas distintas por nivel, y no de un eje que calificara lo mismo dos
--    veces. Los 2 que se repiten serían gestos enseñados en ambos niveles con
--    exigencia distinta.
--    → Confirmar con el coach que la lectura es esa antes de aplicar.
--
-- 2) tac_sistema_4_0. HIPÓTESIS: es minivoley — cuatro jugadores sin armado
--    fijo, todos rotan por todas las funciones, como se juega en categorías
--    menores. El 4-0 no es sistema estándar de cancha completa, así que si NO
--    es minivoley el rótulo está inventado.
--
-- 3) tac_tactica_servicio. La más 50/50: se asume la INTENCIÓN INDIVIDUAL al
--    sacar (a quién, dónde, con cuánto riesgo). Podría ser la estrategia
--    colectiva de saque del equipo, aunque eso es contenido de nivel
--    competitivo alto y no encaja tanto en formativo.
--
-- Para aplicar: descomentar el bloque completo y correrlo.
-- ############################################################################

-- WITH vol AS (
--     SELECT id FROM public.sports_categories WHERE name ILIKE 'voleibol' LIMIT 1
-- ),
-- labels(metric_key, parent_label, parent_hint) AS (
--     VALUES
--     -- ── Los dos agregados del eje ───────────────────────────────────────
--     ('tec_gmb',
--      'Fundamentos técnicos',
--      'Qué tan afianzadas tiene las destrezas básicas del voleibol, los fundamentos. Es lo que se trabaja primero y sostiene todo lo demás.'),
--     ('tec_gma',
--      'Destrezas técnicas avanzadas',
--      'Qué tan bien ejecuta las destrezas de nivel avanzado. Se empiezan a enseñar cuando los fundamentos ya están sólidos.'),
--
--     -- ── Gestos del nivel básico ─────────────────────────────────────────
--     ('tec_gmb_saque_flotado',
--      'Saque flotado (fundamento)',
--      'Saque sin rotación en su versión básica: que cruce la red flotando. La versión avanzada le agrega dirección y profundidad.'),
--     ('tec_gmb_saque_lados',
--      'Saque a los lados (fundamento)',
--      'Saque dirigido a las bandas de la cancha rival.'),
--     ('tec_gmb_saque_lejano',
--      'Saque profundo (fundamento)',
--      'Saque que cae al fondo de la cancha rival.'),
--     ('tec_gmb_remate_cuerpo',
--      'Remate al cuerpo (fundamento)',
--      'Remate dirigido sobre quien defiende, en su versión básica.'),
--     ('tec_gmb_remate_cambio_ritmo',
--      'Remate con cambio de ritmo (fundamento)',
--      'Si logra engañar a la defensa cambiando la velocidad del golpe.'),
--     ('tec_gmb_con_caida',
--      'Defensa con caída al piso (fundamento)',
--      'El gesto de lanzarse al piso —rodada o plancha— para salvar un balón, y levantarse bien. Además de salvar puntos, la técnica correcta previene lesiones.'),
--
--     -- ── Gestos del nivel avanzado ───────────────────────────────────────
--     ('tec_gma_saque_flotado',
--      'Saque flotado (destreza avanzada)',
--      'El mismo saque flotado, ahora con exigencia de dirección y profundidad.'),
--     ('tec_gma_saque_cuerpo',
--      'Saque al cuerpo (destreza avanzada)',
--      'Saque dirigido directamente a quien recibe, para dificultarle el control del balón.'),
--     ('tec_gma_remate_cuerpo',
--      'Remate al cuerpo (destreza avanzada)',
--      'El mismo remate sobre quien defiende, ahora con lectura del bloqueo rival.'),
--
--     -- ── Los dos que dependen de otra confirmación ───────────────────────
--     ('tac_sistema_4_0',
--      'Sistema de juego 4-0 (minivoley)',
--      'Formación de cuatro jugadores sin armado fijo: todos rotan por todas las funciones. Es como se juega en las categorías menores y la base para aprender a rotar.'),
--     ('tac_tactica_servicio',
--      'Intención en el saque',
--      'Si saca buscando un objetivo (una zona de la cancha, alguien en particular) en vez de solo pasar el balón al otro lado.')
-- )
-- UPDATE public.sport_metric_definitions d
-- SET parent_label = l.parent_label,
--     parent_hint  = l.parent_hint
-- FROM labels l, vol
-- WHERE d.metric_key = l.metric_key
--   AND d.sport_category_id = vol.id;


-- ── Reporte final ───────────────────────────────────────────────────────────
SELECT
    CASE WHEN d.parent_label IS NULL THEN 'PENDIENTE COACH' ELSE 'aplicado' END AS bloque,
    d.category,
    d.metric_key,
    d.display_name AS nombre_tecnico,
    d.parent_label AS rotulo_familia
FROM public.sport_metric_definitions d
WHERE d.sport_category_id = (
    SELECT id FROM public.sports_categories WHERE name ILIKE 'voleibol' LIMIT 1
)
ORDER BY (d.parent_label IS NOT NULL), d.category, d.display_name;
