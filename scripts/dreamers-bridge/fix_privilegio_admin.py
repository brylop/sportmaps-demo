"""
Fix puntual y URGENTE -- restaura el privilegio Admin de los PIN 1 y 2
(Fabio y Edna)
========================================================================

Que hace: en cada lector, lee el registro actual de cada PIN en PINS_TO_FIX,
sube su nivel de privilegio a 14 (Super Admin) preservando todo lo demas
(nombre, contraseña, tarjeta, grupo, y si esta habilitado o no -- que hoy ya
esta habilitado). No toca ningun otro usuario del equipo.

Antes de correr esto, la tarea programada del bridge debe estar detenida
(ya lo esta, si vienes de correr el diagnostico):

    Stop-ScheduledTask -TaskName "SportMaps-DreamersBridge"
    python fix_privilegio_admin.py
    Start-ScheduledTask -TaskName "SportMaps-DreamersBridge"
"""

from zk import ZK

DEVICES = [
    {"name": "LECTOR ENTRADA", "ip": "192.168.1.201", "port": 4370},
    {"name": "LECTOR SALIDA",  "ip": "192.168.1.202", "port": 4370},
]

PINS_TO_FIX = ["1", "2"]
NEW_LEVEL = 14  # Super Admin


def fix_device(device):
    print(f"\n=== {device['name']} ({device['ip']}) ===")
    zk = ZK(device["ip"], port=device["port"], timeout=10)
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        users_by_pin = {str(u.user_id): u for u in conn.get_users()}

        for pin in PINS_TO_FIX:
            existing = users_by_pin.get(pin)
            if existing is None:
                print(f"ERROR: PIN {pin} no encontrado en este lector -- no se toco.")
                continue

            disabled_bit = existing.privilege & 1
            new_privilege = NEW_LEVEL | disabled_bit

            print(f"PIN {pin} ({existing.name}) -- antes: privilege={existing.privilege}")
            conn.set_user(
                uid=existing.uid,
                name=existing.name,
                privilege=new_privilege,
                password=existing.password,
                group_id=existing.group_id,
                user_id=existing.user_id,
                card=existing.card,
            )
            print(f"PIN {pin} ({existing.name}) -- despues: privilege={new_privilege} "
                  f"(nivel Super Admin, {'deshabilitado' if disabled_bit else 'habilitado'})")
    except Exception as e:
        print(f"ERROR en {device['name']}: {type(e).__name__}: {e}")
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


def main():
    for device in DEVICES:
        fix_device(device)
    print("\n=== Listo. Confirma en el equipo si Edna ya puede entrar al modo admin. ===")


if __name__ == "__main__":
    main()
