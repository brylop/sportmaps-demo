// bff/src/routes/internal-autopay.routes.ts
//
// Endpoints INTERNOS del débito automático, los llama pg_cron vía pg_net
// (public.autopay_cron_tick, mig 20261007134859):
//   POST /internal/autopay/daily   12:00 UTC — planificar, avisar y debitar
//   POST /internal/autopay/sweep   cada 15 min — reconsultar PENDING y leases
//
// Sin JWT ni header CSRF (B2 del spec): se valida `x-autopay-secret` contra
// AUTOPAY_CRON_SECRET en tiempo constante. FAIL-CLOSED: sin secreto → 401.
//
// Gate de despliegue: con AUTOPAY_RUNNER_ENABLED !== 'true' responde 204 sin hacer
// nada. La base es una sola para todos los ambientes: SOLO el BFF que corre el
// motor lo tiene en 'true' (los otros podrían ser código sin probar cobrando).
//
// Responde 202 de inmediato y corre en segundo plano: pg_net corta a los 60 s y la
// diaria puede tardar más. Un candado en memoria evita solapar dos corridas del
// mismo tipo en este proceso; entre procesos lo garantiza el claim de la base.

import { Router, Request, Response } from 'express';
import express from 'express';
import crypto from 'crypto';
import { runDaily, runSweep, defaultDeps } from '../services/autopay.service';

const router = Router();
router.use(express.json());

function secretOk(req: Request): boolean {
    const secret = process.env.AUTOPAY_CRON_SECRET;
    if (!secret) return false;
    const a = Buffer.from(String(req.header('x-autopay-secret') || ''));
    const b = Buffer.from(secret);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const corriendo = { daily: false, sweep: false };

function lanzar(run: 'daily' | 'sweep', req: Request, res: Response) {
    if (!secretOk(req)) return res.status(401).json({ error: 'unauthorized' });
    if (process.env.AUTOPAY_RUNNER_ENABLED !== 'true') return res.status(204).end();
    if (corriendo[run]) return res.status(202).json({ ok: true, skipped: 'already_running' });

    corriendo[run] = true;
    const inicio = Date.now();
    const tarea = run === 'daily' ? runDaily(defaultDeps()) : runSweep(defaultDeps());
    tarea
        .then(resumen => req.log?.info?.({ run, ms: Date.now() - inicio, resumen }, 'autopay: corrida terminada'))
        .catch(err => req.log?.error?.({ run, err: err?.message }, 'autopay: corrida falló'))
        .finally(() => { corriendo[run] = false; });

    return res.status(202).json({ ok: true, started: run });
}

router.post('/daily', (req, res) => lanzar('daily', req, res));
router.post('/sweep', (req, res) => lanzar('sweep', req, res));

export default router;
