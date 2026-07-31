import { useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Entrada de etiquetas libres (certificaciones, tags de rutina, etc).
 *
 * Enter o coma agregan; Backspace con el campo vacío borra la última.
 * Deduplica ignorando mayúsculas para que "RCP" y "rcp" no convivan.
 *
 * Extraído del patrón inline de RoutineFormModal, que puede migrar aquí.
 */
interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Tope de etiquetas; al alcanzarlo se bloquea la entrada. */
  maxTags?: number;
  id?: string;
  className?: string;
}

export function TagInput({
  value,
  onChange,
  placeholder = 'Escribe y presiona Enter',
  disabled = false,
  maxTags = 12,
  id,
  className,
}: TagInputProps) {
  const [draft, setDraft] = useState('');
  const atLimit = value.length >= maxTags;

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/,+$/, '').trim();
    if (!tag || atLimit) return;
    const exists = value.some((t) => t.toLowerCase() === tag.toLowerCase());
    if (!exists) onChange([...value, tag]);
    setDraft('');
  };

  const removeTag = (tag: string) => onChange(value.filter((t) => t !== tag));

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      // Enter dentro de un <form> enviaría el formulario.
      e.preventDefault();
      addTag(draft);
      return;
    }
    if (e.key === 'Backspace' && !draft && value.length > 0) {
      e.preventDefault();
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          disabled={disabled || atLimit}
          placeholder={atLimit ? `Máximo ${maxTags} etiquetas` : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          // Sin esto, salir del campo con texto a medias pierde la etiqueta.
          onBlur={() => addTag(draft)}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || atLimit || !draft.trim()}
          onClick={() => addTag(draft)}
        >
          Agregar
        </Button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1 font-normal">
              {tag}
              <button
                type="button"
                aria-label={`Quitar ${tag}`}
                disabled={disabled}
                onClick={() => removeTag(tag)}
                className="rounded-sm p-0.5 hover:text-destructive disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
