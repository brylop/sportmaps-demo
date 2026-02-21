// Branches API service — uses Supabase directly (table: school_branches)
import { supabase } from '@/integrations/supabase/client';

export interface SchoolBranch {
    id: string;
    school_id: string;
    name: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    lat: number | null;
    lng: number | null;
    is_main: boolean;
    status: string;
    capacity: number;
    created_at: string;
    updated_at: string;
}

export interface BranchCreate {
    school_id: string;
    name: string;
    address?: string;
    city?: string;
    phone?: string;
    lat?: number;
    lng?: number;
    is_main?: boolean;
    capacity?: number;
}

class BranchesAPI {
    async getBranches(schoolId: string): Promise<SchoolBranch[]> {
        const { data, error } = await supabase
            .from('school_branches')
            .select('*')
            .eq('school_id', schoolId)
            .order('is_main', { ascending: false })
            .order('name');

        if (error) throw error;
        return (data || []) as SchoolBranch[];
    }

    async createBranch(branch: BranchCreate): Promise<SchoolBranch> {
        const { data, error } = await supabase
            .from('school_branches')
            .insert(branch)
            .select()
            .single();

        if (error) throw error;
        return data as SchoolBranch;
    }

    async updateBranch(id: string, updates: Partial<BranchCreate>): Promise<SchoolBranch> {
        const { data, error } = await supabase
            .from('school_branches')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as SchoolBranch;
    }

    async deleteBranch(id: string): Promise<void> {
        const { error } = await supabase
            .from('school_branches')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
}

export const branchesAPI = new BranchesAPI();
