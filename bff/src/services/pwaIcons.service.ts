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

type Rgb = { r: number; g: number; b: number };

/** Luminancia relativa (WCAG). Sirve para medir contraste de verdad, no "a ojo". */
function luminancia({ r, g, b }: Rgb): number {
    const canal = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(a: Rgb, b: Rgb): number {
    const la = luminancia(a);
    const lb = luminancia(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Elige el fondo del icono por CONTRASTE con el logo, no a ciegas.
 *
 * Antes se usaba siempre el color primario de la escuela, y eso se rompe en el
 * caso mas comun: el color primario suele salir DEL logo. El escudo rojo de una
 * escuela cuyo primario es rojo quedaba como una mancha roja sobre roja.
 *
 * Se prefiere el color de la escuela porque es su marca, pero solo si separa lo
 * suficiente del logo (3:1, el minimo de WCAG para elementos graficos). Si no,
 * se cae a blanco o negro, el que mas contraste de.
 */
function elegirFondo(dominante: Rgb, primario: Rgb): Rgb {
    const BLANCO: Rgb = { r: 255, g: 255, b: 255 };
    const NEGRO: Rgb = { r: 0, g: 0, b: 0 };

    if (contraste(dominante, primario) >= 3) return primario;

    return contraste(dominante, NEGRO) >= contraste(dominante, BLANCO) ? NEGRO : BLANCO;
}

/**
 * Devuelve el color de fondo PROPIO del logo, o null si es transparente o no
 * tiene un fondo uniforme.
 *
 * Se mira una esquina: si el logo trae fondo solido, ahi esta. Se descarta
 * cuando hay transparencia (alpha bajo) porque en ese caso el fondo lo tiene
 * que poner el icono.
 *
 * Sirve para que un JPG --que no admite transparencia y por eso SIEMPRE llega
 * con fondo-- produzca un icono que parece el logo extendido, en vez del logo
 * recortado y pegado sobre otro color.
 */
async function colorDeFondoDelLogo(logo: Buffer): Promise<Rgb | null> {
    try {
        const meta = await sharp(logo, { density: 384 }).metadata();
        const w = meta.width ?? 0;
        const h = meta.height ?? 0;
        if (w < 16 || h < 16) return null;

        const lado = Math.max(4, Math.floor(Math.min(w, h) * 0.03));
        const esquina = await sharp(logo, { density: 384 })
            .extract({ left: 0, top: 0, width: lado, height: lado })
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { data, info } = esquina;
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let i = 0; i < data.length; i += info.channels) {
            r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3];
            n++;
        }
        if (!n) return null;

        // Esquina transparente → el logo no trae fondo propio.
        if (a / n < 200) return null;

        return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
    } catch {
        return null;
    }
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
    let base = sharp(logo, { density: 384 });

    // Recortar el borde uniforme (transparente o de color solido) ANTES de
    // escalar. Los logos suelen venir con mucho aire alrededor: uno vertical con
    // media imagen vacia, escalado al 60% de un cuadrado de 192px, deja el
    // escudo diminuto y borroso. Con el recorte, lo que se escala es el dibujo y
    // no el margen, asi que el icono se lee.
    //
    // Si el trim falla o deja la imagen vacia (logo de un solo color, formato
    // raro), se sigue con el original: un icono con aire de mas es mucho mejor
    // que ninguno.
    try {
        const recortado = await base.clone().trim({ threshold: 10 }).toBuffer();
        const meta = await sharp(recortado).metadata();
        if ((meta.width ?? 0) > 8 && (meta.height ?? 0) > 8) {
            base = sharp(recortado, { density: 384 });
        }
    } catch {
        // Se conserva `base` sin recortar.
    }

    const logoRedimensionado = await base
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

    // ── Elegir el fondo del icono ────────────────────────────────────────────
    //
    // 1. Si el logo YA trae un fondo solido (tipico de los JPG, que no admiten
    //    transparencia), se usa ESE color. Asi el icono es el logo extendido
    //    hasta los bordes y no se nota el pegado. Sin esto, un logo sobre negro
    //    puesto sobre el rojo de la escuela queda como un rectangulo negro
    //    dentro de un cuadrado rojo — el caso real que motivo este cambio.
    //
    // 2. Si el logo es transparente (PNG/SVG), se elige por contraste contra su
    //    color dominante, prefiriendo el color de la escuela cuando separa.
    let fondo: Rgb;
    const propio = await colorDeFondoDelLogo(logo);

    if (propio) {
        fondo = propio;
    } else {
        let dominante: Rgb = { r: 128, g: 128, b: 128 };
        try {
            const stats = await sharp(logo, { density: 384 }).stats();
            if ((stats as any).dominant) dominante = (stats as any).dominant;
        } catch { /* gris medio: la eleccion cae en el color de la escuela */ }

        fondo = elegirFondo(dominante, hexToRgb(opts.backgroundColor || '#FFFFFF'));
    }
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

    const rgbAHex = ({ r, g, b }: Rgb) =>
        '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

    const { data: rpc, error: rpcErr } = await supabase.rpc('set_school_pwa_icons', {
        p_school_id: schoolId,
        p_icon_192: urls[192],
        p_icon_512: urls[512],
        p_actor: actorId,
        // Se guarda el fondo que se USO, no el color de la escuela: el manifest
        // lo lee para background_color. Sin esto el splash queda de un color y
        // el icono de otro — con Besser daba pantalla roja y cuadrado negro.
        p_bg: rgbAHex(fondo),
    });

    if (rpcErr) return { ok: false, error: `rpc_fallida: ${rpcErr.message}` };
    if (!(rpc as any)?.ok) return { ok: false, error: (rpc as any)?.error || 'rpc_rechazo' };

    return { ok: true, icon192: urls[192], icon512: urls[512] };
}
