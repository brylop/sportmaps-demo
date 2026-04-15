import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from './pwa/register';

// ── Handle stale chunks after deploy ────────────────────────────────────────
// When a new deploy happens, old JS chunks no longer exist on the server.
// The server returns index.html (text/html) instead → MIME type error.
// This listener catches that and reloads once to get the new index.html.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const reloadedKey = 'chunk-reload';
  if (!sessionStorage.getItem(reloadedKey)) {
    sessionStorage.setItem(reloadedKey, '1');
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register Service Worker for PWA
registerSW();
