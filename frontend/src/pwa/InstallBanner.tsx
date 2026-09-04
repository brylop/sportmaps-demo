import { useState, useEffect } from 'react'
import { getDisplayMode, getLiveTenant, getPwaTenantName, getPwaTenantSlug, isIos, LIVE_TENANT_EVENT } from './tenant'

// Una sola llave para Android/escritorio e iOS: al cerrar con la X no debe
// volver a aparecer en ninguna pestaña ni al recargar, hasta que se instale.
const INSTALL_DISMISS_KEY = 'sm_install_dismissed'

function yaFueCerrado() {
  try { return localStorage.getItem(INSTALL_DISMISS_KEY) === '1' } catch { return false }
}

export function InstallBanner() {
  // Estado inicial = evento capturado por el script inline del index.html
  // (Chrome Android puede dispararlo antes de que monte este componente).
  const [prompt, setPrompt] = useState<any>(() => (yaFueCerrado() ? null : ((window as any).__installPrompt ?? null)))

  // iOS NUNCA dispara `beforeinstallprompt`: Safari no ofrece instalar, hay que
  // pasar por Compartir → Añadir a inicio. Sin esta rama, en iPhone no aparecia
  // absolutamente nada y no habia forma de saber que la app era instalable.
  const [mostrarIos, setMostrarIos] = useState(false)

  // Escuela ya verificada de la sesion autenticada (usePwaTenantSync, corre
  // dentro del auth boundary). Se prefiere sobre resolveTenantSlug(), que es
  // el fallback conservador para visitantes anonimos (?t=, subdominio, o app
  // ya instalada) y por eso no se entera de un login normal a la app.
  const [liveTenant, setLiveTenantState] = useState(() => getLiveTenant())

  useEffect(() => {
    const onLiveTenant = () => setLiveTenantState(getLiveTenant())
    window.addEventListener(LIVE_TENANT_EVENT, onLiveTenant)
    return () => window.removeEventListener(LIVE_TENANT_EVENT, onLiveTenant)
  }, [])

  // Marca con la que se va a instalar. Es la MISMA que resolvio el script inline
  // del index.html para el manifest, asi que lo que anuncia el banner coincide
  // con el icono que va a quedar en la pantalla de inicio.
  const slug = liveTenant?.slug ?? getPwaTenantSlug()
  const nombreEscuela = liveTenant?.name ?? getPwaTenantName()
  const nombre = nombreEscuela || 'SportMaps'
  const icono = slug ? `/app-icon.png?s=${encodeURIComponent(slug)}` : '/icons/icon-72.png'

  useEffect(() => {
    // Reconciliar por si el evento llegó entre el render inicial y este efecto.
    const stashed = (window as any).__installPrompt
    if (stashed && !yaFueCerrado()) setPrompt(stashed)

    const onCanInstall = () => { if (!yaFueCerrado()) setPrompt((window as any).__installPrompt ?? null) }
    const onBeforePrompt = (e: any) => { e.preventDefault(); if (!yaFueCerrado()) setPrompt(e) }
    const onInstalled = () => setPrompt(null)
    // Otra pestaña cerró el banner: se sincroniza sin esperar a recargar.
    const onStorage = (e: StorageEvent) => {
      if (e.key === INSTALL_DISMISS_KEY && e.newValue === '1') {
        setPrompt(null)
        setMostrarIos(false)
      }
    }

    window.addEventListener('pwa:can-install', onCanInstall)
    window.addEventListener('beforeinstallprompt', onBeforePrompt)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener('storage', onStorage)

    // iOS: se muestra solo si hay ESCUELA, esta en Safari (no ya instalada) y no
    // lo cerraron. El gate por escuela es deliberado: en iOS no existe boton de
    // instalar, asi que este banner es contenido nuevo, y aparecerle de golpe a
    // todos los usuarios de SportMaps seria un cambio de producto que nadie
    // pidio. Se limita a quien viene de la app de su escuela.
    if (slug && isIos() && getDisplayMode() === 'browser' && !yaFueCerrado()) {
      setMostrarIos(true)
    }

    return () => {
      window.removeEventListener('pwa:can-install', onCanInstall)
      window.removeEventListener('beforeinstallprompt', onBeforePrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('storage', onStorage)
    }
  }, [slug])

  // Cerrar con la X vale para Android/escritorio e iOS por igual: no debe
  // reaparecer en ninguna pestaña ni al recargar, hasta que se instale.
  const cerrarDefinitivo = () => {
    setPrompt(null)
    setMostrarIos(false)
    try { localStorage.setItem(INSTALL_DISMISS_KEY, '1') } catch { /* modo privado: no persiste, pero cierra igual */ }
  }

  const Icono = () => (
    <img
      src={icono}
      className="w-10 h-10 rounded-lg shadow-sm object-contain shrink-0"
      alt={nombre}
      // Si el icono de la escuela no resuelve, cae al de SportMaps en vez de
      // dejar un hueco roto justo en el banner que invita a instalar.
      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/icons/icon-72.png' }}
    />
  )

  const Cerrar = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className="text-muted-foreground hover:text-foreground p-1 shrink-0" aria-label="Cerrar">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>
  )

  // Android / escritorio: instalacion en un toque.
  if (prompt) {
    return (
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] left-4 right-4 bg-card rounded-xl shadow-lg p-4 flex items-center gap-3 z-50 border border-border animate-in slide-in-from-bottom-5 duration-300">
        <Icono />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate text-foreground">Instalar {nombre}</p>
          <p className="text-xs text-muted-foreground truncate">Acceso rápido desde tu pantalla de inicio</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { prompt.prompt(); (window as any).__installPrompt = null; setPrompt(null) }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            Instalar
          </button>
          <Cerrar onClick={cerrarDefinitivo} />
        </div>
      </div>
    )
  }

  // iOS: no hay boton posible, solo se puede explicar el gesto.
  if (mostrarIos) {
    return (
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] left-4 right-4 bg-card rounded-xl shadow-lg p-4 flex items-start gap-3 z-50 border border-border animate-in slide-in-from-bottom-5 duration-300">
        <Icono />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">Instalar {nombre}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Tocá{' '}
            <span className="inline-flex items-center align-middle mx-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline text-primary"><path d="M12 2v13"/><path d="m16 6-4-4-4 4"/><path d="M8 10H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2"/></svg>
            </span>
            {' '}Compartir y después <strong className="text-foreground">Añadir a inicio</strong>.
          </p>
        </div>
        <Cerrar onClick={cerrarDefinitivo} />
      </div>
    )
  }

  return null
}
