/** Pizarra M6c: la ficha PDF lleva notas, notas por cuadro y videos (como enlace). */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const { renderTacticalPng } = vi.hoisted(() => ({
  renderTacticalPng: vi.fn(async (...args: unknown[]) => (void args, { dataUrl: '', aspect: 340 / 300 })),
}));
vi.mock('@/lib/export/tacticalImage', () => ({
  renderTacticalPng,
  tacticalSvgMarkup: () => '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
}));

import { exportExercisePdf, pdfMediaSections } from '@/lib/export/tacticalPdf';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import type { PlayVideo } from '@/lib/school/tacticalMedia';

function bytesOf(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new TextDecoder('latin1').decode(new Uint8Array(r.result as ArrayBuffer)));
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(b);
  });
}

const fr = (id: string, note?: string): TacticalFrame => ({
  id, duration_ms: 1000, players: [{ key: 'slot:DC', x: 50, y: 50 }], ball: null, arrows: [], ...(note ? { note } : {}),
});
const VIDEOS: PlayVideo[] = [
  { provider: 'youtube', video_id: 'dQw4w9WgXcQ', title: 'Salida vs presión', start_s: 90, end_s: null, is_private: false },
  { provider: 'veo', url: 'https://app.veo.co/matches/final-2026/', title: 'Final', start_s: 0, end_s: null, is_private: false },
  { provider: 'youtube', video_id: 'aBcDeFgHiJk', title: 'Interno', start_s: 0, end_s: null, is_private: true },
];
const NOTES = { text: '**Salida** por derecha\n- Lateral sube\n- Volante apoya', tags: ['presión', 'salida de balón'] };

describe('pdfMediaSections', () => {
  it('nota en texto plano, etiquetas, notas de cuadro y videos públicos con su enlace', () => {
    const m = pdfMediaSections({ notes: NOTES, videos: VIDEOS, frames: [fr('a', 'Arranca **el 8**'), fr('b'), fr('c', 'Remate')] });
    expect(m.noteLines).toEqual(['Salida por derecha', '', '• Lateral sube', '• Volante apoya']);
    expect(m.tags).toBe('presión · salida de balón');
    expect(m.frameNotes).toEqual(['Cuadro 1: Arranca el 8', 'Cuadro 3: Remate']);
    expect(m.videos).toEqual([
      { label: 'Salida vs presión (YouTube · desde 1:30)', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s' },
      { label: 'Final (Veo)', url: 'https://app.veo.co/matches/final-2026/' },
    ]);
    expect(m.privateCount).toBe(1);
  });
  it('sin notas ni videos no agrega nada', () => {
    expect(pdfMediaSections({ notes: null, videos: null, frames: null })).toEqual({ noteLines: [], tags: '', frameNotes: [], videos: [], privateCount: 0 });
  });
});

describe('exportExercisePdf con notas y videos', () => {
  beforeEach(() => {
    renderTacticalPng.mockReset();
    renderTacticalPng.mockResolvedValue({ dataUrl: PNG_1PX, aspect: 340 / 300 });
  });
  it('escribe la nota y los enlaces (como link, no incrustados); el privado no sale', async () => {
    const blob = await exportExercisePdf({
      title: 'Salida', frames: [fr('a', 'Arranca el 8'), fr('b')], players: [], arrows: [], notes: NOTES, videos: VIDEOS,
    });
    const text = await bytesOf(blob);
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text).toContain('Salida por derecha');
    expect(text).toContain('Cuadro 1: Arranca el 8');
    expect(text).toContain('/URI (https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s)');
    expect(text).toContain('/URI (https://app.veo.co/matches/final-2026/)');
    expect(text).not.toContain('aBcDeFgHiJk');
    expect(text).not.toContain('/Subtype /Movie');
  });
  it('una nota larga pasa a una segunda hoja en vez de cortarse', async () => {
    const blob = await exportExercisePdf({
      title: 'Larga', frames: null, players: [], arrows: [],
      description: 'Organización. '.repeat(60),
      notes: { text: Array.from({ length: 60 }, (_, i) => `- Consigna ${i + 1}`).join('\n'), tags: [] },
    });
    const text = await bytesOf(blob);
    expect((text.match(/\/Type \/Page\b/g) || []).length).toBe(2);
    expect(text).toContain('Consigna 60');
  });
});
