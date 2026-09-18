"""
Diagnostico de solo lectura: backlog de asistencia sin enviar (Dreamers).
NO escribe nada -- ni al backend, ni a bridge_state.json, ni al equipo.

Por que existe (2026-09-15): la tarea programada de dreamers_bridge.py
estuvo rota ~9 dias (apuntaba a una carpeta que ya no existia). Al
arreglarla y volver a correr, el bridge detecto ~550 eventos "nuevos" de
golpe (por encima de MAX_EVENTS_PER_CYCLE=20) y se nego a enviarlos, a
proposito -- ese limite existe para frenar justo este escenario (evita
mandar de golpe algo que podria ser un reloj corrido o un vaciado masivo).
Antes de subir ese limite y dejar que dreamers_bridge.py procese todo de
una, este script muestra que hay realmente ahi: fechas, cantidad de PINs
distintos afectados, y un resumen por dia -- para confirmar que es
asistencia real de estos 9 dias (no basura) y estimar el impacto en banco
de horas antes de decidir como procesarlo.

Usa la MISMA marca de "ultimo enviado" que dreamers_bridge.py (bridge_state.json
en esta misma carpeta), asi que los "pendientes" que reporta acá son
exactamente los mismos que el bridge real esta viendo y rechazando.

Uso:
    python diagnostico_backlog_asistencia.py
"""

import json
import os
from collections import defaultdict
from datetime import datetime

from zk import ZK

DEVICES = [
    {"name": "LECTOR ENTRADA", "ip": "192.168.1.201", "port": 4370, "serial_number": "CEZU222860004"},
    {"name": "LECTOR SALIDA", "ip": "192.168.1.202", "port": 4370, "serial_number": "CEZU214960067"},
]

STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bridge_state.json")


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def main():
    state = load_state()
    print("=== Diagnostico de backlog de asistencia (SOLO LECTURA, no envia ni escribe nada) ===\n")

    for device in DEVICES:
        name = device["name"]
        serial = device["serial_number"]
        last_sent_key = f"last_sent_{serial}"
        last_sent_iso = state.get(last_sent_key)

        print(f"--- {name} ({serial}) ---")
        if not last_sent_iso:
            print("  No hay marca de 'ultimo enviado' en bridge_state.json -- no puedo filtrar 'nuevos'.\n")
            continue

        last_sent_dt = datetime.fromisoformat(last_sent_iso)
        print(f"  Ultimo enviado (marca local del bridge): {last_sent_dt}")

        zk = ZK(device["ip"], port=device["port"], timeout=10)
        conn = None
        try:
            conn = zk.connect()
            conn.disable_device()
            attendances = conn.get_attendance()
        finally:
            if conn:
                try:
                    conn.enable_device()
                    conn.disconnect()
                except Exception:
                    pass

        if not attendances:
            print("  El equipo no devolvio registros de asistencia.\n")
            continue

        pending = [a for a in attendances if a.timestamp > last_sent_dt]
        print(f"  Total en el equipo: {len(attendances)} | Pendientes (nuevos, sin enviar): {len(pending)}")

        if not pending:
            print()
            continue

        pending.sort(key=lambda a: a.timestamp)
        print(f"  Rango de fechas pendientes: {pending[0].timestamp}  ->  {pending[-1].timestamp}")

        by_day = defaultdict(int)
        by_pin = defaultdict(int)
        for a in pending:
            by_day[a.timestamp.date().isoformat()] += 1
            by_pin[a.user_id] += 1

        print(f"  PINs (alumnos) distintos afectados: {len(by_pin)}")
        print("  Eventos pendientes por dia:")
        for day in sorted(by_day):
            print(f"    {day}: {by_day[day]} evento(s)")

        print("  Top 10 PINs con mas eventos pendientes:")
        top = sorted(by_pin.items(), key=lambda kv: -kv[1])[:10]
        for pin, count in top:
            print(f"    PIN {pin}: {count} evento(s)")

        print()

    print("=== Fin del diagnostico (no se envio ni se escribio nada) ===")


if __name__ == "__main__":
    main()
