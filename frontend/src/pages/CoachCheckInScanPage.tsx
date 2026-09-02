import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { bffClient, BFFError } from '@/lib/api/bffClient';
import { ChevronLeft, ScanLine, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { type CheckInResponse, type Tone, resolveOutcomeInfo, MARKED_PRESENT } from '@/lib/attendanceCheckInOutcomes';

// ── Fase 4 — docs/specs/asistencia-rapida-checkin.md §3.2 ────────────────────
// Escáner in-app del carnet: el coach apunta la cámara a cada carnet en fila,
// sin salir de esta pantalla. Cada escaneo llama a POST /checkin-by-card, que
// resuelve el atleta por qr_token y usa el mismo resolver que el torniquete
// (checkInPresenceFromEvent) — nunca un INSERT simplificado.
//
// @capacitor/barcode-scanner ya trae implementación web (html5-qrcode), así
// que esto también corre en un navegador de escritorio para probar, no solo
// en el build nativo.

/** El QR codifica `${origin}/c/<token>`. Si algún día llega distinto, cae al
 *  primer UUID que encuentre en el texto escaneado, o al texto crudo. */
function extractQrToken(scanned: string): string | null {
  try {
    const url = new URL(scanned);
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('c');
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  } catch {
    // no era una URL — sigue con el fallback de abajo
  }
  const uuid = scanned.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return uuid ? uuid[0] : (scanned || null);
}

export default function CoachCheckInScanPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [tally, setTally] = useState({ ok: 0, total: 0 });
  const [last, setLast] = useState<{ athleteName: string; info: { label: string; tone: Tone } } | null>(null);

  async function scanOnce() {
    setScanning(true);
    try {
      // Import diferido: el bundle web de este paquete (html5-qrcode) pisaba
      // el singleton de React si se cargaba en el top-level de un chunk que
      // React todavía no había montado (recarga dura → "useEffect of null").
      const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } = await import('@capacitor/barcode-scanner');
      const { ScanResult } = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanInstructions: 'Apuntá al QR del carnet',
      });

      const token = extractQrToken(ScanResult);
      if (!token) {
        toast({ title: 'No se pudo leer el código', variant: 'destructive' });
        return;
      }

      const result = await bffClient.post<CheckInResponse>('/api/v1/attendance/checkin-by-card', { qrToken: token });
      const info = resolveOutcomeInfo(result.outcome);
      setLast({ athleteName: result.athleteName || 'Atleta', info });
      setTally((t) => ({ ok: t.ok + (MARKED_PRESENT.has(result.outcome) ? 1 : 0), total: t.total + 1 }));
    } catch (err: any) {
      // El usuario cerró la cámara sin escanear — no es un error real, no mostrar nada.
      if (err?.message?.toLowerCase().includes('cancel')) return;
      const msg = err instanceof BFFError ? err.message : (err?.message || 'No se pudo escanear.');
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  }

  const toneClasses: Record<Tone, string> = {
    ok:   'bg-green-500/10 border-green-500/30 text-green-700',
    warn: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700',
    err:  'bg-red-500/10 border-red-500/30 text-red-700',
  };
  const ToneIcon = last ? (last.info.tone === 'ok' ? CheckCircle2 : last.info.tone === 'warn' ? AlertTriangle : XCircle) : null;

  return (
    <div className="space-y-6 pb-24 sm:pb-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/coach-attendance')}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Check-in por carnet</h1>
          <p className="text-sm text-muted-foreground">Escaneá el QR del carnet de cada atleta</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-muted/30 p-6 flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <ScanLine className="w-9 h-9 text-primary" />
        </div>
        <Button size="lg" className="w-full max-w-xs h-14 text-base font-bold" onClick={scanOnce} disabled={scanning}>
          {scanning ? 'Escaneando…' : 'Escanear carnet'}
        </Button>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Se guarda al toque — no hace falta elegir equipo antes, el carnet ya sabe a qué equipo pertenece.
        </p>
      </div>

      {last && (
        <div className={`rounded-2xl border p-4 flex items-center gap-3 ${toneClasses[last.info.tone]}`}>
          {ToneIcon && <ToneIcon className="w-6 h-6 shrink-0" />}
          <div>
            <p className="font-bold text-sm">{last.athleteName}</p>
            <p className="text-xs opacity-90">{last.info.label}</p>
          </div>
        </div>
      )}

      {tally.total > 0 && (
        <div className="text-center">
          <p className="text-2xl font-black text-foreground">{tally.ok} / {tally.total}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">escaneados hoy</p>
        </div>
      )}
    </div>
  );
}
