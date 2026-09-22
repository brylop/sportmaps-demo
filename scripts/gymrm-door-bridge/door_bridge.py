"""
Puente de apertura remota - GYM RM (SportMaps)
==================================================================

Por que existe este script (no borrar sin leer esto):
    Los lectores de GYM RM son ZKTeco F22ID (plataforma ZLM60_TFT). Este
    modelo SI soporta ADMS/HTTPS nativo y reporta asistencia perfecto por
    esa via -- NO necesita bridge para eso.

    El problema es otro y esta acotado: el comando remoto de apertura de
    puerta (CONTROL DEVICE via /iclock/getrequest) es ACEPTADO por el
    firmware (responde Return: 0, exito) pero NO ejecuta la apertura fisica
    del rele. Se probaron variantes de bytes (AA=01/BB=01 y AA=01/BB=00)
    en bff/src/routes/access-adms.ts sin exito fisico, documentado en
    sesiones anteriores (ver docs/specs si existen, o la memoria del
    proyecto). El registro de eventos de asistencia por esa misma via
    funciona sin problema -- el defecto es especifico del comando de
    control fisico, no de la conexion en general.

    Este script bypasea por completo el canal ADMS para el comando de
    apertura: usa el SDK binario nativo (pyzk, TCP puerto 4370, RED LOCAL
    del gym) para invocar el desbloqueo directamente sobre el dispositivo,
    igual que hace el software oficial de escritorio de ZKTeco.

    IMPORTANTE (encontrado en campo 2026-08-26): NO se usa `conn.unlock()`
    de la libreria pyzk. Esa funcion hace `pack("I", int(time)*10)` --
    trunca el tiempo a entero ANTES de multiplicar por 10, asi que nunca
    puede mandar menos de 1 segundo completo aunque el protocolo real
    trabaje en decimas de segundo. A 1s+ el torniquete de GYM RM (brazo
    giratorio sin bloqueo de "una vuelta y se traba") se re-arma varias
    veces durante toda la ventana -- confirmado con el acceso normal
    (huella/tarjeta) y el software oficial de ZKTeco SIN este problema,
    osea que el defecto es especifico de mantener el rele sostenido por
    tiempo largo, no del torniquete ni del comando en si. La solucion:
    mandar el mismo comando (CMD_UNLOCK) pero con el valor en decimas de
    segundo directo, evitando el truncado -- ver PULSE_DECISECONDS abajo
    y open_door_physically(). 0.2s confirmado como pulso limpio de una
    sola pasada en los dos lectores de GYM RM.

CAMBIO 2026-09-21 -- de long-polling HTTP a WebSocket:
    Hasta ahora este script reabria una conexion HTTP cada ~20s para
    siempre (long-polling, ver bff/src/routes/bridge.routes.ts) -- mejor
    que el poll simple de 3s original, pero sigue siendo trafico constante
    contra Render, nunca "dormido" de verdad.

    Ahora abre UNA conexion WebSocket y la mantiene viva: el backend le
    empuja un aviso ({"type":"wake"}) por esa misma conexion apenas se crea
    un comando de apertura (ver bff/src/services/bridgeWsHub.ts), en vez de
    que este script tenga que volver a preguntar. Sin comandos pendientes,
    la conexion no genera trafico nuevo -- el heartbeat (cada
    HEARTBEAT_INTERVAL_SECONDS) es lo unico periodico, y viaja por la misma
    conexion ya abierta, no es una peticion HTTP nueva.

    La conexion se refresca sola una vez al dia, a una hora fija de
    Colombia (RECONNECT_HOUR_COLOMBIA, 3am por defecto) -- no porque haga
    falta para que siga funcionando, sino para no depender de que una
    conexion TCP/WS aguante dias sin que algun proxy/balanceador intermedio
    la corte en silencio sin que ninguno de los dos lados se entere. Hora
    fija (no "cada 24h desde que arranco") a propósito: 3am es cuando el
    gym esta cerrado, para que la ventana de reconexion (unos segundos sin
    poder atender una apertura remota) nunca coincida con alguien esperando
    en la puerta.

    Si el backend todavia no tiene desplegado el endpoint WS
    (/bridge/ws), la conexion falla al conectar o al autenticar -- el
    script lo reporta y reintenta con backoff, igual que si la red
    estuviera caida. No hay fallback automatico al long-polling viejo: si
    hace falta volver atras, es cuestion de redesplegar la version anterior
    de este archivo (control de versiones, no una rama de codigo acá).

Que hace:
- Abre una conexion WebSocket a bffdev.sportmaps.co y se autentica con la
  API key de servicio.
- Escucha avisos ("wake") del backend y comandos ("commands") -- cuando
  encuentra un open_door, se conecta por SDK local al dispositivo
  correspondiente y ejecuta el desbloqueo fisico real.
- Confirma la ejecucion de vuelta al backend (ack, via HTTP -- eso no
  cambia), exito o fallo.
- Manda un heartbeat periodico por la misma conexion WS para que el panel
  sepa que el bridge sigue vivo.
- Si la conexion se cae (red, backend reiniciando, etc.), reconecta con
  backoff corto. Si sigue viva, se reconecta igual cada 24h por las suyas.

Requisitos:
    pip install -r requirements.txt

Uso en produccion:
    No correr esto a mano -- usar install_scheduled_task.ps1 (ver
    README.md de esta carpeta).
"""

import asyncio
import json
import os
import sys
import time
import traceback
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo  # requiere el paquete "tzdata" en Windows (no trae la base de zonas horarias del sistema)

from struct import pack

import requests
import websockets
from zk import ZK, const

# ------------------------------------------------------------------
# CONFIGURACION
# ------------------------------------------------------------------

BACKEND_BASE_URL = "https://bffdev.sportmaps.co"
WS_URL = BACKEND_BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/bridge/ws"
SCHOOL_ID = "2137182d-a695-4695-8e5a-61151fc59196"  # GYM RM

# API key compartida para autenticar este bridge (NO es el JWT de usuario --
# es una credencial de servicio de larga duracion). Debe coincidir con
# BRIDGE_API_KEY en las variables de entorno del BFF en Render.
BRIDGE_API_KEY = os.environ.get("SPORTMAPS_BRIDGE_API_KEY", "CAMBIAR_ESTA_LLAVE")

# Confirmado 2026-08-25 contra el formulario "Editar dispositivo" del
# dashboard (turnstile_devices real): Entrada=JJA1254900899 /
# Salida=JJA1254900898. docs/ACCESS_CONTROL_ZKTECO_HANDOFF.md (2026-06-27)
# tenía el mapeo al revés -- ese doc quedó desactualizado, no este script.
# Las IPs locales de estos lectores sí cambiaron una vez sin dejar rastro
# (ver README, "Si algo cambia en la red") -- si vuelve a pasar, reverificar.
#
# IP actualizada 2026-09-16 (segundo cambio de red, de .6/.7 a estas): el
# nombre local en el software ZKTeco del gimnasio ("SALIDA3" para el serial
# ...899) está mal puesto en el gimnasio -- NO es la dirección real. El
# serial sigue siendo la fuente de verdad, confirmado con el usuario:
# ...899 sigue siendo ENTRADA pese al nombre local.
DEVICES = [
    {
        "name": "LECTOR ENTRADA",
        "ip": "192.168.1.4",
        "port": 4370,
        "serial_number": "JJA1254900899",
    },
    {
        "name": "LECTOR SALIDA",
        "ip": "192.168.1.11",
        "port": 4370,
        "serial_number": "JJA1254900898",
    },
]

# Cada cuanto se manda un heartbeat por la conexion WS -- mantiene
# bridge_heartbeats vivo (el cron de alerta de bridge caido tolera 10 min,
# esto deja margen de sobra sin generar trafico constante).
HEARTBEAT_INTERVAL_SECONDS = int(os.environ.get("SPORTMAPS_BRIDGE_HEARTBEAT_INTERVAL_SECONDS", "60"))

# Hora fija (Colombia) a la que se fuerza una reconexion diaria aunque todo
# siga funcionando bien -- pedido explicito (2026-09-21): no dejar una sola
# conexion viva "para siempre". 3am por defecto = gym cerrado, para que el
# corte de unos segundos nunca coincida con alguien esperando en la puerta.
COLOMBIA_TZ = ZoneInfo("America/Bogota")
RECONNECT_HOUR_COLOMBIA = int(os.environ.get("SPORTMAPS_BRIDGE_WS_RECONNECT_HOUR", "3"))


def seconds_until_next_reconnect():
    now = datetime.now(COLOMBIA_TZ)
    target = now.replace(hour=RECONNECT_HOUR_COLOMBIA, minute=0, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return (target - now).total_seconds()

# Backoff tras un error de conexion (red caida, backend rechazando, etc.).
RECONNECT_BACKOFF_SECONDS = int(os.environ.get("SPORTMAPS_BRIDGE_DOOR_INTERVAL_SECONDS", "5"))

REQUEST_TIMEOUT = 10
DEVICE_CONNECT_TIMEOUT = 8

# Duracion del pulso de desbloqueo, en DECIMAS de segundo (protocolo nativo
# del dispositivo) -- 2 = 0.2s. Confirmado en campo el 2026-08-26 en los dos
# lectores de GYM RM: abre y deja pasar una sola vez, sin re-armarse. NO
# viene de turnstile_devices.door_drive_time_seconds -- ese campo trabaja en
# segundos ENTEROS (CHECK 1-60 en la base) para Door1Drivertime por ADMS, una
# granularidad completamente distinta e insuficiente para este mecanismo.
# Override para volver a calibrar sin editar este archivo:
PULSE_DECISECONDS = int(os.environ.get("SPORTMAPS_BRIDGE_PULSE_DECISECONDS", "2"))

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"{ts} {msg}"
    print(line, flush=True)


DEVICE_BY_SERIAL = {d["serial_number"]: d for d in DEVICES}


# ------------------------------------------------------------------
# Ack -- sigue siendo HTTP normal (infrecuente, no hace falta WS para esto)
# ------------------------------------------------------------------

def ack_command(command_id, success, error_message=None):
    url = f"{BACKEND_BASE_URL}/bridge/door-commands/{command_id}/ack"
    headers = {"X-Bridge-Api-Key": BRIDGE_API_KEY}
    payload = {"success": success}
    if error_message:
        payload["error_message"] = error_message[:500]
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            log(f"ADVERTENCIA: ack de comando {command_id} respondio {resp.status_code}: {resp.text[:200]}")
        return resp.status_code == 200
    except requests.RequestException as e:
        log(f"ERROR de red confirmando comando {command_id}: {e}")
        return False


# ------------------------------------------------------------------
# Ejecucion fisica del comando via SDK local
# ------------------------------------------------------------------

def open_door_physically(device_info):
    """
    Conecta por SDK directo al dispositivo y dispara el pulso de
    desbloqueo. Lanza excepcion si algo falla -- el caller decide como
    manejarlo.

    NO usa conn.unlock() -- esa funcion de pyzk trunca el tiempo a entero
    ANTES de multiplicar por 10 (pack("I", int(time)*10)), asi que nunca
    puede mandar menos de 1 segundo completo. Se manda el mismo comando
    (CMD_UNLOCK, el que unlock() llama por dentro) pero construyendo el
    valor en decimas de segundo directo, via el metodo "privado" de pyzk
    (_ZK__send_command -- nombre mangled de __send_command, definido en la
    clase ZK). Es el mismo mecanismo, sin el truncado.

    Sincronico y bloqueante a proposito (pyzk no es async-nativo) -- se
    llama desde dentro del loop async, bloquea el event loop por el
    tiempo que tarda (tipicamente <1s). Aceptable: las aperturas de
    puerta son esporadicas, no compiten con nada mas frecuente que el
    heartbeat cada 60s.
    """
    name = device_info["name"]
    ip = device_info["ip"]
    port = device_info["port"]

    zk = ZK(ip, port=port, timeout=DEVICE_CONNECT_TIMEOUT)
    conn = None
    try:
        conn = zk.connect()
        command_string = pack("I", PULSE_DECISECONDS)
        resp = conn._ZK__send_command(const.CMD_UNLOCK, command_string)
        if not resp.get('status'):
            raise Exception(f"CMD_UNLOCK rechazado por el dispositivo: {resp}")
        log(f"[{name}] Puerta abierta fisicamente (pulso de {PULSE_DECISECONDS/10}s).")
        return True
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass


# ------------------------------------------------------------------
# Procesamiento de comandos (igual que antes, ahora alimentado por WS)
# ------------------------------------------------------------------

def process_command(cmd):
    """
    cmd esperado: {"id": uuid, "device_serial": str, "command_type": "open_door", ...}
    """
    cmd_id = cmd.get("id")
    serial = cmd.get("device_serial")

    device_info = DEVICE_BY_SERIAL.get(serial)
    if not device_info:
        log(f"ERROR: comando {cmd_id} referencia serial desconocido '{serial}' "
            f"(no esta en DEVICES de este script). Se marca como fallido.")
        ack_command(cmd_id, success=False, error_message=f"Serial no reconocido por el bridge: {serial}")
        return

    log(f"Procesando comando {cmd_id} -> {device_info['name']} ({serial})")
    try:
        open_door_physically(device_info)
        ack_command(cmd_id, success=True)
    except Exception as e:
        error_msg = f"{type(e).__name__}: {e}"
        log(f"ERROR abriendo puerta fisicamente para comando {cmd_id}: {error_msg}")
        log(traceback.format_exc())
        ack_command(cmd_id, success=False, error_message=error_msg)


# ------------------------------------------------------------------
# Conexion WebSocket
# ------------------------------------------------------------------

async def handle_connection():
    """
    Una vuelta completa: conectar, autenticar, escuchar hasta que toque
    reconectar (por edad de la conexion o por un error). Nunca lanza hacia
    afuera en el camino normal -- devuelve cuando es momento de reconectar,
    el loop externo decide si espera un backoff o no.
    """
    async with websockets.connect(WS_URL, ping_interval=20, ping_timeout=20, close_timeout=5) as ws:
        await ws.send(json.dumps({"type": "auth", "school_id": SCHOOL_ID, "api_key": BRIDGE_API_KEY}))
        auth_raw = await asyncio.wait_for(ws.recv(), timeout=REQUEST_TIMEOUT)
        auth_resp = json.loads(auth_raw)
        if auth_resp.get("type") != "auth_ok":
            log(f"ERROR: autenticacion WS rechazada ({auth_resp}). Revisa que "
                f"SPORTMAPS_BRIDGE_API_KEY coincida con lo configurado en Render.")
            return

        log(f"Conectado y autenticado por WebSocket ({WS_URL}).")
        last_heartbeat = time.monotonic()
        reconnect_at = datetime.now(COLOMBIA_TZ) + timedelta(seconds=seconds_until_next_reconnect())
        log(f"Proxima reconexion programada: {reconnect_at.strftime('%Y-%m-%d %H:%M')} hora Colombia.")

        while True:
            if datetime.now(COLOMBIA_TZ) >= reconnect_at:
                log(f"Hora de reconexion diaria ({RECONNECT_HOUR_COLOMBIA}:00 Colombia) -- "
                    f"reconectando para refrescar la sesion.")
                return

            since_heartbeat = time.monotonic() - last_heartbeat
            wait_for = max(1, HEARTBEAT_INTERVAL_SECONDS - since_heartbeat)

            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=wait_for)
            except asyncio.TimeoutError:
                # Nada llego en la ventana -- toca mandar el heartbeat.
                await ws.send(json.dumps({"type": "heartbeat"}))
                last_heartbeat = time.monotonic()
                continue

            try:
                msg = json.loads(raw)
            except ValueError:
                continue

            msg_type = msg.get("type")
            if msg_type == "wake":
                # El backend avisa que hay algo nuevo -- pedirlo explicito
                # (mismo mecanismo de reclamo atomico de siempre del lado
                # del servidor, no cambia nada ahi).
                await ws.send(json.dumps({"type": "poll"}))
            elif msg_type == "commands":
                commands = msg.get("commands") or []
                if commands:
                    log(f"{len(commands)} comando(s) recibido(s) por WebSocket.")
                for cmd in commands:
                    process_command(cmd)
            # cualquier otro tipo (auth_ok tardio, etc.) se ignora


async def main_async():
    log("=== Puente de apertura remota - GYM RM (WebSocket) ===")
    log(f"WS: {WS_URL}")
    log(f"School ID: {SCHOOL_ID}")
    log(f"Heartbeat: cada {HEARTBEAT_INTERVAL_SECONDS}s | Reconexion forzada: diaria a las "
        f"{RECONNECT_HOUR_COLOMBIA}:00 hora Colombia")
    log(f"Dispositivos: {', '.join(d['name'] + ' (' + d['ip'] + ')' for d in DEVICES)}")

    if BRIDGE_API_KEY == "CAMBIAR_ESTA_LLAVE":
        log("ADVERTENCIA CRITICA: SPORTMAPS_BRIDGE_API_KEY no esta configurada "
            "como variable de entorno. El backend va a rechazar la autenticacion. "
            "Ver README.md, seccion 'Configurar la API key'.")

    while True:
        try:
            await handle_connection()
        except (websockets.exceptions.ConnectionClosed, OSError, asyncio.TimeoutError) as e:
            log(f"ERROR de conexion WS: {type(e).__name__}: {e}")
        except Exception as e:
            log(f"ERROR inesperado en la conexion WS: {type(e).__name__}: {e}")
            log(traceback.format_exc())

        log(f"Reconectando en {RECONNECT_BACKOFF_SECONDS}s...")
        await asyncio.sleep(RECONNECT_BACKOFF_SECONDS)


def main():
    asyncio.run(main_async())


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Detenido por el usuario.")
        sys.exit(0)
