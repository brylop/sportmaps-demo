// Script to create demo users via Supabase Admin API (bypasses rate limits)
// Run: node scripts/create-demo-users.mjs

const SUPABASE_URL = 'https://luebjarufsiadojhvxgi.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZWJqYXJ1ZnNpYWRvamh2eGdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODkxNTY1OCwiZXhwIjoyMDc0NDkxNjU4fQ.UxkAmsGSCkbmlg5q2ip7RTSW8L4SGAytWL23ZXmWHro';

const DEMO_USERS = [
    { email: 'spoortmaps+school@gmail.com', password: 'SportMapsDemo2025!', fullName: 'Spirit All Stars', role: 'school' },
    { email: 'spoortmaps@gmail.com', password: 'SportMapsDemo2025!', fullName: 'María García Hernández', role: 'parent' },
    { email: 'spoortmaps+coach@gmail.com', password: 'SportMapsDemo2025!', fullName: 'Luis Fernando Rodríguez', role: 'coach' },
    { email: 'spoortmaps+athlete@gmail.com', password: 'SportMapsDemo2025!', fullName: 'Carlos Martínez López', role: 'athlete' },
    { email: 'spoortmaps+wellness@gmail.com', password: 'SportMapsDemo2025!', fullName: 'Dra. Sofía Rivera', role: 'wellness_professional' },
    { email: 'spoortmaps+store@gmail.com', password: 'SportMapsDemo2025!', fullName: 'Tienda Equípate Más', role: 'store_owner' },
    { email: 'spoortmaps+admin@gmail.com', password: 'SportMapsDemo2025!', fullName: 'Administrador Sistema', role: 'admin' },
];

async function createUserAdmin(user) {
    console.log(`\nCreating: ${user.email} (${user.role})`);

    // Use Admin API to create user (bypasses rate limits + auto-confirms email)
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'apikey': SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
            email: user.email,
            password: user.password,
            email_confirm: true,
            user_metadata: {
                full_name: user.fullName,
                role: user.role,
            },
        }),
    });

    const data = await res.json();

    if (res.ok && data.id) {
        console.log(`  ✅ Created: ${data.id}`);
        await createProfile(data.id, user);
        return true;
    } else if (data.msg?.includes('already') || data.message?.includes('already')) {
        console.log(`  ℹ️ Already exists, updating password...`);
        // Find existing user by email
        const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(user.email)}`, {
            headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY },
        });
        const listData = await listRes.json();
        const existing = listData.users?.find(u => u.email === user.email);
        if (existing) {
            // Update password
            const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                    'apikey': SERVICE_ROLE_KEY,
                },
                body: JSON.stringify({
                    password: user.password,
                    email_confirm: true,
                    user_metadata: { full_name: user.fullName, role: user.role },
                }),
            });
            if (updateRes.ok) {
                console.log(`  ✅ Updated: ${existing.id}`);
                await createProfile(existing.id, user);
                return true;
            }
        }
        return false;
    } else {
        console.log(`  ❌ Error: ${JSON.stringify(data)}`);
        return false;
    }
}

async function createProfile(userId, user) {
    // Upsert profile using service_role (bypasses RLS)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'apikey': SERVICE_ROLE_KEY,
            'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
            id: userId,
            full_name: user.fullName,
            role: user.role,
            sportmaps_points: 0,
            subscription_tier: 'free',
        }),
    });

    if (res.ok) {
        console.log(`  📋 Profile upserted`);
    } else {
        const err = await res.text();
        console.log(`  ⚠️ Profile error: ${err}`);
    }
}

async function main() {
    console.log('🚀 Creating demo users via Admin API...\n');
    let success = 0, failed = 0;

    for (const user of DEMO_USERS) {
        const ok = await createUserAdmin(user);
        if (ok) success++; else failed++;
    }

    console.log(`\n========================================`);
    console.log(`✅ Success: ${success} | ❌ Failed: ${failed}`);
    console.log(`========================================\n`);
}

main().catch(console.error);
