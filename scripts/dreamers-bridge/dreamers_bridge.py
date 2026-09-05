"""
Agente local - Puente ZKTeco -> SportMaps (Dreamers Gymnastics)
==================================================================

Por que existe este script (no borrar sin leer esto):
    Los lectores de Dreamers son ZKTeco MB360/ID (plataforma ZMM220_TFT).
    Ese modelo no soporta HTTPS en su push ADMS nativo, y bffdev.sportmaps.co
    fuerza HTTPS a nivel de Render/Cloudflare (no es algo que podamos apagar
    desde nuestro lado). Sin este bridge, los lectores nunca completan el
    push y no llega NADA al backend -- confirmado el 2026-08-21: cero
    handshakes/options reales de estos seriales en adms_device_log.
    RMGYM (modelo F22ID/ZLM60_TFT) SI soporta HTTPS nativo y no necesita esto.
    Ver docs/specs/adms-ip-allowlist-per-device.md y
    docs/ACCESS_CONTROL_ZKTECO_HANDOFF.md para el resto del contexto.

Que hace:
- Se conecta por SDK local (puerto 4370) a cada torniquete configurado abajo.
- Cada cierto intervalo, revisa si hay registros de asistencia nuevos.
- Los reenvia al backend (bffdev.sportmaps.co) usando el mismo protocolo
  ADMS/PUSH que el dispositivo usaria si su conexion cloud funcionara,
  asi que el backend los procesa exactamente igual que si vinieran del
  equipo directamente.
- Lleva un registro local (bridge_state.json) de que fue lo ultimo
  enviado, para no duplicar eventos.
- APERTURA MANUAL (agregado 2026-08-27, mismo patron que
  scripts/gymrm-door-bridge/): como estos lectores no hablan ADMS nunca,
  un click de "abrir puerta" en el dashboard tampoco les llegaria nunca por
  ese canal -- se quedaria 'pending' hasta expirar. Este script ahora
  tambien sondea el endpoint dedicado /bridge/door-commands (el mismo que
  usa GYM RM, ya generico por school_id, sin cambios de backend) y ejecuta
  el desbloqueo fisico via el comando de bajo nivel CMD_UNLOCK con el valor
  en decimas de segundo directo -- NO conn.unlock(), que trunca a entero
  antes de multiplicar por 10 y nunca manda menos de 1 segundo sostenido
  (ver PULSE_DECISECONDS abajo). En GYM RM eso causaba que el torniquete se
  re-armara varias veces por click; ACA TODAVIA NO SE PROBO EN CAMPO -- el
  valor de partida es una copia conservadora del de GYM RM, hay que
  calibrarlo con el torniquete real (ver README.md, seccion "Calibrar el
  pulso de apertura").

- BLOQUEO POR MORA / GRUPO (agregado 2026-09-05, mismo hallazgo que la
  apertura manual): `set_group` (banco de horas bloqueando por mora,
  boton "Bloquear ahora" de Control de Acceso) tampoco le llega nunca a
  estos lectores por ADMS -- se confirmo en vivo el 2026-09-05 que quedan
  'pending' para siempre (nunca 'executed' ni 'failed'), y de paso que
  `set_drive_time` tiene el mismo problema desde antes (8 comandos
  'expired' del 29-ago). El endpoint /bridge/door-commands ahora acepta
  `command_types=open_door,set_group` (antes solo devolvia open_door) --
  este script pide ambos y ejecuta el cambio de grupo via pyzk
  `set_user()` (DATA UPDATE USERINFO Grp=<N> en terminos ADMS). Requiere
  que el PIN ya este enrolado localmente en CADA lector (entrada y salida
  tienen su propia base de huellas) -- si no esta, el comando falla con un
  mensaje claro en vez de fallar en silencio. TODAVIA NO SE PROBO EN CAMPO
  si el Grupo 2 de estos equipos realmente bloquea el paso (ver README.md,
  seccion "Probar el bloqueo por Grupo") -- eso es configuracion del propio
  equipo, este script solo asegura que el cambio de grupo LLEGUE.

Requisitos (instalar una sola vez):
    pip install -r requirements.txt

Uso directo (pruebas manuales):
    python dreamers_bridge.py

Uso en produccion:
    No correr esto a mano ni en una consola suelta -- usar
    install_scheduled_task.ps1 (ver README.md de esta carpeta), que lo deja
    como tarea programada de Windows con auto-reinicio, corriendo aunque
    nadie tenga sesion abierta.
"""

import json
import os
import time
import traceback
from datetime import datetime
from struct import pack

import requests
from zk import ZK, const

# ------------------------------------------------------------------
# CONFIGURACION - ajusta aqui si algo cambia
# ------------------------------------------------------------------

BACKEND_BASE_URL = "https://bffdev.sportmaps.co"

DEVICES = [
    {
        "name": "LECTOR ENTRADA",
        "ip": "192.168.1.201",  # corregido 2026-09-05 -- estaba .203, confirmado
                                 # en el menu del equipo que la IP real es .201
                                 # (coincide con turnstile_devices.ip_address).
        "port": 4370,
        "serial_number": "CEZU222860004",
    },
    {
        "name": "LECTOR SALIDA",
        "ip": "192.168.1.202",
        "port": 4370,
        "serial_number": "CEZU214960067",
    },
]

POLL_INTERVAL_SECONDS = 5
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bridge_state.json")

# ------------------------------------------------------------------
# Apertura manual -- mismo endpoint /bridge/door-commands que GYM RM
# ------------------------------------------------------------------

SCHOOL_ID = "57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe"  # Dreamers Gymnastics

# Misma API key de servicio que scripts/gymrm-door-bridge (BRIDGE_API_KEY es
# una sola variable global en Render, no por escuela). Configurar en esta PC
# con el mismo valor que ya esta seteado en Render para sportmaps-bff-dev.
BRIDGE_API_KEY = os.environ.get("SPORTMAPS_BRIDGE_API_KEY", "CAMBIAR_ESTA_LLAVE")

# Decimas de segundo para el pulso de CMD_UNLOCK. Arranca igual que GYM RM
# (0.2s) como punto de partida conservador -- SIN VALIDAR TODAVIA en el
# torniquete real de Dreamers. Puede que se necesite otro valor: calibrar
# con este mismo mecanismo (ver README, "Calibrar el pulso de apertura").
DOOR_PULSE_DECISECONDS = int(os.environ.get("SPORTMAPS_BRIDGE_PULSE_DECISECONDS", "2"))
DEVICE_BY_SERIAL = {d["serial_number"]: d for d in DEVICES}

# ------------------------------------------------------------------
# Estado local (para no reenviar los mismos eventos)
# ------------------------------------------------------------------

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_state(state):
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


# ------------------------------------------------------------------
# Formato ADMS: el backend espera lineas tipo ATTLOG separadas por tab
#   PIN\tTIMESTAMP\tSTATUS\tVERIFY\tWORKCODE\t...
# Esto imita exactamente lo que el propio dispositivo enviaria por
# HTTP POST a /iclock/cdata?SN=<serial>&table=ATTLOG
# ------------------------------------------------------------------

def build_attlog_line(pin, timestamp, status=0, verify=1):
    ts_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")
    return f"{pin}\t{ts_str}\t{status}\t{verify}\t0\t0\t0"


def push_attlog(serial_number, lines):
    if not lines:
        return True
    body = "\n".join(lines)
    stamp = int(time.time())
    url = f"{BACKEND_BASE_URL}/iclock/cdata"
    params = {"SN": serial_number, "table": "ATTLOG", "Stamp": stamp}
    headers = {"Content-Type": "text/plain"}
    try:
        resp = requests.post(url, params=params, data=body.encode("utf-8"), headers=headers, timeout=15)
        print(f"[{serial_number}] POST -> status {resp.status_code} | body: {resp.text[:200]}")
        return resp.status_code == 200
    except requests.RequestException as e:
        print(f"[{serial_number}] ERROR enviando al backend: {e}")
        return False


def send_heartbeat(serial_number):
    """Avisa al backend que el dispositivo esta vivo (getrequest = heartbeat/poll)."""
    url = f"{BACKEND_BASE_URL}/iclock/getrequest"
    try:
        resp = requests.get(url, params={"SN": serial_number}, timeout=10)
        print(f"[{serial_number}] heartbeat -> {resp.status_code}")
    except requests.RequestException as e:
        print(f"[{serial_number}] ERROR en heartbeat: {e}")


# ------------------------------------------------------------------
# Apertura manual -- mismo endpoint dedicado que scripts/gymrm-door-bridge
# ------------------------------------------------------------------

def fetch_pending_door_commands():
    """
    Devuelve los comandos pendientes de Dreamers (open_door, disable_user/
    enable_user para el bloqueo por mora, + set_group por si queda alguno
    viejo sin procesar), o None si el endpoint no responde (error de red /
    API key mal puesta) para que el caller distinga "nada que hacer" de "no
    pude preguntar".

    Dreamers pasó de set_group a disable_user/enable_user (2026-09-05,
    school_settings.access_block_mechanism='disable') -- confirmado en campo
    que este MB360/ID no tiene Zonas Horarias/Grupos ni en su menú local ni
    de forma efectiva vía el bridge. set_group sigue en la lista solo por
    compatibilidad con comandos viejos ya encolados antes del cambio.
    """
    url = f"{BACKEND_BASE_URL}/bridge/door-commands"
    headers = {"X-Bridge-Api-Key": BRIDGE_API_KEY}
    params = {"school_id": SCHOOL_ID, "command_types": "open_door,set_group,disable_user,enable_user"}
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=10)
    except requests.RequestException as e:
        print(f"ERROR de red consultando comandos de apertura: {e}")
        return None

    if resp.status_code == 401 or resp.status_code == 403:
        print(f"ERROR: autenticacion rechazada ({resp.status_code}). Revisa que "
              f"SPORTMAPS_BRIDGE_API_KEY coincida con lo configurado en Render.")
        return None
    if resp.status_code != 200:
        print(f"ERROR: respuesta inesperada de door-commands ({resp.status_code}): {resp.text[:200]}")
        return None

    try:
        return resp.json().get("commands", [])
    except ValueError:
        print(f"ERROR: respuesta de door-commands no es JSON valido: {resp.text[:200]}")
        return None


def ack_door_command(command_id, success, error_message=None):
    url = f"{BACKEND_BASE_URL}/bridge/door-commands/{command_id}/ack"
    headers = {"X-Bridge-Api-Key": BRIDGE_API_KEY}
    payload = {"success": success}
    if error_message:
        payload["error_message"] = error_message[:500]
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=10)
        if resp.status_code != 200:
            print(f"ADVERTENCIA: ack de comando {command_id} respondio {resp.status_code}: {resp.text[:200]}")
    except requests.RequestException as e:
        print(f"ERROR de red confirmando comando {command_id}: {e}")


def open_door_physically(device):
    """
    Conecta por SDK directo y dispara el pulso de desbloqueo por
    CMD_UNLOCK de bajo nivel (NO conn.unlock(), ver docstring del modulo).
    Lanza excepcion si algo falla -- el caller decide como manejarlo.
    """
    zk = ZK(device["ip"], port=device["port"], timeout=10)
    conn = None
    try:
        conn = zk.connect()
        command_string = pack("I", DOOR_PULSE_DECISECONDS)
        resp = conn._ZK__send_command(const.CMD_UNLOCK, command_string)
        if not resp.get('status'):
            raise Exception(f"CMD_UNLOCK rechazado por el dispositivo: {resp}")
        print(f"[{device['name']}] Puerta abierta fisicamente (pulso de {DOOR_PULSE_DECISECONDS/10}s).")
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass


def set_group_physically(device, pin, group):
    """
    Conecta por SDK directo y mueve el PIN al grupo indicado (2 = bloqueado,
    1 = normal), preservando el resto de los datos del usuario (nombre,
    privilegio, clave, tarjeta) -- pyzk.set_user() reescribe el registro
    completo, así que hay que leerlo primero con get_users() y solo cambiar
    group_id, o se pierde el nombre/tarjeta del usuario en el lector.
    Lanza excepcion si el PIN no esta enrolado localmente en este lector, o
    si el dispositivo la rechaza -- el caller decide como manejarlo.

    IMPORTANTE (2026-09-05, incidente en campo): a diferencia de
    open_door_physically() (un solo comando de bajo nivel), esto hace una
    lectura completa de usuarios (get_users()) + una escritura (set_user())
    -- una operacion mas larga. La primera version de esta funcion no
    llamaba disable_device()/enable_device() como sí hace poll_device() para
    leer asistencia, y el lector de entrada de Dreamers dejo de responder
    en la red (no solo el comando: last_seen_at tambien se congelo) despues
    de una tanda de estos comandos. No hay certeza de que esto sea LA causa
    (pudo coincidir con otra cosa), pero deshabilitar el equipo durante la
    escritura es el mismo cuidado que ya se tiene para asistencia, asi que
    se agrega acá tambien -- evita que el firmware tenga que atender una
    huella en vivo a mitad de una escritura de usuario.
    """
    zk = ZK(device["ip"], port=device["port"], timeout=10)
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        existing = next((u for u in conn.get_users() if str(u.user_id) == str(pin)), None)
        if existing is None:
            raise Exception(f"PIN {pin} no esta enrolado localmente en este lector")

        conn.set_user(
            uid=existing.uid,
            name=existing.name,
            privilege=existing.privilege,
            password=existing.password,
            group_id=str(group),
            user_id=existing.user_id,
            card=existing.card,
        )
        print(f"[{device['name']}] PIN {pin} movido a grupo {group}.")
    finally:
        if conn:
            try:
                conn.enable_device()
            except Exception:
                pass
            try:
                conn.disconnect()
            except Exception:
                pass


def set_enabled_physically(device, pin, enabled):
    """
    Habilita/deshabilita el PIN por completo (bloqueo por mora en Dreamers,
    2026-09-05 -- reemplaza a set_group_physically porque este MB360/ID no
    tiene Zonas Horarias/Grupos). El campo "Enable" de ADMS (DATA UPDATE
    USERINFO PIN=x Enable=0/1) no existe como parametro aparte en pyzk --
    es el BIT 0 del campo `privilege` (confirmado en el codigo fuente de
    pyzk: User.is_disabled() = bool(self.privilege & 1)). Se prende ese bit
    para bloquear, se apaga para restaurar, preservando el resto del
    privilegio (ej. un admin deshabilitado sigue siendo admin al reactivarlo).

    Mismo cuidado que set_group_physically(): disable_device()/enable_device()
    alrededor de la lectura+escritura, por el incidente de campo del
    2026-09-05 con el lector de entrada.
    """
    zk = ZK(device["ip"], port=device["port"], timeout=10)
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        existing = next((u for u in conn.get_users() if str(u.user_id) == str(pin)), None)
        if existing is None:
            raise Exception(f"PIN {pin} no esta enrolado localmente en este lector")

        # Bit 0 de privilege: 1 = deshabilitado, 0 = habilitado.
        new_privilege = (existing.privilege & 0xFE) if enabled else (existing.privilege | 1)

        conn.set_user(
            uid=existing.uid,
            name=existing.name,
            privilege=new_privilege,
            password=existing.password,
            group_id=existing.group_id,
            user_id=existing.user_id,
            card=existing.card,
        )
        print(f"[{device['name']}] PIN {pin} {'habilitado' if enabled else 'deshabilitado'}.")
    finally:
        if conn:
            try:
                conn.enable_device()
            except Exception:
                pass
            try:
                conn.disconnect()
            except Exception:
                pass


def process_door_commands():
    commands = fetch_pending_door_commands()
    if not commands:
        return

    print(f"{len(commands)} comando(s) pendiente(s).")
    for cmd in commands:
        cmd_id = cmd.get("id")
        serial = cmd.get("device_serial")
        command_type = cmd.get("command_type", "open_door")
        device = DEVICE_BY_SERIAL.get(serial)

        if not device:
            print(f"ERROR: comando {cmd_id} referencia serial desconocido '{serial}'.")
            ack_door_command(cmd_id, success=False, error_message=f"Serial no reconocido: {serial}")
            continue

        print(f"Procesando comando {cmd_id} ({command_type}) -> {device['name']} ({serial})")
        try:
            if command_type == "set_group":
                metadata = cmd.get("metadata") or {}
                pin = metadata.get("pin")
                group = metadata.get("group")
                if pin is None or group is None:
                    raise Exception(f"metadata incompleta para set_group: {metadata}")
                set_group_physically(device, pin, group)
            elif command_type in ("disable_user", "enable_user"):
                metadata = cmd.get("metadata") or {}
                pin = metadata.get("pin")
                if pin is None:
                    raise Exception(f"metadata incompleta para {command_type}: {metadata}")
                set_enabled_physically(device, pin, enabled=(command_type == "enable_user"))
            else:
                open_door_physically(device)
            ack_door_command(cmd_id, success=True)
        except Exception as e:
            error_msg = f"{type(e).__name__}: {e}"
            print(f"ERROR ejecutando comando {cmd_id} ({command_type}) fisicamente: {error_msg}")
            print(traceback.format_exc())
            ack_door_command(cmd_id, success=False, error_message=error_msg)


# ------------------------------------------------------------------
# Loop principal
# ------------------------------------------------------------------

def poll_device(device, state):
    name = device["name"]
    ip = device["ip"]
    port = device["port"]
    serial_number = device["serial_number"]

    last_sent_key = f"last_sent_{serial_number}"
    last_sent_iso = state.get(last_sent_key)

    # IMPORTANTE: si nunca se ha corrido el bridge para este dispositivo,
    # NO tomamos todo el historial (puede tener anios de registros de
    # fabrica/pruebas). En su lugar marcamos el arranque como "ahora" y
    # desde el proximo ciclo solo se envian eventos nuevos.
    first_run = last_sent_iso is None
    if first_run:
        now_iso = datetime.now().isoformat()
        state[last_sent_key] = now_iso
        save_state(state)
        print(f"[{name}] primera ejecucion: se omite historial previo. "
              f"Desde ahora ({now_iso}) se capturaran eventos nuevos.")
        send_heartbeat(serial_number)
        return

    last_sent_dt = datetime.fromisoformat(last_sent_iso)

    zk = ZK(ip, port=port, timeout=10)
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        # Heartbeat primero, para que last_seen_at se actualice en la base
        send_heartbeat(serial_number)

        attendances = conn.get_attendance()
        if not attendances:
            print(f"[{name}] sin registros en el equipo.")
            return

        # Filtra solo los eventos mas nuevos que el ultimo enviado
        new_records = [
            a for a in attendances
            if a.timestamp > last_sent_dt
        ]

        # Limite de seguridad: si por alguna razon aparecen demasiados
        # eventos "nuevos" de golpe, no los mandamos todos - eso indica
        # un problema (ej. reloj del dispositivo mal, o vaciado masivo).
        MAX_EVENTS_PER_CYCLE = 20
        if len(new_records) > MAX_EVENTS_PER_CYCLE:
            print(f"[{name}] ADVERTENCIA: se detectaron {len(new_records)} eventos "
                  f"nuevos de golpe (> {MAX_EVENTS_PER_CYCLE}). Esto es sospechoso, "
                  f"no se envia nada este ciclo. Revisa el reloj del dispositivo.")
            return

        if not new_records:
            print(f"[{name}] no hay eventos nuevos desde {last_sent_dt}.")
            return

        new_records.sort(key=lambda a: a.timestamp)

        lines = [build_attlog_line(a.user_id, a.timestamp, a.status, a.punch) for a in new_records]

        ok = push_attlog(serial_number, lines)
        if ok:
            newest = new_records[-1].timestamp
            state[last_sent_key] = newest.isoformat()
            save_state(state)
            print(f"[{name}] {len(new_records)} evento(s) enviado(s). Ultimo: {newest}")
        else:
            print(f"[{name}] fallo el envio, se reintentara en el proximo ciclo.")

    except Exception as e:
        print(f"[{name}] ERROR conectando al dispositivo ({ip}:{port}): {e}")
    finally:
        if conn:
            try:
                conn.enable_device()
                conn.disconnect()
            except Exception:
                pass


def main():
    print("=== Puente ZKTeco -> SportMaps (Dreamers Gymnastics) ===")
    print(f"Backend: {BACKEND_BASE_URL}")
    print(f"School ID: {SCHOOL_ID}")
    print(f"Intervalo de sondeo: {POLL_INTERVAL_SECONDS}s")
    print("Presiona Ctrl+C para detener.\n")

    if BRIDGE_API_KEY == "CAMBIAR_ESTA_LLAVE":
        print("ADVERTENCIA CRITICA: SPORTMAPS_BRIDGE_API_KEY no esta configurada. "
              "La asistencia va a seguir funcionando, pero la apertura manual "
              "va a fallar con 401. Ver README.md.")

    state = load_state()

    while True:
        for device in DEVICES:
            poll_device(device, state)
        process_door_commands()
        print(f"--- Ciclo completo, esperando {POLL_INTERVAL_SECONDS}s ---\n")
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nDetenido por el usuario.")
