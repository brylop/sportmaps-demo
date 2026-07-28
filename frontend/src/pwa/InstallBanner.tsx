import { useState, useEffect } from 'react'

export function InstallBanner() {
  // Estado inicial = evento capturado por el script inline del index.html
  // (Chrome Android puede dispararlo antes de que monte este componente).
  const [prompt, setPrompt] = useState<any>(() => (window as any).__installPrompt ?? null)

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
      <img src="/icons/icon-72.png" className="w-10 h-10 rounded-lg shadow-sm" alt="SportMaps Logo" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate text-slate-900">Instalar SportMaps</p>
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
