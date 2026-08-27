# Battlecard — Controla.Club

**Estado:** vigente · **Fecha de verificación:** 2026-08-25 · **Reemplaza:** la lectura de capturas
del 2026-08-21 (`sportmaps-strategic-roadmap.md` §2.1 v1)

> Todo lo que sigue se verificó con fetch directo contra `controla.club`, su `sitemap.xml`, sus
> archivos `/llms.txt`/`/llms-full.txt` y Play Store — no son capturas de pantalla ni inferencias.
> Cada afirmación está marcada **CONFIRMADO** (con fuente) o **NO CONFIRMADO** (su propio marketing,
> sin evidencia independiente). No inflar lo segundo en una conversación de venta.

---

## 1. Quién son, en una frase

SaaS colombiano de gestión de clubes/academias deportivas, self-serve puro (trial de 7 días sin
tarjeta, sin demo humana), escalando con SEO agresivo por deporte/ciudad + un ángulo de GEO
(optimización para que los LLMs los recomiendan) que va un paso adelante del mercado. Foco geográfico
real hoy: **Colombia** (única pasarela integrada es Wompi). Reclaman presencia en Panamá, Ecuador y
Perú — autodeclarada, sin evidencia de clientes reales ahí.

## 2. Tabla comparativa rápida

| Frente | Controla.Club | SportMaps | Ventaja |
|---|---|---|---|
| Asistente de IA admin | **Controli**, en producción — pero es helpdesk conversacional ("orienta sobre la plataforma"), no genera reportes | LLM+orquestador ya construido (`whatsapp-bot.service.ts`), sin cablear a chat in-app (`MOD-21`) | Empate potencial — el nuestro es más profundo *si se shippea*; hoy ellos ganan por tenerlo en producción |
| Comunidad / red social | **Social Controla / "SportNet"**: foros, reputación, feed — capa pública trans-fronteriza, en producción | Nada construido; `F6.2 Comunidad` es idea sin fecha | **Ellos ganan**, gap real |
| Control de acceso | Software-first: QR recomendado, sin hardware propio (90% de sus clientes solo con QR) | QR dinámico evaluado (`project_gym_member_app`), no construido; Fase H (hardware multi-marca) es plan mucho más ambicioso a futuro | Empate a corto plazo — para lo que la mayoría de escuelas necesita hoy, ninguno lo tiene shippeado |
| WhatsApp | API oficial Meta, número propio por club — en producción | Misma arquitectura (`project_whatsapp_ai_channel`), bloqueada en `MOD-15` (System User, 4h de trabajo) | **Ellos ganan por estar en producción**, no por arquitectura |
| Pasarela de pago | Solo Wompi (Colombia) | Wompi + MercadoPago, connected accounts en curso (`DIN-6`) | **Nosotros ganamos** en cobertura de pasarela |
| Pricing | Sin página pública; ~$99.000/mes (≤50) y ~$199.000/mes (≤300); **trial 7 días, sin plan gratis permanente** | Start $69.000/50, Pro $159.000/300, **`Free Start` $0 permanente, 20 alumnos** | **Nosotros ganamos** en los dos tramos comparables + tenemos gratis permanente, ellos no |
| Gamificación | "ClubPoints", en producción | `N2` diseñado, no construido | **Ellos ganan**, gap real |
| Fitness/wearables | "MetaFit", en producción (alcance no verificado en detalle) | Bloque D de `project_gym_member_app`, no construido | **Ellos ganan**, gap real |
| LMS (contenido formativo) | Declarado en su feature list | **No existe ni como idea** en nuestro roadmap | **Ellos ganan**, gap sin mapear |
| GEO (SEO para LLMs) | `/llms.txt` publicado, ejecutado, no solo enseñado | `N4` no contempla esto | **Ellos ganan**, y es la brecha más barata de cerrar |
| Marketplace de productos/servicios | No tienen | Construido, con gate de despliegue pendiente (`MOD-11`) | **Nosotros ganamos**, y es un frente que ellos ni atacan |
| Mapa geolocalizado / directorio | No tienen | Es nuestra tesis central | **Nosotros ganamos** — no competir en marketing sobre esto, ya es ventaja estructural |

## 3. Los tres frentes donde de verdad nos sacan ventaja hoy

1. **Ya lo shippearon y lo comunican.** Controli, WhatsApp nativo, Social Controla y GEO están en
   producción; nuestras versiones equivalentes están en spec o bloqueadas por 4 horas de trabajo
   (`MOD-15`). El roadmap agéntico nuestro (Pay/Connect/Analytics, `docs/specs/sportmaps-agents-platform.md`)
   es más profundo en diseño, pero eso no vale nada frente a un prospecto que ya usa el de ellos.
2. **Self-serve sin fricción de ventas.** Trial de 7 días sin tarjeta, sin demo humana. Nuestra
   respuesta en curso no es un trial más largo, es el agente de voz saliente (`docs/specs/outbound-ai-sales-calls.md`,
   spec del 21-ago, Vapi+Groq) — ataca el mismo cuello de botella de "no escala sin Luisa/Julián" por
   otro lado, no por el mismo. Vale la pena saber que ya existe spec, no que el gap está en cero.
3. **GEO ejecutado.** Publican archivos machine-readable para que un LLM los recomiende
   textualmente. Es la táctica más nueva y más barata de las tres — no requiere semanas de
   desarrollo, requiere contenido correcto y publicado.

## 4. Corregir antes de que se repita: su artículo de ataque

`controla.club/blog/controlaclub-vs-sportmaps` nos compara por nombre, con datos mezclados:

- **Correcto:** nuestro plan Pro es $159.000/300 alumnos — lo citan exacto.
- **Incorrecto:** dicen que el plan Start es de 20 alumnos (en realidad son 50 — confundieron con el
  tope de `Free Start`, que además **no mencionan que existe**).
- **Inventado o desactualizado:** citan un plan "Crecimiento" a $99.000 que no existe en el pricing
  vigente — es un nombre de una tabla de tiers vieja, señal de que scrapearon una versión cacheada.
- **Nombran a nuestro CEO por nombre** ("Brayan López") en una comparación pública indexada.
- **Omiten** que tenemos un plan gratis permanente y ellos solo un trial de 7 días — la corrección
  que más conviene usar en cualquier conversación donde el prospecto "ya vio la comparación".

## 5. Objeciones y respuesta sugerida

| Objeción del prospecto | Respuesta |
|---|---|
| "Vi que Controla.Club tiene un asistente de IA y ustedes no." | "El nuestro corre por WhatsApp hoy — le responde directo al padre, no solo al admin. Y estamos por sacar la versión in-app." *(cierto tras `MOD-15` + `MOD-21` S0)* |
| "Ellos son más baratos." | Falso en los dos tramos comparables (69k/50 vs 99k/50-approx; 159k/300 vs 199k/300) y nosotros tenemos plan **gratis permanente** — ellos solo dan 7 días. |
| "Tienen red social / comunidad." | Gap real, sin rodeos. No pitchear como si lo tuviéramos. Redirigir a lo que sí tenemos: marketplace, mapa geolocalizado, reportes de rendimiento del atleta (retención vía valor percibido del padre, no vía red social). |
| "Ya conozco Controla.Club / vi su comparación con SportMaps." | Corregir el pricing (ver §4) y mencionar el plan gratis permanente que omiten. No atacar al competidor — reencuadrar con datos. |

## 6. Qué mover primero (si se prioriza esto en el roadmap)

Orden por impacto/esfuerzo, no por gravedad del gap:

1. **`MOD-15`** (System User WhatsApp, 4h) — deja de estar bloqueado el canal que ellos ya tienen en producción.
2. **GEO propio** (`/llms.txt` con pricing real y diferenciadores) — contenido, no desarrollo. Cierra la brecha más nueva y más barata.
3. **`MOD-21` S0** (chat in-app) — 2-3 días, reusa lo que ya existe.
4. **Corrección de percepción de pricing** — no es código: es asegurarse de que cualquier prospecto que llegue vía esa comparación externa reciba los datos correctos.
5. Gamificación (`N2`) y fitness tracking (Bloque D de `project_gym_member_app`) — gaps reales pero de varias semanas; entran a la cola normal del roadmap, no hay atajo.
6. LMS — gap nuevo, sin decisión de producto todavía. No construir nada hasta decidir si tiene sentido para el negocio (¿contenido para coaches? ¿certificaciones?).

Detalle completo verificado, con fuentes: memoria `project_competitor_controla_club`. Entradas de
roadmap: `ROADMAP.md` track `MOD` (`MOD-21` a `MOD-26`) y `sportmaps-strategic-roadmap.md` §2.1.
