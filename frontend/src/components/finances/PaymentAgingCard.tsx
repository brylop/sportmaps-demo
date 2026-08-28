import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { StatFilterBar } from '@/components/common/StatFilterBar';
import { TableRefreshBar } from '@/components/common/TableRefreshBar';
import { formatCurrency } from '@/lib/utils';
import { toWaPhone } from '@/lib/api/payment-reminders';

interface AgingReport {
  count: number;
  items: Array<{
    athlete: string;
    tipo: 'menor' | 'adulto' | 'no_registrado';
    child_id: string | null;
    adult_id: string | null;
    unregistered_athlete_id: string | null;
    branch_id: string | null;
    cuotas_debidas: number;
    periodo_mas_antiguo: string;
    periodos_debidos: string[];
    monto_pendiente: number;
    bucket: '1 mes' | '2 meses' | '3+ meses';
    canal_automatico: boolean;
    contacto_manual: { nombre: string | null; telefono: string | null; email: string | null } | null;
    clases_desde_vencimiento: number;
  }>;
  sin_atleta_identificable: number;
  en_revision: { count: number; monto: number };
  en_disputa: { count: number; monto: number };
  sin_canal_automatico: { atletas: number; monto: number };
}

const AGING_PAGE_SIZE = 25;

interface PaymentAgingCardProps {
  schoolId: string | null | undefined;
  activeBranchId: string | null | undefined;
  /** Para que el badge de conteo del tab, en el shell, no dependa de una segunda query. */
  onCount?: (n: number) => void;
  /**
   * F1 Cierre de Mes: acota la lista a quien debe ESE período específico
   * (`periodos_debidos` lo incluye), en vez de toda la cartera viva. No es un
   * snapshot congelado — sigue siendo la misma consulta en vivo, solo
   * filtrada en cliente. Opcional: sin esto, comportamiento intacto.
   */
  periodFilter?: { year: number; month: number };
  /** F1 Cierre de Mes: drill-down por atleta al hacer clic en una fila. */
  onAthleteClick?: (athlete: {
    child_id: string | null;
    adult_id: string | null;
    unregistered_athlete_id: string | null;
    name: string;
  }) => void;
}

/**
 * Antigüedad de cartera por atleta — RPC en el servidor (get_payment_aging_report),
 * no client-side sobre `payments`: ese fetch tiene FETCH_CAP y a los 2-3 meses
 * empezaría a perder atletas en el conteo de antigüedad.
 */
export function PaymentAgingCard({ schoolId, activeBranchId, onCount, periodFilter, onAthleteClick }: PaymentAgingCardProps) {
  const {
    data: agingReport,
    isLoading: agingLoading,
    isFetching: agingFetching,
    refetch: refetchAging,
  } = useQuery({
    queryKey: ['payment-aging-report', schoolId, activeBranchId],
    queryFn: async () => {
      // `as any`: RPC nueva, aún no está en los tipos generados de Supabase
      // (mismo patrón que preview_open_month/open_month en PaymentsAutomationPage).
      const { data, error } = await (supabase as any).rpc('get_payment_aging_report', {
        p_school_id: schoolId,
        p_branch_id: activeBranchId || null,
      });
      if (error) throw error;
      return data as AgingReport;
    },
    enabled: !!schoolId,
  });

  useEffect(() => { onCount?.(agingReport?.count ?? 0); }, [agingReport?.count, onCount]);

  // F1 Cierre de Mes: filtro opcional al período del cierre seleccionado —
  // sigue siendo la cartera EN VIVO (§0.2 del plan), solo acotada en cliente.
  const periodLabel = periodFilter ? `${String(periodFilter.month).padStart(2, '0')}/${periodFilter.year}` : null;
  const agingItems = (agingReport?.items ?? []).filter(
    (i) => !periodLabel || i.periodos_debidos.includes(periodLabel),
  );
  const [agingBucket, setAgingBucket] = useState<string | null>(null);
  const [agingPage, setAgingPage] = useState(1);
  useEffect(() => { setAgingPage(1); }, [agingBucket, schoolId, activeBranchId]);

  const agingCounts = agingItems.reduce(
    (acc, i) => { acc[i.bucket] = (acc[i.bucket] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );
  const filteredAging = agingBucket ? agingItems.filter(i => i.bucket === agingBucket) : agingItems;
  const agingTotalPages = Math.max(1, Math.ceil(filteredAging.length / AGING_PAGE_SIZE));
  const agingCurrentPage = Math.min(agingPage, agingTotalPages);
  const pagedAging = filteredAging.slice(
    (agingCurrentPage - 1) * AGING_PAGE_SIZE,
    agingCurrentPage * AGING_PAGE_SIZE,
  );

  return (
    <>
      {/* La cartera por cobro lista por COBRO: un atleta con 3 meses vencidos
          sale como 3 filas sueltas. Esto agrupa por atleta y cuenta PERÍODOS
          debidos, no días — "1 mes" vs "2 meses" vs "3+ meses" es la pregunta
          que hace la escuela, no cuántos días de atraso lleva cada cuota. */}
      <div className="mb-4">
        <StatFilterBar
          columns={4}
          value={agingBucket}
          onChange={(v) => setAgingBucket(v)}
          items={[
            { key: null, label: 'Todos', value: agingItems.length, tone: 'neutral' },
            { key: '1 mes', label: '1 mes', value: agingCounts['1 mes'] ?? 0, tone: 'yellow' },
            { key: '2 meses', label: '2 meses', value: agingCounts['2 meses'] ?? 0, tone: 'orange' },
            { key: '3+ meses', label: '3+ meses', value: agingCounts['3+ meses'] ?? 0, tone: 'rose' },
          ]}
        />
      </div>
      {agingReport && agingReport.sin_atleta_identificable > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Cobros sin atleta identificable</AlertTitle>
          <AlertDescription>
            {agingReport.sin_atleta_identificable} cobro(s) vivo(s) no tienen ningún
            atleta asociado (child_id/user_id/parent_id/unregistered_athlete_id todos
            vacíos) y quedan fuera de este reporte. Revisar en la base.
          </AlertDescription>
        </Alert>
      )}
      {/* No es cartera: quien subió comprobante o está en una glosa YA ACTUÓ.
          Se muestran aparte para no desaparecerlos, pero tampoco perseguirlos
          como si debieran. */}
      {agingReport && (agingReport.en_revision.count > 0 || agingReport.en_disputa.count > 0) && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {agingReport.en_revision.count > 0 && (
            <span className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 font-medium text-blue-700">
              {agingReport.en_revision.count} en revisión (comprobante subido) · {formatCurrency(agingReport.en_revision.monto)}
            </span>
          )}
          {agingReport.en_disputa.count > 0 && (
            <span className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1 font-medium text-violet-700">
              {agingReport.en_disputa.count} en disputa (glosa) · {formatCurrency(agingReport.en_disputa.monto)}
            </span>
          )}
        </div>
      )}
      {/* El cron de recordatorios exige parent_id: sin cuenta vinculada, a esta
          familia NUNCA le llega el aviso automático — solo por WhatsApp manual. */}
      {agingReport && agingReport.sin_canal_automatico.atletas > 0 && (
        <Alert className="mb-4 border-orange-300 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800">Sin recordatorio automático</AlertTitle>
          <AlertDescription className="text-orange-700">
            {agingReport.sin_canal_automatico.atletas} de {agingReport.count} atletas
            ({formatCurrency(agingReport.sin_canal_automatico.monto)}) no tienen cuenta
            vinculada — el cron de recordatorios no les llega. Están marcados abajo como
            "Manual"; hay que escribirles por WhatsApp con el contacto que trae cada fila.
          </AlertDescription>
        </Alert>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Atleta</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Meses debidos</TableHead>
            <TableHead>Monto pendiente</TableHead>
            <TableHead>Antigüedad</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Clases tomadas debiendo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!agingLoading && pagedAging.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                {agingBucket ? 'Ningún atleta cae en este filtro.' : 'No hay cartera pendiente.'}
              </TableCell>
            </TableRow>
          )}
          {pagedAging.map((item, idx) => (
            <TableRow key={`${item.athlete}-${idx}`}>
              <TableCell className="font-medium">
                {onAthleteClick ? (
                  <button
                    type="button"
                    className="underline decoration-dotted underline-offset-2 hover:text-primary text-left"
                    onClick={() => onAthleteClick({
                      child_id: item.child_id,
                      adult_id: item.adult_id,
                      unregistered_athlete_id: item.unregistered_athlete_id,
                      name: item.athlete,
                    })}
                  >
                    {item.athlete}
                  </button>
                ) : item.athlete}
              </TableCell>
              <TableCell className="capitalize">{item.tipo.replace('_', ' ')}</TableCell>
              {/* No solo el conteo: qué meses EXACTAMENTE — "2 meses" sin
                  decir cuáles era la queja de que este reporte no era claro. */}
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {item.periodos_debidos.map((p) => (
                    <span key={p} className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                      {p}
                    </span>
                  ))}
                </div>
              </TableCell>
              <TableCell className="font-bold text-red-500">
                {formatCurrency(item.monto_pendiente)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={item.bucket === '3+ meses' ? 'destructive' : 'outline'}
                  className={
                    item.bucket === '1 mes' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                    item.bucket === '2 meses' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                    ''
                  }
                >
                  {item.bucket}
                </Badge>
              </TableCell>
              <TableCell>
                {item.canal_automatico ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                    Automático
                  </Badge>
                ) : (
                  <div className="flex flex-col gap-1">
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300 w-fit">
                      Manual (sin cuenta)
                    </Badge>
                    {item.contacto_manual?.telefono && (() => {
                      const wa = toWaPhone(item.contacto_manual.telefono);
                      return wa ? (
                        <a
                          href={`https://wa.me/${wa}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {item.contacto_manual.nombre || item.contacto_manual.telefono}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {item.contacto_manual.nombre || item.contacto_manual.telefono}
                        </span>
                      );
                    })()}
                  </div>
                )}
              </TableCell>
              {/* Puramente informativo — la escuela decide qué hacer (cobrar,
                  hablar con la familia, o nada); esto no bloquea asistencia. */}
              <TableCell>
                {item.clases_desde_vencimiento > 0 ? (
                  <span className="text-sm font-medium text-orange-700">
                    {item.clases_desde_vencimiento} clase(s)
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TableRefreshBar
        className="-mx-6 -mb-6 mt-2 rounded-b-lg"
        onRefresh={refetchAging}
        loading={agingFetching}
        summary={
          `${filteredAging.length} atleta(s)` +
          (agingBucket ? ` de ${agingItems.length}` : '') +
          ` · ${formatCurrency(filteredAging.reduce((s, i) => s + Number(i.monto_pendiente), 0))}` +
          (agingTotalPages > 1 ? ` · página ${agingCurrentPage} de ${agingTotalPages}` : '')
        }
      >
        {agingTotalPages > 1 && (
          <>
            <Button variant="outline" size="sm" disabled={agingCurrentPage <= 1}
              onClick={() => setAgingPage(agingCurrentPage - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={agingCurrentPage >= agingTotalPages}
              onClick={() => setAgingPage(agingCurrentPage + 1)}>Siguiente</Button>
          </>
        )}
      </TableRefreshBar>
    </>
  );
}
