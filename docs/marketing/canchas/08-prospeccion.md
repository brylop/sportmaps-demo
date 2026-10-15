# 08 · Prospección — lista de 300 clubes en Bogotá, Medellín y Cali

Método para armar la lista del plan §6 (meta: **300 prospectos con nombre, teléfono y número de
canchas**). Este documento **describe** cómo hacerlo; no se ejecutó ninguna consulta ni se descargó nada.

## Reglas

- **Solo datos publicados por el propio negocio** (ficha de Google Maps, su Instagram, su web, listados
  públicos de entidades). Nada de bases compradas ni números personales.
- **Datos personales (Ley 1581 de 2012):** el teléfono de un negocio publicado para recibir clientes se usa
  para un contacto uno a uno, con opción de salir. Quien pida no ser contactado se marca y no se vuelve a
  escribir. `<!-- VERIFICAR con asesoría legal -->`
- **Sin scraping automatizado de Google Maps** (va contra sus términos). Google Maps se recorre a mano o
  con la API oficial de Places pagando su uso `<!-- DECIDIR -->`. OSM sí se puede consultar (licencia ODbL:
  si se publica algo derivado, hay que atribuir «© colaboradores de OpenStreetMap»).
- La hoja de prospectos es interna; no se comparte fuera del equipo.

## Reparto de la meta

| Ciudad | Meta | Por qué |
|---|---|---|
| Bogotá | 140 | Mercado más grande; visitas en campo de las semanas 1–2 |
| Medellín | 90 | Ahí está la única sede publicada de Controla Cancha (oct-2026); hay que llegar antes |
| Cali | 70 | Playtomic tiene clubes de pádel ahí; nosotros vamos por fútbol sintético |
| **Base propia** | aparte | Escuelas que ya usan SportMaps y tienen instalaciones (plan §6.2): **van primero** y no cuentan en los 300 |

Por tipo: ~70 % canchas sintéticas de fútbol 5/7/8, ~15 % coliseos y polideportivos privados, ~15 % clubes
con escuela (candidatos a *hybrid*). Pádel queda fuera hasta la semana 6.

---

## 1. Fuentes

### 1.1 Base propia (primero)

Escuelas activas en SportMaps con instalaciones propias. La consulta la hace quien tenga acceso a la base,
**una sola vez y filtrada por nombre de tabla** (regla de Disk IO del `CLAUDE.md`: nada de listados del
catálogo). Se marcan con fuente `SportMaps` y se contactan por el canal de WhatsApp y el equipo de cuenta,
no con la secuencia en frío.

### 1.2 OpenStreetMap (Overpass)

La landing ya carga instalaciones de OSM en `mapData.entidades.ts`: **revisar primero ese archivo** para no
repetir el trabajo. Si hace falta más, esta consulta trae canchas y centros deportivos de las tres ciudades.

Se corre a mano en <https://overpass-turbo.eu> (pegar, «Ejecutar», exportar como GeoJSON o CSV).

```overpassql
/*
  SportMaps Canchas — prospectos en Bogotá, Medellín y Cali
  Trae: canchas (leisure=pitch) y centros deportivos (leisure=sports_centre / sports_hall)
  de fútbol / futsal / multideporte. Salida CSV con lo útil para la hoja.
  Áreas por Wikidata del límite municipal:
    Bogotá Q2841 · Medellín Q48278 · Cali Q51993
  Si alguna área sale vacía, usar el bloque alternativo por nombre (abajo).
*/
[out:csv(::type, ::id, name, leisure, sport, operator, "addr:street", "addr:housenumber",
         "addr:city", phone, "contact:phone", "contact:whatsapp", website, "contact:instagram",
         opening_hours, surface, access, fee, ::lat, ::lon; true; ";")][timeout:180];

area["wikidata"="Q2841"]["boundary"="administrative"]->.bog;
area["wikidata"="Q48278"]["boundary"="administrative"]->.med;
area["wikidata"="Q51993"]["boundary"="administrative"]->.cal;
(.bog; .med; .cal;)->.ciudades;

(
  // Canchas de fútbol y variantes
  nwr["leisure"="pitch"]["sport"~"^(soccer|futsal|five-a-side|seven-a-side|multi)$|(^|;)(soccer|futsal)(;|$)"](area.ciudades);
  // Centros deportivos y coliseos con fútbol / futsal / multideporte
  nwr["leisure"~"^(sports_centre|sports_hall)$"]["sport"~"soccer|futsal|multi"](area.ciudades);
  // Centros deportivos sin deporte etiquetado pero con nombre que sugiere canchas
  nwr["leisure"="sports_centre"]["name"~"[Cc]ancha|[Ss]int[eé]tic|[Ff]utbol|[Ff]útbol|[Cc]oliseo|[Pp]olideportivo"](area.ciudades);
)->.todo;
// Excluir lo que claramente no alquila: canchas marcadas sin acceso al público
nwr.todo["access"~"^(private|no)$"]->.privadas;
(.todo; - .privadas;);
out center;
```

**Bloque alternativo de áreas** (si las de Wikidata no resuelven):

```overpassql
area["name"="Bogotá"]["boundary"="administrative"]["admin_level"~"^(6|7)$"]->.bog;
area["name"="Medellín"]["boundary"="administrative"]["admin_level"="6"]->.med;
area["name"="Cali"]["boundary"="administrative"]["admin_level"="6"]->.cal;
```

Notas:
- `out center` da una coordenada también para canchas dibujadas como polígono.
- Varias canchas de una misma sede vienen como objetos separados: **agrupar por cercanía** (≤ 100 m) y por
  `name`/`operator` para contar `n_canchas`.
- Muchas canchas públicas de parques salen aquí; se descartan en la calificación (no alquilan con
  agenda propia, las administra la entidad distrital).
- OSM casi nunca tiene teléfono: el resultado da **nombre + ubicación**; el teléfono se completa en Google
  Maps o Instagram.
- Para Barranquilla y Bucaramanga (directorio `/canchas/:ciudad`): Q1023 y Q26657 `<!-- VERIFICAR IDs -->`.

### 1.3 Google Maps (a mano)

Búsquedas por ciudad y por localidad/comuna; abrir cada ficha y copiar a la hoja: nombre, teléfono, web,
Instagram, n.º de reseñas, horario y si tiene botón «Reservar».

Consultas:
- `canchas sintéticas en <localidad>` / `cancha sintética <barrio>`
- `fútbol 5 <localidad>` · `fútbol 7 <localidad>` · `fútbol 8 <localidad>`
- `alquiler de canchas <localidad>`
- `coliseo <ciudad>` · `polideportivo <ciudad>` · `club deportivo <localidad>`
- `escuela de fútbol con cancha <localidad>` (candidatos hybrid)

Recorrer por zonas:
- **Bogotá (localidades):** Suba, Engativá, Kennedy, Fontibón, Usaquén, Bosa, Teusaquillo, Barrios Unidos,
  Chapinero, Puente Aranda, Ciudad Bolívar, Tunjuelito, Rafael Uribe, San Cristóbal + Chía/Cota/Funza.
- **Medellín (comunas y área):** Laureles-Estadio, Belén, Robledo, Castilla, El Poblado, Guayabal, La
  América, Buenos Aires + Envigado, Itagüí, Sabaneta, Bello.
- **Cali (comunas):** sur (17, 18, 19, 22), norte (2, 4, 5, 6), oriente (13–16) + Jamundí.

### 1.4 Listados públicos de entidades

Para descubrir clubes y escenarios, **no** para escribirle a la entidad.
- **Bogotá — IDRD:** listado de clubes deportivos con reconocimiento deportivo vigente y su directorio de
  parques y escenarios. Útil para clubes con escuela (hybrid).
- **Medellín — INDER:** clubes deportivos con reconocimiento y escenarios deportivos por comuna.
- **Cali — Secretaría del Deporte y la Recreación:** clubes con reconocimiento deportivo.
- **Ligas** departamentales de fútbol y fútbol de salón (Bogotá, Antioquia, Valle): clubes afiliados.

`<!-- VERIFICAR: las URLs vigentes de cada listado antes de usarlas; cambian con frecuencia y algunas son
PDF. -->` Los escenarios públicos (canchas de parque) se descartan: los administra la entidad.

### 1.5 Instagram

Hashtags y búsquedas para encontrar canchas activas (y ver si contestan por DM o WhatsApp):
`#canchasintetica` `#canchassinteticas` `#futbol5bogota` `#futbol5medellin` `#futbol5cali`
`#canchasinteticabogota` `#canchasinteticamedellin` `#canchasinteticacali` `#futbol7` `#futbol8`
`#torneosfutbol5` `#alquilerdecanchas` + búsqueda de cuentas: «sintética», «cancha», «fútbol 5» + ciudad.

Señal fuerte de prospecto: publica horarios disponibles en historias, o tiene «reserva por WhatsApp» en la
bio (son exactamente quienes viven el problema).

---

## 2. Columnas de la hoja

| Columna | Ejemplo / valores |
|---|---|
| `id` | BOG-001 |
| `ciudad` | Bogotá / Medellín / Cali |
| `zona` | Localidad o comuna |
| `nombre` | Nombre comercial |
| `tipo` | `sintetica` / `coliseo` / `club_escuela` / `polideportivo` |
| `n_canchas` | número (si no se sabe: vacío, no adivinar) |
| `formatos` | f5 / f7 / f8 / futsal |
| `telefono_whatsapp` | +57… (solo publicado por el negocio) |
| `fuente_telefono` | Google Maps / Instagram / web |
| `instagram` | @cuenta |
| `web` | URL |
| `google_maps_url` | URL de la ficha |
| `resenas_google` | n.º (proxy de tamaño/actividad) |
| `tiene_boton_reservar` | sí / no (en Google) |
| `sistema_actual` | cuaderno-WhatsApp / Controla Cancha / Easycancha / Playtomic / otro / no sabe |
| `tiene_escuela` | sí / no |
| `cobra_en_linea` | sí / no / no sabe |
| `fuente` | OSM / Google / IDRD / INDER / Instagram / SportMaps / referido |
| `puntaje` | 0–10 (ver §3) |
| `prioridad` | A / B / C |
| `estado` | Nuevo → Contactado → Respondió → Demo/Visita → Sede creada → 1.ª reserva → Pagando · o Frío / No contactar |
| `fecha_ultimo_contacto` | AAAA-MM-DD |
| `proxima_accion` | qué y cuándo |
| `responsable` | quien lo lleva |
| `objeciones` | texto libre (palabras del dueño) |
| `no_contactar` | sí / no (si pidió salir) |
| `notas` | |

---

## 3. Calificación

**Descarta** (no entra a la lista): canchas de parque o colegio sin alquiler, escenarios públicos, negocios
cerrados permanentemente, sin ningún canal de contacto público, solo pádel/tenis (hasta la semana 6).

**Puntaje (0–10):**

| Criterio | Puntos |
|---|---|
| 2–5 canchas (encaja en Gratis/Pro) | +3 · 6 o más (Club) +2 · 1 cancha +1 |
| Reservas por WhatsApp visibles (bio, historias, ficha) | +2 |
| Activo en Instagram (publicó en los últimos 30 días) | +1 |
| ≥ 50 reseñas en Google | +1 |
| Tiene escuela o equipos (candidato hybrid) | +2 |
| Sin sistema de reservas | +1 · con Controla Cancha / Easycancha / Playtomic: 0 (no se descarta: se contacta con el guion de objeciones) |

**Prioridad:** A = 7–10 · B = 4–6 · C = 0–3. Los A son los candidatos a **visita en campo** y al **club
piloto** (perfil en `06-ventas-whatsapp.md` §4).

---

## 4. Cadencia diaria

Una persona, de lunes a viernes. Objetivo: llegar a 300 en ~2 semanas y mantener el contacto.

| Bloque | Hora | Actividad | Meta diaria |
|---|---|---|---|
| Investigación | 8:00–9:30 | Completar filas (OSM → Google → Instagram), calificar | 25 prospectos nuevos (hasta llegar a 300) |
| Contacto 1 | 9:30–11:30 | Mensaje 1 de la secuencia a prioridad A y B | 20 primeros contactos |
| Seguimientos | 14:00–15:00 | Mensajes 2, 3 y seguimientos del día según la hoja | todos los vencidos |
| Visitas | 15:00–17:30 (mar, mié, jue) | Visitas a prioridad A de una zona | 3–4 por tarde → 10 por semana |
| Cierre | 17:30–18:00 | Actualizar estados, anotar objeciones, preparar la lista de mañana | hoja al día |

**Topes de seguridad del número comercial:** máximo `[N]` primeros contactos en frío por día
`<!-- DECIDIR: propuesta 20–30 -->`, escritos uno a uno; si sube la tasa de bloqueos o reportes, bajar
el ritmo de inmediato.

**Calendario:**
- **Semana del 15-oct:** base propia + 100 prospectos de Bogotá; buscar el club piloto entre los A
  (prioridad 1, D12).
- **Semana del 19-oct:** 100 más (Medellín + Bogotá); primeras visitas en Bogotá.
- **Semana del 26-oct:** 100 más (Cali + resto); visitas en Bogotá.
- **Desde el 2-nov:** la lista queda en 300; el trabajo pasa a seguimiento, visitas (rotando la ciudad cada
  semana) y a sumar los que lleguen por contenido y pauta.

**Indicadores semanales** (al tablero del plan §7): prospectos nuevos, contactados, % que responde,
visitas, sedes creadas, sedes con 1.ª reserva, objeciones más repetidas.
