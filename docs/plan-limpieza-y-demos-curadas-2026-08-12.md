# Plan — Limpiar las cuentas de prueba y dejar demos curadas por deporte

**Fecha:** 2026-08-12 · **Estado:** propuesta, sin ejecutar · **Alcance:** 42 de 364 escuelas

---

## 1. Lo que hay hoy

Inventario real (script de auditoría sobre la base viva):

| Grupo | Cuántas | Qué son |
|---|---|---|
**Demos con contenido de valor** | 4 | Club Campestre Demo, Escuela Demo SportMaps, Academia Fútbol Demo, Andrés Torres |
**Marcadas `demo` pero con plata y atletas** | 6 | ⚠ Hay que resolverlas antes de tocar nada — ver §2 |
**Basura pura** (0 atletas, 0 cobros, 0 equipos) | 22 | `pollitos`, `pruebasff`, `los pollitos dicenyy`, `López Romero` 1/2/3… |
**Cuentas nuestras marcadas `real`** | 8 | Se bloquean solas con el cron; 3 ya están bloqueadas |
**Caso aparte** | 1 | `Spirit Fontibon (Test)`: 0 atletas pero **403 miembros** |
**Multideporte sembrados** | 3 | SOLO MILLOS LOKA, Academia deportiva porras, escuela america… |

El problema de fondo no es que sobren escuelas: es que **`account_type` se está usando para dos cosas
distintas**. Hoy `demo` significa a la vez "tenant que muestro a un cliente" y "basura que dejé de una
prueba". Mientras eso siga mezclado, ni se puede limpiar sin miedo ni se puede confiar en una demo.

---

## 2. Primero lo que puede doler: escuelas `demo` que parecen clientes

Estas están marcadas `demo` — o sea **exentas del bloqueo y fuera de las métricas** — pero tienen
operación real adentro:

| Escuela | Atletas activos | Cobros | Recaudado | Señal |
|---|---|---|---|---|
`MMA BLAIR TEAM` | 17 | 361 | 7.202.258 | owner `jreyes@gmail.com` |
`ACADEMIA SUPERIOR BOGOTA` | 26 | 210 | 1.647.743 | **cobros manuales de marzo a julio** (transfer/efectivo) — alguien la usó de verdad |
`SOLO MILLOS LOKA` | 52 | 8 | 750.000 | 4 pagos por transferencia, feb-mar |
`Academia deportiva porras` | 51 | 5 | 362.500 | 6 equipos, 4 deportes |
`escuela america es mejor que…` | 50 | 0 | 0 | nombre de broma, pero 50 atletas cargados |
`NPC` | 2 | 13 | 2.630.000 | owner `spoortmaps+school@gmail.com` (nuestro) |

**Gate G-CLIENTE: nada se borra ni se re-siembra hasta clasificar estas seis.** Si alguna es un
cliente real, hoy está mal exenta del bloqueo y además no aparece en tus números de negocio.

---

## 3. Las tres categorías, bien separadas

`account_type` ya existe con los tres valores. Lo que falta es usarlos con un criterio:

| Valor | Significa | Régimen |
|---|---|---|
`real` | Cliente | Trial, aviso, bloqueo, entra en métricas |
`demo` | **Tenant curado de venta.** Se mantiene, se versiona y se puede reconstruir de cero | Nunca se bloquea, fuera de métricas, **no se borra** |
`test` | Cuenta desechable de QA | Nunca se bloquea, fuera de métricas, **se borra sin preguntar** |

La regla que resuelve el lío: **si no se puede reconstruir con un seed, no es una demo — es basura
con suerte.**

---

## 4. El set curado que propongo

No uno por deporte, sino uno por **arquetipo de operación**, porque lo que cambia el producto no es
el deporte sino cómo cobra y cómo agrupa. El deporte le pone la cara.

| # | Demo | Tipo | Deporte | Qué demuestra | Estado |
|---|---|---|---|---|---|
1 | **Club Campestre Demo** | club multideporte | 8 disciplinas como sedes | Multi-sede, aislamiento por disciplina, volumen (44 atletas, 29 equipos, 226 cobros) | ✅ existe y está bien |
2 | **Academia Fútbol Demo** | academy | Fútbol | Academia clásica con categorías por edad | ✅ existe, falta completarla |
3 | **Academia Voleibol Demo** | academy | Voleibol | El caso Dynasty: muchas familias, cartera, mora, recordatorios | 🆕 |
4 | **Escuela Patinaje Demo** | academy | Patinaje | Escuela chica recién llegada — el cliente que estás cerrando hoy | 🆕 |
5 | **Box/MMA Demo** | academy | Artes marciales | Cobro por sesiones y mensualidad, sin categorías por edad | 🆕 |
6 | **Andrés Torres** | personal_trainer | — | Entrenador individual, sin escuela | ✅ existe |
7 | *(opcional)* **Gimnasio Demo** | venue | — | Reservas + control de acceso, cuando arranque la Fase H | ⏸ |

**Cada una tiene que tener lo mismo**, o la demo se cae cuando el cliente pregunta:
sedes · equipos por categoría · planes en `offerings` **y** `offering_plans` · atletas con acudiente
· inscripciones activas · cobros en los tres estados (pagado / pendiente / vencido) · dos semanas de
asistencia · un comprobante por validar · un cobro con glosa.

### Identidad y convención

- Owner: `demo.<deporte>@sportmaps.co` — `demo.voleibol@`, `demo.patinaje@`, `demo.box@`.
- `account_type = 'demo'` **y** `is_demo = true`. Los dos: el mapa público filtra por `is_demo`,
  el bloqueo y las métricas por `account_type`.
- Nombre siempre termina en `Demo`. Sin excepciones — así se reconocen de un vistazo en el panel.

**Sobre `demo.escuela12@sportmaps.co`:** hoy solo es dueña de `pruebas demo`, que tiene 1 atleta y
nada más. Queda libre para reusarla como owner de una de las nuevas, o se borra. Ojo: es justo la
escuela que la memoria ya tenía marcada como el ejemplo de `is_demo` mal mantenido — se llama
"pruebas demo" y estaba en `account_type='real'`.

---

## 5. Fases

| Fase | Qué | Por qué en este orden |
|---|---|---|
**F0 — Clasificar** | Reclasificar las 42 en `real` / `demo` / `test`. Sin borrar nada. | Es reversible y desbloquea todo lo demás. Además arregla que 8 cuentas tuyas se estén bloqueando solas. |
**F1 — Resolver las 6 ambiguas** | Decidir una por una (§2). Si es cliente → `real` y entra al régimen de trial. | **Gate G-CLIENTE.** Es el único paso que no puedo resolver yo. |
**F2 — Seed versionado** | Extender `scripts/demo-club-campestre/` a `scripts/demo/` con catálogo por arquetipo y `seed.mjs --tenant <x>`. Idempotente + `rollback.sql`, igual que el que ya funciona. | Una demo que no se puede reconstruir no se puede limpiar. Este paso es el que convierte el borrado en algo sin riesgo. |
**F3 — Construir las 3 nuevas** | Voleibol, patinaje, box. Con el checklist completo de §4. | Ya con seed, es repetible. |
**F4 — Borrar la basura** | Las 22 vacías + las `test` que confirmes. Script con dry-run. | Al final, cuando ya no haga falta nada de ahí. |
**F5 — Que no se vuelva a ensuciar** | Registro con correo `@sportmaps.co` nace `test`; excluir `account_type<>'real'` de métricas y crons (F6 de la spec de trial). | Sin esto vuelves a tener 42 en tres meses. |

---

## 6. Cómo se borra sin romper nada (F4)

Hay gotchas ya documentados que hacen fallar el borrado a medias:

1. **Borrar `profiles` a mano ANTES** que el usuario de `auth`.
2. Referencias escondidas que no caen por cascada: **`school_staff.coach_auth_id`** y
   **`storage.objects.owner`**.
3. `Spirit Fontibon (Test)` tiene **403 miembros activos**: esos perfiles pueden pertenecer a otras
   escuelas. **No borrar la escuela sin revisar antes a quién pertenece cada perfil** — se borra la
   membresía, no la persona.
4. Nada de `DELETE` suelto: script con `--dry-run` que imprima qué va a borrar y cuántas filas
   dependientes arrastra, y recién después el `--apply`.

---

## 7. Lo que necesito de ti

1. **Las 6 ambiguas de §2** — ¿cliente o dato sembrado? Es el único bloqueante duro.
2. **El set de §4** — ¿voleibol, patinaje y box son los tres que quieres, o cambias alguno?
3. **`demo.escuela12@sportmaps.co`** — ¿la reusamos como owner de una demo nueva, o la borramos?
