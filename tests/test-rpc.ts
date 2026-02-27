import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load from .env
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
    try {
        console.log("Fetching test data...");
        // 1. Get an active program (team)
        const { data: program } = await supabase
            .from('teams')
            .select('id, school_id')
            .eq('active', true)
            .limit(1)
            .single();

        if (!program) throw new Error("No active program found to test with.");

        // 2. Get a valid parent and child
        const { data: child } = await supabase
            .from('children')
            .select('id, parent_id')
            .not('parent_id', 'is', null)
            .limit(1)
            .single();

        if (!child) throw new Error("No child profile found to test with.");

        const payload = {
            p_program_id: program.id,
            p_school_id: program.school_id,
            p_parent_id: child.parent_id,
            p_amount: 150000,
            p_payment_method: 'manual',
            p_student_id: null,
            p_child_id: child.id
        };

        console.log("\nExecuting RPC 'process_enrollment_checkout' with:");
        console.log(JSON.stringify(payload, null, 2));

        const { data, error } = await supabase.rpc('process_enrollment_checkout', payload);

        if (error) {
            console.error("\n[ERROR] RPC Failed:", error);
        } else {
            console.log("\n[SUCCESS] JSON Result from Database:");
            console.log(JSON.stringify(data, null, 2));

            // Cleanup: Rollback test data natively via delete.
            console.log("\nCleaning up test enrollment and payment...");
            if (data.enrollment_id) await supabase.from('enrollments').delete().eq('id', data.enrollment_id);
            if (data.payment_id) await supabase.from('payments').delete().eq('id', data.payment_id);
            console.log("Cleanup complete.");
        }
    } catch (err) {
        console.error("Test execution failed:", err);
    }
}

testRpc();
