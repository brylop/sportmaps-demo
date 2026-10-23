"""
Listado DE SOLO LECTURA de TODOS los usuarios de los dos MB360 -- Dreamers Gymnastics
======================================================================================

Para qué sirve: la base de SportMaps NO sabe qué hay dentro del lector. Los
`device_commands` en estado «executed» solo dicen que el bridge no dio error
(antes del 2026-10-06 no releía el usuario; ver `set_enabled_physically`). La única
forma de saber quién está realmente deshabilitado es leer el lector.

Qué hace: se conecta a cada lector, llama SOLO a `get_users()` y se desconecta.
NO escribe nada en el lector, NO llama a `disable_device()` (eso congela el lector
mientras corre), NO cambia privilegios, grupos ni claves.

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

# PIN de interés. Del bloqueo del 6-oct-2026 (PIN 1, 2, 4, 12, 401) y los mapeados hoy
# en SportMaps (1 Fabio, 78 Silvana, 385 Carolina, 401 Emma, 602 Zoe, 615 Airi).
PINS_DE_INTERES = {"1", "2", "4", "12", "401", "78", "385", "602", "615"}

CONNECT_TIMEOUT = 15

NIVELES = {0: "Usuario normal", 2: "Enrolador", 6: "Administrador", 14: "Super administrador"}


def describir(privilegio):
    deshabilitado = bool(privilegio & 1)
    nivel = privilegio & 0xFE
    return deshabilitado, NIVELES.get(nivel, f"Desconocido ({nivel})")


def leer_lector(device):
    zk = ZK(device["ip"], port=device["port"], timeout=CONNECT_TIMEOUT)
    conn = None
    try:
        conn = zk.connect()
        # Solo lectura: NO disable_device(), NO set_user(), NO clear_*().
        return conn.get_users()
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
    sello = datetime.now().strftime("%Y%m%d-%H%M%S")
    carpeta = os.path.dirname(os.path.abspath(__file__))
    resumen = {}

    for device in DEVICES:
        print(f"\n=== {device['name']} ({device['ip']}) ===")
        try:
            users = leer_lector(device)
        except Exception as e:
            print(f"ERROR leyendo {device['name']}: {type(e).__name__}: {e}")
            resumen[device["name"]] = None
            continue

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

        ruta = os.path.join(carpeta, f"usuarios_{device['name'].replace(' ', '_').lower()}_{sello}.csv")
        with open(ruta, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(filas[0].keys()) if filas else ["uid"])
            w.writeheader()
            w.writerows(filas)
        print(f"CSV guardado en: {ruta}")
        resumen[device["name"]] = (len(filas), len(deshabilitados))

    print("\n=== Resumen ===")
    for nombre, r in resumen.items():
        print(f"{nombre}: " + ("NO SE PUDO LEER" if r is None else f"{r[0]} usuarios, {r[1]} deshabilitados"))
    print("\n=== Fin (no se escribió nada en los lectores) ===")
    return 0 if all(r is not None for r in resumen.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
