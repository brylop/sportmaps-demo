"""
Prueba de pulso corto - evita el bug de truncado de zk.ZK.unlock()
====================================================================

zk.ZK.unlock(time) hace `pack("I", int(time)*10)` -- trunca `time` a
entero ANTES de multiplicar por 10, asi que nunca puede mandar menos de
1 segundo completo aunque el protocolo real trabaje en decimas de
segundo. Esto llama al mismo comando (CMD_UNLOCK) pero construyendo el
valor en decimas directo, sin pasar por ese truncado.

Uso:
    py test_pulse.py <ip> <decimas_de_segundo>

Ejemplos:
    py test_pulse.py 192.168.1.203 2    # 0.2 segundos (punto de partida, igual a GYM RM)
    py test_pulse.py 192.168.1.203 5    # 0.5 segundos
    py test_pulse.py 192.168.1.203 10   # 1.0 segundos (deberia ser igual a unlock(1))

Probar de menor a mayor (2, 3, 5, 7...) hasta encontrar el minimo que
deja pasar a una persona sin que el torniquete se rearme para una segunda.
Este torniquete todavia no se calibro -- no asumir que 2 (el valor que
funciono en GYM RM) sirve igual aca, es otro modelo de torniquete.
"""

import sys
from struct import pack

from zk import ZK, const

if len(sys.argv) != 3:
    print("Uso: py test_pulse.py <ip> <decimas_de_segundo>")
    sys.exit(1)

ip = sys.argv[1]
deciseconds = int(sys.argv[2])

print(f"Conectando a {ip}...")
zk = ZK(ip, port=4370, timeout=8)
conn = zk.connect()
try:
    print(f"Mandando CMD_UNLOCK con {deciseconds} decimas de segundo ({deciseconds/10}s)...")
    command_string = pack("I", deciseconds)
    # __send_command es "privado" (doble guion bajo) -> Python lo renombra a
    # _ZK__send_command internamente. Es el mismo metodo que unlock() llama
    # por dentro, solo que sin el truncado.
    resp = conn._ZK__send_command(const.CMD_UNLOCK, command_string)
    print(f"Respuesta del dispositivo: {resp}")
    if resp.get('status'):
        print("OK -- comando aceptado. Confirma en el torniquete si abrio y cuantas veces dejo pasar.")
    else:
        print("RECHAZADO por el dispositivo.")
finally:
    conn.disconnect()
