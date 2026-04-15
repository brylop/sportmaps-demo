import { supabase } from '@/integrations/supabase/client';
import { daysDiffFromToday } from '@/lib/dateUtils';

/**
 * Cleans raw payment concept strings like:
 *   "Equipo Equipo - Mensualidad completa, vence dia 10 -- Santiago Robles"
 * Into: "Mensualidad completa, vence dia 10"
 */
function cleanConcept(concept: string | null): string {
    if (!concept) return '';
    let clean = concept;
    // Remove team prefix (e.g. "Equipo Equipo - ")
    if (clean.includes(' - ')) {
        clean = clean.substring(clean.indexOf(' - ') + 3);
    }
    // Remove athlete name suffix (e.g. " -- Santiago Robles")
    const parts = clean.split(' -- ');
    if (parts.length > 1) parts.pop();
    clean = parts.join(' -- ');
    return clean.trim();
}

export interface PaymentReminder {
    id: string;
    parentId: string;
    parentName: string;
    parentEmail: string;
    parentPhone: string;
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
                team_id,
                unregistered_athlete_id,
                offering_plan_id,
                concept
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

        // Get unique parent/child/unregistered/program IDs
        const parentIds = [...new Set(payments.map(p => p.parent_id).filter(Boolean))];
        const childIds = [...new Set(payments.map(p => p.child_id).filter(Boolean))];
        const unregisteredIds = [...new Set(payments.map(p => p.unregistered_athlete_id).filter(Boolean))];
        const teamIds = [...new Set(payments.map(p => p.team_id).filter(Boolean))];
        const planIds = [...new Set(payments.map(p => p.offering_plan_id).filter(Boolean))];

        // Fetch parent profiles
        const { data: parents } = parentIds.length > 0
            ? await supabase.from('profiles').select('id, full_name, email, phone').in('id', parentIds)
            : { data: [] };

        // Fetch children
        const { data: children } = childIds.length > 0
            ? await supabase.from('children').select('id, full_name, parent_phone_temp').in('id', childIds)
            : { data: [] };

        // Fetch unregistered athletes (adult self-enrolled)
        const { data: unregisteredAthletes } = unregisteredIds.length > 0
            ? await supabase.from('unregistered_athletes').select('id, full_name, email, phone').in('id', unregisteredIds)
            : { data: [] };

        // Fetch teams
        const { data: teamsData } = teamIds.length > 0
            ? await supabase.from('teams').select('id, name').in('id', teamIds)
            : { data: [] };

        // Fetch offering plans
        const { data: plansData } = planIds.length > 0
            ? await supabase.from('offering_plans').select('id, name').in('id', planIds)
            : { data: [] };

        const parentMap = new Map((parents || []).map(p => [p.id, p]));
        const childMap = new Map((children || []).map(c => [c.id, c]));
        const unregisteredMap = new Map((unregisteredAthletes || []).map(u => [u.id, u]));
        const teamMap = new Map((teamsData || []).map(p => [p.id, p]));
        const planMap = new Map((plansData || []).map(p => [p.id, p]));

        // Deduplicate payments with same athlete + amount + due_date
        const seen = new Set<string>();
        const uniquePayments = payments.filter(payment => {
            const athleteKey = payment.child_id || payment.unregistered_athlete_id || payment.parent_id || '';
            const key = `${athleteKey}|${payment.amount}|${payment.due_date}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const reminders: PaymentReminder[] = uniquePayments.map(payment => {
            const parent = parentMap.get(payment.parent_id);
            const child = childMap.get(payment.child_id || '');
            const unregistered = unregisteredMap.get(payment.unregistered_athlete_id || '');
            const plan = planMap.get(payment.offering_plan_id || '');
            const team = teamMap.get(payment.team_id || '');
            const daysOverdue = Math.max(0, daysDiffFromToday(payment.due_date));

            // For unregistered athletes, the athlete IS the contact person
            const contactName = parent?.full_name || unregistered?.full_name || 'Sin nombre';
            const contactEmail = (parent as any)?.email || unregistered?.email || '';
            const contactPhone = (parent as any)?.phone || (child as any)?.parent_phone_temp || unregistered?.phone || '';
            const athleteName = child?.full_name || unregistered?.full_name || 'Sin asignar';

            // Show plan name > cleaned concept
            const programLabel = plan?.name || cleanConcept(payment.concept);

            return {
                id: payment.id,
                parentId: payment.parent_id || payment.unregistered_athlete_id || '',
                parentName: contactName,
                parentEmail: contactEmail,
                parentPhone: contactPhone,
                childName: athleteName,
                childId: payment.child_id || payment.unregistered_athlete_id || '',
                teamName: programLabel,
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
     * Delegated to Postgres RPC for server-side date validation and grace periods
     */
    async markOverduePayments(schoolId: string): Promise<number> {
        const { data, error } = await (supabase as any)
            .rpc('mark_overdue_payments', { p_school_id: schoolId });

        if (error) throw error;
        return (data as number) || 0;
    }
}

export const paymentRemindersAPI = new PaymentRemindersAPI();
