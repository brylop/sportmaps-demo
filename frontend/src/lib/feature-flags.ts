// Bandera para mostrar Explorar solo en dev y en la deploy preview de develop.
// - Local (`npm run dev`): true por `import.meta.env.DEV`.
// - Deploy: configurar `VITE_SHOW_EXPLORE=true` en Vercel para el entorno de
//   preview/develop. En staging/prod se deja sin configurar y queda oculto.
// 2026-10-24: APAGADO PARA TODOS (también en dev) hasta terminar el rediseño de
// Explorar. Se prende solo con `VITE_SHOW_EXPLORE=true`. Con la bandera apagada
// la ruta /explorar muestra «Muy pronto» en vez de la pantalla vieja.
export const SHOW_EXPLORE = import.meta.env.VITE_SHOW_EXPLORE === 'true';

// Acudiente V2 (docs/specs/modulos-v2-definicion.md §4): las cinco pestañas
// Inicio · Calendario · Hijos · Pagos · Más. Prendido por defecto. Para volver
// a la versión anterior sin tocar código: `VITE_ACUDIENTE_V2=false` en Vercel
// y redesplegar (la variable se hornea en el build).
export const ACUDIENTE_V2 = import.meta.env.VITE_ACUDIENTE_V2 !== 'false';
