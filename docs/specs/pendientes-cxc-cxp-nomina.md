# Spec — Módulo Pendientes: Cuentas por Cobrar, por Pagar y Nómina

**Producto:** SportMaps · **Versión:** v0.1 · **Fecha:** 2026-08-01
**Estado:** 🔵 borrador — **decisiones de producto sin resolver** (§8). No se escribe código de migraciones hasta tener plan aprobado.
**Roadmap:** [`ERP-1..5`](../ROADMAP.md#erp--módulo-pendientes-cxc--cxp--nómina)

**Origen:** especificación funcional y técnica externa *«Módulo Pendientes · CxC · CxP · Nómina — ERP
Contable v1.0, julio 2026»*, escrita para un ERP contable genérico. Este documento la **aterriza al
modelo real de SportMaps**: qué encaja, qué ya existe con otro nombre, qué exige una decisión
arquitectónica grande, y qué no conviene adoptar.

---

## 1. La idea, en una frase

Hoy el dinero de una escuela vive en tres modelos que no se hablan: `payments` (lo que cobra a las
familias), `expenses` (lo que gasta) y `payroll_runs` (lo que le paga a su gente). El módulo
Pendientes los unifica bajo un solo concepto — **la obligación** — y saca el pago a una tabla aparte,
de modo que un pago puede aplicarse a varias obligaciones y una obligación puede recibir varios pagos.

```
Pendientes >> [ Cuentas por Cobrar | Cuentas por Pagar | Nómina ] >> Detalle >> Cruce
```

Pendientes **no crea** obligaciones: las crea Contabilidad (o la liquidación de nómina) y aparecen
solas. Pendientes es donde se consultan y se cruzan.

**Terminología, fija para todo el sistema:** *obligación* es el registro genérico; *CxC*, *CxP* y
*Nómina* son sus tipos; *movimiento* es un ingreso o egreso; *cruce* es la aplicación de un
movimiento a una obligación.

---

## 2. Qué existe hoy, y con qué nombre

Antes de adoptar nada. Verificado contra el esquema el 2026-08-01.

| Concepto del ERP | En SportMaps hoy | Veredicto |
|---|---|---|
| **obligación CXC** | `payments` — mensualidades, inscripciones, cobros de QR y checkout. Tiene su propia máquina de estados (`pending`, `awaiting_approval`, `partial`, `paid`, `overdue`, `glosado`), tres índices únicos de dedup por periodo, motor de mora, conciliación bancaria y ciclo de glosa | **Ya resuelto, y mejor que el spec.** No migrar (§5) |
| **obligación CXP** | `expenses` — con `kind ∈ (manual, payroll, supplier_bill)` y `status ∈ (draft, pending_approval, approved, paid, void)` | Encaja, **pero no admite pago parcial**: un gasto se paga entero o no se paga |
| **obligación NOMINA** | `payroll_runs` + `payroll_items` + `payroll_employees` + `payroll_config` | El spec marca «[SUPUESTO] validar si existe motor de liquidación» → **sí existe.** Lo que falta es la obligación de pago |
| **movimiento** | `cash_ledger` — es una **VISTA**, unión de `payments` pagados (`direction='income'`) y `expenses` pagados (`direction='expense'`) | **Derivada y read-only.** Solo ve lo que ya está `paid`, así que no puede representar un abono |
| **cruce (N:M)** | **No existe.** El pago parcial de CxC vive dentro de la obligación (`payments.total_paid`, que se va incrementando) | **Es la pieza nueva de verdad.** Lo más cercano es `reconcile_statement` de la conciliación bancaria |
| **tercero** unificado | **No existe.** Hay `profiles`, `children`, `unregistered_athletes`, `suppliers`, `payroll_employees` | Decisión abierta (§8 D-T) |
| **comprobante** / partida doble | **No existe.** Ni asientos, ni líneas débito/crédito, ni plan de cuentas (PUC) | **La decisión grande** (§4) |
| **Finanzas / Proveedores** como módulos | Rutas `/finances`, `/accounting/suppliers`, `/accounting/payroll`, `/accounting/reports`, `/accounting/budget` | El §11 del spec los hace desaparecer de la UI — y eso **resuelve un defecto real del menú** (§6) |

**Nota de deuda:** `expenses` usa `CREATE TYPE` para sus enums, contra la convención vigente del repo
(`text + CHECK`). Las tablas nuevas de este módulo usan `text + CHECK`; los enums viejos no se migran.

---

## 3. Lo que el módulo arregla de verdad

No es una reorganización cosmética. Estas tres cosas hoy no se pueden hacer:

1. **Abonar a un gasto.** `expenses` no tiene estado parcial. Un proveedor al que se le paga en dos
   cuotas no tiene representación: o se registra como pagado antes de pagarlo, o se parte en dos
   gastos que ya no cuadran contra la factura.
2. **Un egreso que paga varias facturas.** El caso más común de tesorería —una transferencia que
   cancela cinco facturas del mismo proveedor— hoy exige cinco registros separados y ninguna forma de
   saber que fueron un solo giro.
3. **Pagar la nómina del período completo con un solo egreso.** La liquidación existe, pero el pago
   no tiene dónde colgarse.

Y una cuarta que sí es de orden: **los reversos.** Hoy corregir un gasto pagado es editarlo. Con
obligación + cruce, corregir es anular el cruce y volver a cruzar, dejando rastro.

---

## 4. Partida doble — DECIDIDO: libro mayor completo desde el inicio

**D-PD resuelta el 2026-08-01: opción B.** El módulo lleva libro contable de partida doble desde la
primera fase. Se registra aquí el alcance real de la decisión, porque cambia el módulo de raíz.

El spec externo asume ese libro: todo nace de un comprobante con líneas débito/crédito, «nada en
Pendientes existe sin asiento», y su CA-14 exige que ningún comprobante descuadrado pueda guardarse.
**SportMaps no tenía nada de eso** — ni comprobantes, ni plan de cuentas, ni la noción de asiento. Se
construye (§5).

Lo que la decisión implica, sin adornos:

- **`ERP-2` deja de ser el núcleo de CxP y pasa a ser núcleo de CxP + libro mayor.** De ~3 semanas a
  ~6–7. Ya no hay una fase `ERP-6` opcional: el mayor entra al principio.
- **Cada flujo de dinero necesita una contrapartida definida antes de poder registrarse.** Hoy un
  gasto se guarda con una categoría; con partida doble no se puede guardar sin saber contra qué
  cuenta va. Eso obliga a un **mapeo de cuentas por escuela** (§5.4) que hay que poblar antes de que
  el módulo sirva.
- **Aparece la noción de período contable cerrado.** Un asiento no puede caer en un mes ya cerrado, lo
  que engancha el mayor con el ciclo de mes (§6).
- **La inmutabilidad deja de ser opcional.** Un asiento contabilizado no se edita ni se borra nunca:
  toda corrección es un asiento nuevo de reverso con referencia al original y motivo obligatorio.

Dos cosas que **no** cambian por elegir B, y conviene no confundir:

> **La facturación electrónica sigue sin exigir partida doble.** `DIN-8` (multi-PAC DIAN) emite
> facturas vía el proveedor autorizado; el PAC no pide el mayor. El libro mayor se construye porque se
> decidió, no porque la DIAN lo pida — y eso importa para no dejar que `DIN-8` bloquee ni sea bloqueado
> por el mayor.

> **La historia no se contabiliza hacia atrás.** El mayor arranca en una fecha de corte con un asiento
> de **saldos de apertura**; no se posteán años de `payments` y `expenses` retroactivamente. Ver
> D-CORTE en §8. Postear la historia completa es la forma habitual de que un proyecto de libro mayor
> nunca salga a producción.

### 4.1 La tensión que esto abre con el ciclo de mes, y cómo se resuelve

El [spec del ciclo de mes](month-close-module.md) decidió en su **D7**: «¿Asientos contables? Solo
lectura en v1 — **Contable aún se define**; el snapshot es autosuficiente para asientos retroactivos».

Esa decisión estaba explícitamente **condicionada a que Contable no estuviera definido**. Ya lo está,
así que D7 no se contradice: se resuelve. Consecuencias sobre el cierre:

1. El cierre **ya no genera asientos retroactivos**: el mayor está poblado en tiempo real por la capa
   de posteo (§5.3).
2. El cierre gana una responsabilidad nueva: **bloquear el período contable** para que nada pueda
   postear dentro de un mes cerrado.
3. El snapshot cambia de rol: deja de ser la fuente de verdad del período y pasa a ser un **reporte
   congelado sobre el mayor**. Sigue siendo útil (respuesta rápida, histórico inmutable), pero ya no
   es lo único que sostiene la foto.

Esto hay que reflejarlo en el spec del ciclo de mes; queda anotado en su §12.

### 4.2 Lo que se descartó, para no volver a discutirlo

| Opción descartada | Por qué se consideró |
|---|---|
| **A — sin partida doble** | Cubría el 100 % del dolor actual (qué debo, qué me deben, qué pagué) sin meter un contador dentro del producto. Descartada: no permite entregar libros oficiales |
| **C — híbrida** (modelo de A + generador retroactivo de asientos) | Dejaba la puerta abierta sin pagar el costo. Descartada: un generador retroactivo depende de que los datos de origen tengan la contrapartida completa, y si eso se garantiza desde el principio, el mayor sale casi gratis — mejor tenerlo real |

---

## 5. Lo que **no** conviene adoptar: CxC

El spec propone migrar «Finanzas» a obligaciones CXC. En SportMaps, CxC son **las mensualidades de
las familias**, y ese flujo:

- Tiene una máquina de estados propia, ya en producción y con dinero real.
- Tiene tres índices únicos de dedup por periodo, motor de mora, conciliación bancaria y ciclo de glosa.
- Ya soporta pago parcial vía `payments.total_paid`.
- Acaba de ser estabilizado en [`DIN-1`](../plan-f0-generacion-de-mes-y-cobros-duplicados.md), que
  todavía no está cerrado.

**Meter CxC en el modelo obligación/cruce sería rehacer el flujo con más dinero del producto para
ganar consistencia conceptual.** Mal negocio, y peor timing.

**Alternativa: `payments` es la obligación CxC.** Pendientes lee de `payments` en su pestaña CxC —
misma pantalla, mismos filtros, mismos totales, sin migrar datos. La separación
obligación/movimiento en CxC se evalúa **después** de que el ciclo de mes esté cerrado, y solo si el
cruce N:M hace falta ahí (hoy no: una mensualidad la paga una familia, no cinco terceros).

---

## 6. Lo que sí resuelve, y no estaba en el plan: el menú

El §11 del spec externo dice que «Finanzas» y «Proveedores» desaparecen de la UI. Eso **arregla un
defecto que la auditoría de navegación ya había encontrado por su cuenta**: hoy el menú de escuela
tiene `Finanzas → Finanzas y Contabilidad → Finanzas`, el mismo nombre en tres niveles, más cuatro
cosas distintas llamadas «reporte».

La reorganización propuesta en [`UX-4`](../ROADMAP.md#ux--interfaz-navegación-y-densidad) tenía el
grupo **Dinero** con `Cobros · Contabilidad · Nómina`. Con este módulo pasa a ser:

```
Dinero
  ├── Pendientes        (pestañas: Por cobrar · Por pagar · Nómina)
  ├── Movimientos       (ingresos y egresos — el actual libro de caja)
  └── Contabilidad      (pestañas: categorías · presupuesto · estado de resultados · informes)
```

Tres filas en vez de las siete actuales del submenú, y ningún nombre repetido. **Los dos trabajos se
hacen juntos o se pisan:** si `UX-4` reorganiza el menú con los nombres viejos, hay que volver a
tocarlo cuando llegue este módulo.

Del §12 del spec (UX e iconografía) se adopta tal cual, porque no cuesta nada y ya es deuda nuestra:

- **Ícono Ojo** = única acción para «ver la contabilización completa». **Lupa** = solo búsqueda,
  nunca detalle.
- **Editar** se **oculta** cuando el estado o el permiso no lo permiten, no se deshabilita.
- Orden cronológico estable en los listados de movimientos, que se conserva al filtrar y paginar.

Esto entra en `ERP-1` (quick wins) y encaja con las primitivas de [`UX-1`](../ROADMAP.md#ux--interfaz-navegación-y-densidad).

---

## 7. Modelo propuesto (con libro mayor)

Nombres en inglés y `snake_case`, como el resto del esquema. Estados con `text + CHECK`.

### 7.0 El libro mayor

```sql
-- Plan de cuentas. Semilla global + subconjunto por escuela (ver D-PUC).
CREATE TABLE public.chart_of_accounts (
  code        text PRIMARY KEY,               -- '1305', '2205', '5105'…
  name        text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('asset','liability','equity','income','expense')),
  parent_code text REFERENCES public.chart_of_accounts(code),
  is_postable boolean NOT NULL DEFAULT true   -- las cuentas de agrupación no reciben asientos
);

-- El asiento. Toda obligación, movimiento, cruce y reverso tiene el suyo.
CREATE TABLE public.journal_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id),
  entry_date    date NOT NULL,
  period_year   smallint NOT NULL,
  period_month  smallint NOT NULL,
  source_kind   text NOT NULL CHECK (source_kind IN ('obligation','movement','settlement',
                                                     'payment','opening_balance','reversal','manual')),
  source_id     uuid,
  description   text NOT NULL,
  reversal_of   uuid REFERENCES public.journal_entries(id),
  reversal_reason text,                       -- obligatorio si reversal_of no es NULL, mín. 10 chars
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.journal_lines (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id   uuid NOT NULL REFERENCES public.journal_entries(id),
  account_code text NOT NULL REFERENCES public.chart_of_accounts(code),
  debit      numeric(18,2) NOT NULL DEFAULT 0 CHECK (debit  >= 0),
  credit     numeric(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  party_type text, party_id uuid,
  CONSTRAINT one_side_only CHECK ((debit = 0) <> (credit = 0))
);

-- Períodos contables. Un asiento no puede caer en un mes cerrado.
CREATE TABLE public.accounting_periods (
  school_id    uuid NOT NULL REFERENCES public.schools(id),
  period_year  smallint NOT NULL,
  period_month smallint NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_by uuid, closed_at timestamptz,
  PRIMARY KEY (school_id, period_year, period_month)
);

-- Mapeo de cuentas por escuela. SIN ESTO NO SE PUEDE POSTEAR NADA.
CREATE TABLE public.school_account_mappings (
  school_id    uuid NOT NULL REFERENCES public.schools(id),
  flow_key     text NOT NULL,     -- 'income.tuition', 'asset.bank', 'liability.payable', 'expense.payroll'…
  account_code text NOT NULL REFERENCES public.chart_of_accounts(code),
  PRIMARY KEY (school_id, flow_key)
);
```

**El cuadre débito = crédito no se puede expresar con un `CHECK`**: es una invariante entre filas, y un
`CHECK` solo ve la fila. Se implementa con un **`CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED`**
que verifica al `COMMIT` que cada asiento cuadra, más la regla de que las escrituras solo entran por
RPC. El trigger es el backstop; la RPC es la puerta.

**Inmutabilidad:** `journal_entries` y `journal_lines` no otorgan `UPDATE` ni `DELETE` a ningún rol, y
un trigger levanta excepción si se intentan. Hay precedente en el repo: `audit_log_clinical` ya es
inmutable por diseño. Corregir = asiento de reverso con `reversal_of` y motivo obligatorio.

**Capa de posteo:** una RPC `post_*` por tipo de evento (obligación creada, cruce aplicado, pago
recibido, gasto aprobado, nómina cerrada), cada una el **único** escritor de su asiento. Es lo que
permite que `payments` siga sin migrarse y el mayor quede completo (§5).

### 7.1 Obligación, movimiento y cruce

```sql
-- La obligación. CxC no se migra: para tipo 'receivable' esta tabla no se usa en v1 (§5).
CREATE TABLE public.obligations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         uuid NOT NULL REFERENCES public.schools(id),
  branch_id         uuid REFERENCES public.school_branches(id),
  kind              text NOT NULL CHECK (kind IN ('payable','payroll')),  -- 'receivable' = payments
  -- Tercero polimórfico: CHECK sobre el tipo, sin FK sobre el id (Postgres no
  -- admite FK polimórfica; misma convención que performance_entries / athlete_reports).
  party_type        text NOT NULL CHECK (party_type IN ('supplier','employee','profile')),
  party_id          uuid NOT NULL,
  source_kind       text NOT NULL CHECK (source_kind IN ('expense','payroll_run','manual')),
  source_id         uuid,                    -- expenses.id | payroll_runs.id | NULL
  concept           text NOT NULL,
  account_code      text NOT NULL REFERENCES public.chart_of_accounts(code),  -- cuenta real (§7.0)
  issued_on         date NOT NULL,
  due_on            date NOT NULL,           -- obligatorio en payable y payroll
  total_amount      numeric(18,2) NOT NULL CHECK (total_amount > 0),
  settled_amount    numeric(18,2) NOT NULL DEFAULT 0 CHECK (settled_amount >= 0),
  status            text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','partial','settled','void')),
  voided_reason     text,                    -- obligatorio al anular, mín. 10 caracteres
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settled_within_total CHECK (settled_amount <= total_amount)
);

-- El movimiento: la plata que entra o sale. Reemplaza a la vista cash_ledger,
-- que solo veía lo ya pagado y no podía representar un abono.
CREATE TABLE public.cash_movements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      uuid NOT NULL REFERENCES public.schools(id),
  direction      text NOT NULL CHECK (direction IN ('in','out')),
  method         text NOT NULL CHECK (method IN ('bank','cash','petty_cash','transfer','gateway')),
  party_type     text, party_id uuid,
  moved_on       date NOT NULL,
  amount         numeric(18,2) NOT NULL CHECK (amount > 0),
  applied_amount numeric(18,2) NOT NULL DEFAULT 0,   -- suma de cruces vigentes
  concept        text,
  payment_id     uuid REFERENCES public.payments(id),  -- si vino de la pasarela
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','void')),
  idempotency_key text,                     -- ver CONC-1
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);

-- El cruce. La pieza que hoy no existe.
CREATE TABLE public.obligation_settlements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id   uuid NOT NULL REFERENCES public.obligations(id),
  movement_id     uuid NOT NULL REFERENCES public.cash_movements(id),
  applied_amount  numeric(18,2) NOT NULL CHECK (applied_amount > 0),
  variance_kind   text CHECK (variance_kind IN ('discount','credit_note','rounding')),
  variance_amount numeric(18,2),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','void')),
  voided_reason   text,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
```

### 7.1 Reglas de integridad — dónde vive cada una

Esto es lo que decide si el módulo cuadra o no, y va **en la base**, no en el BFF:

| Regla | Mecanismo |
|---|---|
| `settled_amount` = suma de cruces vigentes; nunca `> total_amount` | `CHECK` para el techo + recálculo dentro de la RPC de cruce. **La columna es caché, no verdad**: la verdad es la suma de `obligation_settlements` |
| Un cruce nunca aplica más que el saldo vivo | **Lock pesimista**: la RPC de cruce hace `SELECT … FOR UPDATE` sobre la obligación **antes** de calcular el saldo. Es el patrón de [`enforce_session_capacity`](../architecture/concurrencia-y-reservas.md#2-los-seis-mecanismos-y-dónde-ya-los-usa-sportmaps), no un `count` suelto |
| La suma de cruces de un movimiento nunca excede su `amount` | Mismo lock, sobre el movimiento |
| Un doble clic en «cruzar» no aplica dos veces | `idempotency_key` — [`CONC-1`](../architecture/concurrencia-y-reservas.md#5-lo-que-hay-que-cerrar) |
| Nada se edita ni se borra: se anula y se vuelve a hacer | `status='void'` + `voided_reason` obligatorio (mín. 10 caracteres) + auditoría |
| Estados y transiciones | `open → partial → settled`; `void` solo desde `open`. `settled → partial → open` únicamente por anulación de cruces |

**Toda escritura entra por RPC `SECURITY DEFINER`** con `SET search_path = pg_catalog, public, pg_temp`
y `GRANT EXECUTE` explícito. Las tablas **no** otorgan `INSERT`/`UPDATE` a `authenticated`: la RLS de
Postgres es por fila, no por columna, así que «el auxiliar solo puede cruzar» no se puede expresar con
una policy. Misma lección que ya costó el módulo de informes.

---

## 8. Decisiones abiertas

Ninguna se resuelve desde el código.

**Resuelta:** **D-PD** — partida doble completa desde el inicio (2026-08-01, §4).

| # | Decisión | Por qué importa |
|---|---|---|
| **D-PUC** | ¿Qué plan de cuentas? PUC Colombia (Decreto 2650) **completo**, o un catálogo **reducido** con las cuentas que una escuela deportiva realmente usa | El completo son ~2.000 cuentas que nadie en la escuela sabe elegir, y vuelve inusable el selector; el reducido exige decidir cuáles y deja fuera casos raros |
| **D-CORTE** | Fecha de corte del mayor y cómo se calculan los **saldos de apertura** | Sin esto no se puede postear la primera fila. Y define si el mayor arranca limpio o arrastra historia |
| **D-T** | Tercero: ¿tabla `parties` unificada, o eje polimórfico `party_type + party_id` (propuesto)? | Una tabla unificada obliga a migrar `suppliers` y `payroll_employees`; el eje polimórfico no, pero pierde la FK |
| **D-CXC** | ¿Se acepta que CxC siga siendo `payments`, que Pendientes lo **lea** y una capa de posteo lleve sus eventos al mayor (§5)? | Si la respuesta es no, el módulo crece varias semanas y toca el flujo con más dinero. Con partida doble ya no basta con leerlo: hay que postearlo, o el mayor no incluye el ingreso principal |
| **D-MIG** | Los `expenses` ya pagados: ¿se migran como obligación `settled` con cruce sintético marcado «migración», o el módulo arranca solo con lo nuevo? | Arrancar limpio es mucho más barato; migrar da continuidad de reportes. Interactúa con D-CORTE |
| **D-CUADRE** | El criterio de aceptación de la migración: ¿contra qué cuadra la suma de saldos? | Con libro mayor **sí** hay contra qué cuadrar: el saldo de la cuenta de CxP del mayor. Definir la tolerancia y qué pasa si no cuadra (¿bloquea la salida a producción?) |
| **D-ROL** | La matriz Auxiliar / Contador / Administrador del spec → roles reales. SportMaps tiene `school_admin`, `coach`, `reporter` y el helper `can_manage_finances` | Hay dos matrices de permisos de coach que ya son código muerto ([`SEG-4`](../ROADMAP.md#seg--seguridad-rls-y-permisos)) — no crear una tercera |
| **D-NOM** | ¿La obligación de nómina nace al cerrar `payroll_runs`, o se registra a mano? El motor existe; hay que decidir si se le engancha un trigger o una RPC explícita | Un trigger que genere obligaciones al cerrar la liquidación es cómodo y difícil de deshacer |

---

## 9. Fases

Adaptadas del §15 del spec externo. Cada fase con revisión entre medias y una rama por fase.

| Fase | Contenido | Depende de |
|---|---|---|
| **ERP-1 · Quick wins** | Ícono Ojo / Lupa, ocultar Editar en vez de deshabilitar, orden cronológico estable en movimientos, formulario de tercero natural/jurídica, y documentar en pantalla qué asiento produce «Registrar gasto» | Nada. Encaja con [`UX-1`](../ROADMAP.md#ux--interfaz-navegación-y-densidad) |
| **ERP-2 · Libro mayor + núcleo CxP** | `chart_of_accounts` + `journal_entries` + `journal_lines` con cuadre diferido, inmutabilidad y reverso · `school_account_mappings` · saldos de apertura · capa de posteo · `obligations` + `cash_movements` + `obligation_settlements` · máquina de estados · RPCs de cruce con lock pesimista · pago parcial y multi-factura · pestaña «Por pagar» | D-PUC, D-CORTE, D-T, D-MIG · **`CONC-1`** (idempotencia) es prerrequisito |
| **ERP-3 · Períodos contables** | `accounting_periods` + rechazo de asientos en período cerrado. Es la bisagra con el ciclo de mes | ERP-2 |
| **ERP-4 · Nómina** | Obligación por empleado al cerrar la liquidación, pestaña agrupada por período, pago del período completo con un egreso, posteo al mayor | ERP-2 en producción · D-NOM |
| **ERP-5 · CxC: lectura + posteo** | Pestaña «Por cobrar» que lee `payments` sin migrarlo, **y** capa de posteo que lleva sus eventos al mayor (cobro emitido → CxC/Ingreso; pago recibido → Banco/CxC). Sin esto el mayor no incluye el ingreso principal de la escuela | ERP-2 · D-CXC · [`DIN-1`](../plan-f0-generacion-de-mes-y-cobros-duplicados.md) cerrado |
| **ERP-6 · Menú y retiro de nombres viejos** | «Finanzas» y «Proveedores» dejan de existir como módulos; queda `Pendientes · Movimientos · Contabilidad` | ERP-2..5 · se entrega **junto** con [`UX-4`](../ROADMAP.md#ux--interfaz-navegación-y-densidad) |

**Lo que este módulo NO cubre:** el cierre de período y el snapshot congelado — eso es el
[ciclo de mes](month-close-module.md) F1+, y son complementarios: Pendientes da el libro de
obligaciones y movimientos; el cierre le pone corte, foto y estado de resultados.
