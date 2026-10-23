# #22 — `get_school_athletes`: gate de staff (ROADMAP v2.38)

**Estado:** migración escrita y probada en transacción revertida. **NO aplicada.**
Archivo: `supabase/migrations/20261023093127_get_school_athletes_gate_staff.sql` (ledger sincronizado, `migrations:check` verde).

## Hallazgo (definición viva, 2026-10-23)

| Firma | EXECUTE | Gate | Veredicto |
|---|---|---|---|
| `get_school_athletes(uuid, uuid)` | `authenticated` | `user_school_ids()` (padres y atletas incluidos) | **La fuga.** Devuelve `parent_name` y `parent_email` de toda la escuela |
| `get_school_athletes(uuid)` | solo `service_role` | ninguno | No explotable por usuarios. **No se toca**: un gate de identidad la rompe para el BFF (sin JWT) |

Llamadores: ninguno en `frontend/` ni `bff/` (solo el tipo generado en `types.ts`). Nadie legítimo pierde acceso.

## Cambio

Solo la de 2 argumentos: mismo cuerpo, firma y columnas; el gate pasa a `user_staff_school_ids()` o `is_platform_admin()`, con `ERRCODE 42501`. `search_path` fijo y `GRANT` explícito a `authenticated` (con `REVOKE` a `PUBLIC` y `anon`).

## Prueba (Besser, sesiones simuladas, transacción revertida con `RAISE EXCEPTION`)

| Quién | ANTES | DESPUÉS |
|---|---|---|
| Padre (`6dfe0339…`) | 82 filas, **71 con correo de acudiente** | **error 42501** |
| Coach (`6d21e44d…`) | 82 filas, 71 con correo | 82 filas, 71 con correo (sin cambio) |
| Owner (`be56d7ea…`) | 82 filas, 71 con correo | 82 filas, 71 con correo (sin cambio) |

Tras la prueba, la función viva sigue con el gate viejo (se verificó): no quedó nada aplicado.

## Nota

El coach de Besser ve los 71 correos porque `coach_contact_masked_school` no está activo en esa escuela. Eso es una decisión de configuración, no parte de este arreglo.

## SQL de prueba

Bloque `DO` que (1) llama la función como padre, coach y owner con `set_config('request.jwt.claims', …)` + `set local role authenticated`, (2) ejecuta el `CREATE OR REPLACE` de la migración dentro de la misma transacción, (3) repite las llamadas y (4) termina en `RAISE EXCEPTION 'RESULTADO: …'` para revertir. Ids usados: owner `be56d7ea-7d9d-4163-ab28-6fcaa6fd054b`, padre `6dfe0339-41cb-4682-98af-92dfb3bbe854`, coach `6d21e44d-0a82-4575-83b7-5ed2b673d272`, escuela `759eee9d-05cb-4958-b84a-2560f77e3683`.

## Aplicar

Una sola sesión, por una vía que deje registro (`apply_migration` o CLI). Regenerar `types.ts` solo si cambia algo de firmas: aquí no cambia.
