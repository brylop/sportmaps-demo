# Informes multi-cadencia — diario a semestral, individual y grupal, con marca de la escuela

**Fecha:** 2026-08-19 · **Estado:** spec, sin código · **Extiende:** `specs/athlete-reports-module.md`
**Contexto:** trial de Carmel arrancando; el Informe Mensual (F0–F1 + F5) ya corre.

> **Regla de origen: esto NO es un módulo nuevo.** Es la generalización del Informe Mensual del
> Atleta que ya está en `develop` con ciclo diario corriendo (§1.2 del roadmap). Construir un
> segundo sistema de informes al lado del existente sería fabricar el próximo
> `training_plans`/`training_sessions`: dos tablas de nombre parecido que no se conocen (`PER-0`).
> Todo lo de abajo **extiende** las tablas, RPCs y job existentes.

---

## 1. Lo que ya existe y se reutiliza (inventario contra el roadmap v2.5)

| Pieza | Estado | Se reutiliza para |
|---|---|---|
| `athlete_reports` + RPCs de escritura (F1) | ✅ en develop | La entidad informe. Se le agregan columnas, no se reemplaza |
| `publish_team_reports_system` | ✅ en develop | **El informe grupal ya tiene la mitad hecha**: existe publicación por equipo |
| Ciclo diario 06:10 COT (`athlete-reports.job.ts`) | ✅ corre | El scheduler. Se generaliza para leer cadencias en vez de asumir "mensual" |
| Outbox → dispatcher → web push + FCM (MOD-4 F0/F1/F-R) | ✅ funciona | La notificación in-app y push. **No se construye plomería nueva** — misma decisión que MOD-18 |
| Resend con batch de 100 + `email_sends` | ✅ | El correo |
| `schools.branding_settings` | ✅ existe | **El logo de Carmel vive acá, no en el informe.** Personalización = leer la marca de la escuela |
| `notification_deliveries` + `notifications.category/data` | ✅ | Trazabilidad de entrega |
| Gotcha documentado: identidad del coach = `school_staff.id` vía `coach_auth_id`, NO `auth.uid()` | spec MOD-17 | Toda RPC nueva de este spec |
| Gotcha documentado: dos rutas BFF de performance (`/school/performance/…` y `/athlete/performance/evolution`) | MOD-10 | Cualquier campo de presentación nuevo va en **las dos** |

**Lo que NO existe y este spec agrega:** cadencias distintas de mensual · el informe grupal como
*contenido* (no solo publicación por equipo) · envío manual "como está" por coach/admin · plantilla
de correo/PDF con la marca de la escuela · calendario de reparto configurable (la F2–F6 del spec
original, absorbida acá).

---

## 2. Diseño

### 2.1 Cadencia: `period_type` en el informe, `report_schedules` para la programación

```
athlete_reports  (existente — se extiende, no se migra)
  + period_type   text NOT NULL DEFAULT 'monthly'
                  CHECK (period_type IN ('daily','weekly','biweekly','monthly','semester','custom'))
  + period_start  date NOT NULL   -- hoy implícito en el mes; pasa a explícito
  + period_end    date NOT NULL
  + scope         text NOT NULL DEFAULT 'individual'
                  CHECK (scope IN ('individual','team'))
  + team_id       uuid NULL       -- obligatorio cuando scope='team' (CHECK)

report_schedules (NUEVA)
  id, school_id   uuid NOT NULL   -- explícito, lección de PER-0: nada de RLS colgada de JOINs
  team_id         uuid NULL       -- NULL = toda la escuela
  period_type     text NOT NULL   CHECK (igual que arriba, sin 'custom')
  send_day        smallint NULL   -- día del mes (monthly/biweekly) o de la semana (weekly)
  send_time       time NOT NULL DEFAULT '06:10'
  enabled         boolean NOT NULL DEFAULT false   -- NACE APAGADO. Lección de MOD-17/MOD-18
  auto_publish    boolean NOT NULL DEFAULT false   -- false = genera borrador y avisa al coach
  created_by      uuid NOT NULL   -- school_staff.id, no auth.uid()
```

Convenciones del repo aplicadas: `text + CHECK` y no enum (el dolor de `payments.status`);
`school_id` explícito (la falla de `training_plans`); backfill de las filas existentes =
`period_type='monthly'` con `period_start/end` derivados del mes que ya tienen — cero cambio de
comportamiento.

**Por qué la cadencia vive en un schedule y no en un cron por escuela:** el job de las 06:10 ya
recorre todo; pasa de "asumir mensual" a "leer `report_schedules` vencidos". Un solo dueño del
trabajo programado (regla 9 de §0 del roadmap), cero jobs nuevos en `pg_cron`.

**Semántica de cada cadencia:**

| `period_type` | Ventana | Caso de uso |
|---|---|---|
| `daily` | El día | Resumen de sesión: asistió/no, RPE si existe, nota del coach. **Es el informe más barato y el único que un coach llena en 2 minutos** |
| `weekly` | Lun–Dom | El microciclo — cuando `PER-1` exista, este informe ES la vista semanal exportable (`PER-5`); hasta entonces: asistencia de la semana + notas |
| `biweekly` | 1–15 / 16–fin | Escuelas que facturan quincenal |
| `monthly` | Mes calendario | **El actual.** Nada cambia para quien ya lo usa |
| `semester` | Ene–Jun / Jul–Dic | El corte académico — para Carmel y colegios: evolución de métricas, asistencia acumulada, comparación inicio/fin |
| `custom` | Libre (solo manual) | El "como está": el coach elige rango y manda |

### 2.2 Individual y grupal: el mismo informe, dos alcances

- **`scope='individual'`** — lo de hoy. Destinatario: el acudiente (o el atleta adulto).
- **`scope='team'`** — contenido agregado del equipo: asistencia promedio, top mejoras, resumen
  del período escrito por el coach, próximos hitos. Destinatarios: **todas las familias del
  equipo**. La publicación por equipo ya existe (`publish_team_reports_system`); lo nuevo es que
  el informe grupal tiene contenido propio en vez de ser N individuales publicados juntos.
- Regla de privacidad del grupal: **nunca métricas individuales de otros menores con nombre**.
  Rankings dentro del informe grupal van anonimizados ("el promedio del equipo subió X") o con
  consentimiento — misma línea que D-IMAGEN. El informe grupal habla del equipo, el individual
  del hijo.

### 2.3 Envío manual "como está" — coach o admin, sin esperar cadencia

Botón **«Enviar informe ahora»** en la pantalla existente de informes:

1. Coach/admin elige: alcance (atleta / equipo), rango (preset de cadencia o `custom`).
2. Se genera el borrador **con lo que haya** — la regla de PER-2 aplica acá: el informe tiene que
   ser útil con cero `performance_entries` (486 filas en toda la base). Contenido mínimo
   garantizado: asistencia del período + campo de nota del coach. Métricas, si existen, suman.
3. Vista previa **con la marca aplicada** (ver 2.4).
4. Publicar → dispara la entrega (2.5).

Permisos: coach solo sobre sus equipos (`can_manage_reports()` existente); admin sobre toda la
escuela. La RPC de generación manual reutiliza las de F1; **no** se crean variantes `_system`
nuevas — las `_system` son solo del cron, la manual va con la identidad real del staff.

### 2.4 Personalización: el logo de Carmel sin construir un editor

**Decisión de alcance: la marca es de la ESCUELA, no del informe.** El informe lee
`schools.branding_settings` (logo, color primario, nombre) y lo aplica a: cabecera del informe en
la app, plantilla del correo, y PDF cuando exista (F2 del spec original). Carmel sube su logo una
vez donde ya se administra la marca — no hay upload por informe, no hay editor de plantillas
(ese es el pozo en el que `MOD-14` lleva meses).

⚠️ **Advertencia MOV-4:** la plantilla de correo y la vista del informe se escriben **contra
tokens** (`--primary`, variables en el HTML del correo), nunca con el verde `#248223` a mano.
Este spec no puede depender de que `MOV-4` esté cerrado, pero sí puede no agrandar el problema:
regla dura para el PR — cero hex literales en las plantillas.

Fallback: escuela sin branding → marca SportMaps. Con branding → su logo y su color. Eso hace que
la personalización de Carmel sea **configuración, no desarrollo**.

### 2.5 Entrega: notificación in-app + push + correo, por la plomería existente

Al publicar (manual o por cadencia):

1. **Fila en `notifications`** con `category='athlete_report'` y `data` apuntando al informe →
   el trigger existente la mete al outbox → dispatcher → **web push + FCM**. In-app y push
   resueltos sin una línea de plomería nueva.
2. **Correo por Resend** con la plantilla brandeada: resumen corto + botón «Ver informe completo»
   que abre la app. **El contenido completo vive en la app, el correo es el gancho** — así el
   dato del menor no viaja entero por correo y la trazabilidad queda en `email_sends`.
3. `notification_deliveries` registra cada canal. La pantalla del coach muestra por informe:
   enviado / entregado / abierto (correo), para que "¿le llegó a la familia?" tenga respuesta.

**A quién le llega:** el destinatario es el acudiente vinculado. La mitad medida en MOD-18 aplica
igual acá — **los `unregistered` no tienen cuenta ni correo**: el informe se genera igual y queda
descargable/compartible por WhatsApp manual (mismo criterio que la F4 de cumpleaños). El spec no
promete "le llega a todos" porque es falso hoy; promete "existe para todos, llega a quien tiene
cuenta".

---

## 3. Qué cambia en pantalla

| Dónde | Qué | Quién |
|---|---|---|
| Informes (existente) | Selector de cadencia y alcance al generar; botón «Enviar ahora»; columna de estado de entrega por canal | coach/admin |
| Informes → Programación | CRUD de `report_schedules`: cadencia, día/hora, auto-publicar o borrador, **toggle apagado por defecto** | admin |
| Config de escuela | Nada nuevo: el logo ya se administra en branding | admin |
| App del acudiente | El informe llega como notificación y vive en su sección; correo con resumen + link | familia |
| Panel super admin | El toggle maestro de informes por escuela (mismo patrón que los flags de capacidades: quién, cuándo, valor efectivo) | super admin |

---

## 4. Fases

| Fase | Qué | Riesgo | Esfuerzo |
|---|---|---|---|
| **R0** | ⛔ **El tapón primero: filtro de piloto (`MOD-17`).** Nada de esto se construye mientras el cron actual recorra todas las escuelas mandando correo real. `report_schedules.enabled=false` por defecto ES el filtro bien hecho: el job pasa de "todas las escuelas" a "schedules habilitados" y el piloto deja de ser un comentario para ser una fila | ninguno — reduce riesgo | 1–2 d |
| **R1** | Columnas nuevas + `report_schedules` + backfill mensual + job generalizado leyendo schedules | bajo: backfill = comportamiento idéntico | 3–4 d |
| **R2** | Envío manual "como está" + preview con marca + plantilla de correo brandeada (tokens, cero hex) | bajo | 3–4 d |
| **R3** | Entrega completa: categoría de notificación + correo Resend + estados de entrega en la pantalla del coach | medio: toca envíos reales — **audit antes de enforce**: primera semana en modo "solo staff" antes de abrir a familias | 4–5 d |
| **R4** | Informe grupal con contenido propio + regla de anonimización | medio | 1 sem |
| **R5** | Cadencias daily/weekly conectadas a asistencia (y a `PER-1` cuando exista) + semestral con comparación inicio/fin | bajo | 1 sem |

**Para el trial de Carmel** alcanza R0–R3: informe mensual e individual con su logo, enviado
manualmente por el coach, llegando por app y correo. R4–R5 entran durante el trial sin retocar
nada — la cadencia ya es dato, no código.

**Encaje en el roadmap:** R0 **es** `MOD-17` y sube con la urgencia que ya tiene en P1; R1–R3 =
**`MOD-19`** en P1 (justificación: Carmel es la primera escuela que va a pedir "mándale esto a los
papás" en su semana 1); R4–R5 = **`MOD-20`** en P2, con `PER-5` como pariente declarado.

---

## 5. Decisiones que no puedo tomar solo

1. **¿El informe diario existe para familias, o solo interno?** Un correo diario a un padre es
   spam en la semana 2. Propuesta: `daily` solo in-app (sin correo) por defecto, y el correo
   reservado para weekly en adelante — pero es decisión de producto.
2. **¿Auto-publicar o borrador por defecto en las cadencias?** El ciclo actual publica solo.
   Propuesta: `auto_publish=false` por defecto — el coach revisa y publica; auto solo cuando la
   escuela ya confía. Evita el escenario "informe automático vacío en el trial".
3. **Rankings con nombre en el informe grupal:** ¿anonimizado siempre, o con consentimiento por
   escuela? Toca la misma fibra que D-IMAGEN.
4. **¿El semestral de Carmel compara contra qué?** Inicio del semestre vs fin es lo natural, pero
   con el trial arrancando el 19-ago el primer "semestre" es parcial. Definir con Carmel en el
   onboarding qué corte esperan (¿trimestre del club?).

---

## 6. Verificación de referencias (2026-08-19)

Todos los IDs que este spec cita **existen** en `ROADMAP.md`: `MOD-17`, `MOD-18`, `MOD-14`,
`MOD-10`, `PER-0`, `PER-1`, `PER-2`, `PER-5`, `MOV-4`. `MOD-19` y `MOD-20` estaban libres y quedan
asignados a este spec. El spec que extiende, `specs/athlete-reports-module.md`, también existe.
