/**
 * cobro-enlace-publico.routes — /api/v1/public/cobro (SIN login).
 *
 *   GET  /:token        → datos mínimos del cobro para la página /p/:token
 *   POST /:token/pagar  → sesión de checkout Wompi del cobro del token
 *   GET  /:token/qr.png → PNG con el QR del enlace https://app.sportmaps.co/p/<token>
 *   GET  /:token/factura → ¿quiere factura electrónica? (resumen ENMASCARADO)
 *   PUT  /:token/factura → guarda la preferencia y los datos de factura
 *
 * Montado bajo /api/v1/public: requireOperationalSchool lo deja pasar (está en
 * su allowlist), por eso el chequeo de escuela operativa vive en el servicio.
 *
 * El token es la única credencial. Respuestas:
 *   404 'no_existe'  → token mal formado o inexistente (indistinguibles a propósito)
 *   410 'vencido' / 'revocado' → el enlace existió pero ya no abre
 * Rate limit propio, por IP y además por token en el POST: el token tiene 144
 * bits, así que el límite no es contra adivinarlo sino contra martillar la
 * creación de referencias de pago.
 */

import { Router, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import QRCode from 'qrcode';
import {
    resolverToken, vistaDelCobro, iniciarPagoEnLinea,
} from '../services/cobro-enlace-publico.service';
import { appPublica, enlaceDeCobro } from '../utils/url-publica-familias';
import {
    resumenPorToken, guardarPorToken, MENSAJE_ERROR, type DatosFactura,
} from '../services/factura-pagador.service';
import { TOKEN_COBRO_RE } from '../services/cobro-enlace-publico.service';

const router = Router();

// Varias familias comparten IP en el wifi de la escuela: 120 lecturas / 15 min.
const lecturaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `cobro-get-${ipKeyGenerator(req.ip ?? '')}`,
    message: { error: 'Demasiadas consultas. Intenta de nuevo en unos minutos.', code: 'rate_limited' },
});

// Iniciar el pago escribe en payment_links: 10 por token cada 10 min alcanza
// para reintentos honestos (cerrar el Widget y volver a abrirlo).
const pagoLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `cobro-pagar-${String(req.params?.token ?? '').slice(0, 32)}-${ipKeyGenerator(req.ip ?? '')}`,
    message: { error: 'Demasiados intentos de pago. Espera unos minutos.', code: 'rate_limited' },
});

// QR del correo de estado de cuenta. Lo pide el PROXY de imágenes de Gmail
// (pocas IPs de Google para miles de familias), así que el límite por IP es
// alto y el que importa es por token: un correo abierto varias veces no pasa de
// unas decenas de pedidos.
const qrIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1500,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `cobro-qr-ip-${ipKeyGenerator(req.ip ?? '')}`,
    message: { error: 'Demasiadas consultas.', code: 'rate_limited' },
});
const qrTokenLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `cobro-qr-tk-${String(req.params?.token ?? '').slice(0, 32)}`,
    message: { error: 'Demasiadas consultas.', code: 'rate_limited' },
});

// Guardar datos de factura: 10 por token cada 15 min (corregir un dígito un
// par de veces es honesto; más que eso es alguien probando).
const facturaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `cobro-factura-${String(req.params?.token ?? '').slice(0, 32)}-${ipKeyGenerator(req.ip ?? '')}`,
    message: { error: 'Demasiados intentos. Espera unos minutos.', code: 'rate_limited' },
});

function respuestaTokenInvalido(res: Response, motivo: 'no_existe' | 'vencido' | 'revocado') {
    if (motivo === 'no_existe') {
        return res.status(404).json({ code: 'no_existe', error: 'Este enlace de pago no es válido.' });
    }
    return res.status(410).json({
        code: motivo,
        error: motivo === 'vencido'
            ? 'Este enlace de pago venció. Pídele a la escuela uno nuevo o entra a la app.'
            : 'Este enlace de pago ya no está disponible.',
    });
}

router.get('/:token', lecturaLimiter, async (req: Request, res: Response) => {
    // Datos de un cobro: que no queden en cachés intermedias ni en el navegador.
    res.set('Cache-Control', 'no-store');
    try {
        const r = await resolverToken(String(req.params.token));
        if (!r.ok) return respuestaTokenInvalido(res, r.motivo);

        const vista = await vistaDelCobro(r);
        if (!vista) return respuestaTokenInvalido(res, 'no_existe');
        return res.json(vista);
    } catch (err: any) {
        (req as any).log?.error({ err: err?.message }, 'cobro-publico GET falló');
        return res.status(500).json({ error: 'No pudimos cargar el cobro. Intenta de nuevo.' });
    }
});

/**
 * El PNG codifica SOLO la URL pública del enlace (que ya está en la URL de la
 * petición): ni monto, ni nombres, ni nada del cobro. Aun así se resuelve el
 * token antes de dibujar, para no fabricar QRs de enlaces que no existen. La
 * base de la URL sale de appPublica() — nunca de FRONTEND_URL — y lanza si
 * alguien la configuró a localhost (2026-10-05: 304 correos con localhost).
 */
router.get('/:token/qr.png', qrIpLimiter, qrTokenLimiter, async (req: Request, res: Response) => {
    try {
        const token = String(req.params.token);
        const r = await resolverToken(token);
        if (!r.ok) {
            res.set('Cache-Control', 'no-store');
            return res.status(r.motivo === 'no_existe' ? 404 : 410).end();
        }
        const png = await QRCode.toBuffer(enlaceDeCobro(appPublica(), token), {
            type: 'png', width: 320, margin: 2, errorCorrectionLevel: 'M',
        });
        // Contenido inmutable para ese token: el proxy de Gmail lo puede guardar.
        res.set('Cache-Control', 'public, max-age=86400');
        res.type('png');
        return res.send(png);
    } catch (err: any) {
        (req as any).log?.error({ err: err?.message }, 'cobro-publico QR falló');
        res.set('Cache-Control', 'no-store');
        return res.status(500).end();
    }
});

router.post('/:token/pagar', pagoLimiter, async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
        // El cuerpo se ignora a propósito: el cobro sale SOLO del token.
        const r = await resolverToken(String(req.params.token));
        if (!r.ok) return respuestaTokenInvalido(res, r.motivo);

        const out = await iniciarPagoEnLinea(r);
        if (!out.ok) return res.status(out.status).json({ code: out.code, error: out.error });

        const { ok: _ok, ...checkout } = out;
        return res.status(checkout.reused ? 200 : 201).json(checkout);
    } catch (err: any) {
        (req as any).log?.error({ err: err?.message }, 'cobro-publico POST pagar falló');
        return res.status(500).json({ error: 'No pudimos iniciar el pago. Intenta de nuevo.' });
    }
});

/**
 * Factura electrónica del pagador de ESTE cobro. El token es la credencial y
 * se puede haber reenviado: el GET solo devuelve un resumen enmascarado (tipo
 * de documento, últimos 4 dígitos, correo con •••), nunca los datos completos.
 * El PUT escribe por la RPC que recibe el token (factura_pagador_guardar_por_token),
 * que resuelve el pagador sola: el cuerpo no puede elegir a quién se le guarda.
 */
router.get('/:token/factura', lecturaLimiter, async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
        const token = String(req.params.token);
        if (!TOKEN_COBRO_RE.test(token)) return respuestaTokenInvalido(res, 'no_existe');
        const r = await resumenPorToken(token);
        if (!r) return respuestaTokenInvalido(res, 'no_existe');
        return res.json(r);
    } catch (err: any) {
        (req as any).log?.error({ err: err?.message }, 'cobro-publico GET factura falló');
        return res.status(500).json({ error: 'No pudimos cargar tus datos de factura.' });
    }
});

router.put('/:token/factura', facturaLimiter, async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
        const token = String(req.params.token);
        if (!TOKEN_COBRO_RE.test(token)) return respuestaTokenInvalido(res, 'no_existe');
        const b = (req.body ?? {}) as Record<string, unknown>;
        const texto = (v: unknown) => (typeof v === 'string' ? v.slice(0, 300) : null);
        const datos: DatosFactura = {
            preferencia: texto(b.preferencia) as DatosFactura['preferencia'],
            tipoDocumento: texto(b.tipoDocumento),
            numeroDocumento: texto(b.numeroDocumento),
            nombre: texto(b.nombre),
            correo: texto(b.correo),
            direccion: texto(b.direccion),
            ciudadDane: texto(b.ciudadDane),
            departamento: texto(b.departamento),
        };
        const r = await guardarPorToken(token, datos);
        if (r.ok) return res.json({ ok: true });
        if (r.error === 'token_invalido') return respuestaTokenInvalido(res, 'no_existe');
        const status = r.error === 'no_disponible' ? 503 : r.error === 'sin_pagador' ? 409 : 400;
        return res.status(status).json({ code: r.error, error: MENSAJE_ERROR[r.error] ?? MENSAJE_ERROR.no_disponible });
    } catch (err: any) {
        (req as any).log?.error({ err: err?.message }, 'cobro-publico PUT factura falló');
        return res.status(500).json({ error: MENSAJE_ERROR.no_disponible });
    }
});

export default router;
