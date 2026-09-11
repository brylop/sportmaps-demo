# Inscripciones sin monto, y los candados que faltan

Traspaso de contexto: esto salió investigando un riesgo del canal de WhatsApp y
**no tiene nada que ver con WhatsApp**. Se separa para trabajarlo aparte.

Todo medido contra la base viva el **2026-09-11**.

---

## 1. Qué se buscaba y qué se encontró

La pregunta era si el bot podía decirle "$0" a un padre. **No puede:** hay **0
pagos pendientes en cero** en Dynasty, porque el bot lee `payments` y esas filas
traen monto. Ese riesgo no existe.

Pero al medirlo aparecieron dos cosas que sí importan, y son problemas distintos.

### 1.1 Tres inscripciones activas sin monto en escuelas que cobran

El monto se resuelve por cascada `enrollments.monthly_fee → offering_plans.price →
teams.price_monthly` ([[project_athlete_fee_source]]). Con las tres fuentes vacías,
nadie le cobra a ese atleta.

| Escuela | Activas | Sin monto |
|---|---|---|
| DYNASTY VOLLEY CLUB | 505 | **1** |
| Dreamers Gymnastics | 7 | **1** |
| GYM RM | 122 | 0 (tiene 1 sin plan, pero con fee) |

El caso concreto de Dynasty: **JOSUE CORTES SAENZ**, MENORES MASCULINO,
inscripción `b3129268-d677-466d-ad57-5e11929768f3`, creada el **2026-09-07**,
activa, sin plan, y **0 pagos generados** en cuatro días.

### 1.2 Monster´s Volley Club — no es fuga, es una cuenta parada

`eb3ebc77-4ea4-4992-96c8-3c8ec574578c`, creada 2026-07-06, `is_demo = false`.

| | |
|---|---|
| Inscripciones activas | 126 (125 son **fichas** `unregistered_athlete_id`, 1 atleta adulto) |
| Equipos | 14 |
| Planes configurados | **1** |
| **Cuentas de pago** | **0** |
| `billing_enabled` | true (flag por defecto, nadie lo tocó) |
| `onboarding_status` | **completed** |
| Fichas con correo / teléfono | **125 / 125** |
| Fichas vinculadas a un perfil | **0** |
| **Fichas con invitación** | **0** |
| Invitaciones en toda la escuela | 5 (3 pendientes, 2 aceptadas) |
| Pagos históricos | 4 |

**Cargaron 125 atletas con contacto completo y no invitaron a ninguno.** Por eso
nadie se registró, nadie puede pagar y hay 4 pagos. No es que no cobren: no hay a
quién cobrarle. Llevan dos meses parados en el paso siguiente al que completaron.

Comparación útil: Dynasty mandó 396 invitaciones y hoy tiene 1.210 pagos.

**Hueco de producto detrás:** el wizard los dejó marcar `onboarding_status =
'completed'` con 0 cuentas de pago, 1 plan para 14 equipos y 0 invitaciones. Vale
revisar si más escuelas quedaron en ese estado — si el patrón se repite es
producto, no una cuenta suelta.

**Acción pendiente:** es una llamada comercial, no un fix. Tienen los 125 correos y
teléfonos listos y la invitación masiva ya existe.

---

## 2. Los candados que faltan

### 2.1 Por qué van en la base y no en el código

Hay **11 caminos que crean inscripciones**: ocho RPCs
(`accept_invitation_pro`, `claim_child_for_parent`, `enroll_student`,
`process_enrollment_checkout`, `submit_qr_signup__interno`,
`trial_class_create_booking`, `trial_class_public_create`,
`trial_class_self_create`), dos `INSERT` en `bff/src/routes/students.ts`
(~1110 y ~1189) y uno en `frontend/src/hooks/usePrograms.ts:78` — el frontend
escribiendo directo a la tabla.

Es el mismo patrón de [[project_payment_creation_paths_census]]. Validar en un
camino deja diez abiertos.

### 2.2 Candado A — equipo **u** oferta (aprobado)

`enrollments` tiene `team_id` **y** `offering_id`. Un `NOT NULL` en `team_id`
rompería el modelo de gimnasios: GYM RM tiene 121 activas por membresía y Besser
48. Reparto real: 620 solo equipo, 507 solo oferta, 615 ambos, y **29 con ninguno
de los dos (solo 2 activas)**.

```sql
ALTER TABLE public.enrollments
  ADD CONSTRAINT chk_enrollment_tiene_destino
  CHECK (team_id IS NOT NULL OR offering_id IS NOT NULL) NOT VALID;
```

`NOT VALID` a propósito: exige en todo INSERT/UPDATE de aquí en adelante por los
11 caminos, sin rechazar las 29 filas históricas. Validar del todo más adelante,
cuando se decida qué hacer con esas 29 (el usuario maneja las eliminaciones —
[[feedback_user_handles_deletions]]).

### 2.3 Candado B — monto resoluble, solo donde la escuela cobra de verdad

Va como **trigger**, no como CHECK: depende del estado de otras tablas.

> Si la escuela tiene `billing_enabled = true` **y** puede recibir dinero
> (`school_settings.payment_accounts` con al menos una, o fila habilitada en
> `school_payment_providers`), una inscripción **activa** no puede quedar sin
> monto resoluble en ninguna de las tres fuentes de la cascada.

**Las dos condiciones juntas son lo que evita bloquear mal.** Verificado contra
las 12 escuelas reales:

| Escuela | Flag cobra | Cuentas | Sin monto | Efecto de la regla |
|---|---|---|---|---|
| Monster´s | sí | **0** | 125 | **exenta** — no puede recibir dinero |
| Carmel Club | **no** | 1 | 35 | **exenta** — no cobra, y es correcto |
| Dreamers | sí | **0** | 1 | exenta |
| **DYNASTY** | sí | 3 | **1** | **protegida** |
| Spirit All Stars | sí | 2 | 0 | ya cumple (cobra por `monthly_fee`, sin planes) |
| GYM RM, Dojo Fénix, Felipe Rincón, Fit&Fight, Jhon Cruz, Mendieta, Original Boxing | sí | 1–4 | 0 | ya cumplen |

Hoy la regla **afecta a una sola escuela y a una sola fila**. Y se arma sola: el
día que Monster´s configure una cuenta y prenda el cobro, empieza a protegerlos —
y en ese momento van a estar poniendo precios de todos modos.

**Dos trampas de diseño ya descartadas:**

1. **No condicionar solo a `billing_enabled`.** Monster´s lo tiene en `true` sin
   haberlo tocado y con 0 cuentas; la regla los habría bloqueado por un default.
2. **No exigir "tiene plan".** Spirit All Stars cobra mensualidad directa con
   **0 planes configurados** y sus 99 activas están bien. Exigir plan les habría
   impedido operar.

**Riesgo a verificar antes de aplicar:** el trigger rechaza al crear la
inscripción activa. Si algún camino la crea activa y asigna el plan en un segundo
paso, se rompe. Existe `status='pending'` (7 filas en toda la base) que es el
estado correcto para un flujo de dos pasos. Hay que confirmar qué camino creó la
de Josue antes de aplicar — el trigger va a hacer ruidoso ese camino, que es bueno,
pero conviene saber cuál es primero.

---

## 3. Falsa alarma, para que nadie la repita

Conté 1024 inscripciones cuyo `child_id` no aparecía en `profiles` ni en
`unregistered_athletes` y parecían huérfanas. **No lo son:** `child_id` apunta a la
tabla **`children`**, y los 1216 resuelven ahí. Cero huérfanas.

Las tres tablas de atleta en `enrollments` son `child_id` → `children`,
`unregistered_athlete_id` → `unregistered_athletes`, y `user_id` → `profiles`
(atleta adulto auto-inscrito). Mirar solo una da un falso positivo enorme.

---

## 4. Estado

- [ ] Hablar con Monster´s Volley (invitación masiva; 125 contactos listos)
- [ ] Revisar si más escuelas quedaron `onboarding_status='completed'` sin cuentas de pago ni invitaciones
- [ ] Decidir qué hacer con la inscripción de Josue (Dynasty) y con la de Dreamers
- [ ] Decidir qué hacer con las 29 sin equipo ni oferta (2 activas)
- [ ] Confirmar qué camino crea inscripciones activas sin monto
- [ ] Escribir la migración de los dos candados (plan antes de código)
