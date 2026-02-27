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
        console.log("Fetching team...");
        const tReq = await fetch(`${url}/rest/v1/teams?active=eq.true&select=id,school_id&limit=1`, fetchArgs('GET'));
        const [team] = await tReq.json();
        if (!team) throw new Error("No team found");

        console.log("Fetching user...");
        const uReq = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, fetchArgs('GET'));
        const [user] = await uReq.json();

        console.log("Executing RPC process_enrollment_checkout...");
        const payload = {
            p_program_id: team.id,
            p_school_id: team.school_id,
            p_parent_id: user.id,
            p_amount: 100,
            p_payment_method: 'manual',
            p_student_id: user.id,
            p_child_id: null
        };

        const rpcReq = await fetch(`${url}/rest/v1/rpc/process_enrollment_checkout`, fetchArgs('POST', payload));
        if (!rpcReq.ok) {
            const errText = await rpcReq.text();
            console.error("RPC Error:", errText);
            process.exit(1);
        }
        const result = await rpcReq.json();
        console.log("RPC Success:", result);

        if (result && result.enrollment_id) {
            console.log("Cleaning up test data...");
            await fetch(`${url}/rest/v1/enrollments?id=eq.${result.enrollment_id}`, fetchArgs('DELETE'));
            // payments shouldn't have id returned in this simple RPC based on previous code, but just in case
            if (result.payment_id) {
                await fetch(`${url}/rest/v1/payments?id=eq.${result.payment_id}`, fetchArgs('DELETE'));
            }
            console.log("Cleanup done.");
        }
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}
run();
