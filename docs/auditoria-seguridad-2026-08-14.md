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

## Lo que queda pendiente

### Deuda que reporta `seguridad:invariantes`

- **I3 — 60 policies `FOR ALL` sin `WITH CHECK`.** Es la clase de bug que permitió
  entrar como staff a cualquier escuela. La mayoría son benignas (el `USING` ya
  acota por escuela), pero hay que revisarlas una por una: basta una cuyo `USING`
  describa "mi fila" sin acotar el tenant.
- **I4 — 1 `SECURITY DEFINER` sin `search_path`.**

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
