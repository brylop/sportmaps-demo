# #17 · Checkout en línea de Dynasty — informe (2026-10-23)

Frente del ROADMAP v2.38. Solo lectura sobre la base; un cambio de código en `frontend/src/lib/api/wompi.ts`, sin commit.

## 1. Estado medido hoy (sin imprimir secretos)

| Dato | Valor |
|---|---|
| `schools.payment_mode` | `direct` |
| Proveedor | `wompi`, habilitado, por defecto, `sandbox=false` |
| Llave pública | prefijo `pub_prod_…` |
| `connect_status` | `connected_pending_webhook` (desde el 13-oct 16:25) |
| Secretos guardados | privada, de integridad y de eventos: **los tres presentes** |
| Enlaces desde el 13-oct | 17: 15 `pending`, 2 `expired`, **0 pagados**; todos con `provider_reference` |
| Último enlace pagado de Dynasty | 07-sep-2026 (39 pagados en total) |
| Último evento de Wompi recibido (`webhook_events`, todas las escuelas) | **07-oct-2026**; desde el cambio a `direct`: 0 eventos |
| Enlaces `pending` con `expires_at` ya vencido | 79 (siguen en `pending`; es cosmético, no cobra nadie) |

**Lectura:** el BFF ya crea los enlaces con la llave de producción de Dynasty (todos tienen referencia del proveedor), pero **nadie los ha pagado y Wompi no ha llamado nunca al webhook** desde el cambio. Por eso sigue en `connected_pending_webhook`. No hay falla de código en el cobro; falta la prueba real y comprobar que el comercio de Dynasty en Wompi apunte al webhook correcto.

## 2. Cómo funciona (para no volver a leerlo)

- El webhook es `POST /api/v1/webhooks/wompi/webhook` (`bff/src/routes/wompi.ts:222`, montado en `bff/src/index.ts:323`). **El sufijo `/webhook` no es opcional**: sin él responde 401 y falla en silencio.
- Con la referencia del evento busca la escuela en `payment_links` y valida el checksum SHA256 con **el `events_secret` de esa escuela**. Luego re-consulta la transacción a Wompi y recién ahí marca el cobro como pagado.
- `connected_pending_webhook` **sí cobra** (`payment-provider.resolver.ts:382-390`: exigir `connected` sería un deadlock).
- **Hallazgo:** ningún código del BFF cambia `connect_status` de `connected_pending_webhook` a `connected`. Solo lo escribe el alta manual (`payment-providers.routes.ts:191`). O sea que **aunque el webhook funcione, el estado se queda en `connected_pending_webhook`**. Es cosmético; no bloquea cobros. Mejora opcional futura: que el webhook, tras el primer checksum válido, ponga `connected`.
- Los comercios de Dynasty (de la memoria `project_dynasty_checkout_sandbox_merchant`): real `1298966`, sandbox `11981889`.

## 3. Cambio de código hecho (sin commit)

`frontend/src/lib/api/wompi.ts`:

1. **Se quitó `VITE_WOMPI_PUBLIC_KEY`** (constante, `console.error` de arranque y el `publicKeyFromBff || WOMPI_PUBLIC_KEY`). La llave sale siempre del BFF.
2. Si el BFF no devuelve `publicKey`, `openWompiCheckout` **no abre el Widget**, devuelve `null` (mismo contrato que antes) y deja en consola un error claro que nombra a la escuela y dice dónde conectar su Wompi.
3. `checkTransactionStatus` usaba esa misma variable para elegir sandbox o producción. Sin ella habría consultado sandbox para un pago real, así que ahora **prueba producción y, si no la conoce, sandbox** (consulta pública, sin llave).

Verificado antes de quitarlo:
- Todos los llamadores reales (`usePaymentCheckout`, `useWompiCheckout`, `ParentCheckoutPage`, `PedidoInvitadoPage`, `MiCompraDetallePage`, `StoreCheckoutPage`) ya pasan `publicKey` del BFF.
- El único que no la pasaba, `PaymentProviderGate`, **no lo importa ninguna pantalla** (solo comentarios).

Comprobaciones: `tsc` limpio, `eslint` limpio en el archivo, y las 2 pruebas que rodean el flujo (`checkoutNoClientPayment`, `storeCheckoutContract`) pasan 14/14. No existe prueba unitaria propia de `wompi.ts`.

Quedó sin tocar, a propósito (fuera del alcance de este frente): `frontend/src/vite-env.d.ts` aún declara `VITE_WOMPI_PUBLIC_KEY`, y un comentario en `hooks/useWompiCheckout.ts` (~línea 183) todavía dice que `openWompiCheckout` «cae al camino legacy». Y conviene borrar la variable `VITE_WOMPI_PUBLIC_KEY` de Vercel/`frontend/.env` cuando se publique este cambio.

## 4. Checklist para el usuario (depende del panel de Wompi)

**A. Panel de Wompi — comercio de producción de Dynasty (`1298966`)**
1. Desarrolladores → *URL de eventos* (producción): `https://sportmaps-bff-prod.onrender.com/api/v1/webhooks/wompi/webhook` — con `/webhook` al final.
2. Evento: `transaction.updated` (es el único que el BFF procesa; los demás los ignora).
3. Confirmar que el *Secreto de eventos* que muestra Wompi es el **mismo** que se cargó en SportMaps. No se puede leer desde acá. Si hay duda, se vuelve a cargar con las tres llaves desde Super Admin → Pasarela de la escuela (el alta las sobrescribe cifradas).
4. Confirmar que la web de producción que usan las familias llama a ese mismo BFF (`sportmaps-bff-prod`). Si llamara a otro, el webhook caería en una base distinta.

**B. Pago real de bajo monto**
1. Crear un cobro de monto bajo (el mínimo que acepte el comercio) para un deportista del propio equipo del usuario, y abrir el enlace/checkout en línea.
2. Pagar con una tarjeta real. Anular o devolver después desde Wompi.

**C. Verificar en la base (solo lectura)**
```sql
-- 1) ¿llegó el webhook?
select event_type, status, created_at from webhook_events
 where provider='wompi' and created_at >= '2026-10-23' order by created_at desc limit 5;
-- 2) ¿el enlace quedó pagado?
select status, paid_at, provider_reference from payment_links
 where school_id='2d509571-3238-4c04-ac3f-6dfe20539226' order by created_at desc limit 3;
-- 3) el comercio correcto: la referencia/transacción debe ser del 1298966, no del 11981889
select wompi_transaction_id, status from payments
 where school_id='2d509571-3238-4c04-ac3f-6dfe20539226' order by updated_at desc limit 3;
```
Éxito = evento `transaction.updated` en `processed`, enlace `paid` con `paid_at`, y transacción del comercio `1298966`.

**D. Si falla**
- `webhook_events` vacío y el pago se hizo → la URL de eventos está mal o apunta a otro BFF (A.1 / A.4).
- Evento con 401 en los logs de Render (`Wompi webhook checksum mismatch`) → el secreto de eventos no coincide (A.3).
- Widget que no abre → ver consola: «Checkout Wompi bloqueado… no tiene llave pública propia».

## 5. Pendiente que no es de este frente
- Hacer que `connect_status` pase a `connected` tras el primer webhook válido (cosmético).
- Los 79 enlaces vencidos que siguen en `pending`.
