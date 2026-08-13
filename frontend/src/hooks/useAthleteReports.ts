import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getAthleteReports,
  getAthleteReportDetail,
  markReportViewed,
  type SubjectType,
} from '@/lib/school/reportsQueries';

export function useAthleteReports(subjectType: SubjectType, subjectId?: string) {
  return useQuery({
    queryKey: ['athlete-reports', subjectType, subjectId],
    queryFn: () => getAthleteReports(subjectType, subjectId!),
    enabled: !!subjectId,
  });
}

/** Al cargar el detalle, marca el informe como visto una sola vez por sesión de hook. */
export function useAthleteReportDetail(id?: string) {
  const markedRef = useRef<string | null>(null);
  const query = useQuery({
    queryKey: ['athlete-report-detail', id],
    queryFn: () => getAthleteReportDetail(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (query.data && markedRef.current !== id) {
      markedRef.current = id ?? null;
      markReportViewed(query.data.id);
    }
  }, [query.data, id]);

  return query;
}
