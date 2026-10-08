# Supervisión de sesiones paralelas — develop (2026-10-07)

Corte: `develop` = `origin/develop` = `89a9ee2e`; `origin/main` = `c17482a5` (contiene `89a9ee2e`).
Solo lectura: no se cambió código ni se aplicó nada. Base consultada solo con SELECT.

## 1. Riesgos P0

**No hay deploy roto hoy.** Ningún archivo commiteado en `origin/develop` ni en `origin/main` bajo
`bff/src` o `frontend/src` importa (relativo o `@/`) un archivo que no esté en git. Los únicos
imports sin resolver están en `docs/manuales/*` (`../help-articles`), `scripts/*.mjs`
(`../bff/node_modules/...`, se resuelven en runtime) y `frontend/e2e/helpers/guard-no-prod.ts`:
nada de eso entra al build de Vercel/Render.

`npm run migrations:check` sobre HEAD: OK (697 archivos / 697 registrados). Sobre el working tree:
OK (698/698).

**P0 latentes (se rompen si alguien commitea mal):**

1. `bff/src/services/inapp-support-bot.service.ts` (modificado) importa
   `./sportbot-contexto.service` y `../data/app-map`, que están **sin trackear**. Commitear ese
   archivo sin los dos nuevos rompe el build del BFF en los 3 ambientes.
2. `supabase/migrations_ledger.json` (modificado) registra
   `20261006101735_desactivar_atleta_cancela_invitacion.sql`, que está **sin trackear**.
   Commitear el ledger sin el `.sql` hace fallar `migrations:check` en pre-commit/CI. Además esa
   versión es anterior al head (`20261006224322`): entró fuera de orden.
3. `whatsapp-queue.job.ts` (modificado) usa `invitacionPendienteVigente` y
   `abrirConsultaParaLaEscuela`: **ambos ya están commiteados** (`8aceb8e9` y
   `whatsapp-bot.service.ts`), así que este archivo sí es seguro de commitear solo.

## 2. Mapa archivo → dueño

Las 5 sesiones locales (-99, -9d, -fb/e9, -88, -e0) respondieron y **ninguna reconoce** los
archivos modificados del BFF. Se tratan como trabajo **huérfano** (probablemente de una sesión
cerrada; coincide con «SportBot rehecho 10-06 sin commitear»). Tampoco son de los agentes de la
sesión principal de hoy, salvo los marcados.

| Archivo | Qué es | Dueño probable | Estado |
|---|---|---|---|
| `bff/src/jobs/whatsapp-queue.job.ts` (+155) | Un adjunto que acompaña un reclamo/pregunta de cobro (o que el OCR no ve como comprobante) ya no recibe «Recibí tu comprobante»: `esConsultaSobreCobro`, `pareceComprobanteDePago`, `derivarConsulta` (abre la conversación a la escuela, fila `result_type='none'`). También filtra la invitación a atleta activo. | Huérfano (área de **comprobantes**, se cruza con el dueño de `whatsapp-queue.job.ts`) | Compila; 29/29 tests de `whatsapp-queue-atencion.test.ts` pasan |
| `bff/src/jobs/whatsapp-queue-atencion.test.ts` (+200) | Pruebas de lo anterior | Huérfano (mismo trabajo) | Pasa |
| `bff/src/services/inapp-support-bot.service.ts` (+212/−114) | SportBot rehecho: prompt con contexto del usuario, `generarRespuesta` con tools (máx 2 rondas), `quitarLinksInventados`, búsqueda de ayuda por rol | Huérfano (SportBot) | Compila; tests pasan |
| `bff/src/services/sportbot-contexto.service.ts` (nuevo) | Rol, escuela, equipos y módulos apagados del usuario para el prompt (solo lectura) | Huérfano (SportBot) | — |
| `bff/src/data/app-map.ts` + `.test.ts` (nuevos) | Mapa de la app por rol derivado del frontend | Huérfano (SportBot) | 10/10 |
| `bff/src/services/inapp-support-bot.turno.test.ts` (nuevo) | El turno de SportBot redacta y no deja promesas colgadas | Huérfano (SportBot) | 11/11 |
| `bff/src/services/inapp-support-bot.service.test.ts` (1 línea) | Ajuste | Huérfano (SportBot) | 7/7 |
| `bff/src/services/llm.service.test.ts` (+19) | Groq: resultado de tool como texto de usuario | Huérfano (SportBot); toca área **bot núcleo** (`llm.service`) solo en test | 4/4 |
| `bff/scripts/qa-sportbot.ts` (nuevo) | QA contra el LLM real (lee la base; quema cuota del proveedor) | Huérfano (SportBot) | — |
| `bff/src/services/seguridad-llm-{bot,comprobantes,sportbot}.poc.test.ts` (nuevos) | PoC OWASP LLM | Huérfano (auditoría de seguridad LLM) | **2 fallan** en `comprobantes` (el PoC espera «verde» y 2 proveedores; hoy sale «amarillo» y 1). PoC desactualizado o hueco ya cerrado: revisar antes de commitear |
| `bff/src/services/estado-de-cuenta.service.ts` + test (+72/+56) | `cobrosDeAtletaInactivo`: el estado de cuenta excluye cobros de atletas dados de baja | Huérfano (atletas inactivos, caso Dynasty 10-06) | 34/34 |
| `bff/src/routes/invitations.routes.ts` (+19) | bulk-send y send-status saltan invitaciones de atleta inactivo (`skipped_inactive_athlete`) | Huérfano (atletas inactivos). El servicio que usa ya está commiteado | Compila |
| `supabase/migrations/20261006101735_desactivar_atleta_cancela_invitacion.sql` (nuevo) + `migrations_ledger.json` | Al inactivar atleta, cancela la invitación pendiente | Huérfano (atletas inactivos) | **Ya está VIVA en la base** (ver §4) |
| `docs/migraciones-para-aplicar-2026-10-06/9_cancelar_invitaciones_de_atletas_inactivos.sql` | Copia para SQL editor de la anterior | Huérfano | Ya aplicada |
| `docs/migraciones-para-aplicar-2026-10-06/{1,2,3,4}_*.sql` | Copias para SQL editor (cortesía, turno, audios) | Sesión principal (cortesía / bot núcleo) | Ya aplicadas y registradas |
| `docs/migraciones-para-aplicar-2026-10-05/{1,2,3}_*.sql` | Copias para SQL editor | Sesión principal (según -fb) | Aplicadas (3 = superada por v2) |
| `docs/analisis/{auditoria,calidad,whatsapp-conversaciones}-*-dynasty-2026-10-06*.md` | Análisis del bot en Dynasty | Sesión principal / bot núcleo | Pueden contener datos de familias: revisar antes de commitear |
| `docs/plan-arquitectura-robusta-2026-10.md` | Plan de arquitectura | sportmaps-demo-99 (confirmado) | Doc |
| `frontend/src/lib/notifications/navigation.ts` (nuevo) | `resolveNotificationLink` por rol | Huérfano (nadie lo reclama, -88 lo niega) | **Nadie lo importa**: inofensivo, código muerto hasta que se enganche |

Sesiones y lo que declararon:

| Sesión | Área | Sin commitear | Migraciones pendientes |
|---|---|---|---|
| sportmaps-demo-99 | Diagnóstico de consumo Supabase | solo `docs/plan-arquitectura-robusta-2026-10.md` | ninguna |
| sportmaps-demo-9d | Factus Pay + débito automático (wompi/mercadopago/factus-pay) | nada | ninguna (F0/F1 aplicadas) |
| sportmaps-demo-fb (e9) | Tienda / contabilidad / facturación / Monster | nada | ninguna |
| sportmaps-demo-88 | Profesionales de salud | nada (promovido a stg/main) | ninguna (aplicadas sin registro, ver §4) |
| sportmaps-demo-e0 | Besser / ajustes de WhatsApp por escuela | nada | ninguna (registradas con otra versión, ver §4) |

## 3. Conflictos potenciales

- **`whatsapp-queue.job.ts`**: el diff huérfano de 155 líneas está en el archivo del dueño de
  **comprobantes**. Si ese agente commitea el archivo completo se lleva el trabajo huérfano; si
  hace `checkout`/`stash` lo pierde. Debe usar índice temporal y decidir explícitamente.
- **`migrations_ledger.json`**: compartido por todas las sesiones. Hoy trae la reserva huérfana
  `20261006101735` más un reordenamiento cosmético (3 líneas de profesionales). Quien cree la
  próxima migración con `migrations:new` va a arrastrar esa línea: commitear el ledger solo con
  sus propias líneas (índice temporal) o commitear antes el `.sql` huérfano.
- **`whatsapp-bot.service.ts`**: lo tocaron hoy -e0 (ajustes por escuela) y bot núcleo; el diff
  huérfano de la cola lo llama por import perezoso (`abrirConsultaParaLaEscuela`). Si alguien
  renombra esa función, el import dinámico no lo detecta `tsc` en todos los casos: mantener el
  nombre.
- **`llm.service.test.ts`**: test huérfano en el área de bot núcleo; puede chocar si bot núcleo
  edita el mismo archivo.

## 4. Migraciones de los últimos 3 días contra la base viva

Se verificaron 44 migraciones (`20261004…` a `20261006224322`) preguntando al objeto
(pg_proc, information_schema, pg_policies), no solo a `schema_migrations`.

**No aplicada (único caso):**

| Versión | Qué falta | Sesión | Impacto |
|---|---|---|---|
| `20261006110920_whatsapp_responder_prospectos` | columna `whatsapp_settings.responder_prospectos` | bot núcleo (commit `213b0534`) | Bajo: el BFF tolera la ausencia (lee `true` por defecto; el PATCH devuelve 409 `responder_prospectos_no_disponible`). La función funciona con su valor por defecto, pero no se puede apagar por escuela |

**Vivas pero sin registro en `schema_migrations`** (aplicadas por SQL editor; no hace falta
reaplicar): `20261004074523`, `20261005131057`, `20261005131059`, `20261005173001`,
`20261005173002`, `20261005214245…214302` (Dreamers F-A..F-F), `20261005221257`,
`20261006094145`, `20261006094147`, `20261006094149`, `20261006111003` (salud, sesión -88; -88 las
da por «aplicadas y verificadas», pero no están registradas), `20261006101735` (huérfana, cuerpo
de `set_school_athlete_status` ya trae `invitations_cancelled`).

**Registradas con OTRA versión** (sesión -e0, vía `apply_migration`):
`20261006120601` → registrada como `20261006223343`; `20261006224322` → como `20261006224725`.
`migrations:pendientes` las va a mostrar como pendientes aunque estén vivas.

**Superadas a propósito (no aplicar):** `20261005133534` (→ v2 `20261006104251`) y
`20261006101628` (→ v2 `20261006104254`); sus objetos existen por la v2.

Nota: la verificación es por presencia de objetos (funciones, tablas, columnas, policies). Una
`CREATE OR REPLACE` de una función que ya existía aparece como «viva» aunque tenga el cuerpo
viejo; en las que importan (101735) se verificó el cuerpo.

## 5. Recomendaciones de orden de merge/promoción

1. **Antes de cualquier commit en develop:** nadie commitea `inapp-support-bot.service.ts` ni
   `migrations_ledger.json` sin sus dependencias (P0 latentes 1 y 2).
2. **Decidir el trabajo huérfano** (lo decide el usuario), en tres commits independientes y en
   este orden:
   a. **Atletas inactivos**: `20261006101735_*.sql` + su línea del ledger (ya está viva: el commit
      solo alinea repo con base) + `estado-de-cuenta.service.ts`/test + `invitations.routes.ts`.
   b. **Comprobantes / consulta con adjunto**: `whatsapp-queue.job.ts` + `whatsapp-queue-atencion.test.ts`
      (validar con el dueño de comprobantes).
   c. **SportBot**: `inapp-support-bot.service.ts` + `sportbot-contexto.service.ts` +
      `data/app-map.ts` + los 3 tests + `llm.service.test.ts` + `scripts/qa-sportbot.ts`, juntos.
   Los PoC de seguridad: arreglar o marcar los 2 que fallan antes de commitearlos (romperían
   `vitest` en CI).
3. **Aplicar** `20261006110920` (columna con default; sin riesgo) por una vía con rastro.
4. **Registrar** en `schema_migrations` las vivas sin registro y corregir las 2 de -e0 con versión
   distinta, para que `migrations:pendientes` deje de mentir.
5. **Promoción**: develop → staging → main una sola vez cuando entren a, b y c (agrupar pushes por
   el cupo de Vercel). `frontend/src/lib/notifications/navigation.ts` puede esperar: no se usa.
