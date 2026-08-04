// frontend/src/hooks/useBrandingAuditLog.ts
//
// Hook que consume GET /api/v1/schools/:id/branding/audit del BFF.
// Lo usa el panel de auditoria de branding (school_admin o super_admin)
// para ver quien cambio que y cuando.

import { useQuery } from '@tanstack/react-query';
import { bffClient } from '@/lib/api/bffClient';

export interface BrandingAuditEntry {
    id: string;
    changed_by: string;
    changed_at: string; // ISO timestamp
    before_state: {
        logo_url: string | null;
        branding_settings: {
            primary_color: string;
            secondary_color: string;
            show_sportmaps_watermark: boolean;
        } | null;
    };
    after_state: {
        logo_url: string | null;
        branding_settings: {
            primary_color: string;
            secondary_color: string;
            show_sportmaps_watermark: boolean;
        } | null;
    };
    ip_address: string | null;
    user_agent: string | null;
    change_source: 'rpc_update' | 'admin_override' | 'reset_default' | 'migration';
}

interface BrandingAuditResponse {
    ok: boolean;
    entries: BrandingAuditEntry[];
}

export function useBrandingAuditLog(schoolId: string | null) {
    return useQuery({
        queryKey: ['branding-audit-log', schoolId],
        queryFn: async () => {
            if (!schoolId) return { ok: false, entries: [] };
            return bffClient.get<BrandingAuditResponse>(
                `/api/v1/schools/${schoolId}/branding/audit`,
            );
        },
        enabled: !!schoolId,
        staleTime: 30 * 1000, // refrescar cada 30s en background
    });
}
