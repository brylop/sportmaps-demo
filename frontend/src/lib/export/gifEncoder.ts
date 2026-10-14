/**
 * Encoder GIF89a liviano y PURO (sin DOM, sin dependencias) para la animación
 * de la pizarra táctica cuando el navegador no graba video
 * (spec docs/specs/pizarra-nivel-tacticalpad.md §4 «Export de video»).
 *
 *  - Paleta GLOBAL de hasta 256 colores por median-cut sobre un histograma de
 *    5 bits por canal. La pizarra tiene pocos colores (cancha, jugadores,
 *    texto, flechas) y el antialias cae al color más cercano.
 *  - LZW de GIF (códigos de 3 a 12 bits, clear al llenar la tabla).
 *  - Cuadros por DIFERENCIA: cada cuadro solo guarda el rectángulo que cambió
 *    respecto al anterior (disposal 1 = «no descartar»). En una jugada solo se
 *    mueven los jugadores y el balón, así el archivo queda en unos pocos MB.
 *  - Cuadros idénticos al anterior no se escriben: su tiempo se suma al delay
 *    del anterior (las pausas del principio y del final salen gratis).
 *  - Loop infinito (extensión NETSCAPE2.0).
 */

export interface GifRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** RGBA de un cuadro completo (ImageData.data o equivalente). */
export type RgbaPixels = Uint8ClampedArray | Uint8Array;

// ─── Escritura de bytes ────────────────────────────────────────────────────

class ByteWriter {
  private buf: Uint8Array<ArrayBuffer> = new Uint8Array(1 << 16);
  length = 0;

  private ensure(n: number) {
    if (this.length + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.length + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
  }

  byte(b: number) {
    this.ensure(1);
    this.buf[this.length++] = b & 0xff;
  }

  u16(v: number) {
    this.byte(v & 0xff);
    this.byte((v >> 8) & 0xff);
  }

  bytes(b: ArrayLike<number>) {
    this.ensure(b.length);
    this.buf.set(b, this.length);
    this.length += b.length;
  }

  ascii(s: string) {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }

  result(): Uint8Array<ArrayBuffer> {
    return this.buf.slice(0, this.length);
  }
}

// ─── Paleta ────────────────────────────────────────────────────────────────

const BINS = 1 << 15; // 5 bits por canal

const binOf = (r: number, g: number, b: number) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

/** Histograma acumulable de colores (5 bits por canal) con la suma real de cada canal. */
export class ColorHistogram {
  readonly count = new Float64Array(BINS);
  readonly sumR = new Float64Array(BINS);
  readonly sumG = new Float64Array(BINS);
  readonly sumB = new Float64Array(BINS);

  /** `stride` = cada cuántos píxeles mirar (1 = todos). */
  add(rgba: RgbaPixels, stride = 1) {
    const step = Math.max(1, Math.floor(stride)) * 4;
    for (let i = 0; i + 3 < rgba.length; i += step) {
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const k = binOf(r, g, b);
      this.count[k]++;
      this.sumR[k] += r;
      this.sumG[k] += g;
      this.sumB[k] += b;
    }
  }

  /**
   * Median-cut sobre los bins ocupados → paleta de 256 entradas (768 bytes RGB).
   * Las entradas sobrantes quedan en negro (no se usan).
   */
  palette(maxColors = 256): Uint8Array {
    const max = Math.min(256, Math.max(2, Math.floor(maxColors)));
    const bins: number[] = [];
    for (let k = 0; k < BINS; k++) if (this.count[k] > 0) bins.push(k);
    const out = new Uint8Array(256 * 3);
    if (!bins.length) return out;

    const avg = (k: number): [number, number, number] => {
      const c = this.count[k];
      return [this.sumR[k] / c, this.sumG[k] / c, this.sumB[k] / c];
    };
    const color = new Map<number, [number, number, number]>();
    for (const k of bins) color.set(k, avg(k));

    type Box = { items: number[]; weight: number };
    const boxOf = (items: number[]): Box => ({ items, weight: items.reduce((s, k) => s + this.count[k], 0) });
    const boxes: Box[] = [boxOf(bins)];

    const rangeOf = (box: Box) => {
      const lo = [255, 255, 255];
      const hi = [0, 0, 0];
      for (const k of box.items) {
        const c = color.get(k)!;
        for (let ch = 0; ch < 3; ch++) {
          if (c[ch] < lo[ch]) lo[ch] = c[ch];
          if (c[ch] > hi[ch]) hi[ch] = c[ch];
        }
      }
      const spans = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
      const ch = spans[0] >= spans[1] && spans[0] >= spans[2] ? 0 : spans[1] >= spans[2] ? 1 : 2;
      return { ch, span: spans[ch] };
    };

    while (boxes.length < max) {
      // Se parte la caja que más «error» acumula: rango × peso.
      let best = -1;
      let bestScore = 0;
      let bestCh = 0;
      boxes.forEach((box, i) => {
        if (box.items.length < 2) return;
        const { ch, span } = rangeOf(box);
        const score = span * Math.sqrt(box.weight);
        if (score > bestScore) {
          bestScore = score;
          best = i;
          bestCh = ch;
        }
      });
      if (best < 0) break;
      const box = boxes[best];
      const sorted = [...box.items].sort((a, b) => color.get(a)![bestCh] - color.get(b)![bestCh]);
      let acc = 0;
      let cut = 1;
      for (let i = 0; i < sorted.length - 1; i++) {
        acc += this.count[sorted[i]];
        cut = i + 1;
        if (acc >= box.weight / 2) break;
      }
      boxes.splice(best, 1, boxOf(sorted.slice(0, cut)), boxOf(sorted.slice(cut)));
    }

    boxes.forEach((box, i) => {
      let r = 0;
      let g = 0;
      let b = 0;
      for (const k of box.items) {
        r += this.sumR[k];
        g += this.sumG[k];
        b += this.sumB[k];
      }
      out[i * 3] = Math.round(r / box.weight);
      out[i * 3 + 1] = Math.round(g / box.weight);
      out[i * 3 + 2] = Math.round(b / box.weight);
    });
    // Cuántas entradas son reales: el resto se rellena con la última (nunca gana).
    for (let i = boxes.length; i < 256; i++) out.set(out.subarray((boxes.length - 1) * 3, boxes.length * 3), i * 3);
    return out;
  }
}

/** Paleta a partir de cuadros de muestra (atajo de ColorHistogram). */
export function buildPalette(samples: RgbaPixels[], maxColors = 256, stride = 1): Uint8Array {
  const h = new ColorHistogram();
  for (const s of samples) h.add(s, stride);
  return h.palette(maxColors);
}

/** Color → índice de la paleta más cercano, con caché por bin de 5 bits. */
export function createColorMapper(palette: Uint8Array): (r: number, g: number, b: number) => number {
  const cache = new Int16Array(BINS).fill(-1);
  const n = Math.floor(palette.length / 3);
  return (r, g, b) => {
    const k = binOf(r, g, b);
    const hit = cache[k];
    if (hit >= 0) return hit;
    // Centro del bin: así el resultado no depende de qué píxel llegó primero.
    const cr = ((r >> 3) << 3) | 4;
    const cg = ((g >> 3) << 3) | 4;
    const cb = ((b >> 3) << 3) | 4;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const dr = palette[i * 3] - cr;
      const dg = palette[i * 3 + 1] - cg;
      const db = palette[i * 3 + 2] - cb;
      const d = dr * dr * 3 + dg * dg * 4 + db * db * 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    cache[k] = best;
    return best;
  };
}

/** RGBA → índices de paleta (1 byte por píxel). */
export function indexPixels(rgba: RgbaPixels, map: (r: number, g: number, b: number) => number, out?: Uint8Array): Uint8Array {
  const n = rgba.length >> 2;
  const idx = out && out.length === n ? out : new Uint8Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) idx[p] = map(rgba[i], rgba[i + 1], rgba[i + 2]);
  return idx;
}

// ─── Diferencia entre cuadros ──────────────────────────────────────────────

/** Rectángulo mínimo donde `cur` difiere de `prev`, o null si son iguales. */
export function diffRect(prev: Uint8Array, cur: Uint8Array, width: number, height: number): GifRect | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let x0 = -1;
    for (let x = 0; x < width; x++) {
      if (prev[row + x] !== cur[row + x]) {
        x0 = x;
        break;
      }
    }
    if (x0 < 0) continue;
    let x1 = x0;
    for (let x = width - 1; x > x0; x--) {
      if (prev[row + x] !== cur[row + x]) {
        x1 = x;
        break;
      }
    }
    if (x0 < minX) minX = x0;
    if (x1 > maxX) maxX = x1;
    if (y < minY) minY = y;
    maxY = y;
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function cropIndices(idx: Uint8Array, width: number, rect: GifRect): Uint8Array {
  if (rect.x === 0 && rect.y === 0 && rect.w === width && idx.length === rect.w * rect.h) return idx.slice();
  const out = new Uint8Array(rect.w * rect.h);
  for (let y = 0; y < rect.h; y++) {
    const from = (rect.y + y) * width + rect.x;
    out.set(idx.subarray(from, from + rect.w), y * rect.w);
  }
  return out;
}

// ─── LZW ───────────────────────────────────────────────────────────────────

// Tabla de códigos con «generaciones»: un clear no recorre el millón de celdas.
let lzwCodes: Int16Array | null = null;
let lzwGens: Int32Array | null = null;
let lzwGen = 0;

/** Comprime índices con el LZW de GIF. Devuelve el flujo de bytes SIN partir en sub-bloques. */
export function lzwEncode(indices: ArrayLike<number>, minCodeSize = 8): Uint8Array<ArrayBuffer> {
  if (!lzwCodes || !lzwGens) {
    lzwCodes = new Int16Array(4096 << 8);
    lzwGens = new Int32Array(4096 << 8);
  }
  const codes = lzwCodes;
  const gens = lzwGens;
  const resetTable = () => {
    lzwGen++;
    if (lzwGen >= 0x7fffffff) {
      gens.fill(0);
      lzwGen = 1;
    }
  };

  const out = new ByteWriter();
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  let cur = 0;
  let curBits = 0;
  const emit = (code: number) => {
    cur |= code << curBits;
    curBits += codeSize;
    while (curBits >= 8) {
      out.byte(cur & 0xff);
      cur >>>= 8;
      curBits -= 8;
    }
  };

  resetTable();
  emit(clear);
  if (indices.length === 0) {
    emit(eoi);
    if (curBits > 0) out.byte(cur & 0xff);
    return out.result();
  }

  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    if (gens[key] === lzwGen) {
      prefix = codes[key];
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      resetTable();
      next = eoi + 1;
      codeSize = minCodeSize + 1;
    } else {
      if (next >= 1 << codeSize) codeSize++;
      codes[key] = next++;
      gens[key] = lzwGen;
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (curBits > 0) out.byte(cur & 0xff);
  return out.result();
}

// ─── Escritor GIF89a ───────────────────────────────────────────────────────

export interface GifFrameSpec {
  rect: GifRect;
  /** Índices del rectángulo (rect.w × rect.h). */
  indices: Uint8Array;
  /** Delay en centésimas de segundo. */
  delayCs: number;
}

/** Bajo nivel: cabecera + paleta global + loop, y cuadros ya indexados. */
export class GifWriter {
  private w = new ByteWriter();
  private done = false;
  frames = 0;

  constructor(readonly width: number, readonly height: number, palette: Uint8Array, opts: { loop?: number } = {}) {
    if (width < 1 || height < 1 || width > 0xffff || height > 0xffff) throw new Error('Tamaño de GIF inválido.');
    const w = this.w;
    w.ascii('GIF89a');
    w.u16(width);
    w.u16(height);
    // Paleta global de 256 entradas (bits 7), resolución de color 8 bits.
    w.byte(0x80 | (7 << 4) | 7);
    w.byte(0); // color de fondo
    w.byte(0); // aspecto
    const gct = new Uint8Array(768);
    gct.set(palette.subarray(0, 768));
    w.bytes(gct);
    // NETSCAPE2.0: repetir (0 = infinito).
    w.byte(0x21);
    w.byte(0xff);
    w.byte(0x0b);
    w.ascii('NETSCAPE2.0');
    w.byte(0x03);
    w.byte(0x01);
    w.u16(Math.max(0, Math.min(0xffff, opts.loop ?? 0)));
    w.byte(0x00);
  }

  addFrame({ rect, indices, delayCs }: GifFrameSpec) {
    if (this.done) throw new Error('El GIF ya está cerrado.');
    if (indices.length !== rect.w * rect.h) throw new Error('Cuadro de GIF con tamaño inconsistente.');
    const w = this.w;
    // Graphic Control Extension: disposal 1 (no descartar), sin transparencia.
    w.byte(0x21);
    w.byte(0xf9);
    w.byte(0x04);
    w.byte(1 << 2);
    w.u16(Math.max(0, Math.min(0xffff, Math.round(delayCs))));
    w.byte(0);
    w.byte(0);
    // Image Descriptor, sin paleta local ni entrelazado.
    w.byte(0x2c);
    w.u16(rect.x);
    w.u16(rect.y);
    w.u16(rect.w);
    w.u16(rect.h);
    w.byte(0);
    w.byte(8); // LZW minimum code size
    const data = lzwEncode(indices, 8);
    for (let i = 0; i < data.length; i += 255) {
      const n = Math.min(255, data.length - i);
      w.byte(n);
      w.bytes(data.subarray(i, i + n));
    }
    w.byte(0);
    this.frames++;
  }

  finish(): Uint8Array<ArrayBuffer> {
    if (!this.done) {
      this.w.byte(0x3b);
      this.done = true;
    }
    return this.w.result();
  }
}

/**
 * Alto nivel: recibe cuadros RGBA completos uno por uno, indexa, recorta a la
 * diferencia y fusiona los repetidos. Streaming: guarda solo el cuadro anterior.
 */
export class GifAnimator {
  private writer: GifWriter;
  private map: (r: number, g: number, b: number) => number;
  private prev: Uint8Array | null = null;
  private pending: { rect: GifRect; indices: Uint8Array; delayMs: number } | null = null;
  /** ms ya escritos (para redondear delays a centésimas sin acumular error). */
  private writtenMs = 0;
  private writtenCs = 0;

  constructor(readonly width: number, readonly height: number, palette: Uint8Array, opts: { loop?: number } = {}) {
    this.writer = new GifWriter(width, height, palette, opts);
    this.map = createColorMapper(palette);
  }

  get frameCount(): number {
    return this.writer.frames + (this.pending ? 1 : 0);
  }

  addFrame(rgba: RgbaPixels, delayMs: number) {
    if (rgba.length !== this.width * this.height * 4) throw new Error('Cuadro RGBA con tamaño inconsistente.');
    const idx = indexPixels(rgba, this.map);
    const delay = Math.max(0, delayMs);
    if (!this.prev) {
      this.pending = { rect: { x: 0, y: 0, w: this.width, h: this.height }, indices: idx, delayMs: delay };
      this.prev = idx;
      return;
    }
    const rect = diffRect(this.prev, idx, this.width, this.height);
    if (!rect) {
      // Igual al anterior: se alarga el anterior.
      if (this.pending) this.pending.delayMs += delay;
      return;
    }
    this.flush();
    this.pending = { rect, indices: cropIndices(idx, this.width, rect), delayMs: delay };
    this.prev = idx;
  }

  private flush() {
    if (!this.pending) return;
    const endMs = this.writtenMs + this.pending.delayMs;
    const endCs = Math.round(endMs / 10);
    // < 2 cs los navegadores lo suben a 10 cs: se pide al menos 2.
    const delayCs = Math.max(2, endCs - this.writtenCs);
    this.writer.addFrame({ rect: this.pending.rect, indices: this.pending.indices, delayCs });
    this.writtenMs = endMs;
    this.writtenCs += delayCs;
    this.pending = null;
  }

  finish(): Uint8Array<ArrayBuffer> {
    this.flush();
    this.prev = null;
    return this.writer.finish();
  }
}

/** Atajo: cuadros RGBA completos → GIF animado con paleta global calculada de todos. */
export function encodeGif(
  width: number,
  height: number,
  frames: { rgba: RgbaPixels; delayMs: number }[],
  opts: { loop?: number; maxColors?: number } = {},
): Uint8Array<ArrayBuffer> {
  if (!frames.length) throw new Error('El GIF necesita al menos un cuadro.');
  const palette = buildPalette(
    frames.map((f) => f.rgba),
    opts.maxColors ?? 256,
  );
  const anim = new GifAnimator(width, height, palette, { loop: opts.loop });
  for (const f of frames) anim.addFrame(f.rgba, f.delayMs);
  return anim.finish();
}
