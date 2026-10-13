# Cobranza por WhatsApp — S0: plantillas Meta

8 plantillas **UTILITY** (`es_CO`) para la escalera de cobranza. Se registran
**por WABA**: sirven para todos los números que cuelgan de ESA WABA. Una escuela
que entra por Coexistence trae la suya, y ahí hay que registrarlas de nuevo:

```bash
npx tsx scripts/wa-copiar-plantillas.ts --desde <school_id_origen> --hacia <school_id_destino>            # simula
npx tsx scripts/wa-copiar-plantillas.ts --desde <school_id_origen> --hacia <school_id_destino> --aplicar  # registra
```

Copia lo APROBADO tal cual está en Meta, solo UTILITY salvo `--con-marketing`,
y salta lo que ya exista en destino.

## Las 8 plantillas

| Archivo | Escalón | Botón |
|---|---|---|
| `pago_recordatorio_previo_v3.json` | día -5 | Ver detalle del cobro |
| `pago_vence_manana.json` | día -1 | Pagar ahora |
| `pago_vence_hoy_v4.json` | día 0 | Ver detalle del cobro |
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

## Por que dos plantillas llevan `_v2`

`pago_vence_hoy` y `pago_recordatorio_previo` fueron reclasificadas por Meta a
**MARKETING** sin que nadie lo pidiera — lo que cambia el costo Y el
consentimiento exigido, porque marketing necesita un opt-in distinto del que
tenemos.

La causa estaba en el texto. Las que se quedaron en UTILITY **enuncian el hecho**
("presenta {{4}} dias de vencida", "el caso pasa a gestion directa de {{4}}");
las dos reclasificadas **vendian la comodidad**: "Paga en un tap desde el boton"
y "Puedes pagarla en un minuto" con un emoji de saludo. Se reescribieron con el
dato y la consecuencia, sin el argumento de venta.

El `_v2` no es capricho. Al borrar la version MARKETING para recrearla como
UTILITY, Meta responde:

> No puedes cambiar la categoria de esta plantilla mientras se esta eliminando el
> contenido actual. Vuelve a intentarlo en 4 weeks o usa MARKETING como categoria.

Meta recuerda el nombre borrado durante un mes y bloquea el cambio de categoria
en ese lapso. Un nombre nuevo no arrastra ese historial.

**Antes de borrar una plantilla en uso, tenerlo en cuenta:** queda fuera de
servicio y no se puede recrear con la misma categoria hasta pasado el mes.

## Segunda reclasificación (2026-10-01): `_v3` / `_v4`

Las `_v2` (y una `pago_vence_hoy_v3` creada desde la pantalla) también terminaron en
MARKETING, ya sin ningún argumento de venta. Sacar adjetivos no alcanzó. Dato que lo
confirma: `pago_vence_manana` tiene el MISMO texto que `pago_vence_hoy_v3` y sigue en
UTILITY — el clasificador de Meta no es determinista por frase.

Las nuevas se escriben como **estado de cuenta de un cobro concreto**: periodo
(`octubre 2026`), valor y vencimiento como datos, sin "evita recargos", y botón
"Ver detalle del cobro" en vez de "Pagar ahora". Ojo: cambian las variables
(`{{2}}` = escuela, `{{4}}` = periodo), así que el que las envíe debe mapearlas
de nuevo. Las `_v2`/`_v3` quedan en la WABA de prueba como MARKETING, sin uso, y
se apelaron; no borrarlas (ver arriba: el nombre queda bloqueado un mes).

## Avisos de evento y cortesía (2026-10-07)

| Archivo | Cuándo sale | Botón |
|---|---|---|
| `pago_recibido_otro_concepto.json` | pago aprobado de algo que NO es mensualidad (uniforme, torneo…), ventana cerrada | Ver comprobante |
| `comprobante_en_revision.json` | comprobante recibido y en revisión de la escuela, ventana cerrada (recuperación / cola atrasada) | — |
| `recordatorio_clase_cortesia.json` | víspera de la clase de cortesía, 18:00 COT (job `recordatorio-cortesia`) | — (se responde «CANCELAR») |

Mientras no estén APPROVED en la WABA de la escuela, el código se comporta como
antes (no manda nada por WhatsApp en ese caso).

**Registrarlas:** desde la app, *WhatsApp → pestaña Plantillas → «Plantillas de
SportMaps que faltan en tu cuenta» → Enviar a Meta* (manda el JSON tal cual, con
ejemplos y botón). O por consola, desde `bff/`:

```bash
npx tsx scripts/wa-registrar-plantilla.ts pago_recibido_otro_concepto <school_id>
npx tsx scripts/wa-registrar-plantilla.ts comprobante_en_revision <school_id>
npx tsx scripts/wa-registrar-plantilla.ts recordatorio_clase_cortesia <school_id>
```

## Plantillas del canal de PLATAFORMA (`plataforma/`)

Viven en la WABA **de SportMaps** (número comercial +57 320 268 3539), no en la de
ninguna escuela. Por eso están en una subcarpeta: `register-templates.sh` solo
lee `*.json` de esta carpeta y `wa-copiar-plantillas.ts` copia entre WABAs de
escuelas; ninguno de los dos las ve. Spec: `docs/specs/canal-whatsapp-plataforma.md`.

| Archivo | Aviso | Variables | Botón (sufijo de `https://app.sportmaps.co/{{1}}`) |
|---|---|---|---|
| `sm_comprobantes_por_revisar.json` | comprobantes por validar | escuela · cantidad · espera | `payments-automation?tab=recurrent` |
| `sm_caso_por_atender.json` | escalación / solicitud de retiro | escuela · qué pasó | `whatsapp?conversacion=<id>` |
| `sm_clase_cortesia_novedad.json` | clase de cortesía (agendada, llegada…) | escuela · qué pasó | `whatsapp?tab=cortesias` |
| `sm_resumen_diario.json` | resumen de las 7:00 | escuela · resumen | `whatsapp?tab=conversaciones` |
| `sm_informe_cartera_semanal.json` | cartera de los lunes (solo cifras) | escuela · familias · total · comprobantes | `finances` |

Todas UTILITY `es_CO`. Solo se usan cuando la dueña NO escribió al número en
las últimas 24 h; dentro de la ventana sale texto libre con botón.

```bash
npx tsx scripts/wa-plataforma.ts plantillas            # simula: muestra lo que mandaría
npx tsx scripts/wa-plataforma.ts plantillas --aplicar  # las registra en la WABA de SportMaps
npx tsx scripts/wa-plataforma.ts estado                # canal + estado de cada plantilla en Meta
```

NO usar `wa-registrar-plantilla.ts` para estas: ese script registra en la WABA
de una ESCUELA.
