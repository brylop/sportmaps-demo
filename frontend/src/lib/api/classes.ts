// Classes/Programs API service — uses Supabase directly (table: programs)
// Per NAMING_DICTIONARY.md: "classes" in UI = "programs" in Supabase
import { supabase } from '@/integrations/supabase/client';

export interface Schedule {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string;
  end_time: string;
}

export interface Class {
  id: string;
  name: string;
  description?: string;
  sport: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  school_id: string;
  coach_id?: string;
  coach_name?: string;
  capacity: number;
  enrolled_count: number;
  current_participants?: number;
  schedule: Schedule[];
  location?: string;
  price?: number;
  price_monthly?: number;
  status: 'active' | 'inactive' | 'full' | 'cancelled';
  start_date?: string;
  end_date?: string;
  active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassCreate {
  name: string;
  description?: string;
  sport: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  school_id: string;
  coach_id?: string;
  coach_name?: string;
  capacity?: number;
  schedule?: Schedule[];
  location?: string;
  price?: number;
  status?: 'active' | 'inactive' | 'full' | 'cancelled';
  start_date?: string;
  end_date?: string;
}

export interface ClassUpdate {
  name?: string;
  description?: string;
  sport?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  coach_id?: string;
  coach_name?: string;
  capacity?: number;
  schedule?: Schedule[];
  location?: string;
  price?: number;
  status?: 'active' | 'inactive' | 'full' | 'cancelled';
  start_date?: string;
  end_date?: string;
}

export interface EnrollmentRecord {
  id: string;
  class_id: string;
  student_id: string;
  student_name: string;
  enrollment_date: string;
  status: 'active' | 'dropped' | 'completed';
}

export interface ClassStats {
  total: number;
  active: number;
  full: number;
  by_sport: Record<string, number>;
  total_enrolled: number;
}

class ClassesAPI {
  /**
   * Create a new program (class) in Supabase
   */
  async createClass(classData: ClassCreate): Promise<Class> {
    const { data, error } = await supabase
      .from('programs')
      .insert({
        name: classData.name,
        description: classData.description,
        sport: classData.sport,
        school_id: classData.school_id,
        price_monthly: classData.price || 0,
        max_participants: classData.capacity || 20,
        active: classData.status !== 'inactive',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating program:', error);
      throw new Error(error.message || 'Failed to create class');
    }

    return this.mapProgramToClass(data);
  }

  /**
   * Get programs (classes) with filters
   */
  async getClasses(params?: {
    school_id?: string;
    sport?: string;
    level?: string;
    status?: string;
    coach_id?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<Class[]> {
    try {
      let query = supabase
        .from('programs')
        .select('*')
        .order('created_at', { ascending: false });

      if (params?.school_id) {
        query = query.eq('school_id', params.school_id);
      }
      if (params?.sport) {
        query = query.eq('sport', params.sport);
      }
      if (params?.status === 'active') {
        query = query.eq('active', true);
      } else if (params?.status === 'inactive') {
        query = query.eq('active', false);
      }
      if (params?.search) {
        query = query.ilike('name', `%${params.search}%`);
      }

      const offset = params?.skip ?? 0;
      const limit = params?.limit ?? 100;
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        console.warn('Error fetching programs from Supabase:', error.message);
        return [];
      }

      return (data || []).map((p: any) => this.mapProgramToClass(p));
    } catch (error) {
      console.warn('Error fetching classes:', error);
      return [];
    }
  }

  /**
   * Get a single program by ID
   */
  async getClass(id: string): Promise<Class> {
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Class not found');
    }

    return this.mapProgramToClass(data);
  }

  /**
   * Update a program
   */
  async updateClass(id: string, updates: ClassUpdate): Promise<Class> {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.sport !== undefined) updateData.sport = updates.sport;
    if (updates.price !== undefined) updateData.price_monthly = updates.price;
    if (updates.capacity !== undefined) updateData.max_participants = updates.capacity;
    if (updates.status !== undefined) updateData.active = updates.status !== 'inactive';
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('programs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to update class');
    }

    return this.mapProgramToClass(data);
  }

  /**
   * Delete a program
   */
  async deleteClass(id: string): Promise<void> {
    const { error } = await supabase
      .from('programs')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message || 'Failed to delete class');
    }
  }

  /**
   * Enroll a student in a program via Supabase enrollments table
   */
  async enrollStudent(classId: string, studentId: string, studentName: string): Promise<EnrollmentRecord> {
    // Get the user_id from children table (parent_id) or use directly
    const { data: child } = await supabase
      .from('children')
      .select('parent_id')
      .eq('id', studentId)
      .single();

    const { data, error } = await supabase
      .from('enrollments')
      .insert({
        program_id: classId,
        user_id: child?.parent_id || studentId,
        child_id: studentId,
        status: 'active',
        start_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to enroll student');
    }

    return {
      id: data.id,
      class_id: classId,
      student_id: studentId,
      student_name: studentName,
      enrollment_date: data.created_at,
      status: 'active',
    };
  }

  /**
   * Unenroll a student from a program
   */
  async unenrollStudent(classId: string, studentId: string): Promise<void> {
    const { error } = await supabase
      .from('enrollments')
      .update({ status: 'cancelled' })
      .eq('program_id', classId)
      .eq('child_id', studentId)
      .eq('status', 'active');

    if (error) {
      console.warn('Error unenrolling student:', error.message);
    }
  }

  /**
   * Get all students enrolled in a program
   */
  async getClassStudents(classId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          created_at,
          child_id,
          children:child_id(id, full_name, date_of_birth, avatar_url, parent_id)
        `)
        .eq('program_id', classId)
        .eq('status', 'active');

      if (error) {
        console.warn('Error fetching enrolled students:', error.message);
        return [];
      }

      return (data || []).map((enrollment: any) => ({
        enrollment_id: enrollment.id,
        enrollment_date: enrollment.created_at,
        student: enrollment.children,
      }));
    } catch (error) {
      console.warn('Error fetching class students:', error);
      return [];
    }
  }

  /**
   * Get class/program statistics for a school
   */
  async getStats(schoolId: string): Promise<ClassStats> {
    try {
      const { data: programs } = await supabase
        .from('programs')
        .select('id, sport, active, current_participants')
        .eq('school_id', schoolId);

      if (!programs) return { total: 0, active: 0, full: 0, by_sport: {}, total_enrolled: 0 };

      const total = programs.length;
      const active = programs.filter(p => p.active).length;
      const full = 0; // Would need to compare current_participants vs max_participants

      const by_sport: Record<string, number> = {};
      programs.forEach(p => {
        if (p.sport) {
          by_sport[p.sport] = (by_sport[p.sport] || 0) + 1;
        }
      });

      const total_enrolled = programs.reduce((sum, p) => sum + (p.current_participants || 0), 0);

      return { total, active, full, by_sport, total_enrolled };
    } catch (error) {
      console.warn('Error fetching class stats:', error);
      return { total: 0, active: 0, full: 0, by_sport: {}, total_enrolled: 0 };
    }
  }

  /**
   * Map a Supabase 'programs' row to the Class interface
   */
  private mapProgramToClass(program: any): Class {
    return {
      id: program.id,
      name: program.name,
      description: program.description,
      sport: program.sport || '',
      level: program.level || 'beginner',
      school_id: program.school_id || '',
      coach_id: program.coach_id,
      capacity: program.max_participants || 20,
      enrolled_count: program.current_participants || 0,
      current_participants: program.current_participants || 0,
      schedule: program.schedule || [],
      price: program.price_monthly,
      price_monthly: program.price_monthly,
      status: program.active ? 'active' : 'inactive',
      active: program.active,
      created_at: program.created_at,
      updated_at: program.updated_at,
    };
  }
}

export const classesAPI = new ClassesAPI();
