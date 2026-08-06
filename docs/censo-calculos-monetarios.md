# Censo de cálculos monetarios — dónde vive cada fórmula y dónde divergen

Fecha: 2026-08-06 · Autor: brylop (con Claude) · Estado: **C-01 a C-03 verificados contra datos**

## Resultado de la verificación (2026-08-06, escuela `2d509571-…`)

Corrido con [scripts/math-consistency-checks.sql](scripts/math-consistency-checks.sql):

| Hallazgo | Veredicto sobre datos reales |
|---|---|
| C-01 (descuento pronto pago) | **0 hallazgos.** El hueco de autoridad existe; nadie lo ha usado todavía |
| C-02 (inflación de ingresos) | **0 hallazgos.** Ningún cobro `paid` tiene `amount_paid < amount` hoy |
| C-03 (ingreso potencial) | **CONFIRMADO: canónica $66.250.000 vs reports $10.390.000 — brecha $55.860.000 sobre 435 atletas** |
| C-04, C-05 | pendientes: el detalle de C-03b tapó la salida. Correr en `modo = 'resumen'` |

Lectura: **C-03 es el único que hoy está mintiendo**, y miente en grande — el KPI muestra
el 16% del ingreso potencial real. C-01 y C-02 son riesgo latente, no daño consumado:
el código está mal pero los datos todavía no lo reflejan. Eso cambia la prioridad —
C-03 se arregla ya; C-01 se arregla antes de que alguien lo descubra, no con urgencia
de incendio.

## Qué es esto y qué NO es

Un inventario por **magnitud de negocio**, no por archivo. Para cada magnitud se listan todas
las implementaciones que existen hoy (SQL / BFF / frontend) y se marca si coinciden.

Nada de lo que sigue está verificado contra la base todavía: son divergencias **leídas en el
código**. La verificación es el paso siguiente (chequeos SQL sobre datos reales). Cada hallazgo
trae la consulta o el experimento que lo confirma o lo tumba.

El eje es deliberado: los bugs de plata que ya nos costaron dinero no fueron aritmética mal
escrita, fueron **insumos equivocados** y **la misma fórmula viviendo en varios lugares**.

---

## Tabla del censo

| # | Magnitud | Implementaciones | ¿Coinciden? |
|---|---|---|---|
| 1 | Tarifa vigente del atleta | 9+ (1 canónica en `open_month`, 1 en vista `school_athletes`, 7 en BFF) | **NO** — C-03, C-04, C-05 |
| 2 | Descuento pronto pago | 1 sola… y vive en el **navegador** | **N/A** — C-01 |
| 3 | Descuento manual (`discount_pct`) | 5 (1 función en frontend + 4 inline en BFF) | Sí hoy, sin nada que lo sostenga — C-06 |
| 4 | Prorrateo / primer cobro | 2 "espejos" declarados | **NO** — C-06 |
| 5 | Ingresos del mes | 2 (RPC `school_payment_kpis` vs hook del dashboard) | **NO** — C-02 |
| 6 | Ingreso potencial mes | 1, con la cadena de tarifa mutilada | **NO** — C-03 |
| 7 | Saldo (`amount − amount_paid`) | 3 variantes | **NO** — C-07 |
| 8 | Mora / recargo | 1 (`apply_late_fees`) | Única, pero con efectos laterales — C-08, C-09 |
| 9 | Recargo por pago online | 1 (frontend, modelo "es de la escuela") | Sin censar a fondo |
| 10 | Vigencia (`expires_at`) | 2 (checkout v2.1 y extensión al pagar) | **NO** — ya documentado aparte |
| 11 | Créditos de sesión | 3 lecturas en BFF | Sin censar a fondo |
| 12 | Comisión marketplace | RPC `financial_engine` + `platform_fee` | Sin censar |
| 13 | Contable / nómina | `AccountingReportsPage`, `PayrollConfigPage`, RPCs fase 2 | Sin censar |

**La cadena canónica de tarifa** — la que efectivamente genera la plata, en
[supabase/migrations/20260803114540_open_month_distinct_athlete.sql:134-142](supabase/migrations/20260803114540_open_month_distinct_athlete.sql#L134-L142):

```sql
COALESCE(
  NULLIF(e.monthly_fee, 0),
  NULLIF((SELECT op.price FROM offering_plans op WHERE op.id = e.offering_plan_id), 0),
  NULLIF(t.price_monthly, 0),
  NULLIF(c.monthly_fee, 0),
  0
)
```

Todo lo demás en la tabla se mide contra esto.

---

## Hallazgos

### C-01 · CRÍTICO — El descuento por pronto pago lo calcula y lo persiste el navegador

[frontend/src/lib/earlyPaymentDiscount.ts](frontend/src/lib/earlyPaymentDiscount.ts) es la
**única** implementación: `grep` de `calcEarlyPaymentDiscount` y de
`early_payment_discount_applied` sobre `bff/src` y `supabase/migrations` no devuelve nada.

[PaymentCheckoutModal.tsx](frontend/src/components/payment/PaymentCheckoutModal.tsx) escribe
`early_payment_discount_applied` directo a `payments` en **seis** puntos (líneas 467, 493, 627,
649, 713, 734), con el valor que el propio navegador calculó. Y
[PaymentsAutomationPage.tsx:687](frontend/src/pages/PaymentsAutomationPage.tsx#L687) escribe
`amount_paid = amount − early_payment_discount_applied` también desde el cliente.

Dos problemas distintos:

1. **Correctitud** — la elegibilidad depende de `todayColombia()` del *dispositivo*. Un
   teléfono con la fecha corrida cambia el monto a pagar.
2. **Autoridad** — el descuento no lo valida nadie del lado servidor. Un `UPDATE` con
   `early_payment_discount_applied = amount` deja el cobro en cero.

`hasEarlierUnpaidPayment()` es explícitamente *fail-open* (línea 95): ante error de red devuelve
`false`, o sea **concede** el descuento.

> Verificar: `SELECT count(*), sum(early_payment_discount_applied) FROM payments WHERE early_payment_discount_applied > 0;`
> y contra la config de cada escuela, cuántos exceden `amount * percentage/100`.

---

### C-02 · CRÍTICO — "Ingresos" da dos números distintos según la pantalla

| Fuente | Fórmula para `paid` | Fórmula para `partial` |
|---|---|---|
| RPC `school_payment_kpis` ([mig 20260730000005:55-58](supabase/migrations/20260730000005_school_payment_kpis.sql#L55-L58)) | `LEAST(amount, COALESCE(amount_paid, amount))` | `amount_paid` |
| [useDashboardStatsReal.ts:130](frontend/src/hooks/useDashboardStatsReal.ts#L130) | `amount` **pelado** | `amount_paid` |

Difieren exactamente en los cobros donde `amount_paid < amount`. Y ese caso **existe y es
frecuente**: la aprobación de comprobante escribe `amount_paid = v_amount − v_discount`
([mig 20260721000001:76](supabase/migrations/20260721000001_receipt_auto_approve.sql#L76)).

Resultado: el dashboard **infla los ingresos por la suma de todos los descuentos por pronto
pago**, mientras Gestión de Pagos muestra el número correcto. Dos pantallas, dos verdades.

> Verificar: `SELECT sum(amount) - sum(LEAST(amount, COALESCE(amount_paid, amount))) FROM payments WHERE status='paid';`
> Esa diferencia es, peso por peso, la inflación del dashboard.

---

### C-03 · CONFIRMADO — "Ingreso Potencial Mes" usa una cadena de tarifa mutilada

**Medido 2026-08-06: canónica $66.250.000 vs reports $10.390.000. Brecha $55.860.000
sobre 435 atletas activos — el KPI muestra el 16% de lo que debería.**

Tres formas distintas de fallar, todas presentes en los datos:

1. **`reports $0`** — el caso masivo. El precio vive en el plan o en la inscripción y
   el KPI ni lo mira.
2. **`reports` con un valor VIEJO** — p. ej. canónica $90.000 vs reports $150.000, o
   canónica $150.000 vs reports $180.000. `children.monthly_fee` quedó congelado con una
   tarifa que ya no es la que se cobra. Estos son peores que el $0: parecen correctos.
3. **`INVISIBLE para el KPI`** — atletas adultos y no registrados, que ni existen para un
   KPI que arranca desde `children`.


[bff/src/routes/reports.ts:270](bff/src/routes/reports.ts#L270):

```ts
fee: Number(s.monthly_fee) || teamFeeMap.get(s.team_id) || 0,
```

Es `children.monthly_fee || teams.price_monthly` — se salta **los dos primeros eslabones** de la
canónica: `enrollments.monthly_fee` y `offering_plans.price`. Todo atleta cuyo precio viva en su
inscripción o en su plan (el caso normal desde que existen offerings) cotiza mal, casi siempre en
$0. Además parte de `children`, así que adultos y no registrados no existen para este KPI.

Mismo problema, más chico, en [reports.ts:420](bff/src/routes/reports.ts#L420):
`Number(p.price_monthly) || 0`.

---

### C-04 · ALTO — El 0 significa cosas distintas en el cobro y en la pantalla

- `open_month` usa `NULLIF(campo, 0)`: un 0 **cae al siguiente eslabón**.
- La vista `school_athletes` usa `COALESCE` pelado
  ([mig 20260730195021:128-131](supabase/migrations/20260730195021_school_athletes_lateral_rewrite.sql#L128-L131)):
  un 0 **se respeta como precio**.

Con `enrollments.monthly_fee = 0` y un plan de $50.000: **el roster muestra $0 y el cobro sale
por $50.000.** La escuela ve un atleta gratis y la familia recibe la factura.

Corolario de producto: hoy **no existe forma de expresar "exonerado / beca 100%"**. Poner 0 no
lo logra, porque el generador lo lee como "sin definir". Es una decisión pendiente, no solo un bug.

---

### C-05 · ALTO — Fallback inventado de $150.000 en la carga masiva

[bff/src/routes/students.ts:412](bff/src/routes/students.ts#L412) y
[:482](bff/src/routes/students.ts#L482):

```ts
amount: student.monthly_fee || 150000,
```

Un CSV sin columna de cuota factura **$150.000 por atleta**, un número que no sale de ninguna
configuración de la escuela. Y por ser `||` y no `??`, una cuota legítima de `0` también termina
en 150.000.

> Verificar: `SELECT school_id, count(*) FROM payments WHERE amount = 150000 GROUP BY 1 ORDER BY 2 DESC;`

---

### C-06 · MEDIO-ALTO — Los "espejos" de prorrateo ya divergieron

[bff/src/utils/prorationUtils.ts](bff/src/utils/prorationUtils.ts) y
[frontend/src/lib/prorationUtils.ts](frontend/src/lib/prorationUtils.ts) se declaran espejos
("*si los dos difieren, la pantalla miente sobre lo que se va a cobrar*"). `diff` dice que
difieren:

| | BFF | Frontend |
|---|---|---|
| Firma | 4 parámetros | 5 — acepta `lastDueDate` |
| `rolling_30` | `start_date + 30d` siempre | `(lastDueDate ?? start_date) + 30d` |
| `applyDiscount` | no existe | sí |
| `calcProration` (deprecado) | no existe | sí, y usa `toISOString()` → UTC |

`prorated` y `fixed_calendar` sí coinciden hoy. `rolling_30` no: cualquier caller que pase
`lastDueDate` ve en pantalla una fecha distinta de la que el BFF va a escribir.

Y `applyDiscount(amount, pct) = Math.round(amount * (1 - pct/100))` está **reimplementada inline
cuatro veces** en [students-create-one.route.ts](bff/src/routes/students-create-one.route.ts)
(líneas 438, 612, 682, 848). Cinco copias de la misma fórmula sin un solo test.

`calcProration` usa `toISOString().split('T')[0]` en un archivo cuyo propio comentario advierte
del corrimiento a UTC. Hoy no tiene llamadores — es una trampa armada, no un incendio.

---

### C-12 · ALTO — Cambiar el precio de un plan no le cambia el cobro a nadie

Detectado a partir de la pregunta correcta: *"si la escuela cambia el plan, ¿quién actualiza qué?"*

El precio **se congela al inscribir**. [enrollments.ts:303](bff/src/routes/enrollments.ts#L303) copia
`offering_plans.price` a `enrollments.monthly_fee`, y la cadena canónica lee `NULLIF(e.monthly_fee, 0)`
**antes** que el plan. Desde ese instante el plan deja de mandar sobre ese atleta.

Y el `PATCH` del plan ([offerings.ts:385-437](bff/src/routes/offerings.ts#L385-L437)) actualiza
`offering_plans`, regenera sesiones si cambió el horario, y **no toca `enrollments`**. No hay trigger
ni RPC de recálculo.

Consecuencia: la escuela sube la mensualidad, el catálogo muestra el precio nuevo, y `open_month`
sigue generando el viejo indefinidamente. Los que entran después — incluido el alta por QR, que sí
toma el precio vigente ([mig 20260803110621:222](supabase/migrations/20260803110621_qr_signup_enrollment_completa.sql#L222))
— pagan distinto. Dos atletas del mismo equipo con tarifas diferentes según cuándo entraron, sin nada
en la interfaz que lo muestre.

El padre no es el perjudicado: paga `payments.amount`, congelado al generarse el cobro. La
perjudicada es la escuela, que cree que subió precios y no subió nada.

**El matiz que decide el arreglo:** congelar el precio pactado es una decisión de negocio legítima.
El problema no es que congele — es que **nadie eligió que congelara**, emergió del copiado más el
orden de la cadena, y hoy la escuela no puede ni enterarse ni revertirlo. Hasta que no se decida
"congelar" vs "seguir al catálogo", cualquier fix es adivinar.

Medido por C-12a/b/c en [scripts/math-consistency-checks.sql](scripts/math-consistency-checks.sql).

---

### C-07 · MEDIO — Tres fórmulas de saldo, una puede dar negativo

| Variante | Dónde |
|---|---|
| `GREATEST(amount − COALESCE(amount_paid,0), 0)` | SQL: late fee, recordatorios, KPIs, WA2 |
| `Math.max(amount − (amount_paid \|\| 0), 0)` | [PaymentsAutomationPage.tsx:1167](frontend/src/pages/PaymentsAutomationPage.tsx#L1167) |
| `Number(amount) − Number(amount_paid)` **sin piso** | [AccountingSuppliersPage.tsx](frontend/src/pages/AccountingSuppliersPage.tsx) líneas 103, 198, 427 |

La tercera muestra saldo negativo ante un sobrepago, y ese negativo se suma a los totales de la
página. Es cuentas por pagar a proveedores, no cartera de familias — impacto acotado pero real.

---

### C-08 · MEDIO — La mora muta `payments.amount`, y eso contamina todo lo demás

[apply_late_fees](supabase/migrations/20260706130000_late_fee_engine_fix_status_type.sql#L55-L57):

```sql
late_fee_amount = p.late_fee_amount + c.fee,
amount          = p.amount + c.fee,
```

Consecuencias en cadena:

- `payments.amount` **deja de ser la tarifa**. Cualquier chequeo "monto cobrado == tarifa
  vigente" dará falso positivo en todo cobro con mora. Hay que restar `late_fee_amount`.
- El descuento por pronto pago se calcula sobre `finalAmount`, que ya incluye la mora → se
  descuenta sobre el recargo.
- El histórico de la tarifa original se pierde salvo por `late_fee_amount`.

---

### C-09 · MEDIO — Estados que la mora nunca toca (¿regla o descuido?)

`apply_late_fees` filtra `status IN ('pending','partial')`. Entonces:

- `awaiting_approval` vencido → **nunca** recibe mora. Subir un comprobante congela el reloj.
- `glosado` vencido → **nunca** recibe mora.
- `overdue` → nunca recibe una **segunda** mora (`late_fee_applied_at` la aplica una sola vez en
  la vida del cobro).

Puede ser exactamente lo que la escuela quiere. Pero no está escrito en ningún lado como regla,
así que hoy es indistinguible de un olvido. Hay que confirmarlo con el cliente y dejarlo dicho.

---

### C-10 · MEDIO — Filtro de sede inconsistente dentro del mismo hook

En [useDashboardStatsReal.ts](frontend/src/hooks/useDashboardStatsReal.ts), ingresos incluye los
cobros sin sede (línea 125, con un comentario que explica que con `.eq()` se caían 44 de 89
pagos)… y doce líneas abajo el contador de pendientes usa `.eq()` pelado (línea 142). El mismo
archivo aprendió la lección en un KPI y no en el de al lado.

---

## Lo que este censo NO cubrió

Dicho explícitamente para que no se lea como "ya revisamos todo":

- Comisiones del marketplace (`financial_engine`, `platform_fee`, `commission_rate`)
- Módulo contable y nómina
- Créditos de sesión (`sessions_used` / `max_sessions`) — 3 lecturas en BFF sin comparar
- Recargo por pago online (`online_fee_pct`) end-to-end contra lo que liquida la pasarela
- Eventos/torneos (`coach_discount_usd`, `companion_discount_usd`) — además están en **USD**
- Facturación electrónica (montos que se le mandan al PAC)
- Vigencia `expires_at` — ya tiene análisis propio en `docs/plan-vigencia-por-periodo-pagado.md`

## Siguiente paso propuesto

Convertir C-01 a C-05 en chequeos SQL read-only dentro del patrón de
[scripts/consistency-checks.sql](scripts/consistency-checks.sql) — recalcular cada magnitud desde
los datos fuente y diferenciarla contra lo guardado. Eso convierte "el código difiere" en "difiere
en N atletas y $X", que es lo que decide qué se arregla primero.
