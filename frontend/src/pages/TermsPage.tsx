import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsPage() {
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
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Terminos y Condiciones de Uso</h1>
          </div>
          <p className="text-muted-foreground text-sm">Ultima actualizacion: abril de 2026</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8 text-sm text-muted-foreground leading-relaxed">

        {/* 1. Aceptación */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">1. Aceptación de los Términos</h2>
          <p>
            Al registrarte y utilizar la plataforma SportMaps (en adelante "la Plataforma"), aceptas de manera expresa, voluntaria e informada los presentes Términos y Condiciones, así como la{' '}
            <Link to="/politica-de-privacidad" className="text-[#248223] hover:underline font-medium">Política de Privacidad y Tratamiento de Datos Personales</Link>.
            Si no estás de acuerdo con alguno de ellos, no debes utilizar la Plataforma.
          </p>
          <p className="mt-2">
            SportMaps es operado por <strong className="text-foreground">SportMaps Technology S.A.S.</strong>, empresa constituida conforme a las leyes de la República de Colombia, con domicilio en Bogotá D.C.
          </p>
          <p className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800">
            <strong>Importante:</strong> La aceptación de estos Términos y de la Política de Privacidad es <strong>obligatoria</strong> para completar el registro en la Plataforma. Al marcar las casillas de aceptación y crear tu cuenta, declaras haber leído, comprendido y aceptado íntegramente ambos documentos.
          </p>
        </section>

        {/* 2. Descripción del servicio */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">2. Descripción del Servicio</h2>
          <p>SportMaps es una plataforma digital de gestión deportiva que conecta a diferentes actores del ecosistema deportivo. Los servicios disponibles varían según el rol del usuario:</p>

          <div className="mt-3 space-y-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-medium text-foreground">Escuelas y academias deportivas (school, school_admin):</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Gestión de estudiantes, equipos, sedes y staff</li>
                <li>Configuración y automatización de cobros y mensualidades</li>
                <li>Control de asistencia y reportes operativos/financieros</li>
                <li>Comunicaciones con padres y entrenadores</li>
                <li>Integración con pasarelas de pago (SportMaps Pay)</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-medium text-foreground">Entrenadores (coach) y entrenadores personales (personal_trainer):</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Administración de equipos y sesiones de entrenamiento</li>
                <li>Registro de asistencia y seguimiento de rendimiento</li>
                <li>Creación de planes de entrenamiento</li>
                <li>Gestión de agenda y disponibilidad</li>
                <li>Reportes de rendimiento por atleta</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-medium text-foreground">Padres y acudientes (parent):</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Vinculación por invitación a escuelas</li>
                <li>Consulta de progreso, asistencia y pagos de sus hijos</li>
                <li>Pago de mensualidades e inscripciones</li>
                <li>Reserva de clases para sus hijos</li>
                <li>Mensajería con escuelas y entrenadores</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-medium text-foreground">Atletas y deportistas (athlete):</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Perfil deportivo con estadísticas y objetivos</li>
                <li>Reserva de clases y canchas</li>
                <li>Calendario de actividades y entrenamientos</li>
                <li>Explorar escuelas e inscribirse</li>
                <li>Participación en eventos deportivos</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-medium text-foreground">Organizadores de eventos (organizer):</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Creación y publicación de eventos deportivos (torneos, competencias, campeonatos)</li>
                <li>Gestión de inscripciones individuales y por delegación</li>
                <li>Verificación de documentos de atletas participantes</li>
                <li>Cobro de inscripciones mediante la Plataforma</li>
                <li>Reportes financieros y de participación por evento</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-medium text-foreground">Profesionales de bienestar (wellness_professional):</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Gestión de citas y evaluaciones de salud</li>
                <li>Seguimiento de atletas bajo su cuidado</li>
                <li>Registro de valoraciones y recomendaciones</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-medium text-foreground">Dueños de tienda (store_owner):</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Publicación de productos deportivos en el marketplace</li>
                <li>Gestión de pedidos y transacciones</li>
                <li>Visibilidad ante la comunidad deportiva de SportMaps</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 3. Registro y cuentas */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">3. Registro, Roles y Cuentas de Usuario</h2>
          <p>Para acceder a la Plataforma debes:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Ser mayor de 18 años, o contar con autorización expresa de tu representante legal.</li>
            <li>Proporcionar información verídica, completa y actualizada en el formulario de registro.</li>
            <li>Seleccionar el rol que corresponda a tu actividad dentro del ecosistema deportivo.</li>
            <li><strong className="text-foreground">Aceptar obligatoriamente</strong> estos Términos y Condiciones y la Política de Privacidad antes de completar el registro.</li>
            <li>Mantener la confidencialidad de tu contraseña y no compartirla con terceros.</li>
            <li>Notificar de inmediato a SportMaps si detectas acceso no autorizado a tu cuenta.</li>
          </ul>

          <div className="mt-3 bg-muted/30 rounded-lg p-3">
            <p className="font-medium text-foreground mb-2">Sobre los roles y datos compartidos:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Al seleccionar un rol, aceptas que tus datos serán tratados conforme a las funcionalidades de ese rol, incluyendo la visibilidad de tu perfil para otros usuarios autorizados.</li>
              <li>Si en el futuro cambias de rol o agregas uno adicional, los datos ya proporcionados podrán ser reutilizados para tu nuevo perfil.</li>
              <li>Los roles institucionales (escuela, organizador, tienda) implican que actúas en representación de una entidad y tienes la autoridad legal para hacerlo.</li>
              <li>Tu historial dentro de la Plataforma (actividad, pagos, inscripciones) permanece vinculado a tu cuenta independientemente del rol activo.</li>
            </ul>
          </div>

          <p className="mt-3">
            SportMaps se reserva el derecho de suspender o eliminar cuentas que proporcionen información falsa, incumplan estos Términos o utilicen la Plataforma de manera indebida.
          </p>
        </section>

        {/* 4. Pagos */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">4. Pagos, Facturación y Comisiones</h2>
          <p>
            La Plataforma integra pasarelas de pago para el cobro de mensualidades, inscripciones a eventos y otros conceptos deportivos. Al realizar o recibir un pago aceptas que:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Los pagos son procesados por terceros (Wompi, ePayco, Nequi, Daviplata) y están sujetos a sus propios términos de servicio.</li>
            <li>SportMaps <strong className="text-foreground">no almacena</strong> datos de tarjetas de crédito ni débito en sus servidores.</li>
            <li>Los pagos manuales (transferencias bancarias) quedan sujetos a validación por parte de la institución receptora.</li>
            <li>Las devoluciones o reembolsos de mensualidades son responsabilidad de la escuela o academia correspondiente.</li>
            <li>Las devoluciones por inscripción a eventos son responsabilidad del organizador del evento.</li>
            <li>SportMaps podrá cobrar comisiones por transacciones procesadas a través de SportMaps Pay, conforme a las tarifas vigentes comunicadas a las escuelas y organizadores al momento de activar el servicio.</li>
          </ul>
        </section>

        {/* 5. Eventos */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">5. Eventos Deportivos</h2>
          <p>Los organizadores que publican eventos en la Plataforma aceptan que:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Son responsables de la veracidad de la información del evento (fecha, sede, categorías, precios).</li>
            <li>Deben contar con los permisos y seguros necesarios para la realización del evento.</li>
            <li>Los datos de los atletas inscritos serán compartidos con ellos exclusivamente para la gestión y logística del evento.</li>
            <li>No podrán usar los datos de los participantes para fines distintos al evento en cuestión.</li>
            <li>SportMaps no es responsable de la cancelación, modificación o suspensión de eventos organizados por terceros.</li>
          </ul>
          <p className="mt-2">Los atletas, padres y escuelas que se inscriben en eventos aceptan que:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Sus datos de perfil y documentos de identidad serán compartidos con el organizador del evento.</li>
            <li>Las políticas de reembolso son determinadas por cada organizador.</li>
            <li>Deben cumplir con los requisitos y reglamentos establecidos por el organizador.</li>
          </ul>
        </section>

        {/* 6. Uso aceptable */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">6. Uso Aceptable</h2>
          <p>Queda prohibido utilizar la Plataforma para:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Publicar contenido falso, ofensivo, discriminatorio o ilegal.</li>
            <li>Suplantar la identidad de otra persona u organización.</li>
            <li>Intentar acceder de forma no autorizada a cuentas, datos o sistemas de otros usuarios.</li>
            <li>Realizar actividades que puedan dañar, sobrecargar o deteriorar la infraestructura de SportMaps.</li>
            <li>Usar los datos de otros usuarios obtenidos a través de la Plataforma para fines no autorizados (spam, marketing no solicitado, etc.).</li>
            <li>Usar la Plataforma con fines distintos a la gestión deportiva y educativa.</li>
            <li>Eludir o intentar eludir las restricciones de acceso basadas en roles.</li>
          </ul>
        </section>

        {/* 7. Contenido del usuario */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">7. Contenido del Usuario y Propiedad Intelectual</h2>
          <p>
            Todos los contenidos de SportMaps —incluyendo marca, logotipo, diseño, código fuente, textos e imágenes— son propiedad de SportMaps Technology S.A.S. o sus licenciantes y están protegidos por las leyes colombianas e internacionales de propiedad intelectual.
          </p>
          <p className="mt-2">
            El usuario conserva la titularidad de los datos, documentos e información que cargue a la Plataforma, y otorga a SportMaps una licencia limitada, no exclusiva y revocable para procesarlos con el único fin de prestar el servicio. Esta licencia incluye:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Almacenar y mostrar tu perfil a otros usuarios autorizados según tu rol.</li>
            <li>Procesar documentos cargados (certificados, logos, comprobantes) para las funcionalidades de la Plataforma.</li>
            <li>Generar reportes y estadísticas con tus datos de actividad.</li>
            <li>Mostrar información pública de escuelas y organizadores en la sección "Explorar".</li>
          </ul>
        </section>

        {/* 8. Limitación de responsabilidad */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">8. Limitación de Responsabilidad</h2>
          <p>SportMaps no será responsable por:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Interrupciones del servicio por causas de fuerza mayor, mantenimiento programado o fallos técnicos de terceros.</li>
            <li>Pérdidas económicas derivadas del uso o la imposibilidad de uso de la Plataforma.</li>
            <li>Errores en la información suministrada por los usuarios o las instituciones.</li>
            <li>Decisiones tomadas por escuelas, entrenadores, organizadores o acudientes dentro de la Plataforma.</li>
            <li>La calidad, seguridad o legalidad de los eventos publicados por organizadores externos.</li>
            <li>Los productos vendidos por tiendas en el marketplace.</li>
            <li>Lesiones, daños o perjuicios derivados de la práctica deportiva.</li>
          </ul>
        </section>

        {/* 9. Suspensión */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">9. Suspensión y Cancelación de Cuentas</h2>
          <p>SportMaps podrá suspender temporal o permanentemente una cuenta cuando:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>El usuario incumpla estos Términos o la Política de Privacidad.</li>
            <li>Se detecte actividad fraudulenta o sospechosa.</li>
            <li>Se verifique suplantación de identidad.</li>
            <li>El usuario proporcione documentación falsa o adulterada.</li>
            <li>Exista una orden judicial o administrativa que lo requiera.</li>
          </ul>
          <p className="mt-2">
            El usuario puede solicitar la cancelación de su cuenta en cualquier momento desde la configuración de su perfil o escribiendo a{' '}
            <a href="mailto:soporte@sportmaps.co" className="text-[#248223] hover:underline">soporte@sportmaps.co</a>.
            La eliminación de datos se realizará conforme a lo establecido en la Política de Privacidad.
          </p>
        </section>

        {/* 10. Modificaciones */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">10. Modificaciones a los Términos</h2>
          <p>
            SportMaps podrá modificar estos Términos en cualquier momento. Notificaremos los cambios relevantes mediante correo electrónico o aviso dentro de la Plataforma. El uso continuado del servicio tras la notificación constituye aceptación de las nuevas condiciones.
          </p>
          <p className="mt-2">
            La versión vigente siempre estará disponible en{' '}
            <Link to="/terminos-y-condiciones" className="text-[#248223] hover:underline">sportmaps.co/terminos-y-condiciones</Link>.
          </p>
        </section>

        {/* 11. Ley aplicable */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">11. Ley Aplicable y Jurisdicción</h2>
          <p>
            Estos Términos se rigen por las leyes de la República de Colombia. Cualquier controversia será resuelta ante los jueces competentes de la ciudad de Bogotá D.C., Colombia, salvo que la ley disponga lo contrario.
          </p>
          <p className="mt-2">
            Las partes acuerdan agotar los mecanismos de solución directa antes de acudir a instancias judiciales. Para reclamaciones relacionadas con la Plataforma, el usuario podrá comunicarse primero con nuestro equipo de soporte.
          </p>
        </section>

        {/* 12. Contacto */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">12. Contacto</h2>
          <p>Para dudas sobre estos Términos, escríbenos a:</p>
          <p className="mt-1">
            <strong className="text-foreground">SportMaps Technology S.A.S.</strong><br />
            Bogotá D.C., Colombia<br />
            <a href="mailto:legal@sportmaps.co" className="text-[#248223] hover:underline">legal@sportmaps.co</a><br />
            Línea de atención: <a href="tel:+573128463555" className="text-[#248223] hover:underline">+57 (312) 846-3555</a>
          </p>
        </section>

        <div className="border-t pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} SportMaps Technology S.A.S. Todos los derechos reservados · Colombia
        </div>
      </div>
    </div>
  );
}
