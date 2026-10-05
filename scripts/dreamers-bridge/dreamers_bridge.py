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
- Captura asistencia EN VIVO (live_capture, ver mas abajo) y la reenvia al
  backend (bffdev.sportmaps.co) usando el mismo protocolo ADMS/PUSH que el
  dispositivo usaria si su conexion cloud funcionara, asi que el backend la
  procesa exactamente igual que si viniera del equipo directamente.
- Lleva un registro local (bridge_state.json) de que fue lo ultimo enviado,
  para no duplicar eventos.

CAMBIO 2026-09-25 -- de polling completo a live_capture (tiempo real):
    Hasta ahora la captura de asistencia llamaba conn.get_attendance() cada
    POLL_INTERVAL_SECONDS -- ese metodo trae la tabla de asistencia COMPLETA
    del equipo cada vez (no hay forma de pedirle al SDK "solo lo nuevo"), y
    se filtraba el resto aca. Confirmado en campo el 2026-09-25: con ~48.000
    registros acumulados en el equipo, UN solo ciclo tardaba ~47 segundos --
    cada vez mas lento a medida que el equipo acumula mas historial, y con
    eso "cada 5 segundos" no era real en absoluto (mas cerca de 1-2 minutos
    de latencia real punta a punta).

    Ahora cada dispositivo tiene su propio hilo corriendo conn.live_capture():
    una conexion que el equipo mantiene abierta y por la que empuja cada
    marcacion AL MOMENTO en que pasa, sin tener que traer ni comparar nada
    del historial. Late en el orden de segundos, no minutos, y no se pone
    mas lento con el tiempo.

    live_capture() NO reemplaza del todo a get_attendance(): sigue habiendo
    un barrido de respaldo (catchup_sweep) cada CATCHUP_INTERVAL_SECONDS
    (30 minutos por defecto) que hace lo que antes hacia el polling, pero
    mucho menos seguido -- por si el hilo de live_capture se cae, se
    reconecta, o el equipo se reinicia y pierde la sesion en el medio; ese
    barrido es la red de seguridad que garantiza que nada se pierda de
    verdad, aunque tarde un poco mas en aparecer.

    COORDINACION entre hilos (importante, ver DEVICE_LOCKS mas abajo): el
    equipo solo atiende una conexion SDK a la vez. Con live_capture ocupando
    la conexion la mayor parte del tiempo, cualquier otra operacion (abrir
    puerta, bloquear por mora, o el barrido de respaldo) necesita que
    live_capture se haga a un lado un momento. Se resuelve con
    PAUSE_REQUESTED/LIVE_CAPTURE_PAUSED (threading.Event por dispositivo):
    quien necesita el equipo pide la pausa, live_capture la nota en su
    proximo timeout corto (LIVE_CAPTURE_TICK_SECONDS) y se desconecta, y
    recien ahi el que la pidio toma el Lock real y opera. El Lock
    (DEVICE_LOCKS) es la garantia de fondo -- si algo falla en la
    coordinacion por Event, el Lock igual impide que dos conexiones
    convivan al mismo tiempo, solo que con mas espera.

CAMBIO 2026-09-25 -- de HTTP polling a WebSocket para el canal de comandos:
    Hasta ahora este script volvia a preguntar por HTTP cada pocos segundos
    si habia comandos de puerta/bloqueo pendientes -- trafico constante
    contra Render las 24h, la mayor parte del tiempo sin nada que hacer.
    Mismo cambio que se hizo para GYM RM el 2026-09-21 (ver
    scripts/gymrm-door-bridge/door_bridge.py para el razonamiento completo).

    Ahora abre UNA conexion WebSocket y la mantiene viva: el backend empuja
    un aviso ({"type":"wake"}) por esa misma conexion apenas se crea un
    comando nuevo. Se refresca sola una vez al dia a una hora fija de
    Colombia (RECONNECT_HOUR_COLOMBIA, 3am por defecto).

    Si el backend todavia no tiene desplegado el endpoint WS (/bridge/ws),
    la conexion falla al conectar o al autenticar -- el script lo reporta y
    reintenta con backoff. No hay fallback automatico al HTTP polling viejo.

    BUG DE PRODUCCION encontrado el 2026-09-25 (independiente del cambio de
    arriba, pero corregido en el mismo commit): si se detectan mas de
    MAX_EVENTS_PER_CYCLE eventos nuevos de golpe (barrido de respaldo, o el
    live_capture inicial si habia backlog), el codigo anterior cortaba SIN
    avanzar el cursor de "ultimo enviado" -- asi que volvia a ver los mismos
    eventos "nuevos" en el siguiente ciclo, para siempre, sin mandar ninguno
    y sin salir solo de ese estado. Le paso exactamente eso a LECTOR
    ENTRADA: goteo de asistencia real durante 3 dias sin que nada lo
    reportara como caido, porque bridge_heartbeats (que solo depende del
    sondeo de comandos, un canal aparte) seguia viendose sano. Ahora, si
    pasa esto, se loguea fuerte pero el cursor SI avanza -- se saltan esos
    eventos (a proposito, no se reenvian) en vez de quedar trabado.

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
import contextlib
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

# Coordinacion de acceso al equipo entre live_capture (hilo propio por
# dispositivo) y cualquier otra operacion SDK (comandos por WS, barrido de
# respaldo) -- ver docstring del modulo, seccion "COORDINACION". El Lock es
# la garantia real; los Event son solo para que live_capture se haga a un
# lado rapido en vez de que el que pide el equipo tenga que esperar a que
# expire un timeout largo.
DEVICE_LOCKS = {d["serial_number"]: threading.Lock() for d in DEVICES}
PAUSE_REQUESTED = {d["serial_number"]: threading.Event() for d in DEVICES}
LIVE_CAPTURE_PAUSED = {d["serial_number"]: threading.Event() for d in DEVICES}

# Protege lecturas/escrituras de bridge_state.json -- ahora hay hasta 3
# hilos (2x live_capture + el barrido de respaldo) que pueden querer tocar
# el mismo diccionario/archivo.
STATE_LOCK = threading.Lock()

# Cada cuanto live_capture() revisa internamente si le pidieron la pausa
# (ver PAUSE_REQUESTED) -- entre mas chico, mas rapido cede el equipo a un
# comando, pero mas overhead de reconexion. 2s es un buen equilibrio para
# que "abrir puerta" siga sintiendose instantaneo.
LIVE_CAPTURE_TICK_SECONDS = int(os.environ.get("SPORTMAPS_BRIDGE_LIVE_CAPTURE_TICK_SECONDS", "2"))

# Cuanto espera, como maximo, una operacion que necesita el equipo a que
# live_capture note la pausa y se desconecte -- si se pasa igual intenta
# tomar el Lock (que va a bloquear hasta que live_capture realmente libere
# la conexion), solo que sin el aviso anticipado.
PAUSE_WAIT_TIMEOUT_SECONDS = 5

# Barrido de respaldo con get_attendance() (trae la tabla completa) -- red
# de seguridad para lo que live_capture se pueda perder (caida del hilo,
# reinicio del equipo a mitad de una sesion, etc). No hace falta que sea
# frecuente: si live_capture funciona bien, este barrido normalmente no
# encuentra nada nuevo que reportar.
#
# 30 min y no 5: durante el barrido el lector queda DESHABILITADO
# (disable_device) mientras lee ~48.000 registros -- ~47 s en el de entrada,
# tiempo en el que NO acepta huellas. A 5 min eso era ~16% del dia con el
# torniquete sin responder; a 30 min baja a ~2.6%.
CATCHUP_INTERVAL_SECONDS = int(os.environ.get("SPORTMAPS_BRIDGE_CATCHUP_INTERVAL_SECONDS", "1800"))

# Primer barrido tras arrancar el proceso: recupera lo que pasó mientras estuvo
# apagado (reinicio, tarea caida) sin esperar la primera vuelta completa.
CATCHUP_FIRST_DELAY_SECONDS = int(os.environ.get("SPORTMAPS_BRIDGE_CATCHUP_FIRST_DELAY_SECONDS", "60"))

# El barrido reenvia tambien los eventos de esta ventana ANTERIOR al cursor.
# Motivo: mientras el barrido (o un comando) tiene pausado live_capture, una
# marcacion puede caer en el hueco; si despues llega una marcacion en vivo mas
# nueva, el cursor salta por encima de la perdida y `timestamp > cursor` la
# descartaria para siempre. Reenviar duplicados es seguro: el backend los
# ignora (indice unico device_id+zk_user_id+occurred_at) y NO repite sus
# efectos (banco de horas, notificaciones, asistencia).
CATCHUP_LOOKBACK_MINUTES = int(os.environ.get("SPORTMAPS_BRIDGE_CATCHUP_LOOKBACK_MINUTES", "10"))

# Cada cuanto cada lector reporta "sigo capturando en vivo" al backend
# (GET /iclock/getrequest -> turnstile_devices.last_seen_at).
DEVICE_HEARTBEAT_INTERVAL_SECONDS = int(os.environ.get("SPORTMAPS_BRIDGE_DEVICE_HEARTBEAT_INTERVAL_SECONDS", "60"))

# Cada cuanto se manda un heartbeat por la conexion WS.
HEARTBEAT_INTERVAL_SECONDS = int(os.environ.get("SPORTMAPS_BRIDGE_HEARTBEAT_INTERVAL_SECONDS", "60"))

# Hora fija (Colombia) de reconexion diaria forzada -- mismo motivo que
# GYM RM (ver scripts/gymrm-door-bridge/door_bridge.py).
COLOMBIA_TZ = ZoneInfo("America/Bogota")
RECONNECT_HOUR_COLOMBIA = int(os.environ.get("SPORTMAPS_BRIDGE_WS_RECONNECT_HOUR", "3"))

RECONNECT_BACKOFF_SECONDS = int(os.environ.get("SPORTMAPS_BRIDGE_WS_RECONNECT_BACKOFF_SECONDS", "5"))
LIVE_CAPTURE_RECONNECT_BACKOFF_SECONDS = int(os.environ.get("SPORTMAPS_BRIDGE_LIVE_CAPTURE_BACKOFF_SECONDS", "5"))
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


@contextlib.contextmanager
def device_access(serial_number):
    """
    Usar SIEMPRE antes de abrir una conexion SDK que no sea la de
    live_capture (comandos, barrido de respaldo) -- avisa a live_capture
    que se haga a un lado, espera un poco a que lo note, y toma el Lock
    real (que bloquea de todas formas si el aviso no alcanzo a tiempo).
    """
    PAUSE_REQUESTED[serial_number].set()
    try:
        LIVE_CAPTURE_PAUSED[serial_number].wait(timeout=PAUSE_WAIT_TIMEOUT_SECONDS)
        with DEVICE_LOCKS[serial_number]:
            yield
    finally:
        PAUSE_REQUESTED[serial_number].clear()


# ------------------------------------------------------------------
# Estado local (para no reenviar los mismos eventos)
# ------------------------------------------------------------------

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_state_locked(state):
    """Caller ya tiene STATE_LOCK tomado."""
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def ensure_initial_state(state):
    """
    Se llama una sola vez al arrancar, antes de lanzar ningun hilo -- si un
    dispositivo nunca corrio el bridge, marca "ahora" como punto de partida
    en vez de arrastrar anios de historial de fabrica/pruebas.
    """
    with STATE_LOCK:
        changed = False
        for device in DEVICES:
            key = f"last_sent_{device['serial_number']}"
            if key not in state:
                now_iso = datetime.now().isoformat()
                state[key] = now_iso
                changed = True
                log(f"[{device['name']}] primera ejecucion: se omite historial previo. "
                    f"Desde ahora ({now_iso}) se capturaran eventos nuevos.")
        if changed:
            save_state_locked(state)


def advance_cursor(state, serial_number, new_timestamp):
    """Solo avanza el cursor hacia adelante -- nunca lo retrocede por las dudas."""
    key = f"last_sent_{serial_number}"
    with STATE_LOCK:
        current = state.get(key)
        new_iso = new_timestamp.isoformat()
        if current is None or new_iso > current:
            state[key] = new_iso
            save_state_locked(state)


def get_cursor(state, serial_number):
    with STATE_LOCK:
        iso = state.get(f"last_sent_{serial_number}")
    return datetime.fromisoformat(iso) if iso else None


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
    with device_access(device["serial_number"]):
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
    with device_access(device["serial_number"]):
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
    with device_access(device["serial_number"]):
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
# Captura de asistencia EN VIVO (un hilo por dispositivo)
# ------------------------------------------------------------------

def handle_live_event(device, state, att):
    """att: objeto Attendance de pyzk (user_id, timestamp, status, punch)."""
    cursor = get_cursor(state, device["serial_number"])
    if cursor is not None and att.timestamp <= cursor:
        # Ya lo teniamos (p.ej. el barrido de respaldo lo mando primero, o
        # el equipo repitio el evento al reconectar) -- no duplicar.
        return

    line = build_attlog_line(att.user_id, att.timestamp, att.status, att.punch)
    ok = push_attlog(device["serial_number"], [line])
    if ok:
        advance_cursor(state, device["serial_number"], att.timestamp)
        log(f"[{device['name']}] evento en vivo enviado: PIN {att.user_id} @ {att.timestamp}")
    else:
        log(f"[{device['name']}] fallo el envio del evento en vivo (PIN {att.user_id} @ {att.timestamp}) "
            f"-- el barrido de respaldo lo va a recoger en el peor caso.")


def live_capture_loop(device, state):
    serial = device["serial_number"]
    name = device["name"]

    while True:
        if PAUSE_REQUESTED[serial].is_set():
            LIVE_CAPTURE_PAUSED[serial].set()
            time.sleep(0.2)
            continue
        LIVE_CAPTURE_PAUSED[serial].clear()

        with DEVICE_LOCKS[serial]:
            zk = ZK(device["ip"], port=device["port"], timeout=DEVICE_CONNECT_TIMEOUT)
            conn = None
            try:
                conn = zk.connect()
                # NO disable_device() acá -- live_capture necesita que el
                # equipo siga aceptando huellas normalmente, es lo que
                # estamos escuchando.
                log(f"[{name}] escuchando asistencia en vivo...")
                last_heartbeat = float("-inf")
                for att in conn.live_capture(new_timeout=LIVE_CAPTURE_TICK_SECONDS):
                    # El heartbeat sale SOLO mientras esta conexion de captura
                    # esta viva -- asi turnstile_devices.last_seen_at significa
                    # "capturando en vivo", no "el proceso existe". Sin esto,
                    # last_seen_at solo se movia cuando alguien marcaba y el
                    # lector figuraba sin conexion en horas tranquilas.
                    now = time.monotonic()
                    if now - last_heartbeat >= DEVICE_HEARTBEAT_INTERVAL_SECONDS:
                        send_heartbeat(serial)
                        last_heartbeat = now
                    if PAUSE_REQUESTED[serial].is_set():
                        log(f"[{name}] cediendo el equipo (comando o barrido pendiente)...")
                        break
                    if att is None:
                        continue  # solo el timeout del tick, sin evento real
                    handle_live_event(device, state, att)
            except Exception as e:
                log(f"[{name}] ERROR en captura en vivo: {type(e).__name__}: {e} -- reconectando en "
                    f"{LIVE_CAPTURE_RECONNECT_BACKOFF_SECONDS}s.")
            finally:
                if conn:
                    try:
                        conn.disconnect()
                    except Exception:
                        pass

        if not PAUSE_REQUESTED[serial].is_set():
            time.sleep(LIVE_CAPTURE_RECONNECT_BACKOFF_SECONDS)


# ------------------------------------------------------------------
# Barrido de respaldo (red de seguridad, baja frecuencia)
# ------------------------------------------------------------------

def catchup_sweep(device, state):
    name = device["name"]
    serial_number = device["serial_number"]

    last_sent_dt = get_cursor(state, serial_number)
    if last_sent_dt is None:
        return  # ensure_initial_state() ya debería haber puesto un cursor

    with device_access(serial_number):
        zk = ZK(device["ip"], port=device["port"], timeout=DEVICE_CONNECT_TIMEOUT)
        conn = None
        try:
            conn = zk.connect()
            conn.disable_device()

            attendances = conn.get_attendance()
            if not attendances:
                return

            window_start = last_sent_dt - timedelta(minutes=CATCHUP_LOOKBACK_MINUTES)
            candidates = [a for a in attendances if a.timestamp > window_start]
            if not candidates:
                return
            # Solo los POSTERIORES al cursor cuentan como "nuevos" de verdad (y
            # para el limite de seguridad); los de la ventana son reenvios.
            new_records = [a for a in candidates if a.timestamp > last_sent_dt]

            if len(new_records) > MAX_EVENTS_PER_CYCLE:
                newest = max(new_records, key=lambda a: a.timestamp).timestamp
                log(f"[{name}] ALERTA (barrido de respaldo): se detectaron {len(new_records)} eventos "
                    f"nuevos de golpe (> {MAX_EVENTS_PER_CYCLE}). NO se envian (revisa el reloj del "
                    f"dispositivo o si hubo una caida larga) -- se SALTAN y el cursor avanza hasta "
                    f"{newest} para no quedar trabado repitiendo esto en cada barrido. Si esto no era "
                    f"basura y se queria recuperar, usar diagnostico_backlog_asistencia.py ANTES del "
                    f"proximo reinicio.")
                advance_cursor(state, serial_number, newest)
                return

            candidates.sort(key=lambda a: a.timestamp)
            lines = [build_attlog_line(a.user_id, a.timestamp, a.status, a.punch) for a in candidates]

            ok = push_attlog(serial_number, lines)
            if ok:
                if new_records:
                    newest = candidates[-1].timestamp
                    advance_cursor(state, serial_number, newest)
                    log(f"[{name}] barrido de respaldo: {len(new_records)} evento(s) NUEVOS que live_capture no "
                        f"habia mandado (revisar por que). Ultimo: {newest}")
                else:
                    log(f"[{name}] barrido de respaldo: nada nuevo (se re-verificaron {len(candidates)} "
                        f"evento(s) de los ultimos {CATCHUP_LOOKBACK_MINUTES} min; el backend ignora duplicados).")
            else:
                log(f"[{name}] barrido de respaldo: fallo el envio, se reintenta en el proximo barrido.")

        except Exception as e:
            log(f"[{name}] ERROR en barrido de respaldo: {e}")
        finally:
            if conn:
                try:
                    conn.enable_device()
                    conn.disconnect()
                except Exception:
                    pass


def catchup_sweep_loop(state):
    time.sleep(CATCHUP_FIRST_DELAY_SECONDS)
    while True:
        for device in DEVICES:
            catchup_sweep(device, state)
        time.sleep(CATCHUP_INTERVAL_SECONDS)


def main():
    log("=== Puente ZKTeco -> SportMaps (Dreamers Gymnastics) ===")
    log(f"Backend: {BACKEND_BASE_URL}")
    log(f"School ID: {SCHOOL_ID}")
    log(f"Captura de asistencia: en vivo (live_capture) + barrido de respaldo cada "
        f"{CATCHUP_INTERVAL_SECONDS}s")
    log("Presiona Ctrl+C para detener.\n")

    if BRIDGE_API_KEY == "CAMBIAR_ESTA_LLAVE":
        log("ADVERTENCIA CRITICA: SPORTMAPS_BRIDGE_API_KEY no esta configurada. "
            "La asistencia va a seguir funcionando, pero la apertura manual y "
            "el bloqueo por mora van a fallar con 401. Ver README.md.")

    state = load_state()
    ensure_initial_state(state)

    ws_thread = threading.Thread(target=run_ws_client, daemon=True, name="ws-commands")
    ws_thread.start()

    for device in DEVICES:
        t = threading.Thread(
            target=live_capture_loop, args=(device, state), daemon=True,
            name=f"live-capture-{device['serial_number']}",
        )
        t.start()

    # El barrido de respaldo corre en el hilo principal -- si este proceso
    # muere, la tarea programada lo reinicia entero (ver
    # install_scheduled_task.ps1), asi que no hace falta que sea un hilo
    # aparte con su propia supervision.
    catchup_sweep_loop(state)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("\nDetenido por el usuario.")
        sys.exit(0)
