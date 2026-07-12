import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { FileBarChart, TrendingUp, TrendingDown, Scale, Download, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface LedgerRow {
    direction: 'income' | 'expense';
    concept: string;
    category_id: string | null;
    amount: number;
    movement_date: string | null;
}

export default function AccountingReportsPage() {
    const { schoolId } = useSchoolContext();
    const [year, setYear] = useState(new Date().getFullYear());

    const ledgerQuery = useQuery({
        queryKey: ['acc-report-ledger', schoolId, year],
        enabled: !!schoolId,
        queryFn: async () => {
            const from = `${year}-01-01`;
            const to = `${year}-12-31`;
            const { data, error } = await supabase
                .from('cash_ledger')
                .select('direction, concept, category_id, amount, movement_date')
                .eq('owner_type', 'school').eq('owner_id', schoolId)
                .gte('movement_date', from).lte('movement_date', to);
            if (error) throw error;
            return (data ?? []) as LedgerRow[];
        },
    });

    const categoriesQuery = useQuery({
        queryKey: ['expense-categories-map', schoolId],
        enabled: !!schoolId,
        queryFn: async () => {
            const { data, error } = await supabase.from('expense_categories')
                .select('id, name').or(`owner_id.is.null,owner_id.eq.${schoolId}`);
            if (error) throw error;
            const map: Record<string, string> = {};
            (data ?? []).forEach((c: any) => { map[c.id] = c.name; });
            return map;
        },
    });

    const rows = ledgerQuery.data ?? [];
    const catMap = categoriesQuery.data ?? {};

    const report = useMemo(() => {
        let income = 0, expense = 0;
        const byCat: Record<string, number> = {};
        const monthly = MONTHS.map((m) => ({ month: m, ingresos: 0, egresos: 0 }));
        for (const r of rows) {
            const amt = Number(r.amount);
            const mi = r.movement_date ? new Date(r.movement_date).getUTCMonth() : null;
            if (r.direction === 'income') {
                income += amt;
                if (mi !== null) monthly[mi].ingresos += amt;
            } else {
                expense += amt;
                const key = r.category_id ? (catMap[r.category_id] || 'Otra') : 'Sin categoría';
                byCat[key] = (byCat[key] || 0) + amt;
                if (mi !== null) monthly[mi].egresos += amt;
            }
        }
        const catRows = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
        return { income, expense, net: income - expense, catRows, monthly };
    }, [rows, catMap]);

    const exportCSV = () => {
        const lines: string[] = [
            `Estado de resultados ${year}`,
            '',
            'RESUMEN',
            `Ingresos,${report.income}`,
            `Egresos,${report.expense}`,
            `Neto,${report.net}`,
            '',
            'EGRESOS POR CATEGORÍA',
            'Categoría,Monto',
            ...report.catRows.map((c) => `${c.name},${c.value}`),
            '',
            'FLUJO MENSUAL',
            'Mes,Ingresos,Egresos,Neto',
            ...report.monthly.map((m) => `${m.month},${m.ingresos},${m.egresos},${m.ingresos - m.egresos}`),
        ];
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `estado-resultados-${year}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (ledgerQuery.isError) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <h1 className="text-3xl font-bold flex items-center gap-2"><FileBarChart className="h-7 w-7 text-primary" /> Estado de resultados</h1>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No se pudo cargar</AlertTitle>
                    <AlertDescription className="mt-1 flex flex-col items-start gap-3">
                        <span>Error de conexión al cargar el libro de caja.</span>
                        <Button size="sm" variant="outline" onClick={() => ledgerQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Reintentar</Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <FileBarChart className="h-7 w-7 text-primary" /> Estado de resultados
                    </h1>
                    <p className="text-muted-foreground">Ingresos, egresos y flujo de caja del año.</p>
                </div>
                <div className="flex items-end gap-2">
                    <div className="grid gap-1.5">
                        <Label className="text-xs">Año</Label>
                        <Input type="number" className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))} />
                    </div>
                    <Button variant="outline" onClick={exportCSV} disabled={rows.length === 0}>
                        <Download className="mr-2 h-4 w-4" /> Exportar CSV
                    </Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresos {year}</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold text-emerald-600">{formatCurrency(report.income)}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Egresos {year}</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(report.expense)}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Resultado neto</CardTitle>
                        <Scale className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent><div className={`text-2xl font-bold ${report.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(report.net)}</div></CardContent>
                </Card>
            </div>

            {ledgerQuery.isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Flujo mensual</CardTitle>
                            <CardDescription>Ingresos vs egresos por mes</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={report.monthly}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" fontSize={12} />
                                    <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                                    <Legend />
                                    <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" />
                                    <Bar dataKey="egresos" name="Egresos" fill="#ef4444" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Egresos por categoría</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            {report.catRows.length === 0 ? (
                                <div className="py-10 text-center text-sm text-muted-foreground">Sin egresos en {year}.</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Categoría</TableHead>
                                            <TableHead className="text-right">Monto</TableHead>
                                            <TableHead className="text-right">% del total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {report.catRows.map((c) => (
                                            <TableRow key={c.name}>
                                                <TableCell className="font-medium">{c.name}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(c.value)}</TableCell>
                                                <TableCell className="text-right text-muted-foreground">
                                                    {report.expense > 0 ? `${((c.value / report.expense) * 100).toFixed(1)}%` : '—'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
