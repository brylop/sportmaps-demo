/**
 * Compresión de imágenes ANTES de subirlas a Supabase Storage (INF-13 F0).
 *
 * El plan Free tiene 1 GB de archivos y el 2026-10-04 estaba al ~105 %: no por
 * cantidad sino por peso — 224 avatares pesaban 1,1 MB en promedio y 153
 * documentos de identidad más de 1 MB cada uno (fotos de celular sin tocar).
 * Un avatar se muestra a 40–200 px; un documento o un comprobante se lee bien
 * a 1.600 px.
 *
 * Reglas:
 *  - Solo imágenes rasterizadas (JPEG, PNG, WEBP). PDF, SVG, GIF y cualquier
 *    otro tipo pasan tal cual.
 *  - Si el navegador no puede abrir la imagen (HEIC fuera de Safari, archivo
 *    dañado), se sube el original: comprimir nunca bloquea una subida.
 *  - Si el resultado no queda más liviano que el original, se sube el original.
 *  - Los COMPROBANTES DE PAGO NO se comprimen: el BFF los vuelve a leer desde
 *    Storage para la auto-aprobación y deduplica por el hash de la imagen.
 *    Medido el 2026-10-04 con una hoja real de Dynasty (1284×2778): el OCR leyó
 *    bien el documento 3/3 veces en el original y solo 1/3 reducida a 2.200 px
 *    (invertía o agregaba dígitos). Un dígito mal leído en un pago es plata.
 *  - Documentos de identidad, certificados y fotos los mira una persona, no un
 *    OCR: 2.200 px se leen sin problema y pesan ~10 veces menos.
 */

export type PerfilCompresion = 'avatar' | 'logo' | 'documento' | 'foto';

interface Perfil {
    ladoMax: number;
    tipo: 'image/webp' | 'image/jpeg';
    calidad: number;
    /** Por debajo de este peso y de ladoMax, no vale la pena recomprimir. */
    yaLivianoBytes: number;
}

const PERFILES: Record<PerfilCompresion, Perfil> = {
    // Se muestra en círculos de 40–200 px; 512 sobra incluso en pantallas retina.
    avatar:    { ladoMax: 512,  tipo: 'image/webp', calidad: 0.82, yaLivianoBytes: 80_000 },
    // Logos y marca de la escuela: WEBP conserva la transparencia del PNG.
    logo:      { ladoMax: 1024, tipo: 'image/webp', calidad: 0.9,  yaLivianoBytes: 150_000 },
    // Documentos de identidad y certificados: los lee una persona.
    documento: { ladoMax: 2200, tipo: 'image/jpeg', calidad: 0.82, yaLivianoBytes: 300_000 },
    // Fotos de producto, dotación, instalaciones.
    foto:      { ladoMax: 1600, tipo: 'image/jpeg', calidad: 0.82, yaLivianoBytes: 300_000 },
};

const COMPRIMIBLES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const EXTENSION: Record<Perfil['tipo'], string> = {
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
};

function cargarImagen(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('no se pudo abrir la imagen')); };
        img.src = url;
    });
}

function aBlob(canvas: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));
}

/**
 * Devuelve un File más liviano listo para subir, o el original si no aplica.
 * El nombre conserva la base y cambia la extensión al formato nuevo.
 */
export async function comprimirParaSubir(file: File, perfil: PerfilCompresion | null): Promise<File> {
    if (!perfil || typeof document === 'undefined' || !COMPRIMIBLES.has(file.type)) return file;

    const p = PERFILES[perfil];

    let img: HTMLImageElement;
    try {
        img = await cargarImagen(file);
    } catch {
        return file;
    }

    const ladoMayor = Math.max(img.naturalWidth, img.naturalHeight);
    if (!ladoMayor) return file;
    if (file.size <= p.yaLivianoBytes && ladoMayor <= p.ladoMax) return file;

    const escala = Math.min(1, p.ladoMax / ladoMayor);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // JPEG no tiene transparencia: sin fondo blanco, un PNG con alfa sale negro.
    if (p.tipo === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let blob = await aBlob(canvas, p.tipo, p.calidad);
    // Safari viejo no codifica WEBP y devuelve PNG (más pesado): caer a JPEG,
    // salvo para logos, donde perder la transparencia es peor que pesar más.
    if (blob && blob.type !== p.tipo && perfil !== 'logo') {
        blob = await aBlob(canvas, 'image/jpeg', p.calidad);
    }
    if (!blob || blob.size >= file.size) return file;

    const ext = EXTENSION[blob.type as Perfil['tipo']] ?? 'png';
    const base = file.name.replace(/\.[^.]+$/, '') || 'imagen';
    return new File([blob], `${base}.${ext}`, { type: blob.type, lastModified: Date.now() });
}

/**
 * Perfil por bucket de Supabase Storage. `null` = se sube tal cual.
 */
export function perfilPorBucket(bucket: string): PerfilCompresion | null {
    switch (bucket) {
        case 'payment-receipts':
            // Se releen con OCR en el servidor y se deduplican por hash (ver arriba).
            return null;
        case 'avatars':
            return 'avatar';
        case 'school-assets':
            return 'logo';
        case 'product-images':
        case 'equipment-photos':
        case 'facility-photos':
            return 'foto';
        default:
            // identity-documents, medical-documents, coach-certificates,
            // organizer-docs, vendor-docs, accounting-receipts…
            return 'documento';
    }
}
