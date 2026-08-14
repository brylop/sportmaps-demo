import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { FileText, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useAthleteReports } from '@/hooks/useAthleteReports';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function ChildReportsPage() {
  const { id } = useParams<{ id: string }>();

  const { data: child } = useQuery({
    queryKey: ['child-basic', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('children').select('id, full_name').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: reports, isLoading, error, refetch } = useAthleteReports('child', id);

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando informes..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Error al cargar los informes"
        message="Hubo un problema al recuperar los informes mensuales."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Informes Mensuales</h1>
        <p className="text-muted-foreground mt-1">
          {child?.full_name ? `Historial de ${child.full_name}` : 'Historial de informes publicados'}
        </p>
      </div>

      {!reports || reports.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground max-w-xs">
              Todavía no hay informes mensuales publicados para este atleta.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <Link key={r.id} to={`/children/${id}/reports/${r.id}`}>
              <Card className="hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">
                      {MESES[r.period_month - 1]} {r.period_year}
                    </p>
                    {r.viewed_at ? (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3" /> Visto
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-green-600 border-green-500/30 bg-green-500/5">
                        Nuevo
                      </Badge>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
