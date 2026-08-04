# Cobranza por WhatsApp — S0: plantillas Meta

8 plantillas **UTILITY** (`es_CO`) para la escalera de cobranza. Se registran
**una vez a nivel WABA** y sirven para todos los números de escuela.

## Las 8 plantillas

| Archivo | Escalón | Botón |
|---|---|---|
| `pago_recordatorio_previo.json` | día -5 | Pagar ahora |
| `pago_vence_manana.json` | día -1 | Pagar ahora |
| `pago_vence_hoy.json` | día 0 | Pagar ahora |
| `pago_pendiente_suave.json` | día +2 (abre conversación) | Pagar ahora |
| `pago_pendiente_directo.json` | día +7 (opciones/acuerdo) | Ver opciones de pago |
| `pago_aviso_final.json` | día +12 | Pagar ahora |
| `pago_confirmado.json` | evento | Ver comprobante |
| `abono_recibido.json` | evento | Ver detalle |

Todas usan botón URL dinámica con base fija `https://sportmaps.co/p/{{1}}`
(el token de link va como sufijo, nunca la URL completa en el body).

## Registrar (S0)

```bash
export WABA_ID="TU_WABA_ID"
export SYSTEM_USER_TOKEN="TU_TOKEN_PERMANENTE"   # System User, permanente
./register-templates.sh
```

Cada respuesta: `{ "id": "...", "status": "PENDING" }` → guardar en
`payment_message_templates.meta_template_name` / `meta_template_status`.
La aprobación llega por el webhook `message_template_status_update`.

## Al ENVIAR (cuando estén APPROVED)

El botón dinámico se llena solo con el **token**, no la URL:

```json
{ "type": "button", "sub_type": "url", "index": "0",
  "parameters": [{ "type": "text", "text": "aB3xK9mQ" }] }
```

## Notas para que pasen a la primera

1. **`example` es obligatorio de facto** — Meta rechaza variables sin ejemplo y
   los usa para juzgar la categoría. Ya vienen con ejemplos realistas en COP.
2. **Riesgo de recategorización a MARKETING** — los textos están redactados
   neutros/transaccionales. Si alguna vuelve recategorizada, **apelar** en
   Business Manager (recordatorio de pago atado a transacción existente = Utility
   por definición de Meta). No reenviar como Marketing (cuesta 3x).
3. **Dominio del botón: `sportmaps.co`** (decisión tomada). Meta valida el
   dominio **al enviar**, no al registrar → se puede registrar hoy. La ruta
   pública `GET /p/:token` (spec §4) debe existir antes del primer **envío**.
   Cambiar la URL luego = editar plantilla + re-aprobación.
4. **Token de System User**, no temporal (el temporal expira y tumba la cobranza).
   Debe estar cifrado con el patrón AES-GCM (igual que WA1 / pasarelas).

## Checklist S0

- [ ] Token de System User permanente generado (Business Settings → System Users)
- [ ] `WABA_ID` + `SYSTEM_USER_TOKEN` exportados
- [ ] `./register-templates.sh` ejecutado → 8 respuestas PENDING
- [ ] ids/status guardados en `payment_message_templates`
- [ ] Webhook `message_template_status_update` suscrito (para recibir APPROVED)
- [ ] Confirmar que las 8 quedan APPROVED (no recategorizadas)
