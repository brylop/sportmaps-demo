/**
 * <BankAccountFields> — Bloque reutilizable de campos bancarios CO.
 *
 * Consume datos canonicos desde lib/colombian-banks (Nequi, Daviplata, Bre-B,
 * tradicionales, etc) y maneja UX dinamica:
 *   - Placeholder y label del "numero de cuenta" cambian segun tipo de cuenta
 *   - Tooltip especial para Bre-B
 *
 * Uso:
 *   <BankAccountFields value={form} onChange={setForm} showDocumentType />
 *
 * Si showDocumentType=false, se omite el selector de tipo de doc (queda solo
 * un input "Cédula del titular" tipo texto).
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    COLOMBIAN_BANKS,
    ACCOUNT_TYPES,
    DOCUMENT_TYPES,
    accountNumberPlaceholder,
    accountNumberLabel,
} from '@/lib/colombian-banks';

export interface BankAccountValue {
    bank_name:        string;
    account_type:     string;
    account_number:   string;
    account_holder:   string;
    document_type?:   string;
    document_number?: string;
}

interface Props {
    value:    BankAccountValue;
    onChange: (next: BankAccountValue) => void;
    /** Muestra selector de tipo de documento (CC/CE/NIT/PASS/PEP). Default true. */
    showDocumentType?: boolean;
    /** Layout compacto en 2 columnas. Default true. */
    compact?: boolean;
}

export function BankAccountFields({ value, onChange, showDocumentType = true, compact = true }: Props) {
    const set = <K extends keyof BankAccountValue>(field: K, v: BankAccountValue[K]) =>
        onChange({ ...value, [field]: v });

    const gridCls = compact ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'space-y-3';
    const numberPlaceholder = accountNumberPlaceholder(value.account_type);
    const numberLabel = accountNumberLabel(value.account_type);

    return (
        <div className="space-y-3">
            <div className={gridCls}>
                <div>
                    <Label>Banco / Entidad *</Label>
                    <Select value={value.bank_name} onValueChange={v => set('bank_name', v)}>
                        <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                        <SelectContent>
                            {COLOMBIAN_BANKS.map(g => (
                                <SelectGroup key={g.group}>
                                    <SelectLabel>{g.group}</SelectLabel>
                                    {g.options.map(o => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                </SelectGroup>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>Tipo de cuenta *</Label>
                    <Select value={value.account_type} onValueChange={v => set('account_type', v)}>
                        <SelectTrigger><SelectValue placeholder="Selecciona el tipo" /></SelectTrigger>
                        <SelectContent>
                            {ACCOUNT_TYPES.map(t => (
                                <SelectItem key={t.value} value={t.value}>
                                    <div className="flex flex-col text-left">
                                        <span>{t.label}</span>
                                        {t.hint && <span className="text-[11px] text-muted-foreground">{t.hint}</span>}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>{numberLabel} *</Label>
                    <Input
                        value={value.account_number}
                        onChange={e => set('account_number', e.target.value)}
                        placeholder={numberPlaceholder}
                    />
                </div>

                <div>
                    <Label>Titular *</Label>
                    <Input
                        value={value.account_holder}
                        onChange={e => set('account_holder', e.target.value)}
                        placeholder="Nombre completo"
                    />
                </div>

                {showDocumentType ? (
                    <>
                        <div>
                            <Label>Tipo de documento *</Label>
                            <Select
                                value={value.document_type || 'CC'}
                                onValueChange={v => set('document_type', v)}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {DOCUMENT_TYPES.map(d => (
                                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Número de documento *</Label>
                            <Input
                                value={value.document_number || ''}
                                onChange={e => set('document_number', e.target.value)}
                                placeholder="1.020.345.678"
                            />
                        </div>
                    </>
                ) : (
                    <div className="md:col-span-2">
                        <Label>Cédula del titular</Label>
                        <Input
                            value={value.document_number || ''}
                            onChange={e => set('document_number', e.target.value)}
                            placeholder="1.020.345.678"
                        />
                    </div>
                )}
            </div>

            {value.account_type === 'bre_b' && (
                <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-md p-2">
                    Bre-B es el sistema interoperable del Banco de la República. Tu llave puede ser
                    tu celular, correo, cédula o un alias <code>@nombre</code>.
                </p>
            )}
        </div>
    );
}
