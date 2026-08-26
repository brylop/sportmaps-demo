# Endpoint `/bridge/door-commands` — implementado

> **Estado (2026-08-26): código en `develop`, pendiente de desplegar.**
> Implementación real en [`bff/src/routes/bridge.routes.ts`](../../bff/src/routes/bridge.routes.ts).
> Este documento ya no es un spec a implementar — es la referencia de cómo
> quedó armado y por qué. Falta: aplicar
> `supabase/migrations/20260825231925_gymrm_bridge_local_flag.sql` a la
> base real, desplegar el BFF a Render, y setear `BRIDGE_API_KEY` ahí.

El `door_bridge.py` de esta carpeta necesita que el BFF exponga un canal
propio para consultar y confirmar comandos `open_door`, **separado del
canal ADMS** (`/iclock/*`) que ya existe. Motivo: el ADMS es el protocolo
que habla el propio dispositivo con el backend; este endpoint nuevo es
para que un script en la red local del gym (que actúa POR el dispositivo,
no ES el dispositivo) pueda leer y confirmar comandos.

No se reutilizó `/iclock/getrequest` para esto — ese endpoint devuelve
comandos en el formato de texto plano que espera el firmware del F22ID
(`C:<seq>:CONTROL DEVICE ...`), no JSON, y mezclar ambos consumidores del
mismo endpoint (el dispositivo real + este script) complica el contrato
sin necesidad.

## Historial de validación (2026-08-25/26)

Ver [`VALIDACION-2026-08-25.md`](./VALIDACION-2026-08-25.md) para el
detalle completo con archivo:línea. Resumen de las 5 decisiones que
llegaron a esta implementación:

1. **Carrera con ADMS — resuelta.** `getrequest` (`access-adms.ts`) ahora
   excluye `command_type='open_door'` para dispositivos con
   `turnstile_devices.has_local_bridge = true`, así que ya no puede marcar
   la fila `executed` en falso antes de que este endpoint la reclame.
2. **CHECK constraint de `device_commands.status` — evitado, no resuelto.**
   No había forma de confirmarlo sin acceso a la base viva, así que el
   reclamo se hizo con una columna nueva (`claimed_at timestamptz`) en vez
   de un valor `'claimed'` de `status`. No importa si el CHECK existe o
   no: esta columna no lo toca.
3. **Bloqueo de usuarios — confirmado por ADMS, fuera de alcance.** Se
   probó en campo y `set_group` sí bloquea físicamente; se queda en ADMS,
   este endpoint no lo cubre.
4. **Serial ↔ dirección e IPs — confirmados contra el dispositivo real.**
   `door_bridge.py` ya estaba bien (`JJA1254900899`=entrada
   `192.168.1.6`, `JJA1254900898`=salida `192.168.1.7`); el doc de junio
   (`ACCESS_CONTROL_ZKTECO_HANDOFF.md`) era el desactualizado.
5. **Tiempo de apertura configurable.** Se agregó `door_drive_time_seconds`
   a la respuesta de este endpoint (viene de `turnstile_devices`, el mismo
   campo que ya edita "Editar dispositivo" en el dashboard) en vez de
   dejarlo hardcodeado en `door_bridge.py`.

## Autenticación

Ninguno de los endpoints de `/api/v1/*` sirve aquí — todos requieren JWT
de usuario (`requireAuth` + `requireRole`), y este es un proceso
desatendido corriendo en una PC del gym, sin usuario logueado.

Se protege con una **API key de servicio**, header:

```
X-Bridge-Api-Key: <valor de env var BRIDGE_API_KEY>
```

Comparación en tiempo constante (`crypto.timingSafeEqual`) contra
`process.env.BRIDGE_API_KEY`, **fail-closed**: si la env var no está
configurada, `401` siempre — mismo patrón que ya usa
`internal-notifications.routes.ts` para su propio secreto de header.

No se agregó la segunda capa de IP allowlist que este doc sugería
originalmente (ni el global `ACCESS_DEVICE_IP_ALLOWLIST` ni el
`ip_check_mode` por-dispositivo del 2026-08-21): la API key sola ya es un
secreto largo con comparación segura, y sumar una segunda capa acá
significaba elegir entre dos mecanismos de IP que hoy sirven propósitos
distintos — quedó fuera de alcance de esta implementación, se puede
agregar después si hace falta.

## `GET /bridge/door-commands?school_id=<uuid>`

Reclama atómicamente los `open_door` pendientes y no expirados de la
escuela (`UPDATE ... WHERE claimed_at IS NULL`, una sola sentencia — dos
llamadas concurrentes o un reintento de red no pueden reclamar la misma
fila dos veces: **abrir la puerta dos veces por un mismo click es peor
que no abrirla**).

Implementación real (`bff/src/routes/bridge.routes.ts`):

```ts
router.get('/door-commands', async (req: Request, res: Response) => {
  if (!apiKeyOk(req)) return res.status(401).json({ error: 'unauthorized' });

  const schoolId = req.query.school_id as string;
  if (!schoolId) return res.status(400).json({ error: 'school_id requerido' });

  const { data: claimed, error } = await supabase
    .from('device_commands')
    .update({ claimed_at: new Date().toISOString() })
    .eq('school_id', schoolId)
    .eq('command_type', 'open_door')
    .eq('status', 'pending')
    .is('claimed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('id, device_id, direction');

  if (error) throw error;
  if (!claimed || claimed.length === 0) return res.json({ commands: [] });

  // Sin FK declarada entre device_commands.device_id y turnstile_devices
  // (device_id es un uuid suelto) -- PostgREST no puede embeber el join
  // (`turnstile_devices(serial_number)` en el select, como sugería la
  // primera versión de este spec, NO funciona sin esa FK). Se resuelve en
  // dos pasos y se mergea acá.
  const deviceIds = [...new Set(claimed.map((c: any) => c.device_id))];
  const { data: devices } = await supabase
    .from('turnstile_devices')
    .select('id, serial_number, door_drive_time_seconds')
    .in('id', deviceIds);

  const deviceById = new Map((devices || []).map((d: any) => [d.id, d]));

  const commands = claimed.map((c: any) => {
    const device = deviceById.get(c.device_id);
    return {
      id: c.id,
      device_serial: device?.serial_number ?? null,
      direction: c.direction,
      door_drive_time_seconds: device?.door_drive_time_seconds ?? null,
    };
  });

  return res.json({ commands });
});
```

## `POST /bridge/door-commands/:id/ack`

```ts
router.post('/door-commands/:id/ack', async (req: Request, res: Response) => {
  if (!apiKeyOk(req)) return res.status(401).json({ error: 'unauthorized' });

  const { id } = req.params;
  const { success, error_message } = req.body as { success?: boolean; error_message?: string };
  if (typeof success !== 'boolean') {
    return res.status(400).json({ error: 'success (boolean) requerido' });
  }

  await supabase
    .from('device_commands')
    .update({
      status: success ? 'executed' : 'failed',
      executed_at: new Date().toISOString(),
      error_message: success ? null : String(error_message || 'Fallo reportado por door_bridge local').slice(0, 500),
    })
    .eq('id', id);

  return res.json({ success: true });
});
```

## Dónde se montó

En `bff/src/index.ts`, después del `express.json()` global (este canal es
JSON normal, a diferencia de `/iclock/*` que usa `express.text()` y va
montado antes):

```ts
import bridgeRouter from './routes/bridge.routes';
// ...
app.use('/bridge', generalLimiter, bridgeRouter);
```

## Variables de entorno nuevas en Render

- `BRIDGE_API_KEY` — string aleatorio largo (ej. `openssl rand -hex 32`).
  Debe coincidir con `SPORTMAPS_BRIDGE_API_KEY` que se configura como
  variable de entorno de sistema en la PC del gym (ver README.md de esta
  carpeta). **Todavía no está seteada — pendiente de configuración en
  Render antes del primer deploy con esto activo.**

## Qué pasa con `device_commands` que ya inserta `manual-open`

`POST /api/v1/access/manual-open` (en `access-api.ts`) sigue insertando
filas `device_commands` con `command_type: 'open_door'` exactamente igual
que antes — no se tocó. Lo que cambió es quién más las consume:
`getrequest` (ADMS) ahora las salta para dispositivos con
`has_local_bridge`, y este endpoint nuevo es quien las reclama y ejecuta
de verdad.

## Migración

`supabase/migrations/20260825231925_gymrm_bridge_local_flag.sql`:

- `turnstile_devices.has_local_bridge boolean NOT NULL DEFAULT false` —
  activado por serial para los dos lectores de GYM RM
  (`JJA1254900899`, `JJA1254900898`), no por `school_id` completo (si se
  agrega un tercer dispositivo a la escuela sin bridge propio, no hereda
  el flag automáticamente).
- `device_commands.claimed_at timestamptz` — nullable, sin default.

Pendiente aplicarla a la base real (no vía SQL editor — ver `INF-7` en el
roadmap sobre por qué eso no deja rastro).
