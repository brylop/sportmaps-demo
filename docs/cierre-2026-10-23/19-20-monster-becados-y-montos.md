# Monster´s Volley Club — #19 becados y #20 montos (2026-10-23)

Escuela: `eb3ebc77-4ea4-4992-96c8-3c8ec574578c`. **Solo lectura**: no se escribió nada en la base. El SQL de abajo está listo y sin ejecutar.
Los mismos bloques SQL están en `19-20-monster-becados.sql`.

## Resumen

1. **#20 estaba mal planteado.** Las 145 inscripciones activas **sí tienen monto**: todas están en un equipo con `price_monthly > 0` y la cascada (`monthly_fee` → plan → `teams.price_monthly`) da un valor real. Sin monto resoluble: **0**. Lo que parecía «sin monto» era `monthly_fee` nulo, no ausencia de cobro.
2. **El problema real es otro: se factura y nadie puede pagar.**
   - Hay **145 cobros `pending` de octubre por $21.535.000**, 0 pagados, creados por el cron el 21-oct. Los 145 son del periodo 2026-10.
   - Cuentas de recaudo: `payment_accounts` vacío (0), sin banco, sin número de cuenta, sin QR, `payment_setup_completed=false`, 0 proveedores de pasarela.
   - `billing_enabled=true`, `auto_generate_payments=true`, corte día 1, gracia 5, `late_fee_enabled=false`, `auto_cancel_overdue_enabled=false`.
   - `preview_open_month(…, 2026, 11)` emitiría hoy **145 cobros por $21.535.000**, becados incluidos.
3. **Los becados hoy se están cobrando completo.** De los 13 nombres, **6 personas están cargadas y las 6 tienen un cobro pendiente de $145.000** (2 deportistas y 4 profes que también juegan).
4. **Faltan 6 deportistas** de la lista (no hay ninguna coincidencia): Samuel López, Miguel Hernández, Felipe Sandoval, María José Vásquez, Paola Ramírez e Isabella Silva.

## #20 — Montos por equipo (activas)

| Equipo | Precio equipo | Activas | Con `monthly_fee` |
|---|---|---|---|
| U17 FEMENINO PROFUNDIZACION | 145.000 | 14 | 0 |
| U15 FEMENINO PROYECCION | 145.000 | 13 | 0 |
| U17 MASCULINO PROFUNDIZACIÓN | 145.000 | 13 | 0 |
| U15 FEMENINO COMPETENCIA | 145.000 | 13 | 0 |
| U13 MIXTO | 145.000 | 12 | 7 (165.000) |
| U9 Y U11 MIXTO | 145.000 | 12 | 1 (165.000) |
| MIXTO MAYORES PROFUNDIZACION | 135.000 | 11 | 3 (155.000) |
| U19 Y U21 FEMENINO | 145.000 | 10 | 0 |
| U19 Y U21 MASCULINO | 145.000 | 8 | 0 |
| MAYORES FEMENINO | 145.000 | 7 | 1 (165.000) |
| MAYORES MASCULINO | 145.000 | 7 | 0 |
| 9 equipos de Norte | 165.000 | 19 | 0 |
| U17 MASCULINO COMPETENCIA / U15 MASCULINO | 145.000 | 6 | 0 |

- **Cobros pendientes por monto:** 106 × 145.000, 8 × 135.000, 28 × 165.000 y 3 × 155.000. Coinciden con el precio de equipo o con la cuota individual.
- **Las 12 con `monthly_fee` distinto** son la **doble categoría**: 145.000 + 20.000 = 165.000 y 135.000 + 20.000 = 155.000, iguales al precio de los planes «Doble categoria» (165.000) y «Plan Mayores mixto doble categoria» (155.000). Hoy se aplican por `monthly_fee` suelto, sin plan ligado, `fee_is_manual=false`.
- **Planes en `offering_plans` (4, todos con 0 inscripciones activas):** Doble categoria 165.000 · Plan Mayores mixto 135.000 · Plan Mayores mixto doble categoria 155.000 · Tarifa plena 145.000.
- **Doble cobro:** ninguna persona tiene dos inscripciones activas (145 personas, 145 inscripciones).

### Regla propuesta para #20

- **No cargar montos.** Ya resuelven. Tocarlos no cambia ningún cobro y arriesga duplicar la cuota por plan + equipo.
- **Lo que sí bloquea el cobro, en orden:**
  1. Cargar la cuenta de recaudo de Monster (banco, número, titular, o QR) en `school_settings.payment_accounts`. Lo hace la escuela o se pide a la dueña.
  2. Decidir qué hacer con los 145 cobros de octubre ya emitidos sin cuenta (¿se dejan, o se avisa a las familias cuando haya cuenta?).
  3. Aplicar las becas (#19) **antes** de que el cron emita noviembre (corte día 1).
- **Opcional, no urgente:** ligar las 12 de doble categoría a su plan para que se vean como plan y no como cuota suelta (bloque C, comentado).

## #19 — Becados

Beca = inscripción con `fee_is_manual=true` y `monthly_fee=0` (migración `20260827175215`); la vista `school_athletes` ya la muestra sin «Pendiente» (`20260915113256`).

**Regla del usuario:** un «profe becado» es un profe que además es atleta y entrena. Se trata como atleta becado.

### Deportistas

| Nombre pedido | Encontrado | Tipo / equipo / estado | Acción |
|---|---|---|---|
| Deivis Valle | **Sí** · Deivis Fernando Valle Castro | unregistered · U19 Y U21 MASCULINO · activa · $145.000 pendiente | Beca total |
| Laura Ladino (50 %) | **Sí** · Laura Nicoll Ladino Amezquita | unregistered · U19 Y U21 FEMENINO · activa · $145.000 pendiente | Beca 50 % = **72.500** (confirmado por el usuario) |
| Samuel López | No | Solo «Carlos Samuel Rodriguez Sanchez» (otra persona) | Crear ficha e inscripción |
| Miguel Hernández | No | Solo «Matías Hernández Rodríguez» y «Luis Miguel Gamba Osorio» (otras personas) | Crear |
| Felipe Sandoval | No | Sin ningún Sandoval | Crear |
| María José Vásquez | No | Sin ningún Vásquez/Vazquez | Crear |
| Paola Ramírez | No | Solo «Gabriela Miranda Ramirez» y «angy paola cardenas benavides» (otras personas) | Crear |
| Isabella Silva | No | Solo «Silvana Umbacía Pinzón» | Crear |

### Profes

| Nombre pedido | Staff | Atleta | Acción |
|---|---|---|---|
| Julián Torres | No está en `school_staff` | **Sí** · Julián Fernando Torres Fino · U19 Y U21 MASCULINO · activa · $145.000 pendiente | Beca total |
| Tatiana Díaz | No está en `school_staff` | **Sí** · Ingri Tatiana Díaz Pimentel · MAYORES FEMENINO · activa · $145.000 pendiente | Beca total |
| Ana Forero | No está en `school_staff` | **Sí** · Ana Sofía Forero Orozco · U19 Y U21 FEMENINO · activa · $145.000 pendiente | Beca total |
| Sebastián Hurtado | **Sí** (3 equipos) | **Sí** · Juan Sebastián Hurtado Rodríguez · MAYORES MASCULINO · activa · $145.000 pendiente | Beca total. **Misma persona**: el correo del staff y el del atleta es el mismo |
| Felipe Sossa (Iván Felipe Sossa Benítez) | **Sí** (9 equipos de Norte) | **No**: sin ficha, sin perfil, sin inscripción en ninguna tabla | No hay nada que becar. Solo habría que crearle ficha e inscripción si **sí juega** |

Observaciones:
- Julián Torres, Tatiana Díaz y Ana Forero entrenan pero **no están cargados como staff** (no tienen `school_staff` ni `team_coaches`). Si deben operar como entrenadores, falta cargarlos.
- Hoy todos son `unregistered`: sin cuenta, sin acudiente.

### Cobros que se corrigen con estas becas

- Octubre: de los 145 pendientes pasan a **140** (se anulan 5) y el total baja de $21.535.000 a **$20.737.500** (5 × 145.000 menos 72.500 de Laura).
- Noviembre (`preview_open_month` 2026-11): de 145 cobros a **140** y de $21.535.000 a **$20.737.500**.

## Verificación antes / después

Solo lectura, se puede correr cuando se quiera (la función es `STABLE`; sin JWT no valida rol):

```sql
-- Antes (medido el 2026-10-23): n=145, total=21535000
-- Después de aplicar el bloque A: n=140, total=20737500
with r as (select public.preview_open_month('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 2026, 11, null) j),
     i as (select x->>'athlete' a, (x->>'amount')::numeric m from r, jsonb_array_elements(j->'items') x)
select count(*) n, sum(m) total from i;

-- Cobros pendientes de octubre (antes: 145 y 21535000)
select count(*), sum(amount) from payments
 where school_id='eb3ebc77-4ea4-4992-96c8-3c8ec574578c' and status='pending';
```

## SQL listo, sin ejecutar

> **Mejor por la app:** editar cada deportista (`PUT /students/:id`) actualiza `enrollments.monthly_fee` y propaga el cobro por el BFF, que conserva las reglas. Este SQL es el plan B y lleva candado en cada fila: solo cambia lo que esté exactamente como se vio el 2026-10-23.
> **No se aplica por el editor de SQL ni por agentes en paralelo** (regla de una sola sesión). Aplicar con `apply_migration` o CLI.

### Bloque A — becas (6 personas)

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';

WITH becados(enrollment_id, pago_id, cuota, motivo) AS (VALUES
  -- Deportistas
  ('7c15208b-8f0b-4972-8b06-c05b37b5def3'::uuid, '1228eacc-c819-48c5-8ee3-b40e196d81ef'::uuid, 0,     'Beca deportiva'),               -- Deivis Valle
  ('2fef91ae-2ce1-4296-981b-af54d94f4c8c'::uuid, 'dc03e41f-004c-46a2-9dd2-f6d65f145af7'::uuid, 72500, 'Beca 50 %'),                           -- Laura Ladino (confirmado)
  -- Profes que también entrenan (beca de atleta)
  ('c8cd81af-2f3a-44fb-9f4c-1685356fb854'::uuid, '88033d18-9e7b-4e12-8b45-86d9f419d298'::uuid, 0,     'Beca profe'),                   -- Julián Torres
  ('c4348687-a98c-4d3a-b34c-1b7f2e0fc59e'::uuid, '26cfe32c-0955-4e72-843d-314fecf2e821'::uuid, 0,     'Beca profe'),                   -- Tatiana Díaz
  ('fe297351-5ae8-4b2e-ba12-044e2113bb9f'::uuid, 'b979bd59-d1d4-47a6-b504-04898fa1adc6'::uuid, 0,     'Beca profe'),                   -- Ana Forero
  ('bb74019a-aa90-479f-bc40-0a4e3957a95c'::uuid, '2049d58e-5b6b-408b-87dc-cada43ddf5fb'::uuid, 0,     'Beca profe')                    -- Sebastián Hurtado
),
ins AS (   -- 1) la inscripción queda como cuota manual
  UPDATE public.enrollments e
     SET monthly_fee = b.cuota, fee_is_manual = true, fee_reason = b.motivo
    FROM becados b
   WHERE e.id = b.enrollment_id
     AND e.school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
     AND e.status = 'active'
     AND e.monthly_fee IS NULL AND e.fee_is_manual = false          -- candado
  RETURNING e.id
),
total AS (  -- 2) beca total: payments_amount_positive impide amount=0, así que se anula el cobro de octubre
  UPDATE public.payments p
     SET status = 'cancelled'
    FROM becados b
   WHERE p.id = b.pago_id AND b.cuota = 0
     AND p.school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
     AND p.status = 'pending' AND p.amount = 145000                 -- candado
  RETURNING p.id
),
parcial AS (  -- 3) beca parcial: el cobro de octubre baja al monto nuevo
  UPDATE public.payments p
     SET amount = b.cuota
    FROM becados b
   WHERE p.id = b.pago_id AND b.cuota > 0
     AND p.school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
     AND p.status = 'pending' AND p.amount = 145000                 -- candado
  RETURNING p.id
)
SELECT (SELECT count(*) FROM ins) inscripciones, (SELECT count(*) FROM total) cobros_anulados, (SELECT count(*) FROM parcial) cobros_reducidos;
-- Esperado: 6, 5, 1. Si no da exactamente eso, ROLLBACK;

COMMIT;  -- o ROLLBACK;
```

### Bloque B — lo que falta crear (no ejecutable todavía)

Faltan 6 deportistas becados: Samuel López, Miguel Hernández, Felipe Sandoval, María José Vásquez, Paola Ramírez, Isabella Silva. Para cada uno hacen falta, **del usuario o de Monster**: equipo, documento y, idealmente, correo y acudiente. Ficha mínima = fila en `unregistered_athletes` (`school_id`, `full_name`) + inscripción activa con `team_id`, `monthly_fee=0`, `fee_is_manual=true`, `fee_reason='Beca deportiva'`. Se crea **después** de saber el equipo; sin equipo no hay cobro y no tiene sentido la inscripción.

### Bloque C — opcional: ligar la doble categoría a su plan (comentado)

```sql
-- Solo si Monster quiere ver «plan» en vez de cuota suelta. OJO: con plan ligado el monto lo manda el plan y la
-- cuota de equipo se muestra en 0 (memoria project_athlete_fee_source). No cambia ningún cobro.
-- UPDATE public.enrollments e SET offering_plan_id = '2f5591db-d1d0-4887-bbfe-2c16002eb046' ... (NO usar: «Tarifa plena» es 145.000)
-- UPDATE public.enrollments e SET offering_plan_id = 'feb3ddc1-b515-4b2a-8f84-2a228287d62d'   -- Doble categoria 165.000
--  WHERE e.school_id='eb3ebc77-4ea4-4992-96c8-3c8ec574578c' AND e.status='active' AND e.monthly_fee=165000 AND e.offering_plan_id IS NULL;  -- esperado 9
-- UPDATE public.enrollments e SET offering_plan_id = '616c5def-6d9f-409b-9d4d-532a1e1ba66c'   -- Plan Mayores mixto doble categoria 155.000
--  WHERE e.school_id='eb3ebc77-4ea4-4992-96c8-3c8ec574578c' AND e.status='active' AND e.monthly_fee=155000 AND e.offering_plan_id IS NULL;  -- esperado 3
```

## Decisiones que necesita del usuario

1. ~~Laura Ladino al 50 %~~: **confirmado por el usuario**, 72.500 por mes (la mitad de 145.000). Ya está en el SQL.
2. **Los 6 deportistas que no están cargados**: ¿en qué equipo juega cada uno? (y si hay documento, correo y acudiente). Hoy no se les puede aplicar beca porque no existen.
3. **Felipe Sossa**: no tiene ficha de atleta. ¿Juega? Si no juega, no hay beca que aplicar (solo es staff).
4. **Julián Torres, Tatiana Díaz y Ana Forero**: ¿deben cargarse también como entrenadores (staff + equipos)? Hoy solo existen como atletas.
5. **Octubre**: los 145 cobros ya existen sin cuenta de recaudo. ¿Se dejan, o se anulan y se emiten de nuevo cuando haya cuenta? Y ¿quién entrega los datos bancarios de Monster?
6. **Corrección del roadmap**: #20 («133 inscripciones sin monto») queda sin sustento. Conviene reescribirlo como «cargar la cuenta de recaudo y decidir los cobros de octubre».
