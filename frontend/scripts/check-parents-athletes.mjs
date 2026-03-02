
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://luebjarufsiadojhvxgi.supabase.co';
// Using Service Role Key to bypass RLS for administrative check (from existing scripts)
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZWJqYXJ1ZnNpYWRvamh2eGdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODkxNTY1OCwiZXhwIjoyMDc0NDkxNjU4fQ.UxkAmsGSCkbmlg5q2ip7RTSW8L4SGAytWL23ZXmWHro';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkData() {
    console.log('=============================================');
    console.log('   REPORT: PARENTS & ATHLETES (DB CHECK)   ');
    console.log('=============================================\n');

    // 1. Check Parents in 'profiles' table
    console.log('--- Parents (from profiles where role="parent") ---');
    const { data: parents, error: parentsError } = await supabase
        .from('profiles')
        .select('id, full_name, email, created_at')
        .eq('role', 'parent');

    if (parentsError) {
        console.error('❌ Error fetching parents:', parentsError.message);
    } else {
        if (parents.length === 0) {
            console.log('   No parents found.');
        } else {
            console.table(parents.map(p => ({
                ID: p.id,
                Name: p.full_name,
                Email: p.email || 'N/A',
                Created: new Date(p.created_at).toLocaleString()
            })));
            console.log(`   Total Parents: ${parents.length}`);
        }
    }

    console.log('\n');

    // 2. Check Athletes in 'children' table
    console.log('--- Athletes (from "children" table) ---');
    // Attempting to join with parent profile for name
    const { data: children, error: childrenError } = await supabase
        .from('children')
        .select('id, full_name, date_of_birth, sport, parent_id, created_at');

    if (childrenError) {
        console.error('❌ Error fetching children:', childrenError.message);
    } else {
        // We fetch parent names manually to be safe if join fails or is complex
        const parentIds = [...new Set(children.map(c => c.parent_id).filter(Boolean))];
        const { data: parentProfiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', parentIds);

        const parentMap = {};
        parentProfiles?.forEach(p => { parentMap[p.id] = p.full_name; });

        if (children.length === 0) {
            console.log('   No athletes/children found.');
        } else {
            console.table(children.map(c => ({
                ID: c.id,
                Name: c.full_name,
                DOB: c.date_of_birth,
                Sport: c.sport || 'N/A',
                Parent: parentMap[c.parent_id] || c.parent_id || 'Unknown',
                Created: new Date(c.created_at).toLocaleString()
            })));
            console.log(`   Total Athletes (Children): ${children.length}`);
        }
    }

    console.log('\n');

    // 3. Check for Athletes in 'profiles' table (direct accounts)
    console.log('--- Athletes (from profiles where role="athlete") ---');
    const { data: athleteProfiles, error: athleteProfilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, created_at')
        .eq('role', 'athlete');

    if (athleteProfilesError) {
        console.error('❌ Error fetching athlete profiles:', athleteProfilesError.message);
    } else {
        if (athleteProfiles.length === 0) {
            console.log('   No athlete profiles found (Role-based).');
        } else {
            console.table(athleteProfiles.map(p => ({
                ID: p.id,
                Name: p.full_name,
                Email: p.email || 'N/A',
                Created: new Date(p.created_at).toLocaleString()
            })));
            console.log(`   Total Athlete Profiles: ${athleteProfiles.length}`);
        }
    }
}

checkData();
