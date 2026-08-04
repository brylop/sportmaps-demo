/**
 * sha256File — SHA-256 (hex) del contenido de un File.
 *
 * Se calcula sobre el File ORIGINAL, antes de cualquier conversión (p.ej. el
 * PDF→PNG que hace useReceiptValidator para el OCR). Así el hash es determinista
 * entre dispositivos: el mismo comprobante subido dos veces produce el mismo hash,
 * independiente de cómo el canvas rasterice el PDF. Se usa para el dedup de
 * comprobantes re-subidos (payments.receipt_image_sha256).
 */
export async function sha256File(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
