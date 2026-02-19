import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { emailClient } from '@/lib/email-client';
import { EmailTemplates } from '@/lib/email-templates';

export interface SchoolProgram {
    id: string;
    name: string;
    monthly_fee: number;
    sport_type?: string;
}

export interface SchoolRole {
    schoolId: string;
    schoolName: string;
    role: 'owner' | 'admin' | 'coach' | 'staff' | 'parent' | 'athlete' | 'viewer';
    branchId: string | null;
}

export interface SchoolContext {
    schoolId: string | null;
    schoolName: string;
    currentUserRole: SchoolRole['role'] | null;
    programs: SchoolProgram[];
    availableSchools: SchoolRole[];
    activeBranchId: string | null;
    activeBranchName: string;
    onboardingStatus: 'pending' | 'in_progress' | 'completed';
    schoolSettings: any | null;
    updateOnboardingStatus: (status: 'pending' | 'in_progress' | 'completed') => Promise<void>;
    updateOnboardingStep: (step: number) => Promise<void>;
    switchSchool: (schoolId: string, branchId?: string | null) => void;
    defaultMonthlyFee: number;
    loading: boolean;
    error: string | null;
}

// Email de la escuela demo para usuarios invitados (solo si se configura en .env)
const DEMO_SCHOOL_EMAIL = import.meta.env.VITE_DEMO_SCHOOL_EMAIL || '';
const DEFAULT_MONTHLY_FEE = 150000; // COP
const STORAGE_KEY_ACTIVE_SCHOOL = 'sportmaps_active_school_id';

/**
 * Hook reutilizable que resuelve el contexto de la escuela actual.
 * Soporta múltiples escuelas por usuario (Multitenancy).
 */
export function useSchoolContext(): SchoolContext {
    const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);
    const [activeSchoolName, setActiveSchoolName] = useState('Escuela');
    const [currentUserRole, setCurrentUserRole] = useState<SchoolRole['role'] | null>(null);

    const [availableSchools, setAvailableSchools] = useState<SchoolRole[]>([]);
    const [programs, setPrograms] = useState<SchoolProgram[]>([]);
    const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
    const [activeBranchName, setActiveBranchName] = useState('Todas las sedes');
    const [onboardingStatus, setOnboardingStatus] = useState<'pending' | 'in_progress' | 'completed'>('completed');
    const [schoolSettings, setSchoolSettings] = useState<any | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 1. Initial Load: Resolve User & Memberships
    useEffect(() => {
        const resolveUserContext = async () => {
            try {
                setLoading(true);
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    // Fallback: Try to find Default Demo School if no user
                    await resolveFallbackSchool();
                    return;
                }

                // Fetch memberships
                const { data: memberships, error: memberError } = await supabase
                    .from('school_members')
                    .select('school_id, role, branch_id, schools(id, name, onboarding_status)')
                    .eq('profile_id', user.id)
                    .eq('status', 'active');

                if (memberError) throw memberError;

                if (memberships && memberships.length > 0) {
                    const mappedSchools: SchoolRole[] = memberships.map((m: any) => ({
                        schoolId: m.school_id,
                        schoolName: m.schools?.name || 'Escuela sin nombre',
                        role: m.role as SchoolRole['role'],
                        branchId: m.branch_id || null,
                        onboardingStatus: (m.schools?.onboarding_status as any) || 'completed'
                    }));

                    setAvailableSchools(mappedSchools);

                    // Determine active school
                    const storedId = localStorage.getItem(STORAGE_KEY_ACTIVE_SCHOOL);
                    const found = mappedSchools.find(s => s.schoolId === storedId);

                    if (found) {
                        selectSchool(found);
                    } else {
                        selectSchool(mappedSchools[0]);
                    }
                } else {
                    // Authenticated but no memberships (New School Owner)
                    // Do NOT fallback to random school. Leave empty to trigger Onboarding.
                    console.log('User has no school memberships. Triggering Onboarding state.');
                    setAvailableSchools([]);
                    setActiveSchoolId(null);
                    setActiveSchoolName('Mi Escuela');
                    setCurrentUserRole('owner'); // Default to owner so they can create
                    setOnboardingStatus('pending');
                }
            } catch (err: any) {
                console.error('useSchoolContext resolution error:', err);
                setError(err.message);
                // On error, also stop loading
            } finally {
                setLoading(false);
            }
        };

        const resolveFallbackSchool = async () => {
            // Safety Check: Only run fallback if configured explicitly
            if (!DEMO_SCHOOL_EMAIL) {
                console.log('Guest mode: No VITE_DEMO_SCHOOL_EMAIL configured. Fallback disabled.');
                setLoading(false);
                return;
            }

            // Only for unauthenticated guests, try to find the official Demo School
            const { data: demoSchool } = await supabase
                .from('schools')
                .select('id, name')
                .eq('email', DEMO_SCHOOL_EMAIL)
                .maybeSingle();

            if (demoSchool) {
                setActiveSchoolId(demoSchool.id);
                setActiveSchoolName(demoSchool.name);
                setCurrentUserRole('viewer');
                setAvailableSchools([{ schoolId: demoSchool.id, schoolName: demoSchool.name, role: 'viewer', branchId: null }]);
            } else {
                console.log('No demo school found for guest.');
            }
            // Start fetch programs immediately for fallback
            if (activeSchoolId) fetchPrograms(activeSchoolId);
        };


        resolveUserContext();
    }, []);

    // 2. Effect: Fetch Programs when Active School Changes
    useEffect(() => {
        if (activeSchoolId) {
            fetchPrograms(activeSchoolId, activeBranchId);
            fetchSettings(activeSchoolId);
        }
    }, [activeSchoolId, activeBranchId]);

    const selectSchool = async (school: any) => {
        setActiveSchoolId(school.schoolId);
        setActiveSchoolName(school.schoolName);
        setCurrentUserRole(school.role);
        setActiveBranchId(school.branchId);

        if (school.branchId) {
            const { data: branch } = await supabase
                .from('school_branches')
                .select('name')
                .eq('id', school.branchId)
                .maybeSingle();
            setActiveBranchName(branch?.name || 'Sede');
        } else {
            setActiveBranchName('Todas las sedes');
        }

        setOnboardingStatus(school.onboardingStatus || 'completed');
        localStorage.setItem(STORAGE_KEY_ACTIVE_SCHOOL, school.schoolId);
    };

    const switchSchool = (schoolId: string, branchId: string | null = null) => {
        const target = availableSchools.find(s => s.schoolId === schoolId && s.branchId === branchId);
        if (target) {
            selectSchool(target);
        } else {
            // If branch not found, try to find any branch in that school or the school itself
            const anyInSchool = availableSchools.find(s => s.schoolId === schoolId);
            if (anyInSchool) selectSchool(anyInSchool);
        }
    };

    const fetchPrograms = async (id: string, branchId: string | null = null) => {
        setLoading(true);
        try {
            let query = supabase
                .from('programs')
                .select('id, name, price_monthly, sport, branch_id')
                .eq('school_id', id);

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            const { data: programsData } = await query;

            if (programsData) {
                setPrograms(
                    programsData.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        monthly_fee: p.price_monthly || DEFAULT_MONTHLY_FEE,
                        sport_type: p.sport,
                    }))
                );
            } else {
                setPrograms([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async (id: string) => {
        const { data } = await supabase
            .from('school_settings')
            .select('*')
            .eq('school_id', id)
            .maybeSingle();
        setSchoolSettings(data);
    };

    const updateOnboardingStatus = async (status: 'pending' | 'in_progress' | 'completed') => {
        if (!activeSchoolId) return;
        try {
            const { error: updateError } = await supabase
                .from('schools')
                .update({ onboarding_status: status })
                .eq('id', activeSchoolId);

            if (updateError) throw updateError;

            // 1. Update local simple state
            setOnboardingStatus(status);

            // 2. Update the complex availableSchools array in memory
            setAvailableSchools(prev => prev.map(s =>
                s.schoolId === activeSchoolId
                    ? { ...s, onboardingStatus: status }
                    : s
            ));
        } catch (err) {
            console.error('Failed to update onboarding status:', err);
        }
    };

    const updateOnboardingStep = async (step: number) => {
        if (!activeSchoolId) return;
        try {
            await supabase
                .from('schools')
                .update({ onboarding_step: step })
                .eq('id', activeSchoolId);
        } catch (err) {
            console.error('Failed to update onboarding step:', err);
        }
    };

    return {
        schoolId: activeSchoolId,
        schoolName: activeSchoolName,
        currentUserRole,
        programs,
        availableSchools,
        activeBranchId,
        activeBranchName,
        onboardingStatus,
        schoolSettings,
        updateOnboardingStatus,
        updateOnboardingStep,
        switchSchool,
        defaultMonthlyFee: DEFAULT_MONTHLY_FEE,
        loading,
        error,
    };
}

/**
 * Helper: Crea un estudiante y su pago pendiente de forma atómica.
 * Reutilizable desde cualquier flujo (modal, CSV, invitación).
 */
export async function createStudentWithPendingPayment(params: {
    fullName: string;
    dateOfBirth?: string;
    parentEmail?: string;
    parentPhone?: string;
    parentName?: string;
    schoolId: string;
    schoolName?: string;
    programId?: string;
    programName?: string;
    monthlyFee: number;
    medicalInfo?: string;
    notes?: string;
}) {
    const { schoolId, monthlyFee } = params;

    // 1. Create student record in children table
    const { data: child, error: childError } = await supabase
        .from('children')
        .insert({
            full_name: params.fullName,
            date_of_birth: params.dateOfBirth || null,
            parent_email_temp: params.parentEmail || null,
            parent_phone_temp: params.parentPhone || null,
            medical_info: params.medicalInfo || null,
            notes: params.notes || null,
            school_id: params.schoolId, // Ensure school_id is set
        } as any)
        .select()
        .single();

    // For demo: if DB insert fails, we continue with a mock ID
    const childId = child?.id || `local-${Date.now()}`;
    if (childError) {
        console.warn('Child insert failed (demo fallback):', childError.message);
    }

    // 2. Create pending payment for this student
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + 1);

    const { error: paymentError } = await supabase
        .from('payments')
        .insert({
            parent_id: null, // Will be linked when parent accepts invitation
            amount: monthlyFee,
            concept: `Mensualidad ${params.programName || 'Programa'} - ${params.fullName}`,
            due_date: dueDate.toISOString().split('T')[0],
            status: 'pending',
            school_id: schoolId,
            payment_type: 'monthly',
        } as any);

    if (paymentError) {
        console.warn('Payment insert failed (demo fallback):', paymentError.message);
    }



    // 3. Send Invitation Email if parent email provided
    if (params.parentEmail && !childError) {
        const inviteLink = `${window.location.origin}/register?email=${encodeURIComponent(params.parentEmail)}&role=parent`;

        await emailClient.send({
            to: params.parentEmail,
            subject: `Invitación a SportMaps - ${params.schoolName || 'Tu Escuela'}`,
            html: EmailTemplates.invitation(
                params.parentName || 'Padre de Familia',
                params.fullName,
                params.schoolName || 'nuestra escuela',
                inviteLink
            )
        });
        console.log(`✉️ Invitación enviada a ${params.parentEmail}`);
    }

    return {
        childId,
        success: true,
        childInserted: !childError,
        paymentInserted: !paymentError,
    };
}
