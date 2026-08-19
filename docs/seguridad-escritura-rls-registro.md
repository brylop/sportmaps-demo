# Registro de huecos de escritura en RLS — deben cerrarse y validarse

Última actualización: 2026-08-19

Este documento existe porque una migración entró a producción con una policy que dejaba a cualquier usuario autenticado escribir en cualquier escuela. No fue un descuido aislado: es el mismo patrón que ya está anotado como trampa 1 y 2 en el `CLAUDE.md` del repo y que el gate `npm run seguridad:invariantes` detecta solo.

**Regla, sin excepciones: ninguna migración que toque RLS, policies o permisos se da por cerrada sin correr el gate y dejar el resultado en el PR.** Que el SQL esté commiteado no significa que la regla esté viva; la fuente de verdad es la base.

```bash
npm run seguridad:invariantes
```

---

## 1. Lo que pasó el 2026-08-19

La migración `20260819142729_tactical_presets_p2.sql` (commit `f1f720d`, autor judegor99) creó `team_tactical_presets` con esta policy:

```sql
FOR INSERT WITH CHECK (school_id = ANY (public.user_school_ids()) OR created_by = auth.uid())
```

Dos fallas en una línea:

1. **La rama `OR created_by = auth.uid()` deja el `school_id` sin acotar.** Cualquier usuario autenticado —de cualquier escuela, con cualquier rol— insertaba filas en **cualquier** escuela con solo ponerse a sí mismo en `created_by`. Verificado evaluando el `WITH CHECK` con una sesión simulada contra una escuela ajena: daba `true`.
2. **`user_school_ids()` en policies de escritura** (invariante I2). Esa función incluye a padres y atletas, así que los familiares de la escuela podían modificar y borrar la táctica de cualquier equipo.

Además la tabla tenía `INSERT/UPDATE/DELETE/SELECT` concedidos a `anon` y las policies apuntaban a `public`, no a `authenticated`.

El BFF **sí** guardaba bien (`requireRole(TACTICAL_EDIT_ROLES)` = owner / super_admin / coach). Eso no salvó nada: la tabla es alcanzable por PostgREST directo con la anon key que el frontend ya tiene, así que el BFF no era el único camino. **Un guard en el BFF no sustituye a la policy.**

### Por qué no se vio en la revisión

La migración escribe las policies como *strings* dentro de un `EXECUTE` en un bloque `DO`, no como DDL plano. El patrón peligroso queda dentro de un literal y no salta a la vista leyendo el diff.

### Cerrado

Migración `20260819173354_cerrar_escritura_team_tactical_presets.sql`, aplicada por `apply_migration` (deja registro). Escritura pasa a `user_staff_school_ids()`, lectura queda en `user_school_ids()` acotada a `authenticated`, y se revocó todo a `anon`.

Radio medido antes de aplicar: 2 filas, 1 escuela, ninguna creada por alguien ajeno a su escuela — el hueco no alcanzó a usarse. Verificado después: la misma prueba que daba `true` ahora da `false`, `anon` quedó sin grants, y el coach real conserva escritura y lectura.

---

## 2. Lo que queda abierto: 60 policies `FOR ALL` sin `WITH CHECK`

`FOR ALL` sin `WITH CHECK` hace que PostgreSQL valide los INSERT con la expresión de `USING`. Si ese `USING` describe "mi fila" pero no acota el tenant, cualquiera se inserta donde quiera.

Agregar `WITH CHECK` igual al `USING` **no arregla nada** —es exactamente lo que Postgres ya hace por defecto—; hay que escribir un `WITH CHECK` que acote de verdad.

Triaje de las 60 contra la base viva:

| Clase | N | Estado |
|---|---|---|
| A — acotadas por escuela vía helper (`user_*_school_ids`, `is_school_admin`, `is_super_admin`) | 13 | **OK.** El `USING` ya acota el tenant; sirve como check de INSERT. |
| B — acotadas por rol o por dueño mediante `EXISTS`/`IN` sobre school_members, vendor_profiles, events, products | 32 | **OK.** La subconsulta acota la fila nueva. |
| C — fila propia, sin consecuencia de privilegio | 7 | **Aceptable.** Insertar "mi propia fila" es el flujo esperado. |
| D — **auto-adjudicación explotable** | 7 | **HAY QUE CERRARLAS.** Ver abajo. |
| E — `is_platform_admin()` | 1 | **OK.** |

### Las 7 que hay que cerrar

El patrón: el `USING` compara contra una columna **que el que inserta controla**. Poniéndose a sí mismo en esa columna, cualquiera crea filas sobre terceros.

| Tabla . policy | `USING` | Qué permite hoy |
|---|---|---|
| `health_records.health_records_professional_or_athlete` | `professional_id = auth.uid() OR athlete_id = auth.uid()` | Cualquiera escribe una **historia clínica** sobre CUALQUIER atleta poniéndose de profesional. Dato sensible de salud. |
| `wellness_evaluations.wellness_evaluations_professional_or_athlete` | ídem | Igual, sobre evaluaciones de bienestar. |
| `wellness_appointments.wellness_appointments_access` | `professional_id = auth.uid() OR athlete_id = auth.uid() OR (padre del menor)` | Cualquiera agenda citas a nombre de terceros. |
| `athlete_training_plans.atp_trainer_all` | `trainer_id = auth.uid()` | Cualquiera crea un plan de entrenamiento para CUALQUIER atleta nombrándose entrenador. |
| `event_organizers.organizer_manage_own_profile` | `profile_id = auth.uid()` | Cualquiera se da de alta como **organizador de eventos**. Escalada de rol. |
| `biomech_access_grants.bag_athlete_all` | `athlete_id = auth.uid()` | Tabla de **concesión de accesos**: confirmar si permite auto-otorgarse. |
| `skill_biomech_evidence.sbe_adder_all` | `added_by = auth.uid()` | Cualquiera agrega evidencia a la ficha de CUALQUIER atleta. |

**No las toqué en esta pasada, a propósito.** Cada una necesita que primero se confirme cuál es el camino de escritura legítimo —qué relación autoriza a un profesional a escribir sobre un atleta, qué habilita a alguien a ser organizador— y esa decisión es de producto, no se deduce del `USING`. Cerrarlas a ciegas deja sin operar a los módulos de bienestar, biomecánica y eventos. El `CLAUDE.md` pide plan aprobado antes de escribir migraciones y medir el radio antes de aplicar; esto es lo segundo pendiente, no una omisión.

Van como bloque propio, una policy por vez, con radio medido y verificación por sesión simulada.

---

## 3. Checklist obligatorio para cualquier migración con RLS

Antes de dar por cerrado el cambio:

- [ ] **Ninguna policy de escritura usa `user_school_ids()`.** Esa función incluye padres y atletas. Escritura operativa → `user_staff_school_ids()`. Lo que otorga permisos → `user_admin_school_ids()`.
- [ ] **Ningún `WITH CHECK` tiene una rama `OR <columna> = auth.uid()`** que deje el tenant sin acotar. Si el que inserta controla esa columna, no es un control.
- [ ] **Todo `FOR ALL` lleva `WITH CHECK` explícito**, y ese check acota el tenant — no es una copia del `USING`.
- [ ] **Las policies apuntan a `TO authenticated`**, no a `public`.
- [ ] **`REVOKE ALL … FROM anon`** en tablas nuevas. Los default privileges del esquema vuelven a otorgar; revocar de `PUBLIC` no alcanza.
- [ ] **Los helpers van envueltos en `(SELECT fn())::uuid[]`** para que Postgres los evalúe una vez por query y no una por fila. Ojo: `ANY ((SELECT fn()))` sin el cast se parsea como subconsulta y falla con `operator does not exist: uuid = uuid[]`.
- [ ] **Se listaron TODAS las policies de la tabla.** Son permisivas y se suman con `OR`: endurecer cuatro no sirve si queda una quinta abierta.
- [ ] **Se corrió `npm run seguridad:invariantes`** y el resultado va en el PR.
- [ ] **Se aplicó por `apply_migration` o el CLI**, no pegando SQL en el editor de Supabase. Lo que se corre desde el editor no queda en `schema_migrations` y vuelve indistinguible lo aplicado de lo que nunca corrió.
- [ ] **Se verificó contra la base viva**, no contra el repo:

```sql
select cmd, policyname, roles, qual, with_check from pg_policies where tablename = '…';

-- prueba definitiva: simular la sesión y evaluar el check con un tenant ajeno
select set_config('request.jwt.claims', json_build_object('sub','<uuid>','role','authenticated')::text, true);
select '<escuela-ajena>'::uuid = ANY ((SELECT public.user_staff_school_ids())::uuid[]);  -- debe dar false
```

### Y una nota sobre cómo se escriben

Escribir policies como strings dentro de un `EXECUTE` en un bloque `DO` esconde el patrón peligroso dentro de un literal y lo saca del alcance de la revisión y de cualquier grep. **Preferir DDL plano** (`CREATE POLICY …`) salvo que haya una razón concreta para generarlo dinámicamente.

---

## 4. Recordatorio sobre el alcance de las tres funciones

```
user_school_ids()        → CUALQUIER miembro activo, padres y atletas incluidos.  Solo LECTURA.
user_staff_school_ids()  → quien TRABAJA en la escuela (sin parent/athlete).      Escritura operativa.
user_admin_school_ids()  → administración (sin coaches).                          Lo que OTORGA permisos.
```

Si un permiso permite otorgar permisos, no se delega.
