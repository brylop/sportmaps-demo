import { describe, it, expect } from 'vitest';
import { whatsappDeLaEscuela } from './whatsappEscuela';

describe('whatsappDeLaEscuela', () => {
  it('celular colombiano sin indicativo → wa.me/57…', () => {
    expect(whatsappDeLaEscuela('320 268 3539')).toBe('https://wa.me/573202683539');
  });
  it('con indicativo se respeta', () => {
    expect(whatsappDeLaEscuela('+57 320 268 3539')).toBe('https://wa.me/573202683539');
  });
  it('fijo, vacío o nulo → sin enlace', () => {
    expect(whatsappDeLaEscuela('601 555 1234')).toBeNull();
    expect(whatsappDeLaEscuela('')).toBeNull();
    expect(whatsappDeLaEscuela(null)).toBeNull();
  });
});
