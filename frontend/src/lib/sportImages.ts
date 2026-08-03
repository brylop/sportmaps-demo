/**
 * Imágenes de respaldo por deporte / tipo de instalación.
 *
 * Se usan cuando la escuela no cargó foto propia (equipos sin `image_url`,
 * instalaciones —que no tienen columna de imagen— y portadas sin
 * `cover_image_url`). Antes cada pantalla hardcodeaba su propia URL: la del
 * perfil público apuntaba a una foto de piscina que hoy responde **404**, así que
 * TODAS las instalaciones terminaban mostrando la imagen de fútbol.
 *
 * Todas las URLs de acá quedaron verificadas (HTTP 200) y revisadas a ojo para
 * que la foto corresponda al deporte. Si se agrega una, comprobar ambas cosas.
 */

const U = (id: string, w = 800) =>
    `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=${w}`;

/** Deporte (o palabra clave del nombre) → imagen. Las llaves van en minúscula sin tildes. */
const BY_SPORT: Record<string, string> = {
    golf: U('photo-1535131749006-b7f58c99034b'),
    tenis: U('photo-1622279457486-62dcc4a431d6'),
    padel: U('photo-1587280501635-68a0e82cd5ff'),
    futbol: U('photo-1575361204480-aadea25e6e68'),
    voleibol: U('photo-1612872087720-bb876e2e67d1'),
    baloncesto: U('photo-1546519638-68e109498ffc'),
    natacion: U('photo-1530549387789-4c1017266635'),
    piscina: U('photo-1530549387789-4c1017266635'),
    gimnasio: U('photo-1534438327276-14e5300c3a48'),
    gym: U('photo-1534438327276-14e5300c3a48'),
    crossfit: U('photo-1534438327276-14e5300c3a48'),
};

/** Genérica multideporte, para lo que no cae en ninguna categoría. */
export const GENERIC_SPORT_IMAGE = U('photo-1575361204480-aadea25e6e68');

/** Portada por defecto de un club/escuela (campo abierto, sirve de banner ancho). */
export const DEFAULT_BANNER = U('photo-1592919505780-303950717480', 2000);

const normalize = (s: string) =>
    (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, ''); // quita tildes: Natación -> natacion

/**
 * Devuelve la imagen que mejor corresponda. Acepta varios textos (deporte,
 * nombre del equipo, tipo de instalación) y usa el primero que haga match.
 */
export function sportImage(...hints: (string | null | undefined)[]): string {
    for (const hint of hints) {
        const h = normalize(hint || '');
        if (!h) continue;
        for (const [key, url] of Object.entries(BY_SPORT)) {
            if (h.includes(key)) return url;
        }
    }
    return GENERIC_SPORT_IMAGE;
}

/** Iniciales para el bloque de logo cuando la escuela no tiene imagen: "Club Campestre" → "CC". */
export function initialsOf(name: string): string {
    const words = (name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return (name || '?').substring(0, 2).toUpperCase();
}
