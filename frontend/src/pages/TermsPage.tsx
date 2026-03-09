import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background font-poppins">
      {/* Header */}
      <div className="bg-[#248223] text-white py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <Link to="/register" className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al registro
          </Link>
          <h1 className="text-3xl font-bold">Términos y Condiciones</h1>
          <p className="text-white/70 mt-2 text-sm">Última actualización: marzo de 2026</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8 text-sm text-muted-foreground leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">1. Aceptación de los Términos</h2>
          <p>
            Al registrarte y utilizar la plataforma SportMaps (en adelante "la Plataforma"), aceptas de manera expresa y sin reservas los presentes Términos y Condiciones. Si no estás de acuerdo con alguno de ellos, te pedimos que no uses la Plataforma.
          </p>
          <p className="mt-2">
            SportMaps es operado por <strong className="text-foreground">SportMaps SAS</strong>, empresa constituida conforme a las leyes de la República de Colombia.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">2. Descripción del Servicio</h2>
          <p>SportMaps es una plataforma digital de gestión deportiva que permite a:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong className="text-foreground">Escuelas y academias deportivas</strong>: gestionar estudiantes, equipos, pagos, asistencia y comunicaciones.</li>
            <li><strong className="text-foreground">Entrenadores</strong>: administrar equipos, registrar asistencia y realizar seguimiento de rendimiento.</li>
            <li><strong className="text-foreground">Padres y acudientes</strong>: consultar el progreso de sus hijos, realizar pagos y recibir comunicaciones.</li>
            <li><strong className="text-foreground">Atletas</strong>: ver su historial, estadísticas y comunicarse con su entidad deportiva.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">3. Registro y Cuentas de Usuario</h2>
          <p>Para acceder a la Plataforma debes:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Ser mayor de 18 años, o contar con autorización expresa de tu representante legal.</li>
            <li>Proporcionar información verídica, completa y actualizada en el formulario de registro.</li>
            <li>Mantener la confidencialidad de tu contraseña y no compartirla con terceros.</li>
            <li>Notificar de inmediato a SportMaps si detectas acceso no autorizado a tu cuenta.</li>
          </ul>
          <p className="mt-2">
            SportMaps se reserva el derecho de suspender o eliminar cuentas que proporcionen información falsa o incumplan estos Términos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">4. Pagos y Facturación</h2>
          <p>
            La Plataforma integra pasarelas de pago para el cobro de mensualidades, inscripciones y otros conceptos deportivos. Al realizar un pago aceptas que:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Los pagos son procesados por terceros (Wompi, Nequi, Daviplata) y sujetos a sus propios términos.</li>
            <li>SportMaps no almacena datos de tarjetas de crédito ni débito.</li>
            <li>Los pagos manuales (transferencias bancarias) quedan sujetos a validación por parte de la institución receptora.</li>
            <li>Las devoluciones o reembolsos son responsabilidad de la escuela o academia correspondiente.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">5. Uso Aceptable</h2>
          <p>Queda prohibido utilizar la Plataforma para:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Publicar contenido falso, ofensivo, discriminatorio o ilegal.</li>
            <li>Suplantar la identidad de otra persona u organización.</li>
            <li>Intentar acceder de forma no autorizada a cuentas o sistemas.</li>
            <li>Realizar actividades que puedan dañar, sobrecargar o deteriorar la infraestructura de SportMaps.</li>
            <li>Usar la Plataforma con fines distintos a la gestión deportiva y educativa.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">6. Propiedad Intelectual</h2>
          <p>
            Todos los contenidos de SportMaps —incluyendo marca, logotipo, diseño, código fuente, textos e imágenes— son propiedad de SportMaps SAS o sus licenciantes y están protegidos por las leyes colombianas e internacionales de propiedad intelectual.
          </p>
          <p className="mt-2">
            El usuario conserva la titularidad de los datos e información que cargue a la Plataforma, y otorga a SportMaps una licencia limitada para procesarlos con el único fin de prestar el servicio.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">7. Limitación de Responsabilidad</h2>
          <p>SportMaps no será responsable por:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Interrupciones del servicio por causas de fuerza mayor o mantenimiento.</li>
            <li>Pérdidas económicas derivadas del uso o la imposibilidad de uso de la Plataforma.</li>
            <li>Errores en la información suministrada por los usuarios o las instituciones.</li>
            <li>Decisiones tomadas por escuelas, entrenadores o acudientes dentro de la Plataforma.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">8. Modificaciones</h2>
          <p>
            SportMaps podrá modificar estos Términos en cualquier momento. Notificaremos los cambios relevantes mediante correo electrónico o aviso en la Plataforma. El uso continuado del servicio tras la notificación constituye aceptación de las nuevas condiciones.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">9. Ley Aplicable y Jurisdicción</h2>
          <p>
            Estos Términos se rigen por las leyes de la República de Colombia. Cualquier controversia será resuelta ante los jueces competentes de la ciudad de Bogotá D.C., Colombia, salvo que la ley disponga lo contrario.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">10. Contacto</h2>
          <p>Para dudas sobre estos Términos, escríbenos a:</p>
          <p className="mt-1">
            <strong className="text-foreground">SportMaps SAS</strong><br />
            Bogotá D.C., Colombia<br />
            <a href="mailto:legal@sportmaps.co" className="text-[#248223] hover:underline">legal@sportmaps.co</a>
          </p>
        </section>

        <div className="border-t pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} SportMaps SAS. Todos los derechos reservados.
        </div>
      </div>
    </div>
  );
}
