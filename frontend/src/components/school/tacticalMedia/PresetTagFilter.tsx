/**
 * Filtro por etiqueta de «Mis jugadas» (M6c): las etiquetas de la nota de cada
 * jugada guardada. Lógica pura + el submenú que monta la pizarra.
 */
import {
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { hydrateNotes } from '@/lib/school/tacticalMedia';

type WithNotes = { notes?: unknown };

export function presetTags(presets: readonly WithNotes[] | null | undefined): string[] {
  const out = new Set<string>();
  for (const p of presets ?? []) for (const t of hydrateNotes(p.notes)?.tags ?? []) out.add(t);
  return [...out].sort((a, b) => a.localeCompare(b, 'es'));
}

export function filterPresetsByTag<T extends WithNotes>(presets: readonly T[] | null | undefined, tag: string | null): T[] {
  const list = [...(presets ?? [])];
  if (!tag) return list;
  return list.filter((p) => hydrateNotes(p.notes)?.tags.includes(tag));
}

export function PresetTagFilterSub({ tags, value, onChange }: { tags: string[]; value: string | null; onChange: (t: string | null) => void }) {
  if (tags.length === 0) return null;
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        Etiqueta: <span className="ml-1 font-semibold">{value ?? 'todas'}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-[60vh] overflow-y-auto">
        <DropdownMenuRadioGroup value={value ?? ''} onValueChange={(v) => onChange(v || null)}>
          <DropdownMenuRadioItem value="" onSelect={(e) => e.preventDefault()}>Todas</DropdownMenuRadioItem>
          {tags.map((t) => (
            <DropdownMenuRadioItem key={t} value={t} onSelect={(e) => e.preventDefault()}>{t}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
