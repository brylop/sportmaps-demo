# 🏗️ SportMaps: Estructura de Proyecto para Notion

Esta guía está diseñada para ser copiada directamente a una base de datos de Notion. Se organiza por **Épicas**, **Historias de Usuario** y la división técnica entre **Flutter (Frontend)** y **Supabase/Backend**.

---

## 📋 Épica 1: Fundamentos, Auth & Roles
**Descripción:** Cimiento del sistema, gestión de accesos y perfiles de usuario.

| Historia de Usuario (US) | Tarea Flutter (Frontend) | Tarea Backend (Supabase/API) |
| :--- | :--- | :--- |
| **US1.1: Autenticación Multi-rol** | Implementar pantallas de Login y Registro. Lógica de redirección por rol. | Configurar Tablas de Perfiles. Crear Triggers para sincronización de Auth. |
| **US1.2: Perfil de Usuario** | Pantalla de "Mi Perfil" para edición de datos personales y avatar. | API/RPC para actualización de perfil. Configuración de Storage para fotos. |
| **US1.3: Modo Demo** | Implementar "Demo Welcome" y lógica de sesiones temporales. | Script de generación de datos semilla (Seed Data) para perfiles demo. |
| **US1.4: Configuración & Ajustes** | Navegación a Configuración, cambio de idioma/tema. | Persistencia de preferencias de usuario en la base de datos. |

---

## 🎓 Épica 2: Gestión de Estudiantes
**Descripción:** Repositorio central de los alumnos de la escuela.

| Historia de Usuario (US) | Tarea Flutter (Frontend) | Tarea Backend (Supabase/API) |
| :--- | :--- | :--- |
| **US2.1: Directorio Estudiantes** | Lista de estudiantes con búsqueda y filtrado rápido. | Tabla `students` con RLS (Row Level Security). |
| **US2.2: Ficha Estudiante** | Vista detallada del estudiante (datos, padres, historial). | Endpoint para obtener datos relacionados del estudiante. |
| **US2.3: Carga Masiva (CSV)** | Interfaz para subir archivos .csv/.xlsx y previsualizar errores. | Función Edge Function para procesar y validar el archivo en lote. |
| **US2.4: CRUD Estudiante** | Formularios de creación y edición manual de alumnos. | Procedimientos almacenados para validación de emails duplicados. |

---

## 🗓️ Épica 3: Gestión Académica (Clases & Programas)
**Descripción:** Planificación de actividades deportivas.

| Historia de Usuario (US) | Tarea Flutter (Frontend) | Tarea Backend (Supabase/API) |
| :--- | :--- | :--- |
| **US3.1: Programas & Niveles** | Listado y gestión de categorías deportivas (e.g., Fútbol U10). | Tabla `programs` y `levels`. |
| **US3.2: Horarios de Clases** | Calendario semanal con slots de entrenamiento. | Estructura de base de datos para horarios recurrentes. |
| **US3.3: Asignación Alumnos** | Interfaz de arrastrar y soltar para inscribir estudiantes. | Tabla intermedia `enrollments` con lógica de cupos. |
| **US3.4: Asignación Coaches** | Pantalla de gestión de staff técnico por grupo. | Relación de `staff` con `classes`. |

---

## ✅ Épica 4: Asistencias & Seguimiento
**Descripción:** Operación diaria en el campo.

| Historia de Usuario (US) | Tarea Flutter (Frontend) | Tarea Backend (Supabase/API) |
| :--- | :--- | :--- |
| **US4.1: Toma de Asistencia** | Listado check para que el coach marque presentes/ausentes. | Tabla `attendance_records` con timestamps automáticos. |
| **US4.2: QR Check-in** | Escáner de código QR para registro rápido de entrada/salida. | Generación dinámica de QRs únicos por sesión/alumno. |
| **US4.3: Evaluaciones Bienestar** | Formulario rápido de estado de salud/ánimo post-entrenamiento. | Tabla `wellness_reports` para tracking histórico. |

---

## 💳 Épica 5: Finanzas & Pagos
**Descripción:** Automatización de cobranza y pasarela de pago.

| Historia de Usuario (US) | Tarea Flutter (Frontend) | Tarea Backend (Supabase/API) |
| :--- | :--- | :--- |
| **US5.1: Pasarela de Pago** | Checkout integrado con tarjetas (Stripe/PayU). | Integración de Webhooks para confirmación de pagos. |
| **US5.2: Cobranza Automática** | Pantalla de estado de cuenta para padres (Pendiente/Pagado). | Cron-job diario para generar facturas/cobros automáticos. |
| **US5.3: Automatización Escuelas** | Dashboard financiero para la administración con totales proyectados. | Agregaciones SQL para reportes financieros en tiempo real. |

---

## 💬 Épica 6: Comunicación & Chat
**Descripción:** Canal directo entre escuela, coaches y padres.

| Historia de Usuario (US) | Tarea Flutter (Frontend) | Tarea Backend (Supabase/API) |
| :--- | :--- | :--- |
| **US6.1: Chat Tiempo Real** | Interfaz de mensajería (instancia de Stream o Supabase Realtime). | Canales Realtime de Supabase configurados por grupo/clase. |
| **US6.2: Notificaciones Push** | Integración con FCM (Firebase Cloud Messaging). | Trigger en DB que dispara notificación al recibir mensaje. |
| **US6.3: Anuncios Globales** | Muro de avisos para toda la escuela. | Tabla `announcements` con filtros por audiencia. |

---

## 🔍 Épica 7: Exploración (SportMaps Discovery)
**Descripción:** Dashboard público para buscar escuelas.

| Historia de Usuario (US) | Tarea Flutter (Frontend) | Tarea Backend (Supabase/API) |
| :--- | :--- | :--- |
| **US7.1: Mapa Interactivo** | Integración de Google Maps con pines de escuelas cercanas. | Consulta PostGIS para búsqueda por cercanía geográfica. |
| **US7.2: Filtros de Búsqueda** | Filtros por deporte, precio, horario y calificación. | Índices GIN en Postgres para búsquedas ultra rápidas. |
| **US7.3: Calificaciones** | Sistema de estrellas y reseñas para escuelas. | Tabla `reviews` con lógica de promedio automático. |

---

## 📊 Épica 8: Reportes & Analítica
**Descripción:** Inteligencia de negocio.

| Historia de Usuario (US) | Tarea Flutter (Frontend) | Tarea Backend (Supabase/API) |
| :--- | :--- | :--- |
| **US8.1: Dashboard Admin** | Gráficas de crecimiento de alumnos y retención (Syncfusion/Fl Chart). | Vistas SQL materializadas para analítica. |
| **US8.2: Exportación PDF** | Botón para generar reportes en PDF descargables. | Generación de PDF en servidor (Edge Function) u local en Flutter. |

---

## 💡 Tips para Notion:
1.  **Crea una base de datos de "Tareas"**: Con estados: *Backlog, En Progreso, Bloqueado, Hecho*.
2.  **Agrega propiedad "Épica"**: Como etiqueta (Select) para agrupar.
3.  **Agrega propiedad "Área"**: Con opciones *🔵 Flutter* y *🟢 Backend*.
4.  **Vincula Historias de Usuario**: Cada tarea técnica debe pertenecer a una US específica.
