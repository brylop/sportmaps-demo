/**
 * Prepara la foto de una planilla para POST /attendance-sheet-intake/upload (≤ 4 MB decodificado).
 * Se intenta primero con la mejor resolución (el OCR lee mejor a resolución completa) y solo
 * se baja calidad y tamaño si hace falta. Un PDF se manda tal cual (y se rechaza si pesa de más).
 */

export const MAX_BYTES_PLANILLA = 4 * 1024 * 1024;
/** Margen para no rozar el tope del BFF. */
export const OBJETIVO_BYTES = Math.floor(3.8 * 1024 * 1024);

/** Bytes que tendrá el archivo decodificado de un data URL base64. */
export function bytesDeDataUrl(dataUrl: string): number {
    const coma = dataUrl.indexOf(',');
    const b64 = coma >= 0 ? dataUrl.slice(coma + 1) : dataUrl;
    const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
    return Math.floor((b64.length * 3) / 4) - pad;
}

/** Intentos de más a menos calidad: [lado máximo, calidad JPEG]. */
export const INTENTOS_COMPRESION: Array<[number, number]> = [
    [3200, 0.92], [3200, 0.8], [2800, 0.8], [2400, 0.75], [2000, 0.7], [1600, 0.65],
];

function leerComoDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
    });
}

export async function prepararPlanilla(file: File): Promise<{ imageBase64: string; mimeType: string }> {
    if (file.type === 'application/pdf') {
        if (file.size > OBJETIVO_BYTES) throw new Error('El PDF pesa más de 4 MB. Toma una foto de la hoja.');
        return { imageBase64: await leerComoDataUrl(file), mimeType: 'application/pdf' };
    }
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error('No se pudo abrir la imagen.'));
            i.src = url;
        });
        let ultimo = '';
        for (const [ladoMax, calidad] of INTENTOS_COMPRESION) {
            const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * escala);
            canvas.height = Math.round(img.height * escala);
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('No se pudo procesar la imagen.');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            ultimo = canvas.toDataURL('image/jpeg', calidad);
            if (bytesDeDataUrl(ultimo) <= OBJETIVO_BYTES) return { imageBase64: ultimo, mimeType: 'image/jpeg' };
        }
        throw new Error('La foto sigue pesando más de 4 MB. Tómala de nuevo un poco más lejos.');
    } finally {
        URL.revokeObjectURL(url);
    }
}
