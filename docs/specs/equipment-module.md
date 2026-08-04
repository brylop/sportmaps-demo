# Spec — Módulo de Dotación e Inventario de Indumentaria

**Producto:** SportMaps · **Versión:** v1.1 (fuente de verdad, aterrizada al código real)
**Fecha:** Julio 2026 · **Piloto:** Escuela de fútbol, ~80 alumnos, 2 sedes, plan Escuela Pro
**Estado:** aprobado para construir por fases · las decisiones de producto están **resueltas** (§16).

> Documento base para la construcción. Se construye **por fases con revisión entre cada una**
> (no "todo el módulo de una"). La Fase 1 (backend) va primero con plan aprobado antes de
> escribir migraciones.

---

## 0. Principio rector — Aislamiento total del Marketplace

**Dotación e Inventario de Tienda son dos dominios distintos y NO comparten datos.**

| | **Inventario de Tienda** (ya existe) | **Dotación** (este módulo) |
|---|---|---|
| Naturaleza | Comercial — se **vende** | Custodia — se **presta y devuelve** |
| Hay dinero | Sí (precio, checkout, pago) | No |
| Dueño del stock | `vendor_id` | `school_id` + `branch_id` |
| Destinatario | Cliente/comprador | Entrenador (`school_members.role='coach'`) |
| Baja de stock | Al pagar (`deduct_stock_on_payment`) | Al asignar (reserva); regresa al devolver |
| Tablas | `products`, `product_variants`, `stock_holds`, `inventory_transactions` | `equipment_items`, `equipment_assignments`, `equipment_returns`, `equipment_assignment_logs` |

**Reglas duras:** Dotación no toca ninguna tabla del marketplace · un ítem de dotación nunca aparece en la Tienda ni viceversa · lo único compartido es infraestructura genérica (técnica `FOR UPDATE`, `audit_trigger_func()`, renderer PDF del BFF, `notify_user`), **no dominio**.

---

## 1. Objetivo

Permitir a las escuelas registrar su dotación deportiva (indumentaria, balones, implementos), entregarla a entrenadores con constancia de responsabilidad, y controlar devoluciones — con evidencia fotográfica y acta digital como respaldo ante pérdidas o daños.

**Problema:** hoy la entrega es verbal o en papel; cuando algo se pierde no hay evidencia de quién lo tenía ni en qué estado se entregó.

---

## 2. Roles y permisos

| Rol | Puede |
|---|---|
| **Admin** (`school_members.role IN ('owner','admin')`) | CRUD de ítems, asignar, aprobar entregas/devoluciones, resolver disputas, historial completo, descargar actas, configurar, editar asignaciones (con log) |
| **Entrenador** (`role='coach'`, `status='active'`) | Ver su dotación, aceptar entregas, tomar en autoservicio (si habilitado), registrar devoluciones, ver/descargar sus actas |
| **Padres / deportistas** | Sin acceso en v1 |

Todo filtrado por `school_id` vía `is_school_admin(school_id)` / `is_super_admin()`. Admin ve toda su escuela; coach ve solo `assigned_to = auth.uid()` (no existe hoy "permiso por sede" granular para admins).

---

## 3. Modos de operación

Config global de la escuela, con override por ítem.
- **Modo A — Entrega por admin (default):** admin registra la entrega, el coach la acepta.
- **Modo B — Autoservicio (opt-in):** el coach toma físicamente y lo registra; **foto obligatoria** al tomar y devolver; el admin aprueba ambas.

> **Regla de oro:** en ambos modos, ninguna asignación queda activa ni cerrada sin acción del admin y del entrenador. Doble confirmación siempre.

---

## 4. Máquina de estados (dos niveles)

Estado en la **asignación** y en cada **devolución** — esto resuelve devoluciones parciales concurrentes (parte devuelta OK + parte en disputa).

**Asignación (`text + CHECK`):**
```
MODO A: admin asigna → pendiente_aceptacion → coach acepta → activa
                            └→ coach reporta diferencia → en_disputa
                                 └→ admin corrige/reasigna → activa | cancelada
MODO B: coach toma+foto → pendiente_aprobacion_entrega
                            ├→ admin aprueba → activa
                            └→ admin rechaza (nota) → rechazada (libera stock)
CIERRE: activa → (Σ devoluciones aprobadas = quantity) → cerrada
        activa → admin cierra con faltante → cerrada
```
Estados: `pendiente_aceptacion · pendiente_aprobacion_entrega · activa · en_disputa · rechazada · cancelada · cerrada`

**Devolución (`equipment_returns.status`):**
```
coach registra devolución (cantidad+condición+foto si modo B)
  → pendiente_aprobacion
       ├→ admin aprueba → aprobada (aplica efecto de stock)
       └→ admin disputa (nota) → en_disputa → resolución admin → aprobada
```
Estados: `pendiente_aprobacion · aprobada · en_disputa · rechazada` · Condición: `bueno · dañado · perdido`

### 4.1 Efectos sobre stock (`equipment_items`)

| Evento | `quantity_available` | `quantity_total` |
|---|---|---|
| Asignación creada | `-= quantity` (reserva) | — |
| Rechazada / cancelada | `+= quantity` (libera) | — |
| Devolución aprobada `bueno` | `+= return_quantity` | — |
| Devolución aprobada `dañado` | NO regresa; ítem → `deteriorado` | — |
| **Devolución aprobada `perdido`** | NO regresa | **`-= return_quantity`** (baja de inventario, con log) |
| Cierre con faltante (admin) | NO regresa el remanente | `-= remanente` (baja de inventario, con log) |

> **Regla `perdido`/faltante:** además de no regresar disponibilidad, se decrementa `quantity_total` porque la unidad ya no existe físicamente. Toda baja de `quantity_total` escribe una fila en `equipment_assignment_logs` (`action='baja_por_perdida'`). El invariante `quantity_available <= quantity_total` se mantiene.
>
> **Todos los efectos ocurren solo dentro de RPCs `SECURITY DEFINER` con `SELECT … FOR UPDATE`** sobre `equipment_items`. El frontend nunca hace `UPDATE` de stock.

---

## 5. Modelo de datos

`text + CHECK` (no `CREATE TYPE`); FKs de negocio a `public.profiles(id)`; sede = `school_branches` vía `branch_id`; auditoría vía `audit_trigger_func()`.

```sql
-- 1. Config por escuela
CREATE TABLE public.equipment_settings (
  school_id                uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  self_checkout_enabled    boolean NOT NULL DEFAULT false,
  require_photo_admin_mode  boolean NOT NULL DEFAULT false,
  default_return_days      int,                       -- null = sin límite
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Ítems
CREATE TABLE public.equipment_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  branch_id             uuid REFERENCES public.school_branches(id) ON DELETE SET NULL,  -- null = compartido
  name                  text NOT NULL,
  size                  text,
  quantity_total        int  NOT NULL CHECK (quantity_total >= 0),
  quantity_available    int  NOT NULL CHECK (quantity_available >= 0),  -- solo por RPC
  condition             text NOT NULL DEFAULT 'nuevo' CHECK (condition IN ('nuevo','usado','deteriorado')),
  photo_url             text,
  self_checkout_override text CHECK (self_checkout_override IN ('permitido','bloqueado')),
  is_active             boolean NOT NULL DEFAULT true,  -- soft delete
  created_by            uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_items_available_lte_total CHECK (quantity_available <= quantity_total)
);
CREATE INDEX idx_equipment_items_school        ON public.equipment_items(school_id, is_active);
CREATE INDEX idx_equipment_items_school_branch ON public.equipment_items(school_id, branch_id);

-- 3. Asignaciones
CREATE TABLE public.equipment_assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  item_id             uuid NOT NULL REFERENCES public.equipment_items(id) ON DELETE RESTRICT,
  branch_id           uuid REFERENCES public.school_branches(id) ON DELETE SET NULL,
  assigned_to         uuid NOT NULL REFERENCES public.profiles(id),  -- entrenador
  assigned_by         uuid REFERENCES public.profiles(id),           -- admin (null en autoservicio)
  mode                text NOT NULL CHECK (mode IN ('admin_delivery','self_checkout')),
  quantity            int  NOT NULL CHECK (quantity > 0),
  status              text NOT NULL DEFAULT 'pendiente_aceptacion'
                        CHECK (status IN ('pendiente_aceptacion','pendiente_aprobacion_entrega',
                                          'activa','en_disputa','rechazada','cancelada','cerrada')),
  delivered_at        timestamptz,
  accepted_at         timestamptz,
  checkout_photo_url  text,           -- obligatoria en modo B
  checkout_note       text,
  entrega_approved_by uuid REFERENCES public.profiles(id),
  entrega_approved_at timestamptz,
  reject_note         text,
  dispute_note        text,
  reported_quantity   int,
  return_due_at       date,
  returned_quantity   int NOT NULL DEFAULT 0,  -- Σ devoluciones aprobadas
  content_snapshot    jsonb,          -- congelado al pasar a ACTIVA
  acta_folio          text UNIQUE,    -- "DOT-{SLUG}-{YYYY}-{NNNNN}"
  acta_pdf_url        text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_assignments_returned_lte_qty CHECK (returned_quantity <= quantity)
);
CREATE INDEX idx_equip_assign_school_status ON public.equipment_assignments(school_id, status);
CREATE INDEX idx_equip_assign_coach_status  ON public.equipment_assignments(assigned_to, status);
CREATE INDEX idx_equip_assign_school_branch ON public.equipment_assignments(school_id, branch_id);
CREATE INDEX idx_equip_assign_item          ON public.equipment_assignments(item_id);

-- 4. Devoluciones (tabla hija — soporta parciales; corrección clave vs v1.0)
CREATE TABLE public.equipment_returns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.equipment_assignments(id) ON DELETE CASCADE,
  school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  quantity      int  NOT NULL CHECK (quantity > 0),
  condition     text NOT NULL CHECK (condition IN ('bueno','dañado','perdido')),
  status        text NOT NULL DEFAULT 'pendiente_aprobacion'
                  CHECK (status IN ('pendiente_aprobacion','aprobada','en_disputa','rechazada')),
  photo_url     text,               -- obligatoria si la asignación es self_checkout
  note          text,
  requested_by  uuid REFERENCES public.profiles(id),
  requested_at  timestamptz NOT NULL DEFAULT now(),
  approved_by   uuid REFERENCES public.profiles(id),
  approved_at   timestamptz,
  dispute_note  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_equip_returns_assignment ON public.equipment_returns(assignment_id);
CREATE INDEX idx_equip_returns_school_st  ON public.equipment_returns(school_id, status);

-- 5. Log de negocio (acciones semánticas; el audit genérico cubre "toda edición")
CREATE TABLE public.equipment_assignment_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.equipment_assignments(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES public.profiles(id),
  action        text NOT NULL,   -- 'edito_cantidad'|'resolvio_disputa'|'reasigno'|'cerro_con_faltante'|'baja_por_perdida'
  old_value     jsonb,
  new_value     jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_equip_logs_assignment ON public.equipment_assignment_logs(assignment_id);
```
**Triggers:** `updated_at` + `audit_trigger_func()` en items, assignments, returns.

---

## 6. RLS

Reusa `is_school_admin(school_id)` / `is_super_admin()` (no revocarlas al caller). Ninguna policy hace `SELECT` sobre su propia tabla.

| Tabla | SELECT | Escritura directa |
|---|---|---|
| `equipment_settings` | admin | admin |
| `equipment_items` | admin **o** coach activo de la escuela | solo admin |
| `equipment_assignments` | admin **o** `assigned_to = auth.uid()` | solo admin; coach **solo vía RPC** |
| `equipment_returns` | admin **o** coach dueño de la asignación | solo admin; coach vía RPC |
| `equipment_assignment_logs` | solo admin | solo vía RPC `SECURITY DEFINER` |

"Coach activo": `EXISTS (SELECT 1 FROM school_members sm WHERE sm.school_id = <tabla>.school_id AND sm.profile_id = auth.uid() AND sm.role='coach' AND sm.status='active')`.

---

## 7. Backend — RPCs y endpoints

Todos `SECURITY DEFINER`, `SET search_path = pg_catalog, public, pg_temp`, `GRANT EXECUTE … TO authenticated`.

**Ítems/config (admin):** `equipment_upsert_item` · `equipment_soft_delete_item` · `equipment_save_settings`

**Modo A:** `equipment_assign(item, coach, qty, branch, due, note, photo?)` (`FOR UPDATE`, resta stock, `pendiente_aceptacion`, notifica coach) · `equipment_accept(id)` (coach → `activa` + folio + snapshot + dispara acta) · `equipment_report_difference(id, reported_qty, note)` (→ `en_disputa`)

**Modo B:** `equipment_self_checkout(item, qty, branch, photo, note)` (valida `self_checkout_enabled` + override, **exige foto**, `FOR UPDATE`, reserva, `pendiente_aprobacion_entrega`) · `equipment_approve_delivery(id)` (→ `activa` + acta) · `equipment_reject_delivery(id, note)` (→ `rechazada`, libera stock)

**Devolución:** `equipment_request_return(assignment, qty, condition, photo, note)` (valida `qty ≤ quantity - returned_quantity`, foto si modo B, fila en `equipment_returns`) · `equipment_approve_return(return_id, final_condition)` (`FOR UPDATE`; marca `aprobada`; aplica stock — `bueno`→regresa, `dañado`/`perdido`→no regresa, **`perdido`→`quantity_total -= qty` + log**; `returned_quantity += qty`; si `= quantity` → asignación `cerrada` + 2ª página del acta) · `equipment_dispute_return(return_id, note)`

**Admin/disputa (con log):** `equipment_resolve_dispute` · `equipment_edit_assignment` · `equipment_close_with_shortage` (cierra marcando el remanente como perdido → `quantity_total -= remanente` + log)

**Lectura:** `equipment_list_items(school, branch, status, search, limit, offset) → {total, rows}` · `equipment_pending_approvals(school)` (badge de la cola) · `equipment_my_assignments()` · `equipment_assignment_detail(id)`

**BFF** (`bff/src/routes/equipment.route.ts`, solo lo que necesita service role / render server-side):
- `POST /api/v1/equipment/assignments/:id/acta-pdf` — reusa el renderer de `/api/v1/certificates/:id/generate-pdf`, sube al bucket privado `certificates` con prefijo `dotacion/`, llama `equipment_set_acta_pdf_url`.
- (Opcional) `POST /api/v1/equipment/photos` — subida + compresión server-side.

---

## 8. Acta de responsabilidad (PDF)

> **Reuso real:** NO se usa la tabla `athlete_certificates` (atada a atleta con XOR child/profile). Se reusa: (a) el renderer del BFF, (b) el patrón de bucket privado con RLS por owner, (c) la idea de `content_snapshot`, (d) el estilo de folio correlativo.

- Se genera al pasar a `ACTIVA` (folio + snapshot en el RPC; PDF vía BFF).
- **Folio:** `DOT-{SLUG}-{YYYY}-{NNNNN}` (correlativo por escuela/año, estilo `_next_certificate_folio` — **no** UUIDs crudos).
- **Contenido:** logo + escuela/sede, datos del coach (nombre + documento si existe), tabla (ítem, talla, cantidad, condición al entregar), foto embebida, texto legal, sello digital según modo, folio único.
  - Legal: *"Declaro haber recibido a conformidad los elementos descritos, me comprometo a darles uso adecuado, custodiarlos y devolverlos en el estado recibido, salvo el deterioro normal por uso. En caso de pérdida o daño por negligencia, respondo por su reposición según las políticas de la escuela."*
  - Sello A: *"Aceptado digitalmente por [nombre] el [fecha/hora] vía SportMaps"*
  - Sello B: *"Registrado por el propio entrenador el [fecha/hora] con evidencia fotográfica, aprobado por [admin] el [fecha/hora] vía SportMaps"*
- **Acta de devolución (decisión §16):** se agrega una **2ª página al acta cuando la asignación cierra** (cantidad devuelta, condición, foto, quién aprobó y cuándo, faltantes). Se genera un **PDF adicional solo si hubo disputa** en alguna devolución.

---

## 9. Storage (buckets privados)

Los buckets públicos fueron bloqueados en el repo — todo privado con RLS por owner (patrón del bucket `certificates`).

- `equipment-photos` (privado, `image/*`, ~5 MB) — fotos de checkout y devolución. Ruta `{school_id}/{assignment_id}/{tipo}-{ts}.jpg`.
- **Actas (decisión §16):** se reusa el bucket `certificates` con prefijo `dotacion/{school_id}/{assignment_id}.pdf`.
- **RLS lectura:** admin de la escuela, super-admin, o coach dueño de la asignación (join a `equipment_assignments`). **Escritura:** actas vía service role (BFF); fotos INSERT de authenticated con `WITH CHECK` de membresía activa.

---

## 10. Gating (decisión §16 — incluido desde tier Pro)

El módulo viene **incluido desde el tier Escuela Pro** y superiores (sin addon opt-in). Implementación:
1. Feature key `equipment` en [saas-plans.ts](../../frontend/src/config/saas-plans.ts) como `kind:'tier'` con `minTier: 'pro'`.
2. Item "Dotación" en `navigation.ts` (rol escuela), visible solo si el tier ≥ Pro.
3. Guard en RPC/BFF antes de escrituras (patrón `accounting`/`invoicing`): verificar tier de la escuela.

---

## 11. Notificaciones

`notifications(user_id, title, message, type, link)`, `type IN ('info','success','warning',…)`, insert vía `notify_user` o `SECURITY DEFINER` interno.

| Evento | A quién | Canal v1 |
|---|---|---|
| Asignación creada (A) | Coach | **in-app** |
| Toma registrada (B) | Admin(s) | in-app |
| Entrega aprobada/rechazada | Coach | in-app |
| Devolución registrada | Admin(s) | in-app |
| Devolución aprobada/disputada | Coach | in-app |

> WhatsApp actual (WA1/WA2) es *parent-bound por OTP* — no llega a coaches (fuera de v1). Push depende del sender FCM (aún no listo). **v1 = solo in-app.**

---

## 12. Flujos de UI

**12.1 Admin — Inventario:** lista (foto, nombre, talla, disp./total, sede, estado) · filtros (sede/estado/búsqueda) · **+ Nuevo ítem** · **Asignar** · badge "N pendientes" → cola.

**12.2 Admin — Modal asignación (A):** coach (dropdown con búsqueda de coaches activos), cantidad ≤ disponible, sede, fecha límite (precargada `default_return_days`), nota, foto opcional → `pendiente_aceptacion` + notif.

**12.3 Admin — Cola de aprobación (control central):**
- Entrega (B): foto del coach (zoom), ítem/cantidad/coach/sede/fecha → **✓ Aprobar** · **✗ Rechazar** (nota obligatoria).
- Devolución: foto devolución lado a lado con entrega, cantidad devuelta vs entregada (resalta diferencias), selector de condición (default lo del coach) → **✓ Aprobar** · **⚠ Disputar** (nota obligatoria).

**12.4 Coach — "Mi dotación":** tarjetas activas/pendientes/historial. Pendientes (A): **Acepto recibido** / **Reportar diferencia** (nota + cantidad real). Activas: **Devolver**.

**12.5 Coach — Tomar (B, si habilitado):** ítems disponibles (respeta overrides) con stock → seleccionar → cámara (`<input type="file" accept="image/*" capture="environment">`, reusar `FileUpload`/`ProductGalleryUploader`) → nota → **Confirmar toma** → *"Registrado. Pendiente de aprobación. Al confirmar aceptas la responsabilidad sobre estos elementos."*

> `capture="environment"` es *sugerencia* — desktop/algunos browsers abren galería igual. UX móvil, **no control anti-fraude**. La evidencia la da foto+timestamp+autor.

**12.6 Coach — Devolver:** cantidad (parcial ≤ remanente), condición, nota → foto obligatoria si `mode='self_checkout'` → fila en `equipment_returns` + notif admin.

---

## 13. Validaciones y reglas

`quantity ≤ quantity_available` validado en RPC con `FOR UPDATE` (sin overselling) · foto modo B obligatoria, comprimir ~1600px, metadata con `assignment_id`+ts · devolución parcial vía `equipment_returns`, cierre cuando `returned_quantity = quantity` · `perdido`/faltante decrementa `quantity_total` con log · toda edición admin → `equipment_assignment_logs` · soft delete de ítems con historial · coach solo ve/actúa sobre lo suyo.

---

## 14. Configuración (Ajustes → Dotación)

☐ Habilitar autoservicio (`self_checkout_enabled`) · ☐ Exigir foto también en modo A (`require_photo_admin_mode`) · Días por defecto de devolución `[___]` (`default_return_days`; vacío = sin límite) · Override por ítem (permitir/bloquear) en el form del ítem (`self_checkout_override`).

---

## 15. Fuera de alcance (v1)

Asignación a deportistas · recordatorios automáticos de devolución · códigos de barras/QR · alertas de stock bajo · depreciación/costos/valorización · mantenimientos · reportes exportables (más allá del historial en pantalla) · firma manuscrita · canal WhatsApp/push a coaches.

---

## 16. Decisiones de producto (RESUELTAS)

1. **Gating:** módulo **incluido desde tier Pro** (no addon opt-in). El piloto ya es Pro.
2. **Acta de devolución:** **2ª página al cerrar** la asignación + **PDF adicional solo si hubo disputa**.
3. **Bucket de actas:** **reusar `certificates`** con prefijo `dotacion/`.
4. **Regla `perdido`/faltante:** decrementa **también** `quantity_total` (baja de inventario) con log `baja_por_perdida`.

---

## 17. Criterios de aceptación

1. Admin crea ítem con foto y stock, filtrado por sede ✓
2. Asigna 10 balones → coach notificado → acepta → acta PDF `DOT-…` descargable ✓
3. Coach reporta diferencia → `en_disputa` → admin corrige (log) → `activa` ✓
4. Autoservicio: coach toma 6 conos, no confirma sin foto → admin aprueba en la cola → `activa` ✓
5. **Coach devuelve 5 de 6 conos con foto → admin ve fotos lado a lado, marca 1 perdido → `quantity_available` regresa solo 5, `quantity_total` baja 1 con log, acta de devolución refleja el faltante** ✓
6. Autoservicio off (o ítem bloqueado) → coach no ve la opción ✓
7. Historial consultable por sede y por entrenador ✓
8. **Ningún ítem/stock de Dotación aparece en la Tienda ni viceversa** ✓
9. **Concurrencia:** dos coaches toman el último balón a la vez → uno gana, el otro recibe "stock insuficiente"; nunca queda negativo ✓

---

## 18. Fases de construcción (una fase por sesión/rama, con revisión entre cada una)

Migraciones nuevas e inmutables, `YYYYMMDDHHMMSS`, con `SET search_path` y `GRANT EXECUTE`.

| Fase | Rama | Entregable | Archivos |
|---|---|---|---|
| **1 · Backend** | `feature/equipment-backend` | Modelo + RLS + estados + RPCs + buckets + **tests de RPC (concurrencia + cierre con faltante)** | `supabase/migrations/2026071500000X_equipment_module.sql`, `..._equipment_rpcs.sql`, `..._equipment_buckets.sql` |
| **2 · Admin UI (Modo A)** | `feature/equipment-admin-ui` | Inventario + modal asignación + cola de aprobación + ajustes | `frontend/src/pages/school/SchoolEquipmentPage.tsx`, `EquipmentAssignModal.tsx`, `EquipmentApprovalQueue.tsx`, `navigation.ts`, `saas-plans.ts` |
| **3 · Coach UI + Modo B** | `feature/equipment-coach-ui` | Mi dotación + toma con cámara + devolución | `frontend/src/pages/coach/CoachEquipmentPage.tsx`, `EquipmentCheckout.tsx` (reuso `FileUpload`) |
| **4 · Acta PDF + notifs** | `feature/equipment-acta` | Render BFF + folio + snapshot + in-app | `bff/src/routes/equipment.route.ts` |
| **5 · QA piloto** | — | 1 sede → luego la 2ª | tests + validación en `develop` |

**Entrega recomendada:** Fases 1–2 + **Modo A completo** primero (la escuela ya opera); **Modo B** una semana después.

---

## 19. Checklist de convenciones del repo (no romper)

- [ ] Migraciones nuevas, nunca editar/borrar existentes
- [ ] `SET search_path = pg_catalog, public, pg_temp` en toda función nueva
- [ ] `GRANT EXECUTE … TO authenticated` explícito por RPC
- [ ] No revocar las helpers de RLS (`is_school_admin`, etc.) al caller
- [ ] RLS sin self-recursion (no `SELECT` sobre la propia tabla en `USING`)
- [ ] FKs de negocio a `public.profiles(id)`
- [ ] `text + CHECK`, no `CREATE TYPE`, para estados/condiciones
- [ ] Stock solo por RPC con `FOR UPDATE` — nunca `UPDATE` desde el cliente
- [ ] Entrega full-stack (DB + RLS + RPCs + BFF + Frontend + Auditoría + QA)
- [ ] **Cero acoplamiento con el marketplace** (`products`, `inventory_transactions`, `stock_holds`)
