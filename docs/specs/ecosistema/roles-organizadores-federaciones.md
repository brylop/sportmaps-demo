# Ecosistema: organizadores, escuelas anfitrionas, federaciones y participantes

**Fecha:** 2026-10-14 · **Tipo:** investigación estratégica, sin código.
**Fuentes:** lectura del repo (`frontend`, `bff`, `supabase/migrations`, `types.ts`), del repo de la landing y de la web (competencia). **No se consultó la base viva.** Lo que dice "según `types.ts`" puede estar desfasado: `types.ts` se regenera a mano. Por ejemplo, todavía no trae `facility_occupancy`.

**Roles en alcance:** `organizer` (organizador de torneos y eventos), escuela que hace de anfitriona, federaciones, ligas y asociaciones (`schools.school_type` tiene 79 `federation` y 10 `association`, casi todas importadas del directorio OSM) y atletas o equipos que se inscriben.

---

## A. Inventario: qué existe hoy

### A.1 Torneos de escuela (rol `school` / `school_admin`), el camino vivo

| Capacidad | Estado | Evidencia |
|---|---|---|
| Crear torneo interno o externo, con categorías y fases de precio | ✅ **Existe y está conectado** | `POST /events/school-tournament` (`events.route.ts:284`) escribe `creator_role='school'` y `school_id`, con gate del addon `tournaments` · `CreateTournamentPage`, `SchoolTournamentsPage`, `SchoolTournamentDetailPage` (691 líneas) |
| Publicar, editar, categorías, fases de precio | ✅ Conectado | `:474`, `:598`, `:624`, `:664` |
| Invitar escuelas externas por enlace con token y reclamo | ✅ Conectado | `:710–:778` · migraciones `20260903130451` y `20260903131025` |
| Delegaciones: aprobar o rechazar, registrar pago, comprobante | ✅ Conectado | `:781–:976` (pago manual por comprobante; según el spec, `event_delegation_payments` nunca tuvo uso real en producción) |
| Inscripción individual a la liga interna (acudiente o atleta), cobrada en `payments` | ✅ Conectado | `:977–:1066` · `TournamentRegisterPage` · migraciones `20260901114532` a `20260903103757` |
| Inscripción de la escuela con roster (`event_team_members`) | ✅ Conectado | `:1212` (reemplaza el roster, es idempotente) · `EventEnrollmentPage` |
| Fixture automático: **liga** (todos contra todos) y **copa** (eliminación simple con byes) | ✅ Conectado | `:1373` `generate-fixtures`, `format: 'liga'|'copa'` |
| Partidos, marcador, goleadores, tarjetas (`tournament_match_events`: goal/own_goal/yellow/red/assist) | ✅ Conectado | `:1449`, `:1505` · `20260716000002_tournament_matches.sql` |
| Tabla de posiciones y resultados públicos | ✅ Conectado | `:1535` standings · `:1589` public-results · `/tournaments/:eventId/results` (`TournamentResultsPage`, 85 líneas, básica) |
| Menú "Mis Torneos" filtrado por el addon `tournaments` | ✅ | `navigation.ts:206` |
| **Registro liviano** para una academia sin cuenta, y **roster por Excel** con `dry_run` | ❌ **Solo spec** | Las fases 2 y 3 de `torneos-externos-registro-liviano-2026-09-03.md` no existen. No hay ruta `roster/dry-run` ni `roster/commit` |
| Grupos + eliminatoria (formato mundial), desempates configurables | ❌ No existe | Solo hay `liga` o `copa` puras |
| Sanciones (suspensión por acumulación de amarillas o por roja) | ❌ No existe | Las tarjetas se registran, pero ninguna regla las convierte en suspensión |
| Carné de jugador de torneo / verificación de edad con documento | 🟡 Parcial | El roster guarda `document_number` y `birth_year`. Los carnés digitales de la escuela existen, pero no se usan en torneos |
| Asignar partidos a canchas y horarios | ❌ No existe | Los partidos no tienen `facility_id` ni franja horaria. Ver §D.6 |
| Registro de partido y evaluación por jugador (fuera de torneos) | 🟡 F1 aplicada | `partidos-registro-y-evaluacion-por-jugador.md`: la F2 (BFF) está pendiente |

### A.2 Rol `organizer`: páginas con BFF roto

Hay 10 páginas bajo `OrganizerGuard` (`App.tsx:1047–1058`) y 9 entradas de menú (`navigation.ts:802–824`): dashboard, crear evento, mis eventos, calendario, finanzas, reportes, perfil y configuración.

**El bug conocido de `POST /api/v1/events` (`events.route.ts:114`) SIGUE ABIERTO.** El asistente `CreateEventPage` → `Step5PaymentConfig.tsx:58` lo llama, y al leer el código contra `types.ts` y las migraciones se ve que:

1. **No envía `creator_id` ni `creator_role`.** Ambos son obligatorios en el `Insert` de `events` (`types.ts:9188–9189`), así que el INSERT falla por `NOT NULL`.
2. **Envía `bank_data`, que no es columna de `events`.** Esa columna vive en `event_organizers` y en tablas financieras. PostgREST rechaza las columnas que no existen.
3. **Las categorías usan nombres viejos:** `min_age`, `max_age`, `min_athletes`, `max_athletes` y `base_price`. Los reales son `age_min`, `age_max`, `team_min` y `team_max`, y `base_price` no existe.
4. **Las fases de precio también:** `pkg_1_price`, `pkg_2_price`, `pkg_3_price`, `pkg_solo_price`, `crossover_price` y `deposit_percentage`. Los reales son `price_pkg1`, `price_pkg2`, `price_pkg3`, `price_solo`, `crossover_price_pkg` y `deposit_percent`.
5. **Los inserts de categorías y fases no revisan el error** y no van en una transacción. Aunque el evento se creara, se perderían los hijos en silencio. Esto viola la regla del repo de usar una RPC transaccional para crear varias filas.
6. Columnas como `kit_deadline_platino`, `coach_discount_usd` y `virtual_reg_start` **existen en la base pero no aparecen en ninguna migración**: son deriva de esquema sin versionar.

Otras rutas del organizador:

| Ruta | Estado |
|---|---|
| `POST /events/:id/register` (inscripción individual pública, `EventIndividualRegisterPage`) | Probablemente rota: inserta `package_choice`, que no figura en `event_registrations` según `types.ts:8601+` |
| `/mine`, `/:id/publish`, `PUT /:id`, `PATCH /:id/status`, delegaciones | Bien escritas, pero vacías: ningún evento tiene `organizer_id` (ROADMAP:550, "`events.organizer_id` siempre NULL") |
| `/organizer/profile`, `/stats`, `/finances` | Probablemente funcionan: las columnas faltantes de `event_organizers` se agregaron en `20260817131907` |

**Conclusión:** el rol organizador no puede crear su primer evento. Todo el panel queda vacío.

### A.3 Eventos públicos y participantes

- `/explorar?category=events` (mapa), `/event/:slug` y `GET /events` (públicos y publicados): ✅ conectados. Solo muestran lo que crean las escuelas.
- `/my-event-registrations` (`MyEventRegistrationsPage`): 🟡 lee `my-registrations/list`. Funciona para lo que entra por la liga interna.
- **Boletería, QR de entrada, check-in y aforo:** ❌ no existe nada en la app. No hay tabla de tickets ni ruta.

### A.4 Federaciones y ligas

- ❌ **No hay rol, menú ni pantalla.** Las 89 filas `federation`/`association` son fichas de directorio, eximidas del trial por `is_informational_entity()` (ROADMAP:1032).
- No existen afiliación club→liga, licencias ni vigencias, registro federado único ni calendario de temporada multi-club.

### A.5 Specs y roadmap

- `torneos-internos-inscripcion-pago-2026-09-01.md`: **construido**.
- `torneos-externos-registro-liviano-2026-09-03.md`: **a medias**. Las invitaciones están hechas; faltan el registro liviano, el Excel y el pago individual por integrante.
- ROADMAP `MOD-7` ("cerrar inscripción → bracket", 4 semanas): el bracket simple ya está hecho y la fila quedó desactualizada.
- Fila ROADMAP:1013 ("⚠️ verificar inscripción vs bracket"): la respuesta es que las dos cosas existen para escuelas.
- ROADMAP:1139: el sidebar solo mira `hasAddon('store')` para algunos módulos. Torneos sí está filtrado en `navigation.ts:206`, pero conviene verificarlo en la UI.
- `V2-0b`: queda voseo en `TournamentRegisterPage.tsx:81`.

---

## B. Landing: qué promete y qué no se entrega

| Página / dato | Promesa | Realidad | Riesgo |
|---|---|---|---|
| `config/saas-plans.ts` → addon **Torneos** ($49.000/mes, incluido en Elite y Enterprise) | "Americanos, brackets eliminatorios y ranking PWR" | Bracket simple: sí. **Americanos (pádel) y ranking PWR: no existen** | 🔴 Cambiar el texto |
| `Organizadores.tsx` | Boletería con QR, check-in en la puerta, control de aforo, abonos parciales con saldo en vivo, "conciliación 1-click" con Wompi | El organizador **no puede ni crear un evento**. No hay boletería, check-in ni abonos por evento | 🔴🔴 |
| `Organizadores.tsx:203`, testimonio | "Vendí 2.300 boletas con QR sin pagar comisión…" | La función no existe, así que el testimonio no puede ser real | 🔴🔴 **Retirar ya**: es un testimonio fabricado |
| `Organizadores.tsx:625` | "el plan por evento de SportMaps" | No hay plan por evento en `saas-plans` ni en la app | 🔴 |
| `Eventos.tsx` | Evento en 1 minuto, página pública, pin en el mapa, inscripción con nombre + WhatsApp + comprobante, "sin comisión" | Página pública y mapa: sí, pero solo para escuelas. Para el organizador individual el formulario está roto | 🟠 |
| `Federaciones.tsx:53–56`, cifras | "50+ federaciones activas, 1.000+ clubes, 100K+ atletas, 500+ torneos" | Las 89 fichas son importadas, ninguna es cliente. No hay módulo de federación | 🔴🔴 **Retirar las cifras** |
| `Federaciones.tsx` | Licencias, afiliaciones, renovaciones automáticas, registro federado | Nada de eso existe | 🔴 Pasar a "Próximamente / piloto" |
| `lib/combos.ts`: "Escuela Eventos", "Federación Pro + Organizador Pro" | Combos con módulos | "Organizador Pro" y "Federación Pro" no existen como producto que se pueda vender | 🟠 |

---

## C. Competencia (fuentes primarias, 2026-10-14)

| Competidor | Qué hace | Modelo de precio | Pagos CO / WhatsApp | Fuente |
|---|---|---|---|---|
| **Copa Fácil** | Fixture de liga, grupos o eliminatoria; llaves; tabla con desempates; tarjetas, sanciones y goleadores | Gratis con publicidad · "Personalizado" 4,70/mes (300 jugadores) · "Profesional" 10,30/mes (la página no dice la moneda) | NO CONFIRMADO | CONFIRMADO: copafacil.com/es/precios |
| **DeporteApp** | Academias: pagos, recibos, becas; WhatsApp para convocatorias y avisos; 30 días de prueba | NO CONFIRMADO (/precios da 404) | WhatsApp: CONFIRMADO. Módulo de federación: NO CONFIRMADO | CONFIRMADO: deporteapp.com |
| **Tournify** | Calendario, grupos + eliminatoria, marcador en vivo, inscripción con pago | **Por evento:** gratis hasta 8 equipos · €40 hasta 60 · €120 ilimitado | Pasarela local NO CONFIRMADA | CONFIRMADO: tournifyapp.com/en/pricing |
| **LeagueApps** (EE. UU.) | Ligas e inscripciones | **% por transacción**, sin suscripción, más cargo de implementación (el % no se publica) | Colombia: NO CONFIRMADO | CONFIRMADO: leagueapps.com/pricing |
| **Torneopal** | Programación e inscripción de equipos, foco en Reino Unido y Europa | Precios en GBP, EUR, AUD y USD | Sin presencia en CO (NO CONFIRMADO) | torneopal.com |
| **Challonge** | Llaves | NO CONFIRMADO (403) | — | — |
| **Playtomic Manager** | Ligas, torneos y clases "en pocos clics"; pago integrado de la inscripción; más de 63 países | NO CONFIRMADO | — | CONFIRMADO: playtomic.com/playtomic-manager |
| **EasyCancha** | Reservas con pago, 8 países con Colombia, membresía PRIME | Torneos: NO CONFIRMADO | — | CONFIRMADO: easycancha.com |
| **Eventbrite** | Boletería | 3,7% + 1,79 por entrada + 2,9% de procesamiento. La tarifa varía por país y la tabla **no incluye Colombia** | PSE: NO CONFIRMADO | CONFIRMADO: eventbrite.co/organizer/pricing |
| **TuBoleta** | Fútbol profesional, carreras (Family Run Medellín), puntos de venta | Comisión NO CONFIRMADA | — | CONFIRMADO: tuboleta.com |
| **Passline** | Autogestión de entradas | NO CONFIRMADO (403) | Reclamos por devoluciones (reclamos.cl, tuquejasuma.com) | De terceros |
| **Joinnus**, **Ticketsports/Matchsports CO** | Inscripciones y boletería | NO CONFIRMADO (los sitios no cargaron) | Ticketsport Chile paga al productor en unas 12 h (prensa) | — |
| **COMET / FIFA Connect** | Registro federado con FIFA ID. Lo usa la Liga de Fútbol de Bogotá | Institucional | — | CONFIRMADO: kb.analyticom.de |

**Lecturas:**

1. El fixture es casi gratis (Copa Fácil a 4,70/mes). **La plata no está en el fixture, está en la inscripción, el cobro y la operación.**
2. Ninguna herramienta de torneos confirma PSE, Nequi o Wompi en su fuente primaria. Los torneos pequeños en Colombia siguen con **"Nequi + comprobante por WhatsApp"**, y SportMaps ya tiene ese flujo con OCR de comprobantes y bot.
3. **Nadie une escuela + torneo + canchas.** Los de fixture no tienen jugadores ni cobro recurrente. Los de reservas (Playtomic, EasyCancha) apenas tocan torneos.
4. Las quejas visibles son de boletería: devoluciones y entradas que no llegan. La transparencia del dinero es un argumento de venta.

---

## D. Plan

### D.1 Brechas, en orden de gravedad

1. **Promesas falsas en la landing:** el testimonio de boletas, las cifras de federaciones, PWR y Americanos, y el plan por evento.
2. **El rol organizador no puede crear eventos** (POST `/` roto) y el registro individual público probablemente también falla.
3. Falta el **registro liviano + Excel** para academias invitadas sin cuenta. Es el caso de uso real de Besser.
4. Falta **grupos → eliminatoria**, sanciones automáticas y desempates.
5. Los partidos **no ocupan cancha** (no hay `facility_id` ni horario).
6. No hay boletería ni check-in.
7. No hay producto para federaciones.

### D.2 Top 10 mejoras (I = impacto, E = esfuerzo, de 1 a 5)

| # | Mejora | I | E | Nota |
|---|---|---|---|---|
| 1 | **Limpiar la landing**: retirar el testimonio y las cifras, corregir el addon Torneos y marcar "próximamente" | 5 | 1 | Riesgo legal y de confianza. Hacerlo ya |
| 2 | **Unificar el organizador sobre el camino de la escuela.** El organizador es un "anfitrión sin escuela": crear con `creator_role='organizer'` en una **RPC transaccional** (evento + categorías + fases), reusando el esquema de `school-tournament`. Borrar el POST `/` legado | 5 | 2 | Desbloquea todo el rol |
| 3 | **Registro liviano + roster por Excel** (spec del 09-03, fases 2 y 3) | 5 | 3 | Convierte a las academias invitadas en leads del SaaS |
| 4 | **Programar partidos en canchas** (`facility_id`, `starts_at`, `ends_at`, ocupación vía `facility_occupancy`) | 4 | 3 | Ver §D.6 |
| 5 | **Grupos + eliminatoria** y desempates configurables (diferencia de goles, enfrentamiento directo, fair play) | 4 | 3 | Paridad con Copa Fácil y Tournify |
| 6 | **Sanciones automáticas** desde `tournament_match_events`: suspensión por N amarillas o por roja, y bloqueo en la planilla | 3 | 2 | Aprovecha datos que ya existen |
| 7 | **Pago en línea de la inscripción** (Wompi/MP de la cuenta conectada del anfitrión) + comprobante por WhatsApp con OCR | 5 | 3 | Diferenciador local (§C.2) |
| 8 | **Carné de jugador del torneo**: reusar los carnés digitales con QR y validar el año de nacimiento contra el documento en la categoría | 3 | 2 | Reduce la "chimba" de edades, el dolor clásico |
| 9 | **Página pública del torneo** con fixture, tabla y goleadores, para compartir por WhatsApp (OG image) | 4 | 2 | Crecimiento orgánico |
| 10 | **Boletería ligera + check-in QR** (tickets por evento, aforo, escaneo desde la app del staff) | 3 | 4 | Después de que los torneos se usen de verdad |

**Fuera del top 10:** federaciones. Primero conviene un **piloto de liga** (afiliación club→liga + calendario de temporada multi-escuela) con una liga real, y no construir licencias en abstracto.

### D.3 Qué vender primero

**El addon Torneos para escuelas que ya son clientes** (Besser, Monster, Dynasty, Club Carmel): liga interna con cobro a las familias + invitación a otras escuelas. Es lo único que funciona de punta a punta hoy. Cada torneo externo atrae entre 4 y 12 academias que conocen SportMaps desde adentro. **El rol organizador independiente se vende después de cerrar los puntos 2, 3 y 7.**

### D.4 Precio

Se mantiene la filosofía: **SportMaps no cobra comisión al participante.** El recargo por pago en línea lo decide el organizador, igual que en las escuelas.

- **Escuela con addon Torneos:** $49.000/mes, como hoy, incluido en Elite y Enterprise.
- **Organizador sin escuela:** **plan por evento**, siguiendo la referencia de Tournify (gratis, €40 o €120 por evento). Hay que validar con 3 organizadores antes de publicar cifras. Una opción a probar: gratis hasta 8 equipos o 100 inscritos, luego un tramo fijo por evento según el tamaño. Además, un plan anual para organizadores recurrentes.
- **Federación o liga:** venta asistida (`salesLed`), sin precio público hasta el piloto.
- **Boletería (cuando exista):** tarifa fija por evento, nunca un % por boleta, para sostener el mensaje "sin comisión" contra Eventbrite y las boleteras.

### D.5 Cambios en la landing

- **Organizadores.tsx:** reescribirla sobre lo que existe: inscripción de escuelas por enlace, categorías y fases de precio, cobro con comprobante, fixture liga/copa, goleadores y tabla pública. Boletería y check-in van a "Próximamente". Retirar el testimonio.
- **Eventos.tsx:** dejar claro que hoy la creación es para escuelas con el addon. El CTA del organizador independiente debe ser "Únete a la lista de espera" hasta que esté arreglado.
- **Federaciones.tsx:** retirar las cifras y cambiar el CTA a "Piloto para ligas 2027", con formulario de contacto.
- **Addon Torneos:** "Ligas y copas con fixture automático, goleadores, tabla pública e inscripción con cobro."
- **combos.ts:** quitar "Organizador Pro" y "Federación Pro" mientras no existan como SKU.

### D.6 Conexión con SportMaps Canchas

`facility_occupancy` (`20261014153538`) ya acepta `source_kind = 'event'`. Su `EXCLUDE USING gist (facility_id WITH =, slot WITH &&)` impide que dos usos se crucen en la misma cancha.

1. **Columnas nuevas en `tournament_matches`:** `facility_id`, `starts_at` y `ends_at`. Hace falta una migración nueva con su entrada en el ledger.
2. **RPC `schedule_tournament_match(match_id, facility_id, starts_at, ends_at)`:** `SECURITY DEFINER`, con `search_path` fijo y `GRANT` a `authenticated`. Valida que quien llama es staff del anfitrión con `user_staff_school_ids()`. Escribe una fila en `facility_occupancy` con `source_kind='event'`, `source_id=match_id` y `status='active'`. Si el `EXCLUDE` choca, devuelve un error legible ("Cancha 2 ocupada 3–4 p. m. por alquiler"). Reprogramar libera la fila anterior con `released` e inserta una nueva, en la misma transacción.
3. **Bloque del torneo:** opcionalmente, un `hold` sobre las canchas para todo el fin de semana del torneo, que se libera al programar los partidos uno por uno.
4. **Programador automático (después):** reparte el fixture en las canchas y franjas libres respetando el descanso mínimo por equipo.
5. **Gating:** pide el addon `tournaments` y, si las canchas son propias, también el módulo Canchas. Un torneo en cancha alquilada a un tercero crea una reserva normal (`rental`), sin ocupación propia.
6. **El dinero no se mezcla:** la inscripción va a `payments` con su categoría de torneo y el alquiler de cancha a `facility_reservations`.

### D.7 Ideas de contenido, 3 por rol

**Escuela anfitriona**
1. "Tu liga interna en 10 minutos: categorías, cobro a las familias y fixture" (video corto con Besser).
2. Carrusel "Del grupo de WhatsApp a la tabla pública", antes y después.
3. Checklist descargable: "Cómo invitar 8 academias a tu torneo sin perseguir comprobantes".

**Organizador**
1. "Lo que cuesta de verdad un torneo: canchas, árbitros, premios y la plataforma", con una plantilla de presupuesto.
2. "Fixture liga o copa: cuál elegir según cuántos equipos y fechas tienes".
3. Caso real (cuando exista, nunca inventado): un torneo con inscripción en línea y cero comprobantes perdidos.

**Federación / liga**
1. "Edades verificadas: cómo acabar con los jugadores pasados de categoría", con el carné QR y el documento.
2. Guía "Calendario de temporada multi-club sin choques de cancha" (puente a Canchas).
3. Entrevista o webinar con un directivo de una liga regional sobre la digitalización de las afiliaciones (piloto).

**Atleta / acudiente**
1. "Inscribe a tu hijo al torneo y paga desde el celular en 3 pasos".
2. "Sigue los resultados y goleadores de tu equipo en vivo", con el enlace público.
3. "Qué llevar al torneo: documentos, carné y horarios" (aviso automático por WhatsApp).
