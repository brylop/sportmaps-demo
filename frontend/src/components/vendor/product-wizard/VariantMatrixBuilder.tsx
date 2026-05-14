import { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import { AttributeField } from '@/hooks/useCategories';

interface Props {
    schema:           AttributeField[];                    // variant_attributes solamente
    matrix:           Record<string, string[]>;            // ej: { talla: ['S','M','L'], color: ['Negro','Blanco'] }
    onChange:         (m: Record<string, string[]>) => void;
    defaults:         { stock: number; price_override?: number };
    onDefaultsChange: (d: { stock: number; price_override?: number }) => void;
}

/**
 * Constructor de matriz de variantes. Para cada variant_attribute del schema:
 * - select/multiselect: chips clickeables para activar valores
 * - color: input + boton agregar
 * - text/number: input + boton agregar
 *
 * Calcula total de variantes = producto cartesiano de los ejes.
 */
export function VariantMatrixBuilder({ schema, matrix, onChange, defaults, onDefaultsChange }: Props) {
    const totalVariants = useMemo(() => {
        const counts = schema.map(f => (matrix[f.key]?.length || 0));
        if (counts.length === 0 || counts.some(c => c === 0)) return 0;
        return counts.reduce((a, b) => a * b, 1);
    }, [schema, matrix]);

    const toggleValue = (key: string, value: string) => {
        const current = matrix[key] || [];
        if (current.includes(value)) {
            onChange({ ...matrix, [key]: current.filter(v => v !== value) });
        } else {
            onChange({ ...matrix, [key]: [...current, value] });
        }
    };

    const addCustomValue = (key: string, value: string) => {
        const v = value.trim();
        if (!v) return;
        const current = matrix[key] || [];
        if (current.includes(v)) return;
        onChange({ ...matrix, [key]: [...current, v] });
    };

    const removeValue = (key: string, value: string) => {
        const current = matrix[key] || [];
        onChange({ ...matrix, [key]: current.filter(v => v !== value) });
    };

    if (schema.length === 0) {
        return (
            <div className="text-sm text-muted-foreground italic">
                Esta categoría no tiene atributos de variante definidos. Activa variantes solo si vas a agregarlas manualmente luego.
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {schema.map(f => (
                <VariantAxisEditor
                    key={f.key}
                    field={f}
                    values={matrix[f.key] || []}
                    onToggle={v => toggleValue(f.key, v)}
                    onAddCustom={v => addCustomValue(f.key, v)}
                    onRemove={v => removeValue(f.key, v)}
                />
            ))}

            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total de combinaciones</span>
                    <Badge variant={totalVariants > 0 ? 'default' : 'secondary'}>{totalVariants}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label className="text-xs">Stock por variante (default)</Label>
                        <Input type="number" min={0} value={defaults.stock}
                               onChange={e => onDefaultsChange({ ...defaults, stock: Number(e.target.value) })} />
                    </div>
                    <div>
                        <Label className="text-xs">Precio override (opcional)</Label>
                        <Input type="number" min={0} value={defaults.price_override ?? ''}
                               placeholder="Usar precio base"
                               onChange={e => onDefaultsChange({ ...defaults, price_override: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    </div>
                </div>

                {totalVariants > 200 && (
                    <p className="text-xs text-destructive">⚠️ El máximo permitido es 200 combinaciones. Reduce los valores.</p>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Editor de un eje (talla, color, peso, etc.)
// ─────────────────────────────────────────────────────────────────────
function VariantAxisEditor({
    field, values, onToggle, onAddCustom, onRemove,
}: {
    field:       AttributeField;
    values:      string[];
    onToggle:    (v: string) => void;
    onAddCustom: (v: string) => void;
    onRemove:    (v: string) => void;
}) {
    const [custom, setCustom] = useState('');

    return (
        <div>
            <Label>{field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}</Label>

            {field.options && field.options.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {field.options.map(opt => {
                        const active = values.includes(opt);
                        return (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => onToggle(opt)}
                                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                            >
                                {opt}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Valores custom (no presentes en options) */}
            {values.filter(v => !(field.options || []).includes(v)).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {values.filter(v => !(field.options || []).includes(v)).map(v => (
                        <span key={v} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                            {v}
                            <button type="button" onClick={() => onRemove(v)}><X className="h-3 w-3" /></button>
                        </span>
                    ))}
                </div>
            )}

            {/* Agregar valor custom para text/number/color */}
            {(field.type === 'text' || field.type === 'number' || field.type === 'color' || !field.options) && (
                <div className="flex items-center gap-2 mt-2">
                    <Input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={custom}
                        onChange={e => setCustom(e.target.value)}
                        placeholder={`Agregar ${field.label.toLowerCase()}${field.unit ? ` (${field.unit})` : ''}`}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onAddCustom(custom);
                                setCustom('');
                            }
                        }}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => { onAddCustom(custom); setCustom(''); }}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
