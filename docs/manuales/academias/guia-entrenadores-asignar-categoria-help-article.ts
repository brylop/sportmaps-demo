/**
 * Artículo NUEVO para `bff/src/data/help-articles.ts`. NO está aplicado — este
 * archivo es el snippet listo para pegar, según la política por defecto del
 * patrón de manuales ("solo el contenido, listo para pegar").
 *
 * Por qué un slug nuevo y no un reemplazo: se grepeó el corpus (42 slugs) y
 * ninguno cubre el tema. Lo más cercano es `configurar-sedes-equipos`, que es
 * de administración (crear la estructura), y `registrar-nuevo-atleta`, que es
 * el alta — no la inscripción de un atleta existente a una categoría por parte
 * del entrenador. No hay ningún artículo dirigido al rol coach sobre roster.
 *
 * Cómo aplicar: agregar el objeto de abajo al array exportado de
 * bff/src/data/help-articles.ts. `categoryId: "gestion-alumnos"` existe en
 * `helpCategories`. Conviene además sumar este slug al `related` de
 * `configurar-sedes-equipos` y `registrar-nuevo-atleta`.
 *
 * Contenido = versión ACADEMIAS del manual
 * (docs/manuales/academias/guia-entrenadores-asignar-categoria.pdf): sin flags,
 * endpoints, nombres de tabla ni guion de soporte.
 */

import type { ContentBlock } from "../help-articles"; // ajustar el import relativo al pegar

export const inscribirDeportistasCategoriaBody: ContentBlock[] = [
  {
    type: "p",
    content:
      "Como entrenador puedes inscribir en tus categorías a cualquier deportista que ya esté registrado en la escuela. No necesitas permisos especiales: el camino está siempre disponible desde Mis Equipos.",
  },
  { type: "h2", content: "Dónde están tus categorías" },
  {
    type: "p",
    content:
      "En el menú lateral, entra a Mis Equipos. Ves solo las categorías que la escuela te asignó, no todas las del club. Cada una muestra su deporte, su sede, cuántos deportistas tiene inscritos y su estado.",
  },
  {
    type: "callout",
    variant: "info",
    content:
      "Si el administrador le puso un cupo máximo a la categoría, verás los dos números (por ejemplo 2/30). Si la categoría no tiene cupo configurado, verás solo cuántos hay inscritos.",
  },
  { type: "h2", content: "Inscribir deportistas" },
  {
    type: "ol",
    items: [
      'En la fila o la tarjeta de la categoría, pulsa el botón con el ícono de persona con un signo +. Al pasar el cursor dice "Gestionar Deportistas".',
      'Se abre la ventana "Inscribir Deportistas". Arriba van los que ya están inscritos; debajo, los deportistas de la escuela que todavía no están en esta categoría.',
      'Si la lista es larga, escribe en el buscador ("Buscar deportista por nombre, email o grado..."). Filtra los dos bloques a la vez, así que también te sirve para comprobar si alguien ya está inscrito.',
      'Al lado del deportista, pulsa el botón verde "Inscribir". Aparece el aviso "¡Deportista inscrito!", el deportista sube al bloque de arriba con la etiqueta "Inscrito" y el contador de ocupación aumenta.',
      'Repite con cada deportista y pulsa "Cerrar". No hay que guardar nada al final: cada clic queda registrado de inmediato.',
    ],
  },
  {
    type: "callout",
    variant: "warning",
    content:
      "Si la categoría tiene mensualidad, la ventana lo avisa en color ámbar con el valor. Inscribir a un deportista en una categoría con mensualidad le genera su cobro cuando la escuela abre el mes. Si no estás seguro de que ese deportista deba pagar esa categoría, confírmalo con tu administrador antes de inscribirlo.",
  },
  { type: "h2", content: 'Por qué "Mis Deportistas" te puede salir vacío' },
  {
    type: "p",
    content:
      "Es la confusión más común, y no es un error. La pantalla Mis Deportistas muestra únicamente a quienes ya están inscritos en tus categorías. Si todavía no has inscrito a nadie, la lista sale en cero aunque la escuela tenga cientos de deportistas registrados.",
  },
  {
    type: "callout",
    variant: "tip",
    content:
      'Para llenarla: ve a Mis Equipos, abre "Gestionar Deportistas" en tu categoría e inscribe desde ahí. Cuando vuelvas a Mis Deportistas ya aparecerán. Si tampoco ves categorías en Mis Equipos, pídele a tu administrador que te asigne como entrenador de las que te corresponden.',
  },
  { type: "h2", content: "Lo que resuelve tu administrador" },
  {
    type: "table",
    headers: ["Necesitas…", "Por qué no lo haces tú"],
    rows: [
      [
        "Registrar un deportista nuevo, que aún no existe en la escuela",
        "El alta de deportistas es de la administración. Pídelo con el nombre completo y los datos del acudiente; apenas quede registrado, aparecerá en tu listado.",
      ],
      [
        "Sacar a un deportista de una categoría",
        "Quitar una inscripción está reservado a la administración. Indica el nombre, la categoría equivocada y la correcta, para que se resuelva de una sola vez.",
      ],
      [
        "Ampliar el cupo de una categoría llena",
        "El cupo máximo es parte de la configuración de la categoría.",
      ],
      [
        "Asignarte una categoría que no ves en Mis Equipos",
        "Solo ves las categorías en las que figuras como entrenador.",
      ],
    ],
  },
  { type: "h2", content: "Preguntas frecuentes" },
  { type: "h3", content: 'El botón "Inscribir" se ve apagado y no puedo pulsarlo' },
  {
    type: "p",
    content:
      "La categoría llegó a su cupo máximo: la etiqueta de ocupación está en rojo y los dos números son iguales. Pídele a tu administrador que amplíe el cupo de esa categoría.",
  },
  { type: "h3", content: "No encuentro al deportista en el listado" },
  {
    type: "p",
    content:
      "Usa primero el buscador, con el apellido o el nombre incompleto. Si aun así no aparece, es que todavía no está registrado en la escuela: pide el alta a tu administrador.",
  },
  { type: "h3", content: "No veo la mensualidad ni el estado de pago de mis deportistas" },
  {
    type: "p",
    content:
      "Es la configuración de tu escuela y es normal. Algunas escuelas prefieren que la información de dinero la maneje solo la administración. Tu trabajo con las categorías, la asistencia y el entrenamiento funciona igual.",
  },
  { type: "h3", content: "Inscribí a alguien en la categoría equivocada" },
  {
    type: "p",
    content:
      "Pídele a tu administrador que lo remueva, e inscríbelo tú en la correcta.",
  },
  {
    type: "callout",
    variant: "tip",
    content:
      "Algunas escuelas habilitan además que el entrenador cambie la categoría de un deportista desde Mis Deportistas, con el menú de tres puntos, Editar, el campo Equipo y Guardar Cambios. Si no ves esa opción, usa el camino de Mis Equipos.",
  },
];

/* Objeto HelpArticle completo, listo para agregar al array: */
export const inscribirDeportistasCategoriaArticle = {
  slug: "inscribir-deportistas-categoria-coach",
  categoryId: "gestion-alumnos",
  title: "Cómo inscribir deportistas en tus categorías (entrenador)",
  excerpt:
    'Desde Mis Equipos, con "Gestionar Deportistas": inscribir, buscar, y por qué Mis Deportistas puede salir vacío aunque la escuela tenga cientos de atletas.',
  readTime: "3 min",
  targetRole: ["coach"],
  body: inscribirDeportistasCategoriaBody,
  related: ["configurar-sedes-equipos", "registrar-nuevo-atleta", "tomar-asistencia-coach"],
};
