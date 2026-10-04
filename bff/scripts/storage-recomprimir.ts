/**
 * Recomprime imágenes que YA están en Supabase Storage (INF-13 F1).
 *
 * El plan Free tiene 1 GB de archivos y el 2026-10-04 estaba al ~105 % por
 * fotos de celular sin reducir. F0 (`7217f4cf`) comprime lo nuevo al subir;
 * esto baja lo que ya estaba.
 *
 *   npx tsx scripts/storage-recomprimir.ts --respaldo <carpeta>   # baja los originales
 *   npx tsx scripts/storage-recomprimir.ts --dry-run               # calcula, no toca nada
 *   npx tsx scripts/storage-recomprimir.ts --aplicar --respaldo <carpeta>
 *
 * Reglas (las mismas del compresor del frontend, lib/imageCompression.ts):
 *  - avatars: > 300 KB → WEBP 512 px (logos de escuela `schools/…` → 1.024 px).
 *  - identity-documents: > 1 MB → JPEG 2.200 px, calidad 82 (lo mira una persona).
 *  - payment-receipts NO se toca: el BFF lo relee con OCR y deduplica por hash.
 *  - PDF, SVG, GIF y lo que sharp no pueda abrir: se salta.
 *  - Se sobrescribe en la MISMA ruta (las referencias de la base no cambian);
 *    solo cambia el contentType. Si el resultado no pesa menos, se salta.
 *  - `--aplicar` exige `--respaldo` y verifica que el original esté en disco
 *    ANTES de sobrescribir cada archivo.
 *  - `.rotate()` aplica la orientación EXIF antes de quitar los metadatos;
 *    sin eso, una foto vertical de celular quedaría acostada.
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync, existsSync, appendFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { supabase } from '../src/config/supabase';

type Regla = {
    bucket: string;
    umbralBytes: number;
    destino: (path: string) => { formato: 'webp' | 'jpeg'; ladoMax: number; calidad: number };
};

const REGLAS: Regla[] = [
    {
        bucket: 'avatars',
        umbralBytes: 300_000,
        destino: (p) => p.startsWith('schools/')
            ? { formato: 'webp', ladoMax: 1024, calidad: 90 }
            : { formato: 'webp', ladoMax: 512, calidad: 82 },
    },
    {
        bucket: 'identity-documents',
        umbralBytes: 1_000_000,
        destino: () => ({ formato: 'jpeg', ladoMax: 2200, calidad: 82 }),
    },
];

const RASTER = /\.(jpe?g|png|webp|heic|heif)$/i;

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const SOLO_RESPALDO = args.includes('--respaldo') && !APLICAR && !args.includes('--dry-run');
const iResp = args.indexOf('--respaldo');
const CARPETA_RESPALDO = iResp >= 0 ? args[iResp + 1] : null;

if (APLICAR && !CARPETA_RESPALDO) {
    console.error('--aplicar exige --respaldo <carpeta> con los originales ya bajados.');
    process.exit(1);
}

interface Obj { bucket: string; name: string; size: number; mimetype: string | null }

/** Lista recursiva de un bucket (la API de Storage lista por carpeta). */
async function listar(bucket: string, prefijo = ''): Promise<Obj[]> {
    const out: Obj[] = [];
    let offset = 0;
    for (;;) {
        const { data, error } = await supabase.storage.from(bucket).list(prefijo, { limit: 1000, offset });
        if (error) throw new Error(`listar ${bucket}/${prefijo}: ${error.message}`);
        if (!data || data.length === 0) break;
        for (const it of data) {
            const ruta = prefijo ? `${prefijo}/${it.name}` : it.name;
            if (it.id === null) {
                out.push(...await listar(bucket, ruta)); // carpeta
            } else {
                out.push({
                    bucket, name: ruta,
                    size: Number((it.metadata as any)?.size ?? 0),
                    mimetype: (it.metadata as any)?.mimetype ?? null,
                });
            }
        }
        if (data.length < 1000) break;
        offset += 1000;
    }
    return out;
}

async function bajar(bucket: string, name: string): Promise<Buffer> {
    const { data, error } = await supabase.storage.from(bucket).download(name);
    if (error || !data) throw new Error(`bajar ${bucket}/${name}: ${error?.message}`);
    return Buffer.from(await data.arrayBuffer());
}

async function comprimir(buf: Buffer, d: ReturnType<Regla['destino']>): Promise<Buffer> {
    const base = sharp(buf, { failOn: 'none' })
        .rotate()
        .resize({ width: d.ladoMax, height: d.ladoMax, fit: 'inside', withoutEnlargement: true });
    return d.formato === 'webp'
        ? base.webp({ quality: d.calidad }).toBuffer()
        : base.flatten({ background: '#ffffff' }).jpeg({ quality: d.calidad, mozjpeg: true }).toBuffer();
}

const kb = (n: number) => `${Math.round(n / 1024).toLocaleString('es-CO')} KB`;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

async function main() {
    const modo = APLICAR ? 'APLICAR' : SOLO_RESPALDO ? 'RESPALDO' : 'DRY-RUN';
    console.log(`Modo: ${modo}${CARPETA_RESPALDO ? ` · respaldo en ${CARPETA_RESPALDO}` : ''}\n`);

    const log = CARPETA_RESPALDO ? join(CARPETA_RESPALDO, `log-${modo.toLowerCase()}.csv`) : null;
    if (log) {
        mkdirSync(CARPETA_RESPALDO!, { recursive: true });
        writeFileSync(log, 'bucket,ruta,antes_bytes,despues_bytes,resultado\n');
    }
    const anotar = (o: Obj, despues: number | '', res: string) => {
        if (log) appendFileSync(log, `${o.bucket},"${o.name}",${o.size},${despues},${res}\n`);
    };

    let total = 0, candidatos = 0, antes = 0, despues = 0, saltados = 0, fallidos = 0;

    for (const regla of REGLAS) {
        const objs = await listar(regla.bucket);
        const cand = objs.filter((o) => o.size > regla.umbralBytes && RASTER.test(o.name));
        total += objs.length;
        candidatos += cand.length;
        console.log(`${regla.bucket}: ${objs.length} archivos, ${cand.length} para recomprimir (${mb(cand.reduce((a, o) => a + o.size, 0))})`);

        for (const o of cand) {
            try {
                const orig = await bajar(o.bucket, o.name);

                if (CARPETA_RESPALDO) {
                    const destinoLocal = join(CARPETA_RESPALDO, o.bucket, o.name);
                    if (!existsSync(destinoLocal) || statSync(destinoLocal).size !== orig.length) {
                        mkdirSync(dirname(destinoLocal), { recursive: true });
                        writeFileSync(destinoLocal, orig);
                    }
                }
                if (SOLO_RESPALDO) { anotar(o, '', 'respaldado'); continue; }

                const d = regla.destino(o.name);
                const nuevo = await comprimir(orig, d);
                if (nuevo.length >= orig.length * 0.9) {
                    saltados++;
                    anotar(o, nuevo.length, 'saltado-no-ahorra');
                    continue;
                }

                if (APLICAR) {
                    // El original TIENE que estar en disco antes de sobrescribir.
                    const local = join(CARPETA_RESPALDO!, o.bucket, o.name);
                    if (!existsSync(local) || statSync(local).size !== orig.length) {
                        throw new Error('sin respaldo verificado en disco; no se sobrescribe');
                    }
                    const { error } = await supabase.storage.from(o.bucket).update(o.name, nuevo, {
                        contentType: d.formato === 'webp' ? 'image/webp' : 'image/jpeg',
                        cacheControl: '3600',
                        upsert: true,
                    });
                    if (error) throw new Error(`subir: ${error.message}`);
                }

                antes += orig.length;
                despues += nuevo.length;
                anotar(o, nuevo.length, APLICAR ? 'aplicado' : 'dry-run');
            } catch (err: any) {
                fallidos++;
                anotar(o, '', `error: ${String(err?.message ?? err).replace(/[,\n]/g, ' ')}`);
                console.warn(`  ✗ ${o.bucket}/${o.name}: ${err?.message ?? err}`);
            }
        }
    }

    console.log(`\nArchivos revisados: ${total} · candidatos: ${candidatos}`);
    if (SOLO_RESPALDO) {
        console.log(`Respaldo completo en ${CARPETA_RESPALDO} (fallidos: ${fallidos}).`);
        return;
    }
    console.log(`${APLICAR ? 'Recomprimidos' : 'Se recomprimirían'}: ${candidatos - saltados - fallidos} · saltados (no ahorran): ${saltados} · fallidos: ${fallidos}`);
    console.log(`Peso: ${mb(antes)} → ${mb(despues)} · ahorro ${mb(antes - despues)}`);
    if (log) console.log(`Detalle por archivo: ${log}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
