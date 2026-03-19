// Classes/Programs API service — uses Supabase directly (table: teams)
// Per NAMING_DICTIONARY.md: "classes" in UI = "teams" in Supabase
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from './bffClient';
type TeamRow = any;
type TeamWithCoach = TeamRow & { coach?: { full_name: string | null } | null };

export interface Schedule {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string;
  end_time: string;
}

const isValidUUID = (id: string | null | undefined): boolean => {
  if (!id) return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(id);
};

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
      .from('teams')
      .insert({
        name: classData.name,
        description: classData.description,
        sport: classData.sport,
        school_id: classData.school_id,
        coach_id: classData.coach_id,
        price_monthly: classData.price || 0,
        max_students: classData.capacity || 20,
        active: classData.status !== 'inactive',
      })
      .select(`
        *,
        coach:coach_id(full_name)
      `)
      .single();

    if (error) {
      console.error('Error creating program:', error);
      throw new Error(error.message || 'Failed to create class');
    }

    return this.mapTeamToClass(data);
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
      if (!params?.school_id || !isValidUUID(params.school_id)) {
        console.warn('getClasses called without valid school_id, returning empty array');
        return [];
      }

      let query = supabase
        .from('teams')
        .select(`
          *,
          coach:coach_id(full_name)
        `)
        .eq('school_id', params.school_id)
        .order('created_at', { ascending: false });
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

      return (data || []).map((t) => this.mapTeamToClass(t as TeamWithCoach));
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
      .from('teams')
      .select(`
        *,
        coach:coach_id(full_name)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Class not found');
    }

    return this.mapTeamToClass(data);
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
    if (updates.capacity !== undefined) updateData.max_students = updates.capacity;
    if (updates.status !== undefined) updateData.active = updates.status !== 'inactive';
    if (updates.coach_id !== undefined) updateData.coach_id = updates.coach_id;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('teams')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        coach:coach_id(full_name)
      `)
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to update class');
    }

    return this.mapTeamToClass(data);
  }

  /**
   * Delete a program
   */
  async deleteClass(id: string): Promise<void> {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message || 'Failed to delete class');
    }
  }

  /**
   * Enroll a student in a program using BFF endpoint
   */
  async enrollStudent(classId: string, studentId: string, studentName: string, isAdult: boolean = false): Promise<EnrollmentRecord> {
    const payload = isAdult
      ? { user_id: studentId, team_id: classId }
      : { child_id: studentId, team_id: classId };

    const data = await bffClient.post<{ id: string; created_at: string }>(
      '/api/v1/enrollments',
      payload
    );

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
      .eq('team_id', classId)
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
      // Obtener enrollments activos con user_id y child_id
      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select('id, created_at, child_id, user_id')
        .eq('team_id', classId)
        .eq('status', 'active');

      if (error) {
        console.warn('Error fetching enrolled students:', error.message);
        return [];
      }
      if (!enrollments || enrollments.length === 0) return [];

      // Recopilar IDs de ambos tipos
      const childIds = enrollments.map(e => e.child_id).filter(Boolean) as string[];
      const userIds = enrollments.map(e => e.user_id).filter(Boolean) as string[];
      const allIds = [...childIds, ...userIds];

      if (allIds.length === 0) return [];

      // Una sola query a school_athletes por ID
      const { data: athletes } = await (supabase as any)
        .from('school_athletes')
        .select('id, full_name, date_of_birth, avatar_url, athlete_type, parent_name')
        .in('id', allIds);

      const athleteMap = Object.fromEntries(
        (athletes || []).map((a: any) => [a.id, a])
      );

      return enrollments.map((enrollment: any) => {
        const athleteId = enrollment.child_id ?? enrollment.user_id;
        return {
          enrollment_id: enrollment.id,
          enrollment_date: enrollment.created_at,
          student: athleteMap[athleteId] ?? null,
        };
      });
    } catch (error) {
      console.warn('Error fetching class students:', error);
      return [];
    }
  }

  /**
   * Get class/program statistics for a school
   */
  async getStats(schoolId: string, branchId?: string | null, coachId?: string): Promise<ClassStats> {
    if ((!schoolId || !isValidUUID(schoolId)) && !coachId) {
      return { total: 0, active: 0, full: 0, by_sport: {}, total_enrolled: 0 };
    }
    try {
      let query = supabase
        .from('teams')
        .select('*');

      if (schoolId) {
        query = query.eq('school_id', schoolId);
      }

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      if (coachId) {
        // Obtener equipos via campo legacy Y junction table
        const [{ data: legacyTeams }, { data: junctionTeams }] = await Promise.all([
          supabase.from('teams').select('id').eq('coach_id', coachId),
          supabase.from('team_coaches').select('team_id').eq('coach_id', coachId),
        ]);
        const teamIds = [...new Set([
          ...(legacyTeams || []).map(t => t.id),
          ...(junctionTeams || []).map(t => t.team_id),
        ])];
        if (teamIds.length === 0) {
          return { total: 0, active: 0, full: 0, by_sport: {}, total_enrolled: 0 };
        }
        query = query.in('id', teamIds);
      }

      const { data: teams } = await query;

      if (!teams) return { total: 0, active: 0, full: 0, by_sport: {}, total_enrolled: 0 };

      const total = teams.length;
      const active = teams.filter(t => t.active).length;
      const full = 0; // Simple logic, can refine if capacity/student count comparison is needed

      const by_sport: Record<string, number> = {};
      teams.forEach(t => {
        if (t.sport) {
          by_sport[t.sport] = (by_sport[t.sport] || 0) + 1;
        }
      });

      const total_enrolled = teams.reduce((sum, t) => sum + (t.current_students || 0), 0);

      return { total, active, full, by_sport, total_enrolled };
    } catch (error) {
      console.warn('Error fetching class stats:', error);
      return { total: 0, active: 0, full: 0, by_sport: {}, total_enrolled: 0 };
    }
  }

  /**
   * Map a Supabase 'teams' row to the Class interface
   */
  private mapTeamToClass(team: TeamWithCoach): Class {
    return {
      id: team.id,
      name: team.name,
      description: team.description,
      sport: team.sport || '',
      level: (team.level || team.age_group || 'beginner') as 'beginner' | 'intermediate' | 'advanced',
      school_id: team.school_id || '',
      coach_id: team.coach_id,
      coach_name: team.coach?.full_name,
      capacity: team.max_students || 20,
      enrolled_count: team.current_students || 0,
      current_participants: team.current_students || 0,
      schedule: (team.schedule as unknown as Schedule[]) || [],
      price: team.price_monthly,
      price_monthly: team.price_monthly,
      status: team.active ? 'active' : 'inactive',
      active: team.active,
      created_at: team.created_at,
      updated_at: team.updated_at,
    };
  }
}

export const classesAPI = new ClassesAPI();
