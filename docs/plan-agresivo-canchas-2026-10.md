# Plan agresivo — SportMaps Canchas

**Fecha:** 2026-10-14 · **Diseño técnico:** [`specs/reservas-canchas-plan-unificado-2026-10.md`](specs/reservas-canchas-plan-unificado-2026-10.md) (v0.3)
**Meta:** en **6 semanas**, SportMaps vende alquiler de canchas mejor que Controla Cancha y lo cuenta en todos
los canales. Somos el único ecosistema que une **escuela + canchas + torneos + tienda + cobros + WhatsApp**
en una cuenta. Hay que decirlo y mostrarlo.

---

## 1. La jugada

Controla Cancha salió hace días (términos del 11-oct, **una sola sede publicada**). La ventana está abierta
y se cierra en meses.

| | Controla Cancha | **SportMaps Canchas** |
|---|---|---|
| Reserva sin cuenta por WhatsApp y web | Sí, pero **sin verificar el número** | Sí, con número verificado |
| WhatsApp | Sesión no oficial (riesgo de bloqueo del número) | **API oficial de Meta** |
| Cobro | Solo transferencia + foto | **Wompi / MP en línea** + transferencia leída con IA + efectivo |
| Pago dividido entre jugadores | No | **Sí** |
| Política de cancelación y reembolso | Texto libre | **En el sistema**, visible antes de pagar |
| No-show | Marca manual | Faltas acumuladas + abono obligatorio automático |
| Socio vs público | No | Reglas y precios por segmento |
| Doble reserva simultánea | No garantizado | **Imposible por diseño** (lo impide la base) |
| Escuela, torneos, tienda, contabilidad | Producto aparte o no tiene | **Todo en la misma cuenta** |
| Precio | $149k / $249k / $399k, con tope de reservas con IA | Ver §4 (más barato, sin tope) |

**Dónde pelear primero:** fútbol sintético, coliseos y clubes que ya usan SportMaps. No el pádel, donde
Easycancha dice tener ~90 % de los clubes; llegamos ahí en la semana 6 con los diferenciales ya probados.

---

## 2. Calendario (hitos con fecha)

| Hito | Fecha | Qué significa |
|---|---|---|
| **H0 — Arranque** | jue 15-oct | Decisiones D1, D2 y D9 cerradas; ramas y tableros listos |
| **H1 — Base lista** | mié 21-oct | F0 aplicada y verificada en vivo; tabla de ocupación con EXCLUDE funcionando |
| **H2 — Paridad con Controla Cancha** | vie 30-oct | Un club puede: publicar canchas y precios, recibir reservas en `/reservar/:slug`, cobrar abono por transferencia con IA y operar la agenda |
| **H3 — Piloto cobrando** | vie 6-nov | Bot de WhatsApp reservando + Wompi en línea, con **un club real** |
| **H4 — Lanzamiento público** | vie 20-nov | Landing de Canchas, directorio por ciudad, comparativas, campaña en redes al aire |
| **H5 — Diferenciales** | vie 27-nov | Pago dividido, reglas socio/público, lista de espera, canchas combinadas, no-show automático |
| **H6 — Operación completa** | vie 4-dic | Adicionales/tienda, caja por sede, reportes de ocupación, tiqueteras; entrada al pádel |

Es la mitad del tiempo del plan v0.3 (10–11 semanas) porque se trabaja en **6 frentes en paralelo** (§3) y
porque se reusa lo que ya existe: pasarela por escuela, OCR de comprobantes, bot, OTP público y tienda v2.

---

## 3. Frentes en paralelo

Cada frente tiene su rama y su dueño, sea persona o agente.
- Las **migraciones las aplica una sola sesión** (frente A). Los demás frentes trabajan contra el contrato de
  las RPCs, no contra la base.
- Los tipos se regeneran una vez por lote (regla de Disk IO).

### A. Base de datos y RPCs (camino crítico)

| Semana | Entrega |
|---|---|
| 15–21 oct | F0: verificar en vivo lo citado en el spec §1; `school_type` normalizado; enum `facility_manager` (sola, primero); `facility_occupancy` + EXCLUDE + backfill; columnas de `facility_reservations`; `payment_category 'reserva'`; cerrar H1–H4; revocar INSERT directo |
| 22–28 oct | `disponibilidad_canchas`, `reservar_cancha`, `confirmar_pago_reserva`, `cancelar_reserva`, `reprogramar_reserva`, `expirar_holds` (pg_cron), `facility_rates` con festivos, blackouts, políticas, `guest_bookers`. **Pruebas de concurrencia:** 50 reservas simultáneas a la misma franja = 1 gana; la misma llave repetida 10 veces = 1 fila |
| 9–20 nov | Reglas por segmento, `facility_reservation_shares`, waitlist, `facility_links` (combinadas), strikes |

### B. BFF y pagos

| Semana | Entrega |
|---|---|
| 19–28 oct | Middleware `requireIdempotencyKey` + `requireEntitlement`; endpoints públicos y de admin; OTP por WhatsApp (correo de respaldo); transferencia → OCR v2 → estados en vivo (`validated / needs_review / duplicate / rejected / expired`) |
| 29 oct–6 nov | Prefijo `RSV` en Wompi y MP + webhooks; link con monto y expiración; conciliación de pagos tardíos; saldo a favor (registro) |
| 9–20 nov | Pago dividido con links por WhatsApp; cobro de saldo en sede |

### C. App (admin + página pública)

| Semana | Entrega |
|---|---|
| 19–30 oct | Onboarding «Club / Canchas» (canchas → horarios → precios → pagos, en 5 minutos); agenda en grilla con reserva rápida; cancha fija; `/reservar/:slug` (14 días, grilla de horas libres, precio final, política en una línea); `/r/:token` (estado, cancelar, reprogramar) |
| 2–20 nov | Recepción y contador; bandeja de comprobantes; marcar llegada/no-show; disputas; pago dividido en la UI |
| 23 nov–4 dic | Adicionales (tienda v2), caja por sede, reportes (ocupación por cancha y franja, ingreso por cancha-hora, no-show), tiqueteras (banco de horas) |

### D. Bot de WhatsApp

| Semana | Entrega |
|---|---|
| 26 oct–6 nov | Flujo `'reserva'` (lista interactiva → «Confirmo» → link o cuentas → comprobante por chat → confirmación); tool `get_court_availability`; cancelar y cambiar por chat; recordatorio 2 h antes con el saldo |
| 9–20 nov | Links de pago dividido; lista de espera por turnos de 15 min; aviso inmediato si el club bloquea una hora vendida |
| 23 nov+ | **Número de plataforma SportMaps:** «¿Dónde juego fútbol 5 hoy en Suba?» → busca entre clubes → link del club |

### E. Landing y SEO (repo `sportmap-maps-landing-page`)

| Semana | Entrega |
|---|---|
| 19–30 oct | Página **`/canchas`** (producto, precios, demo en video, CTA «Crea tu sede gratis»); calculadora «¿Cuánto pierdes por no-shows y horas vacías?» (se reusa `/calculadora`) |
| 2–13 nov | Endpoint público de venues → **el mapa deja los datos inventados** y muestra clubes reales; **`/clubes/:slug`** prerenderizadas con JSON-LD `SportsActivityLocation` + `ReserveAction`; **`/canchas/:ciudad`** (Bogotá, Medellín, Cali, Barranquilla, Bucaramanga) con «precio desde» |
| 2–13 nov | Comparativas `/comparar/controla-cancha`, `/comparar/easycancha`, `/comparar/playtomic` (mismo estándar honesto de las 9 que ya existen: nunca inventar precios); `llms.txt` / `llms-full.txt` / `llms-faq.txt` actualizados con Canchas; sitemap |
| continuo | 2 artículos de blog por semana (§5.2) |

### F. Redes, contenido y ventas

Ver §5 y §6. Arranca el **día 1**, no al final: el contenido de «cómo lo estamos construyendo» y la lista
de espera de clubes se llenan antes del lanzamiento.

---

## 4. Oferta y precio (propuesta para D9, decide el negocio)

Lógica: entrar **por debajo** de Controla Cancha en todos los tramos, **sin tope de reservas** y **sin cuota
al jugador**. El ingreso grande viene del combo con Academia y de los adicionales.

| Plan Canchas | Precio/mes | Canchas | Incluye |
|---|---|---|---|
| **Gratis** | $0 | hasta 2 | Página pública, agenda, transferencia con aprobación manual, efectivo. Sin bot |
| **Canchas Pro** | $99.000 | hasta 5 | + Bot de WhatsApp **sin tope**, comprobantes con IA, Wompi/MP, reglas, lista de espera, pago dividido |
| **Canchas Club** | $199.000 | ilimitadas, multisede | + Reportes avanzados, adicionales y caja, roles, número de plataforma |
| **Combo Academia + Canchas** | fórmula vigente `max(A,B) + 30 % min(A,B)` | | Precio de socio para alumnos y familias; la cancha se bloquea con las clases |

- **Lanzamiento:** los primeros 50 clubes tienen **3 meses de Canchas Pro gratis**.
- **Referidos:** el club que trae otro club recibe un mes gratis por cada uno (Controla da 20 %).
- **Riesgo a decidir:** el bot gasta LLM. Sin tope, hay que medir costo por reserva en el piloto. Si se
  dispara, el tope va en el plan Club, no en Pro.

---

## 5. Contenido

### 5.1 Mensaje (una sola frase, en todo lado)

> **«Tu cancha se reserva y se cobra sola por WhatsApp. Sin comisiones, sin dobles reservas, sin cuaderno.»**

Para el ecosistema: **«Escuela, canchas, torneos y tienda en una sola app. Y todo se cobra por WhatsApp.»**

Prueba visible en cada pieza: un video de 20 segundos con el bot reservando y cobrando de verdad (club
piloto, con permiso).

### 5.2 Blog / SEO (2 por semana, 12 en 6 semanas)

En orden. Cada uno ataca una búsqueda real y termina en «Crea tu sede gratis».

1. Cómo cobrar el abono de una cancha sintética sin perseguir a nadie
2. Software para canchas sintéticas en Colombia: comparativa honesta 2026
3. Plantilla de política de cancelación para canchas (descargable, a cambio de un lead)
4. Cuánto cobrar por hora de cancha sintética en Bogotá, Medellín y Cali (datos reales del directorio)
5. Cómo acabar con los no-shows en tu cancha
6. Bot de WhatsApp para reservar canchas: oficial vs no oficial (y por qué te pueden bloquear el número)
7. Turnos fijos: cómo llenar tus martes con equipos de empresa
8. Pago dividido: que cada jugador pague su parte
9. Cómo montar un negocio de canchas sintéticas: números reales
10. Festivos, lluvia y mantenimiento: cómo avisar sin perder clientes
11. Escuela + canchas: cómo ganar plata con las horas que no usan tus equipos
12. Torneos relámpago en tu cancha: cómo organizarlos y cobrarlos

### 5.3 Redes (5 piezas por semana desde el 15-oct)

| Canal | Formato | Frecuencia | Ejemplos |
|---|---|---|---|
| **Instagram + TikTok** (Reels) | Videos de 15–30 s | 3/semana | «El cuaderno de reservas vs SportMaps»; el bot reservando en tiempo real; «Lo que pierdes cada vez que alguien no llega» (cifras de la calculadora); dueño de cancha contando su caso |
| **Instagram** (carrusel) | 5–7 láminas | 1/semana | «5 errores que te hacen perder plata en tu cancha»; plantilla de política; comparativa de precios |
| **LinkedIn** (fundador) | Post en primera persona | 2/semana | Construcción en público: «Hoy hicimos imposible la doble reserva»; métricas del piloto; por qué WhatsApp oficial |
| **Canal de WhatsApp SportMaps** | Novedades + tips | 1/semana | Para dueños de clubes y escuelas |
| **Google Business** de cada club piloto | Link «Reservar» a `/reservar/:slug` | al activar | Es el canal de reserva más usado y es gratis |

**Producción:** se graba en la app real, nunca con maquetas. Una tarde por semana se graban 5 piezas, con
plantillas de edición fijas (intro de 2 s con la marca, subtítulos siempre y CTA final).

### 5.4 Pauta (desde H4, 20-nov)

- **Meta Ads:** público de dueños y administradores de canchas y gimnasios, segmentado por ciudad. Creativo =
  el video del bot. Objetivo: conversación por WhatsApp al número comercial (+57 320 268 3539).
- **Google Ads:** «software canchas sintéticas», «reservas cancha whatsapp», «sistema de reservas cancha».
  Destino: `/canchas`.
- Presupuesto inicial a decidir; se corta lo que no traiga sedes creadas en 2 semanas.

---

## 6. Ventas directas (lo que más rinde al principio)

1. **Lista de prospectos:** canchas sintéticas, coliseos y clubes de Bogotá, Medellín y Cali, sacadas de
   OSM y Google Maps. La landing ya carga instalaciones de OSM en `mapData.entidades.ts`. Meta: **300
   prospectos** con nombre, teléfono y número de canchas.
2. **Base propia primero:** las escuelas que ya usan SportMaps y tienen instalaciones. Se activa el toggle
   «Alquilar mis canchas» = **hybrid**. Son las más fáciles de convertir: ya confían y ya cobran con nosotros.
3. **WhatsApp comercial:** secuencia de 3 mensajes con el video del bot y el link «Crea tu sede gratis».
4. **Visitas en campo:** 10 canchas por semana en una ciudad. Se crea la sede **con el dueño, en su celular,
   en 5 minutos**.
5. **Club piloto (D12):** uno de fútbol sintético con Wompi propio. A cambio de 6 meses gratis: video
   testimonial, caso de estudio y el permiso de usar sus datos (anonimizados) en el contenido.

---

## 7. Métricas (tablero semanal)

| Métrica | Meta al 4-dic |
|---|---|
| Sedes creadas | 60 |
| Sedes con al menos 1 reserva real | 25 |
| Reservas por semana | 500 |
| % de reservas pagadas en línea o con comprobante validado | 70 % |
| Dobles reservas | **0** (las audita la base) |
| Clubes pagando o en trial Pro | 40 |
| Escuelas actuales que activaron canchas | 10 |
| Leads de contenido (plantillas, calculadora) | 300 |

---

## 8. Riesgos que pueden hacer caer el plan

| Riesgo | Mitigación |
|---|---|
| **Disk IO de Supabase Free** (caída de ~14 h el 14-oct). Una sola base para dev/stg/prod; reservas públicas y bot suman lecturas | **Pasar Supabase a Pro antes de H3** (6-nov). La disponibilidad pública va cacheada y el bot no consulta en bucle. Las migraciones las aplica una sola sesión |
| Plantilla de autenticación de WhatsApp no aprobada a tiempo | Correo de respaldo desde el día 1 |
| Club piloto sin Wompi conectado | Transferencia con IA funciona sin pasarela; Wompi se conecta en paralelo |
| Costo del LLM sin tope de reservas | Las horas libres las calcula el código; el LLM solo detecta la intención. Se mide en el piloto |
| Velocidad vs calidad: romper cobros vivos de escuelas | Ramas por frente, pruebas de concurrencia en la base y `seguridad:invariantes` al cierre de cada lote. Nada toca `main` sin el visto del dueño |
| Contenido que promete lo que aún no existe | Regla: **solo se publica lo que corre en la app**. Lo que viene se dice como «próximamente» con fecha |

---

## 9. Decisiones (cerradas 2026-10-14)

| # | Decisión | Resultado |
|---|---|---|
| D1 | Evolucionar `facility_reservations` + tabla de ocupación | Sí (base recomendada) |
| D2 | Mapeo de `school_type` | gimnasio → venue, escuela → academy, club → hybrid si tiene equipos, si no venue (se confirma con los datos vivos en F0) |
| D9 | Precios | **Gratis (≤2) / Canchas Pro $99k (≤5, bot sin tope) / Canchas Club $199k (ilimitadas)**; 3 meses Pro gratis a los primeros 50 |
| D12 | Club piloto | **Una cancha sintética nueva** (no una escuela actual). Hay que conseguirla esta semana: entra al frente F (§6) como prioridad 1 |
| D15 | Sin cuota al jugador | Sí |
| — | Supabase Pro antes del 6-nov | **Sí** |
| — | Arranque | **F0 y landing/contenido en paralelo** desde el 14-oct |
