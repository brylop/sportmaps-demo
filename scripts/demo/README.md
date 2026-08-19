# Demos curadas — un motor, un catálogo por deporte

Cinco tenants de demostración con datos completos: sedes, categorías, tarifas, staff con
alcances, familias, cartera con mora, asistencia, **reservas de escenarios**, control de
acceso biométrico y un torneo. Todo `is_demo` / `account_type='demo'`.

```bash
node scripts/demo/seed.mjs --tenant=voleibol            # crear / actualizar (idempotente)
node scripts/demo/seed.mjs --tenant=crossfit --dry-run  # ensayo, no escribe nada
node scripts/demo/seed.mjs --tenant=box --verify        # solo el checklist
node scripts/demo/seed.mjs --tenant=futbol --only=club,staff
node scripts/demo/seed.mjs --tenant=patinaje --today=2026-08-12
```

**Contraseña de todas las cuentas:** `Demo2026!` · se re-escribe en cada corrida, así que si
alguien la cambia, basta volver a sembrar.

## Los tenants

| `--tenant` | Escuela | Arquetipo | Qué se muestra |
|---|---|---|---|
`voleibol` | Club Voleibol Altura Demo | 2 sedes, categorías por edad | El caso Dynasty: muchas familias, cartera y mora |
`futbol` | Academia Fútbol Horizonte Demo | 2 sedes, sub-8 a sub-17 | La academia formativa clásica + alquiler de canchas |
`patinaje` | Club Patinaje Veloz Demo | 1 sede, escuela chica | El cliente que llega de un cuaderno y WhatsApp |
`crossfit` | Box CrossFit Forja Demo | Membresías + clases con cupo | **Reservas y acceso como centro**, no como extra |
`box` | Escuela de Boxeo Titanes Demo | Grupos por nivel | Escuela de barrio que factura en efectivo |
`club-campestre` | Club Campestre Demo | Club social, 8 disciplinas | Multi-sede y volumen (ya existía) |

Volumen sembrado por tenant (medido en `--dry-run`, 2026-08-12):

| | voleibol | futbol | patinaje | crossfit | box |
|---|---|---|---|---|---|
Inscripciones | 33 | 34 | 19 | 19 | 20 |
Cobros | 172 | 177 | 103 | 99 | 104 |
Marcas de asistencia | 152 | 162 | 88 | 330 | 142 |
Reservas | 36 | 37 | 40 | 33 | 36 |

## Cómo está armado

- **`seed.mjs`** — el motor. Los ocho pasos (club, staff, branding, catálogo, cartera,
  asistencia, acceso, reservas, torneo) no saben de qué deporte se trata: leen el catálogo.
- **`catalogs/<tenant>.mjs`** — los datos de cada demo. Todos exportan la misma forma.
- **`catalogs/_comun.mjs`** — lo que no cambia entre tenants: mezcla de mora, métodos de
  pago y cómo se traducen a `payments`, bancos, motivos de cancelación, addons.

Se generó a partir de `scripts/demo-club-campestre/seed.mjs`, que ya estaba probado, en vez
de escribirlo de cero. Ese directorio sigue funcionando igual y produce el mismo tenant.

### Por qué es seguro re-ejecutarlo

1. **IDs deterministas.** `duid()` deriva cada UUID de un `sha1` del key, con el tenant en el
   namespace. Misma corrida = mismas filas, y dos demos nunca colisionan.
2. **Las bitácoras no se re-escriben.** Si ya hay `payments`, `attendance_records` o
   `access_events` de ese tenant, el paso se omite.
3. **Los crons quedan apagados** en `school_settings` (cobro automático, mora, recordatorios),
   para que ningún job nocturno mueva la cartera sembrada ni mande correos a los buzones
   falsos `@demo-*.sportmaps.co`.
4. **Nunca borra.** El rollback es manual.

### Aislamiento

Cada corrida toca solo el `school_id` derivado del tenant elegido. No lee ni escribe datos de
Dynasty, GYM RM ni de ninguna escuela real.

## Detalles que importan

- **`school_type = 'hybrid'` en las cinco.** No es cosmético: `has_reservations` se deriva del
  tipo de escuela, no del plan (`v_school_entitlements`). Con `academy` el módulo de Reservas
  queda invisible. Ver `20260813170814_mapeo_school_type_a_modulos.sql`.
- **MercadoPago queda fuera** de los addons a propósito: el token de MP de este entorno es de
  producción (`APP_USR-`), así que un cobro por MP sería un cobro real. Wompi sí está en sandbox.
- **Imágenes:** solo se usan ids de Unsplash verificados (HTTP 200) que ya usa
  `frontend/src/lib/sportImages.ts`. Patinaje y boxeo todavía no tienen foto propia y usan la
  genérica — inventar un id rompe la subida del logo al bucket.

## Agregar un deporte nuevo

Copiar un catálogo parecido, cambiar `CLUB`, `DISCIPLINAS` y la gente, y correr con
`--dry-run`. Dos reglas que el motor da por hechas:

- Un miembro de `STAFF` con `is_owner: true` (el dueño).
- En `ATHLETES`, uno con `autopay: true` (recibe el token de pago recurrente) y uno con
  `cuota_social: 'overdue'` + `zk_pin` (es el que aparece rechazado en la portería, que es
  el momento "wow" del control de acceso).

La suma de `fill` de las categorías infantiles no puede pasar de `FILLER_MINORS.length`, ni
la de las adultas de `FILLER_ADULTS.length`.
