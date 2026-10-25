# Entrenador y Deportista V2 — decisiones y contratos de construcción

**Estado:** aprobado por el usuario el 2026-10-25 (decisiones abajo). Construcción en paralelo por agentes; este documento es el contrato común. Diseño: lienzo `CGQozXBXP91kJn7YNF5Cs4`, páginas «V2 · Entrenador definitivo» (`Coa*.dc.html`) y «V2 · Deportista definitivo» (`Dep*.dc.html`). Patrón ya construido: acudiente V2 (`frontend/src/components/parent/v2/`, `docs/specs/modulos-v2-definicion.md`).

---

## 1. Decisiones del usuario (2026-10-25)

**Entrenador**
1. Mensajes, Anuncios y Encuestas **se quedan en «Más»** (no se pierde nada de producción).
2. Lista con **4 estados en un botón que rota**: Vino → Faltó → Excusa → Tarde. Todos arrancan en «Vino».
3. El **profe publica el informe mensual si la escuela se lo permite** (la escuela decide; ya existe «Quién publica y envía»).
4. La convocatoria **pide «Va / No va»** a la familia.
5. El profe **no ve plata**: solo el estado de pago de cada deportista: **Al día · Pendiente · Vencido**. Sin montos, sin conceptos.

**Deportista (rol `athlete`)**

6. El deportista **mayor de edad paga lo suyo** (pagos propios, `user_id` = él). El menor con cuenta **no paga**: lo paga su acudiente. Cuidado: el rol es `athlete` en los dos casos; se distingue por la edad (`profiles.date_of_birth` ≥ 18 años) y por si tiene cobros a su nombre.
7. La **racha** cuenta **entrenos asistidos seguidos** (de `attendance_records`), no autoevaluaciones.
8. La convocatoria la **responde el deportista si es mayor; si es menor, su acudiente**.
9. **Informes y felicitaciones los ven los dos**: el deportista (si tiene cuenta) y su acudiente.

**Reglas que heredan de la V2 del acudiente:** ningún módulo de producción se pierde («Más» los recoge); todo en 2–3 toques; celular primero con tokens de `docs/design-tokens.md`; claro y oscuro; español de Colombia de «tú», sin voseo, palabras de V2Palabras; carga/vacío/error distintos; un interruptor de reversa por rol.

---

## 2. Interruptores de reversa

`frontend/src/lib/feature-flags.ts`:
- `ENTRENADOR_V2 = import.meta.env.VITE_ENTRENADOR_V2 !== 'false'`
- `DEPORTISTA_V2 = import.meta.env.VITE_DEPORTISTA_V2 !== 'false'`

Con `false` vuelve exactamente lo de antes (barra, menú y pantallas). Las pantallas que se rehacen en su lugar dejan una copia `*Classic.tsx` intacta, como `MyPaymentsPageClassic`.

---

## 3. Base de datos (un solo agente escribe las migraciones; NO las aplica)

Reglas: migraciones nuevas con `npm run migrations:new -- <slug>` y `migrations:sync`; `text + CHECK` para estados; FKs a `profiles(id)`; RPC `SECURITY DEFINER` con `SET search_path = pg_catalog, public, pg_temp` y `GRANT EXECUTE … TO authenticated` explícito (y `REVOKE` de `anon`/`PUBLIC`); escritura operativa con `user_staff_school_ids()`, nunca `user_school_ids()`; sin self-recursion en RLS; `FOR ALL` siempre con `WITH CHECK`. Las aplica la sesión principal, una sola vez, tras revisar.

| # | Pieza | Contrato |
|---|---|---|
| B1 | Felicitaciones | Tabla `athlete_kudos` (id, school_id, child_id NULL, athlete_user_id NULL, unregistered_athlete_id NULL — exactamente uno —, coach_id → profiles, message text CHECK 1..200, created_at). RPC `give_kudos(p_school_id uuid, p_child_id uuid, p_athlete_user_id uuid, p_message text) returns uuid`: el que llama es staff de esa escuela; el deportista pertenece a la escuela; máximo 1 por deportista por día (error `KUDOS_DAILY_LIMIT`); inserta y crea `notifications` para el acudiente del menor y para el deportista con cuenta. RPC `list_kudos(p_child_id uuid, p_athlete_user_id uuid, p_limit int default 20)` → id, message, coach_name, created_at: la ve el acudiente del hijo, el propio deportista y el staff. |
| B2 | Convocatoria con respuesta | Tabla `match_callup_responses` (lineup_id → match_lineups, child_id NULL / athlete_user_id NULL / unregistered NULL, response text CHECK ('va','no_va'), responded_by → profiles, responded_at, UNIQUE por lineup+deportista). RPC `respond_callup(p_lineup_id uuid, p_child_id uuid, p_athlete_user_id uuid, p_response text)`: responde el **deportista mayor** por sí mismo o el **acudiente** del menor (decisión 8). RPC `my_callups()` → convocatorias futuras de mis hijos y mías, con partido (rival, fecha, hora, lugar, nota) y mi respuesta. RPC `callup_status(p_lineup_id uuid)` → por convocado: nombre, respuesta o null (para el profe). Al guardar la convocatoria (`save_match_roster`, nueva versión `CREATE OR REPLACE`) se crea una `notification` por familia/deportista convocado (y otra si cambia), `category = 'match'`. |
| B3 | Estado de pago para el profe | RPC `team_payment_status(p_team_id uuid)` → athlete_key, estado text ('al_dia','pendiente','vencido'). **Sin montos ni conceptos.** Solo staff de la escuela del equipo. Vencido = algún cobro `overdue` o `pending` con vencimiento pasado; pendiente = algún `pending`/`partial` no vencido; si no, al día. |
| B4 | Informes para el deportista | Que el deportista con cuenta (`subject_type='profile'`, `subject_id = auth.uid()`) lea sus `athlete_reports` publicados y su informe del entreno, por las mismas RPC de lectura que usa el acudiente (revisar `20260801093452_athlete_reports_rpcs_read.sql`). |
| B5 | Título de avisos de calendario | El aviso dice «📅 Nuevo entrenamiento: PARTIDO LIGA…» para partidos: usar el tipo real del evento. Encontrar el trigger/función que lo arma y corregirlo. |
| B6 | Informe mensual por el profe | Confirmar que, con el permiso de la escuela («Quién publica y envía» = cada entrenador), el coach puede publicar y enviar los suyos (hoy «Publicar» del informe grupal falla para el coach; IDOR conocido en `bff/src/routes/reports.ts:661-680`: arreglarlo). |

Hasta que se apliquen, el frontend llama estas RPC con manejo de error: si la función no existe (PGRST202 / 404), la sección se oculta sin romper la pantalla.

---

## 4. Quién toca qué (para no pisarse)

| Dueño | Archivos |
|---|---|
| Sesión principal | `App.tsx`, `config/navigation.ts`, `components/navigation/**`, `layouts/AuthLayout.tsx`, `lib/feature-flags.ts`, `lib/acudienteTabs.ts` → `lib/v2Tabs.ts`, `DashboardPage.tsx`, `CalendarPage.tsx`, aplicar migraciones |
| Agente BD | `supabase/migrations/*` nuevas + `migrations_ledger.json`, `bff/**` solo para B6, `frontend/src/lib/api/v2Contratos.ts` (funciones tipadas que llaman B1–B4) |
| Agente Entrenador A | `frontend/src/components/coach/v2/` Hoy, Equipos (Deportistas con estado de pago, Partidos y convocatorias), Evaluar + Felicitar |
| Agente Entrenador B | `frontend/src/components/coach/v2/` Asistencia (lista sin señal), Sesiones (Hoy · Semana · Plan del mes, modo cancha), Más del entrenador |
| Agente Deportista | `frontend/src/components/athlete/v2/` Hoy, Entrenos, Progreso, Carnet, Más, Pagos del adulto |

Las pantallas V2 se exportan como componentes; la sesión principal las conecta a las rutas y a la barra.

---

## 5. Barras

- Entrenador: **Hoy · Equipos · Sesiones · Asistencia · Más**.
- Deportista: **Hoy · Entrenos · Progreso · Carnet · Más**. Pagos del adulto en «Más» y en Hoy cuando debe.
