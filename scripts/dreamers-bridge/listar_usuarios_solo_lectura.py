"""
Listado DE SOLO LECTURA de TODOS los usuarios de los dos MB360 -- Dreamers Gymnastics
======================================================================================

Para qué sirve: la base de SportMaps NO sabe qué hay dentro del lector. Los
`device_commands` en estado «executed» solo dicen que el bridge no dio error
(antes del 2026-10-06 no releía el usuario; ver `set_enabled_physically`). La única
forma de saber quién está realmente deshabilitado es leer el lector.

Qué hace: se conecta a cada lector y llama SOLO a funciones de lectura: `get_users()`,
`get_serialnumber()`, `get_device_name()`, `get_network_params()`, `get_mac()`,
`get_firmware_version()` y `get_time()`. NO escribe nada en el lector (ni `set_time`),
NO llama a `disable_device()` (eso congela el lector mientras corre), NO cambia
privilegios, grupos ni claves.

Identificación: NO se fía de la IP que uno cree que tiene cada equipo (hay tres IP
distintas en tres fuentes). Cada lector se identifica por su NÚMERO DE SERIE leído del
propio equipo; la IP que se imprime es la que el equipo dice tener, y el CSV se nombra
por serie. Si el serie no es uno de los conocidos, o la IP leída no coincide con la
configurada, lo avisa.

Qué imprime y guarda, por usuario: uid, PIN, nombre, privilegio, nivel, estado,
grupo, tarjeta. El campo de privilegio es un bitfield: el bit 0 encendido
(privilegio impar: 1, 3, 15...) significa DESHABILITADO; 0 = usuario normal,
14 = super administrador. Al final lista aparte:
  - los DESHABILITADOS (privilegio impar),
  - los PIN de interés (los del bloqueo del 6-oct y los mapeados hoy en SportMaps).
También deja un CSV por lector en la carpeta de este script.

Uso (PowerShell, en la PC de Dreamers). El bridge compite por la conexión al lector:
párelo mientras corre esto y vuelva a arrancarlo.

    Stop-ScheduledTask -TaskName "SportMaps-DreamersBridge"
    python listar_usuarios_solo_lectura.py
    Start-ScheduledTask -TaskName "SportMaps-DreamersBridge"

Antes de correrlo, confirme la IP de cada MB360 en el propio equipo
(Menú > Comunicación > Ethernet) y edite DEVICES si no coinciden.
"""

import csv
import os
import sys
from datetime import datetime

from zk import ZK

DEVICES = [
    {"name": "LECTOR ENTRADA", "ip": "192.168.1.201", "port": 4370},
    {"name": "LECTOR SALIDA",  "ip": "192.168.1.202", "port": 4370},
]

# Series conocidas (las de turnstile_devices y dreamers_bridge.py). Sirve para decir qué
# equipo es cada uno sin depender de la IP.
SERIES_CONOCIDAS = {
    "CEZU222860004": "LECTOR ENTRADA",
    "CEZU214960067": "LECTOR SALIDA",
}

# PIN de interés. Del bloqueo del 6-oct-2026 (PIN 1, 2, 4, 12, 401) y los mapeados hoy
# en SportMaps (1 Fabio, 78 Silvana, 385 Carolina, 401 Emma, 602 Zoe, 615 Airi).
PINS_DE_INTERES = {"1", "2", "4", "12", "401", "78", "385", "602", "615"}

CONNECT_TIMEOUT = 15

NIVELES = {0: "Usuario normal", 2: "Enrolador", 6: "Administrador", 14: "Super administrador"}


def describir(privilegio):
    deshabilitado = bool(privilegio & 1)
    nivel = privilegio & 0xFE
    return deshabilitado, NIVELES.get(nivel, f"Desconocido ({nivel})")


def _leer(fn, defecto=""):
    try:
        v = fn()
        return v if v is not None else defecto
    except Exception as e:  # un dato que el firmware no da no debe tumbar el listado
        return f"(no disponible: {type(e).__name__})"


def leer_lector(device):
    zk = ZK(device["ip"], port=device["port"], timeout=CONNECT_TIMEOUT)
    conn = None
    try:
        conn = zk.connect()
        # Solo lectura: NO disable_device(), NO set_user(), NO set_time(), NO clear_*().
        red = _leer(conn.get_network_params, {})
        info = {
            "serie": str(_leer(conn.get_serialnumber)).strip(),
            "modelo": str(_leer(conn.get_device_name)).strip(),
            "ip_leida": red.get("ip", "") if isinstance(red, dict) else str(red),
            "mascara": red.get("mask", "") if isinstance(red, dict) else "",
            "puerta_enlace": red.get("gateway", "") if isinstance(red, dict) else "",
            "mac": str(_leer(conn.get_mac)).strip(),
            "firmware": str(_leer(conn.get_firmware_version)).strip(),
            "hora_del_equipo": str(_leer(conn.get_time)),
        }
        return info, conn.get_users()
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass


def fila(u):
    deshabilitado, nivel = describir(u.privilege)
    return {
        "uid": u.uid,
        "pin": str(u.user_id),
        "nombre": u.name,
        "privilegio": u.privilege,
        "nivel": nivel,
        "estado": "DESHABILITADO" if deshabilitado else "habilitado",
        "grupo": str(u.group_id),
        "tarjeta": u.card,
        "tiene_clave": bool(u.password),
    }


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # tildes en consolas cp1252
    except Exception:
        pass
    sello = datetime.now().strftime("%Y%m%d-%H%M%S")
    carpeta = os.path.dirname(os.path.abspath(__file__))
    resumen = {}

    for device in DEVICES:
        print(f"\n=== {device['name']} ({device['ip']}) ===")
        try:
            info, users = leer_lector(device)
        except Exception as e:
            print(f"ERROR leyendo {device['name']}: {type(e).__name__}: {e}")
            resumen[device["name"]] = None
            continue

        serie = info["serie"] or "SIN_SERIE"
        quien = SERIES_CONOCIDAS.get(serie)
        print(f"Serie: {serie}  |  modelo: {info['modelo']}  |  firmware: {info['firmware']}")
        print(f"IP que dice tener el equipo: {info['ip_leida']}  (máscara {info['mascara']}, "
              f"puerta {info['puerta_enlace']})  |  MAC: {info['mac']}")
        print(f"Hora del equipo: {info['hora_del_equipo']}  |  hora de esta PC: "
              f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        if quien is None:
            print(f"  AVISO: la serie {serie} NO es una de las conocidas "
                  f"({', '.join(SERIES_CONOCIDAS)}). Revise qué equipo es este.")
        else:
            print(f"  Por serie, este equipo es: {quien}")
        if info["ip_leida"] and info["ip_leida"] != device["ip"]:
            print(f"  AVISO: se conectó a {device['ip']} pero el equipo dice tener {info['ip_leida']}.")

        filas = sorted((fila(u) for u in users), key=lambda r: (r["pin"].zfill(8)))
        print(f"Usuarios en el equipo: {len(filas)}")
        print(f"{'uid':>5} {'PIN':>6}  {'privilegio':>10}  {'estado':<13} {'nivel':<20} grupo  nombre")
        for r in filas:
            marca = " <--" if r["pin"] in PINS_DE_INTERES else ""
            print(f"{r['uid']:>5} {r['pin']:>6}  {r['privilegio']:>10}  {r['estado']:<13} {r['nivel']:<20} {r['grupo']:<5}  {r['nombre']}{marca}")

        deshabilitados = [r for r in filas if r["estado"] == "DESHABILITADO"]
        print(f"\nDESHABILITADOS en {device['name']}: {len(deshabilitados)}")
        for r in deshabilitados:
            print(f"  PIN {r['pin']} (uid {r['uid']}) '{r['nombre']}' privilegio={r['privilegio']}")

        interes = [r for r in filas if r["pin"] in PINS_DE_INTERES]
        print(f"PIN de interés presentes en {device['name']}: {len(interes)} de {len(PINS_DE_INTERES)}")
        faltan = sorted(PINS_DE_INTERES - {r["pin"] for r in interes}, key=lambda p: int(p))
        if faltan:
            print(f"  No están en este lector: {', '.join(faltan)}")

        # Por SERIE, no por IP ni por el nombre que aquí se les puso.
        ruta = os.path.join(carpeta, f"usuarios_{serie}_{sello}.csv")
        with open(ruta, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(filas[0].keys()) if filas else ["uid"])
            w.writeheader()
            w.writerows(filas)
        print(f"CSV guardado en: {ruta}")
        resumen[f"{device['name']} ({serie}, IP {info['ip_leida'] or device['ip']})"] = (len(filas), len(deshabilitados))

    print("\n=== Resumen ===")
    for nombre, r in resumen.items():
        print(f"{nombre}: " + ("NO SE PUDO LEER" if r is None else f"{r[0]} usuarios, {r[1]} deshabilitados"))
    print("\n=== Fin (no se escribió nada en los lectores) ===")
    return 0 if all(r is not None for r in resumen.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
