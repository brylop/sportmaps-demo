# Torneos internos: inscripción por la escuela, torneo gratis y medios de pago

Estado: **borrador para aprobación** (2026-10-15). Sin migraciones aplicadas.
Extiende `torneos-internos-inscripcion-pago-2026-09-01.md`, que ya cubre la
inscripción del padre, el cobro y el armado de equipos.

## 1. Problema

1. **La escuela no puede inscribir a un atleta.** Solo el padre o el atleta
   inscriben (`POST /school-tournaments/:id/register`, RPC
   `register_for_internal_tournament`). Si la escuela crea el torneo, la
   inscripción debe poder salir de la escuela y llegar a la familia.
2. **Un torneo gratis no funciona.** La RPC del padre siempre crea un `payments`
   con `price_solo` de la fase vigente. Si no hay fase, lanza
   «No hay una tarifa vigente». Si la fase es 0, el insert choca con
   `payments_amount_positive`.
3. **No se elige si el torneo es pago ni qué medios se aceptan.** `events.payment_methods`
   se guarda al crear (`events.route.ts:168`), pero ninguna pantalla lo pide.

## 2. Decisiones

| # | Decisión | Fuente |
|---|---|---|
| D1 | La inscripción hecha por la escuela queda **confirmada** y notifica a la familia. | Confirmado por producto 2026-10-15 |
| D2 | Un torneo puede ser **gratis** (`is_paid = false`): no pide precio, no crea cobro y la inscripción queda confirmada al momento. | Confirmado 2026-10-15 |
| D3 | Un torneo **pago** exige precio mayor que 0 y al menos un medio de pago. | Propuesto |
| D4 | Los medios que se ofrecen se toman de las **cuentas de pago que la escuela ya tiene configuradas** (Wompi, llaves/transferencia, efectivo). | Propuesto; pendiente de confirmar |
| D5 | La escuela **puede inscribir después de cerrar el plazo**. Se deja aviso en la bandeja. | Confirmado 2026-10-15 |
| D6 | Quién inscribe: `school` y `school_admin`. El entrenador no, porque la inscripción mueve dinero. | Propuesto |
| D7 | El cobro de una inscripción hecha por la escuela se crea **al pagador del atleta** (`parent_id`). Si el atleta no tiene pagador, se rechaza. | Regla vigente (ver memoria «Cobros de menores sin pagador») |

## 3. Cambios por capa

### 3.1 Base de datos (migración nueva, con ledger)

- Columna `events.is_paid boolean not null default true` (los torneos existentes
  siguen pagando; no cambia nada vivo).
- Reemplazar `register_for_internal_tournament`: si `is_paid = false`, no crea
  `payments`, inscribe como `confirmed`.
- Nueva RPC `school_register_athlete_for_tournament(p_event_id, p_category_id, p_child_id)`,
  `SECURITY DEFINER`, `SET search_path = pg_catalog, public, pg_temp`,
  `GRANT EXECUTE ... TO authenticated` explícito. Valida: torneo de la escuela
  del caller, `child` activo en esa escuela, categoría válida, no repetido
  (índice único existente), pagador no nulo. Crea el cobro si es pago y
  confirma la inscripción.
- `notifications.category` acepta `'tournament'` (si no está ya).
- Pruebas de concurrencia: dos inscripciones simultáneas del mismo atleta.

### 3.2 BFF

- `POST /school-tournaments/:id/register-athlete` (`requireRole('school', 'school_admin')`).
  Llama la RPC y dispara notificación al pagador.
- `POST`/`PATCH` de torneo aceptan `is_paid` y `payment_methods`; si `is_paid`
  es verdadero, validan precio > 0 y al menos un medio.

### 3.3 Frontend

- Creación del torneo: interruptor «¿Es pago?»; si sí, precio y selector de
  medios (solo los que la escuela tiene configurados).
- Detalle del torneo (escuela): botón «Inscribir atleta» con los atletas de la
  escuela filtrados por categoría.
- Checkout del padre: mostrar solo los medios que el torneo acepta.

## 4. Pruebas (mínimo)

- Torneo gratis: inscripción del padre y de la escuela, sin fila en `payments`.
- Torneo pago: cobro creado con el monto de la fase vigente.
- Duplicado de la misma persona en la misma categoría: rechazado.
- Atleta de otra escuela: rechazado.
- Atleta sin pagador: rechazado con mensaje claro.
- Inscripción después del cierre: permitida y avisada.
- Familia notificada en cada caso.

## 5. Riesgos

- **Besser tiene 14 cobros sin pagador** (memoria del 2026-10-14). Un atleta sin
  pagador no se puede inscribir hasta corregirlo.
- **Disk IO:** la migración se aplica en una sola sesión, sin paralelo, y los
  tipos se regeneran una sola vez al final (reglas de `CLAUDE.md`).
- **RLS:** revisar las policies de `event_registrations` línea por línea antes
  de aplicar, y correr `npm run seguridad:invariantes` después.

## 6. Orden de trabajo (una rama por fase)

1. Base de datos: plan de migración aprobado → migración → verificación en la base viva.
2. BFF: endpoint y validaciones de torneo.
3. Frontend: creación con interruptor y medios; inscripción por la escuela; checkout filtrado.
4. QA end-to-end en Escuela Demo SportMaps; después en Besser con el addon `tournaments`.

## 7. Pendiente de confirmar

- **D4:** ¿los medios se toman de las cuentas configuradas? (propuesto y aplicado en este borrador)
- **D6:** ¿el entrenador también puede inscribir? (propuesto: no)
