/**
 * cobro-enlace-publico.routes — /api/v1/public/cobro (SIN login).
 *
 *   GET  /:token        → datos mínimos del cobro para la página /p/:token
 *   POST /:token/pagar  → sesión de checkout Wompi del cobro del token
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
import {
    resolverToken, vistaDelCobro, iniciarPagoEnLinea,
} from '../services/cobro-enlace-publico.service';

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

export default router;
