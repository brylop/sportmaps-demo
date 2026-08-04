/**
 * ReconciliationTab — Fase 6: el admin sube el extracto bancario (CSV) y el
 * sistema cruza los pagos aprobados pendientes de conciliación. Lo que cruza
 * pasa a 'confirmado'; lo que no (dentro del rango del extracto) abre glosa
 * NO_APARECE_EN_BANCO. Debajo, dashboard de motivos de glosa.
 */
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseStatementCsv, type StatementLine } from '@/lib/reconciliation/parseStatement';
import { uploadStatement, getGlosaDashboard, type ReconcileSummary, type GlosaReasonCount } from '@/lib/api/reconciliation';

const REASON_LABELS: Record<string, string> = {
    MONTO_DIFIERE: 'Monto difiere',
    FECHA_FUERA_VENTANA: 'Fecha fuera de ventana',
    REFERENCIA_DUPLICADA: 'Referencia duplicada',
    DESTINO_NO_COINCIDE: 'Destino no coincide',
    CAMPOS_ILEGIBLES: 'Campos ilegibles',
    LECTURA_INCONSISTENTE: 'Lectura inconsistente',
    NO_APARECE_EN_BANCO: 'No aparece en el banco',
    OTRO: 'Otro',
};
const OPEN_STATUSES = ['GLOSADA', 'EN_RESPUESTA', 'EN_CONCILIACION'];

export function ReconciliationTab({ schoolId }: { schoolId: string }) {
    const { toast } = useToast();
    const [bank, setBank] = useState<'nequi' | 'bancolombia' | 'generic'>('generic');
    const [fileName, setFileName] = useState<string | null>(null);
    const [parsed, setParsed] = useState<{ lines: StatementLine[]; skipped: number; detectedColumns: Record<string, string | null> } | null>(null);
    const [uploading, setUploading] = useState(false);
    const [summary, setSummary] = useState<ReconcileSummary | null>(null);
    const [reasons, setReasons] = useState<GlosaReasonCount[]>([]);

    const loadDashboard = useCallback(async () => {
        try {
            const res = await getGlosaDashboard(schoolId);
            setReasons(res.reasons ?? []);
        } catch { /* dashboard es informativo; no romper la vista */ }
    }, [schoolId]);

    useEffect(() => { void loadDashboard(); }, [loadDashboard]);

    const handleFile = async (file: File) => {
        setSummary(null);
        setFileName(file.name);
        const text = await file.text();
        const result = parseStatementCsv(text);
        setParsed(result);
        if (result.lines.length === 0) {
            toast({
                title: 'No se detectaron movimientos',
                description: 'Verifica que el archivo sea CSV con columnas de fecha y valor. (Excel: expórtalo como CSV.)',
                variant: 'destructive',
            });
        }
    };

    const handleUpload = async () => {
        if (!parsed || parsed.lines.length === 0) return;
        setUploading(true);
        try {
            const res = await uploadStatement({
                schoolId, bank, filename: fileName ?? undefined, lines: parsed.lines,
            });
            setSummary(res.summary);
            toast({
                title: 'Conciliación completa',
                description: `${res.summary.matched + res.summary.matched_weak} conciliados · ${res.summary.glosas_opened} glosas abiertas.`,
            });
            setParsed(null);
            setFileName(null);
            void loadDashboard();
        } catch (err: any) {
            toast({ title: 'No se pudo conciliar', description: err?.message || 'Intenta de nuevo.', variant: 'destructive' });
        } finally {
            setUploading(false);
        }
    };

    const openReasons = reasons.filter(r => OPEN_STATUSES.includes(r.status));

    return (
        <div className="space-y-6">
            {/* Carga del extracto */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <FileSpreadsheet className="h-5 w-5 text-green-500" /> Conciliar con extracto bancario
                    </CardTitle>
                    <CardDescription>
                        Sube el extracto (CSV) de Nequi/Bancolombia. Cruzamos los pagos aprobados pendientes
                        por monto + fecha + referencia. Lo que no cruce abre una aclaración al acudiente.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase text-muted-foreground">Banco</label>
                            <Select value={bank} onValueChange={(v: any) => setBank(v)}>
                                <SelectTrigger className="w-48 bg-white text-gray-900">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white text-gray-900">
                                    <SelectItem value="nequi">Nequi</SelectItem>
                                    <SelectItem value="bancolombia">Bancolombia</SelectItem>
                                    <SelectItem value="generic">Otro / CSV genérico</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase text-muted-foreground">Archivo (CSV)</label>
                            <input
                                type="file"
                                accept=".csv,text/csv"
                                onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
                                className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
                            />
                        </div>
                    </div>

                    {parsed && parsed.lines.length > 0 && (
                        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                            <p><strong>{parsed.lines.length}</strong> movimientos de ingreso detectados
                                {parsed.skipped > 0 && <span className="text-muted-foreground"> ({parsed.skipped} descartados: egresos o sin monto)</span>}.</p>
                            <p className="text-xs text-muted-foreground">
                                Columnas: fecha=<code>{parsed.detectedColumns.fecha ?? '—'}</code> ·
                                monto=<code>{parsed.detectedColumns.monto ?? '—'}</code> ·
                                ref=<code>{parsed.detectedColumns.referencia ?? '—'}</code>
                            </p>
                            <Button onClick={handleUpload} disabled={uploading} className="mt-2">
                                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                                Conciliar {parsed.lines.length} movimientos
                            </Button>
                        </div>
                    )}

                    {summary && (
                        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm space-y-1">
                            <p className="flex items-center gap-2 font-semibold text-green-700">
                                <CheckCircle2 className="h-4 w-4" /> Conciliación completa
                            </p>
                            <p>Pagos en rango: <strong>{summary.pending_in_range}</strong></p>
                            <p>Conciliados: <strong>{summary.matched}</strong> exactos + <strong>{summary.matched_weak}</strong> por monto/fecha</p>
                            <p className="flex items-center gap-1">
                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                                Glosas abiertas (no aparecen en el banco): <strong>{summary.glosas_opened}</strong>
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dashboard de motivos */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <BarChart3 className="h-5 w-5 text-blue-500" /> Aclaraciones por motivo
                    </CardTitle>
                    <CardDescription>Motivos de las glosas abiertas de tu escuela.</CardDescription>
                </CardHeader>
                <CardContent>
                    {openReasons.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay aclaraciones abiertas. 🎉</p>
                    ) : (
                        <div className="space-y-2">
                            {openReasons
                                .sort((a, b) => b.cnt - a.cnt)
                                .map((r, i) => (
                                    <div key={i} className="flex items-center justify-between rounded-md border p-2">
                                        <span className="text-sm">{REASON_LABELS[r.reason] ?? r.reason}</span>
                                        <Badge variant="outline">{r.cnt}</Badge>
                                    </div>
                                ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
