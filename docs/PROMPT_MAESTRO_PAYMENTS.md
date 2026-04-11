# PROMPT MAESTRO — SportMaps Pay · Frontend + BFF
# Versión con código real validado · Abril 2026
# Usar al inicio de CADA sesión nueva

---

## CONTEXTO DEL PROYECTO

SportMaps es un SaaS multi-tenant de gestión de academias deportivas
en Colombia. Estás implementando **SportMaps Pay**: pagos online con
ePayco sobre el flujo manual existente. La regla más importante:

> NUNCA reemplazar el flujo manual. SOLO extender con una nueva opción online.

---

## STACK TÉCNICO REAL

### Frontend
- **Framework:** Vite + React (NO Next.js)
- **Router:** react-router-dom (`useNavigate`)
- **UI:** shadcn/ui + Tailwind CSS
- **Auth:** Supabase Auth → `useAuth()` desde `@/contexts/AuthContext`
- **Supabase client:** `import { supabase } from '@/integrations/supabase/client'`
- **Repo:** `github.com/brylop/sportmaps-demo`
- **Branches:** `develop` → `staging` → `main`
- **Deploy:** Vercel (sportmaps-dev, sportmaps-stg, sportmaps-prod)

### BFF (Backend for Frontend)
- **Stack:** Node.js + Express 5 + TypeScript
- **Deploy:** Render → `https://sportmaps-bff.onrender.com`
- **Rutas:** todas bajo `/api/v1/` (con versión)
- **Supabase:** `import { supabase } from '../config/supabase'`
- **Logger:** pino → `req.log?.error({ err }, 'mensaje')`
- **Validación:** Zod para todos los schemas de entrada
- **Rate limiter:** ya existe `paymentLimiter` (20 req/min) en `app.ts` — USARLO

### Supabase
- **Staging:** `luebjarufsiadojhvxgi` (activo, desarrollo)
- **Producción:** `detdmtzfnoqvopxrvask` (actualmente INACTIVE)

---

## AUTENTICACIÓN EN EL BFF — PATRÓN REAL

```typescript
// authMiddleware.ts — lo que hace requireAuth:
// 1. Lee Bearer token del header Authorization
// 2. Valida con supabase.auth.getUser(token)
// 3. Lee school_id del header 'x-school-id' enviado por el frontend
// 4. Busca en school_members WHERE profile_id = user.id AND status = 'active'
// 5. Popula req.user, req.schoolId, req.branchId, req.role

// USO en rutas:
router.post('/ruta', requireAuth, requireRole('owner', 'admin'), handler)

// Para rutas PÚBLICAS (sin auth):
// No usar requireAuth → solo validar firma del webhook internamente
```

---

## CÓMO REGISTRAR RUTAS NUEVAS EN app.ts

```typescript
// Patrón exacto del app.ts existente:
import epaycoRouter from './routes/epayco';

// Con paymentLimiter (ya definido en app.ts, 20 req/min):
app.use('/api/v1/payments', paymentLimiter, epaycoRouter);

// Webhook sin auth ni rate limit (ePayco llama desde sus servidores):
app.use('/api/v1/webhooks/epayco', epaycoWebhookRouter);

// Ruta pública de link de pago:
app.use('/api/v1/payments/link', generalLimiter, paymentLinkRouter);
```

---

## MODELO DE NEGOCIO — REGLAS ABSOLUTAS

```
Mensualidad base (define la escuela):   $100.000
Fee SportMaps 3% (lo paga el padre):      $3.000
─────────────────────────────────────────────────
Total pago ONLINE (cobrado al padre):   $103.000
La escuela SIEMPRE recibe:              $100.000
SportMaps recibe (solo si es online):     $3.000

REGLAS QUE NUNCA SE ROMPEN:
❌ NUNCA calcular el fee en el frontend → solo el BFF lo calcula
❌ NUNCA marcar payment.status = 'paid' desde el frontend para pagos online
   → solo el webhook del BFF puede hacerlo
❌ NUNCA exponer las claves privadas de ePayco al frontend
   → el frontend solo recibe el sessionId (temporal)
✅ El pago manual (transfer/efectivo) sigue igual que hoy sin cambios
✅ El fee aplica ÚNICAMENTE si el padre elige pagar online
✅ La escuela no paga nada extra por usar SportMaps Pay
```

---

## ESTADO ACTUAL DEL PaymentCheckoutModal (CÓDIGO REAL)

```typescript
// Ubicación: src/components/payment/PaymentCheckoutModal.tsx
// Lo que hace HOY:
// - Muestra 3 métodos: transfer (activo), pse (disabled), card (disabled)
// - transfer: sube comprobante → payment.status = 'awaiting_approval'
// - pse/card: están como "Próximamente" con enabled: false

// LO QUE HAY QUE HACER:
// - Agregar método 'online' con ePayco como opción NUEVA y PROMINENTE
// - PSE y card siguen disabled (ePayco los maneja internamente en su checkout)
// - El método 'online' NO llama processPayment() → abre PaymentConfirmModal
// - El flujo transfer (manual) NO CAMBIA
```

---

## FLUJO COMPLETO SPORTMAPS PAY

```
Frontend                    BFF (Render)              ePayco          Supabase
    │                           │                        │               │
    │ 1. Padre clic "Pagar      │                        │               │
    │    online"                │                        │               │
    │                           │                        │               │
    │ 2. Abre PaymentConfirmModal                        │               │
    │    (muestra desglose fee) │                        │               │
    │                           │                        │               │
    │ 3. Padre confirma         │                        │               │
    │──────────────────────────►│                        │               │
    │   POST /api/v1/payments   │                        │               │
    │   /create-session         │                        │               │
    │   { paymentId,enrollmentId}                        │               │
    │                           │ 4. Calcula fee en BFF  │               │
    │                           │ 5. Autentica ePayco    │               │
    │                           │──────────────────────► │               │
    │                           │   POST /login          │               │
    │                           │ ◄──────────────────────│               │
    │                           │   { token }            │               │
    │                           │                        │               │
    │                           │ 6. Crea sesión ePayco  │               │
    │                           │──────────────────────► │               │
    │                           │   POST /payment/session│               │
    │                           │ ◄──────────────────────│               │
    │                           │   { sessionId }        │               │
    │                           │                        │               │
    │                           │ 7. INSERT payment_links│               │
    │                           │────────────────────────────────────── ►│
    │ 8. { sessionId, gross }   │                        │               │
    │ ◄─────────────────────────│                        │               │
    │                           │                        │               │
    │ 9. useEPaycoCheckout      │                        │               │
    │    carga checkout-v2.js   │                        │               │
    │    ePayco.checkout        │                        │               │
    │    .configure({sessionId})│                        │               │
    │    .open()                │                        │               │
    │                           │                        │               │
    │ [Padre paga en ePayco UI] │                        │               │
    │                           │                        │               │
    │                           │ 10. Webhook POST       │               │
    │                           │ ◄──────────────────────│               │
    │                           │   /webhooks/epayco     │               │
    │                           │                        │               │
    │                           │ 11. Valida firma SHA256│               │
    │                           │ 12. Verifica idempotencia              │
    │                           │ 13. Verifica monto vs payment_link     │
    │                           │ 14. UPDATE payments    │               │
    │                           │     status='paid'      │               │
    │                           │     payment_channel='online'           │
    │                           │────────────────────────────────────── ►│
    │                           │ 15. INSERT payment_splits              │
    │                           │────────────────────────────────────── ►│
    │                           │ 16. WhatsApp confirmación padre        │
    │                           │ 17. WhatsApp notif escuela             │
    │                           │                        │               │
    │ 18. ePayco redirige a     │                        │               │
    │     /pagos/confirmacion   │                        │               │
    │     ?ref=epayco_ref       │                        │               │
```

---

## TABLAS NUEVAS EN SUPABASE (YA MIGRADAS)

### `payment_links`
```sql
id, payment_id → payments(id), school_id → schools(id),
token TEXT UNIQUE (hex 32 bytes - el URL público),
epayco_session_id TEXT UNIQUE,
gross_amount NUMERIC,   -- $103.000 (lo que paga el padre)
base_amount NUMERIC,    -- $100.000 (lo que recibe la escuela)
sportmaps_fee NUMERIC,  -- $3.000
fee_pct NUMERIC,        -- 3.00
status: 'pending'|'paid'|'expired'|'cancelled',
expires_at TIMESTAMPTZ (72h),
paid_at, failed_attempts, created_at, updated_at
```

### `payment_splits`
```sql
id, payment_id, payment_link_id,
epayco_ref TEXT NOT NULL UNIQUE,  -- clave de idempotencia
epayco_transaction_id,
gross_amount, school_receives, sportmaps_receives, epayco_fee,
transfer_status: 'pending'|'transferred'|'failed'|'disputed',
transfer_method: 'nequi'|'bank_transfer'|'daviplata',
transfer_reference, transferred_at, transferred_by,
raw_webhook JSONB,           -- guardar webhook completo
webhook_signature_valid BOOLEAN,
created_at
```

### Columnas nuevas en `payments`
```sql
gross_amount NUMERIC,         -- monto cobrado al padre
sportmaps_fee NUMERIC,        -- fee que gana SportMaps
epayco_fee NUMERIC,           -- comisión ePayco
payment_channel TEXT,         -- 'online'|'manual'|'transfer'|'cash'
epayco_ref TEXT,              -- referencia transacción
epayco_transaction_id TEXT
```

### Columnas nuevas en `school_settings`
```sql
epayco_enabled BOOLEAN DEFAULT false,
online_fee_pct NUMERIC(5,2) DEFAULT 3.00,
fee_payer TEXT DEFAULT 'parent',  -- 'parent'|'school'|'split'
transfer_day TEXT DEFAULT 'monday',
sportmaps_pay_terms_accepted_at TIMESTAMPTZ,
sportmaps_pay_terms_accepted_by UUID
```

---

## ARCHIVOS A CREAR (BFF)

### `bff/src/routes/epayco.ts`
```typescript
// Endpoints:
// POST /create-session    → requireAuth + requireRole('owner','admin','school_admin','parent')
// GET  /link/:token       → público (sin auth)
// POST (webhook separado) → sin auth, validación de firma interna

// Schema Zod para create-session:
const CreateSessionSchema = z.object({
  paymentId: z.string().uuid(),
  enrollmentId: z.string().uuid().optional(),
});

// Lógica create-session:
// 1. Validar schema con Zod
// 2. SELECT payment WHERE id=paymentId AND school_id=req.schoolId
// 3. SELECT school_settings WHERE school_id=req.schoolId
// 4. Verificar epayco_enabled === true
// 5. Verificar payment.status === 'pending' || 'overdue'
// 6. Verificar NO existe payment_link activo para ese payment
// 7. Calcular: grossAmount = amount * (1 + online_fee_pct/100)
// 8. POST https://apify.epayco.co/login (Basic base64 PUBLIC:PRIVATE)
// 9. POST https://apify.epayco.co/payment/session/create
//    { checkout_version:"2", name, currency:"COP", amount:grossAmount,
//      confirmation: BFF_URL+"/api/v1/webhooks/epayco",
//      response: FRONTEND_URL+"/pagos/confirmacion",
//      invoice: paymentId,
//      extras: { extra1:paymentId, extra2:schoolId } }
// 10. INSERT payment_links
// 11. Retornar { sessionId, grossAmount, baseAmount, feePct, sportmapsFee }
```

### `bff/src/routes/epayco-webhook.ts`
```typescript
// Lógica webhook:
// 1. Recibir POST de ePayco (x_ref_payco, x_transaction_state, etc.)
// 2. Validar firma SHA256:
//    hash = sha256(P_CUST_ID_CLIENT^P_KEY^x_ref_payco^x_transaction_id^x_amount^x_currency_code)
//    if hash !== x_signature → return 401
// 3. Si x_transaction_state !== 'Aceptada' → return 200 (ignorar silenciosamente)
// 4. Idempotencia: SELECT payment_splits WHERE epayco_ref=x_ref_payco
//    Si existe → return 200 (ya procesado)
// 5. Verificar monto: payment_links.gross_amount ≈ x_amount (tolerancia $1)
// 6. Verificar payment_links.status === 'pending'
// 7. Verificar payment_links.expires_at > now()
// 8. UPDATE payments SET status='paid', payment_channel='online',
//    epayco_ref=x_ref_payco, gross_amount=x_amount,
//    payment_date=today, approved_at=now()
// 9. UPDATE payment_links SET status='paid', paid_at=now()
// 10. INSERT payment_splits (con raw_webhook y webhook_signature_valid=true)
// 11. TODO: disparar WhatsApp confirmación
// 12. return 200 { received: true }
```

---

## ARCHIVOS A CREAR (FRONTEND)

### `src/hooks/useEPaycoCheckout.ts`
```typescript
// Carga dinámicamente checkout-v2.js (NO estático en index.html)
// porque en Vite no se puede pre-cargar scripts de terceros así
const EPAYCO_SCRIPT = 'https://checkout.epayco.co/checkout-v2.js';

interface UseEPaycoCheckoutOptions {
  paymentId: string;
  enrollmentId?: string;
  onSuccess?: () => void;
  onError?: (err: Error) => void;
  onClosed?: () => void;
}

// Retorna: { openCheckout, loading, error }
// Internamente:
// 1. Llama BFF POST /api/v1/payments/create-session
//    con headers: { Authorization: Bearer token, x-school-id: schoolId }
// 2. Recibe { sessionId, grossAmount, baseAmount, feePct }
// 3. Inyecta script dinámicamente si no existe
// 4. ePayco.checkout.configure({ sessionId, type:'onpage', test:false })
// 5. Registra onCreated, onErrors, onClosed
// 6. checkout.open()
// Cleanup: removeEventListener + removeChild del script al desmontar
```

### `src/components/payment/PaymentConfirmModal.tsx`
```typescript
// Modal que aparece ANTES de abrir ePayco
// Props: open, onOpenChange, baseAmount, grossAmount,
//        sportmapsFee, feePct, concept, childName, onConfirm, loading

// UI:
// ┌─────────────────────────────────┐
// │ Confirmar pago online           │
// │                                 │
// │ Mensualidad base:    $100.000   │
// │ Fee procesamiento:     $3.000   │
// │ ──────────────────────────────  │
// │ Total a pagar:       $103.000   │
// │                                 │
// │ 💳 Tarjeta · 🏦 PSE · 📱 Nequi │
// │ 🔒 Pago seguro ePayco           │
// │                                 │
// │ [Confirmar y pagar $103.000]    │
// │ [← Volver / pagar manualmente]  │
// └─────────────────────────────────┘
```

### Modificación `PaymentCheckoutModal.tsx`
```typescript
// En el array paymentMethods agregar al inicio:
{
  id: 'online' as const,
  name: 'Pagar online',
  description: 'Tarjeta, PSE o Nequi — inmediato y seguro',
  icon: CreditCard,
  popular: true,
  enabled: true,  // ← habilitado (antes disabled)
  badge: `+${formatCurrency(sportmapsFee)} fee`,  // mostrar el fee
}

// Cuando selectedMethod === 'online':
// NO llamar processPayment()
// Abrir PaymentConfirmModal con el desglose
// Cuando padre confirma → useEPaycoCheckout.openCheckout()

// El flujo transfer (manual) NO cambia nada
// Agregar estado de loading mientras BFF crea la sesión
```

### `src/pages/PaymentConfirmationPage.tsx`
```typescript
// Ruta: /pagos/confirmacion (PÚBLICA — sin AuthGuard)
// Lee query params: ?ref=xxx&status=xxx
// Llama BFF GET /api/v1/payments/link/:token (o por ref)
// Muestra:
//   ✅ Pago exitoso
//   Atleta: Juan García
//   Monto: $103.000
//   Ref: EP-2026-001234
//   Próximo vencimiento: 30 de mayo
//   [Volver al inicio]

// IMPORTANTE: esta página debe estar FUERA del layout autenticado
// Agregar al router como ruta pública antes del AuthGuard
```

### `src/components/settings/SportMapsPaySettings.tsx`
```typescript
// Componente para la sección de settings del owner/admin
// Lee school_settings.epayco_enabled, online_fee_pct, fee_payer, transfer_day
// Muestra:
//   [toggle] Activar SportMaps Pay
//   Fee: [3.00] %
//   ¿Quién paga el fee? parent/school/split
//   Día de transferencia: lunes/miércoles/viernes
//   Cuenta bancaria configurada (read-only, viene de settings existentes)
//   Historial de payment_splits con transfer_status
//   Términos: checkbox con sportmaps_pay_terms_accepted_at

// Al guardar → UPDATE school_settings
// Si cambia toggle a true por primera vez → registrar
//   sportmaps_pay_terms_accepted_at = now()
//   sportmaps_pay_terms_accepted_by = user.id
```

---

## VARIABLES DE ENTORNO NUEVAS EN BFF

```bash
# Agregar a .env y a Render environment variables:
EPAYCO_PUBLIC_KEY=xxx
EPAYCO_PRIVATE_KEY=xxx
EPAYCO_P_CUST_ID_CLIENT=xxx   # para validar firma webhook
EPAYCO_P_KEY=xxx               # para validar firma webhook
EPAYCO_TEST_MODE=true          # false en producción

# Ya existentes que se usan:
FRONTEND_URL=https://app.sportmaps.co
BFF_URL=https://sportmaps-bff.onrender.com
```

---

## ORDEN DE IMPLEMENTACIÓN — SPRINT 1 (esta semana)

```
DÍA 1 — BFF
  1. bff/src/routes/epayco.ts → POST create-session
  2. bff/src/routes/epayco-webhook.ts → POST webhook con firma SHA256
  3. bff/src/routes/epayco-link.ts → GET link/:token (público)
  4. Registrar en app.ts con paymentLimiter y generalLimiter

DÍA 2 — Frontend hooks y modales
  5. src/hooks/useEPaycoCheckout.ts
  6. src/components/payment/PaymentConfirmModal.tsx
  7. Modificar PaymentCheckoutModal → agregar método 'online'

DÍA 3 — Páginas y settings
  8. src/pages/PaymentConfirmationPage.tsx
  9. Agregar ruta pública /pagos/confirmacion al router
  10. src/components/settings/SportMapsPaySettings.tsx

DÍA 4 — Test end-to-end staging
  11. Probar con EPAYCO_TEST_MODE=true
  12. Verificar webhook con https://webhook.site
  13. Verificar idempotencia (enviar mismo webhook dos veces)
  14. Verificar expiración de links

SPRINT 2 (semana siguiente)
  - Columna Canal en PaymentsTable
  - Métricas dashboard (adopción digital)
  - Historial de transferencias en SportMapsPaySettings
  - WhatsApp de confirmación automático post-webhook
```

---

## LO QUE NUNCA DEBES TOCAR

```
❌ processPayment() para el método 'transfer' → no cambiar nada
❌ El flujo de subir comprobante (FileUpload) → intacto
❌ La lógica de awaiting_approval → intacto
❌ Las vistas de Supabase existentes (payments_with_installments, etc.)
❌ RLS existente de payments
❌ El wompiRouter existente en app.ts → no tocarlo
❌ authMiddleware.ts → no modificar
❌ Los schemas Zod de enrollments → no tocar
```

---

## CHECKLIST DE SEGURIDAD ANTES DE MERGE A STAGING

```
□ La firma SHA256 del webhook se valida en CADA request
□ La idempotencia se verifica por epayco_ref (UNIQUE en payment_splits)
□ El monto del webhook se verifica contra payment_links.gross_amount
□ Los links expirados (expires_at < now()) se rechazan
□ Los links ya pagados (status !== 'pending') se rechazan
□ EPAYCO_PRIVATE_KEY nunca aparece en logs ni en respuestas
□ El sessionId es temporal (expira con la sesión de ePayco)
□ La ruta /pagos/confirmacion no expone datos sensibles sin autenticación
□ paymentLimiter está aplicado en /create-session
□ El webhook no tiene rate limit (ePayco puede reintentar N veces)
```
