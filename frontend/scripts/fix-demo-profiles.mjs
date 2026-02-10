// Fix profiles for already-created demo users
// Run: node scripts/fix-demo-profiles.mjs

const SUPABASE_URL = 'https://luebjarufsiadojhvxgi.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZWJqYXJ1ZnNpYWRvamh2eGdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODkxNTY1OCwiZXhwIjoyMDc0NDkxNjU4fQ.UxkAmsGSCkbmlg5q2ip7RTSW8L4SGAytWL23ZXmWHro';

const USERS = [
    { id: '04c1512c-517e-4a1e-b4a8-ba3b4b75470d', fullName: 'Spirit All Stars', role: 'school' },
    { id: '9158d496-7f39-46ad-95f9-83ca3379974e', fullName: 'María García Hernández', role: 'parent' },
    { id: '1c26edad-7691-4fc4-8a42-eab2d7d174d5', fullName: 'Luis Fernando Rodríguez', role: 'coach' },
    { id: '6aeb3969-a225-462c-a4c4-b7f71c0b2bcd', fullName: 'Carlos Martínez López', role: 'athlete' },
    { id: '51f449eb-5223-49b9-96ea-c1e817f334a5', fullName: 'Dra. Sofía Rivera', role: 'wellness_professional' },
    { id: '9447e937-7aec-486e-ad85-e48725d42833', fullName: 'Tienda Equípate Más', role: 'store_owner' },
    { id: 'bcb88976-5998-440f-ba9b-803571bfb46f', fullName: 'Administrador Sistema', role: 'admin' },
];

async function upsertProfile(user) {
    console.log(`Profile for: ${user.fullName} (${user.role})`);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'apikey': SERVICE_ROLE_KEY,
            'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
            id: user.id,
            full_name: user.fullName,
            role: user.role,
            subscription_tier: 'free',
        }),
    });

    if (res.ok) {
        console.log(`  ✅ OK`);
    } else {
        const err = await res.text();
        console.log(`  ❌ ${err}`);
    }
}

async function main() {
    console.log('Fixing profiles...\n');
    for (const u of USERS) await upsertProfile(u);
    console.log('\nDone!');
}

main().catch(console.error);
