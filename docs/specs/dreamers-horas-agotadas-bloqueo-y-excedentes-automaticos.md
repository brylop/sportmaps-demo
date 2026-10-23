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

## Verificado contra la base viva (2026-10-23, al guardar la v2)

- La tabla del período del banco es **`hour_bank_periods`** (`enrollment_id, period_start, period_end, included_minutes, reserved_minutes, consumed_minutes`). **No tiene columna `added_minutes`**: la fórmula del §2 debe usar la forma en que hoy se suman las horas «Por adelantado» (existe la tabla `hour_bank_grants` y la RPC `grant_hour_bank_minutes`); antes de que el agente A escriba el helper hay que leer cómo el período refleja esos *grants* (si suben `included_minutes` o se suman aparte). Es una condición previa del helper, no una decisión de la escuela.
- La migración (§4) queda: `balance_notices` en `hour_bank_periods`.
