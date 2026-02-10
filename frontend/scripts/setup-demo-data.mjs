// Complete demo data setup: profiles + team member + enrollment
// Run: node scripts/setup-demo-data.mjs

const SUPABASE_URL = 'https://luebjarufsiadojhvxgi.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZWJqYXJ1ZnNpYWRvamh2eGdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODkxNTY1OCwiZXhwIjoyMDc0NDkxNjU4fQ.UxkAmsGSCkbmlg5q2ip7RTSW8L4SGAytWL23ZXmWHro';
const HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'apikey': SERVICE_ROLE_KEY,
    'Prefer': 'resolution=merge-duplicates',
};

// IDs from the admin user creation step
const SCHOOL_OWNER_ID = 'c605b590-3e65-43e8-87d1-9bdda049e5b4'; // Existing Spirit All Stars owner
const SCHOOL_ID = '81e9dc1d-3683-4b59-98f4-37197c77c213';
const TEAM_THUNDER_ID = 'd8838418-0462-4d88-b493-e656ee3e25d1';
const TEAM_LIGHTNING_ID = '630732ca-6ab9-4538-9547-d979b6b6198a';

// New demo users created via Admin API
const DEMO_IDS = {
    school: '04c1512c-517e-4a1e-b4a8-ba3b4b75470d',
    parent: '9158d496-7f39-46ad-95f9-83ca3379974e',
    coach: '1c26edad-7691-4fc4-8a42-eab2d7d174d5',
    athlete: '6aeb3969-a225-462c-a4c4-b7f71c0b2bcd',
    wellness: '51f449eb-5223-49b9-96ea-c1e817f334a5',
    store: '9447e937-7aec-486e-ad85-e48725d42833',
    admin: 'bcb88976-5998-440f-ba9b-803571bfb46f',
};

async function apiCall(endpoint, body, method = 'POST') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        method,
        headers: HEADERS,
        body: JSON.stringify(body),
    });
    const txt = await res.text();
    return { ok: res.ok, status: res.status, body: txt };
}

async function main() {
    console.log('🚀 Setting up demo data...\n');

    // ─── 1. Create/update profiles ────────────────────────────
    console.log('1️⃣  Creating profiles...');
    const profiles = [
        { id: DEMO_IDS.school, full_name: 'Spirit All Stars', role: 'school', is_demo: true },
        { id: DEMO_IDS.parent, full_name: 'María García Hernández', role: 'parent', is_demo: true },
        { id: DEMO_IDS.coach, full_name: 'Luis Fernando Rodríguez', role: 'coach', is_demo: true },
        { id: DEMO_IDS.athlete, full_name: 'Carlos Martínez López', role: 'athlete', is_demo: true },
        { id: DEMO_IDS.wellness, full_name: 'Dra. Sofía Rivera', role: 'wellness_professional', is_demo: true },
        { id: DEMO_IDS.store, full_name: 'Tienda Equípate Más', role: 'store_owner', is_demo: true },
        { id: DEMO_IDS.admin, full_name: 'Administrador Sistema', role: 'admin', is_demo: true },
    ];

    for (const p of profiles) {
        const r = await apiCall('profiles', p);
        console.log(`  ${r.ok ? '✅' : '❌'} ${p.full_name} (${p.role}) ${!r.ok ? r.body : ''}`);
    }

    // ─── 2. Add parent's child to Thunder team ────────────────
    console.log('\n2️⃣  Adding child to Thunder team...');
    const childMember = {
        team_id: TEAM_THUNDER_ID,
        player_name: 'Sofía García',
        position: 'Flyer',
        parent_contact: 'María García - spoortmaps@gmail.com',
        profile_id: DEMO_IDS.parent, // link to parent profile
    };
    const tmResult = await apiCall('team_members', childMember);
    console.log(`  ${tmResult.ok ? '✅' : '❌'} Sofía García → Thunder ${!tmResult.ok ? tmResult.body : ''}`);

    // Also add the athlete demo user to Lightning team
    console.log('\n3️⃣  Adding athlete to Lightning team...');
    const athleteMember = {
        team_id: TEAM_LIGHTNING_ID,
        player_name: 'Carlos Martínez López',
        position: 'Base',
        parent_contact: 'Padre Demo - 3001234567',
        profile_id: DEMO_IDS.athlete,
    };
    const atResult = await apiCall('team_members', athleteMember);
    console.log(`  ${atResult.ok ? '✅' : '❌'} Carlos → Lightning ${!atResult.ok ? atResult.body : ''}`);

    // ─── 3. Check enrollments schema and create enrollment ─────
    console.log('\n4️⃣  Checking enrollments schema...');
    const enrollCheck = await fetch(`${SUPABASE_URL}/rest/v1/enrollments?limit=0`, {
        headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
    });
    // Try to get column info by inserting a minimal record
    const testEnroll = await apiCall('enrollments', {
        student_name: 'test',
    });
    console.log(`  Enrollments test: ${testEnroll.body}`);

    // Try with likely columns
    const enrollData = {
        school_id: SCHOOL_ID,
        team_id: TEAM_THUNDER_ID,
        parent_id: DEMO_IDS.parent,
        student_name: 'Sofía García',
        status: 'active',
    };
    const enrollResult = await apiCall('enrollments', enrollData);
    console.log(`  ${enrollResult.ok ? '✅' : '❌'} Enrollment: ${enrollResult.body}`);

    console.log('\n✅ Demo data setup complete!');
    console.log('\nDemo credentials:');
    console.log('  School:  spoortmaps+school@gmail.com / SportMapsDemo2025!');
    console.log('  Parent:  spoortmaps@gmail.com / SportMapsDemo2025!');
    console.log('  Coach:   spoortmaps+coach@gmail.com / SportMapsDemo2025!');
    console.log('  Athlete: spoortmaps+athlete@gmail.com / SportMapsDemo2025!');
}

main().catch(console.error);
