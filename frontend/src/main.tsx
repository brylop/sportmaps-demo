import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from '@sentry/react';
import App from "./App.tsx";
import "./index.css";
import { registerSW } from './pwa/register';
import { initSentry } from './lib/sentry';

initSentry();

// ── Handle stale chunks after deploy ────────────────────────────────────────
// When a new deploy happens, old JS chunks no longer exist on the server.
// The server returns index.html (text/html) instead → MIME type error.
// This listener catches that and reloads once to get the new index.html.
const CHUNK_RELOAD_KEY = 'chunk-reload';
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog={false}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>
);

// Antes: un error de render dejaba la pantalla en blanco sin aviso (el
// hallazgo de la auditoría de tablas — "error -> tabla vacía silenciosa").
// Con esto al menos hay un mensaje y un botón para recargar.
function ErrorFallback() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <div>
        <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>Algo salió mal</p>
        <p style={{ color: '#666', marginBottom: '1rem' }}>Ya nos avisaron del error. Intentá recargar la página.</p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', background: '#248223', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          Recargar
        </button>
      </div>
    </div>
  );
}

// La app arrancó correctamente → re-armar el guard para que un próximo
// redeploy (con chunks nuevos) también pueda recuperarse en esta misma sesión.
window.addEventListener('load', () => {
  setTimeout(() => sessionStorage.removeItem(CHUNK_RELOAD_KEY), 2000);
});

// Register Service Worker for PWA
registerSW();
