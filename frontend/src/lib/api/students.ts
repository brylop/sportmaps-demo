// Students API service — uses Supabase directly (table: children)
// Per NAMING_DICTIONARY.md: tabla=children, UI=estudiantes
//
// MIGRACIÓN BFF (Feb 2026):
//   - Lecturas (GET):  siguen via Supabase SDK directo ← sin cambios
//   - bulkUpload:      migrado al BFF → POST /api/v1/students/bulk
//     Motivos: validación server-side, school_id forzado, reporte fila por fila
//
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from './bffClient';

const isValidUUID = (id: string | null | undefined): boolean => {
  if (!id) return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(id);
};

export interface Student {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  grade?: string;
  school_id: string;
  parent_id?: string | null;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  emergency_contact?: string;
  medical_notes?: string;
  medical_info?: string;
  sport?: string;
  team_name?: string;
  avatar_url?: string;
  status: 'active' | 'inactive' | 'suspended';
  enrollment_date?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentCreate {
  full_name: string;
  date_of_birth: string;
  school_id: string;
  grade?: string;
  emergency_contact?: string;
  parent_id?: string;
  medical_info?: string;
  sport?: string;
  team_name?: string;
  avatar_url?: string;
}

export interface StudentUpdate {
  full_name?: string;
  date_of_birth?: string;
  grade?: string;
  emergency_contact?: string;
  medical_info?: string;
  sport?: string;
  team_name?: string;
  avatar_url?: string;
  school_id?: string;
}

// ── Tipos de respuesta del BFF ────────────────────────────────────────────────
export interface BulkUploadResponse {
  success: boolean;
  message: string;
  summary: {
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
  };
  // Detalle de filas que no se procesaron (duplicados sin upsert, etc.)
  skipped: Array<{ document_id: string; reason: string }>;
  // Compatibilidad con código existente que lea .success / .failed / .errors
  /** @deprecated usar summary.inserted */
  failed: number;
  /** @deprecated usar skipped */
  errors: Array<{ row: number; error: string }>;
  /** @deprecated usar summary */
  students: Student[];
}

export interface BulkUploadOptions {
  /** Si true, actualiza estudiantes con document_id existente. Default: false */
  upsert?: boolean;
}

export interface StudentViewRow {
  id: string;
  full_name: string;
  date_of_birth: string;
  avatar_url?: string;
  sport?: string;
  parent_id?: string;
  school_id: string;
  created_at: string;
  parent_name?: string;
  parent_phone?: string;
  parent_avatar?: string;
  enrollment_id?: string;
  program_id?: string;
  enrollment_status?: string;
  program_name?: string;
  program_sport?: string;
  price_monthly?: number;
  branch_name?: string;
  medical_info?: string | null;
}

export interface StudentStats {
  total: number;
  active: number;
  inactive: number;
  by_grade: Record<string, number>;
}

// ── Columnas que acepta el BFF (mapeadas desde headers del CSV) ───────────────
interface BFFStudentRow {
  first_name: string;
  last_name: string;
  document_id: string;
  grade?: string;
  medical_info?: string;
  team?: string;
  sport?: string;
  // El BFF acepta más campos, estos son los que el CSV actual exporta
}

class StudentsAPI {
  /**
   * Create a new student (child) in Supabase
   */
  async createStudent(student: StudentCreate): Promise<Student> {
    const { data, error } = await supabase
      .from('children')
      .insert({
        full_name: student.full_name,
        date_of_birth: student.date_of_birth,
        school_id: student.school_id,
        grade: student.grade,
        emergency_contact: student.emergency_contact,
        parent_id: student.parent_id || null,
        medical_info: student.medical_info,
        sport: student.sport,
        team_name: student.team_name,
        avatar_url: student.avatar_url,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating student:', error);
      throw new Error(error.message || 'Failed to create student');
    }

    return this.mapChildToStudent(data);
  }

  /**
   * Get enriched students data for School Management UI (uses 'students' VIEW)
   */
  async getSchoolView(schoolId: string, branchId?: string | null): Promise<StudentViewRow[]> {
    try {
      if (!schoolId || !isValidUUID(schoolId)) {
        return [];
      }
      let query = supabase
        .from('students')
        .select('*')
        .eq('school_id', schoolId);

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data as StudentViewRow[] || [];
    } catch (error: any) {
      console.error('Error fetching school students view:', error);
      return [];
    }
  }

  /**
   * Get students filtered by school, search term, etc.
   */
  async getStudents(params?: {
    school_id?: string;
    status?: string;
    grade?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<Student[]> {
    try {
      let query = supabase
        .from('children')
        .select('*, profiles:parent_id(full_name, phone, avatar_url)')
        .order('created_at', { ascending: false });

      if (params?.school_id) {
        query = query.eq('school_id', params.school_id);
      }
      if (params?.grade) {
        query = query.eq('grade', params.grade);
      }
      if (params?.search) {
        query = query.ilike('full_name', `%${params.search}%`);
      }

      const offset = params?.skip ?? 0;
      const limit = params?.limit ?? 100;
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        console.warn('Error fetching students from Supabase:', error.message);
        return [];
      }

      return (data || []).map((child: any) => this.mapChildToStudent(child));
    } catch (error) {
      console.warn('Error fetching students:', error);
      return [];
    }
  }

  /**
   * Get a single student by ID
   */
  async getStudent(id: string): Promise<Student> {
    const { data, error } = await supabase
      .from('children')
      .select('*, profiles:parent_id(full_name, phone, avatar_url)')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Student not found');
    }

    return this.mapChildToStudent(data);
  }

  /**
   * Update a student
   */
  async updateStudent(id: string, updates: StudentUpdate): Promise<Student> {
    const { data, error } = await supabase
      .from('children')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to update student');
    }

    return this.mapChildToStudent(data);
  }

  /**
   * Delete a student
   */
  async deleteStudent(id: string): Promise<void> {
    const { error } = await supabase
      .from('children')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message || 'Failed to delete student');
    }
  }

  /**
   * Bulk upload students from CSV — parseado client-side, enviado al BFF.
   *
   * ANTES: insertaba fila por fila directo a Supabase (N queries, sin validación).
   * AHORA: parsea el CSV, arma el array, y hace UNA sola llamada al BFF.
   *        El BFF valida, inyecta school_id, detecta duplicados y retorna reporte.
   *
   * Compatible con el contrato anterior: retorna { success, failed, errors, students }
   */
  async bulkUpload(
    file: File,
    schoolId: string,  // Mantenido por compatibilidad — el BFF lo ignora y usa el JWT
    options: BulkUploadOptions = {},
  ): Promise<BulkUploadResponse> {

    // ── 1. Parsear el CSV (igual que antes) ───────────────────────────────
    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      return {
        success: false,
        message: 'El archivo CSV está vacío o solo tiene encabezados.',
        summary: { total: 0, inserted: 0, updated: 0, skipped: 0 },
        skipped: [],
        failed: 0, errors: [], students: [],
      };
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const parseErrors: Array<{ row: number; error: string }> = [];
    const students: BFFStudentRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

      // Mapear headers en español e inglés (igual que antes)
      const firstName = row['first_name'] || row['nombre'] || '';
      const lastName = row['last_name'] || row['apellido'] || '';
      const docId = row['document_id'] || row['documento'] || row['cedula'] || '';

      // full_name como fallback si el CSV no tiene first/last separados
      if (!firstName && !lastName) {
        const fullName = row['full_name'] || row['nombre_completo'] || '';
        if (!fullName) {
          parseErrors.push({ row: i + 1, error: 'Falta nombre del estudiante' });
          continue;
        }
        // Dividir en first/last por el primer espacio
        const parts = fullName.split(' ');
        students.push({
          first_name: parts[0],
          last_name: parts.slice(1).join(' ') || '-',
          document_id: docId || `AUTO-${i}`,   // fallback si no hay documento
          grade: row['grade'] || row['grado'] || undefined,
          medical_info: row['medical_info'] || row['notas_medicas'] || undefined,
          team: row['team'] || row['equipo'] || undefined,
          sport: row['sport'] || row['deporte'] || undefined,
        });
        continue;
      }

      if (!docId) {
        parseErrors.push({ row: i + 1, error: 'Falta document_id / documento' });
        continue;
      }

      students.push({
        first_name: firstName,
        last_name: lastName,
        document_id: docId,
        grade: row['grade'] || row['grado'] || undefined,
        medical_info: row['medical_info'] || row['notas_medicas'] || undefined,
        team: row['team'] || row['equipo'] || undefined,
        sport: row['sport'] || row['deporte'] || undefined,
      });
    }

    // Si todos fallaron en el parseo, no llamamos al BFF
    if (students.length === 0) {
      return {
        success: false,
        message: `No se pudo parsear ningún estudiante. ${parseErrors.length} errores.`,
        summary: { total: 0, inserted: 0, updated: 0, skipped: parseErrors.length },
        skipped: [],
        failed: parseErrors.length,
        errors: parseErrors,
        students: [],
      };
    }

    // ── 2. Llamar al BFF — UNA sola request en vez de N inserts ──────────
    const bffResponse = await bffClient.post<{
      success: boolean;
      message: string;
      summary: { total: number; inserted: number; updated: number; skipped: number };
      skipped: Array<{ document_id: string; reason: string }>;
    }>('/api/v1/students/bulk', {
      students,
      options: { upsert: options.upsert ?? false },
    });

    // ── 3. Adaptar respuesta al contrato anterior ─────────────────────────
    return {
      // Nuevos campos
      success: bffResponse.success,
      message: bffResponse.message,
      summary: bffResponse.summary,
      skipped: bffResponse.skipped,
      // Campos legacy para componentes que aún los lean
      failed: bffResponse.summary.skipped + parseErrors.length,
      errors: parseErrors,  // solo errores de parseo CSV, los del BFF están en skipped
      students: [],            // el BFF no retorna los objetos completos (no los necesitamos)
    };
  }

  /**
   * Get student statistics for a school
   */
  async getStats(schoolId: string, branchId?: string | null, coachId?: string): Promise<StudentStats> {
    if (!schoolId || !isValidUUID(schoolId)) {
      return { total: 0, active: 0, inactive: 0, by_grade: {} };
    }
    try {
      let query = supabase
        .from('children')
        .select('*', { count: 'exact', head: true });

      if (schoolId) {
        query = query.eq('school_id', schoolId);
      }

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      if (coachId) {
        // Enrolled students for this coach
        const { data: coachStudents } = await supabase
          .from('enrollments')
          .select('child_id, teams!inner(coach_id)')
          .eq('teams.coach_id', coachId);

        const studentIds = (coachStudents || []).map(s => s.child_id);
        if (studentIds.length > 0) {
          query = query.in('id', studentIds);
        } else {
          // No students found for this coach
          return { total: 0, active: 0, inactive: 0, by_grade: {} };
        }
      }

      const { data: students, count: total } = await query;

      const by_grade: Record<string, number> = {};
      students?.forEach(s => {
        if (s.grade) {
          by_grade[s.grade] = (by_grade[s.grade] || 0) + 1;
        }
      });

      return {
        total: total || 0,
        active: total || 0,
        inactive: 0,
        by_grade,
      };
    } catch (error) {
      console.warn('Error fetching student stats:', error);
      return { total: 0, active: 0, inactive: 0, by_grade: {} };
    }
  }

  /**
   * Map a Supabase 'children' row to the Student interface
   */
  private mapChildToStudent(child: any): Student {
    const parentProfile = child.profiles;
    return {
      id: child.id,
      full_name: child.full_name,
      date_of_birth: child.date_of_birth,
      school_id: child.school_id || '',
      grade: child.grade,
      emergency_contact: child.emergency_contact,
      parent_id: child.parent_id,
      parent_name: parentProfile?.full_name || undefined,
      parent_phone: parentProfile?.phone || undefined,
      medical_notes: child.medical_info,
      medical_info: child.medical_info,
      sport: child.sport,
      team_name: child.team_name,
      avatar_url: child.avatar_url || parentProfile?.avatar_url,
      status: 'active',
      created_at: child.created_at,
      updated_at: child.updated_at,
    } as Student;
  }
}

export const studentsAPI = new StudentsAPI();
