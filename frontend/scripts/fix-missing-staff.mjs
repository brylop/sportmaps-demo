// Script to sync coaches from school_members to school_staff
// Run: node scripts/fix-missing-staff.mjs

const SUPABASE_URL = 'https://luebjarufsiadojhvxgi.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZWJqYXJ1ZnNpYWRvamh2eGdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODkxNTY1OCwiZXhwIjoyMDc0NDkxNjU4fQ.UxkAmsGSCkbmlg5q2ip7RTSW8L4SGAytWL23ZXmWHro';

async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'apikey': SERVICE_ROLE_KEY,
        }
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);
    const txt = await res.text();
    try {
        return { ok: res.ok, status: res.status, data: JSON.parse(txt) };
    } catch (e) {
        return { ok: res.ok, status: res.status, body: txt };
    }
}

async function main() {
    console.log('🔍 Buscando entrenadores en school_members...');

    // 1. Obtener miembros con rol 'coach'
    const membersRes = await apiCall('school_members?role=eq.coach&select=*,profiles(*)');

    if (!membersRes.ok) {
        console.error('❌ Error al obtener miembros:', membersRes.body);
        return;
    }

    const members = membersRes.data || [];
    console.log(`✅ Encontrados ${members.length} entrenadores.\n`);

    for (const member of members) {
        const profile = member.profiles;
        if (!profile) {
            console.log(`⚠️  Miembro ${member.id} no tiene perfil asociado. Saltando...`);
            continue;
        }

        console.log(`⚙️  Sincronizando: ${profile.full_name} (${profile.email})...`);

        // 2. Preparar datos para school_staff
        const staffData = {
            id: profile.id, // Usamos el mismo ID del perfil para consistencia si es posible, o dejamos que genere uno
            school_id: member.school_id,
            branch_id: member.branch_id,
            full_name: profile.full_name,
            email: profile.email,
            phone: profile.phone,
            status: 'active',
            specialty: profile.experience_level || 'Entrenador'
        };

        // Intentar upsert en school_staff
        // Nota: school_staff puede no tener el ID como profile_id, pero lo intentaremos por email si falla
        const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/school_staff`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'apikey': SERVICE_ROLE_KEY,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(staffData)
        });

        if (upsertRes.ok) {
            console.log(`  ✅ Sincronización exitosa.`);
        } else {
            const err = await upsertRes.text();
            console.log(`  ❌ Error: ${err}`);
        }
    }

    console.log('\n🚀 Proceso completado.');
}

main().catch(console.error);
