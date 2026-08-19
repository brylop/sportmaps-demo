# Bajar las listas de asistencia de Dynasty — las tres vías

**Fecha:** 2026-08-18 · `school_id = 2d509571-3238-4c04-ac3f-6dfe20539226`

Antes de elegir la vía, el tamaño de lo que hay:

| Mes | Marcas | Atletas | Días con lista |
|---|---|---|---|
| 2026-07 | 1 | 1 | 1 |
| 2026-08 | **558** | **260** | **12** |

Es todo. Julio es una marca suelta, así que en la práctica **es un solo mes**.

---

## Vía A — Desde la app (la que le sirve a la escuela)

La más simple y la única que puede usar la escuela sola. Da **tres archivos por
mes**, uno por pestaña.

1. Entrar con una cuenta de **dueño, admin o school_admin**. El entrenador NO
   puede: `GET /history` exige esos roles.
2. Ir a **Asistencias → Histórico** (`/attendance-history`).
3. Elegir el mes con las flechas del encabezado. Para Dynasty: **agosto 2026**.
4. Opcional, para partirlo: los selectores de **equipo/plan** y de
   **entrenador** filtran antes de exportar, así que se puede bajar un CSV por
   equipo o por coach.
5. En cada pestaña, botón **CSV**:

| Pestaña | Archivo | Qué trae |
|---|---|---|
| Por atleta | `asistencia-2026-08-por-atleta.csv` | una fila por atleta: presentes, tarde, excusadas, ausentes, total y % |
| Por día | `asistencia-2026-08-por-dia.csv` | una fila por día: cuántos atletas y el desglose |
| Día por día | `asistencia-2026-08-matriz.csv` | matriz atleta × día, con el estado en cada celda |

**Lo que hay que saber:** exporta **un mes por vez**. Para Dynasty alcanza con
agosto, pero cuando haya varios meses son N descargas. Y el CSV lleva BOM, así
que Excel en Windows respeta los acentos.

---

## Vía B — La API, si lo querés en JSON o automatizado

Un solo request trae los tres cortes juntos, más el cruce plan-vs-consumo.

```
GET https://sportmaps-bff.onrender.com/api/v1/attendance/history?month=2026-08
Authorization: Bearer <token>
x-school-id: 2d509571-3238-4c04-ac3f-6dfe20539226
```

Filtros opcionales: `&teamId=<uuid>`, `&offeringId=<uuid>`, `&coachId=<school_staff.id>`.

Devuelve `athletes[]` (con `by_day` y el objeto `plan`), `days[]`, `totals` y
`desfases`. Mismo requisito de rol que la vía A.

---

## Vía C — SQL, cuando hace falta TODO el histórico de una

Las tres consultas de abajo están probadas contra la base. Pegar en el SQL
Editor de Supabase y usar el botón de descarga del resultado.

Cubren **todos los meses de una sola vez**, que es lo que la app no hace.

### C.1 · Por atleta (todo el histórico)

```sql
SELECT coalesce(c.full_name, p.full_name, ua.full_name) AS atleta,
       coalesce(t.name, '(sin equipo)')                 AS equipo,
       count(*)                                          AS registros,
       count(*) FILTER (WHERE ar.status = 'present')     AS presentes,
       count(*) FILTER (WHERE ar.status = 'late')        AS tarde,
       count(*) FILTER (WHERE ar.status = 'excused')     AS excusadas,
       count(*) FILTER (WHERE ar.status = 'absent')      AS ausentes,
       round(100.0 * count(*) FILTER (WHERE ar.status IN ('present','late')) / count(*)) AS pct
  FROM attendance_records ar
  LEFT JOIN children c               ON c.id  = ar.child_id
  LEFT JOIN profiles p               ON p.id  = ar.user_id
  LEFT JOIN unregistered_athletes ua ON ua.id = ar.unregistered_athlete_id
  LEFT JOIN teams t                  ON t.id  = ar.team_id
 WHERE ar.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
 GROUP BY 1, 2
 ORDER BY 1;
```

### C.2 · Marca por marca (el detalle crudo, para auditar)

Es la que sirve cuando una familia reclama: trae fecha, equipo, estado y **quién
pasó la lista**.

```sql
SELECT ar.attendance_date                               AS fecha,
       coalesce(c.full_name, p.full_name, ua.full_name) AS atleta,
       coalesce(t.name, '(sin equipo)')                 AS equipo,
       ar.status                                         AS estado,
       marcador.full_name                                AS quien_marco,
       ar.check_in_method                                AS metodo,
       ar.created_at                                     AS cargado_el
  FROM attendance_records ar
  LEFT JOIN children c               ON c.id  = ar.child_id
  LEFT JOIN profiles p               ON p.id  = ar.user_id
  LEFT JOIN unregistered_athletes ua ON ua.id = ar.unregistered_athlete_id
  LEFT JOIN teams t                  ON t.id  = ar.team_id
  LEFT JOIN profiles marcador        ON marcador.id = ar.marked_by
 WHERE ar.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
 ORDER BY ar.attendance_date DESC, equipo, atleta;
```

### C.3 · Matriz atleta × día

`crosstab` necesita la extensión `tablefunc`, así que se arma con agregación de
texto — más simple y sin dependencias:

```sql
SELECT coalesce(c.full_name, p.full_name, ua.full_name) AS atleta,
       string_agg(
           to_char(ar.attendance_date, 'DD/MM') || '=' ||
           CASE ar.status WHEN 'present' THEN 'P' WHEN 'late'    THEN 'T'
                          WHEN 'excused' THEN 'E' WHEN 'absent'  THEN 'A'
                          ELSE ar.status END,
           ' · ' ORDER BY ar.attendance_date)            AS dias,
       count(*) FILTER (WHERE ar.status IN ('present','late')) AS asistio,
       count(*)                                          AS de
  FROM attendance_records ar
  LEFT JOIN children c               ON c.id  = ar.child_id
  LEFT JOIN profiles p               ON p.id  = ar.user_id
  LEFT JOIN unregistered_athletes ua ON ua.id = ar.unregistered_athlete_id
 WHERE ar.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
 GROUP BY 1
 ORDER BY 1;
```

### C.4 · Las sesiones, para ver qué días se abrieron y cuáles no

Responde la pregunta que ninguna de las otras contesta: **qué días la escuela no
pasó lista**.

```sql
SELECT t.name AS equipo, s.session_date AS fecha, s.finalized AS cerrada,
       ss.full_name AS coach_asignado,
       count(ar.id) AS marcas
  FROM attendance_sessions s
  JOIN teams t             ON t.id  = s.team_id
  LEFT JOIN school_staff ss ON ss.id = s.coach_id
  LEFT JOIN attendance_records ar ON ar.session_id = s.id
 WHERE s.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
 GROUP BY 1, 2, 3, 4
 ORDER BY 2 DESC, 1;
```

---

## Cuál usar

- **La escuela quiere su reporte del mes** → Vía A, tres clics.
- **Reclamo de una familia** → C.2, que es la única con `quien_marco` y la hora
  de carga.
- **Cerrar el mes o conciliar plata** → la pestaña **Plan vs consumo** de la
  vía A: cruza lo asistido contra lo pagado y valoriza las clases fuera de plan.
- **Todo el histórico en un archivo** → C.1 o C.3.

## Lo que ninguna trae

**Los días que nadie registró no existen en ningún export.** Si un equipo
entrenó y no se pasó lista, no hay fila que lo diga — solo la ausencia de la
sesión. C.4 es lo más cerca que se puede estar: muestra los días que **sí** se
abrieron, y comparándolo con el horario del equipo salen los que faltan.

En agosto Dynasty tiene 12 días con lista, y arrancó a registrar el 1 de agosto.
