/**
 * normalizeText — normaliza cadenas para búsqueda case- y accent-insensitive.
 *
 * Descompone (NFD) y elimina los diacríticos combinantes, luego minúsculas.
 * Así "Pérez" y "perez", "Núñez" y "nunez", coinciden. Fix auditoría F-07:
 * ~18.5% de los nombres tienen tilde/ñ y hoy no se encuentran al buscar sin acento.
 *
 * Uso: normalizeText(campo).includes(normalizeText(query))
 */
export function normalizeText(input: string | null | undefined): string {
    return (input ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}
