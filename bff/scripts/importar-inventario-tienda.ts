/**
 * Importa el inventario inicial de una tienda escolar desde un JSON normalizado
 * (primer cliente: GYM RM, docs/gym-rm-inventario/productos.json).
 *
 *   # Simulación (por defecto): lee la base y dice qué haría. No escribe nada.
 *   npx tsx scripts/importar-inventario-tienda.ts
 *
 *   # Gemelo local (docs/qa-gemelo-local.md): escuela/vendor de prueba
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<llave local> \
 *     npx tsx scripts/importar-inventario-tienda.ts --escuela <uuid> --vendor <uuid> --aplicar
 *
 *   # Producción: la simulación solo lee; escribir exige --permitir-produccion
 *   npx tsx scripts/importar-inventario-tienda.ts --env .env                                  # simulación
 *   npx tsx scripts/importar-inventario-tienda.ts --env .env --permitir-produccion --aplicar   # con aprobación
 *
 * Qué hace, por producto del JSON (clave de idempotencia: attributes.import_slug
 * dentro del vendor_profile; además sku = <SLUG-TIENDA>-<slug>, único global):
 *   1. Sube la foto (si es vendible y tiene archivo) al bucket `product-images`
 *      — el mismo del wizard (ProductGalleryUploader) — en
 *      <vendor_profile_id>/inventario-<fecha>/<slug>.<ext> (upsert: re-correr
 *      no duplica archivos).
 *   2. Crea el producto en `draft` con stock 0. vendor_id y school_id los fija
 *      el trigger trg_products_fill_vendor desde el vendor_profile.
 *   3. Carga el stock con la RPC inventory_adjust ('manual_restock', nota =
 *      MOTIVO, actor = dueño de la escuela): queda en el kardex (inventory_logs).
 *      Si ya existe un movimiento con esa nota para el producto, no se repite.
 *   4. Publica (status 'active') los vendibles con foto SOLO si el vendor_profile
 *      está verificado: si no, trg_enforce_product_publish_gate los dejaría en
 *      'pending_review' (cola de revisión de plataforma). La tienda escolar se
 *      verifica sola al habilitarla (enable_school_store): re-correr el script
 *      después publica los que quedaron en borrador.
 *      Sin foto → quedan en 'draft'. Regalos → 'draft' + visibility 'private'
 *      (ni la vitrina — RLS exige status 'active' — ni create_cart_order — que
 *      rechaza status <> 'active' y visibility 'private' — los alcanzan).
 *   5. Proveedor (suppliers, owner_type 'school') y UNA factura por pagar
 *      (supplier_bills, status 'open') por el total de la deuda, con el detalle
 *      por producto en `notes`. Clave de idempotencia: invoice_no.
 *
 * Costo de compra: products NO tiene columna de costo y `attributes` es legible
 * por anon (grant por columna), así que el costo NO se guarda en el producto:
 * queda en el detalle de la factura del proveedor (privada, finance_permission)
 * y en el JSON/CSV del repo.
 *
 * Guardas:
 *   - Destino: localhost (gemelo) o la viva; escribir en la viva exige
 *     --permitir-produccion (la simulación contra la viva solo lee).
 *   - En la viva, escuela y vendor deben ser los del JSON (GYM RM) y el nombre
 *     de la escuela debe coincidir. En cualquier destino, el vendor_profile debe
 *     pertenecer a la escuela.
 *   - No lee bff/.env salvo que se pida con --env.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PROD_REF = 'luebjarufsiadojhvxgi';
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUCKET = 'product-images';
const IMPORT_TAG = 'inventario-gymrm-2026-10-08';

// ─── argumentos ──────────────────────────────────────────────────────────────
function arg(name: string): string | undefined {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const APLICAR = flag('aplicar');
const PERMITIR_PROD = flag('permitir-produccion');
const JSON_PATH = resolve(arg('json') ?? resolve(RAIZ, 'docs/gym-rm-inventario/productos.json'));
const IMG_DIR = resolve(arg('imagenes') ?? resolve(RAIZ, 'docs/gym-rm-inventario/imagenes'));
const ENV_FILE = arg('env');

if (ENV_FILE) {
    const r = dotenv.config({ path: resolve(ENV_FILE) });
    if (r.error) throw new Error(`No se pudo leer ${ENV_FILE}: ${r.error.message}`);
}

type Producto = {
    fila_excel: number; slug: string; nombre: string; nombre_original: string;
    categoria_tienda: string; subcategoria: string; subcategoria_original: string;
    atributos: Record<string, unknown>; descripcion: string;
    precio: number; costo_compra: number; stock: number;
    deuda_andres: number | null; deuda_esperada: number;
    vendible: boolean; imagen: string | null; tax_rate: number;
};
type Inventario = {
    fecha_inventario: string;
    escuela: { id: string; nombre: string; vendor_profile_id: string; slug: string; owner_id: string };
    proveedor: { nombre: string; nit: string | null; telefono: string | null; nota?: string };
    totales: Record<string, number>;
    productos: Producto[];
};

const inv: Inventario = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
const FECHA = inv.fecha_inventario;
const MOTIVO = `Stock inicial – inventario ${inv.escuela.nombre} ${FECHA}`;
const ESCUELA = arg('escuela') ?? inv.escuela.id;
const VENDOR = arg('vendor') ?? inv.escuela.vendor_profile_id;
const PROVEEDOR = arg('proveedor') ?? inv.proveedor.nombre;
const INVOICE_NO = arg('factura') ?? `INV-INICIAL-${FECHA}`;
const VENCE = arg('vencimiento') ?? addDays(FECHA, 30);

function addDays(iso: string, d: number): string {
    const t = new Date(`${iso}T12:00:00Z`);
    t.setUTCDate(t.getUTCDate() + d);
    return t.toISOString().slice(0, 10);
}
const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const log = (...a: unknown[]) => console.log(...a);
const plan = (msg: string) => log(`${APLICAR ? '  ✔' : '  ·'} ${msg}`);

// ─── guardas de destino ──────────────────────────────────────────────────────
const URL_ = process.env.SUPABASE_URL ?? '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!URL_ || !KEY) {
    console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (exportarlas, o --env <archivo>).');
    process.exit(2);
}
const esProd = URL_.includes(PROD_REF);
const esLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(URL_);
if (esProd && APLICAR && !PERMITIR_PROD) {
    // La simulación contra la viva solo lee; escribir exige el flag explícito.
    console.error(`ABORTA: ${URL_} es la base VIVA. Para escribir ahí hace falta --permitir-produccion (y la aprobación del usuario).`);
    process.exit(3);
}
if (!esProd && !esLocal) {
    console.error(`ABORTA: destino desconocido (${URL_}). Solo se admite el gemelo local o la viva con --permitir-produccion.`);
    process.exit(3);
}
if (esProd && (ESCUELA !== inv.escuela.id || VENDOR !== inv.escuela.vendor_profile_id)) {
    console.error(`ABORTA: en la viva solo se importa a ${inv.escuela.nombre} (${inv.escuela.id} / vendor ${inv.escuela.vendor_profile_id}).`);
    process.exit(3);
}

const sb: SupabaseClient = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function must<T>(r: { data: T | null; error: any }, ctx: string): T {
    if (r.error) throw new Error(`${ctx}: ${r.error.message ?? JSON.stringify(r.error)}`);
    return r.data as T;
}

async function main() {
    log(`\n=== Importar inventario de tienda — ${APLICAR ? 'APLICANDO' : 'SIMULACIÓN (sin --aplicar no se escribe nada)'} ===`);
    log(`Destino: ${esProd ? 'BASE VIVA' : 'gemelo local'} (${URL_})`);
    log(`JSON: ${JSON_PATH}`);

    // ── escuela / vendor / actor ──
    const school = must(await sb.from('schools').select('id, name, owner_id').eq('id', ESCUELA).maybeSingle(), 'schools') as any;
    if (!school) throw new Error(`ABORTA: no existe la escuela ${ESCUELA}.`);
    if (esProd && school.name.trim().toLowerCase() !== inv.escuela.nombre.trim().toLowerCase()) {
        throw new Error(`ABORTA: la escuela ${ESCUELA} se llama "${school.name}", no "${inv.escuela.nombre}".`);
    }
    const vp = must(await sb.from('vendor_profiles')
        .select('id, slug, school_id, user_id, vendor_type, verification_status, capabilities, is_active')
        .eq('id', VENDOR).maybeSingle(), 'vendor_profiles') as any;
    if (!vp) throw new Error(`ABORTA: no existe el vendor_profile ${VENDOR}.`);
    if (vp.school_id !== ESCUELA) throw new Error(`ABORTA: el vendor ${VENDOR} es de la escuela ${vp.school_id}, no de ${ESCUELA}.`);
    if (!vp.capabilities?.can_sell_products) throw new Error('ABORTA: el vendor_profile no tiene can_sell_products.');
    const actor: string = school.owner_id;
    if (!actor) throw new Error('ABORTA: la escuela no tiene owner_id (actor del kardex).');
    const verificado = vp.verification_status === 'verified';
    log(`Escuela: ${school.name} (${school.id}) · actor (owner): ${actor}`);
    log(`Tienda: ${vp.slug} (${vp.id}) · verificación: ${vp.verification_status}`);
    if (!verificado) {
        log('  ⚠ La tienda no está verificada: los vendibles con foto quedan en BORRADOR (publicar ahora los mandaría a pending_review).');
        log('    Re-correr el script después de habilitar la tienda (enable_school_store la verifica) los publica.');
    }

    // ── categorías ──
    const cats = must(await sb.from('product_categories').select('id, slug, name'), 'product_categories') as any[];
    const catId = new Map(cats.map((c) => [c.slug, c.id] as const));
    const faltan = [...new Set(inv.productos.map((p) => p.categoria_tienda))].filter((s) => !catId.has(s));
    if (faltan.length) throw new Error(`ABORTA: faltan categorías de tienda: ${faltan.join(', ')}`);

    // ── existentes (idempotencia) ──
    const existentes = must(await sb.from('products')
        .select('id, name, status, visibility, image_url, stock, sku, attributes')
        .eq('vendor_profile_id', VENDOR), 'products existentes') as any[];
    const porSlug = new Map<string, any>();
    for (const e of existentes) {
        const s = e.attributes?.import_slug;
        if (s) porSlug.set(s, e);
    }
    log(`Productos ya en la tienda: ${existentes.length} (${porSlug.size} de esta importación)\n`);

    const skuDe = (slug: string) => `${String(vp.slug).toUpperCase()}-${slug.toUpperCase()}`;
    const cont = { creados: 0, existentes: 0, stock: 0, publicados: 0, borrador: 0, regalos: 0, fotos: 0, errores: 0 };

    for (const p of inv.productos) {
        try {
            await importarProducto(p);
        } catch (e: any) {
            cont.errores++;
            console.error(`  ✘ ${p.slug}: ${e.message}`);
        }
    }

    async function subirFoto(p: Producto): Promise<string | null> {
        if (!p.vendible || !p.imagen) return null;
        const file = resolve(IMG_DIR, p.imagen);
        if (!existsSync(file)) {
            log(`  ⚠ ${p.slug}: el JSON nombra ${p.imagen} pero no está en ${IMG_DIR}; queda sin foto.`);
            return null;
        }
        const ext = extname(file).slice(1).toLowerCase();
        const path = `${VENDOR}/inventario-${FECHA}/${p.slug}.${ext}`;
        const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        if (!APLICAR) return url;
        const ct = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        const up = await sb.storage.from(BUCKET).upload(path, readFileSync(file), { upsert: true, contentType: ct });
        if (up.error) throw new Error(`subiendo foto: ${up.error.message}`);
        cont.fotos++;
        return url;
    }

    async function cargarStock(productId: string, p: Producto, stockActual: number) {
        if (p.stock <= 0) return;
        if (APLICAR) {
            const ya = must(await sb.from('inventory_logs').select('id', { count: 'exact', head: false })
                .eq('product_id', productId).eq('note', MOTIVO).limit(1), 'kardex') as any[];
            if (ya.length > 0) return;
            if (stockActual !== 0) {
                log(`  ⚠ ${p.slug}: stock actual ${stockActual} sin movimiento de stock inicial; no se toca (revisar a mano).`);
                return;
            }
            const r = await sb.rpc('inventory_adjust', {
                p_variant_id: null, p_product_id: productId, p_new_stock: p.stock,
                p_reason_code: 'manual_restock', p_note: MOTIVO, p_actor: actor,
            });
            if (r.error) throw new Error(`inventory_adjust: ${r.error.message}`);
        }
        cont.stock += p.stock;
        plan(`${p.slug}: stock inicial ${p.stock} por inventory_adjust (kardex)`);
    }

    async function importarProducto(p: Producto) {
        const prev = porSlug.get(p.slug);
        const conFoto = !!(p.vendible && p.imagen && existsSync(resolve(IMG_DIR, p.imagen)));
        const debePublicar = p.vendible && conFoto && verificado;

        if (prev) {
            cont.existentes++;
            log(`  = ${p.slug}: ya existe (${prev.status}); no se duplica`);
            // Completar foto si ahora la hay y el producto no la tenía.
            let imageUrl: string | null = prev.image_url;
            if (conFoto && !prev.image_url) {
                imageUrl = await subirFoto(p);
                if (APLICAR) {
                    must(await sb.from('products').update({
                        image_url: imageUrl,
                        attributes: { ...(prev.attributes ?? {}), images: imageUrl ? [imageUrl] : [] },
                    }).eq('id', prev.id).select('id'), 'actualizar foto');
                }
                plan(`${p.slug}: se le agrega la foto`);
            }
            if (APLICAR) await cargarStock(prev.id, p, prev.stock ?? 0);
            if (debePublicar && imageUrl && ['draft', 'pending_review'].includes(prev.status)) {
                if (APLICAR) {
                    const r = must(await sb.from('products').update({ status: 'active' }).eq('id', prev.id).select('status').single(), 'publicar') as any;
                    if (r.status !== 'active') log(`  ⚠ ${p.slug}: quedó en ${r.status}`);
                }
                cont.publicados++;
                plan(`${p.slug}: publicado (${prev.status} → active)`);
            } else if (p.vendible && prev.status !== 'active') {
                cont.borrador++;
            }
            if (!p.vendible) cont.regalos++;
            return;
        }

        const imageUrl = await subirFoto(p);
        const attributes: Record<string, unknown> = {
            ...p.atributos,
            images: imageUrl ? [imageUrl] : [],
            subcategoria: p.subcategoria,
            etiquetas: [p.subcategoria],
            nombre_original: p.nombre_original,
            import_slug: p.slug,
            import_lote: IMPORT_TAG,
            ...(p.vendible ? {} : { regalo: true }),
        };
        const row = {
            vendor_profile_id: VENDOR,          // vendor_id y school_id los fija el trigger
            name: p.nombre,
            description: p.descripcion,
            price: p.precio,
            stock: 0,                            // el stock entra por inventory_adjust
            category_id: catId.get(p.categoria_tienda),
            image_url: imageUrl,
            visibility: p.vendible ? 'public' : 'private',
            status: 'draft',
            sku: skuDe(p.slug),
            attributes,
            tax_rate: 0,                         // GYM RM no es responsable de IVA
        };
        let id = '(nuevo)';
        if (APLICAR) {
            const ins = must(await sb.from('products').insert(row).select('id, vendor_id, school_id').single(), 'insert producto') as any;
            id = ins.id;
            if (ins.school_id !== ESCUELA) throw new Error(`el trigger dejó school_id=${ins.school_id}`);
        }
        cont.creados++;
        plan(`${p.slug}: crear "${p.nombre}" ${cop(p.precio)} · ${p.categoria_tienda} · ${p.vendible ? 'público' : 'REGALO privado'}${imageUrl ? ' · con foto' : ' · SIN_FOTO'}`);

        await cargarStock(id, p, 0);

        if (!p.vendible) { cont.regalos++; return; }
        if (debePublicar) {
            if (APLICAR) {
                const r = must(await sb.from('products').update({ status: 'active' }).eq('id', id).select('status').single(), 'publicar') as any;
                if (r.status !== 'active') log(`  ⚠ ${p.slug}: quedó en ${r.status}`);
            }
            cont.publicados++;
            plan(`${p.slug}: publicar (draft → active)`);
        } else {
            cont.borrador++;
        }
    }

    // ── proveedor y factura por pagar ──
    log('\n— Contabilidad —');
    const totalDeuda = inv.productos.reduce((s, p) => s + (p.deuda_andres ?? 0), 0);
    let proveedorId: string | null = null;
    const provs = must(await sb.from('suppliers').select('id, name')
        .eq('owner_type', 'school').eq('owner_id', ESCUELA).ilike('name', PROVEEDOR), 'suppliers') as any[];
    if (provs.length > 0) {
        proveedorId = provs[0].id;
        log(`  = proveedor "${provs[0].name}" ya existe (${proveedorId})`);
    } else {
        if (APLICAR) {
            const r = must(await sb.from('suppliers').insert({
                owner_type: 'school', owner_id: ESCUELA, name: PROVEEDOR,
                nit: inv.proveedor.nit, phone: inv.proveedor.telefono,
                notes: inv.proveedor.nota ?? null,
            }).select('id').single(), 'crear proveedor') as any;
            proveedorId = r.id;
        }
        plan(`crear proveedor "${PROVEEDOR}" (NIT/teléfono vacíos, por confirmar)`);
    }

    const detalle = inv.productos
        .filter((p) => (p.deuda_andres ?? 0) > 0)
        .map((p) => {
            const ojo = p.deuda_andres !== p.deuda_esperada
                ? ` ⚠ planilla ≠ ${p.stock}×${cop(p.costo_compra)} = ${cop(p.deuda_esperada)}` : '';
            return `${p.nombre}: ${p.stock} × ${cop(p.costo_compra)} → ${cop(p.deuda_andres ?? 0)}${ojo}`;
        });
    const notes = [
        `Deuda con ${PROVEEDOR} por la mercancía del inventario inicial de la tienda (${FECHA}).`,
        `Total según planilla: ${cop(totalDeuda)}. Costo de compra por producto (unidades × costo unitario → deuda):`,
        ...detalle,
    ].join('\n');

    let factura: any = null;
    if (proveedorId) {
        const fs = must(await sb.from('supplier_bills').select('id, amount, status')
            .eq('owner_type', 'school').eq('owner_id', ESCUELA).eq('supplier_id', proveedorId)
            .eq('invoice_no', INVOICE_NO).neq('status', 'void'), 'supplier_bills') as any[];
        factura = fs[0] ?? null;
    }
    if (factura) {
        log(`  = factura ${INVOICE_NO} ya existe (${factura.id}, ${cop(factura.amount)}, ${factura.status})`);
    } else {
        if (APLICAR) {
            factura = must(await sb.from('supplier_bills').insert({
                owner_type: 'school', owner_id: ESCUELA, supplier_id: proveedorId,
                invoice_no: INVOICE_NO, amount: totalDeuda, issue_date: FECHA, due_date: VENCE,
                notes, created_by: actor,
            }).select('id, status').single(), 'crear factura') as any;
        }
        plan(`crear factura por pagar ${INVOICE_NO} por ${cop(totalDeuda)} (emisión ${FECHA}, vence ${VENCE}) con ${detalle.length} líneas de detalle`);
    }

    log('\n— Resumen —');
    log(`  productos nuevos: ${cont.creados} · ya existentes: ${cont.existentes} · regalos (privados/borrador): ${cont.regalos}`);
    log(`  vendibles a publicar: ${cont.publicados} · vendibles en borrador: ${cont.borrador}`);
    log(`  unidades cargadas por kardex en esta corrida: ${cont.stock} · fotos subidas: ${cont.fotos} · errores: ${cont.errores}`);
    if (!APLICAR) log('\n  (simulación: nada se escribió. Agregar --aplicar para ejecutar.)');
    if (cont.errores > 0) process.exitCode = 1;
}

main().catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
});
