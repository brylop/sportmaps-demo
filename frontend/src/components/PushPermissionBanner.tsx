import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Bell, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { usePushPermissionStatus } from '@/hooks/usePushPermissionStatus';
import { isNativePlatform } from '@/lib/openExternalUrl';
import { cn } from '@/lib/utils';

function esIOSWeb() {
  if (isNativePlatform() || typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

const DISMISSED_KEY = 'sm_push_banner_dismissed';
const DELAY_MS      = 3000; // Esperar 3s antes de mostrar

/**
 * Banner que solicita permiso de notificaciones push.
 * - Aparece 3 segundos después del login si el permiso está en 'default'
 * - Si el usuario lo cierra sin decidir, no vuelve a aparecer (localStorage,
 *   igual que InstallBanner — antes era sessionStorage y reaparecía en cada
 *   pestaña/reapertura del navegador, que es justo lo que se quería evitar)
 * - Si el permiso ya fue concedido o denegado, nunca se muestra
 * - En navegadores no soportados (Safari sin PWA), no se muestra
 *
 * Funciona igual en web y en la app nativa: `usePushSubscription` ramifica por
 * plataforma. En nativo lo normal es que este banner NO aparezca, porque
 * `useDeviceContext` ya pidió el permiso al entrar y el estado queda en
 * 'granted' o 'denied'; solo sale si el prompt del SO quedó sin responder.
 */
function yaFueCerrado() {
  try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
}

export function PushPermissionBanner() {
  const permissionState         = usePushPermissionStatus();
  const { subscribe, status }   = usePushSubscription();
  const [visible, setVisible]   = useState(false);
  const [exiting, setExiting]   = useState(false);
  const cajaRef                 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (permissionState !== 'prompt') return;

    // No mostrar si ya lo descartó antes (localStorage: sobrevive a cerrar
    // la pestaña/el navegador, a diferencia de sessionStorage)
    if (yaFueCerrado()) return;

    const timer = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, [permissionState]);

  const mostrando = visible && permissionState === 'prompt';
  const reservarEspacio = mostrando && !exiting;

  // Reserva abajo, en el <main>, la franja que tapa el aviso (y sube a Mapi en
  // celular): ver `html[data-aviso-push] main` en index.css. Se mide en vivo
  // porque el alto cambia con el ancho, el zoom y el texto.
  useLayoutEffect(() => {
    const el = cajaRef.current;
    const root = document.documentElement;
    if (!reservarEspacio || !el) return;
    const medir = () => {
      const franja = Math.max(0, window.innerHeight - el.getBoundingClientRect().top);
      root.style.setProperty('--aviso-push-h', `${Math.ceil(franja)}px`);
    };
    medir();
    root.setAttribute('data-aviso-push', '');
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    window.addEventListener('resize', medir);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', medir);
      root.removeAttribute('data-aviso-push');
      root.style.removeProperty('--aviso-push-h');
    };
  }, [reservarEspacio]);

  if (!mostrando) return null;

  const dismiss = () => {
    setExiting(true);
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* modo privado: no persiste, pero cierra igual */ }
    setTimeout(() => setVisible(false), 300);
  };

  const handleActivate = async () => {
    const ok = await subscribe();
    if (ok) dismiss();
    // Si denegó en el popup del navegador, el hook ya muestra toast — solo cerramos
    else dismiss();
  };

  return (
    <div
      ref={cajaRef}
      className={cn(
        // Celular: franja pegada encima de la barra inferior, de lado a lado.
        // md+: tarjeta en la esquina de abajo a la derecha, encima del botón de
        // Mapi (bottom-6 + 3.5rem). Ya no va centrada sobre el contenido.
        // z-40: por debajo de modales y menús (z-50) y de la cabecera.
        'fixed inset-x-0 bottom-nav-safe z-40 px-gutter pb-2',
        'md:inset-x-auto md:bottom-24 md:right-6 md:w-full md:max-w-xs md:px-0 md:pb-0',
        'transition-all duration-300',
        exiting ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100',
      )}
      role="dialog"
      aria-label="Activar notificaciones"
    >
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-lg md:p-4">

        {/* Icono */}
        <div className="hidden flex-shrink-0 rounded-full bg-primary/10 p-2 sm:block">
          <Bell className="h-5 w-5 text-primary" />
        </div>

        {/* Contenido */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">
            Activa las notificaciones
          </p>
          {/* En pantallas bajas (celular a 200 % de zoom) solo título y botones. */}
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground [@media(max-height:32rem)]:hidden">
            Recibe alertas de pagos, sesiones y accesos en tu dispositivo.
          </p>

          {/* Aviso iOS — solo en Safari de iPhone/iPad (web): en Android, en
              escritorio y en la app nativa no aplica y ocupaba espacio. */}
          {esIOSWeb() && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Smartphone className="h-3 w-3 flex-shrink-0" />
              <span>En iPhone instala la app desde Safari → <em>Agregar a inicio</em></span>
            </div>
          )}

          {/* Acciones */}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="min-h-touch gap-1.5 text-xs md:h-8 md:min-h-0"
              onClick={handleActivate}
              disabled={status === 'loading'}
            >
              <Bell className="h-3.5 w-3.5" />
              {status === 'loading' ? 'Activando…' : 'Activar'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-touch text-xs text-muted-foreground md:h-8 md:min-h-0"
              onClick={dismiss}
            >
              Ahora no
            </Button>
          </div>
        </div>

        {/* Cerrar */}
        <button
          onClick={dismiss}
          className="-m-2 flex h-touch w-touch flex-shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
