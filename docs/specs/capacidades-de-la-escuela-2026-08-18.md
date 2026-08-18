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
