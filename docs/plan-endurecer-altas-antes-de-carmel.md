# Que Carmel no repita lo de Dynasty

**Fecha:** 2026-08-17 · **Fecha externa:** 19-ago-2026, inicio de pruebas de Club Carmel
(~800 deportistas, 8 disciplinas). **Dos días.**

Dynasty tiene 515 atletas y llegamos a 6 personas duplicadas, 205 sin acudiente y 52 adultos
modelados como menores. Carmel entra con **800 de golpe**. Si el alta se comporta igual, no
entran 6 duplicados: entran proporcionalmente más, y encima el primer día.

---

## 1. Por qué hay duplicados — hay UNA causa, no varias

Miré los seis pares de Dynasty uno por uno. El patrón no falla:

| Persona | Ficha vieja (6-jul) | Ficha nueva |
|---|---|---|
| Anaisabel Mondragón | doc `1122651373` · correo `gglnavarro@` | doc `1122651393` · correo `ggilnavarro@` |
| Jefferson Rojas | doc `1030595288` | doc `1030595277` |
| Valentina Barreto | doc `141717990` (9 dígitos) | doc `1141717990` (10) |
| Gabriela Buitrago | doc `1018475529` | doc `1016020710` |
| Luis A. Parra | doc **NULL** · correo `17@hotmail.com` | doc `1013121770` |
| Gabriela Simbaqueva | doc **NULL** | doc `1013019363` |

**El documento está mal tecleado en los seis.** Un dígito de diferencia (`373`→`393`,
`5288`→`5277`), un dígito de menos (`141717990` sin el 1 inicial), o directamente vacío. El correo
también: `gglnavarro` vs `ggilnavarro`, y un `17@hotmail.com` que es basura.

**Y las fechas cuentan el resto de la historia.** Las seis fichas viejas se crearon el **6 de julio
entre 14:48 y 14:51** — tres minutos: es la carga masiva inicial. Las nuevas son de julio 30 a
agosto 11, una por una, cuando la familia llegó de verdad.

Entonces la secuencia es siempre la misma:

1. La escuela sube su base en bloque, con documentos tecleados a mano y sin acudiente.
2. Semanas después la familia entra por invitación o alta individual, con el documento **bien**.
3. El guard de duplicados compara documentos, **no coinciden porque uno está mal**, y crea otra ficha.
4. La vieja queda huérfana: sin acudiente, sin asistencias, con sus cobros anulados.

Caso extremo: Gabriela Simbaqueva, dos fichas el **mismo día con 36 minutos de diferencia** (08:42
sin documento y sin acudiente → 09:18 con los dos). Ahí ni siquiera hubo semanas de por medio.

### Lo que la base permite hoy

```
Índices sobre doc_number ......... 1   (no único)
Constraints UNIQUE en children ... 0
Documentos repetidos ............. 0   ← solo porque los typos los hacen distintos
Sin documento .................... 6
Documento de largo inválido ...... 1
```

**No hay ninguna restricción.** El guard vive en el cliente (`CreateChildModal`) y solo corre si
escriben el documento. Con 800 altas, eso no aguanta.

---

## 2. Qué hacer antes del 19 — por orden de impacto

### P0 · Normalizar y comparar por más de un campo (medio día)

El documento no sirve solo, porque **el error está en el documento**. Al dar de alta hay que
buscar coincidencia por tres vías y avisar si alguna pega:

- **Documento normalizado** — sin puntos, espacios ni guiones, y con validación de longitud
  (6 a 11 dígitos). `141717990` vs `1141717990` sigue sin pegar, pero `1.122.651.373` vs
  `1122651373` sí.
- **Nombre normalizado + fecha de nacimiento.** Ésta es la que habría cazado los seis: en los seis
  pares la fecha de nacimiento es **idéntica**. Es el campo que nadie teclea mal dos veces igual.
- **Teléfono o correo del acudiente**, normalizados.

No bloquear: **mostrar el candidato y hacer que la escuela confirme** «es otra persona» o «es la
misma». Bloquear con 800 altas genera un rodeo peor que el duplicado.

Y esto va en el **BFF**, no en el modal: hoy la carga masiva no pasa por el guard del cliente.

### P0 · Que la carga masiva exija acudiente o documento (medio día)

Las seis fichas viejas entraron **sin acudiente**. Con 205 de 515 en esa condición en Dynasty, el
problema no es marginal: es una de cada tres familias que nunca va a ver nada.

Para Carmel: el archivo de carga tiene que traer **correo o teléfono del acudiente** por fila, y el
importador rechaza la fila que no lo traiga en vez de crear una ficha huérfana. Es más molesto
antes y muchísimo más barato después.

### P1 · La invitación tiene que decir QUÉ es cada quien (1 día)

Hoy `children` + `parent_id` es el único modelo, y por eso hay **52 mayores de edad activos** como
menores y **28 casos donde el acudiente es la misma persona que el atleta** — el adulto se
registró como su propio acudiente porque no había otra forma.

La invitación debería resolver esto en el origen, con la fecha de nacimiento que la escuela ya
carga:

| Edad del atleta | A quién se invita | Qué se crea |
|---|---|---|
| Menor | al **acudiente** | `children` + `parent_id` |
| Mayor | al **atleta** | perfil `athlete` con `user_id`, sin acudiente ficticio |

El caso Yuri Nicoll Díaz muestra el costo de no hacerlo: el perfil del acudiente se llama «Yuri
Nicoll Díaz Santamaría» con el correo de la mamá (`estelasantamaria55@`). No se sabe si es la madre
o la hija.

### P1 · Notificar por HITO, no por clase (1 día)

**Hoy no llega ninguna notificación de asistencia.** Verificado: no existe el tipo `attendance` en
`notifications`, no hay código que la emita en `attendance.ts`, y ningún job mira `sessions_used`
ni `max_sessions`. Cero.

Notificar cada clase sería ruido — 800 atletas × 3 clases por semana son 2.400 avisos semanales que
nadie lee. Lo que sirve es el **hito**, que es además el que deja constancia:

| Cuándo | A quién | Para qué |
|---|---|---|
| Al consumir la **última clase** del plan | familia + escuela | «te queda 0 de 8» — el aviso llega ANTES del conflicto |
| Al **pasarse** del tope | familia + escuela | queda registro de que se avisó |
| Al **vencer** el plan con asistencia posterior | familia + escuela | idem |

**Ese registro es el punto.** Si la familia reclama «nadie me dijo», la notificación con fecha y el
detalle de las clases es la respuesta. Sin eso, la escuela discute de memoria contra un papá que
también recuerda de memoria — y pierde.

Se apoya en lo que ya existe: la pestaña «Plan vs consumo» ya calcula los tres estados y el
despachador de notificaciones ya está construido y validado.

---

## 3. Lo que NO da tiempo antes del 19

- **La fusión de las 6 identidades duplicadas de Dynasty.** Sus fichas muertas tienen 5 pagos
  (todos `cancelled`, sin plata real) y 9 inscripciones colgando, y `payments.child_id` es
  `ON DELETE RESTRICT`: hay que mover antes de borrar. Va después de Carmel.
- **Separar inscripción de período de plan.** Es el arreglo de fondo
  (`docs/specs/inscripcion-vs-periodo-de-plan.md`), pero son 5 fases y toca los créditos. Meterlo a
  dos días de una demo con 800 atletas sería el error más caro de todos.
- **Migrar los 52 adultos** de `children` a atleta adulto. Necesita la fusión primero.

---

## 4. El resumen para decidir

Si solo hay tiempo para una cosa, es **comparar por nombre + fecha de nacimiento al dar de alta**.
Es la única regla que habría cazado los seis casos de Dynasty, porque es el único campo que nadie
teclea distinto dos veces.

Si hay tiempo para dos, la segunda es **exigir acudiente en la carga masiva** — que es lo que
convierte a 205 familias de Dynasty en invisibles.
