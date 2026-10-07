// Piezas compartidas de los formularios de notas clínicas (NoteForms.tsx).
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Loader2, PenLine, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { nowLocalInput, type RowCol, type Soap } from './note-utils';

// ── Firma ────────────────────────────────────────────────────────────────────
/** Botón "Firmar" con confirmación de inmutabilidad. `validate` devuelve un error o null. */
export function SignButton({ validate, onConfirm, pending, label = 'Firmar nota' }: {
  validate: () => string | null; onConfirm: () => void; pending: boolean; label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" disabled={pending} className="gap-2" onClick={() => {
        const err = validate();
        if (err) { toast.error(err); return; }
        setOpen(true);
      }}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Firmar la nota?</AlertDialogTitle>
            <AlertDialogDescription>
              Al firmar, la nota no se puede editar ni borrar. Queda con tu nombre, tu tarjeta profesional y la fecha y hora.
              Si luego necesitas corregir algo, agregas una nota aclaratoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setOpen(false); onConfirm(); }}>Firmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Campos ───────────────────────────────────────────────────────────────────
export function FormSection({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="space-y-3 rounded-lg border p-3">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function TextField({ label, value, onChange, rows = 2, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {rows <= 1
        ? <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        : <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}
    </div>
  );
}

export function SoapFields({ value, onChange }: { value: Soap; onChange: (v: Soap) => void }) {
  const set = (k: keyof Soap) => (v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3">
      <TextField label="S — Subjetivo (lo que refiere el paciente)" value={value.subjective} onChange={set('subjective')} rows={3} />
      <TextField label="O — Objetivo (hallazgos, mediciones)" value={value.objective} onChange={set('objective')} rows={3} />
      <TextField label="A — Análisis / impresión" value={value.assessment} onChange={set('assessment')} rows={2} />
      <TextField label="P — Plan" value={value.plan} onChange={set('plan')} rows={2} />
    </div>
  );
}

const PAIN_TONE = (v: number) => (v <= 3 ? 'text-emerald-600' : v <= 6 ? 'text-amber-600' : 'text-rose-600');

/** EVA 0-10 con opción de dejarla sin dato. */
export function PainScale({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold tabular-nums ${value === null ? 'text-muted-foreground' : PAIN_TONE(value)}`}>
            {value === null ? 'Sin dato' : `${value}/10`}
          </span>
          {value !== null && (
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => onChange(null)}>Quitar</button>
          )}
        </div>
      </div>
      <Slider min={0} max={10} step={1} value={[value ?? 0]} onValueChange={([v]) => onChange(v)}
        className={value === null ? 'opacity-50' : ''} aria-label={label} />
      <div className="flex justify-between text-[10px] text-muted-foreground"><span>0 sin dolor</span><span>10 máximo</span></div>
    </div>
  );
}

// ── Filas editables genéricas ────────────────────────────────────────────────
export function RowsEditor<T extends Record<string, unknown>>({ title, rows, onChange, cols, empty, addLabel }: {
  title: string; rows: T[]; onChange: (rows: T[]) => void; cols: RowCol<T>[]; empty: () => T; addLabel: string;
}) {
  const update = (i: number, key: keyof T, v: unknown) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  return (
    <FormSection title={title}>
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="rounded-md bg-muted/40 p-2 flex gap-2 items-start">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 flex-1">
                {cols.map((c) => (
                  <div key={c.key} className={c.span === 2 ? 'col-span-2' : 'col-span-1'}>
                    <Label className="text-[10px] text-muted-foreground">{c.label}</Label>
                    {c.type === 'select' ? (
                      <Select value={(row[c.key] as string | undefined) ?? ''} onValueChange={(v) => update(i, c.key, v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {c.options!.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : c.type === 'number' ? (
                      <Input type="number" inputMode="decimal" className="h-8 text-xs" placeholder={c.placeholder}
                        value={row[c.key] === null || row[c.key] === undefined ? '' : String(row[c.key])}
                        onChange={(e) => update(i, c.key, e.target.value === '' ? null : Number(e.target.value))} />
                    ) : (
                      <Input className="h-8 text-xs" placeholder={c.placeholder} value={(row[c.key] as string | undefined) ?? ''}
                        onChange={(e) => update(i, c.key, e.target.value)} />
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-4"
                onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Quitar fila">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => onChange([...rows, empty()])}>
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </Button>
    </FormSection>
  );
}

export function OccurredAtField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Fecha y hora de la atención</Label>
      <Input type="datetime-local" value={value} max={nowLocalInput()} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
