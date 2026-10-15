# Plan maestro del ecosistema SportMaps

**Fecha:** 2026-10-14 · Une el [plan agresivo de Canchas](plan-agresivo-canchas-2026-10.md) con los tres
estudios por rol:

- [Entrenadores y bienestar](specs/ecosistema/roles-entrenadores-bienestar.md)
- [Organizadores y federaciones](specs/ecosistema/roles-organizadores-federaciones.md)
- [Tiendas, marcas, familias y deportistas](specs/ecosistema/roles-tiendas-marcas-familias-atletas.md)

Cada estudio trae el inventario con rutas de archivo, la competencia verificada con URL y las ideas de
contenido. Este documento decide **el orden**.

> Los inventarios salen de **leer el código y los specs**, no de probar la app ni de consultar la base.
> Antes de construir cada frente, se verifica en vivo, como se hizo con Canchas F0.

---

## 1. Diagnóstico en una tabla

| Rol | Qué funciona hoy | Qué está roto o falta | Qué promete la landing sin tenerlo |
|---|---|---|---|
| **Escuela** | Núcleo completo: alumnos, cobros, asistencia, WhatsApp, tienda (apagada), torneos internos | Tienda apagada por `StoreGate`; ventas fuera de «Ingresos del mes» | — |
| **Coach de escuela** | Sesiones con periodización, asistencia QR, informes, semáforo médico | Pizarra solo fútbol (multideporte en ramas sin integrar); Partidos sin BFF; Mensajes/Anuncios rotos; sin escuela = dashboard vacío | Analítica y web propia (Coach Elite) |
| **Entrenador independiente** | Micro-escuela propia (~70 endpoints `trainer/`): clientes, rutinas, disponibilidad, perfil público | **No puede comprar su plan:** `/mi-plan` muestra planes de academia; biomecánica sin pantalla | «Coach Pro» $99k que la app no cobra |
| **Bienestar** | F0–F3 en producción: pacientes, consentimientos, agenda, historia clínica (Res. 1995), lesiones | Sin cobro en la app (F4); nutrición es maqueta; sin videoconsulta | **Cifras y profesionales inventados** («200+ profesionales», «1.500+ consultas», 3 fisios ficticios con rating); videollamada, wearables, 24/7 |
| **Organizador** | — | **No puede crear su primer evento:** `POST /api/v1/events` no manda `creator_id`/`creator_role`, inserta `bank_data` (no existe) y usa columnas viejas; inscripción individual probablemente rota (`package_choice`) | Testimonio de «2.300 boletas con QR», boletería, «plan por evento», combos Organizador Pro y Federación Pro |
| **Torneos de escuela** | Funcionan de punta a punta: categorías y precios, invitación por enlace, delegaciones con comprobante, fixture liga/copa, tabla pública | Grupos + eliminatoria, sanciones, partidos asignados a cancha | Addon Torneos anuncia «Americanos y ranking PWR» |
| **Federaciones** | Solo fichas de directorio (89 de OSM) | Ningún módulo | «50+ federaciones / 100K+ atletas» |
| **Familia (acudiente)** | Hijos, pagos, informe mensual PDF, carnets, calendario | Falta Inicio (UX-15); «Explorar» solo en local (`SHOW_EXPLORE` = `DEV`); chat roto. Uso: 27 % activos/semana | — |
| **Deportista** | Estadísticas, objetivos, entrenamientos (uso ≈ 0) | Racha, Atleta ID portable (solo spec); no puede reservar cancha | Scouts, highlights, historial portable |
| **Tienda / proveedor** | Tienda escolar completa (apagada) | Marketplace y `/vendor/*` nunca desplegados; dashboard en $0; rutas duplicadas de `store_owner` | «SportMaps Store» con 24–48 h, devoluciones, Nike/Adidas; Proveedor Pro con CRM y API |
| **Marcas** | Nada (0 páginas, 0 rutas) | Todo | Planes $199k / $549k con anuncios por IA y «+10.000 atletas» (la audiencia real es ~1.100) |
| **Canchas** | F0 aplicada (14-oct) | F1–F4 en curso (plan aparte) | Bien: dice «lanzamiento nov-2026» |

**Conclusión:** el producto es más fuerte de lo que la landing deja ver en escuela, torneos internos,
bienestar y entrenador independiente, y **mucho más débil** en marcas, tienda global, organizador y
federaciones, que es justo donde la landing más promete. **Lo primero es dejar de prometer lo que no
existe.**

---

## 2. P0 — esta semana (antes de cualquier campaña)

### 2.1 Limpiar la landing (riesgo de confianza y legal)

Hay cifras y personas inventadas publicadas. Si un cliente o un competidor las cita, se pierde la
credibilidad que da la honestidad de las comparativas.

| Página | Cambio |
|---|---|
| `Bienestar.tsx:55-58`, `BienestarModule.tsx:66-68` | Borrar las estadísticas inventadas |
| `Bienestar.tsx:204-232` | Borrar «Nuestro equipo de profesionales» (personas ficticias) |
| `Bienestar.tsx` | Quitar videollamada, wearables, «cumplimiento internacional» y 24/7. Poner lo real: historia clínica Res. 1995 y consentimiento del acudiente (Ley 1581) |
| `Organizadores.tsx` | Retirar el testimonio de las 2.300 boletas. Reescribirla sobre lo que existe (torneos de escuela); boletería y check-in van a «Próximamente» |
| `Federaciones.tsx` | Retirar «50+ federaciones / 100K+ atletas». CTA: «Piloto para ligas 2027» |
| `Marcas.tsx` | Quitar «el más grande de Latinoamérica» y «+10.000». Los 3 planes pasan a «Programa de marcas aliadas — piloto» con formulario |
| `Equipamiento.tsx` | Despublicar o convertir en «Tienda de tu escuela» (vitrinas reales). Quitar 24–48 h, devoluciones, Nike/Adidas |
| `Proveedores.tsx` | Dejar solo «Proveedor recomendado para escuelas». Quitar CRM, cotizaciones, API, 24/7 |
| `Deportistas.tsx` | Scouts, highlights e historial portable pasan a «Próximamente» |
| `Partners.tsx` | Verificar o retirar los KPIs |
| `saas-plans.ts` / `combos.ts` | Addon Torneos sin «Americanos y PWR». Quitar Coach Elite, Clínica, Organizador Pro y Federación Pro mientras no sean un SKU que se pueda comprar |

⚠️ Esos archivos los está editando **otra sesión ahora mismo** (blog, planes, home, Bienestar). Esto se hace
**coordinado con esa sesión** o cuando termine, no encima.

### 2.2 Arreglar lo que bloquea vender hoy

| Arreglo | Por qué | Esfuerzo |
|---|---|---|
| **Organizador: crear evento** → RPC transaccional que reuse el camino de la escuela | Hoy un organizador que paga no puede hacer nada | M |
| **`/mi-plan` por rol** (Coach Pro, Wellness, Canchas) | Entrenadores y profesionales no pueden pagarnos | S |
| **`SHOW_EXPLORE`** en producción | Sin Explorar no hay descubrimiento de escuelas, canchas ni eventos | XS |
| **Coach sin escuela:** salida del dashboard vacío (crear micro-escuela o pasar a independiente) | Primera impresión del rol | S |

---

## 3. Secuencia de 8 semanas (15-oct → 4-dic)

Canchas sigue su propio plan (H1–H6). Los demás frentes van en paralelo, priorizados por **plata que
entra rápido** y **por qué amarran a los demás roles**.

| Semanas | Frente | Entregable | Por qué ahora |
|---|---|---|---|
| 1 | Landing honesta (§2.1) | Landing sin cifras ni personas inventadas | Antes de la pauta de Canchas |
| 1–2 | Planes por rol (§2.2) | Coach Pro y Wellness comprables en `/mi-plan` | Ingreso inmediato de roles que ya funcionan |
| 1–3 | Organizador | Crear evento + inscripción individual arreglados (RPC transaccional) | El rol está muerto hoy |
| 2–3 | Tienda escolar | Piloto con Monster: encender `store`, ventas en «Ingresos del mes»; revisar línea por línea las 3 migraciones de tienda, incluida `tienda_compra_sin_cuenta` | Código completo y apagado = plata dejada en la mesa |
| 2–4 | Familia | Inicio del acudiente (UX-15) + Explorar en prod + «Reservar cancha» (cuando exista H3 de Canchas) | Es el usuario que más abre la app; de ahí salen los jugadores de Canchas |
| 3–5 | Torneos ↔ Canchas | `tournament_matches` + `facility_id`/`starts_at`/`ends_at` + RPC `schedule_tournament_match` que escribe ocupación `event` | Un torneo bloquea canchas sin choques: diferencial que nadie tiene |
| 3–6 | Bienestar F4 | Cobro del profesional con cuenta conectada (Wompi/MP) | Sube el precio de bienestar de ~$59k a ~$119k |
| 4–6 | Coach | Pizarra multideporte (integrar ramas `pizarra-tp/*`) + BFF de Partidos | Diferencial frente a Clupik y 360Player |
| 5–8 | Organizador v2 | Registro liviano + roster por Excel + pago en línea de inscripción con WhatsApp y OCR | Lo que piden los organizadores; fixture solo no se vende |
| 6–8 | Marcas v0 | «Marcas aliadas»: beneficios para familias + patrocinio de la primera reserva de cancha, con reporte agregado **sin datos de menores** | Monetiza la red sin cobrarle a las familias |
| después | Federaciones | Piloto con una liga real, venta asistida | Necesita organizador v2 funcionando |
| después | Marketplace global, SportPoints F1, Atleta ID | — | Cuando haya tráfico y marcas |

---

## 4. Precios por rol (propuesta, la decide el negocio)

Principios: **gratis para empezar, sin comisión al cliente final, sin permanencia.** Si hay recargo, lo
decide quien cobra.

| Rol | Hoy en la landing | Propuesta | Condición |
|---|---|---|---|
| Coach de escuela | Coach Pro $99k | **Gratis dentro del plan de la escuela** | Argumento de venta de la academia |
| Entrenador independiente | Coach Pro $99k | **$59.000–69.000** | Debe poder comprarse en `/mi-plan` |
| Bienestar | Wellness Pro $149k | **$49.000–79.000** como «fisio de la escuela»; **~$119.000** cuando exista el cobro (F4) | Sin «pagos integrados» hasta F4 |
| Organizador | Plan por evento / Organizador Pro | Plan por evento: **validar con 3 organizadores antes de publicar cifras** | Sin comisión al participante; boletería con tarifa fija, nunca porcentaje |
| Escuela + Torneos | Addon $49k | **$49k**, vendido primero a Besser, Monster, Dynasty y Carmel | Cada torneo externo trae academias nuevas |
| Federación | Federación Pro | Venta asistida, piloto | — |
| Canchas | Gratis / $99k / $199k | Igual (decidido) | — |
| Marcas | $199k / $549k | **Piloto sin precio publicado**; campañas medibles | Cifras reales de audiencia |
| Familias y deportistas | Gratis | **Gratis siempre** | — |

---

## 5. Cómo se amarra el ecosistema (el argumento que nadie más tiene)

```
Escuela (paga SaaS) ──► Familias y deportistas (gratis, abren la app cada semana)
   │                         │
   │                         ├─► Reservan canchas (SportMaps Canchas, la escuela o clubes vecinos)
   │                         ├─► Se inscriben a torneos (organizador o escuela anfitriona)
   │                         ├─► Usan bienestar (fisio de la escuela) y entrenadores independientes
   │                         └─► Reciben beneficios de marcas aliadas
   │
   ├─► Sus canchas libres se alquilan (hybrid)
   ├─► Organiza torneos que traen otras academias (adquisición)
   └─► Su tienda vende uniformes por su propia pasarela
```

- Controla separa academia y canchas; Playtomic y Easycancha no tienen escuela; Copa Fácil y Tournify
  solo hacen fixture.
- **Nadie junta escuela + canchas + torneos + bienestar + tienda con cobros colombianos y WhatsApp oficial.**

Ese es el mensaje del ecosistema, **siempre contado solo con lo que corre en la app**.

---

## 6. Contenido

- **Canchas:** el kit ya está en [`marketing/canchas/`](marketing/canchas/00-indice.md).
- **Demás roles:** los tres estudios traen 3 ideas por rol, todas sobre funciones que ya existen (§D.6/§D.7 de cada uno).
- **Orden de publicación:**
  1. Lo que ya funciona y nadie conoce: torneos de escuela, historia clínica de bienestar, rutinas del entrenador.
  2. Construcción en público de Canchas.
  3. Lo nuevo, a medida que salga.
- **Regla:** ninguna pieza de un rol sale antes de que su página de la landing esté limpia (§2.1).

---

## 7. Decisiones para el dueño

| # | Decisión | Recomendación |
|---|---|---|
| E1 | ¿Se limpia la landing ya, coordinando con la sesión que la está editando? | Sí, es P0 |
| E2 | Precio del entrenador independiente | $59.000 |
| E3 | Precio de bienestar antes y después de F4 | $59.000 → $119.000 |
| E4 | ¿Coach de escuela gratis dentro del plan de la escuela? | Sí |
| E5 | ¿Se despublica `Equipamiento.tsx` o se convierte en «Tienda de tu escuela»? | Convertir |
| E6 | Tienda escolar: ¿piloto con Monster? | Sí |
| E7 | Marcas: ¿piloto sin precio publicado? | Sí |
| E8 | ¿Qué 3 organizadores validan el plan por evento? | Los nombra el dueño |
