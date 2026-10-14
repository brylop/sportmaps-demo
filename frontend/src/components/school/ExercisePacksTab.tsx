/**
 * Pestaña «Paquetes» de la Biblioteca de ejercicios (pizarra M2, D4 de
 * docs/specs/pizarra-multideporte-3d-ia.md).
 *
 *   · Tarjetas por paquete: deporte, cuántos ejercicios, estado y
 *     Activar / Desactivar (solo quien puede gestionar: `can_manage` del BFF).
 *   · «Exportar» descarga el paquete como .json (cualquiera del staff).
 *   · «Importar paquete»: elegir archivo → vista previa (el BFF valida TODO sin
 *     escribir: cuántos ejercicios y de qué deportes, o la lista de errores) →
 *     confirmar → resultado.
 *
 * Compatibilidad: sin ningún paquete activado la escuela ve todos los de sus
 * deportes (modo «todos»). Desactivar el último activado la devuelve a ese
 * modo; se avisa antes.
 */
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, FileUp, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EXERCISE_SPORT_LABEL, type ExerciseSport } from '@/lib/school/exerciseLibrary';
import {
  activateExercisePack,
  deactivateExercisePack,
  downloadPackFile,
  exportExercisePack,
  importExercisePack,
  listExercisePacks,
  previewPackImport,
  readPackFile,
  type ExercisePack,
  type PackImportResult,
  type PackPreview,
} from '@/lib/school/exercisePacks';

const sportLabel = (s: string | null | undefined) =>
  (s && EXERCISE_SPORT_LABEL[s as ExerciseSport]) || s || '—';
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const errMessage = (e: unknown) => (e instanceof Error && e.message ? e.message : 'No se pudo completar.');
const MAX_ERRORS_SHOWN = 8;

type ImportState =
  | { step: 'idle' }
  | { step: 'reading'; fileName: string }
  | { step: 'preview'; fileName: string; data: unknown; preview: PackPreview }
  | { step: 'importing'; fileName: string; preview: PackPreview }
  | { step: 'done'; result: PackImportResult }
  | { step: 'error'; message: string };

export function ExercisePacksTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imp, setImp] = useState<ImportState>({ step: 'idle' });
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['exercise-packs'],
    queryFn: listExercisePacks,
    staleTime: 30_000,
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['exercise-packs'] });
    qc.invalidateQueries({ queryKey: ['training-exercises'] });
  };

  const toggle = useMutation({
    mutationFn: ({ pack, activate }: { pack: ExercisePack; activate: boolean }) =>
      activate ? activateExercisePack(pack.id) : deactivateExercisePack(pack.id),
    onSuccess: (_r, { pack, activate }) => {
      setNotice(activate ? `«${pack.name}» activado.` : `«${pack.name}» desactivado.`);
      refreshAll();
    },
    onError: (e) => setNotice(errMessage(e)),
  });

  const exportPack = useMutation({
    mutationFn: (id: string) => exportExercisePack(id),
    onSuccess: (file) => setNotice(`Descargado: ${downloadPackFile(file)}`),
    onError: (e) => setNotice(errMessage(e)),
  });

  const onToggle = (pack: ExercisePack) => {
    const activate = !pack.activated;
    if (!activate && pack.is_system && data?.mode === 'seleccion') {
      const activeSystem = data.packs.filter((p) => p.is_system && p.activated).length;
      if (activeSystem === 1 && !window.confirm(
        'Es el último paquete activado. Si lo desactivas, tu biblioteca vuelve a mostrar TODOS los paquetes de tus deportes. ¿Seguir?',
      )) return;
    }
    toggle.mutate({ pack, activate });
  };

  const onFileChosen = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    setNotice(null);
    setImp({ step: 'reading', fileName: file.name });
    const read = await readPackFile(file);
    if ('error' in read) { setImp({ step: 'error', message: read.error }); return; }
    try {
      const preview = await previewPackImport(read.data);
      setImp({ step: 'preview', fileName: file.name, data: read.data, preview });
    } catch (e) {
      setImp({ step: 'error', message: errMessage(e) });
    }
  };

  const confirmImport = async () => {
    if (imp.step !== 'preview') return;
    const { data: fileData, preview, fileName } = imp;
    setImp({ step: 'importing', fileName, preview });
    try {
      const result = await importExercisePack(fileData);
      setImp({ step: 'done', result });
      refreshAll();
    } catch (e) {
      const body = (e as { body?: { details?: string[]; summary?: PackPreview['summary'] } }).body;
      if (body?.details?.length) {
        setImp({ step: 'preview', fileName, data: fileData, preview: { valid: false, errors: body.details, summary: body.summary ?? preview.summary } });
      } else {
        setImp({ step: 'error', message: errMessage(e) });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-busy="true">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
      </div>
    );
  }
  if (isError || !data) {
    const status = (error as { status?: number } | null)?.status;
    return (
      <div className="rounded-lg border border-destructive/40 p-4 text-sm space-y-2">
        <p>{status === 503 ? 'Los paquetes de ejercicios todavía no están disponibles.' : 'No pudimos cargar los paquetes.'}</p>
        {status !== 503 && <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>Reintentar</Button>}
      </div>
    );
  }

  const system = data.packs.filter((p) => p.is_system);
  const own = data.packs.filter((p) => !p.is_system);
  const busyId = toggle.isPending ? toggle.variables?.pack.id : exportPack.isPending ? exportPack.variables : null;

  return (
    <div className="space-y-4 min-w-0" data-testid="exercise-packs-tab">
      <p className="text-sm text-muted-foreground">
        {data.mode === 'todos'
          ? 'Hoy ves todos los paquetes de tus deportes. Activa los que quieras y la biblioteca mostrará solo esos, más los de tu escuela.'
          : 'Tu biblioteca muestra solo los paquetes activados y los de tu escuela.'}
      </p>

      <div className="flex flex-wrap gap-2">
        {data.can_manage && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              data-testid="pack-file-input"
              onChange={(e) => onFileChosen(e.target.files?.[0])}
            />
            <Button
              type="button"
              className="min-h-11"
              onClick={() => fileRef.current?.click()}
              disabled={imp.step === 'reading' || imp.step === 'importing'}
            >
              <FileUp className="h-4 w-4 mr-2" /> Importar paquete
            </Button>
          </>
        )}
        {data.loose_own_count > 0 && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => exportPack.mutate('mine')}
            disabled={exportPack.isPending}
          >
            <Download className="h-4 w-4 mr-2" /> Exportar mis ejercicios ({data.loose_own_count})
          </Button>
        )}
      </div>

      <ImportPanel state={imp} onConfirm={confirmImport} onCancel={() => setImp({ step: 'idle' })} />

      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}

      <PackSection
        title="Paquetes SportMaps"
        empty="No hay paquetes SportMaps para los deportes de tu escuela."
        packs={system}
        canManage={data.can_manage}
        busyId={busyId}
        onToggle={onToggle}
        onExport={(p) => exportPack.mutate(p.id)}
      />
      {own.length > 0 && (
        <PackSection
          title="De tu escuela"
          empty=""
          packs={own}
          canManage={data.can_manage}
          busyId={busyId}
          onToggle={onToggle}
          onExport={(p) => exportPack.mutate(p.id)}
        />
      )}
    </div>
  );
}

function ImportPanel({ state, onConfirm, onCancel }: { state: ImportState; onConfirm: () => void; onCancel: () => void }) {
  if (state.step === 'idle') return null;
  if (state.step === 'reading') {
    return <div className="rounded-lg border p-4 text-sm" role="status">Revisando «{state.fileName}»…</div>;
  }
  if (state.step === 'error') {
    return (
      <div className="rounded-lg border border-destructive/40 p-4 text-sm space-y-2" role="alert">
        <p className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />{state.message}</p>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cerrar</Button>
      </div>
    );
  }
  if (state.step === 'done') {
    const s = state.result.summary;
    return (
      <div className="rounded-lg border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-sm space-y-2" role="status" data-testid="pack-import-done">
        <p className="flex items-start gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
          Listo: se importaron {plural(state.result.exercises, 'ejercicio', 'ejercicios')}{s?.name ? ` en «${s.name}»` : ''}.
        </p>
        <p className="text-muted-foreground">Ya están en «De mi escuela» y en la biblioteca.</p>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cerrar</Button>
      </div>
    );
  }

  const { preview } = state;
  const s = preview.summary;
  const importing = state.step === 'importing';
  return (
    <div className="rounded-lg border p-4 text-sm space-y-3" data-testid="pack-import-preview">
      <div className="space-y-1">
        <p className="font-medium break-words">{s?.name ? `Paquete «${s.name}»` : 'Paquete sin nombre'}</p>
        <p className="text-muted-foreground">
          {s ? plural(s.exercises, 'ejercicio', 'ejercicios') : 'Sin ejercicios'}
          {s && s.sports.length > 0 && ` · ${s.sports.map(sportLabel).join(', ')}`}
          {s?.sport && ` · Deporte del paquete: ${sportLabel(s.sport)}`}
        </p>
        <p className="text-xs text-muted-foreground break-all">Archivo: {state.fileName}</p>
      </div>
      {preview.valid ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="min-h-11" onClick={onConfirm} disabled={importing}>
            {importing ? 'Importando…' : `Importar ${s ? plural(s.exercises, 'ejercicio', 'ejercicios') : ''}`.trim()}
          </Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={onCancel} disabled={importing}>Cancelar</Button>
        </div>
      ) : (
        <div className="space-y-2" role="alert">
          <p className="font-medium text-destructive">No se puede importar: el archivo tiene {plural(preview.errors.length, 'error', 'errores')}. No se guardó nada.</p>
          <ul className="list-disc pl-5 space-y-0.5 text-xs text-muted-foreground break-words">
            {preview.errors.slice(0, MAX_ERRORS_SHOWN).map((e, i) => <li key={i}>{e}</li>)}
            {preview.errors.length > MAX_ERRORS_SHOWN && <li>… y {preview.errors.length - MAX_ERRORS_SHOWN} más.</li>}
          </ul>
          <Button type="button" variant="outline" className="min-h-11" onClick={onCancel}>Cerrar</Button>
        </div>
      )}
    </div>
  );
}

function PackSection({
  title, empty, packs, canManage, busyId, onToggle, onExport,
}: {
  title: string;
  empty: string;
  packs: ExercisePack[];
  canManage: boolean;
  busyId: string | null | undefined;
  onToggle: (p: ExercisePack) => void;
  onExport: (p: ExercisePack) => void;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {packs.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {packs.map((p) => (
            <PackCard key={p.id} pack={p} canManage={canManage} busy={busyId === p.id} onToggle={() => onToggle(p)} onExport={() => onExport(p)} />
          ))}
        </div>
      )}
    </section>
  );
}

function PackCard({
  pack, canManage, busy, onToggle, onExport,
}: {
  pack: ExercisePack;
  canManage: boolean;
  busy: boolean;
  onToggle: () => void;
  onExport: () => void;
}) {
  const status = pack.activated ? 'Activado' : pack.visible ? 'Visible' : 'Oculto';
  return (
    <div className="rounded-xl border bg-card p-3 flex flex-col gap-2 min-w-0" data-testid="exercise-pack-card" data-pack-id={pack.id}>
      <div className="flex items-start gap-2 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Package className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight break-words">{pack.name}</p>
          <p className="text-xs text-muted-foreground">
            {sportLabel(pack.sport)} · {plural(pack.exercise_count, 'ejercicio', 'ejercicios')}
            {pack.version > 1 && ` · v${pack.version}`}
          </p>
        </div>
        <Badge variant={pack.activated ? 'default' : 'secondary'} className="shrink-0">{status}</Badge>
      </div>
      {pack.description && <p className="text-xs text-muted-foreground line-clamp-2">{pack.description}</p>}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        {canManage && (
          <Button
            type="button"
            variant={pack.activated ? 'outline' : 'default'}
            className="min-h-11 flex-1"
            onClick={onToggle}
            disabled={busy}
            aria-label={`${pack.activated ? 'Desactivar' : 'Activar'} ${pack.name}`}
          >
            {pack.activated ? 'Desactivar' : 'Activar'}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1"
          onClick={onExport}
          disabled={busy}
          aria-label={`Exportar ${pack.name}`}
        >
          <Download className="h-4 w-4 mr-2" /> Exportar
        </Button>
      </div>
    </div>
  );
}
