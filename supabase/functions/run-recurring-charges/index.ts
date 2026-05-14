// @ts-nocheck — Deno runtime: analyzed by Deno LSP, not Node.js tsc
//
// run-recurring-charges — disparada por pg_cron diariamente.
// Llama al endpoint del BFF POST /api/v1/recurring/run autenticando
// con header x-cron-secret. El BFF hace el trabajo real (cobros + log).
//
// Mantenemos la Edge Function delgada a proposito: la logica de cobro
// vive en el BFF para reutilizar mercadopago.service + wompi.service.
// La Edge Function solo es el puente con pg_cron.
//
// Env requeridos:
//   BFF_PUBLIC_URL          — base URL del BFF (ej: https://sportmaps-bff-dev.onrender.com)
//   RECURRING_CRON_SECRET   — debe coincidir con el del BFF

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
    try {
        const bffUrl = Deno.env.get('BFF_PUBLIC_URL');
        const cronSecret = Deno.env.get('RECURRING_CRON_SECRET');

        if (!bffUrl || !cronSecret) {
            return new Response(
                JSON.stringify({ error: 'BFF_PUBLIC_URL or RECURRING_CRON_SECRET not set' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } },
            );
        }

        // Limit configurable por body para permitir override desde pg_cron si hace falta
        let limit = 100;
        try {
            const body = await req.json();
            if (typeof body?.limit === 'number') limit = body.limit;
        } catch {
            // No body — usar default
        }

        const res = await fetch(`${bffUrl.replace(/\/$/, '')}/api/v1/recurring/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-cron-secret': cronSecret,
            },
            body: JSON.stringify({ limit }),
        });

        const json = await res.json().catch(() => ({}));

        return new Response(
            JSON.stringify({ ok: res.ok, status: res.status, result: json }),
            {
                status: res.ok ? 200 : 502,
                headers: { 'Content-Type': 'application/json' },
            },
        );
    } catch (error) {
        console.error('[run-recurring-charges] error:', error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
});
