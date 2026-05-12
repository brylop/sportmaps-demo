import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
export interface VendorBalance {
    vendor_profile_id:  string;
    pending_balance:    number;
    available_balance:  number;
    total_earned:       number;
    total_fees:         number;
    total_withdrawn:    number;
    min_payout_amount:  number;
    has_bank_account:   boolean;
    can_request_payout: boolean;
}

export interface VendorPayout {
    id:              string;
    vendor_id:       string;
    gross_amount:    number;
    sportmaps_fee:   number;
    wompi_fee:       number;
    net_amount:      number;
    currency:        string;
    status:          'pending' | 'scheduled' | 'paid' | 'failed' | 'on_hold';
    scheduled_for:   string | null;
    paid_at:         string | null;
    paid_by:         string | null;
    bank_reference:  string | null;
    notes:           string | null;
    created_at:      string;
}

export interface BankAccount {
    id:               string;
    bank_name:        string;
    account_type:     'ahorros' | 'corriente' | 'nequi' | 'daviplata' | 'bancolombia_a_la_mano';
    account_number:   string;
    account_holder:   string;
    document_type:    'CC' | 'CE' | 'NIT' | 'PASS' | 'PEP';
    document_number:  string;
    email:            string | null;
    phone:            string | null;
    is_default:       boolean;
    is_active:        boolean;
    verified_at:      string | null;
    created_at:       string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

export function useVendorBalance() {
    const { session } = useAuth();
    return useQuery({
        queryKey: ['vendor-balance', session?.user.id],
        enabled: !!session?.access_token,
        queryFn: async (): Promise<VendorBalance | { error: string }> => {
            const res = await fetch(`${API_URL}/api/v1/vendor/balance`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` },
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Error');
            return json.data as VendorBalance;
        },
    });
}

export function useVendorPayouts(status?: string) {
    const { session } = useAuth();
    return useQuery({
        queryKey: ['vendor-payouts', session?.user.id, status],
        enabled: !!session?.access_token,
        queryFn: async () => {
            const url = `${API_URL}/api/v1/vendor/payouts${status ? `?status=${status}` : ''}`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` },
            });
            if (!res.ok) throw new Error('Error cargando payouts.');
            const json = await res.json();
            return (json.data as VendorPayout[]) || [];
        },
    });
}

export function useBankAccounts() {
    const { session } = useAuth();
    return useQuery({
        queryKey: ['bank-accounts', session?.user.id],
        enabled: !!session?.access_token,
        queryFn: async (): Promise<BankAccount[]> => {
            const res = await fetch(`${API_URL}/api/v1/vendor/bank-accounts`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` },
            });
            if (!res.ok) throw new Error('Error cargando cuentas.');
            const json = await res.json();
            return (json.data as BankAccount[]) || [];
        },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

export function usePayoutMutations() {
    const { session } = useAuth();
    const qc = useQueryClient();

    const authHeaders = () => ({
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
    });

    const requestPayout = useMutation({
        mutationFn: async (amount?: number) => {
            const res = await fetch(`${API_URL}/api/v1/vendor/payouts/request`, {
                method:  'POST',
                headers: authHeaders(),
                body:    JSON.stringify(amount ? { amount } : {}),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Error solicitando liquidación.');
            return json.data as VendorPayout;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['vendor-balance'] });
            qc.invalidateQueries({ queryKey: ['vendor-payouts'] });
        },
    });

    const createBankAccount = useMutation({
        mutationFn: async (data: Omit<BankAccount, 'id' | 'is_active' | 'verified_at' | 'created_at'>) => {
            const res = await fetch(`${API_URL}/api/v1/vendor/bank-accounts`, {
                method:  'POST',
                headers: authHeaders(),
                body:    JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Error creando cuenta.');
            return json.data as BankAccount;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['bank-accounts'] });
            qc.invalidateQueries({ queryKey: ['vendor-balance'] });
        },
    });

    const updateBankAccount = useMutation({
        mutationFn: async ({ id, ...data }: Partial<BankAccount> & { id: string }) => {
            const res = await fetch(`${API_URL}/api/v1/vendor/bank-accounts/${id}`, {
                method:  'PATCH',
                headers: authHeaders(),
                body:    JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Error actualizando.');
            return json.data;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-accounts'] }),
    });

    const deleteBankAccount = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_URL}/api/v1/vendor/bank-accounts/${id}`, {
                method:  'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok) throw new Error('Error eliminando.');
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-accounts'] }),
    });

    const setDefaultBankAccount = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_URL}/api/v1/vendor/bank-accounts/${id}/set-default`, {
                method:  'POST',
                headers: authHeaders(),
            });
            if (!res.ok) throw new Error('Error');
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['bank-accounts'] });
            qc.invalidateQueries({ queryKey: ['vendor-balance'] });
        },
    });

    return { requestPayout, createBankAccount, updateBankAccount, deleteBankAccount, setDefaultBankAccount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
export const BANK_OPTIONS = [
    { value: 'bancolombia',     label: 'Bancolombia' },
    { value: 'davivienda',      label: 'Davivienda' },
    { value: 'bbva',            label: 'BBVA' },
    { value: 'banco_bogota',    label: 'Banco de Bogotá' },
    { value: 'banco_de_occidente', label: 'Banco de Occidente' },
    { value: 'banco_popular',   label: 'Banco Popular' },
    { value: 'av_villas',       label: 'AV Villas' },
    { value: 'colpatria',       label: 'Colpatria' },
    { value: 'caja_social',     label: 'Banco Caja Social' },
    { value: 'falabella',       label: 'Banco Falabella' },
    { value: 'nequi',           label: 'Nequi' },
    { value: 'daviplata',       label: 'Daviplata' },
    { value: 'movii',           label: 'Movii' },
];

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
    ahorros:                  'Ahorros',
    corriente:                'Corriente',
    nequi:                    'Nequi',
    daviplata:                'Daviplata',
    bancolombia_a_la_mano:    'Bancolombia a la Mano',
};

export const PAYOUT_STATUS_LABEL: Record<string, string> = {
    pending:    'Pendiente',
    scheduled:  'Programado',
    paid:       'Pagado',
    failed:     'Fallido',
    on_hold:    'En espera',
};

export const PAYOUT_STATUS_COLOR: Record<string, string> = {
    pending:    'bg-amber-100 text-amber-800',
    scheduled:  'bg-blue-100 text-blue-800',
    paid:       'bg-emerald-100 text-emerald-800',
    failed:     'bg-red-100 text-red-800',
    on_hold:    'bg-slate-200 text-slate-700',
};
