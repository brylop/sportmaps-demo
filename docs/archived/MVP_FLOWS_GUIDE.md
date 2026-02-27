# Guía de Pruebas de Flujos MVP (Multi-Sede y Pagos)

Esta guía detalla paso a paso cómo probar las nuevas funcionalidades implementadas para el cierre del MVP.

## 1. Gestión de Hijos e Inscripción
**Objetivo**: Verificar que un padre puede inscribir a un hijo específico, y que la fecha de nacimiento se guarda correctamente.

1.  **Iniciar Sesión** como un padre (`role: parent`).
2.  **Ir a Explorar** y seleccionar un programa de una escuela.
3.  Clic en **"Inscribirme"**.
4.  Si no has iniciado sesión, te pedirá hacerlo. Al volver, aparecerá el modal de **Inscripción Pendiente**.
5.  **Selector de Hijos**:
    *   Si tienes hijos, selecciona uno de la lista.
    *   Si no, o quieres otro, clic en "Agregar otro hijo/a".
    *   Llena el formulario (Nombre y Fecha de Nacimiento). *Nota: La edad se calcula automáticamente.*
6.  **Confirmar**: Al seleccionar, pasarás al modal de pago.

## 2. Pago Manual y Aprobación
**Objetivo**: Probar el flujo de pago por transferencia y su posterior validación por parte de la escuela.

### Parte A: El Padre (Envío de Pago)
1.  En el modal de pago, selecciona **"Transferencia / Efectivo"**.
2.  Observa las instrucciones bancarias.
3.  Clic en **"Seleccionar Archivo"** para simular la carga de un comprobante.
4.  Clic en **"Enviar Comprobante"**.
5.  Verifica que aparezca el mensaje de éxito indicando que el pago está **"en revisión"**.
6.  La inscripción quedará en estado `pending` (no activa aún).

### Parte B: La Escuela (Aprobación)
1.  **Iniciar Sesión** como administrador de escuela (`role: school` o `admin`).
2.  Navega a **Menú > Administración > Pagos** (`/payments-automation`).
3.  Verás la pestaña "Validación Manual" con un indicador rojo si hay pagos pendientes.
4.  Busca el pago realizado por el padre.
5.  Clic en **"Ver"** (ícono de ojo) para revisar el comprobante simulado.
6.  Clic en **"Aprobar"**.
7.  **Resultado esperado**:
    *   El pago pasa a estado "Pagado" (verde) en el historial.
    *   El sistema busca automáticamente la inscripción pendiente y la actualiza a **"Activa"**.
    *   Se envía una notificación al padre.

## 3. Envío de Recordatorios de Cobro
**Objetivo**: Verificar que la escuela puede identificar deudores y enviar recordatorios.

1.  Como administrador de escuela, ve a **Menú > Administración > Recordatorios** (`/payment-reminders`).
2.  El sistema listará automáticamente todos los pagos con estado `pending` o `overdue`.
3.  Verifica los filtros: "Pendientes", "Vencidos".
4.  Selecciona uno o varios padres usando los checkboxes.
5.  Clic en **"Enviar"**.
6.  Verifica el mensaje de éxito (toast).

---
**Notas Técnicas:**
*   Todos los datos mostrados en los dashboards son **REALES** traídos directamente de Supabase.
*   No hay datos "hardcodeados" (falsos/mock) en las vistas de administración.
