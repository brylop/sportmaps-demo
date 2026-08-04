import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Landmark, Plus, Loader2, AlertCircle, RefreshCw, Pencil } from 'lucide-react';

interface Config {
    year: number; smmlv: number; transport_aid: number; uvt: number | null;
    transport_aid_threshold_smmlv: number;
    health_pct: number; pension_pct: number; fsp_pct: number; fsp_threshold_smmlv: number;
    emp_health_pct: number; emp_pension_pct: number; caja_pct: number; sena_pct: number; icbf_pct: number;
    arl_rates: Record<string, number>;
    exoneration_enabled: boolean; exoneration_threshold_smmlv: number;
    cesantias_pct: number; intereses_cesantias_pct: number; prima_pct: number; vacaciones_pct: number;
    notes: string | null;
}

const pct = (n: number) => `${(Number(n) * 100).toFixed(2)}%`;

export default function PayrollConfigPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [editYear, setEditYear] = useState<Config | null>(null);
    const [addOpen, setAddOpen] = useState(false);

    const configQuery = useQuery({
        queryKey: ['payroll-config'],
        queryFn: async () => {
            const { data, error } = await supabase.from('payroll_config').select('*').order('year', { ascending: false });
            if (error) throw error;
            return (data ?? []) as Config[];
        },
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['payroll-config'] });

    if (configQuery.isError) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <h1 className="text-3xl font-bold flex items-center gap-2"><Landmark className="h-7 w-7 text-primary" /> Parámetros de Nómina</h1>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No se pudo cargar</AlertTitle>
                    <AlertDescription className="mt-1 flex flex-col items-start gap-3">
                        <span>Error de conexión.</span>
                        <Button size="sm" variant="outline" onClick={() => configQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Reintentar</Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const rows = configQuery.data ?? [];

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Landmark className="h-7 w-7 text-primary" /> Parámetros de Nómina (Colombia)
                    </h1>
                    <p className="text-muted-foreground">Valores nacionales versionados por año. Aplican a todas las entidades.</p>
                </div>
                <Button onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" /> Agregar año</Button>
            </div>

            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Cómo funciona</AlertTitle>
                <AlertDescription className="text-sm">
                    Cada año es una fila. Al iniciar un nuevo año se <strong>agrega</strong> una fila (no se editan los años pasados,
                    para que el recálculo histórico use el parámetro de su año). Los porcentajes vienen por defecto de la ley;
                    normalmente solo cambias <strong>SMMLV, auxilio de transporte y UVT</strong> cada año.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader><CardTitle>Años configurados</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {configQuery.isLoading ? (
                        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : rows.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground text-sm">No hay años configurados.</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Año</TableHead>
                                    <TableHead className="text-right">SMMLV</TableHead>
                                    <TableHead className="text-right">Auxilio transporte</TableHead>
                                    <TableHead className="text-right">UVT</TableHead>
                                    <TableHead>Salud/Pensión emp.</TableHead>
                                    <TableHead>Exoneración</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((c) => (
                                    <TableRow key={c.year}>
                                        <TableCell className="font-bold">{c.year}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(Number(c.smmlv))}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(Number(c.transport_aid))}</TableCell>
                                        <TableCell className="text-right">{c.uvt ? formatCurrency(Number(c.uvt)) : '—'}</TableCell>
                                        <TableCell className="text-sm">{pct(c.health_pct)} / {pct(c.pension_pct)}</TableCell>
                                        <TableCell>
                                            {c.exoneration_enabled
                                                ? <Badge className="bg-emerald-500 text-white">&lt; {c.exoneration_threshold_smmlv} SMMLV</Badge>
                                                : <Badge variant="secondary">Off</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="outline" onClick={() => setEditYear(c)}>
                                                <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {editYear && <EditConfigDialog config={editYear} onClose={() => setEditYear(null)} onSaved={invalidate} />}
            <AddYearDialog open={addOpen} onOpenChange={setAddOpen} existing={rows.map(r => r.year)} onSaved={invalidate} />
        </div>
    );
}

// ─── Editar año ──────────────────────────────────────────────────────────────
function NumField({ label, value, onChange, step = '1' }: { label: string; value: number; onChange: (v: number) => void; step?: string }) {
    return (
        <div className="grid gap-1.5">
            <Label className="text-xs">{label}</Label>
            <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        </div>
    );
}

function EditConfigDialog({ config, onClose, onSaved }: { config: Config; onClose: () => void; onSaved: () => void }) {
    const { toast } = useToast();
    const [f, setF] = useState<Config>({ ...config });
    const set = (k: keyof Config) => (v: number) => setF((p) => ({ ...p, [k]: v }));

    const mutation = useMutation({
        mutationFn: async () => {
            const { year, arl_rates, notes, ...rest } = f;
            if (!Number.isFinite(f.smmlv) || f.smmlv <= 0) throw new Error('SMMLV debe ser mayor a 0');
            const pctFields: (keyof Config)[] = ['health_pct', 'pension_pct', 'fsp_pct', 'emp_health_pct', 'emp_pension_pct', 'caja_pct', 'sena_pct', 'icbf_pct', 'cesantias_pct', 'prima_pct', 'vacaciones_pct'];
            for (const k of pctFields) {
                const v = Number(f[k]);
                if (!Number.isFinite(v) || v < 0 || v > 1) throw new Error(`"${k}" debe estar entre 0 y 1 (decimal)`);
            }
            if (f.transport_aid < 0 || (f.uvt ?? 0) < 0) throw new Error('Auxilio/UVT no pueden ser negativos');
            const { error } = await supabase.from('payroll_config').update({ ...rest }).eq('year', config.year);
            if (error) throw error;
        },
        onError: (e: any) => toast({ title: 'No se pudo guardar', description: e.message, variant: 'destructive' }),
        onSuccess: () => { toast({ title: `Parámetros ${config.year} actualizados` }); onClose(); onSaved(); },
    });

    return (
        <Dialog open onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Parámetros {config.year}</DialogTitle>
                    <DialogDescription>Porcentajes en decimal (0.04 = 4%). Solo super admin.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <p className="text-sm font-semibold mb-2">Base anual</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <NumField label="SMMLV" value={f.smmlv} onChange={set('smmlv')} />
                            <NumField label="Auxilio transporte" value={f.transport_aid} onChange={set('transport_aid')} />
                            <NumField label="UVT" value={f.uvt ?? 0} onChange={set('uvt')} />
                            <NumField label="Umbral auxilio (SMMLV)" value={f.transport_aid_threshold_smmlv} onChange={set('transport_aid_threshold_smmlv')} step="0.01" />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-semibold mb-2">Deducciones empleado</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <NumField label="Salud" value={f.health_pct} onChange={set('health_pct')} step="0.001" />
                            <NumField label="Pensión" value={f.pension_pct} onChange={set('pension_pct')} step="0.001" />
                            <NumField label="FSP" value={f.fsp_pct} onChange={set('fsp_pct')} step="0.001" />
                            <NumField label="Umbral FSP (SMMLV)" value={f.fsp_threshold_smmlv} onChange={set('fsp_threshold_smmlv')} step="0.01" />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-semibold mb-2">Aportes patronales</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <NumField label="Salud" value={f.emp_health_pct} onChange={set('emp_health_pct')} step="0.001" />
                            <NumField label="Pensión" value={f.emp_pension_pct} onChange={set('emp_pension_pct')} step="0.001" />
                            <NumField label="Caja" value={f.caja_pct} onChange={set('caja_pct')} step="0.001" />
                            <NumField label="SENA" value={f.sena_pct} onChange={set('sena_pct')} step="0.001" />
                            <NumField label="ICBF" value={f.icbf_pct} onChange={set('icbf_pct')} step="0.001" />
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                            <Switch checked={f.exoneration_enabled} onCheckedChange={(v) => setF((p) => ({ ...p, exoneration_enabled: v }))} />
                            <span className="text-sm">Exoneración Ley 1607 (salud+SENA+ICBF patronal)</span>
                            <div className="w-40"><NumField label="Umbral (SMMLV)" value={f.exoneration_threshold_smmlv} onChange={set('exoneration_threshold_smmlv')} step="0.01" /></div>
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-semibold mb-2">Provisiones prestaciones</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <NumField label="Cesantías" value={f.cesantias_pct} onChange={set('cesantias_pct')} step="0.0001" />
                            <NumField label="Int. cesantías (anual)" value={f.intereses_cesantias_pct} onChange={set('intereses_cesantias_pct')} step="0.01" />
                            <NumField label="Prima" value={f.prima_pct} onChange={set('prima_pct')} step="0.0001" />
                            <NumField label="Vacaciones" value={f.vacaciones_pct} onChange={set('vacaciones_pct')} step="0.0001" />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">ARL por clase de riesgo se edita por SQL (arl_rates jsonb): {JSON.stringify(config.arl_rates)}</p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
                    <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AddYearDialog({ open, onOpenChange, existing, onSaved }: {
    open: boolean; onOpenChange: (v: boolean) => void; existing: number[]; onSaved: () => void;
}) {
    const { toast } = useToast();
    const [year, setYear] = useState<number>(new Date().getFullYear() + 1);
    const [smmlv, setSmmlv] = useState<number>(0);
    const [aux, setAux] = useState<number>(0);
    const [uvt, setUvt] = useState<number>(0);

    const mutation = useMutation({
        mutationFn: async () => {
            if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Año inválido (2000–2100)');
            if (existing.includes(year)) throw new Error(`El año ${year} ya existe`);
            if (!Number.isFinite(smmlv) || smmlv <= 0) throw new Error('SMMLV debe ser mayor a 0');
            if (aux < 0 || uvt < 0) throw new Error('Auxilio/UVT no pueden ser negativos');
            const { error } = await supabase.from('payroll_config').insert({
                year, smmlv, transport_aid: aux, uvt: uvt || null,
            });
            if (error) throw error;
        },
        onError: (e: any) => toast({ title: 'No se pudo agregar', description: e.message, variant: 'destructive' }),
        onSuccess: () => { toast({ title: `Año ${year} agregado`, description: 'Los % se tomaron por defecto de ley; ajústalos si cambió la norma.' }); onOpenChange(false); onSaved(); },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Agregar año</DialogTitle>
                    <DialogDescription>Los porcentajes de ley se aplican por defecto; edítalos luego si cambió la regulación.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3 py-2">
                    <NumField label="Año" value={year} onChange={setYear} />
                    <NumField label="SMMLV" value={smmlv} onChange={setSmmlv} />
                    <NumField label="Auxilio transporte" value={aux} onChange={setAux} />
                    <NumField label="UVT" value={uvt} onChange={setUvt} />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
                    <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Agregar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
