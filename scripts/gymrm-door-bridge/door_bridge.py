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

    ANTES DE INSTALAR — ver VALIDACION-2026-08-25.md en esta misma carpeta.
    El mapeo serial→dirección de abajo ya está confirmado contra la base
    real. Lo que sigue bloqueante es el backend: el endpoint que este
    script consume todavía no existe (ver BACKEND_ENDPOINT_SPEC.md), y
    `access-adms.ts` tiene que dejar de servir `open_door` por ADMS antes
    de desplegarlo (si no, un comando se puede marcar "ejecutado" sin que
    la puerta abra).

Que hace:
- Sondea el backend (endpoint dedicado /bridge/door-commands, NO el canal
  ADMS) preguntando si hay comandos 'open_door' pendientes para los
  dispositivos de GYM RM.
- Cuando encuentra uno, se conecta por SDK local al dispositivo
  correspondiente y ejecuta el desbloqueo fisico real.
- Confirma la ejecucion de vuelta al backend (ack), exito o fallo.
- Si el backend no tiene el endpoint nuevo desplegado todavia, el script
  lo reporta claramente en el log y sigue reintentando (no se cae).

Requisitos:
    pip install -r requirements.txt

Uso en produccion:
    No correr esto a mano -- usar install_scheduled_task.ps1 (ver
    README.md de esta carpeta).
"""

import os
import sys
import time
import traceback
from datetime import datetime

from struct import pack

import requests
from zk import ZK, const

# ------------------------------------------------------------------
# CONFIGURACION
# ------------------------------------------------------------------

BACKEND_BASE_URL = "https://bffdev.sportmaps.co"
SCHOOL_ID = "2137182d-a695-4695-8e5a-61151fc59196"  # GYM RM

# API key compartida para autenticar este bridge contra el endpoint
# /bridge/door-commands (NO es el JWT de usuario -- es una credencial de
# servicio de larga duracion). Debe coincidir con BRIDGE_API_KEY en las
# variables de entorno del BFF en Render. Se lee de variable de entorno
# local para no dejarla escrita en texto plano en el script; si no esta
# seteada, se usa el placeholder y el script lo advierte fuerte en el log.
BRIDGE_API_KEY = os.environ.get("SPORTMAPS_BRIDGE_API_KEY", "CAMBIAR_ESTA_LLAVE")

# Confirmado 2026-08-25 contra el formulario "Editar dispositivo" del
# dashboard (turnstile_devices real): Entrada=JJA1254900899 /
# Salida=JJA1254900898. docs/ACCESS_CONTROL_ZKTECO_HANDOFF.md (2026-06-27)
# tenía el mapeo al revés -- ese doc quedó desactualizado, no este script.
# Las IPs locales de estos lectores sí cambiaron una vez sin dejar rastro
# (ver README, "Si algo cambia en la red") -- si vuelve a pasar, reverificar.
DEVICES = [
    {
        "name": "LECTOR ENTRADA",
        "ip": "192.168.1.6",
        "port": 4370,
        "serial_number": "JJA1254900899",
    },
    {
        "name": "LECTOR SALIDA",
        "ip": "192.168.1.7",
        "port": 4370,
        "serial_number": "JJA1254900898",
    },
]

POLL_INTERVAL_SECONDS = 3
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
# Comunicacion con el backend (endpoint dedicado del bridge)
# ------------------------------------------------------------------

def fetch_pending_commands():
    """
    Devuelve una lista de comandos open_door pendientes para GYM RM, o
    None si el endpoint aun no existe / hay error de red (para que el
    caller distinga "no hay nada que hacer" de "no pude preguntar").
    """
    url = f"{BACKEND_BASE_URL}/bridge/door-commands"
    headers = {"X-Bridge-Api-Key": BRIDGE_API_KEY}
    params = {"school_id": SCHOOL_ID}
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=REQUEST_TIMEOUT)
    except requests.RequestException as e:
        log(f"ERROR de red consultando comandos pendientes: {e}")
        return None

    if resp.status_code == 404:
        log("ERROR: el backend todavia no tiene el endpoint /bridge/door-commands "
            "desplegado. Este bridge no puede funcionar hasta que se agregue "
            "(ver BACKEND_ENDPOINT_SPEC.md). Reintentando en el proximo ciclo.")
        return None
    if resp.status_code == 401 or resp.status_code == 403:
        log(f"ERROR: autenticacion rechazada ({resp.status_code}). Revisa que "
            f"SPORTMAPS_BRIDGE_API_KEY coincida con lo configurado en el backend.")
        return None
    if resp.status_code != 200:
        log(f"ERROR: respuesta inesperada del backend ({resp.status_code}): {resp.text[:200]}")
        return None

    try:
        data = resp.json()
    except ValueError:
        log(f"ERROR: respuesta no es JSON valido: {resp.text[:200]}")
        return None

    return data.get("commands", [])


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
# Loop principal
# ------------------------------------------------------------------

def process_command(cmd):
    """
    cmd esperado: {"id": uuid, "device_serial": str, "command_type": "open_door"}
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


def main():
    log("=== Puente de apertura remota - GYM RM ===")
    log(f"Backend: {BACKEND_BASE_URL}")
    log(f"School ID: {SCHOOL_ID}")
    log(f"Dispositivos: {', '.join(d['name'] + ' (' + d['ip'] + ')' for d in DEVICES)}")
    log(f"Intervalo de sondeo: {POLL_INTERVAL_SECONDS}s")

    if BRIDGE_API_KEY == "CAMBIAR_ESTA_LLAVE":
        log("ADVERTENCIA CRITICA: SPORTMAPS_BRIDGE_API_KEY no esta configurada "
            "como variable de entorno. El backend va a rechazar todas las "
            "peticiones. Ver README.md, seccion 'Configurar la API key'.")

    while True:
        commands = fetch_pending_commands()
        if commands:
            log(f"{len(commands)} comando(s) pendiente(s) encontrado(s).")
            for cmd in commands:
                process_command(cmd)
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Detenido por el usuario.")
        sys.exit(0)
