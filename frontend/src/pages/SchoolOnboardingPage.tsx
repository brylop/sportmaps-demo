import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SchoolOnboardingWizard } from '@/components/onboarding/SchoolOnboardingWizard';
import { Loader2 } from 'lucide-react';
import { useActiveWorkPage } from '@/hooks/useActiveWorkPage';

/**
 * /onboarding/school — pagina standalone fullscreen.
 *
 * Mismo patron que /trainer/onboarding y /vendor/onboarding:
 *   - Si el onboarding ya esta 'completed' → redirige a /dashboard.
 *   - Si no, renderiza el wizard a pantalla completa, sin sidebar ni
 *     header del dashboard. Asi el admin no accede al resto del sistema
 *     hasta terminar la configuracion inicial.
 *
 * Carga el status directamente de schools + RPC get_onboarding_status
 * con fallback, para que el render dependa solo de datos de BD y no
 * de estado del DashboardPage.
 */
export default function SchoolOnboardingPage() {
    useActiveWorkPage();
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<any>(null);

    const load = async () => {
        if (!user?.id) return;

        // 1. Intento via RPC (carga has_branches/has_teams/etc completos).
        const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)('get_onboarding_status');

        if (!rpcErr && rpcData) {
            setStatus(rpcData);
            setLoading(false);
            return;
        }

        // 2. Fallback: query directa a schools (cubre 404 del RPC).
        const { data: school } = await (supabase
            .from('schools')
            .select('id, onboarding_status, business_model')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle() as any);

        if (!school) {
            // No tiene escuela todavia: el usuario deberia ir primero a /setup/school
            navigate('/setup/school', { replace: true });
            return;
        }

        setStatus({
            school_id:               school.id,
            onboarding_status:       school.onboarding_status,
            business_model:          school.business_model,
            has_school:              true,
            has_branches:            false,
            has_teams:               false,
            has_plans:               false,
            has_staff:               false,
            has_students:            false,
            payment_setup_completed: false,
            role:                    profile?.role,
        });
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, [user?.id]);

    // Si ya completo onboarding, salir al dashboard.
    useEffect(() => {
        if (status?.onboarding_status === 'completed') {
            navigate('/dashboard', { replace: true });
        }
    }, [status?.onboarding_status, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!status) return null;

    return (
        <SchoolOnboardingWizard
            status={status}
            variant="full"
            onComplete={() => navigate('/dashboard', { replace: true })}
            onRefresh={load}
        />
    );
}
