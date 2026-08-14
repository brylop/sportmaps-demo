// bff/src/services/pwaIcons.service.ts
//
// Genera los iconos PNG 192/512 del manifest PWA a partir del logo que sube la
// escuela, y los persiste via RPC set_school_pwa_icons.
//
// ── Por que no se puede usar el logo tal cual ────────────────────────────────
// El uploader acepta JPG, PNG, SVG y WEBP en cualquier tamanio, pero para que
// Chrome considere la app instalable el manifest necesita PNG reales de 192 y
// 512 px. Ya nos paso: `favicon.png` y `sportmaps-logo.png` eran JPEG con
// extension .png, Chrome los rechazo como iconos invalidos y
// `beforeinstallprompt` dejo de dispararse — el banner de instalar desaparecio
// sin ningun error visible. Normalizar en el servidor evita repetirlo con los
// logos que suben las escuelas, sobre los que no tenemos ningun control.
//
// ── Por que se paddea al 60% ─────────────────────────────────────────────────
// Los iconos se declaran con purpose 'maskable', que deja al sistema operativo
// recortarlos con la forma que quiera (circulo, squircle, gota). La zona segura
// es un circulo de diametro 80% del lienzo: cualquier cosa fuera puede quedar
// cortada. Al 60% el logo entra entero en cualquier recorte. Se ve algo mas
// chico que un icono a sangre, pero nunca decapitado.

import sharp from 'sharp';
import { supabase } from '../config/supabase';

const BUCKET = 'school-assets';
const SIZES = [192, 512] as const;
const ESCALA_LOGO = 0.6;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export interface PwaIconsResult {
    ok: boolean;
    icon192?: string;
    icon512?: string;
    error?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const m = /^#([0-9A-Fa-f]{6})$/.exec(hex);
    if (!m) return { r: 255, g: 255, b: 255 };
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

async function descargarLogo(logoUrl: string): Promise<Buffer | null> {
    try {
        const res = await fetch(logoUrl);
        if (!res.ok) return null;

        // Guarda contra un logo enorme: sharp cargaria todo en memoria y el BFF
        // corre en un contenedor chico.
        const len = Number(res.headers.get('content-length') || 0);
        if (len > MAX_LOGO_BYTES) return null;

        const buf = Buffer.from(await res.arrayBuffer());
        return buf.byteLength > MAX_LOGO_BYTES ? null : buf;
    } catch {
        return null;
    }
}

/**
 * Genera un PNG cuadrado de `size` px: fondo solido + logo centrado al 60%.
 * El fondo solido es deliberado — un PNG transparente sobre el launcher de
 * Android puede quedar ilegible segun el fondo de pantalla del usuario.
 */
async function componerIcono(
    logo: Buffer,
    size: number,
    fondo: { r: number; g: number; b: number },
): Promise<Buffer> {
    const interior = Math.round(size * ESCALA_LOGO);

    // `density` sube la resolucion de rasterizado de los SVG; sin esto un SVG
    // chico sale pixelado al escalarlo a 512.
    const logoRedimensionado = await sharp(logo, { density: 384 })
        .resize(interior, interior, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

    return sharp({
        create: {
            width: size,
            height: size,
            channels: 4,
            background: { ...fondo, alpha: 1 },
        },
    })
        .composite([{ input: logoRedimensionado, gravity: 'centre' }])
        .png({ compressionLevel: 9 })
        .toBuffer();
}

/**
 * Genera y persiste los iconos. Nunca lanza: si algo falla se devuelve
 * { ok:false } y el manifest sigue sirviendo la marca SportMaps. Es preferible
 * un icono generico a una app que deja de ser instalable.
 */
export async function generarIconosPwa(opts: {
    schoolId: string;
    logoUrl: string;
    backgroundColor?: string | null;
    actorId: string;
}): Promise<PwaIconsResult> {
    const { schoolId, logoUrl, actorId } = opts;

    const logo = await descargarLogo(logoUrl);
    if (!logo) return { ok: false, error: 'logo_no_descargable' };

    const fondo = hexToRgb(opts.backgroundColor || '#FFFFFF');
    const urls: Record<number, string> = {};

    for (const size of SIZES) {
        let png: Buffer;
        try {
            png = await componerIcono(logo, size, fondo);
        } catch {
            // Formato que sharp no pudo decodificar (SVG roto, WEBP raro...).
            return { ok: false, error: 'logo_no_procesable' };
        }

        // Ruta fija por tamanio: al regenerar se pisa el anterior y no quedan
        // huerfanos acumulandose en el bucket.
        const path = `pwa-icons/${schoolId}/icon-${size}.png`;

        const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(path, png, { contentType: 'image/png', upsert: true });

        if (upErr) return { ok: false, error: `upload_fallido: ${upErr.message}` };

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        if (!data?.publicUrl) return { ok: false, error: 'sin_public_url' };

        // Cache-buster: el manifest guarda la URL y el navegador la cachea de
        // forma agresiva. Sin esto, cambiar el logo no cambia el icono.
        urls[size] = `${data.publicUrl}?v=${Date.now()}`;
    }

    const { data: rpc, error: rpcErr } = await supabase.rpc('set_school_pwa_icons', {
        p_school_id: schoolId,
        p_icon_192: urls[192],
        p_icon_512: urls[512],
        p_actor: actorId,
    });

    if (rpcErr) return { ok: false, error: `rpc_fallida: ${rpcErr.message}` };
    if (!(rpc as any)?.ok) return { ok: false, error: (rpc as any)?.error || 'rpc_rechazo' };

    return { ok: true, icon192: urls[192], icon512: urls[512] };
}
