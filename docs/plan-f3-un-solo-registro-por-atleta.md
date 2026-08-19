# Plan F3 — un solo registro por atleta

**Fecha:** 2026-08-12 · **Estado:** pendiente de aprobación (no se ha escrito SQL)
**Origen:** las 13 identidades duplicadas de Dynasty ($1.770.000/mes de riesgo) y los 3 acudientes
desenganchados que aparecieron el 12-ago (Giovanny Currea, Salome Lamprea, Darwin Hernandez).
**Detección:** [`scripts/audit-cobros-duplicados.mjs`](../scripts/audit-cobros-duplicados.mjs) (ejes B y C)
y [`scripts/audit-acudientes-desenganchados.mjs`](../scripts/audit-acudientes-desenganchados.mjs).

> **Lo primero: buena parte de F3 ya está construida.** Antes de planear nada nuevo hay que saber qué
> existe, porque el error de arranque fue asumir que había que construir un matcher desde cero.

---

## 1. Qué ya existe y funciona

| Pieza | Qué hace | Dónde |
|---|---|---|
| `normalize_doc_number()` | Compara documentos sin puntos ni espacios | [20260730195052](../supabase/migrations/20260730195052_qr_signup_match_by_document.sql) |
| `find_athletes_by_document()` | Búsqueda **global** por documento (todas las escuelas) | idem |
| `claim_children_by_document()` | Vincula al acudiente con los atletas que elija | idem |
| `claim_orphan_children()` | Adopta hijos huérfanos cuyo `parent_email_temp` = su correo, y **también sus cobros** | [20260729000002](../supabase/migrations/20260729000002_claim_orphan_children_by_email.sql) + [20260730183000](../supabase/migrations/20260730183000_claim_orphan_children_backfills_payments.sql) |
| `submit_qr_signup()` | Antes del INSERT **busca por documento**; si existe, reutiliza | [20260730195052](../supabase/migrations/20260730195052_qr_signup_match_by_document.sql) |
| `accept_invitation_pro()` | Adopta la ficha precargada al aceptar la invitación | [20260730231131](../supabase/migrations/20260730231131_fix_accept_invitation_pro_offering_dedup_and_payment_cancel_scope.sql) |
| `uq_children_doc_dynasty` | Índice único de documento — **solo en Dynasty** | — |

**Conclusión:** el flujo por QR y el de invitación ya están cubiertos. F3 no es construir un matcher:
es **cerrar la puerta que quedó sin chequeo** y **dejar de depender de que el acudiente llegue al
dashboard**.

---

## 2. Las cinco puertas por donde nace una identidad

| # | Puerta | Chequeo hoy | Estado |
|---|---|---|---|
| 1 | `submit_qr_signup` (QR público) | documento exacto + nombre | ❌ **ABIERTA — corregido el 12-ago, ver §2.bis** |
| 2 | `accept_invitation_pro` (link de invitación) | la invitación apunta a la ficha | ✅ cubierta |
| 3 | `claim_orphan_children` (al entrar al dashboard) | correo exacto, con `trim` | ⚠️ parcial — §3.2 |
| 4 | `claim_children_by_document` | documento, elige el acudiente | ⚠️ solo se invoca desde el flujo QR |
| 5 | **`AddChildDialog` → `parentsAPI.addChild`** | **ninguno** | ❌ **abierta** |

## 2.bis · La puerta #1 NO estaba cubierta (hallazgo del 12-ago)

Este plan daba `submit_qr_signup` por ✅ porque "busca por documento antes del INSERT". Lo hace —
pero **en el caso más común ese chequeo es inalcanzable**. La RPC tiene tres capas:

```sql
(a) match por documento   IF v_doc IS NOT NULL THEN …   -- sin documento, se salta ENTERA
(b) match por nombre      WHERE school_id = … AND parent_id = v_user_id
                                                        -- solo hijos que YA son de esa cuenta;
                                                        -- la ficha pre-cargada tiene parent_id NULL
(c) INSERT de cero        ← cae siempre acá
```

La capa (b), que debería atrapar justo el caso sin documento, filtra por `parent_id = v_user_id` —
y la ficha que la escuela pre-cargó, por definición, todavía no es de ese acudiente. **Nunca la
encuentra.** Papá escanea el QR y no teclea documento → ficha nueva, garantizado. No es una carrera:
es determinístico.

Los 4 duplicados del 10 al 12 de agosto lo confirman: tres entraron **sin documento** y Jefferson lo
tecleó con dos dígitos cambiados. En los cuatro, la cuenta se creó, la ficha 4-6 segundos después y
la inscripción en el mismo segundo — es el auto-registro, no el alta manual.

**Corregido en [`20260812183012_qr_signup_adopta_ficha_precargada`](../supabase/migrations/20260812183012_qr_signup_adopta_ficha_precargada.sql)**: la capa (b) busca en toda la escuela por
nombre normalizado (`normalize_athlete_name`, nueva), adopta solo fichas **libres** y exige que la
fecha de nacimiento coincida cuando ambas la tienen. Si el nombre coincide con la ficha de otro
acudiente, no adopta y crea la suya — un homónimo no se resuelve adivinando.

La #5 es un `INSERT INTO children` crudo desde el cliente
([parents.ts:83-95](../frontend/src/lib/api/parents.ts#L83-L95)), sin pasar por RPC ni validar
documento. Es la ruta de «Vincular Hijo» del onboarding del acudiente, o sea la que usa el papá que
entra por su cuenta en vez de por la invitación.

---

## 3. Los dos problemas, que NO son el mismo

Confundirlos fue el error de arranque: tienen causas distintas y arreglos distintos.

### 3.1 · Fichas DUPLICADAS (las 13 fusiones)

El acudiente crea una ficha de un atleta que la escuela ya tenía precargado. Nacen dos fichas y
**ambas son facturables**.

**Evidencia medida sobre las 13 de Dynasty:**

| Señal | Resultado |
|---|---|
| Correo del acudiente **distinto** entre las dos fichas | **9 de 13** → el correo NO sirve para unirlas |
| **Misma** fecha de nacimiento | **11 de 13** → es la señal más fuerte |
| Documento con 1–2 dígitos de diferencia | 5 casos |
| Documento completamente distinto | 4 casos |
| Documento en una sola de las dos fichas | 2 casos |

Ejemplos que explican por qué el índice único de documento no los frenó:

```
Anaisabel Mondragón    1122651393  vs  1122651373     un dígito (9→7)
Sergio Herrera         122205756   vs  1222205756     falta un dígito (9 vs 10)
Ramírez Medina         1141375184  vs  1141335184     un dígito (7→3)
jefferson rojas        1030595277  vs  1030595288     dos dígitos
Julieta Mayorga        10112109601 vs  1011210629     11 dígitos = inválido
```

Y los correos casi idénticos, que es lo que hace inútil el match exacto:

```
ggilnavarro@gmail.com   vs  gglnavarro@gmail.com      falta una 'i'
marcianap@hotmail.com   vs  marcianapv@hotmail.com    sobra una 'v'
iforero52@gmail.com     vs  lforero52@gmail.com       'i' contra 'l'
```

### 3.2 · Fichas HUÉRFANAS (los 3 acudientes desenganchados)

Distinto: acá **no hay ficha duplicada**. La ficha precargada queda con `parent_id` NULL y el
acudiente no la ve ni puede pagarla (el guard anti-IDOR del checkout le responde 403).

`claim_orphan_children()` **ya resuelve esto** y está cableada en
[DashboardPage.tsx:166](../frontend/src/pages/DashboardPage.tsx#L166) con `p_school_id: null`.
El problema es **cuándo** corre: solo si el acudiente inicia sesión y llega al dashboard.

**Evidencia:** de los 3 casos, dos nunca volvieron a entrar después del registro —
`last_sign_in_at` a **0 segundos** de `created_at`, o sea solo el auto-login del signup:

| Acudiente | Δ entre registro y último login |
|---|---|
| `lvergelportillo@gmail.com` (Salome Lamprea) | **0 s** → nunca volvió |
| `wislod31@gmail.com` (Darwin Hernandez) | **0 s** → nunca volvió |
| `curreagiova@hotmail.com` (Giovanny) | entró recién cuando se le asignó contraseña |

En Giovanny la cadena completa fue: **no podía entrar → nunca llegó al dashboard → nunca se adoptó la
ficha → no veía a su hija → no podía pagar.** Un problema de contraseña terminó pareciendo un
problema de datos.

---

## 4. Fases

### F3.0 · Cerrar la puerta #5 — sin migración

`AddChildDialog` deja de hacer `INSERT` directo y pasa por un RPC que, antes de crear, busca si ese
atleta ya existe en la escuela. Reusa `find_athletes_by_document()`, que ya está construida y probada.

Si hay coincidencia **exacta de documento**, no crea: ofrece vincular (que es lo que ya hace
`claim_children_by_document`). Es el mismo comportamiento del QR, llevado al flujo normal.

**Es lo más barato y cierra el agujero por donde entraron las 13.**

### F3.1 · La adopción deja de depender del cliente — migración

Hoy `claim_orphan_children()` corre desde el navegador. Los acudientes que se registran y no vuelven
quedan huérfanos para siempre.

Moverla al servidor: dispararla al crear el perfil (trigger `AFTER INSERT ON profiles`, o dentro del
flujo de signup del BFF). Así el acudiente queda enganchado **aunque nunca entre**.

Con esto, los 3 casos de hoy se habrían resuelto solos.

### F3.2 · Casi-duplicados: avisar, nunca fusionar solo — migración

Los 9 con correo distinto y documento con typo **no** los agarra ninguna coincidencia exacta. Hace
falta detección con tolerancia, y la heurística ya está escrita y validada en
[`scripts/lib/athlete-identity.mjs`](../scripts/lib/athlete-identity.mjs): documento con distancia
≤ 2, nombre por subconjunto de tokens, fecha de nacimiento, correo del acudiente casi igual.

**Regla dura: un casi-duplicado NUNCA se fusiona automáticamente.** Se le muestra al acudiente
«¿es este tu hijo?» y decide él, o se le avisa a la escuela. El motivo está medido: Gabriela y
**Juliana** Simbaqueva comparten fecha de nacimiento y tienen documentos consecutivos —son gemelas, y
fusionarlas sería un error. Lo mismo con María Camila Valderrama, donde todavía no se sabe si es una
niña o dos.

### F3.3 · Índice único de documento en todas las escuelas — migración

Hoy `uq_children_doc_dynasty` cubre **una sola** escuela. Extenderlo requiere **preflight
obligatorio**: si ya hay duplicados exactos, el `CREATE UNIQUE INDEX` falla con un `23505` críptico.
Es el mismo orden que exigieron los índices de F0.

Ojo: `find_athletes_by_document()` es **global** a propósito, porque 51 documentos de la base están en
dos escuelas distintas (el mismo chico en dos clubes). El índice tiene que ser **por escuela**, no
global.

---

## 4.bis · Validación contra la base (2026-08-12)

Se verificaron las premisas de este plan contra la base viva. Tres resultados cambian el alcance.

### 🔴 SEG · `find_athletes_by_document` filtra datos de menores a cualquiera

**Sin autenticar**, con solo la llave `anon` —que va pública en el bundle del frontend— y un número de
documento, la RPC devuelve la ficha completa del menor:

```
POST /rest/v1/rpc/find_athletes_by_document   {"p_doc_number":"<documento de una menor>"}
→ HTTP 200
  full_name, date_of_birth, school_id, school_name, team_id, team_name, branch_name
```

Probado una vez, en lectura, con el documento de una menor de Dynasty: devolvió nombre completo,
fecha de nacimiento, escuela, equipo y sede. Los documentos de menores en Colombia son
**enumerables**, así que esto permite barrer datos personales de menores a escala.

El linter de Supabase ya lo había marcado —está en la salida embebida en
[20260503000007](../supabase/migrations/20260503000007_security_invoker_views.sql#L1337), aunque
apuntando a `claim_child_for_parent`— y sigue abierto.

Las otras dos RPCs alcanzables por `anon` **sí se autoprotegen**: `claim_child_for_parent` responde
`status_code: "no_auth"` y `claim_orphan_children` devuelve `0` cuando `auth.uid()` es NULL.

**Esto salta la cola: es exposición de datos de menores, no una mejora de facturación.** El arreglo es
revocar `EXECUTE` a `anon` y exigir sesión, o devolver solo un booleano «existe / no existe» al
público y el detalle solo al autenticado. Ojo: el flujo por QR y el de `plan_join` la usan
**antes** de que el acudiente tenga cuenta, así que revocarla en seco puede romperlos — hay que
revisar esos dos caminos primero.

### ✅ Las 8 piezas existen en la base

Verificado contra el catálogo que expone PostgREST (327 RPCs). Un primer intento las llamó sin
argumentos y PostgREST respondió «función no encontrada» para tres de ellas — **falso negativo**, la
resolución es por nombre de parámetro. Ninguna hay que reconstruirla.

Y aparecieron cuatro piezas más que este plan no tenía en el mapa:

| RPC | Qué es |
|---|---|
| `validate_doc_for_plan_join(p_doc_number, p_plan_id)` | Valida que exista un atleta con inscripción activa a ese plan |
| `claim_member_for_plan(p_child_id, p_full_name, p_phone, p_plan_id, p_role)` | Vincula el perfil al child y crea el `school_members` |
| `claim_child_for_parent(p_child_id, p_full_name, p_phone)` | ⚠️ **deriva:** ninguna migración la crea |
| `migrate_unregistered_athlete_to_profile(...)` | ⚠️ **deriva:** ninguna migración la crea |

Las dos primeras son de [20260428000001](../supabase/migrations/20260428000001_plan_join_rpcs.sql) y son
**el flujo completo que F3.0 iba a construir**: documento → validar → registrarse → vincular. Antes de
escribir F3.0 hay que ver si se puede reusar tal cual en vez de duplicar la lógica.

Las dos últimas existen en la base y **el repo no las crea**: son parte de la deriva de esquema
(`npm run migrations:drift`).

### F3.3 es casi gratis — una sola colisión

Preflight sobre 847 fichas: **una** colisión de documento dentro de la misma escuela.

```
SPIRIT ALL STARS   doc 1016092607 ×2   →   Sara Sánchez | Silvana Sánchez
```

Nombres distintos con el mismo documento: es el patrón `DOC_REPETIDO` que la heurística marca como
«no fusionar sin revisar» — le digitaron el documento de la hermana a una de las dos. Hay que
corregirlo antes del `CREATE UNIQUE INDEX` o falla con `23505`.

Y se confirmaron **51 documentos en dos escuelas distintas**, el mismo número que decía la migración
del 31-jul: el índice tiene que ser **por escuela**, nunca global.

### D2 se responde solo: el documento hoy no es confiable

| Longitud | Fichas | |
|---|---|---|
| 5 dígitos | **50** | ⚠️ imposible |
| 7–9 | 40 | plausible (cédulas viejas) |
| 10 | 675 | normal |
| 11–15 | **23** | ⚠️ imposible |

**73 de 788 documentos son inválidos**, y 59 fichas no tienen documento (29 de ellas en
`Club Campestre Demo`). Exigir documento sin validar la longitud no sirve de nada: el matcher va a
fallar o a emparejar mal en esas 73. **D2 y la validación de formato son la misma decisión.**

---

## 5. Decisiones que bloquean el arranque

| # | Decisión | Por qué bloquea |
|---|---|---|
| **D1** | Ante un casi-duplicado, ¿el guard **bloquea** la creación, o **crea y avisa** a la escuela? | Bloquear frustra al acudiente si el matcher se equivoca (gemelas); crear y avisar deja pasar el duplicado. Define toda la UX de F3.0 y F3.2 |
| **D2** | ¿El documento es **obligatorio** al crear la ficha? | Sin documento el matcher cae a nombre + fecha, que es más débil. Hoy hay fichas sin documento |
| **D3** | ¿Quién resuelve el casi-duplicado: el **acudiente** eligiendo, o la **escuela** desde su panel? | Cambia dónde vive la UI |
| **D4** | El índice único de documento, ¿se extiende a **todas** las escuelas? | Requiere limpiar duplicados exactos antes, y decidir qué hacer con los documentos inválidos (hay uno de 11 dígitos) |
| **D5** | F3.1 como **trigger** en `profiles` o dentro del flujo de signup del BFF | Un trigger es cómodo y difícil de deshacer; el BFF es explícito pero solo cubre su propia ruta |

---

## 6. Lo que NO entra en F3

- **Fusionar las 13 identidades que ya existen.** Es corrección de datos y va por
  [`plan-fusion-identidades-duplicadas.md`](plan-fusion-identidades-duplicadas.md). F3 solo evita las
  próximas.
- **Los 195 acudientes de Dynasty sin cuenta** ($21,5M en cobros impagables). No es un problema de
  integridad: hay que que la familia se registre o que la escuela cobre por fuera.
- **El patrón child + adult** (Darwin Hernandez, Oscar Baquero, Esteban Herrera): atletas adultos
  cargados como menores. Es un modelo de datos distinto y merece su propio tratamiento.

---

## 7. Orden sugerido

**SEG primero, y no es negociable:** `find_athletes_by_document` expone datos de menores a cualquiera
con la llave pública y un documento. Eso no es una mejora de facturación pendiente, es exposición de
datos personales de menores, y va antes que todo lo demás de este plan. Requiere revisar primero los
dos flujos que la usan sin sesión (QR y `plan_join`) para no romperlos al cerrarla.

Después **F3.0** — no lleva migración, cierra la única puerta abierta (`AddChildDialog`) y **antes hay
que leer `validate_doc_for_plan_join` + `claim_member_for_plan`**, que probablemente ya hacen lo que
iba a construir.

Después **F3.1**, que es la que habría evitado los 3 casos del 12-ago sin que nadie hiciera nada:
mover la adopción del navegador al servidor.

**F3.3** quedó barata: una sola colisión que arreglar (Spirit All Stars).

**F3.2** es la última y la más delicada, porque es la que puede fusionar dos personas distintas por
error.

Nada de F3 se escribe hasta que estén contestadas **D1** y **D2**. SEG no depende de ninguna decisión.
