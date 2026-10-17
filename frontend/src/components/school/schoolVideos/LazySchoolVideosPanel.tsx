/**
 * <SchoolVideosPanel> (M6h) cargado a pedido: la pestaña «Subir» del diálogo
 * «Videos» de la pizarra (M6c) lo monta solo cuando el coach la abre, así el
 * subidor reanudable y el reproductor de clips no viajan en el chunk de la
 * pizarra.
 */
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import type { SchoolVideosPanelProps } from './SchoolVideosDialog';

const Panel = lazy(() => import('./SchoolVideosDialog').then((m) => ({ default: m.SchoolVideosPanel })));

export function LazySchoolVideosPanel(props: SchoolVideosPanelProps) {
  return (
    <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>}>
      <Panel {...props} />
    </Suspense>
  );
}
