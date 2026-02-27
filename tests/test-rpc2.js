const https = require('https');
const fs = require('fs');

// Simple env parser
const envContent = fs.readFileSync('.env', 'utf-8');
let url = '';
let key = '';
envContent.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

async function fetchSupabase(path, method = 'GET', body = null) {
    const fetchArgs = {
        method,
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    };
    if (body) fetchArgs.body = JSON.stringify(body);

    const res = await fetch(`${url}/rest/v1/${path}`, fetchArgs);
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return data;
}

async function run() {
    try {
        console.log("=== Testing process_enrollment_checkout RPC ===");

        // 1. Get a team (program)
        const teams = await fetchSupabase('teams?active=eq.true&select=id,school_id&limit=1');
        const team = teams[0];
        if (!team) throw new Error("No team found");
        console.log(`Program ID: ${team.id}, School ID: ${team.school_id}`);

        // 2. Get a child
        const children = await fetchSupabase('children?select=id,parent_id&not.parent_id=is.null&limit=1');
        const child = children[0];
        if (!child) throw new Error("No child found");
        console.log(`Child ID: ${child.id}, Parent ID: ${child.parent_id}`);

        const payload = {
            p_program_id: team.id,
            p_school_id: team.school_id,
            p_parent_id: child.parent_id,
            p_amount: 150000,
            p_payment_method: 'manual',
            p_student_id: null,
            p_child_id: child.id
        };

        console.log("Calling RPC with Payload:");
        console.log(JSON.stringify(payload, null, 2));

        const rpcResult = await fetchSupabase('rpc/process_enrollment_checkout', 'POST', payload);
        console.log("\n[SUCCESS] Response:");
        console.log(JSON.stringify(rpcResult, null, 2));

        // Cleanup
        if (rpcResult && rpcResult.enrollment_id) {
            console.log("\nCleaning up...");
            await fetchSupabase(`enrollments?id=eq.${rpcResult.enrollment_id}`, 'DELETE');
            await fetchSupabase(`payments?id=eq.${rpcResult.payment_id}`, 'DELETE');
            console.log("Cleanup complete!");
        }
    } catch (e) {
        console.error("\n[FAILED] Error Details:");
        console.error(e.message || e);
    }
}

run();
