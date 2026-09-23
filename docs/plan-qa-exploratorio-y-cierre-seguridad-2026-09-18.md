# Plan — Cierre de QA exploratorio (4 roles) + auditoría de seguridad

## Estado (actualizado 2026-09-21)

**Cerrado y verificado en vivo contra staging:**
- Fase 0 (revertir Sofía Mesa) ✅
- Fase 1 (fuga de asistencia entre disciplinas, `attendance.ts`) ✅
- Fase 2 (banners PWA: push/update usaban sessionStorage o no persistían) ✅
- Fase 3 completa: crash de `/notifications` con `payment_reminder` ✅, KPI "Pendientes" no contaba `overdue` ✅, "Mi estado de cuenta" código muerto para atleta ✅
- Extra (no estaba en el plan original, salió de triar `get_advisors`):
  - **Crítico**: `fn_delete_self_assigned_session`, `fn_unassign_gym_session`, `fn_create_plan_from_routine` — identidad como parámetro sin contrastar contra `auth.uid()`, permitía suplantar a cualquier usuario por REST directo. Fix con `auth.role()` para no romper el llamado legítimo del BFF (que usa `service_role`, donde `auth.uid()` es `NULL` — el primer intento de fix rompía esto, corregido en la misma sesión antes de dejarlo aplicado).
  - **Crítico**: `unblock_payment` — un school_admin/owner de CUALQUIER escuela podía desbloquear pagos de OTRA (rol global sin acotar por escuela). Fix con `is_school_admin(school_id)`.
  - **Medio**: 5 funciones de enumeración de organigrama (`get_user_school_ids`, `get_user_admin_school_ids`, `has_school_role`, `is_branch_admin`, `get_personal_trainer_school_id`) sin caller legítimo (ni en código ni en policies) — `REVOKE EXECUTE` de anon/authenticated. `is_school_admin_of` (sí usada en 2 policies reales) blindada para solo confiar en `p_uid` si es el propio caller o super_admin.
  - `pg_net` en schema `public` (WARN del linter): **no se corrigió** — requiere `DROP`/`CREATE EXTENSION` que arriesga los crons de billing/notificaciones en una base compartida; el riesgo de la corrección es mayor que el WARN cosmético.
  - `auth_leaked_password_protection`: toggle manual pendiente en el dashboard de Supabase (Authentication → Policies), no accionable por API/MCP.

**Ronda 2 de seguridad (2026-09-21), vía SQL directo sobre `pg_proc` en vez de revisar función por función:**
- Mismo patrón encontrado otra vez en `fn_cancel_pt_session` y `fn_complete_session_plan` (identidad como parámetro sin `auth.uid()`) — mismo fix con `auth.role()`.
- Regresión de GRANT descubierta: `provision_personal_trainer_workspace` y `release_settlements_for_vendor` ya habían sido revocadas de anon/authenticated en `20260513000005_linter_fase3bcd_revoke_rpcs.sql` (mayo), pero el linter las vuelve a ver abiertas — mismo patrón de regresión silenciosa que ya afectó a `school_athletes` (vistas, agosto): `CREATE OR REPLACE FUNCTION` reabre `EXECUTE` a PUBLIC si no se repite el `REVOKE`. Vueltas a cerrar. Sin caller real en frontend/bff para ninguna de las dos.
- Las 5 funciones de la ronda 1 quedaron con `EXECUTE` abierto a `anon` de más (nunca hace falta, todas exigen identidad) — revocado.

**Pendiente:**
- Fase 4 y 5 (medios/bajos de la ronda de QA: 500 en `my-registrations`, cifras de Finanzas/Reporter Dashboard en $0, spinners infinitos, ruido de consola, etc.)
- Fase 6.3-6.6 (rutas `/admin/*`, buckets de Storage, `auto_approve_payment`, policies cross-rol) — necesitan criterio de producto
- Del triage de `get_advisors`: 333 funciones `authenticated_security_definer_function_executable` sin revisar cuerpo por cuerpo (mismo patrón de "identidad como parámetro" podría repetirse — recomendado pasar el mismo grep antes de cerrar el capítulo), 64 "ambiguas" del lado `anon` sin verificar, y `get_school_payment_info` (expone cuenta bancaria completa a público si la escuela activó perfil público — decisión de producto, no bug).
- Specs de Playwright de la ronda de QA (`frontend/e2e/qa-discovery/`) siguen sin commitear — decidir si quedan como regresión o se descartan.


Fecha: 2026-09-18. Origen: ronda de QA con 4 agentes en paralelo (padre, atleta,
entrenador, owner) contra "Club Campestre Demo" en staging
(`luebjarufsiadojhvxgi` + `bffdev.sportmaps.co`), más una revisión en vivo de
`docs/auditoria-seguridad-2026-08-14.md` con `npm run seguridad:invariantes`.

Specs y evidencia de la ronda: `frontend/e2e/qa-discovery/` (no commiteados
todavía — decidir si se quedan como regresión o se botan al cerrar cada bug).

---

## Fase 0 — Incidente de datos (bloquea todo lo demás)

**Pendiente de confirmación del usuario.** Un agente de QA ejecutó sin querer
una baja real mientras probaba el flujo "inactivar atleta" en `/students`
(faltaba el diálogo de confirmación intermedio que si existe en otros flujos).

Confirmado en la base viva (staging):
- `children.id 8cef8cee-97b7-4a9c-8815-9b60d6845956` ("Sofía Mesa") →
  `is_active = false` desde 2026-09-18 15:05:07.
- `enrollments.id 643c7518-749f-4924-9311-4aa0109ef0c5` → `status = cancelled`,
  mismo instante.
- `payments.id e141e841-aad0-4bd6-b06a-a64e37e25a5a` ($210.000) →
  `status = cancelled`, mismo instante.

**Acción:** reactivar los 3 registros (UPDATE puntual, no migración — es dato,
no esquema) en cuanto el usuario confirme.

---

## Fase 1 — Seguridad CRÍTICA (bloqueante de release, no solo de esta ronda)

### 1.1 Fuga de datos entre disciplinas en asistencia por "offering"

`bff/src/routes/attendance.ts`. `assertCoachHasTeamAccess()` protege el camino
por `teamId` en tres endpoints, pero el camino por `offeringId` no tiene
ningún chequeo de pertenencia:

| Endpoint | Línea aprox. | Falta |
|---|---|---|
| `GET /roster/:contextType/:contextId` | ~884-900 | valida solo si `contextType==='team'` |
| `POST /walk-in` | ~1521-1536 | valida solo si viene `teamId` |
| `POST /session` | ~1300-1340 | valida solo si `teamId` o la sesión existente tiene `team_id`; una sesión de `offering` tiene `team_id = null` |

Confirmado en vivo: Felipe (coach Tenis) abrió el roster completo de Natación
(nombres, mensualidad, estado de pago); Laura, el de Tenis, en simétrico.
Riesgo real: probablemente también permite **escribir** asistencia de atletas
ajenos (no se probó el submit para no contaminar datos).

**Plan de fix:**
1. Escribir un test que reproduzca la fuga contra un `offeringId` real de
   otra disciplina (base para `qa-fix-verifier` después).
2. Resolver, para un `offeringId`, a qué `team_id`/coach(es) pertenece
   (`offering_coaches` o el camino equivalente) y aplicar el mismo gate que
   ya existe para `teamId` en los 3 endpoints.
3. Correr `entrenador-followup.spec.ts` (ya escrito en esta ronda) contra el
   fix para confirmar que Felipe ya NO puede abrir el roster de Natación.
4. Repetir el barrido en el resto de `attendance.ts` por si hay más
   endpoints con el mismo patrón `teamId` sí / `offeringId` no (buscar todas
   las llamadas a `assertCoachHasTeamAccess`).

Esto no es exclusivo de la escuela demo — es código compartido, afecta a
cualquier escuela real con más de un coach/disciplina. Prioridad #1.

---

## Fase 2 — Banners PWA que reaparecen tras cerrarlos

Confirmado en código (no solo reportado por el usuario), y es el mismo
patrón para los 3:

| Banner | Archivo | Qué falla |
|---|---|---|
| Push / activar notificaciones | `frontend/src/components/PushPermissionBanner.tsx` | Guarda el dismiss en `sessionStorage` (`sm_push_banner_dismissed`... ver `DISMISSED_KEY`) → se olvida al cerrar pestaña/navegador, a diferencia de `InstallBanner` que sí usa `localStorage`. |
| Actualizar app | `frontend/src/pwa/UpdateBanner.tsx` | **Cero persistencia**: solo escucha `pwa:update-available` y hace `setShow(true)`; al cerrar con la X vuelve a `setShow(false)` sin guardar nada. Si `register.ts` vuelve a disparar el evento (cada `focus`/`visibilitychange` corre `reg.update()`, throttle 60s), el banner reaparece aunque el usuario ya lo haya cerrado para esa misma versión. |
| Instalar app | `frontend/src/pwa/InstallBanner.tsx` | Ya usa `localStorage` (`sm_install_dismissed`) — es el patrón correcto, referencia para los otros dos. |

**Plan de fix:**
1. `PushPermissionBanner.tsx`: cambiar `sessionStorage` → `localStorage` para
   `DISMISSED_KEY`, mismo patrón que `InstallBanner`. Decidir si el dismiss es
   permanente o con cooldown (ej. volver a preguntar en N días) — por defecto,
   permanente como el de instalar.
2. `UpdateBanner.tsx`: agregar guard persistente. Como cada actualización real
   sí debe notificarse (a diferencia de push/install que es "no molestar
   más"), la clave debe incluir algo que identifique LA versión ofrecida
   (ej. el `scriptURL`/hash del SW, o simplemente una key en `sessionStorage`
   que se limpia en cada carga real de página — así "cerrar" dura lo que dura
   la pestaña, pero no se repite en cada `focus` dentro de la misma sesión).
   Ojo: no usar `localStorage` acá sin cuidado, o un usuario que cierre el
   aviso podría quedarse en una versión vieja indefinidamente sin saberlo.

---

## Fase 3 — Hallazgos ALTOS del resto de la ronda

1. **`/notifications` crashea con tipo `payment_reminder`**
   (`frontend/src/pages/NotificationsPage.tsx:45-53,189-201`) — `getIcon()`/
   `getIconColor()` no mapean ese tipo, `Icon` queda `undefined`, React tira
   "Element type is invalid" y el ErrorBoundary global tumba toda la página.
   Fix: ícono/color por defecto para tipos no mapeados. Agnóstico de rol —
   aplica a los 4.
2. **KPI "Pendientes" en Mis Pagos del atleta muestra $0 con cobros vencidos
   reales en la lista** (Daniel Ospina, mora real). El resumen usa
   `summary.count_pending`/`total_pending` del backend
   (`AthletePaymentsPage.tsx:184`); el bug está en cómo el backend arma ese
   agregado vs. cómo etiqueta cada fila — falta rastrear en el servicio de
   pagos qué query arma `summary` y por qué no cuenta los `Pendiente`
   visibles.
3. **"Mi estado de cuenta" es inalcanzable para el atleta** — código muerto:
   `MyPaymentsPage.tsx:649-655` gatea el link a `role==='athlete'`, pero el
   `useEffect` de la misma página (líneas 169-170) redirige a cualquier
   `role !== 'parent'` ANTES de llegar a ese bloque. Y `AthletePaymentsPage.tsx`
   (la página real del atleta) no tiene ningún link a `/estado-cuenta`. Decidir:
   ¿se agrega el link real en `AthletePaymentsPage`, o se borra el bloque
   muerto de `MyPaymentsPage`? (probablemente ambas cosas).

---

## Fase 4 — Hallazgos MEDIOS

1. `GET /api/v1/events/my-registrations/list` → 500 en `bffdev` (BFF, no
   frontend). Reproducido para padre y atleta.
2. Cifras de ingresos NO cuadran para el owner: Pagos/Contabilidad coinciden
   en $39.010.000, pero **Finanzas** (`/finances`) y el **Reporter Dashboard**
   (el que usa el rol de solo-lectura de finanzas) muestran **$0 en todo**.
   Antes de tratarlo como bug de cálculo, confirmar que no es solo un estado
   de carga sin resolver (recargar esas dos rutas con más tiempo de espera).
3. `/attendance-history` (owner) — spinner infinito sin mensaje de error;
   causa probable: `GET facility_reservations?...&status=eq.confirmed` → 400.
4. `/training-plans` (owner) — mismo patrón de carga que no resuelve/spinner
   genérico, confirmar con más tiempo antes de clasificar como bug real.
5. Comprobante de Tomás Herrera ($50.000, notificado 8-sep) no aparece en la
   cola "Cobros por Aprobar" — confirmar contra la base si sigue pendiente.

---

## Fase 5 — Hallazgos BAJOS / cosméticos (batch, sin prisa)

- WhatsApp `GET /whatsapp/{school_id}/plantillas` → 404 cuando no hay
  WhatsApp conectado (debería ser 200 con lista vacía).
- Ruido de consola: `DashboardPage.tsx:209` "Failed to fetch" en onboarding
  status; `StatsPage.tsx:37` key duplicada de React; 400 en
  `wellness_appointments` por un `select` anidado.
- Naming ambiguo "Planes" (dashboard cuenta tarifas, `/offerings` cuenta
  planes-padre) — aclarar el label.
- No hay UI de administración para `school_signup_leads` (el owner no tiene
  dónde ver a sus prospectos) — evaluar si se construye o se documenta como
  gap conocido.
- Egresos/proveedores en $0 todo 2026 en el módulo contable — parece dato de
  seed, no bug; el "resultado neto" que muestra es engañoso si nadie carga
  gastos.

---

## Fase 6 — Auditoría de seguridad: cerrar lo pendiente de `auditoria-seguridad-2026-08-14.md`

Corrí `npm run seguridad:invariantes` en vivo hoy (2026-09-18) para no fiarme
del documento de hace un mes. Estado actual real:

```
Sin violaciones CRÍTICAS.
🟠 ALTA — 60
  I3_for_all_sin_with_check (52)
  I6_vista_definer_expuesta (8)
```

`I4` (SECURITY DEFINER sin search_path) ya no aparece — quedó resuelto desde
el documento de agosto. Falta cerrar:

1. **I6 — 8 vistas** (`teams_full_view`, `school_detail_view`,
   `school_public_profile`, `school_ratings`, `class_capacity`,
   `public_staff`, `team_capacity`, `poll_sessions_summary`): revisar una por
   una qué columnas exponen sin `security_invoker`. El documento de agosto ya
   adelantó el criterio: si la tabla de base ya tiene policy pública
   equivalente, excluir con `COMMENT` (como `v_school_staff_publico`); si no,
   aplicar `security_invoker=true`. `public_staff` en particular es un
   duplicado legacy de `v_school_staff_publico` sin el filtro
   `status='active'` — candidato a eliminar en vez de arreglar, si
   `frontend/src/lib/api/schools.ts:129` puede migrarse al original.
2. **I3 — 52 policies `FOR ALL` sin `WITH CHECK`**: revisar una por una si el
   `USING` ya acota por escuela/tenant (benigna) o describe "mi fila" sin
   acotar tenant (el mismo patrón que causó la escalada de agosto). Empezar
   por las que tocan dinero o PII: `payment_tokens.payment_tokens_owner_all`,
   `reservation_payments.rp_school*`, `attendance.attendance_admin_all`,
   `attendance_records.attendance_records_admin_all`,
   `health_records.health_records_professional_or_athlete`,
   `academic_progress.academic_progress_admin_all`.
3. **Rutas `/admin/*`** — siguen dependiendo de RLS directo en vez de
   `is_super_admin()`; `admin` no está en el catálogo `public.roles`
   (usa `school_admin`). Decidir si se migra el único admin de escuela real
   a `school_admin` y se cierra `/admin/*` a solo `platform_admins`.
4. **Buckets de Storage** — solo se auditó `identity-documents` (cerrado
   2026-09-17). Falta revisar el resto (comprobantes de pago, documentos de
   staff, etc.) con el mismo método: ver policy + `anon` GRANT en
   `storage.objects`.
5. **`auto_approve_payment`** — sigue sin validar permisos por dentro, solo
   contenida por el GRANT a `service_role`. Agregar chequeo propio de rol.
6. **Policies de SELECT entre roles autenticados** ("un padre ve cosas de su
   escuela que quizá no debería") — necesita criterio de producto antes de
   tocar código, está marcado como "sin revisar" desde agosto.
7. **Decisión de producto abierta**: módulo de permisos configurable por
   escuela — va ENCIMA del piso de RLS, nunca en lugar de él. Sin tabla de
   permisos en la base todavía; las matrices en frontend son código muerto
   porque el BFF con `service_role` salta RLS. Esto es un proyecto aparte,
   no un "cierre" de esta auditoría — lo dejo fuera del alcance de esta
   ronda salvo que el usuario diga lo contrario.

---

## Orden de ejecución sugerido

1. Fase 0 (revertir dato) — bloqueante, un UPDATE, apenas se confirme.
2. Fase 1 (fuga de asistencia) — crítico de seguridad, primero que cualquier
   feature o bug de UX.
3. Fase 6.1-6.2 (I6 vistas + I3 policies de dinero/PII) — mismo tipo de
   riesgo que la Fase 1, mejor agruparlas en la misma pasada de seguridad.
4. Fase 2 (banners PWA) — rápido, bajo riesgo, alto valor percibido por el
   usuario (es la queja que disparó este plan).
5. Fase 3 (altos de UX/datos) — uno por uno, con su propio commit.
6. Fase 4 y 5 — batch, sin apuro.
7. Fase 6.3-6.6 (admin/*, storage, auto_approve_payment, policies
   cross-rol) — requieren más criterio de producto, se agendan aparte.

Cada fix de RLS/policies se revisa línea por línea antes de aplicar (regla
del repo) y se verifica contra la base viva con `npm run seguridad:invariantes`
después, no solo se asume por el diff.
