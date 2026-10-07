import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createDiagnosis, searchCie10, setDiagnosisStatus } from '@/lib/clinical/api';
import { clinicalErrorMessage } from '@/lib/clinical/labels';
import { CIE10_PATTERN, type ClinicalDiagnosis, type ClinicalEpisode } from '@/lib/clinical/types';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Buscador CIE-10 con opción de código manual. Llama onPick con el código y su descripción. */
export function DiagnosisPicker({ onPick, disabled }: {
  onPick: (code: string, description: string) => void; disabled?: boolean;
}) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [manualDesc, setManualDesc] = useState('');
  const debounced = useDebounced(term, 300);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useQuery({
    queryKey: ['clinical', 'cie10', debounced.trim().toLowerCase()],
    queryFn: () => searchCie10(debounced),
    enabled: debounced.trim().length >= 2,
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const upper = term.trim().toUpperCase();
  const manualCandidate = CIE10_PATTERN.test(upper) && !(results.data ?? []).some((r) => r.code === upper);

  const pick = (code: string, description: string) => {
    onPick(code, description);
    setTerm('');
    setManualDesc('');
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={term} disabled={disabled} className="pl-9"
          placeholder="Buscar CIE-10 por código o nombre (ej. S83 o esguince)"
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} />
      </div>
      {open && term.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md max-h-72 overflow-y-auto">
          {results.isFetching && (
            <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Buscando…</div>
          )}
          {results.isError && <p className="p-3 text-xs text-destructive">{clinicalErrorMessage(results.error)}</p>}
          {(results.data ?? []).map((r) => (
            <button key={r.code} type="button" onClick={() => pick(r.code, r.description)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex gap-2">
              <span className="font-mono font-semibold shrink-0">{r.code}</span>
              <span className="text-muted-foreground">{r.description}</span>
            </button>
          ))}
          {!results.isFetching && results.data && results.data.length === 0 && !manualCandidate && (
            <p className="p-3 text-xs text-muted-foreground">
              Sin resultados. Si conoces el código, escríbelo completo (ej. M23.2) para agregarlo a mano.
            </p>
          )}
          {manualCandidate && (
            <div className="border-t p-3 space-y-2">
              <p className="text-xs text-muted-foreground">Agregar <span className="font-mono font-semibold">{upper}</span> a mano:</p>
              <div className="flex gap-2">
                <Input value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} placeholder="Descripción del diagnóstico"
                  className="h-8 text-sm" />
                <Button type="button" size="sm" disabled={manualDesc.trim().length < 3}
                  onClick={() => pick(upper, manualDesc.trim())}>Usar</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<ClinicalDiagnosis['status'], string> = { activo: 'Activo', resuelto: 'Resuelto', descartado: 'Descartado' };
const STATUS_TONE: Record<ClinicalDiagnosis['status'], string> = {
  activo: 'border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-300',
  resuelto: 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400',
  descartado: 'text-muted-foreground line-through',
};

/** Diagnósticos de un episodio: lista, cambio de estado y alta de nuevos. */
export function EpisodeDiagnoses({ episode, diagnoses, canWrite }: {
  episode: ClinicalEpisode; diagnoses: ClinicalDiagnosis[]; canWrite: boolean;
}) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<{ code: string; description: string } | null>(null);
  const hasPrincipal = diagnoses.some((d) => d.kind === 'principal' && d.status !== 'descartado');
  const [kind, setKind] = useState<ClinicalDiagnosis['kind']>('principal');
  useEffect(() => { setKind(hasPrincipal ? 'relacionado' : 'principal'); }, [hasPrincipal, pending]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['clinical', 'diagnoses', episode.patient_id] });

  const add = useMutation({
    mutationFn: () => createDiagnosis({
      patient_id: episode.patient_id, episode_id: episode.id, cie10_code: pending!.code,
      description: pending!.description, kind,
    }),
    onSuccess: () => { toast.success('Diagnóstico agregado'); setPending(null); invalidate(); },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  const changeStatus = useMutation({
    mutationFn: (v: { id: string; status: ClinicalDiagnosis['status'] }) => setDiagnosisStatus(v.id, v.status),
    onSuccess: () => { toast.success('Estado del diagnóstico actualizado'); invalidate(); },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  const canAdd = canWrite && episode.status === 'abierto';
  const sorted = [...diagnoses].sort((a, b) => (a.kind === b.kind ? a.created_at.localeCompare(b.created_at) : a.kind === 'principal' ? -1 : 1));

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diagnósticos (CIE-10)</h4>
      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin diagnósticos registrados.</p>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((d) => (
            <li key={d.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border px-2.5 py-2">
              <div className="flex-1 min-w-0 text-sm">
                <span className="font-mono font-semibold mr-2">{d.cie10_code}</span>
                <span className={d.status === 'descartado' ? 'line-through text-muted-foreground' : ''}>{d.description}</span>
                <div className="flex gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[10px]">{d.kind === 'principal' ? 'Principal' : 'Relacionado'}</Badge>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[d.status]}`}>{STATUS_LABEL[d.status]}</Badge>
                </div>
              </div>
              {canWrite && (
                <Select value={d.status}
                  onValueChange={(v) => changeStatus.mutate({ id: d.id, status: v as ClinicalDiagnosis['status'] })}
                  disabled={changeStatus.isPending}>
                  <SelectTrigger className="h-8 w-full sm:w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as ClinicalDiagnosis['status'][]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        pending ? (
          <div className="rounded-md border border-dashed p-2.5 space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <span className="font-mono font-semibold">{pending.code}</span>
              <span className="flex-1">{pending.description}</span>
              <button type="button" onClick={() => setPending(null)} aria-label="Quitar"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as ClinicalDiagnosis['kind'])}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="principal">Principal</SelectItem>
                    <SelectItem value="relacionado">Relacionado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending} className="gap-1">
                {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Agregar diagnóstico
              </Button>
            </div>
          </div>
        ) : (
          <DiagnosisPicker onPick={(code, description) => setPending({ code, description })} />
        )
      )}
    </div>
  );
}

export default DiagnosisPicker;
