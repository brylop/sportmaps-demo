// scripts/subir-logo-escuela.mjs
//
// Sube el logo de una escuela al bucket y deja `logo_url` apuntando ahí.
//
// Existe porque el logo normalmente lo carga la escuela desde Configuración →
// Marca, y a veces no se puede esperar a eso: el archivo llega por WhatsApp y
// hay que dejarlo andando. Esto hace exactamente lo mismo que haría esa
// pantalla, sin necesidad de la sesión del admin de la escuela.
//
// NO genera los iconos del PWA. Eso lo hace el BFF (pwaIcons.service) desde el
// botón "Generar íconos" de super admin, para que la lógica viva en un solo
// lugar y no se desincronice.
//
// Uso:
//   node scripts/subir-logo-escuela.mjs <slug-de-la-escuela> <ruta-del-archivo>
//
// Ejemplo:
//   node scripts/subir-logo-escuela.mjs club-deportivo-besser "C:/ruta/logo.jpg"

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { config } from 'dotenv';

config({ path: 'bff/.env' });

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en bff/.env');
    process.exit(1);
}

const [slug, ruta] = process.argv.slice(2);
if (!slug || !ruta) {
    console.error('Uso: node scripts/subir-logo-escuela.mjs <slug> <ruta-del-archivo>');
    process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const TIPOS = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
};

const { data: escuela, error: errEscuela } = await supabase
    .from('schools')
    .select('id, name, logo_url')
    .eq('slug', slug)
    .maybeSingle();

if (errEscuela || !escuela) {
    console.error(`No se encontró la escuela con slug "${slug}".`);
    process.exit(1);
}

const ext = extname(ruta).toLowerCase();
const contentType = TIPOS[ext];
if (!contentType) {
    console.error(`Extensión no soportada: ${ext}. Se aceptan JPG, PNG, WEBP o SVG.`);
    process.exit(1);
}

const bytes = await readFile(ruta);
if (bytes.byteLength > 2 * 1024 * 1024) {
    console.error(`El archivo pesa ${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB. El límite es 2 MB.`);
    process.exit(1);
}

// La ruta DEBE ser logos/<school_id>/… — el RPC update_school_branding valida
// ese prefijo, y sin él la URL se rechaza aunque el archivo exista.
const nombre = `${Date.now()}_${basename(ruta).replace(/[^a-zA-Z0-9._-]/g, '')}`;
const path = `logos/${escuela.id}/${nombre}`;

const { error: errSubida } = await supabase.storage
    .from('school-assets')
    .upload(path, bytes, { contentType, upsert: true });

if (errSubida) {
    console.error('Falló la subida al bucket:', errSubida.message);
    process.exit(1);
}

const { data: publica } = supabase.storage.from('school-assets').getPublicUrl(path);
const logoUrl = publica?.publicUrl;

if (!logoUrl) {
    console.error('El archivo se subió pero no se pudo resolver su URL pública.');
    process.exit(1);
}

// El archivo ya está en el bucket. NO se escribe `logo_url` desde acá: el
// trigger enforce_branding_via_rpc bloquea todo UPDATE de branding que no venga
// por RPC, y update_school_branding exige auth.uid(), que sin sesión es NULL.
//
// Ese último paso se hace con un UPDATE marcando la transacción con el mismo
// flag que usa el RPC:
//
//   select set_config('app.branding_via_rpc','true',true);
//   update public.schools set logo_url = '<url>' where id = '<school_id>';
//
// Se deja fuera del script a propósito: escribir branding saltando el trigger es
// justo lo que ese trigger existe para evitar, y no corresponde dejarlo
// automatizado en un script que cualquiera puede correr.
console.log(`✅ Subido — ${escuela.name}`);
console.log(`   school_id: ${escuela.id}`);
console.log(`   logo_url:  ${logoUrl}`);
console.log('\nFalta:');
console.log('   1. Guardar logo_url en schools (ver comentario al final del script).');
console.log('   2. Super admin → Suscripciones → la escuela → "Generar íconos".');
