# 07 · Pauta — Meta Ads y Google Ads (desde H4, 20-nov)

Propuesta de configuración. **Nada se lanza antes del 20-nov** (plan §5.4) y nada sale sin que el fundador
fije el presupuesto. Los montos van como `[PRESUPUESTO …]`.

## Principios

- **Objetivo de negocio:** sedes creadas, no clics. La métrica que decide es **costo por sede creada** y,
  detrás, **sedes con al menos 1 reserva real** (plan §7).
- **Regla de corte del plan:** lo que no traiga sedes creadas en 2 semanas, se apaga.
- **Creativo principal:** el video del bot reservando (R09) en sus 3 cortes, más R10 y R08 final.
- **Solo se anuncia lo que está vivo.** Los anuncios de pago dividido, socio/público o no-show automático
  solo después de H5 (27-nov).
- **Medición antes de gastar:** `<!-- VERIFICAR -->` Píxel de Meta y etiqueta de Google en `/canchas`,
  evento de conversión «sede creada» (desde la app, no solo el clic al botón), UTMs en todos los links
  (`utm_source=meta|google&utm_medium=paid&utm_campaign=canchas-lanzamiento&utm_content=<id anuncio>`), y
  un campo «¿Cómo nos conociste?» en el registro. Sin esto, no se puede aplicar ninguna regla de corte.

## Presupuesto (a decidir)

| Bloque | Monto diario | Duración | Total |
|---|---|---|---|
| Meta — Bogotá | [PRESUPUESTO] | 20-nov → 4-dic | [ ] |
| Meta — Medellín | [PRESUPUESTO] | 20-nov → 4-dic | [ ] |
| Meta — Cali | [PRESUPUESTO] | 20-nov → 4-dic | [ ] |
| Meta — Retargeting (todas) | [PRESUPUESTO] | desde 23-nov | [ ] |
| Google — Search | [PRESUPUESTO] | 20-nov → 4-dic | [ ] |
| **Total** | | | **[PRESUPUESTO TOTAL]** |

Sugerencia de reparto inicial: 60 % Meta (el video es el que vende), 40 % Google (intención alta, pero
poco volumen de búsqueda esperado). Reasignar cada lunes según el costo por sede creada.

---

## A. Meta Ads (Instagram + Facebook)

### Estructura

- **Campaña 1 — Conversaciones (clic a WhatsApp)** · objetivo *Interacción → Mensajes* · destino: WhatsApp
  comercial +57 320 268 3539 con mensaje precargado «Hola, quiero crear mi sede de canchas» · conjuntos por
  ciudad.
- **Campaña 2 — Registros** · objetivo *Clientes potenciales / Conversiones* hacia `/canchas` con el evento
  «sede creada» · conjuntos por ciudad. Se activa cuando el evento tenga datos (si no, Meta no optimiza).
- **Campaña 3 — Retargeting** · quienes vieron ≥ 50 % de R09/R10, visitaron `/canchas` o `/calculadora` y no
  crearon sede (últimos 30 días) · destino `/canchas`.

### Públicos por ciudad

Meta ya no permite segmentar bien por cargo en Colombia; se combina ubicación precisa + intereses +
comportamiento de administradores de páginas.

| Conjunto | Ubicación | Edad | Intereses / comportamiento (validar que existan en el administrador) |
|---|---|---|---|
| Bogotá | Bogotá + radio 15 km de Soacha, Chía, Cota, Funza, Mosquera | 25–60 | Fútbol, fútbol 5, futsal, gestión de pequeñas empresas, emprendimiento, administradores de páginas de negocio, WhatsApp Business |
| Medellín | Área metropolitana del Valle de Aburrá (Medellín, Envigado, Itagüí, Sabaneta, Bello, La Estrella) | 25–60 | Igual |
| Cali | Cali + Jamundí, Yumbo, Palmira | 25–60 | Igual |
| Lookalike (desde 2.ª semana) | Las 3 ciudades | 25–60 | 1 % parecido a «sedes creadas» + lista de prospectos que respondieron (solo si se cargan con consentimiento) |
| Escuelas actuales | — | — | **No se paga para ellas:** se les escribe directo (canal de WhatsApp y equipo). |

Exclusiones: personas que ya crearon sede (lista de clientes actualizada cada semana), empleados de
SportMaps.

### 5 textos de anuncio

Todos con creativo de video. Titular ≤ 40 caracteres; texto principal corto.

**A1 · Bot (creativo R09 completo)**
- Texto: «Tu cancha se reserva y se cobra sola por WhatsApp. Sin comisiones, sin dobles reservas, sin cuaderno.
  Gratis hasta 2 canchas.»
- Titular: «Crea tu sede gratis»
- Botón: Enviar mensaje de WhatsApp / Registrarte

**A2 · No-show (creativo R02 o R13 tras H5)**
- Texto: «¿Cuánto te cuesta cada equipo que no llega? Con SportMaps Canchas reservan pagando el abono por
  WhatsApp y les llega un recordatorio 2 horas antes.»
- Titular: «Que no te dejen la cancha vacía»
- Botón: Más información → `/calculadora` (en retargeting) o `/canchas`

**A3 · Medianoche (creativo R01-B / R10)**
- Texto: «Deja de contestar "¿hay cancha?" a las 11 de la noche. Tu cliente ve las horas libres, reserva y
  paga solo. Tú ves la agenda en el celular.»
- Titular: «Tu cancha atiende sola»
- Botón: Enviar mensaje

**A4 · Sin comisión (creativo R11 anuncio)**
- Texto: «Tus jugadores pagan la cancha y nada más: sin tarifa de servicio. Tú pagas una mensualidad fija y
  el bot no tiene tope de reservas. Primeros 50 clubes: 3 meses de Pro gratis.»
- Titular: «Sin comisión al jugador»
- Botón: Registrarte
- `<!-- VERIFICAR: cupos restantes de la promo; apagar el anuncio cuando se acaben. -->`

**A5 · 5 minutos (creativo R08 final)**
- Texto: «Canchas, horarios, precios y cómo cobras. En 5 minutos tienes tu link de reservas listo para
  mandar por WhatsApp.» (Ajustar «5 minutos» al tiempo real cronometrado.)
- Titular: «Crea tu sede en 5 minutos»
- Botón: Registrarte

### KPIs y reglas de corte (Meta)

| KPI | Cómo se mide | Umbral para seguir | Regla de corte |
|---|---|---|---|
| Retención del video (ThruPlay / 3 s) | Administrador de anuncios | Hook rate ≥ [__] % | Anuncio con hook rate bajo el umbral tras [__] impresiones → se apaga y se prueba otro hook |
| Costo por conversación iniciada | Administrador | ≤ [CPC OBJETIVO] | > 2× objetivo durante 3 días → se pausa el conjunto |
| % conversaciones → sede creada | Hoja de prospectos + UTMs | ≥ [__] % | Si es bajo, el problema es el guion comercial, no el anuncio |
| **Costo por sede creada** | Gasto / sedes con UTM o «¿Cómo nos conociste?» | ≤ [CPA OBJETIVO] | **Conjunto sin sedes creadas en 14 días → se apaga** (plan §5.4) |
| Costo por sede con 1.ª reserva | Base | ≤ [__] | Se revisa el 4-dic |
| Frecuencia | Administrador | ≤ 3 por semana | > 4 → rotar creativo |

`<!-- DECIDIR: CPA objetivo. Referencia útil: un cliente Pro paga $99.000/mes; definir cuántos meses de
ingreso se está dispuesto a gastar por sede creada que llegue a pagar. -->`

---

## B. Google Ads (Search)

### Estructura

- **Campaña Search — Software canchas** · ubicación: Bogotá, Medellín, Cali (+ área metropolitana) · idioma
  español · solo Red de Búsqueda (sin Display) · puja inicial: maximizar clics con CPC máximo
  `[CPC MÁX]` hasta tener 15–30 conversiones; luego maximizar conversiones.
- **Grupos de anuncios:** (1) software / sistema de reservas, (2) WhatsApp / bot, (3) competencia de marca
  — **solo si el fundador lo decide** `<!-- DECIDIR -->`, (4) administración de canchas sintéticas.
- Extensiones: enlaces a `/canchas`, `/calculadora`, `/comparar/controla-cancha`, `/blog/plantilla-politica-cancelacion-canchas`;
  extensión de llamada/WhatsApp al número comercial; textos destacados («Sin comisión al jugador», «API
  oficial de WhatsApp», «Gratis hasta 2 canchas»).

### Palabras clave

Volúmenes de búsqueda no verificados: revisar en el Planificador de palabras clave antes de lanzar.

**Grupo 1 · Software / sistema de reservas → `/canchas`**

| Coincidencia exacta | Frase |
|---|---|
| [software canchas sinteticas] | "software para canchas sinteticas" |
| [software para canchas] | "sistema de reservas canchas" |
| [sistema de reservas cancha] | "programa para alquiler de canchas" |
| [app para reservar canchas] | "aplicacion reservas canchas" |
| [agenda canchas sinteticas] | "administrar cancha sintetica" |
| [programa para canchas de futbol] | "reservas canchas de futbol" |

**Grupo 2 · WhatsApp / bot → `/canchas` (sección WhatsApp)**

| Exacta | Frase |
|---|---|
| [reservas cancha whatsapp] | "bot whatsapp reservas" |
| [bot de whatsapp para canchas] | "reservar cancha por whatsapp" |
| [chatbot reservas canchas] | "whatsapp para canchas sinteticas" |

**Grupo 3 · Competencia (opcional)** → `/comparar/<competidor>`

| Exacta | Frase |
|---|---|
| [controla cancha] | "controla cancha precios" |
| [alternativa easycancha] | "easycancha para clubes" |
| [playtomic manager colombia] | "alternativa a playtomic" |

Los anuncios de este grupo **no usan el nombre del competidor en el texto** (políticas de marca de Google y
justicia); llevan a la comparativa honesta.

**Grupo 4 · Gestión del negocio → blog**

| Frase | Destino |
|---|---|
| "como cobrar abono cancha" | `/blog/cobrar-abono-cancha-sintetica` |
| "politica de cancelacion cancha" | `/blog/plantilla-politica-cancelacion-canchas` |
| "cuanto cobrar hora cancha sintetica" | `/blog/precio-hora-cancha-sintetica-bogota-medellin-cali` |
| "negocio de canchas sinteticas" | `/blog/montar-negocio-canchas-sinteticas-numeros` |

### Palabras clave negativas (nivel campaña)

Evitan pagar por jugadores que buscan dónde jugar, empleo o construcción:

`alquiler cancha cerca`, `cancha sintetica cerca de mi`, `reservar cancha hoy`, `canchas sinteticas en`
(+ barrio), `donde jugar futbol`, `precio grama sintetica`, `instalacion grama sintetica`, `construccion
cancha`, `venta cancha`, `arriendo local`, `empleo`, `trabajo`, `vacante`, `curso`, `gratis descargar`,
`apk`, `mod`, `crack`, `excel plantilla gratis` `<!-- evaluar: puede traer dueños; dejar fuera al inicio -->`,
`fifa`, `juego`, `partido en vivo`, `resultados`, `escuela de futbol para niños` (si se busca como padre),
`padel` (hasta la semana 6), `tenis`, `golf`.

Revisar el informe de términos de búsqueda **cada 2–3 días** y sumar negativas.

### 5 anuncios de búsqueda adaptables (RSA)

Cada uno con 3–4 titulares fijos de esta lista + descripciones. Titulares ≤ 30 caracteres, descripciones ≤ 90.

**Titulares (pool):**
1. Software para Canchas
2. Reservas por WhatsApp
3. Sin Comisión al Jugador
4. Gratis Hasta 2 Canchas
5. Cero Dobles Reservas
6. API Oficial de WhatsApp
7. Cobra el Abono en Línea
8. Crea tu Sede en 5 Minutos
9. Adiós al Cuaderno
10. Canchas Pro: $99.000/mes

**G1 · Genérico:** T1 + T2 + T4 · D: «Tu cancha se reserva y se cobra sola por WhatsApp. Sin comisiones, sin
dobles reservas.» · «Agenda en el celular, abono en línea y comprobantes leídos con IA.»

**G2 · WhatsApp:** T2 + T6 + T9 · D: «Bot sobre la API oficial de Meta: tu número no corre riesgos.» ·
«Horas libres, reserva y pago del abono en el mismo chat.»

**G3 · Precio:** T3 + T4 + T10 · D: «Plan gratis sin tiempo límite. Pro sin tope de reservas por WhatsApp.» ·
«Primeros 50 clubes: 3 meses de Pro gratis.» `<!-- VERIFICAR promo -->`

**G4 · Doble reserva:** T5 + T1 + T7 · D: «Web, bot y recepción comparten una sola agenda: dos reservas no
pueden chocar.» · «Política de cancelación visible antes de pagar.»

**G5 · Rapidez:** T8 + T9 + T4 · D: «Canchas, horarios, precios y cómo cobras. Tu link listo en minutos.» ·
«Te ayudamos por WhatsApp: +57 320 268 3539.»

### KPIs y reglas de corte (Google)

| KPI | Umbral | Regla |
|---|---|---|
| CTR | ≥ [__] % | Palabra clave con CTR bajo y > [__] impresiones → se pausa |
| CPC promedio | ≤ [CPC MÁX] | — |
| Tasa de conversión a sede creada | ≥ [__] % | Grupo sin conversiones tras [__] clics → se pausa |
| **Costo por sede creada** | ≤ [CPA OBJETIVO] | **Grupo sin sedes creadas en 14 días → se apaga** |
| Cuota de impresiones | — | Si es muy baja por presupuesto en el grupo 1, subir antes que abrir grupos nuevos |

---

## C. Destinos

| Destino | Para qué | Requisito para usarlo |
|---|---|---|
| `sportmaps.co/canchas` | Producto, precios, CTA «Crea tu sede gratis» | Vivo el 20-nov con evento de conversión |
| WhatsApp +57 320 268 3539 (mensaje precargado) | Conversaciones (Meta) | Alguien atendiendo en horario laboral; respuesta < 15 min |
| `sportmaps.co/calculadora` | Retargeting y anuncios de no-show | Modo no-shows vivo `<!-- VERIFICAR -->` |
| `sportmaps.co/comparar/<competidor>` | Grupo 3 de Google | Comparativas publicadas (plan §3.E, 2–13 nov) |
| `sportmaps.co/canchas/<ciudad>` | Pruebas A/B por ciudad (semana 2) | Directorio con clubes reales |
| Artículos del blog | Grupo 4 | Publicados según su fecha |

## D. Rutina semanal (lunes)

1. Bajar gasto, conversaciones, sedes creadas y sedes con reserva por campaña / conjunto / anuncio.
2. Aplicar reglas de corte.
3. Reasignar presupuesto al conjunto con menor costo por sede creada.
4. Subir 1–2 creativos nuevos de los Reels de la semana con mejor retención orgánica.
5. Revisar términos de búsqueda y sumar negativas.
6. Anotar el resultado en el tablero semanal (plan §7).
