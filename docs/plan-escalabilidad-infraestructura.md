# Plan de escalabilidad e infraestructura — Vercel / Render / Supabase

**Fecha:** 2026-09-06. Números tomados en vivo ese día (Supabase vía SQL, Render vía
`render.yaml`, Vercel vía dashboard/API). Precios de Vercel, Supabase y Cloudflare
verificados contra sus páginas oficiales de pricing esa misma fecha; los de Render
vienen de agregadores de terceros (su pricing page es una SPA que no expone precios
al fetch directo) — **confirmar en render.com/pricing antes de presupuestar con
ellos**.

> **Confirmado 2026-09-06: Supabase está en plan Free.** Esto hace que el
> Problema A de la sección 3.3 (tope de 500 MB de base) sea real y activo,
> no hipotético — hoy en 160 MB (32%), sin margen de meses si el ritmo de
> crecimiento se sostiene.

---

## 1. Resumen ejecutivo

El disparador de este plan fue una alerta de Vercel por "Function Storage" al
100%. Se resolvió (retención de deployments bajada de 30→14 días, más un
proyecto fantasma que ya se autoeliminó) sin gastar un peso. **Ese no es el
riesgo real de escala de SportMaps** — es una alerta de housekeeping en la
plataforma más barata y más fácil de escalar de las tres.

El riesgo real, en orden:

1. **Supabase — plan Free, 160/500 MB (32%) ya usado.** El tope de $/GB más
   cercano de las tres plataformas, y el único que puede *pausar el proyecto*
   si se llena, no solo cobrar de más. Ver sección 3.3.
3. **Supabase — una sola base para dev+staging+producción.** Ya documentado
   internamente ([`project_shared_supabase_env`](../CLAUDE.md)): no hay
   sandbox. Cuando el volumen de escuelas reales crezca, el tráfico de
   pruebas de los 2 devs compite por los mismos recursos que un padre
   pagando en producción.
4. **Supabase — RLS amplifica consultas ~3000× en `school_athletes`**
   (auditoría de rendimiento 2026-07, helpers de RLS sin envolver en
   `(SELECT fn())`). Esto muerde con el crecimiento de escuelas activas
   **antes** que cualquier límite de $/GB — es un problema de latencia, no
   de cuota.
5. **Render — 4 servicios en plan Starter (0.5 vCPU / 512 MB)**, incluido el
   BFF de producción. Server con recursos symbólicos: aguanta hoy, no
   aguanta un pico de asistencia matutina con 3-4× las escuelas actuales.
6. **Vercel — el que menos preocupa.** Hobby es gratis, el frontend es 100%
   estático (cero funciones Lambda, confirmado), y Pro cuesta $20/mes si
   hiciera falta. El problema de esta semana fue de housekeeping, no de
   arquitectura.

**Conclusión short:** no hay urgencia de migrar de plataforma por costo. La
plata que se gastaría en una migración a Cloudflare (tiempo de dev, riesgo de
romper los rewrites por host en producción) rinde mucho más invertida en
arreglar el punto 2 (RLS) y separar el punto 1 (ambientes), que son los que
de verdad limitan cuántas escuelas puede aguantar SportMaps.

---

## 2. Estado actual (2026-09-06)

| | Vercel | Render | Supabase |
|---|---|---|---|
| Plan | Hobby ($0) | 4× Starter (~$7/mes c/u = **~$28/mes**) | Free o Pro — **confirmar** |
| Qué corre | 5 proyectos (frontend SPA + 1 personal) | `sportmaps-demo` (webhook Wompi, Python), BFF dev/stg/prod (Node) | 1 sola instancia para dev+staging+prod |
| Tamaño/uso real | ~6.5 GB de Deployment Storage entre dev/stg/prod (post-fix, bajando) | 512 MB RAM / 0.5 vCPU por servicio | **160 MB** de datos, 278 tablas |
| Dato de negocio | — | — | 368 escuelas, 1,091 perfiles, 4,600 pagos, 1,750 inscripciones |
| % del límite Free más cercano | Deployment Storage (no público, ya resuelto) | — | Si Free: 160/500 MB = **32%** de la base; MAU 1,091/50,000 = 2% |

Notas:
- `backend/render.yaml` (Python + MongoDB, `sportmaps_demo` DB) es un
  prototipo viejo, previo al stack actual con Supabase — no está activo, no
  cuenta para nada de esto.
- El servicio Render `sportmaps-demo` (webhook de Wompi) es un servicio real
  y activo, sin relación con el proyecto fantasma de Vercel del mismo
  nombre — coincidencia de nombre, nada más.

---

## 3. Cuándo cada plataforma se queda corta

### 3.1 Vercel — el margen es amplio

| Recurso (Hobby) | Incluido | Dónde estamos | Qué dispara subir a Pro ($20/mes) |
|---|---|---|---|
| Fast Data Transfer | 100 GB/mes | Sin medir exacto, pero SPA liviana + Free CDN de Vercel — lejos | Tráfico real masivo (miles de padres simultáneos) |
| Function Invocations | 1M/mes | ~0 (cero funciones serverless, todo estático) | No aplica mientras el frontend siga estático |
| Deployment Storage | No publicado en $, es límite "fair use" | Resuelto esta semana bajando retención | Si vuelve a pasar, Pro probablemente sube o quita ese tope |
| Edge Requests | 1M/mes | Bajo | Tráfico muy alto |

**Veredicto:** Vercel no es el cuello de botella de escala de SportMaps. El
disparador de esta semana fue retención mal configurada + un proyecto
fantasma, ambos ya corregidos. Pasar a Pro ($20/mes) es un no-brainer *el día
que* el tráfico real lo justifique — no antes, y no por este incidente.

> Nota: bajar el umbral de la alerta de uso (Team Settings → Alerts) para
> enterarse antes del 100% **es una función de Pro**, no está en Hobby.
> Mientras se siga en Hobby, la única señal es el correo al 100% — otra razón
> más para no dejar que la retención vuelva a subir sin querer.

### 3.2 Render — el que escala en escalones de precio, no de uso

| Plan | Precio | Specs | Cuándo saltar |
|---|---|---|---|
| Starter (actual, ×4) | ~$7/mes c/u | 0.5 vCPU / 512 MB | Ya estamos acá |
| Standard | ~$25/mes c/u | 1 vCPU / 2 GB | Cuando el BFF de prod muestre memoria >80% sostenida o p95 de latencia suba en picos (asistencia matutina, cierre de mes) |
| Pro | ~$85/mes c/u | 2 vCPU / 4 GB | Crecimiento de escuelas activas ×5-10 sobre hoy |

A diferencia de Vercel/Supabase, Render **no cobra por consumo** (sin
sorpresas de factura por tráfico) — cobra por el tamaño de la máquina. Esto
es predecible pero significa que **no hay alerta automática de "te estás
quedando sin recursos"**: hay que vigilar memoria/CPU del dashboard de Render
directamente, o instrumentar un health-check que avise.

**Recomendación concreta:** antes de necesitarlo, agregar un chequeo mensual
(o una alerta en Render, si el plan la ofrece) de memoria del servicio
`sportmaps-bff-prod`. Con 368 escuelas hoy, probablemente hay margen para
varios meses más en Starter — pero es una suposición sin métricas reales, no
un hecho verificado.

### 3.3 Supabase — el que de verdad puede doler, y con tres problemas distintos

**Problema A — el límite de $/GB (confirmado: plan Free):**

| Recurso (Free) | Incluido | Dónde estamos | Qué pasa si se excede |
|---|---|---|---|
| Tamaño de base | 500 MB | 160 MB (**32%**) | El proyecto se pausa o bloquea escritura hasta subir de plan |
| Egress | 5 GB/mes | No medido | Igual |
| MAU (auth) | 50,000 | 1,091 (2%) | Lejos |
| File storage | 1 GB | No medido | — |

Si el crecimiento de datos sigue el ritmo de escuelas nuevas (cada escuela
suma perfiles, pagos, asistencias), 160→500 MB no es una proyección de años,
es de meses — sobre todo porque tablas como `attendance`/logs crecen con
cada día operativo, no con cada escuela nueva. **Pro cuesta $25/mes** y sube
el tope a 8 GB — barato comparado con el riesgo de que el proyecto se pause
en medio de un cobro real (Dynasty, Besser, Carmel, etc. operando sobre la
misma base).

**Esta es la acción más urgente y más barata de todo el documento: pasar
Supabase a Pro ($25/mes) antes de acercarse más al 500 MB, no después.** A
diferencia de Vercel/Render, quedarse sin espacio acá no es "más lento" —
es el proyecto bloqueado para escritura, con clientes reales pagando en
producción en ese momento.

**Problema B — RLS amplificando consultas (aplica en Free o Pro):**

Ya documentado en la auditoría de rendimiento de 2026-07: 0 de ~74 sitios
envuelven los helpers de RLS en `(SELECT fn())`, y la vista
`school_athletes` (12 `LATERAL`, no podable por el planner) multiplica el
costo por escuela. Esto **no se arregla subiendo de plan** — es una
consulta cara, así que más CPU solo pospone el dolor. Con 368 escuelas hoy,
probablemente no se siente; con 1,000+ sí.

**Problema C — una sola instancia para 3 ambientes:**

Cualquier query lenta o migración pesada corriendo en `dev` compite por
recursos con producción real. No hay aislamiento. Separar esto (branch de
Supabase, o proyecto aparte para dev) es una decisión de arquitectura, no
un ajuste de plan — y vale la pena antes de que el problema A o B se sientan,
porque agregar un ambiente nuevo bajo presión es peor que hacerlo con calma.

**Veredicto:** de las tres plataformas, Supabase es la que necesita atención
real de escalabilidad. El Problema A (500 MB) sí se resuelve con la tarjeta
de crédito — y vale la pena resolverlo ya, es la acción más barata de este
documento. Los problemas B (RLS) y C (un solo ambiente) no se resuelven
subiendo de plan, y son los que de verdad limitan cuántas escuelas puede
aguantar SportMaps a futuro.

---

## 4. La pregunta original: ¿Cloudflare?

Cloudflare (Pages para el frontend, Workers para los rewrites por host) es
técnicamente viable — el frontend es 100% estático — pero **no resuelve
ninguno de los tres riesgos reales de arriba**. Resuelve un problema que ya
se resolvió gratis (retención de Vercel).

| | Vercel Hobby (actual, ya arreglado) | Cloudflare Pages + Workers |
|---|---|---|
| Costo | $0 | $0 (Pages) + $0-5/mes (Workers, según tráfico) |
| Builds/mes | Sin tope publicado (con retención corta, no debería volver a alertar) | 500/mes incluidos, 1 build a la vez |
| Requests | 1M edge requests | Ilimitado |
| Migración necesaria | Ninguna | Reescribir los rewrites por host de `vercel.json` como Worker, reconectar DNS de `sportmaps.co` (hoy en Namecheap), probar las 3 sedes |
| Riesgo | Ninguno | Medio — tocar DNS de producción sí puede causar downtime si algo sale mal |

**Recomendación:** no migrar ahora. Guardar esta comparación para el día que
(a) la alerta de Vercel vuelva a pasar pese a la retención corta, o (b) el
volumen de builds/mes se acerque a algo que Vercel Pro cobre de más — ninguno
de los dos ha pasado todavía. Cloudflare es la jugada correcta el día que
haya una razón concreta, no como prevención de algo que ya se arregló.

---

## 5. Qué hacer, en orden

1. ✅ **Hecho** — retención de deployments en Vercel bajada a 14 días en
   dev/stg/prod.
2. ✅ **Confirmado** — Supabase está en Free, 160/500 MB (32%). Es el dato
   que faltaba y ya cambió la prioridad de este plan.
3. **Pasar Supabase a Pro ($25/mes)** — la acción más urgente y más barata
   de todo el documento. No hay ninguna razón para esperar a estar en 90%
   para hacer esto.
4. **Instrumentar una alerta simple de tamaño de base de Supabase** —
   correr `select pg_size_pretty(pg_database_size(current_database()))`
   mensualmente (o vía un cron del BFF que loguee esto) para ver la
   tendencia real de crecimiento, no adivinarla. Sigue siendo útil aun en
   Pro (8 GB también se acaba si nadie mira la tendencia).
5. **Retomar el trabajo de RLS sin envolver** (ya identificado en la
   auditoría de 2026-07, 0 de 74 sitios corregidos) — es lo único de esta
   lista que degrada la experiencia de usuario *ya*, antes de tocar ningún
   límite de plan.
6. **Evaluar separar el ambiente de `dev` a su propia instancia de
   Supabase** (branch o proyecto aparte) — no urgente, pero cada mes que
   pasa con más escuelas reales en la misma base que los devs prueban, el
   costo de hacerlo después sube.
7. Cloudflare/Render: sin acción — quedan documentados como palancas
   conocidas para cuando haya una razón concreta de negocio (no de
   housekeeping) que las justifique.

---

## Fuentes de precios (verificadas 2026-09-06)

- Vercel: [vercel.com/pricing](https://vercel.com/pricing)
- Supabase: [supabase.com/pricing](https://supabase.com/pricing)
- Cloudflare Pages: [developers.cloudflare.com/pages/platform/limits](https://developers.cloudflare.com/pages/platform/limits/)
- Cloudflare Workers: [developers.cloudflare.com/workers/platform/pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- Render: agregado de terceros (srvrlss.io, makerkit.dev) — **no oficial,
  confirmar en render.com/pricing**.
