import { describe, expect, it } from 'vitest';
import {
    contactoDeFicha,
    contactoDeHijoSinCuenta,
    correoValido,
    esMenorDeEdad,
    telefonoValido,
} from './contacto-acudiente';
import { contactoDePago } from '../jobs/payment-lifecycle-emails.job';
import { agruparPorFamilia } from './estado-de-cuenta.service';

// Fichas con la forma real de Monster (H-06 / H-16 del informe 2026-10-05).
const HOY = '2026-10-05';
const isabella = {
    full_name: 'Isabella Florian', email: 'isa.atleta@gmail.com', phone: '3001110001',
    date_of_birth: '2010-03-01',
    guardian_full_name: 'Zulma Plata', guardian_email: 'ZR.Plata@gmail.com ', guardian_phone: '300 222 0001',
};
const andres = {
    full_name: 'Andrés Adulto', email: 'andres@gmail.com', phone: '3001110003',
    date_of_birth: '2001-01-10',
    guardian_full_name: 'Contacto Emergencia', guardian_email: 'emergencia@gmail.com', guardian_phone: '3002220003',
};

describe('esMenorDeEdad', () => {
    it('cumple 18 el mismo día → ya es mayor', () => {
        expect(esMenorDeEdad('2008-10-05', HOY)).toBe(false);
        expect(esMenorDeEdad('2008-10-06', HOY)).toBe(true);
    });
    it('sin fecha → null', () => {
        expect(esMenorDeEdad(null, HOY)).toBeNull();
        expect(esMenorDeEdad('', HOY)).toBeNull();
    });
});

describe('datos sucios del acudiente (H-16)', () => {
    it('correos de texto no son correos', () => {
        expect(correoValido('no aplica')).toBeNull();
        expect(correoValido('No')).toBeNull();
        expect(correoValido(' Juan@Mail.com ')).toBe('juan@mail.com');
    });
    it('teléfonos: toma el primero plausible, descarta los de un dígito', () => {
        expect(telefonoValido('3')).toBeNull();
        expect(telefonoValido('311 8525755 y 3114766424')).toBe('311 8525755');
        expect(telefonoValido('+57 315 461 0261')).toBe('+57 315 461 0261');
    });
});

describe('contactoDeFicha', () => {
    it('MENOR → el acudiente, nunca el niño', () => {
        const c = contactoDeFicha(isabella, HOY);
        expect(c).toEqual({ nombre: 'Zulma Plata', email: 'zr.plata@gmail.com', phone: '300 222 0001', deAcudiente: true });
    });
    it('MENOR con acudiente inválido → canal vacío, no cae al niño', () => {
        const c = contactoDeFicha({ ...isabella, guardian_email: 'no aplica', guardian_phone: '3' }, HOY);
        expect(c.email).toBeNull();
        expect(c.phone).toBeNull();
        expect(c.deAcudiente).toBe(true);
    });
    it('ADULTO → su propio contacto', () => {
        const c = contactoDeFicha(andres, HOY);
        expect(c).toEqual({ nombre: 'Andrés Adulto', email: 'andres@gmail.com', phone: '3001110003', deAcudiente: false });
    });
    it('ADULTO sin contacto propio → el acudiente cargado', () => {
        const c = contactoDeFicha({ ...andres, email: null, phone: '' }, HOY);
        expect(c.email).toBe('emergencia@gmail.com');
        expect(c.deAcudiente).toBe(true);
    });
    it('sin fecha de nacimiento pero con acudiente → acudiente', () => {
        expect(contactoDeFicha({ ...isabella, date_of_birth: null }, HOY).email).toBe('zr.plata@gmail.com');
    });
});

describe('contactoDeHijoSinCuenta', () => {
    it('usa el parent_*_temp que cargó la escuela', () => {
        const c = contactoDeHijoSinCuenta({ full_name: 'Tomás', parent_name_temp: 'Ana', parent_email_temp: 'ana@x.co', parent_phone_temp: '3009998877' });
        expect(c).toEqual({ nombre: 'Ana', email: 'ana@x.co', phone: '3009998877', deAcudiente: true });
    });
});

describe('aviso de cobro (payment-lifecycle-emails)', () => {
    it('cobro de ficha menor → correo y WhatsApp del acudiente; deportista = la niña', () => {
        const r = contactoDePago(null, null, isabella);
        expect(r.contactEmail).toBe('zr.plata@gmail.com');
        expect(r.contactPhone).toBe('300 222 0001');
        expect(r.contactName).toBe('Zulma Plata');
        expect(r.athleteName).toBe('Isabella Florian');
    });
    it('la cuenta del acudiente manda sobre la ficha', () => {
        const r = contactoDePago({ id: 'p1', full_name: 'Zulma', email: 'z@cuenta.co', phone: '3000000000' }, null, isabella);
        expect(r.contactEmail).toBe('z@cuenta.co');
        expect(r.contactProfileId).toBe('p1');
    });
});

describe('estado de cuenta (agruparPorFamilia)', () => {
    it('dos hermanas con ficha y el mismo acudiente → UNA familia, al correo del acudiente', () => {
        const salome = { ...isabella, full_name: 'Salomé Florian', email: 'salo.atleta@gmail.com', date_of_birth: '2017-05-05' };
        const base = { school_id: 's', parent_id: null, user_id: null, child_id: null, amount: 145000, amount_paid: 0,
            status: 'pending', due_date: '2026-10-10', payment_type: 'subscription', period_year: 2026, period_month: 10,
            charge_notice_sent_at: null, overdue_notice_sent_at: null, concept: 'Mensualidad' } as any;
        const { familias, sinContacto } = agruparPorFamilia(
            [{ ...base, id: 'a', unregistered_athlete_id: 'ua1' }, { ...base, id: 'b', unregistered_athlete_id: 'ua2' }],
            { perfiles: new Map(), hijos: new Map(), noRegistrados: new Map([['ua1', isabella], ['ua2', salome]]) },
            new Date('2026-10-05T15:00:00Z'), '2026-10',
        );
        expect(sinContacto).toBe(0);
        expect(familias).toHaveLength(1);
        expect(familias[0].email).toBe('zr.plata@gmail.com');
        expect(familias[0].nombre).toBe('Zulma Plata');
        expect(familias[0].filas.map((f: any) => f.atleta).sort()).toEqual(['Isabella Florian', 'Salomé Florian']);
    });
});

describe('accionCobroDePlan (editor de atletas, H-08)', async () => {
    const { accionCobroDePlan } = await import('./enrollmentBilling');
    it('asignar plan a una inscripción de SOLO equipo emite cobro', () => {
        expect(accionCobroDePlan(null, 'plan-1', 145000)).toBe('cambio');
        expect(accionCobroDePlan(null, 'plan-1', null)).toBe('cambio');
    });
    it('cambiar de plan emite cobro', () => {
        expect(accionCobroDePlan('plan-1', 'plan-2', null)).toBe('cambio');
    });
    it('mismo plan: solo montos; con cuota 0: sin cobro', () => {
        expect(accionCobroDePlan('plan-1', 'plan-1', 150000)).toBe('mismo_plan');
        expect(accionCobroDePlan('plan-1', 'plan-1', 0)).toBe('sin_cobro');
    });
    it('sin plan antes ni después: nada que emitir', () => {
        expect(accionCobroDePlan(null, null, null)).toBe('mismo_plan');
    });
});
