import { useState, useEffect } from 'react'

export function UpdateBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = () => setShow(true)
    window.addEventListener('pwa:update-available', handler)
    return () => window.removeEventListener('pwa:update-available', handler)
  }, [])

  if (!show) return null

  return (
    <div className="fixed top-0 left-0 right-0 bg-sky-500 text-white text-sm text-center py-2.5 z-[100] flex justify-center items-center gap-4 shadow-sm animate-in slide-in-from-top duration-300">
      <span className="font-medium">✨ Nueva versión disponible</span>
      <button
        onClick={() => window.location.reload()}
        className="underline font-bold hover:text-white/80 transition-colors"
      >
        Actualizar ahora
      </button>
      <button onClick={() => setShow(false)} className="bg-white/20 hover:bg-white/30 rounded-full p-1 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
  )
}
