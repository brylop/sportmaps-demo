# Avisos a familias — informes, convocatorias, felicitaciones y resultado del entreno

**Estado:** spec para aprobar, 2026-10-25. Sin código. Frente del acudiente V2 ([`modulos-v2-definicion.md`](modulos-v2-definicion.md) §4). Regla V2 que manda: **WhatsApp primero**.

---

## 0. El problema, medido

Base viva, últimos 60 días, solo acudientes:

| Qué | Canal hoy | Volumen | Llega al celular |
|---|---|---|---|
| Informe mensual | Correo con enlace + aviso en la app | 35 publicados, 23 enviados, **7 vistos**; **133 en borrador** sin publicar (4 escuelas) | Correo sí; push casi nunca |
| Después del entreno («¿Cómo estuvo…?», «Así le fue hoy a…») | Aviso en la app + push | 1.204 | Push al **14 %** |
| Calendario (entrenos, partidos, torneos, cambios) | Aviso en la app + push | 619 | Push al **5 %** |
| Cobros (nuevo cobro, pago confirmado, recordatorio) | Aviso en la app + push; correo y WhatsApp solo con el bot | ~1.400 | Push al ~20 % |
| **Convocatoria a partido** | **Ninguno**: el profe arma los convocados (`match_lineups`, 106 en 5 escuelas) y no se avisa | — | No |
| **Reporte del partido** (Besser) | **Ninguno** | — | No |
| **Felicitación del profe** | **No existe** | — | — |

Por qué: solo 105 de 929 acudientes (11 %) tienen push del navegador; la app nativa entrega 0; WhatsApp está conectado en 2 escuelas y solo para cobros.

**Ya resuelto el 2026-10-25:** las notificaciones sin escuela no se podían marcar como leídas (migración `20261024225703`, aplicada). Desde hoy «leído» se puede medir; antes salía 0 en todo lo que no tenía `school_id`.

---

## 1. Qué se construye

### 1.1 Un despachador con canal por aviso
Todo aviso a una familia pasa por un único punto (ya existe `notification_deliveries` y el «Despachador de Notificaciones» validado en dev). Se le agrega el canal WhatsApp:

1. **WhatsApp** si la escuela tiene canal conectado, la familia dio el número y la plantilla está aprobada por Meta.
2. **Push** si hay suscripción.
3. **Siempre** queda el aviso en la app (campana).
4. **Correo** solo para los avisos que ya lo usan (informe mensual, cobranza).

Cada aviso guarda por qué canal salió y si se abrió (el enlace lleva un parámetro de origen).

### 1.2 Cuatro plantillas nuevas de WhatsApp (con botón al enlace sin contraseña)

| Plantilla | Cuándo sale | Texto (borrador) | Botón |
|---|---|---|---|
| `informe_listo` | Al publicar el informe mensual | «Ya está el informe de septiembre de Sofía. La profe Laura dice: “{frase}”.» | Ver el informe |
| `convocatoria_partido` | Al guardar la convocatoria (y si cambia) | «Sofía está convocada al partido contra {rival}, sábado 10 a las 10:30 a. m. en {lugar}. Llevar: {nota}.» | Ver el partido |
| `resultado_entreno` | Cuando el profe evalúa el entreno | «Así le fue hoy a Sofía: {Bien/Normal/Le costó}. {comentario}» | Ver cómo va |
| `felicitacion` | Cuando el profe toca «Felicitar» | «La profe Laura felicitó a Sofía: “{mensaje}”.» | Ver |

El enlace abre la pantalla de la app sin pedir contraseña (mismo patrón de token que `/p/:token`; caduca). Sin canal de WhatsApp, el mismo texto sale por push y en la campana.

### 1.3 Convocatorias y reporte del partido avisan
- `save_match_roster` (convocados) y la publicación del reporte del partido generan el aviso a cada familia de los convocados. Hoy no generan nada.
- Cambio de convocatoria (hora, lugar, cancelación) = nuevo aviso con el cambio.
- La familia ve la convocatoria en Calendario › Próximos con la etiqueta «Convocado».

### 1.4 Felicitaciones (función nueva)
- En «Evaluar» del entrenador, un botón «Felicitar» por deportista con 3 frases sugeridas y texto libre (máx. 200 caracteres).
- Tabla nueva `athlete_kudos` (school_id, subject, coach, mensaje, creado). RLS: escribe el staff de la escuela del deportista (`user_staff_school_ids()`), lee la familia del deportista y el staff. Creación por RPC `SECURITY DEFINER` con `search_path` fijo y `GRANT EXECUTE` explícito.
- La familia la ve en Hijos › Progreso («Felicitaciones del mes») y en el informe mensual.
- Tope: 1 felicitación por deportista por día, para que no pierda valor.

### 1.5 Informes que no se quedan en borrador
- Recordatorio al profe (o a la administración, según «Quién publica») a los 3 y 7 días del cierre con «Tienes N informes sin publicar».
- En Hoy del dueño: «133 informes sin publicar» con botón.

### 1.6 Arreglo pequeño (va primero)
Los avisos de calendario dicen «📅 Nuevo entrenamiento: PARTIDO LIGA PREJUVENIL»: el título usa siempre «entrenamiento». Debe usar el tipo real del evento (Partido, Torneo, Reunión…).

---

## 2. Fases

| Fase | Qué | Hecho cuando |
|---|---|---|
| F0 | Título correcto en avisos de calendario · convocatoria y reporte del partido generan aviso en la app + push | Una convocatoria nueva llega a las familias convocadas |
| F1 | Despachador con canal WhatsApp · plantillas `informe_listo` y `convocatoria_partido` (aprobación de Meta) | En una escuela conectada, el informe y la convocatoria llegan por WhatsApp |
| F2 | Felicitaciones (tabla, RPC, botón del profe, vista de la familia) · plantilla `felicitacion` | El profe felicita y la familia la recibe |
| F3 | `resultado_entreno` por WhatsApp · recordatorios de informes sin publicar | Informes en borrador bajan a la mitad |

Cada fase: DB + RLS + BFF + frontend + pruebas en una pasada; prueba real con mensajes (WhatsApp no se valida leyendo código); `seguridad:invariantes` sin CRÍTICAS; una sola sesión aplica migraciones.

---

## 3. Cómo se mide

| Métrica | Hoy | Meta |
|---|---|---|
| Informes vistos / enviados | 7 / 23 | Más de la mitad |
| Informes en borrador | 133 | Menos de 20 |
| Avisos que llegan al celular (WhatsApp o push) | 5–20 % | Más de 60 % en escuelas con WhatsApp |
| Convocatorias avisadas | 0 de 106 | Todas |
| Lectura de avisos | No se podía medir | Se mide por canal |

---

## 4. Decisiones abiertas

| # | Pregunta | Propuesta |
|---|---|---|
| A1 | ¿La felicitación la puede mandar solo el profe o también la administración? | Profe y administración |
| A2 | ¿El resultado del entreno sale por WhatsApp a todas las familias o solo si el profe escribió comentario? | Solo con comentario, para no saturar |
| A3 | Costo de las plantillas de WhatsApp (conversación de utilidad): ¿lo asume la escuela o SportMaps? | Incluido en el plan, con tope mensual por escuela |
| A4 | ¿La convocatoria pide confirmación («Va / No va»)? | Sí, en F1, con un toque desde el chat |
