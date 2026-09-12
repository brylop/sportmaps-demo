# Identidad de atleta: cómo dejamos de adivinar quién es quién

**Estado:** propuesta, sin aprobar. Nada de esto está implementado.
**Fecha:** 2026-09-09. **Autor:** brylop.

## El problema en una frase

Un atleta se puede crear con solo un nombre, así que el sistema termina
adivinando por texto si dos filas son la misma persona. Todo lo que blindamos
el 2026-09-09 —el trigger de alta duplicada, la adopción por nombre
normalizado, la validación del diálogo— son parches sobre esa ausencia.

Los tres incidentes de ese día lo muestran, y ninguno fue un bug de código:

| Caso | Qué pasó | Qué lo habría evitado |
|---|---|---|
| Jacobo Sánchez Velásquez | La invitación decía el nombre sin tildes y el papá lo escribió con tildes: la adopción no lo encontró y le creó una ficha nueva | Llave por documento |
| Nathan Ramírez | La invitación decía «Nathan Ramirez», el papá escribió «Nathan Ramírez Montilla» | Llave por documento |
| Edinson Samboni | Se registró con un correo distinto al invitado; la RPC exige igualdad de correo, así que su cuenta nunca se vincularía | Token en el link |

Y un cuarto que no es de nombres sino de datos: **Juliana Otero** existe dos
veces en Besser porque una fila se creó sin documento, sin fecha de nacimiento
y sin acudiente. Con documento obligatorio esa fila no habría podido nacer.

## Pieza 1 — Token en el link de invitación

### Hoy

`accept_invitation_pro` valida así:

```sql
WHERE id = p_invite_id
  AND (email IS NULL OR LOWER(TRIM(email)) = v_user_email)
  AND status = 'pending'
```

El `invite_id` viaja en el link, pero la autorización real la da **la igualdad
de correo**. Consecuencias:

- Si el acudiente se registra con otro correo, queda bloqueado para siempre y
  el sistema lo reporta como «no se ha registrado» — un falso negativo que
  solo se descubre cruzando nombres a mano.
- El `invite_id` es un UUID que va en la URL, así que hoy **es** un secreto de
  facto, pero no se trata como tal: no expira, no se invalida al usarse, y la
  comprobación de correo es lo único que impide que otro lo use.

### Propuesta

Un `invite_token` aleatorio por invitación, que viaje en el link y sea lo que
autoriza. El correo pasa de ser requisito a ser dato de contacto.

- La aceptación deja de depender de con qué correo se registró la persona.
- El token se invalida al aceptarse.
- Se puede revocar y reemitir sin tocar la identidad del acudiente.

### Lo que hay que decidir

- **¿Expira?** Hoy `expires_at` existe y no se valida (está documentado como
  decorativo). Si el token expira de verdad, hace falta un camino de reemisión
  autoservicio o la academia va a tener que reenviar a mano.
- **¿Qué pasa con las 800+ invitaciones ya enviadas?** El link viejo trae el
  `invite_id`. Habría que aceptar ambos esquemas por un tiempo, o reemitir.
  Reemitir a 456 acudientes pendientes es una campaña de correo, no un deploy.

## Pieza 2 — El documento como llave de identidad

### Estado actual, medido el 2026-09-09

| | |
|---|---|
| Atletas totales (`children` + `unregistered_athletes` con escuela) | 1.420 |
| **Sin documento** | **130 (9,2%)**, repartidos en 25 de 37 escuelas |
| **Documentos repetidos dentro de una misma escuela** | **7** |

Para poder crear `UNIQUE (school_id, documento_normalizado)` hay que resolver
esas 7 colisiones y rellenar 130 fichas. La base no es el problema.

### El problema real es operativo

Tres caminos permiten hoy crear un atleta sin documento, y son los que las
escuelas más usan:

- **Carga masiva CSV** — el documento es requerido por el importador, pero la
  ruta acepta filas sin él por otras vías.
- **Alta rápida de staff** (`createStudentWithPendingPayment`) — el documento
  se agregó el 2026-09-09 pero es opcional.
- **`ChildSelectorModal`** — el acudiente crea al hijo durante el checkout con
  nombre y fecha de nacimiento; pedirle el documento ahí es fricción en el
  momento de pagar, que es el peor momento para agregar fricción.

Volverlo obligatorio de golpe rompe la operación de 25 escuelas.

### Rollout propuesto, en tres tiempos

1. **Obligatorio para altas nuevas por los caminos de staff**, donde el dato
   está a mano (la escuela tiene la matrícula del chico). Sin tocar el
   histórico ni el checkout del acudiente.
2. **Campaña de relleno de los 130**, con un listado por escuela. Es un dato
   que las academias tienen en papel; el trabajo es de ellas, no nuestro.
3. **`UNIQUE` en la base** recién cuando el conteo llegue a cero. Antes de eso
   la constraint no se puede crear.

En el checkout del acudiente yo **no** lo haría obligatorio: ahí el dato
importa menos que el pago, y el guard por nombre que ya existe cubre el caso
frecuente (que el hijo ya esté cargado por la academia).

### Alternativa más barata, si el rollout completo no se quiere

Un `UNIQUE` parcial `WHERE documento IS NOT NULL`. No obliga a nadie, pero
garantiza que **cuando hay documento, no se repite**. Cubre el 90,8% de los
atletas desde el día uno y no rompe ninguna operación. Requiere resolver solo
las 7 colisiones.

Es, con diferencia, la mejor relación valor/riesgo de todo este documento.

## Pieza 3 — La 'ñ' en el normalizador

`normalize_athlete_name` colapsa `ñ → n`, así que **PEÑA y PENA normalizan
igual**. Son apellidos distintos.

Hoy eso produce **1 solo par** en toda la plataforma, así que no es urgente.
Pero la regla correcta depende del uso:

- Para **buscar y sugerir** coincidencias, colapsar está bien: ayuda a
  encontrar a quien tecleó mal.
- Para **bloquear** un alta, es discutible: un falso positivo frena a una
  familia legítima, y el mensaje le dice que acepte una invitación que no es
  suya.

Propuesta: dos funciones con nombres honestos —una laxa para sugerir, una
estricta para bloquear— en vez de una sola que hace de las dos cosas a medias.
No antes de que aparezca el segundo caso real.

## Lo que ya quedó hecho (para no repetirlo)

- `normalize_athlete_name` a prueba de NFD (migración `20260909215903`): antes
  fallaba con los nombres que producen los teclados de iOS y macOS, y el
  frontend y la base discrepaban.
- Trigger `trg_guard_alta_manual_hijo_duplicado` sobre `children`, con la
  exención por bandera de sesión para `accept_invitation_pro`.
- Deduplicación contra `children` **y** `unregistered_athletes` en el alta de
  staff, con salida explícita para el homónimo real.

## Orden recomendado

1. **`UNIQUE` parcial por documento** — resolver 7 colisiones y crearlo. Es
   una tarde y no le cambia el día a nadie.
2. **Token en el link** — cierra el modo de falla del correo, que es el único
   que deja a una familia bloqueada sin que nadie se entere.
3. **Documento obligatorio en los caminos de staff** — cuando haya apetito de
   pelear con la operación.
4. **Las dos funciones de normalización** — cuando aparezca el segundo PEÑA.
