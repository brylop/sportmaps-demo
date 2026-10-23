# Dreamers — horas agotadas: bloqueo en el torniquete y excedentes automáticos

**Estado:** PLAN para aprobar (2026-10-23). No hay código ni migración escritos.
**Alcance:** escuelas con banco de horas (`hours_plan_enabled`). Hoy: Dreamers (y Academia Superior, demo).
**Regla de la casa:** plan antes de código en migraciones. Una sola sesión aplica DDL; los agentes en paralelo NO aplican migraciones.

## 1. Qué hay hoy (verificado en código y base viva)

- El torniquete no decide por horas: D-10 del spec de banco de horas = «sin automatismo cuando se pasa del saldo». Solo se notifica a la escuela.
- Lo único que frena la ENTRADA hoy es el bloqueo por mora: `bff/src/jobs/access-auto-block.job.ts`, cada 15 min, por **reconciliación** (lee quién debe y quién está bloqueado y encola solo los cambios). Mecanismo en Dreamers: `disable_user` / `enable_user` (MB360 sin grupos). No borra al atleta ni su PIN: solo deshabilita el lector. En Dreamers el flag está apagado (`access_auto_block_overdue_enabled = false`).
- La reserva sí se frena si el bloque no cabe en el saldo (D-2).
- El excedente se calcula al cerrar el período (`hour_bank_overage_charges`, `status = 'suggested'`) y lo decide el dueño.

## 2. Bloqueo por horas agotadas (sin eliminar a nadie)

**Idea:** una SEGUNDA señal en el mismo job de reconciliación, no un job nuevo. «Bloqueado» = debe mensualidad **o** (flag nuevo) se le acabaron las horas.

| Pieza | Decisión propuesta |
|---|---|
| Flag | `school_settings.access_auto_block_no_hours_enabled boolean default false` (por escuela, apagado de entrada). |
| Señal | Para cada inscripción con plan de horas activa: saldo del período vigente `included_minutes + added_minutes − consumed_minutes − reserved_minutes <= 0` (misma función que usa la pantalla del saldo; no se recalcula aparte). |
| Qué NO bloquea | Quien está **adentro** (visita abierta): D-10 se respeta, no se le corta la clase. El deshabilitado solo impide la PRÓXIMA entrada. Dueños y personal. Inscripciones canceladas. |
| Desbloqueo (automático, mismo job) | Saldo > 0: período nuevo (día 1), horas compradas «Por adelantado» y **pagadas**, o excedente cobrado y pagado. Cobro en revisión (comprobante enviado) cuenta como pagado, igual que en mora. |
| Excepción manual de un día | Reutiliza la de la mora (`device_commands.issued_at`, hora Colombia): «Habilitar hoy» no se re-bloquea ese día. |
| Aviso | Antes de bloquear: «Te quedan X horas» al 20 % y al 0 % (familia y escuela). El bloqueo nunca es sorpresa. |
| Union con mora | Se bloquea si cualquiera de las dos señales es verdadera; se desbloquea solo si ninguna lo es. Evita que una señal deshaga a la otra. |

**Prueba de aceptación (con una niña de prueba, PIN conocido):** agotar el saldo → ≤15 min `disable_user` ejecutado → el lector niega → «Habilitar hoy» deja pasar y no se re-bloquea ese día → comprar 2 h y pagar → ≤15 min `enable_user` → nadie más cambia de estado. Verificar `device_commands` en cada paso.

## 3. Excedentes automáticos (capas, cada una con su interruptor)

1. **Aviso antes de pasarse** (20 % y 0 %): in-app + push, WhatsApp si hay canal. Sin tocar dinero.
2. **Bandeja «Excedentes por confirmar»** con «Cobrar todos»: crea los cobros pendientes (categoría `excedente`) y avisa a la familia. Excluye dueños e inscripciones canceladas.
3. **Confirmar solo bajo reglas:** `hour_bank_overage_auto_confirm_max_hours` y `..._max_amount` (NULL = apagado). Lo que supere el tope sigue en revisión humana.
4. **Recordatorio de cobro:** el cobro nace pendiente con vencimiento a N días y entra al flujo de recordatorios de mensualidad.
5. **Compra de horas por la familia** («Comprar 2 h», tarifa del plan): LO ÚLTIMO; toca pagos en línea. Fuera de esta fase.

## 4. Migración (una sola, la aplica el usuario o una sesión única)

`school_settings`: `access_auto_block_no_hours_enabled boolean not null default false`, `hour_bank_overage_auto_confirm_max_hours numeric null`, `hour_bank_overage_auto_confirm_max_amount numeric null`, `hour_bank_low_balance_notice_pct int not null default 20`. Sin tablas nuevas. Se crea con `npm run migrations:new -- horas_agotadas_bloqueo_y_excedentes`. Sin `CREATE FUNCTION` nuevo (si hiciera falta una, lleva `SET search_path` y `GRANT EXECUTE`). Gate `migrations:check` y `seguridad:invariantes` al cerrar.

## 5. Reparto entre agentes (después de aprobar)

| Agente | Entrega | Toca |
|---|---|---|
| A — job de bloqueo | segunda señal en `access-auto-block.job.ts` + helper de saldo + tests de reconciliación (incluye unión con mora y excepción de un día) | BFF |
| B — excedentes | bandeja, «Cobrar todos», confirmación bajo reglas, recordatorio | BFF + frontend |
| C — avisos | «te quedan X horas» (20 % / 0 %) | BFF + frontend |
| D — migración | archivo `.sql` + ledger; **no aplica** | supabase/ |
| E — QA | pruebas del §2 en el gemelo local (`clonar-dreamers.mjs`), nunca contra prod | pruebas |

Reglas para todos: un commit por agente con solo sus archivos (índice temporal), nada de DDL en paralelo, ni push a `main`.

## 6. Decisiones que faltan (de la escuela)

1. ¿Bloquear al llegar a 0 horas, o dejar un margen (p. ej. una visita más)?
2. ¿Cuándo vuelve a entrar: al pagar el excedente, o solo al comprar horas / al período nuevo?
3. Tope para confirmar excedentes solos (horas y $).
4. ¿El aviso «te quedan X horas» va también a la familia o solo a la escuela?
5. ¿Se mantiene apagado el bloqueo por mora mientras se prueba este?

## 7. Riesgos

- Bloquear físicamente a alguien que sí tiene horas: por eso la señal reutiliza la función del saldo de la pantalla, y la primera prueba es con una niña de prueba. Antes de encender en producción, revisar en el MB360 el estado de los PIN (pendiente U3 del plan de cierre del 13-oct).
- `reserved_minutes` descuenta reservas que aún no se usan: se decide con la escuela si cuentan para el bloqueo (propuesta: **no** cuentan; solo lo consumido y lo que falta del bloque).
