/**
 * Artículo NUEVO propuesto para el Centro de Ayuda / Mapi: `bff/src/data/help-articles.ts`.
 * NO está aplicado — es el contenido listo para pegar (patrón `feedback_pdf_manual_template`).
 *
 * Verificado el 2026-10-20: en help-articles.ts NO existe un slug de pizarra táctica
 * (`grep -n -i "pizarra\|tablero" bff/src/data/help-articles.ts` solo toca un artículo de QR),
 * así que se propone CREAR `pizarra-tactica` dentro del array `helpArticles`, junto a
 * `planes-entrenamiento` (categoría `operacion-diaria`). Reemplaza al borrador anterior de este
 * archivo, que solo cubría F1 (material, siluetas, balón en juego, modo arqueros) y quedó viejo.
 *
 * Contenido de la versión ACADEMIAS del manual (docs/manuales/academias/pizarra-tactica.pdf):
 * sin huecos de producto, sin precios, sin nombres de proveedor internos. Los bloques `img` se
 * omitieron a propósito (no hay URLs públicas de las capturas); si el Centro de Ayuda aloja
 * imágenes, las capturas están en docs/manuales/_src/pizarra-tactica/shots-v2/.
 *
 * Para pegar: copiar el objeto `pizarraTacticaArticle` dentro del array y ajustar el import
 * relativo del tipo (aquí se importa desde "../help-articles" solo para que compile suelto).
 */

import type { HelpArticle } from "../help-articles";

export const pizarraTacticaArticle: HelpArticle = {
  slug: "pizarra-tactica",
  categoryId: "operacion-diaria",
  title: "Pizarra táctica: formaciones, dibujo, cuadros, 3D, biblioteca e IA",
  excerpt:
    "Cómo armar una jugada o un ejercicio: formaciones para tu equipo y el rival, líneas y zonas, animación por cuadros, notas y videos, biblioteca de ejercicios, exportar y ver en 3D.",
  readTime: "9 min",
  targetRole: ["coach", "school"],
  related: ["planes-entrenamiento", "tomar-asistencia-coach"],
  body: [
    {
      type: "p",
      content:
        "La pizarra táctica vive dentro de cada bloque de una sesión de entrenamiento. Ahí pones a tu equipo y al rival en una formación, dibujas recorridos, animas la jugada por cuadros, la miras en 3D, la guardas en tu biblioteca y la compartes. Lo que armas queda guardado con ese bloque.",
    },
    { type: "h2", content: "Quién la ve y cómo se abre" },
    {
      type: "ol",
      items: [
        "Entra a Métricas y Rendimiento y elige el equipo.",
        "En la sesión, cada bloque (calentamiento, parte situacional, arqueros…) tiene el botón Tablero táctico. Púlsalo. Si el equipo tiene mesociclo activo, la sesión se abre desde su día.",
      ],
    },
    {
      type: "table",
      headers: ["Nivel", "Deportes", "Qué trae"],
      rows: [
        [
          "Pizarra completa",
          "Fútbol 11, 7 y 5, fútbol sala, voleibol, baloncesto y balonmano",
          "Cancha reglamentaria, formaciones propias, material, biblioteca y paquetes de ejercicios, 3D y análisis con IA",
        ],
        [
          "Pizarra de cancha",
          "Rugby, fútbol americano, tenis, pádel, bádminton, vóley playa, hockey sobre césped, hockey sobre patines, netball, waterpolo y ultimate",
          "Su cancha con medidas oficiales y posiciones de arranque; dibujo, material, cuadros, exportar y 3D",
        ],
        [
          "Sin pizarra",
          "Natación, gimnasia, karate, golf, boxeo, atletismo, cheerleading y similares",
          "El botón no aparece; siguen con sesiones, asistencia y métricas",
        ],
      ],
    },
    {
      type: "callout",
      variant: "info",
      content:
        "La pizarra se abre según el deporte del equipo y cada escuela ve solo lo de sus equipos: una escuela de fútbol no ve formaciones ni plantillas de voleibol.",
    },
    { type: "h2", content: "Recorrido por el tablero" },
    {
      type: "p",
      content:
        "El tablero abre a pantalla completa: arriba la barra de herramientas, en el centro la cancha y abajo la línea de tiempo de cuadros. Los paneles Jugadores (derecha) y Dibujar (izquierda) se abren y cierran con sus botones.",
    },
    {
      type: "table",
      headers: ["Botón", "Para qué sirve"],
      rows: [
        ["Formación", "Galería de formaciones para tu equipo y para el rival"],
        ["Jugadores", "Plantilla del equipo: arrastrar a la cancha o pasar a la banca; Sugerir XI"],
        ["Dibujar", "Lápiz, texto, líneas, balón en juego, zonas, foco, material, colores y deshacer"],
        ["Equipos", "Nombre, escudo, colores y ficha de tu equipo y del rival"],
        ["Notas · Videos", "Texto y etiquetas de la jugada y de cada cuadro · videos por enlace"],
        ["Más", "Situación, Mis jugadas, guardar en biblioteca, Campo y opciones de vista"],
        ["Analizar jugada · Ajustes", "Análisis con IA · preferencias de animación, rastros y tema"],
        ["Exportar · Ver en 3D", "PNG, PDF, video o GIF y WhatsApp · visor 3D de la misma jugada"],
        ["Cancelar · Guardar jugada", "Salir sin guardar · dejar la jugada guardada en este bloque"],
      ],
    },
    { type: "h2", content: "Formaciones: tu equipo y el rival" },
    {
      type: "p",
      content:
        "En Formación eliges para quién es la formación y tocas la tarjeta. En fútbol hay 38 formaciones (Clásicas, Modernas, Defensivas, Ofensivas, Históricas y Fútbol 7), con buscador y filtro por 11 o 7 jugadores; voleibol trae las rotaciones de 5-1, 4-2 y 6-2; baloncesto, defensas en zona, presiones y ataques; balonmano, sus defensas y ataques.",
    },
    {
      type: "ul",
      items: [
        "Pestaña Mi equipo: aparecen círculos punteados con el nombre del puesto. Abre Jugadores y arrastra a cada deportista a su círculo; la × roja lo devuelve a la plantilla.",
        "Pestaña Rival: pone al contrario en espejo en la mitad de arriba, con fichas rojas «R». Elegir otra formación de rival reemplaza al anterior y Quitar rival lo borra.",
        "Sugerir XI arma un once por minutos jugados cuando el equipo tiene partidos registrados (solo con la cancha vacía).",
        "En Más → Vista puedes ver a los jugadores como siluetas (el arquero sale en amarillo) y activar las zonas de la cancha.",
      ],
    },
    { type: "h2", content: "Dibujar: líneas, zonas, foco y números" },
    {
      type: "p",
      content:
        "Abre Dibujar, activa Modo dibujo y arrastra sobre la cancha. Las figuras ya puestas se ajustan con sus puntos blancos o se borran sin necesidad de este modo.",
    },
    {
      type: "table",
      headers: ["Herramienta", "Qué hace"],
      rows: [
        ["Lápiz · Texto · Borrador", "Rayar libre, escribir sobre la cancha y borrar"],
        ["Flecha · Curva · Zona", "Líneas rectas, curvas y zonas"],
        ["Pase · Remate · Penal", "Recorrido del balón: arrastra desde donde sale hasta donde llega"],
        [
          "Tipo de línea",
          "Clásica, Pase (discontinua con flecha), Conducción (ondulada), Carrera sin balón (continua) y Disparo (doble y gruesa). La leyenda sale sola en la cancha y en lo que exportes",
        ],
        ["Zonas", "Rectángulo, elipse y polígono, con relleno translúcido y color"],
        ["Resaltar jugador", "Anillo de foco sobre el jugador que toques"],
        ["Numerar", "Cada flecha nueva lleva su número (1, 2, 3…); Renumerar los ordena"],
        ["Regla", "Mide distancias en metros sobre la cancha"],
      ],
    },
    {
      type: "p",
      content:
        "Nueve colores para líneas, zonas y material: zonas de distinto color, distintas consignas. Deshacer y Rehacer (Ctrl+Z y Ctrl+Shift+Z) recorren los cambios; Borrar todo pide confirmación y no toca a los jugadores.",
    },
    { type: "h2", content: "Material de entrenamiento" },
    {
      type: "p",
      content:
        "Once objetos: cono, plato, balón, arco, arco chico, vallita, aro, escalera, estaca, maniquí y rival. Elige uno y toca la cancha una vez por cada objeto; arrástralo para moverlo.",
    },
    {
      type: "ul",
      items: [
        "Tocar un objeto lo selecciona (marco punteado, punto verde para girar, × para quitar). Tocar nunca borra.",
        "Con uno seleccionado, Tamaño (0,5× a 3×) y Giro lo cambian; +90° gira en cuartos y Duplicar lo copia con su tamaño, giro y color.",
        "Sin nada seleccionado, los mismos deslizadores fijan cómo se colocan los objetos nuevos.",
      ],
    },
    { type: "h2", content: "Campo: líneas de ayuda, cámara y piso" },
    {
      type: "p",
      content:
        "En Más → Campo eliges una plantilla de líneas (5 carriles, 3 tercios, half-spaces, juego de posición, cuadrículas, rondos…), la cámara (cancha completa, media cancha, 3/4 o área de arqueros), la orientación horizontal para exportar y el piso y los colores (césped a rayas o liso, sintética, madera, piso azul, pizarra blanca para imprimir). Se guarda con la jugada y sale igual en el PDF, la imagen y el video.",
    },
    { type: "h2", content: "Animación por cuadros" },
    {
      type: "ul",
      items: [
        "+ Cuadro copia el cuadro actual: mueve a los jugadores en el nuevo para marcar el siguiente momento. Hasta 30 cuadros por jugada.",
        "Cada cuadro tiene su Tiempo para llegar (de 0,5 a 5 segundos); puedes moverlo a izquierda o derecha o quitarlo.",
        "Reproduce con el botón de la izquierda; velocidad 0,5×, 1× o 2×, y Repetir.",
        "En Ajustes eliges la curva de velocidad, los rastros de cada jugador y del balón, y la posesión del balón por cuadro.",
      ],
    },
    { type: "h2", content: "Equipos y rivales guardados" },
    {
      type: "p",
      content:
        "En Equipos defines nombre, escudo (el tuyo puede usar el logo de la escuela), tres colores, estilo de ficha (disco con número, camiseta lisa, rayas o silueta), qué va dentro y debajo de la ficha, y un portero con otra apariencia. También el tamaño de los jugadores y del material. Con Guardar este rival el contrario queda en la escuela, y Equipos almacenados te deja reutilizarlo.",
    },
    {
      type: "callout",
      variant: "tip",
      content:
        "Lo exportado muestra número y posición, no nombres, porque son menores de edad. Si quieres nombres, actívalos en Equipos → «Mostrar nombres al exportar».",
    },
    { type: "h2", content: "Notas y videos" },
    {
      type: "ul",
      items: [
        "Notas: texto de hasta 2.000 caracteres con negrita y listas, y etiquetas de fase de juego y objetivo que luego te ayudan a encontrar la jugada. En jugadas animadas, cada cuadro tiene su nota corta.",
        "Videos: pega un enlace de YouTube o Vimeo y verás la vista previa en la pizarra. Los enlaces de cámaras deportivas (Veo, Hudl, Trace, Pixellot, Spiideo, XbotGo, Reeplayer), Google Drive y Dropbox aparecen como una tarjeta «Ver en …» que abre el video en otra pestaña.",
        "Hasta 10 videos por jugada, con título y minuto de inicio y fin opcionales. «Enlace privado» evita que salga en el PDF y en los paquetes; «Guardar también en Videos guardados» lo deja disponible para otras jugadas de la escuela.",
      ],
    },
    { type: "h2", content: "Biblioteca de ejercicios, paquetes y Mis jugadas" },
    {
      type: "table",
      headers: ["Quieres…", "Cómo"],
      rows: [
        ["Guardar una jugada para el equipo", "Más → Guardar en Mis jugadas… (por situación) y cárgala desde el mismo menú"],
        ["Guardarla como ejercicio de la escuela", "Más → Guardar en biblioteca…: nombre, objetivo, duración, edad, material y etiquetas. Se guarda con los puestos, sin nombres de jugadores"],
        ["Usar un ejercicio en la sesión", "Sesión → Editar → en el bloque, Desde la biblioteca → Plantillas SportMaps, De mi escuela o Paquetes → Usar en esta sesión"],
        ["Activar un paquete", "Pestaña Paquetes: Activar. La biblioteca mostrará solo esos más los de tu escuela. Exportar e Importar paquete pasan ejercicios entre escuelas"],
      ],
    },
    { type: "h2", content: "Exportar y compartir" },
    {
      type: "ul",
      items: [
        "Imagen (PNG): la cancha con la jugada y su título.",
        "Ficha del ejercicio (PDF): la cancha, la secuencia de cuadros, y las notas y videos públicos.",
        "Video de la jugada: necesita dos cuadros o más; sale como video o como GIF animado según tu navegador.",
        "Compartir por WhatsApp: en el celular abre la hoja de compartir con el archivo; en el computador descarga la imagen y ofrece abrir WhatsApp.",
      ],
    },
    { type: "h2", content: "Ver en 3D" },
    {
      type: "p",
      content:
        "Ver en 3D muestra la misma jugada con jugadores en volumen y la cancha de tu deporte. Se edita en 2D; el 3D es para mirarla y mostrarla.",
    },
    {
      type: "ul",
      items: [
        "Cámaras: Transmisión TV, Táctica alta, Cenital, Isométrica, Detrás del arco o aro, Arco o aro rival, Seguir balón, Seguir jugador, Spider-cam, Dron y Libre (la giras arrastrando).",
        "Cámara automática (director): elige sola la cámara según la jugada; «Al aire:» indica cuál está puesta.",
        "Controles: cuadro anterior y siguiente, Reproducir, velocidad 0,25×, 0,5×, 1× o 2×, Repetición en cámara lenta, Congelar, Rastro y Grabar video cuando el navegador lo permite.",
        "Volver a 2D (arriba a la derecha) cierra el visor y te devuelve al tablero 2D con tu jugada intacta.",
      ],
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "Si tu dispositivo no tiene los gráficos necesarios o va lento al abrir, la pizarra te avisa y te deja en el tablero 2D.",
    },
    { type: "h2", content: "Análisis de la jugada con IA" },
    {
      type: "p",
      content:
        "Analizar jugada lee la jugada que tienes en la cancha y te sugiere una lectura, riesgos, contraataques posibles del rival (que puedes ver animados encima de tu jugada, también en 3D) y variantes de tu jugada, con Guardar como nueva jugada. Son sugerencias: tú decides qué usar, y no se envían nombres ni fotos de tus deportistas.",
    },
    {
      type: "ul",
      items: [
        "Cada entrenador tiene un cupo de IA por mes, que se renueva el 1.º de cada mes. El panel te muestra cuánto te queda.",
        "Analizar otra vez una jugada que ya analizaste no gasta cupo.",
        "Cuando se acaba aparece «Usaste tu IA de este mes» y el botón Quiero más, que abre WhatsApp con el equipo comercial de SportMaps.",
        "Está disponible en los deportes de pizarra completa (fútbol 11, 7 y 5, fútbol sala, voleibol, baloncesto y balonmano).",
      ],
    },
    { type: "h2", content: "Ajustes y uso en el celular" },
    {
      type: "p",
      content:
        "Ajustes es tuyo: vale para todas tus jugadas en el dispositivo que usas (curva de velocidad, rastros, posesión del balón, nombre del jugador siempre visible, tema oscuro o claro y pantalla completa). En el celular la barra se simplifica: Más agrupa Notas, Videos, Equipos y Ajustes junto con Mis jugadas, biblioteca y las opciones de vista; Material es una pestaña de la hoja Dibujar y la × de arriba reemplaza a Cancelar.",
    },
    {
      type: "callout",
      variant: "tip",
      content:
        "Todo lo que armas se queda en pantalla hasta que pulsas Guardar jugada. Cancelar o cerrar sin guardar descarta los cambios.",
    },
  ],
};
