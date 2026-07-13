import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Plus, Loader2, AlertCircle, RefreshCw, Play, DollarSign, FileText } from 'lucide-react';
import { z } from 'zod';
import { validate, zRequiredText, zDocument, zAmountNonNeg, zOptionalText } from '@/lib/formValidation';

const employeeSchema = z.object({
    full_name: zRequiredText('El nombre'),
    document_id: zDocument('El documento'),
    base_salary: zAmountNonNeg('El salario'),
    eps: zOptionalText(80),
    afp: zOptionalText(80),
});

function FieldError({ msg }: { msg?: string }) {
    return msg ? <p className="text-xs text-destructive mt-1">{msg}</p> : null;
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const now = new Date();

interface Employee {
    id: string; full_name: string; document_id: string; contract_type: string;
    base_salary: number; transport_aid_eligible: boolean; arl_class: number | null;
    eps: string | null; afp: string | null; active: boolean;
}
interface Run {
    id: string; period_year: number; period_month: number; status: string;
    employee_count: number; total_gross: number; total_deductions: number;
    total_net: number; total_employer: number; total_provisions: number;
}
interface Item {
    id: string; employee_name: string; base_salary: number; transport_aid: number;
    total_deductions: number; total_employer: number; total_provisions: number; net_pay: number; exonerated: boolean;
}

export default function PayrollPage() {
    const { schoolId } = useSchoolContext();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [empOpen, setEmpOpen] = useState(false);
    const [editEmp, setEditEmp] = useState<Employee | null>(null);
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [selectedRun, setSelectedRun] = useState<string | null>(null);

    const employeesQuery = useQuery({
        queryKey: ['payroll-employees', schoolId],
        enabled: !!schoolId,
        queryFn: async () => {
            const { data, error } = await supabase.from('payroll_employees')
                .select('id, full_name, document_id, contract_type, base_salary, transport_aid_eligible, arl_class, eps, afp, active')
                .eq('owner_type', 'school').eq('owner_id', schoolId).eq('active', true).order('full_name');
            if (error) throw error;
            return (data ?? []) as Employee[];
        },
    });

    const runsQuery = useQuery({
        queryKey: ['payroll-runs', schoolId],
        enabled: !!schoolId,
        queryFn: async () => {
            const { data, error } = await supabase.from('payroll_runs')
                .select('id, period_year, period_month, status, employee_count, total_gross, total_deductions, total_net, total_employer, total_provisions')
                .eq('owner_type', 'school').eq('owner_id', schoolId)
                .order('period_year', { ascending: false }).order('period_month', { ascending: false });
            if (error) throw error;
            return (data ?? []) as Run[];
        },
    });

    const itemsQuery = useQuery({
        queryKey: ['payroll-items', selectedRun],
        enabled: !!selectedRun,
        queryFn: async () => {
            const { data, error } = await supabase.from('payroll_items')
                .select('id, employee_name, base_salary, transport_aid, total_deductions, total_employer, total_provisions, net_pay, exonerated')
                .eq('run_id', selectedRun).order('employee_name');
            if (error) throw error;
            return (data ?? []) as Item[];
        },
    });

    const printPayslip = () => {
        const run = runsQuery.data?.find((r) => r.id === selectedRun);
        const items = itemsQuery.data ?? [];
        if (!run || items.length === 0) return;
        const title = `Desprendible ${MONTHS[run.period_month - 1]} ${run.period_year}`;
        const body = items.map((it) => `
            <tr>
              <td>${it.employee_name}</td>
              <td class="r">${formatCurrency(Number(it.base_salary))}</td>
              <td class="r">${formatCurrency(Number(it.transport_aid))}</td>
              <td class="r">-${formatCurrency(Number(it.total_deductions))}</td>
              <td class="r">${formatCurrency(Number(it.total_employer))}</td>
              <td class="r">${formatCurrency(Number(it.total_provisions))}</td>
              <td class="r"><b>${formatCurrency(Number(it.net_pay))}</b></td>
            </tr>`).join('');
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
            <style>body{font-family:system-ui,Arial,sans-serif;padding:24px;color:#111}
            h1{font-size:18px;margin:0 0 4px} .sub{color:#666;font-size:12px;margin-bottom:16px}
            table{width:100%;border-collapse:collapse;font-size:12px}
            th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}
            th{background:#f5f5f5} .r{text-align:right}
            tfoot td{font-weight:bold;border-top:2px solid #333}</style></head>
            <body><h1>${title}</h1>
            <div class="sub">${run.employee_count} empleados · Neto ${formatCurrency(Number(run.total_net))} · Aportes ${formatCurrency(Number(run.total_employer))} · Costo caja ${formatCurrency(Number(run.total_net) + Number(run.total_employer))}</div>
            <table><thead><tr><th>Empleado</th><th class="r">Salario</th><th class="r">Auxilio</th><th class="r">Deducciones</th><th class="r">Aportes patr.</th><th class="r">Provisiones</th><th class="r">Neto</th></tr></thead>
            <tbody>${body}</tbody></table></body></html>`;
        const w = window.open('', '_blank');
        if (!w) { toast({ title: 'Permite ventanas emergentes para exportar el PDF', variant: 'destructive' }); return; }
        w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 250);
    };

    const invalidateRuns = () => queryClient.invalidateQueries({ queryKey: ['payroll-runs', schoolId] });
    const invalidateEmployees = () => queryClient.invalidateQueries({ queryKey: ['payroll-employees', schoolId] });

    const inactivateMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('payroll_employees').update({ active: false }).eq('id', id);
            if (error) throw error;
        },
        onError: (e: any) => toast({ title: 'No se pudo inactivar', description: e.message, variant: 'destructive' }),
        onSuccess: () => { toast({ title: 'Empleado inactivado' }); invalidateEmployees(); },
    });

    const runMutation = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase.rpc('run_payroll', {
                p_owner_type: 'school', p_owner_id: schoolId, p_year: year, p_month: month,
            });
            if (error) throw error;
            const res = data as any;
            if (res?.ok === false) throw new Error(res.error === 'no_config_for_year'
                ? `No hay parámetros de nómina para ${year} (pídele al super admin que los agregue).`
                : res.error === 'run_locked' ? 'Ese período ya está pagado/cerrado.'
                : res.error);
            return res;
        },
        onError: (e: any) => toast({ title: 'No se pudo calcular', description: e.message, variant: 'destructive' }),
        onSuccess: (res: any) => {
            toast({ title: 'Nómina calculada', description: `${res.employees} empleados · neto ${formatCurrency(res.total_net)}` });
            invalidateRuns();
            setSelectedRun(res.run_id);
        },
    });

    const payMutation = useMutation({
        mutationFn: async (runId: string) => {
            const { data, error } = await supabase.rpc('post_payroll_run', { p_run_id: runId, p_paid_date: null });
            if (error) throw error;
            const res = data as any;
            if (res?.ok === false) throw new Error(res.error);
            return res;
        },
        onError: (e: any) => toast({ title: 'No se pudo pagar', description: e.message, variant: 'destructive' }),
        onSuccess: (res: any) => {
            toast({ title: 'Nómina pagada', description: `Egreso ${formatCurrency(res.amount)} registrado en el libro.` });
            invalidateRuns();
            queryClient.invalidateQueries({ queryKey: ['cash-ledger', schoolId] });
        },
    });

    if (employeesQuery.isError || runsQuery.isError) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <h1 className="text-3xl font-bold flex items-center gap-2"><Users className="h-7 w-7 text-primary" /> Nómina</h1>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No se pudo cargar</AlertTitle>
                    <AlertDescription className="mt-1 flex flex-col items-start gap-3">
                        <span>Error de conexión.</span>
                        <Button size="sm" variant="outline" onClick={() => { employeesQuery.refetch(); runsQuery.refetch(); }}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const runs = runsQuery.data ?? [];
    const selected = runs.find(r => r.id === selectedRun);

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Users className="h-7 w-7 text-primary" /> Nómina
                </h1>
                <p className="text-muted-foreground">Calcula, revisa y paga la nómina mensual. El pago entra al libro de caja.</p>
            </div>

            <Tabs defaultValue="nomina" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="nomina">Nómina</TabsTrigger>
                    <TabsTrigger value="empleados">Empleados</TabsTrigger>
                </TabsList>

                {/* ── Nómina ── */}
                <TabsContent value="nomina" className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Correr nómina de un período</CardTitle></CardHeader>
                        <CardContent className="flex flex-wrap items-end gap-3">
                            <div className="grid gap-1.5">
                                <Label className="text-xs">Mes</Label>
                                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                                    <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-xs">Año</Label>
                                <Input type="number" className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))} />
                            </div>
                            <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending || (employeesQuery.data ?? []).length === 0}>
                                {runMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                Calcular nómina
                            </Button>
                            {(employeesQuery.data ?? []).length === 0 && (
                                <span className="text-xs text-muted-foreground">Agrega empleados primero (pestaña Empleados).</span>
                            )}
                        </CardContent>
                    </Card>

                    {/* Desprendible del run seleccionado */}
                    {selected && (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Desprendible {MONTHS[selected.period_month - 1]} {selected.period_year}
                                    {selected.status === 'paid'
                                        ? <Badge className="bg-emerald-500 text-white">Pagada</Badge>
                                        : <Badge variant="secondary">Borrador</Badge>}
                                </CardTitle>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={printPayslip}>
                                        <FileText className="mr-2 h-4 w-4" /> PDF
                                    </Button>
                                    {selected.status !== 'paid' && (
                                        <Button size="sm" onClick={() => payMutation.mutate(selected.id)} disabled={payMutation.isPending}>
                                            {payMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
                                            Pagar (caja {formatCurrency(selected.total_net + selected.total_employer)})
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {itemsQuery.isLoading ? (
                                    <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Empleado</TableHead>
                                                <TableHead className="text-right">Salario</TableHead>
                                                <TableHead className="text-right">Auxilio</TableHead>
                                                <TableHead className="text-right">Deducciones</TableHead>
                                                <TableHead className="text-right">Aportes patr.</TableHead>
                                                <TableHead className="text-right">Provisiones</TableHead>
                                                <TableHead className="text-right">Neto</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(itemsQuery.data ?? []).map((it) => (
                                                <TableRow key={it.id}>
                                                    <TableCell className="font-medium">
                                                        {it.employee_name}
                                                        {it.exonerated && <Badge variant="outline" className="ml-2 text-[10px]">exon.</Badge>}
                                                    </TableCell>
                                                    <TableCell className="text-right">{formatCurrency(Number(it.base_salary))}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(Number(it.transport_aid))}</TableCell>
                                                    <TableCell className="text-right text-red-600">−{formatCurrency(Number(it.total_deductions))}</TableCell>
                                                    <TableCell className="text-right text-muted-foreground">{formatCurrency(Number(it.total_employer))}</TableCell>
                                                    <TableCell className="text-right text-muted-foreground">{formatCurrency(Number(it.total_provisions))}</TableCell>
                                                    <TableCell className="text-right font-bold">{formatCurrency(Number(it.net_pay))}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Historial de nóminas */}
                    <Card>
                        <CardHeader><CardTitle>Períodos</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            {runsQuery.isLoading ? (
                                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                            ) : runs.length === 0 ? (
                                <div className="py-10 text-center text-sm text-muted-foreground">Aún no has corrido nóminas.</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Período</TableHead>
                                            <TableHead className="text-right">Empleados</TableHead>
                                            <TableHead className="text-right">Neto</TableHead>
                                            <TableHead className="text-right">Costo caja</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {runs.map((r) => (
                                            <TableRow key={r.id} className={r.id === selectedRun ? 'bg-muted/50' : ''}>
                                                <TableCell className="font-medium">{MONTHS[r.period_month - 1]} {r.period_year}</TableCell>
                                                <TableCell className="text-right">{r.employee_count}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(Number(r.total_net))}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(Number(r.total_net) + Number(r.total_employer))}</TableCell>
                                                <TableCell>{r.status === 'paid' ? <Badge className="bg-emerald-500 text-white">Pagada</Badge> : <Badge variant="secondary">Borrador</Badge>}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="sm" variant="ghost" onClick={() => setSelectedRun(r.id)}>Ver</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Empleados ── */}
                <TabsContent value="empleados" className="space-y-4">
                    <div className="flex justify-end">
                        <Button disabled={!schoolId} onClick={() => setEmpOpen(true)}><Plus className="mr-2 h-4 w-4" /> Empleado</Button>
                    </div>
                    <Card>
                        <CardContent className="p-0">
                            {employeesQuery.isLoading ? (
                                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                            ) : (employeesQuery.data ?? []).length === 0 ? (
                                <div className="py-10 text-center text-sm text-muted-foreground">Sin empleados. Agrega el primero.</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Documento</TableHead>
                                            <TableHead>Contrato</TableHead>
                                            <TableHead className="text-right">Salario</TableHead>
                                            <TableHead>ARL</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(employeesQuery.data ?? []).map((e) => (
                                            <TableRow key={e.id}>
                                                <TableCell className="font-medium">{e.full_name}</TableCell>
                                                <TableCell className="text-sm">{e.document_id}</TableCell>
                                                <TableCell className="text-sm capitalize">{e.contract_type.replace('_', ' ')}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(Number(e.base_salary))}</TableCell>
                                                <TableCell className="text-sm">{e.arl_class ? `Clase ${e.arl_class}` : '—'}</TableCell>
                                                <TableCell className="text-right whitespace-nowrap">
                                                    <Button size="sm" variant="ghost" onClick={() => setEditEmp(e)}>Editar</Button>
                                                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => inactivateMutation.mutate(e.id)} disabled={inactivateMutation.isPending}>Inactivar</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <EmployeeDialog open={empOpen} onOpenChange={setEmpOpen} schoolId={schoolId} onSaved={invalidateEmployees} />
            {editEmp && (
                <EmployeeDialog
                    key={editEmp.id} open employee={editEmp}
                    onOpenChange={(v) => !v && setEditEmp(null)}
                    schoolId={schoolId} onSaved={invalidateEmployees}
                />
            )}
        </div>
    );
}

function EmployeeDialog({ open, onOpenChange, schoolId, onSaved, employee }: {
    open: boolean; onOpenChange: (v: boolean) => void; schoolId: string | undefined; onSaved: () => void;
    employee?: Employee | null;
}) {
    const { toast } = useToast();
    const [name, setName] = useState(employee?.full_name ?? '');
    const [doc, setDoc] = useState(employee?.document_id ?? '');
    const [contract, setContract] = useState(employee?.contract_type ?? 'indefinido');
    const [salary, setSalary] = useState(employee ? String(Number(employee.base_salary)) : '');
    const [aux, setAux] = useState(employee?.transport_aid_eligible ?? true);
    const [arl, setArl] = useState(String(employee?.arl_class ?? 1));
    const [eps, setEps] = useState(employee?.eps ?? '');
    const [afp, setAfp] = useState(employee?.afp ?? '');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const mutation = useMutation({
        mutationFn: async () => {
            if (!schoolId) throw new Error('Sin escuela');
            const payload = {
                full_name: name.trim(), document_id: doc.trim(), contract_type: contract,
                base_salary: Number(salary), transport_aid_eligible: aux, arl_class: Number(arl),
                eps: eps || null, afp: afp || null,
            };
            if (employee) {
                const { error } = await supabase.from('payroll_employees').update(payload).eq('id', employee.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('payroll_employees').insert({
                    owner_type: 'school', owner_id: schoolId, ...payload,
                });
                if (error) throw error;
            }
        },
        onError: (e: any) => toast({ title: 'No se pudo guardar', description: e.message, variant: 'destructive' }),
        onSuccess: () => {
            toast({ title: employee ? 'Empleado actualizado' : 'Empleado agregado' });
            if (!employee) {
                setName(''); setDoc(''); setContract('indefinido'); setSalary(''); setAux(true); setArl('1'); setEps(''); setAfp('');
            }
            setErrors({});
            onOpenChange(false); onSaved();
        },
    });

    const handleSubmit = () => {
        const r = validate(employeeSchema, { full_name: name, document_id: doc, base_salary: salary, eps, afp });
        if (r.errors) { setErrors(r.errors); return; }
        setErrors({});
        mutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{employee ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle><DialogDescription>Contrato laboral para la nómina.</DialogDescription></DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Nombre <span className="text-destructive">*</span></Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.full_name} />
                            <FieldError msg={errors.full_name} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Documento <span className="text-destructive">*</span></Label>
                            <Input inputMode="numeric" value={doc} onChange={(e) => setDoc(e.target.value)} aria-invalid={!!errors.document_id} />
                            <FieldError msg={errors.document_id} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Tipo de contrato</Label>
                            <Select value={contract} onValueChange={setContract}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="indefinido">Indefinido</SelectItem>
                                    <SelectItem value="fijo">Término fijo</SelectItem>
                                    <SelectItem value="obra_labor">Obra o labor</SelectItem>
                                    <SelectItem value="prestacion_servicios">Prestación de servicios</SelectItem>
                                    <SelectItem value="aprendizaje">Aprendizaje</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Salario base (COP) <span className="text-destructive">*</span></Label>
                            <Input type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} aria-invalid={!!errors.base_salary} />
                            <FieldError msg={errors.base_salary} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Clase de riesgo ARL</Label>
                            <Select value={arl} onValueChange={setArl}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>Clase {n}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                            <Switch checked={aux} onCheckedChange={setAux} />
                            <span className="text-sm">Aplica auxilio de transporte</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2"><Label>EPS (opcional)</Label><Input value={eps} onChange={(e) => setEps(e.target.value)} /></div>
                        <div className="grid gap-2"><Label>AFP (opcional)</Label><Input value={afp} onChange={(e) => setAfp(e.target.value)} /></div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={mutation.isPending}>
                        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
