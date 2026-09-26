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
- Cada cierto intervalo, revisa si hay registros de asistencia nuevos y los
  reenvia al backend (bffdev.sportmaps.co) usando el mismo protocolo
  ADMS/PUSH que el dispositivo usaria si su conexion cloud funcionara, asi
  que el backend los procesa exactamente igual que si vinieran del equipo
  directamente.
- Lleva un registro local (bridge_state.json) de que fue lo ultimo enviado,
  para no duplicar eventos.

CAMBIO 2026-09-25 -- de HTTP polling a WebSocket para el canal de comandos:
    Hasta ahora este script volvia a preguntar por HTTP cada
    POLL_INTERVAL_SECONDS si habia comandos de puerta/bloqueo pendientes --
    trafico constante contra Render las 24h, la mayor parte del tiempo sin
    nada que hacer. Mismo cambio que se hizo para GYM RM el 2026-09-21 (ver
    scripts/gymrm-door-bridge/door_bridge.py para el razonamiento completo).

    Ahora abre UNA conexion WebSocket y la mantiene viva: el backend empuja
    un aviso ({"type":"wake"}) por esa misma conexion apenas se crea un
    comando nuevo, en vez de que este script tenga que volver a preguntar.
    La conexion se refresca sola una vez al dia a una hora fija de Colombia
    (RECONNECT_HOUR_COLOMBIA, 3am por defecto) -- mismo motivo que GYM RM:
    no depender de que una conexion aguante dias sin que algun proxy
    intermedio la corte en silencio, y hacerlo a una hora en que el gym esta
    cerrado.

    La captura de asistencia (poll_device) NO se movio a WS -- sigue siendo
    su propio ciclo de sondeo cada POLL_INTERVAL_SECONDS, corriendo en un
    hilo aparte del cliente WS. Son mecanismos independientes: uno lee
    eventos que YA pasaron (asistencia), el otro reacciona a algo que el
    backend pide AHORA (abrir puerta, bloquear). Como ahora SI hay dos hilos
    que pueden llegar a tocar el mismo torniquete al mismo tiempo (antes
    todo era secuencial en un solo hilo), cada dispositivo tiene su propio
    Lock (DEVICE_LOCKS) que se toma antes de cualquier conexion SDK --
    sin esto, dos conexiones simultaneas al mismo equipo pueden colgarlo o
    hacer que ambas fallen (el firmware ZKTeco solo atiende una a la vez).

    BUG DE PRODUCCION encontrado el 2026-09-25 y corregido acá: si
    poll_device() detecta mas de MAX_EVENTS_PER_CYCLE eventos nuevos de
    golpe, el codigo anterior cortaba SIN avanzar el cursor de "ultimo
    enviado" -- asi que volvia a ver los mismos eventos "nuevos" en el
    siguiente ciclo, para siempre, sin mandar ninguno y sin salir solo de
    ese estado. Le paso exactamente eso a LECTOR ENTRADA: goteo de
    asistencia real (huellas de alumnos) durante 3 dias sin que nada lo
    reportara como caido, porque bridge_heartbeats (que solo depende del
    sondeo de comandos, un canal aparte) seguia viendose sano. Ahora, si
    pasa esto, se loguea fuerte pero el cursor SI avanza -- se saltan esos
    eventos (a proposito, no se reenvian) en vez de quedar trabado.

    Si el backend todavia no tiene desplegado el endpoint WS (/bridge/ws),
    la conexion falla al conectar o al autenticar -- el script lo reporta y
    reintenta con backoff. No hay fallback automatico al HTTP polling viejo.

- APERTURA MANUAL (agregado 2026-08-27): como estos lectores no hablan ADMS
  nunca, un click de "abrir puerta" en el dashboard tampoco les llegaria
  nunca por ese canal. Se ejecuta el desbloqueo fisico via el comando de
  bajo nivel CMD_UNLOCK con el valor en decimas de segundo directo -- NO
  conn.unlock(), que trunca a entero antes de multiplicar por 10 y nunca
  manda menos de 1 segundo sostenido (ver PULSE_DECISECONDS abajo).

- BLOQUEO POR MORA (agregado 2026-09-05): `disable_user`/`enable_user`
  (banco de horas bloqueando por mora) tampoco le llega nunca a estos
  lectores por ADMS. Se ejecuta via pyzk `set_user()` prendiendo/apagando
  el bit 0 de `privilege` (Enable de ADMS no existe como parametro aparte
  en pyzk). `set_group` sigue soportado solo por compatibilidad con
  comandos viejos ya encolados antes del cambio a disable_user/enable_user.

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

import asyncio
import json
import os
import sys
import threading
import time
import traceback
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo  # requiere el paquete "tzdata" en Windows
from struct import pack

import requests
import websockets
from zk import ZK, const

# ------------------------------------------------------------------
# CONFIGURACION - ajusta aqui si algo cambia
# ------------------------------------------------------------------

BACKEND_BASE_URL = "https://bffdev.sportmaps.co"
WS_URL = BACKEND_BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/bridge/ws"

DEVICES = [
    {
        "name": "LECTOR ENTRADA",
        "ip": "192.168.1.201",
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

POLL_INTERVAL_SECONDS = int(os.environ.get("SPORTMAPS_BRIDGE_POLL_INTERVAL_SECONDS", "5"))
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bridge_state.json")

SCHOOL_ID = "57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe"  # Dreamers Gymnastics

# Misma API key de servicio que scripts/gymrm-door-bridge (BRIDGE_API_KEY es
# una sola variable global en Render, no por escuela).
BRIDGE_API_KEY = os.environ.get("SPORTMAPS_BRIDGE_API_KEY", "CAMBIAR_ESTA_LLAVE")

# Tipos de comando que este bridge pide por WS -- a diferencia de GYM RM
# (solo open_door: su F22ID procesa set_group nativo por ADMS), Dreamers
# necesita que TODO le llegue por acá, nada le llega nativo nunca.
COMMAND_TYPES = "open_door,set_group,disable_user,enable_user"

DOOR_PULSE_DECISECONDS = int(os.environ.get("SPORTMAPS_BRIDGE_PULSE_DECISECONDS", "2"))
DEVICE_BY_SERIAL = {d["serial_number"]: d for d in DEVICES}

# Un Lock por dispositivo fisico -- ver docstring del modulo, seccion del
# cambio 2026-09-25, para el porque.
DEVICE_LOCKS = {d["serial_number"]: threading.Lock() for d in DEVICES}

# Cada cuanto se manda un heartbeat por la conexion WS.
HEARTBEAT_INTERVAL_SECONDS = int(os.environ.get("SPORTMAPS_BRIDGE_HEARTBEAT_INTERVAL_SECONDS", "60"))

# Hora fija (Colombia) de reconexion diaria forzada -- mismo motivo que
# GYM RM (ver scripts/gymrm-door-bridge/door_bridge.py).
COLOMBIA_TZ = ZoneInfo("America/Bogota")
RECONNECT_HOUR_COLOMBIA = int(os.environ.get("SPORTMAPS_BRIDGE_WS_RECONNECT_HOUR", "3"))

RECONNECT_BACKOFF_SECONDS = int(os.environ.get("SPORTMAPS_BRIDGE_WS_RECONNECT_BACKOFF_SECONDS", "5"))
REQUEST_TIMEOUT = 10
DEVICE_CONNECT_TIMEOUT = 10

# Limite de seguridad: si aparecen mas eventos "nuevos" de golpe que esto,
# es sospechoso (reloj corrido, vaciado masivo, o -- lo que paso en
# produccion el 2026-09-25 -- una tarea programada rota que dejo acumular
# dias de asistencia real). Se loguea fuerte y NO se envian (a proposito,
# ver docstring), pero el cursor SI avanza -- de lo contrario queda
# trabado repitiendo el mismo aviso para siempre, que es justo lo que paso.
MAX_EVENTS_PER_CYCLE = int(os.environ.get("SPORTMAPS_BRIDGE_MAX_EVENTS_PER_CYCLE", "20"))


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"{ts} {msg}", flush=True)


def seconds_until_next_reconnect():
    now = datetime.now(COLOMBIA_TZ)
    target = now.replace(hour=RECONNECT_HOUR_COLOMBIA, minute=0, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return (target - now).total_seconds()


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
        log(f"[{serial_number}] POST -> status {resp.status_code} | body: {resp.text[:200]}")
        return resp.status_code == 200
    except requests.RequestException as e:
        log(f"[{serial_number}] ERROR enviando al backend: {e}")
        return False


def send_heartbeat(serial_number):
    """Avisa al backend que el dispositivo esta vivo (getrequest = heartbeat/poll)."""
    url = f"{BACKEND_BASE_URL}/iclock/getrequest"
    try:
        resp = requests.get(url, params={"SN": serial_number}, timeout=10)
        log(f"[{serial_number}] heartbeat -> {resp.status_code}")
    except requests.RequestException as e:
        log(f"[{serial_number}] ERROR en heartbeat: {e}")


# ------------------------------------------------------------------
# Ack -- HTTP normal, no cambia con el WS (ver door_bridge.py, mismo patron)
# ------------------------------------------------------------------

def ack_door_command(command_id, success, error_message=None):
    url = f"{BACKEND_BASE_URL}/bridge/door-commands/{command_id}/ack"
    headers = {"X-Bridge-Api-Key": BRIDGE_API_KEY}
    payload = {"success": success, "school_id": SCHOOL_ID}
    if error_message:
        payload["error_message"] = error_message[:500]
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            log(f"ADVERTENCIA: ack de comando {command_id} respondio {resp.status_code}: {resp.text[:200]}")
    except requests.RequestException as e:
        log(f"ERROR de red confirmando comando {command_id}: {e}")


# ------------------------------------------------------------------
# Ejecucion fisica de comandos via SDK local
# ------------------------------------------------------------------

def open_door_physically(device):
    with DEVICE_LOCKS[device["serial_number"]]:
        zk = ZK(device["ip"], port=device["port"], timeout=DEVICE_CONNECT_TIMEOUT)
        conn = None
        try:
            conn = zk.connect()
            command_string = pack("I", DOOR_PULSE_DECISECONDS)
            resp = conn._ZK__send_command(const.CMD_UNLOCK, command_string)
            if not resp.get('status'):
                raise Exception(f"CMD_UNLOCK rechazado por el dispositivo: {resp}")
            log(f"[{device['name']}] Puerta abierta fisicamente (pulso de {DOOR_PULSE_DECISECONDS/10}s).")
        finally:
            if conn:
                try:
                    conn.disconnect()
                except Exception:
                    pass


def set_group_physically(device, pin, group):
    with DEVICE_LOCKS[device["serial_number"]]:
        zk = ZK(device["ip"], port=device["port"], timeout=DEVICE_CONNECT_TIMEOUT)
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
            log(f"[{device['name']}] PIN {pin} movido a grupo {group}.")
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
    with DEVICE_LOCKS[device["serial_number"]]:
        zk = ZK(device["ip"], port=device["port"], timeout=DEVICE_CONNECT_TIMEOUT)
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
            log(f"[{device['name']}] PIN {pin} {'habilitado' if enabled else 'deshabilitado'}.")
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


def process_command(cmd):
    """cmd esperado: {"id": uuid, "device_serial": str, "command_type": str, "metadata": {...}}"""
    cmd_id = cmd.get("id")
    serial = cmd.get("device_serial")
    command_type = cmd.get("command_type", "open_door")
    device = DEVICE_BY_SERIAL.get(serial)

    if not device:
        log(f"ERROR: comando {cmd_id} referencia serial desconocido '{serial}'.")
        ack_door_command(cmd_id, success=False, error_message=f"Serial no reconocido: {serial}")
        return

    log(f"Procesando comando {cmd_id} ({command_type}) -> {device['name']} ({serial})")
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
        log(f"ERROR ejecutando comando {cmd_id} ({command_type}) fisicamente: {error_msg}")
        log(traceback.format_exc())
        ack_door_command(cmd_id, success=False, error_message=error_msg)


# ------------------------------------------------------------------
# Conexion WebSocket (comandos: puerta/bloqueo)
# ------------------------------------------------------------------

async def handle_connection():
    async with websockets.connect(WS_URL, ping_interval=20, ping_timeout=20, close_timeout=5) as ws:
        await ws.send(json.dumps({
            "type": "auth",
            "school_id": SCHOOL_ID,
            "api_key": BRIDGE_API_KEY,
            "command_types": COMMAND_TYPES,
        }))
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
                log(f"Hora de reconexion diaria ({RECONNECT_HOUR_COLOMBIA}:00 Colombia) -- reconectando...")
                return

            since_heartbeat = time.monotonic() - last_heartbeat
            wait_for = max(1, HEARTBEAT_INTERVAL_SECONDS - since_heartbeat)

            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=wait_for)
            except asyncio.TimeoutError:
                await ws.send(json.dumps({"type": "heartbeat"}))
                last_heartbeat = time.monotonic()
                continue

            try:
                msg = json.loads(raw)
            except ValueError:
                continue

            msg_type = msg.get("type")
            if msg_type == "wake":
                await ws.send(json.dumps({"type": "poll"}))
            elif msg_type == "commands":
                commands = msg.get("commands") or []
                if commands:
                    log(f"{len(commands)} comando(s) recibido(s) por WebSocket.")
                for cmd in commands:
                    # Sincronico a proposito (pyzk no es async-nativo), igual
                    # que door_bridge.py -- bloquea el event loop el tiempo
                    # que tarda la conexion SDK, tipicamente <1s salvo
                    # set_group/enable_user (leen+escriben usuarios, un poco
                    # mas). Aceptable: son esporadicos.
                    process_command(cmd)


async def main_ws():
    log("=== Cliente WebSocket de comandos - Dreamers Gymnastics ===")
    log(f"WS: {WS_URL}")
    log(f"Heartbeat: cada {HEARTBEAT_INTERVAL_SECONDS}s | Reconexion forzada: diaria a las "
        f"{RECONNECT_HOUR_COLOMBIA}:00 hora Colombia")

    if BRIDGE_API_KEY == "CAMBIAR_ESTA_LLAVE":
        log("ADVERTENCIA CRITICA: SPORTMAPS_BRIDGE_API_KEY no esta configurada. "
            "La apertura manual y el bloqueo por mora van a fallar con 401.")

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


def run_ws_client():
    asyncio.run(main_ws())


# ------------------------------------------------------------------
# Loop de asistencia (hilo principal)
# ------------------------------------------------------------------

def poll_device(device, state):
    name = device["name"]
    serial_number = device["serial_number"]

    last_sent_key = f"last_sent_{serial_number}"
    last_sent_iso = state.get(last_sent_key)

    first_run = last_sent_iso is None
    if first_run:
        now_iso = datetime.now().isoformat()
        state[last_sent_key] = now_iso
        save_state(state)
        log(f"[{name}] primera ejecucion: se omite historial previo. "
            f"Desde ahora ({now_iso}) se capturaran eventos nuevos.")
        send_heartbeat(serial_number)
        return

    last_sent_dt = datetime.fromisoformat(last_sent_iso)

    with DEVICE_LOCKS[serial_number]:
        zk = ZK(device["ip"], port=device["port"], timeout=DEVICE_CONNECT_TIMEOUT)
        conn = None
        try:
            conn = zk.connect()
            conn.disable_device()

            send_heartbeat(serial_number)

            attendances = conn.get_attendance()
            if not attendances:
                log(f"[{name}] sin registros en el equipo.")
                return

            new_records = [a for a in attendances if a.timestamp > last_sent_dt]

            if len(new_records) > MAX_EVENTS_PER_CYCLE:
                newest = max(new_records, key=lambda a: a.timestamp).timestamp
                log(f"[{name}] ALERTA: se detectaron {len(new_records)} eventos nuevos de golpe "
                    f"(> {MAX_EVENTS_PER_CYCLE}). NO se envian (revisa el reloj del dispositivo o si "
                    f"hubo una caida larga) -- se SALTAN y el cursor avanza hasta {newest} para no "
                    f"quedar trabado repitiendo esto en cada ciclo. Si esto no era basura y se queria "
                    f"recuperar, usar diagnostico_backlog_asistencia.py ANTES del proximo reinicio.")
                state[last_sent_key] = newest.isoformat()
                save_state(state)
                return

            if not new_records:
                log(f"[{name}] no hay eventos nuevos desde {last_sent_dt}.")
                return

            new_records.sort(key=lambda a: a.timestamp)
            lines = [build_attlog_line(a.user_id, a.timestamp, a.status, a.punch) for a in new_records]

            ok = push_attlog(serial_number, lines)
            if ok:
                newest = new_records[-1].timestamp
                state[last_sent_key] = newest.isoformat()
                save_state(state)
                log(f"[{name}] {len(new_records)} evento(s) enviado(s). Ultimo: {newest}")
            else:
                log(f"[{name}] fallo el envio, se reintentara en el proximo ciclo.")

        except Exception as e:
            log(f"[{name}] ERROR conectando al dispositivo: {e}")
        finally:
            if conn:
                try:
                    conn.enable_device()
                    conn.disconnect()
                except Exception:
                    pass


def main():
    log("=== Puente ZKTeco -> SportMaps (Dreamers Gymnastics) ===")
    log(f"Backend: {BACKEND_BASE_URL}")
    log(f"School ID: {SCHOOL_ID}")
    log(f"Intervalo de sondeo de asistencia: {POLL_INTERVAL_SECONDS}s")
    log("Presiona Ctrl+C para detener.\n")

    if BRIDGE_API_KEY == "CAMBIAR_ESTA_LLAVE":
        log("ADVERTENCIA CRITICA: SPORTMAPS_BRIDGE_API_KEY no esta configurada. "
            "La asistencia va a seguir funcionando, pero la apertura manual y "
            "el bloqueo por mora van a fallar con 401. Ver README.md.")

    ws_thread = threading.Thread(target=run_ws_client, daemon=True, name="ws-commands")
    ws_thread.start()

    state = load_state()
    while True:
        for device in DEVICES:
            poll_device(device, state)
        log(f"--- Ciclo de asistencia completo, esperando {POLL_INTERVAL_SECONDS}s ---\n")
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("\nDetenido por el usuario.")
        sys.exit(0)
