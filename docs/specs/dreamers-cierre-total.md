# Dreamers — cierre total: reglas, reservar, pagar, comprar y pruebas

**Estado:** plan para aprobar (2026-10-13). Une lo pendiente de
[reglas completas](dreamers-reglas-completas-plan.md), [ciclo 1–5 y bloqueo](dreamers-ciclo-cobro-1-al-5-y-bloqueo.md),
[niveles](dreamers-niveles-por-horas-y-progresion.md) y [banco de horas](dreamers-banco-de-horas-torniquete.md),
más lo encontrado el 13-oct al auditar reservar / pagar / comprar.
**Escuela:** Dreamers Gymnastics `57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe`.
**Dónde se prueba:** gemelo Docker local con la copia de Dreamers (`node scripts/qa-twin/clonar-dreamers.mjs`,
app `http://localhost:3101`, BFF `:3102`, cuentas `qa-dl-*@demo.sportmaps.co` / `Demo2026!`). Nunca en producción.

Todo el código de F-A…F-F, la fase C y el primer cobro sin recargo **ya está en `origin/main`**: lo que falta son
arreglos puntuales, datos, flags y decisiones.

---

## 0. Urgente (antes del 1-nov)

| # | Hallazgo | Evidencia | Acción |
|---|---|---|---|
| U1 | **Noviembre no se va a facturar.** El 13-oct 18:50 la cuenta owner de Dreamers guardó `auto_generate_payments = false` | `audit_logs` school_settings, profile `6c0b38bb…`; `generate_monthly_charges` filtra `auto_generate_payments IS TRUE` | Confirmar con Dreamers y volver a `true` (o abrir el mes a mano) |
| U2 | **El ciclo 1–5 se revirtió:** misma edición puso `payment_cutoff_day 5→1`, `payment_grace_days 0→5` (además cuotas off, hermanos 5 %, recordatorios on) | mismo registro | Confirmar si fue intencional; si no, volver a corte 5 / gracia 0 |
| U3 | **Posibles niñas bloqueadas físicamente:** el 06-oct salieron 95 `disable_user` (PIN 401, 12, 4) y ningún `enable_user` después; el flag se apagó sin autor ese día 17:29 | `device_commands`, `audit_logs` | Revisar en el MB360 el estado de esos PIN; habilitar a mano si corresponde |
| U4 | **Cobro sugerido de $419.188 a Edna (dueña)** por horas de agosto, a un clic de confirmarse | `hour_bank_overage_charges` `suggested`, inscripción `2992a5ee` cancelada | Descartarlo; el generador debe excluir inscripciones canceladas y dueños |

---

## 1. Ya arreglado en código (13-oct, sin desplegar)

| # | Bug | Arreglo | Prueba |
|---|---|---|---|
| A1 | **Reservar daba 500** a los acudientes de Dreamers: `attendance_sessions` sin `start_time` (la toma de asistencia por equipo no guarda hora) → `null.substring` | `bff/src/routes/session-bookings.ts`: se ignoran sesiones sin hora (líneas ~702 y ~1039) | Gemelo: `GET /session-bookings/athlete/available` 500 → 200 para las 3 hijas; Bella ve 16:00–20:00. En prod Dreamers es la única escuela afectada |
| A2 | **Comprar un artículo fallaba** con «Ya existe un pago pendiente de aprobación» (falso): el modal trataba artículos/torneos como inscripción y chocaba con cualquier cobro viejo sin periodo (pagado) del niño; si estaba impago, el comprobante del artículo se le pegaba a ese cobro | `PaymentCheckoutModal.tsx`: artículos y torneos siempre crean su propia fila; mensaje distinto si el cobro está pagado | Pendiente E2E C1–C4 (§4) |
| A3 | **La excepción manual de un día del bloqueo nunca funcionó:** el job filtraba `device_commands.created_at`, columna que no existe (es `issued_at`) → quien se habilitaba a mano se re-bloqueaba a los 15 min | `bff/src/jobs/access-auto-block.job.ts:121` → `issued_at` | `vitest access-auto-block.job.test.ts` 6/6 |

Faltan también los demás `start_time.substring` de `session-bookings.ts` (~1051, ~1053, ~1449) y mostrar el error
de `useAvailableSessions` en `MyEnrollmentsPage` en vez de «Sin clases disponibles».

---

## 2. Fases

### F1 — Bugs de cobro y cartera (BFF + frontend + 2 migraciones)
- **Cartera/antigüedad** (`get_payment_aging_report`): hoy cuenta cada cobro vivo como un «mes» (inscripción + seguro + mensualidad del mismo mes = «3+ meses») e incluye cobros no vencidos. Arreglo: solo `due_date < hoy`, meses = periodos distintos, bloque nuevo `por_vencer`.
- **«Nuevo pago» de mensualidad no da vigencia:** `_payments_cobro_cliente_normalizar` no estampa `offering_plan_id` si viene NULL → al aprobar no corre `fn_extend_enrollment_on_payment_paid`. Arreglo: rama mensualidad asigna siempre el plan.
- **Cobros sin acudiente vinculado impagables por la app** (Sofía, Avril, Zoe): `/p/:token` solo acepta comprobante por WhatsApp y Dreamers no tiene WhatsApp → subida de comprobante por token en el BFF cuando no hay WhatsApp activo; y empujar la vinculación del acudiente.
- **`reserve_hour_bank` descuenta del periodo de HOY**, no del de la fecha reservada → variante de `get_or_open_hour_bank_period(enrollment, fecha)`.
- **`fn_sync_access_group_on_payment`** busca PIN solo por `user_id`/`unreg` (nunca menores) y manda `set_group`, que con mecanismo `disable` no sirve → que respete `access_block_mechanism` y `child_id`, o quitarlo.
- **Generador de horas de más** excluye inscripciones canceladas y dueños.

### F2 — Descuento por hermanos escalonado (diseño completo aparte)
`school_settings.sibling_discount_tiers numeric[]` (Dreamers `{5,10}`: 2.º hijo 5 %, 3.º en adelante 10 %), NULL = % único de hoy
(Soacha y la Demo no cambian). Funciones `_sibling_rank` / `_sibling_tier_pct` / `sibling_discount_quote`; CREATE OR REPLACE de
`open_month`, `preview_open_month`, `_plan_charge_operation`, `_descuentos_automaticos_calc`, `create_enrollment_with_payments`
(cuerpos vivos verificados por md5 sin CR = repo). Descuento también en el alta, cambio de plan y edición; corrige que
`repricePendingCharges` perdiera el descuento y que el «parcial» del cambio de plan cobrara de más. Hermanos sin cuenta de
acudiente: tabla `school_sibling_links` que confirma el admin (nunca se escribe `parent_id`). Pantalla con escalones.
Orden de descuentos fijo (D16): militar → hermanos → «solo este mes» → pronto pago; la mora se calcula sobre el neto.
**Efecto en noviembre (orden por antigüedad):** Mariapaz $884.000 · Athenea $464.550 · Bella $1.027.800.

### F3 — QR de inscripción del padre
`submit_qr_signup` (2 variantes) no cobra inscripción ni seguro y la mensualidad nace sin `payment_category`. Arreglo:
`emit_enrollment_fees` solo con inscripción nueva; `ParentCheckoutPage` muestra los cobros extra. Dreamers hoy tiene 0 QR.

### F4 — Bloqueo por mora: re-prender con prueba de aceptación
Con A3 desplegado y U3 revisado: prueba §3 del spec de ciclo con Athenea (PIN 4) — vence → bloquea → habilitación manual
dura el día → paga → se habilita ≤15 min → nadie más cambia. Luego `access_auto_block_overdue_enabled = true`.

### F5 — Datos de Dreamers (sin código; script con `--dry-run`)
Horas y bloque de los 7 planes sin horas (PGP8x1 urgente: Avril y Zoe sin banco), PGR6x2 bloque 120, PGP4x1 inscripción/seguro,
horario de la coach de «USAG Nivel 1» (Athenea y Mariapaz no ven horarios para reservar), equipo de agendamiento para las 3
altas nuevas, PIN de torniquete para Sofía/Avril/Zoe, mapeo huérfano PIN 2, Fabio PIN 1, Emma (deuda viva con inscripción
cancelada), clase de prueba (0 categorías, 0 `facility_availability`).

### F6 — Lo que queda inerte esperando decisiones
Niveles/ascenso y días permitidos (F-F apagado, sin datos USAG), alta por clases restantes (F-C apagado; contradicción R5 vs §7.6),
pronto pago (NIV-7), aviso antes de perder horas a fin de mes (D-13, sin construir), `registration_zk_pin_enabled` (prendido hoy
por service role y **ningún código lo lee** — buscar la sesión que lo dejó a medias).

---

## 3. Decisiones de Dreamers

1. ¿El cambio del 13-oct 18:50 (corte 1, gracia 5, sin generación automática, sin cuotas) fue intencional?
2. ¿Quién apagó el bloqueo el 06-oct y cuándo se re-prende?
3. Hermanos: ¿Athenea, Bella y Mariapaz son hermanas (apellidos distintos)? ¿Orden por antigüedad o «paga completo el plan más caro»? ¿Se acumula con el descuento del alta?
4. Horas y bloque de los 7 planes sin horas; PGR6x2 = 120 min; PGP4x1 con inscripción y seguro.
5. Cambio de plan: «parcial» = plan nuevo − lo pagado (duda #8). Recargo 5 % o 6 % (duda #9).
6. Alta a mitad de mes: mes completo (R5) o clases restantes (§7.6).
7. Emma: ¿se anula la deuda de septiembre?
8. Niveles USAG por plan, días por nivel, puntajes; pronto pago.

---

## 4. Pruebas (todas en el gemelo; se corren de verdad, no se listan)

**Reservar:** R1 disponible 200 con sesión sin hora (hecho) · R2 reservar 4 h a Bella → `session_bookings` + `reserved_minutes +240`, cancelar devuelve · R3 6 h sin franja → 409 · R4 equipo sin horario → mensaje explícito · R5 instalación sin secundarias → «Sin acceso» · R6 reserva del mes siguiente descuenta del periodo siguiente.
**Pagar:** P1 acudiente paga mensualidad vencida con comprobante → `awaiting_approval` sin fila nueva · P2 dueño aprueba → `paid` y vigencia 31-oct · P3 «Nuevo pago» adelantando noviembre → vigencia 30-nov · P4 `/p/:token` sin WhatsApp permite subir comprobante · P5 comprobante fuera de ventana rechazado.
**Comprar:** C1 artículo para Bella (con cobro viejo pagado) → fila `articulos` `awaiting_approval` · C2 control con Athenea · C3 con cobro impago sin periodo → fila nueva y el viejo intacto · C4 dos artículos seguidos · C5 torneo con mensualidad pagada · C6 catálogo apagado → sin opción.
**Cobro mensual y mora:** `open_month` noviembre con escalones · `apply_late_fees` día 6 (5 % sobre neto) · primer cobro del alta sin recargo · comprobante pendiente cuenta como pagado · rechazo vuelve a mora.
**Cambio de plan:** sin pago / con pago parcial / completo / horas gastadas; horas trasladadas.
**Banco de horas y torniquete:** entrada/salida, gracia 10/20, reingreso 5 min, redondeo `hour_up`, cierre automático, tope 360 min, horas de más → sugerencia (no para dueños), plan sin horas.
**Bloqueo:** flag on/off, menores por `child_id`, excepción de un día (A3), rehabilitación al pagar, salidas sin bloqueo.
**Cartera:** Avril/Zoe «1 mes» $270.000 + mensualidad en `por_vencer`; Bella «2 meses»; Athenea «1 mes».
**Hermanos:** T01–T15 del diseño (CHECK, escalones, % único sin cambio, `fee_is_manual`, vínculo sin cuenta, retiro del mayor, multi-inscripción, preview = open_month, ajustes, sugerencia, alta, mora sobre neto, permisos, sincronía, invariantes).
**QR:** Q1 alta con plan → 3 cobros · Q2 re-escaneo no duplica · Q3 plan sin tarifas.
Cierre de cada fase: `npm run seguridad:invariantes` y `npm run migrations:check`.
