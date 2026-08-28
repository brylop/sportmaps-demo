import { useState, useEffect } from 'react';
import { Bell, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { usePushPermissionStatus } from '@/hooks/usePushPermissionStatus';
import { isNativePlatform } from '@/lib/openExternalUrl';

const DISMISSED_KEY = 'sportmaps_push_banner_dismissed';
const DELAY_MS      = 3000; // Esperar 3s antes de mostrar

/**
 * Banner que solicita permiso de notificaciones push.
 * - Aparece 3 segundos después del login si el permiso está en 'default'
 * - Si el usuario lo cierra sin decidir, no vuelve a aparecer en la sesión
 * - Si el permiso ya fue concedido o denegado, nunca se muestra
 * - En navegadores no soportados (Safari sin PWA), no se muestra
 *
 * Funciona igual en web y en la app nativa: `usePushSubscription` ramifica por
 * plataforma. En nativo lo normal es que este banner NO aparezca, porque
 * `useDeviceContext` ya pidió el permiso al entrar y el estado queda en
 * 'granted' o 'denied'; solo sale si el prompt del SO quedó sin responder.
 */
export function PushPermissionBanner() {
  const permissionState         = usePushPermissionStatus();
  const { subscribe, status }   = usePushSubscription();
  const [visible, setVisible]   = useState(false);
  const [exiting, setExiting]   = useState(false);

  useEffect(() => {
    if (permissionState !== 'prompt') return;

    // No mostrar si ya lo descartó esta sesión
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    const timer = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, [permissionState]);

  if (!visible || permissionState !== 'prompt') return null;

  const dismiss = () => {
    setExiting(true);
    sessionStorage.setItem(DISMISSED_KEY, '1');
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
      className={`
        fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4
        transition-all duration-300
        ${exiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}
      `}
      role="dialog"
      aria-label="Activar notificaciones"
    >
      <div className="bg-card border border-border rounded-xl shadow-lg p-4 flex gap-4 items-start">

        {/* Icono */}
        <div className="flex-shrink-0 p-2 bg-primary/10 rounded-full mt-0.5">
          <Bell className="h-5 w-5 text-primary" />
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">
            Activa las notificaciones
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Recibe alertas de pagos, sesiones y accesos directamente en tu dispositivo.
          </p>

          {/* Aviso iOS — solo en web: dentro de la app nativa no aplica y confunde */}
          {!isNativePlatform() && (
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground/70">
              <Smartphone className="h-3 w-3 flex-shrink-0" />
              <span>En iPhone instala la app desde Safari → <em>Agregar a inicio</em></span>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleActivate}
              disabled={status === 'loading'}
            >
              <Bell className="h-3.5 w-3.5" />
              {status === 'loading' ? 'Activando…' : 'Activar'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground"
              onClick={dismiss}
            >
              Ahora no
            </Button>
          </div>
        </div>

        {/* Cerrar */}
        <button
          onClick={dismiss}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
