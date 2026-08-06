# Spec — Consola de Soporte (super_admin)

**Estado:** F0 implementado en `develop` (2026-08-05) — F1 en adelante sin código
**Origen:** incidente 2026-08-05, `miguelangelrunzaramirez@gmail.com` (Coliseo Dynasty)
**Objetivo:** que un caso de "no puedo entrar" se resuelva desde la UI en 2 minutos, sin abrir la base ni correr scripts con la service key.

---

## 1. El caso que origina la spec

Un atleta reportó que no podía entrar y pidió **borrar su cuenta para volver a crearla con el link de invitación**. La realidad de la base era la opuesta:

| Hecho | Valor |
|---|---|
| Cuenta de auth | existía, correo confirmado |
| Invitación de Dynasty | **ya `accepted`** |
| Inscripción | activa, con equipo y PLAN PRO $150.000 |
| Duplicidad | ninguna — el registro precargado quedó `linked_profile_id` + `is_active=false` |

O sea: **ya estaba adentro.** Borrar la cuenta habría sido catastrófico y silencioso, porque `accept_invitation_pro` solo procesa invitaciones en `pending`; con una `accepted` hace `RETURN true` **sin hacer nada**. Una cuenta nueva habría recibido un "¡invitación aceptada!" y habría quedado vacía, sin escuela, sin equipo y sin plan — y el club habría tenido que emitir una invitación nueva.

**Costo real del diagnóstico:** ~8 consultas ad-hoc con la service key contra la base compartida, escribiendo scripts desechables. Eso es lo que hay que eliminar.

### Los tres modos de falla que se confirmaron

1. **El link de recuperación muere en el WebView de WhatsApp.** El interceptor de `PASSWORD_RECOVERY` hacía una navegación dura a `/reset-password`, lo que obliga a que la sesión sobreviva en `localStorage` — cosa que el navegador interno de WhatsApp restringe. Resultado: "Enlace Inválido" con un token que **sí** se había canjeado bien (se vio en `last_sign_in_at`). Ya corregido con `token_hash` + `verifyOtp()`, pendiente de despliegue.
2. **El link expone `<ref>.supabase.co`,** que la gente no reconoce y no abre.
3. **El token es de un solo uso y no hay señal de eso en la UI.** El segundo clic da "Enlace Inválido" y parece que la cuenta está rota.

---

## 2. Principio de diseño

> **Diagnóstico primero, acción después.** Ninguna acción destructiva se ofrece sin mostrar antes el estado que la justifica.

El error del incidente no fue técnico: fue que nadie podía *ver* que la cuenta ya estaba bien. La consola existe para que el estado sea obvio, y para que la acción correcta sea la más fácil de tomar.

Corolario: **la opción "eliminar cuenta" no va en esta consola.** Es la que el usuario pide y casi nunca la que necesita. Las eliminaciones siguen siendo manuales y deliberadas (ver `docs/` sobre gotchas de borrado: hay refs escondidas en `school_staff.coach_auth_id` y `storage.objects.owner`).

---

## 3. Panel de diagnóstico (F0 — solo lectura)

Se abre desde `AdminUsersPage` con un botón por fila. Un solo endpoint, un solo render.

```
GET /api/v1/admin/support/user-state?email=<x>   (o ?userId=<uuid>)
```

**Bloque A — Acceso.** Responde "¿puede entrar?" sin ambigüedad:

| Campo | De dónde | Por qué importa |
|---|---|---|
| `email_confirmed_at` | `auth.users` | NULL ⇒ el login lo rechaza. Causa #1 real de bloqueo. |
| `last_sign_in_at` | `auth.users` | Si es reciente, **la contraseña sirve** y no hay nada que restablecer. |
| `banned_until` | `auth.users` | Descarta bloqueo administrativo. |
| `identities[].provider` | `auth.users` | Vacío ⇒ solo password. Si tiene `google`, pedirle contraseña es un callejón sin salida. |
| `recovery_sent_at` | `auth.users` | Contra `last_sign_in_at` revela si el token ya se consumió. |
| Correos parecidos | `ilike` en `profiles`, `invitations`, `children.parent_email_temp` | Un typo en el correo no se arregla con reset. |

**Bloque B — Pertenencia.** `school_members`, `enrollments`, `invitations` (con su `status`), y la fila de `school_athletes` (la vista que la escuela factura).

**Bloque C — Duplicidad.** Reusar la lógica ya escrita en `scripts/check-duplicate-identity.mjs`: rastrear por **documento, teléfono y fecha de nacimiento, nunca por nombre** (`Dai Vázquez` vs `DAIMARIS VASQUEZ PEREZ` no matchea por texto). Señales: dos cuentas de auth para la misma persona, `unregistered_athletes` activo y sin vincular existiendo ya un perfil, >1 inscripción activa, cobros mismo mes/monto/escuela.

**Bloque D — Veredicto en una línea.** `✅ Puede entrar y está inscrito` / `❌ Correo sin confirmar` / `⚠️ Identidad partida en dos`. Con la acción recomendada resaltada y las demás en segundo plano.

F0 no escribe nada, así que se puede desplegar sin riesgo y ya ahorra la mayor parte del trabajo de soporte.

### Implementado (2026-08-05)

| Pieza | Archivo |
|---|---|
| Diagnóstico (bloques A–D) | `bff/src/services/support-diagnosis.service.ts` |
| Endpoint | `bff/src/routes/admin-support.routes.ts` → `/api/v1/admin/support/user-state` |
| Panel | `frontend/src/components/admin/UserStateDialog.tsx`, abierto desde `AdminUsersPage` |

Dos cosas que se descubrieron al construirlo y que valen para todo lo que siga:

1. **`requireRole('super_admin')` NO alcanza.** El middleware tiene un escape hatch
   (`PRIVILEGED_ROLES`) que deja pasar siempre a `owner`, `admin` y `super_admin`, así que
   `requireRole('super_admin')` también autoriza a cualquier `admin` — y hay cuentas `admin` en la
   base. Como el endpoint expone datos de `auth` de terceros, el gate se escribe explícito
   (`requireSuperAdminStrict`). Lo mismo aplica a F1/F2.
2. **`profiles.document_number` vs `unregistered_athletes.doc_number` / `children.doc_number`.**
   No son la misma columna; confundirlas devuelve 400 en PostgREST.

`buildUserState()` vive en `services/` y no dentro del router porque acepta `scope: 'self'`: es la
misma función que va a alimentar la tool `get_my_state` del bot (S1 de la spec hermana). Con
`scope: 'self'` se omiten las señales sobre terceros (cuentas de auth ajenas, correos parecidos).

---

## 4. Acciones

### F1 — Seguras (sin confirmación extra)

**Reenviar enlace de acceso.** `POST /admin/support/send-access-link`. El BFF llama `POST /auth/v1/admin/generate_link` (`type: recovery`), toma el `hashed_token` y arma el link **en nuestro dominio**:

```
https://app.sportmaps.co/reset-password?token_hash=<hashed_token>&type=recovery
```

Nunca el link crudo de `supabase.co`. Se envía por Resend **y** por WhatsApp (canal ya construido), e incluye el **`email_otp` de 6 dígitos** como alternativa: es la salida cuando el link muere en un WebView, que es exactamente lo que pasó en el incidente. Copy explícito: *"úsalo una sola vez y ábrelo en Chrome o Safari"*.

**Copiar enlace al portapapeles.** Para pegarlo a mano en un chat. Es lo que se hizo en el incidente y funciona.

**Confirmar correo manualmente.** `PUT /auth/v1/admin/users/:id` con `email_confirm: true`. Para el caso `email_confirmed_at IS NULL` cuando el correo de confirmación nunca llegó.

### F2 — Sensibles (motivo obligatorio + auditoría)

**Contraseña temporal.** Reemplaza la contraseña vigente, así que el modal debe decirlo con esas palabras. Requisitos:

- Campo **motivo obligatorio** (texto libre, mínimo 10 caracteres) que va al audit log.
- La genera el servidor (legible por teléfono, sin caracteres ambiguos); el frontend nunca la propone.
- **Marcar el perfil para cambio forzoso** en el siguiente login (`profiles.must_change_password`, columna nueva) y que `ResetPasswordPage` lo atienda.
- **Prohibido sobre cuentas `super_admin`/`admin`** — es escalada de privilegios. Validar en el BFF, no en la UI.
- Validar el resultado: el endpoint hace `grant_type=password` contra el usuario recién modificado y devuelve `verified: true` solo si el login realmente funciona. Sin eso, soporte manda credenciales sin saber si sirven.

**Reabrir invitación** (`accepted` → `pending`). Es la acción que le habría faltado al incidente: cuando alguien quedó `accepted` pero sin membresía real. Guardado: solo se ofrece si el diagnóstico muestra invitación `accepted` **y** ausencia de `school_members`/`enrollments` — si ya está inscrito, el botón no aparece.

**Revincular a la escuela.** Ejecuta la lógica de `accept_invitation_pro` de forma **idempotente**, sin depender del `status` de la invitación. Es la solución de raíz al `RETURN true` silencioso.

### F3 — Fusión de identidades duplicadas

Un RPC `SECURITY DEFINER` que ejecute la secuencia completa en una transacción, en este orden (el orden importa):

1. Pasar `team_id`/`monthly_fee` a la inscripción que sobrevive
2. Atar los pagos al sujeto correcto con el periodo correcto
3. Anular el cobro redundante
4. Cancelar la inscripción duplicada
5. `unregistered_athletes.linked_profile_id = <perfil>`

**Sobrevive siempre la identidad adulta** (la única que puede entrar, pagar y recibir avisos). Vincular en el paso 5 **sin** haber movido antes equipo y cuota deja una sola fila pero sin equipo ni plan — de ahí que el orden sea parte de la spec y no un detalle de implementación.

### F4 — Detección proactiva

Un reporte que barre todas las escuelas buscando los estados roto conocidos: correos sin confirmar con inscripción activa, invitaciones `accepted` sin membresía, `unregistered_athletes` activos y sin vincular con perfil homónimo, cobros duplicados por mes/monto. Convierte el soporte de reactivo en preventivo.

---

## 5. Seguridad (no negociable)

- **La service key jamás toca el frontend.** Todo pasa por el BFF con `requireRole('super_admin')`. Hoy `AdminUsersPage` no tiene acciones por usuario, así que no hay superficie previa que auditar.
- **Todo se audita** en `audit_logs` (`school_id`, `profile_id`, `table_name`, `record_id`, `action`) más actor, usuario objetivo y motivo. Una acción sobre la cuenta de otra persona sin registro de quién y por qué no es aceptable.
- **Nunca loguear** el `token_hash` ni la contraseña temporal en texto claro, ni en logs del BFF ni en la respuesta que quede en el historial del navegador.
- **Rate limit** por actor. Un super_admin comprometido con estos endpoints se lleva todas las cuentas.
- `ResetPasswordPage` ya limpia el token de la URL con `replaceState` para que no quede en historial ni se filtre por `Referer`. Mantener ese comportamiento.

---

## 6. Orden de entrega

| Fase | Alcance | Riesgo | Prerrequisito |
|---|---|---|---|
| **F-1** | Desplegar el fix de `token_hash` + `verifyOtp` (ya en `develop`) | Bajo | — |
| **F0** | Panel de diagnóstico solo lectura | Nulo | F-1 |
| **F1** | Reenviar/copiar enlace, confirmar correo | Bajo | F0 |
| **F2** | Contraseña temporal, reabrir invitación, revincular | Medio | F0 + auditoría |
| **F3** | Fusión de identidades | Alto | F0 + tests de concurrencia |
| **F4** | Reporte proactivo | Bajo | F0 |

F0 sola resuelve el 80% del dolor: casi todos estos casos se caen en el diagnóstico, no en la acción. En el incidente que originó la spec, **la respuesta correcta era "no hagas nada, ya está adentro"** — y eso es precisamente lo que un panel de solo lectura habría dicho en 5 segundos.

---

## 7. Pendiente de decisión de producto

1. ¿La consola es exclusiva de `super_admin`, o un `school_admin` puede reenviar enlaces **a los miembros de su propia escuela**? Lo segundo escala mucho mejor (el club destraba a sus familias sin escalar a soporte) pero amplía la superficie: habría que acotar por `school_id` y prohibir contraseñas temporales en ese rol.
2. ¿La contraseña temporal se envía sola por WhatsApp/correo, o siempre la copia un humano? Automático es más rápido; manual deja la decisión de canal en quien conoce el caso.
3. ¿Cuánto dura `must_change_password` antes de bloquear el acceso?
