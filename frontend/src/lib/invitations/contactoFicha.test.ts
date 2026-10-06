import { describe, expect, it } from 'vitest';
import { contactoDeFicha, esMenorDeEdad, fichaVaAlAcudiente, invitacionParaAtleta } from './contactoFicha';

// Filas con la forma del listado de atletas tras el merge de
// SchoolStudentsManagementPage (school_athletes + guardian_* de la ficha).
const HOY = '2026-10-05';
const isabella = {
  id: 'ua-isa', athlete_type: 'unregistered', full_name: 'Isabella Florian', date_of_birth: '2010-03-01',
  athlete_email: 'isa.atleta@gmail.com', athlete_phone: '3001110001',
  guardian_full_name: 'Zulma Plata', guardian_email: 'zr.plata@gmail.com', guardian_phone: '3002220001',
};
const salome = { ...isabella, id: 'ua-salo', full_name: 'Salomé Florian', date_of_birth: '2017-05-05', athlete_email: 'salo@gmail.com' };
const andres = {
  id: 'ua-andres', athlete_type: 'unregistered', full_name: 'Andrés Adulto', date_of_birth: '2001-01-10',
  athlete_email: 'andres@gmail.com', athlete_phone: '3001110003',
  guardian_full_name: 'Emergencia', guardian_email: 'emergencia@gmail.com', guardian_phone: '3002220003',
};

describe('invitacionParaAtleta (H-03 / H-04 del informe Monster)', () => {
  it('ficha MENOR → invita al ACUDIENTE con rol parent y el id de la ficha', () => {
    expect(invitacionParaAtleta(isabella, HOY)).toEqual({
      role: 'parent', email: 'zr.plata@gmail.com', phone: '3002220001',
      childName: 'Isabella Florian', unregisteredId: 'ua-isa',
    });
  });

  it('hermanas: mismo acudiente, una invitación por hija (cada una con su ficha)', () => {
    const a = invitacionParaAtleta(isabella, HOY)!;
    const b = invitacionParaAtleta(salome, HOY)!;
    expect(a.email).toBe(b.email);
    expect([a.unregisteredId, b.unregisteredId]).toEqual(['ua-isa', 'ua-salo']);
    expect(a.childName).not.toBe(b.childName);
    expect(a.role).toBe('parent');
    expect(b.role).toBe('parent');
  });

  it('ficha ADULTA → invita al propio atleta (rol athlete + id)', () => {
    expect(invitacionParaAtleta(andres, HOY)).toEqual({
      role: 'athlete', email: 'andres@gmail.com', phone: '3001110003',
      childName: 'Andrés Adulto', unregisteredId: 'ua-andres',
    });
  });

  it('menor con correo de acudiente inválido → no se invita (nunca al niño)', () => {
    expect(invitacionParaAtleta({ ...isabella, guardian_email: 'no aplica', guardian_phone: '3' }, HOY)).toBeNull();
  });

  it('quien ya tiene cuenta no se reinvita', () => {
    expect(invitacionParaAtleta({ id: 'u1', athlete_type: 'adult', parent_email: 'x@y.co' }, HOY)).toBeNull();
    expect(invitacionParaAtleta({ id: 'c1', athlete_type: 'child', parent_id: 'p1', parent_email: 'x@y.co' }, HOY)).toBeNull();
  });

  it('hijo sin cuenta de acudiente → parent, sin id de ficha', () => {
    expect(invitacionParaAtleta({ id: 'c2', athlete_type: 'child', full_name: 'Tomás', parent_email: 'ana@x.co' }, HOY))
      .toEqual({ role: 'parent', email: 'ana@x.co', phone: null, childName: 'Tomás', unregisteredId: null });
  });
});

describe('contactoDeFicha (H-06)', () => {
  it('menor → acudiente', () => {
    const c = contactoDeFicha({ ...isabella, email: isabella.athlete_email, phone: isabella.athlete_phone }, HOY);
    expect(c.email).toBe('zr.plata@gmail.com');
    expect(c.phone).toBe('3002220001');
    expect(c.nombre).toBe('Zulma Plata');
  });
  it('adulto → él mismo', () => {
    const c = contactoDeFicha({ ...andres, email: andres.athlete_email, phone: andres.athlete_phone }, HOY);
    expect(c.email).toBe('andres@gmail.com');
    expect(c.deAcudiente).toBe(false);
  });
  it('sin fecha de nacimiento y con acudiente → acudiente', () => {
    expect(fichaVaAlAcudiente({ guardian_email: 'g@x.co' }, HOY)).toBe(true);
    expect(esMenorDeEdad(null, HOY)).toBeNull();
  });
});
