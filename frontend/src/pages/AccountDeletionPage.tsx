/**
 * AccountDeletionPage — página PÚBLICA de eliminación de cuenta y datos.
 *
 * Ruta: /eliminar-cuenta  (alias /delete-account)
 *
 * Por qué es pública: Google Play exige, para toda app que permita crear
 * cuenta, una URL accesible SIN instalar la app ni iniciar sesión donde el
 * usuario pueda pedir la eliminación de su cuenta y sus datos. Esta URL se
 * declara en Play Console → Contenido de la app → Eliminación de datos.
 *
 * Debe decir explícitamente qué se borra, qué se conserva y por cuánto tiempo:
 * Play compara este texto contra el formulario de Seguridad de los datos.
 *
 * El camino in-app equivalente es Ajustes → Seguridad → Zona de Peligro
 * (components/settings/AccountDeletionCard.tsx).
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Mail, Clock, Database } from 'lucide-react';

const SUPPORT_EMAIL = 'privacidad@sportmaps.co';

export default function AccountDeletionPage() {
    return (
        <div className="min-h-screen bg-background animate-in fade-in duration-500">
            <div className="bg-gradient-to-br from-primary/15 via-primary/10 to-background border-b border-border/40">
                <div className="max-w-3xl mx-auto px-4 py-10">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" /> Volver al inicio
                    </Link>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Trash2 className="h-5 w-5 text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            Eliminar tu cuenta y tus datos
                        </h1>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        SportMaps · Derecho de supresión (Ley 1581 de 2012, Colombia)
                    </p>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-10 space-y-8 text-sm text-muted-foreground leading-relaxed">
                <section className="bg-[#248223]/5 border border-[#248223]/20 rounded-xl p-4">
                    <p>
                        Puedes pedir la eliminación de tu cuenta de SportMaps y de los datos
                        personales asociados en cualquier momento, sin dar explicaciones y sin costo.
                        Hay dos caminos y ambos llevan al mismo sitio.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground mb-3">
                        Opción 1 — Desde la aplicación (recomendado)
                    </h2>
                    <ol className="list-decimal ml-5 space-y-1">
                        <li>Inicia sesión en SportMaps.</li>
                        <li>
                            Entra a <strong className="text-foreground">Ajustes → Seguridad</strong>.
                        </li>
                        <li>
                            En <strong className="text-foreground">Zona de Peligro</strong>, pulsa{' '}
                            <strong className="text-foreground">Eliminar Cuenta</strong> y confirma.
                        </li>
                    </ol>
                    <p className="mt-3">
                        Verás la fecha exacta en que se ejecutará el borrado y podrás cancelar la
                        solicitud desde esa misma pantalla mientras no se cumpla el plazo.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Mail className="h-4 w-4 text-[#248223]" />
                        Opción 2 — Por correo, sin instalar la app
                    </h2>
                    <p>
                        Escríbenos a{' '}
                        <a href={`mailto:${SUPPORT_EMAIL}?subject=Solicitud%20de%20eliminacion%20de%20cuenta`} className="text-[#248223] hover:underline">
                            {SUPPORT_EMAIL}
                        </a>{' '}
                        desde el correo con el que te registraste, indicando que deseas eliminar tu
                        cuenta. Verificaremos tu identidad antes de proceder, para que nadie más
                        pueda pedir el borrado de tu cuenta.
                    </p>
                    <p className="mt-2">
                        Atendemos la solicitud en un máximo de{' '}
                        <strong className="text-foreground">15 días hábiles</strong> conforme al
                        artículo 15 de la Ley 1581 de 2012.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-[#248223]" />
                        Qué pasa cuando lo solicitas
                    </h2>
                    <ul className="list-disc ml-5 space-y-1">
                        <li>
                            <strong className="text-foreground">De inmediato:</strong> cancelamos tus
                            cobros recurrentes y desactivamos los medios de pago que tengas guardados.
                            No se te vuelve a cobrar.
                        </li>
                        <li>
                            <strong className="text-foreground">A los 30 días:</strong> se ejecuta el
                            borrado. Ese plazo existe para que puedas arrepentirte y para cerrar
                            obligaciones pendientes con tu escuela.
                        </li>
                        <li>
                            <strong className="text-foreground">Mientras corre el plazo:</strong>
                            {' '}puedes cancelar la solicitud y todo sigue como antes (los medios de pago
                            sí tendrás que volver a agregarlos).
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Database className="h-4 w-4 text-[#248223]" />
                        Qué se elimina y qué se conserva
                    </h2>

                    <p className="font-medium text-foreground mt-2">Se elimina</p>
                    <ul className="list-disc ml-5 space-y-1 mt-1">
                        <li>Tu perfil y datos de contacto (nombre, correo, teléfono, foto).</li>
                        <li>Tus credenciales de acceso.</li>
                        <li>Tus membresías en escuelas, equipos e inscripciones.</li>
                        <li>Tus datos deportivos: asistencia, evaluaciones, informes y progreso.</li>
                        <li>Los medios de pago guardados y los dispositivos registrados para notificaciones.</li>
                        <li>
                            Si eres acudiente, también los perfiles de los deportistas menores que
                            registraste a tu cargo, ya que no tienen cuenta propia.
                        </li>
                    </ul>

                    <p className="font-medium text-foreground mt-4">Se conserva (y por qué)</p>
                    <ul className="list-disc ml-5 space-y-1 mt-1">
                        <li>
                            <strong className="text-foreground">Registros contables y de pagos</strong>{' '}
                            que ya ocurrieron: los conservamos de forma disociada de tu identidad
                            durante los plazos que exige la normativa tributaria y comercial
                            colombiana. No se usan para perfilarte ni para contactarte.
                        </li>
                        <li>
                            <strong className="text-foreground">Registros de auditoría</strong> mínimos
                            exigidos por la Ley 1581 de 2012 para demostrar que atendimos tu solicitud.
                        </li>
                    </ul>
                    <p className="mt-3">
                        Nada de lo conservado permite volver a identificarte ni reconstruir tu cuenta.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-foreground mb-3">Menores de edad</h2>
                    <p>
                        Los menores de edad <strong className="text-foreground">no tienen cuenta propia</strong>{' '}
                        en SportMaps. Solo existen como deportistas a cargo del perfil de su padre,
                        madre o acudiente, que es quien autoriza el tratamiento de sus datos y quien
                        puede pedir su eliminación en cualquier momento.
                    </p>
                </section>

                <section className="border-t border-border/40 pt-6">
                    <p>
                        Más detalle en nuestra{' '}
                        <Link to="/politica-de-privacidad" className="text-[#248223] hover:underline">
                            Política de Privacidad
                        </Link>
                        . Si no estás conforme con nuestra respuesta, puedes reclamar ante la{' '}
                        <strong className="text-foreground">
                            Superintendencia de Industria y Comercio (SIC)
                        </strong>
                        .
                    </p>
                </section>
            </div>
        </div>
    );
}
