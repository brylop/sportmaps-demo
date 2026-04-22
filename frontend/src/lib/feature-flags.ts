// Bandera para mostrar Explorar solo en dev y en la deploy preview de develop.
// - Local (`npm run dev`): true por `import.meta.env.DEV`.
// - Deploy: configurar `VITE_SHOW_EXPLORE=true` en Vercel para el entorno de
//   preview/develop. En staging/prod se deja sin configurar y queda oculto.
export const SHOW_EXPLORE =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_EXPLORE === 'true';
