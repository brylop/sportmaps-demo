# Club Carmel — multideporte, membresías externas y métricas por deporte

**Fecha:** 2026-08-15 · **Estado:** propuesta de alcance, sin código
**Contexto:** arranca periodo de prueba. Carmel tiene **escuela formativa + club con membresías**,
varios deportes, y las membresías **se pagan en el club, no por SportMaps**.

---

## 1. Qué tipo de entidad es

`school_type = 'hybrid'` — no `venue`. Tienen escuela formativa (categorías, entrenadores,
asistencia) **y** club (membresías, reserva de espacios). `hybrid` prende Academia y Reservas a la
vez en `v_school_entitlements`; `venue` apagaría la escuela.

**No hace falta rol nuevo.** El rol dice quién es la persona; `school_type` dice qué es el negocio.

---

## 2. Los cinco frentes, con lo que hay hoy

### 2.1 Membresía activa (pagada fuera de SportMaps)

**Lo que hay:** nada. No existe `memberships` ni equivalente. Lo más cercano es `enrollments`, que
es justo lo que NO sirve: los crons de cobro recorren inscripciones, así que colgar la membresía ahí
le genera cartera que Carmel no quiere.

**Recomendación — tabla nueva y liviana, deliberadamente fuera de facturación:**

```
memberships(
  school_id, subject_type/subject_id,     -- atleta con cuenta o unregistered
  status,                                  -- active | expired | suspended
  valid_from, valid_until,
  source,                                  -- 'manual' | 'import' | 'api'
  external_ref,                            -- el id en el sistema del club
  updated_by, updated_at
)
```

Tres razones para que sea tabla propia y no un campo en `enrollments`:

1. **No entra a la cartera.** Ningún cron la mira. Es un hecho declarado, no un cobro.
2. **`external_ref` es el gancho de la integración futura.** Hoy se llena a mano; mañana, cuando nos
   den acceso a su programa, el mismo campo sirve para sincronizar sin migrar nada.
3. **`source` deja ver de dónde salió el dato**, que es lo primero que se pregunta cuando algo no
   cuadra.

En producto: badge "Membresía activa / vencida" en la ficha del atleta, filtro en el listado, y carga
manual (uno a uno + CSV). Nada de esto toca pagos.

> Ojo con el lenguaje: "sin pagos" no significa sin dinero — significa **sin cobro por SportMaps**.
> La escuela formativa sí puede facturar mensualidades por nosotros si quieren; son dos cosas
> separadas y conviene decidirlo explícitamente con ellos.

### 2.2 Multideporte

#### Lo que el club dice de sí mismo (fuente, 2026-08-17)

De <https://www.carmelclub.com.co/procedures/noticia.php?id=2364> («Quiénes somos»). Se anota
porque una versión anterior del script de alta traía 8 disciplinas, categorías y 16 instalaciones
**inventadas por nosotros**, y eso no se repite: lo que no esté respaldado va marcado como pregunta.

**Deportes que la página nombra:**

| Deporte | Lo que dice la página | Slug del catálogo |
|---|---|---|
| Golf | 18 hoyos, par 70; cancha de práctica; putting green | `golf` |
| Tenis | 15 canchas | `tenis` |
| Fútbol 11 | 1 cancha iluminada | `futbol` |
| Mini fútbol | — | `futbol` (es modalidad, no otro deporte) |
| Volleyball | — | `voleibol` |
| Basquetball | — | `baloncesto` |
| Pádel | 2 canchas iluminadas y cubiertas | `padel` |

**Otras instalaciones que nombra:** piscina, gimnasio, salones para eventos (hasta 4.000 pax),
parque para niños, sala de cine, coworking, guardería canina, vestidores, sala cuna, restaurante,
bar inglés. Atiende **martes a domingo y festivos**.

**Lo que la página NO dice, y por lo tanto no se asume:**

- Cuáles de esos deportes tienen **escuela formativa** (con equipos y categorías) y cuáles son solo
  instalación para socios. Piscina y gimnasio aparecen como instalación, no como disciplina.
- Ninguna **categoría ni rango de edad**. Por eso las categorías salen del catálogo de cada
  federación y el eje entra en `division` (ver `scripts/carmel-configurar.mjs`).
- Ningún **precio ni tarifa** de reserva.
- Cómo llama a cada cancha (¿«Cancha 1»…«Cancha 15»?).

Los 6 deportes resuelven limpio contra `sports_categories`: golf 5 categorías (R&A/USGA), tenis 7
(ITF), fútbol 7 (FIFA), voleibol 4 (FIVB), baloncesto 7 (FIBA), pádel 7 (FIP).

**Lo que hay — y esta es la buena noticia:** el modelo multideporte **ya existe**.
`sport_configs(school_id, sport, categorization_axis, rules, settings)` admite N filas por escuela, y
`GET /api/v1/school/context` ya devuelve `sports: SportConfig[]` en plural.

**El problema real es otro, y son dos cosas:**

1. **`sport_configs` tiene 1 sola fila en toda la base**, y es de `MMA BLAIR TEAM`
   (`sport=mma`, `categorization_axis=weight`) — una de las cuentas que acabamos de marcar como
   `test`. O sea: el camino multideporte, y de paso el eje de categorización que no sea por edad,
   **nunca se ha ejercido con un cliente real**. Carmel sería el primero.
2. **Los consumidores colapsan a un solo deporte.** `useSchoolFeatures` expone `sports[]` y
   `primarySport`, pero `useSportVisual` y compañía usan solo `primarySport`. De ahí viene el
   "funcionalidades que solo se activan cuando son de un solo deporte".

**Recomendación:** no hay que construir el multideporte, hay que **terminar de cablearlo**:

- Poblar `sport_configs` de Carmel (una fila por deporte, con su `categorization_axis`: edad para
  fútbol/natación, nivel para golf, etc.).
- Un **selector de deporte activo** en el shell de la escuela (como el selector de sede), que fije el
  contexto y que las páginas por deporte lean de ahí en vez de `primarySport`.
- `enrollment_categories` **no existe** — la multi-categoría quedó a medias. Si Carmel necesita que
  un atleta esté en dos deportes a la vez, hay que revisar ese pendiente antes.

### 2.3 Métricas por deporte

**Lo que hay:**

| | |
|---|---|
`sports_categories` | **99 deportes** ya catalogados — Natación y Golf incluidos |
`sport_metric_definitions` | **79 métricas** pero solo en **6 deportes** |
`performance_entries` | 486 registros |

Cobertura real de métricas:

| Deporte | Métricas |
|---|---|
Voleibol | 51 |
Fútbol | 12 |
MMA / lucha | 4 |
Cheer / Stunt | 4 |
Patinaje de velocidad | 4 |
Gimnasia | 4 |
**Natación** | **0** |
**Golf** | **0** |

**Recomendación:** el catálogo de deportes ya está; lo que falta es **el set de métricas de natación
y golf**, que es trabajo de definición deportiva más que de código — la tabla y la UI de captura ya
existen (`PerformanceEntryModal`, `TeamPerformanceEntryModal`).

- **Natación:** tiempos por prueba y estilo (50/100/200 libre, espalda, pecho, mariposa), parciales,
  frecuencia de brazada, viraje. Ojo: la métrica natural es **tiempo**, donde *menor es mejor* —
  `higher_is_better` ya existe en el esquema, hay que usarlo bien.
- **Golf:** hándicap, scoring average, greens in regulation, fairways hit, putts por ronda.

Necesito que alguien del lado deportivo valide esas listas antes de sembrarlas.

### 2.4 Reservas de espacios

**Lo que hay:** construido y en uso — `facilities` (29), `facility_availability` (274),
`facility_reservations` (60), con hook completo, modal, y rutas BFF. `/facilities` ya está en el menú.

**Lo que falta para Carmel:** las **líneas/carriles**. Hoy una piscina es *una* instalación con
capacidad N; reservar "el carril 3 de 6" no se puede expresar. Dos caminos:

- **Barato:** cada carril es un `facility` propio ("Piscina — Carril 3"). Funciona ya, sin código,
  pero ensucia el listado y no impide reservar la piscina completa y un carril a la vez.
- **Correcto:** sub-unidades de instalación (`facility_units`), con la regla de que reservar el padre
  bloquea los hijos. Es el modelo que sirve también para canchas divisibles en fútbol.

Recomiendo arrancar con el barato para el trial y medir si les molesta, antes de construir el correcto.

### 2.5 Video / Veo

**Lo que hay: nada.** Cero referencias a Veo en el repo — es terreno virgen.

Veo es una cámara que graba y sube el partido a su nube. Antes de estimar hay que saber:

1. ¿Carmel tiene Veo contratado y con qué plan? La API no está en todos.
2. ¿Qué queremos? El rango va de **enlazar el video al partido** (barato, un campo `video_url` en el
   evento y un embed) a **traer los clips por jugador** (caro, depende de qué exponga su API).

Mi recomendación: empezar por el enlace manual. Cubre el 80% del valor —"ver el partido desde la
ficha del equipo"— y no depende de negociar acceso a la API de un tercero.

---

## 3. Secuencia propuesta

| # | Qué | Por qué en este orden | Tamaño |
|---|---|---|---|
**C1** | Carmel entra como `hybrid`, con sus `sport_configs` poblados y sus instalaciones cargadas | Es lo que se necesita para arrancar el trial. Sin código nuevo. | horas |
**C2** | Tabla `memberships` + badge + filtro + carga manual/CSV | Es su necesidad más concreta y no toca nada existente | pequeño |
**C3** | Selector de deporte activo + cablear las páginas a `sports[]` en vez de `primarySport` | Desbloquea el multideporte de verdad, y sirve para las otras 83 escuelas tipo club | mediano |
**C4** | Métricas de natación y golf | Depende de validación deportiva, no de código | pequeño + definición |
**C5** | Carriles como facilities sueltas → medir → decidir si `facility_units` | Barato primero, correcto después si duele | pequeño / mediano |
**C6** | Enlace de video Veo en el evento | Independiente del resto | pequeño |
**C7** | Integración API con su sistema de membresías | Requiere acceso de ellos; `external_ref` ya lo deja preparado desde C2 | por definir |

---

## 4. Decisiones que necesito

1. **¿La escuela formativa de Carmel factura por SportMaps, o también cobran ellos aparte?** Cambia
   si hay que montarles cartera o no.
2. **¿Un atleta puede estar en dos deportes a la vez?** Si sí, `enrollment_categories` (que no
   existe) se vuelve prerrequisito de C3.
3. **Las listas de métricas de natación y golf** — necesito quién las valida del lado deportivo.
4. **Veo:** ¿qué plan tienen y qué esperan ver dentro de SportMaps?
