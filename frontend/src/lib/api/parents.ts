
// Parents/Children API Service
// Phase: Adapter for V4 Migration
import { supabase } from '@/integrations/supabase/client';

export interface Child {
    id: string;
    full_name: string;
    date_of_birth: string;
    gender?: string;
    parent_id: string;
    school_id?: string;

    medical_info?: string;
    doc_type?: string;
    doc_number?: string;
    grade?: string;
    emergency_contact?: string;
    avatar_url?: string;
    id_document_url?: string;
    created_at?: string;
}

export interface CreateChildDTO {
    full_name: string;
    date_of_birth: string;
    gender?: string;
    parent_id: string;
    school_id?: string;

    medical_info?: string;
    doc_type?: string;
    doc_number?: string;
    grade?: string;
    emergency_contact?: string;
    avatar_url?: string;
    id_document_url?: string;
}

class ParentsAPI {

    /**
     * Get all children for a parent
     * @param parentId 
     */
    async getChildren(parentId: string): Promise<Child[]> {
        const { data, error } = await supabase
            .from('children')
            .select('*')
            .eq('parent_id', parentId);

        if (error) {
            throw error;
        }

        return data || [];
    }

    /**
     * Add a new child
     * @param childData 
     */
    async addChild(childData: CreateChildDTO): Promise<Child> {
        const { data, error } = await supabase
            .from('children')
            .insert(childData)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data;
    }
}

export const parentsAPI = new ParentsAPI();
