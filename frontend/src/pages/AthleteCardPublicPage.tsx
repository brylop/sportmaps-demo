import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AthleteIdCard, type CardData } from '@/components/cards/AthleteIdCard';
import { useToast } from '@/hooks/use-toast';

export default function AthleteCardPublicPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const cardRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!qrToken) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrToken]);

  async function load() {
    setLoading(true);
    const { data: rpc, error } = await supabase.rpc(
      'verify_athlete_id_card_public' as any,
      { p_qr_token: qrToken }
    );
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setData({ found: false, status: 'error' } as CardData);
    } else {
      setData(rpc as CardData);
    }
    setLoading(false);
  }

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
        logging: false,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `carnet-${qrToken?.slice(0, 8)}.png`;
      a.click();
    } catch (e: any) {
      toast({ title: 'No se pudo descargar', description: e?.message || 'Error', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || !data.found) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-3" />
        <h1 className="text-xl font-bold text-gray-800 mb-1">Carnet no encontrado</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          El código escaneado no corresponde a un carnet válido. Si crees que es un error,
          contacta a tu escuela.
        </p>
      </div>
    );
  }

  const publicUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 gap-6">
      <div className="text-center">
        <h1 className="text-lg font-bold text-gray-800">Carnet verificado</h1>
        <p className="text-xs text-muted-foreground">
          Verificación oficial de {data.school?.name}
        </p>
      </div>

      <AthleteIdCard ref={cardRef} data={data} publicUrl={publicUrl} />

      {data.status === 'active' && (
        <Button
          onClick={handleDownload}
          disabled={downloading}
          variant="outline"
          className="gap-2"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Descargar PNG
        </Button>
      )}

      {data.status === 'active' && data.fee_status === 'overdue' && (
        <div className="max-w-sm bg-red-50 border border-red-200 rounded-lg p-3 text-center text-sm text-red-700">
          <strong>Cuota vencida.</strong> Realiza tu próximo pago para mantener el carnet vigente.
        </div>
      )}
    </div>
  );
}
