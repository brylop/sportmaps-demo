# SportMaps — Roadmap Maestro

**Versión:** 2.2 · **Fecha:** 2026-08-12 · **Rama:** `develop`

> **Este es el único roadmap.** Todo lo demás en `docs/` es *spec* (qué se construye y por qué),
> *plan de fase* (cómo se migra), *doctrina de arquitectura* (cómo se hace) o *auditoría* (qué está
> mal). Ninguno de esos documentos define prioridades: las define esta cola. Si un pendiente no
> aparece aquí, no existe.

**Cambios v2.1 → v2.2** (barrido de seguridad del 2026-08-12, ejecutado **contra la base viva**):
- **Tres huecos nuevos en P0** — `SEG-8` (un padre puede auto-aprobar su comprobante), `SEG-9`
  (cuatro `/debug-logs` públicos), `SEG-10` (`anon` enumera tokens de link de pago y PII de staff).
  Los tres verificados ejecutando SQL como rol `anon`, no inferidos del repo.
- **Tres ítems nuevos en P1/P2** — `SEG-11` higiene del BFF, `SEG-12` observabilidad (Sentry **no
  está instalado** y la política de privacidad se lo promete al usuario), `SEG-13` secretos y MFA.
- **`SEG-3` se reclasifica y baja a P2.** Los 502 avisos del linter son ~96 % ruido: las `admin_*`
  sí validan por dentro. Lo explotable se extrajo a `SEG-8`.
- **`SEG-1` y `SEG-5` re-medidos** contra la base: el alcance de `SEG-1` encogió (8 funciones con
  `search_path` mutable, no ~35); el rate limit de `SEG-5` resultó más flojo (IP-only y en memoria).
- Lección que queda escrita en §2: **el linter cubre la capa de datos y no ve el BFF ni la infra**,
  y ahí estaba todo lo explotable.

**Cambios v2.0 → v2.1:**
- Nuevo track **`CONC`** — concurrencia e integridad. Doctrina en
  [`architecture/concurrencia-y-reservas.md`](architecture/concurrencia-y-reservas.md) y regla 8 de §0.
- Nuevo track **`ERP`** — módulo Pendientes (CxC / CxP / Nómina) con libro mayor. Spec en
  [`specs/pendientes-cxc-cxp-nomina.md`](specs/pendientes-cxc-cxp-nomina.md).
- **`MOD-5` (contabilidad fases 1–6) se disuelve**: era el mismo trabajo que `ERP-2..5`.
- **D-PD resuelta: partida doble completa desde el inicio.** Nueva §3 «Track Contable» con la
  secuencia única de todo lo que toca dinero.

**Reemplaza a:**
- `docs/archived/ROADMAP-v1.3-2026-05-12.md` — el maestro anterior. Sus **anexos A–F**
  (DDL canónico, RLS, endpoints BFF, firmas de RPCs, tests por etapa) siguen siendo la referencia
  de los bloques todavía sin construir y **no se duplican aquí**.
- La §7 «Plan de ejecución consolidado» de `docs/sportmaps-strategic-roadmap.md`. Ese documento
  sigue siendo la referencia de **tesis, mapa competitivo y track disruptivo D1–D4** — pero ya no
  ordena trabajo.

---

## 0. Cómo se lee y cómo se mantiene

### Estados

| Marca | Significado |
|---|---|
| ✅ | Entregado y verificado en `develop` |
| 🟢 | Spec cerrada + plan aprobado → se puede escribir código |
| 🟡 | Plan escrito, **pendiente de aprobación** (convención: nada de SQL antes) |
| 🔵 | Diseñado (spec o decisiones cerradas) pero sin plan de migraciones |
| ⚪ | Idea o decisión abierta |
| ⚠️ | Estado dudoso — el código y la documentación no coinciden, hay que verificar |

### Reglas que no cambian

1. **Full-stack por feature** — DB + RLS + RPCs + BFF + API + Frontend + Auditoría + QA. No migraciones sueltas.
2. **Plan antes de código en migraciones.** El plan se aprueba, después se escribe SQL.
3. **Migraciones inmutables.** Todo fix va en una migración nueva con timestamp posterior.
4. **Una rama por fase**, con revisión entre fases.
5. **Modo audit antes de enforce** en todo gating nuevo.
6. **Nunca mergear a `main`** por iniciativa propia.
7. **Athletes y parents nunca pagan.** El trial de 30 días es solo para roles de servicio.
8. **La integridad la garantiza el motor, no el código de aplicación.** Nada que consuma cupo, stock,
   inventario o dinero se protege con un botón deshabilitado ni con una validación previa en el BFF:
   eso baja la probabilidad, no cierra la ventana. Se protege con **índice único parcial**
   (exclusividad), **`SELECT … FOR UPDATE` sobre la fila padre** (capacidad y contadores),
   **advisory lock** por clave de negocio, **idempotencia** en toda mutación reintentable, y **una
   sola fuente de verdad**. Doctrina completa, con el inventario de dónde ya está aplicada y dónde
   falta, en [`architecture/concurrencia-y-reservas.md`](architecture/concurrencia-y-reservas.md).

### Mantenimiento

Al cerrar un ítem se actualiza **su fila aquí** en el mismo PR que lo entrega. Los specs no se
tocan para reflejar avance; ellos describen el destino, esta tabla describe dónde estamos.

---

## 1. Estado para producción

| Frente | Estado | Nota |
|---|---|---|
| **Notificaciones** | ✅ funcional | Push web y nativo funcionando. No decir que está roto |
| **Migraciones** | ✅ aplicadas y funcionales | El gate `migrations:check` corre en pre-commit y CI |
| **Ciclo de mes / cobros duplicados** | 🔍 en revisión → `DIN-1` | **Único bloqueante de producción.** Revisión hecha el 2026-08-01: de los tres hallazgos, **H1 y H2 ya estaban cerrados** por las migraciones del 24-jul (índices de adultos y no registrados creados; `open_month` puebla `period_*` y el cron delega en él). Lo que sigue abierto es la ventana intra-sentencia, que **ninguno** de los tres hallazgos describía |
| **Entitlements / activación de módulos** | 🟡 el bloqueo de trial ya opera | `DIN-4` **aplicado en producción el 2026-08-12**: 168 escuelas inhabilitadas, Dynasty y GYM RM exentas. Falta su mitad de RLS (`SEG-15`). `SEG-7` sigue abierto |
| **Fecha externa comprometida** | 🔴 **19-ago-2026** | Inicio de pruebas de **Club Carmel** (~800 deportistas, 8 disciplinas). Bloque `CAR`. Es la única fecha con un tercero del otro lado |
| **Seguridad** | 🟡 1 sin verificar → `SEG-8` | Verificado contra la base viva el **2026-08-16**: `SEG-14` (ficha de menores sin sesión), `SEG-9` (cuatro `/debug-logs` públicos) y `SEG-10` (91 tokens de link de pago + 68 registros de staff a `anon`) **ya están cerrados**. Queda `SEG-8` (41 funciones ejecutables por `anon`), que **no se puede comprobar funcionalmente** —hacerlo sería ejecutar `complete_refund` o `apply_late_fees`— y necesita la verificación por catálogo |

---

## 1.1 Lo entregado desde la v1.3 (12 may → 1 ago 2026)

Nada de esto estaba en el roadmap anterior. Es la razón por la que hacía falta reescribirlo.

| Módulo | Qué quedó en `develop` | Falta |
|---|---|---|
| **Comprobantes v2 + Glosas** | Fases 1–6 completas: extracción LLM + reglas con veredicto, auto-aprobación, ciclo de glosa, conciliación bancaria (`bank_statements`, `reconcile_statement`), pestaña Conciliación con parser CSV | Parser XLSX · aplicar mig F4 `20260718000001` |
| **Informe Mensual del Atleta** | F0 rótulos de padre (`20260731123145`) + F1 backend completo (tablas, RLS, RPCs de escritura) + API y envío en BFF + pantalla de generar/publicar/enviar + entrada de menú por rol | Fases posteriores del spec (PDF al vuelo, calendario de reparto) |
| **Notificaciones unificadas** | F0 + F1 + F-R: trigger → outbox → dispatcher BFF (web-push VAPID + FCM), push web y nativo **funcionando**, Modo Recepción kiosko | Go-live en producción · F2–F6 |
| **Control de acceso físico (ZKTeco ADMS)** | Implementado y corriendo en RMGYM: `zk_user_mappings`, `cmd_seq`, ACK + Stamp dinámico, dirección por `DEVICE_MAP` | Generalizar a otras escuelas · multi-marca (Fase H) |
| **Contabilidad** | Fase 0 + 0.1: `expenses`, `cash_ledger`, RLS, eje `owner_type`/`owner_id`, helper `can_manage_finances` | UI vendor/organizer · fases 1–6 |
| **Pagos** | Wompi checkout E2E validado en sandbox · motor de mora `apply_late_fees` · toggles de config cableados con `pg_cron` · KPIs de pago · `payments.parent_id` backfilled (`20260730000005`, `20260730194230`) | Ver cola P0 — sigue habiendo duplicación activa |
| **Onboarding Dynasty** | 396 invitaciones auditadas · fix de la 2ª inscripción activa (`20260730000000`) · cleanup de planes duplicados · reuso de invitaciones pendientes | Gate de revisión previa al envío (P1) |
| **QR de inscripción** | Flujo completo escuelas (`school_join_qr_codes` + RPCs) · match por documento | — |
| **Carnets digitales** | 5 fases del rediseño (auto-contraste, iniciales, emisión masiva con filtros, PDF por equipo CR80, reverso, enviar al acudiente) | ⚠️ Editor de plantillas · 4 funciones que aún referencian `programs` (legacy) |
| **Torneos por escuela** | Decisiones cerradas + primeras entregas (`feat(torneos)` ×9) | ⚠️ Verificar dónde quedó: inscripción vs bracket |
| **Métricas de rendimiento** | Esquema regularizado y versionado (`20260731154626`, `…160301`) | Complementos C-A…C-K · `higher_is_better`, pesos, normalización, benchmark |
| **Bajas de atleta** | Inactivar cancela inscripción y anula pending/overdue · RPC `set_school_athlete_status` · fix RLS de adultos inactivos (`20260730160000`) | — |
| **PWA** | Banner de instalación arreglado en Android · bucle de recarga del service worker resuelto | — |
| **WhatsApp** | WA1 + WA2 construidos y validados E2E con número de prueba Meta (LLM en Groq) | System User permanente (el token de prueba expira cada 2 h) |
| **Infra** | Ledger de migraciones + gate `migrations:check` en pre-commit y CI · OpenAPI del BFF (358 rutas) · Resend con batch de 100 + tabla `email_sends` | — |

---

## 1.2 Lo entregado del 12 al 15 de agosto

Se registra aparte porque **no estaba en la cola**: se hizo por urgencia comercial, no por
prioridad del tablero. Dejarlo escrito es lo que evita que `DIN-4` siga figurando como
«3–4 semanas sin empezar» cuando ya opera en producción.

| Qué | Estado | Falta |
|---|---|---|
| **Bloqueo de fin de prueba (`DIN-4`)** | ✅ **aplicado en producción**. `schools.account_type` (real/test/demo) · `school_is_operational()` como fuente única · `expire_trials()` + cron diario · trigger de registro a 1 mes calendario · vista con `is_operational`/`blocking_exempt`/`has_subscription_row` · 7 RPCs de super admin · middleware `requireOperationalSchool` (402 solo en mutaciones) · `TrialStatusBanner` en el layout · bloque de periodo de prueba en el panel. **168 escuelas inhabilitadas**, Dynasty y GYM RM exentas | Su mitad de RLS → `SEG-15` |
| **Regla del periodo de prueba** | ✅ Se cuenta desde `schools.created_at`. Parque actual: 2 meses; registro nuevo: 1 mes | — |
| **Entidades informativas fuera del trial** | ✅ Las 151 «escuelas sin suscripción» eran federaciones/institutos/asociaciones. `is_informational_entity()` las exime, y el trigger de signup dejó de intentar suscribirlas — antes, crear una federación tumbaba el `INSERT` entero | — |
| **Mapeo `school_type` → módulos** | ✅ `has_academy` cubría solo `academy`/`hybrid`, dejando en **false a 247 escuelas** que sí operan como escuela (83 clubes, 11 entrenadores personales — 5 con atletas activos) | Cablear el menú a estos flags → `CAR-3` |
| **Separación real / pruebas** | ✅ **38 escuelas marcadas `test`**, 4 conservadas como `demo` curadas. `test` y `demo` ya estaban exentas del bloqueo: el cambio separa lo que se conserva de lo que se puede borrar | Borrado de las 22 vacías → `INF-6` |
| **Motor de demos por deporte** | 🟡 `scripts/demo/` — un motor y un catálogo por tenant (voleibol, fútbol, patinaje, crossfit, box + club campestre). Cada uno siembra sedes, categorías, tarifas, staff, familias, cartera con mora, asistencia, reservas, control de acceso y torneo. **Validado en `--dry-run`, sin sembrar** | Decidir si se siembran (54 cuentas, ~650 cobros) |

---

## 2. Catálogo de pendientes

IDs estables. La cola de la §3 los ordena; esta sección los describe.

### DIN — Dinero y cobros

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| **DIN-1** | ⚠️ **Orden corregido por el §11 del plan: los productores se cierran ANTES de limpiar** (B1 guard → B2 `students.ts:829` → M1 con `ON CONFLICT DO NOTHING` → recién entonces M3/huérfanas/M2). Limpiar con los tres productores abiertos es trapear con la llave abierta. Dos hallazgos más del §11: **el cron falla peor que el botón** — desde que delega en `open_month`, el `23505` queda atrapado en su `EXCEPTION WHEN OTHERS`, así que **salta la escuela en silencio y reporta éxito global** (cualquier alerta tiene que mirar el `WARNING`, no el valor de retorno); y **`SOLO MILLOS` es la única escuela expuesta** a ese fallo silencioso, porque es la única con duplicados **y** `auto_generate_payments = true`. Agosto de Dynasty ya está generado y sano (345 `pending` para 345 menores, 1:1), así que **no hay presión de calendario**. ⚠️ **Esa última frase quedó desmentida el 2026-08-12:** el 1:1 se cumple **por cobro** pero no **por persona** — 4 cobros de agosto vivían en la ficha gemela de alguien que ya había pagado, 5 nacieron vencidos y una atleta quedó cobrada dos veces. El conteo era correcto; contaba cobros y el problema estaba en las personas. Ya corregido en datos ([SQL](../scripts/dynasty-corregir-cobros-2026-08-12.sql)), pero el productor sigue abierto en todas las escuelas. **Generación de mes y cobros duplicados (F0) — plan consolidado.** Cubre lo que sigue abierto de las inscripciones duplicadas y de la generación unificada, ahora que se verificó qué cerró el 24-jul: la ventana **intra-sentencia** de `open_month` (el advisory lock no la cubre; hoy el síntoma es que la apertura de mes **aborta** para toda la escuela), el guard que falta en `POST /enrollments`, el `UPDATE` de `students.ts:829` que fabrica huérfanas, el `CHECK` de inscripción con destino, el merge de las 198 filas duplicadas y las 16 huérfanas que hay que **asignar** (~$2.21M/mes). | 🟡 | 1–2 sem | **[plan consolidado](plan-f0-generacion-de-mes-y-cobros-duplicados.md)** · evidencia en [plan-f0 original](plan-f0-inscripciones-y-cobros-duplicados.md) §2 y §7 |
| ~~DIN-2~~ | **Absorbido por DIN-1.** Verificado contra el código el 2026-08-01: **H1 cerrado** (los tres índices únicos existen, incluidos adultos y no registrados) y **H2 cerrado** (`open_month` puebla `period_*` siempre y el cron delega en él desde el 24-jul). La unificación de las 3 vías del §4.4 también está hecha: el botón llama `preview_open_month`/`open_month` y `calcFirstPayment` quedó confinado a los modales de alta. Queda **H3** (declarativo, sin código) dentro de DIN-1. | ✅ | — | [spec month-close §4](specs/month-close-module.md) |
| DIN-3 | **`payments.payment_provider` deja de mentir.** Se creó con `DEFAULT 'wompi'`, así que toda fila insertada sin provider queda sellada como Wompi y la reconciliación cuenta mal. | 🟡 | 4 h | [plan](plan-payment-provider-default-fix.md) |
| **DIN-4** | **Bloqueo de fin de prueba, entitlements y cuentas de prueba.** ✅ **Aplicado en producción el 2026-08-12** — ver §1.2. La estimación vieja («3–4 semanas, 7 fases») ya no aplica: se entregó en dos días porque el alcance real era menor que la spec. Queda vivo un solo pedazo: **RLS no aplica el bloqueo**, y el navegador escribe directo a Supabase en 52 sitios más los RPC → se extrajo a `SEG-15`. El defecto del panel que «miente» (D11) se resolvió releyendo la BD tras cada cambio. | ✅ salvo `SEG-15` | — | [entrega](periodo-de-prueba-aviso-y-bloqueo-2026-08-12.md) · [spec](specs/trial-blocking-and-test-accounts.md) |
| DIN-5 | **Duplicación de pagos — H-03, H-04, H-05, H-07.** Los hallazgos H-01 (autopay legacy), H-02 (doble clic) y H-06 (`record_recurring_attempt`) ya están arreglados; estos cuatro siguen abiertos. | 🔵 | 2–3 d | memoria `project_payment_duplication_audit` |
| DIN-6 | **Connected accounts — cerrar Fase 0 (F-B, F-C, F-F).** Re-auditado el 2026-08-01: **la fase está al ~85 %, no al ~70 %**, y los dos docs de connected-accounts **subestiman el avance**. Ya están hechos el `wompi.service` parametrizado, el escritor cifrado (`upsert_school_provider`) y la firma del Widget por escuela. Lo que falta: **cablear el gate por addon** (`hasGatewayAddon()` está definido y **no se invoca desde ninguna ruta** — es código muerto), **crear el endpoint de switch de `payment_mode`** (hoy solo se cambia por SQL a mano), **validar las llaves contra la API del proveedor**, migrar Dynasty de ENV a `direct` en orden estricto, y los webhooks multi-tenant. | 🟡 | 2–3 sem | **[plan de cierre de ruteo](plan-cierre-ruteo-de-pagos.md)** · [plan original](payments-connected-accounts-plan.md) · [status ⚠️ desactualizado](payments-connected-accounts-STATUS.md) |
| **DIN-9** | 🔴 **Higiene de ambientes — el footgun de MercadoPago.** `MP_ACCESS_TOKEN_DEFAULT` y `MP_PUBLIC_KEY_DEFAULT` de **dev** tienen prefijo `APP_USR-`, que en MP es **producción**. `MP_ENV=sandbox` no corrige nada: `mercadopago.service.ts:29` tiene **una sola URL** y MP no tiene host de sandbox — la credencial decide. Con `MARKETPLACE_DEFAULT_PROVIDER=mercadopago`, **un pago «de prueba» desde dev cobra de verdad.** Fix: credenciales `TEST-` en dev + guard de arranque que haga **fail-fast** si el prefijo de la credencial no coincide con el `*_ENV`, y derivar `sandbox` del prefijo en vez de la variable. Sin migración, sin tocar producción, una sesión. | 🟡 | 1 sesión | [plan §F-A](plan-cierre-ruteo-de-pagos.md) |
| **DIN-10** | 🟡 **Dinero de terceros ya recibido.** Los cobros de Academia Porras y MMA Blair (mayo) entraron a la cuenta de MercadoPago **de SportMaps** vía `MP_ACCESS_TOKEN_DEFAULT`. Es exactamente el riesgo regulatorio —captación irregular ante la SFC— que el modelo directo-a-escuela existe para evitar. Incluye parametrizar el camino MP como ya está el de Wompi. **La decisión sobre el dinero ya recibido es de negocio (D2), no técnica.** | ⚪ | 1 sem + decisión | [plan §F-E](plan-cierre-ruteo-de-pagos.md) |
| DIN-7 | **Autopay en Wompi.** Bloqueado por falta de API `payment_sources`; hay que pedirla aparte en el contrato de Pagos a Terceros. Solo MP funciona hoy. | ⚪ | externo | memoria `project_wompi_commercial_status` |
| DIN-8 | **Facturación electrónica multi-PAC.** Capa de adaptadores DIAN (Factus primero, luego Siigo/Alegra). API sandbox de Factus ya validada. Tablas `invoice_providers` + `invoices`. **No depende del libro mayor**: el PAC emite la factura, no pide el mayor — no se bloquean entre sí en ningún sentido. | 🔵 | 5 fases | memoria `project_electronic_invoicing` |
| ~~DIN-11~~ | ✅ **Un cobro nuevo ya no nace vencido.** `billingDue` acotaba el vencimiento al día del **alta**, no al de **hoy**: si el plan se asignaba un mes después, el cobro entraba al mundo en mora, con recargo y recordatorio de deuda por algo que ayer no existía. Medidos **20 en la plataforma** (5 en Dynasty, uno con 31 días). El piso ahora es `hoy + payment_grace_days`, la MISMA regla que ya usaba el flujo QR (`qr_first_charge_due_date`) — antes había dos criterios según la vía de alta. Solo reemplaza si la fecha calculada ya pasó, para no mover los vencimientos correctos. Sin migración. ⚠️ **Commiteado, SIN DESPLEGAR: no protege a nadie hasta que el BFF suba a Render, y conviene antes de la próxima apertura de mes.** | ✅ código · ⚠️ sin deploy | hecho | `30d5a36` · eje D de [audit-cobros-duplicados](../scripts/audit-cobros-duplicados.mjs) |
| ~~DIN-12~~ | ✅ **El recordatorio ya no le reclama a quien pagó, y el correo funciona.** Dynasty reportó familias al día recibiendo «tienes un pago pendiente»: eran cobros duplicados en la ficha **gemela** de la misma persona. Guard en `generateReminders` (la fuente única de la lista, así que cubre todas las vías de envío): excluye lo cierto, marca y bloquea lo probable. El cruce de nombres es por **subconjunto de tokens** — con comparación exacta se escapaba 1 de 3 casos («Gabriela Núñez» vs «Gabriela nuñez osorio»). Y tres fallos del correo: la ruta **`/payments` no existía** (es `/my-payments`, el botón «Realizar Pago» no llevaba a ningún lado → el padre se registraba otra vez → más duplicados); **éxito falso** (sin `RESEND_API_KEY` devolvía `success:true` con HTTP 200 y la UI decía «enviado»); y el «Concepto» mostraba el nombre del **equipo**. Verificado: en Dynasty los correos indebidos pasaron de **3 a 0**. ⚠️ **Sin desplegar** — necesita frontend y `supabase functions deploy send-email`. | ✅ código · ⚠️ sin deploy | hecho | `498fa40` |
| **DIN-13** | 🔴 **Un solo registro por atleta (F3) — la causa raíz de los duplicados.** El acudiente se registra por su cuenta en vez de aceptar la invitación y crea una **segunda ficha** del mismo atleta: ambas facturables. **41 dobles facturables en la plataforma**, 13 en Dynasty ($1.770.000/mes). ⚠️ **Buena parte ya está construida** —`normalize_doc_number`, `find_athletes_by_document`, `claim_children_by_document`, `claim_orphan_children`, y `validate_doc_for_plan_join` + `claim_member_for_plan` que son el flujo completo— así que F3 **no es construir un matcher**: es cerrar la única puerta sin chequeo (`AddChildDialog` hace `INSERT INTO children` crudo) y dejar de depender de que el acudiente llegue al dashboard. Medido: **9 de 13 pares tienen correos de acudiente distintos** (el correo no sirve), **11 de 13 comparten fecha de nacimiento** (la señal fuerte), y los documentos difieren en 1–2 dígitos. Bloqueado por **D-DUP** y **D-DOC**. | 🔵 | 4 fases | **[plan F3](plan-f3-un-solo-registro-por-atleta.md)** |
| **DIN-14** | 🟡 **El registro manual de pagos rotula el mes equivocado.** De **13 rótulos malos en Dynasty, 13 fueron manuales y 0 por pasarela**: cuando la fecha la pone el proveedor el mes sale bien siempre. El origen no fue la escuela eligiendo: 10 de 13 traen concepto `Plan PLAN X`, que produce `emitPlanCharge` con el periodo de la inscripción **vieja**. Consecuencia medida: agosto sin facturar y cobros que la familia ve como deuda vieja. Ya corregido en datos para Dynasty; falta el fix de captura. | 🔵 | 2–3 d | [audit-periodo-vs-fecha-pago](../scripts/audit-periodo-vs-fecha-pago.mjs) · [SQL aplicado](../scripts/dynasty-rerotular-periodos-2026-08-12.sql) |
| **DIN-15** | 🟡 **Higiene de invitaciones.** Tres cosas: **(a)** `accept_invitation_pro` hace `SET offering_plan_id` **sin tocar `monthly_fee`**, así que puede dejar plan y cuota discrepando — medido, solo 4 de 409 y tres parecen deliberados, **pero se vuelve peligroso cuando `monthly_fee` viene NULL** porque entonces cae al precio del plan y sí mueve la plata; **(b)** **255 de 444** invitaciones de Dynasty no llevan plan ni configuran facturación, y 10 no llevan ni equipo ni plan; **(c)** 4 combinaciones de mismo correo + mismo atleta repetidas, una con `child_name` NULL. Verificado que **ninguna de las 263 `pending` cambiaría el plan al aceptarse**, así que no hay bomba armada: es riesgo latente. El 59% sin aceptar **no es reenvío, es falta de adopción** (195 correos sin perfil). | 🔵 | 2–3 d | barrido 2026-08-12 |
| **DIN-16** | 🔵 **Fusionar las identidades ya duplicadas.** **$1.770.000/mes** solo en Dynasty: 13 personas con 2–3 fichas, cada una facturable. Cancelar el cobro no alcanza — hay que trasladar equipo, cuota y pagos a la que sobrevive, vincular la absorbida y cancelar su inscripción. Incluye el patrón **child + adult** (Darwin Hernandez nació en 1972 y su documento es una cédula: atleta adulto cargado como menor; igual Oscar Baquero y Esteban Herrera). El plan existe y **estaba fuera de la cola**. Distinto de `DIN-13`, que evita las próximas. | 🔵 | 1 sem | [plan de fusión](plan-fusion-identidades-duplicadas.md) · [pendientes Dynasty](dynasty-pendientes-2026-08-12.md) |
| **DIN-17** | 🔵 **Multimes / prepago de mensualidades.** No existe en ninguno de los 62 documentos: hoy se resuelve a mano. La escuela crea el cobro del mes siguiente **después** de recibir la plata (Violeta del Campo: cobro de octubre creado el 4-ago con `payment_date` del 3-ago). El veredicto de comprobantes compara contra **un solo** cobro con **tolerancia 0**, así que pagar dos meses siempre cae en `MONTO_DIFIERE` → revisión manual. Diseño propuesto: `payment_receipts` (la transacción) + `payment_allocations` (cómo se reparte) por encima de `payments`, que sigue siendo un cobro por mes — es lo único que hoy impide duplicados. Bloqueado por 4 decisiones de producto (descuento, cuántos meses adelante, baja con meses prepagados, saldo a favor). | 🔵 | spec + 5 fases | barrido 2026-08-12 |
| **DIN-18** | 🟡 **73 documentos inválidos de 788.** 50 fichas con documento de **5 dígitos** y 23 con **11 a 15**. Además 59 sin documento (29 en `Club Campestre Demo`). Sin validación de formato al capturar, cualquier matcher por documento falla o empareja mal en esas 73 — por eso **D-DOC y la validación de formato son la misma decisión**. Incluye una colisión que hay que limpiar antes del índice único de `DIN-13` F3.3: **SPIRIT ALL STARS, doc `1016092607` en dos fichas** (Sara Sánchez / Silvana Sánchez — le digitaron el de la hermana a una de las dos). | 🔵 | 1–2 d | barrido 2026-08-12 |

#### DIN-4 en detalle — «prendo el módulo y no se activa»

Investigado el 2026-08-01. **No es un bug: son cuatro cosas distintas**, y el toggle no es ninguna de
ellas. `school_addons` **sí tiene las filas** con `via='admin_toggle'`, incluidas las de hoy 18:40–18:42
(VOLK FIT CLUB / `tournaments`, 10 addons de Escuela Demo SportMaps). El problema está después de la escritura.

| # | Hallazgo | Dónde |
|---|---|---|
| 1 | **El panel no relee: pinta por optimismo.** Actualiza el estado local tras escribir y nunca vuelve a consultar. Muestra ON porque lo asumió, no porque lo verificó — por eso es imposible distinguir «se guardó» de «no se guardó» | `AdminSubscriptionsPage.tsx:95` |
| 2 | **Prender el módulo no lo hace aparecer.** El sidebar consulta **un solo** addon: `hasAddon('store')`. Torneos, Contabilidad, Facturación, Nutrición, Biomecánica, Control de acceso, White-label y WhatsApp no cambian nada visible al activarlos | `AppSidebar.tsx:126` |
| 3 | **Caché de 5 minutos.** `useEntitlements` tiene `staleTime: 5 * 60 * 1000`: el módulo no aparece hasta que expire o haya recarga dura. `bff/src/utils/authCache.ts` (sin commitear) puede sumar otra capa | `useEntitlements` |
| 4 | 🔴 **`v_school_entitlements` miente en silencio** — ver `SEG-7`. Es el grave | vista |

**Decisiones nuevas** (en el spec): **D11** el panel muestra estado *verificado* — relee tras cada
escritura y por escuela muestra plan, status, `trial_ends_at`, días restantes, `account_type` y cada
módulo con **desde dónde** se activó (`trial_grant` / `admin_toggle` / `seed`) y cuándo; si lo que
respondió la BD difiere de lo que se pidió, sale en rojo con el motivo. **D12** se quitan los `COALESCE`
inventados: sin privilegio ⇒ error o vacío, nunca un `starter/active` falso. **D13** activar un módulo
tiene que verse — sidebar y rutas consultan su addon, y el toggle invalida la caché.

**Gates duros:** `G-VERIFY` (nada se pinta por optimismo) · `G-NOLIE` (ninguna lectura devuelve
defaults inventados; se prueba con un lector **sin** privilegio).

**Orden de fases:** F0 marcado real/pruebas → **F0.5 verdad en el panel** (nueva, entra antes de F1) →
F1 trial todo-abierto → F2 cron → F3 bloqueo server-side → F4 UX → F5 consola → F6 aislar pruebas.

> **Por qué F0.5 va antes de F1:** no tiene sentido conceder 11 addons automáticamente si todavía no se
> puede ver si quedaron concedidos. Y F3 se apoya en un status que hoy se puede leer falso.

### ERP — Módulo Pendientes: CxC / CxP / Nómina + libro mayor

Absorbe lo que antes era «contabilidad fases 1–6» (`MOD-5`).
Spec: [`specs/pendientes-cxc-cxp-nomina.md`](specs/pendientes-cxc-cxp-nomina.md).

Hoy el dinero vive en tres modelos que no se hablan — `payments`, `expenses`, `payroll_runs` — y **no
existe la tabla de cruce**, así que no se puede abonar a un gasto, ni pagar cinco facturas con un
giro, ni pagar la nómina del período con un solo egreso. **`D-PD` resuelta: el módulo lleva partida
doble completa desde la primera fase** (§3.1).

| ID | Pendiente | Estado | Esfuerzo | Nota |
|---|---|---|---|---|
| ERP-1 | **Quick wins de UX contable.** Ícono Ojo = ver contabilización, Lupa = solo búsqueda; Editar se **oculta** en vez de deshabilitarse; orden cronológico estable en movimientos; formulario de tercero Natural/Jurídica; documentar en pantalla qué asiento produce «Registrar gasto». | 🔵 | 3–4 d | Sin dependencias. Va en la misma pasada que `UX-1` |
| ERP-2 | **Libro mayor + núcleo CxP.** `chart_of_accounts` + `journal_entries` + `journal_lines` con cuadre débito=crédito, inmutabilidad y reverso; `obligations` + `cash_movements` + `obligation_settlements`; capa de posteo; mapeo de cuentas por escuela; RPCs de cruce con **lock pesimista sobre la obligación**; pago parcial y multi-factura. | 🔵 | 6–7 sem | Bloqueado por D-T, D-MIG, D-PUC, D-CORTE (§5) |
| ERP-3 | **Períodos contables y bloqueo.** `accounting_periods` + rechazo de asientos en período cerrado. **Es el punto de unión con el ciclo de mes.** | 🔵 | 1 sem | ERP-2 |
| ERP-4 | **Nómina.** Obligación por empleado al cerrar la liquidación (el motor `payroll_runs` **ya existe**), pestaña agrupada por período, pago del período completo con un egreso, posteo al mayor. | 🔵 | 1–2 sem | ERP-2 en producción · D-NOM |
| ERP-5 | **CxC: lectura + posteo.** Pestaña «Por cobrar» que lee `payments` **sin migrarlo**, y capa de posteo que lleva sus eventos al mayor (cobro emitido → CxC/Ingreso; pago recibido → Banco/CxC). Sin esto el mayor no incluye el ingreso principal de la escuela. | 🔵 | 2 sem | ERP-2 · `DIN-1` cerrado |
| ERP-6 | **Retiro de los nombres viejos.** «Finanzas» y «Proveedores» dejan de existir como módulos; queda `Pendientes · Movimientos · Contabilidad`. | 🔵 | 3 d | **Se entrega junto con `UX-4`** o se pisan |

### ADM — Consola de Super Admin

El rol `super_admin` tiene que poder configurar **todo** de cualquier escuela desde una sola
pantalla. Hoy no puede: los interruptores existen pero están repartidos y no hay dónde verlos juntos.

**Inventario real de la superficie de configuración** (verificado contra el esquema el 2026-08-01):

| Dónde vive | Cuántos | Qué hay |
|---|---|---|
| `school_settings` (tabla) | **20 columnas** | `payment_cutoff_day`, `payment_grace_days`, `responsible_payment_policy`, `allow_multiple_enrollments`, `coach_can_send_reminders`, `coach_can_request_reminders`, `auto_generate_payments`, `allow_installments`, `max_installments_per_payment`, `reminder_enabled`, `wompi_enabled`, `epayco_enabled`, `online_fee_pct`, `glosa_response_days`, `receipt_date_window_days`, `coach_can_enroll_paid_teams`, `active_modules`, `bank_name`, `bank_account_number`… |
| `schools` (columnas) | 4 | `payment_mode`, `business_model`, `branding_settings`, `slug` |
| `schools.payment_settings` | 1 JSONB | 🔴 **store legacy duplicado** (`allow_manual`, `allow_online`) — el mismo concepto que ya vive en la tabla |
| `school_addons` | **11 claves** | `tournaments · access_control · biomech · nutrition · whitelabel · whatsapp · wompi · mp · store · accounting · invoicing` (el `CHECK` se amplió dos veces: `20260514000002` y `20260713000006`) |
| `school_subscriptions` | plan/tier/status/trial | `metadata` guarda `via: 'admin_toggle'` y `set_by` |
| `profiles` / escuela | `account_type` | nuevo en `DIN-4` F0 |

➡️ **~40 interruptores repartidos en 5 tablas y 2 JSONB, sin un solo lugar donde verlos ni fijarlos.**

| ID | Pendiente | Estado | Esfuerzo |
|---|---|---|---|
| ADM-1 | **Inventario y catálogo de flags.** Una tabla-catálogo (`school_flag_definitions`) con: clave, tipo, valor por defecto, dónde vive físicamente, quién puede cambiarlo, si es peligroso y qué precondición exige. Sin esto la consola es una lista hardcodeada que se desactualiza en la primera migración. | 🔵 | 3–4 d |
| ADM-2 | 🔴 **Resolver el doble store antes de construir la consola.** `school_settings` (tabla) vs `schools.payment_settings` (JSONB legacy) guardan el mismo concepto. **Una consola que lee uno y escribe el otro miente**, y es el mismo tipo de defecto que `SEG-7`. Migrar el JSONB a columnas y dejarlo de solo-lectura con `COMMENT` de deprecación. | 🔵 | 3 d |
| ADM-3 | **Consola por escuela: ver y fijar todo.** Una pantalla con las ~40 opciones agrupadas, y por cada una: valor actual **releído de la BD**, valor por defecto, quién lo cambió, cuándo y desde dónde (`trial_grant` / `admin_toggle` / `seed`). Hereda `G-VERIFY` de `DIN-4`: **nada se pinta por optimismo**. | 🔵 | 1–2 sem |
| ADM-4 | **Precondiciones en los flags peligrosos.** No todo interruptor puede ser un switch pelado:<br>· `auto_generate_payments = true` en una escuela con inscripciones duplicadas **arma el fallo silencioso del cron** de `DIN-1` — `SOLO MILLOS` es la prueba viva: lo tiene en `true`, tiene 7 atletas duplicados, y su mes no se está facturando sin que nadie vea un error.<br>· `payment_mode = 'direct'` sin llaves validadas **mata el checkout** (`DIN-6` F-B).<br>· bajar de plan puede esconder módulos que la escuela está usando.<br>La consola **verifica la precondición y explica por qué se niega**, en vez de dejar apretar y romper. | 🔵 | 1 sem |
| ADM-5 | **Auditoría y reversa.** Toda escritura registra actor, momento, valor anterior y nuevo, y se puede revertir al valor previo desde la misma pantalla. | 🔵 | 4 d |

> ⛔ **Lo que esta consola NO es: una caja para correr SQL desde el navegador.** El BFF usa
> `service_role`, que **salta toda la RLS**: un endpoint que acepte SQL arbitrario del cliente es la
> puerta más grande que se puede abrir en el producto, y ningún gate de rol la cierra —basta un XSS o
> un token filtrado. Cada interruptor escribe por una **RPC tipada y auditada**, con su propia
> validación. «Directo en BD» significa *sin pedirle permiso a la escuela*, no *sin capa de control*.
>
> Y `is_super_admin()` **nunca se revoca** al rol que la invoca desde policies — convención del repo:
> hacerlo rompe con 403 todas las queries.

`ADM-3` absorbe la fase **F5 «consola»** de `DIN-4`, y depende de `DIN-4` F0.5 (la verdad en el panel)
y de `SEG-7` (que la lectura no devuelva defaults inventados). Construir la consola antes de esas dos
es construirla sobre datos que mienten.

### CONC — Concurrencia e integridad

Doctrina: [`architecture/concurrencia-y-reservas.md`](architecture/concurrencia-y-reservas.md).
Buena parte **ya está aplicada**: índice único parcial en `session_bookings`, `payments` y
`enrollments`; lock pesimista en `enforce_session_capacity`; advisory lock en `open_month`.

| ID | Pendiente | Estado | Esfuerzo |
|---|---|---|---|
| CONC-1 | **`Idempotency-Key` general en las mutaciones del BFF.** Hoy solo existe en cobros recurrentes (`recurring-charges.service`, `mercadopago.service`, `record_recurring_attempt`). Es la defensa más barata contra el doble cargo, y **prerrequisito de `ERP-2`**: un doble clic en «cruzar» no puede aplicar dos veces. | 🔵 | 3–4 d |
| CONC-2 | **Auditar todo `count(*)` de cupo o stock que no bloquee la fila padre.** El error clásico: dos inserts leen `N-1` y ambos pasan. `enforce_session_capacity` es el patrón bien hecho — copiarlo, no reinventarlo. | 🔵 | 2–3 d |
| CONC-3 | **Dedup intra-sentencia en `open_month`.** Es `DIN-1`; se lista aquí porque es el caso que la lista canónica de mecanismos **no** cubre: ni advisory lock ni `FOR UPDATE` protegen dentro de una sola sentencia. | 🟡 | — |
| CONC-4 | **Modelo de reservas con soft lock**: `reservations` con `expires_at`, índice único parcial `(resource_id, slot_start)` para exclusividad, `idempotency_key`, job de expiración, y disponibilidad que ignora holds vencidos aunque el cron no haya pasado. | 🔵 | dentro de `BLQ-1` |
| CONC-5 | **Decidir franjas fijas vs solapamiento libre** — índice único simple, o `EXCLUDE USING gist` con `btree_gist`. Cambia el modelo. | ⚪ | decisión |
| CONC-6 | **Cola offline y política de degradación** (overbooking configurable, `pendiente_reconciliacion`, conflicto resuelto por `held_at` más antiguo). Opt-in por escuela; por defecto la recepción sin señal **no vende**. | ⚪ | dentro de `BLQ-3` N4 |

### SEG — Seguridad, RLS y permisos

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| SEG-1 | **Linter de Supabase — Fase −0.5 (drift bloqueante)** y luego Fase 1 (quick wins). ⚠️ **Re-medido contra la base el 2026-08-12: el alcance encogió.** `search_path` bajó de ~35 funciones a **8**; siguen 3 extensiones en `public` (eran 2). Suma un hallazgo nuevo que no estaba en el plan: **la protección de contraseñas filtradas está desactivada** (`auth_leaked_password_protection`) — es un toggle del dashboard de Auth, gratis, chequea contra HaveIBeenPwned al registrarse. | 🟢 | 1 d | [plan](analysis/SUPABASE_LINTER_REMEDIATION_PLAN.md) · barrido 2026-08-12 |
| SEG-2 | **`security_definer_view` en `school_athletes`** — el único ERROR del linter. | 🟢 | 4 h | [plan §Fase 2](analysis/SUPABASE_LINTER_REMEDIATION_PLAN.md) |
| SEG-3 | **`SECURITY DEFINER` expuestas a `anon`.** Ejecutar por grupos: A (helpers/triggers → revoke total), E (internas → solo `service_role`), F (candidatas a `DROP` por falta de uso), luego C y D. Cuidado: **nunca revocar** `is_school_admin()` / `is_super_admin()` al rol que las invoca desde policies. ⚠️ **La premisa cambió con el barrido del 2026-08-12: esto es higiene, no riesgo.** Hoy son 195 funciones para `anon` y 307 para `authenticated`, pero se revisaron las de riesgo una por una y **las `admin_*` sí validan por dentro** (`is_super_admin`, `auth.uid`). El único caso sin ningún chequeo se extrajo a **`SEG-8`** y sube a P0; `get_school_payment_info` está sin chequeo **por diseño** (gateada por `public_profile_enabled`, la usa el checkout público — documentarla con `COMMENT`, no revocarla). Baja a P2: seguir haciéndolo, pero sabiendo que es defensa en profundidad. ⛔ **TRAMPA verificada el 2026-08-12: hay que revocar a los TRES — `PUBLIC`, `anon` y `authenticated`.** Postgres concede `EXECUTE` a `PUBLIC` por defecto en toda función nueva, **y además** Supabase concede `EXECUTE` a `anon` y `authenticated` **directamente**, por privilegios por defecto del esquema `public`. Son grants independientes: revocar uno deja vivos los otros. La prueba es `auto_approve_payment` — su migración **sí** hace `REVOKE ALL … FROM PUBLIC` y aun así `anon` la ejecuta (HTTP 200 con la anon key, comprobado en vivo). Y `find_athletes_by_document` tenía las dos cosas a la vez: `=X/postgres` (PUBLIC) **más** `anon=X` y `authenticated=X`. De **187 migraciones que crean funciones, solo 34 hacen `REVOKE … FROM PUBLIC`**, y ninguna revoca a `anon`. La forma correcta es `REVOKE ALL … FROM PUBLIC, anon, authenticated` y después re-declarar los grants que sí van; con cualquier revoke parcial, el ID se cierra sin haber cerrado nada. *(Corrige la nota anterior de este mismo día, que decía que bastaba con revocar `PUBLIC`.)* | 🟢 | 1 sem, N PRs | [auditoría ⚠️ de may-2026](analysis/SECURITY_DEFINER_AUDIT.md) · barrido 2026-08-12 |
| SEG-4 | **Permisos de coach.** Dos planos que no coinciden (RLS aguanta / el BFF con service role es el único gate real) y dos matrices de permisos que son código muerto. | 🔵 | 3–4 d | memoria `project_coach_permissions_audit` |
| SEG-5 | **Anti-spoofing / IDOR / rate limit.** No aceptar nunca `user_id`/`sender_id` desde el payload del cliente; helper `can_message(a,b)` con relaciones reales. **El rate limit se midió el 2026-08-12 y es más flojo de lo que sugiere el código:** existen tres capas (`generalLimiter` 200/15min, `paymentLimiter` 20/min, `cardAlterLimiter` 10/h) pero **solo `cardAlterLimiter` usa key por usuario** — las otras dos son IP-only, así que un atacante autenticado rotando IPs no toca techo y una escuela detrás de NAT comparte cuota. Y el store es **en memoria**: cada instancia de Render y cada redeploy resetea los contadores, así que sin Redis no hay límite global. Falta además WAF/edge — `vercel.json` solo tiene rewrites y el BFF en Render está expuesto directo. | 🔵 | 3–5 d | [athlete remediation §F1](athlete-modules-remediation-plan.md) · [strategic §10](sportmaps-strategic-roadmap.md) · barrido 2026-08-12 |
| SEG-6 | **RLS column-level en `medical_info` y `phone`** (A8 del roadmap v1.3). | 🔵 | 1 d | [anexo B.8](archived/ROADMAP-v1.3-2026-05-12.md) |
| **SEG-7** | 🔴 **`v_school_entitlements` devuelve una respuesta falsa, sin error.** Misma escuela, mismo instante: con `service_role` responde `enterprise / active / 10 módulos true`; sin privilegio responde `starter / free / active / todos false` — **HTTP 200 en ambos casos**. La vista es `security_invoker=true`; `schools` tiene `FOR SELECT USING (true)` así que la fila siempre vuelve, pero `school_subscriptions` y `school_addons` están gateadas a `is_school_admin() OR is_super_admin()`. Cuando el lector no pasa, el `LEFT JOIN` da NULL, los `COALESCE` **inventan** `starter/free/active` y cada `EXISTS` de addons da `false`. Es **fail-open en el status** (afirma `active` cuando no sabe) y fail-closed en los módulos. Hoy muerde poco porque el BFF usa service role y el único lector del browser es el panel admin, cuyos 3 perfiles pasan el guard — **pero el bloqueo de `DIN-4` F3 se apoya justo en ese status**: un lector degradado ve `active` y el bloqueo no se aplica nunca. | 🔵 | 2–3 d | `DIN-4` D12 · gate `G-NOLIE` |
| **SEG-8** | ⚠️ **AMPLIADO el 2026-08-12: no es una función, son 41.** Al escribir el fix se verificó que `auto_approve_payment` **ya tenía** `REVOKE ALL … FROM PUBLIC` en su migración y aun así `anon` la ejecuta — porque Supabase concede `EXECUTE` a `anon`/`authenticated` **directamente**, no vía `PUBLIC` (ver la trampa en `SEG-3`). Buscando el patrón aparecieron **41 funciones** que su propia migración declara solo para `service_role` y que nunca se conceden a `anon`/`authenticated` en ningún lado: entre ellas `complete_refund`, `apply_late_fees`, `generate_monthly_charges`, `save_payment_token`, `upsert_school_provider` (escribe los secretos de pasarela) y **`wa_verify_otp`**. Comprobadas en vivo solo dos, a propósito: `auto_approve_payment` (HTTP 200) y **`_notify_school_staff` (HTTP 204 — se ejecutó e inserta en `notifications`; con un `school_id` real, y `schools` es legible por `anon`, un anónimo inyecta notificaciones con título, mensaje y link arbitrarios al staff de cualquier escuela: phishing dentro de la app)**. Las otras 39 no se probaron: ejecutar `complete_refund` como anónimo para comprobarlo sería causar el daño. Verificado que el frontend no invoca ninguna. ⚠️ **El primer intento (`20260812180437`) abortó** con `42883: function public.claim_single_due_recurring_subscription(uuid) does not exist` — las firmas venían copiadas del repo y la base tiene otras: es `INF-1` mordiendo. Iba en `BEGIN/COMMIT`, así que el rollback dejó todo intacto. La versión buena resuelve las firmas contra `pg_proc` en tiempo de ejecución, cubre las sobrecargas, no aborta por las ausentes y las reporta en un `NOTICE` para alimentar `INF-1`. **`20260812180437` queda superseded: no correrla.** | 🟡 | migración escrita, sin aplicar | [migración buena](../supabase/migrations/20260812181043_cerrar_a_anon_service_role_por_catalogo.sql) · [la que abortó](../supabase/migrations/20260812180437_cerrar_a_anon_las_funciones_de_service_role.sql) · barrido 2026-08-12 |
| ~~SEG-8 (original)~~ | 🔴 **`auto_approve_payment` no valida a quién la llama.** `SECURITY DEFINER`, con `EXECUTE` para `anon` **y** `authenticated`, y **cero chequeo de autorización** — lo único que verifica es que el cobro exista y esté en `awaiting_approval`. Después pasa `status` a `paid`, setea `amount_paid`, activa la inscripción y notifica. Un padre autenticado ve el UUID de su propio cobro en `/my-payments`: **se aprueba su propio comprobante y saltea el ciclo entero de validación de la escuela.** Hoy hay 0 cobros en `awaiting_approval`, así que no hay daño en curso — pero está armado y se dispara con el primer comprobante que suba un padre. Fix: `REVOKE EXECUTE … FROM anon, authenticated` en migración nueva; el BFF usa `service_role`, no se rompe nada. | 🟡 | 30 min | barrido 2026-08-12 · memoria `project_security_posture_audit` |
| **SEG-9** | 🔴 **Cuatro `/debug-logs` públicos en el BFF.** Sin auth, sin rate limit, sin allowlist: `GET` y `POST` sobre `/debug-logs` y `/debug-logs/clear` (montados en la **raíz** vía `admsRouter`), y los mismos dos bajo `/api/v1/access/`. Leen `debug.log` del disco, que lleva seriales de lector, IDs de usuario del dispositivo y timestamps de entrada/salida — **datos de asistencia de personas identificables**. El `clear` deja que cualquiera borre la traza del control de acceso. La allowlist de IP que sí existe cubre solo `/iclock/*` y es opt-in (vacía = desactivada). **Es lo único explotable por un anónimo sin cuenta.** | 🟡 | 1 sesión | `bff/src/routes/access-adms.ts:57,70` · `access-api.ts:11,24` |
| **SEG-10** | 🔴 **Policies `USING (true)` que filtran datos reales a `anon`.** Verificado ejecutando como rol `anon`, no inferido: **`payment_links` → 91 filas** con `token`, `gross_amount`, `sportmaps_fee`, `fee_pct` (la policy se llama `payment_links_select_by_token` pero **no filtra por token**: se enumeran todos los links de pago y el token es toda su autenticación; de paso filtra la comisión por escuela). **`school_staff` → 68 filas** con nombre, email y teléfono. **`facility_reservations` → 60 filas** con `user_id`, horario, precio y `payment_status`. `schools` (364) es el directorio público y es intencional. Lo que sí está bien cerrado: `profiles`, `payments` y `children` devuelven 0. Fix: filtrar el `USING` por el token del request en `payment_links`; en las otras dos, exponer una vista con solo las columnas que la web pública necesita. | 🟡 | 1–2 d | barrido 2026-08-12 |
| **SEG-14** | 🔴 **`find_athletes_by_document` entrega la ficha de un menor a cualquiera, sin sesión.** `SECURITY DEFINER` con `EXECUTE` para `anon`: con la llave pública del frontend y un número de documento devolvía `full_name`, `date_of_birth`, `school_id/name`, `team_id/name` y `branch_name`. **Verificado sin autenticar, en lectura, con el documento de una menor de Dynasty** — devolvió los seis campos. Los documentos de menores en Colombia son **enumerables**, así que permitía cosechar datos personales de menores a escala. ⚠️ **Corrige dos conclusiones del barrido del 2026-08-12:** `SEG-10` dice «`children` devuelve 0 a `anon`» —cierto para la **tabla** vía RLS, **falso en el efecto** porque esta función se la salta— y `SEG-3` dice «el único caso sin ningún chequeo se extrajo a `SEG-8`»: había un segundo. **No se puede revocar a `anon` en seco:** la usa `/join-team/:teamId`, que es pública y pide el documento **antes** del `signUp`. Fix escrito: el detalle solo con sesión; a `anon`, nombre enmascarado (`SALOME L. V.`) y `date_of_birth`/`team_id`/`branch_name` en NULL. No cambia la firma, no necesita despliegue coordinado. **Queda abierto** que siga siendo un oráculo «existe/no existe»: cerrarlo exige invertir el flujo de `/join-team`. | 🟡 | migración escrita, sin aplicar | [migración](../supabase/migrations/20260812172252_find_athletes_por_documento_sin_fuga_a_anon.sql) · [verificación](../scripts/verificar-fuga-documento-2026-08-12.sql) · barrido 2026-08-12 |
| ~~**SEG-15**~~ | ✅ **APLICADO el 2026-08-17.** Era la mitad viva de `DIN-4`: el middleware del BFF cubría lo que pasa por el BFF, pero el navegador escribe **directo a Supabase**, así que una escuela inhabilitada seguía registrando pagos, equipos, gastos, inscripciones e invitaciones por esa vía. Cerrado con policies **RESTRICTIVE** (se combinan con AND sobre las permissive sin tocar ninguna, y se revierten con DROP POLICY), solo sobre INSERT/UPDATE/DELETE —nunca SELECT, porque «bloqueado» no significa «sin datos»— y solo a `authenticated`, que `service_role` tiene BYPASSRLS. **Verificado contra la base:** las 14 tablas con sus 3 policies, ninguna descubierta; **161 escuelas bloqueadas, todas `real`+`trial_expired`**, ninguna demo ni cuenta de prueba y ninguna con prueba vigente; **Dynasty y GYM RM figuran vencidas pero siguen operativas** — el `blocking_exempt` funciona. ⚠️ Falta la **Fase B**: los RPC `SECURITY DEFINER` que escriben saltan RLS por definición (`submit_qr_signup`, `create_invitation`, `create_school_join_qr`, `generate_qr_monthly_charge`, `request_athlete_certificate`, `issue_athlete_certificate`, `notify_user`); cada uno necesita su guard. Y `memberships`, creada el 17, **no está cubierta**. | ✅ | Fase B pendiente | [migración](../supabase/migrations/20260813170813_bloqueo_de_prueba_en_rls.sql) |
| **SEG-16** | 🔴 **`auth.uid() IS NULL` usado como «soy interno» — y un anónimo cumple esa condición.** Tres funciones `SECURITY DEFINER` traen el guard `IF v_caller IS NOT NULL AND NOT (is_super_admin() OR is_school_admin(p_school_id)) THEN RAISE`, escrito para que el cron pase sin JWT. Sin sesión la condición es falsa y **no rechaza**. `open_month` **genera las cuotas del mes** (verificado en vivo: HTTP 200 con la llave pública, probado con un `school_id` inexistente para no crear nada); `preview_open_month` enumera qué se cobraría y cuánto; `school_payment_kpis` expone recaudo y mora. El `school_id` es enumerable: `schools` devuelve 365 filas a `anon`. **Para `authenticated` el guard sí funciona**, así que el fix es `REVOKE ... FROM anon` en vez de reescribir tres funciones de 200+ líneas — y menos aún `open_month`, que es la que escribe la cartera. ⚠️ Queda la lección para el catálogo: **auditar por privilegio no alcanza; hay que leer el guard.** `SEG-8` cerró 41 funciones por criterio de catálogo y estas tres no entraban porque su migración nunca las restringió. | 🟡 | migración escrita, sin aplicar | [migración](../supabase/migrations/20260816191133_cerrar_open_month_a_anonimos.sql) · [verificación](../scripts/verificar-seg8-anon-2026-08-15.sql) |
| **SEG-17** | 🔴 **`TRUNCATE` en manos de cualquier usuario con sesión — y `TRUNCATE` NO pasa por RLS.** Encontrado el 2026-08-17 al verificar la migración de `memberships`: la migración concede `SELECT, INSERT, UPDATE, DELETE` y la base terminó además con **TRUNCATE**, TRIGGER y REFERENCES para `authenticated`. No los agrega la migración sino los **default privileges** del esquema, que dan ALL a `authenticated` en cada tabla nueva; el GRANT explícito es aditivo y no acota nada. RLS filtra SELECT/INSERT/UPDATE/DELETE pero **no TRUNCATE**, así que un padre o un atleta podía vaciar tablas completas de TODAS las escuelas sin que ninguna policy lo detuviera. Es la misma trampa que CLAUDE.md ya documenta para funciones (`EXECUTE` a `authenticated` por default privilege), pero en tablas — donde se venía confiando en que RLS tapaba todo. Migración: revoca los tres privilegios en todas las tablas de `public`, ajusta los default privileges para que no vuelva, y agrega **I5** a `invariantes_seguridad()` para que `npm run seguridad:invariantes` lo vigile. Nada de la app depende de esto: PostgREST no expone TRUNCATE y el BFF va con `service_role`. | 🟡 | migración escrita, sin aplicar | [migración](../supabase/migrations/20260817210308_truncate_no_pasa_por_rls.sql) |
| **SEG-18** | 🟡 **60 policies `FOR ALL` sin `WITH CHECK`, en 56 tablas** (invariante I3, medido contra la base el 2026-08-17 con I1, I2 e I5 ya en cero). Sin `WITH CHECK`, PostgreSQL valida los INSERT con la expresión de `USING` — que se escribió pensando en «qué filas puedo VER», no en «qué filas puedo CREAR». Así es como una policy `USING (email = auth.email())` dejaba a cualquiera insertarse como staff de **cualquier** escuela. **60 no son 60 agujeros:** cuando el `USING` también restringe correctamente la escritura, el efecto es el mismo y solo falta ser explícito. Hay que leerlas una por una y separar las que de verdad permiten escribir fuera de alcance. Las que más concentran: `reservation_payments`, `event_delegation_payments`, `attendance_sessions` y `coach_profiles` (2 cada una); el resto son de a una. Empezar por las que tocan **dinero** (`reservation_payments`, `event_delegation_payments`, `payment_tokens`) y por `unregistered_athletes` y `enrollments`, que son las que crean identidad y cartera. | 🔵 | auditoría mediana | `npm run seguridad:invariantes` |
| SEG-11 | **Higiene del BFF.** Cuatro cosas de la misma pasada: **(a)** el error handler solo devuelve mensaje genérico si `NODE_ENV === 'production'`, y staging corre con `NODE_ENV=staging` → **devuelve `err.message` crudo al cliente**, y de paso el rate limit sube a 2000 por el mismo ternario; **(b)** `requireAuth` responde 403 con `detail: profile_id=<uuid> no encontrado en school_members…`, que filtra UUID interno y estructura de tablas (y `requireRole` devuelve `receivedRole`, útil para enumerar privilegios); **(c)** el auth se monta **por router, no globalmente**, así que la garantía «todas las rutas privadas» depende de no olvidarse — y ya hay olvidos (`SEG-9`); **(d)** `requireCsrfHeader` solo se aplica en 2 routers (`payment-tokens`, `recurring`); el resto de mutaciones no lo exige. | 🔵 | 3–4 d | barrido 2026-08-12 |
| SEG-12 | **Observabilidad: no hay.** `pino-http` está bien configurado (serializers que no vuelcan bodies), pero **Sentry no está instalado** — no figura en el `package.json` de ninguno de los dos servicios ni hay `Sentry.init` en ningún lado; solo existe como tipo opcional en `vite-env.d.ts`. 🔴 **Y la política de privacidad lo declara como proveedor de datos ante el usuario** (`PrivacyPage.tsx:324`, y otra vez en la cláusula de transferencia internacional): eso es un problema de exactitud legal, no solo técnico — o se instala, o se saca del texto. Sin centralización no hay alertas ni detección de anomalías: los logs viven en Render con retención corta y `debug.log` en disco efímero. Hay 64 `console.log` fuera de pino. `security_audit_log` sí existe en la BD pero nadie la vigila. | 🔵 | 3 d | barrido 2026-08-12 |
| SEG-13 | **Gestión de secretos y segundo factor.** Los secretos de pasarela por escuela **sí** están bien: AES-256-GCM en `payment_provider_secrets`, clave dedicada, descifrado solo en el BFF (`payment-crypto.ts`). Lo que falta es alrededor: no hay secrets manager (Doppler/AWS SM) ni rotación ni registro de cuándo se rotó — los secretos viven como env vars en Render y Vercel; **«scopes mínimos» no aplica porque no existen**: el BFF entero corre con `service_role`. Y **no hay MFA en ningún rol, ni siquiera `super_admin`** (lo único que hay es el componente `input-otp` de shadcn, sin usar) — lo cual pesa justo sobre `ADM-3`, que le da a una sola pantalla el control de las ~40 opciones de cualquier escuela. | 🔵 | 1 sem | barrido 2026-08-12 · `D1-pagos` (§5) |

#### El barrido del 2026-08-12 — por qué cambia la prioridad del track

Auditoría ejecutada contra la base viva (`luebjarufsiadojhvxgi`, la compartida dev/stg/prod: **son
datos reales**), no contra el repo. Todo con `SELECT`; nada se modificó. Método reproducible para
comprobar RLS de verdad: `set role anon; select count(*) from <tabla>; reset role;`.

**Lo que salió mejor de lo que decía el repo:**

| Medición | Repo | Base viva |
|---|---|---|
| Tablas con RLS | 139 (contadas en migraciones) | **224 de 224**, 619 policies, cero `DISABLE` |
| `search_path` mutable | ~35 funciones | **8** |
| Tablas con RLS y sin policy | — | 13, y es deny-all correcto |

Que el repo subcuente 85 tablas es otra cara de **`INF-1`**: la cadena de migraciones ya no
reproduce la base.

**Lo que salió peor:**

> `anon` tiene GRANT de `SELECT, INSERT, UPDATE, DELETE, TRUNCATE` sobre **~230 tablas**. Es el
> default de Supabase y no es un error en sí — pero significa que **RLS es literalmente lo único
> que separa a un anónimo de la base**, y que cada policy con `USING (true)` es una puerta abierta
> de verdad, no un aviso teórico. Es el mismo argumento que ya está escrito para la consola de
> `ADM`: el `service_role` del BFF salta toda la RLS.

**El desplazamiento de prioridad, que es lo que importa:** el track `SEG` se armó desde la vista del
linter, y esa vista es **~96 % ruido**. De los 502 avisos de `SECURITY DEFINER`, los que valían algo
eran dos, y solo uno es un hueco real (`SEG-8`). Al mismo tiempo, **ninguno** de los hallazgos que
viven fuera de Postgres estaba mapeado: `SEG-9` a `SEG-13` son todos nuevos. Regla que queda: *el
linter cubre la capa de datos y hay que seguirlo, pero no ve el BFF ni la infraestructura, y ahí
estaba lo explotable.*

### CAR — Club Carmel (fecha dura: 19-ago-2026)

Único bloque del roadmap con **un tercero esperando del otro lado**. Club campestre, ~800
deportistas, 8 disciplinas, escuela formativa + membresías. **Las membresías se pagan en el club,
no por SportMaps**, y la escuela formativa tampoco factura por nosotros: el trial va sin dinero.

`CAR-2` y `CAR-3` **no son trabajo de Carmel** — son capacidades de plataforma que Carmel obliga a
construir y que sirven a los siguientes clientes de este tipo. El resto sí es específico.

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| **CAR-1** | **Alta como `hybrid`** + poblar sus 8 `sport_configs`. **Instalaciones: NO** — decisión 2026-08-17, las crea el club con sus nombres y tarifas. ✅ Las 8 disciplinas quedaron confirmadas contra la fuente del club ([«Quiénes somos»](https://www.carmelclub.com.co/procedures/noticia.php?id=2364)): golf, tenis, fútbol, voleibol, baloncesto, pádel, natación y gimnasio. Las categorías salen del catálogo de cada federación (golf 5 R&A/USGA · tenis 7 ITF · fútbol 7 FIFA · voleibol 4 FIVB · baloncesto 7 FIBA · pádel 7 FIP · natación 6 World Aquatics) y el eje entra en `division`, no en `age`: el catálogo guarda NOMBRES («Sub-11»), y si en este club Sub-11 va de 9 a 11 o de 10 a 11 lo decide el club — inventar el rango para contentar al validador es lo que se sacó del script. ⚠️ `gimnasio` **no está en el catálogo** (ver `MOD-16`): entra con eje `none`, que para un gimnasio es correcto. ⚠️ Sigue en pie que **la única fila de `sport_configs` es de `MMA BLAIR TEAM`** (cuenta test): el camino multideporte nunca se ejerció con un cliente real. Ensayar en **Club Campestre Demo** antes. | 🟢 | script listo, espera el alta del 19 | [script](../scripts/carmel-configurar.mjs) · [plan](plan-club-carmel-multideporte-2026-08-15.md) |
| **CAR-2** | **`billing_enabled` por escuela** — interruptor maestro de cobros a familias. Hoy **no existe forma de apagarlos**: `school_addons` no tiene llave de mensualidades (es núcleo, no addon) y `active_modules` es aditivo, está poblado en 1 de 365 y lo puede tocar el propio cliente. Migración escrita: columna + trigger que fuerza `auto_generate_payments`/`late_fee_enabled`/`reminder_enabled` a false (así **los tres crons no se tocan** — ya filtran por esos toggles) + `has_billing` en la vista + RPC de super admin. Falta el cableado del menú y el switch en el panel. | 🟡 | migración escrita, sin aplicar | [migración](../supabase/migrations/20260815141039_billing_enabled_por_escuela.sql) |
| **CAR-3** | **Cablear el menú a los entitlements.** Hoy el sidebar se arma **por rol** y solo consulta un addon (`store`): `has_academy`, `has_reservations` y `has_billing` no los mira nadie. Sin esto, ni `CAR-2` oculta nada ni el multideporte se nota. Misma pasada que resuelve las tres. Incluye el **selector de deporte activo** (como el de sede) para que las páginas lean de `sports[]` y no de `primarySport`. | 🟢 | mediano | [plan](plan-club-carmel-multideporte-2026-08-15.md) §3 |
| **CAR-4** | **Membresías del club** — CONSTRUIDO 2026-08-17, falta aplicar la migración. Tabla `memberships` deliberadamente **fuera de facturación**: sin montos, sin FK a pagos, ningún cron la mira. Sujeto con la convención de `payments`/`enrollments` (XOR user_id / child_id / unregistered_athlete_id) e índices únicos parciales: una membresía vigente por persona y escuela. RLS del staff con las cuatro policies separadas y `WITH CHECK` explícito (I3), `user_staff_school_ids()` y no `user_school_ids()` (I2), `anon` sin privilegios. **`valid_until` no vence solo** y la UI lo respeta: cuando la fecha pasó y el estado sigue activo, avisa «por revisar» en vez de dar la membresía por vencida — un vencimiento automático con dato rezagado deja socios al día sin acceso. Pantalla `/memberships` con listado, filtro, alta manual y **carga por archivo** (cruza por documento, y lo que no resuelve lo reporta línea por línea sin crear a nadie). La insignia también sale en el listado de atletas, solo para quien tiene membresía. El ítem del menú aparece cuando los cobros están **apagados**. | 🟡 | migración escrita, sin aplicar | [migración](../supabase/migrations/20260817142331_memberships_del_club.sql) · [plan](plan-club-carmel-multideporte-2026-08-15.md) §2.1 |
| **CAR-5** | **Métricas de natación y golf.** El catálogo tiene 99 deportes y ambos están; `sport_metric_definitions` cubre solo 6 deportes (voleibol 51, fútbol 12, y cuatro con 4) — **natación y golf en 0**. La UI de captura ya existe: es trabajo de definición deportiva. Las validan los entrenadores. ⚠️ Los parciales de natación son series, no escalares: fuera del set inicial hasta verificar que `performance_entries` los aguanta. Ojo con `higher_is_better=false` (tiempo y hándicap). | 🔵 | pequeño + definición | [plan](plan-club-carmel-multideporte-2026-08-15.md) §4 |
| **CAR-6** | **Carriles de piscina en reservas.** Hoy una piscina es *una* instalación con capacidad N; «carril 3 de 6» no se puede expresar. Camino barato para el trial: cada carril como `facility` propio (sin código, riesgo: no impide reservar la piscina completa y un carril a la vez). Camino correcto si duele: `facility_units` con «reservar el padre bloquea los hijos» — sirve también para canchas divisibles. | ⚪ | pequeño / mediano | [plan](plan-club-carmel-multideporte-2026-08-15.md) §5 |
| **CAR-7** | **Video de partidos (Veo).** Cero referencias en el repo, confirmado por dos vías. Lo que piden es **análisis de partidos y comportamiento por jugador**, que depende de qué exponga la API de Veo — y no sabemos si tienen plan con API. Empezar por el enlace manual (`video_url` + embed) cubre «ver el partido desde la ficha del equipo» sin negociar acceso a un tercero **durante un trial**. | ⚪ | pequeño (enlace) / por definir (análisis) | [plan](plan-club-carmel-multideporte-2026-08-15.md) §6 |

### INF — Infraestructura y deuda de esquema

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| INF-1 | **Deriva de esquema sin versionar.** ~336 objetos que la base tiene y el repo no crea: 56 tablas, 137 funciones, 143 columnas. Hay módulos enteros fuera del repo. La cadena de migraciones ya no reproduce la base. Se mide con `npm run migrations:drift`. Ayer se cerró el dominio de rendimiento; **hay que versionar por dominio, empezando por el que bloquee la siguiente fase.** | 🔵 | continuo | memoria `project_unversioned_schema_drift` |
| INF-2 | **Dos mecanismos de cron coexisten** en el BFF (deuda documentada). | 🔵 | 2 d | [auditoría §3.6](AUDITORIA_ARQUITECTURA.md) |
| INF-3 | **Triple vocabulario de roles.** `public.roles` usa `school_admin`, no `admin`; hay tres nomenclaturas conviviendo. | 🔵 | 3 d | [auditoría §4.2](AUDITORIA_ARQUITECTURA.md) |
| INF-4 | **Rendimiento: el cuello no es la BD.** CPU al 5%; el problema es RLS amplificando `school_athletes` ×3000 en buffers + 3 round-trips por request en el BFF. | 🔵 | 1 sem | memoria `project_perf_audit_2026_07` |
| INF-5 | **`programs` es legacy** y 4 funciones todavía lo referencian (una ya rompió la página de carnets). | 🔵 | 1 d | memoria `project_carnets_digitales` |
| **INF-7** | **Las migraciones se aplican por una vía que no deja registro.** Se pega SQL en el editor de Supabase, que **no escribe en `supabase_migrations.schema_migrations`**. Consecuencia medida el 2026-08-16: cuatro ítems del roadmap marcados 🔴 llevaban días resueltos (`SEG-14`, `SEG-9`, `SEG-10`) o aplicados en producción (`DIN-4`), y averiguarlo costó comprobaciones indirectas —¿existe `mask_person_name()`?, ¿`payment_links` devuelve 0 a `anon`?— en vez de una consulta. `migrations:pendientes` lo advierte en su propia salida: *«esto dice sin registro, NO sin aplicar»*. **Mientras siga así, el roadmap va a volver a mentir y no se puede priorizar sobre él.** Fix: aplicar por el CLI de Supabase o `apply_migration`, y hacer un backfill único de las que ya están vivas. | 🔵 | 1 d + backfill | verificación 2026-08-16 |
| INF-6 | **Borrar las 22 escuelas de prueba vacías.** Ya están marcadas `test` (§1.2) y separadas de las 4 demos curadas, así que el borrado dejó de ser urgente — es higiene. ⚠️ Tres trampas conocidas: hay que borrar `profiles` **antes** que el usuario de auth; `school_staff.coach_auth_id` y `storage.objects.owner` no caen por cascada; y `Spirit Fontibon (Test)` tiene **403 miembros** cuyos perfiles pueden pertenecer a otras escuelas — ahí se borra la membresía, nunca la persona. Requiere script con `--dry-run` que reporte filas dependientes. **No arrancar sin resolver las 6 escuelas ambiguas** marcadas `test` que tienen atletas y dinero adentro. | ⚪ | 1 d | [plan](plan-limpieza-y-demos-curadas-2026-08-12.md) |
| ~~**INF-8**~~ | ✅ **CERRADO el 2026-08-17. La causa era el gate apuntando a la nada.** El pre-commit y el CI **ya corrían** `npx tsc --noEmit` en `frontend/`… pero `frontend/tsconfig.json` es un config de **solución** (`"files": []` + `references`), así que `tsc --noEmit` a secas revisa **cero archivos y sale 0**. El gate estuvo verde mientras se acumulaban **275 errores**, y por ahí se desplegaron seis `ReferenceError` que mataban pantallas enteras (Equipos, registro de escuela, carrito, /mi-plan, reserva de servicios, anuncios). `vite build` tampoco typechequea: transpila con esbuild. **Arreglado:** los dos gates ahora usan `-p tsconfig.app.json` y `-p tsconfig.node.json`; los tipos generados de Supabase se regeneraron (estaban del 9 de agosto, sin `sports_categories.slug`, `vendor_profiles` ni `service_listings` — 200 de los 275 errores eran eso); y los 66 restantes se corrigieron uno por uno, destapando **16 flujos que fallaban en la base**. **tsc queda en 0**, así que cualquier error nuevo es una regresión y el gate por fin muerde. Queda `npm run verificar:runtime` para diagnosticar rápido cuál error de tipos rompe una pantalla (filtra a TS2304/2552/2448/2449). | ✅ | — | [gate](../scripts/verificar-nombres-sin-declarar.mjs) · [ci](../.github/workflows/ci.yml) |
| **INF-9** | ⚠️ **`20260817133556_restaurar_booking_holds` NO SE CORRE — superseded por `20260817140943_restaurar_booking_holds_v2`.** Abortó con `42883: operator does not exist: uuid = uuid[]`: la policy del staff usaba `= ANY ((SELECT public.user_staff_school_ids()))`, y cuando lo que sigue a `ANY (` es un `SELECT`, PostgreSQL lo parsea como **subconsulta** — compara el uuid contra cada FILA, y cada fila es el `uuid[]` completo. El paréntesis extra no cambia el parseo. La v2 usa `IN (SELECT unnest(...))`, que no admite dos lecturas y sigue resolviéndose una sola vez por consulta (SubPlan hasheado). Iba en `BEGIN/COMMIT`, así que el rollback no dejó nada a medias — verificado: `booking_holds` sigue sin existir. **Lección para el resto de las policies que usan los helpers de alcance:** los tres devuelven `uuid[]`, así que `= ANY (fn())` va sin `SELECT` adentro, o se envuelve con `unnest`. | 🟡 | v2 escrita, sin aplicar | [v2](../supabase/migrations/20260817140943_restaurar_booking_holds_v2.sql) · [la que abortó](../supabase/migrations/20260817133556_restaurar_booking_holds.sql) |

### UX — Interfaz, navegación y densidad

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| UX-1 | **Primitivas de layout.** `<PageShell>` con 4 anchos (hoy hay 24 distintos porque el `<main>` no fija ninguno), `<PageHeader>` compacto (hoy 78 páginas con un bloque de ~110 px), 3 tamaños de modal en vez de 17, y una escala de espaciado de 4 pasos en vez de 7. **Barato y desbloquea todo lo que se construya después.** | 🔵 | 3–4 d | sesión 2026-08-01 |
| UX-2 | **`DataTable` único.** Hoy hay 20 listados ad hoc. Incluye **F-01: un error de fetch se muestra como tabla vacía en silencio** (crítico, y toca dinero) y **F-02: la pantalla de pagos hace fetch-all sin límite**. `AdminActivityLogsPage` es la referencia buena (`usePagedRpc` + `Pager` + guard de stale). | 🔵 | 1 sem | memoria `project_frontend_tables_audit` |
| UX-3 | **Menú lateral — capa barata.** Desduplicar iconos (`Users` marca 4 ítems distintos), renombrar los choques («Finanzas → Finanzas y Contabilidad → Finanzas», cuatro cosas llamadas «reporte»), aplicar el gating por plan a los ítems (hoy solo el grupo «Mi Tienda» mira `hasAddon`) y hacer que el acordeón funcione en modo icono. | 🔵 | 1–2 d | sesión 2026-08-01 |
| UX-4 | **Menú lateral — reestructura.** De 36 destinos en 6 grupos a 24, con ningún grupo de más de 5 ítems y 12 pantallas movidas a pestañas dentro de la pantalla a la que pertenecen. Implica tocar páginas, no solo el config. | ⚪ | 1 sem | sesión 2026-08-01 |
| UX-5 | **Master-detail en los listados.** Sustituir el modal de «ver registro» por un panel de detalle a la derecha en Atletas, Cobros y Comprobantes. Depende de UX-2. | ⚪ | 1 sem | sesión 2026-08-01 |
| UX-6 | **Matar las features falsas del atleta.** Privacidad 100 % cosmética, `/messages` sin compose ni triggers y con «Contactar» de mentira, botón «Crear Evento» sin gateo en el calendario del atleta, `sports_interests` que nadie consume. ⚠️ El hallazgo de notificaciones cosméticas probablemente quedó resuelto al construir el módulo unificado — **verificar antes de trabajar.** | 🔵 | 1–2 d | [athlete remediation §F0](athlete-modules-remediation-plan.md) |

### MOD — Módulos de producto

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| MOD-1 | **Revisión previa al envío masivo (onboarding safety F1).** Gate para no volver a mandar cientos de correos con datos mal cargados. El plan ya corrigió el error que lo habría roto en el primer intento (el BFF hablaba con la RPC como `service_role`, donde `auth.uid()` es NULL). | 🟡 | 3 d | [plan](plan-f1-revision-previa-envio.md) · [spec](specs/school-onboarding-safety.md) |
| MOD-2 | **Catálogo de categorías deportivas (F1).** Las tablas nacen vacías y ningún flujo existente las lee: riesgo nulo sobre datos productivos. **Es lo único del roadmap que se puede entregar sin esperar respuesta de ninguna escuela.** | 🟡 | 3–4 d | [plan-f1](plan-f1-catalogo-de-categorias.md) |
| MOD-16 | **El catálogo no tiene gimnasio, fitness ni CrossFit.** Los 99 deportes de `sports_categories` cubren federaciones olímpicas, pero «Gimnasia» ahí es la artística y la rítmica — nada que ver con un gimnasio. Y `teams.sport` **ya tiene «Gimnasio» y «CrossFit» en producción**, además de que el motor de demos incluye un tenant de crossfit. Hoy esos deportes entran con eje `none` y sin categorías. CrossFit **sí** tiene divisiones reales que se pueden mapear sin inventar (Rx / Scaled / Foundations y las Masters por edad de los CrossFit Games); un gimnasio de clases dirigidas se agrupa por nivel, que es decisión de producto y no de federación — hay que resolverla explícitamente, no colarla. | 🔵 | pequeño + definición | detectado al configurar `CAR-1` |
| MOD-3 | **Multi-categoría (F2+).** 1 inscripción + `enrollment_categories`, precio por cantidad (145k/165k) vía `monthly_fee`. Depende de DIN-1. | 🔵 | 2 sem | [spec](specs/sport-categories-and-multi-category.md) |
| MOD-4 | **Notificaciones F2–F6 + go-live en producción.** El motor ya funciona en dev. | 🔵 | 3 sem | [spec](specs/notifications-unified.md) |
| ~~MOD-5~~ | **Disuelto.** «Contabilidad fases 1–6» era el mismo trabajo que `ERP-2..6`. La UI para vendor y organizer sigue pendiente y va dentro de `ERP-2` (el eje `owner_type`/`owner_id` ya existe desde la fase 0). | — | — | §3 |
| MOD-6 | **Dotación e inventario por fases.** Custodia de equipo a entrenadores con acta y evidencia fotográfica. Aislado del marketplace, tier Pro. | 🔵 | 3 sem | [spec v1.1](specs/equipment-module.md) |
| MOD-7 | **Torneos: cerrar inscripción → bracket.** `events` + delegaciones ya existen en la base **sin versionar**; el bracket es net-new. | ⚠️🔵 | 4 sem | [decisiones](tournaments-decisions.md) · [inscripción](tournaments-enrollment-flow.md) · [scoring](tournaments-scoring-engine.md) |
| MOD-8 | **Asistencia y créditos de sesión.** Máx 1 crédito/atleta/día, la reserva descuenta y la asistencia no re-descuenta ese día, bloqueo del día al 2º coach. Incluye el saneamiento del eje plan↔equipo↔sesiones. | 🔵 | 2 sem | [plan créditos](plan-asistencia-y-creditos-de-sesion.md) · [saneamiento](plan-saneamiento-sesiones-plan-equipo.md) |
| MOD-9 | **Informes de asistencia.** Decisiones de producto cerradas. | 🔵 | 1 sem | [spec](specs/attendance-reports-module.md) |
| MOD-10 | **Complementos de métricas de rendimiento (C-A…C-K)** + `higher_is_better`, pesos, normalización, benchmark, y la UI de crecimiento. | 🔵 | 3 sem | [complementos](performance-metrics-complements.md) · [spec](performance-metrics-spec.md) |
| MOD-11 | **Marketplace: desplegar lo que ya está en código.** `marketplace_transactions` no existe en la base — el módulo escolar y externo está construido pero **no desplegado**. Después: M8 planes vendor, M9 split multi-vendor en carrito, M10 3D/AR, M11 Mox real, M12 email transaccional.<br>⛔ **GATE DE DESPLIEGUE: no se despliegan las migraciones de `marketplace_transactions` hasta cerrar F-D del [plan de ruteo de pagos](plan-cierre-ruteo-de-pagos.md).** Cinco de los seis endpoints de `marketplace-checkout.routes.ts` (135, 191, 248, 314, 568) **no llaman a `resolveProvider`** — solo el de carrito (446) lo hace — así que caerían a ENV, que en staging es Dynasty. Hoy el riesgo es teórico **solo porque la tabla no existe**: desplegarla lo arma. | 🔵⛔ | 1 sem + M8–M12 | memoria `project_stores_marketplace_state` · [gate F-D](plan-cierre-ruteo-de-pagos.md) |
| MOD-12 | **Self-service de planes y addons (fases 1–4).** De activación manual asistida por ventas a autoservicio instantáneo, luego auto-renew, ciclo de vida y onboarding desde la landing. | 🔵 | 3 sem | [roadmap](self-service-planes-addons-roadmap.md) · [vendor subs](saas-vendor-subscriptions-plan.md) |
| MOD-13 | **Facturación de sesiones y cobro por plan.** | 🔵 | 1 sem | [spec](specs/invoice-plan-sessions-and-collection.md) |
| MOD-14 | **Carnets: cerrar el editor de plantillas** y quitar las referencias a `programs`. | ⚠️ | 3 d | memoria `project_carnets_digitales` |
| MOD-15 | **WhatsApp: System User permanente de Meta.** Sin esto el bot muere cada 2 horas. Bloquea WA3–WA5. | 🟢 | 4 h | memoria `project_whatsapp_wa1_wa2_built` |

### BLQ — Bloques largos

No arrancan hasta que P0 y P1 estén cerrados. El detalle técnico (DDL, RLS, endpoints, tests)
está en los anexos A–F del [roadmap archivado](archived/ROADMAP-v1.3-2026-05-12.md).

| ID | Bloque | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| BLQ-1 | **Reservas** F0 foundation (rol `facility_manager`, `schools.kind`, `DashboardRouter`) → F7 mobile. **El modelo de reserva es `CONC-4`**: soft lock con expiración, no una tabla de reservas confirmadas. | 🔵 | ~17 sem | memoria `project_reservations_module` · [concurrencia §3](architecture/concurrencia-y-reservas.md) |
| BLQ-2 | **Venue/Gym + control de acceso multi-marca (Fase H).** Secuencia 0→1→3→4→2→H con 10 gates duros (G-ENUM, G-BIO-INTL, G-MINOR, G-FAIL, G-RLS…). H gateada hasta tener 0-4 en producción y un gimnasio pagando. | 🔵 | 12 sem | memoria `project_venue_gym_access_control` |
| BLQ-3 | **Mobile (Capacitor).** Primero las 7 decisiones abiertas y las compras; después N1 wrapper → N2 nativas → N3 tiendas → N4 offline. Split de cobros, cero IAP. | ⚪ | 6 sem | [plan de ejecución](MOBILE_ROADMAP_EXECUTION.md) · memoria `project_mobile_strategy` |
| BLQ-4 | **WhatsApp WA3–WA5.** Pagos por WA, modo auto + inbox + analytics, y V2 (voz, multi-idioma, multi-sede). Bloqueado por MOD-15. | 🔵 | 10 sem | [anexos WA](archived/ROADMAP-v1.3-2026-05-12.md) |
| BLQ-5 | **Wellness Pro W1–W5.** Núcleo clínico, ficha + tests funcionales + consentimientos, mensajería contextual + bonos + telesalud, wearables + IA coach, hardening + compliance. Datos clínicos inmutables con retención de 5 años (Ley 23/1981). | 🔵 | 8 sem | [anexos W](archived/ROADMAP-v1.3-2026-05-12.md) |
| BLQ-6 | **White-label por tiers** (Start/Pro/Elite/Enterprise), fases 1–6. Ojo con el bug histórico de scoping del `ThemeContext`. | 🔵 | 6 sem | memoria `project_white_label_tiers` |
| BLQ-7 | **Gym Member App «SportMaps Fit».** Híbrido que lidera con gamificación + wearables + ecosistema. Sin integración de hardware físico en el alcance. | ⚪ | — | memoria `project_gym_member_app` |
| BLQ-8 | **Track disruptivo D1–D4** (torneos relámpago, IoT «Airbnb deportivo», pasaporte deportivo global, scouting con IA) + ruta de validación internacional. | ⚪ | — | [strategic §7.bis](sportmaps-strategic-roadmap.md) |

---

## 3. Track Contable — la secuencia única del dinero

Todo lo que toca plata, en un solo orden. Esta sección existe porque el trabajo contable estaba
repartido entre cinco documentos que no se citaban entre sí.

### 3.1 La decisión que gobierna el track: partida doble — RESUELTA

**El módulo lleva libro mayor completo desde la primera fase** (D-PD, 2026-08-01). SportMaps no tenía
nada de eso: ni comprobantes, ni plan de cuentas, ni asientos. Se construye dentro de `ERP-2`.

Lo que la decisión implica, y hay que asumir de entrada:

- **`ERP-2` pasa de ~3 semanas a ~6–7.** No hay una fase «libro mayor» opcional al final: entra al principio.
- **Ningún flujo de dinero se puede registrar sin contrapartida definida.** Hoy un gasto se guarda con
  una categoría; con partida doble no se guarda sin saber contra qué cuenta va. Eso obliga a un
  **mapeo de cuentas por escuela** que hay que poblar **antes** de que el módulo sirva para nada.
- **Aparece el período contable cerrado** (`ERP-3`), que es el punto donde el mayor se engancha con el
  ciclo de mes.
- **La inmutabilidad deja de ser opcional:** un asiento contabilizado no se edita ni se borra nunca.
  Toda corrección es un asiento nuevo de reverso con referencia al original y motivo obligatorio.
- **El mayor tiene que incluir el ingreso principal de la escuela**, o no es un mayor. Por eso `ERP-5`
  no es solo «leer `payments`»: es **postear** sus eventos al mayor sin migrar la tabla.

Dos límites explícitos, para que la decisión no crezca sola:

> **La historia no se contabiliza hacia atrás.** El mayor arranca en una fecha de corte con un asiento
> de **saldos de apertura**; no se posteán años de `payments` y `expenses` retroactivamente (D-CORTE).
> Postear la historia completa es la forma habitual de que un proyecto de libro mayor nunca salga a
> producción.

> **La facturación electrónica sigue sin exigir partida doble.** `DIN-8` emite vía el PAC, que no pide
> el mayor. Los dos avanzan sin bloquearse.

### 3.2 La tensión con el ciclo de mes, y cómo se resuelve

El [spec del ciclo de mes](specs/month-close-module.md) decidió en su **D7**: «¿Asientos contables?
Solo lectura en v1 — **Contable aún se define**; el snapshot es autosuficiente para asientos
retroactivos». Esa decisión estaba condicionada a que Contable no estuviera definido. Ya lo está, así
que D7 no se contradice: **se resuelve**, con tres consecuencias sobre el cierre:

1. El cierre **ya no genera asientos retroactivos**: el mayor se puebla en tiempo real.
2. El cierre gana una responsabilidad nueva: **bloquear el período contable** (`ERP-3`).
3. El snapshot cambia de rol — deja de ser la fuente de verdad del período y pasa a ser un **reporte
   congelado sobre el mayor**. Sigue sirviendo (respuesta rápida, histórico inmutable), pero ya no es
   lo único que sostiene la foto.

⚠️ **Pendiente de mantenimiento:** el §12 del spec del ciclo de mes todavía dice «solo lectura en v1».
Hay que actualizar esa fila cuando `ERP-2` entre a plan.

### 3.3 El orden

| # | Etapa | Por qué va aquí | Prioridad |
|---|---|---|---|
| 1 | **`DIN-1`** — estabilizar la generación de cobros | Nada contable se construye encima de un motor que puede duplicar o abortar el mes | P0 |
| 2 | **`DIN-3`** — `payment_provider` deja de mentir | 4 horas, y la reconciliación deja de contar mal | P0 |
| 3 | **`ERP-1`** — quick wins de UX contable | Sin dependencias; misma pasada que `UX-1` | P1 |
| 4 | **`CONC-1`** — idempotencia general | **Prerrequisito de `ERP-2`**: un doble clic en «cruzar» no puede aplicar dos veces | P1 |
| 5 | **Responder D-T, D-MIG, D-PUC, D-CORTE** | Cuatro decisiones que no dependen de código y bloquean `ERP-2` | P1 |
| 6 | **`DIN-5`** — cerrar H-03/04/05/07 | Mismo terreno que `DIN-1`, aprovecha el contexto | P2 |
| 7 | **`ERP-2`** — libro mayor + núcleo CxP | Aquí aparece lo que hoy no se puede hacer: abonar a un gasto, pagar N facturas con un giro | P2 |
| 8 | **`ERP-3`** — períodos contables y bloqueo | Es la bisagra con el cierre de mes | P2 |
| 9 | **Ciclo de mes F1** — `monthly_closes`, cierre de cobros, snapshot sobre el mayor | Requiere `DIN-1` cerrado y `ERP-3`. `monthly_closes` **no existe en ninguna migración** todavía | P2 |
| 10 | **`ERP-4`** — nómina como obligación | El motor de liquidación ya existe; falta la obligación de pago | P2 |
| 11 | **`ERP-5`** — CxC: lectura + posteo al mayor | Sin esto el mayor no incluye el ingreso principal | P2 |
| 12 | **Ciclo de mes F2–F6** — sub-cierres por `scope` → Estado de Resultados | Depende de `ERP-2` y `ERP-4`: de ahí salen gastos y nómina | P3 |
| 13 | **`ERP-6` + `UX-4`** — retirar «Finanzas» y «Proveedores» del menú | Juntos, o hay que tocar el menú dos veces | P3 |
| 14 | **`DIN-8`** — facturación electrónica DIAN | Sobre obligaciones ya estables | P3 |

### 3.4 Lo que deliberadamente no se toca

**CxC — las mensualidades de las familias — no se migra al modelo de obligación.** Ese flujo tiene su
propia máquina de estados en producción con dinero real, tres índices únicos de dedup por periodo,
motor de mora, conciliación bancaria, ciclo de glosa y pago parcial vía `payments.total_paid`. Y acaba
de ser estabilizado en `DIN-1`, que todavía no cierra.

Migrarlo daría consistencia conceptual a cambio de rehacer el flujo con más dinero del producto. En su
lugar, `ERP-5` lo **lee y lo postea**: misma pantalla, mismos totales, el mayor completo, cero
migración de datos.

---

## 4. Cola priorizada

El criterio, en orden: **dinero mal contado** → **seguridad** → **ingreso que se regala** →
**deuda que encarece todo lo demás** → **módulos con spec cerrada** → **bloques largos**.

> **Corrección (2026-08-16).** El 15-ago se escribió acá que del 12 al 15 se había trabajado
> «debajo de esta línea», con los cuatro `SEG` de P0 abiertos. **Era falso, y la fuente del error
> fue este mismo documento.** Verificado contra la base viva el 16-ago: `SEG-14`, `SEG-9` y
> `SEG-10` **ya estaban cerrados**. Solo `SEG-8` sigue sin verificar.
>
> El problema real no es la cola: es que **el tablero no refleja lo que está vivo**. Tres ítems
> marcados 🔴 llevaban días resueltos, y `DIN-4` figuraba como «3–4 semanas sin empezar» estando
> aplicado en producción. Sobre un tablero así no se puede priorizar — ni criticar la prioridad.
>
> **Causa raíz, y es una sola:** las migraciones se aplican pegando SQL en el editor de Supabase,
> que **no escribe en `schema_migrations`**. Por eso `migrations:pendientes` no distingue «nunca se
> corrió» de «se corrió por el editor», y por eso cada verificación cuesta una comprobación
> indirecta —`mask_person_name()` existe, `payment_links` devuelve 0 a `anon`— en vez de una
> consulta. Mientras siga así, este documento va a volver a mentir. Mover la aplicación al CLI de
> Supabase o a `apply_migration` es la corrección de fondo → `INF-7`.
>
> **La regla operativa que sí queda:** lo que se entrega se marca **el mismo día** (§0), y lo que
> diga 🔴 se verifica contra la base **antes** de usarlo para decidir.
>
> **Cómo conviven el 19-ago y lo demás.** No compiten: lo que queda de seguridad es `SEG-8`
> (aplicar una migración escrita) y `CAR` son días. Meterlo primero no mueve la fecha.

### P-1 — Antes del 19-ago. Primero lo que ya está escrito y no protege a nadie

| Orden | ID | Por qué antes que Carmel | Esfuerzo |
|---|---|---|---|
| ~~1~~ | ~~**SEG-14**~~ | ✅ **Ya estaba aplicada** (verificado 2026-08-15): `mask_person_name()` existe en la base y enmascara (`Juan C. P. G.`), y esa función la crea justamente esa migración. Figuraba como pendiente porque **el SQL editor no escribe en `schema_migrations`** — el mismo problema de proceso que denuncia la auditoría. | — |
| ~~2~~ | ~~**SEG-8**~~ | ✅ **Verificado por catálogo el 2026-08-16**: de las 12 críticas, 9 están cerradas a `anon` y `authenticated` (`complete_refund`, `apply_late_fees`, `generate_monthly_charges`, `save_payment_token`, `upsert_school_provider`, `wa_verify_otp`, `auto_approve_payment`, `_notify_school_staff`, `expire_trials`). Las 3 que quedaban abiertas se cierran en `SEG-16`. | — |
| **1** | **SEG-16** | 🔴 **`open_month` la ejecuta cualquiera desde internet — y escribe dinero.** Verificado en vivo con la llave pública y sin sesión: HTTP 200. El guard dice `IF v_caller IS NOT NULL AND NOT (is_super_admin() OR is_school_admin(...))`, pensado para que pase el cron; pero `auth.uid() IS NULL` no significa «soy interno», significa «no traigo JWT» — que es lo que trae un anónimo. Con un `school_id` real (y `schools` es el directorio público de 365 filas legible por `anon`) genera las cuotas del mes de esa escuela. Mismo patrón en `preview_open_month` (fuga de qué se cobraría y cuánto) y `school_payment_kpis` (recaudo y mora por escuela). Fix = `REVOKE` a `anon`; no se reescriben las funciones porque el guard sí cubre bien a `authenticated`. | **aplicar ya** |
| ~~3~~ | ~~**SEG-9**~~ | ✅ **Ya estaba cerrado** (verificado 2026-08-16): los cuatro handlers se eliminaron el 12-ago en `access-adms.ts` y `access-api.ts`, con la justificación escrita en el código. No queda ninguna ruta `debug-logs` montada. | — |
| ~~4~~ | ~~**SEG-10**~~ | ✅ **Ya estaba cerrado** (verificado 2026-08-16 ejecutando como `anon`): `payment_links` → 0 filas (eran 91 con token), `school_staff` → 401, `facility_reservations` → 0 (eran 60). `children`, `payments` y `profiles` siguen en 0. `schools` (365) es el directorio público intencional. | — |
| 5 | **SEG-15** | Cierra la mitad viva de `DIN-4`. Aditivo (`RESTRICTIVE`), reversible con `DROP POLICY`. Conviene **antes** de que Carmel sea la primera escuela con `billing_enabled=false`. | aplicar |
| 6 | **CAR-1** | Camino crítico del 19. Ensayar en Club Campestre Demo primero. | horas |
| 7 | **CAR-2 + CAR-3** | La misma pasada: sin cablear el menú, `billing_enabled` no oculta nada y el multideporte no se nota. | mediano |

**Fuera del corte del 19** (no son camino crítico): sembrar los 5 tenants demo · borrar las 22
escuelas vacías (`INF-6`) · `CAR-4` · `CAR-5` · `CAR-6` · `CAR-7`. Si algo de esto se cuela, sale
del tiempo de lo de arriba.

### P0 — Después del 19. Hay dinero mal cobrado en producción

| # | ID | Por qué ahora | Bloqueante de |
|---|---|---|---|
| 0 | **Desplegar `DIN-11` + `DIN-12`** | **Ya están commiteados y no protegen a nadie hasta que suban.** `DIN-11` evita que se repitan los 20 cobros nacidos vencidos de la plataforma, y **conviene antes de la próxima apertura de mes** o hay que rehacer la limpieza. Tres despliegues: BFF a Render, frontend a Vercel, y `supabase functions deploy send-email --project-ref luebjarufsiadojhvxgi` (⚠️ el `project-ref` local apunta a otro proyecto). | Que no se repita el trabajo del 12-ago |
| — | ~~SEG-14 · SEG-8 · SEG-9 · SEG-10~~ | **Movidos a P-1**: van antes del 19-ago. Ver la cola de arriba. | — |
| 3 | **DIN-9** | **Una sesión, sin migración, sin tocar producción, y desarma el único footgun vivo**: hoy un pago de prueba desde dev cobra de verdad. Lo más barato de todo el roadmap con el riesgo más tonto. | Cualquier prueba de pagos |
| 5 | **DIN-1** | Plan consolidado escrito el 2026-08-01, **pendiente de aprobación**. Su primer paso es una puerta dura: verificar contra la base que las tres migraciones del 24-jul están aplicadas. Si no lo están, el alcance vuelve a ser el del plan original. | MOD-3 · todo el track contable |
| 6 | **DIN-3** | 4 horas de trabajo y la reconciliación deja de contar mal. Plan ya escrito. | Conciliación bancaria · DIN-6 |
| 7 | **SEG-1** | La Fase −0.5 es un drift **bloqueante**: hasta resolverlo, cualquier migración nueva puede aplicarse sobre un esquema distinto al que el repo cree. El alcance encogió (8 funciones, no ~35) y suma el toggle de contraseñas filtradas, que es gratis. | Toda migración posterior |

> Los cuatro `SEG` de P0 son **independientes entre sí y de todo lo demás**: uno enmascara una
> respuesta pública, otro es un `REVOKE`, otro borra cuatro handlers, el último reescribe tres
> `USING`. Ninguno espera una decisión abierta.
>
> **Y los tres del barrido del 12-ago comparten una lección:** `SEG-10` concluyó que `children`
> «devuelve 0 a `anon`» mirando la **tabla**, y `SEG-14` es la misma tabla filtrándose por una función
> `SECURITY DEFINER` que se salta RLS. Auditar RLS por tabla no alcanza: hay que auditar también las
> **195 funciones** que `anon` puede ejecutar.

> **Cuatro decisiones abiertas dentro de DIN-1** (§8 del plan consolidado): qué hace
> `students.ts:829` cuando el atleta queda sin equipo ni plan · si las 16 huérfanas se asignan antes
> del `CHECK` o después · si se backfillean los 349 cobros sin `period_*` · y quién concilia el
> sobrecobro de GYM RM.

### P1 — Próximas 3–4 semanas

| # | ID | Por qué |
|---|---|---|
| 8 | **SEG-2** | El único ERROR del linter (`school_athletes`). ⚠️ `SEG-3` ya **no** va acá: el barrido del 2026-08-12 mostró que es higiene, no riesgo — se extrajo lo explotable a `SEG-8` (P0) y el resto baja a P2. |
| 9 | **SEG-11 + SEG-12** | La misma pasada por el BFF: `NODE_ENV` de staging filtrando stack traces, CSRF en 2 routers de N, auth montado por router. Y Sentry, que **la política de privacidad ya le promete al usuario** y no existe — eso hay que cerrarlo en un sentido o en el otro. |
| ~~10~~ | ~~**DIN-4**~~ | ✅ **Entregado el 2026-08-12** y aplicado en producción (§1.2). Lo que queda de él es `SEG-15`, que subió a P-1. |
| 11 | **MOD-1** | Evita repetir el envío masivo con datos mal cargados. Plan escrito y ya revisado. |
| 12 | **UX-1 + UX-3 + ERP-1** | Barato, mecánico, sin tocar lógica, y todo lo que se construya después nace bien. Los tres son la misma pasada por la UI. |
| 13 | **CONC-1 + CONC-2** | La idempotencia general es la defensa más barata contra el doble cargo y **prerrequisito de `ERP-2`**; el barrido de `count(*)` sin lock busca el error clásico donde ya sabemos cómo se ve bien hecho. |
| 14 | **UX-2** | F-01 (un error de fetch se ve como tabla vacía) toca pantallas de dinero. |
| 15 | **MOD-15** | 4 horas. Sin el System User el bot de WhatsApp muere cada 2 h. |
| 16 | **INF-1 (por dominio)** | Versionar el dominio que bloquee la siguiente fase, no los 336 objetos de golpe. |
| 17 | **UX-6** | Las features cosméticas son lo que hace que un padre vuelva al grupo de WhatsApp. Verificar primero qué quedó resuelto con el módulo de notificaciones. |
| 18 | **ADM-1 + ADM-2** | El catálogo de flags y el doble store. `ADM-2` es prerrequisito de la consola: sin resolverlo, la consola hereda el mismo defecto de `SEG-7` — leer de un sitio y escribir en otro. |
| 19 | **Responder D-T, D-MIG, D-PUC, D-CORTE** | Cuatro decisiones sin código de por medio que bloquean las 6–7 semanas de `ERP-2`. Se pueden contestar esta semana. |

### P2 — Cuando P0 y P1 estén cerrados

Arranca con los tres que salieron del barrido del 12-ago y son la cola natural de `DIN-1`:
**DIN-13** (F3, la causa raíz de los 41 dobles facturables — necesita `D-DUP` y `D-DOC` contestadas)
→ **DIN-16** (fusionar las 13 que ya existen, $1.770.000/mes) → **DIN-14** (el mes en el registro
manual) → **DIN-18** (documentos inválidos; su colisión de Spirit bloquea la F3.3 de `DIN-13`) →
**DIN-15** (higiene de invitaciones).

Después, en este orden: **MOD-2** (riesgo nulo, entregable ya) → **MOD-4** (go-live de notificaciones) →
**MOD-11** (desplegar el marketplace que ya está escrito) → **SEG-13** → **ADM-3 + ADM-4 + ADM-5**
(la consola) → **DIN-5** → **ERP-2** → **ERP-3** →
**Ciclo de mes F1** → **ERP-4** → **ERP-5** → **MOD-8** → **MOD-6** → **MOD-9** → **DIN-6** →
**MOD-12** → **MOD-10** → **MOD-13** → **MOD-14** → **MOD-7** → **SEG-3** → **SEG-4** → **SEG-5** →
**SEG-6** → **INF-2..5** → **UX-5** → **DIN-17** (multimes, detrás de sus 4 decisiones de producto).

> **`SEG-13` va antes de `ADM-3`, no después.** La consola le da a una sola pantalla el control de las
> ~40 opciones de cualquier escuela; entregarla mientras `super_admin` entra con solo usuario y
> contraseña es concentrar el radio de daño justo donde no hay segundo factor.

### P3 — Bloques largos

**BLQ-1** (Reservas, con `CONC-4/5` dentro) y **BLQ-2** (Venue/Gym) son los dos que cambian el tamaño
del producto; el resto va después. **BLQ-3** (Mobile) no arranca hasta cerrar sus 7 decisiones y las
compras. Cierre del track contable: **Ciclo de mes F2–F6** → **ERP-6 + UX-4** → **DIN-8**.

---

## 5. Decisiones abiertas que bloquean trabajo

### Resueltas recientemente

| Decisión | Resolución | Fecha |
|---|---|---|
| ¿`DIN-1` y `DIN-2` en un plan consolidado? | **Consolidado.** Plan en [plan-f0-generacion-de-mes-y-cobros-duplicados.md](plan-f0-generacion-de-mes-y-cobros-duplicados.md) | 2026-08-01 |
| **D-PD** — ¿partida doble? | **Libro mayor completo desde el inicio.** Se descartaron la opción sin asientos y la híbrida (§3.1) | 2026-08-01 |

### Abiertas

| Decisión | Bloquea | Nota |
|---|---|---|
| Las 4 de `DIN-1` §8 | P0 completo | `students.ts:829` · las 16 huérfanas · backfill de `period_*` · GYM RM |
| **D-DUP** — ante un casi-duplicado, ¿el guard **bloquea** la creación o **crea y avisa** a la escuela? | `DIN-13` (F3) | Bloquear frustra al acudiente cuando el matcher se equivoca —Gabriela y **Juliana** Simbaqueva comparten fecha de nacimiento y tienen documentos consecutivos: son **gemelas**— y crear-y-avisar deja pasar el duplicado. Define toda la UX de F3 |
| **D-DOC** — ¿el documento es **obligatorio** al crear la ficha, y con qué validación de formato? | `DIN-13` · `DIN-18` | Son la misma decisión: exigirlo sin validar longitud no sirve, hay 73 documentos imposibles de 788 |
| **D-ORACULO** — ¿se acepta que un anónimo pueda saber si un documento existe? | `SEG-14` cierre total | Cerrarlo exige invertir `/join-team`: registrarse primero, buscar después. Es un cambio de UX del onboarding público |
| **D-MULTIMES** — descuento por varios meses · cuántos meses adelante · baja con meses prepagados · ¿el saldo a favor se devuelve o solo se aplica? | `DIN-17` | Cuatro decisiones de producto, ninguna técnica |
| **D-PUC** — ¿qué plan de cuentas? PUC Colombia (Decreto 2650) completo, o un catálogo reducido con las cuentas que una escuela realmente usa | `ERP-2` | El completo son ~2.000 cuentas que nadie de la escuela sabe elegir; el reducido exige decidir cuáles |
| **D-T** — tercero: ¿tabla `parties` unificada, o eje polimórfico `party_type + party_id`? | `ERP-2` | El polimórfico no obliga a migrar `suppliers` ni `payroll_employees`, pero pierde la FK |
| **D-CORTE** — fecha de corte del mayor y cómo se calculan los saldos de apertura | `ERP-2` | Sin esto no se puede postear la primera fila |
| **D-MIG** — los `expenses` ya pagados: ¿se migran como obligación saldada, o el módulo arranca solo con lo nuevo? | `ERP-2` | Arrancar limpio es mucho más barato |
| **D-NOM** — ¿la obligación de nómina nace de un trigger al cerrar la liquidación, o de una RPC explícita? | `ERP-4` | Un trigger es cómodo y difícil de deshacer |
| **D-ROL** — la matriz Auxiliar/Contador/Administrador del spec externo → roles reales | `ERP-2` | Ya hay dos matrices de permisos de coach que son código muerto (`SEG-4`); no crear una tercera |
| **CONC-5** — franjas fijas vs solapamiento libre | `BLQ-1` | Índice único simple vs `EXCLUDE USING gist` |
| **D1-pagos** — ¿`PAYMENT_TOKENS_ENC_KEY` está seteada en Render (stg y prod)? | `DIN-6` F-C paso 1 | Sin la clave, `getEncKey()` lanza y el checkout muere. **No hay versionado de clave:** rotarla hoy invalidaría todos los secretos guardados → vale añadir `key_version` mientras la tabla está casi vacía |
| **D2-pagos** — el dinero de terceros ya recibido (Porras / MMA Blair): ¿se concilia, se devuelve, o se documenta como histórico cerrado? | `DIN-10` | **Decisión de negocio, no técnica** |
| **D3-pagos** — ¿las credenciales `TEST-` de MP en dev rompen algún flujo que hoy se pruebe contra la cuenta real? | `DIN-9` | Si sí, el fail-fast necesita una excepción explícita en vez de bloquear el arranque |
| **D4-pagos** — ¿qué receptor de webhook tiene Dynasty configurado en su dashboard: la Edge Function `wompi-webhook` o la ruta del BFF? | `DIN-6` F-F | **Hay dos receptores.** Verificar antes de tocar nada de webhooks |
| Pricing de M2 en connected accounts; ¿Fase 3 va a agregador? | DIN-6 | |
| Módulos no contratados: ¿se ocultan del menú o se muestran con candado como gancho de upgrade? | UX-3 | |
| Mobile: app unificada vs varias por rol · push provider · versión mínima · actualización forzada · Sentry · localización · build infra | BLQ-3 | 7 decisiones, todas en [MOBILE_ROADMAP_EXECUTION](MOBILE_ROADMAP_EXECUTION.md) |
| Torneos: ¿qué quedó entregado de inscripción vs bracket? | MOD-7 | Verificar contra el código antes de planear |
| Carnets: ¿el editor de plantillas quedó dentro de las 5 fases? | MOD-14 | Verificar |

---

## 6. Documentos y su rol

### Vigentes

| Documento | Rol |
|---|---|
| **este archivo** | Único roadmap. Prioridades y estado. |
| `docs/specs/*.md` | Fuente de verdad de cada módulo. Decisiones de producto resueltas dentro. |
| `docs/plan-*.md` | Plan de migraciones de una fase concreta. Se aprueba antes de escribir SQL. |
| [`architecture/concurrencia-y-reservas.md`](architecture/concurrencia-y-reservas.md) | Doctrina de integridad + diseño de reservas con soft lock. **Aplica a todo el producto**, no solo a reservas. |
| [`specs/pendientes-cxc-cxp-nomina.md`](specs/pendientes-cxc-cxp-nomina.md) | Spec del módulo Pendientes con libro mayor, aterrizado al modelo real. |
| `docs/analysis/SUPABASE_LINTER_REMEDIATION_PLAN.md`, `SECURITY_DEFINER_AUDIT.md` | Auditorías con plan de ejecución. Vivas, pero ⚠️ **son del 2026-05-11 y sus conteos ya no cuadran** — el barrido del 12-ago los re-midió contra la base (§2, track `SEG`). El **método** de ambas sigue siendo bueno; las **cifras y la priorización**, no. Y solo cubren Postgres: ninguna ve el BFF. |
| `docs/AUDITORIA_ARQUITECTURA.md` | Retrato del sistema y su deuda. Vive. |
| `docs/sportmaps-strategic-roadmap.md` | Tesis, mapa competitivo, track D1–D4. **Su §7 queda superseded por este archivo.** |
| `docs/migrations-workflow.md` | Cómo se crea una migración. Obligatorio. |
| [`plan-f3-un-solo-registro-por-atleta.md`](plan-f3-un-solo-registro-por-atleta.md) | Plan de `DIN-13`. Incluye el inventario de lo que **ya está construido** y la validación contra la base del 12-ago. |
| [`plan-fusion-identidades-duplicadas.md`](plan-fusion-identidades-duplicadas.md) | Procedimiento de `DIN-16`. **Estaba huérfano**: escrito y fuera de la cola hasta el 12-ago. |
| [`dynasty-pendientes-2026-08-12.md`](dynasty-pendientes-2026-08-12.md) | Lo que quedó abierto en Dynasty tras la corrección, con cómo regenerar cada lista. |
| `scripts/audit-cobros-duplicados.mjs` · `audit-cobertura-cobros.mjs` · `audit-periodo-vs-fecha-pago.mjs` · `audit-acudientes-desenganchados.mjs` | Los cuatro barridos de cobros. Todos READ-ONLY; sus salidas llevan datos de menores y están en `.gitignore`. |
| `docs/api/openapi.yaml` | 358 rutas del BFF. Importable en Postman. |
| `docs/archived/ROADMAP-v1.3-2026-05-12.md` | Anexos A–F: DDL, RLS, endpoints, RPCs y tests de los bloques sin construir. |

### Candidatos a archivar — hablan de una arquitectura que ya no existe

No los borro: son decisión del dueño del repo.

| Documento | Por qué |
|---|---|
| `docs/analysis/MVP_GAP_ANALYSIS_MULTITENANT.md` | Su GAP 3 es «backend Python/MongoDB» y su GAP 14 es «Flutter embrionario». El stack es Express + Supabase y el mobile es Capacitor. |
| `docs/analysis/MVP_ANALYSIS_MULTITENANT.md` | Misma época y mismo supuesto. |
| `docs/analysis/MIGRATION_BLUEPRINT_FLUTTER_NEXT.md` | Migración a Flutter/Next que no se va a hacer. |
| `docs/architecture/FLUTTER_SAAS_MIGRATION.md` | Igual. |

---

## 7. Arranque inmediato

0. **`SEG-8` + `SEG-9`** — media hora y una sesión. Un `REVOKE` y borrar cuatro handlers de debug.
   Son los dos únicos huecos explotables hoy y no dependen de ninguna decisión abierta. `SEG-10`
   (1–2 d) va detrás, en la misma pasada de seguridad.
0.b **`DIN-9`** — una sesión. Credenciales `TEST-` en dev + guard de arranque. Es lo único con un
   footgun vivo y no depende de ninguna decisión salvo D3-pagos.
1. **Aprobar el plan de `DIN-1`** — es el único bloqueante de producción (§1). Nada de SQL antes.
   Su paso 1 es el preflight que verifica contra la base las tres migraciones del 24-jul.
2. **Aprobar `DIN-4` F0 + F0.5** — F0.5 arregla hoy el síntoma de «prendo el módulo y no se activa»,
   y F3 no se puede construir encima de un status que se puede leer falso.
3. En paralelo, sin dependencias ni decisiones: **`DIN-3`** (4 h) y **`MOD-15`** (4 h).
4. Después: **`SEG-1`** Fase −0.5 y **`SEG-7`**, que destraban migraciones y cierran la lectura falsa.
5. **Contestar D-PUC, D-T, D-CORTE y D-MIG** — cuatro decisiones sin código de por medio que bloquean
   las 6–7 semanas de `ERP-2`. Se pueden responder esta semana.
