import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, ShieldCheck, ShieldX, AlertCircle, FileCheck2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

type Verify = {
  found: boolean;
  folio?: string;
  kind?: string;
  title?: string;
  status?: 'issued' | 'revoked' | 'pending_review' | 'pending_payment';
  school_name?: string;
  athlete_name?: string;
  issued_at?: string | null;
  revoked_at?: string | null;
  revocation_reason?: string | null;
};

export default function CertificateVerifyPublicPage() {
  const { folio } = useParams<{ folio: string }>();
  const [data, setData] = useState<Verify | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!folio) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folio]);

  async function load() {
    setLoading(true);
    const { data: r, error } = await supabase.rpc('verify_athlete_certificate_public' as any, {
      p_folio: folio,
      p_qr_token: null,
    });
    setLoading(false);
    if (error || !r) {
      setData({ found: false });
      return;
    }
    setData(r as Verify);
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
        <h1 className="text-xl font-bold text-gray-800 mb-1">Constancia no encontrada</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          El folio {folio} no corresponde a una constancia válida.
        </p>
      </div>
    );
  }

  const isIssued = data.status === 'issued';
  const isRevoked = data.status === 'revoked';

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 text-center space-y-4">
          {isIssued && (
            <div className="flex flex-col items-center gap-2 text-green-700">
              <ShieldCheck className="h-14 w-14" />
              <h1 className="text-2xl font-bold">Constancia válida</h1>
            </div>
          )}
          {isRevoked && (
            <div className="flex flex-col items-center gap-2 text-red-700">
              <ShieldX className="h-14 w-14" />
              <h1 className="text-2xl font-bold">Constancia revocada</h1>
            </div>
          )}
          {!isIssued && !isRevoked && (
            <div className="flex flex-col items-center gap-2 text-amber-700">
              <FileCheck2 className="h-14 w-14" />
              <h1 className="text-2xl font-bold">Pendiente de emisión</h1>
            </div>
          )}

          <div className="border-t pt-4 space-y-2 text-left">
            <Row label="Folio" value={data.folio} />
            <Row label="Tipo" value={(data.kind || '').toUpperCase()} />
            <Row label="Atleta" value={data.athlete_name} />
            <Row label="Escuela" value={data.school_name} />
            {data.issued_at && (
              <Row label="Emitida" value={new Date(data.issued_at).toLocaleDateString('es-CO', { dateStyle: 'long' })} />
            )}
            {data.revoked_at && (
              <Row label="Revocada" value={new Date(data.revoked_at).toLocaleDateString('es-CO', { dateStyle: 'long' })} />
            )}
            {data.revocation_reason && (
              <Row label="Motivo" value={data.revocation_reason} />
            )}
          </div>

          <p className="text-xs text-muted-foreground pt-3 border-t">
            Verificación oficial · SportMaps
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || '—'}</span>
    </div>
  );
}
