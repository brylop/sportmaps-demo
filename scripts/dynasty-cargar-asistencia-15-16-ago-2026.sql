-- ============================================================================
-- DYNASTY — carga de la asistencia del 15 y 16 de agosto + limpieza de
-- inscripciones duplicadas
--
-- Fecha: 2026-08-17
-- Origen: listado enviado por el entrenador Ángel Nicolás Forero Gómez.
--
-- Los nombres ya están resueltos a `child_id` uno por uno contra la base: NO
-- hay coincidencia difusa acá. Los IDs salieron de cruzar el listado con las
-- 453 inscripciones activas y verificar cada caso dudoso a mano.
--
-- Pegar en el SQL Editor de Supabase y correr los bloques EN ORDEN.
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOQUE 1 — Limpiar las inscripciones duplicadas                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- 15 atletas de Dynasty tienen DOS inscripciones: una `pending` sin equipo (y
-- casi siempre sin plan) y otra `active` completa. Se borra la incompleta.
--
-- Verificado antes de escribir esto: las 11 de abajo no tienen NADA colgando —
-- 0 billing_events, 0 class_enrollments, 0 session_bookings, 0 planes de PT.
-- El borrado no arrastra nada por cascada.
--
-- OJO — quedan 4 pares FUERA de esta lista a propósito, porque sus dos filas
-- tienen planes de distinto precio y borrar una elige un precio. Eso lo decide
-- la escuela, no nosotros:
--     Michelle Rubiano   ELITE $180.000  vs  START $90.000
--     Isabella Suárez    ELITE $180.000  vs  DYNASTY $210.000
--     Isabella Carreño   SENIORS8 $130.000 vs PRO $150.000
--     Salomé Quintero    SENIORS8 $130.000 vs PRO $150.000

DELETE FROM enrollments
 WHERE id IN (
   '3f415455-4f2a-4113-a746-ca002325e8a2', -- Isabella Montenegro   (pending sin plan)
   'eeb39235-96ef-4f1a-8a68-88e861be4b92', -- Isabella Sánchez      (mismo PLAN PRO)
   '8578cb8e-ae5b-48ac-b7cf-a92c161689bb', -- Kristen Salomé Rojas  (pending sin plan)
   '8edab74e-0db8-4298-af9e-9118e21e8448', -- Leidy Johanna Pallares
   'b53180d7-0e6d-423f-bcc1-64de0a415e2b', -- Manuela Bermúdez
   '21c92446-9202-49bc-9107-c4d3e854e176', -- Manuela Góez          (mismo PLAN ELITE)
   '0601f88b-8f8e-4e58-8285-27f0e04c45ad', -- María Antonia Arturo
   'b82583d0-db82-4f98-97da-d160a91ed84d', -- Nathalie Puentes
   'c38fa621-3a84-410e-9796-cd3074f3c6b8', -- Sara Lucía Yory
   '0b5dbd13-7b52-4ca2-aabe-a588c353eae0', -- Sara Valeria Acosta
   'c952fbe0-cf6f-49f4-81da-f5ac68084067'  -- Valeria Prieto        (mismo PLAN PRO)
 )
 AND school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
 AND status = 'pending';
-- Esperado: DELETE 11


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOQUE 2 — Los 41 registros de asistencia                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- La sesión del 16/08 de INTERMEDIO ya está creada: ac4d19d4-a908-4eb6-9285-1ef94bea5e38
-- Las del 15/08 ya existían y están finalizadas; insertar directo no las toca.
--
-- Decisión a revisar: el listado del 15 venía como UN entrenamiento conjunto
-- («Menores Masculino con juvenil masculino con Menores femenino»), así que los
-- 14 van a la sesión de MENORES MASCULINO en vez de inventar cuatro sesiones
-- para un entrenamiento que ocurrió una sola vez. Si prefieren separarlos por
-- categoría, hay que crear las sesiones de INFANTIL MASCULINO, JUVENIL MAYORES
-- MASCULINO e INFANTIL FEMENINO para esa fecha y repartirlos.
--
-- `on conflict do nothing` protege contra correrlo dos veces: el índice único
-- es (session_id, atleta).

INSERT INTO attendance_records
  (school_id, session_id, attendance_date, status, team_id, marked_by, child_id, check_in_method)
SELECT '2d509571-3238-4c04-ac3f-6dfe20539226', v.session_id, v.fecha::date, 'present', v.team_id,
       '32352a9e-04d1-4969-bf08-3028fe64e0d3', v.child_id, 'manual'
FROM (VALUES
 -- ── 15/08 · INTERMEDIO — los 5 que faltaban de los 22 del listado ──────────
 ('d9015c6e-7b97-4f16-9e24-847bbcea020c','2026-08-15','7d4219e3-f343-4e99-9527-fa7af7e8285e','4844bb79-380a-4c18-8257-6da7ad32b562'), -- Sara Valentina Acosta Manrique
 ('d9015c6e-7b97-4f16-9e24-847bbcea020c','2026-08-15','7d4219e3-f343-4e99-9527-fa7af7e8285e','1f61200a-096d-4a9a-af8b-bb1e690f58db'), -- Luciana Carrillo Ruiz
 ('d9015c6e-7b97-4f16-9e24-847bbcea020c','2026-08-15','7d4219e3-f343-4e99-9527-fa7af7e8285e','bf17b98c-7e44-48be-bc26-d629ff051348'), -- Isabella Romero González
 ('d9015c6e-7b97-4f16-9e24-847bbcea020c','2026-08-15','7d4219e3-f343-4e99-9527-fa7af7e8285e','cb18415d-2784-4fc9-a5b0-0aad95a101de'), -- Salome Baron Garcia (Infantil Fem)
 ('d9015c6e-7b97-4f16-9e24-847bbcea020c','2026-08-15','7d4219e3-f343-4e99-9527-fa7af7e8285e','2d3a367e-fb30-4305-bbd9-2ddece8764d0'), -- Sarah Luciana Sequeda (Nueva Era)

 -- ── 15/08 · entrenamiento conjunto, sesión de MENORES MASCULINO — 14 ───────
 ('a970b94f-a769-47d9-a074-cd467c9aefe0','2026-08-15','1bbdfadf-f60a-45cd-8751-d112bfc057a6','c17f83a4-4e13-4e83-83b7-9a42a888104d'), -- Juan Carlos Sánchez Martínez
 ('a970b94f-a769-47d9-a074-cd467c9aefe0','2026-08-15','1bbdfadf-f60a-45cd-8751-d112bfc057a6','27d826e5-ce9a-4cbb-b253-bb3c09af9287'), -- Juan José Peña
 ('a970b94f-a769-47d9-a074-cd467c9aefe0','2026-08-15','1bbdfadf-f60a-45cd-8751-d112bfc057a6','650bb7d7-228f-45ea-8667-bb6c854c4413'), -- Keneth Alejandro Herrera
 ('a970b94f-a769-47d9-a074-cd467c9aefe0','2026-08-15','1bbdfadf-f60a-45cd-8751-d112bfc057a6','4c15cf23-d0c4-4018-a97b-9dc1b256aef7'), -- Santiago Suárez Roa
 ('a970b94f-a769-47d9-a074-cd467c9aefe0','2026-08-15','1bbdfadf-f60a-45cd-8751-d112bfc057a6','570177f2-d0a2-456f-9957-4037be602ca1'), -- Juan Manuel Torres Bareño (Infantil Masc)
 ('a970b94f-a769-47d9-a074-cd467c9aefe0','2026-08-15','1bbdfadf-f60a-45cd-8751-d112bfc057a6','193e7f19-ecf1-45bb-853c-c07c5d0d875e'), -- Matías Quintero Casallas (Infantil Masc)
 ('a970b94f-a769-47d9-a074-cd467c9aefe0','2026-08-15','1bbdfadf-f60a-45cd-8751-d112bfc057a6','37c6b848-ff64-4a98-908f-2316585456ec'), -- Juan Sebastián Quintero (Juvenil Mayores)
 ('a970b94f-a769-47d9-a074-cd467c9aefe0','2026-08-15','1bbdfadf-f60a-45cd-8751-d112bfc057a6','94d12002-e9bc-4c62-846e-10affd405b27'), -- José Alejandro Lizcano
 ('a970b94f-a769-47d9-a074-cd467c9aefe0','2026-08-15','1bbdfadf-f60a-45cd-8751-d112bfc057a6','07eda7b8-7584-47a4-a2ae-6524f505dead'), -- Yuri Nicoll Díaz
 ('a970b94f-a769-47d9-a074-cd467c9aefe0','2026-08-15','1bbdfadf-f60a-45cd-8751-d112bfc057a6','f8c4ba20-8757-403e-84b4-3c2d03078357'), -- Alejandro Ardila
 ('a970b94f-a769-47d9-a074-cd467c9aefe0','2026-08-15','1bbdfadf-f60a-45cd-8751-d112bfc057a6','974791aa-e0ba-4012-a9f7-edd8c8759338'), -- Jefferson Steven Rojas
 ('a970b94f-a769-47d9-a074-cd467c9aefe0','2026-08-15','1bbdfadf-f60a-45cd-8751-d112bfc057a6','632b0f58-b409-4be9-8633-ce41ec4c38a9'), -- Josué Cortés Sáenz
 ('a970b94f-a769-47d9-a074-cd467c9aefe0','2026-08-15','1bbdfadf-f60a-45cd-8751-d112bfc057a6','28661485-f914-4e48-89a5-19ecf04e0bf8'), -- Luis Alejandro Parra Moreno
 ('a970b94f-a769-47d9-a074-cd467c9aefe0','2026-08-15','1bbdfadf-f60a-45cd-8751-d112bfc057a6','608e72f9-2316-41dc-88d1-070383505d28'), -- Haifa Helena De Luque ("Helen Delupe")

 -- ── 16/08 · INTERMEDIO, sesión nueva — los 22 ──────────────────────────────
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','51c88f94-c801-4cf3-803b-95d47e9f1035'), -- Sara Lucía Yory Castro
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','81ec4bb5-13ce-41a5-bf6c-c6f652ff3cab'), -- Samantha Peña Sánchez
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','55a37a1d-b0fa-4ccc-bd23-e87c169f5617'), -- Luciana Sandoval Rozo
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','9fb6d213-86e6-4388-8712-be8ef2a53b25'), -- Karen Mariana Galvis Mora
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','930c72b5-56ec-41c6-9797-984b33fe477a'), -- Hellen Valentina Acosta Mancipe
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','9b471fc1-900c-451c-bf12-062d2ab2fab5'), -- Michelle Samantha Rubiano Vega
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','d717ca4b-7f51-4123-a34a-d5489b7861aa'), -- Luciana Guzmán Díaz
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','31869b05-324e-4a79-b9f3-6e6b56f1d527'), -- Kristen Salomé Rojas Pineda
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','cc052998-88bf-47dd-b122-89ec81225d4b'), -- Sara Alejandra Gil Alfonso
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','3a37d8dd-ecfd-4e69-81bf-2732b3c15aab'), -- Danna Sofía López Romero
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','0bba21b6-84f6-4048-9f0c-3f24fd5675e7'), -- María Fernanda Arenas Quiroga
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','7f06bba5-6a47-4e81-87b9-65e73bf0ee64'), -- Isabela Perea Martínez
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','17e35b6c-8edd-4103-823d-e1e6678243bb'), -- Sofía Parra Villada
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','e2cac824-3335-4b0a-8c5a-6ce1e6a8e62b'), -- Linda Saray Mendoz
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','6c957367-5de7-4e08-8b23-0b8dbb666e9b'), -- María Gabriela Medina Ibáñez
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','127dccf2-9eee-45ea-8ab2-a0ac6288e1b2'), -- Sara Priolo Galeano
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','2d3a367e-fb30-4305-bbd9-2ddece8764d0'), -- Sarah Luciana Sequeda Toro
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','3ce4a610-1d33-4f53-a41d-f9bcf378c82e'), -- Sofía Alejandra Toro Chaparro
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','4b92fd9e-1282-4b46-9614-9c80a9df749d'), -- Luciana Rincón Archila
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','e61e99f1-2a3f-4bf0-bc51-dc33c11123f8'), -- Isabella Ramos Rodríguez
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','bf17b98c-7e44-48be-bc26-d629ff051348'), -- Isabella Romero González
 ('ac4d19d4-a908-4eb6-9285-1ef94bea5e38','2026-08-16','7d4219e3-f343-4e99-9527-fa7af7e8285e','5e093142-38c3-491c-982c-47a449cfd459')  -- Sara Juliana Lamus Sanclemente
) AS v(session_id, fecha, team_id, child_id)
ON CONFLICT DO NOTHING;
-- Esperado: INSERT 41


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOQUE 3 — Descontar las clases del plan                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Se descuenta con la FECHA DEL EVENTO, no con la de hoy: importa si el plan
-- estaba vigente el día que la atleta entrenó. Quien lo tenía vencido (varias
-- vencieron el 05-ago) queda con la asistencia registrada y SIN descuento — es
-- justo la fuga que ahora se ve en «Plan vs consumo».
--
-- Va por el RPC y no por UPDATE: `move_session_credit` toma SELECT … FOR UPDATE
-- sobre la inscripción, que es lo que evita que dos descuentos simultáneos
-- consuman un solo crédito.

SELECT c.full_name, ar.attendance_date, public.move_session_credit(e.id, 1, false) AS resultado
  FROM attendance_records ar
  JOIN children c ON c.id = ar.child_id
  JOIN enrollments e ON e.child_id = ar.child_id
                    AND e.school_id = ar.school_id
                    AND e.status = 'active'
                    AND e.offering_plan_id IS NOT NULL
  JOIN offering_plans op ON op.id = e.offering_plan_id
 WHERE ar.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
   AND ar.attendance_date IN ('2026-08-15','2026-08-16')
   AND ar.session_id IN ('d9015c6e-7b97-4f16-9e24-847bbcea020c',
                         'a970b94f-a769-47d9-a074-cd467c9aefe0',
                         'ac4d19d4-a908-4eb6-9285-1ef94bea5e38')
   AND ar.created_at > now() - interval '2 hours'      -- solo las recién cargadas
   AND (e.expires_at IS NULL OR e.expires_at >= ar.attendance_date)
   AND (op.max_sessions IS NULL OR e.sessions_used < op.max_sessions)
 ORDER BY c.full_name;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOQUE 4 — Verificar                                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

SELECT t.name AS equipo, s.session_date, s.finalized, count(ar.id) AS marcas
  FROM attendance_sessions s
  JOIN teams t ON t.id = s.team_id
  LEFT JOIN attendance_records ar ON ar.session_id = s.id
 WHERE s.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
   AND s.session_date IN ('2026-08-15','2026-08-16')
 GROUP BY 1,2,3
 ORDER BY 2,1;
-- Esperado:
--   15/08  INTERMEDIO         finalizada   22   (17 + 5)
--   15/08  MENORES FEMENINO   finalizada    2
--   15/08  MENORES MASCULINO  finalizada   24   (10 + 14)
--   16/08  INTERMEDIO         abierta      22
