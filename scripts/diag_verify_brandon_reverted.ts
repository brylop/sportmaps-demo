import { supabase } from './src/config/supabase';
async function main() {
  const { data: enr } = await supabase.from('enrollments').select('*').eq('id', '15bac68e-f02e-40c0-874f-dc38a4f96d1e').maybeSingle();
  const { data: unreg } = await supabase.from('unregistered_athletes').select('linked_profile_id, is_active, email').eq('id', 'cbc97d47-7c00-44ff-b488-e76f24d98474').maybeSingle();
  const { data: prof } = await supabase.from('profiles').select('id').eq('id', '15d0925b-c543-43da-95fe-85f0e53af196').maybeSingle();
  console.log('enrollment:', JSON.stringify(enr, null, 2));
  console.log('unregistered_athletes:', JSON.stringify(unreg));
  console.log('profile (debe ser null):', JSON.stringify(prof));
}
main().then(() => process.exit(0));
