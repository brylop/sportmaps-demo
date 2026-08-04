# Plan — `school_athletes.payment_status`: el semáforo debe decir si DEBE, no cuál fue el último cobro

**Fecha:** 2026-08-04 · **Autor:** brylop · **Estado:** propuesto, pendiente de aprobación

## 1. El defecto

`payment_status` sale de este lateral, repetido idéntico en las tres ramas del `UNION ALL`
(menor / adulto / no registrado):

```sql
LEFT JOIN LATERAL ( SELECT py.status, py.due_date
       FROM payments py
      WHERE py.child_id = c.id AND py.school_id = c.school_id
      ORDER BY py.created_at DESC          -- el cobro MÁS NUEVO, y nada más
     LIMIT 1) pay ON true
...
COALESCE(pay.status, CASE WHEN act.has_active THEN 'pending' ELSE NULL END) AS payment_status
```

Es **el estado del último cobro creado**, no "¿debe algo?". Tres consecuencias:

1. **Esconde deuda vieja.** Quien debe agosto y paga septiembre sale "Al día", porque
   la fila de septiembre es más nueva. Es el síntoma que originó la revisión.
2. **No excluye estados terminales.** Un cobro `cancelled` / `rejected` / `failed`
   reciente define el semáforo. Medido el 2026-08-04 en Dynasty: al anular 5 cobros
   duplicados, el contador "OTROS" pasó de 1 a 6 y "AL DÍA" de 73 a 67 — cinco atletas
   que no deben nada quedaron en una categoría inventada, porque `getPaymentState` no
   tiene caso para `cancelled` y cae en `other`.
3. **`payment_due_date` es del cobro equivocado.** `getPaymentState` deriva `overdue` de
   `due_date < now()`. Si surface el cobro más nuevo, un atleta con julio vencido y
   septiembre por vencer sale `pending`, no `overdue`.

No es un problema de datos: con los periodos perfectos, el semáforo seguiría mintiendo.

## 2. Decisión

`payment_status` pasa a significar **"la deuda más antigua sin saldar, si hay"**:

- Se **ignoran** los estados terminales (`cancelled`, `rejected`, `failed`).
- Si hay deuda (`pending`, `awaiting_approval`, `overdue`, `partial`, `glosado`), se
  expone **la de `due_date` más antiguo** — la que importa para cobrar y la que hace que
  `overdue` se dispare cuando corresponde.
- Si no hay deuda, se expone el `paid` / `approved` más reciente → "Al día" pasa a
  significar **no debe nada**.
- Sin ningún cobro pero con inscripción activa, se conserva el fallback actual
  (`'pending'`). Es deliberado: una inscripción activa sin cobro es un problema, no un
  "al día". Es exactamente el estado en el que JUANA TORRES LEON aparecía al día.

### Un solo lateral, no dos

El desempate cabe en el `ORDER BY` del lateral que ya existe:

```sql
LEFT JOIN LATERAL (
    SELECT py.status, py.due_date
      FROM payments py
     WHERE py.child_id = c.id
       AND py.school_id = c.school_id
       AND py.status NOT IN ('cancelled','rejected','failed')
     ORDER BY (py.status IN ('pending','awaiting_approval','overdue','partial','glosado')) DESC,
              CASE WHEN py.status IN ('pending','awaiting_approval','overdue','partial','glosado')
                   THEN py.due_date END ASC NULLS LAST,
              py.created_at DESC
     LIMIT 1) pay ON true
```

Importa que sea **uno** y no dos laterales: la auditoría de lentitud de 2026-07 encontró
que RLS amplifica `school_athletes` unas 3000×, así que un scan extra por atleta se paga
caro. Este `ORDER BY` no agrega scans, solo ordena las mismas filas.

## 3. Radio de impacto

La vista se consume en 12 sitios. **Paso 1 del trabajo: enumerar cuáles leen
`payment_status` / `payment_due_date`** — los demás no se enteran del cambio. Conocidos:

| Consumidor | Uso |
|---|---|
| `SchoolStudentsManagementPage.tsx:306` | badge Estado Pago, filtro y los 5 contadores |
| `frontend/src/lib/api/students.ts` (4 sitios) | shape de estudiantes para la UI de gestión |
| `StudentsPage.tsx:90` | listado |
| `CoachAttendancePage` / `AttendanceSupervisionPage` | etiqueta "Al día" en el roster |

Los que solo leen roster/plan/sede (`classes.ts`, `AddDropInModal`,
`RegisterCashPaymentModal`, `QuickUseRoutineModal`, `TrainingPlansPage`,
`school/performance.ts`) no se tocan.

**Cambio visible esperado** (para que los contadores moviéndose no asusten):

- Los 5 atletas hoy en "OTROS" por cobros anulados → vuelven a **AL DÍA** (no deben nada).
- Atletas con deuda vieja tapada por un pago nuevo → salen de AL DÍA a **PENDIENTE** o
  **VENCIDO**. En Dynasty hay que medir cuántos antes de aplicar (ver §5).
- "OTROS" debería quedar en **0** o cerca: era casi todo estados terminales.

## 4. Mecánica de la migración

- **Ledger:** `npm run migrations:new -- school_athletes_payment_status_oldest_debt`.
- **`CREATE OR REPLACE VIEW`** sirve: no se agregan, quitan ni reordenan columnas — solo
  cambia el cuerpo del lateral. Cambiar la lista de columnas obligaría a `DROP … CASCADE`
  y a recrear lo que dependa de ella.
- **GOTCHA CRÍTICO — `security_invoker`.** Hay que verificar ANTES si la vista lo tiene:

  ```sql
  SELECT c.relname, c.reloptions
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'school_athletes';
  ```

  Si sale `{security_invoker=true}`, el `CREATE OR REPLACE VIEW` **debe** restatearlo. Si
  se omite, la vista pasa a ejecutarse con los privilegios del owner, RLS deja de
  aplicarse y una escuela puede ver atletas de otra. No se asume: se consulta.
- **Rollback:** la definición actual **no existe en el repo** (la vista es deriva no
  versionada). El archivo de migración debe **embeber el `pg_get_viewdef` actual completo
  en un bloque de comentario**, capturado en el momento de escribirla:

  ```sql
  SELECT pg_get_viewdef('public.school_athletes'::regclass, true);
  ```

  Sin eso no hay a dónde volver. La vuelta atrás es una migración nueva con ese cuerpo.
- **`NOTIFY pgrst, 'reload schema'`** al final.
- Efecto lateral positivo: la vista queda **bajo control de versiones**, restando uno a
  los ~336 objetos de deriva.

## 5. Verificación

Antes y después, sobre Dynasty (`2d509571-3238-4c04-ac3f-6dfe20539226`):

```sql
-- Los 5 buckets, tal como los cuenta la pantalla
SELECT payment_status, count(*)
  FROM public.school_athletes
 WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226' AND is_active
 GROUP BY 1 ORDER BY 2 DESC;

-- Cuántos atletas cambian de veredicto: los que HOY salen al día pero tienen deuda
SELECT count(*) AS al_dia_con_deuda
  FROM public.school_athletes sa
 WHERE sa.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226' AND sa.is_active
   AND sa.payment_status = 'paid'
   AND EXISTS (SELECT 1 FROM public.payments p
                WHERE p.child_id = sa.id
                  AND p.status IN ('pending','awaiting_approval','overdue','partial','glosado'));
```

La segunda es la que dimensiona el cambio: es la deuda que hoy está invisible. Correrla
**antes** de aplicar, para poder avisarle a la escuela por qué los números se mueven.

Casos puntuales a comprobar después:

- Los 5 de cobro anulado (Anna Isabella Forero, HELLEN VALENTINA, Linda Saray, Luciana
  Sandoval, Maria Gabriela Medina) → `paid`, no `cancelled`.
- JUANA TORRES LEON → `pending` con `payment_due_date = 2026-08-10`.
- VIOLETA DEL CAMPO GARZON → `paid` (pagada hasta octubre).

## 6. Frontend, en el mismo cambio

`getPaymentState` ([SchoolStudentsManagementPage.tsx:88](../frontend/src/pages/SchoolStudentsManagementPage.tsx#L88))
mapea a `'other'` todo lo que no reconoce, y de ahí salió el bucket "OTROS" con cobros
anulados. Aunque la vista ya no los exponga, hay que cerrar el caso explícitamente:
`cancelled` / `rejected` / `failed` → `'none'`, no `'other'`. Defensa en profundidad; si
mañana otra vía los reintroduce, no vuelven a inventar una categoría.

## 7. Fuera de alcance

- El desfase de periodo en el alta — ya corregido en `dde9c5b`.
- Reparar los 12 atletas con plata de agosto contada en septiembre (reparación de datos).
- Rediseñar cargos vs recaudos (opción C). Este plan hace que el semáforo diga la
  verdad sobre los datos que haya; no cambia el modelo.
