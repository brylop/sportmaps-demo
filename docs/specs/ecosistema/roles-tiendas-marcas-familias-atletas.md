# Ecosistema SportMaps: tiendas, marcas, familias y deportistas

**Fecha:** 2026-10-14 · **Estado:** investigación estratégica, sin código · **Alcance:** `store_owner`/vendedor, marcas/patrocinadores, `parent` (acudiente), `athlete` (incluye adulto independiente).
**Método:** lectura del repo (`develop`) y del repo de la landing. **No se consultó la base viva.** Las cifras de uso salen de specs ya medidos (citados). Competencia: WebSearch + WebFetch, marcado **CONFIRMADO** (fuente primaria con URL) o **NO CONFIRMADO** (fuente de terceros o no hallado).

---

## A. Inventario: qué existe hoy

Leyenda: **Cableado** = página + BFF/RPC + navegación · **Página sin respaldo** = existe la pantalla pero el backend está apagado, roto o duplicado · **Solo spec** = no hay código.

### A.1 Tienda / marketplace / vendedor

| Capacidad | Estado | Evidencia |
|---|---|---|
| Tienda escolar (adicional `store`, $49.000/mes, incluida en Elite y Enterprise) | **Cableado, pero apagado por plataforma** | `frontend/src/config/saas-plans.ts` (`store`); `StoreGate` + `useStoreEnabled` (fail-closed); BFF `requireStoreEnabled` en `vendor/products`, `marketplace/orders`, `shipping`. El grupo A de `DIN-24` (aplicado 2026-10-04) dejó la tienda apagada |
| Vitrina de la escuela para familia/atleta (`/mi-tienda` → `/tienda/:slug`, `/tienda/:slug/p/:id`, checkout `/checkout/tienda/:vendorProfileId`) | **Cableado, apagado** | `MiTiendaPage`, `TiendaPublicaPage`, `TiendaProductoPage`, `StoreCheckoutPage`; BFF `store-guest.routes.ts` (`/api/v1/public/tienda`), `store-orders`, `store-coupons`. La vitrina vive **fuera** del shell autenticado: el padre pierde el menú (`tienda-cambio-gestion-a-tienda.md` §1.1) |
| Mis compras (`/mis-compras`, `/mis-compras/:orderId`) | **Cableado, apagado** | `MisComprasPage`, `MiCompraDetallePage`; ítem en el menú de `parent` y `athlete` con `requiresStore` |
| Panel vendedor `/vendor/*` (dashboard, productos con asistente, inbox, liquidaciones, envíos, promociones, suscriptores, servicios, citas, perfil público) | **Página sin respaldo parcial** | 11 páginas en `frontend/src/pages/vendor/`; BFF `vendor*.routes.ts`. `VendorDashboardPage` muestra «Ingresos» fijo en `'$0'`; el perfil está atado al **usuario dueño**, no a la escuela (un `school_admin` no dueño cae en bucle) |
| Rol legado `store_owner` (`/products`, `/inventory`, `/suppliers`, `/categories`, `/customers`, `/promotions`, `/store-reports`) | **Página sin respaldo / duplicado** | Rutas existen, pero `/categories` y `/promotions` abren `StoreProductsPage` y `/customers` abre `StoreOrdersPage`. 1 usuario real; `UX-8` propone migrarlo a `external_vendor` |
| Marketplace global (`/marketplace`, `/shop`, detalle por tipo) | **Página sin respaldo — nunca desplegado** | `MarketplacePage`, `ShopPage`; BFF `marketplace*.routes.ts`. Memoria `project_stores_marketplace_state`: NO desplegado. El catálogo global se sacó del menú del atleta porque mostraba productos de todas las escuelas |
| Moderación de marketplace (admin) | Cableado (sin uso) | `/admin/marketplace/moderation`, `marketplace-admin.routes.ts` |
| Tienda v2 «estilo MercadoLibre» (RPCs de dinero/stock, kardex, imágenes, reseñas con contexto deportivo) | **Solo spec + F0 parcial** | `tienda-v2-estilo-mercadolibre.md` (base: 3 productos demo, 0 variantes, 0 reseñas, `orders` 1 fila seed); F0 aplicada con el grupo A; 3 migraciones de tienda del 13-oct **sin aplicar** (incluye `tienda_compra_sin_cuenta`, RPCs a `anon`: revisar línea por línea — ROADMAP §8) |
| Tienda dentro de la gestión (bandeja única, compras dentro de Pagos) | **Solo spec** | `tienda-cambio-gestion-a-tienda.md` |
| Ventas de tienda en ingresos de la escuela | **Roto por diseño** | Emiten `commerce_sale` a `accounting_outbox`, no a `cash_ledger`: la tienda no aparece en «Ingresos del mes» |

### A.2 Marcas / patrocinadores

| Capacidad | Estado |
|---|---|
| Perfil de marca, directorio, campañas, patrocinio de atletas/escuelas/eventos | **No existe.** Ni página ni ruta ni tabla de patrocinio en el frontend (búsqueda de `sponsor`/`patrocin` en `frontend/src/pages`: 0 resultados) |
| `product_brands` (39 filas) | Solo catálogo de marcas de producto, sin cuenta ni panel |
| Premios de marcas aliadas en SportPoints | **Solo spec** (`sportpoints-fidelizacion.md`, 2026-10-07): sin presupuesto, los premios los ponen marcas a cambio de visibilidad; nunca se venden datos de familias o menores |

### A.3 Acudiente (`parent`)

| Capacidad | Estado | Evidencia |
|---|---|---|
| Mis hijos, progreso, asistencia, informes, informe post-entreno | **Cableado** | `/children`, `/children/:id/progress|attendance|reports|reports/:reportId|post-entreno-informe` |
| Pagos del acudiente (`/my-payments`, `ParentCheckoutPage`) | **Cableado** | Recorte de clics **F1 hecho (09-25)**; F2 enlace mágico y F3 autopay pendientes (memoria `project_flujo_acudiente_recorte_clics`). `UX-15` (Inicio = «Por pagar» + tarjeta del hijo) **sin construir** |
| Informe mensual del atleta (PDF, nota por equipo, correo con enlace) | **Cableado** | `MonthlyReportsPage`, `ChildReportsPage`, BFF `athlete-reports-pdf.ts` |
| Portal de informes por enlace público (sin login) | **Solo spec** | `informe-atleta-link-publico.md` |
| Carnets digitales de los hijos (`/my-cards`, verificación `/c/:qrToken`) | **Cableado** | `MyAthleteCardsPage`, `AthleteCardPublicPage` |
| Calendario familiar, avisos in-app + push | **Cableado** | memoria `project_calendar_avisos_familias` |
| Explorar (buscar escuelas, eventos) | **Página sin respaldo en producción** | `SHOW_EXPLORE = import.meta.env.DEV`: solo aparece en local (ROADMAP `UX-3`) |
| Mensajes / Chat | **Muerto** (memoria `project_dead_modules_roles_audit`; `UX-15` pide quitarlo de la barra) |
| SportPoints | **Solo spec** — bloqueado (ROADMAP fase 4) |

### A.4 Deportista (`athlete`, incl. adulto independiente)

| Capacidad | Estado |
|---|---|
| Dashboard, calendario, Mis pagos (`/athlete-payments`), inscripciones, eventos | **Cableado** |
| Estadísticas, objetivos, entrenamientos (`/stats`, `/goals`, `/training`) | **Cableado** — BFF `/api/v1/athlete/{stats,training,biomech,performance}`. Adopción ~0 medida (ROADMAP §barrido 08-31) |
| Bienestar (Mi salud, citas, explorar profesionales) | **Cableado** (fisio F0-F3 en prod 10-06) |
| Carnet propio, constancias | **Cableado** |
| Tienda y Mis compras | **Cableado, apagado** (misma tienda de su escuela) |
| Racha del deportista, «Atleta ID» portable entre escuelas | **Solo spec** (ROADMAP fase 4; `identidad-de-atleta-propuesta.md`) |
| Reservar canchas como jugador | **Parcial**: BFF `public-booking.routes.ts`, `session-bookings.ts`, `reservations-admin`; Canchas F0 (guarda de seguridad, ocupación sin cruces, gating por addon) commiteado en `be1a51c4`. Plan en `reservas-canchas-plan-unificado-2026-10.md` |

**Uso real (medido 2026-10-07, `sportpoints-fidelizacion.md` §1):** 394 acudientes vinculados, 42 % entró en 30 días, ~27 % activo en 7 días, 26 % con acceso directo (PWA), 24 % con push, 0 con app nativa. Autoevaluación post-entreno en Besser: ~4 %.

---

## B. Landing: qué se promete vs. qué hay

Repo `Landing_page/sportmap-maps-landing-page/frontend`.

| Página | Promesa | ¿La app la cumple? |
|---|---|---|
| `Marcas.tsx` + `RolePricingSection` (`marcas`) | «El marketplace deportivo más grande de Latinoamérica», «+10,000 deportistas», planes **Partner (gratis)**, **Marketplace Pro $199.000/mes** (catálogo + sponsoring, pasarela, logística, analytics, promoción cruzada en escuelas), **Sponsor Elite $549.000/mes** (ads segmentados con IA, banner principal, patrocinio de eventos) | **No.** No hay marketplace desplegado, ni patrocinio, ni ads, ni analytics de marca. La audiencia real es ~1.131 atletas activos y 394 familias (spec SportPoints), no 10.000+ |
| `Proveedores.tsx` (`proveedores`) | Free / **Proveedor Pro $149.000** (tienda integrada, cotizaciones online, CRM) / **Enterprise $399.000** (multisede, API, facturación electrónica, soporte 24/7, gerente de cuenta) | **No.** No hay cotizaciones ni CRM de proveedor; la tienda está apagada; el panel vendedor muestra ingresos en $0 |
| `Equipamiento.tsx` («SportMaps Store») | Entrega express 24-48 h con seguimiento en tiempo real, 30 días de devolución, «solo marcas oficiales», precios mayoristas, IA de tallas, productos Nike/Adidas/Wilson/Spalding | **No, y es riesgo legal/reputacional**: no hay catálogo propio, ni logística, ni política de devoluciones; mostrar productos de marcas sin acuerdo |
| `Deportistas.tsx` | «Gratis siempre», Atleta ID portable, inscripción a eventos en 30 s, historial que viaja contigo, **descuentos en marcas aliadas**, **conexión con scouts y patrocinadores**, video highlights, «comunicación directa con el coach», «pagar en 1 clic» | **Parcial.** Gratis: sí. Pagos y calendario: sí. Portabilidad entre escuelas, descuentos de marcas, scouts, highlights: **no**. Chat con el coach: muerto. «1 clic»: F1 lo acercó, no lo cumple |
| `Partners.tsx` | Comisiones recurrentes, gerente de cuenta, KPIs «Pagado a partners / Partners activos» | No hay programa de referidos en la app; verificar si los KPIs son cifras reales |
| `Canchas.tsx` | Reserva y cobro de canchas por WhatsApp; 3 meses de Canchas Pro gratis a los primeros 50 clubes | En construcción (F0); coherente con el plan, pero sin flujo de jugador en la app todavía |

**Conclusión B:** la landing vende un marketplace con logística y una red publicitaria que no existen. Es el mayor riesgo de confianza del ecosistema: una marca que pague $199.000 hoy no recibe nada operable.

---

## C. Competencia (verificada)

| Producto | Hallazgos | Estado |
|---|---|---|
| **Spond** | Gratis para organizadores; se financia con «Spond brand partnerships»; cobra una comisión de transacción al recaudar dinero (el organizador decide si la absorbe o la traslada); recaudación de fondos de grupo y club; membresías juveniles aprobadas por el acudiente. El mismo blog dice también «sin comisiones de plataforma»: contradicción en su propia página | **CONFIRMADO** — https://www.spond.com/news-and-blog/free-app-for-team-scheduling-and-payments/ · El % por país **NO CONFIRMADO** |
| **TeamSnap** | Equipo individual gratis; precio de club personalizado; app de padres (TeamSnap ONE); registro y pagos; streaming en vivo incluido para clubes | **CONFIRMADO** — https://www.teamsnap.com/pricing |
| TeamSnap — quejas | Los padres ven publicidad aunque el club pague; para quitarla cada padre paga su suscripción. Trustpilot ~1/5 | **NO CONFIRMADO** (G2/Trustpilot, terceros) |
| **Heja** | Gratis para todo el equipo sin límite de padres/jugadores; Heja Pro (estadísticas de asistencia, seguimiento de pagos, sin anuncios para coach/admin) USD 13,49/mes o 99,99/año; **tiendas web personales del jugador para recaudar fondos**; protección de menores; la app contiene publicidad. Quejas: funciones que pasan a pago, calidad de fotos, sincronización | **CONFIRMADO** — https://apps.apple.com/us/app/heja/id1157335714 |
| **Playtomic** (app de jugador) | Reservar cancha, partidos abiertos/privados, **nivel estimado** para emparejar rivales, comunidad, estadísticas; presente en «más de 52 países». Pago dividido entre jugadores | Funciones **CONFIRMADO** — https://playtomic.com/es · Pago dividido: ficha App Store (https://apps.apple.com/es/app/playtomic-jugar-a-padel/id1242321076, terceros resumido) · Medios de pago en Colombia y precios: **NO CONFIRMADO** |
| **Strava** (referencia de engagement) | Las marcas pagan **retos patrocinados**, **segmentos patrocinados** y **suscripciones regaladas** a su comunidad; afirma 2× recuerdo de marca | **CONFIRMADO** — https://business.strava.com/ · Precios de suscripción: **NO CONFIRMADO** |
| **Shopify** (clubes que montan su tienda) | Planes Basic USD 25, Grow USD 65, Advanced USD 399; recargo de 2 %/1 %/0,6 % si se usa pasarela externa (caso Colombia: Wompi, Mercado Pago, ePayco) | **CONFIRMADO** — https://www.shopify.com/co/precios · Plugin Wompi: https://docs.wompi.co/en/docs/colombia/wompi-shopify-plugin/ |
| **Mercado Libre Colombia** | Comisión variable por categoría y tipo de publicación + cargo fijo; quejas públicas por alzas | Tabla oficial **NO CONFIRMADO** (página de ayuda devolvió 403) |
| Tiendas de uniformes para escuelas en Colombia | Mercado de confeccionistas locales por sublimación, venta por WhatsApp/Instagram y licitaciones municipales; no se halló una plataforma dominante con pedido en línea por club | **NO CONFIRMADO** (no hay fuente primaria) |
| **SponsorUnited** | Plataforma de inteligencia de patrocinios: 1.100+ organizaciones, 2,2M+ acuerdos analizados; clientes grandes (NFL, NBA, LaLiga, AB InBev). Sin precio público. No sirve a clubes formativos | **CONFIRMADO** — https://www.sponsorunited.com/about |
| **Sponsorboost** | Sitio no accesible (error SSL); sin información | **NO CONFIRMADO** |
| Equivalentes LatAm | Sponsor Online: Atlético Nacional comercializa activos digitales (2020); AdSports (Brasil): atletas y clubes pequeños publican propiedades de patrocinio y las marcas proponen | Sponsor Online **CONFIRMADO** — https://www.elcolombiano.com/deportes/atletico-nacional/atletico-nacional-entra-en-la-plataforma-de-mercado-digital-sponsor-online-HA13201125 · AdSports **NO CONFIRMADO** (prensa) |

**Lecturas clave:**
1. **Nadie cobra a la familia por usar la app.** Spond y Heja financian lo gratis con transacciones, alianzas de marca o el plan pago del coach. TeamSnap muestra lo que **no** hay que hacer: anuncios a padres que el club no puede apagar.
2. **WhatsApp:** ninguno de los competidores revisados lo usa como canal principal (no hallado en fuentes). En Colombia es la ventaja diferencial de SportMaps.
3. **El patrocinio a escala de club formativo no está resuelto** por nadie verificable en Colombia: SponsorUnited es para ligas mayores; AdSports apunta a ese hueco en Brasil.
4. **Strava y Playtomic** prueban dos motores de hábito: el reto con marca y el nivel/emparejamiento.

---

## D. Plan

### D.1 Brechas principales
1. La tienda existe pero está apagada y la vitrina saca al padre de la app.
2. Cero producto para marcas, mientras la landing vende $199.000–$549.000/mes.
3. El acudiente entra por obligación (pagar), no por hábito: 27 % activo semanal.
4. El deportista adulto no tiene razón para volver: estadísticas y objetivos con adopción ~0; Explorar invisible en producción.
5. No hay puente entre familia/atleta y Canchas.

### D.2 Top 10 mejoras (impacto / esfuerzo)

| # | Mejora | Impacto | Esfuerzo |
|---|---|---|---|
| 1 | **Corregir la landing** (Marcas, Proveedores, Equipamiento, Deportistas): quitar promesas no construidas, cifras infladas y productos de marcas sin acuerdo; pasar a «lista de espera» | Alto (confianza, legal) | Bajo |
| 2 | **Inicio del acudiente `UX-15`**: «Por pagar» + tarjeta del hijo + próximo entreno + aviso del club | Alto | Medio (1 sem) |
| 3 | **Encender la tienda escolar** con un piloto (Monster): aplicar las 3 migraciones revisadas, vitrina dentro del shell, compras dentro de Pagos | Alto (ingreso por adicional) | Medio |
| 4 | **Arreglar `SHOW_EXPLORE`** (leer `VITE_SHOW_EXPLORE`) y decidir si se muestra | Medio | Muy bajo |
| 5 | **SportPoints F0** (solo medir: puntos por acceso directo, push, informe abierto, pago a tiempo) sin premios todavía | Alto | Medio |
| 6 | **«Beneficios de aliados» v0**: códigos de descuento de 2-3 marcas locales en una tarjeta del Inicio, medidos por vista y canje, sin datos personales | Medio-alto | Bajo |
| 7 | **Informe mensual como momento del mes**: push + enlace (portal sin login para quien no quiere cuenta) | Alto | Medio |
| 8 | **Racha y reto del deportista** (asistencia de la semana, reto del club) | Medio | Medio |
| 9 | **Reservar cancha desde la app del atleta/acudiente** (cruce con Canchas) | Alto (ingreso nuevo) | Medio-alto |
| 10 | **Unificar `store_owner` → `external_vendor`** y matar las rutas duplicadas; ingresos de tienda a `cash_ledger` | Medio | Medio |

### D.3 Ciclo semanal de familia y deportista (por qué abren la app)

| Día | Disparador | Qué ven | Acción útil |
|---|---|---|---|
| Lunes | Push «Semana de Mateo» | Entrenos de la semana, cambios de horario | Confirmar asistencia |
| Después de cada entreno | Push del coach | Nota corta / autoevaluación | Responder en 1 toque (gana puntos) |
| Mitad de semana | Reto del club o de una marca aliada | Progreso del reto del equipo | Sumar asistencia |
| Viernes | Resumen | Racha, asistencia del mes, beneficio de aliado | Abrir beneficio |
| Fin de mes | Informe mensual + cobro | Informe del hijo y «Por pagar» | Pagar a tiempo (puntos) |

Principio: **premiar participación, nunca rendimiento del niño** (SportPoints §2). El pago no es el gancho; es lo que ocurre cuando ya están adentro.

### D.4 Cómo monetizan tiendas y marcas sin cobrar comisión a las familias

- **La familia nunca paga una comisión de SportMaps.** Paga el precio que fija la escuela (memoria `feedback_school_decides_pricing`).
- **Tienda escolar:** la escuela paga el adicional ($49.000/mes, o incluido en Elite). El cobro va por **su** pasarela (Wompi/MP conectado). SportMaps no se queda con un porcentaje del uniforme.
- **Proveedores/confeccionistas:** cuota fija por aparecer como «proveedor recomendado» ante escuelas (B2B), con pedidos por lote de uniformes de un club. Cobro al proveedor, no al padre.
- **Marcas:** paquetes de **visibilidad medible** al estilo Strava: reto patrocinado del mes, beneficio en el Inicio, presencia en torneos/carnets. Se cobra por campaña con reporte agregado (vistas, canjes); **nunca** datos personales ni segmentación de menores. Las marcas ponen los premios de SportPoints.
- **Escuelas:** las marcas pueden patrocinar a la escuela (uniformes, torneo); SportMaps intermedia y reporta. Fondo de recaudo por jugador estilo Heja como idea futura.

### D.5 Cambios a la landing

1. **Marcas:** quitar «el más grande de Latinoamérica» y «+10.000»; usar cifras reales («18 escuelas, ~1.100 deportistas activos, Bogotá y Duitama»); cambiar los 3 planes por «Programa de marcas aliadas — piloto» con formulario.
2. **Proveedores:** quedarse en «Proveedor recomendado para escuelas» (directorio + contacto); quitar cotizaciones, CRM, API y soporte 24/7.
3. **Equipamiento:** despublicar o convertir en «Tienda de tu escuela» (vitrina de clubes reales); quitar 24-48 h, devoluciones y productos Nike/Adidas.
4. **Deportistas:** mantener «gratis siempre»; mover «scouts», «highlights» e «historial portable» a «Próximamente»; agregar «Reserva canchas» cuando exista.
5. **Partners:** verificar o retirar los KPIs.

### D.6 Tres ideas de contenido por rol

- **Tiendas / proveedores:** (1) «Cómo una escuela vende el uniforme sin manejar efectivo» (caso Monster); (2) guía de tallas por edad para uniformes de formación; (3) calendario de compras del año escolar deportivo (inscripción, torneos, fin de año).
- **Marcas:** (1) «Qué ve una familia deportista cada semana» con datos agregados; (2) caso del primer reto patrocinado; (3) guía de patrocinio responsable de menores (qué sí, qué no).
- **Acudientes:** (1) «Cómo leer el informe mensual de tu hijo»; (2) checklist de la maleta para entreno y torneo; (3) nutrición e hidratación para niños deportistas (con el profesional de salud de la plataforma).
- **Deportistas:** (1) retos de 4 semanas por deporte; (2) «Cómo subir tu nivel en pádel/fútbol 5» enlazado a reservar cancha; (3) historias de deportistas de las escuelas cliente (con autorización).

### D.7 De familia/deportista a jugador de SportMaps Canchas

1. **Mismo login, nueva puerta:** ítem «Reservar cancha» en el Inicio del atleta adulto y en «Más» del acudiente, que abre los clubes de Canchas cercanos (requiere arreglar Explorar).
2. **Cancha de la propia escuela primero:** si la escuela tiene instalaciones en Canchas, el padre reserva para entrenar con su hijo el fin de semana; la escuela gana ocupación.
3. **Partidos abiertos y nivel** (lección Playtomic): el adulto independiente se une a partidos con nivel estimado; el reto del club suma puntos.
4. **Cobro dividido** entre jugadores (lección Playtomic) por el enlace de pago del club, sin comisión a la familia; el club paga Canchas Pro.
5. **WhatsApp como canal:** el bot del club ofrece «¿quieres reservar cancha este sábado?» a familias ya identificadas por teléfono.
6. **SportPoints y marcas:** una marca aliada patrocina «primera reserva con descuento»; la marca paga, no SportMaps.

**Orden sugerido:** landing honesta (1) → Inicio del acudiente (2) → Explorar (4) → piloto de tienda (3) → SportPoints F0 + beneficios (5, 6) → reservar cancha desde la app (9).
