# Gemelo local de la base (QA)

Supabase completo en Docker, con el **esquema real de la base viva** (no el
replay de `supabase/migrations/`) y una semilla sintética. Es donde corren las
pruebas de RLS, concurrencia, vitest de integración y Playwright de **tienda v2**
y **contabilidad v2** (`docs/specs/tienda-v2-estilo-mercadolibre.md` §8.1,
`docs/specs/contabilidad-v2.md` §8.1) sin tocar producción.

> Por qué no basta con `supabase start` en la raíz: hay una sola Supabase
> (`luebjarufsiadojhvxgi`) y ~336 objetos viven fuera del repo (deriva de
> esquema). Reproducir `supabase/migrations/` da **otra** base. El gemelo copia
> lo que la viva **tiene hoy**.

---

## Uso rápido

```bash
npm run qa:dump-schema     # 1. volcado de esquema de la viva (solo lectura) → supabase/qa-twin/dump/
npm run qa:twin:up         # 2. levanta Supabase local y, si está vacía, carga volcado + seed
npm run qa:twin:verify     # 3. (opcional) compara la huella viva vs gemelo
npm run qa:sql -- supabase/tests/tienda_v2      # casos SQL de RLS contra el gemelo
```

| Comando | Qué hace |
|---|---|
| `npm run qa:dump-schema` | Vuelca **solo esquema** de `public`, extensiones, triggers propios de `auth.*`, buckets y policies de storage, y catálogos sin datos personales. Archivos ignorados por git |
| `npm run qa:twin:up` | `supabase start` del proyecto `supabase/qa-twin/` (si no corre). Si la base no tiene la marca `qa_twin.meta`, carga el volcado y el seed. `--force` recarga encima |
| `npm run qa:twin:reset` | `supabase db reset` (base en blanco, sin migraciones del repo) + volcado + seed. Usarlo después de cada `qa:dump-schema` |
| `npm run qa:twin:seed` | Re-corre solo `supabase/seed/qa_twin_seed.sql` (idempotente) |
| `npm run qa:twin:status` | URL, llaves locales, cadena de conexión y fecha de carga |
| `npm run qa:twin:verify` | Compara viva (solo lectura) vs gemelo: relaciones, funciones, policies, triggers y **permisos** de `anon`/`authenticated`. Sale 1 si difieren |
| `npm run qa:twin:down` | Apaga los contenedores. Los datos quedan en el volumen |
| `npm run qa:sql -- <archivo\|carpeta>` | Runner de casos SQL contra el gemelo (solo localhost) |

Endpoints del gemelo:

| | |
|---|---|
| API (`SUPABASE_URL`) | `http://127.0.0.1:54321` |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio | `http://127.0.0.1:54323` |
| Correos (Mailpit) | `http://127.0.0.1:54324` |

Las llaves `anon`/`service_role` son las de demo de la CLI (iguales en toda
máquina, no son secretas): `npm run qa:twin:status` las imprime.

### Tiempos medidos (2026-10-03, Windows 11 + Docker Desktop)

| Paso | Tiempo |
|---|---|
| Primer `qa:twin:up` (baja ~2 GB de imágenes) | ~4 min (+ reintento, ver problemas) |
| `qa:dump-schema` | ~2 min (la primera vez ~7 min: también baja la imagen de Postgres) |
| `qa:twin:reset` (blanco + volcado + seed) | ~60–70 s |
| `qa:twin:up` con contenedores apagados y base ya cargada | ~40 s |
| `qa:twin:up` con todo corriendo | ~5 s |
| Un caso de `qa:sql` | < 10 ms |

---

## Qué hay adentro

### Volcado (`supabase/qa-twin/dump/`, ignorado por git)

| Archivo | Contenido |
|---|---|
| `00_extensions.sql` | `pgcrypto`, `uuid-ossp`, `pg_trgm`, `unaccent`, `btree_gist`, `pg_stat_statements` en `extensions` (+ `pg_net`) |
| `01_public.sql` | `supabase db dump -s public`: 261 tablas, 29 vistas, 584 funciones, 727 policies, 198 triggers (2026-10-03) |
| `02_auth_storage.sql` | Trigger `on_auth_user_created` → `handle_new_user()`, los 13 buckets (solo configuración) y las 59 policies de `storage.objects` |
| `03_catalogos.sql` | Lista blanca **sin datos personales**: `roles`, `sports_categories`, plantillas y métricas deportivas, `product_categories`, `product_brands`, `shipping_zones`, `payroll_config`, categorías de gasto del sistema, `platform_config` (sin `platform_payment_accounts`), etc. Ver `CATALOGOS` en `scripts/qa-twin/dump-schema.mjs` |
| `manifest.json` | Fecha, versión de la viva, conteos |
| `load.log` | Errores de la última carga (hoy: 0) |

**Nunca** se vuelcan filas de `profiles`, `children`, `payments`, escuelas,
documentos ni credenciales. El script aborta si el volcado de esquema trae algún
`INSERT`/`COPY`.

No se replica: jobs de `pg_cron`, edge functions (el stack local excluye
`edge-runtime`), secretos de Vault, configuración de Auth del dashboard (SMTP,
OAuth). La viva no tiene custom access token hook: el único "hook" de auth es el
trigger `on_auth_user_created`.

### Semilla (`supabase/seed/qa_twin_seed.sql`)

Contraseña de **todos** los usuarios: `QaGemelo2026!`

| Alias (`@qa.sportmaps.test`) | Rol |
|---|---|
| `owner.a` | owner de **QA Academia Andes** (escuela A: suscripción pro activa, addons `store` + `accounting`) |
| `admin.a` | `school_admin` de A |
| `coach.a` | coach de A |
| `padre.a` | padre **miembro** de A (hijo "Hijo QA Andes") |
| `padre.b` | padre **ajeno** a A (hijo en B) |
| `atleta.a` | atleta adulto miembro de A |
| `owner.b` | owner de **QA Club Llanos** (escuela B: starter, **sin** addons) |
| `vendedor.ok` | vendedor externo **verificado** (`bank_data` ficticio) |
| `vendedor.pend` | vendedor externo **sin verificar** |
| `superadmin` | admin de plataforma (`platform_admins`) |

Productos (7): camiseta `school_only` de A con 3 variantes (una en 0); balón
público sin variantes; guayos con matriz talla×color (una en 0); termo en
**borrador**; medias **agotadas** (stock 0); rodillera **último ítem** (stock 1);
cuerda del vendedor sin verificar (queda `pending_review` por el trigger).

Dinero: cobros de A `paid`, `partial` (150.000 con abono 50.000) y `pending`, más
uno `paid` en B; proveedor + factura abierta de $400.000; gasto pagado y gasto
aprobado sin pagar; 1 empleado de nómina a 1 SMMLV; `payroll_config` 2026 con los
valores de los decretos 1469/1470 de 2025 (los de los casos dorados).

UUIDs fijos (`00000000-0000-4000-a000-…` usuarios, `…-b000-…` escuelas,
`…-d000-…` productos). Para los casos: `select * from qa_twin.actores` (alias →
`user_id`, `school_id`, `vendor_profile_id`).

---

## Escribir casos SQL (`npm run qa:sql`)

Un archivo = un caso, todo en `BEGIN … ROLLBACK`. Pasa si termina sin error;
falla con cualquier error (usar `raise exception 'FALLO: …'`). Los `raise notice`
salen como detalle.

```sql
begin;
-- leer el actor ANTES de bajar de rol (authenticated no ve qa_twin)
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_id from qa_twin.actores where alias = 'padre.a'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    insert into public.orders(user_id, total_amount, status) values (auth.uid(), 1000, 'paid');
    raise exception 'FALLO: el comprador inserta una orden pagada';
  exception when insufficient_privilege then raise notice 'OK: 42501';
  end;
end $$;
rollback;
```

Caso de humo incluido: `supabase/tests/tienda_v2/`.

| Caso | Estado hoy | Por qué |
|---|---|---|
| `R03_anon_no_lee_bank_data.sql` | **PASA** | La migración M1 `20261002125955_vendor_profiles_columnas_publicas_anon.sql` **ya está aplicada en la viva**: `anon` solo tiene grants por columna y `bank_data` no está. El gemelo lo heredó del volcado |
| `R03b_authenticated_no_lee_bank_data_ajeno.sql` | **FALLA** (esperado) | Cualquier usuario autenticado lee `bank_data` de los vendedores verificados: `authenticated` conserva el grant de la columna y `vendor_profiles_select_public` es `TO public`. Se pone verde cuando esas lecturas pasen al BFF (blindaje 2.10 / T1) |

Para probar una migración nueva **antes** de aplicarla en la viva: correrla en
el gemelo (`docker exec -i supabase_db_sportmaps-qa-twin psql -U postgres < archivo.sql`),
correr los casos, y `npm run qa:twin:reset` para volver al estado de la viva.

---

## Guardas anti-producción

| Dónde | Archivo | Cableado en |
|---|---|---|
| Playwright | `frontend/e2e/helpers/guard-no-prod.ts` | `globalSetup` de `frontend/playwright.gemelo.config.ts` |
| Vitest de integración del BFF | `bff/test/guard-no-prod.ts` | `globalSetup` de `bff/vitest.integration.config.ts` |
| Scripts del gemelo | `scripts/qa-twin/lib.mjs` (`assertNotProd`, `twinClient`) | `qa:sql`, `qa:twin:*` (solo localhost) |

Abortan si cualquier URL/cadena de conexión (`SUPABASE_URL`, `VITE_SUPABASE_URL`,
`SUPABASE_DB_URL`, `DATABASE_URL`, `QA_TWIN_DB_URL`, …) contiene
`luebjarufsiadojhvxgi`, o si `WOMPI_PUBLIC_KEY`/`VITE_WOMPI_PUBLIC_KEY` empieza
por `pub_prod_`. Miran `process.env` y, para lo que falte, el `.env` que la app
cargaría (`bff/.env`, `frontend/.env*`): como esos `.env` apuntan a la viva, **sin
exportar las variables del gemelo la corrida aborta**. Es lo buscado.

```bash
# Vitest de integración (pruebas de concurrencia: bff/test/integration/**)
cd bff
SUPABASE_URL=http://127.0.0.1:54321 WOMPI_PUBLIC_KEY=pub_test_x PUBLIC_API_URL=http://127.0.0.1:3000 \
  npx vitest run -c vitest.integration.config.ts

# Playwright contra el gemelo (specs en e2e/tienda/** y e2e/contabilidad/**)
cd frontend && npx playwright test -c playwright.gemelo.config.ts
```

`playwright.gemelo.config.ts` levanta **su propio** Vite en el puerto 3101
(`strictPort`, sin reusar) con las variables del gemelo: un `npm run dev` abierto
en 3001 apunta a la viva y reusarlo haría que la UI escribiera en producción aunque
la guarda pase. El BFF, si una prueba lo necesita, se levanta aparte con las
variables del gemelo (`QA_TWIN_BFF_URL`).

Las unitarias (`bff/vitest.config.ts`, `src/**/*.test.ts`) no cambian y no llevan guarda.

---

## Problemas encontrados al montarlo

1. **El gemelo salía más abierto que la viva.** La imagen local de Supabase trae
   `DEFAULT PRIVILEGES` que dan `ALL` (incluido `TRUNCATE`) a `anon`,
   `authenticated` y `service_role` sobre todo objeto nuevo de `public`, y
   `pg_dump` solo emite los `GRANT` que la viva tiene, no los `REVOKE` de lo que no
   tiene. Primera carga: `anon` con `SELECT`/`TRUNCATE` en las 261 tablas,
   `EXECUTE` en las 584 funciones y lectura de `bank_data`; `invariantes_seguridad()`
   daba 522 CRÍTICAS que en la viva no existen. Arreglo: `twin.mjs` revoca esos
   default privileges antes de cargar (sin tocar el `EXECUTE` implícito de
   `PUBLIC`). `qa:twin:verify` lo comprueba: hoy las 12 métricas coinciden.
   Lección: **una prueba negativa de RLS solo vale si el gemelo tiene los mismos
   grants que la viva**; correr `qa:twin:verify` después de cada reset.
2. **Hallazgo real: no se puede insertar un producto directo en `active`.**
   `trg_enforce_product_publish_gate` es `BEFORE INSERT` y llama
   `validate_product_quality(NEW.id)`, que busca la fila en la tabla (todavía no
   existe) → `not_found` → `23514` aunque el producto cumpla todo. Solo funciona
   insertar en `draft` y luego `UPDATE … status='active'` (así lo hace el seed).
   Afecta a cualquier camino que cree productos ya publicados.
3. **M1 ya está viva, M3 no.** `R03` pasa porque la viva ya tiene los grants por
   columna de `vendor_profiles` para `anon`. `store_enabled()` /
   `fn_guard_vendor_profiles()` (M3, `20261002125959`) no existen en la viva.
4. **`authenticated` sigue leyendo `bank_data`** de los vendedores verificados (`R03b`).
5. **Los vendedores externos chocan con `trial_block_*`.** Las tres policies son
   `RESTRICTIVE` con `school_is_operational(school_id)`; con `school_id NULL` da
   NULL → un vendedor externo autenticado no puede insertar/editar productos por
   PostgREST. El seed escribe como `postgres` y no lo sufre; las pruebas de
   vendedor sí lo van a ver (es el C6 del spec).
6. **`payroll_config` 2026 de la viva tiene valores 2025** (SMMLV 1.423.500). El
   seed lo cambia **solo en el gemelo** a 1.750.905 / 249.095 / UVT 52.374.
7. **Primer arranque:** la descarga de la imagen de Postgres falló una vez con
   `500 Internal Server Error … images/…/json` de Docker Desktop recién
   encendido. Reintentar `npm run qa:twin:up` lo resolvió.
8. **Credenciales de lectura.** No hay cadena de conexión en `bff/.env`. El dump
   usa la CLI logueada: `supabase db dump --linked` obtiene un rol temporal
   (`cli_login_postgres`, la Management API le pone una contraseña que expira) y
   las lecturas de catálogo usan ese mismo rol **en modo solo lectura**
   (`default_transaction_read_only`; un `CREATE TABLE` de prueba falla con
   `25006`). Nada se imprime ni se guarda. Alternativa: exportar
   `SUPABASE_DB_URL` en el shell.
9. `pg_net` vive en `public` en la viva y en `extensions` en el gemelo: las
   llamadas `net.http_post` existen igual, pero no salen a ningún lado útil.
10. CLI de Supabase 2.78.1 (hay 2.119). Funciona; actualizar cuando convenga.

---

## Mantenimiento

- Antes de cada fase de tienda/contabilidad: `npm run qa:dump-schema && npm run qa:twin:reset && npm run qa:twin:verify`.
- Si `verify` difiere justo después de un reset, la viva cambió entre el dump y
  la verificación, o hay un objeto que el volcado no cubre: revisar
  `supabase/qa-twin/dump/load.log` y la métrica que difiere.
- Agregar una tabla a `CATALOGOS` solo si no tiene personas, escuelas, pagos,
  documentos ni credenciales.
- El seed se extiende en el mismo archivo, con IDs fijos y `ON CONFLICT`.
