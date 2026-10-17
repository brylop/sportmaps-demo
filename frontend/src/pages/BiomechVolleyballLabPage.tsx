/**
 * BiomechVolleyballLabPage — piloto de análisis de saque y remate de voleibol (Fase 1).
 *
 * Para mostrárselo al entrenador con videos reales. NO persiste nada: el video se procesa en el
 * dispositivo y se descarta; el resultado vive solo en pantalla (cumple G-IMAGEN, ver ROADMAP).
 * Sin enlace en el menú a propósito: se entra por /coach/voleibol-pose mientras dura el piloto.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, ShieldCheck } from 'lucide-react';
import { BiomechCaptureModal } from '@/components/biomech/BiomechCaptureModal';
import type { VolleyballAnalyzerCode } from '@/lib/biomech/volleyball';

const OPTIONS: Array<{ code: VolleyballAnalyzerCode; title: string; desc: string }> = [
  { code: 'volleyball_spike', title: 'Remate', desc: 'Ángulo del codo y extensión del brazo en el contacto, y altura de salto.' },
  { code: 'volleyball_serve', title: 'Saque', desc: 'Ángulo del codo y extensión del brazo en el contacto; altura de salto si es saque en salto.' },
];

export default function BiomechVolleyballLabPage() {
  const [open, setOpen] = useState<VolleyballAnalyzerCode | null>(null);

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-black tracking-tight">Técnica de voleibol por video</h1>
          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest">Piloto</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Sube un video corto (hasta 15 s) o grábalo con el celular. La IA ubica las articulaciones y mide el gesto.
        </p>
      </div>

      <div className="flex items-start gap-2.5 p-3 rounded-xl border border-border/40 bg-muted/20">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <b>El video no sale de este dispositivo.</b> Se analiza aquí mismo y se descarta; no se guarda ni se sube a ningún servidor,
          y tampoco se guardan las métricas. Por eso se puede probar con deportistas menores sin pasar por el consentimiento de imagen.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {OPTIONS.map(o => (
          <Card key={o.code}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{o.title}</CardTitle>
              <CardDescription className="text-xs">{o.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full font-bold" onClick={() => setOpen(o.code)}>Analizar {o.title.toLowerCase()}</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-xs text-muted-foreground space-y-1 leading-relaxed">
        <p className="font-bold text-foreground">Para que la medida sea buena</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>Cámara <b>fija</b> (trípode o apoyada), de lado, con el cuerpo completo y los pies visibles.</li>
          <li><b>60 fps o más.</b> A 30 fps el contacto y el salto pierden precisión; la pantalla lo avisa.</li>
          <li>Incluir la carrera, el despegue y el aterrizaje dentro del mismo video.</li>
          <li>No uses cámara lenta del iPhone: reescribe el tiempo del video y falsea el tiempo de vuelo.</li>
        </ul>
      </div>

      {open && (
        <BiomechCaptureModal
          open
          onClose={() => setOpen(null)}
          onComplete={() => {}}
          analyzerCode={open}
        />
      )}
    </div>
  );
}
