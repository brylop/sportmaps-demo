/**
 * Carga (o rota) el access token de Meta de una integración de WhatsApp.
 *
 * El token NUNCA se pasa por argumento ni por el chat: se lee de un archivo,
 * se valida contra Graph API, se cifra con WHATSAPP_TOKEN_ENC_KEY y se escribe
 * en school_whatsapp_integrations. El archivo se sobrescribe y se borra al final.
 *
 * Uso:
 *   cd bff
 *   npx ts-node scripts/wa-set-token.ts <ruta-al-archivo-con-el-token> [phone_number_id]
 *
 * Honra la decisión #9 del bloque (rotación de tokens cada 60d).
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

import { encryptToken, decryptToken } from '../src/services/whatsapp.service';
import { supabase } from '../src/config/supabase';

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';
const APP_ID = process.env.META_APP_ID || '974986648677018';
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';

const tokenFile = process.argv[2];
const phoneNumberId = process.argv[3] || '1139733152565511';

function mask(t: string): string {
    if (t.length < 16) return '(sospechosamente corto)';
    return `${t.slice(0, 6)}…${t.slice(-4)} (${t.length} chars)`;
}

async function main() {
    if (!tokenFile) {
        console.error('Falta la ruta del archivo con el token.');
        process.exit(1);
    }
    const abs = path.resolve(tokenFile);
    if (!fs.existsSync(abs)) {
        console.error(`No existe el archivo: ${abs}`);
        process.exit(1);
    }

    const token = fs.readFileSync(abs, 'utf8').trim();
    if (!token) {
        console.error('El archivo está vacío.');
        process.exit(1);
    }
    console.log(`Token leído: ${mask(token)}`);

    // ── 1. ¿El token sirve para ESTE número? ────────────────────────────────
    const numRes = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const numJson: any = await numRes.json();
    if (!numRes.ok) {
        console.error(`✗ Graph rechazó el token para ${phoneNumberId}: ${numJson?.error?.message}`);
        console.error('  NO se escribió nada en la base. El archivo queda intacto para reintentar.');
        process.exit(1);
    }
    console.log(`✓ Token válido para ${numJson.display_phone_number} (${numJson.verified_name || 's/n'})`);

    // ── 2. ¿Es permanente? ──────────────────────────────────────────────────
    if (APP_SECRET) {
        const dbgRes = await fetch(
            `https://graph.facebook.com/${GRAPH_VERSION}/debug_token?input_token=${token}&access_token=${APP_ID}|${APP_SECRET}`
        );
        const dbg: any = await dbgRes.json();
        const d = dbg?.data;
        if (d) {
            const expires = d.expires_at;
            const scopes = (d.scopes || []).join(', ');
            if (expires === 0 || expires === undefined) {
                console.log('✓ Sin fecha de expiración (System User).');
            } else {
                console.warn(`⚠ EXPIRA el ${new Date(expires * 1000).toISOString()} — no es un token permanente.`);
            }
            console.log(`  Tipo: ${d.type} · permisos: ${scopes || '(no reportados)'}`);
            for (const req of ['whatsapp_business_management', 'whatsapp_business_messaging']) {
                if (scopes && !scopes.includes(req)) console.warn(`⚠ Falta el permiso ${req}`);
            }
        }
    } else {
        console.warn('⚠ Sin WHATSAPP_APP_SECRET no se pudo verificar la expiración.');
    }

    // ── 3. Cifrar y guardar ─────────────────────────────────────────────────
    const encrypted = encryptToken(token);
    if (decryptToken(encrypted) !== token) {
        console.error('✗ El round-trip de cifrado no coincide. Abortado.');
        process.exit(1);
    }

    const { data, error } = await supabase
        .from('school_whatsapp_integrations')
        .update({ access_token_encrypted: encrypted, updated_at: new Date().toISOString() })
        .eq('phone_number_id', phoneNumberId)
        .select('id, school_id, display_phone_number, status, updated_at');

    if (error) {
        console.error(`✗ Error al actualizar: ${error.message}`);
        process.exit(1);
    }
    if (!data || data.length === 0) {
        console.error(`✗ No hay integración con phone_number_id=${phoneNumberId}.`);
        process.exit(1);
    }
    console.log(`✓ Integración ${data[0].id} actualizada (${data[0].display_phone_number}, status=${data[0].status}).`);

    // ── 4. Borrar el archivo ────────────────────────────────────────────────
    try {
        fs.writeFileSync(abs, '0'.repeat(token.length));
        fs.unlinkSync(abs);
        console.log('✓ Archivo del token sobrescrito y borrado.');
    } catch (e: any) {
        console.warn(`⚠ No se pudo borrar ${abs}: ${e.message} — bórralo a mano.`);
    }

    console.log('\nReinicia el BFF para invalidar la cache LRU de tenants.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
