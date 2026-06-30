import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type RecurringSubStatus = 'active' | 'paused' | 'cancelled' | 'suspended';

export interface VendorRecurringSubscriber {
    id:                    string;
    vendor_profile_id:     string;
    subscription_plan_id:  string | null;
    user_id:               string;
    amount:                number;
    currency:              string;
    concept:               string;
    billing_period:        string;
    next_charge_at:        string;
    last_charge_at:        string | null;
    status:                RecurringSubStatus;
    failed_attempts:       number;
    cancelled_at:          string | null;
    created_at:            string;
    subscription_plan: {
        id:        string;
        name:      string;
        plan_type: string;
        price:     number;
    } | null;
}

export function useVendorRecurringSubscribers(status?: RecurringSubStatus) {
    const { session } = useAuth();
    return useQuery({
        queryKey: ['vendor-recurring-subscribers', session?.user.id, status ?? 'all'],
        enabled: !!session?.access_token,
        queryFn: async (): Promise<VendorRecurringSubscriber[]> => {
            const qs = status ? `?status=${status}` : '';
            const res = await fetch(`${API_URL}/api/v1/recurring/vendor/subscriptions${qs}`, {
                headers: { Authorization: `Bearer ${session?.access_token}` },
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || 'Error cargando suscriptores.');
            }
            const json = await res.json();
            return (json.subscriptions as VendorRecurringSubscriber[]) ?? [];
        },
    });
}
