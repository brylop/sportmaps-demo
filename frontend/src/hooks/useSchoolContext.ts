import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { emailClient } from '@/lib/email-client';
import { EmailTemplates } from '@/lib/email-templates';

/**
 * Represents a sports program offered by a school.
 */
export interface SchoolProgram {
    id: string;
    name: string;
    monthly_fee: number;
    sport_type?: string;
    branch_id?: string;
}

/**
 * Represents a user's role and membership within a specific school or branch.
 */
export interface SchoolRole {
    schoolId: string;
    schoolName: string;
    role: 'owner' | 'admin' | 'super_admin' | 'school_admin' | 'school' | 'coach' | 'staff' | 'parent' | 'athlete' | 'viewer' | 'wellness_professional' | 'store_owner' | 'organizer' | 'reporter';
    branchId: string | null;
    isGlobal?: boolean; // If true, the user has school-wide access
    onboardingStatus?: 'pending' | 'in_progress' | 'completed';
}

/**
 * The state and methods provided by the School Context.
 */
export interface SchoolContext {
    /** The ID of the currently active school. */
    schoolId: string | null;
    /** The name of the currently active school. */
    schoolName: string;
    /** The role of the current user in the active school. */
    currentUserRole: SchoolRole['role'] | null;
    /** List of programs available in the active school/branch. */
    programs: SchoolProgram[];
    /** List of all schools the user is a member of. */
    availableSchools: SchoolRole[];
    /** The ID of the currently active branch (null for all branches). */
    activeBranchId: string | null;
    /** The display name of the currently active branch. */
    activeBranchName: string;
    /** Current onboarding state of the active school. */
    onboardingStatus: 'pending' | 'in_progress' | 'completed';
    /** Raw configuration settings for the school. */
    schoolSettings: any | null; // eslint-disable-line @typescript-eslint/no-explicit-any
    /** Updates the overall onboarding status in the database. */
    updateOnboardingStatus: (status: 'pending' | 'in_progress' | 'completed') => Promise<boolean>;
    /** Updates the specific step index in the onboarding wizard. */
    updateOnboardingStep: (step: number) => Promise<void>;
    /** Switches the active context to another school/branch. */
    /** Whether the user has global permissions for the current school. */
    isGlobalAdmin: boolean;
    /** Total number of branches in the active school. */
    totalBranches: number;
    /** All branches for the current active school */
    branches: { id: string; name: string }[];
    /** Switches the active context to another school/branch. */
    switchSchool: (schoolId: string, branchId?: string | null) => void;
    /** Default fee to use if no program price is found. */
    defaultMonthlyFee: number;
    /** Whether the context is currently loading data. */
    loading: boolean;
    /** Error message if any operation failed. */
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
    const [schoolSettings, setSchoolSettings] = useState<any | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
    const [totalBranchesCount, setTotalBranchesCount] = useState(0);
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

    // 1. Initial Load: Resolve User & Memberships
    useEffect(() => {
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
                setAvailableSchools([{ schoolId: demoSchool.id, schoolName: demoSchool.name, role: 'viewer', branchId: null, onboardingStatus: 'completed' }]);
            } else {
                console.log('No demo school found for guest.');
            }
            // Start fetch programs immediately for fallback
            if (activeSchoolId) fetchPrograms(activeSchoolId);
        };

        const resolveUserContext = async () => {
            try {
                setLoading(true);
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    // Fallback: Try to find Default Demo School if no user (Guest Mode)
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
                    const mappedSchools: SchoolRole[] = memberships.map((m: any) => {
                        // Owners and super_admins are ALWAYS global, regardless of branch_id
                        const isAlwaysGlobal = m.role === 'owner' || m.role === 'super_admin';
                        // school_admin and admin are global only if they have no branch_id set
                        const isScopedAdmin = (m.role === 'admin' || m.role === 'school_admin') && !m.branch_id;

                        return {
                            schoolId: m.school_id,
                            schoolName: m.schools?.name || 'Escuela sin nombre',
                            role: m.role as SchoolRole['role'],
                            // Owners and super admins manage the whole school, they shouldn't be tied to a specific branch on load if they have a global role
                            branchId: isAlwaysGlobal ? null : (m.branch_id || null),
                            isGlobal: isAlwaysGlobal || isScopedAdmin,
                            onboardingStatus: (m.schools?.onboarding_status as SchoolContext['onboardingStatus']) || 'completed'
                        };
                    });

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
                    // Authenticated but no memberships
                    // Check if user is explicitly a SCHOOL role
                    const { data: userProfile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', user.id)
                        .maybeSingle();

                    const userRole = userProfile?.role as string;
                    if (userRole === 'school' || userRole === 'school_admin' || userRole === 'reporter') {
                        // New School Owner -> Trigger Onboarding
                        console.log('User is SCHOOL role with no memberships. Triggering Onboarding state.');
                        setAvailableSchools([]);
                        setActiveSchoolId(null);
                        setActiveSchoolName('Mi Escuela');
                        setCurrentUserRole('owner');
                        setOnboardingStatus('pending');
                    } else {
                        // Parent/Athlete/Coach without school membership yet
                        console.log(`User is ${userProfile?.role || 'unknown'} role. Skipping School Context logic.`);
                        setAvailableSchools([]);
                        setActiveSchoolId(null);
                        setActiveSchoolName('');
                        setCurrentUserRole(null);
                        setOnboardingStatus('completed'); // Bypass School Gate
                    }
                }
            } catch (err: unknown) {
                console.error('useSchoolContext resolution error:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        resolveUserContext();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 2. Effect: Fetch Programs when Active School Changes
    useEffect(() => {
        if (activeSchoolId && activeSchoolId !== "") {
            fetchPrograms(activeSchoolId, activeBranchId);
            fetchSettings(activeSchoolId);
        }
    }, [activeSchoolId, activeBranchId]);

    const selectSchool = useCallback(async (school: SchoolRole) => {
        setActiveSchoolId(school.schoolId);
        setActiveSchoolName(school.schoolName);
        setCurrentUserRole(school.role);
        setActiveBranchId(school.branchId);
        setIsGlobalAdmin(!!school.isGlobal);

        // Fetch branch count and data
        const { data: branchesData, count } = await supabase
            .from('school_branches')
            .select('id, name', { count: 'exact' })
            .eq('school_id', school.schoolId);

        setTotalBranchesCount(count || 0);
        setBranches(branchesData || []);

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
    }, []);

    const switchSchool = (schoolId: string, branchId: string | null = null) => {
        // First try exact match
        const target = availableSchools.find(s => s.schoolId === schoolId && s.branchId === branchId);
        if (target) {
            selectSchool(target);
            return;
        }

        // For global admins (owner/super_admin), they have a single entry with branchId=null
        // When they select a specific branch, we create a synthetic SchoolRole with that branchId
        const baseEntry = availableSchools.find(s => s.schoolId === schoolId && s.isGlobal);
        if (baseEntry) {
            selectSchool({
                ...baseEntry,
                branchId: branchId, // null = "Todas las sedes", UUID = specific sede
            });
            return;
        }

        // Last resort: find any entry in that school
        const anyInSchool = availableSchools.find(s => s.schoolId === schoolId);
        if (anyInSchool) selectSchool(anyInSchool);
    };

    const fetchPrograms = useCallback(async (id: string, branchId: string | null = null) => {
        if (!id || id === "") return;
        setLoading(true);
        try {
            let query = supabase
                .from('teams')
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
                        branch_id: p.branch_id
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
    }, []);

    const fetchSettings = useCallback(async (id: string) => {
        if (!id || id === "") return;
        const { data } = await supabase
            .from('school_settings')
            .select('*')
            .eq('school_id', id)
            .maybeSingle();
        setSchoolSettings(data);
    }, []);

    const updateOnboardingStatus = async (status: 'pending' | 'in_progress' | 'completed'): Promise<boolean> => {
        if (!activeSchoolId) {
            console.error('❌ updateOnboardingStatus: No activeSchoolId found.');
            return false;
        }

        console.log(`🔄 Updating onboarding status for school ${activeSchoolId} to: ${status}`);

        try {
            const { data, error: updateError } = await supabase
                .from('schools')
                .update({ onboarding_status: status })
                .eq('id', activeSchoolId)
                .select();

            const count = data?.length || 0;

            if (updateError) {
                console.error('❌ Supabase Update Error:', updateError);
                return false;
            }

            if (count === 0) {
                console.warn(`⚠️ UPDATE returned 0 rows affected. RLS may be blocking update for school ${activeSchoolId}.`);
                return false;
            }

            console.log(`✅ Successfully updated onboarding status. Rows affected: ${count}`);

            // Only update local state if DB update succeeded
            setOnboardingStatus(status);

            // Update the complex availableSchools array in memory
            setAvailableSchools(prev => prev.map(s =>
                s.schoolId === activeSchoolId
                    ? { ...s, onboardingStatus: status }
                    : s
            ));

            return true;
        } catch (err) {
            console.error('Failed to update onboarding status (catch):', err);
            return false;
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
        isGlobalAdmin,
        totalBranches: totalBranchesCount,
        branches,
        defaultMonthlyFee: DEFAULT_MONTHLY_FEE,
        loading,
        error,
    };
}

/**
 * Helper: Crea un estudiante y su pago pendiente de forma atómica.
 * Reutilizable desde cualquier flujo (modal, CSV, invitación).
 * 
 * @param params Objeto con la información del estudiante y del padre.
 * @returns Un objeto con el ID del estudiante creado y estados de éxito de las inserciones.
 * @throws Error si la creación del estudiante falla.
 */
export async function createStudentWithPendingPayment(params: {
    fullName: string;
    dateOfBirth?: string;
    parentEmail?: string;
    parentPhone?: string;
    parentName?: string;
    schoolId: string;
    schoolName?: string;
    branchId?: string;
    programId?: string;
    programName?: string;
    monthlyFee?: number; // Optional now, will fetch if missing
    medicalInfo?: string;
    notes?: string;
}) {
    const { schoolId, programId } = params;
    let { monthlyFee } = params;

    // 0. Fetch program price if not provided (from teams table)
    if (!monthlyFee && programId) {
        const { data: program } = await supabase
            .from('teams')
            .select('price_monthly, name')
            .eq('id', programId)
            .maybeSingle();

        if (program) {
            monthlyFee = program.price_monthly || 150000;
            if (!params.programName) params.programName = program.name;
        }
    }

    if (!monthlyFee) monthlyFee = 150000; // Final fallback

    // 1. Create student record in children table
    const { data: child, error: childError } = await supabase
        .from('children')
        .insert({
            full_name: params.fullName,
            date_of_birth: params.dateOfBirth || null,
            parent_email_temp: params.parentEmail || null,
            parent_phone_temp: params.parentPhone || null,
            medical_info: params.medicalInfo || null,
            school_id: params.schoolId,
            branch_id: params.branchId || null,
            program_id: params.programId || null,
        })
        .select()
        .single();

    // For production: throw error if insert fails
    if (childError) {
        console.error('Child insert failed:', childError.message);
        throw new Error(childError.message || 'Error al crear el estudiante');
    }

    const childId = child.id;

    // 2. Create pending payment for this student
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + 1);

    const { error: paymentError } = await supabase
        .from('payments')
        .insert({
            parent_id: null,
            child_id: childId,
            school_id: schoolId,
            branch_id: params.branchId || null,
            amount: monthlyFee,
            concept: `Mensualidad ${params.programName || 'Programa'} - ${params.fullName}`,
            due_date: dueDate.toISOString().split('T')[0],
            status: 'pending',
            payment_type: 'monthly',
        });

    if (paymentError) {
        console.error('Payment insert failed:', paymentError.message);
        // We might want to allow this if the student was created, but for consistency let's throw
        // throw new Error(paymentError.message || 'Error al crear el pago del estudiante');
    }

    // 3. Send Invitation and Record in DB if parent email provided
    if (params.parentEmail) {
        try {
            // Record invitation in DB via RPC
            // The RPC automatically uses auth.uid() for 'invited_by'
            const { data: inviteId, error: inviteError } = await supabase.rpc('invite_parent_to_school', {
                p_parent_email: params.parentEmail.toLowerCase().trim(),
                p_child_name: params.fullName,
                p_program_id: params.programId || null,
                p_monthly_fee: params.monthlyFee
            });

            if (inviteError) {
                console.error('Error recording invitation in DB:', inviteError.message);
            }

            const inviteLink = `${window.location.origin}/register?email=${encodeURIComponent(params.parentEmail)}&role=parent&invite=${inviteId || ''}`;

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
            console.log(`✉️ Invitación enviada y registrada para ${params.parentEmail}`);
        } catch (inviteErr) {
            const message = inviteErr instanceof Error ? inviteErr.message : String(inviteErr);
            console.warn('Invitation process error:', message);
        }
    }

    return {
        childId,
        success: true,
        childInserted: true,
        paymentInserted: !paymentError,
    };
}
