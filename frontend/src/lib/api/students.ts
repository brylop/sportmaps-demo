// Students API service — uses Supabase directly (table: children)
// Per NAMING_DICTIONARY.md: tabla=children, UI=estudiantes
import { supabase } from '@/integrations/supabase/client';

export interface Student {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  grade?: string;
  school_id: string;
  parent_id?: string | null; // Nullable now
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

export interface BulkUploadResponse {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
  students: Student[];
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
}

export interface StudentStats {
  total: number;
  active: number;
  inactive: number;
  by_grade: Record<string, number>;
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
      let query = supabase
        .from('students') // Queries the Database View
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
   * Bulk upload students from CSV — parsed client-side, inserted via Supabase
   */
  async bulkUpload(file: File, schoolId: string): Promise<BulkUploadResponse> {
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    const success: Student[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      const fullName = row['full_name'] || row['nombre'] || row['name'];
      const dob = row['date_of_birth'] || row['fecha_nacimiento'] || row['dob'];

      if (!fullName) {
        errors.push({ row: i + 1, error: 'Missing full_name' });
        continue;
      }

      try {
        const { data, error } = await supabase
          .from('children')
          .insert({
            full_name: fullName,
            date_of_birth: dob || '2015-01-01',
            school_id: schoolId,
            grade: row['grade'] || row['grado'] || null,
            emergency_contact: row['emergency_contact'] || row['contacto_emergencia'] || null,
            medical_info: row['medical_info'] || row['notas_medicas'] || null,
            sport: row['sport'] || row['deporte'] || null,
            team_name: row['team_name'] || row['equipo'] || null,
            parent_id: null // Explicitly null for bulk uploads until linked
          })
          .select()
          .single();

        if (error) {
          errors.push({ row: i + 1, error: error.message });
        } else if (data) {
          success.push(this.mapChildToStudent(data));
        }
      } catch (e: any) {
        errors.push({ row: i + 1, error: e.message });
      }
    }

    return {
      success: success.length,
      failed: errors.length,
      errors,
      students: success,
    };
  }

  /**
   * Get student statistics for a school
   */
  async getStats(schoolId: string, branchId?: string | null): Promise<StudentStats> {
    try {
      let query = supabase
        .from('children')
        .select('grade', { count: 'exact' })
        .eq('school_id', schoolId);

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data: students, count: total } = await query;

      // Calculations
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
      status: 'active', // children table doesn't have status
      created_at: child.created_at,
      updated_at: child.updated_at,
    } as Student;
  }
}

export const studentsAPI = new StudentsAPI();
