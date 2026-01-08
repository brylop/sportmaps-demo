// Students API service
const API_URL = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;

export interface Student {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  grade?: string;
  school_id: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  emergency_contact?: string;
  medical_notes?: string;
  status: 'active' | 'inactive' | 'suspended';
  enrollment_date?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentCreate {
  full_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  grade?: string;
  school_id: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  emergency_contact?: string;
  medical_notes?: string;
  status?: 'active' | 'inactive' | 'suspended';
  enrollment_date?: string;
}

export interface StudentUpdate {
  full_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  grade?: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  emergency_contact?: string;
  medical_notes?: string;
  status?: 'active' | 'inactive' | 'suspended';
}

export interface BulkUploadResponse {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
  students: Student[];
}

export interface StudentStats {
  total: number;
  active: number;
  inactive: number;
  by_grade: Record<string, number>;
}

class StudentsAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_URL}/api/students`;
  }

  async createStudent(student: StudentCreate): Promise<Student> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(student),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create student');
    }

    return response.json();
  }

  async getStudents(params?: {
    school_id?: string;
    status?: string;
    grade?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<Student[]> {
    const queryParams = new URLSearchParams();
    
    if (params?.school_id) queryParams.append('school_id', params.school_id);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.grade) queryParams.append('grade', params.grade);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());

    const url = `${this.baseUrl}?${queryParams.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch students');
    }

    return response.json();
  }

  async getStudent(id: string): Promise<Student> {
    const response = await fetch(`${this.baseUrl}/${id}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch student');
    }

    return response.json();
  }

  async updateStudent(id: string, updates: StudentUpdate): Promise<Student> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update student');
    }

    return response.json();
  }

  async deleteStudent(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete student');
    }
  }

  async bulkUpload(file: File, schoolId: string): Promise<BulkUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseUrl}/bulk?school_id=${schoolId}`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to upload students');
    }

    return response.json();
  }

  async getStats(schoolId: string): Promise<StudentStats> {
    const response = await fetch(`${this.baseUrl}/stats/${schoolId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch stats');
    }

    return response.json();
  }
}

export const studentsAPI = new StudentsAPI();
