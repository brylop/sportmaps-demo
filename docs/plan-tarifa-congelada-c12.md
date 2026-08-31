# Plan — C-12: la tarifa congelada deja de ser invisible

Fecha: 2026-08-06 · Estado: **plan, sin código**. La fase 2 lleva migración, y por regla del
repo el plan se aprueba antes de escribirla.

Contexto y evidencia: [docs/censo-calculos-monetarios.md](censo-calculos-monetarios.md) § C-12.
Medición: chequeos C-12a/b/c de [scripts/math-consistency-checks.sql](../scripts/math-consistency-checks.sql).

## El problema en una línea

Al inscribir, el precio del plan **se copia** a `enrollments.monthly_fee`, la cadena canónica lee
ese campo **antes** que el plan, y el `PATCH` del plan **no cascadea**. La escuela sube la
mensualidad y no le sube a nadie que ya esté adentro. Sin aviso y sin forma de enterarse.

## Decisión (2026-08-06)

**Opción A — el precio pactado manda.** El que entró con una tarifa la conserva hasta que un
admin de la escuela decida moverla, con una acción explícita.

Se descartó la opción B (que el catálogo mande siempre) porque obliga a una migración que
reinterpreta datos ambiguos: hoy una `monthly_fee` igual al precio del plan puede ser una copia
automática **o** un precio negociado que casualmente coincide. Distinguirlas a posteriori es
adivinar, y adivinar acá significa cambiarle la mensualidad a familias reales.

Corolario que resuelve la observación del cliente ("no aplica igual para todas las escuelas"):
en el diseño A **cada escuela decide y ejecuta lo suyo**. No hay un comportamiento global que
imponer, ni una migración que le mueva el precio a nadie.

## Lo que este plan NO hace

- No cambia el comportamiento de cobro actual. Hoy congela; después de F1 sigue congelando,
  pero visible.
- No toca cobros ya generados. Un cambio de tarifa aplica al periodo siguiente, nunca retroactivo.
- No corre ninguna migración de datos sobre `enrollments.monthly_fee`.

---

## Fases

### F1 — Visibilidad (sin migración, sin riesgo)

> **Parcial, 2026-08-29:** el indicador por inscripción y el contador quedaron en
> [PaymentsAutomationPage.tsx](../frontend/src/pages/PaymentsAutomationPage.tsx),
> pestaña «Equipos y Planes» — sin migración ni endpoint nuevo, reusando
> `e.plan?.price` que esa pantalla ya traía. **No cubre todavía** la ficha
> individual del atleta ni ningún roster fuera de esa pestaña, ni el BFF (el plan
> original pedía que la ficha/roster lo trajeran del backend, esto quedó resuelto
> client-side). Pendiente correr el **gate F1** (el número de la UI vs `C-12a`
> corrido sobre la misma escuela) antes de darlo por cerrado del todo.

Que la escuela pueda **ver** que un atleta está en una tarifa distinta a la de su plan.

- BFF: al devolver la ficha y el roster, acompañar la cuota vigente con el precio actual del plan
  o del equipo, y una marca `fee_source` (`inscripcion` / `plan` / `equipo` / `children`).
- Frontend: en la ficha del atleta y en el listado, cuando difieran, mostrar
  `Cuota: $150.000 · el plan hoy vale $180.000` con un indicador discreto.
- Un contador por plan en la pantalla de planes: *"12 de 40 atletas están en una tarifa anterior"*.

Sale de lo que ya calcula C-12. Es solo exponerlo.

**Gate F1:** el número que muestra la UI tiene que coincidir con C-12a corrido sobre la misma
escuela. Si no coinciden, hay una tercera fórmula suelta y hay que encontrarla antes de seguir.

### F2 — Acción explícita (lleva migración: RPC + auditoría)

Un botón *"aplicar el precio actual del plan"*, por plan, con confirmación que diga a cuántos
atletas afecta y cuánto cambia la facturación mensual.

- RPC `SECURITY DEFINER` con `SET search_path = pg_catalog, public, pg_temp` y `GRANT EXECUTE`
  explícito a `authenticated`; autorización adentro vía `is_school_admin(p_school_id)`.
- `SELECT … FOR UPDATE` sobre las inscripciones afectadas.
- Registro en la bitácora de actividad: quién, cuándo, qué plan, cuántas inscripciones, monto
  anterior y nuevo por cada una. Sin esto no hay forma de responder "¿por qué me subió?".
- Alcance seleccionable: todo el plan, o una lista de atletas.
- **No** regenera cobros existentes. Aplica desde la siguiente apertura de mes.

**Prerrequisito duro de F2 — marcar las tarifas negociadas.** Hoy no hay forma de distinguir
"copia del precio del plan" de "beca / descuento pactado". Sin esa marca, *aplicar a todos* le
pisa la beca al becado. Antes de F2 hace falta una columna del tipo `fee_is_negotiated boolean`
(o un `fee_reason text`) y una pasada de la escuela marcando las excepciones que ya tiene. Es
trabajo de datos del cliente, no del código, y por eso F2 no puede arrancar sin F1 desplegada:
F1 es la pantalla donde la escuela ve cuáles son.

### F3 — Prevención (después de F1/F2, con datos en la mano)

Decidir si al inscribir se sigue copiando el precio del plan a la inscripción, o se deja NULL
para que la cadena caiga sola al plan. Dejar NULL haría que el catálogo mande por defecto y que
`monthly_fee` signifique solo "excepción" — que es el modelo limpio. Pero es un cambio de
semántica y conviene tomarlo cuando F1 haya mostrado cuántas excepciones reales existen.

---

## Preguntas para validar con las escuelas

Van antes de F2. Cada una cambia el diseño:

1. Cuando suben el precio de un plan, ¿esperan que aplique a los que ya están, o que respete lo
   pactado? (La hipótesis es que varía por escuela — de ahí que la acción sea manual.)
2. Si aplica, ¿desde el mes siguiente, o también sobre el cobro del mes en curso si ya se generó?
3. ¿Cuántos atletas tienen hoy una tarifa negociada a propósito (beca, hermano, convenio)? Ese
   número decide si `fee_is_negotiated` se llena a mano o necesita una herramienta de carga.
4. ¿Quieren que la familia reciba aviso cuando su mensualidad cambia? (Si sí, engancha con el
   despachador de notificaciones y suma alcance a F2.)

## Relación con lo ya arreglado

C-03 (el "Ingreso Potencial Mes" que mostraba $10.39M en vez de $66.25M) se arregló aparte y no
depende de este plan: era un lector que se saltaba la cadena canónica. Con C-03 corregido, el KPI
ya refleja lo que **realmente se cobra** — incluidas las tarifas congeladas. O sea que la brecha
entre lo que se cobra y lo que dice el catálogo ahora se puede medir, que es justo lo que F1 expone.
