/**
 * `temaEscolar`: ¿el mensaje de un número desconocido es de la escuela?
 *
 * Calibrado sobre los mensajes entrantes de contactos no-familia de Dynasty
 * del 2026-10-03 (número conectado por Coexistence, que es también el WhatsApp
 * personal de la dueña). Las frases de acá son INVENTADAS o anonimizadas con la
 * misma forma que las reales: nombres cambiados, nada copiado tal cual.
 *
 * La regla de oro: equivocarse callando le cuesta a la escuela una respuesta
 * tardía (la dueña igual ve el mensaje en su celular); equivocarse hablando le
 * escribe un robot a su mamá. Por eso los null pesan tanto como los aciertos.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: {} }));

import { temaEscolar, preguntaPrecioComoProspecto } from './whatsapp-atencion.service';

describe('charla personal → null (silencio)', () => {
    it.each([
        // Las tres que se midieron en Dynasty, con la forma exacta.
        'Donde andas para pagarte lo de la rifa?',
        'Yo voy a hacer plata',
        'Te mando para que desayunes algo ?',
        // Del mismo estilo: plata, comida, familia, favores.
        'Mami me recoges? estoy sudando frío',
        'Ya voy a ir por la niña',
        'Puedes enviarme un video de la bebé',
        'Para que me envíes unos tenis 36',
        'Me quedé sin saldo, recárgame porfa',
        '¿Cuánto te debo de lo del almuerzo?',
        'Pásame la info del restaurante y el precio',
        'Hola mile te envío la cuenta de cobro, gracias',
        '2da cuota de los vuelos',
        'Amor, ¿me traes un trapero?',
        'Hola, ¿cómo vas?',
        '',
        '   ',
    ])('«%s»', (frase) => {
        expect(temaEscolar(frase)).toBeNull();
    });

    it('null / undefined', () => {
        expect(temaEscolar(null)).toBeNull();
        expect(temaEscolar(undefined)).toBeNull();
    });
});

describe('inscripción / información → «inscripcion»', () => {
    it.each([
        'Quiero inscribir a mi hija a volleyball',
        'Hola buenos días, quiero inscribir a mi hija',
        'Pero no sé en qué grupo debo inscribirla',
        '¿Cómo es el proceso de inscripción?',
        'Quisiera matricular a mi hijo',
        // El mensaje del prospecto de Dynasty, con su typo y sus paréntesis.
        'Me puedes compartir más información (Horarios, cursos, lugar de práctias, valor, etc.)',
        'Estoy interesado en conocer sus programas de formación y agendar una clase de cortesía',
        '¿Tienen clase de prueba?',
        '¿Cuánto cuesta el voleibol para niñas de 12?',
        'Buenas, ¿qué horarios tienen las clases?',
        'Info de categorías por favor',
        'Mi hija quiere info de horarios de vóley',
    ])('«%s»', (frase) => {
        expect(temaEscolar(frase)).toBe('inscripcion');
    });
});

describe('pagos / soy familia → «pagos»', () => {
    it.each([
        'envío comprobante de la mensualidad',
        'Buen día, envío comprobante de pago mes de septiembre',
        'Gracias, envió soporte mes octubre',
        'Me confirmas el valor para el pago del mes de septiembre',
        'Quisiera saber el valor pendiente del mes',
        'Ya hice la transferencia',
        '¿A qué cuenta consigno?',
        '¿Cuánto debo?',
        'Necesito el paz y salvo',
        'Soy el acudiente de Sara',
        'Mi hija no va a ir al entrenamiento hoy',
    ])('«%s»', (frase) => {
        expect(temaEscolar(frase)).toBe('pagos');
    });

    it('si coinciden las dos intenciones, gana pagos (decisión 1C)', () => {
        expect(temaEscolar('Voy a hacer el pago de la matrícula, ¿cuánto es?')).toBe('pagos');
        expect(temaEscolar('¿Qué precio tiene la mensualidad de 2 clases?')).toBe('pagos');
    });
});

describe('ruido que podría confundir', () => {
    it('«clases» sola no alcanza: un concepto suelto no es un prospecto', () => {
        expect(temaEscolar('Quería preguntarte por las clases')).toBeNull();
    });

    it('«mi hija» sin nada de la escuela al lado no es familia', () => {
        expect(temaEscolar('Mi hija ya se durmió')).toBeNull();
    });

    it('«pagar» sin mensualidad no cuenta', () => {
        expect(temaEscolar('Ya te voy a pagar lo que te debo')).toBeNull();
    });
});

describe('preguntaPrecioComoProspecto: pagos que también puede ser un prospecto', () => {
    it.each([
        '¿Qué precio tiene la mensualidad?',
        'Cuánto vale la mensualidad de 2 clases',
        'Voy a hacer el pago de la matrícula, ¿cuánto es?',
    ])('«%s» → sí (temaEscolar dice pagos, y además pregunta precio)', (frase) => {
        expect(temaEscolar(frase)).toBe('pagos');
        expect(preguntaPrecioComoProspecto(frase)).toBe(true);
    });

    it.each([
        'envío comprobante de la mensualidad',
        'Me confirmas el valor para el pago del mes de septiembre',
        'Quisiera saber el valor pendiente del mes',
        'Ya hice la transferencia',
        '¿Cuánto debo?',
        'Mi hija no va a ir al entrenamiento hoy',
    ])('«%s» → no (es SU cobro, no la lista de precios)', (frase) => {
        expect(preguntaPrecioComoProspecto(frase)).toBe(false);
    });

    it('vacío → no', () => {
        expect(preguntaPrecioComoProspecto(null)).toBe(false);
        expect(preguntaPrecioComoProspecto('')).toBe(false);
    });
});
