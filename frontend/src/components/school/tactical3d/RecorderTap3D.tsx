/**
 * Toma de cada cuadro para el video del 3D (M6e). Mientras se graba, esta
 * capa toma el render (useFrame con prioridad 1): dibuja la escena y, en la
 * MISMA tarea, copia el canvas WebGL a un canvas 2D con «Powered by
 * SportMaps» encima. Se graba ese canvas 2D: el WebGL sin
 * preserveDrawingBuffer no entrega cuadros a captureStream en todos los
 * navegadores (SwiftShader no entrega ninguno), y copiarlo fuera de esta
 * tarea da un cuadro en blanco.
 */
import { useFrame, useThree } from '@react-three/fiber';

const TEXT = 'Powered by SportMaps';

export function RecorderTap3D({ target }: { target: HTMLCanvasElement }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    gl.render(scene, camera);
    const src = gl.domElement;
    const ctx = target.getContext('2d');
    if (!ctx || src.width === 0) return;
    ctx.drawImage(src, 0, 0, target.width, target.height);
    // Marca en la esquina inferior derecha.
    const h = Math.max(14, Math.round(target.height * 0.034));
    ctx.font = `700 ${h}px Helvetica, Arial, sans-serif`;
    const w = ctx.measureText(TEXT).width;
    const pad = Math.round(h * 0.6);
    const x = target.width - w - pad * 3;
    const y = target.height - h - pad * 3;
    ctx.fillStyle = 'rgba(2,6,23,0.6)';
    ctx.beginPath();
    ctx.roundRect?.(x - pad, y - pad, w + pad * 2, h + pad * 2, pad);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.fillText(TEXT, x, y + h * 0.08);
  }, 1);
  return null;
}
