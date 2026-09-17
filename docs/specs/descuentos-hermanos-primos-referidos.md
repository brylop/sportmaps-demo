# Descuentos por hermanos, familia extendida y referidos

Estado: **F1-F5 construidas y en `develop`** (2026-09-16). Fuente de verdad de
las decisiones de producto.

- F1 (DB + cascada de hermanos) — migración `20260916101241`, verificada con
  `preview_open_month` contra Club Campestre Demo.
- F2 (toggle en Ajustes) — `PaymentsAutomationPage.tsx`.
- F3 (chips primos/referido en el modal de atleta) — `SchoolStudentsManagementPage.tsx`
  + `discount_type` expuesto en `school_athletes` (migración `20260916102444`).
- F4 (línea del descuento en el recibo) — `MyPaymentsPage.tsx`.
- F5 (`seguridad:invariantes`) — sin violaciones CRÍTICAS; de paso se cerró una
  regresión de `security_invoker` en `school_athletes` (migración `20260916103807`).
- E2E — `frontend/e2e/descuentos.spec.ts` + `supabase/seed/descuentos_test_users.sql`,
  3/3 verdes contra Escuela Demo SportMaps (corrido dos veces para confirmar
  idempotencia).

Pendiente, fuera de alcance de esta ronda: un % parcial editable para
primos/referido vía UI (hoy es cuota exenta con tag — ver la nota de F3 en el
historial de commits).

## Qué se pidió

Configuración necesita ofrecer distintos descuentos según el tipo de relación entre atletas:
hermanos (mismo padre), primos/familia extendida (padres distintos) y referidos.

## Decisiones de producto (cerradas 2026-09-15)

1. **Uno solo por atleta.** Nunca se acumulan dos tipos de descuento sobre el mismo atleta.
2. **Hermanos es automático y siempre activo** cuando la escuela lo habilita — no lo marca la
   escuela caso por caso, se recalcula solo según quién esté matriculado ese mes.
3. **Primos y referidos son manuales** — los asigna la escuela a mano, atleta por atleta. No hay
   autoservicio: ningún padre genera código de invitación ni de referido, no hay vínculo entre
   cuentas de padres.
4. **% de hermanos configurable por escuela** (no un valor fijo global) — mismo patrón que
   `military_discount_enabled`/`sibling_discount_percentage` en `school_settings`.
5. **Umbral: desde el 2do hijo activo** (el primero paga completo).
6. **Conflicto — el manual gana.** Si la escuela marca a mano "primos" o "referido" sobre un
   atleta que ya calificaría para el descuento automático de hermanos, el manual reemplaza al
   automático mientras esté activo (se deja de evaluar hermanos para ese atleta).

## Por qué NO es una extensión trivial de `fee_is_manual`

`fee_is_manual` (migración `20260827175215`) congela el monto: sirve para primos/referidos
(la escuela decide un monto y no debe recalcularse solo — es exactamente ese caso de uso).
Pero **hermanos no puede congelarse**: si un hermano se retira a mitad de año, el mes siguiente
el descuento tiene que desaparecer solo, sin que nadie vuelva a tocar el enrollment. Por eso
hermanos se resuelve **en la cascada de `open_month`/`preview_open_month`**, no como un valor
guardado.

## Diseño

### `school_settings` (nuevas columnas)
```sql
sibling_discount_enabled    boolean NOT NULL DEFAULT false,
sibling_discount_percentage numeric  NOT NULL DEFAULT 0  -- 0-100, solo aplica si enabled
```
Igual patrón que `military_discount_enabled`: default apagado para todas, la escuela lo prende
y define su % en Configuración. Exponer en `v_school_entitlements` o directo en la query de
Configuración (a decidir en F1 según qué pantalla lo consume).

### `enrollments` (nueva columna)
```sql
discount_type text CHECK (discount_type IN ('extended_family', 'referral')) DEFAULT NULL
```
Solo cubre los dos tipos **manuales** — sirve para reportar ("¿por qué este atleta no paga
completo?") y para que la UI bloquee marcar un segundo tipo sobre el mismo atleta. Va de la mano
con `fee_is_manual = true` y `fee_reason` (ya existen): al marcar `discount_type`, la escuela
también fija `fee_is_manual = true` con el monto ya descontado.
Hermanos **no** usa esta columna — no hay nada que guardar en el enrollment, se calcula en el
momento de generar el cobro.

### Regla de cálculo (dentro de `open_month`/`preview_open_month`)

Reemplaza el CASE actual:
```sql
CASE
  WHEN e.fee_is_manual THEN COALESCE(e.monthly_fee, 0)          -- primos/referido/beca: manda tal cual (sin cambios)
  ELSE
    -- base = lo que ya resuelve la cascada hoy (plan > equipo > children)
    base := COALESCE(NULLIF(e.monthly_fee,0), NULLIF(op.price,0), NULLIF(t.price_monthly,0), NULLIF(c.monthly_fee,0), 0);

    CASE WHEN sibling_discount_enabled
           AND (SELECT count(*) FROM enrollments e2
                JOIN children c2 ON c2.id = e2.child_id
                WHERE c2.parent_id = c.parent_id
                  AND e2.school_id = e.school_id
                  AND e2.status = 'active') >= 2          -- este atleta es el 2do+ hijo activo
         THEN base * (1 - sibling_discount_percentage / 100.0)
         ELSE base
    END
END
```
Mismo criterio en las dos funciones (igual que exige el header de `fee_is_manual`: si el
preview difiere de lo que realmente genera, la pantalla de confirmación miente).

Nota de alcance: el conteo de "hermanos activos" es por `parent_id` **dentro de la misma
escuela** — dos hermanos en escuelas distintas no cuentan entre sí.

### Auditoría en `payments`
Mismo patrón que `early_payment_discount_applied`: agregar
`sibling_discount_applied numeric NULL` al `payment` generado, para que el recibo explique el
monto sin tener que recalcular después (un hermano se puede retirar el mes siguiente y el
histórico no debe cambiar de significado).

### Frontend
- **Configuración de la escuela**: toggle + input de % para hermanos (sección nueva, junto a
  donde vive hoy el toggle de `military_discount_enabled` en Ajustes/Facturación).
- **`SchoolStudentsManagementPage`**: en el modal de edición de atleta, dos botones nuevos
  "Descuento por primos" y "Descuento por referido" (mismo lugar que el de Fuerza Militar),
  que marcan `fee_is_manual=true` + `discount_type` + `fee_reason` con el % a mano.
- Validación en el modal: si el atleta ya tiene `discount_type` distinto, avisar que se va a
  reemplazar antes de guardar (no hace falta bloquear en BD, la UI advierte).

## Fases

- **F1 — DB**: columnas en `school_settings` y `enrollments`, cambio en `open_month` +
  `preview_open_month` (nueva migración, número posterior, con verificación tipo becas), columna
  en `payments`. Probar con `preview_open_month` antes/después de retirar un hermano.
- **F2 — Configuración (frontend)**: toggle + % de hermanos en Ajustes de la escuela.
- **F3 — Modal de atleta**: botones de primos/referido en `SchoolStudentsManagementPage`,
  reemplazando o conviviendo con el botón militar existente.
- **F4 — Recibo/reportes**: mostrar el descuento aplicado (hermanos o manual) en el detalle del
  pago, igual que ya se muestra el de pronto pago.
- **F5 — QA + `npm run seguridad:invariantes`**: nada de esto toca RLS de escritura con
  `user_school_ids()`, pero corre el gate igual porque se tocan funciones `SECURITY DEFINER`.

## Pendiente para F1 (no bloquea el spec, se resuelve al programar)

- ¿El % de hermanos aplica sobre el monto ya resuelto por la cascada (plan/equipo) o solo si el
  atleta paga por `offering_plan`? (asumido: sobre lo que sea que resuelva la cascada, sin
  distinguir plan vs equipo).
- ¿Se necesita un tercer botón "Quitar descuento" en el modal para volver el enrollment a
  `fee_is_manual=false`, o ya existe? (revisar `SchoolStudentsManagementPage` en F3).
