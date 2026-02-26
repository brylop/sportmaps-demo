import { supabase } from '@/integrations/supabase/client';

// ─── Types ──────────────────────────────────────────────
export interface CoachProfile {
    id: string;
    doc_type: string;
    doc_number: string;
    primary_sport: string;
    profile_completed: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface CoachCertification {
    id: string;
    coach_id: string;
    name: string;
    file_url: string | null;
    file_name: string | null;
    created_at?: string;
}

export interface UpsertCoachProfilePayload {
    id: string;
    doc_type: string;
    doc_number: string;
    primary_sport: string;
    profile_completed?: boolean;
}

// ─── API ────────────────────────────────────────────────
export const coachesAPI = {
    /**
     * Get coach professional profile
     */
    async getCoachProfile(userId: string): Promise<CoachProfile | null> {
        const { data, error } = await supabase
            .from('coach_profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching coach profile:', error);
            return null;
        }
        return data;
    },

    /**
     * Create or update coach professional profile
     */
    async upsertCoachProfile(payload: UpsertCoachProfilePayload): Promise<CoachProfile | null> {
        const { data, error } = await supabase
            .from('coach_profiles')
            .upsert({
                ...payload,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' })
            .select()
            .single();

        if (error) {
            console.error('Error upserting coach profile:', error);
            throw error;
        }
        return data;
    },

    /**
     * Get all certifications for a coach
     */
    async getCertifications(coachId: string): Promise<CoachCertification[]> {
        const { data, error } = await supabase
            .from('coach_certifications')
            .select('*')
            .eq('coach_id', coachId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching certifications:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Add a new certification
     */
    async addCertification(coachId: string, name: string, fileUrl: string | null, fileName: string | null): Promise<CoachCertification | null> {
        const { data, error } = await supabase
            .from('coach_certifications')
            .insert({
                coach_id: coachId,
                name,
                file_url: fileUrl,
                file_name: fileName
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding certification:', error);
            throw error;
        }
        return data;
    },

    /**
     * Delete a certification
     */
    async deleteCertification(id: string): Promise<void> {
        const { error } = await supabase
            .from('coach_certifications')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting certification:', error);
            throw error;
        }
    }
};
