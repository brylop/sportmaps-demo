/**
 * Diálogo «Videos» de la pizarra (M6h fase 1): «Subir video», «Importar de
 * Veo / Hudl…» y «Videos de la escuela». Detrás del flag por escuela
 * (school_video_settings.enabled + proveedor configurado): apagado → «Disponible
 * pronto» y nada más se pide al BFF. Los ENLACES (YouTube, Veo, Hudl…) son de
 * M6c («Videos» de la jugada); acá solo se remite a ellos, sin duplicarlos.
 *
 * Para integrar con M6c: <SchoolVideosPanel> (abajo) se puede montar como
 * pestaña dentro de su PlayVideosDialog sin cambiar nada de esto.
 */
import { useEffect, useState } from 'react';
import { Clock3, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchVideoSettings, type VideoSettings, type VideoSource } from '@/lib/school/schoolVideos';
import { UploadVideoTab } from './UploadVideoTab';
import { ImportGuideTab } from './ImportGuideTab';
import { VideoLibraryTab } from './VideoLibraryTab';

export interface SchoolVideosPanelProps {
  teamId?: string | null;
  lineupId?: string | null;
  /** Puede subir/recortar (rol táctico). Sin esto solo ve. */
  canEdit: boolean;
}

export function ComingSoon() {
  return (
    <div className="rounded-md border border-dashed p-4 text-center" data-testid="videos-coming-soon">
      <Clock3 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-semibold">Disponible pronto</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Muy pronto podrás subir los videos del celular o de Veo y recortar las jugadas aquí.
        Mientras tanto, pega el enlace del video en la pestaña «Enlaces».
      </p>
    </div>
  );
}

type Tab = 'upload' | 'import' | 'library';

export function SchoolVideosPanel({ teamId, lineupId, canEdit }: SchoolVideosPanelProps) {
  const [settings, setSettings] = useState<VideoSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(canEdit ? 'upload' : 'library');
  const [source, setSource] = useState<VideoSource>('phone');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchVideoSettings()
      .then((s) => { if (alive) setSettings(s); })
      // Sin BFF, sin ruta o sin permiso: se trata como apagado (nunca rompe la pizarra).
      .catch(() => { if (alive) setSettings(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const enabled = !!settings?.enabled;

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
      <TabsList className={`grid h-auto w-full ${canEdit ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {canEdit && <TabsTrigger value="upload" aria-label="Subir video" className="px-1 text-xs sm:text-sm">Subir<span className="hidden sm:inline">&nbsp;video</span></TabsTrigger>}
        <TabsTrigger value="import" aria-label="Importar de Veo, Hudl…" className="px-1 text-xs sm:text-sm">Importar<span className="hidden sm:inline">&nbsp;de Veo, Hudl…</span></TabsTrigger>
        <TabsTrigger value="library" aria-label="Videos de la escuela" className="px-1 text-xs sm:text-sm">Videos<span className="hidden sm:inline">&nbsp;de la escuela</span></TabsTrigger>
      </TabsList>
      {canEdit && (
        <TabsContent value="upload" className="mt-3">
          {enabled && settings
            ? <UploadVideoTab settings={settings} teamId={teamId} initialSource={source} onUploaded={() => setRefreshKey((k) => k + 1)} />
            : <ComingSoon />}
        </TabsContent>
      )}
      <TabsContent value="import" className="mt-3">
        <ImportGuideTab onUpload={enabled && canEdit ? (s) => { setSource(s); setTab('upload'); } : null} />
      </TabsContent>
      <TabsContent value="library" className="mt-3">
        {enabled ? <VideoLibraryTab teamId={teamId} lineupId={lineupId} canEdit={canEdit} refreshKey={refreshKey} /> : <ComingSoon />}
      </TabsContent>
    </Tabs>
  );
}

export interface SchoolVideosDialogProps extends SchoolVideosPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SchoolVideosDialog({ open, onOpenChange, ...panel }: SchoolVideosDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Videos del partido y del entreno</DialogTitle>
          <DialogDescription>
            Sube lo que grabaste con el celular o descargaste de Veo, Hudl o tu cámara, y recorta clips para esta jugada. Solo lo ve el cuerpo técnico.
          </DialogDescription>
        </DialogHeader>
        {open && <SchoolVideosPanel {...panel} />}
      </DialogContent>
    </Dialog>
  );
}
