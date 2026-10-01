"""
Enrolamiento de huellas - Dreamers Gymnastics
==================================================================

Que hace:
    Para cada (PIN, nombre) de la lista de abajo, y para CADA lector
    (ENTRADA y SALIDA tienen su propia base de huellas -- hay que enrolar
    en los dos, uno no sirve para el otro), crea/actualiza el usuario con
    ese nombre y pone al equipo en modo de enrolamiento -- en ese momento
    el script espera a que la persona ponga el dedo en el sensor FISICO
    del lector, 3 veces. Esto NO se puede automatizar mas alla de esto: la
    huella real solo la puede dar la persona, en el equipo, en el momento.

IMPORTANTE -- correr esto con el bridge principal DETENIDO:
    dreamers_bridge.py mantiene conexiones abiertas casi todo el tiempo
    (live_capture). Si este script corre al mismo tiempo, dos conexiones
    simultaneas al mismo lector pueden colgarlo. Antes de correr esto:

        Stop-ScheduledTask -TaskName "SportMaps-DreamersBridge"

    Y cuando termines de enrolar a todos:

        Start-ScheduledTask -TaskName "SportMaps-DreamersBridge"

Uso:
    python enroll_users.py
"""

from zk import ZK

DEVICES = [
    {"name": "LECTOR ENTRADA", "ip": "192.168.1.201", "port": 4370, "serial_number": "CEZU222860004"},
    {"name": "LECTOR SALIDA", "ip": "192.168.1.202", "port": 4370, "serial_number": "CEZU214960067"},
]

# Editar esta lista para agregar/quitar gente antes de correr el script.
ATLETAS = [
    {"pin": "605", "name": "Mariapaz Bolivar"},
    {"pin": "78", "name": "Silvana Moreno"},
    {"pin": "598", "name": "Hanny"},
]


def ensure_user(conn, pin, name):
    """Crea o actualiza el usuario con ese PIN y nombre, sin tocar huellas."""
    existing = next((u for u in conn.get_users() if str(u.user_id) == str(pin)), None)
    uid = existing.uid if existing else int(pin)
    conn.set_user(
        uid=uid,
        name=name,
        privilege=existing.privilege if existing else 0,
        password=existing.password if existing else '',
        group_id=existing.group_id if existing else '',
        user_id=str(pin),
        card=existing.card if existing else 0,
    )
    return uid


def enroll_on_device(device, pin, name):
    print(f"\n--- {device['name']} ({device['ip']}) -- PIN {pin} ({name}) ---")
    zk = ZK(device["ip"], port=device["port"], timeout=10)
    conn = None
    try:
        conn = zk.connect()
        uid = ensure_user(conn, pin, name)
        print(f"Usuario listo (uid interno {uid}). PONGA EL DEDO EN {device['name']} AHORA -- "
              f"3 veces, esperando hasta 60s por cada intento...")
        ok = conn.enroll_user(uid=uid, user_id=str(pin))
        if ok:
            print(f"OK: huella enrolada en {device['name']} para {name} (PIN {pin}).")
        else:
            print(f"FALLO: no se completo el enrolamiento en {device['name']} para {name} (PIN {pin}). "
                  f"Puede ser que no se puso el dedo a tiempo, o la huella ya existe repetida en otro "
                  f"PIN (el equipo rechaza duplicados). Se puede reintentar corriendo el script de nuevo.")
    except Exception as e:
        print(f"ERROR conectando a {device['name']}: {e}")
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass


def main():
    print("=== Enrolamiento de huellas -- Dreamers Gymnastics ===")
    print(f"{len(ATLETAS)} atleta(s) x {len(DEVICES)} lector(es) = {len(ATLETAS) * len(DEVICES)} "
          f"enrolamientos en total.\n")
    input("Confirma que el bridge principal esta DETENIDO (Stop-ScheduledTask) y presiona Enter para empezar...")

    for atleta in ATLETAS:
        for device in DEVICES:
            enroll_on_device(device, atleta["pin"], atleta["name"])
            input("Presiona Enter para continuar con el siguiente...")

    print("\n=== Enrolamiento terminado. No olvides volver a iniciar la tarea programada: ===")
    print('Start-ScheduledTask -TaskName "SportMaps-DreamersBridge"')


if __name__ == "__main__":
    main()
