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
