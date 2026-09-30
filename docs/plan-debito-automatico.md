# Plan — Débito automático (tarjeta, Nequi, Bancolombia)

**Fecha:** 2026-09-29 · **Versión:** v0.2 (acompaña al spec v0.2)
**Estado:** plan para aprobar. No se escribe SQL de F1 hasta aprobar el spec v0.2 (CLAUDE.md) y tener respuesta de Wompi a las preguntas 1 y 8.
**Spec:** `docs/specs/debito-automatico.md`

## Por qué

- En Dynasty, el 62% de los pagos los carga la escuela a mano y en septiembre se represaron: del 18 al 27 se registraron 17 pagos, contra ~60 en agosto.
- Un cobro debitado solo es un comprobante menos que revisar y uno menos que se puede quedar sin registrar.
- Entre las transferencias de Dynasty, Nequi es el 25% y Bancolombia el 12%. La escuela decide si lo ofrece; SportMaps construye la herramienta y el material para ofrecerla.

## Urgente y aparte: el checkout en línea de Dynasty está roto

No es parte del débito, pero lo encontró la investigación de §15 del spec y **explica la caída de 30 a 4 pagos en línea**. No era el recargo.

- **Qué pasa:** desde el 2026-08-27, 10 de los 11 checkouts fallidos de Dynasty crearon la transacción en el **comercio de sandbox de Wompi** (`11981889`), que respondió "La firma es inválida". El comercio real de Dynasty es `1298966`. Después de fallar, 7 familias pagaron por transferencia y 3 siguen en mora. Desde el 20-sep no hay ningún intento de pago en línea.
- **Causa probable (a confirmar):** el Widget abre con la llave pública que trae el frontend (`VITE_WOMPI_PUBLIC_KEY`, que en `frontend/.env` es `pub_test_`) cuando no recibe la del BFF, mientras la firma se hace con el secreto de otro comercio.
  - `openWompiCheckout` usa `publicKeyFromBff || WOMPI_PUBLIC_KEY` (`frontend/src/lib/api/wompi.ts`).
  - **`ParentCheckoutPage.tsx:533` no le pasa ni `signature` ni `publicKey`.** Esa es la pantalla a la que llega el padre desde el QR de "pagar mensualidad" (`JoinSchoolPublicPage.tsx:363,375,434`).
  - La otra posibilidad: un frontend o BFF desplegado con llaves de sandbox para el host que usan las familias de Dynasty.
- **Qué hacer:**
  1. Confirmar la ruta: qué host y qué pantalla usaron esas familias (logs de Render/Vercel del 27-ago al 19-sep).
  2. Revisar el valor de `VITE_WOMPI_PUBLIC_KEY` en los proyectos de Vercel y de `WOMPI_PUBLIC_KEY` / `WOMPI_INTEGRITY_SECRET` en los 3 BFF de Render.
  3. Hacer que `ParentCheckoutPage` use la firma y la llave del BFF, igual que `PaymentCheckoutModal`, y que el frontend **nunca** caiga a la llave de sandbox en un build de producción.
- **Ninguna plata fue a parar al sandbox:** con firma inválida Wompi rechaza la transacción.

## Punto de partida

Resumen de §3 del spec.
- **Base a medias:** faltan las tablas, el cron y la Edge Function del débito. Las migraciones viejas no se pueden aplicar.
- **Backend** con 14 defectos, entre ellos cobrar con las llaves de ENV, tratar un PENDING como fallo (doble cobro) e insertar un pago nuevo en vez de liquidar el cobro del mes.
- **Frontend** sin ningún flujo real.
- **`payment_links` no caduca solo:** hay 59 pendientes, todos vencidos.
- **Wompi** apaga `GET /v1/merchants/{pub}` el 31-oct.

## Fases

| Fase | Qué | Demuestra | Depende de |
|---|---|---|---|
| **F0 — Hotfix de seguridad** | Migración propia. Cerrar `payment_tokens` (SELECT del dueño; REVOKE de escritura a anon y authenticated), igual en `pending_card_saves` y `payment_consents`. DROP de la `create_recurring_subscription` de 8 argumentos (ejecutable por anon). **Bloqueada:** ver "Decisión pendiente de F0". | 42501 para anon/authenticated. Ninguna SECURITY DEFINER sobre esas tablas ejecutable por `PUBLIC`/`anon`/`authenticated`. Invariantes sin I3 | Tu decisión |
| **Preguntas a Wompi** | Las 10 de §17 del spec, enviadas ya | Respuestas a la 1 (activación de Nequi y Bancolombia) y la 8 (aprobación por cobro) | Nada |
| **F1 — Base consolidada** | Una migración nueva con: suscripción por atleta y escuela; `autopay_cycles` (aviso obligatorio, `announced_total`, omitidos sin consumir intento); intentos con lease; `autopay_incidents`; `first_period`; los tres interruptores (oferta, pausa de débitos por escuela y `platform_config` global); latido; RPCs con `p_user_id`; RLS con `user_admin_school_ids()`; cron desde vault. | Las 13 pruebas de §14 del spec | F0, spec v0.2 aprobado, Wompi 1 y 8 |
| **F2 — Motor en el BFF** | Resolver de credenciales; débito vía `payment_links` `origin='autopay'` + `SCH-`; regla de checkouts manuales con consulta a Wompi; 409 en `create-session`; detector de cobro doble con red diaria; barrido cada 15 min; alertas por Sentry + in-app; `GET /merchants/info`; logs sin datos personales. | vitest + sandbox. **Medir** cuánto tarda un PENDING en resolverse para fijar los tiempos del barrido | F1 |
| **F3 — Tarjeta** | Alta sin pago previo, consentimiento, Mis Pagos real, aviso con "Ya pagué este mes". | QA en celular real contra sandbox | F2, pregunta 10 (PCI) |
| **F4 — Nequi y Bancolombia** | Tokenización, espera y eventos. | Sandbox y una cuenta real del equipo | F3, preguntas 2, 3 y 5 |
| **F5 — La escuela lo ofrece** | Interruptores en `SportMapsPaySettings`, panel, incidentes, material para invitar. | Radio cero | F3 |
| **F6 — Piloto** | Dynasty, si la escuela lo decide. Daviplata (activación). Procedimiento de devolución cerrado con la respuesta 9. | Métricas frente a sep-2026 | F5, checkout arreglado |

**Orden de trabajo:**
1. F0, después de tu decisión.
2. Preguntas a Wompi ya.
3. Arreglo del checkout (urgente, aparte).
4. Aprobación del spec v0.2.
5. F1 cuando Wompi responda la 1 y la 8.

## Decisión pendiente de F0

La verificación previa encontró llamadas vivas a la sobrecarga vieja de `save_payment_token(uuid, text, text, …, text)` (11 argumentos, `search_path=public`):
- `bff/src/routes/mercadopago.ts:760`: `maybeCaptureMpCard`, que corre en el webhook de un pago aprobado de Mercado Pago. Está envuelta en `.catch`, así que un fallo solo se loguea.
- `bff/src/routes/mercadopago.ts:903`: `POST /api/v1/payments/mp/save-card`. Devolvería 500 `persist_token_failed`.

En la práctica ninguna corre:
- Mercado Pago está apagado en el frontend desde SEG-23.
- `saveMpCard` no lo llama nadie.
- El último pago por Mercado Pago es del 2026-05-06 (3 en total).

Esa función solo la puede ejecutar `service_role`, así que **no está expuesta**: no es un hueco de seguridad, es deuda.

El resto salió limpio:
- La `create_recurring_subscription` de 8 argumentos no la llama nadie con esa firma. El BFF la llama con 11 parámetros con nombre, que no coinciden, así que ya estaba rota.
- El frontend no escribe directo en ninguna de las 3 tablas.
- El BFF escribe en `payment_tokens` y `payment_consents` con `service_role`, al que el REVOKE no afecta.
- No hay vistas ni triggers sobre las tablas; solo la FK `payment_consents → payment_tokens`.
- Las 5 RPCs existentes que las tocan son solo de `service_role`.

Respaldo de las dos funciones: `out/f0-backup/functiondefs-2026-09-29.sql`.

**Opciones:**
- **A (recomendada):** F0 **sin** borrar la sobrecarga vieja. Solo se le fija `search_path = pg_catalog, public, pg_temp`. Se borra en F2, junto con adaptar esas dos llamadas de Mercado Pago a la firma nueva (o devolver 410 en `save-card`). F0 cierra todo lo que está expuesto hoy, sin tocar código.
- **B:** F0 la borra ya, y en la misma rama se cambian las dos llamadas de `mercadopago.ts` (deploy del BFF incluido).
