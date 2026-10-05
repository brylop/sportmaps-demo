# Puente ZKTeco -> SportMaps (Dreamers Gymnastics)

## Por qué existe esto

Los 2 lectores de Dreamers son **ZKTeco MB360/ID** (plataforma `ZMM220_TFT`).
Ese modelo no soporta HTTPS en su push ADMS nativo, y el backend
(`bffdev.sportmaps.co`) solo habla HTTPS — Render va detrás de Cloudflare y
eso no se puede apagar desde nuestro lado. Sin este bridge, los lectores nunca
completan el push y no llega nada al backend — confirmado el 2026-08-21: cero
handshakes/`options` reales de estos seriales en `adms_device_log`.

RMGYM usa un modelo distinto (**F22ID**, plataforma `ZLM60_TFT`) que sí
soporta HTTPS nativo y no necesita este bridge para la asistencia (su bridge,
`scripts/gymrm-door-bridge/`, solo ejecuta la apertura remota).

Investigado y descartado: el MB360 no tiene ninguna actualización de
firmware conocida que agregue HTTPS. Ver
[MB360 | ZKTeco](https://zkteco.systems/en/product/english-mb360/).

Detalle del incidente de 2026-08 en
[`docs/specs/adms-ip-allowlist-per-device.md`](../../docs/specs/adms-ip-allowlist-per-device.md);
arquitectura vigente y límites conocidos en la **§8** de
[`docs/specs/dreamers-banco-de-horas-torniquete.md`](../../docs/specs/dreamers-banco-de-horas-torniquete.md).

## Qué hace `dreamers_bridge.py` (arquitectura vigente, 2026-10-05)

Corre en una PC de la red local de Dreamers, con **cuatro piezas** que no deben confundirse:

1. **Captura en vivo (un hilo por lector).** `live_capture()` de `pyzk`: el equipo empuja cada
   marcación al momento, el script la reenvía a `POST /iclock/cdata` imitando el formato ATTLOG del
   equipo (el backend la procesa igual que si viniera directo). No trae el historial y no se pone más
   lenta con el tiempo. **No deshabilita el lector** — necesita que siga aceptando huellas.
2. **Heartbeat por lector** cada 60 s (`GET /iclock/getrequest` → `turnstile_devices.last_seen_at`),
   **solo mientras la captura en vivo está conectada**. `last_seen_at` significa «capturando», no «el
   proceso existe». La alerta `alert_offline_access_devices()` (pg_cron, 5 min) avisa al owner si pasan
   15+ min sin él — cubre también «la captura murió».
3. **Barrido de respaldo** cada 30 min (el primero a los 60 s de arrancar): `get_attendance()` completo
   por si la captura perdió algo (caída del hilo, reinicio del equipo, un comando que la pausó).
   Reenvía lo posterior al cursor **y los últimos 10 min anteriores** (duplicados: los absorbe el
   backend). Es la red de seguridad, no el camino normal: con ~48.000 registros en el equipo tarda ~47 s
   por lector **con el lector deshabilitado** (no acepta huellas), por eso es poco frecuente.
4. **Comandos por WebSocket** (`wss://bffdev.sportmaps.co/bridge/ws`): una conexión persistente, sin
   sondeo HTTP. El `auth` pide `open_door`, `set_group`, `disable_user` y `enable_user`. Ejecuta por SDK
   local: apertura manual (`CMD_UNLOCK` en décimas de segundo, nunca `conn.unlock()`) y bloqueo por mora
   (`set_user()` prendiendo/apagando el bit 0 de `privilege`; `set_group` solo por comandos viejos). La
   conexión se renueva sola cada día a las **3 am hora Colombia**. El ack del comando sigue siendo HTTP.

**Coordinación:** el firmware atiende una sola conexión SDK a la vez. Cada lector tiene un `Lock` y un
par de `Event`s para que la captura ceda el equipo (en su siguiente tick de 2 s) a un comando o al barrido.
Todo acceso SDK que no sea la captura pasa por `device_access()`.

**Cursor:** `bridge_state.json` (se crea solo, `last_sent_<serial>`) evita reenviar eventos. Solo avanza
hacia adelante. **No borrar ese archivo** salvo que quieras que vuelva a considerar todo el historial. Si
aparecen más de 20 eventos nuevos de golpe (reloj del equipo corrido o una caída larga) el script los
**salta y avanza el cursor** — avisa fuerte en el log (`ALERTA`); si eran asistencia real que se quería
recuperar, usar `diagnostico_backlog_asistencia.py` **antes** del siguiente reinicio, y recordar que el
backend descarta de todas formas ATTLOG de más de 3 h (`ADMS_BACKLOG_SKIP_HOURS`).

### Variables de entorno (todas opcionales salvo la llave)

| Variable | Default | Para qué |
|---|---|---|
| `SPORTMAPS_BRIDGE_API_KEY` | — (**obligatoria**) | la misma llave global que `BRIDGE_API_KEY` en Render |
| `SPORTMAPS_BRIDGE_PULSE_DECISECONDS` | 2 | pulso de apertura (ver «calibrar» abajo) |
| `SPORTMAPS_BRIDGE_LIVE_CAPTURE_TICK_SECONDS` | 2 | cada cuánto la captura revisa si debe ceder el equipo |
| `SPORTMAPS_BRIDGE_DEVICE_HEARTBEAT_INTERVAL_SECONDS` | 60 | heartbeat por lector |
| `SPORTMAPS_BRIDGE_CATCHUP_INTERVAL_SECONDS` | 1800 | barrido de respaldo |
| `SPORTMAPS_BRIDGE_CATCHUP_FIRST_DELAY_SECONDS` | 60 | primer barrido tras arrancar |
| `SPORTMAPS_BRIDGE_CATCHUP_LOOKBACK_MINUTES` | 10 | ventana anterior al cursor que el barrido reenvía |
| `SPORTMAPS_BRIDGE_MAX_EVENTS_PER_CYCLE` | 20 | tope de eventos «nuevos de golpe» antes de saltar |
| `SPORTMAPS_BRIDGE_HEARTBEAT_INTERVAL_SECONDS` | 60 | heartbeat del WebSocket (canal de comandos) |
| `SPORTMAPS_BRIDGE_WS_RECONNECT_HOUR` | 3 | hora Colombia de la reconexión diaria |
| `SPORTMAPS_BRIDGE_WS_RECONNECT_BACKOFF_SECONDS` | 5 | espera tras una caída del WS |
| `SPORTMAPS_BRIDGE_LIVE_CAPTURE_BACKOFF_SECONDS` | 5 | espera tras una caída de la captura de un lector |

## Instalación (una sola vez, en la PC de Dreamers)

1. Instalar Python 3 (python.org) si no está — **"Install for all users"**,
   no "solo para mí" (la tarea programada corre como `SYSTEM`, que no ve
   el PATH de un usuario individual — mismo gotcha que ya salió con GYM RM).
2. Copiar toda esta carpeta a la PC del club (hoy `C:\SportMaps\dreamers_bridge`).
3. Abrir PowerShell **como Administrador** en esa carpeta:
   ```powershell
   python -m pip install -r requirements.txt
   [Environment]::SetEnvironmentVariable("SPORTMAPS_BRIDGE_API_KEY", "LA_MISMA_LLAVE_QUE_GYM_RM", "Machine")
   .\install_scheduled_task.ps1
   ```
   `requirements.txt` incluye `websockets` y `tzdata` (Windows no trae la base de zonas horarias; sin
   `tzdata` el script no arranca). Si `pip` no se reconoce, usar `python -m pip` o `py -m pip`.
   La API key **es la misma** que ya está configurada en Render
   (`BRIDGE_API_KEY` es una sola variable global, no por escuela).
4. Listo. La tarea `SportMaps-DreamersBridge` queda:
   - Arrancando sola cuando prende la PC (no depende de ninguna sesión de usuario).
   - Reiniciándose sola si el proceso se cae (hasta 999 veces, cada 1 minuto).

**Actualizar el script** (reemplazar `dreamers_bridge.py` por una versión nueva): copiar el archivo y
reiniciar la tarea — `Stop-ScheduledTask -TaskName "SportMaps-DreamersBridge"` +
`Start-ScheduledTask -TaskName "SportMaps-DreamersBridge"`. Después de reemplazar, revisar el log.

## Verificar que está funcionando

En `bridge_supervisor.log` (en esta carpeta; `Get-Content bridge_supervisor.log -Tail 30 -Wait`) deben verse,
poco después de arrancar:

- `Conectado y autenticado por WebSocket` y `Proxima reconexion programada: ... 02:59` (3 am Colombia).
- Por cada lector: `escuchando asistencia en vivo...`, y un `heartbeat -> 200` por minuto.
- Al marcar alguien: `evento en vivo enviado: PIN ... @ ...` casi al instante.
- A los ~60 s y luego cada 30 min: `barrido de respaldo: nada nuevo (...)`. Si dice `NUEVOS que live_capture
  no habia mandado`, la captura perdió algo — hay que averiguar por qué.

Contra la base: `turnstile_devices.last_seen_at` de ambos seriales no debería tener más de ~2 minutos de
antigüedad (heartbeat de 60 s), aunque nadie marque. **Ojo:** `bridge_heartbeats` fresco solo prueba el
canal de comandos; no dice nada de la asistencia (ver `docs/gotchas-tecnicos.md`).

## Cargar personas y vincular PINs

- **Enrolar huellas:** `enroll_users.py` (interactivo; crea el PIN con su nombre y pone el lector en
  modo de enrolamiento — la huella real la tiene que dar la persona, 3 veces, en **cada** lector: entrada y
  salida tienen su propia base). Correrlo con la tarea **detenida** (una sola conexión SDK por lector).
- **Vincular el PIN a la persona en SportMaps** (`zk_user_mappings`): hoy se hace desde Control de Acceso →
  «Asignar» sobre un evento «desconocido». Un PIN sin vincular marca `unknown_user` y **no abre visita ni
  descuenta del banco de horas**. A 2026-10-05 Dreamers tiene 6 PINs vinculados — la carga masiva está en
  el roadmap (`MOD-34`).
- **Diagnóstico de solo lectura:** `diagnostico_backlog_asistencia.py` (cuántos eventos tiene el equipo
  sin enviar según el cursor, por día y por PIN), `diagnostico_solo_lectura.py`. Correr con la tarea detenida.

## ⚠️ Antes de usar la apertura manual: calibrar el pulso

La apertura manual funcionó por el flujo real en Dreamers (comando `open_door` ejecutado), pero el valor de
partida (`SPORTMAPS_BRIDGE_PULSE_DECISECONDS = 2`, 0.2 s) viene de GYM RM — es otro modelo de torniquete.

Con la tarea programada **detenida**, para no competir por la conexión al lector:

```powershell
cd C:\SportMaps\dreamers_bridge
py test_pulse.py 192.168.1.201 2   # lector entrada
py test_pulse.py 192.168.1.202 2   # lector salida
```

Probá de menor a mayor (2, 3, 5, 7 décimas...) hasta encontrar el mínimo que abre y deja pasar **una sola
vez**, sin que el torniquete se re-arme. Si no es 2, setear `SPORTMAPS_BRIDGE_PULSE_DECISECONDS` y reiniciar.

## ⚠️ Antes de confiar en el bloqueo por mora

El bloqueo en Dreamers es `disable_user`/`enable_user` (`school_settings.access_block_mechanism='disable'`):
este MB360 no tiene Zonas Horarias/Grupos efectivos. Que el comando **llegue** y quede `executed` lo
resuelve el bridge; que el equipo **niegue el paso** al PIN deshabilitado hay que confirmarlo con una huella
real:

1. Bloquear un PIN de prueba desde Control de Acceso («Bloquear ahora»).
2. Confirmar en la base que el comando pasó a `executed`:
   ```sql
   select command_type, status, executed_at, error_message from device_commands
   where command_type in ('disable_user','enable_user','set_group') order by issued_at desc limit 5;
   ```
3. Intentar pasar con esa huella. Si deja pasar, el problema es de configuración del equipo, no de
   conectividad. Restaurar el PIN al terminar.

El PIN debe estar **enrolado en cada lector**; si no, el comando falla con un mensaje claro (no en silencio).

## Si algo cambia en la red de Dreamers

Si cambia la IP local de algún lector, actualizar `"ip"` en `DEVICES` dentro de `dreamers_bridge.py` y
reiniciar la tarea. (Ya pasó con el de entrada: `.203` → `.201`; hoy `.201` entrada / `.202` salida.)
Si el **reloj del lector** se desajusta, las marcaciones nuevas pueden quedar con una hora anterior al
cursor y no verse como nuevas: revisar Menú → Sistema → Fecha y Hora del propio equipo.

## Desinstalar

```powershell
Unregister-ScheduledTask -TaskName "SportMaps-DreamersBridge" -Confirm:$false
```

## Pendiente / mejora futura

- Carga y vinculación masiva de PINs (`MOD-34`) — a propósito después de validar el flujo con el usuario
  laboratorio.
- Ingesta autenticada para el bridge (`INF-16`): hoy la asistencia entra por `/iclock` protegida solo por
  allowlist de IP.
- Detección de reloj del lector desajustado (comparar `get_time()` del equipo con el de la PC y avisar).
- El bloqueo por mora está sin probar con una huella real en el MB360 — ver sección de arriba.
