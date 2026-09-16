/**
 * El parser de notificaciones bancarias, contra correos REALES.
 *
 * Los textos de abajo salieron de una bandeja de verdad el 2026-09-16 (montos y
 * nombres cambiados). No son inventados: inventarlos es justo como se escribe
 * un parser que funciona en el test y falla con el primer correo del banco.
 */
import { describe, it, expect } from 'vitest';
import { leerCorreoDeBanco, montoAPesos, mismoNombre } from './banco-correo-parser.service';

const NEQUI = 'notificaciones@nequi.com.co';
const BANCOLOMBIA = 'alertasynotificaciones@an.notificacionesbancolombia.com';

describe('montoAPesos — los tres formatos que conviven en un mismo buzón', () => {
    it('Nequi: punto de miles, sin símbolo ni decimales', () => {
        // El bug caro: Number('4.000') da 4. Cuatro pesos en vez de cuatro mil.
        expect(montoAPesos('4.000')).toBe(4000);
        expect(montoAPesos('400.000')).toBe(400000);
        expect(montoAPesos('1.250.000')).toBe(1250000);
    });

    it('Bancolombia: punto DECIMAL', () => {
        expect(montoAPesos('$400000.00')).toBe(400000);
        expect(montoAPesos('$244530.00')).toBe(244530);
    });

    it('Bancolombia: punto de miles Y coma decimal', () => {
        expect(montoAPesos('$237.975,24')).toBe(237975);
        expect(montoAPesos('$400.000,00')).toBe(400000);
    });

    it('sin separadores', () => {
        expect(montoAPesos('150000')).toBe(150000);
    });

    it('lo que no es un monto no inventa un número', () => {
        expect(montoAPesos('')).toBeNull();
        expect(montoAPesos('sin cifras')).toBeNull();
    });
});

describe('Nequi', () => {
    it('lee una recepción por Bre-B', () => {
        const cuerpo = '¡Recibiste plata por Bre-B! ¡Hola, Brayan Steven López Romero! ' +
            'Recibiste 400.000 de ANA MARIA PEREZ GOMEZ el 15 de septiembre de 2026 ' +
            'a las 4:19 p.m, desde el banco Bancolombia. Revisa el detalle en los movimientos de tu app.';

        expect(leerCorreoDeBanco(NEQUI, cuerpo)).toEqual({
            banco: 'nequi',
            monto: 400000,
            remitente: 'ANA MARIA PEREZ GOMEZ',
            fecha: '2026-09-15',
            hora: '16:19',
            bancoOrigen: 'Bancolombia',
            destino: null,   // el correo de recepción NO dice a cuál llave entró
        });
    });

    it('la hora p.m se convierte a 24h, y 8:09 p.m no es 08:09', () => {
        const cuerpo = 'Recibiste 4.000 de LUISA PARDO el 12 de septiembre de 2026 ' +
            'a las 8:09 p.m, desde el banco Nubank.';
        const r = leerCorreoDeBanco(NEQUI, cuerpo)!;
        expect(r.hora).toBe('20:09');
        expect(r.monto).toBe(4000);
        expect(r.bancoOrigen).toBe('Nubank');
    });

    it('IGNORA el correo de envío', () => {
        // Este le llega al PAPÁ, no a la escuela. Tomarlo por bueno seria dar
        // por recibida plata que salio de otra cuenta.
        const cuerpo = '¡Realizaste un envío por Bre-B y todo salió bien! ¡Hola, BRAYAN LOPEZ! ' +
            'Enviaste de manera exitosa 200.000 a la llave 3057780925 de LUISA PARDO ' +
            'el 15 de septiembre de 2026 a las 7:16 p.m.';
        expect(leerCorreoDeBanco(NEQUI, cuerpo)).toBeNull();
    });
});

describe('Bancolombia', () => {
    it('lee una transferencia recibida, con llave', () => {
        const cuerpo = '¡Listo! Todo salió bien con tus movimientos Bancolombia: ' +
            'BRAYAN, recibiste una transferencia de Tumipay SAS por $400000.00 ' +
            'en tu cuenta *6943 conectada a la llave 1016088109 el 15/09/26 a las 16:09.';

        expect(leerCorreoDeBanco(BANCOLOMBIA, cuerpo)).toEqual({
            banco: 'bancolombia',
            monto: 400000,
            remitente: 'Tumipay SAS',
            fecha: '2026-09-15',
            hora: '16:09',
            bancoOrigen: null,
            destino: '1016088109',
        });
    });

    it('lee un pago recibido sin llave', () => {
        const cuerpo = 'Recibiste un pago PROVEEDOR de INVERSIONES ACME por $244530.00 ' +
            'en tu cuenta de Ahorros el 15/09/2026 a las 18:46.';
        const r = leerCorreoDeBanco(BANCOLOMBIA, cuerpo)!;
        expect(r.monto).toBe(244530);
        expect(r.remitente).toBe('INVERSIONES ACME');
        expect(r.fecha).toBe('2026-09-15');
    });

    it('el año de dos dígitos se resuelve al 2000, no al 1900', () => {
        const cuerpo = 'recibiste una transferencia de ANA PEREZ por $150000.00 ' +
            'en tu cuenta *6943 el 03/01/26 a las 09:05.';
        expect(leerCorreoDeBanco(BANCOLOMBIA, cuerpo)!.fecha).toBe('2026-01-03');
    });

    it('IGNORA lo que no es plata que entró', () => {
        // Al buzón van a llegar rechazos y promociones. Confundirlos es peor
        // que no leer nada.
        for (const cuerpo of [
            'Bancolombia le informa Rechazo Factura Programada DRUO por $400.000,00',
            'Bancolombia informa pago Factura Programada DRUO por $237.975,24 desde Aho*6943',
            'transferiste $400000.00 a la llave 3128463555 desde tu cuenta *6943',
            '¿Quieres vender el carro? Publícalo en Tu360Movilidad',
        ]) {
            expect(leerCorreoDeBanco(BANCOLOMBIA, cuerpo), cuerpo.slice(0, 40)).toBeNull();
        }
    });
});

describe('sobrevive al reenvío', () => {
    it('lee igual con los «>» y los saltos que mete el forward', () => {
        const reenviado = [
            '> ¡Recibiste plata por Bre-B!',
            '>',
            '> ¡Hola, DYNASTY VOLLEY CLUB!',
            '> Recibiste 150.000 de ANA MARIA PEREZ el 16 de septiembre',
            '> de 2026 a las 10:32 a.m, desde el banco Nequi.',
        ].join('\n');
        const r = leerCorreoDeBanco(NEQUI, reenviado)!;
        expect(r.monto).toBe(150000);
        expect(r.remitente).toBe('ANA MARIA PEREZ');
        expect(r.hora).toBe('10:32');
    });
});

describe('mismoNombre — el banco y la ficha nunca escriben igual', () => {
    it('acepta el nombre recortado contra el completo', () => {
        expect(mismoNombre('BRAYAN LOPEZ', 'Brayan Steven López Romero')).toBe(true);
        expect(mismoNombre('ANA MARIA PEREZ', 'Ana María Pérez Gómez')).toBe(true);
    });

    it('acepta el desorden de nombre y apellido', () => {
        expect(mismoNombre('PEREZ ANA MARIA', 'Ana Maria Perez')).toBe(true);
    });

    it('NO acepta a dos personas distintas que comparten un nombre', () => {
        expect(mismoNombre('MARIA GOMEZ', 'Maria Rodriguez')).toBe(false);
        expect(mismoNombre('ANA PEREZ', 'ANA TORRES')).toBe(false);
    });

    it('un solo nombre en común no alcanza', () => {
        // «María» contra «María» calzaría con media escuela.
        expect(mismoNombre('MARIA', 'Maria Fernanda Gomez')).toBe(false);
    });
});
