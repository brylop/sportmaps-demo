# SportMaps — Roadmap Maestro

**Versión:** 2.1 · **Fecha:** 2026-08-01 · **Rama:** `develop`

> **Este es el único roadmap.** Todo lo demás en `docs/` es *spec* (qué se construye y por qué),
> *plan de fase* (cómo se migra), *doctrina de arquitectura* (cómo se hace) o *auditoría* (qué está
> mal). Ninguno de esos documentos define prioridades: las define esta cola. Si un pendiente no
> aparece aquí, no existe.

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

## 1.1 Estado para producción

| Frente | Estado | Nota |
|---|---|---|
| **Notificaciones** | ✅ funcional | Push web y nativo funcionando. No decir que está roto |
| **Migraciones** | ✅ aplicadas y funcionales | El gate `migrations:check` corre en pre-commit y CI |
| **Ciclo de mes / cobros duplicados** | 🔍 en revisión → `DIN-1` | **Único bloqueante de producción.** Revisión hecha el 2026-08-01: de los tres hallazgos, **H1 y H2 ya estaban cerrados** por las migraciones del 24-jul (índices de adultos y no registrados creados; `open_month` puebla `period_*` y el cron delega en él). Lo que sigue abierto es la ventana intra-sentencia, que **ninguno** de los tres hallazgos describía |
| **Entitlements / activación de módulos** | 🔴 miente en silencio | `DIN-4` + `SEG-7`. No bloquea prod hoy, pero bloquea el bloqueo de trial |

---

## 1. Qué se entregó desde la v1.3 (12 may → 1 ago 2026)

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

## 2. Catálogo de pendientes

IDs estables. La cola de la §3 los ordena; esta sección los describe.

### DIN — Dinero y cobros

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| **DIN-1** | **Generación de mes y cobros duplicados (F0) — plan consolidado.** Cubre lo que sigue abierto de las inscripciones duplicadas y de la generación unificada, ahora que se verificó qué cerró el 24-jul: la ventana **intra-sentencia** de `open_month` (el advisory lock no la cubre; hoy el síntoma es que la apertura de mes **aborta** para toda la escuela), el guard que falta en `POST /enrollments`, el `UPDATE` de `students.ts:829` que fabrica huérfanas, el `CHECK` de inscripción con destino, el merge de las 198 filas duplicadas y las 16 huérfanas que hay que **asignar** (~$2.21M/mes). | 🟡 | 1–2 sem | **[plan consolidado](plan-f0-generacion-de-mes-y-cobros-duplicados.md)** · evidencia en [plan-f0 original](plan-f0-inscripciones-y-cobros-duplicados.md) §2 y §7 |
| ~~DIN-2~~ | **Absorbido por DIN-1.** Verificado contra el código el 2026-08-01: **H1 cerrado** (los tres índices únicos existen, incluidos adultos y no registrados) y **H2 cerrado** (`open_month` puebla `period_*` siempre y el cron delega en él desde el 24-jul). La unificación de las 3 vías del §4.4 también está hecha: el botón llama `preview_open_month`/`open_month` y `calcFirstPayment` quedó confinado a los modales de alta. Queda **H3** (declarativo, sin código) dentro de DIN-1. | ✅ | — | [spec month-close §4](specs/month-close-module.md) |
| DIN-3 | **`payments.payment_provider` deja de mentir.** Se creó con `DEFAULT 'wompi'`, así que toda fila insertada sin provider queda sellada como Wompi y la reconciliación cuenta mal. | 🟡 | 4 h | [plan](plan-payment-provider-default-fix.md) |
| **DIN-4** | **Bloqueo de fin de prueba, entitlements y cuentas de prueba.** Hoy no se bloquea nada: no hay cron, `EntitlementGate` está en una sola página y `/me/entitlements` es fail-open. Decidido: 1 mes abierto → bloqueo duro → reactivación manual, marcando con `account_type` nuevo (`is_demo` está mal mantenido). **Es ingreso que se está regalando**, y además el panel de activación miente (ver desglose abajo). | 🔵 | 3–4 sem, 7 fases | [spec](specs/trial-blocking-and-test-accounts.md) §2.5, D11–D13, F0.5 |
| DIN-5 | **Duplicación de pagos — H-03, H-04, H-05, H-07.** Los hallazgos H-01 (autopay legacy), H-02 (doble clic) y H-06 (`record_recurring_attempt`) ya están arreglados; estos cuatro siguen abiertos. | 🔵 | 2–3 d | memoria `project_payment_duplication_audit` |
| DIN-6 | **Connected accounts (pasarela propia por escuela).** El resolver y la tabla ya existen; falta poblar y hacer el split. Decisiones abiertas: pricing de M2 y si la Fase 3 va a modelo agregador. | 🟡 | 1–2 sem | [plan](payments-connected-accounts-plan.md) · [status](payments-connected-accounts-STATUS.md) |
| DIN-7 | **Autopay en Wompi.** Bloqueado por falta de API `payment_sources`; hay que pedirla aparte en el contrato de Pagos a Terceros. Solo MP funciona hoy. | ⚪ | externo | memoria `project_wompi_commercial_status` |
| DIN-8 | **Facturación electrónica multi-PAC.** Capa de adaptadores DIAN (Factus primero, luego Siigo/Alegra). API sandbox de Factus ya validada. Tablas `invoice_providers` + `invoices`. **No depende del libro mayor**: el PAC emite la factura, no pide el mayor — no se bloquean entre sí en ningún sentido. | 🔵 | 5 fases | memoria `project_electronic_invoicing` |

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
| SEG-1 | **Linter de Supabase — Fase −0.5 (drift bloqueante)** y luego Fase 1 (quick wins: `search_path` en ~35 funciones, 2 MVs expuestas en la API, 4 buckets que permiten listado). | 🟢 | 1–2 d | [plan](analysis/SUPABASE_LINTER_REMEDIATION_PLAN.md) |
| SEG-2 | **`security_definer_view` en `school_athletes`** — el único ERROR del linter. | 🟢 | 4 h | [plan §Fase 2](analysis/SUPABASE_LINTER_REMEDIATION_PLAN.md) |
| SEG-3 | **`SECURITY DEFINER` expuestas a `anon`.** Ejecutar por grupos: A (helpers/triggers → revoke total), E (internas → solo `service_role`), F (candidatas a `DROP` por falta de uso), luego C y D. Cuidado: **nunca revocar** `is_school_admin()` / `is_super_admin()` al rol que las invoca desde policies. | 🟢 | 1 sem, N PRs | [auditoría](analysis/SECURITY_DEFINER_AUDIT.md) |
| SEG-4 | **Permisos de coach.** Dos planos que no coinciden (RLS aguanta / el BFF con service role es el único gate real) y dos matrices de permisos que son código muerto. | 🔵 | 3–4 d | memoria `project_coach_permissions_audit` |
| SEG-5 | **Anti-spoofing / IDOR / rate limit.** No aceptar nunca `user_id`/`sender_id` desde el payload del cliente; rate limit en endpoints sensibles; helper `can_message(a,b)` con relaciones reales. | 🔵 | 3–5 d | [athlete remediation §F1](athlete-modules-remediation-plan.md) · [strategic §10](sportmaps-strategic-roadmap.md) |
| SEG-6 | **RLS column-level en `medical_info` y `phone`** (A8 del roadmap v1.3). | 🔵 | 1 d | [anexo B.8](archived/ROADMAP-v1.3-2026-05-12.md) |
| **SEG-7** | 🔴 **`v_school_entitlements` devuelve una respuesta falsa, sin error.** Misma escuela, mismo instante: con `service_role` responde `enterprise / active / 10 módulos true`; sin privilegio responde `starter / free / active / todos false` — **HTTP 200 en ambos casos**. La vista es `security_invoker=true`; `schools` tiene `FOR SELECT USING (true)` así que la fila siempre vuelve, pero `school_subscriptions` y `school_addons` están gateadas a `is_school_admin() OR is_super_admin()`. Cuando el lector no pasa, el `LEFT JOIN` da NULL, los `COALESCE` **inventan** `starter/free/active` y cada `EXISTS` de addons da `false`. Es **fail-open en el status** (afirma `active` cuando no sabe) y fail-closed en los módulos. Hoy muerde poco porque el BFF usa service role y el único lector del browser es el panel admin, cuyos 3 perfiles pasan el guard — **pero el bloqueo de `DIN-4` F3 se apoya justo en ese status**: un lector degradado ve `active` y el bloqueo no se aplica nunca. | 🔵 | 2–3 d | `DIN-4` D12 · gate `G-NOLIE` |

### INF — Infraestructura y deuda de esquema

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| INF-1 | **Deriva de esquema sin versionar.** ~336 objetos que la base tiene y el repo no crea: 56 tablas, 137 funciones, 143 columnas. Hay módulos enteros fuera del repo. La cadena de migraciones ya no reproduce la base. Se mide con `npm run migrations:drift`. Ayer se cerró el dominio de rendimiento; **hay que versionar por dominio, empezando por el que bloquee la siguiente fase.** | 🔵 | continuo | memoria `project_unversioned_schema_drift` |
| INF-2 | **Dos mecanismos de cron coexisten** en el BFF (deuda documentada). | 🔵 | 2 d | [auditoría §3.6](AUDITORIA_ARQUITECTURA.md) |
| INF-3 | **Triple vocabulario de roles.** `public.roles` usa `school_admin`, no `admin`; hay tres nomenclaturas conviviendo. | 🔵 | 3 d | [auditoría §4.2](AUDITORIA_ARQUITECTURA.md) |
| INF-4 | **Rendimiento: el cuello no es la BD.** CPU al 5%; el problema es RLS amplificando `school_athletes` ×3000 en buffers + 3 round-trips por request en el BFF. | 🔵 | 1 sem | memoria `project_perf_audit_2026_07` |
| INF-5 | **`programs` es legacy** y 4 funciones todavía lo referencian (una ya rompió la página de carnets). | 🔵 | 1 d | memoria `project_carnets_digitales` |

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
| MOD-3 | **Multi-categoría (F2+).** 1 inscripción + `enrollment_categories`, precio por cantidad (145k/165k) vía `monthly_fee`. Depende de DIN-1. | 🔵 | 2 sem | [spec](specs/sport-categories-and-multi-category.md) |
| MOD-4 | **Notificaciones F2–F6 + go-live en producción.** El motor ya funciona en dev. | 🔵 | 3 sem | [spec](specs/notifications-unified.md) |
| ~~MOD-5~~ | **Disuelto.** «Contabilidad fases 1–6» era el mismo trabajo que `ERP-2..6`. La UI para vendor y organizer sigue pendiente y va dentro de `ERP-2` (el eje `owner_type`/`owner_id` ya existe desde la fase 0). | — | — | §3 |
| MOD-6 | **Dotación e inventario por fases.** Custodia de equipo a entrenadores con acta y evidencia fotográfica. Aislado del marketplace, tier Pro. | 🔵 | 3 sem | [spec v1.1](specs/equipment-module.md) |
| MOD-7 | **Torneos: cerrar inscripción → bracket.** `events` + delegaciones ya existen en la base **sin versionar**; el bracket es net-new. | ⚠️🔵 | 4 sem | [decisiones](tournaments-decisions.md) · [inscripción](tournaments-enrollment-flow.md) · [scoring](tournaments-scoring-engine.md) |
| MOD-8 | **Asistencia y créditos de sesión.** Máx 1 crédito/atleta/día, la reserva descuenta y la asistencia no re-descuenta ese día, bloqueo del día al 2º coach. Incluye el saneamiento del eje plan↔equipo↔sesiones. | 🔵 | 2 sem | [plan créditos](plan-asistencia-y-creditos-de-sesion.md) · [saneamiento](plan-saneamiento-sesiones-plan-equipo.md) |
| MOD-9 | **Informes de asistencia.** Decisiones de producto cerradas. | 🔵 | 1 sem | [spec](specs/attendance-reports-module.md) |
| MOD-10 | **Complementos de métricas de rendimiento (C-A…C-K)** + `higher_is_better`, pesos, normalización, benchmark, y la UI de crecimiento. | 🔵 | 3 sem | [complementos](performance-metrics-complements.md) · [spec](performance-metrics-spec.md) |
| MOD-11 | **Marketplace: desplegar lo que ya está en código.** `marketplace_transactions` no existe en la base — el módulo escolar y externo está construido pero **no desplegado**. Después: M8 planes vendor, M9 split multi-vendor en carrito, M10 3D/AR, M11 Mox real, M12 email transaccional. | 🔵 | 1 sem + M8–M12 | memoria `project_stores_marketplace_state` · [anexo M8–M12](archived/ROADMAP-v1.3-2026-05-12.md) |
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

### P0 — Esta semana. Hay dinero mal cobrado en producción

| # | ID | Por qué ahora | Bloqueante de |
|---|---|---|---|
| 1 | **DIN-1** | Plan consolidado escrito el 2026-08-01, **pendiente de aprobación**. Su primer paso es una puerta dura: verificar contra la base que las tres migraciones del 24-jul están aplicadas. Si no lo están, el alcance vuelve a ser el del plan original. | MOD-3, todo el ciclo de mes |
| 2 | **DIN-3** | 4 horas de trabajo y la reconciliación deja de contar mal. Plan ya escrito. | Conciliación bancaria, DIN-6 |
| 3 | **SEG-1** | La Fase −0.5 es un drift **bloqueante**: hasta resolverlo, cualquier migración nueva puede aplicarse sobre un esquema distinto al que el repo cree. | Toda migración posterior |

> **Cuatro decisiones abiertas dentro de DIN-1** (§8 del plan consolidado): qué hace
> `students.ts:829` cuando el atleta queda sin equipo ni plan · si las 16 huérfanas se asignan antes
> del `CHECK` o después · si se backfillean los 349 cobros sin `period_*` · y quién concilia el
> sobrecobro de GYM RM.

### P1 — Próximas 3–4 semanas

| # | ID | Por qué |
|---|---|---|
| 4 | **SEG-2 + SEG-3** | El único ERROR del linter, más los revokes de `anon`. Riesgo real de lectura no autorizada. |
| 5 | **DIN-4** | Sin bloqueo de trial, cada cuenta que termina la prueba sigue usando todo gratis. |
| 6 | **MOD-1** | Evita repetir el envío masivo con datos mal cargados. Plan escrito y ya revisado. |
| 7 | **UX-1 + UX-3 + ERP-1** | Barato, mecánico, sin tocar lógica, y todo lo que se construya después nace bien. Los tres son la misma pasada por la UI. |
| 8 | **CONC-1 + CONC-2** | La idempotencia general es la defensa más barata contra el doble cargo y **prerrequisito de `ERP-2`**; el barrido de `count(*)` sin lock busca el error clásico donde ya sabemos cómo se ve bien hecho. |
| 9 | **UX-2** | F-01 (un error de fetch se ve como tabla vacía) toca pantallas de dinero. |
| 10 | **MOD-15** | 4 horas. Sin el System User el bot de WhatsApp muere cada 2 h. |
| 11 | **INF-1 (por dominio)** | Versionar el dominio que bloquee la siguiente fase, no los 336 objetos de golpe. |
| 12 | **UX-6** | Las features cosméticas son lo que hace que un padre vuelva al grupo de WhatsApp. Verificar primero qué quedó resuelto con el módulo de notificaciones. |
| 13 | **Responder D-T, D-MIG, D-PUC, D-CORTE** | Cuatro decisiones sin código de por medio que bloquean las 6–7 semanas de `ERP-2`. Se pueden contestar esta semana. |

### P2 — Cuando P0 y P1 estén cerrados

En este orden: **MOD-2** (riesgo nulo, entregable ya) → **MOD-4** (go-live de notificaciones) →
**MOD-11** (desplegar el marketplace que ya está escrito) → **DIN-5** → **ERP-2** → **ERP-3** →
**Ciclo de mes F1** → **ERP-4** → **ERP-5** → **MOD-8** → **MOD-6** → **MOD-9** → **DIN-6** →
**MOD-12** → **MOD-10** → **MOD-13** → **MOD-14** → **MOD-7** → **SEG-4** → **SEG-5** → **SEG-6** →
**INF-2..5** → **UX-5**.

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
| **D-PUC** — ¿qué plan de cuentas? PUC Colombia (Decreto 2650) completo, o un catálogo reducido con las cuentas que una escuela realmente usa | `ERP-2` | El completo son ~2.000 cuentas que nadie de la escuela sabe elegir; el reducido exige decidir cuáles |
| **D-T** — tercero: ¿tabla `parties` unificada, o eje polimórfico `party_type + party_id`? | `ERP-2` | El polimórfico no obliga a migrar `suppliers` ni `payroll_employees`, pero pierde la FK |
| **D-CORTE** — fecha de corte del mayor y cómo se calculan los saldos de apertura | `ERP-2` | Sin esto no se puede postear la primera fila |
| **D-MIG** — los `expenses` ya pagados: ¿se migran como obligación saldada, o el módulo arranca solo con lo nuevo? | `ERP-2` | Arrancar limpio es mucho más barato |
| **D-NOM** — ¿la obligación de nómina nace de un trigger al cerrar la liquidación, o de una RPC explícita? | `ERP-4` | Un trigger es cómodo y difícil de deshacer |
| **D-ROL** — la matriz Auxiliar/Contador/Administrador del spec externo → roles reales | `ERP-2` | Ya hay dos matrices de permisos de coach que son código muerto (`SEG-4`); no crear una tercera |
| **CONC-5** — franjas fijas vs solapamiento libre | `BLQ-1` | Índice único simple vs `EXCLUDE USING gist` |
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
| `docs/analysis/SUPABASE_LINTER_REMEDIATION_PLAN.md`, `SECURITY_DEFINER_AUDIT.md` | Auditorías con plan de ejecución. Vivas. |
| `docs/AUDITORIA_ARQUITECTURA.md` | Retrato del sistema y su deuda. Vive. |
| `docs/sportmaps-strategic-roadmap.md` | Tesis, mapa competitivo, track D1–D4. **Su §7 queda superseded por este archivo.** |
| `docs/migrations-workflow.md` | Cómo se crea una migración. Obligatorio. |
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

1. **Aprobar el plan de `DIN-1`** — es el único bloqueante de producción (§1.1). Nada de SQL antes.
   Su paso 1 es el preflight que verifica contra la base las tres migraciones del 24-jul.
2. **Aprobar `DIN-4` F0 + F0.5** — F0.5 arregla hoy el síntoma de «prendo el módulo y no se activa»,
   y F3 no se puede construir encima de un status que se puede leer falso.
3. En paralelo, sin dependencias ni decisiones: **`DIN-3`** (4 h) y **`MOD-15`** (4 h).
4. Después: **`SEG-1`** Fase −0.5 y **`SEG-7`**, que destraban migraciones y cierran la lectura falsa.
5. **Contestar D-PUC, D-T, D-CORTE y D-MIG** — cuatro decisiones sin código de por medio que bloquean
   las 6–7 semanas de `ERP-2`. Se pueden responder esta semana.
