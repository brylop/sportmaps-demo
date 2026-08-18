# Capacidades de la escuela — separar los ejes que `school_type` mezcla

**Fecha:** 2026-08-18 · **Estado:** spec, sin código · **Origen:** al cablear el gate de cobros en
el alta de atleta salió que `school_type` está tratando de responder tres preguntas distintas con un
solo valor, y ya no le da.

---

## 1. El problema, con números

`school_type` decide hoy **qué módulos ve** una escuela: `has_academy`, `has_reservations` y
`has_wallet` se derivan de él en `v_school_entitlements`. Eso obliga a que cada combinación posible
tenga su propio valor de enum — y las combinaciones son el producto de varias preguntas
independientes, no una lista.

Medido contra la base el 2026-08-18:

| Hallazgo | Dato |
|---|---|
| **Instalaciones invisibles** | **9 escuelas tienen instalaciones cargadas y `has_reservations = false`**, porque su tipo es `academy`. Las cargaron y el módulo no las muestra |
| **La reserva gratis ya existe** | **15 de 29** instalaciones tienen `hourly_rate = 0`. No es un caso hipotético |
| **Nadie cobró una reserva nunca** | `facility_reservations` tiene **60 filas**; `reservation_payments`, **0** |
| **El eje de cobros sí funciona** | `billing_enabled`: 365 en `true`, 1 en `false`. Es un eje propio y se comporta |
| **Falta el eje de reservas** | No hay ninguna columna que diga si las reservas de una escuela se cobran, son gratis, o las cubre la membresía. `show_facilities` es solo del perfil público |
| **`hybrid` es nuevo** | Hasta hoy **ninguna** escuela lo tenía. Club Campestre Demo es la primera |

Las nueve escuelas con instalaciones invisibles son la prueba concreta: alguien cargó sus canchas
esperando usarlas, y el tipo de escuela se lo negó sin decir nada.

---

## 2. Las preguntas que hay que responder por separado

Cada una es independiente de las otras. Cualquier intento de derivarlas de un solo enum vuelve al
problema.

| # | Pregunta | Hoy |
|---|---|---|
| 1 | ¿Tiene **escuela formativa**? Equipos, entrenamientos, asistencia | `has_academy`, derivado del tipo |
| 2 | ¿Tiene **espacios reservables**? | `has_reservations`, derivado del tipo |
| 3 | ¿**Cobra mensualidades** por SportMaps? | `billing_enabled` ✅ eje propio |
| 4 | ¿Las **reservas se cobran**? Por uso, o incluidas en la membresía | **no existe** |
| 5 | ¿**Lee membresías** de un sistema externo? | `memberships` existe; no hay flag |

El caso que lo hace evidente, y es el tuyo: **una universidad puede cobrar o no**. Es la misma
clase de institución, con dos configuraciones. Con un enum habría que inventar
`universidad_que_cobra` y `universidad_que_no`, y después la variante con reservas, y después la
variante con reservas gratis. No termina.

---

## 3. Lo que se propone

### `school_type` deja de ser el gate y pasa a ser etiqueta + preset

Sigue existiendo, sigue sirviendo para hablar («es un club», «es una academia») y para **pre-cargar**
los flags al crear la escuela. Lo que deja de hacer es *decidir*: después del alta mandan los flags.

Así, «universidad que cobra» y «universidad que no» son **la misma etiqueta con distinta
configuración**, y no dos valores de enum.

### Los flags, explícitos y por escuela

```
school_settings
  billing_enabled        boolean   -- YA EXISTE. ¿cobra mensualidades por SportMaps?
  has_academy_enabled    boolean   -- NUEVO. hoy se deriva del tipo
  has_reservations_enabled boolean -- NUEVO. hoy se deriva del tipo
  reservations_billing   text      -- NUEVO. 'none' | 'per_use' | 'included_in_membership'
  memberships_external   boolean   -- NUEVO. lee el estado de membresía de afuera
```

`reservations_billing` con `text + CHECK`, no enum: es la convención del repo desde el dolor de
castear `payments.status`.

### Qué significa cada valor de `reservations_billing`

| Valor | Qué implica en producto |
|---|---|
| `none` | No hay reservas, o no se cobran ni se controlan. No se pide precio a las instalaciones |
| `per_use` | Cada reserva tiene precio y puede generar cobro. Es el modelo de alquiler al público |
| `included_in_membership` | Se reserva, pero **no se cobra**: lo cubre la membresía. **Este es Carmel.** El precio de la instalación deja de pedirse y de mostrarse |

### La transición no rompe nada

`v_school_entitlements` sigue exponiendo `has_academy` y `has_reservations` con los mismos nombres,
pero calculados así:

```
has_academy      = COALESCE(has_academy_enabled,      <lo que hoy deriva del tipo>)
has_reservations = COALESCE(has_reservations_enabled, <lo que hoy deriva del tipo>)
```

Mientras los flags nuevos estén en `NULL`, **el comportamiento es idéntico al de hoy**. Se llenan
cuando alguien decide, no en un backfill masivo. Es lo que permite aplicar esto sin medir un radio
de 366 escuelas.

Y las **9 escuelas con instalaciones invisibles** dejan de necesitar un cambio de tipo: se les
prende `has_reservations_enabled` y listo.

---

## 4. Qué cambia en pantalla

| Dónde | Regla | Estado |
|---|---|---|
| Menú | Rutas de cartera solo si `billing_enabled` | ✅ hecho |
| Menú | Membresías solo si **no** cobra | ✅ hecho |
| Alta de atleta | Plan y Mensualidad solo si `billing_enabled` | 🔨 parche escrito, sin commitear |
| Alta de instalación | Pedir precio solo si `reservations_billing = 'per_use'` | pendiente |
| Detalle de instalación | No mostrar tarifa si está incluida en la membresía | pendiente |
| Flujo de reserva | No pasar por cobro si está incluida | pendiente |
| Panel de super admin | Los cinco flags, con el efecto real de cada uno | pendiente |

El **eje siempre es el flag, nunca el tipo de escuela**. Es el mismo error que ya costó caro con
`school_has_branding_feature` (¿puede editar su marca?) contra `school_shows_own_brand` (¿se le
muestra?): dos preguntas distintas compartiendo un gate.

---

## 5. Fases

| Fase | Qué | Riesgo |
|---|---|---|
| **F0** | Las cuatro columnas nuevas en `NULL` + la vista con `COALESCE` + los cinco toggles en el panel de super admin | Bajo: sin cambio de comportamiento hasta que alguien los use |
| **F1** | Prender `has_reservations_enabled` en las 9 escuelas con instalaciones invisibles | Bajo, pero **hay que avisarles**: les aparece un módulo nuevo |
| **F2** | `reservations_billing` cableado en el alta y el detalle de instalación | Medio: toca el flujo de reservas |
| **F3** | El flujo de reserva sin cobro cuando está incluida en la membresía | Medio |
| **F4** | El preset por `school_type` al crear la escuela, y quitarle al cliente la decisión del tipo | Bajo |

Carmel necesita **F0** y **F2** para que su alta se sienta coherente. F1 y F3 pueden ir después.

---

## 6. Decisiones que no puedo tomar solo

1. **Las 9 escuelas con instalaciones invisibles.** ¿Se les prende reservas —les aparece un módulo
   que no sabían que tenían— o se deja apagado hasta que lo pidan? Son escuelas reales con datos
   cargados.

2. **Una reserva incluida en la membresía, ¿exige membresía activa?** Lo natural es que sí, pero eso
   convierte a `memberships` en un gate de acceso, y hoy es «un hecho declarado» que
   deliberadamente no vence solo. Si el dato del club llega rezagado, un socio al día se queda sin
   reservar. Hay que decidir si se bloquea, se avisa, o se deja pasar.

3. **¿Cuántas reservas puede hacer un socio?** Si no se cobra, el precio deja de ser el límite
   natural. Puede hacer falta un cupo — por semana, simultáneas, o por espacio. Hoy no existe nada.

4. **Las instalaciones con `hourly_rate = 0`.** Son 15. ¿Es «gratis» declarado o «nunca le pusieron
   precio»? La respuesta cambia a qué valor de `reservations_billing` migran sus escuelas.

---

---

# Decisiones cerradas + spec del panel de super admin

**Fecha:** 2026-08-18 · **Estado:** decisiones tomadas · panel especificado · pendiente de código

---

## 7. Decisiones tomadas

Estas cuatro preguntas estaban abiertas en la sección 6. Quedan cerradas así. Si alguna se
reabre, se reabre con un cliente concreto en la mano, no en abstracto.

### 7.1 Las 9 escuelas con instalaciones invisibles → **apagado hasta que lo pidan, con outreach**

**Decisión:** NO se prende `has_reservations_enabled` de oficio. F1 deja de ser una migración y
pasa a ser una campaña comercial.

**Por qué:** prenderles un módulo sin aviso cambia su UI, genera tickets, y los datos que cargaron
pueden estar viejos (precios desactualizados, canchas que ya no existen). En cambio, son 9
escuelas que *demostraron intención*: cargaron sus canchas esperando usarlas.

**Cómo se ejecuta:**
1. Exportar la lista de las 9 escuelas con contacto y fecha de carga de sus instalaciones.
2. Mensaje tipo: «Vimos que cargaste tus canchas en SportMaps — ya podemos activarte el módulo
   de reservas. ¿Lo quieres? Te ayudamos a revisar precios y horarios.»
3. Al que diga sí: se le prende el flag desde el super admin **en la misma llamada**, revisando
   con ellos `reservations_billing` y los `hourly_rate = 0` (ver 7.4).
4. Al que no responda en 30 días: queda como estaba. El flag en `NULL` no rompe nada.

**Efecto en fases:** F1 no bloquea a nadie y no tiene fecha dura.

### 7.2 Reserva incluida en membresía sin membresía activa → **avisar, no bloquear**

**Decisión:** la reserva **pasa siempre**. Si la membresía figura vencida o inexistente, la
reserva se marca con un warning visible para el staff del club. El club decide qué hacer.

**Por qué:** `memberships` es «un hecho declarado» con dato potencialmente rezagado. Si se
bloquea, el costo del falso negativo lo paga un socio al día parado frente al recepcionista — y
el club culpa a SportMaps, no a su propio dato rezagado.

**Mecánica:**
- Al crear la reserva, si `reservations_billing = 'included_in_membership'`, se consulta el
  estado de membresía del atleta **y se guarda en la reserva** (snapshot, no join en vivo):
  `membership_status_at_booking: 'active' | 'expired' | 'not_found'`.
- `active` → nada especial.
- `expired` / `not_found` → la reserva se crea igual, con badge **«Membresía no verificada»**
  visible en el listado y detalle de reservas del staff. Nunca visible al socio.
- El snapshot evita el caso «cuando reservó estaba vencida pero el club actualizó después y ya
  no se ve por qué saltó el warning».

**Puerta al futuro:** si un club pide bloqueo duro, se agrega
`reservations_require_active_membership boolean DEFAULT false` en `school_settings`. Es un flag
más, coherente con toda la spec: la política no vive dentro del mecanismo. **No se construye
hasta que alguien lo pida.**

### 7.3 Cupos de reserva → **no se construye todavía; se pregunta la regla de papel**

**Decisión:** se lanza sin cupo. En el onboarding de cada club con reservas incluidas se pregunta
cuál es su regla actual en papel («máx 2 horas por socio por semana», «una cancha simultánea»,
etc.).

- Si la regla existe y es simple → se implementa como límite por escuela en `school_settings`
  (`max_active_reservations integer NULL` = sin límite). Un solo número, no un motor de reglas.
- Si no existe → sin cupo, y se monitorean las primeras 2–3 semanas. Con ~800 atletas en Carmel
  se sabe rápido si el abuso es real o teórico.

**Por qué:** hay 0 filas en `reservation_payments` y cero historial de reservas gratis a escala.
Diseñar cupos sin datos es adivinar.

**Pregunta concreta para el onboarding de Carmel (2026-08-19):** «Hoy, ¿cuántas reservas puede
tener un socio y quién lo controla?»

### 7.4 Los 15 `hourly_rate = 0` → **no se migran; se pregunta en el momento de activación**

**Decisión:** no se intenta distinguir «gratis declarado» de «nunca puse precio» desde la base.
Como los flags nuevos arrancan en `NULL`, esas escuelas quedan con `reservations_billing = NULL`
(comportamiento actual: de facto nadie cobra nada).

**Mecánica:** cuando una escuela activa reservas en serio (desde el super admin hoy, self-service
después), si tiene instalaciones con tarifa 0 y se le pone `reservations_billing = 'per_use'`,
el panel muestra la lista y pregunta por cada una: **«¿Esta cancha es gratis o le falta
precio?»**. Gratis → se marca explícito (ver `is_free` abajo). Falta precio → queda pendiente y
la instalación no aparece reservable hasta tenerlo.

**Cambio de esquema que esto pide:** `facilities.is_free boolean DEFAULT NULL`. Con eso
`hourly_rate = 0` deja de ser ambiguo: gratis es `is_free = true`, sin precio es
`is_free IS NULL AND hourly_rate = 0`.

### 7.5 Decisiones de negocio anexas (no estaban en la sección 6, quedan fijadas)

**Los flags son palanca de pricing.** Una escuela solo-reservas, una solo-formativa y un híbrido
full no pagan lo mismo *eventualmente*. Consecuencia inmediata: **los cinco flags viven solo en
el panel de super admin y nunca en manos del cliente**, ni siquiera cuando exista self-service
(ver sección 10). El cliente pide, SportMaps prende. Esto además hace que F4 («quitarle al
cliente la decisión del tipo») deje de ser opcional.

**Carmel es el preset canónico de `hybrid`.** Su combinación exacta (sección 9) se documenta
como el default del preset, porque el próximo club campestre va a llegar pidiendo «lo mismo que
Carmel».

---

## 8. Panel de super admin — spec completa

Ruta propuesta: `Super Admin → Escuelas → [escuela] → Capacidades`.

Principio de diseño: **cada control muestra su efecto real, su valor efectivo y de dónde viene
ese valor**. Con la vista en `COALESCE(flag, derivado_del_tipo)`, un flag en `NULL` no es «off»
— es «heredando del tipo». El panel tiene que hacer esa diferencia visible o nadie va a entender
por qué una escuela se comporta como se comporta.

### 8.1 Estado tri-valuado: el concepto central del panel

Cada flag booleano nuevo se renderiza con **tres estados**, no dos:

| Estado en UI | Valor en DB | Qué significa |
|---|---|---|
| **Heredado** (default) | `NULL` | Se comporta según `school_type`. El panel muestra entre paréntesis qué está heredando: «Heredado (activo, por tipo *club*)» |
| **Forzado ON** | `true` | Decisión explícita, ignora el tipo |
| **Forzado OFF** | `false` | Decisión explícita, ignora el tipo |

Componente: segmented control de tres posiciones `[ Heredado | ON | OFF ]`, con el valor
**efectivo** resaltado siempre (heredado-activo se ve verde tenue, forzado-ON verde pleno).
Nunca un toggle de dos posiciones: perdería la distinción NULL vs false que es la base de la
transición sin backfill.

### 8.2 Los controles, uno por uno

#### Encabezado de la sección

```
┌─ Capacidades de [Nombre de la escuela] ─────────────────────────┐
│ Tipo: club  ·  Los flags de abajo mandan sobre el tipo.         │
│ Un flag en «Heredado» se comporta según el tipo.                │
└──────────────────────────────────────────────────────────────────┘
```

#### 1. `billing_enabled` — Cobros de mensualidades

| Atributo | Valor |
|---|---|
| Control | Toggle simple ON/OFF (ya existe, ya es eje propio, no es tri-valuado) |
| Label | **Cobros por SportMaps** |
| Descripción bajo el label | «La escuela cobra mensualidades a través de SportMaps (Wompi, comprobantes, cartera).» |
| Efecto visible listado | ON: menú de cartera, campos Plan y Mensualidad en alta de atleta, ciclo de facturación. OFF: menú de Membresías en su lugar |
| Al cambiar a OFF con cartera activa | Modal de confirmación: «Esta escuela tiene N cobros generados este ciclo. Apagar cobros no los borra pero oculta la cartera. ¿Continuar?» |

#### 2. `has_academy_enabled` — Escuela formativa

| Atributo | Valor |
|---|---|
| Control | Tri-valuado `[ Heredado \| ON \| OFF ]` |
| Label | **Escuela formativa** |
| Descripción | «Equipos, entrenamientos, asistencia, planes formativos.» |
| Efecto visible listado | ON: módulos de equipos/asistencia/entrenamientos. OFF: se ocultan aunque tengan datos |
| Guard al forzar OFF | Si la escuela tiene equipos o asistencias registradas: warning «Esta escuela tiene N equipos y M registros de asistencia. Se ocultarán, no se borran.» |

#### 3. `has_reservations_enabled` — Espacios reservables

| Atributo | Valor |
|---|---|
| Control | Tri-valuado `[ Heredado \| ON \| OFF ]` |
| Label | **Reservas de espacios** |
| Descripción | «Módulo de instalaciones y reservas.» |
| Dato contextual **siempre visible** | «Esta escuela tiene N instalaciones cargadas» — es exactamente el dato que hizo invisible el problema de las 9 escuelas. Si N > 0 y el valor efectivo es OFF, badge ámbar: **«Tiene instalaciones que no se muestran»** |
| Al prender | Se habilita el control #4 (`reservations_billing`), que estaba deshabilitado |

#### 4. `reservations_billing` — Modelo de cobro de reservas

| Atributo | Valor |
|---|---|
| Control | Radio de tres opciones + estado «Sin definir» (`NULL`). Deshabilitado (gris, con nota «Requiere reservas activas») si el valor efectivo de #3 es OFF |
| Label | **¿Cómo se cobran las reservas?** |
| Opción `none` | «**No se cobran ni se controlan.** No se pide precio a las instalaciones.» |
| Opción `per_use` | «**Se cobra por uso.** Cada instalación necesita precio; cada reserva puede generar cobro. Modelo de alquiler al público.» |
| Opción `included_in_membership` | «**Incluidas en la membresía.** Se reserva sin cobro. El precio de la instalación deja de pedirse y mostrarse. Las reservas de socios sin membresía activa se marcan con aviso, no se bloquean.» |
| Guard al elegir `per_use` | Si hay instalaciones con `hourly_rate = 0` y `is_free IS NULL`: se abre el flujo de la decisión 7.4 — lista de instalaciones, cada una con «¿Gratis o falta precio?». No se puede guardar `per_use` dejándolas ambiguas |
| Guard al elegir `included_in_membership` | Si `memberships` de la escuela está vacío: warning «Esta escuela no tiene membresías cargadas. Toda reserva saldrá con aviso de membresía no verificada.» Sugerir prender #5 si aplica |

#### 5. `memberships_external` — Membresías externas

| Atributo | Valor |
|---|---|
| Control | Toggle ON/OFF (default `false`, no tri-valuado: hoy nada se deriva del tipo) |
| Label | **Membresías de sistema externo** |
| Descripción | «El estado de membresía se lee de un sistema del club (importación/API). SportMaps no lo gestiona ni lo vence; lo declara el club.» |
| Efecto visible listado | ON: el módulo de membresías pasa a solo-lectura + importación; se muestra fecha de última sincronización/carga. OFF: membresías se gestionan en SportMaps |

#### 6. Bloque de solo-lectura: **Valor efectivo**

Al pie del panel, una tabla calculada en vivo — lo que la escuela *realmente ve hoy*, resuelto
el COALESCE. Es el antídoto contra «prendí el flag y no pasó nada» / «no toqué nada y cambió»:

```
Valor efectivo ahora mismo
──────────────────────────────────────────────
Formativa          ✅ activo    (heredado del tipo)
Reservas           ✅ activo    (forzado)
Cobros             ✅ activo
Cobro de reservas  incluidas en membresía
Membresías         externas (última carga: 2026-08-17)
──────────────────────────────────────────────
```

### 8.3 Requisitos transversales del panel

- **Audit log obligatorio.** Cada cambio guarda: quién, cuándo, flag, valor anterior → nuevo.
  Estos flags van a ser palanca de pricing (7.5); sin auditoría no hay cómo discutir una factura
  ni depurar «¿quién le prendió reservas a esta escuela?».
- **Guardado explícito**, no auto-save por toggle: los guards (modales de confirmación) necesitan
  un momento de commit. Botón «Guardar cambios» con resumen de lo que cambia.
- **Sin cascadas silenciosas.** Apagar #3 no borra ni resetea #4; solo lo deshabilita
  visualmente. Si se vuelve a prender #3, #4 reaparece con su valor anterior.
- **Enlace desde la escuela al preset.** Junto al tipo: «Aplicar preset del tipo» — botón que
  pone todos los tri-valuados en `Heredado` de un golpe (con confirmación). Es el reset limpio.

### 8.4 El preset al crear escuela (F4, adelantado en spec)

Al crear una escuela, elegir `school_type` **pre-carga** los flags como valores explícitos
sugeridos (no `NULL`), editables antes de guardar:

| Tipo | formativa | reservas | reservations_billing | cobros |
|---|---|---|---|---|
| `academy` | ON | OFF | `none` | ON |
| `club` | OFF | ON | `per_use` | según venta |
| `hybrid` | ON | ON | `included_in_membership` | según venta |
| `university` | ON | según venta | `none` | **según venta** — el caso que motivó todo |

«Según venta» = campo obligatorio en el alta, sin default. Obliga a que quien crea la escuela
sepa qué se vendió.

---

## 9. Configuración canónica: Carmel (y el preset `hybrid`)

Configuración exacta a aplicar desde el super admin para Club Campestre (trial 2026-08-19).
Esta combinación **se documenta como el preset `hybrid`**:

| Flag | Valor | Nota |
|---|---|---|
| `school_type` | `hybrid` | Etiqueta, ya no gate |
| `billing_enabled` | **`false` durante el trial** | Se prende cuando se firme. Revisar: con OFF les aparece el menú de Membresías, que es justo lo que necesitan |
| `has_academy_enabled` | `true` | 8 deportes, equipos formativos |
| `has_reservations_enabled` | `true` | Canchas del club |
| `reservations_billing` | `'included_in_membership'` | El caso que motivó el valor |
| `memberships_external` | `true` | El club ya tiene su sistema de socios; SportMaps lee, no gestiona |
| `max_active_reservations` | según respuesta del onboarding (7.3) | Preguntar la regla de papel el día 1 |

**Checklist para mañana (mínimo viable del trial):**
1. F0 desplegado: columnas en `NULL` + vista con `COALESCE` + panel de super admin (aunque sea
   la versión austera: los cinco controles + valor efectivo, sin todos los guards).
2. Aplicar la tabla de arriba a Carmel Demo a mano desde el panel.
3. F2 parcial: ocultar precio en alta y detalle de instalación cuando
   `reservations_billing = 'included_in_membership'`. Puede entrar en los primeros días si no
   llega hoy — el gate ya lo controla el flag, no hay que retocar nada después.
4. Preguntas de onboarding: regla de cupos (7.3) y formato en que viene el dato de membresías
   (para `memberships_external`).

---

## 10. Camino a self-service (sin intervención) — qué se delega y qué nunca

El objetivo declarado: que después esto se configure «de manera directa, sin intervención». La
línea que **no se cruza** sale de la decisión 7.5: los flags son palanca de pricing, así que el
cliente nunca los prende solo. Lo que sí se automatiza es todo lo demás:

| Etapa | Quién prende los flags | Qué se automatiza |
|---|---|---|
| **Hoy** | Super admin, a mano, en el panel de la sección 8 | Nada. El panel ES la automatización mínima: antes ni siquiera existía el control |
| **Etapa 2 — solicitud in-app** | Super admin aprueba con un clic | La escuela ve en su configuración las capacidades apagadas como «Disponible — solicitar». El pedido llega como notificación al super admin con el contexto ya armado (instalaciones cargadas, membresías, etc.). Aprobación = un clic que ejecuta el mismo guardado del panel, con los mismos guards y audit log |
| **Etapa 3 — auto-aprobación por regla** | Nadie, dentro de límites | Reglas tipo «si el plan contratado incluye reservas, la solicitud se auto-aprueba». El flag lo sigue prendiendo el sistema de SportMaps, nunca un write directo del cliente. El plan contratado se vuelve la fuente de verdad de qué puede auto-aprobarse |

Lo importante de la arquitectura: **las tres etapas usan exactamente el mismo endpoint de
escritura** (el del panel, con sus guards y su audit). Self-service no es un camino nuevo de
mutación de flags — es otra cara del mismo. Así el trabajo del panel de la sección 8 no se tira:
es el cimiento de las tres etapas.

Configuraciones que **sí** quedan en manos del cliente desde el día uno (no son palanca de
pricing, son operación):
- Precios y horarios de sus instalaciones (cuando `per_use`).
- Su regla de cupo (`max_active_reservations`), dentro del rango que su plan permita.
- La carga/sincronización de membresías (cuando `memberships_external`).
- Todo lo del perfil público (`show_facilities` etc.), que ya era suyo.

# 11. Complemento — lo que el esquema vivo obliga a cambiar

**Fecha:** 2026-08-18 · **Método:** medido contra la base y contra las 60 reservas que ya existen,
no razonado en abstracto.

Las decisiones de la sección 7 se sostienen. Lo que sigue son **siete correcciones** donde el spec
choca con algo que ya está construido, más tres huecos. El orden es por gravedad.

---

## 11.1 🔴 `reservations_billing` no puede ser un valor por escuela

**El dato.** De las 60 reservas que existen hoy:

| Columna | Valores reales |
|---|---|
| `booker_type` | `parent` 30 · `athlete` 19 · **`external` 11** |
| `resv_type` | `internal` 39 · `secondary_class` 10 · **`rental` 11** |
| `payment_status` | `paid` 32 · `unpaid` 19 · `partial` 6 · **`waived` 3** |

**El problema.** La misma escuela ya tiene reservas internas **y** alquileres a terceros con precio.
Un valor único por escuela no puede describir eso: si Carmel queda en
`included_in_membership`, el alquiler de sus salones para eventos —que su propia página anuncia,
hasta 4.000 personas— quedaría sin cobro. Y si queda en `per_use`, se le cobra al socio lo que su
membresía ya cubre.

**La corrección.** El eje es **(escuela × tipo de reserva)**, no escuela:

```
school_settings
  reservations_billing_internal  text  -- 'none' | 'per_use' | 'included_in_membership'
  reservations_billing_rental    text  -- 'none' | 'per_use'    ← un tercero no tiene membresía
```

`secondary_class` (10 reservas) es un tercer caso —clase suelta de un atleta de otra escuela— que
sigue la regla de `rental` salvo que se decida lo contrario.

Para Carmel: **interno incluido en la membresía, alquiler por uso**. Es lo que hace el club hoy en
la vida real, y lo que el modelo de un solo valor no sabía decir.

**Nota sobre `waived`.** `payment_status` ya tiene `waived` (3 reservas). Parte del vocabulario de
«esta reserva no se cobra» ya existe a nivel de fila. Conviene que
`included_in_membership` escriba exactamente `waived` y no un estado nuevo, para que los reportes
de cartera no tengan que aprender otra palabra.

---

## 11.2 🔴 `memberships_external = true` rompe el día 1 de Carmel

**El choque.** La sección 8.2 dice que con el flag en ON «el módulo de membresías pasa a
**solo-lectura** + importación». La sección 9 se lo pone a Carmel en `true`. Y el plan de Carmel
—y el runbook de mañana— dice que empiezan cargando **a mano o por CSV**, porque la API del club
no existe todavía.

Con esa combinación, mañana el club no puede registrar una membresía una por una.

**La corrección.** El flag debe gobernar **de quién es la verdad**, no si el staff puede teclear:

| Con `memberships_external = true` | |
|---|---|
| ✅ Sigue permitido | alta manual una por una, carga por archivo |
| ✅ Se marca | cada fila ya guarda `source` (`manual` / `import` / `api`) — la trazabilidad ya está resuelta a nivel de fila |
| ❌ SportMaps NO hace | vencer, suspender ni recalcular por su cuenta. Ni ahora ni cuando exista un cron |
| 📋 Se muestra | «Última carga» y el origen predominante |

O sea: el flag es una promesa de **no intervención automática**, no un candado a la entrada de
datos. Que es además coherente con la decisión ya tomada de que `valid_until` no vence solo.

---

## 11.3 🟡 `billing_enabled` de Carmel no es «hasta que firme»

La sección 9 dice `billing_enabled: false durante el trial` y «se prende cuando se firme».

Eso mezcla dos cosas que el propio producto ya separa:

| | Qué es | Dónde vive |
|---|---|---|
| `billing_enabled` | ¿la escuela le cobra mensualidades **a sus familias** a través de SportMaps? | `school_settings` |
| El contrato con nosotros | ¿la escuela **nos paga** el SaaS? | `/mi-plan`, `school_subscriptions` |

Carmel **no le cobra a sus familias por SportMaps, ni en el trial ni después**: sus membresías se
pagan en el club. Ese es el caso de negocio entero. Así que `billing_enabled = false` es
**permanente**, no transitorio — y firmar el contrato no lo cambia.

Lo que cambia al firmar es su suscripción, que es otra columna y otro panel. El comentario del
switch en el panel de super admin ya lo dice explícitamente («No toca /mi-plan»); vale mantener esa
separación en la spec.

---

## 11.4 🟡 La auditoría ya existe: no crear una cuarta tabla

La sección 8.3 propone `school_settings_audit(school_id, changed_by, changed_at, field, old_value,
new_value)`.

Ya hay **tres** tablas de auditoría en la base, y una calza exacto:

```
audit_logs(id, school_id, profile_id, table_name, record_id, action, old_data, new_data, created_at)
```

Más `payment_audit_logs` (específica de pagos) y la RPC `admin_list_audit_logs`, que ya alimenta la
pantalla de logs del admin.

**La corrección:** escribir en `audit_logs` con `table_name='school_settings'` y el diff en
`old_data`/`new_data`. Se gana la pantalla de auditoría gratis y no se suma una cuarta forma de
registrar lo mismo. Si hace falta filtrar solo capacidades, es un `WHERE`, no una tabla.

---

## 11.5 🟡 El preset de `club` apagaría la formativa de 84 escuelas

La tabla de la sección 8.4 propone, para `club`: formativa **OFF**.

Medido: hay **84 escuelas con `school_type = 'club'`**, y hoy `club` da `has_academy = true`. Es el
segundo tipo más común después de `academy` (118).

Si alguien aplica el preset sobre un club existente, le apaga la escuela formativa.

**La corrección**, dos partes:

1. **El preset aplica solo al crear.** Nunca sobre una escuela con datos. La sección 8.4 lo insinúa
   pero no lo prohíbe.
2. **Desambiguar los dos «preset».** La sección 8.3 llama «Aplicar preset del tipo» a un botón que
   pone todo en `Heredado`; la 8.4 llama preset a un juego de valores explícitos. Son cosas
   distintas con el mismo nombre. Sugerencia: **«Volver a heredar del tipo»** para el botón de 8.3,
   y reservar «preset» para el alta.

Y revisar el valor: si 84 clubes hoy tienen formativa activa, el preset de `club` probablemente
deba ser formativa **ON**, no OFF.

---

## 11.6 🟡 `university` no existe como tipo válido

La tabla 8.4 incluye `university`. La lista canónica que valida `admin_set_school_type` es:

```
academy · hybrid · venue · club · escuela · gimnasio · personal_trainer
```

`university` no está, así que la RPC lo rechazaría con `23514`. Y en la base lo que existe es
`institute` (62 escuelas), del grupo de entidades informativas del mapa.

**Dos caminos, hay que elegir:** agregar `university` a la lista canónica y al mapeo de módulos de
la vista (es una migración pequeña), o usar `institute` y aceptar que hoy significa «entidad del
mapa, sin módulos» — que no es lo que la tabla 8.4 describe.

Ojo con el segundo: `is_informational_entity()` decide qué escuelas **no llevan suscripción**. Si
una universidad real firma, no puede quedar del lado informativo.

---

## 11.7 🟢 `is_free` deja `rental_rate` ambiguo

La decisión 7.4 agrega `facilities.is_free` para desambiguar `hourly_rate = 0`.

Pero `facilities` tiene **dos** tarifas: `hourly_rate` y `rental_rate` (además de
`rental_enabled`, `min_deposit_pct`, `min_cancellation_hours`). Con un solo `is_free`, una cancha
gratis para socios y de pago para alquiler no se puede expresar — y es justo el caso de 11.1.

**La corrección:** `is_free` por tarifa (`hourly_is_free`, `rental_is_free`), o —más simple y
coherente con 11.1— que la gratuidad la decida el **flag de la escuela por tipo de reserva** y que
`is_free` no exista. La tarifa queda como dato; quién paga lo decide el modelo, no la instalación.

---

## 11.8 Tres huecos que no estaban

**a) `has_wallet` quedó fuera.** La sección 1 dice que del tipo se derivan `has_academy`,
`has_reservations` **y `has_wallet`**. Los cinco flags cubren los dos primeros. O `has_wallet` entra
como sexto flag, o queda declarado que sigue derivándose del tipo — pero no puede quedar sin
mención, porque es el mismo problema.

**b) Reservas y membresías no están cubiertas por el bloqueo de fin de prueba.** Las policies
RESTRICTIVE de la Fase A cubren 14 tablas, y **`facility_reservations` y `memberships` no están**.
Consecuencia con este modelo: una escuela con la prueba vencida sigue reservando canchas y
registrando membresías. Con reservas gratis, además, sin ningún cobro que la frene. Hay que
decidir si entran.

**c) La reserva no tiene dónde guardar el snapshot.** La decisión 7.2 pide
`membership_status_at_booking` en la reserva. `facility_reservations` no lo tiene — es una columna
nueva. Y más importante: **quién lo escribe**. Si lo pone el cliente, se puede falsear; tiene que
calcularlo un trigger `BEFORE INSERT` o la RPC que crea la reserva. Si hoy las reservas se crean
directo desde el navegador, esto no es opcional.

---

## 11.9 Lo que esto cambia del checklist de mañana

Nada de esto bloquea el trial. Pero dos cosas conviene ajustar antes de configurar a Carmel:

1. **No ponerle `memberships_external = true`** hasta resolver 11.2, o mañana no pueden cargar
   membresías a mano. Con el flag en `false` el módulo funciona completo y el `source` de cada fila
   ya deja la trazabilidad.
2. **Preguntarle al club por el alquiler a terceros** (11.1). Su página anuncia salones para
   eventos: si alquilan, el modelo de un solo valor no les sirve y conviene saberlo el día 1, no
   cuando llegue la primera factura de un evento.

Y una pregunta más para el onboarding, que sale de 11.1: **¿el socio paga algo por reservar, aunque
sea un depósito?** `facility_reservations` ya tiene `min_deposit_pct`, así que el producto contempla
depósitos parciales — y «incluida en la membresía» con depósito es una tercera combinación real.
