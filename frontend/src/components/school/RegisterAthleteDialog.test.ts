import { describe, expect, it } from 'vitest';
import { yaInscrito } from './RegisterAthleteDialog';

const CAT_A = 'cat-a';
const CAT_B = 'cat-b';

describe('yaInscrito — a quién marca el modal «Inscribir atleta»', () => {
  const inscritos = [
    { category_id: CAT_A, child_id: 'hijo-1', user_id: 'padre-1' },   // hijo inscrito por la escuela o la familia
    { category_id: CAT_A, child_id: null, user_id: 'adulto-1' },      // atleta adulto
  ];

  it('un hijo inscrito en la categoría elegida queda marcado', () => {
    expect(yaInscrito({ id: 'hijo-1', tipo: 'hijo' }, CAT_A, inscritos)).toBe(true);
  });

  it('el mismo hijo en OTRA categoría no está marcado', () => {
    expect(yaInscrito({ id: 'hijo-1', tipo: 'hijo' }, CAT_B, inscritos)).toBe(false);
  });

  it('un atleta adulto se reconoce por user_id cuando no hay child_id', () => {
    expect(yaInscrito({ id: 'adulto-1', tipo: 'adulto' }, CAT_A, inscritos)).toBe(true);
  });

  it('el id del acudiente NO marca a otro hijo suyo (el hijo se reconoce por child_id)', () => {
    expect(yaInscrito({ id: 'padre-1', tipo: 'hijo' }, CAT_A, inscritos)).toBe(false);
    expect(yaInscrito({ id: 'hijo-2', tipo: 'hijo' }, CAT_A, inscritos)).toBe(false);
  });

  it('un adulto no se confunde con una fila de hijo que comparte user_id', () => {
    expect(yaInscrito({ id: 'padre-1', tipo: 'adulto' }, CAT_A, inscritos)).toBe(false);
  });

  it('sin inscritos cargados no marca a nadie', () => {
    expect(yaInscrito({ id: 'hijo-1', tipo: 'hijo' }, CAT_A, undefined)).toBe(false);
    expect(yaInscrito({ id: 'hijo-1', tipo: 'hijo' }, CAT_A, [])).toBe(false);
  });
});
