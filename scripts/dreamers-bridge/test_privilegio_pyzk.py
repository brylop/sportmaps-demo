"""
Prueba SIN lector del parche de privilegio del bridge (disable_user / enable_user).

Reproduce el bug de pyzk 0.9 (set_user recorta `privilege` a 0 o 14, asi que el bit 0
«deshabilitado» nunca llegaba al MB360) y comprueba que con `pyzk_allow_privilege` el
valor llega intacto, que `set_enabled_physically` relee y es idempotente, y que no
deshabilita a un administrador del equipo. Usa el pyzk REAL instalado (pip install pyzk)
pero un lector simulado: no abre ninguna conexion de red.

Uso:  python test_privilegio_pyzk.py
"""
import os, sys, struct
from unittest.mock import MagicMock
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
for m in ("websockets", "websockets.exceptions", "requests"):
    sys.modules.setdefault(m, MagicMock())
import zoneinfo
try:
    zoneinfo.ZoneInfo("America/Bogota")
except Exception:  # Windows sin tzdata: solo para esta prueba
    import datetime as _dt
    zoneinfo.ZoneInfo = lambda k: _dt.timezone(_dt.timedelta(hours=-5))
import dreamers_bridge as b
from zk import ZK, const

sent = []
def fake_send(cmd, data, size=0):
    sent.append(data)
    return {"status": True}

def make():
    z = ZK("1.2.3.4")
    z.user_packet_size = 72
    z.encoding = "UTF-8"
    z.next_uid = 100
    z.next_user_id = "100"
    z._ZK__send_command = fake_send
    z.refresh_data = lambda: None
    return z

def priv_byte(packet):
    return struct.unpack_from("HB", packet, 0)[1]

# 1) SIN parche: pyzk recorta 1 -> 0 (el bug)
z = make(); sent.clear()
z.set_user(uid=5, name="x", privilege=1, password="", group_id="0", user_id="401", card=0)
print("sin parche, privilege=1 enviado como:", priv_byte(sent[-1]))
assert priv_byte(sent[-1]) == 0

# 2) CON parche: llega 1 y USER_DEFAULT se restaura
z = make(); sent.clear()
with b.pyzk_allow_privilege(1):
    z.set_user(uid=5, name="x", privilege=1, password="", group_id="0", user_id="401", card=0)
print("con parche, privilege=1 enviado como:", priv_byte(sent[-1]), "| USER_DEFAULT restaurado =", const.USER_DEFAULT)
assert priv_byte(sent[-1]) == 1 and const.USER_DEFAULT == 0

# 3) CON parche, admin deshabilitado (15) y habilitar (0)
for want in (15, 0, 14):
    sent.clear()
    with b.pyzk_allow_privilege(want):
        z.set_user(uid=5, name="x", privilege=want, password="", group_id="0", user_id="401", card=0)
    assert priv_byte(sent[-1]) == want, (want, priv_byte(sent[-1]))
print("privilegios 15, 0 y 14 pasan intactos")
assert const.USER_DEFAULT == 0

# 4) set_enabled_physically contra un lector simulado: deshabilita, relee, guarda
class U:  # usuario simulado
    def __init__(s, **k): s.__dict__.update(k)
store = {"401": U(uid=5, user_id="401", name="Emma", privilege=0, password="", group_id="0", card=0),
         "1": U(uid=1, user_id="1", name="Admin", privilege=14, password="", group_id="0", card=0)}
class FakeConn:
    def disable_device(s): pass
    def enable_device(s): pass
    def disconnect(s): pass
    def get_users(s): return list(store.values())
    def set_user(s, uid, name, privilege, password, group_id, user_id, card):
        # imita pyzk: aplica el recorte con el valor ACTUAL de USER_DEFAULT
        if privilege not in [const.USER_DEFAULT, const.USER_ADMIN]:
            privilege = const.USER_DEFAULT
        store[str(user_id)].privilege = privilege
class FakeZK:
    def __init__(s, *a, **k): pass
    def connect(s): return FakeConn()
b.ZK = FakeZK
dev = b.DEVICES[0]
b.set_enabled_physically(dev, 401, enabled=False)
assert store["401"].privilege == 1, store["401"].privilege
b.set_enabled_physically(dev, 401, enabled=False)   # idempotente: no escribe, no falla
b.set_enabled_physically(dev, 401, enabled=True)
assert store["401"].privilege == 0
try:
    b.set_enabled_physically(dev, 1, enabled=False)
    raise SystemExit("ERROR: dejo deshabilitar a un administrador")
except Exception as e:
    assert "administrador" in str(e), e
    print("administrador protegido:", e)
assert store["1"].privilege == 14
print("OK: disable/enable con relectura, idempotencia y proteccion de administradores")
