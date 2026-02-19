# 🚦 GAP ANALYSIS: Demo Actual → MVP Multitenant Funcional
> **Fecha:** 2026-02-18  
> **Base:** Propuesta técnica SportMaps SaaS + Análisis del repositorio actual  
> **Objetivo:** Identificar qué falta exactamente para que el MVP sea funcional y multitenant

---

## 📊 ESTADO ACTUAL vs. REQUERIDO (Resumen Ejecutivo)

| Área | Estado Actual | Requerido MVP | Brecha | Prioridad |
|------|--------------|--------------|--------|-----------|
| **UI/UX Frontend** | ✅ 85% | 70% | ✅ Superado | — |
| **Auth / Sesión** | ✅ 90% | 90% | ✅ OK | — |
| **Onboarding por roles** | ✅ 85% | 80% | ✅ OK | Menor ajuste |
| **Multitenancy (RLS)** | 🔴 10% | 100% | 🔴 CRÍTICO | P0 |
| **Schema DB unificado** | 🔴 30% | 100% | 🔴 CRÍTICO | P0 |
| **Backend CRUD real** | 🟡 40% | 80% | 🔴 CRÍTICO | P0 |
| **Pagos reales** | 🟡 30% | 70% | 🔴 CRÍTICO | P1 |
| **Notificaciones** | 🔴 5% | 50% | 🟡 IMPORTANTE | P2 |
| **Testing** | 🔴 5% | 60% | 🟡 IMPORTANTE | P2 |
| **CI/CD** | 🟡 20% | 80% | 🟡 IMPORTANTE | P2 |
| **Observabilidad** | 🔴 0% | 60% | 🟢 POST-MVP | P3 |
| **Backups** | 🔴 0% | 80% | 🟡 IMPORTANTE | P2 |
| **Mobile nativo** | 🔴 5% | 40% | 🟢 POST-MVP | P3 |

---

## 🔴 P0 — BLOQUEADORES CRÍTICOS (Sin esto el MVP NO es válido)

### GAP 1: Multitenancy Real — RLS Policies NO están activas

**Qué dice la propuesta:** Schema-per-tenant con PostgreSQL; RLS como mecanismo de aislamiento.

**Estado actual:**
- El `database_schema.sql` (en raíz) tiene RLS DISEÑADO pero **nunca fue ejecutado en Supabase Cloud**.
- El schema real (`remote_schema.sql`) NO tiene las RLS policies activas.
- `useSchoolContext.ts` resuelve la escuela por `school_members` (bien diseñado), PERO sin RLS en BD cualquier usuario puede hacer queries directos sin restricción.
- La anon key está hardcoded como fallback en `client.ts`.

**Consecuencia:** Un usuario malintencionado que tenga la anon key puede leer datos de CUALQUIER escuela via REST de Supabase.

**Qué falta:**
```sql
-- 1. Activar RLS en cada tabla principal
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 2. Crear políticas por tabla (patrón via school_members)
-- Ejemplo para children:
CREATE POLICY "school members see own children"
ON children FOR SELECT
USING (
  school_id IN (
    SELECT school_id FROM school_members
    WHERE profile_id = auth.uid() AND status = 'active'
  )
  OR parent_id = auth.uid()
);
```

**Esfuerzo estimado:** 3-4 días (escritura + prueba de cada policy)

---

### GAP 2: Esquema de BD Consolidado — Tres fuentes de verdad

**Estado actual:**
- `database_schema.sql` (raíz): Schema "ideal", nunca ejecutado
- Schema real en Supabase Cloud: parcialmente diferente (usa `children` no `students`, campos distintos)
- `frontend/src/integrations/supabase/types.ts`: Tipos generados del schema real
- Backend Python (`server.py`): Usa MongoDB para sus rutas (¡un tercer sistema!)

**Inconsistencias concretas encontradas en el código:**
```
CÓDIGO ACTUAL                     vs    SCHEMA IDEAL
─────────────────────────────────────────────────────
students API → tabla 'children'        → 'students' (en database_schema.sql)
programs.price_monthly                 → programs.price (en schema real)
attendance_records.student_id          → attendance.student_id 
payments sin branch_id en schema real  → payments.branch_id (en useDashboardStatsReal.ts línea 72)
school_settings tabla (usada en hook)  → ¿existe en schema real? Sin confirmar
programs.coach_id                      → coach no está como FK confirmada
```

**Qué falta:**
1. Ejecutar migración única que consolide el schema real con el ideal
2. Agregar las columnas faltantes: `branch_id` en `payments`, `status` en `children`, `coach_id` en `programs`
3. Crear la vista `students` (que ya existe en el código como `from('students')`) apuntando a `children`
4. Regenerar tipos TypeScript: `npx supabase gen types typescript --project-id <id> > types.ts`

**Esfuerzo estimado:** 2-3 días

---

### GAP 3: Backend Python/MongoDB — Arquitectura Paralela Inactiva

**Estado actual:**
- `backend/server.py` existe pero `backend/routes/` está vacío (solo `__init__.py`)
- El código en `PROGRESO_IMPLEMENTACION.md` menciona rutas en MongoDB, pero esas rutas ya no existen
- Todo el CRUD real se hace DIRECTAMENTE desde el frontend via Supabase SDK
- `lib/api/students.ts`, `lib/api/classes.ts`, etc. → llaman directamente a Supabase

**Decisión necesaria:** El backend Python ya no es relevante por el momento. La arquitectura elegida es **Supabase-first** (frontend → Supabase directo). El backend Python debería:
- Eliminarse O
- Reservarse SOLO para: webhooks de pago, envío de emails, generación de PDFs

**Lo que SÍ hace falta en backend (mínimo para MVP):**
```
Edge Function o FastAPI endpoint para:
├── POST /webhooks/wompi     → Confirmar pagos (NO puede hacerse client-side)
├── POST /api/emails/send    → Envío de emails (Resend/SendGrid)
└── POST /api/reports/pdf    → Generación de reportes PDF (opcional MVP)
```

**Esfuerzo estimado:** 1-2 días (solo webhooks y emails)

---

### GAP 4: Credenciales de Producción Hardcodeadas

**Estado actual en `client.ts`:**
```typescript
const PRODUCTION_SUPABASE_URL = 'https://luebjarufsiadojhvxgi.supabase.co'; // HARDCODED
const PRODUCTION_SUPABASE_KEY = 'eyJhbGci...'; // HARDCODED en código fuente
```

**En `wompi.ts`:**
```typescript
const WOMPI_INTEGRITY_SECRET = 'test_integrity_LrN9ny6kwmMjrrT6FHcBcLG7Xab1lOBe'; // ⚠️ No debe ir al cliente
```

**Qué falta:**
- Mover TODAS las credenciales a `.env` (ya existe `.env.example` o similar)
- El `WOMPI_INTEGRITY_SECRET` NUNCA debe existir en el cliente → mover a Edge Function
- Configurar variables de entorno en Vercel correctamente

**Esfuerzo estimado:** 0.5 días

---

## 🟡 P1 — FLUJOS CORE INCOMPLETOS (MVP no funciona sin esto)

### GAP 5: Pagos Integrados — Wompi en Sandbox, No en Producción

**Estado actual:**
- `lib/api/wompi.ts`: Integración con Wompi Widget ✅ (bien implementado)
- Usa claves de SANDBOX. Para producción necesita claves reales.
- La firma de integridad se genera CLIENT-SIDE (fallback) → **inseguro en producción**
- No hay webhook handler para confirmar pagos automáticamente
- Los pagos SE REGISTRAN en Supabase pero NO se verifican via webhook

**Falta para producción:**
```
1. Endpoint backend: POST /webhooks/wompi
   - Verifica firma HMAC del webhook
   - Actualiza payment.status = 'paid' en Supabase
   - Envía email de confirmación al padre
   
2. PSE (pasarela local) — mencionada en propuesta, NO implementada
   - ePayco / Kushki / Mercadopago Colombia
   - Requiere integración adicional

3. Pagos recurrentes — mencionados en propuesta, NO implementados
   - Cobro automático mensual
   - Requiere job scheduler (pg_cron o Supabase Cron Jobs - beta)
```

**Esfuerzo estimado:** 3-5 días

---

### GAP 6: Notificaciones — Sin implementar

**Estado actual:**
- `useRealtime.ts` existe (2421 bytes) — posiblemente setup básico
- No hay push notifications implementadas
- No hay sistema de email automático funcional (solo el cliente email en `email-client.ts`)
- La tabla `notifications` existe en el schema

**Propuesta requiere:** WhatsApp/email/push

**Falta para MVP básico:**
```
1. Email transaccional (Resend/SendGrid):
   ✅ email-client.ts existe, pero sin backend real detrás
   → Falta: Edge Function que envíe emails reales

2. Push Notifications (Web):
   → Falta: Service Worker con Web Push API
   → Tabla notifications: poblar desde triggers DB

3. WhatsApp (post-MVP):
   → Twilio o Meta Business API
   → Mayor complejidad, diferir
```

**Esfuerzo estimado:** 2-3 días (email básico + notificaciones in-app)

---

### GAP 7: Enrollment UI — Backend listo, Frontend incompleto

**Estado actual** (según `PROGRESO_IMPLEMENTACION.md`):
- Backend de enrollment: ✅ 80% (enroll/unenroll endpoints)
- Frontend UI de enrollment: ⏳ PENDIENTE
- Modal para asignar estudiantes a clases: NO existe

**Falta:**
- Modal/página para inscribir un estudiante a un programa
- Vista de "estudiantes inscritos en este programa"
- Cambio de programa (reasignación)
- Cancelación con lógica de reembolso

**Esfuerzo estimado:** 1-2 días

---

### GAP 8: Asistencia — Flujo básico incompleto

**Estado actual:**
- `useDashboardStatsReal.ts` lee `attendance_records` (tabla existe)
- `CoachAttendancePage.tsx` existe como página
- No está claro si el guardado de asistencia funciona end-to-end

**Falta:**
- Verificar que el guardado de asistencia funcione con el schema real
- Reporte de asistencia por estudiante/mes
- Vista del padre: asistencia de su hijo (la página existe pero ¿datos reales?)

**Esfuerzo estimado:** 1-2 días

---

## 🟡 P2 — CALIDAD Y OPERACIONES (Para MVP estable)

### GAP 9: Testing — Prácticamente inexistente

**Estado actual:**
- Playwright configurado (`tests/` directorio)
- Vitest configurado (ver `package.json`)
- 0 tests unitarios ejecutables
- Los tests E2E del "Golden Path" se documentaron pero no ejecutan contra UI real

**Propuesta requiere:** Testing de restore + UAT

**Falta para MVP mínimo:**
```
Tests críticos a implementar:
1. E2E: Login → Onboarding Escuela → Crear estudiante → Inscribir → Pago
2. E2E: Login padre → Ver hijo → Ver pagos → Hacer pago
3. E2E: Login coach → Tomar asistencia → Ver reporte
4. Unit: RLS policies (via supabase test / pgTAP)
5. Integration: Webhook Wompi → actualización de pago
```

**Esfuerzo estimado:** 3-4 días

---

### GAP 10: CI/CD — Básico pero sin calidad automática

**Estado actual:**
- `.github/` existe (directorio) — posiblemente hay workflow
- Vercel deploy configurado a mano
- No hay pipeline de lint + type-check + tests automáticos

**Falta:**
```yaml
# .github/workflows/ci.yml
- Lint check (ESLint)
- Type check (tsc --noEmit)  
- Unit tests (vitest)
- E2E tests en PR (Playwright + staging)
- Auto-deploy a staging en merge a develop
- Auto-deploy a prod en merge a main
- DB migrations automáticas (supabase db push)
```

**Esfuerzo estimado:** 1-2 días

---

### GAP 11: Backups y Restore

**Estado actual:** No implementado. Supabase Cloud hace backups automáticos en plan Pro.

**Propuesta requiere:** Backups + pruebas de restore

**Falta:**
```
1. Plan Pro de Supabase (backups diarios automáticos) — ¿ya están en Pro?
2. Script de restore documentado y probado
3. Backup de Storage (fotos, logos) → S3 backup o Supabase Storage redundancy
4. Runbook: "Cómo restaurar la BD en caso de desastre"
```

**Esfuerzo estimado:** 1 día (si ya están en plan Pro)

---

### GAP 12: Observabilidad

**Estado actual:** 0% implementado.

**Propuesta requiere:** Observabilidad completa.

**Falta para MVP:**
```
1. Error tracking: Sentry (frontend + edge functions)
   → npm install @sentry/react
   → 30 minutos de setup

2. Logging: Supabase tiene logs básicos en el dashboard
   → Para logs avanzados: Axiom o Logflare (integra con Supabase)

3. Métricas: Vercel Analytics (ya incluido) + Supabase Dashboard
   → Para métricas custom: PostHog (open source)

4. Alertas: Uptime robot o Better Uptime para monitorear disponibilidad
```

**Esfuerzo estimado:** 1-2 días

---

### GAP 13: Roles y ABAC — Incompleto

**Estado actual:**
- `permissions.ts` tiene RBAC bien diseñado
- Los roles están correctos en Supabase
- PERO: No hay verificación de permisos ABAC servidor-side (solo client-side)

**Propuesta requiere:** RBAC por tenant + ABAC para reglas finas

**Ejemplo de gap:**
- Un padre debería ver SOLO sus propios hijos → Actualmente esto lo controla RLS (pero RLS no está activa)
- Un coach debería ver SOLO los estudiantes de sus clases → Sin RLS esto no está garantizado

**Falta:**
```sql
-- Policy ABAC: Padre solo ve sus hijos
CREATE POLICY "parents see own children"
ON children FOR SELECT
USING (parent_id = auth.uid());

-- Policy ABAC: Coach solo ve estudiantes de sus clases
CREATE POLICY "coaches see enrolled students"
ON children FOR SELECT
USING (
  id IN (
    SELECT e.profile_id FROM enrollments e
    JOIN programs p ON p.id = e.program_id
    WHERE p.coach_id = auth.uid()
  )
  OR
  school_id IN (
    SELECT school_id FROM school_members
    WHERE profile_id = auth.uid() AND role IN ('admin', 'owner')
  )
);
```

---

## 🟢 P3 — POST-MVP (Después del lanzamiento inicial)

### GAP 14: Mobile Nativo — Flutter en estado embrionario

**Estado actual:**
- `mobile/` directorio existe
- `mobile/analysis_options.yaml` existe → solo configuración linting
- NO hay código Flutter funcional

**Propuesta requiere:** Mobile nativo (Flutter)

**Evaluación:** Para el MVP web, esto puede diferirse. El web responsive ya existe.  
El mobile nativo es para la siguiente fase.

---

### GAP 15: Geolocalización

**Estado actual:**
- `schools.lat / schools.lng` existen en el schema → ✅
- `ExplorePage` puede mostrar mapa (si usa Google Maps / Mapbox)
- No está claro si el mapa de exploración funciona con datos reales

**Propuesta requiere:** Integración de geolocalización

**Falta:**
- API key de Google Maps o Mapbox integrada vía env var
- Verificar que `ExplorePage` usa coordenadas reales de la BD

**Esfuerzo estimado:** 0.5 días

---

### GAP 16: Code Splitting — Performance

**Estado actual:**
- 78+ páginas importadas estáticamente en `App.tsx`
- Bundle ~2.3MB sin code splitting

**Falta:**
```typescript
// Cambiar imports estáticos a lazy:
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
// + <Suspense fallback={<PageLoader />}> envolviendo rutas
```

**Esfuerzo estimado:** 2-3 horas

---

## 📋 ROADMAP PRIORIZADO (Orden de ejecución recomendado)

```
SEMANA 1-2: Fundamentos (P0)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] 1. Decidir schema definitivo → crear migración SQL unificada
[ ] 2. Ejecutar migración en Supabase Cloud (staging primero)
[ ] 3. Implementar RLS Policies en TODAS las tablas
[ ] 4. Regenerar types TypeScript desde schema real
[ ] 5. Mover credenciales a .env (Supabase URL/Key, Wompi secrets)
[ ] 6. Eliminar backend Python de rutas CRUD (ya no relevante)

SEMANA 3: Flujos Core (P1)
━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] 7. Implementar webhook Wompi → Edge Function (confirmar pagos)
[ ] 8. Enrollment UI (modal inscribir estudiante a programa)
[ ] 9. Verificar flujo completo de asistencia (CoachAttendancePage → BD)
[ ] 10. Notificaciones in-app básicas (tabla notifications + feed)

SEMANA 4: Calidad (P2)
━━━━━━━━━━━━━━━━━━━━━━
[ ] 11. Tests E2E: 3 flujos críticos (Playwright)
[ ] 12. GitHub Actions CI pipeline (lint + typecheck + tests)
[ ] 13. Sentry para error tracking (frontend)
[ ] 14. Verificar/configurar backups en Supabase Pro
[ ] 15. Code splitting (React.lazy) en App.tsx

POST-MVP (P3)
━━━━━━━━━━━━━
[ ] Flutter mobile nativo
[ ] PSE / ePayco Colombia
[ ] Pagos recurrentes automáticos
[ ] WhatsApp notifications
[ ] Multi-región Supabase
```

---

## 💡 DECISIONES ARQUITECTÓNICAS PENDIENTES

| Decisión | Opción Recomendada | Razón |
|----------|-------------------|-------|
| **¿Qué hacer con backend Python?** | Conservar SOLO para webhooks + emails | El CRUD ya se hace via Supabase SDK |
| **¿NestJS o continuar con Python?** | Supabase Edge Functions (Deno/TS) | Misma stack que frontend, sin servidor que mantener |
| **¿Auth0 o Keycloak?** | Mantener Supabase Auth | Ya funciona, reemplazar agrega meses de trabajo |
| **¿Schema-per-tenant?** | Row-Level (actual) con RLS | Suficiente para primeros 100-500 tenants |
| **¿Stripe o Wompi?** | Wompi (ya integrado) + PSE | Mercado colombiano, ya está parcialmente hecho |

---

## ✅ LO QUE YA ESTÁ BIEN (No tocar)

| Componente | Estado | Notas |
|------------|--------|-------|
| Supabase Auth (JWT) | ✅ Funcional | AuthContext bien implementado |
| `useSchoolContext` | ✅ Bien diseñado | Resuelve por `school_members`, soporta multi-escuela |
| Onboarding por roles | ✅ Implementado | 7 flujos de onboarding completos |
| UI/UX (78 páginas) | ✅ Excelente | Diseño premium, shadcn/ui + Tailwind |
| Wompi Widget | ✅ Integrado | Solo falta mover firma a servidor |
| `studentsAPI` | ✅ Funcional | CRUD completo contra Supabase |
| `classesAPI` | ✅ Funcional | CRUD completo, enrollment parcial |
| RBAC `permissions.ts` | ✅ Bien diseñado | Falta aplicar server-side via RLS |
| Vercel deploy | ✅ Configurado | CI/CD básico funciona |
| `school_members` tabla | ✅ Existe y se usa | Base correcta para multitenancy |

---

## 🎯 DEFINICIÓN DE "MVP FUNCIONAL MULTITENANT"

El MVP estará listo cuando:

1. **Un usuario puede registrarse como escuela** → crear su escuela → invitar coaches y padres
2. **Los datos de cada escuela son INVISIBLES para otras escuelas** (RLS activo)
3. **Un coach puede tomar asistencia** de sus clases
4. **Un padre puede pagar online** (Wompi) y ver el historial de pagos de sus hijos
5. **Un padre recibe un email** cuando se registra su hijo o cuando hay un pago pendiente
6. **Zero datos mock** en cualquier página para usuarios reales
7. **La firma de integridad de Wompi** se genera server-side
8. **Al menos 3 tests E2E automáticos** pasan en CI antes de cada deploy

---

*Generado por análisis profundo del repositorio · SportMaps · 2026-02-18*
