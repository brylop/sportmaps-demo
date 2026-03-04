import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background font-poppins">
      {/* Header */}
      <div className="bg-[#248223] text-white py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <Link to="/register" className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al registro
          </Link>
          <h1 className="text-3xl font-bold">Política de Privacidad y Tratamiento de Datos</h1>
          <p className="text-white/70 mt-2 text-sm">Última actualización: marzo de 2026 · Ley 1581 de 2012 (Colombia)</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8 text-sm text-muted-foreground leading-relaxed">

        <section className="bg-[#248223]/5 border border-[#248223]/20 rounded-xl p-4">
          <p>
            En SportMaps nos comprometemos a proteger la privacidad y los datos personales de nuestros usuarios conforme a la <strong className="text-foreground">Ley Estatutaria 1581 de 2012</strong>, el <strong className="text-foreground">Decreto 1377 de 2013</strong> y demás normas concordantes de la República de Colombia.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">1. Responsable del Tratamiento</h2>
          <p>
            <strong className="text-foreground">SportMaps SAS</strong>, identificada con NIT en trámite, con domicilio en Bogotá D.C., Colombia.
          </p>
          <p className="mt-2">
            Correo de contacto para datos personales:{' '}
            <a href="mailto:privacidad@sportmaps.co" className="text-[#248223] hover:underline">privacidad@sportmaps.co</a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">2. Datos que Recopilamos</h2>
          <p>Recopilamos los siguientes datos según el tipo de usuario:</p>

          <div className="mt-3 space-y-3">
            <div>
              <p className="font-medium text-foreground">Todos los usuarios:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Nombre completo</li>
                <li>Correo electrónico</li>
                <li>Número de teléfono</li>
                <li>Fecha de nacimiento</li>
                <li>Rol dentro de la plataforma</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Escuelas y academias:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>NIT de la institución</li>
                <li>Datos bancarios para recepción de pagos</li>
                <li>Información de sedes, horarios y programas</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Menores de edad (a través del acudiente):</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Nombre completo del menor</li>
                <li>Fecha de nacimiento</li>
                <li>Información médica relevante para la práctica deportiva</li>
                <li>Registros de asistencia y rendimiento deportivo</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">3. Finalidad del Tratamiento</h2>
          <p>Tus datos serán usados exclusivamente para:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Gestionar tu cuenta y autenticación en la Plataforma.</li>
            <li>Procesar inscripciones, pagos de mensualidades y transacciones.</li>
            <li>Registrar y visualizar asistencia y progreso deportivo.</li>
            <li>Enviar comunicaciones relacionadas con el servicio (confirmaciones, recordatorios, notificaciones).</li>
            <li>Generar reportes para escuelas, entrenadores y acudientes.</li>
            <li>Cumplir obligaciones legales y regulatorias.</li>
            <li>Mejorar la Plataforma mediante análisis agregado y anónimo de uso.</li>
          </ul>
          <p className="mt-2 text-[#8a3a00] bg-orange-50 border border-orange-200 rounded-lg p-3">
            <strong>SportMaps NO vende, alquila ni comercializa tus datos personales a terceros.</strong>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">4. Tratamiento de Datos de Menores</h2>
          <p>
            De conformidad con el <strong className="text-foreground">Artículo 7 de la Ley 1581 de 2012</strong>, el tratamiento de datos de menores de edad requiere la autorización expresa del padre, madre o representante legal.
          </p>
          <p className="mt-2">
            Al registrar a un menor en la Plataforma, el acudiente declara ser su representante legal y autoriza expresamente el tratamiento de los datos del menor para los fines descritos en esta Política.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">5. Seguridad de los Datos</h2>
          <p>SportMaps implementa medidas técnicas y organizativas para proteger tus datos:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Cifrado en tránsito mediante TLS/HTTPS.</li>
            <li>Almacenamiento seguro en Supabase (infraestructura certificada ISO 27001).</li>
            <li>Control de acceso por roles — cada usuario solo ve la información que le corresponde.</li>
            <li>Las contraseñas se almacenan con hash irreversible (bcrypt).</li>
            <li>Los datos bancarios de las instituciones se almacenan de forma cifrada.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">6. Compartición con Terceros</h2>
          <p>Podemos compartir datos únicamente en los siguientes casos:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong className="text-foreground">Pasarelas de pago</strong> (Wompi, Nequi, Daviplata): para procesar transacciones.</li>
            <li><strong className="text-foreground">Supabase</strong>: proveedor de base de datos e infraestructura en la nube.</li>
            <li><strong className="text-foreground">Autoridades competentes</strong>: cuando la ley colombiana lo exija.</li>
          </ul>
          <p className="mt-2">
            Todos los proveedores están sujetos a acuerdos de confidencialidad y tratamiento de datos compatibles con esta Política.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">7. Tus Derechos (Ley 1581 de 2012)</h2>
          <p>Como titular de tus datos personales tienes derecho a:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong className="text-foreground">Conocer</strong> qué datos tuyos tratamos.</li>
            <li><strong className="text-foreground">Actualizar</strong> tus datos cuando sean incorrectos o estén desactualizados.</li>
            <li><strong className="text-foreground">Rectificar</strong> información inexacta.</li>
            <li><strong className="text-foreground">Suprimir</strong> tus datos cuando no sean necesarios para los fines declarados.</li>
            <li><strong className="text-foreground">Revocar</strong> la autorización de tratamiento en cualquier momento.</li>
            <li><strong className="text-foreground">Presentar quejas</strong> ante la Superintendencia de Industria y Comercio (SIC).</li>
          </ul>
          <p className="mt-2">
            Para ejercer tus derechos escríbenos a{' '}
            <a href="mailto:privacidad@sportmaps.co" className="text-[#248223] hover:underline">privacidad@sportmaps.co</a>.
            Responderemos en un plazo máximo de <strong className="text-foreground">15 días hábiles</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">8. Retención de Datos</h2>
          <p>
            Conservamos tus datos mientras mantengas una cuenta activa en SportMaps. Tras la eliminación de tu cuenta, los datos serán eliminados o anonimizados en un plazo de <strong className="text-foreground">30 días hábiles</strong>, salvo obligación legal de conservación (ej. registros contables: 10 años según el Código de Comercio colombiano).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">9. Cookies y Tecnologías Similares</h2>
          <p>
            SportMaps utiliza cookies de sesión estrictamente necesarias para el funcionamiento de la autenticación. No utilizamos cookies de rastreo publicitario ni compartimos datos de navegación con redes publicitarias.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">10. Cambios en esta Política</h2>
          <p>
            Podemos actualizar esta Política periódicamente. Notificaremos los cambios relevantes mediante correo electrónico registrado. La versión vigente siempre estará disponible en{' '}
            <a href="/politica-de-privacidad" className="text-[#248223] hover:underline">stg.sportmaps.co/politica-de-privacidad</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">11. Contacto y Consultas</h2>
          <p>
            <strong className="text-foreground">Oficial de Protección de Datos — SportMaps SAS</strong><br />
            Bogotá D.C., Colombia<br />
            <a href="mailto:privacidad@sportmaps.co" className="text-[#248223] hover:underline">privacidad@sportmaps.co</a>
          </p>
        </section>

        <div className="border-t pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} SportMaps SAS · Política de Privacidad conforme a la Ley 1581 de 2012 · Colombia
        </div>
      </div>
    </div>
  );
}
