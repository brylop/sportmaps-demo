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
          <p className="text-muted-foreground text-sm">Ultima actualizacion: abril de 2026 · Version 2.0</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8 text-sm text-muted-foreground leading-relaxed">

        {/* Preámbulo */}
        <section className="bg-[#248223]/5 border border-[#248223]/20 rounded-xl p-4">
          <p>
            Estos Términos y Condiciones (los <strong className="text-foreground">"Términos"</strong>) constituyen un contrato vinculante entre tú (en adelante, el <strong className="text-foreground">"Usuario"</strong>) y <strong className="text-foreground">SportMaps Technology S.A.S.</strong> (en adelante, <strong className="text-foreground">"SportMaps"</strong>), que regula el acceso y uso del sitio web{' '}
            <a href="https://sportmaps.co" target="_blank" rel="noopener noreferrer" className="text-[#248223] hover:underline">sportmaps.co</a>, de sus subdominios (dev.sportmaps.co, app.sportmaps.co) y de cualquier aplicación móvil asociada (el <strong className="text-foreground">"Sitio"</strong> o la <strong className="text-foreground">"Plataforma"</strong>).
          </p>
          <p className="mt-2">
            Lee estos Términos cuidadosamente antes de acceder al Sitio o utilizar sus servicios. Al registrarte o usar la Plataforma manifiestas haberlos leído, entendido y aceptado íntegramente, junto con la{' '}
            <Link to="/politica-de-privacidad" className="text-[#248223] hover:underline font-medium">Política de Privacidad y Tratamiento de Datos Personales</Link>. Si no estás de acuerdo con alguna de sus disposiciones, deberás abstenerte de usar el Sitio.
          </p>
        </section>

        {/* 1. Aceptación */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">1. Aceptación de los Términos</h2>
          <p>
            La aceptación de estos Términos y de la Política de Privacidad es <strong className="text-foreground">obligatoria, expresa, previa e informada</strong>, y constituye requisito indispensable para completar el registro, acceder a las funcionalidades reservadas a usuarios autenticados y utilizar cualquier servicio asociado a la Plataforma.
          </p>
          <p className="mt-2">
            Al marcar las casillas de aceptación al momento del registro, al iniciar sesión con posterioridad a la publicación de una nueva versión de estos Términos, o al continuar usando el Sitio tras haber recibido una notificación de actualización, el Usuario declara y acepta expresamente haber leído, comprendido y aceptado la totalidad del contenido de estos Términos y de la Política de Privacidad.
          </p>
          <p className="mt-2">
            SportMaps registrará la fecha, hora, dirección IP y versión del documento aceptado como prueba legal de la manifestación de voluntad del Usuario.
          </p>
          <p className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800">
            <strong>Importante:</strong> Para poder registrarse en la Plataforma y adquirir productos o servicios ofrecidos por SportMaps, el Usuario debe ser <strong>mayor de 18 años</strong> o actuar como representante legal de una persona jurídica o de un menor de edad con capacidad suficiente para obligarse contractualmente.
          </p>
        </section>

        {/* 2. Descripción del servicio */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">2. Descripción del Servicio</h2>
          <p>
            SportMaps es una plataforma digital de gestión deportiva que conecta a diferentes actores del ecosistema deportivo (escuelas, academias, entrenadores, padres, atletas, organizadores de eventos, profesionales de bienestar y tiendas). SportMaps actúa como <strong className="text-foreground">herramienta tecnológica de intermediación</strong> y no presta directamente servicios de entrenamiento deportivo, tratamientos médicos, asesoría profesional, ni organiza por cuenta propia eventos deportivos.
          </p>
          <p className="mt-2">Los servicios disponibles varían según el rol del Usuario:</p>

          <div className="mt-3 space-y-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-medium text-foreground">Escuelas y academias deportivas (school, school_admin):</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Gestión de deportistas, equipos, sedes y staff</li>
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

          <p className="mt-3">
            SportMaps actualiza continuamente el catálogo de funcionalidades, escuelas, eventos y servicios visibles en la Plataforma. SportMaps no garantiza la disponibilidad permanente de ninguna escuela, entrenador, evento o tercero específico, los cuales podrán ser reemplazados, modificados o retirados en cualquier momento sin previo aviso al Usuario.
          </p>
        </section>

        {/* 3. Registro y cuentas */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">3. Registro, Roles y Cuentas de Usuario</h2>
          <p>Para acceder a la Plataforma el Usuario debe:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Ser mayor de 18 años, o contar con autorización expresa de su representante legal.</li>
            <li>Proporcionar información verídica, precisa, completa y actualizada en el formulario de registro, y mantenerla vigente durante todo el tiempo que conserve la cuenta.</li>
            <li>Seleccionar el rol que corresponda a su actividad real dentro del ecosistema deportivo.</li>
            <li><strong className="text-foreground">Aceptar obligatoriamente</strong> estos Términos y Condiciones y la Política de Privacidad antes de completar el registro.</li>
            <li>Crear una contraseña y mantenerla en estricta confidencialidad.</li>
            <li>No compartir su cuenta con terceros ni permitir el acceso de otras personas a la misma.</li>
            <li>Notificar de inmediato a SportMaps cualquier uso no autorizado de su cuenta o sospecha de vulneración de su contraseña.</li>
          </ul>

          <div className="mt-3 bg-muted/30 rounded-lg p-3">
            <p className="font-medium text-foreground mb-2">Responsabilidad por la cuenta:</p>
            <p>
              El Usuario es el único responsable de mantener la confidencialidad de su cuenta y contraseña y de restringir el acceso a sus dispositivos. Entiende y acepta la responsabilidad por todas las actividades que ocurran bajo su cuenta y por todos los usos de su registro en la Plataforma, estén o no autorizados por él.
            </p>
          </div>

          <div className="mt-3 bg-muted/30 rounded-lg p-3">
            <p className="font-medium text-foreground mb-2">Prohibición de múltiples cuentas:</p>
            <p>
              El Usuario se obliga a no crear más de una cuenta personal. En caso de existir cuentas duplicadas, SportMaps podrá fusionarlas, suspender las inactivas o cancelar aquellas que presenten información duplicada o fraudulenta, sin que ello genere derecho de indemnización alguna a favor del Usuario. SportMaps no se hará responsable por cobros, pagos, inscripciones o movimientos realizados desde cuentas alternas no utilizadas.
            </p>
          </div>

          <div className="mt-3 bg-muted/30 rounded-lg p-3">
            <p className="font-medium text-foreground mb-2">Sobre los roles y datos compartidos:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Al seleccionar un rol, el Usuario acepta que sus datos serán tratados conforme a las funcionalidades de ese rol, incluyendo la visibilidad de su perfil para otros usuarios autorizados.</li>
              <li>Si en el futuro cambia de rol o agrega uno adicional, los datos ya proporcionados podrán ser reutilizados para el nuevo perfil.</li>
              <li>Los roles institucionales (escuela, organizador, tienda) implican que el Usuario actúa en representación de una entidad y declara bajo gravedad de juramento tener la autoridad legal para hacerlo.</li>
              <li>El historial dentro de la Plataforma (actividad, pagos, inscripciones) permanece vinculado a la cuenta independientemente del rol activo.</li>
            </ul>
          </div>

          <p className="mt-3">
            SportMaps se reserva el derecho, a su exclusiva discreción y sin necesidad de expresar las razones de su decisión, de: (i) solicitar comprobantes adicionales para corroborar la información ingresada; (ii) rechazar cualquier solicitud de registro; (iii) cancelar un registro previamente aceptado; y (iv) suspender o eliminar cuentas que proporcionen información falsa, incumplan estos Términos o utilicen la Plataforma de manera indebida, sin que ello genere derecho a indemnización o resarcimiento económico a favor del Usuario.
          </p>
        </section>

        {/* 4. Propiedad intelectual y uso del sitio */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">4. Propiedad Intelectual y Uso del Sitio</h2>

          <p className="font-medium text-foreground">4.1. Derechos de propiedad intelectual</p>
          <p className="mt-2">
            El Sitio y sus aplicaciones móviles son de propiedad exclusiva de SportMaps. Todo el contenido disponible en la Plataforma —incluyendo sin limitación textos, gráficas, imágenes, logotipos, íconos, software, código fuente, bases de datos, diseño, interfaces, marcas, nombres comerciales, reportes generados y cualquier otro material o signo distintivo (el <strong className="text-foreground">"Material"</strong>)— es de propiedad de SportMaps Technology S.A.S. o de sus licenciantes, y está protegido por las leyes colombianas e internacionales de propiedad intelectual.
          </p>
          <p className="mt-2">
            Se concede al Usuario una licencia limitada, no exclusiva, intransferible y revocable para consultar, revisar y usar el Material únicamente dentro del Sitio y para su uso personal o institucional lícito, conforme al rol registrado. Esta licencia no implica cesión ni transferencia de derechos de propiedad intelectual.
          </p>

          <p className="font-medium text-foreground mt-4">4.2. Usos prohibidos del Material</p>
          <p className="mt-2">Queda expresamente prohibido al Usuario:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Vender, licenciar, alquilar, sublicenciar o modificar el Material, total o parcialmente.</li>
            <li>Copiar, reproducir, publicar, exhibir, transmitir, distribuir o comunicar al público el Material sin autorización previa, expresa y por escrito de SportMaps.</li>
            <li>Crear trabajos derivados o adaptaciones del Material.</li>
            <li>Descompilar, desensamblar, hacer ingeniería inversa o intentar extraer el código fuente del software de la Plataforma.</li>
            <li>Realizar scraping, extracción masiva o automatizada de datos (incluyendo el uso de bots, crawlers, arañas o scripts), salvo autorización expresa y por escrito de SportMaps.</li>
            <li>Enmarcar (framing), reproducir fragmentos o integrar contenido de la Plataforma en sitios o aplicaciones de terceros.</li>
            <li>Remover, ocultar o alterar avisos de derechos de autor, marcas registradas u otros signos de propiedad intelectual.</li>
          </ul>
          <p className="mt-2">
            El uso no autorizado del Material constituye una violación de las leyes sobre Propiedad Intelectual y podrá acarrear responsabilidades civiles y penales.
          </p>

          <p className="font-medium text-foreground mt-4">4.3. Conductas técnicas prohibidas</p>
          <p className="mt-2">Adicionalmente, el Usuario se obliga a no realizar ninguna de las siguientes conductas:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Acceder a información o secciones que no estén dirigidas o autorizadas para su rol o cuenta.</li>
            <li>Eludir o intentar eludir las medidas de seguridad, autenticación o controles de acceso basados en roles (RLS).</li>
            <li>Probar la vulnerabilidad del Sitio, servidores o red sin autorización previa y por escrito de SportMaps.</li>
            <li>Introducir virus, troyanos, malware, bombas lógicas o cualquier otro código malicioso.</li>
            <li>Interferir con el funcionamiento adecuado del Sitio o con la prestación del servicio a otros usuarios.</li>
            <li>Enviar correo electrónico no solicitado (spam), promociones o publicidad no autorizada a otros Usuarios obtenidos a través de la Plataforma.</li>
            <li>Incluir o colocar en el Sitio información falsa, inexacta, incompleta o engañosa.</li>
            <li>Hacerse pasar por otra persona o entidad (suplantación de identidad).</li>
          </ul>
          <p className="mt-2">
            La violación de cualquier sistema o medida de seguridad podrá resultar en responsabilidades civiles y penales. SportMaps investigará estos hechos y cooperará con las autoridades competentes que así lo requieran.
          </p>
        </section>

        {/* 5. Pagos */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">5. Pagos, Facturación y Comisiones</h2>
          <p>
            La Plataforma integra pasarelas de pago para el cobro de mensualidades, inscripciones a eventos, reservas y otros conceptos deportivos. Al realizar o recibir un pago, el Usuario acepta que:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Los pagos son procesados por terceros (Wompi, Nequi, Daviplata) y están sujetos a sus propios términos de servicio y políticas de seguridad.</li>
            <li>SportMaps <strong className="text-foreground">no almacena</strong> datos completos de tarjetas de crédito ni débito en sus servidores. Los datos financieros son tratados por la pasarela de pago bajo estándares PCI-DSS.</li>
            <li>Los pagos manuales (transferencias bancarias, consignaciones) quedan sujetos a validación por parte de la institución receptora.</li>
            <li>Las devoluciones o reembolsos de mensualidades son responsabilidad de la escuela o academia correspondiente y se regirán por las políticas internas de cada institución.</li>
            <li>Las devoluciones por inscripción a eventos son responsabilidad exclusiva del organizador del evento.</li>
            <li>SportMaps podrá cobrar comisiones por transacciones procesadas a través de SportMaps Pay, conforme a las tarifas vigentes comunicadas a escuelas y organizadores al momento de activar el servicio.</li>
            <li>Es obligación del Usuario mantener actualizada y vigente su forma de pago.</li>
            <li>Si un cobro automatizado falla por caducidad, insuficiencia de fondos u otra causa imputable al Usuario, éste continuará siendo responsable de los importes adeudados.</li>
          </ul>
          <p className="mt-2">
            Los pagos efectivamente realizados no son reembolsables por servicios utilizados parcialmente, salvo en los casos expresamente previstos en la ley o en las políticas de la escuela u organizador correspondiente.
          </p>
        </section>

        {/* 6. Reservas, cancelaciones y asistencia */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">6. Reservas de Clases, Cancelaciones y Asistencia</h2>
          <p>
            El Usuario deberá realizar y cancelar las reservas de clases, entrenamientos y sesiones únicamente a través de la Plataforma. Las reservas o cancelaciones realizadas directamente con el entrenador, escuela o centro —por fuera de la Plataforma— podrán ser consideradas como una violación de estos Términos.
          </p>
          <p className="mt-2">
            Cada escuela o entrenador podrá definir sus propias políticas de cancelación, asistencia, no-show (inasistencia sin aviso previo) y reposición. SportMaps pondrá a disposición las herramientas técnicas para aplicar estas políticas, pero no es responsable por su contenido, cumplimiento ni por las consecuencias derivadas de su aplicación.
          </p>
          <p className="mt-2">
            El Usuario entiende que las escuelas o entrenadores podrán cobrar multas o tarifas por cancelación tardía o por inasistencia sin aviso previo, conforme a las políticas que cada institución haya publicado dentro de la Plataforma. El valor de estas multas será debitado mediante la forma de pago autorizada por el Usuario.
          </p>
          <p className="mt-2">
            Si una escuela o entrenador cancela una clase por caso fortuito, fuerza mayor, afectación de la conexión de red Wifi o cualquier otra causa no imputable a SportMaps, el Usuario reconoce que dichas circunstancias no pueden conocerse con antelación y que SportMaps no estará obligado a otorgar reposición económica ni de servicios.
          </p>
        </section>

        {/* 7. Eventos */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">7. Eventos Deportivos</h2>
          <p>Los organizadores que publican eventos en la Plataforma aceptan y se obligan a:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Responder por la veracidad de la información del evento (fecha, sede, categorías, precios, reglamento).</li>
            <li>Contar con los permisos, licencias y seguros necesarios para la realización del evento.</li>
            <li>Usar los datos de los atletas inscritos exclusivamente para la gestión y logística del evento.</li>
            <li>Abstenerse de utilizar los datos de los participantes para fines distintos al evento en cuestión (marketing directo, reventa, etc.).</li>
            <li>Atender directamente las solicitudes, quejas y reclamos de los participantes relacionadas con el evento.</li>
          </ul>
          <p className="mt-2">SportMaps no es responsable de la cancelación, modificación, aplazamiento o suspensión de eventos organizados por terceros. Las políticas de reembolso son determinadas por cada organizador.</p>
          <p className="mt-2">Los atletas, padres y escuelas que se inscriben en eventos aceptan que:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Sus datos de perfil y documentos de identidad serán compartidos con el organizador del evento.</li>
            <li>Deben cumplir con los requisitos, reglamentos y medidas de seguridad establecidos por el organizador.</li>
            <li>Son responsables de verificar que cuentan con las condiciones físicas y médicas adecuadas para participar.</li>
          </ul>
        </section>

        {/* 8. Uso aceptable */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">8. Uso Aceptable y Conductas Prohibidas</h2>
          <p>El Usuario se obliga a no utilizar la Plataforma para:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Publicar contenido falso, ofensivo, discriminatorio, amenazante, abusivo, obsceno o ilegal.</li>
            <li>Acosar, intimidar o amenazar a otros Usuarios, entrenadores, escuelas, organizadores o al personal de SportMaps.</li>
            <li>Suplantar la identidad de otra persona u organización.</li>
            <li>Compartir su contraseña con terceros o permitir que otros accedan a su cuenta.</li>
            <li>Acceder o intentar acceder de forma no autorizada a cuentas, datos o sistemas de otros usuarios.</li>
            <li>Utilizar datos de otros usuarios obtenidos a través de la Plataforma para fines no autorizados (spam, marketing directo, reventa de bases de datos).</li>
            <li>Utilizar la Plataforma con fines distintos a la gestión deportiva y educativa.</li>
            <li>Eludir o intentar eludir las restricciones de acceso basadas en roles.</li>
            <li>Realizar actividades que puedan dañar, sobrecargar o deteriorar la infraestructura de SportMaps.</li>
            <li>Incumplir los reglamentos internos, normas de seguridad o lineamientos de convivencia fijados por las escuelas o centros aliados.</li>
            <li>Hacer un uso inadecuado, riesgoso o contrario a las instrucciones del personal de las escuelas o centros aliados.</li>
          </ul>
          <p className="mt-2">
            El Usuario reconoce y acepta que será el único responsable frente a SportMaps, las escuelas, centros aliados y terceros afectados por cualquier daño, perjuicio o menoscabo que se derive de su conducta, la de sus acompañantes o la de menores bajo su cuidado, mientras haga uso de la Plataforma o de las instalaciones de terceros aliados.
          </p>
        </section>

        {/* 9. Prohibición de reventa */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">9. Prohibición de Reventa, Cesión y Uso Comercial No Autorizado</h2>
          <p>
            La cuenta de Usuario, las suscripciones, mensualidades, inscripciones, reservas y cualquier otro derecho derivado del uso de la Plataforma tienen carácter <strong className="text-foreground">personal e intransferible</strong>.
          </p>
          <p className="mt-2">El Usuario se obliga a:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>No revender, regalar, ceder, transferir ni negociar bajo ningún título sus derechos dentro de la Plataforma a terceros.</li>
            <li>No ceder reservas, clases, inscripciones o delegaciones deportivas a otras personas, incluso si son otros Usuarios de la Plataforma.</li>
            <li>No hacer un uso comercial no autorizado de la Plataforma o de sus funcionalidades.</li>
          </ul>
          <p className="mt-2">
            SportMaps no se hará responsable frente a terceros por cesiones o reventas no autorizadas. El incumplimiento de esta disposición dará lugar a la suspensión o cancelación de la cuenta, sin derecho a reembolso.
          </p>
        </section>

        {/* 10. Asunción de riesgos deportivos */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">10. Asunción de Riesgos Deportivos y Limitación de Responsabilidad</h2>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-[#8a3a00] mb-3">
            <p><strong>Lee esta sección con atención.</strong> La actividad deportiva implica riesgos inherentes que el Usuario reconoce y asume voluntariamente.</p>
          </div>

          <p>
            El Usuario entiende y reconoce que la participación en cualquier actividad física, entrenamiento, clase, evento deportivo o uso de instalaciones y equipamiento deportivo, ya sea de manera presencial o virtual (la <strong className="text-foreground">"Actividad"</strong>), implica riesgos inherentes que pueden resultar en lesiones personales, daños materiales, enfermedades o incluso la muerte.
          </p>
          <p className="mt-2">
            En reconocimiento de estos riesgos, el Usuario manifiesta y garantiza que:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Es física y mentalmente capaz de participar en la Actividad.</li>
            <li>Participa voluntariamente en la Actividad y en los servicios ofertados a través de la Plataforma.</li>
            <li>Ha consultado o consultará con un profesional de la salud antes de iniciar cualquier Actividad, especialmente si tiene condiciones médicas preexistentes.</li>
            <li>Cuenta con un seguro médico apropiado o, en su ausencia, asume la totalidad de los costos de atención médica, rescate o rehabilitación que puedan originarse.</li>
            <li>Es responsable de supervisar a los menores bajo su cuidado durante toda la Actividad y de verificar las condiciones de las instalaciones.</li>
          </ul>
          <p className="mt-3">
            En consecuencia, el Usuario <strong className="text-foreground">asume de manera total, exclusiva e irrevocable</strong> la responsabilidad por lesiones personales, accidentes, enfermedades (incluyendo la muerte), así como la responsabilidad por daños o pérdida de propiedad personal que puedan ocurrir como resultado de la Actividad.
          </p>
          <p className="mt-3">
            El Usuario <strong className="text-foreground">renuncia, exime, exonera e indemniza</strong> a SportMaps, sus accionistas, directores, administradores, empleados, aliados comerciales, proveedores, entrenadores registrados, escuelas y organizadores aliados (las <strong className="text-foreground">"Personas Liberadas"</strong>) de cualquier responsabilidad, reclamación, demanda, acción, causa de acción, costo o gasto (incluyendo honorarios de abogados) presente o futuro, que se derive o pudiera derivarse de la Actividad.
          </p>
          <p className="mt-3">
            Sin perjuicio de lo anterior, y dentro del máximo permitido por la ley, SportMaps no será responsable por:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Interrupciones del servicio por causas de fuerza mayor, caso fortuito, mantenimiento programado o fallos técnicos de terceros (Supabase, Vercel, pasarelas de pago, proveedores de internet).</li>
            <li>Pérdidas económicas, lucro cesante o daño emergente derivados del uso o imposibilidad de uso de la Plataforma.</li>
            <li>Errores en la información suministrada por los Usuarios o las instituciones registradas.</li>
            <li>Decisiones tomadas por escuelas, entrenadores, organizadores o acudientes dentro de la Plataforma.</li>
            <li>La calidad, seguridad, legalidad o idoneidad de las clases, entrenamientos, eventos o servicios prestados por terceros a través de la Plataforma.</li>
            <li>Los productos vendidos por tiendas en el marketplace.</li>
            <li>Lesiones, daños o perjuicios derivados de la práctica deportiva o del uso de instalaciones de terceros.</li>
            <li>El contenido de sitios web o aplicaciones móviles enlazados desde la Plataforma.</li>
            <li>Daños causados por virus informáticos, fallos de red o incidentes de ciberseguridad no atribuibles a SportMaps.</li>
          </ul>
          <p className="mt-3">
            El Sitio y el Material se ponen a disposición <strong className="text-foreground">"tal como están"</strong> y <strong className="text-foreground">"según disponibilidad"</strong>. SportMaps no garantiza que el Sitio funcione ininterrumpidamente o libre de errores, ni que se encuentre libre de virus u otros mecanismos dañinos.
          </p>
        </section>

        {/* 11. Suspensión */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">11. Suspensión y Cancelación de Cuentas</h2>
          <p>SportMaps podrá suspender temporal o permanentemente una cuenta cuando:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>El Usuario incumpla estos Términos o la Política de Privacidad.</li>
            <li>Se detecte actividad fraudulenta, sospechosa o atípica.</li>
            <li>Se verifique suplantación de identidad o uso indebido de la cuenta.</li>
            <li>El Usuario proporcione documentación falsa o adulterada.</li>
            <li>No se pueda verificar o autenticar la información suministrada.</li>
            <li>Exista una orden judicial o administrativa que lo requiera.</li>
          </ul>
          <p className="mt-2">
            En casos de cancelación por incumplimiento grave o uso indebido, el Usuario no tendrá derecho a reembolso alguno. En caso de cancelación por decisión discrecional de SportMaps sin que medie incumplimiento del Usuario, SportMaps podrá ofrecer el reembolso proporcional de los servicios no utilizados.
          </p>
          <p className="mt-2">
            El Usuario puede solicitar la cancelación de su cuenta en cualquier momento desde la configuración de su perfil o escribiendo a{' '}
            <a href="mailto:soporte@sportmaps.co" className="text-[#248223] hover:underline">soporte@sportmaps.co</a>.
            La eliminación de datos se realizará conforme a lo establecido en la Política de Privacidad.
          </p>
        </section>

        {/* 12. Enlaces a sitios de terceros */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">12. Enlaces a Sitios de Terceros</h2>
          <p>
            La Plataforma puede contener enlaces o vínculos a sitios web, aplicaciones móviles o plataformas de terceros (pasarelas de pago, redes sociales, plataformas de videoconferencia, etc.). Estos enlaces se proporcionan únicamente para conveniencia del Usuario. SportMaps no respalda, recomienda ni asume responsabilidad alguna sobre el contenido, las políticas de privacidad o los términos de uso de dichos sitios.
          </p>
          <p className="mt-2">
            Si el Usuario decide acceder a sitios de terceros a través de los enlaces disponibles en la Plataforma, lo hará bajo su propio y exclusivo riesgo. Es responsabilidad del Usuario leer, entender y aceptar las condiciones de uso y políticas de privacidad de aquellos sitios antes de interactuar con ellos.
          </p>
        </section>

        {/* 13. Fuerza mayor */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">13. Fuerza Mayor y Caso Fortuito</h2>
          <p>
            SportMaps no será responsable por el incumplimiento, retraso o interrupción de cualquier obligación cuando dicho incumplimiento se derive de eventos de fuerza mayor o caso fortuito, incluyendo sin limitación: desastres naturales, pandemias, emergencias sanitarias, guerras, actos terroristas, disturbios sociales, huelgas, actos de autoridad, fallos masivos de internet, cortes de suministro eléctrico, ataques cibernéticos, fallos de proveedores críticos (Supabase, Vercel, pasarelas de pago) u otros eventos ajenos al control razonable de SportMaps.
          </p>
          <p className="mt-2">
            En tales eventos, SportMaps notificará al Usuario oportunamente y realizará esfuerzos razonables para restablecer el servicio, sin que ello genere obligación de indemnización.
          </p>
        </section>

        {/* 14. Cumplimiento normativo */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">14. Cumplimiento Normativo y Prevención de Lavado de Activos</h2>
          <p>
            En virtud de la legislación vigente en materia de prevención del lavado de activos y de la financiación del terrorismo (Ley 1121 de 2006, SARLAFT), el Usuario se obliga a:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Facilitar de forma completa y veraz cuanta información sea necesaria y le sea requerida para el conocimiento del cliente (Due Diligence).</li>
            <li>Autorizar expresamente a SportMaps a realizar las actuaciones de verificación que considere oportunas.</li>
            <li>Manifestar que el origen de los recursos empleados para el pago de los servicios es lícito y no contraviene la legislación vigente.</li>
          </ul>
          <p className="mt-2">
            SportMaps podrá estar sujeta a la obligación de comunicar a la Unidad de Información y Análisis Financiero (UIAF) o a las autoridades competentes cualquier hecho u operación respecto del cual exista indicio o certeza de estar relacionado con lavado de activos o financiación del terrorismo, y podrá abstenerse de ejecutar operaciones respecto de las que se pongan de manifiesto tales circunstancias.
          </p>
          <p className="mt-2">
            SportMaps no será responsable ante el Usuario de los daños o perjuicios que éste pueda sufrir como consecuencia del cumplimiento, por parte de SportMaps, de dichas obligaciones legales.
          </p>
        </section>

        {/* 15. Comunicaciones */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">15. Comunicaciones Electrónicas</h2>
          <p>
            El Usuario acepta que el correo electrónico registrado, las notificaciones dentro de la Plataforma, los mensajes SMS y cualquier otro medio electrónico proporcionado son <strong className="text-foreground">medios hábiles y válidos</strong> para el flujo e intercambio de documentación, información y comunicaciones legales entre el Usuario y SportMaps, en los términos del Título III de la Ley 527 de 1999 sobre comercio electrónico en Colombia.
          </p>
          <p className="mt-2">
            Las notificaciones enviadas por SportMaps a la dirección de correo electrónico o al número de teléfono registrado por el Usuario se entenderán efectivamente realizadas, independientemente de que el Usuario las consulte o no, o de que la información de contacto esté desactualizada en la Plataforma.
          </p>
          <p className="mt-2">
            Es obligación del Usuario mantener sus datos de contacto actualizados en su perfil.
          </p>
        </section>

        {/* 16. Modificaciones */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">16. Modificaciones a los Términos</h2>
          <p>
            SportMaps, en la medida en que trabaja constantemente para mejorar la prestación de sus servicios, se reserva el derecho de actualizar y/o modificar estos Términos cuando sea necesario. Notificaremos los cambios relevantes mediante correo electrónico al email registrado, aviso visible dentro de la Plataforma al iniciar sesión o actualización de la fecha de "Última actualización".
          </p>
          <p className="mt-2">
            El uso continuado del servicio tras la notificación constituye <strong className="text-foreground">aceptación expresa</strong> de las nuevas condiciones. Si el Usuario no está de acuerdo con las modificaciones, deberá abstenerse de seguir usando la Plataforma y podrá cancelar su cuenta.
          </p>
          <p className="mt-2">
            La versión vigente siempre estará disponible en{' '}
            <Link to="/terminos-y-condiciones" className="text-[#248223] hover:underline">sportmaps.co/terminos-y-condiciones</Link>.
          </p>
        </section>

        {/* 17. Disposiciones generales */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">17. Disposiciones Generales</h2>

          <p className="font-medium text-foreground">17.1. Acuerdo completo</p>
          <p className="mt-2">
            Estos Términos, junto con la Política de Privacidad y cualquier anexo, acuerdo o condición especial publicada en la Plataforma, constituyen el acuerdo completo entre el Usuario y SportMaps con respecto al uso del Sitio y sus servicios, y reemplazan cualquier acuerdo previo, verbal o escrito, sobre los mismos temas.
          </p>

          <p className="font-medium text-foreground mt-4">17.2. Separabilidad</p>
          <p className="mt-2">
            Si alguna disposición de estos Términos es declarada nula, inválida o ineficaz por autoridad competente, ello no afectará la validez ni la exigibilidad de las restantes disposiciones, que conservarán plenos efectos.
          </p>

          <p className="font-medium text-foreground mt-4">17.3. No renuncia</p>
          <p className="mt-2">
            La tolerancia o el retraso en el ejercicio de cualquier derecho por parte de SportMaps no se interpretará como renuncia a dicho derecho ni impedirá su ejercicio en el futuro.
          </p>

          <p className="font-medium text-foreground mt-4">17.4. Cesión</p>
          <p className="mt-2">
            SportMaps podrá ceder total o parcialmente los derechos y obligaciones derivados de estos Términos a una sociedad afiliada, controlante o sucesora en el marco de reorganizaciones empresariales, sin necesidad de consentimiento del Usuario, siempre que los derechos de este no se vean afectados. El Usuario no podrá ceder sus derechos u obligaciones bajo estos Términos sin autorización previa y escrita de SportMaps.
          </p>

          <p className="font-medium text-foreground mt-4">17.5. Encabezados</p>
          <p className="mt-2">
            Los encabezados de las secciones son únicamente para conveniencia de referencia y no afectan la interpretación de las disposiciones.
          </p>
        </section>

        {/* 18. Ley aplicable */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">18. Ley Aplicable y Jurisdicción</h2>
          <p>
            Estos Términos se rigen por las leyes de la <strong className="text-foreground">República de Colombia</strong>, sin dar aplicación a las normas o principios sobre conflicto de leyes. Cualquier controversia que surja de o en relación con estos Términos será resuelta ante los jueces competentes de la ciudad de <strong className="text-foreground">Bogotá D.C., Colombia</strong>, salvo que la ley disponga lo contrario.
          </p>
          <p className="mt-2">
            Las partes acuerdan agotar los mecanismos de solución directa antes de acudir a instancias judiciales. Para reclamaciones relacionadas con la Plataforma, el Usuario deberá comunicarse primero con el equipo de soporte a través de los canales oficiales de atención.
          </p>
          <p className="mt-2">
            SportMaps no garantiza que el Material pueda ser legalmente consultado fuera del territorio de la República de Colombia. Si el Usuario accede al Sitio desde otra jurisdicción, lo hará bajo su propio riesgo y es responsable del cumplimiento de las leyes locales aplicables.
          </p>
        </section>

        {/* 19. Contacto */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">19. Contacto</h2>
          <p>Para dudas sobre estos Términos, escríbenos a:</p>
          <p className="mt-1">
            <strong className="text-foreground">SportMaps Technology S.A.S.</strong><br />
            Bogotá D.C., Colombia<br />
            <a href="mailto:legal@sportmaps.co" className="text-[#248223] hover:underline">legal@sportmaps.co</a> (asuntos legales)<br />
            <a href="mailto:soporte@sportmaps.co" className="text-[#248223] hover:underline">soporte@sportmaps.co</a> (soporte general)<br />
            Línea de atención: <a href="tel:+573128463555" className="text-[#248223] hover:underline">+57 (312) 846-3555</a>
          </p>
        </section>

        <div className="border-t pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} SportMaps Technology S.A.S. Todos los derechos reservados · Colombia<br />
          Versión 2.0 · Abril de 2026
        </div>
      </div>
    </div>
  );
}
