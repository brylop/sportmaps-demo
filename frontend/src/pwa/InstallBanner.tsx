import { useState, useEffect } from 'react'
import { getDisplayMode, getPwaTenantName, getPwaTenantSlug, isIos } from './tenant'

const IOS_DISMISS_KEY = 'sm_ios_install_dismissed'

export function InstallBanner() {
  // Estado inicial = evento capturado por el script inline del index.html
  // (Chrome Android puede dispararlo antes de que monte este componente).
  const [prompt, setPrompt] = useState<any>(() => (window as any).__installPrompt ?? null)

  // iOS NUNCA dispara `beforeinstallprompt`: Safari no ofrece instalar, hay que
  // pasar por Compartir → Añadir a inicio. Sin esta rama, en iPhone no aparecia
  // absolutamente nada y no habia forma de saber que la app era instalable.
  const [mostrarIos, setMostrarIos] = useState(false)

  // Marca con la que se va a instalar. Es la MISMA que resolvio el script inline
  // del index.html para el manifest, asi que lo que anuncia el banner coincide
  // con el icono que va a quedar en la pantalla de inicio.
  const slug = getPwaTenantSlug()
  const nombreEscuela = getPwaTenantName()
  const nombre = nombreEscuela || 'SportMaps'
  const icono = slug ? `/app-icon.png?s=${encodeURIComponent(slug)}` : '/icons/icon-72.png'

  useEffect(() => {
    // Reconciliar por si el evento llegó entre el render inicial y este efecto.
    const stashed = (window as any).__installPrompt
    if (stashed) setPrompt(stashed)

    const onCanInstall = () => setPrompt((window as any).__installPrompt ?? null)
    const onBeforePrompt = (e: any) => { e.preventDefault(); setPrompt(e) }
    const onInstalled = () => setPrompt(null)

    window.addEventListener('pwa:can-install', onCanInstall)
    window.addEventListener('beforeinstallprompt', onBeforePrompt)
    window.addEventListener('appinstalled', onInstalled)

    // iOS: se muestra solo si esta en Safari (no ya instalada) y no lo cerraron.
    try {
      const yaCerrado = localStorage.getItem(IOS_DISMISS_KEY) === '1'
      if (isIos() && getDisplayMode() === 'browser' && !yaCerrado) {
        setMostrarIos(true)
      }
    } catch { /* modo privado: no se muestra, no se rompe */ }

    return () => {
      window.removeEventListener('pwa:can-install', onCanInstall)
      window.removeEventListener('beforeinstallprompt', onBeforePrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const cerrarIos = () => {
    setMostrarIos(false)
    // Se recuerda para no insistir en cada apertura.
    try { localStorage.setItem(IOS_DISMISS_KEY, '1') } catch { /* no-op */ }
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
    <button onClick={onClick} className="text-slate-400 hover:text-slate-600 p-1 shrink-0" aria-label="Cerrar">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>
  )

  // Android / escritorio: instalacion en un toque.
  if (prompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-white rounded-xl shadow-lg p-4 flex items-center gap-3 z-50 border border-sky-100 animate-in slide-in-from-bottom-5 duration-300">
        <Icono />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate text-slate-900">Instalar {nombre}</p>
          <p className="text-xs text-slate-500 truncate">Acceso rápido desde tu pantalla de inicio</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { prompt.prompt(); (window as any).__installPrompt = null; setPrompt(null) }}
            className="bg-sky-500 hover:bg-sky-600 text-white text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            Instalar
          </button>
          <Cerrar onClick={() => setPrompt(null)} />
        </div>
      </div>
    )
  }

  // iOS: no hay boton posible, solo se puede explicar el gesto.
  if (mostrarIos) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-white rounded-xl shadow-lg p-4 flex items-start gap-3 z-50 border border-sky-100 animate-in slide-in-from-bottom-5 duration-300">
        <Icono />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-900">Instalar {nombre}</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Tocá{' '}
            <span className="inline-flex items-center align-middle mx-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline text-sky-600"><path d="M12 2v13"/><path d="m16 6-4-4-4 4"/><path d="M8 10H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2"/></svg>
            </span>
            {' '}Compartir y después <strong className="text-slate-700">Añadir a inicio</strong>.
          </p>
        </div>
        <Cerrar onClick={cerrarIos} />
      </div>
    )
  }

  return null
}
