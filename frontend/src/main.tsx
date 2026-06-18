import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from './pwa/register';

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
    <App />
  </StrictMode>
);

// La app arrancó correctamente → re-armar el guard para que un próximo
// redeploy (con chunks nuevos) también pueda recuperarse en esta misma sesión.
window.addEventListener('load', () => {
  setTimeout(() => sessionStorage.removeItem(CHUNK_RELOAD_KEY), 2000);
});

// Register Service Worker for PWA
registerSW();
