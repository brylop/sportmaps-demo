"""
Diagnostico de SOLO LECTURA: que tiene cada lector guardado para uno o varios PIN.

Sirve para saber si un `disable_user` realmente quedo escrito en el torniquete
(bit 0 de `privilege` en 1 = deshabilitado). No escribe nada ni deshabilita el
lector.

Uso (en la PC de Dreamers, con el entorno del bridge):

    python diagnostico_usuario.py 4            # un PIN
    python diagnostico_usuario.py 4 12 401     # varios

Si el bridge esta corriendo, el lector puede rechazar una segunda conexion
simultanea. En ese caso detener la tarea unos segundos:

    Stop-ScheduledTask  -TaskName "SportMaps-DreamersBridge"
    python diagnostico_usuario.py 4
    Start-ScheduledTask -TaskName "SportMaps-DreamersBridge"
"""
import sys

from zk import ZK

# Mismos lectores que dreamers_bridge.py (DEVICES).
DEVICES = [
    {"name": "LECTOR ENTRADA", "ip": "192.168.1.201", "port": 4370, "serial_number": "CEZU222860004"},
    {"name": "LECTOR SALIDA", "ip": "192.168.1.202", "port": 4370, "serial_number": "CEZU214960067"},
]


def main(pins):
    for device in DEVICES:
        print(f"\n=== {device['name']} ({device['serial_number']}, {device['ip']}) ===")
        zk = ZK(device["ip"], port=device["port"], timeout=10)
        conn = None
        try:
            conn = zk.connect()
            for label, getter in (
                ("firmware", "get_firmware_version"),
                ("plataforma", "get_platform"),
                ("nombre", "get_device_name"),
            ):
                try:
                    print(f"{label}: {getattr(conn, getter)()}")
                except Exception as e:  # algunos firmwares no responden a todo
                    print(f"{label}: (no disponible: {e})")

            users = conn.get_users()
            print(f"usuarios guardados en el lector: {len(users)}")
            for pin in pins:
                u = next((x for x in users if str(x.user_id) == str(pin)), None)
                if u is None:
                    print(f"  PIN {pin}: NO esta enrolado en este lector")
                    continue
                deshabilitado = bool(u.privilege & 1)
                print(
                    f"  PIN {pin}: uid={u.uid} nombre='{u.name}' privilege={u.privilege} "
                    f"(bit0 -> {'DESHABILITADO' if deshabilitado else 'habilitado'}) "
                    f"group_id='{u.group_id}' card={u.card}"
                )
        except Exception as e:
            print(f"  ERROR conectando/leyendo: {type(e).__name__}: {e}")
        finally:
            if conn:
                try:
                    conn.disconnect()
                except Exception:
                    pass


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1:])
