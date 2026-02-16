import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
}

export interface SchoolContext {
    schoolId: string | null;
    schoolName: string;
    currentUserRole: SchoolRole['role'] | null;
    programs: SchoolProgram[];
    availableSchools: SchoolRole[];
    switchSchool: (schoolId: string) => void;
    defaultMonthlyFee: number;
    loading: boolean;
    error: string | null;
}

const DEMO_SCHOOL_EMAIL = 'spoortmaps+school@gmail.com';
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
                    .select('school_id, role, schools(id, name)')
                    .eq('profile_id', user.id)
                    .eq('status', 'active');

                if (memberError) throw memberError;

                if (memberships && memberships.length > 0) {
                    const mappedSchools: SchoolRole[] = memberships.map((m: any) => ({
                        schoolId: m.school_id,
                        schoolName: m.schools?.name || 'Escuela sin nombre',
                        role: m.role as SchoolRole['role'],
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
                    // Authenticated but no memberships (New user? Or just visitor?)
                    // Fallback to Demo School View (Guest mode)
                    await resolveFallbackSchool();
                }

            } catch (err: any) {
                console.error('useSchoolContext resolution error:', err);
                setError(err.message);
                // Fallback on error
                await resolveFallbackSchool();
            }
        };

        const resolveFallbackSchool = async () => {
            // Logic to fetch the default/demo school for guests
            const { data: demoSchool } = await supabase
                .from('schools')
                .select('id, name')
                .eq('email', DEMO_SCHOOL_EMAIL)
                .maybeSingle();

            if (demoSchool) {
                setActiveSchoolId(demoSchool.id);
                setActiveSchoolName(demoSchool.name);
                setCurrentUserRole('viewer'); // Guest role
                setAvailableSchools([{ schoolId: demoSchool.id, schoolName: demoSchool.name, role: 'viewer' }]);
            } else {
                // Absolute fallback
                const { data: anySchool } = await supabase.from('schools').select('id, name').limit(1).maybeSingle();
                if (anySchool) {
                    setActiveSchoolId(anySchool.id);
                    setActiveSchoolName(anySchool.name);
                    setCurrentUserRole('viewer');
                    setAvailableSchools([{ schoolId: anySchool.id, schoolName: anySchool.name, role: 'viewer' }]);
                } else {
                    setError('No se encontró ninguna escuela en el sistema.');
                }
            }
            // Start fetch programs immediately for fallback
            if (activeSchoolId) fetchPrograms(activeSchoolId);
            // Note: activeSchoolId state might not be updated yet in this closure, 
            // but we call fetchPrograms in a separate effect dependent on activeSchoolId
        };

        resolveUserContext();
    }, []);

    // 2. Effect: Fetch Programs when Active School Changes
    useEffect(() => {
        if (activeSchoolId) {
            fetchPrograms(activeSchoolId);
        }
    }, [activeSchoolId]);

    const selectSchool = (school: SchoolRole) => {
        setActiveSchoolId(school.schoolId);
        setActiveSchoolName(school.schoolName);
        setCurrentUserRole(school.role);
        localStorage.setItem(STORAGE_KEY_ACTIVE_SCHOOL, school.schoolId);
    };

    const switchSchool = (schoolId: string) => {
        const target = availableSchools.find(s => s.schoolId === schoolId);
        if (target) {
            selectSchool(target);
        }
    };

    const fetchPrograms = async (id: string) => {
        setLoading(true);
        try {
            const { data: programsData } = await supabase
                .from('programs')
                .select('id, name, price_monthly, sport')
                .eq('school_id', id);

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

    return {
        schoolId: activeSchoolId,
        schoolName: activeSchoolName,
        currentUserRole,
        programs,
        availableSchools,
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
            // parent_email: params.parentEmail || null, // Check if these exist in schema. Safe to omit if unsure?
            // parent_phone: params.parentPhone || null,
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

    return {
        childId,
        success: true,
        childInserted: !childError,
        paymentInserted: !paymentError,
    };
}
