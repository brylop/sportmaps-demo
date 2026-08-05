# Contexto del Proyecto — SportMaps

Plataforma de gestión deportiva para escuelas, entrenadores, padres y atletas.
Servicios: `frontend` (React + Vite + TypeScript) y `bff` (Express/Node.js). BD: Supabase (PostgreSQL 15 + RLS). Auth: Supabase Auth. Deploy: Vercel (frontend) + Render (bff) + Supabase Cloud (migraciones manuales).

Roles: athlete, parent, coach, school (owner/admin), wellness_professional, store_owner, admin, organizer, facility_manager.

## Convenciones de base de datos (OBLIGATORIAS)

- **Migraciones inmutables:** nunca editar ni borrar archivos en `supabase/migrations/`, aunque estén corruptos. Todo fix va en una migración **nueva** con timestamp posterior (`YYYYMMDDHHMMSS`).
- **Ledger de migraciones:** crear siempre con `npm run migrations:new -- <slug>` (reserva versión única y posterior al head) y commitear el `.sql` junto a `supabase/migrations_ledger.json`. Inventario: `npm run migrations:list`. El gate `npm run migrations:check` corre en pre-commit y CI. Flujo completo en `docs/migrations-workflow.md`.
- **`search_path`:** toda `CREATE FUNCTION` nueva debe incluir `SET search_path = pg_catalog, public, pg_temp` (evita warnings del linter).
- **`GRANT EXECUTE`:** explícito por RPC (`GRANT EXECUTE ON FUNCTION … TO authenticated`). `SECURITY DEFINER` NO exime al caller de tener `EXECUTE`.
- **Helpers de RLS:** nunca revocar `is_school_admin()`, `is_super_admin()`, etc. al rol que las invoca desde policies, o rompe con 403 todas las queries.
- **RLS sin self-recursion:** una policy sobre la tabla X nunca hace `SELECT FROM X` en su `USING`. Usar funciones `SECURITY DEFINER`.
- **Estados/enums en tablas nuevas:** usar `text + CHECK`, **no** `CREATE TYPE`. (Historia: `payments.status` es `TEXT` por el dolor de castear a `pay_status`.)
- **FKs de negocio** apuntan a `public.profiles(id)`, no a `auth.users` directo.
- **Stock/contadores:** mutar solo dentro de RPCs `SECURITY DEFINER` con `SELECT … FOR UPDATE`. Nunca `UPDATE` de stock desde el cliente.

## Cómo se entregan las features

- **Full-stack por feature:** DB + RLS + RPCs + BFF + API + Frontend + Auditoría + QA. No migraciones sueltas.
- **Módulos grandes por fases,** con revisión entre cada una (una rama por fase). Spec como fuente de verdad en `docs/specs/`, con las decisiones de producto resueltas dentro. **Plan antes de código en migraciones** (no escribir hasta aprobar el plan). Tests de concurrencia en la fase backend. Revisar policies de RLS línea por línea antes de aplicar.

## Ramas

- Se trabaja **solo en `develop`**. `develop`/`stg`/`main` están divergidos.
- **Nunca** mergear a `main` por iniciativa propia.

## Notas

- Este es el `AGENTS.md` del repo (SportMaps). El `~/.Codex/AGENTS.md` global es de **otro contexto** (pipeline RCM/QA de Osigu) — no aplicarlo aquí.
- Specs de módulos en `docs/specs/`. Planes/roadmaps en `docs/`.
