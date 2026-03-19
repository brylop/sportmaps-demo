// Payment Reminders API: Generates and sends payment reminders to parents
import { supabase } from '@/integrations/supabase/client';

export interface PaymentReminder {
    id: string;
    parentId: string;
    parentName: string;
    parentEmail: string;
    childName: string;
    childId: string;
    teamName: string;
    amount: number;
    dueDate: string;
    status: 'pending' | 'paid' | 'overdue';
    paymentId: string | null;
    daysOverdue: number;
}

export interface ReminderBatch {
    schoolId: string;
    generatedAt: string;
    totalReminders: number;
    totalAmount: number;
    byStatus: {
        pending: number;
        overdue: number;
    };
    reminders: PaymentReminder[];
}

class PaymentRemindersAPI {
    /**
     * Fetch pending/overdue payments for a school, enriched with parent + child info.
     * This is the core function that generates the reminder list.
     */
    async generateReminders(schoolId: string, branchId?: string | null): Promise<ReminderBatch> {
        // Get all pending/overdue payments with parent + child data
        let query = supabase
            .from('payments')
            .select(`
                id,
                amount,
                due_date,
                status,
                payment_date,
                parent_id,
                child_id,
                team_id
            `)
            .eq('school_id', schoolId)
            .in('status', ['pending', 'overdue']);

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data: payments, error } = await query.order('due_date', { ascending: true });

        if (error) throw error;
        if (!payments || payments.length === 0) {
            return {
                schoolId,
                generatedAt: new Date().toISOString(),
                totalReminders: 0,
                totalAmount: 0,
                byStatus: { pending: 0, overdue: 0 },
                reminders: [],
            };
        }

        // Get unique parent/child/program IDs
        const parentIds = [...new Set(payments.map(p => p.parent_id).filter(Boolean))];
        const childIds = [...new Set(payments.map(p => p.child_id).filter(Boolean))];
        const teamIds = [...new Set(payments.map(p => p.team_id).filter(Boolean))];

        // Fetch parent profiles
        const { data: parents } = await supabase
            .from('profiles')
            .select('id, full_name, email, phone')
            .in('id', parentIds);

        // Fetch children
        const { data: children } = await supabase
            .from('children')
            .select('id, full_name')
            .in('id', childIds);

        // Fetch teams
        const { data: teamsData } = await supabase
            .from('teams')
            .select('id, name')
            .in('id', teamIds);

        const parentMap = new Map((parents || []).map(p => [p.id, p]));
        const childMap = new Map((children || []).map(c => [c.id, c]));
        const teamMap = new Map((teamsData || []).map(p => [p.id, p]));

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const reminders: PaymentReminder[] = payments.map(payment => {
            const parent = parentMap.get(payment.parent_id);
            const child = childMap.get(payment.child_id || '');
            const team = teamMap.get(payment.team_id || '');
            const dueDate = new Date(payment.due_date);
            dueDate.setHours(0, 0, 0, 0);
            const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

            return {
                id: payment.id,
                parentId: payment.parent_id,
                parentName: parent?.full_name || 'Sin nombre',
                parentEmail: (parent as any)?.email || '',
                childName: child?.full_name || 'Sin asignar',
                childId: payment.child_id || '',
                teamName: team?.name || 'Equipo',
                amount: payment.amount,
                dueDate: payment.due_date,
                status: daysOverdue > 0 ? 'overdue' : 'pending',
                paymentId: payment.id,
                daysOverdue,
            };
        });

        return {
            schoolId,
            generatedAt: new Date().toISOString(),
            totalReminders: reminders.length,
            totalAmount: reminders.reduce((sum, r) => sum + r.amount, 0),
            byStatus: {
                pending: reminders.filter(r => r.status === 'pending').length,
                overdue: reminders.filter(r => r.status === 'overdue').length,
            },
            reminders,
        };
    }

    /**
     * Mark overdue payments in the database (batch update status)
     */
    async markOverduePayments(schoolId: string): Promise<number> {
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('payments')
            .update({ status: 'overdue' })
            .eq('school_id', schoolId)
            .eq('status', 'pending')
            .lt('due_date', today)
            .select('id');

        if (error) throw error;
        return data?.length || 0;
    }
}

export const paymentRemindersAPI = new PaymentRemindersAPI();
