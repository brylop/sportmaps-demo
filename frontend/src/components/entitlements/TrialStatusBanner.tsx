// ============================================================================
// TrialStatusBanner — aviso de fin del periodo de prueba, con contador.
//
// Se monta una sola vez en AuthLayout (arriba del contenido) para que no queden
// páginas sin aviso. Cuatro estados, de menos a más grave:
//
//   · "Faltan N días"      → prueba corriendo, aviso informativo.
//   · "Vence hoy"          → último día.
//   · "Tu prueba terminó"  → venció pero la escuela está exenta del bloqueo
//                            (decisión comercial, ej. Dynasty): avisa, no corta.
//   · "Tu club está inactivo" → bloqueada, solo lectura.
//
// Quién lo ve:
//   · El CONTADOR (aún no vence) → solo quien puede actuar: dueño / admin. A
//     padres, atletas y entrenadores no se les muestra, porque no deciden el
//     plan y solo generaría ruido y llamadas al club.
//   · El BLOQUEO → todos los usuarios de la escuela, con el texto adaptado al
//     rol. Decisión del dueño del producto: la escuela inhabilitada lo está para
//     todos por igual, así que a un padre o un entrenador le van a fallar las
//     acciones — y tiene que saber por qué en vez de ver errores sueltos.
//
// El veredicto de bloqueo viene del servidor (school_is_operational); este
// componente NO decide nada, solo lo comunica.
// ============================================================================
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Clock, X } from 'lucide-react';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { Button } from '@/components/ui/button';
import { salesWhatsappLink } from '@/lib/salesContact';

/** Roles que deciden sobre el plan de la escuela. */
const ROLES_QUE_DECIDEN = ['owner', 'admin', 'school_admin', 'school'];

// El número vive en un solo lugar: src/lib/salesContact.ts (VITE_SALES_WHATSAPP).

type Severidad = 'aviso' | 'urgente' | 'bloqueo';

export function TrialStatusBanner() {
    const { currentUserRole, schoolName } = useSchoolContext();
    const {
        plan, trialDaysRemaining, trialEndsToday, trialHasEnded,
        isBlocked, isBlockingExempt, isTestAccount, isGrandfathered, isLoading,
    } = useEntitlements();
    const [oculto, setOculto] = useState(false);

    const puedeDecidir = ROLES_QUE_DECIDEN.includes(currentUserRole || '');

    const contenido = useMemo(() => {
        // Solo estados de prueba: una escuela con plan pagado no ve nada.
        const enPrueba = plan.status === 'trialing' || plan.status === 'trial_expired';
        if (!enPrueba || trialDaysRemaining === null) return null;

        const fecha = plan.trialEndsAt?.toLocaleDateString('es-CO', {
            day: 'numeric', month: 'long', year: 'numeric',
        });

        if (isBlocked) {
            return {
                severidad: 'bloqueo' as Severidad,
                titulo: puedeDecidir ? 'Tu club está inactivo' : `${schoolName || 'Tu club'} está inactivo`,
                detalle: puedeDecidir
                    ? 'Tu periodo de prueba terminó y la cuenta quedó en solo lectura: '
                      + 'puedes consultar y exportar tu información, pero no registrar nueva. '
                      + 'Reactívala hablando con nuestro equipo.'
                    : 'El periodo de prueba del club terminó, así que por ahora solo se puede '
                      + 'consultar información: los registros y pagos están deshabilitados. '
                      + 'Comunícate con el club para que reactive su plan.',
                // Al que no decide no se le ofrece el CTA comercial: no es su gestión.
                conAcciones: puedeDecidir,
                descartable: false,
            };
        }

        if (trialHasEnded) {
            return {
                // Exenta = aviso ámbar, no alarma roja: no hay corte en camino.
                severidad: (isBlockingExempt ? 'aviso' : 'urgente') as Severidad,
                titulo: 'Tu periodo de prueba terminó',
                detalle: isBlockingExempt
                    ? `La prueba venció el ${fecha}. Mantuvimos tu acceso activo mientras definimos tu plan — hablemos para dejarlo en firme.`
                    : `La prueba venció el ${fecha}. Reactiva tu plan para no perder el acceso.`,
                conAcciones: true,
                descartable: false,
            };
        }

        if (trialEndsToday) {
            return {
                severidad: (isBlockingExempt ? 'aviso' : 'urgente') as Severidad,
                titulo: 'Tu periodo de prueba vence hoy',
                // A una escuela exenta no se le anuncia un corte que decidimos no
                // aplicar: si llama y le decimos "tranquilo, sigues operando", el
                // aviso pierde toda fuerza para la próxima.
                detalle: isBlockingExempt
                    ? `Hoy es el último día de prueba de ${schoolName || 'tu club'}. `
                      + 'Tu acceso continúa con normalidad — hablemos para dejar tu plan definido.'
                    : `Hoy es el último día de prueba de ${schoolName || 'tu club'}. `
                      + 'A partir de mañana la cuenta pasa a solo lectura si no activas un plan.',
                conAcciones: true,
                descartable: false,
            };
        }

        const dias = trialDaysRemaining;
        return {
            severidad: (dias <= 7 && !isBlockingExempt ? 'urgente' : 'aviso') as Severidad,
            titulo: dias === 1
                ? 'Tu periodo de prueba termina mañana'
                : `Tu periodo de prueba termina en ${dias} días`,
            detalle: isBlockingExempt
                ? `Vence el ${fecha}. Tu acceso continúa con normalidad — hablemos para dejar tu plan definido.`
                : `Vence el ${fecha}. Cuando termine, la cuenta pasa a solo lectura: `
                  + 'tu información no se borra, pero no podrás registrar nueva hasta activar un plan.',
            conAcciones: true,
            descartable: dias > 7,
        };
    }, [plan.status, plan.trialEndsAt, trialDaysRemaining, trialEndsToday, trialHasEnded, isBlocked, isBlockingExempt, schoolName, puedeDecidir]);

    // Nada que mostrar: cuentas nuestras y planes pagados nunca ven aviso.
    if (isLoading || isTestAccount || isGrandfathered) return null;
    // El contador es solo para quien decide; el bloqueo lo ve todo el mundo,
    // porque a todos les van a fallar las acciones.
    if (!puedeDecidir && !isBlocked) return null;
    if (!contenido || (oculto && contenido.descartable)) return null;

    const estilo = {
        aviso: {
            caja: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900',
            circulo: 'bg-amber-100 dark:bg-amber-900/50',
            icono: 'text-amber-600 dark:text-amber-400',
        },
        urgente: {
            caja: 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900',
            circulo: 'bg-rose-100 dark:bg-rose-900/50',
            icono: 'text-rose-600 dark:text-rose-400',
        },
        bloqueo: {
            caja: 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900',
            circulo: 'bg-rose-100 dark:bg-rose-900/50',
            icono: 'text-rose-600 dark:text-rose-400',
        },
    }[contenido.severidad];

    const Icono = contenido.severidad === 'aviso' ? Clock : AlertCircle;
    const enlaceWa = salesWhatsappLink(
        `Hola, soy de ${schoolName || 'mi club'} y quiero activar mi plan en SportMaps.`,
    );

    return (
        <div
            role="status"
            className={`mb-4 sm:mb-6 rounded-2xl border p-4 sm:p-6 ${estilo.caja}`}
        >
            <div className="flex items-start gap-4 sm:gap-5">
                <div className={`flex-shrink-0 h-11 w-11 sm:h-14 sm:w-14 rounded-full flex items-center justify-center ${estilo.circulo}`}>
                    <Icono className={`h-5 w-5 sm:h-7 sm:w-7 ${estilo.icono}`} />
                </div>

                <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-2xl font-bold text-foreground leading-tight">
                        {contenido.titulo}
                    </h2>
                    <p className="mt-1 text-sm sm:text-base text-muted-foreground">
                        {contenido.detalle}
                    </p>

                    {contenido.conAcciones && (
                        <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-2">
                            <Button asChild size="sm">
                                <a
                                    href={enlaceWa}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Hablar con el equipo
                                </a>
                            </Button>
                            <Button asChild size="sm" variant="outline">
                                <Link to="/mi-plan">Ver mi plan</Link>
                            </Button>
                        </div>
                    )}
                </div>

                {contenido.descartable && (
                    <button
                        type="button"
                        onClick={() => setOculto(true)}
                        aria-label="Ocultar aviso"
                        className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
