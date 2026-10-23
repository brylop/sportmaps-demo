# Dreamers — horas agotadas: bloqueo en el torniquete y excedentes automáticos

**Estado:** PLAN para aprobar, v2 (2026-10-23). No hay código ni migración escritos.
**Alcance:** escuelas con banco de horas (`hours_plan_enabled`). Hoy: Dreamers (y Academia Superior, demo). Períodos mensuales (día 1).
**Regla de la casa:** plan antes de código en migraciones. Una sola sesión aplica DDL; los agentes en paralelo NO aplican migraciones.
**Cómo leer:** lo marcado **(propuesta)** depende de las respuestas del §6; el resto queda fijo al aprobar.

## 0. En cuatro líneas

- Hoy el torniquete solo se cierra por mora, y en Dreamers ese flag está apagado. Las horas no frenan la entrada.
- Se agrega una **segunda señal** al mismo job de reconciliación: «sin horas» cierra la PRÓXIMA entrada, nunca la clase en curso. Flag por escuela, apagado de entrada, con modo sombra antes de encender.
- Nadie se bloquea sin aviso: escalera de avisos (push + correo) disparada por las entradas y salidas del torniquete, una vez por escalón.
- Los excedentes pasan de «el dueño decide uno por uno» a capas con interruptor: bandeja «Cobrar todos» → confirmación automática bajo tope → recordatorio. Una sola migración, sin tablas nuevas.

## 1. Qué hay hoy (verificado en código y base viva)

- El torniquete no decide por horas: D-10 del spec de banco de horas = «sin automatismo cuando se pasa del saldo». Solo se notifica a la escuela; la familia no recibe nada.
- Lo único que frena la ENTRADA es el bloqueo por mora: `bff/src/jobs/access-auto-block.job.ts`, cada 15 min, por **reconciliación** (lee quién debe y quién está bloqueado y encola solo los cambios). Mecanismo en Dreamers: `disable_user` / `enable_user` (MB360 sin grupos). No borra al atleta ni su PIN: solo deshabilita el lector. En Dreamers el flag está apagado (`access_auto_block_overdue_enabled = false`).
- La excepción manual «Habilitar hoy» ya existe para la mora (`device_commands.issued_at`, hora Colombia).
- La reserva sí se frena si el bloque no cabe en el saldo (D-2).
- El excedente se calcula al cerrar el período (`hour_bank_overage_charges`, `status = 'suggested'`) y lo decide el dueño uno por uno.

## 2. Bloqueo por horas agotadas (sin eliminar a nadie)

**Idea:** una SEGUNDA señal en el mismo job de reconciliación, no un job nuevo. «Bloqueado» = debe mensualidad **o** (flag nuevo) se le acabaron las horas. Un solo lugar decide y un solo mecanismo ejecuta.

| Pieza | Decisión |
|---|---|
| Flag | `school_settings.access_auto_block_no_hours_enabled boolean not null default false` (por escuela; encenderlo no requiere deploy). |
| Señal | Para cada inscripción activa con plan de horas: saldo del período vigente ≤ 0. **(propuesta, §6-7)** saldo para entrar = `included_minutes + added_minutes − consumed_minutes`; las reservas pendientes no descuentan para el bloqueo. Sale del mismo helper que usa la pantalla del saldo, que pasa a devolver dos números: *disponible para reservar* (con `reserved_minutes`, D-2) y *disponible para entrar* (sin). Nada se recalcula aparte. |
| A quién aplica | Solo atletas con inscripción activa de plan de horas y usuario creado en el lector (sin usuario no hay comando que mandar). |
| Qué NO bloquea | Quien está **adentro** (visita abierta): D-10 se respeta, no se le corta la clase; el bloqueo solo impide la PRÓXIMA entrada. Dueños y personal. Inscripciones no activas o sin plan de horas. |
| Varias inscripciones **(propuesta, §6-8)** | Se bloquea solo si TODAS sus inscripciones activas con plan de horas están en 0. Caso raro en Dreamers; no vale complejidad ahora. |
| Desbloqueo (automático, mismo job) | Cuando el saldo vuelve a ser > 0: período nuevo (día 1) u horas «Por adelantado» registradas por la escuela y **pagadas** (cobro en revisión con comprobante cuenta como pagado, igual que en mora). Pagar un excedente cubre lo ya usado y no sube el saldo: no abre la puerta por la señal de horas (ver §3 y §6-3). |
| Excepción manual de un día | Reutiliza la de la mora: «Habilitar hoy» deja pasar y no se re-bloquea ese día por ninguna de las dos señales. |
| Unión con mora | Se bloquea si cualquiera de las dos señales es verdadera; se desbloquea solo si ninguna lo es. Así una señal no deshace a la otra. Con el flag de mora apagado (Dreamers hoy) esa señal vale «falso». |
| Visibilidad | La pantalla donde hoy vive «Habilitar hoy» muestra el motivo del bloqueo (mora, horas o ambas). Es lo que mira quien está en la puerta cuando el lector niega. |
| Latencia | Hasta 15 min entre agotar el saldo y el `disable_user`. Opcional y barato: al cerrar una visita que deja el saldo en ≤ 0, reconciliar a ese atleta de inmediato (si el job se puede invocar por atleta). |
| Avisos | Ningún bloqueo sin aviso previo: la escalera del §2.1 corre siempre que el bloqueo esté encendido, y puede correr sola con el bloqueo apagado. |

**Modo sombra antes de encender en producción:** con el flag apagado, correr el job en «solo reporte» (bandera de ejecución o script, sin columna nueva) que liste a quién bloquearía hoy y por qué, y cruzarlo con la escuela. Dos corridas limpias (lista esperada = lista real) y recién ahí se enciende.

**Prueba de aceptación** (gemelo local, niña de prueba con PIN conocido; `device_commands` verificado en cada paso):

1. Saldo > 0 → el job no genera comandos para ella.
2. Agotar el saldo → ≤ 15 min `disable_user` ejecutado → el lector niega.
3. Correr el job otra vez → ningún comando nuevo (idempotente).
4. «Habilitar hoy» → pasa y no se re-bloquea ese día; al día siguiente, sí.
5. Con ella **adentro** (visita abierta) y saldo en 0 → el job no la toca; al salir, ≤ 15 min `disable_user`.
6. Registrar 2 h «Por adelantado» y pagar → ≤ 15 min `enable_user`; gastarlas → vuelve a bloquear.
7. Período nuevo (día 1) → `enable_user` sin intervención.
8. Mora + horas (ambos flags encendidos en el gemelo): bloqueada por horas, se le registra mora, compra horas → sigue bloqueada; paga la mensualidad → `enable_user`.
9. En todos los pasos nadie más cambia de estado: diff de `device_commands` antes/después = solo ella.
10. Cada escalón del §2.1 llegó una sola vez, por el canal correcto y con el saldo correcto.

### 2.1 Avisos de saldo (push y correo)

**Disparador:** los mismos eventos del torniquete que ya alimentan `trackHourBankVisit` en `bff/src/routes/access-adms.ts`: la ENTRADA y la SALIDA (cierre de visita y descuento). El saldo se lee justo después de descontar. No hace falta un job nuevo, salvo para el escalón de «margen» (abajo).

**Regla de disparo:** un escalón sale la **primera vez** que se observa el saldo en o por debajo de su umbral, sea al entrar o al salir, y una sola vez por inscripción y período. Si el saldo vuelve a subir por encima del umbral (recarga), la marca se borra y una segunda bajada vuelve a avisar. Un reintento del lector no cambia el saldo y no reenvía.

**Escalera (por defecto; la escuela la ajusta).** Cada mensaje dice cuántas horas usó en la visita, cuántas le quedan y cuándo se renuevan:

| Escalón | Mensaje |
|---|---|
| 50 % | «Llevas la mitad de tus horas del mes. Te quedan X h.» |
| 20 % | «Te quedan X h: alcanzan para N clases más.» N sale del tamaño del bloque del plan, no se escribe a mano. |
| 10 % (configurable, apagado por defecto) | Igual al de 20 %. Entre 20 % y 10 % suele haber una sola clase; dos avisos seguidos cansan. |
| 0 % | «Se acabaron tus horas de este mes. Para volver a entrar: pedir más horas a la escuela o esperar el día 1.» Con bloqueo encendido añade: «Desde tu próxima visita el lector no abrirá hasta que haya saldo.» |
| Bloqueado | La emite el **job** al encolar `disable_user` (no es un evento del torniquete): «Estás bloqueado por horas. Así vuelves a entrar: …». Una por bloqueo, no por período. |
| Margen (solo si la escuela elige margen, §6-2) | Cron diario, p. ej. 6 p. m.: «Mañana no podrás entrar si no renuevas.» Es el único escalón que necesita cron. |

**Canales:**

1. **Push + in-app** (Despachador, ya existe): inmediato, sin costo. Sin la app, el escalón va solo por correo.
2. **Correo** (Resend; Pro 50 k/mes, 100 por llamada): un correo por escalón al acudiente con correo. Plantilla corta: saldo, historial del mes y botón «Pedir más horas», que abre el contacto de la escuela. «Comprar horas» en línea solo cuando exista la capa 5 del §3.
3. **WhatsApp:** solo si la escuela tiene el canal (Dreamers hoy NO), siempre por la cola propia y sus plantillas.

**Para no molestar:**

- Una notificación por escalón y período (llave `inscripción + período + escalón`), con el borrado por recarga de arriba.
- Hermanos: un solo correo por acudiente con el saldo de cada hija (los correos esperan 10 min para agrupar; el push sale al momento).
- Tope de un correo por acudiente por día; el resto del día los escalones van solo por push.
- Horario: push al momento; correos entre 8 a. m. y 8 p. m. hora Colombia, lo demás se difiere a las 8 a. m.
- Destinatario: atleta adulto → él; menor → acudiente(s) vinculado(s); sin acudiente vinculado → solo la escuela, y queda visible en el admin.
- Configurable por escuela en `school_settings`: lista de escalones `hour_bank_balance_notice_steps` (`'{}'` = sin avisos) e interruptor `hour_bank_balance_notice_email_enabled`.

**Dónde vive «ya avisé»:** columna `balance_notices jsonb not null default '{}'` (`{escalón: fecha}`) en la fila del período del banco de horas, la tabla que tiene `included_minutes` / `added_minutes` / `consumed_minutes` (confirmar nombre). Sin tabla nueva, y el borrado por recarga es una sola actualización. Si el Despachador ya tiene llave de idempotencia, se usa esa y la columna sobra.

## 3. Excedentes automáticos (capas, cada una con su interruptor)

Con el bloqueo encendido el excedente se achica solo: queda el remate de la última clase (entró con 30 min y la clase duró 60) y lo que pase por «Habilitar hoy». Las capas valen igual para escuelas que no enciendan el bloqueo (modelo pospago, §6-1).

1. **Aviso antes de pasarse:** es la escalera del §2.1 (20 % y 0 %). Nada que construir aparte.
2. **Bandeja «Excedentes por confirmar»** con «Cobrar todos»: toma los `suggested` del cierre, crea los cobros pendientes (categoría `excedente`) y avisa a la familia con el detalle (de dónde salen los minutos, tarifa, total), para que no parezca un cobro arbitrario. Excluye dueños e inscripciones canceladas. Un cobro por inscripción y período: «Cobrar todos» dos veces no duplica.
3. **Confirmar solo bajo reglas:** `hour_bank_overage_auto_confirm_max_hours` y `hour_bank_overage_auto_confirm_max_amount` (NULL = apagado). Se confirma solo si cumple TODOS los topes definidos y hay al menos uno; lo que supere cualquiera sigue en revisión humana. Corre en el mismo cierre que hoy crea los `suggested`.
4. **Recordatorio de cobro:** el cobro nace pendiente con vencimiento a N días (**propuesta:** el mismo plazo que ya usa la mensualidad) y entra al flujo de recordatorios que ya existe. Un excedente vencido es un cobro vencido más: con el bloqueo por mora encendido, bloquea como la mensualidad (confirmar que la señal de mora mira todos los cobros vencidos, no solo mensualidades).
5. **Compra de horas por la familia** («Comprar 2 h», tarifa del plan): LO ÚLTIMO; toca pagos en línea. Fuera de esta fase. Mientras tanto la recarga es «Por adelantado» registrada por la escuela.

## 4. Migración (una sola; la aplica el usuario o una sesión única)

`npm run migrations:new -- horas_agotadas_bloqueo_y_excedentes`

`school_settings` (todas con default: aplicarla no cambia comportamiento):

- `access_auto_block_no_hours_enabled boolean not null default false`
- `hour_bank_overage_auto_confirm_max_hours numeric null`
- `hour_bank_overage_auto_confirm_max_amount numeric null`
- `hour_bank_balance_notice_steps int[] not null default '{50,20,0}'` — reemplaza al `hour_bank_low_balance_notice_pct` de la v1: un solo valor no describe una escalera.
- `hour_bank_balance_notice_email_enabled boolean not null default true`

Período del banco de horas (tabla a confirmar): `balance_notices jsonb not null default '{}'`.

Sin tablas nuevas. Sin `CREATE FUNCTION` nuevo (si hiciera falta una, lleva `SET search_path` y `GRANT EXECUTE`). Orden seguro: la migración puede ir antes del deploy (solo defaults); el código nuevo la exige. Ojo con el deploy: con `steps` por defecto, los avisos arrancan en toda escuela con `hours_plan_enabled` (es lo buscado en Dreamers, §6-9); en Academia Superior (demo) dejar `'{}'` o confirmar que los contactos son ficticios. Gate `migrations:check` y `seguridad:invariantes` al cerrar.

## 5. Reparto entre agentes (después de aprobar)

Orden: **D primero** (archivo + ledger) y el usuario la aplica en el gemelo; luego A, B y C en paralelo; E al final sobre A + C.

| Agente | Entrega | Toca |
|---|---|---|
| D — migración | archivo `.sql` + ledger; **no aplica** | supabase/ |
| A — job de bloqueo | segunda señal en `access-auto-block.job.ts`, helper de saldo con los dos números, unión con mora, excepción de un día, modo sombra, tests de reconciliación | BFF |
| B — excedentes y ajustes | bandeja, «Cobrar todos», confirmación bajo topes, recordatorio; **todos** los ajustes nuevos de la escuela (flag, topes, escalones, correo) y el motivo en la pantalla de bloqueos, para que una sola mano toque esas pantallas | BFF + frontend |
| C — avisos | escalera del §2.1: disparo en entrada/salida, canales, agrupación de hermanos, marca `balance_notices`, plantillas de correo | BFF |
| E — QA | los 10 pasos del §2 y los avisos en el gemelo local (`clonar-dreamers.mjs`), nunca contra prod | pruebas |

A y C comparten el helper de saldo: lo escribe A y C lo consume; la firma se acuerda antes de arrancar. Reglas para todos: un commit por agente con solo sus archivos (índice temporal), nada de DDL en paralelo, ni push a `main`.

## 6. Decisiones que faltan (de la escuela), con propuesta para responder sí/no

1. **Modelo.** Prepago (bloqueo por horas encendido: sin saldo no se entra) o pospago (bloqueo apagado: se entra siempre, el excedente se cobra solo y, si vence, bloquea como mora). Los dos salen de este plan con los mismos flags. **Propuesta:** prepago, que es lo que motiva el plan.
2. **Margen.** ¿Bloquear al llegar a 0 o dejar «una visita más» / «hasta fin del día»? **Propuesta:** en 0; el aviso de 0 % ya anuncia que no podrá entrar. Con margen se activa el escalón «Mañana no podrás entrar» y su cron.
3. **Qué abre la puerta.** Horas «Por adelantado» pagadas o período nuevo. Pagar un excedente no sube el saldo. **Propuesta:** así.
4. **Topes** para confirmar excedentes solos (horas y $). **Propuesta:** empezar bajo (p. ej. 2 h) y subir tras el primer cierre.
5. ¿El aviso «te quedan X horas» va también a la familia? **Propuesta:** sí; sin aviso a la familia el bloqueo es sorpresa.
6. ¿Se mantiene apagado el bloqueo por mora mientras se prueba este? **Propuesta:** sí; una señal a la vez, para poder atribuir cada bloqueo.
7. ¿Las reservas pendientes descuentan para el bloqueo? **Propuesta:** no (solo lo consumido); para reservar siguen descontando (D-2).
8. Atleta con varias inscripciones de horas. **Propuesta:** se bloquea solo si todas están en 0.
9. ¿Avisos de saldo desde el deploy, aunque el bloqueo siga apagado? **Propuesta:** sí; un mes de avisos sin consecuencia calibra la escalera y acostumbra a las familias.

## 7. Riesgos y cómo se cubren

- **Bloquear a alguien que sí tiene horas:** la señal reutiliza el helper de la pantalla; niña de prueba primero; modo sombra con dos corridas limpias; revisar en el MB360 el estado de los PIN antes de encender (pendiente U3 del plan de cierre del 13-oct).
- **Dejar a alguien adentro:** confirmar si el MB360 valida el PIN también a la SALIDA. Si lo hace, la exclusión de «visita abierta» es obligatoria y el estado de visita debe estar al día antes de cada corrida.
- **Comando que no llega al lector:** la reconciliación debe comparar contra el último comando **ejecutado**, no encolado, para que la siguiente corrida reintente sola. Confirmar en el job de mora.
- **Aluvión al encender el flag:** todas las que estén en 0 se bloquean en la primera corrida. Modo sombra, aviso de 0 % ya enviado, y encender un día de semana a primera hora con la escuela avisada.
- **Castigo doble (bloqueo + excedente):** con bloqueo el excedente es solo el remate de la última clase, y el mensaje de cobro explica de dónde salen los minutos.
- **Período en la zona horaria equivocada:** confirmar que «período vigente» y «día 1» se calculan en hora Colombia; en UTC el día 1 llegaría a las 7 p. m. del día anterior y el desbloqueo se adelantaría.
- **`reserved_minutes`:** §6-7.

## Cambios respecto a la v1

- Contradicciones resueltas: la señal descontaba `reserved_minutes` pero el riesgo proponía lo contrario (→ propuesta explícita, §6-7); «una sola vez por escalón» convivía con «al entrar y de nuevo al salir» (→ primera observación, con borrado por recarga); «sin job nuevo» convivía con un cron del día antes (→ el cron existe solo si hay margen).
- La escalera de avisos estaba en tres lugares con distinta forma; ahora vive solo en §2.1.
- «Ya avisé» no tenía dónde guardarse: columna `balance_notices` en el período. `hour_bank_low_balance_notice_pct` pasa a lista de escalones + interruptor de correo.
- Pagar un excedente no abre la puerta por la señal de horas; su efecto, si vence, es por la señal de mora.
- El correo apuntaba a «Comprar horas», que es la capa 5 (fuera de fase); ahora «Pedir más horas».
- Nuevo: resumen inicial, modo sombra, prueba de aceptación de 10 pasos, orden de agentes (D primero) con los ajustes en una sola mano, todas las decisiones con propuesta (nuevas: modelo, qué abre la puerta, reservas, varias inscripciones, avisos desde el deploy), motivo del bloqueo en el admin, y riesgos de salida, comando perdido y zona horaria.

## Verificado (2026-10-23): base viva, código y bridge — CAMBIA EL ORDEN

**Orden nuevo: primero el bridge y el estado real de los lectores; el bloqueo por horas, después.**

1. **Las horas «Por adelantado» ya están en `included_minutes`.** `grant_hour_bank_minutes` hace `UPDATE hour_bank_periods SET included_minutes = included_minutes + p_minutes` y deja el rastro en `hour_bank_grants` (idempotente por `payment_id`; solo cobros `clase_extra` pagados del mismo atleta). `added_minutes` no existe ni hace falta. Fórmulas reales: **disponible para entrar = `included_minutes − consumed_minutes`**; **disponible para reservar = `included_minutes − consumed_minutes − reserved_minutes`**. Hay `get_or_open_hour_bank_period_at(enrollment, fecha)`. La prueba 6 del §2 se reescribe contra esto.
2. **«Ejecutado» no significa «el lector lo hizo».** Para Dreamers el estado lo pone el bridge con `POST /bridge/door-commands/:id/ack {success}` tras llamar al SDK local; no es la respuesta `Return=0` de `/iclock/devicecmd` (ese camino es el de los F22 por ADMS). Antes de la versión con relectura (commit `16edd9d5`, 2026-10-08; en el PC de Dreamers corría una con relectura desde el 6-oct 17:17) «executed» = `set_user` no lanzó excepción, nada más.
3. **El `disable_user` por bit 0 nunca pudo funcionar con pyzk 0.9.** `zk/base.py:867-868`: `if privilege not in [USER_DEFAULT(0), USER_ADMIN(14)]: privilege = USER_DEFAULT`. El bridge manda `privilege = existing | 1` (= 1) y pyzk lo recorta a 0. Prueba en la base: los 2 `failed` del 6-oct 17:00 dicen «El lector no conservó el cambio de PIN 4: privilege antes=0 después=0», en los DOS lectores. Es decir, los 101 «executed» no deshabilitaron a nadie (consistente con el comentario del bridge: «2026-10-06: órdenes executed y la persona igual pasaba»). Con el código actual, todo `disable_user` termina `failed`. Arreglo (agente A, con prueba en un lector real antes de encender nada): reenviar el usuario completo con `const.USER_DEFAULT` temporalmente igual al privilegio deseado (ver el snippet de la revisión del bridge), relectura obligatoria, y plan B de grupo con horario cerrado si el firmware ignora el bit.
4. **Los «95» eran comandos, no personas.** 108 `disable_user` entre el 5-sep y el 6-oct sobre **5 PIN distintos** (1, 2, 4, 12, 401): 101 executed, 2 failed, 5 expired. Cruce con los 6 PIN mapeados hoy (1 Fabio, 78 Silvana, 385 Carolina, 401 Emma, 602 Zoe, 615 Airi): coinciden **PIN 1 (Fabio, 2 veces) y PIN 401 (Emma, 66 veces)**. Los PIN 2, 4 y 12 ya no están mapeados (atletas borrados): huérfanos. Por el punto 3, lo más probable es que nadie quedó deshabilitado físicamente, pero **solo `get_users()` en cada lector lo confirma**.
5. **Apagar el flag de mora congela, no desbloquea.** `runAccessAutoBlockCycle` solo lista escuelas con `access_auto_block_overdue_enabled = true`; con el flag apagado (Dreamers, desde el 6-oct 17:29) nadie recibe `enable_user`. Encaja con «cero `enable_user` en 30 días». El §6-6 y el modo sombra deben tener esto presente: apagar un flag no revierte lo ya aplicado.
6. **«Habilitar hoy» (`issued_at`):** el código con `issued_at` está en `main` (commits `16edd9d5`, `344f0be9`). Que esté DESPLEGADO en Render no se puede ver desde el repo: confirmar en el panel de Render o con un cambio de comportamiento observable antes de contar con la excepción en la prueba 4.
7. **Re-habilitar no es «mandar enable_user a todos»:** solo los PIN mapeados a inscripciones activas (hoy 78, 385, 401, 602, 615 y 1 si no es personal); los huérfanos (2, 4, 12) se dejan o se quitan del lector.

**Pendientes inmediatos (solo lectura; no se encola ningún `enable_user`):**
- Correr `scripts/dreamers-bridge/listar_usuarios_solo_lectura.py` en la PC de Dreamers (get_users() en los dos MB360; marca privilegio impar como deshabilitado, deja CSV). Con ese dump se decide qué se re-habilita y con qué comando.
- Confirmar qué versión del bridge lleva el zip de Dreamers: la del repo (WS, con comandos) o una de una sola vía (solo latido, que deja `disable_user`/`enable_user` en `pending` para siempre).
- Confirmar la IP de cada MB360 (el script de diagnóstico dice ENTRADA .201 y SALIDA .202; una versión del bridge tenía SALIDA en .201).

**Decisiones del §6 contestadas (2026-10-23):** sí a 3, 5, 6, 7, 8 y 9. Quedan como propuesta hasta hablar con Dreamers: 1 (modelo prepago/pospago), 2 (margen) y 4 (topes de excedente).
