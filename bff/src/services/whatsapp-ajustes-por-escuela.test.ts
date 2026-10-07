/**
 * Ajustes del asistente por escuela (docs/specs/whatsapp-ajustes-por-escuela.md):
 * lo puro — lectura de la fila, validación del QR de cortesía, horarios, textos
 * y detectores. Sin base ni Meta.
 */
import { describe, it, expect } from 'vitest';
import { ajustesDesdeFila, AJUSTES_POR_DEFECTO } from './whatsapp-ajustes-escuela.service';
import {
    qrSirveParaCortesia, horaLegible, diasLegibles, bloqueDeHorarios, textoSemanaDeCortesia,
} from './whatsapp-cortesia-semana.service';
import { pideAyudaDeApp, textoAyudaApp } from './whatsapp-ayuda-app.service';
import { reclamaValor, textoReclamoDeValor, motivoReclamoDeValor, pesos } from './whatsapp-reclamo-valor.service';

describe('ajustesDesdeFila', () => {
    it('sin fila o sin columnas → defaults = comportamiento de siempre', () => {
        expect(ajustesDesdeFila(null)).toEqual(AJUSTES_POR_DEFECTO);
        expect(ajustesDesdeFila({})).toEqual(AJUSTES_POR_DEFECTO);
        expect(AJUSTES_POR_DEFECTO).toMatchObject({ modoCortesia: 'clase', ayudaApp: false, reclamosDeValor: false });
    });

    it('Besser', () => {
        expect(ajustesDesdeFila({
            wa_modo_cortesia: 'semana_app', wa_cortesia_qr_id: 'qr-1', wa_cortesia_dias: 7,
            wa_ayuda_app: true, wa_reclamos_de_valor: true,
        })).toEqual({ modoCortesia: 'semana_app', cortesiaQrId: 'qr-1', cortesiaDias: 7, ayudaApp: true, reclamosDeValor: true });
    });

    it('valores raros caen al default', () => {
        const a = ajustesDesdeFila({ wa_modo_cortesia: 'otro', wa_cortesia_dias: 0, wa_ayuda_app: 'true', wa_cortesia_qr_id: '' });
        expect(a).toEqual(AJUSTES_POR_DEFECTO);
    });
});

describe('qrSirveParaCortesia', () => {
    const qr = { id: 'q', school_id: 's1', slug: 'besser-cortesia', active: true, expires_at: null, require_first_payment: false };
    it('el QR de cortesía de Besser sirve', () => expect(qrSirveParaCortesia(qr, 's1')).toBe(true));
    it('de otra escuela no', () => expect(qrSirveParaCortesia(qr, 's2')).toBe(false));
    it('inactivo no', () => expect(qrSirveParaCortesia({ ...qr, active: false }, 's1')).toBe(false));
    it('vencido no', () => expect(qrSirveParaCortesia({ ...qr, expires_at: '2020-01-01T00:00:00Z' }, 's1')).toBe(false));
    it('uno que COBRA al registrarse no es cortesía', () =>
        expect(qrSirveParaCortesia({ ...qr, require_first_payment: true }, 's1')).toBe(false));
    it('sin slug o null no', () => {
        expect(qrSirveParaCortesia({ ...qr, slug: null }, 's1')).toBe(false);
        expect(qrSirveParaCortesia(null, 's1')).toBe(false);
    });
});

describe('horarios', () => {
    it('horaLegible', () => {
        expect(horaLegible('16:00')).toBe('4:00 pm');
        expect(horaLegible('09:30:00')).toBe('9:30 am');
        expect(horaLegible('12:00')).toBe('12:00 pm');
        expect(horaLegible('00:15')).toBe('12:15 am');
    });

    it('diasLegibles', () => {
        expect(diasLegibles([2, 3, 4, 5])).toBe('martes a viernes');
        expect(diasLegibles([4, 2])).toBe('martes y jueves');
        expect(diasLegibles([3, 5])).toBe('miércoles y viernes');
        expect(diasLegibles([1, 3, 5])).toBe('lunes, miércoles y viernes');
        expect(diasLegibles([6, 0])).toBe('sábado y domingo');
        expect(diasLegibles([3])).toBe('miércoles');
    });

    const franja = (day: number, place = 'Círculo de Suboficiales (Calle 138 # 55-38)') =>
        ({ day, time: '16:00', end: '18:00', place });

    it('Besser: misma hora y lugar → encabezado y días por categoría; sin horario se omite', () => {
        const bloque = bloqueDeHorarios([
            { name: '2011 - ARRAYANES', schedule: [2, 3, 4, 5].map((d) => franja(d)) },
            { name: 'INFANTIL FEMENINO', schedule: [franja(2), franja(4)] },
            { name: '2014 - LIGA ', schedule: JSON.stringify([franja(3), franja(5)]) },
            { name: 'SIN HORARIO', schedule: null },
        ]);
        expect(bloque).toBe(
            '🕓 Entrenamos de *4:00 pm a 6:00 pm* en *Círculo de Suboficiales (Calle 138 # 55-38)*:\n' +
            '• 2011 - ARRAYANES: martes a viernes\n' +
            '• INFANTIL FEMENINO: martes y jueves\n' +
            '• 2014 - LIGA: miércoles y viernes');
    });

    it('horas distintas → cada categoría con su hora y lugar', () => {
        const bloque = bloqueDeHorarios([
            { name: 'Sub-11', schedule: [{ day: 1, time: '17:00', end: '19:00', place: 'Coliseo' }] },
            { name: 'Sub-15', schedule: [{ day: 6, time: '08:00', end: '10:00', place: null }, { day: 0, time: '08:00', end: '10:00' }] },
        ]);
        expect(bloque).toBe('🕓 Horarios por categoría:\n• Sub-11: lunes 5:00 pm a 7:00 pm (Coliseo)\n• Sub-15: sábado y domingo 8:00 am a 10:00 am');
    });

    it('ningún horario cargado → null', () => {
        expect(bloqueDeHorarios([{ name: 'X', schedule: null }, { name: 'Y', schedule: '[]' }])).toBeNull();
    });
});

describe('textoSemanaDeCortesia', () => {
    it('trae el enlace, los botones reales del /join y los horarios', () => {
        const t = textoSemanaDeCortesia({ enlace: 'https://app.sportmaps.co/join/besser-cortesia?t=club-deportivo-besser', dias: 7, horarios: '🕓 Entrenamos…' });
        expect(t).toContain('*gratis durante una semana*');
        expect(t).toContain('https://app.sportmaps.co/join/besser-cortesia?t=club-deportivo-besser');
        expect(t).toContain('«Inscribir a un menor de edad»');
        expect(t).toContain('«Mi hijo/a no está registrado aún»');
        expect(t).toContain('«Soy nuevo»');
        expect(t).toContain('🕓 Entrenamos…');
        expect(t).toContain('Al terminar la semana');
    });

    it('otros días y sin horarios', () => {
        const t = textoSemanaDeCortesia({ enlace: 'https://x/join/a', dias: 10, horarios: null });
        expect(t).toContain('*gratis durante 10 días*');
        expect(t).toContain('Al terminar la cortesía');
        expect(t).not.toContain('🕓');
    });
});

describe('pideAyudaDeApp', () => {
    it.each([
        ['Olvidé mi contraseña', 'clave'],
        ['no me acuerdo de la clave', 'clave'],
        ['como recupero... quiero recuperar mi cuenta', 'clave'],
        ['No puedo entrar a la app', 'entrar'],
        ['buenas, como ingreso?', 'entrar'],
        ['no me abre la aplicación', 'entrar'],
        ['Cómo pago por la app?', 'pagar_app'],
        ['no me deja pagar la mensualidad en la plataforma', 'pagar_app'],
        ['donde descargo la app', 'instalar'],
    ])('«%s» → %s', (texto, tema) => {
        expect(pideAyudaDeApp(texto)).toBe(tema);
    });

    it.each([
        'Cómo pago?',               // sin «app»: sigue a los medios de pago de siempre
        'hola buenas tardes',
        'ya pagué la mensualidad',
        'mi hija no puede ir hoy',
        'cuánto debo',
    ])('«%s» → null', (texto) => {
        expect(pideAyudaDeApp(texto)).toBeNull();
    });
});

describe('textoAyudaApp', () => {
    const urlLogin = 'https://app.sportmaps.co/login?t=club-deportivo-besser';
    it('entrar: botones reales de LoginPage y la URL con marca', () => {
        const t = textoAyudaApp('entrar', { urlLogin, identificado: true });
        expect(t).toContain(urlLogin);
        expect(t).toContain('«Entrar ahora»');
        expect(t).toContain('«¿Olvidaste tu contraseña?»');
        expect(t).not.toContain('Si todavía no tienes cuenta');
    });
    it('clave: «Enviar instrucciones» y revisar spam', () => {
        const t = textoAyudaApp('clave', { urlLogin, identificado: true });
        expect(t).toContain('«Enviar instrucciones»');
        expect(t).toContain('*spam*');
    });
    it('pagar en la app: Pagos → Pagar Ahora → comprobante', () => {
        const t = textoAyudaApp('pagar_app', { urlLogin, identificado: true });
        expect(t).toContain('*«Pagos»*');
        expect(t).toContain('*«Pagar Ahora»*');
        expect(t).toContain('comprobante');
    });
    it('a un número desconocido le explica cómo se crea la cuenta', () => {
        expect(textoAyudaApp('entrar', { urlLogin, identificado: false })).toContain('Si todavía no tienes cuenta');
    });
});

describe('reclamaValor', () => {
    it.each([
        'El valor no coincide',
        'el monto que me sale no corresponde',
        'me cobraron doble este mes',
        'por qué me cobran 380 si es 340',
        'ese no es el valor que me dijeron',
        'la mensualidad está mal',
        'me sale otro valor en la app',
        'el cobro es diferente al que acordamos',
    ])('«%s» → reclamo', (texto) => {
        expect(reclamaValor(texto)).toBe(true);
    });

    it.each([
        'ya pagué',
        'cuánto debo',
        'el horario no coincide con el de mi hija',  // sin palabra de dinero
        'te envío el comprobante',
        'hola',
    ])('«%s» → no', (texto) => {
        expect(reclamaValor(texto)).toBe(false);
    });
});

describe('textos del reclamo', () => {
    const cobros = [
        { concept: 'Mensualidad Octubre 2026 - Juan', amount: 380000, status: 'pending', due_date: '2026-10-10' },
        { concept: 'Mensualidad Septiembre 2026 - Juan', amount: '380000.00', status: 'overdue', due_date: '2026-09-10' },
    ];
    it('pesos con punto de miles', () => {
        expect(pesos(380000)).toBe('$380.000');
        expect(pesos('1250000.00')).toBe('$1.250.000');
    });
    it('lista los cobros abiertos con su estado', () => {
        const t = textoReclamoDeValor(cobros);
        expect(t).toContain('• Mensualidad Octubre 2026 - Juan: *$380.000* (vence 10 oct)');
        expect(t).toContain('• Mensualidad Septiembre 2026 - Juan: *$380.000* (vencido)');
    });
    it('sin cobros lo dice', () => {
        expect(textoReclamoDeValor([])).toContain('No veo cobros abiertos');
    });
    it('el motivo para la escuela trae lo que dijo y los cobros', () => {
        const m = motivoReclamoDeValor('el valor   no coincide', cobros);
        expect(m).toBe('Reclamo de valor: «el valor no coincide». Cobros abiertos: Mensualidad Octubre 2026 - Juan $380.000; Mensualidad Septiembre 2026 - Juan $380.000.');
    });
});
