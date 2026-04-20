import { useEffect, useState, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Download, FileText, Loader2, FolderDown, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';

interface StudentDoc {
  id: string;
  full_name: string;
  team_name: string;
  plan_name: string;
  status: string;
  has_document: boolean;
  documents: { name: string; path: string }[];
}

type DocType = 'identity' | 'eps' | 'other';
const classifyDoc = (n: string): DocType => {
  if (n.startsWith('identity-') || n.startsWith('id-')) return 'identity';
  if (n.startsWith('eps-')) return 'eps';
  return 'other';
};
const hasType = (docs: { name: string }[], type: DocType) =>
  docs.some(d => classifyDoc(d.name) === type);

interface Team { id: string; name: string }
interface Plan { id: string; name: string }

export default function DocumentsReportTab() {
  const { schoolId, activeBranchId } = useSchoolContext();

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterPlan, setFilterPlan] = useState<string>('all');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadingSingle, setDownloadingSingle] = useState<string | null>(null);

  // Load filter options
  useEffect(() => {
    if (!schoolId) return;

    const loadFilters = async () => {
      const [teamsRes, plansRes] = await Promise.all([
        supabase
          .from('teams')
          .select('id, name')
          .eq('school_id', schoolId)
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('offering_plans')
          .select('id, name')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('name'),
      ]);

      setTeams(teamsRes.data || []);
      setPlans(plansRes.data || []);
    };

    loadFilters();
  }, [schoolId]);

  // Load students with documents
  const loadStudents = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setSelected(new Set());

    try {
      const params = new URLSearchParams();
      if (activeBranchId) params.set('branch_id', activeBranchId);
      if (filterTeam !== 'all') params.set('team_id', filterTeam);
      if (filterPlan !== 'all') params.set('offering_plan_id', filterPlan);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await bffClient.get<{ students: StudentDoc[] }>(
        `/api/v1/reports/school/documents${qs}`,
      );
      setStudents(res.students);
    } catch (err) {
      console.error('[DocumentsReportTab] Error loading documents:', err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId, activeBranchId, filterTeam, filterPlan]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  // Selection helpers
  const studentsWithDocs = students.filter(s => s.has_document);
  const allSelected = studentsWithDocs.length > 0 && studentsWithDocs.every(s => selected.has(s.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(studentsWithDocs.map(s => s.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Download a single student's document
  const downloadSingle = async (student: StudentDoc) => {
    if (student.documents.length === 0) return;
    setDownloadingSingle(student.id);

    try {
      const doc = student.documents[0];
      const { data, error } = await supabase.storage
        .from('identity-documents')
        .createSignedUrl(doc.path, 300);

      if (error || !data?.signedUrl) throw error || new Error('No URL');

      const resp = await fetch(data.signedUrl);
      const blob = await resp.blob();

      const ext = doc.name.split('.').pop() || 'pdf';
      const safeName = student.full_name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim();
      saveAs(blob, `${safeName}.${ext}`);
    } catch (err) {
      console.error('Error downloading document:', err);
    } finally {
      setDownloadingSingle(null);
    }
  };

  // Bulk download as ZIP
  const downloadZip = async () => {
    const toDownload = students.filter(s => selected.has(s.id) && s.has_document);
    if (toDownload.length === 0) return;

    setDownloading(true);
    const zip = new JSZip();

    for (const student of toDownload) {
      for (const doc of student.documents) {
        try {
          const { data, error } = await supabase.storage
            .from('identity-documents')
            .createSignedUrl(doc.path, 300);

          if (error || !data?.signedUrl) continue;

          const resp = await fetch(data.signedUrl);
          const blob = await resp.blob();

          const ext = doc.name.split('.').pop() || 'pdf';
          const safeName = student.full_name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim();
          zip.file(`${safeName}.${ext}`, blob);
        } catch {
          // skip failed downloads
        }
      }
    }

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const label = filterTeam !== 'all'
        ? teams.find(t => t.id === filterTeam)?.name || 'equipo'
        : filterPlan !== 'all'
          ? plans.find(p => p.id === filterPlan)?.name || 'plan'
          : 'todos';
      const safeName = label.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim();
      const date = new Date().toISOString().split('T')[0];
      saveAs(content, `documentos-${safeName}-${date}.zip`);
    } catch (err) {
      console.error('Error generating ZIP:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Stats
  const totalStudents = students.length;
  const withDocs = students.filter(s => s.has_document).length;
  const withoutDocs = totalStudents - withDocs;

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Estudiantes</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">
              {filterTeam !== 'all' || filterPlan !== 'all' ? 'Con filtro aplicado' : 'En la escuela'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Documento</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{withDocs}</div>
            <p className="text-xs text-muted-foreground">
              {totalStudents > 0 ? `${((withDocs / totalStudents) * 100).toFixed(0)}% del total` : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin Documento</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{withoutDocs}</div>
            <p className="text-xs text-muted-foreground">
              {totalStudents > 0 ? `${((withoutDocs / totalStudents) * 100).toFixed(0)}% del total` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + actions */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos de Identidad</CardTitle>
          <CardDescription>
            Filtra por equipo o plan y descarga los documentos de tus estudiantes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 min-w-[200px]">
              <label className="text-sm font-medium">Equipo</label>
              <Select value={filterTeam} onValueChange={setFilterTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los equipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los equipos</SelectItem>
                  {teams.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-[200px]">
              <label className="text-sm font-medium">Plan</label>
              <Select value={filterPlan} onValueChange={setFilterPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los planes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los planes</SelectItem>
                  {plans.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="default"
              className="gap-2"
              disabled={selected.size === 0 || downloading}
              onClick={downloadZip}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderDown className="h-4 w-4" />
              )}
              {downloading
                ? 'Generando ZIP...'
                : `Descargar ZIP (${selected.size})`}
            </Button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Cargando documentos...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <FileText className="h-10 w-10 opacity-30" />
              <p className="text-sm">No se encontraron estudiantes con los filtros aplicados.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Seleccionar todos"
                      />
                    </TableHead>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-center">Identidad</TableHead>
                    <TableHead className="text-center">EPS</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map(student => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(student.id)}
                          onCheckedChange={() => toggleOne(student.id)}
                          disabled={!student.has_document}
                          aria-label={`Seleccionar ${student.full_name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{student.full_name}</TableCell>
                      <TableCell>{student.team_name}</TableCell>
                      <TableCell>{student.plan_name}</TableCell>
                      <TableCell>
                        <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
                          {student.status === 'active' ? 'Activo' : student.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {hasType(student.documents, 'identity') ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 inline" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500 inline" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasType(student.documents, 'eps') ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 inline" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500 inline" />
                        )}
                      </TableCell>
                      <TableCell>
                        {student.has_document ? (
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            {student.documents.length} archivo{student.documents.length > 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-500 border-red-300">
                            Sin documento
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {student.has_document && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            disabled={downloadingSingle === student.id}
                            onClick={() => downloadSingle(student)}
                          >
                            {downloadingSingle === student.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
