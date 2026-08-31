# Trampas técnicas de este repo

Cosas que ya costaron horas y que no se deducen leyendo el código. Las
**reglas obligatorias** están en `CLAUDE.md`; esto es el mapa de minas.

Deliberadamente **sin** datos de clientes, montos, credenciales ni nombres de
escuelas: eso vive en otro lado y no corresponde versionarlo.

---

## Base de datos

### Una sola Supabase para todo

`dev`, `staging` y producción apuntan a **la misma base**. No hay sandbox.

Escribir con la service key toca datos reales. Un script "de prueba" corre
contra producción. Tenerlo presente antes de cualquier `UPDATE` masivo.

### `payments.status` es `TEXT`, no el enum

Existe un tipo `pay_status`, pero la columna **no** lo usa. Castear a
`::pay_status` dentro de un `CASE` rompe. Usar literales pelados.

Es el motivo por el que la convención del repo es `text + CHECK` en tablas
nuevas y **no** `CREATE TYPE`.

### `enrollments.status` también es `TEXT`

Y **no** existe el valor `pending_payment` que a veces se asume. Además hay un
constraint XOR entre `user_id` y `child_id`: una inscripción es de un adulto o
de un menor, nunca de los dos.

### El catálogo de roles usa `school_admin`, no `admin`

`public.roles` no contiene `admin`. Pero `profiles.role` sí tiene perfiles con
ese valor, y `school_members.role` lo usa legítimamente para "admin **de esa
escuela**".

Son dos cosas distintas y confundirlas abre rutas de plataforma a gente de una
escuela. Al mapear roles, **nunca degradar a `athlete`** por defecto.

### Dos tablas de planes que no son lo mismo

| Tabla | Qué es |
|---|---|
| `school_subscriptions` | Lo que la escuela le paga **a SportMaps** |
| `subscription_plans` | **Deprecada** para escuela→familias desde 2026-08 (commits `f300860a`, `c6a024c0`). Sigue viva solo para `vendor_profiles` (trainers/wellness/stores), vía la policy `sub_plans_owner` |

`offering_plans` es la que el producto lee de verdad para las cuotas de
escuela — escribir solo en `subscription_plans` hace que el plan no aparezca
en ningún lado. `COMMENT ON TABLE` actualizado en la migración
`20260829011715`, verificado en vivo el 2026-08-29 (comentario anterior
estaba en `NULL`, no reflejaba la migración de mayo que se supone lo ponía).

### `apply_migration` (MCP) nunca usa el timestamp del archivo — siempre pone "ahora"

La herramienta MCP `apply_migration` de Supabase genera su propia versión en
`supabase_migrations.schema_migrations` al momento de correr, sin importar qué
timestamp lleve el nombre del `.sql` del repo o el comentario dentro del
archivo. Aplicar el archivo `20260821112428_algo.sql` puede terminar
registrado como `20260821130357` — versión distinta, mismo DDL. Confirmado en
vivo: pasó dos veces en la misma tarde, una vez con dos sesiones corriendo el
mismo cambio en paralelo, y otra conmigo mismo aplicando un archivo ya
reservado en el ledger.

Consecuencia práctica: si el DDL ya se aplicó una vez (por otra sesión, o por
vos mismo con otro nombre), reintentar `apply_migration` con el archivo del
repo **truena** — `column/relation already exists` — porque Postgres no sabe
nada de nombres de archivo, solo del objeto que ya existe. No es un bug que
arreglar; el esquema ya quedó en el estado correcto. Antes de reintentar algo
que "debería estar pendiente", confirmar contra la base (`to_regclass`,
`information_schema.columns`, o `select version, name from
supabase_migrations.schema_migrations order by version desc limit 10`) en vez
de asumir por el ledger del repo.

Mismo problema con cambios de **datos** (un `INSERT`/`UPDATE` puntual) corridos
vía `apply_migration`: quedan en `schema_migrations` con nombre y versión
propios, sin ningún `.sql` que los respalde en `supabase/migrations/` si nadie
commitea el archivo correspondiente. `npm run migrations:check` no lo detecta
— solo valida los archivos que SÍ están en el repo. El repo y
`schema_migrations` son dos historias que hay que cruzar a mano cuando algo no
cuadra, nunca asumir que una implica la otra.

### `school_athletes.enrollment_id` era `NULL` para atletas de plan sin equipo

La vista trae `enrollment_id` del lateral `te` (inscripción **con equipo**, `team_id IS NOT NULL`)
— el lateral `pe` (inscripción **con plan**) nunca seleccionaba `e.id`. Cualquier atleta inscrito
solo en un plan, sin equipo (el caso normal en escuelas tipo academia, no una rareza), tenía
`plan_name` correcto pero `enrollment_id` en `NULL`. Corregido 2026-08-27 con
`COALESCE(te.enrollment_id, pe.enrollment_id)` en las 3 ramas del `UNION ALL`
(`20260827144226_fix_school_athletes_enrollment_id_plan_only.sql`). Si algo lee
`school_athletes.enrollment_id` y sale `NULL` para un atleta que sí tiene plan activo, ya no
debería pasar — pero si aparece de nuevo, es la misma clase de bug.

### El monto que paga un atleta tiene precedencia

```
enrollments.monthly_fee  →  offering_plans.price  →  teams.price_monthly
```

Cualquier lector que se salte ese orden muestra un número distinto al que se
cobra.

### `payment_type` no es fiable

Una mensualidad pagada puede venir marcada como `one_time`. Para deduplicar o
clasificar, mirar el **concepto**, no ese campo.

### Borrar un usuario: referencias escondidas

Hay FKs que no se ven venir: `school_staff.coach_auth_id` y
`storage.objects.owner`. Borrar `profiles` a mano **antes** que el resto.

---

## RLS y permisos

Las reglas están en `CLAUDE.md`. Acá van las de **rendimiento**, que son otra
clase de problema:

### Los helpers sin envolver se ejecutan por fila

Una función `STABLE` pelada en el `USING` de una policy se evalúa **una vez por
fila**. Envolverla en `(SELECT fn())` hace que Postgres la evalúe una sola vez.

Al medirlo, **0 de ~74 sitios** lo hacían. En tablas grandes eso multiplica el
costo por el número de filas.

### `ALTER POLICY` no evita el lock

Cambiar una policy toma `ACCESS EXCLUSIVE` sobre la tabla igual que
`DROP + CREATE`. En una tabla caliente, planificarlo.

### Vistas con `LATERAL` no se pueden podar

`school_athletes` es una vista con 12 `LATERAL`. El planner no puede empujar
los filtros hacia adentro, así que cualquier consulta materializa mucho más de
lo que necesita.

---

## Migraciones

### El registro no dice qué está aplicado

Lo que se corre desde el **SQL editor** de Supabase cambia la base sin escribir
en `schema_migrations`. Hay decenas de migraciones que figuran "sin registro" y
sí están aplicadas.

Para saber qué está vivo, preguntarle al objeto (`pg_policies`, `pg_proc`), no
al repo. Ver `CLAUDE.md`.

### La cadena ya no reproduce la base

Hay cientos de objetos que la base tiene y el repo no crea. Correr las
migraciones desde cero **no** produce el esquema actual.

```bash
npm run migrations:drift    # mide la deriva
```

Consecuencia práctica: no asumir que un objeto existe porque hay una migración
que lo crea, ni que no existe porque no la hay.

---

## Frontend

### Hay DOS `vercel.json` y gana el de la raíz

`frontend/vercel.json` es **código muerto**: Vercel usa el de la raíz del repo
(el que tiene `cd frontend && npm run build`).

Diagnóstico rápido cuando un rewrite no funciona:

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" <url>
```

Si un rewrite hacia un destino externo devuelve `200 text/html`, **no es que el
destino falle**: el rewrite no matcheó y cayó al catch-all del SPA. El
content-type distingue los dos casos al instante.

### Los archivos de `public/` ganan sobre los rewrites

Si existe `public/algo.json`, ningún rewrite hacia `/algo.json` se aplica jamás.

### `vercel.json` valida esquema estricto

Una clave desconocida —por ejemplo `comment` dentro de un rewrite— rompe el
build. JSON no admite comentarios y Vercel no perdona.

### Los íconos del PWA tienen que ser PNG de verdad

Hubo un caso en que `favicon.png` y `sportmaps-logo.png` eran **JPEG con
extensión `.png`**. Chrome los rechaza como íconos inválidos, la app deja de
cumplir los criterios de instalabilidad y `beforeinstallprompt` **nunca se
dispara**: el banner de instalar desaparece sin ningún error visible.

Si el banner no aparece, sospechar del formato real de los íconos antes que del
código.

### El service worker puede entrar en bucle de recarga

Registrar el SW dos veces sobre el mismo scope con tipos distintos (clásico y
módulo) produce `controllerchange` en bucle. Por eso `injectRegister: null` en
`vite.config.ts` y el registro manual en `src/pwa/register.ts`.

### `localStorage` es del dispositivo, no del usuario

Sobrevive al cierre de sesión y al cambio de cuenta. Todo lo que se persista en
el cliente debe borrarse al cerrar sesión, salvo razón explícita.

Ya pasó tres veces: la marca de una escuela, el nombre en iOS y el caché de
respuestas de Supabase del service worker se filtraban entre usuarios del mismo
teléfono.

El `signOut` limpia una **lista enumerada** de claves, y esa lista se
desactualiza cada vez que alguien agrega una. Conviene migrar a un prefijo común
y borrar por prefijo.

### iOS ignora el manifest

En Safari, el nombre del ícono sale de `apple-mobile-web-app-title` (o del
`<title>`) y el ícono del `apple-touch-icon`. Además Safari lee esas etiquetas
**al parsear**: lo que React escriba después no cuenta para "Añadir a inicio".

Y una vez agregado, el ícono queda **congelado** — no se actualiza nunca.

---

## Correo

Los envíos masivos se cortaban alrededor de 100 destinatarios por el rate limit
del proveedor (2 por segundo). Se resolvió con lotes de 100 y un endpoint de
envío masivo en el BFF.

---

## Despliegue

- **Frontend** → Vercel. **BFF** → Render. **Migraciones** → manuales.
- Cada push dispara ~4 despliegues contra una cuota diaria acotada: **agrupar**,
  no pushear por commit.
- Todo empieza en `develop`. La promoción a `staging` y `main` la pide el
  usuario; **nunca** mergear a `main` por iniciativa propia.
