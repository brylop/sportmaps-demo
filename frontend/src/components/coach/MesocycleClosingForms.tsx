import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Check, Loader2 } from 'lucide-react';

/**
 * Formularios de cierre (semanal y del mesociclo) con botón "Guardar"
 * explícito e indicador guardado / sin guardar (spec §F6). Antes cada textarea
 * guardaba al salir del campo: el coach no sabía si lo escrito había quedado,
 * y el dueño — que solo mira — podía disparar escrituras con un clic.
 *
 * En solo lectura los campos se muestran como texto.
 */

export interface ClosingField {
  key: string;
  label: string;
}

interface ClosingFormProps {
  fields: ClosingField[];
  /** Valores tal como están en la base. */
  saved: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<unknown>;
  readOnly?: boolean;
  /** Clases del grid de campos (p. ej. 3 columnas en el cierre semanal). */
  gridClassName?: string;
}

const sameValues = (a: Record<string, string>, b: Record<string, string>, keys: string[]) =>
  keys.every((k) => (a[k] ?? '') === (b[k] ?? ''));

export function ClosingForm({ fields, saved, onSave, readOnly = false, gridClassName = 'grid grid-cols-1 sm:grid-cols-2 gap-3' }: ClosingFormProps) {
  const keys = fields.map((f) => f.key);
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...saved }));
  const [saving, setSaving] = useState(false);
  const lastSaved = useRef<Record<string, string>>(saved);
  const savedKey = JSON.stringify(keys.map((k) => saved[k] ?? ''));

  // Cuando la base cambia (refetch tras guardar, u otra persona guardó), se
  // adopta el valor nuevo SOLO si el usuario no tenía cambios sin guardar:
  // nunca pisar lo que está escribiendo.
  useEffect(() => {
    setValues((prev) => (sameValues(prev, lastSaved.current, keys) ? { ...saved } : prev));
    lastSaved.current = saved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const dirty = !sameValues(values, saved, keys);

  if (readOnly) {
    const anyText = keys.some((k) => (saved[k] ?? '').trim());
    if (!anyText) return <p className="text-sm text-muted-foreground italic">Todavía no se escribió el cierre.</p>;
    return (
      <div className={gridClassName}>
        {fields.map((f) => (
          <div key={f.key} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
            <p className="text-sm whitespace-pre-wrap">{(saved[f.key] ?? '').trim() || '—'}</p>
          </div>
        ))}
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(Object.fromEntries(keys.map((k) => [k, values[k] ?? ''])));
    } catch {
      // El toast de error lo muestra la mutación del padre; se conserva lo escrito.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className={gridClassName}>
        {fields.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs">{f.label}</Label>
            <Textarea
              rows={3}
              className="text-sm"
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3">
        <span className={`text-xs flex items-center gap-1 ${dirty ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} aria-live="polite">
          {dirty ? (
            'Cambios sin guardar'
          ) : (
            <>
              <Check className="w-3 h-3" /> Guardado
            </>
          )}
        </span>
        <Button size="sm" disabled={!dirty || saving} onClick={handleSave} className="gap-1.5">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}
