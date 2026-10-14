# Guía de campo: pasar los torniquetes de GYM RM y Dreamers a producción

**Para:** Julián (técnico). **Fecha:** 2026-10-14.
**Qué cambia:** el servidor al que hablan los lectores y los puentes pasa de `bffdev.sportmaps.co` (desarrollo) a `bffprod.sportmaps.co` (producción). La base de datos es la misma, así que no se pierde ningún registro ni hay que volver a enrolar huellas.

> **No arrancar hasta que SportMaps confirme que los dos bloqueos de la sección 0 están resueltos.** Si se reprograma antes, los lectores de GYM RM quedan rechazados (error 403) y dejan de registrar asistencia.

## 0. Antes de salir (lo hace SportMaps, no el técnico)

- [ ] **Lista de IP en producción.** Producción solo acepta lectores desde IP públicas autorizadas. GYM RM sale hoy por `181.63.24.149` y esa IP **no está** en la lista de producción (en desarrollo sí). Hay que agregarla en Render (`ACCESS_DEVICE_IP_ALLOWLIST` de `sportmaps-bff-prod`) y confirmar la IP pública de Dreamers.
- [ ] **Usuarios del gimnasio.** Si el personal sigue entrando por `dev.sportmaps.co`, el botón de apertura manual y el bloqueo por mora avisan solo a los puentes conectados a desarrollo. Los puentes (paso 3) se mueven **el mismo día** en que los usuarios pasan a `app.sportmaps.co`, no antes.
- [ ] Alguien de SportMaps disponible por WhatsApp durante la visita para revisar la base de datos en vivo.

## 1. Inventario

| Serial | Gimnasio | Dirección | Modelo | Cómo llega al servidor | Qué se toca |
|---|---|---|---|---|---|
| `JJA1254900899` | GYM RM | Entrada | ZKTeco F22ID | ADMS nativo (HTTPS) | Menú del lector |
| `JJA1254900898` | GYM RM | Salida | ZKTeco F22ID | ADMS nativo (HTTPS) | Menú del lector |
| `CEZU222860004` | Dreamers | Entrada | ZKTeco MB360/ID | Por el puente (el MB360 no soporta HTTPS) | **Nada en el lector**, solo el puente |
| `CEZU214960067` | Dreamers | Salida | ZKTeco MB360/ID | Por el puente | **Nada en el lector**, solo el puente |

| Puente (PC del gimnasio) | Carpeta | Tarea programada |
|---|---|---|
| GYM RM: apertura remota | `C:\SportMaps\gymrm-door-bridge` | `SportMaps-GymRM-DoorBridge` |
| Dreamers: asistencia, apertura y bloqueo | `C:\SportMaps\dreamers_bridge` | `SportMaps-DreamersBridge` |

El **serial** manda. El nombre que el software ZKTeco del gimnasio le pone a cada lector puede estar mal (en GYM RM está cruzado).

## 2. Lectores de GYM RM (los dos F22ID)

En cada lector:

1. `Menú → Comm. → Cloud Server Setting` (en algunos firmwares aparece como `ADMS`).
2. **Antes de cambiar, tomar foto de la pantalla** con los valores actuales: esa foto es la reversa.
3. Dejar así:
   - **Server Address / Dirección:** `bffprod.sportmaps.co` (sin `https://` y sin `/iclock`)
   - **Server Port / Puerto:** `443`
   - **Enable Domain Name:** ON
   - **HTTPS:** ON
   - **Proxy:** OFF
4. Guardar y salir al menú principal. Si en 1 minuto no aparece el ícono de nube conectada, reiniciar el lector.

Debería quedar **igual a lo que tiene hoy, cambiando solo `bffdev` por `bffprod`**. Si la foto muestra otro puerto o el HTTPS apagado, avisar antes de seguir: el servidor solo responde por HTTPS en el 443, y por HTTP en el puerto 80 devuelve una redirección que el lector no sigue.

## 3. Puentes (PC de GYM RM y PC de Dreamers)

La dirección está escrita en el script (no es una variable de entorno). En cada PC:

1. Abrir PowerShell **como Administrador** en la carpeta del puente.
2. Hacer una copia: `Copy-Item door_bridge.py door_bridge.py.bak` (en Dreamers: `dreamers_bridge.py`).
3. Abrir el `.py` con el Bloc de notas y cambiar **una sola línea**:
   `BACKEND_BASE_URL = "https://bffdev.sportmaps.co"` → `BACKEND_BASE_URL = "https://bffprod.sportmaps.co"`
   (el WebSocket `wss://…/bridge/ws` se arma solo a partir de esa línea).
4. No tocar la llave `SPORTMAPS_BRIDGE_API_KEY`: es la misma en desarrollo y en producción.
5. Reiniciar la tarea (en Dreamers, la tarea es `SportMaps-DreamersBridge`):
   ```powershell
   Stop-ScheduledTask -TaskName "SportMaps-GymRM-DoorBridge"
   Start-ScheduledTask -TaskName "SportMaps-GymRM-DoorBridge"
   Get-Content bridge_supervisor.log -Tail 30 -Wait
   ```
6. En el log debe aparecer `Backend: https://bffprod.sportmaps.co` y `Conectado y autenticado por WebSocket`. En Dreamers, además, `escuchando asistencia en vivo...` por cada lector.

## 4. Cómo saber que quedó bien

- **Lector:** marcar una huella real en entrada y otra en salida.
- **SportMaps revisa en la base:** que `turnstile_devices.last_seen_at` de los cuatro seriales se mantenga al día (menos de 2 minutos), que llegue el `handshake` y el `attlog_batch` en `adms_device_log`, que `bridge_heartbeats` de ambas escuelas se mantenga fresco y que en los logs de Render de **`sportmaps-bff-prod`** aparezca `[ADMS] Handshake OK — <serial>`. Si en producción sale `[ADMS] IP no autorizada`, falta la IP en la lista (sección 0).
- **Apertura manual:** desde la app, abrir la puerta de entrada y la de salida en cada gimnasio y confirmar que se abre **la puerta correcta**.
- **Que desarrollo ya no recibe nada:** en los logs de `sportmaps-bff-dev` no deben aparecer más handshakes de esos seriales.

## 5. Reversa (si algo falla y no se resuelve en 15 minutos)

1. Lectores GYM RM: volver a poner `bffdev.sportmaps.co` con los valores de la foto.
2. Puentes: restaurar la copia (`Copy-Item door_bridge.py.bak door_bridge.py -Force`) y reiniciar la tarea.
3. Avisar a SportMaps. Mientras tanto nadie se queda afuera: el lector abre con su propia base de huellas. Lo que se pierde es el registro de asistencia y los comandos remotos.

## Checklist en sitio

- [ ] Sección 0 confirmada por SportMaps (IP agregada y usuarios en `app.sportmaps.co`)
- [ ] Foto de la configuración actual de cada F22ID
- [ ] Copia `.bak` de cada script de puente
- [ ] Los dos F22ID apuntando a `bffprod.sportmaps.co:443`, HTTPS ON y proxy OFF
- [ ] Los dos puentes con `bffprod` en el log y autenticados
- [ ] Huella de prueba en los 4 lectores, confirmada por SportMaps
- [ ] Apertura manual probada en las 4 puertas
- [ ] Hacerlo con el gimnasio en baja ocupación (horario acordado con cada gimnasio)
