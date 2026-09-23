# Auditoría de seguridad — 2026-08-14

Registro de lo encontrado, lo corregido y lo que queda. Las **reglas** para no
repetirlo están en `CLAUDE.md`; este documento es la **evidencia y el pendiente**.

Todo se verificó contra la base viva, no contra el repo.

---

## Cómo apareció

Ninguno de estos hallazgos salió de leer código. Salieron de consultar
`pg_policies` y de ejecutar consultas **como el rol `anon`**, que es lo que
puede hacer cualquiera con la llave anónima que viaja en el bundle del frontend.

El disparador fue una pregunta lateral: al construir el branding del PWA se
revisó qué gates existían, y de ahí se tiró del hilo.

---

## 1. Escaladas de privilegios (corregidas)

`user_school_ids()` devuelve toda escuela donde el usuario esté en
`school_members` con `status='active'`, **sin mirar el rol**. Había 727 padres y
37 atletas activos ahí, y 44 policies se apoyaban solo en esa función.

| Migración | Qué permitía |
|---|---|
| `20260814184457` | Un padre insertaba una invitación con `role_to_assign='admin'`, la aceptaba y quedaba como administrador de su escuela. |
| `20260814184728` | **La peor.** `Staff manage themselves` era `FOR ALL USING (email = auth.email())` sin `WITH CHECK`. En `FOR ALL`, omitir `WITH CHECK` hace que el `USING` valide los INSERT — y esa expresión no menciona `school_id`. Cualquiera se insertaba en `school_staff` con su correo y el `school_id` de una escuela **ajena**; el fallback por email de `user_school_ids()` le daba acceso de miembro. |
| `20260814185120` | Padres y atletas podían borrar equipos, alterar alineaciones, resultados, métricas, sesiones de asistencia y recordatorios de pago. |

**La segunda apareció verificando la primera.** Las policies son permisivas y se
suman con `OR`: endurecer cuatro no sirve si queda una quinta abierta sobre la
misma tabla.

Se agregaron dos funciones de alcance (`user_staff_school_ids`,
`user_admin_school_ids`) — ver `CLAUDE.md` para cuál usar.

**Verificación:** padre → miembro sí, staff no, admin no. Coach → miembro sí,
staff sí, admin no.

---

## 2. Datos legibles por cualquiera en internet (corregidos)

| Tabla | Filas | Qué exponía | Migración |
|---|---|---|---|
| `school_settings` | **305** | `payment_accounts`, `bank_account_number`, `bank_titular_id` (cédula), `transfer_key`, `breb_key` | `20260814190601` |
| `payment_links` | 93 | `token` (toda la autenticación del link), montos, comisión por escuela | `20260813133108` |
| `school_staff` | 70 | nombre, correo y teléfono de entrenadores de todas las escuelas | `20260814185532` |
| `facility_reservations` | 60 | `user_id`, notas, precios, estado de pago | `20260814190138` |
| `demo_links` | 0* | `prospect_name`, `prospect_phone`, `prospect_email` — leads comerciales | `20260814190911` |

\* medía cero solo porque no había links de demo vigentes; volvía sola en cuanto
se generara uno.

**La de `school_settings` era la peor:** cualquiera podía listar a qué cuenta
bancaria cobra cada escuela de la plataforma.

Dos casos no se podían resolver borrando la policy, porque la web pública sí
necesita parte de esos datos. **RLS filtra filas, no columnas**, así que se
crearon vistas con lo publicable: `v_school_staff_publico` y
`v_school_settings_publico`.

**Verificación (ejecutando como `anon`):** las cinco en 0.

---

## 3. El problema de proceso

`20260813133108_cerrar_fuga_de_payment_links_a_anon.sql` estaba **commiteado
desde el día anterior** y nunca se había aplicado. El fix existía, revisado, y la
fuga seguía viva.

Al construir el detector apareció algo peor: **el registro de migraciones no
refleja la realidad**. Lo que se corre desde el SQL editor de Supabase cambia la
base sin escribir en `schema_migrations`. Hay ~82 migraciones que figuran "sin
registro" y en su mayoría **sí** están aplicadas — se comprobó con
`children_rls_solo_staff`, cuya policy existe.

De ahí salieron dos herramientas:

```bash
npm run migrations:pendientes    # candidatas a verificar, NO un veredicto
npm run seguridad:invariantes    # afirma las reglas contra la base viva
```

La segunda es la que importa: le pregunta a la base y sobrevive al SQL editor.
Habría detectado `payment_links` el mismo día.

---

## 4. Regresión silenciosa de un fix ya cerrado — `school_athletes` (2026-09-01)

El linter de Supabase (vía mail automático) volvió a marcar `public.school_athletes`
como `security_definer_view` — el mismo ERROR que la Fase 2 del
[plan de remediación del linter](analysis/SUPABASE_LINTER_REMEDIATION_PLAN.md) había
cerrado el 2026-05-11 (`20260511000012_school_athletes_security_invoker.sql`, con
testing explícito: *"Anon → ve 0 filas"*).

**Qué pasó:** un `CREATE OR REPLACE VIEW` no conserva los `reloptions` (como
`security_invoker`) si la nueva definición no los repite. La migración
`20260827144226_fix_school_athletes_enrollment_id_plan_only.sql` — un fix legítimo
de negocio (enrollment_id de atletas sin equipo) — hizo
`CREATE OR REPLACE VIEW public.school_athletes AS ...` sin repetir
`WITH (security_invoker = true)`, y eso revirtió la vista a `SECURITY DEFINER` de
facto. Nadie lo notó: no rompe nada visualmente, solo deja de aplicar RLS.

**Impacto medido en vivo (2026-09-01):** con `anon`/`authenticated` teniendo `SELECT`
sobre la vista por privilegio de esquema (nunca revocado), y la vista corriendo como
`postgres` (bypassa RLS de `children`/`payments`/`enrollments`/`profiles`),
**cualquiera sin login podía leer `medical_info`, `parent_email`, `parent_phone` y
`payment_status` de todos los niños de todas las escuelas**, durante los ~5 días
entre el 27-ago y el 1-sep.

**Ya estaba visto y no se cerró:** la migración del día anterior,
`20260831095348_cerrar_brechas_seg22_seg1_seg2.sql` (SEG-2), documentó el hallazgo
explícitamente ("sigue pendiente de resolver de verdad") pero lo dejó fuera de ese
lote.

**Fix:** `20260901112643_fix_school_athletes_security_invoker_regression.sql` —
misma vista, mismo SELECT, se repite `WITH (security_invoker = true)`. Verificado
en vivo con simulación de rol: `anon` → 0 filas / permission denied en las 3 ramas
del `UNION ALL`; admin real de una escuela → ve solo la suya (102/102, 0 de otras).

**El problema de proceso, otra vez:** esta es la **segunda** vez que
`school_athletes` pierde `security_invoker` sin que nada lo detecte —la primera fue
el drift de la migración `20260318124512` (nunca cubrió esta vista), la segunda fue
este `CREATE OR REPLACE` de agosto. Los 4 invariantes de `seguridad:invariantes`
(`I1`-`I4`) **no la habrían atrapado**: `I1` filtra por `c.relkind = 'r'` (solo
tablas) — una vista nunca aparece en `pg_policies`, así que el chequeo la ignora
por diseño. El único detector que existe para este tipo de hallazgo es el linter de
Supabase, que corre en su propio ciclo (mail, no CI, no pre-commit) y ya demostró
que un fix commiteado puede tardar días en aplicarse sin que nadie lo note (ver
sección 3, `payment_links`).

**`I6` implementado** en `invariantes_seguridad()` (migración
`20260901115207_invariante_i6_vistas_definer_expuestas.sql`) — vista en `public`
sin `security_invoker=true` con `GRANT SELECT` a `anon`/`authenticated`,
excluyendo las intencionales ya documentadas (`v_school_staff_publico`,
`v_school_settings_publico`). `npm run seguridad:invariantes` la atrapa desde
ahora sin depender del ciclo del linter.

### 4.1 — Al armar I6 aparecieron 4 vistas más con la misma fuga (2026-09-01)

La query de diagnóstico de I6 encontró **12 vistas** en el mismo estado que
`school_athletes` (definer de facto + GRANT a anon/authenticated), no solo la
del linter. 4 leen exactamente las mismas tablas ya endurecidas
(`children`/`payments`/`profiles`) **sin ningún filtro de escuela**:

| Vista | Qué exponía a `anon` | Consumidor |
|---|---|---|
| `students` | `medical_info`, `emergency_contact`, `parent_email`, `parent_phone` de todos los niños de todas las escuelas | 1 endpoint BFF con columnas que ya no coinciden (roto/muerto) + service_role, no afectado por el fix |
| `pending_payments` | Fila completa de `payments` (montos, `receipt_url`, `wompi_id`, nombres) de todo pago pending/overdue de toda la plataforma | Ninguno encontrado |
| `payments_with_installments` | Igual, con detalle de cuotas | Ninguno encontrado |
| `pending_athletes` | Nombre/teléfono/email de cualquier membresía `pending` en cualquier escuela | Ninguno encontrado |

**Fix:** `20260901114927_fix_security_invoker_students_payments_pending_views.sql`
— mismo patrón que `school_athletes`, `WITH (security_invoker=true)`, cero
cambios de columnas/lógica. Verificado en vivo: `anon` → 0 filas en las 4;
rol con privilegios de servicio (BFF) → 901 filas en `students`, sin cambios.

**Quedaron afuera de este lote (sensibilidad baja o ya intencionalmente
públicas), pendientes de una pasada dedicada:**

| Vista | Por qué se dejó para después |
|---|---|
| `school_public_profile`, `school_detail_view`, `school_ratings` | `schools`/`reviews`/`offerings`/`facilities` ya tienen policy de lectura pública propia (`USING(true)` o filtrada) — el bypass del definer probablemente no agrega exposición real, pero no se verificó columna por columna. |
| `teams_full_view`, `team_capacity`, `class_capacity`, `poll_sessions_summary` | Agregados/conteos, sin PII directa. |
| `public_staff` | Duplicado legacy de `v_school_staff_publico` (mismo propósito, le falta el filtro `status='active'` que el original sí tiene) — usado en vivo por `frontend/src/lib/api/schools.ts:129` para el perfil público de escuela. |

Estas 8 quedan **reportadas por `I6`** (no están en la lista de exclusión) hasta
que alguien las revise una por una y decida: excluir con `COMMENT` (como
`v_school_staff_publico`) o aplicarles el mismo `security_invoker=true`.

---

## Lo que queda pendiente

### Deuda que reporta `seguridad:invariantes`

- **I3 — 60 policies `FOR ALL` sin `WITH CHECK`.** Es la clase de bug que permitió
  entrar como staff a cualquier escuela. La mayoría son benignas (el `USING` ya
  acota por escuela), pero hay que revisarlas una por una: basta una cuyo `USING`
  describa "mi fila" sin acotar el tenant.
- **I4 — 1 `SECURITY DEFINER` sin `search_path`.**
- **I6 — 8 vistas reportadas, sin revisar una por una.** Ver sección 4.1:
  `school_public_profile`, `school_detail_view`, `school_ratings`,
  `teams_full_view`, `team_capacity`, `class_capacity`, `poll_sessions_summary`,
  `public_staff`. Bajo riesgo estimado, pero "estimado" no es "verificado".

### Sin revisar

- **Policies de `SELECT` entre roles autenticados.** Un padre ve cosas de su
  escuela que quizá no debería. Necesita criterio de producto: hay lecturas que
  **deben** quedar abiertas (equipos, ofertas, configuración de pago para saber a
  qué cuenta transferir).
- **Rutas `/admin/*` abiertas al rol `admin`,** que es rol de **escuela**, no de
  plataforma. Los RPCs de plataforma sí validan `is_super_admin()`, pero
  `/admin/users` y `/admin/analytics` consultan tablas directo y dependen de RLS.
  Hay 2 perfiles con `profiles.role = 'admin'`, uno de ellos admin de una escuela
  real. Además `admin` **no está** en el catálogo `public.roles`, que usa
  `school_admin`.
- **Buckets de Storage.** `school-assets` es público por diseño (logos, íconos),
  pero no se auditó qué otros buckets son públicos ni qué guardan. Los
  comprobantes de pago son fotos de transferencias con datos bancarios.
- **`auto_approve_payment`** no valida permisos por dentro. Hoy está contenida
  porque `authenticated` no tiene `EXECUTE` (solo `service_role`), pero depende
  del GRANT y no de una defensa propia.

### Decisión de producto abierta

El usuario quiere que **cada escuela configure qué puede cada rol**. Va **encima**
del piso de RLS, nunca en lugar de él: *si un permiso permite otorgar permisos, no
se delega*.

No existe tabla de permisos en la base (solo `roles` y `user_roles`); las matrices
que hay en el código son **código muerto**, porque el gate real es el BFF con
`service_role`, que salta RLS. Un módulo de permisos tiene que enforcar en los dos
planos o será decorativo como las actuales.

---

## Adenda 2026-09-17 — el fix de `identity-documents` de mayo nunca se aplicó

Este documento decía (sección de arriba) que faltaba auditar qué buckets de
Storage son públicos. Uno de ellos, `identity-documents`, **se creía cerrado**
desde `20260511000006_lock_down_identity_documents_bucket.sql` — y no lo estaba.

**Lo que se encontró**, mientras se depuraba por qué una migración nueva (fase 1
de `alta-atleta-por-foto-hoja-matricula.md`) no podía aplicar sus propias
policies de Storage:

- La policy `identity_docs_public_read` (`FOR SELECT TO public USING (bucket_id
  = 'identity-documents')`) **seguía viva**. `anon` tiene GRANT `SELECT` sobre
  `storage.objects` (el default de Supabase), así que cualquiera sin
  autenticar podía leer cédulas de menores, cédulas de acudientes y
  certificados de EPS. Vigente desde el 2026-05-11 hasta el 2026-09-17: **más
  de cuatro meses**.
- La causa: `20260511000006` envolvía el `DROP` de esa policy y el `CREATE` de
  sus dos reemplazos (`identity_docs_owner_read`, `identity_docs_staff_read`)
  dentro de un `DO $$ ... SET LOCAL ROLE supabase_storage_admin ... $$`,
  asumiendo que hacía falta esa membresía para tocar `storage.objects`. **No
  hacía falta**: verificado el 2026-09-17 que `postgres` puede hacer
  `DROP`/`CREATE POLICY` sobre `storage.objects` directamente en este
  proyecto. Pero como *ningún* rol disponible tiene membresía en
  `supabase_storage_admin` (`pg_has_role('postgres','supabase_storage_admin','MEMBER')`
  = `false`), el `DO` se saltaba con un `RAISE WARNING` silencioso cada vez
  que alguien corría esa migración, sin abortar nada — nadie lo notó porque el
  `UPDATE storage.buckets SET public = false` de la misma migración (que no
  vivía dentro del bloque bloqueado) sí se aplicó, y la URL pública corta dejó
  de funcionar. Eso se leyó como "ya quedó privado" sin verificar la policy.
- **Fix aplicado en caliente el 2026-09-17** (`DROP` de la abierta + `CREATE`
  de las dos de reemplazo, contenido idéntico al que `20260511000006` nunca
  logró aplicar) y formalizado en
  `20260917131156_fix_identity_docs_public_read_nunca_aplicado.sql`, sin el
  bloque de escalada — no hacía falta.

**Lección para el resto del repo:** cualquier migración con un `DO $$ ... IF
NOT pg_has_role(...) THEN RAISE WARNING ... RETURN; END IF; ...` que se haya
aplicado alguna vez merece una verificación posterior de que el contenido del
bloque **realmente** quedó en la base — un `RAISE WARNING` no falla el CI ni
bloquea el merge, así que una migración "aplicada exitosamente" puede no haber
hecho nada. `identity_docs_unregistered_admin_insert`/`_delete`
(`20260827170031`) usan el patrón directo sin escalada y sí se verificaron
vivas — es la prueba de que la escalada nunca hizo falta en este proyecto.

**Pendiente:** el TODO que ya traía `identity_docs_staff_read` sigue igual —
no restringe por escuela, cualquier staff de la plataforma puede leer
documentos de cualquier niño. Bajado de "crítico" (lectura anónima) a "medio"
(cross-tenant entre staff autenticado), pero sigue abierto.

---

## Adenda 2026-09-17 (2) — default privilege de funciones nunca cerrado (gemelo de `SEG-23`)

Auditando el piloto de agendamiento por equipo + banco de horas variable (ver
`docs/specs/agendamiento-equipo-banco-horas-variable.md`), verificado en vivo
que dos RPCs de banco de horas tenían `EXECUTE` otorgado a roles que no
debían:

- `get_or_open_hour_bank_period(uuid)` — `authenticated` en el ACL. La función
  no valida que el caller sea dueño del `enrollment_id` que recibe; con esto,
  cualquier usuario autenticado de cualquier escuela podía abrir o leer el
  `hour_bank_period` de una inscripción ajena.
- `auto_close_stale_hour_bank_visits()` — **`anon` y `authenticated`**. Sin
  parámetros, recorre y cierra todas las visitas abiertas de banco de horas de
  **todas las escuelas**; con `anon` en el ACL, cualquier visitante sin sesión
  podía dispararla a voluntad.

**Causa raíz:** ambas funciones habían sido revocadas correctamente por
`20260827174032_hour_bank_rpc_auth_y_autocierre_fix.sql` (`REVOKE ... FROM
authenticated; GRANT ... TO service_role`). Migraciones posteriores
(`20260905124655` y `20260915121329`) las recrearon con `CREATE OR REPLACE`
agregando solo `GRANT ... TO service_role`, sin revocar antes de
`anon`/`authenticated` — y `GRANT` es aditivo en Postgres, no pisa privilegios
existentes. Lo que los volvió a exponer fue un **default privilege del
esquema `public` nunca cerrado para funciones**: `pg_default_acl` con
`defaclrole=postgres, defaclobjtype='f'` otorga `EXECUTE` a
`anon`/`authenticated`/`service_role` en **toda función nueva** creada por
`postgres` (el rol de `apply_migration`). El equivalente para **tablas** ya se
había cerrado en `SEG-23` (2026-08-31, `20260831163530`) — el de funciones
quedó abierto sin que ninguna nota lo marcara pendiente.

**Corregido el 2026-09-17:**
- `20260917152141` — revoca `EXECUTE` de `anon`/`authenticated` en las dos
  funciones puntuales, deja solo `service_role`.
- `20260917152834` — cierra el default privilege de raíz para toda función
  futura (`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE
  ALL ON FUNCTIONS FROM anon, authenticated`), mismo patrón que `SEG-23`.
  Verificado empíricamente igual que aquella vez: función de prueba creada
  dentro de una transacción con `ROLLBACK`, quedó con `EXECUTE` solo para
  `service_role`/`postgres`.

**No es retroactivo.** El fix de raíz solo protege funciones creadas *después*
del 2026-09-17. **Pendiente real:** no se auditó el resto de funciones
`public` ya existentes en busca del mismo patrón (`GRANT ... TO service_role`
agregado sin `REVOKE` previo de anon/authenticated) — estas dos se encontraron
por estar en el camino de una feature que se estaba auditando, no por barrido
sistemático.

---

## Adenda 2026-09-22 — auditoría de pagos + GYM RM: dos huecos con plata real, sin corregir

Auditoría solicitada sobre arquitectura de pagos, RLS y todo lo relacionado con
GYM RM (bridge de torniquete). Se lanzaron tres pasadas de
`sm-security-auditor` (RLS/multi-tenancy, dinero/webhooks, GYM RM/secretos) y
cada hallazgo con dudas se verificó contra la base viva con Supabase MCP.

**Metodología — varios "críticos" reportados por los agentes resultaron ser
drift ya cerrado a mano en producción, nunca capturado en una migración:**
`is_super_admin()` en vivo es `select is_platform_admin()` (consulta
`platform_admins`, no `profiles.role` — el repo tiene una definición vieja sin
actualizar); el trigger `trg_profiles_guard_role`
(`profiles_guard_role_escalation()`) bloquea cualquier auto-asignación de rol
desde el cliente; `calculate_settlement`/`process_refund` (que el repo aún
tiene en migraciones viejas) **no existen** en la base — fueron reemplazadas
hace tiempo por `compute_settlements_for_order`/`request_refund` +
`approve_refund` + `complete_refund`, bien resguardadas. Ninguna de estas tres
cosas está documentada en ningún archivo del repo — quien audite este
documento contra el repo solo, sin consultar la base, llegaría a la
conclusión contraria.

De lo que sí quedó confirmado en vivo, dos siguen **abiertos, con dinero real
de por medio**:

### A. Cualquier admin de escuela puede redirigir los cobros de OTRA escuela a su propia cuenta

`bff/src/routes/payment-providers.routes.ts:394-412`:

```ts
async function isSchoolAuthorized(userId: string, schoolId: string): Promise<boolean> {
    if (await isAdminGlobal(userId)) return true;
    const { data: school } = await supabase.from('schools').select('owner_id').eq('id', schoolId).maybeSingle();
    if (school?.owner_id === userId) return true;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
    return profile?.role === 'school_admin' || profile?.role === 'owner';   // ← sin correlacionar con schoolId
}
```

`schoolId` sale de `req.params`, sin validar. La usan `GET /school/:schoolId`
(línea 77), `POST /school/:schoolId` (línea 129, escribe llaves de cobro vía
`upsert_school_provider`) y los `PATCH`/`DELETE` por id (líneas 290-347).

**No requiere ninguna escalación de privilegios.** `trg_profiles_guard_role`
está vivo y nadie se auto-asigna `role='school_admin'` — pero cualquier admin
**legítimo** de su propia escuela ya tiene ese rol en su perfil, y el chequeo
no distingue de qué escuela. Alcanza con `POST
/api/v1/payment-providers/school/<escuela ajena>` con sus propias llaves de
Wompi/MercadoPago para que los cobros de esa escuela empiecen a entrar a su
cuenta. Único freno: la escuela objetivo necesita tener el addon de pasarela
activo (`hasGatewayAddon`, línea 145) — es decir, exactamente las escuelas
que sí cobran en línea hoy (Dynasty entre ellas).

No es marketplace: es la conexión de pasarela que sostiene el cobro de
mensualidades, en producción, con familias pagando ahora mismo.

**Fix (no aplicado, ~1 línea):** reemplazar la última rama por algo que
cruce el `schoolId` recibido contra `user_admin_school_ids()` del actor,
igual que ya hace `school_payment_providers_admin_read` a nivel de RLS
(`school_id IN (SELECT unnest(user_admin_school_ids())) OR is_super_admin()`,
verificado en `pg_policies`). El resto de las 4 rutas que llaman a
`isSchoolAuthorized`/`isAdminGlobal` heredan el mismo fix.

### B. `release_settlements_all()` — cualquier autenticado libera TODOS los saldos pendientes de TODOS los vendors

Verificado en `pg_proc` de la base viva:
`proacl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`.
El cuerpo (`supabase/migrations/20260511000008_payouts_functions_unconditional.sql:56-131`)
no valida nada — recorre `SELECT DISTINCT vendor_profile_id FROM settlements
WHERE status='pending'` y llama `release_settlements_for_vendor` por cada
uno (esa sí está cerrada a `service_role` solamente, pero al ejecutarse
*dentro* de una función `SECURITY DEFINER` corre con los privilegios del
dueño, no los del caller — el `REVOKE` de la interna no protege nada aquí).

Sí es marketplace (`settlements`/`vendor_balances`/`vendor_payouts`, el
pipeline de pago a vendors). El módulo está mayormente sin desplegar, pero
`vendor_balances` ya tiene 30 filas reales — el radio de impacto crece con
cada venta que se procese mientras esto siga abierto.

**Fix (no aplicado):** `REVOKE EXECUTE ON FUNCTION public.release_settlements_all() FROM authenticated;`
(el BFF la invoca, si la invoca, con `service_role` — confirmar en
`vendor-payouts.routes.ts` antes de revocar).

### Encontrado en el mismo barrido, confirmado en vivo — C, D y E corregidos el mismo día (2026-09-22)

- **C. `identity_docs_staff_read`** ✅ **corregido y aplicado en vivo.**
  Migración `20260922223853_identity_docs_staff_read_scoped_por_escuela.sql`,
  reemplaza la policy sin acotar por dos policies (`identity_docs_unregistered_staff_read`,
  `identity_docs_children_staff_read`) que cruzan el path contra
  `unregistered_athletes`/`children` y exigen `is_school_admin(school_id)` de
  ESA escuela (o `is_super_admin()`). Verificado contra `pg_policies` tras
  aplicar. Reduce el alcance de 8 roles (incluía `coach`/`staff`/`organizer`)
  a `owner`/`admin`/`school_admin` — mismo scope que ya regía el INSERT/DELETE
  de estos documentos, así que no le saca acceso a nadie que ya pudiera subir
  o borrar. **Limitación conocida y documentada en la migración:** el formato
  legado de paths sin `child_id` (`children/{parent_id}/docs/...`, 32 de 59
  archivos) acota por padre, no por hijo — si un mismo padre tiene hijos en
  más de una escuela, un admin de cualquiera de esas escuelas ve toda la
  carpeta. El formato nuevo (con `child_id` en el path) ya no tiene ese
  problema. `npm run seguridad:invariantes` reconfirmado sin CRÍTICAS después
  del cambio.
- **D. Canal ADMS de torniquetes** ✅ **corregido en código** (`bff/src/routes/access-adms.ts`),
  **pendiente de desplegar a Render.**
  - `clientIp()` ahora usa `req.ip` (Express ya resuelve la IP real vía
    `trust proxy=1`, configurado en `index.ts` desde antes) en vez de tomar
    el primer valor de `X-Forwarded-For`, que el cliente controla. Esto hace
    que la allowlist (global y por-dispositivo) vuelva a ser una barrera de
    verdad el día que se active — hoy sigue en `ip_check_mode='off'` para
    las 6 `turnstile_devices` existentes, eso no cambió, sigue siendo una
    decisión operativa aparte.
  - `POST /iclock/devicecmd` ahora acota el `UPDATE` de `device_commands`
    con `.eq('device_id', device.id)` además del match por `cmd_seq`/`id` —
    ya no se puede marcar como `executed` el comando de otra escuela con
    solo mandar un `ID` numérico y un SN válido cualquiera.
  - **No corregido en esta pasada:** el canal ATTLOG sigue sin autenticación
    criptográfica real (el protocolo del dispositivo no la soporta); la
    mitigación sigue siendo la IP, ahora al menos confiable. Evaluar
    `ip_check_mode='enforce'` por escuela requiere antes confirmar que el
    `ip_address` guardado en cada `turnstile_devices` coincide con la IP
    pública real de esa escuela — no se hizo en esta pasada para no
    bloquear un dispositivo real por una IP desactualizada.
- **E. WebSocket del bridge (`bridgeWsServer.ts`)** ✅ **corregido en código,
  sin desplegar (igual que antes de esta pasada).**
  - Ya no acepta cualquier `school_id`: antes de autenticar, valida que la
    escuela declarada tenga al menos un `turnstile_devices.has_local_bridge=true`
    (verificado contra GYM RM: sí lo tiene, el fix no la bloquea el día que
    se despliegue). Decisión explícita (con el usuario, 2026-09-22): se
    mantiene la API key global compartida entre escuelas — una key por
    escuela se evaluó y se descartó por el costo operativo de rotarla en
    cada PC física; **este es el residual conocido**, alguien con la key
    filtrada de una escuela con bridge sigue pudiendo autenticarse, aunque
    ya no puede declarar un `school_id` ajeno o inventado.
  - `maxPayload: 8192` (antes: default de `ws`, ~100 MiB).
  - Límite de intentos de auth fallidos por IP (20 cada 5 min) antes de
    cortar la conexión — sin esto cada reconexión era un intento gratis de
    fuerza bruta contra `BRIDGE_API_KEY`.
  - Un socket ya autenticado ya no puede re-autenticarse con otro
    `school_id` (antes quedaba registrado en varias escuelas a la vez).
  - `POST /bridge/door-commands/:id/ack` acepta ahora un `school_id`
    opcional y, si viene, acota el `UPDATE` a esa escuela — opcional a
    propósito: los bridges ya desplegados (Dreamers, y GYM RM en su versión
    HTTP previa) no lo mandan y no hay forma de redesplegarlos desde acá.
    `scripts/gymrm-door-bridge/door_bridge.py` (todavía sin subir a la PC
    física de GYM RM) ya se actualizó para mandarlo — el día que se
    redespliegue ese script, GYM RM queda cerrado en este punto. Dreamers
    sigue abierto hasta que su script se actualice igual (fuera del
    alcance de esta pasada).
- **F. `unblock_payment` y `admin_generate_pending_payouts`** ✅ **corregidos
  y aplicados en la base viva** (migración `20260922224444_unblock_payment_y_payouts_usan_is_platform_admin.sql`).
  Ambas dejaron de leer `profiles.role = 'admin'` y ahora usan
  `is_platform_admin()` — mismo patrón que las 16 tablas migradas en
  `20260824165639`. De paso, `admin_generate_pending_payouts` quedó con el
  `search_path` estándar del repo (`pg_catalog, public, pg_temp`; antes solo
  `public`). Verificado en vivo: ninguna de las dos menciona ya
  `profiles.role` en su definición (`pg_get_functiondef`), y
  `seguridad:invariantes` sigue sin CRÍTICAS.

**Pendiente:** A y B (el hallazgo de pagos/marketplace de más arriba) no
tienen migración/PR asociado todavía — quedan como los dos riesgos más
grandes sin cerrar de esta sesión. C, F y G ya están aplicados en la base
viva. D y E son cambios de código en el working tree de `develop`, sin
commitear ni desplegar a Render al cierre de esta sesión.

### G. Barrido sistemático del patrón — 4 funciones más, mismo día

Corrido el `grep` sobre `pg_get_functiondef()` de todo `pg_proc` en busca del
mismo patrón (`profiles.role = 'admin'` / `role IN ('admin','super_admin')`
como atajo de plataforma). Cuatro resultados además de F, los cuatro
corregidos en la misma migración (`20260922224730_barrido_profiles_role_admin_resto_de_rpcs.sql`):

- **`is_admin()`** — mismo patrón que `is_super_admin()`, ahora delega en
  `is_platform_admin()`. Sin consumidores hoy (ni policies ni otras
  funciones la llaman), pero su ACL incluía `anon` **y** `authenticated` —
  quedaba lista para que alguien la conectara sin revisar el cuerpo.
- **`_glosa_actor_is_admin(p_actor, p_school_id)`** — gatea 5 RPCs de dinero
  (`create_glosa`, `resolve_glosa`, `conciliate_glosa`, `reopen_glosa`,
  `reconcile_statement`). Tenía una rama correcta (`school_members` acotada
  por escuela) y una global sin acotar — cualquier cuenta con
  `role IN ('admin','super_admin')` podía resolver una glosa de CUALQUIER
  escuela. Corrección con un matiz: esta función recibe el actor como
  **parámetro** (`p_actor`), no vía `auth.uid()` — se invoca con el cliente
  `service_role` y el actor ya resuelto en el BFF. Por eso el fix no pudo
  ser `is_platform_admin()` (que mira `auth.uid()` de la sesión, siempre
  NULL en ese camino) — se inlineó el chequeo contra `platform_admins`
  parametrizado por `p_actor`.
- **`approve_refund(p_refund_id)`** — misma familia que `unblock_payment`
  (usa `auth.uid()` directo), mismo fix. Tenía además un SEGUNDO bug del
  mismo tipo en su propia rama de pagos: `v_actor_role IN ('school_admin','owner')`
  sin correlacionar con la escuela del pago — cualquier `school_admin` de
  cualquier escuela podía aprobar el reembolso de un pago de otra. Corregido
  con `is_school_admin(s.id)`. **Nota funcional aparte** (no es hallazgo de
  seguridad): el único caller conocido
  (`bff/src/routes/marketplace-checkout.routes.ts:654`) invoca con el
  cliente `supabase` del BFF, que es siempre `service_role`
  (`bff/src/config/supabase.ts`) — `auth.uid()` ahí es `NULL`, así que hoy
  esta RPC devuelve `unauthenticated` en cada llamada real, sea cual sea el
  chequeo de rol. El fix no la revive ni la rompe más: queda correcta para
  el día que se conecte con el JWT del usuario (mismo bug de fondo que
  `vendor_payout_summary`/`request_payout`, ya anotado en la Adenda de
  pagos/GYM RM de más arriba).
- **`tg_notify_super_admin_on_upgrade_request()`** — no es un gate de
  autorización, es un trigger que solo manda notificaciones. Notificaba a
  `profiles.role='admin'` en vez de a `platform_admins`; corregido por
  consistencia (si alguna escuela real tuviera ese rol, sus dueños hubieran
  empezado a recibir solicitudes de upgrade de OTRAS escuelas — molesto, no
  un hueco de seguridad).

Reconfirmado tras el barrido: `select proname from pg_proc where
pg_get_functiondef(oid) ~* 'profiles\.role\s*=\s*''admin'''` — **cero
resultados** en todo `public`. `seguridad:invariantes` sigue sin CRÍTICAS.
