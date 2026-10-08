import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, X } from 'lucide-react';
import { AttributeField } from '@/hooks/useCategories';
import type { VariantStockRow } from '@/lib/store/inventory';

interface Props {
    schema:             AttributeField[];                    // variant_attributes solamente
    matrix:             Record<string, string[]>;            // ej: { talla: ['S','M','L'], color: ['Negro','Blanco'] }
    onChange:           (m: Record<string, string[]>) => void;
    /** Filas de stock: variantes existentes + combinaciones nuevas de la matriz. */
    rows:               VariantStockRow[];
    onStockChange:      (key: string, stock: number) => void;
    onActiveChange:     (key: string, active: boolean) => void;
    onApplyAll:         (stock: number) => void;
    priceOverride?:     number;
    onPriceOverrideChange: (v: number | undefined) => void;
    /** Ejes obligatorios sin valores: no se generan combinaciones nuevas. */
    missingAxes:        string[];
    isEdit:             boolean;
}

/**
 * Matriz de variantes con stock POR combinación (no un stock "default" para todas).
 * - Ejes: chips (select) o valores propios (color/texto/número).
 * - Tabla: una fila por combinación con su stock. Al editar, las variantes que ya
 *   existen muestran su stock actual y lo reservado; cambiarlo se guarda como un
 *   ajuste de inventario con kardex. Una variante existente no se borra: se desactiva.
 */
export function VariantMatrixBuilder({
    schema, matrix, onChange, rows, onStockChange, onActiveChange, onApplyAll,
    priceOverride, onPriceOverrideChange, missingAxes, isEdit,
}: Props) {
    const [bulk, setBulk] = useState('');

    const toggleValue = (key: string, value: string) => {
        const current = matrix[key] || [];
        onChange({ ...matrix, [key]: current.includes(value) ? current.filter(v => v !== value) : [...current, value] });
    };

    const addCustomValue = (key: string, value: string) => {
        const v = value.trim();
        if (!v) return;
        const current = matrix[key] || [];
        if (current.some(c => c.toLowerCase() === v.toLowerCase())) return;
        onChange({ ...matrix, [key]: [...current, v] });
    };

    const removeValue = (key: string, value: string) => {
        onChange({ ...matrix, [key]: (matrix[key] || []).filter(v => v !== value) });
    };

    if (schema.length === 0 && rows.length === 0) {
        return (
            <div className="text-sm text-muted-foreground italic">
                Esta categoría no tiene tallas, colores u otras variantes definidas. Desactiva variantes y usa un stock único.
            </div>
        );
    }

    const activeRows = rows.filter(r => r.is_active);
    const totalUnits = activeRows.reduce((s, r) => s + (Number(r.stock) || 0), 0);

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

            {missingAxes.length > 0 && (
                <p className="text-xs text-amber-600">Elige al menos un valor de: {missingAxes.join(', ')}.</p>
            )}

            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">Stock por variante</span>
                    <div className="flex items-center gap-2">
                        <Badge variant={activeRows.length > 0 ? 'default' : 'secondary'}>{activeRows.length} combinaciones</Badge>
                        <Badge variant="outline" data-testid="variants-total-units">{totalUnits} unidades</Badge>
                    </div>
                </div>

                {rows.length > 0 && (
                    <div className="flex flex-wrap items-end gap-2">
                        <div>
                            <Label className="text-xs" htmlFor="bulk-stock">Poner el mismo stock a todas</Label>
                            <Input id="bulk-stock" type="number" min={0} value={bulk} className="w-28"
                                   onChange={e => setBulk(e.target.value)} placeholder="Ej: 10" />
                        </div>
                        <Button type="button" variant="outline" size="sm" disabled={bulk === '' || Number(bulk) < 0}
                                onClick={() => onApplyAll(Math.max(0, Math.trunc(Number(bulk) || 0)))}>
                            Aplicar
                        </Button>
                    </div>
                )}

                {rows.length > 0 ? (
                    <div className="divide-y rounded-md border bg-background" data-testid="variant-stock-table">
                        {rows.map(r => (
                            <div key={r.key} className="flex flex-wrap items-center gap-3 px-3 py-2" data-testid="variant-stock-row" data-variant-label={r.label}>
                                <div className="flex-1 min-w-[8rem]">
                                    <p className={`text-sm font-medium ${r.is_active ? '' : 'line-through text-muted-foreground'}`}>{r.label}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {r.variant_id
                                            ? `Hoy: ${r.current_stock ?? 0}${r.reserved > 0 ? ` · reservado ${r.reserved}` : ''}`
                                            : 'Nueva'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label htmlFor={`stock-${r.key}`} className="sr-only">Stock {r.label}</Label>
                                    <Input
                                        id={`stock-${r.key}`}
                                        aria-label={`Stock ${r.label}`}
                                        type="number"
                                        min={r.reserved}
                                        className="w-24"
                                        disabled={!r.is_active}
                                        value={Number.isFinite(r.stock) ? r.stock : 0}
                                        onChange={e => onStockChange(r.key, Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
                                    />
                                    <div className="flex items-center gap-1.5">
                                        <Switch
                                            checked={r.is_active}
                                            onCheckedChange={c => onActiveChange(r.key, c)}
                                            aria-label={`${r.is_active ? 'Desactivar' : 'Activar'} ${r.label}`}
                                        />
                                        <span className="text-[11px] text-muted-foreground w-10">{r.is_active ? 'Activa' : 'Inactiva'}</span>
                                    </div>
                                </div>
                                {r.variant_id && r.stock < r.reserved && (
                                    <p className="w-full text-[11px] text-destructive">No puede quedar por debajo de lo reservado ({r.reserved}).</p>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground">Elige los valores de cada eje para armar las combinaciones.</p>
                )}

                {isEdit && rows.some(r => r.variant_id) && (
                    <p className="text-[11px] text-muted-foreground">
                        Cambiar el stock de una variante existente queda en el historial de inventario como «Edición del producto».
                    </p>
                )}

                <div className="max-w-xs">
                    <Label className="text-xs">Precio distinto para las variantes nuevas (opcional)</Label>
                    <Input type="number" min={0} value={priceOverride ?? ''}
                           placeholder="Usar precio base"
                           onChange={e => onPriceOverrideChange(e.target.value === '' ? undefined : Number(e.target.value))} />
                </div>

                {rows.length > 200 && (
                    <p className="text-xs text-destructive">El máximo permitido es 200 combinaciones. Reduce los valores.</p>
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
                                aria-pressed={active}
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
                            <button type="button" onClick={() => onRemove(v)} aria-label={`Quitar ${v}`}><X className="h-3 w-3" /></button>
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
                        aria-label={`Agregar ${field.label.toLowerCase()}`}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onAddCustom(custom);
                                setCustom('');
                            }
                        }}
                    />
                    <Button type="button" variant="outline" size="sm" aria-label={`Agregar ${field.label.toLowerCase()}`}
                            onClick={() => { onAddCustom(custom); setCustom(''); }}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
