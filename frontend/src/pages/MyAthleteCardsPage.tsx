import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, IdCard, Download, ExternalLink, AlertCircle, Building, ShieldCheck, ShieldX, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AthleteIdCard, type CardData } from '@/components/cards/AthleteIdCard';

type MyCardRow = {
  card_id: string;
  qr_token: string;
  status: 'active' | 'revoked' | 'expired' | string;
  issued_at: string;
  valid_until: string;
  version: number;
  school_id: string;
  school_name: string;
  school_slug: string | null;
  school_logo: string | null;
  school_branding: any;
  athlete_kind: 'child' | 'profile';
  athlete_id: string;
  athlete_name: string;
  athlete_photo: string | null;
  team_name: string | null;
  branch_name: string | null;
  is_expired: boolean;
  relation: 'self' | 'parent' | 'unknown';
};

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: typeof ShieldCheck }> = {
  active:  { label: 'Vigente',   cls: 'bg-green-100 text-green-700',   icon: ShieldCheck },
  revoked: { label: 'Revocado',  cls: 'bg-gray-200 text-gray-700',     icon: ShieldX },
  expired: { label: 'Vencido',   cls: 'bg-red-100 text-red-700',       icon: Clock },
};

export default function MyAthleteCardsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<MyCardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<CardData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const publicCardOrigin = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/c`;
  }, []);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc('my_athlete_id_cards' as any);
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setRows([]);
      return;
    }
    setRows((data as MyCardRow[]) || []);
  }

  // Agrupar por escuela
  const groups = useMemo(() => {
    const map = new Map<string, { school_name: string; school_logo: string | null; cards: MyCardRow[] }>();
    for (const r of rows) {
      const key = r.school_id;
      if (!map.has(key)) {
        map.set(key, { school_name: r.school_name, school_logo: r.school_logo, cards: [] });
      }
      map.get(key)!.cards.push(r);
    }
    return Array.from(map.entries());
  }, [rows]);

  async function openPreview(qrToken: string) {
    setPreviewToken(qrToken);
    setPreviewData(null);
    setPreviewOpen(true);
    const { data, error } = await supabase.rpc('verify_athlete_id_card_public' as any, {
      p_qr_token: qrToken,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setPreviewData(data as CardData);
  }

  async function downloadPreview() {
    if (!previewRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
        logging: false,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `carnet-${previewToken?.slice(0, 8)}.png`;
      a.click();
    } catch (e: any) {
      toast({ title: 'No se pudo descargar', description: e?.message || 'Error', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <IdCard className="h-7 w-7 text-primary" />
          Mis carnets
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Carnets digitales de los atletas a tu cargo. Cada uno con el branding de su escuela.
        </p>
      </header>

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center text-muted-foreground gap-3">
            <AlertCircle className="h-10 w-10" />
            <p className="font-medium">Aún no tienes carnets emitidos</p>
            <p className="text-sm max-w-md">
              La escuela debe emitir el carnet de tu hijo/a. Contáctala si necesitas uno.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([schoolId, group]) => (
            <Card key={schoolId}>
              <CardHeader className="flex flex-row items-center gap-3 pb-3">
                {group.school_logo ? (
                  <img src={group.school_logo} alt="" className="h-10 w-10 rounded-lg object-contain bg-white p-1" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-lg">{group.school_name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{group.cards.length} carnet{group.cards.length !== 1 ? 's' : ''}</p>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.cards.map((c) => {
                  const effectiveStatus: 'active' | 'revoked' | 'expired' =
                    c.status === 'revoked' ? 'revoked' :
                    c.is_expired           ? 'expired' : 'active';
                  const sb = STATUS_BADGE[effectiveStatus];
                  const StatusIcon = sb.icon;
                  return (
                    <div key={c.card_id} className="border rounded-lg p-4 hover:border-primary transition cursor-pointer flex gap-3"
                         onClick={() => openPreview(c.qr_token)}>
                      {c.athlete_photo ? (
                        <img src={c.athlete_photo} alt="" className="h-16 w-16 rounded-lg object-cover" />
                      ) : (
                        <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                          <IdCard className="h-6 w-6" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{c.athlete_name}</p>
                        <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                          {c.team_name && <p>Equipo: {c.team_name}</p>}
                          {c.branch_name && <p>Sede: {c.branch_name}</p>}
                          <p>Vence: {new Date(c.valid_until).toLocaleDateString('es-CO')}</p>
                          {c.relation === 'self' && <Badge variant="outline" className="text-[9px] mt-1">Tu carnet</Badge>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={`${sb.cls} gap-1 text-[10px]`}>
                          <StatusIcon className="h-3 w-3" /> {sb.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">v{c.version}</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vista previa del carnet</DialogTitle>
            <DialogDescription>
              Usa este QR para presentar el carnet en la escuela. La validación es en tiempo real.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {!previewData ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <AthleteIdCard
                ref={previewRef}
                data={previewData}
                publicUrl={`${publicCardOrigin}/${previewToken}`}
              />
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => previewToken && window.open(`/c/${previewToken}`, '_blank')}
              className="gap-1"
              disabled={!previewToken}
            >
              <ExternalLink className="h-4 w-4" />
              Abrir público
            </Button>
            <Button onClick={downloadPreview} disabled={downloading || !previewData} className="gap-1">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar PNG
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
