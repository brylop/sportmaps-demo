/**
 * Tests del constructor de motivo de rechazo automático.
 *
 * La invariante que importa es la de abajo: SOLO los motivos ROJOS rechazan. Un
 * amarillo (monto que difiere, fecha fuera de ventana, formato de referencia)
 * jamás debe producir mensaje, porque eso rechazaría el pago de una familia por
 * algo discutible — que es lo que el ciclo de glosa existe para conversar.
 */

import { describe, it, expect } from 'vitest';
import { redRejectionMessage } from './receipt-approval.service';

describe('redRejectionMessage', () => {
    it('nombra la cuenta destino leída cuando el destino no coincide', () => {
        const msg = redRejectionMessage([
            {
                code: 'DESTINO_NO_COINCIDE',
                level: 'rojo',
                message: 'El dinero se envió a una cuenta que no está registrada por la escuela.',
                detail: { destination: '3128463555', comparedAgainst: ['80600003578', '0089455111'] },
            },
        ]);
        expect(msg).toContain('3128463555');
        expect(msg).toMatch(/^Rechazado automáticamente:/);
        // No filtra las cuentas de la escuela en el texto del rechazo.
        expect(msg).not.toContain('80600003578');
    });

    it('devuelve null si NINGÚN motivo es rojo (un amarillo no rechaza)', () => {
        expect(redRejectionMessage([
            { code: 'MONTO_DIFIERE', level: 'amarillo', message: 'El monto no coincide.' },
            { code: 'FORMATO_REFERENCIA', level: 'amarillo', message: 'Formato raro.' },
            { code: 'FECHA_FUERA_VENTANA', level: 'amarillo', message: 'Vieja.' },
        ])).toBeNull();
    });

    it('devuelve null sin motivos', () => {
        expect(redRejectionMessage([])).toBeNull();
        expect(redRejectionMessage([{ level: 'rojo' }])).toBeNull(); // rojo sin code no decide
    });

    it('ignora los amarillos cuando conviven con un rojo', () => {
        const msg = redRejectionMessage([
            { code: 'MONTO_DIFIERE', level: 'amarillo', message: 'no-debe-aparecer' },
            { code: 'IMAGEN_DUPLICADA', level: 'rojo', message: 'Imagen repetida.' },
        ]);
        expect(msg).toContain('ya se había subido antes');
        expect(msg).not.toContain('no-debe-aparecer');
    });

    it('acumula varios motivos rojos', () => {
        const msg = redRejectionMessage([
            { code: 'NOT_A_RECEIPT', level: 'rojo' },
            { code: 'REFERENCIA_DUPLICADA', level: 'rojo' },
        ]);
        expect(msg).toContain('no es un comprobante');
        expect(msg).toContain('ya se usó en otro pago');
    });

    it('cae al message del motor para un código rojo que no conoce', () => {
        const msg = redRejectionMessage([
            { code: 'CODIGO_NUEVO_SIN_TRADUCCION', level: 'rojo', message: 'Motivo crudo del motor.' },
        ]);
        expect(msg).toContain('Motivo crudo del motor.');
    });
});
