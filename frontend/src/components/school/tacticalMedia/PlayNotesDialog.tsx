/**
 * «Notas» de la jugada (M6c), adaptado de la pantalla de TacticalPad: nota de
 * la jugada con formato básico (negrita, lista, saltos), etiquetas (fase de
 * juego y objetivo, filtran en la biblioteca) y la nota del cuadro abierto,
 * que sale como subtítulo bajo la cancha al reproducir.
 * Borrador local: «Listo» confirma, «Cancelar» descarta.
 */
import { useEffect, useRef, useState } from 'react';
import { Bold, Eye, List, PlayCircle, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  FRAME_NOTE_MAX, NOTE_TAGS_MAX, NOTE_TEXT_MAX, OBJECTIVE_TAGS, PHASE_TAGS,
  normalizeTag, sanitizeNoteText, type PlayNotes,
} from '@/lib/school/tacticalMedia';
import { NoteText } from './NoteText';

export interface PlayNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly: boolean;
  notes: PlayNotes | null;
  onSave: (notes: PlayNotes | null) => void;
  /** Cuadro abierto (0-based) y total de cuadros. */
  frameIndex: number;
  frameCount: number;
  frameNote: string;
  onFrameNoteSave: (text: string) => void;
  onOpenVideos?: () => void;
  videoCount?: number;
}

/** Envuelve la selección en ** o pone «- » al comienzo de cada línea elegida. */
export function applyFormat(text: string, start: number, end: number, kind: 'bold' | 'list'): { text: string; start: number; end: number } {
  if (kind === 'bold') {
    const sel = text.slice(start, end) || 'texto';
    const next = `${text.slice(0, start)}**${sel}**${text.slice(end)}`;
    return { text: next, start: start + 2, end: start + 2 + sel.length };
  }
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIdx = text.indexOf('\n', end);
  const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
  const block = text.slice(lineStart, lineEnd).split('\n').map((l) => (/^\s*[-*•]\s/.test(l) ? l : `- ${l}`)).join('\n');
  const next = text.slice(0, lineStart) + block + text.slice(lineEnd);
  return { text: next, start: lineStart, end: lineStart + block.length };
}

function Chip({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-60 ${active ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200' : 'border-white/15 bg-white/5 text-white/75 hover:bg-white/10'}`}
    >
      {children}
    </button>
  );
}

export function PlayNotesDialog(props: PlayNotesDialogProps) {
  const { open, onOpenChange, readOnly, notes, onSave, frameIndex, frameCount, frameNote, onFrameNoteSave, onOpenVideos, videoCount = 0 } = props;
  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [frameText, setFrameText] = useState('');
  const [preview, setPreview] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setText(notes?.text ?? '');
    setTags(notes?.tags ?? []);
    setFrameText(frameNote ?? '');
    setCustomTag('');
    setPreview(readOnly);
  }, [open, notes, frameNote, readOnly]);

  const multiFrame = frameCount > 1;
  const toggleTag = (t: string) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : prev.length >= NOTE_TAGS_MAX ? prev : [...prev, t]));
  const addCustom = () => {
    const t = normalizeTag(customTag);
    if (t && !tags.includes(t) && tags.length < NOTE_TAGS_MAX) setTags([...tags, t]);
    setCustomTag('');
  };
  const format = (kind: 'bold' | 'list') => {
    const el = areaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const r = applyFormat(text, start, end, kind);
    setText(r.text.slice(0, NOTE_TEXT_MAX));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(r.start, r.end); });
  };
  const commit = () => {
    if (readOnly) return;
    const clean = sanitizeNoteText(text);
    onSave(clean || tags.length ? { text: clean, tags } : null);
    if (multiFrame) onFrameNoteSave(sanitizeNoteText(frameText, FRAME_NOTE_MAX));
  };
  const done = () => { commit(); onOpenChange(false); };
  const customTags = tags.filter((t) => !(PHASE_TAGS as readonly string[]).includes(t) && !(OBJECTIVE_TAGS as readonly string[]).includes(t));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[92vh] overflow-y-auto bg-zinc-900 text-white border-white/10 p-4 sm:p-6 gap-3">
        <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 pr-8 text-left">
          <div>
            <DialogTitle className="text-xl">Notas</DialogTitle>
            <DialogDescription className="text-white/60 text-xs">
              {readOnly ? 'Lo que el cuerpo técnico escribió sobre esta jugada.' : 'Qué busca la jugada, consignas y etiquetas para encontrarla en la biblioteca.'}
            </DialogDescription>
          </div>
          {onOpenVideos && (
            <Button type="button" size="sm" variant="outline" onClick={() => { commit(); onOpenVideos(); }}
              className="gap-1.5 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white">
              <PlayCircle className="h-4 w-4" /> Videos{videoCount ? ` (${videoCount})` : ''}
            </Button>
          )}
        </DialogHeader>

        {/* Nota de la jugada */}
        <section className="space-y-1.5">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold mr-auto">Nota de la jugada</span>
            {!readOnly && (
              <>
                <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-white/80 hover:bg-white/10 hover:text-white" onClick={() => format('bold')} aria-label="Negrita" title="Negrita (**texto**)">
                  <Bold className="h-4 w-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-white/80 hover:bg-white/10 hover:text-white" onClick={() => format('list')} aria-label="Lista" title="Lista (- al comienzo de la línea)">
                  <List className="h-4 w-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" aria-pressed={preview}
                  className={`h-8 gap-1 px-2 text-xs hover:bg-white/10 hover:text-white ${preview ? 'text-emerald-300' : 'text-white/80'}`} onClick={() => setPreview((v) => !v)}>
                  <Eye className="h-4 w-4" /> Vista previa
                </Button>
              </>
            )}
          </div>
          {preview ? (
            <div className="min-h-[9rem] rounded-md border border-white/10 bg-white text-zinc-900 p-3 text-sm">
              {text.trim() ? <NoteText text={text} /> : <p className="text-zinc-500">Sin nota.</p>}
            </div>
          ) : (
            <>
              <Textarea
                ref={areaRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, NOTE_TEXT_MAX))}
                placeholder={'Ej.: Salida por la banda derecha.\n- **Lateral** se proyecta\n- Volante da apoyo por dentro'}
                aria-label="Nota de la jugada"
                className="min-h-[9rem] bg-white text-zinc-900 placeholder:text-zinc-400"
              />
              <p className="text-[11px] text-white/50 text-right">{text.length}/{NOTE_TEXT_MAX} · **negrita** · «- » lista</p>
            </>
          )}
        </section>

        {/* Etiquetas */}
        <section className="space-y-2">
          <p className="text-sm font-semibold flex items-center gap-1.5"><Tag className="h-4 w-4" /> Etiquetas <span className="text-[11px] font-normal text-white/50">filtran en la biblioteca y en Mis jugadas</span></p>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/50 mb-1">Fase de juego</p>
            <div className="flex flex-wrap gap-1.5">
              {PHASE_TAGS.map((t) => (readOnly && !tags.includes(t) ? null : <Chip key={t} active={tags.includes(t)} onClick={() => toggleTag(t)} disabled={readOnly}>{t}</Chip>))}
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/50 mb-1">Objetivo</p>
            <div className="flex flex-wrap gap-1.5">
              {OBJECTIVE_TAGS.map((t) => (readOnly && !tags.includes(t) ? null : <Chip key={t} active={tags.includes(t)} onClick={() => toggleTag(t)} disabled={readOnly}>{t}</Chip>))}
              {customTags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full border border-emerald-400 bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-200">
                  {t}
                  {!readOnly && <button type="button" aria-label={`Quitar ${t}`} onClick={() => toggleTag(t)}><X className="h-3 w-3" /></button>}
                </span>
              ))}
            </div>
          </div>
          {!readOnly && (
            <div className="flex gap-1.5">
              <Input value={customTag} onChange={(e) => setCustomTag(e.target.value)} placeholder="Otra etiqueta"
                aria-label="Otra etiqueta" maxLength={40}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                className="h-8 max-w-[220px] bg-white/5 border-white/15 text-white placeholder:text-white/40" />
              <Button type="button" size="sm" variant="outline" onClick={addCustom} disabled={!customTag.trim() || tags.length >= NOTE_TAGS_MAX}
                className="h-8 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white">Agregar</Button>
            </div>
          )}
        </section>

        {/* Nota del cuadro */}
        <section className="space-y-1.5 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-sm font-semibold">Nota del cuadro {multiFrame ? `${frameIndex + 1} de ${frameCount}` : ''}</p>
          {multiFrame ? (
            readOnly ? (
              frameText ? <NoteText text={frameText} className="text-sm text-white/85" /> : <p className="text-xs text-white/50">Este cuadro no tiene nota.</p>
            ) : (
              <>
                <Textarea value={frameText} onChange={(e) => setFrameText(e.target.value.slice(0, FRAME_NOTE_MAX))}
                  aria-label="Nota del cuadro" placeholder="Sale como subtítulo bajo la cancha al reproducir. Ej.: «El 8 ataca el espacio»."
                  className="min-h-[4rem] bg-white text-zinc-900 placeholder:text-zinc-400" />
                <p className="text-[11px] text-white/50 text-right">{frameText.length}/{FRAME_NOTE_MAX}</p>
              </>
            )
          ) : (
            <p className="text-xs text-white/55">Las notas por cuadro son para jugadas animadas: agrega un cuadro en la línea de tiempo y cada uno tendrá su nota.</p>
          )}
        </section>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
          {tags.length > 0 && <span className="mr-auto text-xs text-white/55 truncate">{tags.length} etiqueta{tags.length === 1 ? '' : 's'}</span>}
          {!readOnly && (
            <Button type="button" variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={() => onOpenChange(false)}>Cancelar</Button>
          )}
          <Button type="button" className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={done}>{readOnly ? 'Cerrar' : 'Listo'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
