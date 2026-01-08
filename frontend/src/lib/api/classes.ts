// Classes API service
const API_URL = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;

export interface Schedule {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string; // HH:MM
  end_time: string; // HH:MM
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
  schedule: Schedule[];
  location?: string;
  price?: number;
  status: 'active' | 'inactive' | 'full' | 'cancelled';
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface ClassCreate {
  name: string;
  description?: string;
  sport: string;
  level: 'beginner' | 'intermediate' | 'advanced';
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
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_URL}/api/classes`;
  }

  async createClass(classData: ClassCreate): Promise<Class> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(classData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create class');
    }

    return response.json();
  }

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
    const queryParams = new URLSearchParams();
    
    if (params?.school_id) queryParams.append('school_id', params.school_id);
    if (params?.sport) queryParams.append('sport', params.sport);
    if (params?.level) queryParams.append('level', params.level);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.coach_id) queryParams.append('coach_id', params.coach_id);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());

    const url = `${this.baseUrl}?${queryParams.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch classes');
    }

    return response.json();
  }

  async getClass(id: string): Promise<Class> {
    const response = await fetch(`${this.baseUrl}/${id}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch class');
    }

    return response.json();
  }

  async updateClass(id: string, updates: ClassUpdate): Promise<Class> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update class');
    }

    return response.json();
  }

  async deleteClass(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete class');
    }
  }

  async enrollStudent(classId: string, studentId: string, studentName: string): Promise<EnrollmentRecord> {
    const url = `${this.baseUrl}/${classId}/enroll?student_id=${studentId}&student_name=${encodeURIComponent(studentName)}`;
    const response = await fetch(url, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to enroll student');
    }

    return response.json();
  }

  async unenrollStudent(classId: string, studentId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${classId}/enroll/${studentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to unenroll student');
    }
  }

  async getClassStudents(classId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/${classId}/students`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch class students');
    }

    return response.json();
  }

  async getStats(schoolId: string): Promise<ClassStats> {
    const response = await fetch(`${this.baseUrl}/stats/${schoolId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch stats');
    }

    return response.json();
  }
}

export const classesAPI = new ClassesAPI();
