"""
Prueba GUIADA de bloqueo de UN solo usuario en UN solo lector -- Dreamers Gymnastics
====================================================================================

Para qué sirve: comprobar, con una persona de prueba delante del lector, que el bit de
«deshabilitado» (privilegio impar) de verdad llega al MB360 y que el lector RECHAZA a esa
persona. Hasta el 2026-10-23 el bridge no lo lograba (pyzk 0.9 recortaba el privilegio a 0
o 14; ver `pyzk_allow_privilege` en dreamers_bridge.py). Esta prueba usa el mismo parche.

Qué hace, en orden, y SOLO sobre el PIN y el lector que usted elija:
  1. Lee el usuario y muestra su estado actual.
  2. Se NEGARÁ si es administrador del equipo (privilegio 2, 6, 14...) o ya está deshabilitado.
  3. Le pide escribir SI para continuar.
  4. Lo DESHABILITA (privilegio | 1), lo vuelve a leer y verifica que el lector lo guardó.
  5. Le pide que la persona de prueba marque en ESE lector: debe ser RECHAZADA.
  6. Al pulsar Enter (o si algo falla, o con Ctrl+C) lo HABILITA otra vez y lo verifica.
Nada más se toca: ni otros usuarios, ni grupos, ni claves, ni huellas, ni el otro lector.
Deja un registro en prueba_bloqueo_<serie>_<fecha>.log en esta carpeta.

REQUISITOS: el bridge debe estar DETENIDO mientras corre esto (compite por la conexión):

    Stop-ScheduledTask -TaskName "SportMaps-DreamersBridge"
    python probar_bloqueo_un_pin.py
    Start-ScheduledTask -TaskName "SportMaps-DreamersBridge"

Úselo SOLO con una persona de prueba (nunca con una niña real en horario de clase) y con
alguien parado frente al lector. Mientras dure la prueba esa persona no podrá entrar por
ese lector; al terminar queda habilitada.
"""

import contextlib
import os
import sys
import threading
from datetime import datetime

from zk import ZK, const

DEVICES = {
    "1": {"name": "LECTOR ENTRADA", "ip": "192.168.1.201", "port": 4370},
    "2": {"name": "LECTOR SALIDA",  "ip": "192.168.1.202", "port": 4370},
}
CONNECT_TIMEOUT = 15

# pyzk 0.9 (zk/base.py:867) recorta `privilege` a USER_DEFAULT (0) o USER_ADMIN (14).
# Se iguala USER_DEFAULT al privilegio pedido SOLO durante la llamada (mismo parche que
# dreamers_bridge.py).
_PATCH_LOCK = threading.Lock()


@contextlib.contextmanager
def pyzk_allow_privilege(privilege):
    with _PATCH_LOCK:
        original = const.USER_DEFAULT
        const.USER_DEFAULT = int(privilege)
        try:
            yield
        finally:
            const.USER_DEFAULT = original


LOG_PATH = None


def log(msg):
    linea = f"{datetime.now().strftime('%H:%M:%S')} {msg}"
    print(linea, flush=True)
    if LOG_PATH:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(linea + "\n")


def leer_usuario(conn, pin):
    return next((u for u in conn.get_users() if str(u.user_id) == str(pin)), None)


def escribir_privilegio(conn, u, privilegio):
    with pyzk_allow_privilege(privilegio):
        conn.set_user(
            uid=u.uid, name=u.name, privilege=privilegio, password=u.password,
            group_id=u.group_id, user_id=u.user_id, card=u.card,
        )


def huella_de_datos(u):
    """Lo que NO debe cambiar al deshabilitar/habilitar (se compara; la clave no se imprime)."""
    return (str(u.name), str(u.password or ""), int(u.card or 0), str(u.group_id))


def comparar_datos(antes, u_despues, momento):
    if u_despues is None:
        log(f"!!! {momento}: el usuario ya no aparece en el lector !!!")
        return False
    ahora = huella_de_datos(u_despues)
    nombres = ("nombre", "clave", "tarjeta", "grupo")
    cambiados = [n for n, a, b in zip(nombres, antes, ahora) if a != b]
    if cambiados:
        log(f"!!! {momento}: CAMBIARON estos datos del usuario: {', '.join(cambiados)} "
            f"(la clave y demás no se muestran). Avise a soporte con este registro. !!!")
        return False
    log(f"{momento}: nombre, clave, tarjeta y grupo intactos.")
    return True


def describir(privilegio):
    return "DESHABILITADO" if privilegio & 1 else "habilitado"


def main():
    global LOG_PATH
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    print(__doc__.split("REQUISITOS")[0])
    print("Lectores:  1 = ENTRADA (192.168.1.201)   2 = SALIDA (192.168.1.202)")
    eleccion = input("¿En cuál lector hace la prueba? [1/2]: ").strip()
    device = DEVICES.get(eleccion)
    if not device:
        print("Opción no válida. No se hizo nada.")
        return 1
    pin = input("PIN de la persona de PRUEBA (el número, p. ej. 615): ").strip()
    if not pin.isdigit():
        print("El PIN debe ser un número. No se hizo nada.")
        return 1

    zk = ZK(device["ip"], port=device["port"], timeout=CONNECT_TIMEOUT)
    conn = None
    deshabilitado_por_mi = False
    original = None
    u = None
    try:
        conn = zk.connect()
        serie = str(conn.get_serialnumber()).strip() or "SIN_SERIE"
        LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                f"prueba_bloqueo_{serie}_{datetime.now().strftime('%Y%m%d-%H%M%S')}.log")
        log(f"Conectado a {device['name']} (serie {serie}, IP {device['ip']}).")

        u = leer_usuario(conn, pin)
        if u is None:
            log(f"El PIN {pin} NO existe en este lector. No se hizo nada.")
            return 1
        original = u.privilege
        datos_originales = huella_de_datos(u)
        log(f"PIN {u.user_id} | uid={u.uid} | nombre='{u.name}' | privilegio={u.privilege} ({describir(u.privilege)}).")

        if (u.privilege & 0xFE) != 0:
            log("ESTE USUARIO ES ADMINISTRADOR DEL EQUIPO. Por seguridad NO se deshabilita. No se hizo nada.")
            return 1
        if u.privilege & 1:
            log("Este usuario YA está deshabilitado. No se hizo nada (revise por qué antes de seguir).")
            return 1

        resp = input(f"\nSe va a DESHABILITAR a '{u.name}' (PIN {u.user_id}) en {device['name']} "
                     f"durante la prueba. Escriba SI para continuar: ").strip()
        if resp.strip().lower() not in ("si", "sí", "s"):
            log("Cancelado por el usuario. No se hizo nada.")
            return 1

        escribir_privilegio(conn, u, u.privilege | 1)
        despues = leer_usuario(conn, pin)
        log(f"Relectura tras deshabilitar: privilegio={despues.privilege if despues else None}.")
        if despues is None or not (despues.privilege & 1):
            log("FALLÓ: el lector NO conservó el cambio (el privilegio no quedó impar). "
                "Nadie quedó bloqueado. Avise a soporte con este registro.")
            return 2
        deshabilitado_por_mi = True
        log("OK: el lector guardó el cambio. El usuario figura DESHABILITADO.")
        comparar_datos(datos_originales, despues, "Tras deshabilitar")

        print("\n" + "=" * 70)
        print(f" AHORA: dos marcaciones de '{u.name}' en el {device['name']}, UNA POR UNA:")
        print("   1) SOLO con la HUELLA (sin escribir el código).")
        print("   2) SOLO escribiendo el CÓDIGO (PIN) en el teclado, sin poner la huella.")
        print(" Lo ESPERADO en las dos: el lector la RECHAZA (no abre / no la reconoce).")
        print(" Anote qué pasó en cada una. Después vuelva aquí.")
        print("=" * 70)
        print("Respuestas: r = la rechazó | a = la dejó pasar | n = no se probó")
        huella = input("1) ¿Qué pasó con la HUELLA sola? [r/a/n]: ").strip().lower()
        log(f"Marcación SOLO con huella, usuario deshabilitado: '{huella}'.")
        codigo = input("2) ¿Qué pasó escribiendo solo el CÓDIGO (PIN)? [r/a/n]: ").strip().lower()
        log(f"Marcación SOLO con código (PIN), usuario deshabilitado: '{codigo}'.")
        log(f"RESUMEN: huella={huella} | código={codigo} (r = rechazada, a = pasó igual, n = no se probó).")
        return 0
    except KeyboardInterrupt:
        log("Interrumpido (Ctrl+C): se va a volver a habilitar al usuario.")
        return 3
    except Exception as e:
        log(f"ERROR: {type(e).__name__}: {e}")
        return 4
    finally:
        if conn and deshabilitado_por_mi and u is not None:
            try:
                actual = leer_usuario(conn, pin) or u
                escribir_privilegio(conn, actual, original & 0xFE)
                verif = leer_usuario(conn, pin)
                if verif is not None and not (verif.privilege & 1):
                    log(f"HABILITADO de nuevo y verificado (privilegio={verif.privilege}).")
                    comparar_datos(datos_originales, verif, "Tras habilitar")
                else:
                    log("!!! NO SE PUDO VOLVER A HABILITAR. EL USUARIO PODRÍA SEGUIR DESHABILITADO !!!")
                    log(f"    Habilítelo a mano en el equipo: Menú > Usuarios > buscar PIN {pin} > "
                        f"quitar «deshabilitado», o vuelva a correr este script y avise a soporte.")
            except Exception as e:
                log(f"!!! ERROR al volver a habilitar: {type(e).__name__}: {e}. "
                    f"REVISE EL PIN {pin} EN EL EQUIPO !!!")
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass
        if LOG_PATH:
            print(f"\nRegistro guardado en: {LOG_PATH}")


if __name__ == "__main__":
    sys.exit(main())
