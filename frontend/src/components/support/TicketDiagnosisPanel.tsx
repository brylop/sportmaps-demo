/**
 * TicketDiagnosisPanel — el panel de diagnóstico embebido que pide S2
 * (`docs/specs/soporte-in-app-chat-y-bot.md` §3): "el ticket que llega al
 * super_admin debe abrirse con el panel de diagnóstico embebido: el humano
 * ve el estado de la cuenta en la misma pantalla donde lee el reclamo".
 *
 * Versión compacta de `UserStateDialog` (F0) — mismo endpoint
 * (`GET /admin/support/user-state`), pero consultado por `userId` (que la
 * bandeja ya tiene desde `support_tickets.requester_id`, sin pedir el correo
 * a mano) y mostrado en línea, no en un modal aparte que tapa el hilo.
 */
import { useEffect, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert, ShieldX, Loader2 } from 'lucide-react';

interface UserState {
    access: {
        found: boolean;
        email: string | null;
        emailConfirmedAt: string | null;
        lastSignInAt: string | null;
        bannedUntil: string | null;
    };
    membership: {
        schoolMembers: Array<{ schoolName: string | null; role: string; status: string }>;
        enrollments: Array<{ schoolName: string | null; status: string }>;
    };
    verdict: {
        level: 'ok' | 'warn' | 'error';
        headline: string;
        findings: string[];
    };
}

const VERDICT_STYLE: Record<UserState['verdict']['level'], { box: string; Icon: typeof ShieldCheck }> = {
    ok: { box: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100', Icon: ShieldCheck },
    warn: { box: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100', Icon: ShieldAlert },
    error: { box: 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100', Icon: ShieldX },
};

export function TicketDiagnosisPanel({ userId }: { userId: string }) {
    const [state, setState] = useState<UserState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        setState(null);
        bffClient
            .get<UserState>(`/api/v1/admin/support/user-state?userId=${encodeURIComponent(userId)}`)
            .then((data) => { if (!cancelled) setState(data); })
            .catch((err: any) => { if (!cancelled) setError(err?.message || 'No se pudo obtener el diagnóstico.'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [userId]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Diagnosticando cuenta...
            </div>
        );
    }
    if (error || !state) {
        return (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error || 'Sin diagnóstico disponible.'}
            </div>
        );
    }

    const V = VERDICT_STYLE[state.verdict.level];
    const activeSchool = state.membership.schoolMembers.find((m) => m.status === 'active')
        ?? state.membership.enrollments.find((e) => e.status === 'active');

    return (
        <div className={`rounded-md border p-3 text-sm ${V.box}`}>
            <div className="flex items-center gap-2 font-semibold">
                <V.Icon className="h-4 w-4 shrink-0" />
                {state.verdict.headline}
            </div>
            <ul className="mt-1.5 space-y-0.5 pl-6 text-xs">
                {state.verdict.findings.map((f, i) => (
                    <li key={i} className="list-disc">{f}</li>
                ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                {!state.access.emailConfirmedAt && state.access.found && (
                    <Badge variant="outline" className="text-[10px]">correo sin confirmar</Badge>
                )}
                {state.access.bannedUntil && (
                    <Badge variant="destructive" className="text-[10px]">bloqueado</Badge>
                )}
                {'schoolName' in (activeSchool ?? {}) && activeSchool && (
                    <Badge variant="outline" className="text-[10px]">
                        {(activeSchool as any).schoolName ?? 'escuela activa'}
                    </Badge>
                )}
            </div>
        </div>
    );
}
