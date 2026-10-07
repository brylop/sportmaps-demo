/**
 * Mapa de la app por rol, para el bot de soporte in-app (Sportbot,
 * `services/inapp-support-bot.service.ts`). Se inyecta en el system prompt
 * para que pueda responder "¿dónde / cómo hago X?" con la ruta exacta del
 * menú y los botones que el usuario ve en pantalla.
 *
 * DERIVADO DEL CÓDIGO del frontend al 2026-10-06, no inventado:
 *   - frontend/src/config/navigation.ts      (menús por rol; OJO: hay DOS
 *     árboles para la escuela, `school` y `school_admin`)
 *   - frontend/src/components/AppSidebar.tsx (qué rol usa cada menú y qué
 *     ítems se esconden: Membresías, Deportes y Categorías, pagos)
 *   - frontend/src/config/routePermissions.ts, frontend/src/App.tsx
 *   - frontend/src/config/module-catalog.ts  (módulos que el Super Admin
 *     puede apagar por escuela → ModuleGate)
 *   - frontend/src/lib/permissions.ts         (PermissionGate por rol)
 *   - las páginas de cada ítem (títulos, botones, title="...")
 *
 * HAY QUE ACTUALIZARLO cuando cambien los menús o los textos de los botones:
 * una indicación equivocada es peor que ninguna. Regla al editar: si una
 * etiqueta no se puede confirmar en el código, la tarea no entra.
 * Las rutas usan las etiquetas DEL MENÚ; si el título de la pantalla es
 * distinto se aclara entre paréntesis.
 * Donde un artículo de ayuda contradice al código, este mapa sigue al código.
 */

export interface AppMapEntry {
    tarea: string;
    pasos: string;
    palabrasClave?: string[];
    /** slug de bff/src/data/help-articles.ts (se enlaza como /ayuda/<slug>) */
    articulo?: string;
    /** ModuleKey de frontend/src/config/module-catalog.ts si el ítem se puede apagar por escuela */
    modulo?: string;
}

export interface AppMapRole {
    rol: string;
    resumen: string;
    /** El menú lateral tal como lo ve el usuario, una línea por grupo/ítem. */
    menu: string;
    tareas: AppMapEntry[];
    /** Cosas que suelen pedir y este rol NO puede hacer (y quién sí). */
    noPuede: string[];
}

const SOPORTE =
    'Chat de soporte: botón redondo con audífonos abajo a la derecha (en todas las pantallas) → ventana "Soporte SportMaps". Es ESTE mismo chat: a quien ya está hablando con SportBot no lo mandes a abrirlo; ofrécele pasar su caso a una persona.';

const CONFIG_PERSONAL: AppMapEntry[] = [
    {
        tarea: 'Cambiar contraseña',
        pasos: 'Configuración > pestaña "Seguridad" > "Nueva Contraseña" y "Confirmar Nueva Contraseña" > "Actualizar Contraseña".',
        palabrasClave: ['contraseña', 'clave', 'password'],
    },
    {
        tarea: 'Editar mis datos personales / notificaciones',
        pasos: 'Configuración > pestaña "Perfil" > "Guardar Cambios". Notificaciones: pestaña "Notificaciones" > "Actualizar Preferencias".',
        palabrasClave: ['perfil', 'nombre', 'teléfono', 'notificaciones'],
    },
    {
        tarea: 'Eliminar mi cuenta',
        pasos: 'Configuración > pestaña "Seguridad" > "Zona de Peligro" > "Eliminar Cuenta" > "Sí, eliminar mi cuenta". Se borra a los 30 días; se puede deshacer con "Cancelar la eliminación".',
        palabrasClave: ['eliminar cuenta', 'borrar cuenta', 'darme de baja'],
    },
];

export const APP_MAP: Record<string, AppMapRole> = {
    // ─── Escuela (owner / school / school_admin) ────────────────────────────
    school: {
        rol: 'Escuela (dueño o administrador)',
        resumen:
            'Administra la escuela completa. El administrador (school_admin) ve el mismo menú salvo "Mi Perfil Público". Algunos ítems pueden no aparecer: el Super Admin puede apagar módulos por escuela, Contabilidad / Facturación electrónica / Control de Acceso / Mis Torneos dependen de que el plan los incluya, y si la escuela no cobra por SportMaps se ocultan Pagos, Finanzas y Recordatorios (y aparece "Membresías"). "Deportes y Categorías" solo aparece si la escuela tiene más de un deporte.',
        menu: [
            'Principal: Dashboard · Deportistas · Matrículas por revisar · Entrenadores · Invitaciones',
            'Gestión Deportiva: Equipos y Planes (Mis Equipos, Deportes y Categorías, Membresías, Mis Planes) · Calendario · Entrenamiento (Métricas y Rendimiento, Gestión de Rutinas) · Informe Mensual · Asistencias (Supervisión, Histórico, Encuestas) · Resultados · Mis Torneos · Dotación',
            'Finanzas: Pagos · Modo Recepción · Contabilidad (Contabilidad, Proveedores, Nómina, Estado de resultados, Presupuesto) · Facturación electrónica',
            'Reportes: Finanzas · Reportes · Panel de Reportes',
            'Documentos e Identidad: Carnets (Carnets Digitales, Plantillas de Carnets) · Constancias · QR de Inscripción',
            'Comunicación: WhatsApp · Recordatorios · Plantillas de Mensajes',
            'Sedes e Instalaciones: Sedes · Instalaciones · Control de Acceso',
            'Cuenta: Mi Perfil Público · Facturación (plan de SportMaps) · Configuración',
        ].join('\n'),
        tareas: [
            {
                tarea: 'Crear un equipo',
                pasos: 'Gestión Deportiva > Equipos y Planes > Mis Equipos > botón "Nuevo Equipo" > "Nombre del Equipo" y "Deporte" (obligatorios), opcional "Precio Mensual", "Entrenadores Asignados", "Ubicación / Sede" > "Crear Equipo".',
                palabrasClave: ['equipo', 'grupo', 'categoría', 'crear equipo'],
                modulo: 'gestion_deportiva_equipos_planes',
            },
            {
                tarea: 'Editar un equipo (nombre, precio, sede)',
                pasos: 'Mis Equipos > ícono lápiz "Editar Equipo" en la fila del equipo (en vista de tarjetas: "Gestionar / Editar") > cambia los datos > "Guardar Cambios".',
                palabrasClave: ['editar equipo', 'renombrar', 'cambiar nombre', 'mensualidad del equipo'],
                modulo: 'gestion_deportiva_equipos_planes',
            },
            {
                tarea: 'Asignar un entrenador a un equipo',
                pasos: 'Mis Equipos > lápiz "Editar Equipo" > campo "Entrenadores Asignados" > elige el entrenador (se pueden poner varios) > "Guardar Cambios". No se hace desde Entrenadores.',
                palabrasClave: ['asignar coach', 'asignar entrenador', 'entrenador del equipo'],
                modulo: 'gestion_deportiva_equipos_planes',
            },
            {
                tarea: 'Inscribir / sacar deportistas de un equipo',
                pasos: 'Mis Equipos > ícono "Gestionar Deportistas" en la fila del equipo > ventana "Inscribir Deportistas" > busca al deportista > "Inscribir" (o "Remover"). Si ya está en otro equipo te ofrece agregarlo también o moverlo.',
                palabrasClave: ['inscribir', 'agregar al equipo', 'mover de equipo', 'cambiar de equipo'],
                modulo: 'gestion_deportiva_equipos_planes',
            },
            {
                tarea: 'Archivar o eliminar un equipo',
                pasos: 'Mis Equipos > menú "⋯" (Más acciones) del equipo > "Archivar" (se recupera con "Reactivar" desde "Archivados"). "Eliminar permanente" solo funciona si el equipo no tiene deportistas ni inscripciones; si tiene, archívalo.',
                palabrasClave: ['archivar', 'eliminar equipo', 'borrar equipo'],
                modulo: 'gestion_deportiva_equipos_planes',
            },
            {
                tarea: 'Registrar un deportista nuevo',
                pasos: 'Deportistas (la pantalla dice "Atletas") > "Agregar Atleta" > llena "Nombre completo", acudiente, "Equipo", "Plan", "Mensualidad" > "Agregar Atleta". Se crea el primer cobro y se invita al acudiente.',
                palabrasClave: ['nuevo atleta', 'nuevo deportista', 'alumno', 'matricular', 'inscribir alumno'],
                articulo: 'registrar-nuevo-atleta',
            },
            {
                tarea: 'Editar los datos de un deportista',
                pasos: 'Deportistas > menú "Más acciones" de la fila > "Editar" > "Guardar Cambios". El cambio de equipo también se hace con el campo "Equipo" de esa ventana.',
                palabrasClave: ['editar atleta', 'datos del alumno', 'fecha de nacimiento', 'documento'],
            },
            {
                tarea: 'Dar de baja / inactivar un deportista',
                pasos: 'Deportistas > menú "Más acciones" > "Inactivar". Cancela su plan y anula sus cobros pendientes. Se revierte con "Reactivar" (pestaña "Inactivos"). Si es por vacaciones: "🏖️ Vacaciones / pausa" (si la escuela lo tiene activo).',
                palabrasClave: ['dar de baja', 'retirar', 'inactivar', 'baja', 'se retiró', 'pausa', 'vacaciones'],
            },
            {
                tarea: 'Importar deportistas en lote',
                pasos: 'Deportistas > "Importar CSV" > "Descargar plantilla" > llena el archivo .csv > súbelo > "Importar N deportista(s)". Solo acepta CSV (no Excel directo: guárdalo como CSV).',
                palabrasClave: ['importar', 'excel', 'csv', 'masivo', 'cargar lista'],
            },
            {
                tarea: 'Revisar hojas de matrícula recibidas por foto/WhatsApp',
                pasos: 'Principal > Matrículas por revisar > en cada hoja: "Crear atleta", "Vincular a {nombre}" (si ya existe) o "Descartar". Nunca se crea solo.',
                palabrasClave: ['hoja de matrícula', 'foto', 'formulario de inscripción'],
            },
            {
                tarea: 'Ver el estado de cuenta de un deportista',
                pasos: 'Deportistas > menú "Más acciones" > "Ver estado de cuenta" (botón "Imprimir" para PDF/papel).',
                palabrasClave: ['estado de cuenta', 'cuánto debe', 'historial de pagos del alumno'],
            },
            {
                tarea: 'Invitar a un acudiente (padre/madre)',
                pasos: 'Invitaciones > "Nueva Invitación" > tipo "👨‍👩‍👧 Acudiente" > email o WhatsApp, "Nombre del menor a inscribir", "Equipo / Grupo", "Mensualidad / Cobro inicial" > "Crear & Copiar Link" o "Crear & Enviar WA". Atajo: Deportistas > "Más acciones" > "Invitar Acudiente".',
                palabrasClave: ['invitar padre', 'invitar acudiente', 'vincular padre', 'link para el papá'],
            },
            {
                tarea: 'Reenviar o cancelar una invitación',
                pasos: 'Invitaciones > en la fila: "Copiar link", "Enviar por WhatsApp", "Reenviar email" o "Cancelar invitación". Para todas las pendientes: "Enviar a los que faltan" / "Reenviar a todas".',
                palabrasClave: ['reenviar invitación', 'no le llegó', 'cancelar invitación'],
            },
            {
                tarea: 'Agregar un entrenador / dar acceso a staff',
                pasos: 'Entrenadores > "Contratar Entrenador" > "Nombre Completo", "Correo Electrónico", "Deportes que dicta", deja activo "Enviar invitación por correo" > "Contratar Entrenador". Para un administrador: Invitaciones > "Nueva Invitación" > tipo "🔑 Administrador".',
                palabrasClave: ['entrenador', 'coach', 'profesor', 'staff', 'administrador', 'dar acceso'],
            },
            {
                tarea: 'Inactivar o editar un entrenador',
                pasos: 'Entrenadores > íconos de la fila: "Editar información", "Inactivar" / "Reactivar", "Gestionar disponibilidad", "Eliminar permanentemente".',
                palabrasClave: ['quitar entrenador', 'inactivar coach'],
            },
            {
                tarea: 'Crear un plan / mensualidad con precio',
                pasos: 'Equipos y Planes > Mis Planes > "Nuevo Plan" > "Nombre del Plan", "Tipo de Oferta" > "🚀 Crear Plan". Luego en la tarjeta del plan: "Agregar Tarifa" > "Nombre de la tarifa", "Precio", "Duración" > "🚀 Crear Tarifa". El precio mensual de un equipo se pone aparte en "Editar Equipo" > "Precio Mensual".',
                palabrasClave: ['plan', 'mensualidad', 'tarifa', 'precio', 'paquete de clases'],
                modulo: 'gestion_deportiva_equipos_planes',
            },
            {
                tarea: 'Tomar o corregir asistencia (como escuela)',
                pasos: 'Asistencias > Supervisión > elige el equipo o plan > marca Presente / Ausente / Tarde / Excusado > "Guardar" > opcional "Finalizar". Consultar meses anteriores: Asistencias > Histórico.',
                palabrasClave: ['asistencia', 'lista', 'quién vino', 'faltas'],
                articulo: 'tomar-asistencia-coach',
            },
            {
                tarea: 'Crear una encuesta de asistencia',
                pasos: 'Asistencias > Encuestas > "Nueva encuesta" > título, fecha y clases del día > "Crear encuesta" > "Copiar link" para compartirla.',
                palabrasClave: ['encuesta', 'confirmar asistencia'],
            },
            {
                tarea: 'Crear un evento o entrenamiento en el calendario',
                pasos: 'Gestión Deportiva > Calendario > "Nuevo Evento" > "Título", "Para quién" (equipo o toda la escuela), "Tipo de Evento" (Entrenamiento, Partido, Reunión…), inicio y fin > "Crear Evento".',
                palabrasClave: ['calendario', 'evento', 'horario', 'partido', 'reunión'],
                modulo: 'gestion_deportiva_calendario',
            },
            {
                tarea: 'Informe Mensual a las familias',
                pasos: 'Gestión Deportiva > Informe Mensual > elige mes > "Generar borradores de {mes}" > en "Nota del equipo" elige equipo y escribe > "Guardar nota" > "Publicar N informes" > revisa con "Ver PDF" > "Enviar los publicados". En "Quién publica y envía" decides si lo hace la administración o cada entrenador.',
                palabrasClave: ['informe mensual', 'reporte a padres', 'boletín'],
                articulo: 'informe-mensual-coach',
                modulo: 'gestion_deportiva_informe_mensual',
            },
            {
                tarea: 'Registrar un pago manual (efectivo o transferencia)',
                pasos: 'Finanzas > Pagos (pantalla "Gestión de Pagos") > "Registrar pago" > "Efectivo" o "Transferencia" > "Deportista / Atleta" > "Aplicar a" (un cobro pendiente o nuevo) > "Mes que cubre", "Monto ($ COP)", "Fecha del pago" > "Confirmar Registro".',
                palabrasClave: ['registrar pago', 'pago en efectivo', 'me pagó', 'transferencia', 'pago manual'],
                modulo: 'finanzas_pagos',
            },
            {
                tarea: 'Aprobar o rechazar un comprobante que subió un padre',
                pasos: 'Finanzas > Pagos > pestaña "Cobros" > "Cobros por Aprobar" > "Ver"/"Comprobante" para mirarlo > "Aprobar" > "Pago completo" o "Registrar abono" > "Aprobar $X". Para rechazar: "Rechazar" (aplica de inmediato). "Glosar" abre una aclaración con la familia.',
                palabrasClave: ['comprobante', 'aprobar pago', 'validar pago', 'rechazar', 'glosa'],
                modulo: 'finanzas_pagos',
            },
            {
                tarea: 'Ver quién debe (cartera, pendientes, vencidos)',
                pasos: 'Reportes > Finanzas > pestaña "Cartera" (o "Antigüedad por atleta"). Desde ahí "Enviar WhatsApp" a cada deudor.',
                palabrasClave: ['cartera', 'deudores', 'morosos', 'pendientes', 'vencidos', 'quién debe'],
                modulo: 'reportes_finanzas',
            },
            {
                tarea: 'Generar los cobros del mes',
                pasos: 'Finanzas > Pagos > pestaña "Config" > "Apertura del Mes — Generar Cobros" > "Ver vista previa del mes a abrir" > "Confirmar y generar N pago(s)". Automático: en "Reglas de Cobro" activa "Generar cobros automáticos" > "Guardar Cambios".',
                palabrasClave: ['generar cobros', 'mensualidades del mes', 'abrir mes', 'cobros automáticos'],
                modulo: 'finanzas_pagos',
            },
            {
                tarea: 'Enviar recordatorios de cobro',
                pasos: 'Comunicación > Recordatorios (pantalla "Recordatorios de Cobro") > selecciona > "Enviar (N)", o "Enviar todos por email", o el ícono verde de WhatsApp en la fila. Automáticos: Finanzas > Pagos > "Config" > "Recordatorios" > "Enviar recordatorios".',
                palabrasClave: ['recordatorio', 'cobrar', 'avisar que debe'],
                modulo: 'documentos_recordatorios',
            },
            {
                tarea: 'Configurar medios de pago (cuentas, Nequi, QR, link de pago, pago online)',
                pasos: 'Finanzas > Pagos > pestaña "Config" > "Datos de Pago para Transferencia" ("Agregar llave": Bre-B, Nequi, Daviplata, Llave de transferencia o "Link de pago (Wompi)"; también "Código QR para Transferencia") > "Guardar Cambios". Pago online con tarjeta/PSE: tarjeta "SportMaps Pay" > "Activar pagos online" > "Guardar configuración de pagos".',
                palabrasClave: ['medios de pago', 'cuenta bancaria', 'nequi', 'wompi', 'link de pago', 'pse', 'tarjeta'],
                modulo: 'finanzas_pagos',
            },
            {
                tarea: 'Facturación electrónica (DIAN)',
                pasos: 'Finanzas > Facturación electrónica (si la escuela tiene Contabilidad, está como pestaña dentro de Contabilidad) > tarjeta "Facturador electrónico" > "Configurar". Emitir en lote: "Emitir facturas de un periodo" > "Emitir facturas del rango". Por pago: al registrar un pago, activa "¿Desea factura electrónica?". Anular una factura aceptada: "Facturas emitidas" > "Anular" (nota crédito).',
                palabrasClave: ['factura electrónica', 'dian', 'factus', 'facturar', 'nota crédito'],
                modulo: 'finanzas_facturacion_electronica',
            },
            {
                tarea: 'Emitir carnets digitales',
                pasos: 'Documentos e Identidad > Carnets > Carnets Digitales > pestaña "Emitir nuevo" > "Emitir" en la fila (o "Emitir seleccionados") > "Plantilla", "Vence el" > "Emitir". Imprimir: pestaña "Carnets emitidos" > "Descargar PDF". Diseño: pestaña "Plantillas".',
                palabrasClave: ['carnet', 'credencial', 'qr del atleta', 'imprimir carnets'],
                modulo: 'documentos_carnets',
            },
            {
                tarea: 'Crear un QR de inscripción',
                pasos: 'Documentos e Identidad > QR de Inscripción > "Nuevo QR" > "Nombre interno", tipo (equipo, plan o sede), monto, opcional "Exigir primer pago al inscribirse" > "Crear". Descarga: "Ver QR" o "Poster PDF".',
                palabrasClave: ['qr', 'inscripción por qr', 'flyer', 'auto-inscripción'],
                modulo: 'documentos_qr_inscripcion',
            },
            {
                tarea: 'Aprobar constancias',
                pasos: 'Documentos e Identidad > Constancias > en "Solicitudes y constancias emitidas" > "Emitir" en la solicitud pendiente; "PDF" para descargar. Las constancias las solicita la familia.',
                palabrasClave: ['constancia', 'certificado'],
                modulo: 'documentos_constancias',
            },
            {
                tarea: 'Crear o editar una sede',
                pasos: 'Sedes e Instalaciones > Sedes (pantalla "Gestión de Sedes") > "Nueva Sede" > "Nombre de la Sede", dirección, ciudad > "Crear Sede". Editar: "Editar" en la sede > "Guardar Cambios".',
                palabrasClave: ['sede', 'sucursal'],
                modulo: 'sedes_sedes',
            },
            {
                tarea: 'Instalaciones, reservas y clases de prueba',
                pasos: 'Sedes e Instalaciones > Instalaciones > pestañas "Instalaciones" ("Agregar Instalación"), "Reservas" (aprobar/reprogramar/cancelar) y "Clases de Prueba" ("Agendar Clase de Prueba").',
                palabrasClave: ['cancha', 'reserva', 'clase de prueba', 'instalación'],
                modulo: 'sedes_instalaciones',
            },
            {
                tarea: 'Cambiar logo y colores de la escuela',
                pasos: 'Cuenta > Configuración > sección Academia "Marca" > "Cambiar Logo" y "Color Principal" / "Color Secundario" > "Guardar Identidad Visual". Requiere el adicional de marca propia en el plan.',
                palabrasClave: ['logo', 'colores', 'marca', 'personalizar'],
            },
            {
                tarea: 'Datos de la academia y perfil público',
                pasos: 'Cuenta > Configuración > "Información Academia" / "Servicios". Página pública: Cuenta > Mi Perfil Público > pestañas General / Planes / Contacto > "Publicar perfil".',
                palabrasClave: ['perfil público', 'datos de la escuela', 'nit', 'dirección'],
            },
            {
                tarea: 'Ver o cambiar el plan de SportMaps',
                pasos: 'Cuenta > Facturación > "Ver planes" o "Elegir <Plan>" (abre la página de precios). "Módulos activos" es solo informativo.',
                palabrasClave: ['plan sportmaps', 'suscripción', 'upgrade', 'pagar sportmaps'],
            },
            {
                tarea: 'Reportes',
                pasos: 'Reportes > Reportes ("Reportes Gerenciales": "Exportar CSV", "Imprimir") o Reportes > Panel de Reportes (pestañas Finanzas, Deportistas, Sedes, Equipos, Entrenadores). Exportar pagos: Finanzas > Pagos > "Exportar Reporte".',
                palabrasClave: ['reporte', 'exportar', 'estadísticas', 'informe financiero'],
            },
        ],
        noPuede: [
            'Activar o desactivar módulos del menú: solo el equipo de SportMaps (Super Admin). Si un módulo dice "no está disponible para tu escuela", escribe a soporte.',
            'Conectar la pasarela Wompi/MercadoPago (cuenta de comercio propia): lo hace el equipo de SportMaps; la escuela solo activa "SportMaps Pay" y registra sus llaves de transferencia.',
            'Anular un cobro ya emitido desde un botón: no existe; "Rechazar" solo aplica a comprobantes en revisión, e "Inactivar" a un deportista anula sus cobros pendientes. Para otros casos, soporte.',
            'Cambiar de plan dentro de la app: "Elegir plan" abre la página de precios / ventas.',
        ],
    },

    // ─── Entrenador de la escuela ───────────────────────────────────────────
    coach: {
        rol: 'Entrenador',
        resumen:
            'Entrenador de una escuela: ve solo los equipos que le asignaron. Si no ve ningún equipo, el administrador debe asignarlo desde "Editar Equipo".',
        menu: [
            'Principal: Dashboard · Mis Equipos · Sesiones de Entrenamiento · Mis Planes (disponibilidad y citas; la escuela puede apagarlo) · Mi Dotación · Mis Deportistas · Calendario',
            'Gestión: Gestión de Rutinas · Asistencias (Supervisión, Encuestas) · Resultados · Reportes · Informe Mensual',
            'Comunicación: Mensajes · Anuncios · Configuración',
        ].join('\n'),
        tareas: [
            {
                tarea: 'Editar un equipo (cambiar el nombre)',
                pasos: 'Mis Equipos > ícono lápiz "Editar Equipo" en la fila del equipo (en vista de tarjetas: "Gestionar / Editar") > cambia "Nombre del Equipo" > "Guardar Cambios".',
                palabrasClave: ['editar equipo', 'renombrar', 'cambiar nombre del equipo'],
                modulo: 'gestion_deportiva_equipos_planes',
            },
            {
                tarea: 'Agregar o quitar deportistas de mi equipo',
                pasos: 'Mis Equipos > ícono "Gestionar Deportistas" > ventana "Inscribir Deportistas" > busca > "Inscribir" o "Remover".',
                palabrasClave: ['agregar al equipo', 'inscribir', 'quitar del equipo'],
                modulo: 'gestion_deportiva_equipos_planes',
            },
            {
                tarea: 'Tomar asistencia',
                pasos: 'Asistencias > Supervisión (pantalla "Asistencias") > toca el equipo en "Equipos Regulares" > marca Presente / Ausente / Tarde / Excusado (o "✅ Todos presentes") > "Guardar asistencia" > opcional "Finalizar sesión". Para un día anterior usa "Día de la lista" (hasta 7 días atrás).',
                palabrasClave: ['asistencia', 'lista', 'pasar lista', 'faltas'],
                articulo: 'tomar-asistencia-coach',
            },
            {
                tarea: 'Asistencia escaneando el carnet (QR)',
                pasos: 'Asistencias > Supervisión > "Escanear carnet" > apunta la cámara al QR del carnet. Solo marca Presente y solo para hoy.',
                palabrasClave: ['escanear', 'qr', 'carnet', 'check-in'],
                articulo: 'tomar-asistencia-coach',
            },
            {
                tarea: 'Crear una sesión de entrenamiento',
                pasos: 'Sesiones de Entrenamiento (la pantalla dice "Métricas y Rendimiento") > elige tu equipo en "Selecciona tu equipo" > "Crear Sesión" > "Crear Sesión". Si el equipo tiene un mesociclo activo, la sesión se crea desde el día dentro del mesociclo ("Crear sesión").',
                palabrasClave: ['sesión', 'entrenamiento', 'planificar clase'],
                modulo: 'gestion_deportiva_entrenamiento_metricas',
            },
            {
                tarea: 'Crear un mesociclo (periodización)',
                pasos: 'Sesiones de Entrenamiento > elige el equipo > "Crear Mesociclo" > fechas y semanas > "Crear Mesociclo". Dentro: "Agregar día", "Duplicar semana anterior".',
                palabrasClave: ['mesociclo', 'periodización', 'microciclo', 'planificación'],
                modulo: 'gestion_deportiva_entrenamiento_metricas',
            },
            {
                tarea: 'Evaluar a los deportistas (métricas)',
                pasos: 'Sesiones de Entrenamiento > elige el equipo > en "Roster": "Evaluar Lote" (todo el equipo) > "Guardar Registro", o "Evaluar" en un deportista. "Evolución" muestra su historial.',
                palabrasClave: ['evaluar', 'evaluación', 'métricas', 'rendimiento', 'notas'],
                modulo: 'gestion_deportiva_entrenamiento_metricas',
            },
            {
                tarea: 'Escribir y publicar el Informe Mensual',
                pasos: 'Gestión > Informe Mensual > elige mes > "Nota del equipo": elige el equipo, escribe "Cómo le fue al equipo" (mín. 20 caracteres) > "Guardar nota" > "Publicar N informes". El envío a familias lo hace la escuela, salvo que haya elegido "Cada entrenador, lo suyo".',
                palabrasClave: ['informe mensual', 'nota del equipo', 'reporte a padres'],
                articulo: 'informe-mensual-coach',
                modulo: 'gestion_deportiva_informe_mensual',
            },
            {
                tarea: 'Registrar un resultado de partido',
                pasos: 'Gestión > Resultados > elige el equipo > "Registrar Resultado".',
                palabrasClave: ['resultado', 'marcador', 'partido', 'goles'],
            },
            {
                tarea: 'Crear un evento en el calendario',
                pasos: 'Calendario > "Nuevo Evento" > "Título", "Para quién" (tu equipo), "Tipo de Evento" > "Crear Evento".',
                palabrasClave: ['calendario', 'evento', 'partido', 'horario'],
                modulo: 'gestion_deportiva_calendario',
            },
            {
                tarea: 'Reportes del equipo',
                pasos: 'Gestión > Reportes (pantalla "Reportes del Equipo") > pestañas Asistencia, Nómina, Resultados, Goleadores > "Exportar PDF".',
                palabrasClave: ['reporte', 'goleadores', 'exportar'],
            },
            {
                tarea: 'Enviar un anuncio',
                pasos: 'Comunicación > Anuncios > "Nuevo Anuncio" > "Enviar Anuncio".',
                palabrasClave: ['anuncio', 'aviso', 'comunicado'],
            },
            {
                tarea: 'Rutinas',
                pasos: 'Gestión > Gestión de Rutinas > "NUEVA RUTINA". Pestañas Todas / Personalizadas / Catálogo / Asignadas.',
                palabrasClave: ['rutina', 'ejercicios', 'gimnasio'],
                modulo: 'gestion_deportiva_entrenamiento_rutinas',
            },
            {
                tarea: 'Ver mis deportistas',
                pasos: 'Mis Deportistas (la pantalla dice "Atletas") > "Ver Perfil" en el menú de la fila. Crear o editar deportistas solo si tu escuela te lo permitió.',
                palabrasClave: ['mis alumnos', 'deportistas', 'perfil del atleta'],
            },
            {
                tarea: 'Dotación (implementos)',
                pasos: 'Mi Dotación > "Tomar dotación"; en "Por aceptar" > "Acepto" o "Diferencia"; para devolver: "Devolver".',
                palabrasClave: ['dotación', 'implementos', 'balones', 'uniforme'],
            },
        ],
        noPuede: [
            'Eliminar o archivar equipos: el administrador de la escuela.',
            'Asignarse a un equipo: el administrador, desde "Editar Equipo" > "Entrenadores Asignados".',
            'Registrar pagos, aprobar comprobantes, crear cobros o ver la cartera: la administración de la escuela (Finanzas > Pagos).',
            'Invitar entrenadores o administradores, ni gestionar el staff: la administración de la escuela.',
            'Inactivar / dar de baja deportistas: la administración de la escuela.',
            'Crear deportistas o subir hojas de matrícula: solo si la escuela lo habilitó para entrenadores.',
            'Crear encuestas de asistencia: la administración de la escuela.',
        ],
    },

    // ─── Acudiente ──────────────────────────────────────────────────────────
    parent: {
        rol: 'Acudiente (padre/madre)',
        resumen:
            'Ve a sus hijos, paga mensualidades, sube comprobantes y recibe informes. Si la escuela no cobra por SportMaps, "Pagos" no aparece.',
        menu: [
            'Principal: Dashboard · Mis Hijos · Calendario Familiar',
            'Seguimiento: Progreso Deportivo · Asistencias · Pagos · Tienda · Mis compras (Tienda y Mis compras solo si la tienda está activa)',
            'Mi Actividad: Mensajes · Mis Inscripciones · Mis Eventos · Mis Citas · Carnets de mis hijos · Mis Constancias · Configuración',
        ].join('\n'),
        tareas: [
            {
                tarea: 'Pagar una mensualidad en línea',
                pasos: 'Seguimiento > Pagos (pantalla "Mis Pagos") > pestaña "Pendientes" > "PAGAR" en el cobro > "Pagar online (Wompi)" (o MercadoPago si es lo que tiene la escuela) > "Pagar online $X".',
                palabrasClave: ['pagar', 'pse', 'tarjeta', 'mensualidad', 'pago en línea'],
            },
            {
                tarea: 'Subir un comprobante de transferencia / Nequi',
                pasos: 'Pagos > "PAGAR" en el cobro (o "ABONAR" si es un pago parcial) > "Transferencia / Nequi / Daviplata" > mira los datos de la cuenta > "Sube tu comprobante:" > "Pagar $X". La escuela lo valida después.',
                palabrasClave: ['comprobante', 'transferencia', 'nequi', 'daviplata', 'subir pago', 'ya pagué'],
            },
            {
                tarea: 'Ver historial, recibos y facturas',
                pasos: 'Pagos > pestañas "Todas" / "Aprobadas" > botones "RECIBO" o "FACTURA" en el pago. Estado de cuenta: botón "Estado de cuenta — {nombre}".',
                palabrasClave: ['recibo', 'factura', 'historial', 'estado de cuenta', 'cuánto debo'],
            },
            {
                tarea: 'Aceptar la invitación de la escuela (vincular a mi hijo)',
                pasos: 'En el Dashboard, aviso "¡Tienes una invitación pendiente!" > "Aceptar Invitación". Si la escuela ya inscribió a tu hijo, no lo registres a mano: acepta la invitación.',
                palabrasClave: ['invitación', 'vincular', 'no veo a mi hijo'],
                articulo: 'inscripcion-padre-paso-a-paso',
            },
            {
                tarea: 'Registrar un hijo a mano',
                pasos: 'Mis Hijos (pantalla "Familia SportMaps") > "Registrar Hijo" > llena los pasos ("Siguiente") > "Añadir Hijo".',
                palabrasClave: ['agregar hijo', 'registrar hijo', 'añadir hijo'],
            },
            {
                tarea: 'Editar los datos de mi hijo o subir documentos',
                pasos: 'Mis Hijos > tarjeta del hijo > ícono lápiz ("Editar Información del Hijo") o "Subir documentos".',
                palabrasClave: ['editar hijo', 'documento', 'datos de mi hijo'],
            },
            {
                tarea: 'Ver el informe mensual',
                pasos: 'Mis Hijos > tarjeta del hijo > "Informes" > elige el mes > "Descargar PDF".',
                palabrasClave: ['informe', 'boletín', 'nota del entrenador', 'reporte mensual'],
            },
            {
                tarea: 'Ver el carnet de mi hijo',
                pasos: 'Mi Actividad > Carnets de mis hijos (pantalla "Mis carnets") > toca el carnet > "Descargar PNG".',
                palabrasClave: ['carnet', 'credencial', 'qr'],
            },
            {
                tarea: 'Ver asistencia y progreso',
                pasos: 'Seguimiento > Asistencias ("Registro de Asistencia") o Seguimiento > Progreso Deportivo. También desde Mis Hijos > "Asistencia" / "Progreso".',
                palabrasClave: ['asistencia', 'faltas', 'progreso', 'evaluaciones'],
            },
            {
                tarea: 'Ver horarios y eventos',
                pasos: 'Principal > Calendario Familiar.',
                palabrasClave: ['horario', 'calendario', 'cuándo entrena', 'partido'],
            },
            {
                tarea: 'Pedir una constancia',
                pasos: 'Mi Actividad > Mis Constancias > "Solicitar constancia" > "Solicitar". La escuela la aprueba.',
                palabrasClave: ['constancia', 'certificado'],
            },
            {
                tarea: 'Pausa por vacaciones o lesión',
                pasos: 'Mis Hijos > tarjeta del hijo > "Solicitar pausa (vacaciones / lesión)" (si la escuela lo tiene activo).',
                palabrasClave: ['pausa', 'vacaciones', 'lesión', 'congelar'],
            },
            ...CONFIG_PERSONAL,
        ],
        noPuede: [
            'Cambiar el equipo, el horario o el plan del hijo: lo hace la escuela.',
            'Eliminar a un hijo ya inscrito en una escuela ni retirarlo: la escuela (o soporte).',
            'Cambiar el valor de la mensualidad o anular un cobro: la escuela.',
            'Aprobar su propio comprobante: la escuela lo valida.',
            'Crear eventos en el calendario: la escuela o el entrenador.',
        ],
    },

    // ─── Atleta ─────────────────────────────────────────────────────────────
    athlete: {
        rol: 'Atleta',
        resumen: 'Deportista con cuenta propia (adulto o menor con acceso).',
        menu: [
            'Principal: Dashboard · Mi Calendario · Mis Pagos',
            'Mi Rendimiento: Estadísticas · Objetivos · Entrenamientos',
            'Actividad Deportiva: Mis Inscripciones · Mis Eventos',
            'Bienestar: Explorar Bienestar · Mis Citas',
            'Tienda: Catálogo (solo si la tienda está activa)',
            'Documentos: Mis Carnets',
            'Cuenta: Configuración',
        ].join('\n'),
        tareas: [
            {
                tarea: 'Pagar un cobro o subir comprobante',
                pasos: 'Mis Pagos > toca el cobro ("Toca para pagar este cobro") > "Pagar online (Wompi)" o "Transferencia / Nequi / Daviplata" con "Sube tu comprobante:". Si no aparece el cobro: "Nuevo Pago" > "Generar pago".',
                palabrasClave: ['pagar', 'comprobante', 'mensualidad'],
            },
            {
                tarea: 'Ver mi estado de cuenta',
                pasos: 'Mis Pagos > "Mi estado de cuenta".',
                palabrasClave: ['estado de cuenta', 'cuánto debo'],
            },
            {
                tarea: 'Ver mi carnet',
                pasos: 'Documentos > Mis Carnets > toca el carnet > "Descargar PNG".',
                palabrasClave: ['carnet', 'qr'],
            },
            {
                tarea: 'Objetivos personales',
                pasos: 'Mi Rendimiento > Objetivos > "Nuevo Objetivo" > "Crear objetivo".',
                palabrasClave: ['objetivo', 'meta'],
            },
            {
                tarea: 'Registrar una actividad libre',
                pasos: 'Mi Rendimiento > Entrenamientos > "Actividad libre" > "Guardar".',
                palabrasClave: ['actividad', 'entrené', 'registrar entrenamiento'],
            },
            {
                tarea: 'Inscribirme a un evento',
                pasos: 'Desde la página del evento > inscribirse; luego se ve en Actividad Deportiva > Mis Eventos.',
                palabrasClave: ['evento', 'torneo', 'inscripción'],
                articulo: 'atleta-inscribirse-evento',
            },
            ...CONFIG_PERSONAL,
        ],
        noPuede: [
            'Cambiarse de equipo o de plan: la escuela.',
            'Aprobar sus pagos o cambiar el valor de la mensualidad: la escuela.',
            'Ver el plan de SportMaps de la escuela (Facturación): solo la administración.',
        ],
    },

    // ─── Auditoría / reportes (solo lectura) ────────────────────────────────
    reporter: {
        rol: 'Auditoría (reportes, solo lectura)',
        resumen: 'Usuario de solo lectura de la escuela para revisar cartera y reportes.',
        menu: ['Reportes: Dashboard · Panel de Reportes · Calendario', 'Cuenta: Notificaciones · Facturación · Configuración'].join(
            '\n',
        ),
        tareas: [
            {
                tarea: 'Ver cartera y reportes',
                pasos: 'Reportes > Panel de Reportes > pestañas Finanzas, Deportistas, Sedes, Equipos, Entrenadores.',
                palabrasClave: ['cartera', 'reporte', 'pagado', 'pendiente', 'vencido'],
                modulo: 'reportes_panel',
            },
            ...CONFIG_PERSONAL.slice(0, 2),
        ],
        noPuede: [
            'Registrar o aprobar pagos, editar deportistas o equipos: la administración de la escuela.',
        ],
    },

    // ─── Profesional de bienestar ───────────────────────────────────────────
    wellness_professional: {
        rol: 'Profesional de bienestar',
        resumen: 'Nutricionista, fisioterapeuta, psicólogo, etc. Ofrece servicios en el marketplace y lleva a sus atletas.',
        menu: [
            'Principal: Dashboard Vendedor · Mis Atletas · Agenda',
            'Marketplace: Mis Servicios · Citas Reservadas',
            'Evaluaciones: Nueva Evaluación · Historial Médico · Seguimientos',
            'Recursos: Planes Nutricionales · Reportes',
            'Perfil: Mi Perfil Público · Facturación · Configuración',
        ].join('\n'),
        tareas: [
            {
                tarea: 'Publicar un servicio',
                pasos: 'Marketplace > Mis Servicios > "Nuevo Servicio" > ventana "Crear servicio profesional" (3 pasos con "Siguiente") > "Publicar en marketplace".',
                palabrasClave: ['servicio', 'publicar', 'consulta'],
            },
            {
                tarea: 'Ver las citas reservadas',
                pasos: 'Marketplace > Citas Reservadas (pantalla "Mis Citas"): secciones "Proximas" y "Pasadas". Citas de hoy y mañana: Principal > Agenda.',
                palabrasClave: ['citas', 'agenda', 'reservas'],
            },
            {
                tarea: 'Registrar una evaluación de un atleta',
                pasos: 'Principal > Mis Atletas > "Nueva Evaluación" > "Nombre del Atleta", "Tipo de Evaluación", medidas > "Guardar Evaluación".',
                palabrasClave: ['evaluación', 'medidas', 'imc', 'peso'],
            },
            {
                tarea: 'Editar mi perfil público',
                pasos: 'Perfil > Mi Perfil Público > pestañas General / Tarifas / Contacto > "Guardar" > "Publicar perfil".',
                palabrasClave: ['perfil público', 'tarifas', 'publicar perfil'],
            },
            ...CONFIG_PERSONAL.slice(0, 2),
        ],
        noPuede: [
            'Editar un servicio ya publicado: la edición aún no está disponible ("Edicion proximamente"); se puede desactivar y crear uno nuevo.',
            'Confirmar o cancelar citas desde la app: no hay botón; escribe a soporte si lo necesitas.',
            'Crear evaluaciones desde el ítem "Nueva Evaluación" del menú: hoy abre la Agenda; usa Mis Atletas > "Nueva Evaluación".',
        ],
    },

    // ─── Entrenador personal independiente ──────────────────────────────────
    personal_trainer: {
        rol: 'Entrenador personal (independiente)',
        resumen: 'Entrenador que trabaja por su cuenta con clientes propios (no es el entrenador de una escuela).',
        menu: [
            'Principal: Dashboard · Mis Clientes · Disponibilidad',
            'Negocio: Mis Planes · Mis Rutinas · Pagos',
            'Mi Actividad: Mis Inscripciones',
            'Perfil: Mi Perfil Público · Facturación · Configuración',
        ].join('\n'),
        tareas: [
            {
                tarea: 'Gestionar mis clientes',
                pasos: 'Principal > Mis Clientes (pantalla "Gestión de Clientes").',
                palabrasClave: ['clientes', 'alumnos'],
                articulo: 'trainer-clientes',
            },
            {
                tarea: 'Configurar mis horarios disponibles',
                pasos: 'Principal > Disponibilidad > pestaña "Configurar Horarios". Sesiones agendadas: pestaña "Mis Sesiones".',
                palabrasClave: ['disponibilidad', 'horarios', 'agenda'],
                articulo: 'trainer-disponibilidad-tarifas',
            },
            {
                tarea: 'Rutinas',
                pasos: 'Negocio > Mis Rutinas.',
                palabrasClave: ['rutina', 'ejercicios'],
                articulo: 'trainer-rutinas',
            },
            {
                tarea: 'Perfil público',
                pasos: 'Perfil > Mi Perfil Público > "Guardar" > "Publicar perfil".',
                palabrasClave: ['perfil público', 'link'],
                articulo: 'trainer-perfil-publico',
            },
            ...CONFIG_PERSONAL.slice(0, 2),
        ],
        noPuede: ['Gestionar equipos o deportistas de una escuela: eso es del rol entrenador de escuela, que asigna la escuela.'],
    },

    // ─── Tienda / vendedor (store_owner y external_vendor) ──────────────────
    store_owner: {
        rol: 'Tienda (vendedor)',
        resumen:
            'Vende productos en el marketplace. Todo lo de tienda depende de que la tienda de SportMaps esté activa; si no, la pantalla dice "Tienda no disponible".',
        menu: [
            'Principal: Dashboard Vendedor · Mis Productos · Pedidos',
            'Inventario: Stock · Proveedores · Categorías',
            'Ventas: Clientes · Reportes · Promociones',
            'Perfil: Mi Perfil Público · Facturación · Configuración',
        ].join('\n'),
        tareas: [
            {
                tarea: 'Publicar un producto',
                pasos: 'Principal > Mis Productos > "Nuevo Producto" > 4 pasos (¿Qué vas a vender?, Información básica, Variantes y stock, Listo para publicar) > "Publicar ahora" (o "Guardar borrador").',
                palabrasClave: ['producto', 'publicar', 'catálogo'],
            },
            {
                tarea: 'Gestionar pedidos',
                pasos: 'Principal > Pedidos > filtra (Por cobrar, Pagados, En curso…) > acciones del pedido: "Aprobar pago", "Rechazar comprobante", "Preparar pedido", "Marcar enviado", "Marcar entregado", "Cancelar pedido".',
                palabrasClave: ['pedido', 'orden', 'envío', 'entregar'],
            },
            {
                tarea: 'Completar la verificación / activar la tienda',
                pasos: 'Se abre sola si falta: "Activar Mi Tienda" > pasos Negocio / Pagos / Verificación > "Activar y continuar" > "Enviar y continuar".',
                palabrasClave: ['verificación', 'activar tienda', 'onboarding'],
            },
            ...CONFIG_PERSONAL.slice(0, 2),
        ],
        noPuede: ['Activar la tienda de SportMaps si está apagada para toda la plataforma: depende del equipo de SportMaps.'],
    },

    // ─── Organizador de eventos ─────────────────────────────────────────────
    organizer: {
        rol: 'Organizador de eventos',
        resumen: 'Crea y gestiona torneos/eventos con inscripciones y pagos.',
        menu: [
            'Principal: Dashboard · Crear Evento',
            'Gestión: Mis Eventos · Calendario · Finanzas · Reportes',
            'Cuenta: Perfil · Facturación · Configuración',
        ].join('\n'),
        tareas: [
            {
                tarea: 'Crear un evento',
                pasos: 'Principal > Crear Evento ("Crear Evento Deportivo") > pasos Info Básica, Categorías, Paquetes, Fechas, Pagos > "Finalizar y Crear Evento".',
                palabrasClave: ['crear evento', 'torneo', 'competencia'],
            },
            {
                tarea: 'Publicar, cerrar inscripciones o cancelar un evento',
                pasos: 'Gestión > Mis Eventos > "Gestionar" > botones de estado: "Publicar Evento", "Cerrar Inscripciones", "Cancelar Evento", "Marcar Completado", "Reabrir" > "Confirmar".',
                palabrasClave: ['publicar', 'cerrar inscripciones', 'cancelar evento'],
            },
            {
                tarea: 'Aprobar o rechazar inscripciones',
                pasos: 'Mis Eventos > "Gestionar" > pestaña "Inscripciones" > "Aprobar" / "Rechazar". Compartir: "Copiar enlace del evento".',
                palabrasClave: ['inscripciones', 'aprobar inscripción', 'link del evento'],
            },
            {
                tarea: 'Editar un evento',
                pasos: 'Mis Eventos > "Gestionar" > pestaña "Editar" > "Guardar Cambios".',
                palabrasClave: ['editar evento', 'cambiar fecha'],
            },
            {
                tarea: 'Reportes del evento',
                pasos: 'Gestión > Reportes > "Exportar CSV".',
                palabrasClave: ['reporte', 'exportar', 'inscritos'],
            },
        ],
        noPuede: ['Gestionar equipos o cobros de una escuela: eso lo hace la escuela en su propia cuenta.'],
    },
};

/** Alias de roles que comparten el mismo mapa. */
const ALIAS: Record<string, string> = {
    owner: 'school',
    school_admin: 'school',
    staff: 'coach',
    external_vendor: 'store_owner',
};

// ─── Selección por pregunta ─────────────────────────────────────────────────
// El mapa completo de escuela pesa ~4.000 tokens y Groq (respaldo) tiene un
// tope de 8.000 tokens por minuto: con el mapa entero cabían ~2 preguntas por
// minuto (QA 2026-10-06). Con la pregunta a mano, solo las tareas que
// coinciden van con sus pasos; el resto va como lista de nombres, para que el
// modelo sepa que existen y el usuario pueda pedir detalle en el siguiente
// mensaje.

const MAX_TAREAS_DETALLADAS = 7;
const SIGLAS = new Set(['qr', 'pdf', 'pse', 'nit']);

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const palabras = (s: string) => normalizar(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2 || SIGLAS.has(w));
/** ¿Difieren en a lo sumo una letra (sobra, falta o cambia)? Para "asitencia" vs "asistencia". */
function unaLetra(a: string, b: string): boolean {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    let j = 0;
    let dif = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i++; j++; continue; }
        if (++dif > 1) return false;
        if (a.length > b.length) i++;
        else if (b.length > a.length) j++;
        else { i++; j++; }
    }
    return dif + (a.length - i) + (b.length - j) <= 1;
}

/**
 * ¿La palabra del usuario `q` coincide con la del mapa `w`? Por prefijo común
 * de 4 letras ("pagos"/"pago", "equipos"/"equipo") o, en palabras largas, por
 * una letra de diferencia (errores de tipeo: "asitencia").
 */
function coincide(q: string, w: string): boolean {
    if (q === w) return true;
    // "entreno"/"entrenamiento", "inscribir"/"inscripción"
    if (q.length >= 5 && w.length >= 5 && q.slice(0, 5) === w.slice(0, 5)) return true;
    // "pagos"/"pago", "plan"/"planes"
    if (q.length >= 4 && w.length >= 4 && q.slice(0, 4) === w.slice(0, 4) && Math.abs(q.length - w.length) <= 2) return true;
    return q.length >= 6 && unaLetra(q, w);
}

/**
 * Qué tareas van con sus pasos. Primero, cada palabra DISTINTIVA de la
 * pregunta trae sus dos mejores tareas; después se llenan los cupos por
 * puntaje total. Sumar puntajes a secas no alcanzaba: "crear" está en casi
 * todas las tareas y "CREAR PAGOS" traía crear equipo, sede y QR, y el pago
 * de último (QA 2026-10-06).
 */
function seleccionar(tareas: AppMapEntry[], consulta: string[]): AppMapEntry[] {
    const textos = tareas.map((t) => ({
        fuerte: palabras(`${t.tarea} ${(t.palabrasClave || []).join(' ')}`),
        debil: palabras(t.pasos),
    }));
    const n = tareas.length;
    const porPalabra = consulta.map((q) => textos.map((x) =>
        (x.fuerte.some((w) => coincide(q, w)) ? 3 : 0) + (x.debil.some((w) => coincide(q, w)) ? 1 : 0)));
    // Palabras que aparecen en más de la mitad de las tareas ("que", "para",
    // "como", "crear") no distinguen nada y no reservan cupo.
    const df = porPalabra.map((ps) => ps.filter((p) => p > 0).length);
    const peso = df.map((d) => (d ? Math.log((n + 1) / d) : 0));
    const total = textos.map((_, j) => porPalabra.reduce((s, ps, i) => s + ps[j] * peso[i], 0));

    const elegidas: number[] = [];
    const agregar = (j: number) => { if (!elegidas.includes(j) && elegidas.length < MAX_TAREAS_DETALLADAS) elegidas.push(j); };
    porPalabra.forEach((ps, i) => {
        if (!df[i] || df[i] > n / 2) return;
        ps.map((p, j) => ({ p, j })).filter((x) => x.p > 0)
            .sort((a, b) => b.p - a.p || total[b.j] - total[a.j])
            .slice(0, 2)
            .forEach((x) => agregar(x.j));
    });
    total.map((p, j) => ({ p, j })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p).forEach((x) => agregar(x.j));
    return elegidas.map((j) => tareas[j]);
}

function renderTarea(t: AppMapEntry): string {
    return `- ${t.tarea}: ${t.pasos}${t.articulo ? ` (guía: /ayuda/${t.articulo})` : ''}`;
}

function renderRol(r: AppMapRole, consulta?: string): string {
    let tareas: string;
    const q = [...new Set(palabras(consulta || ''))];
    const detalle = q.length ? seleccionar(r.tareas, q) : [];
    // Sin pregunta, o si nada coincide ("hola", una frase rara): mapa entero.
    // Mejor gastar tokens que dejar al modelo sin rutas e inventando.
    if (!detalle.length) {
        tareas = r.tareas.map(renderTarea).join('\n');
    } else {
        const resto = r.tareas.filter((t) => !detalle.includes(t)).map((t) => t.tarea);
        tareas = [
            ...detalle.map(renderTarea),
            resto.length ? `Otras tareas que también puede hacer (sin detalle aquí): ${resto.join(' · ')}` : '',
        ].filter(Boolean).join('\n');
    }
    const noPuede = r.noPuede.map((n) => `- ${n}`).join('\n');
    return [`### ${r.rol}`, r.resumen, 'MENÚ LATERAL:', r.menu, 'CÓMO HACER:', tareas, 'NO PUEDE (y quién sí):', noPuede].join('\n');
}

/**
 * Bloque de texto plano con el mapa de la app de los roles dados, para el
 * system prompt. Ignora roles desconocidos, deduplica (incluyendo alias) y
 * devuelve '' si ninguno aplica. Con `consulta`, detalla solo las tareas que
 * coinciden con ella (ver arriba).
 */
export function appMapParaRol(roles: string[], consulta?: string): string {
    const vistos = new Set<string>();
    const bloques: string[] = [];
    for (const raw of roles || []) {
        const key = ALIAS[raw] ?? raw;
        if (vistos.has(key) || !APP_MAP[key]) continue;
        vistos.add(key);
        bloques.push(renderRol(APP_MAP[key], consulta));
    }
    if (!bloques.length) return '';
    return ['MAPA DE LA APP (rutas del menú y botones reales; úsalo para "¿dónde/cómo hago X?"):', ...bloques, SOPORTE].join('\n\n');
}
