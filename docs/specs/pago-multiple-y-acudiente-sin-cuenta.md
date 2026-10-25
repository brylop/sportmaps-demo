# Pago múltiple y acudiente sin cuenta

**Estado:** spec para aprobar, 2026-10-25. Sin código. Frente del acudiente V2 ([`modulos-v2-definicion.md`](modulos-v2-definicion.md) §4.1). Lo que más mueve plata del acudiente.

---

## 0. El problema, medido

**Pagar varios cobros.** El BFF firma la sesión de pago de **un** cobro (`POST /api/v1/payments/create-session`; el enlace público `/p/:token` también paga «SOLO el cobro del token»). Hoy la V2 paga los cobros marcados **uno por uno** con el mismo modal. Con transferencia es peor: la base no deja usar el mismo comprobante en dos cobros (`uq_payments_school_receipt_hash`), así que una sola transferencia por la mensualidad de dos hijos no se puede registrar sola: la escuela la reparte a mano.

**Acudiente sin cuenta.** Hay **731 cobros abiertos sin pagador** en la plataforma (`parent_id` y `user_id` nulos); **362** son de fichas que cargó la escuela (`unregistered_athletes`) y el resto de menores sin `parent_id`. Caso real: Besser, 12 familias, $6,32 M.
- El enlace `/p/:token` **ya cobra sin sesión** y sirve para cobros sin pagador. Lo que falta es que alguien se lo mande.
- El bot de WhatsApp busca los pagos por `parent_id` (`wa_get_payment_status`): al acudiente sin cuenta lo trata como desconocido. No le dice que debe.
- De 628 fichas, 214 tienen el celular del acudiente.
- Cuando el acudiente se registra, su ficha no se vincula con el hijo: sus cobros, documentos (1.009 de Monster) y asistencia quedan huérfanos.

---

## 1. Qué se construye

### 1.1 Pago múltiple en línea (un solo pago)
- **BFF:** `POST /api/v1/payments/create-session` acepta `payment_ids: uuid[]` (máx. 12, misma escuela, mismo pagador o mismos hijos). Calcula **en el servidor** el total (saldo de cada uno, pronto pago y recargo como hoy) y firma **una** transacción de Wompi/MP con una referencia de grupo.
- **Base:** tabla `payment_groups` (id, school_id, referencia, total, estado) y `payment_group_items` (group_id, payment_id, monto aplicado). Creación por RPC `SECURITY DEFINER` transaccional (regla: multi-fila = RPC, nunca inserts sueltos).
- **Webhook:** al aprobarse la transacción del grupo, aplica el pago a cada cobro en una sola transacción, con `FOR UPDATE` sobre los cobros. Si un cobro cambió de estado entre la firma y el webhook (lo pagaron por otro lado), ese monto queda como saldo a favor y se avisa a la escuela; nunca se cobra dos veces.
- **Frontend:** «Pagar 3 cobros · $460.000» abre **un** checkout. Desaparece la fila «uno por uno».
- **El enlace de WhatsApp** puede llevar un grupo: «Pagar todo lo de octubre ($460.000)».

### 1.2 Un comprobante para varios cobros
- La familia sube **un** comprobante y marca los cobros que cubre.
- Se guarda una fila de comprobante con su huella y su asignación a cada cobro (`payment_receipt_allocations`: comprobante, cobro, monto). El índice único pasa a la tabla de comprobantes, no a cada cobro.
- La auto-revisión compara el monto leído contra la **suma** de los cobros. Si no cuadra, va a la escuela con el detalle.

### 1.3 Acudiente sin cuenta
1. **El bot lo reconoce por teléfono:** si el número coincide con `unregistered_athletes.guardian_phone` (normalizado), responde con la deuda de esas fichas y el enlace `/p/:token` (o el de grupo). Nunca dice «estás al día» si hay cobros sin pagador de sus fichas.
2. **Cobranza a fichas:** los recordatorios (−3/0/+3…) también salen a las fichas con correo o celular, con el enlace de pago.
3. **Vincular al registrarse:** cuando alguien se registra o entra con la invitación, si su correo o celular coincide con el acudiente de una ficha de su escuela, se le propone «¿Eres el acudiente de Sofía?». Con un toque se crea el hijo vinculado y se le pasan **cobros, documentos, asistencia e inscripciones** de la ficha (RPC transaccional, idempotente, con registro de lo movido). Sin coincidencia exacta, va a la bandeja de la escuela; nunca se adivina.
4. **Escuela:** en Deportistas, filtro «Sin acudiente con cuenta» con botón «Invitar por WhatsApp».

---

## 2. Fases

| Fase | Qué | Hecho cuando |
|---|---|---|
| F0 | Bot reconoce fichas por teléfono y manda el enlace · cobranza también a fichas | Las 12 familias de Besser reciben su enlace y una paga sin cuenta |
| F1 | Vincular ficha ↔ hijo al registrarse (cobros, documentos, asistencia) | Un acudiente nuevo ve los documentos que cargó la escuela |
| F2 | Pago múltiple en línea (grupo + webhook) | Una familia paga dos mensualidades en un solo pago |
| F3 | Un comprobante para varios cobros | Una transferencia por dos cobros queda aplicada sin la escuela |

Requisitos de cada fase: plan antes de código en las migraciones; RLS revisada línea por línea (`user_staff_school_ids()` para escribir, nunca `user_school_ids()`); pruebas de concurrencia (dos webhooks del mismo grupo, pago por otro lado entre firma y webhook); `seguridad:invariantes` sin CRÍTICAS; medir el radio antes de aplicar (cuántos cobros y escuelas toca); una sola sesión aplica migraciones.

**Dependencia:** F2 necesita que el webhook de Wompi esté llegando. En Dynasty no llega desde el 07-oct (revisar el panel de Wompi antes de F2).

---

## 3. Cómo se mide

| Métrica | Hoy | Meta |
|---|---|---|
| Cobros abiertos sin pagador | 731 | −50 % en 60 días |
| Toques para pagar dos mensualidades | 2 checkouts | 1 |
| Comprobantes que la escuela reparte a mano | Sin medir | 0 en las escuelas piloto |
| Fichas vinculadas al registrarse | 0 | Todas las de coincidencia exacta |

---

## 4. Decisiones abiertas

| # | Pregunta | Propuesta |
|---|---|---|
| P1 | ¿Un grupo de pago puede mezclar mensualidad e inscripción/seguro? | Sí; cada uno conserva sus reglas (mora y vigencia solo la mensualidad) |
| P2 | Si sobra plata en un grupo (cobro pagado por otro lado), ¿saldo a favor o devolución? | Saldo a favor y aviso a la escuela |
| P3 | ¿Vincular ficha por correo, por celular o por los dos? | Los dos; con uno solo, confirmación de la escuela |
| P4 | Recargo de la pasarela en un grupo: ¿uno por grupo o por cobro? | Uno por grupo (más barato para la familia) |
