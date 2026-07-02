# Capa DEMO — SportMaps

> Esta carpeta existe **solo en la rama `demo`**. Es una capa aditiva sobre `develop`.

## Qué es

La rama `demo` = copia exacta de `develop` + esta carpeta `demo/` + datos dummy
sembrados en el mismo Supabase de develop (marcados `is_demo=true` donde la tabla lo soporta).
Sirve para vender mostrando **todas las funcionalidades** con data ficticia interconectada.

## Cómo actualizar la rama demo (cuando develop avanza)

```bash
# 1. Traer todo lo nuevo de develop a demo (sin merge conflictivo)
git push --force origin origin/develop:demo
git branch -f demo origin/demo

# 2. Re-agregar esta capa demo (cherry-pick del commit que crea demo/)
git checkout demo
git cherry-pick <commit-de-la-capa-demo>   # o re-crear la carpeta demo/

# 3. Re-sembrar la data dummy (idempotente)
node demo/seed/seed-demo.mjs
```

## Sembrar / re-sembrar la data demo

Idempotente (UUIDs fijos + upsert). Se puede correr las veces que quieras.

```bash
node demo/seed/seed-demo.mjs
```

Lee credenciales de `bff/.env` o `frontend/.env.local` (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY),
o pásalas por entorno:

```bash
SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=sb_secret_... node demo/seed/seed-demo.mjs
```

Es **defensivo**: si una tabla no existe en el DB (migraciones manuales por detrás del repo),
la salta con log y sigue.

## Usuarios demo

Password para todos: **`SportMapsDemo2025!`**

| Rol | Email | Notas |
|---|---|---|
| school (owner) | `demo.escuela@sportmaps.co` | Escuela Demo SportMaps (Thunder, Lightning, Halcones) |
| coach | `demo.coach1@sportmaps.co` | Carlos Ramírez — Thunder + Lightning |
| coach | `demo.coach2@sportmaps.co` | Laura Gómez — Halcones |
| parent | `demo.padre1@sportmaps.co` | María García — hijos Sofía (Thunder) y Mateo (Lightning) |
| parent | `demo.padre2@sportmaps.co` | Andrés López — hija Valentina (Halcones) |
| athlete | `demo.atleta1@sportmaps.co` | Juan Martínez — inscrito en Lightning y con el entrenador personal |
| coach (PT) | `demo.trainer@sportmaps.co` | Andrés Torres — entrenador personal con su micro-academia y atletas |
| wellness_professional | `demo.wellness@sportmaps.co` | Dra. Sofía Rivera — fisio/nutrición (marketplace de servicios) |
| store_owner | `demo.tienda@sportmaps.co` | Tienda Equípate Más — productos + orden |
| organizer | `demo.organizador@sportmaps.co` | Liga Demo — torneo con inscripciones |
| admin | `demo.admin@sportmaps.co` | Administrador |

## Módulos cubiertos por el seed

Escuela + sedes + settings + suscripción SaaS · miembros/staff · equipos · offerings/planes ·
hijos · inscripciones · pagos (pagados/pendiente/vencido + tarjeta guardada) · asistencia ·
instalaciones + reservas · marketplace (vendors, servicios, planes) · citas wellness ·
tienda (productos publicados + orden) · entrenador personal (micro-academia) · eventos + inscripciones.

> Tablas no aplicadas aún en el DB (`recurring_subscriptions`, `marketplace_transactions`)
> se omiten automáticamente; al aplicar sus migraciones, re-correr el seed las cubrirá.
