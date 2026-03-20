# Flujo del Módulo de Asistencias - Rol Owner

Este documento detalla el flujo completo del módulo de asistencias desde la perspectiva del rol **Owner/Administrador**, cubriendo todos los niveles desde el Frontend hasta la Base de Datos.

## 1. Arquitectura General y Roles

El flujo de asistencia se divide en dos grandes áreas para el personal de la escuela:
1.  **Toma de Asistencia (Coach/Staff):** El proceso diario de marcar quién asistió.
2.  **Supervisión y Auditoría (Owner/Admin):** El proceso de revisar el cumplimiento y estadísticas.

---

## 2. Nivel Frontend (Vistas de Usuario)

### A. Supervisión de Asistencias (`Owner`)
*   **Archivo:** [AttendanceSupervisionPage.tsx](file:///c:/Users/Equipo/.gemini/antigravity/scratch/sportmaps-demo/frontend/src/pages/AttendanceSupervisionPage.tsx)
*   **Ruta:** `/attendance-supervision`
*   **Funcionalidades:**
    *   **Calendario de Control:** Selección de fechas para ver sesiones programadas.
    *   **Vista de Sesiones:** Lista todas las `attendance_sessions` del día.
    *   **Indicadores Rápidos:** Muestra el conteo de Presentes, Ausentes, Tardes y Escusados por sesión.
    *   **Detección de Omisiones:** Identifica equipos/clases que **no han registrado asistencia** aún.
    *   **Detalle por Estudiante:** Permite abrir una sesión específica para ver los nombres de los estudiantes y su estado individual.

### B. Toma de Asistencia (`Coach/Staff/Owner`)
*   **Archivo:** [CoachAttendancePage.tsx](file:///c:/Users/Equipo/.gemini/antigravity/scratch/sportmaps-demo/frontend/src/pages/CoachAttendancePage.tsx)
*   **Ruta:** `/coach-attendance`
*   **Funcionalidades:**
    *   **Selección de Contexto:** El usuario elige entre un "Equipo" (clase regular) o una "Sesión Programada" (clínicas/clases sueltas).
    *   **Roster Unificado:** Combina los estudiantes inscritos fijos (`enrollments`) con los que reservaron de forma externa o por plan (`session_bookings`).
    *   **Estados de Asistencia:** Permite marcar: `present`, `absent`, `late`, `excused`.
    *   **Finaización:** Botón para "Finalizar Sesión", lo que bloquea ediciones y dispara lógica de cobro/créditos.

---

## 3. Nivel API / BFF (Lógica de Negocio)

El Frontend no interactúa directamente con Supabase para la escritura sensible, utiliza el BFF para asegurar reglas de negocio.

### A. Rutas de Asistencia
*   **Archivo:** [attendance.ts](file:///c:/Users/Equipo/.gemini/antigravity/scratch/sportmaps-demo/bff/src/routes/attendance.ts)
*   **Endpoints Clave:**
    *   `GET /api/v1/attendance/session/:teamId`: Recupera o inicializa la sesión de hoy para un equipo.
    *   `POST /api/v1/attendance/session`: Guarda los registros de asistencia (`attendance_records`) y actualiza la metadata de la sesión.
    *   `PATCH /api/v1/attendance/session/:sessionId/finalize`: Marca la sesión como finalizada. **Nota:** Esto es irreversible en la UI estándar.
    *   `GET /api/v1/attendance/stats/rate`: Calcula porcentajes de asistencia para reportes de Owner.

### B. Rutas de Reservas (Relacionadas)
*   **Archivo:** [session-bookings.ts](file:///c:/Users/Equipo/.gemini/antigravity/scratch/sportmaps-demo/bff/src/routes/session-bookings.ts)
*   **Impacto en Asistencia:**
    *   Gestiona los "Drop-ins" (estudiantes que pagan por sesión). Estos aparecen automáticamente en el listado de asistencia del Coach gracias a la relación entre `attendance_sessions` y `session_bookings`.

---

## 4. Nivel Base de Datos (Persistencia)

### Tablas Principales
1.  `attendance_sessions`: Almacena la cabecera de la sesión (fecha, equipo, coach, estado `finalized`).
2.  `attendance_records`: Contiene el estado individual de cada niño por sesión.
3.  `session_bookings`: Relaciona a los estudiantes externos con las sesiones.

### Automatización (Triggers)
*   **`trg_deduct_sessions_on_finalize`**: Cuando una sesión se marca como `finalized = true`, el sistema automáticamente descuenta 1 crédito de la inscripción (`enrollments.sessions_used`) del estudiante. Esto previene que un estudiante asista a más clases de las pagadas en su plan.

---

## 5. Resumen del Flujo de Datos

1.  **Inicio:** El Coach abre la App y selecciona su equipo.
2.  **Carga:** El BFF busca en `attendance_sessions` si hay algo hoy; si no, prepara un listado basado en los estudiantes inscritos en `enrollments` y reservados en `session_bookings`.
3.  **Registro:** El Coach marca los estados y guarda (BFF escribe en `attendance_records`).
4.  **Cierre:** Al finalizar la sesión, el BFF actualiza `attendance_sessions` y el Trigger de DB descuenta créditos.
5.  **Control:** El Owner entra a `AttendanceSupervisionPage` y ve en tiempo real quién cumplió con la toma de asistencia y las estadísticas de la escuela.
