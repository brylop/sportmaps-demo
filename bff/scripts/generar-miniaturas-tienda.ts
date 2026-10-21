/**
 * Genera las miniaturas (200/600/1200 px WebP) de los productos ya publicados.
 * Uso:  npx tsx scripts/generar-miniaturas-tienda.ts [school_id]
 * Sin argumento recorre todos los productos activos. Es idempotente (upsert).
 */
import 'dotenv/config';
import { supabase } from '../src/config/supabase';
import { generateDerivatives, productImagePaths } from '../src/services/product-image-derivatives';

async function main() {
    const schoolId = process.argv[2];
    let q = supabase.from('products').select('id').eq('status', 'active');
    if (schoolId) q = q.eq('school_id', schoolId);
    const { data, error } = await q;
    if (error) throw error;

    const paths = new Set<string>();
    for (const p of data ?? []) (await productImagePaths(p.id)).forEach((x) => paths.add(x));
    console.log(`${data?.length ?? 0} productos, ${paths.size} imágenes`);

    let ok = 0;
    let fail = 0;
    for (const path of paths) {
        try {
            await generateDerivatives(path);
            ok += 1;
        } catch (err) {
            fail += 1;
            console.warn(`✗ ${path}: ${(err as Error).message}`);
        }
    }
    console.log(`listo: ${ok} imágenes procesadas, ${fail} con error`);
}

main().catch((e) => { console.error(e); process.exit(1); });
