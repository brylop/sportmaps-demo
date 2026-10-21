/**
 * Miniaturas de productos de tienda (tienda v2 §3, versión sin tabla nueva).
 *
 * Por cada imagen del bucket público `product-images` se generan tres WebP al
 * lado del original: `<ruta>__w200.webp`, `__w600.webp` y `__w1200.webp`.
 * La vitrina pide la de 600 px en el grid y la de 1200 px en la ficha; si la
 * miniatura no existe (producto anterior a esto) el front cae al original.
 *
 * Protección de recursos en Render: `sharp.concurrency(1)`, límite de píxeles
 * de entrada y una cola en memoria de un solo trabajo a la vez.
 */

import sharp from 'sharp';
import { supabase } from '../config/supabase';

export const PRODUCT_IMAGES_BUCKET = 'product-images';
export const DERIVATIVE_WIDTHS = [200, 600, 1200] as const;
const QUALITY: Record<number, number> = { 200: 75, 600: 78, 1200: 80 };
const MAX_INPUT_PIXELS = 40e6;
const MAX_ORIGINAL_BYTES = 12 * 1024 * 1024;

sharp.concurrency(1);

const PUBLIC_MARKER = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;

/** Ruta dentro del bucket si la URL es de `product-images`; null si no. */
export function storagePathFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    const i = url.indexOf(PUBLIC_MARKER);
    if (i === -1) return null;
    const path = decodeURIComponent(url.slice(i + PUBLIC_MARKER.length).split('?')[0]);
    // No derivar de un derivado.
    return /__w\d+\.webp$/.test(path) ? null : path;
}

export function derivativePath(path: string, width: number): string {
    return `${path}__w${width}.webp`;
}

/** Genera (o regenera) los derivados de una imagen. Devuelve cuántos subió. */
export async function generateDerivatives(path: string): Promise<number> {
    const { data: blob, error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).download(path);
    if (error || !blob) throw new Error(`No se pudo leer ${path}: ${error?.message ?? 'vacío'}`);
    if (blob.size > MAX_ORIGINAL_BYTES) throw new Error(`Original demasiado grande (${blob.size} bytes)`);
    const input = Buffer.from(await blob.arrayBuffer());

    let uploaded = 0;
    for (const width of DERIVATIVE_WIDTHS) {
        // rotate() aplica la orientación EXIF; el WebP resultante no conserva metadatos (EXIF/GPS).
        const out = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
            .rotate()
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: QUALITY[width] })
            .toBuffer();
        const { error: upErr } = await supabase.storage
            .from(PRODUCT_IMAGES_BUCKET)
            .upload(derivativePath(path, width), out, {
                contentType: 'image/webp',
                upsert: true,
                cacheControl: '31536000',
            });
        if (upErr) throw new Error(`No se pudo subir ${width}px de ${path}: ${upErr.message}`);
        uploaded += 1;
    }
    return uploaded;
}

/** Cola de un solo trabajo: Render es chico y sharp consume RAM. */
let tail: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = tail.then(job, job);
    tail = run.catch(() => undefined);
    return run;
}

/** Todas las URLs de imagen de un producto (principal, galería y variantes). */
export async function productImagePaths(productId: string): Promise<string[]> {
    const { data } = await supabase
        .from('products')
        .select('image_url, product_images (image_url), product_variants (image_url)')
        .eq('id', productId)
        .maybeSingle();
    const row = data as any;
    if (!row) return [];
    const urls: Array<string | null> = [
        row.image_url,
        ...(row.product_images ?? []).map((i: any) => i.image_url),
        ...(row.product_variants ?? []).map((v: any) => v.image_url),
    ];
    return [...new Set(urls.map(storagePathFromUrl).filter((p): p is string => !!p))];
}

/**
 * Genera los derivados de un producto sin bloquear la respuesta HTTP.
 * Un fallo nunca rompe el guardado: el front usa el original como respaldo.
 */
export function scheduleProductDerivatives(productId: string): void {
    void enqueue(async () => {
        for (const path of await productImagePaths(productId)) {
            try {
                await generateDerivatives(path);
            } catch (err) {
                console.warn('[product-image-derivatives]', (err as Error).message);
            }
        }
    });
}
