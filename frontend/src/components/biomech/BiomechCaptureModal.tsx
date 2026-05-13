/**
 * BiomechCaptureModal.tsx
 * Flujo: loading → ready → recording → processing → done | error
 * Requiere: npm install @mediapipe/tasks-vision
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Camera, CheckCircle2, AlertTriangle, Square, Activity, RefreshCw, Zap, Upload, Video } from 'lucide-react';
import { bffClient } from '@/lib/api/bffClient';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Landmark { x: number; y: number; z: number; visibility?: number; }
type Frame = Landmark[];

export interface BiomechCaptureResult {
  captureId:  string;
  analysisId: string;
  metrics:    Record<string, number>;
  flags:      Array<{ metric: string; severity: string }>;
}

export interface BiomechCaptureModalProps {
  open:           boolean;
  onClose:        () => void;
  onComplete:     (result: BiomechCaptureResult) => void;
  analyzerCode:   'hack_squat' | 'incline_press' | 'row';
  sessionPlanId?: string;
  enrollmentId?:  string;
  schoolId:       string;
  blockIndex?:    number;
}

type ModalState = 'loading' | 'ready' | 'recording' | 'processing' | 'done' | 'error';

// ── Constantes ────────────────────────────────────────────────────────────────
const MAX_RECORDING_SECONDS = 15;
const SAMPLE_EVERY_N_FRAMES = 3;

const ANALYZER_META: Record<string, { label: string; tip: string }> = {
  hack_squat:    { label: 'Sentadilla Hack',  tip: 'Posicionarte de frente a la cámara. Cuerpo completo visible — rodillas y pies incluidos.' },
  incline_press: { label: 'Press Inclinado',  tip: 'Posicionarte de lado a la cámara. Hombros, codos y muñecas deben estar visibles.' },
  row:           { label: 'Remo',             tip: 'Posicionarte de lado a la cámara. Hombros, caderas y codos deben estar visibles.' },
};

const KEY_LANDMARKS: Record<string, number[]> = {
  hack_squat:    [23, 24, 25, 26, 27, 28],
  incline_press: [11, 12, 13, 14, 15, 16],
  row:           [11, 12, 13, 14, 23, 24],
};

const SKELETON_CONNECTIONS = [
  [11,12],[11,13],[13,15],[12,14],[14,16],
  [11,23],[12,24],[23,24],
  [23,25],[24,26],[25,27],[26,28],
  [27,29],[28,30],[29,31],[30,32],
];

// ── Helpers geométricos ───────────────────────────────────────────────────────
function angleBetween(a: Landmark, b: Landmark, c: Landmark): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const mag = Math.sqrt(ba.x**2 + ba.y**2) * Math.sqrt(bc.x**2 + bc.y**2);
  if (mag === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);
}
function valgusAngle2D(hip: Landmark, knee: Landmark, ankle: Landmark): number {
  const v_ha = { x: ankle.x - hip.x, y: ankle.y - hip.y };
  const v_hk = { x: knee.x - hip.x, y: knee.y - hip.y };
  const dot = v_ha.x * v_hk.x + v_ha.y * v_hk.y;
  const mag = Math.sqrt(v_ha.x**2 + v_ha.y**2) * Math.sqrt(v_hk.x**2 + v_hk.y**2);
  if (mag === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);
}
function midpoint(a: Landmark, b: Landmark): Landmark {
  return { x: (a.x+b.x)/2, y: (a.y+b.y)/2, z: (a.z+b.z)/2 };
}
function round2(n: number): number { return Math.round(n * 100) / 100; }

// ── Métricas ──────────────────────────────────────────────────────────────────
function computeMetrics(frames: Frame[], code: string): Record<string, number> {
  if (frames.length < 3) return {};
  const m: Record<string, number> = {};

  if (code === 'hack_squat') {
    const lv = frames.map(f => valgusAngle2D(f[23], f[25], f[27]));
    const rv = frames.map(f => valgusAngle2D(f[24], f[26], f[28]));
    m.knee_valgus_angle = round2((lv.reduce((s,v)=>s+v,0)/lv.length + rv.reduce((s,v)=>s+v,0)/rv.length)/2);
    const sHipY = (frames[0][23].y + frames[0][24].y) / 2;
    const maxHipY = Math.max(...frames.map(f => (f[23].y + f[24].y) / 2));
    const ankleY  = (frames[0][27].y + frames[0][28].y) / 2;
    const range = ankleY - sHipY;
    m.squat_depth = round2(range > 0.01 ? Math.min(1, (maxHipY - sHipY) / range) : 0.5);
    const diffs = frames.map(f => Math.abs(f[23].y - f[24].y));
    m.hip_symmetry = round2(diffs.reduce((s,v)=>s+v,0) / diffs.length);
  }

  if (code === 'incline_press') {
    const le = frames.map(f => angleBetween(f[11], f[13], f[15]));
    const re = frames.map(f => angleBetween(f[12], f[14], f[16]));
    m.elbow_rom = round2(((Math.max(...le)-Math.min(...le)) + (Math.max(...re)-Math.min(...re))) / 2);
    const baseY = (frames[0][11].y + frames[0][12].y) / 2;
    const minY  = Math.min(...frames.map(f => (f[11].y + f[12].y) / 2));
    m.shoulder_compensation = round2(Math.max(0, (baseY - minY) * 90));
    const sym = frames.map((_,i) => Math.abs(le[i] - re[i]));
    m.bilateral_symmetry = round2(sym.reduce((s,v)=>s+v,0) / sym.length);
  }

  if (code === 'row') {
    const la = frames.map(f => angleBetween(midpoint(f[11],f[12]), midpoint(f[23],f[24]), midpoint(f[25],f[26])));
    m.lumbar_hyperextension = round2(Math.max(0, Math.max(...la) - 160));
    const ta = frames.map(f => { const h=midpoint(f[23],f[24]), s=midpoint(f[11],f[12]); return Math.abs(Math.atan2(s.x-h.x, h.y-s.y)*(180/Math.PI)); });
    m.torso_angle = round2(ta.reduce((s,v)=>s+v,0) / ta.length);
    const le2 = frames.map(f => angleBetween(f[11],f[13],f[15]));
    const re2 = frames.map(f => angleBetween(f[12],f[14],f[16]));
    m.pull_symmetry = round2(Math.abs((Math.max(...le2)-Math.min(...le2)) - (Math.max(...re2)-Math.min(...re2))));
  }

  return m;
}

// ── Componente ────────────────────────────────────────────────────────────────
export function BiomechCaptureModal({
  open, onClose, onComplete,
  analyzerCode, sessionPlanId, enrollmentId, schoolId, blockIndex,
}: BiomechCaptureModalProps) {
  const { toast } = useToast();

  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<any>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const rafRef        = useRef<number>(0);

  const recordedFrames = useRef<Frame[]>([]);
  const frameCountRef  = useRef(0);
  const recordingStart = useRef(0);
  const lastVideoTime  = useRef(-1);
  const isRecordingRef = useRef(false);

  const [modalState,   setModalState]   = useState<ModalState>('loading');
  const [countdown,    setCountdown]    = useState(MAX_RECORDING_SECONDS);
  const [finalMetrics, setFinalMetrics] = useState<Record<string, number>>({});
  const [finalFlags,   setFinalFlags]   = useState<BiomechCaptureResult['flags']>([]);
  const [errorMsg,     setErrorMsg]     = useState('');
  const [captureSource, setCaptureSource] = useState<'camera' | 'upload'>('camera');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [initKey, setInitKey] = useState(0);

  const meta = ANALYZER_META[analyzerCode] ?? { label: analyzerCode, tip: '' };

  const drawSkeleton = useCallback((ctx: CanvasRenderingContext2D, lms: Frame, w: number, h: number) => {
    const keyIdxs = KEY_LANDMARKS[analyzerCode] ?? [];
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,220,120,0.75)';
    for (const [a, b] of SKELETON_CONNECTIONS) {
      const lA = lms[a]; const lB = lms[b];
      if (!lA || !lB || (lA.visibility??1) < 0.3 || (lB.visibility??1) < 0.3) continue;
      ctx.beginPath(); ctx.moveTo((1-lA.x)*w, lA.y*h); ctx.lineTo((1-lB.x)*w, lB.y*h); ctx.stroke();
    }
    for (let i = 0; i < lms.length; i++) {
      const lm = lms[i];
      if (!lm || (lm.visibility??1) < 0.3) continue;
      const isKey = keyIdxs.includes(i);
      ctx.beginPath(); ctx.arc((1-lm.x)*w, lm.y*h, isKey ? 5 : 3, 0, 2*Math.PI);
      ctx.fillStyle = isKey ? '#00dc78' : 'rgba(255,255,255,0.45)'; ctx.fill();
      if (isKey) { ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1; ctx.stroke(); }
    }
  }, [analyzerCode]);

  const triggerStop = useCallback(() => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    recordingStart.current = 0;
    cancelAnimationFrame(rafRef.current);
    if (recordedFrames.current.length === 0) {
      setErrorMsg('No se detectó ninguna pose. Asegurate de estar completamente visible en la cámara.');
      setModalState('error');
      return;
    }
    setModalState('processing');
    setTimeout(() => processAndSend(), 50);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startDetectionLoop = useCallback(() => {
    const detect = () => {
      const video = videoRef.current, canvas = canvasRef.current, lm = landmarkerRef.current;
      if (!video || !canvas || !lm || video.readyState < 2) { rafRef.current = requestAnimationFrame(detect); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(detect); return; }
      canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
      const nowMs = performance.now();
      if (video.currentTime !== lastVideoTime.current) {
        lastVideoTime.current = video.currentTime;
        try {
          const result = lm.detectForVideo(video, nowMs);
          if (result.landmarks?.length > 0) {
            const landmarks: Frame = result.landmarks[0];
            drawSkeleton(ctx, landmarks, canvas.width, canvas.height);
            if (isRecordingRef.current) {
              frameCountRef.current++;
              if (frameCountRef.current % SAMPLE_EVERY_N_FRAMES === 0) recordedFrames.current.push([...landmarks]);
              const remaining = Math.max(0, MAX_RECORDING_SECONDS - (nowMs - recordingStart.current) / 1000);
              setCountdown(Math.ceil(remaining));
              if (remaining <= 0) triggerStop();
            }
          }
        } catch (_) { /* ignorar errores de frame */ }
      }
      rafRef.current = requestAnimationFrame(detect);
    };
    rafRef.current = requestAnimationFrame(detect);
  }, [drawSkeleton, triggerStop]);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    landmarkerRef.current?.close?.();
    streamRef.current = null; landmarkerRef.current = null;
    isRecordingRef.current = false; recordingStart.current = 0; lastVideoTime.current = -1;
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      if (cancelled) return;

      setModalState('loading'); setErrorMsg('');
      recordedFrames.current = []; frameCountRef.current = 0; isRecordingRef.current = false;

      try {
        // @ts-ignore
        const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
        );
        if (cancelled) return;

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          },
          runningMode: 'VIDEO', numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputSegmentationMasks: false,
        });

        if (cancelled) { landmarker.close(); return; }
        landmarkerRef.current = landmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (cancelled) return;
        setModalState('ready');
        startDetectionLoop();

      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(
            err?.name === 'NotAllowedError'
              ? 'Permiso de cámara denegado. Habilitalo en la configuración del navegador.'
              : (err?.message ?? 'No se pudo iniciar la cámara.'),
          );
          setModalState('error');
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      cleanup();
    };
  }, [open, initKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const processAndSend = async () => {
    try {
      const frames = recordedFrames.current;
      const metrics = computeMetrics(frames, analyzerCode);
      const fps = frames.length > 0 ? Math.round((frames.length / MAX_RECORDING_SECONDS) * SAMPLE_EVERY_N_FRAMES * 10) / 10 : 10;
      const captureRes: any = await bffClient.post('/api/v1/athlete/biomech/captures', { school_id: schoolId, session_plan_id: sessionPlanId??null, enrollment_id: enrollmentId??null, analyzer_code: analyzerCode, block_index: blockIndex??null, source: sessionPlanId ? 'session' : 'voluntary' });
      const captureId: string = captureRes.data?.id ?? captureRes.id;
      await bffClient.patch(`/api/v1/athlete/biomech/captures/${captureId}/keypoints`, { keypoints: frames, fps, duration_seconds: Math.round(frames.length * SAMPLE_EVERY_N_FRAMES / fps), quality_score: frames.length > 10 ? 0.8 : 0.5 });
      const analyzeRes: any = await bffClient.post(`/api/v1/athlete/biomech/captures/${captureId}/analyze`, { metrics, rep_count: Math.max(1, Math.round(frames.length / (fps / SAMPLE_EVERY_N_FRAMES * 2))), is_assessment: false });
      const analysis = analyzeRes.data ?? analyzeRes;
      setFinalMetrics(metrics); setFinalFlags(analysis.flags ?? []); setModalState('done');
      onComplete({ captureId, analysisId: analysis.id, metrics, flags: analysis.flags ?? [] });
      toast({ title: '¡Captura completada! 📊', description: `${meta.label} analizado correctamente.` });
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Error al procesar la captura.'); setModalState('error');
    }
  };

  const handleClose = () => { cleanup(); setModalState('loading'); setFinalMetrics({}); setFinalFlags([]); setErrorMsg(''); onClose(); };
  const handleStartRecording = () => { recordedFrames.current = []; frameCountRef.current = 0; isRecordingRef.current = true; recordingStart.current = performance.now(); setCountdown(MAX_RECORDING_SECONDS); setModalState('recording'); };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar que sea video
    if (!file.type.startsWith('video/')) {
      toast({ title: 'Archivo inválido', description: 'Solo se aceptan archivos de video.', variant: 'destructive' });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const video = videoRef.current;
    if (!video) return;

    // Cargar el video subido en el mismo elemento de video
    video.srcObject = null;
    video.src = objectUrl;
    video.currentTime = 0;

    video.onloadedmetadata = async () => {
      if (video.duration > MAX_RECORDING_SECONDS + 2) {
        toast({
          title:       'Video muy largo',
          description: `El video debe ser de máximo ${MAX_RECORDING_SECONDS} segundos. El tuyo dura ${Math.round(video.duration)}s.`,
          variant:     'destructive',
        });
        URL.revokeObjectURL(objectUrl);
        return;
      }

      // Procesar igual que la grabación en vivo
      recordedFrames.current  = [];
      frameCountRef.current   = 0;
      isRecordingRef.current  = true;
      recordingStart.current  = performance.now();
      setModalState('recording');
      await video.play();

      // Detener automáticamente cuando termine el video
      video.onended = () => {
        URL.revokeObjectURL(objectUrl);
        triggerStop();
      };
    };
  };
  const handleRetry = () => {
    cleanup();
    setModalState('loading');
    setInitKey(k => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-border/50 shadow-2xl bg-background">
        <DialogHeader className="px-6 pt-5 pb-4 border-b bg-primary/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-black tracking-tight leading-tight">Captura Biomecánica</DialogTitle>
              <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">{meta.label} · SportMaps Body</p>
            </div>
            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-primary/30 text-primary bg-primary/5 shrink-0">BETA</Badge>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Loading */}
          {modalState === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-bold text-base">Iniciando cámara</p>
                <p className="text-sm text-muted-foreground mt-1">Cargando modelo de detección de pose...</p>
              </div>
            </div>
          )}

          {/* Error */}
          {modalState === 'error' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <div className="text-center max-w-xs">
                <p className="font-bold text-base">Error</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{errorMsg}</p>
              </div>
              <Button onClick={handleRetry} variant="outline" className="gap-2 font-bold"><RefreshCw className="h-4 w-4" /> Reintentar</Button>
            </div>
          )}

          {/* Cámara */}
          <div
            className="space-y-4"
            style={{ display: ['ready','recording','processing'].includes(modalState) ? 'flex' : 'none', flexDirection: 'column' }}
          >
            {modalState === 'ready' && (
              <div className="space-y-3">
                {/* Toggle fuente */}
                <div className="flex rounded-xl border border-border/40 overflow-hidden p-0.5 bg-muted/20 gap-0.5">
                  <button
                    onClick={() => setCaptureSource('camera')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-colors ${
                      captureSource === 'camera'
                        ? 'bg-background shadow-sm text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Video className="h-3.5 w-3.5" />
                    Cámara en vivo
                  </button>
                  <button
                    onClick={() => setCaptureSource('upload')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-colors ${
                      captureSource === 'upload'
                        ? 'bg-background shadow-sm text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Subir video
                  </button>
                </div>

                {/* Tip de posición */}
                <div className="flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <Camera className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                    {captureSource === 'upload'
                      ? `Sube un video de máximo ${MAX_RECORDING_SECONDS}s. ${meta.tip}`
                      : meta.tip}
                  </p>
                </div>
              </div>
            )}
            <div className="relative rounded-2xl overflow-hidden bg-black border border-border/40 shadow-xl aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  position:   'absolute',
                  width:      1,
                  height:     1,
                  visibility: 'hidden',
                }}
              />
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain"
                style={{ position: 'relative', zIndex: 1 }}
              />
              {modalState === 'recording' && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 border-2 border-red-500/70 rounded-2xl animate-pulse" />
                  <div className="absolute top-3 right-3 h-10 w-10 rounded-full bg-black/70 border border-red-500/60 flex items-center justify-center">
                    <span className="text-white font-black text-sm">{countdown}</span>
                  </div>
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">REC</span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                    <div className="h-full bg-red-500 transition-all duration-1000 ease-linear" style={{ width: `${((MAX_RECORDING_SECONDS - countdown) / MAX_RECORDING_SECONDS) * 100}%` }} />
                  </div>
                </div>
              )}
              {modalState === 'processing' && (
                <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-3 rounded-2xl" style={{ zIndex: 10 }}>
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-white font-bold text-sm">Analizando movimiento...</p>
                  <p className="text-white/50 text-xs">Calculando métricas biomecánicas</p>
                </div>
              )}
            </div>
            {modalState === 'ready' && (
              <>
                {captureSource === 'camera' ? (
                  <Button
                    onClick={handleStartRecording}
                    className="w-full h-12 gap-2 font-black bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                  >
                    <Camera className="h-5 w-5" />
                    Iniciar captura · {MAX_RECORDING_SECONDS}s
                  </Button>
                ) : (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={handleVideoUpload}
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-12 gap-2 font-black bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                    >
                      <Upload className="h-5 w-5" />
                      Seleccionar video (máx {MAX_RECORDING_SECONDS}s)
                    </Button>
                  </>
                )}
              </>
            )}
            {modalState === 'recording' && (
              <Button onClick={triggerStop} variant="destructive" className="w-full h-12 gap-2 font-black">
                <Square className="h-4 w-4 fill-current" /> Detener grabación
              </Button>
            )}
          </div>

          {/* Done */}
          {modalState === 'done' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                <div>
                  <p className="font-bold text-sm">Captura completada</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Guardado correctamente. Tu coach puede revisar el análisis.</p>
                </div>
              </div>
              {finalFlags.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                  <p className="text-[10px] uppercase font-black tracking-widest text-amber-600 dark:text-amber-400">Puntos a mejorar</p>
                  {finalFlags.map((flag, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${flag.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                      <p className="text-xs font-medium capitalize">{flag.metric.replace(/_/g, ' ')}</p>
                      <Badge variant="outline" className={`ml-auto text-[9px] font-bold ${flag.severity === 'critical' ? 'border-red-500/30 text-red-500' : 'border-amber-500/30 text-amber-600'}`}>{flag.severity}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {Object.keys(finalMetrics).length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Métricas registradas</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(finalMetrics).map(([key, value]) => (
                      <div key={key} className="p-3 bg-muted/30 rounded-xl border border-border/30">
                        <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground truncate">{key.replace(/_/g, ' ')}</p>
                        <p className="font-black text-lg text-primary mt-0.5 leading-none">{value}<span className="text-xs font-normal text-muted-foreground ml-1">{key.includes('angle')||key.includes('extension')||key.includes('rom') ? '°' : ''}</span></p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground text-center px-2 leading-relaxed">⚠️ Métricas orientativas con cámara única (±5–10°). No reemplazan diagnóstico clínico.</p>
              <Button onClick={handleClose} className="w-full h-11 font-black gap-2"><Zap className="h-4 w-4" /> Listo</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
