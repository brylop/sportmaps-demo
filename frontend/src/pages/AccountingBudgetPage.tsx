import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, Save, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface Category { id: string; name: string; }

export default function AccountingBudgetPage() {
    const { schoolId } = useSchoolContext();
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [year, setYear] = useState(new Date().getFullYear());
    const [amounts, setAmounts] = useState<Record<string, string>>({});

    const categoriesQuery = useQuery({
        queryKey: ['expense-categories', schoolId],
        enabled: !!schoolId,
        queryFn: async () => {
            const { data, error } = await supabase.from('expense_categories')
                .select('id, name').eq('active', true).or(`owner_id.is.null,owner_id.eq.${schoolId}`).order('name');
            if (error) throw error;
            return (data ?? []) as Category[];
        },
    });

    const budgetsQuery = useQuery({
        queryKey: ['budgets', schoolId, year],
        enabled: !!schoolId,
        queryFn: async () => {
            const { data, error } = await supabase.from('budgets')
                .select('category_id, amount')
                .eq('owner_type', 'school').eq('owner_id', schoolId)
                .eq('period_year', year).eq('period_month', 0);
            if (error) throw error;
            return (data ?? []) as { category_id: string; amount: number }[];
        },
    });

    const executedQuery = useQuery({
        queryKey: ['budget-executed', schoolId, year],
        enabled: !!schoolId,
        queryFn: async () => {
            const { data, error } = await supabase.from('expenses')
                .select('category_id, amount')
                .eq('owner_type', 'school').eq('owner_id', schoolId).eq('status', 'paid')
                .gte('expense_date', `${year}-01-01`).lte('expense_date', `${year}-12-31`);
            if (error) throw error;
            const map: Record<string, number> = {};
            (data ?? []).forEach((e: any) => { if (e.category_id) map[e.category_id] = (map[e.category_id] || 0) + Number(e.amount); });
            return map;
        },
    });

    // Sembrar el formulario cuando cargan los presupuestos.
    useEffect(() => {
        if (budgetsQuery.data) {
            const seed: Record<string, string> = {};
            budgetsQuery.data.forEach((b) => { seed[b.category_id] = String(Number(b.amount)); });
            setAmounts(seed);
        }
    }, [budgetsQuery.data]);

    const executed = executedQuery.data ?? {};
    const totals = useMemo(() => {
        const cats = categoriesQuery.data ?? [];
        let budget = 0, exec = 0;
        for (const c of cats) {
            budget += Number(amounts[c.id] || 0);
            exec += executed[c.id] || 0;
        }
        return { budget, exec };
    }, [categoriesQuery.data, amounts, executed]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!schoolId || !user?.id) throw new Error('Sin escuela/usuario');
            const rows = (categoriesQuery.data ?? [])
                .filter((c) => amounts[c.id] !== undefined && amounts[c.id] !== '')
                .map((c) => ({
                    owner_type: 'school', owner_id: schoolId, category_id: c.id,
                    period_year: year, period_month: 0, amount: Number(amounts[c.id]) || 0,
                    created_by: user.id,
                }));
            if (rows.length === 0) return;
            const { error } = await supabase.from('budgets')
                .upsert(rows, { onConflict: 'owner_type,owner_id,category_id,period_year,period_month' });
            if (error) throw error;
        },
        onError: (e: any) => toast({ title: 'No se pudo guardar', description: e.message, variant: 'destructive' }),
        onSuccess: () => {
            toast({ title: 'Presupuesto guardado' });
            queryClient.invalidateQueries({ queryKey: ['budgets', schoolId, year] });
        },
    });

    if (categoriesQuery.isError || budgetsQuery.isError) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <h1 className="text-3xl font-bold flex items-center gap-2"><PieChart className="h-7 w-7 text-primary" /> Presupuesto</h1>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No se pudo cargar</AlertTitle>
                    <AlertDescription className="mt-1 flex flex-col items-start gap-3">
                        <span>Error de conexión.</span>
                        <Button size="sm" variant="outline" onClick={() => { categoriesQuery.refetch(); budgetsQuery.refetch(); }}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const cats = categoriesQuery.data ?? [];

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <PieChart className="h-7 w-7 text-primary" /> Presupuesto anual
                    </h1>
                    <p className="text-muted-foreground">Define el presupuesto por categoría y compáralo con lo ejecutado.</p>
                </div>
                <div className="flex items-end gap-2">
                    <div className="grid gap-1.5">
                        <Label className="text-xs">Año</Label>
                        <Input type="number" className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))} />
                    </div>
                    <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Presupuestado</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{formatCurrency(totals.budget)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ejecutado</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{formatCurrency(totals.exec)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Disponible</CardTitle></CardHeader>
                    <CardContent><div className={`text-2xl font-bold ${totals.budget - totals.exec >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(totals.budget - totals.exec)}</div></CardContent></Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Por categoría</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {(categoriesQuery.isLoading || budgetsQuery.isLoading) ? (
                        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead className="w-40">Presupuesto anual</TableHead>
                                    <TableHead className="text-right">Ejecutado</TableHead>
                                    <TableHead className="w-48">Avance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cats.map((c) => {
                                    const budget = Number(amounts[c.id] || 0);
                                    const exec = executed[c.id] || 0;
                                    const pctNum = budget > 0 ? (exec / budget) * 100 : 0;
                                    const over = budget > 0 && exec > budget;
                                    return (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-medium">{c.name}</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number" min="0" className="h-8"
                                                    value={amounts[c.id] ?? ''}
                                                    onChange={(e) => setAmounts((p) => ({ ...p, [c.id]: e.target.value }))}
                                                    placeholder="0"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">{formatCurrency(exec)}</TableCell>
                                            <TableCell>
                                                {budget > 0 ? (
                                                    <div className="space-y-1">
                                                        <Progress value={Math.min(pctNum, 100)} className={over ? '[&>div]:bg-red-500' : ''} />
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-muted-foreground">{pctNum.toFixed(0)}%</span>
                                                            {over && <Badge variant="destructive" className="text-[10px]">Excedido</Badge>}
                                                        </div>
                                                    </div>
                                                ) : <span className="text-xs text-muted-foreground">Sin presupuesto</span>}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
