# Puente de apertura remota - GYM RM (SportMaps)

> **Validado el 2026-08-25 e implementado el 2026-08-26.** Ver
> [`VALIDACION-2026-08-25.md`](./VALIDACION-2026-08-25.md) para el
> detalle completo. Estado: **código listo en `develop`, falta desplegar.**
> Hardware confirmado (IPs y seriales coinciden con `door_bridge.py`,
> bloqueo de usuarios probado en campo y decidido que se queda en ADMS).
> Backend implementado: `bff/src/routes/bridge.routes.ts` (nuevo),
> `access-adms.ts` ya no manda `open_door` por ADMS a dispositivos con
> bridge, y la migración `20260825231925_gymrm_bridge_local_flag.sql`
> agrega lo necesario en la base. **Para que esto funcione de verdad
> falta, en orden:** aplicar la migración a la base real, desplegar el
> BFF a Render, setear `BRIDGE_API_KEY` ahí, y recién entonces instalar
> esta carpeta en la PC del gym (pasos abajo).

## Por qué existe esto

Los 2 lectores de GYM RM son **ZKTeco F22ID** (plataforma `ZLM60_TFT`).
Este modelo sí soporta ADMS/HTTPS nativo y la asistencia (huella, entrada,
salida) se registra perfecto por esa vía — **no** necesita ningún bridge
para eso.

El problema es puntual: el comando remoto de apertura de puerta
(`CONTROL DEVICE` vía `/iclock/getrequest` → `/iclock/devicecmd`) es
**aceptado por el firmware con éxito** (`Return: 0`) pero **no ejecuta la
apertura física del relé**. Se probaron variantes de bytes del comando
(`AA=01/BB=01` y `AA=01/BB=00`) sin éxito físico en sesiones anteriores —
el defecto está acotado a esta función específica, no a la conexión en
general.

Este bridge resuelve solo ese hueco puntual: usa el **SDK binario nativo**
(`pyzk`, puerto 4370, red local del gym) para invocar el desbloqueo
directamente sobre el dispositivo — el mismo mecanismo que usa el
software oficial de escritorio de ZKTeco cuando alguien abre la puerta
manualmente desde ahí.

**Lo que NO cubre este bridge, a propósito:** el botón "Bloquear ahora"
del dashboard (bloqueo de usuarios morosos) usa un comando distinto
(`set_group` → `DATA UPDATE USERINFO ... Grp=2`), que es un comando de
*datos*, no `CONTROL DEVICE`. Se probó en campo el 2026-08-25/26 y **sí
bloquea físicamente** — así que se queda en ADMS: no depende de esta PC
ni de este script, y es la vía con menos partes que pueden fallar. Ver
punto 3 de `VALIDACION-2026-08-25.md` para el detalle de la decisión.

## Qué hace `door_bridge.py`

Corre en una PC de la red local de GYM RM. Cada 3 segundos:
1. Pregunta al backend (`GET /bridge/door-commands`, un endpoint dedicado
   — **no** el canal ADMS) si hay comandos `open_door` pendientes.
2. Si hay uno, se conecta por SDK local al dispositivo correspondiente
   (`192.168.1.6` entrada / `192.168.1.7` salida — confirmado) y ejecuta
   el desbloqueo físico real vía `pyzk`, por el tiempo configurado en
   "Editar dispositivo" > "Tiempo de apertura" para ese lector.
3. Confirma al backend si funcionó o falló (`POST .../ack`).

**Este bridge NO toca la asistencia/attlog de GYM RM** — eso sigue
funcionando por su propio canal ADMS nativo, sin cambios.

## Requisito pendiente antes de instalar

**El código de `/bridge/door-commands` ya está en `develop`, pero todavía
no está desplegado.** Ver [`BACKEND_ENDPOINT_SPEC.md`](./BACKEND_ENDPOINT_SPEC.md)
para el detalle de implementación. Antes de instalar esto en la PC del
gym hace falta, en orden: aplicar la migración
`20260825231925_gymrm_bridge_local_flag.sql` a la base real, desplegar el
BFF a Render, y setear `BRIDGE_API_KEY` ahí. Mientras el endpoint no
responda, el script corre pero solo va a loguear `ERROR: el backend
todavía no tiene el endpoint... desplegado` en cada ciclo, sin romperse —
es seguro dejarlo instalado esperando.

## Instalación (una sola vez, en la PC de GYM RM)

1. Confirmar que `BACKEND_ENDPOINT_SPEC.md` ya está desplegado en el BFF
   (probar manualmente con `curl` o Postman antes de seguir).
2. Instalar Python 3 (python.org) si no está — **elegir "Install for all
   users"**, no "solo para mí". Esto importa porque la tarea programada
   corre como `SYSTEM`, que no ve el PATH de un usuario individual.
3. Copiar toda esta carpeta a la PC del gym (ej.
   `C:\SportMaps\gymrm-door-bridge`).
4. Abrir PowerShell **como Administrador** en esa carpeta:
   ```powershell
   pip install -r requirements.txt
   [Environment]::SetEnvironmentVariable("SPORTMAPS_BRIDGE_API_KEY", "LA_LLAVE_QUE_TE_DIO_BACKEND", "Machine")
   .\install_scheduled_task.ps1
   ```
5. Listo. La tarea `SportMaps-GymRM-DoorBridge` queda:
   - Arrancando sola cuando prende la PC (no depende de sesión de usuario).
   - Reiniciándose sola si el proceso se cae (hasta 999 veces, cada 1 min).
   - Corriendo como `SYSTEM` (no depende de la contraseña de ningún
     usuario de Windows).

## Verificar que está funcionando

1. Revisar `bridge_supervisor.log` en esta carpeta — debe mostrar el
   arranque y, cada 3 segundos, el sondeo silencioso (sin líneas nuevas
   si no hay comandos pendientes).
2. **Prueba real end-to-end**: desde el dashboard de SportMaps, usar el
   botón de apertura manual para GYM RM y confirmar:
   - La puerta se abre físicamente (esto es lo que hoy NO pasa sin este
     bridge).
   - Que se abrió la puerta **correcta** (entrada vs. salida) — el mapeo
     ya está confirmado contra el dashboard, pero la prueba física real
     es la que cierra el ciclo.
   - En `bridge_supervisor.log` aparece `Procesando comando ...` seguido
     de `Puerta abierta físicamente`.
3. **Prueba de arranque en frío**: reiniciar la PC completa (no solo
   cerrar sesión) y, sin que nadie inicie sesión de Windows, confirmar
   que a los pocos minutos el log ya muestra el bridge corriendo de
   nuevo.

## Si algo cambia en la red de GYM RM

Las IPs locales de los lectores **ya cambiaron una vez** desde que se
instalaron por primera vez (de `.4`/`.5` en junio a `.6`/`.7` en agosto,
sin que quedara ningún registro de cuándo ni por qué). Si vuelve a pasar
y el bridge deja de conectar:

1. Confirmar la IP actual directamente en el equipo físico
   (`Menú → Comm. → Ethernet`), nunca asumir por historial.
2. Actualizar el campo `"ip"` correspondiente en `DEVICES` dentro de
   `door_bridge.py`.
3. Reiniciar la tarea: `Restart-ScheduledTask -TaskName "SportMaps-GymRM-DoorBridge"`
   (o simplemente reiniciar la PC).

## Desinstalar

```powershell
Unregister-ScheduledTask -TaskName "SportMaps-GymRM-DoorBridge" -Confirm:$false
```

## Seguridad

- La API key (`SPORTMAPS_BRIDGE_API_KEY` / `BRIDGE_API_KEY` en Render)
  es una credencial de servicio de larga duración — tratarla como una
  contraseña. Si se compromete, cualquiera con la IP allowlisteada (o sin
  ella, si no se combina con `ACCESS_DEVICE_IP_ALLOWLIST` o
  `ip_check_mode` por-dispositivo) podría abrir la puerta del gym
  remotamente. Rotarla si se sospecha alguna filtración.

## Pendiente / mejora futura

- ✅ **Resuelto 2026-08-26: alerta automática si el bridge deja de responder.**
  Cada sondeo exitoso a `GET /bridge/door-commands` sella
  `bridge_heartbeats.last_seen_at` (sin cambios en este script — el latido
  es implícito en el sondeo que ya hace cada 3s). El cron
  `bridge-heartbeat-check.job.ts` en el BFF (cada 5 min) avisa al owner por
  notificación si pasan 10+ min sin sondeo — típicamente la PC del gym
  apagada o sin red. Una sola alerta por caída (se resetea sola al volver).
  Mismo patrón de notificación que `payment_overdue` en `access-adms.ts`.
  **Corrección 2026-08-27: Dreamers NO necesita esto.** Existe otro pg_cron
  ya vivo en la base (`alert_offline_access_devices()`, cada 5 min, solo en
  la base — sin migración) que revisa `turnstile_devices.last_seen_at` y
  avisa igual. Para GYM RM ese mecanismo no alcanzaba porque el lector habla
  ADMS directo y sigue actualizando `last_seen_at` aunque la PC del bridge
  esté apagada — de ahí que hiciera falta `bridge_heartbeats`, una señal
  aparte. Para Dreamers, en cambio, la ÚNICA vía que toca `last_seen_at` es
  el propio `send_heartbeat()` de `scripts/dreamers-bridge/dreamers_bridge.py`
  (llama a `GET /iclock/getrequest`, que ya hace `touchDevice()`) — así que
  el cron que ya existe cubre exactamente el caso "PC de Dreamers apagada"
  sin que haga falta tocar ese script ni duplicar nada.
- Este bridge solo resuelve apertura remota, a propósito — el bloqueo ya
  funciona por ADMS y no necesita esto (ver validación, punto 3). Falta,
  como mejora barata y no bloqueante, un botón o cron de "re-sincronizar
  bloqueos" en el backend que reencole `set_group` para todos los PIN que
  `GET /api/v1/access/overdue` ya sabe que están bloqueados, para el caso
  de que el torniquete pierda sus grupos en un reset — el dato para
  hacerlo ya existe, solo falta el disparador.
- Si en el futuro se necesita también *cerrar* la puerta remotamente o
  consultar su estado en tiempo real, `pyzk` expone métodos adicionales
  que se pueden agregar siguiendo el mismo patrón.
