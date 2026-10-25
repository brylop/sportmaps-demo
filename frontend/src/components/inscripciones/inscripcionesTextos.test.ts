import { describe, it, expect } from 'vitest';
import {
  fraseResumen, primerNombre, saldoDeClases, venceEn,
  estadoInscripcionEvento, estadoPagoEvento, fraseEventos, fechaEvento,
} from './inscripcionesTextos';

describe('fraseResumen (la frase de arriba de Inscripciones y planes)', () => {
  it('acudiente: habla del deportista por su nombre', () => {
    expect(fraseResumen({ nombre: 'Sofía', equipos: 0, planes: 1, clases: 0, reservas: 0 }))
      .toBe('Sofía tiene 1 plan activo.');
    expect(fraseResumen({ nombre: 'Tomás', equipos: 1, planes: 2, clases: 1, reservas: 0 }))
      .toBe('Tomás tiene 1 equipo y 2 planes activos, con 1 clase agendada.');
  });
  it('deportista adulto: de «tú»', () => {
    expect(fraseResumen({ nombre: null, equipos: 2, planes: 0, clases: 3, reservas: 1 }))
      .toBe('Tienes 2 equipos activos, con 3 clases agendadas y 1 reserva.');
  });
  it('sin nada activo lo dice claro, sin cajas vacías', () => {
    expect(fraseResumen({ nombre: 'Sofía', equipos: 0, planes: 0, clases: 0, reservas: 0 }))
      .toBe('Sofía no tiene equipos ni planes activos.');
    expect(fraseResumen({ nombre: null, equipos: 0, planes: 0, clases: 0, reservas: 0 }))
      .toBe('No tienes equipos ni planes activos.');
  });
});

describe('saldo y vencimiento del plan', () => {
  it('saldoDeClases', () => {
    expect(saldoDeClases(null, 4)).toBe('Clases ilimitadas');
    expect(saldoDeClases(8, 5)).toBe('3 clases disponibles');
    expect(saldoDeClases(8, 7)).toBe('1 clase disponible');
    expect(saldoDeClases(8, 9)).toBe('Sin clases disponibles');
  });
  it('venceEn', () => {
    const ahora = new Date('2026-10-24T12:00:00Z').getTime();
    expect(venceEn(null, ahora)).toBeNull();
    expect(venceEn('2026-10-24T10:00:00Z', ahora)).toBe('Vence hoy');
    expect(venceEn('2026-10-25T10:00:00Z', ahora)).toBe('Vence mañana');
    expect(venceEn('2026-11-05T12:00:00Z', ahora)).toBe('Vence en 12 días');
  });
  it('primerNombre', () => {
    expect(primerNombre('  Sofía Herrera ')).toBe('Sofía');
    expect(primerNombre(null)).toBe('');
  });
});

describe('eventos y torneos', () => {
  it('nunca muestra el estado técnico', () => {
    expect(estadoInscripcionEvento('pending').label).toBe('Por aprobar');
    expect(estadoInscripcionEvento('approved').label).toBe('Inscripción aprobada');
    expect(estadoInscripcionEvento('confirmed').tono).toBe('ok');
    expect(estadoInscripcionEvento('rejected').tono).toBe('mal');
    expect(estadoInscripcionEvento('raro').label).toBe('Por aprobar');
  });
  it('estado del pago', () => {
    expect(estadoPagoEvento('verified')?.label).toBe('Pago verificado');
    expect(estadoPagoEvento('pending')?.tono).toBe('espera');
    expect(estadoPagoEvento(undefined)).toBeNull();
  });
  it('fraseEventos', () => {
    expect(fraseEventos([])).toBe('Aún no tienes inscripciones a eventos ni torneos.');
    expect(fraseEventos([{ status: 'approved' }])).toBe('Tienes 1 inscripción.');
    expect(fraseEventos([{ status: 'pending' }, { status: 'approved' }])).toBe('Tienes 2 inscripciones; 1 está por aprobar.');
    expect(fraseEventos([{ status: 'pending' }, { status: 'pending' }])).toBe('Tienes 2 inscripciones; 2 están por aprobar.');
  });
  it('una fecha sola se lee como día local (no el día anterior)', () => {
    expect(fechaEvento('2026-11-21')).toMatch(/21/);
    expect(fechaEvento('')).toBe('');
    expect(fechaEvento('no-es-fecha')).toBe('no-es-fecha');
  });
});
