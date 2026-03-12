import { useState, useEffect } from 'react'

export function InstallBanner() {
  const [prompt, setPrompt] = useState<any>(null)

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
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
          onClick={() => { prompt.prompt(); setPrompt(null) }}
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
