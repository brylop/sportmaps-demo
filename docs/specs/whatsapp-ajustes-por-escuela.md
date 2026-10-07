# Asistente de WhatsApp: ajustes por escuela

**Estado:** construido 2026-10-06 · primer cliente: Club Deportivo Besser · migración `20261006120601_whatsapp_ajustes_por_escuela`

## Por qué

Besser pidió que el bot de WhatsApp cubra lo que más les escriben:

1. **Deportistas nuevos** → paso a paso para entrar a la app y tomar **una semana de cortesía**.
2. **Soporte de la app** → cómo entrar, cómo recuperar la contraseña, cómo pagar en la app.
3. **Cartera** → «el valor no coincide» tiene que llegarle a una persona, con el cobro a la vista.

Ninguna de las tres puede cambiarle el comportamiento a Dynasty ni a otra escuela. Por eso cada una es un **ajuste por escuela, apagado por defecto**.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| D1 | Los ajustes van en `school_settings`, **no** en `whatsapp_settings` | `whatsapp_settings` es por integración y no existe hasta que la escuela conecta su número. Así quedan listos antes de conectar. |
| D2 | Defaults = comportamiento de hoy (`clase`, `false`, `false`) | Aplicar la migración no cambia nada para nadie. |
| D3 | Respuestas **deterministas**, sin modelo | Son textos con datos de la base (enlace, horarios, cobros). El modelo es donde se inventa un horario o un valor, y además gasta la cuota compartida de Groq. |
| D4 | El QR de cortesía se valida en el BFF en cada uso: misma escuela, activo, sin vencer, **sin cobro inicial** (`require_first_payment = false`) | Si no pasa, el bot ignora el ajuste y responde como antes. Nunca manda un enlace que cobra diciendo que es gratis. |
| D5 | El reclamo de valor **no corrige nada**: abre la conversación en el buzón y avisa (push + correo) con los cobros abiertos | Mover plata es decisión de la escuela. |
| D6 | La ayuda de «cómo pagar» solo se dispara si mencionan la app | «¿Cómo pago?» suelto sigue yendo a los medios de pago (cuentas), como hoy. |

## Ajustes (`school_settings`)

| Columna | Tipo | Default | Efecto |
|---|---|---|---|
| `wa_modo_cortesia` | text CHECK (`clase`, `semana_app`) | `clase` | `semana_app`: al prospecto y a «¿tienen clase de cortesía?» se les manda el paso a paso del enlace de cortesía |
| `wa_cortesia_qr_id` | uuid FK → `school_join_qr_codes` ON DELETE SET NULL | NULL | El enlace que se manda en `semana_app` |
| `wa_cortesia_dias` | smallint CHECK 1–60 | 7 | Los días que se anuncian |
| `wa_ayuda_app` | boolean | false | Responde ingreso / contraseña / pagar en la app |
| `wa_reclamos_de_valor` | boolean | false | «El valor no coincide» → buzón como reclamo |
| `wa_responder_precios` | boolean | false | Al desconocido que pregunta «¿cuánto cuesta?», los valores de los planes activos (`offering_plans` con precio > 0) y la semana de cortesía si aplica, **sin enlace de pago**. Mig `20261006224322`. Sin el ajuste, «cuánto cuesta» suelto no se contesta y «cuánto vale la mensualidad» recibe el enlace de inscripción |

## Dónde se engancha (BFF)

Lógica en archivos nuevos; en `whatsapp-bot.service.ts` solo hay puntos de enganche:

- `whatsapp-ajustes-escuela.service.ts`: lee los ajustes. Si las columnas no existen (la migración no está aplicada), devuelve los defaults.
- `whatsapp-cortesia-semana.service.ts`: valida el QR, resume el horario de los equipos y arma el paso a paso.
- `whatsapp-ayuda-app.service.ts`: detecta y responde las preguntas de ingreso a la app.
- `whatsapp-reclamo-valor.service.ts`: detecta el reclamo, lista los cobros abiertos y arma la respuesta y el motivo.

| Camino | Enganche |
|---|---|
| Número desconocido (`atenderDesconocido`) | ayuda de app antes del filtro de tema; semana de cortesía antes de la clase de cortesía (mismo freno de 30 días) |
| Familia identificada | reclamo de valor antes de «ya pagué» (2.9); ayuda de app antes del modelo; semana de cortesía en 2.35 y en la tool `get_trial_class_info` |

## Configuración de Besser

```sql
update school_settings set wa_modo_cortesia = 'semana_app',
  wa_cortesia_qr_id = '6e06d933-594e-445c-93f7-88166dee0500',   -- besser-cortesia
  wa_cortesia_dias = 7, wa_ayuda_app = true, wa_reclamos_de_valor = true,
  wa_responder_precios = true
where school_id = '759eee9d-05cb-4958-b84a-2560f77e3683';
```

**Al conectar el número** (la fila de `whatsapp_settings` nace con el bot apagado):

```sql
update whatsapp_settings set ai_enabled = true, mode = 'assisted',
  business_hours = '{"tz":"America/Bogota","dias":{"1":["09:00","15:00"],"2":["09:00","15:00"],"3":["09:00","15:00"],"4":["09:00","15:00"],"5":["09:00","15:00"]}}'
where integration_id = (select id from school_whatsapp_integrations where school_id = '759eee9d-05cb-4958-b84a-2560f77e3683');
```

Y copiar las plantillas: `bff/scripts/wa-copiar-plantillas.ts --desde <Escuela Pruebas> --hacia <Besser> --aplicar`.

## Para apagarlo

`update school_settings set wa_modo_cortesia='clase', wa_ayuda_app=false, wa_reclamos_de_valor=false where school_id = …;`. Efecto inmediato, sin despliegue.

## Fuera de alcance

- Pantalla para que la escuela elija estos ajustes (hoy se prenden por SQL).
- Activación automática del plan al terminar la semana: la escuela le pone plan y cuota al deportista, o lo da de baja.
