import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, Wifi, WifiOff, Settings as SettingsIcon, X, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { supabase } from '@/integrations/supabase/client';
import {
    loadSettings, saveSettings, isQuietHours, resolvePresentation, formatCop, copSpoken,
    type ReceptionSettings, type ReceptionNotification, type Presentation, type Accent,
} from '@/features/recepcion/config';
import { armAudio, playSound, enqueueVoice, listVoices, isArmed, keepSpeechWarm } from '@/features/recepcion/audio';
import { fireConfetti } from '@/features/recepcion/confetti';
import { useReceptionFeed, type CatchupSummary } from '@/features/recepcion/useReceptionFeed';

interface ToastItem { id: string; pres: Presentation; ts: number }

const ACCENT_BAR: Record<Accent, string> = {
    green: 'bg-green-500', greenSoft: 'bg-green-400', amber: 'bg-amber-400',
    orange: 'bg-orange-400', red: 'bg-red-500', sky: 'bg-sky-400', neutral: 'bg-slate-400',
};
const MASCOT_EMOJI = { saludo: '👋', check: '✅', lupa: '🔍', celebra: '🎉' } as const;

const reducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const startOfTodayISO = () => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
};

export default function RecepcionPage() {
    const { user } = useAuth();
    const { schoolId, schoolName, schoolBranding } = useSchoolContext();

    // isArmed() persiste a nivel de módulo: al navegar dentro de la SPA y volver,
    // el audio sigue desbloqueado → no volvemos a mostrar la pantalla de activar.
    // (Una recarga completa del navegador sí exige el toque de nuevo: regla de autoplay.)
    const [armed, setArmed] = useState(() => isArmed());
    const [settings, setSettings] = useState<ReceptionSettings>(() => loadSettings());
    const [showSettings, setShowSettings] = useState(false);
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [displayRecaudo, setDisplayRecaudo] = useState(0);

    const targetRecaudo = useRef(0);
    const wakeLockRef = useRef<any>(null);
    const settingsRef = useRef(settings);
    settingsRef.current = settings;

    // Ráfaga → resumen: timestamps recientes + resumen pendiente de voz.
    const burstTimes = useRef<number[]>([]);
    const pendingSummary = useRef<{ count: number; recaudo: number }>({ count: 0, recaudo: 0 });
    const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Kiosko: bloquear scroll del documento + fondo oscuro (evita el espacio
    //    blanco y el "deslizamiento infinito" del navegador móvil / overscroll) ──
    useEffect(() => {
        const html = document.documentElement;
        const body = document.body;
        const prev = { htmlOv: html.style.overflow, bodyOv: body.style.overflow, bodyBg: body.style.backgroundColor };
        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        body.style.backgroundColor = '#020617'; // slate-950: sin flash blanco al hacer overscroll
        return () => {
            html.style.overflow = prev.htmlOv;
            body.style.overflow = prev.bodyOv;
            body.style.backgroundColor = prev.bodyBg;
        };
    }, []);

    // ── Contador de recaudo animado (tween por rAF) ──────────────────────────
    useEffect(() => {
        let raf = 0;
        const loop = () => {
            setDisplayRecaudo((cur) => {
                const t = targetRecaudo.current;
                if (Math.abs(t - cur) < 1) return t;
                return cur + (t - cur) * 0.12;
            });
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, []);

    // ── Wake lock (mantener pantalla encendida en kiosko) ────────────────────
    const requestWakeLock = useCallback(async () => {
        try {
            const anyNav = navigator as any;
            if (anyNav.wakeLock?.request) wakeLockRef.current = await anyNav.wakeLock.request('screen');
        } catch { /* no soportado */ }
    }, []);
    useEffect(() => {
        if (!armed) return;
        requestWakeLock();
        const onVis = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, [armed, requestWakeLock]);

    // ── Keep-warm de la voz (evita que el motor se "duerma") ─────────────────
    useEffect(() => {
        if (!armed) return;
        const id = setInterval(keepSpeechWarm, 8000);
        return () => clearInterval(id);
    }, [armed]);

    // ── Semilla del recaudo del día ───────────────────────────────────────────
    useEffect(() => {
        if (!schoolId || !armed) return;
        (async () => {
            const { data } = await supabase
                .from('payments')
                .select('amount_paid, gross_amount, amount')
                .eq('school_id', schoolId)
                .eq('status', 'paid')
                .gte('approved_at', startOfTodayISO());
            // Los pagos por pasarela guardan gross_amount con amount_paid en null;
            // los de comprobante guardan amount_paid. Coalesce para contarlos todos.
            if (data) {
                targetRecaudo.current = data.reduce(
                    (s, p: any) => s + (p.amount_paid ?? p.gross_amount ?? p.amount ?? 0), 0,
                );
            }
        })();
    }, [schoolId, armed]);

    const pushToast = useCallback((pres: Presentation) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setToasts((prev) => [{ id, pres, ts: Date.now() }, ...prev].slice(0, 8));
        if (!pres.persistent) {
            setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 7000);
        }
    }, []);

    // ── Flush del resumen de ráfaga (voz agregada tras 30s de calma) ──────────
    const scheduleSummaryFlush = useCallback(() => {
        if (flushTimer.current) clearTimeout(flushTimer.current);
        flushTimer.current = setTimeout(() => {
            const s = settingsRef.current;
            const p = pendingSummary.current;
            if (p.count > 0 && s.announcements_enabled && !isQuietHours(s) && s.modo_voz !== 'solo_chime') {
                const monto = p.recaudo > 0 ? `, ${copSpoken(p.recaudo)}` : '';
                enqueueVoice(`${p.count} movimientos en la última hora${monto}`, {
                    rate: s.rate, volume: s.volume, voiceURI: s.voice_uri,
                });
            }
            pendingSummary.current = { count: 0, recaudo: 0 };
            burstTimes.current = [];
        }, 30_000);
    }, []);

    // ── Evento en vivo ────────────────────────────────────────────────────────
    const handleEvent = useCallback((n: ReceptionNotification) => {
        const s = settingsRef.current;
        const pres = resolvePresentation(n);

        pushToast(pres);

        if (pres.recaudo && pres.recaudo > 0) targetRecaudo.current += pres.recaudo;

        if (!s.announcements_enabled) return;

        // Sonido + confetti + mascota (visual/no-voz)
        playSound(pres.sound, s.volume);
        if (pres.confetti && !reducedMotion()) fireConfetti();

        // Detección de ráfaga
        const now = Date.now();
        burstTimes.current = burstTimes.current.filter((t) => now - t < 10 * 60_000);
        burstTimes.current.push(now);
        const inBurst = burstTimes.current.length > s.debounce_rafaga;

        // Voz
        const voiceText = pres.buildVoice(s);
        const canVoice = voiceText && !isQuietHours(s);
        if (canVoice) {
            if (inBurst) {
                pendingSummary.current.count += 1;
                pendingSummary.current.recaudo += pres.recaudo || 0;
                scheduleSummaryFlush();
            } else {
                enqueueVoice(voiceText!, { rate: s.rate, volume: s.volume, voiceURI: s.voice_uri });
            }
        }
    }, [pushToast, scheduleSummaryFlush]);

    // ── Catch-up al reconectar ────────────────────────────────────────────────
    const handleCatchup = useCallback((sum: CatchupSummary) => {
        const parts = Object.entries(sum.byCategory)
            .map(([cat, n]) => `${n} ${cat}`)
            .join(', ');
        pushToast({
            accent: 'sky',
            title: '🔄 Mientras no había conexión',
            subtitle: parts + (sum.recaudo > 0 ? ` · ${formatCop(sum.recaudo)}` : ''),
            sound: 'tone_neutral', confetti: false, celebrate: false, mascot: null, persistent: false,
            buildVoice: () => null,
        });
        if (sum.recaudo > 0) targetRecaudo.current += sum.recaudo;
        const s = settingsRef.current;
        if (s.announcements_enabled && !isQuietHours(s) && s.modo_voz !== 'solo_chime') {
            enqueueVoice(`Mientras estabas sin conexión: ${sum.total} movimientos`, {
                rate: s.rate, volume: s.volume, voiceURI: s.voice_uri,
            });
        }
    }, [pushToast]);

    const { status } = useReceptionFeed({
        userId: user?.id, schoolId, enabled: armed, onEvent: handleEvent, onCatchup: handleCatchup,
    });

    const arm = useCallback(async () => {
        await armAudio();
        setArmed(true);
        playSound('chime_short', settingsRef.current.volume);
    }, []);

    const updateSettings = (patch: Partial<ReceptionSettings>) => {
        setSettings((prev) => { const next = { ...prev, ...patch }; saveSettings(next); return next; });
    };

    const primary = schoolBranding?.branding_settings?.primary_color || '#248223';

    // ── Pantalla de activación (gotcha autoplay) ──────────────────────────────
    if (!armed) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white p-8 text-center">
                <div className="text-7xl mb-6">🔊</div>
                <h1 className="text-3xl font-bold mb-2">Modo Recepción</h1>
                <p className="text-slate-400 mb-1">{schoolName}</p>
                <p className="text-slate-500 max-w-md mb-8">
                    Toca para activar el sonido y las notificaciones en vivo. Necesario una vez por sesión
                    (los navegadores bloquean el audio sin un toque).
                </p>
                <button
                    onClick={arm}
                    className="px-8 py-4 rounded-2xl text-lg font-semibold shadow-lg transition-transform active:scale-95"
                    style={{ backgroundColor: primary, color: '#fff' }}
                >
                    Activar recepción
                </button>
            </div>
        );
    }

    const statusUi =
        status === 'live' ? { c: 'text-green-400', icon: <Wifi className="h-4 w-4" />, t: 'En vivo' }
            : status === 'offline' ? { c: 'text-red-400', icon: <WifiOff className="h-4 w-4" />, t: 'Sin conexión' }
                : { c: 'text-amber-400', icon: <Wifi className="h-4 w-4 animate-pulse" />, t: 'Reconectando' };

    const visible = toasts.slice(0, 3);
    const overflow = toasts.length - visible.length;

    return (
        <div className="fixed inset-0 flex flex-col bg-slate-950 text-white overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between px-8 py-5 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    {schoolBranding?.logo_url
                        ? <img src={schoolBranding.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        : <div className="h-10 w-10 rounded-lg grid place-items-center" style={{ backgroundColor: primary }}><Bell className="h-5 w-5" /></div>}
                    <div>
                        <p className="font-semibold leading-tight">{schoolName}</p>
                        <p className="text-xs text-slate-500">Recepción</p>
                    </div>
                </div>
                <div className="flex items-center gap-5">
                    <div className="text-right">
                        <p className="text-xs uppercase tracking-wider text-slate-500">Recaudo de hoy</p>
                        <p className="text-2xl font-bold tabular-nums" style={{ color: primary }}>
                            {formatCop(Math.round(displayRecaudo))}
                        </p>
                    </div>
                    <div className={`flex items-center gap-1.5 text-sm ${statusUi.c}`} title={statusUi.t}>
                        {statusUi.icon}<span className="hidden sm:inline">{statusUi.t}</span>
                    </div>
                    <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Ajustes">
                        <SettingsIcon className="h-5 w-5 text-slate-400" />
                    </button>
                </div>
            </header>

            {/* Área de toasts */}
            <main className="flex-1 relative p-8">
                {toasts.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                        <Bell className="h-16 w-16 mb-4 opacity-30" />
                        <p className="text-lg">Esperando movimientos…</p>
                    </div>
                )}
                <div className="flex flex-col gap-4 max-w-2xl mx-auto">
                    {visible.map((t) => (
                        <div
                            key={t.id}
                            className={`relative flex items-start gap-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-5 ${reducedMotion() ? '' : 'animate-in slide-in-from-top-4 fade-in duration-300'
                                } ${t.pres.celebrate && !reducedMotion() ? 'ring-2 ring-offset-2 ring-offset-slate-950' : ''}`}
                            style={t.pres.celebrate ? { boxShadow: `0 0 0 2px ${primary}55` } : undefined}
                        >
                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${ACCENT_BAR[t.pres.accent]}`} />
                            {t.pres.mascot && (
                                <div className={`text-4xl ${reducedMotion() ? '' : 'animate-bounce'}`}>{MASCOT_EMOJI[t.pres.mascot]}</div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-lg font-semibold">{t.pres.title}</p>
                                <p className="text-slate-400 mt-0.5 break-words">{t.pres.subtitle}</p>
                            </div>
                            {t.pres.persistent && (
                                <button onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))} className="p-1 text-slate-500 hover:text-white">
                                    <X className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    ))}
                    {overflow > 0 && (
                        <div className="text-center text-slate-500 text-sm">+{overflow} más</div>
                    )}
                </div>
            </main>

            {showSettings && (
                <SettingsPanel
                    settings={settings}
                    onChange={updateSettings}
                    onClose={() => setShowSettings(false)}
                    onTest={() => handleEvent({
                        id: 'test', title: 'Pago de prueba', message: 'Prueba de recepción',
                        type: 'success', category: 'payment', link: null,
                        data: { payer_name: 'Ana Gómez', concept: 'Mensualidad', amount: 120000, school_id: schoolId },
                        created_at: new Date().toISOString(),
                    })}
                />
            )}
        </div>
    );
}

// ── Panel de ajustes ─────────────────────────────────────────────────────────
function SettingsPanel({ settings, onChange, onClose, onTest }: {
    settings: ReceptionSettings;
    onChange: (p: Partial<ReceptionSettings>) => void;
    onClose: () => void;
    onTest: () => void;
}) {
    const [voices, setVoices] = useState(() => listVoices());
    useEffect(() => {
        const id = setInterval(() => { const v = listVoices(); if (v.length) { setVoices(v); clearInterval(id); } }, 400);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-slate-900 text-white rounded-2xl w-full max-w-md p-6 space-y-5 border border-slate-700" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Ajustes de recepción</h2>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
                </div>

                <label className="flex items-center justify-between">
                    <span>Anuncios activos</span>
                    <input type="checkbox" checked={settings.announcements_enabled}
                        onChange={(e) => onChange({ announcements_enabled: e.target.checked })} className="h-5 w-5" />
                </label>

                <div>
                    <p className="text-sm text-slate-400 mb-1">Modo de voz</p>
                    <div className="flex gap-2">
                        {(['completo', 'discreto', 'solo_chime'] as const).map((m) => (
                            <button key={m} onClick={() => onChange({ modo_voz: m })}
                                className={`flex-1 py-2 rounded-lg text-sm ${settings.modo_voz === m ? 'bg-sky-600' : 'bg-slate-800'}`}>
                                {m === 'solo_chime' ? 'Solo tono' : m}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Discreto: sin montos ni apellidos en voz alta. Las glosas nunca se leen con nombre.</p>
                </div>

                <label className="flex items-center justify-between">
                    <span>Anunciar ingresos por nombre</span>
                    <input type="checkbox" checked={settings.modo_bienvenida_acceso}
                        onChange={(e) => onChange({ modo_bienvenida_acceso: e.target.checked })} className="h-5 w-5" />
                </label>

                <div>
                    <p className="text-sm text-slate-400 mb-1">Voz</p>
                    <select value={settings.voice_uri || ''} onChange={(e) => onChange({ voice_uri: e.target.value || null })}
                        className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm">
                        <option value="">Automática (es)</option>
                        {voices.filter((v) => /^es/i.test(v.lang)).map((v) => (
                            <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-slate-400 mb-1">Volumen</p>
                        <input type="range" min={0} max={1} step={0.1} value={settings.volume}
                            onChange={(e) => onChange({ volume: Number(e.target.value) })} className="w-full" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-400 mb-1">Velocidad voz</p>
                        <input type="range" min={0.6} max={1.4} step={0.05} value={settings.rate}
                            onChange={(e) => onChange({ rate: Number(e.target.value) })} className="w-full" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-slate-400 mb-1">Silencio desde</p>
                        <input type="time" value={settings.quiet_hours?.start || ''}
                            onChange={(e) => onChange({ quiet_hours: { start: e.target.value, end: settings.quiet_hours?.end || '07:00' } })}
                            className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-400 mb-1">hasta</p>
                        <input type="time" value={settings.quiet_hours?.end || ''}
                            onChange={(e) => onChange({ quiet_hours: { start: settings.quiet_hours?.start || '20:00', end: e.target.value } })}
                            className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm" />
                    </div>
                </div>

                <button onClick={onTest} className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center gap-2">
                    <Volume2 className="h-4 w-4" /> Probar anuncio
                </button>
            </div>
        </div>
    );
}
