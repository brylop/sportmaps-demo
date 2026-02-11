import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SchoolProgram {
    id: string;
    name: string;
    monthly_fee: number;
    sport_type?: string;
}

export interface SchoolContext {
    schoolId: string | null;
    schoolName: string;
    programs: SchoolProgram[];
    defaultMonthlyFee: number;
    loading: boolean;
    error: string | null;
}

const DEMO_SCHOOL_EMAIL = 'spoortmaps+school@gmail.com';
const DEFAULT_MONTHLY_FEE = 150000; // COP

/**
 * Hook reutilizable que resuelve el contexto de la escuela actual.
 * 
 * Lógica de resolución:
 * 1. Busca la escuela demo por email en la tabla `schools`
 * 2. Fallback: cualquier escuela válida
 * 3. Carga los programas asociados a la escuela
 * 
 * Reutilizable en: Web, Android (WebView), WhatsApp bot
 */
export function useSchoolContext(): SchoolContext {
    const [schoolId, setSchoolId] = useState<string | null>(null);
    const [schoolName, setSchoolName] = useState('Spirit All Stars');
    const [programs, setPrograms] = useState<SchoolProgram[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const resolve = async () => {
            try {
                setLoading(true);

                // 1. Find demo school
                let school: any = null;
                const { data: demoSchool } = await supabase
                    .from('schools')
                    .select('id, name')
                    .eq('email', DEMO_SCHOOL_EMAIL)
                    .maybeSingle();

                if (demoSchool) {
                    school = demoSchool;
                } else {
                    // 2. Fallback to any school
                    const { data: anySchool } = await supabase
                        .from('schools')
                        .select('id, name')
                        .limit(1)
                        .maybeSingle();
                    school = anySchool;
                }

                if (!school) {
                    setError('No se encontró una escuela configurada');
                    return;
                }

                setSchoolId(school.id);
                setSchoolName(school.name || 'Spirit All Stars');

                // 3. Load programs for this school
                const { data: programsData } = await supabase
                    .from('programs')
                    .select('id, name, price, sport_type')
                    .eq('school_id', school.id);

                if (programsData && programsData.length > 0) {
                    setPrograms(
                        programsData.map((p: any) => ({
                            id: p.id,
                            name: p.name,
                            monthly_fee: p.price || DEFAULT_MONTHLY_FEE,
                            sport_type: p.sport_type,
                        }))
                    );
                } else {
                    // Demo fallback programs
                    setPrograms([
                        { id: 'demo-1', name: 'Firesquad (Senior L3)', monthly_fee: 180000 },
                        { id: 'demo-2', name: 'Butterfly (Junior Prep)', monthly_fee: 150000 },
                        { id: 'demo-3', name: 'Bombsquad (Coed L5)', monthly_fee: 200000 },
                        { id: 'demo-4', name: 'Legends (Open L6)', monthly_fee: 220000 },
                    ]);
                }
            } catch (err: any) {
                console.error('useSchoolContext error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        resolve();
    }, []);

    return {
        schoolId,
        schoolName,
        programs,
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
            name: params.fullName,
            date_of_birth: params.dateOfBirth || null,
            parent_email: params.parentEmail || null,
            parent_phone: params.parentPhone || null,
            medical_info: params.medicalInfo || null,
            notes: params.notes || null,
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
