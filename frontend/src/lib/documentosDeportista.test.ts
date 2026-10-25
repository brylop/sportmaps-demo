import { describe, it, expect } from 'vitest';
import { DOCUMENTOS_DEPORTISTA, tipoDeArchivo, validarArchivo } from './documentosDeportista';

describe('catálogo de documentos del deportista', () => {
  it('trae los 10 tipos que la escuela usa en athlete_documents', () => {
    expect(DOCUMENTOS_DEPORTISTA.map((d) => d.tipo).sort()).toEqual([
      'athlete_id_back', 'athlete_id_front', 'athlete_photo', 'athlete_signature', 'eps_certificate',
      'good_standing_certificate', 'guardian_id_back', 'guardian_id_front', 'guardian_signature', 'other',
    ]);
  });
  it('reconoce los prefijos nuevos y los viejos', () => {
    expect(tipoDeArchivo('guardian_signature-2026-x.png')).toBe('guardian_signature');
    expect(tipoDeArchivo('identity-2025-cedula.pdf')).toBe('athlete_id_front');
    expect(tipoDeArchivo('eps-2025-cert.pdf')).toBe('eps_certificate');
    expect(tipoDeArchivo('athlete_id_back-1.jpg')).toBe('athlete_id_back');
    expect(tipoDeArchivo('foto.jpg')).toBeNull();
  });
  it('firmas y foto solo imagen; el resto PDF o imagen; máximo 10 MB', () => {
    const firma = DOCUMENTOS_DEPORTISTA.find((d) => d.tipo === 'athlete_signature')!;
    const eps = DOCUMENTOS_DEPORTISTA.find((d) => d.tipo === 'eps_certificate')!;
    expect(validarArchivo({ name: 'firma.pdf', size: 1000 }, firma)).not.toBeNull();
    expect(validarArchivo({ name: 'firma.png', size: 1000 }, firma)).toBeNull();
    expect(validarArchivo({ name: 'eps.pdf', size: 1000 }, eps)).toBeNull();
    expect(validarArchivo({ name: 'eps.pdf', size: 11 * 1024 * 1024 }, eps)).not.toBeNull();
  });
});
