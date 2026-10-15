/**
 * Texturas del visor 3D, dibujadas en un <canvas> (nada de imágenes externas).
 *
 * La cancha NO se vuelve a dibujar acá: se serializa el MISMO fondo SVG de la
 * pizarra (CourtBackground) y se pinta en un canvas que se usa como textura
 * del piso. Así las líneas del 3D son exactamente las del 2D, sin duplicar
 * una sola medida. Misma técnica que lib/export/tacticalImage.tsx.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { CourtBackground } from '@/components/school/courts/CourtBackground';
import { BOARD_H, BOARD_W, type TacticalSport } from '@/lib/school/tacticalSports';
import type { BallStyle } from '@/lib/school/tactical3d';

/** Lado mayor de la textura del piso, px. 2048 se ve nítido y entra en
 *  cualquier GPU de celular (el mínimo de WebGL2 es 2048). */
const COURT_TEXTURE_PX = 2048;

/** SVG del fondo de cancha listo para <img>: con xmlns y tamaño explícito. */
export function courtSvgMarkup(sport: TacticalSport, widthPx: number, heightPx: number): string {
  const raw = renderToStaticMarkup(<CourtBackground sport={sport} viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} />);
  return raw
    .replace(/^<svg /, `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" `)
    .replace(/ class="[^"]*"/, '');
}

export async function loadCourtTexture(sport: TacticalSport, maxTextureSize = COURT_TEXTURE_PX): Promise<THREE.CanvasTexture> {
  const side = Math.min(COURT_TEXTURE_PX, maxTextureSize);
  const h = side;
  const w = Math.round((side * BOARD_W) / BOARD_H);
  const markup = courtSvgMarkup(sport, w, h);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo dibujar la cancha en 3D.'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible.');
    ctx.drawImage(img, 0, 0, w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Cartel de un jugador: dorsal en un círculo del color del equipo + etiqueta. */
export function labelTexture(number: string | null, label: string, color: string, numberColor = '#ffffff'): { texture: THREE.CanvasTexture; aspect: number } {
  const canvas = document.createElement('canvas');
  const H = 96;
  const ctx = canvas.getContext('2d')!;
  const font = '700 40px Helvetica, Arial, sans-serif';
  ctx.font = font;
  const text = label.length > 18 ? `${label.slice(0, 17)}…` : label;
  const textW = text ? ctx.measureText(text).width : 0;
  const badge = number ? H : 0;
  const W = Math.ceil(Math.max(badge, badge + (text ? textW + 36 : 0)));
  canvas.width = Math.max(W, H);
  canvas.height = H;
  const c = canvas.getContext('2d')!;
  if (text) {
    c.fillStyle = 'rgba(15,23,42,0.78)';
    roundRect(c, number ? H * 0.5 : 0, 14, canvas.width - (number ? H * 0.5 : 0), H - 28, (H - 28) / 2);
    c.fill();
    c.font = font;
    c.fillStyle = '#ffffff';
    c.textBaseline = 'middle';
    c.fillText(text, (number ? badge : 0) + 16, H / 2 + 2);
  }
  if (number) {
    c.beginPath();
    c.arc(H / 2, H / 2, H / 2 - 4, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
    c.lineWidth = 6;
    c.strokeStyle = '#ffffff';
    c.stroke();
    c.font = '900 46px Helvetica, Arial, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 5;
    c.strokeStyle = numberColor === '#ffffff' ? '#0f172a' : (parseInt(numberColor.slice(1, 3), 16) > 140 ? '#0f172a' : '#ffffff');
    c.strokeText(number, H / 2, H / 2 + 3);
    c.fillStyle = numberColor;
    c.fillText(number, H / 2, H / 2 + 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, aspect: canvas.width / canvas.height };
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Balón por deporte (mapa equirectangular sobre una esfera). */
export function ballTexture(style: BallStyle): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const c = canvas.getContext('2d')!;
  if (style === 'basketball') {
    c.fillStyle = '#ea580c';
    c.fillRect(0, 0, 256, 128);
    c.strokeStyle = '#111827';
    c.lineWidth = 5;
    for (const x of [0, 64, 128, 192, 256]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 128); c.stroke(); }
    c.beginPath(); c.moveTo(0, 64); c.lineTo(256, 64); c.stroke();
  } else if (style === 'volleyball') {
    const bands = ['#facc15', '#1d4ed8', '#f8fafc'];
    for (let i = 0; i < 6; i++) { c.fillStyle = bands[i % 3]; c.fillRect(0, (i * 128) / 6, 256, 128 / 6 + 1); }
    c.strokeStyle = '#334155';
    c.lineWidth = 2;
    for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(0, (i * 128) / 6); c.lineTo(256, (i * 128) / 6); c.stroke(); }
  } else {
    c.fillStyle = style === 'handball' ? '#f8fafc' : '#fafafa';
    c.fillRect(0, 0, 256, 128);
    c.fillStyle = style === 'handball' ? '#2563eb' : '#111827';
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 6; i++) {
        const x = i * 43 + (row % 2) * 21 + 10;
        const y = 22 + row * 42;
        c.beginPath();
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
          const px = x + Math.cos(a) * 11;
          const py = y + Math.sin(a) * 11;
          if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.closePath();
        c.fill();
      }
    }
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
