import { supabase } from "@/integrations/supabase/client";

export interface CreateAnnouncementInput {
    coach_id: string;
    team_id?: string | null;
    subject: string;
    message: string;
    audience: 'parents' | 'players' | 'both';
}

export const announcementsApi = {
    async getAnnouncements(coachId: string) {
        const { data, error } = await supabase
            .from('announcements')
            .select('*, teams(name)')
            .eq('coach_id', coachId)
            .order('sent_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async createAnnouncement(input: CreateAnnouncementInput) {
        const { data, error } = await supabase
            .from('announcements')
            .insert(input)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
