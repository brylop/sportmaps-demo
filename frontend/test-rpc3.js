import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
let url = '', key = '';
envContent.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/['"]/g, '').trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].replace(/['"]/g, '').trim();
});

async function run() {
    const fetchArgs = (method = 'GET', body = null) => {
        const args = {
            method,
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };
        if (body) args.body = JSON.stringify(body);
        return args;
    };

    try {
        console.log("=== Testing process_enrollment_checkout ===");

        const r1 = await fetch(`${url}/rest/v1/teams?active=eq.true&select=id,school_id&limit=1`, fetchArgs('GET'));
        const [team] = await r1.json();
        if (!team) throw new Error("No team found");

        const r2 = await fetch(`${url}/rest/v1/children?select=id,parent_id&not.parent_id=is.null&limit=1`, fetchArgs('GET'));
        let childs = await r2.json();
        if (!childs || childs.length === 0) {
            // fallback: adult enrollment
            console.log("No children found, falling back to adult enrollment.");
            const rUsers = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, fetchArgs('GET'));
            const [user] = await rUsers.json();

            const payload = { p_program_id: team.id, p_school_id: team.school_id, p_parent_id: user.id, p_amount: 150000, p_payment_method: 'manual', p_student_id: user.id, p_child_id: null };
            console.log("Payload:", JSON.stringify(payload, null, 2));

            const r3 = await fetch(`${url}/rest/v1/rpc/process_enrollment_checkout`, fetchArgs('POST', payload));
            const result = await r3.json();
            console.log("RPC Result:", JSON.stringify(result, null, 2));

            if (result && result.enrollment_id) {
                await fetch(`${url}/rest/v1/enrollments?id=eq.${result.enrollment_id}`, fetchArgs('DELETE'));
                await fetch(`${url}/rest/v1/payments?id=eq.${result.payment_id}`, fetchArgs('DELETE'));
                console.log("Cleanup done.");
            }
            return;
        }

        const child = childs[0];
        const payload = { p_program_id: team.id, p_school_id: team.school_id, p_parent_id: child.parent_id, p_amount: 150000, p_payment_method: 'manual', p_student_id: null, p_child_id: child.id };
        console.log("Payload:", JSON.stringify(payload, null, 2));

        const r3 = await fetch(`${url}/rest/v1/rpc/process_enrollment_checkout`, fetchArgs('POST', payload));
        const result = await r3.json();
        console.log("\nRPC Result:", JSON.stringify(result, null, 2));

        if (result && result.enrollment_id) {
            console.log("\nCleaning up...");
            await fetch(`${url}/rest/v1/enrollments?id=eq.${result.enrollment_id}`, fetchArgs('DELETE'));
            await fetch(`${url}/rest/v1/payments?id=eq.${result.payment_id}`, fetchArgs('DELETE'));
            console.log("Cleanup done.");
        }
    } catch (e) { console.error(e); }
}
run();
