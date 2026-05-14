import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AttributeField } from '@/hooks/useCategories';

interface Props {
    field:    AttributeField;
    value:    unknown;
    onChange: (v: unknown) => void;
}

/**
 * Render dinamico de un campo del attribute_schema.
 * Soporta: select | multiselect | color | number | text.
 */
export function DynamicAttributeField({ field, value, onChange }: Props) {
    const requiredMark = field.required ? <span className="text-destructive ml-0.5">*</span> : null;

    if (field.type === 'select') {
        return (
            <div>
                <Label>{field.label}{requiredMark}</Label>
                <Select value={(value as string) || ''} onValueChange={onChange}>
                    <SelectTrigger><SelectValue placeholder={`Selecciona ${field.label.toLowerCase()}`} /></SelectTrigger>
                    <SelectContent>
                        {(field.options || []).map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        );
    }

    if (field.type === 'multiselect') {
        const selected = Array.isArray(value) ? (value as string[]) : [];
        const toggle = (opt: string) => {
            if (selected.includes(opt)) onChange(selected.filter(s => s !== opt));
            else onChange([...selected, opt]);
        };
        return (
            <div>
                <Label>{field.label}{requiredMark}</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                    {(field.options || []).map(opt => (
                        <label key={opt} className={`flex items-center gap-1.5 rounded-md border px-2 py-1 cursor-pointer text-xs ${selected.includes(opt) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                            <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)} />
                            {opt}
                        </label>
                    ))}
                </div>
            </div>
        );
    }

    if (field.type === 'color') {
        return (
            <div>
                <Label>{field.label}{requiredMark}</Label>
                <div className="flex items-center gap-2">
                    <input type="color" value={(value as string) || '#000000'} onChange={e => onChange(e.target.value)}
                           className="h-9 w-12 rounded border cursor-pointer" />
                    <Input value={(value as string) || ''} onChange={e => onChange(e.target.value)} placeholder="#000000 o nombre" />
                </div>
            </div>
        );
    }

    if (field.type === 'number') {
        return (
            <div>
                <Label>{field.label}{requiredMark}{field.unit && <span className="text-muted-foreground"> ({field.unit})</span>}</Label>
                <Input type="number" value={(value as number) ?? ''} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} />
            </div>
        );
    }

    // text
    return (
        <div>
            <Label>{field.label}{requiredMark}</Label>
            <Input value={(value as string) || ''} onChange={e => onChange(e.target.value)} />
        </div>
    );
}
