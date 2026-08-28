# Puente ZKTeco -> SportMaps (Dreamers Gymnastics)

## Por qué existe esto

Los 2 lectores de Dreamers son **ZKTeco MB360/ID** (plataforma `ZMM220_TFT`).
Ese modelo no soporta HTTPS en su push ADMS nativo. `bffdev.sportmaps.co`
fuerza HTTPS a nivel de Render/Cloudflare (no configurable desde nuestro
lado). Sin este bridge, los lectores nunca completan el push y no llega
nada al backend — confirmado el 2026-08-21: cero handshakes/`options`
reales de estos seriales en `adms_device_log`.

RMGYM usa un modelo distinto (**F22ID**, plataforma `ZLM60_TFT`) que sí
soporta HTTPS nativo (toggle "HTTPS: ON" visible en su menú "Conf. Srvr.
de Nube") y no necesita este bridge.

Investigado y descartado: el MB360 no tiene ninguna actualización de
firmware conocida que agregue HTTPS — es un modelo de gama distinta al
F22ID, no una versión vieja del mismo equipo. Ver
[MB360 | ZKTeco](https://zkteco.systems/en/product/english-mb360/).

Detalle completo del incidente y del diagnóstico en
[`docs/specs/adms-ip-allowlist-per-device.md`](../../docs/specs/adms-ip-allowlist-per-device.md)
y en la memoria de la sesión (`project_zkteco_adms_access`).

## Qué hace `dreamers_bridge.py`

Corre en una PC de la red local de Dreamers. Cada 5 segundos:
1. Se conecta por SDK local (`pyzk`, puerto 4370) a cada lector.
2. Lee los registros de asistencia nuevos desde la última vez que corrió.
3. Los reenvía a `POST https://bffdev.sportmaps.co/iclock/cdata` imitando
   exactamente el formato ATTLOG que el equipo mandaría si pudiera hablar
   HTTPS — el backend los procesa igual que si vinieran del equipo directo.
4. Manda un heartbeat (`GET /iclock/getrequest`) para que `last_seen_at`
   se actualice en el panel de Access Control.
5. **Apertura manual (2026-08-27):** sondea `GET /bridge/door-commands` (el
   mismo endpoint dedicado que usa `scripts/gymrm-door-bridge/`, ya
   genérico por escuela) y ejecuta cualquier `open_door` pendiente por SDK
   local — sin esto, el botón de abrir puerta del dashboard nunca le
   llegaría a estos lectores (no hablan ADMS, así que tampoco podrían
   recibir el comando por ese canal aunque funcionara).

Estado local en `bridge_state.json` (se crea solo) — evita reenviar
eventos ya mandados. **No borrar ese archivo** salvo que quieras que
vuelva a mandar todo el historial del equipo.

## Instalación (una sola vez, en la PC de Dreamers)

1. Instalar Python 3 (python.org) si no está — **"Install for all users"**,
   no "solo para mí" (la tarea programada corre como `SYSTEM`, que no ve
   el PATH de un usuario individual — mismo gotcha que ya salió con GYM RM).
2. Copiar toda esta carpeta a la PC del club (ej. `C:\SportMaps\dreamers-bridge`).
3. Abrir PowerShell **como Administrador** en esa carpeta:
   ```powershell
   pip install -r requirements.txt
   [Environment]::SetEnvironmentVariable("SPORTMAPS_BRIDGE_API_KEY", "LA_MISMA_LLAVE_QUE_GYM_RM", "Machine")
   .\install_scheduled_task.ps1
   ```
   La API key **es la misma** que ya está configurada en Render
   (`BRIDGE_API_KEY` es una sola variable global, no por escuela) — no hay
   que pedir ni generar una nueva, solo copiarla acá.
4. Listo. La tarea `SportMaps-DreamersBridge` queda:
   - Arrancando sola cuando prende la PC (no depende de ninguna sesión de usuario).
   - Reiniciándose sola si el proceso se cae (hasta 999 veces, cada 1 minuto).
   - **Ya no hace falta correr ningún `.bat` a mano.**

## ⚠️ Antes de usar la apertura manual: calibrar el pulso

A diferencia de la asistencia (que ya funciona probada), **la apertura
manual todavía no se probó en el torniquete real de Dreamers.** El valor
de partida (`DOOR_PULSE_DECISECONDS = 2`, 0.2s) es el que funcionó en
GYM RM — pero es un modelo de torniquete distinto, no asumir que sirve
igual acá.

Con la tarea programada **detenida** (`Stop-ScheduledTask -TaskName
"SportMaps-DreamersBridge"`, para no competir por la conexión al lector):

```powershell
cd C:\SportMaps\dreamers-bridge
py test_pulse.py 192.168.1.203 2   # lector entrada
py test_pulse.py 192.168.1.202 2   # lector salida
```

Probá de menor a mayor (2, 3, 5, 7 décimas...) hasta encontrar el mínimo
que abre y deja pasar **una sola vez**, sin que el torniquete se re-arme.
Si el valor que sirve no es 2, actualizá `DOOR_PULSE_DECISECONDS` en
`dreamers_bridge.py` (o seteá `SPORTMAPS_BRIDGE_PULSE_DECISECONDS` como
variable de entorno, sin tocar el archivo) y reiniciá la tarea.

## Verificar que está funcionando

- Revisar `bridge_supervisor.log` en esta carpeta (se va llenando con la
  actividad y con cualquier reinicio).
- En el panel de Access Control de SportMaps, los dos lectores de Dreamers
  deben mostrar "En línea".
- Contra la base: `turnstile_devices.last_seen_at` de ambos seriales no
  debería tener más de ~5 minutos de antigüedad en horario de operación del gym.

## Si algo cambia en la red de Dreamers

Si cambia la IP local de algún lector (ej. por conflicto de IP en la red),
actualizar el campo `"ip"` correspondiente en `DEVICES` dentro de
`dreamers_bridge.py` — la tarea programada recoge el cambio solo en el
próximo reinicio del proceso (o forzarlo: `Stop-ScheduledTask` +
`Start-ScheduledTask` con el nombre `SportMaps-DreamersBridge`).

## Desinstalar

```powershell
Unregister-ScheduledTask -TaskName "SportMaps-DreamersBridge" -Confirm:$false
```

## Pendiente / mejora futura

- ✅ **La alerta si Dreamers deja de reportar ya existe — no hacía falta
  construir nada.** `alert_offline_access_devices()` (pg_cron cada 5 min,
  vive solo en la base, sin migración) revisa `turnstile_devices.last_seen_at`
  de todas las escuelas y avisa al owner si pasan 15+ minutos sin
  actualizarse. Para Dreamers eso es exactamente "la PC del bridge se
  apagó" (es la única vía que toca ese campo, vía `send_heartbeat()`).
  Confirmado 2026-08-27 al portar el heartbeat de GYM RM — ver
  `scripts/gymrm-door-bridge/VALIDACION-2026-08-25.md`.
- La apertura manual está sin calibrar en campo — ver sección de arriba.
