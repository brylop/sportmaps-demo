# SportPoints — puntos por usar la app (todas las escuelas)

Estado: **PROPUESTA** (2026-10-07). Sin código ni migraciones. Decisiones del usuario del 2026-10-07: puntos **por persona** (D-1), premios = **gift cards de marcas** (§5), bono de bienvenida **muy llamativo** estilo Puntos Colombia (§3.1). Pendientes: D-2 (escuelas), D-6 (entrenadores), proveedor de gift cards (D-8).

> **Actualización 2026-10-07 (usuario): no hay presupuesto para premios.** El orden cambia:
> 1. **Primero medir si la gente cumple** (F0, acudientes **y entrenadores**), sin prometer premios concretos.
> 2. **Los premios los ponen marcas aliadas** a cambio de visibilidad ante familias deportistas: códigos de descuento (ropa, bebidas, comida), productos, gift cards patrocinadas. SportMaps no compra bonos.
> 3. Las cifras de §3.1 y §5.1 quedan como referencia del valor percibido, **no** como costo de SportMaps. El "1 punto = $1" se vuelve "1 punto = $1 de beneficio de aliado".
> 4. Pitch a marcas con audiencia real (2026-10-07): 18 escuelas, ~1.131 atletas activos, 51 entrenadores, 394 familias conectadas; Bogotá y Duitama. Lo que se ofrece a la marca: aparecer en la app donde la familia entra cada semana, canjes medibles (cuántos vieron, cuántos canjearon) y, si se quiere, presencia en eventos/torneos. **Nunca** se venden ni comparten datos personales de familias o menores.
> 5. Las marcas también son **posibles compradores** del SaaS o patrocinadores de escuelas: el mismo contacto abre las dos puertas.

## 1. Por qué

Medido el 2026-10-07 en la base viva (escuelas no demo, acudientes con hijo activo):

| | Acudientes | % |
|---|---|---|
| Vinculados a un hijo | 394 | 100 % |
| Entraron alguna vez | 394 | 100 % |
| Entraron en los últimos 30 días | 167 | 42 % |
| Activos en los últimos 7 días | ~107 | 27 % |
| Con **acceso directo** instalado (PWA, `display_mode='standalone'`) | 104 | 26 % |
| Con push activado | 95 | 24 % |
| Con app nativa | 0 | 0 % |

Por escuela: Dynasty 330 vinculados (87 acceso directo, 81 activos 7d); Besser 53 (16 acceso directo, 28 activos 7d, 51 entraron en 30 días); Carmel y Spirit All Stars **0–1 vinculados** de 99 menores cada una (problema de invitación, no de motivación).

La autoevaluación post-entreno de Besser se responde ~4 % (24 de 557 avisos), y el 74 % de los acudientes no tiene push. **El objetivo de SportPoints es subir tres números**: acceso directo instalado, push activado y acciones útiles por semana (autoevaluación, informe abierto, pago a tiempo).

## 2. Principios

1. **Los puntos solo los otorga el servidor**, como efecto de una acción real ya registrada (trigger o RPC). El cliente nunca dice "gané puntos". Mismo criterio que el dinero.
2. **Libro inmutable.** Cada punto es una fila en `sportpoints_ledger` (crédito o débito); el saldo es la suma. Nada de `UPDATE saldo`.
3. **Idempotente por acción.** Clave única `(user_id, action_key, ref_id)`: abrir el mismo informe diez veces suma una.
4. **Topes anti-farmeo** por acción y por día.
5. **Los puntos no son dinero.** No se compran, no se transfieren, no se cambian por efectivo y vencen. Así no hay pasivo financiero ni riesgo regulatorio.
6. **La escuela decide sus premios** (principio de [[feedback_school_decides_pricing]]). SportMaps pone el motor, el nivel y los premios de plataforma.
7. **Premiar participación, nunca rendimiento deportivo** del niño.

## 3. Qué da puntos (catálogo inicial)

| Acción | Puntos | Límite | Fuente que lo confirma |
|---|---|---|---|
| **Bono de bienvenida** (al entrar al programa) | **5.000** | 1 vez | primera visita a SportPoints |
| Instalar el acceso directo | 2.000 | 1 vez | `user_devices.installed_at` / `display_mode='standalone'` |
| Activar notificaciones | 2.000 | 1 vez | `push_subscriptions` nueva |
| Completar la ficha del acudiente | 1.000 | 1 vez | perfil con campos obligatorios |
| Aceptar el consentimiento de informes | 1.000 | 1 vez | registro de consentimiento |
| Autoevaluación post-entreno | 200 | 1 por sesión y niño | `performance_entries` `rpe_borg` |
| Abrir el informe mensual | 300 | 1 por informe | `athlete_reports.viewed_at` |
| Pagar la mensualidad a tiempo | 500 | 1 por cobro | `payments.status='paid'` antes de `due_date` |
| Inscribir el débito automático | 3.000 | 1 vez | `recurring_subscriptions` activa |
| Racha: 4 semanas seguidas con al menos una acción | 1.000 | 1 por racha | job semanal |
| Referir una familia que se inscribe | 5.000 | sin límite | inscripción activa con código del referido |
| **Entrenador:** cerrar la asistencia el mismo día | 100 | 1 por sesión | `attendance_sessions` |
| **Entrenador:** publicar el informe mensual | 200 | 1 por informe | `athlete_reports.published_at` |

### 3.1 Escala "llamativa" (decisión del usuario)

Los números van grandes a propósito, como Puntos Colombia: **1 SportPoint = $1 COP de costo de premio**. El primer día el acudiente ve **~9.000 puntos** (bienvenida + acceso directo + notificaciones), cerca de la mitad de su primer bono. Ese "ya casi llegas" es el gancho.

Ritmo de una familia activa (8 entrenos al mes): 8 × 200 + 300 + 500 + ~250 de racha ≈ **2.650 puntos/mes**. Con el arranque de 9.000, el primer bono de $20.000 llega en **~4 meses**; los siguientes, cada ~7–8 meses.

Valores y catálogo editables por plataforma en una tabla (`sportpoints_actions`), no en código.

## 4. Niveles y tarjetas

Nivel por puntos acumulados **en los últimos 12 meses** (para que el nivel se mantenga con uso):

| Tarjeta | Puntos | Qué ve el usuario |
|---|---|---|
| Bronce | 0–9.999 | Tarjeta digital con su nombre y escuela |
| Plata | 10.000–29.999 | Tarjeta plata + acceso a premios de nivel Plata |
| Oro | 30.000–79.999 | Tarjeta oro + premios Oro + reconocimiento en la escuela |
| Diamante | 80.000+ | Tarjeta diamante + premios exclusivos |

La tarjeta vive en el perfil y se puede compartir como imagen (se reutiliza el render de Carnets Digitales).

## 5. Premios: gift cards de marcas (decisión del usuario)

Al llegar a una cantidad de puntos, el acudiente canjea una **tarjeta de regalo digital**. Marcas pedidas: **Dollarcity, Roblox, Crepes & Waffles, Panamericana**, y otras del mismo estilo.

| Gift card | Puntos | Costo para SportMaps |
|---|---|---|
| $20.000 | 20.000 | $20.000 (+ comisión del proveedor) |
| $50.000 | 50.000 | $50.000 |
| $100.000 | 100.000 | $100.000 |

Más premios sin costo que mantienen el interés entre bonos: tarjeta de nivel, insignias, "familia del mes".

**Cómo se consiguen las gift cards (D-8):** comprar bonos uno a uno en cada marca no escala. Hay agregadores de bonos digitales corporativos que venden muchas marcas por un solo contrato y, algunos, por API:
- **Fluz Fluz** (Colombia): marketplace de bonos digitales con más de 100 aliados retail.
- **Bonnus** (México): plataforma de gift cards y programas de lealtad con API REST.
- Roblox es global: se consigue por agregadores internacionales.

Hay que confirmar con el proveedor qué marcas de la lista tiene, el descuento corporativo (suele bajar el costo real) y si entrega el código por API para que el canje sea automático.

**Canje:** RPC `SECURITY DEFINER` transaccional que valida saldo, debita los puntos y crea la orden; un job pide el código al proveedor y se lo entrega al acudiente en la app y por correo. Si el proveedor falla, los puntos se devuelven. Topes: máximo 1 canje por persona cada 30 días y un presupuesto mensual global que, al agotarse, pone los canjes en lista de espera.

**Premios de la escuela (D-2, pendiente de hablar con las escuelas):** descuento en la mensualidad, uniforme, clase extra, con el costo a cargo de la escuela.

### 5.1 Cuánto cuesta

Si todas las familias activas canjean al ritmo de §3.1, el costo es de **~$2.650 por familia activa al mes**. Hoy hay ~107 acudientes activos por semana → **~$280.000/mes**; con 400 activos, **~$1.060.000/mes**. Es el techo: en la práctica no todos canjean. Se controla con el presupuesto mensual y bajando puntos por acción si hace falta. Fuentes para pagarlo: margen del SaaS, comisión del débito automático y, después, marcas aliadas que pongan sus propios bonos.

## 6. Datos (borrador, se detalla en el plan de F0)

- `sportpoints_actions` (catálogo: key, puntos, tope, activo)
- `sportpoints_ledger` (user_id, school_id, action_key, ref_id, puntos ±, motivo, created_at; UNIQUE (user_id, action_key, ref_id)); estado/tipo en `text + CHECK`
- `sportpoints_rewards` (school_id NULL = de plataforma, costo, cupo, nivel mínimo, vigencia)
- `sportpoints_redemptions` (reward_id, user_id, estado text+CHECK, voucher)
- Vista `v_sportpoints_balance` (saldo, puntos 12 meses, nivel)
- RLS: el usuario lee lo suyo; el staff de la escuela lee los de su escuela vía `user_staff_school_ids()`; escritura solo por RPC/trigger.

## 7. Fases

- **F0 — medir y acumular:** tablas, catálogo, triggers de las 6 acciones más simples (acceso directo, push, autoevaluación, informe abierto, pago a tiempo, entrenador cierra asistencia). Sin UI. Backfill **sin puntos retroactivos** **[D-4]**. Tablero interno de adopción.
- **F1 — mostrar:** saldo, nivel y tarjeta en el perfil; aviso "+20 SportPoints" al completar la acción; banner "instala la app y gana 100".
- **F2 — canjear:** gift cards por el proveedor elegido (D-8), presupuesto mensual, entrega del código; después, premios de escuela si D-2 se aprueba.
- **F3 — aliados y referidos.**

## 8. Decisiones

| # | Decisión | Estado |
|---|---|---|
| D-1 | Puntos por persona o por escuela | **Cerrada: por persona** (sirven en cualquier escuela; se guarda el desglose por escuela) |
| D-2 | ¿Las escuelas ofrecen premios propios (descuento en mensualidad)? | Pendiente: el usuario habla con las escuelas |
| D-3 | Premios de aliados | **Cerrada: gift cards de marcas** (§5) |
| D-4 | Bono de bienvenida | **Cerrada: sí, muy llamativo** (5.000 + acciones de arranque, §3.1). Los 104 que ya tienen acceso directo reciben también esos 2.000 al entrar |
| D-5 | Vencimiento | Propuesta: 12 meses desde que se ganaron |
| D-6 | ¿Entrenadores desde la F0? | **Cerrada: sí** |
| D-7 | Nombre | SportPoints |
| D-8 | Fuente de premios | **Cerrada: marcas aliadas sin costo para SportMaps**; agregadores de bonos solo si ofrecen modelo sin costo o lo paga la marca. Presupuesto propio = $0 |

## 9. Riesgos

- **Farmeo:** cubierto por idempotencia, topes y fuente en el servidor.
- **Puntos que nadie puede canjear:** si en F1 no hay premios, el programa pierde fuerza; la F2 tiene que llegar pronto o la F1 tiene que mostrar los premios que vienen.
- **Carmel/Spirit:** los puntos no arreglan la falta de invitación; primero hay que vincular a los acudientes.
- **Pagar a tiempo como acción:** solo suma puntos, nunca descuenta; no debe sentirse como castigo para quien no puede pagar.

## 10. Puntos Colombia (evaluado 2026-10-07)

Programa de coalición de Bancolombia y Grupo Éxito: ~9 millones de personas, miles de marcas aliadas, ~$400.000 millones en puntos movilizados en 2024. **Un punto vale ~$6–7 al redimir.** Hay dos maneras de integrarse, y no se parecen:

| | A. SportMaps **da** Puntos Colombia | B. Las familias **pagan con** Puntos Colombia |
|---|---|---|
| Qué ve la familia | "Gana Puntos Colombia usando SportMaps" | "Paga la mensualidad con tus Puntos Colombia" |
| Quién paga | En una coalición, el aliado que otorga puntos se los compra al programa (~$6–7 c/u). **Cuesta plata** | El programa le paga al comercio lo que la familia redime. **No le cuesta a SportMaps; le entra plata a la escuela** |
| Encaje con "sin presupuesto" | ❌ (salvo que una marca lo financie) | ✅ |
| Riesgo | Pasivo de puntos | Ruteo del dinero: lo que pague Puntos Colombia tiene que llegar a la cuenta de la escuela, no a la de SportMaps (mismo principio del plan maestro de cobros) |

**Recomendación:** proponerles la **B** como medio de pago dentro del checkout de mensualidades y servicios, con cada escuela como comercio aliado (o SportMaps como integrador que no recibe el dinero). SportPoints sigue siendo propio y gratuito; la A solo si una marca patrocina la conversión.

Preguntas para Puntos Colombia: ¿se puede ser aliado **redentor** sin ser acumulador? ¿Integración por API para redimir en un checkout propio? ¿El pago se le hace a cada comercio (escuela) o al integrador? ¿Comisión por redención y plazo de pago? ¿Requisitos para pymes/escuelas pequeñas? Datos: ¿qué piden y qué comparten (Ley 1581)?
