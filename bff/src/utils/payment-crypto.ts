/**
 * payment-crypto — cifrado AES-256-GCM para los secretos de pasarela de cada
 * escuela (access_token, refresh_token, private_key, integrity/events secret).
 *
 * Mismo formato que el cifrado de WhatsApp: `gcm:<iv_hex>:<tag_hex>:<ct_hex>`.
 * Clave dedicada `PAYMENT_TOKENS_ENC_KEY` (separada de WhatsApp para aislar el
 * radio de exposición). Los secretos se guardan cifrados en
 * `payment_provider_secrets` y solo se descifran en el BFF (service_role).
 */

import crypto from 'crypto';

/**
 * Deriva la clave de 32 bytes desde PAYMENT_TOKENS_ENC_KEY.
 * Acepta hex (64 chars) o base64 (32 bytes); si no, la deriva con SHA-256
 * (permite passphrase arbitraria en dev).
 */
function getEncKey(): Buffer {
    const raw = process.env.PAYMENT_TOKENS_ENC_KEY;
    if (!raw) {
        throw new Error('PAYMENT_TOKENS_ENC_KEY no configurado en el BFF.');
    }
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    try {
        const b = Buffer.from(raw, 'base64');
        if (b.length === 32) return b;
    } catch { /* sigue */ }
    return crypto.createHash('sha256').update(raw).digest();
}

/** Cifra un secreto. Salida: gcm:<iv_hex>:<tag_hex>:<ciphertext_hex>. */
export function encryptSecret(plaintext: string): string {
    const key = getEncKey();
    const iv = crypto.randomBytes(12); // 96-bit nonce recomendado para GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `gcm:${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;
}

/** Descifra un secreto producido por encryptSecret. */
export function decryptSecret(encrypted: string): string {
    const key = getEncKey();
    const parts = encrypted.split(':');
    if (parts.length !== 4 || parts[0] !== 'gcm') {
        throw new Error('Formato de secreto cifrado inválido.');
    }
    const [, ivHex, tagHex, ctHex] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const pt = Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]);
    return pt.toString('utf8');
}

/** Descifra si viene valor; null si viene null/undefined/vacío. Nunca lanza por null. */
export function decryptSecretOrNull(encrypted: string | null | undefined): string | null {
    if (!encrypted) return null;
    return decryptSecret(encrypted);
}
