# Validación de esta carpeta contra el código real (2026-08-25)

Los archivos de este directorio llegaron redactados fuera del repo (en una
carpeta temporal del usuario) y sin haber cruzado el diseño contra
`bff/src/routes/access-adms.ts` / `access-api.ts` tal como existen hoy en
`develop`. Esto es lo que se verificó, con archivo:línea.

## Lo que está bien / confirmado

- `SCHOOL_ID` de `door_bridge.py` (`2137182d-a695-4695-8e5a-61151fc59196`)
  coincide exactamente con el de GYM RM en `docs/ACCESS_CONTROL_ZKTECO_HANDOFF.md`.
- El diagnóstico del bug de firmware es consistente con el código: `CONTROL
  DEVICE 000101FF05` (`access-adms.ts:823`) es justamente lo que
  `getrequest` envía hoy para `open_door`, y el comentario en esa misma
  línea ya documenta que reemplazó a `UNLOCK` por dar `-1002` siempre — o
  sea, el historial de intentos fallidos que describen `door_bridge.py` y
  `README.md` coincide con lo que hay en el repo.
- El patrón de API key de servicio (`X-Bridge-Api-Key` vs.
  `process.env.BRIDGE_API_KEY`) es consistente con cómo el proyecto ya
  protege canales sin sesión de usuario (`ACCESS_DEVICE_IP_ALLOWLIST` para
  `/iclock/*`).
- El punto de montaje sugerido (`app.use('/bridge', generalLimiter,
  bridgeRouter)` en `index.ts`) es correcto: `generalLimiter` es un
  `const` local de `bff/src/index.ts:106`, no un módulo exportado, así que
  el montaje tiene que vivir ahí — igual que las ~60 rutas ya montadas en
  ese archivo.
- No reutilizar `manual-open` ni tocarlo es correcto: sigue insertando
  `device_commands` igual (`access-api.ts:260-268`), y este bridge solo
  necesita agregar un consumidor nuevo, no cambiar el productor.

## Hallazgos que hay que resolver

### 1. Carrera con el canal ADMS existente — puede producir "éxito" falso

`GET /iclock/getrequest` (`access-adms.ts:781-836`) selecciona **todos**
los `device_commands` con `status='pending'` para el dispositivo,
incluidos los `open_door`, y arma `CONTROL DEVICE 000101FF05`
(`access-adms.ts:819-823`) sin filtrar por si ese dispositivo tiene un
bridge configurado. El F22 hace su propio poll de `getrequest` de forma
independiente al ritmo de sondeo de `door_bridge.py` (3 s).

`POST /iclock/devicecmd` (`access-adms.ts:868-891`) marca la fila
`executed` mirando **solo** el `Return` code del firmware
(`success = returnCode === 0`, línea 869) — que es `0` para `CONTROL
DEVICE` aunque el relé no se mueva, que es exactamente el bug documentado.

**Consecuencia concreta:** si el F22 pide `getrequest` antes de que
`door_bridge.py` reclame la fila por el endpoint nuevo, ADMS puede marcar
`open_door` como `executed` (falso positivo) sin que la puerta se haya
abierto, y sin que `/bridge/door-commands` encuentre ya nada `pending`
para reclamar. El botón del dashboard reportaría éxito y la puerta
seguiría cerrada — el mismo tipo de falla silenciosa contra el que
previene `CLAUDE.md` ("la fuente de verdad es la base, nunca el repo").

**Qué falta en el spec:** antes de desplegar `/bridge/door-commands`,
`getrequest` tiene que dejar de enviar `open_door` a dispositivos que
tienen un bridge propio (columna nueva en `turnstile_devices`, ej.
`has_local_bridge boolean`, o simplemente excluir `open_door` de la lista
de `command_type` que `getrequest` traduce, ya que en ningún dispositivo
conocido ese comando funciona físicamente).

### 2. El CHECK constraint que asume el spec no aparece en las migraciones

`BACKEND_ENDPOINT_SPEC.md` (versión original) afirmaba: *"el status de
`device_commands` hoy solo permite `pending|executed|failed|expired` (ver
CHECK constraint en la tabla)"*.

Migración de referencia:
`supabase/migrations/20260627000001_access_control_versioned_schema.sql:61-74`
crea la columna como:

```sql
status        text NOT NULL DEFAULT 'pending',
```

Sin ningún `CHECK`. Una búsqueda de `CHECK.*status` sobre las ~150
migraciones del repo no devuelve ninguna que mencione `device_commands`.
Es posible que exista un CHECK agregado a mano en el SQL editor de
Supabase (exactamente el patrón que `INF-7`/`docs/gotchas-tecnicos.md` ya
denuncia: lo que se corre ahí no queda en `schema_migrations`), así que
**no se puede descartar sin mirar la base viva**.

**Qué falta:** correr contra la base real, antes de escribir cualquier
migración:

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.device_commands'::regclass and contype = 'c';
```

Si no hay CHECK, no hace falta ningún `ALTER` para el valor `'claimed'`.
Si lo hay, se extiende con una migración nueva (`ALTER TABLE ... DROP
CONSTRAINT ... ADD CONSTRAINT ...`), nunca editando la de junio.

### 3. El bloqueo de usuarios — RESUELTO 2026-08-25/26: ya funciona por ADMS, se queda ahí

El pedido incluye que el botón de bloqueo también funcione de verdad, no
solo abrir la puerta. Ese botón ya existe:

- `frontend/src/pages/school/AccessControlPage.tsx:791` — "Bloquear
  ahora" llama `POST /api/v1/access/set-access-group`.
- `bff/src/routes/access-api.ts:664-689` — inserta `device_commands` con
  `command_type: 'set_group'`, `metadata: { pin, group }`.
- `access-adms.ts:833-835` — `getrequest` lo traduce a `DATA UPDATE
  USERINFO PIN=<pin> Grp=<group>`, un comando de **datos**, de la misma
  familia que `enroll_user`/`delete_user` (`access-adms.ts:805-817`), no
  `CONTROL DEVICE`.

**Prueba de campo confirmada por el usuario (2026-08-25/26): `Grp=2` sí
bloquea el acceso físico en los lectores de GYM RM.** Decisión: el
bloqueo **se queda en ADMS**, no se mueve al bridge local. Razones:

- El bridge de `pyzk` existe únicamente porque `CONTROL DEVICE` está roto
  en el firmware — no es un canal "mejor" en general, es el único que
  funciona para ese comando puntual. Para `set_group` no hay ningún
  defecto que resolver.
- Meter el bloqueo por el bridge agrega una dependencia nueva e
  innecesaria (la PC de Windows del gym, Python, la LAN) para lograr algo
  que ya funciona sin ella. Hoy, si esa PC se cae, el bloqueo sigue
  operando porque es el lector hablando directo con la nube; moverlo al
  bridge lo haría depender de que esa PC esté viva.
- **Reconciliación tras un reinicio del torniquete (la preocupación del
  usuario):** `GET /api/v1/access/overdue`
  (`access-api.ts:730-743`) ya reconstruye quién está bloqueado leyendo
  el **historial** de comandos `set_group` ejecutados en
  `device_commands` — es la fuente de verdad, no el estado local del
  dispositivo. Si el torniquete pierde sus grupos (reset, reemplazo), no
  hace falta reconfigurar a mano: se re-emite `set_group` para cada PIN
  que la base ya sabe bloqueado y ADMS lo entrega en el próximo
  `getrequest`. Falta, como mejora barata y no bloqueante, un botón o
  cron de "re-sincronizar bloqueos" que recorra esa lista después de un
  evento de reset — no existe todavía, pero el dato para hacerlo ya está.

### 4. Serial ↔ dirección — RESUELTO 2026-08-25: confirmado, sin cambios

`docs/ACCESS_CONTROL_ZKTECO_HANDOFF.md:115`:
> Lectores: `JJA1254900898` (entry), `JJA1254900899` (exit) — IP `181.63.24.103`

`door_bridge.py` (`DEVICES`, esta sesión):
```python
{"name": "LECTOR ENTRADA", "serial_number": "JJA1254900899", ...}
{"name": "LECTOR SALIDA",  "serial_number": "JJA1254900898", ...}
```

Esto aparecía invertido respecto al handoff de junio. El usuario confirmó
contra el formulario real "Editar dispositivo" del dashboard
(`turnstile_devices`, la fuente de verdad — no un doc de hace dos meses):

- `JJA1254900899` → Nombre "Lector Entrada GYM RM", Dirección "Entrada".
- `JJA1254900898` → Nombre "Lector Salida GYM RM", Dirección "Salida".

**Coincide con `door_bridge.py`, no con el handoff de junio.** El doc de
junio quedó desactualizado — no se corrige (es histórico), pero no hay
que tocar nada del script. Las IPs locales también se confirmaron
iguales a lo ya codificado (`192.168.1.6` entrada / `192.168.1.7`
salida). Punto cerrado, sin cambios de código.

**Nota aparte, no un hallazgo:** la "IP pública" que muestra ese mismo
formulario (`181.63.24.103`) es la del allowlist de ADMS — no tiene
relación con las IPs LAN (`192.168.1.x`) que usa `door_bridge.py` para
conectarse por SDK. Son dos campos de IP con propósitos distintos sobre
el mismo dispositivo; no confundirlos si se vuelve a tocar esto.

### 5. Los archivos vivían fuera del repo

`requirements.txt`, `door_bridge.py`, `run_supervised.ps1`,
`install_scheduled_task.ps1`, `README.md` y `BACKEND_ENDPOINT_SPEC.md`
estaban en `%TEMP%` del usuario — no versionados, no enlazables desde el
roadmap, y en riesgo de perderse en cualquier limpieza de temporales. Se
movieron a `scripts/gymrm-door-bridge/` en esta sesión.

### 6. Mejora agregada (no era un hallazgo del spec original): tiempo de apertura configurable desde el dashboard

`turnstile_devices.door_drive_time_seconds` ya existe, ya se edita desde
el mismo formulario "Editar dispositivo" (campo "Tiempo de apertura
(segundos)"), y ya se usa para `SET OPTIONS Door1Drivertime=<seg>` por
ADMS (`access-api.ts:551-561`). El spec original de este bridge traía un
`DOOR_OPEN_SECONDS = 5` fijo en `door_bridge.py`, completamente
desconectado de ese campo — cambiar el valor en el dashboard no habría
tenido ningún efecto sobre lo que hace el bridge.

Se corrigió: `GET /bridge/door-commands` ahora incluye
`door_drive_time_seconds` en la respuesta (join a `turnstile_devices`), y
`door_bridge.py` lo usa por comando, con `DOOR_OPEN_SECONDS_FALLBACK = 5`
solo como respaldo si el backend todavía no manda ese campo. Así, el
mismo formulario que ya existe controla de verdad cuánto tiempo abre la
puerta, sin tocar el script.

## Implementado 2026-08-26 — código listo, falta desplegar

Con los 5 hallazgos resueltos (serial/IP confirmados, bloqueo decidido en
ADMS), se implementaron los puntos 1 y 2:

- **Migración `supabase/migrations/20260825231925_gymrm_bridge_local_flag.sql`**
  — agrega `turnstile_devices.has_local_bridge` (marca los dos lectores de
  GYM RM por serial) y `device_commands.claimed_at` (columna nueva para el
  reclamo atómico, evita por completo la duda del hallazgo 2 sobre el CHECK
  de `status` — no hace falta averiguarlo, `claimed_at` no lo toca).
- **`bff/src/routes/access-adms.ts`** — `getrequest` ahora excluye
  `command_type = 'open_door'` para dispositivos con `has_local_bridge`,
  cerrando la carrera del hallazgo 1. `enroll_user`/`delete_user`/`set_group`/
  `reboot`/`set_drive_time` siguen exactamente igual, sin cambios.
- **`bff/src/routes/bridge.routes.ts`** (nuevo) — implementa
  `GET /bridge/door-commands` y `POST /bridge/door-commands/:id/ack` según
  el spec, con una corrección: el spec original embebía
  `turnstile_devices(serial_number)` en el `select` de Supabase, pero
  **no existe FK declarada** entre `device_commands.device_id` y
  `turnstile_devices` (columna suelta, sin `REFERENCES` en ninguna
  migración) — PostgREST no puede resolver ese embed. Se resuelve en dos
  queries (reclamo + lookup de dispositivos por `id`) y se mergea en JS.
  Autenticación por `X-Bridge-Api-Key` + `BRIDGE_API_KEY`, mismo patrón
  fail-closed que `internal-notifications.routes.ts`.
- **`bff/src/index.ts`** — monta `bridgeRouter` en `/bridge`, después del
  `express.json()` global, junto a `accessApiRouter`.
- `npx tsc --noEmit` limpio y `npm run migrations:check` en verde.

**Lo que falta, todo fuera de lo que se puede hacer desde este sesión sin
credenciales de Supabase/Render:**
1. Aplicar la migración a la base real (`supabase db push` o el flujo de
   CLI que ya usa el equipo — **no** pegarla en el SQL editor, por lo que
   ya advierte `INF-7`).
2. Desplegar el BFF a Render con la migración ya aplicada.
3. Configurar `BRIDGE_API_KEY` en Render (string aleatorio largo).
4. Instalar `door_bridge.py` en la PC de GYM RM con
   `SPORTMAPS_BRIDGE_API_KEY` igual a la de Render (ver `README.md`).
5. Prueba end-to-end real: abrir desde el dashboard y confirmar en
   `bridge_supervisor.log` + la puerta física.

No se tocó `access-api.ts` ni `AccessControlPage.tsx` — no hacía falta
(el productor `manual-open` ya estaba bien) y esos archivos tienen trabajo
sin commitear de otra sesión (tarjeta de "Aforo") que se evitó pisar.

## Ajustes posteriores, en producción (2026-08-26/27)

Una vez el bridge quedó corriendo en campo, salieron tres cosas más:

**Ajuste del pulso.** El acceso normal y el software oficial de ZKTeco
abrían el torniquete limpio; nuestro bridge no. Causa: `zk.ZK.unlock(time)`
hace `pack("I", int(time)*10)` — trunca `time` a entero **antes** de
multiplicar por 10, así que nunca manda menos de 1 segundo sostenido, y a
1s+ el torniquete de GYM RM (brazo giratorio sin bloqueo mecánico de "una
vuelta y se traba") se re-arma varias veces por ventana. Se probó `0`
completo (ningún efecto físico — confirma que `0` no es un pulso, es
"nada") y valores intermedios en décimas de segundo llamando al
`CMD_UNLOCK` de más bajo nivel directo (`conn._ZK__send_command`, saltando
el truncado de `unlock()`) con [`test_pulse.py`](./test_pulse.py). **0.2s
(2 décimas) confirmado limpio en los dos lectores**, primero con el script
suelto y después por el flujo real del dashboard. Quedó como
`PULSE_DECISECONDS` en `door_bridge.py`, desacoplado del campo "Tiempo de
apertura" del dashboard (que sigue existiendo y sigue controlando
`Door1Drivertime` por ADMS para el acceso normal — ese sí funciona bien a
1-2s, es un mecanismo distinto).

**Heartbeat: `bridge_heartbeats` sí hacía falta para GYM RM, no para
Dreamers.** Se agregó una tabla nueva + cron en el BFF para avisar si el
bridge deja de sondear `/bridge/door-commands`. Al ir a portarlo a
Dreamers se encontró que ya existe `alert_offline_access_devices()`
(pg_cron cada 5 min, sin migración) cubriendo exactamente eso — para
Dreamers alcanza porque la única vía que toca `turnstile_devices.last_seen_at`
es el propio `send_heartbeat()` de su bridge. Para GYM RM ese mecanismo
existente no servía porque el lector habla ADMS directo y sigue marcando
`last_seen_at` fresco aunque la PC del bridge esté apagada — de ahí la
señal aparte. Ver `INF-12` en el roadmap para el detalle completo.

**Bug de plata encontrado en el camino: inscripciones que se cancelan
solas pese a que la persona sigue pagando.** Al investigar por qué varios
atletas de GYM RM salían `no_enrollment` en los eventos de acceso, se
encontró una condición de carrera entre dos funciones de la base (ninguna
en migraciones): `fn_expire_overdue_enrollments()` (cron diario, cancela
lo vencido) le gana la carrera a `fn_extend_enrollment_on_payment_paid()`
(trigger del 17-jul, extiende `expires_at` al pagar, pero solo si la
inscripción sigue `active`) cuando el pago del mes se aprueba después de
que el cron ya canceló. 15 atletas afectados, reactivados a mano, trigger
corregido para que también reactive inscripciones `cancelled`. Ver
**`DIN-20`** en el roadmap — no es un problema de este bridge ni de
GYM RM en particular, pero se detectó por acá. Dreamers no lo tiene
(usa banco de horas, no `expires_at`).
