import { describe, it, expect } from 'vitest';
import {
  fechaCorta, diaMes, parseMonto, topePorDefecto, validarTope, telefonoNequiValido,
  parseVencimiento, tarjetaValida, textoErrorAlta, textoSuspension, unirNombres,
  elegiblesPorEscuela, mostrarSeccionDebito, estadoFila, formatearNumeroTarjeta,
} from './debito-utils';
import type { DeportistaDebito, MiDebito } from '@/lib/api/autopay';

const atleta = (over: Partial<DeportistaDebito> = {}): DeportistaDebito => ({
  key: 'child:1', childId: '1', athleteUserId: null, name: 'Sofía', schoolId: 's1',
  currentTotal: 157500, suggestedMax: 189000, currentPeriod: null, overdueCount: 0,
  subscription: null, ...over,
});

describe('fechas', () => {
  it('formatea el día del débito sin correrlo por la zona horaria', () => {
    expect(fechaCorta('2026-10-10')).toBe('sáb 10 oct');
    expect(fechaCorta('2026-10-08T00:00:00Z')).toBe('jue 8 oct');
    expect(diaMes('2026-11-05')).toBe('5 nov');
    expect(fechaCorta('basura')).toBe('');
  });
});

describe('tope', () => {
  it('usa el sugerido y si no hay, el total vigente', () => {
    expect(topePorDefecto(atleta())).toBe(189000);
    expect(topePorDefecto(atleta({ suggestedMax: null }))).toBe(157500);
    expect(topePorDefecto(atleta({ suggestedMax: null, currentTotal: null }))).toBeNull();
  });
  it('no deja un tope menor que la mensualidad actual', () => {
    expect(validarTope(150000, 157500)).toMatch(/menor/);
    expect(validarTope(157500, 157500)).toBeNull();
    expect(validarTope(100000, null)).toBeNull();
    expect(validarTope(null, null)).toMatch(/Escribe/);
    expect(validarTope(0, null)).toMatch(/Escribe/);
  });
  it('lee montos con puntos y signo', () => {
    expect(parseMonto('$189.000')).toBe(189000);
    expect(parseMonto('')).toBeNull();
  });
});

describe('medios', () => {
  it('valida el celular de Nequi', () => {
    expect(telefonoNequiValido('300 123 4567')).toBe(true);
    expect(telefonoNequiValido('2001234567')).toBe(false);
    expect(telefonoNequiValido('30012345')).toBe(false);
  });
  it('valida la tarjeta', () => {
    expect(parseVencimiento('7/28')).toEqual({ expMonth: '07', expYear: '28' });
    expect(parseVencimiento('13/28')).toBeNull();
    expect(tarjetaValida({ number: '4242 4242 4242 4242', exp: '12/29', cvc: '123', holder: 'Ana Gómez' })).toBeNull();
    expect(tarjetaValida({ number: '4242', exp: '12/29', cvc: '123', holder: 'Ana Gómez' })).toMatch(/número/);
    expect(formatearNumeroTarjeta('4242424242424242')).toBe('4242 4242 4242 4242');
  });
});

describe('textos', () => {
  it('traduce los errores del alta', () => {
    expect(textoErrorAlta('already_subscribed')).toBe('ya tenía débito');
    expect(textoErrorAlta('max_amount_below_current')).toBe('el tope es menor que la mensualidad actual');
    expect(textoErrorAlta('no_active_enrollment')).toBe('no tiene inscripción activa');
    expect(textoErrorAlta('autopay_not_offered')).toBe('la escuela no lo ofrece');
    expect(textoErrorAlta('otro')).toMatch(/no se pudo/);
  });
  it('explica la suspensión por motivo', () => {
    expect(textoSuspension('over_max_amount')).toMatch(/súbelo/);
    expect(textoSuspension('provider_declined')).toMatch(/medio de pago/);
    expect(textoSuspension('token_not_available')).toMatch(/medio de pago/);
    expect(textoSuspension('duplicate_charge')).toMatch(/pago doble/);
  });
  it('une nombres en español', () => {
    expect(unirNombres(['Sofía'])).toBe('Sofía');
    expect(unirNombres(['Sofía', 'Juan'])).toBe('Sofía y Juan');
    expect(unirNombres(['Sofía', 'Juan', 'Ana'])).toBe('Sofía, Juan y Ana');
  });
  it('no usa voseo', () => {
    const todos = [
      textoSuspension('over_max_amount'), textoSuspension('provider_declined'),
      textoSuspension('duplicate_charge'), textoErrorAlta('x'),
    ].join(' ');
    expect(todos).not.toMatch(/\b(vos|tenés|podés|subilo|actualizá)\b/i);
  });
});

describe('visibilidad', () => {
  const base: MiDebito = {
    schools: [{ schoolId: 's1', schoolName: 'Dynasty', offered: true, surchargePct: 0, daysBeforeDue: 3 }],
    athletes: [atleta(), atleta({ key: 'child:2', childId: '2', name: 'Juan' })],
    methods: [],
  };
  it('agrupa elegibles por escuela que ofrece', () => {
    expect(elegiblesPorEscuela(base)[0].athletes).toHaveLength(2);
    const sinOferta = { ...base, schools: [{ ...base.schools[0], offered: false }] };
    expect(elegiblesPorEscuela(sinOferta)).toHaveLength(0);
    expect(mostrarSeccionDebito(sinOferta)).toBe(false);
    expect(mostrarSeccionDebito(base)).toBe(true);
    expect(mostrarSeccionDebito(null)).toBe(false);
  });
  it('muestra la sección si ya hay débito aunque la escuela deje de ofrecerlo', () => {
    const conSub: MiDebito = {
      ...base,
      schools: [{ ...base.schools[0], offered: false }],
      athletes: [atleta({
        subscription: {
          id: 'sub1', status: 'active', suspendReason: null, maxAmount: 189000,
          method: { tokenId: 't1', schoolId: 's1', type: 'NEQUI', label: 'Nequi •••• 5678' }, nextDebit: null,
        },
      })],
    };
    expect(mostrarSeccionDebito(conSub)).toBe(true);
  });
});

describe('estado de fila (escuela)', () => {
  it('lee el estado del ciclo', () => {
    expect(estadoFila('suspended', null).label).toBe('Suspendido');
    expect(estadoFila('active', { state: 'paid', skipReason: null })).toEqual({ label: 'Pagado', tone: 'ok' });
    expect(estadoFila('active', { state: 'skipped', skipReason: 'parent_skip' }).label).toBe('La familia dice que ya pagó');
    expect(estadoFila('active', null).label).toBe('Sin cobro este mes');
  });
});
