// Modo Recepción (F-R) — audio: tonos por WebAudio (sin archivos) + cola FIFO
// de voz (speechSynthesis). Maneja el gotcha de autoplay: nada suena hasta que
// arm() corre dentro de un gesto del usuario (tap en la pantalla de activación).

import type { SoundName } from './config';

let ctx: AudioContext | null = null;
let armed = false;

function getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
    }
    return ctx;
}

/** Debe llamarse DENTRO de un gesto del usuario. Desbloquea audio + voz. */
export async function armAudio(): Promise<void> {
    const c = getCtx();
    if (c && c.state === 'suspended') { try { await c.resume(); } catch { /* noop */ } }
    // "Calienta" speechSynthesis con un utterance vacío (algunos navegadores lo exigen).
    try {
        if ('speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance(' ');
            u.volume = 0;
            window.speechSynthesis.speak(u);
        }
    } catch { /* noop */ }
    armed = true;
}

export function isArmed(): boolean {
    return armed;
}

// ── Tonos ────────────────────────────────────────────────────────────────────
// Secuencias [frecuenciaHz, duraciónSeg] concatenadas.
const SEQUENCES: Record<Exclude<SoundName, 'none'>, [number, number][]> = {
    chime_up: [[660, 0.12], [880, 0.12], [1175, 0.18]],
    chime_short: [[880, 0.1], [1175, 0.12]],
    chime_double: [[988, 0.1], [0, 0.05], [988, 0.14]],
    fanfare: [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.22]],
    tone_neutral: [[520, 0.16]],
    tone_soft_low: [[300, 0.22]],
    tick: [[1200, 0.05]],
    attention: [[440, 0.15], [0, 0.06], [440, 0.15], [0, 0.06], [440, 0.2]],
    none: [],
};

/** Reproduce un tono corto. No-op si no está armado o sin WebAudio. */
export function playSound(name: SoundName, volume = 1): void {
    if (!armed || name === 'none') return;
    const c = getCtx();
    if (!c) return;
    const seq = SEQUENCES[name] || [];
    let t = c.currentTime;
    for (const [freq, dur] of seq) {
        if (freq > 0) {
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            // envolvente suave para evitar clicks
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.02, 0.22 * volume), t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc.connect(gain).connect(c.destination);
            osc.start(t);
            osc.stop(t + dur);
        }
        t += dur;
    }
}

// ── Cola FIFO de voz ──────────────────────────────────────────────────────────
interface VoiceItem { text: string; rate: number; volume: number; voiceURI: string | null }
const queue: VoiceItem[] = [];
let speaking = false;

let cachedVoices: SpeechSynthesisVoice[] = [];
export function listVoices(): SpeechSynthesisVoice[] {
    if (!('speechSynthesis' in window)) return [];
    const v = window.speechSynthesis.getVoices();
    if (v.length) cachedVoices = v;
    return cachedVoices;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    // getVoices() es asíncrono en Chrome: se pobla con 'voiceschanged'.
    window.speechSynthesis.onvoiceschanged = () => { cachedVoices = window.speechSynthesis.getVoices(); };
}

/** Elige una voz es-* (es-CO es raro; cae a es-MX/es-US/cualquier es). */
function pickVoice(uri: string | null): SpeechSynthesisVoice | undefined {
    const voices = listVoices();
    if (uri) {
        const exact = voices.find((v) => v.voiceURI === uri);
        if (exact) return exact;
    }
    return (
        voices.find((v) => /es[-_]CO/i.test(v.lang)) ||
        voices.find((v) => /es[-_]MX/i.test(v.lang)) ||
        voices.find((v) => /es[-_]US/i.test(v.lang)) ||
        voices.find((v) => /^es/i.test(v.lang))
    );
}

function drain() {
    if (speaking || queue.length === 0) return;
    if (!('speechSynthesis' in window)) { queue.length = 0; return; }
    const item = queue.shift()!;
    // Chrome corta utterances largos → recortar a ~200 chars.
    const u = new SpeechSynthesisUtterance(item.text.slice(0, 200));
    u.rate = item.rate;
    u.volume = item.volume;
    u.lang = 'es-CO';
    const v = pickVoice(item.voiceURI);
    if (v) u.voice = v;
    speaking = true;
    u.onend = () => { speaking = false; drain(); };
    u.onerror = () => { speaking = false; drain(); };
    try {
        window.speechSynthesis.speak(u);
    } catch {
        speaking = false;
        drain();
    }
}

/** Encola una frase (una a la vez, FIFO). No-op si no está armado. */
export function enqueueVoice(text: string, opts: { rate?: number; volume?: number; voiceURI?: string | null } = {}) {
    if (!armed || !text) return;
    queue.push({ text, rate: opts.rate ?? 0.95, volume: opts.volume ?? 1, voiceURI: opts.voiceURI ?? null });
    drain();
}

export function clearVoiceQueue() {
    queue.length = 0;
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    speaking = false;
}
