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
| `subscription_plans` | El catálogo que la escuela le vende **a sus familias** |

Y `offering_plans` es la que el producto lee de verdad para las cuotas —
escribir solo en `subscription_plans` hace que el plan no aparezca en ningún
lado.

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
