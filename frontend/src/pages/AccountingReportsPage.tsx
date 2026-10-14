import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { formatCurrency } from '@/lib/utils';
import { downloadCsv, pnlCsvRows, STORE_SALES_LABEL } from '@/lib/accounting/csv';
import { fetchStoreIncome } from '@/lib/accounting/income';
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

/** Fila de finance_pnl_monthly: ya agregada en el servidor. month NULL = sin fecha. */
interface PnlRow {
    month: number | null;
    direction: 'income' | 'expense';
    category_id: string | null;
    concept_key: string | null;
    total: number | string;
    n: number;
}

export default function AccountingReportsPage() {
    const { schoolId, activeBranchId } = useSchoolContext();
    const [year, setYear] = useState(new Date().getFullYear());

    // Contabilidad v2 F0 (plan §4 F5): el EdR se agrega en el servidor
    // (finance_pnl_monthly) en vez de bajar el libro crudo del año, que PostgREST
    // cortaba en 1.000 filas. Misma fórmula de ingreso que el libro y los KPIs.
    // Los movimientos sin fecha (month NULL) cuentan en el total del año pero en
    // ningún mes, y la pantalla lo dice.
    const ledgerQuery = useQuery({
        queryKey: ['acc-report-pnl', schoolId, year, activeBranchId],
        enabled: !!schoolId,
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc('finance_pnl_monthly', {
                p_owner_type: 'school',
                p_owner_id: schoolId,
                p_year: year,
                p_branch_id: activeBranchId || null,
            });
            if (error) throw error;
            return (data ?? []) as PnlRow[];
        },
    });

    // Ventas de la tienda escolar por mes (store_income_summary, mismo permiso
    // que el EdR). No están en cash_ledger (contrato contabilidad v2 §6): se
    // suman como la línea «Ventas de tienda». Sin tienda → null y el EdR queda
    // igual que antes.
    const storeQuery = useQuery({
        queryKey: ['acc-report-store', schoolId, year, activeBranchId],
        enabled: !!schoolId && year >= 2000 && year <= 2100,
        queryFn: async () => {
            const r = await fetchStoreIncome(supabase as any, {
                schoolId: schoolId as string,
                branchId: activeBranchId,
                from: `${year}-01-01`,
                to: `${year}-12-31`,
                group: 'month',
            });
            if (r.kind === 'error') throw new Error(r.message);
            return r.kind === 'ok' && r.hasStore ? r.buckets : null;
        },
    });
    const storeBuckets = storeQuery.data ?? null;

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
        let income = 0, expense = 0, undatedAmount = 0, undatedN = 0;
        const byCat: Record<string, number> = {};
        const monthly = MONTHS.map((m) => ({ month: m, ingresos: 0, egresos: 0, cobros: 0, tienda: 0 }));
        for (const r of rows) {
            const amt = Number(r.total);
            const mi = r.month != null ? r.month - 1 : null;
            // Sin fecha (importaciones viejas, C8): no son de ningún año; no se
            // suman al EdR pero se avisan para que no desaparezcan en silencio.
            if (mi === null) { undatedAmount += amt; undatedN += Number(r.n); continue; }
            if (r.direction === 'income') {
                income += amt;
                if (mi !== null) { monthly[mi].ingresos += amt; monthly[mi].cobros += amt; }
            } else {
                expense += amt;
                const key = r.category_id ? (catMap[r.category_id] || 'Otra') : 'Sin categoría';
                byCat[key] = (byCat[key] || 0) + amt;
                if (mi !== null) monthly[mi].egresos += amt;
            }
        }
        // Tienda: bucket 'YYYY-MM' del año (fecha = paid_at Bogotá).
        const cobrosTotal = income;
        let storeTotal = 0;
        if (storeBuckets) {
            for (const [bucket, amt] of Object.entries(storeBuckets)) {
                const m = /^(\d{4})-(\d{2})$/.exec(bucket);
                if (!m || Number(m[1]) !== year) continue;
                const mi = Number(m[2]) - 1;
                monthly[mi].tienda += amt;
                monthly[mi].ingresos += amt;
                storeTotal += amt;
            }
            income += storeTotal;
        }
        const catRows = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
        return {
            income, expense, net: income - expense, catRows, monthly, undatedAmount, undatedN,
            store: storeBuckets ? { cobros: cobrosTotal, tienda: storeTotal } : null,
        };
    }, [rows, catMap, storeBuckets, year]);

    // CSV para Excel en español: BOM UTF-8, separador ';', comillas correctas
    // (lib/accounting/csv). Antes iba con ',' y sin BOM: todo en la columna A y
    // los acentos rotos, y una categoría con coma partía la fila.
    // Con tienda: desglose «Mensualidades y cobros» / «Ventas de tienda» en el
    // resumen y en el flujo mensual (pnlCsvRows); sin tienda, igual que antes.
    const exportCSV = () => {
        downloadCsv(`estado-resultados-${year}.csv`, pnlCsvRows({
            year,
            income: report.income,
            expense: report.expense,
            net: report.net,
            catRows: report.catRows,
            monthly: report.monthly,
            store: report.store,
        }));
    };

    if (ledgerQuery.isError || storeQuery.isError) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <h1 className="text-3xl font-bold flex items-center gap-2"><FileBarChart className="h-7 w-7 text-primary" /> Estado de resultados</h1>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No se pudo cargar</AlertTitle>
                    <AlertDescription className="mt-1 flex flex-col items-start gap-3">
                        <span>Error de conexión al cargar el libro de caja.</span>
                        <Button size="sm" variant="outline" onClick={() => { ledgerQuery.refetch(); storeQuery.refetch(); }}><RefreshCw className="mr-2 h-4 w-4" /> Reintentar</Button>
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
                    <Button variant="outline" onClick={exportCSV} disabled={rows.length === 0 && !report.store?.tienda}>
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
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600" data-testid="pnl-income-total">{formatCurrency(report.income)}</div>
                        {report.store && (
                            <p className="text-xs text-muted-foreground mt-1" data-testid="pnl-income-breakdown">
                                Mensualidades {formatCurrency(report.store.cobros)} · Tienda {formatCurrency(report.store.tienda)}
                            </p>
                        )}
                    </CardContent>
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

            {report.undatedN > 0 && (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{report.undatedN} movimiento(s) sin fecha</AlertTitle>
                    <AlertDescription>
                        Suman {formatCurrency(report.undatedAmount)} y no se incluyen en ningún mes ni en el total del año
                        hasta que se les asigne una fecha.
                    </AlertDescription>
                </Alert>
            )}

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
                            <div className="h-chart-lg"><ResponsiveContainer width="100%" height="100%">
                                <BarChart data={report.monthly}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" fontSize={12} />
                                    <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                                    <Legend />
                                    {report.store ? (
                                        <>
                                            <Bar dataKey="cobros" name="Mensualidades y cobros" stackId="ing" fill="#22c55e" />
                                            <Bar dataKey="tienda" name={STORE_SALES_LABEL} stackId="ing" fill="#0ea5e9" />
                                        </>
                                    ) : (
                                        <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" />
                                    )}
                                    <Bar dataKey="egresos" name="Egresos" fill="#ef4444" />
                                </BarChart>
                            </ResponsiveContainer></div>
                        </CardContent>
                    </Card>

                    {report.store && (
                        <Card data-testid="pnl-monthly-table">
                            <CardHeader>
                                <CardTitle>Estado de resultados por mes</CardTitle>
                                <CardDescription>
                                    Ingresos por origen: mensualidades y cobros de la escuela, y ventas de la tienda (neto de reembolsos).
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0 overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="whitespace-nowrap">Concepto</TableHead>
                                            {MONTHS.map((m) => <TableHead key={m} className="text-right">{m}</TableHead>)}
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {([
                                            ['Mensualidades y cobros', 'cobros', report.store.cobros],
                                            [STORE_SALES_LABEL, 'tienda', report.store.tienda],
                                            ['Total ingresos', 'ingresos', report.income],
                                            ['Egresos', 'egresos', report.expense],
                                        ] as const).map(([label, key, total]) => (
                                            <TableRow key={key} data-testid={`pnl-row-${key}`}>
                                                <TableCell className={`whitespace-nowrap ${key === 'ingresos' ? 'font-semibold' : 'font-medium'}`}>{label}</TableCell>
                                                {report.monthly.map((m) => (
                                                    <TableCell key={m.month} className="text-right whitespace-nowrap">{formatCurrency(m[key])}</TableCell>
                                                ))}
                                                <TableCell className="text-right font-semibold whitespace-nowrap">{formatCurrency(total)}</TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow>
                                            <TableCell className="font-semibold">Resultado</TableCell>
                                            {report.monthly.map((m) => (
                                                <TableCell key={m.month} className="text-right whitespace-nowrap">{formatCurrency(m.ingresos - m.egresos)}</TableCell>
                                            ))}
                                            <TableCell className="text-right font-semibold whitespace-nowrap">{formatCurrency(report.net)}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

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
