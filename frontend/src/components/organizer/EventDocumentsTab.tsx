import { useEffect, useState, useCallback } from 'react';
import { todayColombia } from '@/lib/dateUtils';
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
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Download, FileText, Loader2, FolderDown, AlertCircle,
  CheckCircle2, ChevronDown, School,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';

interface StudentDoc {
  id: string;
  full_name: string;
  team_name: string;
  has_document: boolean;
  documents: { name: string; path: string }[];
}

interface SchoolGroup {
  school_id: string;
  school_name: string;
  delegation_status: string;
  total_students: number;
  with_documents: number;
  students: StudentDoc[];
}

export default function EventDocumentsTab({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<SchoolGroup[]>([]);
  const [filterSchool, setFilterSchool] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadingSingle, setDownloadingSingle] = useState<string | null>(null);
  const [openSchools, setOpenSchools] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setSelected(new Set());

    try {
      const res = await bffClient.get<{ schools: SchoolGroup[] }>(
        `/api/v1/events/${eventId}/documents`,
      );
      setSchools(res.schools);
      // Auto-expand all schools
      setOpenSchools(new Set(res.schools.map(s => s.school_id)));
    } catch (err) {
      console.error('[EventDocumentsTab] Error loading documents:', err);
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtered view
  const filteredSchools = filterSchool === 'all'
    ? schools
    : schools.filter(s => s.school_id === filterSchool);

  // All students with docs across all visible schools
  const allStudentsWithDocs = filteredSchools.flatMap(s =>
    s.students.filter(st => st.has_document),
  );
  const allSelected = allStudentsWithDocs.length > 0
    && allStudentsWithDocs.every(st => selected.has(st.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allStudentsWithDocs.map(st => st.id)));
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

  const toggleSchoolCollapse = (schoolId: string) => {
    setOpenSchools(prev => {
      const next = new Set(prev);
      if (next.has(schoolId)) next.delete(schoolId);
      else next.add(schoolId);
      return next;
    });
  };

  // Select all students from a specific school
  const toggleSchool = (school: SchoolGroup) => {
    const schoolStudentIds = school.students.filter(s => s.has_document).map(s => s.id);
    const allSchoolSelected = schoolStudentIds.every(id => selected.has(id));

    setSelected(prev => {
      const next = new Set(prev);
      if (allSchoolSelected) {
        schoolStudentIds.forEach(id => next.delete(id));
      } else {
        schoolStudentIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Download single document
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

  // Bulk download as ZIP, organized by school folders
  const downloadZip = async () => {
    const selectedIds = selected;
    if (selectedIds.size === 0) return;

    setDownloading(true);
    const zip = new JSZip();

    for (const school of filteredSchools) {
      const schoolStudents = school.students.filter(
        s => selectedIds.has(s.id) && s.has_document,
      );
      if (schoolStudents.length === 0) continue;

      const safeSchoolName = school.school_name
        .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '')
        .trim();
      const folder = zip.folder(safeSchoolName)!;

      for (const student of schoolStudents) {
        for (const doc of student.documents) {
          try {
            const { data, error } = await supabase.storage
              .from('identity-documents')
              .createSignedUrl(doc.path, 300);

            if (error || !data?.signedUrl) continue;

            const resp = await fetch(data.signedUrl);
            const blob = await resp.blob();

            const ext = doc.name.split('.').pop() || 'pdf';
            const safeName = student.full_name
              .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '')
              .trim();
            folder.file(`${safeName}.${ext}`, blob);
          } catch {
            // skip failed downloads
          }
        }
      }
    }

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const date = todayColombia();
      saveAs(content, `documentos-evento-${date}.zip`);
    } catch (err) {
      console.error('Error generating ZIP:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Stats
  const totalStudents = schools.reduce((s, g) => s + g.total_students, 0);
  const withDocs = schools.reduce((s, g) => s + g.with_documents, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Cargando documentos de escuelas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escuelas Inscritas</CardTitle>
            <School className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schools.length}</div>
            <p className="text-xs text-muted-foreground">{totalStudents} atletas en total</p>
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
            <div className="text-2xl font-bold text-red-500">{totalStudents - withDocs}</div>
            <p className="text-xs text-muted-foreground">
              {totalStudents > 0 ? `${(((totalStudents - withDocs) / totalStudents) * 100).toFixed(0)}% del total` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + actions */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5 min-w-[220px]">
          <label className="text-sm font-medium">Escuela</label>
          <Select value={filterSchool} onValueChange={setFilterSchool}>
            <SelectTrigger>
              <SelectValue placeholder="Todas las escuelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las escuelas</SelectItem>
              {schools.map(s => (
                <SelectItem key={s.school_id} value={s.school_id}>
                  {s.school_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={toggleAll}
        >
          <Checkbox checked={allSelected} />
          {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos con doc.'}
        </Button>

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

      {/* Schools list */}
      {filteredSchools.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <School className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-30" />
            <p className="text-sm text-muted-foreground">
              No hay escuelas inscritas en este evento aún.
            </p>
          </CardContent>
        </Card>
      ) : (
        filteredSchools.map(school => {
          const schoolStudentIds = school.students.filter(s => s.has_document).map(s => s.id);
          const allSchoolSelected = schoolStudentIds.length > 0
            && schoolStudentIds.every(id => selected.has(id));

          return (
            <Collapsible
              key={school.school_id}
              open={openSchools.has(school.school_id)}
              onOpenChange={() => toggleSchoolCollapse(school.school_id)}
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={allSchoolSelected}
                        onCheckedChange={() => toggleSchool(school)}
                        aria-label={`Seleccionar toda la escuela ${school.school_name}`}
                      />
                      <div>
                        <CardTitle className="text-base">{school.school_name}</CardTitle>
                        <CardDescription>
                          {school.with_documents}/{school.total_students} con documento
                          <Badge variant="outline" className="ml-2">
                            {school.delegation_status === 'approved' ? 'Aprobada' : 'Pendiente pago'}
                          </Badge>
                        </CardDescription>
                      </div>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <ChevronDown className={`h-4 w-4 transition-transform ${openSchools.has(school.school_id) ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]" />
                            <TableHead>Atleta</TableHead>
                            <TableHead>Equipo</TableHead>
                            <TableHead>Documento</TableHead>
                            <TableHead className="w-[80px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {school.students.map(student => (
                            <TableRow key={student.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selected.has(student.id)}
                                  onCheckedChange={() => toggleOne(student.id)}
                                  disabled={!student.has_document}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{student.full_name}</TableCell>
                              <TableCell>{student.team_name}</TableCell>
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
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })
      )}
    </div>
  );
}
