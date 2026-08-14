import { useState, useEffect } from 'react'
import { getPwaTenantName, getPwaTenantSlug } from './tenant'

export function InstallBanner() {
  // Estado inicial = evento capturado por el script inline del index.html
  // (Chrome Android puede dispararlo antes de que monte este componente).
  const [prompt, setPrompt] = useState<any>(() => (window as any).__installPrompt ?? null)

  // Marca con la que se va a instalar. Es la MISMA que resolvio el script inline
  // del index.html para el manifest, asi que lo que anuncia el banner coincide
  // con el icono que va a quedar en la pantalla de inicio.
  const slug = getPwaTenantSlug()
  const nombreEscuela = getPwaTenantName()
  const titulo = nombreEscuela ? `Instalar ${nombreEscuela}` : 'Instalar SportMaps'
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
    return () => {
      window.removeEventListener('pwa:can-install', onCanInstall)
      window.removeEventListener('beforeinstallprompt', onBeforePrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!prompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-white rounded-xl shadow-lg p-4 flex items-center gap-3 z-50 border border-sky-100 animate-in slide-in-from-bottom-5 duration-300">
      <img
        src={icono}
        className="w-10 h-10 rounded-lg shadow-sm object-contain"
        alt={nombreEscuela || 'SportMaps'}
        // Si el icono de la escuela no resuelve, cae al de SportMaps en vez de
        // dejar un hueco roto justo en el banner que invita a instalar.
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/icons/icon-72.png' }}
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate text-slate-900">{titulo}</p>
        <p className="text-xs text-slate-500 truncate">Acceso rápido desde tu pantalla de inicio</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => { prompt.prompt(); (window as any).__installPrompt = null; setPrompt(null) }}
          className="bg-sky-500 hover:bg-sky-600 text-white text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          Instalar
        </button>
        <button onClick={() => setPrompt(null)} className="text-slate-400 hover:text-slate-600 p-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
    </div>
  )
}
