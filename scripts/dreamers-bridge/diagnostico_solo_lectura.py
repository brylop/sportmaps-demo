"""
Diagnostico DE SOLO LECTURA -- Dreamers Gymnastics
====================================================

Este script NO escribe nada en los lectores. Solo se conecta, lee la
informacion actual de los usuarios PIN 1 y PIN 2 en cada equipo, la imprime
en pantalla, y se desconecta. Sirve para confirmar el estado real (privilege,
si esta habilitado, etc.) antes de intentar corregir nada mas, despues del
incidente de bloqueo del PIN 2 (Edna, que es tambien la administradora del
equipo).

Uso:
    python diagnostico_solo_lectura.py

Requiere que la tarea programada del bridge (SportMaps-DreamersBridge) este
DETENIDA mientras corre esto, para no competir por la conexion al lector:

    Stop-ScheduledTask -TaskName "SportMaps-DreamersBridge"
    python diagnostico_solo_lectura.py
    Start-ScheduledTask -TaskName "SportMaps-DreamersBridge"
"""

from zk import ZK

DEVICES = [
    {"name": "LECTOR ENTRADA", "ip": "192.168.1.201", "port": 4370},
    {"name": "LECTOR SALIDA",  "ip": "192.168.1.202", "port": 4370},
]

PINS_TO_CHECK = ["1", "2"]


def describe_privilege(privilege):
    disabled = bool(privilege & 1)
    level = privilege & 0xFE
    level_name = {0: "Usuario normal", 2: "Enrolador", 6: "Admin", 14: "Super Admin"}.get(level, f"Desconocido ({level})")
    return f"privilege={privilege} (nivel={level_name}, {'DESHABILITADO' if disabled else 'habilitado'})"


def main():
    for device in DEVICES:
        print(f"\n=== {device['name']} ({device['ip']}) ===")
        zk = ZK(device["ip"], port=device["port"], timeout=10)
        conn = None
        try:
            conn = zk.connect()
            users = conn.get_users()
            print(f"Total de usuarios en el equipo: {len(users)}")
            for u in users:
                if str(u.user_id) in PINS_TO_CHECK:
                    print(f"  PIN {u.user_id} | uid={u.uid} | nombre='{u.name}' | "
                          f"{describe_privilege(u.privilege)} | "
                          f"group_id='{u.group_id}' | card={u.card} | "
                          f"password_len={len(u.password) if u.password else 0}")
        except Exception as e:
            print(f"ERROR conectando a {device['name']}: {type(e).__name__}: {e}")
        finally:
            if conn:
                try:
                    conn.disconnect()
                except Exception:
                    pass

    print("\n=== Fin del diagnostico (no se escribio nada) ===")


if __name__ == "__main__":
    main()
