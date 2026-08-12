# Dynasty — lo que queda abierto después de la corrección del 12-ago-2026

**Escuela:** DYNASTY VOLLEY CLUB (`2d509571-3238-4c04-ac3f-6dfe20539226`)
**Ya aplicado:** [`dynasty-rerotular-periodos-2026-08-12.sql`](../scripts/dynasty-rerotular-periodos-2026-08-12.sql)
y [`dynasty-corregir-cobros-2026-08-12.sql`](../scripts/dynasty-corregir-cobros-2026-08-12.sql) — completos.

**Cómo se regenera esta lista:**
```bash
node scripts/audit-cobros-duplicados.mjs   --school Dynasty --json d.json
node scripts/audit-cobertura-cobros.mjs    --school Dynasty --json c.json
node scripts/audit-periodo-vs-fecha-pago.mjs --school Dynasty --csv revisar.csv
```

## Estado tras la corrección

| Eje | Antes | Ahora |
|---|---|---|
| 📧 Correos indebidos (impago a quien ya pagó) | 3 | **0** |
| A / A2 · duplicado sobre el mismo atleta | 0 | **0** |
| B · mismo periodo en dos fichas de la misma persona | 5 | **1** |
| C · doble facturable a futuro | 10 | **13** |
| D · cobros nacidos vencidos | 5 | **1** |
| E · pago rotulado al mes anterior | 3 | **1** |
| Rótulo = mes del pago | 169 / 204 | **185 / 204** |
| Cobros sin `period_*` (fuera del índice único) | 3 | **0** |

> El eje C **subió de 10 a 13** y no es un empeoramiento: al cancelar los cobros duplicados, esas
> fichas gemelas dejaron de contarse en el eje B («ya cobrado doble») y pasaron al C («cobrará doble
> en la próxima apertura»). Es la misma gente cambiando de casilla.

---

## 1. Fusiones de identidad — 13 personas · $1.770.000/mes 🔴

Lo más grande que sigue vivo. Cada persona existe dos o tres veces en la escuela y **cada ficha es
facturable por separado**: la próxima apertura de mes les emite un cobro a cada una.

Cancelar cobros no alcanza. Hay que **fusionar**: trasladar equipo, cuota y pagos a la ficha que
sobrevive, vincular la absorbida por `linked_profile_id` y cancelar su inscripción. Procedimiento en
[`plan-fusion-identidades-duplicadas.md`](plan-fusion-identidades-duplicadas.md).

| # | Persona | Fichas | Riesgo/mes |
|---|---|---|---|
| 1 | Valentina Barreto García | **3** `00e720ba` (sin cuota) · `93eeedac` ($180.000) · `ee81c79f` ($180.000) | $360.000 |
| 2 | Anaisabel Mondragón Mejía | `134bb246` · `a9c265c5` — ambas $210.000 | $210.000 |
| 3 | Sergio Herrera Torres | `8d072d3c` · `aa79ac36` — ambas $210.000 | $210.000 |
| 4 | Gabriela Simbaqueva Pedraza | `0870aa6f` · `ba7a82e5` — ambas $180.000 | $180.000 |
| 5 | Gabriela Núñez | `69715f49` (sin cuota) · `b5458a54` ($180.000) | $180.000 |
| 6 | Gabriela Buitrago Forero | `ba7fb08b` ($210.000) · `bb8dd235` ($180.000) | $180.000 |
| 7 | María Camila Ramírez Medina | `58b1c5a6` · `e2b3a419` — ambas $150.000 | $150.000 |
| 8 | Josue Cortes Saenz | `632b0f58` ($130.000) · `cbf0b90e` ($150.000) | $150.000 |
| 9 | jefferson steven rojas preciado | `974791aa` · `e3527635` — ambas $150.000 | $150.000 |
| 10 | Oscar Eduardo Baquero Solano | `390a865c` (child, $150.000) · `62a33f1c` (**adult**, sin cuota) | $0 |
| 11 | Julieta Mayorga Veloza | `4cc30a3a` ($150.000) · `73d23aea` (cuota 0) | $0 |
| 12 | Esteban Daniel Herrera Rodríguez | `aad8ddb9` (child, $150.000) · `91923ae4` (**adult**, sin cuota) | $0 |
| 13 | Sofia Anaya Vargas | `cb4cd8c5` · `e754209b` — ninguna con cuota | $0 |

**Los de $0 no son inocuos:** su segunda ficha no cobra hoy solo porque no tiene cuota asignada. En el
momento en que alguien le ponga plan, cobra doble. Los casos 10 y 12 son el patrón *child + adult*: la
misma persona cargada como menor y como atleta adulto.

---

## 2. Sin cobro de agosto — 5 atletas · $480.000 🟠

Descartando las fichas gemelas (donde no cobrar es lo correcto), quedan cinco de verdad:

| Atleta | Cuota | Cobros que tiene | Qué pasó |
|---|---|---|---|
| Victoria Osorio Martínez | $180.000 | `2026-09` | Septiembre cobrado, agosto salteado |
| Valentina Castellanos Cueto | $150.000 | `2026-09` | Septiembre cobrado, agosto salteado |
| José Alejandro Lizcano Plazas | $150.000 | ninguno | Entró el 9-ago y nunca se le emitió nada |
| Sergio Soler Suárez | — | ninguno | **Sin cuota configurada:** no se le puede cobrar hasta que tenga plan |
| Dilan Yadiel Gaona Martin | — | ninguno | Igual |

Los dos primeros son el resto del bug `mes+1` (facturaba el mes siguiente y el de entrada nunca).
Los dos últimos no son un problema de cobros sino de configuración: falta asignarles plan.

---

## 3. Casos sueltos que necesitan una decisión

### 3.1 · María Camila Valderrama — ¿una niña o dos? 🟠

El último caso del eje B. **No se puede decidir con los datos:**

| Ficha | Documento | Nacimiento | Acudiente | Cuota |
|---|---|---|---|---|
| `8987eeda` | `10320076657` (11 dígitos → inválido) | — | leonardo.valenciamh@outlook.com | — |
| `fb1afcad` | `110237637` | 2015-04-05 | ladyjuzo@gmail.com | $90.000 |

Mismo nombre, pero documentos sin ningún parecido, **acudientes distintos** y cuotas distintas. Si son
la misma niña, hay $90.000 cobrados de más y una de las dos fichas se fusiona. Si son dos niñas, todo
está bien y hay que dejarlo. **Lo tiene que confirmar la escuela.**

### 3.2 · Juan Martín Forero Pinzón — $60.000 de diferencia

Pagó **$150.000** el 30-jul (concepto «Primer pago») y su cuota actual es **$90.000**, porque le
cambiaron el plan a PLAN START. Su cobro de agosto por $90.000 quedó cancelado porque ya había pagado
más que eso. Queda **$60.000 a favor de la familia**: devolver, o abonar al mes siguiente. Decisión de
la escuela.

Cobro vivo: `785cad3d` — agosto, $150.000, pagado.

### 3.3 · Violeta del Campo Garzón — el cobro de noviembre

Es el único prepago multimes real de la escuela y está bien resuelto: agosto, septiembre y octubre
pagados ($180.000 cada uno, con un mismo comprobante para sep+oct). Pero hay un **cuarto cobro de
noviembre por $180.000 impago**, creado el 4-ago, que nadie pidió.

| Periodo | Estado | Pagado | id |
|---|---|---|---|
| 2026-08 | paid | 31-jul | `c823e7a6` |
| 2026-09 | paid | 3-ago | `57c91eb5` |
| 2026-10 | paid | 3-ago | `7b8536fa` |
| **2026-11** | **pending** | — | `e2e2383c` |

Hay que confirmar si la familia pidió cuatro meses o solo tres. Si fueron tres, ese cobro se cancela.

### 3.4 · Laura Sofía Fajardo Rincón — se queda como está ✅

Es el único de los 13 rótulos de julio donde **la escuela eligió el mes de verdad** (concepto
`Mensualidad` pelado, efectivo, creada y aprobada en el mismo minuto, periodo 07 explícito). Pagó julio
y su cobro de agosto de $150.000 (`2b299366`) sigue pendiente **con razón**: es deuda real.
No es un pendiente, se documenta para que nadie lo «arregle» por error.

### 3.5 · «Hijo Pruebas» — cuenta de pruebas

El único caso que queda en el eje D (nació vencido: creado 12-ago con vencimiento 5-ago, `91ce97b4`).
Es un registro de pruebas, no una familia. Se limpia cuando se aíslen las cuentas de prueba.

---

## 4. Código en `develop` sin desplegar ⚠️

La corrección de datos aguanta, pero **el productor sigue abierto** hasta que esto llegue a producción.

| Fix | Qué cierra | Necesita |
|---|---|---|
| **F1** · `due_date` nunca en el pasado ([`enrollmentBilling.ts`](../bff/src/services/enrollmentBilling.ts)) | Que se vuelvan a crear cobros nacidos vencidos, como los 5 que se acaban de limpiar | Deploy del BFF a Render |
| **M0** · guard de recordatorios ([`payment-reminders.ts`](../frontend/src/lib/api/payment-reminders.ts), [`PaymentRemindersPage.tsx`](../frontend/src/pages/PaymentRemindersPage.tsx)) | Que se le vuelva a escribir a familias que ya pagaron | Deploy del frontend |
| **M0** · ruta muerta + éxito falso + concepto ([`send-email/index.ts`](../supabase/functions/send-email/index.ts)) | Botón «Realizar Pago» que no lleva a ningún lado; «✅ enviado» sin enviar | `supabase functions deploy send-email --project-ref luebjarufsiadojhvxgi` |

**F1 conviene antes de la próxima apertura de mes.** Es lo que evita repetir el trabajo que acabamos
de hacer.

---

## 5. Fixes que no están construidos

| # | Qué | Por qué |
|---|---|---|
| **F3** | Un solo registro por atleta: cruzar por documento o nombre+fecha al auto-registrarse | Es la causa raíz de las 13 fusiones. Por correo no sirve: los padres usaron correos distintos (`lforero52@` vs `iforero52@`) y un documento venía con un dígito cambiado |
| **F4** | El registro manual de pagos no debe proponer un mes distinto al del pago | De 13 rótulos malos, **13 fueron manuales y 0 por pasarela** |
| **SEG** | `send-email` acepta `subject`/`html` crudos de cualquier usuario autenticado | Relay abierto de phishing con el dominio de la plataforma |
| **Multimes** | Capa `payment_receipts` + `payment_allocations` | No existe en el roadmap; hoy el multimes se resuelve a mano |

Ninguno está en el ROADMAP con un ID. Ver el análisis de encaje en la conversación del 12-ago.
