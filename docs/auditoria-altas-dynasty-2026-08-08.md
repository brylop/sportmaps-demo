# Auditoría — altas de Dynasty del 30-jul al 8-ago de 2026

**Fecha:** 2026-08-08 · **Escuela:** DYNASTY VOLLEY CLUB (`2d509571-3238-4c04-ac3f-6dfe20539226`)
**Método:** solo lectura, seis bloques SQL sobre la base viva —
[`scripts/dynasty-nuevos-registros-2026-08-08.sql`](../scripts/dynasty-nuevos-registros-2026-08-08.sql).
**Antecedente:** [`plan-mitigacion-dynasty-2026-08-03.md`](plan-mitigacion-dynasty-2026-08-03.md) ·
[`triage-sin-cobro-agosto-2026-08-06.md`](triage-sin-cobro-agosto-2026-08-06.md)

> Este documento **no define prioridades**. Las define [`ROADMAP.md`](ROADMAP.md). Acá se reporta
> qué se midió y se propone dónde encaja cada hallazgo en la cola que ya existe — y qué se
> encontró que hoy **no tiene dueño**.

---

## 0. Alcance y límites

**Qué se midió:** 77 altas de atleta, sus inscripciones, sus cobros vivos, los duplicados contra el
roster anterior al 30-jul, y las invitaciones del período.

**Qué NO se midió, y hay que decirlo antes de leer las conclusiones:**

| Hueco | Consecuencia |
|---|---|
| El bloque 5 (cobros emitidos, con período y `payment_date`) **no se corrió** | No se sabe a qué mes quedó rotulado cada cobro nuevo, ni cuántos son pagos atrasados cargados a mano |
| El bloque 4 llegó **truncado** en la carga del 30-jul ~09:50 | El análisis de inscripciones cubre del 31-jul al 8-ago completo y el 30-jul solo parcialmente |
| El bloque 3 compara altas nuevas **solo contra el roster viejo** | Los duplicados donde ambos lados son posteriores al corte se encontraron leyendo el bloque 2 a mano, no con el script (ver A-6) |
| No se verificó si las migraciones del 4-ago están **aplicadas** en la base | El ledger las tiene; la base se migra a mano. Ver §3 |

---

## 0.1 Revalidación del 2026-08-12 — qué cambió en 4 días

La primera lectura se hizo sobre datos del **8-ago**. Esta revalidación corrió contra la base viva el
**12-ago**, directo por MCP. **El problema no está contenido: sigue produciendo.**

| Medida | 8-ago | 12-ago | |
|---|---|---|---|
| Altas en el rango | 77 | **93** | +16 en 4 días |
| Altas ya inactivas | 0 | **3** | la escuela empezó a desactivar duplicados |
| Personas duplicadas | 8 (17 registros) | **13** (27 registros) | **5 grupos nuevos, creados entre el 10 y el 12-ago** |
| Períodos cobrados dos veces | sin medir | **0** | ✅ ningún grupo cobró doble |
| Grupos con 2+ inscripciones activas | sin medir | **10 de 12** | es lo que factura septiembre |
| Cobros de menor sin pagador (toda la escuela) | 5 en las altas nuevas | **142 / $21.440.000** | **58% de la cartera viva** ($37M / 243 cobros); el último emitido **hoy 17:12** |
| Cobros de no registrado sin ruta | 3 / $410.000 | **3 / $410.000** | sin cambio |
| Inscripciones `pending` vivas | ~11 | **16** | 12 atletas con `pending` **y** `active` a la vez |
| Equipo «NO USAR» | recibiendo | **3 activas, sin movimiento desde el 5-ago** | se frenó solo; sigue sin desactivar |

### La buena: cero doble cobro

Los 12 grupos detectados **no tienen ningún período cobrado en dos identidades**. En cada grupo la
plata está de un solo lado. Verificado con el bloque 7.a y confirmado caso por caso en 7.b.

**La fusión es preventiva, no un incendio.** Eso baja la urgencia de `DIN-11`… pero solo hasta la
próxima apertura de mes: **10 de 12 grupos tienen dos inscripciones activas**, y septiembre las va a
facturar a las dos.

### La mala: B-2 era falso, y hay una vía sin guard

El viernes dije que el fix de `pending` funcionaba porque no había pares nuevos después del 5-ago.
**Apareció uno el 10-ago:**

> **Valeria Prieto Alfonso** — `pending` (PLAN PRO, $150.000, sin equipo) a las **17:06:01**, y
> `active` (MINIVOLLEY BENJAMINES, **el mismo PLAN PRO, la misma cuota**) a las **17:08:45**.

Eso no lo explica un despliegue atrasado: el fix entró a `main` el **6-ago**
([`732208a`](https://github.com), release 2026-08-06), cuatro días antes. Y las condiciones son
exactamente las que el merge de [`enrollments.ts`](../bff/src/routes/enrollments.ts) cubre — misma
fila abierta, mismo plan, a la `pending` solo le faltaba el equipo. Debió fusionar y no fusionó.

**Conclusión: el alta no pasó por `POST /enrollments`.** Hay otra vía que crea inscripciones sin el
guard. Es la vía B del plan de `DIN-1` ([`students.ts:829`](../bff/src/routes/students.ts#L829)) o
una tercera todavía no identificada. **Identificarla es ahora el primer paso de la Ola 1**, porque
mientras esté abierta, cerrar `POST /enrollments` no alcanza.

### El detector todavía tiene un punto ciego

Los 12 grupos salen de comparar **nombre normalizado exacto**. Por eso **Jerónimo Balaguera no
aparece**: sus dos registros se llaman «Jerónimo Balaguera Barrera» y «JERONIMO BALAGUERA» — un
apellido de diferencia. Por eso son 13 personas y no 12. Cualquier barrido por igualdad exacta va a
seguir perdiendo este caso; hace falta la comparación difusa que ya tiene
[`audit-duplicate-athletes.mjs`](../scripts/audit-duplicate-athletes.mjs).

### Los 5 duplicados nuevos

| Persona | Ficha vieja | Registro nuevo | Señal |
|---|---|---|---|
| Alexander Castillo | 6-jul, doc `1030573939`, **nac 1990** | 12-ago 17:14, sin doc ni nacimiento | adulto guardado como menor |
| Darwin Hernández | 6-jul, doc `80441327`, **nac 1972** | 10-ago 19:52, sin doc ni nacimiento | ídem |
| Esteban Daniel Herrera Rodríguez | 6-jul, **menor** | 11-ago 19:30, **adulto** | `adult ← child`: la adulta sobrevive siempre |
| Jefferson Steven Rojas Preciado | 6-jul, doc `1030595288` | 11-ago 20:52, doc `1030595277` | dos dígitos finales cambiados |
| Laura Sofía Castillo Cabra | 6-jul, doc `1013144764` | 12-ago 17:13, sin doc ni nacimiento | |

Los tres del 10–12 de agosto sin documento **ni** fecha de nacimiento son la misma forma: alguien
cargando a mano sobre un padrón que ya tenía a esa persona.

---

## 1. Qué está bien — verificado con datos, no supuesto

Esto importa tanto como lo que falla: son fixes recientes que **se comprobó que funcionan en
producción**, y no hay que volver a tocarlos.

| # | Qué funciona | Evidencia |
|---|---|---|
| **B-1** | **La fusión de inscripciones partidas.** El alta genera hasta 3 filas (`pending` sin destino → `cancelled` intermedia → `active` con equipo y plan) y **siempre termina en una sola activa**. Kristen Salomé, Victoria Ávila, Edward Becerra, Maria Gabriela Medina, Linda Saray: el patrón se repite y cierra bien | Bloque 4, decenas de casos |
| **B-2** | ~~El fix «`pending` también cuenta como inscripción abierta» ([`d1be3a9`](../bff/src/routes/enrollments.ts), 5-ago) funciona~~ ❌ **FALSIFICADO el 12-ago.** Ver §0.1 — apareció un par nuevo el 10-ago, con el fix ya en `main` desde el 6-ago | — |
| **B-3** | **La adopción de ficha precargada SÍ funciona por la vía de invitación.** «DAIMARIS VASQUEZ PEREZ» (no registrada) quedó `cancelled` a las 19:03 y «Dai Vázquez» (adulta) `active` a las 19:07. `accept_invitation_pro` fusionó sola | Bloque 4, 4-ago 19:03/19:07 |
| **B-4** | **No se repitió el escenario de «entraron y nadie les cobró».** 71 de 77 altas tienen cobro vivo. Los 6 sin cobro son 3 duplicados + 3 casos con destino incompleto | Bloque 2 |
| **B-5** | **Cero bajas.** Ninguna de las 77 altas quedó inactiva: no hay gente entrando y saliendo por error | Bloque 1, `ya_inactivos = 0` |
| **B-6** | **El índice único de `invitations` aguanta.** 46 invitaciones en 9 días, sin pares duplicados por doble clic | Bloque 6 |

---

## 2. Qué está mal — hallazgos abiertos

Ordenados por plata y por urgencia, no por cuándo aparecieron.

### A-1 · Identidades duplicadas: 8 personas en 17 registros 🔴

> **Revalidado el 12-ago: son 13 personas en 27 registros.** La tabla de abajo es la foto del 8-ago;
> los 5 grupos nuevos están en §0.1. Ninguno cobró doble — todavía.

La causa raíz ya está documentada: **el auto-registro no adopta la ficha que la escuela precargó**.

| Persona | Registros | Origen del gemelo |
|---|---|---|
| Valentina Barreto García | **3** (ficha 6-jul + dos auto-registros del 6-ago, 17 min aparte) | precarga + doble auto-registro |
| Josue Cortes Saenz | 2 | precarga 6-jul |
| Gabriela Buitrago Forero | 2 | precarga 6-jul |
| Luis Alejandro Parra Moreno | 2 | precarga 6-jul |
| Anaisabel Mondragón Mejía | 2 | precarga 6-jul |
| Gabriela Simbaqueva Pedraza | 2 | dos altas del 5-ago, correos `marcianap@` vs `marcianapv@` |
| Jerónimo Balaguera | 2 | altas 3-ago y 4-ago, nacimientos 04-04 vs 15-04 |
| Julieta Mayorga Veloza | 2 | papá y mamá la cargaron por separado |
| *(Valentina cuenta una sola vez arriba)* | | |

**Riesgo:** cada lado es facturable por separado. Falta cruzar los cobros de ambos lados de cada par
para saber cuántos ya cobraron dos veces — es lo primero que hay que correr.

**Falso positivo confirmado:** Gabriela y **Juliana** Simbaqueva comparten fecha de nacimiento pero
tienen documentos consecutivos (`…363` / `…364`). Son gemelas. **No fusionar.**

### A-2 · Inscripciones `pending` colgadas que ya emitieron cobro 🔴

`submit_qr_signup` crea la inscripción como `pending` **y emite el primer cobro**
([`20260803110621`](../supabase/migrations/20260803110621_qr_signup_enrollment_completa.sql#L222-L255)).
Cuando la escuela después le asigna equipo y plan, si el plan es **distinto** al que traía la
`pending`, el reemplazo no aplica (está restringido a filas `active` a propósito, porque anular ese
cobro es plata de una familia) y nace una segunda fila.

Resultado: ~10 atletas con una `pending` viva cuyo **cobro corresponde a un plan que ya no tienen**.

> Isabella Carreño: `pending` del 3-ago con «SENIORS 8 Clases» ($130.000) y `active` del 4-ago con
> PLAN PRO ($150.000). **Su cobro es de $130.000.** No es el plan cambiado después de emitir: es la
> inscripción equivocada la que facturó.

El código ya prevé este caso y lo manda a un `409` para que lo resuelva un humano. **Lo que no
existe es la cola de ese trabajo humano ni la pantalla donde se ve.**

Afectados detectados: Isabella Carreño, Isabella Sánchez, Manuela Góez, Sara Valeria Acosta, Leidy
Pallares, Sara Lucia Yory, Maria Antonia Arturo, Julieta Mayorga, Kristen Salomé, Nathalie Puentes,
Manuela Bermudez.

### A-3 · Ocho cobros que nadie puede pagar — $1.100.000 🟠

`payments.parent_id` se copia congelado al emitir. Si el acudiente no tiene cuenta, queda NULL y el
guard anti-IDOR responde 403 al propio acudiente.

| Caso | Monto | ¿Se destraba solo? |
|---|---|---|
| 5 menores con acudiente sin cuenta (Gabriela Simbaqueva, Avril Sofía, Victoria Osorio, Isabella Prieto, Salomé Pamplona) | $690.000 | **Sí** — el trigger de [`20260804204905`](../supabase/migrations/20260804204905_backfill_pagador_al_vincular_acudiente.sql) hereda el pagador al vincular |
| 3 no registrados (Edgar Zerda, Yenny Porras, Valentina Castellanos) | $410.000 | **No.** No hay acudiente al que vincular. Sin ruta |

> **Revalidación 12-ago — el número real es mucho mayor.** Los 5 de arriba son solo los de las altas
> nuevas. A escala de toda la escuela hay **142 cobros vivos de menor sin pagador por $21.440.000**,
> y el último se emitió **hoy a las 17:12**: se siguen produciendo. No es un bug —es la cartera de
> las familias que nunca aceptaron la invitación— pero es **el 58% de toda la cartera viva de la
> escuela** ($21.440.000 de $37.000.000 en 243 cobros) esperando a que alguien haga clic en un correo
> que en muchos casos nunca salió (el `429` de Resend del 6-jul).

### A-4 · La vigencia se sigue regalando 🟠

Altas del 5-ago que expiran el **4-oct** (Sofia Barón), del 4-ago que expiran el 3-oct (María Natalia
Lemus), del 2-ago al 1-oct (Luciana Sandoval). Dos meses de acceso por un pago. Y una parte
importante de las inscripciones nuevas tiene `expires_at` **NULL** — acceso sin vencimiento.

### A-5 · El equipo marcado «NO USAR» sigue recibiendo inscripciones 🟠

«MINIVOLLEY -BENJAMINES (DUPLICADO - NO USAR)» recibió **4 inscripciones nuevas** en el rango
(Mariangel Morales, Sara Valeria Acosta, Isabella Mateus, y una cancelada de Juan Martín Forero).
Renombrarlo con una advertencia no lo saca del selector.

### A-6 · El detector de duplicados no se ve a sí mismo 🟡

El bloque 3 compara altas nuevas contra el roster **anterior al corte**. Los 4 pares donde ambos
lados son nuevos (Simbaqueva, Balaguera, Mayorga, las dos Barreto entre sí) **no los detecta**. Los
encontré leyendo el bloque 2 a mano. Mismo defecto tendría cualquier barrido que use esa forma.

### A-7 · Higiene de captura: nada valida lo que se teclea 🟡

| Qué | Ejemplo |
|---|---|
| Fechas de nacimiento imposibles | LEIDY PASACHOA nacida el **2026-05-09**; AVRIL SOFIA el **2026-08-01**. Bebés de meses inscritas en volley |
| `start_date` retroactivo | AVRIL SOFIA: inscripción creada el 5-ago con inicio el **1-jul** → le genera cobro de julio |
| Adultos guardados como `children` | Salome Guarin (2005, 21 años) y todo el equipo SENIORS figuran como menores, con ellos mismos de acudiente |
| Documentos vacíos o con typos | Julieta Mayorga: `10112109601` (11 dígitos) vs `1011210629`. El índice único por documento **no dispara** |

### A-8 · Cobro sin inscripción 🟡

Isabella Romero González (`bf17b98c`): sin equipo, sin plan, inscripción en `pending`, y un cobro
vivo de $150.000.

---

## 3. Qué ya está corregido, y hasta dónde llega el arreglo

Esta tabla existe para **no volver a construir lo mismo**.

| Arreglo | Dónde | Cubre | **No** cubre |
|---|---|---|---|
| `pending` cuenta como inscripción abierta | [`enrollments.ts`](../bff/src/routes/enrollments.ts) · `d1be3a9` 5-ago | Merge cuando a la fila abierta le falta el dato que llega | La `pending` con un plan **distinto** → cae al 409 (A-2) |
| POST /enrollments rechaza segunda activa | `52f7ab1` 3-ago | Vía A del plan F0 | — |
| Fusión de inscripciones partidas | [`20260730000000`](../supabase/migrations/20260730000000_enrollment_no_split_rows.sql), [`20260803150126`](../supabase/migrations/20260803150126_merge_split_enrollments.sql), [`20260804161413`](../supabase/migrations/20260804161413_merge_split_enrollments_ve_pendientes.sql) | El patrón 3-filas cierra en una activa (B-1) | — |
| Guard anti-duplicado en alta individual | [`students-create-one.route.ts:123`](../bff/src/routes/students-create-one.route.ts#L123) | Documento exacto + nombre normalizado, contra `children` y `unregistered_athletes` | **Carga masiva** y **auto-registro por QR** — las dos vías que produjeron A-1 |
| Documento único por escuela | [`20260804202714`](../supabase/migrations/20260804202714_doc_number_unico_por_escuela.sql) | Red hacia adelante | **Hoy es casi inerte**: el padrón tiene el documento vacío en la mayoría de filas y los NULL no colisionan. Lo dice la propia migración |
| Pagador heredado al vincular acudiente | [`20260804204905`](../supabase/migrations/20260804204905_backfill_pagador_al_vincular_acudiente.sql) | Los 5 menores de A-3 | Los 3 no registrados de A-3 |
| Lotes de 100 + `email_sends` | onboarding safety F0, 30-jul | El `429` silencioso de Resend | — |

⚠️ **Verificar antes de planificar nada:** las migraciones del 4 y 5 de agosto están en el ledger,
pero esta base se migra a mano. Confirmar que están aplicadas es la puerta de entrada de cualquier
ola — igual que el primer paso de `DIN-1`.

---

## 4. Mapeo al roadmap — qué ya tiene dueño y qué no

**Nada de lo que sigue propone adelantarse a `DIN-1`**, que es el único bloqueante de producción.

| Hallazgo | Ítem del roadmap | Estado hoy | Qué hay que hacer |
|---|---|---|---|
| **A-2** pending con cobro | **`DIN-1`** (F0 generación de mes) | 🟡 plan escrito, sin aprobar | **Ampliar el plan**: cubre la vía A (`POST /enrollments`) y la B (`students.ts:829`), pero **no** la `pending` de QR que ya facturó. Es un caso nuevo, medido después de que se escribió el plan |
| **A-8** cobro sin inscripción | **`DIN-1`** | 🟡 | Entra en el mismo barrido de huérfanas |
| **A-1** identidades duplicadas | [`plan-fusion-identidades-duplicadas.md`](plan-fusion-identidades-duplicadas.md) | 🟡 plan escrito · **sin ID en el roadmap** | **Darle ID y fila.** Hoy es un plan huérfano: no aparece en la cola, así que formalmente «no existe» |
| **A-1** prevención (carga masiva + QR) | el plan de fusión lo declara explícitamente fuera de alcance: *«Falta llevarlo a la carga masiva y al auto-registro; va en un plan aparte»* | ❌ **ese plan aparte no existe** | **Crear.** Es lo único que evita que el problema se reproduzca en la próxima escuela |
| **A-4** vigencia regalada | [`plan-vigencia-por-periodo-pagado.md`](plan-vigencia-por-periodo-pagado.md) | 🟡 plan escrito · **sin ID en el roadmap** | **Darle ID y fila** |
| **A-5** equipo gemelo en el catálogo | [`specs/school-onboarding-safety.md`](specs/school-onboarding-safety.md) §1.3 | 🔵 spec cerrada, **sin plan de migraciones** | El roadmap solo tiene `MOD-1` = F1 (revisión previa al envío). El catálogo sin gemelos es otra fase del mismo spec y no está en la cola |
| **A-3** no registrados sin pagador | — | ❌ sin dueño | Decisión de producto, no técnica (§6) |
| **A-6** detector ciego a sí mismo | [`scripts/audit-duplicate-athletes.mjs`](../scripts/audit-duplicate-athletes.mjs) | script existente | Arreglo de una línea de alcance en el script y en el bloque 3 |
| **A-7** higiene de captura | — | ❌ sin dueño | Ítem nuevo, chico |

### Filas propuestas para `ROADMAP.md`

Para insertar tal cual, si se aprueban (no las agregué: el roadmap es la fuente única de
prioridades y esa edición es tuya):

| ID | Pendiente | Estado | Esfuerzo |
|---|---|---|---|
| `DIN-11` | **Fusión de identidades de atleta duplicadas.** 48 personas duplicadas en 16 escuelas; 28 con dos inscripciones activas. Sin esto, anular el cobro duplicado compra un mes: la siguiente apertura vuelve a generar los dos. Plan escrito. | 🟡 | 2 sem |
| `DIN-12` | **Prevención de duplicados en las dos vías abiertas** — carga masiva y auto-registro por QR. El guard existe solo en el alta individual. Es lo que evita repetir Dynasty en la próxima escuela. | ⚪ | 3–4 d |
| `DIN-13` | **Vigencia y clases derivadas del periodo pagado.** Hoy asignar el plan regala 30 días y el pago los **suma**: un mes pagado = dos de acceso. Plan escrito, decisiones de producto cerradas. | 🟡 | 1 sem |
| `MOD-16` | **Onboarding safety F3 — catálogo sin gemelos.** Equipos y planes duplicados no se pueden crear, y el gemelo existente se desactiva de verdad (no se renombra). | 🔵 | 3 d |
| `MOD-17` | **Higiene de captura.** Fecha de nacimiento con rango válido, `start_date` no retroactivo sin confirmación, y adulto ≠ `children`. | ⚪ | 2–3 d |

---

## 5. Plan propuesto

Cuatro olas. La regla que las ordena: **cerrar los productores antes de limpiar** — es la misma
corrección de orden que ya trae el §11 del plan de `DIN-1`, y por la misma razón: limpiar con la
llave abierta es trapear.

### Ola 0 — contener, sin código y sin migraciones *(esta semana)*

Nada acá toca el roadmap ni requiere aprobar un plan.

1. ~~**Correr el cruce de cobros de los grupos duplicados**~~ ✅ **hecho el 12-ago: cero doble
   cobro.** Ver §0.1. Esto es lo que permite que el resto se haga con calma y no de urgencia.
2. 🔴 **Identificar la vía que crea inscripciones sin pasar por el guard** (§0.1, caso Valeria
   Prieto). Es lectura de código, no migración, y **bloquea todo lo demás**: mientras esté abierta,
   cada limpieza se vuelve a ensuciar. Sospechosos por orden: el editor de atletas
   (`students.ts`), el modal de alta, las RPCs del QR.
3. **Resolver las 13 identidades duplicadas antes de la apertura de septiembre.** 10 de 12 grupos
   tienen dos inscripciones activas; si se abre el mes así, ahí sí nace el doble cobro. Criterio que
   sale de los datos: **sobrevive la que tiene cuenta y ya pagó** — en 4 de 5 casos la duplicada es
   la que no tiene cuenta y su correo es el typo (`iforero52@` vs `lforero52@`, `ggilnavarro@` vs
   `gglnavarro@`, `marcianapv@` vs `marcianap@`). Excepciones que necesitan ojo humano: **Josue
   Cortes** (dos acudientes distintos y la vieja tiene 3 asistencias) y **Esteban Daniel Herrera**
   (`adult ← child`: la adulta sobrevive siempre, es regla dura del plan de fusión).
4. **Desactivar el equipo «MINIVOLLEY -BENJAMINES (DUPLICADO - NO USAR)»** y mover a sus 3 atletas
   al equipo bueno. Dejó de recibir altas el 5-ago solo, pero sigue vivo en el catálogo.
5. **Revisar los cobros de las 16 `pending` vivas** (A-2) y decidir uno por uno: ¿vale el monto
   emitido o el del plan vigente?
6. **Corregir a mano las 2 fechas de nacimiento imposibles** y el `start_date` retroactivo de Avril.

> Las eliminaciones y fusiones de datos las ejecuta el dueño del producto, no yo. Acá se entrega el
> listado con IDs y la recomendación por caso.

### Ola 1 — `DIN-1`, ampliado *(el bloqueante que ya estaba primero)*

Sin cambios de prioridad: `DIN-9` (una sesión, el footgun de MercadoPago) sigue antes, y `DIN-1`
sigue siendo P0. Lo único que cambia es que **el plan de `DIN-1` incorpora tres casos nuevos** que
se midieron después de escribirse:

- **La vía sin guard del 10-ago** (§0.1). El plan nombra dos productores —`POST /enrollments` y
  `students.ts:829`—; el caso Valeria Prieto no encaja en el primero y hay que confirmar si es el
  segundo o un tercero. **Es el hallazgo que más cambia el plan**, porque su §11 ordena cerrar los
  productores antes de limpiar: si falta uno de la lista, el orden no protege.
- La `pending` de QR que ya facturó con un plan que después cambió (A-2).
- El cobro vivo sin inscripción (A-8) dentro del barrido de huérfanas.

Y un dato que **baja** el alcance: la revalidación midió **cero doble cobro**, así que la parte de
`DIN-1` que anula cobros duplicados no tiene material en Dynasty. Es merge de inscripciones, no
plata.

### Ola 2 — que no se reproduzca *(`DIN-12`, después `DIN-11`)*

**Primero la prevención, después la limpieza.** `DIN-12` lleva el guard de
`students-create-one.route.ts:123` a las dos vías que lo esquivan: carga masiva y `submit_qr_signup`.
Recién con esas cerradas tiene sentido `DIN-11` (fusionar las 48 identidades), porque si no, el
padrón se vuelve a ensuciar mientras se limpia.

### Ola 3 — el resto *(`DIN-13`, `MOD-16`, `MOD-17`)*

Vigencia, catálogo sin gemelos e higiene de captura. Ninguno bloquea a otro.

### Lo que este plan NO hace, a propósito

- **No adelanta `MOD-1`** (revisión previa al envío masivo). Ya está 🟡 con plan escrito y su turno
  no lo decide esta auditoría.
- **No toca el modelo de cobro** (plan manda, equipo = roster). Es no-objetivo declarado del spec de
  onboarding.
- **No construye multi-acudiente**, aunque Julieta Mayorga sea exactamente ese caso. Está fuera de
  alcance en el plan de fusión, con decisión tomada.
- **No borra ni fusiona nada** por iniciativa propia.

---

## 6. Decisiones abiertas — necesitan al dueño del producto

| # | Decisión | Por qué no la puedo tomar yo |
|---|---|---|
| **D-1** | Los 3 cobros de atletas **no registrados** sin pagador ($410.000): ¿se cobran por fuera de la app, se les crea acudiente, o se anulan? | Es plata de la escuela y no hay ruta técnica que los destrabe sola |
| **D-2** | En las `pending` colgadas (A-2): ¿vale el cobro emitido o el del plan vigente? | Cambia lo que la familia debe |
| **D-3** | En cada par duplicado: **quién sobrevive**. El plan de fusión exige que lo confirme un humano, siempre | Regla dura del plan, no una preferencia |
| **D-4** | ¿Los adultos hoy guardados como `children` (todo SENIORS) se migran a `adult`, o se dejan? | Migrarlos toca cobros vivos e identidades; dejarlos rompe informes y carnets |

---

## 7. Para que no se repita en la próxima escuela

Lo que Dynasty enseñó, en forma de precondiciones de onboarding. Esto es el insumo de `DIN-12` y de
la fase de revisión previa (`MOD-1`):

1. **La ficha precargada y el auto-registro tienen que encontrarse.** Funciona cuando la persona
   pasa por `accept_invitation_pro` (B-3) y falla cuando entra por QR o se registra sola (A-1). Hasta
   que el QR consulte el mismo guard, toda escuela que precargue padrón **y** publique QR va a
   duplicar.
2. **Un catálogo con gemelos ensucia el padrón para siempre.** El equipo duplicado de Dynasty se
   detectó el 30-jul, se renombró con «NO USAR»… y siguió recibiendo inscripciones 9 días después.
   Desactivar, no rotular.
3. **El documento no es una llave hasta que se exige.** El índice único existe y es inerte porque el
   padrón vino sin documentos. En el onboarding hay que exigirlo o asumir que no habrá red.
4. **Precargar padrón sin acudiente vinculado es emitir cartera incobrable.** 201 cobros por
   $30.320.000 esperando a que alguien acepte una invitación. El gate de revisión previa tiene que
   mostrarlo **antes** del envío masivo, no después.
5. **Toda cifra de esta auditoría salió de la base, no de la UI.** El contador de invitaciones ya
   mintió una vez (decía «Enviadas: 71» con las 71 rechazadas por Resend). Para la próxima escuela,
   medir en SQL.
