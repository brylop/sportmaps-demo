# Mitigación Dynasty — runbook 2026-08-03

**Dynasty Volley Club está en producción con 397 atletas activos y no sabe nada de esto.**
El objetivo es cerrar los huecos sin que se les caiga la operación ni tengan que enterarse
por un cobro mal hecho. Todo lo de acá se hizo sobre datos reales: la Supabase es **una
sola** para dev/stg/prod (`luebjarufsiadojhvxgi`), así que **cada migración pega en
producción en el momento de aplicarla**, sin importar de qué rama salga el código.

Corolario incómodo pero útil: la fuga de datos se cierra con migración, sin depender de
un despliegue a `main`.

---

## 1. Estado al 2026-08-03

Medido con `bff/school-status.mjs` y `bff/wompi-reconcile-school.mjs` (ambos solo lectura).

| | |
|---|---|
| Atletas activos | 397 (de 451) |
| Inscripciones activas | 476 · **80 atletas con 2+** |
| Cobros de agosto | 525 generados para 397 atletas · 143 ya cancelados a mano |
| Cobros abiertos | 344 · $52.510.000 |
| Sin pagador | 255 · $38.830.000 — **no es bug**, son invitaciones en `pending` |
| Recaudo online | 13 tx aprobadas en producción · $1.984.500 bruto · $64.500 de recargo |
| Plan SaaS | `starter` activo con `current_period_end` = 2026-07-27 (**vencido**) |

Lo verificado y sano: el recargo del 5% se cobra bien desde el 1 de agosto y las 12
primeras transacciones cuadran al peso contra la API de Wompi. El trigger
`trg_adopt_orphan_payments_on_child_link` está habilitado y no hay ni un cobro huérfano
por bug — los 255 se destraban solos cuando el acudiente acepte la invitación.

---

## 2. La cadena del cobro duplicado

Tres eslabones distintos, cada uno arreglable por separado:

**(1) El QR crea inscripciones vacías.** La RPC de alta por QR
([`20260730195052_qr_signup_match_by_document.sql:427`](../supabase/migrations/20260730195052_qr_signup_match_by_document.sql#L427))
inserta `(user_id, child_id, school_id, team_id, start_date, status)` y **nunca escribe
`monthly_fee` ni `offering_plan_id`**. Si el QR no fija equipo, la fila queda sin equipo,
sin plan y sin cuota. La RPC ya conoce el monto (`v_amount`, que usa para el primer
cobro) y no lo guarda.

Evidencia del timing: la migración se aplicó el 2026-07-30 19:50:52 y la primera fila
vacía apareció 19:52:16 — **84 segundos después**. Van 17, una cada pocas horas.

**(2) Asignar equipo o plan inserta una segunda fila** en vez de completar la que existe.
De ahí los pares separados por medio segundo (1 y 2 de agosto) y los separados por 24
días (carga masiva del 6 de julio + asignación de planes del 30 de julio). Misma forma en
los dos casos: una fila con equipo y cuota 0, otra con plan y la cuota real.

Que existe un camino correcto está probado: Sara Priolo, Hellen Valentina, Sebastián
Pérez y Valeria Pacanchique tienen **equipo y plan en la misma fila** y no están
duplicadas.

**(3) El generador recorre inscripciones, no atletas.** Un cobro por fila, con la cuota de
cada una — o una inventada cuando viene NULL. Es el eslabón que convierte cualquier
duplicado en plata mal cobrada.

Hoy eso se ve así en la pantalla de "pendientes por generar": **23 cobros para 15
atletas, $3.690.000** cuando lo correcto es **15 cobros, $2.310.000**. Son $1.380.000 de
cobro duplicado esperando que alguien le dé al botón.

**Aparte:** el equipo `c05c3247-0121-4894-9b77-88db8001d754` se llama
`MINIVOLLEY -BENJAMINES (DUPLICADO - NO USAR)` y el flujo de agosto siguió inscribiendo
gente ahí (Anna Isabella, Juan Martín, Nathalie Victoria, Victoria Ávila).

---

## 3. Runbook

Bloques en orden. Cada uno se verifica antes de pasar al siguiente.

### Bloque 0 — congelar (ahora)

**No generar el mes de agosto** hasta terminar el bloque 3. Si se genera hoy, entran
$1.380.000 de cobros duplicados y alguien los limpia a mano, como los 143 de este mes.

### Bloque 1 — migración `20260802224625_children_rls_solo_staff`

Cierra el acceso de acudientes y atletas a las fichas de **todos** los menores del club:
451 registros con nombre, fecha de nacimiento, `medical_info` y contacto de las otras
familias. Una de las dos policies es `ALL`, así que también permitía modificarlas y
borrarlas. Alcance global: 568 membresías `parent` y 33 `athlete` activas.

Es lo más urgente del runbook y **no depende de ningún despliegue**.

Riesgo medido: un solo usuario podría perder acceso (`jreyes@gmail.com`, rol de escuela
pero solo acudiente en la Escuela Demo, donde no es dueño) y es el comportamiento
correcto. Todas las pantallas de padre ya filtran por `parent_id` en la propia consulta,
así que no dependían de la RLS. El BFF usa `service_role` y no pasa por RLS.

Verificación (al final del archivo de la migración): el `count` de `children` de Dynasty
con el uid de un acudiente debe pasar de **451 a solo sus hijos**, y con el uid de un
owner seguir en **451**. Modo de fallo a vigilar los primeros minutos: si
`staff_school_ids()` quedara sin `GRANT EXECUTE`, la policy da 403 para *todos*.

Vuelta atrás: migración nueva con las dos policies apuntando de nuevo a
`user_school_ids()`. Sin pérdida de datos.

### Bloque 2 — migración `20260802215226_recargo_online_es_de_la_escuela`

Deja por escrito que el recargo es de la escuela y corrige el ledger, que lo venía
anotando como cuenta por cobrar contra ella (`sportmaps_receives`), cuando nadie iba a
liquidar eso nunca. Para Dynasty no cambia nada visible.

Reversible: `payment_links` conserva `base_amount` y `sportmaps_fee`, así que el split
viejo se reconstruye con un `UPDATE … FROM payment_links`.

### Bloque 3 — limpieza de datos (antes de generar el mes)

**3.1 Completar las 13 inscripciones vacías que son la única del atleta.** Cancelarlas
dejaría a esos chicos sin inscripción, fuera del listado y sin contar como activos. El
monto está en `children.monthly_fee` y **los 13 dieron coincidencia exacta** con un plan
del catálogo, así que no hay que adivinar.

```sql
UPDATE public.enrollments SET offering_plan_id='c9348cd7-3157-4b25-9a1f-d4c2f9ace428', monthly_fee=150000 WHERE id='b376bd46-edc5-4272-b055-6d359c966108'; -- Martin Leandro Mayorga · PLAN PRO
UPDATE public.enrollments SET offering_plan_id='622df953-1e5b-477d-92b9-a944227f5f11', monthly_fee=180000 WHERE id='9463e34c-87fa-427f-86cd-57092d66c5b8'; -- Sofia Romero · PLAN ELITE
UPDATE public.enrollments SET offering_plan_id='02876fa4-6c2c-47d0-81b7-b806560be59d', monthly_fee=210000 WHERE id='30216a8d-1d13-41cf-a4b6-05b18b46b405'; -- Anaisabel Mondragón · PLAN DYNASTY
UPDATE public.enrollments SET offering_plan_id='622df953-1e5b-477d-92b9-a944227f5f11', monthly_fee=180000 WHERE id='0c5b26d9-4724-4035-a6a9-ed8cf82f2a00'; -- Luis Alejandro Parra · PLAN ELITE
UPDATE public.enrollments SET offering_plan_id='c9348cd7-3157-4b25-9a1f-d4c2f9ace428', monthly_fee=150000 WHERE id='b521b3ef-a879-4c5b-89df-c54f48e58f37'; -- Isabella Mateus · PLAN PRO
UPDATE public.enrollments SET offering_plan_id='622df953-1e5b-477d-92b9-a944227f5f11', monthly_fee=180000 WHERE id='17bc295e-0b4b-451f-a801-ca79723d7cfb'; -- Laura Juanita Prieto · PLAN ELITE
UPDATE public.enrollments SET offering_plan_id='622df953-1e5b-477d-92b9-a944227f5f11', monthly_fee=180000 WHERE id='62d6afa1-d778-4efe-817b-93ab54344786'; -- Isabela Martínez · PLAN ELITE
UPDATE public.enrollments SET offering_plan_id='c9348cd7-3157-4b25-9a1f-d4c2f9ace428', monthly_fee=150000 WHERE id='331ba185-4f37-4aee-9e93-98eb00f07f6d'; -- Julieta Mayorga · PLAN PRO
UPDATE public.enrollments SET offering_plan_id='02876fa4-6c2c-47d0-81b7-b806560be59d', monthly_fee=210000 WHERE id='ce19b7c1-03d5-43cf-8c78-b12d768345a4'; -- Sergio Herrera · PLAN DYNASTY
UPDATE public.enrollments SET offering_plan_id='c9348cd7-3157-4b25-9a1f-d4c2f9ace428', monthly_fee=150000 WHERE id='1bfa7840-24a8-4233-b1c5-f58025dd7c03'; -- Sara Sofía Castro · PLAN PRO
UPDATE public.enrollments SET offering_plan_id='622df953-1e5b-477d-92b9-a944227f5f11', monthly_fee=180000 WHERE id='07151bea-bae3-44a2-b835-4d1932f7e76a'; -- Salome Guarin · PLAN ELITE
```

**Confirmar con la escuela antes de correr estas dos**: hay dos planes de $90.000
(`PLAN START` y `PLAN BASIC SENIORS -4 CLASES AL MES`), así que el monto no alcanza para
elegir. Por lo que se usó en el resto del club, fuera de SENIORS va `PLAN START`
(`091f39c4-62c3-45c8-97b3-b6e32acc3b86`):

```sql
-- Sara Isabella Comas Moreno  → enrollment 8c9e1880-cd35-4e1d-bc42-90cdef38efb7
-- Elizabeth Sofía Márquez     → enrollment feed6685-7a69-4ca0-9b8c-13ae2307dc3a
```

**3.2 Cancelar las 4 vacías que sobran** (el atleta ya tiene otra inscripción):

```sql
UPDATE public.enrollments SET status='cancelled' WHERE id IN (
  '0ecf8b92-7bb4-488e-84b8-06e5fd296a95',  -- Edward Samuel Becerra
  'd63e1deb-f185-4082-a6d3-e9dfe57db30b',  -- Victoria Ávila Barrera
  '2f19fe28-26e9-406c-849e-45965d2a391f',  -- Linda Saray Mendoz
  'f7a7bfc6-11ac-45c3-a6a4-6dd4cfd5d979'   -- Maria Gabriela Medina
);
```

**3.3 Fusionar los pares.** La forma correcta ya existe en la base (equipo y plan en la
misma fila). En vez de borrar, la fila del plan hereda el equipo y la de solo-roster se
cancela. Correr primero el dry-run:

```sql
WITH dups AS (
  SELECT child_id,
         max(CASE WHEN offering_plan_id IS NOT NULL THEN id END)                          AS id_plan,
         max(CASE WHEN offering_plan_id IS NULL AND team_id IS NOT NULL THEN id END)      AS id_roster,
         max(CASE WHEN offering_plan_id IS NULL AND team_id IS NOT NULL THEN team_id END) AS team_id
  FROM public.enrollments
  WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226' AND status = 'active'
  GROUP BY child_id
  HAVING count(*) = 2 AND count(offering_plan_id) = 1 AND count(team_id) = 1
)
SELECT d.*, c.full_name FROM dups d JOIN public.children c ON c.id = d.child_id ORDER BY c.full_name;
```

Si cubre los ~76 pares, aplicar los dos `UPDATE` (heredar `team_id` en `id_plan`, cancelar
`id_roster`). Los que queden fuera van uno por uno.

**3.4 Equipo duplicado.** Mover a las 4 atletas de
`c05c3247-0121-4894-9b77-88db8001d754` al equipo real y desactivarlo para que salga del
selector.

**3.5 Verificar y generar.** La pantalla de "pendientes por generar" debe bajar de **23 a
15** y quedar en **$2.310.000**. Esa es la señal de que quedó limpio. Recién ahí, generar
el mes.

### Bloque 4 — código (en este orden)

**4.1 La RPC del QR** — migración nueva: el `INSERT` lleva `monthly_fee` (ya tiene
`v_amount`) y el plan si el QR lo resuelve; y al reusar una inscripción existente,
rellenar esos campos si están en NULL. Es el más chico y el que está sangrando: sin esto,
cada alta por QR sigue dejando una fila vacía.

**4.2 Asignar equipo/plan completa en vez de insertar.** Revisar
[`bff/src/routes/students.ts:884`](../bff/src/routes/students.ts#L884) y el bloque de plan
que sigue. Criterio: **una inscripción activa por atleta**, con equipo y plan en la misma
fila. Sin esto, limpiar los 80 duplicados de hoy solo compra tiempo.

**4.3 El generador por atleta, no por inscripción.** El más invasivo y el que menos urge
si 4.1 y 4.2 quedan bien. Va con el F0 de `open_month`.

### Bloque 5 — producción

El código de esta sesión está en `develop` y `staging`. **A `main` no se lleva nada por
iniciativa propia.** Lo que Dynasty todavía no tiene:

- El fix del monto congelado en el link (un cambio de tarifa tarda hasta 72h en aplicar).
- El gate de `/mi-plan`: sus acudientes siguen pudiendo abrir la facturación del club. El
  bloque 1 mitiga la parte grave (el conteo baja a los hijos propios), pero el tier y los
  precios se siguen viendo hasta que el código llegue a producción.

Recomendación: llevar a `main` después de cerrar el bloque 3 y el 4.1.

---

## 4. Herramientas

Las dos son de solo lectura y sirven para comparar antes/después de cada bloque:

```bash
cd bff && node school-status.mjs            # foto operativa (config, atletas, cobros, riesgos)
cd bff && node wompi-reconcile-school.mjs   # conciliación transacción por transacción vs API de Wompi
```

`wompi-reconcile-school.mjs` reporta lo que Wompi **cobró**, no lo que depositó: la API de
transacciones no expone ni la comisión ni la liquidación. Cuánto llegó de verdad a la
cuenta solo se ve en Liquidaciones del dashboard del comercio — **eso está sin confirmar**
y de ahí depende cómo se lee el ledger del bloque 2.
