# Credenciales de Usuarios Demo - SportMaps

> Ultima actualizacion: Abril 2026
> Creados via: `frontend/scripts/setup-demo-data.mjs`

## Usuarios Demo (Reales)

Todos los usuarios comparten la misma contrasena: **`SportMapsDemo2025!`**

| # | Rol | Email | Nombre | UUID |
|---|-----|-------|--------|------|
| 1 | school (owner) | `spoortmaps+school@gmail.com` | Spirit All Stars | `04c1512c-517e-4a1e-b4a8-ba3b4b75470d` |
| 2 | parent | `spoortmaps@gmail.com` | Maria Garcia Hernandez | `9158d496-7f39-46ad-95f9-83ca3379974e` |
| 3 | coach | `spoortmaps+coach@gmail.com` | Luis Fernando Rodriguez | `1c26edad-7691-4fc4-8a42-eab2d7d174d5` |
| 4 | athlete | `spoortmaps+athlete@gmail.com` | Carlos Martinez Lopez | `6aeb3969-a225-462c-a4c4-b7f71c0b2bcd` |
| 5 | wellness_professional | `spoortmaps+wellness@gmail.com` | Dra. Sofia Rivera | `51f449eb-5223-49b9-96ea-c1e817f334a5` |
| 6 | store_owner | `spoortmaps+store@gmail.com` | Tienda Equipate Mas | `9447e937-7aec-486e-ad85-e48725d42833` |
| 7 | admin | `spoortmaps+admin@gmail.com` | Administrador Sistema | `bcb88976-5998-440f-ba9b-803571bfb46f` |

### Usuarios creados manualmente

| Rol | Email | Notas |
|-----|-------|-------|
| organizer | `organizador1@gmail.com` | Creado via registro web |

## Roles sin cuenta demo

Los siguientes roles NO tienen cuenta demo pre-creada. Se pueden crear via el flujo de registro en `/register`:

- `personal_trainer` — Entrenador personal
- `school_admin` — Admin de sede especifica

## Como usar

1. Ir a `http://localhost:5173/login`
2. Ingresar email y contrasena de la tabla anterior
3. El sistema redirige automaticamente al dashboard del rol correspondiente

## Variable de entorno

La escuela demo se configura via:
```
VITE_DEMO_SCHOOL_EMAIL=spoortmaps+school@gmail.com
```

Esta variable permite que usuarios no autenticados vean datos de la escuela demo en modo invitado.

## Recrear usuarios demo

```bash
cd frontend
node scripts/setup-demo-data.mjs
```

Prerequisitos:
- Variables de entorno configuradas en `.env.local` (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- Script usa Admin API de Supabase para crear usuarios con auto-confirmacion

## Relaciones demo pre-configuradas

- **Sofia Garcia** (hija de Maria Garcia) esta inscrita en el equipo **Thunder**
- **Carlos Martinez** (atleta) esta inscrito en el equipo **Lightning**
- Ambos equipos pertenecen a la escuela **Spirit All Stars**

## Seguridad

- Estas credenciales son SOLO para desarrollo y demo
- En produccion, `VITE_DEMO_SCHOOL_EMAIL` debe estar vacio o no configurado
- Los usuarios demo no tienen permisos especiales — usan el mismo sistema RBAC que usuarios reales
