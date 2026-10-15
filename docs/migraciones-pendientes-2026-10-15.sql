-- =============================================================================
-- MIGRACIONES PENDIENTES DE APLICAR — corte 2026-10-15 (ayer y hoy, todas las sesiones)
-- =============================================================================
-- Qué es: las 10 migraciones de los días 13–15 de octubre que NO están aplicadas en la
-- base (verificado el 2026-10-15 contra la base viva: ni su registro ni sus objetos
-- existen). Van en ORDEN de versión. La base es UNA sola para dev, stg y prod.
--
-- Cómo aplicarlas (reglas de CLAUDE.md, Disk IO):
--   · UNA sola sesión; nunca desde agentes en paralelo (cada DDL recarga el esquema de PostgREST).
--   · De una en una, verificando cada bloque; no regenerar types.ts entre ellas, solo al final.
--   · Por una vía que deje rastro (CLI de Supabase o apply_migration), no pegando en el editor.
--   · ANTES de desplegar el código de su bloque (pizarra / facturación).
--
-- Bloques:
--   PIZARRA (rama pizarra-tp/integracion) ........ 8 migraciones
--   FACTURACIÓN SaaS (rama wt-facturacion) ....... 1 de esquema + 1 de DATOS de Monster (opcional, ver nota)
--
-- NO están acá porque ya están aplicadas (algunas a mano, sin registro):
--   mora (3: mora_no_cancela…, mora_vence_enlaces…, wa_estado_pagos_con_mora),
--   roles+sedes (3), torneos (1), y el resto de las de los días 13–14.
--
-- NOTA sobre `acuerdo_monster_volley` (PARTE 3): es un cambio de DATOS. Quedó con
-- supuestos SIN confirmar (plan_code no cambia, certificado se renueva a 12 meses al
-- mismo valor, montos sin IVA, quién emite la factura DIAN). No correrla hasta confirmarlos.
--
-- Nada de lo de abajo fue ejecutado por quien escribió este archivo.
-- =============================================================================

-- ═════════════ PARTE 1 — PIZARRA ═════════════

-- ───────────────────────────────────────────────────────────────────────────
-- [1/10] PIZARRA  ·  20261013194057_plantillas_ejercicios_otros_deportes.sql
-- origen: pizarra-tp/integracion:supabase/migrations/20261013194057_plantillas_ejercicios_otros_deportes.sql
-- ───────────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261013194057_plantillas_ejercicios_otros_deportes.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-13   Versión anterior: 20261013165308
-- Objetivo: plantillas SportMaps de la Biblioteca de ejercicios (pizarra T3,
--   docs/specs/pizarra-nivel-tacticalpad.md) para los deportes que no tenían
--   ninguna: futsal, voleibol, baloncesto, balonmano, fútbol 5 y genérico.
--   Solo DATOS: 16 filas en public.training_exercises (school_id NULL,
--   is_template = true), mismo formato de board que las 12 de 20261008183744.
-- =============================================================================
-- GENERADA desde frontend/src/test/fixtures/plantillasEjercicios.ts
-- (buildTemplatesSql). src/test/plantillasEjercicios.test.tsx valida cada
-- jugada (validateExerciseInput / validateFrames del BFF, coordenadas dentro
-- de la cancha del deporte, render con TacticalStaticSvg) y que este archivo
-- sea exactamente lo que genera el fixture.
--
-- Idempotente: ids fijos (ON CONFLICT (id) DO NOTHING) y además no inserta una
-- plantilla del sistema si ya hay otra con el mismo nombre y deporte (por si
-- un super admin la creó a mano antes). No toca las plantillas existentes.
--
-- Depende de 20261008183744_biblioteca_ejercicios_v2 (tabla training_exercises).
-- Inmutable: un cambio va en una migración NUEVA.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.training_exercises') IS NULL THEN
    RAISE EXCEPTION 'Falta public.training_exercises: aplicar 20261008183744_biblioteca_ejercicios_v2 antes que esta migración.';
  END IF;
END $$;

INSERT INTO public.training_exercises
  (id, school_id, created_by, name, objective, minutes, age_group, materials, tags, sport, description, board, is_template, is_active)
SELECT v.id, NULL, NULL, v.name, v.objective, v.minutes, v.age_group, v.materials, v.tags, v.sport, v.description, v.board, true, true
FROM (VALUES
  ('5b1b0000-0000-4000-8000-000000000013'::uuid, 'Pared y diagonal del ala', 'Superar a la defensa con la pared del pívot y el desmarque en diagonal del ala para rematar al primer toque.', 15, 'Sub-10 en adelante', '1 arco, 6 balones, 4 petos',
   ARRAY['finalización', 'pared', 'desmarque', 'ataque']::text[], 'futsal', 'Media cancha de futsal. El cierre abre al ala, el pívot da la cara y descarga de primera mientras el ala ataca en diagonal el espacio entre los dos defensores. Remate al primer toque. Empezar con defensores pasivos y luego activos. Rotar puestos cada tres repeticiones y hacerlo por las dos bandas.',
   '{"players":[{"key":"slot#0","slot_label":"Cierre","x":50,"y":71.2,"jersey_number":4},{"key":"slot#1","slot_label":"Ala izq.","x":27.3,"y":57.7,"jersey_number":7},{"key":"slot#2","slot_label":"Ala der.","x":72.7,"y":57.7,"jersey_number":10},{"key":"slot#3","slot_label":"Pívot","x":50,"y":30.7,"jersey_number":9}],"arrows":[{"type":"opponent","x1":57.1,"y1":40.4,"x2":57.1,"y2":40.4,"color":"red"},{"type":"opponent","x1":42.9,"y1":40.4,"x2":42.9,"y2":40.4,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"ball_path","x1":50,"y1":71.2,"x2":72.7,"y2":57.7,"color":"yellow","kind":"pase"},{"type":"arrow","x1":50,"y1":30.7,"x2":62.8,"y2":34.6,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":71.2},{"key":"slot#1","x":27.3,"y":57.7},{"key":"slot#2","x":72.7,"y":57.7},{"key":"slot#3","x":50,"y":30.7}],"ball":{"x":50,"y":69.7},"arrows":[{"type":"opponent","x1":57.1,"y1":40.4,"x2":57.1,"y2":40.4,"color":"red"},{"type":"opponent","x1":42.9,"y1":40.4,"x2":42.9,"y2":40.4,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"ball_path","x1":50,"y1":71.2,"x2":72.7,"y2":57.7,"color":"yellow","kind":"pase"},{"type":"arrow","x1":50,"y1":30.7,"x2":62.8,"y2":34.6,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":69.3},{"key":"slot#1","x":27.3,"y":55.8},{"key":"slot#2","x":72.7,"y":57.7},{"key":"slot#3","x":62.8,"y":34.6}],"ball":{"x":72.7,"y":56.2},"arrows":[{"type":"opponent","x1":57.1,"y1":40.4,"x2":57.1,"y2":40.4,"color":"red"},{"type":"opponent","x1":42.9,"y1":40.4,"x2":42.9,"y2":40.4,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"ball_path","x1":72.7,"y1":57.7,"x2":62.8,"y2":34.6,"color":"yellow","kind":"pase"},{"type":"arrow","x1":72.7,"y1":57.7,"x2":58.5,"y2":24.9,"color":"white"},{"type":"arrow","x1":27.3,"y1":55.8,"x2":35.8,"y2":23,"color":"white"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":65.4},{"key":"slot#1","x":35.8,"y":23},{"key":"slot#2","x":58.5,"y":24.9},{"key":"slot#3","x":62.8,"y":34.6}],"ball":{"x":62.8,"y":33.1},"arrows":[{"type":"opponent","x1":55.7,"y1":38.4,"x2":55.7,"y2":38.4,"color":"red"},{"type":"opponent","x1":45.7,"y1":30.7,"x2":45.7,"y2":30.7,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"ball_path","x1":62.8,"y1":34.6,"x2":58.5,"y2":24.9,"color":"yellow","kind":"pase"}]},{"id":"f4","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":63.5},{"key":"slot#1","x":37.2,"y":19.1},{"key":"slot#2","x":58.5,"y":24.9},{"key":"slot#3","x":61.4,"y":36.5}],"ball":{"x":58.5,"y":23.4},"arrows":[{"type":"opponent","x1":55.7,"y1":38.4,"x2":55.7,"y2":38.4,"color":"red"},{"type":"opponent","x1":45.7,"y1":30.7,"x2":45.7,"y2":30.7,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"ball_path","x1":58.5,"y1":24.9,"x2":52.8,"y2":2.7,"color":"red","kind":"remate"}]}]}'::jsonb),
  ('5b1b0000-0000-4000-8000-000000000014'::uuid, 'Defensa en rombo: basculación y ayudas', 'Mover el rombo defensivo hacia el lado del balón: presión al poseedor, cobertura del compañero y cierre del pase al pívot.', 15, 'Sub-12 en adelante', '2 balones, 8 petos, 4 platillos',
   ARRAY['defensa', 'basculación', 'presión', 'táctico']::text[], 'futsal', 'Cuatro defensores en rombo y el arquero contra cuatro atacantes que mueven el balón por fuera. A cada pase el más cercano presiona, el cierre cubre y el ala del lado contrario cierra por dentro. El entrenador detiene la jugada y corrige distancias (3 a 4 m entre defensores).',
   '{"players":[{"key":"slot#0","slot_label":"Arquero","x":50,"y":93.4,"jersey_number":1},{"key":"slot#1","slot_label":"Pívot","x":50,"y":51.9,"jersey_number":9},{"key":"slot#2","slot_label":"Ala izq.","x":34.4,"y":63.5,"jersey_number":7},{"key":"slot#3","slot_label":"Ala der.","x":65.6,"y":63.5,"jersey_number":10},{"key":"slot#4","slot_label":"Cierre","x":50,"y":77,"jersey_number":4}],"arrows":[{"type":"opponent","x1":50,"y1":40.4,"x2":50,"y2":40.4,"color":"red"},{"type":"opponent","x1":23,"y1":55.8,"x2":23,"y2":55.8,"color":"red"},{"type":"opponent","x1":77,"y1":55.8,"x2":77,"y2":55.8,"color":"red"},{"type":"opponent","x1":50,"y1":84.7,"x2":50,"y2":84.7,"color":"red"},{"type":"ball_path","x1":50,"y1":40.4,"x2":77,"y2":55.8,"color":"yellow","kind":"pase"},{"type":"arrow","x1":65.6,"y1":63.5,"x2":71.3,"y2":59.6,"color":"white"},{"type":"arrow","x1":50,"y1":51.9,"x2":58.5,"y2":57.7,"color":"white"},{"type":"arrow","x1":50,"y1":77,"x2":57.1,"y2":78.9,"color":"white"},{"type":"arrow","x1":34.4,"y1":63.5,"x2":44.3,"y2":71.2,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":93.4},{"key":"slot#1","x":50,"y":51.9},{"key":"slot#2","x":34.4,"y":63.5},{"key":"slot#3","x":65.6,"y":63.5},{"key":"slot#4","x":50,"y":77}],"ball":{"x":50,"y":38.4},"arrows":[{"type":"opponent","x1":50,"y1":40.4,"x2":50,"y2":40.4,"color":"red"},{"type":"opponent","x1":23,"y1":55.8,"x2":23,"y2":55.8,"color":"red"},{"type":"opponent","x1":77,"y1":55.8,"x2":77,"y2":55.8,"color":"red"},{"type":"opponent","x1":50,"y1":84.7,"x2":50,"y2":84.7,"color":"red"},{"type":"ball_path","x1":50,"y1":40.4,"x2":77,"y2":55.8,"color":"yellow","kind":"pase"},{"type":"arrow","x1":65.6,"y1":63.5,"x2":71.3,"y2":59.6,"color":"white"},{"type":"arrow","x1":50,"y1":51.9,"x2":58.5,"y2":57.7,"color":"white"},{"type":"arrow","x1":50,"y1":77,"x2":57.1,"y2":78.9,"color":"white"},{"type":"arrow","x1":34.4,"y1":63.5,"x2":44.3,"y2":71.2,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":54.3,"y":93.4},{"key":"slot#1","x":58.5,"y":57.7},{"key":"slot#2","x":44.3,"y":71.2},{"key":"slot#3","x":71.3,"y":59.6},{"key":"slot#4","x":57.1,"y":78.9}],"ball":{"x":77,"y":53.9},"arrows":[{"type":"opponent","x1":50,"y1":40.4,"x2":50,"y2":40.4,"color":"red"},{"type":"opponent","x1":23,"y1":55.8,"x2":23,"y2":55.8,"color":"red"},{"type":"opponent","x1":77,"y1":55.8,"x2":77,"y2":55.8,"color":"red"},{"type":"opponent","x1":52.8,"y1":84.7,"x2":52.8,"y2":84.7,"color":"red"},{"type":"text","x1":75.6,"y1":47.1,"x2":75.6,"y2":47.1,"color":"white","size":0.9,"text":"Presiona"},{"type":"text","x1":68.5,"y1":82.8,"x2":68.5,"y2":82.8,"color":"white","size":0.9,"text":"Cubre"},{"type":"ball_path","x1":77,"y1":55.8,"x2":50,"y2":40.4,"color":"yellow","kind":"pase"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":93.4},{"key":"slot#1","x":50,"y":51.9},{"key":"slot#2","x":34.4,"y":63.5},{"key":"slot#3","x":65.6,"y":63.5},{"key":"slot#4","x":50,"y":77}],"ball":{"x":50,"y":38.4},"arrows":[{"type":"opponent","x1":50,"y1":40.4,"x2":50,"y2":40.4,"color":"red"},{"type":"opponent","x1":23,"y1":55.8,"x2":23,"y2":55.8,"color":"red"},{"type":"opponent","x1":77,"y1":55.8,"x2":77,"y2":55.8,"color":"red"},{"type":"opponent","x1":50,"y1":84.7,"x2":50,"y2":84.7,"color":"red"},{"type":"text","x1":50,"y1":46.1,"x2":50,"y2":46.1,"color":"white","size":0.9,"text":"Vuelve el rombo"}]}]}'::jsonb),
  ('5b1b0000-0000-4000-8000-000000000015'::uuid, 'Saque de banda con bloqueo', 'Generar un remate claro desde el saque de banda en campo rival con el bloqueo del pívot y un desmarque de apoyo.', 15, 'Sub-12 en adelante', '1 arco, 8 balones, petos',
   ARRAY['balón parado', 'saque de banda', 'bloqueo', 'remate']::text[], 'futsal', 'Saque de banda a la altura de la línea de 10 m del rival. El ala saca, el pívot bloquea al defensor del cierre y el cierre recibe de frente para rematar. El otro ala ataca el segundo palo para el rebote. Practicar por las dos bandas y cambiar la señal del saque.',
   '{"players":[{"key":"slot#0","slot_label":"Sacador","x":84.8,"y":30.7,"jersey_number":10},{"key":"slot#1","slot_label":"Cierre","x":50,"y":46.1,"jersey_number":4},{"key":"slot#2","slot_label":"Pívot","x":54.3,"y":23,"jersey_number":9},{"key":"slot#3","slot_label":"Ala izq.","x":31.5,"y":32.6,"jersey_number":7}],"arrows":[{"type":"opponent","x1":50,"y1":40.4,"x2":50,"y2":40.4,"color":"red"},{"type":"opponent","x1":58.5,"y1":17.2,"x2":58.5,"y2":17.2,"color":"red"},{"type":"opponent","x1":36.5,"y1":26.8,"x2":36.5,"y2":26.8,"color":"red"},{"type":"opponent","x1":75.6,"y1":32.6,"x2":75.6,"y2":32.6,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"arrow","x1":54.3,"y1":23,"x2":51.4,"y2":37.5,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":84.8,"y":30.7},{"key":"slot#1","x":50,"y":46.1},{"key":"slot#2","x":54.3,"y":23},{"key":"slot#3","x":31.5,"y":32.6}],"ball":{"x":84.1,"y":30.7},"arrows":[{"type":"opponent","x1":50,"y1":40.4,"x2":50,"y2":40.4,"color":"red"},{"type":"opponent","x1":58.5,"y1":17.2,"x2":58.5,"y2":17.2,"color":"red"},{"type":"opponent","x1":36.5,"y1":26.8,"x2":36.5,"y2":26.8,"color":"red"},{"type":"opponent","x1":75.6,"y1":32.6,"x2":75.6,"y2":32.6,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"arrow","x1":54.3,"y1":23,"x2":51.4,"y2":37.5,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":84.8,"y":30.7},{"key":"slot#1","x":50,"y":46.1},{"key":"slot#2","x":51.4,"y":37.5},{"key":"slot#3","x":31.5,"y":32.6}],"ball":{"x":84.1,"y":30.7},"arrows":[{"type":"opponent","x1":50,"y1":40.4,"x2":50,"y2":40.4,"color":"red"},{"type":"opponent","x1":58.5,"y1":17.2,"x2":58.5,"y2":17.2,"color":"red"},{"type":"opponent","x1":36.5,"y1":26.8,"x2":36.5,"y2":26.8,"color":"red"},{"type":"opponent","x1":75.6,"y1":32.6,"x2":75.6,"y2":32.6,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"text","x1":34.4,"y1":44.2,"x2":34.4,"y2":44.2,"color":"white","size":0.9,"text":"Bloqueo"},{"type":"curve","x1":50,"y1":46.1,"x2":61.4,"y2":30.7,"color":"white"},{"type":"ball_path","x1":84.8,"y1":30.7,"x2":61.4,"y2":30.7,"color":"yellow","kind":"pase"},{"type":"arrow","x1":31.5,"y1":32.6,"x2":38.6,"y2":15.3,"color":"white"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":84.8,"y":30.7},{"key":"slot#1","x":61.4,"y":30.7},{"key":"slot#2","x":51.4,"y":37.5},{"key":"slot#3","x":38.6,"y":15.3}],"ball":{"x":61.4,"y":29.2},"arrows":[{"type":"opponent","x1":50,"y1":41.3,"x2":50,"y2":41.3,"color":"red"},{"type":"opponent","x1":54.3,"y1":24.9,"x2":54.3,"y2":24.9,"color":"red"},{"type":"opponent","x1":37.2,"y1":23,"x2":37.2,"y2":23,"color":"red"},{"type":"opponent","x1":75.6,"y1":32.6,"x2":75.6,"y2":32.6,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"ball_path","x1":61.4,"y1":30.7,"x2":47.2,"y2":2.7,"color":"red","kind":"remate"}]}]}'::jsonb),
  ('5b1b0000-0000-4000-8000-000000000016'::uuid, 'Recepción en W, armado y ataque por zona 4', 'Recibir el saque con un pase alto y preciso al armador y terminar la jugada con el ataque por zona 4.', 20, 'Sub-12 en adelante', 'Red, 10 balones, 6 platillos',
   ARRAY['recepción', 'armado', 'ataque', 'táctico']::text[], 'voleibol', 'El entrenador o un compañero saca desde el otro campo. El equipo recibe en W, el líbero o el receptor pasa alto al armador cerca de la red y el armador coloca a zona 4. El atacante abre hacia afuera para tener carrera de impulso. Rotar después de cada tres saques.',
   '{"players":[{"key":"slot#0","slot_label":"Armador","x":63.8,"y":53.4,"jersey_number":1},{"key":"slot#1","slot_label":"Receptor z4","x":27.4,"y":63.6,"jersey_number":4},{"key":"slot#2","slot_label":"Central","x":50,"y":67.1,"jersey_number":3},{"key":"slot#3","slot_label":"Receptor z2","x":72.6,"y":63.6,"jersey_number":2},{"key":"slot#4","slot_label":"Receptor z5","x":37.4,"y":80.7,"jersey_number":5},{"key":"slot#5","slot_label":"Líbero","x":62.6,"y":80.7,"jersey_number":6}],"arrows":[{"type":"opponent","x1":68.9,"y1":2.2,"x2":68.9,"y2":2.2,"color":"red"},{"type":"ball_path","x1":68.9,"y1":3.1,"x2":62.6,"y2":79,"color":"red","kind":"remate"}],"frames":[{"id":"f1","duration_ms":1400,"players":[{"key":"slot#0","x":63.8,"y":53.4},{"key":"slot#1","x":27.4,"y":63.6},{"key":"slot#2","x":50,"y":67.1},{"key":"slot#3","x":72.6,"y":63.6},{"key":"slot#4","x":37.4,"y":80.7},{"key":"slot#5","x":62.6,"y":80.7}],"ball":{"x":68.9,"y":3.9},"arrows":[{"type":"opponent","x1":68.9,"y1":2.2,"x2":68.9,"y2":2.2,"color":"red"},{"type":"ball_path","x1":68.9,"y1":3.1,"x2":62.6,"y2":79,"color":"red","kind":"remate"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":63.8,"y":53.4},{"key":"slot#1","x":27.4,"y":63.6},{"key":"slot#2","x":50,"y":67.1},{"key":"slot#3","x":72.6,"y":63.6},{"key":"slot#4","x":37.4,"y":80.7},{"key":"slot#5","x":62.6,"y":80.7}],"ball":{"x":62.6,"y":79.2},"arrows":[{"type":"opponent","x1":68.9,"y1":2.2,"x2":68.9,"y2":2.2,"color":"red"},{"type":"ball_path","x1":62.6,"y1":80.7,"x2":60.1,"y2":53.4,"color":"yellow","kind":"pase"},{"type":"arrow","x1":63.8,"y1":53.4,"x2":60.1,"y2":54.3,"color":"white"},{"type":"arrow","x1":27.4,"y1":63.6,"x2":23.6,"y2":70.5,"color":"white"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":60.1,"y":54.3},{"key":"slot#1","x":23.6,"y":70.5},{"key":"slot#2","x":50,"y":67.1},{"key":"slot#3","x":72.6,"y":63.6},{"key":"slot#4","x":37.4,"y":80.7},{"key":"slot#5","x":62.6,"y":80.7}],"ball":{"x":60.1,"y":52.8},"arrows":[{"type":"opponent","x1":50,"y1":15.9,"x2":50,"y2":15.9,"color":"red"},{"type":"ball_path","x1":60.1,"y1":54.3,"x2":27.4,"y2":52.6,"color":"yellow","kind":"pase"},{"type":"curve","x1":23.6,"y1":70.5,"x2":28.6,"y2":55.1,"color":"white"}]},{"id":"f4","duration_ms":1200,"players":[{"key":"slot#0","x":60.1,"y":54.3},{"key":"slot#1","x":28.6,"y":55.1},{"key":"slot#2","x":46.2,"y":61.9},{"key":"slot#3","x":68.9,"y":61.9},{"key":"slot#4","x":37.4,"y":75.6},{"key":"slot#5","x":56.3,"y":79}],"ball":{"x":28.6,"y":51.7},"arrows":[{"type":"opponent","x1":50,"y1":15.9,"x2":50,"y2":15.9,"color":"red"},{"type":"ball_path","x1":28.6,"y1":53.4,"x2":63.8,"y2":24.4,"color":"red","kind":"remate"}]}]}'::jsonb),
  ('5b1b0000-0000-4000-8000-000000000017'::uuid, 'Bloqueo doble y defensa detrás del bloqueo', 'Formar el bloqueo doble ante el ataque rival por la punta y ubicar a los defensores en los huecos que deja el bloqueo.', 20, 'Sub-13 en adelante', 'Red, 1 cajón o plataforma para el atacante, 10 balones',
   ARRAY['bloqueo', 'defensa', 'cobertura', 'táctico']::text[], 'voleibol', 'Un atacante rival remata desde su zona 4 (sobre un cajón en las categorías menores). El central se desplaza con paso lateral para cerrar el bloqueo con el punta; zona 1 defiende la línea, zona 5 la diagonal, zona 6 el fondo y el atacante de zona 4 cubre la finta. Tres remates y rotar.',
   '{"players":[{"key":"slot#0","slot_label":"Bloqueador z2","x":68.9,"y":55.1,"jersey_number":2},{"key":"slot#1","slot_label":"Central z3","x":50,"y":55.1,"jersey_number":3},{"key":"slot#2","slot_label":"Atacante z4","x":31.2,"y":56.8,"jersey_number":4},{"key":"slot#3","slot_label":"Defensor z1","x":68.9,"y":80.7,"jersey_number":1},{"key":"slot#4","slot_label":"Defensor z6","x":50,"y":82.4,"jersey_number":6},{"key":"slot#5","slot_label":"Defensor z5","x":31.2,"y":80.7,"jersey_number":5}],"arrows":[{"type":"opponent","x1":56.3,"y1":44.9,"x2":56.3,"y2":44.9,"color":"red"},{"type":"opponent","x1":72.6,"y1":41.5,"x2":72.6,"y2":41.5,"color":"red"},{"type":"ball_path","x1":56.3,"y1":44.9,"x2":72.6,"y2":41.5,"color":"yellow","kind":"pase"},{"type":"arrow","x1":50,"y1":55.1,"x2":63.8,"y2":53.4,"color":"white"},{"type":"arrow","x1":68.9,"y1":55.1,"x2":72.6,"y2":53.4,"color":"white"},{"type":"arrow","x1":31.2,"y1":56.8,"x2":41.2,"y2":63.6,"color":"white"},{"type":"arrow","x1":68.9,"y1":80.7,"x2":75.1,"y2":75.6,"color":"white"},{"type":"arrow","x1":31.2,"y1":80.7,"x2":33.7,"y2":72.2,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":68.9,"y":55.1},{"key":"slot#1","x":50,"y":55.1},{"key":"slot#2","x":31.2,"y":56.8},{"key":"slot#3","x":68.9,"y":80.7},{"key":"slot#4","x":50,"y":82.4},{"key":"slot#5","x":31.2,"y":80.7}],"ball":{"x":56.3,"y":43.2},"arrows":[{"type":"opponent","x1":56.3,"y1":44.9,"x2":56.3,"y2":44.9,"color":"red"},{"type":"opponent","x1":72.6,"y1":41.5,"x2":72.6,"y2":41.5,"color":"red"},{"type":"ball_path","x1":56.3,"y1":44.9,"x2":72.6,"y2":41.5,"color":"yellow","kind":"pase"},{"type":"arrow","x1":50,"y1":55.1,"x2":63.8,"y2":53.4,"color":"white"},{"type":"arrow","x1":68.9,"y1":55.1,"x2":72.6,"y2":53.4,"color":"white"},{"type":"arrow","x1":31.2,"y1":56.8,"x2":41.2,"y2":63.6,"color":"white"},{"type":"arrow","x1":68.9,"y1":80.7,"x2":75.1,"y2":75.6,"color":"white"},{"type":"arrow","x1":31.2,"y1":80.7,"x2":33.7,"y2":72.2,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":72.6,"y":52.6},{"key":"slot#1","x":65.1,"y":52.6},{"key":"slot#2","x":41.2,"y":63.6},{"key":"slot#3","x":75.1,"y":75.6},{"key":"slot#4","x":51.3,"y":84.1},{"key":"slot#5","x":33.7,"y":72.2}],"ball":{"x":72.6,"y":39.8},"arrows":[{"type":"opponent","x1":56.3,"y1":44.9,"x2":56.3,"y2":44.9,"color":"red"},{"type":"opponent","x1":72.6,"y1":41.5,"x2":72.6,"y2":41.5,"color":"red"},{"type":"zone","x1":60.1,"y1":50,"x2":77.6,"y2":56,"color":"blue"},{"type":"ball_path","x1":72.6,"y1":41.5,"x2":34.9,"y2":73,"color":"red","kind":"remate"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":72.6,"y":52.6},{"key":"slot#1","x":65.1,"y":52.6},{"key":"slot#2","x":41.2,"y":63.6},{"key":"slot#3","x":75.1,"y":75.6},{"key":"slot#4","x":51.3,"y":84.1},{"key":"slot#5","x":33.7,"y":72.2}],"ball":{"x":33.7,"y":70.7},"arrows":[{"type":"opponent","x1":56.3,"y1":44.9,"x2":56.3,"y2":44.9,"color":"red"},{"type":"opponent","x1":72.6,"y1":41.5,"x2":72.6,"y2":41.5,"color":"red"},{"type":"ball_path","x1":33.7,"y1":72.2,"x2":56.3,"y2":56.8,"color":"yellow","kind":"pase"}]}]}'::jsonb),
  ('5b1b0000-0000-4000-8000-000000000018'::uuid, 'Saque al blanco por zonas', 'Sacar con dirección a una zona elegida del campo rival (zonas 1, 6 y 5) con el gesto completo.', 15, 'Sub-9 en adelante', 'Red (puede ser baja), 3 aros, 12 balones',
   ARRAY['saque', 'técnica', 'iniciación', 'precisión']::text[], 'voleibol', 'Tres aros en el fondo del campo rival marcan las zonas 1, 6 y 5. Cada jugador saca desde detrás de la línea de fondo y canta la zona antes de sacar. Un punto si el balón cae cerca del aro y tres si cae adentro. Los más pequeños sacan por abajo y desde más cerca de la red.',
   '{"players":[{"key":"slot#0","slot_label":"Sacador 1","x":34.3,"y":96.9,"jersey_number":7},{"key":"slot#1","slot_label":"Sacador 2","x":50,"y":96.9,"jersey_number":8},{"key":"slot#2","slot_label":"Sacador 3","x":65.7,"y":96.9,"jersey_number":9}],"arrows":[{"type":"ring","x1":31.2,"y1":21,"x2":31.2,"y2":21,"color":"yellow"},{"type":"ring","x1":50,"y1":21,"x2":50,"y2":21,"color":"yellow"},{"type":"ring","x1":68.9,"y1":21,"x2":68.9,"y2":21,"color":"yellow"},{"type":"text","x1":31.2,"y1":12.5,"x2":31.2,"y2":12.5,"color":"white","size":0.8,"text":"Zona 1"},{"type":"text","x1":50,"y1":12.5,"x2":50,"y2":12.5,"color":"white","size":0.8,"text":"Zona 6"},{"type":"text","x1":68.9,"y1":12.5,"x2":68.9,"y2":12.5,"color":"white","size":0.8,"text":"Zona 5"},{"type":"ball_path","x1":34.3,"y1":96.1,"x2":31.2,"y2":21,"color":"red","kind":"remate"}],"frames":[{"id":"f1","duration_ms":1400,"players":[{"key":"slot#0","x":34.3,"y":96.9},{"key":"slot#1","x":50,"y":96.9},{"key":"slot#2","x":65.7,"y":96.9}],"ball":{"x":34.3,"y":95.4},"arrows":[{"type":"ring","x1":31.2,"y1":21,"x2":31.2,"y2":21,"color":"yellow"},{"type":"ring","x1":50,"y1":21,"x2":50,"y2":21,"color":"yellow"},{"type":"ring","x1":68.9,"y1":21,"x2":68.9,"y2":21,"color":"yellow"},{"type":"text","x1":31.2,"y1":12.5,"x2":31.2,"y2":12.5,"color":"white","size":0.8,"text":"Zona 1"},{"type":"text","x1":50,"y1":12.5,"x2":50,"y2":12.5,"color":"white","size":0.8,"text":"Zona 6"},{"type":"text","x1":68.9,"y1":12.5,"x2":68.9,"y2":12.5,"color":"white","size":0.8,"text":"Zona 5"},{"type":"ball_path","x1":34.3,"y1":96.1,"x2":31.2,"y2":21,"color":"red","kind":"remate"}]},{"id":"f2","duration_ms":1400,"players":[{"key":"slot#0","x":34.3,"y":96.9},{"key":"slot#1","x":50,"y":96.9},{"key":"slot#2","x":65.7,"y":96.9}],"ball":{"x":50,"y":95.4},"arrows":[{"type":"ring","x1":31.2,"y1":21,"x2":31.2,"y2":21,"color":"yellow"},{"type":"ring","x1":50,"y1":21,"x2":50,"y2":21,"color":"yellow"},{"type":"ring","x1":68.9,"y1":21,"x2":68.9,"y2":21,"color":"yellow"},{"type":"text","x1":31.2,"y1":12.5,"x2":31.2,"y2":12.5,"color":"white","size":0.8,"text":"Zona 1"},{"type":"text","x1":50,"y1":12.5,"x2":50,"y2":12.5,"color":"white","size":0.8,"text":"Zona 6"},{"type":"text","x1":68.9,"y1":12.5,"x2":68.9,"y2":12.5,"color":"white","size":0.8,"text":"Zona 5"},{"type":"ball_path","x1":50,"y1":96.1,"x2":50,"y2":21,"color":"red","kind":"remate"}]},{"id":"f3","duration_ms":1400,"players":[{"key":"slot#0","x":34.3,"y":96.9},{"key":"slot#1","x":50,"y":96.9},{"key":"slot#2","x":65.7,"y":96.9}],"ball":{"x":65.7,"y":95.4},"arrows":[{"type":"ring","x1":31.2,"y1":21,"x2":31.2,"y2":21,"color":"yellow"},{"type":"ring","x1":50,"y1":21,"x2":50,"y2":21,"color":"yellow"},{"type":"ring","x1":68.9,"y1":21,"x2":68.9,"y2":21,"color":"yellow"},{"type":"text","x1":31.2,"y1":12.5,"x2":31.2,"y2":12.5,"color":"white","size":0.8,"text":"Zona 1"},{"type":"text","x1":50,"y1":12.5,"x2":50,"y2":12.5,"color":"white","size":0.8,"text":"Zona 6"},{"type":"text","x1":68.9,"y1":12.5,"x2":68.9,"y2":12.5,"color":"white","size":0.8,"text":"Zona 5"},{"type":"ball_path","x1":65.7,"y1":96.1,"x2":68.9,"y2":21,"color":"red","kind":"remate"}]}]}'::jsonb),
  ('5b1b0000-0000-4000-8000-000000000019'::uuid, 'Bloqueo directo central (pick and roll)', 'Leer el bloqueo directo: el base usa la pantalla y decide entre penetrar o pasar al pívot que continúa hacia el aro.', 20, 'Sub-13 en adelante', '1 canasta, 5 balones, petos',
   ARRAY['bloqueo directo', 'pick and roll', 'ataque', 'finalización', 'táctico']::text[], 'baloncesto', 'Cinco contra cinco en media cancha. El pívot sube a poner el bloqueo al defensor del base. El base sale pegado a la pantalla hacia el lado libre; el pívot continúa hacia el aro. Si los dos defensores van al base, pase al pívot; si no, penetración y bandeja. Los demás abren espacio.',
   '{"players":[{"key":"slot#0","slot_label":"Base","x":50,"y":38.4,"jersey_number":1},{"key":"slot#1","slot_label":"Escolta","x":78.9,"y":23,"jersey_number":2},{"key":"slot#2","slot_label":"Alero","x":19.5,"y":11.4,"jersey_number":3},{"key":"slot#3","slot_label":"Ala-pívot","x":28.7,"y":26.8,"jersey_number":4},{"key":"slot#4","slot_label":"Pívot","x":59.1,"y":21.1,"jersey_number":5}],"arrows":[{"type":"opponent","x1":50,"y1":32.6,"x2":50,"y2":32.6,"color":"red"},{"type":"opponent","x1":74.4,"y1":21.1,"x2":74.4,"y2":21.1,"color":"red"},{"type":"opponent","x1":22.6,"y1":14.3,"x2":22.6,"y2":14.3,"color":"red"},{"type":"opponent","x1":32.5,"y1":23,"x2":32.5,"y2":23,"color":"red"},{"type":"opponent","x1":57.6,"y1":15.3,"x2":57.6,"y2":15.3,"color":"red"},{"type":"arrow","x1":59.1,"y1":21.1,"x2":54.6,"y2":35.5,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":38.4},{"key":"slot#1","x":78.9,"y":23},{"key":"slot#2","x":19.5,"y":11.4},{"key":"slot#3","x":28.7,"y":26.8},{"key":"slot#4","x":59.1,"y":21.1}],"ball":{"x":50,"y":36.9},"arrows":[{"type":"opponent","x1":50,"y1":32.6,"x2":50,"y2":32.6,"color":"red"},{"type":"opponent","x1":74.4,"y1":21.1,"x2":74.4,"y2":21.1,"color":"red"},{"type":"opponent","x1":22.6,"y1":14.3,"x2":22.6,"y2":14.3,"color":"red"},{"type":"opponent","x1":32.5,"y1":23,"x2":32.5,"y2":23,"color":"red"},{"type":"opponent","x1":57.6,"y1":15.3,"x2":57.6,"y2":15.3,"color":"red"},{"type":"arrow","x1":59.1,"y1":21.1,"x2":54.6,"y2":35.5,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":38.4},{"key":"slot#1","x":78.9,"y":23},{"key":"slot#2","x":19.5,"y":11.4},{"key":"slot#3","x":28.7,"y":26.8},{"key":"slot#4","x":54.6,"y":35.5}],"ball":{"x":50,"y":36.9},"arrows":[{"type":"opponent","x1":50,"y1":32.6,"x2":50,"y2":32.6,"color":"red"},{"type":"opponent","x1":74.4,"y1":21.1,"x2":74.4,"y2":21.1,"color":"red"},{"type":"opponent","x1":22.6,"y1":14.3,"x2":22.6,"y2":14.3,"color":"red"},{"type":"opponent","x1":32.5,"y1":23,"x2":32.5,"y2":23,"color":"red"},{"type":"opponent","x1":57.6,"y1":15.3,"x2":57.6,"y2":15.3,"color":"red"},{"type":"text","x1":62.2,"y1":42.3,"x2":62.2,"y2":42.3,"color":"white","size":0.9,"text":"Bloqueo"},{"type":"curve","x1":50,"y1":38.4,"x2":65.2,"y2":24.9,"color":"white"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":65.2,"y":24.9},{"key":"slot#1","x":78.9,"y":23},{"key":"slot#2","x":19.5,"y":11.4},{"key":"slot#3","x":28.7,"y":26.8},{"key":"slot#4","x":54.6,"y":35.5}],"ball":{"x":65.2,"y":23.4},"arrows":[{"type":"opponent","x1":59.1,"y1":28.8,"x2":59.1,"y2":28.8,"color":"red"},{"type":"opponent","x1":74.4,"y1":21.1,"x2":74.4,"y2":21.1,"color":"red"},{"type":"opponent","x1":22.6,"y1":14.3,"x2":22.6,"y2":14.3,"color":"red"},{"type":"opponent","x1":34.8,"y1":21.1,"x2":34.8,"y2":21.1,"color":"red"},{"type":"opponent","x1":62.2,"y1":21.1,"x2":62.2,"y2":21.1,"color":"red"},{"type":"arrow","x1":54.6,"y1":35.5,"x2":51.5,"y2":15.3,"color":"white"},{"type":"ball_path","x1":65.2,"y1":24.9,"x2":51.5,"y2":16.2,"color":"yellow","kind":"pase"}]},{"id":"f4","duration_ms":1200,"players":[{"key":"slot#0","x":65.2,"y":24.9},{"key":"slot#1","x":78.9,"y":23},{"key":"slot#2","x":19.5,"y":11.4},{"key":"slot#3","x":28.7,"y":26.8},{"key":"slot#4","x":51.5,"y":15.3}],"ball":{"x":51.5,"y":13.8},"arrows":[{"type":"opponent","x1":59.1,"y1":28.8,"x2":59.1,"y2":28.8,"color":"red"},{"type":"opponent","x1":74.4,"y1":21.1,"x2":74.4,"y2":21.1,"color":"red"},{"type":"opponent","x1":22.6,"y1":14.3,"x2":22.6,"y2":14.3,"color":"red"},{"type":"opponent","x1":34.8,"y1":21.1,"x2":34.8,"y2":21.1,"color":"red"},{"type":"opponent","x1":62.2,"y1":21.1,"x2":62.2,"y2":21.1,"color":"red"},{"type":"ball_path","x1":51.5,"y1":15.3,"x2":50,"y2":7.6,"color":"red","kind":"remate"}]}]}'::jsonb),
  ('5b1b0000-0000-4000-8000-000000000020'::uuid, 'Contraataque 3v2 en tres carriles', 'Después del rebote defensivo, ocupar los tres carriles y llegar con ventaja numérica a la canasta rival.', 15, 'Sub-11 en adelante', '1 canasta en cada lado, 6 balones, 4 platillos para marcar los carriles',
   ARRAY['transición ofensiva', 'contraataque', 'superioridad', 'pase']::text[], 'baloncesto', 'El base sale botando por el carril central y los aleros corren abiertos por las bandas. Dos defensores esperan en tándem. El base fija al primer defensor antes de la línea de tres y pasa al alero libre, que termina en bandeja. Si el segundo defensor cierra al alero, pase al otro lado.',
   '{"players":[{"key":"slot#0","slot_label":"Base","x":50,"y":80.9,"jersey_number":1},{"key":"slot#1","slot_label":"Alero izq.","x":21.1,"y":82.8,"jersey_number":3},{"key":"slot#2","slot_label":"Alero der.","x":78.9,"y":82.8,"jersey_number":2}],"arrows":[{"type":"marker","x1":37.1,"y1":54.8,"x2":37.1,"y2":54.8,"color":"orange"},{"type":"marker","x1":62.9,"y1":54.8,"x2":62.9,"y2":54.8,"color":"orange"},{"type":"marker","x1":37.1,"y1":35.5,"x2":37.1,"y2":35.5,"color":"orange"},{"type":"marker","x1":62.9,"y1":35.5,"x2":62.9,"y2":35.5,"color":"orange"},{"type":"opponent","x1":50,"y1":26.8,"x2":50,"y2":26.8,"color":"red"},{"type":"opponent","x1":50,"y1":13.3,"x2":50,"y2":13.3,"color":"red"},{"type":"arrow","x1":50,"y1":80.9,"x2":50,"y2":50,"color":"white"},{"type":"arrow","x1":21.1,"y1":82.8,"x2":19.5,"y2":42.3,"color":"white"},{"type":"arrow","x1":78.9,"y1":82.8,"x2":80.5,"y2":42.3,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":80.9},{"key":"slot#1","x":21.1,"y":82.8},{"key":"slot#2","x":78.9,"y":82.8}],"ball":{"x":50,"y":79.4},"arrows":[{"type":"marker","x1":37.1,"y1":54.8,"x2":37.1,"y2":54.8,"color":"orange"},{"type":"marker","x1":62.9,"y1":54.8,"x2":62.9,"y2":54.8,"color":"orange"},{"type":"marker","x1":37.1,"y1":35.5,"x2":37.1,"y2":35.5,"color":"orange"},{"type":"marker","x1":62.9,"y1":35.5,"x2":62.9,"y2":35.5,"color":"orange"},{"type":"opponent","x1":50,"y1":26.8,"x2":50,"y2":26.8,"color":"red"},{"type":"opponent","x1":50,"y1":13.3,"x2":50,"y2":13.3,"color":"red"},{"type":"arrow","x1":50,"y1":80.9,"x2":50,"y2":50,"color":"white"},{"type":"arrow","x1":21.1,"y1":82.8,"x2":19.5,"y2":42.3,"color":"white"},{"type":"arrow","x1":78.9,"y1":82.8,"x2":80.5,"y2":42.3,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":50},{"key":"slot#1","x":19.5,"y":42.3},{"key":"slot#2","x":80.5,"y":42.3}],"ball":{"x":50,"y":48.5},"arrows":[{"type":"marker","x1":37.1,"y1":54.8,"x2":37.1,"y2":54.8,"color":"orange"},{"type":"marker","x1":62.9,"y1":54.8,"x2":62.9,"y2":54.8,"color":"orange"},{"type":"marker","x1":37.1,"y1":35.5,"x2":37.1,"y2":35.5,"color":"orange"},{"type":"marker","x1":62.9,"y1":35.5,"x2":62.9,"y2":35.5,"color":"orange"},{"type":"opponent","x1":50,"y1":26.8,"x2":50,"y2":26.8,"color":"red"},{"type":"opponent","x1":50,"y1":13.3,"x2":50,"y2":13.3,"color":"red"},{"type":"arrow","x1":50,"y1":50,"x2":50,"y2":34.6,"color":"white"},{"type":"arrow","x1":19.5,"y1":42.3,"x2":22.6,"y2":19.1,"color":"white"},{"type":"arrow","x1":80.5,"y1":42.3,"x2":77.4,"y2":19.1,"color":"white"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":34.6},{"key":"slot#1","x":22.6,"y":19.1},{"key":"slot#2","x":77.4,"y":19.1}],"ball":{"x":50,"y":33.1},"arrows":[{"type":"marker","x1":37.1,"y1":54.8,"x2":37.1,"y2":54.8,"color":"orange"},{"type":"marker","x1":62.9,"y1":54.8,"x2":62.9,"y2":54.8,"color":"orange"},{"type":"marker","x1":37.1,"y1":35.5,"x2":37.1,"y2":35.5,"color":"orange"},{"type":"marker","x1":62.9,"y1":35.5,"x2":62.9,"y2":35.5,"color":"orange"},{"type":"opponent","x1":50,"y1":29.7,"x2":50,"y2":29.7,"color":"red"},{"type":"opponent","x1":59.1,"y1":14.3,"x2":59.1,"y2":14.3,"color":"red"},{"type":"ball_path","x1":50,"y1":34.6,"x2":22.6,"y2":19.1,"color":"yellow","kind":"pase"}]},{"id":"f4","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":34.6},{"key":"slot#1","x":36.3,"y":12.4},{"key":"slot#2","x":72.8,"y":17.2}],"ball":{"x":36.3,"y":10.9},"arrows":[{"type":"marker","x1":37.1,"y1":54.8,"x2":37.1,"y2":54.8,"color":"orange"},{"type":"marker","x1":62.9,"y1":54.8,"x2":62.9,"y2":54.8,"color":"orange"},{"type":"marker","x1":37.1,"y1":35.5,"x2":37.1,"y2":35.5,"color":"orange"},{"type":"marker","x1":62.9,"y1":35.5,"x2":62.9,"y2":35.5,"color":"orange"},{"type":"opponent","x1":50,"y1":29.7,"x2":50,"y2":29.7,"color":"red"},{"type":"opponent","x1":59.1,"y1":14.3,"x2":59.1,"y2":14.3,"color":"red"},{"type":"ball_path","x1":36.3,"y1":12.4,"x2":50,"y2":7.6,"color":"red","kind":"remate"}]}]}'::jsonb),
  ('5b1b0000-0000-4000-8000-000000000021'::uuid, 'Rueda de bandejas', 'Automatizar la bandeja con los dos pasos y el pase de salida desde el rebote.', 12, 'Sub-7 en adelante', '1 canasta, 1 balón por jugador de la fila de bandeja, 1 platillo',
   ARRAY['bandeja', 'técnica', 'iniciación', 'finalización', 'calentamiento']::text[], 'baloncesto', 'Dos filas: bandeja (con balón) en el ala derecha y rebote en el ala izquierda. El primero de bandeja bota hacia el aro y lanza con los dos pasos; el de rebote toma el balón y lo pasa al siguiente de la fila de bandeja. Cada uno cambia de fila. Después de cinco minutos, por la izquierda.',
   '{"players":[{"key":"slot#0","slot_label":"Bandeja 1","x":72.8,"y":36.5},{"key":"slot#1","slot_label":"Bandeja 2","x":77.4,"y":43.2},{"key":"slot#2","slot_label":"Bandeja 3","x":82,"y":50},{"key":"slot#3","slot_label":"Rebote 1","x":25.6,"y":30.7},{"key":"slot#4","slot_label":"Rebote 2","x":19.5,"y":40.4}],"arrows":[{"type":"marker","x1":71.3,"y1":32.6,"x2":71.3,"y2":32.6,"color":"orange"},{"type":"curve","x1":72.8,"y1":36.5,"x2":57.6,"y2":14.3,"color":"white"},{"type":"arrow","x1":25.6,"y1":30.7,"x2":43.9,"y2":11.4,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":72.8,"y":36.5},{"key":"slot#1","x":77.4,"y":43.2},{"key":"slot#2","x":82,"y":50},{"key":"slot#3","x":25.6,"y":30.7},{"key":"slot#4","x":19.5,"y":40.4}],"ball":{"x":72.8,"y":35},"arrows":[{"type":"marker","x1":71.3,"y1":32.6,"x2":71.3,"y2":32.6,"color":"orange"},{"type":"curve","x1":72.8,"y1":36.5,"x2":57.6,"y2":14.3,"color":"white"},{"type":"arrow","x1":25.6,"y1":30.7,"x2":43.9,"y2":11.4,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":57.6,"y":14.3},{"key":"slot#1","x":77.4,"y":43.2},{"key":"slot#2","x":82,"y":50},{"key":"slot#3","x":43.9,"y":11.4},{"key":"slot#4","x":19.5,"y":40.4}],"ball":{"x":57.6,"y":12.8},"arrows":[{"type":"marker","x1":71.3,"y1":32.6,"x2":71.3,"y2":32.6,"color":"orange"},{"type":"ball_path","x1":57.6,"y1":14.3,"x2":50,"y2":7.6,"color":"red","kind":"remate"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":57.6,"y":14.3},{"key":"slot#1","x":77.4,"y":43.2},{"key":"slot#2","x":82,"y":50},{"key":"slot#3","x":45.4,"y":10.4},{"key":"slot#4","x":19.5,"y":40.4}],"ball":{"x":45.4,"y":8.9},"arrows":[{"type":"marker","x1":71.3,"y1":32.6,"x2":71.3,"y2":32.6,"color":"orange"},{"type":"ball_path","x1":45.4,"y1":10.4,"x2":77.4,"y2":43.2,"color":"yellow","kind":"pase"},{"type":"arrow","x1":57.6,"y1":14.3,"x2":24.1,"y2":46.1,"color":"white"},{"type":"curve","x1":45.4,"y1":10.4,"x2":83.5,"y2":55.8,"color":"white"}]}]}'::jsonb),
  ('5b1b0000-0000-4000-8000-000000000022'::uuid, 'Contraataque directo desde el portero', 'Salir rápido después de la parada: pase largo del portero al extremo que corre por la banda y lanzamiento en ventaja.', 15, 'Sub-11 en adelante', '2 porterías, 8 balones, platillos',
   ARRAY['transición ofensiva', 'contraataque', 'pase', 'lanzamiento']::text[], 'balonmano', 'El entrenador lanza al portero. En el momento de la parada los dos extremos arrancan por la banda. El portero pasa largo al extremo más adelantado, que recibe en carrera y lanza antes de que llegue el defensor que repliega. Alternar el lado y sumar un defensor cuando salga fácil.',
   '{"players":[{"key":"slot#0","slot_label":"Portero","x":50,"y":93.4,"jersey_number":1},{"key":"slot#1","slot_label":"Extremo izq.","x":20.2,"y":78.9,"jersey_number":6},{"key":"slot#2","slot_label":"Extremo der.","x":79.8,"y":78.9,"jersey_number":11}],"arrows":[{"type":"opponent","x1":58.5,"y1":54.8,"x2":58.5,"y2":54.8,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"arrow","x1":20.2,"y1":78.9,"x2":21.6,"y2":32.6,"color":"white"},{"type":"arrow","x1":79.8,"y1":78.9,"x2":78.4,"y2":42.3,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":93.4},{"key":"slot#1","x":20.2,"y":78.9},{"key":"slot#2","x":79.8,"y":78.9}],"ball":{"x":50,"y":91.9},"arrows":[{"type":"opponent","x1":58.5,"y1":54.8,"x2":58.5,"y2":54.8,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"arrow","x1":20.2,"y1":78.9,"x2":21.6,"y2":32.6,"color":"white"},{"type":"arrow","x1":79.8,"y1":78.9,"x2":78.4,"y2":42.3,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":93.4},{"key":"slot#1","x":21.6,"y":32.6},{"key":"slot#2","x":78.4,"y":42.3}],"ball":{"x":50,"y":91.9},"arrows":[{"type":"opponent","x1":54.3,"y1":42.3,"x2":54.3,"y2":42.3,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"ball_path","x1":50,"y1":93.4,"x2":22.3,"y2":30.7,"color":"yellow","kind":"pase"},{"type":"arrow","x1":21.6,"y1":32.6,"x2":30.1,"y2":23,"color":"white"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":93.4},{"key":"slot#1","x":30.1,"y":23},{"key":"slot#2","x":77,"y":34.6}],"ball":{"x":30.1,"y":21.5},"arrows":[{"type":"opponent","x1":45.7,"y1":30.7,"x2":45.7,"y2":30.7,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"ball_path","x1":30.1,"y1":23,"x2":47.2,"y2":2.7,"color":"red","kind":"remate"}]}]}'::jsonb),
  ('5b1b0000-0000-4000-8000-000000000023'::uuid, 'Cruce de central y lateral contra defensa 6:0', 'Atacar la defensa 6:0 con un cruce entre el central y el lateral derecho para lanzar desde 9 m con ventaja.', 20, 'Sub-13 en adelante', '1 portería, 8 balones, petos',
   ARRAY['ataque', 'cruce', 'lanzamiento', 'finalización', 'táctico']::text[], 'balonmano', 'Ataque 3:3 contra defensa 6:0. El central penetra en diagonal hacia el espacio entre el central y el lateral defensores; el lateral derecho cruza por detrás hacia el centro y recibe en carrera para lanzar por encima de la defensa. Si el defensor sale al lanzador, pase al pivote.',
   '{"players":[{"key":"slot#0","slot_label":"Extremo izq.","x":17.3,"y":13.3,"jersey_number":6},{"key":"slot#1","slot_label":"Lateral izq.","x":30.1,"y":30.7,"jersey_number":9},{"key":"slot#2","slot_label":"Central","x":50,"y":34.6,"jersey_number":10},{"key":"slot#3","slot_label":"Lateral der.","x":69.9,"y":30.7,"jersey_number":8},{"key":"slot#4","slot_label":"Extremo der.","x":82.7,"y":13.3,"jersey_number":11},{"key":"slot#5","slot_label":"Pivote","x":50,"y":19.1,"jersey_number":7}],"arrows":[{"type":"opponent","x1":21.6,"y1":16.2,"x2":21.6,"y2":16.2,"color":"red"},{"type":"opponent","x1":32.9,"y1":21.1,"x2":32.9,"y2":21.1,"color":"red"},{"type":"opponent","x1":44.3,"y1":21.1,"x2":44.3,"y2":21.1,"color":"red"},{"type":"opponent","x1":55.7,"y1":21.1,"x2":55.7,"y2":21.1,"color":"red"},{"type":"opponent","x1":67.1,"y1":21.1,"x2":67.1,"y2":21.1,"color":"red"},{"type":"opponent","x1":78.4,"y1":16.2,"x2":78.4,"y2":16.2,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"arrow","x1":50,"y1":34.6,"x2":58.5,"y2":28.8,"color":"white"},{"type":"curve","x1":69.9,"y1":30.7,"x2":47.2,"y2":28.8,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":17.3,"y":13.3},{"key":"slot#1","x":30.1,"y":30.7},{"key":"slot#2","x":50,"y":34.6},{"key":"slot#3","x":69.9,"y":30.7},{"key":"slot#4","x":82.7,"y":13.3},{"key":"slot#5","x":50,"y":19.1}],"ball":{"x":50,"y":33.1},"arrows":[{"type":"opponent","x1":21.6,"y1":16.2,"x2":21.6,"y2":16.2,"color":"red"},{"type":"opponent","x1":32.9,"y1":21.1,"x2":32.9,"y2":21.1,"color":"red"},{"type":"opponent","x1":44.3,"y1":21.1,"x2":44.3,"y2":21.1,"color":"red"},{"type":"opponent","x1":55.7,"y1":21.1,"x2":55.7,"y2":21.1,"color":"red"},{"type":"opponent","x1":67.1,"y1":21.1,"x2":67.1,"y2":21.1,"color":"red"},{"type":"opponent","x1":78.4,"y1":16.2,"x2":78.4,"y2":16.2,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"arrow","x1":50,"y1":34.6,"x2":58.5,"y2":28.8,"color":"white"},{"type":"curve","x1":69.9,"y1":30.7,"x2":47.2,"y2":28.8,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":17.3,"y":13.3},{"key":"slot#1","x":30.1,"y":30.7},{"key":"slot#2","x":58.5,"y":28.8},{"key":"slot#3","x":47.2,"y":28.8},{"key":"slot#4","x":82.7,"y":13.3},{"key":"slot#5","x":50,"y":19.1}],"ball":{"x":58.5,"y":27.3},"arrows":[{"type":"opponent","x1":21.6,"y1":16.2,"x2":21.6,"y2":16.2,"color":"red"},{"type":"opponent","x1":32.9,"y1":21.1,"x2":32.9,"y2":21.1,"color":"red"},{"type":"opponent","x1":44.3,"y1":21.1,"x2":44.3,"y2":21.1,"color":"red"},{"type":"opponent","x1":57.1,"y1":23,"x2":57.1,"y2":23,"color":"red"},{"type":"opponent","x1":64.2,"y1":22,"x2":64.2,"y2":22,"color":"red"},{"type":"opponent","x1":78.4,"y1":16.2,"x2":78.4,"y2":16.2,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"ball_path","x1":58.5,"y1":28.8,"x2":47.2,"y2":28.8,"color":"yellow","kind":"pase"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":17.3,"y":13.3},{"key":"slot#1","x":30.1,"y":30.7},{"key":"slot#2","x":58.5,"y":28.8},{"key":"slot#3","x":47.2,"y":26.8},{"key":"slot#4","x":82.7,"y":13.3},{"key":"slot#5","x":50,"y":19.1}],"ball":{"x":47.2,"y":25.3},"arrows":[{"type":"opponent","x1":21.6,"y1":16.2,"x2":21.6,"y2":16.2,"color":"red"},{"type":"opponent","x1":32.9,"y1":21.1,"x2":32.9,"y2":21.1,"color":"red"},{"type":"opponent","x1":44.3,"y1":21.1,"x2":44.3,"y2":21.1,"color":"red"},{"type":"opponent","x1":57.1,"y1":23,"x2":57.1,"y2":23,"color":"red"},{"type":"opponent","x1":64.2,"y1":22,"x2":64.2,"y2":22,"color":"red"},{"type":"opponent","x1":78.4,"y1":16.2,"x2":78.4,"y2":16.2,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"ball_path","x1":47.2,"y1":26.8,"x2":45.7,"y2":2.7,"color":"red","kind":"remate"}]}]}'::jsonb),
  ('5b1b0000-0000-4000-8000-000000000024'::uuid, 'Defensa 6:0: desplazamientos y salida al lanzador', 'Desplazarse en bloque según el balón y salir a tiempo al lanzador de 9 m sin dejar huecos en la línea.', 20, 'Sub-13 en adelante', '6 balones, petos, platillos en la línea de 9 m',
   ARRAY['defensa', 'basculación', 'blocaje', 'táctico']::text[], 'balonmano', 'Seis defensores en la línea de 6 m y seis atacantes que circulan el balón. Cuando el balón llega a un lateral, su defensor sale a 8-9 m con los brazos arriba para blocar y los compañeros cierran hacia ese lado. Cuando el balón se va, vuelve a la línea. Cambiar los roles cada dos minutos.',
   '{"players":[{"key":"slot#0","slot_label":"Portero","x":50,"y":94.4,"jersey_number":1},{"key":"slot#1","slot_label":"Extremo izq.","x":19.4,"y":87.6,"jersey_number":2},{"key":"slot#2","slot_label":"Lateral izq.","x":31.5,"y":80.9,"jersey_number":3},{"key":"slot#3","slot_label":"Central izq.","x":43.6,"y":78.9,"jersey_number":4},{"key":"slot#4","slot_label":"Central der.","x":56.4,"y":78.9,"jersey_number":5},{"key":"slot#5","slot_label":"Lateral der.","x":68.5,"y":80.9,"jersey_number":6},{"key":"slot#6","slot_label":"Extremo der.","x":80.6,"y":87.6,"jersey_number":7}],"arrows":[{"type":"opponent","x1":17.3,"y1":90.5,"x2":17.3,"y2":90.5,"color":"red"},{"type":"opponent","x1":31.5,"y1":67.4,"x2":31.5,"y2":67.4,"color":"red"},{"type":"opponent","x1":50,"y1":65.4,"x2":50,"y2":65.4,"color":"red"},{"type":"opponent","x1":68.5,"y1":67.4,"x2":68.5,"y2":67.4,"color":"red"},{"type":"opponent","x1":82.7,"y1":90.5,"x2":82.7,"y2":90.5,"color":"red"},{"type":"opponent","x1":50,"y1":83.8,"x2":50,"y2":83.8,"color":"red"},{"type":"ball_path","x1":50,"y1":65.4,"x2":68.5,"y2":67.4,"color":"yellow","kind":"pase"},{"type":"arrow","x1":68.5,"y1":80.9,"x2":68.5,"y2":73.2,"color":"white"},{"type":"arrow","x1":56.4,"y1":78.9,"x2":59.9,"y2":79.9,"color":"white"},{"type":"arrow","x1":80.6,"y1":87.6,"x2":77,"y2":84.7,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":94.4},{"key":"slot#1","x":19.4,"y":87.6},{"key":"slot#2","x":31.5,"y":80.9},{"key":"slot#3","x":43.6,"y":78.9},{"key":"slot#4","x":56.4,"y":78.9},{"key":"slot#5","x":68.5,"y":80.9},{"key":"slot#6","x":80.6,"y":87.6}],"ball":{"x":50,"y":63.5},"arrows":[{"type":"opponent","x1":17.3,"y1":90.5,"x2":17.3,"y2":90.5,"color":"red"},{"type":"opponent","x1":31.5,"y1":67.4,"x2":31.5,"y2":67.4,"color":"red"},{"type":"opponent","x1":50,"y1":65.4,"x2":50,"y2":65.4,"color":"red"},{"type":"opponent","x1":68.5,"y1":67.4,"x2":68.5,"y2":67.4,"color":"red"},{"type":"opponent","x1":82.7,"y1":90.5,"x2":82.7,"y2":90.5,"color":"red"},{"type":"opponent","x1":50,"y1":83.8,"x2":50,"y2":83.8,"color":"red"},{"type":"ball_path","x1":50,"y1":65.4,"x2":68.5,"y2":67.4,"color":"yellow","kind":"pase"},{"type":"arrow","x1":68.5,"y1":80.9,"x2":68.5,"y2":73.2,"color":"white"},{"type":"arrow","x1":56.4,"y1":78.9,"x2":59.9,"y2":79.9,"color":"white"},{"type":"arrow","x1":80.6,"y1":87.6,"x2":77,"y2":84.7,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":52.8,"y":94.4},{"key":"slot#1","x":21.6,"y":86.7},{"key":"slot#2","x":34.4,"y":80.9},{"key":"slot#3","x":47.2,"y":79.9},{"key":"slot#4","x":59.9,"y":79.9},{"key":"slot#5","x":68.5,"y":73.2},{"key":"slot#6","x":77,"y":84.7}],"ball":{"x":68.5,"y":65.4},"arrows":[{"type":"opponent","x1":17.3,"y1":90.5,"x2":17.3,"y2":90.5,"color":"red"},{"type":"opponent","x1":31.5,"y1":67.4,"x2":31.5,"y2":67.4,"color":"red"},{"type":"opponent","x1":50,"y1":65.4,"x2":50,"y2":65.4,"color":"red"},{"type":"opponent","x1":68.5,"y1":67.4,"x2":68.5,"y2":67.4,"color":"red"},{"type":"opponent","x1":82.7,"y1":90.5,"x2":82.7,"y2":90.5,"color":"red"},{"type":"opponent","x1":50,"y1":83.8,"x2":50,"y2":83.8,"color":"red"},{"type":"text","x1":68.5,"y1":60.6,"x2":68.5,"y2":60.6,"color":"white","size":0.9,"text":"Blocaje"},{"type":"ball_path","x1":68.5,"y1":67.4,"x2":67.1,"y2":74.1,"color":"red","kind":"remate"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":52.8,"y":94.4},{"key":"slot#1","x":21.6,"y":86.7},{"key":"slot#2","x":34.4,"y":80.9},{"key":"slot#3","x":47.2,"y":79.9},{"key":"slot#4","x":59.9,"y":79.9},{"key":"slot#5","x":68.5,"y":73.2},{"key":"slot#6","x":77,"y":84.7}],"ball":{"x":68.5,"y":65.4},"arrows":[{"type":"opponent","x1":17.3,"y1":90.5,"x2":17.3,"y2":90.5,"color":"red"},{"type":"opponent","x1":31.5,"y1":67.4,"x2":31.5,"y2":67.4,"color":"red"},{"type":"opponent","x1":50,"y1":65.4,"x2":50,"y2":65.4,"color":"red"},{"type":"opponent","x1":68.5,"y1":67.4,"x2":68.5,"y2":67.4,"color":"red"},{"type":"opponent","x1":82.7,"y1":90.5,"x2":82.7,"y2":90.5,"color":"red"},{"type":"opponent","x1":50,"y1":83.8,"x2":50,"y2":83.8,"color":"red"},{"type":"ball_path","x1":68.5,"y1":67.4,"x2":50,"y2":65.4,"color":"yellow","kind":"pase"},{"type":"arrow","x1":68.5,"y1":73.2,"x2":68.5,"y2":80.9,"color":"white"}]}]}'::jsonb),
  ('5b1b0000-0000-4000-8000-000000000025'::uuid, 'Rondo 4v1 en cuadrado', 'Pasar a uno o dos toques con buen perfil y dar apoyos a los dos lados del poseedor.', 10, 'Sub-7 en adelante', '4 platillos, 2 balones, 1 peto',
   ARRAY['rondo', 'posesión', 'calentamiento', 'pase']::text[], 'futbol5', 'Cuadrado de 8×8 m. Cuatro por fuera, uno adentro. Máximo dos toques. Los que no tienen el balón se mueven sobre su lado para dar línea de pase. Si el de adentro toca el balón, entra el que perdió. Variante: un toque o pase prohibido al de al lado.',
   '{"players":[{"key":"slot#0","slot_label":"Exterior 1","x":50,"y":40.4,"jersey_number":1},{"key":"slot#1","slot_label":"Exterior 2","x":64.2,"y":50,"jersey_number":2},{"key":"slot#2","slot_label":"Exterior 3","x":50,"y":59.6,"jersey_number":3},{"key":"slot#3","slot_label":"Exterior 4","x":35.8,"y":50,"jersey_number":4}],"arrows":[{"type":"zone","x1":35.8,"y1":40.4,"x2":64.2,"y2":59.6,"color":"yellow"},{"type":"cone","x1":35.8,"y1":40.4,"x2":35.8,"y2":40.4,"color":"orange"},{"type":"cone","x1":64.2,"y1":40.4,"x2":64.2,"y2":40.4,"color":"orange"},{"type":"cone","x1":64.2,"y1":59.6,"x2":64.2,"y2":59.6,"color":"orange"},{"type":"cone","x1":35.8,"y1":59.6,"x2":35.8,"y2":59.6,"color":"orange"},{"type":"opponent","x1":48.2,"y1":49,"x2":48.2,"y2":49,"color":"red"},{"type":"ball_path","x1":50,"y1":40.4,"x2":64.2,"y2":50,"color":"yellow","kind":"pase"},{"type":"arrow","x1":35.8,"y1":50,"x2":35.8,"y2":44.2,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":40.4},{"key":"slot#1","x":64.2,"y":50},{"key":"slot#2","x":50,"y":59.6},{"key":"slot#3","x":35.8,"y":50}],"ball":{"x":50,"y":38.9},"arrows":[{"type":"zone","x1":35.8,"y1":40.4,"x2":64.2,"y2":59.6,"color":"yellow"},{"type":"cone","x1":35.8,"y1":40.4,"x2":35.8,"y2":40.4,"color":"orange"},{"type":"cone","x1":64.2,"y1":40.4,"x2":64.2,"y2":40.4,"color":"orange"},{"type":"cone","x1":64.2,"y1":59.6,"x2":64.2,"y2":59.6,"color":"orange"},{"type":"cone","x1":35.8,"y1":59.6,"x2":35.8,"y2":59.6,"color":"orange"},{"type":"opponent","x1":48.2,"y1":49,"x2":48.2,"y2":49,"color":"red"},{"type":"ball_path","x1":50,"y1":40.4,"x2":64.2,"y2":50,"color":"yellow","kind":"pase"},{"type":"arrow","x1":35.8,"y1":50,"x2":35.8,"y2":44.2,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":40.4},{"key":"slot#1","x":64.2,"y":50},{"key":"slot#2","x":50,"y":59.6},{"key":"slot#3","x":35.8,"y":44.2}],"ball":{"x":64.2,"y":48.5},"arrows":[{"type":"zone","x1":35.8,"y1":40.4,"x2":64.2,"y2":59.6,"color":"yellow"},{"type":"cone","x1":35.8,"y1":40.4,"x2":35.8,"y2":40.4,"color":"orange"},{"type":"cone","x1":64.2,"y1":40.4,"x2":64.2,"y2":40.4,"color":"orange"},{"type":"cone","x1":64.2,"y1":59.6,"x2":64.2,"y2":59.6,"color":"orange"},{"type":"cone","x1":35.8,"y1":59.6,"x2":35.8,"y2":59.6,"color":"orange"},{"type":"opponent","x1":57.1,"y1":50,"x2":57.1,"y2":50,"color":"red"},{"type":"ball_path","x1":64.2,"y1":50,"x2":50,"y2":59.6,"color":"yellow","kind":"pase"},{"type":"arrow","x1":50,"y1":40.4,"x2":42.9,"y2":40.4,"color":"white"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":42.9,"y":40.4},{"key":"slot#1","x":64.2,"y":50},{"key":"slot#2","x":50,"y":59.6},{"key":"slot#3","x":35.8,"y":44.2}],"ball":{"x":50,"y":58.1},"arrows":[{"type":"zone","x1":35.8,"y1":40.4,"x2":64.2,"y2":59.6,"color":"yellow"},{"type":"cone","x1":35.8,"y1":40.4,"x2":35.8,"y2":40.4,"color":"orange"},{"type":"cone","x1":64.2,"y1":40.4,"x2":64.2,"y2":40.4,"color":"orange"},{"type":"cone","x1":64.2,"y1":59.6,"x2":64.2,"y2":59.6,"color":"orange"},{"type":"cone","x1":35.8,"y1":59.6,"x2":35.8,"y2":59.6,"color":"orange"},{"type":"opponent","x1":52.7,"y1":55.8,"x2":52.7,"y2":55.8,"color":"red"},{"type":"ball_path","x1":50,"y1":59.6,"x2":35.8,"y2":44.2,"color":"yellow","kind":"pase"}]}]}'::jsonb),
  ('5b1b0000-0000-4000-8000-000000000026'::uuid, '2v1 y remate en fútbol 5', 'Fijar al defensor con la conducción y decidir entre pase o remate en superioridad numérica.', 15, 'Sub-9 en adelante', '1 arco, 8 balones, platillos',
   ARRAY['finalización', 'superioridad', 'remate', 'ataque']::text[], 'futbol5', 'Dos atacantes contra un defensor y el arquero desde la mitad de la cancha. El poseedor conduce hacia el defensor; si el defensor lo cierra, pasa al compañero que ataca el segundo palo; si no, remata. Rotar roles cada tres repeticiones.',
   '{"players":[{"key":"slot#0","slot_label":"Atacante 1","x":37.6,"y":55.8,"jersey_number":10},{"key":"slot#1","slot_label":"Atacante 2","x":66,"y":51.9,"jersey_number":9}],"arrows":[{"type":"opponent","x1":51.8,"y1":34.6,"x2":51.8,"y2":34.6,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"arrow","x1":37.6,"y1":55.8,"x2":46.4,"y2":38.4,"color":"white"},{"type":"curve","x1":66,"y1":51.9,"x2":62.4,"y2":23,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":37.6,"y":55.8},{"key":"slot#1","x":66,"y":51.9}],"ball":{"x":37.6,"y":54.3},"arrows":[{"type":"opponent","x1":51.8,"y1":34.6,"x2":51.8,"y2":34.6,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"arrow","x1":37.6,"y1":55.8,"x2":46.4,"y2":38.4,"color":"white"},{"type":"curve","x1":66,"y1":51.9,"x2":62.4,"y2":23,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":46.4,"y":38.4},{"key":"slot#1","x":62.4,"y":23}],"ball":{"x":46.4,"y":36.9},"arrows":[{"type":"opponent","x1":48.2,"y1":32.6,"x2":48.2,"y2":32.6,"color":"red"},{"type":"opponent","x1":50,"y1":4.7,"x2":50,"y2":4.7,"color":"yellow"},{"type":"ball_path","x1":46.4,"y1":38.4,"x2":62.4,"y2":23,"color":"yellow","kind":"pase"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":46.4,"y":38.4},{"key":"slot#1","x":62.4,"y":23}],"ball":{"x":62.4,"y":21.5},"arrows":[{"type":"opponent","x1":48.2,"y1":32.6,"x2":48.2,"y2":32.6,"color":"red"},{"type":"opponent","x1":55.3,"y1":5.6,"x2":55.3,"y2":5.6,"color":"yellow"},{"type":"ball_path","x1":62.4,"y1":23,"x2":45.6,"y2":2.7,"color":"red","kind":"remate"}]}]}'::jsonb),
  ('5b1b0000-0000-4000-8000-000000000027'::uuid, 'Calentamiento por estaciones de coordinación', 'Activar el cuerpo y mejorar la coordinación con escalera, aros, vallas bajas y zigzag entre conos.', 15, 'Sub-6 en adelante', '1 escalera de coordinación, 3 vallas bajas, 3 aros, 5 conos',
   ARRAY['calentamiento', 'coordinación', 'iniciación', 'técnica']::text[], 'generico', 'Circuito en U: escalera (un pie en cada cuadro), saltos con pies juntos en los aros, vallas bajas y zigzag entre conos para volver a la salida. Salen con cinco segundos de diferencia. Sirve para cualquier deporte: al final del circuito se puede agregar el gesto técnico (conducción, bote, pase).',
   '{"players":[{"key":"slot#0","slot_label":"Jugador 1","x":21.2,"y":88.6},{"key":"slot#1","slot_label":"Jugador 2","x":11.6,"y":93.4},{"key":"slot#2","slot_label":"Jugador 3","x":30.8,"y":93.4}],"arrows":[{"type":"ladder","x1":21.2,"y1":69.3,"x2":21.2,"y2":69.3,"color":"yellow","size":1.4},{"type":"ring","x1":21.2,"y1":44.2,"x2":21.2,"y2":44.2,"color":"blue"},{"type":"ring","x1":27,"y1":34.6,"x2":27,"y2":34.6,"color":"blue"},{"type":"ring","x1":21.2,"y1":24.9,"x2":21.2,"y2":24.9,"color":"blue"},{"type":"hurdle","x1":40.4,"y1":15.3,"x2":40.4,"y2":15.3,"color":"orange"},{"type":"hurdle","x1":51.9,"y1":15.3,"x2":51.9,"y2":15.3,"color":"orange"},{"type":"hurdle","x1":63.4,"y1":15.3,"x2":63.4,"y2":15.3,"color":"orange"},{"type":"cone","x1":78.8,"y1":28.8,"x2":78.8,"y2":28.8,"color":"orange"},{"type":"cone","x1":71.1,"y1":42.3,"x2":71.1,"y2":42.3,"color":"orange"},{"type":"cone","x1":78.8,"y1":55.8,"x2":78.8,"y2":55.8,"color":"orange"},{"type":"cone","x1":71.1,"y1":69.3,"x2":71.1,"y2":69.3,"color":"orange"},{"type":"cone","x1":78.8,"y1":82.8,"x2":78.8,"y2":82.8,"color":"orange"},{"type":"arrow","x1":21.2,"y1":86.7,"x2":21.2,"y2":51.9,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":21.2,"y":88.6},{"key":"slot#1","x":11.6,"y":93.4},{"key":"slot#2","x":30.8,"y":93.4}],"ball":null,"arrows":[{"type":"ladder","x1":21.2,"y1":69.3,"x2":21.2,"y2":69.3,"color":"yellow","size":1.4},{"type":"ring","x1":21.2,"y1":44.2,"x2":21.2,"y2":44.2,"color":"blue"},{"type":"ring","x1":27,"y1":34.6,"x2":27,"y2":34.6,"color":"blue"},{"type":"ring","x1":21.2,"y1":24.9,"x2":21.2,"y2":24.9,"color":"blue"},{"type":"hurdle","x1":40.4,"y1":15.3,"x2":40.4,"y2":15.3,"color":"orange"},{"type":"hurdle","x1":51.9,"y1":15.3,"x2":51.9,"y2":15.3,"color":"orange"},{"type":"hurdle","x1":63.4,"y1":15.3,"x2":63.4,"y2":15.3,"color":"orange"},{"type":"cone","x1":78.8,"y1":28.8,"x2":78.8,"y2":28.8,"color":"orange"},{"type":"cone","x1":71.1,"y1":42.3,"x2":71.1,"y2":42.3,"color":"orange"},{"type":"cone","x1":78.8,"y1":55.8,"x2":78.8,"y2":55.8,"color":"orange"},{"type":"cone","x1":71.1,"y1":69.3,"x2":71.1,"y2":69.3,"color":"orange"},{"type":"cone","x1":78.8,"y1":82.8,"x2":78.8,"y2":82.8,"color":"orange"},{"type":"arrow","x1":21.2,"y1":86.7,"x2":21.2,"y2":51.9,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":21.2,"y":51.9},{"key":"slot#1","x":21.2,"y":88.6},{"key":"slot#2","x":30.8,"y":93.4}],"ball":null,"arrows":[{"type":"ladder","x1":21.2,"y1":69.3,"x2":21.2,"y2":69.3,"color":"yellow","size":1.4},{"type":"ring","x1":21.2,"y1":44.2,"x2":21.2,"y2":44.2,"color":"blue"},{"type":"ring","x1":27,"y1":34.6,"x2":27,"y2":34.6,"color":"blue"},{"type":"ring","x1":21.2,"y1":24.9,"x2":21.2,"y2":24.9,"color":"blue"},{"type":"hurdle","x1":40.4,"y1":15.3,"x2":40.4,"y2":15.3,"color":"orange"},{"type":"hurdle","x1":51.9,"y1":15.3,"x2":51.9,"y2":15.3,"color":"orange"},{"type":"hurdle","x1":63.4,"y1":15.3,"x2":63.4,"y2":15.3,"color":"orange"},{"type":"cone","x1":78.8,"y1":28.8,"x2":78.8,"y2":28.8,"color":"orange"},{"type":"cone","x1":71.1,"y1":42.3,"x2":71.1,"y2":42.3,"color":"orange"},{"type":"cone","x1":78.8,"y1":55.8,"x2":78.8,"y2":55.8,"color":"orange"},{"type":"cone","x1":71.1,"y1":69.3,"x2":71.1,"y2":69.3,"color":"orange"},{"type":"cone","x1":78.8,"y1":82.8,"x2":78.8,"y2":82.8,"color":"orange"},{"type":"freehand","x1":21.2,"y1":15.3,"x2":75,"y2":51.9,"points":[21.2,51.9,21.2,44.2,27,34.6,21.2,24.9,28.9,15.3,40.4,15.3,51.9,15.3,65.4,15.3,75,19.1],"color":"white"},{"type":"arrow","x1":21.2,"y1":86.7,"x2":21.2,"y2":51.9,"color":"white"}]},{"id":"f3","duration_ms":1600,"players":[{"key":"slot#0","x":75,"y":19.1},{"key":"slot#1","x":21.2,"y":51.9},{"key":"slot#2","x":21.2,"y":88.6}],"ball":null,"arrows":[{"type":"ladder","x1":21.2,"y1":69.3,"x2":21.2,"y2":69.3,"color":"yellow","size":1.4},{"type":"ring","x1":21.2,"y1":44.2,"x2":21.2,"y2":44.2,"color":"blue"},{"type":"ring","x1":27,"y1":34.6,"x2":27,"y2":34.6,"color":"blue"},{"type":"ring","x1":21.2,"y1":24.9,"x2":21.2,"y2":24.9,"color":"blue"},{"type":"hurdle","x1":40.4,"y1":15.3,"x2":40.4,"y2":15.3,"color":"orange"},{"type":"hurdle","x1":51.9,"y1":15.3,"x2":51.9,"y2":15.3,"color":"orange"},{"type":"hurdle","x1":63.4,"y1":15.3,"x2":63.4,"y2":15.3,"color":"orange"},{"type":"cone","x1":78.8,"y1":28.8,"x2":78.8,"y2":28.8,"color":"orange"},{"type":"cone","x1":71.1,"y1":42.3,"x2":71.1,"y2":42.3,"color":"orange"},{"type":"cone","x1":78.8,"y1":55.8,"x2":78.8,"y2":55.8,"color":"orange"},{"type":"cone","x1":71.1,"y1":69.3,"x2":71.1,"y2":69.3,"color":"orange"},{"type":"cone","x1":78.8,"y1":82.8,"x2":78.8,"y2":82.8,"color":"orange"},{"type":"freehand","x1":42.3,"y1":19.1,"x2":78.8,"y2":93.4,"points":[75,19.1,78.8,28.8,71.1,42.3,78.8,55.8,71.1,69.3,78.8,82.8,65.4,92.4,42.3,93.4],"color":"yellow"}]}]}'::jsonb),
  ('5b1b0000-0000-4000-8000-000000000028'::uuid, 'El pañuelo: reacción y velocidad', 'Mejorar la velocidad de reacción y la toma de decisiones con un juego tradicional por equipos.', 10, 'Sub-6 en adelante', '1 pañuelo o peto, platillos para las dos líneas',
   ARRAY['calentamiento', 'coordinación', 'velocidad de reacción', 'juego']::text[], 'generico', 'Dos equipos en líneas enfrentadas, cada jugador con un número. El entrenador sostiene el pañuelo en el centro y canta un número: los dos que lo tienen salen. Quien coge el pañuelo y vuelve a su línea sin ser tocado gana el punto. Variantes: cantar una suma, o salir desde sentados o de espaldas.',
   '{"players":[{"key":"slot#0","slot_label":"Azul 1","x":32.7,"y":82.8,"jersey_number":1},{"key":"slot#1","slot_label":"Azul 2","x":50,"y":82.8,"jersey_number":2},{"key":"slot#2","slot_label":"Azul 3","x":67.3,"y":82.8,"jersey_number":3},{"key":"slot#3","slot_label":"Rojo 1","x":32.7,"y":17.2,"jersey_number":1},{"key":"slot#4","slot_label":"Rojo 2","x":50,"y":17.2,"jersey_number":2},{"key":"slot#5","slot_label":"Rojo 3","x":67.3,"y":17.2,"jersey_number":3}],"arrows":[{"type":"marker","x1":21.2,"y1":86.7,"x2":21.2,"y2":86.7,"color":"blue"},{"type":"marker","x1":78.8,"y1":86.7,"x2":78.8,"y2":86.7,"color":"blue"},{"type":"marker","x1":21.2,"y1":13.3,"x2":21.2,"y2":13.3,"color":"red"},{"type":"marker","x1":78.8,"y1":13.3,"x2":78.8,"y2":13.3,"color":"red"},{"type":"marker","x1":50,"y1":50,"x2":50,"y2":50,"color":"pink","size":1.3},{"type":"text","x1":75,"y1":50,"x2":75,"y2":50,"color":"yellow","size":1,"text":"«¡El dos!»"},{"type":"arrow","x1":50,"y1":80.9,"x2":50,"y2":55.8,"color":"white"},{"type":"arrow","x1":50,"y1":19.1,"x2":50,"y2":44.2,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":32.7,"y":82.8},{"key":"slot#1","x":50,"y":82.8},{"key":"slot#2","x":67.3,"y":82.8},{"key":"slot#3","x":32.7,"y":17.2},{"key":"slot#4","x":50,"y":17.2},{"key":"slot#5","x":67.3,"y":17.2}],"ball":null,"arrows":[{"type":"marker","x1":21.2,"y1":86.7,"x2":21.2,"y2":86.7,"color":"blue"},{"type":"marker","x1":78.8,"y1":86.7,"x2":78.8,"y2":86.7,"color":"blue"},{"type":"marker","x1":21.2,"y1":13.3,"x2":21.2,"y2":13.3,"color":"red"},{"type":"marker","x1":78.8,"y1":13.3,"x2":78.8,"y2":13.3,"color":"red"},{"type":"marker","x1":50,"y1":50,"x2":50,"y2":50,"color":"pink","size":1.3},{"type":"text","x1":75,"y1":50,"x2":75,"y2":50,"color":"yellow","size":1,"text":"«¡El dos!»"},{"type":"arrow","x1":50,"y1":80.9,"x2":50,"y2":55.8,"color":"white"},{"type":"arrow","x1":50,"y1":19.1,"x2":50,"y2":44.2,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":32.7,"y":82.8},{"key":"slot#1","x":50,"y":55.8},{"key":"slot#2","x":67.3,"y":82.8},{"key":"slot#3","x":32.7,"y":17.2},{"key":"slot#4","x":50,"y":44.2},{"key":"slot#5","x":67.3,"y":17.2}],"ball":null,"arrows":[{"type":"marker","x1":21.2,"y1":86.7,"x2":21.2,"y2":86.7,"color":"blue"},{"type":"marker","x1":78.8,"y1":86.7,"x2":78.8,"y2":86.7,"color":"blue"},{"type":"marker","x1":21.2,"y1":13.3,"x2":21.2,"y2":13.3,"color":"red"},{"type":"marker","x1":78.8,"y1":13.3,"x2":78.8,"y2":13.3,"color":"red"},{"type":"marker","x1":50,"y1":50,"x2":50,"y2":50,"color":"pink","size":1.3},{"type":"arrow","x1":50,"y1":55.8,"x2":50,"y2":80.9,"color":"white"},{"type":"curve","x1":50,"y1":44.2,"x2":53.8,"y2":75.1,"color":"red"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":32.7,"y":82.8},{"key":"slot#1","x":50,"y":80.9},{"key":"slot#2","x":67.3,"y":82.8},{"key":"slot#3","x":32.7,"y":17.2},{"key":"slot#4","x":53.8,"y":73.2},{"key":"slot#5","x":67.3,"y":17.2}],"ball":null,"arrows":[{"type":"marker","x1":21.2,"y1":86.7,"x2":21.2,"y2":86.7,"color":"blue"},{"type":"marker","x1":78.8,"y1":86.7,"x2":78.8,"y2":86.7,"color":"blue"},{"type":"marker","x1":21.2,"y1":13.3,"x2":21.2,"y2":13.3,"color":"red"},{"type":"marker","x1":78.8,"y1":13.3,"x2":78.8,"y2":13.3,"color":"red"},{"type":"text","x1":50,"y1":92.4,"x2":50,"y2":92.4,"color":"yellow","size":0.9,"text":"Punto para los azules"}]}]}'::jsonb)
) AS v(id, name, objective, minutes, age_group, materials, tags, sport, description, board)
WHERE NOT EXISTS (
  SELECT 1 FROM public.training_exercises t
   WHERE t.school_id IS NULL
     AND t.sport = v.sport
     AND lower(btrim(t.name)) = lower(btrim(v.name))
)
ON CONFLICT (id) DO NOTHING;

COMMIT;


-- ───────────────────────────────────────────────────────────────────────────
-- [2/10] PIZARRA  ·  20261014111442_pizarra_ia_cupo_y_cache.sql
-- origen: pizarra-tp/integracion:supabase/migrations/20261014111442_pizarra_ia_cupo_y_cache.sql
-- ───────────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261014111442_pizarra_ia_cupo_y_cache.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261013165308
-- Objetivo: M3 de docs/specs/pizarra-multideporte-3d-ia.md («Analizar jugada» con
--   IA, decisión D6 y §6 Cobro). Cupo gratis mensual por escuela + paquetes de
--   análisis comprados + caché de análisis por hash de la jugada.
--
--   · tactical_ai_credits: una fila por (escuela, periodo 'YYYY-MM' hora Bogotá).
--     used = análisis gastados en el periodo; purchased = análisis comprados en
--     el periodo; free_quota = cupo gratis VIGENTE cuando se creó la fila (foto:
--     cambiar el cupo no reescribe meses pasados).
--     Los comprados NO vencen con el mes: el saldo pagado es
--       Σ purchased − Σ max(used − free_quota, 0)   (todas las filas de la escuela)
--     y se gasta primero el cupo gratis del mes, después lo comprado.
--   · tactical_ai_analyses: caché del resultado YA VALIDADO por el BFF (sin nombres
--     ni ids de atletas: las claves de jugador son p1..pN / r1..rN). Mismo
--     board_hash (sha256 de la jugada normalizada + deporte) en la misma escuela
--     = no se llama al modelo y no se descuenta cupo. Guarda los tokens de la
--     llamada para fijar el precio del paquete con el costo medido (§6).
--   · Contadores solo por RPC SECURITY DEFINER con SELECT … FOR UPDATE (regla del
--     repo). consume / refund / grant / balance: EXECUTE solo para service_role
--     (el BFF), salvo grant, que además acepta al super admin con su sesión.
--   · RLS: staff de la escuela (user_staff_school_ids(): sin padres ni atletas)
--     LEE su saldo y su historial; nadie escribe directo (sin policies de
--     escritura + REVOKE a authenticated/anon).
--   · llm_usage.feature acepta 'pizarra_ia' (antes: bot/ocr/transcripcion/sportbot)
--     para que cada análisis quede con su costo real en el informe de consumo.
--
--   PENDIENTE (no se inventa acá): el CHECK de tactical_board_events.event
--   (20261008183746) no tiene 'ai_analyze'. Cuando se quiera la métrica de uso del
--   botón, agregarlo en una migración nueva (y en TACTICAL_BOARD_EVENTS del front).
--
--   Helpers que se usan (deben existir vivos): user_staff_school_ids() → uuid[],
--   is_super_admin() → boolean, auth.jwt(). Mismo patrón de ANY ((SELECT …)::uuid[])
--   que 20261008183746 (el ANY sin cast falló con 42883 al aplicarse).
--
--   NO APLICADA (la base es la misma de producción). Para quien integre:
--   después de aplicarla correr `npm run seguridad:invariantes` y estos casos de
--   RLS (no hay scripts/rls-pruebas-pizarra.mjs en esta rama; agregarlos allí):
--     R1 anon:   select count(*) from tactical_ai_credits / tactical_ai_analyses → 0 filas o 42501.
--     R2 padre/atleta de la escuela E: select … where school_id = E → 0 filas.
--     R3 coach/staff de E: ve SOLO las filas de E (no las de otra escuela F).
--     R4 staff de E: insert/update/delete directo en las dos tablas → 42501.
--     R5 authenticated (coach, admin): rpc consume/refund/balance → 42501
--        (permission denied for function); solo service_role las ejecuta.
--     R6 authenticated no super admin: rpc grant_tactical_ai_credits → 42501.
--     R7 super admin: grant(E, 50) → ok, purchased +50 en el periodo actual.
--     R8 service_role: 16 consume seguidos en un mes nuevo → 15 ok (gratis),
--        el 16.º ok=false, needs_purchase=true; tras grant(E,50) el 16.º ok y
--        paid_remaining = 49. Concurrencia: 20 consume en paralelo con cupo 15
--        → exactamente 15 ok (FOR UPDATE).
--     R9 refund después de consume → used vuelve atrás, nunca < 0.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Cupo gratis mensual (spec §6: 15, configurable). Cambiarlo = migración nueva
--    que reemplace esta función; las filas ya creadas conservan su free_quota.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tactical_ai_free_quota()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT 15 $$;

REVOKE ALL ON FUNCTION public.tactical_ai_free_quota() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_free_quota() TO service_role;

-- Periodo actual en hora de Bogotá ('YYYY-MM'): el cupo se reinicia el 1.º del mes.
CREATE OR REPLACE FUNCTION public.tactical_ai_current_period()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM') $$;

REVOKE ALL ON FUNCTION public.tactical_ai_current_period() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_current_period() TO service_role;

-- -----------------------------------------------------------------------------
-- 1. Saldo por escuela y mes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tactical_ai_credits (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  period      text        NOT NULL,
  used        integer     NOT NULL DEFAULT 0,
  purchased   integer     NOT NULL DEFAULT 0,
  free_quota  integer     NOT NULL DEFAULT 15,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tactical_ai_credits_period_check     CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT tactical_ai_credits_used_check       CHECK (used >= 0),
  CONSTRAINT tactical_ai_credits_purchased_check  CHECK (purchased >= 0),
  CONSTRAINT tactical_ai_credits_free_quota_check CHECK (free_quota >= 0 AND free_quota <= 10000),
  CONSTRAINT tactical_ai_credits_school_period_key UNIQUE (school_id, period)
);

COMMENT ON TABLE public.tactical_ai_credits IS
  'M3 pizarra IA: análisis usados/comprados por escuela y mes (hora Bogotá). Mutada SOLO por RPC (consume/refund/grant). Spec: docs/specs/pizarra-multideporte-3d-ia.md §6';

-- -----------------------------------------------------------------------------
-- 2. Caché de análisis
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tactical_ai_analyses (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  team_id        uuid        REFERENCES public.teams(id) ON DELETE SET NULL,
  board_hash     text        NOT NULL,
  sport          text        NOT NULL,
  result         jsonb       NOT NULL,
  provider       text,
  model          text,
  input_tokens   integer     NOT NULL DEFAULT 0,
  output_tokens  integer     NOT NULL DEFAULT 0,
  created_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tactical_ai_analyses_hash_check   CHECK (board_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT tactical_ai_analyses_sport_check  CHECK (sport IN ('futbol', 'futbol7', 'futbol5', 'futsal', 'voleibol', 'baloncesto', 'balonmano')),
  CONSTRAINT tactical_ai_analyses_result_check CHECK (jsonb_typeof(result) = 'object' AND pg_column_size(result) <= 262144),
  CONSTRAINT tactical_ai_analyses_tokens_check CHECK (input_tokens >= 0 AND output_tokens >= 0),
  CONSTRAINT tactical_ai_analyses_provider_len CHECK (provider IS NULL OR char_length(provider) <= 40),
  CONSTRAINT tactical_ai_analyses_model_len    CHECK (model IS NULL OR char_length(model) <= 120),
  CONSTRAINT tactical_ai_analyses_school_hash_key UNIQUE (school_id, board_hash)
);

COMMENT ON TABLE public.tactical_ai_analyses IS
  'M3 pizarra IA: caché del análisis validado por (escuela, board_hash). Sin nombres ni ids de atletas (claves p1..pN / r1..rN). INSERT solo service_role (BFF).';

CREATE INDEX IF NOT EXISTS tactical_ai_analyses_school_created_idx
  ON public.tactical_ai_analyses (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tactical_ai_analyses_team_idx
  ON public.tactical_ai_analyses (team_id);

-- -----------------------------------------------------------------------------
-- 3. RLS: staff LEE lo suyo; nadie escribe directo.
-- -----------------------------------------------------------------------------
ALTER TABLE public.tactical_ai_credits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tactical_ai_analyses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tactical_ai_credits  FROM PUBLIC, anon;
REVOKE ALL ON public.tactical_ai_analyses FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tactical_ai_credits  FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tactical_ai_analyses FROM authenticated;
GRANT SELECT ON public.tactical_ai_credits  TO authenticated;
GRANT SELECT ON public.tactical_ai_analyses TO authenticated;
GRANT ALL ON public.tactical_ai_credits  TO service_role;
GRANT ALL ON public.tactical_ai_analyses TO service_role;

DROP POLICY IF EXISTS tactical_ai_credits_select_staff ON public.tactical_ai_credits;
CREATE POLICY tactical_ai_credits_select_staff
  ON public.tactical_ai_credits
  FOR SELECT
  TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

DROP POLICY IF EXISTS tactical_ai_analyses_select_staff ON public.tactical_ai_analyses;
CREATE POLICY tactical_ai_analyses_select_staff
  ON public.tactical_ai_analyses
  FOR SELECT
  TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

-- -----------------------------------------------------------------------------
-- 4. RPCs de saldo. Todas toman la fila del MES ACTUAL con FOR UPDATE: es el
--    candado que serializa consumir / devolver / comprar de una escuela.
-- -----------------------------------------------------------------------------

-- Fila del mes actual bloqueada (la crea si no existe). Interna: sin EXECUTE
-- para nadie más que service_role / las RPC de abajo (corren como su dueño).
CREATE OR REPLACE FUNCTION public._tactical_ai_lock_period(p_school_id uuid)
RETURNS public.tactical_ai_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_period text := public.tactical_ai_current_period();
  v_row    public.tactical_ai_credits;
BEGIN
  INSERT INTO public.tactical_ai_credits (school_id, period, free_quota)
  VALUES (p_school_id, v_period, public.tactical_ai_free_quota())
  ON CONFLICT (school_id, period) DO NOTHING;

  SELECT * INTO v_row
  FROM public.tactical_ai_credits
  WHERE school_id = p_school_id AND period = v_period
  FOR UPDATE;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public._tactical_ai_lock_period(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._tactical_ai_lock_period(uuid) TO service_role;

-- Saldo pagado de la escuela (todas las filas). Llamar con la fila del mes ya
-- bloqueada para que el número no cambie entre la lectura y la escritura.
CREATE OR REPLACE FUNCTION public._tactical_ai_paid_remaining(p_school_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT GREATEST(0, COALESCE(SUM(purchased), 0) - COALESCE(SUM(GREATEST(used - free_quota, 0)), 0))::integer
  FROM public.tactical_ai_credits
  WHERE school_id = p_school_id
$$;

REVOKE ALL ON FUNCTION public._tactical_ai_paid_remaining(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._tactical_ai_paid_remaining(uuid) TO service_role;

-- Respuesta común: { ok, remaining, free_remaining, paid_remaining, used,
-- free_quota, period, needs_purchase }.
CREATE OR REPLACE FUNCTION public._tactical_ai_balance_json(p_row public.tactical_ai_credits, p_ok boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_free integer := GREATEST(p_row.free_quota - p_row.used, 0);
  v_paid integer := public._tactical_ai_paid_remaining(p_row.school_id);
BEGIN
  RETURN jsonb_build_object(
    'ok', p_ok,
    'remaining', v_free + v_paid,
    'free_remaining', v_free,
    'paid_remaining', v_paid,
    'used', p_row.used,
    'free_quota', p_row.free_quota,
    'period', p_row.period,
    'needs_purchase', (v_free + v_paid) = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public._tactical_ai_balance_json(public.tactical_ai_credits, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._tactical_ai_balance_json(public.tactical_ai_credits, boolean) TO service_role;

-- Descuenta UN análisis si hay saldo (gratis del mes primero, después pagado).
-- Sin saldo: ok=false, needs_purchase=true y no cambia nada. Solo el BFF.
CREATE OR REPLACE FUNCTION public.consume_tactical_ai_credit(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row  public.tactical_ai_credits;
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'school_id requerido' USING ERRCODE = '22023';
  END IF;
  v_row := public._tactical_ai_lock_period(p_school_id);

  IF v_row.used < v_row.free_quota OR public._tactical_ai_paid_remaining(p_school_id) > 0 THEN
    UPDATE public.tactical_ai_credits
       SET used = used + 1, updated_at = now()
     WHERE id = v_row.id
    RETURNING * INTO v_row;
    RETURN public._tactical_ai_balance_json(v_row, true);
  END IF;

  RETURN public._tactical_ai_balance_json(v_row, false);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_tactical_ai_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_tactical_ai_credit(uuid) TO service_role;

-- Devuelve el análisis descontado cuando el modelo falló después de consumir.
CREATE OR REPLACE FUNCTION public.refund_tactical_ai_credit(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row public.tactical_ai_credits;
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'school_id requerido' USING ERRCODE = '22023';
  END IF;
  v_row := public._tactical_ai_lock_period(p_school_id);
  UPDATE public.tactical_ai_credits
     SET used = GREATEST(used - 1, 0), updated_at = now()
   WHERE id = v_row.id
  RETURNING * INTO v_row;
  RETURN public._tactical_ai_balance_json(v_row, true);
END;
$$;

REVOKE ALL ON FUNCTION public.refund_tactical_ai_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_tactical_ai_credit(uuid) TO service_role;

-- Saldo sin consumir (para mostrar «Te quedan N análisis este mes»). Solo el BFF,
-- que ya validó que quien pregunta es staff de la escuela.
CREATE OR REPLACE FUNCTION public.tactical_ai_balance(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row public.tactical_ai_credits;
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'school_id requerido' USING ERRCODE = '22023';
  END IF;
  -- Crea la fila del mes si falta: así el saldo mostrado y el que se consume
  -- salen de la misma foto de free_quota.
  v_row := public._tactical_ai_lock_period(p_school_id);
  RETURN public._tactical_ai_balance_json(v_row, true);
END;
$$;

REVOKE ALL ON FUNCTION public.tactical_ai_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_balance(uuid) TO service_role;

-- Suma análisis comprados (paquete «50 análisis»). Hoy NO hay checkout: lo usa
-- el super admin a mano o el BFF (service_role) cuando exista el flujo de pago
-- del adicional. Gate interno porque authenticated tiene EXECUTE (super admin).
CREATE OR REPLACE FUNCTION public.grant_tactical_ai_credits(p_school_id uuid, p_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row public.tactical_ai_credits;
BEGIN
  IF NOT (
    COALESCE((SELECT auth.jwt()) ->> 'role', '') = 'service_role'
    OR session_user IN ('postgres', 'supabase_admin')
    OR COALESCE((SELECT public.is_super_admin()), false)
  ) THEN
    RAISE EXCEPTION 'solo super admin o service_role' USING ERRCODE = '42501';
  END IF;
  IF p_school_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id) THEN
    RAISE EXCEPTION 'escuela inexistente' USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'p_amount debe estar entre 1 y 10000' USING ERRCODE = '22023';
  END IF;

  v_row := public._tactical_ai_lock_period(p_school_id);
  UPDATE public.tactical_ai_credits
     SET purchased = purchased + p_amount, updated_at = now()
   WHERE id = v_row.id
  RETURNING * INTO v_row;
  RETURN public._tactical_ai_balance_json(v_row, true);
END;
$$;

REVOKE ALL ON FUNCTION public.grant_tactical_ai_credits(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_tactical_ai_credits(uuid, integer) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. llm_usage: la función 'pizarra_ia' (si la tabla ya existe en esta base).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.llm_usage') IS NOT NULL THEN
    ALTER TABLE public.llm_usage DROP CONSTRAINT IF EXISTS llm_usage_feature_check;
    ALTER TABLE public.llm_usage ADD CONSTRAINT llm_usage_feature_check
      CHECK (feature IN ('bot', 'ocr', 'transcripcion', 'sportbot', 'pizarra_ia'));
  END IF;
END;
$$;

COMMIT;


-- ───────────────────────────────────────────────────────────────────────────
-- [3/10] PIZARRA  ·  20261014121142_pizarra_paquetes_biblioteca.sql
-- origen: pizarra-tp/integracion:supabase/migrations/20261014121142_pizarra_paquetes_biblioteca.sql
-- ───────────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261014121142_pizarra_paquetes_biblioteca.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014111442
-- Objetivo: M2 de docs/specs/pizarra-multideporte-3d-ia.md (decisión D4, §4) —
--   «bibliotecas cargables = paquetes». Un paquete es un conjunto de ejercicios
--   de un deporte. SportMaps publica los del sistema (school_id NULL, solo
--   lectura); la escuela ACTIVA los que quiere e IMPORTA los suyos desde un
--   archivo .json (formato 'sportmaps-ejercicios' v1, lo valida el BFF).
--
--   1. public.exercise_packs          paquetes (sistema / escuela), deporte, versión
--   2. training_exercises.pack_id     a qué paquete pertenece cada ejercicio
--   3. public.school_exercise_packs   paquetes del sistema activados por escuela
--   4. RLS: leen staff (user_staff_school_ids()); NADIE escribe por la tabla
--   5. RPCs SECURITY DEFINER: activate_exercise_pack, deactivate_exercise_pack,
--      import_exercise_pack (paquete + todos sus ejercicios en UNA transacción)
--   6. Datos: 7 paquetes del sistema y las 28 plantillas asignadas por deporte
--
-- ── Decisión de compatibilidad (la toma el BFF, school/exercisePacks.ts) ─────
--   Una escuela que todavía NO activó ningún paquete ve TODOS los paquetes del
--   sistema de sus deportes (modo «todos»): es lo que ve hoy. Si no fuera así,
--   al desplegar se vaciaría la biblioteca de las 371 escuelas. Apenas activa
--   uno pasa a modo «selección»: ve solo los activados + los suyos. Si
--   desactiva el último vuelve a «todos» (nunca biblioteca vacía; la pantalla
--   lo avisa antes de desactivar el último). Los ejercicios PROPIOS de la
--   escuela se ven siempre, salvo los de un paquete propio desactivado.
--
-- ── Paquetes del sistema (ids fijos 5b1c0000-…-00000000000N) ─────────────────
--   1 futbol     «Fútbol: fundamentos y juego»   las 11 de fútbol 11
--   2 futbol7    «Fútbol 7 y fútbol 5»           1 de fútbol 7 + 2 de fútbol 5
--   3 futsal     «Futsal»                         3
--   4 voleibol   «Voleibol formativo»             3
--   5 baloncesto «Baloncesto»                     3
--   6 balonmano  «Balonmano»                      3
--   7 generico   «Preparación física»             2
--   El paquete 2 mezcla F7 y F5 a propósito: desde M2 (D1) una escuela de
--   fútbol ve las tres canchas (11, 7 y 5), así que el deporte del paquete es
--   el principal y cada ejercicio conserva el suyo. El BFF filtra por los DOS.
--
-- ── Radio medido contra la base viva (2026-10-14, solo SELECT) ───────────────
--   · exercise_packs / school_exercise_packs no existen; training_exercises no
--     tiene pack_id; su único trigger es training_exercises_set_updated_at y
--     tiene exactamente 4 policies (select/insert/update/delete). Nada choca.
--   · training_exercises: 12 plantillas del sistema VIVAS (11 fútbol + 1 F7) y
--     0 ejercicios de escuela. La 20261013194057 (16 plantillas de los demás
--     deportes) NO está aplicada: esta migración la exige antes (bloque 0) y
--     corta con un mensaje claro si falta. Tras ambas: 28 plantillas → 7
--     paquetes, 0 sin paquete.
--   · Visibilidad: 371 escuelas, 0 con paquetes activados → todas quedan en
--     modo «todos» = exactamente lo que ven hoy. Ninguna pantalla cambia al
--     aplicar; el cambio llega solo cuando una escuela activa un paquete.
--   · Quién puede activar / importar (gate interno de las RPC =
--     user_admin_school_ids() ∪ user_tactical_edit_school_ids()): 110
--     membresías activas (66 owner, 37 coach, 5 admin, 2 school_admin) en 66
--     escuelas + 57 cuentas de coach en school_staff. NO pueden: 872 padres,
--     48 atletas, 2 reporter (staff que LEE pero no gestiona). Nadie pierde
--     nada: todo es nuevo.
--   · Escrituras: las tablas nuevas no tienen policies de escritura y
--     authenticated/anon no tienen INSERT/UPDATE/DELETE; el BFF escribe solo por
--     las RPC (userClient, para que auth.uid() sea el caller).
--   · training_exercises: se agrega una columna NULL (sin reescritura de la
--     tabla, 12-28 filas) y un trigger que impide colgar un ejercicio de un
--     paquete de OTRA escuela (o un ejercicio de escuela de un paquete del
--     sistema). Sus 4 policies no se tocan.
--
-- Depende de: 20261008183744 (training_exercises), 20261013194057 (plantillas
-- de los demás deportes), helpers user_*_school_ids() e is_super_admin().
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 0. Dependencias ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.training_exercises') IS NULL THEN
    RAISE EXCEPTION 'Falta public.training_exercises: aplicar 20261008183744_biblioteca_ejercicios_v2 antes que esta migración.';
  END IF;
  IF to_regprocedure('public.user_tactical_edit_school_ids()') IS NULL
     OR to_regprocedure('public.user_admin_school_ids()') IS NULL
     OR to_regprocedure('public.user_staff_school_ids()') IS NULL THEN
    RAISE EXCEPTION 'Faltan los helpers de RLS user_*_school_ids().';
  END IF;
  -- Las plantillas de futsal, vóley, básquet, balonmano, F5 y genérico las trae
  -- 20261013194057. Sin ellas los paquetes 2-7 quedarían vacíos y, si se
  -- aplicara después, sus 16 filas quedarían sin paquete.
  IF (SELECT count(DISTINCT e.sport) FROM public.training_exercises e
       WHERE e.school_id IS NULL AND e.is_template) < 8 THEN
    RAISE EXCEPTION 'Faltan plantillas del sistema de algún deporte: aplicar 20261013194057_plantillas_ejercicios_otros_deportes antes que esta migración.';
  END IF;
END $$;

-- ─── 1. exercise_packs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exercise_packs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = paquete SportMaps (sistema, solo lectura).
  school_id   uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  sport       text NOT NULL
              CHECK (sport IN ('futbol','futbol7','futbol5','futsal','voleibol','baloncesto','balonmano','generico')),
  name        text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  version     integer NOT NULL DEFAULT 1 CHECK (version BETWEEN 1 AND 100000),
  -- Paquete propio desactivado = sus ejercicios no salen en la biblioteca.
  -- Paquete del sistema inactivo = SportMaps lo retiró.
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exercise_packs IS
  'Paquetes de la Biblioteca de ejercicios (pizarra M2, D4). school_id NULL = paquete SportMaps de solo lectura. Escritura solo por RPC (activate/deactivate/import_exercise_pack).';

CREATE INDEX IF NOT EXISTS exercise_packs_school_idx ON public.exercise_packs (school_id);
CREATE INDEX IF NOT EXISTS exercise_packs_system_sport_idx
  ON public.exercise_packs (sport) WHERE school_id IS NULL;

DROP TRIGGER IF EXISTS exercise_packs_set_updated_at ON public.exercise_packs;
CREATE TRIGGER exercise_packs_set_updated_at
  BEFORE UPDATE ON public.exercise_packs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. training_exercises.pack_id ──────────────────────────────────────────
ALTER TABLE public.training_exercises
  ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.exercise_packs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS training_exercises_pack_idx
  ON public.training_exercises (pack_id) WHERE pack_id IS NOT NULL;

-- Un ejercicio solo cuelga de un paquete de SU misma escuela (o los dos del
-- sistema). Sin esto, un coach podía insertar por PostgREST un ejercicio de su
-- escuela con pack_id = un paquete SportMaps (o de otra escuela) y «meterlo»
-- en el paquete ajeno. SECURITY INVOKER a propósito: el caller solo ve los
-- paquetes de sus escuelas y los del sistema, así que un paquete ajeno ni se
-- encuentra (→ rechazo); service_role y postgres ven todo.
CREATE OR REPLACE FUNCTION public.training_exercises_pack_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_pack_school uuid;
BEGIN
  IF NEW.pack_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT ep.school_id INTO v_pack_school
    FROM public.exercise_packs ep
   WHERE ep.id = NEW.pack_id;
  IF NOT FOUND OR v_pack_school IS DISTINCT FROM NEW.school_id THEN
    RAISE EXCEPTION 'El ejercicio y su paquete tienen que ser de la misma escuela (o los dos de SportMaps).'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.training_exercises_pack_scope() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.training_exercises_pack_scope() FROM anon;
REVOKE ALL ON FUNCTION public.training_exercises_pack_scope() FROM authenticated;

DROP TRIGGER IF EXISTS training_exercises_pack_scope ON public.training_exercises;
CREATE TRIGGER training_exercises_pack_scope
  BEFORE INSERT OR UPDATE OF pack_id, school_id ON public.training_exercises
  FOR EACH ROW EXECUTE FUNCTION public.training_exercises_pack_scope();

-- ─── 3. school_exercise_packs (paquetes del sistema activados) ──────────────
CREATE TABLE IF NOT EXISTS public.school_exercise_packs (
  school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  pack_id      uuid NOT NULL REFERENCES public.exercise_packs(id) ON DELETE CASCADE,
  activated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_exercise_packs_pkey PRIMARY KEY (school_id, pack_id)
);

COMMENT ON TABLE public.school_exercise_packs IS
  'Paquetes SportMaps activados por cada escuela (pizarra M2). Sin filas = la escuela ve todos los de sus deportes. Escritura solo por activate/deactivate_exercise_pack.';

CREATE INDEX IF NOT EXISTS school_exercise_packs_pack_idx ON public.school_exercise_packs (pack_id);

-- ─── 4. RLS: leen staff; nadie escribe por la tabla ─────────────────────────
ALTER TABLE public.exercise_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_exercise_packs ENABLE ROW LEVEL SECURITY;

-- Los default privileges del esquema dan todo a anon/authenticated: explícito.
REVOKE ALL ON public.exercise_packs FROM PUBLIC;
REVOKE ALL ON public.exercise_packs FROM anon;
REVOKE ALL ON public.exercise_packs FROM authenticated;
GRANT SELECT ON public.exercise_packs TO authenticated;
GRANT ALL ON public.exercise_packs TO service_role;

REVOKE ALL ON public.school_exercise_packs FROM PUBLIC;
REVOKE ALL ON public.school_exercise_packs FROM anon;
REVOKE ALL ON public.school_exercise_packs FROM authenticated;
GRANT SELECT ON public.school_exercise_packs TO authenticated;
GRANT ALL ON public.school_exercise_packs TO service_role;

-- Paquetes: los del sistema los lee quien trabaja en alguna escuela (mismo
-- criterio que las plantillas en training_exercises_select, 20261013200604);
-- los de una escuela, su staff. Padres y atletas no (user_staff_school_ids()
-- los excluye). Sin SELECT sobre exercise_packs dentro del USING.
DROP POLICY IF EXISTS exercise_packs_select ON public.exercise_packs;
CREATE POLICY exercise_packs_select ON public.exercise_packs
  FOR SELECT TO authenticated
  USING (
    (school_id IS NULL AND cardinality((SELECT public.user_staff_school_ids())::uuid[]) > 0)
    OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

DROP POLICY IF EXISTS school_exercise_packs_select ON public.school_exercise_packs;
CREATE POLICY school_exercise_packs_select ON public.school_exercise_packs
  FOR SELECT TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

-- Sin policies de INSERT/UPDATE/DELETE: con RLS activa eso es «nadie», y
-- además authenticated no tiene el privilegio. Todo pasa por las RPC.

-- ─── 5. RPCs ────────────────────────────────────────────────────────────────
-- Gate común (inline en cada RPC): el caller administra la escuela
-- (user_admin_school_ids()) o puede editar su pizarra
-- (user_tactical_edit_school_ids()), o es super admin de plataforma.

-- 5a. Activar: paquete del sistema → fila en school_exercise_packs; paquete
--     propio desactivado → is_active = true.
CREATE OR REPLACE FUNCTION public.activate_exercise_pack(p_school_id uuid, p_pack_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_pack public.exercise_packs%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  IF p_school_id IS NULL OR p_pack_id IS NULL THEN
    RAISE EXCEPTION 'p_school_id y p_pack_id son requeridos.' USING ERRCODE = '22023';
  END IF;
  IF NOT (p_school_id = ANY (public.user_admin_school_ids())
          OR p_school_id = ANY (public.user_tactical_edit_school_ids())
          OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'No puedes gestionar los paquetes de esta escuela.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pack FROM public.exercise_packs ep WHERE ep.id = p_pack_id;
  -- Un paquete de OTRA escuela responde igual que uno inexistente.
  IF NOT FOUND OR (v_pack.school_id IS NOT NULL AND v_pack.school_id <> p_school_id) THEN
    RAISE EXCEPTION 'Paquete no encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_pack.school_id IS NULL THEN
    IF NOT v_pack.is_active THEN
      RAISE EXCEPTION 'Ese paquete ya no está disponible.' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO public.school_exercise_packs (school_id, pack_id, activated_by)
    VALUES (p_school_id, p_pack_id, v_uid)
    ON CONFLICT (school_id, pack_id) DO NOTHING;
  ELSE
    UPDATE public.exercise_packs SET is_active = true WHERE id = p_pack_id AND NOT is_active;
  END IF;

  RETURN jsonb_build_object('pack_id', p_pack_id, 'school_id', p_school_id,
                            'is_system', v_pack.school_id IS NULL, 'activated', true);
END;
$$;

-- 5b. Desactivar: paquete del sistema → borra la activación; propio → is_active = false.
CREATE OR REPLACE FUNCTION public.deactivate_exercise_pack(p_school_id uuid, p_pack_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_pack public.exercise_packs%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  IF p_school_id IS NULL OR p_pack_id IS NULL THEN
    RAISE EXCEPTION 'p_school_id y p_pack_id son requeridos.' USING ERRCODE = '22023';
  END IF;
  IF NOT (p_school_id = ANY (public.user_admin_school_ids())
          OR p_school_id = ANY (public.user_tactical_edit_school_ids())
          OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'No puedes gestionar los paquetes de esta escuela.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pack FROM public.exercise_packs ep WHERE ep.id = p_pack_id;
  IF NOT FOUND OR (v_pack.school_id IS NOT NULL AND v_pack.school_id <> p_school_id) THEN
    RAISE EXCEPTION 'Paquete no encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_pack.school_id IS NULL THEN
    DELETE FROM public.school_exercise_packs WHERE school_id = p_school_id AND pack_id = p_pack_id;
  ELSE
    UPDATE public.exercise_packs SET is_active = false WHERE id = p_pack_id AND is_active;
  END IF;

  RETURN jsonb_build_object('pack_id', p_pack_id, 'school_id', p_school_id,
                            'is_system', v_pack.school_id IS NULL, 'activated', false);
END;
$$;

-- 5c. Importar: crea el paquete de la escuela y TODOS sus ejercicios en una
--     sola transacción (la función entera lo es: un ejercicio que no pasa un
--     CHECK deshace el paquete y los anteriores). El BFF ya validó el archivo
--     (formato, versión, jugadas, deportes de la escuela, textos); acá se
--     repiten los topes duros para quien llame la RPC directo por PostgREST.
--     NUNCA se usan ids, school_id, created_by ni is_template del payload.
CREATE OR REPLACE FUNCTION public.import_exercise_pack(p_school_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_pack    jsonb;
  v_list    jsonb;
  v_ex      jsonb;
  v_pack_id uuid;
  v_sport   text;
  v_version integer;
  v_n       integer := 0;
  v_tags    text[];
  v_board   jsonb;
  v_own     integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'p_school_id es requerido.' USING ERRCODE = '22023';
  END IF;
  IF NOT (p_school_id = ANY (public.user_admin_school_ids())
          OR p_school_id = ANY (public.user_tactical_edit_school_ids())
          OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'No puedes importar paquetes en esta escuela.' USING ERRCODE = '42501';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'El paquete debe ser un objeto { pack, exercises }.' USING ERRCODE = '22023';
  END IF;
  IF octet_length(p_payload::text) > 4194304 THEN
    RAISE EXCEPTION 'El paquete pesa más de 4 MB.' USING ERRCODE = '22023';
  END IF;

  v_pack := p_payload->'pack';
  v_list := p_payload->'exercises';
  IF v_pack IS NULL OR jsonb_typeof(v_pack) <> 'object' THEN
    RAISE EXCEPTION 'Falta pack.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_pack->'name') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'pack.name es requerido.' USING ERRCODE = '22023';
  END IF;
  v_sport := v_pack->>'sport';
  IF v_sport IS NULL OR v_sport NOT IN ('futbol','futbol7','futbol5','futsal','voleibol','baloncesto','balonmano','generico') THEN
    RAISE EXCEPTION 'pack.sport inválido.' USING ERRCODE = '22023';
  END IF;
  v_version := CASE WHEN jsonb_typeof(v_pack->'version') = 'number'
                    THEN LEAST(GREATEST(floor((v_pack->>'version')::numeric)::integer, 1), 100000)
                    ELSE 1 END;
  IF v_list IS NULL OR jsonb_typeof(v_list) <> 'array'
     OR jsonb_array_length(v_list) < 1 OR jsonb_array_length(v_list) > 200 THEN
    RAISE EXCEPTION 'exercises debe ser una lista de 1 a 200 ejercicios.' USING ERRCODE = '22023';
  END IF;

  -- Tope de paquetes propios (abuso / errores en bucle). Lock transaccional
  -- por escuela (no bloquea la fila de schools) para que dos importaciones a la
  -- vez no pasen las dos el conteo.
  PERFORM pg_advisory_xact_lock(hashtextextended('import_exercise_pack:' || p_school_id::text, 0));
  PERFORM 1 FROM public.schools s WHERE s.id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escuela no encontrada.' USING ERRCODE = 'P0002';
  END IF;
  SELECT count(*) INTO v_own FROM public.exercise_packs ep WHERE ep.school_id = p_school_id;
  IF v_own >= 200 THEN
    RAISE EXCEPTION 'Tu escuela ya tiene 200 paquetes: borra alguno antes de importar.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.exercise_packs (school_id, sport, name, description, version, is_active, created_by)
  VALUES (
    p_school_id,
    v_sport,
    btrim(v_pack->>'name'),
    NULLIF(btrim(CASE WHEN jsonb_typeof(v_pack->'description') = 'string' THEN v_pack->>'description' END), ''),
    v_version,
    true,
    v_uid
  )
  RETURNING id INTO v_pack_id;

  FOR v_ex IN SELECT value FROM jsonb_array_elements(v_list) LOOP
    v_n := v_n + 1;
    IF jsonb_typeof(v_ex) <> 'object' OR jsonb_typeof(v_ex->'name') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Ejercicio %: debe ser un objeto con name.', v_n USING ERRCODE = '22023';
    END IF;
    IF v_ex ? 'tags' AND jsonb_typeof(v_ex->'tags') <> 'array' THEN
      RAISE EXCEPTION 'Ejercicio %: tags debe ser una lista.', v_n USING ERRCODE = '22023';
    END IF;
    v_tags := CASE WHEN jsonb_typeof(v_ex->'tags') = 'array'
                   THEN ARRAY(SELECT DISTINCT lower(btrim(t)) FROM jsonb_array_elements_text(v_ex->'tags') AS t
                               WHERE btrim(t) <> '' AND char_length(btrim(t)) <= 40)
                   ELSE '{}'::text[] END;
    v_board := CASE WHEN jsonb_typeof(v_ex->'board') = 'object' THEN v_ex->'board'
                    ELSE '{"players":[],"arrows":[],"frames":[]}'::jsonb END;

    -- Los CHECK de training_exercises (largos, minutos, deporte, tamaño de la
    -- jugada) y el trigger de paquete validan cada fila; cualquiera que falle
    -- aborta la importación entera.
    INSERT INTO public.training_exercises
      (school_id, created_by, pack_id, name, objective, minutes, age_group, materials, tags, sport, description, board, is_template, is_active)
    VALUES (
      p_school_id,
      v_uid,
      v_pack_id,
      btrim(v_ex->>'name'),
      NULLIF(btrim(CASE WHEN jsonb_typeof(v_ex->'objective') = 'string' THEN v_ex->>'objective' END), ''),
      CASE WHEN jsonb_typeof(v_ex->'minutes') = 'number' THEN (v_ex->>'minutes')::numeric::integer END,
      NULLIF(btrim(CASE WHEN jsonb_typeof(v_ex->'age_group') = 'string' THEN v_ex->>'age_group' END), ''),
      NULLIF(btrim(CASE WHEN jsonb_typeof(v_ex->'materials') = 'string' THEN v_ex->>'materials' END), ''),
      v_tags,
      COALESCE(CASE WHEN jsonb_typeof(v_ex->'sport') = 'string' THEN v_ex->>'sport' END, v_sport),
      NULLIF(btrim(CASE WHEN jsonb_typeof(v_ex->'description') = 'string' THEN v_ex->>'description' END), ''),
      v_board,
      false,
      true
    );
  END LOOP;

  RETURN jsonb_build_object('pack_id', v_pack_id, 'school_id', p_school_id, 'exercises', v_n);
END;
$$;

COMMENT ON FUNCTION public.activate_exercise_pack(uuid, uuid) IS
  'Pizarra M2: activa un paquete SportMaps (o reactiva uno propio) para la escuela. Gate: user_admin_school_ids() ∪ user_tactical_edit_school_ids().';
COMMENT ON FUNCTION public.deactivate_exercise_pack(uuid, uuid) IS
  'Pizarra M2: desactiva un paquete SportMaps (o uno propio) para la escuela. Gate: user_admin_school_ids() ∪ user_tactical_edit_school_ids().';
COMMENT ON FUNCTION public.import_exercise_pack(uuid, jsonb) IS
  'Pizarra M2: importa un paquete (archivo sportmaps-ejercicios v1 ya validado por el BFF) creando el paquete y sus ejercicios en una transacción. Ignora ids del archivo.';

-- Los default privileges del esquema dan EXECUTE a authenticated/anon: explícito.
REVOKE ALL ON FUNCTION public.activate_exercise_pack(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_exercise_pack(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.activate_exercise_pack(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_exercise_pack(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.deactivate_exercise_pack(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deactivate_exercise_pack(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.deactivate_exercise_pack(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_exercise_pack(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.import_exercise_pack(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_exercise_pack(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.import_exercise_pack(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_exercise_pack(uuid, jsonb) TO service_role;

-- ─── 6. Datos: paquetes del sistema y asignación de las 28 plantillas ───────
-- Idempotente: ids fijos (ON CONFLICT DO NOTHING) y solo asigna plantillas
-- que todavía no tienen paquete.
INSERT INTO public.exercise_packs (id, school_id, sport, name, description, version, is_active, created_by)
VALUES
  ('5b1c0000-0000-4000-8000-000000000001', NULL, 'futbol', 'Fútbol: fundamentos y juego',
   'Rondos, posesión, salida de balón, presión, finalización, defensa y balón parado para fútbol 11.', 1, true, NULL),
  ('5b1c0000-0000-4000-8000-000000000002', NULL, 'futbol7', 'Fútbol 7 y fútbol 5',
   'Juego de posición y tareas en cancha reducida para las categorías que juegan fútbol 7 y fútbol 5.', 1, true, NULL),
  ('5b1c0000-0000-4000-8000-000000000003', NULL, 'futsal', 'Futsal',
   'Rotaciones, paredes y finalización en cancha de fútbol sala.', 1, true, NULL),
  ('5b1c0000-0000-4000-8000-000000000004', NULL, 'voleibol', 'Voleibol formativo',
   'Recepción, armado, ataque y rotación por zonas para categorías formativas.', 1, true, NULL),
  ('5b1c0000-0000-4000-8000-000000000005', NULL, 'baloncesto', 'Baloncesto',
   'Pase y corte, bloqueo directo y transición en media y cancha completa.', 1, true, NULL),
  ('5b1c0000-0000-4000-8000-000000000006', NULL, 'balonmano', 'Balonmano',
   'Circulación, cruces y defensa en balonmano.', 1, true, NULL),
  ('5b1c0000-0000-4000-8000-000000000007', NULL, 'generico', 'Preparación física',
   'Calentamientos, reacción y coordinación que sirven para cualquier deporte.', 1, true, NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE public.training_exercises e
   SET pack_id = CASE e.sport
                   WHEN 'futbol'     THEN '5b1c0000-0000-4000-8000-000000000001'::uuid
                   WHEN 'futbol7'    THEN '5b1c0000-0000-4000-8000-000000000002'::uuid
                   WHEN 'futbol5'    THEN '5b1c0000-0000-4000-8000-000000000002'::uuid
                   WHEN 'futsal'     THEN '5b1c0000-0000-4000-8000-000000000003'::uuid
                   WHEN 'voleibol'   THEN '5b1c0000-0000-4000-8000-000000000004'::uuid
                   WHEN 'baloncesto' THEN '5b1c0000-0000-4000-8000-000000000005'::uuid
                   WHEN 'balonmano'  THEN '5b1c0000-0000-4000-8000-000000000006'::uuid
                   WHEN 'generico'   THEN '5b1c0000-0000-4000-8000-000000000007'::uuid
                 END
 WHERE e.school_id IS NULL
   AND e.is_template
   AND e.pack_id IS NULL;

-- Ninguna plantilla del sistema sin paquete.
DO $$
DECLARE
  v_sin integer;
BEGIN
  SELECT count(*) INTO v_sin FROM public.training_exercises
   WHERE school_id IS NULL AND is_template AND pack_id IS NULL;
  IF v_sin > 0 THEN
    RAISE EXCEPTION 'Quedaron % plantillas del sistema sin paquete.', v_sin;
  END IF;
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación post-aplicación:
--   npm run seguridad:rls-pizarra   -- los casos de paquetes dejan de omitirse y pasan a verde
--   npm run seguridad:invariantes
--   select ep.name, ep.sport, count(e.*) from public.exercise_packs ep
--     left join public.training_exercises e on e.pack_id = ep.id
--    where ep.school_id is null group by 1, 2 order by 2;      -- 7 paquetes, 28 ejercicios
--   select tablename, policyname, cmd, roles, qual, with_check from pg_policies
--    where tablename in ('exercise_packs', 'school_exercise_packs');   -- solo SELECT
--   select proname, proacl, proconfig from pg_proc
--    where proname in ('activate_exercise_pack', 'deactivate_exercise_pack', 'import_exercise_pack');
--   set local role anon; select count(*) from public.exercise_packs;     -- permission denied
-- -----------------------------------------------------------------------------


-- ───────────────────────────────────────────────────────────────────────────
-- [4/10] PIZARRA  ·  20261014125632_pizarra_eventos_ia_3d_paquetes.sql
-- origen: pizarra-tp/integracion:supabase/migrations/20261014125632_pizarra_eventos_ia_3d_paquetes.sql
-- ───────────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261014125632_pizarra_eventos_ia_3d_paquetes.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014121142
-- Objetivo: la métrica de uso de la pizarra (T0, tactical_board_events) mide
--   también lo nuevo de docs/specs/pizarra-multideporte-3d-ia.md, para ver con
--   datos si el 3D (D5) y la IA (D6) se usan:
--     · ai_analyze       tocar «Analizar jugada» (M3)
--     · ai_view_counter  ver un contraataque / variante de la IA en la cancha
--     · ai_save_variant  «Guardar como nueva jugada» desde una sugerencia IA
--     · view_3d          abrir el visor 3D (M4), desde la pizarra o desde la IA
--     · pack_activate    activar un paquete de la biblioteca (M2)
--     · pack_import      importar un paquete desde archivo (M2)
--     · pack_export      exportar un paquete a archivo (M2)
--
--   Definiciones VIVAS leídas el 2026-10-14 (npx supabase db query --linked):
--     · tactical_board_events_event_check = CHECK (event = ANY (ARRAY['open',
--       'save','play','export_png','export_pdf','export_video','share',
--       'library_save','library_insert','frame_add'])) — igual al repo
--       (20261008183746).
--     · log_tactical_board_event(uuid,text,uuid,text,text): SECURITY DEFINER,
--       search_path fijo, proacl {postgres,service_role,authenticated} y valida
--       el evento contra la MISMA lista dentro de la función → se reemplaza con
--       el mismo cuerpo y la lista ampliada (sin otro cambio de comportamiento:
--       staff de la escuela, equipo de la misma escuela, antirrebote 10 s).
--
--   Sin tablas ni policies nuevas: RLS de tactical_board_events intacta (solo
--   lectura admin/super admin; INSERT únicamente por la RPC).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. CHECK de eventos ampliado (los 10 de T0 + 7 nuevos)
-- -----------------------------------------------------------------------------
ALTER TABLE public.tactical_board_events
  DROP CONSTRAINT IF EXISTS tactical_board_events_event_check;

ALTER TABLE public.tactical_board_events
  ADD CONSTRAINT tactical_board_events_event_check CHECK (event IN (
    'open', 'save', 'play', 'export_png', 'export_pdf', 'export_video',
    'share', 'library_save', 'library_insert', 'frame_add',
    'ai_analyze', 'ai_view_counter', 'ai_save_variant', 'view_3d',
    'pack_activate', 'pack_import', 'pack_export'
  ));

-- -----------------------------------------------------------------------------
-- 2. RPC de registro: misma firma y mismo cuerpo, lista de eventos ampliada
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_tactical_board_event(
  p_school_id   uuid,
  p_event       text,
  p_team_id     uuid DEFAULT NULL,
  p_source_type text DEFAULT NULL,
  p_sport       text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_team uuid := p_team_id;
BEGIN
  IF v_uid IS NULL OR p_school_id IS NULL OR p_event IS NULL THEN
    RETURN false;
  END IF;

  IF p_event NOT IN ('open', 'save', 'play', 'export_png', 'export_pdf', 'export_video',
                     'share', 'library_save', 'library_insert', 'frame_add',
                     'ai_analyze', 'ai_view_counter', 'ai_save_variant', 'view_3d',
                     'pack_activate', 'pack_import', 'pack_export') THEN
    RETURN false;
  END IF;

  -- Solo quien TRABAJA en la escuela (sin padres ni atletas).
  IF NOT (p_school_id = ANY (public.user_staff_school_ids())) THEN
    RETURN false;
  END IF;

  -- Un equipo de otra escuela no se registra (se guarda el evento sin equipo).
  IF v_team IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.teams t WHERE t.id = v_team AND t.school_id = p_school_id
  ) THEN
    v_team := NULL;
  END IF;

  -- Antirrebote: mismo usuario + evento + equipo dentro de 10 s.
  IF EXISTS (
    SELECT 1
      FROM public.tactical_board_events e
     WHERE e.user_id = v_uid
       AND e.event = p_event
       AND e.team_id IS NOT DISTINCT FROM v_team
       AND e.created_at > now() - interval '10 seconds'
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.tactical_board_events (school_id, user_id, team_id, event, source_type, sport)
  VALUES (
    p_school_id,
    v_uid,
    v_team,
    p_event,
    left(nullif(btrim(p_source_type), ''), 40),
    left(nullif(btrim(p_sport), ''), 40)
  );

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.log_tactical_board_event(uuid, text, uuid, text, text) IS
  'T0 pizarra: registra un evento de uso (incluye IA, 3D y paquetes desde 20261014125632). Exige staff de la escuela; antirrebote 10 s por usuario+evento+equipo.';

-- CREATE OR REPLACE conserva el ACL, pero se reafirma explícito (los default
-- privileges del esquema dan EXECUTE a anon/authenticated en funciones nuevas).
REVOKE ALL ON FUNCTION public.log_tactical_board_event(uuid, text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_tactical_board_event(uuid, text, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_tactical_board_event(uuid, text, uuid, text, text) TO authenticated;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación post-aplicación (manual):
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.tactical_board_events'::regclass and conname = 'tactical_board_events_event_check';
--   select proacl, proconfig from pg_proc where proname = 'log_tactical_board_event';
--     -- esperado: {postgres=X,service_role=X,authenticated=X}, search_path fijo, SIN anon
--   npm run seguridad:invariantes
-- -----------------------------------------------------------------------------


-- ───────────────────────────────────────────────────────────────────────────
-- [5/10] PIZARRA  ·  20261014155445_pizarra_ia_cupo_por_entrenador_tokens.sql
-- origen: pizarra-tp/integracion:supabase/migrations/20261014155445_pizarra_ia_cupo_por_entrenador_tokens.sql
-- ───────────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261014155445_pizarra_ia_cupo_por_entrenador_tokens.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014125632
-- Objetivo: decisión del usuario del 2026-10-14 que REEMPLAZA el §6 de
--   docs/specs/pizarra-multideporte-3d-ia.md: la IA de la pizarra se lanza como
--   mejora PARA EL ROL COACH, limitada por COSTO REAL (tokens), sin precio
--   todavía. Se mide el uso y después se fija el precio; quien quiera más, compra.
--
--   Construye ENCIMA de 20261014111442 (cupo por escuela contado en análisis)
--   sin editarla. Las dos están sin aplicar; esta va después.
--
--   · Cupo mensual POR USUARIO (coach/staff que analiza) en MICRODÓLARES de
--     costo real (1 USD = 1.000.000). El BFF calcula el costo de cada llamada
--     con los tokens de entrada / escritura de caché / lectura de caché / salida
--     y la tabla de precios del modelo usado (bff/src/services/llm-usage.service.ts
--     → PRECIOS_POR_MILLON). Acá se guardan el costo y los tokens crudos.
--   · Presupuesto por usuario y mes: USD 1,00 → tactical_ai_user_budget_micro_usd().
--     Techo por ESCUELA y mes: 10 × el del usuario → tactical_ai_school_ceiling_factor().
--     Medido en la base viva el 2026-10-14: 41 escuelas con staff activo; p90 = 4
--     personas de staff, máximo 13 (una sola escuela pasa de 10). El techo casi
--     nunca muerde: es el tope de exposición por escuela (USD 10/mes), no el
--     límite del día a día.
--     Las filas guardan una FOTO del presupuesto/techo vigente al crearse:
--     cambiar las funciones no reescribe meses ya abiertos.
--   · Flujo (todo por RPC SECURITY DEFINER, EXECUTE solo service_role = el BFF):
--       tactical_ai_reserve  → FOR UPDATE sobre la fila de la ESCUELA y después la
--                              del USUARIO (siempre en ese orden: sin deadlocks);
--                              reserva un estimado (BFF: USD 0,08, > el máximo
--                              medido de USD 0,064). Sin saldo (usuario o escuela)
--                              → ok=false, denied_scope, y NO se llama al modelo.
--       tactical_ai_settle   → al llegar la respuesta: libera la reserva y cobra
--                              el costo REAL (puede ser menor o algo mayor).
--       tactical_ai_release  → el modelo falló o la salida no sirvió: libera.
--       tactical_ai_record_cache_hit → misma jugada ya analizada: USD 0, solo cuenta.
--     Una reserva que nunca se cerró (el BFF se cayó entre reservar y cobrar)
--     vence a los 15 min (tactical_ai_reservation_ttl) y se libera sola en la
--     próxima reserva de esa escuela: el saldo no queda tomado para siempre.
--   · Garantía: la suma de lo RESERVADO nunca pasa el presupuesto (la reserva
--     exige estimado ≤ disponible bajo FOR UPDATE). Lo COBRADO puede pasarlo
--     por centavos si una respuesta real cuesta más que el estimado: es plata
--     ya gastada en el proveedor y se registra tal cual.
--   · Más cupo (super admin): grant_tactical_ai_credits(escuela, usd, usuario?, nota?)
--       - con usuario: suma al usuario EN ESA ESCUELA y, por el mismo monto, al
--         techo de la escuela (si no, el techo podría frenar lo que se regaló);
--       - sin usuario: sube solo el techo de la escuela (escuela con muchos coaches
--         que topó el techo; no le da más a ningún coach en particular).
--     Vale para el mes en curso (el cupo se mide por mes). Cada regalo queda en
--     tactical_ai_grants con quién lo dio.
--     COMPATIBILIDAD: la firma vieja grant_tactical_ai_credits(uuid, integer)
--     («N análisis» a la escuela) se mantiene y ahora convierte N análisis a
--     N × USD 0,08 de techo de escuela.
--   · OBSOLETO de 20261014111442 (se depreca SIN borrar datos):
--       tactical_ai_credits (contador por escuela en número de análisis),
--       tactical_ai_free_quota(), consume_/refund_tactical_ai_credit(),
--       tactical_ai_balance(). Se conserva la tabla (solo lectura: se le quita
--       EXECUTE de consume/refund a service_role, así ningún código la vuelve a
--       mover) y se marca con COMMENT. No se crea vista de compatibilidad: no hay
--       consumidores (nunca se aplicó ni hubo flujo de compra).
--       tactical_ai_analyses (caché por hash) SIGUE vigente.
--   · RLS: el usuario lee lo suyo; el admin de la escuela
--     (user_admin_school_ids(): sin coaches) lee el consumo de su escuela por
--     coach; el super admin lee todo. Nadie escribe directo.
--
--   NO APLICADA (la base es la misma de producción). Para quien integre:
--   aplicar DESPUÉS de 20261014111442, correr `npm run seguridad:invariantes` y
--   `npm run seguridad:rls-pizarra` (casos «esperado tras 20261014155445»).
--   Helpers que se usan (vivos, verificado 2026-10-14): user_admin_school_ids()
--   → uuid[], is_super_admin() → boolean, auth.uid(), auth.jwt().
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Parámetros (cambiarlos = migración nueva que reemplace la función).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tactical_ai_user_budget_micro_usd()
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT 1000000::bigint $$;  -- USD 1,00 por usuario y mes

CREATE OR REPLACE FUNCTION public.tactical_ai_school_ceiling_factor()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT 10 $$;  -- techo de la escuela = 10 × presupuesto del usuario

CREATE OR REPLACE FUNCTION public.tactical_ai_school_ceiling_micro_usd()
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT public.tactical_ai_user_budget_micro_usd() * public.tactical_ai_school_ceiling_factor() $$;

-- Reserva sin cerrar más vieja que esto se libera sola (el BFF corta al modelo a los 75 s).
CREATE OR REPLACE FUNCTION public.tactical_ai_reservation_ttl()
RETURNS interval
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT interval '15 minutes' $$;

REVOKE ALL ON FUNCTION public.tactical_ai_user_budget_micro_usd()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tactical_ai_school_ceiling_factor()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tactical_ai_school_ceiling_micro_usd() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tactical_ai_reservation_ttl()          FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_user_budget_micro_usd()    TO service_role;
GRANT EXECUTE ON FUNCTION public.tactical_ai_school_ceiling_factor()    TO service_role;
GRANT EXECUTE ON FUNCTION public.tactical_ai_school_ceiling_micro_usd() TO service_role;
GRANT EXECUTE ON FUNCTION public.tactical_ai_reservation_ttl()          TO service_role;

-- -----------------------------------------------------------------------------
-- 1. Tablas
-- -----------------------------------------------------------------------------

-- Consumo por usuario, escuela y mes. Un coach de dos escuelas tiene un cupo en
-- cada una: el cupo es una mejora del plan de la ESCUELA para su staff.
CREATE TABLE IF NOT EXISTS public.tactical_ai_user_usage (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid        NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period              text        NOT NULL,
  budget_micro_usd    bigint      NOT NULL,
  extra_micro_usd     bigint      NOT NULL DEFAULT 0,
  used_micro_usd      bigint      NOT NULL DEFAULT 0,
  reserved_micro_usd  bigint      NOT NULL DEFAULT 0,
  analyses            integer     NOT NULL DEFAULT 0,
  cache_hits          integer     NOT NULL DEFAULT 0,
  needs_more_count    integer     NOT NULL DEFAULT 0,
  input_tokens        bigint      NOT NULL DEFAULT 0,
  output_tokens       bigint      NOT NULL DEFAULT 0,
  cache_read_tokens   bigint      NOT NULL DEFAULT 0,
  cache_write_tokens  bigint      NOT NULL DEFAULT 0,
  limit_hit_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tactical_ai_user_usage_period_check CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT tactical_ai_user_usage_money_check  CHECK (budget_micro_usd >= 0 AND extra_micro_usd >= 0 AND used_micro_usd >= 0 AND reserved_micro_usd >= 0),
  CONSTRAINT tactical_ai_user_usage_count_check  CHECK (analyses >= 0 AND cache_hits >= 0 AND needs_more_count >= 0),
  CONSTRAINT tactical_ai_user_usage_tokens_check CHECK (input_tokens >= 0 AND output_tokens >= 0 AND cache_read_tokens >= 0 AND cache_write_tokens >= 0),
  CONSTRAINT tactical_ai_user_usage_key UNIQUE (school_id, user_id, period)
);
CREATE INDEX IF NOT EXISTS tactical_ai_user_usage_user_idx   ON public.tactical_ai_user_usage (user_id, period);
CREATE INDEX IF NOT EXISTS tactical_ai_user_usage_period_idx ON public.tactical_ai_user_usage (period);

COMMENT ON TABLE public.tactical_ai_user_usage IS
  'Pizarra IA: costo real (microdólares) y tokens por usuario, escuela y mes (hora Bogotá). Mutada SOLO por RPC. Spec §6 (2026-10-14).';

-- Techo y total de la escuela por mes.
CREATE TABLE IF NOT EXISTS public.tactical_ai_school_usage (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  period              text        NOT NULL,
  ceiling_micro_usd   bigint      NOT NULL,
  extra_micro_usd     bigint      NOT NULL DEFAULT 0,
  used_micro_usd      bigint      NOT NULL DEFAULT 0,
  reserved_micro_usd  bigint      NOT NULL DEFAULT 0,
  analyses            integer     NOT NULL DEFAULT 0,
  needs_more_count    integer     NOT NULL DEFAULT 0,
  limit_hit_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tactical_ai_school_usage_period_check CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT tactical_ai_school_usage_money_check  CHECK (ceiling_micro_usd >= 0 AND extra_micro_usd >= 0 AND used_micro_usd >= 0 AND reserved_micro_usd >= 0),
  CONSTRAINT tactical_ai_school_usage_count_check  CHECK (analyses >= 0 AND needs_more_count >= 0),
  CONSTRAINT tactical_ai_school_usage_key UNIQUE (school_id, period)
);
CREATE INDEX IF NOT EXISTS tactical_ai_school_usage_period_idx ON public.tactical_ai_school_usage (period);

COMMENT ON TABLE public.tactical_ai_school_usage IS
  'Pizarra IA: techo (10 × presupuesto del usuario) y total de la escuela por mes. Mutada SOLO por RPC.';

-- Una fila por intento: reserva → settled/released/expired, o cache_hit, o
-- denied (sin saldo). Es el libro para el panel del super admin (costo medio
-- por deporte, tokens). Sin datos de atletas.
CREATE TABLE IF NOT EXISTS public.tactical_ai_runs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid        NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
  user_id             uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  period              text        NOT NULL,
  sport               text        NOT NULL,
  status              text        NOT NULL,
  denied_scope        text,
  reserved_micro_usd  bigint      NOT NULL DEFAULT 0,
  cost_micro_usd      bigint      NOT NULL DEFAULT 0,
  provider            text,
  model               text,
  input_tokens        integer     NOT NULL DEFAULT 0,
  output_tokens       integer     NOT NULL DEFAULT 0,
  cache_read_tokens   integer     NOT NULL DEFAULT 0,
  cache_write_tokens  integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  finished_at         timestamptz,
  CONSTRAINT tactical_ai_runs_period_check CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT tactical_ai_runs_sport_check  CHECK (sport IN ('futbol', 'futbol7', 'futbol5', 'futsal', 'voleibol', 'baloncesto', 'balonmano')),
  CONSTRAINT tactical_ai_runs_status_check CHECK (status IN ('reserved', 'settled', 'released', 'expired', 'cache_hit', 'denied')),
  CONSTRAINT tactical_ai_runs_scope_check  CHECK (denied_scope IS NULL OR denied_scope IN ('user', 'school')),
  CONSTRAINT tactical_ai_runs_money_check  CHECK (reserved_micro_usd >= 0 AND cost_micro_usd >= 0 AND cost_micro_usd <= 10000000),
  CONSTRAINT tactical_ai_runs_tokens_check CHECK (input_tokens >= 0 AND output_tokens >= 0 AND cache_read_tokens >= 0 AND cache_write_tokens >= 0),
  CONSTRAINT tactical_ai_runs_provider_len CHECK (provider IS NULL OR char_length(provider) <= 40),
  CONSTRAINT tactical_ai_runs_model_len    CHECK (model IS NULL OR char_length(model) <= 120)
);
CREATE INDEX IF NOT EXISTS tactical_ai_runs_school_period_idx ON public.tactical_ai_runs (school_id, period);
CREATE INDEX IF NOT EXISTS tactical_ai_runs_period_idx        ON public.tactical_ai_runs (period, sport);
CREATE INDEX IF NOT EXISTS tactical_ai_runs_user_idx          ON public.tactical_ai_runs (user_id);
CREATE INDEX IF NOT EXISTS tactical_ai_runs_reserved_idx      ON public.tactical_ai_runs (school_id, created_at) WHERE status = 'reserved';

COMMENT ON TABLE public.tactical_ai_runs IS
  'Pizarra IA: cada intento (reserva/cobro/liberación/caché/sin saldo) con costo real y tokens crudos. Mutada SOLO por RPC.';

-- Cupo extra dado por el super admin (auditoría).
CREATE TABLE IF NOT EXISTS public.tactical_ai_grants (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         uuid        NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
  user_id           uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  period            text        NOT NULL,
  amount_micro_usd  bigint      NOT NULL,
  note              text,
  granted_by        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tactical_ai_grants_period_check CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT tactical_ai_grants_amount_check CHECK (amount_micro_usd > 0 AND amount_micro_usd <= 1000000000),
  CONSTRAINT tactical_ai_grants_note_len     CHECK (note IS NULL OR char_length(note) <= 300)
);
CREATE INDEX IF NOT EXISTS tactical_ai_grants_school_period_idx ON public.tactical_ai_grants (school_id, period);

COMMENT ON TABLE public.tactical_ai_grants IS
  'Pizarra IA: cupo extra (USD) dado por el super admin, a un usuario o al techo de la escuela, para un mes.';

-- -----------------------------------------------------------------------------
-- 2. RLS: el usuario lee lo suyo; el admin de la escuela lee su escuela; el
--    super admin todo. Nadie escribe directo.
-- -----------------------------------------------------------------------------
ALTER TABLE public.tactical_ai_user_usage   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tactical_ai_school_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tactical_ai_runs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tactical_ai_grants       ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tactical_ai_user_usage   FROM PUBLIC, anon;
REVOKE ALL ON public.tactical_ai_school_usage FROM PUBLIC, anon;
REVOKE ALL ON public.tactical_ai_runs         FROM PUBLIC, anon;
REVOKE ALL ON public.tactical_ai_grants       FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tactical_ai_user_usage   FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tactical_ai_school_usage FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tactical_ai_runs         FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tactical_ai_grants       FROM authenticated;
GRANT SELECT ON public.tactical_ai_user_usage   TO authenticated;
GRANT SELECT ON public.tactical_ai_school_usage TO authenticated;
GRANT SELECT ON public.tactical_ai_runs         TO authenticated;
GRANT SELECT ON public.tactical_ai_grants       TO authenticated;
GRANT ALL ON public.tactical_ai_user_usage   TO service_role;
GRANT ALL ON public.tactical_ai_school_usage TO service_role;
GRANT ALL ON public.tactical_ai_runs         TO service_role;
GRANT ALL ON public.tactical_ai_grants       TO service_role;

DROP POLICY IF EXISTS tactical_ai_user_usage_select ON public.tactical_ai_user_usage;
CREATE POLICY tactical_ai_user_usage_select
  ON public.tactical_ai_user_usage
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

DROP POLICY IF EXISTS tactical_ai_school_usage_select ON public.tactical_ai_school_usage;
CREATE POLICY tactical_ai_school_usage_select
  ON public.tactical_ai_school_usage
  FOR SELECT
  TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

DROP POLICY IF EXISTS tactical_ai_runs_select ON public.tactical_ai_runs;
CREATE POLICY tactical_ai_runs_select
  ON public.tactical_ai_runs
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

DROP POLICY IF EXISTS tactical_ai_grants_select ON public.tactical_ai_grants;
CREATE POLICY tactical_ai_grants_select
  ON public.tactical_ai_grants
  FOR SELECT
  TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

-- -----------------------------------------------------------------------------
-- 3. Candados internos. ORDEN ÚNICO en todas las RPC: escuela → usuario → run.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tactical_ai_lock_school(p_school_id uuid, p_period text)
RETURNS public.tactical_ai_school_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row public.tactical_ai_school_usage;
BEGIN
  INSERT INTO public.tactical_ai_school_usage (school_id, period, ceiling_micro_usd)
  VALUES (p_school_id, p_period, public.tactical_ai_school_ceiling_micro_usd())
  ON CONFLICT (school_id, period) DO NOTHING;

  SELECT * INTO v_row
  FROM public.tactical_ai_school_usage
  WHERE school_id = p_school_id AND period = p_period
  FOR UPDATE;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public._tactical_ai_lock_user(p_school_id uuid, p_user_id uuid, p_period text)
RETURNS public.tactical_ai_user_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row public.tactical_ai_user_usage;
BEGIN
  INSERT INTO public.tactical_ai_user_usage (school_id, user_id, period, budget_micro_usd)
  VALUES (p_school_id, p_user_id, p_period, public.tactical_ai_user_budget_micro_usd())
  ON CONFLICT (school_id, user_id, period) DO NOTHING;

  SELECT * INTO v_row
  FROM public.tactical_ai_user_usage
  WHERE school_id = p_school_id AND user_id = p_user_id AND period = p_period
  FOR UPDATE;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public._tactical_ai_lock_school(uuid, text)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._tactical_ai_lock_user(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._tactical_ai_lock_school(uuid, text)     TO service_role;
GRANT EXECUTE ON FUNCTION public._tactical_ai_lock_user(uuid, uuid, text) TO service_role;

-- Saldo como JSON (sin bloquear ni crear filas: si faltan, el mes está en cero).
CREATE OR REPLACE FUNCTION public._tactical_ai_balance_json(p_school_id uuid, p_user_id uuid, p_period text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_u public.tactical_ai_user_usage;
  v_s public.tactical_ai_school_usage;
BEGIN
  SELECT * INTO v_s FROM public.tactical_ai_school_usage WHERE school_id = p_school_id AND period = p_period;
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_u FROM public.tactical_ai_user_usage
     WHERE school_id = p_school_id AND user_id = p_user_id AND period = p_period;
  END IF;
  RETURN jsonb_build_object(
    'period', p_period,
    'user', CASE WHEN p_user_id IS NULL THEN NULL ELSE jsonb_build_object(
      'budget_micro_usd',   COALESCE(v_u.budget_micro_usd, public.tactical_ai_user_budget_micro_usd()),
      'extra_micro_usd',    COALESCE(v_u.extra_micro_usd, 0),
      'used_micro_usd',     COALESCE(v_u.used_micro_usd, 0),
      'reserved_micro_usd', COALESCE(v_u.reserved_micro_usd, 0),
      'analyses',           COALESCE(v_u.analyses, 0),
      'cache_hits',         COALESCE(v_u.cache_hits, 0)
    ) END,
    'school', jsonb_build_object(
      'ceiling_micro_usd',  COALESCE(v_s.ceiling_micro_usd, public.tactical_ai_school_ceiling_micro_usd()),
      'extra_micro_usd',    COALESCE(v_s.extra_micro_usd, 0),
      'used_micro_usd',     COALESCE(v_s.used_micro_usd, 0),
      'reserved_micro_usd', COALESCE(v_s.reserved_micro_usd, 0)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public._tactical_ai_balance_json(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._tactical_ai_balance_json(uuid, uuid, text) TO service_role;

-- Libera las reservas vencidas de una escuela (BFF caído entre reservar y
-- cobrar). La llama tactical_ai_reserve con la fila de la escuela del mes ya
-- bloqueada; respeta el orden escuela → usuario → run de cada reserva.
CREATE OR REPLACE FUNCTION public._tactical_ai_expire_stale(p_school_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  r        record;
  v_status text;
  v_n      integer := 0;
BEGIN
  FOR r IN
    SELECT id, user_id, period, reserved_micro_usd
      FROM public.tactical_ai_runs
     WHERE school_id = p_school_id AND status = 'reserved'
       AND created_at < now() - public.tactical_ai_reservation_ttl()
     ORDER BY created_at
     LIMIT 50
  LOOP
    PERFORM public._tactical_ai_lock_school(p_school_id, r.period);
    IF r.user_id IS NOT NULL THEN
      PERFORM public._tactical_ai_lock_user(p_school_id, r.user_id, r.period);
    END IF;
    SELECT status INTO v_status FROM public.tactical_ai_runs WHERE id = r.id FOR UPDATE;
    CONTINUE WHEN v_status IS DISTINCT FROM 'reserved';

    UPDATE public.tactical_ai_runs SET status = 'expired', finished_at = now() WHERE id = r.id;
    IF r.user_id IS NOT NULL THEN
      UPDATE public.tactical_ai_user_usage
         SET reserved_micro_usd = GREATEST(reserved_micro_usd - r.reserved_micro_usd, 0), updated_at = now()
       WHERE school_id = p_school_id AND user_id = r.user_id AND period = r.period;
    END IF;
    UPDATE public.tactical_ai_school_usage
       SET reserved_micro_usd = GREATEST(reserved_micro_usd - r.reserved_micro_usd, 0), updated_at = now()
     WHERE school_id = p_school_id AND period = r.period;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public._tactical_ai_expire_stale(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._tactical_ai_expire_stale(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 4. RPCs del BFF (solo service_role).
-- -----------------------------------------------------------------------------

-- Reserva un estimado antes de llamar al modelo. Sin saldo → ok=false y
-- denied_scope ('user' | 'school'); se cuenta el intento y no se reserva nada.
CREATE OR REPLACE FUNCTION public.tactical_ai_reserve(
  p_school_id uuid,
  p_user_id uuid,
  p_sport text,
  p_estimate_micro_usd bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_period text := public.tactical_ai_current_period();
  v_s      public.tactical_ai_school_usage;
  v_u      public.tactical_ai_user_usage;
  v_scope  text;
  v_id     uuid;
BEGIN
  IF p_school_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'school_id y user_id requeridos' USING ERRCODE = '22023';
  END IF;
  IF p_estimate_micro_usd IS NULL OR p_estimate_micro_usd < 1 OR p_estimate_micro_usd > 5000000 THEN
    RAISE EXCEPTION 'estimado fuera de rango (1..5000000 microdólares)' USING ERRCODE = '22023';
  END IF;

  -- 1) escuela (candado que serializa todo lo de la escuela), 2) vencidas, 3) usuario.
  PERFORM public._tactical_ai_lock_school(p_school_id, v_period);
  PERFORM public._tactical_ai_expire_stale(p_school_id);
  SELECT * INTO v_s FROM public.tactical_ai_school_usage WHERE school_id = p_school_id AND period = v_period;
  v_u := public._tactical_ai_lock_user(p_school_id, p_user_id, v_period);

  IF v_u.budget_micro_usd + v_u.extra_micro_usd - v_u.used_micro_usd - v_u.reserved_micro_usd < p_estimate_micro_usd THEN
    v_scope := 'user';
  ELSIF v_s.ceiling_micro_usd + v_s.extra_micro_usd - v_s.used_micro_usd - v_s.reserved_micro_usd < p_estimate_micro_usd THEN
    v_scope := 'school';
  END IF;

  IF v_scope IS NOT NULL THEN
    UPDATE public.tactical_ai_user_usage
       SET needs_more_count = needs_more_count + 1, limit_hit_at = COALESCE(limit_hit_at, now()), updated_at = now()
     WHERE id = v_u.id;
    IF v_scope = 'school' THEN
      UPDATE public.tactical_ai_school_usage
         SET needs_more_count = needs_more_count + 1, limit_hit_at = COALESCE(limit_hit_at, now()), updated_at = now()
       WHERE id = v_s.id;
    END IF;
    INSERT INTO public.tactical_ai_runs (school_id, user_id, period, sport, status, denied_scope, finished_at)
    VALUES (p_school_id, p_user_id, v_period, p_sport, 'denied', v_scope, now());
    RETURN public._tactical_ai_balance_json(p_school_id, p_user_id, v_period)
           || jsonb_build_object('ok', false, 'denied_scope', v_scope);
  END IF;

  INSERT INTO public.tactical_ai_runs (school_id, user_id, period, sport, status, reserved_micro_usd)
  VALUES (p_school_id, p_user_id, v_period, p_sport, 'reserved', p_estimate_micro_usd)
  RETURNING id INTO v_id;
  UPDATE public.tactical_ai_user_usage
     SET reserved_micro_usd = reserved_micro_usd + p_estimate_micro_usd, updated_at = now()
   WHERE id = v_u.id;
  UPDATE public.tactical_ai_school_usage
     SET reserved_micro_usd = reserved_micro_usd + p_estimate_micro_usd, updated_at = now()
   WHERE id = v_s.id;

  RETURN public._tactical_ai_balance_json(p_school_id, p_user_id, v_period)
         || jsonb_build_object('ok', true, 'reservation_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.tactical_ai_reserve(uuid, uuid, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_reserve(uuid, uuid, text, bigint) TO service_role;

-- Cobra el costo REAL y libera la reserva. Idempotente: una reserva ya cerrada
-- no se cobra dos veces. Una vencida (ya liberada) igual se cobra: la plata se
-- gastó en el proveedor.
CREATE OR REPLACE FUNCTION public.tactical_ai_settle(
  p_reservation_id uuid,
  p_cost_micro_usd bigint,
  p_provider text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cache_read_tokens integer,
  p_cache_write_tokens integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_run   public.tactical_ai_runs;
  v_hold  bigint;
  v_cost  bigint := GREATEST(COALESCE(p_cost_micro_usd, 0), 0);
  v_in    integer := GREATEST(COALESCE(p_input_tokens, 0), 0);
  v_out   integer := GREATEST(COALESCE(p_output_tokens, 0), 0);
  v_cr    integer := GREATEST(COALESCE(p_cache_read_tokens, 0), 0);
  v_cw    integer := GREATEST(COALESCE(p_cache_write_tokens, 0), 0);
BEGIN
  SELECT * INTO v_run FROM public.tactical_ai_runs WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reserva inexistente' USING ERRCODE = 'P0002';
  END IF;
  IF v_cost > 10000000 THEN
    RAISE EXCEPTION 'costo fuera de rango' USING ERRCODE = '22023';
  END IF;

  PERFORM public._tactical_ai_lock_school(v_run.school_id, v_run.period);
  IF v_run.user_id IS NOT NULL THEN
    PERFORM public._tactical_ai_lock_user(v_run.school_id, v_run.user_id, v_run.period);
  END IF;
  SELECT * INTO v_run FROM public.tactical_ai_runs WHERE id = p_reservation_id FOR UPDATE;

  IF v_run.status NOT IN ('reserved', 'expired') THEN
    RETURN public._tactical_ai_balance_json(v_run.school_id, v_run.user_id, v_run.period)
           || jsonb_build_object('ok', true, 'already', v_run.status);
  END IF;
  v_hold := CASE WHEN v_run.status = 'reserved' THEN v_run.reserved_micro_usd ELSE 0 END;

  UPDATE public.tactical_ai_runs
     SET status = 'settled', cost_micro_usd = v_cost, finished_at = now(),
         provider = left(p_provider, 40), model = left(p_model, 120),
         input_tokens = v_in, output_tokens = v_out, cache_read_tokens = v_cr, cache_write_tokens = v_cw
   WHERE id = v_run.id;

  IF v_run.user_id IS NOT NULL THEN
    UPDATE public.tactical_ai_user_usage
       SET reserved_micro_usd = GREATEST(reserved_micro_usd - v_hold, 0),
           used_micro_usd = used_micro_usd + v_cost,
           analyses = analyses + 1,
           input_tokens = input_tokens + v_in, output_tokens = output_tokens + v_out,
           cache_read_tokens = cache_read_tokens + v_cr, cache_write_tokens = cache_write_tokens + v_cw,
           updated_at = now()
     WHERE school_id = v_run.school_id AND user_id = v_run.user_id AND period = v_run.period;
  END IF;
  UPDATE public.tactical_ai_school_usage
     SET reserved_micro_usd = GREATEST(reserved_micro_usd - v_hold, 0),
         used_micro_usd = used_micro_usd + v_cost,
         analyses = analyses + 1,
         updated_at = now()
   WHERE school_id = v_run.school_id AND period = v_run.period;

  RETURN public._tactical_ai_balance_json(v_run.school_id, v_run.user_id, v_run.period)
         || jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.tactical_ai_settle(uuid, bigint, text, text, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_settle(uuid, bigint, text, text, integer, integer, integer, integer) TO service_role;

-- El modelo falló / la salida no sirvió: se libera la reserva sin cobrar.
CREATE OR REPLACE FUNCTION public.tactical_ai_release(p_reservation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_run public.tactical_ai_runs;
BEGIN
  SELECT * INTO v_run FROM public.tactical_ai_runs WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reserva inexistente' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public._tactical_ai_lock_school(v_run.school_id, v_run.period);
  IF v_run.user_id IS NOT NULL THEN
    PERFORM public._tactical_ai_lock_user(v_run.school_id, v_run.user_id, v_run.period);
  END IF;
  SELECT * INTO v_run FROM public.tactical_ai_runs WHERE id = p_reservation_id FOR UPDATE;

  IF v_run.status = 'reserved' THEN
    UPDATE public.tactical_ai_runs SET status = 'released', finished_at = now() WHERE id = v_run.id;
    IF v_run.user_id IS NOT NULL THEN
      UPDATE public.tactical_ai_user_usage
         SET reserved_micro_usd = GREATEST(reserved_micro_usd - v_run.reserved_micro_usd, 0), updated_at = now()
       WHERE school_id = v_run.school_id AND user_id = v_run.user_id AND period = v_run.period;
    END IF;
    UPDATE public.tactical_ai_school_usage
       SET reserved_micro_usd = GREATEST(reserved_micro_usd - v_run.reserved_micro_usd, 0), updated_at = now()
     WHERE school_id = v_run.school_id AND period = v_run.period;
  END IF;

  RETURN public._tactical_ai_balance_json(v_run.school_id, v_run.user_id, v_run.period)
         || jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.tactical_ai_release(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_release(uuid) TO service_role;

-- Misma jugada ya analizada en la escuela: USD 0, solo se cuenta.
CREATE OR REPLACE FUNCTION public.tactical_ai_record_cache_hit(p_school_id uuid, p_user_id uuid, p_sport text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_period text := public.tactical_ai_current_period();
  v_u      public.tactical_ai_user_usage;
BEGIN
  IF p_school_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'school_id y user_id requeridos' USING ERRCODE = '22023';
  END IF;
  PERFORM public._tactical_ai_lock_school(p_school_id, v_period);
  v_u := public._tactical_ai_lock_user(p_school_id, p_user_id, v_period);
  UPDATE public.tactical_ai_user_usage SET cache_hits = cache_hits + 1, updated_at = now() WHERE id = v_u.id;
  INSERT INTO public.tactical_ai_runs (school_id, user_id, period, sport, status, finished_at)
  VALUES (p_school_id, p_user_id, v_period, p_sport, 'cache_hit', now());
  RETURN public._tactical_ai_balance_json(p_school_id, p_user_id, v_period) || jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.tactical_ai_record_cache_hit(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_record_cache_hit(uuid, uuid, text) TO service_role;

-- Saldo del mes en curso (sin crear filas). El BFF ya validó quién pregunta.
CREATE OR REPLACE FUNCTION public.tactical_ai_user_balance(p_school_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_school_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'school_id y user_id requeridos' USING ERRCODE = '22023';
  END IF;
  RETURN public._tactical_ai_balance_json(p_school_id, p_user_id, public.tactical_ai_current_period())
         || jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.tactical_ai_user_balance(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_user_balance(uuid, uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 5. Más cupo (super admin). Gate interno: authenticated tiene EXECUTE para que
--    el super admin la llame con su sesión (queda como granted_by).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_tactical_ai_credits(
  p_school_id uuid,
  p_amount_usd numeric,
  p_user_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_period text := public.tactical_ai_current_period();
  v_micro  bigint;
  v_s      public.tactical_ai_school_usage;
  v_u      public.tactical_ai_user_usage;
BEGIN
  -- service_role (BFF), super admin con su sesión, o la consola SQL SIN sesión
  -- simulada (una sesión con claims de authenticated/anon no pasa por ahí).
  IF NOT (
    COALESCE((SELECT auth.jwt()) ->> 'role', '') = 'service_role'
    OR (session_user IN ('postgres', 'supabase_admin')
        AND COALESCE((SELECT auth.jwt()) ->> 'role', '') NOT IN ('authenticated', 'anon'))
    OR COALESCE((SELECT public.is_super_admin()), false)
  ) THEN
    RAISE EXCEPTION 'solo super admin o service_role' USING ERRCODE = '42501';
  END IF;
  IF p_school_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id) THEN
    RAISE EXCEPTION 'escuela inexistente' USING ERRCODE = '22023';
  END IF;
  IF p_amount_usd IS NULL OR p_amount_usd < 0.01 OR p_amount_usd > 1000 THEN
    RAISE EXCEPTION 'p_amount_usd debe estar entre 0.01 y 1000' USING ERRCODE = '22023';
  END IF;
  IF p_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.school_members sm
     WHERE sm.school_id = p_school_id AND sm.profile_id = p_user_id AND sm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'el usuario no es miembro activo de la escuela' USING ERRCODE = '22023';
  END IF;
  v_micro := round(p_amount_usd * 1000000)::bigint;

  v_s := public._tactical_ai_lock_school(p_school_id, v_period);
  IF p_user_id IS NOT NULL THEN
    v_u := public._tactical_ai_lock_user(p_school_id, p_user_id, v_period);
    UPDATE public.tactical_ai_user_usage
       SET extra_micro_usd = extra_micro_usd + v_micro, updated_at = now()
     WHERE id = v_u.id;
  END IF;
  -- Con o sin usuario, el techo de la escuela sube lo mismo (lo regalado a un
  -- coach no puede quedar frenado por el techo).
  UPDATE public.tactical_ai_school_usage
     SET extra_micro_usd = extra_micro_usd + v_micro, updated_at = now()
   WHERE id = v_s.id;

  INSERT INTO public.tactical_ai_grants (school_id, user_id, period, amount_micro_usd, note, granted_by)
  VALUES (p_school_id, p_user_id, v_period, v_micro, left(p_note, 300), (SELECT auth.uid()));

  RETURN public._tactical_ai_balance_json(p_school_id, p_user_id, v_period)
         || jsonb_build_object('ok', true, 'granted_micro_usd', v_micro);
END;
$$;

REVOKE ALL ON FUNCTION public.grant_tactical_ai_credits(uuid, numeric, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_tactical_ai_credits(uuid, numeric, uuid, text) TO authenticated, service_role;

-- Compatibilidad con la firma de 20261014111442 («N análisis» a la escuela):
-- N análisis = N × USD 0,08 (el estimado de reserva) de techo de escuela.
CREATE OR REPLACE FUNCTION public.grant_tactical_ai_credits(p_school_id uuid, p_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'p_amount debe estar entre 1 y 10000' USING ERRCODE = '22023';
  END IF;
  RETURN public.grant_tactical_ai_credits(
    p_school_id, (p_amount * 0.08)::numeric, NULL::uuid,
    'compat: ' || p_amount || ' análisis (firma vieja, 20261014111442)');
END;
$$;

REVOKE ALL ON FUNCTION public.grant_tactical_ai_credits(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_tactical_ai_credits(uuid, integer) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. Lo obsoleto de 20261014111442: se conserva sin borrar datos, congelado.
-- -----------------------------------------------------------------------------
COMMENT ON TABLE public.tactical_ai_credits IS
  'OBSOLETA desde 20261014155445: el cupo pasó a costo real por usuario (tactical_ai_user_usage / tactical_ai_school_usage). Se conserva solo lectura; nadie la mueve.';
COMMENT ON FUNCTION public.tactical_ai_free_quota() IS
  'OBSOLETA desde 20261014155445 (cupo en número de análisis). Ver tactical_ai_user_budget_micro_usd().';
COMMENT ON FUNCTION public.consume_tactical_ai_credit(uuid) IS
  'OBSOLETA desde 20261014155445. Usar tactical_ai_reserve / tactical_ai_settle / tactical_ai_release.';
COMMENT ON FUNCTION public.refund_tactical_ai_credit(uuid) IS
  'OBSOLETA desde 20261014155445. Usar tactical_ai_release.';
COMMENT ON FUNCTION public.tactical_ai_balance(uuid) IS
  'OBSOLETA desde 20261014155445. Usar tactical_ai_user_balance.';
REVOKE EXECUTE ON FUNCTION public.consume_tactical_ai_credit(uuid) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.refund_tactical_ai_credit(uuid)  FROM service_role;

COMMIT;


-- ───────────────────────────────────────────────────────────────────────────
-- [6/10] PIZARRA  ·  20261014163705_pizarra_notas_y_videos.sql
-- origen: pizarra-tp/integracion:supabase/migrations/20261014163705_pizarra_notas_y_videos.sql
-- ───────────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261014163705_pizarra_notas_y_videos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014125632
-- Objetivo: M6c de docs/specs/pizarra-m6-paridad-tacticalpad.md — notas y
--   videos por jugada y por cuadro, y «Videos guardados» por escuela.
--
--   1. Funciones de forma (IMMUTABLE) tactical_play_notes_ok / tactical_play_videos_ok,
--      usadas por los CHECK de las tres tablas de jugadas.
--   2. match_lineups / team_tactical_presets: columnas notes jsonb + videos jsonb
--      (NULL = sin notas ni videos: retrocompatible, sin reescribir filas).
--   3. training_exercises: notes/videos viajan DENTRO de board (board.notes,
--      board.videos): CHECK de forma sobre esas dos llaves.
--   4. public.tactical_saved_videos: enlaces guardados por escuela.
--      RLS: leen staff (user_staff_school_ids()); escriben quienes editan la
--      pizarra (user_tactical_edit_school_ids()). anon nada. Padres y atletas
--      no leen (la jugada es solo del cuerpo técnico desde 20261005173002).
--   5. insert_exercise_into_session_block: copia también board.notes /
--      board.videos a la jugada del bloque (mismo cuerpo que 20261013200604,
--      solo se agregan esas dos columnas).
--
-- ── Decisión: columnas jsonb + una tabla (y no una tabla de medios) ──────────
--   · La nota y los videos SON parte de la jugada: se guardan, se copian
--     («Insertar en sesión», paquetes) y se exportan junto con ella. En jsonb
--     viajan en la misma escritura que frames/arrows (sin transacción extra, sin
--     joins en las lecturas de la pizarra) y una jugada vieja sigue igual (NULL).
--   · La nota de cada CUADRO va dentro de frames[i].note: así sigue al cuadro
--     al reordenar, duplicar o borrar, y ya la cubre el CHECK de tamaño de
--     frames (512 KB). El BFF limita cada nota a 280 caracteres.
--   · training_exercises ya guarda la jugada en `board` (jsonb con su CHECK de
--     512 KB): notes/videos van ahí y import_exercise_pack los inserta tal cual,
--     sin tocar esa RPC.
--   · «Videos guardados» sí es una tabla: es una biblioteca de la ESCUELA que se
--     reusa en muchas jugadas, con dueño, borrado y RLS propia.
--
-- ── Proveedores ───────────────────────────────────────────────────────────────
--   youtube / vimeo: se guarda el id (regex estricta) y el frontend arma el
--   embed (youtube-nocookie.com / player.vimeo.com). veo, hudl, trace, pixellot
--   (también VidSwap), spiideo, xbotgo, reeplayer, drive, dropbox: se guarda la
--   URL https de un dominio de la lista exacta y se abre en otra pestaña (no
--   tienen embed público verificado). 'sportmaps' (subir desde el celular, M6h)
--   queda RESERVADO: exige asset_id uuid y nada lo crea todavía.
--   Cero almacenamiento: ningún archivo se sube.
--
-- ── Radio (leído del repo; sin consultar la base para no gastar Disk IO) ──────
--   · match_lineups / team_tactical_presets: ADD COLUMN NULL sin default =
--     solo catálogo, sin reescritura. Los CHECK nuevos se validan sobre filas
--     con notes/videos NULL (todas): pasan sin costo apreciable.
--   · training_exercises: ~28 filas (plantillas) con board sin notes/videos:
--     el CHECK nuevo pasa en todas.
--   · Policies existentes de las tres tablas: no se tocan (las columnas nuevas
--     quedan bajo las mismas policies de lectura staff / escritura táctica).
--   · tactical_saved_videos: tabla nueva, vacía. Nadie pierde nada.
--   · La RPC se reemplaza con la MISMA firma, gate y grants.
--
-- Depende de: 20261008155454 (frames), 20261008183744 (training_exercises),
-- 20261013200604 (RPC vigente + helpers), helpers user_*_school_ids().
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 0. Dependencias ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.training_exercises') IS NULL THEN
    RAISE EXCEPTION 'Falta public.training_exercises: aplicar 20261008183744 antes que esta migración.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'match_lineups' AND column_name = 'frames') THEN
    RAISE EXCEPTION 'Falta match_lineups.frames: aplicar 20261008155454 antes que esta migración.';
  END IF;
  IF to_regprocedure('public.user_tactical_edit_school_ids()') IS NULL
     OR to_regprocedure('public.user_staff_school_ids()') IS NULL THEN
    RAISE EXCEPTION 'Faltan los helpers de RLS user_*_school_ids().';
  END IF;
END $$;

-- ─── 1. Funciones de forma ──────────────────────────────────────────────────
-- Un dominio de enlace: https://<host exacto>/<algo>, sin usuario ni puerto.
CREATE OR REPLACE FUNCTION public.tactical_video_url_ok(p_provider text, p_url text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p_url IS NOT NULL
     AND char_length(p_url) <= 500
     AND p_url !~ '[[:space:]<>"`\\]'
     AND CASE p_provider
       WHEN 'veo'       THEN p_url ~ '^https://(www\.|app\.)?veo\.co/[^/?#]'
       WHEN 'hudl'      THEN p_url ~ '^https://(www\.|fan\.)?hudl\.com/[^/?#]'
       WHEN 'trace'     THEN p_url ~ '^https://(www\.|app\.)?traceup\.com/[^/?#]'
       WHEN 'pixellot'  THEN p_url ~ '^https://((www\.|app\.)?pixellot\.tv|(www\.)?vidswap\.com)/[^/?#]'
       WHEN 'spiideo'   THEN p_url ~ '^https://(www\.|play\.|app\.)?spiideo\.com/[^/?#]'
       WHEN 'xbotgo'    THEN p_url ~ '^https://(www\.|app\.)?xbotgo\.com/[^/?#]'
       WHEN 'reeplayer' THEN p_url ~ '^https://(www\.|app\.)?reeplayer\.com/[^/?#]'
       WHEN 'drive'     THEN p_url ~ '^https://drive\.google\.com/file/d/[A-Za-z0-9_-]{20,100}/view$'
       WHEN 'dropbox'   THEN p_url ~ '^https://(www\.)?dropbox\.com/(s|scl/fi)/'
       ELSE false
     END
$$;

-- Un video (elemento de videos o fila de tactical_saved_videos).
CREATE OR REPLACE FUNCTION public.tactical_video_ok(
  p_provider text, p_video_id text, p_hash text, p_url text, p_asset_id text,
  p_title text, p_start int, p_end int
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE(
       p_title IS NOT NULL AND char_length(btrim(p_title)) BETWEEN 1 AND 120
       AND p_start IS NOT NULL AND p_start BETWEEN 0 AND 21600
       AND (p_end IS NULL OR (p_end > p_start AND p_end <= 21600))
       AND CASE p_provider
         WHEN 'youtube'   THEN p_video_id ~ '^[A-Za-z0-9_-]{11}$' AND p_hash IS NULL AND p_url IS NULL AND p_asset_id IS NULL
         WHEN 'vimeo'     THEN p_video_id ~ '^[0-9]{6,12}$' AND (p_hash IS NULL OR p_hash ~ '^[0-9a-f]{6,20}$') AND p_url IS NULL AND p_asset_id IS NULL
         -- Reservado para M6h (video subido): solo la forma, nada lo crea todavía.
         WHEN 'sportmaps' THEN p_asset_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND p_url IS NULL AND p_hash IS NULL
         WHEN 'drive'     THEN public.tactical_video_url_ok(p_provider, p_url) AND p_hash IS NULL AND p_asset_id IS NULL
                               AND (p_video_id IS NULL OR p_video_id ~ '^[A-Za-z0-9_-]{20,100}$')
         WHEN 'veo' THEN true WHEN 'hudl' THEN true WHEN 'trace' THEN true WHEN 'pixellot' THEN true
         WHEN 'spiideo' THEN true WHEN 'xbotgo' THEN true WHEN 'reeplayer' THEN true WHEN 'dropbox' THEN true
         ELSE false
       END
       AND (p_provider NOT IN ('veo','hudl','trace','pixellot','spiideo','xbotgo','reeplayer','dropbox')
            OR (public.tactical_video_url_ok(p_provider, p_url) AND p_video_id IS NULL AND p_hash IS NULL AND p_asset_id IS NULL)),
     false)
$$;

-- notes = { text ≤ 2000, tags ≤ 10 de ≤ 40 }, nada más.
CREATE OR REPLACE FUNCTION public.tactical_play_notes_ok(p jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p IS NULL OR CASE WHEN jsonb_typeof(p) <> 'object' THEN false ELSE (
       octet_length(p::text) <= 16384
       AND NOT EXISTS (SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN ('text', 'tags'))
       AND (NOT p ? 'text' OR (jsonb_typeof(p->'text') = 'string' AND char_length(p->>'text') <= 2000))
       AND (NOT p ? 'tags' OR CASE WHEN jsonb_typeof(p->'tags') <> 'array' THEN false ELSE (
             jsonb_array_length(p->'tags') <= 10
             AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p->'tags') t
                              WHERE jsonb_typeof(t) <> 'string' OR char_length(t #>> '{}') NOT BETWEEN 1 AND 40)
           ) END)
     ) END
$$;

-- videos = [video, …] ≤ 10.
CREATE OR REPLACE FUNCTION public.tactical_play_videos_ok(p jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p IS NULL OR CASE WHEN jsonb_typeof(p) <> 'array' THEN false ELSE (
       jsonb_array_length(p) <= 10
       AND octet_length(p::text) <= 16384
       AND NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(p) v
          WHERE jsonb_typeof(v) <> 'object'
             OR (v ? 'is_private' AND jsonb_typeof(v->'is_private') <> 'boolean')
             OR (v ? 'start_s' AND jsonb_typeof(v->'start_s') <> 'number')
             OR (v ? 'end_s' AND jsonb_typeof(v->'end_s') NOT IN ('number', 'null'))
             OR NOT public.tactical_video_ok(
                  v->>'provider', v->>'video_id', v->>'hash', v->>'url', v->>'asset_id', v->>'title',
                  CASE WHEN jsonb_typeof(v->'start_s') = 'number' AND (v->>'start_s') ~ '^[0-9]{1,6}$' THEN (v->>'start_s')::int
                       WHEN v ? 'start_s' THEN -1 ELSE 0 END,
                  CASE WHEN jsonb_typeof(v->'end_s') = 'number' AND (v->>'end_s') ~ '^[0-9]{1,6}$' THEN (v->>'end_s')::int
                       WHEN jsonb_typeof(v->'end_s') = 'number' THEN -1 ELSE NULL END)
       )
     ) END
$$;

-- Usadas en CHECK: las evalúa quien escribe. EXECUTE explícito a quien escribe
-- las tablas (authenticated por RLS, service_role por el BFF); anon no escribe.
REVOKE ALL ON FUNCTION public.tactical_video_url_ok(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tactical_video_ok(text, text, text, text, text, text, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tactical_play_notes_ok(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tactical_play_videos_ok(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tactical_video_url_ok(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tactical_video_ok(text, text, text, text, text, text, int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tactical_play_notes_ok(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tactical_play_videos_ok(jsonb) TO authenticated, service_role;

-- ─── 2. Columnas de las jugadas ─────────────────────────────────────────────
ALTER TABLE public.match_lineups
  ADD COLUMN IF NOT EXISTS notes jsonb,
  ADD COLUMN IF NOT EXISTS videos jsonb;
ALTER TABLE public.team_tactical_presets
  ADD COLUMN IF NOT EXISTS notes jsonb,
  ADD COLUMN IF NOT EXISTS videos jsonb;

ALTER TABLE public.match_lineups DROP CONSTRAINT IF EXISTS match_lineups_media_shape_check;
ALTER TABLE public.match_lineups
  ADD CONSTRAINT match_lineups_media_shape_check
  CHECK (public.tactical_play_notes_ok(notes) AND public.tactical_play_videos_ok(videos));

ALTER TABLE public.team_tactical_presets DROP CONSTRAINT IF EXISTS team_tactical_presets_media_shape_check;
ALTER TABLE public.team_tactical_presets
  ADD CONSTRAINT team_tactical_presets_media_shape_check
  CHECK (public.tactical_play_notes_ok(notes) AND public.tactical_play_videos_ok(videos));

COMMENT ON COLUMN public.match_lineups.notes IS
  'Pizarra M6c: nota de la jugada { text (markdown mínimo ≤ 2000), tags[] ≤ 10 }. NULL = sin nota. Notas por cuadro: frames[i].note.';
COMMENT ON COLUMN public.match_lineups.videos IS
  'Pizarra M6c: videos por enlace [{provider, video_id|url|asset_id, hash?, title, start_s, end_s, is_private}] ≤ 10. Sin archivos.';
COMMENT ON COLUMN public.team_tactical_presets.notes IS 'Pizarra M6c: igual que match_lineups.notes.';
COMMENT ON COLUMN public.team_tactical_presets.videos IS 'Pizarra M6c: igual que match_lineups.videos.';

-- ─── 3. training_exercises: board.notes / board.videos ──────────────────────
ALTER TABLE public.training_exercises DROP CONSTRAINT IF EXISTS training_exercises_board_media_check;
ALTER TABLE public.training_exercises
  ADD CONSTRAINT training_exercises_board_media_check
  CHECK (public.tactical_play_notes_ok(NULLIF(board->'notes', 'null'::jsonb))
     AND public.tactical_play_videos_ok(NULLIF(board->'videos', 'null'::jsonb)));

-- ─── 4. tactical_saved_videos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tactical_saved_videos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  provider    text NOT NULL CHECK (provider IN (
                'youtube','vimeo','veo','hudl','trace','pixellot','spiideo','xbotgo','reeplayer','drive','dropbox','sportmaps')),
  video_id    text,
  hash        text,
  url         text,
  asset_id    uuid,
  title       text NOT NULL,
  start_s     integer NOT NULL DEFAULT 0,
  end_s       integer,
  -- «Enlace privado»: no sale en exportaciones públicas (PDF, paquetes).
  is_private  boolean NOT NULL DEFAULT false,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tactical_saved_videos_shape_check CHECK (
    public.tactical_video_ok(provider, video_id, hash, url, asset_id::text, title, start_s, end_s)
  )
);

COMMENT ON TABLE public.tactical_saved_videos IS
  'Pizarra M6c: «Videos guardados» de la escuela (solo enlaces, cero almacenamiento). Leen staff; escriben quienes editan la pizarra.';

CREATE INDEX IF NOT EXISTS tactical_saved_videos_school_idx
  ON public.tactical_saved_videos (school_id, created_at DESC);
-- El mismo video con el mismo inicio no se guarda dos veces en la escuela.
CREATE UNIQUE INDEX IF NOT EXISTS tactical_saved_videos_unique_idx
  ON public.tactical_saved_videos (school_id, provider, COALESCE(video_id, url, asset_id::text), start_s);

DROP TRIGGER IF EXISTS tactical_saved_videos_set_updated_at ON public.tactical_saved_videos;
CREATE TRIGGER tactical_saved_videos_set_updated_at
  BEFORE UPDATE ON public.tactical_saved_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tactical_saved_videos ENABLE ROW LEVEL SECURITY;

-- Los default privileges del esquema dan todo a anon/authenticated: explícito.
REVOKE ALL ON public.tactical_saved_videos FROM PUBLIC;
REVOKE ALL ON public.tactical_saved_videos FROM anon;
REVOKE ALL ON public.tactical_saved_videos FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tactical_saved_videos TO authenticated;
GRANT ALL ON public.tactical_saved_videos TO service_role;

-- Una policy por comando (nada de FOR ALL), helpers envueltos en (SELECT …)
-- para que se evalúen una vez por consulta. Sin SELECT sobre esta tabla.
DROP POLICY IF EXISTS tactical_saved_videos_select ON public.tactical_saved_videos;
CREATE POLICY tactical_saved_videos_select ON public.tactical_saved_videos
  FOR SELECT TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

DROP POLICY IF EXISTS tactical_saved_videos_insert ON public.tactical_saved_videos;
CREATE POLICY tactical_saved_videos_insert ON public.tactical_saved_videos
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[])
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS tactical_saved_videos_update ON public.tactical_saved_videos;
CREATE POLICY tactical_saved_videos_update ON public.tactical_saved_videos
  FOR UPDATE TO authenticated
  USING (school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[]))
  WITH CHECK (school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[]));

DROP POLICY IF EXISTS tactical_saved_videos_delete ON public.tactical_saved_videos;
CREATE POLICY tactical_saved_videos_delete ON public.tactical_saved_videos
  FOR DELETE TO authenticated
  USING (school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[]));

-- ─── 5. RPC: copiar notes/videos del ejercicio al bloque ────────────────────
-- Cuerpo idéntico a 20261013200604 salvo v_notes / v_videos (comentados «M6c»).
CREATE OR REPLACE FUNCTION public.insert_exercise_into_session_block(
  p_exercise_id uuid,
  p_session_id  uuid,
  p_block_id    uuid,
  p_team_id     uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_ex         public.training_exercises%ROWTYPE;
  v_school     uuid;
  v_team       uuid;
  v_blocks     jsonb;
  v_block      jsonb;
  v_found      boolean := false;
  v_board      jsonb;
  v_arrows     jsonb;
  v_frames     jsonb;
  v_notes      jsonb;  -- M6c
  v_videos     jsonb;  -- M6c
  v_lineup_id  uuid;
  v_lineup_sch uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  IF p_exercise_id IS NULL OR p_block_id IS NULL THEN
    RAISE EXCEPTION 'p_exercise_id y p_block_id son requeridos.' USING ERRCODE = '22023';
  END IF;

  IF p_session_id IS NOT NULL THEN
    SELECT ts.school_id, ts.team_id, COALESCE(ts.session_blocks, '[]'::jsonb)
      INTO v_school, v_team, v_blocks
      FROM public.training_sessions ts
     WHERE ts.id = p_session_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sesión no encontrada.' USING ERRCODE = 'P0002';
    END IF;
    IF p_team_id IS NOT NULL AND p_team_id <> v_team THEN
      RAISE EXCEPTION 'El equipo no corresponde a la sesión.' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_blocks) <> 'array' THEN
      v_blocks := '[]'::jsonb;
    END IF;
  ELSE
    IF p_team_id IS NULL THEN
      RAISE EXCEPTION 'Sin sesión hace falta p_team_id.' USING ERRCODE = '22023';
    END IF;
    SELECT t.school_id, t.id INTO v_school, v_team
      FROM public.teams t WHERE t.id = p_team_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Equipo no encontrado.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF v_school IS NULL OR NOT (v_school = ANY (public.user_tactical_edit_school_ids())) THEN
    RAISE EXCEPTION 'No tienes permiso sobre esta sesión.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ex
    FROM public.training_exercises e
   WHERE e.id = p_exercise_id
     AND e.is_active
   FOR UPDATE;
  IF NOT FOUND
     OR NOT ((v_ex.school_id IS NULL AND v_ex.is_template) OR v_ex.school_id = v_school) THEN
    RAISE EXCEPTION 'Ejercicio no encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF p_session_id IS NOT NULL THEN
    SELECT jsonb_agg(
             CASE WHEN b.elem->>'id' = p_block_id::text THEN
               b.elem
               || jsonb_build_object(
                    'name',        CASE WHEN COALESCE(btrim(b.elem->>'name'), '') = '' THEN v_ex.name ELSE b.elem->>'name' END,
                    'activity',    CASE WHEN COALESCE(btrim(b.elem->>'activity'), '') = '' THEN v_ex.name ELSE b.elem->>'activity' END,
                    'minutes',     CASE WHEN COALESCE(btrim(b.elem->>'minutes'), '') = '' THEN COALESCE(v_ex.minutes::text, '') ELSE b.elem->>'minutes' END,
                    'objective',   CASE WHEN COALESCE(btrim(b.elem->>'objective'), '') = '' THEN COALESCE(v_ex.objective, '') ELSE b.elem->>'objective' END,
                    'description', CASE WHEN COALESCE(btrim(b.elem->>'description'), '') = '' THEN COALESCE(v_ex.description, '') ELSE b.elem->>'description' END,
                    'exercise_id', v_ex.id
                  )
             ELSE b.elem END
             ORDER BY b.ord
           ),
           bool_or(b.elem->>'id' = p_block_id::text)
      INTO v_blocks, v_found
      FROM jsonb_array_elements(v_blocks) WITH ORDINALITY AS b(elem, ord);

    v_blocks := COALESCE(v_blocks, '[]'::jsonb);
    IF NOT COALESCE(v_found, false) THEN
      v_blocks := v_blocks || jsonb_build_array(jsonb_build_object(
        'id', p_block_id,
        'name', v_ex.name,
        'minutes', COALESCE(v_ex.minutes::text, ''),
        'activity', v_ex.name,
        'objective', COALESCE(v_ex.objective, ''),
        'description', COALESCE(v_ex.description, ''),
        'component', '',
        'exercise_id', v_ex.id
      ));
    END IF;

    UPDATE public.training_sessions
       SET session_blocks = v_blocks, updated_at = now()
     WHERE id = p_session_id;

    SELECT elem INTO v_block
      FROM jsonb_array_elements(v_blocks) AS elem
     WHERE elem->>'id' = p_block_id::text
     LIMIT 1;
  END IF;

  v_board  := COALESCE(v_ex.board, '{}'::jsonb);
  v_arrows := CASE WHEN jsonb_typeof(v_board->'arrows') = 'array' THEN v_board->'arrows' ELSE '[]'::jsonb END;
  v_frames := CASE WHEN jsonb_typeof(v_board->'frames') = 'array' THEN v_board->'frames' ELSE '[]'::jsonb END;
  -- M6c: la nota y los videos del ejercicio pasan a la jugada del bloque (el
  -- CHECK de training_exercises ya garantiza la misma forma que exige match_lineups).
  v_notes  := CASE WHEN jsonb_typeof(v_board->'notes') = 'object' THEN v_board->'notes' ELSE NULL END;
  v_videos := CASE WHEN jsonb_typeof(v_board->'videos') = 'array' AND jsonb_array_length(v_board->'videos') > 0
                   THEN v_board->'videos' ELSE NULL END;
  IF jsonb_array_length(v_frames) = 0
     AND jsonb_typeof(v_board->'players') = 'array'
     AND jsonb_array_length(v_board->'players') > 0 THEN
    v_frames := jsonb_build_array(jsonb_build_object(
      'id', 'f1',
      'duration_ms', 1200,
      'players', (SELECT COALESCE(jsonb_agg(jsonb_build_object('key', p->>'key', 'x', p->'x', 'y', p->'y')), '[]'::jsonb)
                    FROM jsonb_array_elements(v_board->'players') AS p),
      'ball', NULL,
      'arrows', v_arrows
    ));
  END IF;

  SELECT ml.id, ml.school_id INTO v_lineup_id, v_lineup_sch
    FROM public.match_lineups ml
   WHERE ml.source_type = 'training_session'
     AND ml.source_id = p_block_id
   FOR UPDATE;

  IF v_lineup_id IS NOT NULL THEN
    IF v_lineup_sch <> v_school THEN
      RAISE EXCEPTION 'El bloque pertenece a otra escuela.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.match_lineups
       SET team_id = v_team, arrows = v_arrows, frames = v_frames, formation = NULL,
           notes = v_notes, videos = v_videos, updated_at = now()
     WHERE id = v_lineup_id;
    DELETE FROM public.match_lineup_players WHERE lineup_id = v_lineup_id;
  ELSE
    INSERT INTO public.match_lineups (school_id, team_id, source_type, source_id, formation, arrows, frames, notes, videos, created_by)
    VALUES (v_school, v_team, 'training_session', p_block_id, NULL, v_arrows, v_frames, v_notes, v_videos, v_uid)
    RETURNING id INTO v_lineup_id;
  END IF;

  UPDATE public.training_exercises SET times_used = times_used + 1 WHERE id = v_ex.id;

  RETURN jsonb_build_object(
    'lineup_id',   v_lineup_id,
    'session_id',  p_session_id,
    'block_id',    p_block_id,
    'exercise_id', v_ex.id,
    'block',       v_block
  );
END;
$$;

COMMENT ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) IS
  'Biblioteca T3: copia un ejercicio a un bloque de sesión (bloque + match_lineups con frames, notes y videos) en una transacción. Exige user_tactical_edit_school_ids() (20261013200604; notas/videos 20261014163705).';

REVOKE ALL ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) TO service_role;

COMMIT;

-- ═════════════ PARTE 2 — FACTURACIÓN SaaS (esquema) ═════════════

-- ───────────────────────────────────────────────────────────────────────────
-- [7/10] FACTURACIÓN  ·  20261015124518_acuerdos_comerciales_saas.sql
-- origen: wt-facturacion:supabase/migrations/20261015124518_acuerdos_comerciales_saas.sql
-- ───────────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261015124518_acuerdos_comerciales_saas.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-15   Versión anterior: 20261014215112
-- Objetivo: que la facturación SaaS de UNA escuela soporte un acuerdo comercial:
--   precios que cambian en el tiempo, cobros únicos/anuales aparte y vencimiento
--   configurable. Las demás escuelas NO cambian: due_offset_days = 5 por defecto,
--   y sin filas en las tablas nuevas el precio sale igual que antes.
--
--   1. school_subscriptions.due_offset_days (0..28, default 5)
--   2. school_billing_schedule  - escalones de precio mensual del plan por fecha
--   3. school_one_time_charges  - cobros únicos o recurrentes cada N meses
--   4. admin_set_school_billing_agreement(...) - RPC de administración (gate igual
--      al de admin_set_school_custom_price: super_admin / service_role)
--   5. generate_school_subscription_invoice - base: definición VIVA al 2026-10-15;
--      cambios marcados con "ACUERDO:".
-- Precedencia del precio del plan: escalón del schedule (mayor effective_from <=
--   period_start) > custom_price_cents > catálogo por plan_code.
-- =============================================================================

BEGIN;

-- 1. Vencimiento configurable ------------------------------------------------
ALTER TABLE public.school_subscriptions
  ADD COLUMN IF NOT EXISTS due_offset_days smallint NOT NULL DEFAULT 5;

ALTER TABLE public.school_subscriptions
  DROP CONSTRAINT IF EXISTS school_subscriptions_due_offset_days_check;
ALTER TABLE public.school_subscriptions
  ADD CONSTRAINT school_subscriptions_due_offset_days_check
  CHECK (due_offset_days BETWEEN 0 AND 28);

-- 2. Escalones de precio -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_billing_schedule (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  effective_from      date NOT NULL,
  monthly_price_cents integer NOT NULL CHECK (monthly_price_cents >= 0),
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, effective_from)
);

-- 3. Cobros únicos / recurrentes --------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_one_time_charges (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code                text NOT NULL,
  label               text NOT NULL,
  amount_cents        integer NOT NULL CHECK (amount_cents >= 0),
  next_bill_on        date NOT NULL,
  renews_every_months smallint CHECK (renews_every_months IS NULL OR renews_every_months > 0),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'billed')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_one_time_charges_school_active
  ON public.school_one_time_charges (school_id) WHERE status = 'active';

-- RLS: lectura super_admin o administración de esa escuela (NO user_school_ids(),
-- que incluye padres y atletas); escritura solo super_admin.
ALTER TABLE public.school_billing_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_one_time_charges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.school_billing_schedule FROM PUBLIC, anon;
REVOKE ALL ON public.school_one_time_charges FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_billing_schedule TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_one_time_charges TO authenticated;

DROP POLICY IF EXISTS school_billing_schedule_select ON public.school_billing_schedule;
CREATE POLICY school_billing_schedule_select ON public.school_billing_schedule
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR school_id = ANY (public.user_admin_school_ids()));
DROP POLICY IF EXISTS school_billing_schedule_insert ON public.school_billing_schedule;
CREATE POLICY school_billing_schedule_insert ON public.school_billing_schedule
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS school_billing_schedule_update ON public.school_billing_schedule;
CREATE POLICY school_billing_schedule_update ON public.school_billing_schedule
  FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS school_billing_schedule_delete ON public.school_billing_schedule;
CREATE POLICY school_billing_schedule_delete ON public.school_billing_schedule
  FOR DELETE TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS school_one_time_charges_select ON public.school_one_time_charges;
CREATE POLICY school_one_time_charges_select ON public.school_one_time_charges
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR school_id = ANY (public.user_admin_school_ids()));
DROP POLICY IF EXISTS school_one_time_charges_insert ON public.school_one_time_charges;
CREATE POLICY school_one_time_charges_insert ON public.school_one_time_charges
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS school_one_time_charges_update ON public.school_one_time_charges;
CREATE POLICY school_one_time_charges_update ON public.school_one_time_charges
  FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS school_one_time_charges_delete ON public.school_one_time_charges;
CREATE POLICY school_one_time_charges_delete ON public.school_one_time_charges
  FOR DELETE TO authenticated USING (public.is_super_admin());

-- 4. RPC de administración ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_school_billing_agreement(
  p_school_id uuid,
  p_due_offset_days smallint,
  p_schedule jsonb,
  p_one_time jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  e jsonb;
  v_n_sched integer := 0;
  v_n_one   integer := 0;
BEGIN
  IF NOT (
    public.is_super_admin()
    OR auth.role() = 'service_role'
    OR session_user IN ('postgres', 'supabase_admin')
  ) THEN
    RAISE EXCEPTION 'solo super_admin o el proceso del BFF pueden fijar un acuerdo comercial' USING ERRCODE = '42501';
  END IF;

  IF p_due_offset_days IS NOT NULL AND p_due_offset_days NOT BETWEEN 0 AND 28 THEN
    RAISE EXCEPTION 'due_offset_days debe estar entre 0 y 28' USING ERRCODE = '22023';
  END IF;
  IF p_schedule IS NOT NULL AND jsonb_typeof(p_schedule) <> 'array' THEN
    RAISE EXCEPTION 'p_schedule debe ser un arreglo JSON' USING ERRCODE = '22023';
  END IF;
  IF p_one_time IS NOT NULL AND jsonb_typeof(p_one_time) <> 'array' THEN
    RAISE EXCEPTION 'p_one_time debe ser un arreglo JSON' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.school_subscriptions WHERE school_id = p_school_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'la escuela % no tiene fila en school_subscriptions', p_school_id USING ERRCODE = '23503';
  END IF;

  -- Validar todo antes de escribir
  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_schedule, '[]'::jsonb)) LOOP
    IF (e->>'effective_from') IS NULL OR (e->>'effective_from') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'schedule: effective_from inválida (YYYY-MM-DD): %', e USING ERRCODE = '22023';
    END IF;
    IF (e->>'monthly_price_cents') IS NULL OR (e->>'monthly_price_cents') !~ '^\d+$'
       OR (e->>'monthly_price_cents')::numeric > 2147483647 THEN
      RAISE EXCEPTION 'schedule: monthly_price_cents debe ser un entero >= 0: %', e USING ERRCODE = '22023';
    END IF;
  END LOOP;
  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_one_time, '[]'::jsonb)) LOOP
    IF COALESCE(e->>'code', '') = '' OR COALESCE(e->>'label', '') = '' THEN
      RAISE EXCEPTION 'one_time: code y label son obligatorios: %', e USING ERRCODE = '22023';
    END IF;
    IF (e->>'amount_cents') IS NULL OR (e->>'amount_cents') !~ '^\d+$'
       OR (e->>'amount_cents')::numeric > 2147483647 THEN
      RAISE EXCEPTION 'one_time: amount_cents debe ser un entero >= 0: %', e USING ERRCODE = '22023';
    END IF;
    IF (e->>'next_bill_on') IS NULL OR (e->>'next_bill_on') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'one_time: next_bill_on inválida (YYYY-MM-DD): %', e USING ERRCODE = '22023';
    END IF;
    IF e->>'renews_every_months' IS NOT NULL
       AND ((e->>'renews_every_months') !~ '^\d+$' OR (e->>'renews_every_months')::numeric NOT BETWEEN 1 AND 120) THEN
      RAISE EXCEPTION 'one_time: renews_every_months debe ser un entero entre 1 y 120 o null: %', e USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF p_due_offset_days IS NOT NULL THEN
    UPDATE public.school_subscriptions
       SET due_offset_days = p_due_offset_days, updated_at = now()
     WHERE school_id = p_school_id;
  END IF;

  IF p_schedule IS NOT NULL THEN
    DELETE FROM public.school_billing_schedule WHERE school_id = p_school_id;
    INSERT INTO public.school_billing_schedule (school_id, effective_from, monthly_price_cents, note)
    SELECT p_school_id, (x->>'effective_from')::date, (x->>'monthly_price_cents')::integer, x->>'note'
      FROM jsonb_array_elements(p_schedule) x;
    GET DIAGNOSTICS v_n_sched = ROW_COUNT;
  END IF;

  IF p_one_time IS NOT NULL THEN
    DELETE FROM public.school_one_time_charges WHERE school_id = p_school_id AND status = 'active';
    INSERT INTO public.school_one_time_charges
      (school_id, code, label, amount_cents, next_bill_on, renews_every_months)
    SELECT p_school_id, x->>'code', x->>'label', (x->>'amount_cents')::integer,
           (x->>'next_bill_on')::date, (x->>'renews_every_months')::smallint
      FROM jsonb_array_elements(p_one_time) x;
    GET DIAGNOSTICS v_n_one = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'school_id', p_school_id,
    'due_offset_days', (SELECT due_offset_days FROM public.school_subscriptions WHERE school_id = p_school_id),
    'schedule_rows', v_n_sched, 'one_time_rows', v_n_one
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_school_billing_agreement(uuid, smallint, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_school_billing_agreement(uuid, smallint, jsonb, jsonb) TO authenticated, service_role;

-- 5. Generador de facturas ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_school_subscription_invoice(p_school_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_sub            public.school_subscriptions%ROWTYPE;
    v_plan_cents     integer;
    v_addons_cents   integer;
    v_items          jsonb;
    v_period_start   date;
    v_period_end     date;
    v_due_date       date;
    v_invoice_id     uuid;
    v_invoice_number text;
    v_seq            integer;
    v_ultimo_fin     date;
    -- ACUERDO:
    v_step_cents     integer;
    v_one_cents      integer;
    v_one_items      jsonb;
BEGIN
    IF NOT (
        public.is_super_admin()
        OR auth.role() = 'service_role'
        OR session_user IN ('postgres', 'supabase_admin')
    ) THEN
        RAISE EXCEPTION 'solo super_admin o el proceso del BFF pueden generar facturas SaaS' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_sub
      FROM public.school_subscriptions
     WHERE school_id = p_school_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'la escuela % no tiene fila en school_subscriptions', p_school_id
            USING ERRCODE = '23503';
    END IF;

    SELECT MAX(period_end) INTO v_ultimo_fin
      FROM public.school_subscription_invoices
     WHERE school_id = p_school_id AND status <> 'cancelled';

    v_period_start := COALESCE(v_ultimo_fin, v_sub.current_period_start::date, CURRENT_DATE);
    v_period_end   := v_period_start + INTERVAL '1 month';
    -- ACUERDO: vencimiento configurable (default 5 = comportamiento anterior)
    v_due_date     := v_period_start + (v_sub.due_offset_days * INTERVAL '1 day');

    -- ACUERDO: escalón de precio vigente al inicio del período (si existe)
    SELECT s.monthly_price_cents INTO v_step_cents
      FROM public.school_billing_schedule s
     WHERE s.school_id = p_school_id AND s.effective_from <= v_period_start
     ORDER BY s.effective_from DESC
     LIMIT 1;

    v_plan_cents := COALESCE(
        v_step_cents,
        v_sub.custom_price_cents,
        CASE v_sub.plan_code
            WHEN 'starter'     THEN 0
            WHEN 'start'       THEN 6900000
            WHEN 'crecimiento' THEN 9900000
            WHEN 'profesional' THEN 15900000
            WHEN 'elite'       THEN 34900000
            ELSE 0
        END
    );

    SELECT COALESCE(SUM(a.monthly_price_cents), 0)::integer,
           COALESCE(jsonb_agg(jsonb_build_object(
               'kind', 'addon',
               'code', a.addon_key,
               'amount_cents', a.monthly_price_cents
           ) ORDER BY a.addon_key), '[]'::jsonb)
      INTO v_addons_cents, v_items
      FROM public.school_addons a
     WHERE a.school_id = p_school_id
       AND a.enabled
       AND a.monthly_price_cents > 0;

    v_items := jsonb_build_array(jsonb_build_object(
                   'kind', 'plan',
                   'code', v_sub.plan_code,
                   'amount_cents', v_plan_cents,
                   'negotiated', v_step_cents IS NOT NULL OR v_sub.custom_price_cents IS NOT NULL
               )) || v_items;

    -- ACUERDO: cobros únicos/recurrentes que vencen dentro o antes del período
    SELECT COALESCE(SUM(c.amount_cents), 0)::integer,
           COALESCE(jsonb_agg(jsonb_build_object(
               'kind', 'one_time',
               'code', c.code,
               'label', c.label,
               'amount_cents', c.amount_cents
           ) ORDER BY c.next_bill_on, c.code), '[]'::jsonb)
      INTO v_one_cents, v_one_items
      FROM public.school_one_time_charges c
     WHERE c.school_id = p_school_id
       AND c.status = 'active'
       AND c.next_bill_on < v_period_end;

    v_items := v_items || v_one_items;

    v_seq := v_sub.next_invoice_number;
    v_invoice_number := 'SM-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(v_seq::text, 5, '0');

    INSERT INTO public.school_subscription_invoices (
        school_id, invoice_number, plan_code, amount_cents, line_items,
        period_start, period_end, due_date, status
    ) VALUES (
        p_school_id, v_invoice_number, v_sub.plan_code, v_plan_cents + v_addons_cents + v_one_cents, v_items,
        v_period_start, v_period_end, v_due_date, 'pending'
    )
    ON CONFLICT (school_id, period_start) WHERE status <> 'cancelled' DO NOTHING
    RETURNING id INTO v_invoice_id;

    IF v_invoice_id IS NULL THEN
        SELECT id INTO v_invoice_id
          FROM public.school_subscription_invoices
         WHERE school_id = p_school_id AND period_start = v_period_start AND status <> 'cancelled';
        RETURN v_invoice_id;
    END IF;

    -- ACUERDO: solo si la factura se insertó de verdad, se avanzan los cobros incluidos
    UPDATE public.school_one_time_charges
       SET next_bill_on = CASE WHEN renews_every_months IS NOT NULL
                               THEN (next_bill_on + (renews_every_months * INTERVAL '1 month'))::date
                               ELSE next_bill_on END,
           status       = CASE WHEN renews_every_months IS NULL THEN 'billed' ELSE status END
     WHERE school_id = p_school_id
       AND status = 'active'
       AND next_bill_on < v_period_end;

    UPDATE public.school_subscriptions
       SET next_invoice_number = v_seq + 1
     WHERE school_id = p_school_id;

    RETURN v_invoice_id;
END;
$function$;

COMMIT;

-- ═════════════ PARTE 1 (continuación) — PIZARRA, renumeradas el 15/10 ═════════════

-- ───────────────────────────────────────────────────────────────────────────
-- [8/10] PIZARRA  ·  20261015142003_pizarra_equipos_rivales.sql
-- origen: pizarra-tp/integracion:supabase/migrations/20261015142003_pizarra_equipos_rivales.sql
-- ───────────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261015142003_pizarra_equipos_rivales.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014125632
-- Objetivo: M6b de docs/specs/pizarra-m6-paridad-tacticalpad.md — «Configuración
--   de los equipos» de la pizarra (propio y rival) y «Equipos almacenados».
--
--   1. match_lineups.teams / team_tactical_presets.teams   jsonb NULL por jugada:
--      nombre, escudo, colores, estilo de ficha, qué mostrar, portero distinto,
--      tamaño global. NULL = el aspecto de siempre (cero regresión). La forma
--      fina la valida el BFF (school/tacticalTeamsShapes.ts); acá solo un CHECK
--      de tipo y tamaño para frenar basura.
--   2. public.tactical_rival_teams   rivales guardados por escuela: nombre,
--      sigla, 3 colores (hex con CHECK), escudo genérico (jsonb: forma + diseño
--      + iniciales; NUNCA una imagen subida), estilo de ficha y plantilla del
--      rival = [{number, alias}] ≤ 30. SOLO número y alias: nunca datos reales
--      de menores de otra escuela (alias ≤ 16, 2 palabras, sin dígitos raros).
--   3. RLS: leen quienes TRABAJAN en la escuela (user_staff_school_ids());
--      escriben los de táctica (user_tactical_edit_school_ids()), cada comando
--      con su policy y WITH CHECK; anon sin nada.
--
-- ── Radio medido contra la base viva (2026-10-14, una lectura puntual) ───────
--   · tactical_rival_teams no existe; ni match_lineups ni team_tactical_presets
--     tienen columna `teams`. Nada choca.
--   · match_lineups: 97 filas; team_tactical_presets: 12. ADD COLUMN NULL sin
--     default = solo catálogo, no reescribe la tabla. Ninguna fila cambia de
--     aspecto: todas quedan con teams NULL = el dibujo de siempre.
--   · Mientras esta migración no esté aplicada, el BFF lee y escribe sin la
--     columna (mismo patrón que `frames`) y la ruta de rivales responde 503
--     «todavía no disponible»: la pizarra no se rompe.
--   · Quién escribe rivales: los mismos de la táctica de hoy (owner, coach,
--     super_admin + coaches de school_staff). Quién lee: staff. Padres y
--     atletas: nada (no lo necesitan y es información de juego del club).
--
-- Depende de: helpers user_staff_school_ids() (20260812182000) y
-- user_tactical_edit_school_ids() (20260925170001), set_updated_at().
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 0. Dependencias ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.user_tactical_edit_school_ids()') IS NULL
     OR to_regprocedure('public.user_staff_school_ids()') IS NULL THEN
    RAISE EXCEPTION 'Faltan los helpers de RLS user_staff_school_ids() / user_tactical_edit_school_ids().';
  END IF;
END $$;

-- ─── 1. teams por jugada ────────────────────────────────────────────────────
ALTER TABLE public.match_lineups ADD COLUMN IF NOT EXISTS teams jsonb;
ALTER TABLE public.team_tactical_presets ADD COLUMN IF NOT EXISTS teams jsonb;

ALTER TABLE public.match_lineups DROP CONSTRAINT IF EXISTS match_lineups_teams_shape_check;
ALTER TABLE public.match_lineups ADD CONSTRAINT match_lineups_teams_shape_check CHECK (
  teams IS NULL OR (jsonb_typeof(teams) = 'object' AND pg_column_size(teams) <= 16384)
);
ALTER TABLE public.team_tactical_presets DROP CONSTRAINT IF EXISTS team_tactical_presets_teams_shape_check;
ALTER TABLE public.team_tactical_presets ADD CONSTRAINT team_tactical_presets_teams_shape_check CHECK (
  teams IS NULL OR (jsonb_typeof(teams) = 'object' AND pg_column_size(teams) <= 16384)
);

COMMENT ON COLUMN public.match_lineups.teams IS
  'Pizarra M6b: configuración de los dos equipos de la jugada {v, home, away, player_scale, object_scale, export_names}. NULL = aspecto de siempre. Forma validada por el BFF (tacticalTeamsShapes.ts).';
COMMENT ON COLUMN public.team_tactical_presets.teams IS
  'Pizarra M6b: igual que match_lineups.teams, para Mis jugadas.';

-- ─── 2. Validación de la plantilla del rival ────────────────────────────────
-- [{number 0-99, alias 1-16}] ≤ 30, números sin repetir, alias de máximo dos
-- palabras con letras/números/espacio/punto/guion/apóstrofo. Es un FRENO de
-- forma (el BFF valida lo mismo con mensajes); no puede ver si un alias es un
-- nombre real: por eso el tope de 16 caracteres y 2 palabras.
CREATE OR REPLACE FUNCTION public.tactical_rival_roster_ok(p_roster jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT jsonb_typeof(p_roster) = 'array'
     AND jsonb_array_length(p_roster) <= 30
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_roster) e
        WHERE jsonb_typeof(e) <> 'object'
           OR (SELECT count(*) FROM jsonb_object_keys(e) k WHERE k NOT IN ('number', 'alias')) > 0
           OR jsonb_typeof(e -> 'number') <> 'number'
           OR (e ->> 'number') !~ '^[0-9]{1,2}$'
           OR (e ? 'alias' AND (
                 jsonb_typeof(e -> 'alias') <> 'string'
                 OR char_length(e ->> 'alias') NOT BETWEEN 1 AND 16
                 OR (e ->> 'alias') !~ '^[[:alpha:][:digit:] .''-]+$'
                 OR array_length(regexp_split_to_array(btrim(e ->> 'alias'), '\s+'), 1) > 2))
     )
     AND (SELECT count(DISTINCT e ->> 'number') FROM jsonb_array_elements(p_roster) e)
         = jsonb_array_length(p_roster);
$$;

REVOKE ALL ON FUNCTION public.tactical_rival_roster_ok(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tactical_rival_roster_ok(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.tactical_rival_roster_ok(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_rival_roster_ok(jsonb) TO service_role;

-- ─── 3. tactical_rival_teams ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tactical_rival_teams (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  short_name       text CHECK (short_name IS NULL OR short_name ~ '^[[:alpha:][:digit:]]{1,4}$'),
  color_primary    text NOT NULL CHECK (color_primary ~ '^#[0-9a-fA-F]{6}$'),
  color_secondary  text NOT NULL CHECK (color_secondary ~ '^#[0-9a-fA-F]{6}$'),
  color_number     text NOT NULL CHECK (color_number ~ '^#[0-9a-fA-F]{6}$'),
  -- Escudo GENÉRICO: {shape, design, initials}. Nunca una URL ni una imagen.
  crest            jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
                     jsonb_typeof(crest) = 'object'
                     AND NOT crest ? 'url' AND NOT crest ? 'image'
                     AND pg_column_size(crest) <= 512),
  chip_style       text NOT NULL DEFAULT 'disc'
                   CHECK (chip_style IN ('disc', 'jersey', 'stripes_v', 'stripes_h', 'silhouette')),
  roster           jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (public.tactical_rival_roster_ok(roster)),
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tactical_rival_teams IS
  'Pizarra M6b «Equipos almacenados»: rivales guardados por escuela. Plantilla = solo número y alias (nunca datos de menores de otra escuela). Escudo genérico, sin imágenes.';

CREATE UNIQUE INDEX IF NOT EXISTS tactical_rival_teams_school_name_uq
  ON public.tactical_rival_teams (school_id, lower(btrim(name)));

DROP TRIGGER IF EXISTS tactical_rival_teams_set_updated_at ON public.tactical_rival_teams;
CREATE TRIGGER tactical_rival_teams_set_updated_at
  BEFORE UPDATE ON public.tactical_rival_teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 4. Privilegios y RLS ───────────────────────────────────────────────────
ALTER TABLE public.tactical_rival_teams ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tactical_rival_teams FROM PUBLIC;
REVOKE ALL ON public.tactical_rival_teams FROM anon;
REVOKE ALL ON public.tactical_rival_teams FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tactical_rival_teams TO authenticated;
GRANT ALL ON public.tactical_rival_teams TO service_role;

-- Leer: quien trabaja en la escuela (sin padres ni atletas).
DROP POLICY IF EXISTS tactical_rival_teams_select ON public.tactical_rival_teams;
CREATE POLICY tactical_rival_teams_select ON public.tactical_rival_teams
  FOR SELECT TO authenticated
  USING (school_id = ANY (public.user_staff_school_ids()));

-- Escribir: táctica (owner/coach/super_admin + coaches de school_staff).
-- created_by debe ser quien inserta: no se firma a nombre de otro.
DROP POLICY IF EXISTS tactical_rival_teams_insert ON public.tactical_rival_teams;
CREATE POLICY tactical_rival_teams_insert ON public.tactical_rival_teams
  FOR INSERT TO authenticated
  WITH CHECK (school_id = ANY (public.user_tactical_edit_school_ids())
              AND (created_by IS NULL OR created_by = auth.uid()));

DROP POLICY IF EXISTS tactical_rival_teams_update ON public.tactical_rival_teams;
CREATE POLICY tactical_rival_teams_update ON public.tactical_rival_teams
  FOR UPDATE TO authenticated
  USING (school_id = ANY (public.user_tactical_edit_school_ids()))
  WITH CHECK (school_id = ANY (public.user_tactical_edit_school_ids()));

DROP POLICY IF EXISTS tactical_rival_teams_delete ON public.tactical_rival_teams;
CREATE POLICY tactical_rival_teams_delete ON public.tactical_rival_teams
  FOR DELETE TO authenticated
  USING (school_id = ANY (public.user_tactical_edit_school_ids()));

COMMIT;


-- ───────────────────────────────────────────────────────────────────────────
-- [9/10] PIZARRA  ·  20261015145434_pizarra_videos_subidos.sql
-- origen: pizarra-tp/integracion:supabase/migrations/20261015145434_pizarra_videos_subidos.sql
-- ───────────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261015145434_pizarra_videos_subidos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-15   Versión anterior: 20261014125632
-- Objetivo: M6h fase 1 de docs/specs/pizarra-m6h-videos-subidos.md — videos que
--   el cuerpo técnico SUBE (del celular, o descargados de Veo/Hudl/Trace…) a un
--   proveedor de video externo (Bunny Stream recomendado), con cupo por escuela
--   y clips (inicio/fin) vinculables a una jugada. NADA del archivo pasa por
--   Supabase Storage ni por el BFF: el navegador sube directo al proveedor (tus).
--
--   1. school_video_settings: interruptor (flag) + cupo por escuela. Una fila
--      por escuela; sin fila = apagado. Solo SportMaps (super admin) la cambia,
--      por RPC. Los contadores used_* solo los mueven RPCs SECURITY DEFINER con
--      SELECT … FOR UPDATE sobre esta fila (regla de contadores del repo).
--   2. school_videos: un video subido. id = asset_id que reserva el modelo de
--      videos por enlace de M6c (provider 'sportmaps' + asset_id uuid,
--      20261014163705): una jugada referencia el video subido con ese id.
--   3. school_video_clips: tramos [start_s, end_s) de un video, con nombre y
--      vinculables a UNA jugada (match_lineups | team_tactical_presets |
--      training_exercises), polimórfico por columnas nulas + CHECK.
--   4. RPCs: begin_school_video_upload (reserva cupo + crea la fila, una
--      transacción), attach_school_video_asset, settle_school_video (webhook,
--      solo service_role), soft_delete_school_video, set_school_video_settings
--      (super admin), expire_stale_school_video_uploads (service_role).
--
-- ── Permisos (fase 1: SOLO el cuerpo técnico) ────────────────────────────────
--   · LEEN: staff de la escuela (user_staff_school_ids(): sin padres ni atletas).
--   · SUBEN / EDITAN / RECORTAN: quienes editan la pizarra
--     (user_tactical_edit_school_ids()). Subir es SOLO por RPC (reserva cupo).
--     Editar el video = UPDATE con GRANT por columna (título, equipo, fecha,
--     origen): estado, tamaño, duración, escuela, consentimiento y borrado NO.
--   · BORRAN: el autor (si sigue siendo táctico en la escuela) o un admin de la
--     escuela (user_admin_school_ids()). Borrado lógico por RPC, que además
--     devuelve el cupo.
--   · Padres y atletas: NADA en esta fase. consent_scope existe para la fase 4
--     («compartir con familias con consentimiento»), pero solo puede valer
--     'staff' hasta que exista el registro de consentimiento (CHECK de abajo;
--     relajarlo será una migración nueva junto con sus policies).
--   · anon: nada (REVOKE explícito; los default privileges del esquema dan todo).
--   · Ninguna policy FOR ALL; toda policy de escritura con WITH CHECK.
--
-- ── Cupo (control de costo) ──────────────────────────────────────────────────
--   El costo del proveedor es por almacenamiento acumulado (minutos o GB que
--   siguen guardados) + entrega. El cupo es de ALMACENAMIENTO VIVO: subir
--   reserva max_duration_s y size_bytes declarados; el webhook (settle) cambia la
--   reserva por lo real; borrar lo devuelve. counted_seconds/counted_bytes de
--   cada video = lo que ese video tiene cargado al cupo en este momento, así
--   settle y delete son idempotentes (delta = real − contado).
--   Defaults: 600 min (10 h) y 25 GB por escuela, archivo ≤ 4 GB, ≤ 3 h.
--
-- ── Radio (leído del repo; sin consultar la base: regla de Disk IO) ─────────
--   Tablas nuevas y vacías; ninguna policy ni función existente cambia. Ninguna
--   escuela ve nada nuevo hasta que SportMaps le crea su fila con enabled=true.
--
-- Depende de: helpers user_staff_school_ids(), user_tactical_edit_school_ids(),
--   user_admin_school_ids(), is_super_admin(); set_updated_at(); tablas schools,
--   teams, profiles, match_lineups, team_tactical_presets, training_exercises.
--
-- NO APLICADA. Al aplicarla (UNA sola sesión, ver CLAUDE.md «Disk IO»):
--   npm run seguridad:invariantes  y  npm run seguridad:rls-pizarra (casos
--   «esperado tras 20261015145434» de scripts/rls-pruebas-pizarra.mjs).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 0. Dependencias ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.user_tactical_edit_school_ids()') IS NULL
     OR to_regprocedure('public.user_staff_school_ids()') IS NULL
     OR to_regprocedure('public.user_admin_school_ids()') IS NULL
     OR to_regprocedure('public.is_super_admin()') IS NULL THEN
    RAISE EXCEPTION 'Faltan los helpers de RLS user_*_school_ids() / is_super_admin().';
  END IF;
  IF to_regclass('public.training_exercises') IS NULL THEN
    RAISE EXCEPTION 'Falta public.training_exercises: aplicar 20261008183744 antes que esta migración.';
  END IF;
  IF to_regprocedure('public.set_updated_at()') IS NULL THEN
    RAISE EXCEPTION 'Falta public.set_updated_at().';
  END IF;
END $$;

-- ─── 1. school_video_settings (flag + cupo) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_video_settings (
  school_id          uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  enabled            boolean NOT NULL DEFAULT false,
  quota_seconds      integer NOT NULL DEFAULT 36000      CHECK (quota_seconds BETWEEN 0 AND 3600000),
  quota_bytes        bigint  NOT NULL DEFAULT 26843545600 CHECK (quota_bytes BETWEEN 0 AND 10995116277760),
  max_upload_bytes   bigint  NOT NULL DEFAULT 4294967296  CHECK (max_upload_bytes BETWEEN 1048576 AND 53687091200),
  max_duration_s     integer NOT NULL DEFAULT 10800       CHECK (max_duration_s BETWEEN 60 AND 43200),
  used_seconds       bigint  NOT NULL DEFAULT 0 CHECK (used_seconds >= 0),
  used_bytes         bigint  NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
  updated_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.school_video_settings IS
  'M6h: interruptor y cupo de videos subidos por escuela. Sin fila = apagado. Solo RPCs mueven used_*; solo super admin cambia el resto (set_school_video_settings).';

DROP TRIGGER IF EXISTS school_video_settings_set_updated_at ON public.school_video_settings;
CREATE TRIGGER school_video_settings_set_updated_at
  BEFORE UPDATE ON public.school_video_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. school_videos ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_videos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  team_id            uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  provider           text NOT NULL CHECK (provider IN ('bunny', 'cloudflare', 'mux', 'apivideo')),
  provider_asset_id  text CHECK (provider_asset_id IS NULL OR provider_asset_id ~ '^[A-Za-z0-9_-]{6,100}$'),
  status             text NOT NULL DEFAULT 'uploading'
                       CHECK (status IN ('uploading', 'processing', 'ready', 'failed', 'deleted')),
  duration_s         integer CHECK (duration_s IS NULL OR duration_s BETWEEN 0 AND 43200),
  size_bytes         bigint  CHECK (size_bytes IS NULL OR size_bytes >= 0),
  -- Lo que este video tiene cargado HOY al cupo de la escuela (reserva o real).
  counted_seconds    integer NOT NULL DEFAULT 0 CHECK (counted_seconds >= 0),
  counted_bytes      bigint  NOT NULL DEFAULT 0 CHECK (counted_bytes >= 0),
  title              text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  recorded_at        date,
  source             text NOT NULL DEFAULT 'phone'
                       CHECK (source IN ('phone', 'veo', 'hudl', 'trace', 'pixellot', 'other')),
  -- Fase 1: solo 'staff'. 'families_with_consent' queda en el dominio para la
  -- fase 4, pero el segundo CHECK lo impide hasta que exista el consentimiento.
  consent_scope      text NOT NULL DEFAULT 'staff'
                       CHECK (consent_scope IN ('staff', 'families_with_consent')),
  created_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,
  deleted_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT school_videos_consent_phase1_check CHECK (consent_scope = 'staff'),
  CONSTRAINT school_videos_deleted_check CHECK ((status = 'deleted') = (deleted_at IS NOT NULL)),
  CONSTRAINT school_videos_deleted_uncounted_check CHECK (status <> 'deleted' OR (counted_seconds = 0 AND counted_bytes = 0))
);

COMMENT ON TABLE public.school_videos IS
  'M6h: videos subidos al proveedor externo (nunca a Supabase Storage). id = asset_id del video provider=''sportmaps'' de M6c. Leen staff; suben/editan tácticos; borran autor o admin (lógico, por RPC).';
COMMENT ON COLUMN public.school_videos.consent_scope IS
  'Fase 1 = staff (CHECK). Fase 4: families_with_consent, solo con consentimiento vigente del representante legal de cada menor que aparece (Ley 1581/2012, Decreto 1377/2013 art. 12).';

CREATE INDEX IF NOT EXISTS school_videos_school_idx
  ON public.school_videos (school_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS school_videos_team_idx
  ON public.school_videos (team_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS school_videos_provider_asset_uidx
  ON public.school_videos (provider, provider_asset_id) WHERE provider_asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS school_videos_stale_idx
  ON public.school_videos (created_at) WHERE status = 'uploading';

DROP TRIGGER IF EXISTS school_videos_set_updated_at ON public.school_videos;
CREATE TRIGGER school_videos_set_updated_at
  BEFORE UPDATE ON public.school_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- El equipo (si hay) es de la misma escuela. DEFINER: lee teams aunque la RLS
-- de teams no se lo muestre al que edita.
CREATE OR REPLACE FUNCTION public.school_videos_team_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.team_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.teams t WHERE t.id = NEW.team_id AND t.school_id = NEW.school_id) THEN
    RAISE EXCEPTION 'El equipo no es de la escuela del video.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.school_videos_team_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS school_videos_team_guard ON public.school_videos;
CREATE TRIGGER school_videos_team_guard
  BEFORE INSERT OR UPDATE OF team_id, school_id ON public.school_videos
  FOR EACH ROW EXECUTE FUNCTION public.school_videos_team_guard();

-- ─── 3. school_video_clips ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_video_clips (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Copia de school_videos.school_id (el trigger la fija): la RLS filtra sin
  -- leer otra tabla.
  school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  video_id     uuid NOT NULL REFERENCES public.school_videos(id) ON DELETE CASCADE,
  start_s      numeric(8,2) NOT NULL CHECK (start_s >= 0 AND start_s <= 43200),
  end_s        numeric(8,2) NOT NULL CHECK (end_s <= 43200),
  title        text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  -- Jugada vinculada: a lo sumo UNA de las tres.
  lineup_id    uuid REFERENCES public.match_lineups(id) ON DELETE SET NULL,
  preset_id    uuid REFERENCES public.team_tactical_presets(id) ON DELETE SET NULL,
  exercise_id  uuid REFERENCES public.training_exercises(id) ON DELETE SET NULL,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_video_clips_range_check CHECK (end_s > start_s AND end_s - start_s >= 1),
  CONSTRAINT school_video_clips_one_play_check CHECK (num_nonnulls(lineup_id, preset_id, exercise_id) <= 1)
);

COMMENT ON TABLE public.school_video_clips IS
  'M6h: clips (inicio/fin) de un video subido, vinculables a una jugada. Virtuales: no crean un video nuevo en el proveedor (cero almacenamiento extra).';

CREATE INDEX IF NOT EXISTS school_video_clips_video_idx ON public.school_video_clips (video_id, start_s);
CREATE INDEX IF NOT EXISTS school_video_clips_school_idx ON public.school_video_clips (school_id);
CREATE INDEX IF NOT EXISTS school_video_clips_lineup_idx ON public.school_video_clips (lineup_id) WHERE lineup_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS school_video_clips_preset_idx ON public.school_video_clips (preset_id) WHERE preset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS school_video_clips_exercise_idx ON public.school_video_clips (exercise_id) WHERE exercise_id IS NOT NULL;

DROP TRIGGER IF EXISTS school_video_clips_set_updated_at ON public.school_video_clips;
CREATE TRIGGER school_video_clips_set_updated_at
  BEFORE UPDATE ON public.school_video_clips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Fija school_id desde el video, exige video vivo, recorte dentro de la
-- duración conocida, tope de clips por video y jugada de la MISMA escuela.
CREATE OR REPLACE FUNCTION public.school_video_clips_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_school   uuid;
  v_status   text;
  v_duration integer;
BEGIN
  SELECT sv.school_id, sv.status, sv.duration_s
    INTO v_school, v_status, v_duration
    FROM public.school_videos sv
   WHERE sv.id = NEW.video_id;
  IF NOT FOUND OR v_status = 'deleted' THEN
    RAISE EXCEPTION 'Video no encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.video_id <> OLD.video_id THEN
    RAISE EXCEPTION 'Un clip no se cambia de video.' USING ERRCODE = '22023';
  END IF;
  NEW.school_id := v_school;
  IF v_duration IS NOT NULL AND NEW.end_s > v_duration + 1 THEN
    RAISE EXCEPTION 'El clip termina después del final del video.' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'INSERT' AND (SELECT count(*) FROM public.school_video_clips c WHERE c.video_id = NEW.video_id) >= 200 THEN
    RAISE EXCEPTION 'Máximo 200 clips por video.' USING ERRCODE = '54000';
  END IF;
  IF NEW.lineup_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.match_lineups ml WHERE ml.id = NEW.lineup_id AND ml.school_id = v_school) THEN
    RAISE EXCEPTION 'La jugada no es de la escuela del video.' USING ERRCODE = '22023';
  END IF;
  IF NEW.preset_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.team_tactical_presets tp WHERE tp.id = NEW.preset_id AND tp.school_id = v_school) THEN
    RAISE EXCEPTION 'La jugada no es de la escuela del video.' USING ERRCODE = '22023';
  END IF;
  -- Ejercicio: de la escuela o plantilla del sistema (school_id NULL).
  IF NEW.exercise_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.training_exercises e
        WHERE e.id = NEW.exercise_id AND (e.school_id = v_school OR (e.school_id IS NULL AND e.is_template))) THEN
    RAISE EXCEPTION 'El ejercicio no es de la escuela del video.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.school_video_clips_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS school_video_clips_guard ON public.school_video_clips;
CREATE TRIGGER school_video_clips_guard
  BEFORE INSERT OR UPDATE ON public.school_video_clips
  FOR EACH ROW EXECUTE FUNCTION public.school_video_clips_guard();

-- ─── 4. Privilegios y RLS ───────────────────────────────────────────────────
ALTER TABLE public.school_video_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_videos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_video_clips    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.school_video_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.school_videos         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.school_video_clips    FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.school_video_settings TO authenticated;
GRANT SELECT ON public.school_videos TO authenticated;
-- Editar el video: SOLO estas columnas. Estado, tamaño, duración, cupo,
-- escuela, consentimiento y borrado se mueven por RPC.
GRANT UPDATE (title, team_id, recorded_at, source) ON public.school_videos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_video_clips TO authenticated;
GRANT ALL ON public.school_video_settings, public.school_videos, public.school_video_clips TO service_role;

-- settings: staff de la escuela lee su interruptor y su cupo. Nadie escribe
-- directo (sin policies de escritura + sin GRANT).
DROP POLICY IF EXISTS school_video_settings_select ON public.school_video_settings;
CREATE POLICY school_video_settings_select ON public.school_video_settings
  FOR SELECT TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

-- videos
DROP POLICY IF EXISTS school_videos_select ON public.school_videos;
CREATE POLICY school_videos_select ON public.school_videos
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
         OR (SELECT public.is_super_admin()))
  );

DROP POLICY IF EXISTS school_videos_update ON public.school_videos;
CREATE POLICY school_videos_update ON public.school_videos
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[])
  )
  WITH CHECK (
    deleted_at IS NULL
    AND school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[])
  );
-- Sin policy de INSERT ni DELETE: alta por begin_school_video_upload, baja por
-- soft_delete_school_video.

-- clips
DROP POLICY IF EXISTS school_video_clips_select ON public.school_video_clips;
CREATE POLICY school_video_clips_select ON public.school_video_clips
  FOR SELECT TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

DROP POLICY IF EXISTS school_video_clips_insert ON public.school_video_clips;
CREATE POLICY school_video_clips_insert ON public.school_video_clips
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[])
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS school_video_clips_update ON public.school_video_clips;
CREATE POLICY school_video_clips_update ON public.school_video_clips
  FOR UPDATE TO authenticated
  USING (school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[]))
  WITH CHECK (school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[]));

-- Borra el autor (si sigue siendo táctico) o un admin de la escuela.
DROP POLICY IF EXISTS school_video_clips_delete ON public.school_video_clips;
CREATE POLICY school_video_clips_delete ON public.school_video_clips
  FOR DELETE TO authenticated
  USING (
    (created_by = (SELECT auth.uid())
       AND school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[]))
    OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

-- ─── 5. RPCs ────────────────────────────────────────────────────────────────
-- Fila de settings de la escuela, bloqueada. Sin fila o apagada → excepción.
CREATE OR REPLACE FUNCTION public._school_video_lock_settings(p_school_id uuid)
RETURNS public.school_video_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v public.school_video_settings%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.school_video_settings WHERE school_id = p_school_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VIDEOS_DISABLED: los videos subidos no están activos en esta escuela.' USING ERRCODE = '42501';
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public._school_video_lock_settings(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._school_video_lock_settings(uuid) TO service_role;

-- 5.1 Reservar cupo + crear el video (una transacción). Lo llama el BFF con la
-- sesión del usuario (auth.uid() es quien sube).
CREATE OR REPLACE FUNCTION public.begin_school_video_upload(
  p_school_id      uuid,
  p_provider       text,
  p_title          text,
  p_size_bytes     bigint,
  p_max_duration_s integer,
  p_team_id        uuid DEFAULT NULL,
  p_source         text DEFAULT 'phone',
  p_recorded_at    date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_set  public.school_video_settings%ROWTYPE;
  v_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  IF p_school_id IS NULL OR NOT (p_school_id = ANY (public.user_tactical_edit_school_ids())) THEN
    RAISE EXCEPTION 'No tienes permiso para subir videos en esta escuela.' USING ERRCODE = '42501';
  END IF;
  IF p_size_bytes IS NULL OR p_size_bytes <= 0 THEN
    RAISE EXCEPTION 'Tamaño del archivo inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_max_duration_s IS NULL OR p_max_duration_s <= 0 THEN
    RAISE EXCEPTION 'Duración máxima inválida.' USING ERRCODE = '22023';
  END IF;

  v_set := public._school_video_lock_settings(p_school_id);
  IF NOT v_set.enabled THEN
    RAISE EXCEPTION 'VIDEOS_DISABLED: los videos subidos no están activos en esta escuela.' USING ERRCODE = '42501';
  END IF;
  IF p_size_bytes > v_set.max_upload_bytes THEN
    RAISE EXCEPTION 'FILE_TOO_LARGE: el archivo supera el máximo permitido.' USING ERRCODE = '22023';
  END IF;
  IF p_max_duration_s > v_set.max_duration_s THEN
    RAISE EXCEPTION 'TOO_LONG: el video supera la duración máxima.' USING ERRCODE = '22023';
  END IF;
  IF v_set.used_seconds + p_max_duration_s > v_set.quota_seconds
     OR v_set.used_bytes + p_size_bytes > v_set.quota_bytes THEN
    RAISE EXCEPTION 'QUOTA_EXCEEDED: no queda cupo de videos en la escuela.' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.school_videos (school_id, team_id, provider, status, title, recorded_at, source,
                                    counted_seconds, counted_bytes, created_by)
  VALUES (p_school_id, p_team_id, p_provider, 'uploading', btrim(p_title), p_recorded_at, COALESCE(p_source, 'phone'),
          p_max_duration_s, p_size_bytes, v_uid)
  RETURNING id INTO v_id;

  UPDATE public.school_video_settings
     SET used_seconds = used_seconds + p_max_duration_s,
         used_bytes   = used_bytes + p_size_bytes
   WHERE school_id = p_school_id;

  RETURN jsonb_build_object(
    'video_id', v_id,
    'quota_seconds', v_set.quota_seconds,
    'quota_bytes', v_set.quota_bytes,
    'used_seconds', v_set.used_seconds + p_max_duration_s,
    'used_bytes', v_set.used_bytes + p_size_bytes
  );
END;
$$;
REVOKE ALL ON FUNCTION public.begin_school_video_upload(uuid, text, text, bigint, integer, uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_school_video_upload(uuid, text, text, bigint, integer, uuid, text, date) TO authenticated, service_role;

-- 5.2 Guardar el id del asset del proveedor (una sola vez, el autor, subiendo).
CREATE OR REPLACE FUNCTION public.attach_school_video_asset(p_video_id uuid, p_provider_asset_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n   int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.school_videos
     SET provider_asset_id = p_provider_asset_id
   WHERE id = p_video_id
     AND created_by = v_uid
     AND status = 'uploading'
     AND provider_asset_id IS NULL
     AND school_id = ANY (public.user_tactical_edit_school_ids());
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Video no encontrado.' USING ERRCODE = 'P0002';
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.attach_school_video_asset(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_school_video_asset(uuid, text) TO authenticated, service_role;

-- 5.3 Webhook del proveedor (solo service_role: el BFF tras verificar la firma
-- y releer el asset en el API del proveedor). Cambia la reserva por lo real.
-- Idempotente: delta = real − contado.
CREATE OR REPLACE FUNCTION public.settle_school_video(
  p_provider          text,
  p_provider_asset_id text,
  p_status            text,
  p_duration_s        integer DEFAULT NULL,
  p_size_bytes        bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v      public.school_videos%ROWTYPE;
  v_secs integer;
  v_byts bigint;
BEGIN
  IF p_status NOT IN ('processing', 'ready', 'failed') THEN
    RAISE EXCEPTION 'Estado inválido.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v FROM public.school_videos
   WHERE provider = p_provider AND provider_asset_id = p_provider_asset_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_asset');
  END IF;
  -- Orden de bloqueo fijo (settings → video) igual que begin/delete.
  PERFORM public._school_video_lock_settings(v.school_id);
  SELECT * INTO v FROM public.school_videos WHERE id = v.id FOR UPDATE;
  IF v.status = 'deleted' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deleted');
  END IF;
  -- Un evento viejo no deshace uno nuevo.
  IF v.status IN ('ready', 'failed') AND p_status = 'processing' THEN
    RETURN jsonb_build_object('ok', true, 'status', v.status, 'ignored', true);
  END IF;

  IF p_status = 'failed' THEN
    v_secs := 0; v_byts := 0;
  ELSIF p_status = 'ready' THEN
    v_secs := COALESCE(p_duration_s, v.counted_seconds);
    v_byts := COALESCE(p_size_bytes, v.counted_bytes);
  ELSE
    v_secs := v.counted_seconds; v_byts := v.counted_bytes;
  END IF;

  UPDATE public.school_video_settings
     SET used_seconds = GREATEST(used_seconds + (v_secs - v.counted_seconds), 0),
         used_bytes   = GREATEST(used_bytes + (v_byts - v.counted_bytes), 0)
   WHERE school_id = v.school_id;

  UPDATE public.school_videos
     SET status = p_status,
         duration_s = CASE WHEN p_status = 'ready' THEN COALESCE(p_duration_s, duration_s) ELSE duration_s END,
         size_bytes = CASE WHEN p_status = 'ready' THEN COALESCE(p_size_bytes, size_bytes) ELSE size_bytes END,
         counted_seconds = v_secs,
         counted_bytes = v_byts
   WHERE id = v.id;

  RETURN jsonb_build_object('ok', true, 'video_id', v.id, 'status', p_status);
END;
$$;
REVOKE ALL ON FUNCTION public.settle_school_video(text, text, text, integer, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_school_video(text, text, text, integer, bigint) TO service_role;

-- 5.4 Borrado lógico (también «cancelar subida»): autor táctico o admin.
-- Devuelve el cupo y los datos del proveedor para que el BFF borre el asset.
CREATE OR REPLACE FUNCTION public.soft_delete_school_video(p_video_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v     public.school_videos%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.school_videos WHERE id = p_video_id;
  IF NOT FOUND OR v.status = 'deleted' THEN
    RAISE EXCEPTION 'Video no encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
       (v.created_by = v_uid AND v.school_id = ANY (public.user_tactical_edit_school_ids()))
       OR v.school_id = ANY (public.user_admin_school_ids())
       OR public.is_super_admin()
     ) THEN
    RAISE EXCEPTION 'Solo quien subió el video o un administrador de la escuela puede borrarlo.' USING ERRCODE = '42501';
  END IF;

  PERFORM public._school_video_lock_settings(v.school_id);
  SELECT * INTO v FROM public.school_videos WHERE id = p_video_id FOR UPDATE;
  IF v.status = 'deleted' THEN
    RAISE EXCEPTION 'Video no encontrado.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.school_video_settings
     SET used_seconds = GREATEST(used_seconds - v.counted_seconds, 0),
         used_bytes   = GREATEST(used_bytes - v.counted_bytes, 0)
   WHERE school_id = v.school_id;

  UPDATE public.school_videos
     SET status = 'deleted', deleted_at = now(), deleted_by = v_uid,
         counted_seconds = 0, counted_bytes = 0
   WHERE id = v.id;
  -- Sin video no hay clips (la fila del video queda como rastro del borrado).
  DELETE FROM public.school_video_clips WHERE video_id = v.id;

  RETURN jsonb_build_object('video_id', v.id, 'provider', v.provider, 'provider_asset_id', v.provider_asset_id);
END;
$$;
REVOKE ALL ON FUNCTION public.soft_delete_school_video(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_school_video(uuid) TO authenticated, service_role;

-- 5.5 Prender/apagar y fijar cupo: SOLO SportMaps (super admin con su sesión,
-- o el BFF con service_role). Nunca la escuela (el cupo es costo de SportMaps).
CREATE OR REPLACE FUNCTION public.set_school_video_settings(
  p_school_id        uuid,
  p_enabled          boolean,
  p_quota_seconds    integer DEFAULT NULL,
  p_quota_bytes      bigint DEFAULT NULL,
  p_max_upload_bytes bigint DEFAULT NULL,
  p_max_duration_s   integer DEFAULT NULL
)
RETURNS public.school_video_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v public.school_video_settings%ROWTYPE;
BEGIN
  IF NOT (public.is_super_admin() OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role') THEN
    RAISE EXCEPTION 'Solo SportMaps puede activar los videos subidos.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.school_video_settings AS s (school_id, enabled, updated_by)
  VALUES (p_school_id, COALESCE(p_enabled, false), auth.uid())
  ON CONFLICT (school_id) DO NOTHING;

  SELECT * INTO v FROM public.school_video_settings WHERE school_id = p_school_id FOR UPDATE;
  UPDATE public.school_video_settings
     SET enabled          = COALESCE(p_enabled, enabled),
         quota_seconds    = COALESCE(p_quota_seconds, quota_seconds),
         quota_bytes      = COALESCE(p_quota_bytes, quota_bytes),
         max_upload_bytes = COALESCE(p_max_upload_bytes, max_upload_bytes),
         max_duration_s   = COALESCE(p_max_duration_s, max_duration_s),
         updated_by       = auth.uid()
   WHERE school_id = p_school_id
   RETURNING * INTO v;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.set_school_video_settings(uuid, boolean, integer, bigint, bigint, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_school_video_settings(uuid, boolean, integer, bigint, bigint, integer) TO authenticated, service_role;

-- 5.6 Subidas abandonadas (nunca llegó el archivo): pasan a 'failed' y
-- devuelven la reserva. Para un cron del BFF (aún sin programar).
CREATE OR REPLACE FUNCTION public.expire_stale_school_video_uploads(p_older_than interval DEFAULT interval '24 hours')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  r   record;
  v_n integer := 0;
BEGIN
  FOR r IN
    SELECT id, school_id FROM public.school_videos
     WHERE status = 'uploading' AND created_at < now() - p_older_than
     ORDER BY school_id
     LIMIT 500
  LOOP
    PERFORM public._school_video_lock_settings(r.school_id);
    UPDATE public.school_video_settings s
       SET used_seconds = GREATEST(s.used_seconds - v.counted_seconds, 0),
           used_bytes   = GREATEST(s.used_bytes - v.counted_bytes, 0)
      FROM public.school_videos v
     WHERE v.id = r.id AND v.status = 'uploading' AND s.school_id = v.school_id;
    UPDATE public.school_videos
       SET status = 'failed', counted_seconds = 0, counted_bytes = 0
     WHERE id = r.id AND status = 'uploading';
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_stale_school_video_uploads(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_school_video_uploads(interval) TO service_role;

COMMIT;

-- ═════════════ PARTE 3 — DATOS de Monster (OPCIONAL: requiere confirmar los supuestos) ═════════════

-- ───────────────────────────────────────────────────────────────────────────
-- [10/10] FACTURACIÓN (datos)  ·  20261015124611_acuerdo_monster_volley.sql
-- origen: wt-facturacion:supabase/migrations/20261015124611_acuerdo_monster_volley.sql
-- ───────────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261015124611_acuerdo_monster_volley.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-15   Versión anterior: 20261015124518
-- Objetivo: cargar el acuerdo comercial de Monster's Volley Club
--   (school_id eb3ebc77-4ea4-4992-96c8-3c8ec574578c) sobre las tablas de la
--   migración 20261015124518. Idempotente.
--
-- Acuerdo: octubre 2026 sin costo (implementación acompañada). 5-nov-2026:
--   $289.000 mensualidad + $130.000 certificado digital (una vez al año). Dic y
--   ene: $289.000 cada día 5. Desde el 5-feb-2027: $348.000 cada día 5. Sin costo:
--   rediseño de la página web e integración de WhatsApp.
--
-- SUPUESTOS NO CONFIRMADOS POR EL USUARIO:
--   · plan_code NO se cambia (sigue 'starter'; el precio sale del schedule).
--   · El certificado se renueva cada 12 meses al mismo valor.
--   · Los montos NO incluyen IVA; no hay líneas de impuesto.
--   · billing_emails queda como está (NULL).
-- Períodos del día 1 al día 1; la factura sale el 1 y vence el 5 (due_offset_days = 4).
-- No se usa admin_set_saas_billing_enabled: generaría de inmediato una factura de
--   octubre por $0. Se activa directo; la primera factura la genera el ciclo diario
--   el 1-nov-2026 (06:20 COT), período 1-nov a 1-dic, vence el 5-nov.
-- =============================================================================

BEGIN;

INSERT INTO public.school_billing_schedule (school_id, effective_from, monthly_price_cents, note) VALUES
  ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', '2026-10-01', 0,        'Implementación acompañada'),
  ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', '2026-11-01', 28900000, 'Mensualidad (primer pago 5-nov-2026)'),
  ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', '2027-02-01', 34800000, 'Mensualidad desde el 5-feb-2027')
ON CONFLICT (school_id, effective_from) DO NOTHING;

INSERT INTO public.school_one_time_charges (school_id, code, label, amount_cents, next_bill_on, renews_every_months)
SELECT 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 'certificado_digital', 'Certificado digital (anual)',
       13000000, DATE '2026-11-05', 12
 WHERE NOT EXISTS (
   SELECT 1 FROM public.school_one_time_charges
    WHERE school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c' AND code = 'certificado_digital'
 );

UPDATE public.school_subscriptions
   SET due_offset_days         = 4,
       billing_cycle           = 'monthly',
       current_period_start    = TIMESTAMPTZ '2026-10-01 00:00-05',
       current_period_end      = TIMESTAMPTZ '2026-11-01 00:00-05',
       saas_billing_enabled    = true,
       saas_billing_enabled_at = COALESCE(saas_billing_enabled_at, now()),
       metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('acuerdo_comercial', jsonb_build_object(
         'texto', 'Octubre 2026 sin costo (implementación acompañada). Primer pago el 5-nov-2026: $289.000 de mensualidad + $130.000 de certificado digital (pago completo, una vez al año). Diciembre y enero: $289.000 cada día 5. Desde el 5-feb-2027: $348.000 cada día 5. Sin costo para el club: rediseño de la página web e integración de WhatsApp.',
         'fecha', '2026-10-15',
         'sin_costo', jsonb_build_array('rediseno_web', 'whatsapp')
       )),
       updated_at = now()
 WHERE school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c';

COMMIT;


-- =============================================================================
-- VERIFICACIÓN (correr al final)
-- =============================================================================
SELECT 'pizarra: tactical_ai_credits'        AS objeto, to_regclass('public.tactical_ai_credits')        IS NOT NULL AS existe
UNION ALL SELECT 'pizarra: tactical_ai_analyses',        to_regclass('public.tactical_ai_analyses')        IS NOT NULL
UNION ALL SELECT 'pizarra: exercise_packs',              to_regclass('public.exercise_packs')              IS NOT NULL
UNION ALL SELECT 'pizarra: fn tactical_video_url_ok',    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tactical_video_url_ok')
UNION ALL SELECT 'pizarra: fn tactical_ai_user_budget_micro_usd', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tactical_ai_user_budget_micro_usd')
UNION ALL SELECT 'facturación: school_billing_schedule', to_regclass('public.school_billing_schedule')     IS NOT NULL
UNION ALL SELECT 'facturación: school_one_time_charges', to_regclass('public.school_one_time_charges')    IS NOT NULL
UNION ALL SELECT 'facturación: fn admin_set_school_billing_agreement', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_set_school_billing_agreement');
-- Después: npm run seguridad:invariantes  (debe salir sin violaciones CRÍTICAS)
