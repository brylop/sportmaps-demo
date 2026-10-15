/**
 * Video del 3D (M6e): graba el canvas de three con la cámara elegida, con
 * canvas.captureStream + MediaRecorder. Mismo criterio de formato que el
 * video de la pizarra 2D (lib/export/tacticalAnimationFormat.ts): MP4 si el
 * navegador lo graba (WhatsApp lo abre en todos lados), si no WebM; sin
 * ninguno, el botón no se ofrece.
 */
import { canRecordVideo, pickVideoMime } from '@/lib/export/tacticalAnimationFormat';

export { canRecordVideo };

export interface Recording3D {
  stop(): Promise<{ blob: Blob; ext: 'mp4' | 'webm' }>;
  cancel(): void;
}

export function startRecording3D(canvas: HTMLCanvasElement, fps = 30): Recording3D {
  const MR = window.MediaRecorder;
  const pick = pickVideoMime((t) => MR.isTypeSupported(t));
  if (!pick || typeof canvas.captureStream !== 'function') throw new Error('Este navegador no graba video del 3D.');
  // Un canvas que no está en la página no le entrega cuadros al grabador MP4
  // de Chromium (medido: 0 bytes; WebM sí graba). Va en la página, fuera de vista.
  let attached = false;
  if (!canvas.isConnected) {
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none';
    document.body.appendChild(canvas);
    attached = true;
  }
  const stream = canvas.captureStream(fps);
  const rec = new MR(stream, { mimeType: pick.mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  rec.start(250);
  const end = () => {
    stream.getTracks().forEach((t) => t.stop());
    if (attached) canvas.remove();
  };
  return {
    stop: () => new Promise((resolve, reject) => {
      rec.onstop = () => {
        end();
        const blob = new Blob(chunks, { type: pick.mime.split(';')[0] });
        if (blob.size === 0) reject(new Error('El video salió vacío.'));
        else resolve({ blob, ext: pick.ext });
      };
      try { rec.stop(); } catch (e) { end(); reject(e); }
    }),
    cancel: () => { try { rec.stop(); } catch { /* ya parado */ } end(); },
  };
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
