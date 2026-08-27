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
from datetime import datetime

import requests
from zk import ZK

# ------------------------------------------------------------------
# CONFIGURACION - ajusta aqui si algo cambia
# ------------------------------------------------------------------

BACKEND_BASE_URL = "https://bffdev.sportmaps.co"

DEVICES = [
    {
        "name": "LECTOR ENTRADA",
        "ip": "192.168.1.203",
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
    print(f"Intervalo de sondeo: {POLL_INTERVAL_SECONDS}s")
    print("Presiona Ctrl+C para detener.\n")

    state = load_state()

    while True:
        for device in DEVICES:
            poll_device(device, state)
        print(f"--- Ciclo completo, esperando {POLL_INTERVAL_SECONDS}s ---\n")
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nDetenido por el usuario.")
