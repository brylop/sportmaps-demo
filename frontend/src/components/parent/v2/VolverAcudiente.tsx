/**
 * «Volver» de las pantallas internas del acudiente V2 (estado de cuenta, perfil,
 * configuración, carnets, informes…). Va en el layout, una sola vez, para que
 * NINGUNA pantalla quede sin forma de regresar. En las cinco raíces de pestaña
 * no se muestra: ahí manda la barra.
 *
 * Regresa a la pantalla anterior; si se llegó directo (enlace de WhatsApp,
 * notificación) y no hay historial, va a la pestaña dueña de la ruta.
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { esRaizDePestana, pestanaDe } from '@/lib/acudienteTabs';

export function VolverAcudiente() {
  const location = useLocation();
  const navigate = useNavigate();
  if (esRaizDePestana(location.pathname)) return null;

  const dueña = pestanaDe(location.pathname);
  const destino = dueña?.href ?? '/dashboard';
  const volver = () => {
    // `default` = primera entrada de la sesión: no hay a dónde volver dentro de la app.
    if (location.key !== 'default' && window.history.length > 1) navigate(-1);
    else navigate(destino);
  };

  return (
    <button
      type="button"
      onClick={volver}
      className="mb-3 inline-flex min-h-touch items-center gap-2 rounded-lg pr-3 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Volver{dueña ? ` a ${dueña.label}` : ''}
    </button>
  );
}
