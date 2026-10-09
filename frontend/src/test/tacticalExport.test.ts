import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 1×1 PNG válido: jsPDF lo decodifica de verdad.
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const { renderTacticalPng, saveAs } = vi.hoisted(() => ({
  renderTacticalPng: vi.fn(async (...args: unknown[]) => (void args, { dataUrl: '', aspect: 340 / 300 })),
  saveAs: vi.fn(),
}));

vi.mock('@/lib/export/tacticalImage', () => ({
  renderTacticalPng,
  tacticalSvgMarkup: () => '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
}));
vi.mock('file-saver', () => ({ saveAs }));

import { exportExercisePdf, stripSlots } from '@/lib/export/tacticalPdf';
import { shareFile, whatsappTextUrl } from '@/lib/export/tacticalShare';
import { exportVideo, isTacticalVideoUnsupported, pickVideoMime } from '@/lib/export/tacticalVideo';
import { cleanPdfText, exportFileName } from '@/lib/export/tacticalExportUtils';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';

/** FileReader y no Response/arrayBuffer: el Blob de jsdom no los soporta todos. */
function bytesOf(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new TextDecoder('latin1').decode(new Uint8Array(r.result as ArrayBuffer)));
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(b);
  });
}

const fr = (id: string): TacticalFrame => ({
  id,
  duration_ms: 1000,
  players: [{ key: 'slot:DC', x: 50, y: 50 }],
  ball: { x: 50, y: 55 },
  arrows: [],
});

describe('exportExercisePdf', () => {
  beforeEach(() => {
    renderTacticalPng.mockReset();
    renderTacticalPng.mockResolvedValue({ dataUrl: PNG_1PX, aspect: 340 / 300 });
  });

  it('devuelve un PDF de una sola hoja con la jugada estática', async () => {
    const blob = await exportExercisePdf({
      title: 'Rondo 4v2 ⚽ con emoji',
      objective: 'Conservar la pelota → salir jugando',
      minutes: 15,
      ageGroup: 'Sub 11',
      materials: 'Conos, petos',
      description: 'Texto largo. '.repeat(400),
      teamName: 'Sub 11 A',
      frames: null,
      players: [{ x: 50, y: 50, label: 'Ana' }],
      arrows: [],
    });
    expect(blob).toBeInstanceOf(Blob);
    const text = await bytesOf(blob);
    expect(text.startsWith('%PDF-')).toBe(true);
    expect((text.match(/\/Type \/Page\b/g) || []).length).toBe(1);
    expect(renderTacticalPng).toHaveBeenCalledTimes(1);
  });

  it('con varios cuadros dibuja la tira (5 miniaturas + «+n»)', async () => {
    const frames = Array.from({ length: 9 }, (_, i) => fr(`f${i}`));
    const blob = await exportExercisePdf({ title: 'Salida', frames, players: [], arrows: [] });
    expect((await bytesOf(blob)).startsWith('%PDF-')).toBe(true);
    // 1 grande + 5 miniaturas
    expect(renderTacticalPng).toHaveBeenCalledTimes(6);
    // El cuadro 1 lleva el balón como objeto.
    const [, arrows] = renderTacticalPng.mock.calls[0] as [unknown, { type?: string }[]];
    expect(arrows.some((a) => a.type === 'ball')).toBe(true);
  });

  it('stripSlots', () => {
    expect(stripSlots(1)).toEqual({ thumbs: 0, more: 0 });
    expect(stripSlots(6)).toEqual({ thumbs: 6, more: 0 });
    expect(stripSlots(9)).toEqual({ thumbs: 5, more: 4 });
  });
});

describe('cleanPdfText / exportFileName', () => {
  it('quita emoji y cambia flechas', () => {
    expect(cleanPdfText('Pase → remate ⚽')).toBe('Pase -> remate');
    expect(cleanPdfText(null)).toBe('');
  });
  it('arma nombres de archivo sin tildes', () => {
    expect(exportFileName('Salida de balón 4-4-2', 'png')).toBe('jugada-salida-de-balon-4-4-2.png');
    expect(exportFileName('', 'pdf', 'ficha')).toBe('ficha.pdf');
  });
});

describe('shareFile', () => {
  const realUA = navigator.userAgent;
  const setUA = (ua: string) => Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  const nav = navigator as unknown as Record<string, unknown>;
  afterEach(() => {
    setUA(realUA);
    delete nav.share;
    delete nav.canShare;
    saveAs.mockClear();
  });

  it('en escritorio descarga y devuelve el enlace wa.me', async () => {
    setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    const blob = new Blob(['x'], { type: 'image/png' });
    const res = await shareFile(blob, 'jugada.png', 'Jugada: Rondo');
    expect(res.method).toBe('download');
    expect(res.whatsappUrl).toBe(whatsappTextUrl('Jugada: Rondo'));
    expect(res.whatsappUrl).toBe('https://wa.me/?text=Jugada%3A%20Rondo');
    expect(saveAs).toHaveBeenCalledWith(blob, 'jugada.png');
  });

  it('en celular sin soporte de archivos también descarga', async () => {
    setUA('Mozilla/5.0 (Linux; Android 13) Mobile');
    const share = vi.fn();
    Object.assign(navigator, { share, canShare: vi.fn(() => false) });
    const res = await shareFile(new Blob(['x']), 'a.png', 't');
    expect(res.method).toBe('download');
    expect(share).not.toHaveBeenCalled();
  });

  it('en celular con Web Share comparte el archivo', async () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    const share = vi.fn(async (d: unknown) => void d);
    Object.assign(navigator, { share, canShare: vi.fn(() => true) });
    const res = await shareFile(new Blob(['x'], { type: 'image/png' }), 'a.png', 'hola');
    expect(res.method).toBe('share');
    expect(share).toHaveBeenCalledTimes(1);
    const data = share.mock.calls[0][0] as { files: File[]; text: string };
    expect(data.files[0].name).toBe('a.png');
    expect(data.text).toBe('hola');
    expect(saveAs).not.toHaveBeenCalled();
  });

  it('si el usuario cierra la hoja no descarga; si falla por permiso, descarga', async () => {
    setUA('Android Mobile');
    const abort = Object.assign(new Error('x'), { name: 'AbortError' });
    Object.assign(navigator, { share: vi.fn(async () => { throw abort; }), canShare: () => true });
    expect((await shareFile(new Blob(['x']), 'a.png', 't')).method).toBe('cancelled');
    expect(saveAs).not.toHaveBeenCalled();

    const denied = Object.assign(new Error('x'), { name: 'NotAllowedError' });
    Object.assign(navigator, { share: vi.fn(async () => { throw denied; }) });
    expect((await shareFile(new Blob(['x']), 'a.png', 't')).method).toBe('download');
    expect(saveAs).toHaveBeenCalledTimes(1);
  });
});

describe('video', () => {
  it('pickVideoMime prefiere MP4 y cae a WebM', () => {
    expect(pickVideoMime((t) => t === 'video/mp4')).toEqual({ mime: 'video/mp4', ext: 'mp4' });
    expect(pickVideoMime((t) => t.startsWith('video/webm'))).toEqual({ mime: 'video/webm;codecs=vp9', ext: 'webm' });
    expect(pickVideoMime((t) => t.includes('vp8'))).toEqual({ mime: 'video/webm;codecs=vp8', ext: 'webm' });
    expect(pickVideoMime(() => true, 'webm')!.ext).toBe('webm');
    expect(pickVideoMime(() => false)).toBeNull();
    expect(pickVideoMime(() => { throw new Error('x'); })).toBeNull();
  });

  it('sin MediaRecorder lanza el error tipado (la UI ofrece la imagen)', async () => {
    expect(typeof (globalThis as { MediaRecorder?: unknown }).MediaRecorder).toBe('undefined');
    const err = await exportVideo({ frames: [fr('a'), fr('b')] }).catch((e: unknown) => e);
    expect(isTacticalVideoUnsupported(err)).toBe(true);
    expect((err as { reason: string }).reason).toBe('no_media_recorder');
  });

  it('con menos de 2 cuadros lanza too_few_frames', async () => {
    const err = await exportVideo({ frames: [fr('a')] }).catch((e: unknown) => e);
    expect(isTacticalVideoUnsupported(err)).toBe(true);
    expect((err as { reason: string }).reason).toBe('too_few_frames');
  });
});
