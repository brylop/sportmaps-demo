import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/15 via-primary/10 to-background border-b border-border/40">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <Link to="/register" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors font-medium">
            <ArrowLeft className="w-4 h-4" /> Volver al registro
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Politica de Privacidad</h1>
          </div>
          <p className="text-muted-foreground text-sm">Tratamiento de Datos Personales · Ultima actualizacion: abril de 2026 · Ley 1581 de 2012 (Colombia)</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8 text-sm text-muted-foreground leading-relaxed">

        <section className="bg-[#248223]/5 border border-[#248223]/20 rounded-xl p-4">
          <p>
            En SportMaps nos comprometemos a proteger la privacidad y los datos personales de nuestros usuarios conforme a la <strong className="text-foreground">Ley Estatutaria 1581 de 2012</strong>, el <strong className="text-foreground">Decreto 1377 de 2013</strong> y demás normas concordantes de la República de Colombia. Al registrarte y aceptar esta Política, autorizas de manera expresa, previa e informada el tratamiento de tus datos en los términos aquí descritos.
          </p>
        </section>

        {/* 1. Responsable */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">1. Responsable del Tratamiento</h2>
          <p>
            <strong className="text-foreground">SportMaps Technology S.A.S.</strong>, identificada con NIT en trámite, con domicilio en Bogotá D.C., Colombia.
          </p>
          <p className="mt-2">
            Correo de contacto para datos personales:{' '}
            <a href="mailto:privacidad@sportmaps.co" className="text-[#248223] hover:underline">privacidad@sportmaps.co</a>
          </p>
        </section>

        {/* 2. Datos recopilados por rol */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">2. Datos que Recopilamos</h2>
          <p>Recopilamos datos personales según el rol del usuario dentro de la Plataforma:</p>

          <div className="mt-4 space-y-4">
            <div className="bg-muted/30 rounded-lg p-4">
              <p className="font-medium text-foreground mb-2">Todos los usuarios (datos comunes):</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Nombre completo o razón social</li>
                <li>Correo electrónico</li>
                <li>Número de teléfono</li>
                <li>Fecha de nacimiento (personas naturales)</li>
                <li>Rol seleccionado dentro de la Plataforma</li>
                <li>Dirección IP y datos de sesión (autenticación)</li>
                <li>Fecha y hora de aceptación de Términos y Política de Privacidad</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <p className="font-medium text-foreground mb-2">Escuelas y academias deportivas (school, school_admin):</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Razón social y NIT/RUC de la institución</li>
                <li>Certificado de existencia y representación legal</li>
                <li>Dirección física de sedes</li>
                <li>Datos bancarios para recepción de pagos (cifrados)</li>
                <li>Información de horarios, programas y equipos</li>
                <li>Logo e imagen institucional</li>
                <li>Nombre, cargo y correo del administrador de la cuenta</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <p className="font-medium text-foreground mb-2">Entrenadores (coach):</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Experiencia profesional y certificaciones deportivas</li>
                <li>Especialidad deportiva</li>
                <li>Disponibilidad horaria</li>
                <li>Aceptación del Código de Conducta del Entrenador</li>
                <li>Historial de asistencia y sesiones impartidas</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <p className="font-medium text-foreground mb-2">Padres y acudientes (parent):</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Relación con el menor (padre, madre, acudiente legal)</li>
                <li>Datos de los hijos/menores a su cargo</li>
                <li>Historial de pagos e inscripciones</li>
                <li>Comunicaciones con escuelas y entrenadores</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <p className="font-medium text-foreground mb-2">Atletas y deportistas (athlete):</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Perfil deportivo (deporte, posición, nivel)</li>
                <li>Historial de asistencia y rendimiento</li>
                <li>Entrenamientos, objetivos y estadísticas</li>
                <li>Reservas de clases y canchas</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <p className="font-medium text-foreground mb-2">Menores de edad (a través del acudiente):</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Nombre completo del menor</li>
                <li>Fecha de nacimiento y edad</li>
                <li>Información médica relevante para la práctica deportiva</li>
                <li>Documento de identidad (cuando aplique para eventos)</li>
                <li>Registros de asistencia y rendimiento deportivo</li>
                <li>Fotografías (solo para identificación en eventos, con autorización)</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <p className="font-medium text-foreground mb-2">Organizadores de eventos (organizer):</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Nombre de la organización o razón social</li>
                <li>Datos fiscales y de facturación</li>
                <li>Información de eventos creados (fecha, sede, categorías, precios)</li>
                <li>Documentos de identidad de atletas inscritos en sus eventos</li>
                <li>Registros de inscripciones y delegaciones</li>
                <li>Historial financiero de eventos (ingresos, comisiones)</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <p className="font-medium text-foreground mb-2">Profesionales de bienestar (wellness_professional):</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Especialidad profesional y certificaciones</li>
                <li>Número de tarjeta profesional o registro</li>
                <li>Historial de citas y evaluaciones realizadas</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <p className="font-medium text-foreground mb-2">Dueños de tienda (store_owner):</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Nombre comercial y razón social de la tienda</li>
                <li>NIT/RUC para facturación</li>
                <li>Catálogo de productos publicados</li>
                <li>Historial de pedidos y transacciones</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <p className="font-medium text-foreground mb-2">Entrenadores personales (personal_trainer):</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Certificaciones y especialidades</li>
                <li>Disponibilidad y tarifas</li>
                <li>Historial de sesiones con clientes</li>
                <li>Planes de entrenamiento creados</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 3. Finalidad */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">3. Finalidad del Tratamiento</h2>
          <p>Tus datos serán utilizados para las siguientes finalidades:</p>

          <div className="mt-3 space-y-3">
            <div>
              <p className="font-medium text-foreground">Finalidades principales (necesarias para el servicio):</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Gestionar tu cuenta, autenticación y perfil dentro de la Plataforma.</li>
                <li>Asignar y administrar roles, permisos y accesos según tu tipo de usuario.</li>
                <li>Procesar inscripciones, matrículas, pagos de mensualidades y transacciones.</li>
                <li>Registrar y visualizar asistencia, progreso y rendimiento deportivo.</li>
                <li>Facilitar la comunicación entre escuelas, entrenadores, padres y atletas.</li>
                <li>Gestionar eventos deportivos, inscripciones, delegaciones y verificación de documentos.</li>
                <li>Generar reportes operativos, financieros y de rendimiento para los usuarios autorizados.</li>
                <li>Cumplir obligaciones legales, tributarias y regulatorias colombianas.</li>
              </ul>
            </div>

            <div>
              <p className="font-medium text-foreground">Uso de datos entre roles y registros futuros:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong className="text-foreground">Vinculación entre roles:</strong> Los datos proporcionados al registrarte pueden ser utilizados para facilitar la conexión con otros usuarios de la Plataforma según tu rol. Por ejemplo, un padre puede ser vinculado a la escuela donde inscribe a su hijo; un atleta puede ser visible para el entrenador de su equipo.</li>
                <li><strong className="text-foreground">Inscripciones y eventos:</strong> Al inscribirte en un evento, tus datos de perfil (nombre, documento de identidad, categoría deportiva) serán compartidos con el organizador del evento para fines de gestión, verificación y logística.</li>
                <li><strong className="text-foreground">Registros futuros:</strong> Si cambias de rol o agregas un rol adicional dentro de la Plataforma, los datos ya proporcionados podrán ser reutilizados para pre-llenar tu nuevo perfil, evitando que debas ingresarlos nuevamente.</li>
                <li><strong className="text-foreground">Historial unificado:</strong> Tu historial de actividad (asistencia, pagos, inscripciones, eventos) se mantiene asociado a tu cuenta y puede ser consultado desde cualquier rol activo que tengas.</li>
                <li><strong className="text-foreground">Directorio deportivo:</strong> Los perfiles de escuelas, entrenadores y organizadores pueden aparecer en el directorio público de SportMaps (sección "Explorar") con la información que cada usuario elija hacer visible.</li>
              </ul>
            </div>

            <div>
              <p className="font-medium text-foreground">Finalidades secundarias (opcionales):</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Enviar comunicaciones promocionales y noticias sobre SportMaps (solo con tu consentimiento previo).</li>
                <li>Mejorar la Plataforma mediante análisis agregado y anónimo de uso.</li>
                <li>Realizar encuestas de satisfacción sobre el servicio.</li>
              </ul>
            </div>
          </div>

          <p className="mt-4 text-[#8a3a00] bg-orange-50 border border-orange-200 rounded-lg p-3">
            <strong>SportMaps NO vende, alquila ni comercializa tus datos personales a terceros con fines publicitarios o de marketing.</strong>
          </p>
        </section>

        {/* 4. Menores */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">4. Tratamiento de Datos de Menores de Edad</h2>
          <p>
            De conformidad con el <strong className="text-foreground">Artículo 7 de la Ley 1581 de 2012</strong>, el tratamiento de datos de menores de edad requiere la autorización expresa del padre, madre o representante legal.
          </p>
          <p className="mt-2">
            Al registrar a un menor en la Plataforma, el acudiente declara ser su representante legal y autoriza expresamente el tratamiento de los datos del menor para los fines descritos en esta Política. Esto incluye:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Registro de asistencia y rendimiento deportivo por parte de entrenadores y escuelas.</li>
            <li>Compartir datos de identificación del menor con organizadores de eventos en los que participe.</li>
            <li>Generación de reportes de progreso visibles para el acudiente y la escuela.</li>
            <li>Almacenamiento de información médica relevante para la práctica deportiva segura.</li>
          </ul>
          <p className="mt-2">
            El representante legal puede revocar esta autorización en cualquier momento escribiendo a{' '}
            <a href="mailto:privacidad@sportmaps.co" className="text-[#248223] hover:underline">privacidad@sportmaps.co</a>.
          </p>
        </section>

        {/* 5. Consentimiento */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">5. Obtención del Consentimiento</h2>
          <p>Tu consentimiento para el tratamiento de datos se obtiene de las siguientes formas:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong className="text-foreground">Al registrarte:</strong> mediante la aceptación explícita (checkbox obligatorio) de esta Política de Privacidad y los Términos y Condiciones antes de crear tu cuenta.</li>
            <li><strong className="text-foreground">Al inscribirte en eventos:</strong> al confirmar la inscripción en un evento, autorizas compartir tus datos con el organizador.</li>
            <li><strong className="text-foreground">Al activar SportMaps Pay:</strong> las escuelas aceptan términos adicionales de tratamiento de datos financieros al habilitar la pasarela de pagos.</li>
            <li><strong className="text-foreground">Newsletter (opcional):</strong> la suscripción a comunicaciones promocionales requiere consentimiento separado y puede revocarse en cualquier momento.</li>
          </ul>
          <p className="mt-2">
            Registramos la fecha, hora e IP de cada aceptación para efectos probatorios conforme a la ley.
          </p>
        </section>

        {/* 6. Seguridad */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">6. Seguridad de los Datos</h2>
          <p>SportMaps implementa medidas técnicas y organizativas para proteger tus datos:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Cifrado en tránsito mediante TLS/HTTPS en todas las comunicaciones.</li>
            <li>Almacenamiento seguro en Supabase (infraestructura certificada ISO 27001, SOC 2 Type II).</li>
            <li>Control de acceso por roles (RLS — Row Level Security) — cada usuario solo ve la información que le corresponde según su rol.</li>
            <li>Las contraseñas se almacenan con hash irreversible (bcrypt).</li>
            <li>Los datos bancarios de las instituciones se almacenan de forma cifrada.</li>
            <li>Autenticación segura con tokens JWT y sesiones con expiración automática.</li>
            <li>Los datos de tarjetas de crédito y débito son procesados exclusivamente por la pasarela de pagos (Wompi) y nunca almacenados en nuestros servidores.</li>
          </ul>
        </section>

        {/* 7. Compartición */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">7. Compartición de Datos con Terceros</h2>
          <p>Podemos compartir datos personales únicamente en los siguientes casos:</p>

          <div className="mt-3 space-y-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-medium text-foreground">Dentro de la Plataforma (entre usuarios):</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Las escuelas pueden ver los datos de los atletas inscritos y sus acudientes.</li>
                <li>Los entrenadores pueden ver los datos de los atletas de sus equipos.</li>
                <li>Los padres pueden ver los datos de sus hijos y las escuelas donde están inscritos.</li>
                <li>Los organizadores de eventos pueden ver datos de atletas y delegaciones inscritas.</li>
                <li>Los perfiles públicos de escuelas y organizadores son visibles en la sección "Explorar".</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-medium text-foreground">Proveedores de servicio externos:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><strong className="text-foreground">Wompi / ePayco:</strong> pasarelas de pago para procesar transacciones financieras.</li>
                <li><strong className="text-foreground">Supabase:</strong> proveedor de base de datos, autenticación e infraestructura en la nube.</li>
                <li><strong className="text-foreground">Resend:</strong> servicio de envío de correos electrónicos transaccionales (confirmaciones, recordatorios).</li>
                <li><strong className="text-foreground">Vercel:</strong> plataforma de hosting y despliegue de la aplicación web.</li>
                <li><strong className="text-foreground">Sentry:</strong> monitoreo de errores técnicos (datos anonimizados).</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-medium text-foreground">Por obligación legal:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Autoridades judiciales o administrativas colombianas cuando la ley lo exija.</li>
                <li>La Superintendencia de Industria y Comercio (SIC) en ejercicio de sus funciones.</li>
                <li>La DIAN para efectos tributarios cuando corresponda.</li>
              </ul>
            </div>
          </div>

          <p className="mt-3">
            Todos los proveedores externos están sujetos a acuerdos de confidencialidad y tratamiento de datos compatibles con esta Política y la legislación colombiana.
          </p>
        </section>

        {/* 8. Derechos */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">8. Tus Derechos (Ley 1581 de 2012)</h2>
          <p>Como titular de tus datos personales tienes derecho a:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong className="text-foreground">Conocer</strong> qué datos tuyos tratamos y la finalidad de su tratamiento.</li>
            <li><strong className="text-foreground">Actualizar</strong> tus datos cuando sean incorrectos o estén desactualizados.</li>
            <li><strong className="text-foreground">Rectificar</strong> información inexacta o incompleta.</li>
            <li><strong className="text-foreground">Suprimir</strong> tus datos cuando no sean necesarios para los fines declarados o cuando haya vencido el término de tratamiento.</li>
            <li><strong className="text-foreground">Revocar</strong> la autorización de tratamiento en cualquier momento.</li>
            <li><strong className="text-foreground">Solicitar prueba</strong> de la autorización otorgada, salvo cuando la ley no lo exija.</li>
            <li><strong className="text-foreground">Acceder gratuitamente</strong> a tus datos al menos una vez al mes.</li>
            <li><strong className="text-foreground">Presentar quejas</strong> ante la Superintendencia de Industria y Comercio (SIC) por violación a la ley.</li>
          </ul>
          <p className="mt-2">
            Para ejercer tus derechos escríbenos a{' '}
            <a href="mailto:privacidad@sportmaps.co" className="text-[#248223] hover:underline">privacidad@sportmaps.co</a>{' '}
            indicando tu nombre, correo registrado y el derecho que deseas ejercer.
            Responderemos en un plazo máximo de <strong className="text-foreground">10 días hábiles</strong> (consultas) o <strong className="text-foreground">15 días hábiles</strong> (reclamos), conforme al artículo 14 de la Ley 1581 de 2012.
          </p>
        </section>

        {/* 9. Retención */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">9. Retención y Eliminación de Datos</h2>
          <p>
            Conservamos tus datos mientras mantengas una cuenta activa en SportMaps. Tras la eliminación de tu cuenta:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Los datos personales serán eliminados o anonimizados en un plazo de <strong className="text-foreground">30 días hábiles</strong>.</li>
            <li>Los registros contables y financieros se conservarán por <strong className="text-foreground">10 años</strong> conforme al Código de Comercio colombiano (Art. 28).</li>
            <li>Los registros de consentimiento (fecha y hora de aceptación de esta Política) se conservarán como prueba legal mientras sea requerido.</li>
            <li>Los datos anonimizados podrán conservarse indefinidamente para fines estadísticos.</li>
          </ul>
        </section>

        {/* 10. Cookies */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">10. Cookies y Tecnologías de Rastreo</h2>
          <p>SportMaps utiliza las siguientes tecnologías:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong className="text-foreground">Cookies de sesión:</strong> estrictamente necesarias para la autenticación y el funcionamiento de la Plataforma. Se eliminan al cerrar sesión.</li>
            <li><strong className="text-foreground">LocalStorage:</strong> para almacenar preferencias del usuario (tema, idioma) de forma local en tu dispositivo.</li>
            <li><strong className="text-foreground">Tokens JWT:</strong> para mantener la sesión autenticada de forma segura.</li>
          </ul>
          <p className="mt-2">
            <strong className="text-foreground">No utilizamos</strong> cookies de rastreo publicitario, píxeles de seguimiento ni compartimos datos de navegación con redes publicitarias o de marketing.
          </p>
        </section>

        {/* 11. Transferencia internacional */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">11. Transferencia Internacional de Datos</h2>
          <p>
            Algunos de nuestros proveedores de infraestructura (Supabase, Vercel, Resend) tienen servidores ubicados fuera de Colombia. Al aceptar esta Política, autorizas la transferencia internacional de tus datos a estos proveedores, quienes cumplen con estándares de protección equivalentes a los exigidos por la legislación colombiana (Decreto 1377 de 2013, Art. 26).
          </p>
        </section>

        {/* 12. Cambios */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">12. Cambios en esta Política</h2>
          <p>
            Podemos actualizar esta Política periódicamente. Notificaremos los cambios relevantes mediante:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Correo electrónico al email registrado en tu cuenta.</li>
            <li>Aviso visible dentro de la Plataforma al iniciar sesión.</li>
            <li>Actualización de la fecha "Última actualización" en este documento.</li>
          </ul>
          <p className="mt-2">
            La versión vigente siempre estará disponible en{' '}
            <Link to="/politica-de-privacidad" className="text-[#248223] hover:underline">sportmaps.co/politica-de-privacidad</Link>.
            El uso continuado de la Plataforma tras la notificación constituye aceptación de la versión actualizada.
          </p>
        </section>

        {/* 13. Contacto */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">13. Contacto y Consultas</h2>
          <p>
            <strong className="text-foreground">Oficial de Protección de Datos — SportMaps Technology S.A.S.</strong><br />
            Bogotá D.C., Colombia<br />
            <a href="mailto:privacidad@sportmaps.co" className="text-[#248223] hover:underline">privacidad@sportmaps.co</a><br />
            Línea de atención: <a href="tel:+573128463555" className="text-[#248223] hover:underline">+57 (312) 846-3555</a>
          </p>
          <p className="mt-3">
            Si consideras que SportMaps ha vulnerado tus derechos como titular de datos, puedes presentar una queja ante la{' '}
            <strong className="text-foreground">Superintendencia de Industria y Comercio (SIC)</strong>:{' '}
            <a href="https://www.sic.gov.co" target="_blank" rel="noopener noreferrer" className="text-[#248223] hover:underline">www.sic.gov.co</a>
          </p>
        </section>

        <div className="border-t pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} SportMaps Technology S.A.S. · Política de Privacidad conforme a la Ley 1581 de 2012 · Colombia
        </div>
      </div>
    </div>
  );
}
