import { useEffect, useMemo, useState } from 'react';
import { Loader2, IdCard, Download, ExternalLink, AlertCircle, Building, ShieldCheck, ShieldX, Clock, RotateCw, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AthleteIdCard, type CardData } from '@/components/cards/AthleteIdCard';
import { exportCardPng } from '@/lib/cards/cardExport';
import { pickCurrentCards, slugifyFileName } from '@/lib/cards/cardLayout';

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
  const { profile } = useAuth();
  const isAthlete = profile?.role === 'athlete';
  const [rows, setRows] = useState<MyCardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<CardData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFace, setPreviewFace] = useState<'front' | 'back'>('front');
  const [downloading, setDownloading] = useState(false);

  const publicCardOrigin = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/c`;
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Por escuela, y dentro de cada escuela solo el carnet vigente de cada atleta:
  // al reemitir, el anterior queda "Revocado" y antes salía como otra tarjeta
  // más, que el acudiente leía como "le quitaron el carnet a mi hijo".
  const groups = useMemo(() => {
    const map = new Map<string, { school_name: string; school_logo: string | null; rows: MyCardRow[] }>();
    for (const r of rows) {
      if (!map.has(r.school_id)) map.set(r.school_id, { school_name: r.school_name, school_logo: r.school_logo, rows: [] });
      map.get(r.school_id)!.rows.push(r);
    }
    return Array.from(map.entries()).map(([schoolId, g]) => ({
      schoolId,
      school_name: g.school_name,
      school_logo: g.school_logo,
      cards: pickCurrentCards(g.rows).sort((a, b) => a.card.athlete_name.localeCompare(b.card.athlete_name, 'es')),
    }));
  }, [rows]);

  async function openPreview(qrToken: string) {
    setPreviewToken(qrToken);
    setPreviewData(null);
    setPreviewFace('front');
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
    if (!previewData || !previewToken) return;
    setDownloading(true);
    try {
      await exportCardPng(
        { data: previewData, publicUrl: `${publicCardOrigin}/${previewToken}` },
        `carnet-${slugifyFileName(previewData.athlete?.full_name, previewToken.slice(0, 8))}`,
      );
    } catch (e: any) {
      toast({ title: 'No se pudo descargar', description: e?.message || 'Error', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  }

  const title = isAthlete ? 'Mis carnets' : 'Carnets de mis hijos';

  return (
    <div className="container mx-auto px-4 py-6 sm:p-6 space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <IdCard className="h-7 w-7 text-primary shrink-0" />
          {title}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isAthlete
            ? 'Tus carnets digitales deportivos, con la marca de cada escuela donde entrenas.'
            : 'El carnet vigente de cada uno de tus hijos, con la marca de su escuela. Tócalo para verlo, voltearlo o descargarlo.'}
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
              {isAthlete
                ? 'Tu escuela aún no te emite el carnet. Contáctala si necesitas uno.'
                : 'La escuela debe emitir el carnet de tu hijo/a. Contáctala si necesitas uno.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <Card key={group.schoolId}>
              <CardHeader className="flex flex-row items-center gap-3 pb-3 space-y-0 px-3 sm:px-6">
                {group.school_logo ? (
                  <img src={group.school_logo} alt="" className="h-10 w-10 rounded-lg object-contain bg-white p-1 shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <CardTitle className="text-lg break-words">{group.school_name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{group.cards.length} carnet{group.cards.length !== 1 ? 's' : ''}</p>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 px-3 pb-3 sm:px-6 sm:pb-6">
                {group.cards.map(({ card: c, revokedCount }) => {
                  const effectiveStatus: 'active' | 'revoked' | 'expired' =
                    c.status === 'revoked' ? 'revoked' :
                    c.is_expired           ? 'expired' : 'active';
                  const sb = STATUS_BADGE[effectiveStatus];
                  const StatusIcon = sb.icon;
                  return (
                    <button
                      type="button"
                      key={c.card_id}
                      className="text-left border rounded-lg p-3 sm:p-4 hover:border-primary transition flex gap-3 items-start w-full"
                      onClick={() => openPreview(c.qr_token)}
                    >
                      {c.athlete_photo ? (
                        <img src={c.athlete_photo} alt="" className="h-14 w-14 sm:h-16 sm:w-16 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                          <IdCard className="h-6 w-6" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {/* Sin truncate: en celular los nombres compuestos se cortaban. */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="font-bold leading-tight break-words">{c.athlete_name}</p>
                          <Badge className={`${sb.cls} gap-1 text-xs`}>
                            <StatusIcon className="h-3 w-3" /> {sb.label}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                          {c.team_name && <p className="break-words">Equipo: {c.team_name}</p>}
                          {c.branch_name && <p className="break-words">Sede: {c.branch_name}</p>}
                          <p>Vence: {new Date(c.valid_until).toLocaleDateString('es-CO')}{c.version > 1 ? ` · versión ${c.version}` : ''}</p>
                          {c.relation === 'self' && <Badge variant="outline" className="text-xs mt-1">Tu carnet</Badge>}
                          {revokedCount > 0 && (
                            <p className="flex items-center gap-1 pt-0.5">
                              <Info className="h-3 w-3 shrink-0" />
                              {revokedCount === 1 ? 'Carnet anterior revocado (reemplazado por este).' : `${revokedCount} carnets anteriores revocados.`}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Carnet deportivo</DialogTitle>
            <DialogDescription>
              Presenta este QR en la escuela. La validación es en tiempo real.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            {!previewData ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <AthleteIdCard
                data={previewData}
                face={previewFace}
                publicUrl={`${publicCardOrigin}/${previewToken}`}
              />
            )}
            {previewData?.status === 'active' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewFace((f) => (f === 'front' ? 'back' : 'front'))}
                className="gap-1"
              >
                <RotateCw className="h-3.5 w-3.5" />
                {previewFace === 'front' ? 'Ver reverso' : 'Ver frente'}
              </Button>
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
              Abrir enlace público
            </Button>
            <Button onClick={downloadPreview} disabled={downloading || previewData?.status !== 'active'} className="gap-1">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar PNG
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
