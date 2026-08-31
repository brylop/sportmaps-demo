# Separar producción de dev/staging — plan (sin ejecutar todavía)

**Estado:** ⚪ plan escrito, sin aprobar. Nada de esto se aplicó.
**Fecha:** 2026-08-31 · **Pedido por:** usuario, tras el cierre del lote `SEG-22`/`SEG-1`/`SEG-2`.
**Por qué ahora:** la auditoría de seguridad del 29 y 31 de agosto tocó el mismo nervio dos veces
(`SEG-20`: los tres BFFs desplegados comparten la real; `project_shared_supabase_env` en memoria) —
cerrar brechas puntuales tiene techo mientras dev/stg/prod sigan siendo la misma base de datos.

---

## 0. Lo que confirma este documento, verificado en esta sesión

- `render.yaml` (raíz del repo, no configuración de dashboard) tiene **el mismo**
  `SUPABASE_URL=https://luebjarufsiadojhvxgi.supabase.co` hardcodeado en los tres servicios:
  `sportmaps-bff-dev` (rama `develop`), `sportmaps-bff-stg` (rama `staging`) y `sportmaps-bff-prod`
  (rama `main`). No es un `sync: false` de dashboard — está en el YAML committeado.
- Las 8 Edge Functions (`supabase/functions/*`) viven en ese mismo proyecto único: no hay una
  segunda instancia de `wompi-webhook`, `send-email`, etc.
- **`docs/AUDITORIA_ARQUITECTURA.md` (28-jul) queda desactualizado en un punto:** dice "dev y
  staging comparten el mismo proyecto Supabase; solo prod está aislado" (§5.1). Es falso — prod
  **no** está aislado, comparte la misma base que dev y stg. `docs/gotchas-tecnicos.md` sí lo tiene
  bien ("dev, staging y producción apuntan a la misma base. No hay sandbox").
- No hay forma de distinguir de forma confiable, tabla por tabla, qué filas son "reales de
  producción" y cuáles son de prueba/dev/stg — están todas en las mismas tablas. Ejemplo ya
  documentado: 26 escuelas de prueba quedaron con tier `enterprise` por un grandfathering invertido
  (memoria `project_tier_grandfathering_inversion`) — conviven con escuelas reales pagando.

## 1. La decisión estratégica que ordena todo lo demás

**No hay que sacar a producción de la base actual — hay que sacar a dev y staging.**

La intuición obvia ("creamos un proyecto nuevo para prod y migramos los datos reales") es la
**opción más riesgosa**: exige filtrar con certeza qué filas son reales en ~175 tablas sin un flag
confiable en todas, migrar `auth.users` (contraseñas hasheadas, sesiones activas, MFA si algún día
se activa `SEG-13`), Storage, y todo con escuelas reales operando en el proceso.

La alternativa invierte el problema:

1. El proyecto actual (`luebjarufsiadojhvxgi`) **se queda donde está y pasa a ser prod-exclusivo**.
   Cero migración de datos reales: ya están ahí.
2. Se crea un proyecto **nuevo** para dev+staging, con el esquema aplicado desde cero (273+
   migraciones, ya inmutables y versionadas) y datos sintéticos/demo — no datos reales que mover.
3. `sportmaps-bff-dev` y `sportmaps-bff-stg` (y sus Vercel envs) apuntan al proyecto nuevo.
   `sportmaps-bff-prod` no cambia de URL — su corte es **no hacer nada**, lo cual es la forma más
   segura de tocar producción.
4. Lo único que sí toca la base real de producción es la **Fase 5** (limpieza de cuentas de
   prueba/demo que quedaron mezcladas ahí) — y esa fase se mide con el mismo rigor que cualquier
   cambio de RLS (`CLAUDE.md` §Seguridad: "medir el radio antes de aplicar").

Esto no es gratis: dev/stg pierden su parecido actual con producción (hoy prueban contra datos
reales, lo cual también es un problema de privacidad que esto resuelve de paso) y hace falta un
seed realista para que QA siga siendo útil. Ese es exactamente el trabajo de la Fase 3.

## 2. Fases

### Fase 0 — Inventario y decisiones de producto (antes de crear nada)

No es opcional: dispara las fases 1-6 con las respuestas correctas en vez de a mitad de camino.

| Decisión | Por qué importa |
|---|---|
| **D-SEP-1** — ¿Qué escuelas/cuentas del proyecto actual son candidatas a quitar cuando pase a ser prod-exclusivo? | Las 26 de `project_tier_grandfathering_inversion`, cualquier tenant `is_demo=true` que hoy viva ahí por error, cuentas de prueba con `TEST-` (`project_env_payment_credentials`). Sin esta lista, la Fase 5 no tiene alcance. |
| **D-SEP-2** — ¿El seed de dev/stg reproduce escuelas "tipo" (una escuela chica, una grande multi-sede, una con banco de horas, etc.) o solo el motor de demos actual (`Club Campestre Demo`)? | Define cuánto trabajo es la Fase 3. El motor de demos ya existe (memoria `project_demo_branch_strategy`) pero fue pensado para ventas, no para cobertura de QA. |
| **D-SEP-3** — ¿Se preserva algo de lo que hoy solo existe en dev/stg (datos de prueba que alguien quiera conservar) antes de que ese proyecto quede huérfano? | Una vez que dev/stg corten hacia el proyecto nuevo, el proyecto viejo-vuelto-prod sigue teniendo esas filas de prueba mezcladas — hay que decidir si se archivan antes de la Fase 5 o se descartan. |
| **D-SEP-4** — ¿Quién es dueño de re-registrar los webhooks externos (Wompi, MercadoPago, Meta/WhatsApp Cloud API) que hoy podrían estar apuntando a URLs de Edge Functions del proyecto único? | Verificar primero si ya son por-ambiente (probable, dado que `school_whatsapp_integrations` es por escuela) — si no lo son, es trabajo externo con terceros, no código. |
| **D-SEP-5** — ¿Downtime aceptable para el corte de dev/stg? | Con la estrategia de la §1, **prod no tiene downtime** (nunca se mueve). Dev/stg sí lo tienen mientras se corta el DNS/env var — bajo impacto porque no son ambientes con usuarios reales, pero hay que avisar si alguien está probando algo esa semana. |

### Fase 1 — Provisionar el proyecto nuevo (dev+staging)

- Crear el proyecto Supabase nuevo (nombre sugerido: distinguirlo claramente de `luebjarufsiadojhvxgi`
  para que nadie vuelva a confundirlos — ver la Regla 9 de este mismo tipo de error en `CLAUDE.md`).
- Aplicar las 273+ migraciones desde cero, en orden, con `supabase/migrations_ledger.json` como
  fuente — es la primera vez que se prueba "¿el repo reconstruye la base sola?" en serio. Si algo
  falla acá (el propio `docs/AUDITORIA_ARQUITECTURA.md` §4.7 ya marca una migración con SQL corrupto
  — `schema_refactored.sql:1162/1174`, `CREATE FUNCTION public.EXISTS(...)`), **esta fase lo va a
  encontrar primero**, en un proyecto vacío sin nadie operando — el mejor lugar posible para
  encontrarlo.
- Redesplegar las 8 Edge Functions.
- Configurar Auth (providers, `auth_leaked_password_protection` — de una vez con la protección
  prendida, no hereda el pendiente de `SEG-1`), Storage buckets con la misma config que
  `get_storage_config` reporta hoy.
- Configurar `pg_cron` — inventariar primero qué jobs corren hoy en el proyecto real
  (`cron.job`) y decidir cuáles aplican a un ambiente de pruebas (probablemente no todos: `INF-11`
  ya documenta un mantenimiento con dos dueños, no hay que heredar ese problema).

### Fase 2 — Cortar dev y staging hacia el proyecto nuevo

- `render.yaml`: nuevo `SUPABASE_URL` para `sportmaps-bff-dev` y `sportmaps-bff-stg` únicamente.
  `sportmaps-bff-prod` no se toca.
- Vercel: variables de entorno `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` por ambiente
  (Preview/Development vs Production) — verificar cómo está resuelto hoy, no está confirmado desde
  este repo si Vercel ya separa esto por ambiente o si también hereda un valor único.
- Rotar `SUPABASE_SERVICE_ROLE_KEY` de dev/stg al del proyecto nuevo (con esto, el service role
  actual queda exclusivo de prod — reduce de paso la superficie de "quién puede tener la key que
  bypassa RLS de producción").

### Fase 3 — Seed de dev/staging

- Correr el motor de demos existente (`is_demo=true`, memoria `project_demo_branch_strategy`) como
  base.
- Ampliar según lo que resuelva `D-SEP-2` — probablemente 3-5 "escuelas tipo" que cubran los flujos
  que QA prueba seguido (banco de horas, multi-sede, WhatsApp, reservas).
- Confirmar que el pipeline QA (`osigu-qa-flow`, o el `qa-*` de este repo si aplica) sigue
  funcionando contra el proyecto nuevo antes de dar la fase por cerrada.

### Fase 4 — Verificación end-to-end

- Levantar el frontend contra `dev.sportmaps.co`/`stg.sportmaps.co` apuntando al proyecto nuevo:
  login, flujo de inscripción, un pago de prueba, WhatsApp si está configurado, control de acceso.
- Correr `npm run seguridad:invariantes` y `get_advisors` contra el proyecto **nuevo** — debería
  salir más limpio que el viejo (nace con las migraciones ya hardened del track `SEG`), y confirma
  que la réplica de esquema es real, no solo "no tiró error".
- Solo cuando esto esté verde: dar la Fase 2 por irreversible en la práctica (dev/stg ya no vuelven
  al proyecto compartido salvo incidente).

### Fase 5 — Limpiar el proyecto que quedó como prod (la única fase que toca datos reales)

Esta es la fase que exige el mismo cuidado que cualquier cambio de RLS del `CLAUDE.md`: **medir el
radio antes de aplicar.**

- Ejecutar el alcance que definió `D-SEP-1`: identificar filas de prueba que quedaron mezcladas
  (las 26 de tier invertido, cuentas `TEST-`, cualquier `is_demo=true` fuera de lugar).
- Para cada candidata a tocar: contar impacto real (¿tiene miembros activos? ¿pagos reales
  asociados?) antes de desactivar o borrar — el mismo patrón que ya usó `DIN-4`
  ("303 escuelas sin admin resultaron tener 302 sin ningún miembro" — la 303ª sí importaba).
- Preferir **desactivar/marcar**, no `DELETE`, salvo que `D-SEP-1` diga explícitamente lo contrario
  — coherente con `feedback_user_handles_deletions`: el usuario maneja las eliminaciones, no
  iniciativa propia.
- Actualizar `docs/gotchas-tecnicos.md` y `docs/AUDITORIA_ARQUITECTURA.md` §5.1 para que dejen de
  decir "una sola Supabase para todo" — en este punto ya no es cierto y el gotcha se vuelve
  desinformación viva si nadie lo corrige.

### Fase 6 — Integraciones externas y cierre

- Confirmar (o re-registrar) webhooks de Wompi/MercadoPago/Meta si `D-SEP-4` determinó que hacía
  falta.
- `docs/deployment/` y cualquier runbook que asuma una sola URL de Supabase para los tres
  ambientes — actualizar.
- Cerrar este documento como ✅ y sumar la entrada correspondiente en `ROADMAP.md`.

## 3. Rollback

Como prod **nunca se mueve**, el rollback de cualquier fase 1-4 es no completarla: dev/stg
simplemente no llegan a cortar, o cortan y se revierte el `SUPABASE_URL` de `render.yaml` al de
siempre — cero impacto en producción porque producción no participó de esas fases.

El único punto sin rollback trivial es la **Fase 5** (borrado/desactivación en el proyecto real) —
por eso ahí se preferimos desactivar sobre borrar, y por eso esa fase va al final, con las fases
1-4 ya verificadas y sin haber tocado nada real todavía.

## 4. Lo que este plan NO resuelve todavía

- No dice **cuándo**. Es una propuesta de secuencia, no un cronograma — falta que el usuario le
  ponga fecha una vez que las decisiones de la Fase 0 estén cerradas.
- No estima esfuerzo en días/semanas por fase — depende directamente de qué tan grande sale `D-SEP-2`
  (el seed) y de cuántas escuelas caen en el alcance de la Fase 5.
- No cubre MFA/secrets manager (`SEG-13`) ni el resto de la deuda de seguridad de fondo — son
  independientes de este proyecto y no lo bloquean ni lo bloquea.
