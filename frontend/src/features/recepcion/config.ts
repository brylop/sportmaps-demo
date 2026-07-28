// Modo Recepción (F-R) — configuración de presentación por categoría + ajustes
// por dispositivo (kiosko) + plantillas de voz con reglas de privacidad.
//
// Privacidad (coherente con "no exponer a los padres"):
//   - modo_voz 'discreto' (default): en VOZ nunca montos ni apellidos; solo
//     nombre de pila. La glosa JAMÁS se vocaliza con nombre.
//   - El toast VISUAL (pantalla del staff) sí puede mostrar el detalle completo.

export type ModoVoz = 'completo' | 'discreto' | 'solo_chime';

export interface ReceptionSettings {
    announcements_enabled: boolean;
    modo_voz: ModoVoz;
    quiet_hours: { start: string; end: string } | null; // "20:00".."07:00"
    debounce_rafaga: number; // > N anuncios en 10 min → modo resumen
    voice_uri: string | null; // voz de speechSynthesis elegida
    volume: number; // 0..1
    rate: number; // 0.1..2
    modo_bienvenida_acceso: boolean; // anunciar ingresos por nombre
}

export const DEFAULT_SETTINGS: ReceptionSettings = {
    announcements_enabled: true,
    modo_voz: 'discreto',
    quiet_hours: { start: '20:00', end: '07:00' },
    debounce_rafaga: 5,
    voice_uri: null,
    volume: 1,
    rate: 0.95,
    modo_bienvenida_acceso: false,
};

const LS_KEY = 'sportmaps_recepcion_settings';

export function loadSettings(): ReceptionSettings {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function saveSettings(s: ReceptionSettings) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(s));
    } catch { /* ignore */ }
}

/** ¿Estamos dentro del rango de silencio? (soporta rango que cruza medianoche) */
export function isQuietHours(s: ReceptionSettings, now = new Date()): boolean {
    if (!s.quiet_hours) return false;
    const [sh, sm] = s.quiet_hours.start.split(':').map(Number);
    const [eh, em] = s.quiet_hours.end.split(':').map(Number);
    const cur = now.getHours() * 60 + now.getMinutes();
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
}

// ── Notificación entrante ────────────────────────────────────────────────────
export interface ReceptionNotification {
    id: string;
    title: string;
    message: string;
    type: string | null;
    category: string | null;
    link: string | null;
    data: Record<string, any> | null;
    created_at: string;
}

export type Accent = 'green' | 'greenSoft' | 'amber' | 'orange' | 'red' | 'sky' | 'neutral';
export type SoundName =
    | 'chime_up' | 'chime_short' | 'chime_double' | 'fanfare'
    | 'tone_neutral' | 'tone_soft_low' | 'tick' | 'attention' | 'none';

export interface Presentation {
    accent: Accent;
    title: string;
    subtitle: string;
    sound: SoundName;
    confetti: boolean;   // ráfaga de confetti
    celebrate: boolean;  // animación grande (mascota/entrada destacada)
    mascot: 'saludo' | 'check' | 'lupa' | 'celebra' | null;
    persistent: boolean; // no auto-descarta (system crítico)
    recaudo?: number;    // suma para el contador de recaudo del día
    /** Construye la frase a vocalizar según ajustes; null = sin voz. */
    buildVoice: (s: ReceptionSettings) => string | null;
}

// Formato peso colombiano DETERMINISTA: "$120.000" (punto de miles, sin decimales).
// No usamos Intl+COP porque en algunos navegadores/dispositivos cae a formato
// tipo USD ("$120,000.00") según los datos de locale disponibles → parecía dólares.
const cop = (n: number) =>
    '$' + Math.round(Math.abs(n || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const firstName = (full?: string | null) => (full || '').trim().split(/\s+/)[0] || '';

/** Resuelve la presentación (visual + sonido + voz) desde `category`+`type`+`data`. */
export function resolvePresentation(n: ReceptionNotification): Presentation {
    const d = n.data || {};
    const cat = n.category || 'system';
    const type = n.type || 'info';
    const payer = d.payer_name as string | undefined;
    const athlete = d.athlete_name as string | undefined;
    const concept = (d.concept as string | undefined) || n.title;
    const amount = typeof d.amount === 'number' ? d.amount : undefined;
    const amountTxt = amount != null ? cop(amount) : '';
    // Para VOZ usamos "120000 pesos" (el TTS lee "$" como "dólares").
    const amountSpoken = amount != null ? copSpoken(amount) : '';

    switch (cat) {
        case 'payment': {
            // success = pago aprobado (celebrar). warning/info = recordatorio (sobrio).
            if (type === 'success') {
                return {
                    accent: 'green',
                    title: '💚 Pago recibido',
                    subtitle: [payer, concept, amountTxt].filter(Boolean).join(' · '),
                    sound: 'chime_up',
                    confetti: true,
                    celebrate: true,
                    mascot: 'celebra',
                    persistent: false,
                    recaudo: amount,
                    buildVoice: (s) =>
                        s.modo_voz === 'solo_chime' ? null
                            : s.modo_voz === 'discreto'
                                ? `Pago recibido de ${firstName(payer) || 'un acudiente'}`
                                : `Pago recibido: ${payer || 'acudiente'}, ${amountSpoken}, ${concept}`,
                };
            }
            return {
                accent: 'orange',
                title: 'Recordatorio de pago',
                subtitle: [payer, concept].filter(Boolean).join(' · ') || n.message,
                sound: 'tone_neutral',
                confetti: false, celebrate: false, mascot: null, persistent: false,
                buildVoice: () => null, // info del admin, no evento de piso
            };
        }
        case 'installment':
            return {
                accent: 'greenSoft',
                title: 'Abono recibido',
                subtitle: [payer, amountTxt].filter(Boolean).join(' · ') || n.message,
                sound: 'chime_short',
                confetti: false, celebrate: false, mascot: null, persistent: false,
                recaudo: amount,
                buildVoice: (s) =>
                    s.modo_voz === 'solo_chime' ? null
                        : s.modo_voz === 'discreto'
                            ? `Abono recibido de ${firstName(payer) || 'un acudiente'}`
                            : `Abono recibido de ${payer || 'acudiente'}: ${amountSpoken}`,
            };
        case 'glosa': {
            const resolved = /aprob|resolv|acept|ratific/i.test(`${n.title} ${n.message}`);
            return {
                accent: resolved ? 'greenSoft' : 'amber',
                title: resolved ? 'Revisión resuelta' : '🔍 Pago en revisión',
                subtitle: n.title,
                sound: resolved ? 'chime_double' : 'tone_soft_low',
                confetti: false, celebrate: false,
                mascot: resolved ? 'check' : 'lupa',
                persistent: false,
                // Glosa NUNCA con nombre en voz (privacidad), aun en modo completo.
                buildVoice: (s) =>
                    s.modo_voz === 'solo_chime' ? null
                        : resolved ? 'Se resolvió una revisión de pago' : 'Hay un pago en revisión',
            };
        }
        case 'enrollment':
            return {
                accent: 'sky',
                title: '🎉 Nueva matrícula',
                subtitle: athlete || n.message,
                sound: 'fanfare',
                confetti: true, celebrate: true, mascot: 'saludo', persistent: false,
                buildVoice: (s) =>
                    s.modo_voz === 'solo_chime' ? null
                        : `¡Bienvenido ${firstName(athlete) || ''} a la academia!`.replace('  ', ' '),
            };
        case 'access':
            return {
                accent: 'neutral',
                title: 'Ingreso',
                subtitle: athlete || n.message,
                sound: 'tick',
                confetti: false, celebrate: false, mascot: null, persistent: false,
                buildVoice: (s) =>
                    s.modo_bienvenida_acceso && s.modo_voz !== 'solo_chime' && athlete
                        ? `Hola, ${firstName(athlete)}`
                        : null,
            };
        case 'system':
            return {
                accent: 'red',
                title: n.title,
                subtitle: n.message,
                sound: 'attention',
                confetti: false, celebrate: false, mascot: null,
                persistent: true, // se queda hasta descartar
                buildVoice: () => null,
            };
        default: // qr, marketplace, equipment, otros
            return {
                accent: 'neutral',
                title: n.title,
                subtitle: n.message,
                sound: 'tick',
                confetti: false, celebrate: false, mascot: null, persistent: false,
                buildVoice: () => null,
            };
    }
}

export const formatCop = cop;
// Monto hablado para TTS: "120000 pesos" (sin "$" ni puntos, que el motor lee mal).
export const copSpoken = (n: number) => `${Math.round(Math.abs(n || 0))} pesos`;
