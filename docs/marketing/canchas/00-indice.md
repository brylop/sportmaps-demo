# Kit de contenido y ventas — SportMaps Canchas

**Fecha:** 2026-10-14 · **Fuente:** [`docs/plan-agresivo-canchas-2026-10.md`](../../plan-agresivo-canchas-2026-10.md)
(§2 fechas, §4 precio, §5 contenido, §6 ventas) y el benchmark verificado de
[`docs/specs/reservas-canchas-plan-unificado-2026-10.md`](../../specs/reservas-canchas-plan-unificado-2026-10.md) §10.
**Estado:** todo es **borrador**. Nada se ha publicado ni enviado.

> **Mensaje único:** «Tu cancha se reserva y se cobra sola por WhatsApp. Sin comisiones, sin dobles
> reservas, sin cuaderno.»
> **Ecosistema:** «Escuela, canchas, torneos y tienda en una sola app. Y todo se cobra por WhatsApp.»

## Qué hay en el kit

| Archivo | Qué es | Quién lo usa |
|---|---|---|
| [`01-calendario-redes-15oct-4dic.md`](01-calendario-redes-15oct-4dic.md) | Calendario día a día (IG/TikTok, carruseles, LinkedIn, canal de WhatsApp) alineado con H0–H6, y los textos del canal de WhatsApp | Quien publica |
| [`02-guiones-reels.md`](02-guiones-reels.md) | 15 guiones de Reels/TikTok con hook, tomas, texto, voz y CTA | Quien graba y edita |
| [`03-carruseles.md`](03-carruseles.md) | 6 carruseles lámina por lámina | Diseño |
| [`04-linkedin-fundador.md`](04-linkedin-fundador.md) | 10 posts en primera persona + plantilla de actualización semanal | Fundador |
| [`05-blog/`](05-blog/) | 12 artículos SEO completos (900–1400 palabras), con frontmatter de SEO | Landing (`sportmap-maps-landing-page`) |
| [`06-ventas-whatsapp.md`](06-ventas-whatsapp.md) | Secuencia de primer contacto, objeciones, guion de visita, oferta del club piloto | Comercial |
| [`07-pauta.md`](07-pauta.md) | Meta Ads y Google Ads: públicos, anuncios, palabras clave, negativas, KPIs y reglas de corte | Pauta (desde 20-nov) |
| [`08-prospeccion.md`](08-prospeccion.md) | Cómo armar la lista de 300 prospectos: fuentes, consulta Overpass, columnas, calificación, cadencia | Comercial |

### Blog (orden de publicación, 2 por semana desde el lanzamiento)

| # | Archivo | Publicar desde |
|---|---|---|
| B01 | [`01-cobrar-abono-cancha-sintetica.md`](05-blog/01-cobrar-abono-cancha-sintetica.md) | 20-nov |
| B02 | [`02-software-canchas-sinteticas-colombia-comparativa.md`](05-blog/02-software-canchas-sinteticas-colombia-comparativa.md) | 20-nov |
| B03 | [`03-plantilla-politica-cancelacion-canchas.md`](05-blog/03-plantilla-politica-cancelacion-canchas.md) | 24-nov |
| B04 | [`04-precio-hora-cancha-sintetica-bogota-medellin-cali.md`](05-blog/04-precio-hora-cancha-sintetica-bogota-medellin-cali.md) | 27-nov — **solo con los datos del directorio** |
| B05 | [`05-como-acabar-no-shows-cancha.md`](05-blog/05-como-acabar-no-shows-cancha.md) | 1-dic |
| B06 | [`06-bot-whatsapp-reservar-canchas-oficial-vs-no-oficial.md`](05-blog/06-bot-whatsapp-reservar-canchas-oficial-vs-no-oficial.md) | 3-dic |
| B07 | [`07-turnos-fijos-cancha-equipos-empresa.md`](05-blog/07-turnos-fijos-cancha-equipos-empresa.md) | 8-dic |
| B08 | [`08-pago-dividido-cancha-cada-jugador-paga.md`](05-blog/08-pago-dividido-cancha-cada-jugador-paga.md) | 10-dic |
| B09 | [`09-montar-negocio-canchas-sinteticas-numeros.md`](05-blog/09-montar-negocio-canchas-sinteticas-numeros.md) | 15-dic |
| B10 | [`10-festivos-lluvia-mantenimiento-avisar-clientes-cancha.md`](05-blog/10-festivos-lluvia-mantenimiento-avisar-clientes-cancha.md) | 17-dic |
| B11 | [`11-escuela-deportiva-alquilar-canchas-horas-libres.md`](05-blog/11-escuela-deportiva-alquilar-canchas-horas-libres.md) | 22-dic |
| B12 | [`12-torneos-relampago-cancha-organizar-cobrar.md`](05-blog/12-torneos-relampago-cancha-organizar-cobrar.md) | 29-dic |

Al pasarlos a la landing, siguen el formato de `frontend/src/lib/blog/*.ts` del repo de la landing y entran
al sitemap y a `llms.txt` (plan §3.E).

## Cómo usar el kit

1. **Cada semana (jueves):** revisar en el calendario qué sale la semana siguiente y **qué hito necesita**.
   Si el hito no se cumplió, la pieza se corre y se reemplaza por una de problema o de fundador.
2. **Grabar** los 3 Reels de la semana en una tarde, con la plantilla de edición fija (`02` intro).
3. **Antes de publicar cualquier pieza:** pasar el checklist de abajo y resolver sus comentarios
   `<!-- VERIFICAR -->` y `<!-- DECIDIR -->` (búscalos con `grep -rn "VERIFICAR\|DECIDIR" docs/marketing/canchas`).
4. **Ventas** corre en paralelo desde el día 1: `08` arma la lista, `06` le habla.
5. **Pauta** solo desde el 20-nov y con la medición de `07` instalada.
6. **Lunes:** pasar los números al tablero semanal (plan §7) y ajustar.

## Reglas de publicación (obligatorias)

1. **Solo se publica lo que corre en la app** (plan §8). Lo que viene se dice «próximamente» con fecha.
2. **Antes del 20-nov** todo es **construcción en público** o **lista de espera**: nunca «ya puedes», «ya
   funciona», «nuestros clientes». Lo que se muestre de la app se rotula **«versión en pruebas»** o
   **«piloto»**.
3. **Desde el 20-nov** se describe como vivo solo lo que esté activo ese día (H5 = 27-nov, H6 = 4-dic).
4. **Se graba en la app real**, nunca con maquetas. Las «ilustraciones» (p. ej. una pantalla de bloqueo de
   WhatsApp) se rotulan como tales.
5. **Cero testimonios, clientes o estadísticas inventadas.** Los números van como `[DATO PILOTO]`,
   `[DATO DIRECTORIO]`, `[DATO]` hasta que salgan de la app o del tablero. Los ejemplos se rotulan
   «ejemplo» con sus supuestos a la vista. Una pieza con corchetes sin llenar **no se publica**.
6. **Competencia:** solo los hechos verificados del spec §10 (al 14-oct-2026), con la fuente. Nunca
   inventar sus precios ni sus cifras. Reconocer lo que hacen bien. En Reels y carruseles **no se nombra a
   competidores**; la comparación con nombre va en el blog y en `/comparar`, donde cabe el matiz. Antes de
   publicar una comparativa, **volver a revisar** que los datos sigan vigentes.
7. **Personas en cámara** (dueños, jugadores, recepción): autorización de imagen firmada. Números de
   teléfono, nombres de terceros y comprobantes se difuminan siempre.
8. **Promociones** («primeros 50 clubes, 3 meses de Pro gratis», «6 meses al piloto»): se publican solo si
   están confirmadas y configuradas en el producto, y se apagan cuando se acaben los cupos.
9. **Tono:** español de Colombia, tuteo. Nunca «vos», «che» ni voseo.
10. **Legal:** plantillas de política, reembolsos y temas de negocio llevan «valídalo con tu abogado /
    contador». Prospección y mensajes en frío, según `06` y `08` (uno a uno, con opción de salir).

## Checklist antes de publicar una pieza

- [ ] Su fecha «publicable desde» ya llegó y el hito del que depende está **verificado en vivo**.
- [ ] Todo lo que se muestra o se afirma existe hoy en la app.
- [ ] Sin corchetes `[ ]` sin llenar ni comentarios `VERIFICAR`/`DECIDIR` abiertos.
- [ ] Cifras con fuente (app, tablero o spec §10) o rotuladas «ejemplo».
- [ ] Autorizaciones de imagen y de uso de datos del club, si aplica.
- [ ] Link correcto con UTM (lista de espera antes del 20-nov; `/canchas` después).
- [ ] Subtítulos, intro de marca y lámina de CTA.

## Enlaces que usa el kit

| Uso | Enlace |
|---|---|
| Lista de espera (antes del 20-nov) | `[LINK LISTA DE ESPERA]` — propuesta: `https://wa.me/573202683539?text=CANCHAS` |
| Producto (desde el 20-nov) | `https://sportmaps.co/canchas` |
| Calculadora | `https://sportmaps.co/calculadora` (verificar el modo «no-shows y horas vacías») |
| Comparativas | `/comparar/controla-cancha`, `/comparar/easycancha`, `/comparar/playtomic` |
| Directorio | `/canchas/bogota`, `/canchas/medellin`, `/canchas/cali` |
| WhatsApp comercial | +57 320 268 3539 |
