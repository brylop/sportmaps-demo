# Spec — Cumpleaños y Celebraciones

**Estado:** 🟡 Plan propuesto, sin aprobar. Fuente de verdad de este módulo.
**Roadmap:** `MOD-18` en [`docs/ROADMAP.md`](../ROADMAP.md) (cola P2; su F1 puede adelantarse como relleno).
**Fecha:** 2026-08-19
**Autor:** brylop
**Rama de trabajo:** `develop` (una rama por fase: `feat/cumple-f0-datos`, `feat/cumple-f1-tablero`, …)

---

## 1. Objetivo

Que la escuela **sepa y celebre** los cumpleaños de sus atletas: un tablero de "hoy cumple" para el staff,
un saludo automático a la familia, y el anuncio celebratorio en el dispositivo de recepción cuando el
cumpleañero entra.

Hoy **no existe nada**: ni tabla, ni RPC, ni cron, ni categoría de notificación, ni UI. Lo único que hay es
la fecha de nacimiento guardada, usada para edad/categoría deportiva, el gate mayor/menor del registro y la
impresión de carnets. Detalle en §2.

## 2. Estado actual (verificado contra la base viva, 2026-08-19)

| # | Hallazgo | Evidencia |
|---|---|---|
| 1 | Cero objetos de cumpleaños en la base: ninguna tabla, columna, función o job de `pg_cron` con `cumple`/`birthday` | barrido en `information_schema` + `pg_proc` + `cron.job` |
| 2 | `date_of_birth` vive en 5 tablas: `children`, `profiles`, `unregistered_athletes`, `students` (vista), `school_athletes` (vista) | `information_schema.columns` |
| 3 | Los tres usos actuales de la fecha: edad/categoría (`getAgeCategory`), gate mayor/menor del registro, impresión en carnets/certificados | `frontend/src/lib/athlete/queries.ts:300`, `frontend/src/pages/RegisterPage.tsx:50`, `bff/src/routes/certificates.ts:40` |
| 4 | Las únicas menciones literales a "cumpleaños" en el repo son comentarios de los seeds de demo | `scripts/demo/seed.mjs:140`, `scripts/demo-club-campestre/seed.mjs:123` |
| 5 | El despachador de notificaciones no tiene categoría celebratoria. Categorías vivas: `payment` (595), `system` (12), `glosa` (3), `NULL` (1651) | `select category, count(*) from notifications group by 1` |
| 6 | El Modo Recepción **ya tiene** la maquinaria de toast + confetti + voz + mascota `'celebra'`, cableada solo a pagos/glosas/sistema | `frontend/src/features/recepcion/config.ts:83-127` |

### 2.1 Cobertura de datos — define el alcance realista

Atletas **activos** en `school_athletes` (vista), al 2026-08-19:

| `athlete_type` | Total | Con fecha | Con a quién notificar |
|---|---|---|---|
| `child` | 792 | 775 | **377** |
| `unregistered` | 253 | 70 | **0** |
| `adult` | 38 | 33 | **33** |
| **Total** | **1083** | **878** | **410 (47%)** |

Tres números que gobiernan el diseño:

- **878 atletas activos tienen fecha** → el tablero para el staff sirve al 100% de ellos sin depender de cuentas.
- **Solo 410 (47%) tienen `user_id` o `parent_id`** → el saludo automático por push/in-app alcanza a menos de la
  mitad. Los 253 `unregistered` no tienen cuenta: cobertura **cero**. Es la misma raíz del problema de resolver
  quién paga un cobro. No prometer "saludo automático a todos".
- **~2,4 cumpleaños por día** en toda la plataforma (878/365). Hoy cumplen 3. El volumen es bajo: no hace falta
  batching ni colas propias.

### 2.2 Riesgo de datos ya presente

- **7 grupos de identidades duplicadas** (misma escuela + mismo nombre + misma fecha) → la misma familia
  recibiría dos saludos. Es la cola del problema conocido de identidades duplicadas de atleta.
- **0 atletas nacidos un 29 de febrero** hoy, pero el caso hay que resolverlo por diseño (D5) o el saludo se
  pierde tres años de cada cuatro.
- Fechas cargadas por CSV/OCR sin validar: una fecha absurda (año 1900, o del futuro) produce un saludo
  ridículo. Necesita filtro de sanidad (D6).

## 3. Decisiones firmes

- **D1 — El saludo es de la ESCUELA, no de SportMaps.** El texto lo firma la escuela y sale con su nombre.
  SportMaps no se mete en la relación con la familia.
- **D2 — Destinatario:** atleta **adulto** → a él mismo; **menor** → al padre (`parent_id`). Nunca a un tercero.
- **D3 — La fecha de nacimiento de un menor NO se difunde.** El listado de cumpleaños lo ve **solo el staff** de
  la escuela. No hay lista pública, no se avisa a los compañeros de equipo ni a otros padres. Esto elige la
  función de alcance: **`user_staff_school_ids()`**, no `user_school_ids()` (que incluye padres y atletas).
- **D4 — Un saludo por atleta por año.** Idempotencia dura en la base: el cron corre diario y una reejecución no
  puede duplicar.
- **D5 — 29 de febrero → se saluda el 28 de febrero** en años no bisiestos.
- **D6 — Solo atletas `is_active`** y con edad plausible (entre 2 y 100 años). Coherente con la política de baja
  de atleta (inactivar deja de generar obligaciones y comunicaciones).
- **D7 — Toggle por escuela, APAGADO por defecto** (`birthday_greetings_enabled = false`). No negociable: hay
  **una sola Supabase** para dev/stg/prod, así que el cron es global y encenderlo es un acto de producción sobre
  familias reales. Se enciende escuela por escuela.
- **D8 — Sin `CREATE TYPE`.** Estados con `text + CHECK` (convención del repo).
- **D9 — El saludo no menciona la edad.** Con fechas cargadas a mano, "¡Feliz cumpleaños número 14!" se equivoca
  en público. El texto celebra sin cifras.
- **D10 — Sin gate por tier ni addon.** Incluido en todos los planes. Precedente que no se repite: el
  grandfathering invertido de tiers (escuelas de prueba en enterprise, escuelas grandes en free) haría que el
  gate premie justo a quien no debe.
- **D11 — El envío pasa por `notifications`,** como todo productor. El trigger del despachador unificado hace el
  fan-out a push. No se escribe push a mano.

## 4. Arquitectura

```
pg_cron  send-birthday-greetings-daily  (13:00 UTC = 08:00 America/Bogota)
        │
        ▼
public.send_birthday_greetings()   SECURITY DEFINER
        │  ├─ escuelas con school_settings.birthday_greetings_enabled = true   (D7)
        │  ├─ atletas activos, fecha plausible, MM-DD = hoy (tz Bogotá)        (D5, D6)
        │  ├─ deduplica identidades repetidas                                  (§2.2)
        │  └─ salta los que ya tienen fila de este año                         (D4)
        ▼
INSERT INTO public.notifications (category='birthday', data={athlete_name, school_name, sede_id})
        │                                    │
        │                                    └──► Realtime → campana in-app + Modo Recepción (F3)
        ▼ TRIGGER (despachador unificado, ya existente)
public.notification_deliveries → BFF → web push + FCM
        │
        ▼
INSERT INTO public.birthday_greetings (log + idempotencia)
```

**La plomería del fan-out ya existe** (verificado 2026-08-19): `notification_deliveries` está creada y
`notifications` ya tiene las columnas `category` y `data`. El módulo no agrega infraestructura de envío: solo se
cuelga del choke point que ya está puesto (D11).

Lectura (tablero del staff), camino separado y sin envío:

```
Front  →  BFF  GET /api/v1/schools/:id/birthdays?from&to  →  RPC escuela_cumpleanos()  (staff-only, D3)
```

**Por qué el log en tabla propia y no derivarlo de `notifications`:** hay que registrar también a los **590
atletas sin cuenta** (saludo imposible por push) para que el tablero muestre "pendiente de saludar por WhatsApp"
y para no reintentar en cada corrida. `notifications` solo guarda lo que sí se pudo enviar.

## 5. Modelo de datos

**Cambios aditivos en `public.school_settings`** (migración nueva):

| col | tipo | default | nota |
|---|---|---|---|
| `birthday_greetings_enabled` | boolean | **false** | D7. El interruptor global de seguridad |
| `birthday_message_template` | text | NULL | plantilla con `{atleta}` y `{escuela}`; NULL → texto por defecto |
| `birthday_notify_staff` | boolean | true | avisar al staff aunque el atleta no tenga cuenta |

**Tabla nueva `public.birthday_greetings`** (log + idempotencia):

| col | tipo | nota |
|---|---|---|
| `id` | uuid pk default gen_random_uuid() | |
| `school_id` | uuid NOT NULL FK → schools(id) | |
| `child_id` | uuid NULL FK → children(id) | XOR |
| `user_id` | uuid NULL FK → **profiles(id)** | XOR (convención: FK de negocio a `profiles`, no a `auth.users`) |
| `unregistered_athlete_id` | uuid NULL FK → unregistered_athletes(id) | XOR |
| `greeting_year` | smallint NOT NULL | |
| `notified_user_id` | uuid NULL | a quién se le mandó (padre o atleta) |
| `status` | text NOT NULL CHECK in (`sent`, `skipped_no_account`, `skipped_duplicate`) | |
| `created_at` | timestamptz default now() | |

- `CHECK` XOR: exactamente uno de los tres ids no nulo (mismo patrón que `payments` / `enrollments`).
- **`UNIQUE NULLS NOT DISTINCT (school_id, greeting_year, child_id, user_id, unregistered_athlete_id)`** — la
  idempotencia de D4. `NULLS NOT DISTINCT` requiere PG15+; la base corre **17.6** (verificado con
  `current_setting('server_version')` — ojo que el `CLAUDE.md` del repo dice 15). Sin esa cláusula el UNIQUE es
  inútil, porque los NULL del XOR nunca colisionan entre sí.
- Índice `(school_id, greeting_year)` para el tablero.

**RLS de `birthday_greetings`:** es un log operativo → **deny all** a `authenticated` y `anon`; solo
`service_role` y las funciones `SECURITY DEFINER` escriben. Nada de `USING(true)`. Se revisa policy por policy y
se listan **todas** las de la tabla antes de cerrar (las policies son permisivas y se suman con `OR`).

**`notifications`:** sin cambios de esquema. Se usa `category='birthday'` y `data` poblado (`athlete_name`,
`school_name`, `sede_id`) porque el Modo Recepción arma la frase desde `data`, nunca parseando `message`.

## 6. Funciones

Las tres llevan `SET search_path = pg_catalog, public, pg_temp` (invariante I4) y `GRANT EXECUTE` explícito.

| función | tipo | quién la llama | alcance |
|---|---|---|---|
| `escuela_cumpleanos(p_school_id uuid, p_desde date, p_hasta date)` | SECURITY DEFINER, read-only | BFF con el token del usuario | valida `p_school_id = any(select user_staff_school_ids())` → **staff-only (D3)**. `GRANT EXECUTE TO authenticated` |
| `send_birthday_greetings()` | SECURITY DEFINER, escribe | **solo pg_cron** | sin `GRANT` a `authenticated`; revocar explícitamente de `authenticated` y `anon` (los default privileges del esquema otorgan EXECUTE a `authenticated` en toda función nueva — `REVOKE FROM PUBLIC` no alcanza) |
| `marcar_cumpleanos_saludado(p_school_id, p_athlete_ref, p_canal text)` | SECURITY DEFINER, escribe | BFF (saludo manual por WhatsApp) | valida `user_staff_school_ids()` |

`send_birthday_greetings()` devuelve `jsonb` con `run_date`, `sent`, `skipped_no_account`, `skipped_duplicate`,
`schools_enabled` — mismo contrato de reporte que `send_payment_reminders()`, para poder auditar la corrida.

**Zona horaria:** `(now() AT TIME ZONE 'America/Bogota')::date`, igual que los 9 crons existentes. Con
`now()::date` pelado, entre las 19:00 y medianoche de Bogotá el día en UTC ya cambió y se saluda un día antes.

## 7. Fases (una rama por fase, revisión entre cada una)

### F0 — Datos + RLS + RPC de consulta `[DB]`

Migración nueva vía `npm run migrations:new -- cumpleanos-datos-y-consulta`: columnas en `school_settings`,
tabla `birthday_greetings` con su UNIQUE y RLS deny-all, RPC `escuela_cumpleanos()`.
**No envía nada** — riesgo cero, se puede desplegar en cualquier momento.
Cierra con `npm run seguridad:invariantes` y con el listado de `pg_policies` de la tabla nueva.

### F1 — Tablero para el staff `[BFF/API + Front]`

- BFF: `GET /api/v1/schools/:id/birthdays?from=&to=` (pasa el token del usuario, **no** service role, para que el
  chequeo de staff aplique de verdad).
- Front: widget `BirthdaysCard.tsx` en `frontend/src/components/dashboard/` ("Hoy cumple…"), y vista de
  cumpleaños del mes en la gestión de atletas.
- Valor inmediato para el **100%** de los 878 atletas con fecha, sin depender de cuentas ni de push.

### F2 — Saludo automático `[DB + QA]`

Función de cron + job `send-birthday-greetings-daily` a las 13:00 UTC. Se despliega con **todas las escuelas
apagadas** (D7). Encender **una sola escuela real** primero, verificar la corrida contra `birthday_greetings` y
el push recibido, y solo entonces ofrecerlo al resto.
Depende de que el despachador unificado esté **vivo en producción** para el push; el canal in-app funciona ya.
Tests de concurrencia: dos corridas simultáneas del cron no deben duplicar (el UNIQUE es la prueba).

### F3 — Anuncio en Modo Recepción `[Front]`

Categoría `birthday` en `frontend/src/features/recepcion/config.ts`: confetti, mascota `'celebra'`, sonido y
plantilla de voz. Con `modo_voz='discreto'` solo nombre de pila, nunca apellido.
Idealmente dispara con el **ingreso por control de acceso** del cumpleañero, no a las 8am: celebrarlo cuando
cruza la puerta es el momento que la escuela quiere.

### F4 — Cobertura del 53% sin cuenta `[Full-stack]`

Los 590 atletas activos sin `user_id`/`parent_id` no reciben push. Plantilla de WhatsApp/correo para que el staff
salude en un clic desde el tablero, y `marcar_cumpleanos_saludado()` para que no quede colgado.
Ojo con lo ya aprendido: el correo masivo por Resend se corta a ~100 por el rate limit de 2/s (usar el bulk-send
del BFF), y el botón "Enviar WhatsApp" de Finanzas es hoy una **simulación** — no copiar ese patrón sin cablearlo.

### F5 — Auditoría + QA `[QA]`

Invariantes de seguridad, revisión de las policies de la tabla nueva, y verificación de que el saludo respeta
D2/D3 (ningún padre recibe el cumpleaños de un hijo ajeno).

## 8. Riesgos / gotchas

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | **Una sola Supabase para dev/stg/prod.** El cron es global: encenderlo manda mensajes a familias reales. | D7: toggle apagado por defecto, encendido escuela por escuela. Nunca un `UPDATE school_settings SET birthday_greetings_enabled = true` sin `WHERE`. |
| 2 | **7 grupos de identidades duplicadas** → dos saludos a la misma familia. | Deduplicar en la función antes de insertar; `status='skipped_duplicate'` deja el rastro. |
| 3 | Fechas basura de CSV/OCR (1900, futuro). | Filtro de edad plausible (2–100 años) en la función. |
| 4 | 29 de febrero. | D5: se saluda el 28. |
| 5 | Zona horaria: saludar un día antes. | `AT TIME ZONE 'America/Bogota'` en toda comparación de fecha. |
| 6 | El push a producción depende del go-live del despachador unificado. | F2 entrega valor por in-app aunque el push nativo llegue después. |
| 7 | **El padre no tiene cómo apagar los saludos** (las preferencias por categoría son F3 del despachador). | El toggle es por escuela. Documentarlo como limitación conocida, no venderlo como opt-out del usuario. |
| 8 | Un cumpleaños es dato sensible de un menor. | D3: staff-only, `user_staff_school_ids()`. Ninguna vista pública, ningún endpoint sin auth. |
| 9 | Helpers de RLS sin envolver en las policies nuevas. | Usar `(SELECT fn())` en el `USING`, no `fn()` pelado (un helper STABLE pelado se evalúa una vez por fila). |

## 9. Fuera de alcance (a propósito)

- Cumpleaños de **staff/coaches** (F4 opcional; el módulo arranca por atletas).
- Regalos, cupones o descuentos de cumpleaños. Toca precios y cobros: módulo aparte.
- Publicación en el perfil público de la escuela o en redes.
- Recordatorio anticipado ("cumple en 3 días") — se puede leer del tablero del mes; automatizarlo es otra
  decisión.

## 10. Aceptación

1. Un admin de escuela ve en su dashboard quién cumple hoy; un padre y un atleta **no** ven ese listado.
2. Con el toggle apagado, la corrida del cron no inserta ni una fila ni una notificación.
3. Con el toggle encendido en una escuela: el padre del menor recibe el saludo, el atleta adulto recibe el suyo,
   y los `unregistered` quedan como `skipped_no_account`.
4. Dos corridas del cron el mismo día dejan exactamente un saludo por atleta.
5. `npm run seguridad:invariantes` sale en verde.
