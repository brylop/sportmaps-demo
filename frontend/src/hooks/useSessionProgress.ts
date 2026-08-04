import { useState, useEffect, useRef, useCallback } from 'react';
import { bffClient } from '@/lib/api/bffClient';

const LS_PREFIX = 'sportmaps_session_progress_';
const AUTO_SAVE_INTERVAL_MS = 60_000; // 60s

export interface BlockSetResult {
  reps_completed: number | '';
  weight_kg:      number | '';
  rpe:            number | '';
  drops_results?: Array<{ reps_completed: number | ''; weight_kg: number | '' }>;
  completed?:     boolean;
}

export interface ExecutionProgress {
  started_at:       string;
  last_saved_at:    string;
  set_results:      Record<string, BlockSetResult[]>; // key = blockIdx string
  completed_blocks: number[];
}

interface UseSessionProgressOptions {
  sessionId:            string;
  initialProgress?:     ExecutionProgress | null;
  initialSetResults:    Record<number, BlockSetResult[]>;
  onProgressRestored?:  (progress: ExecutionProgress) => void;
}

export function useSessionProgress({
  sessionId,
  initialProgress,
  initialSetResults,
  onProgressRestored,
}: UseSessionProgressOptions) {
  const lsKey = `${LS_PREFIX}${sessionId}`;

  // ─── Resolver progreso inicial (servidor vs localStorage) ────────────────
  const resolvedInitial = useCallback((): ExecutionProgress | null => {
    let server = initialProgress;
    if (server && (!server.set_results || !server.last_saved_at)) {
      server = null;
    }

    let local: ExecutionProgress | null = null;
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.set_results && parsed.last_saved_at) {
          local = parsed;
        }
      }
    } catch { /* ignorar */ }

    if (!server && !local) return null;
    if (!server) return local;
    if (!local)  return server;

    // Usar el más reciente
    const serverTs = new Date(server.last_saved_at).getTime();
    const localTs  = new Date(local.last_saved_at).getTime();
    return localTs > serverTs ? local : server;
  }, [initialProgress, lsKey]);

  const [setResults,       setSetResults]       = useState<Record<number, BlockSetResult[]>>(initialSetResults);
  const [completedBlocks,  setCompletedBlocks]  = useState<number[]>([]);
  const [isSaving,         setIsSaving]         = useState(false);
  const [lastSavedAt,      setLastSavedAt]      = useState<string | null>(null);
  const [isRestored,       setIsRestored]       = useState(false);

  const setResultsRef      = useRef(setResults);
  const completedBlocksRef = useRef(completedBlocks);
  useEffect(() => { setResultsRef.current = setResults; },       [setResults]);
  useEffect(() => { completedBlocksRef.current = completedBlocks; }, [completedBlocks]);

  // ─── Aplicar progreso recuperado al montar ───────────────────────────────
  useEffect(() => {
    const progress = resolvedInitial();
    if (!progress || !progress.set_results) return;

    // Merge set_results con los valores iniciales (los del servidor tienen prioridad)
    const merged: Record<number, BlockSetResult[]> = { ...initialSetResults };
    Object.entries(progress.set_results).forEach(([idx, sets]) => {
      merged[parseInt(idx)] = sets;
    });

    setSetResults(merged);
    setCompletedBlocks(progress.completed_blocks ?? []);
    setLastSavedAt(progress.last_saved_at);
    setIsRestored(true);
    onProgressRestored?.(progress);
  }, []); // solo al montar

  // ─── Guardar en localStorage (backup inmediato) ───────────────────────────
  const saveToLocalStorage = useCallback((
    results: Record<number, BlockSetResult[]>,
    blocks:  number[],
  ) => {
    try {
      const progress: ExecutionProgress = {
        started_at:       lastSavedAt ?? new Date().toISOString(),
        last_saved_at:    new Date().toISOString(),
        set_results:      Object.fromEntries(
          Object.entries(results).map(([k, v]) => [k, v])
        ),
        completed_blocks: blocks,
      };
      localStorage.setItem(lsKey, JSON.stringify(progress));
    } catch { /* ignorar quota errors */ }
  }, [lsKey, lastSavedAt]);

  // ─── Guardar en servidor ──────────────────────────────────────────────────
  const saveToServer = useCallback(async (
    results:         Record<number, BlockSetResult[]>,
    blocks:          number[],
    silent = false,
  ) => {
    if (!silent) setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const progress: ExecutionProgress = {
        started_at:       lastSavedAt ?? now,
        last_saved_at:    now,
        set_results:      Object.fromEntries(
          Object.entries(results).map(([k, v]) => [k, v])
        ),
        completed_blocks: blocks,
      };
      await bffClient.patch(
        `/api/v1/trainer/session-plans/${sessionId}/progress`,
        { execution_progress: progress },
      );
      setLastSavedAt(now);
      localStorage.setItem(lsKey, JSON.stringify(progress));
    } catch (err) {
      console.warn('[SessionProgress] Error guardando en servidor:', err);
      // El backup de localStorage ya está guardado, no es crítico
    } finally {
      if (!silent) setIsSaving(false);
    }
  }, [sessionId, lsKey, lastSavedAt]);

  // ─── Checkpoint por bloque (merge — no pisa otros bloques) ───────────────
  const checkpointBlock = useCallback(async (blockIdx: number) => {
    const results = setResultsRef.current;
    const blocks  = completedBlocksRef.current;
    const newCompleted = blocks.includes(blockIdx) ? blocks : [...blocks, blockIdx];

    setCompletedBlocks(newCompleted);
    saveToLocalStorage(results, newCompleted);
    await saveToServer(results, newCompleted);
  }, [saveToLocalStorage, saveToServer]);

  // ─── Actualizar un set específico ────────────────────────────────────────
  const updateSet = useCallback((
    blockIdx: number,
    setIdx:   number,
    field:    keyof BlockSetResult,
    value:    number | '' | boolean,
  ) => {
    setSetResults(prev => {
      const blockSets = [...(prev[blockIdx] ?? [])];
      blockSets[setIdx] = { ...blockSets[setIdx], [field]: value };
      const next = { ...prev, [blockIdx]: blockSets };
      saveToLocalStorage(next, completedBlocksRef.current);
      return next;
    });
  }, [saveToLocalStorage]);

  const updateDropResult = useCallback((
    blockIdx: number,
    setIdx:   number,
    dropIdx:  number,
    field:    'reps_completed' | 'weight_kg',
    value:    number | '',
  ) => {
    setSetResults(prev => {
      const blockSets = [...(prev[blockIdx] ?? [])];
      const set       = { ...blockSets[setIdx] };
      const drops     = [...(set.drops_results ?? [])];
      drops[dropIdx]  = { ...drops[dropIdx], [field]: value };
      set.drops_results = drops;
      blockSets[setIdx] = set;
      const next = { ...prev, [blockIdx]: blockSets };
      saveToLocalStorage(next, completedBlocksRef.current);
      return next;
    });
  }, [saveToLocalStorage]);

  // ─── Autoguardado silencioso cada 60s ────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      saveToServer(setResultsRef.current, completedBlocksRef.current, true);
    }, AUTO_SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [saveToServer]);

  // ─── Limpiar localStorage al completar definitivamente ───────────────────
  const clearLocalProgress = useCallback(() => {
    try { localStorage.removeItem(lsKey); } catch { /* ignorar */ }
  }, [lsKey]);

  return {
    setResults,
    completedBlocks,
    isSaving,
    lastSavedAt,
    isRestored,
    updateSet,
    updateDropResult,
    checkpointBlock,
    saveToServer,
    clearLocalProgress,
  };
}
