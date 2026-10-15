import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * GIF de la pizarra (spec docs/specs/pizarra-nivel-tacticalpad.md §4 «Export de video»):
 * el encoder produce un GIF89a válido que este mismo test decodifica, y la
 * exportación elige video o GIF según haya MediaRecorder.
 */

const { saveAs, dispose } = vi.hoisted(() => ({ saveAs: vi.fn(), dispose: vi.fn() }));
vi.mock('file-saver', () => ({ saveAs }));

// Pintor falso (jsdom no tiene canvas 2D): fondo verde y un cuadrado blanco
// de 3×3 que avanza con el tiempo. Mismo contrato que el real.
vi.mock('@/lib/export/tacticalFrameRenderer', async () => {
  const { framesDuration } = await import('@/lib/export/tacticalInterpolation');
  return {
    abortError: () => new DOMException('Exportación cancelada', 'AbortError'),
    createTacticalFrameRenderer: async (opts: { frames: unknown[]; holdStartMs: number; holdEndMs: number }) => {
      const width = 20;
      const height = 22;
      const length = opts.holdStartMs + framesDuration(opts.frames as never) + opts.holdEndMs;
      let data = new Uint8ClampedArray(width * height * 4);
      const draw = (t: number) => {
        data = new Uint8ClampedArray(width * height * 4);
        const sx = Math.min(width - 3, Math.floor((Math.max(0, Math.min(t, length)) / length) * (width - 3)));
        for (let p = 0; p < width * height; p++) {
          const x = p % width;
          const y = Math.floor(p / width);
          const on = x >= sx && x < sx + 3 && y >= 9 && y < 12;
          data.set(on ? [255, 255, 255, 255] : [26, 97, 24, 255], p * 4);
        }
      };
      return {
        canvas: {},
        ctx: { getImageData: () => ({ data }) },
        width,
        height,
        length,
        draw,
        dispose,
      };
    },
  };
});

import {
  ColorHistogram,
  GifWriter,
  buildPalette,
  diffRect,
  encodeGif,
  lzwEncode,
} from '@/lib/export/gifEncoder';
import { animationLabel, canRecordVideo, pickAnimationKind } from '@/lib/export/tacticalAnimationFormat';
import { exportAnimation, exportGif, gifSampleTimes } from '@/lib/export/tacticalGif';
import { canShareFiles, shareFile } from '@/lib/export/tacticalShare';
import { isTacticalVideoUnsupported } from '@/lib/export/tacticalVideo';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';

// ─── Decodificador GIF mínimo (solo para verificar) ─────────────────────────

function lzwDecode(data: Uint8Array, minCodeSize: number, pixelCount: number): Uint8Array {
  const out = new Uint8Array(pixelCount);
  let op = 0;
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let dict: number[][] = [];
  const reset = () => {
    dict = [];
    for (let i = 0; i < clear; i++) dict[i] = [i];
    dict[clear] = [];
    dict[eoi] = [];
    codeSize = minCodeSize + 1;
  };
  reset();
  let prev: number[] | null = null;
  let bitPos = 0;
  const totalBits = data.length * 8;
  while (bitPos + codeSize <= totalBits) {
    let code = 0;
    for (let b = 0; b < codeSize; b++, bitPos++) {
      if (data[bitPos >> 3] & (1 << (bitPos & 7))) code |= 1 << b;
    }
    if (code === clear) {
      reset();
      prev = null;
      continue;
    }
    if (code === eoi) break;
    let entry: number[];
    if (code < dict.length && dict[code]) entry = dict[code];
    else if (prev && code === dict.length) entry = [...prev, prev[0]];
    else throw new Error(`código LZW inválido ${code}`);
    for (const v of entry) out[op++] = v;
    if (prev && dict.length < 4096) {
      dict.push([...prev, entry[0]]);
      if (dict.length === 1 << codeSize && codeSize < 12) codeSize++;
    }
    prev = entry;
  }
  if (op !== pixelCount) throw new Error(`LZW: ${op} píxeles, se esperaban ${pixelCount}`);
  return out;
}

interface DecodedGif {
  width: number;
  height: number;
  palette: Uint8Array;
  loop: number | null;
  descriptors: number;
  delays: number[];
  /** Imagen compuesta (RGB) tras cada cuadro, disposal 1. */
  composites: Uint8Array[];
  trailer: boolean;
}

function decodeGif(bytes: Uint8Array): DecodedGif {
  let p = 0;
  const u8 = () => bytes[p++];
  const u16 = () => bytes[p++] | (bytes[p++] << 8);
  const header = String.fromCharCode(...bytes.slice(0, 6));
  if (header !== 'GIF89a') throw new Error(`cabecera ${header}`);
  p = 6;
  const width = u16();
  const height = u16();
  const packed = u8();
  u8();
  u8();
  if (!(packed & 0x80)) throw new Error('sin paleta global');
  const gctSize = 3 * (1 << ((packed & 7) + 1));
  const palette = bytes.slice(p, p + gctSize);
  p += gctSize;
  let loop: number | null = null;
  let descriptors = 0;
  const delays: number[] = [];
  const composites: Uint8Array[] = [];
  const canvas = new Uint8Array(width * height * 3);
  let trailer = false;
  const readSubBlocks = () => {
    const parts: number[] = [];
    for (let n = u8(); n !== 0; n = u8()) {
      for (let i = 0; i < n; i++) parts.push(bytes[p++]);
    }
    return new Uint8Array(parts);
  };
  while (p < bytes.length) {
    const b = u8();
    if (b === 0x3b) {
      trailer = p === bytes.length;
      break;
    }
    if (b === 0x21) {
      const label = u8();
      if (label === 0xff) {
        const size = u8();
        const app = String.fromCharCode(...bytes.slice(p, p + size));
        p += size;
        const sub = readSubBlocks();
        if (app === 'NETSCAPE2.0' && sub[0] === 1) loop = sub[1] | (sub[2] << 8);
      } else if (label === 0xf9) {
        const sub = readSubBlocks();
        expect((sub[0] >> 2) & 7).toBe(1); // disposal «no descartar»
        delays.push(sub[1] | (sub[2] << 8));
      } else {
        readSubBlocks();
      }
      continue;
    }
    if (b === 0x2c) {
      descriptors++;
      const x = u16();
      const y = u16();
      const w = u16();
      const h = u16();
      const ipacked = u8();
      expect(ipacked & 0x80).toBe(0); // sin paleta local
      expect(x + w).toBeLessThanOrEqual(width);
      expect(y + h).toBeLessThanOrEqual(height);
      const minCode = u8();
      const idx = lzwDecode(readSubBlocks(), minCode, w * h);
      for (let yy = 0; yy < h; yy++) {
        for (let xx = 0; xx < w; xx++) {
          const c = idx[yy * w + xx];
          const o = ((y + yy) * width + (x + xx)) * 3;
          canvas[o] = palette[c * 3];
          canvas[o + 1] = palette[c * 3 + 1];
          canvas[o + 2] = palette[c * 3 + 2];
        }
      }
      composites.push(canvas.slice());
      continue;
    }
    throw new Error(`bloque desconocido 0x${b.toString(16)} en ${p - 1}`);
  }
  return { width, height, palette, loop, descriptors, delays, composites, trailer };
}

// ─── Cuadros sintéticos ─────────────────────────────────────────────────────

const GREEN = [26, 97, 24];
const WHITE = [255, 255, 255];
const YELLOW = [234, 179, 8];
const DARK = [17, 24, 39];

function synthFrame(w: number, h: number, paint: (x: number, y: number) => number[]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = paint(x, y);
      d.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
    }
  }
  return d;
}

function rgbOf(rgba: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array((rgba.length / 4) * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) out.set([rgba[i], rgba[i + 1], rgba[i + 2]], j);
  return out;
}

const W = 37;
const H = 23;
const playerAt = (px: number) => (x: number, y: number) =>
  x >= px && x < px + 5 && y >= 8 && y < 13 ? YELLOW : (x + y) % 11 === 0 ? WHITE : y === 0 ? DARK : GREEN;

describe('gifEncoder', () => {
  it('produce un GIF89a válido: cabecera, descriptor lógico, loop, N cuadros, trailer', () => {
    const frames = [0, 10, 20].map((px) => ({ rgba: synthFrame(W, H, playerAt(px)), delayMs: 100 }));
    const bytes = encodeGif(W, H, frames);

    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe('GIF89a');
    expect(bytes[6] | (bytes[7] << 8)).toBe(W);
    expect(bytes[8] | (bytes[9] << 8)).toBe(H);
    expect(bytes[bytes.length - 1]).toBe(0x3b);
    // NETSCAPE2.0 justo después de la paleta global (13 + 768).
    expect(String.fromCharCode(...bytes.slice(13 + 768 + 3, 13 + 768 + 14))).toBe('NETSCAPE2.0');

    const gif = decodeGif(bytes);
    expect(gif.trailer).toBe(true);
    expect(gif.loop).toBe(0); // infinito
    expect(gif.descriptors).toBe(3);
    expect(gif.delays).toEqual([10, 10, 10]);
  });

  it('los píxeles decodificados coinciden con los cuadros sintéticos (pocos colores → exactos)', () => {
    const rgbas = [0, 10, 20, 31].map((px) => synthFrame(W, H, playerAt(px)));
    const gif = decodeGif(encodeGif(W, H, rgbas.map((rgba) => ({ rgba, delayMs: 80 }))));
    expect(gif.composites).toHaveLength(4);
    rgbas.forEach((rgba, i) => expect(gif.composites[i]).toEqual(rgbOf(rgba)));
  });

  it('los cuadros siguientes solo guardan el rectángulo que cambió', () => {
    const a = synthFrame(W, H, playerAt(0));
    const b = synthFrame(W, H, playerAt(3));
    const idx = (rgba: Uint8ClampedArray) => {
      const pal = buildPalette([a, b]);
      const out = new Uint8Array(W * H);
      for (let i = 0; i < out.length; i++) {
        let best = 0;
        let bd = Infinity;
        for (let c = 0; c < 256; c++) {
          const d = Math.abs(pal[c * 3] - rgba[i * 4]) + Math.abs(pal[c * 3 + 1] - rgba[i * 4 + 1]) + Math.abs(pal[c * 3 + 2] - rgba[i * 4 + 2]);
          if (d < bd) {
            bd = d;
            best = c;
          }
        }
        out[i] = best;
      }
      return out;
    };
    expect(diffRect(idx(a), idx(b), W, H)).toEqual({ x: 0, y: 8, w: 8, h: 5 });
    expect(diffRect(idx(a), idx(a), W, H)).toBeNull();
  });

  it('un cuadro igual al anterior no se escribe: su tiempo se suma al delay', () => {
    const a = synthFrame(W, H, playerAt(0));
    const b = synthFrame(W, H, playerAt(9));
    const gif = decodeGif(
      encodeGif(W, H, [
        { rgba: a, delayMs: 600 },
        { rgba: a, delayMs: 100 },
        { rgba: b, delayMs: 100 },
        { rgba: b, delayMs: 1200 },
      ]),
    );
    expect(gif.descriptors).toBe(2);
    expect(gif.delays).toEqual([70, 130]);
  });

  it('LZW: ida y vuelta con más de 4096 códigos (fuerza el clear de la tabla)', () => {
    const n = 30_000;
    const data = new Uint8Array(n);
    let s = 12345;
    for (let i = 0; i < n; i++) {
      s = (s * 1103515245 + 12345) >>> 0;
      data[i] = (s >>> 16) & 0xff;
    }
    expect(lzwDecode(lzwEncode(data, 8), 8, n)).toEqual(data);
    // Y con datos muy repetidos (como una cancha).
    const flat = new Uint8Array(n).map((_, i) => (i % 997 < 900 ? 3 : 7));
    const enc = lzwEncode(flat, 8);
    expect(enc.length).toBeLessThan(n / 20);
    expect(lzwDecode(enc, 8, n)).toEqual(flat);
  });

  it('con más de 256 colores (degradé) la paleta sigue siendo de 256 y el error es acotado', () => {
    const w = 64;
    const h = 64;
    const rgba = synthFrame(w, h, (x, y) => [x * 4, y * 4, (x + y) * 2]);
    const pal = new ColorHistogram();
    pal.add(rgba);
    expect(pal.palette().length).toBe(768);
    const gif = decodeGif(encodeGif(w, h, [{ rgba, delayMs: 100 }]));
    const rgb = rgbOf(rgba);
    let maxErr = 0;
    for (let i = 0; i < rgb.length; i++) maxErr = Math.max(maxErr, Math.abs(rgb[i] - gif.composites[0][i]));
    expect(maxErr).toBeLessThan(40);
  });

  it('GifWriter rechaza un cuadro con tamaño inconsistente', () => {
    const wtr = new GifWriter(4, 4, new Uint8Array(768));
    expect(() => wtr.addFrame({ rect: { x: 0, y: 0, w: 4, h: 4 }, indices: new Uint8Array(3), delayCs: 10 })).toThrow();
  });
});

// ─── Selección de formato y exportación ────────────────────────────────────

const fr = (id: string, x: number): TacticalFrame => ({
  id,
  duration_ms: 1000,
  players: [{ key: 'slot:DC', x, y: 50 }],
  ball: null,
  arrows: [],
});

/** FileReader: el Blob de jsdom no tiene arrayBuffer() en todas las versiones. */
function bytesOf(b: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(b);
  });
}

describe('selección video / GIF', () => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  beforeEach(() => dispose.mockClear());
  afterEach(() => {
    vi.unstubAllGlobals();
    delete proto.captureStream;
  });

  it('sin MediaRecorder → GIF; con MediaRecorder + captureStream + codec → video', () => {
    expect(typeof (globalThis as { MediaRecorder?: unknown }).MediaRecorder).toBe('undefined');
    expect(canRecordVideo()).toBe(false);
    expect(pickAnimationKind()).toBe('gif');

    vi.stubGlobal('MediaRecorder', { isTypeSupported: (t: string) => t.startsWith('video/webm') });
    expect(pickAnimationKind()).toBe('gif'); // falta captureStream (WebView viejo)
    proto.captureStream = () => null;
    expect(pickAnimationKind()).toBe('video');

    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => false });
    expect(pickAnimationKind()).toBe('gif'); // MediaRecorder sin ningún codec (Safari viejo)

    // Entorno inyectado (sin tocar globales).
    expect(pickAnimationKind({ MediaRecorder: { isTypeSupported: () => true }, HTMLCanvasElement: { prototype: { captureStream() {} } } })).toBe('video');
    expect(pickAnimationKind({ HTMLCanvasElement: { prototype: { captureStream() {} } } })).toBe('gif');
  });

  it('el menú dice con palabras qué archivo va a salir', () => {
    expect(animationLabel('video')).toBe('Video de la jugada');
    expect(animationLabel('gif')).toBe('Animación GIF de la jugada');
  });

  it('gifSampleTimes: 10 fps, el último instante exacto y tope de cuadros', () => {
    const t = gifSampleTimes(1000, 10, 240);
    expect(t[0]).toBe(0);
    expect(t[t.length - 1]).toBe(1000);
    expect(t).toHaveLength(11);
    const long = gifSampleTimes(31_800, 10, 240);
    expect(long.length).toBeLessThanOrEqual(241);
    expect(long[long.length - 1]).toBe(31_800);
  });

  it('sin MediaRecorder exportAnimation hace un GIF válido de 3 cuadros y libera el canvas', async () => {
    const progress: number[] = [];
    const res = await exportAnimation({ frames: [fr('a', 10), fr('b', 50), fr('c', 90)], onProgress: (p) => progress.push(p) });
    expect(res.kind).toBe('gif');
    expect(res.ext).toBe('gif');
    expect(res.blob.type).toBe('image/gif');
    const gif = decodeGif(await bytesOf(res.blob));
    expect(gif.width).toBe(20);
    expect(gif.height).toBe(22);
    expect(gif.loop).toBe(0);
    expect(gif.descriptors).toBeGreaterThan(3);
    // Duración total ≈ pausa 600 + 2 s de jugada + pausa 1200 (+ un paso del último).
    const total = gif.delays.reduce((s, d) => s + d, 0) * 10;
    expect(total).toBeGreaterThanOrEqual(3800);
    expect(total).toBeLessThanOrEqual(4000);
    expect(progress[progress.length - 1]).toBe(1);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('con MediaRecorder pero sin captureStream el video cae al GIF', async () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => true });
    const res = await exportAnimation({ kind: 'video', frames: [fr('a', 10), fr('b', 90)] });
    expect(res.kind).toBe('gif');
    expect(res.blob.type).toBe('image/gif');
  });

  it('con 1 solo cuadro no hay video ni GIF (too_few_frames)', async () => {
    for (const kind of ['video', 'gif'] as const) {
      const err = await exportAnimation({ kind, frames: [fr('a', 10)] }).catch((e: unknown) => e);
      expect(isTacticalVideoUnsupported(err)).toBe(true);
      expect((err as { reason: string }).reason).toBe('too_few_frames');
    }
    const err = await exportGif({ frames: [] }).catch((e: unknown) => e);
    expect((err as { reason: string }).reason).toBe('too_few_frames');
    expect(dispose).not.toHaveBeenCalled();
  });

  it('cancelar a mitad libera el canvas y lanza AbortError', async () => {
    const ctrl = new AbortController();
    const p = exportGif({ frames: [fr('a', 10), fr('b', 90)], signal: ctrl.signal, onProgress: (x) => x > 0.2 && ctrl.abort() });
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

describe('compartir el GIF', () => {
  const realUA = navigator.userAgent;
  const nav = navigator as unknown as Record<string, unknown>;
  const setUA = (ua: string) => Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  afterEach(() => {
    setUA(realUA);
    delete nav.share;
    delete nav.canShare;
    saveAs.mockClear();
  });

  it('en celular con Web Share el GIF va como archivo image/gif', async () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)');
    const share = vi.fn(async (d: unknown) => void d);
    const canShare = vi.fn((d: { files: File[] }) => d.files[0].type === 'image/gif');
    Object.assign(navigator, { share, canShare });
    const gif = new Blob([encodeGif(2, 2, [{ rgba: new Uint8ClampedArray(16), delayMs: 100 }])], { type: 'image/gif' });
    expect(canShareFiles(gif, 'jugada.gif')).toBe(true);
    const res = await shareFile(gif, 'jugada.gif', 'Jugada: Rondo');
    expect(res.method).toBe('share');
    const files = (share.mock.calls[0][0] as { files: File[] }).files;
    expect(files[0].name).toBe('jugada.gif');
    expect(files[0].type).toBe('image/gif');
    expect(saveAs).not.toHaveBeenCalled();
  });

  it('en escritorio no ofrece compartir: descarga', async () => {
    setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    Object.assign(navigator, { share: vi.fn(), canShare: () => true });
    const gif = new Blob(['GIF89a'], { type: 'image/gif' });
    expect(canShareFiles(gif, 'j.gif')).toBe(false);
    expect((await shareFile(gif, 'j.gif', 't')).method).toBe('download');
    expect(saveAs).toHaveBeenCalledWith(gif, 'j.gif');
  });
});
