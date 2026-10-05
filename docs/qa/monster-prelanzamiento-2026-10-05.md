# Monster´s Volley Club — auditoría pre-lanzamiento de cobros y tienda

- **Escuela:** `eb3ebc77-4ea4-4992-96c8-3c8ec574578c` · **Owner:** `1247192f-eefa-471e-a939-d52f13962a90`
- **Fecha:** 2026-10-05 · **Método:** base viva (solo `SELECT`; toda simulación de usuario dentro de un `DO … RAISE EXCEPTION`, que revierte todo) + lectura de `bff/src` y `frontend/src`.
- **Nada se corrigió, nada se escribió en la base y no hay commits.**

---

## 0. Veredicto

**NO puede empezar a cobrar mañana tal como está.** Puede hacerlo **con condiciones**: 4 bloqueantes de configuración y decisión, y 2 de código.

Hoy el sistema **no cobra nada**, y lo hace sin avisar: las 125 inscripciones activas resuelven un monto de $0, así que el cron diario las salta. Ese es justamente el detalle peligroso. **Apenas la escuela le ponga precio a cualquier cosa** (cuota, plan o precio de equipo), a la noche siguiente pasa esto:

1. **01:30:** el cron emite los 125 cobros de octubre con vencimiento **1-oct**, que ya pasó.
2. **02:00:** el motor de mora los marca `overdue` y les suma el 5 %, si ya pasaron los 5 días de gracia (desde el 7-oct). Son **$906.250 en recargos** sobre **$18.125.000** que **ninguna familia puede pagar desde la app**: 125 de 125 cobros nacen sin pagador, no hay ninguna cuenta para transferir y no hay WhatsApp de la escuela.
3. Cuando la escuela invite a los acudientes por la vía masiva, **cada acudiente cuyo correo no coincida con el del atleta genera una segunda identidad y un segundo cobro.** Son 62 de 87 menores.

Para cobrar sin estos problemas, cerrar en orden los puntos del §3 (checklist). La tienda **no está lista** (§2, H-14): está apagada globalmente, no hay vendor_profile, no hay cuentas, no hay compradores con cuenta y el piloto no tiene allowlist.

---

## 1. Cifras reales (base viva, 2026-10-05)

| Dato | Valor |
|---|---|
| Atletas en `unregistered_athletes` | 125 (125 activos, 0 vinculados, 125 con documento, 125 documentos distintos) |
| Menores / adultos (por fecha de nacimiento) | 87 / 38 |
| Acudiente cargado (nombre/tel/correo) | 125/125/125, pero **3 correos inválidos** ("no aplica", "No", "No aplica") y **5 teléfonos no normalizables** ("3", "311 8525755 y 3114766424", "+57 315 461 0261"…) |
| Menores cuyo **correo de atleta ≠ correo del acudiente** | **62 / 87** |
| Menores cuyo **teléfono de atleta ≠ teléfono del acudiente** | **76 / 87** |
| Acudientes o atletas con cuenta en `auth.users` | **0** |
| Inscripciones activas | 125, todas `unregistered_athlete_id` + `team_id`, **0 con plan, 0 con `monthly_fee`**, `expires_at` NULL |
| Equipos | 14. **13 con `price_monthly = 0`**. El único con precio ("Mayores Femenino", $145.000) tiene 0 atletas; existe un homónimo "MAYORES FEMENINO" con $0 y 6 atletas |
| Planes (`offering_plans`) | Tarifa plena $145.000 (max_sessions 12), Doble categoría $165.000, Mayores mixto $135.000 (max 12), Mayores mixto doble $155.000. **Ninguno asignado** |
| `payments` | 5, **todos `cancelled`**, todos de una ficha de prueba (Alejandra Losada) |
| `school_athletes.payment_status` | **125 "pending"** sin un solo cobro emitido (fallback de la vista) |
| `school_settings` | `auto_generate_payments=true`, `payment_cutoff_day=1`, `payment_grace_days=5`, `late_fee_enabled=true` (5 %), `reminder_enabled=true`, `charge_notifications_enabled=false`, `require_payment_proof=true`, **`payment_accounts=[]` y todas las columnas bank/nequi/breb/daviplata NULL**, `whatsapp_number` NULL, `payment_qr_url` NULL |
| `schools` | `payment_mode='unset'`, `payment_settings={allow_manual:true, allow_online:false}` |
| Suscripción | `status=active`, `blocking_exempt=true` ("En uso real"), `trial_ends_at` 2026-09-06 (venció, el cron la expiró el 09-07 y el super admin la reactivó el 10-02). `school_is_operational()=true` |
| Addons | invoicing, whatsapp, accounting, store = ON (10-02); tournaments OFF |
| Facturación electrónica | **0 filas** en `electronic_invoice_providers` para Monster |
| WhatsApp | 0 integraciones, 0 opt-ins, 0 plantillas |
| Tienda | `platform_config.store_enabled = {"enabled": false}` **sin clave `allowlist`**; 0 vendor_profiles; 0 productos |
| Miembros | owner + 1 coach activos; 0 padres |

---

## 2. Hallazgos por severidad

### CRÍTICOS (cobran mal o no se pueden cobrar)

#### H-01 · Al poner precio, el mes nace vencido y con recargo esa misma noche
- **Evidencia:**
  - `open_month` (live) calcula `v_due = make_date(año, mes, LEAST(payment_cutoff_day, …))`, con corte = 1 → vence el **día 1**.
  - `generate_monthly_charges()` corre **todos los días** a las 06:30 UTC (01:30 COT) para las escuelas con `auto_generate_payments`. Siempre abre el mes **en curso**.
  - `apply_late_fees()` corre a las 07:00 UTC (02:00 COT) y aplica el recargo cuando `due_date + payment_grace_days < hoy`.
  - **Ya pasó en esta escuela:** el cobro `6a78fc04…` se creó el 2026-07-14 a las 01:30:00 con vencimiento 07-01, y recibió el recargo de $7.250 a las 02:00:00 de **ese mismo día**. Lo mismo se repitió el 25-ago (`b242a3dd…`) y el 7-sep (`9b69a4d0…`).
- **Simulación (rollback):** se puso cuota de $145.000 a las 125 inscripciones y se corrió `open_month(oct)`. Resultado: **125 cobros, $18.125.000, todos con vencimiento 2026-10-01**. Si eso pasa desde el 7-oct, el mismo cron de las 02:00 marca los **125 como `overdue` y suma $906.250**.
- **Escenario:** la dueña configura cuotas el 8-oct. Al día siguiente, las 125 familias tienen una deuda vencida con recargo antes de haber recibido ningún aviso, y sin forma de pagar.
- **Arreglo:** decidir el corte (p. ej. día 10) **antes** de poner precios, o apagar `late_fee_enabled` durante el primer mes. Para octubre, generar el mes a mano con un vencimiento futuro, porque `open_month` no acepta vencimiento propio (ver checklist).

#### H-02 · Monto $0 para las 125 inscripciones: el cron las salta y nadie se entera
- **Evidencia:** la cascada de `open_month` es `monthly_fee → plan.price → team.price_monthly → children.monthly_fee → 0`, y filtra `fee.amount > 0`. En Monster todo es NULL o 0. `preview_open_month(oct)` como owner devuelve `count: 0`. El cron corrió el 1-sep y el 1-oct sin generar nada para ellas, porque las inscripciones son del 26-ago.
- **Agravante:** la vista pinta a los 125 como **"pending"**, así que el panel parece una cartera pendiente cuando en realidad no hay ningún cobro.
- **Escenario:** la escuela cree que ya está cobrando ("125 pendientes"), y ninguna familia tiene nada por pagar.

#### H-03 · La invitación masiva duplica la identidad del menor, y con ella el cobro, en 62 de 87 familias
- **Evidencia (código):**
  - `SchoolStudentsManagementPage.tsx:867-873`: `bulkInviteMutation` llama `create_invitation(p_email = parent_email, p_role 'parent', p_child_name …)` **sin `p_unregistered_athlete_id`**.
  - `accept_invitation_pro` (live) busca la ficha por `invitation_id` (vacío en este caso) o por `unregistered_athletes.email = correo del acudiente`. Pero en la ficha `email` es el **correo del atleta**, y en 62 de 87 menores no coincide.
  - El trigger `bloquear_atleta_duplicado` exime explícitamente el contexto `accept_invitation_pro`.
- **Simulación (rollback):** se tomó a Laura Sofía Pedraza, con el acudiente `Security.javier@gmail.com` distinto del correo de ella. Invitación masiva → alta del acudiente → `accept_invitation_pro` → `open_month(oct)` con precio de equipo. Resultado:
  - Invitación `accepted`.
  - La ficha queda `active` y **sin vincular**.
  - Nace **1 `children` nuevo** con una inscripción nueva del mismo equipo.
  - `open_month` generó **12 cobros para un equipo de 11**. Laura queda con **dos cobros de $145.000**: uno sin pagador (la ficha) y otro con `parent_id` (el hijo nuevo).
- **Escenario:** la escuela invita a los 125 en bloque, y 62 familias reciben el doble cobro todos los meses. El padre solo ve uno; el otro queda en la cartera de la escuela como mora eterna, con recargo.
- **Riesgo adicional, sin verificar en la UI:** existen dos sobrecargas de `create_invitation` (8 y 9 args), ambas ejecutables por `authenticated`. Una llamada con 7 argumentos nombrados, como la del bulk, es **ambigua en Postgres (42725, verificado)**. Si PostgREST tampoco la desambigua (PGRST203), la invitación masiva falla entera. Probar en la UI antes de usarla.

#### H-04 · La invitación individual convierte al acudiente en "atleta" y fusiona a los hermanos en un solo cobro
- **Evidencia:**
  - `buildInviteParams` (`SchoolStudentsManagementPage.tsx:980-993`) manda `role=athlete` + `unregisteredId` para **toda** ficha no registrada, aunque sea de un niño de 9 años. La UI lo rotula "Atleta 18+".
  - `accept_invitation_pro`, rama atleta, llama `migrate_unregistered_athlete_to_profile(ua, auth.uid(), NULL)`.
- **Simulación (rollback):** dos invitaciones individuales a `zrplata@gmail.com`, una por Isabella (16) y otra por Salomé (9).
  - Las dos se aceptan sin error.
  - El **perfil de la mamá queda `role = athlete`**.
  - Las dos fichas quedan vinculadas a ese perfil, y las dos inscripciones pasan a `user_id = mamá`.
  - `open_month` hace `DISTINCT ON (user_id)` → **genera 1 solo cobro por dos niñas**, con el concepto "Mensualidad 10/2026 - Isa Florian" (el nombre de la mamá).
- **Escenario:** se pierde una mensualidad por cada hermano. Los cobros, la asistencia y la factura quedan a nombre del acudiente y no del deportista, y el acudiente pierde la vista de padre.
- **Agravante menor:** `buildInviteParams` manda `team=` pero `InvitationsManagementPage.tsx:140-152` lee `program`, así que el equipo nunca llega precargado.
- **Lo que SÍ funciona (simulado):** invitación con rol **parent** + `p_unregistered_athlete_id`. La ficha se adopta, no se crea un segundo hijo, el cobro previo se mueve al hijo con `parent_id`, el padre lo ve y **sube el comprobante → `awaiting_approval` sin que lo bloquee `trg_zz_guard_payments_client`**. Hoy ninguna pantalla arma esa combinación por defecto: hay que cambiar el rol a mano en el diálogo individual.

#### H-05 · Los 125 cobros nacen sin pagador y no hay a dónde transferir
- **Evidencia:**
  - `open_month` toma `parent_id` de `children`. Para una ficha no registrada queda NULL, igual que `user_id` (simulación: `sin_pagador: 125/125`).
  - `enrollmentBilling.createPendingPayment` solo resuelve el pagador para `child_id`.
  - `school_settings.payment_accounts=[]` y no hay banco, Nequi, Bre-B, QR ni WhatsApp.
- **Consecuencias:**
  - Ninguna familia ve el cobro en la app, porque no tiene cuenta.
  - El enlace público `/p/:token` (`cobro-enlace-publico.service.ts:404-405`) mostraría `cuentas: []` y `whatsappComprobante: null`. Es una página sin forma de pagar ni de mandar el soporte, y además no permite subir comprobante.
  - Si un padre con cuenta abre el modal de pago, no tiene destino de transferencia.
  - Sin cuentas registradas, el verificador de comprobantes **se salta el cruce de destino** (`receipt-context.service.ts:89-95`). Un comprobante a cualquier cuenta no sale rojo por `DESTINO_NO_COINCIDE`.
- **Lo que sí funciona (simulado):** el **owner** aprueba un cobro sin pagador por la misma vía de `ApprovePaymentMethodSheet` (`status → paid`, `amount_paid`, `approved_*`) y el guard lo deja pasar. El **coach no puede** (0 filas por RLS), aunque ve los cobros. Mientras no haya cuentas de padres, cobrar significa que **la escuela registra a mano** cada pago que le llega por fuera.

### ALTOS

#### H-06 · Los avisos de cobro y la cobranza manual van al teléfono y correo del NIÑO
- **Evidencia:** el contacto de una ficha no registrada sale de `unregistered_athletes.email/phone`, que son los datos **del atleta**, y no de `guardian_email/guardian_phone`. Pasa en:
  - `payment-lifecycle-emails.job.ts:211` (correo y WhatsApp de "cobro generado" y "vencido")
  - `estado-de-cuenta.service.ts:395` (estado de cuenta mensual)
  - `frontend/src/lib/api/payment-reminders.ts:183` (recordatorios)
  - `FinancesPage.tsx:68` (WhatsApp manual de Cuentas por cobrar)
- **Cifras:** 62 de 87 menores tienen el correo del atleta distinto, y 76 de 87 el teléfono.
- **Escenario:** el día que se prenda `charge_notifications_enabled`, o que la escuela use "Enviar WhatsApp" desde Finanzas, el cobro de $145.000 le llega a un menor de 12 años. Además, el correo enlaza a `/my-payments`, que exige una cuenta que la familia no tiene.
- **Hoy no sale nada:** `charge_notifications_enabled=false`, no hay integración de WhatsApp, y el estado de cuenta mensual es código sin commitear y su columna no está aplicada.

#### H-07 · Doble categoría: no está modelada en los datos
- Los 125 documentos son distintos, así que **ninguna de las 12 parejas reales tiene segunda inscripción ni el plan "Doble categoría"**. La decisión registrada es "un cobro combinado de $165.000" (`sport-categories-and-multi-category.md` §5.3), y la memoria pide **re-confirmarla con la escuela**.
- Si la escuela agrega la segunda categoría como **segundo equipo** (`POST /enrollments` solo con `team_id`), hoy `open_month` ya deduplica (`DISTINCT ON` + `ON CONFLICT`) y cobra **una sola vez el precio de la fila con plan, o si no la del primer equipo**. Es decir, cobra $145.000 en vez de $165.000, salvo que la cuota se fije a mano.
- **Recomendación:** una sola inscripción con `monthly_fee = 165000` y `fee_is_manual`. El segundo equipo va solo como roster.

#### H-08 · Asignar un PLAN desde el editor no emite el cobro y pone a correr un vencimiento que cancela la inscripción
- **Evidencia:** en `students.ts:1165-1215`, para una inscripción solo de equipo, `readActiveEnrollments('plan')` reusa esa misma fila como `survivor` (línea 940). Entonces `oldPlanId = null` → entra a la rama "mismo plan" → **solo actualiza montos pendientes, que no hay**, y no emite cobro. Además escribe `expires_at = plan_start_date + 30`.
- `fn_expire_overdue_enrollments` (cron 08:00 UTC) cancela cuando `expires_at + grace(5) + 7 < hoy`. El trigger `fn_cancel_payments_on_enrollment_cancel` solo anula cobros por `user_id`/`child_id`, **no por `unregistered_athlete_id`**: los cobros de la ficha quedan vivos.
- **Escenario:** se asignan planes el 6-oct. Si la familia no paga, el 18-nov el deportista desaparece del roster y de la asistencia, pero su deuda sigue viva en cartera.
- **Recomendación:** para el piloto, poner precio con **`monthly_fee` por atleta**, o precio de equipo, no con planes. Eso deja `expires_at` en NULL y no hay cancelación automática.
- **Riesgo menor:** "Tarifa plena" tiene `max_sessions=12` con 3 clases por semana (13-14 en un mes). La asistencia muestra la advertencia `no_credits`, aunque no bloquea (`attendance.ts:618`).

#### H-09 · Cuando el padre se registra por su cuenta (sin invitación)
- Si da de alta al hijo **con escuela**, `bloquear_atleta_duplicado` lo frena: busca coincidencia por documento, o por fecha de nacimiento + nombre, contra las fichas activas. El mensaje lo manda a la invitación o al QR, y eso está bien.
- Monster **no tiene QR de inscripción** (`school_join_qr_codes` = 0).
- **Los 38 adultos** que se registren solos como atleta crean un perfil y una inscripción propios, que no adoptan la ficha: es el bug conocido de `project_duplicate_athlete_identities` y deja dos cobros. El guard no cubre `profiles`.

### MEDIOS

#### H-10 · Recordatorios previos al vencimiento: con corte el día 1 no sirven, y sin cuenta no llegan
`send_payment_reminders()` exige `parent_id IS NOT NULL` y `due_date >= hoy`. Con corte el 1 y el cron abriendo el mes ese mismo día, el recordatorio "3 días antes" no existe. Para los no registrados, nunca sale.

#### H-11 · Facturación electrónica: el addon está prendido, pero no hay facturador
Hay 0 filas en `electronic_invoice_providers` y 0 facturas, así que **aprobar un pago no intenta emitir nada**: no hay error ni factura a terceros. Cuando se configure:
- Los cobros de fichas no registradas se saltan con `payment_without_payer` (`invoicing.service.ts:386-387`).
- Los de la vía de H-04 se facturarían **a nombre del acudiente como si fuera el atleta**.
- No hay documento fiscal del acudiente cargado: las fichas tienen el documento **del niño**, y el adquiriente sale del perfil del pagador, que no existe.
- La escuela debe saber que **hoy no se emite ninguna factura DIAN** aunque vea el módulo encendido.

#### H-12 · Exposición de datos residual: `buscar_menor_por_documento_publico`
- **A mitad de esta auditoría se aplicó** la migración `cerrar_rpc_sin_gate_linter_2026_10_05`, registrada como versión **20261005132337**, mientras el archivo y el ledger del repo dicen **20261005131057**. Hay que reconciliar ese desfase. Tras aplicarla, verificado en vivo:
  - `process_enrollment_checkout` (las 2 firmas): sin `EXECUTE` para `authenticated`. Antes del cierre igual fallaba por la columna `program_id` inexistente.
  - `get_school_athletes(uuid)` (1 arg): solo `service_role`.
  - `get_athletes_without_payment`: con gate ("No tienes permisos…").
  - `_equipment_notify_admins`: cerrado.
- **Lo que queda:** `buscar_menor_por_documento_publico` ya filtra por escuela (anon + school_id de otra escuela → 0 filas), pero **anon + el school_id de Monster + el documento de un niño devuelve el nombre, correo y teléfono del acudiente** (verificado: 1 fila con los tres). El school_id es público, porque va en URLs de inscripción, y las TI son enumerables. Expone a las 125 fichas.

#### H-13 · El estado de prueba ya no amenaza la operación
`status=active` + `blocking_exempt=true` → `school_is_operational()=true`. `expire_trials()` solo toca `trialing`, así que **no se le puede bloquear en medio del piloto** por cron. El único riesgo es manual: alguien en la consola que use `admin_expire_trial_now`, o que quite la exención. La suscripción dice `tier free` / `starter` con `saas_billing_enabled=false`: hoy SportMaps no le cobra a Monster.

#### H-14 · Tienda: un padre hoy no puede comprar, y el piloto no está acotado
Faltan, en orden:
1. `platform_config.store_enabled.enabled=false`. Además **no tiene `allowlist`**. `store_pilot_allowlist()` devuelve NULL = **sin restricción**, así que prender el flag habilita a **todos** los vendedores que cumplan el resto, no solo a Monster. Hay que fijar la allowlist con el vendor_profile de Monster **antes** de prender el flag.
2. Monster no tiene `vendor_profile`: falta correr `enable_school_store(school_id)` como owner. Requiere el addon store, que ya está ON.
3. Sin `store_payment_settings`. Sin cuentas en `school_settings.payment_accounts`, la transferencia revienta con `NO_TRANSFER_ACCOUNTS` (`_store_checkout_gateway`, mig 20261003230013:251). Sin Wompi ni MP propios, la pasarela da `GATEWAY_NOT_CONFIGURED`. Solo quedaría `cash_pickup`.
4. 0 productos.
5. 0 compradores con cuenta. El checkout de invitado está fuera de alcance (contrato §"fuera").
6. `bffprod` responde 503 a la tienda (`index.ts:384`).

### BAJOS
- **H-15:** equipos homónimos "Mayores Femenino" ($145.000, 0 atletas) y "MAYORES FEMENINO" ($0, 6 atletas). Es fácil ponerle precio al equivocado.
- **H-16:** datos sucios del acudiente: 3 correos de texto ("no aplica", "No", "No aplica") y 5 teléfonos con dos números o un solo dígito. Afectan a invitaciones y WhatsApp.
- **H-17:** `max_students=20` en los 4 planes, solo informativo en el servidor (no se aplica). Si alguna pantalla lo usa como cupo, se llena con 20 de 125.
- **H-18:** el pago en línea está bloqueado fail-closed (`payment_mode='unset'` → `payment-provider.resolver.ts:350-356`). Es correcto con `allow_online=false`, pero conviene confirmar que la UI del padre no ofrezca "Pagar en línea" para no generar errores.

---

## 3. Checklist "antes de cobrar" (en orden)

### A. Decidir (escuela y producto). Va primero porque cambia lo que se configura
1. **Fecha de corte:** ¿día 1 o día 5/10? Recomendado ≥ 5, para que el aviso llegue antes del vencimiento.
2. **Mora del primer mes:** apagar `late_fee_enabled` hasta noviembre, o aceptar que octubre nazca vencido (H-01).
3. **Mes de arranque:** ¿se cobra octubre completo, que ya va por el día 5, o se arranca en noviembre? Agosto y septiembre no se cobraron nunca.
4. **Doble categoría:** re-confirmar "un solo cobro de $165.000" y listar las 12 personas (H-07).
5. **Cómo pagan las familias sin cuenta** mientras se invitan: transferencia + WhatsApp de la escuela + registro manual del pago por el owner.

### B. Configurar en la app (sin código)
6. Cargar **cuentas de transferencia** (`payment_accounts`), `whatsapp_number` y, si hay, el QR Bre-B.
7. Ajustar `payment_cutoff_day` / `payment_grace_days` (y `late_fee_enabled`) según A1-A2, **antes del paso 8**.
8. Poner precio con **`monthly_fee` por atleta** ($145.000 / $165.000 doble / $135.000 mayores), **no con planes** (H-08). Si se hace por equipo, evitar el homónimo (H-15). Correr **`preview_open_month` antes** y revisar el conteo (125) y los montos.
9. **Mantener apagados** `charge_notifications_enabled` y el estado de cuenta mensual hasta corregir H-06.
10. Limpiar los 3 correos y 5 teléfonos de acudiente (H-16).
11. Avisarle a la escuela que **no hay factura electrónica** configurada (H-11).

### C. Arreglar en código (antes de invitar a las familias)
12. **H-03 / H-04 (bloqueante para invitar):**
    - Que la invitación de una ficha **menor** use `role='parent'` + `p_unregistered_athlete_id`, tanto en la masiva (`SchoolStudentsManagementPage.tsx:867`) como en la individual (`:980-993`, y corregir `team`→`program`). La de un **adulto** sigue en `role='athlete'` + id.
    - En la masiva, pasar siempre `p_unregistered_athlete_id`.
    - Resolver la ambigüedad de `create_invitation` (8 vs 9 args).
    - Hasta que esto esté, **no invitar en bloque**.
13. **H-06:** en los 4 lectores, el contacto de una ficha **menor** debe salir de `guardian_email` / `guardian_phone` / `guardian_full_name`.
14. **H-01 (opcional, deseable):** que `open_month` no emita un vencimiento pasado, con el mismo piso `GREATEST(corte, hoy + grace)` que ya usan `billingDue` y el QR. Así cualquier alta tardía de precio no nace en mora.
15. **H-08:** la rama "asignar plan a una inscripción de solo equipo" debe emitir el cobro, y `fn_cancel_payments_on_enrollment_cancel` debe cubrir `unregistered_athlete_id`.
16. **H-12:** `buscar_menor_por_documento_publico` no debería devolver el contacto del acudiente a anon. Reconciliar además la versión aplicada (20261005132337) con el archivo y el ledger (20261005131057).

### D. Tienda (después de que los cobros estén estables)
17. Fijar la `allowlist` = [vendor_profile de Monster] **antes** de prender `store_enabled`.
18. `enable_school_store` como owner → `set_store_payment_settings` (transferencia + efectivo) → cargar productos.
19. Que haya padres con cuenta (depende del paso 12) y que `bffprod` deje de responder 503.

---

## 4. Simulaciones ejecutadas (todas revertidas con `RAISE EXCEPTION`)

| # | Qué | Resultado |
|---|---|---|
| S1 | Invitación masiva (rol parent, sin id de ficha) a un acudiente con correo ≠ atleta → alta → aceptar → precio de equipo → `open_month(oct)` | Ficha sin vincular + hijo nuevo, 12 cobros para 11 atletas, **2 cobros de $145.000 para Laura** |
| S2 | Invitación individual (rol athlete + id de ficha) ×2 hermanas → aceptar | Mamá `role=athlete`, las 2 fichas a su perfil, **1 solo cobro** "Mensualidad 10/2026 - Isa Florian" |
| S3 | Invitación parent + id de ficha → aceptar → padre sube comprobante | Adopta (1 hijo, 1 inscripción), el cobro pasa a `child_id`+`parent_id`, **upload OK** (`awaiting_approval`) |
| S4 | Owner aprueba cobro sin pagador / coach intenta aprobar | Owner OK (`paid`); coach 0 filas; 0 facturas generadas |
| S5 | `monthly_fee=145000` a las 125 → `open_month(oct)` | 125 cobros, $18.125.000, vencen 2026-10-01, 125/125 sin pagador; recargo proyectado al 7-oct $906.250 |
| S6 | `preview_open_month(oct)` como owner (estado actual) | `count: 0` |
| S7 | RPC del linter como padre de otra escuela / anon | Antes del cierre: `get_school_athletes(1 arg)` ambiguo, `process_enrollment_checkout` roto por `program_id`. Después del cierre: cerrados. `buscar_menor` sigue dando el contacto con el school_id propio |
